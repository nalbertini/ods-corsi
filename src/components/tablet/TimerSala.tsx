import { useLayoutEffect, useRef } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import TimerApp from '../../../timer/src/App'
import { TimerBloccato } from '../../../timer/src/components/TimerBloccato'
import type { Incorporato } from '../../../timer/src/lib/incorporato'
import cssTimer from '../../../timer/src/styles.css?inline'
import { perLaSala } from '../../lib/timerNelRiquadro'

/** Il riquadro, in cima al foglio del timer. */
const RIQUADRO = `
:host { display: block; height: 100%; min-height: 0; container-type: size; contain: layout paint; }
:host([hidden]) { display: none; }
.timer-radice { height: 100%; }
`

const CSS = RIQUADRO + perLaSala(cssTimer)

/**
 * La scheda TIMER del tablet: il timer vero, lo stesso che si apre dal
 * telefono, dentro il tablet invece che in un'altra pagina.
 *
 * Resta montato anche quando si guardano le presenze, nascosto: un
 * allenamento avviato continua, e il tablet ne mostra lo stato in testata.
 * Ha una sua radice React dentro l'ombra: gli eventi di React non
 * attraversano bene il confine di un'ombra montata da fuori.
 */
export function TimerSala({
  incorporato,
  visibile,
  tornaAllAppello,
}: {
  incorporato: Incorporato
  visibile: boolean
  /** Solo nel tablet di sala: nell'area istruttori non c'è un appello a cui tornare. */
  tornaAllAppello?: () => void
}) {
  const host = useRef<HTMLDivElement>(null)
  const radice = useRef<Root | null>(null)
  // In un ref: la funzione cambia a ogni giro del tablet, e la radice del timer non va ridisegnata per questo.
  const torna = useRef(tornaAllAppello)
  torna.current = tornaAllAppello

  useLayoutEffect(() => {
    const h = host.current
    if (!h) return
    const ombra = h.shadowRoot ?? h.attachShadow({ mode: 'open' })
    ombra.replaceChildren()
    const stile = document.createElement('style')
    stile.textContent = CSS
    const dove = document.createElement('div')
    dove.className = 'timer-radice'
    ombra.append(stile, dove)
    const r = createRoot(dove)
    radice.current = r
    return () => {
      radice.current = null
      // Smontare una radice mentre React sta ancora disegnando l'altra non si
      // può: lo si fa appena ha finito.
      window.setTimeout(() => r.unmount(), 0)
    }
  }, [])

  // Il timer riceve la lezione, la musica, e se si vede: quando cambiano.
  useLayoutEffect(() => {
    // Il confine sta dentro la radice del timer: un blocco del timer non tocca l'appello accanto.
    radice.current?.render(
      <TimerBloccato tornaAllAppello={torna.current ? () => torna.current?.() : undefined}>
        <TimerApp incorporato={incorporato} />
      </TimerBloccato>,
    )
  }, [incorporato])

  return <div ref={host} className="tb-timer" data-tema="sito" hidden={!visibile} />
}
