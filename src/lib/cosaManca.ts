/**
 * La striscia COSA MANCA, in cima alle pagine di segreteria: sei conti
 * (appelli non fatti, certificati scaduti, pagamenti, corsi scaduti, tessere, richieste online), ognuno
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
import { SEGNALA_TESSERE } from './tessere'

/** Fin dove si guarda indietro per gli appelli che mancano. */
export const GIORNI_APPELLI = 30

/** Cambiando voce i conti si rileggono solo se l'ultima lettura è più vecchia di così. */
export const SECONDI_RILETTURA = 120

export type IdCasella = 'appelli' | 'certificati' | 'pagamenti' | 'corsi' | 'tessere' | 'richieste'

/** In quest'ordine, da sinistra. */
export const CASELLE: readonly IdCasella[] = ['appelli', 'certificati', 'pagamenti', 'corsi', 'tessere', 'richieste']

/** manca: rosso. attesa: giallo, c'è da accogliere. aposto: verde. nonso: grigio, non si sa. */
export type StatoCasella = 'manca' | 'attesa' | 'aposto' | 'nonso'

export interface ContiCosaManca {
  appelli: number | null
  certificati: number | null
  pagamenti: number | null
  /** Chi ha un corso scaduto o non pagato (`corsiScaduti`). Assente se le ricevute non si sono mai lette: la casella non c'è. */
  corsi?: number | null
  /** Chi è iscritto a un corso che chiede la tessera e non ne ha una valida (manca o scaduta). */
  tessere: number | null
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
  /** La nota è quella di sempre («scaduti o mancanti»), non un avviso sul conto («conto delle 10:32», «non so»): quella si vede sempre. */
  notaFissa: boolean
  /** Il nome per chi non vede lo schermo. */
  nome: string
  voce: Voce
  filtro?: FiltroSegreteria
}

const TITOLI: Record<IdCasella, string> = {
  appelli: 'Appelli non fatti',
  certificati: 'Certificati scaduti',
  pagamenti: 'Pagamenti',
  corsi: 'Corsi scaduti',
  tessere: 'Senza tessera',
  richieste: 'Richieste online',
}

/** Come si chiama il conto quando non si sa o lo si annuncia. */
const NOMI: Record<IdCasella, string> = {
  appelli: 'Appelli non fatti',
  certificati: 'Certificati scaduti',
  pagamenti: 'Pagamenti',
  corsi: 'Corsi scaduti',
  tessere: 'Senza tessera',
  richieste: 'Richieste online',
}

const NOTE: Record<IdCasella, string> = {
  appelli: `senza appello, ultimi ${GIORNI_APPELLI} giorni`,
  certificati: 'scaduti o mancanti',
  pagamenti: 'quote non in regola',
  corsi: 'trimestre o annuale finito',
  tessere: 'senza tessera valida',
  richieste: 'da accogliere',
}

const DESTINAZIONI: Record<IdCasella, { voce: Voce; filtro?: FiltroSegreteria }> = {
  appelli: { voce: 'presenze', filtro: 'senza-appello' },
  certificati: { voce: 'iscritti', filtro: 'certificato' },
  pagamenti: { voce: 'iscritti', filtro: 'pagare' },
  corsi: { voce: 'iscritti', filtro: 'corsi-scaduti' },
  tessere: { voce: 'iscritti', filtro: 'senza-tessera' },
  richieste: { voce: 'richieste' },
}

export function statoDi(id: IdCasella, n: number | null): StatoCasella {
  return n === null ? 'nonso' : n === 0 ? 'aposto' : id === 'richieste' ? 'attesa' : 'manca'
}

/** Il nome contiene il testo che si vede (titolo e nota): WCAG 2.5.3, per chi detta i comandi a voce. */
function nomeAccessibile(id: IdCasella, n: number | null, contato: boolean): string {
  if (n === null) return `${NOMI[id]}: ${contato ? 'non so, non si è riusciti a contare' : 'sto contando'}`
  if (n === 0) return `${TITOLI[id]}, ${NOTE[id]}: nessuno, a posto`
  return `${n} ${TITOLI[id]}, ${NOTE[id]}`
}

const orario = (ms: number) => new Date(ms).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', hour12: false })

export function caselleCosaManca(c: ContiCosaManca): Casella[] {
  return CASELLE.filter((id) => c[id] !== undefined).map((id) => {
    const n = c[id] ?? null
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
      notaFissa: n !== null && !c.vecchio,
      nome: nomeAccessibile(id, n, c.contato),
      ...DESTINAZIONI[id],
    }
  })
}

