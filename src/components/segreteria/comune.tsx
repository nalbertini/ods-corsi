import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type AnchorHTMLAttributes, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { NotaCampo, type Nota } from '../ds'
import { Icona } from '../Icons'
import { iconaAzione, iconaVerso, type NomeIcona } from '../../lib/icone'
import { GuaioConAzione } from '../../lib/cartaPdf'
import { clicFuoriChiude } from '../../lib/schedaFinestra'
import { dataLunga } from '../../lib/sala'
import type { Tono } from '../../lib/segreteria'

type Valore = string | number | null | undefined

type ConIcona = { tono?: 'pieno' | 'linea' | 'rosso' | 'verde'; icona?: NomeIcona | null; children: ReactNode }
/** L'icona di un tasto: quella data, o quella dell'azione che dice la sua parola (Salva, Annulla…); `null` nessuna. */
const iconaDi = ({ icona, children }: ConIcona) => (icona !== undefined ? icona : typeof children === 'string' ? iconaAzione(children) : null)

/**
 * Il tasto della segreteria. Le azioni che tornano in ogni pagina (Salva,
 * Annulla, Aggiungi…) portano la loro icona, la stessa ovunque: si riconoscono
 * prima di leggerle. Le altre restano solo parola.
 */
export function Tasto({ tono = 'linea', icona, className, children, type = 'button', ...resto }: ConIcona & ButtonHTMLAttributes<HTMLButtonElement>) {
  const nome = iconaDi({ icona, children })
  return (
    <button type={type} className={`sg-btn sg-btn-${tono}${className ? ` ${className}` : ''}`} {...resto}>
      {nome && <Icona nome={nome} />}
      {children}
    </button>
  )
}

/** Come `Tasto`, ma un collegamento: «Scarica» un file, «Stampa» una pagina. */
export function TastoLink({ tono = 'linea', icona, className, children, ...resto }: ConIcona & AnchorHTMLAttributes<HTMLAnchorElement>) {
  const nome = iconaDi({ icona, children })
  return (
    <a className={`sg-btn sg-btn-${tono}${className ? ` ${className}` : ''}`} {...resto}>
      {nome && <Icona nome={nome} />}
      {children}
    </a>
  )
}

/**
 * Il segno di uno stato (DA PAGARE, PUBBLICATA…). Con l'icona, nel look sito,
 * diventa una pastiglia tinta: l'icona prende il posto di ✕ … ✓.
 */
export function Tag({ tipo, icona, className, children }: { tipo?: 'manca' | 'aspetta' | 'sostituto' | 'presto' | 'fatto'; icona?: NomeIcona; className?: string; children: ReactNode }) {
  return (
    <span className={`num sg-tag${className ? ` ${className}` : ''}`} data-tipo={tipo} data-icona={icona ? '' : undefined}>
      {icona && <Icona nome={icona} misura={14} />}
      {children}
    </span>
  )
}

/**
 * Un cassetto o un dialogo sopra la pagina: aperto, il fuoco ci entra e non
 * scappa dietro il velo con TAB; ESC lo chiude; chiuso, il fuoco torna dove
 * era. Va su un elemento con `role="dialog"` e `tabIndex={-1}`.
 */
// I dialoghi aperti, dall'ultimo: ESC e TAB sono di quello in cima (una
// conferma sopra il cassetto della lezione chiude la conferma, non il cassetto).
const pila: object[] = []
/** Se c'è una finestra aperta: il suo Esc è suo, non di chi sta sotto. */
export const dialogoAperto = () => pila.length > 0

