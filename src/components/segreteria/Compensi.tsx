import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { cartaSePuoi } from '../../lib/cartaPdf'
import type { DatiSegreteria, Tariffa } from '../../lib/segreteria'
import type { Voce } from '../../lib/indirizzoSegreteria'
import { NOME_CASSA_CONTO, oggiARoma, type Cassa, type ChiusuraCassa } from '../../lib/contabilita'
import { insegna } from '../../lib/ruoli'
import { chiaveGiorno, dataLunga, oraDi } from '../../lib/sala'
import { euro } from '../../lib/ricevute'
import { mesi, oreItaliane as ore } from '../../lib/ore'
import { euroOra, euroDaScrivere } from '../../lib/tariffe'
import { centesimiDaImporto, compensoDelMese, cosaNonVaCompenso, cosaNonVaExtra, cosaNonVaImportoScritto, datiPerRicevuta, cosaNonVaPagamento, descrizionePagamento, daPagareCompensi, extraDelPagamento, avvisoDelMese, aChePunto, azioneCarta, azioneRiga, gruppiCompensi, senzaImporto, STATI_FERMI, type AzioneCompenso, pagabili, VOCE_COMPENSI, mancaPerRicevuta, primoDelMese, righeCompensi, type ContoCompenso, type GruppoCompensi, type RicevutaCompenso, type SenzaFirma, type StatoCompenso } from '../../lib/compensi'
import { chiedi, Guaio, GuaioConAzione, stampaSenzaCarta, suCarta, Testa, useAvviso, useCarica, useDialogo } from './comune'
import { Chip } from '../ds'

type Fai = ReturnType<typeof useAvviso>['fai']
const GIORNI_CORTI = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab']
type Persona = { id: string; nome: string; cognome: string }

const NOME_STATO: Record<StatoCompenso, { testo: string; tono: 'rosso' | 'giallo' | 'neutro' | 'verde' }> = {
  'da-confermare': { testo: 'PRESENZE DA CONFERMARE', tono: 'rosso' },
  'senza-tariffa': { testo: 'SENZA TARIFFA', tono: 'rosso' },
  'senza-dati': { testo: 'MANCANO I DATI', tono: 'rosso' },
  'da-fare': { testo: 'RICEVUTA DA FARE', tono: 'neutro' },
  fatta: { testo: 'FATTA · DA PAGARE', tono: 'giallo' },
  pagata: { testo: 'PAGATA', tono: 'verde' },
  'non-torna': { testo: 'NON TORNA PIÙ', tono: 'rosso' },
  'solo-attese': { testo: 'NIENTE DA PAGARE, PER ORA', tono: 'neutro' },
  'solo-extra': { testo: 'NESSUNA LEZIONE NEL MESE', tono: 'neutro' },
}

/** Il tono del segno di uno stato: rosso quando si è fermi, e allora anche il riquadro. */
export const tonoCompenso = (stato: StatoCompenso) => NOME_STATO[stato].tono

const nomeDi = (p: Persona) => `${p.cognome} ${p.nome}`.trim()
const saltato = (r: { persona: Persona; stato: StatoCompenso }) => `${nomeDi(r.persona)} (${NOME_STATO[r.stato].testo.toLowerCase()})`
const maiuscola = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const quante = (n: number, uno: string, tanti: string) => `${n} ${n === 1 ? uno : tanti}`
const quanteOre = (minuti: number) => `${ore(minuti)} ${minuti === 60 ? 'ora' : 'ore'}`
const scarica = async (rs: RicevutaCompenso[], carta?: Uint8Array) => (await import('../../lib/ricevutaCompensoPdf')).scaricaRicevuteCompensi(rs, carta)

/**
 * Fa la ricevuta del mese di un tecnico: legge i suoi dati e le sue lettere,
 * li copia dentro e la salva. Senza codice fiscale, residenza o IBAN non si fa.
 */
async function faiRicevuta(d: DatiSegreteria, p: Persona, conto: ContoCompenso, mese: string, cambiato?: { importo: number; motivo: string }) {
  const [an, lettere] = await Promise.all([d.anagraficaDi(p.id), d.lettere(p.id)])
  const manca = mancaPerRicevuta(an?.dati ?? null)
  if (manca) throw new Error(`${nomeDi(p)}: ${manca.charAt(0).toLowerCase()}${manca.slice(1)}`)
  return d.faiRicevutaCompenso(datiPerRicevuta(p, an?.dati ?? null, conto, mese, lettere, chiaveGiorno(new Date()), cambiato))
}

/**
 * I tasti della ricevuta di un mese, gli stessi nella pagina COMPENSI e nella
 * scheda del tecnico: prepararla (anche col compenso cambiato a mano e il
 * perché), ristamparla, spuntarla firmata, annullarla.
 */
