// I metodi di pagamento che la segreteria accende e spegne da REGOLE → COME SI
// PAGA. Si salvano gli spenti, non gli accesi: un metodo nuovo nasce acceso e
// un database che non ha ancora la colonna (126-metodi-pagamento.sql) li ha
// tutti accesi, come prima. La logica sta qui; il .tsx mostra e chiama.

export const METODI_PAGAMENTO = [
  { id: 'satispay', nome: 'Satispay', riga: 'Chi si iscrive o paga la quota, il saldo e i corsi dall’app.' },
  { id: 'carta', nome: 'Carta', riga: 'Chi si iscrive dal modulo, con la carta.' },
  { id: 'bonifico', nome: 'Bonifico', riga: 'L’IBAN e la causale nel modulo; in segreteria nelle ricevute e nei pagamenti.' },
  { id: 'contanti', nome: 'Contanti', riga: 'In segreteria, nelle ricevute e nei pagamenti.' },
  { id: 'pos', nome: 'POS', riga: 'In segreteria, nelle ricevute e nei pagamenti.' },
  { id: 'assegno', nome: 'Assegno', riga: 'In segreteria, nelle ricevute e nei pagamenti.' },
] as const

export type IdMetodo = (typeof METODI_PAGAMENTO)[number]['id']

const ID: readonly string[] = METODI_PAGAMENTO.map((x) => x.id)

/** Gli spenti letti dal database: solo id veri, una volta ciascuno. */
export const spentiDa = (x: unknown): IdMetodo[] =>
  // `as`: `ID` contiene solo id di `METODI_PAGAMENTO`, controllati qui.
  Array.isArray(x) ? ([...new Set(x.filter((y): y is string => typeof y === 'string' && ID.includes(y)))] as IdMetodo[]) : []

/** Per nome come lo scrivono le ricevute («POS», «Satispay»). Un nome fuori elenco (storico, import) non si spegne. */
export const acceso = (spenti: readonly string[], nome: string): boolean => !spenti.includes(nome.trim().toLowerCase())

/** L'ultimo metodo acceso non si spegne: senza, la segreteria non potrebbe registrare nessun pagamento. */
export const cambiaSpento = (spenti: readonly IdMetodo[], id: IdMetodo, accendi: boolean): IdMetodo[] =>
  accendi
    ? spenti.filter((x) => x !== id)
    : spenti.includes(id) || METODI_PAGAMENTO.every((x) => x.id === id || spenti.includes(x.id))
      ? [...spenti]
      : [...spenti, id]

/** Le scelte senza i metodi spenti; `tieni` è quello già scritto su un pagamento, che si vede lo stesso. */
export const accesi = <T extends string>(elenco: readonly T[], spenti: readonly string[], tieni?: string): T[] =>
  elenco.filter((m) => acceso(spenti, m) || m === tieni?.trim())
