import type { StatoPresenza, StatoSessione } from './sala'
import { haUnServer } from './dati'
import type { ListaMusica } from './musica'
import type { ImpostazioniSala } from '../../timer/src/lib/impostazioniSala'

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
  pagamento: PagamentoSeg
}

/** Il certificato medico: fino a quando vale, e se il file c'è. */
export interface CertificatoSeg {
  scade?: string
  conFile: boolean
}

export type StatoPagamento = 'da_pagare' | 'in_parte' | 'pagato'

export interface PagamentoSeg {
  stato: StatoPagamento
  /** Per chi paga il trimestre: passata la data, torna da pagare. */
  fino?: string
  nota?: string
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

export interface PersonaleSeg {
  id: string
  nome: string
  cognome: string
  email?: string
  ruolo: 'istruttore' | 'staff'
  attiva: boolean
  /** Ha già fatto l'accesso almeno una volta: il suo account è legato. */
  collegato: boolean
  haPin: boolean
  corsi: string[]
}

export interface Impostazioni {
  mesiPresenze: number
  giorniCalendario: number
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
  /**
   * Il certificato medico: la scadenza e, se c'è, il file nuovo, che prende
   * il posto del vecchio. Senza file cambia solo la scadenza.
   */
  salvaCertificato(personaId: string, scade: string, file?: File): Promise<void>
  /** Toglie scadenza e file. */
  togliCertificato(personaId: string): Promise<void>
  /** Il file del certificato, o `null` se non c'è. */
  apriCertificato(personaId: string): Promise<FileSeg | null>
  salvaPagamento(personaId: string, p: PagamentoSeg): Promise<void>

  /** Le lezioni già cominciate fra due giorni, con i loro appelli. */
  registro(da: Date, a: Date): Promise<RigaRegistro[]>

  personale(): Promise<PersonaleSeg[]>
  salvaPersonale(p: DatiPersona & { ruolo: 'istruttore' | 'staff' }): Promise<string>
  impostaPin(personaId: string, pin: string): Promise<void>
  /**
   * Manda l'invito per email: a chi non ha un account, quello per crearlo; a
   * chi ce l'ha ma non è mai entrato, il link per scegliere la password.
   * Va chiesto dalla funzione `invita` (`supabase/functions/invita`).
   */
  invita(personaId: string): Promise<'invito' | 'password'>

  salvaSala(s: { id?: string; nome: string; capienza?: number }): Promise<string>
  /** La musica delle sale, per il tablet (vedi `musica.ts`). */
  listeMusica(): Promise<ListaMusica[]>
  salvaListaMusica(l: { id?: string; nome: string; link: string; salaId: string | null }): Promise<string>
  togliListaMusica(id: string): Promise<void>
  /** Il timer dei tablet di sala, uguale per tutti (vedi `impostazioniSala.ts`). */
  timerSale(): Promise<ImpostazioniSala>
  salvaTimerSale(i: ImpostazioniSala): Promise<void>
  impostazioni(): Promise<Impostazioni>
  salvaImpostazioni(i: Partial<Impostazioni>): Promise<void>
  /** Quante presenze sono più vecchie del periodo, e la pulizia. */
  scadute(): Promise<number>
  pulisci(): Promise<number>
  /** Tutto quello che si sa di una persona, per chi lo chiede (GDPR, art. 15). */
  esporta(personaId: string): Promise<unknown>
}

/** Un'iscrizione vale oggi se è cominciata e non è finita. */
export const inCorso = (i: IscrizioneSeg, oggi: string) => i.dal <= oggi && (!i.al || i.al >= oggi)

/** Quanti giorni prima della scadenza un certificato si segna «in scadenza». */
export const AVVISO_CERTIFICATO = 30

export type ComeCertificato = 'manca' | 'scaduto' | 'in_scadenza' | 'valido'

/** Senza file o senza data il certificato non c'è: in sala non si entra. */
export function comeCertificato(c: CertificatoSeg, oggi: string): ComeCertificato {
  if (!c.scade || !c.conFile) return 'manca'
  if (c.scade < oggi) return 'scaduto'
  return c.scade <= spostaGiorno(oggi, AVVISO_CERTIFICATO) ? 'in_scadenza' : 'valido'
}

export type ComePaga = StatoPagamento | 'scaduto'

/** Pagato fino a una data passata vuol dire da pagare di nuovo. */
export const comePaga = (p: PagamentoSeg, oggi: string): ComePaga => (p.stato === 'pagato' && p.fino && p.fino < oggi ? 'scaduto' : p.stato)

/** In regola: certificato valido (anche se in scadenza) e pagato. */
export const inRegola = (p: Pick<PersonaSeg, 'certificato' | 'pagamento'>, oggi: string) =>
  ['valido', 'in_scadenza'].includes(comeCertificato(p.certificato, oggi)) && comePaga(p.pagamento, oggi) === 'pagato'

export const PAGAMENTI: Array<[StatoPagamento, string]> = [
  ['da_pagare', 'DA PAGARE'],
  ['in_parte', 'IN PARTE'],
  ['pagato', 'PAGATO'],
]

/** Un giorno `AAAA-MM-GG` spostato di tanti giorni, senza passare dai fusi. */
function spostaGiorno(g: string, giorni: number) {
  const [a, m, d] = g.split('-').map(Number)
  const x = new Date(Date.UTC(a, m - 1, d + giorni))
  return x.toISOString().slice(0, 10)
}

export const COLORI = [
  { nome: 'Blu', hex: '#1b8ac4' },
  { nome: 'Rosso', hex: '#e4292a' },
  { nome: 'Giallo', hex: '#f4c31b' },
  { nome: 'Verde', hex: '#16a54a' },
]

export const GIORNI_LUNGHI = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato']

let unico: Promise<DatiSegreteria> | null = null

export function datiSegreteria(): Promise<DatiSegreteria> {
  if (!unico) {
    unico = (haUnServer
      ? Promise.all([import('./segreteriaSupabase'), import('./supabase')]).then(([m, s]) => m.creaSegreteriaSupabase(s.clientSupabase()))
      : import('./segreteriaProva').then((m) => m.creaSegreteriaProva()))
      // Se il pezzo non arriva (rete, o un aggiornamento pubblicato nel
      // frattempo), la volta dopo si riprova invece di restare rotti.
      .catch((e) => {
        unico = null
        throw e
      })
  }
  return unico
}
