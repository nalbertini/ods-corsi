import type { Workout } from '../types'
import { MODE_BADGE, buildSegments, describe, totalDuration } from '../lib/engine'
import { clock } from '../lib/format'
import { Close, Play, Plus } from './Icons'

/**
 * Quello che si vede quando si apre un link con dentro un allenamento.
 *
 * Prima di tutto si mostra cosa è arrivato: chi inquadra un QR sul tablet della
 * sala deve poter vedere che è la cosa giusta prima che finisca fra i suoi
 * timer, e deve poterlo far partire subito senza salvarlo, perché il tablet
 * della sala non è l'archivio di nessuno.
 */
export function RicevutoScreen({
  workout,
  onSalva,
  onAvvia,
  onChiudi,
}: {
  workout: Workout
  onSalva: () => void
  onAvvia: () => void
  onChiudi: () => void
}) {
  const segmenti = buildSegments(workout)
  const lavori = segmenti.filter((s) => s.kind === 'work')

  return (
    <div className="app">
      <div className="topbar">
        <button className="icon-btn" onClick={onChiudi} aria-label="Chiudi">
          <Close />
        </button>
        <span className="ob grow" style={{ fontSize: 22, fontWeight: 700, letterSpacing: '0.1em' }}>
          TIMER RICEVUTO
        </span>
      </div>

      <div className="scroll">
        <div className="pad stack" style={{ gap: 14, paddingBottom: 20 }}>
          <div className="card stack" style={{ gap: 6, padding: 16, borderTop: '4px solid var(--verde)' }}>
            <span className="badge" style={{ alignSelf: 'flex-start', background: 'var(--verde)' }}>
              {MODE_BADGE[workout.mode]}
            </span>
            <span className="ob" style={{ fontSize: 28, fontWeight: 700, lineHeight: 1.05 }}>
              {workout.name.toUpperCase()}
            </span>
            <span style={{ fontSize: 14, color: 'var(--dim)' }}>{describe(workout)}</span>
            <div className="row" style={{ gap: 10, alignItems: 'baseline', paddingTop: 4 }}>
              <span className="num" style={{ fontSize: 32, fontWeight: 700 }}>
                {clock(totalDuration(workout))}
              </span>
              <span style={{ fontSize: 13, color: 'var(--dim)' }}>
                {segmenti.length} intervalli · {lavori.length} di lavoro
              </span>
            </div>
          </div>

          {workout.exercises.length > 0 && (
            <div className="stack" style={{ gap: 4 }}>
              {workout.exercises.map((e, i) => (
                <div
                  key={e.id}
                  className="row"
                  style={{ gap: 10, minHeight: 38, padding: '0 12px', background: 'var(--surface)' }}
                >
                  <span className="num" style={{ fontSize: 13, fontWeight: 600, color: 'var(--faint)', width: 22 }}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="grow" style={{ fontSize: 14, fontWeight: 600 }}>
                    {e.name}
                  </span>
                  <span className="num" style={{ fontSize: 12, color: 'var(--dim)' }}>
                    {e.duration ? `${e.duration}"` : ''}
                  </span>
                </div>
              ))}
            </div>
          )}

          <p style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--dim)', margin: 0 }}>
            Salvalo se questo è il tuo dispositivo, oppure fallo partire e basta: sul tablet della sala, di solito,
            avviare senza salvare è quello che serve.
          </p>
        </div>
      </div>

      <div
        className="stack"
        style={{
          gap: 10,
          borderTop: '2px solid var(--line-soft)',
          background: 'var(--menu)',
          padding: '12px 20px calc(var(--safe-b) + 14px)',
        }}
      >
        <button className="btn btn-go" style={{ minHeight: 56 }} onClick={onAvvia}>
          <Play size={20} />
          AVVIA SUBITO
        </button>
        <button className="btn btn-ghost" style={{ minHeight: 50, fontSize: 16 }} onClick={onSalva}>
          <Plus size={16} />
          AGGIUNGI AI MIEI TIMER
        </button>
      </div>
    </div>
  )
}
