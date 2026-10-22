import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
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
  filtraMovimenti,
  filtriAttivi,
  giornoChiuso,
  giornoRoma,
  importoPerCassa,
  NOME_CASSA_CONTANTI,
  nonSiVedra,
  oggiARoma,
  PERIODO_INIZIALE,
  pacchetti,
  riepilogoCambioVoce,
  soloTipo,
  riepilogoGiroconto,
  riepilogoMovimento,
  rigaAppenaScritta,
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
  totali,
  totaleResidui,
  type Cassa,
  type ChiusuraCassa,
  type Periodo,
  type RigaMovimento,
  type VoceContabile,
  ultimaChiusura,
  VOCE_DIFFERENZA,
  vociOfferte,
  vociPerLaScelta,
} from '../../lib/contabilita'
import { filtraPerPersona, cosaNonVaCollegato, collegatoAMano, type FiltroPersona } from '../../lib/movimentiPersona'
import { fraseDallaChat } from '../../lib/collega'
import { intervalloDi } from '../../lib/pagamenti'
import { centesimi, dataRicevuta, euro } from '../../lib/ricevute'
import { Campo, chiedi, Guaio, lasciare, messaggio, scaricaCsv, SchedaPiena, suCarta, Testa, useAvviso, useBozza, useCarica } from './comune'
import { Numero } from './Presenze'
import { CollegaAPersona, CollegaSicuri } from './CollegaPersona'
import { Bilancio } from './Bilancio'
import { ScaricoSatispay } from './ScaricoSatispay'
import { commissioneSatispay, NOME_CASSA_SATISPAY, spesaCommissione } from '../../lib/satispayScarico'

type Scheda = 'movimenti' | 'bilancio' | 'voci' | 'casse'
type Fai = ReturnType<typeof useAvviso>['fai']

/**
 * CONTABILITÀ, per chi cura i conti (`59-contabilita.sql`): i movimenti con i
 * residui delle casse, le voci, le casse con il saldo iniziale. Gli incassi
 * degli iscritti sono nell'elenco ma non si scrivono qui: si ricavano da
 * ricevute e pagamenti, e si correggono in PAGAMENTI.
 */
