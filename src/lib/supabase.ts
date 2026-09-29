import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { chiaveSessione, indirizzoProgetto, unisciSessioni } from './sessioni'

/*
 * La sessione è una sola, per segreteria, istruttori e tablet di sala (vedi
 * `sessioni.ts`, che il timer legge uguale): chi è entrato in un'area non
 * entra nelle altre.
 */

let client: SupabaseClient | null = null

/** Un client solo: due client sulla stessa sessione si contenderebbero il rinnovo del token. */
export function clientSupabase(): SupabaseClient {
  if (client) return client
  const indirizzo = indirizzoProgetto(import.meta.env.VITE_SUPABASE_URL as string)
  unisciSessioni(indirizzo)
  client = createClient(indirizzo, (import.meta.env.VITE_SUPABASE_ANON_KEY as string).trim(), {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: chiaveSessione(indirizzo) },
  })
  return client
}
