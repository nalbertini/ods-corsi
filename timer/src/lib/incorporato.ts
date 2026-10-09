import type { SegmentKind, Settings } from '../types'
import type { Lezione } from './lezione'
import type { Status } from './useTimer'
import type { ImpostazioniSala, TimerSala } from './impostazioniSala'
import type { FonteClip } from './voice'

/**
 * Il timer dentro il tablet di sala e dentro l'app degli istruttori.
 *
 * Da solo il timer è un'app intera, con il suo tasto SALA per tornare al
 * tablet. Sul tablet è una scheda accanto alle presenze: resta montato anche
 * quando si guarda altro, così un allenamento in corso continua mentre chi
 * arriva tardi si segna, e il tablet ne mostra lo stato nella sua testata.
 * La musica sta nella barra del tablet, sempre allo stesso posto, e la sceglie
 * la sala: le impostazioni del timer valgono finché non se ne sceglie un'altra.
 * Maurizio, i segnali e lo schermo si scelgono nelle impostazioni del timer,
 * su un tablet qualunque, e valgono per tutti; la voce e gli esercizi li
 * sceglie la segreteria.
 */
export interface Incorporato {
  /** La lezione in cui ci si segna adesso: in cima i timer del suo corso. */
  lezione: Lezione | null
  /** Fonte e link della musica scelti in sala, al posto di quelli delle impostazioni. */
  musica: Pick<Settings, 'musicaFonte' | 'youtube' | 'radio'> & { musica?: false }
  /**
   * Il timer uguale per tutti i tablet, con la voce e il catalogo degli
   * esercizi scelti dalla segreteria; nullo finché non si è letto (senza rete,
   * quello dell'ultima volta).
   */
  sala: TimerSala | null
  /**
   * Il timer ha cambiato Maurizio, i segnali o lo schermo: il tablet li salva
   * per tutti i tablet. Arriva quando si smette di toccare, non a ogni pixel.
   */
  onTimerSala?: (i: ImpostazioniSala) => void
  /** Le clip incise dalla segreteria; nullo se non se ne sono lette. */
  clip: FonteClip | null
  /** Si sta guardando la scheda del timer: senza, la tastiera non lo comanda. */
  visibile: boolean
  /**
   * Si vede la scheda IMPOSTAZIONI. Sul tablet solo con l'area istruttore
   * aperta: da lì Maurizio, segnali e schermo cambiano per tutti i tablet, e
   * al muro può toccarle chiunque. Senza, vale come aperta.
   */
  conImpostazioni?: boolean
  /**
   * La scheda la sceglie la pagina che lo contiene, con un tasto suo: il timer
   * la segue e non mostra la sua barra delle schede. Lo fa l'app istruttori,
   * che in basso ha già la barra delle pagine.
   */
  scheda?: 'timer' | 'impostazioni'
  /**
   * La pagina che lo contiene ha già la sua testata, col titolo TIMER e il
   * suo ritorno: niente marchio e niente titolo del timer. Lo fa l'app
   * istruttori, sul telefono e sul computer.
   */
  senzaTestata?: boolean
  /**
   * Cresce per fermare l'allenamento dal di fuori (STOP della striscia, o
   * un'altra lezione al suo posto): come uscire dal timer, ma senza toccarlo.
   */
  ferma?: number
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
  /** Quando finisce l'intervallo, sull'orologio (ms): chi guarda da fuori ricalcola il tempo da qui. */
  scadeAlle: number
  /** I secondi rimasti da fermo, in pausa. */
  secondiFermo: number
}
