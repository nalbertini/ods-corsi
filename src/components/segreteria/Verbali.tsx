import { useMemo, useRef, useState } from 'react'
import { oggiARoma } from '../../lib/contabilita'
import { dataLunga } from '../../lib/sala'
import type { DatiSegreteria, PersonaSeg } from '../../lib/segreteria'
import { datiVerbali } from '../../lib/verbaliDati'
import {
  TIPI_VERBALE,
  anniDei,
  avvisiVerbale,
  caricaVerbaleFirmato,
  cercaVerbali,
  cosaNonVaCaricamento,
  cosaNonVaFile,
  cosaNonVaRettifica,
  cosaNonVaSostituzione,
  etichettaArgomento,
  etichettaStato,
  etichettaTipo,
  numeroDi,
  ordinaVerbali,
  pdfInVigore,
  prossimoNumero,
  puoEliminare,
  puoModificare,
  puoRettificare,
  puoSostituirePdf,
  storiaPdf,
  type Allegato,
  type FiltroVerbali,
  type TipoVerbale,
  type Verbale,
  type VerbaleNuovo,
} from '../../lib/verbali'
import { Bozza, Campo, chiedi, Guaio, lasciare, Riga as Titolo, SchedaPiena, Tag, Tasto, Testa, useAvviso, useCarica } from './comune'

/**
 * VERBALI: le riunioni dei soci e del direttivo. Il testo si scrive fuori
 * dall'app e si firma a mano; qui si carica la scansione con i dati della
 * riunione, e il verbale nasce firmato: da lì non si cambia più, si rettifica
 * con una nota. Le regole stanno in
 * `verbali.ts`, i dati in `verbaliDati.ts`.
 */

type Fai = ReturnType<typeof useAvviso>['fai']
type Pagina = { a: 'elenco' } | { a: 'verbale'; id: string }
type Finestra = { a: 'carica'; id?: string } | { a: 'sostituisci' | 'rettifica'; id: string }

