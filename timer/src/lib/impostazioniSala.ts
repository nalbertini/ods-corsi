import type { SupabaseClient } from '@supabase/supabase-js'
import type { Settings } from '../types'
import { DEFAULT_SETTINGS } from './storage'
import { CATEGORIE, type Categoria, type Esercizio, normalizza } from './esercizi'

/**
 * Le impostazioni del timer che decide la segreteria per i tablet di sala.
 *
 * Un tablet appeso al muro non ha un padrone che ci entra a scegliere
 * Maurizio o il volume: le sceglie la segreteria, in IMPOSTAZIONI, accanto alla
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

/**
 * Tutto quello che la segreteria sceglie per il timer dei tablet: le
 * impostazioni qui sopra, la voce di sistema (per nome: vedi `voceDiNome`) e
 * il catalogo degli esercizi della palestra. Voce e catalogo stanno in due
 * colonne loro di `impostazioni` (`supabase/13-voce-esercizi.sql`).
 */
export interface TimerSala {
  impostazioni: ImpostazioniSala
  /** Il nome della voce; `null` vuol dire la prima voce italiana del tablet. */
  voce: string | null
  /** `null` finché la segreteria non l'ha mai toccato: il tablet tiene il suo. */
  esercizi: Esercizio[] | null
}

/** Quanti esercizi tiene al massimo il catalogo della palestra. */
export const MAX_CATALOGO = 400

/** Il catalogo come arriva dal database, ripulito: nomi veri, categorie note, niente doppioni. */
export function eserciziDellaPalestra(grezzi: unknown): Esercizio[] | null {
  if (!Array.isArray(grezzi)) return null
  const visti = new Set<string>()
  const lista: Esercizio[] = []
  for (const g of grezzi.slice(0, MAX_CATALOGO)) {
    if (!g || typeof g !== 'object') continue
    const e = g as Record<string, unknown>
    const nome = typeof e.nome === 'string' ? e.nome.trim().slice(0, 60) : ''
    const k = normalizza(nome)
    if (!nome || visti.has(k)) continue
    visti.add(k)
    const categoria = CATEGORIE.includes(e.categoria as Categoria) ? (e.categoria as Categoria) : 'A corpo libero'
    lista.push({ id: typeof e.id === 'string' && e.id ? e.id.slice(0, 40) : `p-${lista.length}`, nome, categoria })
  }
  return lista
}

export function voceDellaSala(grezza: unknown): string | null {
  return typeof grezza === 'string' && grezza.trim() ? grezza.trim().slice(0, 200) : null
}

export function timerSala(riga: { timer?: unknown; voce?: unknown; esercizi?: unknown } | null): TimerSala {
  return {
    impostazioni: impostazioniSala(riga?.timer),
    voce: voceDellaSala(riga?.voce),
    esercizi: eserciziDellaPalestra(riga?.esercizi),
  }
}

/** La riga delle impostazioni, senza voce e catalogo se `13-voce-esercizi.sql` non c'è ancora. */
export async function leggiTimerSala(c: SupabaseClient): Promise<TimerSala> {
  const tutto = await c.from('impostazioni').select('timer, voce, esercizi').maybeSingle()
  if (!tutto.error) return timerSala(tutto.data as Record<string, unknown> | null)
  if (tutto.error.code !== '42703') throw new Error(tutto.error.message)
  const { data, error } = await c.from('impostazioni').select('timer').maybeSingle()
  if (error) throw new Error(error.message)
  return timerSala(data as Record<string, unknown> | null)
}
