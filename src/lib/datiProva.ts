import type { Dati } from './dati'
import type { Persona, SessioneVista, StatoPresenza } from './sala'
import { chiaveGiorno, perCognome } from './sala'

/**
 * La sala corsi senza server: l'orario vero della stagione 2026/27, con degli
 * iscritti inventati.
 *
 * Non è un ripiego per le prove. È anche il modo in cui si apre l'app e si
 * capisce cosa fa senza avere niente acceso, ed è quello che gira sul sito
 * pubblico finché la palestra non ha il suo database. Le presenze segnate qui
 * restano in `localStorage`, così la prova si comporta come la cosa vera:
 * chiudi, riapri, e l'appello è come l'avevi lasciato.
 *
 * I nomi degli iscritti sono inventati. Se somigliano a qualcuno è un caso.
 */

const DOVE = 'ods-corsi:prova-presenze'   // vedi la nota in coda.ts
const DOVE_ORIGINI = 'ods-corsi:prova-origini'

/** Un orario del corso: lo stesso corso può avere durate diverse nei vari giorni. */
interface Orario {
  /** 0 = domenica, come `getDay()`. */
  giorno: number
  ora: string
  durata: number
  /** Quando quel giorno la lezione si fa in un'altra sala. */
  sala?: string
}

interface Definizione {
  id: string
  nome: string
  colore: string
  sala: string
  /** Chi insegna. Vuoto quando non è ancora deciso. */
  istruttori: string[]
  orari: Orario[]
  iscritti: string[]
}

// L'orario 2026/27 del volantino «Corsi e attività», corretto dove il foglio
// dei costi dice altro (vale il foglio dei costi). Lunedì 1, venerdì 5.
const LMV = [1, 3, 5]
const MG = [2, 4]
const ogni = (giorni: number[], ora: string, durata: number): Orario[] => giorni.map((giorno) => ({ giorno, ora, durata }))

// I colori seguono la disciplina, non il corso: da lontano si vede se è judo o lotta.
const JUDO = '#1b8ac4'
const LOTTA = '#e4292a'
const PESI = '#f4c31b'
const MOTRICITA = '#16a54a'

/**
 * Gli iscritti sono inventati: ragazzi e ragazze con nomi comuni, messi
 * insieme con un generatore che dà sempre lo stesso risultato, così l'elenco
 * di un corso non cambia da un caricamento all'altro.
 */
const COGNOMI = ('Rossi Russo Ferrari Esposito Bianchi Romano Colombo Ricci Marino Greco Bruno Gallo Conti De Luca Mancini ' +
  'Costa Giordano Rizzo Lombardi Moretti Barbieri Fontana Santoro Mariani Rinaldi Caruso Ferrara Galli Martini Leone ' +
  'Longo Gentile Martinelli Vitale Lombardo Serra Coppola De Santis Cattaneo Bellini').split(' ').reduce<string[]>((a, x, i, t) => {
  // «De Luca» e «De Santis» sono cognomi di due parole.
  if (x === 'De') return a
  a.push(t[i - 1] === 'De' ? `De ${x}` : x)
  return a
}, [])
const NOMI = ('Leonardo Francesco Alessandro Lorenzo Mattia Tommaso Gabriele Andrea Riccardo Edoardo Matteo Giuseppe ' +
  'Sofia Aurora Giulia Ginevra Alice Beatrice Emma Giorgia Vittoria Ludovica Anna Martina Chiara Nicolò Pietro Elena').split(' ')

function elenco(seme: number, quanti: number): string[] {
  let x = seme * 9301 + 49297
  const caso = () => (x = (x * 9301 + 49297) % 233280) / 233280
  const fatti = new Set<string>()
  while (fatti.size < quanti) {
    fatti.add(`${COGNOMI[Math.floor(caso() * COGNOMI.length)]} ${NOMI[Math.floor(caso() * NOMI.length)]}`)
  }
  return [...fatti]
}

