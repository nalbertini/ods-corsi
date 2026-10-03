import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { HistoryEntry, Mode, Settings, Workout } from './types'
import { DEFAULT_SETTINGS, loadHistory, loadSettings, loadWorkouts, pushHistory, saveSettings, saveWorkouts } from './lib/storage'
import { type Esercizio, loadEsercizi, normalizza, saveEsercizi } from './lib/esercizi'
import { type FonteClip, preload, unlockVoice, usaClipDellaSala } from './lib/voice'
import { voceDiNome } from './lib/audio'
import { fonteClipSupabase } from './lib/clipSala'
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
import { completaAccesso } from './lib/spotify'
import { VERSIONE } from './lib/aggiornamento'
import { useMusica } from './lib/useMusica'
import { MusicaBar } from './components/MusicaBar'
import { PlayerYoutube } from './components/PlayerYoutube'
import { PalestraSezione } from './components/PalestraSezione'
import { type Accesso, accessoRicordato, chiSei, db, eUnId, haUnServer, nuovoId, sessione } from './lib/palestra'
import {
  type Corso,
  eliminaDalServer,
  guardaCoda,
  preferenzeDi,
  registraAllenamento,
  salvaPreferenze,
  salvaSulServer,
  scaricaLibreria,
  scaricaTimerSala,
  scaricaPreferenze,
  soloDelDispositivo,
  unisci,
  versoIlServer,
} from './lib/libreria'
import { type Lezione, lezioneDaIndirizzo } from './lib/lezione'
import { type Gruppo, gruppiDi } from './lib/gruppi'
import type { Incorporato, TimerPronto } from './lib/incorporato'
import { CHIAVI_SALA, type ImpostazioniSala, type TimerSala, salvaTimerSala, toccaLaSala } from './lib/impostazioniSala'

/** I corsi dell'ultima volta, per il titolo della lezione e l'editor senza rete. */
const DOVE_CORSI = 'ods-timer:corsi'
function corsiRicordati(): Corso[] {
  try {
    const c = JSON.parse(localStorage.getItem(DOVE_CORSI) ?? '[]') as unknown
    return Array.isArray(c) ? (c as Corso[]) : []
  } catch {
    return []
  }
}

type Tab = 'timer' | 'crono' | 'countdown' | 'impostazioni'
type View =
  | { kind: 'tabs' }
  /** `nuovo`: non sta ancora nella libreria, quindi la topbar dice NUOVO
      TIMER e non MODIFICA. Uno schema appena scelto ha già un nome, e sul
      nome soltanto non si distingue da un timer salvato. */
  | { kind: 'editor'; workout: Workout; nuovo?: boolean }
  | { kind: 'run'; workout: Workout; ripresa?: Interrotto; subito?: boolean }
  | { kind: 'condividi'; workout: Workout }
  | { kind: 'ricevuto'; workout: Workout }
  | { kind: 'voce' }
  | { kind: 'storico' }
  | { kind: 'esercizi' }
  | { kind: 'schema'; mode?: Mode }