/** Le caselle che l'app mostra: a segnalazioni delle tessere spente, la casella TESSERE non c'è. */
export const caselleDaMostrare = (c: ContiCosaManca) => caselleCosaManca(c).filter((x) => SEGNALA_TESSERE || x.id !== 'tessere')

/** Per chi non vede lo schermo: cosa è cambiato dopo una lettura. Niente alla prima lettura, né quando un numero passa da «non so» a un valore. */
export function annuncioCambio(prima: ContiCosaManca, dopo: ContiCosaManca): string | null {
  if (!prima.contato) return null
  const frasi: string[] = []
  for (const id of CASELLE) {
    const a = prima[id]
    const b = dopo[id]
    if (a != null && b != null && a !== b) frasi.push(`${NOMI[id]}: ${b}`)
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

/**
 * DA FARE ha già gli stessi conti, più grandi; sul telefono una scheda o un modulo aperti hanno bisogno di tutto lo spazio;
 * e chi l'ha nascosta da IMPOSTAZIONI › QUESTO COMPUTER (`voluta` falso) non la vede da nessuna parte.
 */
export function strisciaVisibile(voce: string, telefono: boolean, schedaAperta: boolean, voluta = true): boolean {
  return voluta && voce !== 'dafare' && !(telefono && schedaAperta)
}

/**
 * Sul computer la striscia si vede finché non la si nasconde; sul telefono parte spenta e la accende solo chi la sceglie.
 * Un valore salvato che non è «mostrata» né «nascosta» (vuoto, vecchio, sconosciuto) lascia quello di partenza.
 */
export function leggiPreferenzaStriscia(valore: unknown, telefono = false): boolean {
  if (valore === 'nascosta') return false
  if (valore === 'mostrata') return true
  return !telefono
}

/**
 * Quello che si vede: la scelta fatta in questa pagina, se c'è, vince su quello che è salvato. Se il salvataggio non riesce
 * (quota piena, navigazione privata) il salvato resta quello di prima, e senza questa regola IMPOSTAZIONI e il resto della
 * segreteria vedrebbero due cose diverse.
 */
export function preferenzaStriscia(salvato: unknown, scelta: boolean | null, telefono = false): boolean {
  return scelta ?? leggiPreferenzaStriscia(salvato, telefono)
}

export function valorePreferenzaStriscia(voluta: boolean): string {
  return voluta ? 'mostrata' : 'nascosta'
}

/**
 * Unisce una lettura nuova ai conti di prima. Un conto che non si è riusciti a
 * leggere tiene l'ultimo numero buono e si segna vecchio; se non c'è mai stato
 * un numero resta `null`, e la striscia dice «non so», mai 0.
 */
export function mantieniIPrecedenti(
  prima: ContiCosaManca,
  letti: Pick<ContiCosaManca, 'appelli' | 'certificati' | 'pagamenti' | 'corsi' | 'tessere' | 'richieste'>,
  ora: number,
): ContiCosaManca {
  const dopo: ContiCosaManca = { appelli: null, certificati: null, pagamenti: null, tessere: null, richieste: null, contato: true }
  let qualcunoNuovo = false
  let vecchio = false
  for (const id of CASELLE) {
    const letto = letti[id]
    // I corsi possono mancare del tutto (ricevute mai lette): allora la casella resta assente.
    if (letto === undefined && prima[id] === undefined) continue
    if (letto != null) {
      dopo[id] = letto
      qualcunoNuovo = true
    } else {
      dopo[id] = prima[id] ?? null
      if (prima[id] != null) vecchio = true
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
 * I conti della striscia da quello che si è letto. Una lettura che manca
 * (`null`) dà `null`, mai 0: «a posto» detto a chi non lo sa è l'errore peggiore.
 * `tessere` sono quelle già lette con `incrocioTessere`: null se non si sa (la
 * tabella non c'è ancora, o la lettura è fallita), e allora il conto è «non so».
 */
export function contiDellaStriscia(
  letti: { persone: PersonaSeg[] | null; lezioni: LezioneSeg[] | null; richieste: number | null; tessere?: number | null; corsi?: number | null },
  adesso: number,
  oggi: string,
): Pick<ContiCosaManca, 'appelli' | 'certificati' | 'pagamenti' | 'corsi' | 'tessere' | 'richieste'> {
  return {
    appelli: letti.lezioni ? appelliSenzaSegni(letti.lezioni, adesso).length : null,
    certificati: letti.persone ? certificatiDaSistemare(letti.persone, oggi) : null,
    pagamenti: letti.persone ? pagamentiNonInRegola(letti.persone, oggi) : null,
    tessere: letti.tessere ?? null,
    richieste: letti.richieste,
    // Già contati con `corsiScaduti`; undefined: la casella non c'è.
    corsi: letti.corsi,
  }
}
