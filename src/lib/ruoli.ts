/**
 * I ruoli di chi lavora in palestra, e le aree in cui entra.
 *
 * Nel database il ruolo è `istruttore` o `staff` (la segreteria), e
 * `anche_istruttore` dice che chi è di segreteria insegna anche (vedi
 * `01-schema.sql`): il ruolo doppio. Chi ce l'ha può quello che può la
 * segreteria, gli si danno dei corsi come a un istruttore, e all'accesso
 * sceglie in che area andare.
 *
 * Sta qui da solo, senza import, perché lo chiedono la porta (`accesso.ts`)
 * e la segreteria, e le prove in `scripts/` lo leggono senza il resto dell'app.
 */

/** Le aree con un accesso: dove porta ogni tipo di account. */
export type AreaDiAccount = 'segreteria' | 'istruttori' | 'sala'

/** Il ruolo come sta in `persone`. */
export interface RuoloPersonale {
  ruolo: 'istruttore' | 'staff'
  /** Di segreteria, e insegna anche. */
  ancheIstruttore?: boolean
}

/** Il ruolo come lo sceglie la segreteria: `entrambi` è la segreteria che insegna anche. */
export type RuoloScelto = 'istruttore' | 'staff' | 'entrambi'

export const ruoloScelto = (p: RuoloPersonale): RuoloScelto =>
  p.ruolo === 'istruttore' ? 'istruttore' : p.ancheIstruttore ? 'entrambi' : 'staff'

export const daRuoloScelto = (r: RuoloScelto): Required<RuoloPersonale> => ({
  ruolo: r === 'istruttore' ? 'istruttore' : 'staff',
  ancheIstruttore: r === 'entrambi',
})

/** Insegna: un istruttore, o la segreteria col ruolo doppio. Gli si danno i corsi. */
export const insegna = (p: { ruolo: string; ancheIstruttore?: boolean }) => p.ruolo === 'istruttore' || (p.ruolo === 'staff' && !!p.ancheIstruttore)

/** Le aree di una persona: la segreteria che insegna anche ne ha due. */
export const areeDi = (p: RuoloPersonale): AreaDiAccount[] =>
  p.ruolo === 'istruttore' ? ['istruttori'] : p.ancheIstruttore ? ['segreteria', 'istruttori'] : ['segreteria']

/** Il ruolo detto per esteso, per mostrarlo. */
export const nomeDelRuolo = (p: RuoloPersonale): string => ({ istruttore: 'Istruttore', staff: 'Segreteria', entrambi: 'Segreteria e istruttore' })[ruoloScelto(p)]
