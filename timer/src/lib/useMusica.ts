import { useEffect, useRef, useSyncExternalStore } from 'react'
import type { SegmentKind, Settings } from '../types'
import { abbassa, ascolta, osserva, pausa, rialza, statoMusica, suona } from './spotify'
import type { Status } from './useTimer'

/** Lo stato di Spotify, aggiornato finché il componente resta montato. */
export function useMusica() {
  const s = useSyncExternalStore(ascolta, statoMusica)
  useEffect(() => (s.collegato ? osserva() : undefined), [s.collegato])
  return s
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
export function useMusicaAlTimer(status: Status, kind: SegmentKind | undefined, settings: Settings, collegato: boolean) {
  const prima = useRef<Status>(status)
  useEffect(() => {
    const da = prima.current
    prima.current = status
    if (!collegato || !settings.musicaSegue || da === status) return
    if (status === 'running') void suona()
    // Da idle a idle non succede niente: il timer appena aperto non tocca la musica.
    else if (da === 'running' || da === 'paused') void pausa()
  }, [status, collegato, settings.musicaSegue])

  const recupero = status === 'running' && kind !== undefined && RECUPERO.includes(kind)
  useEffect(() => {
    if (!collegato || !settings.musicaAbbassa) return
    if (recupero) void abbassa(settings.musicaRecupero)
    else void rialza()
  }, [recupero, collegato, settings.musicaAbbassa, settings.musicaRecupero])

  // Uscire dal timer a metà: la schermata si smonta prima che il cambio di
  // stato arrivi all'effetto qui sopra, quindi la pausa la si dà qui.
  const ultimo = useRef({ status, segue: collegato && settings.musicaSegue })
  ultimo.current = { status, segue: collegato && settings.musicaSegue }
  useEffect(
    () => () => {
      void rialza()
      const { status: s, segue } = ultimo.current
      if (segue && (s === 'running' || s === 'paused')) void pausa()
    },
    [],
  )
}
