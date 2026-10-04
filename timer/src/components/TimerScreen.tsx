import { useEffect, useRef, useState } from 'react'
import type { Segment, Settings, Workout } from '../types'
import { applyCoach, buildSegments, describe } from '../lib/engine'
import { BECCATO, FINALE, a_caso, perStato } from '../lib/adesivi'
import { clock } from '../lib/format'
import { useTimer } from '../lib/useTimer'
import { segnalaTimerAperto } from '../lib/aggiornamento'
import { type Interrotto, salvaInterrotto, scordaInterrotto } from '../lib/ripresa'
import { useWakeLock } from '../lib/wakeLock'
import { apriSessione, chiudiSessione } from '../lib/mediaSession'
import { coloreFondo } from '../lib/tema'
import { giroCorrente, lineaDelTempo, oraDiFine, righeDaMostrare, righeScaletta } from '../lib/scaletta'
import { useMedia } from '../lib/useMedia'
import { Digits, STATE_COLOR } from './Quadrante'
import { LineaDelTempo } from './LineaDelTempo'
import { PostoMaurizio } from './PostoMaurizio'
import { Scaletta } from './Scaletta'
import { Close, Next, Pause, Play, Prev } from './Icons'
import { MusicaBar } from './MusicaBar'
import { useMusica, useMusicaAlTimer } from '../lib/useMusica'
import type { StatoTimer } from '../lib/incorporato'

