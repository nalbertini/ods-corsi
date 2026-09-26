import type { Ruolo, StatoSessione } from './sala'

/**
 * L'archivio della modalità prova: corsi, orari, persone e iscrizioni.
 *
 * Parte dall'orario vero della stagione 2026/27, con degli iscritti inventati,
 * e da lì la segreteria di prova lo cambia come farebbe col database: un corso
 * nuovo, un giorno in più, un iscritto che smette. I cambi restano su questo
 * dispositivo, in `localStorage`, e li vedono tutti quelli che leggono la
 * prova: l'appello, il tablet, la segreteria. È l'equivalente delle tabelle di
 * `01-schema.sql`, tenuto nella forma più comoda per chi lo legge qui.
 *
 * I nomi degli iscritti sono inventati. Se somigliano a qualcuno è un caso.
 */

const DOVE = 'ods-corsi:prova-archivio'   // vedi la nota in coda.ts
const VERSIONE = 1

/** Quando cominciano e finiscono i corsi della stagione. */
export const STAGIONE = { dal: '2026-09-14', al: '2027-06-30' }

export interface RicorrenzaProva {
  /** Corso, giorno e ora: da qui viene l'id delle lezioni, che non deve cambiare. */
  id: string
  /** 0 = domenica, come `getDay()`. */
  giorno: number
  ora: string
  durata: number
  dal: string
  al?: string
  /** La sala di questo giorno, quando non è quella del corso. */
  sala?: string
}

export interface CorsoProva {
  id: string
  nome: string
  colore: string
  sala: string
  /** Gli id delle persone che lo insegnano; il primo è quello di riferimento. */
  istruttori: string[]
  capienza?: number
  attivo: boolean
  ricorrenze: RicorrenzaProva[]
}

export interface PersonaProva {
  id: string
  nome: string
  cognome: string
  ruolo: Ruolo
  email?: string
  telefono?: string
  attiva: boolean
  creataIl: string
}

export interface IscrizioneProva {
  corsoId: string
  personaId: string
  dal: string
  al?: string
}

/** Quello che di una lezione si è deciso a mano, o una lezione in più. */
export interface LezioneProva {
  stato?: StatoSessione
  /** Il sostituto; `null` o assente vuol dire «come da corso». */
  istruttore?: string | null
  sala?: string | null
  straordinaria?: { corsoId: string; inizio: string; durata: number }
}

export interface Archivio {
  versione: number
  sale: string[]
  corsi: CorsoProva[]
  persone: PersonaProva[]
  iscrizioni: IscrizioneProva[]
  /** Per id di lezione. */
  lezioni: Record<string, LezioneProva>
  /** Quelle che seguono sono venute dopo: in un archivio già salvato possono mancare. */
  capienzaSale?: Record<string, number>
  /** I PIN del tablet cambiati dalla segreteria, per persona. */
  pin?: Record<string, string>
  impostazioni?: { mesiPresenze: number; giorniCalendario: number }
}

// ---------------------------------------------------------------------------
// L'orario di partenza: il volantino «Corsi e attività», corretto dove il
// foglio dei costi dice altro (vale il foglio dei costi). Lunedì 1, venerdì 5.
// ---------------------------------------------------------------------------

type Orario = [giorno: number, ora: string, durata: number]
const LMV = [1, 3, 5]
const MG = [2, 4]
const ogni = (giorni: number[], ora: string, durata: number): Orario[] => giorni.map((g) => [g, ora, durata])

// I colori seguono la disciplina, non il corso: da lontano si vede se è judo o lotta.
const JUDO = '#1b8ac4'
const LOTTA = '#e4292a'
const PESI = '#f4c31b'
const MOTRICITA = '#16a54a'

/** Gli istruttori che si conoscono. Del cognome non si sa ancora niente. */
const ISTRUTTORI: Record<string, string> = {
  maurizio: 'Maurizio',
  maura: 'Maura',
  federico: 'Federico',
  manuel: 'Manuel',
  tiziano: 'Tiziano',
  katia: 'Katia',
  fabio: 'Fabio',
}

interface Definizione {
  id: string
  nome: string
  colore: string
  sala: string
  istruttori: string[]
  capienza: number
  orari: Orario[]
  /** Seme e quantità degli iscritti inventati. */
  iscritti: [seme: number, quanti: number]
}

