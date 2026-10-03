import type { StatoPresenza, StatoSessione } from './sala'
import type { RuoloPersonale } from './ruoli'
import { haUnServer } from './dati'
import type { ListaMusica } from './musica'
import type { Esercizio } from '../../timer/src/lib/esercizi'
import type { StatoPresenzaIstruttore } from './tablet'
import type { DatiRicevuta, EnteRicevuta, IntestatarioRicevuta, QuotaRicevuta, Ricevuta } from './ricevute'
import { euro } from './ricevute'
import { VALIDITA } from './costi'
import type { Listino, ListinoLetto } from './listino'
import { nomeProprio, paroleCercate, somiglia } from './nomi'
import type { SegnalataVista } from './segnalate'
import type { Segnalazione } from './segnalazioni'

export type { ListaMusica } from './musica'

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
 * Il certificato medico: fino a quando vale. Il certificato vero sta su
 * carta, in segreteria.
 */
export interface CertificatoSeg {
  scade?: string
  /**
   * C'è ancora il file caricato nell'app, di prima della carta: da stampare
   * e cancellare.
   */
  conFile: boolean
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
    cambi: { stato?: StatoSessione; sostitutoId?: string | null; salaId?: string | null },
  ): Promise<void>
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
  aggiungiRicorrenza(corsoId: string, r: { giorno: number; ora: string; durata: number; salaId?: string }, opzioni?: { rigenera?: boolean }): Promise<void>
  /** Un giorno in un'altra sala; `null` lo rimette nella sala del corso. Le lezioni future lo seguono. */
  salaRicorrenza(ricorrenzaId: string, salaId: string | null): Promise<void>
  togliRicorrenza(ricorrenzaId: string): Promise<void>

  persone(): Promise<PersonaSeg[]>
  /** Negli ultimi trenta giorni, per persona. */
  frequenze(): Promise<Map<string, Frequenza>>
  storico(personaId: string, quante: number): Promise<StoricoSeg[]>
  salvaPersona(p: DatiPersona): Promise<string>
  attivaPersona(personaId: string, attiva: boolean): Promise<void>
  iscrivi(personaId: string, corsoId: string): Promise<void>
  termina(personaId: string, corsoId: string): Promise<void>
  /** Il certificato medico, che sta su carta in segreteria: fino a quando vale. */
  salvaCertificato(personaId: string, scade: string): Promise<void>
  /** Toglie la scadenza, e il file di prima se c'è ancora. */
  togliCertificato(personaId: string): Promise<void>
  /** Il file del certificato di prima della carta, o `null` se non c'è: per stamparlo. */
  apriCertificato(personaId: string): Promise<FileSeg | null>
  /** Il file di prima, stampato: si cancella per sempre, la scadenza resta. */
  cancellaFileCertificato(personaId: string): Promise<void>
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
  apriSegnalazione(titolo: string, testo: string, allegati?: File[]): Promise<string>
  /** Con `allegati`, se qualche file non parte il messaggio c'è lo stesso: lancia `AllegatiNonPartiti`. */
  rispondiSegnalazione(id: string, testo: string, allegati?: File[]): Promise<void>
  /** Toglie un allegato (solo chi l'ha mandato): file e riga, e nel filo resta la traccia. */
  togliAllegato(id: string): Promise<void>
  /** Un link per aprire un allegato: scade presto, se ne chiede uno nuovo ogni volta. */
  linkAllegato(id: string): Promise<string>
  /** La chiude, o con `false` la riapre. */
  chiudiSegnalazione(id: string, chiusa: boolean): Promise<void>

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

  salvaSala(s: { id?: string; nome: string; capienza?: number }): Promise<string>
  /** La musica delle sale, per il tablet (vedi `musica.ts`). */
  listeMusica(): Promise<ListaMusica[]>
  salvaListaMusica(l: { id?: string; nome: string; link: string; salaId: string | null }): Promise<string>
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
export const inRegola = (p: Pick<PersonaSeg, 'certificato' | 'pagamento' | 'quote'>, oggi: string) =>
  ['valido', 'in_scadenza'].includes(comeCertificato(p.certificato, oggi)) && comePaga(p, oggi) === 'pagato'

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

function timbroCertificato(c: CertificatoSeg, oggi: string): Timbro {
  const come = comeCertificato(c, oggi)
  // Il file di prima della carta è sempre un avviso, anche sotto un certificato valido.
  const righe: Timbro['righe'] = c.conFile ? [{ testo: 'DA STAMPARE', tono: 'giallo' }] : []
  if (!c.scade) return { tono: 'rosso', parola: 'NO CERTIFICATO', righe: [{ testo: 'SENZA, IN SALA NON SI ENTRA' }, ...righe] }
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
export function timbriScheda(p: Pick<PersonaSeg, 'attiva' | 'certificato' | 'documento' | 'pagamento' | 'quote'>, oggi: string): TimbriScheda {
  const t = {
    certificato: timbroCertificato(p.certificato, oggi),
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
export function tastoPrincipale(p: Pick<PersonaSeg, 'attiva' | 'certificato' | 'pagamento' | 'quote'>, oggi: string): 'certificato' | 'quota' | null {
  if (!p.attiva) return null
  const cert = comeCertificato(p.certificato, oggi)
  const quota = pagamentoDi(p, oggi).come
  if (cert === 'manca' || cert === 'scaduto') return 'certificato'
  if (quota !== 'pagato') return 'quota'
  return cert === 'in_scadenza' ? 'certificato' : 'quota'
}

/**
 * La colonna IN REGOLA dell'elenco: le parole dei timbri che non vanno, o
 * IN REGOLA; poi FUORI APP, perché prima o poi va una ricevuta. Il
 * certificato in scadenza si vede, anche se è ancora in regola.
 */
export function paroleInRegola(p: Pick<PersonaSeg, 'certificato' | 'pagamento' | 'quote'>, oggi: string): ParolaStato[] {
  const s = pagamentoDi(p, oggi)
  const cert = timbroCertificato(p.certificato, oggi)
  const quota = timbroQuota(s)
  const fuori: ParolaStato[] = s.fonte === 'fuori_app' ? [{ tono: 'spento', parola: 'FUORI APP' }] : []
  const guai = [cert, quota].filter((t) => t.tono !== 'verde').map((t): ParolaStato => ({ tono: t.tono, parola: t.inElenco ?? t.parola }))
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

export type RicorrenzaNuova = { giorno: number; ora: string; durata: number; salaId?: string }

/** Il giorno nuovo (+ AGGIUNGI UN GIORNO) si apre con l'ora e i minuti del primo giorno del corso. */
export function ricorrenzaIniziale(corso: CorsoSeg): RicorrenzaNuova {
  return { giorno: 1, ora: corso.ricorrenze[0]?.ora ?? '17:00', durata: corso.ricorrenze[0]?.durata ?? 60 }
}

/** C'è da perdere qualcosa nel giorno nuovo? Sì se è diverso da come si è aperto. */
export function ricorrenzaCambiata(corso: CorsoSeg, ric: RicorrenzaNuova): boolean {
  const i = ricorrenzaIniziale(corso)
  return ric.giorno !== i.giorno || ric.ora !== i.ora || ric.durata !== i.durata || !!ric.salaId
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
