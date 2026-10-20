// ---------------------------------------------------------------------------
// IL SITO in STATISTICHE, le regole dell'app: quando rileggere, AGGIORNA,
// «si conta dal», le frasi d'errore e i numeri della modalità prova.
//
// I conti di quello che risponde GoatCounter stanno in sitoNumeri.ts, che la
// funzione `statistiche-sito` usa uguale.
// ---------------------------------------------------------------------------
import { SITO_DAL, mesiDelPeriodo, primoGiorno } from './sitoNumeri'
import type { NumeriSito } from './sitoNumeri'
import { dataLunga } from './sala'

/** I numeri restano buoni 10 minuti: STATISTICHE si apre e si chiude, GoatCounter non si richiama a ogni giro. */
export const MEMORIA_MS = 10 * 60_000
/** AGGIORNA rilegge davvero, ma non più di una volta al minuto: GoatCounter ne regge 4 al secondo, per tutti. */
export const AGGIORNA_MS = 60_000

/** Perché i numeri del sito non ci sono. */
export type TipoGuaioSito = 'non-pubblicata' | 'chiave-manca' | 'chiave-rifiutata' | 'aspetta' | 'non-risponde' | 'senza-rete' | 'accesso'

/** Quello che dice `statisticheSito` di DatiSegreteria: i numeri, o il guaio (il riquadro lo dice, gli altri restano). */
export type LetturaSito = { numeri: NumeriSito } | { guaio: TipoGuaioSito }

/** Le frasi del riquadro, una per guaio: cosa è successo e cosa fare. Mai il testo di GoatCounter. */
export const TESTI_GUAI: Record<TipoGuaioSito, { titolo: string; frase: string }> = {
  'non-pubblicata': {
    titolo: 'Il contatore non è ancora acceso',
    frase: 'Il collegamento fra l’app e il contatore del sito non c’è ancora, o la rete è debole: riprova con Aggiorna. Se non cambia, chiedi a chi segue l’app di accenderlo; intanto gli altri numeri ci sono.',
  },
  'chiave-manca': {
    titolo: 'Manca la chiave del contatore',
    frase: 'L’app non ha la chiave per leggere il contatore del sito. Chiedi a chi segue l’app di metterla.',
  },
  'chiave-rifiutata': {
    titolo: 'Il contatore non accetta la chiave',
    frase: 'La chiave per leggere il contatore è scaduta, è stata cambiata o non ha il permesso di leggere. Chiedi a chi segue l’app di metterne una nuova.',
  },
  aspetta: {
    titolo: 'Il contatore chiede di aspettare',
    frase: 'Troppe letture in poco tempo. Riprova fra qualche minuto con Aggiorna.',
  },
  'non-risponde': {
    titolo: 'Il contatore non risponde',
    frase: 'Il contatore del sito non ha risposto. Gli altri numeri della pagina sono a posto: riprova più tardi con Aggiorna.',
  },
  accesso: {
    titolo: 'L’app non ti riconosce',
    frase: 'Per leggere i numeri del sito serve l’accesso da segreteria, e il tuo è scaduto o non c’è: esci e rientra, poi tocca Aggiorna.',
  },
  'senza-rete': {
    titolo: 'Senza rete',
    frase: 'Il computer non è collegato a internet. Quando torna la rete, tocca Aggiorna.',
  },
}

const TIPI_FUNZIONE: TipoGuaioSito[] = ['chiave-manca', 'chiave-rifiutata', 'aspetta', 'non-risponde']

/**
 * Il guaio da quello che è tornato chiamando la funzione: lo `stato` HTTP e il `corpo` (già letto come JSON, se la
 * funzione ha risposto), il `nome` dell'errore (FunctionsHttpError, FunctionsFetchError…) e se il computer ha la rete.
 * Come guaioFunzione di segreteriaSupabase.ts, ma dà il tipo: la frase la sceglie TESTI_GUAI.
 */
