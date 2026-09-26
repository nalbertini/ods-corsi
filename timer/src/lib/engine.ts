import type { CoachLevel, Exercise, Mode, Segment, Workout } from '../types'

export const MODE_LABEL: Record<Mode, string> = {
  interval: 'Intervalli',
  circuit: 'Circuito',
  emom: 'EMOM',
  amrap: 'AMRAP',
  fortime: 'For Time',
}

export const MODE_BADGE: Record<Mode, string> = {
  interval: 'INTERVALLI',
  circuit: 'CIRCUITO',
  emom: 'EMOM',
  amrap: 'AMRAP',
  fortime: 'FOR TIME',
}

/** Il colore con cui uno schema si riconosce nelle liste e nell'editor. */
export const MODE_TINT: Record<Mode, string> = {
  interval: 'var(--rosso)',
  circuit: 'var(--blu)',
  emom: 'var(--verde)',
  amrap: 'var(--giallo)',
  fortime: 'var(--blu)',
}

export const MODE_HINT: Record<Mode, string> = {
  interval: 'Lavoro e recupero che si alternano, per il numero di round che scegli.',
  circuit: 'Stazioni in sequenza, ognuna con la sua durata, ripetute a giri.',
  emom: 'Un esercizio all’inizio di ogni minuto: quello che avanza è recupero.',
  amrap: 'Un solo cronometro alla rovescia: più giri possibili nel tempo dato.',
  fortime: 'Cronometro che sale, con un tempo limite oltre cui si ferma.',
}

/** Quali parametri conta davvero ciascuno schema: guida l'editor e il riepilogo. */
export const MODE_FIELDS: Record<Mode, Array<keyof Workout>> = {
  interval: ['prepare', 'work', 'rest', 'rounds', 'sets', 'setRest', 'cooldown'],
  circuit: ['prepare', 'rest', 'rounds', 'sets', 'setRest', 'cooldown'],
  emom: ['prepare', 'work', 'rounds', 'sets', 'setRest', 'cooldown'],
  amrap: ['prepare', 'duration', 'sets', 'setRest', 'cooldown'],
  fortime: ['prepare', 'duration', 'cooldown'],
}

/**
 * L'obiettivo di un esercizio impaginato: `3×10 · 16 kg`.
 *
 * È un promemoria, non un parametro: il timer continua a scandire il tempo con
 * durate e round dell'allenamento, e questa riga sta lì solo per dire cosa
 * farci dentro. Le parti mancanti spariscono invece di comparire a zero.
 */
export function descriviObiettivo(ex: Pick<Exercise, 'sets' | 'reps' | 'kg'>): string {
  const parti: string[] = []
  const { sets, reps, kg } = ex
  if (sets && reps) parti.push(`${sets}×${reps}`)
  else if (reps) parti.push(`${reps} rip.`)
  else if (sets) parti.push(`${sets} serie`)
  if (kg) parti.push(`${Number(kg.toFixed(1))} kg`)
  return parti.join(' · ')
}

const KIND_LABEL = {
  prepare: 'PREPARATI',
  work: 'LAVORO',
  rest: 'RECUPERO',
  setRest: 'RIPOSO',
  cooldown: 'DEFATICAMENTO',
} as const

/**
 * Espande un allenamento nella sequenza piatta di segmenti che il timer percorre.
 * Tenere qui tutta la logica di schema rende il runtime banale: scorre una lista.
 */
