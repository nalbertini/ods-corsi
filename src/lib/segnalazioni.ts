/**
 * Le segnalazioni della segreteria: cosa non va o cosa servirebbe nell'app,
 * scritto lì dentro invece che in un documento a parte. Ognuna è un filo: chi
 * la apre scrive titolo e testo, gli altri rispondono sotto, e chi vuole la
 * chiude quando è fatta (e la riapre se serve). Col database stanno in
 * `segnalazioni` (`supabase/25-segnalazioni.sql`), in prova nell'archivio.
 *
 * Da non confondere con le presenze segnalate dagli iscritti (`segnalate.ts`).
 */

export interface Messaggio {
  id: string
  autore: string
  /** Scritto da chi sta guardando. */
  mio: boolean
  testo: string
  il: string
}

export interface Segnalazione {
  id: string
  titolo: string
  /** Il primo è quello che la apre, poi le risposte in ordine. */
  messaggi: Messaggio[]
  chiusaIl?: string
}

export const MAX_TITOLO = 120
export const MAX_TESTO = 4000

/** Perché non si può scrivere, o `null` se si può. Senza titolo è una risposta. */
export function cosaNonVaSegnalazione(testo: string, titolo?: string): string | null {
  if (titolo !== undefined) {
    if (!titolo.trim()) return 'Manca il titolo'
    if (titolo.trim().length > MAX_TITOLO) return `Il titolo è troppo lungo: al massimo ${MAX_TITOLO} caratteri`
  }
  if (!testo.trim()) return 'Manca il testo'
  if (testo.trim().length > MAX_TESTO) return `Il testo è troppo lungo: al massimo ${MAX_TESTO} caratteri`
  return null
}

/** L'ultimo messaggio di un filo. */
export const ultimo = (s: Segnalazione) => s.messaggi[s.messaggi.length - 1]

/** Aperta, e l'ultimo a scrivere è un altro: tocca a chi guarda rispondere. */
export const tocca = (s: Segnalazione) => !s.chiusaIl && !ultimo(s).mio

/** Le aperte prima, poi dalla più mossa di recente. */
export const ordinaSegnalazioni = (l: Segnalazione[]) =>
  [...l].sort((x, y) => Number(!!x.chiusaIl) - Number(!!y.chiusaIl) || ultimo(y).il.localeCompare(ultimo(x).il))
