import { indirizzoProgetto } from './sessioni'

/*
 * Per quanto si tengono le presenze, nell'informativa privacy
 * (`informativa.html`). Li sceglie la segreteria in IMPOSTAZIONI, e la pagina
 * li chiede al database invece di tenerli scritti: così l'informativa non
 * resta indietro quando la palestra cambia idea.
 *
 * La pagina la legge anche chi non ha un accesso, e la tabella delle
 * impostazioni a lui è chiusa: il numero arriva da `mesi_presenze_pubblici()`
 * (`supabase/31-informativa-mesi.sql`), che dà quello e basta. Niente
 * supabase-js: un `fetch` con la sola chiave pubblica, che non tocca la
 * sessione di chi è entrato nell'app sullo stesso dispositivo.
 *
 * Se qualcosa non va (la funzione non ancora lanciata, la rete, una risposta
 * strana) resta il testo scritto nella pagina, che è vero sempre.
 */

/** Il testo della pagina, senza numero: lo stesso che sta in `informativa.html`. */
export const RIPIEGO_PRESENZE = 'Per il periodo stabilito dalla palestra (oggi indicato in segreteria), poi si cancellano da sole'

/** Il testo della cella delle presenze per una risposta del database: un numero di mesi valido, o il ripiego. */
export function testoPresenze(risposta: unknown): string {
  // Gli stessi limiti del vincolo su `impostazioni.mesi_presenze`.
  if (typeof risposta !== 'number' || !Number.isInteger(risposta) || risposta < 1 || risposta > 120) return RIPIEGO_PRESENZE
  return `${risposta} ${risposta === 1 ? 'mese' : 'mesi'} dalla lezione, poi si cancellano da sole`
}

/**
 * Chiede i mesi al database e dà il testo della cella. Senza indirizzo o
 * chiave (l'app compilata senza database) non chiede niente; dopo `attesa`
 * millisecondi smette di aspettare.
 */
export async function presenzeDalDatabase(
  indirizzo: string | undefined,
  chiave: string | undefined,
  chiedi: typeof fetch = fetch,
  attesa = 4000,
): Promise<string> {
  if (!indirizzo?.trim() || !chiave?.trim()) return RIPIEGO_PRESENZE
  // AbortController e non AbortSignal.timeout, che Safari 15 non ha: i telefoni vecchi vedrebbero sempre il ripiego.
  const ferma = new AbortController()
  const tempo = setTimeout(() => ferma.abort(), attesa)
  try {
    const r = await chiedi(`${indirizzoProgetto(indirizzo)}/rest/v1/rpc/mesi_presenze_pubblici`, {
      method: 'POST',
      headers: { apikey: chiave.trim(), 'Content-Type': 'application/json' },
      body: '{}',
      signal: ferma.signal,
    })
    return r.ok ? testoPresenze(await r.json()) : RIPIEGO_PRESENZE
  } catch {
    // La rete, il tempo scaduto o una risposta che non è JSON: vale il testo della pagina.
    return RIPIEGO_PRESENZE
  } finally {
    clearTimeout(tempo)
  }
}

/** Per la pagina: mette nella cella il testo col numero, se il database lo dà. */
export async function mostraPresenze(cella: HTMLElement | null): Promise<void> {
  if (!cella) return
  cella.textContent = await presenzeDalDatabase(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY)
}
