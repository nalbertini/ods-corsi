import { useMemo, useState } from 'react'
import { oggiARoma } from '../../lib/contabilita'
import { dataLunga } from '../../lib/sala'
import type { DatiSegreteria, PersonaSeg } from '../../lib/segreteria'
import { datiVerbali } from '../../lib/verbaliDati'
import {
  ARGOMENTI_VERBALE,
  TIPI_VERBALE,
  anniDei,
  avvisiVerbale,
  cercaVerbali,
  cosaNonVaDataFirma,
  cosaNonVaFile,
  cosaNonVaRettifica,
  cosaNonVaSostituzione,
  cosaNonVaVerbale,
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
  segretariPossibili,
  storiaPdf,
  type Allegato,
  type Argomento,
  type Carica,
  type Delibera,
  type FiltroVerbali,
  type TipoVerbale,
  type Verbale,
  type VerbaleNuovo,
} from '../../lib/verbali'
import { nuovoId } from '../../lib/prove'
import { Bozza, Campo, chiedi, Guaio, lasciare, Riga as Titolo, SchedaPiena, Tag, Tasto, Testa, useAvviso, useCarica } from './comune'

/**
 * VERBALI: le riunioni dei soci e del direttivo. Si scrivono in bozza, si
 * firmano a mano sul foglio, si carica la scansione e si segna come firmato;
 * da lì non si cambia più, si rettifica con una nota. Le regole stanno in
 * `verbali.ts`, i dati in `verbaliDati.ts`.
 */

type Fai = ReturnType<typeof useAvviso>['fai']
type Pagina = { a: 'elenco' } | { a: 'verbale'; id: string }
type Finestra = { a: 'nuovo' } | { a: 'firma' | 'sostituisci' | 'rettifica'; id: string }