const CORSI: Definizione[] = [
  { id: 'judo-2', nome: 'Judo 2', colore: JUDO, sala: 'Tatami', istruttori: ['maurizio'], capienza: 20, orari: ogni(LMV, '17:00', 60), iscritti: [1, 14] },
  { id: 'judo-3', nome: 'Judo 3', colore: JUDO, sala: 'Tatami', istruttori: ['maurizio'], capienza: 20, orari: ogni(LMV, '18:00', 60), iscritti: [2, 16] },
  { id: 'judo-adulti', nome: 'Judo adulti', colore: JUDO, sala: 'Tatami', istruttori: ['maurizio'], capienza: 20, orari: ogni(LMV, '19:00', 90), iscritti: [3, 12] },
  { id: 'judo-principianti', nome: 'Judo principianti', colore: JUDO, sala: 'Motricità', istruttori: ['maurizio'], capienza: 12, orari: ogni(LMV, '19:00', 90), iscritti: [4, 8] },
  { id: 'judo-agonisti', nome: 'Judo agonisti', colore: JUDO, sala: 'Tatami', istruttori: ['maurizio'], capienza: 16, orari: ogni(MG, '18:00', 90), iscritti: [5, 10] },

  { id: 'psicomotricita', nome: 'Psicomotricità', colore: MOTRICITA, sala: 'Motricità', istruttori: [], capienza: 12, orari: [...ogni([5], '17:00', 50), ...ogni([5], '18:00', 50)], iscritti: [6, 9] },
  { id: 'giocomotricita', nome: 'Giocomotricità', colore: MOTRICITA, sala: 'Lotta', istruttori: [], capienza: 12, orari: ogni(MG, '17:00', 50), iscritti: [7, 8] },
  { id: 'avviamento', nome: 'Avviamento arti marziali 1', colore: MOTRICITA, sala: 'Tatami', istruttori: [], capienza: 14, orari: ogni(MG, '17:00', 60), iscritti: [8, 10] },

  { id: 'lotta-2', nome: 'Lotta 2', colore: LOTTA, sala: 'Lotta', istruttori: ['maura', 'federico'], capienza: 16, orari: ogni(LMV, '17:00', 60), iscritti: [9, 12] },
  { id: 'lotta-3', nome: 'Lotta 3', colore: LOTTA, sala: 'Lotta', istruttori: ['maura', 'federico'], capienza: 16, orari: ogni([1, 2, 3, 5], '18:00', 60), iscritti: [10, 13] },

  { id: 'pesi-1', nome: 'Pesistica 1', colore: PESI, sala: 'Pesi', istruttori: [], capienza: 10, orari: ogni(LMV, '17:00', 60), iscritti: [11, 8] },
  { id: 'pesi-2', nome: 'Pesistica 2', colore: PESI, sala: 'Pesi', istruttori: [], capienza: 10, orari: ogni(LMV, '18:00', 60), iscritti: [12, 9] },
  { id: 'body-functional', nome: 'Body functional', colore: PESI, sala: 'Motricità', istruttori: ['tiziano'], capienza: 14, orari: ogni([3], '18:00', 60), iscritti: [13, 11] },
  { id: 'pesi-agonisti', nome: 'Pesi agonisti', colore: PESI, sala: 'Pesi', istruttori: [], capienza: 10, orari: ogni(MG, '17:00', 60), iscritti: [14, 7] },

  { id: 'aikido-2', nome: 'Aikido 2', colore: MOTRICITA, sala: 'Motricità', istruttori: ['fabio'], capienza: 14, orari: ogni([1, 4], '17:00', 60), iscritti: [15, 8] },
  { id: 'aikido-3', nome: 'Aikido 3', colore: MOTRICITA, sala: 'Motricità', istruttori: ['fabio'], capienza: 14, orari: ogni([1, 4], '18:00', 60), iscritti: [16, 9] },

  { id: 'pre-pugilistica', nome: 'Prepugilistica', colore: LOTTA, sala: 'Pesi', istruttori: [], capienza: 14, orari: ogni(LMV, '19:00', 90), iscritti: [17, 10] },
  { id: 'mga', nome: 'MGA · metodo globale autodifesa', colore: LOTTA, sala: 'Lotta', istruttori: [], capienza: 14, orari: ogni([5], '19:00', 60), iscritti: [18, 9] },

  { id: 'prep-atletica-1', nome: 'Preparazione atletica 1', colore: PESI, sala: 'Pesi', istruttori: ['maurizio', 'katia', 'manuel'], capienza: 14, orari: ogni(MG, '18:00', 60), iscritti: [19, 12] },
  { id: 'prep-atletica-2', nome: 'Preparazione atletica 2', colore: PESI, sala: 'Pesi', istruttori: ['maurizio', 'katia', 'manuel'], capienza: 14, orari: ogni(MG, '19:30', 60), iscritti: [20, 11] },
  // Si allena insieme alla Pesistica 2, stessa sala e stessa ora: due corsi
  // perché iscritti e prezzi sono diversi, e ognuno ha il suo appello.
  { id: 'prep-atletica-3', nome: 'Preparazione atletica 3', colore: PESI, sala: 'Pesi', istruttori: ['maurizio', 'katia', 'manuel'], capienza: 14, orari: ogni(LMV, '18:00', 60), iscritti: [21, 10] },
]

/**
 * Gli iscritti inventati: nomi comuni messi insieme con un generatore che dà
 * sempre lo stesso risultato, così l'elenco di un corso non cambia da un
 * caricamento all'altro.
 */
