import type { StatoPresenza, StatoSessione } from './sala'
import { chiaveGiorno, dataLunga, oraDi } from './sala'
import type { RuoloPersonale } from './ruoli'
import { haUnServer } from './dati'
import type { ListaMusica } from './musica'
import type { Esercizio } from '../../timer/src/lib/esercizi'
import type { Disciplina } from '../../timer/src/lib/discipline'
import type { StatoPresenzaIstruttore } from './tablet'
import type { DatiRicevuta, EnteRicevuta, IntestatarioRicevuta, QuotaRicevuta, Ricevuta } from './ricevute'
import { euro } from './ricevute'
import { VALIDITA } from './costi'
import { ESTENSIONI, MASSIMO_FILE } from './richieste'
import type { Listino, ListinoLetto } from './listino'
import { nomeProprio, paroleCercate, somiglia } from './nomi'
import type { SegnalataVista } from './segnalate'
import type { Categoria, Segnalazione } from './segnalazioni'

export type { ListaMusica } from './musica'
import type { IndiziDoppioni } from './doppioni'

/**
 * La segreteria: il calendario della settimana, i corsi con i loro orari, gli
 * iscritti.
 *
 * Come il resto dell'app, due implementazioni dietro la stessa interfaccia:
 * `segreteriaProva` cambia l'archivio di prova sul dispositivo,
 * `segreteriaSupabase` scrive sul database, dove le policy lasciano scrivere
 * solo chi ha il ruolo `staff` e le funzioni di `05-segreteria.sql` fanno
 * seguire alle lezioni i cambi dei corsi.
 */

export interface Sala {
  id: string
  nome: string
  capienza?: number
}

export interface Istruttore {
  id: string
  nome: string
}

export interface RicorrenzaSeg {
  id: string
  /** 0 = domenica, come `getDay()`. */
  giorno: number
  ora: string
  durata: number
  dal: string
  al?: string
  /** La sala di questo giorno, quando non è quella del corso. */
  salaId?: string
  sala?: string
  /** Cosa si fa in questo giorno (vedi `AttivitaSeg`); le lezioni future lo seguono. */
  attivitaId?: string
  attivita?: string
}

export interface CorsoSeg {
  id: string
  nome: string
  colore?: string
  /** La sala di partenza: quella dei giorni che non ne hanno una loro. */
  salaId?: string
  sala?: string
  /** Chi lo insegna; il primo è quello di riferimento. */
  istruttori: Istruttore[]
  capienza?: number
  attivo: boolean
  /** Solo quelle ancora in corso o future: quelle chiuse restano nel registro. */
  ricorrenze: RicorrenzaSeg[]
}

export interface LezioneSeg {
  id: string
  corsoId: string
  corso: string
  colore?: string
  salaId?: string
  sala?: string
  /** Il sostituto, se c'è: vale solo per questa lezione. */
  sostitutoId?: string
  /** Cosa si fa in questa lezione: quella del giorno, o una scelta a mano. */
  attivitaId?: string
  attivita?: string
  /** L'attività è stata scelta a mano, diversa da quella del giorno: il giorno che cambia non la tocca. */
  attivitaCambiata?: boolean
  /** Chi la fa: il sostituto, o chi insegna il corso. */
  istruttori: string
  inizio: string
  fine: string
  stato: StatoSessione
  straordinaria: boolean
  iscritti: number
  capienza?: number
  presenti: number
  /** Quanti hanno un segno qualsiasi: zero vuol dire che l'appello non c'è. */
  segnati: number
}

/** Una voce dell'elenco «Attività», con su quanti giorni e quante lezioni è. */
export interface AttivitaSeg {
  id: string
  nome: string
  /** Fuori uso: resta dov'è già, ma non si offre più nei menu. */
  attiva: boolean
  giorni: number
  lezioni: number
}

export interface IscrizioneSeg {
  corsoId: string
  dal: string
  al?: string
}

export interface PersonaSeg {
  id: string
  nome: string
  cognome: string
  email?: string
  telefono?: string
  attiva: boolean
  creataIl: string
  /** La data di nascita, se si sa: sotto i 6 anni il certificato non si chiede. */
  natoIl?: string
  /** Anche quelle terminate: dicono da quando a quando. */
  iscrizioni: IscrizioneSeg[]
  certificato: CertificatoSeg
  /** La copia del documento d'identità (per un minore, quello del genitore) è in segreteria, su carta. */
  documento: boolean
  /** Pagato fuori dall'app: l'eccezione scritta a mano (vedi `pagamentoDi`). */
  pagamento: PagamentoSeg
  /** Le quote associative delle sue ricevute non annullate: da qui si sa se ha pagato. */
  quote?: QuotaRicevuta[]
  /** Il titolare del nucleo familiare di cui fa parte, per id (vedi `nucleo.ts`). Solo in prova, per ora. */
  nucleo?: string
}

/**
 * Il certificato medico: fino a quando vale, e il file caricato nell'app, che
 * apre solo la segreteria. La data la scrive la segreteria leggendo il foglio.
 */
export interface CertificatoSeg {
  scade?: string
  conFile: boolean
  /** Il file è di prima della nuova gestione (senza data di caricamento): si apre come gli altri. */
  vecchio?: boolean
  /** Il giorno in cui il file è stato caricato. Resta anche dopo che il file è stato cancellato (a scadenza + 30 giorni, o con la disattivazione): dice che un file c'è stato. */
  caricatoIl?: string
}

export type StatoPagamento = 'da_pagare' | 'in_parte' | 'pagato'

/**
 * Il pagamento scritto a mano: da quando lo stato si ricava dalle ricevute,
 * è l'eccezione per chi ha pagato la quota fuori dall'app (prima dell'app,
 * con una ricevuta di carta). `da_pagare` vuol dire nessuna eccezione.
 */
export interface PagamentoSeg {
  stato: StatoPagamento
  /** Fin quando vale l'eccezione; senza, fino alla fine della stagione (`VALIDITA.quota.al`). */
  fino?: string
  nota?: string
}

/**
 * Nascita, residenza e genitore di chi è entrato dall'import del modulo
 * Google, che una richiesta di iscrizione non ce l'ha (`18-anagrafiche.sql`).
 * Ogni campo può mancare: il modulo di prima non chiedeva tutto.
 */
export interface Anagrafica {
  /** `AAAA-MM-GG`. */
  natoIl?: string
  natoA?: string
  codiceFiscale?: string
  indirizzo?: string
  cap?: string
  comune?: string
  genitoreNome?: string
  genitoreCognome?: string
  genitoreCodiceFiscale?: string
  /** Luogo e data di nascita del genitore, come sono scritti nel modulo. */
  genitoreNato?: string
}

/** I dati anagrafici di una persona e da dove vengono: dal modulo dell'app o dall'import. */
export interface AnagraficaDi {
  dati: Anagrafica
  /** `segreteria`: dall'import o corretti dalla scheda (`anagrafiche`). */
  da: 'modulo' | 'segreteria'
}

/** I limiti di `anagrafiche` (18-anagrafiche.sql), detti prima di salvare. `null` se va bene. */
export function cosaNonVaAnagrafica(a: Anagrafica, oggi = chiaveGiornoOggi()): string | null {
  if (a.natoIl && (!/^\d{4}-\d{2}-\d{2}$/.test(a.natoIl) || Number.isNaN(Date.parse(a.natoIl)) || a.natoIl > oggi)) return 'La data di nascita non è giusta'
  if (a.codiceFiscale && !/^[A-Z0-9]{16}$/.test(a.codiceFiscale)) return 'Il codice fiscale ha sedici lettere e cifre'
  if (a.genitoreCodiceFiscale && !/^[A-Z0-9]{16}$/.test(a.genitoreCodiceFiscale)) return 'Il codice fiscale del genitore ha sedici lettere e cifre'
  if (a.cap && !/^\d{5}$/.test(a.cap)) return 'Il CAP ha cinque cifre'
  const lunghi: Array<[keyof Anagrafica, number, string]> = [
    ['natoA', 80, 'Il luogo di nascita'], ['comune', 80, 'Il comune'], ['indirizzo', 160, "L'indirizzo"],
    ['genitoreNome', 80, 'Il nome del genitore'], ['genitoreCognome', 80, 'Il cognome del genitore'], ['genitoreNato', 120, 'La nascita del genitore'],
  ]
  for (const [k, n, cosa] of lunghi) if ((a[k]?.length ?? 0) > n) return `${cosa} è troppo lungo: al massimo ${n} caratteri`
  return null
}

/** Come si salva: spazi in più via, il nome del genitore come un nome, i codici fiscali in maiuscolo e senza spazi. */
export function pulisciAnagrafica(a: Anagrafica): Anagrafica {
  const x: Record<string, string> = {}
  for (const [k, v] of Object.entries(a)) if (typeof v === 'string' && v.trim()) x[k] = v.trim().replace(/\s+/g, ' ')
  for (const k of ['codiceFiscale', 'genitoreCodiceFiscale', 'cap']) if (x[k]) x[k] = x[k].toUpperCase().replace(/\s/g, '')
  for (const k of ['genitoreNome', 'genitoreCognome']) if (x[k]) x[k] = nomeProprio(x[k])
  return x as Anagrafica
}

