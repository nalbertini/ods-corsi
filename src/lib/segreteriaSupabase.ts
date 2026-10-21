import { indirizziDaSalvare } from './avvisoSegreteria'
import { daSenzaIstruttore } from './ore'
import type { IndiziDoppioni } from './doppioni'
import type { SupabaseClient } from '@supabase/supabase-js'
import { allungaCalendario } from './allunga'
import { giorniConLezioni } from './calendarioSettimana'
import type { AllenamentoSeg, Anagrafica, AnagraficaDi, CorsoSeg, DatiCorso, DatiSegreteria, EsitoDate, FonteNascita, Impostazioni, LezioneSeg, PersonaSeg, PersonaleSeg, PresenzaIstruttoreSeg, ComePresenzaIstruttore, ProvaSeg, RigaRegistro, Statistiche, StatoBackup, StatoPagamento, StoricoSeg } from './segreteria'
import { cosaNonVaTariffa } from './tariffe'
import { cosaNonVaLettera, type Lettera } from './lettere'
import { cosaNonVaCompenso, type RicevutaCompenso } from './compensi'
import { conDatiDellaSegreteria } from './segreteria'
import { attivitaCambiata, CONTATTO_SBAGLIATO, cosaNonVaAnagrafica, emailGiaDi, cosaNonVaAttivita, cosaNonVaCertificato, cosaNonVaScadenza, mancaAttivita, motivoAttivitaUsata, nascitaDelleFonti, ordinaAttivita, pulisciAnagrafica } from './segreteria'
import { nomeProprio } from './nomi'
import { genitoriDa, type RigaGenitore } from './sollecito'
import { tutteLeRighe } from './tutteLeRighe'
import { ESTENSIONI } from './richieste'
import { insegna, RUOLI_DEL_PERSONALE, segniDi, type RuoloPersonale } from './ruoli'
import type { StatoPresenzaIstruttore } from './tablet'
import type { StatoPresenza, StatoSessione } from './sala'
import { chiaveGiorno, giornoDi, valeIl } from './sala'
import { disciplinaDaSalvare, erroreDelLink, fonteDelLink, MAX_NOME_LISTA } from './musica'
import { indirizzoDiRitorno } from './invito'
import { eserciziDellaPalestra, voceDellaSala } from '../../timer/src/lib/impostazioniSala'
import { disciplineDa, ripulisciDisciplina } from '../../timer/src/lib/discipline'
import { CONTENITORE_VOCE, chiaveValida, chiaviSulServer, scaricaClip } from '../../timer/src/lib/clipSala'
import { cosaNonVaDiretto, type DatiPagamentoDiretto, type PagamentoDiretto } from './pagamenti'
import { satispayPerPersona, type PagamentoSatispay, type StatoSatispay } from './satispay'
import { oggiARoma } from './contabilita'
import { cosaNonVa, ENTE_PREDEFINITO, enteDa, intestatarioDa, pulisciIntestatario, quoteDi, type EnteRicevuta, type IntestatarioRicevuta, type QuotaRicevuta, type Ricevuta, type VoceRicevuta } from './ricevute'
import { motivoDaErrore, type InvioRicevuta } from './ricevuteEmail'
import { agganciaPerNome, cosaNonVaListino, LISTINO_PREDEFINITO, listinoDa, scordaListino } from './listino'
import { kanjiScritto } from './kanji'
import { mancaPagatoPrima, type IncassoPrima } from './pagatoPrima'
import { enteDaDati, fineAnno, mancaTessere, type EsitoImportTessere, type TesseraSeg } from './tessere'
import type { PaginaSito, VoceMenu } from './sitoPagine'
import type { OrarioSito } from './sitoOrari'
import { titoliDelSito, type RigaDaDove } from './provenienza'
import { pezziInHtml, pezziValidi } from './sitoPezzi'
import { ORARIO_NON_ATTIVO } from './sitoOrario'
import { CONTENITORE as CONTENITORE_SITO, controllaImmagine, cosaNonVaImmagini, eNomeDelContenitore, MASSIMO_BYTE, nomeNelContenitore, urlImmagine } from './sitoImmagini'
import { riduciFoto } from './foto'
import type { NumeriSito } from './sitoNumeri'
import { tipoDaRisposta } from './sitoStatistiche'
import { URL_SUPABASE } from './dati'
import { AllegatiNonPartiti, cosaNonVaSegnalazione, eCategoria, SCEGLI, type Categoria, guaioAllegati, mandaAllegati, nomiAllegati, type Allegato, type Segnalazione } from './segnalazioni'

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
  /** Arrivano con 41-attivita.sql: senza, la lettura è quella di prima. */
  attivita_id?: string | null
  attivita?: { nome: string } | null
  ricorrenze?: { attivita_id: string | null } | null
}

type Iscrizione = { corso_id: string; persona_id: string; dal: string; al: string | null }

/** Una riga di `pagamenti_diretti` (54-pagamenti-diretti.sql). */
interface RigaPagamentoDiretto {
  id: string
  persona_id: string
  data: string
  importo: number
  metodo: string
  voce: string
  nota: string | null
  creato_il: string
  annullato_il: string | null
}
const CAMPI_DIRETTO = 'id, persona_id, data, importo, metodo, voce, nota, creato_il, annullato_il'
const pagamentoDiretto = (r: RigaPagamentoDiretto): PagamentoDiretto => ({
  id: r.id,
  personaId: r.persona_id,
  data: r.data,
  importo: r.importo,
  metodo: r.metodo,
  voce: r.voce,
  nota: r.nota ?? undefined,
  creatoIl: r.creato_il,
  annullatoIl: r.annullato_il ?? undefined,
})

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
  ente: enteDa(r.ente),
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
  /** Arriva con 45-certificati-online.sql: senza, ogni file è di prima. */
  certificato_caricato_il?: string | null
  documento_in_segreteria?: boolean
  pagamento: StatoPagamento
  pagato_fino: string | null
  pagamento_nota: string | null
}

/**
 * I certificati medici: un contenitore privato, che apre solo la segreteria
 * (`45-certificati-online.sql`), con un link che dura dieci minuti.
 */
const CERTIFICATI = 'certificati'
const MANCA_CERTIFICATI = 'I certificati nell’app non sono ancora attivi sul database: va lanciato 45-certificati-online.sql'
const NUCLEO_SOLO_PROVA = 'Il nucleo familiare c’è solo in prova, per ora: il database non lo tiene ancora'
const DURATA_LINK = 600
const ALLEGATI = 'segnalazioni'
const MANCANO_PAGAMENTI_A_MANO = 'I pagamenti a mano non sono ancora attivi sul database: va lanciato 54-pagamenti-diretti.sql'
/** Lo Storage risponde con errori suoi: si traducono in frasi per chi usa l'app (`cosaNonVaImmagini`). */
const immaginiNonAttive = (e: { message: string; statusCode?: string }) => new Error(cosaNonVaImmagini(e.message, e.statusCode))
const MANCA_SITO = 'Il pannello del sito non è ancora attivo sul database: va lanciato 56-sito.sql'
const MANCANO_CORSI_SITO = ORARIO_NON_ATTIVO
const MANCANO_PEZZI = 'Le pagine a pezzi non sono ancora attive sul database: va lanciato 62-sito-pezzi.sql'
const MANCANO_ALLEGATI = 'Gli allegati non sono ancora attivi sul database: va lanciato 32-segnalazioni-allegati.sql'

const nome = (p: { nome: string; cognome: string } | null | undefined) => (p ? `${p.nome} ${p.cognome}`.trim() : '')

/** Le tabelle che arrivano dopo lo schema, col file che le crea. */
const MANCA_CONTABILITA = 'Il database non è ancora aggiornato per la contabilità: va lanciato 59-contabilita.sql'
const MANCA_CHIUSURA = 'Il database non è ancora aggiornato per la chiusura della cassa: va lanciato 60-chiusura-cassa.sql'
const MANCA_CAMBIA_VOCE = 'Il database non è ancora aggiornato per cambiare la voce dei movimenti: va lanciato 67-cambia-voce.sql'
const MANCA_MOVIMENTI_PERSONA = 'Il database non è ancora aggiornato per collegare i movimenti alle persone: va lanciato 70-movimenti-persona.sql'
const MANCA_PAGATI = 'Pagare i compensi non è ancora attivo sul database: va lanciato 81-compensi-pagati.sql'
const MANCA_FIRMA = 'Segnare chi non c’era e «a lezione basta uno» non sono ancora attivi sul database: va lanciato 82-manca-la-firma.sql'
const MANCA_COMPENSI = 'Le ricevute dei compensi non sono ancora attive sul database: va lanciato 80-ricevute-compensi.sql'
const MANCA_LETTERE = 'Le lettere d’incarico non sono ancora attive sul database: va lanciato 79-lettere-incarico.sql'
const TABELLE_DOPO: Array<[RegExp, string]> = [
  // Prima di `segnalazioni`, che le somiglia.
  [/chiusure_cassa/, MANCA_CHIUSURA],
  [/cambi_voce/, MANCA_CAMBIA_VOCE],
  [/collegamenti_persona/, MANCA_MOVIMENTI_PERSONA],
  [/voci_contabili|relation "(public\.)?(casse|movimenti)"|table 'public\.(casse|movimenti)'/, MANCA_CONTABILITA],
  [/sito_pagine|sito_menu|sito_redirect|salva_bozza_sito|pubblica_pagina_sito|cambia_indirizzo_sito|salva_menu_sito/, MANCA_SITO],
  [/segnalazioni_allegati/, MANCANO_ALLEGATI],
  [/tessere/, 'Le tessere non sono ancora attive sul database: va lanciato 61-tessere.sql'],
  [/avvisi_indirizzi/, 'Gli avvisi non sono ancora attivi sul database: va lanciato 84-avvisi-segreteria.sql'],
  [/non_doppioni/, 'Segnare due schede «non sono doppioni» non è ancora attivo sul database: va lanciato 33-non-doppioni.sql'],
  [/segnalazioni/, 'Le segnalazioni non sono ancora attive sul database: va lanciato 25-segnalazioni.sql'],
  [/schede_iscritti/, 'Certificati e pagamenti non sono ancora attivi sul database: va lanciato 07-certificati-pagamenti.sql'],
  [/musica_sale/, 'La musica delle sale non è ancora attiva sul database: va lanciato 09-musica.sql'],
  [/allenamenti/, 'Lo storico dei timer non è ancora attivo sul database: va lanciato 08-timer.sql'],
  [/pagamenti_diretti|pagamento_diretto/, MANCANO_PAGAMENTI_A_MANO],
  // Prima delle ricevute dei soci: «ricevute_compensi» contiene «ricevute».
  [/ricevute_compensi/, MANCA_COMPENSI],
  [/ricevute|emetti_ricevuta/, 'Le ricevute non sono ancora attive sul database: va lanciato 16-ricevute.sql'],
  [/lettere_incarico/, MANCA_LETTERE],
  [/tariffe_istruttori/, 'Le tariffe e i dati dei tecnici non sono ancora attivi sul database: va lanciato 78-tariffe-tecnici.sql'],
  [/anagrafiche/, 'Nascita, residenza e genitore degli iscritti non sono ancora attivi sul database: va lanciato 18-anagrafiche.sql'],
  [/segna_istruttore_previsto/, 'Segnare un istruttore su una lezione già coperta non è ancora attivo sul database: va lanciato 46-istruttore-collega.sql'],
  [/lezioni_senza_istruttore|segna_istruttori_lezione/, 'Le lezioni tenute da confermare non sono ancora attive sul database: va lanciato 23-istruttori-dalle-lezioni.sql'],
  [/elimina_presenza_istruttore/, 'Eliminare una presenza non è ancora attivo sul database: va lanciato 65-elimina-presenza-rifiutata.sql'],
  [/presenze_istruttori/, 'Le presenze degli istruttori non sono ancora attive sul database: va lanciato 15-presenze-istruttori.sql'],
]

const MANCA_TARIFFE = 'Le tariffe e i dati dei tecnici non sono ancora attivi sul database: va lanciato 78-tariffe-tecnici.sql'
const MANCA_ATTIVITA = 'Le attività non sono ancora attive sul database: va lanciato 41-attivita.sql'

const MANCA_AMMINISTRAZIONE = 'Il ruolo amministrazione non è ancora attivo sul database: va lanciato 55-amministrazione.sql'
const MANCA_DOPPIO = 'Il ruolo doppio, segreteria e istruttore, non è ancora attivo sul database: va rilanciato 01-schema.sql'

/**
 * Il ruolo come va scritto in `persone`. `anche_istruttore` solo quando c'è in
 * `p`: chi salva lo mette solo se il ruolo doppio c'era o ci sarà (vedi
 * `Personale.tsx`), così un database che non ha ancora la colonna salva lo
 * stesso istruttori e segreteria.
 */
function ruoloDaScrivere(p: RuoloPersonale): { ruolo: 'istruttore' | 'staff' | 'amministrazione'; anche_istruttore?: boolean; anche_amministrazione?: boolean } {
  return {
    ruolo: p.ruolo,
    ...(p.ancheIstruttore === undefined ? {} : { anche_istruttore: segniDi(p.ruolo, p.ancheIstruttore).ancheIstruttore }),
    ...(p.ancheAmministrazione === undefined ? {} : { anche_amministrazione: segniDi(p.ruolo, false, p.ancheAmministrazione).ancheAmministrazione }),
  }
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
  ['provinciaNascita', 'provincia_nascita'],
  ['provincia', 'provincia'],
  ['iban', 'iban'],
]

const CAMPI_ANAGRAFICA = ANAGRAFICA.map(([, c]) => c).join(', ')
type RigaAnagrafica = Record<string, string | null>
const aRigaAnagrafica = (a: Anagrafica) => Object.fromEntries(ANAGRAFICA.flatMap(([k, c]) => (a[k]?.trim() ? [[c, a[k]!.trim()]] : [])))
function daRigaAnagrafica(r: RigaAnagrafica | null): Anagrafica | null {
  if (!r) return null
  return Object.fromEntries(ANAGRAFICA.flatMap(([k, c]) => (r[c] ? [[k, r[c]]] : []))) as Anagrafica
}

/** Una riga di `lettere_incarico` (79-lettere-incarico.sql). */
interface RigaLettera {
  id: string
  persona_id: string
  stagione: string
  dal: string
  al: string
  qualifica: string
  giorni: string
  data: string
  tariffe: Lettera['tariffe']
  tecnico: Lettera['tecnico']
  firmata: boolean
  sostituita_il: string | null
  creata_il: string
}
const daRigaLettera = (r: RigaLettera): Lettera => ({
  id: r.id,
  personaId: r.persona_id,
  stagione: r.stagione,
  dal: r.dal,
  al: r.al,
  qualifica: r.qualifica,
  giorni: r.giorni,
  data: r.data,
  tariffe: r.tariffe,
  tecnico: r.tecnico,
  firmata: r.firmata,
  sostituitaIl: r.sostituita_il,
  creataIl: r.creata_il,
})