const CORSI: Definizione[] = [
  { id: 'judo-2', nome: 'Judo 2', colore: JUDO, sala: 'Tatami', istruttori: ['Maurizio'], orari: ogni(LMV, '17:00', 60), iscritti: elenco(1, 14) },
  { id: 'judo-3', nome: 'Judo 3', colore: JUDO, sala: 'Tatami', istruttori: ['Maurizio'], orari: ogni(LMV, '18:00', 60), iscritti: elenco(2, 16) },
  { id: 'judo-adulti', nome: 'Judo adulti', colore: JUDO, sala: 'Tatami', istruttori: ['Maurizio'], orari: ogni(LMV, '19:00', 90), iscritti: elenco(3, 12) },
  { id: 'judo-principianti', nome: 'Judo principianti', colore: JUDO, sala: 'Motricità', istruttori: ['Maurizio'], orari: ogni(LMV, '19:00', 90), iscritti: elenco(4, 8) },
  { id: 'judo-agonisti', nome: 'Judo agonisti', colore: JUDO, sala: 'Tatami', istruttori: ['Maurizio'], orari: ogni(MG, '18:00', 90), iscritti: elenco(5, 10) },

  { id: 'psicomotricita', nome: 'Psicomotricità', colore: MOTRICITA, sala: 'Motricità', istruttori: [], orari: [...ogni([5], '17:00', 50), ...ogni([5], '18:00', 50)], iscritti: elenco(6, 9) },
  { id: 'giocomotricita', nome: 'Giocomotricità', colore: MOTRICITA, sala: 'Lotta', istruttori: [], orari: ogni(MG, '17:00', 50), iscritti: elenco(7, 8) },
  { id: 'avviamento', nome: 'Avviamento arti marziali 1', colore: MOTRICITA, sala: 'Tatami', istruttori: [], orari: ogni(MG, '17:00', 60), iscritti: elenco(8, 10) },

  { id: 'lotta-2', nome: 'Lotta 2', colore: LOTTA, sala: 'Lotta', istruttori: ['Maura', 'Federico'], orari: ogni(LMV, '17:00', 60), iscritti: elenco(9, 12) },
  {
    id: 'lotta-3', nome: 'Lotta 3', colore: LOTTA, sala: 'Lotta', istruttori: ['Maura', 'Federico'],
    orari: ogni([1, 2, 3, 5], '18:00', 60),
    iscritti: elenco(10, 13),
  },

  { id: 'pesi-1', nome: 'Pesistica 1', colore: PESI, sala: 'Pesi', istruttori: [], orari: ogni(LMV, '17:00', 60), iscritti: elenco(11, 8) },
  { id: 'pesi-2', nome: 'Pesistica 2', colore: PESI, sala: 'Pesi', istruttori: [], orari: ogni(LMV, '18:00', 60), iscritti: elenco(12, 9) },
  { id: 'body-functional', nome: 'Body functional', colore: PESI, sala: 'Motricità', istruttori: ['Tiziano'], orari: ogni([3], '18:00', 60), iscritti: elenco(13, 11) },
  { id: 'pesi-agonisti', nome: 'Pesi agonisti', colore: PESI, sala: 'Pesi', istruttori: [], orari: ogni(MG, '17:00', 60), iscritti: elenco(14, 7) },

  { id: 'aikido-2', nome: 'Aikido 2', colore: MOTRICITA, sala: 'Motricità', istruttori: ['Fabio'], orari: ogni([1, 4], '17:00', 60), iscritti: elenco(15, 8) },
  { id: 'aikido-3', nome: 'Aikido 3', colore: MOTRICITA, sala: 'Motricità', istruttori: ['Fabio'], orari: ogni([1, 4], '18:00', 60), iscritti: elenco(16, 9) },

  { id: 'pre-pugilistica', nome: 'Prepugilistica', colore: LOTTA, sala: 'Pesi', istruttori: [], orari: ogni(LMV, '19:00', 90), iscritti: elenco(17, 10) },
  { id: 'mga', nome: 'MGA · metodo globale autodifesa', colore: LOTTA, sala: 'Lotta', istruttori: [], orari: ogni([5], '19:00', 60), iscritti: elenco(18, 9) },

  { id: 'prep-atletica-1', nome: 'Preparazione atletica 1', colore: PESI, sala: 'Pesi', istruttori: ['Maurizio', 'Katia', 'Manuel'], orari: ogni(MG, '18:00', 60), iscritti: elenco(19, 12) },
  { id: 'prep-atletica-2', nome: 'Preparazione atletica 2', colore: PESI, sala: 'Pesi', istruttori: ['Maurizio', 'Katia', 'Manuel'], orari: ogni(MG, '19:30', 60), iscritti: elenco(20, 11) },
  // Si allena insieme alla Pesistica 2, stessa sala e stessa ora: due corsi
  // perché iscritti e prezzi sono diversi, e ognuno ha il suo appello.
  { id: 'prep-atletica-3', nome: 'Preparazione atletica 3', colore: PESI, sala: 'Pesi', istruttori: ['Maurizio', 'Katia', 'Manuel'], orari: ogni(LMV, '18:00', 60), iscritti: elenco(21, 10) },
]

