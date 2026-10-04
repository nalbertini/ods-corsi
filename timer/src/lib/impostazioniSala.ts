import type { SupabaseClient } from '@supabase/supabase-js'
import type { Settings } from '../types'
import { DEFAULT_SETTINGS } from './storage'
import { disciplinaDi, type Esercizio, normalizza } from './esercizi'
import { type Disciplina, disciplineDa } from './discipline'

/**
 * Le impostazioni del timer uguali su tutti i tablet di sala.
 *
 * Maurizio, i segnali, il volume, lo schermo e la musica durante il timer si
 * scelgono nel timer, dalle sue impostazioni, su un tablet qualunque: si
 * salvano sul database e le prendono tutti i tablet. Restano del dispositivo
 * le cose che solo il dispositivo sa: da dove viene la musica e l'account
 * Spotify collegato.
 *
 * Sul database stanno in `impostazioni.timer` (`supabase/10-timer-sale.sql`),
 * come le scrive questo file, e un tablet le cambia con `salva_timer_sala`
 * (`supabase/14-timer-dal-tablet.sql`): il database le custodisce e basta.
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
 * timer. Un database dove nessun tablet ha ancora toccato niente dà il timer
 * di fabbrica, uguale su ogni tablet.
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

/** Tocca una delle impostazioni uguali per tutti i tablet? */
export function toccaLaSala(patch: Partial<Settings>): boolean {
  return CHIAVI_SALA.some((k) => k in patch)
}

/**
 * Il timer dei tablet di sala: le impostazioni qui sopra, uguali per tutti, e
 * quello che sceglie la segreteria, la voce di sistema (per nome: vedi
 * `voceDiNome`) e il catalogo degli esercizi della palestra, in due colonne
 * loro di `impostazioni` (`supabase/13-voce-esercizi.sql`).
 */
export interface TimerSala {
  impostazioni: ImpostazioniSala
  /** Il nome della voce; `null` vuol dire la prima voce italiana del tablet. */
  voce: string | null
  /** `null` finché la segreteria non l'ha mai toccato: il tablet tiene il suo. */
  esercizi: Esercizio[] | null
  /** La lista delle discipline (`supabase/40-discipline.sql`); quella di partenza finché non c'è. */
  discipline: Disciplina[]
}

/** Quanti esercizi tiene al massimo il catalogo della palestra. */
export const MAX_CATALOGO = 400

/** Il catalogo come arriva dal database, ripulito: nomi veri, categoria nota, niente doppioni. */
export function eserciziDellaPalestra(grezzi: unknown, discipline?: Disciplina[]): Esercizio[] | null {
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
    const id = typeof e.id === 'string' && e.id ? e.id.slice(0, 40) : `p-${lista.length}`
    const disciplina = disciplinaDi(e.categoria, e.disciplina, discipline)
    lista.push(disciplina ? { id, nome, disciplina } : { id, nome })
  }
  return lista
}

export function voceDellaSala(grezza: unknown): string | null {
  return typeof grezza === 'string' && grezza.trim() ? grezza.trim().slice(0, 200) : null
}

export function timerSala(riga: { timer?: unknown; voce?: unknown; esercizi?: unknown; discipline?: unknown } | null): TimerSala {
  const discipline = disciplineDa(riga?.discipline)
  return {
    impostazioni: impostazioniSala(riga?.timer),
    voce: voceDellaSala(riga?.voce),
    esercizi: eserciziDellaPalestra(riga?.esercizi, discipline),
    discipline,
  }
}

/**
 * La riga delle impostazioni, senza discipline se `40-discipline.sql` non c'è
 * ancora, e senza voce e catalogo se manca anche `13-voce-esercizi.sql`.
 */
export async function leggiTimerSala(c: SupabaseClient): Promise<TimerSala> {
  const tutto = await c.from('impostazioni').select('timer, voce, esercizi, discipline').maybeSingle()
  if (!tutto.error) return timerSala(tutto.data as Record<string, unknown> | null)
  if (tutto.error.code !== '42703') throw new Error(tutto.error.message)
  const senzaDiscipline = await c.from('impostazioni').select('timer, voce, esercizi').maybeSingle()
  if (!senzaDiscipline.error) return timerSala(senzaDiscipline.data as Record<string, unknown> | null)
  if (senzaDiscipline.error.code !== '42703') throw new Error(senzaDiscipline.error.message)
  const { data, error } = await c.from('impostazioni').select('timer').maybeSingle()
  if (error) throw new Error(error.message)
  return timerSala(data as Record<string, unknown> | null)
}

/** Le salva per tutti i tablet: le può cambiare un tablet, o la segreteria. */
export async function salvaTimerSala(c: SupabaseClient, i: ImpostazioniSala): Promise<void> {
  const { error } = await c.rpc('salva_timer_sala', { timer: impostazioniSala(i) })
  if (error) throw new Error(error.message)
}

/** La lista delle discipline della palestra, per chi è dell'app ma non è un tablet; quella di partenza se `40-discipline.sql` non c'è. */
export async function scaricaDiscipline(c: SupabaseClient): Promise<Disciplina[]> {
  const { data, error } = await c.from('impostazioni').select('discipline').maybeSingle()
  if (error) {
    if (error.code === '42703') return disciplineDa(null)
    throw new Error(error.message)
  }
  return disciplineDa((data as { discipline?: unknown } | null)?.discipline)
}
