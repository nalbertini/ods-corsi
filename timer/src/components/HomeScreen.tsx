import { useMemo, useState } from 'react'
import type { Mode, Workout } from '../types'
import { type Gruppo, type Strumento, strumentiDa } from '../lib/gruppi'
import type { Corso } from '../lib/libreria'
import { MODE_BADGE, describe, totalDuration } from '../lib/engine'
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
  gruppi,
  modificabile,
  corsi,
  lezione,
  onStart,
  onStrumento,
  onEdit,
  onDuplicate,
  onDelete,
  onShare,
  onRiprendi,
  onScarta,
  interrotto,
  onNew,
  conFiltri = true,
}: {
  /** Le sezioni della lista: una sola senza database, com'era. */
  gruppi: Gruppo[]
  /** I timer di un collega, e sul tablet quelli del database, si aprono ma non si cambiano. */
  modificabile: (w: Workout) => boolean
  corsi: Corso[]
  /** Il nome del corso della lezione da cui si arriva, se si arriva da una. */
  lezione: string | null
  onStart: (w: Workout) => void
  /** Cronometro e conto alla rovescia si aprono dalla lista, come un timer. */
  onStrumento: (s: Strumento) => void
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
  /** Sul tablet di sala no: lì in cima ci sono già i timer della lezione, e sei filtri sono troppi da lontano. */
  conFiltri?: boolean
}) {
  const [filter, setFilter] = useState<Mode | 'all'>('all')
  const [open, setOpen] = useState<string | null>(null)

  const mostrati = useMemo(
    () => gruppi.map((g) => ({ ...g, timer: filter === 'all' ? g.timer : g.timer.filter((w) => w.mode === filter) })),
    [gruppi, filter],
  )
  const strumenti = strumentiDa(filter)
  const nomeCorso = (id: string) => corsi.find((c) => c.id === id)?.nome
  // La chiave del riquadro aperto porta anche la sezione, per sicurezza.
  const card = (g: string, w: Workout) => {
    const chiave = `${g}:${w.id}`
    const isOpen = open === chiave
    const suo = modificabile(w)
    const nomiCorsi = (w.corsi ?? []).map(nomeCorso).filter(Boolean)
    return (
      <div key={chiave} className="card stack">
        <div className="wcard">
          <div className="stack grow" style={{ gap: 6, minWidth: 0 }}>
            <div className="row" style={{ gap: 8 }}>
              <span className="badge badge-tipo">
                {MODE_BADGE[w.mode]}
              </span>
              <span className="num" style={{ fontSize: 14, fontWeight: 600, letterSpacing: '0.1em', color: 'var(--dim)' }}>
                {compact(totalDuration(w))}
              </span>
            </div>
            <button className="wcard-name" style={{ textAlign: 'left', padding: 0 }} onClick={() => setOpen(isOpen ? null : chiave)}>
              {w.name.toUpperCase()}
            </button>
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--dim)' }}>{describe(w)}</span>
            {nomiCorsi.length > 0 && (
              <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', color: 'var(--faint)' }}>
                {nomiCorsi.join(' · ').toUpperCase()}
              </span>
            )}
          </div>
          <button className="play-btn" style={{ borderColor: 'var(--rosso)', color: 'var(--rosso)' }} onClick={() => onStart(w)} aria-label={`Avvia ${w.name}`}>
            <Play />
          </button>
        </div>

        {isOpen && (
          <div className="wcard-azioni">
            {suo && (
              <button className="btn btn-ghost" style={{ minHeight: 44, padding: '0 12px', fontSize: 14 }} onClick={() => onEdit(w)}>
                <Edit size={16} />
                MODIFICA
              </button>
            )}
            <button className="btn btn-ghost" style={{ minHeight: 44, padding: '0 12px', fontSize: 14 }} onClick={() => onDuplicate(w)}>
              <Copy size={16} />
              DUPLICA
            </button>
            <button className="btn btn-ghost" style={{ minHeight: 44, padding: '0 12px', fontSize: 14 }} onClick={() => onShare(w)}>
              <Share size={16} />
              INVIA
            </button>
            {suo && (
              <button
                className="icon-btn"
                style={{ borderColor: 'var(--line)', color: 'var(--rosso)', marginLeft: 'auto' }}
                onClick={() => onDelete(w)}
                aria-label={`Elimina ${w.name}`}
              >
                <Trash size={17} />
              </button>
            )}
          </div>
        )}
      </div>
    )
  }

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

      {/* Si arriva dal tablet di sala o dall'appello con la lezione: i timer
          del suo corso stanno nella prima sezione. Non si chiude: dentro una
          lezione lo storico deve sapere di quale, e sul tablet la cambia la sala. */}
      {lezione && (
        <div className="pad" style={{ paddingTop: 14 }}>
          <div className="card row" style={{ gap: 10, padding: '10px 10px 10px 14px', borderColor: 'var(--blu)' }}>
            <div className="stack grow" style={{ gap: 2, minWidth: 0 }}>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.2em', color: 'var(--dim)' }}>LEZIONE</span>
              <span className="ob" style={{ fontSize: 20, fontWeight: 700 }}>
                {lezione.toUpperCase()}
              </span>
            </div>
          </div>
        </div>
      )}

      {conFiltri && (
        <div className="row pad" style={{ gap: 8, paddingTop: 14, paddingBottom: 14, overflowX: 'auto' }}>
          {FILTERS.map((f) => (
            <button key={f.key} className="chip" data-on={filter === f.key} onClick={() => setFilter(f.key)}>
              {f.label}
            </button>
          ))}
        </div>
      )}

      {strumenti.length > 0 && (
        <div>
          <div className="rule">
            <span className="rule-label">STRUMENTI</span>
            <div className="rule-line" />
            <span className="num" style={{ fontSize: 15, fontWeight: 600, color: 'var(--dim)' }}>
              {strumenti.length}
            </span>
          </div>
          <div className="pad wlist stack" style={{ gap: 10, paddingBottom: 16 }}>
            {strumenti.map((s) => (
              <div key={s.chiave} className="card stack">
                <div className="wcard">
                  <div className="stack grow" style={{ gap: 6, minWidth: 0 }}>
                    <div className="row" style={{ gap: 8 }}>
                      <span className="badge badge-tipo">{s.tipo}</span>
                    </div>
                    <button className="wcard-name" style={{ textAlign: 'left', padding: 0 }} onClick={() => onStrumento(s.chiave)}>
                      {s.nome}
                    </button>
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--dim)' }}>{s.riassunto}</span>
                  </div>
                  <button className="play-btn" style={{ borderColor: 'var(--rosso)', color: 'var(--rosso)' }} onClick={() => onStrumento(s.chiave)} aria-label={`Apri ${s.nome}`}>
                    <Play />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {mostrati
        .filter((g) => g.timer.length > 0 || g.vuota)
        .map((g) => (
          <div key={g.chiave}>
            <div className="rule">
              <span className="rule-label">{g.titolo}</span>
              <div className="rule-line" />
              <span className="num" style={{ fontSize: 15, fontWeight: 600, color: 'var(--dim)' }}>
                {g.timer.length}
              </span>
            </div>
            <div className="pad wlist stack" style={{ gap: 10, paddingBottom: 16 }}>
              {g.timer.length === 0 && (
                <p style={{ color: 'var(--dim)', fontSize: 15, lineHeight: 1.5, margin: '4px 0 0' }}>
                  {g.chiave === 'corso' || g.chiave === 'tutti' || filter === 'all' ? g.vuota : 'Nessun timer di questo tipo.'}
                </p>
              )}
              {g.timer.map((w) => card(g.chiave, w))}
            </div>
          </div>
        ))}

      <div className="pad stack" style={{ paddingBottom: 16 }}>
        <button className="btn btn-dashed" onClick={() => onNew(filter)}>
          <Plus />
          NUOVO TIMER
        </button>
      </div>
    </>
  )
}
