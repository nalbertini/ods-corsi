import type { SupabaseClient } from '@supabase/supabase-js'
import { CATEGORIE, type Categoria, type Esercizio, normalizza } from './esercizi'

/**
 * Quello che la segreteria sceglie per il timer dei tablet di sala: la voce di
 * sistema (per nome: vedi `voceDiNome`) e il catalogo degli esercizi della
 * palestra, in due colonne di `impostazioni` (`supabase/13-voce-esercizi.sql`),
 * più le clip della voce incisa (`clipSala.ts`).
 *
 * Maurizio, i segnali, il volume, lo schermo e la musica durante il timer no:
 * si scelgono nel timer, dalle sue impostazioni, e ogni tablet tiene le sue.
 */
export interface TimerSala {
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

export function timerSala(riga: { voce?: unknown; esercizi?: unknown } | null): TimerSala {
  return {
    voce: voceDellaSala(riga?.voce),
    esercizi: eserciziDellaPalestra(riga?.esercizi),
  }
}

/** Voce e catalogo; niente di scelto se `13-voce-esercizi.sql` non c'è ancora. */
export async function leggiTimerSala(c: SupabaseClient): Promise<TimerSala> {
  const { data, error } = await c.from('impostazioni').select('voce, esercizi').maybeSingle()
  if (error?.code === '42703') return timerSala(null)
  if (error) throw new Error(error.message)
  return timerSala(data as Record<string, unknown> | null)
}
