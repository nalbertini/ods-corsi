/**
 * Le prove: chi viene a provare una lezione prima di iscriversi.
 *
 * Entra nell'appello di quella lezione senza esserne iscritto, già presente,
 * e lo aggiunge chi fa l'appello: l'istruttore dall'app o dal tablet col
 * PIN, la segreteria dalla lezione aperta nella settimana. Chi è già venuto
 * a provare si ritrova per nome, ed è come si fa una settimana di prova.
 * Le regole vere sono in `supabase/21-prove.sql`; qui ci sono quelle che
 * servono a dire subito cosa non va, prima di mandare.
 */

import { nomeProprio, paroleCercate, somiglia } from './nomi'

/** Chi è già venuto a provare, con l'ultima lezione provata. */
export interface GiaProvato {
  id: string
  nome: string
  cognome: string
  /** Non sul tablet: lo schermo è in sala. */
  telefono?: string
  /** Solo sul tablet: «Marco N.», il cognome intero non si mostra in sala (`sigleDeiProvati`). */
  sigla?: string
  corso: string
  inizio: string
}

/** Chi viene a provare per la prima volta. */
export interface NuovaProva {
  nome: string
  cognome: string
  telefono?: string
}

/** Chi si aggiunge: uno già venuto, per id, o uno nuovo. */
export type ChiProva = { id: string; nome: string; cognome: string } | NuovaProva

export const eGiaVenuto = (c: ChiProva): c is { id: string; nome: string; cognome: string } => 'id' in c

/** Come i controlli di `metti_prova`. */
export function cosaNonVaProva(n: NuovaProva): string | null {
  if (!n.nome.trim() || !n.cognome.trim()) return 'Servono nome e cognome.'
  if (n.nome.trim().length > 80 || n.cognome.trim().length > 80) return 'Nome o cognome troppo lungo.'
  const t = n.telefono?.trim()
  if (t && !/^\+?[0-9 ./-]{6,20}$/.test(t)) return 'Il telefono non sembra un numero.'
  return null
}

/**
 * Nome, cognome e telefono come li salva il server: scritti come tutti gli
 * altri nomi (`nomi.ts`, 20-nomi.sql), il telefono vuoto non c'è.
 */
export const pulisciProva = (n: NuovaProva): NuovaProva => ({
  nome: nomeProprio(n.nome),
  cognome: nomeProprio(n.cognome),
  telefono: n.telefono?.trim() || undefined,
})

/**
 * Chi, fra quelli già venuti, somiglia a quello che si sta scrivendo
 * (`somiglia`). Sotto le tre lettere, nessuno: un elenco già pronto mostrerebbe
 * a chi passa i nomi di chi è venuto, spesso bambini.
 */
export function somiglianti(tutti: GiaProvato[], scritto: string, quanti = 6): GiaProvato[] {
  const parole = paroleCercate(scritto)
  if (parole.join('').length < 3) return []
  return tutti.filter((p) => somiglia(p, parole)).slice(0, quanti)
}

/** Un id nuovo per una persona nuova: lo decide chi la aggiunge, così anche senza rete sa come chiamarla. */
export function nuovoId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const b = crypto.getRandomValues(new Uint8Array(16))
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

/**
 * Chi è già nell'appello, per non riproporlo fra i già venuti. Sul tablet,
 * quando la rilettura non riesce, l'elenco si nasconde ma questo resta:
 * riaggiungere chi c'è già non cambia il suo segno, e il pannello direbbe
 * «segnato presente» anche a chi è assente.
 */
export function giaNellAppello(
  prima: ReadonlySet<string>,
  cambio: { letti: string[] } | { aggiunto: string } | { tolto: string },
): Set<string> {
  if ('letti' in cambio) return new Set(cambio.letti)
  const dopo = new Set(prima)
  if ('aggiunto' in cambio) dopo.add(cambio.aggiunto)
  else dopo.delete(cambio.tolto)
  return dopo
}