const TABS: Array<{ key: Tab; label: string; icon: typeof TimerIcon }> = [
  { key: 'timer', label: 'TIMER', icon: TimerIcon },
  { key: 'crono', label: 'CRONOMETRO', icon: Crono },
  { key: 'countdown', label: 'ALLA ROVESCIA', icon: Clessidra },
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
 * ODS Corsi, il calendario e l'appello, è l'app che contiene questa: il timer
 * è pubblicato nella sua sottocartella `timer/`, e ha il tasto sul tablet di
 * sala. Questo è il ritorno, relativo come tutto il resto. Si apre la radice,
 * che su un tablet di sala riapre il tablet della sua sala (e altrove la pagina
 * di scelta). Non `#sala`: quell'indirizzo farebbe diventare un tablet di sala
 * anche il telefono di chi lo tocca.
 */
const SALA = '../'

/**
 * Il ritorno c'è solo su un tablet di sala, che ODS Corsi si ricorda in
 * `ods-corsi:modo`. Altrove la radice è la pagina di scelta, con dentro gli
 * istruttori e le altre aree: dal timer lì non si va.
 */
const SU_TABLET_DI_SALA = (() => {
  try {
    return localStorage.getItem('ods-corsi:modo') === 'tablet'
  } catch {
    return false
  }
})()

/** Il ritorno alla sala, grosso come i tasti del tablet da cui si arriva. */
function TornaSala({ className }: { className: string }) {
  return (
    <a className={`torna-sala ${className}`} href={SALA}>
      <Back size={20} />
      SALA
    </a>
  )
}

/**
 * Il timer. Da solo, un'app intera; con `incorporato`, la scheda TIMER del
 * tablet di sala di ODS Corsi (vedi `lib/incorporato.ts`).
 */
/** Ogni quanto il tablet di sala rilegge timer e collegamenti. */
const RILEGGI_TABLET = 5 * 60_000

export default function App({ incorporato }: { incorporato?: Incorporato } = {}) {
  // Senza un accesso le copie del database non si mostrano: non sarebbero né
  // aggiornate né modificabili. Con l'accesso la lista parte dall'ultima copia
  // vista, con sopra quello che è ancora in coda, e il database la aggiorna.
  const [workouts, setWorkouts] = useState<Workout[]>(() =>
    sessione ? unisci(loadWorkouts(), null) : soloDelDispositivo(loadWorkouts()),
  )
  const [accesso, setAccesso] = useState<Accesso>(() => accessoRicordato())
  const [corsi, setCorsi] = useState<Corso[]>(() => corsiRicordati())
  const [lezione, setLezione] = useState<Lezione | null>(() => (incorporato ? incorporato.lezione : lezioneDaIndirizzo()))
  // Sul tablet la lezione la dice la sala, e cambia da sola quando ne comincia
  // un'altra: da qui la si segue.
  const lezioneSala = incorporato?.lezione
  const chiaveSala = lezioneSala ? `${lezioneSala.corsoId}:${lezioneSala.sessioneId ?? ''}` : ''
  const primaSala = useRef(chiaveSala)
  useEffect(() => {
    if (!incorporato || primaSala.current === chiaveSala) return
    primaSala.current = chiaveSala
    setLezione(lezioneSala ?? null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chiaveSala])
  const [inCoda, setInCoda] = useState(0)
  const [sincronizzato, setSincronizzato] = useState<'no' | 'sì' | 'errore'>('no')
  const [settings, setSettings] = useState<Settings>(() => loadSettings())
  const [history, setHistory] = useState<HistoryEntry[]>(() => loadHistory())
  // Il catalogo sta qui e non nell'editor: la sezione esercizi e la scelta
  // dentro un timer devono vedere la stessa lista, non due copie.
  const [catalogo, setCatalogo] = useState<Esercizio[]>(() => loadEsercizi())
  const [tab, setTab] = useState<Tab>('timer')
  // Sul tablet le impostazioni si aprono solo con l'area istruttore: chiusa
  // quella, la scheda sparisce e chi c'era dentro torna ai timer.
  const conImpostazioni = incorporato?.conImpostazioni ?? true
  const schede = conImpostazioni ? TABS : TABS.filter((t) => t.key !== 'impostazioni')
  useEffect(() => {
    if (!conImpostazioni) setTab((t) => (t === 'impostazioni' ? 'timer' : t))
  }, [conImpostazioni])
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

  // Di ritorno dall'accesso a Spotify: si riapre dove si era, nelle
  // impostazioni, così si vede subito se il collegamento è andato.
  useEffect(() => {
    // Il ritorno da Spotify arriva al timer da solo, mai al tablet.
    if (incorporato) return
    void completaAccesso().then((esito) => {
      if (esito) setTab('impostazioni')
    })
  }, [])

  // Un allenamento può arrivare dentro l'indirizzo, da un QR inquadrato sul
  // tablet della sala o da un link su WhatsApp. Si mostra subito, e
  // l'indirizzo si ripulisce: un ricarica non deve riproporlo all'infinito.
  useEffect(() => {
    // Sul tablet il frammento è quello di ODS Corsi (`#sala`), non un timer.
    if (incorporato) return
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
  // Il tablet legge le impostazioni per la sua barra della musica.
  const avvisaSala = incorporato?.onSettings
  useEffect(() => avvisaSala?.(settings), [settings, avvisaSala])
  useEffect(() => saveEsercizi(catalogo), [catalogo])

  // --- Il database di ODS Corsi ---------------------------------------------
  // Chi è collegato, poi la libreria. Si rilegge quando l'app torna in primo
  // piano: il tablet in sala resta aperto per settimane, e un timer preparato
  // a casa la sera prima deve comparire senza che nessuno ricarichi.
  const personaId = accesso.chi === 'personale' ? accesso.personaId : null
  const suTablet = !!incorporato
  const ultimaLettura = useRef(0)
  const leggiDalServer = useCallback(async () => {
    if (!sessione) return
    ultimaLettura.current = Date.now()
    try {
      const a = await chiSei()
      setAccesso(a)
      if (a.chi === 'nessuno') {
        setWorkouts(soloDelDispositivo)
        return
      }
      if (a.chi === 'sala') {
        scaricaTimerSala().then(
          (i) => setSalaDalServer((prima) => (JSON.stringify(prima) === JSON.stringify(i) ? prima : i)),
          () => {
            // Senza risposta restano quelle dell'ultima volta, già salvate qui.
          },
        )
        void db()
          .then(fonteClipSupabase)
          .then(
            (f) => setClipDalServer((prima) => (prima?.versione === f.versione ? prima : f)),
            () => {
              // Senza rete (o senza 13-voce-esercizi.sql) parla la voce di sistema.
            },
          )
      }
      const l = await scaricaLibreria(a.chi === 'personale' ? a.personaId : null)
      setWorkouts((attuali) => unisci(attuali, l.timer))
      setCorsi(l.corsi)
      try {
        localStorage.setItem(DOVE_CORSI, JSON.stringify(l.corsi))
      } catch {
        // Senza localStorage si perde solo l'elenco senza rete.
      }
      setSincronizzato('sì')
    } catch {
      // Niente rete: resta l'ultima copia vista.
      setSincronizzato('errore')
    }
  }, [])
  useEffect(() => {
    void leggiDalServer()
    const torna = () => {
      if (document.visibilityState === 'visible' && Date.now() - ultimaLettura.current > 60_000) void leggiDalServer()
    }
    document.addEventListener('visibilitychange', torna)
    // Sul tablet però la pagina non va mai in secondo piano: senza un giro
    // ogni tanto, il timer scelto oggi in I MIEI TIMER non arriverebbe mai.
    const giro = suTablet ? window.setInterval(() => void leggiDalServer(), RILEGGI_TABLET) : 0
    return () => {
      document.removeEventListener('visibilitychange', torna)
      window.clearInterval(giro)
    }
  }, [leggiDalServer, suTablet])
  // E quando comincia un'altra lezione, subito: è lì che serve il suo timer.
  const lezioneLetta = useRef(chiaveSala)
  useEffect(() => {
    if (!suTablet || lezioneLetta.current === chiaveSala) return
    lezioneLetta.current = chiaveSala
    void leggiDalServer()
  }, [suTablet, chiaveSala, leggiDalServer])
  useEffect(() => guardaCoda(setInCoda), [])

  // Le preferenze seguono l'istruttore: si leggono una volta, e da lì ogni
  // cambio parte verso il database (dopo un attimo, perché il cursore del
  // volume ne manderebbe venti).
  const preferenzeLette = useRef<string | null>(null)
  useEffect(() => {
    if (!personaId) return
    let via = false
    scaricaPreferenze()
      .then((p) => {
        if (via) return
        if (p) setSettings((s) => ({ ...s, ...p }))
        preferenzeLette.current = p ? JSON.stringify(preferenzeDi({ ...DEFAULT_SETTINGS, ...p })) : ''
      })
      .catch(() => {
        // Senza rete restano quelle del dispositivo, e non si manda niente:
        // si rischierebbe di coprire quelle vere con quelle di qui.
      })
    return () => {
      via = true
    }
  }, [personaId])
  useEffect(() => {
    if (!personaId || preferenzeLette.current === null) return
    const adesso = JSON.stringify(preferenzeDi(settings))
    if (adesso === preferenzeLette.current) return
    const t = window.setTimeout(() => {
      preferenzeLette.current = adesso
      salvaPreferenze(settings)
    }, 1500)
    return () => window.clearTimeout(t)
  }, [settings, personaId])

  // Su un tablet di sala Maurizio, i segnali e lo schermo sono uguali su tutti
  // i tablet (vedi `impostazioniSala.ts`): si mettono sopra a quelle del
  // dispositivo, che se le salva e le ritrova anche senza rete, e cambiarle
  // qui le cambia per tutti. La voce e gli esercizi li sceglie la segreteria.
  // Dentro il tablet le legge e le salva ODS Corsi; il timer aperto da solo
  // fa da sé.
  const [salaDalServer, setSalaDalServer] = useState<TimerSala | null>(null)
  const [clipDalServer, setClipDalServer] = useState<FonteClip | null>(null)
  const dellaSala = incorporato ? incorporato.sala : salaDalServer
  const timerDellaSala = !!incorporato || accesso.chi === 'sala'
  useEffect(() => {
    if (dellaSala) setSettings((s) => ({ ...s, ...dellaSala.impostazioni }))
  }, [dellaSala])
  // Toccate qui, vanno a tutti: quando si smette di toccare, perché i cursori
  // cambiano a ogni pixel. Solo quelle toccate a mano: quelle arrivate dal
  // database non si rimandano indietro.
  const daMandare = useRef(false)
  const mandaSala = incorporato?.onTimerSala
  useEffect(() => {
    if (!daMandare.current) return
    const t = window.setTimeout(() => {
      daMandare.current = false
      const i = Object.fromEntries(CHIAVI_SALA.map((k) => [k, settings[k]])) as ImpostazioniSala
      if (mandaSala) mandaSala(i)
      else {
        setSalaDalServer((prima) => (prima ? { ...prima, impostazioni: i } : prima))
        void db()
          .then((c) => salvaTimerSala(c, i))
          .catch(() => {
            // Senza rete restano qui fino alla prossima lettura.
          })
      }
    }, 700)
    return () => window.clearTimeout(t)
  }, [settings, mandaSala])
  // Il catalogo degli esercizi, quando la segreteria ne ha fatto uno:
  // sul tablet è quello della palestra, e si salva qui per quando manca la rete.
  const eserciziSala = dellaSala?.esercizi ?? null
  useEffect(() => {
    if (eserciziSala) setCatalogo((c) => (JSON.stringify(c) === JSON.stringify(eserciziSala) ? c : eserciziSala))
  }, [eserciziSala])
  // E la voce di sistema, cercata per nome fra quelle di questo tablet: le
  // voci arrivano dal sistema anche dopo l'apertura, e si riprova quando cambiano.
  const voceSala = dellaSala ? dellaSala.voce : undefined
  useEffect(() => {
    if (voceSala === undefined) return
    const scegli = () => setSettings((s) => {
      const uri = voceDiNome(voceSala)
      return s.voiceURI === uri ? s : { ...s, voiceURI: uri }
    })
    scegli()
    if (!('speechSynthesis' in window)) return
    window.speechSynthesis.addEventListener('voiceschanged', scegli)
    return () => window.speechSynthesis.removeEventListener('voiceschanged', scegli)
  }, [voceSala])
  // Le clip incise dalla segreteria, prima di quelle del dispositivo.
  const clipSala = incorporato ? incorporato.clip : clipDalServer
  useEffect(() => {
    if (!timerDellaSala) return
    usaClipDellaSala(clipSala)
    return () => usaClipDellaSala(null)
  }, [clipSala, timerDellaSala])

  const patchSettings = useCallback(
    (patch: Partial<Settings>) => {
      if (timerDellaSala && toccaLaSala(patch)) daMandare.current = true
      setSettings((s) => ({ ...DEFAULT_SETTINGS, ...s, ...patch }))
    },
    [timerDellaSala],
  )

  const upsert = useCallback((w: Workout) => {
    // Sul database va solo quello che si può scrivere: il tablet e i timer
    // dei colleghi si aprono, non si cambiano (lo dicono anche le policy).
    if (personaId && (w.dove === 'miei' || w.dove === 'palestra')) salvaSulServer(w, personaId)
    setWorkouts((list) => {
      const i = list.findIndex((x) => x.id === w.id)
      if (i === -1) return [w, ...list]
      const copy = [...list]
      copy[i] = w
      return copy
    })
  }, [personaId])

  /**
   * Il salvataggio dall'editor. Un timer che va sul database e ha ancora
   * l'identificativo corto del dispositivo ne prende uno vero: è un timer
   * nuovo per il database, e quello vecchio sparisce dal dispositivo.
   */
  const salva = useCallback(
    (w: Workout, vecchioId: string) => {
      const pronto = w.dove && !eUnId(w.id) ? versoIlServer(w, w.dove === 'palestra' ? 'palestra' : 'miei') : w
      if (pronto.id !== vecchioId) setWorkouts((list) => list.filter((x) => x.id !== vecchioId))
      upsert(pronto)
      return pronto
    },
    [upsert],
  )
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
      if (accesso.chi !== 'nessuno') registraAllenamento(entry, workout, lezione?.sessioneId ?? null)
    },
    [accesso.chi, lezione],
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
    const rinomina = (w: Workout) =>
      w.exercises.some((e) => stesso(e.name))
        ? { ...w, exercises: w.exercises.map((e) => (stesso(e.name) ? { ...e, name: a } : e)) }
        : w
    // Sul database vanno quelli che si possono scrivere; quelli dei colleghi
    // cambiano solo qui, e alla prossima lettura tornano come li ha lasciati
    // chi li ha fatti.
    if (personaId)
      workouts
        .filter((w) => (w.dove === 'miei' || w.dove === 'palestra') && rinomina(w) !== w)
        .forEach((w) => salvaSulServer(rinomina(w), personaId))
    setWorkouts((list) => list.map(rinomina))
  }, [workouts, personaId])

  const startWorkout = useCallback((w: Workout, subito = false) => {
    // Partendo con qualcos'altro, l'allenamento lasciato a metà è acqua passata.
    scordaInterrotto()
    setInterrotto(null)
    setView({ kind: 'run', workout: w, subito })
  }, [])

  const duplicate = useCallback(
    (w: Workout) => {
      // La copia è di chi la fa: fra i miei se c'è un accesso da istruttore,
      // altrimenti sul dispositivo. È il modo di cambiare un timer di un
      // collega, o di portarne uno della palestra fra i propri.
      const base: Workout = { ...w, name: `${w.name} (copia)`, builtin: false, updatedAt: Date.now(), corsi: [], lezioni: [] }
      const copy: Workout = personaId ? { ...base, id: nuovoId(), dove: 'miei' } : { ...base, id: uid(), dove: undefined }
      upsert(copy)
      setView({ kind: 'editor', workout: copy })
    },
    [upsert, personaId],
  )

  const remove = useCallback(
    (w: Workout) => {
      const domanda =
        w.dove === 'palestra'
          ? `Eliminare “${w.name}” dalla libreria della palestra? Sparisce per tutti.`
          : w.corsi?.length
            ? `Eliminare “${w.name}”? È collegato a ${w.corsi.length === 1 ? 'un corso' : `${w.corsi.length} corsi`}, e sparisce anche da lì.`
            : `Eliminare “${w.name}”?`
      if (!window.confirm(domanda)) return
      if (personaId && (w.dove === 'miei' || w.dove === 'palestra')) eliminaDalServer(w)
      setWorkouts((list) => list.filter((x) => x.id !== w.id))
    },
    [personaId],
  )

  /** I timer di questo dispositivo che l'istruttore porta fra i suoi, sul database. */
  const portaNeiMiei = useCallback(() => {
    if (!personaId) return 0
    const daPortare = workouts.filter((w) => !w.dove && !w.builtin)
    const portati = daPortare.map((w) => versoIlServer(w, 'miei'))
    portati.forEach((w) => salvaSulServer(w, personaId))
    const via = new Set(daPortare.map((w) => w.id))
    setWorkouts((list) => [...portati, ...list.filter((w) => !via.has(w.id))])
    return portati.length
  }, [workouts, personaId])

  const gruppi: Gruppo[] = useMemo(() => gruppiDi(workouts, accesso, lezione), [workouts, accesso, lezione])
  // Sul tablet: i timer pronti per la lezione, e la richiesta di farne partire uno.
  const pronto = useMemo<TimerPronto | null>(() => {
    const g = gruppi.find((x) => x.chiave === 'lezione' && x.timer.length) ?? gruppi.find((x) => x.chiave === 'corso' && x.timer.length)
    return g ? { da: g.chiave === 'lezione' ? 'lezione' : 'corso', timer: g.timer.map((w) => ({ id: w.id, nome: w.name })) } : null
  }, [gruppi])
  const firmaPronto = pronto ? `${pronto.da}|${pronto.timer.map((t) => `${t.id}:${t.nome}`).join('|')}` : ''
  const avvisaPronto = incorporato?.onPronto
  useEffect(() => {
    avvisaPronto?.(pronto)
    // Si avvisa quando cambiano i timer, non quando cambia chi ascolta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firmaPronto])
  const richiesta = incorporato?.avvia
  const fatta = useRef(0)
  useEffect(() => {
    if (!richiesta || richiesta.volta === fatta.current) return
    fatta.current = richiesta.volta
    const w = workouts.find((x) => x.id === richiesta.id)
    if (w) startWorkout(w, true)
    // Solo per una richiesta nuova: la lista che cambia non la ripete.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [richiesta?.volta])

  const nomeLezione = lezione ? lezione.nome || corsi.find((c) => c.id === lezione.corsoId)?.nome || 'la lezione' : null

  const body = useMemo(() => {
    switch (tab) {
      case 'timer':
        return (
          <HomeScreen
            gruppi={gruppi}
            modificabile={(w) => !w.dove || (!!personaId && w.dove !== 'collega')}
            corsi={corsi}
            lezione={nomeLezione}
            conFiltri={!incorporato}
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
            sala={timerDellaSala}
            incorporato={!!incorporato}
            palestra={
              haUnServer && !incorporato ? (
                <PalestraSezione
                  accesso={accesso}
                  inCoda={inCoda}
                  sincronizzato={sincronizzato}
                  daPortare={personaId ? workouts.filter((w) => !w.dove && !w.builtin).length : 0}
                  onPorta={portaNeiMiei}
                  onAggiorna={() => void leggiDalServer()}
                />
              ) : null
            }
          />
        )
    }
  }, [
    tab,
    timerDellaSala,
    workouts,
    gruppi,
    corsi,
    nomeLezione,
    accesso,
    personaId,
    inCoda,
    sincronizzato,
    portaNeiMiei,
    leggiDalServer,
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

  // La musica scelta nelle impostazioni. Il lettore di YouTube vive qui, alla
  // radice, così cambiare scheda o aprire un allenamento non lo interrompe: le
  // schermate gli preparano solo il posto (vedi PlayerYoutube).
  //
  // Sul tablet di sala il lettore e la barra sono del tablet, che li tiene
  // sempre allo stesso posto, e la musica la sceglie la sala: al timer restano
  // le automazioni, sulla stessa fonte.
  const settingsMusica = useMemo(
    () => (incorporato ? { ...settings, ...incorporato.musica } : settings),
    [settings, incorporato?.musica.musicaFonte, incorporato?.musica.youtube], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const musica = useMusica(settingsMusica)
  const conYoutube = musica.fonte === 'youtube' && musica.attiva && !incorporato
  const con = (schermata: ReactNode) => (
    <>
      {schermata}
      {conYoutube && <PlayerYoutube link={settings.youtube} />}
    </>
  )

  if (view.kind === 'run') {
    return con(
      <TimerScreen
        workout={view.workout}
        settings={settingsMusica}
        ripresa={view.ripresa}
        partiSubito={view.subito}
        onStato={incorporato?.onStato}
        tastiera={incorporato ? incorporato.visibile : true}
        conMusica={!incorporato}
        onExit={() => setView({ kind: 'tabs' })}
        onFinish={recordFinish(view.workout)}
      />
    )
  }

  if (view.kind === 'storico') {
    return con(
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
    return con(<CondividiScreen workout={view.workout} onBack={() => setView({ kind: 'tabs' })} />)
  }

  if (view.kind === 'ricevuto') {
    const ricevuto = view.workout
    return con(
      <RicevutoScreen
        workout={ricevuto}
        onSalva={() => {
          // Un timer ricevuto col QR è di chi lo riceve: fra i miei se c'è un
          // accesso da istruttore, altrimenti sul dispositivo.
          upsert(personaId ? versoIlServer({ ...ricevuto, dove: undefined }, 'miei') : { ...ricevuto, dove: undefined, corsi: [] })
          setTab('timer')
          setView({ kind: 'tabs' })
        }}
        onAvvia={() => setView({ kind: 'run', workout: ricevuto })}
        onChiudi={() => setView({ kind: 'tabs' })}
      />
    )
  }

  if (view.kind === 'schema') {
    return con(
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
    return con(
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
    return con(<VoiceRecorderScreen workouts={workouts} catalogo={catalogo} onBack={() => setView({ kind: 'tabs' })} />)
  }

  if (view.kind === 'editor') {
    return con(
      <EditorScreen
        initial={view.workout}
        nuovo={view.nuovo}
        destinazioni={personaId && !view.workout.dove ? ['miei', 'palestra', 'qui'] : null}
        corsi={personaId ? corsi : []}
        catalogo={catalogo}
        onCatalogo={setCatalogo}
        onCancel={() => setView({ kind: 'tabs' })}
        onSave={(w) => {
          salva(w, view.workout.id)
          setTab('timer')
          setView({ kind: 'tabs' })
        }}
        onSaveAndStart={(w) => {
          setView({ kind: 'run', workout: salva(w, view.workout.id) })
        }}
      />
    )
  }

  return con(
    <div className="shell">
      {/* Su desktop la stessa faccia della segreteria e degli istruttori di
          ODS Corsi: il marchio piccolo con il nome dell'area, le voci con il
          filo rosso a sinistra, e in fondo il ritorno e la versione. */}
      <nav className="sidebar" aria-label="Timer">
        {/* Sul tablet il marchio c'è già, nella testata della sala. */}
        {!incorporato && (
          <div className="row" style={{ gap: 10, padding: '0 8px' }}>
            <Logo width={46} />
            <span className="stack" style={{ gap: 2 }}>
              <span className="ob" style={{ fontSize: 20, fontWeight: 700, letterSpacing: '0.04em', lineHeight: 1 }}>ODS TIMER</span>
              <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.22em', color: 'var(--dim)' }}>COLLEGNO</span>
            </span>
          </div>
        )}
        <div className="stack" style={{ gap: 2 }}>
          {schede.map((t) => (
            <button key={t.key} className="navitem" aria-current={tab === t.key ? 'page' : undefined} onClick={() => setTab(t.key)}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="grow" />
        {!incorporato && (
          <div className="stack" style={{ gap: 12 }}>
            {SU_TABLET_DI_SALA && <TornaSala className="" />}
            <span className="num sidebar-versione">ODS TIMER {VERSIONE}</span>
          </div>
        )}
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
            <h1 className="ob page-title">{tab === 'timer' && incorporato ? 'I TIMER DELLA SALA' : TAB_TITLE[tab]}</h1>
            <div className="grow" />
            {!incorporato && SU_TABLET_DI_SALA && <TornaSala className="torna-sala-alto" />}
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

        {/* La musica si comanda da tutte le schede, non solo dentro un
            allenamento: in sala la si fa partire prima che arrivino tutti. */}
        {!incorporato && <MusicaBar musica={musica} className="musica-schede" />}

        <nav className="tabbar">
          {schede.map((t) => {
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
          {!incorporato && SU_TABLET_DI_SALA && (
            <a className={PIENE.includes(tab) ? 'tab' : 'tab tab-sala'} href={SALA}>
              <Back size={22} />
              SALA
            </a>
          )}
        </nav>
      </div>
    </div>
  )
}
