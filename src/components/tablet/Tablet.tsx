import { lazy, Suspense, useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import type { DatiTablet, LezioneSala, Postazione, PresenzaIstruttore } from '../../lib/tablet'
import { codaDelTablet, datiTablet, lasciaTablet, lezioneDiAdesso, REGOLE } from '../../lib/tablet'
import type { Settings } from '../../../timer/src/types'
import type { Incorporato, StatoTimer, TimerPronto } from '../../../timer/src/lib/incorporato'
import type { Lezione } from '../../../timer/src/lib/lezione'
import { loadSettings } from '../../../timer/src/lib/storage'
import type { ImpostazioniSala, TimerSala } from '../../../timer/src/lib/impostazioniSala'
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
import { accedi, account, passaA } from '../../lib/accesso'
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

  // La sessione è una sola: con l'account di una persona il tablet non si
  // prepara, si torna nell'area di quella persona.
  useEffect(() => {
    if (d?.modo !== 'supabase' || postazione !== null) return
    let vivo = true
    void account().then((a) => vivo && a && a.area !== 'sala' && passaA(a.area), () => {})
    return () => {
      vivo = false
    }
  }, [d, postazione])

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
          // Si esce, e si torna alla porta di tutta l'app.
          await d.scollega()
          lasciaTablet()
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
  | { s: 'istruttore'; pin: string; nome: string; presenze: PresenzaIstruttore[] }
  | { s: 'esci-pin' }
  | { s: 'esci'; nome: string }

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
/** Lo stesso colore quando è scritto: giallo e verde puri sul tema chiaro non si leggono. */
const testoDi = (t: StatoTimer) =>
  coloreDi(t).replace('var(--giallo)', 'var(--giallo-testo)').replace('var(--verde)', 'var(--verde-testo)').replace('var(--line)', 'var(--dim)')
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

function TabletSala({ d, postazione, onScollega }: { d: DatiTablet; postazione: Postazione; onScollega: () => Promise<void> }) {
  const adesso = useAdesso(d)
  // I tocchi segnati senza rete, che aspettano di partire: la spia in testata.
  const [inCoda, setInCoda] = useState(0)
  useEffect(() => {
    const smetti = codaDelTablet(d).guarda(setInCoda)
    return () => void smetti()
  }, [d])
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
  // Le IMPOSTAZIONI del timer aperte col PIN: vedi più sotto, vicino all'inattività.
  const [sbloccato, setSbloccato] = useState(false)
  const [settingsTimer, setSettingsTimer] = useState<Settings>(() => loadSettings())
  useEffect(() => {
    trattieniAggiornamento(inCorso(timer))
  }, [timer])

  // La lezione in cui ci si segna adesso (al cambio, quella che comincia): il
  // timer mette in cima i suoi timer, e la barra ne conta i segnati.
  const aperta = lezioneDiAdesso(lezioni ?? [], adesso)
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

  // Maurizio, i segnali e lo schermo scelti nel timer di questo tablet: si
  // tengono subito, e vanno sul database per gli altri tablet, che li prendono
  // al loro prossimo giro. Senza rete restano qui fino alla rilettura.
  const salvaTimerSala = useCallback(
    (i: ImpostazioniSala) => {
      setTimerSala((prima) => (prima ? { ...prima, impostazioni: i } : prima))
      d.salvaTimerSala(i).catch(() => {
        // Il prossimo giro rilegge quelle del database, e il timer torna a quelle.
      })
    },
    [d],
  )

  const incorporato = useMemo<Incorporato>(
    () => ({
      lezione: lezioneTimer,
      musica: musicaSala,
      sala: timerSala,
      clip: clipSala,
      visibile: scheda === 'timer',
      conImpostazioni: sbloccato,
      onStato: setTimer,
      onSettings: setSettingsTimer,
      onTimerSala: salvaTimerSala,
      onPronto: setPronto,
      avvia,
    }),
    [lezioneTimer, musicaSala, timerSala, clipSala, scheda, sbloccato, avvia, salvaTimerSala],
  )

  // Chi se ne va a metà lascia il tablet com'era; l'area istruttore si chiude
  // da sola, perché dentro c'è il PIN di qualcuno. La scheda TIMER invece
  // resta: un conto alla rovescia avviato non lo dice a nessuno, e chi arriva
  // si segna comunque dal tasto in testata.
  //
  // L'area istruttore non resta aperta dietro al timer: passando a TIMER si
  // chiude, e le IMPOSTAZIONI del timer restano aperte (sbloccate) solo finché
  // si sta sul timer e lo si tocca. Chi torna alle presenze trova l'attesa.
  //
  // Con un allenamento in corso, allo scadere dell'inattività il muro torna
  // al timer: è quello che la sala sta guardando.
  const inattivo = vista.s === 'istruttore' || sbloccato ? REGOLE.istruttoreInattivoMin * 60_000 : 90_000
  useInattivo(inattivo, () => {
    setSbloccato(false)
    if (vista.s !== 'home') aHome()
    if (inCorso(timer)) setScheda('timer')
  })

  const vaiPresenze = () => {
    setSbloccato(false)
    setScheda('presenze')
  }
  const vaiTimer = () => {
    if (vista.s === 'istruttore') {
      setSbloccato(true)
      aHome()
    }
    setScheda('timer')
  }
  const segnaAperta = () => {
    if (!aperta) return
    setSbloccato(false)
    setScheda('presenze')
    setVista({ s: 'presenza', lezione: aperta, da: 'home' })
  }

  return (
    <>
      {/* Col timer in corso e le presenze davanti, il bordo della testata
          prende il colore dell'intervallo: si legge da tutta la sala. */}
      {/* Il recupero non tinge la testata: sopra le presenze il verde vuol dire
          «presente», e una testata verde lo confonderebbe. */}
      <header
        className="tb-testata"
        style={scheda === 'presenze' && inCorso(timer) && timer.kind !== 'rest' ? { borderBottom: `8px solid ${coloreDi(timer)}` } : undefined}
      >
        <Logo width={70} />
        <div className="stack grow" style={{ gap: 2, minWidth: 0 }}>
          <span className="ob tb-sala">SALA {postazione.sala.toUpperCase()}</span>
          <span className="num tb-data">{giornoPerEsteso(chiaveGiorno(adesso)).toUpperCase()} · OFFICINE DELLO SPORT</span>
        </div>
        {sbloccato && scheda === 'timer' && (
          <span className="num tb-bollino" style={{ background: 'var(--blu)' }}>
            IMPOSTAZIONI APERTE
          </span>
        )}
        {vista.s === 'istruttore' && scheda === 'presenze' && (
          <span className="num tb-bollino" style={{ background: 'var(--blu)' }}>
            AREA ISTRUTTORE · <span style={{ letterSpacing: 0 }}>{vista.nome}</span>
          </span>
        )}
        {/* Col timer in corso e le presenze davanti: il timer resta qui, col
            suo colore, e un tocco ci riporta. */}
        {scheda === 'presenze' && inCorso(timer) && (
          <button
            type="button"
            className="tb-chip"
            style={{ ['--tinta' as string]: coloreDi(timer), ['--tinta-testo' as string]: testoDi(timer) }}
            onClick={vaiTimer}
            aria-label="Torna al timer"
          >
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
              <span className="tb-chip-sotto" style={{ color: 'var(--verde-testo)', fontWeight: 700, letterSpacing: '0.16em' }}>SI SEGNA ORA</span>
              {/* Un nome lungo si accorcia, il conto no: è quello che serve. */}
              <span className="row" style={{ gap: 6, minWidth: 0 }}>
                <span className="ob tb-chip-nome" style={{ fontSize: 19 }}>
                  {aperta.corso.toUpperCase()}
                </span>
                <span className="ob num" style={{ fontSize: 19, fontWeight: 700, whiteSpace: 'nowrap' }}>
                  · {aperta.presenti}/{aperta.iscritti}
                </span>
              </span>
            </span>
            <span className="ob tb-chip-azione">SEGNATI</span>
          </button>
        )}
        {inCoda > 0 && (
          <span role="status" className="num tb-bollino tb-spia-rete">
            IN ATTESA DI RETE · {inCoda}
          </span>
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
                  onEsci={() => setVista({ s: 'esci-pin' })}
                />
              )}
              {vista.s === 'presenza' && (
                <TabletPresenza
                  d={d}
                  lezione={vista.lezione}
                  adesso={adesso}
                  onCambiato={() => void carica()}
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
                <TabletPin d={d} onEntrato={(pin, chi) => setVista({ s: 'istruttore', pin, nome: chi.nome, presenze: chi.presenze })} onAnnulla={aHome} />
              )}
              {vista.s === 'esci-pin' && (
                <TabletPin d={d} perUscire onEntrato={(_, chi) => setVista({ s: 'esci', nome: chi.nome })} onAnnulla={aHome} />
              )}
              {vista.s === 'esci' && <ConfermaUscita nome={vista.nome} onEsci={onScollega} onAnnulla={aHome} />}
            </>
          )}
          {/* L'area istruttore resta montata anche sotto il timer: tornando
              alle presenze si ritrova la lezione che si stava guardando. */}
          {vista.s === 'istruttore' && (
            <TabletIstruttore
              d={d}
              pin={vista.pin}
              presenze={vista.presenze}
              adesso={adesso}
              lezioni={lezioni ?? []}
              visibile={scheda === 'presenze'}
              onCambiato={() => void carica()}
              onEsci={aHome}
              onPinScaduto={() => setVista({ s: 'pin' })}
              onScollega={() => setVista({ s: 'esci', nome: vista.nome })}
            />
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
            <span className="num tb-scheda-sotto" style={inCorso(timer) ? { color: testoDi(timer) } : undefined}>
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

/**
 * L'ultima domanda prima di uscire, dopo il PIN: uscendo il tablet si
 * scollega dalla sala, e senza l'account della sala non ci torna. Una
 * schermata del tablet e non un `confirm()`, che a tutto schermo alcuni
 * browser non mostrano. Senza tocchi si torna alla schermata di sempre.
 */
function ConfermaUscita({ nome, onEsci, onAnnulla }: { nome: string; onEsci: () => Promise<void> | void; onAnnulla: () => void }) {
  const [aspetta, setAspetta] = useState(false)
  const [guaio, setGuaio] = useState<string | null>(null)
  const esci = async () => {
    setAspetta(true)
    setGuaio(null)
    try {
      await onEsci()
    } catch (e) {
      setGuaio(messaggio(e, 'Uscita non riuscita'))
      setAspetta(false)
    }
  }
  return (
    <div className="tb-corpo tb-pin">
      <div className="stack" style={{ gap: 16, maxWidth: 560 }}>
        <span className="ob tb-titolo" style={{ fontSize: 36 }}>USCIRE DAL TABLET?</span>
        <span className="tb-sotto" style={{ fontSize: 18, lineHeight: 1.5 }}>
          {nome ? `${nome}, il` : 'Il'} tablet si scollega dalla sala: nessuno potrà più segnarsi qui finché la segreteria non lo
          ricollega con l'account della sala.
        </span>
        {guaio && (
          <span role="alert" style={{ fontSize: 19, fontWeight: 700, color: 'var(--rosso)' }}>
            {guaio}
          </span>
        )}
        <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
          <button type="button" className="tb-btn tb-btn-grande tb-btn-rosso" disabled={aspetta} onClick={() => void esci()}>
            {aspetta ? 'UN ATTIMO…' : 'SÌ, ESCI'}
          </button>
          <button type="button" className="tb-btn tb-btn-grande tb-btn-linea" disabled={aspetta} onClick={onAnnulla}>
            ANNULLA
          </button>
        </div>
      </div>
    </div>
  )
}

/** Il tablet non sa ancora in che sala è. */
function Preparazione({ d, guaio, onPronto }: { d: DatiTablet; guaio: string | null; onPronto: () => void }) {
  const [utente, setUtente] = useState('')
  const [password, setPassword] = useState('')
  const [errore, setErrore] = useState<string | null>(guaio)
  const [aspetta, setAspetta] = useState(false)

  const invia = async (e: FormEvent) => {
    e.preventDefault()
    setAspetta(true)
    setErrore(null)
    try {
      // La porta è quella di tutte le aree: l'account di una sala resta qui,
      // quello di una persona va nella sua area (vedi `accedi`).
      await accedi(utente, password)
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
          <form className="stack" style={{ gap: 12 }} onSubmit={(e) => void invia(e)}>
            <span className="tb-sotto" style={{ fontSize: 18, lineHeight: 1.5 }}>
              Si fa una volta sola, con l'account della sala che ha preparato la segreteria. Poi il tablet resta collegato.
              È la stessa porta di tutta l'app: con l'account di un istruttore o della segreteria si va nella propria area.
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
          <span role="alert" style={{ fontSize: 19, fontWeight: 700, color: 'var(--rosso)' }}>
            {errore}
          </span>
        )}
        <button type="button" className="tb-scollega" style={{ alignSelf: 'flex-start' }} onClick={lasciaTablet}>
          ← Non è un tablet di sala: torna all’accesso
        </button>
      </div>
    </div>
  )
}
