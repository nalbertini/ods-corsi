import { lazy, type ReactNode, Suspense, useEffect, useRef, useState } from 'react'
import type { DatiSegreteria } from '../../lib/segreteria'
import { datiSegreteria } from '../../lib/segreteria'
import { Logo } from '../Logo'
import { TastoTema } from '../TastoTema'
import { Cursori, ICONE_MENU, ICONE_SCHEDE } from '../Icons'
import { Settimana } from './Settimana'
import { datiVestiario } from '../../lib/vestiarioDati'
import { tastoLinguette } from '../../lib/schedaSezioni'
import { numeriRaccolta } from '../../lib/vestiario'
import { puo } from '../../lib/ruoli'
import { Palestra } from './banco/Palestra'
// Il pannello del sito porta con sé l'editor del testo e la sua pulizia: si scaricano solo aprendolo.
// Le voci che non sono la prima schermata si scaricano quando si aprono.
const Statistiche = lazy(() => import('./Statistiche').then((m) => ({ default: m.Statistiche })))
const Listino = lazy(() => import('./Listino').then((m) => ({ default: m.Listino })))
const Contabilita = lazy(() => import('./Contabilita').then((m) => ({ default: m.Contabilita })))
const Importazioni = lazy(() => import('./Importazioni').then((m) => ({ default: m.Importazioni })))
const Regole = lazy(() => import('./Regole').then((m) => ({ default: m.Regole })))
const Richieste = lazy(() => import('./Richieste').then((m) => ({ default: m.Richieste })))
const PresenzeIstruttori = lazy(() => import('./PresenzeIstruttori').then((m) => ({ default: m.PresenzeIstruttori })))
const Segnalazioni = lazy(() => import('./Segnalazioni').then((m) => ({ default: m.Segnalazioni })))
const Personale = lazy(() => import('./Personale').then((m) => ({ default: m.Personale })))
const Corsi = lazy(() => import('./Corsi').then((m) => ({ default: m.Corsi })))
const Iscritti = lazy(() => import('./Iscritti').then((m) => ({ default: m.Iscritti })))
const Presenze = lazy(() => import('./Presenze').then((m) => ({ default: m.Presenze })))
const Compensi = lazy(() => import('./Compensi').then((m) => ({ default: m.Compensi })))
const Vestiario = lazy(() => import('./Vestiario').then((m) => ({ default: m.Vestiario })))
const Gare = lazy(() => import('./Gare').then((m) => ({ default: m.Gare })))
const PresenzeSegnalate = lazy(() => import('./PresenzeSegnalate').then((m) => ({ default: m.PresenzeSegnalate })))
const Sito = lazy(() => import('./Sito').then((m) => ({ default: m.Sito })))
import { tocca } from '../../lib/segnalazioni'
import { DaFare, useDaFare } from './DaFare'
import { CosaManca } from './CosaManca'
import { strisciaVisibile } from '../../lib/cosaManca'
import { useStrisciaVoluta } from '../../lib/preferenzaStriscia'
import { bozzaAperta, chiedi, Conferme, dialogoAperto, Guaio, lasciare, scordaBozze, useDialogo } from './comune'
import { TELEFONO, useSchermo } from '../../lib/largo'
import { aspettoInUso, useAspetto } from '../../lib/aspetto'
import { BarraBanco } from './banco/BarraBanco'
import { Oggi } from './banco/Oggi'
import { PersonaBanco } from './banco/PersonaBanco'
import { CercaIscritto } from './CercaIscritto'
import type { Ricercata } from '../../lib/ricerca'
import { indirizzoPagina } from '../../lib/guida'
import { indirizzo, INDIRIZZI, linkOrdini } from '../../lib/aree'
import { linkDellaSegreteria } from '../../lib/provenienza'
import { VERSIONE, VERSIONE_ESTESA } from '../../lib/versione'
import { dopoIndietro, filtroDopo, indirizzoCorretto, leggiIndirizzo, postoDelMenu, scriviIndirizzo, type FiltroSegreteria, type Posto, type Voce } from '../../lib/indirizzoSegreteria'
import { eScorciatoiaDiRicerca } from '../../lib/scorciatoiaRicerca'
import { guidaDellaVoce, indirizzoConsentito, leggeLaSegreteria, menuDi, postoConsentito, primaVoce, titoloDelMenu, vociConsentite } from '../../lib/menuSegreteria'
import { titoloDellaVoce } from '../../lib/luoghiBanco'
import '../../segreteria.css'

export type { Voce }

