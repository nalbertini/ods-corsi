import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Back } from '../Icons'

type Valore = string | number | null | undefined

/**
 * Un cassetto o un dialogo sopra la pagina: aperto, il fuoco ci entra e non
 * scappa dietro il velo con TAB; ESC lo chiude; chiuso, il fuoco torna dove
 * era. Va su un elemento con `role="dialog"` e `tabIndex={-1}`.
 */
// I dialoghi aperti, dall'ultimo: ESC e TAB sono di quello in cima (una
// conferma sopra il cassetto della lezione chiude la conferma, non il cassetto).
const pila: object[] = []

export function useDialogo<T extends HTMLElement>(onChiudi: () => void) {
  const ref = useRef<T>(null)
  const chiudi = useRef(onChiudi)
  chiudi.current = onChiudi
  useEffect(() => {
    const io = {}
    pila.push(io)
    const prima = document.activeElement as HTMLElement | null
    ref.current?.focus()
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

// Quello che si sta scrivendo e non è ancora salvato (vedi `useBozza`).
const bozze = new Set<object>()

/**
 * Finché `aperta`, c'è qualcosa scritto a metà: cambiando voce del menu la
 * segreteria chiede prima di perderlo (`bozzaAperta`), e chiudendo la pagina
 * lo chiede il browser. Al banco squilla il telefono, e un clic altrove non
 * deve buttare una ricevuta compilata.
 */
export function useBozza(aperta: boolean) {
  useEffect(() => {
    if (!aperta) return
    const io = {}
    bozze.add(io)
    const via = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', via)
    return () => {
      bozze.delete(io)
      window.removeEventListener('beforeunload', via)
    }
  }, [aperta])
}

export const bozzaAperta = () => bozze.size > 0

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

interface Domanda {
  testo: string
  si: string
  no: string
  pericolo: boolean
  risposta: (si: boolean) => void
}
let mostra: ((d: Domanda) => void) | null = null

/**
 * Chiede conferma prima di un'azione, col verbo sui tasti: «SÌ, ANNULLA LA
 * RICEVUTA» e «NO, LASCIA STARE», non OK e Annulla, che su «Annullare la
 * ricevuta?» dicevano il contrario. Il fuoco parte dal no; ESC è no.
 * `pericolo`: quello che non si annulla, col tasto rosso. Serve `<Conferme />`
 * nella pagina (la segreteria lo mette); senza, si chiede al browser.
 */
export function chiedi(testo: string, si: string, o: { no?: string; pericolo?: boolean } = {}): Promise<boolean> {
  return new Promise((risposta) => {
    if (!mostra) return risposta(window.confirm(testo))
    mostra({ testo, si, no: o.no ?? 'NO, LASCIA STARE', pericolo: !!o.pericolo, risposta })
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
  const fine = (si: boolean) => {
    setD(null)
    d.risposta(si)
  }
  return <Conferma d={d} fine={fine} />
}

function Conferma({ d, fine }: { d: Domanda; fine: (si: boolean) => void }) {
  const ref = useDialogo<HTMLDivElement>(() => fine(false))
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
        <div className="sg-conferma-tasti">
          <button ref={no} type="button" className="sg-btn sg-btn-linea" onClick={() => fine(false)}>
            {d.no}
          </button>
          <button type="button" className={d.pericolo ? 'sg-btn sg-btn-rosso' : 'sg-btn sg-btn-pieno'} onClick={() => fine(true)}>
            {d.si}
          </button>
        </div>
      </div>
    </>
  )
}

/** Il messaggio d'errore di un'operazione, detto in chiaro. */
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
            <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square" />
            </svg>
          </button>
        </>
      ) : (
        <button type="button" className="sg-avviso-chiudi" onClick={() => setTesto(null)}>
          CHIUDI
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
        avvisa(messaggio(e), true)
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
        <h1 className="ob sg-titolo">{titolo}</h1>
        <span className="sg-sotto">{sotto}</span>
      </div>
      {children}
    </div>
  )
}

/** Un campo con la sua etichetta; `manca` la fa rossa: è un dato da completare. */
export function Campo({ id, etichetta, children, largo, manca }: { id?: string; etichetta: string; children: ReactNode; largo?: boolean; manca?: boolean }) {
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
    </div>
  )
}

export function Riga({ titolo, children }: { titolo: string; children?: ReactNode }) {
  return (
    <div className="sg-riga-titolo">
      {/* Un titolo vero: chi legge lo schermo salta da una parte all'altra della scheda. */}
      <h3 className="sg-etichetta" style={{ margin: 0, fontSize: 14, letterSpacing: '0.22em' }}>
        {titolo}
      </h3>
      <div className="rule-line" />
      {children}
    </div>
  )
}

export function Guaio({ testo }: { testo: string }) {
  return (
    <div className="card stack" style={{ padding: 14, gap: 6, borderColor: 'var(--rosso)' }}>
      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.2em', color: 'var(--rosso)' }}>NON LETTO</span>
      <span style={{ fontSize: 14, color: 'var(--dim)' }}>{testo}</span>
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

const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre']

/** «12 gennaio 2026», da una data `AAAA-MM-GG`. */
export function dataLunga(g: string, anno = true) {
  const [a, m, d] = g.split('-').map(Number)
  return `${d} ${MESI[m - 1]}${anno ? ` ${a}` : ''}`
}

/**
 * Una scheda a pieno schermo: prende tutta la sezione al posto dell'elenco,
 * invece di stargli accanto. L'elenco sotto resta montato ma nascosto, con i
 * filtri e la ricerca di prima; tornando, la pagina torna dov'era.
 *
 * `cornice={false}` per una scheda che ha già la sua (quella dei corsi).
 */
export function SchedaPiena({
  etichetta,
  torna,
  onTorna,
  tinta,
  cornice = true,
  children,
}: {
  etichetta: string
  torna: string
  onTorna: () => void
  tinta?: string
  cornice?: boolean
  children: ReactNode
}) {
  const cima = useRef<HTMLDivElement>(null)
  const dovEra = useRef<number | null>(null)
  const montata = useRef(false)
  useLayoutEffect(() => {
    const corpo = cima.current?.closest('.sg-corpo')
    if (!corpo) return
    // Lo StrictMode di sviluppo monta due volte: conta la prima posizione, e
    // il ritorno parte solo se la scheda è chiusa davvero.
    dovEra.current ??= corpo.scrollTop
    montata.current = true
    corpo.scrollTop = 0
    return () => {
      montata.current = false
      // Dopo il commit: prima l'elenco torna visibile, poi la pagina scende dov'era.
      queueMicrotask(() => {
        if (!montata.current) corpo.scrollTop = dovEra.current ?? 0
      })
    }
  }, [])
  return (
    <div ref={cima} className="stack" style={{ gap: 16 }}>
      <button type="button" className="sg-btn sg-btn-linea sg-torna" onClick={onTorna}>
        <Back size={18} />
        {torna}
      </button>
      {cornice ? (
        <section aria-label={etichetta} className="sg-scheda sg-scheda-piena" style={tinta ? { ['--tinta' as string]: tinta } : undefined}>
          {children}
        </section>
      ) : (
        children
      )}
    </div>
  )
}

/**
 * Una tabella che si ordina toccando l'intestazione di una colonna. Il primo
 * tocco mette le parole dalla A alla Z e i numeri dal più grande, il secondo
 * rovescia, il terzo torna all'ordine di partenza della tabella. Chi non ha il
 * valore (un «—») sta sempre in fondo, in qualunque verso.
 *
 * `colonne` dice, per ogni colonna ordinabile, il valore da confrontare: un
 * numero o un testo, non quello che si vede («12/20», «3 febbraio»).
 */
export function useOrdina<T, K extends string>(colonne: Record<K, (x: T) => Valore>) {
  const [ordine, setOrdine] = useState<{ per: K; verso: 1 | -1 } | null>(null)

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
   * l'intestazione di una riga, che ordina le colonne di una griglia.
   */
  const colonna = (
    per: K,
    etichetta: ReactNode,
    { numeri, th, destra, riga, className = 'sg-etichetta' }: { numeri?: boolean; th?: boolean; destra?: boolean; riga?: boolean; className?: string } = {},
  ) => {
    const verso = ordine?.per === per ? ordine.verso : 0
    const tasto = (
      <button type="button" className="sg-ordina" data-verso={verso || undefined} onClick={() => tocca(per, numeri ? -1 : 1)}>
        {etichetta}
        <span className="sg-ordina-segno" aria-hidden="true">
          {verso === 1 ? '▲' : verso === -1 ? '▼' : '↕'}
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
