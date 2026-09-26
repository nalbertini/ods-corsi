import { useMemo, useState } from 'react'
import { CATEGORIE, type Categoria, type Esercizio, normalizza } from '../lib/esercizi'
import { uid } from '../lib/format'
import { Close, Plus, Trash } from './Icons'

/**
 * La scelta degli esercizi dal catalogo.
 *
 * Si possono prendere più esercizi in un colpo solo, perché un circuito si
 * costruisce in blocco; e si può crearne uno nuovo scrivendone il nome, così
 * il catalogo non diventa mai una gabbia.
 */
export function PickerEsercizi({
  catalogo,
  onCatalogo,
  onScegli,
  onChiudi,
}: {
  catalogo: Esercizio[]
  onCatalogo: (lista: Esercizio[]) => void
  onScegli: (nomi: string[]) => void
  onChiudi: () => void
}) {
  const [cerca, setCerca] = useState('')
  const [categoria, setCategoria] = useState<Categoria | 'tutte'>('tutte')
  const [scelti, setScelti] = useState<string[]>([])

  const q = normalizza(cerca)
  const visibili = useMemo(
    () =>
      catalogo.filter(
        (e) => (categoria === 'tutte' || e.categoria === categoria) && (!q || normalizza(e.nome).includes(q)),
      ),
    [catalogo, categoria, q],
  )

  const esisteGià = catalogo.some((e) => normalizza(e.nome) === q)

  const creaEScegli = () => {
    const nome = cerca.trim()
    if (!nome) return
    const nuovo: Esercizio = { id: uid(), nome, categoria: categoria === 'tutte' ? 'A corpo libero' : categoria, propri: true }
    onCatalogo([...catalogo, nuovo])
    setScelti((p) => [...p, nome])
    setCerca('')
  }

  const elimina = (e: Esercizio) => {
    onCatalogo(catalogo.filter((x) => x.id !== e.id))
    setScelti((p) => p.filter((n) => n !== e.nome))
  }

  return (
    <div className="app">
      <div className="topbar">
        <button className="icon-btn" onClick={onChiudi} aria-label="Chiudi">
          <Close />
        </button>
        <span className="ob grow" style={{ fontSize: 22, fontWeight: 700, letterSpacing: '0.1em' }}>
          ESERCIZI
        </span>
        <span className="num" style={{ fontSize: 17, fontWeight: 700, color: 'var(--dim)' }}>
          {catalogo.length}
        </span>
      </div>

      <div className="pad" style={{ paddingBottom: 12 }}>
        <input
          className="field"
          value={cerca}
          placeholder="Cerca o scrivi un nome nuovo"
          onChange={(ev) => setCerca(ev.target.value)}
          autoFocus
        />
      </div>

      <div className="pad row" style={{ gap: 8, overflowX: 'auto', paddingBottom: 12 }}>
        <button className="chip" data-on={categoria === 'tutte'} onClick={() => setCategoria('tutte')}>
          TUTTI
        </button>
        {CATEGORIE.map((c) => (
          <button key={c} className="chip" data-on={categoria === c} onClick={() => setCategoria(c)}>
            {c.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="scroll">
        <div className="pad stack" style={{ gap: 6, paddingBottom: 16 }}>
          {cerca.trim() && !esisteGià && (
            <button className="btn btn-dashed" style={{ minHeight: 52, fontSize: 15 }} onClick={creaEScegli}>
              <Plus size={16} />
              CREA «{cerca.trim().toUpperCase()}»
            </button>
          )}

          {visibili.length === 0 && !cerca.trim() && (
            <span style={{ fontSize: 14, color: 'var(--dim)' }}>Nessun esercizio in questa categoria.</span>
          )}

          {visibili.map((e) => {
            const preso = scelti.filter((n) => n === e.nome).length
            return (
              <div key={e.id} className="card row" style={{ gap: 10, padding: '0 12px', minHeight: 54 }}>
                <button
                  className="row grow"
                  style={{ gap: 10, minHeight: 54, textAlign: 'left' }}
                  onClick={() => setScelti((p) => [...p, e.nome])}
                >
                  <span
                    style={{
                      width: 20,
                      height: 20,
                      flexShrink: 0,
                      border: '2px solid var(--line)',
                      background: preso ? 'var(--verde)' : 'transparent',
                      borderColor: preso ? 'var(--verde)' : 'var(--line)',
                      color: 'var(--su-colore)',
                      fontSize: 12,
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {preso > 1 ? preso : ''}
                  </span>
                  <div className="stack grow" style={{ gap: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 15, fontWeight: 600 }}>{e.nome}</span>
                    <span style={{ fontSize: 11, color: 'var(--faint)', letterSpacing: '0.1em' }}>
                      {e.categoria.toUpperCase()}
                    </span>
                  </div>
                </button>
                {e.propri && (
                  <button
                    className="icon-btn"
                    style={{ width: 40, border: 'none', color: 'var(--faint)' }}
                    onClick={() => elimina(e)}
                    aria-label={`Togli ${e.nome} dal catalogo`}
                  >
                    <Trash size={16} />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div
        className="row"
        style={{
          gap: 12,
          borderTop: '2px solid var(--line-soft)',
          background: 'var(--menu)',
          padding: '12px 20px calc(var(--safe-b) + 14px)',
        }}
      >
        <button className="btn btn-ghost" style={{ minHeight: 54 }} onClick={() => setScelti([])} disabled={scelti.length === 0}>
          AZZERA
        </button>
        <button
          className="btn btn-go grow"
          style={{ minHeight: 54 }}
          disabled={scelti.length === 0}
          onClick={() => onScegli(scelti)}
        >
          AGGIUNGI {scelti.length > 0 ? scelti.length : ''}
        </button>
      </div>
    </div>
  )
}