/** Dove portare la segreteria da un'altra sezione: la scheda di qualcuno, una lezione da aprire. */
export interface Destinazione {
  persona?: string
  corso?: string
  /** Con `persona`: il corso da cui si apre la scheda, a cui riporta «‹ CORSO». */
  daCorso?: string
  /** Una richiesta da aprire, scelta dalla ricerca. */
  richiesta?: string
  /** Un movimento di CONTABILITÀ da aprire, dalla scheda di una persona. */
  movimento?: string
  /** Cosa si è cercato e chi è uscito: la voce mostra solo quelli, finché non si dice MOSTRA TUTTI. */
  ricerca?: Ricercata
  lezione?: { id: string; inizio: string }
  /** Un filtro già acceso: chi ha il certificato da sistemare, chi deve pagare, chi ha un file di prima, cosa c'è da stampare. */
  filtro?: FiltroSegreteria
}

/** Scrive l'indirizzo della segreteria nella cronologia, senza ricaricare. */
function scrivi(hash: string, passo: 'push' | 'replace') {
  // Con percorso e query: le pagine delle aree hanno <base href="../">, e un «#…» da solo porterebbe via.
  const url = window.location.pathname + window.location.search + hash
  if (passo === 'push') window.history.pushState(null, '', url)
  else window.history.replaceState(null, '', url)
}

/** Se il passo di adesso è quello del menu aperto sul telefono (vedi `apriMenu`). */
// `history.state` è `any`: qui ci scrive solo la segreteria, `{ menu: true }` o niente.
const nelMenu = () => (window.history.state as { menu?: boolean } | null)?.menu === true

/** L'indirizzo della pagina pubblica per iscriversi, quello da mandare su WhatsApp. */
// Con ?da=segreteria: le richieste che arrivano da qui si contano come «Link della segreteria» (provenienza.ts).
const LINK_PUBBLICO = linkDellaSegreteria(indirizzo(INDIRIZZI.iscrizioni))

function CopiaLink({ link, testo, perche }: { link: string; testo: string; perche: string }) {
  const [copiato, setCopiato] = useState(false)
  useEffect(() => {
    if (!copiato) return
    const t = window.setTimeout(() => setCopiato(false), 2500)
    return () => window.clearTimeout(t)
  }, [copiato])
  const copia = () => {
    // Senza appunti (una pagina non sicura, un browser vecchio) si fa vedere
    // l'indirizzo da copiare a mano.
    if (!navigator.clipboard) return window.prompt(perche, link)
    navigator.clipboard.writeText(link).then(
      () => setCopiato(true),
      () => window.prompt(perche, link),
    )
  }
  return (
    <button type="button" className="num sg-voce" onClick={copia} title={link}>
      <ICONE_MENU.link />
      <span className="sg-voce-testo">{copiato ? 'Link copiato ✓' : testo}</span>
    </button>
  )
}

/**
 * La segreteria: il menu a sinistra e la sezione scelta a destra.
 *
 * È pensata per il computer della reception, non per il telefono: le tabelle
 * vogliono spazio. Sul telefono il menu si chiude dietro una barra in cima,
 * col tasto MENU, e le colonne si mettono una sotto l'altra, così si può
 * comunque dare un'occhiata.
 */
