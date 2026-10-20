import { giornoRoma, type RigaMovimento } from './contabilita'
import { dataRicevuta } from './ricevute'
import { spunteDi } from './ruoli'
import { CHAT_SEGRETERIA_ACCESA } from './chatSegreteria'

/**
 * Il collegamento di Claude all'account (pagina `collega/`, vedi `components/Collega.tsx`): Supabase manda qui chi
 * deve dire CONSENTI, con l'autorizzazione nella query. Claude registra in CONTABILITÀ e, quando è accesa, risponde
 * alla segreteria sugli iscritti (`mcp.ts`): lo collega chi ha uno dei due ruoli; per gli altri il database direbbe
 * comunque di no.
 */

/** L'autorizzazione da approvare o rifiutare: `?authorization_id=…`, come la manda Supabase. */
export const autorizzazioneDa = (query: string): string | null => new URLSearchParams(query).get('authorization_id') || null

type ChiCollega = { ruolo: string; ancheIstruttore?: boolean; ancheAmministrazione?: boolean }

/** Chi può collegare Claude: chi cura i conti, e la segreteria quando è accesa. Il tablet di una sala non ha una persona. */
export const puoCollegare = (p: ChiCollega | null, accesa = CHAT_SEGRETERIA_ACCESA): boolean =>
  !!p && (spunteDi(p).includes('amministrazione') || (accesa && spunteDi(p).includes('segreteria')))

const ISCRITTI_SI = ['Leggere nome e cognome degli iscritti adulti, con corso, certificato, quota e presenze', 'Contare i minori, senza sapere chi sono']
const CONTI_SI = ['Leggere voci, totali, il saldo del Conto Corrente e le spese da classificare', 'Registrare un’uscita o un’entrata, solo dopo il tuo «ok» in chat']
const NOMI_NO = ['Vedere i nomi dei minori e di chi è venuto a provare', 'Vedere telefono, email, codice fiscale, indirizzo, certificati e documenti']

/** Le righe POTRÀ e NON POTRÀ del consenso, secondo cosa Claude farà con questo account. */
export function cosaPotra(p: ChiCollega, accesa = CHAT_SEGRETERIA_ACCESA): { potra: string[]; nonPotra: string[] } {
  const conti = spunteDi(p).includes('amministrazione')
  const iscritti = accesa && spunteDi(p).includes('segreteria')
  if (iscritti && conti)
    return {
      potra: [...ISCRITTI_SI, ...CONTI_SI],
      nonPotra: [...NOMI_NO, 'Vedere il saldo della Cassa Contanti', 'Cambiare iscrizioni, appelli, pagamenti; annullare movimenti, chiudere la cassa'],
    }
  if (iscritti) return { potra: ISCRITTI_SI, nonPotra: [...NOMI_NO, 'Cambiare niente: iscrizioni, appelli, pagamenti'] }
  return { potra: CONTI_SI, nonPotra: ['Vedere i nomi degli iscritti e il saldo della Cassa Contanti', 'Annullare movimenti, fare giroconti, chiudere la cassa', 'Cambiare voci e casse'] }
}

/** Le frasi del consenso attorno alle righe: per cosa Claude chiede l'account, e la nota in fondo. */
export function frasiConsenso(p: ChiCollega, chiede: string, accesa = CHAT_SEGRETERIA_ACCESA): { perche: string; nota: string } {
  const conti = spunteDi(p).includes('amministrazione')
  const iscritti = accesa && spunteDi(p).includes('segreteria')
  const togli = `Il collegamento si toglie da ${chiede}, in Impostazioni → Connettori.`
  if (iscritti && conti)
    return {
      perche: 'per rispondere sugli iscritti e per registrare in CONTABILITÀ le fatture che gli fotografi.',
      nota: `Le foto le vede ${chiede}, non ODS: solo documenti di fornitori. ${togli}`,
    }
  if (iscritti)
    return { perche: 'per rispondere alle tue domande sugli iscritti: certificati, quote, presenze.', nota: `Chi non ha la data di nascita conta come un minore. ${togli}` }
  return {
    perche: 'per registrare in CONTABILITÀ le fatture e gli scontrini che gli fotografi.',
    nota: `Le foto le vede ${chiede}, non ODS: solo documenti di fornitori, niente compensi né ricevute di iscritti. ${togli}`,
  }
}

/** La frase sotto un movimento registrato da Claude, col giorno di Roma; `null` per gli altri. */
export const fraseDallaChat = (r: Pick<RigaMovimento, 'dallaChat' | 'creatoIl'>): string | null =>
  r.dallaChat && r.creatoIl ? `Registrato dalla chat con Claude il ${dataRicevuta(giornoRoma(r.creatoIl))}.` : null

const db = () => import('./supabase').then((m) => m.clientSupabase())
const MSG_NON_RIUSCITO = 'Il collegamento non è riuscito: riprova da Claude, dall’inizio'

/** Il nome di chi chiede (di solito «Claude»), o l'indirizzo dove tornare se il consenso c'è già. */
export async function chiChiede(id: string): Promise<{ nome: string } | { torna: string }> {
  // Anche il client che non si carica (rete, versione nuova) è «non riuscito»: mai il testo del browser.
  const { data, error } = await db().then((c) => c.auth.oauth.getAuthorizationDetails(id)).catch(() => ({ data: null, error: true }))
  if (error || !data) throw new Error(MSG_NON_RIUSCITO)
  return 'authorization_id' in data ? { nome: data.client.name || 'Claude' } : { torna: data.redirect_url }
}

/** CONSENTI o NO, GRAZIE: Supabase risponde con l'indirizzo di Claude dove tornare. */
export async function rispondi(id: string, consenti: boolean): Promise<string> {
  const { data, error } = await db()
    .then((c) => (consenti ? c.auth.oauth.approveAuthorization(id, { skipBrowserRedirect: true }) : c.auth.oauth.denyAuthorization(id, { skipBrowserRedirect: true })))
    .catch(() => ({ data: null, error: true }))
  if (error || !data) throw new Error(MSG_NON_RIUSCITO)
  return data.redirect_url
}
