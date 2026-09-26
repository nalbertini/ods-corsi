import { useState } from 'react'
import { INFORMATIVA_PUBBLICA, LINK_ISCRIZIONE, MODULI, PAGAMENTO, PASSI, PROVA, type Passo } from '../lib/iscrizione'
import { CONTATTI, SITO, chiama } from '../lib/sito'
import { Costi } from './Costi'
import { ModuloIscrizione } from './ModuloIscrizione'

/**
 * Come ci si iscrive: i passi, in ordine, con il tasto giusto accanto a
 * quelli che portano da qualche parte. È la stessa lista che la segreteria
 * manda per messaggio, ma qui non si perde in fondo a una chat. L'ultimo apre
 * il modulo di iscrizione, al posto dei passi.
 *
 * Sullo schermo largo i costi stanno accanto ai passi invece che sotto.
 *
 * `pubblica` è la pagina del link per chi vuole iscriversi (`#iscrizioni`):
 * gli stessi passi, ma senza la prova, vedi `PASSI_PUBBLICI`.
 */
export function IscrizioniScreen({ pubblica = false }: { pubblica?: boolean }) {
  const [modulo, setModulo] = useState(false)
  const passi = pubblica ? PASSI_PUBBLICI : PASSI
  const vai = (aperto: boolean) => {
    setModulo(aperto)
    document.querySelector('.scroll')?.scrollTo(0, 0)
  }

  if (modulo) {
    return (
      <>
        <div className="rule">
          <span className="rule-label">RICHIESTA DI ISCRIZIONE</span>
          <div className="rule-line" />
        </div>
        <ModuloIscrizione onChiudi={() => vai(false)} />
      </>
    )
  }

  return (
    <div className="iscrizioni">
      <div className="iscrizioni-passi">
        <div className="rule">
          <span className="rule-label">ISCRIZIONI</span>
          <div className="rule-line" />
          <span className="num" style={{ fontSize: 15, fontWeight: 600, color: 'var(--dim)' }}>{passi.length} PASSI</span>
        </div>

        <Prova />

        <ol className="pad stack passi" style={{ gap: 10, paddingBottom: 16 }}>
          {passi.map((p, i) => (
            <li key={i} className="card passo">
              <span className="passo-num num">{i + 1}</span>
              <span className="stack grow" style={{ gap: 8, minWidth: 0 }}>
                <span className="passo-titolo">{p.titolo}</span>
                {p.dettaglio && <span className="passo-dettaglio">{p.dettaglio}</span>}
                <Azione passo={p} onModulo={() => vai(true)} />
              </span>
            </li>
          ))}
        </ol>

        <Contatti />
      </div>

      <Costi />

      {INFORMATIVA_PUBBLICA && (
        <p className="pad iscrizioni-nota" style={{ fontSize: 13, color: 'var(--dim)', paddingBottom: 20 }}>
          Come trattiamo i tuoi dati:{' '}
          <a href={INFORMATIVA_PUBBLICA} target="_blank" rel="noreferrer" style={{ color: 'var(--sec)' }}>
            l'informativa privacy
          </a>
          .
        </p>
      )}
    </div>
  )
}

/** Prima dei passi: chi non ha ancora deciso comincia da qui. */
function Prova() {
  return (
    <section className="pad" style={{ paddingBottom: 10 }}>
      <div className="card stack prova">
        <span className="rule-label" style={{ fontSize: 12, letterSpacing: '0.2em' }}>PRIMA DI ISCRIVERTI</span>
        <span className="row" style={{ gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
          <span className="passo-titolo">Settimana di prova</span>
          <span className="num" style={{ fontSize: 26, fontWeight: 700 }}>{PROVA.costo}</span>
        </span>
        <span className="passo-dettaglio">{PROVA.testo} Per cominciare, passa in palestra o chiamaci.</span>
        <a className="btn btn-ghost passo-btn" href={chiama}>
          CHIAMA
        </a>
      </div>
    </section>
  )
}

/** Per chi si blocca a metà: dove siamo e come ci si trova, dal piede del sito. */
function Contatti() {
  return (
    <section className="pad" style={{ paddingBottom: 16 }}>
      <div className="card stack" style={{ padding: 14, gap: 8 }}>
        <span className="passo-titolo">Hai un dubbio? Chiamaci o passa in palestra.</span>
        <span className="passo-dettaglio">
          {CONTATTI.indirizzo}, a pochi metri dalla metro Fermi. Telefono{' '}
          <span className="num" style={{ color: 'var(--text)' }}>{CONTATTI.telefono}</span>.
        </span>
        <span className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <a className="btn btn-ghost passo-btn" href={chiama}>
            CHIAMA
          </a>
          <a className="btn btn-ghost passo-btn" href={CONTATTI.mappa} target="_blank" rel="noopener noreferrer">
            MAPPA
          </a>
          <a className="btn btn-ghost passo-btn" href={CONTATTI.instagram} target="_blank" rel="noopener noreferrer">
            INSTAGRAM
          </a>
          <a className="btn btn-ghost passo-btn" href={CONTATTI.facebook} target="_blank" rel="noopener noreferrer">
            FACEBOOK
          </a>
          <a className="btn btn-ghost passo-btn" href={SITO} target="_blank" rel="noopener noreferrer">
            IL SITO
          </a>
        </span>
      </div>
    </section>
  )
}

function Azione({ passo, onModulo }: { passo: Passo; onModulo: () => void }) {
  switch (passo.azione) {
    case 'modulo':
      return (
        <button type="button" className="btn btn-primary passo-btn" onClick={onModulo}>
          COMPILA LA RICHIESTA
        </button>
      )
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