export function AzioniRicevuta({
  d,
  p,
  conto,
  ricevuta,
  stato,
  mese,
  fai,
  onCambiato,
  inScheda,
  onPaga,
  onVai,
}: {
  d: DatiSegreteria
  p: Persona
  conto: ContoCompenso
  ricevuta?: RicevutaCompenso
  stato: StatoCompenso
  mese: string
  fai: Fai
  onCambiato: () => Promise<unknown>
  /** Nella scheda del tecnico: tariffe e dati sono già lì sopra, non serve il collegamento. */
  inScheda?: boolean
  /** Per chi cura anche la contabilità: apre il pannello SEGNA PAGATO di questo tecnico. */
  onPaga?: () => void
  /** Porta a un'altra voce della segreteria: un link col cancelletto, dalle pagine d'area, porterebbe fuori. */
  onVai: (v: Voce) => void
}) {
  const [cambia, setCambia] = useState<{ testo: string; motivo: string } | null>(null)
  // Mentre prepara o annulla i tasti sono spenti: un doppio clic non fa due cose.
  const [occupato, setOccupato] = useState(false)
  const prepara = async (cambiato?: { importo: number; motivo: string }) => {
    setOccupato(true)
    try {
      await preparaOra(cambiato)
    } finally {
      setOccupato(false)
    }
  }
  const preparaOra = async (cambiato?: { importo: number; motivo: string }) => {
    const fatta: { r?: RicevutaCompenso } = {}
    const ok = await fai(async () => (fatta.r = await faiRicevuta(d, p, conto, mese, cambiato)), 'Ricevuta fatta', async () => {
      setCambia(null)
      await onCambiato()
    })
    // Prima si salva, poi si scarica: se il PDF non esce, la ricevuta c'è già e si ristampa.
    const r = fatta.r
    if (ok && r) void fai(() => suCarta(fai, (c) => scarica([r], c)), 'PDF scaricato')
  }
  const annulla = async () => {
    if (!ricevuta) return
    // Il secondo clic di un doppio clic su «Prepara» finisce qui, appena la ricevuta c'è: non vale.
    if (Date.now() - Date.parse(ricevuta.creataIl) < 1500) return
    const rifai = stato === 'non-torna'
    const domanda = rifai
      ? `Annullare la ricevuta di ${nomeDi(p)} e farne una nuova coi conti di adesso? Quella di prima resta nel registro, annullata.`
      : `Annullare la ricevuta di ${nomeDi(p)}? Resta nel registro, annullata; poi se ne fa una nuova.`
    if (!(await chiedi(domanda, rifai ? 'Annulla e rifai' : 'Annulla la ricevuta', { pericolo: true }))) return
    setOccupato(true)
    try {
      const ok = await fai(() => d.annullaRicevutaCompenso(ricevuta.id), 'Ricevuta annullata', rifai ? undefined : onCambiato)
      // «Annulla e rifai»: annullata quella vecchia, si fa subito la nuova.
      if (ok && rifai) await preparaOra()
    } finally {
      setOccupato(false)
    }
  }

  if (cambia) {
    const importo = centesimiDaImporto(cambia.testo) ?? 0
    const no = cosaNonVaImportoScritto(cambia.testo) ?? cosaNonVaCompenso({ importo, calcolato: conto.calcolato, motivo: cambia.motivo })
    return (
      <div className="stack" style={{ gap: 10, padding: '14px 16px', border: '2px solid var(--text)', flexBasis: '100%' }}>
        <span className="sg-etichetta">MODIFICA IL COMPENSO</span>
        <div className="sg-due sg-scheda-campi">
          <label className="stack" style={{ gap: 6 }}>
            <span className="sg-etichetta">COMPENSO (€)</span>
            <input className="sg-campo num" inputMode="decimal" value={cambia.testo} onChange={(e) => setCambia({ ...cambia, testo: e.target.value })} />
            <span style={{ fontSize: 13, color: 'var(--giallo-testo)' }}>Calcolato dalle lezioni: {euro(conto.calcolato)} €.</span>
          </label>
          <label className="stack" style={{ gap: 6 }}>
            <span className="sg-etichetta">PERCHÉ</span>
            <input className="sg-campo" maxLength={200} value={cambia.motivo} onChange={(e) => setCambia({ ...cambia, motivo: e.target.value })} />
            <span style={{ fontSize: 13, color: 'var(--giallo-testo)' }}>Obbligatorio se il compenso cambia: resta scritto sulla ricevuta in segreteria.</span>
          </label>
        </div>
        {no && (
          <span role="alert" style={{ fontSize: 13, color: 'var(--rosso-testo)' }}>
            {no}.
          </span>
        )}
        <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
          <button type="button" className="sg-btn sg-btn-linea" onClick={() => setCambia(null)}>
            Lascia stare
          </button>
          <button type="button" className="sg-btn sg-btn-pieno" disabled={!!no || occupato} onClick={() => void prepara({ importo, motivo: cambia.motivo })}>
            Prepara la ricevuta
          </button>
        </div>
      </div>
    )
  }

  if (ricevuta)
    return (
      // I tasti vanno a capo dentro la loro colonna, a destra: la riga non si sfascia.
      <span className="row" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'center', flex: '0 1 280px', justifyContent: 'flex-end' }}>
        <label className="row" style={{ gap: 8, minHeight: 44, fontSize: 14, fontWeight: 600 }}>
          <input
            type="checkbox"
            style={{ width: 24, height: 24, margin: 0, accentColor: 'var(--text)' }}
            checked={ricevuta.firmata}
            onChange={(e) => void fai(() => d.segnaFirmataCompenso(ricevuta.id, e.target.checked), e.target.checked ? 'Segnata firmata' : 'Tolta la spunta', onCambiato)}
          />
          Firmata
        </label>
        <button type="button" className="sg-btn sg-btn-linea" onClick={() => void fai(() => suCarta(fai, (c) => scarica([ricevuta], c)), 'PDF scaricato')}>
          Ristampa
        </button>
        {/* Solo una ricevuta che torna col mese si paga; una che non torna si annulla e si rifà prima. */}
        {stato === 'fatta' && onPaga && (
          <button type="button" className="sg-btn sg-btn-linea" disabled={occupato} onClick={onPaga}>
            Segna pagato
          </button>
        )}
        {/* Annulla su una riga sua: sul telefono un dito sbagliato accanto a Ristampa annullerebbe. Una pagata non si annulla da qui. */}
        {!ricevuta.pagataIl && (
          <span style={{ flexBasis: '100%', display: 'flex' }}>
            <button type="button" className="sg-btn sg-btn-linea sg-pericolo" disabled={occupato} onClick={() => void annulla()}>
              {stato === 'non-torna' ? 'Annulla e rifai' : 'Annulla'}
            </button>
          </span>
        )}
      </span>
    )

  if (stato === 'da-fare')
    return (
      <span className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
        <button type="button" className="sg-btn sg-btn-linea" disabled={occupato} onClick={() => setCambia({ testo: euroDaScrivere(conto.calcolato), motivo: '' })}>
          Modifica il compenso
        </button>
        <button type="button" className="sg-btn sg-btn-pieno" disabled={occupato} onClick={() => void prepara()}>
          Prepara la ricevuta
        </button>
      </span>
    )
  // Chi è fermo ha dove andare a sistemare.
  if (stato === 'da-confermare')
    return (
      <button type="button" className="sg-link sg-link-alto" style={{ fontSize: 14 }} onClick={() => onVai('istruttori')}>
        Conferma in Presenze istruttori ›
      </button>
    )
  if ((stato === 'senza-tariffa' || stato === 'senza-dati') && !inScheda)
    return (
      <button type="button" className="sg-link sg-link-alto" style={{ fontSize: 14 }} onClick={() => onVai('personale')}>
        {stato === 'senza-tariffa' ? 'Scrivi la tariffa' : 'Scrivi i dati'} in Istruttori e accessi ›
      </button>
    )
  return null
}

/** Il segno dello stato, in parole e col colore, e sotto cosa fare. */
export function SegnoCompenso({ stato, conto, ricevuta, manca, inScheda, senzaFirma = 0 }: { stato: StatoCompenso; conto: ContoCompenso; ricevuta?: RicevutaCompenso; manca?: string | null; inScheda?: boolean; senzaFirma?: number }) {
  const s = NOME_STATO[stato]
  const frase =
    stato === 'da-confermare'
      ? `${conto.daConfermare} da confermare in PRESENZE ISTRUTTORI: prima si decidono, poi si fa la ricevuta.`
      : stato === 'senza-tariffa'
        ? `${conto.senzaTariffa.join(', ')} senza tariffa: si scrive ${inScheda ? 'qui sopra, in TARIFFE' : 'nella scheda, in ISTRUTTORI E ACCESSI'}.`
        : stato === 'senza-dati'
          ? `${maiuscola((manca ?? '').replace(/^Mancano i dati per la ricevuta: /, '') || 'I dati')}: si scrivono ${inScheda ? 'qui sopra, in DATI PER LETTERA E RICEVUTE' : 'nella scheda, in ISTRUTTORI E ACCESSI'}.`
          : stato === 'solo-attese'
          ? 'Nel mese non ha lezioni firmate. Se c’era, si segna qui sotto e la ricevuta si fa.'
          : stato === 'solo-extra'
          ? 'Ha solo compensi extra, qui sotto.'
          : stato === 'non-torna' && ricevuta
          ? `Ricevuta di ${euro(ricevuta.importo)} €: dopo è cambiata una presenza e il mese ora fa ${euro(conto.calcolato)} €.${ricevuta.firmata ? ' Era firmata.' : ''}`
          : stato === 'pagata' && ricevuta?.pagataIl
            ? `Pagata il ${dataLunga(ricevuta.pagataIl)}${ricevuta.motivo ? ` · cambiata a mano: ${ricevuta.motivo}` : ''}. Per annullarla, prima si annulla il pagamento in CONTABILITÀ.${conto.calcolato !== ricevuta.calcolato ? ` Dopo il pagamento è cambiata una presenza: il mese ora fa ${euro(conto.calcolato)} €.` : ''}`
            : ricevuta
            ? `Fatta il ${dataLunga(ricevuta.data)}${ricevuta.motivo ? ` · cambiata a mano: ${ricevuta.motivo}` : ''}`
            : ''
  return (
    <span className="stack" style={{ gap: 4, minWidth: 0, alignItems: 'flex-start' }}>
      <span className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
        <span className="sg-segno-regola" data-tono={s.tono}>
          {s.testo}
        </span>
        {ricevuta && !ricevuta.firmata && (
          <span className="sg-segno-regola" data-tono="giallo">
            DA RIPORTARE FIRMATA
          </span>
        )}
        {senzaFirma > 0 && (
          <span className="sg-segno-regola" data-tono="giallo">
            MANCA LA FIRMA · {quante(senzaFirma, 'LEZIONE', 'LEZIONI')}
          </span>
        )}
      </span>
      {frase && <span style={{ fontSize: 13, color: 'var(--sec)' }}>{frase}</span>}
    </span>
  )
}

type Riga = ReturnType<typeof righeCompensi>[number]
type Tono = 'rosso' | 'giallo' | 'neutro' | 'verde'

