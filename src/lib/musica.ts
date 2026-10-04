import { eHttp, leggiLink, leggiLinkSpotify, leggiRadio, MESSAGGIO_HTTP } from '../../timer/src/lib/link'

/**
 * La musica delle sale: le liste che la segreteria prepara e il tablet fa
 * partire con un tocco.
 *
 * Una lista è un nome e un link, a una playlist di YouTube o di Spotify. Vale
 * per una sala, o per tutte se non ne ha una. Il tablet non la cambia: la
 * sceglie, e la sua barra in basso la suona. A cosa serve il link lo dice il
 * link stesso (vedi `fonteDelLink`), così la segreteria non deve scegliere.
 */
export interface ListaMusica {
  id: string
  nome: string
  link: string
  /** Nulla: per tutte le sale. */
  salaId: string | null
}

export type FonteMusica = 'youtube' | 'spotify' | 'radio'

/**
 * Da dove viene un link: YouTube, Spotify, una radio (un indirizzo https
 * qualunque), o niente che si sappia suonare. L'http semplice non va: l'app è
 * su https e il browser blocca il suono (vedi `erroreDelLink`).
 */
export function fonteDelLink(link: string): FonteMusica | null {
  if (leggiLink(link)) return 'youtube'
  if (leggiLinkSpotify(link)) return 'spotify'
  return leggiRadio(link) ? 'radio' : null
}

/** Cosa dire a chi scrive un indirizzo che comincia con http: null se non è il caso. */
export function erroreDelLink(link: string): string | null {
  if (link.trim().length > MAX_LINK) return 'Il link è troppo lungo'
  return fonteDelLink(link) === null && eHttp(link) ? MESSAGGIO_HTTP : null
}

/**
 * La musica che il tablet passa al timer: fonte e link scelti in sala. Se chi è
 * in sala l'ha spenta dal tablet, `musica: false` vince su quello che dicono le
 * impostazioni; altrimenti il campo non c'è e valgono le impostazioni.
 */
export function musicaDellaSala<T extends object>(base: T, spenta: boolean): T | (T & { musica: false }) {
  return spenta ? { ...base, musica: false } : base
}

export const MAX_NOME_LISTA = 40
/** Quanto può essere lungo un link: lo dice anche il database. */
const MAX_LINK = 500
