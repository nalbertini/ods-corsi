import { type ReactNode, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Logo } from './components/Logo'
import { TastoTema } from './components/TastoTema'
import { Sala } from './components/Sala'
import { Accesso, ChiSei, Porta, SceltaArea, ScegliPassword, UnAttimo, useChi } from './components/Porta'
import { IscrizioniScreen } from './components/IscrizioniScreen'
import { IscrizioneAPassi } from './components/IscrizioneAPassi'
import { OrdinaVestiario, RiquadroVestiario } from './components/OrdinaVestiario'
import { AreaIscritti, IscrittiChiusa } from './components/AreaIscritti'
import { Guida } from './components/Guida'
import { MieiTimer } from './components/MieiTimer'
import { MieOre } from './components/MieOre'
import { BarraNavigazione, PaginaTimer, StrisciaTimer } from './components/TimerIstruttori'
import { Conferme, chiedi } from './components/segreteria/comune'
import { Tablet } from './components/tablet/Tablet'
import { Segreteria } from './components/segreteria/Segreteria'
import { INDIRIZZI, useArea } from './lib/aree'
import { account, esci, nomeDelRuolo, passaA, serveAccesso, type Account, type Personale } from './lib/accesso'
import { useLargo } from './lib/largo'
import { INDIRIZZO_GUIDA, indirizzoPagina } from './lib/guida'
import { ARRIVO } from './lib/invito'
import { ISTRUTTORE_PROVA, haUnServer, inProvaScelta, scegliProva } from './lib/dati'
import { flussoNuovoAcceso } from './lib/passiIscrizione'
import { INDIRIZZO_VESTIARIO } from './lib/cancelletti'
import { VERSIONE, VERSIONE_ESTESA } from './lib/versione'
import { chiediPrimaDiSostituire, lezioneDelTimer, mostraStriscia, statoCambiato, timerAperto, vociNavigazione, type PaginaIstruttori } from './lib/timerIstruttori'
import type { Incorporato, StatoTimer } from '../timer/src/lib/incorporato'
import { oraDi, type SessioneVista } from './lib/sala'

/**
 * ODS Corsi: il calendario delle sale e il registro delle presenze.
 *
 * È un'app a sé, separata dal timer di proposito: la presenza è una cosa che
 * riguarda la palestra, il timer una cosa che riguarda la lezione, e tenerle
 * nello stesso posto le legava più di quanto servisse.
 *
 * Ha cinque facce, ognuna col suo indirizzo (vedi `aree.ts`) e la sua porta:
 * la segreteria per il computer della reception, a tutto schermo e solo per
 * chi ne ha il ruolo; le iscrizioni, la pagina pubblica del link da mandare a
 * chi vuole iscriversi; gli iscritti, la pagina di chi frequenta i corsi (per
 * ora solo in prova); gli istruttori, col calendario e l'appello; e la sala,
 * il tablet appeso al muro.
 *
 * Col database vero la porta è una sola (vedi `accedi`), e anche la sessione:
 * ognuno finisce nel suo indirizzo e trova solo il suo posto, senza schede, e
 * dagli indirizzi delle altre aree torna nel suo. Uscendo si torna alla
 * porta. In prova le porte sono aperte a tutti e le schede ci sono,
 * perché la prova serve a far vedere l'app intera.
 */
export default function App() {
  // Da un'email di Supabase (l'invito, «password dimenticata») si sceglie
  // prima la password, e poi si va nella propria area.
  const arrivo = serveAccesso ? ARRIVO : null
  if (arrivo) {
    return (
      <div className="app">
        <Testata luogo="ACCESSO" />
        <main className="scroll">
          <ScegliPassword arrivo={arrivo} />
        </main>
      </div>
    )
  }
  return <Aree />
}

function Aree() {
  const area = useArea()
  if (area === 'segreteria') return <AreaSegreteria />
  if (area === 'iscrizioni') return <Iscrizioni />
  if (area === 'iscritti') return <Iscritti />
  if (area === 'istruttori') return <Istruttori />
  if (area === 'sala') return <Tablet />
  if (area === 'guida') return <AreaGuida />
  return <Scelta />
}

