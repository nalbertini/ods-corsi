import { FunctionsHttpError, type SupabaseClient } from '@supabase/supabase-js'
import type { DatiRichieste, FileRichiesta, Richiesta, StatoRichiesta, TipoFile } from './richieste'
import { ACCOLTA_RESTA, ESTENSIONI, MASSIMO_FILE, siElimina } from './richieste'
import { tutteLeRighe } from './tutteLeRighe'
import { cosaNonVaScadenza } from './segreteria'
import { pulisciConosciuto, pulisciProvenienza } from './provenienza'
import { CARTA_SPENTA, ERRORE_CARTA, ERRORE_SATISPAY, SATISPAY_SPENTO, type StatoSatispay } from './satispay'
import { SERVE_RETE } from './saldoSatispay'

/**
 * Le richieste di iscrizione col database vero (`supabase/06-iscrizioni.sql`).
 *
 * Chi si iscrive non ha un accesso: parla solo con `corsi_aperti` e
 * `invia_iscrizione`, e carica i file nella cartella della sua richiesta, che
 * il server tiene aperta per un'ora. La segreteria legge la tabella e apre i
 * file con un link che scade dopo dieci minuti.
 */

const CONTENITORE = 'iscrizioni'
const DURATA_LINK = 600

interface Riga {
  id: string
  creata_il: string
  stato: StatoRichiesta
  nome: string
  cognome: string
  nato_il: string
  nato_a: string
  codice_fiscale: string
  indirizzo: string
  cap: string
  comune: string
  email: string
  telefono: string
  telefono_2: string | null
  genitore_nome: string | null
  genitore_cognome: string | null
  genitore_codice_fiscale: string | null
  corsi: string[]
  formula: 'annuale' | 'trimestre'
  note: string | null
  regolamento: boolean
  persona_id: string | null
  gestita_il: string | null
  gestore: { nome: string; cognome: string } | null
  /** Da `74-provenienza-richieste.sql`: prima le colonne non ci sono. */
  provenienza?: string | null
  conosciuto?: string | null
}

function guaio(e: { message?: string; code?: string } | null): Error {
  if (e?.code === '42501') return new Error('Non hai il permesso: serve un accesso da segreteria')
  // La funzione non c'è sul database: 06-iscrizioni.sql non è stato lanciato.
  if (e?.code === 'PGRST202')
    return new Error('Il modulo di iscrizione non è ancora attivo sul database: la segreteria deve lanciare 06-iscrizioni.sql')
  return new Error(e?.message || 'Il server non risponde')
}

function ok<T>(r: { data: T; error: { message?: string; code?: string } | null }): T {
  if (r.error) throw guaio(r.error)
  return r.data
}

/** Un errore dello Storage detto per chi sta caricando la foto di un documento. */
function guaioFile(e: { message?: string; statusCode?: string } | null): Error {
  const m = e?.message ?? ''
  if (/row-level security|unauthorized|403/i.test(m + (e?.statusCode ?? '')))
    return new Error('Il tempo per caricare i file è scaduto, o sono già arrivati tutti: scrivi alla segreteria')
  if (/exceeded|too large|413/i.test(m + (e?.statusCode ?? ''))) return new Error('Il file è troppo grande: al massimo 10 MB')
  if (/mime|type/i.test(m)) return new Error('Questo tipo di file non va: serve una foto o un PDF')
  if (/exists|duplicate/i.test(m)) return new Error('Questo file è già arrivato')
  return new Error(m || 'Il file non è partito: riprova')
}

/** Una Edge Function di pagamento: i suoi errori sono già scritti per chi paga. */
async function chiamaPagamento(db: SupabaseClient, funzione: 'satispay' | 'paypal', corpo: Record<string, string>, guasto: string, senzaRete: string): Promise<Record<string, unknown>> {
  const { data, error } = await db.functions.invoke(funzione, { body: corpo })
  // `as`: la risposta è il JSON della funzione (supabase/functions/<funzione>), letto campo per campo da chi chiama.
  if (!error) return (data ?? {}) as Record<string, unknown>
  if (!(error instanceof FunctionsHttpError)) throw new Error(senzaRete)
  // La funzione non c'è ancora sul progetto: si paga come prima.
  if (error.context.status === 404) return { attivo: false }
  const detto: unknown = await error.context.json().catch(() => null)
  const guaio = typeof detto === 'object' && detto !== null && 'guaio' in detto ? detto.guaio : null
  throw new Error(typeof guaio === 'string' ? guaio : guasto)
}

