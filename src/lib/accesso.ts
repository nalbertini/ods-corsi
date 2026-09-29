import type { SupabaseClient } from '@supabase/supabase-js'
import type { Ruolo } from './sala'
import { haUnServer } from './dati'
import { indirizzoDiRitorno } from './invito'
import { sessioneDellaPagina } from './percorso'
import { chiaviSessione, indirizzoProgetto, PERSONA_VISTA, type Sessione } from './sessioni'
import { indirizzo, INDIRIZZI } from './aree'
import { areaDelPercorso } from './percorso'
import { emailDellaSala, smettiTablet } from './tablet'

/**
 * Chi sta usando l'app: con il database vero il calendario e l'appello sono
 * solo per istruttori e segreteria.
 *
 * Il controllo vero sta nelle policy (`supabase/02-policy.sql`): chi non ha
 * fatto l'accesso non legge niente. Questo serve a mostrare una porta invece
 * di un calendario rotto, e a dire chiaramente perché un account non entra.
 */

export interface Personale {
  /** L'id in `persone`. Può mancare nell'ultima persona ricordata da una versione vecchia. */
  id?: string
  nome: string
  cognome: string
  ruolo: Exclude<Ruolo, 'iscritto'>
}

/**
 * L'ultima persona vista, per l'apertura senza rete: la sessione di Supabase
 * sta già sul dispositivo, e chiedere al server chi è per aprire l'app vorrebbe
 * dire chiudere fuori un istruttore in fondo a una sala senza campo. È solo
 * un nome da mostrare: i dati li decidono comunque le policy.
 */
const DOVE = () => PERSONA_VISTA[sessioneDellaPagina()]   // vedi la nota in coda.ts

function ricordato(utente: string): Personale | null {
  try {
    const r = JSON.parse(localStorage.getItem(DOVE()) ?? 'null') as ({ utente: string } & Personale) | null
    return r && r.utente === utente ? { id: r.id, nome: r.nome, cognome: r.cognome, ruolo: r.ruolo } : null
  } catch {
    return null
  }
}

function ricorda(utente: string, p: Personale | null) {
  try {
    if (p) localStorage.setItem(DOVE(), JSON.stringify({ utente, ...p }))
    else localStorage.removeItem(DOVE())
  } catch {
    // Senza localStorage si perde solo l'apertura senza rete.
  }
}

/**
 * Il client della sessione di questa pagina: istruttori e segreteria hanno
 * ognuno la sua (vedi `sessioni.ts`), e l'accesso fatto in una non vale
 * nell'altra.
 */
const db = () => import('./supabase').then((m) => m.clientSupabase())

/** Le aree con un accesso: dove porta ogni tipo di account. */
export type AreaDiAccount = 'segreteria' | 'istruttori' | 'sala'

const SESSIONE_DELL_AREA: Record<AreaDiAccount, Sessione> = { segreteria: 'segreteria', istruttori: 'personale', sala: 'sala' }

/**
 * La sessione in cui entra la porta di questa pagina: quella della pagina, e
 * sul tablet di sala quella della sala, che è il client del tablet.
 */
const sessioneDiQui = (): Sessione => (areaDelPercorso() === 'sala' ? 'sala' : sessioneDellaPagina())

/**
 * Va a un'altra area portandosi dietro l'accesso fatto qui: per chi è entrato
 * dalla porta dell'altra, o dalla porta unica della radice (vedi
 * `spostaSessione`). Qui non resta collegato.
 */
export async function passaA(area: AreaDiAccount): Promise<void> {
  const m = await import('./supabase')
  m.spostaSessione(SESSIONE_DELL_AREA[area], sessioneDiQui())
  // Una persona entrata dalla porta del tablet non è un tablet: il
  // dispositivo smette di riaprirsi in sala.
  if (area !== 'sala') smettiTablet()
  window.location.assign(indirizzo(INDIRIZZI[area]))
}

/**
 * La persona dell'account collegato, se è di un istruttore o della segreteria.
 * `null` senza accesso, e anche per un account che non è del personale: il
 * tablet di una sala, o un utente creato e non ancora legato in `persone`.
 */