const nomeDi = (p?: PersonaSeg) => (p ? `${p.cognome} ${p.nome}` : '—')
const vuoto = (s: string) => !s.trim()
const numero = (s: string) => (vuoto(s) ? undefined : Number(s))
const peso = (b: number) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`)

export function Verbali({ d, onCambiato }: { d: DatiSegreteria; onCambiato: () => void }) {
  const dati = useCarica(async () => (await datiVerbali()).leggi(), [])
  const segretari = useCarica(async () => (await datiVerbali()).leggiSegretari(), [])
  const persone = useCarica(() => d.persone(), [d])
  const [pagina, setPagina] = useState<Pagina>({ a: 'elenco' })
  const [finestra, setFinestra] = useState<Finestra | null>(null)
  const [filtro, setFiltro] = useState<FiltroVerbali>({})
  const { avviso, avvisa, fai, lavora } = useAvviso()
  const oggi = oggiARoma()

  const verbali = dati.dato ?? []
  const tutti = persone.dato ?? []
  const aperto = pagina.a === 'verbale' ? verbali.find((v) => v.id === pagina.id) : undefined
  const guaio = dati.guaio ?? persone.guaio ?? segretari.guaio

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
            segretari={segretari.dato ?? []}
            fai={fai}
            avvisa={avvisa}
            lavora={lavora}
            onCambiato={dopo}
            onFinestra={setFinestra}
            onEliminato={async () => {
              setPagina({ a: 'elenco' })
              await dopo()
            }}
          />
        </SchedaPiena>
      )}

      <div className="stack" style={{ gap: 18 }}>
        <Testa titolo="VERBALI" sotto="Le riunioni dei soci e del direttivo: si scrivono, si firmano e si ritrovano per anno e argomento. Solo la segreteria li vede.">
          <Tasto tono="pieno" disabled={!dati.dato} onClick={() => setFinestra({ a: 'nuovo' })}>
            Nuovo verbale
          </Tasto>
        </Testa>
        {guaio && <Guaio testo={guaio} />}
        {!guaio && (dati.dato === null || persone.dato === null) && <p className="sg-sotto">Un attimo…</p>}
        {dati.dato && <Elenco verbali={verbali} filtro={filtro} onFiltro={setFiltro} onApri={(id) => setPagina({ a: 'verbale', id })} />}
      </div>

      {finestra?.a === 'nuovo' && (
        <NuovoVerbale
          verbali={verbali}
          oggi={oggi}
          fai={fai}
          lavora={lavora}
          onChiudi={() => setFinestra(null)}
          onSalvato={async (id) => {
            setFinestra(null)
            await dopo()
            setPagina({ a: 'verbale', id })
          }}
        />
      )}
      {finestra?.a === 'firma' && perFinestra && (
        <Firma
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

function Elenco({ verbali, filtro, onFiltro, onApri }: { verbali: Verbale[]; filtro: FiltroVerbali; onFiltro: (f: FiltroVerbali) => void; onApri: (id: string) => void }) {
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
        <Campo id="ve-cerca" etichetta="CERCA" nota={{ guaio: false, testo: 'La ricerca guarda i titoli, gli argomenti e il testo scritto qui. Non legge dentro i PDF caricati.' }}>
          <input id="ve-cerca" className="sg-campo" type="search" maxLength={100} value={filtro.testo ?? ''} onChange={(e) => cambia({ testo: e.target.value || undefined })} />
        </Campo>
        <div className="sg-due">
          {selezione('ve-anno', 'ANNO', filtro.anno?.toString(), anniDei(verbali).map((a) => [String(a), String(a)] as const), (v) => cambia({ anno: v ? Number(v) : undefined }))}
          {selezione('ve-tipo', 'RIUNIONE', filtro.tipo, TIPI_VERBALE.map((t) => [t, etichettaTipo(t)] as const), (v) => cambia({ tipo: v }))}
        </div>
        <div className="sg-due">
          {selezione('ve-argomento', 'ARGOMENTO', filtro.argomento, ARGOMENTI_VERBALE.map((a) => [a, etichettaArgomento(a)] as const), (v) => cambia({ argomento: v }))}
          {selezione('ve-stato', 'STATO', filtro.stato, [['bozza', 'Bozza'], ['firmato', 'Firmato'], ['rettificato', 'Rettificato']] as const, (v) => cambia({ stato: v }))}
        </div>
      </div>
      {!verbali.length && <p className="sg-sotto">Nessun verbale ancora: inizia da Nuovo verbale.</p>}
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
                {lista.map((v) => (
                  <div key={v.id} role="row" className="sg-riga-iscritto sg-riga-verbale sg-iscritto" data-bozza={v.stato === 'bozza' || undefined} onClick={() => onApri(v.id)}>
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
                    <span role="cell">
                      <Tag tipo={v.stato === 'bozza' ? 'aspetta' : 'fatto'}>{v.stato === 'bozza' && !v.data ? 'Bozza · manca la data' : etichettaStato(v)}</Tag>
                      {v.stato === 'firmato' && !!v.rettifiche.length && <Tag tipo="aspetta">Rettificato</Tag>}
                    </span>
                    <span role="cell">{pdfInVigore(v) ? 'PDF' : <span className="sg-sotto">—</span>}</span>
                  </div>
                ))}
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

const bozzaVuota = (anno: number, numeroN: number, tipo: TipoVerbale, data: string, odg: string[]): VerbaleNuovo => ({
  anno, numero: numeroN, tipo, data, odg, stato: 'bozza', storico: false, delibere: [], cariche: [], allegati: [], rettifiche: [],
})

function NuovoVerbale({ verbali, oggi, fai, lavora, onChiudi, onSalvato }: { verbali: Verbale[]; oggi: string; fai: Fai; lavora: boolean; onChiudi: () => void; onSalvato: (id: string) => Promise<void> }) {
  const [tipo, setTipo] = useState<TipoVerbale>('direttivo')
  const [data, setData] = useState(oggi)
  const [num, setNum] = useState('')
  const [odg, setOdg] = useState('')
  const anno = Number(data.slice(0, 4)) || Number(oggi.slice(0, 4))
  const proposto = prossimoNumero(verbali, anno)
  const chiudi = async () => {
    if (await lasciare()) onChiudi()
  }
  const salva = () => {
    const v = bozzaVuota(anno, numero(num) ?? proposto, tipo, data, odg.split('\n').filter((r) => r.trim()))
    let id = ''
    void fai(
      async () => {
        id = await (await datiVerbali()).salva(v)
      },
      'Bozza salvata',
      () => onSalvato(id),
    )
  }
  return (
    <Cassetto titolo="NUOVO VERBALE" torna="I verbali" onChiudi={() => void chiudi()}>
      <Bozza>
        <div className="stack" style={{ gap: 16 }}>
          <div className="sg-due">
            <Campo id="nv-tipo" etichetta="RIUNIONE">
              <select id="nv-tipo" className="sg-campo" value={tipo} onChange={(e) => setTipo(e.target.value as TipoVerbale)}>
                {TIPI_VERBALE.map((t) => (
                  <option key={t} value={t}>
                    {etichettaTipo(t)}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo id="nv-data" etichetta="DATA">
              <input id="nv-data" type="date" className="sg-campo" value={data} onChange={(e) => setData(e.target.value)} />
            </Campo>
          </div>
          <Campo id="nv-num" etichetta="NUMERO" nota={{ guaio: false, testo: `Se lo lasci vuoto è il ${proposto}: ${numeroDi({ numero: proposto, anno })}.` }}>
            <input id="nv-num" className="sg-campo num" inputMode="numeric" placeholder={String(proposto)} value={num} onChange={(e) => setNum(e.target.value.replace(/\D/g, ''))} />
          </Campo>
          <Campo id="nv-odg" etichetta="DI COSA SI PARLA · FACOLTATIVO" nota={{ guaio: false, testo: 'Un punto per riga: l’ordine del giorno.' }}>
            <textarea id="nv-odg" className="sg-campo" rows={4} value={odg} onChange={(e) => setOdg(e.target.value)} />
          </Campo>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <Tasto onClick={() => void chiudi()}>Lascia stare</Tasto>
            <Tasto tono="pieno" disabled={lavora} onClick={salva}>
              Salva la bozza
            </Tasto>
          </div>
        </div>
      </Bozza>
    </Cassetto>
  )
}

interface Form {
  tipo: TipoVerbale
  anno: string
  numero: string
  data: string
  oraInizio: string
  oraFine: string
  luogo: string
  odg: string
  presidenteId: string
  segretarioId: string
  aventiDiritto: string
  presenti: string
  deleghe: string
  testo: string
  delibere: Delibera[]
  cariche: Carica[]
}

const daVerbale = (v: Verbale): Form => ({
  tipo: v.tipo,
  anno: String(v.anno),
  numero: String(v.numero),
  data: v.data,
  oraInizio: v.oraInizio ?? '',
  oraFine: v.oraFine ?? '',
  luogo: v.luogo ?? '',
  odg: v.odg.join('\n'),
  presidenteId: v.presidenteId ?? '',
  segretarioId: v.segretarioId ?? '',
  aventiDiritto: v.aventiDiritto?.toString() ?? '',
  presenti: v.presenti?.toString() ?? '',
  deleghe: v.deleghe?.toString() ?? '',
  testo: v.testo ?? '',
  delibere: v.delibere,
  cariche: v.cariche,
})

const inVerbale = (f: Form, v: Verbale): Verbale => ({
  ...v,
  tipo: f.tipo,
  anno: Number(f.anno) || v.anno,
  numero: Number(f.numero) || v.numero,
  data: f.data,
  oraInizio: f.oraInizio || undefined,
  oraFine: f.oraFine || undefined,
  luogo: f.luogo.trim() || undefined,
  odg: f.odg.split('\n').filter((r) => r.trim()),
  presidenteId: f.presidenteId || undefined,
  segretarioId: f.segretarioId || undefined,
  aventiDiritto: numero(f.aventiDiritto),
  presenti: numero(f.presenti),
  deleghe: numero(f.deleghe),
  testo: f.testo.trim() || undefined,
  delibere: f.delibere.filter((x) => x.titolo.trim()),
  cariche: f.cariche.filter((c) => c.carica.trim() && c.personaId),
})

function Scheda({
  v,
  verbali,
  persone,
  segretari,
  fai,
  avvisa,
  lavora,
  onCambiato,
  onFinestra,
  onEliminato,
}: {
  v: Verbale
  verbali: Verbale[]
  persone: PersonaSeg[]
  segretari: string[]
  fai: Fai
  avvisa: (t: string, guaio?: boolean) => void
  lavora: boolean
  onCambiato: () => Promise<void>
  onFinestra: (f: Finestra) => void
  onEliminato: () => Promise<void>
}) {
  const bozza = puoModificare(v)
  const [f, setF] = useState<Form>(() => daVerbale(v))
  const cambia = (x: Partial<Form>) => setF((y) => ({ ...y, ...x }))
  const attuale = bozza ? inVerbale(f, v) : v
  const avvisi = avvisiVerbale(attuale, verbali)
  const nome = (id?: string) => nomeDi(persone.find((p) => p.id === id))
  const possibili = segretariPossibili(segretari, [], persone)
  // Il segretario già scelto resta nella lista anche se non è più fra i segretari delle regole.
  const opzioniSegretario = f.segretarioId && !possibili.some((p) => p.id === f.segretarioId) ? [...possibili, ...persone.filter((p) => p.id === f.segretarioId)] : possibili

  const salva = () => {
    const no = cosaNonVaVerbale(attuale)
    if (no) return avvisa(no, true)
    void fai(async () => void (await datiVerbali()).salva(attuale), 'Bozza salvata', onCambiato)
  }
  const elimina = async () => {
    if (!(await chiedi(`Eliminare la bozza ${numeroDi(v)}? Spariscono anche i file caricati.`, 'Elimina la bozza', { no: 'Lascia stare', pericolo: true }))) return
    await fai(async () => (await datiVerbali()).elimina(v.id), 'Bozza eliminata', onEliminato)
  }
  const apri = async (a: Allegato) => {
    let url = ''
    try {
      url = await (await datiVerbali()).linkPdf(a)
    } catch (e) {
      return avvisa(e instanceof Error ? e.message : 'Il PDF non si apre: riprova fra poco', true)
    }
    if (!url) return avvisa('Il file non si può aprire qui: in prova i PDF non ci sono.', true)
    window.open(url, '_blank', 'noopener')
  }
  const pdf = pdfInVigore(v)
  const sostituiti = v.allegati.filter((a) => a.sostituitoIl)

  const testa = (
    <div className="stack" style={{ gap: 6 }}>
      <span className="ob" style={{ fontSize: 28, fontWeight: 700, letterSpacing: '0.04em', lineHeight: 1 }}>
        {etichettaTipo(v.tipo).toUpperCase()} {numeroDi(v)}
      </span>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <Tag tipo={bozza ? 'aspetta' : 'fatto'}>{bozza ? 'Bozza' : etichettaStato(v)}</Tag>
        {!bozza && !!v.rettifiche.length && <Tag tipo="aspetta">Rettificato</Tag>}
        {v.data && <span className="sg-sotto">{dataLunga(v.data)}</span>}
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

  if (!bozza) {
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

  const sel = (id: string, etichetta: string, valore: string, su: (x: string) => void, lista: PersonaSeg[], nota?: string) => (
    <Campo id={id} etichetta={etichetta} nota={nota ? { guaio: false, testo: nota } : undefined}>
      <select id={id} className="sg-campo" value={valore} onChange={(e) => su(e.target.value)}>
        <option value="">—</option>
        {lista.map((p) => (
          <option key={p.id} value={p.id}>
            {nomeDi(p)}
          </option>
        ))}
      </select>
    </Campo>
  )
  const num = (id: string, etichetta: string, k: 'aventiDiritto' | 'presenti' | 'deleghe', nota?: string) => (
    <Campo id={id} etichetta={etichetta} nota={nota ? { guaio: false, testo: nota } : undefined}>
      <input id={id} className="sg-campo num" inputMode="numeric" value={f[k]} onChange={(e) => cambia({ [k]: e.target.value.replace(/\D/g, '') })} />
    </Campo>
  )
  const cambiaDelibera = (i: number, x: Partial<Delibera>) => cambia({ delibere: f.delibere.map((y, j) => (j === i ? { ...y, ...x } : y)) })
  const cambiaCarica = (i: number, x: Partial<Carica>) => cambia({ cariche: f.cariche.map((y, j) => (j === i ? { ...y, ...x } : y)) })

  return (
    <Bozza>
      <div className="stack" style={{ gap: 16 }}>
        {testa}
        {avvisiVista}
        <div className="sg-due">
          <Campo id="vb-tipo" etichetta="RIUNIONE">
            <select id="vb-tipo" className="sg-campo" value={f.tipo} onChange={(e) => cambia({ tipo: e.target.value as TipoVerbale })}>
              {TIPI_VERBALE.map((t) => (
                <option key={t} value={t}>
                  {etichettaTipo(t)}
                </option>
              ))}
            </select>
          </Campo>
          <Campo id="vb-data" etichetta="DATA">
            <input id="vb-data" type="date" className="sg-campo" value={f.data} onChange={(e) => cambia({ data: e.target.value, anno: e.target.value ? e.target.value.slice(0, 4) : f.anno })} />
          </Campo>
        </div>
        <div className="sg-due">
          <Campo id="vb-numero" etichetta="NUMERO">
            <input id="vb-numero" className="sg-campo num" inputMode="numeric" value={f.numero} onChange={(e) => cambia({ numero: e.target.value.replace(/\D/g, '') })} />
          </Campo>
          <Campo id="vb-anno" etichetta="ANNO DEL NUMERO">
            <input id="vb-anno" className="sg-campo num" inputMode="numeric" value={f.anno} onChange={(e) => cambia({ anno: e.target.value.replace(/\D/g, '') })} />
          </Campo>
        </div>
        <div className="sg-due">
          <Campo id="vb-ini" etichetta="DALLE">
            <input id="vb-ini" type="time" className="sg-campo" value={f.oraInizio} onChange={(e) => cambia({ oraInizio: e.target.value })} />
          </Campo>
          <Campo id="vb-fine" etichetta="ALLE">
            <input id="vb-fine" type="time" className="sg-campo" value={f.oraFine} onChange={(e) => cambia({ oraFine: e.target.value })} />
          </Campo>
        </div>
        <Campo id="vb-luogo" etichetta="LUOGO">
          <input id="vb-luogo" className="sg-campo" maxLength={200} value={f.luogo} onChange={(e) => cambia({ luogo: e.target.value })} />
        </Campo>
        <Campo id="vb-odg" etichetta="ORDINE DEL GIORNO" nota={{ guaio: false, testo: 'Un punto per riga.' }}>
          <textarea id="vb-odg" className="sg-campo" rows={4} value={f.odg} onChange={(e) => cambia({ odg: e.target.value })} />
        </Campo>
        <div className="sg-due">
          {sel('vb-pres', 'PRESIDENTE', f.presidenteId, (x) => cambia({ presidenteId: x }), persone)}
          {sel('vb-seg', 'SEGRETARIO', f.segretarioId, (x) => cambia({ segretarioId: x }), opzioniSegretario, segretari.length ? undefined : 'La lista dei segretari si scrive in REGOLE.')}
        </div>
        <div className="sg-due">
          {num('vb-aventi', 'AVENTI DIRITTO', 'aventiDiritto', 'I soci che potevano votare.')}
          {num('vb-presenti', 'PRESENTI', 'presenti')}
        </div>
        {num('vb-deleghe', 'DELEGHE', 'deleghe')}

        <div className="stack" style={{ gap: 8 }}>
          <Titolo titolo="DELIBERE" />
          {f.delibere.map((x, i) => (
            <div key={x.id} className="stack" style={{ gap: 8 }}>
              <div className="row" style={{ gap: 8 }}>
                <label htmlFor={`vb-d-t-${i}`} className="vh">
                  Titolo della delibera {i + 1}
                </label>
                <input id={`vb-d-t-${i}`} className="sg-campo grow" placeholder="Titolo" maxLength={200} value={x.titolo} onChange={(e) => cambiaDelibera(i, { titolo: e.target.value })} />
                <Tasto className="sg-pericolo" onClick={() => cambia({ delibere: f.delibere.filter((_, j) => j !== i) })}>
                  Togli
                </Tasto>
              </div>
              <div className="sg-due">
                <Campo id={`vb-d-a-${i}`} etichetta="ARGOMENTO">
                  <select id={`vb-d-a-${i}`} className="sg-campo" value={x.argomento} onChange={(e) => cambiaDelibera(i, { argomento: e.target.value as Argomento })}>
                    {ARGOMENTI_VERBALE.map((a) => (
                      <option key={a} value={a}>
                        {etichettaArgomento(a)}
                      </option>
                    ))}
                  </select>
                </Campo>
                <Campo id={`vb-d-e-${i}`} etichetta="ESITO">
                  <select id={`vb-d-e-${i}`} className="sg-campo" value={x.esito ?? ''} onChange={(e) => cambiaDelibera(i, { esito: (e.target.value || undefined) as Delibera['esito'] })}>
                    <option value="">—</option>
                    <option value="approvata">Approvata</option>
                    <option value="respinta">Respinta</option>
                    <option value="rinviata">Rinviata</option>
                  </select>
                </Campo>
              </div>
              <div className="sg-due">
                <Campo id={`vb-d-v-${i}`} etichetta="COME SI È VOTATO">
                  <input id={`vb-d-v-${i}`} className="sg-campo" list="vb-voto" maxLength={100} value={x.comeVotato ?? ''} onChange={(e) => cambiaDelibera(i, { comeVotato: e.target.value || undefined })} />
                </Campo>
                {x.argomento === 'bilancio' && (
                  <Campo id={`vb-d-b-${i}`} etichetta="BILANCIO">
                    <div className="row" style={{ gap: 8 }}>
                      <select id={`vb-d-b-${i}`} className="sg-campo" value={x.bilancioTipo ?? ''} onChange={(e) => cambiaDelibera(i, { bilancioTipo: (e.target.value || undefined) as Delibera['bilancioTipo'] })}>
                        <option value="">—</option>
                        <option value="preventivo">Preventivo</option>
                        <option value="consuntivo">Consuntivo</option>
                      </select>
                      <label htmlFor={`vb-d-y-${i}`} className="vh">
                        Anno del bilancio
                      </label>
                      <input id={`vb-d-y-${i}`} className="sg-campo num" inputMode="numeric" placeholder="Anno" value={x.annoRif ?? ''} onChange={(e) => cambiaDelibera(i, { annoRif: numero(e.target.value.replace(/\D/g, '')) })} />
                    </div>
                  </Campo>
                )}
              </div>
            </div>
          ))}
          <datalist id="vb-voto">
            {['all’unanimità', 'a maggioranza', 'alzata di mano', 'per scrutinio', 'presa d’atto'].map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
          <div>
            <Tasto onClick={() => cambia({ delibere: [...f.delibere, { id: nuovoId(), titolo: '', argomento: 'altro' }] })}>Aggiungi una delibera</Tasto>
          </div>
        </div>

        <div className="stack" style={{ gap: 8 }}>
          <Titolo titolo="CARICHE ELETTE" />
          {f.cariche.map((c, i) => (
            <div key={i} className="stack" style={{ gap: 8 }}>
              <div className="sg-due">
                <Campo id={`vb-c-c-${i}`} etichetta="CARICA">
                  <input id={`vb-c-c-${i}`} className="sg-campo" list="vb-cariche" maxLength={100} value={c.carica} onChange={(e) => cambiaCarica(i, { carica: e.target.value })} />
                </Campo>
                {sel(`vb-c-p-${i}`, 'PERSONA', c.personaId, (x) => cambiaCarica(i, { personaId: x }), persone)}
              </div>
              <div className="sg-due">
                <Campo id={`vb-c-d-${i}`} etichetta="DAL">
                  <input id={`vb-c-d-${i}`} type="date" className="sg-campo" value={c.dal ?? ''} onChange={(e) => cambiaCarica(i, { dal: e.target.value || undefined })} />
                </Campo>
                <Campo id={`vb-c-a-${i}`} etichetta="AL">
                  <input id={`vb-c-a-${i}`} type="date" className="sg-campo" value={c.al ?? ''} onChange={(e) => cambiaCarica(i, { al: e.target.value || undefined })} />
                </Campo>
              </div>
              <div>
                <Tasto className="sg-pericolo" onClick={() => cambia({ cariche: f.cariche.filter((_, j) => j !== i) })}>
                  Togli la carica
                </Tasto>
              </div>
            </div>
          ))}
          <datalist id="vb-cariche">
            {['Presidente', 'Vicepresidente', 'Segretario', 'Tesoriere', 'Consigliere'].map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
          <div>
            <Tasto onClick={() => cambia({ cariche: [...f.cariche, { carica: '', personaId: '' }] })}>Aggiungi una carica</Tasto>
          </div>
        </div>

        <Campo id="vb-testo" etichetta="TESTO · FACOLTATIVO" nota={{ guaio: false, testo: 'Il testo scritto qui si cerca; il PDF caricato no.' }}>
          <textarea id="vb-testo" className="sg-campo" rows={6} value={f.testo} onChange={(e) => cambia({ testo: e.target.value })} />
        </Campo>

        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <Tasto tono="pieno" disabled={lavora} onClick={salva}>
            Salva la bozza
          </Tasto>
          <Tasto
            disabled={lavora}
            onClick={() => {
              // Si firma quel che c'è salvato: prima si salva, poi si apre la finestra.
              void fai(async () => void (await datiVerbali()).salva(attuale), undefined, async () => {
                await onCambiato()
                onFinestra({ a: 'firma', id: v.id })
              })
            }}
          >
            Segna come firmato
          </Tasto>
          {puoEliminare(v) && (
            <Tasto className="sg-pericolo" disabled={lavora} onClick={() => void elimina()}>
              Elimina la bozza
            </Tasto>
          )}
        </div>
      </div>
    </Bozza>
  )
}

function Firma({ v, verbali, oggi, fai, lavora, onChiudi, onFatto }: { v: Verbale; verbali: Verbale[]; oggi: string; fai: Fai; lavora: boolean; onChiudi: () => void; onFatto: () => Promise<void> }) {
  const [file, setFile] = useState<File | null>(null)
  const [data, setData] = useState(oggi > v.data ? oggi : v.data)
  const [controllato, setControllato] = useState(false)
  const avvisi = avvisiVerbale(v, verbali)
  const chiudi = async () => {
    if (await lasciare()) onChiudi()
  }
  const firma = () => {
    void fai(
      async () => {
        if (!file) throw new Error('Carica il PDF della scansione firmata')
        const f = { nome: file.name, peso: file.size }
        const no =
          cosaNonVaFile({ ...f, tipo: file.type }) ??
          cosaNonVaDataFirma(v, data, oggi) ??
          cosaNonVaVerbale({ ...v, allegati: [...v.allegati, { id: 'nuovo', tipo: 'firmato', nome: f.nome, peso: f.peso, caricatoIl: oggi }] }, { staFirmando: true })
        if (no) throw new Error(no)
        if (avvisi.length && !controllato) throw new Error('Spunta «Ho controllato, è proprio così» prima di firmare')
        const dati = await datiVerbali()
        await dati.caricaPdf(v.id, { ...f, contenuto: file })
        await dati.firma(v.id, data)
      },
      `${numeroDi(v)} segnato come firmato`,
      onFatto,
    )
  }
  return (
    <Cassetto titolo={`SEGNA ${numeroDi(v).toUpperCase()} COME FIRMATO`} torna={`Verbale ${numeroDi(v)}`} onChiudi={() => void chiudi()}>
      <Bozza>
        <div className="stack" style={{ gap: 16 }}>
          <p className="sg-sotto">Firma il foglio a mano, scansionalo e caricalo qui. Dopo non si cambia più: si rettifica con una nota.</p>
          <Campo id="fi-pdf" etichetta="PDF FIRMATO" nota={file ? { guaio: false, testo: `${file.name} · ${peso(file.size)}` } : undefined}>
            <input id="fi-pdf" type="file" accept="application/pdf" className="sg-campo" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </Campo>
          <Campo id="fi-data" etichetta="FIRMATO IL">
            <input id="fi-data" type="date" className="sg-campo" min={v.data || undefined} max={oggi} value={data} onChange={(e) => setData(e.target.value)} />
          </Campo>
          {!!avvisi.length && (
            <div className="stack" style={{ gap: 6 }}>
              {avvisi.map((a) => (
                <span key={a} className="sg-sotto" style={{ color: 'var(--rosso-testo)' }}>
                  {a}
                </span>
              ))}
              <div className="sg-spunte">
                <label className="sg-elenco-casella">
                  <input type="checkbox" checked={controllato} onChange={(e) => setControllato(e.target.checked)} />
                  Ho controllato, è proprio così
                </label>
              </div>
            </div>
          )}
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <Tasto onClick={() => void chiudi()}>Lascia stare</Tasto>
            <Tasto tono="pieno" disabled={lavora} onClick={firma}>
              Segna come firmato
            </Tasto>
          </div>
        </div>
      </Bozza>
    </Cassetto>
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
