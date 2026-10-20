import { useEffect, useState } from 'react'
import type { DatiSegreteria } from '../../lib/segreteria'
import { righeSatispay } from '../../lib/satispay'
import { csvPagamenti, daIncassare, filtra, filtraResidui, inOrdine, intervalloDi, intervalloMese, METODI_A_MANO, righeDaRicevute, righeDirette, riepilogo, type RigaPagamento } from '../../lib/pagamenti'
import { dataRicevuta, euro } from '../../lib/ricevute'
import { chiaveGiorno } from '../../lib/sala'
import { Guaio, scaricaCsv, Testa, useAvviso, useCarica, useOrdina } from './comune'
import { PagamentoAperto, RegistraDaPagamenti } from './PagamentoAperto'
import { Numero } from './Presenze'
import type { Destinazione, Voce } from './Segreteria'

/** Pagamenti per pagina: l'elenco di un anno è lungo, il totale vale lo stesso su tutto il periodo. */
const PER_PAGINA = 50

type Periodo = 'mese' | 'scorso' | 'anno' | 'tutto' | 'date'

/**
 * PAGAMENTI: lo storico di tutti, dai pagamenti delle ricevute e da quelli
 * registrati a mano. Si cerca per nome o numero di ricevuta, si sceglie il
 * periodo e il modo di pagare, e il totale vale sull'intero periodo. Con CON
 * RESIDUO DA PAGARE la tabella diventa chi deve ancora pagare. Per la segreteria
 * è sola lettura: un pagamento si registra o si annulla dalla scheda della
 * persona. Con `soloNomi` (l'amministrazione, che non apre le schede) la riga si
 * apre sul pagamento, con il tasto per annullarlo, e c'è REGISTRA UN PAGAMENTO.
 */
