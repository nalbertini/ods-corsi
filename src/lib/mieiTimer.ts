import type { Workout } from '../../timer/src/types'
import { haUnServer } from './dati'

/**
 * I MIEI TIMER: quale timer parte con quale corso, e con quale lezione.
 *
 * I timer si fanno e si cambiano nel timer; qui si sceglie soltanto dove
 * partono. Un timer legato a un corso vale per tutte le sue lezioni; quelli
 * legati a una lezione sola, anche più d'uno, vengono prima di quelli del
 * corso, per quella lezione (vedi `timer/src/lib/gruppi.ts`).
 *
 * Col database i collegamenti stanno in `corsi_timer` (08-timer.sql) e
 * `sessioni_timer` (11-timer-lezioni.sql), e li vedono il tablet di sala e
 * gli altri istruttori. In prova stanno sui timer del dispositivo, gli
 * stessi che il timer apre: così la prova fa vedere tutto il giro.
 */

/** Un timer da scegliere, o da nominare accanto a un corso o a una lezione. */
export interface TimerDaScegliere {
  id: string
  nome: string
  /** Lo schema, per dirlo accanto al nome: INTERVALLI, EMOM… */
  modo: string
  /** Si può scegliere: è mio, della palestra, o del dispositivo in prova. Quelli dei colleghi si vedono e basta. */
  sceglibile: boolean
}

export interface Collegamenti {
  /** Per ogni corso, i timer collegati. */
  corsi: Record<string, string[]>
  /** Per ogni lezione, i suoi timer: vengono prima di quelli del corso. */
  lezioni: Record<string, string[]>
  /** Falso se il database non ha ancora `11-timer-lezioni.sql`. */
  lezioniPronte: boolean
}

export interface DatiMieiTimer {
  timer(): Promise<TimerDaScegliere[]>
  collegamenti(): Promise<Collegamenti>
  collegaCorso(corsoId: string, timerId: string, collegato: boolean): Promise<void>
  /** Lega o slega un timer a una lezione; senza timer suoi, la lezione usa quelli del corso. */
  collegaLezione(lezioneId: string, timerId: string, collegato: boolean): Promise<void>
}

export const NOMI_MODO: Record<string, string> = {
  interval: 'INTERVALLI',
  circuit: 'CIRCUITO',
  emom: 'EMOM',
  amrap: 'AMRAP',
  fortime: 'FOR TIME',
}

export function datiMieiTimer(io: string | undefined): Promise<DatiMieiTimer> {
  return haUnServer ? import('./supabase').then((m) => conDatabase(m.clientSupabase(), io)) : import('../../timer/src/lib/storage').then(inProva)
}

// ---------------------------------------------------------------------------
// In prova: i timer del dispositivo, quelli di `ods-timer:workouts`.
// ---------------------------------------------------------------------------

function inProva(s: typeof import('../../timer/src/lib/storage')): DatiMieiTimer {
  const cambia = (id: string, f: (w: Workout) => Workout) => s.saveWorkouts(s.loadWorkouts().map((w) => (w.id === id ? f(w) : w)))
  return {
    async timer() {
      return s.loadWorkouts().map((w) => ({ id: w.id, nome: w.name, modo: w.mode, sceglibile: true }))
    },
    async collegamenti() {
      const corsi: Record<string, string[]> = {}
      const lezioni: Record<string, string[]> = {}
      for (const w of s.loadWorkouts()) {
        for (const c of w.corsi ?? []) corsi[c] = [...(corsi[c] ?? []), w.id]
        for (const l of w.lezioni ?? []) lezioni[l] = [...(lezioni[l] ?? []), w.id]
      }
      return { corsi, lezioni, lezioniPronte: true }
    },
    async collegaCorso(corsoId, timerId, collegato) {
      cambia(timerId, (w) => {
        const via = (w.corsi ?? []).filter((c) => c !== corsoId)
        return { ...w, corsi: collegato ? [...via, corsoId] : via }
      })
    },
    async collegaLezione(lezioneId, timerId, collegato) {
      cambia(timerId, (w) => {
        const via = (w.lezioni ?? []).filter((l) => l !== lezioneId)
        return { ...w, lezioni: collegato ? [...via, lezioneId] : via }
      })
    },
  }
}

// ---------------------------------------------------------------------------
// Col database. Le scritture vanno dirette e non in coda: chi sceglie un timer
// per la lezione di domani ha la rete, e deve sapere subito se non è andata.
// ---------------------------------------------------------------------------

type Client = ReturnType<typeof import('./supabase').clientSupabase>

/** La tabella non c'è: `11-timer-lezioni.sql` non è ancora stato lanciato. */
const manca = (e: { code?: string } | null) => !!e && (e.code === '42P01' || e.code === 'PGRST205')

function conDatabase(db: Client, io: string | undefined): DatiMieiTimer {
  const fallito = (e: { message?: string } | null) => {
    if (e) throw new Error(e.message ?? 'Il server non risponde')
  }
  return {
    async timer() {
      const { data, error } = await db.from('timer').select('id, persona_id, nome, schema').order('nome')
      fallito(error)
      return ((data ?? []) as Array<{ id: string; persona_id: string | null; nome: string; schema: { mode?: string } | null }>).map((r) => ({
        id: r.id,
        nome: r.nome,
        modo: r.schema?.mode ?? '',
        sceglibile: r.persona_id === null || r.persona_id === io,
      }))
    },
    async collegamenti() {
      const oggi = new Date()
      oggi.setHours(0, 0, 0, 0)
      const [ct, st] = await Promise.all([
        db.from('corsi_timer').select('corso_id, timer_id'),
        db.from('sessioni_timer').select('sessione_id, timer_id, sessioni!inner ( inizio )').gte('sessioni.inizio', oggi.toISOString()),
      ])
      fallito(ct.error)
      if (st.error && !manca(st.error)) fallito(st.error)
      const corsi: Record<string, string[]> = {}
      for (const r of (ct.data ?? []) as Array<{ corso_id: string; timer_id: string }>) corsi[r.corso_id] = [...(corsi[r.corso_id] ?? []), r.timer_id]
      const lezioni: Record<string, string[]> = {}
      for (const r of (st.error ? [] : (st.data ?? [])) as Array<{ sessione_id: string; timer_id: string }>)
        lezioni[r.sessione_id] = [...(lezioni[r.sessione_id] ?? []), r.timer_id]
      return { corsi, lezioni, lezioniPronte: !st.error }
    },
    async collegaCorso(corsoId, timerId, collegato) {
      if (collegato) fallito((await db.from('corsi_timer').upsert({ corso_id: corsoId, timer_id: timerId }, { ignoreDuplicates: true })).error)
      else fallito((await db.from('corsi_timer').delete().eq('corso_id', corsoId).eq('timer_id', timerId)).error)
    },
    async collegaLezione(lezioneId, timerId, collegato) {
      if (collegato) fallito((await db.from('sessioni_timer').upsert({ sessione_id: lezioneId, timer_id: timerId }, { ignoreDuplicates: true })).error)
      else fallito((await db.from('sessioni_timer').delete().eq('sessione_id', lezioneId).eq('timer_id', timerId)).error)
    },
  }
}