/** `guida` è la pagina della guida da aprire col tasto «?», se c'è. */
function Testata({ luogo, guida, children }: { luogo: string; guida?: string; children?: ReactNode }) {
  return (
    <header className="testata">
      <Logo />
      <div className="stack grow" style={{ gap: 1 }}>
        <span className="testata-nome">OFFICINE DELLO SPORT</span>
        <span className="testata-luogo">{luogo} · COLLEGNO</span>
      </div>
      {guida && (
        <a className="icon-btn tasto-guida" href={guida} title="La guida" aria-label="Apri la guida">
          ?
        </a>
      )}
      <TastoTema />
      {children}
    </header>
  )
}

/**
 * Senza niente nell'indirizzo. Col database è la porta unica: si entra, e
 * l'account porta nella sua area (vedi `accedi`); sotto, quel che non chiede
 * un accesso. Chi è già collegato su questo dispositivo va dritto nella sua
 * area: una scelta dell'area non c'è, la fa l'account, tranne per chi ne ha
 * due (la segreteria che insegna anche), che qui sceglie.
 *
 * In prova le porte sono aperte, e qui ci sono tutte le aree.
 */
function Scelta() {
  if (serveAccesso) return <PortaUnica />
  return <TutteLeAree />
}

function PortaUnica() {
  // `undefined` finché non si sa se qualcuno è già collegato.
  const [fuori, setFuori] = useState<boolean | undefined>(undefined)
  // Già collegato, con più di un'area: sceglie dove andare.
  const [doppio, setDoppio] = useState<Account | null>(null)
  useEffect(() => {
    let vivo = true
    void account().then(
      (a) => {
        if (!vivo) return
        if (a?.persona && a.aree.length > 1) setDoppio(a)
        else if (a) passaA(a.area)
        else setFuori(true)
      },
      () => vivo && setFuori(true),
    )
    return () => {
      vivo = false
    }
  }, [])
  return (
    <div className="app">
      <Testata luogo="ACCESSO" guida={INDIRIZZO_GUIDA} />
      <main className="scroll">
        {doppio?.persona ? (
          <SceltaArea persona={doppio.persona} aree={doppio.aree} onScelta={passaA} />
        ) : !fuori ? (
          <UnAttimo />
        ) : (
          <>
            <Accesso />
            <div className="pad stack porta-altro" style={{ gap: 10, paddingBottom: 16 }}>
              <a className="card stack scelta-area" href={INDIRIZZI.iscrizioni}>
                <span className="scelta-titolo">ISCRIZIONI</span>
                <span className="passo-dettaglio" style={{ fontSize: 15 }}>
                  Per chi vuole iscriversi, senza account: come ci si iscrive, i costi e il modulo.
                </span>
              </a>
              <a className="card stack scelta-area" href={INDIRIZZO_GUIDA}>
                <span className="scelta-titolo">GUIDA</span>
                <span className="passo-dettaglio" style={{ fontSize: 15 }}>
                  Come funziona l’app: la guida generale, e una per ogni parte.
                </span>
              </a>
              <span className="num versione" title={VERSIONE_ESTESA}>
                {VERSIONE}
              </span>
            </div>
          </>
        )}
      </main>
    </div>
  )
}