export function buildSegments(w: Workout): Segment[] {
  const out: Segment[] = []
  let offset = 0

  const push = (s: Omit<Segment, 'offset'>) => {
    if (s.duration <= 0) return
    out.push({ ...s, offset })
    offset += s.duration
  }

  const sets = Math.max(1, w.sets)
  const rounds = Math.max(1, w.rounds)
  const names = w.exercises.filter((e) => e.name.trim().length > 0)
  const exAt = (i: number): Exercise | null => (names.length ? names[i % names.length] : null)
  const nota = (ex: Exercise | null) => {
    const testo = ex ? descriviObiettivo(ex) : ''
    return testo ? { nota: testo } : {}
  }

  if (w.prepare > 0) {
    push({
      kind: 'prepare',
      label: KIND_LABEL.prepare,
      name: 'Mettiti in posizione',
      duration: w.prepare,
      round: 0,
      rounds,
      set: 1,
      sets,
    })
  }

  for (let set = 1; set <= sets; set++) {
    if (w.mode === 'amrap' || w.mode === 'fortime') {
      push({
        kind: 'work',
        label: w.mode === 'amrap' ? 'AMRAP' : 'FOR TIME',
        name: names.length ? names.map((e) => e.name).join(' · ') : 'Giro libero',
        duration: w.duration,
        countUp: w.mode === 'fortime',
        round: 1,
        rounds: 1,
        set,
        sets,
      })
    } else if (w.mode === 'circuit') {
      for (let round = 1; round <= rounds; round++) {
        const stations = names.length ? names : [{ id: 'x', name: 'Stazione' }]
        stations.forEach((ex, i) => {
          push({
            kind: 'work',
            label: KIND_LABEL.work,
            name: ex.name,
            duration: ex.duration && ex.duration > 0 ? ex.duration : w.work,
            round,
            rounds,
            set,
            sets,
            ...nota(ex),
          })
          const isVeryLast = set === sets && round === rounds && i === stations.length - 1
          if (!isVeryLast) {
            push({
              kind: 'rest',
              label: KIND_LABEL.rest,
              name: 'Cambio stazione',
              duration: w.rest,
              round,
              rounds,
              set,
              sets,
            })
          }
        })
      }
    } else {
      // interval ed emom: stessa forma, l'emom semplicemente non ha recupero.
      for (let round = 1; round <= rounds; round++) {
        const ex = exAt(round - 1)
        push({
          kind: 'work',
          label: KIND_LABEL.work,
          name: ex ? ex.name : 'Lavoro',
          duration: w.work,
          round,
          rounds,
          set,
          sets,
          ...nota(ex),
        })
        const isVeryLast = set === sets && round === rounds
        if (w.mode === 'interval' && !isVeryLast) {
          push({
            kind: 'rest',
            label: KIND_LABEL.rest,
            name: 'Respira',
            duration: w.rest,
            round,
            rounds,
            set,
            sets,
          })
        }
      }
    }

    if (set < sets) {
      push({
        kind: 'setRest',
        label: KIND_LABEL.setRest,
        name: `Fine serie ${set} di ${sets}`,
        duration: w.setRest,
        round: rounds,
        rounds,
        set,
        sets,
      })
    }
  }

  if (w.cooldown > 0) {
    push({
      kind: 'cooldown',
      label: KIND_LABEL.cooldown,
      name: 'Allunga e respira',
      duration: w.cooldown,
      round: rounds,
      rounds,
      set: sets,
      sets,
    })
  }

  return out
}

export function totalDuration(w: Workout): number {
  const segs = buildSegments(w)
  const last = segs[segs.length - 1]
  return last ? last.offset + last.duration : 0
}

/** Riga di struttura mostrata sotto il nome nelle liste. */
export function describe(w: Workout): string {
  const q = (n: number) => `${n}"`
  switch (w.mode) {
    case 'interval':
      return `${w.rounds} × ${q(w.work)}/${q(w.rest)}${w.sets > 1 ? ` · ${w.sets} serie` : ''}`
    case 'circuit': {
      const n = w.exercises.length || 1
      return `${n} stazioni × ${w.rounds} giri${w.sets > 1 ? ` · ${w.sets} serie` : ''}`
    }
    case 'emom':
      return `${w.rounds} slot da ${q(w.work)}${w.sets > 1 ? ` · ${w.sets} serie` : ''}`
    case 'amrap':
      return `giro libero · ${Math.round(w.duration / 60)} minuti`
    case 'fortime':
      return `cronometro in salita · limite ${Math.round(w.duration / 60)} min`
  }
}


