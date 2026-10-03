import type { SupabaseClient } from '@supabase/supabase-js'
import { allungaCalendario } from './allunga'
import type { AllenamentoSeg, Anagrafica, AnagraficaDi, CorsoSeg, DatiSegreteria, Impostazioni, LezioneSeg, PersonaSeg, PersonaleSeg, PresenzaIstruttoreSeg, ComePresenzaIstruttore, ProvaSeg, RigaRegistro, Statistiche, StatoBackup, StatoPagamento, StoricoSeg } from './segreteria'
import { cosaNonVaAnagrafica, pulisciAnagrafica } from './segreteria'
import { nomeProprio } from './nomi'
import { insegna, type RuoloPersonale } from './ruoli'
import type { StatoPresenzaIstruttore } from './tablet'
import type { StatoPresenza, StatoSessione } from './sala'
import { chiaveGiorno, giornoDi, valeIl } from './sala'
import { fonteDelLink, MAX_NOME_LISTA } from './musica'
import { indirizzoDiRitorno } from './invito'
import { eserciziDellaPalestra, voceDellaSala } from '../../timer/src/lib/impostazioniSala'
import { CONTENITORE_VOCE, chiaveValida, chiaviSulServer, scaricaClip } from '../../timer/src/lib/clipSala'
import { cosaNonVa, ENTE_PREDEFINITO, intestatarioDaRichiesta, pulisciIntestatario, type EnteRicevuta, type IntestatarioRicevuta, type Ricevuta, type VoceRicevuta } from './ricevute'
import { cosaNonVaListino, LISTINO_PREDEFINITO, listinoDa, scordaListino } from './listino'
import { kanjiScritto } from './kanji'
import { cosaNonVaSegnalazione, type Segnalazione } from './segnalazioni'

/**
 * La segreteria col database vero.
 *
 * Scrive direttamente sulle tabelle: le policy di `02-policy.sql` lasciano
 * scrivere solo chi ha il ruolo `staff`, e i trigger di `05-segreteria.sql`
 * fanno seguire alle lezioni future i cambi di un corso. Qui non ci sono
 * controlli di permesso: se non si può, il server risponde di no e la
 * schermata lo dice.
 */

interface RigaSessione {
  id: string
  corso_id: string
  ricorrenza_id: string | null
  inizio: string
  fine: string
  stato: StatoSessione
  sala_id: string | null
  istruttore_id: string | null
  corsi: { nome: string; colore: string | null; capienza: number | null; sala_id: string | null; istruttore_id: string | null } | null
  sale: { nome: string } | null
  persone: { nome: string; cognome: string } | null
}

type Iscrizione = { corso_id: string; persona_id: string; dal: string; al: string | null }

/** Una riga di `ricevute` (16-ricevute.sql): le voci sono il JSON che scrive `emetti_ricevuta`. */
interface RigaRicevuta {
  id: string
  anno: number
  numero: number
  data: string
  persona_id: string | null
  ente: EnteRicevuta
  intestatario: IntestatarioRicevuta
  voci: Array<Omit<VoceRicevuta, 'dal' | 'al'> & { dal: string | null; al: string | null }>
  totale: number
  pagato: number
  anticipo: number
  note: string | null
  creata_il: string
  annullata_il: string | null
}
const CAMPI_RICEVUTA = 'id, anno, numero, data, persona_id, ente, intestatario, voci, totale, pagato, anticipo, note, creata_il, annullata_il'

const ricevuta = (r: RigaRicevuta): Ricevuta => ({
  id: r.id,
  anno: r.anno,
  numero: r.numero,
  data: r.data,
  personaId: r.persona_id ?? undefined,
  ente: { ...ENTE_PREDEFINITO, ...r.ente },
  intestatario: r.intestatario,
  voci: r.voci.map((v) => ({ ...v, dal: v.dal ?? undefined, al: v.al ?? undefined })),
  totale: r.totale,
  pagato: r.pagato,
  anticipo: r.anticipo,
  note: r.note ?? undefined,
  creataIl: r.creata_il,
  annullataIl: r.annullata_il ?? undefined,
})

type Scheda = {
  certificato_scade: string | null
  certificato_file: string | null
  documento_in_segreteria?: boolean
  pagamento: StatoPagamento
  pagato_fino: string | null
  pagamento_nota: string | null
}

/**
 * I certificati medici di prima della carta: un contenitore privato, che apre
 * solo la segreteria (`07-certificati-pagamenti.sql`), per stamparli e
 * cancellarli. Di nuovi non se ne caricano.
 */
const CERTIFICATI = 'certificati'
const NUCLEO_SOLO_PROVA = 'Il nucleo familiare c’è solo in prova, per ora: il database non lo tiene ancora'
const DURATA_LINK = 600

const nome = (p: { nome: string; cognome: string } | null | undefined) => (p ? `${p.nome} ${p.cognome}`.trim() : '')

/** Le tabelle che arrivano dopo lo schema, col file che le crea. */
const TABELLE_DOPO: Array<[RegExp, string]> = [
  [/segnalazioni/, 'Le segnalazioni non sono ancora attive sul database: va lanciato 25-segnalazioni.sql'],
  [/schede_iscritti/, 'Certificati e pagamenti non sono ancora attivi sul database: va lanciato 07-certificati-pagamenti.sql'],
  [/musica_sale/, 'La musica delle sale non è ancora attiva sul database: va lanciato 09-musica.sql'],
  [/allenamenti/, 'Lo storico dei timer non è ancora attivo sul database: va lanciato 08-timer.sql'],
  [/ricevute|emetti_ricevuta/, 'Le ricevute non sono ancora attive sul database: va lanciato 16-ricevute.sql'],
  [/anagrafiche/, 'Nascita, residenza e genitore degli iscritti non sono ancora attivi sul database: va lanciato 18-anagrafiche.sql'],
  [/lezioni_senza_istruttore|segna_istruttori_lezione/, 'Le lezioni tenute da confermare non sono ancora attive sul database: va lanciato 23-istruttori-dalle-lezioni.sql'],
  [/presenze_istruttori/, 'Le presenze degli istruttori non sono ancora attive sul database: va lanciato 15-presenze-istruttori.sql'],
]

const MANCA_DOPPIO = 'Il ruolo doppio, segreteria e istruttore, non è ancora attivo sul database: va rilanciato 01-schema.sql'

/**
 * Il ruolo come va scritto in `persone`. `anche_istruttore` solo quando c'è in
 * `p`: chi salva lo mette solo se il ruolo doppio c'era o ci sarà (vedi
 * `Personale.tsx`), così un database che non ha ancora la colonna salva lo
 * stesso istruttori e segreteria.
 */
function ruoloDaScrivere(p: RuoloPersonale): { ruolo: 'istruttore' | 'staff'; anche_istruttore?: boolean } {
  if (p.ancheIstruttore === undefined) return { ruolo: p.ruolo }
  return { ruolo: p.ruolo, anche_istruttore: p.ruolo === 'staff' && p.ancheIstruttore }
}

/** `anagrafiche` (18-anagrafiche.sql): i nomi delle colonne e dei campi, nello stesso ordine. */
const ANAGRAFICA: Array<[keyof Anagrafica, string]> = [
  ['natoIl', 'nato_il'],
  ['natoA', 'nato_a'],
  ['codiceFiscale', 'codice_fiscale'],
  ['indirizzo', 'indirizzo'],
  ['cap', 'cap'],
  ['comune', 'comune'],
  ['genitoreNome', 'genitore_nome'],
  ['genitoreCognome', 'genitore_cognome'],
  ['genitoreCodiceFiscale', 'genitore_codice_fiscale'],
  ['genitoreNato', 'genitore_nato'],
]
const CAMPI_ANAGRAFICA = ANAGRAFICA.map(([, c]) => c).join(', ')
type RigaAnagrafica = Record<string, string | null>
const aRigaAnagrafica = (a: Anagrafica) => Object.fromEntries(ANAGRAFICA.flatMap(([k, c]) => (a[k]?.trim() ? [[c, a[k]!.trim()]] : [])))
function daRigaAnagrafica(r: RigaAnagrafica | null): Anagrafica | null {
  if (!r) return null
  return Object.fromEntries(ANAGRAFICA.flatMap(([k, c]) => (r[c] ? [[k, r[c]]] : []))) as Anagrafica
}

