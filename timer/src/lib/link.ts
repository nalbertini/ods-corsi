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

/**
 * Una radio è un indirizzo https qualunque, che non sia già un link di YouTube
 * o di Spotify sbagliato. Dice la stessa cosa del vincolo del database
 * (`supabase/39-musica-radio.sql`): se qui passasse un indirizzo che lì no, la
 * segreteria vedrebbe un errore che non c'entra. L'app è su https e il browser
 * non suona l'http: lo si dice invece di tentare (vedi `MESSAGGIO_HTTP`).
 */
const RADIO = /^https:\/\/([a-z0-9-]+(?:\.[a-z0-9-]+)+)(?::[0-9]+)?(?:\/[^\s"<>\\]*)?$/i
const ALTRI_SERVIZI = /^(?:www\.|m\.|music\.|open\.)?(?:youtube\.com|youtu\.be|youtube-nocookie\.com|spotify\.com)$/i

export function leggiRadio(testo: string): string | null {
  const t = testo.trim()
  const m = t.length <= 500 ? RADIO.exec(t) : null
  return m && !ALTRI_SERVIZI.test(m[1]) ? t : null
}

export const eHttp = (testo: string) => /^http:\/\/\S+$/i.test(testo.trim())

export const MESSAGGIO_HTTP = "Questo indirizzo non è sicuro: cerca l'indirizzo che comincia con https."
