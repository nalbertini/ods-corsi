import { useState } from 'react'
import type { DatiSegreteria } from '../../lib/segreteria'
import { elencoMovimenti, giornoChiuso, NOME_CASSA_CONTO, oggiARoma, type Cassa, type ChiusuraCassa, type MovimentoManuale, type RigaMovimento } from '../../lib/contabilita'
import { chiHaPagato, contiChiHaPagato, filtraChiHaPagato, SCARICO_FERMO, scaricoFermo } from '../../lib/satispayScarico'
import { righeDaRicevute, righeDirette, type RigaPagamento } from '../../lib/pagamenti'
import type { PagamentoSatispay } from '../../lib/satispay'
import { entratoBanca, ultimaImportazione } from '../../lib/importaBanca'
import { daClassificare, FONTI_DA_CLASSIFICARE, vistaDaClassificare, type FonteDaClassificare } from '../../lib/daClassificare'
import { dataRicevuta, euro } from '../../lib/ricevute'
import { Chip } from '../ds'
import { Campo, chiedi, Guaio, SchedaPiena, SegnoStato, Testa, useAvviso, useCarica, Tasto } from './comune'
import { Icona } from '../Icons'
import type { NomeIcona } from '../../lib/icone'
import { ImportaBanca } from './ImportaBanca'
import { Numero } from './Presenze'
import { PrimoScarico } from './ScaricoSatispay'

type Fai = ReturnType<typeof useAvviso>['fai']
type Fonte = 'satispay' | 'banca'

const soldi = (c: number) => `${euro(c)} €`
const quando = (iso: string) => new Date(iso).toLocaleString('it-IT', { timeZone: 'Europe/Rome', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
/** Le righe di «Da classificare» che si vedono per prime: con lo storico sono centinaia. */
const RIGHE_DA_CLASSIFICARE = 20
const rigaTabella = { gap: 14, padding: '10px 14px', borderBottom: '1px solid var(--line-soft)', alignItems: 'center', flexWrap: 'wrap' } as const

/** La prima colonna delle fonti: l'icona, il nome e da dove arriva. */
function CellaFonte({ icona, nome, sotto }: { icona: NomeIcona; nome: string; sotto: string }) {
  return (
    <span role="cell" className="row" style={{ gap: 12, alignItems: 'center', minWidth: 0 }}>
      <span className="sg-fonte-icona"><Icona nome={icona} misura={22} /></span>
      <span className="stack" style={{ minWidth: 0 }}><b style={{ fontSize: 16 }}>{nome}</b><span className="sg-sotto">{sotto}</span></span>
    </span>
  )
}

/** Gli ultimi 12 mesi, dal più recente, come `AAAA-MM` col nome da mostrare. */
function mesi(oggi: string): Array<[string, string]> {
  const [a, m] = oggi.split('-').map(Number)
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(a, m - 1 - i, 1))
    const nome = d.toLocaleDateString('it-IT', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    return [d.toISOString().slice(0, 7), nome.charAt(0).toUpperCase() + nome.slice(1)]
  })
}

/**
 * IMPORTAZIONI, in I CONTI: quel che arriva dalla banca e chi ha pagato con Satispay, «Da classificare» (tutto quel
 * che è in contabilità senza una voce vera) e i movimenti di un mese, per ricontrollarli.
 * Le regole sono in `satispayScarico.ts`, `importaBanca.ts` e `daClassificare.ts`.
 */
