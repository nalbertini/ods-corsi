import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { tastoLinguette } from '../../lib/schedaSezioni'
import { createPortal } from 'react-dom'
import type { DatiSegreteria } from '../../lib/segreteria'
import {
  cambiabile,
  chiusuraNonPiuInRegola,
  chiusuraVisibile,
  cosaNonVaAnnulloChiusura,
  cosaNonVaAnnulloMovimento,
  cosaNonVaCambioVoce,
  cosaNonVaChiusura,
  cosaNonVaGiroconto,
  cosaNonVaImporto,
  cosaNonVaMovimento,
  cosaNonVaSaldoTesto,
  cosaNonVaVoce,
  csvMovimenti,
  dalDellaChiusura,
  descrizioneRiga,
  differenzaInParole,
  elencoMovimenti,
  esitoCambioVoce,
  FILTRI_INIZIALI,
  filtriAccesi,
  filtriAttivi,
  giornoChiuso,
  giornoRoma,
  importoPerCassa,
  NOME_CASSA_CONTANTI,
  nonSiVedra,
  oggiARoma,
  pacchetti,
  riepilogoCambioVoce,
  soloTipo,
  riepilogoGiroconto,
  riepilogoMovimento,
  rigaAppenaScritta,
  ricevutaDoppione,
  perVoce,
  previstoCassa,
  primoMovimentoManuale,
  quanteUsate,
  residui,
  rettificheMancanti,
  saldoCambiato,
  righeDelPeriodo,
  serveConfermaDifferenza,
  SOGLIA_DIFFERENZA,
  totaleResidui,
  type Cassa,
  type ChiusuraCassa,
  type FiltriElenco,
  type IconaConti,
  iconaCassa,
  lineaVoce,
  tipoMovimento,
  togliFiltro,
  type RigaMovimento,
  type VoceContabile,
  ultimaChiusura,
  VOCE_DIFFERENZA,
  vociOfferte,
  vuolePersona,
  vuolePersonaRiga,
  SCEGLI_LA_PERSONA,
  UNA_RIGA_ALLA_VOLTA,
  vociPerLaScelta,
  estrattoConto,
} from '../../lib/contabilita'
import { filtraPerPersona, cosaNonVaCollegato, collegatoAMano, senzaPersona, type CandidatoPersona, type FiltroPersona } from '../../lib/movimentiPersona'
import { fraseDallaChat } from '../../lib/collega'
import { intervalloDi } from '../../lib/pagamenti'
import { centesimi, dataRicevuta, euro } from '../../lib/ricevute'
import { ImportaBanca } from './ImportaBanca'
import { Campo, chiedi, FiltroMenu, Guaio, lasciare, MenuAzioni, messaggio, scaricaCsv, SchedaPiena, Segmenti, suCarta, Testa, useAvviso, useBozza, useCarica, Tasto, TestaColonna } from './comune'
import { ICONE_CONTI, ICONE_SCHEDE } from '../Icons'
import { CampoPersona, CollegaAPersona, CollegaSicuri } from './CollegaPersona'
import { Bilancio } from './Bilancio'
import { rigaDaSistemare } from '../../lib/bilancio'
import { ScaricoSatispay } from './ScaricoSatispay'
import { commissioneSatispay, NOME_CASSA_SATISPAY, spesaCommissione } from '../../lib/satispayScarico'

type Scheda = 'movimenti' | 'bilancio' | 'voci' | 'casse'
const SCHEDE: readonly (readonly [Scheda, string])[] = [
  ['movimenti', 'Movimenti'],
  ['bilancio', 'Bilancio'],
  ['voci', 'Voci'],
  ['casse', 'Casse'],
]
type Fai = ReturnType<typeof useAvviso>['fai']

/**
 * CONTABILITÀ, per chi cura i conti (`59-contabilita.sql`): i movimenti con i
 * residui delle casse, le voci, le casse con il saldo iniziale. Gli incassi
 * degli iscritti sono nell'elenco ma non si scrivono qui: si ricavano da
 * ricevute e pagamenti, e si correggono in PAGAMENTI.
 */
export function Contabilita({ d, movimento, onPersona, onImportazioni }: { d: DatiSegreteria; movimento?: string; onPersona?: (personaId: string) => void; onImportazioni?: () => void }) {
  const [scheda, setScheda] = useState<Scheda>('movimenti')
  const casse = useCarica(() => d.casse(), [d])
  const voci = useCarica(() => d.voci(), [d])
  const manuali = useCarica(() => d.movimenti(), [d])
  // Gli incassi degli iscritti non cambiano quando si scrive qui: si leggono una volta. Se non si leggono,
  // restano i movimenti a mano e il guaio si dice sopra l'elenco (i residui, allora, non li contano).
  // Senza 60-chiusura-cassa.sql la chiusura non c'è, ma i conti restano usabili: il guaio si dice nella scheda CASSE.
  const chiusure = useCarica(() => d.chiusure(), [d])
  const incassi = useCarica(async () => {
    const [ricevute, diretti, satispay] = await Promise.all([d.ricevute(), d.pagamentiDiretti(), d.pagamentiSatispay()])
    const chi = [...diretti.map((x) => x.personaId), ...satispay.flatMap((x) => (x.personaId ? [x.personaId] : []))]
    return { ricevute, diretti, satispay, nomi: chi.length ? await d.nomiPersone(chi) : [] }
  }, [d])
  const { avviso, fai } = useAvviso()
  // Le azioni di MOVIMENTI stanno nella testata della pagina, accanto al titolo: il posto lo dà qui, i tasti li mette Movimenti.
  const [azioni, setAzioni] = useState<HTMLElement | null>(null)

  const daiConti = [casse, voci, manuali]
  const guaio = daiConti.map((x) => x.guaio).find(Boolean)
  const pronto = daiConti.every((x) => x.dato !== null) && (incassi.dato !== null || !!incassi.guaio) && (chiusure.dato !== null || !!chiusure.guaio)
  const rileggi = () => {
    void casse.ricarica()
    void voci.ricarica()
    void manuali.ricarica()
    void chiusure.ricarica()
  }
  const dateChiusure = chiusure.dato ?? []

  const elenco: RigaMovimento[] = pronto
    ? elencoMovimenti(incassi.dato?.ricevute ?? [], incassi.dato?.diretti ?? [], incassi.dato?.nomi ?? [], casse.dato ?? [], manuali.dato ?? [], voci.dato ?? [], incassi.dato?.satispay)
    : []
  // Una ricevuta in contanti annullata dopo la chiusura: il foglio già stampato non torna più coi conti.
  const nonInRegola = pronto ? dateChiusure.filter((k) => chiusuraNonPiuInRegola(k, casse.dato ?? [], elenco)) : []

  return (
    <div className="stack" style={{ gap: 18 }}>
      <Testa titolo="CONTABILITÀ" sotto="Le entrate e le uscite della palestra, nelle sue casse. Gli incassi degli iscritti ci sono già: si correggono nella scheda della persona.">
        <div className="row" style={{ gap: 10, flexWrap: 'wrap' }} ref={setAzioni} />
      </Testa>
      <div
        role="tablist"
        aria-label="Contabilità"
        className="schede sg-schede"
        onKeyDown={(e) => {
          const dove = tastoLinguette(SCHEDE.map(([s]) => s), scheda, e.key)
          if (!dove) return
          e.preventDefault()
          setScheda(dove)
          // Il fuoco segue la scheda, come in IMPOSTAZIONI.
          e.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]')[SCHEDE.findIndex(([s]) => s === dove)]?.focus()
        }}
      >
        {SCHEDE.map(([s, nome]) => {
          const Icona = ICONE_SCHEDE[s]
          return (
            <button key={s} type="button" role="tab" aria-selected={scheda === s} tabIndex={scheda === s ? 0 : -1} className="scheda" data-on={scheda === s} onClick={() => setScheda(s)}>
              <Icona size={18} />
              {nome}
            </button>
          )
        })}
      </div>
      {guaio && <Guaio testo={guaio} />}
      {nonInRegola.map((k) => (
        <div key={k.id} role="alert" className="sg-riquadro" style={{ borderColor: 'var(--rosso-testo)' }}>
          <span className="sg-etichetta" style={{ color: 'var(--rosso-testo)' }}>LA CHIUSURA DEL {dataRicevuta(k.data)} NON È PIÙ IN REGOLA</span>
          <span style={{ fontSize: 14 }}>Dopo la chiusura è cambiato un incasso in contanti di quei giorni. Il foglio già stampato resta com’era: scrivi una rettifica con una data dopo la chiusura, o annulla la chiusura se è l’ultima.</span>
          {scheda !== 'casse' && (
            <div>
              <button type="button" className="sg-btn sg-btn-linea" onClick={() => setScheda('casse')}>
                Vai alle casse
              </button>
            </div>
          )}
        </div>
      ))}
      {pronto && incassi.guaio && <Guaio testo={`Gli incassi degli iscritti non si leggono, e i residui non li contano. ${incassi.guaio}`} />}
      {!guaio && !pronto && <p className="sg-sotto">Sto leggendo i conti…</p>}
      {/* Le schede si nascondono, non si smontano: filtri e bozze restano dove sono. */}
      {pronto && (
        <>
          <div hidden={scheda !== 'movimenti'}><Movimenti d={d} azioni={scheda === 'movimenti' ? azioni : null} casse={casse.dato ?? []} voci={voci.dato ?? []} chiusure={dateChiusure} righe={elenco} fai={fai} onCambiato={rileggi} movimento={movimento} onPersona={onPersona} onImportazioni={onImportazioni} /></div>
          <div hidden={scheda !== 'bilancio'}><Bilancio d={d} casse={casse.dato ?? []} righe={elenco} oggi={oggiARoma()} fai={fai} /></div>
          <div hidden={scheda !== 'voci'}><Voci d={d} voci={voci.dato ?? []} chiusure={dateChiusure} righe={elenco} fai={fai} onCambiato={rileggi} /></div>
          <div hidden={scheda !== 'casse'}><Casse d={d} casse={casse.dato ?? []} chiusure={dateChiusure} guaioChiusure={chiusure.guaio ?? undefined} righe={elenco} fai={fai} onCambiato={rileggi} /></div>
        </>
      )}
      {avviso}
    </div>
  )
}

const soldi = (c: number) => `${euro(c)} €`
/** Quante righe dei movimenti in contanti si vedono aprendo la chiusura: il resto si apre a richiesta. */
const RIGHE_VISTE = 5
/** Quante righe mostra l'elenco dei movimenti: lo storico ne ha migliaia, il resto si apre a richiesta. */
const RIGHE_ELENCO = 50
const soldiConSegno = (c: number) => (c < 0 ? `− ${soldi(-c)}` : soldi(c))

/** Un riquadro che si apre in fondo alla pagina (il tasto è lì) non si vede: all'apertura si porta in vista. */
function InVista({ children }: { children: ReactNode }) {
  const qui = useRef<HTMLDivElement>(null)
  useEffect(() => {
    qui.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }, [])
  return <div ref={qui} style={{ scrollMarginTop: 12 }}>{children}</div>
}

/** L'icona dei conti accanto a un nome (una cassa, una voce): senza icona, niente. */
function IconaConto({ nome }: { nome: IconaConti | 'frecce' | null }) {
  if (!nome) return null
  const Icona = ICONE_CONTI[nome]
  return <Icona size={18} />
}

/** Un saldo nella striscia sopra l'elenco: cifra da 28px perché un milione stia in un quarto di riga. */
function Saldo({ nome, icona, valore, sotto }: { nome: string; icona: IconaConti | null; valore: string; sotto: string[] }) {
  return (
    <div className="sg-saldo">
      <span className="sg-etichetta sg-cella-icona"><IconaConto nome={icona} />{nome.toUpperCase()}</span>
      <span className="num sg-saldo-cifra">{valore}</span>
      <span className="sg-saldo-sotto">{sotto.map((x) => <span key={x}>{x}</span>)}</span>
    </div>
  )
}