const chiaveGiornoOggi = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Un file da aprire: il link vale poco, col database dieci minuti. */
export interface FileSeg {
  url: string
  pdf: boolean
}

export interface Frequenza {
  presenti: number
  dovute: number
}

export interface StoricoSeg {
  sessioneId: string
  inizio: string
  corso: string
  stato: StatoPresenza | null
}

export interface DatiCorso {
  id?: string
  nome: string
  salaId?: string
  istruttori: string[]
  capienza?: number
  colore?: string
}

/** Una lezione passata con il suo appello, per il resoconto delle presenze. */
export interface RigaRegistro {
  sessioneId: string
  corsoId: string
  corso: string
  sala?: string
  istruttori: string
  inizio: string
  stato: StatoSessione
  /** Gli iscritti di quel giorno, con il loro segno. */
  appello: Array<{ personaId: string; nome: string; cognome: string; stato: StatoPresenza | null }>
}

/** Chi è venuto a provare una lezione, per richiamarlo (21-prove.sql). */
export interface ProvaSeg {
  sessioneId: string
  personaId: string
  nome: string
  cognome: string
  telefono?: string
  corsoId: string
  corso: string
  inizio: string
  /** Chi l'ha aggiunta all'appello, quando si sa. */
  da?: string
  /** Da allora si è iscritto a un corso. */
  iscritto: boolean
}

/**
 * Una lezione già cominciata, coi suoi numeri: per STATISTICHE, che guarda
 * mesi interi e non vuole l'appello nome per nome (22-statistiche.sql).
 */
export interface LezioneStat {
  sessioneId: string
  corsoId: string
  corso: string
  colore?: string
  capienza?: number
  sala?: string
  inizio: string
  stato: StatoSessione
  /** Chi l'ha fatta: il sostituto, o chi insegna il corso. */
  istruttori: string[]
  sostituto: boolean
  /** Gli iscritti di quel giorno, e i loro segni: zero segni vuol dire che l'appello non c'è. */
  iscritti: number
  presenti: number
  assenti: number
  giustificati: number
  /** Presenti senza essere iscritti: chi è venuto a provare. */
  prove: number
}

/** Le ricevute di un mese, senza le annullate. Importi in centesimi. */
export interface IncassoMese {
  /** `AAAA-MM`. */
  mese: string
  ricevute: number
  totale: number
  pagato: number
}

export interface Statistiche {
  lezioni: LezioneStat[]
  /** `null` dove le ricevute non ci sono (16-ricevute.sql). */
  incassi: IncassoMese[] | null
}

export interface PersonaleSeg {
  id: string
  nome: string
  cognome: string
  email?: string
  ruolo: 'istruttore' | 'staff'
  /** Di segreteria, e insegna anche: vedi `ruoli.ts`. */
  ancheIstruttore: boolean
  attiva: boolean
  /** Ha già fatto l'accesso almeno una volta: il suo account è legato. */
  collegato: boolean
  haPin: boolean
  corsi: string[]
  /** Il suo segno, per riconoscerlo a colpo d'occhio (vedi `kanji.ts`). */
  kanji?: string
}

/** Un timer arrivato in fondo (o fermato prima), sul tablet o sul telefono di un istruttore. */
export interface AllenamentoSeg {
  id: string
  nome: string
  finitoIl: string
  secondi: number
  completato: boolean
  /** La lezione in cui è partito, se c'era: il corso. */
  corso?: string
  /** Chi l'ha fatto partire: un istruttore, o il tablet di una sala. */
  chi: string
}

/**
 * Un istruttore entrato col PIN sul tablet di una sala durante una lezione:
 * confermata da sola se era previsto, se no da confermare qui.
 */
export interface PresenzaIstruttoreSeg {
  id: string
  sessioneId: string
  corso: string
  colore?: string
  inizio: string
  fine: string
  personaId: string
  nome: string
  /** Chi doveva farla: il sostituto, o chi insegna il corso. */
  previsti: string
  /** La sala del tablet su cui ha messo il PIN. */
  sala?: string
  stato: StatoPresenzaIstruttore
  /** Era previsto quando è entrato: la conferma è arrivata da sola. */
  prevista: boolean
  entratoIl: string
  gestitaIl?: string
  gestitaDa?: string
  /** Come è arrivata: dal PIN, dall'appello che ha fatto, o scelta dalla segreteria fra i previsti. */
  come: ComePresenzaIstruttore
}

export type ComePresenzaIstruttore = 'pin' | 'appello' | 'segreteria'

/**
 * Una lezione tenuta (passata, con qualcuno presente) in cui nessun
 * istruttore ha una presenza: la segreteria sceglie chi c'era fra i previsti
 * (23-istruttori-dalle-lezioni.sql).
 */
export interface LezioneSenzaIstruttore {
  sessioneId: string
  corso: string
  colore?: string
  inizio: string
  fine: string
  sala?: string
  presenti: number
  /** Chi doveva farla; `stato` se ha già una presenza, col PIN o dall'appello. */
  previsti: Array<{ id: string; nome: string; stato?: StatoPresenzaIstruttore }>
}

export interface Impostazioni {
  mesiPresenze: number
  giorniCalendario: number
  /**
   * Il primo e l'ultimo giorno dei corsi, `AAAA-MM-GG`, o `null` se non
   * scritti. Con la fine il calendario si prepara fino a lì invece che per
   * `giorniCalendario`. `undefined` quando il database non li ha ancora
   * (`12-calendario-da-se.sql` da rilanciare).
   */
  inizioCorsi?: string | null
  fineCorsi?: string | null
}

export interface DatiPersona {
  id?: string
  nome: string
  cognome: string
  email?: string
  telefono?: string
}

export interface DatiSegreteria {
  readonly modo: 'prova' | 'supabase'

  sale(): Promise<Sala[]>
  istruttori(): Promise<Istruttore[]>

  /** Le lezioni fra due giorni, estremi inclusi, anche annullate. */
  settimana(da: Date, a: Date): Promise<LezioneSeg[]>
  aggiornaLezione(
    sessioneId: string,
    cambi: { stato?: StatoSessione; sostitutoId?: string | null; salaId?: string | null; attivitaId?: string | null },
  ): Promise<void>
  /** La lezione torna all'attività del suo giorno. */
  attivitaComeIlGiorno(sessioneId: string): Promise<void>
  /** Una lezione in più, fuori dalle ricorrenze. */
  straordinaria(corsoId: string, inizio: Date, durata: number): Promise<void>
  /** Toglie una lezione straordinaria; quelle con un appello restano. */
  togliLezione(sessioneId: string): Promise<void>
  /** Fin dove è pronto il calendario, e lo allunga di due mesi da oggi. */
  prontoFino(): Promise<string | null>
  rigenera(): Promise<number>

  corsi(): Promise<CorsoSeg[]>
  salvaCorso(c: DatiCorso): Promise<string>
  archiviaCorso(corsoId: string, attivo: boolean): Promise<void>
  /** `rigenera: false` quando se ne aggiungono tante e il calendario si allunga dopo, una volta sola. */
  aggiungiRicorrenza(corsoId: string, r: { giorno: number; ora: string; durata: number; salaId?: string; attivitaId?: string }, opzioni?: { rigenera?: boolean }): Promise<void>
  /** Un giorno in un'altra sala; `null` lo rimette nella sala del corso. Le lezioni future lo seguono. */
  salaRicorrenza(ricorrenzaId: string, salaId: string | null): Promise<void>
  /** Un'attività per un giorno; `null` la toglie. Le lezioni future che la seguivano la cambiano con lui. */
  attivitaRicorrenza(ricorrenzaId: string, attivitaId: string | null): Promise<void>
  /**
   * L'elenco delle attività, in ordine. `manca` dice quale file va lanciato
   * quando il database non ce l'ha ancora: l'elenco è vuoto e nessuna lezione ne ha una.
   */
  attivita(): Promise<{ elenco: AttivitaSeg[]; manca?: string }>
  /** Una nuova, o con `id` la rinomina (una riga: il nome nuovo si vede ovunque). Dà l'id. */
  salvaAttivita(a: { id?: string; nome: string }): Promise<string>
  attivaAttivita(id: string, attiva: boolean): Promise<void>
  /** Solo una mai usata: se è su un giorno o su una lezione, il motivo dice cosa fare. */
  eliminaAttivita(id: string): Promise<void>
  togliRicorrenza(ricorrenzaId: string): Promise<void>

