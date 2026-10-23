// La pagina dell'iscritto divisa in tab: quali sono, la tastiera e il segno su
// DOCUMENTI. Il .tsx mostra e chiama.
import type { ComePaga, StatoCertificato } from './segreteria'
import { tastoLinguette, type SegnoScheda } from './schedaSezioni'
import { CONTATTI, chiama, whatsapp } from './sito'
import type { MiaLezione, MiaPresenza } from './iscritto'
import { chiaveGiorno, giornoPerEsteso, type StatoPresenza } from './sala'
import type { StatoSegnalata } from './segnalate'

export type IdTabArea = 'lezioni' | 'regola' | 'nucleo' | 'contatti'

const ETICHETTE: Record<IdTabArea, string> = { lezioni: 'LEZIONI', regola: 'DOCUMENTI', nucleo: 'FAMIGLIA', contatti: 'CONTATTI' }

export const TAB_INIZIALE: IdTabArea = 'lezioni'

export const etichettaTab = (id: IdTabArea) => ETICHETTE[id]

/** FAMIGLIA c'è solo per il titolare di un nucleo: gli altri non hanno niente da mettergli. CONTATTI è sempre l'ultimo. */
export const tabArea = (titolare: boolean): IdTabArea[] => (titolare ? ['lezioni', 'regola', 'nucleo', 'contatti'] : ['lezioni', 'regola', 'contatti'])

/** Con Alt, Ctrl o Cmd il tasto è del browser (Alt+← torna indietro): i tab non lo prendono. */
export const tastoTabArea = (
  ordine: readonly IdTabArea[],
  aperto: IdTabArea,
  e: { key: string; altKey?: boolean; ctrlKey?: boolean; metaKey?: boolean },
): IdTabArea | null => (e.altKey || e.ctrlKey || e.metaKey ? null : tastoLinguette(ordine, aperto, e.key))

/** Il tab da mostrare: se quello scelto non c'è più (FAMIGLIA senza più il titolare) si riparte da LEZIONI, se no la pagina resta vuota. */
export const tabAperto = (ordine: readonly IdTabArea[], scelto: IdTabArea): IdTabArea => (ordine.includes(scelto) ? scelto : TAB_INIZIALE)

/** Gli id di linguetta e pannello: un posto solo, se no il collegamento fra i due si rompe senza errori. */
export const idTab = (id: IdTabArea) => `area-tab-${id}`
export const idPannelloTab = (id: IdTabArea) => `area-pan-${id}`

/** Il segno su DOCUMENTI: DA SISTEMARE se certificato o quota non vanno, del tono del peggiore. */
export function segnoInRegola(cert: StatoCertificato, quota: ComePaga): SegnoScheda | null {
  const rosso = cert === 'manca' || cert === 'scaduto' || quota === 'da_pagare' || quota === 'scaduto'
  const giallo = cert === 'in_scadenza' || cert === 'in_arrivo' || quota === 'in_parte'
  return rosso ? { parola: 'DA SISTEMARE', tono: 'rosso' } : giallo ? { parola: 'DA SISTEMARE', tono: 'giallo' } : null
}

/** Una riga di CONTATTI: un link (`href`) o, per ESCI, un'azione. `nota` è il dettaglio a destra del nome. */
export interface VoceContatti {
  nome: string
  nota?: string
  href?: string
  esci?: true
}

/** Il tab CONTATTI: tutto quel che serve per parlare con la palestra, in righe. ESCI c'è solo con l'accesso vero: in prova non c'è chi uscire. */
export const gruppiContatti = ({ guida, conEsci }: { guida: string; conEsci: boolean }): { titolo: string; voci: VoceContatti[] }[] => [
  {
    titolo: 'SEGRETERIA',
    voci: [
      { nome: 'CHIAMA', nota: CONTATTI.telefono, href: chiama },
      { nome: 'WHATSAPP', href: whatsapp },
      { nome: 'COME ARRIVARE', nota: 'Via V. Sassi 26', href: CONTATTI.mappa },
    ],
  },
  { titolo: 'SEGUICI', voci: [{ nome: 'INSTAGRAM', href: CONTATTI.instagram }, { nome: 'FACEBOOK', href: CONTATTI.facebook }] },
  { titolo: 'LA TUA PAGINA', voci: [{ nome: 'GUIDA', href: guida }, ...(conEsci ? [{ nome: 'ESCI', esci: true as const }] : [])] },
]

/**
 * LEZIONI: la prossima in evidenza, poi le altre in ordine di data.
 * Una lezione annullata non è «la prossima»: resta nell'elenco, con ANNULLATA.
 */
export function elencoLezioni(lezioni: MiaLezione[]) {
  const ordinate = [...lezioni].sort((a, b) => a.inizio.localeCompare(b.inizio))
  const prossima = ordinate.find((l) => l.stato !== 'annullata') ?? null
  return { prossima, seguenti: ordinate.filter((l) => l !== prossima) }
}

const LEZIONI_VISTE = 5

