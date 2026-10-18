/**
 * I testi e l'ordine della pagina pubblica delle iscrizioni (`iscrizioni/`),
 * quella del link che si manda a chi vuole iscriversi. Le cifre e i dati veri
 * (quota, IBAN, contatti, prove) stanno in `iscrizione.ts`, `sito.ts` e nel
 * listino: qui solo le frasi e dove vanno.
 */

export const APERTURA = {
  titolo: 'Iscriviti a Officine Dello Sport',
  // Nessun tempo: la palestra non ha detto quando richiama.
  frase: 'Compili la richiesta dal telefono. La segreteria la guarda e ti richiama.',
}

/** Sotto il tasto: la richiesta non chiude l'iscrizione, e il modulo vive in memoria. */
export const AVVISO_RICHIESTA = 'La richiesta non è ancora l’iscrizione. Non si salva a metà: se esci, ricominci.'

/** Al posto del tasto, quando il modulo non è aperto (informativa non ancora approvata). */
export const SENZA_MODULO = 'Per iscriverti chiamaci o passa in palestra.'

/** In coda al testo della prova: nessuna promessa sullo sconto, solo come cominciare. */
export const PROVA_CHIAMA = 'Per cominciare, passa in palestra o chiamaci.'

/** In cima al riquadro dei contatti. */
export const DUBBIO = 'Hai un dubbio? Chiamaci o passa in palestra.'

/** Prima del link all'informativa, sotto il tasto per cominciare. */
export const INFORMATIVA_FRASE = 'Come trattiamo i tuoi dati:'

/** Cosa tenere pronto. Il certificato non blocca: la segreteria lo prende anche di persona. */
export const COSA_SERVE: string[] = [
  'La carta d’identità: la tua, o quella del genitore se si iscrive un minore.',
  'Il certificato medico, se ce l’hai. Se no, mandi la richiesta lo stesso e lo porti in segreteria.',
  'La ricevuta del pagamento, se hai già pagato.',
  'Per un minore firma il genitore.',
]

/** Il pagamento non è un passo da fare prima: la ricevuta nel modulo è facoltativa. */
export const COME_SI_PAGA = {
  titolo: 'Dopo la richiesta, oppure in segreteria.',
  ricevuta: 'La ricevuta la puoi caricare nella richiesta, se hai già pagato.',
}

/** I due PDF servono a leggere o a stampare: il modulo si firma col dito nella richiesta. */
export const MODULO_DA_LEGGERE = {
  titolo: 'Si firma col dito, nella richiesta.',
  testo: 'Se vuoi, prima lo leggi o lo stampi: quello per maggiorenni, o quello per minori che firma il genitore.',
}

export type Sezione = 'apertura' | 'serve' | 'prova' | 'costi' | 'paga' | 'richiesta' | 'modulo' | 'aiuto' | 'piede'

/**
 * Le sezioni, nell'ordine in cui si leggono. Chi arriva deve poter cominciare
 * subito (apertura), sapere cosa tenere pronto, poi i prezzi e come si paga;
 * il secondo tasto ('richiesta') sta dopo i costi per chi li ha letti. Senza il
 * modulo aperto il tasto non c'è, né il secondo né il primo.
 */
export function sezioniPagina(moduloAperto: boolean): Sezione[] {
  const tutte: Sezione[] = ['apertura', 'serve', 'prova', 'costi', 'paga', 'richiesta', 'modulo', 'aiuto', 'piede']
  return moduloAperto ? tutte : tutte.filter((s) => s !== 'richiesta')
}

/**
 * Cosa mostra la cima della pagina. Senza il modulo aperto non c'è il tasto per
 * cominciare né l'avviso su cosa succede dopo: c'è solo SENZA_MODULO. Tenuto in
 * una funzione per avere un cancello solo, lo stesso di `sezioniPagina`.
 */
export function aperturaDellaPagina(moduloAperto: boolean): { tasto: boolean; avviso: boolean; senzaModulo: boolean } {
  return { tasto: moduloAperto, avviso: moduloAperto, senzaModulo: !moduloAperto }
}
