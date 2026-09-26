import { useState } from 'react'
import { INFORMATIVA, LINK_ISCRIZIONE, MODULI, PAGAMENTO, PASSI, type Passo } from '../lib/iscrizione'
import { Costi } from './Costi'

/**
 * Come ci si iscrive: sette passi, in ordine, con il tasto giusto accanto a
 * quelli che portano da qualche parte. È la stessa lista che la segreteria
 * manda per messaggio, ma qui non si perde in fondo a una chat.
 *
 * Sullo schermo largo i costi stanno accanto ai passi invece che sotto.
 */
export function IscrizioniScreen() {
  return (
    <div className="iscrizioni">
      <div className="iscrizioni-passi">
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
                {p.dettaglio && <span className="passo-dettaglio">{p.dettaglio}</span>}
                <Azione passo={p} />
              </span>
            </li>
          ))}
        </ol>
      </div>

      <Costi />

      {INFORMATIVA && (
        <p className="pad iscrizioni-nota" style={{ fontSize: 13, color: 'var(--dim)', paddingBottom: 20 }}>
          Come trattiamo i tuoi dati:{' '}
          <a href={INFORMATIVA} target="_blank" rel="noreferrer" style={{ color: 'var(--sec)' }}>
            l'informativa privacy
          </a>
          .
        </p>
      )}
    </div>
  )
}

function Azione({ passo }: { passo: Passo }) {
  switch (passo.azione) {
    case 'link':
      return (
        <a className="btn btn-primary passo-btn" href={LINK_ISCRIZIONE} target="_blank" rel="noopener noreferrer">
          APRI IL MODULO
        </a>
      )
    case 'moduli':
      return (
        <span className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          {MODULI.map((m) => (
            <a key={m.file} className="btn btn-ghost passo-btn" href={m.file} download>
              {m.etichetta}
            </a>
          ))}
        </span>
      )
    case 'pagamento':
      return <Pagamento />
    default:
      return null
  }
}

/** Quanto e dove: la quota, l'IBAN da copiare e il rimando ai costi qui sotto. */
function Pagamento() {
  const [copiato, setCopiato] = useState(false)

  const copia = () => {
    // Senza spazi: è così che lo vogliono i campi delle app della banca.
    navigator.clipboard?.writeText(PAGAMENTO.iban.replace(/\s/g, '')).then(
      () => {
        setCopiato(true)
        setTimeout(() => setCopiato(false), 2000)
      },
      () => {},
    )
  }

  return (
    <span className="stack" style={{ gap: 8 }}>
      <span className="passo-dettaglio">
        Quota associativa {PAGAMENTO.quotaAssociativa}, valida fino a {PAGAMENTO.validaFino}. Bonifico a{' '}
        {PAGAMENTO.intestatario}:
      </span>
      <span className="num iban">{PAGAMENTO.iban}</span>
      <span className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <button className="btn btn-ghost passo-btn" onClick={copia}>
          {copiato ? 'COPIATO' : 'COPIA IBAN'}
        </button>
        <button
          className="btn btn-ghost passo-btn"
          onClick={() => document.getElementById('costi')?.scrollIntoView({ behavior: 'smooth' })}
        >
          VEDI I COSTI
        </button>
      </span>
    </span>
  )
}
