/**
 * I link della musica, letti senza toccare niente: né il lettore di YouTube
 * né Spotify. Stanno qui da soli perché li usa anche ODS Corsi — la
 * segreteria controlla i link delle liste delle sale prima di salvarli — e
 * lì non deve portarsi dietro i moduli che all'avvio guardano il browser.
 */

/** Quel che si ricava da un link: il video da cui partire, la playlist, o tutti e due. */
export interface Sorgente {
  video?: string
  lista?: string
}

const ID = /^[\w-]{11}$/
const LISTA = /^[\w-]{10,}$/

/**
 * Legge un link di YouTube, in tutte le forme in cui lo si copia: dall'app,
 * dal browser, dalla condivisione, da YouTube Music. Null se non è YouTube.
 */
export function leggiLink(testo: string): Sorgente | null {
  const t = testo.trim()
  if (!t) return null
  let u: URL
  try {
    u = new URL(/^https?:\/\//i.test(t) ? t : `https://${t}`)
  } catch {
    return null
  }
  const host = u.hostname.replace(/^(www|m|music)\./, '')
  let video: string | undefined
  if (host === 'youtu.be') video = u.pathname.slice(1).split('/')[0]
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    const [, primo, secondo] = u.pathname.split('/')
    video = primo === 'watch' ? (u.searchParams.get('v') ?? undefined) : ['embed', 'shorts', 'live', 'v'].includes(primo) ? secondo : undefined
  } else return null
  const lista = u.searchParams.get('list') ?? undefined
  const s: Sorgente = {}
  if (video && ID.test(video)) s.video = video
  if (lista && LISTA.test(lista)) s.lista = lista
  return s.video || s.lista ? s : null
}

/**
 * Un link di Spotify a una playlist, un album o un artista, come lo si copia
 * dall'app («Condividi › Copia link») o come URI. Null se non è Spotify.
 */
export function leggiLinkSpotify(testo: string): string | null {
  const t = testo.trim()
  const uri = /^spotify:(playlist|album|artist):([A-Za-z0-9]{10,40})$/.exec(t)
  if (uri) return `spotify:${uri[1]}:${uri[2]}`
  let u: URL
  try {
    u = new URL(/^https?:\/\//i.test(t) ? t : `https://${t}`)
  } catch {
    return null
  }
  if (u.hostname !== 'open.spotify.com') return null
  // Il percorso può avere davanti la lingua: /intl-it/playlist/…
  const m = /^\/(?:intl-[\w-]+\/)?(playlist|album|artist)\/([A-Za-z0-9]{10,40})\/?$/.exec(u.pathname)
  return m ? `spotify:${m[1]}:${m[2]}` : null
}
