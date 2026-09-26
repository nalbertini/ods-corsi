/** I cinque schemi di allenamento che l'app sa costruire. */
export type Mode = 'interval' | 'circuit' | 'emom' | 'amrap' | 'fortime'

/** Gli stati in cui può trovarsi il timer. Ognuno ha il suo colore. */
export type SegmentKind = 'prepare' | 'work' | 'rest' | 'setRest' | 'cooldown'

export interface Exercise {
  id: string
  name: string
  /** Durata propria, usata solo dai circuiti. Altrove vale `work` dell'allenamento. */
  duration?: number
  /**
   * L'obiettivo dell'esercizio: serie, ripetizioni e carico.
   *
   * È un promemoria mostrato sotto il nome mentre si lavora, non un parametro
   * del timer: a scandire il tempo restano durate e round dell'allenamento.
   */
  sets?: number
  reps?: number
  /** Carico in chili. Mezzi chili ammessi. */
  kg?: number
}

export interface Workout {
  id: string
  name: string
  mode: Mode
  /** Conto alla rovescia iniziale, prima del primo lavoro. */
  prepare: number
  /** Durata di un intervallo di lavoro (secondi). Negli EMOM è la lunghezza dello slot. */
  work: number
  /** Recupero dopo ogni intervallo di lavoro. */
  rest: number
  /** Intervalli per serie. Negli EMOM è il numero di slot. */
  rounds: number
  /** Quante volte ripetere il blocco di round. */
  sets: number
  /** Riposo fra una serie e l'altra. */
  setRest: number
  /** Defaticamento finale. */
  cooldown: number
  /** Durata totale per AMRAP, o tempo limite per FOR TIME. */
  duration: number
  exercises: Exercise[]
  /** Vero per i timer che arrivano con l'app e non sono stati modificati. */
  builtin?: boolean
  updatedAt: number
}

export interface Segment {
  kind: SegmentKind
  /** Etichetta di stato mostrata in grande: LAVORO, RECUPERO… */
  label: string
  /** Nome dell'esercizio o indicazione di supporto. */
  name: string
  duration: number
  /** Vero nei FOR TIME: il cronometro sale invece di scendere. */
  countUp?: boolean
  round: number
  rounds: number
  set: number
  sets: number
  /** Istante di inizio del segmento dall'avvio dell'allenamento (secondi). */
  offset: number
  /** Il conto mostrato secondo per secondo, quando Maurizio ci mette del suo. */
  display?: number[]
  /** Serie, ripetizioni e carico già impaginati: `3×10 · 16 kg`. */
  nota?: string
  /** Il giro in più che Maurizio si inventa: indice della frase con cui lo annuncia. */
  extra?: number
}

/** Quanto è disonesto Maurizio quando conta. */
export type CoachLevel = 'off' | 'distratto' | 'classico' | 'spietato'

export interface Settings {
  coach: CoachLevel
  countdownBeep: boolean
  voice: boolean
  /** Voce di sistema scelta dall'utente; null = la migliore che troviamo. */
  voiceURI: string | null
  /** Usa le clip incise quando ci sono, invece della sintesi. */
  recordedVoice: boolean
  /** Nel recupero dice anche qual è il prossimo esercizio. */
  announceNext: boolean
  /** Un ticchettio d'orologio a ogni secondo, mentre il timer conta. */
  ticchettio: boolean
  vibrate: boolean
  volume: number
  keepAwake: boolean
  bigScreen: boolean
}

export interface HistoryEntry {
  id: string
  workoutId: string
  workoutName: string
  finishedAt: number
  /** Secondi effettivamente svolti, anche se l'allenamento è stato interrotto. */
  seconds: number
  completed: boolean
}