export function useDialogo<T extends HTMLElement>(onChiudi: () => void) {
  const ref = useRef<T>(null)
  const chiudi = useRef(onChiudi)
  chiudi.current = onChiudi
  useEffect(() => {
    const io = {}
    pila.push(io)
    const prima = document.activeElement as HTMLElement | null
    // Se la finestra ha già messo il fuoco su un suo campo (es. «Cerca»), lo si lascia lì: per «Cerca» il fuoco di partenza lo ripristina Segreteria.
    if (!ref.current?.contains(document.activeElement)) ref.current?.focus()
    const tasto = (e: KeyboardEvent) => {
      if (pila[pila.length - 1] !== io) return
      if (e.key === 'Escape') return chiudi.current()
      if (e.key !== 'Tab' || !ref.current) return
      const dentro = [...ref.current.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter(
        (x) => !x.hasAttribute('disabled') && x.offsetParent !== null,
      )
      if (!dentro.length) return
      const [primo, ultimo] = [dentro[0], dentro[dentro.length - 1]]
      const qui = document.activeElement
      if (e.shiftKey && (qui === primo || qui === ref.current)) {
        e.preventDefault()
        ultimo.focus()
      } else if (!e.shiftKey && (qui === ultimo || !ref.current.contains(qui))) {
        e.preventDefault()
        primo.focus()
      }
    }
    window.addEventListener('keydown', tasto)
    return () => {
      window.removeEventListener('keydown', tasto)
      pila.splice(pila.indexOf(io), 1)
      prima?.focus()
    }
  }, [])
  return ref
}

// Quello che si sta scrivendo e non è ancora salvato (vedi `useBozza`), con cosa è.
const bozze = new Map<object, { cosa?: string; mostra?: () => void }>()
// Chiudendo o ricaricando la pagina con una bozza aperta chiede il browser.
window.addEventListener('beforeunload', (e) => {
  if (bozze.size) e.preventDefault()
})

/**
 * Finché `aperta`, c'è qualcosa scritto a metà: cambiando voce del menu, o
 * scheda dentro una voce, la segreteria chiede prima di perderlo (`lasciare`),
 * e chiudendo o ricaricando la pagina lo chiede il browser. Al banco squilla
 * il telefono, e un clic altrove non deve buttare una ricevuta compilata.
 * `cosa` («Judo 2») entra nella domanda, per dire quale modifica si perde.
 */
export function useBozza(aperta: boolean, cosa?: string, mostraQui?: () => void) {
  const mostra = useContext(MostraBozza) ?? mostraQui
  useEffect(() => {
    if (!aperta) return
    const io = {}
    bozze.set(io, { cosa, mostra })
    return () => void bozze.delete(io)
  }, [aperta, cosa, mostra])
}

/**
 * Chi tiene una bozza in una scheda nascosta (le schede di IMPOSTAZIONI restano
 * montate) dice come riaprirla: «Torna a finire» deve far vedere cosa si finisce.
 */
export const MostraBozza = createContext<(() => void) | undefined>(undefined)

export const bozzaAperta = () => bozze.size > 0

/** Le bozze lasciate apposta (si è già risposto ESCI): ricaricando, il browser non chiede più. */
export const scordaBozze = () => bozze.clear()

/**
 * Prima di uscire da una bozza: `true` se non c'è niente da perdere o si esce
 * lo stesso. Il tasto in evidenza, e col fuoco, è restare: un INVIO di
 * troppo non deve buttare il lavoro.
 */
export function lasciare(): Promise<boolean> {
  if (!bozzaAperta()) return Promise.resolve(true)
  const tutte = [...bozze.values()]
  const cosa = tutte.map((b) => b.cosa).filter(Boolean).pop()
  return chiedi(`${cosa ? `${cosa}: modifiche` : 'Ci sono modifiche'} non salvate. Se esci si perdono.`, 'Esci senza salvare', { no: 'Torna a finire', restare: true }).then(
    (esci) => {
      if (!esci) [...tutte].reverse().find((b) => b.mostra)?.mostra?.()
      return esci
    },
  )
}

/** Un modulo che diventa bozza al primo tasto battuto o alla prima scelta. */
export function Bozza({ children }: { children: ReactNode }) {
  const [toccata, setToccata] = useState(false)
  useBozza(toccata)
  return (
    <div className="contents" onInputCapture={() => setToccata(true)}>
      {children}
    </div>
  )
}

export interface Domanda {
  testo: string
  si: string
  no: string
  pericolo: boolean
  /** Il no è il tasto in evidenza: si sta uscendo da qualcosa non salvato. */
  restare: boolean
  /** Una casella sotto la domanda: una scelta in più (MANDA PER EMAIL in FAI LA RICEVUTA); con `si` cambia anche il tasto (FAI ANCHE LA RICEVUTA). */
  spunta?: SpuntaDomanda
  risposta: (si: boolean, spuntata: boolean) => void
}

export interface SpuntaDomanda {
  testo: string
  /** La frase sotto la casella, che cambia con la spunta. */
  nota: (spuntata: boolean) => string
  /** Il tasto del sì, quando la spunta cambia cosa fa (fare la ricevuta o no); senza, resta quello della domanda. */
  si?: (spuntata: boolean) => string
  /** Come parte la casella: spuntata, se non si dice. */
  spuntata?: boolean
}
let mostra: ((d: Domanda) => void) | null = null

/**
 * Chiede conferma prima di un'azione, col verbo sui tasti: «Sì, annulla la
 * RICEVUTA» e «No, lascia stare», non OK e Annulla, che su «Annullare la
 * ricevuta?» dicevano il contrario. Il fuoco parte dal no; ESC è no.
 * `pericolo`: quello che non si annulla, col tasto rosso. Serve `<Conferme />`
 * nella pagina (la segreteria lo mette); senza, si chiede al browser.
 */
export function chiedi(testo: string, si: string, o: { no?: string; pericolo?: boolean; restare?: boolean } = {}): Promise<boolean> {
  return chiediSpunta(testo, si, o).then((x) => x.si)
}

/** Come `chiedi`, con la casella `spunta` sotto la domanda: dice anche se è rimasta spuntata. Senza `<Conferme />` resta spuntata. */
export function chiediSpunta(testo: string, si: string, o: { no?: string; pericolo?: boolean; restare?: boolean } = {}, spunta?: SpuntaDomanda): Promise<{ si: boolean; spuntata: boolean }> {
  return new Promise((risposta) => {
    if (!mostra) return risposta({ si: window.confirm(testo), spuntata: true })
    mostra({ testo, si, no: o.no ?? 'No, lascia stare', pericolo: !!o.pericolo, restare: !!o.restare, spunta, risposta: (x, spuntata) => risposta({ si: x, spuntata }) })
  })
}

/** Dove compaiono le domande di `chiedi`: una volta, nella pagina. */
export function Conferme() {
  const [d, setD] = useState<Domanda | null>(null)
  useEffect(() => {
    mostra = setD
    return () => {
      mostra = null
    }
  }, [])
  if (!d) return null
  const fine = (si: boolean, spuntata = true) => {
    setD(null)
    d.risposta(si, spuntata)
  }
  return <Conferma d={d} fine={fine} />
}

export function Conferma({ d, fine }: { d: Domanda; fine: (si: boolean, spuntata?: boolean) => void }) {
  const [spuntata, setSpuntata] = useState(d.spunta?.spuntata ?? true)
  const ref = useDialogo<HTMLDivElement>(() => fine(false, spuntata))
  const no = useRef<HTMLButtonElement>(null)
  // Dopo `useDialogo`, che mette il fuoco sul dialogo: si parte dalla risposta sicura.
  useEffect(() => no.current?.focus(), [])
  // La domanda è la prima frase che finisce col punto di domanda; il resto la spiega.
  const fino = d.testo.indexOf('?') + 1
  const [domanda, resto] = fino > 0 ? [d.testo.slice(0, fino), d.testo.slice(fino).trim()] : [d.testo, '']
  return (
    <>
      <button type="button" className="sg-velo sg-conferma-velo" tabIndex={-1} aria-label={d.no} onClick={() => fine(false)} />
      <div ref={ref} role="alertdialog" aria-modal="true" aria-labelledby="conferma-domanda" aria-describedby={resto ? 'conferma-resto' : undefined} tabIndex={-1} className="sg-dialogo sg-conferma">
        <p id="conferma-domanda" className="sg-conferma-domanda">
          {domanda}
        </p>
        {resto && (
          <p id="conferma-resto" className="sg-conferma-resto">
            {resto}
          </p>
        )}
        {d.spunta && (
          <div className="sg-conferma-spunta">
            <label className="modulo-privacy">
              <input type="checkbox" checked={spuntata} onChange={(e) => setSpuntata(e.target.checked)} aria-describedby="conferma-spunta-nota" />
              {d.spunta.testo}
            </label>
            <span id="conferma-spunta-nota" className="sg-conferma-spunta-nota">
              {d.spunta.nota(spuntata)}
            </span>
          </div>
        )}
        <div className="sg-conferma-tasti">
          <button ref={no} type="button" className={d.restare ? 'sg-btn sg-btn-pieno' : 'sg-btn sg-btn-linea'} onClick={() => fine(false, spuntata)}>
            {d.no}
          </button>
          <button type="button" className={d.pericolo ? 'sg-btn sg-btn-rosso' : d.restare ? 'sg-btn sg-btn-linea' : 'sg-btn sg-btn-pieno'} onClick={() => fine(true, spuntata)}>
            {d.spunta?.si?.(spuntata) ?? d.si}
          </button>
        </div>
      </div>
    </>
  )
}

/** Il messaggio d'errore di un'operazione, detto in chiaro. */
/** Un link-tasto alto quanto un dito (44 px), per le azioni sulle righe dei movimenti. */
export const DITO = { fontSize: 15, minHeight: 44, display: 'inline-flex', alignItems: 'center' } as const

export const messaggio = (e: unknown, altrimenti = 'Il server non risponde') => (e instanceof Error && e.message ? e.message : altrimenti)

/**
 * Carica qualcosa e lo ricarica a comando. `ricarica` non svuota quello che
 * si vede: dopo un salvataggio la schermata resta ferma e si aggiorna quando
 * arriva il dato nuovo, invece di lampeggiare.
 */
export function useCarica<T>(leggi: () => Promise<T>, dipende: unknown[]) {
  const [dato, setDato] = useState<T | null>(null)
  const [guaio, setGuaio] = useState<string | null>(null)
  const giro = useRef(0)
  // `dipende` fa da elenco delle dipendenze: `leggi` cambia a ogni giro.
  const f = useCallback(leggi, dipende)
  const ricarica = useCallback(async () => {
    const mio = ++giro.current
    try {
      const x = await f()
      if (mio === giro.current) {
        setDato(x)
        setGuaio(null)
      }
    } catch (e) {
      if (mio === giro.current) setGuaio(messaggio(e))
    }
  }, [f])
  useEffect(() => {
    setDato(null)
    void ricarica()
  }, [ricarica])
  return { dato, guaio, ricarica }
}

/** Un tasto sul fatto appena avvisato, per esempio RIAPRI dopo una chiusura. */
export interface AzioneAvviso {
  etichetta: string
  fa: () => unknown
}

// Il guaio con un tasto e la stampa sulla carta stanno in src/lib (cartaPdf.ts), con le loro prove.
export { GuaioConAzione, stampaSenzaCarta, suCarta } from '../../lib/cartaPdf'

/** Un avviso in basso a destra, che se ne va da solo: «Salvato», «Non si può». */
export function useAvviso() {
  const [testo, setTesto] = useState<{ t: string; guaio: boolean; azione?: AzioneAvviso } | null>(null)
  const [lavora, setLavora] = useState(false)
  const timer = useRef<number>()
  const durata = useRef(8000)
  useEffect(() => () => window.clearTimeout(timer.current), [])
  const avvisa = useCallback((t: string, guaio = false, azione?: AzioneAvviso) => {
    window.clearTimeout(timer.current)
    setTesto({ t, guaio, azione })
    // Un guaio resta finché non lo si chiude: al banco si risponde al
    // telefono e un errore sparito da solo è un errore mai letto. Il fatto
    // resta abbastanza da ritrovarlo, girati gli occhi; con un tasto da
    // toccare (RIAPRI) resta di più, perché serve proprio a chi si è distratto.
    durata.current = azione ? 15000 : 8000
    if (!guaio) timer.current = window.setTimeout(() => setTesto(null), durata.current)
  }, [])
  // Col mouse o il fuoco sopra un avviso con un tasto, non se ne va mentre lo si sta per toccare.
  const ferma = () => window.clearTimeout(timer.current)
  const riparti = () => {
    window.clearTimeout(timer.current)
    if (testo && !testo.guaio) timer.current = window.setTimeout(() => setTesto(null), durata.current)
  }
  const avviso = testo ? (
    <>
    {/* L'avviso sta fisso in basso: sotto il contenuto lascia il suo posto, così l'ultima riga di tasti si raggiunge. */}
    <div className="sg-avviso-posto" aria-hidden="true" />
    <div
      role={testo.guaio ? 'alert' : 'status'}
      className="sg-avviso"
      data-guaio={testo.guaio}
      onMouseEnter={testo.azione ? ferma : undefined}
      onMouseLeave={testo.azione ? riparti : undefined}
      onFocus={testo.azione ? ferma : undefined}
      onBlur={testo.azione ? riparti : undefined}
    >
      <span className="grow">{testo.t}</span>
      {testo.azione ? (
        <>
          <button type="button" className="sg-avviso-chiudi" disabled={lavora} onClick={testo.azione.fa}>
            {testo.azione.etichetta}
          </button>
          {/* Accanto a RIAPRI una parola come CHIUDI si confonde: qui basta il segno. */}
          <button type="button" className="sg-avviso-x" aria-label="Chiudi l’avviso" onClick={() => setTesto(null)}>
            <Icona nome="chiudi" />
          </button>
        </>
      ) : (
        <button type="button" className="sg-avviso-chiudi" onClick={() => setTesto(null)}>
          Chiudi
        </button>
      )}
    </div>
    </>
  ) : null
  // Un'operazione per volta: un doppio clic su SALVA, o un secondo mentre la
  // rete è lenta, non deve creare due corsi o due iscritti uguali.
  const inCorso = useRef(false)
  /** Esegue un'operazione, dice com'è andata, e ricarica se è andata. */
  const fai = useCallback(
    async (op: () => Promise<unknown>, riuscito?: string, poi?: () => unknown) => {
      if (inCorso.current) return false
      inCorso.current = true
      setLavora(true)
      try {
        await op()
        if (riuscito) avvisa(riuscito)
        await poi?.()
        return true
      } catch (e) {
        avvisa(messaggio(e), true, e instanceof GuaioConAzione ? e.azione : undefined)
        return false
      } finally {
        inCorso.current = false
        setLavora(false)
      }
    },
    [avvisa],
  )
  return { avviso, avvisa, fai, lavora }
}

export function Testa({ titolo, sotto, children }: { titolo: string; sotto: ReactNode; children?: ReactNode }) {
  return (
    <div className="sg-testa">
      <div className="stack grow" style={{ gap: 4, minWidth: 0 }}>
        {/* -1: il fuoco ci torna quando il tasto che lo aveva sparisce (BUTTA I CAMBI). */}
        <h1 className="ob sg-titolo" tabIndex={-1}>
          {titolo}
        </h1>
        <span className="sg-sotto">{sotto}</span>
      </div>
      <div className="sg-testa-azioni">{children}</div>
    </div>
  )
}

/**
 * Lo stato di una riga, uguale in ogni elenco: il pallino del colore e la parola, mai a capo. Prende il posto dei
 * badge pieni a maiuscolo spaziato, che in una lista lunga gridavano tutti insieme.
 */
export function SegnoStato({ tono, parola, title }: { tono: Tono | 'nota'; parola: string; title?: string }) {
  return (
    <span className="sg-segno-elenco" data-tono={tono} title={title ?? parola}>
      <span className="sg-segno-parola">{parola}</span>
    </span>
  )
}

/** Un campo con la sua etichetta; `manca` la fa rossa: è un dato da completare. */
export function Campo({ id, etichetta, children, largo, manca, nota }: { id?: string; etichetta: string; children: ReactNode; largo?: boolean; manca?: boolean; nota?: Nota }) {
  return (
    <div className="stack" style={{ gap: 6, gridColumn: largo ? 'span 2' : undefined, minWidth: 0 }}>
      {id ? (
        <label htmlFor={id} className="sg-etichetta" data-manca={manca || undefined}>
          {etichetta}
        </label>
      ) : (
        <span className="sg-etichetta" data-manca={manca || undefined}>
          {etichetta}
        </span>
      )}
      {children}
      {id && <NotaCampo id={`${id}-nota`} nota={nota} />}
    </div>
  )
}

/** Un riquadro di scheda: lo stato in grande (colorato dal tono), il dettaglio sotto, i tasti a destra. */
export function Stato({ nome, sotto, tono, finita, children }: { nome: string; sotto?: ReactNode; tono?: Tono; finita?: boolean; children?: ReactNode }) {
  return (
    <div className="sg-stato" data-tono={tono} data-finita={finita || undefined}>
      <span className="stack" style={{ gap: 2, minWidth: 0 }}>
        <span className="sg-stato-nome">{nome}</span>
        {sotto && <span className="sg-sotto" style={{ fontSize: 13 }}>{sotto}</span>}
      </span>
      {children && <span className="sg-stato-tasti">{children}</span>}
    </div>
  )
}

/** Una proposta del nucleo (il genitore, un fratello): cosa, perché, e il gesto che la fa. */
export function Proposta({ titolo, dettaglio, bordo, children }: { titolo: string; dettaglio: string; bordo: string; children?: ReactNode }) {
  return (
    <div className="row" style={{ gap: 12, padding: '12px 14px', border: bordo, borderRadius: 6, alignItems: 'center', flexWrap: 'wrap' }}>
      {/* Sul telefono il tasto va sotto, invece di schiacciare il testo. */}
      <span className="stack grow" style={{ gap: 2, minWidth: 200 }}>
        <span style={{ fontSize: 15, fontWeight: 600 }}>{titolo}</span>
        <span style={{ fontSize: 13, color: 'var(--sec)' }}>{dettaglio}</span>
      </span>
      {children}
    </div>
  )
}

export function Riga({ titolo, icona, children }: { titolo: string; icona?: ReactNode; children?: ReactNode }) {
  return (
    <div className="sg-riga-titolo">
      {/* Un titolo vero: chi legge lo schermo salta da una parte all'altra della scheda. */}
      <h2 className="sg-etichetta" style={{ margin: 0, fontSize: 14, letterSpacing: '0.22em', ...(icona ? { display: 'inline-flex', alignItems: 'center', gap: 8 } : {}) }}>
        {icona}
        {titolo}
      </h2>
      <div className="rule-line" />
      {children}
    </div>
  )
}

/** Una cosa che non si è letta. Con `titolo`, il guaio in una riga sopra la frase che dice cosa fare (IL SITO di STATISTICHE). */
export function Guaio({ testo, titolo }: { testo: string; titolo?: string }) {
  return (
    <div className="card stack" style={{ padding: 14, gap: 6, borderColor: 'var(--rosso)' }}>
      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.2em', color: 'var(--rosso-testo)' }}>NON LETTO</span>
      {titolo && <span style={{ fontSize: 16, fontWeight: 700 }}>{titolo}</span>}
      <span style={{ fontSize: 14, color: 'var(--dim)' }}>{testo}</span>
    </div>
  )
}

/**
 * Le colonne di STATISTICHE, mese per mese (Statistiche.tsx e StatisticheSito.tsx).
 */
export interface Colonna {
  chiave: string
  etichetta: string
  valore: number
  dettaglio: string[]
}

/** Un numero più tondo sopra il massimo, per la scala: 0, metà, tutto. */
function tetto(x: number) {
  if (x <= 0) return 1
  // Con pochi (le prove, un corso piccolo) un numero pari: la metà resta una persona intera.
  if (x <= 10) return Math.max(2, Math.ceil(x / 2) * 2)
  const p = 10 ** Math.floor(Math.log10(x))
  return ([1, 2, 2.5, 5, 10].map((k) => k * p).find((k) => k >= x) ?? 10 * p)
}

/**
 * Le colonne di un valore solo, mese per mese: una tinta sola, la scala a
 * sinistra, il numero esatto sotto il dito o il mouse. Il mese in corso non è
 * finito, e si vede: è tratteggiato.
 */
export function Colonne({ nome, colonne, formato = (n: number) => n.toLocaleString('it-IT') }: { nome: string; colonne: Colonna[]; formato?: (n: number) => string }) {
  const [sopra, setSopra] = useState<string | null>(null)
  const max = tetto(Math.max(0, ...colonne.map((c) => c.valore)))
  if (colonne.every((c) => c.valore === 0)) return <span className="sg-sotto">Niente da contare in questo periodo.</span>
  return (
    <div className="sg-colonne" role="group" aria-label={nome}>
      <div className="sg-colonne-scala num" aria-hidden="true">
        <span>{formato(max)}</span>
        <span>{formato(max / 2)}</span>
        <span>0</span>
      </div>
      <div className="sg-colonne-piano" style={{ gridTemplateColumns: `repeat(${colonne.length}, minmax(0, 1fr))` }}>
        {colonne.map((c, i) => (
          <button
            key={c.chiave}
            type="button"
            className="sg-colonna"
            aria-label={c.dettaglio.join(', ')}
            data-in-corso={i === colonne.length - 1}
            onMouseEnter={() => setSopra(c.chiave)}
            onMouseLeave={() => setSopra(null)}
            onFocus={() => setSopra(c.chiave)}
            onBlur={() => setSopra(null)}
          >
            <span className="sg-colonna-binario">
              {c.valore > 0 && <span className="sg-colonna-pieno" style={{ height: `${(100 * c.valore) / max}%` }} />}
              {sopra === c.chiave && (
                <span className="sg-colonna-suggerimento" role="tooltip" data-lato={i >= colonne.length / 2 ? 'destra' : 'sinistra'}>
                  {c.dettaglio.map((t, k) => (
                    <span key={k} style={k === 0 ? { fontWeight: 700 } : undefined}>
                      {t}
                    </span>
                  ))}
                </span>
              )}
            </span>
            <span className="sg-colonna-etichetta num">{c.etichetta.toUpperCase()}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

/**
 * La spiegazione lunga di un riquadro, chiusa: si legge una volta, mentre i
 * numeri e gli avvisi servono ogni volta e restano fuori.
 */
export function ComeFunziona({ children }: { children: ReactNode }) {
  return (
    <details className="sg-spiega">
      <summary>COME FUNZIONA?</summary>
      <div className="sg-spiega-testo">{children}</div>
    </details>
  )
}


export { dataLunga }

/**
 * Il dettaglio di una pagina (una richiesta, un corso, un iscritto, un ordine)
 * in una finestra sopra l'elenco. L'elenco resta dov'era, con filtri, ricerca e
 * ordine; il menu resta fuori dal velo, coi suoi numeri. Si chiude con ✕ o Esc
 * (`onTorna`, che chiede se c'è qualcosa non salvato) e con un clic sul velo,
 * ma solo se non c'è niente da perdere (`clicFuoriChiude`). Scorre il corpo; la
 * testa resta. `passaggio` aggiunge PRECEDENTE e SUCCESSIVA, per scorrere
 * l'elenco senza chiudere.
 *
 * `cornice={false}` per una scheda che ha già la sua (quella dei corsi).
 */
export function SchedaPiena({
  etichetta,
  torna,
  onTorna,
  tinta,
  cornice = true,
  passaggio,
  children,
}: {
  etichetta: string
  /** La pagina a cui si torna: la dice chi legge lo schermo, il tasto è ✕. */
  torna: string
  onTorna: () => void
  tinta?: string
  cornice?: boolean
  passaggio?: { posizione: string | null; onPrecedente?: () => void; onSuccessiva?: () => void }
  children: ReactNode
}) {
  const radice = useRef<HTMLDivElement>(null)
  const finestra = useDialogo<HTMLDivElement>(onTorna)
  // Il velo e la finestra coprono il corpo, non il menu: dietro la finestra il corpo non scorre.
  useLayoutEffect(() => {
    const corpo = radice.current?.closest<HTMLElement>('.sg-corpo')
    if (!corpo || !radice.current) return
    const radiceEl = radice.current
    const misura = () => radiceEl.style.setProperty('--sg-finestra-sx', `${corpo.getBoundingClientRect().left}px`)
    misura()
    window.addEventListener('resize', misura)
    const prima = corpo.style.overflowY
    corpo.style.overflowY = 'hidden'
    return () => {
      window.removeEventListener('resize', misura)
      corpo.style.overflowY = prima
    }
  }, [])
  return (
    <div ref={radice} className="sg-finestra-radice">
      <button type="button" className="sg-velo sg-finestra-velo" tabIndex={-1} aria-label="Chiudi" onClick={() => clicFuoriChiude(bozzaAperta()) && onTorna()} />
      <div
        ref={finestra}
        role="dialog"
        aria-modal="true"
        aria-label={etichetta}
        tabIndex={-1}
        className="sg-finestra"
        style={tinta ? { ['--tinta' as string]: tinta } : undefined}
      >
        <div className="sg-finestra-testa">
          {passaggio && (
            <>
              <button type="button" className="sg-btn sg-btn-linea" aria-label="Precedente" disabled={!passaggio.onPrecedente} onClick={passaggio.onPrecedente}>
                ‹<span className="sg-finestra-nome"> Precedente</span>
              </button>
              {passaggio.posizione && (
                <span className="num sg-finestra-posizione" aria-live="polite">
                  {passaggio.posizione}
                </span>
              )}
              <button type="button" className="sg-btn sg-btn-linea" aria-label="Successiva" disabled={!passaggio.onSuccessiva} onClick={passaggio.onSuccessiva}>
                <span className="sg-finestra-nome">Successiva </span>›
              </button>
            </>
          )}
          <span className="grow" />
          <button type="button" className="icon-btn" aria-label={`Chiudi e torna a ${torna}`} onClick={onTorna}>
            <span aria-hidden="true">✕</span>
          </button>
        </div>
        <div className="sg-finestra-corpo">
          {cornice ? (
            <section aria-label={etichetta} className="sg-scheda sg-scheda-piena">
              {children}
            </section>
          ) : (
            children
          )}
        </div>
      </div>
    </div>
  )
}

/** L'icona davanti al nome di una colonna, nelle tabelle lunghe: sul telefono si toglie, le colonne sono strette. */
const IconaTesta = ({ nome }: { nome: NomeIcona }) => (
  <span className="sg-testa-icona">
    <Icona nome={nome} misura={14} />
  </span>
)

/** L'intestazione di una colonna che non ordina, con la sua icona. */
export function TestaColonna({ icona, destra, children }: { icona: NomeIcona; destra?: boolean; children: ReactNode }) {
  return (
    <span role="columnheader" className="sg-etichetta sg-testa-colonna" style={destra ? { justifyContent: 'flex-end' } : undefined}>
      <IconaTesta nome={icona} />
      {children}
    </span>
  )
}

type Ordine<K extends string> = { per: K; verso: 1 | -1 }
/** Dove una tabella tiene il suo ordine fra una visita e l'altra. */
export type MemoriaOrdine<K extends string> = { ordine: Ordine<K> | null }

/**
 * Una tabella che si ordina toccando l'intestazione di una colonna. Il primo
 * tocco mette le parole dalla A alla Z e i numeri dal più grande, il secondo
 * rovescia, il terzo torna all'ordine di partenza della tabella. Chi non ha il
 * valore (un «—») sta sempre in fondo, in qualunque verso.
 *
 * `colonne` dice, per ogni colonna ordinabile, il valore da confrontare: un
 * numero o un testo, non quello che si vede («12/20», «3 febbraio»).
 */
export function useOrdina<T, K extends string>(colonne: Record<K, (x: T) => Valore>, memoria?: MemoriaOrdine<K>) {
  const [ordine, setOrdineGiu] = useState<Ordine<K> | null>(memoria?.ordine ?? null)
  // Chi la passa ritrova l'ordine dopo essere uscito e tornato (un corso aperto, un iscritto, e Indietro).
  const setOrdine = (f: (o: Ordine<K> | null) => Ordine<K> | null) =>
    setOrdineGiu((o) => {
      const nuovo = f(o)
      if (memoria) memoria.ordine = nuovo
      return nuovo
    })

  const ordina = (righe: T[]): T[] => {
    // La colonna scelta può non esserci più: un'ora che nel periodo nuovo non ha lezioni.
    const val = ordine && colonne[ordine.per]
    if (!ordine || !val) return righe
    return righe
      .map((x) => [x, val(x)] as const)
      .sort(([, a], [, b]) => {
        const vuotoA = a === null || a === undefined || a === ''
        const vuotoB = b === null || b === undefined || b === ''
        if (vuotoA || vuotoB) return vuotoA === vuotoB ? 0 : vuotoA ? 1 : -1
        const c = typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b), 'it', { numeric: true, sensitivity: 'base' })
        return c * ordine.verso
      })
      .map(([x]) => x)
  }

  const tocca = (per: K, primo: 1 | -1) =>
    setOrdine((o) => (!o || o.per !== per ? { per, verso: primo } : o.verso === primo ? { per, verso: -primo as 1 | -1 } : null))

  /**
   * L'intestazione di una colonna, da chiamare come funzione (non come
   * componente: rimontato a ogni giro, il tasto perderebbe il fuoco).
   * `numeri` la fa partire dal più grande; `th` la fa cella di una `<table>`;
   * `destra` l'allinea a destra, come i numeri sotto; `riga` ne fa
   * l'intestazione di una riga, che ordina le colonne di una griglia;
   * `icona` la mette davanti alla parola, nelle tabelle lunghe.
   */
  const colonna = (
    per: K,
    etichetta: ReactNode,
    { numeri, th, destra, riga, icona, className = 'sg-etichetta' }: { numeri?: boolean; th?: boolean; destra?: boolean; riga?: boolean; icona?: NomeIcona; className?: string } = {},
  ) => {
    const verso = ordine?.per === per ? ordine.verso : 0
    const tasto = (
      <button type="button" className="sg-ordina" data-verso={verso || undefined} onClick={() => tocca(per, numeri ? -1 : 1)}>
        {icona && <IconaTesta nome={icona} />}
        {etichetta}
        <span className="sg-ordina-segno">
          <Icona nome={iconaVerso(verso)} misura={14} />
        </span>
      </button>
    )
    const ariaSort = verso === 1 ? 'ascending' : verso === -1 ? 'descending' : undefined
    return th ? (
      <th key={per} scope={riga ? 'row' : 'col'} className={className} style={destra ? { textAlign: 'right' } : undefined} aria-sort={ariaSort}>
        {tasto}
      </th>
    ) : (
      // In una colonna stretta il tasto sborda a sinistra, sopra lo spazio fra le colonne, e non va a capo.
      <span key={per} role="columnheader" className={className} style={destra ? { display: 'flex', justifyContent: 'flex-end' } : undefined} aria-sort={ariaSort}>
        {tasto}
      </span>
    )
  }

  return { ordina, colonna }
}

/** Il foglio CSV scaricato dal browser, col BOM perché Excel legga gli accenti (PRESENZE, PAGAMENTI, CONTABILITÀ). */
export function scaricaCsv(nome: string, testo: string) {
  const url = URL.createObjectURL(new Blob(['\ufeff' + testo], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = nome
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * Una scelta fra poche voci che si escludono (il periodo, la vista): tasti
 * attaccati, quello scelto pieno col ✓. Un gruppo di `aria-pressed` e non
 * dei tab: la scelta cambia l'elenco sotto, non apre un pannello.
 */
export function Segmenti<T extends string>({ etichetta, voci, scelta, onScegli }: { etichetta: string; voci: readonly (readonly [T, string])[]; scelta: T; onScegli: (v: T) => void }) {
  return (
    <div role="group" aria-label={etichetta} className="sg-segmenti">
      {voci.map(([v, testo]) => (
        <button key={v} type="button" aria-pressed={v === scelta} onClick={() => onScegli(v)}>
          {testo}
        </button>
      ))}
    </div>
  )
}

/**
 * Una scelta fra tante (la cassa, la voce): un tasto che dice il filtro e il
 * valore, sopra un `<select>` vero e trasparente, così tastiera, lettore di
 * schermo e telefono hanno il menu loro. Acceso, ha la ✕ per spegnerlo.
 * Il primo valore delle opzioni è «tutti», il filtro spento.
 */
export function FiltroMenu({ id, nome, value, opzioni, onChange }: { id: string; nome: string; value: string; opzioni: readonly (readonly [string, string])[]; onChange: (v: string) => void }) {
  const spento = opzioni[0]?.[0] ?? ''
  const acceso = value !== spento
  const testo = opzioni.find(([v]) => v === value)?.[1] ?? value
  return (
    <span className="sg-filtro-menu" data-acceso={acceso}>
      <span className="sg-filtro-menu-tasto">
        <label htmlFor={id}>{nome}</label>
        <span aria-hidden="true" className="sg-filtro-menu-valore">{testo}</span>
        <span aria-hidden="true">▾</span>
        <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
          {opzioni.map(([v, t]) => (
            <option key={v} value={v}>
              {t}
            </option>
          ))}
        </select>
      </span>
      {acceso && (
        <button type="button" className="sg-filtro-menu-togli" aria-label={`Togli il filtro ${nome}`} onClick={() => onChange(spento)}>
          ✕
        </button>
      )}
    </span>
  )
}

/**
 * Le azioni secondarie di una schermata in un menu solo («Altre azioni ▾»). Si chiude con un clic su una voce,
 * fuori dal menu o con Esc.
 */
export function MenuAzioni({ etichetta, children }: { etichetta: string; children: ReactNode }) {
  const dettagli = useRef<HTMLDetailsElement>(null)
  useEffect(() => {
    const chiudi = () => { if (dettagli.current) dettagli.current.open = false }
    const clic = (e: MouseEvent) => {
      const d = dettagli.current
      if (!d?.open || !(e.target instanceof Element)) return
      // Fuori dal menu, o su una voce (anche una portata da un altro componente): si chiude.
      if (!d.contains(e.target) || e.target.closest('[role="menuitem"]')) chiudi()
    }
    // L'Esc si ferma qui: dentro una scheda (useDialogo, su window) chiuderebbe anche la scheda.
    const tasto = (e: KeyboardEvent) => { if (e.key === 'Escape' && dettagli.current?.open) { e.stopPropagation(); chiudi(); dettagli.current.querySelector('summary')?.focus() } }
    document.addEventListener('click', clic)
    document.addEventListener('keydown', tasto)
    return () => { document.removeEventListener('click', clic); document.removeEventListener('keydown', tasto) }
  }, [])
  return (
    <details ref={dettagli} className="sg-menu-azioni" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) e.currentTarget.open = false }}>
      <summary className="sg-btn sg-btn-linea">{etichetta} <span aria-hidden="true">▾</span></summary>
      <div className="sg-menu-azioni-lista" role="menu">{children}</div>
    </details>
  )
}
