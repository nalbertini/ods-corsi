import { useCallback, useEffect, useMemo, useState } from 'react'
import type { HistoryEntry, Mode, Settings, Workout } from './types'
import { DEFAULT_SETTINGS, loadHistory, loadSettings, loadWorkouts, pushHistory, saveSettings, saveWorkouts } from './lib/storage'
import { type Esercizio, loadEsercizi, normalizza, saveEsercizi } from './lib/esercizi'
import { preload, unlockVoice } from './lib/voice'
import { COACH_LINES, EXTRA_LINES } from './lib/engine'
import { INTRO_CLIP, PROSSIMO_CLIP, STATE_CLIP, exerciseKey, extraClip } from './lib/voiceClips'
import { uid } from './lib/format'
import { presetsDi } from './lib/presets'
import { HomeScreen } from './components/HomeScreen'
import { PresetScreen } from './components/PresetScreen'
import { EditorScreen } from './components/EditorScreen'
import { TimerScreen } from './components/TimerScreen'
import { SettingsScreen } from './components/SettingsScreen'
import { VoiceRecorderScreen } from './components/VoiceRecorderScreen'
import { HistoryScreen } from './components/HistoryScreen'
import { EserciziScreen } from './components/EserciziScreen'
import { CondividiScreen } from './components/CondividiScreen'
import { RicevutoScreen } from './components/RicevutoScreen'
import { CountdownTab, CronometroScreen } from './components/AlVolo'
import { pulisciLink, workoutDaLink } from './lib/condivisione'
import { type Interrotto, leggiInterrotto, scordaInterrotto } from './lib/ripresa'
import { Back, Clessidra, Crono, Gear, TimerIcon } from './components/Icons'
import { Logo, Wordmark } from './components/Logo'

type Tab = 'timer' | 'crono' | 'countdown' | 'impostazioni'
type View =
  | { kind: 'tabs' }
  /** `nuovo`: non sta ancora nella libreria, quindi la topbar dice NUOVO
      TIMER e non MODIFICA. Uno schema appena scelto ha già un nome, e sul
      nome soltanto non si distingue da un timer salvato. */
  | { kind: 'editor'; workout: Workout; nuovo?: boolean }
  | { kind: 'run'; workout: Workout; ripresa?: Interrotto }
  | { kind: 'condividi'; workout: Workout }
  | { kind: 'ricevuto'; workout: Workout }
  | { kind: 'voce' }
  | { kind: 'storico' }
  | { kind: 'esercizi' }
  | { kind: 'schema'; mode?: Mode }

const TABS: Array<{ key: Tab; label: string; icon: typeof TimerIcon }> = [
  { key: 'timer', label: 'TIMER', icon: TimerIcon },
  { key: 'crono', label: 'CRONOMETRO', icon: Crono },
  { key: 'countdown', label: 'COUNTDOWN', icon: Clessidra },
  { key: 'impostazioni', label: 'IMPOSTAZIONI', icon: Gear },
]

const TAB_TITLE: Record<Tab, string> = {
  timer: 'I TUOI TIMER',
  crono: 'CRONOMETRO',
  countdown: 'CONTO ALLA ROVESCIA',
  impostazioni: 'IMPOSTAZIONI',
}

/* Le due schede degli attrezzi riempiono l'area, non scorrono: le cifre grandi
   vogliono l'altezza intera, e sotto c'è già la barra delle schede. */
const PIENE: Tab[] = ['crono', 'countdown']

/**
 * ODS Corsi, il calendario e l'appello, è un'app a sé (nalbertini/ods-corsi)
 * che ha il timer sul tablet di sala: questo è il ritorno. Si apre la radice,
 * che su un tablet di sala riapre il tablet della sua sala (e altrove la pagina
 * di scelta). Non `#sala`: quell'indirizzo farebbe diventare un tablet di sala
 * anche il telefono di chi lo tocca.
 */
const SALA = 'https://nalbertini.github.io/ods-corsi/'

/** Il ritorno alla sala, grosso come i tasti del tablet da cui si arriva. */
function TornaSala({ className }: { className: string }) {
  return (
    <a className={`torna-sala ${className}`} href={SALA}>
      <Back size={20} />
      SALA
    </a>
  )
}

