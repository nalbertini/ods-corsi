import { siCattura, statoDopoCattura } from './stato.ts'

type Esito = { status: string; cattura?: string }

/** Quel che serve a catturare: PayPal e il database, passati da fuori perché la prova li finge. */
export type Dipendenze = {
  /** La POST di cattura: l'esito, `'rifiuto'` (422), `null` se PayPal non risponde. */
  cattura: (ordine: string, idempotenza: string) => Promise<Esito | 'rifiuto' | null>
  rileggi: (ordine: string) => Promise<Esito | null>
  scrivi: (ordine: string, stato: string) => Promise<Record<string, unknown> | null>
}

/**
 * Incassa un pagamento ancora in attesa. `errore`: non si sa com'è andata, chi paga riprova;
 * `nuovo`: lo stato scritto nel database (`null` se non si è scritto).
 */
export async function catturaOrdine(s: { creato_il: string }, ordine: string, pagamento: string, ora: Date, dip: Dipendenze) {
  // Oltre i 30 minuti l'ordine non vale più (`statoCarta`): lo si scrive e non si cattura, se no si incasserebbe
  // un pagamento che il modulo ha già dato per non andato.
  if (!siCattura(s.creato_il, ora)) return { errore: false, nuovo: await dip.scrivi(ordine, 'non-andato') }
  const esito = await dip.cattura(ordine, `cattura-${pagamento}`)
  // Senza risposta, o con un no (la carta rifiutata, o già catturato e la prima risposta persa), decide l'ordine riletto.
  const riletto = esito && esito !== 'rifiuto' ? null : await dip.rileggi(ordine)
  const stato = statoDopoCattura(esito, riletto, s.creato_il, ora)
  const nuovo = stato && (await dip.scrivi(ordine, stato))
  return nuovo ? { errore: false, nuovo } : { errore: true, nuovo: null }
}
