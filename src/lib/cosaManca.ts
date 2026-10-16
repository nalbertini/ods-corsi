/**
 * La striscia COSA MANCA, in cima alle pagine di segreteria: quattro conti
 * (appelli non fatti, certificati scaduti, pagamenti, richieste online), ognuno
 * col suo colore e la sua destinazione. Qui sta tutto quello che si decide
 * senza schermo: cosa dice ogni casella, quando il numero non si sa, quando
 * si rileggono i conti, quando la striscia si vede.
 *
 * Il numero si legge sempre dagli stessi conti di DA FARE (`useDaFare`): qui
 * non se ne contano di nuovi. Mai uno 0 verde quando non si sa: sarebbe il
 * peggior errore possibile, «a posto» detto a chi non lo sa.
 */

import type { FiltroSegreteria, Voce } from './indirizzoSegreteria'
import { comePaga, senzaCertificatoValido, type LezioneSeg, type PersonaSeg } from './segreteria'

/** Fin dove si guarda indietro per gli appelli che mancano. */
export const GIORNI_APPELLI = 30

/** Cambiando voce i conti si rileggono solo se l'ultima lettura è più vecchia di così. */
export const SECONDI_RILETTURA = 120

export type IdCasella = 'appelli' | 'certificati' | 'pagamenti' | 'richieste'

/** In quest'ordine, da sinistra. */
export const CASELLE: readonly IdCasella[] = ['appelli', 'certificati', 'pagamenti', 'richieste']

/** manca: rosso. attesa: giallo, c'è da accogliere. aposto: verde. nonso: grigio, non si sa. */
export type StatoCasella = 'manca' | 'attesa' | 'aposto' | 'nonso'

export interface ContiCosaManca {
  appelli: number | null
  certificati: number | null
  pagamenti: number | null
  richieste: number | null
  /** La prima lettura è finita (anche se fallita): da qui un `null` vuol dire «non si è riusciti», non «aspetto». */
  contato: boolean
  /** ms: l'ultima lettura riuscita. */
  aggiornato?: number
  /** L'ultima lettura è fallita e almeno un numero è quello di prima. */
  vecchio?: boolean
}

export interface Casella {
  id: IdCasella
  titolo: string
  n: number | null
  /** Quello che si scrive in grande: «3», «✓ 0» o «—». */
  numero: string
  stato: StatoCasella
  nota: string
  /** Il nome per chi non vede lo schermo. */
  nome: string
  voce: Voce
  filtro?: FiltroSegreteria
}

const TITOLI: Record<IdCasella, string> = {
  appelli: 'APPELLI NON FATTI',
  certificati: 'CERTIFICATI SCADUTI',
  pagamenti: 'PAGAMENTI',
  richieste: 'RICHIESTE ONLINE',
}

/** Come si chiama il conto quando non si sa o lo si annuncia. */
const NOMI: Record<IdCasella, string> = {
  appelli: 'Appelli non fatti',
  certificati: 'Certificati scaduti',
  pagamenti: 'Pagamenti',
  richieste: 'Richieste online',
}

const NOTE: Record<IdCasella, string> = {
  appelli: `senza appello, ultimi ${GIORNI_APPELLI} giorni`,
  certificati: 'scaduti o mancanti',
  pagamenti: 'quote non in regola',
  richieste: 'da accogliere',
}

const DESTINAZIONI: Record<IdCasella, { voce: Voce; filtro?: FiltroSegreteria }> = {
  appelli: { voce: 'presenze', filtro: 'senza-appello' },
  certificati: { voce: 'iscritti', filtro: 'certificato' },
  pagamenti: { voce: 'iscritti', filtro: 'pagare' },
  richieste: { voce: 'richieste' },
}

export function statoDi(id: IdCasella, n: number | null): StatoCasella {
  return n === null ? 'nonso' : n === 0 ? 'aposto' : id === 'richieste' ? 'attesa' : 'manca'
}

const plurale = (n: number, uno: string, tanti: string) => (n === 1 ? `1 ${uno}` : `${n} ${tanti}`)

function nomeAccessibile(id: IdCasella, n: number | null, contato: boolean): string {
  if (n === null) return `${NOMI[id]}: ${contato ? 'non so, non si è riusciti a contare' : 'sto contando'}`
  if (n === 0) {
    return {
      appelli: 'Nessun appello non fatto: a posto',
      certificati: 'Nessun certificato scaduto o mancante: a posto',
      pagamenti: 'Nessun pagamento non in regola: a posto',
      richieste: 'Nessuna richiesta online da accogliere: a posto',
    }[id]
  }
  return {
    appelli: `${plurale(n, 'appello non fatto', 'appelli non fatti')}, ${NOTE.appelli}`,
    certificati: plurale(n, 'certificato scaduto o mancante', 'certificati scaduti o mancanti'),
    pagamenti: plurale(n, 'pagamento non in regola', 'pagamenti non in regola'),
    richieste: plurale(n, 'richiesta online da accogliere', 'richieste online da accogliere'),
  }[id]
}

const orario = (ms: number) => new Date(ms).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', hour12: false })

