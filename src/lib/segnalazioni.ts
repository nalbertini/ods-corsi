/**
 * Le segnalazioni della segreteria: cosa non va o cosa servirebbe nell'app,
 * scritto lì dentro invece che in un documento a parte. Ognuna è un filo: chi
 * la apre scrive titolo e testo, gli altri rispondono sotto, e chi vuole la
 * chiude quando è fatta (e la riapre se serve). Col database stanno in
 * `segnalazioni` (`supabase/25-segnalazioni.sql`), in prova nell'archivio.
 *
 * Da non confondere con le presenze segnalate dagli iscritti (`segnalate.ts`).
 */
import { chiaveGiorno, giornoPerEsteso, oraDi } from './sala'

export interface Messaggio {
  id: string
  autore: string
  /** Scritto da chi sta guardando. */
  mio: boolean
  testo: string
  il: string
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
