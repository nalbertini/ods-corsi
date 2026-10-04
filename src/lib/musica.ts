import { leggiLink, leggiLinkSpotify } from '../../timer/src/lib/link'

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

export type FonteMusica = 'youtube' | 'spotify'

/** Da dove viene un link: YouTube, Spotify, o niente che si sappia suonare. */
export function fonteDelLink(link: string): FonteMusica | null {
  if (leggiLink(link)) return 'youtube'
  if (leggiLinkSpotify(link)) return 'spotify'
  return null
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