export function Segreteria({
  nome,
  ruolo = 'Segreteria',
  chi,
  prova,
  onEsci,
  onIstruttori,
}: {
  nome: string
  ruolo?: string
  /** Le autorizzazioni di chi è dentro: il menu mostra le voci di tutte, in un posto solo. */
  chi: { ruolo: string; ancheIstruttore?: boolean; ancheAmministrazione?: boolean }
  prova: boolean
  onEsci?: () => void
  /** Per chi insegna anche: il passaggio al calendario, senza uscire. */
  onIstruttori?: () => void
}) {
  const gruppi = menuDi(chi)
  const consentite = vociConsentite(chi, { prova })
  // La segreteria legge le persone, le richieste e il resto; chi ha solo l'amministrazione vede i conti e basta.
  const conSegreteria = leggeLaSegreteria(chi)
  const consenti = (p: Posto): Posto => postoConsentito(p, chi, { prova })
  const etichetta = titoloDelMenu(chi)
  const [d, setD] = useState<DatiSegreteria | null>(null)
  // Dove si è sta nell'indirizzo (vedi `indirizzoSegreteria.ts`): si parte
  // da lì anche se i dati arrivano dopo, e Indietro/Avanti ci riportano.
  const [posto, setPosto] = useState<Posto>(() => consenti(leggiIndirizzo(window.location.hash, { prova }) ?? { voce: primaVoce(chi) ?? 'dafare' }))
  const voce = posto.voce
  // Il filtro acceso da DA FARE resta fuori dall'indirizzo: è un punto di partenza, non un posto.
  const [filtro, setFiltro] = useState<Destinazione['filtro']>()
  // Come il filtro: un punto di partenza dato dalla ricerca, non un posto dell'indirizzo.
  const [ricerca, setRicerca] = useState<Ricercata>()
  const [richiesta, setRichiesta] = useState<string>()
  // La ricerca aperta con ⌘K / Ctrl+K, in una finestra al centro.
  const [finestra, setFinestra] = useState(false)
  const [movimento, setMovimento] = useState<string>()
  // Il menu del telefono, aperto o chiuso; sul computer non conta.
  const [aperto, setAperto] = useState(false)
  // Sul telefono il menu aperto è un passo della cronologia, sullo stesso
  // indirizzo: Indietro lo chiude senza spostarsi, come fanno le app.
  const apriMenu = () => {
    setAperto(true)
    if (window.matchMedia(TELEFONO).matches && !nelMenu()) window.history.pushState({ menu: true }, '')
  }
  /** Chiuso da un tasto: si toglie il passo del menu, se c'è, se no Avanti lo riaprirebbe. */
  const chiudiMenu = () => {
    setAperto(false)
    if (nelMenu()) window.history.back()
  }
  // Il posto di adesso per chi ascolta il browser, che non vede lo stato dell'ultimo giro.
  const ora = useRef(posto)
  /** Va in un posto: `push` è un passo per Indietro, `replace` corregge quello di adesso. */
  const segna = (p: Posto, passo: 'push' | 'replace') => {
    const prima = scriviIndirizzo(ora.current)
    ora.current = p
    setPosto(p)
    const h = scriviIndirizzo(p)
    if (h !== prima) scrivi(h, passo)
  }
  const vai = async (v: Voce, d: Destinazione = {}) => {
    const dalMenu = aperto
    // Un modulo scritto a metà (una ricevuta, un iscritto nuovo) non si perde con
    // un clic sul menu. Chi resta torna al modulo: sul telefono il menu lo coprirebbe.
    if (!(await lasciare())) return chiudiMenu()
    setFiltro(filtroDopo(ora.current.voce, v, filtro, d.filtro))
    setRicerca(d.ricerca)
    setRichiesta(d.richiesta)
    setMovimento(d.movimento)
    // Dal menu del telefono la voce scelta prende il posto del passo del
    // menu: Indietro poi torna alla voce di prima, non al menu aperto.
    segna(postoDelMenu(ora.current, v, d), nelMenu() ? 'replace' : 'push')
    // Stessa voce, stesso indirizzo: il passo del menu è ancora lì.
    chiudiMenu()
    // Dal menu del telefono il tasto premuto sparisce: la tastiera riparte dalla voce aperta.
    if (dalMenu) vaiAlContenuto()
  }
  /** Il fuoco sul contenuto, anche dal menu del telefono aperto: il menu si chiude. */
  function vaiAlContenuto() {
    if (aperto) chiudiMenu()
    // `inert` lo toglie un effetto, ma solo al giro dopo: un elemento inert il fuoco non lo prende.
    const corpo = document.getElementById('sg-contenuto')
    corpo?.removeAttribute('inert')
    corpo?.focus({ preventScroll: true })
  }
  useEffect(() => {
    // Un indirizzo che non si capisce diventa quello giusto; quello degli altri si lascia stare.
    const correggi = () => {
      // Un indirizzo che non si capisce, o una voce che il menu non offre a questa persona (`#iscritti` a chi cura solo i conti).
      // `chi` non cambia finché la segreteria è aperta: l'effetto resta quello del primo giro.
      const h = indirizzoCorretto(window.location.hash, { prova }) ?? indirizzoConsentito(window.location.hash, chi, { prova })
      if (h) scrivi(indirizzoConsentito(h, chi, { prova }) ?? h, 'replace')
    }
    correggi()
    // Mentre si chiede della bozza, un altro Indietro non fa una seconda domanda:
    // la prima resterebbe senza risposta.
    let chiedendo = false
    const torna = async () => {
      // Il menu del telefono segue la cronologia: aperto solo sul suo passo.
      setAperto(nelMenu())
      if (chiedendo) return
      if (!dopoIndietro(ora.current, window.location.hash, { prova })) return correggi()
      // Indietro con un modulo a metà: la stessa domanda del menu, e chi torna a
      // finire ritrova l'indirizzo del modulo.
      if (bozzaAperta()) {
        chiedendo = true
        const lascia = await lasciare()
        chiedendo = false
        if (!lascia) return scrivi(scriviIndirizzo(ora.current), 'push')
      }
      // Durante la domanda si può essere andati ancora indietro: conta dove si è adesso.
      const dopo = dopoIndietro(ora.current, window.location.hash, { prova })
      if (!dopo) return correggi()
      const letto = consenti(dopo)
      if (letto.voce !== ora.current.voce) setFiltro(undefined)
      ora.current = letto
      setPosto(letto)
      correggi()
    }
    window.addEventListener('popstate', torna)
    return () => window.removeEventListener('popstate', torna)
  }, [prova])
  useEffect(() => {
    if (!aperto) return
    const esc = (e: KeyboardEvent) => {
      // Con una domanda aperta («Lasciare a metà…») l'Esc risponde a lei, e il menu resta com'è.
      if (e.key !== 'Escape' || dialogoAperto()) return
      chiudiMenu()
      // Il fuoco torna sul tasto che l'ha aperto, non si perde sulla pagina.
      document.querySelector<HTMLElement>('.sg-tasto-menu')?.focus()
    }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [aperto])
  // Col menu del telefono aperto la pagina sotto non si raggiunge col Tab. Solo
  // sotto i 768px: più largo il menu sta di fianco, e la pagina va usata.
  // `inert` si scrive a mano: i tipi di React 18 non lo conoscono.
  const telefono = useSchermo(TELEFONO)
  // Sul telefono Il Banco non c'è ancora: resta l'aspetto di sempre, anche se è scelto (vedi `aspettoInUso`).
  const [scelto] = useAspetto()
  const aspetto = aspettoInUso(scelto, telefono, conSegreteria)
  const banco = aspetto === 'banco'
  useEffect(() => {
    const corpo = document.getElementById('sg-contenuto')
    corpo?.toggleAttribute('inert', aperto && telefono)
    return () => corpo?.removeAttribute('inert')
  }, [aperto, telefono])

  // Quello che aspetta la segreteria: il menu dice quante richieste, presenze
  // di istruttori e segnalate, da qualunque voce; DA FARE conta tutto. Si
  // riconta cambiando voce, e quando una sezione dice che è cambiato qualcosa.
  const [giroConte, setGiroConte] = useState(0)
  // La gara toccata nella SETTIMANA: GARE si apre su di lei. Uscendo da GARE si dimentica.
  const [garaDaAprire, setGaraDaAprire] = useState<string>()
  useEffect(() => {
    if (voce !== 'gare') setGaraDaAprire(undefined)
  }, [voce])
  // Quando i conti della striscia vanno riletti per forza: un appello segnato, una richiesta accolta, una scheda cambiata, RICONTA.
  const [giroStriscia, setGiroStriscia] = useState(0)
  const contiCambiati = () => {
    setGiroConte((g) => g + 1)
    setGiroStriscia((g) => g + 1)
  }
  const [strisciaVoluta] = useStrisciaVoluta()
  const conti = useDaFare(conSegreteria ? d : null, voce === 'dafare', `${voce}-${giroConte}`, giroStriscia)
  const richiesteNuove = conti.richieste ?? 0
  const daConfermare = conti.istruttori ?? 0
  const segnalateDaVedere = conti.segnalate ?? 0
  // Le segnalate ci sono solo in prova: lì PRESENZE ha due schede.
  const conSegnalate = d?.modo === 'prova' && !!d.segnalate
  const inPresenze = voce === 'presenze' || voce === 'segnalate'
  // Il menu è più alto di uno schermo da reception: la voce aperta (anche dopo
  // una ricarica, o con Indietro) si porta in vista.
  useEffect(() => {
    document.querySelector('#sg-menu .sg-voce[aria-current="page"]')?.scrollIntoView({ block: 'nearest' })
  }, [voce])
  // La scheda del browser dice la voce aperta: fra più schede, nella cronologia e nei segnalibri si riconosce.
  useEffect(() => {
    document.title = titoloDellaVoce(voce)
  }, [voce])
  const segno = (n: number, detto: string) =>
    n > 0 && (
      <span className="num sg-tag" data-tipo="presto" style={{ marginLeft: 8, whiteSpace: 'nowrap' }}>
        <span aria-hidden="true">{n}</span>
        <span className="vh"> {detto}</span>
      </span>
    )
  // Le segnalazioni che aspettano una risposta: aperte, e l'ultimo a scrivere è un altro.
  const [daRispondere, setDaRispondere] = useState(0)
  useEffect(() => {
    if (!d || !conSegreteria) return
    let vivo = true
    d.segnalazioni().then(
      (l) => vivo && setDaRispondere(l.filter(tocca).length),
      () => vivo && setDaRispondere(0),
    )
    return () => {
      vivo = false
    }
  }, [d, voce, giroConte])
  // Gli ordini del vestiario da saldare, nella raccolta di adesso. Non vanno
  // sul tasto MENU del telefono: restano lì per settimane e coprirebbero il resto.
  const [daSaldare, setDaSaldare] = useState(0)
  useEffect(() => {
    if (!d || !conSegreteria) return
    let vivo = true
    datiVestiario()
      .then(async (v) => {
        const [r] = await v.raccolte()
        return r ? numeriRaccolta(await v.ordini(r.id)).daSaldare : 0
      })
      .then(
        (n) => vivo && setDaSaldare(n),
        () => vivo && setDaSaldare(0),
      )
    return () => {
      vivo = false
    }
  }, [d, voce, giroConte])
  // I pagamenti Satispay da decidere: senza il 96 lo stato non c'è, e il segno resta a zero.
  const [daDecidere, setDaDecidere] = useState(0)
  useEffect(() => {
    if (!d || !puo(chi, 'contabilita')) return
    let vivo = true
    d.statoScaricoSatispay().then(
      (s) => vivo && setDaDecidere(s?.daDecidere.length ?? 0),
      () => vivo && setDaDecidere(0),
    )
    return () => {
      vivo = false
    }
  }, [d, voce, giroConte])
  // Il numero sul tasto MENU del telefono: la somma dei segni del menu. Giallo,
  // come in DA FARE: sono cose che aspettano una risposta, non guai.
  const daFare = richiesteNuove + daConfermare + daRispondere + daDecidere + (conSegnalate ? segnalateDaVedere : 0)

  const puoCercare = !!d && conSegreteria
  // Alla chiusura il fuoco torna all'elemento che l'aveva prima di ⌘K.
  const primaDellaFinestra = useRef<HTMLElement | null>(null)
  useEffect(() => {
    if (finestra) return
    primaDellaFinestra.current?.focus()
    primaDellaFinestra.current = null
  }, [finestra])
  useEffect(() => {
    if (!puoCercare) return
    const tasto = (e: KeyboardEvent) => {
      if (!eScorciatoiaDiRicerca(e)) return
      // Prima del browser: Ctrl+K da solo sposterebbe il fuoco sulla barra degli indirizzi.
      e.preventDefault()
      // Prima di aprire (dopo, il fuoco è già sul campo). Si guarda il DOM e non `finestra`: qui la closure la vedrebbe vecchia.
      if (!document.querySelector('.sg-ricerca-corpo')) primaDellaFinestra.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
      setFinestra((f) => !f)
    }
    window.addEventListener('keydown', tasto)
    return () => window.removeEventListener('keydown', tasto)
  }, [puoCercare])

  const [guaio, setGuaio] = useState(false)
  const [tentativo, setTentativo] = useState(0)
  useEffect(() => {
    let vivo = true
    setGuaio(false)
    datiSegreteria().then(
      (x) => vivo && setD(x),
      () => vivo && setGuaio(true),
    )
    return () => {
      vivo = false
    }
  }, [tentativo])

  // In un'altra scheda: la segreteria resta dov'era, con quello che c'era aperto.
  const guida = (
    <a className="icon-btn tasto-guida" href={indirizzoPagina(guidaDellaVoce(voce))} target="_blank" rel="noopener" title="La guida" aria-label="Apri la guida di questa voce">
      ?
    </a>
  )

  // Il tasto IMPOSTAZIONI sta con ? e il tema, in cima, sul computer e sul telefono.
  const impostazioni = conSegreteria && (
    <button
      type="button"
      className="icon-btn"
      aria-current={voce === 'regole' ? 'page' : undefined}
      onClick={() => vai('regole')}
      title="Impostazioni"
      aria-label="Impostazioni"
    >
      <Cursori />
    </button>
  )

  // Nel riquadro di chi è dentro, col loro nome: due icone senza parola in cima non dicevano cosa fossero.
  const guidaNome = (
    <a className="num sg-voce" href={indirizzoPagina(guidaDellaVoce(voce))} target="_blank" rel="noopener">
      <span className="sg-voce-aiuto" aria-hidden="true">?</span>
      <span className="sg-voce-testo">Aiuto</span>
    </a>
  )
  const impostazioniNome = conSegreteria && (
    <button type="button" className="num sg-voce" aria-current={voce === 'regole' ? 'page' : undefined} onClick={() => vai('regole')}>
      <Cursori />
      <span className="sg-voce-testo">Impostazioni</span>
    </button>
  )

  // Le schede delle presenze: le pagine le mettono sotto il loro titolo, come IMPOSTAZIONI.
  const schedePresenze = d && inPresenze && conSegnalate && (
    <div
      role="tablist"
      aria-label="Presenze"
      className="schede sg-schede"
      onKeyDown={(e) => {
        const dove = tastoLinguette(['presenze', 'segnalate'] as const, voce === 'segnalate' ? 'segnalate' : 'presenze', e.key)
        if (!dove || dove === voce) return
        e.preventDefault()
        // L'altra pagina ridisegna le schede: il fuoco va sulla nuova scheda aperta, come in IMPOSTAZIONI.
        void vai(dove).then(() => requestAnimationFrame(() => document.querySelector<HTMLElement>('[role="tablist"][aria-label="Presenze"] [aria-selected="true"]')?.focus()))
      }}
    >
      <button type="button" role="tab" aria-selected={voce === 'presenze'} tabIndex={voce === 'presenze' ? 0 : -1} className="scheda" data-on={voce === 'presenze'} onClick={() => vai('presenze')}>
        <ICONE_SCHEDE.mese size={18} />
        Il mese
      </button>
      <button type="button" role="tab" aria-selected={voce === 'segnalate'} tabIndex={voce === 'segnalate' ? 0 : -1} className="scheda" data-on={voce === 'segnalate'} onClick={() => vai('segnalate')}>
        <ICONE_SCHEDE.segnalate size={18} />
        Segnalate{segno(segnalateDaVedere, 'da vedere')}
      </button>
    </div>
  )

  return (
    <div className="sg" data-aspetto={aspetto}>
      {/* Un tasto e non un link «#…»: con <base href="../"> delle pagine delle aree, l'ancora porterebbe via dalla segreteria. */}
      <button type="button" className="sg-salta" onClick={vaiAlContenuto}>
        Vai al contenuto
      </button>
      {banco ? (
        <BarraBanco
          voce={voce}
          prova={prova}
          nome={nome}
          ruolo={ruolo}
          consentite={consentite}
          titolo={etichetta}
          segni={{
            richieste: { n: richiesteNuove, detto: 'nuove' },
            istruttori: { n: daConfermare, detto: 'da confermare' },
            presenze: { n: conSegnalate ? segnalateDaVedere : 0, detto: 'segnalate da vedere' },
            segnalazioni: { n: daRispondere, detto: 'da rispondere' },
            vestiario: { n: daSaldare, detto: 'ordini da saldare' },
            importazioni: { n: daDecidere, detto: 'pagamenti da decidere' },
          }}
          cerca={d && conSegreteria && <CercaIscritto d={d} onVai={(v, dest) => void vai(v, dest)} />}
          link={
            <>
              <CopiaLink link={LINK_PUBBLICO} testo="Copia link iscrizioni" perche="Il link per iscriversi:" />
              <CopiaLink link={linkOrdini()} testo="Copia link ordini" perche="Il link per ordinare il vestiario:" />
            </>
          }
          guida={guida}
          tema={<TastoTema />}
          onVai={(v) => void vai(v)}
          onIstruttori={onIstruttori}
          onEsci={onEsci}
        />
      ) : (
        <>
      <header className="sg-barra-tel">
        <Logo width={36} />
        <span className="stack grow" style={{ gap: 2 }}>
          <span className="ob" style={{ fontSize: 18, fontWeight: 700, letterSpacing: '0.04em', lineHeight: 1 }}>ODS CORSI</span>
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.22em', color: 'var(--dim)' }}>{etichetta}</span>
        </span>
        {guida}
        <TastoTema />
        {impostazioni}
        <button
          type="button"
          className="num sg-tasto-menu"
          aria-expanded={aperto}
          aria-controls="sg-menu"
          aria-label={!aperto && daFare > 0 ? `Menu, ${daFare} da guardare` : undefined}
          onClick={() => (aperto ? chiudiMenu() : apriMenu())}
        >
          {aperto ? 'CHIUDI' : 'MENU'}
          {!aperto && daFare > 0 && (
            <span className="num sg-tag" data-tipo="presto" aria-hidden="true">
              {daFare}
            </span>
          )}
        </button>
      </header>
      <nav className="sg-menu" id="sg-menu" aria-label="Menu" data-aperto={aperto}>
        <div className="row sg-marchio" style={{ gap: 10, padding: '0 8px' }}>
          <Logo width={46} />
          <span className="stack" style={{ gap: 2 }}>
            <span className="ob" style={{ fontSize: 20, fontWeight: 700, letterSpacing: '0.04em', lineHeight: 1 }}>ODS CORSI</span>
            <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.22em', color: 'var(--dim)' }}>{etichetta}</span>
          </span>
        </div>
        {d && conSegreteria && <CercaIscritto d={d} onVai={(v, dest) => void vai(v, dest)} />}
        <div className="sg-gruppi">
          {gruppi.map((g) => (
            <div key={g.titolo} role="group" aria-label={g.titolo} className="sg-gruppo" data-secondario={g.secondario}>
              <span className="sg-gruppo-titolo" aria-hidden="true">
                {g.titolo}
              </span>
              <div className="sg-voci">
                {g.voci.map(([id, testo]) => {
                  const Icona = ICONE_MENU[id]
                  return (
                    <button
                      key={id}
                      type="button"
                      className="num sg-voce"
                      aria-current={voce === id || (id === 'presenze' && inPresenze) ? 'page' : undefined}
                      onClick={() => vai(id)}
                    >
                      <Icona />
                      <span className="sg-voce-testo">{testo}</span>
                      {id === 'richieste' && segno(richiesteNuove, 'nuove')}
                      {id === 'presenze' && conSegnalate && segno(segnalateDaVedere, 'segnalate da vedere')}
                      {id === 'istruttori' && segno(daConfermare, 'da confermare')}
                      {id === 'segnalazioni' && segno(daRispondere, 'da rispondere')}
                      {id === 'vestiario' && segno(daSaldare, 'ordini da saldare')}
                      {id === 'importazioni' && segno(daDecidere, 'pagamenti da decidere')}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
        <div className="grow" />
        <div className="sg-voci">
          {onIstruttori && (
            <button type="button" className="num sg-voce" onClick={onIstruttori}>
              <ICONE_MENU.areaIstruttori />
              <span className="sg-voce-testo">Istruttori →</span>
            </button>
          )}
          {conSegreteria && (
            <>
              <CopiaLink link={LINK_PUBBLICO} testo="Copia link iscrizioni" perche="Il link per iscriversi:" />
              <CopiaLink link={linkOrdini()} testo="Copia link ordini" perche="Il link per ordinare il vestiario:" />
            </>
          )}
        </div>
        <div className="sg-chi">
          <div className="sg-voci sg-chi-voci">
            {guidaNome}
            {impostazioniNome}
            <TastoTema />
          </div>
          <span style={{ fontSize: 14, fontWeight: 600 }}>{nome}</span>
          <span style={{ fontSize: 12, color: 'var(--dim)' }}>{ruolo}{conSegreteria ? ' · accesso completo' : ''}</span>
          {prova && <span className="num sg-bollino">DATI DI PROVA</span>}
          {prova && (
            <button
              type="button"
              className="sg-link"
              onClick={async () => {
                // Prima la bozza aperta, con la domanda di sempre; poi quella dei dati di prova.
                if (!(await lasciare())) return
                if (!(await chiedi("Rimettere l'orario vero e togliere i cambi, le presenze, le richieste e gli ordini fatti in prova su questo dispositivo?", 'Riparti dall’orario vero', { pericolo: true }))) return
                void Promise.all([import('../../lib/archivioProva'), import('../../lib/datiProva'), import('../../lib/richiesteProva'), import('../../lib/esempiProva'), import('../../lib/listino'), import('../../lib/vestiarioDati'), import('../../lib/vestiarioProva')]).then(([a, p, r, e, l, vd, vp]) => {
                  a.archivio.azzera()
                  l.scordaListinoProva()
                  p.scordaProva()
                  r.scordaRichiesteProva()
                  e.scordaEsempi()
                  vp.scordaVestiarioProva()
                  vd.scordaEsempiVestiario()
                  // La bozza è già stata lasciata: il browser non deve chiederlo di nuovo.
                  scordaBozze()
                  window.location.reload()
                })
              }}
            >
              Riparti dall'orario vero
            </button>
          )}
          {onEsci && (
            <button type="button" className="sg-link" onClick={onEsci}>
              Esci
            </button>
          )}
          <span className="num versione" title={VERSIONE_ESTESA}>
            {VERSIONE}
          </span>
        </div>
      </nav>
        </>
      )}

      {finestra && d && conSegreteria && (
        <div className="sg-ricerca-finestra" onMouseDown={(e) => e.target === e.currentTarget && setFinestra(false)}>
          <FinestraCerca onChiudi={() => setFinestra(false)}>
            <CercaIscritto
              d={d}
              inFinestra
              onChiudi={() => setFinestra(false)}
              onVai={(v, dest) => {
                setFinestra(false)
                void vai(v, dest)
              }}
            />
          </FinestraCerca>
        </div>
      )}
      <main className="sg-corpo" id="sg-contenuto" tabIndex={-1}>
        {!d && !guaio && <p className="sg-sotto">Un attimo…</p>}
        {!d && guaio && (
          <div className="stack" style={{ gap: 12, alignItems: 'flex-start' }}>
            <Guaio testo="La segreteria non si è caricata: controlla la connessione." />
            <button type="button" className="sg-btn sg-btn-linea" onClick={() => setTentativo((t) => t + 1)}>
              Riprova
            </button>
          </div>
        )}
        {d && conSegreteria && strisciaVisibile(voce, telefono, !!(posto.persona || posto.corso || posto.nuovo || richiesta || posto.lezione), strisciaVoluta) && (
          <CosaManca conti={conti.striscia} onVai={vai} onRiprova={contiCambiati} />
        )}
        <Suspense fallback={<span className="sg-sotto">Un attimo…</span>}>
        {d && voce === 'dafare' && !banco && <DaFare conti={conti} onVai={vai} onRiprova={() => setGiroConte((g) => g + 1)} />}
        {d && voce === 'dafare' && banco && <Oggi d={d} conti={conti} onVai={vai} onRiprova={() => setGiroConte((g) => g + 1)} />}
        {d && voce === 'settimana' && (
          <Settimana
            d={d}
            posto={posto}
            onPosto={(p, passo) => segna({ ...p, voce: 'settimana' }, passo)}
            onConti={contiCambiati}
            onGara={(id) => {
              setGaraDaAprire(id)
              segna({ voce: 'gare' }, 'push')
            }}
          />
        )}
        {d && voce === 'corsi' && (
          <Corsi
            key={ricerca?.testo ?? ''}
            d={d}
            ricerca={ricerca}
            onTogliRicerca={() => setRicerca(undefined)}
            scelto={posto.corso}
            nuovo={posto.nuovo}
            onScelta={(id, passo) => segna({ voce: 'corsi', ...(id && { corso: id }) }, passo)}
            onNuovo={() => segna({ voce: 'corsi', nuovo: true }, 'push')}
            onConti={contiCambiati}
            onVai={vai}
          />
        )}
        {d && voce === 'iscritti' && banco && posto.persona && <PersonaBanco d={d} id={posto.persona} giro={giroConte} />}
        {d && voce === 'iscritti' && (
          <Iscritti
            key={`${filtro ?? ''}|${ricerca?.testo ?? ''}`}
            d={d}
            ricerca={ricerca}
            onTogliRicerca={() => setRicerca(undefined)}
            scelta={posto.persona}
            daCorso={posto.daCorso}
            onCorso={async (id) => {
              // Corsi è un pezzo a parte: prima di aprirlo si imposta la sua scheda.
              ;(await import('./Corsi')).riapriSuIscritti(id)
              segna({ voce: 'corsi', corso: id }, 'push')
            }}
            nuovo={posto.nuovo}
            onScelta={(id, passo) => segna({ voce: 'iscritti', ...(id && { persona: id }) }, passo)}
            onNuovo={() => segna({ voce: 'iscritti', nuovo: true }, 'push')}
            onConti={contiCambiati}
            filtroIniziale={filtro}
            contabilita={puo(chi, 'contabilita')}
            onMovimento={puo(chi, 'contabilita') ? (id) => void vai('contabilita', { movimento: id }) : undefined}
          />
        )}
        {d && voce === 'richieste' && <Richieste key={`${filtro ?? ''}|${ricerca?.testo ?? ''}|${richiesta ?? posto.richiesta ?? ''}`} d={d} onVai={vai} stampareIniziale={filtro === 'stampare'} ricerca={ricerca} aperta={richiesta ?? posto.richiesta} onTogliRicerca={() => setRicerca(undefined)} onConti={contiCambiati} />}
        {d && voce === 'presenze' && <Presenze key={filtro ?? ''} d={d} onVai={vai} senzaAppello={filtro === 'senza-appello'} schede={schedePresenze} />}
        {d && voce === 'contabilita' && <Contabilita key={movimento ?? ''} d={d} movimento={movimento} onPersona={conSegreteria ? (id) => void vai('iscritti', { persona: id }) : undefined} onImportazioni={() => void vai('importazioni')} />}
        {d && voce === 'importazioni' && <Importazioni d={d} />}
        {d && voce === 'statistiche' && <Statistiche d={d} onVai={vai} />}
        {d && voce === 'segnalate' && <PresenzeSegnalate d={d} onVai={vai} schede={schedePresenze} onCambiato={() => setGiroConte((g) => g + 1)} />}
        {d && voce === 'istruttori' && <PresenzeIstruttori d={d} onCambiato={() => setGiroConte((g) => g + 1)} />}
        {d && voce === 'compensi' && <Compensi d={d} puoPagare={puo(chi, 'contabilita')} onVai={(v) => void vai(v)} />}
        {d && voce === 'personale' && <Personale d={d} onVai={(v) => void vai(v)} />}
        {d && voce === 'listino' && <Listino d={d} />}
        {d && voce === 'vestiario' && <Vestiario onCambiato={() => setGiroConte((g) => g + 1)} />}
        {d && voce === 'gare' && <Gare d={d} apri={garaDaAprire} onCambiato={() => setGiroConte((g) => g + 1)} />}
        {d && voce === 'regole' && <Regole d={d} onVai={vai} />}
        {voce === 'palestra' && <Palestra daRispondere={daRispondere} onVai={(v) => void vai(v)} />}
        {d && voce === 'segnalazioni' && <Segnalazioni d={d} onCambiato={() => setGiroConte((g) => g + 1)} />}
        {d && voce === 'sito' && (
          <Suspense fallback={<span className="sg-sotto">Apro il sito…</span>}>
            <Sito d={d} />
          </Suspense>
        )}
        </Suspense>
      </main>
      <Conferme />
    </div>
  )
}

// Il Tab resta dentro la finestra, come in ogni altro dialogo (`useDialogo`).
function FinestraCerca({ onChiudi, children }: { onChiudi: () => void; children: ReactNode }) {
  const ref = useDialogo<HTMLDivElement>(onChiudi)
  return (
    <div ref={ref} role="dialog" aria-modal="true" aria-label="Cerca" className="sg-ricerca-corpo" tabIndex={-1}>
      {children}
    </div>
  )
}