/** La Edge Function `satispay`; senza rete, l'errore di sempre. */
export const chiamaSatispay = (db: SupabaseClient, corpo: Record<string, string>) => chiamaPagamento(db, 'satispay', corpo, ERRORE_SATISPAY, ERRORE_SATISPAY)

export function creaRichiesteSupabase(db: SupabaseClient): DatiRichieste {
  const satispay = (corpo: Record<string, string>) => chiamaSatispay(db, corpo)
  // La carta passa da PayPal: senza rete lo si dice, perché i campi carta non si aprono.
  const paypal = (corpo: Record<string, string>) => chiamaPagamento(db, 'paypal', corpo, ERRORE_CARTA, SERVE_RETE)

  const vista = (r: Riga): Richiesta => ({
    id: r.id,
    creataIl: r.creata_il,
    stato: r.stato,
    nome: r.nome,
    cognome: r.cognome,
    natoIl: r.nato_il,
    natoA: r.nato_a,
    codiceFiscale: r.codice_fiscale,
    indirizzo: r.indirizzo,
    cap: r.cap,
    comune: r.comune,
    email: r.email,
    telefono: r.telefono,
    telefono2: r.telefono_2 ?? undefined,
    genitoreNome: r.genitore_nome ?? undefined,
    genitoreCognome: r.genitore_cognome ?? undefined,
    genitoreCodiceFiscale: r.genitore_codice_fiscale ?? undefined,
    corsi: r.corsi,
    formula: r.formula,
    note: r.note ?? undefined,
    regolamento: r.regolamento,
    personaId: r.persona_id ?? undefined,
    gestitaIl: r.gestita_il ?? undefined,
    gestitaDa: r.gestore ? `${r.gestore.nome} ${r.gestore.cognome}`.trim() : undefined,
    provenienza: pulisciProvenienza(r.provenienza),
    conosciuto: pulisciConosciuto(r.conosciuto),
  })

  const nomi = async (richiestaId: string) => {
    const { data, error } = await db.storage.from(CONTENITORE).list(richiestaId)
    if (error) throw guaioFile(error)
    return (data ?? []).map((f) => `${richiestaId}/${f.name}`)
  }

  return {
    modo: 'supabase',

    async corsiAperti() {
      return ok(await db.rpc('corsi_aperti')) as Array<{ id: string; nome: string }>
    },

    async orariAperti() {
      // Prima di 48-orari-aperti.sql (o senza rete) non c'è «stessa ora»: il modulo va avanti lo stesso.
      try {
        const { data, error } = await db.rpc('orari_aperti')
        if (error || !Array.isArray(data)) return []
        // Le colonne di orari_aperti() in 48-orari-aperti.sql: il client non le conosce.
        return (data as Array<{ corso_id: string; giorno: number; ora: string; durata_min: number }>).map((r) => ({
          corsoId: r.corso_id,
          giorno: r.giorno,
          ora: r.ora.slice(0, 5),
          durata: r.durata_min,
        }))
      } catch {
        return []
      }
    },

    async invia(d) {
      return ok(
        await db.rpc('invia_iscrizione', {
          dati: {
            nome: d.nome,
            cognome: d.cognome,
            nato_il: d.natoIl,
            nato_a: d.natoA,
            codice_fiscale: d.codiceFiscale,
            indirizzo: d.indirizzo,
            cap: d.cap,
            comune: d.comune,
            email: d.email,
            telefono: d.telefono,
            telefono_2: d.telefono2,
            genitore_nome: d.genitoreNome,
            genitore_cognome: d.genitoreCognome,
            genitore_codice_fiscale: d.genitoreCodiceFiscale,
            corsi: d.corsi,
            formula: d.formula,
            note: d.note,
            regolamento: d.regolamento === true,
            // Il database le pulisce e scarta quelle che non vanno; senza 74-provenienza-richieste.sql le ignora.
            provenienza: d.provenienza,
            conosciuto: d.conosciuto,
            // Il pagamento fatto in fondo al modulo: senza 83-satispay-prima.sql la chiave si ignora.
            pagamento_satispay: d.pagamentoSatispay,
            // Le richieste della stessa famiglia: senza 84-avvisi-segreteria.sql la chiave si ignora.
            invio: d.invio,
            // Il titolare del nucleo: senza 100-nucleo.sql la chiave si ignora; senza nucleo non parte.
            nucleo_di: d.nucleoDi,
          },
        }),
      ) as string
    },

    async caricaFile(richiestaId, tipo, file) {
      const est = ESTENSIONI[file.type]
      if (!est) throw new Error('Questo tipo di file non va: serve una foto o un PDF')
      if (file.size > MASSIMO_FILE) throw new Error('Il file è troppo grande: al massimo 10 MB')
      const { error } = await db.storage.from(CONTENITORE).upload(`${richiestaId}/${tipo}.${est}`, file, { contentType: file.type, upsert: false })
      // «C'è già» vuol dire che il file era arrivato e si era persa solo la
      // risposta (una rete da telefono): per chi riprova è andata.
      if (error && /exists|duplicate/i.test(error.message ?? '')) return
      if (error) throw guaioFile(error)
    },

    async paga(richiestaId) {
      const r = await satispay({ azione: 'paga', richiesta: richiestaId })
      if (r.attivo === false) return null
      if (r.pagato) return { pagato: true }
      if (typeof r.link !== 'string') throw new Error(ERRORE_SATISPAY)
      return { link: r.link }
    },

    async prepara(x, metodo) {
      const carta = metodo === 'carta'
      const errore = carta ? ERRORE_CARTA : ERRORE_SATISPAY
      const r = await (carta ? paypal : satispay)({ azione: 'prepara', corso: x.corso, formula: x.formula, nome: x.nome, cognome: x.cognome, email: x.email, ...(carta ? { chiave: x.chiave } : {}) })
      // Senza il file SQL (83-satispay-prima, 115-carta) la funzione dice che il servizio non c'è: si paga col bonifico.
      if (r.attivo === false) throw new Error(carta ? CARTA_SPENTA : SATISPAY_SPENTO)
      if (typeof r.id !== 'string' || typeof r.importo !== 'number') throw new Error(errore)
      if (r.stato === 'pagato') return { stato: 'pagato', id: r.id, importo: r.importo, pagatoIl: typeof r.pagato_il === 'string' ? r.pagato_il : undefined }
      if (carta) {
        if (typeof r.ordine !== 'string') throw new Error(errore)
        return { stato: 'attesa', id: r.id, importo: r.importo, ordine: r.ordine }
      }
      if (typeof r.link !== 'string') throw new Error(errore)
      return { stato: 'attesa', id: r.id, importo: r.importo, link: r.link }
    },

    async cartaAttiva() {
      try {
        const r = await paypal({ azione: 'attivo' })
        return r.attivo === true && typeof r.clientId === 'string' ? { clientId: r.clientId, sandbox: r.sandbox !== false } : null
      } catch {
        return null
      }
    },

    async pagaCarta(pagamentoId) {
      const r = await paypal({ azione: 'cattura', pagamento: pagamentoId })
      if (r.attivo === false) throw new Error(CARTA_SPENTA)
      // `as`: la forma è quella di `carta_stato_pagamento` (115-carta.sql), riletta dalla funzione dopo la cattura.
      const p = r.pagamento as { stato: StatoSatispay; importo: number; pagato_il?: string | null } | null | undefined
      if (!p) throw new Error(ERRORE_CARTA)
      return { stato: p.stato, importo: p.importo, pagatoIl: p.pagato_il ?? undefined }
    },

    async statoSatispay(pagamentoId, metodo) {
      const r = await (metodo === 'carta' ? paypal : satispay)({ azione: 'stato_pagamento', pagamento: pagamentoId })
      // `as`: la forma è quella di `satispay_stato_pagamento` (83-satispay-prima.sql), riletta dalla funzione.
      const p = r.pagamento as { stato: StatoSatispay; importo: number; pagato_il?: string | null; collegato?: boolean } | null | undefined
      return p ? { stato: p.stato, importo: p.importo, pagatoIl: p.pagato_il ?? undefined, collegato: p.collegato === true } : null
    },

    async satispayAttivo() {
      try {
        return (await satispay({ azione: 'attivo' })).attivo === true
      } catch {
        return false
      }
    },

    async statoPagamento(richiestaId) {
      const r = await satispay({ azione: 'stato', richiesta: richiestaId })
      // `as`: la forma è quella di `satispay_stato` (73-satispay.sql), riletta dalla funzione.
      const p = r.pagamento as { stato: StatoSatispay; importo: number; pagato_il?: string | null } | null | undefined
      return p ? { stato: p.stato, importo: p.importo, pagatoIl: p.pagato_il ?? undefined } : null
    },

    async richieste() {
      const righe = ok(
        await tutteLeRighe((prima, ultima) =>
          db
            .from('richieste_iscrizione')
            .select('*, gestore:persone!gestita_da ( nome, cognome )')
            .order('creata_il', { ascending: false })
            .order('id')
            .range(prima, ultima),
        ),
      ) as unknown as Riga[]
      return righe.map(vista)
    },

    async file(richiestaId) {
      const tutti = await nomi(richiestaId)
      if (!tutti.length) return []
      const { data, error } = await db.storage.from(CONTENITORE).createSignedUrls(tutti, DURATA_LINK)
      if (error) throw guaioFile(error)
      return (data ?? []).flatMap((f): FileRichiesta[] => {
        const nome = f.path?.split('/')[1] ?? ''
        const tipo = nome.replace(/\.[a-z]+$/, '') as TipoFile
        return f.signedUrl ? [{ tipo, url: f.signedUrl, pdf: nome.endsWith('.pdf') }] : []
      })
    },

    async conDocumento() {
      const r = await db.rpc('richieste_con_documento')
      // Senza 06-iscrizioni.sql rilanciato la funzione non c'è: niente da segnalare, l'elenco si vede lo stesso.
      if (r.error?.code === 'PGRST202') return new Set<string>()
      return new Set((ok(r) as string[] | null) ?? [])
    },

    async eliminaFile(richiestaId, tipo) {
      const suoi = (await nomi(richiestaId)).filter((n) => n.split('/')[1]?.replace(/\.[a-z]+$/, '') === tipo)
      if (!suoi.length) return
      const { data, error } = await db.storage.from(CONTENITORE).remove(suoi)
      if (error) throw guaioFile(error)
      // Lo Storage non dice di no quando la policy non lascia cancellare: torna meno file.
      if ((data ?? []).length < suoi.length) throw new Error('Il file non si è cancellato: serve un accesso da segreteria')
    },

    async accogli(richiestaId, personaId, scade) {
      const guasto = scade ? cosaNonVaScadenza(scade) : null
      if (guasto) throw new Error(guasto)
      // `persona` e `scade` solo quando ci sono: il database usa i suoi valori di partenza.
      return ok(await db.rpc('accogli_iscrizione', { richiesta: richiestaId, ...(personaId && { persona: personaId }), ...(scade && { scade }) })) as string
    },

    async rifiuta(richiestaId) {
      ok(await db.rpc('rifiuta_iscrizione', { richiesta: richiestaId }))
    },

    async elimina(richiestaId) {
      // Prima lo stato: la policy direbbe di no alla riga solo dopo che i file sono andati.
      // Una riga che non si legge non ha dati da perdere: si puliscono i file come prima.
      const [riga] = (ok(await db.from('richieste_iscrizione').select('stato, persona_id').eq('id', richiestaId)) ?? []) as Array<{ stato: StatoRichiesta; persona_id: string | null }>
      if (riga && !siElimina({ stato: riga.stato, personaId: riga.persona_id ?? undefined })) throw new Error(ACCOLTA_RESTA)
      // Poi i file: una riga senza file è innocua, un file senza riga resta
      // lì e nessuno lo ritrova più.
      const tutti = await nomi(richiestaId)
      if (tutti.length) {
        const { error } = await db.storage.from(CONTENITORE).remove(tutti)
        if (error) throw guaioFile(error)
      }
      ok(await db.from('richieste_iscrizione').delete().eq('id', richiestaId))
    },
  }
}
