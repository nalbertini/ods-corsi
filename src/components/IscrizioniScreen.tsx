import { useState } from 'react'
import { INFORMATIVA_PUBBLICA, LINK_ISCRIZIONE, MODULI, PAGAMENTO, PASSI, PASSI_PUBBLICI, PROVA, type Passo } from '../lib/iscrizione'
import { CONTATTI, SITO, chiama } from '../lib/sito'
import { Costi } from './Costi'
import { Cifra, Dettaglio, Etichetta, Riquadro, Tasti, Tasto, Titoletto } from './ds'
import { ModuloIscrizione } from './ModuloIscrizione'

/**
 * Come ci si iscrive: i passi, in ordine, con il tasto giusto accanto a
 * quelli che portano da qualche parte. È la stessa lista che la segreteria
 * manda per messaggio, ma qui non si perde in fondo a una chat. L'ultimo apre
 * il modulo di iscrizione, al posto dei passi.
 *
 * Sullo schermo largo i costi stanno accanto ai passi invece che sotto.
 *
 * `pubblica` è la pagina del link per chi vuole iscriversi (`iscrizioni/`):
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
      <div className="iscrizioni-modulo">
        <Titoletto>RICHIESTA DI ISCRIZIONE</Titoletto>
        <ModuloIscrizione onChiudi={() => vai(false)} />
      </div>
    )
  }

  return (
    <div className="iscrizioni">
      <div className="iscrizioni-passi">
        <Titoletto conto={`${passi.length} PASSI`}>ISCRIZIONI</Titoletto>

        <Prova />

        <ol className="pad stack passi">
          {passi.map((p, i) => (
            <li key={i} className="card passo">
              <span className="passo-num num">{i + 1}</span>
              <span className="stack grow passo-testo">
                <span className="passo-titolo">{p.titolo}</span>
                {p.dettaglio && <Dettaglio>{p.dettaglio}</Dettaglio>}
                <Azione passo={p} onModulo={() => vai(true)} />
              </span>
            </li>
          ))}
        </ol>

        <Contatti />
      </div>

      <Costi />

      {INFORMATIVA_PUBBLICA && (
        <p className="pad iscrizioni-nota">
          Come trattiamo i tuoi dati:{' '}
          <a href={INFORMATIVA_PUBBLICA} target="_blank" rel="noreferrer" className="link-sec">
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
    <section className="pad iscrizioni-prova">
      <Riquadro tono="prova">
        <Etichetta>PRIMA DI ISCRIVERTI</Etichetta>
        <span className="row prova-testa">
          <span className="passo-titolo">Settimana di prova</span>
          <Cifra>{PROVA.costo}</Cifra>
        </span>
        <Dettaglio>{PROVA.testo} Per cominciare, passa in palestra o chiamaci.</Dettaglio>
        <Tasto href={chiama} qui>
          CHIAMA
        </Tasto>
      </Riquadro>
    </section>
  )
}

/** Per chi si blocca a metà: dove siamo e come ci si trova, dal piede del sito. */
function Contatti() {
  return (
    <section className="pad iscrizioni-contatti">
      <Riquadro>
        <span className="passo-titolo">Hai un dubbio? Chiamaci o passa in palestra.</span>
        <Dettaglio>
          {CONTATTI.indirizzo}, a pochi metri dalla metro Fermi. Telefono <span className="num testo-pieno">{CONTATTI.telefono}</span>.
        </Dettaglio>
        <Tasti>
          <Tasto href={chiama} qui>
            CHIAMA
          </Tasto>
          <Tasto href={CONTATTI.mappa}>MAPPA</Tasto>
          <Tasto href={CONTATTI.instagram}>INSTAGRAM</Tasto>
          <Tasto href={CONTATTI.facebook}>FACEBOOK</Tasto>
          <Tasto href={SITO}>IL SITO</Tasto>
        </Tasti>
      </Riquadro>
    </section>
  )
}

function Azione({ passo, onModulo }: { passo: Passo; onModulo: () => void }) {
  switch (passo.azione) {
    case 'modulo':
      return (
        <Tasto variante="principale" onClick={onModulo}>
          COMPILA LA RICHIESTA
        </Tasto>
      )
    case 'link':
      return (
        <Tasto variante="principale" href={LINK_ISCRIZIONE}>
          APRI IL MODULO
        </Tasto>
      )
    case 'moduli':
      return (
        <Tasti>
          {MODULI.map((m) => (
            <Tasto key={m.file} href={m.file} scarica>
              {m.etichetta}
            </Tasto>
          ))}
        </Tasti>
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
    <span className="stack pagamento">
      <Dettaglio>
        Quota associativa {PAGAMENTO.quotaAssociativa}, valida fino a {PAGAMENTO.validaFino}. Bonifico a {PAGAMENTO.intestatario}:
      </Dettaglio>
      <span className="num iban">{PAGAMENTO.iban}</span>
      <Tasti>
        <Tasto onClick={copia}>{copiato ? 'COPIATO' : 'COPIA IBAN'}</Tasto>
        <Tasto onClick={() => document.getElementById('costi')?.scrollIntoView({ behavior: 'smooth' })}>VEDI I COSTI</Tasto>
      </Tasti>
    </span>
  )
}
