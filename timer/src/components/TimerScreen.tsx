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
import { DentroAnello, Digits, Ring } from './Quadrante'
import { Close, Next, Pause, Play, Prev } from './Icons'

const STATE_COLOR = {
  prepare: 'var(--prepare)',
  work: 'var(--work)',
  rest: 'var(--rest)',
  setRest: 'var(--setRest)',
  cooldown: 'var(--cooldown)',
} as const

/** Anello a ingranaggio: il tratteggio richiama i denti del marchio. */


export function TimerScreen({
  workout,
  settings,
  ripresa,
  onExit,
  onFinish,
}: {
  workout: Workout
  settings: Settings
  /** Un allenamento interrotto da riprendere dal punto in cui era rimasto. */
  ripresa?: Interrotto | null
  onExit: () => void
  onFinish: (seconds: number, completed: boolean) => void
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

  // La barra spaziatrice mette in pausa: comoda sul tablet con tastiera e su desktop.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
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

  const rounds = seg?.rounds ?? workout.rounds
  const roundDots = Array.from({ length: Math.min(rounds, 16) }, (_, i) => i + 1)

  return (
    <div className="timer" data-grande={settings.bigScreen} style={{ ['--state' as string]: tinta }}>
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

      {rounds > 1 && (
        <div className="dots timer-dots">
          {roundDots.map((r) => {
            const cur = seg?.round ?? 0
            return (
              <span
                key={r}
                style={{
                  background: r === cur ? color : r < cur ? 'var(--tratteggio)' : 'transparent',
                  borderColor: r === cur ? color : 'var(--line)',
                }}
              />
            )
          })}
        </div>
      )}

      <div className="timer-main">
        {statoFermo.src && !done && !beccato && view.status !== 'idle' && (
          <img className="adesivo-stato" src={statoFermo.src} alt="" />
        )}
        {done ? (
          <>
            {settings.coach !== 'off' && <img className="adesivo-finale" src={finale} alt="" />}
            <span className="state-label">COMPLETATO</span>
            <Digits value={clock(view.total)} />
            <span className="exercise">{workout.name}</span>
          </>
        ) : (
          <>
            {/* Quando Maurizio si tradisce prende il posto dell'anello, non quello
                di tutto lo schermo: le cifre e il nome dell'esercizio devono
                restare leggibili anche mentre fa la scenetta. */}
            {beccato ? (
              <div className="beccato">
                <img src={beccato.src} alt="" />
                <span className="beccato-frase">{beccato.frase}</span>
              </div>
            ) : (
            <div className="anello">
              <Ring progress={view.progress} color={color} />
              {/* Le tre scritte si misurano sull'anello e non su un numero
                  fisso: quando l'anello si stringe — schermo grande sul
                  telefono, schermi piccoli — un «1/8» da 46 px gli usciva
                  fuori e «RESTA» andava a capo sopra i trattini. */}
              <DentroAnello
                etichetta="GIRO"
                numero={seg ? `${seg.round || 1}/${seg.rounds}` : '—'}
                sotto={`RESTA ${clock(view.remainingTotal)}`}
                colore={color}
              />
            </div>
            )}

            <div className="timer-col" style={{ alignItems: 'center', gap: 4 }}>
              <span className="state-label">{idle ? 'PRONTO' : (seg?.label ?? '')}</span>
              <Digits value={clock(idle ? (segments[0]?.duration ?? 0) : view.display)} />
              <span className="exercise">{idle ? workout.name : (seg?.name ?? '')}</span>
              {!idle && seg?.nota && <span className="obiettivo">{seg.nota}</span>}
            </div>
          </>
        )}
      </div>

      <div style={{ height: 10, background: 'var(--surface-2)' }}>
        <div style={{ height: '100%', width: `${done ? 100 : view.progress * 100}%`, background: tinta }} />
      </div>

      {/* Il «+30″» sta accanto alla riga del prossimo intervallo e non fra i
          comandi: quelli si premono al volo, questo lo preme l'istruttore
          guardando la sala. In modalità schermo grande la riga del prossimo
          non si costruisce — prima si nascondeva col CSS, e il tasto restava
          un rettangolino spaesato accanto a un vuoto — così il «+30″» si
          prende tutta la riga, che è dove serve di più. */}
      <div className="row timer-azioni">
        <button
          className="btn-piu"
          onClick={() => allunga(30)}
          disabled={idle || done}
          aria-label="Aggiungi trenta secondi a questo intervallo"
        >
          +30&Prime;
        </button>
        {view.next && view.next.extra === undefined && !done && !settings.bigScreen && (
        <div className="row card timer-prossimo">
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.22em', color: 'var(--dim)' }}>PROSSIMO</span>
          <div className="grow" style={{ minWidth: 8 }} />
          <div style={{ width: 12, height: 12, flexShrink: 0, background: STATE_COLOR[view.next.kind] }} />
          <span
            className="num"
            style={{
              fontSize: 19,
              fontWeight: 600,
              color: 'var(--tasto)',
              minWidth: 0,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {view.next.kind === 'work' && view.next.name ? view.next.name : view.next.label} {view.next.duration}
            &quot;
          </span>
          </div>
        )}
      </div>

      <div className="row timer-controlli">
        <button className="icon-btn tasto-salto" onClick={() => skip(-1)} aria-label="Intervallo precedente">
          <Prev size={24} />
        </button>
        <button
          className="btn grow tasto-avvia"
          style={{ background: tinta, color: 'var(--su-colore)' }}
          onClick={done ? exit : startOrToggle}
        >
          {view.status === 'running' ? <Pause size={22} /> : <Play size={22} />}
          <span style={{ fontSize: 22 }}>
            {done ? 'CHIUDI' : view.status === 'running' ? 'PAUSA' : idle ? 'AVVIA' : 'RIPRENDI'}
          </span>
        </button>
        <button className="icon-btn tasto-salto" onClick={() => skip(1)} aria-label="Intervallo successivo">
          <Next size={24} />
        </button>
      </div>
    </div>
  )
}
