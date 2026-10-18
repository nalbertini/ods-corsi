/**
 * Le parole di DA FARE: il titolo di ogni riga (al singolare e al plurale) e
 * il tasto che dice cosa fa chi lo tocca. Il numero è già grande accanto, il
 * titolo dice solo di cosa; il tasto dice il gesto («Fai gli appelli»), non
 * dove si va («Vedi chi»), dove un verbo giusto c'è. I conti e le frasi sotto
 * ogni titolo stanno in `DaFare.tsx`.
 */
export type ChiaveDaFare =
  | 'appelli' | 'richieste' | 'istruttori' | 'segnalate' | 'certificati' | 'scadenza'
  | 'arrivo' | 'pagare' | 'listino' | 'file-di-prima' | 'documenti-stampa'

export const TESTI_DA_FARE: Record<ChiaveDaFare, { singolare: string; plurale: string; tasto: string }> = {
  appelli: { singolare: 'Lezione senza appello', plurale: 'Lezioni senza appello', tasto: 'Fai gli appelli' },
  richieste: { singolare: 'Richiesta online nuova', plurale: 'Richieste online nuove', tasto: 'Accogli le richieste' },
  istruttori: { singolare: 'Presenza istruttore da confermare', plurale: 'Presenze istruttori da confermare', tasto: 'Conferma le presenze' },
  segnalate: { singolare: 'Presenza segnalata da vedere', plurale: 'Presenze segnalate da vedere', tasto: 'Apri le segnalate' },
  certificati: { singolare: 'Iscritto senza certificato valido', plurale: 'Iscritti senza certificato valido', tasto: 'Chiedi i certificati' },
  scadenza: { singolare: 'Certificato in scadenza', plurale: 'Certificati in scadenza', tasto: 'Vedi chi' },
  arrivo: { singolare: 'Iscritto compie 6 anni senza certificato', plurale: 'Iscritti compiono 6 anni senza certificato', tasto: 'Vedi chi' },
  pagare: { singolare: 'Iscritto da pagare', plurale: 'Iscritti da pagare', tasto: 'Vedi chi deve pagare' },
  listino: { singolare: 'Corso con un prezzo mancante', plurale: 'Corsi con un prezzo mancante', tasto: 'Apri listino' },
  'file-di-prima': { singolare: 'Certificato non archiviato', plurale: 'Certificati non archiviati', tasto: 'Vedi quali' },
  'documenti-stampa': { singolare: 'Richiesta con documenti da stampare', plurale: 'Richieste con documenti da stampare', tasto: 'Vedi quali' },
}

/** Il tasto principale (giallo) è uno solo per schermata: quello della prima riga, la cosa più urgente. */
export function classeTastoDaFare(indice: number): 'sg-btn-pieno' | 'sg-btn-linea' {
  return indice === 0 ? 'sg-btn-pieno' : 'sg-btn-linea'
}
