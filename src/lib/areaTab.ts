// La pagina dell'iscritto divisa in tab: quali sono, la tastiera e il segno su
// IN REGOLA. Il .tsx mostra e chiama.
import type { ComePaga, StatoCertificato } from './segreteria'
import { tastoLinguette, type SegnoScheda } from './schedaSezioni'

export type IdTabArea = 'lezioni' | 'regola' | 'nucleo'

const ETICHETTE: Record<IdTabArea, string> = { lezioni: 'LEZIONI', regola: 'IN REGOLA', nucleo: 'NUCLEO' }

export const TAB_INIZIALE: IdTabArea = 'lezioni'

export const etichettaTab = (id: IdTabArea) => ETICHETTE[id]

/** NUCLEO c'è solo per il titolare di un nucleo: gli altri non hanno niente da mettergli. */
export const tabArea = (titolare: boolean): IdTabArea[] => (titolare ? ['lezioni', 'regola', 'nucleo'] : ['lezioni', 'regola'])

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

/** Il segno su IN REGOLA: DA SISTEMARE se certificato o quota non vanno, del tono del peggiore. */
export function segnoInRegola(cert: StatoCertificato, quota: ComePaga): SegnoScheda | null {
  const rosso = cert === 'manca' || cert === 'scaduto' || quota === 'da_pagare' || quota === 'scaduto'
  const giallo = cert === 'in_scadenza' || cert === 'in_arrivo' || quota === 'in_parte'
  return rosso ? { parola: 'DA SISTEMARE', tono: 'rosso' } : giallo ? { parola: 'DA SISTEMARE', tono: 'giallo' } : null
}
