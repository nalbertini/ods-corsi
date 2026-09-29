import type { SupabaseClient } from '@supabase/supabase-js'
import { chiaveSessione, indirizzoProgetto, unisciSessioni } from '../../../src/lib/sessioni'

/**
 * Il collegamento al database di ODS Corsi.
 *
 * Il timer non ha una porta sua: l'accesso si fa in ODS Corsi — l'istruttore
 * o il tablet, dalla stessa porta — e le due app, sulla stessa origine,
 * condividono il `localStorage` in cui Supabase tiene la sessione. Il timer la
 * trova lì, con la stessa chiave (`sessioni.ts`), e parla col database a nome
 * di chi ha fatto l'accesso. Chi decide cosa si può fare sono le policy di
 * `supabase/08-timer.sql`, non questo file.
 *
 * Senza database, in prova o senza un accesso, il timer fa quello che ha
 * sempre fatto: tiene tutto sul dispositivo.
 */

const URL_SUPABASE = import.meta.env.VITE_SUPABASE_URL
const CHIAVE_SUPABASE = import.meta.env.VITE_SUPABASE_ANON_KEY

/**
 * La prova scelta a mano in ODS Corsi (`ods-corsi:prova`, vedi `dati.ts`): lì
 * il database non si tocca, e qui nemmeno. La chiave è quella di ODS Corsi
 * apposta: la prova è una per il sito, non una per app.
 */
function inProva(): boolean {
  try {
    return localStorage.getItem('ods-corsi:prova') === '1'
  } catch {
    return false
  }
}

/** Vero quando il pacchetto ha un database e non si è in prova. */
export const haUnServer = !!(URL_SUPABASE && CHIAVE_SUPABASE) && !inProva()

const chiave = haUnServer ? chiaveSessione(indirizzoProgetto(URL_SUPABASE!)) : null

/**
 * C'è un accesso su questo dispositivo? La sessione è una sola, di un
 * istruttore o del tablet di una sala: chi dei due lo dice il server (vedi
 * `chiSei`).
 */
function sessioneDelDispositivo(): boolean {
  if (!chiave) return false
  unisciSessioni(indirizzoProgetto(URL_SUPABASE!))
  try {
    return !!localStorage.getItem(chiave)
  } catch {
    return false
  }
}

export const sessione: boolean = sessioneDelDispositivo()

let client: Promise<SupabaseClient> | null = null

/**
 * Il client si carica solo se serve: pesa più del timer intero, e chi non ha
 * un accesso non ha motivo di aprirlo. Uno solo per sessione: due client sulla
 * stessa si contenderebbero il rinnovo del token. Quello di ODS Corsi, aperto
 * in un'altra scheda, non litiga con questo: Supabase rinnova il token sotto
 * un lucchetto del browser con il nome della chiave, che è la stessa.
 */
export function db(): Promise<SupabaseClient> {
  if (!sessione || !chiave) return Promise.reject(new Error('nessun accesso'))
  if (!client) {
    client = import('@supabase/supabase-js')
      .then(({ createClient }) =>
        createClient(indirizzoProgetto(URL_SUPABASE!), CHIAVE_SUPABASE!.trim(), {
          auth: { persistSession: true, autoRefreshToken: true, storageKey: chiave },
        }),
      )
      .catch((e) => {
        client = null
        throw e
      })
  }
  return client
}

/** Chi sta usando il timer, per quello che serve al timer. */
export type Accesso =
  | { chi: 'nessuno' }
  | { chi: 'personale'; personaId: string; nome: string }
  | { chi: 'sala'; sala: string }

/**
 * L'ultimo accesso visto, per aprire il timer senza rete: la sessione sta già
 * sul dispositivo, e chiudere fuori un istruttore in fondo a una sala senza
 * campo solo perché il server non risponde sarebbe peggio che inutile.
 */
const DOVE_ACCESSO = 'ods-timer:accesso'

export function accessoRicordato(): Accesso {
  if (!sessione) return { chi: 'nessuno' }
  try {
    const a = JSON.parse(localStorage.getItem(DOVE_ACCESSO) ?? 'null') as Accesso | null
    if (a && a.chi !== 'nessuno') return a
  } catch {
    // Illeggibile: si chiede al server.
  }
  return { chi: 'nessuno' }
}

function ricorda(a: Accesso) {
  try {
    if (a.chi === 'nessuno') localStorage.removeItem(DOVE_ACCESSO)
    else localStorage.setItem(DOVE_ACCESSO, JSON.stringify(a))
  } catch {
    // Si perde solo l'apertura senza rete.
  }
}

/**
 * Chiede al server chi è collegato. Senza risposta (niente rete) vale l'ultima
 * vista; una risposta che dice «nessuno» (sessione scaduta, account tolto) la
 * cancella.
 */
export async function chiSei(): Promise<Accesso> {
  if (!sessione) return { chi: 'nessuno' }
  const c = await db()
  const { data: s } = await c.auth.getSession()
  const utente = s.session?.user.id
  if (!utente) {
    ricorda({ chi: 'nessuno' })
    return { chi: 'nessuno' }
  }
  let a: Accesso = { chi: 'nessuno' }
  const { data, error } = await c
    .from('persone')
    .select('id, nome, ruolo')
    .eq('utente_id', utente)
    .eq('attiva', true)
    .maybeSingle()
  if (error) return accessoRicordato()
  const p = data as { id: string; nome: string; ruolo: string } | null
  if (p && p.ruolo !== 'iscritto') a = { chi: 'personale', personaId: p.id, nome: p.nome }
  else {
    // Non è una persona: il tablet di una sala, che vede la sua riga e basta.
    const { data, error } = await c.from('postazioni').select('nome, sale(nome)').eq('utente_id', utente).maybeSingle()
    if (error) return accessoRicordato()
    const t = data as { nome: string; sale: { nome: string } | { nome: string }[] | null } | null
    const sala = Array.isArray(t?.sale) ? t?.sale[0]?.nome : t?.sale?.nome
    if (t) a = { chi: 'sala', sala: sala ?? t.nome }
  }
  ricorda(a)
  return a
}

/**
 * Un identificativo che il database accetta. I timer nati sul dispositivo
 * hanno un nome corto (`uid()` in `format.ts`); quelli che vanno sul database
 * ne vogliono uno vero, scelto qui e non dal server, così un timer creato
 * senza rete ha già il suo nome definitivo.
 */
export function nuovoId(): string {
  // Fuori da HTTPS `randomUUID` non c'è: stesso formato, a mano.
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const b = crypto.getRandomValues(new Uint8Array(16))
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

export const eUnId = (s: string | null | undefined): s is string =>
  !!s && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
