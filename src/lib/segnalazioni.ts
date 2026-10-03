/**
 * Le segnalazioni della segreteria: cosa non va o cosa servirebbe nell'app,
 * scritto lì dentro invece che in un documento a parte. Ognuna è un filo: chi
 * la apre scrive titolo e testo, gli altri rispondono sotto, e chi vuole la
 * chiude quando è fatta (e la riapre se serve). Col database stanno in
 * `segnalazioni` (`supabase/25-segnalazioni.sql`), in prova nell'archivio.
 *
 * Da non confondere con le presenze segnalate dagli iscritti (`segnalate.ts`).
 */
import { ESTENSIONI, MASSIMO_FILE } from './richieste'
import { chiaveGiorno, giornoPerEsteso, oraDi } from './sala'

export interface Messaggio {
  id: string
  autore: string
  /** Scritto da chi sta guardando. */
  mio: boolean
  testo: string
  il: string
  allegati?: Allegato[]
  /** Chi ha tolto un allegato e quando, non cosa: nel filo si vede che mancava un pezzo. */
  tolti?: { da: string; il: string }[]
}

export interface Segnalazione {
  id: string
  titolo: string
  /** Il primo è quello che la apre, poi le risposte in ordine. */
  messaggi: Messaggio[]
  chiusaIl?: string
}

export const MAX_TITOLO = 120
export const MAX_TESTO = 4000

/** Perché non si può scrivere, o `null` se si può. Senza titolo è una risposta. */
export function cosaNonVaSegnalazione(testo: string, titolo?: string): string | null {
  if (titolo !== undefined) {
    if (!titolo.trim()) return 'Manca il titolo'
    const lungo = troppoLungo('Titolo', titolo, MAX_TITOLO)
    if (lungo) return lungo
  }
  if (!testo.trim()) return 'Manca il testo'
  return troppoLungo('Testo', testo, MAX_TESTO)
}

/** L'ultimo messaggio di un filo. */
export const ultimo = (s: Segnalazione) => s.messaggi[s.messaggi.length - 1]

/** Aperta, e l'ultimo a scrivere è un altro: tocca a chi guarda rispondere. */
export const tocca = (s: Segnalazione) => !s.chiusaIl && !ultimo(s).mio

/** Prima quelle che aspettano una tua risposta, poi le altre aperte, poi le chiuse; in ognuna dalla più mossa di recente. */
const gruppo = (s: Segnalazione) => (tocca(s) ? 0 : s.chiusaIl ? 2 : 1)
export const ordinaSegnalazioni = (l: Segnalazione[]) =>
  [...l].sort((x, y) => gruppo(x) - gruppo(y) || ultimo(y).il.localeCompare(ultimo(x).il))

/**
 * Il tasto che chiude dice prima di toccarlo se manda anche la risposta
 * scritta: un messaggio mandato non si cambia più.
 */
export const etichettaChiudi = (bozza: string) => (bozza.trim() ? 'MANDA E CHIUDI' : 'È FATTA, CHIUDILA')

/**
 * Chiude un filo senza buttare la risposta scritta: se c'è, la manda prima.
 * Se l'invio non va il filo resta aperto (e la bozza nel campo). Se la
 * risposta parte ma la chiusura no, non è un errore da ripetere per intero:
 * lo dice `chiusa: false`, così non si manda la stessa risposta due volte.
 */
export async function chiudiConRisposta(
  d: { rispondiSegnalazione(id: string, testo: string): Promise<unknown>; chiudiSegnalazione(id: string, chiusa: boolean): Promise<unknown> },
  id: string,
  bozza: string,
): Promise<{ mandata: boolean; chiusa: boolean }> {
  const mandata = !!bozza.trim()
  if (mandata) await d.rispondiSegnalazione(id, bozza)
  try {
    await d.chiudiSegnalazione(id, true)
  } catch (e) {
    if (!mandata) throw e
    return { mandata, chiusa: false }
  }
  return { mandata, chiusa: true }
}

/**
 * Quali fili si vedono: le aperte, e le chiuse con ANCHE LE CHIUSE. Quelle
 * appena chiuse (`tenute`) restano in fondo fino al prossimo caricamento:
 * chi chiude per sbaglio le ha ancora sotto gli occhi.
 */
export const visibili = (tutte: Segnalazione[], ancheChiuse: boolean, tenute: ReadonlySet<string>) =>
  ordinaSegnalazioni(tutte.filter((x) => !x.chiusaIl || ancheChiuse || tenute.has(x.id)))

/** Un campo oltre il massimo detto con quanto togliere, o `null`. */
export function troppoLungo(cosa: string, testo: string, max: number): string | null {
  const n = testo.trim().length - max
  return n > 0 ? `${cosa} troppo lungo: togli ${n} ${n === 1 ? 'carattere' : 'caratteri'} (massimo ${max})` : null
}

/**
 * L'avviso dopo la chiusura. Due frasi, perché RIAPRI accanto riapre la
 * segnalazione ma non ritira la risposta: un messaggio mandato resta.
 */
