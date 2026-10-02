import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Back } from '../Icons'

type Valore = string | number | null | undefined

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

/** Un avviso in basso a destra, che se ne va da solo: «Salvato», «Non si può». */
export function useAvviso() {
  const [testo, setTesto] = useState<{ t: string; guaio: boolean } | null>(null)
  const timer = useRef<number>()
  useEffect(() => () => window.clearTimeout(timer.current), [])
  const avvisa = useCallback((t: string, guaio = false) => {
    window.clearTimeout(timer.current)
    setTesto({ t, guaio })
    timer.current = window.setTimeout(() => setTesto(null), guaio ? 6000 : 3000)
  }, [])
  const avviso = testo ? (
    <div role="status" className="sg-avviso" data-guaio={testo.guaio}>
      {testo.t}
    </div>
  ) : null
  // Un'operazione per volta: un doppio clic su SALVA, o un secondo mentre la
  // rete è lenta, non deve creare due corsi o due iscritti uguali.
  const inCorso = useRef(false)
  const [lavora, setLavora] = useState(false)
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
      <span className="sg-etichetta" style={{ fontSize: 14, letterSpacing: '0.22em' }}>
        {titolo}
      </span>
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
 */
export function SchedaPiena({ etichetta, torna, onTorna, tinta, children }: { etichetta: string; torna: string; onTorna: () => void; tinta?: string; children: ReactNode }) {
  const cima = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const corpo = cima.current?.closest('.sg-corpo')
    if (!corpo) return
    const dovEra = corpo.scrollTop
    corpo.scrollTop = 0
    // Dopo il commit: prima l'elenco torna visibile, poi la pagina scende dov'era.
    return () => queueMicrotask(() => void (corpo.scrollTop = dovEra))
  }, [])
  return (
    <div ref={cima} className="stack" style={{ gap: 16 }}>
      <button type="button" className="sg-btn sg-btn-linea sg-torna" onClick={onTorna}>
        <Back size={18} />
        {torna}
      </button>
      <section aria-label={etichetta} className="sg-scheda sg-scheda-piena" style={tinta ? { ['--tinta' as string]: tinta } : undefined}>
        {children}
      </section>
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
    if (!ordine) return righe
    const val = colonne[ordine.per]
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
   * `destra` l'allinea a destra, come i numeri sotto.
   */
  const colonna = (per: K, etichetta: ReactNode, { numeri, th, destra, className = 'sg-etichetta' }: { numeri?: boolean; th?: boolean; destra?: boolean; className?: string } = {}) => {
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
      <th key={per} scope="col" className={className} aria-sort={ariaSort}>
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