export function tipoDaRisposta(stato: number | undefined, corpo: unknown, nome: string | undefined, rete: boolean): TipoGuaioSito {
  if (!rete) return 'senza-rete'
  const tipo = corpo && typeof corpo === 'object' && 'tipo' in corpo ? corpo.tipo : undefined
  const detto = TIPI_FUNZIONE.find((t) => t === tipo)
  if (detto) return detto
  if (stato === 401 || stato === 403) return 'accesso'
  // Non raggiunta con la rete accesa: di solito non è pubblicata, a volte è la rete debole (la frase dice tutte e due).
  if (stato === 404 || nome === 'FunctionsFetchError') return 'non-pubblicata'
  return 'non-risponde'
}

/** «Si conta dal 20 ottobre 2026» quando il periodo comincia prima; se no niente. */
export function contaDal(da: string): string | null {
  return da < SITO_DAL ? dataLunga(SITO_DAL) : null
}

/** Il mese per le colonne (`ott`) e per la tabella (`Ottobre 2026`). */
export function nomeMeseSito(mese: string): { corto: string; lungo: string } {
  // dataLunga dà «1 ottobre 2026»: il giorno si toglie.
  const lungo = dataLunga(`${mese}-01`).replace(/^1 /, '')
  return { corto: lungo.slice(0, 3), lungo: `${lungo[0].toUpperCase()}${lungo.slice(1)}` }
}

/** La nota accanto al mese nella tabella: «dal 20» se comincia a metà, «fino a oggi» se è l'ultimo (il periodo finisce oggi). */
export function notaMese(mese: string, da: string, a: string): string {
  const primo = primoGiorno(da)
  if (primo.slice(0, 7) === mese && primo.slice(8) !== '01') return `dal ${Number(primo.slice(8))}`
  if (a.slice(0, 7) === mese) return 'fino a oggi'
  return ''
}

/** «Letti alle 10:42», nell'ora di Roma. */
export function lettiAlle(quando: number): string {
  const ora = new Date(quando).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' })
  return `Letti alle ${ora}`
}

/** AGGIORNA si può toccare se non s'è letto niente o se è passato almeno un minuto dall'ultima lettura. */
export function puoAggiornare(letti: number | null, adesso: number): boolean {
  return letti === null || adesso - letti >= AGGIORNA_MS
}

/** La chiave della memoria: un periodo. Il corso scelto non c'entra: il sito è di tutta la palestra. */
export const chiaveSito = (da: string, a: string) => `${da}|${a}`

/** Quello che il riquadro mostra di un periodo: i numeri o il guaio, con l'ora della lettura. */
export type StatoSito = ({ numeri: NumeriSito } | { guaio: TipoGuaioSito }) & { letti: number }

/** Cosa fare aprendo un periodo: mostrare la memoria, leggere, o mostrare il guaio di prima e aspettare il minuto. */
export type DaLeggere = { cosa: 'memoria'; stato: StatoSito } | { cosa: 'leggi' } | { cosa: 'aspetta'; stato: StatoSito }

/**
 * La memoria delle letture, per periodo. Tiene i numeri 10 minuti e i guai fino al minuto dopo (riaprire STATISTICHE
 * dopo un errore non richiama subito). Ogni lettura arrivata si salva per il suo periodo, anche se intanto se ne
 * guarda un altro. Il tempo si passa da fuori, così la regola si prova senza aspettare.
 */
