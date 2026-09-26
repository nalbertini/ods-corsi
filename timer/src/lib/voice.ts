import { getClip } from './clipStore'
import { speak } from './audio'
import { CLIP_DIR, CLIP_EXTENSIONS } from './voiceClips'

/**
 * Riproduzione delle clip incise, con ripiego sulla sintesi.
 *
 * L'ordine è: registrazione su questo dispositivo, poi file pubblicato con
 * l'app, poi sintesi vocale. Così una palestra può partire senza incidere
 * nulla, incidere sul posto e vedere l'effetto subito, e infine distribuire
 * le clip a tutti pubblicandole.
 */

let ctx: AudioContext | null = null
let inCorso: AudioBufferSourceNode[] = []
interface Clip {
  buffer: AudioBuffer
  /** Secondi di silenzio da saltare in testa. */
  attacco: number
}

const cache = new Map<string, Clip | null>()
const pending = new Map<string, Promise<Clip | null>>()

/**
 * Trova dove comincia davvero il suono.
 *
 * Le registrazioni hanno quantità diverse di silenzio iniziale — fra le clip
 * dei numeri si va da 0,02 a 0,22 secondi — e in un conto alla rovescia si
 * sentirebbe: «tre» sul tempo e «due» un quinto di secondo dopo. Saltare il
 * silenzio in riproduzione le allinea tutte senza toccare i file.
 */
function attaccoDi(buffer: AudioBuffer): number {
  const d = buffer.getChannelData(0)
  const soglia = 0.01
  let i = 0
  while (i < d.length && Math.abs(d[i]) <= soglia) i++
  if (i >= d.length) return 0
  const secondi = i / buffer.sampleRate
  // Sotto i 40 ms non vale la pena, e un filo di respiro prima dell'attacco
  // va lasciato: tagliato di netto, il suono parte con un clic.
  return secondi < 0.04 ? 0 : Math.max(0, secondi - 0.015)
}

function context(): AudioContext | null {
  if (ctx) return ctx
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  try {
    ctx = new Ctor()
  } catch {
    return null
  }
  ascolta(ctx)
  return ctx
}

/**
 * Come per i bip: quando cambia l'uscita audio — cassa bluetooth, cuffie, una
 * telefonata — il sistema interrompe il contesto, e da lì in poi resta sospeso.
 * `suona` lo risveglia per la volta dopo, ma solo se qualcuno prova a parlare:
 * qui lo si risveglia nel momento in cui è stato interrotto, così la volta dopo
 * è già pronto invece di essere la prima a perdersi.
 */
function ascolta(c: AudioContext) {
  const sveglia = () => {
    if (document.hidden || c.state === 'running') return
    void c.resume().catch(() => {})
  }
  c.addEventListener('statechange', sveglia)
  document.addEventListener('visibilitychange', sveglia)
  try {
    navigator.mediaDevices?.addEventListener?.('devicechange', sveglia)
  } catch {
    // Niente `mediaDevices`: restano gli altri due.
  }
}

async function decode(data: ArrayBuffer): Promise<AudioBuffer | null> {
  const c = context()
  if (!c) return null
  try {
    return await c.decodeAudioData(data)
  } catch {
    // Formato non decodificabile da questo browser.
    return null
  }
}

/**
 * L'indice delle clip pubblicate con l'app: `voce/index.json`.
 *
 * Serve a non sparare richieste a vuoto. Senza, per sapere quali clip esistono
 * bisognerebbe tentare ogni chiave per ogni estensione — un centinaio di 404 a
 * ogni apertura del timer. Con l'indice è una richiesta sola, e se manca vuol
 * dire che non c'è nulla di pubblicato e non si tenta affatto.
 * Il registratore lo genera insieme allo zip da esportare.
 */
interface ClipIndex {
  ext: string
  clips: string[]
}

let indexPromise: Promise<ClipIndex | null> | null = null

function clipIndex(): Promise<ClipIndex | null> {
  if (!indexPromise) {
    indexPromise = fetch(`${CLIP_DIR}/index.json`)
      .then((r) => (r.ok ? (r.json() as Promise<ClipIndex>) : null))
      .then((i) =>
        i && typeof i.ext === 'string' && Array.isArray(i.clips) && (CLIP_EXTENSIONS as readonly string[]).includes(i.ext)
          ? i
          : null,
      )
      .catch(() => null)
  }
  return indexPromise
}

