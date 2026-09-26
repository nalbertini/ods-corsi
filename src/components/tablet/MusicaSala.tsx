import { useEffect, useSyncExternalStore } from 'react'
// Lo stesso modulo del timer: timer e sala stanno sullo stesso sito, quindi
// il collegamento fatto dalle impostazioni del timer vale anche qui.
import { ascolta, avanti, indietro, osserva, pausa, statoMusica, suona, volume } from '../../../timer/src/lib/spotify'

type P = { size?: number }
const Prec = ({ size = 22 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <polygon points="19 20 9 12 19 4 19 20" />
    <rect x="4" y="5" width="2.5" height="14" />
  </svg>
)
const Succ = ({ size = 22 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <polygon points="5 4 15 12 5 20 5 4" />
    <rect x="17.5" y="5" width="2.5" height="14" />
  </svg>
)
const Suona = ({ size = 22 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <polygon points="6 3 21 12 6 21 6 3" />
  </svg>
)
const Ferma = ({ size = 22 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <rect x="6" y="4" width="4" height="16" />
    <rect x="14" y="4" width="4" height="16" />
  </svg>
)

/**
 * La musica della sala, dal tablet: cosa suona e i tasti per comandarla.
 *
 * Solo Spotify, e solo se è già collegato dal timer. YouTube qui non c'è di
 * proposito: suona dentro la pagina, e toccando TIMER la pagina cambia e la
 * musica si fermerebbe. Spotify suona altrove, e non se ne accorge.
 */
export function MusicaSala() {
  const m = useSyncExternalStore(ascolta, statoMusica)
  useEffect(() => (m.collegato ? osserva() : undefined), [m.collegato])
  if (!m.collegato) return null
  const l = m.lettore
  const suonando = l?.inRiproduzione ?? false

  return (
    <div className="tb-musica">
      <span className="stack tb-musica-testo">
        <span className="tb-musica-titolo">{l ? l.titolo || 'Spotify' : 'Spotify fermo'}</span>
        <span className="tb-musica-sotto" style={m.errore ? { color: 'var(--rosso)' } : undefined}>
          {m.errore ?? (l ? [l.artista, l.dispositivo].filter(Boolean).join(' · ') : 'Tocca ▶ per farlo partire')}
        </span>
      </span>
      {l?.volume != null && (
        <>
          <button type="button" className="tb-musica-tasto" onClick={() => void volume(l.volume! - 10)} aria-label="Musica più bassa">
            −
          </button>
          <span className="num tb-musica-volume">{l.volume}</span>
          <button type="button" className="tb-musica-tasto" onClick={() => void volume(l.volume! + 10)} aria-label="Musica più alta">
            +
          </button>
        </>
      )}
      <button type="button" className="tb-musica-tasto" onClick={() => void indietro()} disabled={!l} aria-label="Brano precedente">
        <Prec />
      </button>
      <button
        type="button"
        className="tb-musica-tasto"
        onClick={() => void (suonando ? pausa() : suona())}
        aria-label={suonando ? 'Metti in pausa la musica' : 'Fai partire la musica'}
      >
        {suonando ? <Ferma /> : <Suona />}
      </button>
      <button type="button" className="tb-musica-tasto" onClick={() => void avanti()} disabled={!l} aria-label="Brano successivo">
        <Succ />
      </button>
    </div>
  )
}