// Le icone a linea della tabella e dei gruppi, disegnate come quelle del menu (24×24, tratto 1.75); corsi e ricevuta sono quelle di ICONE_MENU.
const ICONE = {
  persona: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 3a4 4 0 1 0 0 8a4 4 0 1 0 0-8',
  corsi: 'M6 8a6 6 0 1 0 12 0a6 6 0 1 0 -12 0 M15.5 12.9 17 22l-5-3-5 3 1.5-9.1',
  calendario: 'M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z M16 2v4 M8 2v4 M3 10h18',
  orologio: 'M2 12a10 10 0 1 0 20 0a10 10 0 1 0 -20 0 M12,6 L12,12 L16,14',
  tariffa: 'M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8z M7 7h.01',
  euro: 'M18 7c-1.2-1.3-3-2-5-2a7 7 0 0 0 0 14c2 0 3.8-.7 5-2 M4 10h9M4 14h9',
  carta: 'M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z M2 10h20',
  ricevuta: 'M5 2v20l2.5-1.5L10 22l2-1.5 2 1.5 2.5-1.5L19 22V2l-2.5 1.5L14 2l-2 1.5L10 2 7.5 3.5z M9 8h6M9 12h6',
  nota: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M16 13H8 M16 17H8',
  sistemare: 'M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h16.9a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z M12 9v4 M12 17h.01',
  stampa: 'M6 9V2h12v7 M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2 M6 14h12v8H6z',
  firma: 'M12 20h9 M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z',
  pagate: 'M20 6 9 17l-5-5',
}
type NomeIcona = keyof typeof ICONE

const Icona = ({ nome, misura = 14 }: { nome: NomeIcona; misura?: number }) => (
  <svg width={misura} height={misura} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }} aria-hidden>
    <path d={ICONE[nome]} />
  </svg>
)

const TESTE: Record<GruppoCompensi, { titolo: string; icona: NomeIcona; tono: Tono }> = {
  'da-sistemare': { titolo: 'DA SISTEMARE PRIMA', icona: 'sistemare', tono: 'rosso' },
  'da-fare': { titolo: 'DA FARE', icona: 'stampa', tono: 'neutro' },
  'da-far-firmare': { titolo: 'DA FAR FIRMARE', icona: 'firma', tono: 'giallo' },
  'da-pagare': { titolo: 'DA PAGARE', icona: 'euro', tono: 'giallo' },
  pagate: { titolo: 'PAGATE', icona: 'pagate', tono: 'verde' },
}

/** Le colonne della tabella; quelle in cifre a destra. */
const COLONNE: Array<[string, NomeIcona, boolean]> = [
  ['TECNICO', 'persona', false],
  ['CORSI', 'corsi', false],
  ['LEZIONI', 'calendario', true],
  ['ORE', 'orologio', true],
  ['TARIFFA', 'tariffa', true],
  ['IMPORTO', 'euro', true],
  ['IBAN', 'carta', false],
  ['RICEVUTA', 'ricevuta', false],
  ['NOTE', 'nota', false],
]

function TestataCompensi() {
  return (
    <div className="sg-compensi-griglia sg-compensi-testa" aria-hidden>
      {COLONNE.map(([testo, icona, destra]) => (
        <span key={testo} className="sg-etichetta" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, justifySelf: destra ? 'end' : 'start' }}>
          <Icona nome={icona} />
          {testo}
        </span>
      ))}
      <span />
    </div>
  )
}

/** La testa di un gruppo: il titolo col conto, cosa vuol dire, e il tasto se il gruppo ne ha uno. */
function TestaGruppo({ titolo, conto, icona, tono, sotto, children }: { titolo: string; conto: string; icona: NomeIcona; tono: Tono; sotto: string; children?: ReactNode }) {
  return (
    <div className="sg-compensi-gruppo" data-tono={tono}>
      <div className="stack" style={{ gap: 2, minWidth: 0 }}>
        <h2 className="ob sg-compensi-gruppo-titolo">
          <Icona nome={icona} misura={22} />
          <span>
            {titolo} <span className="sg-compensi-conto">· {conto}</span>
          </span>
        </h2>
        <span className="sg-sotto">{sotto}</span>
      </div>
      {children}
    </div>
  )
}

/** L'ultima colonna: l'azione della riga, un tasto di 170px sempre allo stesso posto, e accanto quella in testo. */
const Azioni = ({ testo, tasto }: { testo?: ReactNode; tasto?: ReactNode }) => (
  <span className="sg-compensi-azioni">
    <span>{testo}</span>
    {tasto}
  </span>
)
const Vuota = ({ destra }: { destra?: boolean }) => <span className={`sg-compensi-largo sg-compensi-vuoto${destra ? ' sg-compensi-cifra' : ''}`}>—</span>

/** La riga del mese di un tecnico: le cifre, a che punto è la ricevuta, perché è fermo, e l'azione che serve adesso. */
function RigaCorta({ r, azioni, onApri }: { r: Riga; azioni: ReactNode; onApri: () => void }) {
  const tariffe = [...new Set(r.conto.righe.flatMap((x) => (x.centesimiOra ? [x.centesimiOra] : [])))]
  const altro = (r.manca ?? '').replace(/^Mancano i dati per la ricevuta: /, '')
  return (
    <div className="sg-compensi-griglia sg-compensi-riga">
      <span className="sg-compensi-nome">
        <button type="button" className="sg-compensi-apri" onClick={onApri}>
          {nomeDi(r.persona)}
        </button>
      </span>
      <span className="sg-compensi-largo">{r.conto.righe.map((x) => x.corso).join(', ') || '—'}</span>
      <span className="sg-compensi-largo sg-compensi-cifra num">{r.conto.lezioni || '—'}</span>
      <span className="sg-compensi-largo sg-compensi-cifra num">{r.conto.minuti ? `${ore(r.conto.minuti)} h` : '—'}</span>
      <span className="sg-compensi-largo sg-compensi-cifra">
        {r.stato === 'senza-tariffa' ? (
          <span className="stack" style={{ gap: 2, alignItems: 'flex-end' }}>
            <span style={{ color: 'var(--rosso-testo)', fontWeight: 700 }}>✕ manca</span>
            <span style={{ fontSize: 13, color: 'var(--dim)' }}>{r.conto.senzaTariffa.join(', ')}</span>
          </span>
        ) : tariffe.length === 1 ? (
          euroOra(tariffe[0])
        ) : tariffe.length ? (
          'varie'
        ) : (
          '—'
        )}
      </span>
      <span className="sg-compensi-importo num">{senzaImporto(r.stato) ? '—' : `${euro(r.ricevuta?.importo ?? r.conto.calcolato)} €`}</span>
      <span className="sg-compensi-largo sg-compensi-iban">{r.manca?.includes('IBAN') ? <span data-tono="rosso" aria-label="manca l’IBAN">✕</span> : <span data-tono="verde" aria-label="IBAN c’è">✓</span>}</span>
      <span className="sg-compensi-largo">{aChePunto(r.ricevuta)}</span>
      <span className="sg-compensi-note">
        <span className="sg-compensi-telefono num">
          {quante(r.conto.lezioni, 'lez.', 'lez.')} · {ore(r.conto.minuti)} h
        </span>
        {r.stato === 'da-confermare' && (
          <>
            <span className="sg-segno-regola" data-tono="rosso">
              DA CONFERMARE
            </span>
            <span>{quante(r.conto.daConfermare, 'presenza', 'presenze')}</span>
          </>
        )}
        {r.stato === 'non-torna' && r.ricevuta && (
          <>
            <span className="sg-segno-regola" data-tono="rosso">
              NON TORNA PIÙ
            </span>
            <span>
              era {euro(r.ricevuta.importo)} €, ora {euro(r.conto.calcolato)} €
            </span>
          </>
        )}
        {/* Al desktop lo dicono le celle TARIFFA e IBAN; sul telefono quelle colonne non ci sono. */}
        {r.stato === 'senza-tariffa' && (
          <span className="sg-segno-regola sg-compensi-telefono" data-tono="rosso">
            SENZA TARIFFA · {r.conto.senzaTariffa.join(', ').toUpperCase()}
          </span>
        )}
        {r.stato === 'senza-dati' && (
          <span className="sg-segno-regola sg-compensi-telefono" data-tono="rosso">
            MANCANO I DATI
          </span>
        )}
        {r.stato === 'senza-dati' && altro !== 'IBAN' && <span>{maiuscola(altro)}</span>}
        {r.stato === 'solo-extra' && (
          <>
            <span className="sg-segno-regola" data-tono="neutro">
              SOLO EXTRA
            </span>
            <span>nessuna lezione nel mese</span>
          </>
        )}
        {r.senzaFirma.length > 0 && <span style={{ color: 'var(--dim)' }}>+ {quante(r.senzaFirma.length, 'lezione', 'lezioni')} senza la sua firma, in ASPETTANO UNA FIRMA</span>}
      </span>
      {azioni}
    </div>
  )
}

