import type { Dati } from './dati'
import type { Persona, SessioneVista, StatoPresenza, StatoSessione } from './sala'
import { chiaveGiorno, perCognome } from './sala'
import { archivio, nomeDi, type CorsoProva, type RicorrenzaProva } from './archivioProva'
import type { ChiProva, GiaProvato } from './prove'
import { cosaNonVaProva, eGiaVenuto, pulisciProva } from './prove'

/**
 * La sala corsi senza server: l'orario vero della stagione 2026/27, con degli
 * iscritti inventati.
 *
 * Non è un ripiego per le prove. È anche il modo in cui si apre l'app e si
 * capisce cosa fa senza avere niente acceso, ed è quello che gira sul sito
 * pubblico finché la palestra non ha il suo database. Corsi e iscritti stanno
 * in `archivioProva.ts`, dove la segreteria di prova li cambia; le presenze
 * segnate restano in `localStorage`, così la prova si comporta come la cosa
 * vera: chiudi, riapri, e l'appello è come l'avevi lasciato.
 */

const DOVE = 'ods-corsi:prova-presenze'   // vedi la nota in coda.ts
const DOVE_ORIGINI = 'ods-corsi:prova-origini'

/**
 * L'id di una lezione è corso + giorno + ora: la Psicomotricità del venerdì ha
 * due turni. Deve restare lo stesso fra un ricaricamento e l'altro, altrimenti
 * le presenze segnate si staccherebbero dalla lezione a cui appartengono. Le
 * lezioni straordinarie hanno un id loro, che comincia per `x@`.
 */
const idSessione = (corso: string, giorno: string, ora: string) => `s@${corso}@${giorno}@${ora}`

function istante(giorno: string, ora: string): Date {
  const [a, m, g] = giorno.split('-').map(Number)
  const [h, min] = ora.split(':').map(Number)
  return new Date(a, m - 1, g, h, min)
}

/** Una lezione dell'archivio, prima di diventare quello che si mostra. */
export interface LezioneTrovata {
  id: string
  corso: CorsoProva
  inizio: Date
  fine: Date
  ricorrenza?: RicorrenzaProva
  straordinaria: boolean
}

const dentro = (giorno: string, r: { dal: string; al?: string }) => r.dal <= giorno && (!r.al || r.al >= giorno)

/** Le lezioni fra due istanti, generate dalle ricorrenze più le straordinarie. */
export function lezioniFra(da: Date, a: Date): LezioneTrovata[] {
  const fuori = new Date(a)
  fuori.setHours(23, 59, 59, 999)
  const x: LezioneTrovata[] = []
  for (const d = new Date(da); d <= fuori; d.setDate(d.getDate() + 1)) {
    const giorno = chiaveGiorno(d)
    for (const c of archivio.dati.corsi) {
      if (!c.attivo) continue
      for (const r of c.ricorrenze) {
        if (r.giorno !== d.getDay() || !dentro(giorno, r)) continue
        const inizio = istante(giorno, r.ora)
        x.push({ id: idSessione(c.id, giorno, r.ora), corso: c, inizio, fine: new Date(inizio.getTime() + r.durata * 60_000), ricorrenza: r, straordinaria: false })
      }
    }
  }
  for (const [id, l] of Object.entries(archivio.dati.lezioni)) {
    const s = l.straordinaria
    const corso = s && archivio.dati.corsi.find((c) => c.id === s.corsoId)
    if (!s || !corso) continue
    const inizio = new Date(s.inizio)
    if (inizio >= da && inizio <= fuori) x.push({ id, corso, inizio, fine: new Date(inizio.getTime() + s.durata * 60_000), straordinaria: true })
  }
  return x.sort((p, q) => p.inizio.getTime() - q.inizio.getTime() || p.corso.nome.localeCompare(q.corso.nome, 'it'))
}

/** Una lezione per id, anche di un corso archiviato: il suo registro resta. */
export function trovaLezione(sessioneId: string): LezioneTrovata | null {
  if (sessioneId.startsWith('x@')) {
    const s = archivio.dati.lezioni[sessioneId]?.straordinaria
    const corso = s && archivio.dati.corsi.find((c) => c.id === s.corsoId)
    if (!s || !corso) return null
    const inizio = new Date(s.inizio)
    return { id: sessioneId, corso, inizio, fine: new Date(inizio.getTime() + s.durata * 60_000), straordinaria: true }
  }
  const [prefisso, corsoId, giorno, ora] = sessioneId.split('@')
  if (prefisso !== 's') return null
  const corso = archivio.dati.corsi.find((c) => c.id === corsoId)
  const inizio = istante(giorno, ora)
  const r = corso?.ricorrenze.find((x) => x.ora === ora && x.giorno === inizio.getDay() && dentro(giorno, x))
  if (!corso || !r) return null
  return { id: sessioneId, corso, inizio, fine: new Date(inizio.getTime() + r.durata * 60_000), ricorrenza: r, straordinaria: false }
}

