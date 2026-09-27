/**
 * I passi dell'iscrizione, come li dà la segreteria.
 *
 * Stanno qui, e non dentro la schermata, perché sono la parte che cambia: un
 * nuovo modulo, un nuovo link, un passo in più, i prezzi della stagione dopo.
 * Il resto è impaginazione.
 */

import { haUnServer } from './dati'

/**
 * Il modulo Google dove si caricavano risposte, foto e pagamento. Resta solo
 * per la pagina pubblica senza il database vero, vedi `MODULO_IN_APP_PUBBLICO`,
 * e per rimettere il passo com'era se il modulo dell'app si dovesse spegnere.
 */
export const LINK_ISCRIZIONE = 'https://forms.gle/eZyGvAD4h7cNNpXF7'

/**
 * L'informativa privacy per iscrizioni e corsi, di cui la palestra è titolare
 * del trattamento. È una pagina dell'app (`public/informativa.html`) e non
 * sta nel database perché la deve poter leggere chiunque, anche chi non ha un
 * accesso. Quella del sito della palestra copre solo la navigazione e dice
 * che il sito non raccoglie dati con dei moduli: per l'iscrizione non basta.
 */
export const INFORMATIVA: string | undefined = 'informativa.html'

/**
 * Vero finché la palestra non ha approvato il testo: col database vero,
 * l'informativa non si mostra al pubblico e il modulo di iscrizione resta
 * spento. Approvata il 27 settembre 2026. Se il testo cambia e va approvato di
 * nuovo, si rimette a `true`, insieme a un riquadro BOZZA nella pagina.
 */
export const INFORMATIVA_BOZZA = false

/** L'informativa da far vedere a chi si iscrive: una bozza solo in prova. */
export const INFORMATIVA_PUBBLICA = INFORMATIVA && (!INFORMATIVA_BOZZA || !haUnServer) ? INFORMATIVA : undefined

/**
 * Il modulo di iscrizione dentro l'app (`ModuloIscrizione`), al posto di
 * quello Google. Raccoglie codici fiscali e documenti d'identità, e col
 * database vero si accende solo quando c'è un'informativa approvata da far
 * leggere prima: fino ad allora il passo porta ancora al modulo Google. In
 * prova è sempre acceso, perché lì i dati restano sul dispositivo.
 */
export const MODULO_IN_APP = !haUnServer || !!INFORMATIVA_PUBBLICA

/**
 * Il modulo dell'app per la pagina pubblica (`iscrizioni/`), quella del link
 * che si manda a chi vuole iscriversi: lì la prova non vale, perché una
 * richiesta rimasta sul telefono di chi l'ha mandata non arriva a nessuno.
 * Senza il database vero, quindi, il passo porta al modulo Google; col
 * database vero vale come `MODULO_IN_APP`: resta Google finché l'informativa
 * è una bozza.
 */
export const MODULO_IN_APP_PUBBLICO = haUnServer && !!INFORMATIVA_PUBBLICA

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
export const LISTINO: Documento = { etichetta: 'COSTI 2026/27', file: 'moduli/costi-2026-27.pdf' }

/** Dove si paga, dal foglio dei costi. */
export const PAGAMENTO = {
  quotaAssociativa: '50 €',
  validaFino: 'luglio 2027',
  iban: 'IT03 D076 0101 0000 0007 6350 339',
  intestatario: 'ASD Il Centro Judo',
}

/**
 * La settimana di prova, prima dei passi: la stessa che il sito dice nelle
 * domande frequenti. Non è un passo dell'iscrizione, si fa prima di decidere.
 */
export const PROVA = {
  costo: '5 €',
  testo: 'Una settimana per provare tutti gli sport e scegliere quello giusto, prima di iscriversi.',
}

export interface Passo {
  titolo: string
  dettaglio?: string
  /** Cosa mostra il passo sotto il titolo, se ha qualcosa da far fare. */
  azione?: 'moduli' | 'link' | 'pagamento' | 'modulo'
}

/** Col modulo dell'app: le domande e le foto stanno tutte nell'ultimo passo. */
const PASSI_APP: Passo[] = [
  { titolo: 'Scarica il modulo', dettaglio: 'Quello per maggiorenni, o quello per minori che firma il genitore.', azione: 'moduli' },
  {
    titolo: 'Compilalo e firmalo dal telefono',
    dettaglio: 'Se non ci riesci, stampalo, firmalo a mano e fagli una foto.',
  },
  {
    titolo: 'Fai il pagamento',
    dettaglio: 'La quota associativa e il trimestre, oppure l’annuale. Tieni la ricevuta.',
    azione: 'pagamento',
  },
  {
    titolo: 'Manda la richiesta da qui',
    dettaglio: "Le domande, poi le foto del modulo firmato, della carta d'identità e della ricevuta.",
    azione: 'modulo',
  },
]

/** Col modulo Google, com'era. */
const PASSI_GOOGLE: Passo[] = [
  { titolo: 'Scarica il modulo', dettaglio: 'Quello per maggiorenni, o quello per minori che firma il genitore.', azione: 'moduli' },
  {
    titolo: 'Compilalo e firmalo dal telefono',
    dettaglio: 'Se non ci riesci, stampalo e firmalo a mano.',
  },
  { titolo: 'Apri il modulo di iscrizione', azione: 'link' },
  { titolo: 'Rispondi alle domande' },
  { titolo: 'Fai una foto al modulo firmato e caricala' },
  { titolo: "Fai una foto alla carta d'identità e caricala" },
  {
    titolo: 'Carica la ricevuta del pagamento',
    dettaglio: 'La quota associativa e il trimestre, oppure l’annuale.',
    azione: 'pagamento',
  },
]

export const PASSI: Passo[] = MODULO_IN_APP ? PASSI_APP : PASSI_GOOGLE

/** I passi della pagina pubblica: vedi `MODULO_IN_APP_PUBBLICO`. */
export const PASSI_PUBBLICI: Passo[] = MODULO_IN_APP_PUBBLICO ? PASSI_APP : PASSI_GOOGLE
