import { useEffect, useRef, useState } from 'react'
import type { DatiSegreteria } from '../../lib/segreteria'
import { datiSegreteria } from '../../lib/segreteria'
import { Logo } from '../Logo'
import { Bollino } from '../ds'
import { TastoTema } from '../TastoTema'
import { Cursori } from '../Icons'
import { Settimana } from './Settimana'
import { Corsi } from './Corsi'
import { Iscritti } from './Iscritti'
import { Presenze } from './Presenze'
import { Statistiche } from './Statistiche'
import { Personale } from './Personale'
import { Regole } from './Regole'
import { Listino } from './Listino'
import { Richieste } from './Richieste'
import { PresenzeIstruttori } from './PresenzeIstruttori'
import { PresenzeSegnalate } from './PresenzeSegnalate'
import { Segnalazioni } from './Segnalazioni'
import { tocca } from '../../lib/segnalazioni'
import { EserciziPalestra } from './TimerPalestra'
import { DaFare, useDaFare } from './DaFare'
import { bozzaAperta, chiedi, Conferme, dialogoAperto, Guaio, lasciare, scordaBozze } from './comune'
import { TELEFONO, useSchermo } from '../../lib/largo'
import { CercaIscritto } from './CercaIscritto'
import { indirizzoPagina } from '../../lib/guida'
import { indirizzo, INDIRIZZI } from '../../lib/aree'
import { VERSIONE, VERSIONE_ESTESA } from '../../lib/versione'
import { dopoIndietro, filtroDopo, indirizzoCorretto, leggiIndirizzo, postoDelMenu, scriviIndirizzo, type Posto, type Voce } from '../../lib/indirizzoSegreteria'
import { cambiaVoce, scorre } from '../../lib/scorri'

export type { Voce }

/** Dove portare la segreteria da un'altra sezione: la scheda di qualcuno, una lezione da aprire. */
export interface Destinazione {
  persona?: string
  lezione?: { id: string; inizio: string }
  /** Un filtro già acceso: chi ha il certificato da sistemare, chi deve pagare, chi ha un file di prima, cosa c'è da stampare. */
  filtro?: 'certificato' | 'scadenza' | 'pagare' | 'file-di-prima' | 'stampare' | 'senza-appello'
}

/**
 * Il menu in quattro gruppi, da quello che si apre ogni giorno a quello che
 * si tocca una volta a stagione: tredici voci in fila non si leggevano. Le
 * presenze segnalate sono una scheda di PRESENZE, non una voce.
 */
const GRUPPI: Array<{ titolo: string; voci: Array<[Voce, string]>; secondario?: boolean }> = [
  {
    titolo: 'OGNI GIORNO',
    voci: [
      ['dafare', 'DA FARE'],
      ['settimana', 'SETTIMANA'],
      ['richieste', 'RICHIESTE ONLINE'],
      ['presenze', 'PRESENZE'],
    ],
  },
  {
    titolo: 'PERSONE',
    voci: [
      ['iscritti', 'ISCRITTI'],
      ['corsi', 'CORSI'],
    ],
  },
  {
    titolo: 'ISTRUTTORI',
    voci: [
      ['istruttori', 'PRESENZE ISTRUTTORI'],
      ['personale', 'ISTRUTTORI E ACCESSI'],
    ],
  },
  {
    titolo: 'LA PALESTRA',
    // Sul telefono più piccolo: sono cose da computer.
    secondario: true,
    voci: [
      ['statistiche', 'STATISTICHE'],
      ['listino', 'LISTINO'],
      ['esercizi', 'ESERCIZI'],
      ['segnalazioni', 'SEGNALAZIONI'],
    ],
  },
]

