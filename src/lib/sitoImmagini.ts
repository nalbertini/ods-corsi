/**
 * Le immagini delle pagine del sito (pannello SITO).
 *
 * Stanno nel contenitore pubblico «sito» di Supabase (`supabase/58-sito-immagini.sql`):
 * le pagine del sito le chiamano dall'indirizzo pubblico. Qui le regole, senza
 * browser: quali file entrano, come si chiamano, come diventano un <img> e in
 * quali pagine sono usate.
 */

export const CONTENITORE = 'sito'
/** Lo stesso limite del contenitore: oltre, lo Storage rifiuta. */
export const MASSIMO_BYTE = 1_048_576
const MASSIMO_TESTO = "L'immagine pesa più di 1 MB: prova con una più piccola"
export const TIPI_AMMESSI = ['image/jpeg', 'image/png', 'image/webp']

/** Un'immagine nel contenitore: `url` è quello che finisce nel testo delle pagine. */
export interface ImmagineSito {
  nome: string
  url: string
}

const ESTENSIONE: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }

/** Il nome nel contenitore lo decide l'app (uuid + estensione), mai chi carica: niente nomi di persone, niente sovrascritture. */
export const nomeNelContenitore = (id: string, tipo: string): string | null => (ESTENSIONE[tipo] ? `${id}.${ESTENSIONE[tipo]}` : null)

export function controllaImmagine({ type, size }: { type: string; size: number }): string | null {
  if (!TIPI_AMMESSI.includes(type)) return 'Vanno bene solo immagini JPEG, PNG o WebP'
  if (size > MASSIMO_BYTE) return MASSIMO_TESTO
  return null
}

/** Il testo alternativo serve a chi non vede l'immagine: o c'è, o si dice che è solo decorativa (e allora è vuoto di proposito). */
export const controllaAlt = (alt: string, decorativa: boolean): string | null =>
  decorativa || alt.trim() ? null : 'Scrivi cosa si vede nell\'immagine, oppure scegli «solo decorativa»'

/**
 * Il testo alternativo come entra nel testo della pagina: senza virgolette, `<` e `>`.
 * Il filtro del database (`sito_testo_sicuro`) rifiuta ogni entità negli attributi tranne `&amp;`,
 * e un'entità `&quot;` farebbe respingere il salvataggio della pagina.
 */
export const pulisciAlt = (alt: string): string => alt.replace(/["<>]/g, '').replace(/\s+/g, ' ').trim()

const sorgentiDi = (html: string) => [...html.matchAll(/<img\b[^>]*?\bsrc="([^"]*)"/gi)].map((m) => m[1].replace(/&amp;/g, '&'))

/** Gli indirizzi delle immagini di un testo, senza doppioni, nell'ordine in cui compaiono. */
export const immaginiNelTesto = (html: string): string[] => [...new Set(sorgentiDi(html))]

/** I titoli delle pagine che mostrano l'immagine, nella bozza o nel testo pubblicato. */
export const pagineCheUsano = (url: string, pagine: Array<{ titolo: string; bozza: string; pubblicato: string | null }>): string[] =>
  pagine.filter((p) => immaginiNelTesto(p.bozza).includes(url) || immaginiNelTesto(p.pubblicato ?? '').includes(url)).map((p) => p.titolo)

export const urlImmagine = (urlProgetto: string, nome: string): string => `${urlProgetto.replace(/\/+$/, '')}/storage/v1/object/public/${CONTENITORE}/${nome}`

/** Il nome di un file del contenitore è fatto come li fa l'app (uuid + estensione): il resto non è un'immagine del sito. */
export const eNomeDelContenitore = (nome: string): boolean => new RegExp(`\\.(${Object.values(ESTENSIONE).join('|')})$`).test(nome)

/** Cosa dire quando lo Storage risponde con un errore: mai il testo grezzo dell'API. */
export function cosaNonVaImmagini(messaggio: string, codice = ''): string {
  const t = `${messaggio} ${codice}`
  if (/not found|404/i.test(t)) return 'Le immagini del sito non sono ancora attive sul database: va lanciato 58-sito-immagini.sql'
  if (/row-level security|403|unauthorized/i.test(t)) return 'Solo la segreteria può caricare le immagini'
  if (/too large|413|exceeded/i.test(t)) return MASSIMO_TESTO
  return 'Non sono riuscito a leggere o salvare le immagini: controlla la connessione e riprova'
}
