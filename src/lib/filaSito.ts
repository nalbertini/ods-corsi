// La fila DAL SITO ALLE RICHIESTE di STATISTICHE: visite → tocchi su Iscriviti → richieste dal sito → accolte.
// Visite e tocchi sono quelli di IL SITO (NumeriSito), le richieste quelle di DA DOVE ARRIVANO LE RICHIESTE
// (righe di `richieste_da_dove()`): la fila non legge niente di suo. Il corso scelto non conta, perché il sito è
// di tutta la palestra. Le richieste si contano dal 20 ottobre 2026 come il contatore: prima non si contavano.
// Design: docs/design-canvas/fila-sito/.
import { DA_AREA_ISCRITTI, DA_SEGRETERIA, type RigaDaDove } from './provenienza'
import type { NumeriSito } from './sitoNumeri'

/**
 * Una richiesta è «dal sito» se il modulo è stato aperto da una pagina del sito: la Home, un corso, o una pagina
 * (anche col vecchio indirizzo, che sta nei titoli coi rinvii). Un link del sito mandato su WhatsApp conta anche
 * lui: non si distingue. Il link della segreteria e l'area iscritti no, anche se una pagina avesse lo stesso nome.
 */
export function eDalSito(etichetta: string | null | undefined, titoli: Readonly<Record<string, string>>): boolean {
  if (!etichetta || etichetta === DA_SEGRETERIA || etichetta === DA_AREA_ISCRITTI) return false
  return etichetta === 'home' || etichetta.startsWith('corso-') || etichetta in titoli
}

/** Quanti passano da un gradino al dopo: «—» se il primo è zero o non si sa, «meno dell'1%», oltre il 100% non si tronca. */
export function percentuale(da: number | null, a: number | null): string {
  if (da === null || a === null || da === 0) return '—'
  const p = (100 * a) / da
  return p > 0 && p < 1 ? "meno dell'1%" : `${Math.round(p)}%`
}

export interface Fila {
  /** `null`: non si sa (il contatore non ha risposto, o manca 74-provenienza-richieste.sql). */
  visite: number | null
  tocchi: number | null
  /** Per persona, arrivate nel periodo in ogni stato. */
  richieste: number | null
  /** Per persona, nello stato di oggi. */
  accolte: number | null
  /** Visite → tocchi, tocchi → richieste, richieste → accolte. */
  passaggi: [string, string, string]
  /** Le richieste sono più dei tocchi: lo si spiega (famiglie, link mandati da un amico). */
  oltre: boolean
}

/** I quattro gradini; `numeri` o `righe` a `null` lasciano non saputa solo la loro metà. */
export function contaFila(numeri: NumeriSito | null, righe: RigaDaDove[] | null, titoli: Readonly<Record<string, string>>): Fila {
  const visite = numeri ? numeri.visite : null
  const tocchi = numeri ? numeri.iscriviti : null
  let richieste: number | null = null
  let accolte: number | null = null
  if (righe) {
    const dalSito = righe.filter((r) => eDalSito(r.provenienza, titoli))
    richieste = dalSito.reduce((s, r) => s + r.n, 0)
    accolte = dalSito.reduce((s, r) => s + (r.stato === 'accolta' ? r.n : 0), 0)
  }
  return {
    visite,
    tocchi,
    richieste,
    accolte,
    passaggi: [percentuale(visite, tocchi), percentuale(tocchi, richieste), percentuale(richieste, accolte)],
    oltre: tocchi !== null && richieste !== null && tocchi > 0 && richieste > tocchi,
  }
}
