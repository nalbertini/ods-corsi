import type { HistoryEntry, Settings, Workout } from '../types'
import { seedLibrary } from './presets'

const KEY_WORKOUTS = 'ods-timer:workouts'
const KEY_SETTINGS = 'ods-timer:settings'
const KEY_HISTORY = 'ods-timer:history'

export const DEFAULT_SETTINGS: Settings = {
  // Maurizio è acceso di partenza, al livello di tutti i giorni: è la voce e il
  // carattere della palestra, non un extra da scoprire nelle impostazioni.
  coach: 'classico',
  countdownBeep: true,
  voice: true,
  // Spento di partenza: un tic al secondo per un'ora è una scelta, non un
  // valore di fabbrica. Chi lo vuole lo accende e resta acceso.
  ticchettio: false,
  vibrate: true,
  volume: 0.8,
  voiceURI: null,
  recordedVoice: true,
  announceNext: true,
  keepAwake: true,
  bigScreen: false,
}

/**
 * I segnali acustici come una scelta sola, a tre posizioni.
 *
 * Sotto restano i due interruttori di sempre — il bip e la voce — perché è
 * così che il timer li legge, e perché un salvataggio scritto prima di questa
 * modifica continua a valere. Sopra però si presentano come tre stati che si
 * escludono: in palestra si vuole «zitto», «solo i bip» o «anche la voce»,
 * non una combinazione da comporre. La quarta combinazione possibile — voce
 * accesa e bip spenti — non la chiedeva nessuno: si legge come «voce» e alla
 * prima scelta si riallinea.
 */
export type ModoAudio = 'muto' | 'bip' | 'voce'

export function modoAudio(s: Pick<Settings, 'countdownBeep' | 'voice'>): ModoAudio {
  return s.voice ? 'voce' : s.countdownBeep ? 'bip' : 'muto'
}

export function audioDa(m: ModoAudio): Pick<Settings, 'countdownBeep' | 'voice'> {
  return { countdownBeep: m !== 'muto', voice: m === 'voce' }
}

/**
 * Ogni lettura è difensiva: in incognito, con i dati del sito bloccati o dopo
 * una pulizia del browser, localStorage lancia o restituisce spazzatura.
 */
function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Spazio esaurito o storage negato: l'app resta usabile, non persiste.
  }
}

export function loadWorkouts(): Workout[] {
  const stored = read<Workout[] | null>(KEY_WORKOUTS, null)
  if (stored && Array.isArray(stored) && stored.length > 0) return stored
  const seeded = seedLibrary()
  write(KEY_WORKOUTS, seeded)
  return seeded
}

export const saveWorkouts = (list: Workout[]) => write(KEY_WORKOUTS, list)

export function loadSettings(): Settings {
  return { ...DEFAULT_SETTINGS, ...read<Partial<Settings>>(KEY_SETTINGS, {}) }
}

export const saveSettings = (s: Settings) => write(KEY_SETTINGS, s)

export const loadHistory = (): HistoryEntry[] => read<HistoryEntry[]>(KEY_HISTORY, [])

export function pushHistory(entry: HistoryEntry) {
  const list = [entry, ...loadHistory()].slice(0, 100)
  write(KEY_HISTORY, list)
  return list
}
