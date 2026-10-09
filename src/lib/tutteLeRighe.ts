/**
 * Supabase dà al massimo 1000 righe per richiesta, e il resto lo tace: niente
 * errore, l'elenco è solo più corto. Le presenze di un mese ci stanno già
 * strette (1131 a ottobre 2026), e le lezioni rimaste fuori risultavano senza
 * appello. Qui si legge a pagine fino a una pagina vuota: fermarsi su una
 * pagina «corta» perderebbe di nuovo righe se il tetto del server fosse più
 * basso della pagina chiesta. La richiesta deve avere un ordine fisso
 * (`.order('id')`), se no le pagine si accavallano.
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
    righe.push(...data)
  }
}
