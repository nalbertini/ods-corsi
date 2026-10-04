import { useState } from 'react'
import type { Musica } from '../../../timer/src/lib/useMusica'
import { PostoPlayer } from '../../../timer/src/components/PlayerYoutube'
import { TESTI_MUSICA } from '../../../timer/src/lib/musicaLocale'
import { fonteDelLink, type ListaMusica } from '../../lib/musica'
import { type Disciplina, dellaDisciplina, disciplineConVoci, filtroValido, nomeDisciplina } from '../../../timer/src/lib/discipline'

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
const Spegni = ({ size = 22 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" aria-hidden="true">
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
)
const Liste = ({ size = 24 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" aria-hidden="true">
    <path d="M4 6h16M4 12h16M4 18h10" />
  </svg>
)

const NOME_FONTE = {
  youtube: 'YouTube',
  spotify: 'Spotify',
  file: 'File del tablet',
  radio: 'Radio',
} as const

/**
 * La musica della sala, nella barra in basso del tablet: cosa suona, il
 * volume, ⏮ ▶ ⏭, e le liste che ha preparato la segreteria.
 *
 * La barra è la stessa sotto le presenze e sotto il timer, e non si smonta
 * mai: per questo anche YouTube, che suona dentro la pagina, continua a
 * suonare passando dall'una all'altra. Il suo lettore sta nel riquadro a
 * destra (`VideoSala`), perché YouTube vuole che si veda.
 */
export function MusicaSala({
  musica,
  liste,
  scelta,
  spotifyCollegato,
  onScegli,
  onSpegni,
  discipline,
}: {
  musica: Musica
  liste: ListaMusica[]
  /** La lista che suona; nulla: quella delle impostazioni del timer. */
  scelta: string | null
  spotifyCollegato: boolean
  onScegli: (l: ListaMusica | null) => void
  /** Spegne la musica su questo tablet: sparisce la barra e il lettore. */
  onSpegni: () => void
  /** Le discipline della palestra: il filtro delle liste. */
  discipline: Disciplina[]
}) {
  const [aperte, setAperte] = useState(false)
  const [disciplina, setDisciplina] = useState<string | null>(null)
  // Il filtro mostra solo le discipline che hanno una lista; uno su una disciplina rimasta senza non resta acceso.
  const usate = disciplineConVoci(liste, discipline)
  const filtro = filtroValido(disciplina, usate)
  // File e radio senza niente da suonare dicono perché (file spariti, radio caduta): non restano muti.
  const locale = musica.fonte === 'file' || musica.fonte === 'radio'
  if (!musica.attiva && liste.length === 0 && !(locale && musica.errore)) return null

  const l = musica.lettore
  const suonando = l?.inRiproduzione ?? false
  const yt = musica.fonte === 'youtube'
  const nomeLista = liste.find((x) => x.id === scelta)?.nome
  const sotto =
    musica.errore ??
    (locale && l && !suonando
      ? 'Tocca ▶ per farla partire'
      : l
        ? [l.artista, nomeLista ?? l.dispositivo].filter(Boolean).join(' · ')
        : musica.attiva
          ? 'Tocca ▶ per farla partire'
          : musica.fonte === 'file'
            ? 'Scegli i file nelle impostazioni del timer'
            : 'Scegli una lista')

  return (
    <div className="tb-musica">
      {musica.attiva && !yt && (l?.copertina ? <img className="tb-musica-copertina" src={l.copertina} alt="" /> : musica.fonte === 'spotify' && <span className="tb-musica-copertina" />)}
      <span className="stack tb-musica-testo">
        <span className="tb-musica-titolo">
          {l?.titolo || nomeLista || (musica.attiva ? NOME_FONTE[musica.fonte] : 'Musica della sala')}
        </span>
        <span className="tb-musica-sotto" style={musica.errore ? { color: 'var(--rosso-testo)', whiteSpace: 'normal' } : undefined}>
          {sotto}
        </span>
      </span>
      {musica.fonte === 'radio' && musica.errore && (
        <button type="button" className="btn btn-ghost" style={{ minHeight: 44, minWidth: 44, padding: '0 12px', fontSize: 13, textTransform: 'uppercase' }} onClick={() => void musica.comandi.suona()}>
          {TESTI_MUSICA.riprova}
        </button>
      )}
      {musica.attiva && (
        <>
          {l?.volume != null && (
            <>
              <button
                type="button"
                className="tb-musica-tasto"
                onClick={() => void musica.comandi.volume(l.volume! - 10)}
                aria-label="Musica più bassa"
              >
                −
              </button>
              <span className="num tb-musica-volume">{l.volume}</span>
              <button
                type="button"
                className="tb-musica-tasto"
                onClick={() => void musica.comandi.volume(l.volume! + 10)}
                aria-label="Musica più alta"
              >
                +
              </button>
            </>
          )}
          <button
            type="button"
            className="tb-musica-tasto"
            onClick={() => void musica.comandi.indietro()}
            disabled={!l || musica.fonte === 'radio'}
            aria-label="Brano precedente"
          >
            <Prec />
          </button>
          <button
            type="button"
            className="tb-musica-tasto"
            onClick={() => void (suonando ? musica.comandi.pausa() : musica.comandi.suona())}
            aria-label={suonando ? 'Metti in pausa la musica' : 'Fai partire la musica'}
          >
            {suonando ? <Ferma /> : <Suona />}
          </button>
          <button
            type="button"
            className="tb-musica-tasto"
            onClick={() => void musica.comandi.avanti()}
            disabled={!l || musica.fonte === 'radio'}
            aria-label="Brano successivo"
          >
            <Succ />
          </button>
        </>
      )}
      {liste.length > 0 && (
        <button
          type="button"
          className="tb-musica-tasto"
          data-on={aperte}
          onClick={() => setAperte((a) => !a)}
          aria-expanded={aperte}
          aria-label="Le liste della sala"
        >
          <Liste />
        </button>
      )}

      <button type="button" className="tb-musica-tasto" onClick={onSpegni} aria-label="Spegni la musica e nascondi il lettore">
        <Spegni />
      </button>

      {aperte && (
        <div className="tb-liste" role="dialog" aria-label="La musica della sala">
          <span className="tb-etichetta">LA MUSICA DELLA SALA</span>
          {usate.length > 0 && (
            <div className="tb-filtro" role="group" aria-label="Disciplina">
              <button type="button" className="tb-filtro-tasto" aria-pressed={filtro === null} onClick={() => setDisciplina(null)}>
                TUTTE
              </button>
              {usate.map((d) => (
                <button key={d.id} type="button" className="tb-filtro-tasto" aria-pressed={filtro === d.id} onClick={() => setDisciplina(d.id)}>
                  {d.nome.toUpperCase()}
                </button>
              ))}
            </div>
          )}
          {dellaDisciplina(liste, filtro).map((x) => {
            const fonte = fonteDelLink(x.link)
            const nomeDisc = nomeDisciplina(x.disciplina, discipline)
            const spenta = !fonte || (fonte === 'spotify' && !spotifyCollegato)
            return (
              <button
                key={x.id}
                type="button"
                className="tb-lista"
                aria-pressed={scelta === x.id}
                disabled={spenta}
                onClick={() => {
                  onScegli(x)
                  setAperte(false)
                }}
              >
                <span className="stack grow" style={{ gap: 2, minWidth: 0 }}>
                  <span className="ob tb-lista-nome">{x.nome.toUpperCase()}</span>
                  <span className="tb-musica-sotto">
                    {fonte === 'spotify' && !spotifyCollegato
                      ? 'Spotify non è collegato su questo tablet'
                      : fonte
                        ? `${fonte === 'radio' ? 'Radio' : `Playlist ${NOME_FONTE[fonte]}`}${x.salaId ? '' : ' · tutte le sale'}${nomeDisc ? ` · ${nomeDisc}` : ''}`
                        : 'Link non valido'}
                  </span>
                </span>
              </button>
            )
          })}
          <button
            type="button"
            className="tb-lista"
            aria-pressed={scelta === null}
            onClick={() => {
              onScegli(null)
              setAperte(false)
            }}
          >
            <span className="stack grow" style={{ gap: 2 }}>
              <span className="ob tb-lista-nome">DALLE IMPOSTAZIONI DEL TIMER</span>
              <span className="tb-musica-sotto">Quella scelta in Impostazioni › Musica</span>
            </span>
          </button>
        </div>
      )}
    </div>
  )
}

/**
 * Il posto del lettore di YouTube: 200×200, come YouTube vuole, a destra del
 * tablet sopra la barra. Il lettore vero sta fermo alla radice e ci si
 * appoggia sopra (vedi `PlayerYoutube` nel timer).
 */
export function VideoSala() {
  return (
    <aside className="tb-video" aria-label="Il lettore di YouTube">
      <PostoPlayer />
    </aside>
  )
}