/* ------------------------------------------------------------------ *
 * Modalità Maurizio
 *
 * L'allenatore che «perde il conto» per farti lavorare qualche secondo
 * in più. Due parti distinte, e tenerle separate è ciò che rende la cosa
 * gestibile:
 *
 *  1. il tempo in più è deciso all'avvio e cucito dentro la durata dei
 *     segmenti, così offset, barra di avanzamento e durata totale restano
 *     coerenti e il motore non sa nulla di tutto questo;
 *  2. la sceneggiata è solo nel numero mostrato, che negli ultimi secondi
 *     torna indietro invece di scendere dritto.
 * ------------------------------------------------------------------ */

export interface CoachOptions {
  /** Quanti intervalli di lavoro vengono toccati, da 0 a 1. */
  probability: number
  /** Quante esitazioni dentro un intervallo. */
  minEventi: number
  maxEventi: number
  /** Secondi regalati da ogni singola esitazione. */
  minExtra: number
  maxExtra: number
  /** Quanto spesso si inventa un giro in più alla fine, da 0 a 1. */
  giroExtra: number
}

export const COACH_LEVELS: Record<CoachLevel, CoachOptions | null> = {
  off: null,
  distratto: { probability: 0.3, minEventi: 1, maxEventi: 1, minExtra: 1, maxExtra: 2, giroExtra: 0.12 },
  classico: { probability: 0.55, minEventi: 1, maxEventi: 2, minExtra: 1, maxExtra: 3, giroExtra: 0.25 },
  spietato: { probability: 0.85, minEventi: 1, maxEventi: 3, minExtra: 2, maxExtra: 4, giroExtra: 0.5 },
}

export const COACH_LABEL: Record<CoachLevel, string> = {
  off: 'Spenta',
  distratto: 'Distratto',
  classico: 'Classico',
  spietato: 'Spietato',
}

export const COACH_HINT: Record<CoachLevel, string> = {
  off: 'Il timer conta onestamente.',
  distratto: 'Ogni tanto perde il filo, e per poco.',
  classico: 'Il Maurizio di tutti i giorni: succede a circa un intervallo su due.',
  spietato: 'Sbaglia quasi sempre, anche più volte nello stesso intervallo. E il giro in più è quasi una certezza.',
}

/** Le frasi che gli scappano quando lo becchi a sbagliare. */
export const COACH_LINES = [
  'Ho perso il conto, ricominciamo',
  'No aspetta, tre',
  'Ancora un attimo',
  'Eh no, quello non valeva',
  'Dai che è quasi finita',
  'Scusate, mi sono distratto',
]

/** Le frasi con cui si inventa un giro che non era in programma. */
export const EXTRA_LINES = [
  'Ancora uno, l’ultimo non valeva',
  'Ne manca uno, me n’ero dimenticato',
  'Dai, l’ultimo giro. Questo sì',
]

/**
 * I complimenti di fine tempo: quando un conto arriva a zero e la modalità è
 * accesa, Maurizio compare con una di queste. Sono corte di proposito — vanno
 * lette in un'occhiata da chi ha appena finito e sta ancora respirando.
 */
export const FINALE_LINES = [
  'Bravi, così si fa',
  'Ottimo lavoro',
  'Visto? Ce l’avete fatta',
  'Questo sì che era un tempo',
  'Grandi, tutti quanti',
  'E anche questo è andato',
]

/** L'etichetta di stato del giro in più, al posto di LAVORO. */
export const EXTRA_LABEL = 'ANCORA UNO'

