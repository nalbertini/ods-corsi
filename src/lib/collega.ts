import { giornoRoma, type RigaMovimento } from './contabilita'
import { dataRicevuta } from './ricevute'
import { spunteDi } from './ruoli'

/**
 * Il collegamento di Claude all'account (pagina `collega/`, vedi `components/Collega.tsx`): Supabase manda qui chi
 * deve dire CONSENTI, con l'autorizzazione nella query. Claude registra in CONTABILITÀ (`mcp.ts`), quindi lo
 * collega solo chi ha l'amministrazione; per gli altri il database direbbe comunque di no.
 */

/** L'autorizzazione da approvare o rifiutare: `?authorization_id=…`, come la manda Supabase. */
export const autorizzazioneDa = (query: string): string | null => new URLSearchParams(query).get('authorization_id') || null

/** Chi può collegare Claude: chi cura i conti. Il tablet di una sala non ha una persona. */
export const puoCollegare = (p: { ruolo: string; ancheIstruttore?: boolean; ancheAmministrazione?: boolean } | null): boolean =>
  !!p && spunteDi(p).includes('amministrazione')

/** La frase sotto un movimento registrato da Claude, col giorno di Roma; `null` per gli altri. */
export const fraseDallaChat = (r: Pick<RigaMovimento, 'dallaChat' | 'creatoIl'>): string | null =>
  r.dallaChat && r.creatoIl ? `Registrato dalla chat con Claude il ${dataRicevuta(giornoRoma(r.creatoIl))}.` : null

const db = () => import('./supabase').then((m) => m.clientSupabase())
const MSG_NON_RIUSCITO = 'Il collegamento non è riuscito: riprova da Claude, dall’inizio'

/** Il nome di chi chiede (di solito «Claude»), o l'indirizzo dove tornare se il consenso c'è già. */
export async function chiChiede(id: string): Promise<{ nome: string } | { torna: string }> {
  const { data, error } = await (await db()).auth.oauth.getAuthorizationDetails(id)
  if (error || !data) throw new Error(MSG_NON_RIUSCITO)
  return 'authorization_id' in data ? { nome: data.client.name || 'Claude' } : { torna: data.redirect_url }
}

/** CONSENTI o NO, GRAZIE: Supabase risponde con l'indirizzo di Claude dove tornare. */
export async function rispondi(id: string, consenti: boolean): Promise<string> {
  const c = await db()
  const { data, error } = consenti
    ? await c.auth.oauth.approveAuthorization(id, { skipBrowserRedirect: true })
    : await c.auth.oauth.denyAuthorization(id, { skipBrowserRedirect: true })
  if (error || !data) throw new Error(MSG_NON_RIUSCITO)
  return data.redirect_url
}
