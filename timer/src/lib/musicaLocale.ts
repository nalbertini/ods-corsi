/**
 * La musica che non passa da YouTube né da Spotify: i file scelti sul tablet e
 * le radio. Qui le regole, senza browser (le prova `prova:musica-file`); il
 * suono vero sta in `audio.ts`.
 */
import type { Settings } from '../types'

export type FonteMusica = 'spotify' | 'youtube' | 'file' | 'radio'
export interface BranoFile {
  id: string
  nome: string
}
/** L'ordine in cui suonano i brani (indici dell'elenco) e dove si è arrivati. */
export interface Coda {
  ordine: number[]
  pos: number
}

/** Le scritte per chi usa l'app: parole della palestra, non da tecnici. */
export const TESTI_MUSICA = {
  file: 'FILE DEL TABLET',
  radio: 'RADIO',
  fileQui: 'File su questo apparecchio',
  fileIlleggibili: 'Non riesco a leggere questi file: scegli file MP3 o AAC',
  fileSpariti: 'Non trovo più i tuoi file, sceglili di nuovo',
  riprova: 'Riprova',
}

const FONTI: readonly FonteMusica[] = ['spotify', 'youtube', 'file', 'radio']

/** Spotify per tutto quel che non si conosce: i salvataggi di prima non hanno il campo. */
export const leggiFonte = (v: unknown): FonteMusica => FONTI.find((f) => f === v) ?? 'spotify'

/** Gli indici mescolati; con più di un brano non si comincia da `ultimo`, appena suonato. */
export function ordineCasuale(n: number, caso: () => number, ultimo?: number): number[] {
  const o = Array.from({ length: n }, (_, i) => i)
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(caso() * (i + 1))
    ;[o[i], o[j]] = [o[j], o[i]]
  }
  if (n > 1 && o[0] === ultimo) [o[0], o[1]] = [o[1], o[0]]
  return o
}

export const nuovaCoda = (n: number, caso: () => number): Coda => ({
  ordine: ordineCasuale(n, caso),
  pos: 0,
})

/** Il brano dopo; finiti tutti, si rimescola e non si ripete quello appena suonato. */
export function avantiCoda(c: Coda, caso: () => number): Coda {
  if (c.pos + 1 < c.ordine.length) return { ordine: c.ordine, pos: c.pos + 1 }
  return {
    ordine: ordineCasuale(c.ordine.length, caso, c.ordine[c.pos]),
    pos: 0,
  }
}

/** Come un lettore vero: dopo più di 3 secondi si torna all'inizio, prima al precedente. */
export function indietroCoda(c: Coda, secondi: number): { coda: Coda; daCapo: boolean } {
  if (secondi > 3 || c.pos === 0) return { coda: c, daCapo: true }
  return { coda: { ordine: c.ordine, pos: c.pos - 1 }, daCapo: false }
}

/** Dopo un brano illeggibile si va al primo buono; se non ce n'è, si dice cosa fare. */
export function dopoErrore(c: Coda, illeggibili: number[], caso: () => number): { coda: Coda } | { errore: string } {
  if (c.ordine.every((i) => illeggibili.includes(i))) return { errore: TESTI_MUSICA.fileIlleggibili }
  let coda = c
  // Ogni brano si incontra al più una volta per giro, e almeno uno è buono.
  for (let i = 0; i <= c.ordine.length * 2; i++) {
    coda = avantiCoda(coda, caso)
    if (!illeggibili.includes(coda.ordine[coda.pos])) return { coda }
  }
  return { errore: TESTI_MUSICA.fileIlleggibili }
}

/** Nuovi brani in coda: quelli di prima restano dove sono, i nuovi vanno dopo, mescolati. */
/**
 * L'elenco è cambiato togliendo qualcosa: si rifà l'ordine. Il brano che
 * suona resta il primo, così togliere un altro file non lo interrompe.
 */
export function codaDopoTolta(elenco: BranoFile[], suonaId: string | null, caso: () => number): Coda {
  const coda = nuovaCoda(elenco.length, caso)
  const i = elenco.findIndex((f) => f.id === suonaId)
  return i < 0 ? coda : { ordine: [i, ...coda.ordine.filter((x) => x !== i)], pos: 0 }
}

export function aggiungiACoda(c: Coda, quanti: number, caso: () => number): Coda {
  const prima = c.ordine.length
  const nuovi = ordineCasuale(quanti, caso).map((i) => prima + i)
  return { ordine: [...c.ordine, ...nuovi], pos: c.pos }
}

export function aggiungiFile(elenco: BranoFile[], nuovi: BranoFile[]): BranoFile[] {
  return [...elenco, ...nuovi.filter((n) => !elenco.some((e) => e.id === n.id))]
}
export const togliFile = (elenco: BranoFile[], id: string): BranoFile[] => elenco.filter((f) => f.id !== id)
export const svuotaFile = (_elenco: BranoFile[]): BranoFile[] => []

/** Il tablet ricorda quanti file erano, ma il browser non ne ha più nessuno: si dice. */
export const erroreMemoria = (attesi: number, trovati: number): string | null =>
  attesi > 0 && trovati === 0 ? TESTI_MUSICA.fileSpariti : null

/** La radio non ha brani da saltare: ⏮ e ⏭ restano spenti. */
export const radio = (nome: string, link: string): { titolo: string; indietro: boolean; avanti: boolean } => ({
  titolo: nome.trim() || link,
  indietro: false,
  avanti: false,
})

export const erroreRadio = (): { messaggio: string; tasto: string } => ({
  messaggio: 'La radio non parte: controlla la rete e riprova.',
  tasto: TESTI_MUSICA.riprova,
})

/** Una fonte sola alla volta: cambiando, si ferma quella di prima. */
export const cosaSiFerma = (da: FonteMusica | null, a: FonteMusica): FonteMusica[] => (da && da !== a ? [da] : [])

/** C'è qualcosa da suonare e il player è acceso. */
export function musicaPronta(
  s: Pick<Settings, 'musica' | 'musicaFonte' | 'youtube'>,
  c: { spotifyCollegato: boolean; nFile: number; radio: string | null },
): boolean {
  if (s.musica === false) return false
  if (s.musicaFonte === 'file') return c.nFile > 0
  if (s.musicaFonte === 'radio') return !!c.radio
  if (s.musicaFonte === 'youtube') return !!s.youtube.trim()
  return c.spotifyCollegato
}