/** Un compenso extra, subito sotto il suo tecnico: per cosa, quanto, a che punto. */
function RigaExtraCorta({ x, azioni, onApri }: { x: RicevutaCompenso; azioni: ReactNode; onApri: () => void }) {
  return (
    <div className="sg-compensi-griglia sg-compensi-riga">
      <span className="sg-compensi-nome">
        <button type="button" className="sg-compensi-apri" style={{ fontWeight: 400 }} onClick={onApri}>
          ↳ {x.extra}
        </button>
      </span>
      <Vuota />
      <Vuota destra />
      <Vuota destra />
      <Vuota destra />
      <span className="sg-compensi-importo num">{euro(x.importo)} €</span>
      <Vuota />
      <span className="sg-compensi-largo">{aChePunto(x)}</span>
      <span className="sg-compensi-note">
        <span className="sg-segno-regola" data-tono="neutro">
          EXTRA
        </span>
      </span>
      {azioni}
    </div>
  )
}

/**
 * Una lezione tenuta in due dove il tecnico era previsto e non ha firmato.
 * C'ERA conferma la presenza (entra nel compenso); «Non c'era» la rifiuta e
 * non si chiede più.
 */
function RigaSenzaFirma({ d, p, l, fai, onCambiato, occupato, setOccupato }: { d: DatiSegreteria; p: Persona; l: SenzaFirma; fai: Fai; onCambiato: () => Promise<unknown>; occupato: boolean; setOccupato: (v: boolean) => void }) {
  // `occupato` e' di tutto l'elenco, non della riga: la riga segnata sparisce col suo stato,
  // e il secondo clic di un doppio clic cadrebbe sulla riga che sale al suo posto.
  const segna = async (cera: boolean) => {
    setOccupato(true)
    try {
      await fai(() => (cera ? d.segnaIstruttorePrevisto(l.sessioneId, p.id) : d.segnaIstruttoreAssente(l.sessioneId, p.id)), cera ? `${p.nome} c’era: la lezione entra nel compenso` : `${p.nome} non c’era`, onCambiato)
      // Il tempo di vedere la riga sparire, prima che i tasti di quella sotto si riaccendano.
      await new Promise((r) => setTimeout(r, 600))
    } finally {
      setOccupato(false)
    }
  }
  const quando = new Date(l.inizio)
  return (
    <div className="sg-compensi-griglia sg-compensi-riga">
      <span className="sg-compensi-nome" style={{ fontSize: 15, fontWeight: 600 }}>
        {nomeDi(p)}
      </span>
      <span className="sg-compensi-largo">{l.corso}</span>
      <span className="sg-compensi-largo sg-compensi-cifra num">1</span>
      <Vuota destra />
      <Vuota destra />
      <span className="sg-compensi-importo sg-compensi-vuoto">—</span>
      <Vuota />
      <Vuota />
      <span className="sg-compensi-note">
        <span className="num">
          <span className="sg-compensi-telefono">{l.corso} · </span>
          {GIORNI_CORTI[quando.getDay()]} {quando.getDate()}/{quando.getMonth() + 1} · {oraDi(l.inizio)}
        </span>
        <span style={{ color: 'var(--dim)' }}>ha firmato {l.firmatoDa.join(', ')}</span>
      </span>
      <Azioni
        testo={
          <button type="button" className="sg-link sg-link-alto" style={{ fontSize: 14 }} disabled={occupato} onClick={() => void segna(false)}>
            Non c’era
          </button>
        }
        tasto={
          <button type="button" className="sg-btn sg-btn-linea" disabled={occupato} onClick={() => void segna(true)}>
            C’era
          </button>
        }
      />
    </div>
  )
}

/** Un compenso extra, sotto la riga del suo tecnico: per cosa, quanto, a che punto, e i tasti. */
function RigaExtra({ d, r, fai, onCambiato, onModifica, onPaga }: { d: DatiSegreteria; r: RicevutaCompenso; fai: Fai; onCambiato: () => Promise<unknown>; onModifica: () => void; onPaga?: () => void }) {
  const [occupato, setOccupato] = useState(false)
  const annulla = async () => {
    if (!(await chiedi(`Annullare la ricevuta extra «${r.extra}»? Resta nel registro, annullata.`, 'Annulla la ricevuta', { pericolo: true }))) return
    setOccupato(true)
    try {
      await fai(() => d.annullaRicevutaCompenso(r.id), 'Ricevuta annullata', onCambiato)
    } finally {
      setOccupato(false)
    }
  }
  return (
    <div className="row sg-compenso-riga" style={{ gap: 14, flexWrap: 'wrap', alignItems: 'center', minHeight: 48, marginLeft: 16, paddingLeft: 14, borderLeft: '3px solid var(--line-soft)' }}>
      <span className="stack" style={{ gap: 4, minWidth: 130, flex: '0 1 240px', alignItems: 'flex-start' }}>
        <span className="sg-segno-regola" data-tono="neutro">
          EXTRA
        </span>
        <span style={{ fontSize: 14, overflowWrap: 'anywhere' }}>{r.extra}</span>
      </span>
      <span className="num" style={{ fontSize: 15, fontWeight: 700, minWidth: 90 }}>{euro(r.importo)} €</span>
      <span className="stack" style={{ gap: 4, flex: 1, minWidth: 200, alignItems: 'flex-start' }}>
        <span className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
          <span className="sg-segno-regola" data-tono={r.pagataIl ? 'verde' : 'giallo'}>
            {r.pagataIl ? 'PAGATA' : 'FATTA · DA PAGARE'}
          </span>
          {!r.firmata && (
            <span className="sg-segno-regola" data-tono="giallo">
              DA RIPORTARE FIRMATA
            </span>
          )}
        </span>
        <span style={{ fontSize: 13, color: 'var(--sec)' }}>{r.pagataIl ? `Pagata il ${dataLunga(r.pagataIl)}. Per annullarla, prima si annulla il pagamento in CONTABILITÀ.` : `Fatta il ${dataLunga(r.data)}`}</span>
      </span>
      <span className="row" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'center', flex: '0 1 280px', justifyContent: 'flex-end' }}>
        <label className="row" style={{ gap: 8, minHeight: 44, fontSize: 14, fontWeight: 600 }}>
          <input
            type="checkbox"
            style={{ width: 24, height: 24, margin: 0, accentColor: 'var(--text)' }}
            checked={r.firmata}
            onChange={(e) => void fai(() => d.segnaFirmataCompenso(r.id, e.target.checked), e.target.checked ? 'Segnata firmata' : 'Tolta la spunta', onCambiato)}
          />
          Firmata
        </label>
        <button type="button" className="sg-btn sg-btn-linea" onClick={() => void fai(() => suCarta(fai, (c) => scarica([r], c)), 'PDF scaricato')}>
          Ristampa
        </button>
        {!r.pagataIl && onPaga && (
          <button type="button" className="sg-btn sg-btn-linea" disabled={occupato} onClick={onPaga}>
            Segna pagato
          </button>
        )}
        {/* Modifica e Annulla su una riga loro, come per il mese: una pagata non si tocca da qui. */}
        {!r.pagataIl && (
          <span className="row" style={{ flexBasis: '100%', gap: 10, justifyContent: 'flex-end' }}>
            <button type="button" className="sg-btn sg-btn-linea" disabled={occupato} onClick={onModifica}>
              Modifica
            </button>
            <button type="button" className="sg-btn sg-btn-linea sg-pericolo" disabled={occupato} onClick={() => void annulla()}>
              Annulla
            </button>
          </span>
        )}
      </span>
    </div>
  )
}

