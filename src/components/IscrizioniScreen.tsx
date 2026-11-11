import { useEffect, useState } from 'react'
import { INFORMATIVA_PUBBLICA, MODULO_IN_APP, PAGAMENTO, PROVA } from '../lib/iscrizione'
import { apriAspettoModulo } from '../lib/aspettoModulo'
import { INDIRIZZO_PREZZI } from '../lib/cancelletti'
import { LISTINO_PREDEFINITO } from '../lib/listino'
import { APERTURA, costiBreve, cosaServe, DUBBIO, fondoDellaPagina, INFORMATIVA_FRASE, moduloDalCancelletto, PROVA_CHIAMA, provaEDubbi, sezioniPagina, type Sezione } from '../lib/paginaIscrizioni'
import { CONTATTI, SITO, chiama } from '../lib/sito'
import { datiRichieste } from '../lib/richieste'
import { useListino } from './Costi'
import { Dettaglio, Etichetta, Cifra, Riquadro, Tasti, Tasto, Titoletto } from './ds'
import { Icona } from './Icons'
import { Logo } from './Logo'
import { ModuloIscrizione } from './ModuloIscrizione'
import { PagamentoOnline, RitornoDalPagamento } from './PagamentoOnline'

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
    // Il tasto che ha aperto il modulo sparisce: senza questo il fuoco resta sul corpo della pagina.
    if (aperto) setTimeout(() => document.querySelector<HTMLElement>('.iscrizioni-modulo')?.focus(), 0)
  }

  // Il ritorno dall'app di pagamento dopo aver pagato in fondo al modulo: la richiesta si manda dal modulo.
  const [ritorno, setRitorno] = useState(() => new URLSearchParams(window.location.search).get('satispay'))
  // Il ritorno dall'app di pagamento del flusso di prima, o il link salvato per pagare dopo.
  const [pagamento, setPagamento] = useState(() => new URLSearchParams(window.location.search).get('pagamento'))
  // Via dall'indirizzo il parametro della pagina di ritorno, e si torna alle iscrizioni.
  const togli = (chiave: string, metti: (x: null) => void) => () => {
    const u = new URLSearchParams(window.location.search)
    u.delete(chiave)
    history.replaceState(null, '', window.location.pathname + (u.size ? `?${u}` : ''))
    metti(null)
  }
  if (ritorno) {
    const chiudi = togli('satispay', setRitorno)
    return (
      <div className="iscrizioni-modulo">
        <Titoletto>RICHIESTA DI ISCRIZIONE</Titoletto>
        <RitornoDalPagamento pagamentoId={ritorno} onChiudi={chiudi} />
      </div>
    )
  }

  if (pagamento) {
    const chiudi = togli('pagamento', setPagamento)
    return (
      <div className="iscrizioni-modulo">
        <Titoletto>RICHIESTA DI ISCRIZIONE</Titoletto>
        <PagamentoOnline richiestaId={pagamento} onChiudi={chiudi} />
      </div>
    )
  }

  if (modulo) {
    return (
      <div className="iscrizioni-modulo" tabIndex={-1}>
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

/** Cosa ti serve, in due gruppi: un'icona per riga, niente caselle (la pagina non salva niente). */
function CosaServe() {
  // I giorni per il certificato, come nel modulo: finché non arrivano (o se il server non risponde) la nota non dà un numero.
  const [giorni, setGiorni] = useState<number | null>(null)
  useEffect(() => {
    let vivo = true
    void datiRichieste()
      .then((x) => x.certificatoGiorni())
      .then((g) => vivo && setGiorni(g))
      .catch(() => undefined)
    return () => {
      vivo = false
    }
  }, [])
  return (
    <section>
      <Titoletto>COSA TI SERVE</Titoletto>
      <div className="pad stack iscrizioni-serve-gruppi">
        {cosaServe(giorni, !!PAGAMENTO.satispay).map((g) => (
          <div key={g.etichetta} className="stack iscrizioni-serve-gruppo">
            <span className="iscrizioni-serve-etichetta">{g.etichetta}</span>
            <ul className="card iscrizioni-serve">
              {g.voci.map((v) => (
                <li key={v.titolo} className="iscrizioni-serve-voce">
                  <span className="iscrizioni-serve-icona"><Icona nome={v.icona} misura={22} /></span>
                  <span className="stack iscrizioni-serve-testo">
                    <span className="iscrizioni-serve-titolo">
                      <span className="passo-titolo">{v.titolo}</span>
                      {v.quando && <span className="iscrizioni-quando">{v.quando}</span>}
                    </span>
                    <Dettaglio>{v.nota}</Dettaglio>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}

/** Quanto costa, in breve: la quota del listino che vale e le offerte; il resto con PREZZI E PAGAMENTO. */
function InBreve() {
  const letto = useListino()
  // Aspettando il listino il riquadro c'è già, nascosto, con la quota del foglio: tiene la sua altezza vera a ogni larghezza, e la pagina non salta (CLS).
  const c = costiBreve((letto?.listino ?? LISTINO_PREDEFINITO).quota, !!PAGAMENTO.satispay)
  return (
    <section className={letto ? 'pad iscrizioni-costi-breve' : 'pad iscrizioni-costi-breve iscrizioni-costi-attesa'}>
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