/** Una persona per ogni nome che compare in un elenco, con un id stabile. */
const REGISTRO = new Map<string, Persona>()
for (const c of CORSI) {
  for (const intero of c.iscritti) {
    if (REGISTRO.has(intero)) continue
    const [cognome, ...resto] = intero.split(' ')
    REGISTRO.set(intero, {
      id: `p-${intero.toLowerCase().replace(/[^a-z]+/g, '-')}`,
      cognome,
      nome: resto.join(' '),
      ruolo: 'iscritto',
    })
  }
}

/**
 * L'id di una lezione è corso + giorno + ora: la Psicomotricità del venerdì ha
 * due turni. Deve restare lo stesso fra un ricaricamento e l'altro, altrimenti
 * le presenze segnate si staccherebbero dalla lezione a cui appartengono.
 */
const idSessione = (corso: string, giorno: string, ora: string) => `s@${corso}@${giorno}@${ora}`

function istante(giorno: string, ora: string): Date {
  const [a, m, g] = giorno.split('-').map(Number)
  const [h, min] = ora.split(':').map(Number)
  return new Date(a, m - 1, g, h, min)
}

type Segnate = Record<string, Record<string, StatoPresenza>>
/**
 * Da dove arriva una presenza segnata dal tablet, e quando. Chi non è qui è
 * stato segnato dall'appello: è lo stesso `origine` del database, tenuto a
 * parte per non cambiare la forma delle presenze già salvate.
 */
export type Origini = Record<string, Record<string, { da: 'tablet' | 'recupero'; il: number; postazione: string }>>

function leggiOggetto<T>(dove: string): T {
  try {
    const g = localStorage.getItem(dove)
    const o: unknown = g ? JSON.parse(g) : {}
    return (o && typeof o === 'object' ? o : {}) as T
  } catch {
    return {} as T
  }
}

function scriviOggetto(dove: string, o: unknown) {
  try {
    localStorage.setItem(dove, JSON.stringify(o))
  } catch {
    /* Niente memoria: le presenze restano per questa sessione e basta. */
  }
}

/**
 * Le presenze di prova, una volta sola per pagina: l'app e il tablet di prova
 * leggono e scrivono le stesse, come col database vero.
 */
export const memoria = {
  segnate: leggiOggetto<Segnate>(DOVE),
  origini: leggiOggetto<Origini>(DOVE_ORIGINI),
  salva() {
    scriviOggetto(DOVE, this.segnate)
    scriviOggetto(DOVE_ORIGINI, this.origini)
  },
}

