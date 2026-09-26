/**
 * I tipi della sala corsi.
 *
 * Sono lo specchio delle tabelle in `supabase/01-schema.sql`: se cambia una
 * colonna là, cambia un campo qui. Le date viaggiano come stringhe ISO perché
 * è quello che esce dal database e quello che entra in `localStorage`, e
 * convertirle una volta sola al momento di mostrarle costa meno che ricordarsi
 * a ogni passaggio se in mano si ha un `Date` o una stringa.
 */

export type Ruolo = 'istruttore' | 'staff' | 'iscritto'
export type StatoSessione = 'prevista' | 'svolta' | 'annullata'
export type StatoPresenza = 'presente' | 'assente' | 'giustificato'

export interface Persona {
  id: string
  nome: string
  cognome: string
  ruolo: Ruolo
}

export interface Sala {
  id: string
  nome: string
  capienza?: number
}

export interface Corso {
  id: string
  nome: string
  descrizione?: string
  capienza?: number
  colore?: string
}

/** Una lezione come compare nel calendario: già unita a corso, sala e istruttore. */
export interface SessioneVista {
  id: string
  corsoId: string
  corso: string
  colore?: string
  sala?: string
  istruttore?: string
  inizio: string
  fine: string
  stato: StatoSessione
  /** Quanti iscritti ha il corso, e quanti risultano già segnati presenti. */
  iscritti: number
  presenti: number
  /**
   * Chi fa questa lezione quel giorno, per id: il sostituto se c'è, altrimenti
   * gli istruttori del corso. Serve a mostrare a un istruttore solo le sue.
   */
  insegnanti?: string[]
}

/** Tutto quello che serve alla schermata di una lezione, in un colpo solo. */
export interface DettaglioSessione {
  sessione: SessioneVista
  note?: string
  /** L'elenco dell'appello, già in ordine di cognome. */
  elenco: Array<Persona & { stato: StatoPresenza | null }>
}

/** Il nome per esteso, nell'ordine in cui si legge un elenco. */
export const perEsteso = (p: { nome: string; cognome: string }) => `${p.cognome} ${p.nome}`

/**
 * L'ordine dell'appello: per cognome, come qualunque elenco di classe.
 * `localeCompare` con `it` perché le lettere accentate vanno dove uno se le
 * aspetta e non in fondo.
 */
export const perCognome = (a: Persona, b: Persona) =>
  a.cognome.localeCompare(b.cognome, 'it') || a.nome.localeCompare(b.nome, 'it')

/**
 * Il giorno locale di un istante ISO, come chiave `AAAA-MM-GG`: una lezione
 * alle 00:30 ora italiana è di quel giorno, anche se in UTC è ancora ieri.
 * Una data già `AAAA-MM-GG` resta com'è.
 */
export const giornoDi = (iso: string) => (iso.length === 10 ? iso : chiaveGiorno(new Date(iso)))

/** Se un'iscrizione vale il giorno `g` (`AAAA-MM-GG`): da `dal` ad `al` compresi, `al` vuoto vuol dire ancora iscritto. */
export const valeIl = (i: { dal: string; al: string | null }, g: string) => i.dal <= g && (!i.al || i.al >= g)

export const oraDi = (iso: string) =>
  new Date(iso).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })

const GIORNI = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato']
const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre']

/** «martedì 7 ottobre», che è come si dice a voce quando si guarda un orario. */
export function giornoPerEsteso(iso: string): string {
  const d = new Date(iso + (iso.length === 10 ? 'T12:00:00' : ''))
  return `${GIORNI[d.getDay()]} ${d.getDate()} ${MESI[d.getMonth()]}`
}

/** La chiave `AAAA-MM-GG` di una data locale, senza passare da UTC. */
export function chiaveGiorno(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