async function load(key: string): Promise<Clip | null> {
  // Prima la registrazione locale: incidere sul tablet deve avere effetto subito.
  const recorded = await getClip(key)
  if (recorded) {
    const buf = await decode(await recorded.arrayBuffer())
    if (buf) return { buffer: buf, attacco: attaccoDi(buf) }
  }
  const index = await clipIndex()
  if (!index || !index.clips.includes(key)) return null
  try {
    const res = await fetch(`${CLIP_DIR}/${key}.${index.ext}`)
    if (!res.ok) return null
    const buf = await decode(await res.arrayBuffer())
    return buf ? { buffer: buf, attacco: attaccoDi(buf) } : null
  } catch {
    return null
  }
}

/** Risolve una volta sola per chiave, anche se la chiedono in dieci insieme. */
function clip(key: string): Promise<Clip | null> {
  if (cache.has(key)) return Promise.resolve(cache.get(key) ?? null)
  const inFlight = pending.get(key)
  if (inFlight) return inFlight
  const p = load(key).then((c) => {
    cache.set(key, c)
    pending.delete(key)
    return c
  })
  pending.set(key, p)
  return p
}

/** Da chiamare quando le clip cambiano, altrimenti resta in cache la vecchia. */
export function forgetClips() {
  cache.clear()
  pending.clear()
  indexPromise = null
}

export function unlockVoice() {
  const c = context()
  if (c && c.state === 'suspended') void c.resume()
}

/** Scalda le clip che serviranno, così al momento buono partono senza ritardo. */
export function preload(keys: string[]) {
  keys.filter(Boolean).forEach((k) => void clip(k))
}

/**
 * La clip se è GIÀ pronta in memoria, altrimenti null — e intanto avvia il
 * caricamento per la volta dopo.
 *
 * Non aspetta mai la rete: un annuncio è legato a un istante preciso
 * dell'allenamento, e uno che arriva in ritardo non è un annuncio, è rumore.
 */
export function clipPronta(key: string): Clip | null {
  if (cache.has(key)) return cache.get(key) ?? null
  void clip(key)
  return null
}

export const hasClip = (key: string): boolean => clipPronta(key) !== null

function suona(clips: Clip[], volume: number): boolean {
  const c = context()
  if (!c) return false
  if (c.state === 'suspended') {
    // Non si aspetta: sarebbe di nuovo un annuncio fuori tempo. Si sveglia per
    // la prossima volta e per questa parla la sintesi.
    void c.resume()
  }
  if (c.state !== 'running') return false
  // Come per la sintesi, l'ultimo annuncio vince: il saluto iniziale dura
  // sei secondi e con una preparazione corta si accavallerebbe a quello dopo.
  inCorso.forEach((s) => {
    try {
      s.stop()
    } catch {
      // Già finita da sola.
    }
  })
  inCorso = []
  let when = c.currentTime
  for (const { buffer, attacco } of clips) {
    const src = c.createBufferSource()
    const gain = c.createGain()
    gain.gain.value = volume
    src.buffer = buffer
    src.connect(gain).connect(c.destination)
    src.start(when, attacco)
    src.onended = () => {
      inCorso = inCorso.filter((x) => x !== src)
    }
    inCorso.push(src)
    when += buffer.duration - attacco
  }
  return true
}

/**
 * Dice qualcosa con la voce incisa, se è pronta, altrimenti con la sintesi.
 *
 * `keys` è una sequenza da suonare di fila: la prima è obbligatoria, le altre
 * sono di contorno. Se la prima non c'è o non è ancora scaricata si ripiega
 * subito sulla sintesi di `text`; se mancano solo quelle dopo, si suona il
 * pezzo disponibile.
 *
 * Restituisce `true` se ha parlato con la voce incisa.
 */
export function say(
  keys: string[],
  text: string,
  opts: { volume: number; voiceURI: string | null; useRecorded: boolean },
): boolean {
  if (opts.useRecorded) {
    const pronte: Clip[] = []
    for (const k of keys.filter(Boolean)) {
      const c = clipPronta(k)
      if (!c) break
      pronte.push(c)
    }
    if (pronte.length > 0 && suona(pronte, opts.volume)) return true
  }
  speak(text, opts.volume, opts.voiceURI)
  return false
}
