import { useEffect, useRef, useSyncExternalStore } from 'react'
import type { SegmentKind, Settings } from '../types'
import * as spotify from './spotify'
import * as youtube from './youtube'
import type { Lettore } from './spotify'
import type { Status } from './useTimer'
import { musicaAttiva } from './musicaAttiva'

/** Lo stato di Spotify, aggiornato finché il componente resta montato. */
export function useSpotify() {
  const s = useSyncExternalStore(spotify.ascolta, spotify.statoMusica)
  useEffect(() => (s.collegato ? spotify.osserva() : undefined), [s.collegato])
  return s
}

/** I comandi che il timer sa dare alla musica, da qualunque parte venga. */
export interface Comandi {
  suona: () => Promise<boolean>
  pausa: () => Promise<boolean>
  avanti: () => Promise<boolean>
  indietro: () => Promise<boolean>
  volume: (v: number) => Promise<boolean>
  abbassa: (v: number) => Promise<void>
  rialza: () => Promise<void>
}

export interface Musica {
  fonte: Settings['musicaFonte']
  /** C'è qualcosa da comandare: Spotify collegato, o un link di YouTube valido. */
  attiva: boolean
  lettore: Lettore | null
  errore: string | null
  comandi: Comandi
}

/**
 * La musica scelta nelle impostazioni, qualunque sia: il timer, la barra e le
 * automazioni parlano con questa e non sanno se dietro c'è Spotify o YouTube.
 */
export function useMusica(settings: Settings): Musica {
  const sp = useSpotify()
  const yt = useSyncExternalStore(youtube.ascoltaYoutube, youtube.statoYoutube)
  if (settings.musicaFonte === 'youtube') {
    return {
      fonte: 'youtube',
      attiva: musicaAttiva(settings, youtube.leggiLink(settings.youtube) !== null),
      lettore: yt.lettore,
      errore: yt.errore,
      comandi: youtube,
    }
  }
  return { fonte: 'spotify', attiva: musicaAttiva(settings, sp.collegato), lettore: sp.lettore, errore: sp.errore, comandi: spotify }
}

/** I blocchi in cui la musica scende: si riprende fiato e si ascolta l'istruttore. */
const RECUPERO: SegmentKind[] = ['rest', 'setRest']

/**
 * La musica che va dietro al timer, se lo si è chiesto nelle impostazioni.
 *
 * Parte con l'avvio e con la ripresa, si ferma con la pausa, a fine
 * allenamento e con l'azzeramento. Nel recupero scende al volume scelto e al
 * lavoro torna dov'era. Uscendo dal timer il volume torna sempre a posto: una
 * musica rimasta al trenta per cento dopo la lezione sembra un guasto.
 */
export function useMusicaAlTimer(status: Status, kind: SegmentKind | undefined, settings: Settings, musica: Musica) {
  const { attiva, comandi } = musica
  const prima = useRef<Status>(status)
  useEffect(() => {
    const da = prima.current
    prima.current = status
    if (!attiva || !settings.musicaSegue || da === status) return
    if (status === 'running') void comandi.suona()
    // Da idle a idle non succede niente: il timer appena aperto non tocca la musica.
    else if (da === 'running' || da === 'paused') void comandi.pausa()
  }, [status, attiva, comandi, settings.musicaSegue])

  const recupero = status === 'running' && kind !== undefined && RECUPERO.includes(kind)
  useEffect(() => {
    if (!attiva || !settings.musicaAbbassa) return
    if (recupero) void comandi.abbassa(settings.musicaRecupero)
    else void comandi.rialza()
  }, [recupero, attiva, comandi, settings.musicaAbbassa, settings.musicaRecupero])

  // Uscire dal timer a metà: la schermata si smonta prima che il cambio di
  // stato arrivi all'effetto qui sopra, quindi la pausa la si dà qui. Il
  // lettore di YouTube si smonta con la schermata e si ferma da sé.
  const ultimo = useRef({ status, segue: attiva && settings.musicaSegue, comandi })
  ultimo.current = { status, segue: attiva && settings.musicaSegue, comandi }
  useEffect(
    () => () => {
      const { status: s, segue, comandi: c } = ultimo.current
      void c.rialza()
      if (segue && (s === 'running' || s === 'paused')) void c.pausa()
    },
    [],
  )
}
