import type { Settings } from '../types'
import { DEFAULT_SETTINGS } from './storage'

/**
 * Le impostazioni del timer che decide la segreteria per i tablet di sala.
 *
 * Un tablet appeso al muro non ha un padrone che ci entra a scegliere
 * Maurizio o il volume: le sceglie la segreteria, in REGOLE, accanto alla
 * musica delle sale, e valgono per tutti i tablet. Sul tablet non si
 * cambiano. Restano del dispositivo le cose che solo il dispositivo sa: quale
 * voce di sistema c'è, le clip incise lì, l'account Spotify collegato.
 *
 * Sul database stanno in `impostazioni.timer` (`supabase/10-timer-sale.sql`),
 * come le scrive questo file: il database le custodisce e basta.
 */
export const CHIAVI_SALA = [
  'coach',
  'countdownBeep',
  'voice',
  'announceNext',
  'ticchettio',
  'vibrate',
  'volume',
  'recordedVoice',
  'keepAwake',
  'bigScreen',
  'musicaSegue',
  'musicaAbbassa',
  'musicaRecupero',
] as const satisfies ReadonlyArray<keyof Settings>

export type ImpostazioniSala = Pick<Settings, (typeof CHIAVI_SALA)[number]>

/**
 * Quelle che valgono, da quello che arriva dal database (o dalla prova): ogni
 * chiave che manca o non ha il tipo giusto prende il valore di partenza del
 * timer. Una segreteria che non ha ancora toccato niente dà il timer di
 * fabbrica, uguale su ogni tablet.
 */
export function impostazioniSala(grezze: unknown): ImpostazioniSala {
  const g = grezze && typeof grezze === 'object' ? (grezze as Record<string, unknown>) : {}
  const s = {} as Record<string, unknown>
  for (const k of CHIAVI_SALA) {
    const base = DEFAULT_SETTINGS[k]
    s[k] = typeof g[k] === typeof base ? g[k] : base
  }
  const i = s as ImpostazioniSala
  if (!(i.coach in COACH_VALIDI)) i.coach = DEFAULT_SETTINGS.coach
  i.volume = Math.max(0, Math.min(1, i.volume))
  i.musicaRecupero = Math.max(0, Math.min(80, Math.round(i.musicaRecupero)))
  return i
}

const COACH_VALIDI: Record<Settings['coach'], true> = { off: true, distratto: true, classico: true, spietato: true }
