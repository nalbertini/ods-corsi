/**
 * Le parole di stato dell'appello e del calendario. Il segno davanti (… ✕ ✓)
 * dice lo stato anche a chi non distingue i colori: il colore da solo non basta.
 * Il `tono` sceglie il colore nel CSS; senza tono la parola non è uno stato.
 */
export type Tono = 'aspetta' | 'manca' | 'fatto'

export const NON_ANCORA_COMINCIATA = '… NON ANCORA COMINCIATA'

export function statoAppello(a: {
  soloLettura: boolean
  tuttiSegnati: boolean
  tuttiAssenti: boolean
  mancano: number
  proveMancano: number
  /** C'è un tasto per chiudere l'appello (l'istruttore può chiuderlo). */
  haChiudi: boolean
}): { testo: string; tono: Tono; tasto?: true } {
  if (a.soloLettura) return { testo: '… SOLO LETTURA', tono: 'aspetta' }
  if (a.tuttiAssenti) return { testo: '✕ TUTTI ASSENTI', tono: 'manca' }
  if (a.tuttiSegnati) return a.haChiudi ? { testo: 'CHIUDI IN FONDO ↓', tono: 'fatto', tasto: true } : { testo: '✓ TUTTI SEGNATI', tono: 'fatto' }
  return { testo: a.mancano ? `… ${a.mancano} DA SEGNARE` : `… ${a.proveMancano} PROVA DA SEGNARE`, tono: 'aspetta' }
}

/** Vuota senza coda: la testa dell'appello non cambia altezza. */
export const codaAppello = (n: number): string => (n > 0 ? `… ${n} DA INVIARE` : '')

/** Sempre lo stesso tasto: un altro comparso al suo posto prenderebbe il secondo tocco. */
export function tastoAppello(a: { segnatiIscritti: number; tuttiAssenti: boolean; tuttiSegnati: boolean }): string {
  if (a.segnatiIscritti === 0 || a.tuttiAssenti) return 'TUTTI PRESENTI'
  return a.tuttiSegnati ? 'TUTTI SEGNATI' : 'GLI ALTRI PRESENTI'
}

export function statoLezione(l: { manca: boolean; iniziato: boolean; fatto: boolean; presentiIscritti: number }): { testo: string; tono?: Tono } {
  if (l.manca) return { testo: '✕ DA CHIUDERE', tono: 'manca' }
  if (!l.iniziato) return { testo: 'ISCRITTI' }
  if (l.fatto) return l.presentiIscritti > 0 ? { testo: '✓ FATTO', tono: 'fatto' } : { testo: '… NESSUN PRESENTE', tono: 'aspetta' }
  return { testo: '… IN CORSO', tono: 'aspetta' }
}

export const proveInPiu = (n: number): string => `+${n} PROVA`