/** Le lezioni dopo la prossima che si vedono: cinque, e VEDI TUTTE (`piu`) solo se ce n'è di più. */
export function lezioniViste<T>(seguenti: T[], tutte: boolean): { viste: T[]; piu: boolean } {
  return { viste: tutte ? seguenti : seguenti.slice(0, LEZIONI_VISTE), piu: seguenti.length > LEZIONI_VISTE }
}

/** «1 ANNULLATA», «2 ANNULLATE»: il conto a destra di LE TUE LEZIONI. */
export const contoAnnullate = (n: number) => `${n} ${n === 1 ? 'ANNULLATA' : 'ANNULLATE'}`

/** Quanto manca a una lezione, in giorni di calendario: OGGI, DOMANI, FRA 4 GIORNI. */
export function fraQuanto(inizio: string, ora: Date): string {
  const giorni = (g: string) => Date.UTC(...(g.split('-').map(Number) as [number, number, number])) / 86_400_000
  const n = Math.round(giorni(chiaveGiorno(new Date(inizio))) - giorni(chiaveGiorno(ora)))
  return n <= 0 ? 'OGGI' : n === 1 ? 'DOMANI' : `FRA ${n} GIORNI`
}

type TonoCosa = 'guaio' | 'avviso'
/** Quale icona a linea sta davanti a cosa cambia: l'ordine dei pezzi è quello del testo. */
export type IconaCosa = 'annullata' | 'sostituto' | 'piu' | 'sala'

/** Quello che cambia rispetto al solito, per una lezione: ANNULLATA vince su tutto, l'icona è del primo pezzo. */
export function cosaCambia(l: MiaLezione): { testo: string; frase: string; tono: TonoCosa; icona: IconaCosa } | null {
  if (l.stato === 'annullata') return { testo: 'ANNULLATA', frase: 'Annullata', tono: 'guaio', icona: 'annullata' }
  const pezzi: Array<[string, IconaCosa]> = []
  if (l.straordinaria) pezzi.push(['IN PIÙ', 'piu'])
  if (l.sostituto) pezzi.push(['SOSTITUTO', 'sostituto'])
  if (l.altraSala) pezzi.push([`IN ${l.sala ? l.sala.toUpperCase() : 'UN’ALTRA SALA'}`, 'sala'])
  if (!pezzi.length) return null
  const testo = pezzi.map(([t]) => t).join(' · ')
  return { testo, frase: testo.charAt(0) + testo.slice(1).toLowerCase(), tono: 'avviso', icona: pezzi[0][1] }
}

/** La riga sotto il corso: l'istruttore e il giorno. La sala non c'è: se è diversa la dice `cosaCambia`. */
export function sottoLezione(l: MiaLezione): { pezzi: string[]; icona: 'istruttore' | 'giorno' } {
  const pezzi = [l.istruttore, giornoPerEsteso(chiaveGiorno(new Date(l.inizio)))].filter((x): x is string => !!x)
  return { pezzi, icona: pezzi.length > 1 ? 'istruttore' : 'giorno' }
}

/** Le presenze in piccolo in cima: le ultime tre, dalla più recente (l'ordine non lo prendiamo per buono). */
export const ultimePresenze = (presenze: MiaPresenza[]) => [...presenze].sort((a, b) => b.inizio.localeCompare(a.inizio)).slice(0, 3)

/** SEGNALA c'è dove non risulta presente né giustificato e non c'è già una segnalazione. */
export const puoSegnalare = (stato: StatoPresenza | null, segnalata?: StatoSegnalata) => !segnalata && stato !== 'presente' && stato !== 'giustificato'


export type IconaPresenza = 'presente' | 'assente' | 'giustificato' | 'niente'

/** Il segno di una presenza: l'icona, la parola e il tono. Una segnalazione ancora aperta prende il posto della parola. */
export function segnoPresenza(stato: StatoPresenza | null, segnalata?: StatoSegnalata): { icona: IconaPresenza; parola: string; tono: 'fatto' | 'guaio' | 'avviso' | 'spento' } {
  const base = stato === 'presente' ? { icona: 'presente' as const, parola: 'PRESENTE', tono: 'fatto' as const }
    : stato === 'assente' ? { icona: 'assente' as const, parola: 'ASSENTE', tono: 'guaio' as const }
    : stato === 'giustificato' ? { icona: 'giustificato' as const, parola: 'GIUSTIFICATO', tono: 'spento' as const }
    : { icona: 'niente' as const, parola: 'NON SEGNATO', tono: 'spento' as const }
  if (segnalata === 'da_vedere') return { ...base, parola: 'DA CONFERMARE', tono: 'avviso' }
  if (segnalata === 'rifiutata') return { ...base, parola: 'RIFIUTATA', tono: 'guaio' }
  return base
}

/** «mer 21 ott»: il giorno in breve, per i box piccoli (tre lettere di giorno e di mese). */
export function quandoBreve(inizio: string): string {
  const [giorno, n, mese] = giornoPerEsteso(chiaveGiorno(new Date(inizio))).split(' ')
  return `${giorno.slice(0, 3)} ${n} ${mese.slice(0, 3)}`
}
