import type { BloccoLinea } from '../lib/scaletta'
import { STATE_COLOR } from './Quadrante'

/**
 * Tutto l'allenamento in una barra: un blocco per passo, largo quanto dura. I
 * passi fatti sono pieni, quello in corso si colora via via, i prossimi sono
 * tenui. Non porta informazioni che il testo vicino non dica già.
 */
export function LineaDelTempo({ blocchi }: { blocchi: BloccoLinea[] }) {
  // `as string` sulle proprietà `--c`: React le accetta come chiave, i tipi no.
  return (
    <div className="tf-linea" aria-hidden="true">
      {blocchi.map((b, i) => (
        <div key={i} className="tf-blocco" style={{ flexGrow: b.durata, ['--c' as string]: STATE_COLOR[b.kind] }}>
          <span style={{ width: `${b.riempito * 100}%` }} />
        </div>
      ))}
    </div>
  )
}
