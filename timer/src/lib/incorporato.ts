import type { SegmentKind, Settings } from '../types'
import type { Lezione } from './lezione'
import type { Status } from './useTimer'

/**
 * Il timer dentro il tablet di sala.
 *
 * Da solo il timer è un'app intera, con il suo tasto SALA per tornare al
 * tablet. Sul tablet è una scheda accanto alle presenze: resta montato anche
 * quando si guarda altro, così un allenamento in corso continua mentre chi
 * arriva tardi si segna, e il tablet ne mostra lo stato nella sua testata.
 * La musica sta nella barra del tablet, sempre allo stesso posto, e la sceglie
 * la sala: le impostazioni del timer valgono finché non se ne sceglie un'altra.
 */
export interface Incorporato {
  /** La lezione in cui ci si segna adesso: in cima i timer del suo corso. */
  lezione: Lezione | null
  /** Fonte e link della musica scelti in sala, al posto di quelli delle impostazioni. */
  musica: Pick<Settings, 'musicaFonte' | 'youtube'>
  /** Si sta guardando la scheda del timer: senza, la tastiera non lo comanda. */
  visibile: boolean
  onStato: (s: StatoTimer | null) => void
  onSettings: (s: Settings) => void
}

/** L'allenamento aperto, per chi lo guarda da fuori. */
export interface StatoTimer {
  nome: string
  status: Status
  /** Il tipo di intervallo, che fa il colore; nullo prima di partire. */
  kind: SegmentKind | null
  /** «LAVORO», «RECUPERO»…, come lo dice il timer. */
  etichetta: string
  /** I secondi mostrati, quelli del quadrante. */
  secondi: number
  /** «GIRO 3/8», se c'è più di un giro. */
  conto: string
}