/** Chi era iscritto a un corso in un certo giorno: l'elenco dell'appello di quel giorno. */
export function iscrittiIl(corsoId: string, giorno: string): Persona[] {
  const persone = new Map(archivio.dati.persone.map((p) => [p.id, p]))
  return archivio.dati.iscrizioni
    .filter((i) => i.corsoId === corsoId && dentro(giorno, i))
    .map((i) => persone.get(i.personaId))
    .filter((p): p is NonNullable<typeof p> => !!p && p.attiva)
    .map((p) => ({ id: p.id, nome: p.nome, cognome: p.cognome, ruolo: p.ruolo }))
}

/** La sala, l'istruttore e lo stato della lezione: quelli decisi a mano, o quelli del giorno e del corso. */
export function comeE(l: LezioneTrovata): { sala: string; istruttori: string[]; sostituto?: string; stato: StatoSessione } {
  const m = archivio.dati.lezioni[l.id] ?? {}
  return {
    sala: m.sala ?? salaDelGiorno(l),
    istruttori: m.istruttore ? [m.istruttore] : l.corso.istruttori,
    sostituto: m.istruttore ?? undefined,
    stato: m.stato ?? 'prevista',
  }
}

/** La sala di una lezione se nessuno la sposta: quella del suo giorno, o quella del corso. */
export const salaDelGiorno = (l: LezioneTrovata) => l.ricorrenza?.sala ?? l.corso.sala

export const nomeIstruttore = (id: string) => {
  const p = archivio.dati.persone.find((x) => x.id === id)
  return p ? nomeDi(p) : '—'
}

/** Chi è venuto a provare una lezione, in ordine di cognome: come `proveDi` del database. */
export function proveDi(sessioneId: string): Persona[] {
  const persone = new Map(archivio.dati.persone.map((p) => [p.id, p]))
  return (archivio.dati.prove ?? [])
    .filter((x) => x.sessioneId === sessioneId)
    .map((x) => persone.get(x.personaId))
    .filter((p): p is NonNullable<typeof p> => !!p && p.attiva)
    .map((p) => ({ id: p.id, nome: p.nome, cognome: p.cognome, ruolo: p.ruolo }))
    .sort(perCognome)
}

/** L'appello di una lezione: gli iscritti di quel giorno, poi le prove. */
function appelloDi(t: LezioneTrovata): Array<Persona & { prova?: boolean }> {
  const iscritti = iscrittiIl(t.corso.id, chiaveGiorno(t.inizio)).sort(perCognome)
  const qui = new Set(iscritti.map((p) => p.id))
  return [...iscritti, ...proveDi(t.id).filter((p) => !qui.has(p.id)).map((p) => ({ ...p, prova: true }))]
}

const GIORNO = 24 * 60 * 60_000

/** Come `gia_provati`: chi ha provato negli ultimi novanta giorni, una volta sola, con l'ultima lezione. */
export function provatiProva(conTelefono: boolean): GiaProvato[] {
  const persone = new Map(archivio.dati.persone.map((p) => [p.id, p]))
  const ultime = new Map<string, GiaProvato>()
  for (const x of archivio.dati.prove ?? []) {
    const p = persone.get(x.personaId)
    const l = trovaLezione(x.sessioneId)
    if (!p || !p.attiva || !l || l.inizio.getTime() < Date.now() - 90 * GIORNO) continue
    const prima = ultime.get(p.id)
    if (prima && prima.inizio >= l.inizio.toISOString()) continue
    ultime.set(p.id, {
      id: p.id,
      nome: p.nome,
      cognome: p.cognome,
      telefono: conTelefono ? p.telefono : undefined,
      corso: l.corso.nome,
      inizio: l.inizio.toISOString(),
    })
  }
  return [...ultime.values()].sort((a, b) => b.inizio.localeCompare(a.inizio))
}

/**
 * Come `metti_prova`: aggiunge chi viene a provare, già presente, e la
 * persona se è nuova. `da` è chi l'ha aggiunta, quando si sa.
 */
