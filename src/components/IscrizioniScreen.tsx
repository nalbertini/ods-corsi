import { LINK_ISCRIZIONE, MODULO_ISCRIZIONE, PASSI, type Passo } from '../lib/iscrizione'

/**
 * Come ci si iscrive: sette passi, in ordine, con il tasto giusto accanto a
 * quelli che portano da qualche parte. È la stessa lista che la segreteria
 * manda per messaggio, ma qui non si perde in fondo a una chat.
 */
export function IscrizioniScreen() {
  return (
    <>
      <div className="rule">
        <span className="rule-label">ISCRIZIONI</span>
        <div className="rule-line" />
        <span className="num" style={{ fontSize: 15, fontWeight: 600, color: 'var(--dim)' }}>{PASSI.length} PASSI</span>
      </div>

      <ol className="pad stack passi" style={{ gap: 10, paddingBottom: 16 }}>
        {PASSI.map((p, i) => (
          <li key={i} className="card passo">
            <span className="passo-num num">{i + 1}</span>
            <span className="stack grow" style={{ gap: 8, minWidth: 0 }}>
              <span className="passo-titolo">{p.titolo}</span>
              {p.dettaglio && <span style={{ fontSize: 14, color: 'var(--dim)', lineHeight: 1.4 }}>{p.dettaglio}</span>}
              <Azione passo={p} />
            </span>
          </li>
        ))}
      </ol>
    </>
  )
}

function Azione({ passo }: { passo: Passo }) {
  if (passo.azione === 'link') {
    return (
      <a className="btn btn-primary passo-btn" href={LINK_ISCRIZIONE} target="_blank" rel="noopener noreferrer">
        APRI IL MODULO
      </a>
    )
  }
  if (passo.azione === 'modulo') {
    return MODULO_ISCRIZIONE ? (
      <a className="btn btn-ghost passo-btn" href={MODULO_ISCRIZIONE} download>
        SCARICA
      </a>
    ) : (
      <span style={{ fontSize: 14, color: 'var(--dim)', lineHeight: 1.4 }}>
        Lo trovi nel messaggio della segreteria.
      </span>
    )
  }
  return null
}
