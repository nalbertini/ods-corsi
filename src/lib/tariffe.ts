/**
 * Le tariffe dei tecnici: quanto prende un tecnico per un'ora di lezione,
 * una per ogni corso che insegna, anche da sostituto
 * (`78-tariffe-tecnici.sql`). Il compenso del mese è, corso per corso, le ore
 * confermate per la sua tariffa.
 *
 * Gli importi sono in centesimi, come nelle ricevute.
 */
import { euro } from './ricevute'
import type { Tariffa } from './segreteria'

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

/** Come si riscrive nel campo per correggerla: «12,50», senza il punto delle migliaia che poi non si rileggerebbe. */
export const euroDaScrivere = (centesimi: number) => (centesimi / 100).toFixed(2).replace('.', ',')

/** Perché quel che è scritto nel campo non si può salvare; `null` se va, o se non c'è ancora niente. */
export function cosaNonVaEuroOra(testo: string): string | null {
  if (!testo.trim()) return null
  if (centesimiDaEuro(testo) !== null) return null
  const t = testo.trim().replace(',', '.')
  if (/^\d+(\.\d{1,2})?$/.test(t)) return Number(t) > 0 ? 'La tariffa è al massimo 1.000 € l’ora' : 'La tariffa è un importo più grande di zero'
  return 'Scrivi gli euro l’ora, per esempio 15 o 15,50'
}

export interface RigaTariffa {
  corso: string
  /** Senza: il corso non si trova più per nome, e la tariffa non si può scrivere. */
  corsoId?: string
  centesimi?: number
  /** Perché c'è: ne è titolare, l'ha fatto da sostituto, o ha una tariffa ma non lo insegna più. */
  perche: 'titolare' | 'sostituto' | 'non più'
}

/**
 * Una riga per corso nella scheda del tecnico: quelli di cui è titolare,
 * quelli in cui ha una presenza confermata (anche da sostituto) e quelli che
 * hanno già una tariffa, così una tariffa scritta non sparisce quando il corso
 * passa a un altro.
 */
export function righeTariffe(
  personaId: string,
  corsiTitolare: string[],
  presenze: Array<{ corso: string; stato: string; personaId: string }>,
  tariffe: Tariffa[],
  corsi: Array<{ id: string; nome: string }>,
): RigaTariffa[] {
  const fatti = new Set(presenze.filter((x) => x.personaId === personaId && x.stato === 'confermata').map((x) => x.corso))
  const titolare = new Set(corsiTitolare)
  const tariffa = new Map(tariffe.map((t) => [t.corso, t]))
  return [...new Set([...corsiTitolare, ...fatti, ...tariffa.keys()])]
    .sort((a, b) => a.localeCompare(b, 'it'))
    .map((corso) => {
      const t = tariffa.get(corso)
      const corsoId = t?.corsoId ?? corsi.find((c) => c.nome === corso)?.id
      return {
        corso,
        ...(corsoId ? { corsoId } : {}),
        ...(t ? { centesimi: t.centesimi } : {}),
        perche: titolare.has(corso) ? 'titolare' : fatti.has(corso) ? 'sostituto' : 'non più',
      }
    })
}

/** Il limite di `tariffe_istruttori`, detto prima di salvare. `null` se va bene. */
export function cosaNonVaTariffa(centesimi: number): string | null {
  if (!Number.isInteger(centesimi) || centesimi <= 0) return 'La tariffa è un importo più grande di zero'
  if (centesimi > MASSIMO_CENTESIMI_ORA) return 'La tariffa è al massimo 1.000 € l’ora'
  return null
}
