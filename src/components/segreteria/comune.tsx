import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'

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
  /** Esegue un'operazione, dice com'è andata, e ricarica se è andata. */
  const fai = useCallback(
    async (op: () => Promise<unknown>, riuscito?: string, poi?: () => unknown) => {
      try {
        await op()
        if (riuscito) avvisa(riuscito)
        await poi?.()
        return true
      } catch (e) {
        avvisa(messaggio(e), true)
        return false
      }
    },
    [avvisa],
  )
  return { avviso, avvisa, fai }
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

export function Campo({ id, etichetta, children, largo }: { id?: string; etichetta: string; children: ReactNode; largo?: boolean }) {
  return (
    <div className="stack" style={{ gap: 6, gridColumn: largo ? 'span 2' : undefined, minWidth: 0 }}>
      {id ? (
        <label htmlFor={id} className="sg-etichetta">
          {etichetta}
        </label>
      ) : (
        <span className="sg-etichetta">{etichetta}</span>
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
