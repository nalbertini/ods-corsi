import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Segment, Settings } from '../types'
import { Cues, buzz } from './audio'
import { COACH_LINES, EXTRA_LINES, coachedDisplay, eventiSonori } from './engine'
import { hasClip, preload, say, unlockVoice } from './voice'
import { INTRO_CLIP, PROSSIMO_CLIP, STATE_CLIP, exerciseKey, extraClip } from './voiceClips'

export type Status = 'idle' | 'running' | 'paused' | 'done'

export interface TimerView {
  status: Status
  segment: Segment | null
  index: number
  /** Secondi mostrati nel quadrante: scendono, o salgono nei For Time. */
  display: number
  /** Da 0 a 1 dentro il segmento corrente. */
  progress: number
  /** Secondi che mancano alla fine dell'allenamento. */
  remainingTotal: number
  elapsed: number
  total: number
  next: Segment | null
}

/**
 * Il tempo viene sempre ricavato dall'orologio, mai accumulato tick dopo tick:
 * così un tab in background, messo in pausa dal sistema, riallinea da solo il
 * conteggio invece di restare indietro.
 */
/** Quanti secondi di suoni si tengono sempre consegnati in anticipo. */
const ORIZZONTE = 120

export function useTimer(
  segments: Segment[],
  settings: Settings,
  onFinish: (seconds: number, completed: boolean) => void,
  /** Chiamata quando il conto mostrato risale, con la frase che gli scappa. */
  onCoachSlip?: (frase: string) => void,
) {
  const [status, setStatus] = useState<Status>('idle')
  const [elapsed, setElapsed] = useState(0)

  const cues = useRef(new Cues())
  const bankedRef = useRef(0)
  const anchorRef = useRef(0)
  const lastIndexRef = useRef(-1)
  const lastShownRef = useRef(-1)
  /* Fin dove i suoni sono già consegnati all'orologio audio, in secondi
     dall'inizio dell'allenamento. Due minuti alla volta: abbastanza perché il
     telefono possa stare in tasca a lungo senza che si perda un bip, e poco
     abbastanza da non tenere in coda centinaia di nodi. */
  const programmatoRef = useRef(-1)
  /* L'ultimo suono di cambio fatto partire SUBITO, con il momento reale in cui
     è successo. All'avvio la coda viene costruita due volte a un decimo di
     secondo di distanza — i segmenti si riestraggono perché Maurizio sbaglia
     in punti diversi a ogni giro — e un suono già partito non si può più
     annullare: senza questa memoria il tono del primo segmento si sentiva
     doppio. */
  const ultimoCambioRef = useRef<{ t: number; quando: number } | null>(null)
  const introRef = useRef(false)
  const finishRef = useRef(onFinish)
  finishRef.current = onFinish
  const slipRef = useRef(onCoachSlip)
  slipRef.current = onCoachSlip

  cues.current.volume = settings.volume

  const voiceOpts = {
    volume: settings.volume,
    voiceURI: settings.voiceURI,
    useRecorded: settings.recordedVoice,
  }
  const voiceRef = useRef(voiceOpts)
  voiceRef.current = voiceOpts

  // Il grosso è già scaldato all'apertura dell'app; qui restano i nomi degli
  // esercizi di questo allenamento.
  useEffect(() => {
    preload(segments.map((s) => exerciseKey(s.name)))
  }, [segments])

  // La lista dei segmenti può cambiare mentre si va — il tasto «+30″» allunga
  // l'intervallo in corso — e allora il numero mostrato salta su di trenta.
  // Senza dimenticare l'ultimo numero visto, quel salto verrebbe letto come un
  // ripensamento di Maurizio, con tanto di battuta e illustrazione: sarebbe
  // l'app a prendersi gioco di una scelta dell'istruttore.
  useEffect(() => {
    lastShownRef.current = -1
  }, [segments])

  const total = useMemo(() => {
    const last = segments[segments.length - 1]
    return last ? last.offset + last.duration : 0
  }, [segments])

  const indexAt = useCallback(
    (t: number) => {
      if (segments.length === 0) return -1
      for (let i = segments.length - 1; i >= 0; i--) {
        if (t >= segments[i].offset) return i
      }
      return 0
    },
    [segments],
  )

  const announce = useCallback(
    (seg: Segment, prossimo: Segment | null) => {
      // Il suono del cambio non si fa qui: è già stato consegnato all'orologio
      // audio insieme a tutti gli altri, e farlo anche qui lo raddoppierebbe.
      // Qui restano le cose che l'orologio audio non sa fare: la voce e la
      // vibrazione.
      if (settings.vibrate) buzz(seg.kind === 'work' ? [90, 60, 90] : 60)

      // Il giro che Maurizio si è inventato non si annuncia come un lavoro
      // qualsiasi: è lui che se lo intesta, con tanto di illustrazione.
      if (seg.extra !== undefined) {
        const frase = EXTRA_LINES[seg.extra] ?? EXTRA_LINES[0]
        slipRef.current?.(frase)
        if (settings.voice) say([extraClip(seg.extra)], frase, voiceRef.current)
        return
      }

      if (!settings.voice) return
      const label = seg.label.toLowerCase()
      const base = seg.kind === 'work' ? [STATE_CLIP.work, exerciseKey(seg.name)] : [STATE_CLIP[seg.kind]]

      // Nel recupero si dice anche dove si va dopo: in un circuito a otto
      // stazioni è l'unico momento in cui uno può prepararsi alla successiva.
      const dopo = prossimo && prossimo.kind === 'work' ? prossimo.name.trim() : ''
      const annunciaDopo =
        settings.announceNext && dopo.length > 0 && (seg.kind === 'rest' || seg.kind === 'setRest')
      // La coda si aggiunge solo se entrambe le clip ci sono: `say` suona il
      // pezzo disponibile e si ferma, e un «prossimo» senza nome è peggio del
      // silenzio. Se invece parla la sintesi, la frase intera ce l'ha comunque.
      const codaIncisa = annunciaDopo && hasClip(PROSSIMO_CLIP) && hasClip(exerciseKey(dopo))
      const keys = codaIncisa ? [...base, PROSSIMO_CLIP, exerciseKey(dopo)] : base

      // «Preparati» non si annuncia: ci pensa il saluto. E se il saluto non è
      // ancora pronto, il silenzio è meglio di una voce sintetica che dice
      // una parola di cui si può fare a meno.
      const testo =
        seg.kind === 'prepare'
          ? ''
          : (seg.kind === 'work' ? `${label}. ${seg.name}` : label) + (annunciaDopo ? `. Prossimo: ${dopo}` : '')
      const conIntro = introRef.current
      introRef.current = false
      // Al primo annuncio il saluto PRENDE IL POSTO di «preparati», non lo
      // precede: dice già lui che l'allenamento sta per cominciare, e
      // incatenati i due sforavano nel conto alla rovescia, che li tagliava.
      say(conIntro && hasClip(INTRO_CLIP) ? [INTRO_CLIP] : keys, testo, voiceRef.current)
    },
    [settings.vibrate, settings.voice, settings.volume, settings.voiceURI, settings.announceNext],
  )

  /**
   * Consegna all'orologio audio i suoni dei prossimi due minuti.
   *
   * `daCapo` butta via quello che era già in coda: serve quando il programma
   * cambia sotto i piedi — una pausa, un salto, un «+30″». Senza, si estende
   * soltanto in avanti, e quello già consegnato resta dov'è.
   */
  const programmaSuoni = useCallback(
    (adesso: number, daCapo: boolean) => {
      const c = cues.current
      if (daCapo) {
        c.annullaProgrammati()
        programmatoRef.current = adesso - 0.001
      }
      if (!settings.countdownBeep) return
      const fino = adesso + ORIZZONTE
      if (fino <= programmatoRef.current) return
      /* Su una programmazione da capo si guarda anche un attimo all'indietro,
         perché quasi sempre si riparte NEL momento in cui si entra in un
         segmento — l'avvio, un salto — e il suono di quel segmento è appena
         passato. Vale solo per i suoni di cambio: un bip già suonato non si
         ripete, o all'avvio se ne sentirebbero due. */
      const grazia = daCapo ? 0.4 : 0
      for (const e of eventiSonori(segments, adesso - grazia - 0.001, fino)) {
        const fra = e.t - adesso
        const cambio = e.tipo === 'lavoro' || e.tipo === 'riposo'
        if (fra < -0.05 && !cambio) continue
        const quando = Math.max(0, fra)
        if (cambio && quando === 0) {
          const g = ultimoCambioRef.current
          const ora = performance.now()
          if (g && Math.abs(g.t - e.t) < 0.05 && ora - g.quando < 1500) continue
          ultimoCambioRef.current = { t: e.t, quando: ora }
        }
        if (e.tipo === 'bip' || e.tipo === 'bipUltimo') c.programmaBip(quando, e.tipo === 'bipUltimo')
        else if (e.tipo === 'fine') c.programmaFine(quando)
        else c.programmaCambio(quando, e.tipo === 'lavoro')
      }
      programmatoRef.current = fino
    },
    [segments, settings.countdownBeep],
  )

  /* I segmenti cambiano identità quando il «+30″» allunga l'intervallo in
     corso: da lì in poi la coda dei suoni è sbagliata e va rifatta. */
  useEffect(() => {
    const c = cues.current
    if (status !== 'running') {
      c.annullaProgrammati()
      programmatoRef.current = -1
      return
    }
    programmaSuoni(bankedRef.current + (performance.now() - anchorRef.current) / 1000, true)
    return () => c.annullaProgrammati()
  }, [status, segments, programmaSuoni])

  useEffect(() => {
    if (status !== 'running') return

    const tick = () => {
      const now = bankedRef.current + (performance.now() - anchorRef.current) / 1000

      if (total > 0 && now >= total) {
        bankedRef.current = total
        setElapsed(total)
        setStatus('done')
        if (settings.vibrate) buzz([200, 100, 200, 100, 300])
        if (settings.voice) say([STATE_CLIP.finish], 'Allenamento completato', voiceRef.current)
        finishRef.current(total, true)
        return
      }

      setElapsed(now)

      // Quando la coda si accorcia a meno di un minuto, si allunga: così resta
      // sempre almeno un minuto di suoni già consegnati davanti a noi.
      if (now + ORIZZONTE / 2 > programmatoRef.current) programmaSuoni(now, false)

      const i = indexAt(now)
      const seg = segments[i]
      if (!seg) return

      if (i !== lastIndexRef.current) {
        lastIndexRef.current = i
        lastShownRef.current = -1
        announce(seg, segments[i + 1] ?? null)
        return
      }

      if (seg.countUp) return
      // Si reagisce al numero MOSTRATO, non a quello vero: altrimenti bip e
      // voce tradirebbero il ripensamento un attimo prima che si veda.
      const mostrato = Math.ceil(coachedDisplay(seg, seg.offset + seg.duration - now))
      if (mostrato < 1 || mostrato === lastShownRef.current) return
      const tornatoIndietro = lastShownRef.current > 0 && mostrato > lastShownRef.current
      lastShownRef.current = mostrato

      // Il ticchettio segue il numero mostrato come tutto il resto: se Maurizio
      // si inceppa, l'orologio si inceppa con lui. Tic e tac si alternano sui
      // secondi pari e dispari.
      if (settings.ticchettio) cues.current.tick(mostrato % 2 === 0)

      // L'esitazione può cadere ovunque nell'intervallo, non solo in fondo:
      // la battuta va quindi legata al numero che risale, non al conto finale.
      // Solo però se Maurizio è acceso: a modalità spenta un numero che risale
      // è una cosa sola, l'istruttore che ha allungato l'intervallo.
      if (tornatoIndietro && settings.coach !== 'off') {
        const i = Math.floor(Math.random() * COACH_LINES.length)
        slipRef.current?.(COACH_LINES[i])
        if (settings.voice) say([`maurizio/${i + 1}`], COACH_LINES[i], voiceRef.current)
        return
      }

      // Anche i bip degli ultimi secondi sono già in coda: cinque uguali,
      // l'ultimo lungo il doppio, e poi il suono del segmento nuovo in fondo.
    }

    const id = window.setInterval(tick, 100)
    tick()
    return () => window.clearInterval(id)
  }, [
    status,
    total,
    segments,
    indexAt,
    announce,
    settings.countdownBeep,
    settings.ticchettio,
    settings.vibrate,
    settings.voice,
    settings.volume,
    settings.voiceURI,
    settings.recordedVoice,
    settings.announceNext,
    settings.coach,
  ])

  /* Il fruscìo che tiene sveglia la cassa bluetooth, solo mentre il timer gira:
     vedi `Cues.tieniSveglio`. */
  useEffect(() => {
    const c = cues.current
    c.tieniSveglio(status === 'running')
    return () => c.tieniSveglio(false)
  }, [status])

  const start = useCallback(() => {
    cues.current.unlock()
    unlockVoice()
    introRef.current = true
    bankedRef.current = 0
    anchorRef.current = performance.now()
    lastIndexRef.current = -1
    lastShownRef.current = -1
    setElapsed(0)
    setStatus('running')
  }, [])

  const resume = useCallback(() => {
    cues.current.unlock()
    unlockVoice()
    anchorRef.current = performance.now()
    // Riparte dal segmento corrente senza riannunciarlo.
    lastIndexRef.current = indexAt(bankedRef.current)
    programmaSuoni(bankedRef.current, true)
    setStatus('running')
  }, [indexAt, programmaSuoni])

  const pause = useCallback(() => {
    bankedRef.current = bankedRef.current + (performance.now() - anchorRef.current) / 1000
    setElapsed(bankedRef.current)
    setStatus('paused')
  }, [])

  const toggle = useCallback(() => {
    if (status === 'running') pause()
    else if (status === 'paused') resume()
    else start()
  }, [status, pause, resume, start])

  const seekTo = useCallback(
    (seconds: number) => {
      const t = Math.max(0, Math.min(seconds, Math.max(0, total - 0.001)))
      bankedRef.current = t
      anchorRef.current = performance.now()
      setElapsed(t)
      lastShownRef.current = -1
      const i = indexAt(t)
      lastIndexRef.current = i
      if (status === 'running') programmaSuoni(t, true)
      else cues.current.annullaProgrammati()
      if (status === 'done') setStatus('paused')
      const seg = segments[i]
      if (seg && status === 'running') announce(seg, segments[i + 1] ?? null)
    },
    [total, indexAt, segments, status, announce, programmaSuoni],
  )

  const skip = useCallback(
    (step: 1 | -1) => {
      // A fine allenamento «avanti» non porta da nessuna parte: senza questo,
      // riportava indietro a un'ultima frazione di secondo, in pausa, come se
      // l'allenamento non fosse mai finito. Indietro invece resta utile.
      if (step === 1 && status === 'done') return
      const now = bankedRef.current + (status === 'running' ? (performance.now() - anchorRef.current) / 1000 : 0)
      const i = indexAt(now)
      if (i < 0) return
      if (step === -1) {
        // Come su un lettore musicale: indietro torna all'inizio del segmento,
        // e solo se sei appena partito salta a quello precedente.
        const intoSegment = now - segments[i].offset
        const target = intoSegment > 1.5 ? i : Math.max(0, i - 1)
        seekTo(segments[target].offset)
        return
      }
      const next = segments[i + 1]
      if (next) seekTo(next.offset)
      else seekTo(total)
    },
    [status, indexAt, segments, seekTo, total],
  )

  /**
   * Riparte da un allenamento interrotto: si mette in pausa al secondo dove
   * era rimasto, invece di far ripartire il conto da zero. In pausa e non in
   * corsa di proposito — chi riprende vuole dire «ci siamo?» prima di ripartire.
   */
  const riprendiDa = useCallback(
    (secondi: number) => {
      cues.current.unlock()
      unlockVoice()
      bankedRef.current = secondi
      anchorRef.current = performance.now()
      lastIndexRef.current = indexAt(secondi)
      lastShownRef.current = -1
      introRef.current = false
      setElapsed(secondi)
      setStatus('paused')
    },
    [indexAt],
  )

  const stop = useCallback(() => {
    const done = bankedRef.current + (status === 'running' ? (performance.now() - anchorRef.current) / 1000 : 0)
    // A fine allenamento lo storico è già stato scritto: non registrarlo due volte.
    if (done > 1 && status !== 'done') finishRef.current(done, false)
    bankedRef.current = 0
    setElapsed(0)
    lastIndexRef.current = -1
    lastShownRef.current = -1
    setStatus('idle')
  }, [status])

  const view: TimerView = useMemo(() => {
    const index = indexAt(elapsed)
    const segment = segments[index] ?? null
    const into = segment ? elapsed - segment.offset : 0
    const real = segment ? (segment.countUp ? into : segment.duration - into) : 0
    const display = segment ? coachedDisplay(segment, real) : 0
    return {
      status,
      segment,
      index,
      display: Math.max(0, display),
      progress: segment && segment.duration > 0 ? Math.min(1, Math.max(0, into / segment.duration)) : 0,
      remainingTotal: Math.max(0, total - elapsed),
      elapsed,
      total,
      next: segments[index + 1] ?? null,
    }
  }, [elapsed, indexAt, segments, status, total])

  return { view, start, pause, resume, toggle, stop, skip, seekTo, riprendiDa }
}
