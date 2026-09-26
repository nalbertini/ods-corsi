import type { Dove, HistoryEntry, Settings, Workout } from '../types'
import { Coda, type Operazione } from '../../../src/lib/coda'
import { db, nuovoId, sessione } from './palestra'
import { type ImpostazioniSala, impostazioniSala } from './impostazioniSala'

/**
 * I timer, lo storico e le preferenze sul database di ODS Corsi.
 *
 * Il dispositivo resta la prima copia: la lista si apre da `localStorage`
 * come sempre, e il database la aggiorna quando risponde. Ogni scrittura
 * passa dalla stessa coda di ODS Corsi (`src/lib/coda.ts`), sotto una chiave
 * sua: in palestra il wifi è quello che è, e un timer salvato in fondo alla
 * sala non si deve perdere perché la rete non c'era.
 */

/** Un corso, per collegarci un timer e per il titolo della lezione. */
export interface Corso {
  id: string
  nome: string
  colore?: string
}

interface RigaTimer {
  id: string
  persona_id: string | null
  nome: string
  schema: Record<string, unknown>
  cambiato_il: string
}

/** Quello che il database custodisce di un timer: tutto tranne ciò che dice dove sta. */
function schemaDi(w: Workout): Record<string, unknown> {
  const s: Record<string, unknown> = { ...w }
  for (const k of ['id', 'name', 'builtin', 'updatedAt', 'dove', 'corsi', 'lezioni']) delete s[k]
  return s
}

const MODI = ['interval', 'circuit', 'emom', 'amrap', 'fortime']

/** Il timer letto dal database, o niente se lo schema non è uno che il timer sa far partire. */
function workoutDa(r: RigaTimer, io: string | null, corsi: string[], lezioni: string[]): Workout | null {
  const s = r.schema as Partial<Workout>
  if (!s || typeof s.mode !== 'string' || !MODI.includes(s.mode)) return null
  const dove: Dove = r.persona_id === null ? 'palestra' : r.persona_id === io ? 'miei' : 'collega'
  return {
    ...(s as Workout),
    exercises: Array.isArray(s.exercises) ? s.exercises : [],
    id: r.id,
    name: r.nome,
    builtin: false,
    updatedAt: Date.parse(r.cambiato_il) || Date.now(),
    dove,
    corsi,
    lezioni,
  }
}

/**
 * Un errore che riprovare non risolve: un permesso negato, un dato che il
 * database rifiuta. Tenerlo in coda la bloccherebbe per sempre, perché la
 * coda si ferma al primo errore; si lascia andare. Tutto il resto — la rete
 * che manca, il server che non risponde, il token da rinnovare — si riprova.
 */
function definitivo(e: { code?: string } | null): boolean {
  return !!e?.code && /^(42|23|22|P0|PGRST1|PGRST2)/.test(e.code)
}