export default function App() {
  const [workouts, setWorkouts] = useState<Workout[]>(() => loadWorkouts())
  const [settings, setSettings] = useState<Settings>(() => loadSettings())
  const [history, setHistory] = useState<HistoryEntry[]>(() => loadHistory())
  // Il catalogo sta qui e non nell'editor: la sezione esercizi e la scelta
  // dentro un timer devono vedere la stessa lista, non due copie.
  const [catalogo, setCatalogo] = useState<Esercizio[]>(() => loadEsercizi())
  const [tab, setTab] = useState<Tab>('timer')
  // Letto una volta all'apertura: è la fotografia di com'era quando l'app è morta.
  const [interrotto, setInterrotto] = useState<Interrotto | null>(() => leggiInterrotto())
  const [view, setView] = useState<View>({ kind: 'tabs' })

  // L'audio si sblocca al PRIMO tocco nell'app, non all'avvio del timer.
  // `resume()` è asincrono: chiamarlo quando parte l'allenamento significa che
  // il primo annuncio, che è sincrono, trova il contesto ancora sospeso e va
  // perso. Fra l'apertura di un timer e il tasto avvia ci sono almeno due
  // tocchi, che bastano e avanzano.
  useEffect(() => {
    const sblocca = () => unlockVoice()
    const opzioni = { once: true, passive: true } as const
    window.addEventListener('pointerdown', sblocca, opzioni)
    window.addEventListener('keydown', sblocca, opzioni)
    return () => {
      window.removeEventListener('pointerdown', sblocca)
      window.removeEventListener('keydown', sblocca)
    }
  }, [])

  // Un allenamento può arrivare dentro l'indirizzo, da un QR inquadrato sul
  // tablet della sala o da un link su WhatsApp. Si mostra subito, e
  // l'indirizzo si ripulisce: un ricarica non deve riproporlo all'infinito.
  useEffect(() => {
    const guarda = () => {
      void workoutDaLink().then((w) => {
        if (!w) return
        pulisciLink()
        setView({ kind: 'ricevuto', workout: w })
      })
    }
    guarda()
    // Un link aperto mentre l'app è già in primo piano non ricarica niente: il
    // browser cambia solo il frammento. Senza ascoltarlo, il timer mandato su
    // WhatsApp non arriverebbe mai a chi ha già l'app aperta.
    window.addEventListener('hashchange', guarda)
    return () => window.removeEventListener('hashchange', guarda)
  }, [])

  // Le clip si scaldano all'apertura dell'app, non all'apertura del timer.
  // Un annuncio non aspetta la rete: se la clip non è pronta parla la sintesi,
  // quindi il tempo utile è quello che passa mentre si sceglie l'allenamento,
  // non il mezzo secondo fra «apri» e «avvia».
  useEffect(() => {
    preload([
      INTRO_CLIP,
      PROSSIMO_CLIP,
      ...Object.values(STATE_CLIP),
      ...COACH_LINES.map((_, i) => `maurizio/${i + 1}`),
      ...EXTRA_LINES.map((_, i) => extraClip(i)),
    ])
  }, [])

  // I nomi degli esercizi dipendono dai timer salvati, quindi si scaldano a parte.
  useEffect(() => {
    preload(workouts.flatMap((w) => w.exercises.map((e) => exerciseKey(e.name))))
  }, [workouts])

  useEffect(() => saveWorkouts(workouts), [workouts])
  useEffect(() => saveSettings(settings), [settings])
  useEffect(() => saveEsercizi(catalogo), [catalogo])

  const patchSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((s) => ({ ...DEFAULT_SETTINGS, ...s, ...patch }))
  }, [])

  const upsert = useCallback((w: Workout) => {
    setWorkouts((list) => {
      const i = list.findIndex((x) => x.id === w.id)
      if (i === -1) return [w, ...list]
      const copy = [...list]
      copy[i] = w
      return copy
    })
  }, [])

  const recordFinish = useCallback(
    (workout: Workout) => (seconds: number, completed: boolean) => {
      const entry: HistoryEntry = {
        id: uid(),
        workoutId: workout.id,
        workoutName: workout.name,
        finishedAt: Date.now(),
        seconds: Math.round(seconds),
        completed,
      }
      setHistory(pushHistory(entry))
    },
    [],
  )

  // Quante volte ogni nome compare nei timer salvati: serve alla sezione
  // esercizi per dire cosa è in uso prima di toccarlo.
  const usiEsercizi = useMemo(() => {
    const conto: Record<string, number> = {}
    workouts.forEach((w) =>
      w.exercises.forEach((e) => {
        const k = normalizza(e.name)
        if (k) conto[k] = (conto[k] ?? 0) + 1
      }),
    )
    return conto
  }, [workouts])

  // Rinominare un esercizio nel catalogo lo rinomina anche nei timer che lo
  // usano: per la palestra è la stessa cosa, non due nomi che si somigliano.
  const rinominaEsercizio = useCallback((da: string, a: string) => {
    // Il confronto è quello della ricerca, non quello esatto: se in un timer il
    // nome è stato scritto con un'altra maiuscola o un altro accento, il conto
    // qui sopra lo considera lo stesso esercizio e la rinomina deve seguirlo.
    const stesso = (nome: string) => normalizza(nome) === normalizza(da)
    setWorkouts((list) =>
      list.map((w) =>
        w.exercises.some((e) => stesso(e.name))
          ? { ...w, exercises: w.exercises.map((e) => (stesso(e.name) ? { ...e, name: a } : e)) }
          : w,
      ),
    )
  }, [])

  const startWorkout = useCallback((w: Workout) => {
    // Partendo con qualcos'altro, l'allenamento lasciato a metà è acqua passata.
    scordaInterrotto()
    setInterrotto(null)
    setView({ kind: 'run', workout: w })
  }, [])

  const duplicate = useCallback(
    (w: Workout) => {
      const copy: Workout = { ...w, id: uid(), name: `${w.name} (copia)`, builtin: false, updatedAt: Date.now() }
      upsert(copy)
      setView({ kind: 'editor', workout: copy })
    },
    [upsert],
  )

  const remove = useCallback((w: Workout) => {
    if (!window.confirm(`Eliminare “${w.name}”?`)) return
    setWorkouts((list) => list.filter((x) => x.id !== w.id))
  }, [])

  const body = useMemo(() => {
    switch (tab) {
      case 'timer':
        return (
          <HomeScreen
            workouts={workouts}
            onStart={startWorkout}
            onEdit={(w) => setView({ kind: 'editor', workout: w })}
            onDuplicate={duplicate}
            onDelete={remove}
            onShare={(w) => setView({ kind: 'condividi', workout: w })}
            interrotto={interrotto}
            onRiprendi={() => {
              if (!interrotto) return
              setView({ kind: 'run', workout: interrotto.workout, ripresa: interrotto })
              setInterrotto(null)
            }}
            onScarta={() => {
              scordaInterrotto()
              setInterrotto(null)
            }}
            onNew={(filtro) => {
              // Il filtro della libreria è già una scelta di tipo: se ne resta
              // un solo schema l'editor si apre diretto, invece di far
              // ripassare da una schermata con una sola carta da toccare.
              const schemi = filtro === 'all' ? [] : presetsDi(filtro)
              if (schemi.length === 1) setView({ kind: 'editor', workout: schemi[0].make(), nuovo: true })
              else setView({ kind: 'schema', mode: filtro === 'all' ? undefined : filtro })
            }}
          />
        )
      case 'crono':
      case 'countdown':
        // Restano montati sempre, più sotto: qui non ci arriva mai.
        return null
      case 'impostazioni':
        return (
          <SettingsScreen
            settings={settings}
            onChange={patchSettings}
            historyCount={history.length}
            onOpenRecorder={() => setView({ kind: 'voce' })}
            onOpenStorico={() => setView({ kind: 'storico' })}
            onOpenEsercizi={() => setView({ kind: 'esercizi' })}
          />
        )
    }
  }, [
    tab,
    workouts,
    history,
    settings,
    interrotto,
    catalogo,
    usiEsercizi,
    rinominaEsercizio,
    startWorkout,
    duplicate,
    remove,
    patchSettings,
  ])

  if (view.kind === 'run') {
    return (
      <TimerScreen
        workout={view.workout}
        settings={settings}
        ripresa={view.ripresa}
        onExit={() => setView({ kind: 'tabs' })}
        onFinish={recordFinish(view.workout)}
      />
    )
  }

  if (view.kind === 'storico') {
    return (
      <div className="app">
        <div className="topbar">
          <button className="icon-btn" onClick={() => setView({ kind: 'tabs' })} aria-label="Indietro">
            <Back />
          </button>
          <span className="ob grow" style={{ fontSize: 22, fontWeight: 700, letterSpacing: '0.1em' }}>
            STORICO
          </span>
        </div>
        <div className="scroll">
          <HistoryScreen entries={history} />
        </div>
      </div>
    )
  }

  if (view.kind === 'condividi') {
    return <CondividiScreen workout={view.workout} onBack={() => setView({ kind: 'tabs' })} />
  }

  if (view.kind === 'ricevuto') {
    const ricevuto = view.workout
    return (
      <RicevutoScreen
        workout={ricevuto}
        onSalva={() => {
          upsert(ricevuto)
          setTab('timer')
          setView({ kind: 'tabs' })
        }}
        onAvvia={() => setView({ kind: 'run', workout: ricevuto })}
        onChiudi={() => setView({ kind: 'tabs' })}
      />
    )
  }

  if (view.kind === 'schema') {
    return (
      <div className="app">
        <div className="topbar">
          <button className="icon-btn" onClick={() => setView({ kind: 'tabs' })} aria-label="Indietro">
            <Back />
          </button>
          <span className="ob grow" style={{ fontSize: 22, fontWeight: 700, letterSpacing: '0.1em' }}>
            NUOVO TIMER
          </span>
        </div>
        <div className="scroll">
          <PresetScreen mode={view.mode} onPick={(w) => setView({ kind: 'editor', workout: w, nuovo: true })} />
        </div>
      </div>
    )
  }

  if (view.kind === 'esercizi') {
    return (
      <div className="app">
        <div className="topbar">
          <button className="icon-btn" onClick={() => setView({ kind: 'tabs' })} aria-label="Indietro">
            <Back />
          </button>
          <span className="ob grow" style={{ fontSize: 22, fontWeight: 700, letterSpacing: '0.1em' }}>
            ESERCIZI
          </span>
        </div>
        <div className="scroll">
          <EserciziScreen
            catalogo={catalogo}
            onCatalogo={setCatalogo}
            usi={usiEsercizi}
            onRinomina={rinominaEsercizio}
          />
        </div>
      </div>
    )
  }

  if (view.kind === 'voce') {
    return <VoiceRecorderScreen workouts={workouts} catalogo={catalogo} onBack={() => setView({ kind: 'tabs' })} />
  }

  if (view.kind === 'editor') {
    return (
      <EditorScreen
        initial={view.workout}
        nuovo={view.nuovo}
        catalogo={catalogo}
        onCatalogo={setCatalogo}
        onCancel={() => setView({ kind: 'tabs' })}
        onSave={(w) => {
          upsert(w)
          setTab('timer')
          setView({ kind: 'tabs' })
        }}
        onSaveAndStart={(w) => {
          upsert(w)
          setView({ kind: 'run', workout: w })
        }}
      />
    )
  }

  return (
    <div className="shell">
      <nav className="sidebar">
        <div className="stack" style={{ gap: 10, padding: '0 22px 26px' }}>
          <Logo width={104} />
          <Wordmark />
        </div>
        <div className="stack" style={{ gap: 2, padding: '0 12px' }}>
          {TABS.map((t) => (
            <button key={t.key} className="navitem" data-on={tab === t.key} onClick={() => setTab(t.key)}>
              <i />
              {t.label}
            </button>
          ))}
        </div>
        <div className="grow" />
        <div className="stack" style={{ padding: '0 12px' }}>
          <TornaSala className="" />
        </div>
      </nav>

      <div className="app content">
        {/* Cronometro e conto alla rovescia si prendono lo schermo dall'alto:
            hanno già una loro riga di intestazione, e soprattutto riservavano
            una seconda volta lo spazio della barra di stato che questa
            intestazione aveva già preso — sessantun pixel di nulla su un
            telefono, e la cornice colorata che cominciava a metà. Senza, la
            cornice inquadra tutto lo schermo, che è il motivo per cui c'è. */}
        {!PIENE.includes(tab) && (
          <header className="topbar">
            <div style={{ display: 'contents' }} className="only-mobile">
              <Logo width={58} />
              <Wordmark />
            </div>
            <div className="grow" />
            <span className="ob page-title" style={{ fontSize: 20, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--dim)' }}>
              {TAB_TITLE[tab]}
            </span>
            <TornaSala className="torna-sala-alto" />
          </header>
        )}

        {/* Cronometro e conto alla rovescia restano montati anche quando si
            guarda un'altra scheda, nascosti e non smontati: un conto avviato e
            poi lasciato per controllare un timer deve continuare a contare, e
            suonare quando scade anche se in quel momento sei altrove. */}
        <div className="pieno" hidden={tab !== 'crono'}>
          <CronometroScreen settings={settings} />
        </div>
        <div className="pieno" hidden={tab !== 'countdown'}>
          <CountdownTab settings={settings} />
        </div>
        {!PIENE.includes(tab) && <div className="scroll">{body}</div>}

        <nav className="tabbar">
          {TABS.map((t) => {
            const Icon = t.icon
            return (
              <button key={t.key} className="tab" data-on={tab === t.key} onClick={() => setTab(t.key)}>
                <Icon />
                {t.label}
              </button>
            )
          })}
          {/* Su un telefono in alto non c'è posto accanto al marchio: il ritorno
              sta qui. Da tablet c'è il tasto grosso in alto, se in alto c'è
              la testata; nelle schede a tutto schermo resta questo. */}
          <a className={PIENE.includes(tab) ? 'tab' : 'tab tab-sala'} href={SALA}>
            <Back size={22} />
            SALA
          </a>
        </nav>
      </div>
    </div>
  )
}
