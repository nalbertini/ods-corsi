/**
 * Le tariffe dei tecnici: quanto prende un tecnico per un'ora di lezione,
 * una per ogni corso che insegna, anche da sostituto
 * (`77-tariffe-tecnici.sql`). Il compenso del mese è, corso per corso, le ore
 * confermate per la sua tariffa.
 *
 * Gli importi sono in centesimi, come nelle ricevute.
 */
import { euro } from './ricevute'

/** Il limite del database: più di mille euro l'ora è di sicuro uno sbaglio di battitura. */
export const MASSIMO_CENTESIMI_ORA = 100_000

/** «15», «15,50» o «15.5» in centesimi; `null` se non è un importo che si può pagare. */
export function centesimiDaEuro(testo: string): number | null {
  const t = testo.trim().replace(',', '.')
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null
  const c = Math.round(Number(t) * 100)
  return c > 0 && c <= MASSIMO_CENTESIMI_ORA ? c : null
}

export const euroOra = (centesimi: number) => `${euro(centesimi)} € l’ora`

export interface RigaTariffa {
  corso: string
  centesimi?: number
  /** Non è fra i corsi di cui è titolare: l'ha fatto da sostituto, o non lo insegna più. */
  daSostituto: boolean
}

/**
 * Una riga per corso nella scheda del tecnico: quelli di cui è titolare,
 * quelli in cui ha fatto lezione e quelli che hanno già una tariffa, così una
 * tariffa scritta non sparisce quando il corso passa a un altro.
 */
export function righeTariffe(corsiTitolare: string[], corsiConPresenze: string[], tariffe: Array<{ corso: string; centesimi: number }>): RigaTariffa[] {
  const di = new Map(tariffe.map((t) => [t.corso, t.centesimi]))
  const titolare = new Set(corsiTitolare)
  return [...new Set([...corsiTitolare, ...corsiConPresenze, ...di.keys()])]
    .sort((a, b) => a.localeCompare(b, 'it'))
    .map((corso) => {
      const centesimi = di.get(corso)
      return { corso, ...(centesimi === undefined ? {} : { centesimi }), daSostituto: !titolare.has(corso) }
    })
}

/** Il limite di `tariffe_istruttori`, detto prima di salvare. `null` se va bene. */
export function cosaNonVaTariffa(centesimi: number): string | null {
  if (!Number.isInteger(centesimi) || centesimi <= 0) return 'La tariffa è un importo più grande di zero'
  if (centesimi > MASSIMO_CENTESIMI_ORA) return 'La tariffa è al massimo 1.000 € l’ora'
  return null
}
