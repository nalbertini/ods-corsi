import type { RigaScaletta } from '../lib/scaletta'
import { clock } from '../lib/format'
import { STATE_COLOR } from './Quadrante'

/** 30" fino a un minuto e mezzo, poi 12:30: i passi lunghi (AMRAP) restano leggibili. */
const durataDi = (secondi: number) => (secondi < 100 ? `${secondi}"` : clock(secondi))

/**
 * I passi che vengono: quello in corso evidenziato, poi i prossimi. Il tipo si
 * legge dal nome, non solo dal colore. Quel che non entra si riassume in
 * «+ ALTRI N PASSI», perché la linea in fondo mostra già tutto l'allenamento.
 */
export function Scaletta({
  righe,
  altri,
  altriSecondi,
}: {
  righe: RigaScaletta[]
  altri: number
  altriSecondi: number
}) {
  if (righe.length === 0) return null
  // `as string` sulle proprietà `--c`: React le accetta come chiave, i tipi no.
  return (
    <div className="tf-scaletta">
      <span className="tf-etichetta">SCALETTA</span>
      <ol className="tf-righe">
        {righe.map((r, i) => (
          <li key={i} className="tf-riga" data-corrente={r.corrente} data-kind={r.kind} style={{ ['--c' as string]: STATE_COLOR[r.kind] }}>
            <span className="tf-segno" aria-hidden="true" />
            <span className="tf-riga-nome">{r.nome}</span>
            <span className="tf-riga-durata">{durataDi(r.durata)}</span>
          </li>
        ))}
      </ol>
      {altri > 0 && (
        <span className="tf-altri">
          + ALTRI {altri} {altri === 1 ? 'PASSO' : 'PASSI'} · {clock(altriSecondi)}
        </span>
      )}
    </div>
  )
}
