import type { CoachLevel, HistoryEntry, Settings, Workout } from '../types'
import { DEFAULT_SETTINGS } from './storage'
import { CATEGORIE, type Categoria, type Esercizio } from './esercizi'
import { MAX_CATALOGO, MAX_STORICO, MAX_TIMER, numeroSano, testoSano, workoutSano } from './sano'
import { uid } from './format'

/**
 * La copia di tutto, in un file.
 *
 * Timer, catalogo esercizi, impostazioni e storico vivono nella memoria del
 * browser di un dispositivo solo: basta pulire i dati del sito, cambiare
 * telefono o romperlo, e sparisce anche il catalogo della palestra — che è la
 * cosa che costa più tempo a mettere insieme. Il QR manda un timer per volta;
 * questo mette al riparo tutto il resto.
 *
 * È anche il modo di allineare due dispositivi la prima volta: si esporta dal
 * telefono e si ripristina sul tablet.
 */

export interface Salvataggio {
  /** Marchio di fabbrica: serve a non far ingoiare all'app un JSON qualsiasi. */
  app: 'ods-timer'
  versione: 1
  quando: string
  timer: Workout[]
  esercizi: Esercizio[]
  impostazioni: Settings
  storico: HistoryEntry[]
}

export interface Contenuto {
  timer: number
  esercizi: number
  storico: number
  quando: string | null
}

export function contenutoDi(s: Salvataggio): Contenuto {
  return {
    timer: s.timer.length,
    esercizi: s.esercizi.length,
    storico: s.storico.length,
    quando: s.quando,
  }
}

const LIVELLI: CoachLevel[] = ['off', 'distratto', 'classico', 'spietato']

/**
 * Le impostazioni, una per una.
 *
 * Non basta appoggiarle sopra quelle di partenza: un livello di Maurizio che
 * non esiste, o un volume a 99, arriverebbero intatti fino al timer. Ogni
 * campo che non si riconosce torna al valore di partenza.
 */
function impostazioniSane(v: unknown): Settings {
  const o = (v ?? {}) as Record<string, unknown>
  const bool = (x: unknown, ripiego: boolean) => (typeof x === 'boolean' ? x : ripiego)
  return {
    coach: LIVELLI.includes(o.coach as CoachLevel) ? (o.coach as CoachLevel) : DEFAULT_SETTINGS.coach,
    countdownBeep: bool(o.countdownBeep, DEFAULT_SETTINGS.countdownBeep),
    voice: bool(o.voice, DEFAULT_SETTINGS.voice),
    voiceURI: typeof o.voiceURI === 'string' ? o.voiceURI.slice(0, 200) : null,
    recordedVoice: bool(o.recordedVoice, DEFAULT_SETTINGS.recordedVoice),
    announceNext: bool(o.announceNext, DEFAULT_SETTINGS.announceNext),
    ticchettio: bool(o.ticchettio, DEFAULT_SETTINGS.ticchettio),
    vibrate: bool(o.vibrate, DEFAULT_SETTINGS.vibrate),
    volume: numeroSano(o.volume, 0, 1, DEFAULT_SETTINGS.volume),
    keepAwake: bool(o.keepAwake, DEFAULT_SETTINGS.keepAwake),
    bigScreen: bool(o.bigScreen, DEFAULT_SETTINGS.bigScreen),
  }
}

const leggi = <T,>(chiave: string, ripiego: T): T => {
  try {
    const grezzo = localStorage.getItem(chiave)
    return grezzo ? (JSON.parse(grezzo) as T) : ripiego
  } catch {
    return ripiego
  }
}

export function salvataggioCorrente(): Salvataggio {
  return {
    app: 'ods-timer',
    versione: 1,
    quando: new Date().toISOString(),
    timer: leggi<Workout[]>('ods-timer:workouts', []),
    esercizi: leggi<Esercizio[]>('ods-timer:esercizi', []),
    impostazioni: { ...DEFAULT_SETTINGS, ...leggi<Partial<Settings>>('ods-timer:settings', {}) },
    storico: leggi<HistoryEntry[]>('ods-timer:history', []),
  }
}

