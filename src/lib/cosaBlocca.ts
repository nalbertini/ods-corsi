import { euro } from './ricevute'
import type { PersonaSeg } from './segreteria'
import { pagamentoDi, statoCertificato } from './segreteria'

/**
 * Cosa c'è da sistemare per primo, in una frase per la segreteria: la scheda
 * de «Il Banco» la mette in cima. Nessuno resta fuori di sala: la presenza si
 * segna sempre (141), e il certificato nel termine non dice niente. `blocca`
 * resta per chi lo leggesse, sempre falso.
 * `null` quando non c'è niente da dire, o la persona non è attiva.
 */
export interface CosaBlocca {
  blocca: boolean
  titolo: string
  frase: string
  /** Il tasto della scheda che lo sistema: lo stesso che propone `tastoPrincipale`. */
  tasto: 'certificato' | 'quota'
}

/** «01/10/2026», da `AAAA-MM-GG`. */
const data = (g: string) => g.split('-').reverse().join('/')

export function cosaBlocca(p: Pick<PersonaSeg, 'attiva' | 'certificato' | 'documento' | 'pagamento' | 'quote' | 'natoIl'>, oggi: string): CosaBlocca | null {
  if (!p.attiva) return null
  const cert = statoCertificato(p, oggi)
  if (cert === 'manca') return { blocca: false, titolo: 'CERTIFICATO NON ARRIVATO', frase: 'Manca il certificato medico.', tasto: 'certificato' }
  if (cert === 'scaduto') {
    const scade = p.certificato.scade
    return { blocca: false, titolo: 'CERTIFICATO NON ARRIVATO', frase: scade ? `Il certificato è scaduto il ${data(scade)}.` : 'Il certificato è scaduto.', tasto: 'certificato' }
  }
  const quota = pagamentoDi(p, oggi)
  if (quota.come === 'pagato') return null
  const frase =
    quota.come === 'scaduto' && quota.fino
      ? `La quota è scaduta il ${data(quota.fino)}.`
      : quota.come === 'in_parte'
        ? quota.mancano !== undefined
          ? `Mancano € ${euro(quota.mancano)} della quota.`
          : 'La quota è pagata solo in parte.'
        : 'La quota non è pagata.'
  return { blocca: false, titolo: 'QUOTA DA SISTEMARE', frase, tasto: 'quota' }
}
