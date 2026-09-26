import type { SupabaseClient } from '@supabase/supabase-js'
import type { FonteClip } from './voice'

/**
 * Le clip della voce dei tablet di sala, incise dalla segreteria.
 *
 * Stanno nel contenitore `voce` di Supabase (`supabase/13-voce-esercizi.sql`),
 * una per chiave e senza estensione: `stato/lavoro`, `maurizio/3`,
 * `esercizi/burpee`. Il formato è quello del browser che ha registrato, e sta
 * scritto nel file. Le legge chiunque abbia un accesso, tablet compresi; le
 * scrive la segreteria.
 */
export const CONTENITORE_VOCE = 'voce'

/** Le cartelle delle chiavi, le stesse di `voiceClips.ts`. */
export const CARTELLE_VOCE = ['stato', 'maurizio', 'esercizi'] as const

/** Una chiave che il contenitore accetta: la stessa regola della policy. */
export const chiaveValida = (k: string) => /^(stato|maurizio|esercizi)\/[a-z0-9-]{1,80}$/.test(k)

/** Le clip che ci sono sul server, con quando sono cambiate. */
async function clipSulServer(c: SupabaseClient): Promise<Array<{ chiave: string; quando: string }>> {
  const cartelle = await Promise.all(
    CARTELLE_VOCE.map(async (cartella) => {
      const { data, error } = await c.storage.from(CONTENITORE_VOCE).list(cartella, { limit: 1000 })
      if (error) throw new Error(error.message)
      return (data ?? []).filter((f) => f.id).map((f) => ({ chiave: `${cartella}/${f.name}`, quando: f.updated_at ?? '' }))
    }),
  )
  return cartelle.flat().filter((x) => chiaveValida(x.chiave))
}

/** Le chiavi che ci sono sul server. */
export async function chiaviSulServer(c: SupabaseClient): Promise<string[]> {
  return (await clipSulServer(c)).map((x) => x.chiave)
}

export async function scaricaClip(c: SupabaseClient, key: string): Promise<Blob | null> {
  const { data, error } = await c.storage.from(CONTENITORE_VOCE).download(key)
  if (error) return null
  return data
}

/** Le clip della sala per il timer: l'elenco una volta, i file quando servono. */
export async function fonteClipSupabase(c: SupabaseClient): Promise<FonteClip> {
  const clip = await clipSulServer(c)
  return {
    chiavi: new Set(clip.map((x) => x.chiave)),
    versione: clip.map((x) => `${x.chiave}@${x.quando}`).sort().join(),
    scarica: (k) => scaricaClip(c, k),
  }
}