export function Importazioni({ d, onClassifica, onRegole }: { d: DatiSegreteria; onClassifica: (movimentoId: string) => void; onRegole?: () => void }) {
  const casse = useCarica(() => d.casse(), [d])
  const voci = useCarica(() => d.voci(), [d])
  const manuali = useCarica(() => d.movimenti(), [d])
  const chiusure = useCarica(() => d.chiusure(), [d])
  // Come in MOVIMENTI: l'anteprima della banca abbina anche gli incassi degli iscritti.
  const incassi = useCarica(async () => {
    const [ricevute, diretti, satispay] = await Promise.all([d.ricevute(), d.pagamentiDiretti(), d.pagamentiSatispay()])
    const chi = [...diretti.map((x) => x.personaId), ...satispay.flatMap((x) => (x.personaId ? [x.personaId] : []))]
    return { ricevute, diretti, satispay, nomi: chi.length ? await d.nomiPersone(chi) : [] }
  }, [d])
  const stato = useCarica(() => d.statoScaricoSatispay(), [d])
  const impostazioni = useCarica(() => d.impostazioni(), [d])
  const { avviso, fai } = useAvviso()
  const [vista, setVista] = useState<'primo' | 'importa' | Fonte | null>(null)
  const [fonteVista, setFonteVista] = useState<'' | FonteDaClassificare>('')
  const [quante, setQuante] = useState(RIGHE_DA_CLASSIFICARE)

  const guaio = [casse, voci, manuali, chiusure].map((x) => x.guaio).find(Boolean)
  const pronto = !!(casse.dato && voci.dato && manuali.dato && chiusure.dato && (incassi.dato || incassi.guaio))
  const rileggi = () => {
    void manuali.ricarica()
    void stato.ricarica()
    void chiusure.ricarica()
  }
  const righe: RigaMovimento[] = pronto
    ? elencoMovimenti(incassi.dato?.ricevute ?? [], incassi.dato?.diretti ?? [], [], casse.dato ?? [], manuali.dato ?? [], voci.dato ?? [], incassi.dato?.satispay)
    : []
  const s = stato.dato
  const fermo = scaricoFermo(impostazioni.dato?.metodiSpenti ?? [])
  // Finché l'interruttore non è letto, né il rosso né «Scarica ora»: se poi non si legge, vale acceso.
  const interruttore = !!(impostazioni.dato || impostazioni.guaio)
  const ultima = ultimaImportazione(righe)
  // Le righe di PAGAMENTI col nome di chi ha pagato: «Chi ha pagato» riconosce i pagamenti Satispay da lì.
  const nomi = new Map((incassi.dato?.nomi ?? []).map((p) => [p.id, `${p.cognome} ${p.nome}`.trim()]))
  const pagamentiIscritti = [...righeDaRicevute(incassi.dato?.ricevute ?? []), ...righeDirette(incassi.dato?.diretti ?? [], (id) => nomi.get(id) ?? '—')]
  const da = daClassificare(righe)
  const pagina = vistaDaClassificare(da.righe, fonteVista, quante)
  const nVoci = da.righe.length === 1 ? '1 voce' : `${da.righe.length} voci`

  if (vista === 'satispay' || vista === 'banca') {
    return (
      <SchedaPiena etichetta={vista === 'satispay' ? 'Chi ha pagato con Satispay' : 'I movimenti della banca'} torna="Le importazioni" onTorna={() => setVista(null)}>
        <Entrato d={d} fonte={vista} onFonte={setVista} meseIniziale={(vista === 'banca' ? ultima?.al : s?.ultimo)?.slice(0, 7)} casse={casse.dato ?? []} manuali={manuali.dato ?? []} chiusure={chiusure.dato ?? []} righe={righe}
          pagamenti={pagamentiIscritti} modulo={incassi.dato?.satispay ?? []} fai={fai} onCambiato={rileggi} />
        {avviso}
      </SchedaPiena>
    )
  }

  return (
    <div className="stack" style={{ gap: 18 }}>
      <Testa titolo="IMPORTAZIONI" sotto="I movimenti che arrivano dalla banca e i pagamenti fatti con Satispay.">
        <Tasto tono="pieno" icona="carica" disabled={!pronto} onClick={() => setVista('importa')}>Importa</Tasto>
      </Testa>
      {guaio && <Guaio testo={guaio} />}
      <div role="table" aria-label="Le fonti" className="sg-tabella">
        <div role="row" className="sg-lista-testa sg-riga-fonte">
          <span role="columnheader" className="sg-etichetta">FONTE</span>
          <span role="columnheader" className="sg-etichetta">STATO</span>
          <span role="columnheader" className="sg-etichetta">ULTIMO ARRIVO</span>
          <span role="columnheader" />
        </div>
        <div role="row" className="sg-riga-fonte">
          <CellaFonte icona="banca" nome="Banca" sotto={`BancoPosta · ${NOME_CASSA_CONTO}`} />
          <span role="cell">{ultima ? <SegnoStato tono="verde" parola="Aggiornata" /> : <SegnoStato tono="nota" parola="Mai importata" />}</span>
          <span role="cell" className="stack" style={{ gap: 2 }}>
            {ultima ? (
              <>
                <span>{dataRicevuta(ultima.creatoIl.slice(0, 10))} · <b>{ultima.conteggio === 1 ? '1 movimento' : `${ultima.conteggio} movimenti`}</b></span>
                <span className="sg-sotto">dal {dataRicevuta(ultima.dal)} al {dataRicevuta(ultima.al)}</span>
              </>
            ) : <span>Nessun file importato finora.</span>}
          </span>
          <span role="cell" className="sg-fonte-tasti">
            <Tasto icona="movimenti" disabled={!pronto} onClick={() => setVista('banca')}>Visualizza i movimenti</Tasto>
          </span>
        </div>
        <div role="row" className="sg-riga-fonte">
          <CellaFonte icona="telefono" nome="Satispay" sotto="Chi ha pagato e per cosa" />
          <span role="cell" className="stack" style={{ gap: 2 }}>
            {/* Senza il 96 lo scarico non c'è: lo si dice, e la banca funziona lo stesso. */}
            {!s ? <SegnoStato tono="nota" parola="Non attivo" />
              : fermo ? (
                <>
                  <SegnoStato tono="giallo" parola="Spento" title={SCARICO_FERMO} />
                  {/* Il perché si legge anche al telefono, non solo passandoci sopra. */}
                  <span className="sg-sotto">Lo scarico è fermo.</span>
                  {onRegole && <button type="button" className="sg-link" onClick={onRegole}>Riaccendi in Regole ›</button>}
                </>
              )
              // Spento, l'errore dell'ultimo giro non conta più: resta nel database e lo sostituisce il prossimo scarico vero.
              : s.errore && interruttore ? <SegnoStato tono="rosso" parola="Non riuscito" />
              : <SegnoStato tono="verde" parola="Acceso" />}
          </span>
          <span role="cell" className="stack" style={{ gap: 2 }}>
            <span>{!s ? (stato.guaio ?? 'Lo scarico da Satispay non è ancora attivo.') : s.ultimo ? quando(s.ultimo) : 'Il primo scarico non è ancora fatto.'}</span>
            {s?.errore && interruttore && !fermo && <span role="alert" style={{ fontSize: 14, color: 'var(--rosso-testo)' }}>L’ultimo scarico non è riuscito: {s.errore}</span>}
            <span className="sg-sotto">Solo per sapere chi ha pagato: i soldi entrano col versamento della banca, già al netto della commissione.</span>
          </span>
          <span role="cell" className="sg-fonte-tasti">
            {s && (
              <>
                {/* Un solo tasto giallo nella pagina, «Importa»: questi sono a linea. */}
                {fermo || !interruttore ? null : s.primoFatto ? (
                  <Tasto onClick={() => void fai(() => d.scaricaSatispay(false), 'Scarico Satispay fatto', rileggi)}>Scarica ora</Tasto>
                ) : (
                  <Tasto onClick={() => setVista('primo')}>Guarda il primo scarico</Tasto>
                )}
                <Tasto icona="persona" disabled={!pronto} onClick={() => setVista('satispay')}>Visualizza chi ha pagato</Tasto>
              </>
            )}
          </span>
        </div>
      </div>

      {pronto && (
        <section aria-label="Da classificare" className="stack" style={{ gap: 14, paddingTop: 6 }}>
          <div className="row" style={{ flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
            <h2 className="sg-riquadro-titolo" style={{ margin: 0 }}>
              {da.righe.length ? `DA CLASSIFICARE · ${nVoci.toUpperCase()}` : 'DA CLASSIFICARE'}
            </h2>
            <span className="sg-sotto">{da.righe.length ? 'Già in contabilità, senza una voce vera. Le più vecchie in alto.' : 'Niente da classificare.'}</span>
          </div>
          {da.righe.length > 0 && (
            <>
              <div className="row" role="group" aria-label="Da dove arrivano" style={{ gap: 10, flexWrap: 'wrap' }}>
                <Chip acceso={pagina.fonte === ''} onClick={() => { setFonteVista(''); setQuante(RIGHE_DA_CLASSIFICARE) }}>{`Tutte · ${da.righe.length}`}</Chip>
                {FONTI_DA_CLASSIFICARE.filter((f) => da.righe.some((r) => r.fonte === f)).map((f) => (
                  <Chip key={f} acceso={pagina.fonte === f} onClick={() => { setFonteVista(f); setQuante(RIGHE_DA_CLASSIFICARE) }}>{`${f} · ${da.righe.filter((r) => r.fonte === f).length}`}</Chip>
                ))}
              </div>
              <div role="table" aria-label="Voci da classificare" className="sg-tabella">
                <div role="row" className="sg-lista-testa sg-riga-da-classificare">
                  <span role="columnheader" className="sg-etichetta">DATA</span>
                  <span role="columnheader" className="sg-etichetta">ORIGINE</span>
                  <span role="columnheader" className="sg-etichetta">MOVIMENTO</span>
                  <span role="columnheader" className="sg-etichetta" style={{ textAlign: 'right' }}>IMPORTO</span>
                  <span role="columnheader" />
                </div>
                <div role="rowgroup" className="sg-tabella-corpo">
                  {pagina.visibili.map((r) => (
                    <div key={r.id} role="row" className="sg-riga-da-classificare" style={{ borderBottom: '1px solid var(--line-soft)' }}>
                      <span role="cell" className="sg-da-data">{dataRicevuta(r.data)}</span>
                      <span role="cell" className="sg-etichetta">{r.fonte.toUpperCase()}</span>
                      <span role="cell" className="sg-da-descrizione">{r.descrizione}</span>
                      <span role="cell" className="num sg-da-importo" style={{ color: r.tipo === 'entrata' ? 'var(--verde-testo)' : 'var(--rosso-testo)' }}>
                        {r.tipo === 'entrata' ? '+' : '−'}{soldi(r.importo)}
                      </span>
                      <span role="cell" className="sg-da-tasto">
                        <button type="button" className="sg-btn sg-btn-linea" aria-label={`Classifica ${r.descrizione}`} onClick={() => onClassifica(r.id)}>Classifica</button>
                      </span>
                    </div>
                  ))}
                </div>
                {pagina.restano > 0 && (
                  <div style={{ padding: '10px 14px' }}>
                    <button type="button" className="sg-btn sg-btn-linea" onClick={() => setQuante((n) => n + RIGHE_DA_CLASSIFICARE)}>
                      {`Mostra altre ${pagina.prossime} · ne restano ${pagina.restano}`}
                    </button>
                  </div>
                )}
              </div>
              <div className="row" style={{ flexWrap: 'wrap', justifyContent: 'space-between', gap: 8, fontSize: 14 }}>
                <b>{nVoci}: entrate +{soldi(da.entrate.importo)}, uscite −{soldi(da.uscite.importo)}</b>
                <span className="sg-sotto">coincide con MOVIMENTI → Da classificare</span>
              </div>
            </>
          )}
        </section>
      )}

      {vista === 'primo' && (
        <SchedaPiena etichetta="Primo scarico da Satispay" torna="Le importazioni" onTorna={() => setVista(null)}>
          <PrimoScarico d={d} fai={fai} onFatto={() => { setVista(null); rileggi() }} onChiudi={() => setVista(null)} />
        </SchedaPiena>
      )}
      {vista === 'importa' && pronto && (
        <SchedaPiena etichetta="Importa dalla banca" torna="Le importazioni" onTorna={() => setVista(null)}>
          <ImportaBanca d={d} casse={casse.dato ?? []} voci={voci.dato ?? []} righe={righe} fai={fai} onRileggi={rileggi} onVedi={() => setVista('banca')} />
        </SchedaPiena>
      )}
      {avviso}
    </div>
  )
}

/**
 * Un mese da Satispay o dalla banca. Satispay: «Chi ha pagato», in sola lettura, perché i soldi sono nei versamenti
 * della banca. Banca: ogni movimento importato e dove è finito. «Non è questo» scioglie gli abbinamenti.
 */
function Entrato({ d, fonte, onFonte, meseIniziale, casse, manuali, chiusure, righe, pagamenti, modulo, fai, onCambiato }: {
  d: DatiSegreteria; fonte: Fonte; onFonte: (f: Fonte) => void; meseIniziale?: string; casse: Cassa[]; manuali: MovimentoManuale[]
  chiusure: ChiusuraCassa[]; righe: RigaMovimento[]; pagamenti: RigaPagamento[]; modulo: PagamentoSatispay[]; fai: Fai; onCambiato: () => void
}) {
  const oggi = oggiARoma()
  // Il mese dell'ultimo arrivo: è lì che si va a guardare, non per forza in quello corrente.
  const [mese, setMese] = useState(() => (meseIniziale && mesi(oggi).some(([m]) => m === meseIniziale) ? meseIniziale : oggi.slice(0, 7)))
  const [cerca, setCerca] = useState('')
  const [soloNon, setSoloNon] = useState(false)
  const negozio = useCarica(() => (fonte === 'satispay' ? d.negozioSatispay(mese) : Promise.resolve([])), [d, fonte, mese])
  // In un oggetto: senza il 114 `bancaCoperti` dà null, che non si deve confondere con «sto leggendo».
  const coperti = useCarica(async () => ({ righe: fonte === 'banca' ? await d.bancaCoperti() : [] }), [d, fonte])
  const nomeMese = mesi(oggi).find(([m]) => m === mese)?.[1].toLowerCase() ?? mese
  const rileggi = () => {
    void negozio.ricarica()
    void coperti.ricarica()
    onCambiato()
  }
  const conto = casse.find((c) => c.nome === NOME_CASSA_CONTO)

  const nonEQuesto = async (testo: string, fn: () => Promise<unknown>, fatto: string) => {
    if (await chiedi(testo, 'Sì, togli il collegamento', { pericolo: true })) void fai(fn, fatto, rileggi)
  }

  return (
    <div className="stack" style={{ gap: 18 }}>
      <Testa titolo={fonte === 'satispay' ? 'CHI HA PAGATO' : 'I MOVIMENTI DELLA BANCA'} sotto={fonte === 'satispay'
        ? `Da Satispay, ${nomeMese}: ogni pagamento scaricato e a chi è stato riconosciuto. I soldi sono nei versamenti della banca.`
        : `Dalla banca, ${nomeMese}: ogni movimento importato e dove è finito.`} />
      <div className="row" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <Chip acceso={fonte === 'satispay'} onClick={() => onFonte('satispay')}>Satispay</Chip>
        <Chip acceso={fonte === 'banca'} onClick={() => onFonte('banca')}>Banca</Chip>
        <Campo id="entrato-mese" etichetta="Mese">
          <select id="entrato-mese" className="sg-campo" value={mese} onChange={(e) => setMese(e.target.value)}>
            {mesi(oggi).map(([m, nome]) => <option key={m} value={m}>{nome}</option>)}
          </select>
        </Campo>
        {fonte === 'satispay' && (
          <>
            <Campo id="entrato-cerca" etichetta="Cerca">
              <input id="entrato-cerca" className="sg-campo" type="search" value={cerca} placeholder="Nome o importo" onChange={(e) => setCerca(e.target.value)} />
            </Campo>
            <Chip acceso={soloNon} onClick={() => setSoloNon((x) => !x)}>Solo non riconosciuti</Chip>
          </>
        )}
      </div>
      {fonte === 'satispay' ? (
        negozio.guaio ? <Guaio testo={negozio.guaio} /> : !negozio.dato ? <p className="sg-sotto">Sto leggendo i pagamenti…</p> : (() => {
          const tutte = chiHaPagato({ negozio: negozio.dato, movimenti: manuali, pagamenti, modulo }, mese)
          const c = contiChiHaPagato(tutte)
          const viste = filtraChiHaPagato(tutte, cerca, soloNon)
          return (
            <>
              <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
                <Numero titolo="PAGATO CON SATISPAY" valore={c.totale === 0 ? soldi(0) : `${c.totale < 0 ? '−' : '+'}${soldi(Math.abs(c.totale))}`}
                  sotto={`${c.pagamenti === 1 ? '1 pagamento' : `${c.pagamenti} pagamenti`} · ${c.rimborsi === 1 ? '1 rimborso' : `${c.rimborsi} rimborsi`}`} />
                <Numero titolo="RICONOSCIUTI" valore={`${c.riconosciuti} su ${c.pagamenti}`} sotto="in una ricevuta, nei pagamenti o dal modulo" />
                <Numero titolo="NON RICONOSCIUTI" valore={String(c.nonRiconosciuti)} allarme={c.nonRiconosciuti > 0} sotto="nessuna ricevuta né pagamento con quel nome" />
              </div>
              <div role="table" aria-label="Chi ha pagato con Satispay nel mese" className="sg-tabella">
                <div role="row" className="row sg-lista-testa" style={rigaTabella}>
                  <span role="columnheader" className="sg-etichetta" style={{ minWidth: 80 }}>DATA</span>
                  <span role="columnheader" className="sg-etichetta" style={{ flex: '1 1 160px' }}>CHI</span>
                  <span role="columnheader" className="sg-etichetta" style={{ minWidth: 90 }}>IMPORTO</span>
                  <span role="columnheader" className="sg-etichetta" style={{ flex: '2 1 220px' }}>COME È RICONOSCIUTO</span>
                  <span role="columnheader" style={{ minWidth: 120 }} />
                </div>
                <div role="rowgroup" className="sg-tabella-corpo">
                  {viste.length === 0 && <div role="row"><p role="cell" className="sg-sotto" style={{ padding: '12px 14px' }}>{tutte.length ? 'Nessun pagamento con questa ricerca.' : `Nessun pagamento Satispay in ${nomeMese}.`}</p></div>}
                  {viste.map((x) => {
                    const m = x.movimentoId ? manuali.find((y) => y.id === x.movimentoId) : undefined
                    const chiuso = !!m && giornoChiuso(chiusure, [m.cassaId], m.data)
                    const chi = x.chi ?? 'Satispay'
                    return (
                      <div key={x.satispayId} role="row" className="row" style={rigaTabella}>
                        <span role="cell" style={{ fontSize: 13, color: 'var(--sec)', minWidth: 80 }}>{dataRicevuta(x.data)}</span>
                        <b role="cell" style={{ fontSize: 15, flex: '1 1 160px', minWidth: 0 }}>{chi}</b>
                        <span role="cell" className="num" style={{ fontSize: 16, fontWeight: 700, minWidth: 90, color: x.tipo === 'TO_BUSINESS' ? 'var(--verde-testo)' : 'var(--rosso-testo)' }}>
                          {x.tipo === 'TO_BUSINESS' ? '+' : '−'}{soldi(x.importo)}
                        </span>
                        <span role="cell" style={{ flex: '2 1 220px', minWidth: 0, fontSize: 14, color: x.come === 'non_riconosciuto' ? 'var(--giallo-testo)' : 'var(--sec)', fontWeight: x.come === 'non_riconosciuto' ? 700 : undefined }}>
                          {x.detto}
                        </span>
                        <span role="cell" style={{ minWidth: 120, textAlign: 'right' }}>
                          {m && !chiuso && (
                            <button type="button" className="sg-btn sg-btn-linea" onClick={() => void nonEQuesto(
                              `Tolgo il collegamento fra «${m.descrizione}» e il pagamento Satispay di ${chi}? Il movimento a mano torna normale; il pagamento resta nel versamento della banca.`,
                              () => d.scollegaSatispay(x.satispayId), 'Collegamento tolto')}>
                              Non è questo
                            </button>
                          )}
                        </span>
                      </div>
                    )
                  })}
                </div>
                {viste.length < tutte.length && (
                  <div role="row" style={{ padding: '10px 14px', textAlign: 'right' }}><span role="cell" className="sg-sotto">ne vedi {viste.length} su {tutte.length}</span></div>
                )}
              </div>
            </>
          )
        })()
      ) : coperti.guaio ? <Guaio testo={coperti.guaio} /> : !coperti.dato ? <p className="sg-sotto">Sto leggendo i movimenti…</p> : (() => {
        // Senza il 114 i coperti non ci sono: si vedono solo i movimenti importati.
        const b = entratoBanca(righe, coperti.dato.righe ?? [], mese)
        return (
          <>
            <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
              <Numero titolo="IMPORTATI NUOVI" valore={soldi(b.nuovi.importo)} sotto={b.nuovi.conteggio === 1 ? '1 movimento scritto dal file' : `${b.nuovi.conteggio} movimenti scritti dal file`} />
              <Numero titolo="GIÀ SCRITTI A MANO" valore={soldi(b.coperti.importo)} sotto={b.coperti.conteggio === 1 ? '1 abbinato a un movimento già scritto' : `${b.coperti.conteggio} abbinati a un movimento già scritto`} />
            </div>
            <div role="table" aria-label="Movimenti della banca del mese" className="sg-tabella">
              <div className="sg-tabella-corpo">
                {b.righe.length === 0 && <div role="row"><p role="cell" className="sg-sotto" style={{ padding: '12px 14px' }}>Nessun movimento della banca in {nomeMese}.</p></div>}
                {b.righe.map((x) => {
                  const chiuso = !conto || giornoChiuso(chiusure, [conto.id], x.data)
                  return (
                    <div key={x.chiave} role="row" className="row" style={rigaTabella}>
                      <span role="cell" style={{ fontSize: 13, color: 'var(--sec)', minWidth: 80 }}>{dataRicevuta(x.data)}</span>
                      <span role="cell" className="stack" style={{ flex: '1 1 220px', minWidth: 0, gap: 2 }}>
                        <b style={{ fontSize: 15 }}>{x.con ? x.con.descrizione : x.descrizione}</b>
                        <span className="sg-sotto">{x.con ? `Coperto da questo, scritto a mano · in banca: ${x.descrizione}` : 'Importato nuovo'}</span>
                      </span>
                      <span role="cell" className="sg-sotto" style={{ minWidth: 120 }}>{x.voce ?? ''}</span>
                      <span role="cell" className="num" style={{ fontSize: 16, fontWeight: 700, color: x.tipo === 'entrata' ? 'var(--verde-testo)' : undefined }}>
                        {x.tipo === 'entrata' ? '+' : '−'}{soldi(x.importo)}
                      </span>
                      <span role="cell" style={{ minWidth: 120, textAlign: 'right' }}>
                        {x.come === 'coperto' && !chiuso && (
                          <button type="button" className="sg-btn sg-btn-linea" onClick={() => void nonEQuesto(
                            `Il movimento della banca «${x.descrizione}» non è «${x.con?.descrizione}»? Lo scrivo come movimento nuovo, in «Da classificare»; quello a mano resta com'è.`,
                            () => d.nonEQuestoBanca(x.chiave), 'Scritto come movimento nuovo')}>
                            Non è questo
                          </button>
                        )}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        )
      })()}
      {fonte === 'satispay' ? (
        <p className="sg-sotto">
          Sola lettura: da qui non si scrive niente in contabilità. «Non riconosciuto» vuol dire che Satispay l’ha incassato ma nessuna ricevuta o pagamento lo copre: la quota si segna dalla scheda della persona.
        </p>
      ) : (
        <p className="sg-sotto">
          «Non è questo» toglie l’abbinamento: il movimento a mano torna normale, e quello della banca entra come movimento nuovo. Non si può nei giorni con la cassa già chiusa.
        </p>
      )}
    </div>
  )
}
