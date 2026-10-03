/**
 * Dove si è in segreteria, scritto dopo il cancelletto: la voce, la scheda
 * iscritto aperta, la lezione aperta, la settimana e la sala della griglia.
 * Così Indietro e Avanti del browser, la ricarica e un link copiato in
 * un'altra finestra riportano lì. Solo id, mai nomi: l'indirizzo finisce
 * nella cronologia e nei link incollati.
 *
 *   #iscritti/<id>
 *   #settimana?dal=2026-09-28&sala=<id>&lezione=<id>&inizio=<ora>
 */

export const VOCI = ['dafare', 'settimana', 'corsi', 'iscritti', 'richieste', 'presenze', 'segnalate', 'statistiche', 'istruttori', 'importa', 'personale', 'esercizi', 'listino', 'regole', 'segnalazioni'] as const
export type Voce = (typeof VOCI)[number]

export interface Posto {
  voce: Voce
  persona?: string
  lezione?: { id: string; inizio: string }
  /** Il lunedì della settimana in griglia, `AAAA-MM-GG`. */
  settimana?: string
  sala?: string
}

// Gli indirizzi della guida e della scelta dell'area, come `eIndirizzoGuida` e
// `INDIRIZZO_AREE`: quei file si portano dietro Vite e React, e qui si prova senza browser.
const DEGLI_ALTRI = /^#(guida(\/|$)|aree$)/
const DATA = /^\d{4}-\d{2}-\d{2}$/
const eVoce = (x: string): x is Voce => (VOCI as readonly string[]).includes(x)

/**
 * Il posto dell'indirizzo; un indirizzo che non si capisce porta a DA FARE.
 * `null` per i cancelletti degli altri, che la segreteria lascia stare: il
 * ritorno da un link di Supabase (`#access_token=…`, `#error=…`), la guida,
 * la scelta dell'area.
 */
export function leggiIndirizzo(hash: string, { prova }: { prova: boolean }): Posto | null {
  if (DEGLI_ALTRI.test(hash)) return null
  // Supabase scrive coppie chiave=valore subito dopo il cancelletto.
  if (/^#[^/?]*=/.test(hash)) return null
  const dafare: Posto = { voce: 'dafare' }
  const [strada, coda = ''] = hash.replace(/^#/, '').split('?', 2)
  const [voce, ...resto] = strada.split('/')
  if (!voce) return dafare
  // Le segnalate ci sono solo in prova (vedi `Segreteria`).
  if (!eVoce(voce) || (voce === 'segnalate' && !prova)) return dafare
  if (voce === 'iscritti' && resto.length === 1 && resto[0]) {
    try {
      return { voce, persona: decodeURIComponent(resto[0]) }
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
  if (dal && DATA.test(dal)) posto.settimana = dal
  const sala = q.get('sala')
  if (sala) posto.sala = sala
  const lezione = q.get('lezione')
  const inizio = q.get('inizio')
  if (lezione && inizio && !Number.isNaN(Date.parse(inizio))) posto.lezione = { id: lezione, inizio }
  return posto
}

/** L'indirizzo di un posto, col cancelletto: solo i campi del posto, il resto resta fuori. */
export function scriviIndirizzo(p: Posto): string {
  if (p.voce === 'iscritti' && p.persona) return `#iscritti/${encodeURIComponent(p.persona)}`
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
