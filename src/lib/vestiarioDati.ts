import type { SupabaseClient } from '@supabase/supabase-js'
import { haUnServer } from './dati'
import { sembraItaliano } from './importa'
import { chiaveGiorno } from './sala'
import { emailDi, ORDINE_SPARITO, type Capo, type Catalogo, type DatiVestiario, RACCOLTA_SPARITA, type Ordine, type OrdineNuovo, type Pagamento, type RigaCorretta, type Riga } from './vestiario'

/**
 * Gli ordini di vestiario col database vero (`supabase/47-vestiario.sql`), e
 * la scelta fra quello e la prova, come per le richieste di iscrizione.
 *
 * Chi ordina dal link non ha un accesso: parla solo con `vestiario()` e
 * `invia_ordine_vestiario()`. La segreteria legge le tre tabelle, cambia a
 * mano annullato e raccolta di un ordine, e passa dalle funzioni per
 * il resto: prezzi e totale li mette sempre il database.
 *
 * Gli `as` sulle risposte: supabase-js qui non conosce lo schema (non ci sono
 * tipi generati), e i tipi scritti sotto sono quelli di 47-vestiario.sql.
 */

/** Come la pagina senza catalogo: la funzione c'è ma anon non la può chiamare (06-iscrizioni.sql rilanciato dopo il 47). */
export const NON_ANCORA_APERTI = 'In questo momento non si ordina il vestiario: gli ordini non sono ancora aperti'

export const MANCA_VESTIARIO = 'Il vestiario non è attivo sul database: va lanciato 47-vestiario.sql (anche dopo ogni volta che si rilancia 06-iscrizioni.sql)'

type ErroreDb = { message?: string; code?: string } | null

// La funzione, la tabella o la colonna che mancano: il file 47 non è stato lanciato.
const manca = (e: ErroreDb) => ['PGRST202', 'PGRST205', '42883', '42P01', 'PGRST200'].includes(e?.code ?? '') && /vestiario/.test(e?.message ?? '')

/**
 * Un errore del database detto per chi usa l'app. Passano com'è solo i
 * nostri `raise exception`: P0001 sempre; 22023 e 54000 se il testo sembra
 * italiano, perché gli stessi codici li dà anche Postgres, in inglese.
 */
function guaio(e: ErroreDb): Error {
  if (manca(e)) return new Error(MANCA_VESTIARIO)
  const m = e?.message ?? ''
  if (m && (e?.code === 'P0001' || (['22023', '54000'].includes(e?.code ?? '') && sembraItaliano(m)))) return new Error(m)
  if (e?.code === '42501') return new Error(/segreteria/.test(m) ? m : 'Non hai il permesso: serve un accesso da segreteria')
  // Il testo del server (in inglese, per chi sviluppa) va solo nella console. Lo stesso di
  // `sconosciuto` in segreteriaSupabase.ts, che qui non si importa: si tirerebbe dietro tutta
  // la segreteria nella pagina pubblica degli ordini.
  if (m) console.error(m)
  return new Error(/failed to fetch|networkerror|load failed/i.test(m) ? 'Non c’è rete: riprova quando torna' : 'Non è andata: riprova fra poco')
}

function ok<T>(r: { data: T; error: ErroreDb }): T {
  if (r.error) throw guaio(r.error)
  return r.data
}

interface RigaDb {
  per_chi: string
  capo: string
  taglia: string
  quanti: number
  prezzo: number
}

interface OrdineDb {
  id: string
  raccolta_id: string
  nome: string
  cognome: string
  telefono: string
  email: string | null
  totale: number
  saldato: boolean
  annullato: boolean
  pagato: number
  pagato_con: Pagamento | null
  pagato_il: string | null
  creato_il: string
  dal_banco: boolean
  righe_vestiario: RigaLetta[]
}

/** Una riga letta dalla tabella ha sempre il suo id; quelle che tornano da `invia_ordine_vestiario` no. */
type RigaLetta = RigaDb & { id: string }

const riga = (r: RigaDb, id: string): Riga => ({ id, perChi: r.per_chi, capo: r.capo, taglia: r.taglia, quanti: r.quanti, prezzo: Number(r.prezzo) })
const perDb = (r: RigaCorretta) => ({ ...(r.id && { id: r.id }), per_chi: r.perChi, capo: r.capo, taglia: r.taglia, quanti: r.quanti })
const datiDb = (o: OrdineNuovo) => ({ ...(o.id && { id: o.id }), nome: o.nome, cognome: o.cognome, telefono: o.telefono, email: emailDi(o), righe: o.righe.map(perDb) })

