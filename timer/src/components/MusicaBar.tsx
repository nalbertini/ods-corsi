import { avanti, indietro, pausa, suona, volume } from '../lib/spotify'
import { useMusica } from '../lib/useMusica'
import { Minus, Next, Pause, Play, Plus, Prev } from './Icons'

/**
 * La musica, dentro il timer: cosa suona e i quattro tasti per comandarla.
 *
 * C'è solo con Spotify collegato. È una riga e non di più: lo schermo è del
 * tempo, e la musica si guarda con la coda dell'occhio fra un giro e l'altro.
 */
export function MusicaBar() {
  const m = useMusica()
  if (!m.collegato) return null
  const l = m.lettore
  const suonando = l?.inRiproduzione ?? false

  return (
    <div className="musica-bar card">
      {l?.copertina ? <img className="musica-copertina" src={l.copertina} alt="" /> : <div className="musica-copertina" />}
      <div className="stack grow" style={{ gap: 1, minWidth: 0 }}>
        <span className="musica-titolo">{l ? l.titolo || 'Spotify' : 'Spotify fermo'}</span>
        <span className="musica-sotto" style={m.errore ? { color: 'var(--rosso)' } : undefined}>
          {m.errore ?? (l ? [l.artista, l.dispositivo].filter(Boolean).join(' · ') : 'Tocca ▶ per farlo partire')}
        </span>
      </div>
      {l?.volume != null && (
        <>
          <button className="musica-tasto solo-largo" onClick={() => void volume(l.volume! - 10)} aria-label="Musica più bassa">
            <Minus size={16} />
          </button>
          <span className="num musica-volume solo-largo">{l.volume}</span>
          <button className="musica-tasto solo-largo" onClick={() => void volume(l.volume! + 10)} aria-label="Musica più alta">
            <Plus size={16} />
          </button>
        </>
      )}
      <button className="musica-tasto" onClick={() => void indietro()} disabled={!l} aria-label="Brano precedente">
        <Prev size={18} />
      </button>
      <button
        className="musica-tasto"
        onClick={() => void (suonando ? pausa() : suona())}
        aria-label={suonando ? 'Metti in pausa la musica' : 'Fai partire la musica'}
      >
        {suonando ? <Pause size={18} /> : <Play size={18} />}
      </button>
      <button className="musica-tasto" onClick={() => void avanti()} disabled={!l} aria-label="Brano successivo">
        <Next size={18} />
      </button>
    </div>
  )
}
