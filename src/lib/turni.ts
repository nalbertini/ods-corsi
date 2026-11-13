/**
 * Il doppio turno: un corso con più lezioni lo stesso giorno (di Roma).
 *
 * Chi è presente a un turno non si segna negli altri, né presente né
 * assente: non sta nel loro appello e non pesa nei loro conti. Un ASSENTE o
 * un GIUSTIFICATO messo prima resta salvato, si ignora soltanto: se la
 * presenza viene tolta, la persona torna com'era. Nei conti per persona
 * (presenze su dovute, assenze di fila) il giorno vale una lezione sola.
 * La stessa regola sta in SQL, in `supabase/145-doppio-turno.sql`.
 */
import type { StatoPresenza } from './sala'

// Come `giornoRoma` di `contabilita.ts`, senza tirarsi dietro la contabilità: la chat e i server non sono a Roma.
const roma = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' })
const giornoRoma = (iso: string) => roma.format(new Date(iso))

export interface Turno { id: string; corsoId: string; inizio: string; stato?: string }

const stessoGiorno = (a: Turno, b: Turno) => a.corsoId === b.corsoId && giornoRoma(a.inizio) === giornoRoma(b.inizio)
const valido = (t: Turno) => t.stato !== 'annullata'

/**
 * Chi è presente a un altro turno dello stesso corso e giorno, e qui no:
 * persona → `inizio` di quel turno, per dire «già presente alle 17:30».
 */
export function presentiAltrove(
  turno: Turno,
  turni: readonly Turno[],
  presenze: readonly { sessioneId: string; personaId: string; stato: StatoPresenza | null }[],
): Map<string, string> {
  const altri = new Map(turni.filter((t) => t.id !== turno.id && valido(t) && stessoGiorno(t, turno)).map((t) => [t.id, t.inizio]))
  const qui = new Set(presenze.filter((p) => p.sessioneId === turno.id && p.stato === 'presente').map((p) => p.personaId))
  const altrove = new Map<string, string>()
  for (const p of presenze) {
    const inizio = altri.get(p.sessioneId)
    if (p.stato === 'presente' && inizio && !qui.has(p.personaId) && !altrove.has(p.personaId)) altrove.set(p.personaId, inizio)
  }
  return altrove
}

type RigaConAppello = Turno & { appello: Array<{ personaId: string; stato: StatoPresenza | null }> }

/** Le righe del registro senza, in ogni lezione, chi è presente a un altro turno dello stesso giorno. */
export function togliAltrove<R extends RigaConAppello>(righe: readonly R[]): R[] {
  const presenze = righe.flatMap((r) => r.appello.map((p) => ({ sessioneId: r.id, personaId: p.personaId, stato: p.stato })))
  return righe.map((r) => {
    const altrove = presentiAltrove(r, righe, presenze)
    return altrove.size ? { ...r, appello: r.appello.filter((p) => !altrove.has(p.personaId)) } : r
  })
}

// Per il giorno: presente a un turno vale presente; se no giustificato, poi assente, poi niente segno.
const PESO: Record<string, number> = { presente: 3, giustificato: 2, assente: 1 }
const peso = (s: StatoPresenza | null) => (s ? PESO[s] ?? 0 : 0)

/**
 * Una riga per corso e giorno, per contare per persona: i turni con
 * l'appello fatto si fondono, gli annullati e quelli senza appello restano
 * come sono (chi conta li salta già).
 */
export function unisciTurni<R extends RigaConAppello>(righe: readonly R[]): R[] {
  const fuse = new Map<string, R>()
  const resto: R[] = []
  for (const r of [...righe].sort((a, b) => a.inizio.localeCompare(b.inizio))) {
    if (!valido(r) || !r.appello.some((p) => p.stato !== null)) {
      resto.push(r)
      continue
    }
    const chiave = `${r.corsoId}|${giornoRoma(r.inizio)}`
    const prima = fuse.get(chiave)
    if (!prima) {
      fuse.set(chiave, r)
      continue
    }
    const appello = new Map(prima.appello.map((p) => [p.personaId, p]))
    for (const p of r.appello) {
      const c = appello.get(p.personaId)
      if (!c || peso(p.stato) > peso(c.stato)) appello.set(p.personaId, p)
    }
    fuse.set(chiave, { ...prima, appello: [...appello.values()] })
  }
  return [...fuse.values(), ...resto].sort((a, b) => a.inizio.localeCompare(b.inizio))
}

/**
 * Lo storico di una persona: un segno per corso e giorno, il più forte dei
 * turni (presente, poi giustificato, poi assente, poi niente). L'ordine resta.
 */
export function unSegnoAlGiorno<R extends { corsoId: string; inizio: string; stato: StatoPresenza | null }>(righe: readonly R[]): R[] {
  const scelta = new Map<string, R>()
  for (const r of righe) {
    const chiave = `${r.corsoId}|${giornoRoma(r.inizio)}`
    const c = scelta.get(chiave)
    if (!c || peso(r.stato) > peso(c.stato)) scelta.set(chiave, r)
  }
  const tenute = new Set(scelta.values())
  return righe.filter((r) => tenute.has(r))
}