  persone(): Promise<PersonaSeg[]>
  /** Negli ultimi trenta giorni, per persona. */
  frequenze(): Promise<Map<string, Frequenza>>
  storico(personaId: string, quante: number): Promise<StoricoSeg[]>
  salvaPersona(p: DatiPersona): Promise<string>
  attivaPersona(personaId: string, attiva: boolean): Promise<void>
  /** `dal`: da quando, se non è oggi (l'import dei fogli usa il giorno della risposta). Vale per un'iscrizione nuova o ripresa, non per una in corso. */
  iscrivi(personaId: string, corsoId: string, dal?: string): Promise<void>
  termina(personaId: string, corsoId: string): Promise<void>
  /** Solo la data di scadenza del certificato: il file, se c'è, resta. */
  salvaCertificato(personaId: string, scade: string): Promise<void>
  /**
   * Il file del certificato e la data insieme, in un gesto solo: il file nuovo
   * prende il posto del vecchio, che si cancella. Se qualcosa non va non cambia niente.
   */
  caricaCertificato(personaId: string, file: File, scade: string): Promise<void>
  /** Toglie la data e il file. */
  togliCertificato(personaId: string): Promise<void>
  /** Il file del certificato, o `null` se non c'è: il link vale dieci minuti. */
  apriCertificato(personaId: string): Promise<FileSeg | null>
  /** Se la copia del documento d'identità è in segreteria. */
  salvaDocumento(personaId: string, inSegreteria: boolean): Promise<void>
  salvaPagamento(personaId: string, p: PagamentoSeg): Promise<void>

  /**
   * Il nucleo familiare (vedi `nucleo.ts`): mette una persona nel nucleo di
   * un titolare, la toglie, o la fa titolare al posto di quello di prima.
   * Solo in prova, per ora: col database rispondono che non c'è ancora.
   */
  /** Le presenze segnalate dagli iscritti (vedi `segnalate.ts`); per ora solo in prova, col database non ci sono. */
  segnalate?(): Promise<SegnalataVista[]>
  gestisciSegnalata?(id: string, accogli: boolean): Promise<void>
  /** Le segnalazioni della segreteria, coi loro messaggi (vedi `segnalazioni.ts`). */
  segnalazioni(): Promise<Segnalazione[]>
  /** Apre una segnalazione e dice il suo id, così il filo nuovo si apre da sé. */
  apriSegnalazione(titolo: string, testo: string, categoria: Categoria, allegati?: File[]): Promise<string>
  /** Con `allegati`, se qualche file non parte il messaggio c'è lo stesso: lancia `AllegatiNonPartiti`. */
  rispondiSegnalazione(id: string, testo: string, allegati?: File[]): Promise<void>
  /** Toglie un allegato (solo chi l'ha mandato): file e riga, e nel filo resta la traccia. */
  togliAllegato(id: string): Promise<void>
  /** Un link per aprire un allegato: scade presto, se ne chiede uno nuovo ogni volta. */
  linkAllegato(id: string): Promise<string>
  /** La chiude, o con `false` la riapre. */
  chiudiSegnalazione(id: string, chiusa: boolean): Promise<void>
  /** Cambia la categoria di un filo: una scelta sbagliata non resta sbagliata. */
  categoriaSegnalazione(id: string, categoria: Categoria): Promise<void>

  mettiNelNucleo(personaId: string, titolareId: string): Promise<void>
  togliDalNucleo(personaId: string): Promise<void>
  rendiTitolare(personaId: string): Promise<void>

  /** Le ricevute di una persona, o tutte, dalla più recente; anche le annullate. */
  ricevute(personaId?: string): Promise<Ricevuta[]>
  /** Il numero che prenderà la prossima ricevuta di quell'anno. */
  prossimoNumero(anno: number): Promise<number>
  /**
   * I dati del socio per una ricevuta nuova: quelli dell'ultima ricevuta,
   * se c'è; se no quelli di `anagraficaDi`; se no nome e cognome.
   */
  intestatarioDi(personaId: string): Promise<IntestatarioRicevuta>
  /**
   * Scrive i dati anagrafici che ci sono in `a`; quelli che mancano restano
   * com'erano, così un'altra risposta del modulo aggiunge e non cancella.
   * Con `sostituisci` (la MODIFICA della scheda) `a` è tutto: un campo vuoto
   * si cancella.
   */
  salvaAnagrafica(personaId: string, a: Anagrafica, sostituisci?: boolean): Promise<void>
  /**
   * Nascita, residenza e genitore da mostrare nella scheda e da mettere
   * sulle ricevute: i più recenti fra quelli della richiesta di iscrizione
   * accolta e quelli scritti in segreteria (dall'import o dalla scheda).
   * `null` se non ce ne sono.
   */
  anagraficaDi(personaId: string): Promise<AnagraficaDi | null>
  /** Fa la ricevuta, col suo numero (`emetti_ricevuta` in `16-ricevute.sql`). */
  emettiRicevuta(r: DatiRicevuta): Promise<Ricevuta>
  /** La annulla: resta, col suo numero, e il PDF dice ANNULLATA. */
  annullaRicevuta(id: string): Promise<void>
  /** I dati dell'associazione in testa alle ricevute. */
  enteRicevute(): Promise<EnteRicevuta>
  salvaEnteRicevute(e: EnteRicevuta): Promise<void>
  /** Il listino che vale: quello cambiato da LISTINO, o quello del foglio (`listino.ts`). */
  listino(): Promise<ListinoLetto>
  /** Lo salva per la pagina di iscrizione e le ricevute; `null` rimette quello del foglio. */
  salvaListino(l: Listino | null): Promise<void>

  /** Le lezioni già cominciate fra due giorni, con i loro appelli. */
  registro(da: Date, a: Date): Promise<RigaRegistro[]>
  /** Chi è venuto a provare nelle lezioni fra due giorni, dalla più recente (21-prove.sql). */
  prove(da: Date, a: Date): Promise<ProvaSeg[]>
  /** Le lezioni già cominciate fra due giorni in numeri, e gli incassi mese per mese. */
  statistiche(da: Date, a: Date): Promise<Statistiche>

  personale(): Promise<PersonaleSeg[]>
  salvaPersonale(p: DatiPersona & RuoloPersonale): Promise<string>
  impostaPin(personaId: string, pin: string): Promise<void>
  /** Il kanji della persona; `null` lo toglie. Due persone non possono avere lo stesso. */
  salvaKanji(personaId: string, kanji: string | null): Promise<void>
  /**
   * Manda l'invito per email: a chi non ha un account, quello per crearlo; a
   * chi ce l'ha ma non è mai entrato, il link per scegliere la password.
   * Va chiesto dalla funzione `invita` (`supabase/functions/invita`).
   */
  invita(personaId: string): Promise<'invito' | 'password'>
  /**
   * Elimina un istruttore che non ha mai insegnato: la scheda e l'account. Chi
   * ha corsi, lezioni in calendario o presenze da istruttore non si elimina
   * (`28-elimina-istruttore.sql`). Va chiesto dalla funzione `elimina`.
   */
  eliminaIstruttore(personaId: string): Promise<void>
  /**
   * Quante presenze, prove, iscrizioni e ricevute della scheda `via` passano
   * a `resta` unendole; dice di no come `unisciPersone`, senza cambiare niente.
   */
  anteprimaUnione(resta: string, via: string): Promise<{ presenze: number; prove: number; iscrizioni: number; ricevute: number }>
  /** Unisce due schede della stessa persona: `via` se ne va, tutto il suo passa a `resta` (`29-unisci-doppioni.sql`). */
  unisciPersone(resta: string, via: string): Promise<void>
  /** Codici fiscali, nascite e coppie «non sono doppioni», per i possibili doppioni di ISCRITTI (`doppioni.ts`). */
  indiziDoppioni(): Promise<IndiziDoppioni>
  /** Due schede che non sono la stessa persona: non compaiono più fra i possibili doppioni (`33-non-doppioni.sql`). */
  segnaNonDoppioni(a: string, b: string): Promise<void>
  /** Toglie una coppia «non sono doppioni», in qualunque ordine; se non c'è, niente. */
  togliNonDoppioni(a: string, b: string): Promise<void>

