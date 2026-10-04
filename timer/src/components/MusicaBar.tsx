import type { Musica } from '../lib/useMusica'
import { PostoPlayer } from './PlayerYoutube'
import { Minus, Next, Pause, Play, Plus, Prev } from './Icons'
import { TESTI_MUSICA } from '../lib/musicaLocale'

const NOME = { spotify: 'Spotify', youtube: 'YouTube', file: 'File del tablet', radio: 'Radio' } as const

/**
 * La musica, dentro il timer: cosa suona e i tasti per comandarla.
 *
 * C'è solo se c'è qualcosa da comandare. Con Spotify è una riga e non di più:
 * lo schermo è del tempo, e la musica si guarda con la coda dell'occhio fra un
 * giro e l'altro. Con YouTube accanto ai tasti c'è il posto del lettore,
 * perché YouTube vuole che si veda: il lettore vero sta alla radice dell'app e
 * ci si appoggia sopra (vedi PlayerYoutube).
 */
export function MusicaBar({ musica, className = '' }: { musica: Musica; className?: string }) {
  if (!musica.attiva) return null
  const { lettore: l, errore, comandi } = musica
  const suonando = l?.inRiproduzione ?? false
  const yt = musica.fonte === 'youtube'

  return (
    <div className={`musica-bar card ${className}`} data-fonte={musica.fonte}>
      {yt ? (
        <PostoPlayer />
      ) : l?.copertina ? (
        <img className="musica-copertina" src={l.copertina} alt="" />
      ) : (
        musica.fonte === 'spotify' && <div className="musica-copertina" />
      )}
      <div className="musica-comandi">
        <div className="stack grow" style={{ gap: 1, minWidth: 0 }}>
          <span className="musica-titolo">
            {l ? l.titolo || NOME[musica.fonte] : musica.fonte === 'spotify' ? 'Spotify fermo' : NOME[musica.fonte]}
          </span>
          <span className="musica-sotto" style={errore ? { color: 'var(--rosso-testo)', whiteSpace: 'normal' } : undefined}>
            {errore ?? (l ? [l.artista, l.dispositivo].filter(Boolean).join(' · ') : 'Tocca ▶ per farlo partire')}
          </span>
        </div>
        <div className="musica-tasti">
          {musica.fonte === 'radio' && errore && (
            <button className="btn btn-ghost" style={{ minHeight: 44, minWidth: 44, padding: '0 12px', fontSize: 13, textTransform: 'uppercase' }} onClick={() => void comandi.suona()}>
              {TESTI_MUSICA.riprova}
            </button>
          )}
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
          <button className="musica-tasto" onClick={() => void comandi.indietro()} disabled={!l || musica.fonte === 'radio'} aria-label="Brano precedente">
            <Prev size={18} />
          </button>
          <button
            className="musica-tasto"
            onClick={() => void (suonando ? comandi.pausa() : comandi.suona())}
            aria-label={suonando ? 'Metti in pausa la musica' : 'Fai partire la musica'}
          >
            {suonando ? <Pause size={18} /> : <Play size={18} />}
          </button>
          <button className="musica-tasto" onClick={() => void comandi.avanti()} disabled={!l || musica.fonte === 'radio'} aria-label="Brano successivo">
            <Next size={18} />
          </button>
        </div>
      </div>
    </div>
  )
}
