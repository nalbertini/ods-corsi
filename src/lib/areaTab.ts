// La pagina dell'iscritto divisa in tab: quali sono, la tastiera e il segno su
// DOCUMENTI. Il .tsx mostra e chiama.
import type { ComePaga, StatoCertificato } from './segreteria'
import { tastoLinguette, type SegnoScheda } from './schedaSezioni'
import { CONTATTI, chiama, whatsapp } from './sito'

export type IdTabArea = 'lezioni' | 'regola' | 'nucleo' | 'contatti'

const ETICHETTE: Record<IdTabArea, string> = { lezioni: 'LEZIONI', regola: 'DOCUMENTI', nucleo: 'NUCLEO', contatti: 'CONTATTI' }

export const TAB_INIZIALE: IdTabArea = 'lezioni'

export const etichettaTab = (id: IdTabArea) => ETICHETTE[id]

/** NUCLEO c'è solo per il titolare di un nucleo: gli altri non hanno niente da mettergli. CONTATTI è sempre l'ultimo. */
export const tabArea = (titolare: boolean): IdTabArea[] => (titolare ? ['lezioni', 'regola', 'nucleo', 'contatti'] : ['lezioni', 'regola', 'contatti'])

/** Con Alt, Ctrl o Cmd il tasto è del browser (Alt+← torna indietro): i tab non lo prendono. */
export const tastoTabArea = (
  ordine: readonly IdTabArea[],
  aperto: IdTabArea,
  e: { key: string; altKey?: boolean; ctrlKey?: boolean; metaKey?: boolean },
): IdTabArea | null => (e.altKey || e.ctrlKey || e.metaKey ? null : tastoLinguette(ordine, aperto, e.key))

/** Il tab da mostrare: se quello scelto non c'è più (NUCLEO senza più il titolare) si riparte da LEZIONI, se no la pagina resta vuota. */
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

/** Il conto dell'elenco unico di LEZIONI: le prossime e le presenze passate. */
export const contoElenco = (prossime: number, presenze: number) => `${prossime} + ${presenze}`