export function Pagamenti({ d, onVai, soloNomi }: { d: DatiSegreteria; onVai?: (v: Voce, dove?: Destinazione) => void; soloNomi?: boolean }) {
  const oggi = chiaveGiorno(new Date())
  const ricevute = useCarica(() => d.ricevute(), [d])
  // Senza 54-pagamenti-diretti.sql restano le ricevute, e il guaio si dice.
  const diretti = useCarica(() => d.pagamentiDiretti(), [d])
  // Satispay dal modulo: arrivati e non ancora in una ricevuta (`righeSatispay`). Senza 73-satispay.sql, nessuno.
  const satispay = useCarica(() => d.pagamentiSatispay(), [d])
  const persone = useCarica(() => (soloNomi ? Promise.resolve([]) : d.persone()), [d, soloNomi])
  // L'amministrazione non legge le persone: di chi ha pagato ha il nome e il cognome, e nient'altro (`nomi_persone`).
  const soloIlNome = useCarica(
    async () => {
      if (!soloNomi || !ricevute.dato || !diretti.dato) return []
      return d.nomiPersone([...ricevute.dato, ...diretti.dato, ...(satispay.dato ?? [])].map((x) => x.personaId).filter((x): x is string => !!x))
    },
    [d, soloNomi, ricevute.dato, diretti.dato, satispay.dato],
  )
  // Solo per l'amministrazione, che non apre le schede: il pagamento di una riga (da annullare) e il modulo per registrarne uno.
  const { avviso, fai } = useAvviso()
  const [aperto, setAperto] = useState<RigaPagamento | null>(null)
  const [registrando, setRegistrando] = useState(false)
  const rileggi = () => {
    setAperto(null)
    setRegistrando(false)
    void ricevute.ricarica()
    void diretti.ricarica()
    void satispay.ricarica()
  }
  const [cerca, setCerca] = useState('')
  const [periodo, setPeriodo] = useState<Periodo>('anno')
  const [dal, setDal] = useState('')
  const [al, setAl] = useState('')
  const [metodo, setMetodo] = useState('')
  const [conResiduo, setConResiduo] = useState(false)
  const [senzaRicevuta, setSenzaRicevuta] = useState(false)
  const [annullati, setAnnullati] = useState(false)
  const [pagina, setPagina] = useState(0)

  const { ordina, colonna } = useOrdina<RigaPagamento, 'data' | 'chi' | 'voce' | 'metodo' | 'ricevuta' | 'importo'>({
    data: (x) => x.data,
    chi: (x) => x.chi,
    voce: (x) => x.voce,
    metodo: (x) => x.metodo,
    ricevuta: (x) => (x.ricevuta ? x.ricevuta.anno * 1_000_000 + x.ricevuta.numero : null),
    importo: (x) => x.importo,
  })

  const nomi = new Map<string, { nome: string; cognome: string; telefono?: string; email?: string; emailContatto?: string }>(((soloNomi ? soloIlNome.dato : persone.dato) ?? []).map((p) => [p.id, p] as const))
  const nomeDi = (id: string) => {
    const p = nomi.get(id)
    return p ? `${p.cognome} ${p.nome}` : '—'
  }
  const intervallo = intervalloDi(periodo, oggi, dal, al)
  const righe = inOrdine([...righeDaRicevute(ricevute.dato ?? []), ...righeDirette(diretti.dato ?? [], nomeDi), ...righeSatispay(satispay.dato ?? [], nomeDi)])
  const trovate = filtra(righe, { testo: cerca, dal: intervallo.dal, al: intervallo.al, metodo, soloSenzaRicevuta: senzaRicevuta, annullati })
  const residui = filtraResidui(daIncassare(ricevute.dato ?? []), cerca)

  // Cambiati i filtri si riparte dalla prima pagina.
  useEffect(() => setPagina(0), [cerca, periodo, dal, al, metodo, senzaRicevuta, annullati, conResiduo])

  const ordinate = ordina(trovate)
  const pagine = Math.max(1, Math.ceil(ordinate.length / PER_PAGINA))
  const qui = ordinate.slice(pagina * PER_PAGINA, (pagina + 1) * PER_PAGINA)
  const n = riepilogo(trovate, ricevute.dato ?? [])
  const caricato = ricevute.dato !== null

  const mese = new Date(`${oggi}T12:00:00`).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' }).replace(/^./, (c) => c.toUpperCase())
  const meseScorso = new Date(`${intervalloMese(oggi, -1).dal}T12:00:00`).toLocaleDateString('it-IT', { month: 'long' }).replace(/^./, (c) => c.toUpperCase())
  // L'amministrazione non apre le schede: non ha il permesso di leggerle.
  const apri = (personaId?: string) => (!soloNomi && personaId ? onVai?.('iscritti', { persona: personaId }) : undefined)
  // La riga è un pagamento da aprire (e da annullare) per l'amministrazione, una persona da aprire per la segreteria.
  const tocca = (x: RigaPagamento) => (soloNomi ? setAperto(x) : apri(x.personaId))

  return (
    <div className="stack" style={{ gap: 18 }}>
      <Testa titolo="PAGAMENTI" sotto={soloNomi ? 'Tutto quello che è stato pagato, dalle ricevute e dai pagamenti registrati a mano.' : 'Tutto quello che è stato pagato, dalle ricevute e dai pagamenti registrati a mano. Si registra e si annulla dalla scheda della persona.'} />

      {ricevute.guaio && <Guaio testo={ricevute.guaio} />}
      {diretti.guaio && <Guaio testo={diretti.guaio} />}

      {soloNomi && !registrando && !aperto && (
        <div className="row">
          <button type="button" className="sg-btn sg-btn-pieno" onClick={() => setRegistrando(true)}>
            Registra un pagamento
          </button>
        </div>
      )}
      {soloNomi && registrando && <RegistraDaPagamenti d={d} fai={fai} onFatto={rileggi} onChiudi={() => setRegistrando(false)} />}
      {soloNomi && aperto && <PagamentoAperto d={d} riga={aperto} fai={fai} onChiudi={() => setAperto(null)} onFatto={rileggi} />}

      <div className="sg-numeri sg-numeri-conti">
        <Numero titolo="INCASSATO" valore={`${euro(n.totale)} €`} sotto={periodo === 'tutto' ? 'in tutto' : 'nel periodo scelto'} />
        <Numero titolo="PAGAMENTI" valore={n.pagamenti} sotto={`${n.senzaRicevuta} senza ricevuta`} />
        <Numero titolo="CONTANTI" valore={`${euro(n.contanti)} €`} sotto={`altri modi ${euro(n.totale - n.contanti)} €`} />
        <Numero titolo="DA INCASSARE" valore={`${euro(n.daIncassare)} €`} sotto={`su ${n.ricevuteDaIncassare} ${n.ricevuteDaIncassare === 1 ? 'ricevuta' : 'ricevute'}${soloNomi ? ', di sempre' : ''}`} allarme={n.daIncassare > 0} />
      </div>

      <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
        <label htmlFor="cerca-pagamenti" className="vh">
          Cerca per nome o numero di ricevuta
        </label>
        <input id="cerca-pagamenti" className="sg-campo" type="search" placeholder="Cerca per nome o numero ricevuta" style={{ width: 360, maxWidth: '100%' }} value={cerca} onChange={(e) => setCerca(e.target.value)} />
      </div>

      <div className="row" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        {!conResiduo && (
          <>
            <button type="button" className="num sg-chip" aria-pressed={periodo === 'mese'} onClick={() => setPeriodo('mese')}>
              {mese}
            </button>
            <button type="button" className="num sg-chip" aria-pressed={periodo === 'scorso'} onClick={() => setPeriodo('scorso')}>
              {meseScorso}
            </button>
            <button type="button" className="num sg-chip" aria-pressed={periodo === 'anno'} onClick={() => setPeriodo('anno')}>
              Tutto l’anno
            </button>
            <button type="button" className="num sg-chip" aria-pressed={periodo === 'tutto'} onClick={() => setPeriodo('tutto')}>
              Tutto
            </button>
            <button type="button" className="num sg-chip" aria-pressed={periodo === 'date'} onClick={() => setPeriodo('date')}>
              Dal – al
            </button>
            {periodo === 'date' && (
              <>
                <label htmlFor="pag-dal" className="vh">
                  Dal giorno
                </label>
                <input id="pag-dal" className="sg-campo" type="date" value={dal} max={al || undefined} onChange={(e) => setDal(e.target.value)} />
                <label htmlFor="pag-al" className="vh">
                  Al giorno
                </label>
                <input id="pag-al" className="sg-campo" type="date" value={al} min={dal || undefined} onChange={(e) => setAl(e.target.value)} />
              </>
            )}
            <span aria-hidden="true" style={{ width: 2, height: 28, background: 'var(--line)' }} />
            {METODI_A_MANO.map((m) => (
              <button key={m} type="button" className="num sg-chip" aria-pressed={metodo === m} onClick={() => setMetodo(metodo === m ? '' : m)}>
                {m === 'pos' ? 'POS' : m.replace(/^./, (c) => c.toUpperCase())}
              </button>
            ))}
            <span aria-hidden="true" style={{ width: 2, height: 28, background: 'var(--line)' }} />
          </>
        )}
        <button type="button" className="num sg-chip" aria-pressed={conResiduo} onClick={() => setConResiduo(!conResiduo)}>
          Con residuo da pagare
          {n.ricevuteDaIncassare > 0 && <span className="sg-tag" data-tipo="presto" style={{ marginLeft: 8 }}>{n.ricevuteDaIncassare}</span>}
        </button>
        {!conResiduo && (
          <>
            <button type="button" className="num sg-chip" aria-pressed={senzaRicevuta} onClick={() => setSenzaRicevuta(!senzaRicevuta)}>
              Senza ricevuta
            </button>
            <button type="button" className="num sg-chip" aria-pressed={annullati} onClick={() => setAnnullati(!annullati)}>
              Annullati
            </button>
            <span className="grow" />
            <button type="button" className="sg-btn sg-btn-linea" disabled={!n.pagamenti} onClick={() => scaricaCsv(`pagamenti-${oggi}.csv`, csvPagamenti(trovate))}>
              Esporta CSV
            </button>
          </>
        )}
      </div>

      {conResiduo ? (
        <div role="table" aria-label="Chi deve ancora pagare" className="sg-tabella">
          <div role="row" className="sg-lista-testa sg-riga-residuo" data-senza-contatto={soloNomi || undefined}>
            <span role="columnheader" className="sg-etichetta">CHI</span>
            <span role="columnheader" className="sg-etichetta">RICEVUTA</span>
            <span role="columnheader" className="sg-etichetta" style={{ textAlign: 'right' }}>TOTALE</span>
            <span role="columnheader" className="sg-etichetta" style={{ textAlign: 'right' }}>PAGATO</span>
            <span role="columnheader" className="sg-etichetta" style={{ textAlign: 'right' }}>MANCA</span>
            {!soloNomi && <span role="columnheader" className="sg-etichetta">CONTATTO</span>}
          </div>
          <div className="sg-tabella-corpo">
            {caricato && residui.length === 0 && <p className="sg-sotto" style={{ padding: '12px 14px' }}>{cerca ? 'Nessuno corrisponde alla ricerca.' : 'Tutte le ricevute sono saldate.'}</p>}
            {residui.map((x) => {
              const p = x.ricevuta.personaId ? nomi.get(x.ricevuta.personaId) : undefined
              return (
                <div key={x.ricevuta.id} role="row" className="sg-riga-residuo sg-iscritto" data-senza-contatto={soloNomi || undefined} onClick={() => apri(x.ricevuta.personaId)}>
                  <span role="cell" style={{ fontSize: 15, fontWeight: 600 }}>
                    {x.ricevuta.personaId && !soloNomi ? <button type="button" className="sg-riga-apri">{x.chi}</button> : x.chi}
                    <span className="sg-sotto-nome">
                      <span>Ricevuta {x.ricevuta.numero}/{x.ricevuta.anno} · totale {euro(x.ricevuta.totale)} € · pagato {euro(x.ricevuta.totale - x.manca)} €</span>
                      {!soloNomi && <span style={{ color: p?.telefono || p?.email ? undefined : 'var(--rosso-testo)' }}>{p?.telefono ?? p?.email ?? p?.emailContatto ?? 'nessun contatto'}</span>}
                    </span>
                  </span>
                  <span role="cell" className="num" style={{ fontSize: 14, fontWeight: 700, color: 'var(--sec)' }}>{x.ricevuta.numero}/{x.ricevuta.anno}</span>
                  <span role="cell" className="num" style={{ fontSize: 16, fontWeight: 700, textAlign: 'right' }}>{euro(x.ricevuta.totale)} €</span>
                  <span role="cell" className="num" style={{ fontSize: 16, fontWeight: 700, textAlign: 'right', color: 'var(--verde-testo)' }}>{euro(x.ricevuta.totale - x.manca)} €</span>
                  <span role="cell" className="num" style={{ fontSize: 16, fontWeight: 700, textAlign: 'right', color: 'var(--giallo-testo)' }}>{euro(x.manca)} €</span>
                  {!soloNomi && (
                    <span role="cell" style={{ fontSize: 13, color: p?.telefono || p?.email ? 'var(--sec)' : 'var(--rosso-testo)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {p?.telefono ?? p?.email ?? p?.emailContatto ?? 'nessun contatto'}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
          <div className="row" style={{ padding: '10px 14px 0', gap: 14, alignItems: 'baseline' }}>
            <span className="sg-sotto grow" style={{ fontSize: 12 }}>{residui.length} {residui.length === 1 ? 'ricevuta con un residuo' : 'ricevute con un residuo'} · le annullate non ci sono</span>
            <span className="sg-etichetta">DA INCASSARE</span>
            <span className="num" style={{ fontSize: 26, fontWeight: 700, color: 'var(--giallo-testo)' }}>{euro(residui.reduce((s, x) => s + x.manca, 0))} €</span>
          </div>
        </div>
      ) : (
        <div role="table" aria-label="Pagamenti" className="sg-tabella">
          <div role="row" className="sg-lista-testa sg-riga-pagamento-tab">
            {colonna('data', 'DATA', { numeri: true })}
            {colonna('chi', 'CHI')}
            {colonna('voce', 'A COSA SERVE')}
            {colonna('metodo', 'COME')}
            {colonna('ricevuta', 'RICEVUTA')}
            {colonna('importo', 'IMPORTO', { numeri: true, destra: true })}
          </div>
          <div className="sg-tabella-corpo">
            {!caricato && !ricevute.guaio && <p className="sg-sotto" style={{ padding: '12px 14px' }}>Sto leggendo i pagamenti…</p>}
            {caricato && trovate.length === 0 && (
              <p className="sg-sotto" style={{ padding: '12px 14px' }}>
                {righe.length === 0 ? 'Nessun pagamento registrato. Compaiono qui quando fai una ricevuta o ne registri uno dalla scheda di una persona.' : 'Nessun pagamento corrisponde ai filtri.'}
              </p>
            )}
            {qui.map((x) => (
              <div key={x.id} role="row" className="sg-riga-pagamento-tab sg-iscritto" data-spento={x.annullato} onClick={() => tocca(x)}>
                <span role="cell" style={{ fontSize: 13, color: 'var(--sec)' }}>{dataRicevuta(x.data)}</span>
                <span role="cell" style={{ fontSize: 15, fontWeight: 600 }}>
                  {x.personaId || soloNomi ? <button type="button" className="sg-riga-apri">{x.chi}</button> : x.chi}
                  <span className="sg-sotto-nome">
                    <span>{dataRicevuta(x.data)} · {x.voce} · {x.metodo}{x.ricevuta ? ` · ${x.ricevuta.numero}/${x.ricevuta.anno}` : ''}</span>
                    {!x.ricevuta && <span className="num sg-tag">Senza ricevuta</span>}
                    {x.annullato && <span className="num sg-tag" data-tipo="manca">Annullato</span>}
                  </span>
                </span>
                <span role="cell" style={{ fontSize: 13, color: 'var(--sec)' }}>
                  {x.voce}
                  {!x.ricevuta && <span className="num sg-tag" style={{ marginLeft: 8 }}>Senza ricevuta</span>}
                  {x.annullato && <span className="num sg-tag" data-tipo="manca" style={{ marginLeft: 8 }}>Annullato</span>}
                </span>
                <span role="cell" style={{ fontSize: 13, color: 'var(--sec)' }}>{x.metodo}</span>
                <span role="cell" className="num" style={{ fontSize: 14, fontWeight: 700, color: 'var(--sec)' }}>{x.ricevuta ? `${x.ricevuta.numero}/${x.ricevuta.anno}` : '—'}</span>
                <span role="cell" className="num" style={{ fontSize: 16, fontWeight: 700, textAlign: 'right', textDecoration: x.annullato ? 'line-through' : undefined, color: x.annullato ? 'var(--dim)' : 'var(--verde-testo)' }}>
                  {euro(x.importo)} €
                </span>
              </div>
            ))}
          </div>
          <div className="row" style={{ padding: '10px 14px 0', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="sg-sotto grow" style={{ fontSize: 12 }}>
              {trovate.length} {trovate.length === 1 ? 'pagamento' : 'pagamenti'} · pagina {pagina + 1} di {pagine}
            </span>
            <button type="button" className="num sg-chip" disabled={pagina === 0} onClick={() => setPagina(pagina - 1)}>
              ‹ Prima
            </button>
            <button type="button" className="num sg-chip" disabled={pagina + 1 >= pagine} onClick={() => setPagina(pagina + 1)}>
              Dopo ›
            </button>
            <span className="sg-etichetta">TOTALE DEL PERIODO</span>
            <span className="num" style={{ fontSize: 26, fontWeight: 700 }}>{euro(n.totale)} €</span>
          </div>
        </div>
      )}
      {avviso}
    </div>
  )
}
