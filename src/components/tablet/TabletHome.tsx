import { Fragment } from 'react'
import type { DatiTablet, LezioneSala } from '../../lib/tablet'
import { contoSala, gruppiGiornata, lezioniDellaHome, REGOLE } from '../../lib/tablet'
import { chiaveGiorno, giornoPerEsteso, oraDi } from '../../lib/sala'
import { Lucchetto, Recupero } from '../Icons'
import { EtichettaAttivita } from '../ds'
import { Guaio, orario, Riquadro } from './comune'
import { Kanji } from '../Kanji'
import { AppelloVeloce } from './AppelloVeloce'

/**
 * Quello che il tablet mostra quando nessuno lo tocca.
 *
 * A sinistra la lezione in cui ci si segna adesso: la card è un tasto che apre
 * l'appello intero, e sotto ci sono i nomi da toccare; a destra la giornata
 * della sala a gruppi, e in fondo il recupero. Chi entra deve capire da lontano
 * se è il suo turno. Il timer, la musica e l'uscita stanno nella barra in basso
 * e nella testata, che sono del tablet e non di questa schermata.
 */
export function TabletHome({
  d,
  adesso,
  lezioni,
  guaio,
  onSegna,
  onRecupero,
  onPin,
  onCambiato,
}: {
  d: DatiTablet
  adesso: Date
  lezioni: LezioneSala[] | null
  guaio: string | null
  onSegna: (l: LezioneSala) => void
  onRecupero: () => void
  onPin: () => void
  /** Un tocco sui nomi è arrivato al server: i conti vanno riletti. */
  onCambiato?: () => void
}) {
  const oggi = chiaveGiorno(adesso)
  const diOggi = (lezioni ?? []).filter((l) => chiaveGiorno(new Date(l.inizio)) === oggi && l.stato !== 'annullata')
  const { aperte, piuTardi, finite, prossima } = lezioniDellaHome(lezioni ?? [], adesso)
  // `['--tinta' as string]`: lo style di React non conosce le variabili CSS, e la chiave va dichiarata stringa.

  return (
    <div className="tb-corpo tb-home">
      <div className="tb-colonna">
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
            Le lezioni di questa sala sono tutte passate. Chi si è dimenticato di segnarsi usa TI SEI DIMENTICATO DI SEGNARTI?.
          </Riquadro>
        )}

        {piuTardi && (
          <div className="tb-aperta" style={{ ['--tinta' as string]: piuTardi.colore ?? 'var(--blu)' }}>
            <div className="tb-aperta-testo">
              <span className="attivita-quando">
                <span className="num tb-orario">{orario(piuTardi)}</span>
                <EtichettaAttivita nome={piuTardi.attivita} grande />
              </span>
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

        {aperte.map((l) => (
          <Fragment key={l.id}>
            <div id={`lezione-${l.id}`} className="tb-aperta tb-aperta-lezione" style={{ ['--tinta' as string]: l.colore ?? 'var(--blu)' }}>
              <button type="button" className="tb-aperta-testo" aria-label={`Apri l'appello: ${l.corso}`} onClick={() => onSegna(l)}>
                <span className="attivita-quando">
                  <span className="num tb-orario">{orario(l)}</span>
                  <EtichettaAttivita nome={l.attivita} grande />
                </span>
                <span className="ob tb-aperta-nome">{l.corso.toUpperCase()}</span>
                <span className="tb-sotto chi-kanji" style={{ gap: 10 }}>
                  <Kanji segni={l.kanji} medio />
                  <span>{[l.istruttori, `${contoSala(l).presenti} ${contoSala(l).presenti === 1 ? 'segnato' : 'segnati'} su ${l.iscritti}`].filter(Boolean).join(' · ')}</span>
                </span>
              </button>
              <button type="button" className="tb-btn tb-btn-linea" onClick={onPin}>
                <Lucchetto />
                AREA ISTRUTTORE
              </button>
            </div>
            <AppelloVeloce d={d} lezione={l} onCambiato={onCambiato} />
          </Fragment>
        ))}

        <div className="grow" />
        {/* Con una lezione aperta sta nella sua card. */}
        {!aperte.length && (
          <div className="tb-barra">
            <button type="button" className="tb-btn tb-btn-linea" onClick={onPin}>
              <Lucchetto />
              AREA ISTRUTTORE
            </button>
          </div>
        )}
      </div>

      <aside className="tb-colonna tb-giornata">
        {gruppiGiornata(diOggi, adesso).map((g) => (
          <Fragment key={g.fase}>
            <span className="tb-etichetta tb-gruppo">{g.titolo}</span>
            {g.lezioni.map((l) => {
              // Con due lezioni aperte la lista dei nomi è una sola colonna che scorre: la riga porta alla card giusta.
              const vaAllaCard = g.fase === 'aperta' && aperte.length > 1
              const Riga = vaAllaCard ? 'button' : 'div'
              return (
              <Riga
                key={l.id}
                type={vaAllaCard ? 'button' : undefined}
                className="tb-giornata-riga"
                data-fase={g.fase}
                onClick={vaAllaCard ? () => document.getElementById(`lezione-${l.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }) : undefined}
              >
                <span className="tb-tacca" style={{ background: l.colore ?? 'var(--blu)' }} />
                <span className="stack grow" style={{ gap: 2, minWidth: 0 }}>
                  <span className="ob" style={{ fontSize: 19, fontWeight: 700, letterSpacing: '0.03em', textWrap: 'balance' }}>{l.corso.toUpperCase()}</span>
                  <span className="attivita-quando">
                    <span className="num" style={{ fontSize: 16, fontWeight: 700, color: 'var(--dim)', flexShrink: 0 }}>{orario(l)}</span>
                    <EtichettaAttivita nome={l.attivita} grande />
                  </span>
                </span>
                <Kanji segni={l.kanji} />
                <span className="num tb-fase">{g.etichetta}</span>
              </Riga>
              )
            })}
          </Fragment>
        ))}
        {lezioni !== null && diOggi.length === 0 && <span className="tb-nota">Nessuna lezione.</span>}
        <div className="grow" />
        <button type="button" className="tb-btn tb-btn-linea" style={{ borderColor: 'var(--giallo)' }} onClick={onRecupero}>
          <Recupero />
          TI SEI DIMENTICATO DI SEGNARTI?
        </button>
      </aside>
    </div>
  )
}