/**
 * Il giro che Maurizio si inventa quando l'allenamento sarebbe finito.
 *
 * È una copia dell'ultimo intervallo di lavoro, infilata subito dopo, con lo
 * stesso numero di giro: il contatore non avanza, esattamente come chi sostiene
 * che quello di prima non contava. Gli offset li rifà `applyCoach` subito dopo,
 * quindi qui basta inserire il segmento al posto giusto.
 */
function giroInPiu(segments: Segment[], opts: CoachOptions, rand: () => number): Segment[] {
  if (rand() >= opts.giroExtra) return segments
  const lavori = segments.filter((s) => s.kind === 'work' && !s.countUp)
  // Serve una struttura a giri: un AMRAP è un unico blocco lunghissimo, e
  // raddoppiarlo non è uno scherzo, è un altro allenamento.
  if (lavori.length < 2) return segments
  const ultimo = lavori[lavori.length - 1]
  if (ultimo.duration < 5 || ultimo.duration > 180) return segments
  const i = segments.lastIndexOf(ultimo)
  const extra: Segment = {
    ...ultimo,
    label: EXTRA_LABEL,
    display: undefined,
    extra: Math.floor(rand() * EXTRA_LINES.length),
  }
  return [...segments.slice(0, i + 1), extra, ...segments.slice(i + 1)]
}

const intero = (rand: () => number, min: number, max: number) => min + Math.floor(rand() * (max - min + 1))

/**
 * Costruisce il conto alla rovescia mostrato per un intervallo, con le sue
 * esitazioni.
 *
 * Invece di una formula che produce sempre lo stesso rimbalzo alla stessa
 * distanza dalla fine, si genera la sequenza completa dei numeri da mostrare,
 * un elemento per secondo. Le esitazioni cadono in punti a caso e sono di due
 * tipi: si inceppa su un numero, oppure torna indietro e riscende. La durata
 * dell'intervallo è semplicemente la lunghezza della sequenza.
 */
export function hesitantCountdown(base: number, opts: CoachOptions, rand: () => number): number[] {
  const seq: number[] = []
  for (let n = base; n >= 1; n--) seq.push(n)

  const eventi = intero(rand, opts.minEventi, opts.maxEventi)
  for (let e = 0; e < eventi; e++) {
    // Mai sul primo secondo (non si è ancora contato niente) né dopo l'ultimo.
    const i = intero(rand, 1, seq.length - 1)
    const val = seq[i]
    const extra = intero(rand, opts.minExtra, opts.maxExtra)

    if (rand() < 0.3) {
      // Si inceppa: il numero resta lì qualche secondo. Tenuto corto, perché
      // un numero fermo a lungo sembra l'app bloccata più che una gag.
      seq.splice(i + 1, 0, ...Array(Math.min(extra, 2)).fill(val))
    } else {
      // Torna indietro e riscende: «dodici… tredici? dodici… undici».
      // Il blocco è di lunghezza pari e chiude su `val`, così il numero
      // successivo della sequenza originale, val - 1, segue senza salti.
      const passi = Math.max(2, extra % 2 === 0 ? extra : extra + 1)
      const blocco: number[] = []
      for (let k = 0; k < passi; k++) blocco.push(k % 2 === 0 ? val + 1 : val)
      seq.splice(i + 1, 0, ...blocco)
    }
  }

  // Due esitazioni capitate vicine possono lasciare lo stesso numero fermo per
  // molti secondi, e un numero fermo a lungo è l'unica cosa che sembra un
  // blocco dell'app invece di una gag: non più di due secondi uguali di fila.
  return seq.filter((v, i) => !(i >= 2 && seq[i - 1] === v && seq[i - 2] === v))
}

/**
 * Allunga gli intervalli di lavoro e ricalcola gli offset. Restituisce una
 * nuova lista: i segmenti in ingresso non vengono toccati.
 */
