// Le regole della finestra dei dettagli (`SchedaPiena`) che si provano senza
// browser: `prova:scheda-finestra`.

/**
 * La scheda dopo (`verso` 1) o prima (-1) di quella aperta, nell'ordine in cui
 * l'elenco la mostra. Ai capi non gira in tondo, e una scheda che nell'elenco
 * non c'è (filtrata, sparita dopo un ricarico) non ha vicine.
 */
export function vicina(ids: readonly string[], id: string | null, verso: 1 | -1): string | null {
  const i = id === null ? -1 : ids.indexOf(id)
  return i < 0 ? null : (ids[i + verso] ?? null)
}

/** «2 DI 14», o niente se la scheda aperta non è nell'elenco. */
export function posizione(ids: readonly string[], id: string | null): string | null {
  const i = id === null ? -1 : ids.indexOf(id)
  return i < 0 ? null : `${i + 1} DI ${ids.length}`
}

/**
 * Il clic sul velo chiude solo se non c'è niente da perdere: con modifiche non
 * salvate un clic per sbaglio non deve buttarle, e si esce da ✕ o Esc, che
 * chiedono prima.
 */
export const clicFuoriChiude = (bozzaAperta: boolean): boolean => !bozzaAperta
