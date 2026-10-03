/**
 * Due schede della stessa persona: i doppioni nati quando chi faceva
 * l'appello non ritrovava chi era già venuto a provare, o da un import.
 * La segreteria le unisce dalla scheda (`29-unisci-doppioni.sql`); qui c'è
 * quello che le serve per scegliere l'altra e vedere cosa non torna.
 */

import { compatto } from './nomi'
import type { PersonaSeg } from './segreteria'

/**
 * Le altre schede, prima quelle con lo stesso cognome comunque scritto
 * (D'Amico, D’amico, Damico), poi le altre per cognome e nome.
 */
/** Lo stesso cognome, comunque scritto. */
export const stessoCognome = (a: PersonaSeg, b: PersonaSeg) => compatto(a.cognome) === compatto(b.cognome)

export function possibiliDoppioni(persona: PersonaSeg, tutte: PersonaSeg[]): PersonaSeg[] {
  const stesso = (p: PersonaSeg) => (stessoCognome(p, persona) ? 0 : 1)
  return tutte
    .filter((p) => p.id !== persona.id)
    .sort((a, b) => stesso(a) - stesso(b) || `${a.cognome} ${a.nome}`.localeCompare(`${b.cognome} ${b.nome}`, 'it'))
}

const CAMPI = [
  ['nome', 'Nome'],
  ['cognome', 'Cognome'],
  ['email', 'Email'],
  ['telefono', 'Telefono'],
] as const

/** I campi che le due schede scrivono in modo diverso; `''` dove uno manca. */
export function campiDiversi(resta: PersonaSeg, via: PersonaSeg): { campo: string; resta: string; via: string }[] {
  return CAMPI.map(([k, campo]) => ({ campo, resta: resta[k] ?? '', via: via[k] ?? '' })).filter((c) => c.resta !== c.via)
}