export function creaDatiProva(): Dati {
  const salva = () => memoria.salva()
  // Chi segna dall'app fa l'appello: la presenza non è più «dal tablet».
  const daAppello = (sessioneId: string, personaId?: string) => {
    const o = { ...(memoria.origini[sessioneId] ?? {}) }
    if (personaId) delete o[personaId]
    memoria.origini = { ...memoria.origini, [sessioneId]: personaId ? o : {} }
  }

  const vista = (c: Definizione, o: Orario, giorno: string): SessioneVista => {
    const inizio = istante(giorno, o.ora)
    const fine = new Date(inizio.getTime() + o.durata * 60_000)
    const id = idSessione(c.id, giorno, o.ora)
    const mie = memoria.segnate[id] ?? {}
    return {
      id,
      corsoId: c.id,
      corso: c.nome,
      colore: c.colore,
      sala: o.sala ?? c.sala,
      istruttore: c.istruttori.length ? c.istruttori.join(', ') : undefined,
      inizio: inizio.toISOString(),
      fine: fine.toISOString(),
      stato: 'prevista',
      iscritti: c.iscritti.length,
      presenti: Object.values(mie).filter((s) => s === 'presente').length,
    }
  }

  const trova = (sessioneId: string) => {
    const [prefisso, corsoId, giorno, ora] = sessioneId.split('@')
    if (prefisso !== 's') return null
    const corso = CORSI.find((c) => c.id === corsoId)
    const orario = corso?.orari.find((o) => o.ora === ora && o.giorno === istante(giorno, ora).getDay())
    return corso && orario ? { corso, orario, giorno } : null
  }

  return {
    modo: 'prova',

    async calendario(da, a) {
      const fuori = new Date(a)
      fuori.setHours(23, 59, 59)
      const lezioni: SessioneVista[] = []
      for (const d = new Date(da); d <= fuori; d.setDate(d.getDate() + 1)) {
        const giorno = chiaveGiorno(d)
        for (const c of CORSI) {
          for (const o of c.orari) if (o.giorno === d.getDay()) lezioni.push(vista(c, o, giorno))
        }
      }
      return lezioni.sort((x, y) => x.inizio.localeCompare(y.inizio))
    },

    async dettaglio(sessioneId) {
      const t = trova(sessioneId)
      if (!t) return null
      const mie = memoria.segnate[sessioneId] ?? {}
      const elenco = t.corso.iscritti
        .map((n) => REGISTRO.get(n)!)
        .sort(perCognome)
        .map((p) => ({ ...p, stato: mie[p.id] ?? null }))
      return {
        sessione: vista(t.corso, t.orario, t.giorno),
        elenco,
      }
    },

    async segna(sessioneId, personaId, stato) {
      const mie = { ...(memoria.segnate[sessioneId] ?? {}) }
      if (stato === null) delete mie[personaId]
      else mie[personaId] = stato
      memoria.segnate = { ...memoria.segnate, [sessioneId]: mie }
      daAppello(sessioneId, personaId)
      salva()
    },

    async segnaTutti(sessioneId, stato) {
      const t = trova(sessioneId)
      if (!t) return
      const mie: Record<string, StatoPresenza> = {}
      for (const n of t.corso.iscritti) mie[REGISTRO.get(n)!.id] = stato
      memoria.segnate = { ...memoria.segnate, [sessioneId]: mie }
      daAppello(sessioneId)
      salva()
    },

    async chiudi() {
      /* In prova non c'è uno stato da chiudere: la lezione è sempre «prevista». */
    },
  }
}

/** Solo per le prove: svuota le presenze finte. */
export function scordaProva() {
  memoria.segnate = {}
  memoria.origini = {}
  try {
    localStorage.removeItem(DOVE)
    localStorage.removeItem(DOVE_ORIGINI)
  } catch {
    /* pazienza */
  }
}
