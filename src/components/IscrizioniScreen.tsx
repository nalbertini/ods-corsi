import { useEffect, useState } from 'react'
import { INFORMATIVA_PUBBLICA, MODULO_IN_APP, PAGAMENTO, PROVA } from '../lib/iscrizione'
import { apriAspettoModulo } from '../lib/aspettoModulo'
import { INDIRIZZO_PREZZI } from '../lib/cancelletti'
import { APERTURA, COSA_SERVE, costiBreve, DUBBIO, fondoDellaPagina, INFORMATIVA_FRASE, moduloDalCancelletto, PROVA_CHIAMA, provaEDubbi, sezioniPagina, type Sezione } from '../lib/paginaIscrizioni'
import { CONTATTI, SITO, chiama } from '../lib/sito'
import { useListino } from './Costi'
import { Dettaglio, Etichetta, Cifra, Riquadro, Tasti, Tasto, Titoletto } from './ds'
import { Logo } from './Logo'
import { ModuloIscrizione } from './ModuloIscrizione'
import { PagamentoOnline } from './PagamentoOnline'

/**
 * La pagina pubblica delle iscrizioni (`iscrizioni/`), corta: cosa preparare,
 * quanto costa in breve, la prova e i dubbi, e in fondo il tasto per
 * cominciare. I prezzi di ogni corso e come si paga stanno nella pagina a
 * parte (`PrezziIscrizione`, a `#prezzi`). L'ordine delle sezioni è in
 * `sezioniPagina`; il tasto apre il modulo di iscrizione al posto della pagina.
 *
 * Ha l'aspetto del sito (`apriAspettoModulo`) per tutta la pagina e non solo
 * per il modulo: chi arriva dal sito non deve vedere il tema dell'app. La
 * testata dell'app qui non c'è (`vistaIscrizioni`): il marchio sta sopra il titolo.
 */
export function IscrizioniScreen() {
  // Dal tasto per cominciare della pagina dei prezzi si arriva col modulo già aperto.
  const [modulo, setModulo] = useState(() => moduloDalCancelletto(window.location.hash))
  useEffect(() => {
    // Il cancelletto ha fatto il suo: via, così chiudere il modulo lascia la pagina pulita.
    if (moduloDalCancelletto(window.location.hash)) history.replaceState(null, '', window.location.pathname + window.location.search)
  }, [])
  // Dipende da `modulo`: il modulo, chiudendosi, spegne l'aspetto, e la pagina lo deve rimettere.
  useEffect(() => apriAspettoModulo(), [modulo])
  const vai = (aperto: boolean) => {
    setModulo(aperto)
    document.querySelector('.scroll')?.scrollTo(0, 0)
  }

  // Il ritorno dall'app di pagamento, o il link salvato per pagare dopo.
  const [pagamento, setPagamento] = useState(() => new URLSearchParams(window.location.search).get('pagamento'))
  if (pagamento) {
    const chiudi = () => {
      const u = new URLSearchParams(window.location.search)
      u.delete('pagamento')
      history.replaceState(null, '', window.location.pathname + (u.size ? `?${u}` : ''))
      setPagamento(null)
    }
    return (
      <div className="iscrizioni-modulo">
        <Titoletto>RICHIESTA DI ISCRIZIONE</Titoletto>
        <PagamentoOnline richiestaId={pagamento} onChiudi={chiudi} />
      </div>
    )
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
    apertura: () => <Apertura />,
    serve: () => <CosaServe />,
    costiBreve: () => <InBreve />,
    provaDubbi: () => <ProvaEDubbi />,
    richiesta: () => <Fondo onModulo={() => vai(true)} />,
  }

  return (
    <div className="iscrizioni">
      {sezioniPagina(MODULO_IN_APP).map((s) => (
        <div key={s}>{sezioni[s]()}</div>
      ))}
    </div>
  )
}

/** Una sola intestazione: il marchio, il titolo e la frase. Nessun tasto in cima: il tasto per cominciare sta in fondo. */
function Apertura() {
  return (
    <section className="pad stack iscrizioni-apertura">
      <Logo width={64} />
      <h1 className="iscrizioni-titolo">{APERTURA.titolo}</h1>
      <span className="iscrizioni-frase">{APERTURA.frase}</span>
    </section>
  )
}

