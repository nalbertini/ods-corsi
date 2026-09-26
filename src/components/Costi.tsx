import { COSTI, OFFERTE, STAGIONE, type VoceCosto } from '../lib/costi'
import { LISTINO, PAGAMENTO } from '../lib/iscrizione'

const euro = (n?: number) => (n === undefined ? '—' : `${n} €`)

/**
 * Il listino della stagione, corso per corso.
 *
 * Una scheda per corso e non una tabella: sei colonne su un telefono non si
 * leggono, e chi guarda i prezzi cerca il suo corso, non confronta le righe.
 */
export function Costi() {
  return (
    <section id="costi">
      <div className="rule">
        <span className="rule-label">COSTI {STAGIONE}</span>
        <div className="rule-line" />
      </div>

      <div className="pad stack" style={{ gap: 10, paddingBottom: 16 }}>
        <div className="card stack" style={{ padding: 14, gap: 4 }}>
          <span className="rule-label" style={{ fontSize: 12, letterSpacing: '0.2em' }}>QUOTA ASSOCIATIVA</span>
          <span className="num" style={{ fontSize: 26, fontWeight: 700 }}>{PAGAMENTO.quotaAssociativa}</span>
          <span className="passo-dettaglio">Una per stagione, valida fino a {PAGAMENTO.validaFino}. Si somma al corso.</span>
        </div>

        {COSTI.map((v) => (
          <Voce key={v.corso} voce={v} />
        ))}

        <div className="rule" style={{ padding: '12px 0 0' }}>
          <span className="rule-label">OFFERTE</span>
          <div className="rule-line" />
        </div>
        {OFFERTE.map((o) => (
          <div key={o.titolo} className="card stack" style={{ padding: 14, gap: 4 }}>
            <span className="ob" style={{ fontSize: 17, fontWeight: 700, letterSpacing: '0.06em' }}>{o.titolo}</span>
            <span className="passo-dettaglio">{o.testo}</span>
          </div>
        ))}

        <a className="btn btn-ghost passo-btn" style={{ marginTop: 6 }} href={LISTINO.file} target="_blank" rel="noopener noreferrer">
          IL FOGLIO ORIGINALE
        </a>
      </div>
    </section>
  )
}

function Voce({ voce }: { voce: VoceCosto }) {
  const conEtichette = voce.prezzi.some((p) => p.etichetta)
  return (
    <div className="card stack costo">
      <span className="ob lezione-nome">{voce.corso.toUpperCase()}</span>
      <span className="passo-dettaglio" style={{ color: 'var(--text)' }}>{voce.eta}</span>
      {voce.orari.map((o) => (
        <span key={o} className="passo-dettaglio">{o}</span>
      ))}

      <div className="costo-griglia" data-etichette={conEtichette}>
        {conEtichette && <span />}
        <span className="costo-testa">SALDO 31/8</span>
        <span className="costo-testa">ANNUALE</span>
        <span className="costo-testa">
          TRIMESTRE{voce.notaTrimestre && <><br />{voce.notaTrimestre.toUpperCase()}</>}
        </span>
        {voce.prezzi.map((p, i) => (
          <Riga key={i} etichetta={p.etichetta} valori={[p.saldo, p.annuale, p.trimestre]} conEtichette={conEtichette} />
        ))}
      </div>

      {voce.nota && <span className="passo-dettaglio" style={{ color: 'var(--giallo)' }}>{voce.nota}</span>}
    </div>
  )
}

function Riga({ etichetta, valori, conEtichette }: { etichetta?: string; valori: Array<number | undefined>; conEtichette: boolean }) {
  return (
    <>
      {conEtichette && <span className="costo-testa" style={{ alignSelf: 'center' }}>{etichetta}</span>}
      {valori.map((n, i) => (
        <span key={i} className="num costo-euro" data-vuoto={n === undefined}>{euro(n)}</span>
      ))}
    </>
  )
}
