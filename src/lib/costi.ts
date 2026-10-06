/**
 * I costi della stagione 2026/27, partiti dal foglio della segreteria
 * (`public/moduli/costi-2026-27.pdf`) e aggiornati con il LISTINO che la
 * segreteria ha sistemato a ottobre: la Prepugilistica, ora solo il
 * mercoledì, costa come un corso da un giorno.
 *
 * Sono il listino di partenza: la segreteria lo cambia da LISTINO, e da lì
 * vale quello (`listino.ts`). Questi restano finché non lo tocca, e tornano
 * con RIMETTI IL FOGLIO.
 *
 * I corsi sono quelli ufficiali della stagione, così come stanno nel
 * calendario della segreteria dopo la revisione di ottobre (orari, sale e
 * istruttori): stessi nomi dei corsi, così le ricevute trovano da sé i
 * prezzi del corso dell'iscritto. Gli orari sono in `dati/corsi-2026-27.csv`:
 * se cambia uno, va ricontrollato l'altro.
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
  /**
   * Il corso di CORSI a cui la voce appartiene: così una rinomina non rompe il
   * prezzo. Senza (listino vecchio, foglio) vale il nome, finché la segreteria
   * non la aggancia da LISTINO.
   */
  corsoId?: string
  eta: string
  orari: string[]
  prezzi: Prezzi[]
  /**
   * Gli anni di nascita del corso, compresi; uno solo vuol dire aperto da
   * quel lato. Il modulo di iscrizione mette prima i corsi giusti per l'anno
   * di chi si iscrive (`corsiPerEta`). Senza, il corso va bene per tutti:
   * `eta` è solo testo, e non si legge in modo sicuro.
   */
  natiDal?: number
  natiAl?: number
  /** «Dai N anni»: chi ha meno anni non vede il corso all'iscrizione (corsi per grandi). Vuoto, nessun limite. */
  etaMinima?: number
  /** Cosa copre il trimestre, se non è un trimestre intero. */
  notaTrimestre?: string
  nota?: string
}

export const STAGIONE = '2026/27'

/** La quota associativa, in euro come i prezzi qui sotto. */
export const QUOTA_ASSOCIATIVA = 50

/**
 * Da quando a quando valgono, sulle ricevute: la quota fino a fine luglio,
 * l'annuale dei corsi fino a fine giugno (come le ricevute della segreteria).
 */
export const VALIDITA = {
  quota: { dal: '2026-09-01', al: '2027-07-31' },
  corsi: { dal: '2026-09-01', al: '2027-06-30' },
}

/**
 * Fino a quando vale il prezzo a saldo, compreso. Dopo non si propone più:
 * né nel listino della pagina di iscrizione né tra le voci delle ricevute.
 */
export const SALDO_ENTRO = '2026-08-31'

/** Se il prezzo a saldo vale ancora, da un giorno `AAAA-MM-GG`; `entro` è quello del listino. */
export const saldoAperto = (giorno: string, entro = SALDO_ENTRO) => giorno <= entro

