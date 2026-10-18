import type { Ricevuta } from './ricevute'
import type { PersonaSeg } from './segreteria'
import { pagamentoDi } from './segreteria'

/** Una riga di DA PAGARE: chi, in che stato è la quota, da quanti giorni aspetta. */
export interface RigaDaPagare {
  persona: PersonaSeg
  come: 'da_pagare' | 'in_parte' | 'scaduto'
  /** `null` quando non si sa da quando: sta in fondo. */
  giorni: number | null
  /** Centesimi che mancano, per una quota pagata in parte da una ricevuta. */
  mancano?: number
}

const giorno = (g: string) => Date.UTC(+g.slice(0, 4), +g.slice(5, 7) - 1, +g.slice(8, 10))
const giorniFra = (da: string, a: string) => Math.round((giorno(a) - giorno(da)) / 86_400_000)

/**
 * Chi ha la quota non in regola, prima chi aspetta da più giorni. I giorni
 * contano da quando la quota è scaduta; per chi non l'ha mai pagata, da
 * quando è iscritto al primo corso.
 */
export function daPagareElenco(persone: PersonaSeg[], oggi: string): RigaDaPagare[] {
  const righe: RigaDaPagare[] = []
  for (const persona of persone) {
    if (!persona.attiva) continue
    const s = pagamentoDi(persona, oggi)
    if (s.come === 'pagato') continue
    let giorni: number | null = null
    if (s.come === 'scaduto' && s.fino) giorni = giorniFra(s.fino, oggi)
    if (s.come === 'da_pagare') {
      const dal = persona.iscrizioni.map((x) => x.dal).sort()[0]
      // Un'iscrizione che parte più avanti non ha ancora fatto aspettare nessuno: niente giorni.
      const fatti = dal ? giorniFra(dal, oggi) : null
      giorni = fatti !== null && fatti >= 0 ? fatti : null
    }
    righe.push({ persona, come: s.come, giorni, ...(s.fonte === 'ricevuta' ? { mancano: s.mancano } : {}) })
  }
  return righe.sort((a, b) => (b.giorni ?? -1) - (a.giorni ?? -1) || `${a.persona.cognome} ${a.persona.nome}`.localeCompare(`${b.persona.cognome} ${b.persona.nome}`, 'it'))
}

/** Dalla più recente: anno e numero, dal più alto. Le annullate restano, hanno il loro numero. */
export const ricevuteElenco = (ricevute: Ricevuta[]): Ricevuta[] => [...ricevute].sort((a, b) => b.anno - a.anno || b.numero - a.numero)
