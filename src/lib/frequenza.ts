/**
 * L'ordine dell'appello: chi viene di più a quella lezione sta in cima.
 *
 * «Quella lezione» è lo stesso corso nello stesso giorno della settimana: l'ora
 * non conta, così una lezione spostata da un'ora all'altra tiene il suo storico.
 */
import { perCognome, type Persona, type StatoPresenza } from './sala'

export interface SessioneStorico { id: string; corsoId: string; inizio: string; stato: string }
export interface PresenzaStorico { sessioneId: string; personaId: string; stato: StatoPresenza }

/** Quante lezioni indietro si guarda: più vecchie di così non dicono più chi viene adesso. */
export const LEZIONI_CONTATE = 12

const giornoRoma = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'Europe/Rome' })
const settimanaDi = (iso: string) => giornoRoma.format(new Date(iso))

/**
 * Le (al massimo 12) lezioni passate, non annullate, dello stesso corso e giorno che contano per `aperta`, dalla più recente.
 * Non si chiede `svolta`: lo stato lo mette solo il tasto Chiudi, e un appello segnato dal tablet o
 * lasciato aperto resta `prevista` pur essendosi fatto.
 */
export const lezioniContate = (aperta: { id: string; corsoId: string; inizio: string }, sessioni: readonly SessioneStorico[]): SessioneStorico[] => {
  const giorno = settimanaDi(aperta.inizio)
  const prima = new Date(aperta.inizio).getTime()
  return sessioni
    .filter((s) => s.id !== aperta.id && s.corsoId === aperta.corsoId && s.stato !== 'annullata'
      && new Date(s.inizio).getTime() < prima && settimanaDi(s.inizio) === giorno)
    .sort((a, b) => b.inizio.localeCompare(a.inizio))
    .slice(0, LEZIONI_CONTATE)
}

/** Persona → quante volte è stata `presente` nelle ultime 12 lezioni fatte dello stesso corso e giorno (Europe/Rome), prima di `aperta`. */
export const contaPresenze = (
  aperta: { id: string; corsoId: string; inizio: string },
  sessioni: readonly SessioneStorico[],
  presenze: readonly PresenzaStorico[],
): Map<string, number> => {
  const ultime = new Set(lezioniContate(aperta, sessioni).map((s) => s.id))
  const conti = new Map<string, number>()
  for (const p of presenze) {
    if (p.stato === 'presente' && ultime.has(p.sessioneId)) conti.set(p.personaId, (conti.get(p.personaId) ?? 0) + 1)
  }
  return conti
}

/** Gli iscritti dal più presente al meno; a parità `perCognome`; le prove in fondo, per cognome. */
export const ordinaPerPresenze = <P extends Persona & { prova?: boolean }>(elenco: P[], conti: ReadonlyMap<string, number>): P[] => [
  ...elenco.filter((p) => !p.prova).sort((a, b) => (conti.get(b.id) ?? 0) - (conti.get(a.id) ?? 0) || perCognome(a, b)),
  ...elenco.filter((p) => p.prova).sort(perCognome),
]

/** Chi va in cima in una lezione passata riaperta: i non segnati, se non lo sono tutti. Vuoto se la lezione non è passata. */
export const primiDaSegnare = (iscritti: readonly { id: string; stato: StatoPresenza | null }[], passata: boolean): Set<string> => {
  const vuoti = iscritti.filter((p) => p.stato === null)
  return new Set(passata && vuoti.length < iscritti.length ? vuoti.map((p) => p.id) : [])
}

/** Gli iscritti con `primi` davanti, ciascun gruppo nell'ordine ricevuto. */
export const inOrdineDiApertura = <P extends { id: string }>(iscritti: P[], primi: ReadonlySet<string>): P[] =>
  primi.size ? [...iscritti.filter((p) => primi.has(p.id)), ...iscritti.filter((p) => !primi.has(p.id))] : iscritti
