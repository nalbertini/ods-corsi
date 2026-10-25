/**
 * Lo stato di un ordine come lo dice la carta: pagato solo con la cattura
 * completata, anche se arriva tardi (i soldi ci sono). Quello che non si
 * conosce è in attesa, e dopo 30 minuti non è andato: si riprova.
 *
 * Sta qui perché la usa la Edge Function `paypal`, che non vede `src/lib`;
 * l'app la riesporta da `src/lib/satispay.ts`, dove la provano.
 */
export function statoCarta(ordine: { status: string; cattura?: string }, creatoIl: string, ora: Date): 'attesa' | 'pagato' | 'non-andato' {
  if (ordine.cattura === 'COMPLETED') return 'pagato'
  if (ordine.cattura === 'DECLINED' || ordine.cattura === 'FAILED' || ordine.status === 'VOIDED') return 'non-andato'
  return ora.getTime() - new Date(creatoIl).getTime() > 30 * 60_000 ? 'non-andato' : 'attesa'
}

/** Chi paga ha confermato: si cattura solo entro i 30 minuti, se no si incasserebbe un pagamento già dato per non andato. */
export const siCattura = (creatoIl: string, ora: Date) => statoCarta({ status: 'APPROVED' }, creatoIl, ora) !== 'non-andato'

/**
 * Lo stato dopo aver chiesto la cattura. Con la risposta conta quella. Senza
 * (PayPal non ha risposto, o ha detto di no col 422) conta l'ordine riletto:
 * un no su un ordine non catturato è la carta rifiutata, e si paga con un
 * ordine nuovo; un no perché già catturato (la prima risposta persa) è pagato.
 * `null`: non si sa, niente si scrive e chi paga riprova.
 */
export function statoDopoCattura(
  risposta: { status: string; cattura?: string } | 'rifiuto' | null,
  riletto: { status: string; cattura?: string } | null,
  creatoIl: string,
  ora: Date,
): 'attesa' | 'pagato' | 'non-andato' | null {
  if (risposta && risposta !== 'rifiuto') return statoCarta(risposta, creatoIl, ora)
  if (!riletto) return null
  const stato = statoCarta(riletto, creatoIl, ora)
  return risposta === 'rifiuto' && stato === 'attesa' ? 'non-andato' : stato
}