/** Una riga di `ricevute_compensi` (80-ricevute-compensi.sql): le righe del conto col nome del database. */
interface RigaRicevutaCompenso {
  id: string
  persona_id: string
  mese: string
  righe: Array<{ corso: string; lezioni: number; minuti: number; centesimi_ora?: number; importo?: number }>
  calcolato: number
  importo: number
  motivo: string | null
  tecnico: RicevutaCompenso['tecnico']
  qualifica: string | null
  data: string
  firmata: boolean
  annullata_il: string | null
  creata_il: string
  /** Senza 81-compensi-pagati.sql le due colonne non ci sono: da pagare. */
  movimento_id?: string | null
  pagata_il?: string | null
}
const daRigaRicevutaCompenso = (r: RigaRicevutaCompenso): RicevutaCompenso => ({
  id: r.id,
  personaId: r.persona_id,
  mese: r.mese,
  righe: r.righe.map((x) => ({ corso: x.corso, lezioni: x.lezioni, minuti: x.minuti, ...(x.centesimi_ora === undefined ? {} : { centesimiOra: x.centesimi_ora }), ...(x.importo === undefined ? {} : { importo: x.importo }) })),
  calcolato: r.calcolato,
  importo: r.importo,
  motivo: r.motivo,
  tecnico: r.tecnico,
  qualifica: r.qualifica,
  data: r.data,
  firmata: r.firmata,
  annullataIl: r.annullata_il,
  creataIl: r.creata_il,
  movimentoId: r.movimento_id ?? null,
  pagataIl: r.pagata_il ?? null,
})

/**
 * Un errore che non conosciamo: alla segreteria si dice cosa fare, il testo
 * del server (in inglese, per chi sviluppa) va solo nella console.
 */
function sconosciuto(testo: string | undefined, altrimenti = 'Non è andata: riprova fra poco'): string {
  if (testo) console.error(testo)
  return /failed to fetch|networkerror|load failed/i.test(testo ?? '') ? 'Non c’è rete: riprova quando torna' : altrimenti
}

/** Un errore del database detto in modo che la segreteria lo capisca. */
/** La riga di `corsi` da scrivere per `salvaCorso`. */
export function rigaDelCorso(c: DatiCorso) {
  return {
    nome: c.nome.trim(),
    sala_id: c.salaId ?? null,
    istruttore_id: c.istruttori[0] ?? null,
    capienza: c.capienza ?? null,
    colore: c.colore ?? null,
    // Solo se la scelta c'è: senza `61-tessere.sql` la schermata non la offre e la colonna non esiste.
    ...(c.enteTessera === undefined ? {} : { ente_tessera: enteDaDati(c.enteTessera) ?? null }),
    // Come la tessera: solo se la spunta c'è, cioè dopo 82-manca-la-firma.sql.
    ...(c.bastaUno === undefined ? {} : { basta_uno: c.bastaUno }),
  }
}

/**
 * «A lezione basta uno» per corso, dalla lettura di `id, basta_uno`; `null`
 * se la colonna non c'è ancora (82-manca-la-firma.sql). Ogni altro errore si
 * dice: una rete che cade non deve togliere la spunta senza avvisare.
 */
export function bastaUnoDai(r: { data: unknown; error: { code?: string; message?: string } | null }): Map<string, boolean> | null {
  if (r.error?.code === '42703' && /basta_uno/.test(r.error.message ?? '')) return null
  if (r.error) throw guaio(r.error)
  // La forma è quella della select `id, basta_uno`.
  return new Map((r.data as Array<{ id: string; basta_uno: boolean }>).map((x) => [x.id, x.basta_uno]))
}

function guaio(e: { message?: string; code?: string } | null): Error {
  // Le attività arrivano con 41-attivita.sql: la colonna, la tabella o il legame che mancano.
  if (/attivita/.test(e?.message ?? '')) {
    if (mancaAttivita(e) || e?.code === 'PGRST204') return new Error(MANCA_ATTIVITA)
    if (e?.code === '23505') return new Error("C'è già un'attività con questo nome")
    if (e?.code === '23503') return new Error('È ancora su dei giorni o delle lezioni: toglila dai giorni, oppure usa NON PIÙ IN USO')
  }
  // La tabella non c'è sul database: il file che la crea non è stato lanciato.
  if (e?.code === 'PGRST200' || e?.code === 'PGRST205' || e?.code === '42P01') {
    const t = TABELLE_DOPO.find(([nome]) => nome.test(e.message ?? ''))
    if (t) return new Error(t[1])
    return new Error(`Manca una tabella sul database: va lanciato il file che la crea (controllo.sql dice quale). ${e.message ?? ''}`.trim())
  }
  // Una radio nelle liste della musica: il vincolo del link la ammette dal 39.
  if (e?.code === '23514' && /musica_sale_link_check/.test(e.message ?? ''))
    return new Error('Le radio nelle liste non sono ancora attive sul database: va lanciato 39-musica-radio.sql')
  if ((e?.code === 'PGRST202' || e?.code === '42883') && /paga_compensi/.test(e.message ?? '')) return new Error(MANCA_PAGATI)
  if (((e?.code === 'PGRST202' || e?.code === '42883') && /segna_istruttore_assente/.test(e.message ?? '')) || ((e?.code === '42703' || e?.code === 'PGRST204') && /basta_uno/.test(e.message ?? '')))
    return new Error(MANCA_FIRMA)
  if ((e?.code === 'PGRST202' || e?.code === '42883') && /ricevuta_compenso/.test(e.message ?? '')) return new Error(MANCA_COMPENSI)
  if ((e?.code === 'PGRST202' || e?.code === '42883') && /pagamento_diretto/.test(e.message ?? '')) return new Error(MANCANO_PAGAMENTI_A_MANO)
  if ((e?.code === 'PGRST202' || e?.code === '42883') && /ricevut/.test(e.message ?? ''))
    return new Error('Le ricevute non sono ancora attive sul database: va lanciato 16-ricevute.sql')
  if ((e?.code === 'PGRST202' || e?.code === '42883') && /fai_lettera_incarico/.test(e.message ?? '')) return new Error(MANCA_LETTERE)
  // Province e IBAN dei tecnici arrivano con 78-tariffe-tecnici.sql: 42703 leggendo, PGRST204 scrivendo.
  if ((e?.code === '42703' || e?.code === 'PGRST204') && /provincia_nascita|provincia|iban/.test(e.message ?? '')) return new Error(MANCA_TARIFFE)
  if (e?.code === '42703' && /ricevute/.test(e.message ?? '')) return new Error('Le ricevute non sono ancora attive sul database: va lanciato 16-ricevute.sql')
  // Il pagamento Satispay fatto prima di mandare la richiesta arriva con 83-satispay-prima.sql.
  if (e?.code === '42703' && /pagamenti_satispay\.(email|corso_id|formula)/.test(e.message ?? ''))
    return new Error('Satispay prima di mandare non è ancora attivo sul database: va lanciato 83-satispay-prima.sql')
  // Il listino arriva con 19-listino.sql: 42703 leggendo, PGRST204 scrivendo.
  if ((e?.code === '42703' || e?.code === 'PGRST204') && /listino/.test(e.message ?? ''))
    return new Error('Il listino non si può ancora cambiare sul database: va lanciato 19-listino.sql')
  // Una colonna che non c'è: voce ed esercizi dei tablet arrivano con 13-voce-esercizi.sql.
  if (e?.code === '42703' && /voce|esercizi/.test(e.message ?? ''))
    return new Error('La voce e gli esercizi dei tablet non sono ancora attivi sul database: va lanciato 13-voce-esercizi.sql')
  // La colonna del ruolo doppio, che arriva con 01-schema.sql: 42703 leggendo, PGRST204 scrivendo.
  if ((e?.code === '42703' || e?.code === 'PGRST204') && /anche_istruttore/.test(e.message ?? '')) return new Error(MANCA_DOPPIO)
  // Il ruolo amministrazione arriva con 55-amministrazione.sql: la colonna che non c'è, o il valore che l'enum non conosce (22P02).
  if (
    ((e?.code === '42703' || e?.code === 'PGRST204') && /anche_amministrazione/.test(e.message ?? '')) ||
    (e?.code === '22P02' && /amministrazione/.test(e.message ?? ''))
  )
    return new Error(MANCA_AMMINISTRAZIONE)
  // Le funzioni dell'amministrazione, che arrivano con lo stesso file.
  if ((e?.code === 'PGRST202' || e?.code === '42883') && /cerca_pagatori|nomi_persone/.test(e.message ?? '')) return new Error(MANCA_AMMINISTRAZIONE)
  // Le funzioni della contabilità arrivano con 59-contabilita.sql.
  if ((e?.code === 'PGRST202' || e?.code === '42883') && /salva_voce|rinomina_voce|imposta_voce_attiva|imposta_saldo_cassa|registra_movimento|registra_giroconto|annulla_movimento|correggi_testo_movimento/.test(e.message ?? '')) return new Error(MANCA_CONTABILITA)
  // Le funzioni della chiusura di cassa arrivano con 60-chiusura-cassa.sql.
  if ((e?.code === 'PGRST202' || e?.code === '42883') && /chiudi_cassa|annulla_chiusura_cassa/.test(e.message ?? '')) return new Error(MANCA_CHIUSURA)
  // Cambiare la voce dei movimenti arriva con 67-cambia-voce.sql.
  if ((e?.code === 'PGRST202' || e?.code === '42883') && /cambia_voce_movimenti/.test(e.message ?? '')) return new Error(MANCA_CAMBIA_VOCE)
  // Collegare lo storico alle persone arriva con 70-movimenti-persona.sql.
  if ((e?.code === 'PGRST202' || e?.code === '42883') && /riepilogo_collegamenti_persona|esiti_collegamenti_persona|collega_sicuri_persona|collega_movimenti_persona|scollega_movimenti_persona|togli_lotto_collegamenti|candidati_persona_movimento|storico_persona/.test(e.message ?? '')) return new Error(MANCA_MOVIMENTI_PERSONA)
  if (e?.code === '42501' && /contabilità/.test(e.message ?? '')) return new Error('Non hai il permesso: la contabilità la cura l’amministrazione')
  // Il kanji arriva con 24-kanji.sql; due persone con lo stesso non si possono avere.
  if ((e?.code === '42703' || e?.code === 'PGRST204') && /kanji/.test(e.message ?? '')) return new Error('Il kanji non è ancora attivo sul database: va lanciato 24-kanji.sql')
  // Il file del certificato e la data insieme arrivano con 45-certificati-online.sql.
  if ((e?.code === 'PGRST202' || e?.code === '42883') && /salva_certificato/.test(e.message ?? '')) return new Error(MANCA_CERTIFICATI)
  if ((e?.code === '42703' || e?.code === 'PGRST204') && /certificato_caricato_il/.test(e.message ?? '')) return new Error(MANCA_CERTIFICATI)
  if ((e?.code === 'PGRST202' || e?.code === '42883') && /unisci_persone|anteprima_unione/.test(e.message ?? ''))
    return new Error('Unire due schede non è ancora attivo sul database: va lanciato 29-unisci-doppioni.sql')
  // Togliere un allegato: `togli_allegato` dice di no a chi non l'ha mandato.
  if (e?.code === 'P0002' && /allegato/.test(e.message ?? '')) return new Error('Questo allegato non c’è più')
  if (e?.code === '42501' && /allegato/.test(e.message ?? '')) return new Error('Un allegato lo toglie solo chi l’ha mandato')
  if ((e?.code === 'PGRST202' || e?.code === '42883') && /allegato/.test(e.message ?? '')) return new Error(MANCANO_ALLEGATI)
  // Il sito arriva con 56-sito.sql: le funzioni che mancano, il testo che il sito non ammette, la pagina ancora nel menu.
  // I pezzi di una pagina oltre il limite del database (stessa frase del testo troppo lungo, `testoTroppoLungo`).
  if (e?.code === '23514' && /bozza_pezzi_check/.test(e.message ?? '')) return new Error('La pagina è troppo lunga: togli qualcosa e riprova')
  // Le pagine a pezzi arrivano con 62-sito-pezzi.sql: la colonna che non c'è (42703 leggendo e creando, PGRST204 scrivendo) o la funzione.
  if ((e?.code === '42703' || e?.code === 'PGRST204' || e?.code === 'PGRST202' || e?.code === '42883') && /bozza_pezzi|salva_bozza_pezzi_sito/.test(e.message ?? '')) return new Error(MANCANO_PEZZI)
  // I corsi collegati arrivano con 68-sito-orario.sql.
  if ((e?.code === 'PGRST202' || e?.code === '42883') && /salva_corsi_sito/.test(e.message ?? '')) return new Error(MANCANO_CORSI_SITO)
  if ((e?.code === '42703' || e?.code === 'PGRST204') && /corsi_collegati/.test(e.message ?? '')) return new Error(MANCANO_CORSI_SITO)
  if ((e?.code === 'PGRST202' || e?.code === '42883') && /(salva_bozza_sito|pubblica_pagina_sito|cambia_indirizzo_sito|salva_menu_sito)/.test(e.message ?? '')) return new Error(MANCA_SITO)
  if (e?.code === '23514' && /sito_pagine_(bozza|pubblicato)_check/.test(e.message ?? '')) return new Error('Il testo contiene cose che il sito non ammette (script, moduli, stili): toglile e riprova')
  if (e?.code === '23514' && /sito_pagine_slug_check/.test(e.message ?? '')) return new Error('Questo indirizzo non va bene: solo lettere minuscole senza accenti, numeri e trattini, e non uno che serve al sito')
  if (e?.code === '23514' && /sito_pagine_legge_visibile/.test(e.message ?? '')) return new Error('Le pagine di legge devono restare sul sito: non si possono nascondere')
  if (e?.code === '23514' && /sito_pagine_titolo_check/.test(e.message ?? '')) return new Error('Il titolo va da 1 a 120 lettere')
  if (e?.code === '23514' && /sito_pagine_descrizione_check/.test(e.message ?? '')) return new Error('La descrizione arriva al massimo a 300 lettere')
  if (e?.code === '23514' && /sito_menu/.test(e.message ?? '')) return new Error('Una voce del menu ha un nome o un indirizzo che il sito non ammette')
  if (e?.code === '23505' && /sito_pagine_slug_key/.test(e.message ?? '')) return new Error('Questo indirizzo è già di un’altra pagina')
  if (e?.code === '23503' && /sito_menu/.test(e.message ?? '')) return new Error('La pagina è nel menu o nel footer del sito: toglila da lì, poi si cancella')
  // Le discipline arrivano con 40-discipline.sql.
  if ((e?.code === '42703' || e?.code === 'PGRST204') && /disciplin/.test(e.message ?? ''))
    return new Error('Le discipline non sono ancora attive sul database: va lanciato 40-discipline.sql')
  // La categoria delle segnalazioni arriva con 38-segnalazioni-categoria.sql.
  if ((e?.code === '42703' || e?.code === 'PGRST204') && /categoria/.test(e.message ?? ''))
    return new Error('Le categorie delle segnalazioni non sono ancora attive sul database: va lanciato 38-segnalazioni-categoria.sql')
  // L'email di contatto arriva con 44-email-contatto.sql, e ha la stessa forma dell'email.
  if ((e?.code === '42703' || e?.code === 'PGRST204') && /email_contatto/.test(e.message ?? ''))
    return new Error('L’email di contatto non è ancora attiva sul database: va lanciato 44-email-contatto.sql')
  if (e?.code === '23514' && /email_contatto/.test(e.message ?? '')) return new Error(CONTATTO_SBAGLIATO)
  // `pagamenti_diretti` non lascia cancellare chi ne ha (54-pagamenti-diretti.sql).
  if (e?.code === '23503' && /pagamenti_diretti/.test(e.message ?? '')) return new Error('Ha dei pagamenti registrati: non si elimina, gli si toglie l’accesso')
  if (e?.code === '23505' && /kanji/.test(e.message ?? '')) return new Error('Questo kanji è già di un’altra persona: scegline un altro')
  if (e?.code === '23505') return new Error('C’è già: due righe uguali non si possono avere (un’email già usata, un corso già iscritto)')
  if (e?.code === '42501' && /troppe ricerche/.test(e.message ?? '')) return new Error('Hai fatto troppe ricerche: riprova fra qualche minuto')
  if (e?.code === '42501') return new Error('Non hai il permesso: serve un accesso da segreteria')
  // I nostri `raise exception` (P0001 quando non hanno un codice; P0002 «non c'è più»; 22023 e 54000)
  // sono già scritti per la segreteria: passano così come sono.
  if (e?.message && ['P0001', 'P0002', '22023', '54000'].includes(e.code ?? '')) return new Error(e.message)
  return new Error(sconosciuto(e?.message))
}