/** Le casse dell'estratto conto, a scelta multipla: nessuna spuntata = tutte. */
function FiltroCasse({ casse, scelte, onChange }: { casse: Cassa[]; scelte: string[]; onChange: (v: string[]) => void }) {
  const testo = scelte.length === 0 ? 'Tutte' : casse.filter((c) => scelte.includes(c.id)).map((c) => c.nome).join(', ')
  return (
    <span className="sg-filtro-menu sg-casse" data-acceso={scelte.length > 0}>
      <details className="sg-filtro-casse">
        <summary className="sg-filtro-menu-tasto">
          <span className="sg-filtro-menu-etichetta">Casse</span>
          <span className="sg-filtro-menu-valore">{testo}</span>
          <span aria-hidden="true">▾</span>
        </summary>
        <div className="sg-filtro-casse-lista" role="group" aria-label="Casse">
          {casse.map((c) => (
            <label key={c.id} className="sg-elenco-casella">
              <input type="checkbox" checked={scelte.includes(c.id)} onChange={(e) => onChange(e.target.checked ? [...scelte, c.id] : scelte.filter((x) => x !== c.id))} />
              {c.nome}
            </label>
          ))}
        </div>
      </details>
      {scelte.length > 0 && (
        <button type="button" className="sg-filtro-menu-togli" aria-label="Togli il filtro Casse" onClick={() => onChange([])}>✕</button>
      )}
    </span>
  )
}

