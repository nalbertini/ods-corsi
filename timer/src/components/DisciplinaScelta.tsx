import { type Disciplina, NOME_TUTTE, TUTTE } from '../lib/discipline'

/**
 * Il filtro per disciplina: una riga di pulsanti sotto quella delle categorie.
 * Non compare se la palestra non ne ha. «Tutte» non è un pulsante: le voci
 * comuni compaiono sotto ogni disciplina.
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
    <div className="pad row" role="group" aria-label="Disciplina" style={{ gap: 8, overflowX: 'auto', paddingBottom: 12 }}>
      <button className="chip" data-on={valore === null} onClick={() => onCambia(null)}>
        OGNI DISCIPLINA
      </button>
      {discipline.map((d) => (
        <button key={d.id} className="chip" data-on={valore === d.id} onClick={() => onCambia(d.id)}>
          {d.nome.toUpperCase()}
        </button>
      ))}
    </div>
  )
}

/** La disciplina di una voce: nessuna, «Tutte» (per le voci comuni) o una della lista. */
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
      <span style={{ fontSize: 12, color: 'var(--dim)', letterSpacing: '0.1em' }}>DISCIPLINA</span>
      <select className="field" value={valore ?? ''} onChange={(ev) => onCambia(ev.target.value || undefined)}>
        <option value="">Nessuna in particolare</option>
        <option value={TUTTE}>{NOME_TUTTE}: vale per ogni disciplina</option>
        {discipline.map((d) => (
          <option key={d.id} value={d.id}>
            {d.nome}
          </option>
        ))}
      </select>
    </label>
  )
}
