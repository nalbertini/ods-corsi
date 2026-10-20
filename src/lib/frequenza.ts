/**
 * L'ordine dell'appello: chi viene di più a quella lezione sta in cima.
 *
 * «Quella lezione» è lo stesso corso nello stesso giorno della settimana: l'ora
 * non conta, così una lezione spostata da un'ora all'altra tiene il suo storico.
 */
import { perCognome, type Persona, type StatoPresenza } from './sala'
import type { RigaRegistro } from './segreteria'

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

/** Una lezione del registro, quanto basta per contare: PRESENZE e lo strumento `chi_manca` della chat. */
export type LezioneRegistro = Pick<RigaRegistro, 'corsoId' | 'corso' | 'inizio' | 'stato' | 'appello'>

/** «Chi si sta perdendo»: tante assenze di fila, negli appelli fatti. */
export const DI_FILA = 3

export const conAppello = (r: Pick<RigaRegistro, 'appello'>) => r.appello.some((p) => p.stato !== null)

/** Presenti su lezioni dovute: i giustificati non contano né sopra né sotto. */
export function conto(righe: readonly LezioneRegistro[]) {
  let presenti = 0
  let dovute = 0
  for (const r of righe) {
    if (r.stato === 'annullata' || !conAppello(r)) continue
    for (const p of r.appello) {
      if (p.stato === 'giustificato') continue
      dovute++
      if (p.stato === 'presente') presenti++
    }
  }
  return { presenti, dovute }
}

export const percento = (x: { presenti: number; dovute: number }) => (x.dovute ? Math.round((100 * x.presenti) / x.dovute) : null)

/**
 * Chi ha almeno `DI_FILA` assenze di fila, contando dall'ultimo appello fatto all'indietro, in tutti i corsi o in
 * `corso`: le lezioni annullate o senza appello e i giustificati non spezzano la fila. Dalla fila più lunga, poi per
 * nome; con l'ultima volta che è venuto e i corsi delle assenze.
 */
export function chiSiStaPerdendo(righe: readonly LezioneRegistro[], corso?: string) {
  const perPersona = new Map<string, { nome: string; segni: Array<{ stato: string | null; corso: string; inizio: string }> }>()
  for (const r of [...righe].sort((a, b) => a.inizio.localeCompare(b.inizio))) {
    if (r.stato === 'annullata' || !conAppello(r)) continue
    if (corso && r.corsoId !== corso) continue
    for (const x of r.appello) {
      if (x.stato === 'giustificato') continue
      const v = perPersona.get(x.personaId) ?? { nome: `${x.cognome} ${x.nome}`, segni: [] }
      v.segni.push({ stato: x.stato, corso: r.corso, inizio: r.inizio })
      perPersona.set(x.personaId, v)
    }
  }
  return [...perPersona.entries()]
    .map(([id, v]) => {
      let fila = 0
      for (let i = v.segni.length - 1; i >= 0 && v.segni[i].stato !== 'presente'; i--) fila++
      const ultima = [...v.segni].reverse().find((s) => s.stato === 'presente')
      return { id, nome: v.nome, fila, corsi: [...new Set(v.segni.slice(-fila).map((s) => s.corso))], ultima: ultima?.inizio }
    })
    .filter((x) => x.fila >= DI_FILA)
    .sort((a, b) => b.fila - a.fila || a.nome.localeCompare(b.nome, 'it'))
}