async function esegui(op: Operazione): Promise<void> {
  const c = await db()
  // Senza più una sessione (scaduta, o uscita da ODS Corsi) il database
  // risponderebbe «permesso negato» a tutto, e la coda butterebbe via le
  // modifiche come rifiutate. Aspettano invece che l'accesso torni.
  const { data: s } = await c.auth.getSession()
  if (!s.session) throw new Error('nessun accesso')
  const fallito = (e: { code?: string; message?: string } | null) => {
    if (!e) return
    if (definitivo(e)) {
      console.warn(`Il database ha rifiutato «${op.tipo}»: resta solo su questo dispositivo.`, e)
      return
    }
    throw new Error(e.message ?? 'server irraggiungibile')
  }

  switch (op.tipo) {
    case 'salva': {
      const [w, io] = op.args as [Workout, string]
      const { error } = await c.from('timer').upsert({
        id: w.id,
        persona_id: w.dove === 'miei' ? io : null,
        nome: w.name.trim().slice(0, 80) || 'Timer senza nome',
        schema: schemaDi(w),
      })
      if (error) return fallito(error)
      // I corsi dopo il timer, nella stessa operazione: separate, un timer
      // nuovo risalvato mentre la rete non c'è finirebbe in coda dopo i suoi
      // corsi, e il collegamento a un timer che il server non ha ancora
      // verrebbe rifiutato.
      const voluti = w.corsi ?? []
      const { data: ci, error: e1 } = await c.from('corsi_timer').select('corso_id').eq('timer_id', w.id)
      if (e1) return fallito(e1)
      const ci_sono = (ci ?? []).map((r) => (r as { corso_id: string }).corso_id)
      const via = ci_sono.filter((x) => !voluti.includes(x))
      const nuovi = voluti.filter((x) => !ci_sono.includes(x))
      if (via.length) fallito((await c.from('corsi_timer').delete().eq('timer_id', w.id).in('corso_id', via)).error)
      if (nuovi.length)
        fallito(
          (
            await c
              .from('corsi_timer')
              .upsert(nuovi.map((corso_id) => ({ corso_id, timer_id: w.id })), { ignoreDuplicates: true })
          ).error,
        )
      return
    }
    case 'elimina': {
      const [id] = op.args as [string]
      return fallito((await c.from('timer').delete().eq('id', id)).error)
    }
    case 'allenamento': {
      const [riga] = op.args as [Record<string, unknown>]
      let { error } = await c.from('allenamenti').upsert(riga, { ignoreDuplicates: true })
      // Il timer o la lezione non ci sono (più): cancellati nel frattempo, o
      // il timer non è ancora arrivato. L'allenamento si tiene lo stesso.
      if (error?.code === '23503')
        ({ error } = await c.from('allenamenti').upsert({ ...riga, timer_id: null, sessione_id: null }, { ignoreDuplicates: true }))
      return fallito(error)
    }
    case 'preferenze': {
      const [impostazioni] = op.args as [Record<string, unknown>]
      return fallito((await c.from('preferenze_timer').upsert({ impostazioni }, { onConflict: 'persona_id' })).error)
    }
  }
}

let unica: Coda | null = null
function coda(): Coda | null {
  if (!sessione) return null
  unica ??= new Coda(esegui, 'ods-timer:coda')
  return unica
}

/** Quante scritture non sono ancora arrivate al database. */
export function guardaCoda(f: (n: number) => void): () => void {
  const c = coda()
  if (!c) return () => {}
  const via = c.guarda(f)
  return () => void via()
}

const inizioDiOggi = () => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

/** Tutto quello che il database ha per chi è collegato: timer, collegamenti ai corsi, corsi. */
export async function scaricaLibreria(io: string | null): Promise<{ timer: Workout[]; corsi: Corso[] }> {
  const c = await db()
  const [t, ct, co, st] = await Promise.all([
    c.from('timer').select('id, persona_id, nome, schema, cambiato_il').order('nome'),
    c.from('corsi_timer').select('corso_id, timer_id'),
    c.from('corsi').select('id, nome, colore').eq('attivo', true).order('nome'),
    // Solo le lezioni da oggi in poi: quelle passate non si aprono più.
    c.from('sessioni_timer').select('sessione_id, timer_id, sessioni!inner ( inizio )').gte('sessioni.inizio', inizioDiOggi()),
  ])
  const e = t.error ?? ct.error ?? co.error
  if (e) throw new Error(e.message)
  const corsiDi = new Map<string, string[]>()
  for (const r of (ct.data ?? []) as Array<{ corso_id: string; timer_id: string }>) {
    corsiDi.set(r.timer_id, [...(corsiDi.get(r.timer_id) ?? []), r.corso_id])
  }
  // Senza `11-timer-lezioni.sql` la tabella non c'è: le lezioni aprono i
  // timer del corso, come prima, e il resto della libreria arriva lo stesso.
  const lezioniDi = new Map<string, string[]>()
  for (const r of (st.error ? [] : (st.data ?? [])) as Array<{ sessione_id: string; timer_id: string }>) {
    lezioniDi.set(r.timer_id, [...(lezioniDi.get(r.timer_id) ?? []), r.sessione_id])
  }
  const timer = ((t.data ?? []) as RigaTimer[])
    .map((r) => workoutDa(r, io, corsiDi.get(r.id) ?? [], lezioniDi.get(r.id) ?? []))
    .filter((w): w is Workout => w !== null)
  const corsi = ((co.data ?? []) as Array<{ id: string; nome: string; colore: string | null }>).map((r) => ({
    id: r.id,
    nome: r.nome,
    colore: r.colore ?? undefined,
  }))
  return { timer, corsi }
}