export function avvisoChiusura(esito: { mandata: boolean; chiusa: boolean }): string {
  if (!esito.chiusa) return `La risposta è andata, la segnalazione è ancora aperta: tocca di nuovo ${etichettaChiudi('')}.`
  return esito.mandata ? 'Risposta mandata. Segnalazione chiusa.' : 'Segnalazione chiusa.'
}

/** Quando, come lo dice la segreteria: «sabato 26 settembre, 12:00». */
export const quando = (iso: string) => `${giornoPerEsteso(chiaveGiorno(new Date(iso)))}, ${oraDi(iso)}`

/**
 * La riga sotto il titolo di un filo. Sempre il nome, mai «tu»: al banco
 * l'accesso è uno solo per tutta la segreteria.
 */
export function rigaFilo(s: Segnalazione): string {
  const primo = s.messaggi[0]
  const risposte = s.messaggi.length - 1
  if (!risposte) return `${primo.autore} · ${quando(primo.il)}`
  const u = ultimo(s)
  return `${primo.autore} · ${risposte === 1 ? 'una risposta' : `${risposte} risposte`} · ultimo di ${u.autore}, ${quando(u.il)}`
}

/**
 * Perché un tasto che manda è spento, da scrivere accanto. Niente mentre
 * lavora, e niente per un testo troppo lungo: lo dice già la nota sotto il campo.
 */
export function motivoSpento(o: { titolo?: string; testo: string; lavora: boolean; risposta?: boolean }): string | null {
  if (o.lavora) return null
  if (o.risposta) return o.testo.trim() ? null : 'Scrivi la risposta'
  if (!o.titolo?.trim()) return 'Scrivi il titolo'
  return o.testo.trim() ? null : 'Scrivi cosa non va'
}

/*
 * Le bozze: quello che si sta scrivendo resta se si cambia voce e si torna.
 * In sessionStorage, cioè solo in quella scheda finché è aperta, e mai sul
 * server: possono avere nomi di iscritti, anche minori. ESCI le toglie.
 * Senza Storage (bloccato, pieno) si scrive lo stesso, solo senza bozze.
 */
const BOZZA = 'ods-corsi:bozza:'

/** Lo Storage della scheda, o `undefined` se il browser lo blocca (anche solo a leggerlo). */
export function sessione(): Storage | undefined {
  try {
    return window.sessionStorage
  } catch {
    return undefined
  }
}

export const chiaveBozza = (modo: string, campo: string) => `${BOZZA}${modo}:${campo}`

export function leggiBozza(st: Storage | undefined, chiave: string): string {
  try {
    return st?.getItem(chiave) ?? ''
  } catch {
    return ''
  }
}

export function scriviBozza(st: Storage | undefined, chiave: string, valore: string) {
  try {
    if (valore.trim()) st?.setItem(chiave, valore)
    else st?.removeItem(chiave)
  } catch {
    // Pieno o bloccato: la bozza resta nel campo finché la schermata è aperta.
  }
}

export function svuotaBozze(st: Storage | undefined) {
  try {
    if (!st) return
    const chiavi: string[] = []
    for (let i = 0; i < st.length; i++) {
      const k = st.key(i)
      if (k?.startsWith(BOZZA)) chiavi.push(k)
    }
    chiavi.forEach((k) => st.removeItem(k))
  } catch {
    // Come sopra: niente da togliere se lo Storage non c'è.
  }
}

/** La chiave della risposta a metà di un filo. */
export const chiaveRisposta = (modo: string, id: string) => chiaveBozza(modo, `risposta-${id}`)

/**
 * I fili con una risposta a metà: si segnano BOZZA, e una chiusa con la
 * bozza resta in vista come le appena chiuse, se no la bozza muore nascosta.
 */
export const conBozza = (st: Storage | undefined, modo: string, ids: string[]): Set<string> =>
  new Set(ids.filter((id) => leggiBozza(st, chiaveRisposta(modo, id)).trim()))

/*
 * I file: foto, screenshot e PDF, fino a 3 per messaggio, in un contenitore
 * privato (`supabase/32-segnalazioni-allegati.sql`). Stessi tipi e peso
 * dell'iscrizione (`richieste.ts`); il database li controlla di nuovo.
 */
export const MAX_ALLEGATI = 3
const MAX_NOME = 200

export interface Allegato {
  id: string
  nome: string
  tipo: string
  peso: number
  /** Mandato da chi sta guardando: solo lui lo può togliere. */
  mio: boolean
}

/** Un file allegato che non è partito: il messaggio c'è, i file detti qui no. */
export class AllegatiNonPartiti extends Error {
  constructor(
    readonly id: string,
    readonly nomi: string[],
  ) {
    super(`Il messaggio è partito, ma non ${nomi.length === 1 ? 'questo file' : 'questi file'}: ${nomi.join(', ')}`)
  }
}

