import { type Disciplina, NOME_TUTTE, TUTTE } from '../lib/discipline'

/**
 * Il filtro per categoria (la sola divisione): una riga di pulsanti. Non
 * compare se la palestra non ne ha. «Tutte» non è un pulsante: le voci comuni
 * compaiono sotto ogni categoria.
 */
export function FiltroDiscipline({
  discipline,
  valore,
  onCambia,
}: {
  discipline: Disciplina[]
  valore: string | null
  onCambia: (id: string | null) => void
}) {
  if (discipline.length === 0) return null
  return (
    <div className="pad row" role="group" aria-label="Categoria" style={{ gap: 8, overflowX: 'auto', paddingBottom: 12 }}>
      <button className="chip" data-on={valore === null} onClick={() => onCambia(null)}>
        OGNI CATEGORIA
      </button>
      {discipline.map((d) => (
        <button key={d.id} className="chip" data-on={valore === d.id} onClick={() => onCambia(d.id)}>
          {d.nome.toUpperCase()}
        </button>
      ))}
    </div>
  )
}

/** La categoria di una voce: nessuna, «Tutte» (per le voci comuni) o una della lista. */
export function SceltaDisciplina({
  discipline,
  valore,
  onCambia,
}: {
  discipline: Disciplina[]
  valore: string | undefined
  onCambia: (id: string | undefined) => void
}) {
  if (discipline.length === 0) return null
  return (
    <label className="stack" style={{ gap: 4 }}>
      <span style={{ fontSize: 12, color: 'var(--dim)', letterSpacing: '0.1em' }}>CATEGORIA</span>
      <select className="field" value={valore ?? ''} onChange={(ev) => onCambia(ev.target.value || undefined)}>
        <option value="">Nessuna categoria</option>
        <option value={TUTTE}>{NOME_TUTTE}: vale per ogni categoria</option>
        {discipline.map((d) => (
          <option key={d.id} value={d.id}>
            {d.nome}
          </option>
        ))}
      </select>
    </label>
  )
}
