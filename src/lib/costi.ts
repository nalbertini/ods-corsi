/**
 * I costi della stagione 2026/27, ricopiati dal foglio della segreteria
 * (`public/moduli/costi-2026-27.pdf`).
 *
 * Sono ricopiati così come sono, anche dove sembrano strani (la
 * Prepugilistica costa uguale a saldo e annuale, la Lotta 2 ha il trimestre a
 * 170 € e non a 180 €): se il foglio cambia, si cambia qui, e basta.
 *
 * Le età e gli orari sono quelli del foglio dei costi, non quelli del
 * calendario: dove non coincidono, è il foglio da correggere, non la tabella.
 */

export interface Prezzi {
  /** Una riga dentro lo stesso corso, per esempio «2 GIORNI». */
  etichetta?: string
  /** Il prezzo dell'annuale pagato a saldo entro il 31 agosto. */
  saldo?: number
  annuale?: number
  trimestre?: number
}

export interface VoceCosto {
  corso: string
  eta: string
  orari: string[]
  prezzi: Prezzi[]
  /** Cosa copre il trimestre, se non è un trimestre intero. */
  notaTrimestre?: string
  nota?: string
}

export const STAGIONE = '2026/27'

export const COSTI: VoceCosto[] = [
  {
    corso: 'Giocomotricità',
    eta: 'nati 2022-2023',
    orari: ['martedì o giovedì 17.00-17.50'],
    prezzi: [{ saldo: 320, annuale: 340, trimestre: 130 }],
    notaTrimestre: '10 lezioni',
  },
  {
    corso: 'Psicomotricità',
    eta: '3-4-5 anni',
    orari: ['venerdì 17.00-17.50', 'venerdì 18.00-18.50'],
    prezzi: [{ annuale: 300 }],
  },
  {
    corso: 'Avviamento arti marziali 1',
    eta: 'nati 2020-2021',
    orari: ['martedì e giovedì 17.00-18.00'],
    prezzi: [{ saldo: 430, annuale: 450, trimestre: 170 }],
  },
  {
    corso: 'Judo 2',
    eta: 'nati 2019-2018-2017',
    orari: ['lunedì, mercoledì e venerdì 17.00-18.00'],
    prezzi: [{ saldo: 460, annuale: 480, trimestre: 180 }],
  },
  {
    corso: 'Judo 3',
    eta: 'nati 2016-2015-2014-2013',
    orari: ['lunedì, mercoledì e venerdì 18.00-19.00'],
    prezzi: [{ saldo: 460, annuale: 480, trimestre: 180 }],
  },
  {
    corso: 'Judo adulti',
    eta: 'nati nel 2012 o prima',
    orari: ['lunedì, mercoledì e venerdì 19.00-20.30'],
    prezzi: [{ saldo: 490, annuale: 500, trimestre: 190 }],
  },
  {
    corso: 'Judo principianti',
    eta: 'nati nel 2012 o prima',
    orari: ['lunedì, mercoledì e venerdì 19.00-20.30'],
    prezzi: [{ saldo: 490, annuale: 500, trimestre: 190 }],
  },
  {
    corso: 'Judo agonisti',
    eta: 'solo judoka agonisti (2015-2014 e prima)',
    orari: ['martedì e giovedì 18.00-19.30'],
    prezzi: [{ saldo: 630, annuale: 660, trimestre: 230 }],
    nota: 'Solo in aggiunta a Judo 3 e Judo adulti.',
  },
  {
    corso: 'Aikido 2',
    eta: 'nati 2019-2018-2017',
    orari: ['lunedì e giovedì 17.00-18.00'],
    prezzi: [{ saldo: 430, annuale: 450, trimestre: 170 }],
  },
  {
    corso: 'Aikido 3',
    eta: 'nati 2016-2015-2014 e prima',
    orari: ['lunedì e giovedì 18.00-19.00'],
    prezzi: [{ saldo: 430, annuale: 450, trimestre: 170 }],
  },
  {
    corso: 'Lotta 2',
    eta: 'nati 2019-2018-2017',
    orari: ['lunedì, mercoledì e venerdì 17.00-18.00'],
    prezzi: [{ saldo: 460, annuale: 480, trimestre: 170 }],
  },
  {
    corso: 'Lotta 3',
    eta: 'nati 2016-2015-2014 e prima',
    orari: ['lunedì, martedì, mercoledì e venerdì 18.00-19.00'],
    prezzi: [{ saldo: 460, annuale: 480, trimestre: 180 }],
  },
  {
    corso: 'Body functional',
    eta: 'nati nel 2012 o prima',
    orari: ['mercoledì 18.00-19.00'],
    prezzi: [{ saldo: 320, annuale: 340, trimestre: 130 }],
  },
  {
    corso: 'Preparazione atletica',
    eta: 'nati nel 2012 o prima',
    orari: ['martedì e giovedì 18.00-19.00 / 19.30-20.30', 'lunedì, mercoledì e venerdì 18.00-19.00'],
    prezzi: [
      { etichetta: '1 GIORNO', saldo: 320, annuale: 340, trimestre: 130 },
      { etichetta: '2 GIORNI', saldo: 430, annuale: 450, trimestre: 140 },
      { etichetta: '3 GIORNI', saldo: 460, annuale: 480, trimestre: 180 },
      { etichetta: '4-5 GIORNI', saldo: 630, annuale: 660, trimestre: 230 },
    ],
  },
  {
    corso: 'Pesistica 1',
    eta: 'nati 2015-2014-2013',
    orari: ['lunedì, mercoledì e venerdì 17.00-18.00'],
    prezzi: [{ saldo: 460, annuale: 480, trimestre: 180 }],
  },
  {
    corso: 'Pesistica 2',
    eta: 'nati nel 2012 o prima',
    orari: ['lunedì, mercoledì e venerdì 18.00-19.00'],
    prezzi: [{ saldo: 460, annuale: 480, trimestre: 180 }],
  },
  {
    corso: 'Prepugilistica',
    eta: 'nati 2010-2009-2008 e prima',
    orari: ['lunedì, mercoledì e venerdì 19.00-20.30'],
    prezzi: [{ saldo: 460, annuale: 460, trimestre: 180 }],
  },
  {
    corso: 'Pesi agonisti',
    eta: 'dal 2011, solo agonisti',
    orari: ['martedì e giovedì 17.00-18.00'],
    prezzi: [{ saldo: 630, annuale: 660, trimestre: 230 }],
    nota: 'Specifico per judo e lotta.',
  },
  {
    corso: 'MGA',
    eta: 'dal 2011',
    orari: ['venerdì 19.00-20.00'],
    prezzi: [{ saldo: 320, annuale: 340, trimestre: 130 }],
  },
]

export const OFFERTE: Array<{ titolo: string; testo: string }> = [
  {
    titolo: 'SCONTO FAMIGLIA',
    testo: 'L’abbonamento annuale con il costo minore ha il 20% di sconto (esclusa la quota associativa).',
  },
  {
    titolo: 'PIÙ CORSI',
    testo: 'Il costo totale per partecipare a più corsi nella struttura è di 660 €.',
  },
]
