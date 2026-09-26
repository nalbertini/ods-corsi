import type { SegmentKind, Settings } from '../types'
import type { Lezione } from './lezione'
import type { Status } from './useTimer'
import type { ImpostazioniSala } from './impostazioniSala'

/**
 * Il timer dentro il tablet di sala.
 *
 * Da solo il timer è un'app intera, con il suo tasto SALA per tornare al
 * tablet. Sul tablet è una scheda accanto alle presenze: resta montato anche
 * quando si guarda altro, così un allenamento in corso continua mentre chi
 * arriva tardi si segna, e il tablet ne mostra lo stato nella sua testata.
 * La musica sta nella barra del tablet, sempre allo stesso posto, e la sceglie
 * la sala: le impostazioni del timer valgono finché non se ne sceglie un'altra.
 * Il resto delle impostazioni (Maurizio, i segnali, lo schermo) lo sceglie la
 * segreteria per tutti i tablet: nelle impostazioni del timer resta solo
 * quello che è del dispositivo.
 */
export interface Incorporato {
  /** La lezione in cui ci si segna adesso: in cima i timer del suo corso. */
  lezione: Lezione | null
  /** Fonte e link della musica scelti in sala, al posto di quelli delle impostazioni. */
  musica: Pick<Settings, 'musicaFonte' | 'youtube'>
  /** Il timer come l'ha scelto la segreteria; nullo finché non si è letto (senza rete, quello dell'ultima volta). */
  impostazioni: ImpostazioniSala | null
  /** Si sta guardando la scheda del timer: senza, la tastiera non lo comanda. */
  visibile: boolean
  onStato: (s: StatoTimer | null) => void
  onSettings: (s: Settings) => void
  /**
   * I timer pronti per la lezione: quelli di DI QUESTA LEZIONE, o se non ce
   * ne sono quelli di DEL CORSO. Il tablet li mette in evidenza nella lezione,
   * ognuno con un tasto per farlo partire senza cercarlo nella scheda TIMER.
   */
  onPronto?: (t: TimerPronto | null) => void
  /** Fa partire un timer: ogni `volta` nuova è una richiesta nuova. */
  avvia?: { id: string; volta: number } | null
}

/** I timer che la lezione ha pronti, nell'ordine della scheda TIMER, e da dove vengono. */
export interface TimerPronto {
  da: 'lezione' | 'corso'
  timer: { id: string; nome: string }[]
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
