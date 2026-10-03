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

/**
 * Quello che serve per dire se due schede sono la stessa persona e che
 * `PersonaSeg` non ha: codice fiscale e nascita (dalla segreteria, se no dal
 * modulo accolto), e le coppie segnate «non sono doppioni» (30-non-doppioni.sql).
 */
export interface IndiziDoppioni {
  codiciFiscali: Record<string, string>
  nascite: Record<string, string>
  nonDoppioni: [string, string][]
}

const cfPiano = (cf?: string) => cf?.replace(/\s+/g, '').toUpperCase() || undefined

/**
 * I possibili doppioni da unire: lo stesso nome e cognome comunque scritti, o
 * lo stesso codice fiscale. Non lo sono due schede con due codici fiscali o
 * due nascite diverse (sono due persone), né una coppia segnata «non sono
 * doppioni». Il telefono non conta: è spesso quello del genitore, uguale per
 * i fratelli. Ogni coppia una volta, per cognome e nome.
 */
export function coppieDoppioni(tutte: PersonaSeg[], i: IndiziDoppioni): [PersonaSeg, PersonaSeg][] {
  const no = new Set(i.nonDoppioni.map(([a, b]) => [a, b].sort().join()))
  // Una volta per persona: gira a ogni tasto della ricerca in ISCRITTI.
  const schede = [...tutte]
    .sort((a, b) => `${a.cognome} ${a.nome}`.localeCompare(`${b.cognome} ${b.nome}`, 'it'))
    .map((p) => ({ p, nome: `${compatto(p.cognome)} ${compatto(p.nome)}`, cf: cfPiano(i.codiciFiscali[p.id]), nato: i.nascite[p.id] }))
  const coppie: [PersonaSeg, PersonaSeg][] = []
  schede.forEach((a, k) => {
    for (const b of schede.slice(k + 1)) {
      if (a.cf && b.cf && a.cf !== b.cf) continue
      if (a.nato && b.nato && a.nato !== b.nato) continue
      if (no.has([a.p.id, b.p.id].sort().join())) continue
      if (a.nome === b.nome || (a.cf && a.cf === b.cf)) coppie.push([a.p, b.p])
    }
  })
  return coppie
}

/** L'altra scheda, se `id` è in una coppia sola: UNISCI la trova già scelta. */
export function altraDellaCoppia(coppie: [PersonaSeg, PersonaSeg][], id: string): string | undefined {
  const sue = coppie.filter((c) => c.some((x) => x.id === id))
  return sue.length === 1 ? sue[0].find((x) => x.id !== id)?.id : undefined
}