  salvaSala(s: { id?: string; nome: string; capienza?: number }): Promise<string>
  /** La musica delle sale, per il tablet (vedi `musica.ts`). */
  listeMusica(): Promise<ListaMusica[]>
  /** `disciplina`: assente = non si tocca; nulla = nessuna. */
  salvaListaMusica(l: { id?: string; nome: string; link: string; salaId: string | null; disciplina?: string | null }): Promise<string>
  togliListaMusica(id: string): Promise<void>
  /** La voce di sistema dei tablet, per nome; `null` è la prima voce italiana del tablet. */
  voceSale(): Promise<string | null>
  salvaVoceSale(nome: string | null): Promise<void>
  /** Le clip della voce incisa per i tablet: le chiavi di quelle che ci sono. */
  clipSale(): Promise<string[]>
  salvaClip(chiave: string, clip: Blob): Promise<void>
  apriClip(chiave: string): Promise<Blob | null>
  togliClip(chiave: string): Promise<void>
  /** Il catalogo degli esercizi dei tablet; `null` se non se n'è mai fatto uno. */
  eserciziPalestra(): Promise<Esercizio[] | null>
  salvaEserciziPalestra(l: Esercizio[]): Promise<void>
  /** Le discipline della palestra (Judo, Lotta…): le tiene la segreteria, le usano tutti. */
  discipline(): Promise<Disciplina[]>
  salvaDiscipline(l: Disciplina[]): Promise<void>
  /**
   * Le presenze degli istruttori dal PIN del tablet: tutte quelle da
   * confermare, e le altre degli ultimi `giorni`, dalla più recente.
   */
  presenzeIstruttori(giorni: number): Promise<PresenzaIstruttoreSeg[]>
  /** Conferma, o rifiuta, una presenza di un istruttore. */
  gestisciPresenzaIstruttore(id: string, conferma: boolean): Promise<void>
  /** Le lezioni tenute in cui nessun istruttore ha una presenza, dalla più recente. */
  lezioniSenzaIstruttore(): Promise<LezioneSenzaIstruttore[]>
  /** Chi, fra i previsti senza presenza, ha fatto la lezione: confermati loro, rifiutati gli altri. */
  segnaIstruttoriLezione(sessioneId: string, presenti: string[]): Promise<void>
  /** Gli ultimi timer fatti partire, dal più recente. */
  allenamenti(quanti: number): Promise<AllenamentoSeg[]>
  impostazioni(): Promise<Impostazioni>
  salvaImpostazioni(i: Partial<Impostazioni>): Promise<void>
  /**
   * Scrive inizio e fine dei corsi e toglie le lezioni da ricorrenza da domani
   * in poi fuori dalle date, tranne quelle con l'appello o una prova
   * (`35-date-corsi.sql`).
   */
  salvaDateCorsi(inizio: string | null, fine: string | null): Promise<EsitoDate>
  /** Quello che farebbe `salvaDateCorsi`, senza cambiare niente: per chiedere prima. */
  contaDateCorsi(inizio: string | null, fine: string | null): Promise<EsitoDate>
  /**
   * Quante presenze sono più vecchie del periodo, e la pulizia. Con `mesi`,
   * quante lo sarebbero con quel periodo: si conta e basta, non si salva.
   */
  scadute(mesi?: number): Promise<number>
  pulisci(): Promise<number>
  /** Tutto quello che si sa di una persona, per chi lo chiede (GDPR, art. 15). */
  esporta(personaId: string): Promise<unknown>
  /**
   * Le copie del database che fa GitHub (`.github/workflows/backup.yml`),
   * dalla più recente, e com'è andato l'ultimo lancio. Passa dalla funzione
   * `backup` (`supabase/functions/backup`), che ha il token di GitHub.
   */
  backup(): Promise<StatoBackup>
  /** Fa partire una copia adesso. */
  avviaBackup(): Promise<void>
  /** Da dove il browser scarica una copia: un indirizzo che vale un minuto. */
  scaricaBackup(id: number): Promise<{ link: string; nome: string }>
}

/** Una copia del database: uno zip con dentro il file cifrato. */
export interface CopiaBackup {
  id: number
  /** Il giorno della copia, `AAAA-MM-GG`. */
  giorno: string
  byte: number
  /** Quando GitHub la toglie: novanta giorni dopo. */
  scade: string
}

export interface StatoBackup {
  copie: CopiaBackup[]
  /** L'ultimo lancio del backup, con il link alla sua pagina su GitHub; `null` se non è mai partito. */
  ultimo: { stato: 'in_corso' | 'riuscito' | 'fallito'; quando: string; link: string } | null
}

/** Un'iscrizione vale oggi se è cominciata e non è finita. */
export const inCorso = (i: IscrizioneSeg, oggi: string) => i.dal <= oggi && (!i.al || i.al >= oggi)

/** Quanti giorni prima della scadenza un certificato si segna «in scadenza». */
export const AVVISO_CERTIFICATO = 30

export type ComeCertificato = 'manca' | 'scaduto' | 'in_scadenza' | 'valido'

/**
 * Senza data il certificato non c'è: in sala non si entra. La data la scrive
 * la segreteria quando ha il foglio in mano, quindi basta quella.
 */
export function comeCertificato(c: Pick<CertificatoSeg, 'scade'>, oggi: string): ComeCertificato {
  if (!c.scade) return 'manca'
  if (c.scade < oggi) return 'scaduto'
  return c.scade <= spostaGiorno(oggi, AVVISO_CERTIFICATO) ? 'in_scadenza' : 'valido'
}

export type StatoCertificato = 'nessuno' | 'valido' | 'in_scadenza' | 'scaduto_con_file' | 'scaduto_senza_file' | 'valido_senza_file' | 'file_vecchio'

/**
 * Lo stato che dice la scheda. Senza data il certificato non c'è, anche col
 * file: la data la scrive la segreteria. In scadenza e scaduto vengono prima
 * del file: lì conta cosa fare, non dov'è il foglio.
 */
export function statoCertificato(c: CertificatoSeg, oggi: string): StatoCertificato {
  if (!c.scade) return 'nessuno'
  if (c.scade < oggi) return c.conFile ? 'scaduto_con_file' : 'scaduto_senza_file'
  if (c.scade <= spostaGiorno(oggi, AVVISO_CERTIFICATO)) return 'in_scadenza'
  return !c.conFile ? 'valido_senza_file' : c.vecchio ? 'file_vecchio' : 'valido'
}

/** Quanti giorni dopo la scadenza il file si cancella da sé. */
export const GIORNI_FILE_DOPO_SCADENZA = 30

/** Il giorno in cui il file di un certificato che scade il `scade` si cancella. */
export const cancellaFileIl = (scade: string) => spostaGiorno(scade, GIORNI_FILE_DOPO_SCADENZA)

/** Sotto i 6 anni il certificato non si chiede. Senza la data di nascita, come per tutti. */
export function sottoSeiAnni(natoIl: string | undefined, oggi: string): boolean {
  // Il confronto è fra stringhe: a 6 anni si arriva il giorno stesso, e chi è nato il 29 febbraio li compie il 1 marzo (ogni anno) o il 29.
  return !!natoIl && natoIl > `${Number(oggi.slice(0, 4)) - 6}${oggi.slice(4)}`
}

export type ComeCertificatoDi = ComeCertificato | 'non_serve'

/** Quel che serve a dire come sta uno col certificato: la scheda della segreteria e quella che vede l'iscritto. */
type ConCertificato = { certificato: Pick<CertificatoSeg, 'scade'>; natoIl?: string }

/** Come `comeCertificato`, ma sotto i 6 anni, senza un certificato valido, `non_serve`: è a posto lo stesso. */
export function comeCertificatoDi(p: ConCertificato, oggi: string): ComeCertificatoDi {
  const come = comeCertificato(p.certificato, oggi)
  return sottoSeiAnni(p.natoIl, oggi) && come !== 'valido' && come !== 'in_scadenza' ? 'non_serve' : come
}

/** In regola col certificato: valido (anche se in scadenza), o non serve. L'unica regola: la usano tutte le schermate. */
export const certificatoInRegola = (p: ConCertificato, oggi: string) => comeCertificatoDi(p, oggi) !== 'manca' && comeCertificatoDi(p, oggi) !== 'scaduto'

/** Chi è attivo e non è in regola col certificato: manca o è scaduto. */
export const certificatoMancante = (p: Pick<PersonaSeg, 'attiva' | 'certificato' | 'natoIl'>, oggi: string) => p.attiva && !certificatoInRegola(p, oggi)

/** Quanti, per come stanno col certificato: i numeri delle statistiche, che sono quelli di DA FARE e di ISCRITTI. */
export function contiCertificati(persone: ConCertificato[], oggi: string): Record<ComeCertificatoDi, number> {
  const conti: Record<ComeCertificatoDi, number> = { valido: 0, in_scadenza: 0, scaduto: 0, manca: 0, non_serve: 0 }
  for (const p of persone) conti[comeCertificatoDi(p, oggi)]++
  return conti
}

/** Il file di prima della nuova gestione: era da stampare, ora si apre come gli altri. */
export const certificatoDaStampare = (c: Pick<CertificatoSeg, 'conFile' | 'vecchio'>) => c.conFile && !!c.vecchio

/** Cosa dice il blocco CERTIFICATO MEDICO della scheda, e quale tasto offre. */
export interface PresentaCertificato {
  parola: string
  tono: Tono
  frase: string
  /** Il tasto che apre il gesto: file e data insieme. */
  tasto: string
  /** È la prima cosa da fare: il tasto è pieno. */
  primo: boolean
  /** Il giorno in cui il file si cancella da sé, se c'è un file di un certificato scaduto. */
  cancellaIl?: string
  /** Cosa dire al posto del file, quando non c'è. */
  nota?: string
  /** Si può caricare, sostituire, togliere: non per una persona disattivata. */
  puoCambiare: boolean
}

