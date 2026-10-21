/**
 * I dati dell'iscrizione, come li dà la segreteria: i moduli, dove si paga, la
 * prova. Stanno qui, e non dentro la schermata, perché sono la parte che
 * cambia (un nuovo modulo, i prezzi della stagione dopo). I testi della pagina
 * pubblica sono in `paginaIscrizioni.ts`.
 */

import { STAGIONE } from './costi'
import { haUnServer } from './dati'

/**
 * L'informativa privacy per iscrizioni e corsi, di cui la palestra è titolare
 * del trattamento. È una pagina dell'app (`informativa.html`) e non
 * sta nel database perché la deve poter leggere chiunque, anche chi non ha un
 * accesso. Quella del sito della palestra copre solo la navigazione e dice
 * che il sito non raccoglie dati con dei moduli: per l'iscrizione non basta.
 */
export const INFORMATIVA: string | undefined = 'informativa.html'

/**
 * Vero finché la palestra non ha approvato il testo: col database vero,
 * l'informativa non si mostra al pubblico e il modulo di iscrizione resta
 * spento. Approvata il 27 settembre 2026, e di nuovo il 2 ottobre 2026. Se il testo cambia e va approvato di
 * nuovo, si rimette a `true`, insieme a un riquadro BOZZA nella pagina.
 */
export const INFORMATIVA_BOZZA = false

/** L'informativa da far vedere a chi si iscrive: una bozza solo in prova. */
export const INFORMATIVA_PUBBLICA = INFORMATIVA && (!INFORMATIVA_BOZZA || !haUnServer) ? INFORMATIVA : undefined

/**
 * Il modulo di iscrizione dentro l'app (`ModuloIscrizione`). Raccoglie codici
 * fiscali, dati dei genitori, documenti d'identità e certificati medici, e col
 * database vero si apre solo quando c'è un'informativa approvata da far
 * leggere prima: fino ad allora la pagina pubblica manda a chiamare la
 * segreteria. In prova è sempre aperto, perché lì i dati restano sul dispositivo.
 */
export const MODULO_IN_APP = !haUnServer || !!INFORMATIVA_PUBBLICA

export interface Documento {
  etichetta: string
  /** Relativo alla radice dell'app: i file stanno in `public/moduli/`. */
  file: string
}

/**
 * Le autorizzazioni da firmare. Sono due perché per un minore firma chi ne ha
 * la responsabilità, e il foglio chiede anche i dati del ragazzo.
 */
export const MODULI: Documento[] = [
  { etichetta: 'MAGGIORENNI', file: 'moduli/autorizzazioni-maggiorenni.pdf' },
  { etichetta: 'MINORI', file: 'moduli/autorizzazioni-minori.pdf' },
]

/** I costi della stagione, corso per corso, con sconti e offerte. */
export const LISTINO: Documento = { etichetta: `COSTI ${STAGIONE.etichetta}`, file: 'moduli/costi-2026-27.pdf' }

/** Dove si paga, dal foglio dei costi. */
export const PAGAMENTO: {
  quotaAssociativa: string
  validaFino: string
  iban: string
  intestatario: string
  /**
   * Il link Satispay dell'associazione (quello di Satispay Business, che apre
   * l'app già sul negozio). Senza, nella pagina resta solo il bonifico.
   */
  satispay?: string
} = {
  quotaAssociativa: '50 €',
  validaFino: 'luglio 2027',
  iban: 'IT03 D076 0101 0000 0007 6350 339',
  intestatario: 'ASD Il Centro Judo',
  satispay: 'https://www.satispay.com/app/pay/shops/56907684-6da4-4bbd-8592-a0a00b4303bf',
}

/**
 * Il Regolamento Sociale, che chi si iscrive deve accettare con una casella
 * del modulo. Relativo alla radice dell'app, come i moduli: il PDF va in
 * `public/moduli/`. Finché manca, la casella c'è lo stesso, senza il link.
 */
export const REGOLAMENTO: string | undefined = undefined

/**
 * Le prove, prima dei passi: una lezione sola o una settimana intera. Non
 * sono un passo dell'iscrizione, si fanno prima di decidere.
 */
export const PROVA = {
  costi: [
    { cosa: 'Una lezione', costo: '3 €' },
    { cosa: 'Una settimana', costo: '10 €' },
  ],
  etichetta: 'Non sai ancora quale corso?',
  testo: 'Una lezione per provare un corso, o una settimana per provare tutti gli sport e scegliere quello giusto, prima di iscriversi.',
}
