import { type ReactNode, useState } from 'react'
import { Logo } from './components/Logo'
import { TastoTema } from './components/TastoTema'
import { Sala } from './components/Sala'
import { Accesso, AltreAree, Porta, UnAttimo, useChi } from './components/Porta'
import { IscrizioniScreen } from './components/IscrizioniScreen'
import { Guida } from './components/Guida'
import { Tablet } from './components/tablet/Tablet'
import { Segreteria } from './components/segreteria/Segreteria'
import { INDIRIZZI, TIMER, useArea } from './lib/aree'
import { esci, serveAccesso } from './lib/accesso'
import { INDIRIZZO_GUIDA } from './lib/guida'
import { inProvaScelta, scegliProva } from './lib/dati'
import { VERSIONE, VERSIONE_ESTESA } from './lib/versione'

/**
 * ODS Corsi: il calendario delle sale e il registro delle presenze.
 *
 * È un'app a sé, separata dal timer di proposito: la presenza è una cosa che
 * riguarda la palestra, il timer una cosa che riguarda la lezione, e tenerle
 * nello stesso posto le legava più di quanto servisse.
 *
 * Ha quattro facce, ognuna col suo indirizzo (vedi `aree.ts`) e la sua porta:
 * la segreteria per il computer della reception, a tutto schermo e solo per
 * chi ne ha il ruolo; le iscrizioni, la pagina pubblica del link da mandare a
 * chi vuole iscriversi; gli istruttori, col calendario e l'appello; e la sala,
 * il tablet appeso al muro.
 *
 * Col database vero ognuno entra dal suo indirizzo e trova solo il suo posto,
 * senza schede. In prova le porte sono aperte a tutti e le schede ci sono,
 * perché la prova serve a far vedere l'app intera.
 */
export default function App() {
  const area = useArea()
  if (area === 'segreteria') return <AreaSegreteria />
  if (area === 'iscrizioni') return <Iscrizioni />
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

/** Senza niente nell'indirizzo: dove si vuole andare. */
function Scelta() {
  const voci: [keyof typeof INDIRIZZI, string, string][] = [
    ['istruttori', 'ISTRUTTORI', 'Il calendario e l’appello.'],
    ['segreteria', 'SEGRETERIA', 'Corsi, iscritti, presenze e richieste, dal computer della reception.'],
    ['iscrizioni', 'ISCRIZIONI', 'Come ci si iscrive, i costi e il modulo: la pagina da mandare a chi vuole iscriversi.'],
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
          <a className="card stack scelta-area" href={TIMER}>
            <span className="scelta-titolo">TIMER</span>
            <span className="passo-dettaglio" style={{ fontSize: 15 }}>
              L’interval timer per la lezione. È un’app a sé: si apre al suo indirizzo.
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
  return (
    <div className="app">
      <Testata luogo="ISCRIZIONI" />
      <main className="scroll">
        <IscrizioniScreen pubblica />
      </main>
    </div>
  )
}

/**
 * Il calendario e l'appello, dietro la porta. Entra anche chi è di
 * segreteria, se apre questo indirizzo: anche lei fa l'appello.
 *
 * In prova ci sono le schede, per passare al resto dell'app: i passi per
 * iscriversi come li vede il personale (con la lezione di prova) e la
 * segreteria. La sala resta montata anche quando si guarda altro, così
 * tornando si ritrova l'appello dov'era.
 */
function Istruttori() {
  const [scheda, setScheda] = useState<'corsi' | 'iscrizioni'>('corsi')
  return (
    <div className="app">
      <Testata luogo="ISTRUTTORI" guida={INDIRIZZO_GUIDA}>
        {!serveAccesso && (
          <nav className="schede">
            <button className="scheda" data-on={scheda === 'corsi'} onClick={() => setScheda('corsi')}>
              APPELLO
            </button>
            <button className="scheda" data-on={scheda === 'iscrizioni'} onClick={() => setScheda('iscrizioni')}>
              ISCRIZIONI
            </button>
            <button className="scheda" data-on={false} onClick={() => (window.location.hash = INDIRIZZI.segreteria)}>
              SEGRETERIA
            </button>
          </nav>
        )}
      </Testata>
      <main className="scroll">
        <div className="faccia-corsi" hidden={scheda !== 'corsi'}>
          <Porta>
            <Sala />
          </Porta>
        </div>
        {scheda === 'iscrizioni' && <IscrizioniScreen />}
      </main>
    </div>
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
 * La segreteria, con la sua porta: entra solo chi ne ha il ruolo, e ci resta
 * (il ritorno agli istruttori c'è solo in prova). Un istruttore che arriva
 * qui viene mandato al suo indirizzo.
 */
function AreaSegreteria() {
  const [chi, setChi] = useChi()

  if (!serveAccesso) {
    return (
      <Segreteria
        nome="Segreteria di prova"
        prova
        onApp={() => (window.location.hash = INDIRIZZI.istruttori)}
        onEsci={inProvaScelta ? () => scegliProva(false) : undefined}
      />
    )
  }

  if (chi && chi.ruolo === 'staff') {
    return (
      <Segreteria
        nome={`${chi.nome} ${chi.cognome}`}
        prova={false}
        onEsci={() => void esci().then(() => setChi(null))}
      />
    )
  }

  return (
    <div className="app">
      <Testata luogo="SEGRETERIA" />
      <main className="scroll">
        {chi === undefined && <UnAttimo />}
        {chi === null && <Accesso per="segreteria" onEntrato={setChi} />}
        {chi && (
          <div className="accesso">
            <div className="rule">
              <span className="rule-label">SEGRETERIA</span>
              <div className="rule-line" />
              <AltreAree />
            </div>
            <div className="pad stack" style={{ gap: 12, paddingBottom: 16 }}>
              <span className="passo-dettaglio" style={{ fontSize: 15 }}>
                {chi.nome}, il tuo account è da istruttore: la segreteria è solo per chi lavora alla reception. Il
                calendario e l’appello sono all’indirizzo degli istruttori.
              </span>
              <a className="btn btn-go" href={INDIRIZZI.istruttori}>
                VAI AGLI ISTRUTTORI
              </a>
              <button type="button" className="btn btn-ghost" onClick={() => void esci().then(() => setChi(null))}>
                ESCI E CAMBIA ACCOUNT
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
