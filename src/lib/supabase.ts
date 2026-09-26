import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * L'indirizzo del progetto, anche se nel segreto è finito quello dell'API.
 *
 * Il pannello di Supabase mostra accanto alla *Project URL* anche l'indirizzo
 * dell'API REST, `https://….supabase.co/rest/v1/`, ed è facile copiare quello:
 * il client ci attacca `/auth/v1/…` e l'accesso finisce su un indirizzo che
 * non esiste. Qui si tiene solo la radice.
 */
export function indirizzoProgetto(grezzo: string): string {
  return grezzo.trim().replace(/\/+$/, '').replace(/\/(rest|auth)\/v1$/, '')
}

/**
 * Un client solo per pagina: l'app e il tablet parlano con lo stesso database
 * e con la stessa sessione, e due client sulla stessa sessione si
 * contenderebbero il rinnovo del token.
 */
let unico: SupabaseClient | null = null

export function clientSupabase(): SupabaseClient {
  if (!unico) {
    unico = createClient(
      indirizzoProgetto(import.meta.env.VITE_SUPABASE_URL as string),
      (import.meta.env.VITE_SUPABASE_ANON_KEY as string).trim(),
      { auth: { persistSession: true, autoRefreshToken: true } },
    )
  }
  return unico
}