/**
 * La lista da mostrare: i timer solo di questo dispositivo, più quelli del
 * database — appena arrivati, o l'ultima copia vista se `dalServer` è nullo —
 * con sopra le modifiche ancora in coda.
 */
export function unisci(attuali: Workout[], dalServer: Workout[] | null): Workout[] {
  const soloQui = attuali.filter((w) => !w.dove)
  const lista = [...(dalServer ?? attuali.filter((w) => w.dove))]
  for (const op of coda()?.operazioni ?? []) {
    if (op.tipo === 'salva') {
      const w = op.args[0] as Workout
      const i = lista.findIndex((x) => x.id === w.id)
      if (i === -1) lista.push(w)
      else lista[i] = w
    } else if (op.tipo === 'elimina') {
      const i = lista.findIndex((x) => x.id === op.args[0])
      if (i !== -1) lista.splice(i, 1)
    }
  }
  return [...lista, ...soloQui]
}

/** Toglie le copie del database: senza più un accesso non sono né aggiornate né modificabili. */
export const soloDelDispositivo = (lista: Workout[]) => lista.filter((w) => !w.dove)

export function salvaSulServer(w: Workout, io: string) {
  coda()?.accoda(`timer:${w.id}`, 'salva', [w, io])
}

/** Stessa chiave del salvataggio: cancellare un timer mai arrivato lo toglie dalla coda e basta. */
export function eliminaDalServer(w: Workout) {
  coda()?.accoda(`timer:${w.id}`, 'elimina', [w.id])
}

/** Un timer del dispositivo che va sul database: prende un identificativo vero. */
export function versoIlServer(w: Workout, dove: 'palestra' | 'miei'): Workout {
  return { ...w, id: nuovoId(), dove, builtin: false, updatedAt: Date.now(), corsi: w.corsi ?? [], lezioni: [] }
}

export function registraAllenamento(e: HistoryEntry, timer: Workout, lezioneId: string | null) {
  coda()?.accoda(`allenamento:${e.id}`, 'allenamento', [
    {
      id: nuovoId(),
      timer_id: timer.dove ? timer.id : null,
      nome: timer.name.trim().slice(0, 80) || 'Timer senza nome',
      sessione_id: lezioneId,
      finito_il: new Date(e.finishedAt).toISOString(),
      secondi: Math.max(0, Math.min(86400, e.seconds)),
      completato: e.completed,
    },
  ])
}

/**
 * Le impostazioni che seguono l'istruttore da un dispositivo all'altro. Le
 * altre dipendono dal dispositivo: la voce di sistema scelta c'è su questo
 * telefono e magari non sul tablet, lo schermo sempre acceso è del tablet.
 */
export const PREFERENZE: Array<keyof Settings> = [
  'coach',
  'countdownBeep',
  'voice',
  'recordedVoice',
  'announceNext',
  'ticchettio',
  'vibrate',
  'volume',
  'bigScreen',
]

export function preferenzeDi(s: Settings): Partial<Settings> {
  const p: Partial<Settings> = {}
  for (const k of PREFERENZE) (p as Record<string, unknown>)[k] = s[k]
  return p
}

export async function scaricaPreferenze(): Promise<Partial<Settings> | null> {
  const c = await db()
  const { data, error } = await c.from('preferenze_timer').select('impostazioni').maybeSingle()
  if (error) throw new Error(error.message)
  const grezze = (data as { impostazioni: Record<string, unknown> } | null)?.impostazioni
  if (!grezze) return null
  const p: Partial<Settings> = {}
  for (const k of PREFERENZE) if (k in grezze) (p as Record<string, unknown>)[k] = grezze[k]
  return p
}

export function salvaPreferenze(s: Settings) {
  coda()?.accoda('preferenze', 'preferenze', [preferenzeDi(s)])
}

/**
 * Il timer di un tablet di sala, come l'ha scelto la segreteria: sta nella
 * riga delle impostazioni di ODS Corsi, che un tablet può leggere.
 */
export async function scaricaImpostazioniSala(): Promise<ImpostazioniSala> {
  const c = await db()
  const { data, error } = await c.from('impostazioni').select('timer').maybeSingle()
  if (error) throw new Error(error.message)
  return impostazioniSala((data as { timer: unknown } | null)?.timer)
}
