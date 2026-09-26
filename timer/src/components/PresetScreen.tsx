import type { Mode, Workout } from '../types'
import { MODE_BADGE, MODE_HINT } from '../lib/engine'
import { presetsDi, PRESETS } from '../lib/presets'

/** Schema visivo del preset: si riconosce a colpo d'occhio meglio di una descrizione. */
function Diagram({ mode }: { mode: Mode }) {
  const p = { width: '100%', height: 40, viewBox: '0 0 140 40', preserveAspectRatio: 'none' as const }
  switch (mode) {
    case 'interval':
      return (
        <svg {...p} aria-hidden="true">
          <g fill="var(--rosso)">
            {[0, 36, 72, 108].map((x) => (
              <rect key={x} x={x} y="6" width="16" height="28" />
            ))}
          </g>
          <g fill="var(--verde)">
            {[22, 58, 94, 130].map((x) => (
              <rect key={x} x={x} y="18" width="8" height="16" />
            ))}
          </g>
        </svg>
      )
    case 'emom':
      return (
        <svg {...p} aria-hidden="true">
          <g fill="var(--verde)">
            {[0, 36, 72, 108].map((x) => (
              <rect key={x} x={x} y="10" width="32" height="24" />
            ))}
          </g>
          <g fill="var(--dim)">
            {[0, 36, 72, 108].map((x) => (
              <rect key={x} x={x} y="0" width="2" height="6" />
            ))}
          </g>
        </svg>
      )
    case 'amrap':
      return (
        <svg {...p} aria-hidden="true">
          <rect x="0" y="10" width="140" height="24" fill="var(--giallo)" />
          <g fill="var(--bg)">
            {[34, 70, 104].map((x) => (
              <rect key={x} x={x} y="10" width="3" height="24" />
            ))}
          </g>
        </svg>
      )
    case 'fortime':
      return (
        <svg {...p} aria-hidden="true">
          <rect x="0" y="16" width="112" height="12" fill="var(--blu)" />
          <polygon points="112,8 140,22 112,36" fill="var(--blu)" />
        </svg>
      )
    case 'circuit':
      return (
        <svg width="100%" height={40} viewBox="0 0 140 40" aria-hidden="true">
          <circle cx="70" cy="20" r="16" fill="none" stroke="var(--blu)" strokeWidth="8" strokeDasharray="14 7" />
          <g fill="var(--blu)">
            <rect x="8" y="16" width="18" height="8" />
            <rect x="114" y="16" width="18" height="8" />
          </g>
        </svg>
      )
  }
}

/**
 * `mode` arriva dal filtro della libreria: chi ha già detto che tipo vuole
 * vede solo gli schemi di quel tipo, invece di ritrovarsi tutti e sei.
 */
export function PresetScreen({ onPick, mode }: { onPick: (w: Workout) => void; mode?: Mode }) {
  const schemi = mode ? presetsDi(mode) : PRESETS
  return (
    <>
      <p className="pad" style={{ fontSize: 14, lineHeight: 1.45, color: 'var(--dim)', margin: '14px 0 0', textWrap: 'pretty' }}>
        {mode
          ? `${schemi.length} modi di fare ${MODE_BADGE[mode].toLowerCase()}: scegli da quale partire, poi regola tempi ed esercizi.`
          : 'Scegli uno schema, poi regola tempi ed esercizi. Resta salvato nella libreria.'}
      </p>

      <div
        className="pad"
        style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10, padding: '18px 20px' }}
      >
        {schemi.map((p) => (
          <button key={p.key} className="card stack" style={{ gap: 10, padding: 14, textAlign: 'left' }} onClick={() => onPick(p.make())}>
            <Diagram mode={p.mode} />
            <span className="ob" style={{ fontSize: 24, fontWeight: 700, letterSpacing: '0.05em', lineHeight: 1 }}>
              {p.title.toUpperCase()}
            </span>
            <span style={{ fontSize: 13, lineHeight: 1.35, color: 'var(--dim)' }}>{MODE_HINT[p.mode]}</span>
          </button>
        ))}
      </div>
    </>
  )
}