export function Contabilita({ d }: { d: DatiSegreteria }) {
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
      <Testa titolo="CONTABILITÀ" sotto="Le entrate e le uscite della palestra, nelle sue casse. Gli incassi degli iscritti ci sono già: si correggono in PAGAMENTI." />
      <div className="row" style={{ gap: 10 }} role="tablist" aria-label="Contabilità">
        {(
          [
            ['movimenti', 'Movimenti'],
            ['bilancio', 'Bilancio'],
            ['voci', 'Voci'],
            ['casse', 'Casse'],
          ] as const
        ).map(([id, testo]) => (
          <button key={id} type="button" role="tab" aria-selected={scheda === id} className="num sg-chip" onClick={() => setScheda(id)}>
            {testo}
          </button>
        ))}
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
          <div hidden={scheda !== 'movimenti'}><Movimenti d={d} casse={casse.dato ?? []} voci={voci.dato ?? []} chiusure={dateChiusure} righe={elenco} fai={fai} onCambiato={rileggi} /></div>
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

function Movimenti({ d, casse, voci, chiusure, righe, fai, onCambiato }: { d: DatiSegreteria; casse: Cassa[]; voci: VoceContabile[]; chiusure: ChiusuraCassa[]; righe: RigaMovimento[]; fai: Fai; onCambiato: () => void }) {
  const oggi = oggiARoma()
  const [testo, setTesto] = useState('')
  const [periodo, setPeriodo] = useState<Periodo>(PERIODO_INIZIALE)
  const [tipo, setTipo] = useState('')
  const [cassaId, setCassaId] = useState('')
  const [annullati, setAnnullati] = useState(false)
  const [perVoci, setPerVoci] = useState(false)
  const [scrivo, setScrivo] = useState<'movimento' | 'giroconto' | null>(null)
  // Dopo aver scritto un movimento che i filtri nascondono: se no sembra perso.
  const [appena, setAppena] = useState<RigaMovimento | null>(null)
  const [aperto, setAperto] = useState<RigaMovimento | null>(null)
  const [voce, setVoce] = useState('')
  const [viste, setViste] = useState(RIGHE_ELENCO)
  const [scelti, setScelti] = useState<Set<string>>(new Set())
  const [cambio, setCambio] = useState(false)
  // Lo storico collegato alla persona (70-movimenti-persona.sql): cosa si può dire di ogni movimento senza persona, e i nomi dei collegati.
  const [persona, setPersona] = useState<FiltroPersona>('')
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
  const trovate = filtraPerPersona(filtraMovimenti(righe, { testo, dal, al, tipo, cassaId, voce, annullati }), persona, esiti)
  // Cambiando i filtri la scelta si svuota e l'elenco riparte dalle prime righe: quel che si è scelto non si perde di vista.
  const chiave = [testo, periodo, tipo, cassaId, voce, annullati, persona].join('|')
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
  const somme = totali(trovate)
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
    setTesto('')
    setPeriodo(PERIODO_INIZIALE)
    setTipo('')
    setCassaId('')
    setVoce('')
    setPersona('')
    setAnnullati(false)
    setAppena(null)
    window.setTimeout(() => statoElenco.current?.focus(), 0)
  }
  const attivi = filtriAttivi({ testo, periodo, tipo, cassaId, voce, persona, annullati })
  // Con il modulo aperto è lui la pagina: l'elenco e i filtri restano com'erano (lo stato sta qui) e si ritrovano tornando.
  const tornaDalModulo = async () => {
    if (!(await lasciare())) return
    chiudi()
    window.setTimeout(() => statoElenco.current?.focus(), 0)
  }
  const fuori = !!appena && nonSiVedra(appena, { testo, dal, al, tipo, cassaId, voce, persona })
  const apri = (cosa: 'movimento' | 'giroconto') => {
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
        {scrivo === 'movimento' ? (
          <NuovoMovimento d={d} voci={voci} casse={casse} chiusure={chiusure} fai={fai} onFatto={fatto} onChiudi={() => void tornaDalModulo()} />
        ) : (
          <NuovoGiroconto d={d} casse={casse} voci={voci} righe={righe} chiusure={chiusure} fai={fai} onFatto={fatto} onChiudi={() => void tornaDalModulo()} />
        )}
      </div>
      </InVista>
    )
  }

  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="sg-numeri sg-numeri-conti">
        {casse.map((c) => {
          const r = conti.find((x) => x.cassaId === c.id)
          return <Numero key={c.id} titolo={c.nome.toUpperCase()} valore={soldiConSegno(r?.residuo ?? 0)} sotto={`entrate ${soldi(r?.entrate ?? 0)} · uscite ${soldi(r?.uscite ?? 0)}`} />
        })}
        <Numero titolo="TOTALE" valore={soldiConSegno(totaleResidui(conti))} sotto="saldi iniziali compresi" />
      </div>
      <ScaricoSatispay d={d} fai={fai} onCambiato={onCambiato} />

      {cambio && idScelti.length > 0 && sceltaRiep.tipo !== 'misto' && <InVista><CambiaVoce d={d} ids={idScelti} righe={righe} voci={voci} onRileggi={onCambiato} onFatto={cambioFinito} onChiudi={() => setCambio(false)} /></InVista>}
      {collegando === 'sicuri' && <InVista><CollegaSicuri d={d} onRileggi={() => { onCambiato(); void esitiLetti.ricarica() }} onVediDaDecidere={() => { setCollegando(null); setPeriodo('tutto'); setPersona('da_decidere') }} onChiudi={chiudiCollega} /></InVista>}
      {collegando === 'mano' && sceltiRighe.length > 0 && <InVista><CollegaAPersona d={d} righe={sceltiRighe} fai={fai} onFatto={collegamentoFatto} onChiudi={chiudiCollega} /></InVista>}
      {aperto && (
        <SchedaPiena key={aperto.id} etichetta={`Movimento: ${aperto.descrizione}`} torna="I movimenti" onTorna={() => void torna()}>
          <MovimentoAperto d={d} voci={voci} riga={aperto} chiusure={chiusure} cassa={nomeCassa(aperto.cassaId)} cassaA={nomeCassa(aperto.cassaAId)} fai={fai} onChiudi={() => void torna()} onFatto={fatto} />
        </SchedaPiena>
      )}

      <div className="row" style={{ gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        <button type="button" className="sg-btn sg-btn-linea" disabled={!trovate.length} onClick={() => scaricaCsv(`movimenti-${oggi}.csv`, csvMovimenti(trovate, casse))}>
          Esporta CSV
        </button>
        {!esitiLetti.guaio && (
          <button type="button" className="sg-btn sg-btn-linea" onClick={() => { setAperto(null); setScrivo(null); setCambio(false); setCollegando('sicuri') }}>
            Collega i casi sicuri
          </button>
        )}
        <button type="button" className="sg-btn sg-btn-linea" onClick={() => apri('giroconto')}>
          Giroconto
        </button>
        <button type="button" className="sg-btn sg-btn-pieno" onClick={() => apri('movimento')}>
          Nuovo movimento
        </button>
      </div>

      {fuori && (
        <div className="row sg-riquadro" style={{ flexDirection: 'row', alignItems: 'center', gap: 14, flexWrap: 'wrap' }} role="status">
          <span style={{ fontSize: 15, fontWeight: 600 }}>Non lo vedi nell’elenco: è fuori dai filtri.</span>
          <button type="button" className="sg-btn sg-btn-linea" onClick={azzera}>Togli i filtri</button>
        </div>
      )}

      <div className="sg-riquadro" role="group" aria-label="Filtri dei movimenti">
        <div className="row" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <label htmlFor="cerca-movimenti" className="vh">
            Cerca nella descrizione
          </label>
          <input id="cerca-movimenti" className="sg-campo" type="search" placeholder="Cerca nella descrizione" style={{ width: 300, maxWidth: '100%' }} value={testo} onChange={(e) => setTesto(e.target.value)} />
          <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }} role="group" aria-label="Periodo">
            <span className="sg-etichetta">PERIODO</span>
            {(
              [
                ['mese', mese],
                ['scorso', 'Mese scorso'],
                ['anno', 'Tutto l’anno'],
                ['tutto', 'Tutto'],
              ] as const
            ).map(([id, etichetta]) => (
              <button key={id} type="button" className="num sg-chip" aria-pressed={periodo === id} onClick={() => setPeriodo(id)}>
                {etichetta}
              </button>
            ))}
          </div>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }} role="group" aria-label="Tipo">
            <span className="sg-etichetta">TIPO</span>
            {(
              [
                ['entrata', 'Entrate'],
                ['uscita', 'Uscite'],
                ['giroconto', 'Giroconti'],
              ] as const
            ).map(([id, etichetta]) => (
              <button key={id} type="button" className="num sg-chip" aria-pressed={tipo === id} onClick={() => setTipo(tipo === id ? '' : id)}>
                {etichetta}
              </button>
            ))}
          </div>
        </div>
        <div className="row" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'center', paddingTop: 12, borderTop: '1px solid var(--line-soft)' }}>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }} role="group" aria-label="Cassa">
            <span className="sg-etichetta">CASSA</span>
            {casse.map((c) => (
              <button key={c.id} type="button" className="num sg-chip" aria-pressed={cassaId === c.id} onClick={() => setCassaId(cassaId === c.id ? '' : c.id)}>
                {c.nome}
              </button>
            ))}
          </div>
          <div className="row" style={{ gap: 8, alignItems: 'center' }}>
            <label htmlFor="filtro-voce" className="sg-etichetta">VOCE</label>
            <select id="filtro-voce" className="sg-campo" style={{ width: 'auto', maxWidth: '100%' }} value={voce} onChange={(e) => setVoce(e.target.value)}>
              <option value="">Tutte le voci</option>
              {nomiVoci.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
          {esitiLetti.dato && (
            <div className="row" style={{ gap: 8, alignItems: 'center' }}>
              <label htmlFor="filtro-persona" className="sg-etichetta">PERSONA</label>
              {/* I numeri contano tutto lo storico: scegliendo un filtro il periodo diventa Tutto, se no «0 trovati» confonde. */}
              <select id="filtro-persona" className="sg-campo" style={{ width: 'auto', maxWidth: '100%' }} value={persona} onChange={(e) => { const v = e.target.value as FiltroPersona; setPersona(v); if (v) setPeriodo('tutto') }}>
                <option value="">Tutte</option>
                <option value="collegati">{`Collegati · ${collegatiTutti}`}</option>
                <option value="da_decidere">{`Da decidere · ${daDecidere}`}</option>
                <option value="senza_scheda">{`Senza scheda · ${senzaScheda}`}</option>
              </select>
            </div>
          )}
          <button type="button" className="num sg-chip" aria-pressed={annullati} onClick={() => setAnnullati(!annullati)}>
            Mostra annullati
          </button>
        </div>
      </div>
      {esitiLetti.guaio && <span className="sg-sotto" role="status">{esitiLetti.guaio}</span>}

      <div className="row" style={{ gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <span className="sg-sotto" role="status" ref={statoElenco} tabIndex={-1}>
          {trovate.length === 1 ? '1 trovato' : `${trovate.length} trovati`}
          {` · ${attivi === 1 ? '1 filtro attivo' : `${attivi} filtri attivi`}`}
          {idScelti.length > 0 && ` · ${idScelti.length} ${idScelti.length === 1 ? 'scelto' : 'scelti'}`}
        </span>
        {attivi > 0 && (
          <button type="button" className="sg-btn sg-btn-linea" onClick={azzera}>Togli i filtri</button>
        )}
        <span style={{ flex: 1 }} />
        <div className="row" style={{ gap: 8, alignItems: 'center' }} role="group" aria-label="Vista">
          <span className="sg-etichetta">VISTA</span>
          <button type="button" className="num sg-chip" aria-pressed={!perVoci} onClick={() => setPerVoci(false)}>Elenco</button>
          <button type="button" className="num sg-chip" aria-pressed={perVoci} onClick={() => setPerVoci(true)}>Per voce</button>
        </div>
      </div>
      {!perVoci && scegliibili.length > 0 && scegliibili.length > idScelti.length && (
        <div className="row" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <button type="button" className="sg-btn sg-btn-linea" onClick={() => setScelti(new Set(scegliibili.map((r) => r.id)))}>
            {scegliibili.length === trovate.length ? (scegliibili.length === 1 ? 'Scegli la trovata' : `Scegli tutte le ${scegliibili.length} trovate`) : `Scegli le ${scegliibili.length} che si possono cambiare`}
          </button>
        </div>
      )}

      {perVoci ? (
        <div role="table" aria-label="Totali per voce" className="sg-tabella">
          <div className="sg-tabella-corpo">
            {perVoce(trovate).length === 0 && <p className="sg-sotto" style={{ padding: '12px 14px' }}>Nessun movimento nel periodo.</p>}
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
            <span role="columnheader" aria-label="Scelta" />
            <span role="columnheader" className="sg-etichetta">DATA</span>
            <span role="columnheader" className="sg-etichetta">DESCRIZIONE</span>
            <span role="columnheader" className="sg-etichetta">PERSONA</span>
            <span role="columnheader" className="sg-etichetta">VOCE</span>
            <span role="columnheader" className="sg-etichetta">CASSA</span>
            <span role="columnheader" className="sg-etichetta" style={{ textAlign: 'right' }}>IMPORTO</span>
          </div>
          <div className="sg-tabella-corpo">
            {trovate.length === 0 && (
              <p className="sg-sotto" style={{ padding: '12px 14px' }}>
                {righe.length === 0 ? 'Nessun movimento: compaiono qui gli incassi degli iscritti e quelli che scrivi tu.' : 'Nessun movimento corrisponde ai filtri.'}
              </p>
            )}
            {trovate.slice(0, viste).map((r) => (
              <div key={r.id} role="row" className="sg-riga-movimento sg-iscritto" data-spento={r.annullato} data-scelto={aperto?.id === r.id} data-scelta={scelti.has(r.id)} data-senza-casella={!cambiabile(r)} onClick={() => { setScrivo(null); setAperto(r) }}>
                <span role="cell" className="sg-scelta-riga" onClick={(e) => e.stopPropagation()}>
                  {cambiabile(r) && <input type="checkbox" checked={scelti.has(r.id)} onChange={() => alterna(r.id)} aria-label={`Scegli ${r.descrizione} del ${dataRicevuta(r.data)}`} />}
                </span>
                <span role="cell" style={{ fontSize: 13, color: 'var(--sec)' }}>{dataRicevuta(r.data)}</span>
                <span role="cell" style={{ fontSize: 15, fontWeight: 600, textDecoration: r.annullato ? 'line-through' : undefined }}>
                  <button type="button" className="sg-riga-apri">{r.descrizione}</button>
                  {r.origine !== 'movimento' && <span className="num sg-tag" style={{ marginLeft: 8 }}>Incasso iscritto</span>}
                  {r.tipo === 'giroconto' && <span className="num sg-tag" style={{ marginLeft: 8 }}>Giroconto</span>}
                  {r.satispayId && <span className="num sg-tag" style={{ marginLeft: 8 }}>Da Satispay</span>}
                  {r.annullato && <span className="num sg-tag" data-tipo="manca" style={{ marginLeft: 8 }}>Annullato</span>}
                  {/* Sul tablet e sul telefono la colonna PERSONA non c'è: lo stato resta accanto alla descrizione. */}
                  {!r.personaId && esiti[r.id] === 'omonimi' && <span className="num sg-tag sg-solo-telefono" data-tipo="aspetta" style={{ marginLeft: 8 }}>Omonimi</span>}
                  {!r.personaId && esiti[r.id] === 'nessuna' && <span className="num sg-tag sg-solo-telefono" style={{ marginLeft: 8 }}>Senza scheda</span>}
                  <span className="sg-sotto-movimento">
                    <span className="sg-solo-telefono">{[dataRicevuta(r.data), r.voce, r.tipo === 'giroconto' ? `${nomeCassa(r.cassaId)} → ${nomeCassa(r.cassaAId)}` : nomeCassa(r.cassaId), collegatoAMano(r) ? nomiPersone.get(r.personaId ?? '') : ''].filter(Boolean).join(' · ')}</span>
                    {r.sotto && <span>{r.sotto}</span>}
                  </span>
                </span>
                <span role="cell" className="sg-persona-riga">
                  {r.personaId ? (
                    <>
                      <span style={{ fontWeight: 600 }}>{nomiPersone.get(r.personaId) ?? (collegatoAMano(r) ? 'Persona collegata' : '')}</span>
                      {/* Un incasso iscritto è della persona da sé: «Collegato» farebbe cercare uno Scollega che qui non c'è. */}
                      {collegatoAMano(r) && <span className="num sg-tag" data-tipo="fatto">Collegato</span>}
                    </>
                  ) : esiti[r.id] === 'omonimi' ? (
                    <span className="num sg-tag" data-tipo="aspetta">Omonimi</span>
                  ) : esiti[r.id] === 'nessuna' ? (
                    <span className="num sg-tag">Senza scheda</span>
                  ) : esiti[r.id] === 'sicuro' ? (
                    <span className="num sg-tag">Da collegare</span>
                  ) : null}
                </span>
                <span role="cell" style={{ fontSize: 13, color: 'var(--sec)' }}>{r.voce ?? '—'}</span>
                <span role="cell" style={{ fontSize: 13, color: 'var(--sec)' }}>{r.tipo === 'giroconto' ? `${nomeCassa(r.cassaId)} → ${nomeCassa(r.cassaAId)}` : nomeCassa(r.cassaId)}</span>
                <span role="cell" className="num" style={{ fontSize: 16, fontWeight: 700, textAlign: 'right', textDecoration: r.annullato ? 'line-through' : undefined, color: r.tipo === 'entrata' && !r.annullato ? 'var(--verde-testo)' : undefined }}>
                  {r.tipo === 'entrata' ? '+ ' : r.tipo === 'uscita' ? '− ' : ''}{soldi(r.importo)}
                </span>
              </div>
            ))}
          </div>
          {trovate.length > viste && (
            <div className="row" style={{ gap: 10, padding: 14, alignItems: 'center', flexWrap: 'wrap' }}>
              <button type="button" className="sg-btn sg-btn-linea" onClick={() => setViste(viste + RIGHE_ELENCO)}>
                Mostra altre {Math.min(RIGHE_ELENCO, trovate.length - viste)} righe
              </button>
              <span className="sg-sotto">ne vedi {viste} su {trovate.length}</span>
            </div>
          )}
        </div>
      )}

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

      <div className="row" style={{ padding: '6px 14px 0', gap: 24, alignItems: 'baseline', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <span className="row" style={{ gap: 10, alignItems: 'baseline', whiteSpace: 'nowrap' }}>
          <span className="sg-etichetta">ENTRATE</span>
          <span className="num" style={{ fontSize: 24, fontWeight: 700, color: somme.entrate > 0 ? 'var(--verde-testo)' : undefined }}>+ {soldi(somme.entrate)}</span>
        </span>
        <span className="row" style={{ gap: 10, alignItems: 'baseline', whiteSpace: 'nowrap' }}>
          <span className="sg-etichetta">USCITE</span>
          <span className="num" style={{ fontSize: 24, fontWeight: 700 }}>− {soldi(somme.uscite)}</span>
        </span>
        <span className="row" style={{ gap: 10, alignItems: 'baseline', whiteSpace: 'nowrap' }}>
          <span className="sg-etichetta">DIFFERENZA</span>
          <span className="num" style={{ fontSize: 28, fontWeight: 700 }}>{soldiConSegno(somme.differenza)}</span>
        </span>
      </div>
      <span className="sg-sotto">
        I giroconti e gli annullati non contano in entrate e uscite. Un incasso degli iscritti si apre in PAGAMENTI, dove nasce; qui non si cambia. Contanti vanno in Cassa Contanti, i pagamenti Satispay del negozio nella cassa Satispay, tutto il resto in Conto Corrente.
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
  const guaio = useMemo(() => (voceId ? pacchetti(ids).map((p) => cosaNonVaCambioVoce(p, righe, voci, voceId)).find(Boolean) ?? null : null), [ids, righe, voci, voceId])
  const nomeVoce = voci.find((v) => v.id === voceId)?.nome
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

function NuovoMovimento({ d, voci, casse, chiusure, fai, onFatto, onChiudi }: { d: DatiSegreteria; voci: VoceContabile[]; casse: Cassa[]; chiusure: ChiusuraCassa[]; fai: Fai; onFatto: (nuova: RigaMovimento) => void; onChiudi: () => void }) {
  const oggi = oggiARoma()
  const [tipo, setTipo] = useState<'entrata' | 'uscita'>('uscita')
  const [data, setData] = useState(oggi)
  const [importo, setImporto] = useState('')
  const [cassaId, setCassaId] = useState(casse[0]?.id ?? '')
  const [voceId, setVoceId] = useState('')
  const [descrizione, setDescrizione] = useState('')
  const [nota, setNota] = useState('')
  useBozza(importo !== '' || descrizione !== '' || nota !== '', 'Il movimento')
  const dellaScelta = vociOfferte(voci, tipo)
  const cent = centesimi(importo)
  const guaio = cosaNonVaImporto(importo, '40,00') ?? (cent === null ? null : cosaNonVaMovimento({ tipo, data, importo: cent, voceId, cassaId, descrizione, nota }, voci, casse, oggi, chiusure))
  const manca = cent === null || !!guaio || !voceId || !descrizione.trim()
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
        <Campo id="mv-descrizione" etichetta="DESCRIZIONE" largo manca={!descrizione.trim()}>
          <input id="mv-descrizione" className="sg-campo" maxLength={200} value={descrizione} onChange={(e) => setDescrizione(e.target.value)} />
        </Campo>
        <Campo id="mv-nota" etichetta="NOTA · FACOLTATIVA" largo>
          <textarea id="mv-nota" className="sg-campo" rows={2} maxLength={300} value={nota} onChange={(e) => setNota(e.target.value)} />
        </Campo>
      </div>
      {giornoChiuso(chiusure, [cassaId], data) && <span role="status" style={{ fontSize: 14, color: 'var(--rosso-testo)' }}>Quel giorno la cassa è già chiusa: scegli una data dopo la chiusura.</span>}
      <span className="sg-sotto">Un solo importo, senza IVA. Registrato, non si cambia: si annulla e si rifà (la descrizione e la nota sì). Niente dati personali che non servono.</span>
      {guaio && <span role="alert" style={{ fontSize: 14, color: 'var(--rosso-testo)' }}>{guaio}</span>}
      <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
        <button
          type="button"
          className="sg-btn sg-btn-pieno"
          disabled={manca}
          onClick={async () => {
            if (cent === null) return
            const dati = { tipo, data, importo: cent, voceId, cassaId, descrizione: descrizione.trim(), nota: nota.trim() || undefined }
            const riepilogo = riepilogoMovimento(dati, voci.find((v) => v.id === voceId)?.nome ?? '', casse.find((c) => c.id === cassaId)?.nome ?? '')
            if (!(await chiedi(`Registrare questo movimento?\n${riepilogo.join('\n')}`, 'Sì, registra il movimento', { no: 'No, torna al modulo' }))) return
            void fai(() => d.registraMovimento(dati), 'Movimento registrato', () => onFatto(rigaAppenaScritta({ tipo, data, importo: cent, descrizione: dati.descrizione, voce: voci.find((v) => v.id === voceId)?.nome ?? null, cassaId })))
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
function MovimentoAperto({ d, voci, riga, chiusure, cassa, cassaA, fai, onChiudi, onFatto }: { d: DatiSegreteria; voci: VoceContabile[]; riga: RigaMovimento; chiusure: ChiusuraCassa[]; cassa: string; cassaA: string; fai: Fai; onChiudi: () => void; onFatto: () => void }) {
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
  const voceGuaio = voceId && voceId !== voceAttuale?.id ? cosaNonVaCambioVoce([riga.id], [riga], voci, voceId) : null
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
      {!manuale && <span className="sg-sotto">Si cambia in PAGAMENTI, dove nasce: se la ricevuta o il pagamento cambia o si annulla, cambia da sé anche qui.</span>}
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
          {chiuso && <span className="sg-sotto">{chiuso}</span>}
          {voceGuaio && <span role="alert" style={{ fontSize: 14, color: 'var(--rosso-testo)' }}>{voceGuaio}</span>}
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
              <button type="button" className="sg-btn sg-btn-pieno" disabled={!voceId || voceId === voceAttuale?.id || !!voceGuaio} onClick={() => void fai(() => d.cambiaVoceMovimenti([riga.id], voceId), `Voce cambiata in «${offerte.find((v) => v.id === voceId)?.nome ?? ''}»`, onFatto)}>
                Cambia la voce
              </button>
            )}
            <button type="button" className="sg-btn sg-btn-linea" disabled={!descrizione.trim()} onClick={() => void fai(() => d.correggiTestoMovimento(riga.id, descrizione, nota.trim() || undefined), 'Testo corretto', onFatto)}>
              Salva il testo
            </button>
            {!chiuso && (
              <button type="button" className="sg-btn sg-btn-rosso" disabled={chiedendo} onClick={() => void annulla()}>
                Annulla il movimento
              </button>
            )}
          </>
        )}
        <button type="button" className="sg-btn sg-btn-linea" onClick={onChiudi}>
          Chiudi
        </button>
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
            <button type="button" className="sg-btn sg-btn-rosso" onClick={() => void annulla(k)}>
              Annulla
            </button>
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
        <button type="button" className="sg-btn sg-btn-linea" disabled={!!guaio || cent === null || !!chiusura} onClick={() => cent !== null && void fai(() => d.salvaSaldoCassa(cassa.id, cent, dal || undefined), 'Saldo iniziale salvato', onCambiato)}>
          Salva il saldo iniziale
        </button>
      </div>
    </section>
  )
}
