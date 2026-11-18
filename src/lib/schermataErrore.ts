/**
 * Cosa dice la pagina quando un pezzo si blocca mentre si disegna.
 *
 * Il riquadro sta al posto della schermata bianca: dice cosa fare e cosa
 * succede a quel che è in coda, mai il testo grezzo dell'errore. Le parole e
 * i tasti si decidono qui, senza browser, perché il componente li mostra e
 * basta.
 */

import type { Area } from './aree'
import { RICARICA, tasto, type Schermata } from './schermataTimer'

export { schermataTimer, type Azione, type Schermata, type Tasto } from './schermataTimer'

export type Dispositivo = 'telefono' | 'tablet' | 'computer'

export interface StatoErrore {
  dispositivo: Dispositivo
  /** Nel tablet e per gli istruttori in coda ci sono presenze; altrove cose. */
  cosa: 'presenze' | 'cose'
  inCoda: number
  /** Scritture che il disco non ha preso: ricaricando si perdono. */
  soloInMemoria: number
  /** Un pezzo di pagina caricato al bisogno non è arrivato. */
  pezzoMancante: boolean
  /** La pagina si era già bloccata ed era stata ricaricata da poco. */
  ripetuto: boolean
  mandando: boolean
}

/** La frase sulla coda: quel che non è arrivato aspetta la rete, non si perde. */
function frasecoda(s: StatoErrore): string {
  const dove = `su questo ${s.dispositivo}`
  if (s.inCoda === 1) {
    const una = s.cosa === 'presenze' ? 'La presenza' : 'La cosa'
    return `${una} non ancora arrivata resta ${dove} e parte da sola appena c’è rete.`
  }
  return `Le ${s.inCoda} ${s.cosa} non ancora arrivate restano ${dove} e partono da sole appena c’è rete.`
}

const conCoda = (testo: string, s: StatoErrore, senza?: string) =>
  s.inCoda > 0 ? `${testo} ${frasecoda(s)}` : senza ? `${testo} ${senza}` : testo

function soloInMemoria(s: StatoErrore): Schermata {
  const uno = s.soloInMemoria === 1
  const nome = s.cosa === 'presenze' ? (uno ? 'PRESENZA' : 'PRESENZE') : uno ? 'COSA' : 'COSE'
  return {
    titolo: uno ? `1 ${nome} NON È ANCORA ARRIVATA` : `${s.soloInMemoria} ${nome} NON SONO ANCORA ARRIVATE`,
    testo: uno
      ? `Questo ${s.dispositivo} non riesce a tenerla da parte: ricaricando adesso si perde. Prima prova a mandarla.`
      : `Questo ${s.dispositivo} non riesce a tenerle da parte: ricaricando adesso si perdono. Prima prova a mandarle.`,
    tasti: [tasto(uno ? 'PROVA A MANDARLA' : 'PROVA A MANDARLE', 'manda'), tasto('RICARICA LO STESSO', 'ricaricaLoStesso', 'linea')],
  }
}

function senzaMandare(s: StatoErrore): Schermata {
  // Se si ripete, ricaricare da solo non basta: prima la segreteria.
  if (s.ripetuto)
    return { titolo: 'SUCCEDE ANCORA', testo: conCoda('Avvisa la segreteria.', s), tasti: [tasto('RICARICA', 'ricarica', 'linea')] }
  if (s.pezzoMancante)
    return {
      titolo: 'NON RIESCO A CARICARE LA PAGINA',
      testo: conCoda('Di solito è la rete o un aggiornamento appena uscito. Controlla la connessione e tocca RICARICA.', s),
      tasti: [RICARICA],
    }
  const inizio = s.dispositivo === 'tablet' ? 'Tocca RICARICA e l’appello riparte.' : 'Con RICARICA riparte da capo.'
  return {
    titolo: 'LA PAGINA SI È BLOCCATA',
    testo: conCoda(inizio, s, 'Non perdi niente di quello che è già arrivato.'),
    tasti: [RICARICA],
  }
}

export function schermataErrore(s: StatoErrore): Schermata {
  // Quel che si perderebbe ricaricando vince su tutto: prima si prova a mandarlo.
  const base = s.soloInMemoria > 0 ? soloInMemoria(s) : senzaMandare(s)
  if (!s.mandando) return base
  const etichetta = s.cosa === 'presenze' ? 'STO MANDANDO LE PRESENZE…' : 'STO MANDANDO…'
  return { ...base, tasti: [{ etichetta, azione: 'manda', variante: 'principale', disabilitato: true }] }
}

/** Dove il confine segna l'ultima volta che ha ricaricato la pagina. */
export const CHIAVE_BLOCCO = 'ods-ricaricata-per-blocco'

/** Vero se la pagina era stata ricaricata dal confine meno di 30 secondi fa. */
export function ripetuto(ultima: string | null, ora: number): boolean {
  if (!ultima) return false
  const quando = Number(ultima)
  return Number.isFinite(quando) && ora - quando <= 30_000
}

/** Dopo PROVA A MANDARLE: si ricarica solo se non resta niente da perdere. */
export function dopoAverMandato(soloInMemoria: number): 'ricarica' | 'resta' {
  return soloInMemoria > 0 ? 'resta' : 'ricarica'
}

const PEZZO = [
  'Failed to fetch dynamically imported module',
  'Importing a module script failed',
  'error loading dynamically imported module',
]

/** Un pezzo di pagina che non arriva: la rete o una pubblicazione appena uscita. */
export function eErrorePezzo(e: unknown): boolean {
  if (!(e instanceof Error)) return false
  return e.name === 'ChunkLoadError' || PEZZO.some((p) => e.message.includes(p))
}

/** Quel che la testata dice in ogni area, come nelle pagine vere. */
const LUOGO: Record<Area, string> = {
  segreteria: 'SEGRETERIA',
  amministrazione: 'AMMINISTRAZIONE',
  iscrizioni: 'ISCRIZIONI',
  iscritti: 'ISCRITTI',
  istruttori: 'ISTRUTTORI',
  sala: 'TABLET DI SALA',
  collega: 'CONTABILITÀ',
  certificato: 'CERTIFICATO MEDICO',
  guida: 'GUIDA',
  scelta: 'CORSI',
}

/**
 * Su che cosa si è bloccata la pagina. La sala è sempre il tablet; altrove
 * conta la larghezza, come per il resto dell'app. In coda ci sono presenze
 * solo dove si fa l'appello.
 */
export function doveSiBlocca(area: Area, largo: boolean): { dispositivo: Dispositivo; cosa: StatoErrore['cosa']; luogo: string } {
  const dispositivo: Dispositivo = area === 'sala' ? 'tablet' : largo ? 'computer' : 'telefono'
  const cosa = area === 'sala' || area === 'istruttori' ? 'presenze' : 'cose'
  return { dispositivo, cosa, luogo: LUOGO[area] }
}
