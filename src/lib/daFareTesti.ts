/**
 * Le parole di DA FARE: il titolo di ogni riga, al singolare e al plurale. Il
 * numero è già grande accanto, il titolo dice solo di cosa. Il tasto è lo
 * stesso su ogni riga (`TASTO_DA_FARE` in daFareChi.ts). I conti e le frasi
 * sotto ogni titolo stanno in `DaFare.tsx`.
 */
export type ChiaveDaFare =
  | 'appelli' | 'richieste' | 'istruttori' | 'segnalate' | 'certificati' | 'scadenza'
  | 'arrivo' | 'pagare' | 'corsi' | 'listino' | 'file-di-prima' | 'documenti-stampa'

export const TESTI_DA_FARE: Record<ChiaveDaFare, { singolare: string; plurale: string }> = {
  appelli: { singolare: 'Lezione senza appello', plurale: 'Lezioni senza appello' },
  richieste: { singolare: 'Richiesta online nuova', plurale: 'Richieste online nuove' },
  istruttori: { singolare: 'Presenza istruttore da confermare', plurale: 'Presenze istruttori da confermare' },
  segnalate: { singolare: 'Presenza segnalata da vedere', plurale: 'Presenze segnalate da vedere' },
  certificati: { singolare: 'Iscritto senza certificato valido', plurale: 'Iscritti senza certificato valido' },
  scadenza: { singolare: 'Certificato in scadenza', plurale: 'Certificati in scadenza' },
  arrivo: { singolare: 'Iscritto compie 6 anni senza certificato', plurale: 'Iscritti compiono 6 anni senza certificato' },
  pagare: { singolare: 'Iscritto da pagare', plurale: 'Iscritti da pagare' },
  corsi: { singolare: 'Iscritto con un corso scaduto', plurale: 'Iscritti con un corso scaduto' },
  listino: { singolare: 'Corso con un prezzo mancante', plurale: 'Corsi con un prezzo mancante' },
  'file-di-prima': { singolare: 'Certificato non archiviato', plurale: 'Certificati non archiviati' },
  'documenti-stampa': { singolare: 'Richiesta con documenti da stampare', plurale: 'Richieste con documenti da stampare' },
}
