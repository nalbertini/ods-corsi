import { useEffect, useState } from 'react'
import { INFORMATIVA_PUBBLICA, MODULI, MODULO_IN_APP, PAGAMENTO, PROVA } from '../lib/iscrizione'
import { apriAspettoModulo } from '../lib/aspettoModulo'
import { APERTURA, AVVISO_RICHIESTA, COME_SI_PAGA, COSA_SERVE, MODULO_DA_LEGGERE, SENZA_MODULO, sezioniPagina, type Sezione } from '../lib/paginaIscrizioni'
import { CONTATTI, SITO, chiama } from '../lib/sito'
import { Costi } from './Costi'
import { Dettaglio, Etichetta, Cifra, Riquadro, Tasti, Tasto, Titoletto } from './ds'
import { ModuloIscrizione } from './ModuloIscrizione'

/**
 * La pagina pubblica delle iscrizioni (`iscrizioni/`): chi arriva dal sito
 * trova subito il tasto per cominciare, cosa tenere pronto, quanto costa e
 * come si paga. L'ordine delle sezioni è in `sezioniPagina`; il tasto apre il
 * modulo di iscrizione al posto della pagina.
 *
 * Ha l'aspetto del sito (`apriAspettoModulo`) per tutta la pagina e non solo
 * per il modulo: chi arriva dal sito non deve vedere il tema dell'app.
 */
export function IscrizioniScreen() {
  const [modulo, setModulo] = useState(false)
  // Dipende da `modulo`: il modulo, chiudendosi, spegne l'aspetto, e la pagina lo deve rimettere.
  useEffect(() => apriAspettoModulo(), [modulo])
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

  const sezioni: Record<Sezione, () => JSX.Element> = {
    apertura: () => <Apertura onModulo={() => vai(true)} />,
    serve: () => <CosaServe />,
    prova: () => <Prova />,
    costi: () => <Costi />,
    paga: () => <ComeSiPaga />,
    richiesta: () => (
      <div className="pad iscrizioni-richiesta">
        <Tasto variante="principale" onClick={() => vai(true)}>
          COMPILA LA RICHIESTA
        </Tasto>
      </div>
    ),
    modulo: () => <ModuloDaLeggere />,
    aiuto: () => <Contatti social={false} />,
    piede: () => <Piede />,
  }

  return (
    <div className="iscrizioni">
      {sezioniPagina(MODULO_IN_APP).map((s) => (
        <div key={s}>{sezioni[s]()}</div>
      ))}
    </div>
  )
}

/** La frase, il tasto per cominciare e quel che serve sapere prima: la richiesta non chiude l'iscrizione, e l'informativa. */
function Apertura({ onModulo }: { onModulo: () => void }) {
  return (
    <section className="pad stack iscrizioni-apertura">
      <h1 className="iscrizioni-titolo">{APERTURA.titolo}</h1>
      <span className="iscrizioni-frase">{APERTURA.frase}</span>
      {MODULO_IN_APP ? (
        <Tasto variante="principale" onClick={onModulo}>
          COMPILA LA RICHIESTA
        </Tasto>
      ) : (
        <Dettaglio tono="testo">{SENZA_MODULO}</Dettaglio>
      )}
      <Tasto href={chiama} qui>
        CHIAMA
      </Tasto>
      {MODULO_IN_APP && <Dettaglio>{AVVISO_RICHIESTA}</Dettaglio>}
      {INFORMATIVA_PUBBLICA && (
        <Dettaglio>
          Come trattiamo i tuoi dati:{' '}
          <a href={INFORMATIVA_PUBBLICA} target="_blank" rel="noreferrer" className="link-sec">
            l'informativa privacy
          </a>
          .
        </Dettaglio>
      )}
    </section>
  )
}

function CosaServe() {
  return (
    <section>
      <Titoletto>COSA TI SERVE</Titoletto>
      <div className="pad">
        <Riquadro>
          {COSA_SERVE.map((riga) => (
            <Dettaglio key={riga} tono="testo">
              {riga}
            </Dettaglio>
          ))}
        </Riquadro>
      </div>
    </section>
  )
}

/** Per chi non ha ancora deciso: dopo i passi dell'iscrizione nel modulo a passi, prima dei costi qui. */
export function Prova({ etichetta = 'PRIMA DI ISCRIVERTI' }: { etichetta?: string }) {
  return (
    <section className="pad iscrizioni-prova">
      <Riquadro tono="prova">
        <Etichetta>{etichetta.toUpperCase()}</Etichetta>
        {PROVA.costi.map((c) => (
          <span key={c.cosa} className="row prova-testa">
            <span className="passo-titolo">{c.cosa} di prova</span>
            <Cifra>{c.costo}</Cifra>
          </span>
        ))}
        <Dettaglio>{PROVA.testo} Per cominciare, passa in palestra o chiamaci.</Dettaglio>
        <Tasto href={chiama} qui>
          CHIAMA
        </Tasto>
      </Riquadro>
    </section>
  )
}

/** Dove siamo e come ci si trova. `social` falso: solo CHIAMA e MAPPA, gli altri link stanno nel piede. */
export function Contatti({ social = true }: { social?: boolean }) {
  return (
    <section className="pad iscrizioni-contatti">
      <Riquadro>
        <span className="passo-titolo">Hai un dubbio? Chiamaci o passa in palestra.</span>
        <Dettaglio>
          {CONTATTI.indirizzo}. Telefono <span className="num testo-pieno">{CONTATTI.telefono}</span>.
        </Dettaglio>
        <Tasti>
          <Tasto href={chiama} qui>
            CHIAMA
          </Tasto>
          <Tasto href={CONTATTI.mappa}>MAPPA</Tasto>
          {social && <Tasto href={CONTATTI.instagram}>INSTAGRAM</Tasto>}
          {social && <Tasto href={CONTATTI.facebook}>FACEBOOK</Tasto>}
          {social && <Tasto href={SITO}>IL SITO</Tasto>}
        </Tasti>
      </Riquadro>
    </section>
  )
}

function Piede() {
  return (
    <section className="pad iscrizioni-piede">
      <Tasti>
        <Tasto href={CONTATTI.instagram}>INSTAGRAM</Tasto>
        <Tasto href={CONTATTI.facebook}>FACEBOOK</Tasto>
        <Tasto href={SITO}>IL SITO</Tasto>
      </Tasti>
    </section>
  )
}

function ModuloDaLeggere() {
  return (
    <section>
      <Titoletto>IL MODULO</Titoletto>
      <div className="pad">
        <Riquadro>
          <span className="passo-titolo">{MODULO_DA_LEGGERE.titolo}</span>
          <Dettaglio>{MODULO_DA_LEGGERE.testo}</Dettaglio>
          <Tasti>
            {MODULI.map((m) => (
              <Tasto key={m.file} href={m.file} scarica>
                {m.etichetta}
              </Tasto>
            ))}
          </Tasti>
        </Riquadro>
      </div>
    </section>
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