/** Perché un file non si può allegare, o `null`. `gia` sono quelli già scelti per lo stesso messaggio. */
export function cosaNonVaAllegato(f: { name: string; type: string; size: number }, gia: number): string | null {
  if (gia >= MAX_ALLEGATI) return `Si allegano al massimo ${MAX_ALLEGATI} file per messaggio: togline uno prima di aggiungere «${f.name}»`
  if (!ESTENSIONI[f.type]) return `«${f.name}» non si può allegare: vanno bene foto (JPEG, PNG, WebP, HEIC) e PDF. Mandane un altro`
  if (!f.size) return `«${f.name}» è vuoto. Mandane un altro`
  if (f.size > MASSIMO_FILE) return `«${f.name}» pesa ${Math.ceil(f.size / 1024 / 1024)} MB: il massimo è ${MASSIMO_FILE / 1024 / 1024}. Rimpiccioliscilo o mandane un altro`
  if (f.name.length > MAX_NOME) return `Il nome di questo file è troppo lungo (massimo ${MAX_NOME} caratteri): rinominalo o mandane un altro`
  return null
}

/** Un file senza nome vero (lo screenshot incollato arriva come «image.png») prende quello dell'ora. */
export function nomeAllegato(f: { name: string; type: string }, adesso: Date): string {
  if (f.name && !/^image\.\w+$/i.test(f.name)) return f.name
  const due = (n: number) => String(n).padStart(2, '0')
  const giorno = `${adesso.getFullYear()}-${due(adesso.getMonth() + 1)}-${due(adesso.getDate())}-${due(adesso.getHours())}${due(adesso.getMinutes())}`
  return `schermata-${giorno}.${ESTENSIONI[f.type] ?? 'png'}`
}

/** Due file con lo stesso nome nello stesso messaggio si sovrascriverebbero: il secondo diventa «nome (2).png». */
export function nomeUnico(nome: string, presenti: string[]): string {
  if (!presenti.includes(nome)) return nome
  const punto = nome.lastIndexOf('.')
  const [base, est] = punto > 0 ? [nome.slice(0, punto), nome.slice(punto)] : [nome, '']
  let n = 2
  while (presenti.includes(`${base} (${n})${est}`)) n++
  return `${base} (${n})${est}`
}

/**
 * I file scelti per un messaggio, con quelli nuovi: entrano quelli che vanno.
 * Del resto si dice il primo guaio, e quanti altri sono (se no a un file
 * scartato dopo l'altro se ne leggerebbe uno solo).
 */
export function scegliAllegati<F extends { name: string; type: string; size: number }>(gia: F[], nuovi: F[]): { dentro: F[]; guaio: string } {
  const dentro = [...gia]
  const guai: string[] = []
  for (const f of nuovi) {
    const no = cosaNonVaAllegato(f, dentro.length)
    if (no) guai.push(no)
    else dentro.push(f)
  }
  const altri = guai.length - 1
  return { dentro, guaio: guai.length ? guai[0] + (altri > 0 ? ` (e altri ${altri} file)` : '') : '' }
}

/** Il primo guaio di un elenco di file scelti, ognuno guardato con quelli che lo precedono. */
export const guaioAllegati = (files: { name: string; type: string; size: number }[]) => files.map((f, i) => cosaNonVaAllegato(f, i)).find(Boolean) ?? null

/** I nomi con cui i file vanno nel contenitore: quelli senza nome vero prendono l'ora, e due uguali non si sovrascrivono. */
export function nomiAllegati(files: { name: string; type: string }[], adesso: Date): string[] {
  const nomi: string[] = []
  for (const f of files) nomi.push(nomeUnico(nomeAllegato(f, adesso), nomi))
  return nomi
}

/** Il disegno dell'anteprima: HEIC e HEIF il browser quasi mai li mostra, i PDF non sono immagini. */
export const haAnteprima = (tipo: string) => /^image\/(jpeg|png|webp)$/.test(tipo)

/** Carica i file di un messaggio già partito, uno per uno, e dice i nomi di quelli che non sono partiti: il messaggio non si rimanda. */
export async function mandaAllegati<F extends { name: string }>(files: F[], carica: (f: F) => Promise<boolean>): Promise<string[]> {
  const falliti: string[] = []
  for (const f of files) if (!(await carica(f))) falliti.push(f.name)
  return falliti
}

export const avvisoNonPartiti = (nomi: string[]) => `Messaggio mandato, ma non è partito: ${nomi.join(', ')}. Allegalo a una nuova risposta.`

/** Trenta giorni dopo la chiusura del filo gli allegati si tolgono (il testo resta). */
export const allegatiScaduti = (chiusaIl: string | undefined, adesso: string): boolean =>
  !!chiusaIl && new Date(adesso).getTime() - new Date(chiusaIl).getTime() >= 30 * 24 * 3600 * 1000

/** Accanto a MANDA: un file senza rete non parte, e il testo lo stesso. */
export const motivoSenzaRete = (online: boolean, nFile: number): string | null => (!online && nFile ? 'Niente rete: il file non parte' : null)
