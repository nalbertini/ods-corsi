/**
 * La musica che suona da sé, con un <audio> della pagina: i file scelti sul
 * tablet e le radio. Niente account, niente pubblicità, niente riquadro da
 * tenere in vista come con YouTube.
 *
 * Le regole (ordine casuale, ⏮ ⏭, brano illeggibile, radio che cade) stanno in
 * `musicaLocale.ts` e si provano senza browser; qui c'è solo il suono vero.
 *
 * I file restano sul dispositivo, nella memoria del browser (IndexedDB): non
 * vanno sul server e sopravvivono a un riavvio o a un aggiornamento dell'app.
 * Il browser può cancellarli se manca spazio: lo si dice (`erroreMemoria`).
 */

import type { Lettore } from './spotify'
import { VOLUME_BLOCCATO } from './youtube'
import {
  aggiungiACoda,
  aggiungiFile,
  avantiCoda,
  codaDopoTolta,
  dopoErrore,
  erroreMemoria,
  erroreRadio,
  indietroCoda,
  nuovaCoda,
  radio as infoRadio,
  svuotaFile,
  togliFile,
  type BranoFile,
  type Coda,
} from './musicaLocale'

/* ---------- lo stato, per chi lo mostra ---------- */

export interface StatoAudio {
  /** I file scelti su questo apparecchio. */
  elenco: BranoFile[]
  lettore: Lettore | null
  errore: string | null
}

let stato: StatoAudio = { elenco: [], lettore: null, errore: null }
/** L'errore di un suono in corso, e quello dei file spariti: il primo vince. */
let erroreSuono: string | null = null
let erroreSpariti: string | null = null
const ascoltatori = new Set<() => void>()

function aggiorna(
  patch: Partial<Omit<StatoAudio, 'errore'>> & {
    suono?: string | null
    spariti?: string | null
  },
) {
  if (patch.suono !== undefined) erroreSuono = patch.suono
  if (patch.spariti !== undefined) erroreSpariti = patch.spariti
  const { suono: _s, spariti: _p, ...resto } = patch
  stato = { ...stato, ...resto, errore: erroreSuono ?? erroreSpariti }
  ascoltatori.forEach((f) => f())
}

export const statoAudio = () => stato

export function ascoltaAudio(f: () => void) {
  ascoltatori.add(f)
  return () => {
    ascoltatori.delete(f)
  }
}

/* ---------- i file, nella memoria del browser ---------- */

const CHIAVE_ATTESI = 'ods-timer:file-attesi'

interface Registrato extends BranoFile {
  blob: Blob
}

/** Una connessione sola, aperta alla prima richiesta e tenuta per tutte le altre. */
let connessione: Promise<IDBDatabase> | null = null
function apri(): Promise<IDBDatabase> {
  connessione ??= new Promise<IDBDatabase>((ok, no) => {
    const r = indexedDB.open('ods-timer-musica', 1)
    r.onupgradeneeded = () => r.result.createObjectStore('file', { keyPath: 'id' })
    r.onsuccess = () => ok(r.result)
    r.onerror = () => {
      connessione = null
      no(r.error)
    }
  })
  return connessione
}

