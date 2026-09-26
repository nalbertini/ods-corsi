import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { DatiTablet, LezioneSala } from '../../lib/tablet'
import { oraDi } from '../../lib/sala'
import { Back } from '../Icons'

/** «17:00–18:00». */
export const orario = (l: Pick<LezioneSala, 'inizio' | 'fine'>) => `${oraDi(l.inizio)}–${oraDi(l.fine)}`

/** Mezzanotte del giorno di una data, spostata di qualche giorno. */
export function giornoDopo(d: Date, giorni: number): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  x.setDate(x.getDate() + giorni)
  return x
}

/**
 * L'ora del tablet, che avanza da sola. Ogni quindici secondi basta: le
 * finestre si aprono e si chiudono sul minuto, e l'orologio in alto non ha i
 * secondi.
 */
export function useAdesso(d: DatiTablet): Date {
  const [t, setT] = useState(() => d.adesso())
  useEffect(() => {
    const i = window.setInterval(() => setT(d.adesso()), 15_000)
    return () => window.clearInterval(i)
  }, [d])
  return t
}

/**
 * Chiama `fatto` dopo `ms` senza tocchi. Il tablet sta appeso al muro: chi
 * si allontana a metà elenco non torna indietro a chiuderlo, e il prossimo
 * che arriva deve trovare la schermata di sempre.
 */
export function useInattivo(ms: number, fatto: () => void) {
  const ultimo = useRef(fatto)
  ultimo.current = fatto
  useEffect(() => {
    let t = window.setTimeout(() => ultimo.current(), ms)
    const tocco = () => {
      window.clearTimeout(t)
      t = window.setTimeout(() => ultimo.current(), ms)
    }
    window.addEventListener('pointerdown', tocco)
    window.addEventListener('keydown', tocco)
    return () => {
      window.clearTimeout(t)
      window.removeEventListener('pointerdown', tocco)
      window.removeEventListener('keydown', tocco)
    }
  }, [ms])
}

/** Lo schermo del tablet non si spegne: è un calendario appeso al muro. */
export function useSchermoAcceso() {
  useEffect(() => {
    type Blocco = { release(): Promise<void> }
    const wl = (navigator as Navigator & { wakeLock?: { request(t: 'screen'): Promise<Blocco> } }).wakeLock
    if (!wl) return
    let blocco: Blocco | null = null
    const chiedi = () => {
      if (document.visibilityState === 'visible') void wl.request('screen').then((b) => (blocco = b)).catch(() => {})
    }
    chiedi()
    // Il blocco cade da solo quando la pagina va in secondo piano.
    document.addEventListener('visibilitychange', chiedi)
    return () => {
      document.removeEventListener('visibilitychange', chiedi)
      void blocco?.release().catch(() => {})
    }
  }, [])
}

export function Indietro({ onClick, testo = 'INDIETRO' }: { onClick: () => void; testo?: string }) {
  return (
    <button type="button" className="tb-btn tb-btn-linea" onClick={onClick}>
      <Back size={20} />
      {testo}
    </button>
  )
}

export function Riquadro({ titolo, children }: { titolo: string; children?: ReactNode }) {
  return (
    <div className="tb-riquadro">
      <span className="ob tb-riquadro-titolo">{titolo}</span>
      {children && <span className="tb-riquadro-testo">{children}</span>}
    </div>
  )
}

/** Un errore del server, detto in chiaro. */
export function Guaio({ titolo, testo }: { titolo: string; testo: string }) {
  return (
    <div className="tb-riquadro" style={{ borderColor: 'var(--rosso)' }}>
      <span className="tb-etichetta" style={{ color: 'var(--rosso)' }}>{titolo}</span>
      <span className="tb-riquadro-testo">{testo}</span>
    </div>
  )
}

export const messaggio = (e: unknown, altrimenti: string) => (e instanceof Error && e.message ? e.message : altrimenti)