function TutteLeAree() {
  const voci: [keyof typeof INDIRIZZI, string, string][] = [
    ['istruttori', 'ISTRUTTORI', 'Il calendario e l’appello.'],
    ['segreteria', 'SEGRETERIA', 'Corsi, iscritti, presenze e richieste, dal computer della reception.'],
    ['iscrizioni', 'ISCRIZIONI', 'Come ci si iscrive, i costi e il modulo: la pagina da mandare a chi vuole iscriversi.'],
    ['iscritti', 'ISCRITTI', 'La pagina di chi frequenta i corsi: le sue lezioni, le presenze, il certificato e le ricevute. Il pilota.'],
    ['sala', 'SALA', 'Il tablet appeso al muro della sala. Da qui il dispositivo resta un tablet.'],
  ]
  return (
    <div className="app">
      <Testata luogo="CORSI" guida={INDIRIZZO_GUIDA} />
      <main className="scroll">
        <div className="pad stack scelta" style={{ gap: 10, paddingTop: 16, paddingBottom: 16 }}>
          {voci.map(([a, titolo, testo]) => (
            <a key={a} className="card stack scelta-area" href={INDIRIZZI[a]}>
              <span className="scelta-titolo">{titolo}</span>
              <span className="passo-dettaglio" style={{ fontSize: 15 }}>{testo}</span>
            </a>
          ))}
          <a className="card stack scelta-area" href={INDIRIZZO_GUIDA}>
            <span className="scelta-titolo">GUIDA</span>
            <span className="passo-dettaglio" style={{ fontSize: 15 }}>
              Come funziona l’app: la guida generale, e una per ogni parte.
            </span>
          </a>
          <span className="num versione" title={VERSIONE_ESTESA}>
            {VERSIONE}
          </span>
        </div>
      </main>
    </div>
  )
}

