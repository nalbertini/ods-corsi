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

/** Il testo alternativo di una foto già nel testo: «solo decorativa» è vuoto di proposito, il resto si ripulisce come alla scelta. */
export const altDellaFoto = (alt: string, decorativa: boolean): string => (decorativa ? '' : pulisciAlt(alt))

const sorgentiDi = (html: string) => [...html.matchAll(/<img\b[^>]*?\bsrc="([^"]*)"/gi)].map((m) => m[1].replace(/&amp;/g, '&'))

/** Gli indirizzi delle immagini di un testo, senza doppioni, nell'ordine in cui compaiono. */
export const immaginiNelTesto = (html: string): string[] => [...new Set(sorgentiDi(html))]

/** I titoli delle pagine che mostrano l'immagine, nella bozza o nel testo pubblicato. */
export const pagineCheUsano = (url: string, pagine: Array<{ titolo: string; bozza: string; pubblicato: string | null }>): string[] =>
  pagine.filter((p) => immaginiNelTesto(p.bozza).includes(url) || immaginiNelTesto(p.pubblicato ?? '').includes(url)).map((p) => p.titolo)

export const urlImmagine = (urlProgetto: string, nome: string): string => `${urlProgetto.replace(/\/+$/, '')}/storage/v1/object/public/${CONTENITORE}/${nome}`

/** Il nome di un file del contenitore è fatto come li fa l'app (uuid + estensione): il resto non è un'immagine del sito. */
export const eNomeDelContenitore = (nome: string): boolean => new RegExp(`\\.(${Object.values(ESTENSIONE).join('|')})$`).test(nome)

/** Secondi: il nome è un uuid nuovo a ogni caricamento e non si sovrascrive mai, così la cache può durare un anno. */
export const CACHE_IMMAGINI = '31536000'
/**
 * Larghezza e altezza dall'intestazione di un JPEG, PNG o WebP, senza aprire l'immagine: servono a width/height
 * (niente salti della pagina). Un file d'altro tipo o tagliato dà null.
 */
export function dimensioniImmagine(b: Uint8Array): { larghezza: number; altezza: number } | null {
  const u16 = (i: number) => (b[i] << 8) | b[i + 1]
  const l16 = (i: number) => b[i] | (b[i + 1] << 8)
  const l24 = (i: number) => b[i] | (b[i + 1] << 8) | (b[i + 2] << 16)
  const testo = (i: number, t: string) => [...t].every((c, k) => b[i + k] === c.charCodeAt(0))
  const misure = (larghezza: number, altezza: number) => (larghezza > 0 && altezza > 0 ? { larghezza, altezza } : null)
  if (b.length >= 24 && b[0] === 0x89 && testo(1, 'PNG') && testo(12, 'IHDR')) return misure(((b[16] << 24) | (b[17] << 16) | u16(18)) >>> 0, ((b[20] << 24) | (b[21] << 16) | u16(22)) >>> 0)
  if (b.length >= 16 && testo(0, 'RIFF') && testo(8, 'WEBP')) {
    if (testo(12, 'VP8 ') && b.length >= 30) return misure(l16(26) & 0x3fff, l16(28) & 0x3fff)
    if (testo(12, 'VP8L') && b.length >= 25 && b[20] === 0x2f) return misure(1 + (l16(21) & 0x3fff), 1 + (((b[22] >> 6) | (b[23] << 2) | ((b[24] & 0x0f) << 10)) & 0x3fff))
    if (testo(12, 'VP8X') && b.length >= 30) return misure(1 + l24(24), 1 + l24(27))
    return null
  }
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null
  // I segmenti del JPEG uno dopo l'altro (APP, EXIF, tabelle) fino al primo SOF0/1/2, che porta altezza e larghezza.
  let girata = false
  for (let i = 2; i + 9 <= b.length; ) {
    if (b[i] !== 0xff) return null
    const m = b[i + 1]
    // Un FF di riempimento prima del marcatore vero.
    if (m === 0xff) {
      i++
      continue
    }
    if (m === 0xc0 || m === 0xc1 || m === 0xc2) return girata ? misure(u16(i + 5), u16(i + 7)) : misure(u16(i + 7), u16(i + 5))
    if (m === 0xd9 || m === 0xda) return null
    if (m === 0xe1) girata = orientamentoGirato(b.subarray(i + 4, i + 2 + u16(i + 2)))
    i += 2 + u16(i + 2)
  }
  return null
}

/** L'EXIF dice 5–8 quando la foto va girata di 90° per vederla dritta (come fa il browser): allora larghezza e altezza si scambiano. */
function orientamentoGirato(s: Uint8Array): boolean {
  if (s.length < 14 || String.fromCharCode(...s.subarray(0, 6)) !== 'Exif\0\0') return false
  const t = s.subarray(6)
  const intel = t[0] === 0x49
  const r16 = (i: number) => (intel ? t[i] | (t[i + 1] << 8) : (t[i] << 8) | t[i + 1])
  const r32 = (i: number) => (intel ? r16(i) + r16(i + 2) * 65536 : r16(i) * 65536 + r16(i + 2))
  const ifd = r32(4)
  if (ifd + 2 > t.length) return false
  for (let k = 0, e = ifd + 2; k < r16(ifd) && e + 10 <= t.length; k++, e += 12) {
    if (r16(e) === 0x0112) return r16(e + 8) >= 5 && r16(e + 8) <= 8
  }
  return false
}

/** Cosa dire quando lo Storage risponde con un errore: mai il testo grezzo dell'API. */
export function cosaNonVaImmagini(messaggio: string, codice = ''): string {
  const t = `${messaggio} ${codice}`
  if (/not found|404/i.test(t)) return 'Le immagini del sito non sono ancora attive sul database: va lanciato 58-sito-immagini.sql'
  if (/row-level security|403|unauthorized/i.test(t)) return 'Solo la segreteria può caricare le immagini'
  if (/too large|413|exceeded/i.test(t)) return MASSIMO_TESTO
  return 'Non sono riuscito a leggere o salvare le immagini: controlla la connessione e riprova'
}
