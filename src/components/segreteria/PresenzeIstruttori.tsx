import { useState } from 'react'
import type { DatiSegreteria, PresenzaIstruttoreSeg } from '../../lib/segreteria'
import { chiaveGiorno, giornoPerEsteso, oraDi } from '../../lib/sala'
import { Guaio, Testa, useAvviso, useCarica } from './comune'

/** Fin dove indietro si vedono quelle già confermate o rifiutate. */
const GIORNI = 60

const quando = (iso: string) => `${giornoPerEsteso(chiaveGiorno(new Date(iso)))}, ${oraDi(iso)}`

/**
 * Gli istruttori entrati col PIN sul tablet di una sala durante una lezione.
 *
 * Chi era previsto su quella lezione (chi insegna il corso, o il sostituto)
 * ha la presenza confermata da sé. Chi non lo era sta qui da confermare: la
 * segreteria guarda chi è, che lezione era e chi doveva farla, e la conferma
 * o la rifiuta. Si può ripensarci anche dopo.
 */
export function PresenzeIstruttori({ d, onCambiato }: { d: DatiSegreteria; onCambiato?: () => void }) {
  const elenco = useCarica(() => d.presenzeIstruttori(GIORNI), [d])
  const [tutte, setTutte] = useState(false)
  const { avviso, fai, lavora } = useAvviso()

  const daConfermare = (elenco.dato ?? []).filter((x) => x.stato === 'da_confermare')
  const lista = tutte ? (elenco.dato ?? []) : daConfermare

  const gestisci = (x: PresenzaIstruttoreSeg, conferma: boolean) =>
    void fai(
      () => d.gestisciPresenzaIstruttore(x.id, conferma),
      conferma ? `Presenza di ${x.nome} confermata` : `Presenza di ${x.nome} rifiutata`,
      async () => {
        await elenco.ricarica()
        onCambiato?.()
      },
    )

  return (
    <>
      <Testa
        titolo="PRESENZE ISTRUTTORI"
        sotto={
          daConfermare.length === 1
            ? 'Una presenza da confermare.'
            : daConfermare.length
              ? `${daConfermare.length} presenze da confermare.`
              : 'Nessuna presenza da confermare.'
        }
      >
        <button type="button" className="num sg-chip" aria-pressed={tutte} onClick={() => setTutte(!tutte)}>
          ANCHE QUELLE GIÀ GESTITE
        </button>
      </Testa>

      <p className="sg-sotto" style={{ maxWidth: 760, margin: 0 }}>
        Quando un istruttore mette il suo PIN sul tablet di una sala durante una lezione, gli si segna la presenza. Se era previsto su quella lezione è
        confermata da sola; se no arriva qui, e la conferma la segreteria.
      </p>

      {elenco.guaio && <Guaio testo={elenco.guaio} />}

      <div role="table" aria-label="Presenze degli istruttori" className="sg-tabella">
        <div role="row" className="sg-lista-testa sg-riga-presenza-istr">
          <span role="columnheader" className="sg-etichetta">ISTRUTTORE</span>
          <span role="columnheader" className="sg-etichetta">LEZIONE</span>
          <span role="columnheader" className="sg-etichetta">PREVISTO</span>
          <span role="columnheader" className="sg-etichetta">ENTRATO</span>
          <span role="columnheader" className="sg-etichetta" style={{ textAlign: 'right' }}>STATO</span>
        </div>
        <div className="sg-tabella-corpo">
          {elenco.dato === null && !elenco.guaio && <p className="sg-sotto" style={{ padding: '12px 14px' }}>Sto leggendo le presenze…</p>}
          {elenco.dato !== null && lista.length === 0 && (
            <p className="sg-sotto" style={{ padding: '12px 14px' }}>
              {tutte
                ? `Nessun istruttore è entrato col PIN durante una lezione negli ultimi ${GIORNI} giorni.`
                : 'Niente da confermare. Le altre si vedono con «anche quelle già gestite».'}
            </p>
          )}
          {lista.map((x) => (
            <div
              key={x.id}
              role="row"
              className="sg-riga-presenza-istr sg-presenza-istr"
              data-spento={x.stato === 'rifiutata'}
              style={{ ['--tinta' as string]: x.colore ?? 'var(--line)' }}
            >
              <span role="cell" style={{ fontSize: 15, fontWeight: 600 }}>{x.nome}</span>
              <span role="cell" className="stack" style={{ gap: 2 }}>
                <span style={{ fontSize: 15, fontWeight: 600 }}>{x.corso}</span>
                <span style={{ fontSize: 13, color: 'var(--sec)' }}>
                  {giornoPerEsteso(chiaveGiorno(new Date(x.inizio)))}, {oraDi(x.inizio)}–{oraDi(x.fine)}
                </span>
              </span>
              <span role="cell" style={{ fontSize: 13, color: 'var(--sec)' }}>{x.previsti || 'nessuno'}</span>
              <span role="cell" className="stack" style={{ gap: 2 }}>
                <span className="num" style={{ fontSize: 14 }}>{oraDi(x.entratoIl)}</span>
                {x.sala && <span style={{ fontSize: 12, color: 'var(--dim)' }}>tablet {x.sala}</span>}
              </span>
              <span role="cell" className="sg-presenza-istr-fine">
                {x.stato === 'da_confermare' ? (
                  <>
                    <button type="button" className="sg-btn sg-btn-verde" disabled={lavora} onClick={() => gestisci(x, true)}>
                      CONFERMA
                    </button>
                    <button type="button" className="sg-btn sg-btn-linea" disabled={lavora} onClick={() => gestisci(x, false)}>
                      RIFIUTA
                    </button>
                  </>
                ) : (
                  <>
                    <span className="stack" style={{ gap: 2 }}>
                      <span
                        className="num"
                        style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.12em', color: x.stato === 'confermata' ? 'var(--verde)' : 'var(--rosso)' }}
                      >
                        {x.stato === 'confermata' ? 'CONFERMATA' : 'RIFIUTATA'}
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--dim)' }}>
                        {x.gestitaIl ? `${x.gestitaDa ? `da ${x.gestitaDa}, ` : ''}${quando(x.gestitaIl)}` : x.prevista ? 'da sé: era previsto' : ''}
                      </span>
                    </span>
                    {/* Ci si ripensa: una confermata per sbaglio si rifiuta, e viceversa. */}
                    <button type="button" className="sg-link" disabled={lavora} onClick={() => gestisci(x, x.stato !== 'confermata')}>
                      {x.stato === 'confermata' ? 'Rifiuta' : 'Conferma'}
                    </button>
                  </>
                )}
              </span>
            </div>
          ))}
        </div>
      </div>
      {avviso}
    </>
  )
}
