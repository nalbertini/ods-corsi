import { useState, type ReactNode } from 'react'
import type { DatiSegreteria } from '../../lib/segreteria'
import { elencoMovimenti, giornoChiuso, NOME_CASSA_CONTO, oggiARoma, type Cassa, type ChiusuraCassa, type MovimentoManuale, type RigaMovimento, type VoceContabile } from '../../lib/contabilita'
import { candidatiInOrdine, dettoNuovo, gruppiDaDecidere, nomeSimile, riepilogoEntrato, riepilogoGruppo, righeEntrato, type GruppoDaDecidere, type RigaEntrato, type ScelteInCorso } from '../../lib/satispayScarico'
import { entratoBanca, ultimaImportazione } from '../../lib/importaBanca'
import { daClassificare, FONTI_DA_CLASSIFICARE, vistaDaClassificare, type FonteDaClassificare } from '../../lib/daClassificare'
import { dataRicevuta, euro } from '../../lib/ricevute'
import { Chip } from '../ds'
import { Campo, chiedi, Guaio, SchedaPiena, Testa, useAvviso, useCarica, Tasto } from './comune'
import { ImportaBanca } from './ImportaBanca'
import { Numero } from './Presenze'
import { PrimoScarico } from './ScaricoSatispay'

type Fai = ReturnType<typeof useAvviso>['fai']
type Fonte = 'satispay' | 'banca'

