import { buildSegments, eserciziDellaSerie } from './engine'
import { uid } from './format'
import type { Exercise, Segment, Workout } from '../types'

/** Una riga dell'anteprima: l'intervallo, e l'esercizio che il tocco cambia. */
export interface Riga {
  segment: Segment
  esercizioId?: string
  /** Falso sulle righe di un intervallo che si fa insieme (amrap, for time): la durata è una sola. */
  durata: boolean
}

/**
 * Le righe dell'anteprima di un timer, o di una sua serie (`vista` > 0).
 *
 * Gli esercizi si scelgono qui, toccando la riga di un round. Amrap e for time
 * hanno un solo intervallo per tutti gli esercizi: lì una riga per esercizio,
 * altrimenti non ci sarebbe niente da toccare.
 */
export function righeAnteprima(w: Workout, vista: number): Riga[] {
  const segs = buildSegments(w)
  const lista = vista === 0 ? segs : segs.filter((s) => s.set === vista && s.kind !== 'prepare' && s.kind !== 'cooldown')
  const insieme = w.mode === 'amrap' || w.mode === 'fortime'
  return lista.flatMap((segment): Riga[] => {
    if (!insieme || segment.kind !== 'work') return [{ segment, esercizioId: segment.esercizioId, durata: true }]
    const esercizi = eserciziDellaSerie(w, segment.set)
    if (!esercizi.length) return [{ segment, durata: true }]
    return esercizi.map((e, i) => ({ segment, esercizioId: e.id, durata: i === 0 }))
  })
}

/**
 * Il tocco su una riga. Con `bersaglio` cambia quell'esercizio (con il suo
 * obiettivo non c'entra più: era di un altro), senza ne aggiunge in fondo: è
 * un round che non ne ha ancora, e da lì i nomi si alternano. Se se ne scelgono
 * più d'uno, il primo prende la riga e gli altri vanno in fondo.
 */
export function applicaScelta(esercizi: Exercise[], bersaglio: string | undefined, nomi: string[], serie?: number): Exercise[] {
  const da = bersaglio ? esercizi.findIndex((e) => e.id === bersaglio) : -1
  const nuovi = (da >= 0 ? nomi.slice(1) : nomi).map((name): Exercise => ({ id: uid(), name, ...(serie ? { serie } : {}) }))
  const base =
    da >= 0 && nomi.length
      ? esercizi.map((e, i): Exercise => (i === da ? { id: e.id, name: nomi[0], ...(e.duration ? { duration: e.duration } : {}), ...(e.serie ? { serie: e.serie } : {}) } : e))
      : esercizi
  return [...base, ...nuovi]
}
