import type { Mode, Workout } from '../types'
import { MAX_ESERCIZI, workoutSano } from './sano'

/**
 * Mandare un allenamento a un altro dispositivo senza un server in mezzo.
 *
 * Un allenamento è poca roba — nome, schema, sette tempi e l'elenco degli
 * esercizi — e compresso sta dentro un link: duecento caratteri per un timer
 * normale, poco più di trecento per un circuito da venti stazioni. Un QR code
 * ne regge quasi tremila, quindi il codice resta a maglie larghe e si legge
 * al volo da uno schermo di telefono.
 *
 * I dati stanno dopo il `#`, e quella parte dell'URL il browser non la manda
 * mai al server. Due conseguenze, entrambe buone: gli allenamenti della
 * palestra non passano da nessuna parte, e il tablet in sala riceve il timer
 * anche senza rete, purché abbia già l'app in cache.
 *
 * È una copia, non una sincronizzazione: chi riceve si ritrova il timer com'era
 * al momento della scansione. Per una libreria che si allinea da sola servirebbe
 * un server, ed è l'unica cosa qui dentro che non si può fare senza.
 */

/** La chiave nel frammento: `#w=…`. */
const CHIAVE = 'w'

/** Nomi di campo corti: un link che si deve leggere da un QR non ha grasso da portarsi dietro. */
interface Magro {
  n: string
  m: Mode
  p: number
  w: number
  r: number
  R: number
  s: number
  S: number
  c: number
  d: number
  /** `[nome, durata?, serie?, ripetizioni?, carico?]`, con gli zeri al posto di quel che manca. */
  e: Array<[string, number, number, number, number]>
}

function magro(w: Workout): Magro {
  return {
    n: w.name,
    m: w.mode,
    p: w.prepare,
    w: w.work,
    r: w.rest,
    R: w.rounds,
    s: w.sets,
    S: w.setRest,
    c: w.cooldown,
    d: w.duration,
    e: w.exercises.map((e) => [e.name, e.duration ?? 0, e.sets ?? 0, e.reps ?? 0, e.kg ?? 0]),
  }
}

/**
 * Rimette in piedi l'allenamento arrivato dal link.
 *
 * Qui si torna solo dalla forma corta a quella piena; a riportare i valori
 * dentro i limiti ci pensa `workoutSano`, che è lo stesso controllo del
 * ripristino da file. Un timer che arriva da un link è una copia, quindi
 * prende un'identità nuova.
 */
function grasso(m: Magro): Workout | null {
  if (!m || typeof m !== 'object') return null
  const e = Array.isArray(m.e) ? m.e.slice(0, MAX_ESERCIZI) : []
  return workoutSano({
    name: m.n,
    mode: m.m,
    prepare: m.p,
    work: m.w,
    rest: m.r,
    rounds: m.R,
    sets: m.s,
    setRest: m.S,
    cooldown: m.c,
    duration: m.d,
    exercises: e.map((x) => {
      const [name, duration, sets, reps, kg] = Array.isArray(x) ? x : [x, 0, 0, 0, 0]
      return { name, duration, sets, reps, kg }
    }),
  })
}

const base64url = (b: Uint8Array) => {
  let s = ''
  for (const byte of b) s += String.fromCharCode(byte)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

const daBase64url = (s: string): Uint8Array => {
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/'))
  const out = new Uint8Array(b.length)
  for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i)
  return out
}

async function sgonfia(dati: Uint8Array): Promise<Uint8Array | null> {
  if (typeof CompressionStream === 'undefined') return null
  try {
    const cs = new CompressionStream('deflate-raw')
    const scritto = new Blob([dati as BlobPart]).stream().pipeThrough(cs)
    return new Uint8Array(await new Response(scritto).arrayBuffer())
  } catch {
    return null
  }
}

async function gonfia(dati: Uint8Array): Promise<Uint8Array | null> {
  if (typeof DecompressionStream === 'undefined') return null
  try {
    const ds = new DecompressionStream('deflate-raw')
    const letto = new Blob([dati as BlobPart]).stream().pipeThrough(ds)
    return new Uint8Array(await new Response(letto).arrayBuffer())
  } catch {
    return null
  }
}

/**
 * Il link da mostrare come QR o da mandare a un collega.
 *
 * Il primo carattere dice come è scritto quello che segue: `1` compresso, `0`
 * in chiaro. La compressione è quella del browser, e dove non c'è — o dove
 * fallisce — il link diventa più lungo ma continua a funzionare, che è meglio
 * di una condivisione che non parte.
 */
export async function linkPer(w: Workout, base = location.href.split('#')[0]): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(magro(w)))
  const compresso = await sgonfia(json)
  const corpo = compresso ? `1${base64url(compresso)}` : `0${base64url(json)}`
  return `${base}#${CHIAVE}=${corpo}`
}

/** L'allenamento contenuto in un indirizzo, se c'è ed è sano. */
export async function workoutDaLink(href = location.href): Promise<Workout | null> {
  const frammento = href.split('#')[1]
  if (!frammento) return null
  const corpo = new URLSearchParams(frammento).get(CHIAVE)
  if (!corpo || corpo.length < 2) return null
  try {
    const dati = daBase64url(corpo.slice(1))
    const json = corpo[0] === '1' ? await gonfia(dati) : dati
    if (!json) return null
    return grasso(JSON.parse(new TextDecoder().decode(json)) as Magro)
  } catch {
    return null
  }
}

/** Toglie il timer dall'indirizzo, così un ricarica non lo ripropone all'infinito. */
export function pulisciLink() {
  try {
    history.replaceState(null, '', location.href.split('#')[0])
  } catch {
    // In contesti isolati `replaceState` può essere negato: pazienza.
  }
}
