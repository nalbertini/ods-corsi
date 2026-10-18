import type { Voce } from './indirizzoSegreteria'

/**
 * Il menu della segreteria in cinque gruppi, da quello che si apre ogni giorno
 * a quello che si tocca una volta a stagione. Ogni gruppo dice cosa ci si
 * trova: Corsi non è una «persona», e «La palestra» teneva insieme sei cose
 * diverse. Le presenze segnalate sono una scheda di PRESENZE, non una voce.
 * Il maiuscolo dei titoli lo fa lo stile (`.sg-gruppo-titolo`), non il testo.
 */
export const GRUPPI_MENU: Array<{ titolo: string; voci: Array<[Voce, string]>; secondario?: boolean }> = [
  {
    titolo: 'Ogni giorno',
    voci: [
      ['dafare', 'Da fare'],
      ['richieste', 'Richieste online'],
      ['presenze', 'Presenze'],
    ],
  },
  {
    titolo: 'Iscritti e soldi',
    voci: [
      ['iscritti', 'Iscritti'],
      ['tessere', 'Tessere'],
      ['pagamenti', 'Pagamenti'],
    ],
  },
  {
    titolo: 'Corsi e orari',
    voci: [
      ['settimana', 'Settimana'],
      ['corsi', 'Corsi'],
      ['listino', 'Listino'],
    ],
  },
  {
    titolo: 'Istruttori',
    voci: [
      ['istruttori', 'Presenze istruttori'],
      ['personale', 'Istruttori e accessi'],
    ],
  },
  {
    titolo: 'Il resto',
    // Sul telefono più piccolo: sono cose da computer.
    secondario: true,
    voci: [
      ['statistiche', 'Statistiche'],
      ['vestiario', 'Vestiario'],
      ['esercizi', 'Esercizi'],
      ['segnalazioni', 'Segnalazioni'],
      ['sito', 'Sito'],
    ],
  },
]

export type VoceAmministrazione = 'contabilita' | 'pagamenti' | 'listino'

export const TITOLO_AMMINISTRAZIONE = 'I conti'

/** Il menu dell'amministrazione: i conti, e basta. Le persone, le presenze e le statistiche non ci sono. */
export const VOCI_AMMINISTRAZIONE: Array<[VoceAmministrazione, string]> = [
  ['contabilita', 'Contabilità'],
  ['pagamenti', 'Pagamenti'],
  ['listino', 'Listino'],
]