/**
 * Un errore di una funzione di Supabase (`invita`, `elimina`, `backup`) detto per la
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
  if (r?.status === 404) return new Error(`La funzione ${di} non è ancora pubblicata su Supabase`)
  if (e.name === 'FunctionsFetchError') return new Error(`La funzione ${di} non risponde: è pubblicata su Supabase? C’è rete?`)
  return new Error(sconosciuto(e.message, altrimenti))
}

/** Un errore dello Storage detto per la segreteria. */
function guaioFile(e: { message?: string; statusCode?: string } | null): Error {
  const m = e?.message ?? ''
  if (/row-level security|unauthorized|403/i.test(m + (e?.statusCode ?? ''))) return new Error('Non hai il permesso: serve un accesso da segreteria')
  if (/bucket not found/i.test(m)) return new Error('Il contenitore dei certificati non c’è più: il file non si trova')
  if (/exceeded|too large|413/i.test(m + (e?.statusCode ?? ''))) return new Error('Il file è troppo grande: al massimo 10 MB')
  if (/mime|type/i.test(m)) return new Error('Questo tipo di file non va: serve una foto o un PDF')
  return new Error(sconosciuto(m, 'Il file non è partito: riprova'))
}

/** Un errore del contenitore della voce detto per la segreteria. */
function guaioVoce(e: unknown): Error {
  const m = e instanceof Error ? e.message : ((e as { message?: string } | null)?.message ?? '')
  if (/bucket not found/i.test(m)) return new Error('Il contenitore della voce non c’è: va lanciato 13-voce-esercizi.sql')
  if (/row-level security|unauthorized|403/i.test(m)) return new Error('Non hai il permesso: serve un accesso da segreteria')
  if (/exceeded|too large|413/i.test(m)) return new Error('La clip è troppo lunga: una frase, non un discorso')
  if (/mime|type/i.test(m)) return new Error('Questo browser registra in un formato che il server non accetta')
  return new Error(sconosciuto(m, 'La clip non è partita: riprova'))
}

