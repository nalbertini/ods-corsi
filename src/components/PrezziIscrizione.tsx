import { useEffect, useState } from 'react'
import { INFORMATIVA_PUBBLICA, MODULO_IN_APP, PAGAMENTO } from '../lib/iscrizione'
import { apriAspettoModulo } from '../lib/aspettoModulo'
import { INDIRIZZO_RICHIESTA } from '../lib/cancelletti'
import { COME_SI_PAGA, fondoDellaPagina, INFORMATIVA_FRASE } from '../lib/paginaIscrizioni'
import { Costi } from './Costi'
import { Dettaglio, Riquadro, Tasti, Tasto, Titoletto } from './ds'

/**
 * La pagina dei prezzi e del pagamento (`iscrizioni/#prezzi`), che si apre da
 * PREZZI E PAGAMENTO: il listino intero, come si paga e il tasto per
 * cominciare. Ha il suo indirizzo, così l'indietro del browser riporta alla
 * pagina e il link si può mandare. Il tasto per cominciare apre il modulo sulla
 * pagina: chiuso, si è in cima a `iscrizioni/` (scelta dell'utente).
 */
export function PrezziIscrizione() {
  useEffect(() => apriAspettoModulo(), [])
  const torna = () => {
    // Arrivati dalla pagina si torna indietro, così l'indietro del telefono non gira in tondo.
    // Da un link mandato non c'è una pagina prima: si toglie il cancelletto (replaceState non darebbe l'evento che App ascolta).
    // history.state non ha tipo: lo scrive solo PREZZI E PAGAMENTO, con questa forma.
    if ((history.state as { daPagina?: boolean } | null)?.daPagina) history.back()
    else window.location.hash = ''
  }
  // Il modulo si apre sulla pagina, al posto di #prezzi nella cronologia: l'indietro del browser esce
  // dalle iscrizioni come dalla pagina, invece di smontare il modulo senza la domanda di ← INDIETRO.
  // L'indirizzo intero: con <base href="../"> un «#richiesta» da solo porterebbe alla radice.
  const compila = () => window.location.replace(window.location.pathname + window.location.search + INDIRIZZO_RICHIESTA)

  const f = fondoDellaPagina(MODULO_IN_APP)
  return (
    <div className="iscrizioni">
      <div className="pad iscrizioni-torna">
        <Tasto onClick={torna}>‹ TORNA ALLE ISCRIZIONI</Tasto>
      </div>
      <Costi />
      <ComeSiPaga />
      <section className="pad stack iscrizioni-richiesta">
        {f.tasto && (
          <Tasto variante="principale" onClick={compila}>
            COMPILA LA RICHIESTA
          </Tasto>
        )}
        <Dettaglio tono={f.tasto ? undefined : 'testo'}>{f.frase}</Dettaglio>
        {INFORMATIVA_PUBBLICA && (
          <Dettaglio>
            {INFORMATIVA_FRASE}{' '}
            <a href={INFORMATIVA_PUBBLICA} target="_blank" rel="noreferrer" className="link-sec">
              l'informativa privacy
            </a>
            .
          </Dettaglio>
        )}
      </section>
    </div>
  )
}

/** Dove si paga: l'IBAN da copiare e Satispay se c'è. La quota e la sua validità sono già nei costi. */
function ComeSiPaga() {
  const [copiato, setCopiato] = useState(false)
  const iban = PAGAMENTO.iban

  const copia = () => {
    // Senza spazi: è così che lo vogliono i campi delle app della banca.
    navigator.clipboard?.writeText(iban.replace(/\s/g, '')).then(
      () => {
        setCopiato(true)
        setTimeout(() => setCopiato(false), 2000)
      },
      () => {},
    )
  }

  return (
    <section>
      <Titoletto>COME SI PAGA</Titoletto>
      <div className="pad">
        <Riquadro>
          <span className="passo-titolo">{COME_SI_PAGA.titolo}</span>
          <Dettaglio>Bonifico a {PAGAMENTO.intestatario}:</Dettaglio>
          <span className="num iban">{iban}</span>
          {PAGAMENTO.satispay && <Dettaglio>Oppure con Satispay, dall'app.</Dettaglio>}
          <Dettaglio>{COME_SI_PAGA.ricevuta}</Dettaglio>
          <Tasti>
            <Tasto icona="copia" onClick={copia}>{copiato ? 'COPIATO' : 'COPIA IBAN'}</Tasto>
            {PAGAMENTO.satispay && <Tasto href={PAGAMENTO.satispay}>PAGA CON SATISPAY</Tasto>}
          </Tasti>
        </Riquadro>
      </div>
    </section>
  )
}