export function TimerScreen({
  workout,
  settings,
  ripresa,
  partiSubito = false,
  onExit,
  onFinish,
  onStato,
  tastiera = true,
  conMusica = true,
}: {
  workout: Workout
  settings: Settings
  /** Un allenamento interrotto da riprendere dal punto in cui era rimasto. */
  ripresa?: Interrotto | null
  /** Parte appena aperto: dal tasto AVVIA della lezione, sul tablet di sala. */
  partiSubito?: boolean
  onExit: () => void
  onFinish: (seconds: number, completed: boolean) => void
  /** Sul tablet di sala: lo stato dell'allenamento, per la testata. */
  onStato?: (s: StatoTimer | null) => void
  /** Falso quando il timer c'è ma non si vede: la tastiera comanda altro. */
  tastiera?: boolean
  /** Falso sul tablet di sala, dove la musica sta nella barra in basso. */
  conMusica?: boolean
}) {
  // I secondi regalati da Maurizio si estraggono a ogni avvio: due giri dello
  // stesso allenamento non cadono negli stessi punti. Riprendendo un
  // allenamento interrotto si riusano invece i segmenti salvati, perché quelle
  // durate erano già state estratte e lo stesso secondo, in una lista nuova,
  // cadrebbe in un punto diverso.
  const [run, setRun] = useState(0)
  const [segments, setSegments] = useState<Segment[]>(
    () => ripresa?.segments ?? applyCoach(buildSegments(workout), settings.coach),
  )
  const primoGiro = useRef(true)
  useEffect(() => {
    if (primoGiro.current) {
      primoGiro.current = false
      return
    }
    setSegments(applyCoach(buildSegments(workout), settings.coach))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workout, settings.coach, run])
  // L'illustrazione che compare quando Maurizio si tradisce, e quella finale.
  const [beccato, setBeccato] = useState<{ src: string; frase: string } | null>(null)
  const [finale] = useState(() => a_caso(FINALE))
  const timeoutBeccato = useRef<number | undefined>(undefined)

  const { view, toggle, stop, skip, riprendiDa } = useTimer(segments, settings, onFinish, (frase) => {
    if (settings.coach === 'off') return
    setBeccato({ src: a_caso(BECCATO), frase })
    window.clearTimeout(timeoutBeccato.current)
    timeoutBeccato.current = window.setTimeout(() => setBeccato(null), 3200)
  })
  useEffect(() => () => window.clearTimeout(timeoutBeccato.current), [])

  // Finché questa schermata è aperta l'app non si ricarica da sola per un
  // aggiornamento: un allenamento a metà vale più di una versione nuova subito.
  useEffect(() => {
    segnalaTimerAperto(true)
    return () => segnalaTimerAperto(false)
  }, [])

  // La ripresa si fa una volta sola, all'apertura della schermata.
  const ripreso = useRef(false)
  useEffect(() => {
    if (ripreso.current || !ripresa) return
    ripreso.current = true
    riprendiDa(ripresa.elapsed)
  }, [ripresa, riprendiDa])

  // Dal tablet si è già detto AVVIA sulla lezione: non serve un secondo tocco.
  const partito = useRef(false)
  useEffect(() => {
    if (!partiSubito || partito.current || ripresa) return
    partito.current = true
    toggle()
    // Una volta sola, all'apertura.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Dove si è arrivati, segnato ogni due secondi: se l'app muore qui in mezzo,
  // alla riapertura si può riprendere invece di ricominciare da capo.
  const vistaRef = useRef(view)
  vistaRef.current = view
  useEffect(() => {
    if (view.status !== 'running') return
    const id = window.setInterval(() => {
      const v = vistaRef.current
      salvaInterrotto({ workout, segments, elapsed: v.elapsed, quando: Date.now() })
    }, 2000)
    return () => window.clearInterval(id)
  }, [view.status, workout, segments])

  // Finito davvero: non c'è più niente da riprendere.
  useEffect(() => {
    if (view.status === 'done') scordaInterrotto()
  }, [view.status])

  /**
   * Trenta secondi in più sull'intervallo in corso.
   *
   * La lezione non va mai come è scritta: il gruppo è cotto, una postazione è
   * occupata, arrivano due in ritardo. Si allunga il segmento corrente e si
   * spostano in avanti quelli dopo, così barra e durata totale restano
   * coerenti. Se Maurizio aveva già scritto il conto per questo intervallo lo
   * si butta: da qui in poi conta onesto, e il numero che salta su di trenta è
   * esattamente ciò che è appena successo.
   */
  const allunga = (secondi: number) => {
    const i = view.index
    if (i < 0 || view.status === 'idle' || view.status === 'done') return
    setSegments((prec) =>
      prec.map((s, k) => {
        if (k < i) return s
        if (k === i) return { ...s, duration: s.duration + secondi, display: undefined }
        return { ...s, offset: s.offset + secondi }
      }),
    )
  }

  const seg = view.segment

  // Estratta una volta per segmento: cambiarla a ogni render la farebbe
  // lampeggiare, e durante il lavoro non ce n'è, di proposito.
  const chiaveSegmento = seg ? `${seg.kind}-${seg.offset}` : ''
  const [statoFermo, setStatoFermo] = useState<{ chiave: string; src: string | null }>({ chiave: '', src: null })
  useEffect(() => {
    setStatoFermo((prec) => (prec.chiave === chiaveSegmento ? prec : { chiave: chiaveSegmento, src: perStato(seg?.kind) }))
  }, [chiaveSegmento, seg?.kind])

  const startOrToggle = () => {
    if (view.status === 'idle' || view.status === 'done') setRun((n) => n + 1)
    toggle()
  }

  useWakeLock(settings.keepAwake && view.status === 'running')

  // Con Spotify collegato o un link di YouTube la musica può andare dietro al
  // timer: vedi le impostazioni.
  const musica = useMusica(settings)
  useMusicaAlTimer(view.status, view.segment?.kind, settings, musica)

  /* I comandi sulla schermata di blocco, finché l'allenamento è aperto: stato,
     nome, avanzamento e i tasti per mettere in pausa o saltare un intervallo
     senza sbloccare il telefono. Si rilascia all'uscita, così il lettore
     musicale si riprende il suo posto. Aggiornato a ogni cambio di stato e di
     segmento, non a ogni secondo: sulla schermata di blocco il tempo lo fa
     scorrere il sistema, a partire dalla posizione che gli diamo. */
  const acceso = view.status === 'running' || view.status === 'paused'
  const etichettaSeg = view.segment?.label ?? ''
  useEffect(() => {
    if (!acceso) {
      chiudiSessione()
      return
    }
    apriSessione(
      {
        titolo: `${etichettaSeg || workout.name}`,
        sottotitolo: workout.name,
        inCorso: view.status === 'running',
        durata: view.total,
        posizione: view.elapsed,
      },
      {
        avvia: toggle,
        pausa: toggle,
        avanti: () => skip(1),
        indietro: () => skip(-1),
        ferma: stop,
      },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acceso, view.status, etichettaSeg, view.index, workout.name])

  useEffect(() => () => chiudiSessione(), [])

  // Il tablet di sala mostra l'allenamento in corso anche quando si guardano
  // le presenze: il colore dell'intervallo, i secondi, il giro.
  const statoRef = useRef(onStato)
  statoRef.current = onStato
  const conto = view.segment && view.segment.rounds > 1 ? `GIRO ${view.segment.round || 1}/${view.segment.rounds}` : ''
  useEffect(() => {
    statoRef.current?.({
      nome: workout.name,
      status: view.status,
      kind: view.segment?.kind ?? null,
      etichetta: view.segment?.label ?? '',
      secondi: view.display,
      conto,
    })
  }, [workout.name, view.status, view.segment?.kind, view.segment?.label, view.display, conto])
  useEffect(() => () => statoRef.current?.(null), [])

  // La barra e la tacca del browser prendono il colore dello stato.
  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]')
    const kind = seg?.kind
    const map: Record<string, string> = {
      prepare: '#f4c31b',
      work: '#e4292a',
      rest: '#16a54a',
      setRest: '#1b8ac4',
      cooldown: '#1b8ac4',
    }
    meta?.setAttribute('content', view.status === 'running' && kind ? map[kind] : coloreFondo())
    return () => meta?.setAttribute('content', coloreFondo())
  }, [seg?.kind, view.status])

  // Uscire a metà non butta via il lavoro fatto: stop() lo registra come interrotto.
  const exit = () => {
    stop()
    scordaInterrotto()
    onExit()
  }
  // La scorciatoia da tastiera deve chiamare sempre l'ultima versione di exit,
  // senza per questo riagganciare il listener a ogni render.
  const exitRef = useRef(exit)
  exitRef.current = exit
  const startOrToggleRef = useRef(startOrToggle)
  startOrToggleRef.current = startOrToggle
  const tastieraRef = useRef(tastiera)
  tastieraRef.current = tastiera

  // La barra spaziatrice mette in pausa: comoda sul tablet con tastiera e su desktop.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!tastieraRef.current) return
      if (e.code === 'Space') {
        e.preventDefault()
        startOrToggleRef.current()
      } else if (e.code === 'ArrowRight') skip(1)
      else if (e.code === 'ArrowLeft') skip(-1)
      else if (e.code === 'Escape') exitRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [skip])

  const idle = view.status === 'idle'
  const done = view.status === 'done'
  const color = seg ? STATE_COLOR[seg.kind] : 'var(--line)'
  // A fine allenamento comanda il verde: bordo, barra e pulsante devono dire
  // la stessa cosa, non restare sul colore dell'ultimo intervallo.
  const tinta = done ? 'var(--verde)' : color
  // Sul rosso del lavoro il testo è bianco, sugli altri colori scuro.
  const suTinta = tinta === STATE_COLOR.work ? 'var(--su-rosso)' : 'var(--su-colore)'

  const rounds = seg?.rounds ?? workout.rounds
  const sticker = statoFermo.src && !done && view.status !== 'idle' ? statoFermo.src : null
  // Quante righe di scaletta entrano: più dove l'altezza avanza, nessuna dove
  // non basta (un telefono girato di lato, o uno schermo basso in verticale).
  const verticale = useMedia('(orientation: portrait)')
  const poco = useMedia('(max-height: 599px), (orientation: portrait) and (max-height: 699px)')
  const alto = useMedia('(min-height: 800px)')
  const nRighe = righeDaMostrare({ verticale, poco, alto })
  // A fine allenamento `view.index` resta sull'ultimo passo: la scaletta si
  // vuota passando una lista vuota, la linea si riempie tutta passando un
  // indice oltre la fine (due casi provati in prova-scaletta).
  const scaletta = righeScaletta(done ? [] : segments, view.index, nRighe)
  const linea = lineaDelTempo(segments, done ? segments.length : view.index, view.progress)

  return (
    <div className="timer" data-grande={settings.bigScreen} style={{ ['--state' as string]: tinta, ['--state-testo' as string]: tinta === STATE_COLOR.prepare ? 'var(--giallo-testo)' : tinta }}>
      <div className="row timer-top">
        <button className="icon-btn" onClick={exit} aria-label="Chiudi il timer">
          <Close />
        </button>
        <div className="stack grow" style={{ gap: 1, minWidth: 0 }}>
          <span className="ob titolo-timer">{workout.name.toUpperCase()}</span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.18em',
              color: 'var(--dim)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {seg && seg.sets > 1 ? `SERIE ${seg.set} / ${seg.sets}` : describe(workout).toUpperCase()}
          </span>
        </div>
        {settings.coach !== 'off' && (
          <span
            className="badge"
            style={{ background: 'var(--giallo)', alignSelf: 'center', fontSize: 11, letterSpacing: '0.12em', padding: '5px 9px' }}
            title="Maurizio ogni tanto perde il conto"
          >
            MAURIZIO
          </span>
        )}
        <button
          className="icon-btn testo"
          onClick={() => {
            stop()
            scordaInterrotto()
          }}
          aria-label="Azzera il timer"
        >
          <span className="cond" style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.1em' }}>
            RESET
          </span>
        </button>
      </div>

      <div className="tf-corpo">
        <div className="tf-sinistra">
          {done ? (
            <>
              {settings.coach !== 'off' && <img className="adesivo-finale" src={finale} alt="" />}
              <span className="tf-stato">COMPLETATO</span>
              <Digits value={clock(view.total)} className="tf-cifre" />
              <span className="tf-esercizio">{workout.name}</span>
            </>
          ) : (
            <>
              <span className="tf-stato">{idle ? 'PRONTO' : (seg?.label ?? '')}</span>
              <Digits value={clock(idle ? (segments[0]?.duration ?? 0) : view.display)} className="tf-cifre" />
              <span className="tf-esercizio">{idle ? workout.name : (seg?.name ?? '')}</span>
              {!idle && seg?.nota && <span className="tf-obiettivo">{seg.nota}</span>}
            </>
          )}

          <PostoMaurizio className="tf-maurizio-l" stato={sticker} beccato={beccato} />

          {/* Il gesto che si fa più spesso è il più grande; gli altri hanno la
              parola scritta, perché un'icona sola non dice «indietro» a chi
              guarda da lontano. Il «+30″» lo preme l'istruttore guardando la
              sala: ha il bordo del colore dello stato quando si può usare. */}
          <div className="tf-comandi">
            <button
              className="tf-avvia"
              style={{ background: tinta, color: suTinta }}
              onClick={done ? exit : startOrToggle}
            >
              {view.status === 'running' ? <Pause size={26} /> : <Play size={26} />}
              <span>{done ? 'CHIUDI' : view.status === 'running' ? 'PAUSA' : idle ? 'AVVIA' : 'RIPRENDI'}</span>
            </button>
            {!done && (
              <div className="tf-secondari">
                <button className="tf-secondario" onClick={() => skip(-1)}>
                  <Prev size={18} />
                  INDIETRO
                </button>
                <button
                  className="tf-secondario tf-piu"
                  onClick={() => allunga(30)}
                  disabled={idle}
                  aria-label="Aggiungi trenta secondi a questo intervallo"
                >
                  +30&Prime;
                </button>
                <button className="tf-secondario" onClick={() => skip(1)}>
                  AVANTI
                  <Next size={18} />
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="tf-destra">
          {!done && (
            <div className="tf-resta">
              <span className="tf-etichetta">RESTA</span>
              <span className="tf-resta-tempo">{clock(view.remainingTotal)}</span>
              <span className="tf-etichetta">FINE ALLE {oraDiFine(Date.now(), view.remainingTotal)}</span>
            </div>
          )}
          <Scaletta righe={scaletta.righe} altri={scaletta.altri} altriSecondi={scaletta.altriSecondi} />
          <PostoMaurizio className="tf-maurizio-p" stato={sticker} beccato={beccato} />
          {conMusica && <MusicaBar musica={musica} className="tf-musica" />}
        </div>

        {/* La barra fa da avanzamento dell'intero allenamento: sostituisce
            anello e tacche dei giri, e dice dove si è su tutto il programma. */}
        <div className="tf-barra">
          <div className="tf-barra-testa">
            {rounds > 1 && !done ? (
              <span>
                GIRO <b>{giroCorrente(seg)}</b>
              </span>
            ) : (
              <span />
            )}
            {!done && (
              <span className="tf-barra-resta">
                RESTA <b>{clock(view.remainingTotal)}</b>
              </span>
            )}
          </div>
          <LineaDelTempo blocchi={linea} />
        </div>
      </div>
    </div>
  )
}
