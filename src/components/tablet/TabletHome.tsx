import type { LezioneSala } from '../../lib/tablet'
import { fase, REGOLE } from '../../lib/tablet'
import { TIMER } from '../../lib/aree'
import { chiaveGiorno, giornoPerEsteso, oraDi } from '../../lib/sala'
import { Cronometro, Lucchetto, Recupero } from '../Icons'
import { Guaio, orario, Riquadro } from './comune'
import { VERSIONE, VERSIONE_ESTESA } from '../../lib/versione'

const ETICHETTA = { finita: 'FINITA', 'in corso': 'IN CORSO', aperta: 'SI SEGNA ORA', dopo: 'PIÙ TARDI' } as const

/**
 * Quello che il tablet mostra quando nessuno lo tocca.
 *
 * A sinistra la lezione in cui ci si segna adesso, con un tasto grande quanto
 * una mano; a destra la giornata della sala. Chi entra deve capire da lontano
 * se è il suo turno.
 */
export function TabletHome({
  sala,
  adesso,
  lezioni,
  guaio,
  onSegna,
  onRecupero,
  onPin,
}: {
  sala: string
  adesso: Date
  lezioni: LezioneSala[] | null
  guaio: string | null
  onSegna: (l: LezioneSala) => void
  onRecupero: () => void
  onPin: () => void
}) {
  const oggi = chiaveGiorno(adesso)
  const diOggi = (lezioni ?? []).filter((l) => chiaveGiorno(new Date(l.inizio)) === oggi && l.stato !== 'annullata')
  const conFase = diOggi.map((l) => ({ l, f: fase(l, adesso) }))
  const aperte = conFase.filter((x) => x.f === 'aperta')
  const inCorso = conFase.filter((x) => x.f === 'in corso')
  const finite = diOggi.length > 0 && conFase.every((x) => x.f === 'finita')
  const prossima = (lezioni ?? []).find((l) => chiaveGiorno(new Date(l.inizio)) > oggi && l.stato !== 'annullata')

  const titolo = aperte.length ? 'SI SEGNA ADESSO' : inCorso.length ? 'IN QUESTO MOMENTO' : 'OGGI'

  return (
    <>
      <div className="tb-corpo tb-home">
        <div className="tb-colonna">
          <span className="tb-etichetta">{titolo}</span>

          {guaio && <Guaio titolo="CALENDARIO NON LETTO" testo={guaio} />}
          {!guaio && lezioni === null && <p className="tb-nota">Sto leggendo il calendario…</p>}

          {lezioni !== null && diOggi.length === 0 && (
            <Riquadro titolo="OGGI QUI NON CI SONO CORSI">
              {prossima
                ? `La prossima lezione è ${giornoPerEsteso(chiaveGiorno(new Date(prossima.inizio)))} alle ${oraDi(prossima.inizio)}: ${prossima.corso}${prossima.istruttori ? `, con ${prossima.istruttori}` : ''}.`
                : 'Nei prossimi giorni non ci sono lezioni in calendario.'}
            </Riquadro>
          )}
          {finite && (
            <Riquadro titolo="PER OGGI QUI È FINITO">
              Le lezioni di questa sala sono tutte passate. Chi si è dimenticato di segnarsi lo fa qui sotto.
            </Riquadro>
          )}

          {aperte.map(({ l }) => (
            <div key={l.id} className="tb-aperta" style={{ ['--tinta' as string]: l.colore ?? 'var(--blu)' }}>
              <div className="tb-aperta-testo">
                <span className="num tb-orario">{orario(l)}</span>
                <span className="ob tb-aperta-nome">{l.corso.toUpperCase()}</span>
                <span className="tb-sotto">
                  {[l.istruttori, `${l.presenti} ${l.presenti === 1 ? 'segnato' : 'segnati'} su ${l.iscritti}`].filter(Boolean).join(' · ')}
                </span>
              </div>
              <button type="button" className="ob tb-btn-segna" onClick={() => onSegna(l)}>
                SEGNA LA PRESENZA
              </button>
            </div>
          ))}

          {inCorso.map(({ l }) => (
            <div key={l.id} className="tb-incorso" style={{ ['--tinta' as string]: l.colore ?? 'var(--blu)' }}>
              <span className="num tb-orario" style={{ whiteSpace: 'nowrap' }}>{orario(l)}</span>
              <span className="ob grow" style={{ fontSize: 24, fontWeight: 700, letterSpacing: '0.03em' }}>{l.corso.toUpperCase()}</span>
              <span className="tb-sotto" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                In corso: le presenze
                <br />
                le segna l'istruttore
              </span>
            </div>
          ))}

          <div className="grow" />
          <span className="tb-nota">
            Si segna da {REGOLE.primaMin} minuti prima dell'inizio a {REGOLE.dopoMin} minuti dopo. Qui compaiono solo nome e
            iniziale del cognome.
          </span>
        </div>

        <aside className="tb-colonna tb-giornata">
          <span className="tb-etichetta">OGGI IN QUESTA SALA</span>
          {conFase.map(({ l, f }) => (
            <div key={l.id} className="tb-giornata-riga" data-fase={f}>
              <span className="tb-tacca" style={{ background: l.colore ?? 'var(--blu)' }} />
              <span className="stack grow" style={{ gap: 2, minWidth: 0 }}>
                <span className="ob" style={{ fontSize: 19, fontWeight: 700, letterSpacing: '0.03em' }}>{l.corso.toUpperCase()}</span>
                <span className="num" style={{ fontSize: 14, fontWeight: 700, color: 'var(--dim)' }}>{orario(l)}</span>
              </span>
              <span className="num tb-fase">{ETICHETTA[f]}</span>
            </div>
          ))}
          {lezioni !== null && diOggi.length === 0 && <span className="tb-nota">Nessuna lezione.</span>}
        </aside>
      </div>

      <footer className="tb-piede">
        <button type="button" className="tb-btn tb-btn-linea" style={{ borderColor: 'var(--giallo)' }} onClick={onRecupero}>
          <Recupero />
          TI SEI DIMENTICATO DI SEGNARTI?
        </button>
        <button type="button" className="tb-btn tb-btn-linea" onClick={onPin}>
          <Lucchetto />
          AREA ISTRUTTORE
        </button>
        {/* Il timer è un'app a sé: si apre al suo indirizzo, e la sua voce
            CORSI riporta qui, perché la radice su un tablet riapre il tablet. */}
        <a className="tb-btn tb-btn-linea" href={TIMER}>
          <Cronometro />
          TIMER
        </a>
        <span className="grow" />
        <span className="tb-nota" title={VERSIONE_ESTESA}>
          Tablet di sala · {sala} · {VERSIONE}
        </span>
      </footer>
    </>
  )
}
