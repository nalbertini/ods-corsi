import type { SupabaseClient } from '@supabase/supabase-js'
import type { Ruolo } from './sala'
import { haUnServer } from './dati'
import { indirizzoDiRitorno } from './invito'
import { PERSONA_VISTA } from './sessioni'
import { indirizzo, INDIRIZZI } from './aree'
import { areaDelPercorso } from './percorso'
import { emailDellaSala, smettiTablet } from './tablet'
import { areeDi, type AreaDiAccount } from './ruoli'
import { sessione, svuotaBozze } from './segnalazioni'

export { areeDi, nomeDelRuolo, type AreaDiAccount } from './ruoli'

/**
 * Chi sta usando l'app: con il database vero il calendario e l'appello sono
 * solo per istruttori e segreteria.
 *
 * Il controllo vero sta nelle policy (`supabase/02-policy.sql`): chi non ha
 * fatto l'accesso non legge niente. Questo serve a mostrare una porta invece
 * di un calendario rotto, e a dire chiaramente perché un account non entra.
 *
 * La sessione è una sola per tutte le aree (vedi `sessioni.ts`), e l'account
 * dice qual è la sua: la segreteria in segreteria, un istruttore nel
 * calendario, il tablet di una sala in sala. Chi apre l'indirizzo di un'altra
 * area torna nella sua (vedi `Account` e `passaA`).
 *
 * Chi è di segreteria e insegna anche (il ruolo doppio, `anche_istruttore` in
 * `01-schema.sql`) di aree ne ha due: all'accesso sceglie dove andare, e
 * poi passa dall'una all'altra senza uscire.
 */

export interface Personale {
  /** L'id in `persone`. Può mancare nell'ultima persona ricordata da una versione vecchia. */
  id?: string
  nome: string
  cognome: string
  ruolo: Exclude<Ruolo, 'iscritto'>
  /** Di segreteria, e insegna anche: entra in tutte e due le aree. */
  ancheIstruttore?: boolean
}

/**
 * L'account collegato: le aree in cui entra, quella in cui va (l'ultima
 * scelta, per chi ne ha più d'una), e la persona se non è il tablet di una sala.
 */
export interface Account {
  area: AreaDiAccount
  aree: AreaDiAccount[]
  persona: Personale | null
}

/** L'account di una persona, nell'area scelta se è una delle sue. */
function accountDellaPersona(persona: Personale, scelta?: AreaDiAccount): Account {
  const aree = areeDi(persona)
  return { area: scelta && aree.includes(scelta) ? scelta : aree[0], aree, persona }
}

/** L'area di questa pagina è una di quelle dell'account? */
export const eUnaSua = (a: Account, area: string | null) => a.aree.some((x) => x === area)

/**
 * L'ultimo account visto, per l'apertura senza rete: la sessione di Supabase
 * sta già sul dispositivo, e chiedere al server chi è per aprire l'app vorrebbe
 * dire chiudere fuori un istruttore in fondo a una sala senza campo. È solo
 * un nome da mostrare e un'area in cui andare: i dati li decidono comunque le
 * policy.
 */
function ricordato(utente: string): Account | null {
  try {
    const r = JSON.parse(localStorage.getItem(PERSONA_VISTA) ?? 'null') as
      | ({ utente: string; area?: AreaDiAccount } & Partial<Personale>)
      | null
    if (!r || r.utente !== utente) return null
    const persona = r.nome && r.ruolo ? { id: r.id, nome: r.nome, cognome: r.cognome ?? '', ruolo: r.ruolo, ancheIstruttore: !!r.ancheIstruttore } : null
    if (persona) return accountDellaPersona(persona, r.area)
    return r.area === 'sala' ? { area: 'sala', aree: ['sala'], persona: null } : null
  } catch {
    return null
  }
}

/** L'area scelta da chi ne ha più d'una, per la prossima volta. */
function ricordaArea(area: AreaDiAccount) {
  try {
    const r = JSON.parse(localStorage.getItem(PERSONA_VISTA) ?? 'null') as { area?: AreaDiAccount } | null
    if (r && r.area !== area) localStorage.setItem(PERSONA_VISTA, JSON.stringify({ ...r, area }))
  } catch {
    // Senza localStorage si riparte dalla prima area.
  }
}

function ricorda(utente: string, a: Account | null) {
  try {
    if (a) localStorage.setItem(PERSONA_VISTA, JSON.stringify({ utente, area: a.area, ...a.persona }))
    else localStorage.removeItem(PERSONA_VISTA)
  } catch {
    // Senza localStorage si perde solo l'apertura senza rete.
  }
}

const db = () => import('./supabase').then((m) => m.clientSupabase())

/**
 * Va nell'area del proprio account, e se ne ha più d'una se la ricorda. Una
 * persona entrata dalla porta del tablet non è un tablet: il dispositivo
 * smette di riaprirsi in sala.
 */
export function passaA(area: AreaDiAccount) {
  if (area !== 'sala') smettiTablet()
  ricordaArea(area)
  window.location.assign(indirizzo(INDIRIZZI[area]))
}

/**
 * L'area scelta da chi ne ha più d'una, dopo la porta: `true` se è questa
 * pagina e si resta, se no si va di là (vedi `passaA`) e la pagina cambia.
 */
export function scegliArea(area: AreaDiAccount): boolean {
  if (area !== areaDelPercorso()) {
    passaA(area)
    return false
  }
  ricordaArea(area)
  return true
}