export async function chiSei(): Promise<Personale | null> {
  const c = await db()
  const { data: s } = await c.auth.getSession()
  const utente = s.session?.user.id
  if (!utente) return null
  const letta = await personaDi(c, utente)
  // Senza rete la risposta non c'è, non è un «no»: vale l'ultima vista.
  if (letta === undefined) return ricordato(utente)
  ricorda(utente, letta)
  return letta
}

/**
 * La persona del personale legata all'account: `null` se non c'è, `undefined`
 * se il server non ha risposto.
 */
async function personaDi(c: SupabaseClient, utente: string): Promise<Personale | null | undefined> {
  const leggi = () => c.from('persone').select('id, nome, cognome, ruolo').eq('utente_id', utente).eq('attiva', true).maybeSingle()
  let { data, error } = await leggi()
  // Al primo accesso l'account non è ancora legato: se in anagrafica c'è un
  // istruttore o una segreteria con la sua email, `collega_utente()` (in
  // `05-segreteria.sql`) li lega, e non serve farlo a mano dal SQL Editor.
  if (!error && !data) {
    const { data: legato } = await c.rpc('collega_utente')
    if (legato) ({ data, error } = await leggi())
  }
  if (error) return undefined
  const riga = data as { id: string; nome: string; cognome: string; ruolo: Ruolo } | null
  return riga && riga.ruolo !== 'iscritto' ? { id: riga.id, nome: riga.nome, cognome: riga.cognome, ruolo: riga.ruolo } : null
}

/**
 * La porta unica: la stessa in ogni area, e alla radice. Si entra con
 * l'email, o col nome utente per l'account di una sala (vedi
 * `emailDellaSala`), e l'account dice dove andare: la segreteria in
 * segreteria, un istruttore nel calendario, il tablet di una sala in sala.
 *
 * Se l'area è questa pagina si resta, e torna la persona entrata (`null` per
 * una sala); se no l'accesso si porta nell'area giusta (vedi `passaA`) e la
 * pagina cambia, e la promessa non torna più.
 */
export async function accedi(utente: string, password: string): Promise<Personale | null> {
  const m = await import('./supabase')
  const c = m.clientSupabase(sessioneDiQui())
  const { error } = await c.auth.signInWithPassword({ email: emailDellaSala(utente), password })
  if (error) throw new Error(perché(error))
  const { data: s } = await c.auth.getSession()
  const id = s.session?.user.id
  const persona = id ? await personaDi(c, id) : null
  if (persona === undefined) {
    await c.auth.signOut()
    throw new Error('Il server non risponde: c’è rete?')
  }
  let area: AreaDiAccount | null = persona ? (persona.ruolo === 'staff' ? 'segreteria' : 'istruttori') : null
  if (!area && id) {
    // La policy lascia a un tablet la sua riga e basta (vedi `tabletSupabase.ts`).
    const { data } = await c.from('postazioni').select('attiva').eq('utente_id', id).maybeSingle()
    if ((data as { attiva: boolean } | null)?.attiva) area = 'sala'
  }
  if (!area) {
    await c.auth.signOut()
    throw new Error('Questo account non è di un istruttore, della segreteria o del tablet di una sala: chiedi alla segreteria')
  }
  if (area === areaDelPercorso()) return persona
  await passaA(area)
  return new Promise<never>(() => {})
}

/**
 * Dove è già entrato qualcuno su questo dispositivo, per la radice: chi apre
 * la porta unica ed è già collegato va dritto nella sua area. Guarda solo se
 * una sessione c'è, senza chiederlo al server: la porta dell'area, se la
 * sessione non vale più, lo dice da sé.
 */
export function areaCollegata(): AreaDiAccount | null {
  try {
    const k = chiaviSessione(indirizzoProgetto(import.meta.env.VITE_SUPABASE_URL as string))
    if (localStorage.getItem(k.segreteria)) return 'segreteria'
    if (localStorage.getItem(k.personale)) return 'istruttori'
  } catch {
    // Senza localStorage non c'è nemmeno una sessione ricordata.
  }
  return null
}