/** Un errore del database detto in modo che la segreteria lo capisca. */
function guaio(e: { message?: string; code?: string } | null): Error {
  // La tabella non c'è sul database: il file che la crea non è stato lanciato.
  if (e?.code === 'PGRST200' || e?.code === 'PGRST205' || e?.code === '42P01') {
    const t = TABELLE_DOPO.find(([nome]) => nome.test(e.message ?? ''))
    if (t) return new Error(t[1])
    return new Error(`Manca una tabella sul database: va lanciato il file che la crea (controllo.sql dice quale). ${e.message ?? ''}`.trim())
  }
  if ((e?.code === 'PGRST202' || e?.code === '42883') && /ricevut/.test(e.message ?? ''))
    return new Error('Le ricevute non sono ancora attive sul database: va lanciato 16-ricevute.sql')
  if (e?.code === '42703' && /ricevute/.test(e.message ?? '')) return new Error('Le ricevute non sono ancora attive sul database: va lanciato 16-ricevute.sql')
  // Il listino arriva con 19-listino.sql: 42703 leggendo, PGRST204 scrivendo.
  if ((e?.code === '42703' || e?.code === 'PGRST204') && /listino/.test(e.message ?? ''))
    return new Error('Il listino non si può ancora cambiare sul database: va lanciato 19-listino.sql')
  // Una colonna che non c'è: voce ed esercizi dei tablet arrivano con 13-voce-esercizi.sql.
  if (e?.code === '42703' && /voce|esercizi/.test(e.message ?? ''))
    return new Error('La voce e gli esercizi dei tablet non sono ancora attivi sul database: va lanciato 13-voce-esercizi.sql')
  // La colonna del ruolo doppio, che arriva con 01-schema.sql: 42703 leggendo, PGRST204 scrivendo.
  if ((e?.code === '42703' || e?.code === 'PGRST204') && /anche_istruttore/.test(e.message ?? '')) return new Error(MANCA_DOPPIO)
  // Il kanji arriva con 24-kanji.sql; due persone con lo stesso non si possono avere.
  if ((e?.code === '42703' || e?.code === 'PGRST204') && /kanji/.test(e.message ?? '')) return new Error('Il kanji non è ancora attivo sul database: va lanciato 24-kanji.sql')
  if (e?.code === '23505' && /kanji/.test(e.message ?? '')) return new Error('Questo kanji è già di un’altra persona: scegline un altro')
  if (e?.code === '23505') return new Error('C’è già: due righe uguali non si possono avere (un’email già usata, un corso già iscritto)')
  if (e?.code === '42501') return new Error('Non hai il permesso: serve un accesso da segreteria')
  return new Error(e?.message || 'Il server non risponde')
}

/**
 * Un errore di una funzione di Supabase (`invita`, `backup`) detto per la
 * segreteria: quello che dice la funzione, se ha risposto; altrimenti perché
 * non ha risposto. `di` è come la si chiama: «dell’invito», «del backup».
 */
async function guaioFunzione(e: { name?: string; message?: string; context?: unknown }, di: string, altrimenti: string): Promise<Error> {
  const r = e.context instanceof Response ? e.context : null
  if (r) {
    try {
      const corpo = (await r.clone().json()) as { guaio?: string }
      if (corpo.guaio) return new Error(corpo.guaio)
    } catch {
      // Non è la nostra risposta: sotto si dice il generico.
    }
  }
  if (r?.status === 404) return new Error(`La funzione ${di} non è pubblicata su Supabase: vedi supabase/LEGGIMI.md`)
  if (e.name === 'FunctionsFetchError') return new Error(`La funzione ${di} non risponde: è pubblicata su Supabase? C’è rete?`)
  return new Error(e.message || altrimenti)
}

/** Un errore dello Storage detto per la segreteria. */
function guaioFile(e: { message?: string; statusCode?: string } | null): Error {
  const m = e?.message ?? ''
  if (/row-level security|unauthorized|403/i.test(m + (e?.statusCode ?? ''))) return new Error('Non hai il permesso: serve un accesso da segreteria')
  if (/bucket not found/i.test(m)) return new Error('Il contenitore dei certificati non c’è più: il file non si trova')
  if (/exceeded|too large|413/i.test(m + (e?.statusCode ?? ''))) return new Error('Il file è troppo grande: al massimo 10 MB')
  if (/mime|type/i.test(m)) return new Error('Questo tipo di file non va: serve una foto o un PDF')
  return new Error(m || 'Il file non è partito: riprova')
}

/** Un errore del contenitore della voce detto per la segreteria. */
function guaioVoce(e: unknown): Error {
  const m = e instanceof Error ? e.message : ((e as { message?: string } | null)?.message ?? '')
  if (/bucket not found/i.test(m)) return new Error('Il contenitore della voce non c’è: va lanciato 13-voce-esercizi.sql')
  if (/row-level security|unauthorized|403/i.test(m)) return new Error('Non hai il permesso: serve un accesso da segreteria')
  if (/exceeded|too large|413/i.test(m)) return new Error('La clip è troppo lunga: una frase, non un discorso')
  if (/mime|type/i.test(m)) return new Error('Questo browser registra in un formato che il server non accetta')
  return new Error(m || 'La clip non è partita: riprova')
}

