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

/** Il titolo oltre il massimo, detto com'è, o `null`: il modulo lo conta mentre si scrive. */
export const titoloTroppoLungo = (titolo: string) =>
  titolo.trim().length > MAX_TITOLO ? `Il titolo è troppo lungo: al massimo ${MAX_TITOLO} caratteri` : null

/** Il testo oltre il massimo, o `null`: si dice invece di tagliarlo mentre si incolla. */
export const testoTroppoLungo = (testo: string) =>
  testo.trim().length > MAX_TESTO ? `Il testo è troppo lungo: al massimo ${MAX_TESTO} caratteri` : null

/** Perché non si può scrivere, o `null` se si può. Senza titolo è una risposta. */
export function cosaNonVaSegnalazione(testo: string, titolo?: string): string | null {
  if (titolo !== undefined) {
    if (!titolo.trim()) return 'Manca il titolo'
    const lungo = titoloTroppoLungo(titolo)
    if (lungo) return lungo
  }
  if (!testo.trim()) return 'Manca il testo'
  return testoTroppoLungo(testo)
}

/** L'ultimo messaggio di un filo. */
export const ultimo = (s: Segnalazione) => s.messaggi[s.messaggi.length - 1]

/** Aperta, e l'ultimo a scrivere è un altro: tocca a chi guarda rispondere. */
export const tocca = (s: Segnalazione) => !s.chiusaIl && !ultimo(s).mio

/** Prima quelle che aspettano una tua risposta, poi le altre aperte, poi le chiuse; in ognuna dalla più mossa di recente. */
const gruppo = (s: Segnalazione) => (tocca(s) ? 0 : s.chiusaIl ? 2 : 1)
export const ordinaSegnalazioni = (l: Segnalazione[]) =>
  [...l].sort((x, y) => gruppo(x) - gruppo(y) || ultimo(y).il.localeCompare(ultimo(x).il))

/**
 * Il tasto che chiude dice prima di toccarlo se manda anche la risposta
 * scritta: un messaggio mandato non si cambia più.
 */
export const etichettaChiudi = (bozza: string) => (bozza.trim() ? 'MANDA E CHIUDI' : 'È FATTA, CHIUDILA')

/**
 * Chiude un filo senza buttare la risposta scritta: se c'è, la manda prima.
 * Se l'invio non va il filo resta aperto (e la bozza nel campo). Se la
 * risposta parte ma la chiusura no, non è un errore da ripetere per intero:
 * lo dice `chiusa: false`, così non si manda la stessa risposta due volte.
 */
export async function chiudiConRisposta(
  d: { rispondiSegnalazione(id: string, testo: string): Promise<unknown>; chiudiSegnalazione(id: string, chiusa: boolean): Promise<unknown> },
  id: string,
  bozza: string,
): Promise<{ mandata: boolean; chiusa: boolean }> {
  const mandata = !!bozza.trim()
  if (mandata) await d.rispondiSegnalazione(id, bozza)
  try {
    await d.chiudiSegnalazione(id, true)
  } catch (e) {
    if (!mandata) throw e
    return { mandata, chiusa: false }
  }
  return { mandata, chiusa: true }
}