/**
 * COMPENSO EXTRA: una ricevuta a parte, oltre a quella del mese, per un lavoro
 * che non sta nelle lezioni (uno stage, un arbitraggio). Fa la nuova, o cambia
 * per cosa e quanto di una non ancora pagata; poi la stampa.
 */
function DialogoExtra({
  d,
  tecnici,
  periodi,
  personaId,
  ricevuta,
  ricevute,
  mancano,
  fai,
  onChiudi,
  onFatto,
}: {
  d: DatiSegreteria
  tecnici: Persona[]
  periodi: ReturnType<typeof mesi>
  personaId?: string
  /** Quella da cambiare; senza, se ne fa una nuova. */
  ricevuta?: RicevutaCompenso
  ricevute: RicevutaCompenso[]
  mancano: Record<string, string | null>
  fai: Fai
  onChiudi: () => void
  onFatto: () => Promise<unknown>
}) {
  const ref = useDialogo<HTMLFormElement>(onChiudi)
  const [chi, setChi] = useState(ricevuta?.personaId ?? personaId ?? '')
  // Il mese in cui la si paga: di solito quello in corso, non quello guardato in pagina.
  const [quando, setQuando] = useState(ricevuta?.mese ?? primoDelMese(periodi[0].da))
  const [perCosa, setPerCosa] = useState(ricevuta?.extra ?? '')
  const [testo, setTesto] = useState(ricevuta ? euroDaScrivere(ricevuta.importo) : '')
  const [occupato, setOccupato] = useState(false)
  const importo = centesimiDaImporto(testo) ?? 0
  // Senza codice fiscale, residenza o IBAN non si fa, come quella del mese: lo si dice subito, il resto quando si scrive.
  const manca = ricevuta ? null : (mancano[chi] ?? null)
  const errore = manca ?? cosaNonVaImportoScritto(testo) ?? cosaNonVaExtra({ descrizione: perCosa, importo })
  const no = !chi ? 'Scegli il tecnico' : errore
  // Il tecnico che manca si dice sotto la sua tendina; qui sotto il resto, quando si scrive.
  const mostra = !chi ? null : (manca ?? (perCosa || testo ? errore : null))
  // La qualifica la mette il database, da quella del mese: qui si fa solo vedere.
  const delMese = ricevute.find((r) => r.personaId === chi && r.mese === quando && !r.annullataIl && !r.extra)
  const qualifica = ricevuta ? ricevuta.qualifica : delMese?.qualifica
  const salva = async () => {
    if (no) return
    setOccupato(true)
    try {
      const fatta: { r?: RicevutaCompenso } = {}
      const ok = await fai(
        async () => (fatta.r = ricevuta ? await d.modificaRicevutaCompensoExtra(ricevuta.id, { descrizione: perCosa, importo }) : await d.faiRicevutaCompensoExtra({ personaId: chi, mese: quando, descrizione: perCosa, importo })),
        ricevuta ? 'Ricevuta extra cambiata' : 'Ricevuta extra fatta',
        onFatto,
      )
      // Prima si salva, poi si scarica: se il PDF non esce, la ricevuta c'è già e si ristampa.
      const r = fatta.r
      if (ok && r) void fai(() => suCarta(fai, (c) => scarica([r], c)), 'PDF scaricato')
    } finally {
      setOccupato(false)
    }
  }
  const nomeTecnico = tecnici.find((t) => t.id === chi)
  return (
    <>
      <button type="button" className="sg-velo" aria-label="Chiudi" onClick={onChiudi} />
      <form
        ref={ref}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        aria-label="Compenso extra"
        className="sg-dialogo"
        style={{ width: 'min(620px, calc(100% - 32px))', maxHeight: 'calc(100% - 32px)', overflowY: 'auto' }}
        onSubmit={(e) => {
          e.preventDefault()
          void salva()
        }}
      >
        <span className="stack" style={{ gap: 4 }}>
          <span className="ob" style={{ fontSize: 26, fontWeight: 700, letterSpacing: '0.04em' }}>
            COMPENSO EXTRA
          </span>
          <span className="sg-sotto">Una ricevuta a parte, oltre a quella del mese: per uno stage, un arbitraggio, un evento.</span>
        </span>
        <label className="stack" style={{ gap: 6 }}>
          <span className="sg-etichetta">TECNICO</span>
          {ricevuta ? (
            <span style={{ fontSize: 15 }}>{nomeTecnico ? nomeDi(nomeTecnico) : ''}</span>
          ) : (
            <select className="sg-campo" value={chi} onChange={(e) => setChi(e.target.value)} aria-invalid={!chi} aria-describedby={!chi ? 'extra-chi' : undefined}>
              <option value="">Scegli…</option>
              {[...tecnici].sort((x, y) => nomeDi(x).localeCompare(nomeDi(y))).map((t) => (
                <option key={t.id} value={t.id}>
                  {nomeDi(t)}
                </option>
              ))}
            </select>
          )}
          {!chi && (
            <span id="extra-chi" style={{ fontSize: 13, color: 'var(--rosso-testo)' }}>
              Scegli il tecnico.
            </span>
          )}
        </label>
        <label className="stack" style={{ gap: 6 }}>
          <span className="sg-etichetta">MESE</span>
          {ricevuta ? (
            <span style={{ fontSize: 15 }}>{maiuscola(dataLunga(ricevuta.mese).replace(/^1 /, ''))}</span>
          ) : (
            <select className="sg-campo" value={quando} onChange={(e) => setQuando(e.target.value)}>
              {periodi.map((x) => (
                <option key={x.chiave} value={primoDelMese(x.da)}>
                  {x.nome}
                </option>
              ))}
            </select>
          )}
          <span style={{ fontSize: 13, color: 'var(--giallo-testo)' }}>Il mese in cui la paghi: la ritrovi lì, in COMPENSI e in contabilità.</span>
        </label>
        <label className="stack" style={{ gap: 6 }}>
          <span className="sg-etichetta">PER COSA</span>
          <textarea className="sg-campo" rows={3} maxLength={200} value={perCosa} onChange={(e) => setPerCosa(e.target.value)} placeholder="Per esempio: stage di judo del 18 ottobre" />
          <span style={{ fontSize: 13, color: 'var(--giallo-testo)' }}>Si legge così sulla ricevuta. Da 3 a 200 caratteri.</span>
        </label>
        <label className="stack" style={{ gap: 6, maxWidth: 240 }}>
          <span className="sg-etichetta">IMPORTO (€)</span>
          <input className="sg-campo num" inputMode="decimal" value={testo} onChange={(e) => setTesto(e.target.value)} />
        </label>
        {chi && (
          <span className="stack" style={{ gap: 6 }}>
            <span className="sg-etichetta">QUALIFICA</span>
            <span style={{ fontSize: 15 }}>{qualifica ? `${maiuscola(qualifica)} · come nella ricevuta del mese` : 'Nessuna: senza la ricevuta del mese, la mansione si barra a mano'}</span>
          </span>
        )}
        <span className="sg-sotto">Si stampa subito, come quella del mese: stesso modello, al posto delle lezioni la riga «per cosa».</span>
        {mostra && (
          <span role="alert" style={{ fontSize: 13, color: 'var(--rosso-testo)' }}>
            {mostra}.
          </span>
        )}
        <div className="sg-conferma-tasti">
          <button type="button" className="sg-btn sg-btn-linea" onClick={onChiudi}>
            Lascia stare
          </button>
          <button type="submit" className="sg-btn sg-btn-pieno" disabled={!!no || occupato}>
            {ricevuta ? 'Cambia e ristampa' : 'Fai e stampa la ricevuta'}
          </button>
        </div>
      </form>
    </>
  )
}

/**
 * Il tecnico aperto: la ricevuta del mese coi suoi tasti (prepara, modifica il
 * compenso, annulla), le sue extra e il conto per corso. Nella tabella c'è solo
 * il tasto che serve adesso; il resto sta qui.
 */
