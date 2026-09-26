import type { Mode, Workout } from '../types'
import { uid } from './format'

const ex = (...names: string[]) => names.map((name) => ({ id: uid(), name }))

/** Valori di partenza quando si crea un timer nuovo da uno schema. */
export function blankWorkout(mode: Mode): Workout {
  const base = {
    id: uid(),
    name: '',
    mode,
    // Venti secondi: il tempo che serve davvero per mettersi in posizione in
    // sala, che è il modo in cui la palestra comincia un allenamento.
    prepare: 20,
    work: 30,
    rest: 15,
    rounds: 8,
    sets: 1,
    setRest: 60,
    cooldown: 0,
    duration: 600,
    exercises: [],
    updatedAt: Date.now(),
  }
  switch (mode) {
    case 'interval':
      return { ...base, name: 'Nuovo intervallo', work: 30, rest: 15, rounds: 8 }
    case 'circuit':
      return {
        ...base,
        name: 'Nuovo circuito',
        work: 45,
        rest: 15,
        rounds: 3,
        exercises: ex('Stazione 1', 'Stazione 2', 'Stazione 3'),
      }
    case 'emom':
      return { ...base, name: 'Nuovo EMOM', work: 60, rest: 0, rounds: 10 }
    case 'amrap':
      return { ...base, name: 'Nuovo AMRAP', duration: 900 }
    case 'fortime':
      return { ...base, name: 'Nuovo For Time', duration: 900 }
  }
}

/** Schemi classici, pronti da usare o da personalizzare. */
export const PRESETS: Array<{ key: string; title: string; mode: Mode; make: () => Workout }> = [
  {
    key: 'tabata',
    title: 'Tabata',
    mode: 'interval',
    make: () => ({
      ...blankWorkout('interval'),
      name: 'Tabata',
      work: 20,
      rest: 10,
      rounds: 8,
      sets: 1,
      setRest: 60,
    }),
  },
  {
    key: 'hiit',
    title: 'HIIT 40/20',
    mode: 'interval',
    make: () => ({
      ...blankWorkout('interval'),
      name: 'HIIT 40/20',
      work: 40,
      rest: 20,
      rounds: 10,
      sets: 2,
      setRest: 90,
    }),
  },
  {
    key: 'emom',
    title: 'EMOM',
    mode: 'emom',
    make: () => ({ ...blankWorkout('emom'), name: 'EMOM 12', work: 60, rounds: 12 }),
  },
  {
    key: 'amrap',
    title: 'AMRAP',
    mode: 'amrap',
    make: () => ({ ...blankWorkout('amrap'), name: 'AMRAP 20', duration: 1200 }),
  },
  {
    key: 'fortime',
    title: 'For Time',
    mode: 'fortime',
    make: () => ({ ...blankWorkout('fortime'), name: 'For Time', duration: 900 }),
  },
  {
    key: 'circuito',
    title: 'Circuito',
    mode: 'circuit',
    make: () => ({
      ...blankWorkout('circuit'),
      name: 'Circuito',
      work: 45,
      rest: 15,
      rounds: 3,
      exercises: ex('Stazione 1', 'Stazione 2', 'Stazione 3', 'Stazione 4'),
    }),
  },
]

/**
 * Gli schemi di un certo tipo. Serve a chi ha già detto che tipo vuole
 * filtrando la libreria: se ne resta uno solo non c'è più niente da
 * chiedere, e l'editor si apre diretto.
 */
export const presetsDi = (mode: Mode) => PRESETS.filter((p) => p.mode === mode)

/** La libreria che l'app propone al primo avvio. */
export function seedLibrary(): Workout[] {
  const now = Date.now()
  const w = (p: Partial<Workout> & { name: string; mode: Mode }): Workout => ({
    ...blankWorkout(p.mode),
    ...p,
    id: uid(),
    builtin: true,
    updatedAt: now,
  })
  return [
    w({
      name: 'Brucia grassi',
      mode: 'interval',
      work: 20,
      rest: 10,
      rounds: 8,
      sets: 3,
      setRest: 60,
      exercises: ex('Burpee + salto', 'Mountain climber', 'Jump squat', 'Plank jack'),
    }),
    w({
      name: 'EMOM 12 · gambe',
      mode: 'emom',
      work: 60,
      rounds: 12,
      exercises: ex('Goblet squat', 'Affondi alternati', 'Stacco rumeno', 'Step up'),
    }),
    w({
      name: 'AMRAP del sabato',
      mode: 'amrap',
      duration: 1200,
      exercises: ex('10 kettlebell swing', '10 push up', '10 box jump'),
    }),
    w({
      name: 'Circuito sala attrezzi',
      mode: 'circuit',
      work: 45,
      rest: 15,
      rounds: 4,
      exercises: ex('Vogatore', 'Panca piana', 'Leg press', 'Lat machine', 'Addominali', 'Corda'),
    }),
    w({
      name: 'Core express',
      mode: 'interval',
      work: 20,
      rest: 10,
      rounds: 8,
      sets: 2,
      setRest: 45,
      exercises: ex('Plank', 'Russian twist', 'Hollow hold', 'Bicicletta'),
    }),
    w({
      name: 'Benchmark mensile',
      mode: 'fortime',
      duration: 900,
      exercises: ex('50 air squat', '40 sit up', '30 push up', '20 burpee', '10 pull up'),
    }),
  ]
}
