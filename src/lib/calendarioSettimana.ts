import type { Posto } from './indirizzoSegreteria'
import { chiaveGiorno, giornoPerEsteso, lunedi } from './sala'

/**
 * Il calendario che si apre dalle date della SETTIMANA: quale mese mostrare,
 * le 42 caselle del mese, la settimana evidenziata, dove porta un giorno scelto.
 * Tutto per giorni di calendario locali (`setDate`), mai sommando 24 ore: nella
 * settimana del cambio d'ora i giorni non saltano né si ripetono.
 */

/** `mese` come `Date.getMonth()`: da 0 (gennaio) a 11. */
export interface MeseDelCalendario {
  anno: number
  mese: number
}

export interface CellaGiorno {
  chiave: string
  giorno: number
  delMese: boolean
  oggi: boolean
  dellaSettimana: boolean
  conLezioni: boolean
}

const MESI_CORTI = ['GEN', 'FEB', 'MAR', 'APR', 'MAG', 'GIU', 'LUG', 'AGO', 'SET', 'OTT', 'NOV', 'DIC']
const MESI = ['GENNAIO', 'FEBBRAIO', 'MARZO', 'APRILE', 'MAGGIO', 'GIUGNO', 'LUGLIO', 'AGOSTO', 'SETTEMBRE', 'OTTOBRE', 'NOVEMBRE', 'DICEMBRE']

const piu = (d: Date, giorni: number) => {
  const x = new Date(d)
  x.setDate(x.getDate() + giorni)
  return x
}

/** «21 – 27 SETTEMBRE», o «28 SET – 4 OTTOBRE» quando cambia il mese. */
export function titoloSettimana(primo: Date): string {
  const ultimo = piu(primo, 6)
  const mese = (d: Date) => giornoPerEsteso(chiaveGiorno(d)).split(' ').at(-1)!.toUpperCase()
  return primo.getMonth() === ultimo.getMonth()
    ? `${primo.getDate()} – ${ultimo.getDate()} ${mese(ultimo)}`
    : `${primo.getDate()} ${MESI_CORTI[primo.getMonth()]} – ${ultimo.getDate()} ${mese(ultimo)}`
}

/** Il nome del tasto-titolo per chi non vede lo schermo. */
export function nomeTitoloSettimana(primo: Date): string {
  return `${titoloSettimana(primo).toLowerCase()}: scegli un'altra data`
}

export function giorniDellaSettimana(primo: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => piu(primo, i))
}

/** Il mese del giovedì: la settimana «sta» dove cadono più dei suoi giorni, e vi sta sempre per almeno quattro. */
export function meseDellaSettimana(primo: Date): MeseDelCalendario {
  const giovedi = piu(primo, 3)
  return { anno: giovedi.getFullYear(), mese: giovedi.getMonth() }
}

export function mesePrimaDopo(m: MeseDelCalendario, passo: -1 | 1): MeseDelCalendario {
  const x = new Date(m.anno, m.mese + passo, 1)
  return { anno: x.getFullYear(), mese: x.getMonth() }
}

export function nomeMese(m: MeseDelCalendario): string {
  return `${MESI[m.mese]} ${m.anno}`
}

/** Il primo giorno delle 42 caselle: il lunedì della settimana che contiene il 1° del mese. */
const primaCasella = (m: MeseDelCalendario) => lunedi(new Date(m.anno, m.mese, 1))

/**
 * Sempre sei righe da sette, così il calendario non cambia altezza da un mese
 * all'altro. `conLezioni` è `null` finché non si sa: allora nessun giorno ha il
 * quadratino, mai un «senza lezioni» falso.
 */
export function grigliaDelMese(m: MeseDelCalendario, lunediScelto: Date, oggi: Date, conLezioni: ReadonlySet<string> | null): CellaGiorno[][] {
  const scelti = new Set(giorniDellaSettimana(lunediScelto).map(chiaveGiorno))
  const chiaveOggi = chiaveGiorno(oggi)
  const inizio = primaCasella(m)
  return Array.from({ length: 6 }, (_, r) =>
    Array.from({ length: 7 }, (_, c) => {
      const g = piu(inizio, r * 7 + c)
      const chiave = chiaveGiorno(g)
      return {
        chiave,
        giorno: g.getDate(),
        delMese: g.getMonth() === m.mese && g.getFullYear() === m.anno,
        oggi: chiave === chiaveOggi,
        dellaSettimana: scelti.has(chiave),
        conLezioni: conLezioni?.has(chiave) ?? false,
      }
    }),
  )
}

/** Il primo e l'ultimo giorno delle 42 caselle (a mezzanotte): quello che si legge per i quadratini. */
export function finestraDelMese(m: MeseDelCalendario): { da: Date; a: Date } {
  const da = primaCasella(m)
  return { da, a: piu(da, 41) }
}

/** I giorni, `AAAA-MM-GG` locali, di un elenco di istanti: una lezione di sabato sera non diventa di domenica. */
export function giorniConLezioni(inizi: string[]): Set<string> {
  return new Set(inizi.map((i) => chiaveGiorno(new Date(i))))
}

/** Dopo la data fino a cui il calendario ha le lezioni; se non si sa, no. */
export function oltreIlCalendario(chiave: string, prontoFino: string | null): boolean {
  return prontoFino !== null && chiave > prontoFino
}

/**
 * Il posto dopo aver scelto un giorno: la settimana di quel giorno, e niente lezione aperta, che se no
 * (`settimanaDi`) deciderebbe lei la settimana. Sala e il resto restano.
 */
export function postoDopoIlGiorno(posto: Omit<Posto, 'voce'>, giorno: Date): Omit<Posto, 'voce'> {
  return { ...posto, settimana: chiaveGiorno(lunedi(giorno)), lezione: undefined }
}
