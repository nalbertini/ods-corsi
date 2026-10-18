import { useState } from 'react'
import { anniDelBilancio, bilancioAnno, csvBilancio, differenza, esito, fraseBilancio, importoConMeno, nomeFileBilancio, testoConfronto } from '../../lib/bilancio'
import type { Cassa, RigaMovimento } from '../../lib/contabilita'
import type { DatiSegreteria } from '../../lib/segreteria'
import { dataRicevuta } from '../../lib/ricevute'
import { scaricaCsv, type useAvviso } from './comune'
import { Numero } from './Presenze'

type Fai = ReturnType<typeof useAvviso>['fai']

const soldi = (c: number | null) => (c === null ? '—' : importoConMeno(c))
/** «+ 12,00 €»; un importo a zero senza segno, che non sembri un movimento. */
const conVerso = (segno: '+' | '−', c: number) => (c === 0 ? soldi(0) : `${segno} ${soldi(c)}`)
/** Gli anni che stanno in chip: l'anno di oggi e i quattro prima; gli altri, in «Altri anni». */
const ANNI_IN_CHIP = 5

/**
 * BILANCIO della CONTABILITÀ: il bilancio di un anno solare, per cassa, dalle righe dell'elenco
 * movimenti (`lib/bilancio.ts`). Sola lettura: non scrive niente e non blocca niente. Un anno
 * vecchio può cambiare solo se si annulla qualcosa dopo: per questo c'è la data di calcolo.
 */