/**
 * Il motivo del rifiuto, detto per quello che è: «email o password
 * sbagliate» per tutto faceva cercare una password giusta quando il guaio era
 * altrove (un account non confermato, un indirizzo del server sbagliato).
 */
function perché(e: { message?: string; code?: string; status?: number }): string {
  const codice = e.code ?? ''
  const testo = e.message ?? ''
  if (codice === 'invalid_credentials' || /invalid login credentials/i.test(testo)) return 'Email o password sbagliate'
  if (codice === 'email_not_confirmed' || /not confirmed/i.test(testo))
    return 'L’account non è ancora confermato: in Supabase, Authentication → Users'
  if (/fetch|network|load failed/i.test(testo)) return 'Il server non risponde: c’è rete?'
  return `Il server ha rifiutato l’accesso${testo ? `: ${testo}` : ''}`
}

/**
 * Dopo un link di Supabase (l'invito o «password dimenticata»): l'email
 * dell'account che il link ha aperto, o `null` se il link non ha portato una
 * sessione. Il client la ricava dall'indirizzo quando nasce.
 */
export async function accountDalLink(): Promise<string | null> {
  const c = await db()
  const { data } = await c.auth.getSession()
  return data.session?.user.email ?? null
}

/**
 * La password scelta dopo il link. Poi si entra come dalla porta: al primo
 * accesso l'account si lega alla scheda con la stessa email, e un account che
 * non è del personale resta fuori.
 */
export async function scegliPassword(password: string): Promise<Personale> {
  const c = await db()
  const { error } = await c.auth.updateUser({ password })
  if (error) throw new Error(perchéPassword(error))
  const p = await chiSei()
  if (!p) {
    await c.auth.signOut()
    throw new Error('La password è salvata, ma questo account non è di un istruttore né della segreteria: chiedi alla segreteria')
  }
  return p
}

/**
 * «Password dimenticata»: Supabase manda il link per sceglierne una nuova.
 * Non dice se l'email ha un account, e nemmeno qui lo si dice.
 */
export async function mandaLinkPassword(email: string): Promise<void> {
  const c = await db()
  const { error } = await c.auth.resetPasswordForEmail(email, { redirectTo: indirizzoDiRitorno() })
  if (!error) return
  if (error.status === 429 || /rate limit/i.test(error.message)) throw new Error('Troppe richieste: riprova fra un po’')
  throw new Error(perché(error))
}

function perchéPassword(e: { message?: string; code?: string }): string {
  const testo = e.message ?? ''
  if (e.code === 'weak_password' || /at least|weak/i.test(testo)) return `La password è troppo debole${testo ? `: ${testo}` : ''}`
  if (e.code === 'same_password') return 'È la stessa di prima: scegline una diversa'
  if (e.code === 'session_not_found' || /session/i.test(testo)) return 'Il link non vale più: chiedine un altro'
  if (/fetch|network|load failed/i.test(testo)) return 'Il server non risponde: c’è rete?'
  return `La password non è stata salvata${testo ? `: ${testo}` : ''}`
}

export async function esci(): Promise<void> {
  const c = await db()
  ricorda('', null)
  await c.auth.signOut()
}

/**
 * Quando l'account cambia senza passare dalla porta: la sessione scaduta o
 * chiusa, un altro accesso in un'altra scheda della stessa area. `f` riceve
 * se c'è ancora qualcuno collegato; il rinnovo del token, che non cambia
 * nessuno, non conta.
 */
export async function quandoCambia(f: (collegato: boolean) => void): Promise<() => void> {
  const c = await db()
  const { data: s } = await c.auth.getSession()
  let ultimo = s.session?.user.id ?? null
  const { data } = c.auth.onAuthStateChange((_evento, sessione) => {
    const adesso = sessione?.user.id ?? null
    if (adesso === ultimo) return
    ultimo = adesso
    f(adesso !== null)
  })
  return () => data.subscription.unsubscribe()
}

/** Serve una porta solo quando c'è un database: in prova si entra e basta. */
export const serveAccesso = haUnServer
