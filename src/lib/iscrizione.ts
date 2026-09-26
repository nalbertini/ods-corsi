/**
 * I passi dell'iscrizione, come li dà la segreteria.
 *
 * Stanno qui, e non dentro la schermata, perché sono la parte che cambia: un
 * nuovo modulo, un nuovo link, un passo in più. Il resto è impaginazione.
 */

/** Il modulo Google dove si caricano risposte, foto e pagamento. */
export const LINK_ISCRIZIONE = 'https://forms.gle/eZyGvAD4h7cNNpXF7'

/**
 * Il modulo da scaricare, firmare e fotografare, relativo alla radice
 * dell'app. `null` finché il file non è in `public/`: il passo resta, ma senza
 * un tasto che porterebbe a una pagina vuota.
 */
export const MODULO_ISCRIZIONE: string | null = null

export interface Passo {
  titolo: string
  dettaglio?: string
  /** Cosa fa il tasto del passo, se ne ha uno. */
  azione?: 'modulo' | 'link'
}

export const PASSI: Passo[] = [
  { titolo: 'Scarica il modulo', azione: 'modulo' },
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
    dettaglio: 'La quota di iscrizione e il trimestre, oppure l’annuale.',
  },
]