export function presentaCertificato(c: CertificatoSeg, natoIl: string | undefined, oggi: string, attiva = true): PresentaCertificato {
  const stato = statoCertificato(c, oggi)
  const nonServe = comeCertificatoDi({ certificato: c, natoIl }, oggi) === 'non_serve'
  const data = c.scade ? dataLunga(c.scade) : ''
  const fra = c.scade ? Math.round((Date.parse(c.scade) - Date.parse(oggi)) / 86_400_000) : 0
  const frase = {
    nessuno: c.conFile ? 'Il file c’è, ma manca la data: scrivila leggendo il foglio. Senza, in sala non si entra.' : 'Nessun certificato in segreteria: senza, in sala non si entra.',
    valido: `Valido fino al ${data}.`,
    file_vecchio: `Valido fino al ${data}.`,
    valido_senza_file: `Valido fino al ${data}, ma il file non c’è: la data è segnata, il foglio no.`,
    in_scadenza: `Scade il ${data}, ${fra === 0 ? 'oggi' : fra === 1 ? 'domani' : `fra ${fra} giorni`}.`,
    scaduto_con_file: `Scaduto il ${data}: va rinnovato prima di tornare in sala.`,
    // «File cancellato» solo se un file c'è stato: la sola data scritta a mano non ne ha mai avuto.
    scaduto_senza_file: c.caricatoIl
      ? `Certificato scaduto, file cancellato. Scaduto il ${data}: ne serve uno nuovo prima di tornare in sala.`
      : `Certificato scaduto il ${data}: ne serve uno nuovo prima di tornare in sala.`,
  }[stato]
  const fileCancellato = !c.conFile && !!c.caricatoIl
  const nota = c.conFile
    ? undefined
    : fileCancellato
      ? c.scade && cancellaFileIl(c.scade) <= oggi
        ? 'Il file è stato cancellato 30 giorni dopo la scadenza, come previsto.'
        : !attiva
          ? 'File cancellato alla disattivazione.'
          : 'Il file è stato cancellato.'
      : stato === 'nessuno'
        ? 'Nessun file caricato.'
        : 'Nessun file caricato: la data l’ha scritta la segreteria.'
  const parola = { nessuno: 'MANCA', valido: 'VALIDO', file_vecchio: 'VALIDO', valido_senza_file: 'VALIDO', in_scadenza: 'IN SCADENZA', scaduto_con_file: 'SCADUTO', scaduto_senza_file: 'SCADUTO' }[stato]
  const verde = stato === 'valido' || stato === 'file_vecchio' || stato === 'valido_senza_file'
  const tasto =
    c.conFile && !c.scade
      ? 'SCRIVI LA DATA'
      : stato === 'nessuno'
        ? 'CARICA IL CERTIFICATO'
        : stato === 'scaduto_senza_file'
          ? 'CARICA IL NUOVO'
          : stato === 'valido_senza_file'
            ? 'CARICA IL FILE'
            : 'SOSTITUISCI'
  return {
    ...(nonServe
      ? { parola: 'NON SERVE', tono: 'spento' as Tono, frase: 'Sotto i 6 anni il certificato non si chiede.' }
      : { parola, tono: (verde ? 'verde' : stato === 'in_scadenza' ? 'giallo' : 'rosso') as Tono, frase }),
    tasto,
    // Il tasto pieno è uno solo: la prima cosa da fare.
    primo: !nonServe && ['nessuno', 'scaduto_con_file', 'scaduto_senza_file', 'valido_senza_file'].includes(stato),
    cancellaIl: stato === 'scaduto_con_file' ? cancellaFileIl(c.scade ?? '') : undefined,
    nota,
    puoCambiare: attiva,
  }
}

/** Come si apre il gesto CARICA / SOSTITUISCI: la data vuota, anche sostituendo un certificato che ne ha una (la vecchia è una trappola nel rinnovo). */
export const gestoIniziale = (_c: Pick<CertificatoSeg, 'scade'>): { file?: File; scade: string } => ({ scade: '' })

/**
 * SALVA è pronto quando c'è la data e c'è qualcosa da salvare: un file nuovo
 * scelto, o la data cambiata rispetto a quella già in scheda.
 */
export const certificatoPronto = (gesto: { file?: unknown; scade: string }, c: Pick<CertificatoSeg, 'scade'>) =>
  !!gesto.scade && (!!gesto.file || gesto.scade !== c.scade)

/** Cosa non va in un file di certificato e nella sua data, prima di mandarli: foto o PDF, 10 MB, e la data. */
export function cosaNonVaCertificato(file: Pick<File, 'type' | 'size'>, scade: string, oggi = chiaveGiorno(new Date())): string | null {
  if (!ESTENSIONI[file.type]) return 'Questo tipo di file non va: serve una foto o un PDF'
  if (file.size > MASSIMO_FILE) return 'Il file è troppo grande: al massimo 10 MB'
  return cosaNonVaScadenza(scade, oggi)
}

/** La data di scadenza: una data vera, e non più di tre anni avanti (quasi sempre vuol dire l'anno sbagliato). Come `salva_certificato`. */
export function cosaNonVaScadenza(scade: string, oggi = chiaveGiorno(new Date())): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(scade) || Number.isNaN(Date.parse(scade))) return 'Serve la data di scadenza del certificato'
  if (scade > `${Number(oggi.slice(0, 4)) + 3}${oggi.slice(4)}`) return "La data è troppo lontana: controlla l'anno."
  return null
}

/** Cosa dire sotto la data del gesto CARICA / SOSTITUISCI, prima di salvare. */
export function avvisiGesto(gesto: { file?: unknown; scade: string }, c: Pick<CertificatoSeg, 'conFile'>, oggi: string): string[] {
  const x: string[] = []
  if (gesto.scade && gesto.scade < oggi) x.push('Questa data è già passata: il certificato risulterà scaduto.')
  // Col file che c'è (o che si sceglie), una scadenza di più di 30 giorni fa lo fa cancellare alla prima pulizia.
  if (gesto.scade && cancellaFileIl(gesto.scade) <= oggi && (gesto.file || c.conFile)) x.push('Sono passati più di 30 giorni dalla scadenza: il file verrà cancellato subito.')
  if (gesto.file && c.conFile) x.push('Salvando, il file vecchio si cancella: resta solo questo.')
  return x
}

/** La domanda prima di disattivare: col file del certificato, dice che si cancella e che riattivare non lo riporta. */
export const confermaDisattiva = (nome: string, c: Pick<CertificatoSeg, 'conFile'>) =>
  `Disattivare ${nome}? Sparisce dagli appelli e dal tablet; si può riattivare.${c.conFile ? ' Il file del certificato si cancella subito e riattivarla non lo riporta: la data resta.' : ''}`

/** La domanda prima di unire due schede: con un certificato da una delle due, dice quale resta. */
export const confermaUnione = (nomeVia: string, nomeResta: string, via: Pick<CertificatoSeg, 'scade' | 'conFile'>, resta: Pick<CertificatoSeg, 'scade' | 'conFile'>) =>
  `Unire ${nomeVia} in ${nomeResta}? La scheda di ${nomeVia} se ne va, e non si torna indietro.${
    via.scade || via.conFile || resta.scade || resta.conFile ? ' Del certificato resta quello che scade più tardi, col suo file (se uno non ha il file, quello col file).' : ''
  }`

export type ComePaga = StatoPagamento | 'scaduto'

/** Com'è messo coi pagamenti, e perché: la ricevuta, o l'eccezione fuori dall'app. */
export interface StatoPaga {
  come: ComePaga
  fonte?: 'ricevuta' | 'fuori_app'
  /** Fin quando è pagato; per `scaduto`, fin quando lo era. */
  fino?: string
  /** Centesimi che mancano, per `in_parte` da una ricevuta. */
  mancano?: number
  /** «12/2026», la ricevuta da cui viene. */
  ricevuta?: string
  nota?: string
}

/**
 * In regola coi pagamenti vuol dire la quota associativa pagata: una
 * ricevuta non annullata con la QUOTA ASSOCIATIVA che vale oggi. I corsi si
 * guardano a parte. Senza ricevuta conta l'eccezione scritta a mano, fino
 * alla sua data. Una quota scaduta, o un'eccezione scaduta, è `scaduto`.
 */
