import type { Segment, Workout } from '../types'

/**
 * L'allenamento interrotto.
 *
 * Una telefonata, uno swipe di troppo, il tablet che si addormenta, la
 * batteria: senza questo, riaprendo l'app si tornava a zero, e del quarto giro
 * su otto non restava traccia. Ogni due secondi si segna dove si è arrivati,
 * e alla riapertura si può riprendere da lì.
 *
 * Si salvano anche i segmenti, non solo il nome dell'allenamento: quando
 * Maurizio è acceso le durate sono state estratte a sorte all'avvio, e
 * ricostruirle daterebbe un allenamento diverso da quello in corso — lo stesso
 * secondo cadrebbe in un punto che non è quello dove ci si era fermati.
 */
export interface Interrotto {
  workout: Workout
  segments: Segment[]
  /** Secondi svolti al momento dell'ultimo salvataggio. */
  elapsed: number
  /** Quando è stato salvato, per non proporre l'allenamento di ieri sera. */
  quando: number
}

const CHIAVE = 'ods-timer:interrotto'

/** Oltre questo, riprendere non ha senso: la lezione è finita da un pezzo. */
const VALIDO_PER = 6 * 60 * 60 * 1000

/** Sotto questo non vale la pena chiedere: si è appena premuto avvia. */
const MINIMO = 15

export function salvaInterrotto(r: Interrotto) {
  try {
    localStorage.setItem(CHIAVE, JSON.stringify(r))
  } catch {
    // Spazio esaurito o storage negato: si perde solo la ripresa.
  }
}

export function leggiInterrotto(): Interrotto | null {
  try {
    const grezzo = localStorage.getItem(CHIAVE)
    if (!grezzo) return null
    const r = JSON.parse(grezzo) as Interrotto
    const sano =
      r &&
      typeof r === 'object' &&
      r.workout &&
      Array.isArray(r.segments) &&
      r.segments.length > 0 &&
      typeof r.elapsed === 'number' &&
      r.elapsed >= MINIMO &&
      Date.now() - r.quando < VALIDO_PER
    return sano ? r : null
  } catch {
    return null
  }
}

export function scordaInterrotto() {
  try {
    localStorage.removeItem(CHIAVE)
  } catch {
    // Niente da fare, e niente di grave.
  }
}

/** «Giro 4 di 8», o lo stato in cui ci si è fermati. */
export function doveEraRimasto(r: Interrotto): string {
  let i = r.segments.length - 1
  while (i > 0 && r.segments[i].offset > r.elapsed) i--
  const s = r.segments[i]
  if (!s) return ''
  if (s.kind === 'work' && s.rounds > 1) return `giro ${s.round} di ${s.rounds}`
  return s.label.toLowerCase()
}
