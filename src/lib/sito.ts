/**
 * Quello che l'app prende dal sito della palestra: una frase per corso, la
 * pagina dove leggere il resto, e i contatti.
 *
 * Età, orari e prezzi no: quelli fanno fede dal foglio dei costi
 * (`lib/costi.ts`), e il sito non sempre ci corrisponde.
 *
 * L'indirizzo del sito sta solo qui: quando passa al dominio definitivo si
 * cambia `SITO` e i link seguono.
 */

export const SITO = 'https://officinedellosport.framer.website'

/** Il link a una pagina del sito, con le lettere accentate già a posto. */
export const paginaSito = (percorso: string) => `${SITO}/${encodeURI(percorso)}`

export interface Presentazione {
  /** La frase della scheda del corso nella home del sito. */
  frase: string
  /** Il percorso della pagina del corso, senza la barra iniziale. */
  pagina: string
}

const GIOCO: Presentazione = {
  frase: 'Percorsi motori per crescere giocando, migliorando coordinazione e fiducia.',
  pagina: 'giocomotricità-e-psicomotricità',
}
const JUDO: Presentazione = { frase: 'Tecnica, disciplina e rispetto per crescere sul tatami.', pagina: 'judo' }
const AIKIDO: Presentazione = { frase: 'Armonia, equilibrio, difesa.', pagina: 'aikido' }
const LOTTA: Presentazione = { frase: 'Gioco, movimento e rispetto per crescere insieme.', pagina: 'lotta' }
const PESI: Presentazione = {
  frase: 'Percorso dedicato all’apprendimento e al perfezionamento del sollevamento pesi.',
  pagina: 'sollevamenti-pesi',
}

/** Per nome del corso, come sta in `COSTI`. Più corsi possono avere la stessa pagina. */
const PRESENTAZIONI: Record<string, Presentazione> = {
  'Giocomotricità': GIOCO,
  'Psicomotricità': GIOCO,
  'Avviamento arti marziali 1': {
    frase: 'Un percorso di scoperta tra le diverse discipline, per aiutare i più piccoli a trovare la propria strada.',
    pagina: 'avviamento-alle-arti-marziali',
  },
  'Judo 2': JUDO,
  'Judo 3': JUDO,
  'Judo adulti': JUDO,
  'Judo principianti': JUDO,
  'Judo agonisti': JUDO,
  'Aikido 2': AIKIDO,
  'Aikido 3': AIKIDO,
  'Lotta 2': LOTTA,
  'Lotta 3': LOTTA,
  'Body functional': PESI,
  'Preparazione atletica': {
    frase: 'Allenamenti mirati per migliorare forza, resistenza, velocità e coordinazione.',
    pagina: 'preparazione-atletica',
  },
  'Pesistica 1': PESI,
  'Pesistica 2': PESI,
  'Prepugilistica': {
    frase: 'Il primo passo nella boxe: tecnica, disciplina e coordinazione, per muovere i primi colpi in sicurezza.',
    pagina: 'pre-pugilistica',
  },
  'Pesi agonisti': PESI,
  'MGA': {
    frase: 'Un sistema di autodifesa pratico e realistico, basato su situazioni reali.',
    pagina: 'mga---metodo-globale-di-autodifesa',
  },
}

export const presentazione = (corso: string): Presentazione | undefined => PRESENTAZIONI[corso]

/** Dove siamo e come ci si trova, dal piede del sito. */
export const CONTATTI = {
  indirizzo: 'Via Sassi 26, Collegno',
  mappa: 'https://www.google.com/maps/dir/?api=1&destination=Via+Vittorio+Sassi+26,+10093+Collegno+TO',
  telefono: '346 329 2786',
  instagram: 'https://www.instagram.com/officine.dellosport/',
  facebook: 'https://www.facebook.com/ilCentroJudo/',
}

/** Il numero per il tasto CHIAMA: senza spazi e col prefisso. */
export const chiama = `tel:+39${CONTATTI.telefono.replace(/\s/g, '')}`