function Movimenti({ d, azioni, casse, voci, chiusure, righe, fai, onCambiato, movimento, onPersona, onImportazioni }: { d: DatiSegreteria; azioni: HTMLElement | null; casse: Cassa[]; voci: VoceContabile[]; chiusure: ChiusuraCassa[]; righe: RigaMovimento[]; fai: Fai; onCambiato: () => void; movimento?: string; onPersona?: (personaId: string) => void; onImportazioni?: () => void }) {
  // Dove ScaricoSatispay porta la sua voce nel menu delle azioni.
  const [listaMenu, setListaMenu] = useState<HTMLElement | null>(null)
  const oggi = oggiARoma()
  const [f, setF] = useState<FiltriElenco>(FILTRI_INIZIALI)
  const { testo, periodo, tipo, voce, persona, annullati } = f
  const metti = (x: Partial<FiltriElenco>) => setF((y) => ({ ...y, ...x }))
  const [perVoci, setPerVoci] = useState(false)
  // Le casse dell'estratto conto: vuote = tutte. Stanno qui e non in FiltriElenco perché sono più d'una.
  const [cassaIds, setCassaIds] = useState<string[]>([])
  const [scrivo, setScrivo] = useState<'movimento' | 'giroconto' | 'banca' | null>(null)
  // Dopo aver scritto un movimento che i filtri nascondono: se no sembra perso.
  const [appena, setAppena] = useState<RigaMovimento | null>(null)
  // Arrivando dalla scheda di una persona («Apri in contabilità») il movimento è già aperto.
  const [aperto, setAperto] = useState<RigaMovimento | null>(() => righe.find((r) => r.id === movimento) ?? null)
  const [viste, setViste] = useState(RIGHE_ELENCO)
  const [scelti, setScelti] = useState<Set<string>>(new Set())
  const [cambio, setCambio] = useState(false)
  // Lo storico collegato alla persona (70-movimenti-persona.sql): cosa si può dire di ogni movimento senza persona, e i nomi dei collegati.
  const [collegando, setCollegando] = useState<'sicuri' | 'mano' | null>(null)
  const statoElenco = useRef<HTMLSpanElement>(null)
  const esitiLetti = useCarica(() => d.esitiCollegamentiPersona(), [d])
  const esiti = useMemo(() => Object.fromEntries((esitiLetti.dato ?? []).map((e) => [e.id, e.esito] as const)), [esitiLetti.dato])
  const idPersone = useMemo(() => [...new Set(righe.map((r) => r.personaId).filter((x): x is string => !!x))].sort().join(','), [righe])
  const nomiLetti = useCarica(() => (idPersone ? d.nomiPersone(idPersone.split(',')) : Promise.resolve([])), [d, idPersone])
  const nomiPersone = useMemo(() => new Map((nomiLetti.dato ?? []).map((p) => [p.id, `${p.cognome} ${p.nome}`] as const)), [nomiLetti.dato])
  const daDecidere = (esitiLetti.dato ?? []).filter((e) => e.esito === 'omonimi').length
  const senzaScheda = (esitiLetti.dato ?? []).filter((e) => e.esito === 'nessuna').length
  const collegatiTutti = filtraPerPersona(righe, 'collegati', {}).length

  const { dal, al } = intervalloDi(periodo, oggi, '', '')
  const estratto = estrattoConto(righe, casse, { testo, dal, al, tipo, voce, annullati, cassaIds })
  const trovate = filtraPerPersona(estratto.righe.map((x) => x.riga), persona, esiti)
  const dellEstratto = new Map(estratto.righe.map((x) => [x.riga.id, x] as const))
  // Cambiando i filtri la scelta si svuota e l'elenco riparte dalle prime righe: quel che si è scelto non si perde di vista.
  const chiave = [testo, periodo, tipo, cassaIds.join(','), voce, annullati, persona].join('|')
  useEffect(() => {
    setScelti(new Set())
    setViste(RIGHE_ELENCO)
    setCambio(false)
    setCollegando(null)
  }, [chiave])
  const scegliibili = trovate.filter(cambiabile)
  const idScelti = righe.filter((r) => scelti.has(r.id) && cambiabile(r)).map((r) => r.id)
  const sceltiDelTipo = (t: 'entrata' | 'uscita') => righe.filter((r) => scelti.has(r.id) && r.tipo === t).map((r) => r.id)
  const sceltaRiep = riepilogoCambioVoce(idScelti, righe, '', voci)
  const sceltiRighe = righe.filter((r) => scelti.has(r.id) && cambiabile(r))
  const collegabili = sceltiRighe.length > 0 && sceltiRighe.every((r) => !cosaNonVaCollegato(r))
  const dellaPersona = sceltiRighe.filter((r) => r.personaId).map((r) => r.id)
  const scollega = async () => {
    const quanti = dellaPersona.length
    const si = await chiedi(
      `Togli la persona ${quanti === 1 ? 'al movimento scelto' : `ai ${quanti} movimenti scelti`}? Importi e casse non cambiano; per ricollegarli serve scegliere di nuovo la persona.`,
      quanti === 1 ? 'Sì, scollega' : `Sì, scollega i ${quanti}`,
    )
    if (!si) return
    void fai(async () => { for (const lotto of pacchetti(dellaPersona)) await d.scollegaMovimentiPersona(lotto) }, quanti === 1 ? 'Movimento scollegato' : `${quanti} movimenti scollegati`, collegamentoFatto)
  }
  // Dopo un collegamento: l'elenco si rilegge, gli esiti e i nomi pure, e la scelta si svuota.
  const collegamentoFatto = () => {
    setCollegando(null)
    setScelti(new Set())
    onCambiato()
    void esitiLetti.ricarica()
    // Il tasto premuto sparisce: il fuoco passa alla riga «N trovati», se no da tastiera si riparte dall'inizio della pagina.
    window.setTimeout(() => statoElenco.current?.focus(), 0)
  }
  const chiudiCollega = () => {
    setCollegando(null)
    window.setTimeout(() => statoElenco.current?.focus(), 0)
  }
  const nonSiCollega = sceltiRighe.map((r) => cosaNonVaCollegato(r)).find(Boolean) ?? null
  const alterna = (id: string) => setScelti((x) => { const y = new Set(x); if (y.has(id)) y.delete(id); else y.add(id); return y })
  const nomiVoci = [...new Set(voci.map((v) => v.nome))].sort((x, y) => Number(y === 'Da classificare') - Number(x === 'Da classificare') || x.localeCompare(y, 'it'))
  const conti = residui(casse, righe)
  const mese = new Date(`${oggi}T12:00:00`).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' }).replace(/^./, (c) => c.toUpperCase())
  const nomeCassa = (id?: string) => casse.find((c) => c.id === id)?.nome ?? ''
  const chiudi = () => {
    setScrivo(null)
    setAperto(null)
  }
  const fatto = (nuova?: RigaMovimento) => {
    chiudi()
    setAppena(nuova ?? null)
    onCambiato()
    window.setTimeout(() => statoElenco.current?.focus(), 0)
  }
  const azzera = () => {
    setF(FILTRI_INIZIALI)
    setCassaIds([])
    setAppena(null)
    window.setTimeout(() => statoElenco.current?.focus(), 0)
  }
  const attivi = filtriAttivi(f) + (cassaIds.length ? 1 : 0)
  const accesi = filtriAccesi(f, { nomeCassa: (id) => nomeCassa(id), mese })
  // Con il modulo aperto è lui la pagina: l'elenco e i filtri restano com'erano (lo stato sta qui) e si ritrovano tornando.
  const tornaDalModulo = async () => {
    if (!(await lasciare())) return
    chiudi()
    window.setTimeout(() => statoElenco.current?.focus(), 0)
  }
  const fuori = !!appena && (nonSiVedra(appena, { testo, dal, al, tipo, voce, persona }) || (cassaIds.length > 0 && ![appena.cassaId, appena.cassaAId].some((c) => c && cassaIds.includes(c))))
  // Le azioni stanno nella testata, in vista anche col dettaglio aperto: prima si chiede se lasciare la correzione.
  const apri = async (cosa: 'movimento' | 'giroconto' | 'banca') => {
    if (!(await lasciare())) return
    setAperto(null)
    setCambio(false)
    setCollegando(null)
    setAppena(null)
    setScrivo(cosa)
  }
  // Il cambio di voce rilegge da sé quando finisce: tornando all'elenco si chiude e si svuota la scelta, senza rileggere ancora.
  const cambioFinito = () => {
    setCambio(false)
    setScelti(new Set())
  }
  const collegaSicuri = async () => {
    if (!(await lasciare())) return
    setAperto(null)
    setScrivo(null)
    setCambio(false)
    setCollegando('sicuri')
  }
  // Dal dettaglio si esce chiedendo prima, se c'è una correzione non salvata.
  const torna = async () => {
    if (await lasciare()) setAperto(null)
  }

  if (scrivo) {
    return (
      <InVista>
      <div className="stack" style={{ gap: 18 }}>
        <div>
          <button type="button" className="sg-btn sg-btn-linea" onClick={() => void tornaDalModulo()}>
            ← I movimenti
          </button>
        </div>
        {scrivo === 'banca' ? (
          <ImportaBanca d={d} casse={casse} righe={righe} fai={fai} onRileggi={onCambiato} onVedi={() => { chiudi(); setF({ ...FILTRI_INIZIALI, periodo: 'tutto', voce: 'Da classificare' }) }} />
        ) : scrivo === 'movimento' ? (
          <NuovoMovimento d={d} voci={voci} casse={casse} righe={righe} chiusure={chiusure} fai={fai} onFatto={fatto} onChiudi={() => void tornaDalModulo()} />
        ) : (
          <NuovoGiroconto d={d} casse={casse} voci={voci} righe={righe} chiusure={chiusure} fai={fai} onFatto={fatto} onChiudi={() => void tornaDalModulo()} />
        )}
      </div>
      </InVista>
    )
  }

  return (
    <div className="stack" style={{ gap: 18 }}>
      {azioni && createPortal(
        <>
          <MenuAzioni etichetta="Altre azioni" onLista={setListaMenu}>
            {!esitiLetti.guaio && <button type="button" role="menuitem" onClick={() => void collegaSicuri()}>Collega i casi sicuri</button>}
            <button type="button" role="menuitem" onClick={() => void apri('banca')}>Importa dalla banca</button>
            <button type="button" role="menuitem" onClick={() => void apri('giroconto')}>Giroconto</button>
            <button type="button" role="menuitem" disabled={!trovate.length} onClick={() => scaricaCsv(`movimenti-${oggi}.csv`, csvMovimenti(trovate, casse))}>Esporta CSV</button>
          </MenuAzioni>
          <button type="button" className="sg-btn sg-btn-pieno" onClick={() => void apri('movimento')}>
            Nuovo movimento
          </button>
        </>,
        azioni,
      )}
      <div className="sg-saldi" role="group" aria-label="Saldi delle casse">
        {casse.map((c) => {
          const r = conti.find((x) => x.cassaId === c.id)
          return <Saldo key={c.id} nome={c.nome} icona={iconaCassa(c.nome)} valore={soldiConSegno(r?.residuo ?? 0)} sotto={[`entrate ${soldi(r?.entrate ?? 0)}`, `uscite ${soldi(r?.uscite ?? 0)}`]} />
        })}
        <Saldo nome="Totale" icona={null} valore={soldiConSegno(totaleResidui(conti))} sotto={['saldi iniziali compresi']} />
      </div>
      <ScaricoSatispay d={d} fai={fai} onCambiato={onCambiato} menu={listaMenu} onImportazioni={onImportazioni} />

      {cambio && idScelti.length > 0 && sceltaRiep.tipo !== 'misto' && <InVista><CambiaVoce d={d} ids={idScelti} righe={righe} voci={voci} onRileggi={onCambiato} onFatto={cambioFinito} onChiudi={() => setCambio(false)} /></InVista>}
      {collegando === 'sicuri' && <InVista><CollegaSicuri d={d} onRileggi={() => { onCambiato(); void esitiLetti.ricarica() }} onVediDaDecidere={() => { setCollegando(null); setF({ ...FILTRI_INIZIALI, periodo: 'tutto', persona: 'da_decidere' }) }} onChiudi={chiudiCollega} /></InVista>}
      {collegando === 'mano' && sceltiRighe.length > 0 && <InVista><CollegaAPersona d={d} righe={sceltiRighe} fai={fai} onFatto={collegamentoFatto} onChiudi={chiudiCollega} /></InVista>}
      {aperto && (
        <SchedaPiena key={aperto.id} etichetta={`Movimento: ${aperto.descrizione}`} torna="I movimenti" onTorna={() => void torna()}>
          <MovimentoAperto d={d} voci={voci} riga={aperto} chiusure={chiusure} cassa={nomeCassa(aperto.cassaId)} cassaA={nomeCassa(aperto.cassaAId)} nomePersona={aperto.personaId ? nomiPersone.get(aperto.personaId) : undefined} fai={fai} onChiudi={() => void torna()} onFatto={() => { fatto(); void esitiLetti.ricarica() }} onPersona={onPersona} />
        </SchedaPiena>
      )}

      {fuori && (
        <div className="row sg-riquadro" style={{ flexDirection: 'row', alignItems: 'center', gap: 14, flexWrap: 'wrap' }} role="status">
          <span style={{ fontSize: 15, fontWeight: 600 }}>Non lo vedi nell’elenco: è fuori dai filtri.</span>
          <button type="button" className="sg-btn sg-btn-linea" onClick={azzera}>Togli i filtri</button>
        </div>
      )}

      <section className="sg-elenco" aria-label="Filtri ed elenco dei movimenti">
        <div className="sg-elenco-barra" role="group" aria-label="Filtri dei movimenti">
          <label htmlFor="cerca-movimenti" className="vh">
            Cerca nella descrizione
          </label>
          <input id="cerca-movimenti" className="sg-campo sg-elenco-cerca" type="search" placeholder="Cerca nella descrizione" value={testo} onChange={(e) => metti({ testo: e.target.value })} />
          <Segmenti
            etichetta="Periodo"
            voci={[
              ['mese', mese],
              ['scorso', 'Mese scorso'],
              ['anno', 'Tutto l’anno'],
              ['tutto', 'Tutto'],
            ]}
            scelta={periodo}
            onScegli={(v) => metti({ periodo: v })}
          />
          <FiltroMenu id="filtro-tipo" nome="Tipo" value={tipo} opzioni={[['', 'Tutti'], ['entrata', 'Entrate'], ['uscita', 'Uscite']]} onChange={(v) => metti({ tipo: v })} />
          <FiltroCasse casse={casse} scelte={cassaIds} onChange={setCassaIds} />
          <FiltroMenu id="filtro-voce" nome="Voce" value={voce} opzioni={[['', 'Tutte'], ...nomiVoci.map((n) => [n, n] as const)]} onChange={(v) => metti({ voce: v })} />
          {esitiLetti.dato && (
            // I numeri contano tutto lo storico: scegliendo un filtro il periodo diventa Tutto, se no «0 trovati» confonde.
            <FiltroMenu
              id="filtro-persona"
              nome="Persona"
              value={persona}
              opzioni={[['', 'Tutte'], ['collegati', `Collegati · ${collegatiTutti}`], ['da_decidere', `Da decidere · ${daDecidere}`], ['senza_scheda', `Senza scheda · ${senzaScheda}`], ['senza_persona', `Quote e corsi senza persona · ${righe.filter(senzaPersona).length}`]]}
              // Le opzioni sono quelle di FiltroPersona scritte qui sopra: il valore non può essere altro.
              onChange={(v) => metti(v ? { persona: v as FiltroPersona, periodo: 'tutto' } : { persona: '' })}
            />
          )}
          <label className="sg-elenco-casella">
            <input type="checkbox" checked={annullati} onChange={(e) => metti({ annullati: e.target.checked })} />
            Mostra annullati
          </label>
          <span style={{ flex: 1 }} />
          <Segmenti
            etichetta="Vista"
            voci={[
              ['elenco', 'Elenco'],
              ['voce', 'Per voce'],
            ]}
            scelta={perVoci ? 'voce' : 'elenco'}
            onScegli={(v) => setPerVoci(v === 'voce')}
          />
        </div>
        {esitiLetti.guaio && <span className="sg-sotto" role="status" style={{ padding: '0 16px 12px' }}>{esitiLetti.guaio}</span>}

        <div className="sg-elenco-stato">
          <span role="status" ref={statoElenco} tabIndex={-1}>
            <b>{trovate.length === 1 ? '1 movimento' : `${trovate.length} movimenti`}</b>
            {idScelti.length > 0 && ` · ${idScelti.length} ${idScelti.length === 1 ? 'scelto' : 'scelti'}`}
          </span>
          {accesi.map((a) => (
            <span key={a.chiave} className="sg-pillola">
              <span className="sg-pillola-testo">{a.testo}</span>
              <button type="button" aria-label={`Togli il filtro ${a.testo}`} onClick={() => setF(togliFiltro(f, a.chiave))}>✕</button>
            </span>
          ))}
          {attivi > 0 && (
            <button type="button" className="sg-link" onClick={azzera}>Togli i filtri</button>
          )}
          <span style={{ flex: 1 }} />
          <span className="sg-elenco-somme">
            <span>Saldo iniziale <b className="num">{soldiConSegno(estratto.saldoIniziale)}</b></span>
            <span>Entrate <b className="num" style={{ color: estratto.entrate > 0 ? 'var(--verde-testo)' : undefined }}>+ {soldi(estratto.entrate)}</b></span>
            <span>Uscite <b className="num">− {soldi(estratto.uscite)}</b></span>
            <span>Saldo finale <b className="num">{soldiConSegno(estratto.saldoFinale)}</b></span>
          </span>
        </div>

      {perVoci ? (
        <div role="table" aria-label="Totali per voce" className="sg-tabella">
          <div className="sg-tabella-corpo">
            {perVoce(trovate).length === 0 && <div role="row"><p role="cell" className="sg-sotto" style={{ padding: '12px 14px' }}>Nessun movimento nel periodo.</p></div>}
            {perVoce(trovate).map((g) => (
              <div key={`${g.tipo}|${g.voce}`} role="row" className="row" style={{ gap: 14, padding: '10px 14px', borderBottom: '1px solid var(--line-soft)', alignItems: 'center' }}>
                <span role="cell" style={{ flex: 1, fontSize: 15, fontWeight: 600 }}>{g.voce}</span>
                <span role="cell" className="sg-etichetta">{g.tipo === 'entrata' ? 'ENTRATA' : 'USCITA'}</span>
                <span role="cell" className="num" style={{ fontSize: 16, fontWeight: 700, color: g.tipo === 'entrata' ? 'var(--verde-testo)' : undefined }}>{g.tipo === 'entrata' ? '+ ' : '− '}{soldi(g.totale)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div role="table" aria-label="Movimenti" className="sg-tabella">
          <div role="row" className="sg-lista-testa sg-riga-movimento">
            <span role="columnheader" className="sg-scelta-riga">
              <input type="checkbox" disabled={!scegliibili.length}
                checked={idScelti.length > 0 && scegliibili.every((r) => scelti.has(r.id))}
                onChange={(e) => setScelti(e.target.checked ? new Set(scegliibili.map((r) => r.id)) : new Set())}
                aria-label={!scegliibili.length ? 'Nessun movimento da scegliere' : scegliibili.length === 1 ? 'Scegli il movimento che si può cambiare' : scegliibili.length === trovate.length ? `Scegli i ${scegliibili.length} movimenti trovati` : `Scegli i ${scegliibili.length} movimenti che si possono cambiare`}
              />
            </span>
            <TestaColonna icona="calendario">DATA</TestaColonna>
            <TestaColonna icona="documento">DESCRIZIONE</TestaColonna>
            <TestaColonna icona="movimenti">TIPO</TestaColonna>
            <TestaColonna icona="banca">CASSA</TestaColonna>
            <TestaColonna icona="euro" destra>ENTRATE</TestaColonna>
            <TestaColonna icona="euro" destra>USCITE</TestaColonna>
          </div>
          <div className="sg-tabella-corpo">
            {trovate.length === 0 && (
              <div role="row">
                <p role="cell" className="sg-sotto" style={{ padding: '12px 14px' }}>
                  {righe.length === 0 ? 'Nessun movimento: compaiono qui gli incassi degli iscritti e quelli che scrivi tu.' : 'Nessun movimento corrisponde ai filtri.'}
                </p>
              </div>
            )}
            {trovate.slice(0, viste).map((r) => {
              const e = dellEstratto.get(r.id)
              return (
              <div key={r.id} role="row" className="sg-riga-movimento sg-iscritto" data-spento={r.annullato} data-scelto={aperto?.id === r.id} data-scelta={scelti.has(r.id)} data-senza-casella={!cambiabile(r)} data-da-sistemare={rigaDaSistemare(r)} onClick={() => { if (r.origine !== 'movimento' && r.personaId && onPersona) onPersona(r.personaId); else { setScrivo(null); setAperto(r) } }}>
                <span role="cell" className="sg-scelta-riga" onClick={(e) => e.stopPropagation()}>
                  {cambiabile(r) && <input type="checkbox" checked={scelti.has(r.id)} onChange={() => alterna(r.id)} aria-label={`Scegli ${r.descrizione} del ${dataRicevuta(r.data)}`} />}
                </span>
                <span role="cell" style={{ fontSize: 13, color: 'var(--sec)' }}>{dataRicevuta(r.data)}</span>
                <span role="cell" style={{ fontSize: 15, fontWeight: 600, textDecoration: r.annullato ? 'line-through' : undefined }}>
                  <button type="button" className="sg-riga-apri">{r.descrizione}</button>
                  {r.origineImport?.startsWith('banca:') && <span className="num sg-tag" style={{ marginLeft: 8 }}>Dalla banca</span>}
                  {r.annullato && <span className="num sg-tag" data-tipo="manca" style={{ marginLeft: 8 }}>Annullato</span>}
                  {/* Lo stato del collegamento alla persona sta accanto alla descrizione: la colonna PERSONA non c'è più. */}
                  {r.personaId && collegatoAMano(r) && <span className="num sg-tag" data-tipo="fatto" style={{ marginLeft: 8 }}>Collegato</span>}
                  {!r.personaId && esiti[r.id] === 'omonimi' && <span className="num sg-tag" data-tipo="aspetta" style={{ marginLeft: 8 }}>Omonimi</span>}
                  {!r.personaId && esiti[r.id] === 'nessuna' && <span className="num sg-tag" style={{ marginLeft: 8 }}>Senza scheda</span>}
                  {!r.personaId && esiti[r.id] === 'sicuro' && <span className="num sg-tag" style={{ marginLeft: 8 }}>Da collegare</span>}
                  <span className="sg-sotto-movimento">
                    <span className="sg-solo-telefono">{[tipoMovimento(r).nome, r.tipo === 'giroconto' ? '' : `${r.tipo === 'entrata' ? '+ ' : '− '}${soldi(r.importo)}`, dataRicevuta(r.data), r.tipo === 'giroconto' ? `${nomeCassa(r.cassaId)} → ${nomeCassa(r.cassaAId)}` : nomeCassa(r.cassaId)].filter(Boolean).join(' · ')}</span>
                    <span>{lineaVoce(r, r.personaId ? nomiPersone.get(r.personaId) ?? (collegatoAMano(r) ? 'Persona collegata' : '') : '')}</span>
                    {r.sotto && <span>{r.sotto}</span>}
                  </span>
                </span>
                <span role="cell" className="sg-cella-icona">
                  <IconaConto nome={tipoMovimento(r).icona} />
                  {tipoMovimento(r).nome}
                </span>
                <span role="cell" className="sg-cella-icona">
                  <IconaConto nome={r.tipo === 'giroconto' ? 'frecce' : iconaCassa(nomeCassa(r.cassaId))} />
                  {r.tipo === 'giroconto' ? `${nomeCassa(r.cassaId)} → ${nomeCassa(r.cassaAId)}` : nomeCassa(r.cassaId)}
                </span>
                <span role="cell" className="num" style={{ fontSize: 16, fontWeight: 700, textAlign: 'right', textDecoration: r.annullato ? 'line-through' : undefined, color: 'var(--verde-testo)' }}>
                  {e?.entrata ? `+ ${soldi(e.entrata)}` : r.annullato && r.tipo === 'entrata' ? soldi(r.importo) : ''}
                </span>
                <span role="cell" className="num" style={{ fontSize: 16, fontWeight: 700, textAlign: 'right', textDecoration: r.annullato ? 'line-through' : undefined }}>
                  {e?.uscita ? `− ${soldi(e.uscita)}` : r.annullato && r.tipo === 'uscita' ? soldi(r.importo) : ''}
                </span>
              </div>
              )
            })}
          </div>
          {trovate.length > viste && (
            <div role="row" className="row" style={{ gap: 10, padding: 14, alignItems: 'center', flexWrap: 'wrap' }}>
              <div role="cell">
                <button type="button" className="sg-btn sg-btn-linea" onClick={() => setViste(viste + RIGHE_ELENCO)}>
                  Mostra altre {Math.min(RIGHE_ELENCO, trovate.length - viste)} righe
                </button>
              </div>
              <span role="cell" className="sg-sotto">ne vedi {viste} su {trovate.length}</span>
            </div>
          )}
        </div>
      )}
      </section>

      {idScelti.length > 0 && !aperto && !cambio && !collegando && (
        <div className="sg-barra-scelta" role="region" aria-label="Movimenti scelti">
          <span className="ob" style={{ fontSize: 22, fontWeight: 700 }}>{idScelti.length} {idScelti.length === 1 ? 'SCELTO' : 'SCELTI'}</span>
          <span className="sg-sotto">
            {sceltaRiep.tipo === 'misto' ? 'Scegli solo entrate o solo uscite' : `${sceltaRiep.tipo === 'entrata' ? 'entrate' : 'uscite'} · ${sceltaRiep.tipo === 'entrata' ? '+ ' : '− '}${soldi(sceltaRiep.totale)}`}
          </span>
          {sceltaRiep.tipo !== 'misto' && !collegabili && nonSiCollega && esitiLetti.dato && (
            <span className="sg-sotto" role="note">Non si collega a una persona: {nonSiCollega.charAt(0).toLowerCase()}{nonSiCollega.slice(1)}</span>
          )}
          <div className="row" style={{ gap: 10, flexWrap: 'wrap', marginLeft: 'auto' }}>
            {sceltaRiep.tipo === 'misto' ? (
              <>
                <button type="button" className="sg-btn sg-btn-linea" onClick={() => setScelti(new Set(sceltiDelTipo('entrata')))}>{soloTipo(sceltiDelTipo('entrata').length, 'entrata')}</button>
                <button type="button" className="sg-btn sg-btn-linea" onClick={() => setScelti(new Set(sceltiDelTipo('uscita')))}>{soloTipo(sceltiDelTipo('uscita').length, 'uscita')}</button>
              </>
            ) : (
              <>
                <button type="button" className="sg-btn sg-btn-pieno" onClick={() => { setScrivo(null); setAperto(null); setCambio(true) }}>Cambia voce</button>
                {esitiLetti.dato && collegabili && (
                  <button type="button" className="sg-btn sg-btn-linea" onClick={() => { setScrivo(null); setAperto(null); setCambio(false); setCollegando('mano') }}>Collega a una persona</button>
                )}
                {esitiLetti.dato && dellaPersona.length > 0 && (
                  <button
                    type="button"
                    className="sg-btn sg-btn-linea"
                    onClick={() => void scollega()}
                  >
                    Scollega
                  </button>
                )}
              </>
            )}
            <button type="button" className="sg-btn sg-btn-linea" onClick={() => { setScelti(new Set()); setCambio(false) }}>Deseleziona</button>
          </div>
        </div>
      )}

      <span className="sg-sotto">
        I giroconti e gli annullati non contano in entrate e uscite. Un incasso degli iscritti apre la scheda della persona, dove nasce; qui non si cambia. Contanti vanno in Cassa Contanti, i pagamenti Satispay del negozio nella cassa Satispay, tutto il resto in Conto Corrente.
      </span>
    </div>
  )
}

/** Il riepilogo di un cambio di voce: niente si scrive finché non si dice sì. Va a pacchetti, ognuno tutto o niente. */
function CambiaVoce({ d, ids, righe, voci, onRileggi, onFatto, onChiudi }: { d: DatiSegreteria; ids: string[]; righe: RigaMovimento[]; voci: VoceContabile[]; onRileggi: () => void; onFatto: () => void; onChiudi: () => void }) {
  const [voceId, setVoceId] = useState('')
  const [lavoro, setLavoro] = useState<number | null>(null)
  // Un secondo tocco prima che lo schermo cambi non deve ripartire: lo stato arriva dopo, il riferimento subito.
  const inCorso = useRef(false)
  const [esito, setEsito] = useState<string | null>(null)
  const [fermo, setFermo] = useState<string | null>(null)
  const offerte = vociPerLaScelta(ids, righe, voci)
  const riep = riepilogoCambioVoce(ids, righe, voceId, voci)
  // Il controllo scorre l'elenco intero: si rifà solo se cambia la scelta o la voce, non a ogni pacchetto scritto.
  const nomeVoce = voci.find((v) => v.id === voceId)?.nome
  // Qui la persona non si sceglie: anche un movimento a mano solo verso una quota o un corso si cambia dal dettaglio.
  const guaio = useMemo(() => {
    if (!voceId) return null
    const scelti = new Set(ids)
    if (righe.some((r) => scelti.has(r.id) && r.origine === 'movimento' && vuolePersonaRiga(r, nomeVoce))) return UNA_RIGA_ALLA_VOLTA
    return pacchetti(ids).map((p) => cosaNonVaCambioVoce(p, righe, voci, voceId)).find(Boolean) ?? null
  }, [ids, righe, voci, voceId, nomeVoce])
  const cambia = async () => {
    if (inCorso.current) return
    inCorso.current = true
    const lotti = pacchetti(ids)
    let cambiati = 0
    let giaCosi = 0
    let fatti = 0
    setFermo(null)
    setLavoro(0)
    try {
      for (const lotto of lotti) {
        const r = await d.cambiaVoceMovimenti(lotto, voceId)
        cambiati += r.cambiati
        giaCosi += r.giaCosi
        fatti += lotto.length
        setLavoro(fatti)
      }
      setEsito(`Voce «${nomeVoce ?? ''}»: ${esitoCambioVoce(cambiati, giaCosi)}`)
      onRileggi()
    } catch (e) {
      setFermo(`${lotti.length > 1 ? `Cambiati ${fatti} su ${ids.length}. ` : ''}${messaggio(e, 'Non è cambiato niente: riprova.')}${lotti.length > 1 ? ' Quel pacchetto e i seguenti non sono cambiati: togli il movimento che non va dalla scelta e riprova.' : ''}`)
      onRileggi()
    } finally {
      inCorso.current = false
      setLavoro(null)
    }
  }
  if (esito)
    return (
      <section aria-label="Voce cambiata" className="sg-riquadro">
        <span className="sg-etichetta">FATTO</span>
        <span className="sg-riquadro-titolo ob" role="status">{esito}</span>
        <span className="sg-sotto">I totali per voce sono già aggiornati. Ogni cambio resta nel movimento: chi, quando, la voce di prima.</span>
        <div className="row" style={{ gap: 10 }}>
          <button type="button" className="sg-btn sg-btn-pieno" onClick={onFatto}>Torna all’elenco</button>
        </div>
      </section>
    )
  return (
    <section aria-label="Cambia la voce" className="sg-riquadro">
      <span className="sg-etichetta">NIENTE SI SCRIVE FINCHÉ NON DICI SÌ</span>
      <span className="sg-riquadro-titolo ob">CAMBIA LA VOCE A {ids.length} {ids.length === 1 ? 'MOVIMENTO' : 'MOVIMENTI'}</span>
      <div className="stack" style={{ gap: 0 }}>
        {([
          ['MOVIMENTI', `${riep.quanti} ${riep.tipo === 'entrata' ? 'entrate' : 'uscite'} · ${riep.tipo === 'entrata' ? '+ ' : '− '}${soldi(riep.totale)}`],
          ['VOCE ATTUALE', riep.daVoci.map((x) => `${x.voce} (${x.quanti})`).join(', ')],
          ['SALDI', 'restano uguali'],
        ] as const).map(([k, v]) => (
          <div key={k} className="row" style={{ gap: 14, padding: '8px 0', borderBottom: '1px solid var(--line-soft)', alignItems: 'baseline' }}>
            <span className="sg-etichetta" style={{ width: 130, flexShrink: 0 }}>{k}</span>
            <span style={{ fontSize: 15, minWidth: 0, overflowWrap: 'anywhere' }}>{v}</span>
          </div>
        ))}
      </div>
      <Campo id="cv-voce" etichetta="NUOVA VOCE" manca={!voceId} nota={offerte.length ? { testo: 'Non c’è la voce? Si crea in VOCI.', guaio: false } : { testo: 'Scegli solo entrate o solo uscite.', guaio: false }}>
        <select id="cv-voce" className="sg-campo" value={voceId} onChange={(e) => setVoceId(e.target.value)} disabled={lavoro !== null}>
          <option value="">Scegli la voce</option>
          {offerte.map((v) => (
            <option key={v.id} value={v.id}>{v.nome}</option>
          ))}
        </select>
      </Campo>
      <span className="sg-sotto">
        Cambia solo la voce: importo, data, cassa e testo restano come sono, anche nei giorni già chiusi (la chiusura non cambia).
        {voceId && riep.giaCosi > 0 && ` ${riep.giaCosi} ${riep.giaCosi === 1 ? 'ha già' : 'hanno già'} questa voce: ${riep.giaCosi === 1 ? 'resta' : 'restano'} come ${riep.giaCosi === 1 ? 'è' : 'sono'}.`}
        {ids.length > 500 && ` Vanno a pacchetti da 500, ognuno tutto o niente.`}
      </span>
      {guaio && <span role="alert" style={{ fontSize: 14, color: 'var(--rosso-testo)' }}>{guaio}</span>}
      {fermo && <div role="alert" className="sg-riquadro" style={{ borderColor: 'var(--rosso-testo)', fontSize: 15 }}>{fermo}</div>}
      <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
        <button type="button" className="sg-btn sg-btn-pieno" disabled={!voceId || !!guaio || lavoro !== null} onClick={() => void cambia()}>
          {lavoro !== null ? `Cambio… ${lavoro} su ${ids.length}` : `Sì, cambia la voce${nomeVoce ? ` in «${nomeVoce}»` : ''}`}
        </button>
        <button type="button" className="sg-btn sg-btn-linea" disabled={lavoro !== null} onClick={onChiudi}>
          No, torna all’elenco
        </button>
      </div>
    </section>
  )
}

function NuovoMovimento({ d, voci, casse, righe, chiusure, fai, onFatto, onChiudi }: { d: DatiSegreteria; voci: VoceContabile[]; casse: Cassa[]; righe: RigaMovimento[]; chiusure: ChiusuraCassa[]; fai: Fai; onFatto: (nuova: RigaMovimento) => void; onChiudi: () => void }) {
  const oggi = oggiARoma()
  const [tipo, setTipo] = useState<'entrata' | 'uscita'>('uscita')
  const [data, setData] = useState(oggi)
  const [importo, setImporto] = useState('')
  const [cassaId, setCassaId] = useState(casse[0]?.id ?? '')
  const [voceId, setVoceId] = useState('')
  const [descrizione, setDescrizione] = useState('')
  const [nota, setNota] = useState('')
  const [persona, setPersona] = useState<CandidatoPersona | null>(null)
  useBozza(importo !== '' || descrizione !== '' || nota !== '' || !!persona, 'Il movimento')
  const dellaScelta = vociOfferte(voci, tipo)
  const cent = centesimi(importo)
  const conPersona = vuolePersona(tipo, voci.find((v) => v.id === voceId)?.nome)
  const personaId = conPersona ? persona?.id : undefined
  const guaio = cosaNonVaImporto(importo, '40,00') ?? (cent === null ? null : cosaNonVaMovimento({ tipo, data, importo: cent, voceId, cassaId, descrizione, nota, personaId }, voci, casse, oggi, chiusure))
  const manca = cent === null || !!guaio || !voceId || !descrizione.trim()
  // Un avviso, non un blocco: la stessa quota forse è già una ricevuta o un pagamento in PAGAMENTI.
  const doppione = personaId && cent !== null ? ricevutaDoppione(righe, personaId, cent, data) : null
  return (
    <section aria-label="Nuovo movimento" className="sg-riquadro">
      <span className="sg-etichetta">ENTRATA O USCITA</span>
      <span className="sg-riquadro-titolo ob">NUOVO MOVIMENTO</span>
      <div className="row" style={{ gap: 10 }}>
        {(['uscita', 'entrata'] as const).map((t) => (
          <button key={t} type="button" className="num sg-chip" aria-pressed={tipo === t} onClick={() => { setTipo(t); setVoceId('') }}>
            {t.toUpperCase()}
          </button>
        ))}
      </div>
      <div className="sg-due sg-scheda-campi">
        <Campo id="mv-data" etichetta="DATA">
          <input id="mv-data" className="sg-campo" type="date" value={data} max={oggi} onChange={(e) => setData(e.target.value)} />
        </Campo>
        <Campo id="mv-importo" etichetta="IMPORTO" manca={importo === ''}>
          <input id="mv-importo" className="sg-campo" inputMode="decimal" placeholder="40,00" value={importo} onChange={(e) => setImporto(e.target.value)} aria-invalid={(importo !== '' && cent === null) || undefined} />
        </Campo>
        <Campo id="mv-cassa" etichetta="CASSA">
          <select id="mv-cassa" className="sg-campo" value={cassaId} onChange={(e) => setCassaId(e.target.value)}>
            {casse.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
        </Campo>
        <Campo id="mv-voce" etichetta="VOCE" manca={!voceId} nota={dellaScelta.length ? undefined : { testo: `Non c’è nessuna voce di ${tipo === 'entrata' ? 'entrata' : 'uscita'}: si crea in VOCI.`, guaio: false }}>
          <select id="mv-voce" className="sg-campo" value={voceId} onChange={(e) => setVoceId(e.target.value)}>
            <option value="">Scegli la voce</option>
            {dellaScelta.map((v) => (
              <option key={v.id} value={v.id}>{v.nome}</option>
            ))}
          </select>
        </Campo>
        {conPersona && (
          <div style={{ gridColumn: '1 / -1' }}>
            <CampoPersona d={d} scelta={persona} onScegli={setPersona} manca="Scegli la persona: una quota o un corso si registra sempre con la sua scheda." />
          </div>
        )}
        <Campo id="mv-descrizione" etichetta="DESCRIZIONE" largo manca={!descrizione.trim()}>
          <input id="mv-descrizione" className="sg-campo" maxLength={200} value={descrizione} onChange={(e) => setDescrizione(e.target.value)} />
        </Campo>
        <Campo id="mv-nota" etichetta="NOTA · FACOLTATIVA" largo>
          <textarea id="mv-nota" className="sg-campo" rows={2} maxLength={300} value={nota} onChange={(e) => setNota(e.target.value)} />
        </Campo>
      </div>
      {giornoChiuso(chiusure, [cassaId], data) && <span role="status" style={{ fontSize: 14, color: 'var(--rosso-testo)' }}>Quel giorno la cassa è già chiusa: scegli una data dopo la chiusura.</span>}
      {doppione && persona && (
        <div role="status" className="sg-riquadro" data-avviso="true" style={{ borderColor: 'var(--giallo-testo)', gap: 4 }}>
          <span className="sg-etichetta" style={{ color: 'var(--giallo-testo)' }}>FORSE GIÀ NEGLI INCASSI</span>
          <span style={{ fontSize: 15 }}>
            {persona.cognome} {persona.nome} ha già {doppione.origine === 'ricevuta' ? 'una ricevuta' : 'un pagamento'} di {soldi(doppione.importo)} del {dataRicevuta(doppione.data)} fra gli incassi. Se è la stessa quota, non scriverla qui: c’è già.
          </span>
        </div>
      )}
      <span className="sg-sotto">Un solo importo, senza IVA. Registrato, non si cambia: si annulla e si rifà (la descrizione, la nota e la persona sì). Niente dati personali che non servono.</span>
      {guaio && guaio !== SCEGLI_LA_PERSONA && <span role="alert" style={{ fontSize: 14, color: 'var(--rosso-testo)' }}>{guaio}</span>}
      <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
        <button
          type="button"
          className="sg-btn sg-btn-pieno"
          disabled={manca}
          onClick={async () => {
            if (cent === null) return
            const dati = { tipo, data, importo: cent, voceId, cassaId, descrizione: descrizione.trim(), nota: nota.trim() || undefined, personaId }
            const riepilogo = riepilogoMovimento(dati, voci.find((v) => v.id === voceId)?.nome ?? '', casse.find((c) => c.id === cassaId)?.nome ?? '')
            if (personaId && persona) riepilogo.push(`Persona: ${persona.cognome} ${persona.nome}`)
            if (!(await chiedi(`Registrare questo movimento?\n${riepilogo.join('\n')}`, 'Sì, registra il movimento', { no: 'No, torna al modulo' }))) return
            void fai(() => d.registraMovimento(dati), 'Movimento registrato', () => onFatto(rigaAppenaScritta({ tipo, data, importo: cent, descrizione: dati.descrizione, voce: voci.find((v) => v.id === voceId)?.nome ?? null, cassaId, personaId })))
          }}
        >
          Registra il movimento
        </button>
        <button type="button" className="sg-btn sg-btn-linea" onClick={onChiudi}>
          No, torna indietro
        </button>
      </div>
    </section>
  )
}

function NuovoGiroconto({ d, casse, voci, righe, chiusure, fai, onFatto, onChiudi }: { d: DatiSegreteria; casse: Cassa[]; voci: VoceContabile[]; righe: RigaMovimento[]; chiusure: ChiusuraCassa[]; fai: Fai; onFatto: (nuova: RigaMovimento) => void; onChiudi: () => void }) {
  const oggi = oggiARoma()
  const [da, setDa] = useState(casse[0]?.id ?? '')
  const [a, setA] = useState(casse[1]?.id ?? '')
  const [data, setData] = useState(oggi)
  const [importo, setImporto] = useState('')
  const [nota, setNota] = useState('')
  useBozza(importo !== '' || nota !== '', 'Il giroconto')
  const cent = centesimi(importo)
  const guaio = cosaNonVaImporto(importo, '1000,00') ?? (cent === null ? null : cosaNonVaGiroconto({ daCassaId: da, aCassaId: a, data, importo: cent, nota }, casse, oggi, chiusure))
  const manca = cent === null || !!guaio
  // Dalla cassa Satispay arriva in banca l'incassato meno la commissione: la differenza si propone come uscita.
  const [conCommissione, setConCommissione] = useState(true)
  const daSatispay = casse.some((c) => c.id === da && c.nome === NOME_CASSA_SATISPAY)
  const voceCommissioni = voci.find((v) => v.tipo === 'uscita' && v.attiva && v.nome === 'Commissioni bancarie')
  const commissione = daSatispay && voceCommissioni && !manca ? commissioneSatispay(righe, da, data, cent) : null
  const scelta = (id: string, valore: string, set: (v: string) => void, etichetta: string) => (
    <Campo id={id} etichetta={etichetta}>
      <select id={id} className="sg-campo" value={valore} onChange={(e) => set(e.target.value)}>
        {casse.map((c) => (
          <option key={c.id} value={c.id}>{c.nome}</option>
        ))}
      </select>
    </Campo>
  )
  return (
    <section aria-label="Giroconto" className="sg-riquadro">
      <span className="sg-etichetta">PER IL VERSAMENTO IN BANCA</span>
      <span className="sg-riquadro-titolo ob">GIROCONTO FRA LE CASSE</span>
      <div className="sg-due sg-scheda-campi">
        {scelta('gc-da', da, setDa, 'DA')}
        {scelta('gc-a', a, setA, 'A')}
        <Campo id="gc-data" etichetta="DATA">
          <input id="gc-data" className="sg-campo" type="date" value={data} max={oggi} onChange={(e) => setData(e.target.value)} />
        </Campo>
        <Campo id="gc-importo" etichetta={daSatispay ? 'ARRIVATI IN BANCA' : 'IMPORTO'} manca={importo === ''}>
          <input id="gc-importo" className="sg-campo" inputMode="decimal" placeholder="1000,00" value={importo} onChange={(e) => setImporto(e.target.value)} aria-invalid={(importo !== '' && cent === null) || undefined} />
        </Campo>
        <Campo id="gc-nota" etichetta="NOTA · FACOLTATIVA" largo>
          <textarea id="gc-nota" className="sg-campo" rows={2} maxLength={300} value={nota} onChange={(e) => setNota(e.target.value)} />
        </Campo>
      </div>
      {commissione && cent !== null && (
        <div className="stack" style={{ gap: 6, background: 'var(--bg)', padding: '14px 16px' }}>
          <span style={{ fontSize: 14 }}>
            Dal {dataRicevuta(commissione.dal).slice(0, 5)} al {dataRicevuta(commissione.al).slice(0, 5)} Satispay ha incassato <b>{soldi(commissione.incassato)}</b> ({commissione.pagamenti === 1 ? '1 pagamento' : `${commissione.pagamenti} pagamenti`}{commissione.rimborsi ? `, meno ${commissione.rimborsi === 1 ? '1 rimborso' : `${commissione.rimborsi} rimborsi`}` : ''}). In banca ne sono arrivati {soldi(cent)}.
          </span>
          <label className="row" style={{ gap: 12, alignItems: 'center', fontSize: 14, minHeight: 44 }}>
            <input type="checkbox" style={{ width: 24, height: 24, margin: 0, accentColor: 'var(--testo)', flexShrink: 0 }} checked={conCommissione} onChange={(e) => setConCommissione(e.target.checked)} />
            <span>Registra <b>{soldi(commissione.commissione)}</b> come uscita «Commissioni bancarie» dalla cassa Satispay</span>
          </label>
          <span className="sg-sotto">Se la differenza non è la commissione (un versamento a metà, un errore), togli la spunta e scrivila tu.</span>
        </div>
      )}
      {giornoChiuso(chiusure, [da, a], data) && <span role="status" style={{ fontSize: 14, color: 'var(--rosso-testo)' }}>Quel giorno una delle casse è già chiusa: scegli una data dopo la chiusura.</span>}
      <span className="sg-sotto">Sposta soldi fra le casse: non è un’entrata né un’uscita, e non entra nei totali per voce. Si annulla come un movimento{commissione && conCommissione ? '; la commissione si annulla a parte' : ''}.</span>
      {guaio && <span role="alert" style={{ fontSize: 14, color: 'var(--rosso-testo)' }}>{guaio}</span>}
      <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
        <button
          type="button"
          className="sg-btn sg-btn-pieno"
          disabled={manca}
          onClick={async () => {
            if (cent === null) return
            const dati = { daCassaId: da, aCassaId: a, data, importo: cent, nota: nota.trim() || undefined }
            const riepilogo = riepilogoGiroconto(dati, casse.find((c) => c.id === da)?.nome ?? '', casse.find((c) => c.id === a)?.nome ?? '')
            const spesa = commissione && conCommissione ? spesaCommissione(commissione, da, data, voci) : null
            if (spesa) riepilogo.push(`Commissione: ${soldi(spesa.importo)} in «Commissioni bancarie»`)
            if (!(await chiedi(`Registrare questo giroconto?\n${riepilogo.join('\n')}`, spesa ? 'Sì, registra giroconto e commissione' : 'Sì, registra il giroconto', { no: 'No, torna al modulo' }))) return
            const fatto = () => onFatto(rigaAppenaScritta({ tipo: 'giroconto', data, importo: cent, descrizione: `Giroconto da ${casse.find((c) => c.id === da)?.nome ?? ''} a ${casse.find((c) => c.id === a)?.nome ?? ''}`, cassaId: da, cassaAId: a }))
            // Due scritture, non una: se la seconda non va, il giroconto resta, il modulo si chiude (rifarlo lo scriverebbe due volte) e la commissione si scrive a mano.
            let giroScritto = false
            const riuscito = await fai(async () => {
              await d.registraGiroconto(dati)
              giroScritto = true
              if (spesa) await d.registraMovimento(spesa).catch(() => { throw new Error('Il giroconto c’è, la commissione no: scrivila da CONTABILITÀ con Nuovo movimento') })
            }, spesa ? 'Giroconto e commissione registrati' : 'Giroconto registrato', fatto)
            if (!riuscito && giroScritto) fatto()
          }}
        >
          {commissione && conCommissione ? 'Registra giroconto e commissione' : 'Registra il giroconto'}
        </button>
        <button type="button" className="sg-btn sg-btn-linea" onClick={onChiudi}>
          No, torna indietro
        </button>
      </div>
    </section>
  )
}

/** Un movimento aperto dall'elenco: a mano si annulla e se ne correggono descrizione e nota; un incasso degli iscritti si guarda e basta. */
// Un link che si tocca col dito: alto 44px, come «mostra tutte» nei previsti.
const DITO = { fontSize: 15, minHeight: 44, display: 'inline-flex', alignItems: 'center' } as const

function MovimentoAperto({ d, voci, riga, chiusure, cassa, cassaA, nomePersona, fai, onChiudi, onFatto, onPersona }: { d: DatiSegreteria; voci: VoceContabile[]; riga: RigaMovimento; chiusure: ChiusuraCassa[]; cassa: string; cassaA: string; nomePersona?: string; fai: Fai; onChiudi: () => void; onFatto: () => void; onPersona?: (personaId: string) => void }) {
  const manuale = riga.origine === 'movimento'
  const giro = riga.tipo === 'giroconto'
  const chiuso = cosaNonVaAnnulloMovimento(riga, chiusure)
  const dallaChat = fraseDallaChat(riga)
  const [descrizione, setDescrizione] = useState(riga.descrizione)
  const [nota, setNota] = useState(riga.nota ?? '')
  const [chiedendo, setChiedendo] = useState(false)
  // La voce si cambia anche nei giorni chiusi: non tocca i soldi. La traccia dice chi l'ha cambiata e quando.
  const offerte = riga.tipo === 'entrata' || riga.tipo === 'uscita' ? vociOfferte(voci, riga.tipo) : []
  const voceAttuale = voci.find((v) => v.nome === riga.voce && v.tipo === riga.tipo)
  const [voceId, setVoceId] = useState(voceAttuale?.id ?? '')
  const voceNuova = voci.find((v) => v.id === voceId)
  // Una riga a mano che va su una quota o un corso ci va con la persona: quella che ha già, o quella scelta qui.
  const conPersona = !!voceId && voceId !== voceAttuale?.id && vuolePersonaRiga(riga, voceNuova?.nome)
  const [personaScelta, setPersonaScelta] = useState<CandidatoPersona | null>(null)
  const personaId = personaScelta?.id ?? riga.personaId
  const voceGuaio = voceId && voceId !== voceAttuale?.id ? cosaNonVaCambioVoce([riga.id], [riga], voci, voceId, personaId) : null
  const [collegando, setCollegando] = useState(false)
  const scollega = async () => {
    const si = await chiedi(`Scollegare «${riga.descrizione}» da ${nomePersona ?? 'questa persona'}? Il movimento resta com'è, senza persona.`, 'Sì, scollega', { no: 'No, lascialo' })
    if (si) void fai(() => d.scollegaMovimentiPersona([riga.id]), 'Movimento scollegato', onFatto)
  }
  const traccia = useCarica(() => (manuale && !giro ? d.cambiVoceMovimento(riga.id) : Promise.resolve([])), [d, riga.id, manuale, giro])
  useBozza(descrizione !== riga.descrizione || nota !== (riga.nota ?? ''), 'La correzione')
  const annulla = async () => {
    if (chiedendo) return
    setChiedendo(true)
    const domanda = `Annullare «${riga.descrizione}» da ${soldi(riga.importo)} del ${dataRicevuta(riga.data)}? Resta in elenco, annullato, e non si conta più.`
    const si = await chiedi(domanda, 'Sì, annulla il movimento', { no: 'No, lascialo', pericolo: true })
    setChiedendo(false)
    if (!si) return
    void fai(() => d.annullaMovimento(riga.id), 'Movimento annullato', onFatto)
  }
  const dettaglio: Array<[string, string]> = [
    ['DATA', dataRicevuta(riga.data)],
    ['TIPO', riga.tipo === 'giroconto' ? 'GIROCONTO' : riga.tipo === 'entrata' ? 'ENTRATA' : 'USCITA'],
    ...(cambiabile(riga) ? [] : ([['VOCE', riga.voce ?? '—']] as Array<[string, string]>)),
    ['CASSA', riga.tipo === 'giroconto' ? `${cassa} → ${cassaA}` : cassa],
    ['IMPORTO', soldi(riga.importo)],
  ]
  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="row" style={{ gap: 10, alignItems: 'center' }}>
        <span className="sg-etichetta">{manuale ? 'IL MOVIMENTO' : 'INCASSO DI UN ISCRITTO'}</span>
        {riga.dallaChat && <span className="num sg-tag">Dalla chat</span>}
      </div>
      <span className="sg-riquadro-titolo ob">{riga.descrizione}</span>
      <div className="stack" style={{ gap: 0 }}>
        {dettaglio.map(([k, v]) => (
          <div key={k} className="row" style={{ gap: 14, padding: '8px 0', borderBottom: '1px solid var(--line-soft)', alignItems: 'baseline' }}>
            <span className="sg-etichetta" style={{ width: 130, flexShrink: 0 }}>{k}</span>
            <span style={{ fontSize: 15, minWidth: 0, overflowWrap: 'anywhere' }}>{v}</span>
          </div>
        ))}
      </div>
      {(riga.personaId || (riga.tipo !== 'giroconto' && vuolePersona(riga.tipo, riga.voce ?? undefined))) && (
        <div className="row" style={{ gap: 14, padding: '8px 0', borderBottom: '1px solid var(--line-soft)', alignItems: 'baseline', flexWrap: 'wrap' }}>
          <span className="sg-etichetta" style={{ width: 130, flexShrink: 0 }}>PERSONA</span>
          {riga.personaId ? (
            <span style={{ fontSize: 15, minWidth: 0, overflowWrap: 'anywhere' }}>{nomePersona ?? '…'}</span>
          ) : (
            <span style={{ fontSize: 15, color: 'var(--rosso-testo)' }}>Nessuna: di chi è?</span>
          )}
          {riga.personaId && onPersona && (
            <button type="button" className="sg-link" style={DITO} onClick={() => onPersona(riga.personaId ?? '')}>Apri la scheda ›</button>
          )}
          {manuale && !riga.annullato && !collegando && (
            <>
              <button type="button" className="sg-link" style={DITO} onClick={() => setCollegando(true)}>{riga.personaId ? 'Cambia persona' : 'Collega a una persona'}</button>
              {riga.personaId && <button type="button" className="sg-link" style={DITO} onClick={() => void scollega()}>Scollega</button>}
            </>
          )}
        </div>
      )}
      {collegando && <CollegaAPersona d={d} righe={[riga]} fai={fai} onFatto={onFatto} onChiudi={() => setCollegando(false)} />}
      {!manuale && <span className="sg-sotto">Si cambia nella scheda della persona, dove nasce: se la ricevuta o il pagamento cambia o si annulla, cambia da sé anche qui.</span>}
      {manuale && riga.annullato && <span className="sg-sotto"><span className="num sg-tag" data-tipo="manca">Annullato</span> Resta in elenco e non si conta più.</span>}
      {manuale && !riga.annullato && (
        <>
          <div className="sg-due sg-scheda-campi">
            {cambiabile(riga) && (
              <Campo id="ma-voce" etichetta="VOCE" largo>
                <select id="ma-voce" className="sg-campo" value={voceId} onChange={(e) => setVoceId(e.target.value)}>
                  {!voceId && <option value="">Scegli la voce</option>}
                  {voceAttuale && !offerte.some((v) => v.id === voceAttuale.id) && <option value={voceAttuale.id}>{voceAttuale.nome}</option>}
                  {offerte.map((v) => (
                    <option key={v.id} value={v.id}>{v.nome}</option>
                  ))}
                </select>
              </Campo>
            )}
            {!giro && (
              <Campo id="ma-descrizione" etichetta="DESCRIZIONE" largo>
                <input id="ma-descrizione" className="sg-campo" maxLength={200} value={descrizione} onChange={(e) => setDescrizione(e.target.value)} />
              </Campo>
            )}
            <Campo id="ma-nota" etichetta="NOTA" largo>
              <textarea id="ma-nota" className="sg-campo" rows={2} maxLength={300} value={nota} onChange={(e) => setNota(e.target.value)} />
            </Campo>
          </div>
          {conPersona && !riga.personaId && (
            <CampoPersona d={d} scelta={personaScelta} onScegli={setPersonaScelta} manca="Scegli la persona: una quota o un corso si sposta sempre con la sua scheda." />
          )}
          {chiuso && <span className="sg-sotto">{chiuso}</span>}
          {voceGuaio && voceGuaio !== SCEGLI_LA_PERSONA && <span role="alert" style={{ fontSize: 14, color: 'var(--rosso-testo)' }}>{voceGuaio}</span>}
          {dallaChat && <span className="sg-sotto">{dallaChat}</span>}
          <span className="sg-sotto">Importo, data e cassa non si cambiano: si annulla e si rifà.{giro ? ' La descrizione di un giroconto la scrive il sistema.' : ' La voce sì, anche se il giorno è già chiuso: i soldi non cambiano.'}</span>
        </>
      )}
      {manuale && !giro && (traccia.guaio || (traccia.dato?.length ?? 0) > 0) && (
        <div className="stack" style={{ gap: 6 }}>
          <span className="sg-etichetta">COSA È CAMBIATO</span>
          {traccia.guaio && <span className="sg-sotto">{traccia.guaio}</span>}
          {traccia.dato?.map((c, i) => (
            <span key={i} style={{ fontSize: 15 }}>{dataRicevuta(giornoRoma(c.quando))} · {c.chi}: <span style={{ color: 'var(--dim)' }}>{c.prima}</span> → {c.dopo}</span>
          ))}
        </div>
      )}
      <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
        {manuale && !riga.annullato && (
          <>
            {cambiabile(riga) && (
              <button type="button" className="sg-btn sg-btn-pieno" disabled={!voceId || voceId === voceAttuale?.id || !!voceGuaio} onClick={() => void fai(() => d.cambiaVoceMovimenti([riga.id], voceId, conPersona ? personaId : undefined), `Voce cambiata in «${offerte.find((v) => v.id === voceId)?.nome ?? ''}»`, onFatto)}>
                Cambia la voce
              </button>
            )}
            <Tasto disabled={!descrizione.trim()} onClick={() => void fai(() => d.correggiTestoMovimento(riga.id, descrizione, nota.trim() || undefined), 'Testo corretto', onFatto)}>
              Salva il testo
            </Tasto>
            {!chiuso && (
              <Tasto tono="rosso" disabled={chiedendo} onClick={() => void annulla()}>
                Annulla il movimento
              </Tasto>
            )}
          </>
        )}
        <Tasto onClick={onChiudi}>
          Chiudi
        </Tasto>
      </div>
    </div>
  )
}

function Voci({ d, voci, chiusure, righe, fai, onCambiato }: { d: DatiSegreteria; voci: VoceContabile[]; chiusure: ChiusuraCassa[]; righe: RigaMovimento[]; fai: Fai; onCambiato: () => void }) {
  const usate = (v: VoceContabile) => quanteUsate(righe, v)
  // Dopo una chiusura, per correggere un giorno chiuso serve una voce di rettifica: si crea in un tocco.
  const mancano = chiusure.some((k) => !k.annullataIl) ? rettificheMancanti(voci) : []
  const colonna = (tipo: 'entrata' | 'uscita', titolo: string) => (
    <ColonnaVoci key={tipo} d={d} tipo={tipo} titolo={titolo} voci={voci} usate={usate} fai={fai} onCambiato={onCambiato} />
  )
  return (
    <div className="stack" style={{ gap: 18 }}>
      {mancano.length > 0 && (
        <section aria-label="Voce di rettifica" className="sg-riquadro">
          <span className="sg-etichetta">PER CORREGGERE UN GIORNO CHIUSO</span>
          <span style={{ fontSize: 15 }}>Dopo la chiusura della cassa uno sbaglio si corregge con un movimento che ha una voce di rettifica: ne manca una {mancano.length === 2 ? 'di entrata e una di uscita' : `di ${mancano[0] === 'entrata' ? 'entrata' : 'uscita'}`}.</span>
          <div>
            <button type="button" className="sg-btn sg-btn-pieno" onClick={() => void fai(async () => { for (const tipo of mancano) await d.salvaVoce({ nome: 'Rettifica', tipo }) }, 'Voce «Rettifica» creata', onCambiato)}>
              Crea la voce «rettifica»
            </button>
          </div>
        </section>
      )}
      <div className="row" style={{ gap: 28, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {colonna('entrata', 'VOCI DI ENTRATA')}
        {colonna('uscita', 'VOCI DI USCITA')}
      </div>
      <span className="sg-sotto">
        Ogni voce è solo di entrata o solo di uscita. Una voce usata non si cancella: si disattiva, resta sui movimenti vecchi e non si offre per i nuovi. Quelle di sistema (gli incassi degli iscritti e la differenza della chiusura di cassa) non si cambiano. Non c’è «Varie»: se la crei, non farci finire spese diverse.
      </span>
    </div>
  )
}

function ColonnaVoci({ d, tipo, titolo, voci, usate, fai, onCambiato }: { d: DatiSegreteria; tipo: 'entrata' | 'uscita'; titolo: string; voci: VoceContabile[]; usate: (v: VoceContabile) => number; fai: Fai; onCambiato: () => void }) {
  const [nome, setNome] = useState('')
  useBozza(nome !== '', `Una voce di ${tipo}`)
  const dellaColonna = voci.filter((v) => v.tipo === tipo).sort((x, y) => Number(y.attiva) - Number(x.attiva) || Number(y.diSistema) - Number(x.diSistema) || x.nome.localeCompare(y.nome, 'it'))
  const guaio = nome.trim() === '' ? null : cosaNonVaVoce(nome, tipo, voci)
  return (
    <section className="stack grow" style={{ gap: 8, minWidth: 280, flexBasis: 320 }} aria-label={titolo}>
      <span className="sg-etichetta">{titolo}</span>
      {dellaColonna.map((v) => (
        <div key={v.id} className="sg-voce-elenco" style={{ opacity: v.attiva ? 1 : 0.55 }}>
          <span style={{ flex: 1, fontSize: 15, fontWeight: 600 }}>
            {v.nome}
            {v.diSistema && <span className="num sg-tag" style={{ marginLeft: 8 }}>Sistema</span>}
            {!v.attiva && <span className="num sg-tag" style={{ marginLeft: 8 }}>Non in uso</span>}
          </span>
          <span style={{ fontSize: 13, color: 'var(--dim)' }}>{v.diSistema ? (v.nome === VOCE_DIFFERENZA ? 'scritta dalla chiusura di cassa' : 'incassi degli iscritti') : usate(v) ? `${usate(v)} ${usate(v) === 1 ? 'movimento' : 'movimenti'}` : 'mai usata'}</span>
          {!v.diSistema && (
            <button
              type="button"
              className={v.attiva ? 'sg-link sg-pericolo' : 'sg-link'}
              style={{ fontSize: 15, minHeight: 44, display: 'inline-flex', alignItems: 'center', padding: '0 6px' }}
              onClick={async () => {
                if (v.attiva && !(await chiedi(`Disattivare la voce «${v.nome}»? Non si può più scegliere nei movimenti nuovi; quelli già scritti restano.`, 'Disattiva la voce', { pericolo: true }))) return
                void fai(() => d.attivaVoce(v.id, !v.attiva), v.attiva ? 'Voce disattivata' : 'Voce riattivata', onCambiato)
              }}
            >
              {v.attiva ? 'Disattiva' : 'Riattiva'}
            </button>
          )}
        </div>
      ))}
      <form
        className="row"
        style={{ gap: 10, paddingTop: 6 }}
        onSubmit={(e) => {
          e.preventDefault()
          if (guaio || !nome.trim()) return
          void fai(() => d.salvaVoce({ nome, tipo }), 'Voce creata', () => {
            setNome('')
            onCambiato()
          })
        }}
      >
        <label htmlFor={`nuova-voce-${tipo}`} className="vh">Nome della nuova voce di {tipo}</label>
        <input id={`nuova-voce-${tipo}`} className="sg-campo grow" placeholder="Nome della voce" maxLength={60} value={nome} onChange={(e) => setNome(e.target.value)} aria-invalid={!!guaio || undefined} />
        <button type="submit" className="sg-btn sg-btn-linea" disabled={!nome.trim() || !!guaio}>
          Nuova voce
        </button>
      </form>
      {guaio && <span role="alert" style={{ fontSize: 14, color: 'var(--rosso-testo)' }}>{guaio}</span>}
    </section>
  )
}

function Casse({ d, casse, chiusure, guaioChiusure, righe, fai, onCambiato }: { d: DatiSegreteria; casse: Cassa[]; chiusure: ChiusuraCassa[]; guaioChiusure?: string; righe: RigaMovimento[]; fai: Fai; onCambiato: () => void }) {
  const conti = residui(casse, righe)
  const contanti = casse.find((c) => c.nome === NOME_CASSA_CONTANTI)
  const [chiudo, setChiudo] = useState(false)
  const chiusureRef = useRef<HTMLDivElement>(null)
  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="row" style={{ gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {casse.map((c) => (
          <SaldoCassa
            key={c.id}
            d={d}
            cassa={c}
            righe={righe}
            chiusura={c.id === contanti?.id ? ultimaChiusura(chiusure, c.id) : undefined}
            conto={conti.find((x) => x.cassaId === c.id)}
            fai={fai}
            onCambiato={onCambiato}
            onChiudi={c.id === contanti?.id && !guaioChiusure ? () => setChiudo(true) : undefined}
            nonSiChiude={c.id === contanti?.id ? motivoNonSiChiude(c, ultimaChiusura(chiusure, c.id)) : undefined}
          />
        ))}
      </div>
      {guaioChiusure && <Guaio testo={guaioChiusure} />}
      {chiudo && contanti && (
        <InVista>
          <ChiudiCassa d={d} cassa={contanti} casse={casse} chiusure={chiusure} righe={righe} fai={fai} onFatto={() => { setChiudo(false); onCambiato(); window.setTimeout(() => chiusureRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 150) }} onRileggi={onCambiato} onChiudi={() => setChiudo(false)} />
        </InVista>
      )}
      <div ref={chiusureRef} style={{ scrollMarginTop: 12 }}>{contanti && chiusure.length > 0 && <ElencoChiusure d={d} cassa={contanti} casse={casse} chiusure={chiusure} righe={righe} fai={fai} onCambiato={onCambiato} />}</div>
      <span className="sg-sotto">Il saldo iniziale cambia solo da qui e solo dall’amministrazione, e non dopo una chiusura. Il Conto Corrente non si conta: si confronta con l’estratto della banca.</span>
    </div>
  )
}

/** Perché per ora non c'è niente da chiudere: manca il giorno di partenza, o è già chiusa fino a oggi. */
const motivoNonSiChiude = (cassa: Cassa, ultima: ChiusuraCassa | undefined): string | undefined => {
  if (!cassa.dal) return 'Prima imposta il saldo iniziale e il giorno di partenza, qui sotto.'
  if (ultima && ultima.data >= oggiARoma()) return 'Già chiusa fino a oggi.'
  return undefined
}

/** Chiudere la Cassa Contanti fino a un giorno: l'app dice quanto c'è «secondo i conti», si scrive quanto si è contato. */
function ChiudiCassa({ d, cassa, casse, chiusure, righe, fai, onFatto, onRileggi, onChiudi }: { d: DatiSegreteria; cassa: Cassa; casse: Cassa[]; chiusure: ChiusuraCassa[]; righe: RigaMovimento[]; fai: Fai; onFatto: () => void; onRileggi: () => void; onChiudi: () => void }) {
  const oggi = oggiARoma()
  const ultima = ultimaChiusura(chiusure, cassa.id)
  const dal = dalDellaChiusura(cassa, ultima)
  const [data, setData] = useState(oggi)
  const [contati, setContati] = useState('')
  const [nota, setNota] = useState('')
  const [tutte, setTutte] = useState(false)
  useBozza(contati !== '' || nota !== '', 'La chiusura di cassa')
  // Alla cieca: il previsto e la differenza compaiono solo dopo aver scritto quanto si è contato.
  const previsto = previstoCassa(casse, righe, cassa.id, data)
  const dentro = righeDelPeriodo(righe, { dal, data }, cassa.id)
  const cent = centesimi(contati)
  const visibile = chiusuraVisibile(contati, previsto)
  const differenza = visibile?.differenza ?? null
  const guaio = cosaNonVaImporto(contati, '1.235,00') ?? (cent === null ? null : cosaNonVaChiusura({ cassaId: cassa.id, data, contato: cent, nota }, casse, chiusure, oggi))
  const manca = cent === null || !!guaio
  const chiudi = async () => {
    if (cent === null || differenza === null) return
    // Si chiede sempre conferma: una chiusura si annulla, ma chi la fa per errore non deve doverla cercare.
    const sopra = serveConfermaDifferenza(differenza)
    const domanda = sopra
      ? `Differenza di ${differenzaInParole(differenza)}, sopra i ${soldi(SOGLIA_DIFFERENZA)}. ${nota.trim() ? '' : 'Scrivi nella nota perché. '}Chiudo la cassa fino al ${dataRicevuta(data)}, contati ${soldi(cent)}?`
      : `Chiudo la cassa fino al ${dataRicevuta(data)}: contati ${soldi(cent)}, ${differenza === 0 ? 'i conti tornano' : differenzaInParole(differenza)}?`
    if (!(await chiedi(domanda, 'Sì, chiudi la cassa', { no: 'No, controllo ancora' }))) return
    // Se la risposta si perde ma la chiusura è stata scritta, rileggere l'elenco la mostra: il riprova non sembra un errore a vuoto.
    void fai(() => d.chiudiCassa({ cassaId: cassa.id, data, contato: cent, nota: nota.trim() || undefined }), 'Cassa chiusa', onFatto).then((fatto) => !fatto && onRileggi())
  }
  return (
    <section aria-label="Chiusura di cassa" className="sg-riquadro">
      <span className="sg-etichetta">CHIUSURA DI CASSA</span>
      <span className="sg-riquadro-titolo ob">CASSA CONTANTI</span>
      <div className="sg-due sg-scheda-campi">
        <div className="stack" style={{ gap: 6 }}>
          <Campo id="ch-data" etichetta="FINO AL">
            <input id="ch-data" className="sg-campo" type="date" value={data} min={dal} max={oggi} onChange={(e) => setData(e.target.value)} />
          </Campo>
          <span className="sg-sotto">{ultima ? `Da ${dataRicevuta(dal)}, dopo l’ultima chiusura.` : `Dall’inizio della cassa, il ${dataRicevuta(dal)}.`} Il giorno scelto è compreso.</span>
        </div>
        <div className="stack" style={{ gap: 6 }}>
          <Campo id="ch-contati" etichetta="CONTANTI CONTATI" manca={contati === ''}>
            <input id="ch-contati" className="sg-campo" inputMode="decimal" style={{ fontSize: 28, fontWeight: 700 }} value={contati} onChange={(e) => setContati(e.target.value)} aria-invalid={(contati !== '' && cent === null) || undefined} />
          </Campo>
          <span className="sg-sotto">Un solo totale, con i centesimi. Conta tutto quello che c’è nella cassa.</span>
        </div>
      </div>
      {visibile && (
        <>
          <div className="sg-due sg-scheda-campi">
            <div className="stack" style={{ gap: 4 }}>
              <span className="sg-etichetta">IN CASSA SECONDO I CONTI</span>
              <span className="num" style={{ fontSize: 40, fontWeight: 700 }}>{soldiConSegno(visibile.previsto)}</span>
              {visibile.previsto < 0 && <span className="sg-sotto" style={{ color: 'var(--rosso-testo)' }}>Meno di zero: controlla prima i movimenti.</span>}
            </div>
            <div className="stack" style={{ gap: 4 }}>
              <span className="sg-etichetta">DIFFERENZA</span>
              <span className="num" style={{ fontSize: 28, fontWeight: 700, color: visibile.differenza === 0 ? 'var(--verde-testo)' : 'var(--rosso-testo)' }}>{visibile.differenza === 0 ? 'Tornano' : `${visibile.differenza < 0 ? '− ' : '+ '}${soldi(Math.abs(visibile.differenza))} · ${visibile.differenza < 0 ? 'in meno' : 'in più'}`}</span>
            </div>
          </div>
            <div className="stack" style={{ gap: 0 }}>
              <span className="sg-etichetta">COSA C’È DENTRO · {dentro.length} {dentro.length === 1 ? 'MOVIMENTO' : 'MOVIMENTI'} IN CONTANTI</span>
              {dentro.length === 0 && <span className="sg-sotto" style={{ paddingTop: 6 }}>Nessun movimento in contanti nel periodo{ultima ? ': il previsto è quello della chiusura di prima' : ''}.</span>}
              {(tutte ? dentro : dentro.slice(-RIGHE_VISTE)).map((r) => {
                const c = importoPerCassa(r, cassa.id)
                return (
                  <div key={r.id} className="row" style={{ gap: 14, padding: '8px 0', borderBottom: '1px solid var(--line-soft)', alignItems: 'baseline', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13, color: 'var(--sec)', minWidth: 80, flexShrink: 0 }}>{dataRicevuta(r.data)}</span>
                    <span style={{ fontSize: 15, flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>{descrizioneRiga(r)}</span>
                    <span className="num" style={{ fontSize: 16, fontWeight: 700, color: c > 0 ? 'var(--verde-testo)' : undefined }}>{c < 0 ? '− ' : '+ '}{soldi(Math.abs(c))}</span>
                  </div>
                )
              })}
              {dentro.length > RIGHE_VISTE && (
                <button type="button" className="sg-link" style={{ fontSize: 15, minHeight: 44, display: 'inline-flex', alignItems: 'center', alignSelf: 'flex-start' }} onClick={() => setTutte(!tutte)}>
                  {tutte ? 'Mostra solo gli ultimi' : `${dentro.length - RIGHE_VISTE === 1 ? 'Un altro movimento' : `Altri ${dentro.length - RIGHE_VISTE} movimenti`} · Mostra tutti`}
                </button>
              )}
            </div>
        </>
      )}
      <Campo id="ch-nota" etichetta="NOTA · FACOLTATIVA" largo>
        <textarea id="ch-nota" className="sg-campo" rows={2} maxLength={300} value={nota} onChange={(e) => setNota(e.target.value)} />
      </Campo>
      <span className="sg-sotto">
        Se i conti non tornano, la differenza si scrive da sola nei conti come «Differenza di cassa» del {dataRicevuta(data)}, e a fine giorno «in cassa» è quanto hai contato. Fino a quel giorno non si registrano né si annullano più movimenti: per correggere si scrive un movimento con una data dopo la chiusura e una voce di rettifica (da domani, se chiudi oggi).
      </span>
      {guaio && <span role="alert" style={{ fontSize: 14, color: 'var(--rosso-testo)' }}>{guaio}</span>}
      <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
        <button type="button" className="sg-btn sg-btn-pieno" disabled={manca} onClick={() => void chiudi()}>
          Chiudi la cassa
        </button>
        <button type="button" className="sg-btn sg-btn-linea" onClick={onChiudi}>
          No, torna indietro
        </button>
      </div>
    </section>
  )
}

/** Le chiusure della Cassa Contanti, dalla più recente: chi, quando, la differenza, il foglio PDF e (solo l'ultima) l'annullo. */
function ElencoChiusure({ d, cassa, casse, chiusure, righe, fai, onCambiato }: { d: DatiSegreteria; cassa: Cassa; casse: Cassa[]; chiusure: ChiusuraCassa[]; righe: RigaMovimento[]; fai: Fai; onCambiato: () => void }) {
  const dellaCassa = chiusure.filter((k) => k.cassaId === cassa.id).sort((x, y) => y.data.localeCompare(x.data) || y.chiusaIl.localeCompare(x.chiusaIl))
  const foglio = async (k: ChiusuraCassa, carta?: Uint8Array) => {
    const ente = await d.enteRicevute()
    const { scaricaChiusuraCassa } = await import('../../lib/chiusuraCassaPdf')
    await scaricaChiusuraCassa({ ente, cassa: cassa.nome, chiusura: k, righe, nonPiuInRegola: chiusuraNonPiuInRegola(k, casse, righe), carta }, `chiusura-cassa-${k.data}.pdf`)
  }
  const annulla = async (k: ChiusuraCassa) => {
    const domanda = `Annullare la chiusura del ${dataRicevuta(k.data)}? Si toglie anche la sua «Differenza di cassa» e i giorni tornano aperti. Il foglio PDF già stampato non vale più.`
    if (!(await chiedi(domanda, 'Sì, annulla la chiusura', { no: 'No, lasciala', pericolo: true }))) return
    void fai(() => d.annullaChiusuraCassa(k.id), 'Chiusura annullata', onCambiato).then((fatto) => !fatto && onCambiato())
  }
  return (
    <section aria-label="Le chiusure" className="sg-riquadro">
      <span className="sg-etichetta">LE CHIUSURE</span>
      {dellaCassa.map((k) => (
        <div key={k.id} className="row" style={{ gap: 14, padding: '10px 0', borderBottom: '1px solid var(--line-soft)', alignItems: 'center', flexWrap: 'wrap', color: k.annullataIl ? 'var(--dim)' : undefined }}>
          <span style={{ fontSize: 15, fontWeight: 600, minWidth: 190, whiteSpace: 'nowrap' }}>
            {dataRicevuta(k.dal)} → {dataRicevuta(k.data)}
            {k.annullataIl && <span className="num sg-tag" data-tipo="manca" style={{ marginLeft: 8 }}>Annullata</span>}
          </span>
          <span style={{ fontSize: 14, color: 'var(--sec)', flex: 1, minWidth: 220 }}>
            Contati {soldi(k.contato)} · {differenzaInParole(k.differenza)} · {k.chiusaDa ?? '—'}, {dataRicevuta(giornoRoma(k.chiusaIl))}
            {k.annullataIl && ` · annullata${k.annullataDa ? ` da ${k.annullataDa}` : ''}`}
            {k.nota && <span style={{ display: 'block', paddingTop: 2 }}>Nota: {k.nota}</span>}
          </span>
          <button type="button" className="sg-btn sg-btn-linea" onClick={() => void fai(() => suCarta(fai, (c) => foglio(k, c)), 'Foglio PDF scaricato')}>
            PDF
          </button>
          {cosaNonVaAnnulloChiusura(k.id, chiusure) === null && (
            <Tasto tono="rosso" onClick={() => void annulla(k)}>
              Annulla
            </Tasto>
          )}
        </div>
      ))}
      <span className="sg-sotto">Si annulla solo l’ultima chiusura. Una chiusura non si cambia: si annulla e si rifà.</span>
    </section>
  )
}

function SaldoCassa({ d, cassa, conto, righe, chiusura, fai, onCambiato, onChiudi, nonSiChiude }: { d: DatiSegreteria; cassa: Cassa; righe: RigaMovimento[]; chiusura?: ChiusuraCassa; conto?: { entrate: number; uscite: number; residuo: number }; fai: Fai; onCambiato: () => void; onChiudi?: () => void; nonSiChiude?: string }) {
  const [saldo, setSaldo] = useState(euro(cassa.saldoIniziale))
  const [dal, setDal] = useState(cassa.dal ?? '')
  const cent = centesimi(saldo)
  useBozza(saldoCambiato(saldo, cassa.saldoIniziale) || dal !== (cassa.dal ?? ''), `Il saldo di ${cassa.nome}`)
  const guaio = cosaNonVaSaldoTesto(saldo, dal || null, { oggi: oggiARoma(), primoMovimento: primoMovimentoManuale(righe, cassa.id), chiusa: !!chiusura })
  return (
    <section aria-label={cassa.nome} className="sg-riquadro" style={{ flex: '1 1 340px', maxWidth: 520 }}>
      <span className="sg-etichetta">CASSA</span>
      <span className="sg-riquadro-titolo ob">{cassa.nome.toUpperCase()}</span>
      <div className="row" style={{ gap: 8, columnGap: 24, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <span className="sg-etichetta">{cassa.nome === NOME_CASSA_CONTANTI ? 'IN CASSA SECONDO I CONTI' : 'SUL CONTO'}</span>
        <span className="num" style={{ fontSize: 40, fontWeight: 700, whiteSpace: 'nowrap' }}>{soldiConSegno(conto?.residuo ?? 0)}</span>
      </div>
      <span className="sg-sotto">entrate {soldi(conto?.entrate ?? 0)} · uscite {soldi(conto?.uscite ?? 0)}</span>
      {chiusura && <span className="sg-sotto">Ultima chiusura: {dataRicevuta(chiusura.data)} · {chiusura.chiusaDa ?? '—'}</span>}
      {onChiudi && (
        <div>
          <button type="button" className="sg-btn sg-btn-pieno" disabled={!!nonSiChiude} onClick={onChiudi}>
            Chiudi la cassa
          </button>
          {nonSiChiude && <span className="sg-sotto" style={{ display: 'block', paddingTop: 6 }}>{nonSiChiude}</span>}
        </div>
      )}
      <div className="sg-due sg-scheda-campi">
        <Campo id={`saldo-${cassa.id}`} etichetta="SALDO INIZIALE">
          <input id={`saldo-${cassa.id}`} className="sg-campo" inputMode="decimal" value={saldo} onChange={(e) => setSaldo(e.target.value)} aria-invalid={(!!guaio && !chiusura) || undefined} disabled={!!chiusura} />
        </Campo>
        <Campo id={`dal-${cassa.id}`} etichetta="DAL">
          <input id={`dal-${cassa.id}`} className="sg-campo" type="date" value={dal} disabled={!!chiusura} onChange={(e) => setDal(e.target.value)} />
        </Campo>
      </div>
      <span className="sg-sotto">Da questa data si contano i movimenti e gli incassi: quelli più vecchi non entrano nei conti, e un movimento più vecchio non si registra. Quanto c’è = saldo iniziale + entrate − uscite.</span>
      {guaio && !chiusura && <span role="alert" style={{ fontSize: 14, color: 'var(--rosso-testo)' }}>{guaio}</span>}
      {chiusura && <span className="sg-sotto">La cassa ha una chiusura: per cambiare il saldo iniziale annullala prima.</span>}
      <div>
        <Tasto disabled={!!guaio || cent === null || !!chiusura} onClick={() => cent !== null && void fai(() => d.salvaSaldoCassa(cassa.id, cent, dal || undefined), 'Saldo iniziale salvato', onCambiato)}>
          Salva il saldo iniziale
        </Tasto>
      </div>
    </section>
  )
}