export function pagamentoDi(p: Pick<PersonaSeg, 'pagamento' | 'quote'>, oggi: string): StatoPaga {
  const quote = p.quote ?? []
  const valgono = quote.filter((q) => (!q.dal || q.dal <= oggi) && (!q.al || q.al >= oggi))
  const numero = (q: QuotaRicevuta) => `${q.numero}/${q.anno}`
  const pagata = valgono.filter((q) => q.mancano === 0).sort((a, b) => (b.al ?? '9999').localeCompare(a.al ?? '9999'))[0]
  if (pagata) return { come: 'pagato', fonte: 'ricevuta', fino: pagata.al, ricevuta: numero(pagata) }

  const m = p.pagamento
  const fino = m.fino || VALIDITA.quota.al
  const eccezione = m.stato !== 'da_pagare' && fino >= oggi
  if (eccezione && m.stato === 'pagato') return { come: 'pagato', fonte: 'fuori_app', fino, nota: m.nota }
  const parte = [...valgono].sort((a, b) => a.mancano - b.mancano)[0]
  if (parte) return { come: 'in_parte', fonte: 'ricevuta', fino: parte.al, mancano: parte.mancano, ricevuta: numero(parte) }
  if (eccezione) return { come: 'in_parte', fonte: 'fuori_app', fino, nota: m.nota }

  const finite = [...quote.map((q) => q.al).filter((x): x is string => !!x && x < oggi), ...(m.stato !== 'da_pagare' && m.fino && m.fino < oggi ? [m.fino] : [])].sort()
  return finite.length ? { come: 'scaduto', fino: finite[finite.length - 1] } : { come: 'da_pagare' }
}

export const comePaga = (p: Pick<PersonaSeg, 'pagamento' | 'quote'>, oggi: string): ComePaga => pagamentoDi(p, oggi).come

/** In regola: certificato valido (anche se in scadenza) e quota pagata. */
export const inRegola = (p: Pick<PersonaSeg, 'certificato' | 'pagamento' | 'quote' | 'natoIl'>, oggi: string) =>
  certificatoInRegola(p, oggi) && comePaga(p, oggi) === 'pagato'

export type Tono = 'rosso' | 'giallo' | 'verde' | 'spento'

/** Una parola grande col suo colore: un bollino in elenco, un timbro nella scheda. */
export interface ParolaStato {
  tono: Tono
  parola: string
}

/** Un timbro in cima alla scheda; una riga senza tono prende quello del testo. */
export interface Timbro extends ParolaStato {
  righe: Array<{ testo: string; tono?: Tono }>
  /** La parola in elenco, quando quella del timbro è troppo lunga per la colonna. */
  inElenco?: string
}

export interface TimbriScheda {
  certificato: Timbro
  quota: Timbro
  documento: Timbro
  /** Disattivata: i timbri sono spenti, le parole restano. */
  disattivata?: boolean
}

/** «12/10», da una data `AAAA-MM-GG`. */
const dataCorta = (g: string) => `${g.slice(8, 10)}/${g.slice(5, 7)}`

/** «12/10/2026»: nei timbri l'anno c'è, la scheda si legge anche fra un anno. */
const dataTimbro = (g: string) => `${dataCorta(g)}/${g.slice(0, 4)}`

/**
 * «AL 31/07/2027», ma «ALL’11/07/2027»: l'1, l'8 e l'11 cominciano per
 * vocale. Lì il giorno va senza zero, se no «ALL’08» non si legge.
 */
export function alGiorno(g: string): string {
  const giorno = Number(g.slice(8, 10))
  return [1, 8, 11].includes(giorno) ? `ALL’${giorno}${dataTimbro(g).slice(2)}` : `AL ${dataTimbro(g)}`
}

function timbroCertificato(c: CertificatoSeg, oggi: string, natoIl?: string): Timbro {
  const come = comeCertificato(c, oggi)
  const righe: Timbro['righe'] = []
  if (comeCertificatoDi({ certificato: c, natoIl }, oggi) === 'non_serve') return { tono: 'spento', parola: 'NON SERVE', righe: [{ testo: 'SOTTO I 6 ANNI' }] }
  if (!c.scade) return { tono: 'rosso', parola: 'NO CERTIFICATO', righe: [{ testo: 'SENZA, IN SALA NON SI ENTRA' }] }
  if (come === 'scaduto') return { tono: 'rosso', parola: `SCADUTO IL ${dataTimbro(c.scade)}`, inElenco: 'CERT. SCADUTO', righe }
  if (come === 'in_scadenza') {
    if (c.scade === oggi) return { tono: 'giallo', parola: 'SCADE OGGI', righe }
    const fra = Math.round((Date.parse(c.scade) - Date.parse(oggi)) / 86_400_000)
    return {
      tono: 'giallo',
      parola: `SCADE IL ${dataTimbro(c.scade)}`,
      // In elenco la colonna è stretta: la data senza l'anno.
      inElenco: `SCADE IL ${dataCorta(c.scade)}`,
      righe: [{ testo: fra === 1 ? 'DOMANI' : `FRA ${fra} GIORNI` }, ...righe],
    }
  }
  return { tono: 'verde', parola: `VALIDO FINO ${alGiorno(c.scade)}`, righe }
}

function timbroQuota(s: StatoPaga): Timbro {
  const fino = s.fino ? [{ testo: `FINO ${alGiorno(s.fino)}` }] : []
  const da = s.fonte === 'fuori_app' ? [{ testo: 'FUORI APP' }] : s.ricevuta ? [{ testo: `RICEVUTA ${s.ricevuta}` }] : []
  if (s.come === 'pagato') return { tono: 'verde', parola: 'PAGATA', righe: [...da, ...fino] }
  if (s.come === 'in_parte')
    return { tono: 'giallo', parola: 'IN PARTE', righe: s.fonte === 'ricevuta' ? [{ testo: `MANCANO ${euro(s.mancano ?? 0)} €` }, ...da] : [...da, ...fino] }
  if (s.come === 'scaduto') return { tono: 'rosso', parola: 'QUOTA SCADUTA', righe: s.fino ? [{ testo: `VALEVA FINO ${alGiorno(s.fino)}` }] : [] }
  return { tono: 'rosso', parola: 'DA PAGARE', righe: [{ testo: 'NESSUNA RICEVUTA' }] }
}

/**
 * I tre timbri in cima alla scheda: certificato, quota, documento. Il
 * documento si vede ma non conta per «in regola» (vedi `inRegola`). Chi è
 * disattivato li ha spenti, con le stesse parole.
 */
export function timbriScheda(p: Pick<PersonaSeg, 'attiva' | 'certificato' | 'documento' | 'pagamento' | 'quote' | 'natoIl'>, oggi: string): TimbriScheda {
  const t = {
    certificato: timbroCertificato(p.certificato, oggi, p.natoIl),
    quota: timbroQuota(pagamentoDi(p, oggi)),
    documento: {
      tono: p.documento ? 'verde' : 'giallo',
      parola: p.documento ? 'IN SEGRETERIA' : 'DA PORTARE',
      // Del genitore, per un minore: la scheda non sa l'età, lo dice la sezione DOCUMENTO.
      righe: [{ testo: 'NON SERVE PER ENTRARE' }],
    } satisfies Timbro,
  }
  if (p.attiva) return t
  const spegni = (x: Timbro): Timbro => ({ ...x, tono: 'spento', righe: x.righe.map(({ testo }) => ({ testo })) })
  return { certificato: spegni(t.certificato), quota: spegni(t.quota), documento: spegni(t.documento), disattivata: true }
}

/**
 * Il tasto pieno della scheda, a riposo: uno solo, quello di quel che c'è da
 * fare per primo. Prima ciò che tiene fuori di sala o è da incassare, poi
 * l'avviso. Con tutto a posto resta la quota: la scheda si apre soprattutto
 * per incassare. Il documento non conta, come per «in regola».
 */
export function tastoPrincipale(p: Pick<PersonaSeg, 'attiva' | 'certificato' | 'pagamento' | 'quote' | 'natoIl'>, oggi: string): 'certificato' | 'quota' | null {
  if (!p.attiva) return null
  const cert = comeCertificatoDi(p, oggi)
  const quota = pagamentoDi(p, oggi).come
  if (certificatoMancante(p, oggi)) return 'certificato'
  if (quota !== 'pagato') return 'quota'
  return cert === 'in_scadenza' ? 'certificato' : 'quota'
}

/**
 * La colonna IN REGOLA dell'elenco: le parole dei timbri che non vanno, o
 * IN REGOLA; poi FUORI APP, perché prima o poi va una ricevuta. Il
 * certificato in scadenza si vede, anche se è ancora in regola.
 */
export function paroleInRegola(p: Pick<PersonaSeg, 'certificato' | 'pagamento' | 'quote' | 'natoIl'>, oggi: string): ParolaStato[] {
  const s = pagamentoDi(p, oggi)
  const cert = timbroCertificato(p.certificato, oggi, p.natoIl)
  const quota = timbroQuota(s)
  const fuori: ParolaStato[] = s.fonte === 'fuori_app' ? [{ tono: 'spento', parola: 'FUORI APP' }] : []
  const guai = [cert, quota].filter((t) => t.tono !== 'verde' && t.tono !== 'spento').map((t): ParolaStato => ({ tono: t.tono, parola: t.inElenco ?? t.parola }))
  const inRegola: ParolaStato = { tono: 'verde', parola: 'IN REGOLA' }
  return [...(guai.length ? guai : [inRegola]), ...fuori]
}

