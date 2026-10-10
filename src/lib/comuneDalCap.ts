import capTorino from './capTorino.json'

/**
 * Il comune dal CAP, per i CAP della provincia di Torino (`scripts/cap-torino.mjs`).
 * È un aiuto, non un controllo: Poste non pubblica i CAP e l'elenco può
 * sbagliare, quindi il comune proposto si corregge a mano e un comune già
 * scritto non si tocca. Fuori provincia non si propone niente.
 */
export type ElencoCap = Record<string, string[]>

export const ELENCO_CAP: ElencoCap = capTorino

/** Fino a sei comuni si sceglie coi tasti; di più, con la tendina. */
export const TETTO_TASTI = 6

const uguale = (a: string, b: string) => a.trim().toLocaleLowerCase('it') === b.trim().toLocaleLowerCase('it')

/**
 * Cosa fare del comune dopo il CAP: `scrivi` il comune (campo vuoto, CAP di un
 * comune solo), la `nota` sotto il campo quando il comune è quello del CAP, o
 * le `scelte` quando il CAP è di più comuni e il campo non ne ha già uno.
 */
export function comuneDalCap(cap: string, comune: string, elenco: ElencoCap = ELENCO_CAP): { scrivi?: string; scelte: string[]; tendina: boolean; nota?: string } {
  const c = cap.trim()
  const comuni = /^\d{5}$/.test(c) ? (elenco[c] ?? []) : []
  if (comuni.length === 1) {
    const [solo] = comuni
    const nota = `Dal CAP ${c}. Se non è il tuo comune, correggilo.`
    if (!comune.trim()) return { scrivi: solo, scelte: [], tendina: false, nota }
    return uguale(comune, solo) ? { scelte: [], tendina: false, nota } : { scelte: [], tendina: false }
  }
  if (comuni.length > 1 && !comuni.some((x) => uguale(x, comune))) return { scelte: comuni, tendina: comuni.length > TETTO_TASTI }
  return { scelte: [], tendina: false }
}

/** Il CAP nuovo, e con lui il comune quando il CAP è di un comune solo e il campo è vuoto. */
export function conIlComune<T extends { cap: string; comune: string }>(dati: T, cap: string, elenco: ElencoCap = ELENCO_CAP): T {
  const scrivi = comuneDalCap(cap, dati.comune, elenco).scrivi
  return { ...dati, cap, ...(scrivi && { comune: scrivi }) }
}

export const fraseDellaScelta = (cap: string, quanti: number) => `Il CAP ${cap.trim()} è di ${quanti} comuni: tocca il tuo.`

export const etichettaTendina = (cap: string, quanti: number) => `IL CAP ${cap.trim()} È DI ${quanti} COMUNI`
