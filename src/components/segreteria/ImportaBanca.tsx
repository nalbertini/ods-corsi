import { useMemo, useState } from 'react'
import type { DatiSegreteria } from '../../lib/segreteria'
import { NOME_CASSA_CONTO, oggiARoma, type Cassa, type RigaMovimento } from '../../lib/contabilita'
import { anteprimaBanca, datiImportBanca, leggiBanca, MASSIMO_PER_IMPORTAZIONE, ultimaImportazione, type LetturaBanca } from '../../lib/importaBanca'
import { dataRicevuta, euro } from '../../lib/ricevute'
import { chiedi, type useAvviso } from './comune'

type Fai = ReturnType<typeof useAvviso>['fai']

const soldi = (c: number) => `${euro(c)} €`
const movimenti = (n: number) => (n === 1 ? '1 movimento' : `${n} movimenti`)

/**
 * «Importa dalla banca» in MOVIMENTI: si sceglie il CSV di BancoPosta, si guarda cosa entra senza che
 * niente si scriva, si decidono i casi dubbi e solo dopo «Sì, importa» i movimenti vanno nel Conto
 * Corrente, in «Da classificare». Le regole sono in `src/lib/importaBanca.ts`.
 */
export function ImportaBanca({ d, casse, righe, fai, onRileggi, onVedi }: { d: DatiSegreteria; casse: Cassa[]; righe: RigaMovimento[]; fai: Fai; onRileggi: () => void; onVedi: () => void }) {
  const [lettura, setLettura] = useState<LetturaBanca | null>(null)
  const [scelte, setScelte] = useState<Record<string, string>>({})
  const [scritti, setScritti] = useState<number | null>(null)
  const conto = casse.find((c) => c.nome === NOME_CASSA_CONTO)
  const ultima = useMemo(() => ultimaImportazione(righe), [righe])
  const a = useMemo(() => (lettura && conto ? anteprimaBanca(lettura, righe, conto.id, oggiARoma(), scelte) : null), [lettura, righe, conto, scelte])

  const scegliFile = async (file: File | undefined) => {
    if (!file) return
    setScelte({})
    setScritti(null)
    // Un file che il browser non riesce a leggere si tratta come un file sbagliato: stesso messaggio, niente scritto.
    setLettura(leggiBanca(await file.text().catch(() => '')))
  }
  const importa = async () => {
    if (!a) return
    const dati = datiImportBanca(a)
    const si = await chiedi(
      `Scrivo ${movimenti(dati.length)} nel Conto Corrente, in «Da classificare»? ${a.daDecidere.length ? `I ${a.daDecidere.length} da decidere non entrano. ` : ''}Se cambi idea, «Annulla tutta l’importazione» li toglie in un colpo.`,
      `Sì, importa ${dati.length === 1 ? 'il movimento' : `i ${dati.length} movimenti`}`,
    )
    if (!si) return
    void fai(async () => setScritti(await d.importaMovimentiBanca(dati)), undefined, () => {
      setLettura(null)
      onRileggi()
    })
  }
  const annullaLotto = async () => {
    if (!ultima) return
    const si = await chiedi(
      `Annullo i ${ultima.conteggio} movimenti importati dalla banca insieme? Li ritrovi in «Mostra annullati». Rileggere il file non li riscrive.`,
      `Sì, annulla i ${ultima.conteggio}`,
      { pericolo: true },
    )
    if (!si) return
    void fai(async () => {
      const n = await d.annullaImportazioneBanca(ultima.creatoIl)
      setScritti(null)
      return n
    }, 'Importazione annullata', onRileggi)
  }

  const nonLeggibile = lettura && lettura.movimenti.length === 0
  const troppi = !!a && a.entrano.length > MASSIMO_PER_IMPORTAZIONE

  return (
    <section aria-label="Importa dalla banca" className="stack" style={{ gap: 18 }}>
      <span className="sg-etichetta">NIENTE SI SCRIVE FINCHÉ NON DICI SÌ</span>
      <h2 className="sg-riquadro-titolo" style={{ margin: 0 }}>IL FILE DELLA BANCA</h2>
      {!conto && <p role="alert" style={{ color: 'var(--rosso-testo)' }}>Manca la cassa Conto Corrente: creala prima di importare.</p>}

      {scritti !== null && (
        <div className="sg-riquadro stack" role="status" style={{ gap: 12, padding: '18px 20px' }}>
          <span className="sg-etichetta">IMPORTAZIONE FATTA</span>
          <b style={{ fontSize: 20 }}>{movimenti(scritti).toUpperCase()} SCRITTI</b>
          <span style={{ fontSize: 15 }}>Sono nel <b>Conto Corrente</b>, in «Da classificare»: la voce la scegli dopo, con Cambia voce. Gli incassi importati non hanno ricevuta né iscritto.</span>
          <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
            <button type="button" className="sg-btn sg-btn-pieno" onClick={onVedi}>Guarda i movimenti</button>
          </div>
        </div>
      )}

      {ultima && (
        <div className="sg-riquadro stack" style={{ gap: 10, padding: '14px 18px' }}>
          <span style={{ fontSize: 15 }}>
            L’ultima importazione ha scritto <b>{movimenti(ultima.conteggio)}</b>, dal {dataRicevuta(ultima.dal)} al {dataRicevuta(ultima.al)}.
          </span>
          <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
            <button type="button" className="sg-btn sg-btn-rosso" onClick={() => void annullaLotto()}>Annulla tutta l’importazione</button>
          </div>
        </div>
      )}

      <div className="stack" style={{ gap: 8 }}>
        <label className="sg-btn sg-btn-pieno" style={{ alignSelf: 'flex-start', cursor: 'pointer' }}>
          {lettura ? 'Scegli un altro file' : 'Scegli il file della banca'}
          <input type="file" accept=".csv,.txt,text/csv,text/plain" className="vh" onChange={(e) => { void scegliFile(e.target.files?.[0]); e.target.value = '' }} />
        </label>
        <span className="sg-sotto">Dall’home banking di BancoPosta scarica «Lista movimenti» in formato CSV. Il file resta nel tuo browser: arrivano al database solo i movimenti, senza IBAN né codice fiscale.</span>
      </div>

      {nonLeggibile && (
        <div role="alert" className="sg-riquadro stack" style={{ gap: 6, padding: '14px 18px', borderColor: 'var(--rosso-testo)' }}>
          <span className="sg-etichetta" style={{ color: 'var(--rosso-testo)' }}>QUESTO FILE NON È QUELLO GIUSTO</span>
          <span style={{ fontSize: 15 }}>{lettura.scartate[0]?.motivo ?? 'Non trovo movimenti nel file.'} Non è stato scritto niente.</span>
        </div>
      )}

      {a && lettura && !nonLeggibile && (
        <>
          <span style={{ fontSize: 15 }}>
            Il file ha <b>{movimenti(a.lette)}</b>{a.dal && a.al ? `, dal ${dataRicevuta(a.dal)} al ${dataRicevuta(a.al)}` : ''}.{' '}
            <b>{a.entrano.length} entrano</b>, <b>{a.giaImportati.length + a.coperti.length} erano già scritti</b>
            {a.daDecidere.length > 0 && <>, <b>{a.daDecidere.length} li decidi tu</b></>}. Entrano nel Conto Corrente, in «Da classificare».
          </span>
          <div className="sg-saldi" role="group" aria-label="Totali di quello che entra">
            <Totale titolo="ENTRATE CHE ENTRANO" valore={`+ ${soldi(a.totali.entrate.importo)}`} sotto={movimenti(a.totali.entrate.conteggio)} />
            <Totale titolo="USCITE CHE ENTRANO" valore={`− ${soldi(a.totali.uscite.importo)}`} sotto={movimenti(a.totali.uscite.conteggio)} />
            <Totale titolo="DIFFERENZA" valore={`${a.totali.differenza < 0 ? '− ' : '+ '}${soldi(Math.abs(a.totali.differenza))}`} sotto="confrontala col saldo della banca" />
          </div>

          {a.daDecidere.length > 0 && (
            <section aria-label="Da decidere" className="sg-riquadro stack" style={{ gap: 12, padding: '14px 18px', borderColor: 'var(--giallo-testo)' }}>
              <span className="sg-etichetta" style={{ color: 'var(--giallo-testo)' }}>{a.daDecidere.length} DA DECIDERE · NON ENTRANO FINCHÉ NON SCEGLI</span>
              <span style={{ fontSize: 15 }}>Per ognuno vedi i pagamenti già scritti che potrebbero essere lo stesso. Scegli quello giusto, oppure «Nessuno: scrivilo».</span>
              {a.daDecidere.map(({ movimento: m, candidati }) => (
                <div key={m.chiave} className="stack" style={{ gap: 8, padding: '10px 0', borderTop: '1px solid var(--line-soft)' }}>
                  <div className="row" style={{ justifyContent: 'space-between', gap: 12 }}>
                    <span><b>{dataRicevuta(m.data)}</b> · {m.descrizione}</span>
                    <b className="num">{m.tipo === 'entrata' ? '+ ' : '− '}{soldi(m.importo)}</b>
                  </div>
                  <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
                    {candidati.map((c) => (
                      <button key={c.id} type="button" className="sg-btn sg-btn-linea" onClick={() => setScelte((s) => ({ ...s, [m.chiave]: c.id }))}>
                        {c.descrizione} · {dataRicevuta(c.data)}
                      </button>
                    ))}
                    <button type="button" className="sg-btn sg-btn-pieno" onClick={() => setScelte((s) => ({ ...s, [m.chiave]: 'nessuno' }))}>Nessuno: scrivilo</button>
                  </div>
                </div>
              ))}
              {a.daDecidere.length > 1 && (
                <div><button type="button" className="sg-btn sg-btn-linea" onClick={() => setScelte((s) => ({ ...s, ...Object.fromEntries(a.daDecidere.map((x) => [x.movimento.chiave, 'nessuno'])) }))}>Nessuno è già scritto: scrivili tutti e {a.daDecidere.length}</button></div>
              )}
            </section>
          )}

          {a.avvisi.length > 0 && (
            <section aria-label="Avvisi" className="sg-riquadro stack" style={{ gap: 8, padding: '14px 18px' }}>
              <span className="sg-etichetta" style={{ color: 'var(--giallo-testo)' }}>AVVISI · ENTRANO, MA CONTROLLALI</span>
              {a.avvisi.map((v) => (
                <span key={v.tipo} style={{ fontSize: 15 }}>
                  {v.tipo === 'satispay'
                    ? <><b>{v.conteggio === 1 ? '1 versamento da Satispay' : `${v.conteggio} versamenti da Satispay`}</b> ({soldi(v.totale)}): sono incassi già contati con Satispay, se li lasci così si contano due volte. Dopo l’importazione, in MOVIMENTI, controllali uno per uno.</>
                    : <><b>{v.conteggio === 1 ? '1 versamento di contanti' : `${v.conteggio} versamenti di contanti`}</b> ({soldi(v.totale)}): controlla che non siano già nella cassa contanti.</>}
                </span>
              ))}
            </section>
          )}

          {a.scartate.length > 0 && (
            <section aria-label="Scartati" className="sg-riquadro stack" style={{ gap: 6, padding: '14px 18px' }}>
              <span className="sg-etichetta">{a.scartate.length} SCARTATI · NON ENTRANO</span>
              {a.scartate.map((s) => <span key={`${s.riga}-${s.motivo}`} style={{ fontSize: 15 }}><b>Riga {s.riga}</b> · {s.motivo}</span>)}
            </section>
          )}

          {a.coperti.length > 0 && (
            <section aria-label="Già coperti" className="sg-riquadro stack" style={{ gap: 6, padding: '14px 18px' }}>
              <span className="sg-etichetta">{a.coperti.length} GIÀ COPERTI · NON SI SCRIVONO DI NUOVO</span>
              <span className="sg-sotto">Ogni riga dice con cosa è stata abbinata. Se l’abbinamento è sbagliato, «Non è questo» la fa entrare come movimento nuovo.</span>
              {a.coperti.map(({ movimento: m, con }) => (
                <div key={m.chiave} className="row" style={{ gap: 12, alignItems: 'center', flexWrap: 'wrap', padding: '8px 0', borderTop: '1px solid var(--line-soft)' }}>
                  <span style={{ flex: '1 1 260px', fontSize: 14 }}><b>{dataRicevuta(m.data)}</b> · {m.descrizione}<br />già scritto: <b>{con.descrizione}</b> · {dataRicevuta(con.data)}</span>
                  <b className="num">{m.tipo === 'entrata' ? '+ ' : '− '}{soldi(m.importo)}</b>
                  <button type="button" className="sg-btn sg-btn-linea" onClick={() => setScelte((s) => ({ ...s, [m.chiave]: 'nessuno' }))}>Non è questo</button>
                </div>
              ))}
            </section>
          )}

          <div className="stack" style={{ gap: 8 }}>
            {troppi && <p role="alert" style={{ color: 'var(--rosso-testo)' }}>Sono più di {MASSIMO_PER_IMPORTAZIONE} movimenti nuovi: scarica dalla banca un periodo più corto e riprova.</p>}
            <span className="sg-sotto">Se rileggi lo stesso file, i movimenti già importati non si scrivono di nuovo.</span>
            <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
              <button type="button" className="sg-btn sg-btn-pieno" disabled={!a.entrano.length || troppi} onClick={() => void importa()}>
                {a.entrano.length === 1 ? 'Sì, importa il movimento' : `Sì, importa i ${a.entrano.length} movimenti`}
              </button>
              <button type="button" className="sg-btn sg-btn-linea" onClick={() => setLettura(null)}>Annulla</button>
            </div>
          </div>
        </>
      )}
    </section>
  )
}

function Totale({ titolo, valore, sotto }: { titolo: string; valore: string; sotto: string }) {
  return (
    <div className="sg-riquadro stack" style={{ gap: 2, padding: '12px 16px' }}>
      <span className="sg-etichetta">{titolo}</span>
      <b className="num" style={{ fontSize: 22 }}>{valore}</b>
      <span className="sg-sotto">{sotto}</span>
    </div>
  )
}
