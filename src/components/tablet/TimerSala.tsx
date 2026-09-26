import { useEffect, useLayoutEffect, useRef } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import TimerApp from '../../../timer/src/App'
import type { Incorporato } from '../../../timer/src/lib/incorporato'
import cssTimer from '../../../timer/src/styles.css?inline'

/**
 * Il foglio di stile del timer, adattato a stare dentro un riquadro.
 *
 * Il timer è scritto per avere la pagina tutta per sé: `:root`, `body`, le
 * misure in `vh` e `vw`, le `@media` sulla finestra. Qui sta in un'ombra
 * (Shadow DOM), dove le sue classi non si scontrano con quelle di ODS Corsi —
 * `.btn`, `.card`, `.row` ci sono in tutte e due — e dove la pagina è il
 * riquadro: `:host` al posto di `:root` e `body`, le misure del riquadro
 * (`cqh`, `cqw`) al posto di quelle della finestra, e le `@media` sulle
 * misure che diventano `@container`. Quelle sulle preferenze
 * (`prefers-reduced-motion`) restano sulla finestra, dove hanno senso.
 *
 * Le sostituzioni valgono sia sul file com'è scritto sia su quello
 * compresso della compilazione, che toglie spazi e virgolette.
 */
export function perLaSala(css: string): string {
  return (
    css
      .replace(/:root\[data-tema=(['"]?)chiaro\1\]/g, ':host([data-tema=chiaro])')
      .replace(/:root/g, ':host')
      // L'altezza della pagina: qui la dà il tablet, qualche riga più sotto.
      .replace(/html\s*,\s*body\s*,\s*#root\s*\{[^}]*\}/g, '')
      .replace(/(^|[}\s,;])body(\s*\{)/g, '$1:host$2')
      .replace(/(-?(?:\d+\.)?\d+)[dsl]?vh\b/g, '$1cqh')
      .replace(/(-?(?:\d+\.)?\d+)[dsl]?vw\b/g, '$1cqw')
      .replace(/@media([^{]*)\{/g, (tutto, q: string) =>
        /(width|height|orientation|aspect-ratio)/.test(q) && !/prefers-|hover|pointer|print|screen/.test(q) ? `@container${q}{` : tutto,
      )
  )
}

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
export function TimerSala({ incorporato, visibile }: { incorporato: Incorporato; visibile: boolean }) {
  const host = useRef<HTMLDivElement>(null)
  const radice = useRef<Root | null>(null)

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
    radice.current?.render(<TimerApp incorporato={incorporato} />)
  }, [incorporato])

  // Il tema bianco sta su <html>, che dentro l'ombra non si vede: lo si copia.
  useEffect(() => {
    const h = host.current
    if (!h) return
    const copia = () => {
      const t = document.documentElement.dataset.tema
      if (t) h.dataset.tema = t
      else delete h.dataset.tema
    }
    copia()
    const o = new MutationObserver(copia)
    o.observe(document.documentElement, { attributes: true, attributeFilter: ['data-tema'] })
    return () => o.disconnect()
  }, [])

  return <div ref={host} className="tb-timer" hidden={!visibile} />
}
