import type { HistoryEntry } from '../types'
import { clock } from '../lib/format'

export function HistoryScreen({ entries }: { entries: HistoryEntry[] }) {
  if (entries.length === 0) {
    return (
      <p className="pad" style={{ fontSize: 15, lineHeight: 1.5, color: 'var(--dim)', marginTop: 24 }}>
        Qui finiscono gli allenamenti man mano che li completi. Non ce n'è ancora nessuno.
      </p>
    )
  }

  const fmt = new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

  return (
    <>
      <div className="rule">
        <span className="rule-label">STORICO</span>
        <div className="rule-line" />
        <span className="num" style={{ fontSize: 15, fontWeight: 600, color: 'var(--dim)' }}>
          {entries.length}
        </span>
      </div>
      <div className="pad stack" style={{ gap: 8, paddingBottom: 20 }}>
        {entries.map((e) => (
          <div
            key={e.id}
            className="card row"
            style={{ gap: 12, padding: '12px 14px', borderLeft: `4px solid ${e.completed ? 'var(--verde)' : 'var(--giallo)'}` }}
          >
            <div className="stack grow" style={{ gap: 2, minWidth: 0 }}>
              <span className="ob" style={{ fontSize: 18, fontWeight: 700 }}>
                {e.workoutName.toUpperCase()}
              </span>
              <span style={{ fontSize: 12, color: 'var(--dim)' }}>
                {fmt.format(e.finishedAt)} · {e.completed ? 'completato' : 'interrotto'}
              </span>
            </div>
            <span className="num" style={{ fontSize: 22, fontWeight: 700 }}>
              {clock(e.seconds)}
            </span>
          </div>
        ))}
      </div>
    </>
  )
}
