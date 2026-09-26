/**
 * I passi dell'iscrizione, come li dà la segreteria.
 *
 * Stanno qui, e non dentro la schermata, perché sono la parte che cambia: un
 * nuovo modulo, un nuovo link, un passo in più, i prezzi della stagione dopo.
 * Il resto è impaginazione.
 */

/** Il modulo Google dove si caricano risposte, foto e pagamento. */
export const LINK_ISCRIZIONE = 'https://forms.gle/eZyGvAD4h7cNNpXF7'

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

export interface Passo {
  titolo: string
  dettaglio?: string
  /** Cosa mostra il passo sotto il titolo, se ha qualcosa da far fare. */
  azione?: 'moduli' | 'link' | 'pagamento'
}

export const PASSI: Passo[] = [
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
