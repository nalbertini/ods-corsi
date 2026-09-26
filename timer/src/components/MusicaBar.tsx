import { useEffect, useRef } from 'react'
import type { Musica } from '../lib/useMusica'
import { leggiLink, monta } from '../lib/youtube'
import { Minus, Next, Pause, Play, Plus, Prev } from './Icons'

/**
 * La musica, dentro il timer: cosa suona e i tasti per comandarla.
 *
 * C'è solo se c'è qualcosa da comandare. Con Spotify è una riga e non di più:
 * lo schermo è del tempo, e la musica si guarda con la coda dell'occhio fra un
 * giro e l'altro. Con YouTube accanto ai tasti c'è il lettore stesso, perché
 * YouTube vuole che si veda.
 */
export function MusicaBar({ musica, youtube }: { musica: Musica; youtube: string }) {
  if (!musica.attiva) return null
  const { lettore: l, errore, comandi } = musica
  const suonando = l?.inRiproduzione ?? false
  const yt = musica.fonte === 'youtube'

  return (
    <div className="musica-bar card" data-fonte={musica.fonte}>
      {yt ? (
        <RiquadroYoutube link={youtube} />
      ) : l?.copertina ? (
        <img className="musica-copertina" src={l.copertina} alt="" />
      ) : (
        <div className="musica-copertina" />
      )}
      <div className="musica-comandi">
        <div className="stack grow" style={{ gap: 1, minWidth: 0 }}>
          <span className="musica-titolo">
            {l ? l.titolo || (yt ? 'YouTube' : 'Spotify') : yt ? 'YouTube' : 'Spotify fermo'}
          </span>
          <span className="musica-sotto" style={errore ? { color: 'var(--rosso)' } : undefined}>
            {errore ?? (l ? [l.artista, l.dispositivo].filter(Boolean).join(' · ') : 'Tocca ▶ per farlo partire')}
          </span>
        </div>
        <div className="musica-tasti">
          {l?.volume != null && (
            <>
              <button className="musica-tasto solo-largo" onClick={() => void comandi.volume(l.volume! - 10)} aria-label="Musica più bassa">
                <Minus size={16} />
              </button>
              <span className="num musica-volume solo-largo">{l.volume}</span>
              <button className="musica-tasto solo-largo" onClick={() => void comandi.volume(l.volume! + 10)} aria-label="Musica più alta">
                <Plus size={16} />
              </button>
            </>
          )}
          <button className="musica-tasto" onClick={() => void comandi.indietro()} disabled={!l} aria-label="Brano precedente">
            <Prev size={18} />
          </button>
          <button
            className="musica-tasto"
            onClick={() => void (suonando ? comandi.pausa() : comandi.suona())}
            aria-label={suonando ? 'Metti in pausa la musica' : 'Fai partire la musica'}
          >
            {suonando ? <Pause size={18} /> : <Play size={18} />}
          </button>
          <button className="musica-tasto" onClick={() => void comandi.avanti()} disabled={!l} aria-label="Brano successivo">
            <Next size={18} />
          </button>
        </div>
      </div>
    </div>
  )
}

/** Il lettore di YouTube: montato con il timer, smontato quando si esce. */
function RiquadroYoutube({ link }: { link: string }) {
  const el = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const s = leggiLink(link)
    if (!el.current || !s) return
    return monta(el.current, s)
  }, [link])
  return <div className="musica-video" ref={el} />
}
