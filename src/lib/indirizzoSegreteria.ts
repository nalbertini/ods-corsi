/**
 * Dove si è in segreteria, scritto dopo il cancelletto: la voce, la scheda
 * iscritto aperta, la lezione aperta, la settimana e la sala della griglia.
 * Così Indietro e Avanti del browser, la ricarica e un link copiato in
 * un'altra finestra riportano lì. Solo id, mai nomi: l'indirizzo finisce
 * nella cronologia e nei link incollati.
 *
 *   #iscritti/<id>
 *   #iscritti/nuovo           il modulo del nuovo iscritto
 *   #corsi/<id>
 *   #corsi/nuovo              il modulo del nuovo corso
 *   #settimana?dal=2026-09-28&sala=<id>&lezione=<id>&inizio=<ora>
 */

import { eIndirizzoGuida, INDIRIZZO_AREE } from './cancelletti'
import { chiaveGiorno, lunedi } from './sala'

export const VOCI = ['dafare', 'settimana', 'corsi', 'iscritti', 'richieste', 'presenze', 'segnalate', 'statistiche', 'istruttori', 'personale', 'esercizi', 'listino', 'vestiario', 'regole', 'segnalazioni'] as const
export type Voce = (typeof VOCI)[number]

export interface Posto {
  voce: Voce
  persona?: string
  corso?: string
  /** Il modulo del nuovo iscritto o del nuovo corso aperto: Indietro lo chiude come una scheda. */
  nuovo?: true
  lezione?: { id: string; inizio: string }
  /** Il lunedì della settimana in griglia, `AAAA-MM-GG`. */
  settimana?: string
  sala?: string
}

const DATA = /^\d{4}-\d{2}-\d{2}$/
const eVoce = (x: string): x is Voce => (VOCI as readonly string[]).includes(x)

/**
 * Il posto dell'indirizzo; un indirizzo che non si capisce porta a DA FARE.
 * `null` per i cancelletti degli altri, che la segreteria lascia stare: il
 * ritorno da un link di Supabase (`#access_token=…`, `#error=…`), la guida,
 * la scelta dell'area.
 */