/** Un giorno `AAAA-MM-GG` spostato di tanti giorni, senza passare dai fusi. */
function spostaGiorno(g: string, giorni: number) {
  const [a, m, d] = g.split('-').map(Number)
  const x = new Date(Date.UTC(a, m - 1, d + giorni))
  return x.toISOString().slice(0, 10)
}

// Niente rosso: in segreteria vuol dire che qualcosa manca (supabase/26-colori-corsi.sql).
export const COLORI = [
  { nome: 'Blu', hex: '#1b8ac4' },
  { nome: 'Viola', hex: '#8b5cc4' },
  { nome: 'Giallo', hex: '#f4c31b' },
  { nome: 'Verde', hex: '#16a54a' },
]

export const GIORNI_LUNGHI = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato']

let unico: Promise<DatiSegreteria> | null = null

export function datiSegreteria(): Promise<DatiSegreteria> {
  if (!unico) {
    unico = (haUnServer
      ? Promise.all([import('./segreteriaSupabase'), import('./supabase')]).then(([m, s]) => m.creaSegreteriaSupabase(s.clientSupabase()))
      : Promise.all([import('./segreteriaProva'), import('./esempiProva')]).then(([m, e]) => (e.seminaEsempi(), m.creaSegreteriaProva())))
      // Se il pezzo non arriva (rete, o un aggiornamento pubblicato nel
      // frattempo), la volta dopo si riprova invece di restare rotti.
      .catch((e) => {
        unico = null
        throw e
      })
  }
  return unico
}

/**
 * Chi esce scrivendo in «Cerca iscritto»: chi somiglia allo scritto
 * (`somiglia`), prima chi è attivo e poi per cognome, al massimo otto.
 */
export function trovaIscritti(persone: PersonaSeg[], scritto: string): PersonaSeg[] {
  const parole = paroleCercate(scritto)
  if (!parole.length) return []
  return persone
    .filter((p) => somiglia(p, parole))
    .sort((a, b) => Number(b.attiva) - Number(a.attiva) || a.cognome.localeCompare(b.cognome, 'it'))
    .slice(0, 8)
}

/**
 * Il nome di una voce di sistema senza la lingua: «Grandma», non «Grandma
 * (Italiano (Italia))». Le voci della tendina sono già tutte italiane. Le
 * marcature di qualità («Enhanced», «Premium») restano, perché si scelgono per
 * quelle; se due voci dopo il taglio si chiamerebbero uguali, restano intere.
 * Si mostra e basta: si salva il nome intero, che il tablet cerca così.
 */
export function nomeVoce(nome: string, tutte: string[]): string {
  const corto = (n: string) =>
    n
      .replace(/\s*\([^()]*\([^()]*\)\)$/, '')
      .replace(/\s+-\s+[^-()]*\([^()]*\)$/, '')
      .trim() || n
  const mio = corto(nome)
  return tutte.some((v) => v !== nome && corto(v) === mio) ? nome : mio
}

/** Cosa ha fatto SALVA LE DATE: le lezioni tolte, e quelle rimaste fuori dalle date coi loro giorni. */
export interface EsitoDate {
  tolte: number
  restano: number
  prima: string | null
  ultima: string | null
  /** Le prime tre rimaste fuori, col nome del corso e l'inizio. */
  rimaste?: Array<{ corso: string; inizio: string }>
  /** Il database senza `35-date-corsi.sql`: le date sono salvate, niente è tolto, e cosa fare. */
  manca?: string
}

/**
 * Prima di SALVA LE DATE: quante lezioni se ne andrebbero. Niente da togliere
 * (o il database che non toglie) si salva subito; senza il conto (`null`) si
 * chiede lo stesso, senza numero.
 */
export function confermaDateCorsi(e: EsitoDate | null): { testo: string; tasto: string } | null {
  if (!e) return { testo: 'Salvare le date? Da domani le lezioni fuori dalle date se ne vanno, tranne quelle con l’appello o una prova.', tasto: 'SALVA LE DATE' }
  if (e.manca || !e.tolte) return null
  const quante = e.tolte === 1 ? '1 lezione' : `${e.tolte} lezioni`
  const restano = !e.restano ? '' : e.restano === 1 ? ' Resta 1 lezione con l’appello o una prova.' : ` Restano ${e.restano} lezioni con l’appello o una prova.`
  return { testo: `Togliere ${quante} fuori dalle date?${restano}`, tasto: `SÌ, TOGLI ${quante.toUpperCase()}` }
}

/**
 * Quello che si dice dopo SALVA LE DATE: quante lezioni sono sparite, e perché
 * qualcuna è rimasta, così una lezione isolata dopo la fine non sembra un
 * errore. Corto: l'avviso dura otto secondi.
 */
export function testoDateSalvate({ tolte, restano, prima, ultima, rimaste, manca }: EsitoDate): string {
  if (manca) return `Date salvate, ma per togliere le lezioni fuori dalle date ${manca}`
  const fatto = `Date salvate${tolte ? `: ${tolte === 1 ? 'tolta 1 lezione' : `tolte ${tolte} lezioni`}` : ''}`
  if (!restano || !prima) return fatto
  const fine = ultima ?? prima
  const giorno = (g: string, mese = true) => new Date(`${g}T12:00:00`).toLocaleDateString('it-IT', mese ? { day: 'numeric', month: 'long' } : { day: 'numeric' })
  const chiave = (iso: string) => chiaveGiorno(new Date(iso))
  // Poche: si dice quali, col corso e l'ora, così si sa chi chiamare.
  const elenco = (x: string[]) => (x.length > 1 ? `${x.slice(0, -1).join(', ')} e ${x.at(-1)}` : x[0])
  const stessoGiorno = !!rimaste && rimaste.length > 1 && rimaste.every((r) => chiave(r.inizio) === chiave(rimaste[0].inizio))
  const quali =
    rimaste?.length && rimaste.length === restano
      ? `${restano === 1 ? 'Resta' : 'Restano'} ${
          stessoGiorno
            ? `${elenco(rimaste.map((r) => `${r.corso} alle ${oraDi(r.inizio)}`))} del ${giorno(chiave(rimaste[0].inizio))}`
            : elenco(rimaste.map((r) => `${r.corso} del ${giorno(chiave(r.inizio))} alle ${oraDi(r.inizio)}`))
        }`
      : restano === 1
      ? `Resta la lezione del ${giorno(prima)}`
      : prima === fine
        ? `Restano ${restano} lezioni del ${giorno(prima)}`
        : restano === 2
          ? `Restano le lezioni del ${giorno(prima, prima.slice(0, 7) !== fine.slice(0, 7))} e del ${giorno(fine)}`
          : `Restano ${restano} lezioni fra il ${giorno(prima)} e il ${giorno(fine)}`
  return `${fatto}. ${quali}: ${restano === 1 ? 'ha' : 'hanno'} l’appello o una prova`
}

/**
 * Prima di accorciare per quanto si tengono le presenze: quante se ne vanno.
 * Allungare non toglie niente e si salva subito; accorciare senza presenze da
 * togliere pure. Altrimenti si chiede, e si dice quando si cancellano: col
 * database vero il primo del mese (il lavoro `pulizia`), in prova solo con
 * CANCELLA ORA. Senza il conteggio (`null`) si chiede lo stesso, senza numero.
 */
export function confermaMesiPresenze({
  prima,
  dopo,
  scadute,
  modo,
}: {
  prima: number
  dopo: number
  scadute: number | null
  modo: 'prova' | 'supabase'
}): { testo: string; tasto: string } | null {
  if (dopo >= prima || scadute === 0) return null
  const una = scadute === 1
  const quante = `${scadute === null ? 'le presenze' : una ? '1 presenza' : `${scadute} presenze`} più ${una ? 'vecchia' : 'vecchie'} di ${dopo} mesi`
  const dopoCosa =
    modo === 'supabase'
      ? `Il primo del mese si ${una ? 'cancella' : 'cancellano'} ${quante}`
      : `${quante[0].toUpperCase()}${quante.slice(1)} si ${una ? 'potrà' : 'potranno'} cancellare con CANCELLA ORA`
  const testo = `Accorciare a ${dopo} mesi? ${dopoCosa}: non si recuperano.`
  return { testo, tasto: `SÌ, ACCORCIA A ${dopo} MESI` }
}

const istruttoriDetti = ([primo, ...altri]: string[]) => [primo, ...altri.sort()].join()

/**
 * C'è qualcosa da perdere uscendo dalla scheda di un corso? La bozza si
 * confronta con quel che è salvato; per un corso nuovo (`corso` null) con come
 * si apre: vuoto, la prima sala (`salaIniziale`) e il primo colore. Degli
 * istruttori conta chi è il primo, quello di riferimento; l'ordine degli altri
 * no: il database non lo tiene, e dopo SALVA tornano in un altro ordine.
 */