/** Il nome del file: la data davanti, così l'elenco si ordina da solo. */
export function nomeFile(quando = new Date()): string {
  const due = (n: number) => String(n).padStart(2, '0')
  return `ods-timer-${quando.getFullYear()}-${due(quando.getMonth() + 1)}-${due(quando.getDate())}.json`
}

export function comeFile(s: Salvataggio): Blob {
  return new Blob([JSON.stringify(s, null, 2)], { type: 'application/json' })
}

/**
 * Legge un file di ripristino, riportando tutto dentro i limiti.
 *
 * Vale lo stesso principio del link con il QR: quello che arriva da fuori non
 * si crede sulla parola. In più qui si conservano le identità dei timer, perché
 * un ripristino rimette a posto i tuoi, non ne crea di nuovi.
 */
export function leggiSalvataggio(testo: string): Salvataggio | null {
  let grezzo: unknown
  try {
    grezzo = JSON.parse(testo)
  } catch {
    return null
  }
  if (!grezzo || typeof grezzo !== 'object') return null
  const o = grezzo as Record<string, unknown>
  if (o.app !== 'ods-timer') return null

  const timer = (Array.isArray(o.timer) ? o.timer : [])
    .slice(0, MAX_TIMER)
    .map((w) => workoutSano(w, false))
    .filter((w): w is Workout => w !== null)

  const esercizi = (Array.isArray(o.esercizi) ? o.esercizi : [])
    .slice(0, MAX_CATALOGO)
    .map((e) => {
      const x = (e ?? {}) as Record<string, unknown>
      const nome = testoSano(x.nome, 60)
      if (!nome) return null
      const categoria = CATEGORIE.includes(x.categoria as Categoria)
        ? (x.categoria as Categoria)
        : 'A corpo libero'
      const out: Esercizio = { id: testoSano(x.id, 40) || uid(), nome, categoria }
      if (x.propri === true) out.propri = true
      return out
    })
    .filter((e): e is Esercizio => e !== null)

  const storico = (Array.isArray(o.storico) ? o.storico : [])
    .slice(0, MAX_STORICO)
    .map((h) => {
      const x = (h ?? {}) as Record<string, unknown>
      return {
        id: testoSano(x.id, 40) || uid(),
        workoutId: testoSano(x.workoutId, 40),
        workoutName: testoSano(x.workoutName, 60) || 'Allenamento',
        finishedAt: numeroSano(x.finishedAt, 0, Number.MAX_SAFE_INTEGER, Date.now()),
        seconds: numeroSano(x.seconds, 0, 86400, 0),
        completed: x.completed === true,
      } satisfies HistoryEntry
    })

  const impostazioni = impostazioniSane(o.impostazioni)

  return {
    app: 'ods-timer',
    versione: 1,
    quando: testoSano(o.quando, 40) || new Date().toISOString(),
    timer,
    esercizi,
    impostazioni,
    storico,
  }
}

/**
 * Mette al posto di quello che c'è. Sostituisce e non fonde: due elenchi
 * mescolati sono un terzo elenco che non è né l'uno né l'altro, e chi
 * ripristina vuole tornare a com'era, non a un ibrido.
 */
export function applicaSalvataggio(s: Salvataggio) {
  const scrivi = (chiave: string, valore: unknown) => localStorage.setItem(chiave, JSON.stringify(valore))
  scrivi('ods-timer:workouts', s.timer)
  scrivi('ods-timer:esercizi', s.esercizi)
  scrivi('ods-timer:settings', s.impostazioni)
  scrivi('ods-timer:history', s.storico)
  // Un allenamento interrotto appartiene alla sessione di prima, non a questa.
  localStorage.removeItem('ods-timer:interrotto')
}