export function mettiProva(sessioneId: string, chi: ChiProva, da?: string): Persona {
  const t = trovaLezione(sessioneId)
  if (!t) throw new Error('lezione inesistente')
  if (comeE(t).stato === 'annullata') throw new Error('lezione annullata')
  let persona: Persona
  let nuova = false
  if (eGiaVenuto(chi)) {
    const p = archivio.dati.persone.find((x) => x.id === chi.id)
    if (!p) throw new Error('persona inesistente')
    if (p.ruolo !== 'iscritto') throw new Error('una prova è per chi viene ad allenarsi')
    if (!p.attiva) throw new Error('questa persona è disattivata: la riattiva la segreteria')
    if (iscrittiIl(t.corso.id, chiaveGiorno(t.inizio)).some((x) => x.id === p.id)) throw new Error("è già iscritto a questo corso: è nell'appello")
    persona = { id: p.id, nome: p.nome, cognome: p.cognome, ruolo: p.ruolo }
  } else {
    const no = cosaNonVaProva(chi)
    if (no) throw new Error(no)
    const n = pulisciProva(chi)
    persona = { id: `p-prova-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, nome: n.nome, cognome: n.cognome, ruolo: 'iscritto' }
    archivio.dati.persone = [...archivio.dati.persone, { ...persona, telefono: n.telefono, attiva: true, creataIl: new Date().toISOString() }]
    nuova = true
  }
  const prove = archivio.dati.prove ?? []
  if (!prove.some((x) => x.sessioneId === sessioneId && x.personaId === persona.id)) {
    archivio.dati.prove = [...prove, { sessioneId, personaId: persona.id, il: new Date().toISOString(), da, nuova }]
  }
  archivio.salva()
  const mie = memoria.segnate[sessioneId] ?? {}
  if (!mie[persona.id]) {
    memoria.segnate = { ...memoria.segnate, [sessioneId]: { ...mie, [persona.id]: 'presente' } }
    memoria.salva()
  }
  return persona
}

/** Come `togli_prova_da`: col suo segno, e con la persona se è nata qui e non ha nient'altro. */
export function togliProvaDa(sessioneId: string, personaId: string) {
  const prove = archivio.dati.prove ?? []
  const x = prove.find((p) => p.sessioneId === sessioneId && p.personaId === personaId)
  if (!x) return
  archivio.dati.prove = prove.filter((p) => p !== x)
  const t = trovaLezione(sessioneId)
  if (!t || !iscrittiIl(t.corso.id, chiaveGiorno(t.inizio)).some((p) => p.id === personaId)) {
    const mie = { ...(memoria.segnate[sessioneId] ?? {}) }
    delete mie[personaId]
    memoria.segnate = { ...memoria.segnate, [sessioneId]: mie }
    memoria.salva()
  }
  const resta =
    archivio.dati.prove.some((p) => p.personaId === personaId) ||
    archivio.dati.iscrizioni.some((i) => i.personaId === personaId) ||
    Object.values(memoria.segnate).some((m) => personaId in m) ||
    (archivio.dati.ricevute ?? []).some((r) => r.personaId === personaId)
  if (x.nuova && !resta) archivio.dati.persone = archivio.dati.persone.filter((p) => p.id !== personaId)
  archivio.salva()
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

  const vista = (l: LezioneTrovata): SessioneVista => {
    const mie = memoria.segnate[l.id] ?? {}
    const k = comeE(l)
    return {
      id: l.id,
      corsoId: l.corso.id,
      corso: l.corso.nome,
      colore: l.corso.colore,
      sala: k.sala,
      istruttore: k.istruttori.length ? k.istruttori.map(nomeIstruttore).join(', ') : undefined,
      insegnanti: k.istruttori,
      inizio: l.inizio.toISOString(),
      fine: l.fine.toISOString(),
      stato: k.stato,
      iscritti: iscrittiIl(l.corso.id, chiaveGiorno(l.inizio)).length,
      presenti: Object.values(mie).filter((s) => s === 'presente').length,
    }
  }

  return {
    modo: 'prova',

    async calendario(da, a) {
      return lezioniFra(da, a).map(vista)
    },

    async dettaglio(sessioneId) {
      const t = trovaLezione(sessioneId)
      if (!t) return null
      const mie = memoria.segnate[sessioneId] ?? {}
      const elenco = appelloDi(t).map((p) => ({ ...p, stato: mie[p.id] ?? null }))
      return {
        sessione: vista(t),
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
      const t = trovaLezione(sessioneId)
      if (!t) return
      const mie: Record<string, StatoPresenza> = {}
      for (const p of appelloDi(t)) mie[p.id] = stato
      memoria.segnate = { ...memoria.segnate, [sessioneId]: mie }
      daAppello(sessioneId)
      salva()
    },

    async provati() {
      return provatiProva(true)
    },

    async aggiungiProva(sessioneId, chi) {
      const p = mettiProva(sessioneId, chi)
      daAppello(sessioneId, p.id)
      salva()
      return p
    },

    async togliProva(sessioneId, personaId) {
      togliProvaDa(sessioneId, personaId)
      daAppello(sessioneId, personaId)
      salva()
    },

    async chiudi(sessioneId) {
      archivio.dati.lezioni = { ...archivio.dati.lezioni, [sessioneId]: { ...archivio.dati.lezioni[sessioneId], stato: 'svolta' } }
      archivio.salva()
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