const soldi = (c: number) => `${euro(c)} €`
const giornoLungo = (data: string) => `${new Date(`${data}T12:00:00`).toLocaleDateString('it-IT', { weekday: 'long' })} ${dataRicevuta(data)}`
const quando = (iso: string) => new Date(iso).toLocaleString('it-IT', { timeZone: 'Europe/Rome', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
// Sui chip il nome della persona basta: «Cliente» è uguale in tutte le descrizioni scritte a mano.
const nomeChip = (descrizione: string) => descrizione.replace(/^Cliente /, '')
const pagamenti = (n: number) => (n === 1 ? '1 pagamento' : `${n} pagamenti`)
const riquadroFonte = { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: '12px 18px', padding: '14px 18px' } as const
/** Le righe di «Da classificare» che si vedono per prime: con lo storico sono centinaia. */
const RIGHE_DA_CLASSIFICARE = 20
const rigaTabella = { gap: 14, padding: '10px 14px', borderBottom: '1px solid var(--line-soft)', alignItems: 'center', flexWrap: 'wrap' } as const

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
 * IMPORTAZIONI, in I CONTI: quel che arriva da Satispay e dalla banca, quando è arrivato, cosa resta da decidere
 * «Da classificare» (tutto quel che è in contabilità senza una voce vera) e «Cosa è entrato» per ricontrollare un mese.
 * Le regole sono in `satispayScarico.ts`, `importaBanca.ts` e `daClassificare.ts`.
 */
export function Importazioni({ d, onClassifica }: { d: DatiSegreteria; onClassifica: (movimentoId: string) => void }) {
  const casse = useCarica(() => d.casse(), [d])
  const voci = useCarica(() => d.voci(), [d])
  const manuali = useCarica(() => d.movimenti(), [d])
  const chiusure = useCarica(() => d.chiusure(), [d])
  // Come in MOVIMENTI: l'anteprima della banca abbina anche gli incassi degli iscritti.
  const incassi = useCarica(async () => {
    const [ricevute, diretti, satispay] = await Promise.all([d.ricevute(), d.pagamentiDiretti(), d.pagamentiSatispay()])
    return { ricevute, diretti, satispay }
  }, [d])
  const stato = useCarica(() => d.statoScaricoSatispay(), [d])
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
  const ultima = ultimaImportazione(righe)
  const gruppi = s ? gruppiDaDecidere(s.daDecidere) : []
  const casi = s?.daDecidere.length ?? 0
  const da = daClassificare(righe)
  const pagina = vistaDaClassificare(da.righe, fonteVista, quante)
  const nVoci = da.righe.length === 1 ? '1 voce' : `${da.righe.length} voci`

  if (vista === 'satispay' || vista === 'banca') {
    return (
      <SchedaPiena etichetta="Cosa è entrato" torna="Le importazioni" onTorna={() => setVista(null)}>
        <Entrato d={d} fonte={vista} onFonte={setVista} casse={casse.dato ?? []} voci={voci.dato ?? []} manuali={manuali.dato ?? []} chiusure={chiusure.dato ?? []} righe={righe} fai={fai} onCambiato={rileggi} />
        {avviso}
      </SchedaPiena>
    )
  }

  return (
    <div className="stack" style={{ gap: 18 }}>
      <Testa titolo="IMPORTAZIONI" sotto="Quello che arriva da Satispay e dalla banca: da dove, quando, e cosa resta da decidere." />
      {guaio && <Guaio testo={guaio} />}
      <section aria-label="Satispay" className="sg-riquadro" style={riquadroFonte}>
        <div className="stack" style={{ gap: 2, flex: '999 1 420px', minWidth: 0 }}>
          <span className="sg-etichetta">SATISPAY</span>
          {/* Senza il 96 lo scarico non c'è: lo si dice, e la banca funziona lo stesso. */}
          {!s ? (
            <span style={{ fontSize: 15 }}>{stato.guaio ?? 'Lo scarico da Satispay non è ancora attivo.'}</span>
          ) : (
            <span style={{ fontSize: 15 }}>
              {s.ultimo ? `Ultimo scarico il ${quando(s.ultimo)}. ` : 'Il primo scarico non è ancora fatto. '}
              {casi ? <b>{casi === 1 ? '1 da decidere.' : `${casi} da decidere.`}</b> : 'Niente da decidere.'}
            </span>
          )}
          {s?.errore && <span role="alert" style={{ fontSize: 14, color: 'var(--rosso-testo)' }}>L’ultimo scarico non è riuscito: {s.errore}</span>}
        </div>
        {s && (
          <>
            <button type="button" className="sg-btn sg-btn-linea" disabled={!pronto} onClick={() => setVista('satispay')}>Cosa è entrato</button>
            {s.primoFatto ? (
              <Tasto onClick={() => void fai(() => d.scaricaSatispay(false), 'Scarico Satispay fatto', rileggi)}>Scarica ora</Tasto>
            ) : (
              <button type="button" className="sg-btn sg-btn-pieno" onClick={() => setVista('primo')}>Guarda il primo scarico</button>
            )}
          </>
        )}
      </section>
      <section aria-label="Banca" className="sg-riquadro" style={riquadroFonte}>
        <div className="stack" style={{ gap: 2, flex: '999 1 420px', minWidth: 0 }}>
          <span className="sg-etichetta">BANCA · BANCOPOSTA</span>
          <span style={{ fontSize: 15 }}>
            {ultima
              ? <>Ultimo file importato il {dataRicevuta(ultima.creatoIl.slice(0, 10))}: <b>{ultima.conteggio === 1 ? '1 movimento' : `${ultima.conteggio} movimenti`}</b>, dal {dataRicevuta(ultima.dal)} al {dataRicevuta(ultima.al)}.</>
              : 'Nessun file importato finora.'}
          </span>
        </div>
        <button type="button" className="sg-btn sg-btn-linea" disabled={!pronto} onClick={() => setVista('banca')}>Cosa è entrato</button>
        <Tasto tono="pieno" disabled={!pronto} onClick={() => setVista('importa')}>Importa un file</Tasto>
      </section>

      {s && (
        <section aria-label="Da decidere" className="stack" style={{ gap: 14, paddingTop: 6 }}>
          <div className="row" style={{ flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
            <h2 className="sg-riquadro-titolo" style={{ margin: 0 }}>
              {casi ? `DA DECIDERE · ${pagamenti(casi).toUpperCase()}${gruppi.length > 1 ? ` IN ${gruppi.length} GRUPPI` : ''}` : 'DA DECIDERE'}
            </h2>
            <span className="sg-sotto">{casi ? 'Finché non decidi, non entrano in contabilità.' : 'Niente da decidere: quel che è arrivato è entrato.'}</span>
          </div>
          {gruppi.map((g) => (
            <Gruppo key={g.pagamenti.map((p) => p.satispayId).join(',')} d={d} g={g} fai={fai} onFatto={rileggi} />
          ))}
        </section>
      )}

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

/** Un gruppo da decidere: i pagamenti dello stesso giorno e importo, con una conferma sola. */
function Gruppo({ d, g, fai, onFatto }: { d: DatiSegreteria; g: GruppoDaDecidere; fai: Fai; onFatto: () => void }) {
  const [inCorso, setInCorso] = useState<ScelteInCorso>({})
  const n = g.pagamenti.length
  const segno = g.tipo === 'TO_BUSINESS' ? '+' : '−'
  const fonte = g.tipo === 'TO_BUSINESS' ? 'Satispay' : 'Rimborso Satispay'
  const decidi = (scelta: 'oggi' | 'fuori', fatto: string) =>
    void fai(() => d.decidiGruppoSatispay(g.pagamenti.map((p) => ({ satispayId: p.satispayId, scelta }))), fatto, onFatto)

  if (g.motivo === 'giorno_chiuso') {
    return (
      <Riquadro etichetta="CASSA GIÀ CHIUSA QUEL GIORNO" titolo={`${n === 1 ? `1 pagamento ${fonte}` : `${n} pagamenti ${fonte}`} di ${giornoLungo(g.data)}`}>
        <span style={{ fontSize: 15 }}>La cassa di quel giorno è già chiusa: scriverli lì cambierebbe una chiusura fatta. Puoi registrarli oggi, o lasciarli fuori.</span>
        <div className="stack" style={{ gap: 6 }}>
          {g.pagamenti.map((p) => (
            <div key={p.satispayId} className="row" style={{ gap: 12, justifyContent: 'space-between', fontSize: 15 }}>
              <span>{fonte}{p.chi ? ` · ${p.chi}` : ''}</span>
              <b className="num">{segno}{soldi(p.importo)}</b>
            </div>
          ))}
        </div>
        <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
          <button type="button" className="sg-btn sg-btn-pieno" onClick={() => decidi('oggi', 'Registrati con la data di oggi')}>
            {n === 1 ? 'Registralo oggi' : 'Registrali oggi'}, {dataRicevuta(oggiARoma()).slice(0, 5)}
          </button>
          <button type="button" className="sg-btn sg-btn-linea" onClick={() => decidi('fuori', 'Lasciati fuori')}>{n === 1 ? 'Lascialo fuori' : 'Lasciali fuori'}</button>
        </div>
      </Riquadro>
    )
  }

  const riep = riepilogoGruppo(g, inCorso)
  const nCand = g.candidati.length
  const scegli = (id: string, v: ScelteInCorso[string]) =>
    setInCorso((x) => {
      const prima = x[id]
      // Un secondo clic sulla stessa scelta la toglie: niente si sceglie da solo.
      if (prima?.scelta === v.scelta && prima.movimentoId === v.movimentoId) {
        const { [id]: _, ...resto } = x
        return resto
      }
      return { ...x, [id]: v }
    })
  const dubbi = riep.collegati.filter((c) => !c.simile)
  return (
    <Riquadro etichetta="FORSE GIÀ SCRITTI A MANO" titolo={`${pagamenti(n)} ${fonte} da ${soldi(g.importo)} · ${nCand === 1 ? '1 movimento' : `${nCand} movimenti`} a mano da ${soldi(g.importo)}`}>
      <span style={{ fontSize: 15 }}>Pagati {giornoLungo(g.data)}. Per ognuno dimmi se è già scritto a mano o se è un {dettoNuovo(g.tipo, 1).scelta.toLowerCase()}.</span>
      <div className="stack" style={{ gap: 6, padding: '10px 14px', background: 'var(--fondo-2, transparent)', border: '1px solid var(--line-soft)', borderRadius: 8 }}>
        <span className="sg-etichetta">GIÀ SCRITTI A MANO QUEL GIORNO</span>
        {g.candidati.map((m) => (
          <div key={m.id} className="row" style={{ gap: 12, flexWrap: 'wrap', justifyContent: 'space-between', fontSize: 14 }}>
            <span style={{ flex: 1, minWidth: 0 }}><b>{m.descrizione}</b>{m.voce ? ` · ${m.voce}` : ''}</span>
            <span className="sg-sotto">{m.cassa}</span>
            <span className="num">{segno}{soldi(m.importo)}</span>
          </div>
        ))}
      </div>
      {g.pagamenti.map((p) => {
        const s = inCorso[p.satispayId]
        const simili = g.candidati.filter((m) => nomeSimile(p.chi ?? '', m.descrizione))
        const altrui = p.candidati.filter((m) => riep.presi[m.id] && riep.presi[m.id] !== p.satispayId)
        return (
          <div key={p.satispayId} className="stack" style={{ gap: 8, paddingTop: 10, borderTop: '1px solid var(--line-soft)' }}>
            <div className="row" style={{ gap: 12, justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 15 }}>
                <b>{fonte}{p.chi ? ` · ${p.chi}` : ''}</b>
                {simili.length > 0 && <span className="sg-tag" style={{ marginLeft: 8 }}>NOME SIMILE: {simili.map((m) => m.descrizione).join(', ')}</span>}
              </span>
              <b className="num">{segno}{soldi(p.importo)}</b>
            </div>
            <div className="row" role="group" aria-label={`Cosa è il pagamento di ${p.chi ?? 'Satispay'}`} style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <span className="sg-sotto">È già scritto per</span>
              {candidatiInOrdine(p.chi, p.candidati).map((m) => {
                const preso = riep.presi[m.id]
                return (
                  <Chip key={m.id} acceso={s?.scelta === 'a_mano' && s.movimentoId === m.id}
                    disabled={!!preso && preso !== p.satispayId}
                    etichetta={`${m.descrizione}${preso && preso !== p.satispayId ? ', già scelto per un altro pagamento' : ''}`}
                    onClick={() => scegli(p.satispayId, { scelta: 'a_mano', movimentoId: m.id })}>
                    {nomeChip(m.descrizione)}
                  </Chip>
                )
              })}
              <span className="sg-sotto">oppure</span>
              <Chip acceso={s?.scelta === 'scrivi'} onClick={() => scegli(p.satispayId, { scelta: 'scrivi' })}>{dettoNuovo(g.tipo, 1).scelta}</Chip>
            </div>
            {altrui.length > 0 && <span className="sg-sotto">{altrui.map((m) => nomeChip(m.descrizione)).join(', ')} {altrui.length === 1 ? 'è' : 'sono'} già di un altro pagamento.</span>}
          </div>
        )
      })}
      <div className="stack" style={{ gap: 4, paddingTop: 10, borderTop: '1px solid var(--line-soft)', fontSize: 14 }} aria-live="polite">
        {riep.scelte === null ? (
          <span>Scegli per ogni pagamento: {riep.mancano === 1 ? 'ne manca 1' : `ne mancano ${riep.mancano}`}.</span>
        ) : (
          <>
            {riep.collegati.length > 0 && (
              <span>Collego {riep.collegati.map((c) => `${c.chi || 'Satispay'} a «${c.descrizione}»`).join(', ')}: restano i movimenti a mano, con la loro persona e la loro voce.</span>
            )}
            {dubbi.map((c) => (
              <span key={c.descrizione} style={{ color: 'var(--giallo-testo)' }}>Controlla {c.chi || 'Satispay'}: il nome non somiglia a «{c.descrizione}».</span>
            ))}
            {riep.nuovi.conteggio > 0 && (
              <span>Registro {dettoNuovo(g.tipo, riep.nuovi.conteggio).conto}: {soldi(riep.nuovi.importo)} {dettoNuovo(g.tipo, riep.nuovi.conteggio).verso} in contabilità.</span>
            )}
          </>
        )}
      </div>
      <div className="row">
        <button type="button" className="sg-btn sg-btn-pieno" disabled={riep.scelte === null}
          onClick={() => { if (riep.scelte) { const scelte = riep.scelte; void fai(() => d.decidiGruppoSatispay(scelte), 'Pagamenti decisi', onFatto) } }}>
          Conferma: {riep.collegati.length} {riep.collegati.length === 1 ? 'collegato' : 'collegati'}, {riep.nuovi.conteggio} {riep.nuovi.conteggio === 1 ? 'nuovo' : 'nuovi'}
        </button>
      </div>
    </Riquadro>
  )
}

function Riquadro({ etichetta, titolo, children }: { etichetta: string; titolo: string; children: ReactNode }) {
  return (
    <section aria-label={titolo} className="sg-riquadro" style={{ gap: 12, borderColor: 'var(--giallo-testo)' }}>
      <div className="row" style={{ justifyContent: 'space-between', gap: 12 }}>
        <span className="sg-etichetta" style={{ color: 'var(--giallo-testo)' }}>{etichetta}</span>
        <span className="sg-etichetta">SATISPAY</span>
      </div>
      <b style={{ fontSize: 17 }}>{titolo}</b>
      {children}
    </section>
  )
}

const COME: Record<RigaEntrato['esito'], string> = {
  // Per «scritto» vale `dettoNuovo`, che distingue incassi e rimborsi.
  scritto: 'Scritto',
  a_mano: 'Collegato',
  modulo: 'Dal modulo di iscrizione',
  pagamenti: 'Già fra gli incassi degli iscritti',
  fuori: 'Lasciato fuori',
  da_decidere: 'Da decidere',
}

/** «Cosa è entrato» in un mese, da Satispay o dalla banca: ogni riga e dove è finita, con «Non è questo» per gli abbinamenti. */
function Entrato({ d, fonte, onFonte, casse, voci, manuali, chiusure, righe, fai, onCambiato }: {
  d: DatiSegreteria; fonte: Fonte; onFonte: (f: Fonte) => void; casse: Cassa[]; voci: VoceContabile[]; manuali: MovimentoManuale[]
  chiusure: ChiusuraCassa[]; righe: RigaMovimento[]; fai: Fai; onCambiato: () => void
}) {
  const oggi = oggiARoma()
  const [mese, setMese] = useState(oggi.slice(0, 7))
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
      <Testa titolo="COSA È ENTRATO" sotto={fonte === 'satispay' ? `Da Satispay, ${nomeMese}: ogni pagamento scaricato e dove è finito.` : `Dalla banca, ${nomeMese}: ogni movimento importato e dove è finito.`} />
      <div className="row" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <Chip acceso={fonte === 'satispay'} onClick={() => onFonte('satispay')}>Satispay</Chip>
        <Chip acceso={fonte === 'banca'} onClick={() => onFonte('banca')}>Banca</Chip>
        <Campo id="entrato-mese" etichetta="Mese">
          <select id="entrato-mese" value={mese} onChange={(e) => setMese(e.target.value)}>
            {mesi(oggi).map(([m, nome]) => <option key={m} value={m}>{nome}</option>)}
          </select>
        </Campo>
      </div>
      {fonte === 'satispay' ? (
        negozio.guaio ? <Guaio testo={negozio.guaio} /> : !negozio.dato ? <p className="sg-sotto">Sto leggendo i pagamenti…</p> : (() => {
          const dati = { negozio: negozio.dato, movimenti: manuali, voci, casse }
          const r = riepilogoEntrato(dati, mese)
          const elenco = righeEntrato(dati, mese)
          const incassi = elenco.filter((x) => x.tipo === 'TO_BUSINESS').length
          const rimborsi = elenco.length - incassi
          return (
            <>
              <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
                <Numero titolo="ENTRATO DA SATISPAY" valore={soldi(r.entrato)} sotto={`${incassi === 1 ? '1 incasso' : `${incassi} incassi`} · ${rimborsi === 1 ? '1 rimborso' : `${rimborsi} rimborsi`}`} />
                <Numero titolo="SECONDO SATISPAY" valore={soldi(r.secondoSatispay)} allarme={r.entrato !== r.secondoSatispay}
                  sotto={r.entrato === r.secondoSatispay ? 'il totale del mese nel negozio: torna' : `il totale del mese nel negozio: mancano ${soldi(r.secondoSatispay - r.entrato)}, guarda Da decidere`} />
                <Numero titolo="DI CUI GIÀ A MANO" valore={soldi(r.aMano.importo)} sotto={r.aMano.conteggio === 1 ? '1 collegato a un movimento già scritto' : `${r.aMano.conteggio} collegati a un movimento già scritto`} />
              </div>
              <div role="table" aria-label="Pagamenti Satispay del mese" className="sg-tabella">
                <div className="sg-tabella-corpo">
                  {elenco.length === 0 && <div role="row"><p role="cell" className="sg-sotto" style={{ padding: '12px 14px' }}>Nessun pagamento Satispay entrato in {nomeMese}.</p></div>}
                  {elenco.map((x) => {
                    const m = x.movimento ? manuali.find((y) => y.id === x.movimento?.id) : undefined
                    const chiuso = !!m && giornoChiuso(chiusure, [m.cassaId], m.data)
                    const chi = `Satispay${x.chi ? ` · ${x.chi}` : ''}`
                    return (
                      <div key={x.satispayId} role="row" className="row" style={rigaTabella}>
                        <span role="cell" style={{ fontSize: 13, color: 'var(--sec)', minWidth: 80 }}>{dataRicevuta(x.data)}</span>
                        <span role="cell" className="stack" style={{ flex: '1 1 220px', minWidth: 0, gap: 2 }}>
                          <b style={{ fontSize: 15 }}>{x.esito === 'a_mano' && x.movimento ? x.movimento.descrizione : chi}</b>
                          <span className="sg-sotto">{x.esito === 'a_mano' ? `Collegato a ${chi}` : x.esito === 'scritto' ? dettoNuovo(x.tipo, 1).scelta : COME[x.esito]}</span>
                        </span>
                        <span role="cell" className="sg-sotto" style={{ minWidth: 120 }}>{x.voce ?? (x.esito === 'scritto' ? 'Da classificare' : '')}</span>
                        <span role="cell" className="num" style={{ fontSize: 16, fontWeight: 700, color: x.tipo === 'TO_BUSINESS' ? 'var(--verde-testo)' : 'var(--rosso-testo)' }}>
                          {x.tipo === 'TO_BUSINESS' ? '+' : '−'}{soldi(x.importo)}
                        </span>
                        <span role="cell" style={{ minWidth: 120, textAlign: 'right' }}>
                          {x.esito === 'a_mano' && !chiuso && (
                            <button type="button" className="sg-btn sg-btn-linea" onClick={() => void nonEQuesto(
                              `Tolgo il collegamento fra «${x.movimento?.descrizione}» e il pagamento ${chi}? Il movimento a mano torna normale, e il pagamento torna in Da decidere.`,
                              () => d.scollegaSatispay(x.satispayId), 'Collegamento tolto: il pagamento è in Da decidere')}>
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
      <p className="sg-sotto">
        «Non è questo» toglie il collegamento: il movimento a mano torna normale{fonte === 'satispay' ? ', non più legato a Satispay, e il pagamento torna in Da decidere' : ', e quello della banca entra come movimento nuovo'}. Non si può nei giorni con la cassa già chiusa. Un incasso nuovo sbagliato si annulla come ogni altro movimento, da MOVIMENTI.
      </p>
    </div>
  )
}