const memoria = <T>(modo: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> =>
  apri().then(
    (db) =>
      new Promise<T>((ok, no) => {
        const r = f(db.transaction('file', modo).objectStore('file'))
        r.onsuccess = () => ok(r.result)
        r.onerror = () => no(r.error)
      }),
  )

const ricordaQuanti = (n: number) => {
  try {
    localStorage.setItem(CHIAVE_ATTESI, String(n))
  } catch {
    // Senza memoria locale non si saprà dire che i file sono spariti: pazienza.
  }
}
const quantiAttesi = () => {
  try {
    return Number(localStorage.getItem(CHIAVE_ATTESI)) || 0
  } catch {
    return 0
  }
}

/** Legge i file ricordati; se il browser li ha buttati, lo dice. */
const caricato: Promise<void> =
  typeof indexedDB === 'undefined'
    ? Promise.resolve()
    : memoria<Registrato[]>('readonly', (s) => s.getAll())
        .then((righe) => {
          aggiorna({
            elenco: righe.map(({ id, nome }) => ({ id, nome })),
            spariti: erroreMemoria(quantiAttesi(), righe.length),
          })
        })
        .catch(() => aggiorna({ spariti: erroreMemoria(quantiAttesi(), 0) }))

/** Aggiunge i file scelti dal dispositivo. Restituisce cosa dire se qualcosa non va. */
export async function aggiungiFileScelti(files: File[]): Promise<string | null> {
  await caricato
  const nuovi = files.map((f) => ({
    id: `${f.name}|${f.size}|${f.lastModified}`,
    nome: f.name,
  }))
  try {
    await Promise.all(files.map((f, i) => memoria('readwrite', (s) => s.put({ ...nuovi[i], blob: f }))))
  } catch {
    return 'Non c’è abbastanza spazio sul tablet per questi file: toglierne qualcuno e riprova.'
  }
  const prima = stato.elenco.length
  const elenco = aggiungiFile(stato.elenco, nuovi)
  ricordaQuanti(elenco.length)
  aggiorna({ elenco, spariti: null })
  if (modo === 'file' && coda) coda = aggiungiACoda(coda, elenco.length - prima, Math.random)
  else if (modo === 'file') void avviaFile(false)
  return null
}

const NON_TOLTO = 'Non riesco a togliere il file: riprova.'

/** Toglie un file. Restituisce cosa dire se non ci riesce: in quel caso l'elenco resta com'è. */
export async function togliFileScelto(id: string): Promise<string | null> {
  try {
    await memoria('readwrite', (s) => s.delete(id))
  } catch {
    return NON_TOLTO
  }
  const elenco = togliFile(stato.elenco, id)
  ricordaQuanti(elenco.length)
  aggiorna({ elenco })
  if (modo === 'file') await ripartiFile(elenco, brano?.id === id)
  return null
}

export async function svuotaFileScelti(): Promise<string | null> {
  try {
    await memoria('readwrite', (s) => s.clear())
  } catch {
    return NON_TOLTO
  }
  const elenco = svuotaFile(stato.elenco)
  ricordaQuanti(0)
  aggiorna({ elenco, spariti: null })
  if (modo === 'file') await ripartiFile(elenco, true)
  return null
}

/* ---------- il suono ---------- */

type Modo = 'file' | 'radio'
let modo: Modo | null = null
let linkRadio = ''
let nomeRadio = ''
let coda: Coda | null = null
let brano: BranoFile | null = null
let illeggibili: number[] = []
let url: string | null = null
/** Cresce a ogni cambio di fonte o di brano: una risposta in ritardo si butta. */
let giro = 0
/** Il volume mentre nessuno lo tocca, e quello di prima del recupero. */
let volumeScelto = 80
let abbassata: number | null = null

let elemento: HTMLAudioElement | null = null
function el(): HTMLAudioElement {
  if (elemento) return elemento
  const a = new Audio()
  elemento = a
  for (const e of ['play', 'pause', 'playing', 'waiting', 'volumechange']) a.addEventListener(e, leggiStato)
  a.addEventListener('ended', () => {
    if (modo === 'file') void avanti()
    else if (modo === 'radio') cade()
  })
  a.addEventListener('error', () => {
    if (!a.getAttribute('src')) return
    if (modo === 'file') void salta()
    else if (modo === 'radio') cade()
  })
  window.addEventListener('offline', () => {
    if (modo === 'radio' && !a.paused) cade()
  })
  return a
}

const senzaEstensione = (nome: string) => nome.replace(/\.[^./]+$/, '')

function leggiStato() {
  if (!modo) return
  const a = el()
  const radio = modo === 'radio'
  aggiorna({
    lettore: {
      inRiproduzione: !a.paused && !a.ended && !!a.getAttribute('src'),
      titolo: radio ? infoRadio(nomeRadio, linkRadio).titolo : senzaEstensione(brano?.nome ?? ''),
      artista: '',
      copertina: null,
      volume: VOLUME_BLOCCATO ? null : Math.round(a.volume * 100),
      dispositivo: radio ? 'Radio' : 'File del tablet',
    },
  })
}

/** La radio si è fermata da sola: dice cosa fare, e non riparte finché non si tocca «Riprova». */
function cade() {
  const a = el()
  a.pause()
  a.removeAttribute('src')
  a.load()
  aggiorna({ suono: erroreRadio().messaggio })
  leggiStato()
}

function rilascia() {
  const a = el()
  a.pause()
  a.removeAttribute('src')
  a.load()
  if (url) URL.revokeObjectURL(url)
  url = null
}

async function caricaBrano(parti: boolean) {
  if (modo !== 'file' || !coda) return
  const mio = ++giro
  const scelto = stato.elenco[coda.ordine[coda.pos]]
  if (!scelto) return
  const reg = await memoria<Registrato | undefined>('readonly', (s) => s.get(scelto.id)).catch(() => undefined)
  if (mio !== giro || modo !== 'file') return
  if (!reg) {
    void salta()
    return
  }
  const a = el()
  if (url) URL.revokeObjectURL(url)
  url = URL.createObjectURL(reg.blob)
  brano = scelto
  a.src = url
  a.volume = (abbassata ?? volumeScelto) / 100
  leggiStato()
  if (parti) void a.play().catch(() => undefined)
}

/** Il brano che c'è non si legge: si passa al prossimo, o si dice cosa fare. */
async function salta() {
  if (modo !== 'file' || !coda) return
  illeggibili = [...illeggibili, coda.ordine[coda.pos]]
  const r = dopoErrore(coda, illeggibili, Math.random)
  if ('errore' in r) {
    rilascia()
    aggiorna({ suono: r.errore })
    leggiStato()
    return
  }
  coda = r.coda
  await caricaBrano(true)
}

async function avviaFile(parti: boolean) {
  const mio = giro
  await caricato
  if (modo !== 'file' || mio !== giro) return
  illeggibili = []
  if (stato.elenco.length === 0) {
    coda = null
    brano = null
    rilascia()
    aggiorna({ lettore: null })
    return
  }
  coda = nuovaCoda(stato.elenco.length, Math.random)
  await caricaBrano(parti)
}

/** L'elenco è cambiato togliendo qualcosa: se suonava quello tolto si passa a un altro. */
async function ripartiFile(elenco: BranoFile[], eraQuello: boolean) {
  illeggibili = []
  if (elenco.length === 0) {
    coda = null
    brano = null
    rilascia()
    aggiorna({ lettore: null })
    return
  }
  const suonava = !el().paused
  coda = codaDopoTolta(elenco, eraQuello ? null : (brano?.id ?? null), Math.random)
  if (eraQuello || !brano) await caricaBrano(suonava)
}

/**
 * Prepara la musica e restituisce la funzione che la ferma. Una fonte sola
 * alla volta: chi chiama la smonta quando cambia fonte, e il suono di prima
 * si ferma e si libera.
 */
export function avvia(fonte: Modo, link: string, nome: string, parti: boolean): () => void {
  const mio = ++giro
  modo = fonte
  linkRadio = link
  nomeRadio = nome
  brano = null
  coda = null
  aggiorna({ suono: null })
  if (fonte === 'radio') {
    leggiStato()
    if (parti) void suona()
  } else void avviaFile(parti)
  return () => {
    if (giro === mio) giro++
    modo = null
    coda = null
    brano = null
    rilascia()
    aggiorna({ lettore: null, suono: null })
  }
}

/* ---------- i comandi ---------- */

export async function suona(): Promise<boolean> {
  if (!modo) return false
  const a = el()
  if (modo === 'radio' && !a.getAttribute('src')) {
    a.src = linkRadio
    a.volume = (abbassata ?? volumeScelto) / 100
  }
  try {
    await a.play()
    aggiorna({ suono: null })
    leggiStato()
    return true
  } catch (e) {
    // Il browser non fa partire l'audio senza un tocco, e un'altra richiesta
    // può interrompere questa: in tutti e due i casi non c'è un guasto da dire.
    if (e instanceof DOMException && (e.name === 'NotAllowedError' || e.name === 'AbortError')) return false
    if (modo === 'radio') cade()
    else void salta()
    return false
  }
}

export async function pausa(): Promise<boolean> {
  if (!modo) return false
  const a = el()
  a.pause()
  // Una radio in pausa non tiene il suono di prima: al ▶ riparte dal vivo.
  if (modo === 'radio') a.removeAttribute('src')
  leggiStato()
  return true
}

export async function avanti(): Promise<boolean> {
  if (modo !== 'file' || !coda) return false
  coda = avantiCoda(coda, Math.random)
  await caricaBrano(true)
  return true
}

/** Come un lettore vero: a brano iniziato si torna all'inizio, subito dopo al precedente. */
export async function indietro(): Promise<boolean> {
  if (modo !== 'file' || !coda) return false
  const r = indietroCoda(coda, el().currentTime)
  coda = r.coda
  if (r.daCapo) {
    el().currentTime = 0
    void el()
      .play()
      .catch(() => undefined)
  } else await caricaBrano(true)
  return true
}

export async function volume(percento: number): Promise<boolean> {
  if (!modo || VOLUME_BLOCCATO) return false
  const v = Math.round(Math.min(100, Math.max(0, percento)))
  if (abbassata === null) volumeScelto = v
  el().volume = v / 100
  return true
}

/* ---------- la musica che segue il timer ---------- */

export async function abbassa(percento: number) {
  if (abbassata !== null || !modo || VOLUME_BLOCCATO) return
  const v = Math.round(el().volume * 100)
  if (v <= percento) return
  abbassata = v
  el().volume = percento / 100
}

export async function rialza() {
  if (abbassata === null) return
  const v = abbassata
  abbassata = null
  if (modo) el().volume = v / 100
}
