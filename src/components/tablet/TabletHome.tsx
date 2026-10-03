import type { LezioneSala } from '../../lib/tablet'
import { fase, REGOLE } from '../../lib/tablet'
import { chiaveGiorno, giornoPerEsteso, oraDi } from '../../lib/sala'
import { Cronometro, Lucchetto, Recupero } from '../Icons'
import type { TimerPronto } from '../../../timer/src/lib/incorporato'
import { Guaio, orario, Riquadro } from './comune'
import { Kanji } from '../Kanji'
import { VERSIONE, VERSIONE_ESTESA } from '../../lib/versione'

const ETICHETTA = { finita: 'FINITA', aperta: 'SI SEGNA ORA', dopo: 'PIÙ TARDI' } as const

/**
 * Quello che il tablet mostra quando nessuno lo tocca.
 *
 * A sinistra la lezione in cui ci si segna adesso, con un tasto grande quanto
 * una mano; a destra la giornata della sala. Chi entra deve capire da lontano
 * se è il suo turno. Il timer e la musica stanno nella barra in basso, che è
 * del tablet e non di questa schermata; sotto la lezione aperta ci sono però i
 * suoi timer, ognuno pronto con AVVIA: quelli scelti per la lezione in I MIEI
 * TIMER, o se non ce ne sono quelli del corso.
 */
