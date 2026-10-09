/**
 * Supabase dà al massimo 1000 righe per richiesta, e il resto lo tace: niente
 * errore, l'elenco è solo più corto. Le presenze di un mese ci stanno già
 * strette (1131 a ottobre 2026), e le lezioni rimaste fuori risultavano senza
 * appello. Qui si legge a pagine fino a una pagina vuota: fermarsi su una
 * pagina «corta» perderebbe di nuovo righe se il tetto del server fosse più
 * basso della pagina chiesta. La richiesta deve avere un ordine fisso
 * (`.order('id')`), se no le pagine si accavallano.
 *
 * Una pagina uguale alle prime righe già lette vuol dire che `.range()` non è
 * arrivato e il server riparte dall'inizio: senza fermarsi, si rileggerebbe
 * tutto per sempre. Si guarda la pagina intera, non la prima riga: le righe
 * lette senza id (le presenze, `sessione_id, stato`) si ripetono anche quando
 * le pagine sono giuste. Questo lancia, non torna in `error`.
 */
const PAGINA = 1000

export async function tutteLeRighe<T, E>(
  pagina: (da: number, a: number) => PromiseLike<{ data: T[] | null; error: E | null }>,
): Promise<{ data: T[]; error: E | null }> {
  const righe: T[] = []
  for (;;) {
    const { data, error } = await pagina(righe.length, righe.length + PAGINA - 1)
    if (error) return { data: righe, error }
    if (!data?.length) return { data: righe, error: null }
    if (righe.length && JSON.stringify(data) === JSON.stringify(righe.slice(0, data.length))) {
      throw new Error("L'elenco non si è letto per intero. Riprova; se succede ancora, scrivilo in SEGNALAZIONI.")
    }
    righe.push(...data)
  }
}
