import { lazy, Suspense, useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import type { DatiTablet, LezioneSala, Postazione } from '../../lib/tablet'
import { datiTablet, fase, lasciaTablet, REGOLE } from '../../lib/tablet'
import type { Settings } from '../../../timer/src/types'
import type { Incorporato, StatoTimer, TimerPronto } from '../../../timer/src/lib/incorporato'
import type { Lezione } from '../../../timer/src/lib/lezione'
import { loadSettings } from '../../../timer/src/lib/storage'
import type { TimerSala } from '../../../timer/src/lib/impostazioniSala'
import type { FonteClip } from '../../../timer/src/lib/voice'
import { eUnId } from '../../../timer/src/lib/palestra'
import { clock } from '../../../timer/src/lib/format'
import { useMusica, useSpotify } from '../../../timer/src/lib/useMusica'
import { leggiLinkSpotify, suonaLista } from '../../../timer/src/lib/spotify'
import { PlayerYoutube } from '../../../timer/src/components/PlayerYoutube'
import { fonteDelLink, type ListaMusica } from '../../lib/musica'
import { trattieniAggiornamento } from '../../lib/aggiornamento'
import { Cronometro, Persone } from '../Icons'
import { chiaveGiorno, giornoPerEsteso, oraDi } from '../../lib/sala'
import { Logo } from '../Logo'
import { TastoTema } from '../TastoTema'
import { giornoDopo, messaggio, useAdesso, useInattivo, useSchermoAcceso } from './comune'
import { TabletHome } from './TabletHome'
import { TabletPresenza } from './TabletPresenza'
import { TabletRecupero } from './TabletRecupero'
import { TabletPin } from './TabletPin'
import { TabletIstruttore } from './TabletIstruttore'
import { MusicaSala, VideoSala } from './MusicaSala'

/**
 * Il tablet di sala, a pieno schermo.
 *
 * Prima di tutto il tablet deve sapere in che sala è: col database lo dice
 * l'account della sala, con cui la segreteria fa l'accesso una volta sola; in
 * prova si sceglie da un elenco. Da lì in poi resta così finché qualcuno non
 * lo scollega dall'area istruttore.
 */
export function Tablet() {
  const [d, setD] = useState<DatiTablet | null>(null)
  const [postazione, setPostazione] = useState<Postazione | null | undefined>(undefined)
  const [guaio, setGuaio] = useState<string | null>(null)

  useSchermoAcceso()

  const leggi = useCallback(async (x: DatiTablet) => {
    try {
      setPostazione(await x.postazione())
      setGuaio(null)
    } catch (e) {
      setGuaio(messaggio(e, 'Non riesco a sapere in che sala sono'))
    }
  }, [])

  const [tentativo, setTentativo] = useState(0)
  useEffect(() => {
    let vivo = true
    datiTablet().then(
      (x) => {
        if (!vivo) return
        setD(x)
        void leggi(x)
      },
      (e) => vivo && setGuaio(messaggio(e, "Non riesco a caricare l'app")),
    )
    return () => {
      vivo = false
    }
  }, [leggi, tentativo])

  // Senza rete (dopo un black-out il tablet si accende prima del wifi) non si
  // sa in che sala si è: non è un tablet da collegare, si riprova da soli.
  const bloccato = postazione === undefined && !!guaio
  useEffect(() => {
    if (!bloccato) return
    const riprova = () => (d ? void leggi(d) : setTentativo((t) => t + 1))
    const i = window.setInterval(riprova, 30_000)
    window.addEventListener('online', riprova)
    return () => {
      window.clearInterval(i)
      window.removeEventListener('online', riprova)
    }
  }, [bloccato, d, leggi])

  if (bloccato) {
    return (
      <div className="tb">
        <div className="tb-corpo stack" style={{ gap: 18, padding: 32 }}>
          <span className="ob tb-titolo" style={{ fontSize: 40 }}>TABLET DI SALA</span>
          <span className="tb-sotto" style={{ fontSize: 18, lineHeight: 1.5 }}>
            {guaio}
          </span>
          <span className="tb-nota">Riprovo da solo fra poco, e appena torna la rete.</span>
          <button type="button" className="tb-btn tb-btn-linea" style={{ alignSelf: 'flex-start' }} onClick={() => (d ? void leggi(d) : setTentativo((t) => t + 1))}>
            RIPROVA ADESSO
          </button>
        </div>
      </div>
    )
  }

  if (!d || postazione === undefined) return <div className="tb"><p className="tb-nota" style={{ padding: 32 }}>Un attimo…</p></div>

  if (!postazione) {
    return (
      <div className="tb">
        {d.modo === 'prova' && <div className="nastro-prova">DATI DI PROVA · ORARIO VERO, ISCRITTI INVENTATI</div>}
        <Preparazione d={d} guaio={guaio} onPronto={() => void leggi(d)} />
      </div>
    )
  }

  return (
    <div className="tb">
      {d.modo === 'prova' && <div className="nastro-prova">DATI DI PROVA · ORARIO VERO, ISCRITTI INVENTATI</div>}
      <TabletSala
        d={d}
        postazione={postazione}
        onScollega={async () => {
          await d.scollega()
          setPostazione(null)
        }}
      />
    </div>
  )
}

type Vista =
  | { s: 'home' }
  | { s: 'presenza'; lezione: LezioneSala; da: 'home' | 'recupero'; corsoId?: string }
  | { s: 'recupero'; corsoId: string | null }
  | { s: 'pin' }
  | { s: 'istruttore'; pin: string; nome: string }

/** Il timer pesa quanto il resto dell'app: si scarica solo su un tablet di sala. */
const TimerSala = lazy(() => import('./TimerSala').then((m) => ({ default: m.TimerSala })))

/** Le due schede della barra in basso. */
type Scheda = 'presenze' | 'timer'

/** Il colore dell'intervallo del timer, quello del bordo del suo schermo. */
const COLORE_TIMER: Record<string, string> = {
  prepare: 'var(--giallo)',
  work: 'var(--rosso)',
  rest: 'var(--verde)',
  setRest: 'var(--blu)',
  cooldown: 'var(--blu)',
}
const coloreDi = (t: StatoTimer) => (t.status === 'done' ? 'var(--verde)' : t.kind ? COLORE_TIMER[t.kind] : 'var(--line)')
/** Un allenamento che conta: avviato e non finito. */
const inCorso = (t: StatoTimer | null): t is StatoTimer => !!t && (t.status === 'running' || t.status === 'paused')

/** La lista della musica scelta su questo tablet: resta anche dopo un ricaricamento. */
const DOVE_MUSICA = 'ods-corsi:musica-sala'
function listaRicordata(): string | null {
  try {
    return localStorage.getItem(DOVE_MUSICA)
  } catch {
    return null
  }
}
function ricordaLista(id: string | null) {
  try {
    if (id) localStorage.setItem(DOVE_MUSICA, id)
    else localStorage.removeItem(DOVE_MUSICA)
  } catch {
    // Si perde solo la scelta al prossimo ricaricamento.
  }
}

function TabletSala({ d, postazione, onScollega }: { d: DatiTablet; postazione: Postazione; onScollega: () => void }) {
  const adesso = useAdesso(d)
  const [vista, setVista] = useState<Vista>({ s: 'home' })
  const [scheda, setScheda] = useState<Scheda>('presenze')
  const [lezioni, setLezioni] = useState<LezioneSala[] | null>(null)
  const [guaio, setGuaio] = useState<string | null>(null)

  // Le ultime due settimane per il recupero, e la prossima per dire quando
  // si ricomincia: un intervallo solo, riletto ogni cinque minuti. Con loro le
  // liste della musica e il timer della sala, che la segreteria può aver cambiato.
  const [liste, setListe] = useState<ListaMusica[]>([])
  const [timerSala, setTimerSala] = useState<TimerSala | null>(null)
  const [clipSala, setClipSala] = useState<FonteClip | null>(null)
  const carica = useCallback(async () => {
    const oggi = d.adesso()
    d.musica().then(setListe, () => {
      // Senza rete restano quelle di prima.
    })
    d.timerSala().then(
      // Lo stesso valore riletto non deve ridisegnare il timer.
      (i) => setTimerSala((prima) => (JSON.stringify(prima) === JSON.stringify(i) ? prima : i)),
      () => {
        // Senza rete il timer tiene quelle dell'ultima volta, che ha già salvato.
      },
    )
    d.clipSala().then(
      // Le stesse clip rilette non devono svuotare quelle già scaricate.
      (f) => setClipSala((prima) => (prima?.versione === f.versione ? prima : f)),
      () => {
        // Senza rete restano quelle di prima; senza clip parla la voce di sistema.
      },
    )
    try {
      setLezioni(await d.lezioni(giornoDopo(oggi, -REGOLE.recuperoGiorni), giornoDopo(oggi, 7)))
      setGuaio(null)
    } catch (e) {
      setGuaio(messaggio(e, 'Non riesco a leggere il calendario'))
    }
  }, [d])

  useEffect(() => {
    void carica()
    const i = window.setInterval(() => void carica(), 5 * 60_000)
    const torna = () => void carica()
    window.addEventListener('online', torna)
    return () => {
      window.clearInterval(i)
      window.removeEventListener('online', torna)
    }
  }, [carica])

  const aHome = useCallback(() => {
    setVista({ s: 'home' })
    void carica()
  }, [carica])

  // --- Il timer ---------------------------------------------------------------
  // Sta sempre montato, anche sotto le presenze: un allenamento avviato va
  // avanti, e qui in testata se ne vede lo stato.
  const [timer, setTimer] = useState<StatoTimer | null>(null)
  const [settingsTimer, setSettingsTimer] = useState<Settings>(() => loadSettings())
  useEffect(() => {
    trattieniAggiornamento(inCorso(timer))
  }, [timer])

  // La lezione in cui ci si segna adesso: il timer mette in cima i suoi timer.
  const aperta = (lezioni ?? []).find((l) => l.stato !== 'annullata' && fase(l, adesso) === 'aperta') ?? null
  const lezioneTimer = useMemo<Lezione | null>(
    () => (aperta ? { corsoId: aperta.corsoId, sessioneId: eUnId(aperta.id) ? aperta.id : null, lezioneId: aperta.id, nome: aperta.corso } : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [aperta?.id, aperta?.corsoId, aperta?.corso],
  )

  // I timer che la lezione aperta ha pronti (li dice il timer, che ha la
  // libreria), e la richiesta di farne partire uno da qui.
  const [pronto, setPronto] = useState<TimerPronto | null>(null)
  const [avvia, setAvvia] = useState<{ id: string; volta: number } | null>(null)
  const avviaPronto = (id: string) => {
    setScheda('timer')
    setAvvia((a) => ({ id, volta: (a?.volta ?? 0) + 1 }))
  }

  // --- La musica --------------------------------------------------------------
  // Una lista della sala, se se n'è scelta una; altrimenti quella delle
  // impostazioni del timer. La barra, il lettore e il timer suonano questa.
  const [sceltaId, setSceltaId] = useState<string | null>(() => listaRicordata())
  const [parti, setParti] = useState(false)
  const lista = liste.find((l) => l.id === sceltaId) ?? null
  const fonteLista = lista ? fonteDelLink(lista.link) : null
  const musicaSala = useMemo<Pick<Settings, 'musicaFonte' | 'youtube'>>(
    () =>
      lista && fonteLista
        ? { musicaFonte: fonteLista, youtube: fonteLista === 'youtube' ? lista.link : settingsTimer.youtube }
        : { musicaFonte: settingsTimer.musicaFonte, youtube: settingsTimer.youtube },
    [lista, fonteLista, settingsTimer.musicaFonte, settingsTimer.youtube],
  )
  const conSala = useMemo(() => ({ ...settingsTimer, ...musicaSala }), [settingsTimer, musicaSala])
  const musica = useMusica(conSala)
  const spotify = useSpotify()
  const conYoutube = musica.fonte === 'youtube' && musica.attiva
  const scegliLista = (l: ListaMusica | null) => {
    setSceltaId(l?.id ?? null)
    ricordaLista(l?.id ?? null)
    const uri = l ? leggiLinkSpotify(l.link) : null
    if (uri) void suonaLista(uri)
    setParti(true)
  }

  const incorporato = useMemo<Incorporato>(
    () => ({
      lezione: lezioneTimer,
      musica: musicaSala,
      sala: timerSala,
      clip: clipSala,
      visibile: scheda === 'timer',
      onStato: setTimer,
      onSettings: setSettingsTimer,
      onPronto: setPronto,
      avvia,
    }),
    [lezioneTimer, musicaSala, timerSala, clipSala, scheda, avvia],
  )

  // Chi se ne va a metà lascia il tablet com'era; l'area istruttore si chiude
  // da sola, perché dentro c'è il PIN di qualcuno. La scheda TIMER invece
  // resta: un conto alla rovescia avviato non lo dice a nessuno, e chi arriva
  // si segna comunque dal tasto in testata.
  const inattivo = vista.s === 'istruttore' ? REGOLE.istruttoreInattivoMin * 60_000 : 90_000
  useInattivo(inattivo, () => {
    if (vista.s !== 'home') aHome()
  })

  const vaiPresenze = () => setScheda('presenze')
  const vaiTimer = () => setScheda('timer')
  const segnaAperta = () => {
    if (!aperta) return
    setScheda('presenze')
    setVista({ s: 'presenza', lezione: aperta, da: 'home' })
  }

  return (
    <>
      {/* Col timer in corso e le presenze davanti, il bordo della testata
          prende il colore dell'intervallo: si legge da tutta la sala. */}
      <header className="tb-testata" style={scheda === 'presenze' && inCorso(timer) ? { borderBottom: `8px solid ${coloreDi(timer)}` } : undefined}>
        <Logo width={70} />
        <div className="stack grow" style={{ gap: 2, minWidth: 0 }}>
          <span className="ob tb-sala">SALA {postazione.sala.toUpperCase()}</span>
          <span className="num tb-data">{giornoPerEsteso(chiaveGiorno(adesso)).toUpperCase()} · OFFICINE DELLO SPORT</span>
        </div>
        {vista.s === 'istruttore' && scheda === 'presenze' && (
          <span className="num tb-bollino" style={{ background: 'var(--blu)' }}>AREA ISTRUTTORE · {vista.nome.toUpperCase()}</span>
        )}
        {/* Col timer in corso e le presenze davanti: il timer resta qui, col
            suo colore, e un tocco ci riporta. */}
        {scheda === 'presenze' && inCorso(timer) && (
          <button type="button" className="tb-chip" style={{ ['--tinta' as string]: coloreDi(timer) }} onClick={vaiTimer} aria-label="Torna al timer">
            <span className="ob tb-chip-fase">{timer.status === 'paused' ? 'IN PAUSA' : timer.etichetta}</span>
            <span className="num tb-chip-tempo">{clock(timer.secondi)}</span>
            <span className="stack tb-chip-testo">
              <span className="tb-chip-nome">{timer.nome.toUpperCase()}</span>
              <span className="tb-chip-sotto">{timer.conto ? `${timer.conto} · ` : ''}tocca per tornare</span>
            </span>
          </button>
        )}
        {/* Col timer davanti: chi arriva tardi si segna senza fermarlo. */}
        {scheda === 'timer' && aperta && (
          <button type="button" className="tb-chip tb-chip-segna" onClick={segnaAperta}>
            <span className="stack tb-chip-testo">
              <span className="tb-chip-sotto" style={{ color: 'var(--verde)', fontWeight: 700, letterSpacing: '0.16em' }}>SI SEGNA ORA</span>
              <span className="ob tb-chip-nome" style={{ fontSize: 19 }}>
                {aperta.corso.toUpperCase()} · <span className="num">{aperta.presenti}/{aperta.iscritti}</span>
              </span>
            </span>
            <span className="ob tb-chip-azione">SEGNATI</span>
          </button>
        )}
        <span className="num tb-ora">{oraDi(adesso.toISOString())}</span>
        <TastoTema />
      </header>

      <div className="tb-centro">
        <div className="tb-area">
          {scheda === 'presenze' && (
            <>
              {vista.s === 'home' && (
                <TabletHome
                  sala={postazione.sala}
                  adesso={adesso}
                  lezioni={lezioni}
                  guaio={guaio}
                  onSegna={(l) => setVista({ s: 'presenza', lezione: l, da: 'home' })}
                  timer={aperta && lezioneTimer ? { lezioneId: aperta.id, pronto, inCorso: inCorso(timer) } : null}
                  onAvviaTimer={avviaPronto}
                  onVaiTimer={vaiTimer}
                  onRecupero={() => setVista({ s: 'recupero', corsoId: null })}
                  onPin={() => setVista({ s: 'pin' })}
                />
              )}
              {vista.s === 'presenza' && (
                <TabletPresenza
                  d={d}
                  lezione={vista.lezione}
                  adesso={adesso}
                  onIndietro={() => {
                    if (vista.da === 'recupero') {
                      setVista({ s: 'recupero', corsoId: vista.corsoId ?? null })
                      void carica()
                    } else aHome()
                  }}
                />
              )}
              {vista.s === 'recupero' && (
                <TabletRecupero
                  adesso={adesso}
                  lezioni={lezioni ?? []}
                  corsoIniziale={vista.corsoId}
                  onApri={(l, corsoId) => setVista({ s: 'presenza', lezione: l, da: 'recupero', corsoId })}
                  onIndietro={aHome}
                />
              )}
              {vista.s === 'pin' && (
                <TabletPin d={d} onEntrato={(pin, chi) => setVista({ s: 'istruttore', pin, nome: chi.nome })} onAnnulla={aHome} />
              )}
              {vista.s === 'istruttore' && (
                <TabletIstruttore
                  d={d}
                  pin={vista.pin}
                  adesso={adesso}
                  lezioni={lezioni ?? []}
                  onCambiato={() => void carica()}
                  onEsci={aHome}
                  onPinScaduto={() => setVista({ s: 'pin' })}
                  onScollega={onScollega}
                />
              )}
            </>
          )}
          <Suspense fallback={scheda === 'timer' ? <p className="tb-nota" style={{ padding: 32 }}>Un attimo…</p> : null}>
            <TimerSala incorporato={incorporato} visibile={scheda === 'timer'} />
          </Suspense>
        </div>
        {conYoutube && <VideoSala />}
      </div>

      {/* La barra della sala: la stessa sotto le presenze e sotto il timer. */}
      <footer className="tb-piede">
        <button type="button" className="tb-scheda-sala" aria-pressed={scheda === 'presenze'} onClick={vaiPresenze}>
          <Persone size={26} />
          <span className="stack" style={{ gap: 1 }}>
            <span className="ob tb-scheda-nome">PRESENZE</span>
            <span className="num tb-scheda-sotto">{aperta ? `${aperta.presenti}/${aperta.iscritti} SEGNATI` : 'OGGI IN SALA'}</span>
          </span>
        </button>
        <button type="button" className="tb-scheda-sala" aria-pressed={scheda === 'timer'} onClick={vaiTimer}>
          <Cronometro size={26} />
          <span className="stack" style={{ gap: 1 }}>
            <span className="ob tb-scheda-nome">TIMER</span>
            <span className="num tb-scheda-sotto" style={inCorso(timer) ? { color: coloreDi(timer) } : undefined}>
              {inCorso(timer)
                ? `${timer.status === 'paused' ? 'IN PAUSA' : timer.etichetta} ${clock(timer.secondi)}`
                : aperta
                  ? aperta.corso.toUpperCase()
                  : 'DELLA PALESTRA'}
            </span>
          </span>
        </button>
        <span className="grow" />
        <MusicaSala musica={musica} liste={liste} scelta={lista ? lista.id : null} spotifyCollegato={spotify.collegato} onScegli={scegliLista} />
      </footer>

      {/* Il lettore di YouTube, uno solo e fermo qui: si appoggia sopra il suo
          posto, a destra, e cambiando scheda non si ricarica. */}
      {conYoutube && <PlayerYoutube link={musicaSala.youtube} parti={parti} />}
    </>
  )
}

/** Il tablet non sa ancora in che sala è. */
function Preparazione({ d, guaio, onPronto }: { d: DatiTablet; guaio: string | null; onPronto: () => void }) {
  const [utente, setUtente] = useState('')
  const [password, setPassword] = useState('')
  const [errore, setErrore] = useState<string | null>(guaio)
  const [aspetta, setAspetta] = useState(false)

  const accedi = async (e: FormEvent) => {
    e.preventDefault()
    if (!d.entra) return
    setAspetta(true)
    setErrore(null)
    try {
      await d.entra(utente, password)
      onPronto()
    } catch (x) {
      setErrore(messaggio(x, 'Accesso non riuscito'))
    } finally {
      setAspetta(false)
    }
  }

  return (
    <div className="tb-corpo tb-preparazione">
      <div className="stack" style={{ gap: 18, maxWidth: 560 }}>
        <Logo width={90} />
        <span className="ob tb-titolo" style={{ fontSize: 40 }}>TABLET DI SALA</span>

        {d.sale && d.scegliSala ? (
          <>
            <span className="tb-sotto" style={{ fontSize: 18, lineHeight: 1.5 }}>
              In che sala è appeso questo tablet? Col database lo dice l'account della sala; in prova si sceglie qui.
            </span>
            <div className="tb-griglia" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
              {d.sale.map((s) => (
                <button
                  key={s}
                  type="button"
                  className="ob tb-scelta"
                  style={{ fontSize: 26, fontWeight: 700, letterSpacing: '0.06em', minHeight: 96 }}
                  onClick={() => void d.scegliSala!(s).then(onPronto)}
                >
                  {s.toUpperCase()}
                </button>
              ))}
            </div>
          </>
        ) : (
          <form className="stack" style={{ gap: 12 }} onSubmit={(e) => void accedi(e)}>
            <span className="tb-sotto" style={{ fontSize: 18, lineHeight: 1.5 }}>
              Si fa una volta sola, con l'account della sala che ha preparato la segreteria. Poi il tablet resta collegato.
            </span>
            <input
              className="tb-campo"
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="nome utente della sala"
              value={utente}
              onChange={(e) => setUtente(e.target.value)}
              required
            />
            <input
              className="tb-campo"
              type="password"
              autoComplete="current-password"
              placeholder="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button type="submit" className="tb-btn tb-btn-verde" disabled={aspetta}>
              {aspetta ? 'UN ATTIMO…' : 'COLLEGA IL TABLET'}
            </button>
          </form>
        )}

        {errore && (
          <span role="alert" style={{ fontSize: 17, fontWeight: 600, color: 'var(--rosso)' }}>
            {errore}
          </span>
        )}
        <button type="button" className="tb-scollega" style={{ alignSelf: 'flex-start' }} onClick={lasciaTablet}>
          ← Non è un tablet di sala: torna alla scelta delle aree
        </button>
      </div>
    </div>
  )
}