// Gli anni di nascita (natiDal, natiAl) vengono dall'età scritta: dove non è
// chiara (Psicomotricità in anni, gli agonisti, «dal 2011») restano vuoti, e
// il corso va bene per tutti finché la segreteria non li scrive in LISTINO.
export const COSTI: VoceCosto[] = [
  {
    corso: 'Giocomotricità',
    eta: 'nati 2022-2023',
    natiDal: 2022,
    natiAl: 2023,
    orari: ['martedì o giovedì 17.00-17.50'],
    prezzi: [{ saldo: 320, annuale: 340, trimestre: 130 }],
    notaTrimestre: '10 lezioni',
  },
  {
    corso: 'Psicomotricità',
    eta: '3-4-5 anni',
    orari: ['venerdì 17.00-17.50', 'venerdì 18.10-19.00'],
    prezzi: [{ annuale: 300 }],
  },
  {
    corso: 'Avviamento arti marziali 1',
    eta: 'nati 2020-2021',
    natiDal: 2020,
    natiAl: 2021,
    orari: ['martedì e giovedì 17.00-18.00'],
    prezzi: [{ saldo: 430, annuale: 450, trimestre: 170 }],
  },
  {
    corso: 'Judo 2',
    eta: 'nati 2019-2018-2017',
    natiDal: 2017,
    natiAl: 2019,
    orari: ['lunedì, mercoledì e venerdì 17.00-18.00'],
    prezzi: [{ saldo: 460, annuale: 480, trimestre: 180 }],
  },
  {
    corso: 'Judo 3',
    eta: 'nati 2016-2015-2014-2013',
    natiDal: 2013,
    natiAl: 2016,
    orari: ['lunedì, mercoledì e venerdì 18.00-19.00'],
    prezzi: [{ saldo: 460, annuale: 480, trimestre: 180 }],
  },
  {
    corso: 'Judo adulti',
    eta: 'nati nel 2012 o prima',
    natiAl: 2012,
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
    eta: 'nati 2019-2018-2017-2016',
    natiDal: 2016,
    natiAl: 2019,
    orari: ['lunedì e giovedì 17.00-18.00'],
    prezzi: [{ saldo: 430, annuale: 450, trimestre: 170 }],
  },
  {
    corso: 'Aikido 3',
    eta: 'nati 2015-2014-2013 e prima',
    natiAl: 2015,
    orari: ['lunedì e giovedì 18.00-19.00'],
    prezzi: [{ saldo: 430, annuale: 450, trimestre: 170 }],
  },
  {
    corso: 'Lotta 2',
    eta: 'nati 2019-2018-2017',
    natiDal: 2017,
    natiAl: 2019,
    orari: ['lunedì, mercoledì e venerdì 17.00-18.00'],
    prezzi: [{ saldo: 460, annuale: 480, trimestre: 180 }],
  },
  {
    corso: 'Lotta 3',
    eta: 'nati 2016-2015-2014 e prima',
    natiAl: 2016,
    orari: ['lunedì e mercoledì 18.00-19.30', 'martedì e venerdì 18.00-19.00'],
    prezzi: [{ saldo: 460, annuale: 480, trimestre: 180 }],
  },
  {
    corso: 'Pesistica e Mobility',
    eta: 'nati 2015-2014-2013',
    natiDal: 2013,
    natiAl: 2015,
    orari: ['lunedì, mercoledì e venerdì 17.00-18.00'],
    prezzi: [
      { etichetta: '1 GIORNO', annuale: 340, trimestre: 130 },
      { etichetta: '2 GIORNI', annuale: 450, trimestre: 170 },
      { etichetta: '3 GIORNI', annuale: 480, trimestre: 180 },
    ],
  },
  {
    corso: 'Preparazione atletica, pesi e Mobility',
    eta: 'nati nel 2012 o prima',
    natiAl: 2012,
    orari: ['lunedì, mercoledì e venerdì 18.00-19.00', 'martedì e giovedì 18.00-19.00 / 19.30-20.30'],
    prezzi: [
      { etichetta: '1 GIORNO', saldo: 320, annuale: 340, trimestre: 130 },
      { etichetta: '2 GIORNI', saldo: 430, annuale: 450, trimestre: 140 },
      { etichetta: '3 GIORNI', saldo: 460, annuale: 480, trimestre: 180 },
      { etichetta: '4-5 GIORNI', saldo: 630, annuale: 660, trimestre: 230 },
    ],
  },
  {
    corso: 'Prepugilistica',
    eta: 'nati 2010-2009-2008 e prima',
    natiAl: 2010,
    orari: ['mercoledì 19.00-20.30'],
    prezzi: [{ saldo: 320, annuale: 340, trimestre: 130 }],
  },
  {
    corso: 'Pesi agonisti',
    eta: 'dal 2011, solo agonisti',
    orari: ['martedì e giovedì 17.00-18.00'],
    prezzi: [{ saldo: 630, annuale: 660, trimestre: 230 }],
    nota: 'Specifico per judo e lotta.',
  },
  {
    corso: 'MGA metodo globale autodifesa',
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