export function caselleCosaManca(c: ContiCosaManca): Casella[] {
  return CASELLE.map((id) => {
    const n = c[id]
    const nota =
      n === null
        ? c.contato
          ? 'non so: riconta'
          : 'conto…'
        : c.vecchio
          ? c.aggiornato !== undefined
            ? `conto delle ${orario(c.aggiornato)}`
            : 'conto vecchio'
          : NOTE[id]
    return {
      id,
      titolo: TITOLI[id],
      n,
      numero: n === null ? '—' : n === 0 ? '✓ 0' : String(n),
      stato: statoDi(id, n),
      nota,
      nome: nomeAccessibile(id, n, c.contato),
      ...DESTINAZIONI[id],
    }
  })
}

/** Per chi non vede lo schermo: cosa è cambiato dopo una lettura. Niente alla prima lettura, né quando un numero passa da «non so» a un valore. */
export function annuncioCambio(prima: ContiCosaManca, dopo: ContiCosaManca): string | null {
  if (!prima.contato) return null
  const frasi: string[] = []
  for (const id of CASELLE) {
    const a = prima[id]
    const b = dopo[id]
    if (a !== null && b !== null && a !== b) frasi.push(`${NOMI[id]}: ${b}`)
  }
  return frasi.length ? frasi.join('. ') : null
}

/**
 * I conti leggono tutte le persone e 30 giorni di lezioni: all'avvio, dopo una
 * modifica e a RICONTA si rileggono sempre; cambiando voce solo se l'ultima
 * lettura è vecchia, se no ogni tocco sul menu sarebbe una lettura.
 */
export function contiDaRileggere(ultima: number | undefined, ora: number, motivo: 'avvio' | 'cambiato' | 'voce' | 'riprova'): boolean {
  if (motivo !== 'voce') return true
  return ultima === undefined || ora - ultima >= SECONDI_RILETTURA * 1000
}

/** DA FARE ha già gli stessi conti, più grandi; sul telefono una scheda o un modulo aperti hanno bisogno di tutto lo spazio. */
export function strisciaVisibile(voce: string, telefono: boolean, schedaAperta: boolean): boolean {
  return voce !== 'dafare' && !(telefono && schedaAperta)
}

/**
 * Unisce una lettura nuova ai conti di prima. Un conto che non si è riusciti a
 * leggere tiene l'ultimo numero buono e si segna vecchio; se non c'è mai stato
 * un numero resta `null`, e la striscia dice «non so», mai 0.
 */
export function mantieniIPrecedenti(
  prima: ContiCosaManca,
  letti: Pick<ContiCosaManca, 'appelli' | 'certificati' | 'pagamenti' | 'richieste'>,
  ora: number,
): ContiCosaManca {
  const dopo: ContiCosaManca = { appelli: null, certificati: null, pagamenti: null, richieste: null, contato: true }
  let qualcunoNuovo = false
  let vecchio = false
  for (const id of CASELLE) {
    if (letti[id] !== null) {
      dopo[id] = letti[id]
      qualcunoNuovo = true
    } else {
      dopo[id] = prima[id]
      if (prima[id] !== null) vecchio = true
    }
  }
  // L'orario è quello dell'ultima lettura intera: se qualcosa è di prima, i numeri vecchi dicono da quando.
  const aggiornato = vecchio ? prima.aggiornato : qualcunoNuovo ? ora : prima.aggiornato
  if (aggiornato !== undefined) dopo.aggiornato = aggiornato
  dopo.vecchio = vecchio
  return dopo
}

/**
 * Gli appelli che mancano: lezioni già finite, non annullate, con nessuno segnato,
 * le più recenti per prime. È la regola di DA FARE: la striscia dice lo stesso numero.
 */
export function appelliSenzaSegni(lezioni: LezioneSeg[], adesso: number): LezioneSeg[] {
  return lezioni.filter((l) => Date.parse(l.fine) < adesso && l.stato !== 'annullata' && l.segnati === 0).sort((a, b) => b.inizio.localeCompare(a.inizio))
}

/** Fra chi è attivo, chi non ha il certificato valido (mancante o scaduto): le righe del filtro di ISCRITTI. */
export function certificatiDaSistemare(persone: PersonaSeg[], oggi: string): number {
  return persone.filter((p) => p.attiva && senzaCertificatoValido(p, oggi)).length
}

/** Fra chi è attivo, chi non è in regola con la quota: le righe del filtro DA PAGARE di ISCRITTI. */
export function pagamentiNonInRegola(persone: PersonaSeg[], oggi: string): number {
  return persone.filter((p) => p.attiva && comePaga(p, oggi) !== 'pagato').length
}

/**
 * I quattro conti della striscia da quello che si è letto. Una lettura che manca
 * (`null`) dà `null`, mai 0: «a posto» detto a chi non lo sa è l'errore peggiore.
 */
export function contiDellaStriscia(
  letti: { persone: PersonaSeg[] | null; lezioni: LezioneSeg[] | null; richieste: number | null },
  adesso: number,
  oggi: string,
): Pick<ContiCosaManca, 'appelli' | 'certificati' | 'pagamenti' | 'richieste'> {
  return {
    appelli: letti.lezioni ? appelliSenzaSegni(letti.lezioni, adesso).length : null,
    certificati: letti.persone ? certificatiDaSistemare(letti.persone, oggi) : null,
    pagamenti: letti.persone ? pagamentiNonInRegola(letti.persone, oggi) : null,
    richieste: letti.richieste,
  }
}