export function creaVestiarioSupabase(db: SupabaseClient): DatiVestiario {
  // Una riga cambiata a mano: zero righe vuol dire che l'ordine non c'è più, o che non è della segreteria.
  const cambia = async (id: string, cambi: Record<string, unknown>) => {
    const r = await db.from('ordini_vestiario').update(cambi).eq('id', id).select('id')
    // 23503: la raccolta scelta per SPOSTA non c'è più. Lo stesso messaggio della prova.
    if (r.error?.code === '23503') throw new Error(RACCOLTA_SPARITA)
    if (!ok(r)?.length) throw new Error(ORDINE_SPARITO)
  }

  return {
    async catalogo() {
      const r = await db.rpc('vestiario')
      // Senza il file 47 la pagina pubblica è semplicemente «non ancora aperta». Anche col 42501:
      // rilanciare 06-iscrizioni.sql dopo il 47 toglie `vestiario()` ad anon.
      if (r.error && (manca(r.error) || r.error.code === '42501')) {
        aperti = false
        return null
      }
      const x = ok(r) as { chiude: string | null; capi: Array<Capo & { nota?: string | null }>; aperti?: boolean } | null
      aperti = typeof x?.aperti === 'boolean' ? x.aperti : undefined
      if (!x) return null
      return { chiude: x.chiude, capi: (x.capi ?? []).map((c) => ({ capo: c.capo, taglie: c.taglie, prezzo: Number(c.prezzo), ...(c.nota && { nota: c.nota }) })) }
    },

    async salvaCatalogo(c: Catalogo) {
      ok(await db.rpc('salva_vestiario', { catalogo: c }))
    },

    async inviaOrdine(o) {
      const r = await db.rpc('invia_ordine_vestiario', { dati: datiDb(o) })
      // Come `catalogo()`: senza il permesso di anon la pagina non è ancora aperta, non è della segreteria.
      if (r.error?.code === '42501') throw new Error(NON_ANCORA_APERTI)
      const x = ok(r) as { id: string; totale: number; righe: RigaDb[] }
      // Il genitore non rilegge l'ordine: quel che torna basta al riepilogo.
      return {
        id: x.id,
        raccolta: '',
        nome: o.nome.trim(),
        cognome: o.cognome.trim(),
        telefono: o.telefono.trim(),
        email: emailDi(o),
        righe: x.righe.map((r, i) => riga(r, `${x.id}-${i}`)),
        totale: Number(x.totale),
        saldato: false,
        annullato: false,
        pagato: 0,
        pagatoCon: null,
        pagatoIl: null,
        arrivato: new Date().toISOString(),
        dalBanco: false,
      }
    },

    async scriviOrdine(o, come = null) {
      return ok(await db.rpc('scrivi_ordine_vestiario', { dati: datiDb(o), come })) as string
    },

    async raccolte() {
      const x = ok(await db.from('raccolte_vestiario').select('id, chiude').order('creata_il', { ascending: false })) as Array<{ id: string; chiude: string }>
      return x.map((r) => ({ id: r.id, chiude: r.chiude }))
    },

    async ordini(raccolta) {
      const x = ok(
        await db
          .from('ordini_vestiario')
          .select('id, raccolta_id, nome, cognome, telefono, email, totale, saldato, annullato, pagato, pagato_con, pagato_il, creato_il, dal_banco, righe_vestiario(id, per_chi, capo, taglia, quanti, prezzo)')
          .eq('raccolta_id', raccolta)
          .order('creato_il', { ascending: false })
          // Le righe nell'ordine in cui sono state scritte, non in quello in cui le dà Postgres.
          .order('posizione', { referencedTable: 'righe_vestiario' }),
      ) as OrdineDb[]
      return x.map(
        (o): Ordine => ({
          id: o.id,
          raccolta: o.raccolta_id,
          nome: o.nome,
          cognome: o.cognome,
          telefono: o.telefono,
          email: o.email,
          righe: o.righe_vestiario.map((r) => riga(r, r.id)),
          totale: Number(o.totale),
          saldato: o.saldato,
          annullato: o.annullato,
          pagato: Number(o.pagato),
          pagatoCon: o.pagato_con,
          pagatoIl: o.pagato_il,
          arrivato: o.creato_il,
          dalBanco: o.dal_banco,
        }),
      )
    },

    // Saldato passa da `segna_vestiario`: pagato, come e quando li mette il database insieme al segno.
    async segnaSaldato(id, come, tieniPagato = false) {
      ok(await db.rpc('segna_vestiario', { ordine: id, come, tieni_pagato: tieniPagato }))
    },
    annulla: (id, annullato) => cambia(id, { annullato }),
    sposta: (id, raccolta) => cambia(id, { raccolta_id: raccolta }),

    async correggiRighe(id, righe, togliSegno = false) {
      ok(await db.rpc('correggi_ordine_vestiario', { ordine: id, righe: righe.map(perDb), togli_segno: togliSegno }))
    },
  }
}