export function Bilancio({ d, casse, righe, oggi, fai }: { d: DatiSegreteria; casse: Cassa[]; righe: RigaMovimento[]; oggi: string; fai: Fai }) {
  const anni = anniDelBilancio(righe, oggi)
  const [scelto, setScelto] = useState(anni[anni.length - 1])
  // Se l'elenco cambia e l'anno scelto non c'è più tra quelli offerti, si torna all'ultimo.
  const anno = anni.includes(scelto) ? scelto : anni[anni.length - 1]
  const b = bilancioAnno(righe, casse, anno, oggi)
  const recenti = anni.slice(-ANNI_IN_CHIP).reverse()
  const vecchi = anni.slice(0, -ANNI_IN_CHIP).reverse()
  const prima = anno - 1

  const pdf = async () => {
    const [ente, { scaricaBilancio }] = await Promise.all([d.enteRicevute(), import('../../lib/bilancioPdf')])
    await scaricaBilancio({ ente, bilancio: b, oggi })
  }

  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="row" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <button type="button" className="sg-btn sg-btn-linea" aria-label="Anno prima" disabled={anno <= anni[0]} onClick={() => setScelto(anno - 1)}>‹</button>
        <span className="num" style={{ fontSize: 28, fontWeight: 700, minWidth: 72, textAlign: 'center' }} aria-live="polite">{anno}</span>
        <button type="button" className="sg-btn sg-btn-linea" aria-label="Anno dopo" disabled={anno >= anni[anni.length - 1]} onClick={() => setScelto(anno + 1)}>›</button>
        {recenti.map((a) => (
          <button key={a} type="button" className="num sg-chip" aria-pressed={a === anno} onClick={() => setScelto(a)}>{a}</button>
        ))}
        {vecchi.length > 0 && (
          <>
            <label htmlFor="bilancio-altri-anni" className="vh">Altri anni</label>
            <select id="bilancio-altri-anni" className="sg-campo" value={vecchi.includes(anno) ? anno : ''} onChange={(e) => e.target.value && setScelto(Number(e.target.value))}>
              <option value="">Altri anni</option>
              {vecchi.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </>
        )}
      </div>

      <div className="stack" style={{ gap: 4 }}>
        <h2 className="ob" style={{ margin: 0, fontSize: 26 }}>Bilancio {anno}{b.parziale && <span className="num sg-tag" style={{ marginLeft: 12, verticalAlign: 'middle' }}>PARZIALE</span>}</h2>
        <span className="sg-sotto">{fraseBilancio(b, oggi)}</span>
        {b.parziale && <span className="sg-sotto">Il confronto è con lo stesso periodo del {prima}: dal {dataRicevuta(b.confrontoDal)} al {dataRicevuta(b.confrontoAl)}.</span>}
      </div>

      {b.vuoto ? (
        <p className="sg-sotto" role="status">Nessun movimento in questo anno.</p>
      ) : (
        <>
          {b.daClassificare && (
            <div role="status" className="sg-riquadro" style={{ borderColor: 'var(--giallo-testo)' }}>
              <span className="sg-etichetta">DA CLASSIFICARE</span>
              <span style={{ fontSize: 14 }}>
                {b.daClassificare.movimenti} {b.daClassificare.movimenti === 1 ? 'movimento' : 'movimenti'} ({soldi(b.daClassificare.uscite)} di uscite, il {b.daClassificare.quotaUscite}% delle uscite) non {b.daClassificare.movimenti === 1 ? 'ha' : 'hanno'} una voce: il dettaglio per voce non è completo.
                {b.provvisorio && ' Il risultato dell’anno non è affidabile finché non si classificano.'}
              </span>
              <span className="sg-sotto">Si classificano da MOVIMENTI.</span>
            </div>
          )}

          {b.sovrapposizione && (
            <div role="status" className="sg-riquadro" style={{ borderColor: 'var(--giallo-testo)' }}>
              <span className="sg-etichetta">POSSIBILE DOPPIO CONTEGGIO</span>
              <span style={{ fontSize: 14 }}>
                Dal {dataRicevuta(b.sovrapposizione.dal)} al {dataRicevuta(b.sovrapposizione.al)} ci sono incassi sia dello storico importato sia delle ricevute e dei pagamenti dell’app: lo stesso incasso può essere contato due volte. Controlla i movimenti di quei giorni.
              </span>
            </div>
          )}

          <div className="sg-numeri-tre">
            <Numero titolo="ENTRATE" valore={soldi(b.entrate)} sotto={testoConfronto(b, b.prima?.entrate, b.entrate)} />
            <Numero titolo="USCITE" valore={soldi(b.uscite)} sotto={testoConfronto(b, b.prima?.uscite, b.uscite)} />
            <Numero
              titolo={b.provvisorio ? 'RISULTATO · PROVVISORIO' : 'RISULTATO'}
              valore={soldi(b.risultato)}
              sotto={`${esito(b.risultato)} · ${testoConfronto(b, b.prima?.risultato, b.risultato)}`}
              allarme={b.provvisorio}
            />
          </div>

          <span className="sg-etichetta">PER VOCE</span>
          <div role="table" aria-label={`Bilancio ${anno} per voce`} className="sg-tabella">
            <div role="row" className="sg-lista-testa sg-riga-bilancio">
              <span role="columnheader" className="sg-etichetta">VOCE</span>
              <span role="columnheader" className="sg-etichetta" style={{ textAlign: 'right' }}>{anno}{b.parziale ? ` (al ${dataRicevuta(b.al).slice(0, 5)})` : ''}</span>
              <span role="columnheader" className="sg-etichetta" style={{ textAlign: 'right' }}>{prima}{b.parziale ? ' (stesso periodo)' : ''}</span>
              <span role="columnheader" className="sg-etichetta" style={{ textAlign: 'right' }}>DIFFERENZA</span>
            </div>
            <div className="sg-tabella-corpo">
              {(['entrata', 'uscita'] as const).map((tipo) => (
                <div key={tipo} role="rowgroup">
                  <div role="row" className="sg-riga-bilancio-gruppo"><span role="cell" className="sg-etichetta">{tipo === 'entrata' ? 'ENTRATE' : 'USCITE'}</span></div>
                  {b.voci.filter((v) => v.tipo === tipo).map((v) => (
                    <RigaVoce key={`${tipo}|${v.voce}`} nome={v.voce} nota={v.daClassificare ? `${v.movimenti} ${v.movimenti === 1 ? 'movimento' : 'movimenti'} senza voce` : v.aParte ? 'Chiusura di cassa, a parte dalle voci' : ''} anno={v.totale} prima={v.prima} sospesa={v.daClassificare} />
                  ))}
                  <RigaVoce nome={tipo === 'entrata' ? 'Totale entrate' : 'Totale uscite'} anno={tipo === 'entrata' ? b.entrate : b.uscite} prima={b.prima ? (tipo === 'entrata' ? b.prima.entrate : b.prima.uscite) : null} totale />
                </div>
              ))}
              <div role="row" className="sg-riga-bilancio-gruppo"><span role="cell" className="sg-etichetta">RISULTATO</span></div>
              <RigaVoce nome="Entrate meno uscite" nota={esito(b.risultato)} anno={b.risultato} prima={b.prima?.risultato ?? null} totale />
            </div>
          </div>

          <span className="sg-etichetta">SALDI DELLE CASSE</span>
          <div className="sg-numeri-tre" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
            {b.saldi.map((s) => (
              <section key={s.cassaId} className="sg-riquadro" aria-label={s.nome}>
                <span className="sg-etichetta">{s.nome.toUpperCase()}</span>
                {s.inizio === null ? (
                  <span style={{ fontSize: 14 }}>Saldo non disponibile: la cassa parte il {dataRicevuta(s.parteIl)}.</span>
                ) : (
                  <>
                    <RigaSaldo testo={s.dal ? `Saldo dal ${dataRicevuta(s.dal)} (la cassa parte qui)` : `Saldo al 1 gen ${anno}`} valore={soldi(s.inizio)} />
                    <RigaSaldo testo="Entrate" valore={conVerso('+', s.entrate)} />
                    <RigaSaldo testo="Uscite" valore={conVerso('−', s.uscite)} />
                    <RigaSaldo testo="Giroconti" valore={s.giroconti < 0 ? conVerso('−', -s.giroconti) : conVerso('+', s.giroconti)} />
                    <RigaSaldo testo={b.parziale ? `Saldo al ${dataRicevuta(b.al)}` : `Saldo al 31 dic ${anno}`} valore={soldi(s.fine)} forte />
                  </>
                )}
              </section>
            ))}
          </div>

          <div className="row" style={{ gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button type="button" className="sg-btn sg-btn-linea" onClick={() => scaricaCsv(nomeFileBilancio(anno, 'csv'), csvBilancio(b, oggi))}>Esporta CSV</button>
            <button type="button" className="sg-btn sg-btn-linea" onClick={() => void fai(pdf, 'Foglio PDF scaricato')}>Esporta PDF</button>
          </div>
          <span className="sg-sotto">CSV e PDF dicono «per cassa» e la data di calcolo; non portano nomi di iscritti né movimenti singoli.</span>
        </>
      )}
      <span className="sg-sotto">Si legge e basta. Giroconti e movimenti annullati non contano. Se qualcosa si annulla dopo, il bilancio di un anno vecchio cambia: per questo c’è la data di calcolo.</span>
    </div>
  )
}

function RigaSaldo({ testo, valore, forte }: { testo: string; valore: string; forte?: boolean }) {
  return (
    <div className="row" style={{ justifyContent: 'space-between', gap: 12, fontWeight: forte ? 700 : 400, borderTop: forte ? '1px solid var(--line-soft)' : undefined, paddingTop: forte ? 6 : 0 }}>
      <span style={{ fontSize: 14 }}>{testo}</span>
      <span className="num" style={{ fontSize: 15, fontWeight: 700 }}>{valore}</span>
    </div>
  )
}

function RigaVoce({ nome, nota, anno, prima, totale, sospesa }: { nome: string; nota?: string; anno: number | null; prima: number | null; totale?: boolean; sospesa?: boolean }) {
    return (
    <div role="row" className="sg-riga-bilancio" data-totale={!!totale} data-sospesa={!!sospesa}>
      <span role="cell" style={{ fontSize: 15, fontWeight: totale || sospesa ? 700 : 600 }}>
        {nome}
        {nota && <span className="sg-sotto-movimento">{nota}</span>}
      </span>
      <span role="cell" className="num" style={{ fontSize: 15, fontWeight: 700, textAlign: 'right' }}>{soldi(anno)}</span>
      <span role="cell" className="num" style={{ fontSize: 15, textAlign: 'right', color: 'var(--sec)' }}>{soldi(prima)}</span>
      <span role="cell" className="num" style={{ fontSize: 15, textAlign: 'right', color: 'var(--sec)' }}>{differenza(anno, prima)}</span>
    </div>
  )
}
