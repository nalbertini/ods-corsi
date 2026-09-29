import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { DOMINIO_SALE } from './tablet'
import { chiaviSessione, indirizzoProgetto, PERSONA_VISTA, type Sessione } from './sessioni'
import { sessioneDellaPagina } from './percorso'

export type { Sessione }

/*
 * Le sessioni sono tre: degli istruttori, della segreteria e del tablet di
 * sala (vedi `sessioni.ts`, che il timer legge uguale).
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

const chiavi = () => chiaviSessione(indirizzoProgetto(import.meta.env.VITE_SUPABASE_URL as string))

export function clientSupabase(chi: Sessione = sessioneDellaPagina()): SupabaseClient {
  const già = client[chi]
  if (già) return già
  const indirizzo = indirizzoProgetto(import.meta.env.VITE_SUPABASE_URL as string)
  const k = chiavi()
  separaSessioni(k)
  const c = createClient(indirizzo, (import.meta.env.VITE_SUPABASE_ANON_KEY as string).trim(), {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: k[chi] },
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
  separaSala(chiavi)
  separaSegreteria(chiavi)
}

function separaSala(chiavi: Record<Sessione, string>) {
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

/**
 * Lo stesso, una volta sola, per la segreteria: prima di avere la sua chiave
 * stava in quella degli istruttori. Se l'account lì è della segreteria
 * (l'ultima persona vista, in `accesso.ts`, lo dice), va sotto la sua chiave:
 * la reception resta collegata in segreteria, e chi apre `istruttori/` sullo
 * stesso computer trova la porta. Una volta sola perché dopo, in
 * `istruttori/`, la segreteria ci può entrare apposta, per l'appello.
 */
const FATTO = 'ods-corsi:sessioni-divise'   // vedi la nota in coda.ts

function separaSegreteria(chiavi: Record<Sessione, string>) {
  try {
    if (localStorage.getItem(FATTO)) return
    localStorage.setItem(FATTO, '1')
    const vecchia = localStorage.getItem(chiavi.personale)
    if (!vecchia || localStorage.getItem(chiavi.segreteria)) return
    const utente = (JSON.parse(vecchia) as { user?: { id?: string } } | null)?.user?.id
    const visto = JSON.parse(localStorage.getItem(PERSONA_VISTA.personale) ?? 'null') as { utente?: string; ruolo?: string } | null
    if (!utente || visto?.utente !== utente || visto.ruolo !== 'staff') return
    localStorage.setItem(chiavi.segreteria, vecchia)
    localStorage.removeItem(chiavi.personale)
    localStorage.setItem(PERSONA_VISTA.segreteria, JSON.stringify(visto))
    localStorage.removeItem(PERSONA_VISTA.personale)
  } catch {
    // Senza localStorage non c'è nemmeno una sessione salvata da spostare.
  }
}

/**
 * Porta la sessione di questa pagina a un'altra area, prima di andarci. Serve
 * quando si entra dalla porta sbagliata: il link dell'invito o di «password
 * dimenticata» apre la pagina da cui è partito, e un istruttore che sceglie
 * la password in `segreteria/` deve ritrovarsi dentro in `istruttori/`, non
 * rifare l'accesso. Si sposta, non si copia: il punto è che le due aree non
 * abbiano lo stesso account.
 */
export function spostaSessione(verso: Sessione, da: Sessione = sessioneDellaPagina()) {
  if (da === verso) return
  const k = chiavi()
  client[da]?.auth.stopAutoRefresh()
  try {
    const s = localStorage.getItem(k[da])
    if (!s) return
    localStorage.setItem(k[verso], s)
    localStorage.removeItem(k[da])
  } catch {
    // Senza localStorage si rifà l'accesso dall'altra parte.
  }
}