function Iscrizioni() {
  // Gli ordini del vestiario stanno qui, a `#vestiario`: il riquadro IL VESTIARIO ci porta senza ricaricare.
  const [hash, setHash] = useState(window.location.hash)
  useEffect(() => {
    const segui = () => {
      setHash(window.location.hash)
      document.querySelector('.scroll')?.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', segui)
    return () => window.removeEventListener('hashchange', segui)
  }, [])
  const vestiario = hash === INDIRIZZO_VESTIARIO
  return (
    <div className="app">
      <Testata luogo={vestiario ? 'VESTIARIO' : 'ISCRIZIONI'} />
      <main className="scroll">
        {/* Il flusso a passi è solo in prova e solo con #nuova: il vecchio resta com'è. */}
        {vestiario ? <OrdinaVestiario /> : flussoNuovoAcceso(haUnServer, hash) ? <IscrizioneAPassi /> : (
          <>
            <IscrizioniScreen pubblica />
            {/* Qui e non dentro: la pagina di oggi non cambia finché c'è il flusso a passi (prova:iscrizione-passi). */}
            <RiquadroVestiario />
          </>
        )}
      </main>
    </div>
  )
}

/**
 * La pagina degli iscritti. Il pilota c'è solo in prova: col database vero
 * un iscritto non ha ancora un accesso, e la pagina dice che arriva.
 */
function Iscritti() {
  return (
    <div className="app">
      <Testata luogo="ISCRITTI" guida={indirizzoPagina('iscritti')} />
      <main className="scroll">{serveAccesso ? <IscrittiChiusa /> : <AreaIscritti />}</main>
    </div>
  )
}

/**
 * Il calendario e l'appello, dietro la porta. La porta è quella unica: chi è
 * di segreteria ed entra da qui finisce in segreteria, che ha anche l'appello;
 * e chi è già collegato in segreteria, aprendo `istruttori/`, ci torna. Chi è
 * di segreteria e insegna anche entra in tutte e due, e qui vede le sue lezioni.
 *
 * Da qui non si va da nessun'altra parte, nemmeno in prova: segreteria,
 * sala e iscrizioni sono aree a sé, ognuna col suo indirizzo, e l'istruttore
 * non trova rimandi. Il timer è una pagina di questa stessa scheda.
 *
 * Quattro pagine (vedi `vociNavigazione`): CALENDARIO, TIMER, I MIEI e ORE,
 * nella barra in basso sul telefono e nel menu a sinistra sullo schermo largo.
 * Sullo schermo largo hanno la stessa faccia della segreteria: a destra
 * calendario e appello affiancati, alti quanto lo schermo.
 */
type LezioneTimer = Pick<SessioneVista, 'id' | 'corsoId' | 'corso' | 'inizio'>

/** Il timer incorporato non ha impostazioni da dire a nessuno: qui non c'è una barra della musica che le legga. */
const nessuno = () => {}

function Istruttori() {
  const largo = useLargo()
  // Il calendario (e con lui l'appello) e il timer restano montati cambiando
  // pagina, nascosti: tornando, i segni, la ricerca e l'allenamento sono com'erano.
  const [pagina, setPagina] = useState<PaginaIstruttori>('calendario')
  // La lezione del timer: quella dell'appello da cui si è arrivati, o nessuna dal menu.
  const [lezioneTimer, setLezioneTimer] = useState<LezioneTimer | null>(null)
  const [daAppello, setDaAppello] = useState(false)
  // Il timer pesa: si monta alla prima visita, e poi resta.
  const [timerMontato, setTimerMontato] = useState(false)
  // L'allenamento aperto nel timer, e di quale lezione è partito.
  const [allenamento, setAllenamento] = useState<{ stato: StatoTimer; lezione: LezioneTimer | null } | null>(null)
  const [ferma, setFerma] = useState(0)
  const lezioneRef = useRef(lezioneTimer)
  lezioneRef.current = lezioneTimer

  // Sul telefono le pagine scorrono nello stesso riquadro: ognuna riparte da dove era.
  const corpo = useRef<HTMLElement>(null)
  const scorse = useRef<Partial<Record<PaginaIstruttori, number>>>({})
  const prima = useRef(pagina)
  useLayoutEffect(() => {
    if (prima.current === pagina) return
    prima.current = pagina
    if (corpo.current) corpo.current.scrollTop = scorse.current[pagina] ?? 0
  }, [pagina])
  const vaiA = (p: PaginaIstruttori) => {
    if (corpo.current) scorse.current[pagina] = corpo.current.scrollTop
    if (p === 'timer') setTimerMontato(true)
    setPagina(p)
  }
  // Dal menu il timer si apre senza lezione, a meno che non ce ne sia una in corso: quella non si tocca.
  const dalMenu = (p: PaginaIstruttori) => {
    if (p === pagina) return
    if (p === 'timer' && lezioneDelTimer(allenamento && { lezioneId: allenamento.lezione?.id ?? null, status: allenamento.stato.status }, null, true) === null) setLezioneTimer(null)
    setDaAppello(false)
    vaiA(p)
  }
  // Dal cronometro dell'appello: il timer di quella lezione. Un altro allenamento si ferma, dopo aver chiesto se era in corso.
  const apriTimer = async (l: LezioneTimer) => {
    const a = allenamento
    if (a && a.lezione?.id !== l.id) {
      if (chiediPrimaDiSostituire({ lezioneId: a.lezione?.id ?? null, status: a.stato.status }, l.id)) {
        const sostituisci = await chiedi(
          `Sostituire l’allenamento in corso? Sul timer c’è già ${a.stato.nome.toUpperCase()}${a.stato.conto ? `, ${a.stato.conto.toLowerCase()}` : ''}${a.lezione ? `, di ${a.lezione.corso} delle ${oraDi(a.lezione.inizio)}` : ''}. Se parti con quello di ${l.corso} delle ${oraDi(l.inizio)}, il primo si ferma e non si riprende.`,
          'SOSTITUISCI',
          { no: 'TIENI QUELLO IN CORSO', restare: true },
        )
        if (!sostituisci) return
      }
      // STOP deve registrare il parziale con la lezione di quando l'allenamento è partito:
      // `ferma` e `setLezioneTimer` stanno nello stesso render, e `allenamento.lezione` resta quella vecchia.
      setFerma((f) => f + 1)
    }
    setLezioneTimer(l)
    setDaAppello(true)
    vaiA('timer')
  }

  const incorporato = useMemo<Incorporato>(
    () => ({
      lezione: timerAperto(lezioneTimer),
      // Nessuna musica: il timer qui è per la lezione, e la musica la comanda la sala.
      musica: { musicaFonte: 'spotify', youtube: '', radio: '', musica: false },
      sala: null,
      clip: null,
      visibile: pagina === 'timer',
      conImpostazioni: false,
      senzaTestata: true,
      ferma,
      onStato: (s) => {
        // La lezione è quella di quando l'allenamento è partito: poi la pagina può cambiare, lui no.
        const lezione = lezioneRef.current
        // Il timer manda lo stato a ogni secondo: la pagina si ridisegna solo se cambia qualcosa che si vede.
        setAllenamento((x) => (statoCambiato(x?.stato ?? null, s) ? (s ? { stato: s, lezione: x ? x.lezione : lezione } : null) : x))
      },
      onSettings: nessuno,
    }),
    [lezioneTimer, pagina, ferma],
  )

  // Di chi sono le lezioni da mostrare: dell'istruttore entrato (anche della
  // segreteria che insegna), o di quello di prova. Tutte per la segreteria, e
  // per un account ricordato da una versione che l'id non lo teneva.
  const soloDi = (chi: Personale | null) => (chi ? (chi.ruolo === 'staff' && !chi.ancheIstruttore ? undefined : chi.id) : ISTRUTTORE_PROVA.id)

  // Un albero solo, con la cornice che cambia: girando il tablet Sala non si
  // smonta, e l'appello aperto, la settimana scelta e l'esito restano.
  return (
    <Porta
      cornice={(x) => (
        <div className="app">
          <Testata luogo="ISTRUTTORI" guida={indirizzoPagina('istruttori')} />
          <main className="scroll">{x}</main>
        </div>
      )}
      dentro={(chi, onEsci) => {
        const mio = soloDi(chi)
        const voci = vociNavigazione({ ruolo: chi?.ruolo === 'staff' ? 'staff' : 'istruttore', ancheIstruttore: chi?.ancheIstruttore })
        // In flusso: sul telefono sotto la testata, sullo schermo largo in cima al corpo.
        const striscia = allenamento && mostraStriscia(allenamento.stato.status, pagina) && (
          <StrisciaTimer
            stato={allenamento.stato}
            onApri={() => {
              setDaAppello(false)
              vaiA('timer')
            }}
            onFerma={() => setFerma((f) => f + 1)}
          />
        )
        return (
        <div className={largo ? 'sg' : 'app'}>
          {largo ? (
            <MenuIstruttori chi={chi} onEsci={onEsci} voci={voci} pagina={pagina} onPagina={dalMenu} />
          ) : (
            <Testata luogo="ISTRUTTORI" guida={indirizzoPagina('istruttori')} />
          )}
          {!largo && striscia}
          <main ref={corpo} className={largo ? 'sg-corpo sg-corpo-sala' : 'scroll'}>
            {largo && striscia}
            {!largo && chi && pagina !== 'timer' && <ChiSei chi={chi} onEsci={onEsci} />}
            <div className="faccia-corsi" hidden={pagina !== 'calendario'}>
              <Sala soloDi={mio} onTimer={(l) => void apriTimer(l)} />
            </div>
            {timerMontato && <PaginaTimer incorporato={incorporato} visibile={pagina === 'timer'} indietro={daAppello} onIndietro={() => dalMenu('calendario')} />}
            {pagina === 'mieiTimer' && <MieiTimer soloDi={mio} onTimer={() => dalMenu('timer')} />}
            {pagina === 'ore' && mio && <MieOre personaId={mio} />}
          </main>
          {!largo && <BarraNavigazione voci={voci} attiva={pagina} onPagina={dalMenu} />}
          <Conferme />
        </div>
        )
      }}
    />
  )
}

/**
 * Il menu degli istruttori sullo schermo largo, fatto come quello della
 * segreteria, con le stesse voci della barra in basso del telefono. Niente
 * passaggi alle altre aree, nemmeno in prova: ognuna ha la sua porta, e da
 * qui non si va in segreteria nemmeno se si è di segreteria. Tranne chi è di
 * segreteria e insegna anche: entra in tutte e due, e passa dall'una
 * all'altra senza uscire.
 */
function MenuIstruttori({
  chi,
  onEsci,
  voci,
  pagina,
  onPagina,
}: {
  chi: Personale | null
  onEsci?: () => void
  voci: { pagina: PaginaIstruttori; nome: string }[]
  pagina: PaginaIstruttori
  onPagina: (p: PaginaIstruttori) => void
}) {
  const esci = onEsci ?? (inProvaScelta ? () => scegliProva(false) : undefined)
  return (
    <nav className="sg-menu" aria-label="Istruttori">
      <div className="row" style={{ gap: 10, padding: '0 8px' }}>
        <Logo width={46} />
        <span className="stack" style={{ gap: 2 }}>
          <span className="ob" style={{ fontSize: 20, fontWeight: 700, letterSpacing: '0.04em', lineHeight: 1 }}>ODS CORSI</span>
          <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.2em', color: 'var(--dim)' }}>ISTRUTTORI</span>
        </span>
      </div>
      <div className="sg-voci">
        {voci.map((v) => (
          <button key={v.pagina} type="button" className="num sg-voce" aria-current={pagina === v.pagina ? 'page' : undefined} onClick={() => onPagina(v.pagina)}>
            {v.nome}
          </button>
        ))}
      </div>
      <div className="grow" />
      <div className="sg-voci">
        {chi?.ancheIstruttore && (
          <button type="button" className="num sg-voce" onClick={() => passaA('segreteria')}>
            SEGRETERIA →
          </button>
        )}
      </div>
      <div className="row sg-icone">
        <a className="icon-btn tasto-guida" href={indirizzoPagina('istruttori')} target="_blank" rel="noopener" title="La guida" aria-label="Apri la guida">
          ?
        </a>
        <TastoTema />
      </div>
      <div className="sg-chi">
        <span style={{ fontSize: 14, fontWeight: 600 }}>{chi ? `${chi.nome} ${chi.cognome}` : `${ISTRUTTORE_PROVA.nome} · di prova`}</span>
        <span style={{ fontSize: 12, color: 'var(--dim)' }}>
          {!chi || chi.ruolo === 'istruttore' ? 'Istruttore · calendario e appello' : chi.ancheIstruttore ? `${nomeDelRuolo(chi)} · le tue lezioni` : 'Segreteria · anche l’appello'}
        </span>
        {!chi && <span className="num sg-bollino">DATI DI PROVA</span>}
        {esci && (
          <button type="button" className="sg-link" onClick={esci}>
            Esci
          </button>
        )}
        <span className="num versione" title={VERSIONE_ESTESA}>
          {VERSIONE}
        </span>
      </div>
    </nav>
  )
}

/** La guida, senza porta: non c'è niente di riservato, e serve anche a chi non è ancora entrato. */
function AreaGuida() {
  return (
    <div className="app">
      <Testata luogo="GUIDA" />
      <Guida />
    </div>
  )
}

/**
 * La segreteria, con la sua porta: entra solo chi ne ha il ruolo. Un altro
 * account che arriva qui torna nella sua area (vedi `useChi`).
 */
function AreaSegreteria() {
  const [chi, setChi] = useChi()

  if (!serveAccesso) {
    return (
      <Segreteria
        nome="Segreteria di prova"
        prova
        onEsci={inProvaScelta ? () => scegliProva(false) : undefined}
      />
    )
  }

  if (chi)
    return (
      <Segreteria
        nome={`${chi.nome} ${chi.cognome}`}
        ruolo={nomeDelRuolo(chi)}
        prova={false}
        onEsci={() => void esci()}
        onIstruttori={chi.ancheIstruttore ? () => passaA('istruttori') : undefined}
      />
    )

  return (
    <div className="app">
      <Testata luogo="SEGRETERIA" />
      <main className="scroll">
        {chi === undefined && <UnAttimo />}
        {chi === null && <Accesso onEntrato={setChi} />}
      </main>
    </div>
  )
}