export function corsoCambiato(corso: CorsoSeg | null, bozza: DatiCorso, salaIniziale?: string): boolean {
  const salvato = {
    nome: corso?.nome ?? '',
    salaId: corso ? corso.salaId : salaIniziale,
    istruttori: corso?.istruttori.map((i) => i.id) ?? [],
    capienza: corso?.capienza,
    colore: corso?.colore ?? COLORI[0].hex,
  }
  return (
    bozza.nome.trim() !== salvato.nome.trim() ||
    (bozza.salaId ?? '') !== (salvato.salaId ?? '') ||
    istruttoriDetti(bozza.istruttori) !== istruttoriDetti(salvato.istruttori) ||
    bozza.capienza !== salvato.capienza ||
    (bozza.colore ?? COLORI[0].hex) !== salvato.colore
  )
}

export type RicorrenzaNuova = { giorno: number; ora: string; durata: number; salaId?: string; attivitaId?: string }

/** Il giorno nuovo (+ AGGIUNGI UN GIORNO) si apre con l'ora e i minuti del primo giorno del corso. */
export function ricorrenzaIniziale(corso: CorsoSeg): RicorrenzaNuova {
  return { giorno: 1, ora: corso.ricorrenze[0]?.ora ?? '17:00', durata: corso.ricorrenze[0]?.durata ?? 60 }
}

/** C'è da perdere qualcosa nel giorno nuovo? Sì se è diverso da come si è aperto. */
export function ricorrenzaCambiata(corso: CorsoSeg, ric: RicorrenzaNuova): boolean {
  const i = ricorrenzaIniziale(corso)
  return ric.giorno !== i.giorno || ric.ora !== i.ora || ric.durata !== i.durata || !!ric.salaId || !!ric.attivitaId
}

/** C'è qualcosa da perdere uscendo da MODIFICA nella scheda di un istruttore? */
export function personaCambiata(
  salvata: Pick<PersonaleSeg, 'nome' | 'cognome' | 'email'>,
  modifica: { nome: string; cognome: string; email: string },
): boolean {
  return (
    modifica.nome.trim() !== salvata.nome.trim() ||
    modifica.cognome.trim() !== salvata.cognome.trim() ||
    modifica.email.trim() !== (salvata.email ?? '').trim()
  )
}

const MAX_ATTIVITA = 40
const chiaveNome = (s: string) => s.trim().toLocaleLowerCase('it')

/**
 * Cosa non va in un nome di attività: `null` se va bene. Maiuscole e spazi
 * intorno non contano, come l'indice unico del database; `id` è la voce che si sta rinominando.
 */
export function cosaNonVaAttivita(nome: string, altre: Array<{ id?: string; nome: string }>, id?: string): string | null {
  const n = nome.trim()
  if (!n) return 'Scrivi il nome dell’attività'
  if (n.length > MAX_ATTIVITA) return `Il nome è lungo al massimo ${MAX_ATTIVITA} caratteri`
  if (altre.some((a) => a.id !== id && chiaveNome(a.nome) === chiaveNome(n))) return "C'è già un'attività con questo nome"
  return null
}

/** In ordine alfabetico, senza badare a maiuscole e accenti. */
export function ordinaAttivita<T extends { nome: string }>(elenco: T[]): T[] {
  return [...elenco].sort((a, b) => a.nome.localeCompare(b.nome, 'it', { sensitivity: 'base' }))
}

/** Quello che si offre nei menu di un giorno e di una lezione: solo le attività in uso, in ordine. */
export function attivitaPerMenu<T extends { nome: string; attiva: boolean }>(elenco: T[]): T[] {
  return ordinaAttivita(elenco.filter((a) => a.attiva))
}

/**
 * Le voci di un menu di attività: quelle in uso, in ordine, più quella che il
 * giorno o la lezione hanno già (`correnteId`) se nel frattempo è uscita
 * dall'uso, in fondo e marcata: il menu non deve mentire su cosa c'è adesso.
 */
export function vociAttivita<T extends { id: string; nome: string; attiva: boolean }>(elenco: T[], correnteId: string | null | undefined): Array<T & { fuoriUso: boolean }> {
  const inUso = attivitaPerMenu(elenco).map((a) => ({ ...a, fuoriUso: false }))
  const corrente = elenco.find((a) => !a.attiva && a.id === correnteId)
  return corrente ? [...inUso, { ...corrente, fuoriUso: true }] : inUso
}

/** Perché un'attività non si elimina, o `null` se non è su niente. */
export function motivoAttivitaUsata(giorni: number, lezioni: number): string | null {
  if (!giorni && !lezioni) return null
  const g = giorni === 1 ? '1 giorno' : `${giorni} giorni`
  const l = lezioni === 1 ? '1 lezione' : `${lezioni} lezioni`
  return `È su ${g} e ${l}: toglila dai giorni, oppure usa NON PIÙ IN USO`
}

/**
 * Una lezione ha un'attività diversa da quella del suo giorno? Allora l'ha
 * scelta qualcuno a mano. Una straordinaria non ha un giorno, quindi mai.
 */
export function attivitaCambiataAMano(lezione: { attivitaId?: string | null; straordinaria: boolean }, giorno?: { attivitaId?: string | null }): boolean {
  if (lezione.straordinaria) return false
  return (lezione.attivitaId ?? null) !== (giorno?.attivitaId ?? null)
}

/**
 * Il giorno può ancora cambiare l'attività di questa lezione? Solo se è futura,
 * senza appello e non straordinaria: come il trigger di `41-attivita.sql`, che
 * non riscrive mai lo storico.
 */
function seguiIlGiorno(l: { straordinaria: boolean; inizio: string; segnati: number }, adesso: Date): boolean {
  return !l.straordinaria && new Date(l.inizio) > adesso && !l.segnati
}

/**
 * `attivitaCambiataAMano`, ma solo per le lezioni che il giorno può ancora
 * cambiare: una passata o con l'appello ha l'attività che aveva, e se il giorno
 * ne ha presa un'altra poi non è una scelta di nessuno.
 */
export function attivitaCambiata(
  lezione: { attivitaId?: string | null; straordinaria: boolean; inizio: string; segnati: number },
  giorno: { attivitaId?: string | null } | undefined,
  adesso: Date = new Date(),
): boolean {
  return seguiIlGiorno(lezione, adesso) && attivitaCambiataAMano(lezione, giorno)
}

export const COME_IL_GIORNO = 'giorno'
export const NESSUNA_ATTIVITA = 'nessuna'

/**
 * Cosa mostra il menu dell'attività di una lezione: `valore` è la voce scelta,
 * `segue` che la lezione si aggiorna col giorno, `conGiorno` che il giorno la
 * può ancora cambiare (e quindi si offre «Come il giorno»).
 */
export function sceltaAttivitaLezione(
  l: { attivitaId?: string | null; attivitaCambiata?: boolean; straordinaria: boolean; inizio: string; segnati: number },
  adesso: Date = new Date(),
): { valore: string; segue: boolean; conGiorno: boolean } {
  const conGiorno = seguiIlGiorno(l, adesso)
  const segue = conGiorno && !l.attivitaCambiata
  return { valore: segue ? COME_IL_GIORNO : (l.attivitaId ?? NESSUNA_ATTIVITA), segue, conGiorno }
}

/**
 * Il nome dell'attività del giorno a cui appartiene una lezione, trovato dal
 * giorno della settimana e dall'ora: assente se il giorno non c'è più o non ne ha.
 */
export function attivitaDelGiorno(corsi: CorsoSeg[], lezione: { corsoId: string; inizio: string }): string | undefined {
  const i = new Date(lezione.inizio)
  const ora = `${String(i.getHours()).padStart(2, '0')}:${String(i.getMinutes()).padStart(2, '0')}`
  return corsi.find((c) => c.id === lezione.corsoId)?.ricorrenze.find((r) => r.giorno === i.getDay() && r.ora.slice(0, 5) === ora)?.attivita
}

/**
 * Le lezioni che cambiano insieme al loro giorno: future, senza appello né
 * prove, e ancora con l'attività che il giorno aveva prima (`prima`).
 */
export function lezioniCheSeguonoIlGiorno(
  lezioni: Array<{ id: string; inizio: string; attivitaId?: string | null; segnati: number; prove: number }>,
  prima: string | null | undefined,
  adesso: Date,
): string[] {
  return lezioni
    .filter((l) => new Date(l.inizio) > adesso && !l.segnati && !l.prove && (l.attivitaId ?? null) === (prima ?? null))
    .map((l) => l.id)
}

/**
 * Il database non ha ancora le attività (`41-attivita.sql` non lanciato)?
 * Lo dicono la colonna, la tabella o il legame che mancano: in lettura si
 * legge come prima, senza attività.
 */
export function mancaAttivita(e: { code?: string; message?: string } | null | undefined): boolean {
  return !!e && ['42703', 'PGRST200', 'PGRST205', '42P01', '42883'].includes(e.code ?? '') && /attivita/.test(e.message ?? '')
}
