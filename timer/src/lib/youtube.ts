/**
 * La musica da YouTube, suonata dentro il timer.
 *
 * Con Spotify il timer comanda un lettore che sta altrove. Con YouTube non si
 * può — l'app YouTube non accetta comandi da fuori — e allora il lettore lo si
 * mette qui: un link a una playlist o a un video, e a suonare è il timer.
 *
 * Le regole, che sono di YouTube e non si aggirano:
 * - il lettore deve **restare visibile**, almeno 200×200 pixel: per questo nel
 *   timer c'è un riquadro, e non soltanto i tasti;
 * - con lo schermo spento o l'app in secondo piano **la musica si ferma**:
 *   va bene per il tablet di sala sempre acceso, non per il telefono in tasca;
 * - possono comparire **pubblicità**, e alcuni video non si lasciano incorporare:
 *   quelli si saltano da soli.
 *
 * Il lettore è quello ufficiale (l'IFrame API), dal dominio «nocookie».
 */

import type { Lettore } from './spotify'

export { leggiLink, type Sorgente } from './link'
import type { Sorgente } from './link'

/* ---------- l'IFrame API, caricata una volta sola e solo se serve ---------- */

interface Giocatore {
  playVideo(): void
  pauseVideo(): void
  nextVideo(): void
  previousVideo(): void
  seekTo(s: number, permetti: boolean): void
  getCurrentTime(): number
  setVolume(v: number): void
  getVolume(): number
  getPlayerState(): number
  getPlaylist(): string[] | null
  getVideoData?: () => { title?: string; author?: string }
  destroy(): void
}

interface YT {
  Player: new (
    el: HTMLElement,
    opzioni: {
      host?: string
      width?: string | number
      height?: string | number
      videoId?: string
      playerVars?: Record<string, string | number>
      events?: Record<string, (e: { data: number; target: Giocatore }) => void>
    },
  ) => Giocatore
}

declare global {
  interface Window {
    YT?: YT
    onYouTubeIframeAPIReady?: () => void
  }
}

let api: Promise<YT> | null = null
function caricaApi(): Promise<YT> {
  if (window.YT?.Player) return Promise.resolve(window.YT)
  api ??= new Promise<YT>((risolvi, rifiuta) => {
    const prima = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      prima?.()
      if (window.YT) risolvi(window.YT)
    }
    const s = document.createElement('script')
    s.src = 'https://www.youtube.com/iframe_api'
    s.async = true
    s.onerror = () => {
      api = null
      rifiuta(new Error('rete'))
    }
    document.head.appendChild(s)
  })
  return api
}

/* ---------- lo stato, per chi lo mostra ---------- */

export interface StatoYoutube {
  /** Il lettore è montato e risponde. */
  pronto: boolean
  lettore: Lettore | null
  errore: string | null
}

let stato: StatoYoutube = { pronto: false, lettore: null, errore: null }
const ascoltatori = new Set<() => void>()

function aggiorna(patch: Partial<StatoYoutube>) {
  stato = { ...stato, ...patch }
  ascoltatori.forEach((f) => f())
}

export const statoYoutube = () => stato

export function ascoltaYoutube(f: () => void) {
  ascoltatori.add(f)
  return () => {
    ascoltatori.delete(f)
  }
}

let giocatore: Giocatore | null = null
/** Il volume mentre nessuno lo tocca: il lettore lo ricorda fra un timer e l'altro. */
let volumeScelto = 80

/**
 * Su iPhone e iPad il volume di una pagina lo decidono solo i tasti del
 * telefono: il lettore accetta il comando e non cambia niente. Meglio dirlo
 * che mostrare un numero che mente.
 */
export const VOLUME_BLOCCATO =
  /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.userAgent.includes('Macintosh') && navigator.maxTouchPoints > 1)

const IN_RIPRODUZIONE = 1
const IN_CARICAMENTO = 3

function leggiStato() {
  const g = giocatore
  if (!g) return
  try {
    const s = g.getPlayerState()
    const dati = g.getVideoData?.() ?? {}
    aggiorna({
      lettore: {
        inRiproduzione: s === IN_RIPRODUZIONE || s === IN_CARICAMENTO,
        titolo: dati.title ?? '',
        artista: dati.author ?? '',
        copertina: null,
        volume: VOLUME_BLOCCATO ? null : Math.round(g.getVolume()),
        dispositivo: 'YouTube',
      },
    })
  } catch {
    // Lettore non ancora pronto: al prossimo evento.
  }
}

