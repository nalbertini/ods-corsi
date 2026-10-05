/**
 * I tipi della sala corsi.
 *
 * Sono lo specchio delle tabelle in `supabase/01-schema.sql`: se cambia una
 * colonna là, cambia un campo qui. Le date viaggiano come stringhe ISO perché
 * è quello che esce dal database e quello che entra in `localStorage`, e
 * convertirle una volta sola al momento di mostrarle costa meno che ricordarsi
 * a ogni passaggio se in mano si ha un `Date` o una stringa.
 */

import { paroleCercate, somiglia } from './nomi'

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
  /** I kanji di chi fa la lezione, uno per istruttore che ce l'ha (vedi `kanji.ts`). */
  kanji?: string
  /** Cosa si fa in questa lezione (vedi «Attività» in segreteria): assente se niente. */
  attivita?: string
  inizio: string
  fine: string
  stato: StatoSessione
  /** Quanti iscritti ha il corso, e quanti risultano già segnati presenti. */
  iscritti: number
  presenti: number
  /**
   * Di quei presenti, quanti sono venuti a provare (non sono fra gli
   * iscritti), e quanti iscritti non sono ancora segnati: a zero l'appello è
   * fatto. Senza, non si sa.
   */
  prove?: number
  daSegnare?: number
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
  /**
   * L'elenco dell'appello, già in ordine di cognome: gli iscritti, poi chi è
   * venuto a provare (`prova`, vedi `prove.ts`).
   */
  elenco: Array<Persona & { stato: StatoPresenza | null; prova?: boolean }>
}

/**
 * Dagli iscritti di quel giorno e dai segni della lezione (persona → stato),
 * quanti presenti sono venuti a provare e quanti iscritti mancano da segnare.
 */
export function contiDellAppello(iscritti: readonly { id: string }[], segni: ReadonlyMap<string, string> | Readonly<Record<string, string>> = new Map()) {
  const m = segni instanceof Map ? segni : new Map(Object.entries(segni))
  const qui = new Set(iscritti.map((p) => p.id))
  let prove = 0
  for (const [chi, stato] of m) if (stato === 'presente' && !qui.has(chi)) prove++
  return { prove, daSegnare: iscritti.filter((p) => !m.get(p.id)).length }
}

/** Il nome per esteso, nell'ordine in cui si legge un elenco. */
export const perEsteso = (p: { nome: string; cognome: string }) => `${p.cognome} ${p.nome}`

/**
 * Chi, nell'elenco dell'appello, somiglia a quel che si è scritto nella
 * ricerca: nome e cognome in qualunque ordine, senza badare a maiuscole,
 * accenti e apostrofi (`somiglia`). Senza niente scritto, tutti. L'ordine è
 * quello dato.
 */
export const cercaNellElenco = <T extends { nome: string; cognome: string }>(elenco: T[], scritto: string): T[] => {
  const parole = paroleCercate(scritto)
  return parole.length ? elenco.filter((p) => somiglia(p, parole)) : elenco
}

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

/** Il lunedì della settimana di una data, a mezzanotte. */
export function lunedi(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7))
  return x
}

/**
 * Tornando al calendario l'appello si chiude, e un nome scritto in PROVE e
 * non aggiunto (`provaScritta`) si perderebbe: la freccia lo chiede prima.
 */
export const domandaIndietro = (provaScritta?: string | null): string | undefined =>
  provaScritta ? `${provaScritta} NON AGGIUNTO · ESCI?` : undefined
