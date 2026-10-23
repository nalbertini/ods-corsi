import type { IscrittoDiProva } from './iscritto'
import { ioDa, leggiIo, type RigaIo } from './iscrittoSupabase'

/**
 * Come entra un iscritto: con l'email, senza password. Supabase manda un
 * codice di sei cifre (il modello dell'email deve contenere `{{ .Token }}`),
 * l'iscritto lo scrive, e `collega_utente()` (supabase/101-iscritto.sql) lega
 * l'account alla sua scheda se l'email è quella data in segreteria.
 *
 * La sessione è la stessa di tutta l'app (vedi `sessioni.ts`), ma un iscritto
 * non è personale: `account()` in `accesso.ts` lo dà per nessuno, e le altre
 * aree gli mostrano la loro porta. Il controllo vero sta nelle policy.
 */

export const NON_ISCRITTO =
  'Questa email non risulta tra gli iscritti: usa quella data in segreteria. Se la condividi con un familiare, chiedi alla segreteria di collegare il tuo accesso.'
export const E_PERSONALE = 'Questa email è del personale: entra dalla porta della palestra, non da qui'
export const CODICE_SBAGLIATO = 'Il codice non è giusto o è scaduto: guarda l’ultima mail arrivata, o chiedine un altro'

export const LINK_NON_VALE = 'Il link nella mail non è completo: scrivi qui l’email e chiedine un’altra'

const NO_RETE = 'Il server non risponde: c’è rete?'

/** L'email scritta, senza spazi e in minuscolo; `null` se non sembra un indirizzo. */
export function emailPulita(testo: string): string | null {
  const e = testo.trim().toLowerCase()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : null
}

/** Il codice scritto (anche con spazi in mezzo, come lo si copia): sei cifre, o `null`. */
export function codicePulito(testo: string): string | null {
  const c = testo.replace(/\s+/g, '')
  return /^\d{6}$/.test(c) ? c : null
}

/**
 * Il link nella mail porta alla pagina con `?email=…&codice=…` (il modello
 * email di Supabase li mette con `{{ .Email }}` e `{{ .Token }}`). `null` se
 * nell'indirizzo non c'è niente dell'accesso; l'errore se c'è ma non regge.
 */
export function accessoDalLink(search: string): { email: string; codice: string } | { errore: string } | null {
  // `{{ .Email }}` non è codificato nel modello: un «+» (mario+x@…) è un «+», non uno spazio.
  const q = new URLSearchParams(search.replace(/\+/g, '%2B'))
  if (!q.has('email') && !q.has('codice')) return null
  const email = emailPulita(q.get('email') ?? '')
  const codice = codicePulito(q.get('codice') ?? '')
  return email && codice ? { email, codice } : { errore: LINK_NON_VALE }
}

/** L'indirizzo senza email e codice, che non devono restare nella barra né nella cronologia. */
export function indirizzoSenzaAccesso(pathname: string, search: string): string {
  const q = new URLSearchParams(search)
  q.delete('email')
  q.delete('codice')
  return pathname + (q.size ? `?${q}` : '')
}

interface ErroreAuth {
  message?: string
  code?: string
  status?: number
}

/** Perché il codice non è partito, detto per quello che è. */
export function perchéNonParte(e: ErroreAuth): string {
  const testo = e.message ?? ''
  if (e.status === 429 || /rate limit|too many|seconds/i.test(testo) || e.code === 'over_email_send_rate_limit')
    return 'Troppe richieste: aspetta un minuto e riprova'
  if (e.code === 'email_address_invalid' || /invalid.*email|email.*invalid/i.test(testo)) return 'Controlla l’email: non sembra giusta'
  if (e.code === 'otp_disabled' || e.code === 'signup_disabled' || /signups? not allowed/i.test(testo))
    return 'L’accesso con l’email non è ancora attivo: chiedi alla segreteria'
  if (/fetch|network|load failed/i.test(testo)) return NO_RETE
  return 'Il codice non è partito: riprova fra poco'
}

/** Perché il codice scritto non è valso. */
export function perchéNonVale(e: ErroreAuth): string {
  const testo = e.message ?? ''
  if (e.status === 429 || /rate limit|too many/i.test(testo)) return 'Troppi tentativi: aspetta un minuto e riprova'
  if (/fetch|network|load failed/i.test(testo)) return NO_RETE
  return CODICE_SBAGLIATO
}

/**
 * Chi è l'account appena entrato, dalla sua riga in `persone` (o `null` se non
 * ne ha una): l'iscritto, o il perché non entra e se la sessione va chiusa.
 * Quella del personale si lascia: è la sua, e potrebbe servirgli altrove.
 */
export function esitoAccesso(riga: RigaIo | null): { io: IscrittoDiProva } | { errore: string; chiudi: boolean } {
  const io = ioDa(riga)
  if (io) return { io }
  if (riga && riga.ruolo !== 'iscritto') return { errore: E_PERSONALE, chiudi: false }
  return { errore: NON_ISCRITTO, chiudi: true }
}

const db = () => import('./supabase').then((m) => m.clientSupabase())

/**
 * Manda il codice. `shouldCreateUser` perché la prima volta l'account non c'è;
 * se l'email non è di nessuno lo si scopre dopo, in `entraConCodice` (da qui,
 * senza accesso, le schede non si leggono), e l'account vuoto non legge niente.
 */
export async function mandaCodice(email: string): Promise<void> {
  const c = await db()
  const { error } = await c.auth.signInWithOtp({ email, options: { shouldCreateUser: true } })
  if (error) throw new Error(perchéNonParte(error))
}

/** Verifica il codice e lega l'account alla scheda: l'iscritto entrato, o l'errore per chi lo usa. */
export async function entraConCodice(email: string, codice: string): Promise<IscrittoDiProva> {
  const c = await db()
  const { data, error } = await c.auth.verifyOtp({ email, token: codice, type: 'email' })
  if (error || !data.user) throw new Error(perchéNonVale(error ?? {}))
  // Al primo accesso lega l'account alla scheda con la stessa email; per chi è già legato non fa niente.
  await c.rpc('collega_utente')
  const riga = await leggiIo(c, data.user.id).catch(async (e: unknown) => {
    await c.auth.signOut()
    throw e
  })
  const esito = esitoAccesso(riga)
  if ('io' in esito) return esito.io
  if (esito.chiudi) await c.auth.signOut()
  throw new Error(esito.errore)
}