export function creaMemoria() {
  const dentro = new Map<string, StatoSito>()
  return {
    /** Cosa fare aprendo il periodo `chiave` adesso. */
    daLeggere(chiave: string, adesso: number): DaLeggere {
      const x = dentro.get(chiave)
      if (!x) return { cosa: 'leggi' }
      if ('numeri' in x) return adesso - x.letti < MEMORIA_MS ? { cosa: 'memoria', stato: x } : { cosa: 'leggi' }
      return puoAggiornare(x.letti, adesso) ? { cosa: 'leggi' } : { cosa: 'aspetta', stato: x }
    },
    /** Una lettura arrivata: i numeri o il guaio, per il periodo per cui era partita. */
    ricevuto(chiave: string, lettura: LetturaSito, adesso: number) {
      dentro.set(chiave, { ...lettura, letti: adesso })
    },
    /** L'ultima lettura del periodo, riuscita o no: AGGIORNA aspetta un minuto da lì. */
    ultima(chiave: string): number | null {
      return dentro.get(chiave)?.letti ?? null
    },
    /** Quanti millisecondi mancano perché AGGIORNA si possa toccare: 0 se si può già. */
    aggiornaFra(chiave: string, adesso: number): number {
      const x = dentro.get(chiave)?.letti
      return x === undefined || puoAggiornare(x, adesso) ? 0 : x + AGGIORNA_MS - adesso
    },
    /** I numeri ancora buoni del periodo, se ci sono. */
    leggi(chiave: string, adesso: number): { numeri: NumeriSito; letti: number } | undefined {
      const x = dentro.get(chiave)
      return x && 'numeri' in x && adesso - x.letti < MEMORIA_MS ? { numeri: x.numeri, letti: x.letti } : undefined
    },
    salva(chiave: string, numeri: NumeriSito, adesso: number) {
      dentro.set(chiave, { numeri, letti: adesso })
    },
  }
}

/** Quante visite in un mese della prova: un'altalena fissa, più alta a settembre e a gennaio come le iscrizioni. */
const PESO_MESE = [1.4, 1.0, 0.9, 0.8, 0.7, 0.5, 0.3, 0.2, 1.5, 1.2, 1.1, 0.8]
const PAGINE_PROVA: Array<[string, string, number]> = [
  ['Home', '/', 0.63],
  ['I corsi', '/corsi', 0.3],
  ['Judo', '/corsi/judo', 0.22],
  ['Orari', '/orari', 0.18],
  ['Karate', '/corsi/karate', 0.14],
]
const PROVENIENZE_PROVA: Array<[string, number]> = [
  ['Google', 0.42],
  ['Instagram', 0.15],
  ['Facebook', 0.09],
  ['Bing', 0.014],
  ['Pagine Gialle', 0.011],
]

const giorniNelMese = (mese: string) => {
  const [a, m] = mese.split('-').map(Number)
  return new Date(Date.UTC(a, m, 0)).getUTCDate()
}

/**
 * I numeri della modalità prova: inventati, sempre gli stessi, in proporzione ai giorni del periodo (dal 20 ottobre
 * 2026, come i veri). Nessuna chiamata.
 */
export function numeriDiProva(da: string, a: string): NumeriSito {
  const primo = primoGiorno(da)
  const mesi = mesiDelPeriodo(da, a).map((mese) => {
    const tutti = giorniNelMese(mese)
    const dal = primo.slice(0, 7) === mese ? Number(primo.slice(8)) : 1
    const al = a.slice(0, 7) === mese ? Number(a.slice(8)) : tutti
    const parte = Math.max(0, al - dal + 1) / tutti
    const visite = Math.round(1200 * PESO_MESE[Number(mese.slice(5)) - 1] * parte)
    return { mese, visite, iscriviti: Math.round(visite * 0.022), chiama: Math.round(visite * 0.011), scrivici: Math.round(visite * 0.026) }
  })
  const visite = mesi.reduce((s, m) => s + m.visite, 0)
  const conti = (k: 'iscriviti' | 'chiama' | 'scrivici') => mesi.reduce((s, m) => s + m[k], 0)
  return {
    mesi,
    visite,
    iscriviti: conti('iscriviti'),
    chiama: conti('chiama'),
    scrivici: conti('scrivici'),
    pagine: PAGINE_PROVA.map(([titolo, percorso, k]) => ({ titolo, percorso, visite: Math.round(visite * k) })),
    altrePagine: { quante: 9, visite: Math.round(visite * 0.32) },
    provenienze: PROVENIENZE_PROVA.map(([nome, k]) => ({ nome, visite: Math.round(visite * k) })),
    altreProvenienze: { quante: 7, visite: Math.round(visite * 0.008) },
    diretto: Math.round(visite * 0.3),
    prova: true,
  }
}
