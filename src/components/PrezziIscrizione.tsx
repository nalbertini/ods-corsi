import { useEffect, useState } from 'react'
import { INFORMATIVA_PUBBLICA, MODULO_IN_APP, PAGAMENTO } from '../lib/iscrizione'
import { apriAspettoModulo } from '../lib/aspettoModulo'
import { COME_SI_PAGA, fondoDellaPagina, INFORMATIVA_FRASE } from '../lib/paginaIscrizioni'
import { Costi } from './Costi'
import { Dettaglio, Riquadro, Tasti, Tasto, Titoletto } from './ds'
import { ModuloIscrizione } from './ModuloIscrizione'

/**
 * La pagina dei prezzi e del pagamento (`iscrizioni/#prezzi`), che si apre da
 * PREZZI E PAGAMENTO: il listino intero, come si paga e il tasto per
 * cominciare. Ha il suo indirizzo, così l'indietro del browser riporta alla
 * pagina e il link si può mandare. Chiuso il modulo aperto da qui, si torna in
 * cima a `iscrizioni/` (scelta dell'utente).
 */
export function PrezziIscrizione() {
  const [modulo, setModulo] = useState(false)
  // Come la pagina: il modulo, chiudendosi, spegne l'aspetto del sito.
  useEffect(() => apriAspettoModulo(), [modulo])
  const vai = (aperto: boolean) => {
    setModulo(aperto)
    document.querySelector('.scroll')?.scrollTo(0, 0)
  }
  const torna = () => {
    // Senza cancelletto si torna alla pagina; replaceState non lascerebbe l'evento che App ascolta.
    window.location.hash = ''
  }

  if (!modulo) {
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
            <Tasto variante="principale" onClick={() => vai(true)}>
              COMPILA LA RICHIESTA
            </Tasto>
          )}
          <Dettaglio tono={f.tasto ? undefined : 'testo'}>{f.frase}</Dettaglio>
          {f.tasto && INFORMATIVA_PUBBLICA && (
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

  return (
    <div className="iscrizioni-modulo">
      <Titoletto>RICHIESTA DI ISCRIZIONE</Titoletto>
      <ModuloIscrizione onChiudi={torna} />
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
            <Tasto onClick={copia}>{copiato ? 'COPIATO' : 'COPIA IBAN'}</Tasto>
            {PAGAMENTO.satispay && <Tasto href={PAGAMENTO.satispay}>PAGA CON SATISPAY</Tasto>}
          </Tasti>
        </Riquadro>
      </div>
    </section>
  )
}
