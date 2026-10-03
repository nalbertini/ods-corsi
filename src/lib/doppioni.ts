/**
 * Due schede della stessa persona: i doppioni nati quando chi faceva
 * l'appello non ritrovava chi era già venuto a provare, o da un import.
 * La segreteria le unisce dalla scheda (`29-unisci-doppioni.sql`); qui c'è
 * quello che le serve per scegliere l'altra e vedere cosa non torna.
 */

import { compatto, paroleDelNome } from './nomi'
import type { PersonaSeg } from './segreteria'

/**
 * Le altre schede, prima quelle con lo stesso cognome comunque scritto
 * (D'Amico, D’amico, Damico), poi le altre per cognome e nome.
 */
/** Lo stesso cognome, comunque scritto. */
export const stessoCognome = (a: PersonaSeg, b: PersonaSeg) => compatto(a.cognome) === compatto(b.cognome)

/** Nome e cognome scambiati: «Chiara Rossi» salvata come nome Rossi e cognome Chiara (succede dal modulo). */
export const scambiati = (a: PersonaSeg, b: PersonaSeg) => compatto(a.nome) === compatto(b.cognome) && compatto(a.cognome) === compatto(b.nome)

/** Le schede da proporre per prime in UNISCI…: lo stesso cognome, o nome e cognome scambiati. */
export const vicina = (a: PersonaSeg, b: PersonaSeg) => stessoCognome(a, b) || scambiati(a, b)

export function possibiliDoppioni(persona: PersonaSeg, tutte: PersonaSeg[]): PersonaSeg[] {
  const stesso = (p: PersonaSeg) => (vicina(p, persona) ? 0 : 1)
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
 * modulo accolto), e le coppie segnate «non sono doppioni» (33-non-doppioni.sql).
 */
export interface IndiziDoppioni {
  codiciFiscali: Record<string, string>
  nascite: Record<string, string>
  nonDoppioni: [string, string][]
}

const cfPiano = (cf?: string) => cf?.replace(/\s+/g, '').toUpperCase() || undefined

/** Perché due schede sembrano la stessa persona, dal più sicuro. */
export type MotivoDoppione = 'codice fiscale' | 'nome' | 'scambiati' | 'secondo nome'

export const MOTIVI: Record<MotivoDoppione, string> = {
  'codice fiscale': 'stesso codice fiscale',
  nome: 'stesso nome',
  scambiati: 'nome e cognome scambiati',
  'secondo nome': 'un secondo nome',
}
const ORDINE: MotivoDoppione[] = ['codice fiscale', 'nome', 'scambiati', 'secondo nome']

/** Quello che serve per confrontare una scheda, calcolato una volta: gira a ogni tasto della ricerca in ISCRITTI. */
interface Confronto {
  p: PersonaSeg
  nome: string
  cognome: string
  parole: string[]
  cf?: string
  nato?: string
}
const confronto = (p: PersonaSeg, i: IndiziDoppioni): Confronto => ({
  p,
  nome: compatto(p.nome),
  cognome: compatto(p.cognome),
  parole: paroleDelNome(p.nome),
  cf: cfPiano(i.codiciFiscali[p.id]),
  nato: i.nascite[p.id],
})

/**
 * Un nome in più, stesso cognome: «Chiara» e «Maria Chiara», «Chiara» e
 * «Chiara M.». Uno solo in più, e il più corto non è solo un'iniziale («A.»
 * e «Anna» no): se no l'elenco si riempie di persone diverse.
 */
function secondoNome(a: string[], b: string[]): boolean {
  const [corto, lungo] = a.length < b.length ? [a, b] : [b, a]
  return lungo.length === corto.length + 1 && corto.some((w) => w.length > 1) && corto.every((w) => lungo.includes(w))
}

function motivo(a: Confronto, b: Confronto, no: Set<string>): MotivoDoppione | null {
  if (a.cf && b.cf && a.cf !== b.cf) return null
  if (a.nato && b.nato && a.nato !== b.nato) return null
  if (no.has([a.p.id, b.p.id].sort().join())) return null
  if (a.cf && a.cf === b.cf) return 'codice fiscale'
  if (a.cognome === b.cognome && a.nome === b.nome) return 'nome'
  // Come `scambiati`, ma sui nomi già compattati: gira per ogni coppia.
  if (a.nome === b.cognome && a.cognome === b.nome) return 'scambiati'
  if (a.cognome === b.cognome && secondoNome(a.parole, b.parole)) return 'secondo nome'
  return null
}

const nonDoppioni = (i: IndiziDoppioni) => new Set(i.nonDoppioni.map(([a, b]) => [a, b].sort().join()))

/**
 * Perché due schede sono possibili doppioni, o `null`: stesso codice fiscale,
 * stesso nome comunque scritto, nome e cognome scambiati, un secondo nome. Non
 * lo sono due schede con due codici fiscali o due nascite diverse (sono due
 * persone), né una coppia segnata «non sono doppioni». Il telefono non conta:
 * è spesso quello del genitore, uguale per i fratelli.
 */
export function motivoDoppione(a: PersonaSeg, b: PersonaSeg, i: IndiziDoppioni): MotivoDoppione | null {
  return motivo(confronto(a, i), confronto(b, i), nonDoppioni(i))
}

/** I possibili doppioni da unire, ogni coppia una volta: prima i più sicuri, poi per cognome e nome. */
export function coppieDoppioni(tutte: PersonaSeg[], i: IndiziDoppioni): [PersonaSeg, PersonaSeg][] {
  const no = nonDoppioni(i)
  const schede = [...tutte].sort((a, b) => `${a.cognome} ${a.nome}`.localeCompare(`${b.cognome} ${b.nome}`, 'it')).map((p) => confronto(p, i))
  const coppie: { c: [PersonaSeg, PersonaSeg]; m: MotivoDoppione }[] = []
  for (let k = 0; k < schede.length; k++) {
    for (let j = k + 1; j < schede.length; j++) {
      const m = motivo(schede[k], schede[j], no)
      if (m) coppie.push({ c: [schede[k].p, schede[j].p], m })
    }
  }
  // `sort` tiene l'ordine di prima a parità di motivo: per cognome e nome.
  return coppie.sort((x, y) => ORDINE.indexOf(x.m) - ORDINE.indexOf(y.m)).map((x) => x.c)
}

/** L'altra scheda, se `id` è in una coppia sola: UNISCI la trova già scelta. */
export function altraDellaCoppia(coppie: [PersonaSeg, PersonaSeg][], id: string): string | undefined {
  const sue = coppie.filter((c) => c.some((x) => x.id === id))
  return sue.length === 1 ? sue[0].find((x) => x.id !== id)?.id : undefined
}

/** Le altre schede segnate «non sono doppioni» con `id`, per cognome e nome: la scheda le mostra, per toglierle. */
export function segnateCon(i: IndiziDoppioni, id: string, tutte: PersonaSeg[]): PersonaSeg[] {
  const altre = new Set(i.nonDoppioni.filter((c) => c.includes(id)).map(([a, b]) => (a === id ? b : a)))
  return tutte.filter((p) => altre.has(p.id)).sort((a, b) => `${a.cognome} ${a.nome}`.localeCompare(`${b.cognome} ${b.nome}`, 'it'))
}
