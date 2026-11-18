import { Component, type ErrorInfo, type ReactNode } from 'react'
import { mandaTutto } from '../../../src/lib/coda'
import { mandaPoiRicarica, schermataTimer, type Azione } from '../../../src/lib/schermataTimer'

type Props = {
  /** Nel tablet: riporta all'appello, che il blocco del timer non tocca. */
  tornaAllAppello?: () => void
  children: ReactNode
}

/**
 * Il confine del timer: se il timer si blocca mentre si disegna, al posto
 * del bianco c'è il suo riquadro. Nel tablet il timer sta in una radice sua,
 * e l'appello accanto resta in piedi: RICARICA IL TIMER rimonta solo lui.
 */
export class TimerBloccato extends Component<Props, { bloccato: boolean; giro: number }> {
  state = { bloccato: false, giro: 0 }

  static getDerivedStateFromError() {
    return { bloccato: true }
  }

  componentDidCatch(e: unknown, info: ErrorInfo) {
    // Per chi apre la console: a chi usa il timer il testo grezzo non si mostra.
    console.error('Il timer si è bloccato', e, info.componentStack)
  }

  private fai = async (azione: Azione) => {
    if (azione === 'tornaAllAppello') {
      this.props.tornaAllAppello?.()
      // Tornando al timer lo si trova di nuovo in piedi.
      return this.setState((s) => ({ bloccato: false, giro: s.giro + 1 }))
    }
    if (this.props.tornaAllAppello) return this.setState((s) => ({ bloccato: false, giro: s.giro + 1 }))
    // Il timer da solo: le scritture in coda restano sul disco, ma prima si prova a mandarle.
    await mandaPoiRicarica({ manda: mandaTutto, ricarica: () => window.location.reload() })
  }

  render() {
    if (!this.state.bloccato) return <ConGiro giro={this.state.giro}>{this.props.children}</ConGiro>
    const s = schermataTimer(Boolean(this.props.tornaAllAppello))
    return (
      <div className="app">
        <main className="scroll">
          <div className="stack" style={{ gap: 20, padding: '40px 24px', maxWidth: 800, margin: '0 auto' }}>
            <div role="alert" className="card stack" style={{ gap: 10, padding: 24, borderColor: 'var(--rosso)' }}>
              <span className="rule-label" style={{ color: 'var(--rosso)' }}>{s.titolo}</span>
              <span>{s.testo}</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
              {s.tasti.map((t) => (
                <button
                  key={t.etichetta}
                  type="button"
                  className={`btn ${t.variante === 'principale' ? 'btn-go' : 'btn-ghost'}`}
                  style={{ flex: '1 1 240px' }}
                  onClick={() => void this.fai(t.azione)}
                >
                  {t.etichetta}
                </button>
              ))}
            </div>
          </div>
        </main>
      </div>
    )
  }
}

/** Una chiave nuova a ogni giro: il timer riparte da capo, non dallo stato che l'ha bloccato. */
function ConGiro({ giro, children }: { giro: number; children: ReactNode }) {
  return <div key={giro} style={{ display: 'contents' }}>{children}</div>
}