export function leggiIndirizzo(hash: string, { prova }: { prova: boolean }): Posto | null {
  if (eIndirizzoGuida(hash) || hash === INDIRIZZO_AREE) return null
  // Supabase scrive coppie chiave=valore subito dopo il cancelletto.
  if (/^#[^/?]*=/.test(hash)) return null
  const dafare: Posto = { voce: 'dafare' }
  const [strada, coda = ''] = hash.replace(/^#/, '').split('?', 2)
  // Una barra in fondo non cambia posto: `#iscritti/` è l'elenco.
  const [voce, ...resto] = strada.replace(/\/$/, '').split('/')
  if (!voce) return dafare
  // Le segnalate ci sono solo in prova (vedi `Segreteria`).
  if (!eVoce(voce) || (voce === 'segnalate' && !prova)) return dafare
  if ((voce === 'iscritti' || voce === 'corsi') && resto.length === 1 && resto[0]) {
    // Gli id veri sono uuid (in prova `p-…`, `c-…`): «nuovo» non è mai una persona né un corso.
    if (resto[0] === 'nuovo') return { voce, nuovo: true }
    try {
      const id = decodeURIComponent(resto[0])
      return voce === 'iscritti' ? { voce, persona: id } : { voce, corso: id }
    } catch {
      // Un indirizzo storpiato (`%E0`): meglio DA FARE che uno schermo bianco.
      return dafare
    }
  }
  if (resto.length) return dafare
  if (voce !== 'settimana') return { voce }
  const q = new URLSearchParams(coda)
  const posto: Posto = { voce }
  const dal = q.get('dal')
  // Solo una data vera (non il 30 febbraio), portata al suo lunedì.
  if (dal && DATA.test(dal) && chiaveGiorno(new Date(`${dal}T00:00`)) === dal) posto.settimana = chiaveGiorno(lunedi(new Date(`${dal}T00:00`)))
  const sala = q.get('sala')
  if (sala) posto.sala = sala
  const lezione = q.get('lezione')
  const inizio = q.get('inizio')
  if (lezione && inizio && !Number.isNaN(Date.parse(inizio))) posto.lezione = { id: lezione, inizio }
  return posto
}

/** L'indirizzo di un posto, col cancelletto: solo i campi del posto, il resto resta fuori. */
export function scriviIndirizzo(p: Posto): string {
  if (p.voce === 'iscritti' && p.nuovo) return '#iscritti/nuovo'
  if (p.voce === 'iscritti' && p.persona) return `#iscritti/${encodeURIComponent(p.persona)}`
  if (p.voce === 'corsi' && p.nuovo) return '#corsi/nuovo'
  if (p.voce === 'corsi' && p.corso) return `#corsi/${encodeURIComponent(p.corso)}`
  if (p.voce !== 'settimana') return `#${p.voce}`
  const q = new URLSearchParams()
  if (p.settimana) q.set('dal', p.settimana)
  if (p.sala) q.set('sala', p.sala)
  if (p.lezione) {
    q.set('lezione', p.lezione.id)
    q.set('inizio', p.lezione.inizio)
  }
  const s = q.toString()
  return s ? `#settimana?${s}` : '#settimana'
}

/**
 * Dove porta un clic sul menu, o un «vai» da un'altra voce. La stessa voce
 * ritoccata chiude la scheda, il modulo nuovo o la lezione e tiene il resto (settimana e
 * sala); una voce diversa riparte da capo.
 */
export function postoDelMenu(ora: Posto, voce: Voce, dest: Pick<Posto, 'persona' | 'lezione'> = {}): Posto {
  if (voce === ora.voce && !dest.persona && !dest.lezione) {
    const { persona: _p, corso: _c, lezione: _l, nuovo: _n, ...resto } = ora
    return resto
  }
  return { voce, ...(dest.persona && { persona: dest.persona }), ...(dest.lezione && { lezione: dest.lezione }) }
}

/**
 * Il filtro acceso da DA FARE dopo un clic: quello chiesto, se c'è; se no
 * resta finché si resta nella voce, come fanno Indietro e Avanti. Spento,
 * l'elenco si rimonterebbe da capo, perdendo anche la ricerca.
 */
export function filtroDopo<F>(ora: Voce, voce: Voce, acceso: F | undefined, chiesto: F | undefined): F | undefined {
  return chiesto ?? (voce === ora ? acceso : undefined)
}

/**
 * Il posto a cui portano Indietro e Avanti (o un indirizzo scritto a mano).
 * `null` quando non c'è niente da fare: il cancelletto è degli altri, o è il
 * posto dove si è già.
 */
export function dopoIndietro(ora: Posto, hash: string, o: { prova: boolean }): Posto | null {
  const letto = leggiIndirizzo(hash, o)
  return letto && scriviIndirizzo(letto) !== scriviIndirizzo(ora) ? letto : null
}

/**
 * L'indirizzo da scrivere al posto di `hash` quando non è quello giusto (una
 * voce che non c'è, una barra in più, un giorno che non è lunedì); `null` se va
 * bene così, se non c'è o se è degli altri.
 */
export function indirizzoCorretto(hash: string, o: { prova: boolean }): string | null {
  const letto = leggiIndirizzo(hash, o)
  if (!letto || hash.length <= 1) return null
  const giusto = scriviIndirizzo(letto)
  return giusto === hash ? null : giusto
}

/** Il lunedì della settimana in griglia: quella della lezione aperta, se no quella dell'indirizzo, se no quella di oggi. */
export function settimanaDi(p: Posto, oggi: Date): Date {
  return lunedi(p.lezione ? new Date(p.lezione.inizio) : p.settimana ? new Date(`${p.settimana}T00:00`) : oggi)
}
