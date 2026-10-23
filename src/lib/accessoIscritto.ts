import type { SupabaseClient } from '@supabase/supabase-js'
import type { IscrittoDiProva } from './iscritto'
import { guaioIscritto, ioDa, leggiIo, type RigaIo } from './iscrittoSupabase'

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
  'Non troviamo questa email tra gli iscritti. Prova con quella che hai dato alla palestra, oppure chiama la segreteria.'
export const E_PERSONALE = 'Questa email è del personale della palestra. Usa l’accesso dello staff.'
export const CODICE_SBAGLIATO = 'Il codice non è giusto o è scaduto: guarda l’ultima mail arrivata, o chiedine un altro'

export const GOOGLE_ANNULLATO = 'Accesso annullato. Puoi riprovare o usare il codice via email.'
export const GOOGLE_NON_RIUSCITO = 'Qualcosa non ha funzionato. Riprova o usa il codice via email.'

export const NO_RETE = 'Il server non risponde: c’è rete?'

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

// Con Google si torna sulla stessa pagina con l'esito nell'indirizzo, in query o in hash.
const parametri = (u: URL) => [new URLSearchParams(u.search), new URLSearchParams(u.hash.replace(/^#/, ''))]
const DI_ACCESSO = ['code', 'state', 'error', 'error_code', 'error_description']
const NEL_HASH = [...DI_ACCESSO, 'access_token', 'refresh_token', 'expires_in', 'expires_at', 'token_type', 'provider_token', 'provider_refresh_token']

/** Com'è andato il ritorno da Google, letto dall'indirizzo: niente da dire, o l'errore per chi usa l'app. */
export function esitoRitornoGoogle(indirizzo: string): { tipo: 'nessuno' } | { tipo: 'errore'; messaggio: string } {
  const p = parametri(new URL(indirizzo))
  const ha = (k: string) => p.some((q) => q.has(k))
  if (p.some((q) => q.get('error') === 'access_denied' || q.get('error_code') === 'access_denied'))
    return { tipo: 'errore', messaggio: GOOGLE_ANNULLATO }
  if (ha('error') || ha('error_description') || ha('error_code')) return { tipo: 'errore', messaggio: GOOGLE_NON_RIUSCITO }
  return { tipo: 'nessuno' }
}

/** L'indirizzo senza i segni del ritorno da Google; percorso, altri parametri e un hash che non è d'accesso restano. */
export function urlPulito(indirizzo: string): string {
  const u = new URL(indirizzo)
  for (const k of DI_ACCESSO) u.searchParams.delete(k)
  const h = new URLSearchParams(u.hash.replace(/^#/, ''))
  if (NEL_HASH.some((k) => h.has(k))) u.hash = ''
  return u.toString()
}

/** Dalla Home dell'iPhone Google si apre nel browser e può non rientrare nell'app: lì si entra col codice. */
export const googleDisponibile = (standalone: boolean) => !standalone

export const opzioniGoogle = (indirizzo: string) => ({ provider: 'google' as const, options: { redirectTo: urlPulito(indirizzo) } })

/** Perché Google non è partito, detto per quello che è. */
export function perchéNonParteGoogle(e: ErroreAuth): string {
  if (e.status === 429) return 'Troppe richieste: aspetta un minuto e riprova'
  if (/fetch|network|load failed/i.test(e.message ?? '')) return NO_RETE
  return GOOGLE_NON_RIUSCITO
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
  return entraDopoGoogle(c, data.user.id)
}

/**
 * Dopo l'accesso (codice o Google): lega l'account alla scheda con la stessa
 * email, e dà l'iscritto o l'errore per chi usa l'app. Il client lo passa chi chiama.
 */
export async function entraDopoGoogle(c: SupabaseClient, utente: string): Promise<IscrittoDiProva> {
  // Al primo accesso lega l'account alla scheda con la stessa email; per chi è già legato non fa niente.
  const { error } = await c.rpc('collega_utente')
  // Se non ha potuto legare, non si sa se è iscritto: non lo si manda via con «non iscritto».
  if (error) throw guaioIscritto(error)
  const riga = await leggiIo(c, utente).catch(async (e: unknown) => {
    await c.auth.signOut()
    throw e
  })
  const esito = esitoAccesso(riga)
  if ('io' in esito) return esito.io
  if (esito.chiudi) await c.auth.signOut()
  throw new Error(esito.errore)
}

/** Parte per Google: la pagina cambia, e al ritorno `riprendiDaGoogle` finisce l'accesso. */
export async function entraConGoogle(indirizzo: string, cliente: () => Promise<SupabaseClient> = db): Promise<void> {
  const c = await cliente().catch(() => null)
  if (!c) throw new Error(GOOGLE_NON_RIUSCITO)
  const { error } = await c.auth.signInWithOAuth(opzioniGoogle(indirizzo))
  if (error) throw new Error(perchéNonParteGoogle(error))
}

/** Al caricamento della pagina: chi torna da Google è entrato (`io`), o ha un errore da leggere; per gli altri `null`. */
export async function riprendiDaGoogle(
  indirizzo: string,
  cliente: () => Promise<SupabaseClient> = db,
): Promise<{ io: IscrittoDiProva } | { errore: string } | null> {
  const r = esitoRitornoGoogle(indirizzo)
  if (r.tipo === 'errore') return { errore: r.messaggio }
  if (urlPulito(indirizzo) === indirizzo) return null
  const c = await cliente().catch(() => null)
  if (!c) return { errore: GOOGLE_NON_RIUSCITO }
  // getSession aspetta che il client abbia letto l'indirizzo e aperto la sessione.
  const { data } = await c.auth.getSession()
  if (!data?.session) return { errore: GOOGLE_NON_RIUSCITO }
  try {
    return { io: await entraDopoGoogle(c, data.session.user.id) }
  } catch (e) {
    return { errore: e instanceof Error ? e.message : GOOGLE_NON_RIUSCITO }
  }
}
