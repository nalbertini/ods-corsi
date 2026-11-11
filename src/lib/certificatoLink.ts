import { dataLunga } from './sala'

/**
 * Il certificato dal link, senza password (`142-certificato-link.sql`, Edge
 * Function `certificato`): i testi della pagina `certificato/` e la storia dei
 * solleciti nella scheda. Il file e la data si controllano anche nella
 * funzione e nel database: qui si dice prima, con le stesse parole.
 */

/** Il codice `<id>.<firma>` dell'indirizzo, o null se non ha la forma giusta. */
export function codiceDalLink(search: string): string | null {
  const l = new URLSearchParams(search).get('l')
  return l && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[A-Za-z0-9_-]{43}$/.test(l) ? l : null
}

/** Cosa non va nella data di scadenza scritta da chi carica (come `link_manda_certificato`), o null. */
export function cosaNonVaScadenza(scade: string, oggi: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(scade)) return 'Scrivi quando scade il certificato.'
  if (scade < oggi) return 'Questo certificato è già scaduto: serve quello nuovo.'
  const [a, m, g] = oggi.split('-')
  // Come `oggi + interval '3 years'` in Postgres: dal 29 febbraio si arriva al 28.
  const tetto = m === '02' && g === '29' ? `${Number(a) + 3}-02-28` : `${Number(a) + 3}-${m}-${g}`
  if (scade > tetto) return 'La data è troppo lontana: controlla l’anno.'
  return null
}

export interface InfoLink {
  nome: string
  iniziale: string
  tipo: 'normale' | 'agonistico'
  /** AAAA-MM-GG; manca se non c'è un termine. */
  entro?: string
}

/** Il titolo, l'etichetta e la frase della pagina, con solo nome, iniziale, tipo e data. */
export function testiLink(i: InfoLink): { titolo: string; etichetta: string; testo: string } {
  const tipo = i.tipo === 'agonistico' ? 'AGONISTICO' : 'NON AGONISTICO'
  const prima = i.tipo === 'agonistico' ? 'Per judo, aikido e lotta, dai 12 anni serve il certificato agonistico.' : 'Carica una foto o il PDF del certificato e scrivi quando scade.'
  return {
    titolo: `Certificato medico di ${i.nome} ${i.iniziale}.`,
    // «entro l’8», «entro l’11»: davanti alla vocale l'articolo si elide.
    etichetta: i.entro ? `${tipo} · ENTRO ${/^(8|11) /.test(dataLunga(i.entro, false)) ? 'L’' : 'IL '}${dataLunga(i.entro, false).toUpperCase()}` : tipo,
    testo: `${prima} La segreteria lo controlla: fino ad allora ${i.nome} viene alle lezioni.`,
  }
}

const gma = (g: string) => `${g.slice(8)}/${g.slice(5, 7)}/${g.slice(0, 4)}`

export type EsitoLink = { stato: 'arrivato' | 'non_vale'; nome?: string } | { stato: 'ricevuto'; scade: string }

/** La pagina quando non chiede il file: già arrivato, link che non vale, ricevuto. */
export function esitoLink(e: EsitoLink): { titolo: string; tono: 'fatto' | 'avviso'; testi: string[] } {
  if (e.stato === 'ricevuto')
    return { titolo: 'RICEVUTO', tono: 'fatto', testi: ['La segreteria lo controlla: non devi fare altro. Se qualcosa non va, ti scriviamo.', `Scade il ${gma(e.scade)}, come hai scritto.`] }
  if (e.stato === 'arrivato' && e.nome) return { titolo: 'GIÀ ARRIVATO', tono: 'fatto', testi: [`Il certificato di ${e.nome} è già arrivato ed è a posto. Grazie.`] }
  // Senza dire perché: non si conferma che la persona esiste.
  return { titolo: 'LINK NON VALIDO', tono: 'avviso', testi: ['Questo link non vale più: scrivi alla segreteria o passa in palestra.'] }
}

export interface StoricoSollecito {
  /** timestamptz */
  quando: string
  da?: string
  canale: 'whatsapp' | 'email'
  conLink: boolean
  /** timestamptz dell'ultima apertura del link, se dopo il sollecito */
  apertoIl?: string
}

// Sempre nel fuso di Roma, qualunque sia quello del computer che guarda: «5/12/2026».
const GIORNO_ROMA = new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', day: 'numeric', month: 'numeric', year: 'numeric' })
const gmaCorta = (iso: string) => {
  // it-IT mette lo zero davanti al giorno: qui no.
  const p = Object.fromEntries(GIORNO_ROMA.formatToParts(new Date(iso)).map((x) => [x.type, x.value]))
  return `${Number(p.day)}/${Number(p.month)}/${p.year}`
}

/** Una riga della storia dei solleciti: canale, giorno e chi; a destra, se c'era il link, se è stato aperto. */
export function rigaStoricoSollecito(s: StoricoSollecito): { testo: string; link?: string } {
  const testo = `${s.canale === 'email' ? 'Email' : 'WhatsApp'} · ${gmaCorta(s.quando)}${s.da ? ` da ${s.da}` : ''}`
  if (!s.conLink) return { testo }
  return { testo, link: s.apertoIl ? `link aperto il ${gmaCorta(s.apertoIl)}` : 'link non aperto' }
}