const nomeDi = (p?: PersonaSeg) => (p ? `${p.cognome} ${p.nome}` : '—')
const vuoto = (s: string) => !s.trim()
const numero = (s: string) => (vuoto(s) ? undefined : Number(s))
const peso = (b: number) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`)
type Avvisa = (t: string, guaio?: boolean) => void

async function apriPdf(a: Allegato, avvisa: Avvisa) {
  let url = ''
  try {
    url = await (await datiVerbali()).linkPdf(a)
  } catch (e) {
    return avvisa(e instanceof Error ? e.message : 'Il PDF non si apre: riprova fra poco', true)
  }
  if (!url) return avvisa('Il file non si può aprire qui: in prova i PDF non ci sono.', true)
  window.open(url, '_blank', 'noopener')
}

export function Verbali({ d, onCambiato }: { d: DatiSegreteria; onCambiato: () => void }) {
  const dati = useCarica(async () => (await datiVerbali()).leggi(), [])
  const persone = useCarica(() => d.persone(), [d])
  const [pagina, setPagina] = useState<Pagina>({ a: 'elenco' })
  const [finestra, setFinestra] = useState<Finestra | null>(null)
  const [filtro, setFiltro] = useState<FiltroVerbali>({})
  const { avviso, avvisa, fai, lavora } = useAvviso()
  const oggi = oggiARoma()

  const verbali = dati.dato ?? []
  const tutti = persone.dato ?? []
  const aperto = pagina.a === 'verbale' ? verbali.find((v) => v.id === pagina.id) : undefined
  const guaio = dati.guaio ?? persone.guaio

  const dopo = async () => {
    await dati.ricarica()
    onCambiato()
  }
  const torna = async () => {
    if (await lasciare()) setPagina({ a: 'elenco' })
  }
  const perFinestra = finestra && 'id' in finestra ? verbali.find((v) => v.id === finestra.id) : undefined

  return (
    <>
      {aperto && persone.dato && (
        <SchedaPiena key={aperto.id} etichetta={`Verbale ${numeroDi(aperto)}`} torna="I verbali" onTorna={() => void torna()}>
          <Scheda
            v={aperto}
            verbali={verbali}
            persone={tutti}
            avvisa={avvisa}
            onFinestra={setFinestra}
          />
        </SchedaPiena>
      )}

      <div className="stack" style={{ gap: 18 }}>
        <Testa titolo="VERBALI" sotto="Le riunioni dei soci e del direttivo: il PDF firmato e i dati della riunione, da ritrovare per anno. Solo la segreteria li vede.">
          <Tasto tono="pieno" disabled={!dati.dato} onClick={() => setFinestra({ a: 'carica' })}>
            Carica un verbale
          </Tasto>
        </Testa>
        {guaio && <Guaio testo={guaio} />}
        {!guaio && (dati.dato === null || persone.dato === null) && <p className="sg-sotto">Un attimo…</p>}
        {dati.dato && <Elenco verbali={verbali} filtro={filtro} onFiltro={setFiltro} avvisa={avvisa} onApri={(v) => (puoModificare(v) ? setFinestra({ a: 'carica', id: v.id }) : setPagina({ a: 'verbale', id: v.id }))} />}
      </div>

      {finestra?.a === 'carica' && (
        <Carica
          v={perFinestra}
          verbali={verbali}
          oggi={oggi}
          fai={fai}
          lavora={lavora}
          onChiudi={() => setFinestra(null)}
          onFatto={async () => {
            setFinestra(null)
            await dopo()
          }}
          onEliminato={async () => {
            setFinestra(null)
            await dopo()
          }}
        />
      )}
      {finestra?.a === 'sostituisci' && perFinestra && (
        <Sostituisci
          v={perFinestra}
          fai={fai}
          lavora={lavora}
          onChiudi={() => setFinestra(null)}
          onFatto={async () => {
            setFinestra(null)
            await dopo()
          }}
        />
      )}
      {finestra?.a === 'rettifica' && perFinestra && (
        <Rettifica
          v={perFinestra}
          oggi={oggi}
          fai={fai}
          lavora={lavora}
          onChiudi={() => setFinestra(null)}
          onFatto={async () => {
            setFinestra(null)
            await dopo()
          }}
        />
      )}
      {avviso}
    </>
  )
}

function Elenco({ verbali, filtro, onFiltro, avvisa, onApri }: { verbali: Verbale[]; filtro: FiltroVerbali; onFiltro: (f: FiltroVerbali) => void; avvisa: Avvisa; onApri: (v: Verbale) => void }) {
  const trovati = useMemo(() => cercaVerbali(verbali, filtro), [verbali, filtro])
  const { daCompletare, firmati } = ordinaVerbali(trovati)
  const cambia = (x: Partial<FiltroVerbali>) => onFiltro({ ...filtro, ...x })
  const selezione = <T extends string>(id: string, etichetta: string, valore: string | undefined, voci: readonly (readonly [T, string])[], su: (v: T | undefined) => void) => (
    <Campo id={id} etichetta={etichetta}>
      {/* Il cast è sicuro perché i valori delle option vengono tutti dall'elenco `opzioni`. */}
      <select id={id} className="sg-campo" value={valore ?? ''} onChange={(e) => su((e.target.value || undefined) as T | undefined)}>
        <option value="">Tutti</option>
        {voci.map(([k, nome]) => (
          <option key={k} value={k}>
            {nome}
          </option>
        ))}
      </select>
    </Campo>
  )
  return (
    <>
      <div className="stack" style={{ gap: 12 }}>
        <Campo id="ve-cerca" etichetta="CERCA" nota={{ guaio: false, testo: 'Per anno, riunione o parola dell’ordine del giorno. Non legge dentro i PDF.' }}>
          <input id="ve-cerca" className="sg-campo" type="search" maxLength={100} value={filtro.testo ?? ''} onChange={(e) => cambia({ testo: e.target.value || undefined })} />
        </Campo>
        <div className="sg-due">
          {selezione('ve-anno', 'ANNO', filtro.anno?.toString(), anniDei(verbali).map((a) => [String(a), String(a)] as const), (v) => cambia({ anno: v ? Number(v) : undefined }))}
          {selezione('ve-tipo', 'RIUNIONE', filtro.tipo, TIPI_VERBALE.map((t) => [t, etichettaTipo(t)] as const), (v) => cambia({ tipo: v }))}
        </div>
      </div>
      {!verbali.length && <p className="sg-sotto">Nessun verbale ancora: inizia da Carica un verbale.</p>}
      {!!verbali.length && !trovati.length && <p className="sg-sotto">Nessun verbale con questi filtri.</p>}
      {[['DA COMPLETARE', daCompletare] as const, ['FIRMATI E RETTIFICATI', firmati] as const].map(([titolo, lista]) =>
        lista.length ? (
          <div key={titolo} className="stack" style={{ gap: 10 }}>
            <Titolo titolo={`${titolo} (${lista.length})`} />
            <div role="table" aria-label={titolo.toLowerCase()} className="sg-tabella">
              <div role="row" className="sg-lista-testa sg-riga-iscritto sg-riga-verbale">
                {['N.', 'RIUNIONE', 'DATA', 'STATO', 'PDF'].map((t) => (
                  <span key={t} role="columnheader" className="sg-etichetta">
                    {t}
                  </span>
                ))}
              </div>
              <div className="sg-tabella-corpo">
                {lista.map((v) => {
                  const pdf = pdfInVigore(v)
                  return (
                  <div key={v.id} role="row" className="sg-riga-iscritto sg-riga-verbale sg-iscritto" data-bozza={v.stato === 'bozza' || undefined} onClick={() => onApri(v)}>
                    <span role="cell" className="num" style={{ fontSize: 14, fontWeight: 700 }}>
                      {numeroDi(v)}
                    </span>
                    <span role="cell" style={{ fontSize: 15, fontWeight: 600, minWidth: 0 }}>
                      <button type="button" className="sg-riga-apri">
                        {etichettaTipo(v.tipo)}
                      </button>
                      {!!v.odg.length && <span className="sg-vestiario-arrivo">{v.odg.filter((r) => r.trim()).slice(0, 2).join(' · ')}</span>}
                    </span>
                    <span role="cell" className="num" style={{ fontSize: 14 }}>
                      {v.data ? dataLunga(v.data, true) : <span className="sg-sotto">—</span>}
                    </span>
                    <span role="cell" className="row" style={{ gap: 6, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                      {/* Nell'elenco senza la data della firma, che manda a capo: è nella scheda. */}
                      <Tag tipo={v.stato === 'bozza' ? 'aspetta' : 'fatto'}>{v.stato === 'firmato' ? 'Firmato' : v.data ? etichettaStato(v) : 'Bozza · manca la data'}</Tag>
                      {v.stato === 'firmato' && !!v.rettifiche.length && <Tag tipo="aspetta">Rettificato</Tag>}
                    </span>
                    <span role="cell">
                      {pdf ? (
                        <button
                          type="button"
                          className="sg-riga-apri"
                          onClick={(e) => {
                            e.stopPropagation()
                            void apriPdf(pdf, avvisa)
                          }}
                        >
                          Apri il PDF
                        </button>
                      ) : (
                        <span className="sg-sotto">—</span>
                      )}
                    </span>
                  </div>
                  )
                })}
              </div>
            </div>
          </div>
        ) : null,
      )}
    </>
  )
}

function Cassetto({ titolo, sotto, torna, onChiudi, children }: { titolo: string; sotto?: string; torna: string; onChiudi: () => void; children: React.ReactNode }) {
  return (
    <SchedaPiena etichetta={titolo} torna={torna} onTorna={onChiudi}>
      <div className="stack" style={{ gap: 4, minWidth: 0 }}>
        <span className="ob" style={{ fontSize: 28, fontWeight: 700, letterSpacing: '0.04em', lineHeight: 1 }}>
          {titolo}
        </span>
        {sotto && (
          <span className="num" style={{ fontSize: 14, fontWeight: 700, letterSpacing: '0.14em', color: 'var(--dim)' }}>
            {sotto}
          </span>
        )}
      </div>
      {children}
    </SchedaPiena>
  )
}

const bozzaVuota = (anno: number, numeroN: number, tipo: TipoVerbale, data: string): VerbaleNuovo => ({
  anno, numero: numeroN, tipo, data, odg: [], stato: 'bozza', storico: false, delibere: [], cariche: [], allegati: [], rettifiche: [],
})

/**
 * L'unica schermata per mettere un verbale nell'app: la riunione e il PDF già firmato, in un colpo.
 * Il testo si scrive fuori (skill `preparare-verbale`). Con `v` completa una bozza rimasta (gli storici
 * importati, o un caricamento interrotto a metà).
 */
function Carica({ v, verbali, oggi, fai, lavora, onChiudi, onFatto, onEliminato }: { v?: Verbale; verbali: Verbale[]; oggi: string; fai: Fai; lavora: boolean; onChiudi: () => void; onFatto: () => Promise<void>; onEliminato: () => Promise<void> }) {
  const [file, setFile] = useState<File | null>(null)
  // Una bozza vecchia è firmata chissà quando: meglio vuoto che un oggi sbagliato.
  const [firmatoIl, setFirmatoIl] = useState(v ? '' : oggi)
  // L'id della bozza nata a un tentativo caduto a metà: il prossimo la riusa (caricaVerbaleFirmato).
  const creato = useRef(v?.id)
  const [tipo, setTipo] = useState<TipoVerbale>(v?.tipo ?? 'direttivo')
  const [data, setData] = useState(v?.data ?? '')
  const [num, setNum] = useState(v ? String(v.numero) : '')
  const [luogo, setLuogo] = useState(v?.luogo ?? '')
  const [oraInizio, setOraInizio] = useState(v?.oraInizio ?? '')
  const [oraFine, setOraFine] = useState(v?.oraFine ?? '')
  const [odg, setOdg] = useState(v?.odg.join('\n') ?? '')
  const [controllato, setControllato] = useState(false)
  // L'anno del numero lo dà la data; una bozza vecchia tiene il suo, che può essere diverso.
  const anno = v?.anno ?? (Number(data.slice(0, 4)) || Number(oggi.slice(0, 4)))
  const proposto = prossimoNumero(verbali, anno)
  const attuale: Verbale = {
    ...(v ?? { id: '', ...bozzaVuota(anno, proposto, tipo, data) }),
    anno,
    numero: numero(num) ?? proposto,
    tipo,
    data,
    luogo: luogo.trim() || undefined,
    oraInizio: oraInizio || undefined,
    oraFine: oraFine || undefined,
    odg: odg.split('\n').filter((r) => r.trim()),
  }
  const avvisi = avvisiVerbale(attuale, verbali)
  const chiudi = async () => {
    if (await lasciare()) onChiudi()
  }
  const carica = () => {
    void fai(
      async () => {
        const no = cosaNonVaCaricamento(attuale, file ? { nome: file.name, peso: file.size, tipo: file.type } : undefined, firmatoIl, oggi)
        if (no) throw new Error(no)
        if (!file) return
        if (!controllato) throw new Error('Spunta «Ho controllato» prima di caricare')
        await caricaVerbaleFirmato(await datiVerbali(), { ...attuale, id: creato.current }, { nome: file.name, peso: file.size, contenuto: file }, firmatoIl, (id) => (creato.current = id))
      },
      `Verbale ${numeroDi(attuale)} caricato`,
      onFatto,
    )
  }
  const elimina = async () => {
    if (!v || !(await chiedi(`Eliminare la bozza ${numeroDi(v)}? Spariscono anche i file caricati.`, 'Elimina la bozza', { no: 'Lascia stare', pericolo: true }))) return
    await fai(async () => (await datiVerbali()).elimina(v.id), 'Bozza eliminata', onEliminato)
  }
  const campo = (id: string, etichetta: string, valore: string, su: (x: string) => void, tipoCampo = 'text') => (
    <Campo id={id} etichetta={etichetta}>
      <input id={id} type={tipoCampo} className="sg-campo" maxLength={200} value={valore} onChange={(e) => su(e.target.value)} />
    </Campo>
  )
  return (
    <Cassetto titolo={v ? `CARICA IL VERBALE ${numeroDi(v).toUpperCase()}` : 'CARICA UN VERBALE'} sotto="IL PDF FIRMATO E I DATI DELLA RIUNIONE" torna="I verbali" onChiudi={() => void chiudi()}>
      <Bozza>
        <div className="stack" style={{ gap: 16 }}>
          <p className="sg-sotto">Il verbale si scrive fuori dall’app, si stampa e si firma a mano. Qui carichi la scansione e i dati della riunione. Vale anche per i verbali vecchi.</p>
          <Titolo titolo="IL PDF FIRMATO" />
          <Campo id="ca-pdf" etichetta="PDF" nota={{ guaio: false, testo: file ? `${file.name} · ${peso(file.size)}` : 'La scansione con le firme. Solo PDF, fino a 20 MB.' }}>
            <input id="ca-pdf" type="file" accept="application/pdf" className="sg-campo" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </Campo>
          <Campo id="ca-firmato" etichetta="FIRMATO IL">
            <input id="ca-firmato" type="date" className="sg-campo" min={data || undefined} max={oggi} value={firmatoIl} onChange={(e) => setFirmatoIl(e.target.value)} />
          </Campo>
          <Titolo titolo="LA RIUNIONE" />
          <div className="sg-due">
            <Campo id="ca-tipo" etichetta="RIUNIONE">
              {/* Il cast è sicuro perché le option vengono tutte da TIPI_VERBALE. */}
              <select id="ca-tipo" className="sg-campo" value={tipo} onChange={(e) => setTipo(e.target.value as TipoVerbale)}>
                {TIPI_VERBALE.map((t) => (
                  <option key={t} value={t}>
                    {etichettaTipo(t)}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo id="ca-num" etichetta="NUMERO" nota={v ? undefined : { guaio: false, testo: `Se lo lasci vuoto è il ${numeroDi({ numero: proposto, anno })}, il prossimo libero. Per un verbale vecchio scrivi il suo.` }}>
              <input id="ca-num" className="sg-campo num" inputMode="numeric" placeholder={String(proposto)} value={num} onChange={(e) => setNum(e.target.value.replace(/\D/g, ''))} />
            </Campo>
          </div>
          <div className="sg-due">
            {campo('ca-data', 'DATA', data, setData, 'date')}
            {campo('ca-luogo', 'DOVE', luogo, setLuogo)}
          </div>
          <div className="sg-due">
            {campo('ca-inizio', 'INIZIO', oraInizio, setOraInizio, 'time')}
            {campo('ca-fine', 'FINE', oraFine, setOraFine, 'time')}
          </div>
          <Campo id="ca-odg" etichetta="ORDINE DEL GIORNO · UN PUNTO PER RIGA (SE VUOI)" nota={{ guaio: false, testo: 'Serve solo per ritrovarlo con la ricerca.' }}>
            <textarea id="ca-odg" className="sg-campo" rows={4} value={odg} onChange={(e) => setOdg(e.target.value)} />
          </Campo>
          {avvisi.map((a) => (
            <span key={a} className="sg-sotto" role="note" style={{ color: 'var(--rosso-testo)' }}>
              {a}
            </span>
          ))}
          <div className="sg-spunte">
            <label className="sg-elenco-casella">
              <input type="checkbox" checked={controllato} onChange={(e) => setControllato(e.target.checked)} />
              Ho controllato: il PDF è firmato e i dati sono quelli del foglio
            </label>
          </div>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <Tasto onClick={() => void chiudi()}>Annulla</Tasto>
            <Tasto tono="pieno" disabled={lavora} onClick={carica}>
              Carica
            </Tasto>
            {v && puoEliminare(v) && (
              <Tasto className="sg-pericolo" disabled={lavora} onClick={() => void elimina()}>
                Elimina la bozza
              </Tasto>
            )}
          </div>
        </div>
      </Bozza>
    </Cassetto>
  )
}

function Scheda({ v, verbali, persone, avvisa, onFinestra }: { v: Verbale; verbali: Verbale[]; persone: PersonaSeg[]; avvisa: Avvisa; onFinestra: (f: Finestra) => void }) {
  const avvisi = avvisiVerbale(v, verbali)
  const nome = (id?: string) => nomeDi(persone.find((p) => p.id === id))
  const apri = (a: Allegato) => apriPdf(a, avvisa)
  const pdf = pdfInVigore(v)
  const sostituiti = v.allegati.filter((a) => a.sostituitoIl)

  const testa = (
    <div className="stack" style={{ gap: 6 }}>
      <span className="ob" style={{ fontSize: 28, fontWeight: 700, letterSpacing: '0.04em', lineHeight: 1 }}>
        {etichettaTipo(v.tipo).toUpperCase()} {numeroDi(v)}
      </span>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <Tag tipo="fatto">{etichettaStato(v)}</Tag>
        {!!v.rettifiche.length && <Tag tipo="aspetta">Rettificato</Tag>}
        {v.data && <span className="sg-sotto">Riunione del {dataLunga(v.data)}</span>}
      </div>
    </div>
  )

  const avvisiVista = !!avvisi.length && (
    <div className="stack" style={{ gap: 4 }} role="note">
      {avvisi.map((a) => (
        <span key={a} className="sg-sotto" style={{ color: 'var(--rosso-testo)' }}>
          {a}
        </span>
      ))}
    </div>
  )

  const doc = (titolo: string, ...righe: (string | undefined | false)[]) => {
    const ok = righe.filter(Boolean)
    return ok.length ? (
      <div className="stack" style={{ gap: 6 }}>
        <Titolo titolo={titolo} />
        {ok.map((r, i) => (
          <span key={i}>{r}</span>
        ))}
      </div>
    ) : null
  }
  return (
    <div className="stack" style={{ gap: 18 }}>
      {testa}
      {avvisiVista}
      {v.rettifiche.length > 0 && (
        <div className="stack" style={{ gap: 6 }}>
          <Titolo titolo="RETTIFICA" />
          <span className="sg-sotto">Il testo originale resta com’è: le rettifiche lo correggono senza cancellarlo.</span>
          {v.rettifiche.map((r, i) => (
            <span key={i}>
              <b>{dataLunga(r.data)}</b> · {r.motivo}: {r.testo}
            </span>
          ))}
        </div>
      )}
      {doc(
        'LA RIUNIONE',
        v.luogo && `Luogo: ${v.luogo}`,
        v.oraInizio && `Dalle ${v.oraInizio}${v.oraFine ? ` alle ${v.oraFine}` : ''}`,
        v.presidenteId && `Presidente: ${nome(v.presidenteId)}`,
        v.segretarioId && `Segretario: ${nome(v.segretarioId)}`,
        v.aventiDiritto !== undefined && `Aventi diritto: ${v.aventiDiritto}`,
        v.presenti !== undefined && `Presenti: ${v.presenti}${v.deleghe ? ` + ${v.deleghe} deleghe` : ''}`,
      )}
      {doc('ORDINE DEL GIORNO', ...v.odg.map((r, i) => `${i + 1}. ${r}`))}
      {doc(
        'DELIBERE',
        ...v.delibere.map(
          (x) =>
            `${x.titolo} · ${etichettaArgomento(x.argomento)}${x.bilancioTipo ? ` ${x.bilancioTipo}${x.annoRif ? ` ${x.annoRif}` : ''}` : ''}${x.esito ? ` · ${x.esito}` : ''}${x.comeVotato ? ` (${x.comeVotato})` : ''}`,
        ),
      )}
      {doc('CARICHE ELETTE', ...v.cariche.map((c) => `${c.carica}: ${nome(c.personaId)}${c.dal ? ` dal ${dataLunga(c.dal)}` : ''}${c.al ? ` al ${dataLunga(c.al)}` : ''}`))}
      {v.testo && doc('IL TESTO', v.testo)}
      <div className="stack" style={{ gap: 6 }}>
        <Titolo titolo="ALLEGATI" />
        {pdf ? (
          <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span>
              {pdf.nome} · {peso(pdf.peso)}
            </span>
            <Tasto onClick={() => void apri(pdf)}>Apri</Tasto>
            {puoSostituirePdf(v) && <Tasto onClick={() => onFinestra({ a: 'sostituisci', id: v.id })}>Sostituisci</Tasto>}
          </div>
        ) : (
          <span className="sg-sotto">Nessun PDF.</span>
        )}
        {sostituiti.map((a) => (
          <div key={a.id} className="row" style={{ gap: 8, alignItems: 'center' }}>
            <span className="sg-sotto">{a.nome} · sostituito</span>
            <Tasto onClick={() => void apri(a)}>Apri</Tasto>
          </div>
        ))}
      </div>
      <div className="stack" style={{ gap: 6 }}>
        <Titolo titolo="LA STORIA" />
        {storiaPdf(v).map((s, i) => (
          <span key={i}>
            {dataLunga(s.quando)} · {s.cosa}
            {s.motivo ? ` — ${s.motivo}` : ''}
          </span>
        ))}
      </div>
      {puoRettificare(v) && (
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <Tasto tono="pieno" onClick={() => onFinestra({ a: 'rettifica', id: v.id })}>
            Scrivi una rettifica
          </Tasto>
        </div>
      )}
    </div>
  )
}

function Sostituisci({ v, fai, lavora, onChiudi, onFatto }: { v: Verbale; fai: Fai; lavora: boolean; onChiudi: () => void; onFatto: () => Promise<void> }) {
  const [file, setFile] = useState<File | null>(null)
  const [motivo, setMotivo] = useState('')
  const chiudi = async () => {
    if (await lasciare()) onChiudi()
  }
  const sostituisci = () => {
    void fai(
      async () => {
        if (!file) throw new Error('Carica il nuovo PDF')
        const no = cosaNonVaFile({ nome: file.name, peso: file.size, tipo: file.type }) ?? cosaNonVaSostituzione(motivo)
        if (no) throw new Error(no)
        await (await datiVerbali()).sostituisciPdf(v.id, { nome: file.name, peso: file.size, contenuto: file }, motivo)
      },
      'PDF sostituito: il vecchio resta nella storia',
      onFatto,
    )
  }
  return (
    <Cassetto titolo={`SOSTITUISCI IL PDF DI ${numeroDi(v).toUpperCase()}`} torna={`Verbale ${numeroDi(v)}`} onChiudi={() => void chiudi()}>
      <Bozza>
        <div className="stack" style={{ gap: 16 }}>
          <Campo id="so-pdf" etichetta="NUOVO PDF" nota={file ? { guaio: false, testo: `${file.name} · ${peso(file.size)}` } : undefined}>
            <input id="so-pdf" type="file" accept="application/pdf" className="sg-campo" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </Campo>
          <Campo id="so-motivo" etichetta="PERCHÉ SI SOSTITUISCE" nota={{ guaio: false, testo: 'Per esempio: scansione illeggibile, pagina mancante.' }}>
            <textarea id="so-motivo" className="sg-campo" rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          </Campo>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <Tasto onClick={() => void chiudi()}>Lascia stare</Tasto>
            <Tasto tono="pieno" disabled={lavora} onClick={sostituisci}>
              Sostituisci il PDF
            </Tasto>
          </div>
        </div>
      </Bozza>
    </Cassetto>
  )
}

function Rettifica({ v, oggi, fai, lavora, onChiudi, onFatto }: { v: Verbale; oggi: string; fai: Fai; lavora: boolean; onChiudi: () => void; onFatto: () => Promise<void> }) {
  const [data, setData] = useState(oggi)
  const [motivo, setMotivo] = useState('')
  const [testo, setTesto] = useState('')
  const chiudi = async () => {
    if (await lasciare()) onChiudi()
  }
  const salva = () => {
    void fai(
      async () => {
        const r = { data, motivo, testo }
        const no = cosaNonVaRettifica(r)
        if (no) throw new Error(no)
        await (await datiVerbali()).rettifica(v.id, r)
      },
      'Rettifica scritta',
      onFatto,
    )
  }
  return (
    <Cassetto titolo={`RETTIFICA DI ${numeroDi(v).toUpperCase()}`} torna={`Verbale ${numeroDi(v)}`} onChiudi={() => void chiudi()}>
      <Bozza>
        <div className="stack" style={{ gap: 16 }}>
          <p className="sg-sotto">Il verbale firmato non cambia: la rettifica si aggiunge sotto, con la sua data.</p>
          <Campo id="re-data" etichetta="DATA">
            <input id="re-data" type="date" className="sg-campo" max={oggi} value={data} onChange={(e) => setData(e.target.value)} />
          </Campo>
          <Campo id="re-motivo" etichetta="MOTIVO">
            <input id="re-motivo" className="sg-campo" maxLength={200} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          </Campo>
          <Campo id="re-testo" etichetta="COSA CAMBIA">
            <textarea id="re-testo" className="sg-campo" rows={4} value={testo} onChange={(e) => setTesto(e.target.value)} />
          </Campo>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <Tasto onClick={() => void chiudi()}>Lascia stare</Tasto>
            <Tasto tono="pieno" disabled={lavora} onClick={salva}>
              Scrivi la rettifica
            </Tasto>
          </div>
        </div>
      </Bozza>
    </Cassetto>
  )
}