/**
 * Monta il lettore nell'elemento dato. Restituisce la funzione che lo smonta.
 *
 * Il lettore vive con la schermata del timer: uscendo, la musica finisce con
 * lui. Tenerlo acceso altrove vorrebbe dire tenerlo visibile altrove, ed è la
 * regola di YouTube che lo impedisce.
 */
export function monta(el: HTMLElement, sorgente: Sorgente, parti = false): () => void {
  let vivo = true
  const posto = document.createElement('div')
  el.appendChild(posto)
  aggiorna({ pronto: false, lettore: null, errore: null })
  caricaApi()
    .then((yt) => {
      if (!vivo) return
      const vars: Record<string, string | number> = { playsinline: 1, rel: 0, modestbranding: 1 }
      if (sorgente.lista) {
        vars.listType = 'playlist'
        vars.list = sorgente.lista
      }
      giocatore = new yt.Player(posto, {
        host: 'https://www.youtube-nocookie.com',
        width: '100%',
        height: '100%',
        videoId: sorgente.video,
        playerVars: vars,
        events: {
          onReady: (e) => {
            if (!vivo) return
            e.target.setVolume(volumeScelto)
            // Una lista appena scelta col dito parte da sola: il tocco c'è già stato.
            if (parti) e.target.playVideo()
            aggiorna({ pronto: true })
            leggiStato()
          },
          onStateChange: () => {
            if (vivo) leggiStato()
          },
          onError: (e) => {
            if (!vivo) return
            // 101 e 150: il proprietario non lascia incorporare il video. In
            // una playlist si passa al prossimo; da solo non c'è niente da fare.
            const bloccato = e.data === 101 || e.data === 150
            const inLista = (giocatore?.getPlaylist()?.length ?? 0) > 1
            if (bloccato && inLista) {
              giocatore?.nextVideo()
              return
            }
            aggiorna({
              errore: bloccato
                ? 'Questo video non si può suonare fuori da YouTube: scegline un altro.'
                : 'YouTube non riesce a suonare questo link.',
            })
          },
        },
      })
    })
    .catch(() => {
      if (vivo) aggiorna({ errore: 'YouTube non si carica: controlla la rete.' })
    })
  return () => {
    vivo = false
    abbassata = null
    try {
      giocatore?.destroy()
    } catch {
      // Già smontato.
    }
    giocatore = null
    posto.remove()
    aggiorna({ pronto: false, lettore: null })
  }
}

/* ---------- i comandi ---------- */

function fai(f: (g: Giocatore) => void): Promise<boolean> {
  const g = giocatore
  if (!g || !stato.pronto) return Promise.resolve(false)
  try {
    f(g)
    aggiorna({ errore: null })
    // Il lettore cambia stato da sé e lo racconta con un evento; il volume no.
    window.setTimeout(leggiStato, 150)
    return Promise.resolve(true)
  } catch {
    return Promise.resolve(false)
  }
}

export const suona = () => fai((g) => g.playVideo())
export const pausa = () => fai((g) => g.pauseVideo())
export const avanti = () => fai((g) => g.nextVideo())

/** Come un lettore vero: a brano iniziato si torna all'inizio, subito dopo al precedente. */
export const indietro = () => fai((g) => (g.getCurrentTime() > 3 ? g.seekTo(0, true) : g.previousVideo()))

export function volume(percento: number) {
  const v = Math.round(Math.min(100, Math.max(0, percento)))
  if (abbassata === null) volumeScelto = v
  return fai((g) => g.setVolume(v))
}

/* ---------- la musica che segue il timer ---------- */

let abbassata: number | null = null

export async function abbassa(percento: number) {
  if (abbassata !== null || !giocatore || !stato.lettore || VOLUME_BLOCCATO) return
  const v = stato.lettore.volume ?? volumeScelto
  if (v <= percento) return
  abbassata = v
  await fai((g) => g.setVolume(percento))
}

export async function rialza() {
  if (abbassata === null) return
  const v = abbassata
  abbassata = null
  await fai((g) => g.setVolume(v))
}