/**
 * Se il database, all'ultima lettura del catalogo, diceva aperti: conta il suo
 * orologio (Europa/Roma), non quello del telefono. `undefined` in prova o
 * prima di leggere: allora decide `ordiniAperti` col giorno del dispositivo.
 */
let aperti: boolean | undefined
export const apertiLetti = () => aperti

const SEMINATO = 'ods-corsi:prova-esempi-vestiario'   // vedi la nota in coda.ts

/** Per «Riparti dall'orario vero»: al prossimo caricamento gli esempi del vestiario tornano. */
export function scordaEsempiVestiario() {
  try {
    localStorage.removeItem(SEMINATO)
  } catch {
    /* pazienza */
  }
}

/**
 * In prova la pagina parte con un catalogo inventato e qualche ordine, una
 * volta per dispositivo: con un catalogo vuoto non si vedrebbe niente. Una
 * raccolta già chiusa e una aperta, così SPOSTA ha dove andare.
 */
async function semina(d: DatiVestiario) {
  try {
    if (localStorage.getItem(SEMINATO) || (await d.catalogo())) return
    localStorage.setItem(SEMINATO, '1')
  } catch {
    return
  }
  const fra = (giorni: number) => chiaveGiorno(new Date(Date.now() + giorni * 86_400_000))
  const capi: Capo[] = [
    { capo: 'Judogi bianco', taglie: ['110', '120', '130', '140', '150', '160', '170', '180', '190', '200'], prezzo: 35, nota: 'Prendi l’altezza del bambino e aggiungi 10 cm. I campioni sono in segreteria.' },
    { capo: 'Costumino da lotta', taglie: ['6', '8', '10', '12', '14', 'XS', 'S', 'M', 'L'], prezzo: 30, nota: 'Fino ai 14 anni la taglia è l’età: a 8 anni, la 8.' },
    { capo: 'Felpa ODS', taglie: ['6', '8', '10', '12', 'XS', 'S', 'M', 'L', 'XL'], prezzo: 28 },
    { capo: 'Cintura', taglie: ['220', '240', '260', '280'], prezzo: 6, nota: 'Per i bambini va bene la 240.' },
  ]
  const ordine = (nome: string, cognome: string, telefono: string, righe: Array<[string, string, string]>) => ({
    nome,
    cognome,
    telefono,
    righe: righe.map(([perChi, capo, taglia]) => ({ perChi, capo, taglia, quanti: 1 })),
  })
  await d.salvaCatalogo({ chiude: fra(-150), capi })
  await d.scriviOrdine(ordine('Anna', 'Colombo', '339 210 4488', [['Giulia Colombo', 'Felpa ODS', 'S']]), 'contanti')
  await d.salvaCatalogo({ chiude: fra(22), capi })
  await d.scriviOrdine(ordine('Paola', 'Rossi', '333 123 4567', [['Luca Rossi', 'Judogi bianco', '130'], ['Sara Rossi', 'Costumino da lotta', '8'], ['Sara Rossi', 'Felpa ODS', '8']]))
  await d.scriviOrdine(ordine('Marco', 'Bianchi', '347 555 0192', [['Tommaso Bianchi', 'Judogi bianco', '140'], ['Tommaso Bianchi', 'Cintura', '240']]), 'bonifico')
  await d.scriviOrdine(ordine('Luca', 'Ferrari', '320 781 1903', [['Pietro Ferrari', 'Costumino da lotta', '10']]))
  const annullato = await d.scriviOrdine(ordine('Chiara', 'Marino', '333 640 2275', [['Nicolò Marino', 'Judogi bianco', '150']]))
  await d.annulla(annullato, true)
}

let unico: Promise<DatiVestiario> | null = null

export function datiVestiario(): Promise<DatiVestiario> {
  if (!unico) {
    unico = (haUnServer
      ? import('./supabase').then((s) => creaVestiarioSupabase(s.clientSupabase()))
      : import('./vestiarioProva').then(async (m) => {
          const d = m.creaVestiarioProva()
          await semina(d)
          return d
        }))
      // Se il pezzo non arriva (rete, o un aggiornamento pubblicato nel
      // frattempo), la volta dopo si riprova invece di restare rotti.
      .catch((e) => {
        unico = null
        throw e
      })
  }
  return unico
}
