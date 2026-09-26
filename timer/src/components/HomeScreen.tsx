import { useMemo, useState } from 'react'
import type { Mode, Workout } from '../types'
import { MODE_BADGE, MODE_TINT, describe, totalDuration } from '../lib/engine'
import { clock, compact } from '../lib/format'
import { type Interrotto, doveEraRimasto } from '../lib/ripresa'
import { Copy, Edit, Play, Plus, Share, Trash } from './Icons'

const FILTERS: Array<{ key: Mode | 'all'; label: string }> = [
  { key: 'all', label: 'TUTTI' },
  { key: 'interval', label: 'INTERVALLI' },
  { key: 'emom', label: 'EMOM' },
  { key: 'amrap', label: 'AMRAP' },
  { key: 'circuit', label: 'CIRCUITO' },
  { key: 'fortime', label: 'FOR TIME' },
]

export function HomeScreen({
  workouts,
  onStart,
  onEdit,
  onDuplicate,
  onDelete,
  onShare,
  onRiprendi,
  onScarta,
  interrotto,
  onNew,
}: {
  workouts: Workout[]
  onStart: (w: Workout) => void
  onEdit: (w: Workout) => void
  onDuplicate: (w: Workout) => void
  onDelete: (w: Workout) => void
  onShare: (w: Workout) => void
  /** L'allenamento lasciato a metà l'ultima volta, se c'è. */
  interrotto: Interrotto | null
  onRiprendi: () => void
  onScarta: () => void
  /** Il filtro attivo viaggia con la richiesta: chi ha già detto «intervalli»
      non deve ridirlo nella schermata dopo. */
  onNew: (filtro: Mode | 'all') => void
}) {
  const [filter, setFilter] = useState<Mode | 'all'>('all')
  const [open, setOpen] = useState<string | null>(null)

  const shown = useMemo(
    () => (filter === 'all' ? workouts : workouts.filter((w) => w.mode === filter)),
    [workouts, filter],
  )

  return (
    <>
      {/* In cima, perché è la prima cosa che uno cerca riaprendo l'app dopo
          che gli è morta in mano a metà allenamento. */}
      {interrotto && (
        <div className="pad" style={{ paddingTop: 14 }}>
          <div className="card stack" style={{ gap: 10, padding: 14, borderColor: 'var(--giallo)' }}>
            <div className="stack" style={{ gap: 2, minWidth: 0 }}>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.2em', color: 'var(--giallo-testo)' }}>
                ALLENAMENTO INTERROTTO
              </span>
              <span className="ob" style={{ fontSize: 20, fontWeight: 700 }}>
                {interrotto.workout.name.toUpperCase()}
              </span>
              <span style={{ fontSize: 13, color: 'var(--dim)' }}>
                {doveEraRimasto(interrotto)} · {clock(interrotto.elapsed)} svolti
              </span>
            </div>
            <div className="row" style={{ gap: 8 }}>
              <button className="btn btn-go grow" style={{ minHeight: 48, fontSize: 16 }} onClick={onRiprendi}>
                RIPRENDI
              </button>
              <button className="btn btn-ghost" style={{ minHeight: 48, fontSize: 16, padding: '0 18px' }} onClick={onScarta}>
                SCARTA
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="row pad" style={{ gap: 8, paddingTop: 14, paddingBottom: 14, overflowX: 'auto' }}>
        {FILTERS.map((f) => (
          <button key={f.key} className="chip" data-on={filter === f.key} onClick={() => setFilter(f.key)}>
            {f.label}
          </button>
        ))}
      </div>

      <div className="rule">
        <span className="rule-label">I TUOI TIMER</span>
        <div className="rule-line" />
        <span className="num" style={{ fontSize: 15, fontWeight: 600, color: 'var(--dim)' }}>
          {shown.length}
        </span>
      </div>

      <div className="pad wlist stack" style={{ gap: 10, paddingBottom: 16 }}>
        {shown.length === 0 && (
          <p style={{ color: 'var(--dim)', fontSize: 15, lineHeight: 1.5, margin: '4px 0 0' }}>
            Nessun timer di questo tipo. Creane uno con il pulsante qui sotto.
          </p>
        )}

        {shown.map((w) => {
          const tint = MODE_TINT[w.mode]
          const isOpen = open === w.id
          return (
            <div key={w.id} className="card stack">
              <div className="wcard">
                <div className="stack grow" style={{ gap: 6, minWidth: 0 }}>
                  <div className="row" style={{ gap: 8 }}>
                    <span className="badge" style={{ background: tint }}>
                      {MODE_BADGE[w.mode]}
                    </span>
                    <span className="num" style={{ fontSize: 14, fontWeight: 600, letterSpacing: '0.1em', color: 'var(--dim)' }}>
                      {compact(totalDuration(w))}
                    </span>
                  </div>
                  <button
                    className="wcard-name"
                    style={{ textAlign: 'left', padding: 0 }}
                    onClick={() => setOpen(isOpen ? null : w.id)}
                  >
                    {w.name.toUpperCase()}
                  </button>
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--dim)' }}>{describe(w)}</span>
                </div>
                <button
                  className="play-btn"
                  style={{ borderColor: tint, color: tint }}
                  onClick={() => onStart(w)}
                  aria-label={`Avvia ${w.name}`}
                >
                  <Play />
                </button>
              </div>

              {isOpen && (
                <div className="wcard-azioni">
                  <button className="btn btn-ghost" style={{ minHeight: 44, padding: '0 12px', fontSize: 14 }} onClick={() => onEdit(w)}>
                    <Edit size={16} />
                    MODIFICA
                  </button>
                  <button
                    className="btn btn-ghost"
                    style={{ minHeight: 44, padding: '0 12px', fontSize: 14 }}
                    onClick={() => onDuplicate(w)}
                  >
                    <Copy size={16} />
                    DUPLICA
                  </button>
                  <button
                    className="btn btn-ghost"
                    style={{ minHeight: 44, padding: '0 12px', fontSize: 14 }}
                    onClick={() => onShare(w)}
                  >
                    <Share size={16} />
                    INVIA
                  </button>
                  <button
                    className="icon-btn"
                    style={{ borderColor: 'var(--line)', color: 'var(--rosso)', marginLeft: 'auto' }}
                    onClick={() => onDelete(w)}
                    aria-label={`Elimina ${w.name}`}
                  >
                    <Trash size={17} />
                  </button>
                </div>
              )}
            </div>
          )
        })}

        <button className="btn btn-dashed" onClick={() => onNew(filter)}>
          <Plus />
          NUOVO TIMER
        </button>
      </div>
    </>
  )
}
