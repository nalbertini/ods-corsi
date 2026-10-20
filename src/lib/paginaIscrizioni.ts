/**
 * I testi e l'ordine della pagina pubblica delle iscrizioni (`iscrizioni/`),
 * quella del link che si manda a chi vuole iscriversi, e della pagina a parte
 * dei prezzi (`iscrizioni/#prezzi`). Le cifre e i dati veri (quota, IBAN,
 * contatti, prove) stanno in `iscrizione.ts`, `sito.ts`, `costi.ts` e nel
 * listino: qui solo le frasi e dove vanno.
 */
import { INDIRIZZO_PREZZI, INDIRIZZO_RICHIESTA, INDIRIZZO_VESTIARIO } from './cancelletti'
import { PIU_CORSI, STAGIONE } from './costi'
import { SCONTO_FAMIGLIA } from './nucleo'
import { flussoNuovoAcceso } from './passiIscrizione'
import { inEuro } from './vestiario'

export const APERTURA = {
  titolo: 'Iscriviti a Officine Dello Sport',
  // Nessun tempo: la palestra non ha detto quando richiama.
  frase: 'Compili la richiesta dal telefono. La segreteria la guarda e ti richiama.',
}

/** Sotto il tasto: la richiesta non chiude l'iscrizione, e il modulo vive in memoria. */
export const AVVISO_RICHIESTA = 'La richiesta non è ancora l’iscrizione. Non si salva a metà: se esci, ricominci.'

/** Al posto del tasto, quando il modulo non è aperto (informativa non ancora approvata). */
export const SENZA_MODULO = 'Per iscriverti chiamaci o passa in palestra.'

/** In coda al testo della prova, nel modulo a passi. */
export const PROVA_CHIAMA = 'Per cominciare, passa in palestra o chiamaci.'

/** In cima al riquadro dei contatti, nel modulo a passi. */
export const DUBBIO = 'Hai un dubbio? Chiamaci o passa in palestra.'

/** Prima del link all'informativa, sotto il tasto per cominciare. */
export const INFORMATIVA_FRASE = 'Come trattiamo i tuoi dati:'

/**
 * Cosa preparare, una cosa per riga: chi apre il link si mette in pari prima
 * di cominciare. `quando` dice che la cosa non è obbligatoria; il certificato
 * non blocca, la segreteria lo prende anche di persona.
 */
export const COSA_SERVE: Array<{ titolo: string; quando?: string; nota: string }> = [
  { titolo: 'Il codice fiscale', nota: 'Di chi si iscrive. Se iscrivi un figlio, anche il tuo.' },
  { titolo: 'La carta d’identità', nota: 'Di chi si iscrive, dai 6 anni. Una foto o il PDF.' },
  { titolo: 'Il certificato medico', quando: 'SE CE L’HAI', nota: 'Se non ce l’hai, lo porti in segreteria prima della prima lezione.' },
  { titolo: 'Come paghi', quando: 'NELLA RICHIESTA', nota: 'Con Satispay, oppure col bonifico: allora serve la sua ricevuta.' },
]

/** Si paga nella richiesta: con Satispay, o col bonifico e la sua ricevuta (decisione del 2026-10-20). */
export const COME_SI_PAGA = {
  titolo: 'Nella richiesta: con Satispay o col bonifico.',
  ricevuta: 'Col bonifico, la sua ricevuta si carica nella richiesta.',
}

/**
 * Il riquadro breve dei costi: la quota (dal listino che vale), le due offerte
 * in una riga ciascuna e come si paga. I prezzi di ogni corso stanno nella
 * pagina a parte. Le cifre delle offerte vengono da dove le usa l'app
 * (`SCONTO_FAMIGLIA`, `PIU_CORSI`), non scritte qui: scelta dell'utente.
 */
export function costiBreve(quota: number, satispay: boolean) {
  return {
    etichetta: `QUANTO COSTA · ${STAGIONE}`,
    titolo: `Quota associativa ${inEuro(quota)}, più il corso.`,
    righe: [
      { testo: 'Sconto famiglia, sull’annuale che costa meno', cifra: `−${Math.round(SCONTO_FAMIGLIA * 100)}%` },
      { testo: 'Più corsi nella struttura, in tutto', cifra: `${PIU_CORSI} €` },
    ],
    testo: `I prezzi di ogni corso e come si paga: ${satispay ? 'Satispay o bonifico' : 'bonifico'}, nella richiesta.`,
    tasto: 'PREZZI E PAGAMENTO',
  }
}

/** La prova e i dubbi in un riquadro solo: chi non ha ancora deciso e chi ha una domanda fanno la stessa cosa, chiamano. */
export function provaEDubbi(contatti: { indirizzo: string; telefono: string }) {
  return {
    etichetta: 'Non sai ancora quale corso? Hai un dubbio?',
    frase: `Per la prova o per un dubbio, chiamaci o passa in palestra: ${contatti.indirizzo}. Telefono ${contatti.telefono}.`,
  }
}

export type Sezione = 'apertura' | 'serve' | 'costiBreve' | 'provaDubbi' | 'richiesta'

/**
 * Le sezioni, nell'ordine in cui si leggono: cosa preparare, quanto costa in
 * breve, la prova e i dubbi, e in fondo, una volta sola, il tasto. Senza il
 * modulo aperto il fondo dice di chiamare (`fondoDellaPagina`).
 */
export function sezioniPagina(_moduloAperto: boolean): Sezione[] {
  return ['apertura', 'serve', 'costiBreve', 'provaDubbi', 'richiesta']
}

/**
 * Il fondo della pagina e della pagina dei prezzi: il tasto per cominciare con
 * l'avviso, o, senza il modulo aperto, l'invito a chiamare. Un cancello solo
 * per le due pagine.
 */
export function fondoDellaPagina(moduloAperto: boolean): { tasto: boolean; frase: string } {
  return moduloAperto ? { tasto: true, frase: AVVISO_RICHIESTA } : { tasto: false, frase: SENZA_MODULO }
}

export type VistaIscrizioni = 'pagina' | 'prezzi' | 'vestiario' | 'passi'

/**
 * Cosa mostra `iscrizioni/` dal cancelletto. La pagina ha già il marchio sopra
 * il titolo, quindi la testata dell'app la hanno solo le altre viste. Il
 * flusso a passi (`#nuova`) c'è solo in prova.
 */
export function vistaIscrizioni(haUnServer: boolean, hash: string): { vista: VistaIscrizioni; testata: boolean } {
  if (hash === INDIRIZZO_PREZZI) return { vista: 'prezzi', testata: true }
  if (hash === INDIRIZZO_VESTIARIO) return { vista: 'vestiario', testata: true }
  if (flussoNuovoAcceso(haUnServer, hash)) return { vista: 'passi', testata: true }
  return { vista: 'pagina', testata: false }
}

/**
 * La pagina si apre col modulo già aperto se arriva da COMPILA LA RICHIESTA
 * della pagina dei prezzi: così il modulo vive sulla pagina, come sempre, e
 * l'indietro del browser non lo smonta senza la domanda di ← INDIETRO.
 */
export const moduloDalCancelletto = (hash: string) => hash === INDIRIZZO_RICHIESTA