const COGNOMI = ('Rossi Russo Ferrari Esposito Bianchi Romano Colombo Ricci Marino Greco Bruno Gallo Conti De_Luca Mancini ' +
  'Costa Giordano Rizzo Lombardi Moretti Barbieri Fontana Santoro Mariani Rinaldi Caruso Ferrara Galli Martini Leone ' +
  'Longo Gentile Martinelli Vitale Lombardo Serra Coppola De_Santis Cattaneo Bellini').split(' ').map((c) => c.replace('_', ' '))
const NOMI = ('Leonardo Francesco Alessandro Lorenzo Mattia Tommaso Gabriele Andrea Riccardo Edoardo Matteo Giuseppe ' +
  'Sofia Aurora Giulia Ginevra Alice Beatrice Emma Giorgia Vittoria Ludovica Anna Martina Chiara Nicolò Pietro Elena').split(' ')

function elenco(seme: number, quanti: number): Array<{ cognome: string; nome: string }> {
  let x = seme * 9301 + 49297
  const caso = () => (x = (x * 9301 + 49297) % 233280) / 233280
  const fatti = new Map<string, { cognome: string; nome: string }>()
  while (fatti.size < quanti) {
    const p = { cognome: COGNOMI[Math.floor(caso() * COGNOMI.length)], nome: NOMI[Math.floor(caso() * NOMI.length)] }
    fatti.set(`${p.cognome} ${p.nome}`, p)
  }
  return [...fatti.values()]
}

/** L'id di una persona inventata: resta quello di prima, o le presenze salvate si staccherebbero. */
const idPersona = (p: { cognome: string; nome: string }) => `p-${`${p.cognome} ${p.nome}`.toLowerCase().replace(/[^a-z]+/g, '-')}`
export const idRicorrenza = (corsoId: string, giorno: number, ora: string) => `${corsoId}~${giorno}~${ora}`

function iniziale(): Archivio {
  const persone = new Map<string, PersonaProva>()
  for (const [id, nome] of Object.entries(ISTRUTTORI)) {
    persone.set(`i-${id}`, { id: `i-${id}`, nome, cognome: '', ruolo: 'istruttore', attiva: true, creataIl: STAGIONE.dal })
  }
  // Chi usa la prova: la segreteria che vede tutto.
  persone.set('s-prova', { id: 's-prova', nome: 'Segreteria', cognome: 'di prova', ruolo: 'staff', email: 'segreteria@esempio.it', attiva: true, creataIl: STAGIONE.dal })
  const iscrizioni: IscrizioneProva[] = []
  for (const c of CORSI) {
    for (const p of elenco(...c.iscritti)) {
      const id = idPersona(p)
      if (!persone.has(id)) {
        // Un'email a due su tre, come nei fogli veri: agli altri la segreteria telefona.
        const conEmail = id.length % 3 !== 0
        persone.set(id, {
          id,
          ...p,
          ruolo: 'iscritto',
          email: conEmail ? `${p.nome}.${p.cognome}`.toLowerCase().replace(/[^a-z.]+/g, '') + '@esempio.it' : undefined,
          attiva: true,
          creataIl: STAGIONE.dal,
        })
      }
      iscrizioni.push({ corsoId: c.id, personaId: id, dal: STAGIONE.dal })
    }
  }
  return {
    versione: VERSIONE,
    sale: ['Tatami', 'Lotta', 'Pesi', 'Motricità'],
    corsi: CORSI.map((c) => ({
      id: c.id,
      nome: c.nome,
      colore: c.colore,
      sala: c.sala,
      istruttori: c.istruttori.map((i) => `i-${i}`),
      capienza: c.capienza,
      attivo: true,
      ricorrenze: c.orari.map(([giorno, ora, durata]) => ({
        id: idRicorrenza(c.id, giorno, ora),
        giorno,
        ora,
        durata,
        dal: STAGIONE.dal,
        al: STAGIONE.al,
      })),
    })),
    persone: [...persone.values()],
    iscrizioni,
    lezioni: {},
  }
}

function leggi(): Archivio {
  try {
    const g = localStorage.getItem(DOVE)
    const a = g ? (JSON.parse(g) as Archivio) : null
    // Un archivio di un'altra versione si butta: è una prova, non un registro.
    if (a && a.versione === VERSIONE && Array.isArray(a.corsi) && Array.isArray(a.persone)) return a
  } catch {
    /* si riparte da capo */
  }
  return iniziale()
}

/** L'archivio, uno per pagina: chi lo cambia chiama `salva()`. */
export const archivio = {
  dati: leggi(),
  salva() {
    try {
      localStorage.setItem(DOVE, JSON.stringify(this.dati))
    } catch {
      /* resta per questa sessione */
    }
  },
  /** Torna all'orario di partenza. */
  azzera() {
    this.dati = iniziale()
    try {
      localStorage.removeItem(DOVE)
    } catch {
      /* pazienza */
    }
  },
}

/** Il nome di un istruttore, o della persona: per le liste e le intestazioni. */
export const nomeDi = (p: Pick<PersonaProva, 'nome' | 'cognome'>) => (p.cognome ? `${p.nome} ${p.cognome}` : p.nome)