export function applyCoach(segments: Segment[], level: CoachLevel, rand: () => number = Math.random): Segment[] {
  const opts = COACH_LEVELS[level]
  if (!opts) return segments

  let offset = 0
  // Prima il giro in più, poi le esitazioni: così anche quello può incepparsi.
  return giroInPiu(segments, opts, rand).map((seg) => {
    // Solo il lavoro si allunga: sul recupero Maurizio conta benissimo. E un
    // intervallo troppo corto non regge un ripensamento credibile.
    const eligible = seg.kind === 'work' && !seg.countUp && seg.duration >= 10
    if (!eligible || rand() >= opts.probability) {
      const out: Segment = { ...seg, offset }
      offset += out.duration
      return out
    }
    const display = hesitantCountdown(seg.duration, opts, rand)
    const out: Segment = { ...seg, duration: display.length, offset, display }
    offset += out.duration
    return out
  })
}

/** Il numero da mostrare: un elemento della sequenza per ogni secondo passato. */
/**
 * Da quanti secondi prima dello scadere comincia il conto.
 *
 * Erano tre, e in sala arrivavano addosso: chi lavora ha bisogno di sapere che
 * sta per finire, non di scoprirlo. Cinque dà il tempo di chiudere la serie.
 */
export const CONTO_ALLA_ROVESCIA = 5

/** Un suono e l'istante dell'allenamento in cui va fatto, in secondi. */
export interface EventoSonoro {
  t: number
  tipo: 'lavoro' | 'riposo' | 'bip' | 'bipUltimo' | 'fine'
}

/**
 * Tutti i suoni di un allenamento, con il loro istante esatto.
 *
 * Si possono sapere in anticipo perché nulla, qui, dipende da cosa succederà:
 * i segmenti hanno offset e durata fissi, e persino le esitazioni di Maurizio
 * sono estratte all'avvio e vivono in `seg.display`, un numero per secondo. È
 * ciò che permette di consegnare i suoni all'orologio audio invece di sperare
 * che il thread JavaScript sia sveglio al momento giusto.
 */
export function eventiSonori(segments: Segment[], da: number, a: number): EventoSonoro[] {
  const fuori = (t: number) => t <= da || t > a
  const eventi: EventoSonoro[] = []
  for (const seg of segments) {
    if (seg.offset > a) break
    if (!fuori(seg.offset)) eventi.push({ t: seg.offset, tipo: seg.kind === 'work' ? 'lavoro' : 'riposo' })
    // In For Time il conto sale e non c'è nessuno scadere da annunciare.
    if (seg.countUp) continue
    if (seg.display) {
      // Con Maurizio acceso conta il numero MOSTRATO: il bip segue lui, e
      // quando il conto risale — l'esitazione — non si bippa affatto.
      for (let i = 0; i < seg.display.length; i++) {
        const v = seg.display[i]
        const prima = i > 0 ? seg.display[i - 1] : -1
        if (v < 1 || v > CONTO_ALLA_ROVESCIA || v === prima) continue
        if (prima > 0 && v > prima) continue
        const t = seg.offset + i
        if (!fuori(t)) eventi.push({ t, tipo: v === 1 ? 'bipUltimo' : 'bip' })
      }
    } else {
      for (let k = CONTO_ALLA_ROVESCIA; k >= 1; k--) {
        if (k > seg.duration) continue
        const t = seg.offset + seg.duration - k
        if (!fuori(t)) eventi.push({ t, tipo: k === 1 ? 'bipUltimo' : 'bip' })
      }
    }
  }
  const ultimo = segments[segments.length - 1]
  if (ultimo) {
    const fine = ultimo.offset + ultimo.duration
    if (!fuori(fine)) eventi.push({ t: fine, tipo: 'fine' })
  }
  return eventi.sort((x, y) => x.t - y.t)
}

export function coachedDisplay(seg: Segment | null, remaining: number): number {
  if (!seg?.display || seg.countUp) return remaining
  const i = Math.floor(seg.duration - remaining)
  if (i < 0) return seg.display[0]
  if (i >= seg.display.length) return 0
  return seg.display[i]
}
