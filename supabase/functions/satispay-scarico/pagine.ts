// <pagine> — da qui a </pagine> è copiato in supabase/functions/satispay-scarico/pagine.ts (lo controlla prova:satispay-scarico).
export const ERRORE_SCARICO = 'Satispay non risponde: lo scarico riprova da solo stanotte'

/** Un pagamento come lo dà `GET /g_business/v1/payments`, coi soli campi che servono. */
export interface PagamentoGrezzo {
  id: string
  type: string
  status: string
  amount_unit: number
  insert_date: string
  sender?: { name?: string }
  description?: string
}
export interface Pagina {
  data: PagamentoGrezzo[]
  has_more: boolean
}
export type EsitoScorri = { ok: true; ripresa: string | null; completa: boolean } | { ok: false; errore: string; ripresa: string | null }

/**
 * Scorre l'elenco dal più nuovo al più vecchio. Per lo storico riparte da `ripresa` (l'ultimo salvato) e va fino in
 * fondo; con `soloNuovi` parte dal più nuovo e si ferma alla prima pagina che non porta niente di nuovo.
 * Ogni pagina salvata resta anche se dopo Satispay non risponde: il salvataggio è idempotente.
 */
export async function scorriPagine(
  leggi: (startingAfter?: string) => Promise<Pagina | null>,
  salva: (pagamenti: PagamentoGrezzo[]) => Promise<number | null>,
  ripresa: string | null,
  soloNuovi = false,
): Promise<EsitoScorri> {
  let dopo = soloNuovi ? undefined : (ripresa ?? undefined)
  let segno = ripresa
  for (;;) {
    const pagina = await leggi(dopo)
    if (!pagina) return { ok: false, errore: ERRORE_SCARICO, ripresa: segno }
    const nuovi = pagina.data.length ? await salva(pagina.data) : 0
    if (nuovi === null) return { ok: false, errore: ERRORE_SCARICO, ripresa: segno }
    const ultimo = pagina.data.at(-1)?.id
    if (!soloNuovi && ultimo) segno = ultimo
    if (!pagina.has_more || !ultimo) return { ok: true, ripresa: segno, completa: true }
    if (soloNuovi && nuovi === 0) return { ok: true, ripresa: segno, completa: true }
    dopo = ultimo
  }
}
// </pagine>