/**
 * L'account collegato su questo dispositivo, o `null` senza accesso, e anche
 * per un account che non è né del personale né di un tablet: un utente creato
 * e non ancora legato in `persone`.
 */
export async function account(): Promise<Account | null> {
  const c = await db()
  const { data: s } = await c.auth.getSession()
  const utente = s.session?.user.id
  if (!utente) return null
  const visto = ricordato(utente)
  const letto = await accountDi(c, utente, visto?.area)
  // Senza rete la risposta non c'è, non è un «no»: vale l'ultimo visto.
  if (letto === undefined) return visto
  ricorda(utente, letto)
  return letto
}

/** La persona dell'account collegato, se è di un istruttore o della segreteria. */
export async function chiSei(): Promise<Personale | null> {
  return (await account())?.persona ?? null
}

/**
 * L'account di un utente: `null` se non è di nessuno, `undefined` se il server
 * non ha risposto. `scelta` è l'area scelta l'ultima volta, per chi ne ha più d'una.
 */
async function accountDi(c: SupabaseClient, utente: string, scelta?: AreaDiAccount): Promise<Account | null | undefined> {
  const persona = await personaDi(c, utente)
  if (persona === undefined) return undefined
  if (persona) return accountDellaPersona(persona, scelta)
  // La policy lascia a un tablet la sua riga e basta (vedi `tabletSupabase.ts`).
  const { data, error } = await c.from('postazioni').select('attiva').eq('utente_id', utente).maybeSingle()
  if (error) return undefined
  return (data as { attiva: boolean } | null)?.attiva ? { area: 'sala', aree: ['sala'], persona: null } : null
}

/**
 * La persona del personale legata all'account: `null` se non c'è, `undefined`
 * se il server non ha risposto.
 */
async function personaDi(c: SupabaseClient, utente: string): Promise<Personale | null | undefined> {
  // `*` e non l'elenco delle colonne: su un database che non ha ancora il
  // ruolo doppio (`anche_istruttore`, in `01-schema.sql`) si entra lo stesso.
  const leggi = () => c.from('persone').select('*').eq('utente_id', utente).eq('attiva', true).maybeSingle()
  let { data, error } = await leggi()
  // Al primo accesso l'account non è ancora legato: se in anagrafica c'è un
  // istruttore o una segreteria con la sua email, `collega_utente()` (in
  // `05-segreteria.sql`) li lega, e non serve farlo a mano dal SQL Editor.
  if (!error && !data) {
    const { data: legato } = await c.rpc('collega_utente')
    if (legato) ({ data, error } = await leggi())
  }
  if (error) return undefined
  const riga = data as { id: string; nome: string; cognome: string; ruolo: Ruolo; anche_istruttore?: boolean } | null
  if (!riga || riga.ruolo === 'iscritto') return null
  return { id: riga.id, nome: riga.nome, cognome: riga.cognome, ruolo: riga.ruolo, ancheIstruttore: riga.ruolo === 'staff' && !!riga.anche_istruttore }
}

/**
 * Dopo la porta: si resta in questa pagina con chi è entrato (`null` per una
 * sala), o chi ha più di un'area sceglie dove andare (vedi `scegliArea`).
 */
export type Entrato = { persona: Personale | null; scegli?: undefined } | { persona: Personale; scegli: AreaDiAccount[] }

/**
 * La porta unica: la stessa alla radice e in ogni area. Si entra con
 * l'email, o col nome utente per l'account di una sala (vedi
 * `emailDellaSala`), e l'account dice dove andare: la segreteria in
 * segreteria, un istruttore nel calendario, il tablet di una sala in sala.
 *
 * Chi ha più di un'area, la segreteria che insegna anche, sceglie: torna
 * `scegli`, qualunque porta abbia aperto. Se no, se l'area è questa pagina si
 * resta, e torna la persona entrata; se no si va nell'area giusta (vedi
 * `passaA`) e la pagina cambia, e la promessa non torna più.
 */
export async function accedi(utente: string, password: string): Promise<Entrato> {
  const c = await db()
  const { error } = await c.auth.signInWithPassword({ email: emailDellaSala(utente), password })
  if (error) throw new Error(perché(error))
  const { data: s } = await c.auth.getSession()
  const id = s.session?.user.id
  const a = id ? await accountDi(c, id) : null
  if (a === undefined) {
    await c.auth.signOut()
    throw new Error('Il server non risponde: c’è rete?')
  }
  if (!a) {
    await c.auth.signOut()
    throw new Error('Questo account non è di un istruttore, della segreteria o del tablet di una sala: chiedi alla segreteria')
  }
  if (id) ricorda(id, a)
  if (a.persona && a.aree.length > 1) return { persona: a.persona, scegli: a.aree }
  if (a.area === areaDelPercorso()) return { persona: a.persona }
  passaA(a.area)
  return new Promise<never>(() => {})
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

/** Esce, e torna alla porta: l'area la sceglie il prossimo account. */
export async function esci(): Promise<void> {
  // Le bozze delle segnalazioni restano nella scheda: al banco il computer è
  // di tutti. Prima di tutto, così le toglie anche se il client non arriva.
  svuotaBozze(sessione())
  const c = await db()
  ricorda('', null)
  await c.auth.signOut()
  smettiTablet()
  window.location.assign(indirizzo('./'))
}

/**
 * Quando l'account cambia senza passare dalla porta: la sessione scaduta o
 * chiusa, un altro accesso o un'uscita in un'altra scheda (la sessione è una sola). `f` riceve
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
