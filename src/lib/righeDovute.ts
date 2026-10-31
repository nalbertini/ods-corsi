import { statoCorsi, type ComeCorso, type StatoCorso } from './corsiDaPagare'
import type { CorsoRef, Listino } from './listino'
import { pagamentoDi, type ComePaga, type PersonaSeg, type StatoPaga } from './segreteria'

/**
 * Cosa deve una persona, riga per riga: la quota associativa e ogni corso a
 * pagamento in corso. Deve diventare il solo punto da cui ISCRITTI, DA FARE e
 * COSA MANCA leggono lo stato dei pagamenti, così contano le stesse cose. Per
 * ora mette insieme `pagamentoDi` e `statoCorsi` com'erano: i numeri non cambiano.
 */
export interface RigaDovuta {
  cosa: { tipo: 'quota' } | { tipo: 'corso'; id: string }
  stato: ComePaga | ComeCorso
  /** Centesimi. */
  manca?: number
  /** Fin quando vale; per una riga scaduta, fin quando valeva. */
  fino?: string
  fonte?: StatoPaga['fonte']
  formula?: StatoCorso['formula']
  entro?: string
  oltre?: boolean
}

export interface RigheDovute {
  righe: RigaDovuta[]
  /** false se le ricevute non si sono lette: dei corsi non si sa niente, e non si contano. */
  corsiLetti: boolean
}

const FONTE_CORSO: Partial<Record<ComeCorso, RigaDovuta['fonte']>> = { pagato: 'ricevuta', in_parte: 'ricevuta', fuori_app: 'fuori_app', satispay: 'satispay' }

const rigaQuota = (s: StatoPaga): RigaDovuta => ({ cosa: { tipo: 'quota' }, stato: s.come, manca: s.mancano, fino: s.fino, fonte: s.fonte })

const rigaCorso = (s: StatoCorso): RigaDovuta => ({
  cosa: { tipo: 'corso', id: s.corsoId },
  stato: s.come,
  manca: s.mancano,
  fino: s.al,
  fonte: FONTE_CORSO[s.come],
  formula: s.formula,
  entro: s.entro,
  oltre: s.oltre,
})

export function righeDovute(p: PersonaSeg, corsi: CorsoRef[], listino: Listino, oggi: string): RigheDovute {
  const stati = statoCorsi(p, corsi, listino, oggi)
  // Il genitore che non si iscrive è in anagrafica solo per pagare per il figlio: quota e corsi sono del figlio.
  if (!p.attiva || p.genitoreNonIscritto) return { righe: [], corsiLetti: !!stati }
  return { righe: [rigaQuota(pagamentoDi(p, oggi)), ...(stati ?? []).map(rigaCorso)], corsiLetti: !!stati }
}