export function creaSegreteriaSupabase(db: SupabaseClient): DatiSegreteria {
  const ok = <T>(r: { data: T; error: { message?: string; code?: string } | null }): T => {
    if (r.error) throw guaio(r.error)
    return r.data
  }

  /** Dove sta il file del certificato di prima della carta, se c'è ancora. */
  const fileCertificato = async (personaId: string) =>
    (ok(await db.from('schede_iscritti').select('certificato_file').eq('persona_id', personaId).maybeSingle()) as { certificato_file: string | null } | null)?.certificato_file ?? null
  /**
   * Cancella il file di prima della carta, se c'è: dopo, nella scheda non
   * deve restare un nome che porta a niente. Lo Storage non dice di no quando
   * la policy non lascia cancellare, torna solo meno file: lo si controlla.
   */
  const cancellaFile = async (personaId: string) => {
    const prima = await fileCertificato(personaId)
    if (!prima) return
    const via = await db.storage.from(CERTIFICATI).remove([prima])
    // Un contenitore già eliminato vuol dire che il file non c'è più.
    if (via.error && /bucket not found/i.test(via.error.message ?? '')) return
    if (via.error) throw guaioFile(via.error)
    if (via.data?.length) return
    // Niente cancellato: o non c'era già più, o non si poteva.
    const [cartella, nome] = prima.split('/')
    const ancora = await db.storage.from(CERTIFICATI).list(cartella)
    if ((ancora.data ?? []).some((f) => f.name === nome)) throw new Error('Il file non si è cancellato: serve un accesso da segreteria')
  }
  const oggi = () => chiaveGiorno(new Date())

  /**
   * Nascita, residenza e genitore: i più recenti fra la richiesta accolta e
   * quelli scritti in segreteria (import o scheda). Senza 18-anagrafiche.sql
   * vale la richiesta; se non c'è nemmeno quella, `tollera` va avanti senza
   * e se no si dice che manca il file.
   */
  const anagrafica = async (personaId: string, tollera = false): Promise<AnagraficaDi | null> => {
    const [rich, an] = await Promise.all([
      db
        .from('richieste_iscrizione')
        .select('nato_il, nato_a, codice_fiscale, indirizzo, cap, comune, genitore_nome, genitore_cognome, genitore_codice_fiscale, gestita_il, creata_il')
        .eq('persona_id', personaId)
        .eq('stato', 'accolta')
        .order('gestita_il', { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle(),
      db.from('anagrafiche').select(`${CAMPI_ANAGRAFICA}, cambiata_il`).eq('persona_id', personaId).maybeSingle(),
    ])
    const r = ok(rich) as (RigaAnagrafica & { gestita_il: string | null; creata_il: string }) | null
    if (an.error && !r && !tollera) ok(an)
    const s = an.error ? null : (an.data as (RigaAnagrafica & { cambiata_il: string }) | null)
    const daRichiesta = r ? { dati: daRigaAnagrafica(r)!, da: 'modulo' as const, quando: r.gestita_il ?? r.creata_il } : null
    const x = s ? daRigaAnagrafica(s) : null
    const daSegreteria = x && Object.keys(x).length ? { dati: x, da: 'segreteria' as const, quando: s!.cambiata_il } : null
    const vince = daRichiesta && daSegreteria ? (daSegreteria.quando >= daRichiesta.quando ? daSegreteria : daRichiesta) : (daSegreteria ?? daRichiesta)
    return vince && { dati: vince.dati, da: vince.da }
  }

  /** Chi insegna ogni corso, per nome, col primo di riferimento davanti. */
  const insegnanti = async (corsi: string[]) => {
    const righe = ok(
      await db.from('corsi_istruttori').select('corso_id, persona_id, persone ( nome, cognome )').in('corso_id', corsi.length ? corsi : ['00000000-0000-0000-0000-000000000000']),
    ) as unknown as Array<{ corso_id: string; persona_id: string; persone: { nome: string; cognome: string } | null }>
    const m = new Map<string, Array<{ id: string; nome: string }>>()
    for (const r of righe) m.set(r.corso_id, [...(m.get(r.corso_id) ?? []), { id: r.persona_id, nome: nome(r.persone) }])
    return m
  }

  const impostazioni = async (): Promise<Impostazioni> => {
    // Con `*`: su un database senza le date dei corsi (`12-calendario-da-se.sql`
    // non rilanciato) le impostazioni si leggono lo stesso.
    const r = ok(await db.from('impostazioni').select('*').maybeSingle()) as {
      mesi_presenze: number; giorni_calendario: number; inizio_corsi?: string | null; fine_corsi?: string | null
    } | null
    return { mesiPresenze: r?.mesi_presenze ?? 24, giorniCalendario: r?.giorni_calendario ?? 60, inizioCorsi: r?.inizio_corsi, fineCorsi: r?.fine_corsi }
  }

  /**
   * Allunga il calendario fino alla fine dei corsi, o per i giorni scelti in
   * IMPOSTAZIONI se la fine non c'è, senza mai accorciarlo. Come
   * `allunga_calendario`, da oggi o dall'inizio dei corsi, e mai più di 400
   * giorni (il limite di `materializza_sessioni`).
   */
  const rigenera = async () => {
    const [pronto, imp] = await Promise.all([db.rpc('calendario_pronto_fino').then(ok) as Promise<string | null>, impostazioni()])
    const piu = (g: string, n: number) => {
      const [a, m, d] = g.split('-').map(Number)
      return chiaveGiorno(new Date(a, m - 1, d + n))
    }
    const da = imp.inizioCorsi && imp.inizioCorsi > oggi() ? imp.inizioCorsi : oggi()
    const meta = imp.fineCorsi ?? piu(da, imp.giorniCalendario)
    if (meta < da) return 0
    const tetto = piu(da, 400)
    const fino = pronto && pronto > meta ? pronto : meta
    return ok(await db.rpc('materializza_sessioni', { da_giorno: da, a_giorno: fino > tetto ? tetto : fino })) as number
  }

  return {
    modo: 'supabase',

    async sale() {
      const righe = ok(await db.from('sale').select('id, nome, capienza').order('nome')) as Array<{ id: string; nome: string; capienza: number | null }>
      return righe.map((r) => ({ id: r.id, nome: r.nome, capienza: r.capienza ?? undefined }))
    },

    async istruttori() {
      // Anche la segreteria che insegna. Con `*` e il filtro qui, non nella
      // richiesta: su un database senza la colonna del ruolo doppio
      // (`01-schema.sql` non rilanciato) l'elenco degli istruttori c'è lo stesso.
      const righe = ok(await db.from('persone').select('*').in('ruolo', ['istruttore', 'staff']).eq('attiva', true).order('nome')) as Array<{
        id: string; nome: string; cognome: string; ruolo: 'istruttore' | 'staff'; anche_istruttore?: boolean
      }>
      return righe.filter((r) => insegna({ ruolo: r.ruolo, ancheIstruttore: r.anche_istruttore })).map((r) => ({ id: r.id, nome: nome(r) }))
    },

    async settimana(da, a) {
      await allungaCalendario(db)
      const fino = new Date(a)
      fino.setHours(23, 59, 59, 999)
      const sessioni = ok(
        await db
          .from('sessioni')
          .select('id, corso_id, ricorrenza_id, inizio, fine, stato, sala_id, istruttore_id, corsi ( nome, colore, capienza, sala_id, istruttore_id ), sale ( nome ), persone ( nome, cognome )')
          .gte('inizio', da.toISOString())
          .lte('inizio', fino.toISOString())
          .order('inizio'),
      ) as unknown as RigaSessione[]
      const corsi = [...new Set(sessioni.map((s) => s.corso_id))]
      const ids = sessioni.map((s) => s.id)
      const vuoto = ['00000000-0000-0000-0000-000000000000']
      const [isc, pres, chi] = await Promise.all([
        db.from('iscrizioni').select('corso_id, persona_id, dal, al, persone ( attiva )').in('corso_id', corsi.length ? corsi : vuoto),
        db.from('presenze').select('sessione_id, stato').in('sessione_id', ids.length ? ids : vuoto),
        insegnanti(corsi),
      ])
      // Chi è disattivato non conta fra gli iscritti, come nell'appello e in prova.
      const iscrizioni = (ok(isc) as unknown as Array<Iscrizione & { persone: { attiva: boolean } | null }>).filter((i) => i.persone?.attiva)
      const presenze = ok(pres) as Array<{ sessione_id: string; stato: StatoPresenza }>
      return sessioni.map((s): LezioneSeg => {
        const g = giornoDi(s.inizio)
        const segni = presenze.filter((p) => p.sessione_id === s.id)
        const sostituto = s.istruttore_id && s.istruttore_id !== s.corsi?.istruttore_id ? s.istruttore_id : undefined
        return {
          id: s.id,
          corsoId: s.corso_id,
          corso: s.corsi?.nome ?? 'Corso',
          colore: s.corsi?.colore ?? undefined,
          salaId: s.sala_id ?? s.corsi?.sala_id ?? undefined,
          sala: s.sale?.nome,
          sostitutoId: sostituto,
          istruttori: sostituto ? nome(s.persone) : (chi.get(s.corso_id) ?? []).map((x) => x.nome).join(', ') || nome(s.persone),
          inizio: s.inizio,
          fine: s.fine,
          stato: s.stato,
          straordinaria: !s.ricorrenza_id,
          iscritti: iscrizioni.filter((i) => i.corso_id === s.corso_id && valeIl(i, g)).length,
          capienza: s.corsi?.capienza ?? undefined,
          presenti: segni.filter((p) => p.stato === 'presente').length,
          segnati: segni.length,
        }
      })
    },

    async aggiornaLezione(sessioneId, cambi) {
      const s = ok(await db.from('sessioni').select('corsi ( sala_id, istruttore_id ), ricorrenze ( sala_id )').eq('id', sessioneId).single()) as unknown as {
        corsi: { sala_id: string | null; istruttore_id: string | null } | null
        ricorrenze: { sala_id: string | null } | null
      }
      const riga: Record<string, unknown> = {}
      if (cambi.stato) riga.stato = cambi.stato
      // «Come da corso» è il valore del corso (la sala, quella del giorno se
      // ne ha una): così la lezione torna a seguirlo.
      if (cambi.sostitutoId !== undefined) riga.istruttore_id = cambi.sostitutoId ?? s.corsi?.istruttore_id ?? null
      if (cambi.salaId !== undefined) riga.sala_id = cambi.salaId ?? s.ricorrenze?.sala_id ?? s.corsi?.sala_id ?? null
      ok(await db.from('sessioni').update(riga).eq('id', sessioneId))
    },

    async straordinaria(corsoId, inizio, durata) {
      const c = ok(await db.from('corsi').select('sala_id, istruttore_id').eq('id', corsoId).single()) as { sala_id: string | null; istruttore_id: string | null }
      ok(
        await db.from('sessioni').insert({
          corso_id: corsoId,
          inizio: inizio.toISOString(),
          fine: new Date(inizio.getTime() + durata * 60_000).toISOString(),
          sala_id: c.sala_id,
          istruttore_id: c.istruttore_id,
        }),
      )
    },

    async togliLezione(sessioneId) {
      const { count } = await db.from('presenze').select('id', { count: 'exact', head: true }).eq('sessione_id', sessioneId)
      if (count) throw new Error('Ha già un appello: si annulla invece di toglierla')
      ok(await db.from('sessioni').delete().eq('id', sessioneId).is('ricorrenza_id', null))
    },

    async prontoFino() {
      return ok(await db.rpc('calendario_pronto_fino')) as string | null
    },

    rigenera,

    async corsi() {
      const righe = ok(
        await db.from('corsi').select('id, nome, colore, capienza, attivo, sala_id, istruttore_id, sale ( nome ), ricorrenze ( id, giorno, ora, durata_min, dal, al, sala_id, sale ( nome ) )').order('nome'),
      ) as unknown as Array<{
        id: string; nome: string; colore: string | null; capienza: number | null; attivo: boolean; sala_id: string | null; istruttore_id: string | null
        sale: { nome: string } | null
        ricorrenze: Array<{ id: string; giorno: number; ora: string; durata_min: number; dal: string; al: string | null; sala_id: string | null; sale: { nome: string } | null }>
      }>
      const chi = await insegnanti(righe.map((r) => r.id))
      const g = oggi()
      return righe.map(
        (r): CorsoSeg => ({
          id: r.id,
          nome: r.nome,
          colore: r.colore ?? undefined,
          salaId: r.sala_id ?? undefined,
          sala: r.sale?.nome,
          istruttori: [...(chi.get(r.id) ?? [])].sort((x, y) => Number(y.id === r.istruttore_id) - Number(x.id === r.istruttore_id)),
          capienza: r.capienza ?? undefined,
          attivo: r.attivo,
          ricorrenze: r.ricorrenze
            .filter((x) => !x.al || x.al >= g)
            .map((x) => ({
              id: x.id,
              giorno: x.giorno,
              ora: x.ora.slice(0, 5),
              durata: x.durata_min,
              dal: x.dal,
              al: x.al ?? undefined,
              salaId: x.sala_id ?? undefined,
              sala: x.sale?.nome,
            }))
            .sort((x, y) => ((x.giorno + 6) % 7) - ((y.giorno + 6) % 7) || x.ora.localeCompare(y.ora)),
        }),
      )
    },

    async salvaCorso(c) {
      if (!c.nome.trim()) throw new Error('Il corso ha bisogno di un nome')
      const riga = {
        nome: c.nome.trim(),
        sala_id: c.salaId ?? null,
        istruttore_id: c.istruttori[0] ?? null,
        capienza: c.capienza ?? null,
        colore: c.colore ?? null,
      }
      const id = c.id
        ? (ok(await db.from('corsi').update(riga).eq('id', c.id)), c.id)
        : (ok(await db.from('corsi').insert(riga).select('id').single()) as { id: string }).id
      // Chi insegna: si tolgono quelli che non ci sono più e si aggiungono i nuovi.
      try {
        const prima = (ok(await db.from('corsi_istruttori').select('persona_id').eq('corso_id', id)) as Array<{ persona_id: string }>).map((r) => r.persona_id)
        const via = prima.filter((p) => !c.istruttori.includes(p))
        const nuovi = c.istruttori.filter((p) => !prima.includes(p))
        if (via.length) ok(await db.from('corsi_istruttori').delete().eq('corso_id', id).in('persona_id', via))
        if (nuovi.length) ok(await db.from('corsi_istruttori').insert(nuovi.map((persona_id) => ({ corso_id: id, persona_id }))))
      } catch (e) {
        // Il corso nuovo c'è già: chi chiama lo deve sapere, per non crearne un altro.
        if (!c.id) throw Object.assign(new Error(`Corso creato, ma gli istruttori non sono stati salvati: ${e instanceof Error ? e.message : e}`), { id })
        throw e
      }
      return id
    },

    async archiviaCorso(corsoId, attivo) {
      ok(await db.from('corsi').update({ attivo }).eq('id', corsoId))
      if (attivo) await rigenera()
    },

    async aggiungiRicorrenza(corsoId, r, opzioni) {
      ok(await db.from('ricorrenze').insert({ corso_id: corsoId, giorno: r.giorno, ora: r.ora, durata_min: r.durata, dal: oggi(), sala_id: r.salaId ?? null }))
      if (opzioni?.rigenera !== false) await rigenera()
    },

    async salaRicorrenza(ricorrenzaId, salaId) {
      // Le lezioni future le sposta il trigger di 05-segreteria.sql.
      ok(await db.from('ricorrenze').update({ sala_id: salaId }).eq('id', ricorrenzaId))
    },

    async togliRicorrenza(ricorrenzaId) {
      ok(await db.rpc('chiudi_ricorrenza', { ricorrenza: ricorrenzaId }))
    },

    async persone() {
      const campi = 'id, nome, cognome, email, telefono, attiva, creata_il, iscrizioni ( corso_id, dal, al )'
      const scheda = 'certificato_scade, certificato_file, pagamento, pagato_fino, pagamento_nota'
      const leggi = (schede: string | null) =>
        db
          .from('persone')
          .select(schede ? `${campi}, schede_iscritti!persona_id ( ${schede} )` : campi)
          .eq('ruolo', 'iscritto')
          .order('cognome')
      // «!persona_id»: schede_iscritti punta a persone due volte (persona_id e cambiata_da), va detto quale.
      let r0 = await leggi(`${scheda}, documento_in_segreteria`)
      // 07-certificati-pagamenti.sql di prima del documento su carta: senza la colonna nuova.
      if (r0.error?.code === '42703') r0 = await leggi(scheda)
      // Un database dove 07-certificati-pagamenti.sql non è ancora passato: l'elenco si vede lo stesso.
      if (r0.error?.code === 'PGRST200') r0 = await leggi(null)
      const righe = ok(r0) as unknown as Array<{
        id: string; nome: string; cognome: string; email: string | null; telefono: string | null; attiva: boolean; creata_il: string
        iscrizioni: Array<{ corso_id: string; dal: string; al: string | null }>
        schede_iscritti?: Scheda | Scheda[] | null
      }>
      return righe.map((r): PersonaSeg => {
        // Una a una con la persona: PostgREST la dà come oggetto, ma meglio non contarci.
        const s = Array.isArray(r.schede_iscritti) ? r.schede_iscritti[0] : r.schede_iscritti
        return {
          id: r.id,
          nome: r.nome,
          cognome: r.cognome,
          email: r.email ?? undefined,
          telefono: r.telefono ?? undefined,
          attiva: r.attiva,
          creataIl: r.creata_il.slice(0, 10),
          iscrizioni: r.iscrizioni.map((i) => ({ corsoId: i.corso_id, dal: i.dal, al: i.al ?? undefined })),
          certificato: { scade: s?.certificato_scade ?? undefined, conFile: !!s?.certificato_file },
          documento: !!s?.documento_in_segreteria,
          pagamento: { stato: s?.pagamento ?? 'da_pagare', fino: s?.pagato_fino ?? undefined, nota: s?.pagamento_nota ?? undefined },
        }
      })
    },

    async frequenze() {
      const righe = ok(await db.rpc('frequenze', { giorni: 30 })) as Array<{ persona_id: string; presenti: number; dovute: number }>
      return new Map(righe.map((r) => [r.persona_id, { presenti: r.presenti, dovute: r.dovute }]))
    },

    async storico(personaId, quante) {
      const isc = ok(await db.from('iscrizioni').select('corso_id, persona_id, dal, al').eq('persona_id', personaId)) as Iscrizione[]
      if (!isc.length) return []
      const sessioni = ok(
        await db
          .from('sessioni')
          .select('id, corso_id, inizio, corsi ( nome )')
          .in('corso_id', isc.map((i) => i.corso_id))
          .neq('stato', 'annullata')
          .lt('inizio', new Date().toISOString())
          .order('inizio', { ascending: false })
          .limit(quante * 4),
      ) as unknown as Array<{ id: string; corso_id: string; inizio: string; corsi: { nome: string } | null }>
      const sue = sessioni.filter((s) => isc.some((i) => i.corso_id === s.corso_id && valeIl(i, giornoDi(s.inizio)))).slice(0, quante)
      const pres = ok(
        await db.from('presenze').select('sessione_id, stato').eq('persona_id', personaId).in('sessione_id', sue.length ? sue.map((s) => s.id) : ['00000000-0000-0000-0000-000000000000']),
      ) as Array<{ sessione_id: string; stato: StatoPresenza }>
      return sue
        .map((s): StoricoSeg => ({ sessioneId: s.id, inizio: s.inizio, corso: s.corsi?.nome ?? '', stato: pres.find((p) => p.sessione_id === s.id)?.stato ?? null }))
        .reverse()
    },

    async salvaPersona(p) {
      if (!p.nome.trim() || !p.cognome.trim()) throw new Error('Servono nome e cognome')
      const riga = { nome: nomeProprio(p.nome), cognome: nomeProprio(p.cognome), email: p.email?.trim() || null, telefono: p.telefono?.trim() || null }
      if (p.id) {
        ok(await db.from('persone').update(riga).eq('id', p.id))
        return p.id
      }
      return (ok(await db.from('persone').insert({ ...riga, ruolo: 'iscritto' }).select('id').single()) as { id: string }).id
    },

    // Il nucleo familiare c'è solo in prova, per ora (vedi `nucleo.ts`).
    async mettiNelNucleo() {
      throw new Error(NUCLEO_SOLO_PROVA)
    },
    async togliDalNucleo() {
      throw new Error(NUCLEO_SOLO_PROVA)
    },
    async rendiTitolare() {
      throw new Error(NUCLEO_SOLO_PROVA)
    },

    async attivaPersona(personaId, attiva) {
      ok(await db.from('persone').update({ attiva }).eq('id', personaId))
    },

    async iscrivi(personaId, corsoId) {
      const g = oggi()
      const c = ok(await db.from('iscrizioni').select('dal, al').eq('persona_id', personaId).eq('corso_id', corsoId).maybeSingle()) as {
        dal: string; al: string | null
      } | null
      if (c && !c.al) return
      // Terminata oggi o più avanti: l'iscrizione non era ancora finita, si
      // toglie solo la fine (è il TERMINA premuto per sbaglio).
      if (c && c.al && c.al >= g) {
        ok(await db.from('iscrizioni').update({ al: null }).eq('persona_id', personaId).eq('corso_id', corsoId))
        return
      }
      // Una riga per persona e corso: chi torna riparte da oggi.
      ok(await db.from('iscrizioni').upsert({ persona_id: personaId, corso_id: corsoId, dal: g, al: null }, { onConflict: 'corso_id,persona_id' }))
    },

    async termina(personaId, corsoId) {
      ok(await db.from('iscrizioni').update({ al: oggi() }).eq('persona_id', personaId).eq('corso_id', corsoId))
    },

    async salvaCertificato(personaId, scade) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(scade)) throw new Error('Serve la data di scadenza del certificato')
      ok(await db.from('schede_iscritti').upsert({ persona_id: personaId, certificato_scade: scade }, { onConflict: 'persona_id' }))
    },

    async togliCertificato(personaId) {
      await cancellaFile(personaId)
      ok(await db.from('schede_iscritti').update({ certificato_scade: null, certificato_file: null }).eq('persona_id', personaId))
    },

    async cancellaFileCertificato(personaId) {
      await cancellaFile(personaId)
      ok(await db.from('schede_iscritti').update({ certificato_file: null }).eq('persona_id', personaId))
    },

    async salvaDocumento(personaId, inSegreteria) {
      const r = await db.from('schede_iscritti').upsert({ persona_id: personaId, documento_in_segreteria: inSegreteria }, { onConflict: 'persona_id' })
      if (r.error?.code === 'PGRST204' || r.error?.code === '42703')
        throw new Error('Il documento su carta non è ancora attivo sul database: va rilanciato 07-certificati-pagamenti.sql')
      ok(r)
    },

    async apriCertificato(personaId) {
      const nome = await fileCertificato(personaId)
      if (!nome) return null
      const { data, error } = await db.storage.from(CERTIFICATI).createSignedUrl(nome, DURATA_LINK)
      if (error) throw guaioFile(error)
      return { url: data.signedUrl, pdf: nome.endsWith('.pdf') }
    },

    async salvaPagamento(personaId, p) {
      const nota = p.nota?.trim() || null
      if (nota && nota.length > 300) throw new Error('La nota del pagamento è troppo lunga: al massimo 300 caratteri')
      ok(
        await db
          .from('schede_iscritti')
          .upsert({ persona_id: personaId, pagamento: p.stato, pagato_fino: p.fino || null, pagamento_nota: nota }, { onConflict: 'persona_id' }),
      )
    },
    async ricevute(personaId) {
      let q = db.from('ricevute').select(CAMPI_RICEVUTA)
      if (personaId) q = q.eq('persona_id', personaId)
      const righe = ok(await q.order('data', { ascending: false }).order('anno', { ascending: false }).order('numero', { ascending: false }).limit(500)) as unknown as RigaRicevuta[]
      return righe.map(ricevuta)
    },

    async prossimoNumero(anno) {
      const r = ok(await db.from('ricevute').select('numero').eq('anno', anno).order('numero', { ascending: false }).limit(1).maybeSingle()) as { numero: number } | null
      return (r?.numero ?? 0) + 1
    },

    async intestatarioDi(personaId) {
      const [p, ultima] = await Promise.all([
        db.from('persone').select('nome, cognome').eq('id', personaId).single(),
        db.from('ricevute').select('intestatario').eq('persona_id', personaId).order('creata_il', { ascending: false }).limit(1).maybeSingle(),
      ])
      const chi = ok(p) as { nome: string; cognome: string }
      // Senza 16-ricevute.sql la ricevuta di prima non c'è: si va avanti con la richiesta.
      const u = ultima.error ? null : (ultima.data as { intestatario: IntestatarioRicevuta } | null)
      if (u) return { ...u.intestatario, nome: chi.nome, cognome: chi.cognome }
      const x = await anagrafica(personaId, true)
      return x ? intestatarioDaRichiesta({ ...x.dati, nome: chi.nome, cognome: chi.cognome }) : { nome: chi.nome, cognome: chi.cognome }
    },

    anagraficaDi: (personaId) => anagrafica(personaId),

    async salvaAnagrafica(personaId, a, sostituisci) {
      const x = pulisciAnagrafica(a)
      const no = cosaNonVaAnagrafica(x)
      if (no) throw new Error(no)
      // Le colonne che non ci sono nell'upsert restano com'erano; per sostituire, le vuote vanno a null.
      const riga = sostituisci ? Object.fromEntries(ANAGRAFICA.map(([k, c]) => [c, x[k] ?? null])) : aRigaAnagrafica(x)
      if (Object.keys(riga).length === 0) return
      ok(await db.from('anagrafiche').upsert({ persona_id: personaId, ...riga }, { onConflict: 'persona_id' }))
    },

    async emettiRicevuta(r) {
      const dati = { ...r, intestatario: pulisciIntestatario(r.intestatario) }
      const no = cosaNonVa(dati)
      if (no) throw new Error(no)
      const riga = ok(
        await db.rpc('emetti_ricevuta', {
          dati: {
            data: dati.data,
            persona_id: dati.personaId ?? null,
            numero: dati.numero ?? null,
            ente: dati.ente,
            intestatario: dati.intestatario,
            voci: dati.voci,
            anticipo: dati.anticipo,
            note: dati.note?.trim() || null,
          },
        }),
      ) as RigaRicevuta
      return ricevuta(riga)
    },

    async annullaRicevuta(id) {
      ok(await db.rpc('annulla_ricevuta', { ricevuta: id }))
    },

    async enteRicevute() {
      const r = await db.from('impostazioni').select('ricevute').maybeSingle()
      // Senza 16-ricevute.sql la colonna non c'è: valgono quelli scritti nell'app.
      if (r.error?.code === '42703') return ENTE_PREDEFINITO
      return { ...ENTE_PREDEFINITO, ...((ok(r) as { ricevute: Partial<EnteRicevuta> } | null)?.ricevute ?? {}) }
    },

    async salvaEnteRicevute(e) {
      ok(await db.from('impostazioni').update({ ricevute: e }).eq('id', true))
    },

    async listino() {
      const r = await db.from('impostazioni').select('listino').maybeSingle()
      // Senza 19-listino.sql la colonna non c'è: vale quello del foglio.
      if (r.error?.code === '42703') return { listino: LISTINO_PREDEFINITO, cambiato: false }
      const l = listinoDa((ok(r) as { listino: unknown } | null)?.listino)
      return l ? { listino: l, cambiato: true } : { listino: LISTINO_PREDEFINITO, cambiato: false }
    },

    async salvaListino(l) {
      const g = l && cosaNonVaListino(l)
      if (g) throw new Error(g)
      ok(await db.from('impostazioni').update({ listino: l }).eq('id', true))
      scordaListino()
    },

    async registro(da, a) {
      const fino = new Date(a)
      fino.setHours(23, 59, 59, 999)
      const adesso = new Date()
      const sessioni = ok(
        await db
          .from('sessioni')
          .select('id, corso_id, inizio, stato, istruttore_id, corsi ( nome, istruttore_id ), sale ( nome ), persone ( nome, cognome )')
          .gte('inizio', da.toISOString())
          .lte('inizio', (fino < adesso ? fino : adesso).toISOString())
          .order('inizio'),
      ) as unknown as Array<{
        id: string; corso_id: string; inizio: string; stato: RigaRegistro['stato']; istruttore_id: string | null
        corsi: { nome: string; istruttore_id: string | null } | null; sale: { nome: string } | null; persone: { nome: string; cognome: string } | null
      }>
      const corsi = [...new Set(sessioni.map((x) => x.corso_id))]
      const vuoto = ['00000000-0000-0000-0000-000000000000']
      const [isc, pres, chi] = await Promise.all([
        db.from('iscrizioni').select('corso_id, persona_id, dal, al, persone ( nome, cognome, attiva )').in('corso_id', corsi.length ? corsi : vuoto),
        db.from('presenze').select('sessione_id, persona_id, stato').in('sessione_id', sessioni.length ? sessioni.map((x) => x.id) : vuoto),
        insegnanti(corsi),
      ])
      const iscrizioni = ok(isc) as unknown as Array<Iscrizione & { persone: { nome: string; cognome: string; attiva: boolean } | null }>
      const presenze = ok(pres) as Array<{ sessione_id: string; persona_id: string; stato: StatoPresenza }>
      return sessioni.map((x): RigaRegistro => {
        const g = giornoDi(x.inizio)
        const segni = new Map(presenze.filter((p) => p.sessione_id === x.id).map((p) => [p.persona_id, p.stato]))
        const sostituto = x.istruttore_id && x.istruttore_id !== x.corsi?.istruttore_id
        return {
          sessioneId: x.id,
          corsoId: x.corso_id,
          corso: x.corsi?.nome ?? 'Corso',
          sala: x.sale?.nome,
          istruttori: sostituto ? nome(x.persone) : (chi.get(x.corso_id) ?? []).map((i) => i.nome).join(', ') || nome(x.persone),
          inizio: x.inizio,
          stato: x.stato,
          appello: iscrizioni
            .filter((i) => i.corso_id === x.corso_id && i.persone?.attiva && valeIl(i, g))
            .map((i) => ({ personaId: i.persona_id, nome: i.persone!.nome, cognome: i.persone!.cognome, stato: segni.get(i.persona_id) ?? null })),
        }
      })
    },

    async prove(da, a) {
      const fino = new Date(a)
      fino.setHours(23, 59, 59, 999)
      const r = await db
        .from('prove')
        // Due legami con `persone`, chi prova e chi l'ha aggiunta: si dice quale.
        .select(
          'sessione_id, persona_id, chi:persone!prove_persona_id_fkey ( nome, cognome, telefono ), da:persone!prove_aggiunta_da_fkey ( nome ), sessioni!inner ( inizio, corso_id, corsi ( nome ) )',
        )
        .gte('sessioni.inizio', da.toISOString())
        .lte('sessioni.inizio', fino.toISOString())
      if (r.error && (r.error.code === '42P01' || r.error.code === 'PGRST205' || r.error.code === 'PGRST200')) {
        throw new Error('Le prove non sono ancora attive: va lanciato supabase/21-prove.sql.')
      }
      const righe = ok(r) as unknown as Array<{
        sessione_id: string; persona_id: string
        chi: { nome: string; cognome: string; telefono: string | null } | null
        da: { nome: string } | null
        sessioni: { inizio: string; corso_id: string; corsi: { nome: string } | null } | null
      }>
      const ids = [...new Set(righe.map((x) => x.persona_id))]
      const isc = ok(
        await db.from('iscrizioni').select('persona_id, dal, al').in('persona_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']),
      ) as Array<Pick<Iscrizione, 'persona_id' | 'dal' | 'al'>>
      const g = oggi()
      const iscritti = new Set(isc.filter((i) => valeIl(i, g)).map((i) => i.persona_id))
      return righe
        .filter((x) => x.chi && x.sessioni)
        .map((x): ProvaSeg => ({
          sessioneId: x.sessione_id,
          personaId: x.persona_id,
          nome: x.chi!.nome,
          cognome: x.chi!.cognome,
          telefono: x.chi!.telefono ?? undefined,
          corsoId: x.sessioni!.corso_id,
          corso: x.sessioni!.corsi?.nome ?? 'Corso',
          inizio: x.sessioni!.inizio,
          da: x.da?.nome,
          iscritto: iscritti.has(x.persona_id),
        }))
        .sort((p, q) => q.inizio.localeCompare(p.inizio))
    },

    async statistiche(da, a) {
      const fino = new Date(a)
      fino.setHours(23, 59, 59, 999)
      const r = await db.rpc('statistiche', { da: da.toISOString(), a: fino.toISOString() })
      if (r.error && (r.error.code === 'PGRST202' || r.error.code === '42883')) {
        throw new Error('Le statistiche non sono ancora attive: va lanciato supabase/22-statistiche.sql.')
      }
      const x = ok(r) as {
        lezioni: Array<{
          id: string; corso_id: string; corso: string; colore: string | null; capienza: number | null; sala: string | null; inizio: string
          stato: StatoSessione; istruttori: string[]; sostituto: boolean
          iscritti: number; presenti: number; assenti: number; giustificati: number; prove: number
        }>
        incassi: Statistiche['incassi']
      }
      return {
        lezioni: x.lezioni.map((l) => ({
          sessioneId: l.id,
          corsoId: l.corso_id,
          corso: l.corso,
          colore: l.colore ?? undefined,
          capienza: l.capienza ?? undefined,
          sala: l.sala ?? undefined,
          inizio: l.inizio,
          stato: l.stato,
          istruttori: l.istruttori,
          sostituto: l.sostituto,
          iscritti: l.iscritti,
          presenti: l.presenti,
          assenti: l.assenti,
          giustificati: l.giustificati,
          prove: l.prove,
        })),
        incassi: x.incassi,
      }
    },

    async personale() {
      const [righe, legami, pin] = await Promise.all([
        // `*` e non l'elenco delle colonne: `anche_istruttore` può non esserci ancora (vedi `istruttori`).
        db.from('persone').select('*').in('ruolo', ['istruttore', 'staff']).order('nome'),
        db.from('corsi_istruttori').select('persona_id, corsi ( nome, attivo )'),
        db.rpc('pin_impostati'),
      ])
      const persone = ok(righe) as Array<{
        id: string; nome: string; cognome: string; email: string | null; ruolo: 'istruttore' | 'staff'; anche_istruttore?: boolean; attiva: boolean; utente_id: string | null
        kanji?: string | null
      }>
      const corsi = ok(legami) as unknown as Array<{ persona_id: string; corsi: { nome: string; attivo: boolean } | null }>
      const conPin = new Set((ok(pin) as Array<{ persona_id: string }>).map((r) => r.persona_id))
      return persone.map(
        (p): PersonaleSeg => ({
          id: p.id,
          nome: p.nome,
          cognome: p.cognome,
          email: p.email ?? undefined,
          ruolo: p.ruolo,
          ancheIstruttore: p.ruolo === 'staff' && !!p.anche_istruttore,
          attiva: p.attiva,
          collegato: !!p.utente_id,
          haPin: conPin.has(p.id),
          corsi: corsi.filter((c) => c.persona_id === p.id && c.corsi?.attivo).map((c) => c.corsi!.nome),
          kanji: p.kanji ?? undefined,
        }),
      )
    },

    async salvaPersonale(p) {
      if (!p.nome.trim()) throw new Error('Serve almeno il nome')
      const email = p.email?.trim() || null
      const ruolo = ruoloDaScrivere(p)
      const riga = { nome: nomeProprio(p.nome), cognome: nomeProprio(p.cognome) || '—', email, ...ruolo }
      if (p.id) {
        ok(await db.from('persone').update(riga).eq('id', p.id))
        return p.id
      }
      // Un'iscritta con la stessa email diventa personale, invece di un doppione.
      if (email) {
        const c = ok(await db.from('persone').select('id, ruolo').eq('email', email).maybeSingle()) as { id: string; ruolo: string } | null
        if (c && c.ruolo !== 'iscritto') throw new Error('Questa email è già di un istruttore o della segreteria')
        if (c) {
          ok(await db.from('persone').update({ ...ruolo, attiva: true }).eq('id', c.id))
          return c.id
        }
      }
      // Già in elenco senza email (dall'import, per esempio): gliela si dà, invece di rifarla.
      const senza = ok(
        await db.from('persone').select('id').in('ruolo', ['istruttore', 'staff']).is('email', null).ilike('nome', riga.nome).ilike('cognome', riga.cognome).limit(1),
      ) as Array<{ id: string }>
      if (senza[0]) {
        ok(await db.from('persone').update({ email, ...ruolo, attiva: true }).eq('id', senza[0].id))
        return senza[0].id
      }
      return (ok(await db.from('persone').insert(riga).select('id').single()) as { id: string }).id
    },

    async impostaPin(personaId, pin) {
      ok(await db.rpc('imposta_pin', { persona: personaId, pin }))
    },

    async salvaKanji(personaId, kanji) {
      const segno = kanji === null ? null : kanjiScritto(kanji)
      if (kanji !== null && !segno) throw new Error('Il kanji è un segno solo')
      ok(await db.from('persone').update({ kanji: segno }).eq('id', personaId))
    },

    async invita(personaId) {
      // Il link porta a questa pagina, senza frammento: lì Supabase attacca
      // il suo (`#access_token=…`), e `invito.ts` lo riconosce.
      const ritorno = indirizzoDiRitorno()
      const { data, error } = await db.functions.invoke('invita', { body: { persona: personaId, ritorno } })
      if (error) throw await guaioFunzione(error, 'dell’invito', 'L’invito non è partito')
      return (data as { come: 'invito' | 'password' }).come
    },

    async salvaSala(sala) {
      if (!sala.nome.trim()) throw new Error('La sala ha bisogno di un nome')
      const riga = { nome: sala.nome.trim(), capienza: sala.capienza ?? null }
      if (sala.id) {
        ok(await db.from('sale').update(riga).eq('id', sala.id))
        return sala.id
      }
      return (ok(await db.from('sale').insert(riga).select('id').single()) as { id: string }).id
    },

    async listeMusica() {
      const righe = ok(await db.from('musica_sale').select('id, nome, link, sala_id').order('ordine').order('nome')) as Array<{
        id: string; nome: string; link: string; sala_id: string | null
      }>
      return righe.map((r) => ({ id: r.id, nome: r.nome, link: r.link, salaId: r.sala_id }))
    },

    async salvaListaMusica(l) {
      const nome = l.nome.trim().slice(0, MAX_NOME_LISTA)
      const link = l.link.trim()
      if (!nome) throw new Error('La lista ha bisogno di un nome')
      if (!fonteDelLink(link)) throw new Error('Il link non è una playlist di YouTube o di Spotify')
      const riga = { nome, link, sala_id: l.salaId }
      if (l.id) {
        ok(await db.from('musica_sale').update(riga).eq('id', l.id))
        return l.id
      }
      return (ok(await db.from('musica_sale').insert(riga).select('id').single()) as { id: string }).id
    },

    async togliListaMusica(id) {
      ok(await db.from('musica_sale').delete().eq('id', id))
    },

    async voceSale() {
      const r = ok(await db.from('impostazioni').select('voce').maybeSingle()) as { voce: unknown } | null
      return voceDellaSala(r?.voce)
    },

    async salvaVoceSale(nome) {
      ok(await db.from('impostazioni').update({ voce: voceDellaSala(nome) }).eq('id', true))
    },

    async clipSale() {
      try {
        return await chiaviSulServer(db)
      } catch (e) {
        throw guaioVoce(e)
      }
    },

    async salvaClip(chiave, clip) {
      if (!chiaveValida(chiave)) throw new Error('Questa frase non si può incidere')
      const { error } = await db.storage.from(CONTENITORE_VOCE).upload(chiave, clip, { contentType: clip.type.split(';')[0] || 'audio/webm', upsert: true, cacheControl: '60' })
      if (error) throw guaioVoce(error)
    },

    apriClip: (chiave) => scaricaClip(db, chiave),

    async togliClip(chiave) {
      const { error } = await db.storage.from(CONTENITORE_VOCE).remove([chiave])
      if (error) throw guaioVoce(error)
    },

    async eserciziPalestra() {
      const r = ok(await db.from('impostazioni').select('esercizi').maybeSingle()) as { esercizi: unknown } | null
      return eserciziDellaPalestra(r?.esercizi)
    },

    async salvaEserciziPalestra(l) {
      const lista = eserciziDellaPalestra(l) ?? []
      ok(await db.from('impostazioni').update({ esercizi: lista.map(({ id, nome, categoria }) => ({ id, nome, categoria })) }).eq('id', true))
    },

    async presenzeIstruttori(giorni) {
      const da = new Date(Date.now() - giorni * 24 * 60 * 60_000).toISOString()
      const righe = ok(
        await db
          .from('presenze_istruttori')
          .select(
            // Con `*`: `come` c'è solo dopo 23-istruttori-dalle-lezioni.sql, e senza si legge lo stesso.
            '*, ' +
              'sessioni ( corso_id, inizio, fine, istruttore_id, corsi ( nome, colore, istruttore_id ), persone ( nome, cognome ) ), ' +
              'persona:persone!persona_id ( nome, cognome ), gestore:persone!gestita_da ( nome, cognome ), postazioni ( sale ( nome ) )',
          )
          .or(`stato.eq.da_confermare,entrato_il.gte.${da}`)
          .order('entrato_il', { ascending: false }),
      ) as unknown as Array<{
        id: string
        sessione_id: string
        persona_id: string
        stato: StatoPresenzaIstruttore
        prevista: boolean
        entrato_il: string
        gestita_il: string | null
        come?: ComePresenzaIstruttore
        sessioni: {
          corso_id: string
          inizio: string
          fine: string
          istruttore_id: string | null
          corsi: { nome: string; colore: string | null; istruttore_id: string | null } | null
          persone: { nome: string; cognome: string } | null
        } | null
        persona: { nome: string; cognome: string } | null
        gestore: { nome: string; cognome: string } | null
        postazioni: { sale: { nome: string } | null } | null
      }>
      const chi = await insegnanti([...new Set(righe.flatMap((r) => (r.sessioni ? [r.sessioni.corso_id] : [])))])
      return righe.flatMap((r): PresenzaIstruttoreSeg[] => {
        const s = r.sessioni
        if (!s) return []
        // Chi doveva farla, come nella settimana: il sostituto, o chi insegna il corso.
        const sostituto = s.istruttore_id && s.istruttore_id !== s.corsi?.istruttore_id
        return [
          {
            id: r.id,
            sessioneId: r.sessione_id,
            corso: s.corsi?.nome ?? 'Corso',
            colore: s.corsi?.colore ?? undefined,
            inizio: s.inizio,
            fine: s.fine,
            personaId: r.persona_id,
            nome: nome(r.persona) || '—',
            previsti: sostituto ? nome(s.persone) : (chi.get(s.corso_id) ?? []).map((x) => x.nome).join(', ') || nome(s.persone),
            sala: r.postazioni?.sale?.nome,
            stato: r.stato,
            prevista: r.prevista,
            entratoIl: r.entrato_il,
            gestitaIl: r.gestita_il ?? undefined,
            gestitaDa: r.gestore ? nome(r.gestore) : undefined,
            come: r.come ?? 'pin',
          },
        ]
      })
    },

    async segnalazioni() {
      const io = (await db.auth.getSession()).data.session?.user.id
      const righe = ok(
        await db.from('segnalazioni').select('id, padre_id, titolo, testo, scritta_il, chiusa_il, autore:persone!autore_id ( nome, cognome, utente_id )').order('scritta_il'),
      ) as unknown as Array<{
        id: string
        padre_id: string | null
        titolo: string | null
        testo: string
        scritta_il: string
        chiusa_il: string | null
        autore: { nome: string; cognome: string; utente_id: string | null } | null
      }>
      const fili = new Map<string, Segnalazione>()
      for (const r of righe) {
        const m = { id: r.id, autore: nome(r.autore) || '—', mio: !!io && r.autore?.utente_id === io, testo: r.testo, il: r.scritta_il }
        if (!r.padre_id) fili.set(r.id, { id: r.id, titolo: r.titolo ?? '', messaggi: [m], chiusaIl: r.chiusa_il ?? undefined })
        else fili.get(r.padre_id)?.messaggi.push(m)
      }
      return [...fili.values()]
    },

    async apriSegnalazione(titolo, testo) {
      const no = cosaNonVaSegnalazione(testo, titolo)
      if (no) throw new Error(no)
      ok(await db.from('segnalazioni').insert({ titolo: titolo.trim(), testo: testo.trim() }))
    },

    async rispondiSegnalazione(id, testo) {
      const no = cosaNonVaSegnalazione(testo)
      if (no) throw new Error(no)
      ok(await db.from('segnalazioni').insert({ padre_id: id, testo: testo.trim() }))
    },

    async chiudiSegnalazione(id, chiusa) {
      ok(await db.from('segnalazioni').update({ chiusa_il: chiusa ? new Date().toISOString() : null }).eq('id', id))
    },

    async gestisciPresenzaIstruttore(id, conferma) {
      ok(await db.rpc('gestisci_presenza_istruttore', { presenza: id, conferma }))
    },

    async lezioniSenzaIstruttore() {
      const righe = ok(await db.rpc('lezioni_senza_istruttore')) as Array<{
        sessione_id: string
        corso: string
        colore: string | null
        inizio: string
        fine: string
        sala: string | null
        presenti: number
        previsti: Array<{ id: string; nome: string; cognome: string; stato: StatoPresenzaIstruttore | null }> | null
      }>
      return righe.map((r) => ({
        sessioneId: r.sessione_id,
        corso: r.corso,
        colore: r.colore ?? undefined,
        inizio: r.inizio,
        fine: r.fine,
        sala: r.sala ?? undefined,
        presenti: r.presenti,
        previsti: (r.previsti ?? []).map((x) => ({ id: x.id, nome: nome(x), stato: x.stato ?? undefined })),
      }))
    },

    async segnaIstruttoriLezione(sessioneId, presenti) {
      ok(await db.rpc('segna_istruttori_lezione', { sessione: sessioneId, presenti }))
    },

    async allenamenti(quanti) {
      const righe = ok(
        await db
          .from('allenamenti')
          .select('id, nome, finito_il, secondi, completato, sessioni ( corsi ( nome ) ), persone ( nome, cognome ), postazioni ( nome, sale ( nome ) )')
          .order('finito_il', { ascending: false })
          .limit(quanti),
      ) as unknown as Array<{
        id: string
        nome: string
        finito_il: string
        secondi: number
        completato: boolean
        sessioni: { corsi: { nome: string } | null } | null
        persone: { nome: string; cognome: string } | null
        postazioni: { nome: string; sale: { nome: string } | null } | null
      }>
      return righe.map((r): AllenamentoSeg => ({
        id: r.id,
        nome: r.nome,
        finitoIl: r.finito_il,
        secondi: r.secondi,
        completato: r.completato,
        corso: r.sessioni?.corsi?.nome,
        chi: r.persone ? nome(r.persone) : r.postazioni ? `Tablet ${r.postazioni.sale?.nome ?? r.postazioni.nome}` : '—',
      }))
    },

    impostazioni,

    async salvaImpostazioni(i) {
      const riga: Record<string, number | string | null> = {}
      if (i.mesiPresenze !== undefined) riga.mesi_presenze = i.mesiPresenze
      if (i.giorniCalendario !== undefined) riga.giorni_calendario = i.giorniCalendario
      if (i.inizioCorsi !== undefined) riga.inizio_corsi = i.inizioCorsi
      if (i.fineCorsi !== undefined) riga.fine_corsi = i.fineCorsi
      ok(await db.from('impostazioni').update(riga).eq('id', true))
    },

    async scadute() {
      const { count, error } = await db.from('presenze_scadute').select('id', { count: 'exact', head: true })
      if (error) throw guaio(error)
      return count ?? 0
    },

    async pulisci() {
      return ok(await db.rpc('pulisci_presenze')) as number
    },

    async esporta(personaId) {
      const [persona, isc, pres, rich, scheda, ric, anag] = await Promise.all([
        db.from('persone').select('nome, cognome, email, telefono, ruolo, attiva, creata_il').eq('id', personaId).single(),
        db.from('iscrizioni').select('dal, al, corsi ( nome )').eq('persona_id', personaId),
        db.from('presenze').select('stato, origine, segnata_il, sessioni ( inizio, corsi ( nome ) )').eq('persona_id', personaId),
        // Le richieste dal modulo di iscrizione: i file restano nello Storage, qui c'è quali sono.
        db.from('richieste_iscrizione').select('creata_il, stato, nome, cognome, nato_il, nato_a, codice_fiscale, indirizzo, cap, comune, email, telefono, genitore_nome, genitore_cognome, genitore_codice_fiscale, corsi, formula, note, gestita_il').eq('persona_id', personaId),
        // Il certificato (la scadenza; il foglio è su carta), il documento e il
        // pagamento: tutta la riga, che c'è o no la colonna del documento.
        db.from('schede_iscritti').select('*').eq('persona_id', personaId).maybeSingle(),
        // Le ricevute: col socio e le voci così come sono stampate.
        db.from('ricevute').select('anno, numero, data, intestatario, voci, totale, pagato, anticipo, note, creata_il, annullata_il').eq('persona_id', personaId),
        // Nascita, residenza e genitore di chi è entrato dall'import.
        db.from('anagrafiche').select(`${CAMPI_ANAGRAFICA}, cambiata_il`).eq('persona_id', personaId).maybeSingle(),
      ])
      return {
        esportato_il: new Date().toISOString(),
        persona: ok(persona),
        iscrizioni: ok(isc),
        presenze: ok(pres),
        richieste_di_iscrizione: ok(rich),
        certificato_e_pagamento: ok(scheda),
        // Senza 16-ricevute.sql non ce ne sono.
        ricevute: ric.error?.code === '42P01' || ric.error?.code === 'PGRST205' ? [] : ok(ric),
        // Senza 18-anagrafiche.sql non ce n'è.
        dati_anagrafici: anag.error?.code === '42P01' || anag.error?.code === 'PGRST205' ? null : ok(anag),
      }
    },
    async backup() {
      const { data, error } = await db.functions.invoke('backup', { body: { azione: 'elenco' } })
      if (error) throw await guaioFunzione(error, 'del backup', 'L’elenco delle copie non si legge')
      return data as StatoBackup
    },

    async avviaBackup() {
      const { error } = await db.functions.invoke('backup', { body: { azione: 'avvia' } })
      if (error) throw await guaioFunzione(error, 'del backup', 'Il backup non è partito')
    },

    async scaricaBackup(id) {
      const { data, error } = await db.functions.invoke('backup', { body: { azione: 'scarica', id } })
      if (error) throw await guaioFunzione(error, 'del backup', 'La copia non si scarica')
      return data as { link: string; nome: string }
    },
  }
}
