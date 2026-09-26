import type { Ruolo } from './sala'
import { haUnServer } from './dati'

/**
 * Chi sta usando l'app: con il database vero il calendario e l'appello sono
 * solo per istruttori e segreteria.
 *
 * Il controllo vero sta nelle policy (`supabase/02-policy.sql`): chi non ha
 * fatto l'accesso non legge niente. Questo serve a mostrare una porta invece
 * di un calendario rotto, e a dire chiaramente perché un account non entra.
 */

export interface Personale {
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
const DOVE = 'ods-corsi:personale'   // vedi la nota in coda.ts

function ricordato(utente: string): Personale | null {
  try {
    const r = JSON.parse(localStorage.getItem(DOVE) ?? 'null') as ({ utente: string } & Personale) | null
    return r && r.utente === utente ? { nome: r.nome, cognome: r.cognome, ruolo: r.ruolo } : null
  } catch {
    return null
  }
}

function ricorda(utente: string, p: Personale | null) {
  try {
    if (p) localStorage.setItem(DOVE, JSON.stringify({ utente, ...p }))
    else localStorage.removeItem(DOVE)
  } catch {
    // Senza localStorage si perde solo l'apertura senza rete.
  }
}

const db = () => import('./supabase').then((m) => m.clientSupabase())

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

  const { data, error } = await c
    .from('persone')
    .select('nome, cognome, ruolo')
    .eq('utente_id', utente)
    .eq('attiva', true)
    .maybeSingle()
  // Senza rete la risposta non c'è, non è un «no»: vale l'ultima vista.
  if (error) return ricordato(utente)

  const riga = data as { nome: string; cognome: string; ruolo: Ruolo } | null
  const p = riga && riga.ruolo !== 'iscritto' ? { nome: riga.nome, cognome: riga.cognome, ruolo: riga.ruolo } : null
  ricorda(utente, p)
  return p
}

export async function entra(email: string, password: string): Promise<Personale> {
  const c = await db()
  const { error } = await c.auth.signInWithPassword({ email, password })
  if (error) throw new Error(perché(error))
  const p = await chiSei()
  if (!p) {
    await c.auth.signOut()
    throw new Error('Questo account non è di un istruttore né della segreteria: va legato in «persone»')
  }
  return p
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

export async function esci(): Promise<void> {
  const c = await db()
  ricorda('', null)
  await c.auth.signOut()
}

/** Quando la sessione finisce da sola (scaduta, chiusa da un'altra scheda). */
export async function quandoEsce(f: () => void): Promise<() => void> {
  const c = await db()
  const { data } = c.auth.onAuthStateChange((evento) => {
    if (evento === 'SIGNED_OUT') f()
  })
  return () => data.subscription.unsubscribe()
}

/** Serve una porta solo quando c'è un database: in prova si entra e basta. */
export const serveAccesso = haUnServer