export function creaSegreteriaSupabase(db: SupabaseClient): DatiSegreteria {
  const ok = <T>(r: { data: T; error: { message?: string; code?: string } | null }): T => {
    if (r.error) throw guaio(r.error)
    return r.data
  }

  /**
   * Dopo un cambio al sito chiede alla funzione `sito` di far partire subito il
   * workflow, invece di aspettare il giro a tempo. Mai un errore per la
   * segreteria, e non si aspetta: il cambio è già fatto, e se la funzione non
   * c'è o non risponde il giro a tempo pubblica comunque.
   * In modalità prova (`segreteriaProva.ts`) non c'è GitHub: niente da chiamare.
   */
  const rigeneraSito = async () => {
    try {
      await db.functions.invoke('sito', { body: { azione: 'avvia' } })
    } catch {
      // Il giro a tempo (ogni cinque minuti) copre.
    }
  }

  /** Quante righe di una tabella hanno questa attività. */
  const quante = async (tabella: 'ricorrenze' | 'sessioni', id: string) => {
    const { count, error } = await db.from(tabella).select('id', { count: 'exact', head: true }).eq('attivita_id', id)
    if (error) throw guaio(error)
    return count ?? 0
  }

  /** Le discipline della palestra; senza 40-discipline.sql (colonna mancante) quelle di partenza. */
  const leggiDiscipline = async () => {
    const r = await db.from('impostazioni').select('discipline').maybeSingle()
    if (r.error?.code === '42703') return disciplineDa(null)
    return disciplineDa((ok(r) as { discipline?: unknown } | null)?.discipline)
  }

  /** `salva_date_corsi`: conta soltanto, o salva e toglie. */
  const dateCorsi = async (inizio: string | null, fine: string | null, soloContare: boolean): Promise<EsitoDate> => {
    const r = await db.rpc('salva_date_corsi', { inizio, fine, solo_contare: soloContare })
    if (r.error?.code === 'PGRST202' || r.error?.code === '42883') {
      // Senza 35-date-corsi.sql le date si salvano come prima e le lezioni fuori restano.
      // Non è un errore: il calendario va allungato lo stesso.
      if (!soloContare) ok(await db.from('impostazioni').update({ inizio_corsi: inizio, fine_corsi: fine }).eq('id', true))
      return { tolte: 0, restano: 0, prima: null, ultima: null, manca: 'va lanciato 35-date-corsi.sql' }
    }
    // Il json che costruisce `salva_date_corsi`, con questi nomi.
    return ok(r) as EsitoDate
  }

  /**
   * Carica i file di un messaggio appena scritto. Quelli che non partono non
   * annullano il messaggio (rimandarlo lo duplicherebbe): si dice quali. Se il
   * database non ha il file 32, invece, è quello da dire, e basta.
   */
  const allega = async (messaggio: string, files: File[]) => {
    const nomi = nomiAllegati(files, new Date())
    const falliti = await mandaAllegati(
      files.map((file, i) => ({ name: nomi[i], file })),
      async ({ name, file }) => {
        const su = await db.storage.from(ALLEGATI).upload(`${messaggio}/${name}`, file, { contentType: file.type, upsert: false })
        if (su.error && /bucket not found/i.test(su.error.message ?? '')) throw new Error(MANCANO_ALLEGATI)
        if (su.error) return false
        const riga = await db.from('segnalazioni_allegati').insert({ messaggio_id: messaggio, nome: name, tipo: file.type, peso: file.size })
        if (!riga.error) return true
        // Il file è andato ma la riga no: si toglie, se no resta lì senza che nessuno lo veda.
        await db.storage.from(ALLEGATI).remove([`${messaggio}/${name}`])
        if (riga.error.code === 'PGRST205' || riga.error.code === '42P01') throw new Error(MANCANO_ALLEGATI)
        return false
      },
    )
    if (falliti.length) throw new AllegatiNonPartiti(messaggio, falliti)
  }

  /** Dove sta il file del certificato, se c'è. */
  const fileCertificato = async (personaId: string) =>
    (ok(await db.from('schede_iscritti').select('certificato_file').eq('persona_id', personaId).maybeSingle()) as { certificato_file: string | null } | null)?.certificato_file ?? null
  /**
   * Cancella il file del certificato, se c'è: dopo, nella scheda non
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
    return conDatiDellaSegreteria(vince && { dati: vince.dati, da: vince.da }, x)
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

  /** I pagamenti Satispay (`73-satispay.sql`), anche per le schede in `persone`; senza il file, nessuno. */
  const leggiSatispay = async (): Promise<PagamentoSatispay[]> => {
    const r = await tutteLeRighe((prima, ultima) =>
      db
        .from('pagamenti_satispay')
        // `email`, `corso_id`, `formula`: 83-satispay-prima.sql, per il pagato senza richiesta da richiamare.
        .select('id, richiesta_id, chi, importo, stato, creato_il, pagato_il, ricevuta_id, persona_id, email, corso_id, formula, ricevuta:ricevute ( annullata_il ), corso:corsi ( nome )')
        .order('creato_il', { ascending: false })
        .order('id')
        .range(prima, ultima),
    )
    // Prima di 73-satispay.sql non c'è niente da mostrare.
    if (r.error && (r.error.code === '42P01' || r.error.code === 'PGRST205' || r.error.code === 'PGRST200')) return []
    // `as`: Supabase tipa la riga a modo suo, la forma è quella della select.
    return (ok(r) as unknown as Array<{ id: string; richiesta_id: string | null; chi: string; importo: number; stato: StatoSatispay; creato_il: string; pagato_il: string | null; ricevuta_id: string | null; persona_id: string | null; email: string | null; corso_id: string | null; formula: 'annuale' | 'trimestre' | null; ricevuta: { annullata_il: string | null } | null; corso: { nome: string } | null }>).map(
      (x): PagamentoSatispay => ({
        id: x.id,
        richiestaId: x.richiesta_id ?? undefined,
        chi: x.chi,
        importo: x.importo,
        stato: x.stato,
        creatoIl: x.creato_il,
        pagatoIl: x.pagato_il ?? undefined,
        // In una ricevuta annullata i soldi non contano più: tornano liberi, come in `emetti_ricevuta_satispay`.
        ricevutaId: x.ricevuta_id && !x.ricevuta?.annullata_il ? x.ricevuta_id : undefined,
        personaId: x.persona_id ?? undefined,
        email: x.email ?? undefined,
        corsoId: x.corso_id ?? undefined,
        corso: x.corso?.nome,
        formula: x.formula ?? undefined,
      }),
    )
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
      const righe = ok(await db.from('persone').select('*').in('ruolo', [...RUOLI_DEL_PERSONALE]).eq('attiva', true).order('nome')) as Array<{
        id: string; nome: string; cognome: string; ruolo: 'istruttore' | 'staff' | 'amministrazione'; anche_istruttore?: boolean
      }>
      return righe.filter((r) => insegna({ ruolo: r.ruolo, ancheIstruttore: r.anche_istruttore })).map((r) => ({ id: r.id, nome: nome(r) }))
    },

    async giorniConLezioni(da, a) {
      // Sola lettura delle date, senza `allungaCalendario`: il calendario si apre spesso e non deve scrivere.
      const fino = new Date(a)
      fino.setHours(23, 59, 59, 999)
      const righe = ok(
        await tutteLeRighe((prima, ultima) => db.from('sessioni').select('inizio').gte('inizio', da.toISOString()).lte('inizio', fino.toISOString()).order('inizio').order('id').range(prima, ultima)),
      ) as unknown as Array<{ inizio: string }>
      return [...giorniConLezioni(righe.map((r) => r.inizio))]
    },

    async settimana(da, a) {
      await allungaCalendario(db)
      const fino = new Date(a)
      fino.setHours(23, 59, 59, 999)
      const leggi = (colonne: string) =>
        tutteLeRighe((prima, ultima) => db.from('sessioni').select(colonne).gte('inizio', da.toISOString()).lte('inizio', fino.toISOString()).order('inizio').order('id').range(prima, ultima))
      const BASE = 'id, corso_id, ricorrenza_id, inizio, fine, stato, sala_id, istruttore_id, corsi ( nome, colore, capienza, sala_id, istruttore_id ), sale ( nome ), persone ( nome, cognome )'
      let lette = await leggi(`${BASE}, attivita_id, attivita ( nome ), ricorrenze ( attivita_id )`)
      // Senza 41-attivita.sql le lezioni si leggono come prima, senza attività.
      if (mancaAttivita(lette.error)) lette = await leggi(BASE)
      const sessioni = ok(lette) as unknown as RigaSessione[]
      const corsi = [...new Set(sessioni.map((s) => s.corso_id))]
      const ids = sessioni.map((s) => s.id)
      const vuoto = ['00000000-0000-0000-0000-000000000000']
      const [isc, pres, chi] = await Promise.all([
        tutteLeRighe((prima, ultima) => db.from('iscrizioni').select('corso_id, persona_id, dal, al, persone ( attiva )').in('corso_id', corsi.length ? corsi : vuoto).order('id').range(prima, ultima)),
        tutteLeRighe((da, fino) => db.from('presenze').select('sessione_id, stato').in('sessione_id', ids.length ? ids : vuoto).order('id').range(da, fino)),
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
          attivitaId: s.attivita_id ?? undefined,
          attivita: s.attivita?.nome,
          attivitaCambiata: attivitaCambiata({ attivitaId: s.attivita_id, straordinaria: !s.ricorrenza_id, inizio: s.inizio, segnati: segni.length }, { attivitaId: s.ricorrenze?.attivita_id }),
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
      if (cambi.attivitaId !== undefined) riga.attivita_id = cambi.attivitaId
      ok(await db.from('sessioni').update(riga).eq('id', sessioneId))
    },

    async attivitaComeIlGiorno(sessioneId) {
      // Il valore del giorno: così la lezione torna a seguirlo (una straordinaria non ne ha: nessuna).
      const s = ok(await db.from('sessioni').select('ricorrenze ( attivita_id )').eq('id', sessioneId).single()) as unknown as { ricorrenze: { attivita_id: string | null } | null }
      ok(await db.from('sessioni').update({ attivita_id: s.ricorrenze?.attivita_id ?? null }).eq('id', sessioneId))
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
      const leggi = (giorno: string, ente: string) =>
        db.from('corsi').select(`id, nome, colore, capienza, attivo, sala_id, istruttore_id${ente}, sale ( nome ), ricorrenze ( id, giorno, ora, durata_min, dal, al, sala_id, sale ( nome )${giorno} )`).order('nome')
      let ente = ', ente_tessera'
      let lette = await leggi(', attivita_id, attivita ( nome )', ente)
      // Senza 61-tessere.sql i corsi si leggono come prima, senza la tessera richiesta.
      if (mancaTessere(lette.error)) lette = await leggi(', attivita_id, attivita ( nome )', (ente = ''))
      // Senza 41-attivita.sql i giorni si leggono come prima, senza attività.
      if (mancaAttivita(lette.error)) lette = await leggi('', ente)
      const righe = ok(lette) as unknown as Array<{
        id: string; nome: string; colore: string | null; capienza: number | null; attivo: boolean; sala_id: string | null; istruttore_id: string | null; ente_tessera?: string | null
        sale: { nome: string } | null
        ricorrenze: Array<{ id: string; giorno: number; ora: string; durata_min: number; dal: string; al: string | null; sala_id: string | null; sale: { nome: string } | null; attivita_id?: string | null; attivita?: { nome: string } | null }>
      }>
      const chi = await insegnanti(righe.map((r) => r.id))
      // Letta a parte: senza 82-manca-la-firma.sql la colonna non c'è, e CORSI non offre la spunta.
      const uno = bastaUnoDai(await db.from('corsi').select('id, basta_uno'))
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
          enteTessera: r.ente_tessera ?? undefined,
          bastaUno: uno ? (uno.get(r.id) ?? false) : undefined,
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
              attivitaId: x.attivita_id ?? undefined,
              attivita: x.attivita?.nome,
            }))
            .sort((x, y) => ((x.giorno + 6) % 7) - ((y.giorno + 6) % 7) || x.ora.localeCompare(y.ora)),
        }),
      )
    },

    async salvaCorso(c) {
      if (!c.nome.trim()) throw new Error('Il corso ha bisogno di un nome')
      const riga = rigaDelCorso(c)
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
      ok(
        await db
          .from('ricorrenze')
          .insert({ corso_id: corsoId, giorno: r.giorno, ora: r.ora, durata_min: r.durata, dal: oggi(), sala_id: r.salaId ?? null, ...(r.attivitaId ? { attivita_id: r.attivitaId } : {}) }),
      )
      if (opzioni?.rigenera !== false) await rigenera()
    },

    async salaRicorrenza(ricorrenzaId, salaId) {
      // Le lezioni future le sposta il trigger di 05-segreteria.sql.
      ok(await db.from('ricorrenze').update({ sala_id: salaId }).eq('id', ricorrenzaId))
    },

    async attivitaRicorrenza(ricorrenzaId, attivitaId) {
      // Le lezioni future che la seguivano le cambia il trigger di 41-attivita.sql.
      ok(await db.from('ricorrenze').update({ attivita_id: attivitaId }).eq('id', ricorrenzaId))
    },

    async attivita() {
      const r = await db.from('attivita').select('id, nome, attiva')
      if (mancaAttivita(r.error)) return { elenco: [], manca: 'va lanciato 41-attivita.sql' }
      const righe = ok(r) as unknown as Array<{ id: string; nome: string; attiva: boolean }>
      // Su quanti giorni e quante lezioni è: una conta per voce, sono poche.
      const elenco = await Promise.all(
        ordinaAttivita(righe).map(async (x) => ({ id: x.id, nome: x.nome, attiva: x.attiva, giorni: await quante('ricorrenze', x.id), lezioni: await quante('sessioni', x.id) })),
      )
      return { elenco }
    },

    async salvaAttivita({ id, nome }) {
      const altre = ok(await db.from('attivita').select('id, nome')) as unknown as Array<{ id: string; nome: string }>
      const guaioNome = cosaNonVaAttivita(nome, altre, id)
      if (guaioNome) throw new Error(guaioNome)
      if (id) {
        ok(await db.from('attivita').update({ nome: nome.trim() }).eq('id', id))
        return id
      }
      return (ok(await db.from('attivita').insert({ nome: nome.trim() }).select('id').single()) as { id: string }).id
    },

    async attivaAttivita(id, attiva) {
      ok(await db.from('attivita').update({ attiva }).eq('id', id))
    },

    async eliminaAttivita(id) {
      const motivo = motivoAttivitaUsata(await quante('ricorrenze', id), await quante('sessioni', id))
      if (motivo) throw new Error(motivo)
      ok(await db.from('attivita').delete().eq('id', id))
    },

    async togliRicorrenza(ricorrenzaId) {
      ok(await db.rpc('chiudi_ricorrenza', { ricorrenza: ricorrenzaId }))
    },

    async pagatoPrima() {
      const r = await db.rpc('incassi_vecchio_programma')
      // Senza 71-pagato-vecchio-programma.sql: nessun incasso, e lo si dice (il filtro non si offre).
      if (mancaPagatoPrima(r.error)) return { elenco: [], manca: true }
      return {
        elenco: (ok(r) as unknown as Array<{ persona_id: string | null; data: string; importo: number; voce: string }>).map(
          (x): IncassoPrima => ({ personaId: x.persona_id, data: x.data, importo: x.importo, voce: x.voce }),
        ),
      }
    },

    async tessere() {
      const r = await tutteLeRighe((prima, ultima) =>
        db.from('tessere').select('id, persona_id, ente, tipo, codice, dal, al, origine').order('persona_id').order('ente').order('dal').order('id').range(prima, ultima),
      )
      // Senza 61-tessere.sql: nessuna tessera, e lo si dice.
      if (mancaTessere(r.error)) return { elenco: [], manca: true }
      return {
        elenco: (ok(r) as unknown as Array<{ id: string; persona_id: string; ente: string; tipo: TesseraSeg['tipo']; codice: string; dal: string; al: string; origine: 'rasd' | 'manuale' }>).map(
          (x): TesseraSeg => ({ id: x.id, personaId: x.persona_id, ente: x.ente, tipo: x.tipo, codice: x.codice, dal: x.dal, al: x.al, origine: x.origine }),
        ),
      }
    },

    async importaTessere(righe, soloProva) {
      const r = await db.rpc('importa_tessere', { righe, solo_prova: soloProva })
      if (mancaTessere(r.error)) throw new Error('Le tessere non sono ancora attive sul database: va lanciato 61-tessere.sql')
      return ok(r) as EsitoImportTessere
    },

    async aggiungiTessera(t) {
      const ente = enteDaDati(t.ente)
      if (!ente || !t.codice.trim()) throw new Error('Scrivi l’ente e il numero della tessera')
      ok(await db.from('tessere').insert({ persona_id: t.personaId, ente, tipo: t.tipo, codice: t.codice.trim(), dal: t.dal, al: fineAnno(t.dal), origine: t.origine ?? 'manuale' }))
    },

    async togliTessera(id) {
      ok(await db.from('tessere').delete().eq('id', id))
    },

    async persone() {
      // Se ha pagato lo dicono le quote delle ricevute (27-pagamento-dalle-ricevute.sql);
      // finché quel file non è passato, le stesse righe si ricavano dalle ricevute qui.
      const quote = (async (): Promise<Map<string, QuotaRicevuta[]>> => {
        const perPersona = new Map<string, QuotaRicevuta[]>()
        const metti = (id: string, q: QuotaRicevuta) => perPersona.set(id, [...(perPersona.get(id) ?? []), q])
        const vista = await tutteLeRighe((prima, ultima) => db.from('quote_ricevute').select('persona_id, anno, numero, dal, al, mancano').order('persona_id').order('anno').order('numero').order('dal').order('al').order('mancano').range(prima, ultima))
        if (!vista.error) {
          for (const q of vista.data as Array<{ persona_id: string; anno: number; numero: number; dal: string | null; al: string | null; mancano: number }>)
            metti(q.persona_id, { anno: q.anno, numero: q.numero, dal: q.dal ?? undefined, al: q.al ?? undefined, mancano: q.mancano })
          return perPersona
        }
        const r = await tutteLeRighe((prima, ultima) => db.from('ricevute').select('persona_id, anno, numero, voci, anticipo').is('annullata_il', null).not('persona_id', 'is', null).order('id').range(prima, ultima))
        // Senza ricevute sul database (16-ricevute.sql) resta l'eccezione scritta a mano.
        if (r.error) return perPersona
        for (const x of r.data as Array<{ persona_id: string; anno: number; numero: number; voci: VoceRicevuta[]; anticipo: number }>)
          for (const q of quoteDi([{ ...x, voci: x.voci } as unknown as Ricevuta])) metti(x.persona_id, q)
        return perPersona
      })()
      // La data di nascita decide se il certificato serve (sotto i 6 anni no). Senza queste tabelle, o senza il permesso,
      // nessuna data: il certificato serve a tutti, come prima. A pagine, per il tetto di righe di PostgREST.
      const nati = (async (): Promise<Map<string, string>> => {
        const tutte = async (r: Promise<{ data: unknown[]; error: unknown }>) => {
          const { data, error } = await r
          return error ? [] : data
        }
        const [an, rich] = await Promise.all([
          tutte(tutteLeRighe((prima, ultima) => db.from('anagrafiche').select('persona_id, nato_il, cambiata_il').order('persona_id').range(prima, ultima))),
          tutte(
            tutteLeRighe((prima, ultima) =>
              db.from('richieste_iscrizione').select('id, persona_id, nato_il, gestita_il, creata_il').eq('stato', 'accolta').not('persona_id', 'is', null).order('id').range(prima, ultima),
            ),
          ),
        ])
        // as: le righe sono quelle dei select qui sopra.
        const dalleAnagrafiche = (an as Array<{ persona_id: string; nato_il: string | null; cambiata_il: string }>).map(
          (x): FonteNascita => ({ personaId: x.persona_id, da: 'segreteria', quando: x.cambiata_il, natoIl: x.nato_il ?? undefined }),
        )
        const dalleRichieste = (rich as Array<{ persona_id: string; nato_il: string | null; gestita_il: string | null; creata_il: string }>).map(
          (x): FonteNascita => ({ personaId: x.persona_id, da: 'modulo', quando: x.gestita_il ?? x.creata_il, natoIl: x.nato_il ?? undefined }),
        )
        return nascitaDelleFonti([...dalleAnagrafiche, ...dalleRichieste])
      })()
      const campi = (contatto: boolean) => `id, nome, cognome, email, ${contatto ? 'email_contatto, ' : ''}telefono, attiva, creata_il, iscrizioni ( corso_id, dal, al )`
      const scheda = 'certificato_scade, certificato_file, pagamento, pagato_fino, pagamento_nota'
      const leggi = (schede: string | null, contatto: boolean) =>
        tutteLeRighe((prima, ultima) =>
          db
            .from('persone')
            .select(schede ? `${campi(contatto)}, schede_iscritti!persona_id ( ${schede} )` : campi(contatto))
            .eq('ruolo', 'iscritto')
            .order('cognome')
            .order('id')
            .range(prima, ultima),
        )
      const colonnaMancante = (x: { error: { code?: string; message?: string } | null }) => x.error?.code === '42703' && !/email_contatto/.test(x.error.message ?? '')
      const leggiTutto = async (contatto: boolean) => {
        // «!persona_id»: schede_iscritti punta a persone due volte (persona_id e cambiata_da), va detto quale.
        let r = await leggi(`${scheda}, certificato_caricato_il, documento_in_segreteria`, contatto)
        // Senza 45-certificati-online.sql ogni file è di prima; e 07-certificati-pagamenti.sql di prima del documento su carta: senza la colonna nuova.
        if (colonnaMancante(r)) r = await leggi(`${scheda}, documento_in_segreteria`, contatto)
        if (colonnaMancante(r)) r = await leggi(scheda, contatto)
        // Un database dove 07-certificati-pagamenti.sql non è ancora passato: l'elenco si vede lo stesso.
        if (r.error?.code === 'PGRST200') r = await leggi(null, contatto)
        return r
      }
      let r0 = await leggiTutto(true)
      // Un database dove 44-email-contatto.sql non è ancora passato: l'elenco si vede lo stesso, senza contatti.
      if (r0.error?.code === '42703' && /email_contatto/.test(r0.error.message ?? '')) r0 = await leggiTutto(false)
      const righe = ok(r0) as unknown as Array<{
        id: string; nome: string; cognome: string; email: string | null; email_contatto?: string | null; telefono: string | null; attiva: boolean; creata_il: string
        iscrizioni: Array<{ corso_id: string; dal: string; al: string | null }>
        schede_iscritti?: Scheda | Scheda[] | null
      }>
      const pagate = await quote
      const natiIl = await nati
      const conSatispay = satispayPerPersona(await leggiSatispay().catch(() => []))
      return righe.map((r): PersonaSeg => {
        // Una a una con la persona: PostgREST la dà come oggetto, ma meglio non contarci.
        const s = Array.isArray(r.schede_iscritti) ? r.schede_iscritti[0] : r.schede_iscritti
        return {
          id: r.id,
          nome: r.nome,
          cognome: r.cognome,
          email: r.email ?? undefined,
          emailContatto: r.email_contatto ?? undefined,
          telefono: r.telefono ?? undefined,
          attiva: r.attiva,
          creataIl: r.creata_il.slice(0, 10),
          iscrizioni: r.iscrizioni.map((i) => ({ corsoId: i.corso_id, dal: i.dal, al: i.al ?? undefined })),
          certificato: {
            scade: s?.certificato_scade ?? undefined,
            conFile: !!s?.certificato_file,
            // Un file senza data di caricamento è di prima della nuova gestione.
            vecchio: !!s?.certificato_file && !s.certificato_caricato_il,
            caricatoIl: s?.certificato_caricato_il?.slice(0, 10),
          },
          documento: !!s?.documento_in_segreteria,
          pagamento: { stato: s?.pagamento ?? 'da_pagare', fino: s?.pagato_fino ?? undefined, nota: s?.pagamento_nota ?? undefined },
          quote: pagate.get(r.id) ?? [],
          satispay: conSatispay.get(r.id),
          natoIl: natiIl.get(r.id),
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
      const contatto = p.emailContatto?.trim() || null
      const scrivi = (campi: Record<string, string | null>) =>
        p.id ? db.from('persone').update(campi).eq('id', p.id) : db.from('persone').insert({ ...campi, ruolo: 'iscritto' }).select('id').single()
      let r = await scrivi({ ...riga, email_contatto: contatto })
      // Un database dove 44-email-contatto.sql non è ancora passato: senza un contatto da salvare si salva come prima.
      if (!contatto && r.error?.code === 'PGRST204' && /email_contatto/.test(r.error.message ?? '')) r = await scrivi(riga)
      // L'email di accesso è di una persona sola: si dice di chi, e che per la famiglia c'è il contatto.
      if (r.error?.code === '23505' && riga.email) {
        // `as`: il client non conosce le colonne scelte con `select`.
        const di = (await db.from('persone').select('nome, cognome').eq('email', riga.email).maybeSingle()).data as { nome: string; cognome: string } | null
        if (di) throw new Error(emailGiaDi(`${di.nome} ${di.cognome}`))
      }
      if (p.id) {
        ok(r)
        return p.id
      }
      // `as`: l'insert con `select('id')` rende la riga nuova, e il client non conosce le colonne scelte.
      return (ok(r) as { id: string }).id
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

    async iscrivi(personaId, corsoId, dal) {
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
      ok(await db.from('iscrizioni').upsert({ persona_id: personaId, corso_id: corsoId, dal: dal ?? g, al: null }, { onConflict: 'corso_id,persona_id' }))
    },

    async termina(personaId, corsoId) {
      ok(await db.from('iscrizioni').update({ al: oggi() }).eq('persona_id', personaId).eq('corso_id', corsoId))
    },

    async salvaCertificato(personaId, scade) {
      const guasto = cosaNonVaScadenza(scade)
      if (guasto) throw new Error(guasto)
      ok(await db.from('schede_iscritti').upsert({ persona_id: personaId, certificato_scade: scade }, { onConflict: 'persona_id' }))
    },

    async caricaCertificato(personaId, file, scade) {
      const guasto = cosaNonVaCertificato(file, scade)
      if (guasto) throw new Error(guasto)
      // Prima il file, poi file e data in un passaggio solo: `salva_certificato` toglie il vecchio.
      const nomeFile = `${personaId}/certificato-${Date.now()}.${ESTENSIONI[file.type]}`
      const su = await db.storage.from(CERTIFICATI).upload(nomeFile, file, { contentType: file.type, upsert: false })
      if (su.error) throw /bucket not found/i.test(su.error.message ?? '') ? new Error(MANCA_CERTIFICATI) : guaioFile(su.error)
      const r = await db.rpc('salva_certificato', { persona: personaId, file: nomeFile, scade })
      if (r.error) {
        // Il file è salito ma la scheda non lo ha: si toglie, se no resta lì senza che nessuno lo ritrovi.
        // Lo Storage non dice di no quando non può cancellare, torna solo meno file: lo si controlla.
        const via = await db.storage.from(CERTIFICATI).remove([nomeFile])
        const causa = guaio(r.error).message
        if (via.error || !via.data?.length) throw new Error(`${causa}. Il file caricato non si è potuto togliere: avvisa chi gestisce il database`)
        throw new Error(causa)
      }
    },

    async togliCertificato(personaId) {
      await cancellaFile(personaId)
      // Anche il giorno di caricamento (45-certificati-online.sql): senza il file non ha senso. Se la colonna non c'è ancora si toglie il resto.
      let r = await db.from('schede_iscritti').update({ certificato_scade: null, certificato_file: null, certificato_caricato_il: null }).eq('persona_id', personaId)
      if (r.error?.code === '42703' || r.error?.code === 'PGRST204') r = await db.from('schede_iscritti').update({ certificato_scade: null, certificato_file: null }).eq('persona_id', personaId)
      ok(r)
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
      // Tutte, come in prova: un tetto qui accorciava l'elenco senza dirlo.
      const leggi = (prima: number, ultima: number) => {
        const q = db.from('ricevute').select(CAMPI_RICEVUTA)
        return (personaId ? q.eq('persona_id', personaId) : q)
          .order('data', { ascending: false })
          .order('anno', { ascending: false })
          .order('numero', { ascending: false })
          .order('id')
          .range(prima, ultima)
      }
      const righe = ok(await tutteLeRighe(leggi)) as unknown as RigaRicevuta[]
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
      const x = await anagrafica(personaId, true)
      return intestatarioDa(u?.intestatario ?? null, x?.dati ?? null, chi)
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

    async tariffe(personaId) {
      // Il client crede che `corsi(nome)` sia un elenco: è un corso solo, perché la riga ha un `corso_id`.
      const righe = ok(await db.from('tariffe_istruttori').select('corso_id, centesimi_ora, corsi(nome)').eq('persona_id', personaId)) as unknown as Array<{
        corso_id: string
        centesimi_ora: number
        corsi: { nome: string } | null
      }>
      return (righe ?? []).map((r) => ({ corsoId: r.corso_id, corso: r.corsi?.nome ?? '', centesimi: r.centesimi_ora }))
    },

    async lettere(personaId) {
      const righe = ok(await db.from('lettere_incarico').select('*').eq('persona_id', personaId).order('creata_il', { ascending: false })) as RigaLettera[] | null
      return (righe ?? []).map(daRigaLettera)
    },

    async faiLettera(l) {
      const no = cosaNonVaLettera(l)
      if (no) throw new Error(no)
      const riga = ok(
        await db.rpc('fai_lettera_incarico', {
          persona: l.personaId,
          stagione: l.stagione,
          dal: l.dal,
          al: l.al,
          qualifica: l.qualifica,
          giorni: l.giorni.trim(),
          data: l.data,
          tariffe: l.tariffe,
          tecnico: l.tecnico,
        }),
      ) as RigaLettera
      return daRigaLettera(riga)
    },

    async ricevuteCompensi(personaId) {
      let q = db.from('ricevute_compensi').select('*')
      if (personaId) q = q.eq('persona_id', personaId)
      const righe = ok(await q.order('mese', { ascending: false }).order('creata_il', { ascending: false })) as RigaRicevutaCompenso[] | null
      return (righe ?? []).map(daRigaRicevutaCompenso)
    },

    async faiRicevutaCompenso(r) {
      const no = cosaNonVaCompenso(r)
      if (no) throw new Error(no)
      const riga = ok(
        await db.rpc('fai_ricevuta_compenso', {
          persona: r.personaId,
          mese: r.mese,
          righe: r.righe.map((x) => ({ corso: x.corso, lezioni: x.lezioni, minuti: x.minuti, centesimi_ora: x.centesimiOra, importo: x.importo })),
          calcolato: r.calcolato,
          importo: r.importo,
          motivo: r.importo === r.calcolato ? null : r.motivo?.trim() || null,
          tecnico: r.tecnico,
          qualifica: r.qualifica,
          data: r.data,
        }),
      ) as RigaRicevutaCompenso
      return daRigaRicevutaCompenso(riga)
    },

    async annullaRicevutaCompenso(id) {
      ok(await db.rpc('annulla_ricevuta_compenso', { id }))
    },

    async pagaCompensi(ids, data, cassaId) {
      ok(await db.rpc('paga_compensi', { ricevute: ids, data, cassa: cassaId }))
    },

    async segnaFirmataCompenso(id, firmata) {
      ok(await db.from('ricevute_compensi').update({ firmata }).eq('id', id))
    },

    async segnaFirmata(letteraId, firmata) {
      ok(await db.from('lettere_incarico').update({ firmata }).eq('id', letteraId))
    },

    async salvaTariffa(personaId, corsoId, centesimi) {
      if (centesimi === null) {
        ok(await db.from('tariffe_istruttori').delete().eq('persona_id', personaId).eq('corso_id', corsoId))
        return
      }
      const no = cosaNonVaTariffa(centesimi)
      if (no) throw new Error(no)
      ok(await db.from('tariffe_istruttori').upsert({ persona_id: personaId, corso_id: corsoId, centesimi_ora: centesimi }, { onConflict: 'persona_id,corso_id' }))
    },

    async emettiRicevuta(r, satispayId) {
      const dati = { ...r, intestatario: pulisciIntestatario(r.intestatario) }
      const no = cosaNonVa(dati)
      if (no) throw new Error(no)
      const riga = ok(
        await db.rpc(satispayId ? 'emetti_ricevuta_satispay' : 'emetti_ricevuta', {
          ...(satispayId ? { pagamento: satispayId } : {}),
          dati: {
            data: dati.data,
            persona_id: dati.personaId ?? null,
            numero: dati.numero ?? null,
            ente: dati.ente,
            intestatario: dati.intestatario,
            voci: dati.voci,
            anticipo: dati.anticipo,
            note: dati.note?.trim() || null,
            chiave: dati.chiave ?? null,
          },
        }),
      ) as RigaRicevuta
      return ricevuta(riga)
    },

    async annullaRicevuta(id) {
      ok(await db.rpc('annulla_ricevuta', { ricevuta: id }))
    },

    async mandaRicevuta(id) {
      // Mai un'eccezione: la ricevuta è già fatta, e quello che manca (file, funzione, posta) diventa un motivo.
      try {
        // `as`: le colonne di CAMPI_RICEVUTA sono quelle di RigaRicevuta, come in `ricevute()` qui sopra.
        const r = ricevuta(ok(await db.from('ricevute').select(CAMPI_RICEVUTA).eq('id', id).single()) as unknown as RigaRicevuta)
        // Lo stesso PDF che si scarica; pdf-lib solo quando serve, come in Ricevute.tsx.
        // La carta intestata se arriva: una mail non si ferma per la grafica.
        const pdf = await (await import('./ricevutaPdf')).ricevutaPdf(r, await (await import('./cartaPdf')).cartaSePuoi())
        let binario = ''
        // A pezzi: String.fromCharCode con tutto il PDF insieme supera gli argomenti che il browser accetta.
        for (let i = 0; i < pdf.length; i += 0x8000) binario += String.fromCharCode(...pdf.subarray(i, i + 0x8000))
        // Nessun indirizzo nel corpo: lo sceglie il database.
        const { data, error } = await db.functions.invoke('ricevuta-email', { body: { ricevuta: id, pdf: btoa(binario) } })
        if (!error) {
          // `as`: il corpo è quello della nostra funzione (supabase/functions/ricevuta-email).
          const x = data as { esito?: string; indirizzo?: string; registrata?: boolean } | null
          if (x?.esito !== 'mandata') return { esito: 'non partita', motivo: 'posta' }
          return { esito: 'mandata', indirizzo: x.indirizzo ?? '', ...(x.registrata === false ? { registrata: false } : {}) }
        }
        // Quando la funzione ha risposto, il suo `tipo` dice il motivo; se no decide l'errore (rete, 404).
        const contesto: unknown = 'context' in error ? error.context : null
        let corpo: unknown = null
        try {
          corpo = contesto instanceof Response ? await contesto.clone().json() : null
        } catch {
          // Non è la nostra risposta.
        }
        return { esito: 'non partita', motivo: motivoDaErrore(corpo && typeof corpo === 'object' && 'tipo' in corpo ? corpo : error) }
      } catch (e) {
        return { esito: 'non partita', motivo: motivoDaErrore(e) }
      }
    },

    async inviiRicevute(personaId) {
      const sue = ok(await db.from('ricevute').select('id').eq('persona_id', personaId)) as Array<{ id: string }>
      if (!sue.length) return []
      const r = await db.from('invii_ricevute').select('ricevuta_id, creato_il, esito, indirizzo, motivo').in('ricevuta_id', sue.map((x) => x.id)).order('creato_il')
      // Senza 76-ricevute-email.sql la tabella non c'è: lo storico non dice niente della mail.
      if (r.error && ['PGRST205', '42P01'].includes(r.error.code)) return []
      // `as`: le colonne scelte qui sopra di invii_ricevute (76-ricevute-email.sql).
      return (ok(r) as Array<{ ricevuta_id: string; creato_il: string; esito: InvioRicevuta['esito']; indirizzo: string; motivo: string | null }>).map((x) => ({
        ricevutaId: x.ricevuta_id,
        creatoIl: x.creato_il,
        esito: x.esito,
        indirizzo: x.indirizzo,
        ...(x.motivo ? { motivo: x.motivo } : {}),
      }))
    },

    async segnaSollecito(personaId) {
      const r = await db.rpc('segna_sollecito', { persona: personaId })
      // Senza 85-solleciti.sql il sollecito si apre lo stesso: solo non resta segnato.
      if (r.error && ['PGRST202', '42883'].includes(r.error.code)) return null
      // `as`: segna_sollecito() in 85-solleciti.sql rende un timestamptz.
      return ok(r) as string
    },

    async ultimiSolleciti() {
      const r = await db.rpc('ultimi_solleciti')
      // Senza 87-solleciti-elenco.sql l'elenco non dice chi è già sollecitato, e basta.
      if (r.error && ['PGRST202', '42883'].includes(r.error.code)) return new Map()
      // `as`: le righe di ultimi_solleciti() in 87-solleciti-elenco.sql, una per persona.
      return new Map((ok(r) as Array<{ persona_id: string; creato_il: string; da: string }>).map((x) => [x.persona_id, { quando: x.creato_il, da: x.da }]))
    },

    async togliSollecito(personaId) {
      const r = await db.rpc('togli_sollecito', { persona: personaId })
      if (r.error && ['PGRST202', '42883'].includes(r.error.code)) throw new Error('«Annulla» non c’è ancora sul database: va lanciato 87-solleciti-elenco.sql.')
      // `as`: togli_sollecito() in 87-solleciti-elenco.sql rende un boolean.
      return ok(r) as boolean
    },

    async genitori() {
      // Senza 18-anagrafiche.sql vale la richiesta, come in `anagrafica()`; ogni altro guaio si dice (una fonte persa cambierebbe chi vince).
      const tutte = async (r: Promise<{ data: unknown[]; error: { code?: string } | null }>) => {
        const { data, error } = await r
        if (error && !['PGRST205', '42P01'].includes(error.code ?? '')) throw new Error('I genitori non si sono letti: controlla la connessione e riprova.')
        return error ? [] : data
      }
      const [an, rich] = await Promise.all([
        tutte(tutteLeRighe((prima, ultima) => db.from('anagrafiche').select(`persona_id, ${CAMPI_ANAGRAFICA}, cambiata_il`).order('persona_id').range(prima, ultima))),
        tutte(
          tutteLeRighe((prima, ultima) =>
            db.from('richieste_iscrizione').select('id, persona_id, genitore_nome, genitore_cognome, gestita_il, creata_il').eq('stato', 'accolta').not('persona_id', 'is', null).order('id').range(prima, ultima),
          ),
        ),
      ])
      // `as`: le righe sono quelle dei select qui sopra.
      type Riga = { persona_id: string; genitore_nome: string | null; genitore_cognome: string | null }
      const riga = (x: Riga, quando: string): RigaGenitore => ({ personaId: x.persona_id, genitoreNome: x.genitore_nome ?? undefined, genitoreCognome: x.genitore_cognome ?? undefined, quando })
      return genitoriDa(
        (rich as Array<Riga & { gestita_il: string | null; creata_il: string }>).map((x) => riga(x, x.gestita_il ?? x.creata_il)),
        // Una riga della segreteria senza nessun dato non conta, come in `anagrafica()`.
        (an as Array<Riga & RigaAnagrafica & { cambiata_il: string }>).map((x) => ({ ...riga(x, x.cambiata_il), vuota: !Object.keys(daRigaAnagrafica(x) ?? {}).length })),
      )
    },

    async ultimoSollecito(personaId) {
      const r = await db.rpc('ultimo_sollecito', { persona: personaId })
      if (r.error && ['PGRST202', '42883'].includes(r.error.code)) return null
      // `as`: le righe di ultimo_sollecito() in 85-solleciti.sql, al più una.
      const u = (ok(r) as Array<{ creato_il: string; da: string }>)[0]
      return u ? { quando: u.creato_il, da: u.da } : null
    },

    async esitiInvioRicevuta(id) {
      const r = await db.rpc('esiti_invio_ricevuta', { ricevuta: id })
      if (r.error && ['PGRST202', '42883'].includes(r.error.code)) return []
      // `as`: le righe di esiti_invio_ricevuta() in 76-ricevute-email.sql, senza indirizzo.
      return (ok(r) as Array<{ creato_il: string; esito: InvioRicevuta['esito'] }>).map((x) => ({ ricevutaId: id, creatoIl: x.creato_il, esito: x.esito }))
    },

    async ricevuteEmailDal() {
      const r = await db.from('impostazioni').select('ricevute_email_dal').maybeSingle()
      // Senza 76-ricevute-email.sql la colonna non c'è.
      if (r.error && r.error.code === '42703') return null
      // `as`: la colonna scelta qui sopra.
      return (ok(r) as { ricevute_email_dal: string | null } | null)?.ricevute_email_dal ?? null
    },

    pagamentiSatispay: leggiSatispay,

    async pagamentiDiretti(personaId) {
      const leggi = (prima: number, ultima: number) => {
        const q = db.from('pagamenti_diretti').select(CAMPI_DIRETTO)
        return (personaId ? q.eq('persona_id', personaId) : q).order('data', { ascending: false }).order('creato_il', { ascending: false }).order('id').range(prima, ultima)
      }
      // `as`: Supabase tipa la riga a modo suo, la forma è quella di `CAMPI_DIRETTO`.
      return (ok(await tutteLeRighe(leggi)) as unknown as RigaPagamentoDiretto[]).map(pagamentoDiretto)
    },

    async nomiPersone(ids) {
      // Cinquecento alla volta: l'elenco va nell'indirizzo, e uno lungo non passa.
      const unici = [...new Set(ids)]
      const fuori: Array<{ id: string; nome: string; cognome: string }> = []
      for (let i = 0; i < unici.length; i += 500) {
        fuori.push(...(ok(await db.rpc('nomi_persone', { ids: unici.slice(i, i + 500) })) as Array<{ id: string; nome: string; cognome: string }>))
      }
      return fuori
    },

    // Le righe arrivano senza tipo dall'API: la forma è quella di 59-contabilita.sql. Per nome, così le casse e le voci
    // escono nello stesso ordine su ogni database (gli id sono a caso) e il giroconto parte sempre da Cassa Contanti.
    async voci() {
      const righe = ok(await tutteLeRighe((prima, ultima) => db.from('voci_contabili').select('*').order('nome').order('id').range(prima, ultima))) as Array<{ id: string; nome: string; tipo: 'entrata' | 'uscita'; di_sistema: boolean; attiva: boolean }>
      return righe.map((r) => ({ id: r.id, nome: r.nome, tipo: r.tipo, diSistema: r.di_sistema, attiva: r.attiva }))
    },

    async casse() {
      const righe = ok(await tutteLeRighe((prima, ultima) => db.from('casse').select('*').order('nome').order('id').range(prima, ultima))) as Array<{ id: string; nome: string; saldo_iniziale: number; dal: string | null }>
      return righe.map((r) => ({ id: r.id, nome: r.nome, saldoIniziale: r.saldo_iniziale, ...(r.dal ? { dal: r.dal } : {}) }))
    },

    async movimenti() {
      const righe = ok(await tutteLeRighe((prima, ultima) => db.from('movimenti').select('*').order('id').range(prima, ultima))) as Array<{
        id: string; tipo: 'entrata' | 'uscita' | 'giroconto'; data: string; importo: number; voce_id: string | null; cassa_id: string; cassa_a_id: string | null
        descrizione: string; nota: string | null; creato_il: string; annullato_il: string | null
        origine_import?: string | null; persona_id?: string | null; dalla_chat?: boolean
      }>
      return righe.map((r) => ({
        id: r.id,
        tipo: r.tipo,
        data: r.data,
        importo: r.importo,
        ...(r.voce_id ? { voceId: r.voce_id } : {}),
        cassaId: r.cassa_id,
        ...(r.cassa_a_id ? { cassaAId: r.cassa_a_id } : {}),
        descrizione: r.descrizione,
        ...(r.nota ? { nota: r.nota } : {}),
        creatoIl: r.creato_il,
        ...(r.annullato_il ? { annullatoIl: r.annullato_il } : {}),
        ...(r.origine_import ? { origineImport: r.origine_import } : {}),
        ...(r.persona_id ? { personaId: r.persona_id } : {}),
        ...(r.dalla_chat ? { dallaChat: true } : {}),
      }))
    },

    async salvaVoce(d) {
      return (ok(await db.rpc('salva_voce', { dati: { nome: d.nome.trim(), tipo: d.tipo } })) as { id: string }).id
    },

    async rinominaVoce(id, nome) {
      ok(await db.rpc('rinomina_voce', { id, nome: nome.trim() }))
    },

    async attivaVoce(id, attiva) {
      ok(await db.rpc('imposta_voce_attiva', { id, attiva }))
    },

    async salvaSaldoCassa(id, saldo, dal) {
      ok(await db.rpc('imposta_saldo_cassa', { id, saldo, dal: dal ?? null }))
    },

    async registraMovimento(d) {
      const riga = ok(
        await db.rpc('registra_movimento', {
          dati: { tipo: d.tipo, data: d.data, importo: d.importo, voce_id: d.voceId, cassa_id: d.cassaId, descrizione: d.descrizione.trim(), nota: d.nota?.trim() || null },
        }),
      ) as { id: string }
      return riga.id
    },

    async registraGiroconto(d) {
      const riga = ok(await db.rpc('registra_giroconto', { dati: { da: d.daCassaId, a: d.aCassaId, data: d.data, importo: d.importo, nota: d.nota?.trim() || null } })) as { id: string }
      return riga.id
    },

    async annullaMovimento(id) {
      ok(await db.rpc('annulla_movimento', { id }))
    },

    async correggiTestoMovimento(id, descrizione, nota) {
      ok(await db.rpc('correggi_testo_movimento', { id, descrizione: descrizione.trim(), nota: nota?.trim() || null }))
    },

    async cambiaVoceMovimenti(ids, voceId) {
      // La risposta arriva senza tipo dall'API: la forma è quella di 67-cambia-voce.sql.
      const r = ok(await db.rpc('cambia_voce_movimenti', { ids, voce: voceId })) as { cambiati: number; gia_cosi: number }
      return { cambiati: r.cambiati, giaCosi: r.gia_cosi }
    },

    async cambiVoceMovimento(id) {
      const righe = ok(await tutteLeRighe((prima, ultima) => db.from('cambi_voce').select('*').eq('movimento_id', id).order('cambiato_il').order('id').range(prima, ultima))) as Array<{
        voce_prima_id: string | null; voce_dopo_id: string | null; cambiato_il: string; cambiato_da: string | null
      }>
      if (!righe.length) return []
      const voci = ok(await tutteLeRighe((prima, ultima) => db.from('voci_contabili').select('id, nome').order('id').range(prima, ultima))) as Array<{ id: string; nome: string }>
      const ids = [...new Set(righe.map((r) => r.cambiato_da).filter((x): x is string => !!x))]
      const persone = ids.length ? (ok(await db.rpc('nomi_persone', { ids })) as Array<{ id: string; nome: string; cognome: string }>) : []
      const voce = (v: string | null) => voci.find((x) => x.id === v)?.nome ?? '—'
      const chi = (v: string | null) => {
        const p = persone.find((x) => x.id === v)
        return p ? `${p.nome} ${p.cognome}` : '—'
      }
      return righe.map((r) => ({ quando: r.cambiato_il, chi: chi(r.cambiato_da), prima: voce(r.voce_prima_id), dopo: voce(r.voce_dopo_id) }))
    },

    // Le risposte arrivano senza tipo dall'API: le forme sono quelle di 70-movimenti-persona.sql.
    async riepilogoCollegamentiPersona() {
      const r = ok(await db.rpc('riepilogo_collegamenti_persona')) as {
        sicuri: { movimenti: number; persone: number; centesimi: number; dal: string | null; al: string | null }
        da_decidere: { movimenti: number; centesimi: number }
        senza_scheda: { movimenti: number; centesimi: number }
        gia_collegati: number
        campione: Array<{ causale: string; persona: string }>
      }
      return { sicuri: r.sicuri, daDecidere: r.da_decidere, senzaScheda: r.senza_scheda, giaCollegati: r.gia_collegati, campione: r.campione }
    },

    async esitiCollegamentiPersona() {
      return (ok(await db.rpc('esiti_collegamenti_persona')) ?? []) as Array<{ id: string; esito: 'sicuro' | 'omonimi' | 'nessuna' }>
    },

    async collegaSicuriPersona(lotto, quanti) {
      return ok(await db.rpc('collega_sicuri_persona', { lotto, quanti })) as { collegati: number; restano: number }
    },

    async collegaMovimentiPersona(ids, persona) {
      const r = ok(await db.rpc('collega_movimenti_persona', { ids, persona })) as { collegati: number; gia_cosi: number }
      return { collegati: r.collegati, giaCosi: r.gia_cosi }
    },

    async scollegaMovimentiPersona(ids) {
      const r = ok(await db.rpc('scollega_movimenti_persona', { ids })) as { scollegati: number; gia_senza: number }
      return { scollegati: r.scollegati, giaSenza: r.gia_senza }
    },

    async togliLottoCollegamenti(lotto) {
      return ok(await db.rpc('togli_lotto_collegamenti', { lotto })) as { tolti: number }
    },

    async candidatiPersonaMovimento(movimento) {
      const righe = (ok(await db.rpc('candidati_persona_movimento', { movimento })) ?? []) as Array<{
        id: string; nome: string; cognome: string; anno_nascita: number | null; corsi: string[] | null; iscritto_dal: string | null
      }>
      return righe.map((r) => ({
        id: r.id,
        nome: r.nome,
        cognome: r.cognome,
        ...(r.anno_nascita ? { annoNascita: r.anno_nascita } : {}),
        corsi: r.corsi ?? [],
        ...(r.iscritto_dal ? { iscrittoDal: r.iscritto_dal } : {}),
      }))
    },

    async storicoPersona(persona) {
      return (ok(await db.rpc('storico_persona', { persona })) ?? []) as Array<{ id: string; data: string; descrizione: string; importo: number; voce: string; cassa: string }>
    },

    async chiusure() {
      // Le righe arrivano senza tipo dall'API: la forma è quella di 60-chiusura-cassa.sql.
      const righe = ok(await tutteLeRighe((prima, ultima) => db.from('chiusure_cassa').select('*').order('data', { ascending: false }).order('id').range(prima, ultima))) as Array<{
        id: string; cassa_id: string; dal: string; data: string; previsto: number; contato: number; differenza: number; nota: string | null
        movimento_id: string | null; chiusa_da: string | null; chiusa_il: string; annullata_il: string | null; annullata_da: string | null
      }>
      // Chi ha chiuso (e chi ha annullato): nome e cognome, e un trattino se la persona non c'è più.
      const ids = [...new Set(righe.flatMap((r) => [r.chiusa_da, r.annullata_da]).filter((x): x is string => !!x))]
      const persone = ids.length ? (ok(await db.rpc('nomi_persone', { ids })) as Array<{ id: string; nome: string; cognome: string }>) : []
      const chi = (id: string | null) => {
        if (!id) return undefined
        const p = persone.find((x) => x.id === id)
        return p ? `${p.nome} ${p.cognome}` : '—'
      }
      return righe.map((r) => ({
        id: r.id,
        cassaId: r.cassa_id,
        dal: r.dal,
        data: r.data,
        previsto: r.previsto,
        contato: r.contato,
        differenza: r.differenza,
        ...(r.nota ? { nota: r.nota } : {}),
        ...(r.movimento_id ? { movimentoId: r.movimento_id } : {}),
        chiusaDa: chi(r.chiusa_da) ?? '—',
        chiusaIl: r.chiusa_il,
        ...(r.annullata_il ? { annullataIl: r.annullata_il } : {}),
        ...(r.annullata_da ? { annullataDa: chi(r.annullata_da) } : {}),
      }))
    },

    async chiudiCassa(d) {
      const riga = ok(await db.rpc('chiudi_cassa', { dati: { cassa_id: d.cassaId, data: d.data, contato: d.contato, nota: d.nota?.trim() || null } })) as { id: string }
      return riga.id
    },

    async annullaChiusuraCassa(id) {
      ok(await db.rpc('annulla_chiusura_cassa', { id }))
    },

    async cercaPagatori(scritto) {
      const righe = ok(await db.rpc('cerca_pagatori', { scritto })) as Array<{ persona_id: string; nome: string; cognome: string }>
      return righe.map((r) => ({ id: r.persona_id, nome: r.nome, cognome: r.cognome }))
    },

    async registraPagamentoDiretto(d: DatiPagamentoDiretto) {
      // Il futuro lo ferma anche qui; il giorno chiuso lo vede solo il database (la segreteria non legge le chiusure).
      const no = cosaNonVaDiretto(d, oggiARoma())
      if (no) throw new Error(no)
      const riga = ok(
        await db.rpc('registra_pagamento_diretto', {
          dati: { persona_id: d.personaId, data: d.data, importo: d.importo, metodo: d.metodo.trim(), voce: d.voce.trim(), nota: d.nota?.trim() || null },
        }),
      ) as RigaPagamentoDiretto
      return pagamentoDiretto(riga)
    },

    async annullaPagamentoDiretto(id) {
      ok(await db.rpc('annulla_pagamento_diretto', { pagamento: id }))
    },

    async enteRicevute() {
      const r = await db.from('impostazioni').select('ricevute').maybeSingle()
      // Senza 16-ricevute.sql la colonna non c'è: valgono quelli scritti nell'app.
      if (r.error?.code === '42703') return ENTE_PREDEFINITO
      return enteDa((ok(r) as { ricevute: Partial<EnteRicevuta> } | null)?.ricevute)
    },

    async salvaEnteRicevute(e) {
      ok(await db.from('impostazioni').update({ ricevute: e }).eq('id', true))
    },

    async avvisiIndirizzi() {
      const r = await db.from('avvisi_indirizzi').select('a, cc').maybeSingle()
      // Senza 84-avvisi-segreteria.sql la tabella non c'è: gli avvisi sono spenti.
      if (r.error?.code === '42P01' || r.error?.code === 'PGRST205') return { a: null, cc: null }
      const x = ok(r) as { a: string | null; cc: string | null } | null
      return { a: x?.a ?? null, cc: x?.cc ?? null }
    },

    async salvaAvvisiIndirizzi(x) {
      const nuovi = indirizziDaSalvare(x)
      ok(await db.from('avvisi_indirizzi').update(nuovi).eq('id', true))
    },

    async avvisiNonMandatiOggi() {
      const r = await db.rpc('avvisi_non_mandati_oggi')
      if (r.error?.code === 'PGRST202' || r.error?.code === '42883') return 0
      return (ok(r) as number | null) ?? 0
    },

    async listino() {
      const r = await db.from('impostazioni').select('listino').maybeSingle()
      // Senza 19-listino.sql la colonna non c'è: vale quello del foglio.
      if (r.error?.code === '42703') return { listino: LISTINO_PREDEFINITO, cambiato: false }
      const l = listinoDa((ok(r) as { listino: unknown } | null)?.listino)
      return l ? { listino: l, cambiato: true } : { listino: LISTINO_PREDEFINITO, cambiato: false }
    },

    async salvaListino(l) {
      const elenco = await this.corsi()
      const pronto = l && agganciaPerNome(l, elenco)
      const g = pronto && cosaNonVaListino(pronto, elenco)
      if (g) throw new Error(g)
      ok(await db.from('impostazioni').update({ listino: pronto }).eq('id', true))
      scordaListino()
    },

    async registro(da, a) {
      const fino = new Date(a)
      fino.setHours(23, 59, 59, 999)
      const adesso = new Date()
      const sessioni = ok(
        await tutteLeRighe((prima, ultima) =>
          db
            .from('sessioni')
            .select('id, corso_id, inizio, stato, istruttore_id, corsi ( nome, istruttore_id ), sale ( nome ), persone ( nome, cognome )')
            .gte('inizio', da.toISOString())
            .lte('inizio', (fino < adesso ? fino : adesso).toISOString())
            .order('inizio')
            .order('id')
            .range(prima, ultima),
        ),
      ) as unknown as Array<{
        id: string; corso_id: string; inizio: string; stato: RigaRegistro['stato']; istruttore_id: string | null
        corsi: { nome: string; istruttore_id: string | null } | null; sale: { nome: string } | null; persone: { nome: string; cognome: string } | null
      }>
      const corsi = [...new Set(sessioni.map((x) => x.corso_id))]
      const vuoto = ['00000000-0000-0000-0000-000000000000']
      const [isc, pres, chi] = await Promise.all([
        tutteLeRighe((prima, ultima) => db.from('iscrizioni').select('corso_id, persona_id, dal, al, persone ( nome, cognome, attiva )').in('corso_id', corsi.length ? corsi : vuoto).order('id').range(prima, ultima)),
        tutteLeRighe((da, fino) => db.from('presenze').select('sessione_id, persona_id, stato').in('sessione_id', sessioni.length ? sessioni.map((x) => x.id) : vuoto).order('id').range(da, fino)),
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

    async statisticheSito(da, a) {
      const { data, error } = await db.functions.invoke('conti-sito', { body: { da, a } })
      if (!error) {
        // `as`: il corpo è quello della nostra funzione, fatto da riassumi() di sitoNumeri.ts.
        const numeri = (data as { numeri?: NumeriSito } | null)?.numeri
        return numeri ? { numeri } : { guaio: 'non-risponde' }
      }
      // Come guaioFunzione, ma il riquadro vuole il tipo del guaio, non una frase: la regola sta in sitoStatistiche.ts.
      // `as`: gli errori di functions.invoke hanno `name` e, quando la funzione ha risposto, la Response in `context`.
      const e = error as { name?: string; context?: unknown }
      const r = e.context instanceof Response ? e.context : null
      let corpo: unknown = null
      try {
        corpo = r ? await r.clone().json() : null
      } catch {
        // Non è la nostra risposta: decide lo stato.
      }
      const rete = typeof navigator === 'undefined' || navigator.onLine
      return { guaio: tipoDaRisposta(r?.status, corpo, e.name, rete) }
    },

    async richiesteDaDove(da, a) {
      const r = await db.rpc('richieste_da_dove', { da: chiaveGiorno(da), a: chiaveGiorno(a) })
      // Senza 74-provenienza-richieste.sql la funzione non c'è: il riquadro lo dice, il resto delle statistiche va.
      if (r.error && (r.error.code === 'PGRST202' || r.error.code === '42883')) return null
      // Le righe di richieste_da_dove() in 74-provenienza-richieste.sql: il client non le conosce.
      const x = ok(r) as { dal: string | null; righe: Array<{ provenienza: string | null; conosciuto: string | null; corsi: string[]; stato: RigaDaDove['stato']; n: number }> }
      return {
        dal: x.dal ?? undefined,
        righe: x.righe.map((y) => ({ ...(y.provenienza ? { provenienza: y.provenienza } : {}), ...(y.conosciuto ? { conosciuto: y.conosciuto } : {}), corsi: y.corsi ?? [], stato: y.stato, n: y.n })),
      }
    },

    async titoliSito() {
      // Mai un errore: senza 56-sito.sql (o senza rete) i nomi restano le parole delle etichette.
      try {
        const [p, r] = await Promise.all([db.from('sito_pagine').select('slug, titolo, titolo_pubblicato'), db.from('sito_redirect').select('da, a')])
        if (p.error || !Array.isArray(p.data)) return {}
        // Le colonne di sito_pagine e sito_redirect in 56-sito.sql: il client non le conosce.
        const pagine = (p.data as Array<{ slug: string; titolo: string; titolo_pubblicato: string | null }>).map((x) => ({ slug: x.slug, titolo: x.titolo_pubblicato || x.titolo }))
        return titoliDelSito(pagine, !r.error && Array.isArray(r.data) ? (r.data as Array<{ da: string; a: string }>) : [])
      } catch {
        return {}
      }
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
        db.from('persone').select('*').in('ruolo', [...RUOLI_DEL_PERSONALE]).order('nome'),
        db.from('corsi_istruttori').select('persona_id, corsi ( nome, attivo )'),
        db.rpc('pin_impostati'),
      ])
      const persone = ok(righe) as Array<{
        id: string; nome: string; cognome: string; email: string | null; ruolo: 'istruttore' | 'staff' | 'amministrazione'; anche_istruttore?: boolean; anche_amministrazione?: boolean; attiva: boolean; utente_id: string | null
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
          ...segniDi(p.ruolo, p.anche_istruttore, p.anche_amministrazione),
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
        if (c && c.ruolo !== 'iscritto') throw new Error('Questa email è già di una persona del personale')
        if (c) {
          ok(await db.from('persone').update({ ...ruolo, attiva: true }).eq('id', c.id))
          return c.id
        }
      }
      // Già in elenco senza email (dall'import, per esempio): gliela si dà, invece di rifarla.
      const senza = ok(
        await db.from('persone').select('id').in('ruolo', [...RUOLI_DEL_PERSONALE]).is('email', null).ilike('nome', riga.nome).ilike('cognome', riga.cognome).limit(1),
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

    async eliminaIstruttore(personaId) {
      const { error } = await db.functions.invoke('elimina', { body: { persona: personaId } })
      if (error) throw await guaioFunzione(error, 'per eliminare', 'L’istruttore non è stato eliminato')
    },

    async anteprimaUnione(resta, via) {
      return ok(await db.rpc('anteprima_unione', { resta, via })) as { presenze: number; prove: number; iscrizioni: number; ricevute: number }
    },

    async unisciPersone(resta, via) {
      ok(await db.rpc('unisci_persone', { resta, via }))
    },

    async indiziDoppioni() {
      // Sono indizi: una tabella che manca (18, 06 o 30 non lanciati) vuol dire nessun indizio, non un errore.
      const oVuoto = <T>(r: { data: T[] | null; error: { code?: string; message?: string } | null }): T[] => {
        if (r.error && ['PGRST205', '42P01'].includes(r.error.code ?? '')) return []
        return ok(r) ?? []
      }
      const [anagrafiche, richieste, coppie] = await Promise.all([
        tutteLeRighe((prima, ultima) => db.from('anagrafiche').select('persona_id, codice_fiscale, nato_il').order('persona_id').range(prima, ultima)).then(oVuoto<{ persona_id: string; codice_fiscale: string | null; nato_il: string | null }>),
        tutteLeRighe((prima, ultima) =>
          db
            .from('richieste_iscrizione')
            .select('persona_id, codice_fiscale, nato_il')
            .eq('stato', 'accolta')
            .not('persona_id', 'is', null)
            .order('gestita_il', { ascending: true, nullsFirst: true })
            .order('id')
            .range(prima, ultima),
        ).then(oVuoto<{ persona_id: string; codice_fiscale: string; nato_il: string }>),
        db.from('non_doppioni').select('a, b').then(oVuoto<{ a: string; b: string }>),
      ])
      const i: IndiziDoppioni = { codiciFiscali: {}, nascite: {}, nonDoppioni: coppie.map((c) => [c.a, c.b]) }
      // Prima il modulo, dal più vecchio; poi la segreteria, che vince.
      for (const r of [...richieste, ...anagrafiche]) {
        if (r.codice_fiscale) i.codiciFiscali[r.persona_id] = r.codice_fiscale
        if (r.nato_il) i.nascite[r.persona_id] = r.nato_il
      }
      return i
    },

    async togliNonDoppioni(a, b) {
      // In qualunque ordine: con `check (a < b)` (33-non-doppioni.sql) le righe che vanno bene sono solo quella coppia.
      ok(await db.from('non_doppioni').delete().in('a', [a, b]).in('b', [a, b]))
    },

    async segnaNonDoppioni(a, b) {
      if (a === b) throw new Error('Scegli due schede diverse')
      ok(await db.from('non_doppioni').upsert({ a, b }, { onConflict: 'a,b', ignoreDuplicates: true }))
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
      type Riga = { id: string; nome: string; link: string; sala_id: string | null; disciplina?: string | null }
      // Senza 40-discipline.sql la colonna non c'è: le liste si leggono senza disciplina.
      const con = await db.from('musica_sale').select('id, nome, link, sala_id, disciplina').order('ordine').order('nome')
      const senza = con.error?.code === '42703' ? await db.from('musica_sale').select('id, nome, link, sala_id').order('ordine').order('nome') : null
      const righe = ok(senza ?? con) as Riga[]
      const discipline = await leggiDiscipline()
      return righe.map((x) => {
        const disciplina = ripulisciDisciplina(x.disciplina, discipline)
        return { id: x.id, nome: x.nome, link: x.link, salaId: x.sala_id, ...(disciplina ? { disciplina } : {}) }
      })
    },

    async salvaListaMusica(l) {
      const nome = l.nome.trim().slice(0, MAX_NOME_LISTA)
      const link = l.link.trim()
      if (!nome) throw new Error('La lista ha bisogno di un nome')
      if (!fonteDelLink(link)) throw new Error(erroreDelLink(link) ?? 'Il link non è una playlist di YouTube o di Spotify, né una radio')
      // Assente = non si tocca; nulla o sconosciuta = nessuna. La colonna c'è con 40-discipline.sql.
      const disciplina = disciplinaDaSalvare(l, await leggiDiscipline())
      const riga = { nome, link, sala_id: l.salaId, ...(disciplina !== undefined ? { disciplina } : {}) }
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
      return eserciziDellaPalestra(r?.esercizi, await leggiDiscipline())
    },

    async salvaEserciziPalestra(l) {
      const lista = eserciziDellaPalestra(l, await leggiDiscipline()) ?? []
      ok(
        await db
          .from('impostazioni')
          .update({ esercizi: lista.map(({ id, nome, disciplina }) => ({ id, nome, ...(disciplina ? { disciplina } : {}) })) })
          .eq('id', true),
      )
    },

    async discipline() {
      return leggiDiscipline()
    },

    async salvaDiscipline(l) {
      ok(await db.from('impostazioni').update({ discipline: disciplineDa(l) }).eq('id', true))
    },

    async presenzeIstruttori(giorni) {
      const da = new Date(Date.now() - giorni * 24 * 60 * 60_000).toISOString()
      const righe = ok(
        await tutteLeRighe((prima, ultima) =>
          db
            .from('presenze_istruttori')
            .select(
              // Con `*`: `come` c'è solo dopo 23-istruttori-dalle-lezioni.sql, e senza si legge lo stesso.
              '*, ' +
                'sessioni ( corso_id, inizio, fine, istruttore_id, stato, corsi ( * ), persone ( nome, cognome ) ), ' +
                'persona:persone!persona_id ( nome, cognome ), gestore:persone!gestita_da ( nome, cognome ), postazioni ( sale ( nome ) )',
            )
            .or(`stato.eq.da_confermare,entrato_il.gte.${da}`)
            .order('entrato_il', { ascending: false })
            .order('id')
            .range(prima, ultima),
        ),
      ) as unknown as Array<{
        id: string
        sessione_id: string
        persona_id: string
        stato: StatoPresenzaIstruttore
        prevista: boolean
        entrato_il: string
        gestita_il: string | null
        come?: ComePresenzaIstruttore
        segnata_da?: string | null
        sessioni: {
          corso_id: string
          inizio: string
          fine: string
          istruttore_id: string | null
          stato: string
          // Con `*`: `basta_uno` c'è solo dopo 82-manca-la-firma.sql.
          corsi: { nome: string; colore: string | null; istruttore_id: string | null; basta_uno?: boolean } | null
          persone: { nome: string; cognome: string } | null
        } | null
        persona: { nome: string; cognome: string } | null
        gestore: { nome: string; cognome: string } | null
        postazioni: { sale: { nome: string } | null } | null
      }>
      const chi = await insegnanti([...new Set(righe.flatMap((r) => (r.sessioni ? [r.sessioni.corso_id] : [])))])
      // Chi ha segnato un collega dall'appello: `segnata_da` c'è solo dopo 46-istruttore-collega.sql, e con `*` si legge lo stesso.
      const daSegnatori = [...new Set(righe.flatMap((r) => (r.segnata_da ? [r.segnata_da] : [])))]
      const segnatori = new Map(
        daSegnatori.length
          ? (ok(await db.from('persone').select('id, nome, cognome').in('id', daSegnatori)) as Array<{ id: string; nome: string; cognome: string }>).map((p) => [p.id, nome(p)])
          : [],
      )
      return righe.flatMap((r): PresenzaIstruttoreSeg[] => {
        const s = r.sessioni
        if (!s) return []
        // Chi doveva farla, come nella settimana: il sostituto, o chi insegna il corso.
        const sostituto = s.istruttore_id && s.istruttore_id !== s.corsi?.istruttore_id
        const delCorso = chi.get(s.corso_id) ?? []
        const previstiElenco = sostituto || !delCorso.length ? (s.istruttore_id ? [{ id: s.istruttore_id, nome: nome(s.persone) }] : []) : delCorso
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
            previsti: previstiElenco.map((x) => x.nome).join(', '),
            sala: r.postazioni?.sale?.nome,
            stato: r.stato,
            prevista: r.prevista,
            entratoIl: r.entrato_il,
            gestitaIl: r.gestita_il ?? undefined,
            gestitaDa: r.gestore ? nome(r.gestore) : undefined,
            come: r.come ?? 'pin',
            segnataDa: r.segnata_da ? segnatori.get(r.segnata_da) : undefined,
            previstiElenco,
            annullata: s.stato === 'annullata',
            bastaUno: s.corsi?.basta_uno ?? false,
          },
        ]
      })
    },

    async segnalazioni() {
      const io = (await db.auth.getSession()).data.session?.user.id
      // Senza 38-segnalazioni-categoria.sql la colonna non c'è: si rilegge senza, e i fili non hanno categoria.
      const leggi = (categoria: string) =>
        tutteLeRighe((prima, ultima) =>
          db.from('segnalazioni').select(`id, padre_id, titolo, testo, scritta_il, chiusa_il, ${categoria}autore:persone!autore_id ( nome, cognome, utente_id )`).order('scritta_il').order('id').range(prima, ultima),
        )
      let letto = await leggi('categoria, ')
      if (letto.error?.code === '42703' && /categoria/.test(letto.error.message ?? '')) letto = await leggi('')
      const righe = ok(letto) as unknown as Array<{
        id: string
        padre_id: string | null
        titolo: string | null
        categoria?: string | null
        testo: string
        scritta_il: string
        chiusa_il: string | null
        autore: { nome: string; cognome: string; utente_id: string | null } | null
      }>
      // Gli allegati sono di 32-segnalazioni-allegati.sql: finché non c'è, i fili si leggono lo stesso, senza.
      // Ogni altro guaio (rete, permessi) si dice: non deve sembrare che non ci siano allegati.
      const [allegati, tolti] = await Promise.all([
        tutteLeRighe((prima, ultima) => db.from('segnalazioni_allegati').select('id, messaggio_id, nome, tipo, peso, autore:persone!autore_id ( utente_id )').order('caricato_il').order('id').range(prima, ultima)),
        tutteLeRighe((prima, ultima) => db.from('segnalazioni_allegati_tolti').select('messaggio_id, tolto_il, tolto:persone!tolto_da ( nome, cognome )').order('tolto_il').order('id').range(prima, ultima)),
      ])
      const manca = (e: { code?: string } | null) => e?.code === 'PGRST205' || e?.code === '42P01' || e?.code === 'PGRST200'
      for (const r of [allegati, tolti]) if (r.error && !manca(r.error)) throw guaio(r.error)
      const per = new Map<string, { allegati: Allegato[]; tolti: { da: string; il: string }[] }>()
      const di = (id: string) => {
        if (!per.has(id)) per.set(id, { allegati: [], tolti: [] })
        return per.get(id) as { allegati: Allegato[]; tolti: { da: string; il: string }[] }
      }
      // Come sopra: il tipo dell'incorporato (`autore`, `tolto`) per Supabase è un array o un oggetto, qui è un oggetto.
      for (const x of (allegati.data ?? []) as unknown as Array<{ id: string; messaggio_id: string; nome: string; tipo: string; peso: number; autore: { utente_id: string | null } | null }>)
        di(x.messaggio_id).allegati.push({ id: x.id, nome: x.nome, tipo: x.tipo, peso: x.peso, mio: !!io && x.autore?.utente_id === io })
      for (const x of (tolti.data ?? []) as unknown as Array<{ messaggio_id: string; tolto_il: string; tolto: { nome: string; cognome: string } | null }>)
        di(x.messaggio_id).tolti.push({ da: nome(x.tolto) || '—', il: x.tolto_il })
      const fili = new Map<string, Segnalazione>()
      for (const r of righe) {
        const m = { id: r.id, autore: nome(r.autore) || '—', mio: !!io && r.autore?.utente_id === io, testo: r.testo, il: r.scritta_il, ...per.get(r.id) }
        if (!r.padre_id) fili.set(r.id, { id: r.id, titolo: r.titolo ?? '', categoria: eCategoria(r.categoria) ? r.categoria : undefined, messaggi: [m], chiusaIl: r.chiusa_il ?? undefined })
        else fili.get(r.padre_id)?.messaggi.push(m)
      }
      return [...fili.values()]
    },

    async apriSegnalazione(titolo, testo, categoria, allegati = []) {
      const no = cosaNonVaSegnalazione(testo, titolo, categoria) ?? guaioAllegati(allegati)
      if (no) throw new Error(no)
      // Come per corsi e persone: `.single()` dà `data` nullo nel tipo, ma `ok` ha già lanciato se non c'è.
      const id = (ok(await db.from('segnalazioni').insert({ titolo: titolo.trim(), testo: testo.trim(), categoria }).select('id').single()) as { id: string }).id
      await allega(id, allegati)
      return id
    },

    async rispondiSegnalazione(id, testo, allegati = []) {
      const no = cosaNonVaSegnalazione(testo) ?? guaioAllegati(allegati)
      if (no) throw new Error(no)
      const nuovo = ok(await db.from('segnalazioni').insert({ padre_id: id, testo: testo.trim() }).select('id').single()) as { id: string }
      await allega(nuovo.id, allegati)
    },

    async togliAllegato(id) {
      // Il file prima, poi la riga: una riga senza file è innocua, un file senza riga resta lì e nessuno lo ritrova.
      // Se il file non si toglie ci si ferma, e la riga resta per riprovare.
      const a = ok(await db.from('segnalazioni_allegati').select('messaggio_id, nome').eq('id', id).maybeSingle()) as { messaggio_id: string; nome: string } | null
      if (a) {
        const { error } = await db.storage.from(ALLEGATI).remove([`${a.messaggio_id}/${a.nome}`])
        if (error) throw guaioFile(error)
      }
      ok(await db.rpc('togli_allegato', { allegato: id }))
    },

    async linkAllegato(id) {
      const a = ok(await db.from('segnalazioni_allegati').select('messaggio_id, nome').eq('id', id).maybeSingle()) as { messaggio_id: string; nome: string } | null
      if (!a) throw new Error('Questo allegato non c’è più')
      const { data, error } = await db.storage.from(ALLEGATI).createSignedUrl(`${a.messaggio_id}/${a.nome}`, DURATA_LINK)
      if (error || !data) throw new Error('Il file non si apre: riprova tra poco')
      return data.signedUrl
    },

    async chiudiSegnalazione(id, chiusa) {
      ok(await db.from('segnalazioni').update({ chiusa_il: chiusa ? new Date().toISOString() : null }).eq('id', id))
    },

    async categoriaSegnalazione(id, categoria: Categoria) {
      if (!eCategoria(categoria)) throw new Error(SCEGLI)
      ok(await db.from('segnalazioni').update({ categoria }).eq('id', id))
    },

    async sitoPagine() {
      const COLONNE = 'id, slug, titolo, descrizione, titolo_pubblicato, descrizione_pubblicata, bozza, pubblicato, nascosta, di_legge, versione, pubblicata_il'
      type Riga = {
        id: string
        slug: string
        titolo: string
        descrizione: string
        titolo_pubblicato: string | null
        descrizione_pubblicata: string | null
        bozza: string
        bozza_pezzi?: unknown
        corsi_collegati?: string[] | null
        pubblicato: string | null
        nascosta: boolean
        di_legge: boolean
        versione: number
        pubblicata_il: string | null
      }
      // Senza `62-sito-pezzi.sql` (o senza `68-sito-orario.sql`) la colonna non c'è (42703): le pagine si leggono lo stesso,
      // tutte col vecchio editor (o senza i corsi collegati). Si toglie la colonna di cui il database si lamenta.
      let conPezzi = true
      let conCorsi = true
      const leggi = () => db.from('sito_pagine').select(`${COLONNE}${conPezzi ? ', bozza_pezzi' : ''}${conCorsi ? ', corsi_collegati' : ''}`).order('slug')
      let risposta = await leggi()
      while (risposta.error?.code === '42703' && (conPezzi || conCorsi)) {
        const m = risposta.error.message ?? ''
        if (conCorsi && /corsi_collegati/.test(m)) conCorsi = false
        else if (conPezzi && /bozza_pezzi/.test(m)) conPezzi = false
        else conPezzi = conCorsi = false
        risposta = await leggi()
      }
      const righe = ok(risposta) as unknown as Riga[]
      return righe.map((r): PaginaSito => ({
        id: r.id,
        slug: r.slug,
        titolo: r.titolo,
        descrizione: r.descrizione,
        titoloPubblicato: r.titolo_pubblicato,
        descrizionePubblicata: r.descrizione_pubblicata,
        bozza: r.bozza,
        // Un valore che non è fatto come i pezzi (scritto da fuori) vale «vecchio editor»: il testo c'è, e si apre.
        ...(conPezzi ? { pezzi: pezziValidi(r.bozza_pezzi) ? r.bozza_pezzi : null } : {}),
        ...(conCorsi ? { corsiCollegati: r.corsi_collegati ?? [] } : {}),
        pubblicato: r.pubblicato,
        nascosta: r.nascosta,
        diLegge: r.di_legge,
        versione: r.versione,
        pubblicataIl: r.pubblicata_il ?? undefined,
      }))
    },

    async sitoMenu() {
      const righe = ok(await db.from('sito_menu').select('dove, etichetta, pagina_id, indirizzo').order('dove').order('ordine')) as unknown as Array<{
        dove: 'menu' | 'footer'
        etichetta: string
        pagina_id: string | null
        indirizzo: string | null
      }>
      const voci = (dove: 'menu' | 'footer'): VoceMenu[] => righe.filter((r) => r.dove === dove).map((r) => ({ etichetta: r.etichetta, paginaId: r.pagina_id, indirizzo: r.indirizzo }))
      return { menu: voci('menu'), footer: voci('footer') }
    },

    async nuovaPaginaSito(titolo, slug, pezzi) {
      if (pezzi && !pezziValidi(pezzi)) throw new Error('I pezzi della pagina non sono fatti come il sito li vuole: ricarica la pagina e riprova')
      const r = await db.from('sito_pagine').insert({ titolo: titolo.trim(), slug, ...(pezzi ? { bozza_pezzi: pezzi, bozza: pezziInHtml(pezzi) } : {}) }).select('id').single()
      // Un indirizzo che è il vecchio di una pagina cambiata: la regola lo ferma come «permesso negato».
      if (r.error?.code === '42501') throw new Error('Questo indirizzo era di una pagina che ha cambiato indirizzo: scegline un altro')
      return (ok(r) as { id: string }).id
    },

    async salvaBozzaSito(id, versione, dati) {
      return ok(await db.rpc('salva_bozza_sito', { p_id: id, p_versione: versione, p_titolo: dati.titolo.trim(), p_descrizione: dati.descrizione.trim(), p_bozza: dati.bozza })) as number
    },

    async salvaBozzaPezziSito(id, versione, dati) {
      if (!pezziValidi(dati.pezzi)) throw new Error('I pezzi della pagina non sono fatti come il sito li vuole: ricarica la pagina e riprova')
      return ok(
        await db.rpc('salva_bozza_pezzi_sito', { p_id: id, p_versione: versione, p_titolo: dati.titolo.trim(), p_descrizione: dati.descrizione.trim(), p_bozza: pezziInHtml(dati.pezzi), p_pezzi: dati.pezzi }),
      ) as number
    },

    async pubblicaPaginaSito(id, versione) {
      const v = ok(await db.rpc('pubblica_pagina_sito', { p_id: id, p_versione: versione })) as number
      void rigeneraSito()
      return v
    },

    async cambiaIndirizzoSito(id, slug) {
      ok(await db.rpc('cambia_indirizzo_sito', { p_id: id, p_slug: slug }))
      void rigeneraSito()
    },

    async nascondiPaginaSito(id, nascosta) {
      // Senza `select`, una pagina che non c'è più (o di legge) darebbe 0 righe e nessun errore: sembrerebbe fatto.
      const fatte = ok(await db.from('sito_pagine').update({ nascosta }).eq('id', id).select('id')) as unknown as unknown[]
      if (!fatte.length) throw new Error('La pagina non c’è più')
      void rigeneraSito()
    },

    async collegaCorsiSito(id, corsi) {
      ok(await db.rpc('salva_corsi_sito', { p_id: id, p_corsi: corsi }))
      // Cambia l'orario del sito, non il testo della pagina: il sito si rigenera lo stesso.
      void rigeneraSito()
    },

    async cancellaPaginaSito(id) {
      // Come sopra: una pagina di legge o già cancellata dà 0 righe, e va detto.
      const fatte = ok(await db.from('sito_pagine').delete().eq('id', id).select('id')) as unknown as unknown[]
      if (!fatte.length) throw new Error('Questa pagina non si cancella: o non c’è più, o è una pagina di legge')
      void rigeneraSito()
    },

    async salvaMenuSito(dove, voci) {
      ok(await db.rpc('salva_menu_sito', { p_dove: dove, p_voci: voci.map((v) => ({ etichetta: v.etichetta, pagina_id: v.paginaId, indirizzo: v.indirizzo })) }))
      void rigeneraSito()
    },

    async sitoImmagini() {
      // Mille bastano a un sito di palestra; oltre, le più vecchie non comparirebbero.
      const { data, error } = await db.storage.from(CONTENITORE_SITO).list('', { limit: 1000, sortBy: { column: 'created_at', order: 'desc' } })
      if (error) throw immaginiNonAttive(error)
      return (data ?? []).filter((f) => eNomeDelContenitore(f.name)).map((f) => ({ nome: f.name, url: urlImmagine(URL_SUPABASE ?? '', f.name) }))
    },

    async orariSito() {
      // as: il client non conosce le colonne di orari_sito(); la forma la dà 69-orari-sito.sql.
      return ok(await db.rpc('orari_sito')) as OrarioSito[]
    },

    async caricaImmagineSito(file) {
      // Il tipo si controlla prima di rimpicciolire: un SVG non diventa una foto.
      const noTipo = controllaImmagine({ type: file.type, size: 0 })
      if (noTipo) throw new Error(noTipo)
      // Fino a 1 MB resta com'è (anche una PNG con la trasparenza); più grande si rimpicciolisce in JPEG.
      const pronta = file.size <= MASSIMO_BYTE ? file : await riduciFoto(file, { basta: MASSIMO_BYTE, sempreJpeg: true })
      const no = controllaImmagine(pronta)
      const nome = nomeNelContenitore(crypto.randomUUID(), pronta.type)
      if (no || !nome) throw new Error(no ?? cosaNonVaImmagini(''))
      const { error } = await db.storage.from(CONTENITORE_SITO).upload(nome, pronta, { contentType: pronta.type, upsert: false })
      if (error) throw immaginiNonAttive(error)
      return { nome, url: urlImmagine(URL_SUPABASE ?? '', nome) }
    },

    async cancellaImmagineSito(nome) {
      const { data, error } = await db.storage.from(CONTENITORE_SITO).remove([nome])
      if (error) throw immaginiNonAttive(error)
      if (!data?.length) throw new Error('Questa immagine non si cancella: o non c’è più, o non hai il permesso')
    },

    async gestisciPresenzaIstruttore(id, conferma) {
      ok(await db.rpc('gestisci_presenza_istruttore', { presenza: id, conferma }))
    },

    async eliminaPresenzaIstruttore(id) {
      ok(await db.rpc('elimina_presenza_istruttore', { presenza: id }))
    },

    async lezioniSenzaIstruttore() {
      return daSenzaIstruttore({ data: ok(await db.rpc('lezioni_senza_istruttore')), error: null })
    },

    async segnaIstruttoriLezione(sessioneId, presenti) {
      ok(await db.rpc('segna_istruttori_lezione', { sessione: sessioneId, presenti }))
    },

    async segnaIstruttorePrevisto(sessioneId, personaId) {
      ok(await db.rpc('segna_istruttore_previsto', { sessione: sessioneId, persona: personaId }))
    },

    async segnaIstruttoreAssente(sessioneId, personaId) {
      ok(await db.rpc('segna_istruttore_assente', { sessione: sessioneId, persona: personaId }))
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

    async contaDateCorsi(inizio, fine) {
      return dateCorsi(inizio, fine, true)
    },

    async salvaDateCorsi(inizio, fine) {
      return dateCorsi(inizio, fine, false)
    },

    async scadute(mesi) {
      // Coi mesi salvati conta la vista, la stessa che usa la pulizia; con
      // altri mesi si conta da qui, senza salvarli. Il limite viene
      // dall'orologio del dispositivo: al più un giorno di scarto dal server,
      // e CANCELLA ORA riconta comunque.
      const limite = new Date()
      if (mesi !== undefined) limite.setMonth(limite.getMonth() - mesi)
      const { count, error } =
        mesi === undefined
          ? await db.from('presenze_scadute').select('id', { count: 'exact', head: true })
          : await db.from('presenze').select('id, sessioni!inner ( inizio )', { count: 'exact', head: true }).lt('sessioni.inizio', limite.toISOString())
      if (error) throw guaio(error)
      return count ?? 0
    },

    async pulisci() {
      return ok(await db.rpc('pulisci_presenze')) as number
    },

    async esporta(personaId) {
      const [persona, isc, pres, rich, scheda, ric, dir, anag, lett, comp] = await Promise.all([
        db.from('persone').select('nome, cognome, email, telefono, ruolo, attiva, creata_il').eq('id', personaId).single(),
        db.from('iscrizioni').select('dal, al, corsi ( nome )').eq('persona_id', personaId),
        tutteLeRighe((prima, ultima) => db.from('presenze').select('stato, origine, segnata_il, sessioni ( inizio, corsi ( nome ) )').eq('persona_id', personaId).order('id').range(prima, ultima)),
        // Le richieste dal modulo di iscrizione: i file restano nello Storage, qui c'è quali sono.
        db.from('richieste_iscrizione').select('creata_il, stato, nome, cognome, nato_il, nato_a, codice_fiscale, indirizzo, cap, comune, email, telefono, genitore_nome, genitore_cognome, genitore_codice_fiscale, corsi, formula, note, gestita_il').eq('persona_id', personaId),
        // Il certificato (la scadenza; il foglio è su carta), il documento e il
        // pagamento: tutta la riga, che c'è o no la colonna del documento.
        db.from('schede_iscritti').select('*').eq('persona_id', personaId).maybeSingle(),
        // Le ricevute: col socio e le voci così come sono stampate.
        db.from('ricevute').select('anno, numero, data, intestatario, voci, totale, pagato, anticipo, note, creata_il, annullata_il').eq('persona_id', personaId),
        // I pagamenti fatti a mano.
        db.from('pagamenti_diretti').select('data, importo, metodo, voce, nota, creato_il, annullato_il').eq('persona_id', personaId),
        // Nascita, residenza e genitore di chi è entrato dall'import.
        db.from('anagrafiche').select(`${CAMPI_ANAGRAFICA}, cambiata_il`).eq('persona_id', personaId).maybeSingle(),
        // Le lettere d'incarico di un tecnico, coi dati copiati dentro.
        db.from('lettere_incarico').select('stagione, dal, al, qualifica, giorni, data, tariffe, tecnico, firmata, sostituita_il, creata_il').eq('persona_id', personaId),
        // Le ricevute dei compensi di un tecnico, coi dati copiati dentro.
        // Tutta la riga (con `pagata_il`, che arriva con l'81); gli id interni si tolgono sotto.
        db.from('ricevute_compensi').select('*').eq('persona_id', personaId),
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
        // Senza 54-pagamenti-diretti.sql non ce ne sono.
        pagamenti_a_mano: dir.error?.code === '42P01' || dir.error?.code === 'PGRST205' ? [] : ok(dir),
        // Senza 18-anagrafiche.sql non ce n'è.
        dati_anagrafici: anag.error?.code === '42P01' || anag.error?.code === 'PGRST205' ? null : ok(anag),
        // Senza 79-lettere-incarico.sql non ce ne sono.
        lettere_incarico: lett.error?.code === '42P01' || lett.error?.code === 'PGRST205' ? [] : ok(lett),
        // Senza 80-ricevute-compensi.sql non ce ne sono.
        ricevute_compensi:
          comp.error?.code === '42P01' || comp.error?.code === 'PGRST205'
            ? []
            : ((ok(comp) ?? []) as Array<Record<string, unknown>>).map(({ id: _i, persona_id: _p, movimento_id: _m, creata_da: _c, ...r }) => r),
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
