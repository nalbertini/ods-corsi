import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { DOMINIO_SALE } from './tablet'
import { chiaviSessione, indirizzoProgetto, type Sessione } from './sessioni'

export type { Sessione }

/*
 * Le sessioni sono due, una del personale e una del tablet di sala (vedi
 * `sessioni.ts`, che il timer legge uguale).
 *
 * Erano una sessione sola, e le porte si pestavano i piedi: tornando indietro
 * da `#sala` a `#segreteria` la porta trovava l'account della sala, chiedeva
 * l'accesso, e l'accesso della segreteria scollegava il tablet (e viceversa).
 * Ora ognuna ha la sua, salvata sotto una chiave sua: entrare o uscire da una
 * non tocca l'altra.
 */

/**
 * Un client solo per sessione: due client sulla stessa sessione si
 * contenderebbero il rinnovo del token, due su sessioni diverse no.
 */
const client: Partial<Record<Sessione, SupabaseClient>> = {}

export function clientSupabase(chi: Sessione = 'personale'): SupabaseClient {
  const già = client[chi]
  if (già) return già
  const indirizzo = indirizzoProgetto(import.meta.env.VITE_SUPABASE_URL as string)
  const chiavi = chiaviSessione(indirizzo)
  separaSessioni(chiavi)
  const c = createClient(indirizzo, (import.meta.env.VITE_SUPABASE_ANON_KEY as string).trim(), {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: chiavi[chi] },
  })
  client[chi] = c
  return c
}

/**
 * Prima c'era una chiave sola: se lì c'è l'account di una sala, lo si sposta
 * sotto la sua, così i tablet già appesi restano collegati senza rifare
 * l'accesso. È di una sala se l'email è del dominio delle sale (vedi
 * `emailDellaSala`): una sala con un'email diversa rifà l'accesso una volta.
 */
function separaSessioni(chiavi: Record<Sessione, string>) {
  try {
    const vecchia = localStorage.getItem(chiavi.personale)
    if (!vecchia || localStorage.getItem(chiavi.sala)) return
    const email = String((JSON.parse(vecchia) as { user?: { email?: string } } | null)?.user?.email ?? '').toLowerCase()
    if (!email.endsWith(`@${DOMINIO_SALE}`)) return
    localStorage.setItem(chiavi.sala, vecchia)
    localStorage.removeItem(chiavi.personale)
  } catch {
    // Senza localStorage non c'è nemmeno una sessione salvata da spostare.
  }
}