/** Cosa preparare, una cosa per riga: la casella si spunta a mente, la pagina non salva niente. */
function CosaServe() {
  return (
    <section>
      <Titoletto>COSA TI SERVE</Titoletto>
      <div className="pad">
        <ul className="card iscrizioni-serve">
          {COSA_SERVE.map((v) => (
            <li key={v.titolo} className="iscrizioni-serve-voce">
              <span className="iscrizioni-casella" aria-hidden="true" />
              <span className="stack iscrizioni-serve-testo">
                <span className="passo-titolo">{v.titolo}</span>
                {v.quando && <span className="iscrizioni-quando">{v.quando}</span>}
                <Dettaglio>{v.nota}</Dettaglio>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

/** Quanto costa, in breve: la quota del listino che vale e le offerte; il resto con PREZZI E PAGAMENTO. */
function InBreve() {
  const letto = useListino()
  if (!letto) {
    return (
      <section className="pad iscrizioni-costi-breve">
        <Riquadro>
          <Dettaglio>Un attimo…</Dettaglio>
        </Riquadro>
      </section>
    )
  }
  const c = costiBreve(letto.listino.quota, !!PAGAMENTO.satispay)
  return (
    <section className="pad iscrizioni-costi-breve">
      <Riquadro>
        <Etichetta>{c.etichetta}</Etichetta>
        <span className="passo-titolo">{c.titolo}</span>
        {c.righe.map((r) => (
          <span key={r.testo} className="iscrizioni-riga">
            <span>{r.testo}</span>
            <Cifra>{r.cifra}</Cifra>
          </span>
        ))}
        <Dettaglio>{c.testo}</Dettaglio>
        {/* Il cancelletto a mano: un href «#prezzi», con <base href="../">, porterebbe alla radice. */}
        <Tasto
          onClick={() => {
            window.location.hash = INDIRIZZO_PREZZI
            // Segna che si arriva dalla pagina: TORNA ALLE ISCRIZIONI torna indietro invece di aggiungere un passo.
            history.replaceState({ daPagina: true }, '')
          }}
        >
          {c.tasto}
        </Tasto>
      </Riquadro>
    </section>
  )
}

/** La prova e i dubbi in un riquadro solo: è l'unico posto della pagina con CHIAMA. */
function ProvaEDubbi() {
  const t = provaEDubbi(CONTATTI)
  return (
    <section className="pad iscrizioni-prova">
      <Riquadro tono="prova">
        <Etichetta>{t.etichetta.toUpperCase()}</Etichetta>
        {PROVA.costi.map((c) => (
          <span key={c.cosa} className="row prova-testa">
            <span className="passo-titolo">{c.cosa} di prova</span>
            <Cifra>{c.costo}</Cifra>
          </span>
        ))}
        <Dettaglio>{PROVA.testo}</Dettaglio>
        <Dettaglio tono="testo">{t.frase}</Dettaglio>
        <Tasti>
          <Tasto href={chiama} qui>
            CHIAMA
          </Tasto>
          <Tasto href={CONTATTI.mappa}>MAPPA</Tasto>
        </Tasti>
      </Riquadro>
    </section>
  )
}

/** In fondo, una volta sola: il tasto per cominciare con l'avviso e l'informativa, o l'invito a chiamare. */
function Fondo({ onModulo }: { onModulo: () => void }) {
  const f = fondoDellaPagina(MODULO_IN_APP)
  return (
    <section className="pad stack iscrizioni-richiesta">
      {f.tasto && (
        <Tasto variante="principale" onClick={onModulo}>
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
  )
}

/** Per chi non ha ancora deciso. L'etichetta è un prop perché il modulo a passi (`IscrizioneAPassi`) tiene «PRIMA DI ISCRIVERTI». */
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
        <Dettaglio>{PROVA.testo} {PROVA_CHIAMA}</Dettaglio>
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
        <span className="passo-titolo">{DUBBIO}</span>
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