function DialogoRicevuta({ d, r, mese, fai, onChiudi, onCambiato, onPaga, onExtra, onModificaExtra, onVai }: {
  d: DatiSegreteria
  r: Riga
  mese: string
  fai: Fai
  onChiudi: () => void
  onCambiato: () => Promise<unknown>
  onPaga?: () => void
  onExtra: () => void
  onModificaExtra: (x: RicevutaCompenso) => void
  onVai: (v: Voce) => void
}) {
  const dialogo = useDialogo<HTMLDivElement>(onChiudi)
  return (
    <div className="sg-velo" onClick={onChiudi}>
      <div ref={dialogo} className="sg-dialogo stack" role="dialog" aria-modal="true" aria-labelledby="compenso-titolo" style={{ gap: 14, minWidth: 'min(760px, 100%)' }} onClick={(e) => e.stopPropagation()}>
        <h2 id="compenso-titolo" className="ob" style={{ fontSize: 26, margin: 0 }}>
          {nomeDi(r.persona)}
        </h2>
        <SegnoCompenso stato={r.stato} conto={r.conto} ricevuta={r.ricevuta} manca={r.manca} senzaFirma={r.senzaFirma.length} />
        {r.stato !== 'solo-extra' && (
          <AzioniRicevuta d={d} p={r.persona} conto={r.conto} ricevuta={r.ricevuta} stato={r.stato} mese={mese} fai={fai} onCambiato={onCambiato} onPaga={onPaga} onVai={onVai} />
        )}
        {r.extra.map((x) => (
          <RigaExtra key={x.id} d={d} r={x} fai={fai} onCambiato={onCambiato} onModifica={() => onModificaExtra(x)} onPaga={onPaga} />
        ))}
        {r.conto.righe.length > 0 && (
          <div className="stack" style={{ gap: 0 }}>
            <span className="sg-etichetta">PER CORSO</span>
            {r.conto.righe.map((x) => (
              <div key={x.corso} className="sg-compenso-corso" style={{ fontSize: 14, padding: '4px 0', borderBottom: '1px solid var(--line-soft)' }}>
                <span>{x.corso}</span>
                <span className="num">{quanteOre(x.minuti)}</span>
                {x.centesimiOra ? (
                  <span className="num">{euroOra(x.centesimiOra)}</span>
                ) : (
                  <span className="sg-segno-regola" data-tono="rosso">
                    SENZA TARIFFA
                  </span>
                )}
                <span className="num" style={{ fontWeight: 700 }}>{x.importo !== undefined ? `${euro(x.importo)} €` : '—'}</span>
              </div>
            ))}
            <div className="sg-compenso-corso" style={{ fontSize: 14, padding: '6px 0', fontWeight: 700 }}>
              <span>Totale</span>
              <span className="num">{quanteOre(r.conto.minuti)}</span>
              <span />
              <span className="num">{euro(r.conto.calcolato)} €</span>
            </div>
          </div>
        )}
        <div className="row" style={{ gap: 14, flexWrap: 'wrap' }}>
          <button type="button" className="sg-link sg-link-alto" style={{ fontSize: 14 }} onClick={onExtra}>
            + Compenso extra
          </button>
          <button type="button" className="sg-link sg-link-alto" style={{ fontSize: 14 }} onClick={() => onVai('personale')}>
            Apri la scheda ›
          </button>
        </div>
        <div className="sg-conferma-tasti">
          <button type="button" className="sg-btn sg-btn-linea" onClick={onChiudi}>
            Chiudi
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * COMPENSI: il mese di tutti i tecnici, in gruppi nell'ordine in cui la
 * segreteria lavora: da sistemare, da fare, da far firmare, da pagare, pagate.
 * Ogni riga ha il solo tasto che serve adesso; il nome apre il resto. Le
 * ricevute da fare si preparano tutte insieme, in un PDF solo.
 */
export function Compensi({ d, puoPagare, onVai }: { d: DatiSegreteria; puoPagare: boolean; onVai: (v: Voce) => void }) {
  const periodi = useMemo(mesi, [])
  const [periodo, setPeriodo] = useState(periodi[1]?.chiave ?? periodi[0].chiave)
  const [filtro, setFiltro] = useState<'manca-firma' | 'extra' | null>(null)
  const [tutte, setTutte] = useState(false)
  const [paga, setPaga] = useState<Persona | null>(null)
  // Solo l'id: la riga si ritrova a ogni ricarica, così il dialogo mostra lo stato di adesso.
  const [aperto, setAperto] = useState<string | null>(null)
  const [segnando, setSegnando] = useState(false)
  // Il dialogo COMPENSO EXTRA: per chi (dalla riga) o per una da cambiare.
  const [extra, setExtra] = useState<{ personaId?: string; ricevuta?: RicevutaCompenso } | null>(null)
  const m = periodi.find((x) => x.chiave === periodo) ?? periodi[0]
  const mese = primoDelMese(m.da)
  const giorni = Math.ceil((Date.now() - m.da.getTime()) / 86_400_000) + 1
  const { avviso, avvisa, fai } = useAvviso()
  const dati = useCarica(async () => {
    // Per pagare servono anche i mesi delle ricevute ancora da pagare, per vedere se tornano: le presenze si leggono da lì.
    const ricevute = await d.ricevuteCompensi()
    const piuVecchia = ricevute.filter((r) => !r.annullataIl && !r.pagataIl).reduce((min, r) => (r.mese < min ? r.mese : min), mese)
    const indietro = Math.max(giorni, Math.ceil((Date.now() - Date.parse(`${piuVecchia}T00:00:00`)) / 86_400_000) + 1)
    const [personale, presenze, senzaIstruttore] = await Promise.all([d.personale(), d.presenzeIstruttori(indietro), d.lezioniSenzaIstruttore()])
    const tecnici = personale.filter(insegna)
    const [tariffe, mancano] = await Promise.all([
      Promise.all(tecnici.map(async (t) => [t.id, await d.tariffe(t.id)] as const)).then((x): Record<string, Tariffa[]> => Object.fromEntries(x)),
      Promise.all(tecnici.map(async (t) => [t.id, mancaPerRicevuta((await d.anagraficaDi(t.id))?.dati ?? null)] as const)).then((x): Record<string, string | null> => Object.fromEntries(x)),
    ])
    // Le casse le legge solo chi cura la contabilità: serve per pagare.
    const [casse, chiusure] = puoPagare ? await Promise.all([d.casse(), d.chiusure()]) : [[], []]
    return { tecnici, presenze, senzaIstruttore, ricevute, tariffe, mancano, casse, chiusure }
  }, [d, giorni])

  const righe = dati.dato ? righeCompensi({ ...dati.dato, mese: m }) : []
  const fermi = righe.filter((r) => STATI_FERMI.includes(r.stato))
  const tutti = gruppiCompensi(righe)
  const { totale: totaleDaPagare } = daPagareCompensi(righe)
  const nExtra = righe.reduce((s, r) => s + r.extra.length, 0)
  const conFiltro = filtro === 'extra' ? righe.filter((r) => r.extra.length) : righe
  const { gruppi, senzaFirma } = gruppiCompensi(conFiltro)
  const rigaAperta = righe.find((r) => r.persona.id === aperto)

  const ristampa = (x: RicevutaCompenso) => (
    <button type="button" className="sg-link sg-link-alto" style={{ fontSize: 14 }} onClick={() => void fai(() => suCarta(fai, (c) => scarica([x], c)), 'PDF scaricato')}>
      Ristampa
    </button>
  )
  // Come per C'ERA: la riga firmata passa a DA PAGARE e quella sotto sale sotto il mouse.
  const segnaFirmata = async (x: RicevutaCompenso) => {
    setSegnando(true)
    try {
      await fai(() => d.segnaFirmataCompenso(x.id, true), 'Segnata firmata', dati.ricarica)
      await new Promise((r) => setTimeout(r, 600))
    } finally {
      setSegnando(false)
    }
  }
  // Le regole (quale tasto) stanno in azioneRiga e azioneCarta; qui solo cosa fa ciascuno.
  const tasti = (r: Riga, azione: AzioneCompenso | null, x?: RicevutaCompenso) => {
    const tasto = (testo: string, onClick: () => void, disabled = false) => (
      <button type="button" className="sg-btn sg-btn-linea" disabled={disabled} onClick={onClick}>
        {testo}
      </button>
    )
    const qui: Record<AzioneCompenso, () => ReactNode> = {
      presenze: () => tasto('Gestisci', () => onVai('istruttori')),
      conto: () => tasto('Gestisci', () => setAperto(r.persona.id)),
      personale: () => tasto('Gestisci', () => onVai('personale')),
      prepara: () => tasto('Prepara la ricevuta', () => setAperto(r.persona.id)),
      firmata: () => x && tasto('Segna firmata', () => void segnaFirmata(x), segnando),
      pagato: () => tasto('Segna pagato', () => setPaga(r.persona)),
    }
    return <Azioni testo={x && ristampa(x)} tasto={azione && qui[azione]()} />
  }
  const preparaTutte = async (daFare: Riga[]) => {
    const fatte: RicevutaCompenso[] = []
    const saltati: string[] = fermi.map(saltato)
    setTutte(true)
    // La carta prima: se non arriva, l'avviso dice insieme l'esito (chi è saltato) e che il PDF aspetta.
    try {
    const carta = await cartaSePuoi()
    await fai(async () => {
      for (const r of daFare) {
        try {
          fatte.push(await faiRicevuta(d, r.persona, r.conto, mese))
        } catch (e) {
          saltati.push(e instanceof Error ? e.message : nomeDi(r.persona))
        }
      }
      if (fatte.length && carta) await scarica(fatte, carta)
      const esito = avvisoDelMese(fatte.length, saltati, !!carta)
      if (esito.senzaCarta) throw new GuaioConAzione(esito.testo, stampaSenzaCarta(fai, () => scarica(fatte)))
      if (esito.guaio) throw new Error(esito.testo)
      avvisa(esito.testo)
    })
    } finally {
      setTutte(false)
    }
    await dati.ricarica()
  }

  const righeDelGruppo = (rs: Riga[]) =>
    rs.map((r) => (
      <Fragment key={r.persona.id}>
        <RigaCorta r={r} azioni={tasti(r, azioneRiga(r, puoPagare), r.stato === 'da-fare' || STATI_FERMI.includes(r.stato) ? undefined : (r.ricevuta ?? undefined))} onApri={() => setAperto(r.persona.id)} />
        {r.extra.map((x) => (
          <RigaExtraCorta key={x.id} x={x} azioni={tasti(r, azioneCarta(r.stato, x, false, puoPagare), x)} onApri={() => setExtra({ ricevuta: x })} />
        ))}
      </Fragment>
    ))

  return (
    <div className="stack" style={{ gap: 18 }}>
      <Testa titolo="COMPENSI" sotto="Per ogni corso, ore confermate × la sua tariffa. Si sistemano, si stampano, si fanno firmare, si pagano." />
      {avviso}
      <div className="row" style={{ gap: 14, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <label className="stack" style={{ gap: 6, width: 240 }}>
          <span className="sg-etichetta">MESE</span>
          <select className="sg-campo" value={periodo} onChange={(e) => setPeriodo(e.target.value)}>
            {periodi.map((x) => (
              <option key={x.chiave} value={x.chiave}>
                {x.nome}
              </option>
            ))}
          </select>
        </label>
        {dati.dato && (
          <>
            <span className="num" style={{ fontSize: 14, minHeight: 44, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
              {quante(righe.length, 'tecnico', 'tecnici')} ·{' '}
              <span style={fermi.length ? { color: 'var(--rosso-testo)', fontWeight: 700 } : undefined}>{quante(fermi.length, 'fermo', 'fermi')}</span> · {euro(totaleDaPagare)} € da pagare · {euro(tutti.pagati)} € pagati
            </span>
            <span className="row" style={{ gap: 10, flexWrap: 'wrap', marginLeft: 'auto', alignItems: 'center' }}>
              <Chip acceso={filtro === 'manca-firma'} numero={tutti.senzaFirma.length} etichetta={`Manca la firma: ${quante(tutti.senzaFirma.length, 'lezione', 'lezioni')}`} onClick={() => setFiltro(filtro === 'manca-firma' ? null : 'manca-firma')}>
                Manca la firma
              </Chip>
              <Chip acceso={filtro === 'extra'} numero={nExtra} etichetta={`Extra: ${quante(nExtra, 'ricevuta', 'ricevute')}`} onClick={() => setFiltro(filtro === 'extra' ? null : 'extra')}>
                Extra
              </Chip>
              {/* Anche per chi nel mese non ha lezioni: per questo sta qui e non solo nel dialogo del tecnico. */}
              <button type="button" className="sg-btn sg-btn-linea" onClick={() => setExtra({})}>
                + Compenso extra
              </button>
            </span>
          </>
        )}
      </div>
      {dati.guaio && <Guaio testo={dati.guaio} />}
      {dati.dato && (
        <>
          {!righe.length && <span className="sg-sotto">Nessun tecnico con lezioni in {m.nome.toLowerCase()}.</span>}
          {righe.length > 0 && filtro && !(filtro === 'manca-firma' ? senzaFirma.length : gruppi.length) && <span className="sg-sotto">Nessuno con questo filtro.</span>}
          <div className="sg-compensi">
            {(gruppi.length > 0 || senzaFirma.length > 0) && <TestataCompensi />}
            {filtro !== 'manca-firma' &&
              gruppi.map((g) => {
                const t = TESTE[g.gruppo]
                if (g.gruppo === 'pagate')
                  return (
                    <details key={g.gruppo} className="sg-compensi-pagate">
                      <summary>
                        <span aria-hidden>▸</span>
                        <Icona nome="pagate" misura={20} />
                        <span className="ob sg-compensi-pagate-titolo">
                          PAGATE <span className="sg-compensi-conto">· {g.righe.length}</span>
                        </span>
                        <span className="sg-sotto">{euro(gruppiCompensi(g.righe).pagati)} € · si aprono per ristampare</span>
                      </summary>
                      {righeDelGruppo(g.righe)}
                    </details>
                  )
                const n = g.righe.length
                const conto =
                  g.gruppo === 'da-fare'
                    ? `${n} · ${euro(g.righe.reduce((s, r) => s + r.conto.calcolato, 0))} €`
                    : g.gruppo === 'da-pagare'
                      ? `${n} · ${euro(daPagareCompensi(g.righe).totale)} €`
                      : String(n)
                const sotto =
                  g.gruppo === 'da-sistemare'
                    ? 'Finché non sono a posto, la loro ricevuta non si fa.'
                    : g.gruppo === 'da-fare'
                      ? `Un PDF solo con ${n === 1 ? 'questa' : `queste ${n}`}, da stampare e consegnare. Gli extra si stampano uno per uno.`
                      : g.gruppo === 'da-far-firmare'
                        ? 'Stampate e consegnate. Quando tornano firmate, «Segna firmata» e passano a DA PAGARE.'
                        : puoPagare
                          ? 'Firmate. «Segna pagato» le scrive in Contabilità.'
                          : 'Le paga chi cura la contabilità.'
                return (
                  <section key={g.gruppo} aria-label={t.titolo}>
                    <TestaGruppo titolo={t.titolo} conto={conto} icona={t.icona} tono={t.tono} sotto={sotto}>
                      {/* Con un filtro il gruppo non è intero: «tutte» preparerebbe solo una parte. */}
                      {g.gruppo === 'da-fare' && !filtro && (
                        <button type="button" className="sg-btn sg-btn-pieno" disabled={tutte} onClick={() => void preparaTutte(g.righe)}>
                          Prepara le ricevute ({n})
                        </button>
                      )}
                    </TestaGruppo>
                    {righeDelGruppo(g.righe)}
                  </section>
                )
              })}
            {filtro !== 'extra' && senzaFirma.length > 0 && (
              <section aria-label="ASPETTANO UNA FIRMA">
                <TestaGruppo
                  titolo="ASPETTANO UNA FIRMA"
                  conto={quante(senzaFirma.length, 'lezione', 'lezioni')}
                  icona="orologio"
                  tono="neutro"
                  sotto="Lezioni tenute in due: il tecnico era previsto e non ha firmato. Non fermano nessuna ricevuta. Se c’era, entra nel suo compenso del mese."
                />
                {senzaFirma.map(({ persona, lezione }) => (
                  <RigaSenzaFirma key={`${persona.id}-${lezione.sessioneId}`} d={d} p={persona} l={lezione} fai={fai} onCambiato={dati.ricarica} occupato={segnando} setOccupato={setSegnando} />
                ))}
              </section>
            )}
          </div>
          {rigaAperta && (
            <DialogoRicevuta
              d={d}
              r={rigaAperta}
              mese={mese}
              fai={fai}
              onChiudi={() => setAperto(null)}
              onCambiato={dati.ricarica}
              onPaga={
                puoPagare
                  ? () => {
                      setAperto(null)
                      setPaga(rigaAperta.persona)
                    }
                  : undefined
              }
              onExtra={() => {
                setAperto(null)
                setExtra({ personaId: rigaAperta.persona.id })
              }}
              onModificaExtra={(x) => {
                setAperto(null)
                setExtra({ ricevuta: x })
              }}
              onVai={onVai}
            />
          )}
          {extra && (
            <DialogoExtra
              d={d}
              tecnici={dati.dato.tecnici}
              periodi={periodi}
              personaId={extra.personaId}
              ricevuta={extra.ricevuta}
              ricevute={dati.dato.ricevute}
              mancano={dati.dato.mancano}
              fai={fai}
              onChiudi={() => setExtra(null)}
              onFatto={async () => {
                setExtra(null)
                await dati.ricarica()
              }}
            />
          )}
          {paga && dati.dato && (
            <PannelloPaga
              key={paga.id}
              d={d}
              p={paga}
              ricevute={pagabili(dati.dato.ricevute, paga.id, (r) => {
                // Il conto di adesso del mese della ricevuta, con le stesse presenze e tariffe della pagina.
                const [y, mm] = r.mese.split('-').map(Number)
                return dati.dato ? compensoDelMese(dati.dato.presenze, dati.dato.senzaIstruttore, r.personaId, { da: new Date(y, mm - 1, 1), a: new Date(y, mm, 0) }, dati.dato.tariffe[r.personaId] ?? []).calcolato : undefined
              })}
              casse={dati.dato.casse}
              chiusure={dati.dato.chiusure}
              fai={fai}
              onFatto={async () => {
                setPaga(null)
                await dati.ricarica()
              }}
            />
          )}
          <span className="sg-sotto">Chi non ha lezioni confermate nel mese c’è solo se gli manca la firma in una lezione tenuta in due. Le lezioni da sostituto si pagano a chi c’era, con la sua tariffa per quel corso.</span>
        </>
      )}
    </div>
  )
}

/**
 * SEGNA PAGATO: una o più ricevute fatte e non pagate dello stesso tecnico,
 * il giorno e la cassa; diventano un'uscita sola in CONTABILITÀ con la voce
 * «Compensi istruttori». Prima di scrivere si vede il riepilogo.
 */
function PannelloPaga({
  d,
  p,
  ricevute,
  casse,
  chiusure,
  fai,
  onFatto,
}: {
  d: DatiSegreteria
  p: Persona
  ricevute: RicevutaCompenso[]
  casse: Cassa[]
  chiusure: ChiusuraCassa[]
  fai: Fai
  onFatto: () => Promise<void>
}) {
  const [scelte, setScelte] = useState<string[]>(ricevute.map((r) => r.id))
  const oggi = oggiARoma()
  const [data, setData] = useState(oggi)
  // Si apre in fondo alla pagina: ci si porta lì, anche sul telefono e con la tastiera.
  const titolo = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    titolo.current?.scrollIntoView({ block: 'start' })
    titolo.current?.focus()
  }, [])
  const conto = casse.find((c) => c.nome === NOME_CASSA_CONTO)
  const [cassaId, setCassaId] = useState(conto?.id ?? casse[0]?.id ?? '')
  const pagate = ricevute.filter((r) => scelte.includes(r.id))
  const totale = pagate.reduce((s, r) => s + r.importo, 0)
  const cassa = casse.find((c) => c.id === cassaId)
  const no = cosaNonVaPagamento({ ricevute: pagate, data, cassaId, casse, chiusure, oggi })
  return (
    <section className="stack" style={{ gap: 14, maxWidth: 820, padding: '22px 24px', border: '2px solid var(--text)' }} aria-label={`Segna pagato ${nomeDi(p)}`}>
      <h2 ref={titolo} tabIndex={-1} className="sg-riquadro-titolo ob" style={{ margin: 0 }}>
        Segna pagato · {nomeDi(p)}
      </h2>
      <span className="sg-etichetta">LE RICEVUTE CHE PAGHI</span>
      {ricevute.map((r) => (
        <label key={r.id} className="row" style={{ gap: 12, minHeight: 44, fontSize: 15 }}>
          <input
            type="checkbox"
            style={{ width: 24, height: 24, margin: 0, accentColor: 'var(--text)' }}
            checked={scelte.includes(r.id)}
            onChange={(e) => setScelte(e.target.checked ? [...scelte, r.id] : scelte.filter((x) => x !== r.id))}
          />
          <span style={{ flex: 1 }}>
            {r.extra ? `Extra · ${r.extra} · ` : ''}
            {dataLunga(r.mese).replace(/^1 /, '')} · fatta il {dataLunga(r.data)}
          </span>
          <span className="num" style={{ fontWeight: 700 }}>{euro(r.importo)} €</span>
        </label>
      ))}
      <span className="sg-sotto">Solo le sue ricevute fatte e non ancora pagate. Un bonifico che paga più mesi è un movimento solo.</span>
      <div className="sg-due sg-scheda-campi">
        <label className="stack" style={{ gap: 6 }}>
          <span className="sg-etichetta">DATA DEL PAGAMENTO</span>
          <input type="date" className="sg-campo" value={data} max={oggi} onChange={(e) => setData(e.target.value)} />
        </label>
        <div className="stack" style={{ gap: 6 }}>
          <span className="sg-etichetta">CASSA</span>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            {[...casse].sort((x, y) => Number(y.nome === NOME_CASSA_CONTO) - Number(x.nome === NOME_CASSA_CONTO)).map((c) => (
              <button key={c.id} type="button" className="num sg-chip" aria-pressed={c.id === cassaId} onClick={() => setCassaId(c.id)}>
                {c.nome}
              </button>
            ))}
          </div>
        </div>
      </div>
      {pagate.length > 0 && cassa && (
        <div className="sg-due" style={{ padding: '14px 16px', border: '2px solid var(--line-soft)' }}>
          <span className="stack" style={{ gap: 2 }}>
            <span className="sg-etichetta">TIPO</span>Uscita
          </span>
          <span className="stack" style={{ gap: 2 }}>
            <span className="sg-etichetta">CASSA</span>
            {cassa.nome}
          </span>
          <span className="stack" style={{ gap: 2 }}>
            <span className="sg-etichetta">VOCE</span>
            {VOCE_COMPENSI}
          </span>
          <span className="stack" style={{ gap: 2 }}>
            <span className="sg-etichetta">IMPORTO</span>
            {euro(totale)} €
          </span>
          <span className="stack" style={{ gap: 2, gridColumn: 'span 2' }}>
            <span className="sg-etichetta">DESCRIZIONE</span>
            {descrizionePagamento(
              p.nome,
              p.cognome,
              pagate.map((r) => r.mese),
              extraDelPagamento(pagate),
            )}
          </span>
        </div>
      )}
      <span className="sg-sotto">Si scrive in CONTABILITÀ → MOVIMENTI collegato al tecnico, senza codice fiscale né IBAN. Se va annullato, si annulla da lì e le ricevute tornano da pagare.</span>
      {no && (
        <span role="alert" style={{ fontSize: 13, color: 'var(--rosso-testo)' }}>
          {no}.
        </span>
      )}
      <div className="row" style={{ gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        <button type="button" className="sg-btn sg-btn-linea" onClick={() => void onFatto()}>
          Lascia stare
        </button>
        <button type="button" className="sg-btn sg-btn-pieno" disabled={!!no} onClick={() => void fai(() => d.pagaCompensi(pagate.map((r) => r.id), data, cassaId), `Pagato: ${euro(totale)} € in CONTABILITÀ`, onFatto)}>
          Segna pagato {euro(totale)} €
        </button>
      </div>
    </section>
  )
}
