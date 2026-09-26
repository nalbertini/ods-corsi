import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Un client solo per pagina: l'app e il tablet parlano con lo stesso database
 * e con la stessa sessione, e due client sulla stessa sessione si
 * contenderebbero il rinnovo del token.
 */
let unico: SupabaseClient | null = null

export function clientSupabase(): SupabaseClient {
  if (!unico) {
    unico = createClient(import.meta.env.VITE_SUPABASE_URL as string, import.meta.env.VITE_SUPABASE_ANON_KEY as string, {
      auth: { persistSession: true, autoRefreshToken: true },
    })
  }
  return unico
}
