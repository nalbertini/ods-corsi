import type { Exercise, Mode, Workout } from '../types'
import { uid } from './format'

/**
 * I controlli su quello che arriva da fuori.
 *
 * Un allenamento può entrare da un link inquadrato con la fotocamera o da un
 * file di ripristino: in tutti e due i casi è roba di cui non si sa niente —
 * può essere troncata, vecchia, scritta a mano per gioco. Invece di crederle
 * sulla parola, ogni campo viene riportato dentro i limiti dell'editor, che
 * sono gli stessi limiti entro cui un allenamento può essere costruito a mano.
 *
 * Stanno qui e non nei due posti che li usano perché un limite scritto due
 * volte è un limite che prima o poi diverge.
 */

export const MODI: Mode[] = ['interval', 'circuit', 'emom', 'amrap', 'fortime']

/** Massimi che valgono per tutto ciò che entra: elenchi, non infiniti. */
export const MAX_ESERCIZI = 50
export const MAX_TIMER = 500
export const MAX_CATALOGO = 1000
export const MAX_STORICO = 200

export function numeroSano(v: unknown, min: number, max: number, ripiego: number): number {
  const n = Number(v)
  if (!Number.isFinite(n)) return ripiego
  // Mezzi passi ammessi: i carichi si scrivono anche con la virgola.
  return Math.min(max, Math.max(min, Math.round(n * 2) / 2))
}

export function testoSano(v: unknown, max: number): string {
  return typeof v === 'string' ? v.slice(0, max).trim() : ''
}

/** Un esercizio riportato dentro i limiti, o niente se non ha nemmeno un nome. */
export function esercizioSano(v: unknown): Exercise | null {
  const o = (v ?? {}) as Record<string, unknown>
  const name = testoSano(o.name, 60)
  if (!name) return null
  const ex: Exercise = { id: testoSano(o.id, 40) || uid(), name }
  if (numeroSano(o.duration, 0, 600, 0) > 0) ex.duration = numeroSano(o.duration, 5, 600, 30)
  if (numeroSano(o.sets, 0, 20, 0) > 0) ex.sets = numeroSano(o.sets, 1, 20, 1)
  if (numeroSano(o.reps, 0, 200, 0) > 0) ex.reps = numeroSano(o.reps, 1, 200, 1)
  if (numeroSano(o.kg, 0, 500, 0) > 0) ex.kg = numeroSano(o.kg, 0.5, 500, 1)
  return ex
}

/**
 * Un allenamento riportato dentro i limiti.
 *
 * `nuovoId` serve a distinguere i due casi: un timer che arriva da un link è
 * una copia e deve avere un'identità sua, mentre un ripristino rimette a posto
 * i timer di chi li ha scritti, e lì l'identità va conservata.
 */
export function workoutSano(v: unknown, nuovoId = true): Workout | null {
  if (!v || typeof v !== 'object') return null
  const o = v as Record<string, unknown>
  const name = testoSano(o.name, 60)
  const mode = MODI.includes(o.mode as Mode) ? (o.mode as Mode) : 'interval'
  const esercizi = Array.isArray(o.exercises) ? o.exercises.slice(0, MAX_ESERCIZI) : []
  return {
    id: nuovoId ? uid() : testoSano(o.id, 40) || uid(),
    name: name || 'Timer senza nome',
    mode,
    prepare: numeroSano(o.prepare, 0, 120, 20),
    work: numeroSano(o.work, 5, 600, 30),
    rest: numeroSano(o.rest, 0, 600, 15),
    rounds: numeroSano(o.rounds, 1, 99, 8),
    sets: numeroSano(o.sets, 1, 20, 1),
    setRest: numeroSano(o.setRest, 0, 600, 60),
    cooldown: numeroSano(o.cooldown, 0, 900, 0),
    duration: numeroSano(o.duration, 60, 5400, 600),
    exercises: esercizi.map(esercizioSano).filter((e): e is Exercise => e !== null),
    updatedAt: numeroSano(o.updatedAt, 0, Number.MAX_SAFE_INTEGER, Date.now()),
  }
}