export function TabletHome({
  sala,
  adesso,
  lezioni,
  guaio,
  onSegna,
  onRecupero,
  onPin,
  onEsci,
  timer,
  onAvviaTimer,
  onVaiTimer,
}: {
  sala: string
  adesso: Date
  lezioni: LezioneSala[] | null
  guaio: string | null
  onSegna: (l: LezioneSala) => void
  onRecupero: () => void
  onPin: () => void
  /** Esce dal tablet: col PIN di un istruttore e una conferma. */
  onEsci: () => void
  /** I timer della lezione aperta: `pronto` nullo se né la lezione né il corso ne hanno. */
  timer?: { lezioneId: string; pronto: TimerPronto | null; inCorso: boolean } | null
  onAvviaTimer?: (id: string) => void
  onVaiTimer?: () => void
}) {
  const oggi = chiaveGiorno(adesso)
  const diOggi = (lezioni ?? []).filter((l) => chiaveGiorno(new Date(l.inizio)) === oggi && l.stato !== 'annullata')
  const conFase = diOggi.map((l) => ({ l, f: fase(l, adesso) }))
  // Al cambio lezione, in cima quella che comincia: chi arriva adesso viene per lei.
  const aperte = conFase.filter((x) => x.f === 'aperta').sort((a, b) => b.l.inizio.localeCompare(a.l.inizio))
  const finite = diOggi.length > 0 && conFase.every((x) => x.f === 'finita')
  const prossima = (lezioni ?? []).find((l) => chiaveGiorno(new Date(l.inizio)) > oggi && l.stato !== 'annullata')
  // Nessuna aperta ma una più tardi: la mattina, o fra due lezioni. Chi passa
  // deve sapere che la sala non è chiusa, e da che ora ci si segna.
  const piuTardi = aperte.length ? null : (conFase.find((x) => x.f === 'dopo')?.l ?? null)

  // Senza lezioni da qui a stasera il riquadro sotto dice già tutto, e a
  // destra c'è OGGI IN QUESTA SALA: un altro OGGI sarebbe di troppo.
  const titolo = aperte.length ? 'SI SEGNA ADESSO' : piuTardi ? 'PROSSIMA LEZIONE' : null

  return (
    <div className="tb-corpo tb-home">
      <div className="tb-colonna">
        {titolo && <span className="tb-etichetta">{titolo}</span>}

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

        {piuTardi && (
          <div className="tb-aperta" style={{ ['--tinta' as string]: piuTardi.colore ?? 'var(--blu)' }}>
            <div className="tb-aperta-testo">
              <span className="num tb-orario">{orario(piuTardi)}</span>
              <span className="ob tb-aperta-nome">{piuTardi.corso.toUpperCase()}</span>
              {piuTardi.istruttori && (
                <span className="tb-sotto chi-kanji" style={{ gap: 10 }}>
                  <Kanji segni={piuTardi.kanji} medio />
                  <span>{piuTardi.istruttori}</span>
                </span>
              )}
            </div>
            <div className="tb-dalle">
              <span className="tb-etichetta">SI SEGNA DALLE</span>
              <span className="num tb-dalle-ora">{oraDi(new Date(Date.parse(piuTardi.inizio) - REGOLE.primaMin * 60_000).toISOString())}</span>
            </div>
          </div>
        )}

        {aperte.map(({ l }) => (
          <div key={l.id} className="tb-aperta" style={{ ['--tinta' as string]: l.colore ?? 'var(--blu)' }}>
            <div className="tb-aperta-testo">
              <span className="num tb-orario">{orario(l)}</span>
              <span className="ob tb-aperta-nome">{l.corso.toUpperCase()}</span>
              <span className="tb-sotto chi-kanji" style={{ gap: 10 }}>
                <Kanji segni={l.kanji} medio />
                <span>{[l.istruttori, `${l.presenti} ${l.presenti === 1 ? 'segnato' : 'segnati'} su ${l.iscritti}`].filter(Boolean).join(' · ')}</span>
              </span>
            </div>
            <button type="button" className="ob tb-btn-segna" onClick={() => onSegna(l)}>
              SEGNA LA PRESENZA
            </button>
            {timer?.lezioneId === l.id &&
              timer.pronto?.timer.map((t, i) => (
                <div key={t.id} className="tb-pronto" data-seguito={i > 0 || undefined}>
                  <Cronometro size={30} />
                  <span className="stack grow" style={{ gap: 2, minWidth: 0 }}>
                    {i === 0 && (
                      <span className="num tb-pronto-da">
                        {timer.pronto!.da === 'lezione'
                          ? timer.pronto!.timer.length > 1 ? 'I TIMER DI QUESTA LEZIONE' : 'IL TIMER DI QUESTA LEZIONE'
                          : timer.pronto!.timer.length > 1 ? 'I TIMER DEL CORSO' : 'IL TIMER DEL CORSO'}
                      </span>
                    )}
                    <span className="ob tb-pronto-nome">{t.nome.toUpperCase()}</span>
                  </span>
                  {timer.inCorso ? (
                    i === 0 && (
                      <button type="button" className="ob tb-btn-timer tb-btn-timer-linea" onClick={onVaiTimer}>
                        IN CORSO · VEDI
                      </button>
                    )
                  ) : (
                    <button type="button" className="ob tb-btn-timer" onClick={() => onAvviaTimer?.(t.id)}>
                      ▶ AVVIA
                    </button>
                  )}
                </div>
              ))}
          </div>
        ))}

        <div className="grow" />
        <div className="tb-barra" style={{ flexWrap: 'wrap', gap: 12 }}>
          <button type="button" className="tb-btn tb-btn-linea" style={{ borderColor: 'var(--giallo)' }} onClick={onRecupero}>
            <Recupero />
            TI SEI DIMENTICATO DI SEGNARTI?
          </button>
          <button type="button" className="tb-btn tb-btn-linea" onClick={onPin}>
            <Lucchetto />
            AREA ISTRUTTORE
          </button>
        </div>
        <span className="tb-nota">
          Si segna da {REGOLE.primaMin} minuti prima dell'inizio a {REGOLE.dopoMin} minuti dopo la fine. Qui compaiono solo nome e
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
              <span className="num" style={{ fontSize: 16, fontWeight: 700, color: 'var(--dim)' }}>{orario(l)}</span>
            </span>
            <Kanji segni={l.kanji} />
            <span className="num tb-fase">{ETICHETTA[f]}</span>
          </div>
        ))}
        {lezioni !== null && diOggi.length === 0 && <span className="tb-nota">Nessuna lezione.</span>}
        <div className="grow" />
        <span className="tb-nota" title={VERSIONE_ESTESA}>
          Tablet di sala · {sala} · {VERSIONE}
        </span>
        <button type="button" className="tb-scollega" onClick={onEsci}>
          Esci dal tablet
        </button>
      </aside>
    </div>
  )
}
