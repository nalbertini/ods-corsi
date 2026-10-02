import { useMemo, useState } from 'react'
import type { DatiSegreteria, PresenzaIstruttoreSeg } from '../../lib/segreteria'
import type { StatoPresenzaIstruttore } from '../../lib/tablet'
import { chiaveGiorno, giornoPerEsteso, oraDi } from '../../lib/sala'
import { mesi } from './Presenze'
import { Guaio, Testa, useAvviso, useCarica } from './comune'

const quando = (iso: string) => `${giornoPerEsteso(chiaveGiorno(new Date(iso)))}, ${oraDi(iso)}`
const perNome = (a: string, b: string) => a.localeCompare(b, 'it')

/**
 * Gli istruttori entrati col PIN sul tablet di una sala durante una lezione,
 * in elenco dalla lezione più recente, filtrati per mese, corso, istruttore e
 * stato.
 *
 * Chi era previsto su quella lezione (chi insegna il corso, o il sostituto)
 * ha la presenza confermata da sé. Chi non lo era sta qui da confermare: la
 * segreteria guarda chi è, che lezione era e chi doveva farla, e la conferma
 * o la rifiuta. Si può ripensarci anche dopo.
 */
export function PresenzeIstruttori({ d, onCambiato }: { d: DatiSegreteria; onCambiato?: () => void }) {
  const periodi = useMemo(mesi, [])
  // '' è «tutti i mesi»: i dodici del menu.
  const [periodo, setPeriodo] = useState(periodi[0].chiave)
  const [corso, setCorso] = useState('')
  const [istruttore, setIstruttore] = useState('')
  const [stato, setStato] = useState<StatoPresenzaIstruttore | ''>('')
  const m = periodi.find((x) => x.chiave === periodo)
  // Si leggono per giorni all'indietro: fino al primo del mese scelto, e un giorno in più.
  // Quelle da confermare arrivano sempre, anche più vecchie.
  const dal = m?.da ?? periodi[periodi.length - 1].da
  const giorni = Math.ceil((Date.now() - dal.getTime()) / 86_400_000) + 1
  const elenco = useCarica(() => d.presenzeIstruttori(giorni), [d, giorni])
  const { avviso, fai, lavora } = useAvviso()

  const tutte = elenco.dato ?? []
  const nelMese = m
    ? tutte.filter((x) => {
        const g = chiaveGiorno(new Date(x.inizio))
        return g >= chiaveGiorno(m.da) && g <= chiaveGiorno(m.a)
      })
    : tutte
  // I menu offrono solo corsi e istruttori che nel mese ci sono.
  const corsi = [...new Set(nelMese.map((x) => x.corso))].sort(perNome)
  const istruttori = [...new Map(nelMese.map((x) => [x.personaId, x.nome])).entries()].sort((a, b) => perNome(a[1], b[1]))
  const lista = nelMese
    .filter((x) => (!corso || x.corso === corso) && (!istruttore || x.personaId === istruttore) && (!stato || x.stato === stato))
    .sort((a, b) => b.inizio.localeCompare(a.inizio) || perNome(a.nome, b.nome))

  const daConfermare = tutte.filter((x) => x.stato === 'da_confermare').length
  const fuori = daConfermare - nelMese.filter((x) => x.stato === 'da_confermare').length
  const conte = {
    confermate: lista.filter((x) => x.stato === 'confermata').length,
    daConfermare: lista.filter((x) => x.stato === 'da_confermare').length,
  }

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
          daConfermare === 1
            ? 'Una presenza da confermare.'
            : daConfermare
              ? `${daConfermare} presenze da confermare.`
              : 'Nessuna presenza da confermare.'
        }
      />

      <div role="group" aria-label="Filtri" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <label htmlFor="mese-pi" className="vh">
          Mese
        </label>
        <select
          id="mese-pi"
          className="sg-campo"
          value={periodo}
          onChange={(e) => {
            // Un corso o un istruttore che nel mese nuovo non c'è sparirebbe
            // dal menu pur continuando a filtrare: si riparte da tutti.
            setPeriodo(e.target.value)
            setCorso('')
            setIstruttore('')
          }}
        >
          {periodi.map((x) => (
            <option key={x.chiave} value={x.chiave}>
              {x.nome}
            </option>
          ))}
          <option value="">Tutti i mesi</option>
        </select>
        <label htmlFor="corso-pi" className="vh">
          Corso
        </label>
        <select id="corso-pi" className="sg-campo" value={corso} onChange={(e) => setCorso(e.target.value)}>
          <option value="">Tutti i corsi</option>
          {corsi.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <label htmlFor="istr-pi" className="vh">
          Istruttore
        </label>
        <select id="istr-pi" className="sg-campo" value={istruttore} onChange={(e) => setIstruttore(e.target.value)}>
          <option value="">Tutti gli istruttori</option>
          {istruttori.map(([id, nome]) => (
            <option key={id} value={id}>
              {nome}
            </option>
          ))}
        </select>
        <label htmlFor="stato-pi" className="vh">
          Stato
        </label>
        <select id="stato-pi" className="sg-campo" value={stato} onChange={(e) => setStato(e.target.value as StatoPresenzaIstruttore | '')}>
          <option value="">Tutti gli stati</option>
          <option value="da_confermare">Da confermare</option>
          <option value="confermata">Confermate</option>
          <option value="rifiutata">Rifiutate</option>
        </select>
      </div>

      <p className="sg-sotto" style={{ maxWidth: 760, margin: 0 }}>
        Quando un istruttore mette il suo PIN sul tablet di una sala durante una lezione, gli si segna la presenza. Se era previsto su quella lezione è
        confermata da sola; se no arriva qui, e la conferma la segreteria.
      </p>

      {elenco.dato !== null && (
        <p className="sg-sotto" style={{ margin: 0 }}>
          {lista.length === 1 ? 'Una presenza' : `${lista.length} presenze`} in elenco: {conte.confermate}{' '}
          {conte.confermate === 1 ? 'confermata' : 'confermate'}, {conte.daConfermare} da confermare.
          {fuori > 0 && (
            <>
              {' '}
              {fuori === 1 ? 'Un’altra da confermare è' : `Altre ${fuori} da confermare sono`} in un altro mese:{' '}
              <button
                type="button"
                className="sg-link"
                onClick={() => {
                  setPeriodo('')
                  setStato('da_confermare')
                }}
              >
                vedile tutte
              </button>
              .
            </>
          )}
        </p>
      )}

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
              {nelMese.length ? 'Nessuna presenza con questi filtri.' : `Nessun istruttore è entrato col PIN durante una lezione ${m ? `in ${m.nome.toLowerCase()}` : 'nell’ultimo anno'}.`}
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
