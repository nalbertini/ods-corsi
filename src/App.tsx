import { type ReactNode, useEffect, useState } from 'react'
import { Logo } from './components/Logo'
import { TastoTema } from './components/TastoTema'
import { Sala } from './components/Sala'
import { Accesso, ChiSei, Porta, SceltaArea, ScegliPassword, UnAttimo, useChi } from './components/Porta'
import { IscrizioniScreen } from './components/IscrizioniScreen'
import { AreaIscritti, IscrittiChiusa } from './components/AreaIscritti'
import { Guida } from './components/Guida'
import { MieiTimer } from './components/MieiTimer'
import { Tablet } from './components/tablet/Tablet'
import { Segreteria } from './components/segreteria/Segreteria'
import { INDIRIZZI, TIMER, useArea } from './lib/aree'
import { account, esci, nomeDelRuolo, passaA, serveAccesso, type Account, type Personale } from './lib/accesso'
import { useLargo } from './lib/largo'
import { INDIRIZZO_GUIDA, indirizzoPagina } from './lib/guida'
import { ARRIVO } from './lib/invito'
import { ISTRUTTORE_PROVA, inProvaScelta, scegliProva } from './lib/dati'
import { VERSIONE, VERSIONE_ESTESA } from './lib/versione'

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
 * non trova rimandi. Restano solo la guida degli istruttori e il timer, che
 * è uno strumento della lezione.
 *
 * Sullo schermo largo ha la stessa faccia della segreteria: il menu a
 * sinistra, con la guida e chi è entrato, e a destra calendario e appello
 * affiancati, alti quanto lo schermo.
 */
function Istruttori() {
  const largo = useLargo()
  // Il calendario resta montato anche in I MIEI TIMER: tornando, l'appello è dov'era.
  const [pagina, setPagina] = useState<Pagina>('calendario')

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
      dentro={(chi, onEsci) => (
        <div className={largo ? 'sg' : 'app'}>
          {largo ? (
            <MenuIstruttori chi={chi} onEsci={onEsci} pagina={pagina} onPagina={setPagina} />
          ) : (
            <Testata luogo="ISTRUTTORI" guida={indirizzoPagina('istruttori')} />
          )}
          <main className={largo ? 'sg-corpo sg-corpo-sala' : 'scroll'}>
            {!largo && chi && <ChiSei chi={chi} onEsci={onEsci} />}
            <div className="faccia-corsi" hidden={pagina !== 'calendario'}>
              <Sala soloDi={soloDi(chi)} onMieiTimer={largo ? undefined : () => setPagina('timer')} />
            </div>
            {pagina === 'timer' && <MieiTimer soloDi={soloDi(chi)} onIndietro={largo ? undefined : () => setPagina('calendario')} />}
          </main>
        </div>
      )}
    />
  )
}

/**
 * Il menu degli istruttori sullo schermo largo, fatto come quello della
 * segreteria. Niente passaggi alle altre aree, nemmeno in prova: ognuna ha la
 * sua porta, e da qui non si va in segreteria nemmeno se si è di segreteria.
 * Tranne chi è di segreteria e insegna anche: entra in tutte e due, e passa
 * dall'una all'altra senza uscire.
 */
type Pagina = 'calendario' | 'timer'

function MenuIstruttori({
  chi,
  onEsci,
  pagina,
  onPagina,
}: {
  chi: Personale | null
  onEsci?: () => void
  pagina: Pagina
  onPagina: (p: Pagina) => void
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
      {/* Quello che l'istruttore fa, tutto qui: il calendario con l'appello e
          I MIEI TIMER in questa pagina, il timer in un'altra scheda, così
          l'appello resta dov'era. */}
      <div className="sg-voci">
        <button type="button" className="num sg-voce" aria-current={pagina === 'calendario' ? 'page' : undefined} onClick={() => onPagina('calendario')}>
          CALENDARIO
        </button>
        <button type="button" className="num sg-voce" aria-current={pagina === 'timer' ? 'page' : undefined} onClick={() => onPagina('timer')}>
          I MIEI TIMER
        </button>
        <a className="num sg-voce" href={TIMER} target="_blank" rel="noopener">
          TIMER ↗
        </a>
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
