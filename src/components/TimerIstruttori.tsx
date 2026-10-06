import { lazy, Suspense, useEffect, useState } from 'react'
import type { Incorporato, StatoTimer } from '../../timer/src/lib/incorporato'
import { avvisoSenzaRete, statoStriscia, type PaginaIstruttori } from '../lib/timerIstruttori'
import { Back } from './Icons'

/**
 * Il timer dentro l'app degli istruttori: la navigazione, la striscia
 * dell'allenamento in corso e la pagina TIMER. Le regole stanno in
 * `lib/timerIstruttori.ts`; qui si mostra e si chiama.
 */

/** Il timer pesa quanto il resto dell'app: si scarica solo alla prima visita. */
const TimerSala = lazy(() => import('./tablet/TimerSala').then((m) => ({ default: m.TimerSala })))

/** Le icone a linea delle voci, come nel design (BarraNavigazione). */
const ICONE: Record<PaginaIstruttori, string[]> = {
  calendario: ['M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z', 'M4 10h16', 'M8 3v4M16 3v4'],
  timer: ['M4 13a8 8 0 1 0 16 0a8 8 0 1 0-16 0', 'M12 9v4l2.5 2', 'M9.5 2.5h5M12 2.5V5'],
  mieiTimer: ['M7 3h10a1 1 0 0 1 1 1v17l-6-4-6 4V4a1 1 0 0 1 1-1z'],
  ore: ['M6 3h12a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z', 'M9 8h6M9 12h6', 'M9 16h3'],
}

/**
 * La barra in basso del telefono. La voce di dove si è si legge anche senza
 * colore: la barra alta sopra, il fondo e il testo pieno.
 */
export function BarraNavigazione({
  voci,
  attiva,
  onPagina,
}: {
  voci: { pagina: PaginaIstruttori; nome: string }[]
  attiva: PaginaIstruttori
  onPagina: (p: PaginaIstruttori) => void
}) {
  return (
    <nav className="barra-nav" aria-label="Pagine">
      {voci.map((v) => (
        <button key={v.pagina} type="button" className="barra-voce" aria-current={attiva === v.pagina ? 'page' : undefined} onClick={() => onPagina(v.pagina)}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {ICONE[v.pagina].map((d) => (
              <path key={d} d={d} />
            ))}
          </svg>
          <span className="num">{v.nome}</span>
        </button>
      ))}
    </nav>
  )
}

/**
 * L'allenamento in corso, da ogni pagina tranne il timer. Il tempo si ricalcola
 * dall'orologio a ogni giro: una scheda rimasta in secondo piano lo mostra giusto.
 * Toccarla riporta al timer; STOP (OK a fine allenamento) lo ferma senza aprirlo.
 */
export function StrisciaTimer({ stato, onApri, onFerma }: { stato: StatoTimer; onApri: () => void; onFerma: () => void }) {
  const [ora, setOra] = useState(() => Date.now())
  useEffect(() => {
    const i = window.setInterval(() => setOra(Date.now()), 500)
    return () => window.clearInterval(i)
  }, [])
  const s = statoStriscia(stato, ora)
  const finito = stato.status === 'done'
  // In pausa il colore dell'intervallo lascia il posto al grigio, come nel design.
  const colori = stato.status === 'paused' ? { background: 'var(--surface-2)', borderColor: 'var(--line)', color: 'var(--text)' } : { background: s.colore, borderColor: s.colore, color: 'var(--su-colore)' }
  return (
    <div className="striscia-timer" style={colori}>
      <button type="button" className="striscia-apri" onClick={onApri} aria-label={`Torna al timer: ${s.testo} ${s.tempo}`}>
        <span className="stack" style={{ gap: 2, minWidth: 0 }}>
          <span className="ob striscia-testo">{s.testo}</span>
          <span className="striscia-nome">{finito ? 'Tocca per tornare al timer' : stato.nome}</span>
        </span>
        <span className="grow" />
        <span className="num striscia-tempo">{s.tempo}</span>
      </button>
      <button type="button" className="striscia-stop" onClick={onFerma}>
        {finito ? 'OK' : 'STOP'}
      </button>
    </div>
  )
}

/** Se c'è rete: l'avviso di SENZA RETE compare e sparisce da solo. */
function useOnline(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine)
  useEffect(() => {
    const su = () => setOnline(true)
    const giu = () => setOnline(false)
    window.addEventListener('online', su)
    window.addEventListener('offline', giu)
    return () => {
      window.removeEventListener('online', su)
      window.removeEventListener('offline', giu)
    }
  }, [])
  return online
}

/**
 * La pagina TIMER: il timer del tablet di sala (`TimerSala`), lo stesso
 * componente, senza la sua testata. Resta montato anche nascosto: un
 * allenamento avviato continua mentre si guardano le altre pagine.
 */
export function PaginaTimer({ incorporato, visibile, indietro, onIndietro }: { incorporato: Incorporato; visibile: boolean; indietro: boolean; onIndietro: () => void }) {
  const avviso = avvisoSenzaRete(useOnline())
  return (
    <div className="faccia-timer" hidden={!visibile}>
      <div className="row pad" style={{ gap: 10, paddingTop: 16, paddingBottom: 6 }}>
        {indietro && (
          <button type="button" className="icon-btn testo" onClick={onIndietro} style={{ gap: 6 }}>
            <Back />
            <span className="num" style={{ fontSize: 15, fontWeight: 700, letterSpacing: '0.12em' }}>APPELLO</span>
          </button>
        )}
        <h1 className="ob appello-titolo" style={{ margin: 0 }}>
          TIMER
        </h1>
      </div>
      {avviso && (
        <div className="pad" style={{ paddingBottom: 8 }}>
          <div className="avviso-rete" role="status">
            <span className="num avviso-rete-titolo">SENZA RETE</span>
            <span>{avviso}</span>
          </div>
        </div>
      )}
      <Suspense fallback={<p className="pad" style={{ color: 'var(--dim)' }}>Un attimo…</p>}>
        <TimerSala incorporato={incorporato} visibile={visibile} />
      </Suspense>
    </div>
  )
}
