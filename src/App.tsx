import type { ReactNode } from 'react'
import { Logo } from './components/Logo'
import { TastoTema } from './components/TastoTema'
import { Sala } from './components/Sala'
import { Accesso, AltreAree, Porta, ScegliPassword, UnAttimo, useChi } from './components/Porta'
import { IscrizioniScreen } from './components/IscrizioniScreen'
import { Guida } from './components/Guida'
import { Tablet } from './components/tablet/Tablet'
import { Segreteria } from './components/segreteria/Segreteria'
import { INDIRIZZI, TIMER, useArea, vaiA } from './lib/aree'
import { esci, passaA, serveAccesso, type Personale } from './lib/accesso'
import { useLargo } from './lib/largo'
import { INDIRIZZO_GUIDA, indirizzoPagina } from './lib/guida'
import { ARRIVO } from './lib/invito'
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
              L’interval timer per la lezione. È un’app a sé, nella cartella timer/.
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
 * segreteria, se apre questo indirizzo: anche lei fa l'appello. La porta è
 * sua, con la sua sessione: l'accesso fatto in segreteria qui non vale, e
 * chi apre `istruttori/` sul computer della reception trova la porta, non
 * l'account della segreteria.
 *
 * Le iscrizioni non stanno qui, nemmeno in prova: all'istruttore non
 * servono, e hanno il loro indirizzo (`iscrizioni/`) e la segreteria. In
 * prova resta solo il passaggio alla segreteria, per far vedere l'app intera.
 *
 * Sullo schermo largo ha la stessa faccia della segreteria: il menu a
 * sinistra, con la guida e chi è entrato, e a destra calendario e appello
 * affiancati, alti quanto lo schermo.
 */
function Istruttori() {
  const largo = useLargo()

  if (largo) {
    return (
      <Porta
        cornice={(x) => (
          <div className="app">
            <Testata luogo="ISTRUTTORI" guida={INDIRIZZO_GUIDA} />
            <main className="scroll">{x}</main>
          </div>
        )}
        dentro={(chi, onEsci) => (
          <MenuIstruttori chi={chi} onEsci={onEsci}>
            <div className="faccia-corsi">
              <Sala />
            </div>
          </MenuIstruttori>
        )}
      />
    )
  }

  return (
    <div className="app">
      <Testata luogo="ISTRUTTORI" guida={INDIRIZZO_GUIDA}>
        {!serveAccesso && (
          <nav className="schede">
            <button className="scheda" data-on>
              APPELLO
            </button>
            <button className="scheda" data-on={false} onClick={() => vaiA('segreteria')}>
              SEGRETERIA
            </button>
          </nav>
        )}
      </Testata>
      <main className="scroll">
        <div className="faccia-corsi">
          <Porta>
            <Sala />
          </Porta>
        </div>
      </main>
    </div>
  )
}

/**
 * Il menu degli istruttori sullo schermo largo, fatto come quello della
 * segreteria. Solo in prova (`chi` è `null`) c'è anche il passaggio alla
 * segreteria: col database vero le aree sono separate, ognuna con la sua
 * porta, e da qui non si va in segreteria nemmeno se si è di segreteria.
 */
function MenuIstruttori({ chi, onEsci, children }: { chi: Personale | null; onEsci?: () => void; children: ReactNode }) {
  const esci = onEsci ?? (inProvaScelta ? () => scegliProva(false) : undefined)
  return (
    <div className="sg">
      <nav className="sg-menu" aria-label="Istruttori">
        <div className="row" style={{ gap: 10, padding: '0 8px' }}>
          <Logo width={46} />
          <span className="stack" style={{ gap: 2 }}>
            <span className="ob" style={{ fontSize: 20, fontWeight: 700, letterSpacing: '0.04em', lineHeight: 1 }}>ODS CORSI</span>
            <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.22em', color: 'var(--dim)' }}>ISTRUTTORI</span>
          </span>
        </div>
        <div className="sg-voci">
          <span className="num sg-voce" aria-current="page">
            APPELLO
          </span>
        </div>
        <div className="grow" />
        {/* In un'altra scheda: l'appello resta dov'era. */}
        <div className="sg-voci">
          <a className="num sg-voce" href={indirizzoPagina('istruttori')} target="_blank" rel="noopener">
            GUIDA ↗
          </a>
          <a className="num sg-voce" href={TIMER} target="_blank" rel="noopener">
            TIMER ↗
          </a>
          {!chi && (
            <a className="num sg-voce" href={INDIRIZZI.segreteria}>
              ← SEGRETERIA
            </a>
          )}
        </div>
        <div className="sg-chi">
          <span style={{ fontSize: 14, fontWeight: 600 }}>{chi ? `${chi.nome} ${chi.cognome}` : 'Istruttore di prova'}</span>
          <span style={{ fontSize: 12, color: 'var(--dim)' }}>
            {chi?.ruolo === 'staff' ? 'Segreteria · anche l’appello' : 'Istruttore · calendario e appello'}
          </span>
          {!chi && <span className="num sg-bollino">DATI DI PROVA</span>}
          <TastoTema link />
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
      <main className="sg-corpo sg-corpo-sala">{children}</main>
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
        onApp={() => vaiA('istruttori')}
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
              {/* L'accesso fatto qui passa agli istruttori, e qui non resta. */}
              <button type="button" className="btn btn-go" onClick={() => void passaA('istruttori')}>
                VAI AGLI ISTRUTTORI
              </button>
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