/** La pagina della guida per ogni voce del menu: il tasto GUIDA apre quella della voce aperta. */
const GUIDE: Record<Voce, string> = {
  dafare: 'segreteria/da-fare',
  settimana: 'segreteria/settimana',
  corsi: 'segreteria/corsi',
  iscritti: 'segreteria/iscritti',
  richieste: 'segreteria/richieste',
  presenze: 'segreteria/presenze',
  segnalate: 'segreteria/presenze-segnalate',
  statistiche: 'segreteria/statistiche',
  istruttori: 'segreteria/presenze-istruttori',
  personale: 'segreteria/istruttori-e-accessi',
  esercizi: 'segreteria/esercizi',
  listino: 'segreteria/listino',
  regole: 'segreteria/regole',
  segnalazioni: 'segreteria/segnalazioni',
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
const LINK_PUBBLICO = indirizzo(INDIRIZZI.iscrizioni)

function CopiaLink() {
  const [copiato, setCopiato] = useState(false)
  useEffect(() => {
    if (!copiato) return
    const t = window.setTimeout(() => setCopiato(false), 2500)
    return () => window.clearTimeout(t)
  }, [copiato])
  const copia = () => {
    // Senza appunti (una pagina non sicura, un browser vecchio) si fa vedere
    // l'indirizzo da copiare a mano.
    if (!navigator.clipboard) return window.prompt('Il link per iscriversi:', LINK_PUBBLICO)
    navigator.clipboard.writeText(LINK_PUBBLICO).then(
      () => setCopiato(true),
      () => window.prompt('Il link per iscriversi:', LINK_PUBBLICO),
    )
  }
  return (
    <button type="button" className="num sg-voce" onClick={copia} title={LINK_PUBBLICO}>
      {copiato ? 'LINK COPIATO ✓' : 'COPIA LINK ISCRIZIONI'}
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
  prova,
  onEsci,
  onIstruttori,
}: {
  nome: string
  ruolo?: string
  prova: boolean
  onEsci?: () => void
  /** Per chi è di segreteria e insegna anche: il passaggio al calendario, senza uscire. */
  onIstruttori?: () => void
}) {
  const [d, setD] = useState<DatiSegreteria | null>(null)
  // Dove si è sta nell'indirizzo (vedi `indirizzoSegreteria.ts`): si parte
  // da lì anche se i dati arrivano dopo, e Indietro/Avanti ci riportano.
  const [posto, setPosto] = useState<Posto>(() => leggiIndirizzo(window.location.hash, { prova }) ?? { voce: 'dafare' })
  const voce = posto.voce
  // Il filtro acceso da DA FARE resta fuori dall'indirizzo: è un punto di partenza, non un posto.
  const [filtro, setFiltro] = useState<Destinazione['filtro']>()
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
      const h = indirizzoCorretto(window.location.hash, { prova })
      if (h) scrivi(h, 'replace')
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
      const letto = dopoIndietro(ora.current, window.location.hash, { prova })
      if (!letto) return correggi()
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
  useEffect(() => {
    const corpo = document.getElementById('sg-contenuto')
    corpo?.toggleAttribute('inert', aperto && telefono)
    return () => corpo?.removeAttribute('inert')
  }, [aperto, telefono])

  // Quello che aspetta la segreteria: il menu dice quante richieste, presenze
  // di istruttori e segnalate, da qualunque voce; DA FARE conta tutto. Si
  // riconta cambiando voce, e quando una sezione dice che è cambiato qualcosa.
  const [giroConte, setGiroConte] = useState(0)
  const conti = useDaFare(d, voce === 'dafare', `${voce}-${giroConte}`)
  const richiesteNuove = conti.richieste ?? 0
  const daConfermare = conti.istruttori ?? 0
  const segnalateDaVedere = conti.segnalate ?? 0
  // Le segnalate ci sono solo in prova: lì PRESENZE ha due schede.
  const conSegnalate = d?.modo === 'prova' && !!d.segnalate
  const inPresenze = voce === 'presenze' || voce === 'segnalate'
  // Il menu è più alto di uno schermo da reception: la voce aperta (anche dopo
  // una ricarica, o con Indietro) si porta in vista. E una voce nuova si legge
  // dall'alto, non da dove era scesa quella di prima.
  useEffect(() => {
    document.querySelector('#sg-menu .sg-voce[aria-current="page"]')?.scrollIntoView({ block: 'nearest' })
    const corpo = document.getElementById('sg-contenuto')
    if (corpo) cambiaVoce(corpo)
  }, [voce])
  const segno = (n: number, detto: string) =>
    n > 0 && (
      <span className="num sg-tag" data-tipo="presto" style={{ marginLeft: 8, whiteSpace: 'nowrap' }} aria-label={`${n} ${detto}`}>
        {n}
      </span>
    )
  // Le segnalazioni che aspettano una risposta: aperte, e l'ultimo a scrivere è un altro.
  const [daRispondere, setDaRispondere] = useState(0)
  useEffect(() => {
    if (!d) return
    let vivo = true
    d.segnalazioni().then(
      (l) => vivo && setDaRispondere(l.filter(tocca).length),
      () => vivo && setDaRispondere(0),
    )
    return () => {
      vivo = false
    }
  }, [d, voce, giroConte])
  // Il numero sul tasto MENU del telefono: la somma dei segni del menu. Giallo,
  // come in DA FARE: sono cose che aspettano una risposta, non guai.
  const daFare = richiesteNuove + daConfermare + daRispondere + (conSegnalate ? segnalateDaVedere : 0)

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
    <a className="icon-btn tasto-guida" href={indirizzoPagina(GUIDE[voce])} target="_blank" rel="noopener" title="La guida" aria-label="Apri la guida di questa voce">
      ?
    </a>
  )

  // Il tasto IMPOSTAZIONI sta con ? e il tema, in cima, sul computer e sul telefono.
  const impostazioni = (
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

  return (
    <div className="sg">
      {/* Un tasto e non un link «#…»: con <base href="../"> delle pagine delle aree, l'ancora porterebbe via dalla segreteria. */}
      <button type="button" className="sg-salta" onClick={vaiAlContenuto}>
        Vai al contenuto
      </button>
      <header className="sg-barra-tel">
        <Logo width={36} />
        <span className="stack grow" style={{ gap: 2 }}>
          <span className="ob" style={{ fontSize: 18, fontWeight: 700, letterSpacing: '0.04em', lineHeight: 1 }}>ODS CORSI</span>
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.22em', color: 'var(--dim)' }}>SEGRETERIA</span>
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
      <nav className="sg-menu" id="sg-menu" aria-label="Segreteria" data-aperto={aperto}>
        <div className="row sg-marchio" style={{ gap: 10, padding: '0 8px' }}>
          <Logo width={46} />
          <span className="stack" style={{ gap: 2 }}>
            <span className="ob" style={{ fontSize: 20, fontWeight: 700, letterSpacing: '0.04em', lineHeight: 1 }}>ODS CORSI</span>
            <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.22em', color: 'var(--dim)' }}>SEGRETERIA</span>
          </span>
        </div>
        {/* In cima, sempre in vista senza scorrere: in fondo, su uno schermo basso, si perdevano. Sul telefono stanno nella barra in cima. */}
        <div className="row sg-icone">
          {guida}
          <TastoTema />
          {impostazioni}
          {/* Fra DATI e DI uno spazio che non va a capo: in 56px si spezza solo prima di PROVA. */}
          {prova && <Bollino>DATI{'\u00a0'}DI PROVA</Bollino>}
        </div>
        {d && <CercaIscritto d={d} onApri={(id) => void vai('iscritti', { persona: id })} />}
        <div className="sg-gruppi">
          {GRUPPI.map((g) => (
            <div key={g.titolo} role="group" aria-label={g.titolo} className="sg-gruppo" data-secondario={g.secondario}>
              <span className="sg-gruppo-titolo" aria-hidden="true">
                {g.titolo}
              </span>
              <div className="sg-voci">
                {g.voci.map(([id, testo]) => (
                  <button
                    key={id}
                    type="button"
                    className="num sg-voce"
                    aria-current={voce === id || (id === 'presenze' && inPresenze) ? 'page' : undefined}
                    onClick={() => vai(id)}
                  >
                    <span className="sg-voce-testo">{testo}</span>
                    {id === 'richieste' && segno(richiesteNuove, 'nuove')}
                    {id === 'presenze' && conSegnalate && segno(segnalateDaVedere, 'segnalate da vedere')}
                    {id === 'istruttori' && segno(daConfermare, 'da confermare')}
                    {id === 'segnalazioni' && segno(daRispondere, 'da rispondere')}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="grow" />
        <div className="sg-voci">
          {onIstruttori && (
            <button type="button" className="num sg-voce" onClick={onIstruttori}>
              ISTRUTTORI →
            </button>
          )}
          <CopiaLink />
        </div>
        <div className="sg-chi">
          <span style={{ fontSize: 14, fontWeight: 600 }}>{nome}</span>
          <span style={{ fontSize: 12, color: 'var(--dim)' }}>{ruolo} · accesso completo</span>
          {prova && <span className="num sg-bollino">DATI DI PROVA</span>}
          {prova && (
            <button
              type="button"
              className="sg-link"
              onClick={async () => {
                // Prima la bozza aperta, con la domanda di sempre; poi quella dei dati di prova.
                if (!(await lasciare())) return
                if (!(await chiedi("Rimettere l'orario vero e togliere i cambi, le presenze e le richieste fatte in prova su questo dispositivo?", 'RIPARTI DALL’ORARIO VERO', { pericolo: true }))) return
                void Promise.all([import('../../lib/archivioProva'), import('../../lib/datiProva'), import('../../lib/richiesteProva'), import('../../lib/esempiProva'), import('../../lib/listino')]).then(([a, p, r, e, l]) => {
                  a.archivio.azzera()
                  l.scordaListinoProva()
                  p.scordaProva()
                  r.scordaRichiesteProva()
                  e.scordaEsempi()
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

      <main className="sg-corpo" id="sg-contenuto" tabIndex={-1} onScroll={(e) => scorre(e.currentTarget)}>
        {!d && !guaio && <p className="sg-sotto">Un attimo…</p>}
        {!d && guaio && (
          <div className="stack" style={{ gap: 12, alignItems: 'flex-start' }}>
            <Guaio testo="La segreteria non si è caricata: controlla la connessione." />
            <button type="button" className="sg-btn sg-btn-linea" onClick={() => setTentativo((t) => t + 1)}>
              RIPROVA
            </button>
          </div>
        )}
        {d && voce === 'dafare' && <DaFare conti={conti} onVai={vai} onRiprova={() => setGiroConte((g) => g + 1)} />}
        {d && voce === 'settimana' && <Settimana d={d} posto={posto} onPosto={(p, passo) => segna({ ...p, voce: 'settimana' }, passo)} />}
        {d && voce === 'corsi' && (
          <Corsi
            d={d}
            scelto={posto.corso}
            nuovo={posto.nuovo}
            onScelta={(id, passo) => segna({ voce: 'corsi', ...(id && { corso: id }) }, passo)}
            onNuovo={() => segna({ voce: 'corsi', nuovo: true }, 'push')}
          />
        )}
        {d && voce === 'iscritti' && (
          <Iscritti
            key={filtro ?? ''}
            d={d}
            scelta={posto.persona}
            nuovo={posto.nuovo}
            onScelta={(id, passo) => segna({ voce: 'iscritti', ...(id && { persona: id }) }, passo)}
            onNuovo={() => segna({ voce: 'iscritti', nuovo: true }, 'push')}
            filtroIniziale={filtro}
          />
        )}
        {d && voce === 'richieste' && <Richieste key={filtro ?? ''} d={d} onVai={vai} stampareIniziale={filtro === 'stampare'} />}
        {d && inPresenze && conSegnalate && (
          <div role="tablist" aria-label="Presenze" className="schede sg-schede">
            <button type="button" role="tab" aria-selected={voce === 'presenze'} className="scheda" data-on={voce === 'presenze'} onClick={() => vai('presenze')}>
              IL MESE
            </button>
            <button type="button" role="tab" aria-selected={voce === 'segnalate'} className="scheda" data-on={voce === 'segnalate'} onClick={() => vai('segnalate')}>
              SEGNALATE{segno(segnalateDaVedere, 'da vedere')}
            </button>
          </div>
        )}
        {d && voce === 'presenze' && <Presenze key={filtro ?? ''} d={d} onVai={vai} senzaAppello={filtro === 'senza-appello'} />}
        {d && voce === 'statistiche' && <Statistiche d={d} onVai={vai} />}
        {d && voce === 'segnalate' && <PresenzeSegnalate d={d} onVai={vai} onCambiato={() => setGiroConte((g) => g + 1)} />}
        {d && voce === 'istruttori' && <PresenzeIstruttori d={d} onCambiato={() => setGiroConte((g) => g + 1)} />}
        {d && voce === 'personale' && <Personale d={d} />}
        {d && voce === 'esercizi' && <EserciziPalestra d={d} />}
        {d && voce === 'listino' && <Listino d={d} />}
        {d && voce === 'regole' && <Regole d={d} onVai={vai} />}
        {d && voce === 'segnalazioni' && <Segnalazioni d={d} onCambiato={() => setGiroConte((g) => g + 1)} />}
      </main>
      <Conferme />
    </div>
  )
}
