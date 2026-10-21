import { LIMITE_CAMBIO_VOCE, VOCE_CORSI, VOCE_DIFFERENZA, VOCE_QUOTA } from './contabilita'
import type { DatiSegreteria } from './segreteria'

/**
 * Lo storico del vecchio programma collegato alla persona che ha pagato (`supabase/70-movimenti-persona.sql`).
 * Il collegamento è un'etichetta («di chi è questo movimento»): non cambia importi, saldi né chiusure, e non è un
 * incasso nuovo, quindi lo storico di una persona sta sempre a parte, mai sommato ai suoi pagamenti.
 * Niente browser, niente database: le schermate e i dati la chiamano, e le prove la leggono sola. Le stesse regole
 * sono nel database (`collegamento_nome`, `collegamento_token`, `collegamento_perche`): qui servono alla modalità
 * prova e a dire il perché prima di scrivere.
 */

export interface PersonaPerNome {
  id: string
  nome: string
  cognome: string
}

/** Il minimo di un movimento per sapere se si collega e a chi: quello che dà `RigaMovimento`. */
export interface MovimentoDaCollegare {
  id: string
  tipo: 'entrata' | 'uscita' | 'giroconto'
  data: string
  importo: number
  descrizione: string
  voce: string | null
  annullato: boolean
  /** `prima-nota:N` per lo storico importato, vuoto per un movimento scritto a mano. */
  origineImport?: string
  personaId?: string
}

export interface RiepilogoCollegamenti {
  /** Nome e cognome della causale uguali a quelli di UNA sola scheda, non ancora collegati: il blocco li collega. */
  sicuri: { movimenti: number; persone: number; centesimi: number; dal: string | null; al: string | null }
  /** Due o più schede con quel nome: si decide a mano, mai in blocco. */
  daDecidere: { movimenti: number; centesimi: number }
  /** Nessuna scheda (un ex iscritto) o una causale senza nome: restano come sono. */
  senzaScheda: { movimenti: number; centesimi: number }
  giaCollegati: number
  /** Fino a cinque esempi dei sicuri, per riconoscere a occhio i nomi prima di confermare. */
  campione: Array<{ causale: string; persona: string }>
}

export interface CandidatoPersona {
  id: string
  nome: string
  cognome: string
  annoNascita?: number
  corsi: string[]
  iscrittoDal?: string
}

/** Un movimento dello storico di una persona, per la sua scheda. */
export interface VoceStorico {
  id: string
  data: string
  descrizione: string
  importo: number
  voce: string
  cassa: string
}

/**
 * Minuscolo, senza accenti, apostrofo dritto, spazi di ogni tipo uno solo: «José» e «JOSÈ» sono lo stesso nome. Il vecchio
 * programma scrive l'accento come apostrofo («NICOLO'»): in fondo alla parola dopo una vocale si toglie; dopo una
 * consonante («D'Amico», «Sant' Anna») è un'elisione e resta.
 */
export const normalizzaNome = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’‘`]/g, "'")
    .toLowerCase()
    .replace(/[\s ​]+/g, ' ')
    .trim()
    .replace(/([aeiou])'(?= |$)/g, '$1')

/** Il nome della causale dell'import, «Cliente NOME per …»: la prima «per» lo chiude. Altre causali: nessun nome. */
export function nomeDallaCausale(descrizione: string): string | null {
  const r = /^\s*cliente\s+([\s\S]+?)\s+per\s/i.exec(descrizione)
  return r ? r[1].replace(/\s+/g, ' ').trim() : null
}

// Le parole in ordine alfabetico: «Rossi Giulia» e «Giulia Rossi» sono lo stesso nome.
const chiave = (s: string): string => normalizzaNome(s).split(' ').filter(Boolean).sort().join(' ')

/** Con una scheda sola il nome è «sicuro»; con due o più sono omonimi; con nessuna (o senza nome) non c'è scheda. */
export function abbinaPersone(nome: string | null, persone: PersonaPerNome[]): { esito: 'sicuro' | 'omonimi' | 'nessuna'; ids: string[] } {
  const k = nome ? chiave(nome) : ''
  const ids = k ? persone.filter((p) => chiave(`${p.nome} ${p.cognome}`) === k).map((p) => p.id) : []
  return { esito: ids.length === 1 ? 'sicuro' : ids.length > 1 ? 'omonimi' : 'nessuna', ids }
}

const giornoMeseAnno = (data: string): string => data.split('-').reverse().join('/')

/** Perché un movimento non si collega, in parole per chi usa l'app; null se si può. Le stesse frasi del database. */
export function cosaNonVaCollegato(m: MovimentoDaCollegare): string | null {
  const q = `Il movimento del ${giornoMeseAnno(m.data)} (${m.descrizione})`
  if (m.annullato) return `${q} è annullato: non si collega`
  if (m.tipo === 'giroconto') return 'Un giroconto non ha una persona'
  if (m.voce === VOCE_DIFFERENZA) return `${q} è scritto dalla chiusura di cassa: non si collega`
  if (m.tipo === 'uscita') return `${q} è un’uscita: si collegano solo le entrate`
  if (!m.origineImport?.startsWith('prima-nota:')) return `${q} non viene dal vecchio programma: non si collega`
  if (m.voce !== VOCE_QUOTA && m.voce !== VOCE_CORSI) {
    return `${q} è su «${m.voce}»: si collegano solo quelli su «${VOCE_QUOTA}» e «${VOCE_CORSI}»`
  }
  return null
}

/** Quanti si collegherebbero e quanti no, per il riepilogo da confermare prima di scrivere. */
export function riepilogoCollegamenti(movimenti: MovimentoDaCollegare[], persone: PersonaPerNome[]): RiepilogoCollegamenti {
  const collegabili = movimenti.filter((m) => !cosaNonVaCollegato(m))
  const liberi = collegabili
    .filter((m) => !m.personaId)
    .map((m) => ({ m, a: abbinaPersone(nomeDallaCausale(m.descrizione), persone) }))
  const somma = (l: typeof liberi) => l.reduce((s, x) => s + x.m.importo, 0)
  const sicuri = liberi.filter((x) => x.a.esito === 'sicuro')
  const omonimi = liberi.filter((x) => x.a.esito === 'omonimi')
  const nessuna = liberi.filter((x) => x.a.esito === 'nessuna')
  const date = sicuri.map((x) => x.m.data).sort()
  const nomeDi = (id: string) => {
    const p = persone.find((y) => y.id === id)
    return p ? `${p.nome} ${p.cognome}` : ''
  }
  return {
    sicuri: { movimenti: sicuri.length, persone: new Set(sicuri.map((x) => x.a.ids[0])).size, centesimi: somma(sicuri), dal: date[0] ?? null, al: date.at(-1) ?? null },
    daDecidere: { movimenti: omonimi.length, centesimi: somma(omonimi) },
    senzaScheda: { movimenti: nessuna.length, centesimi: somma(nessuna) },
    giaCollegati: collegabili.filter((m) => m.personaId).length,
    campione: [...sicuri].sort((a, b) => a.m.data.localeCompare(b.m.data) || a.m.id.localeCompare(b.m.id)).slice(0, 5).map((x) => ({ causale: x.m.descrizione, persona: nomeDi(x.a.ids[0]) })),
  }
}

/** Cosa si può dire di un movimento ancora senza persona: una scheda sola col nome, due o più, nessuna. */
export type EsitoCollegamento = 'sicuro' | 'omonimi' | 'nessuna'

/** L'esito di ogni movimento che si può collegare e non lo è ancora: come `esiti_collegamenti_persona` del database. */
export function esitiCollegamenti(movimenti: MovimentoDaCollegare[], persone: PersonaPerNome[]): Array<{ id: string; esito: EsitoCollegamento }> {
  return movimenti
    .filter((m) => !m.personaId && !cosaNonVaCollegato(m))
    .map((m) => ({ id: m.id, esito: abbinaPersone(nomeDallaCausale(m.descrizione), persone).esito }))
    .sort((a, b) => a.id.localeCompare(b.id))
}

export type FiltroPersona = '' | 'collegati' | 'da_decidere' | 'senza_scheda'

/** Lo storico collegato a mano: gli incassi iscritti hanno la persona da sé, non si collegano né si scollegano. */
export const collegatoAMano = (r: { origine: string; personaId?: string }) => r.origine === 'movimento' && !!r.personaId

/**
 * Il filtro PERSONA dell'elenco: i collegati, gli omonimi da decidere, quelli senza scheda. Vuoto: tutti.
 * «Collegati» è lo storico collegato a mano: gli incassi iscritti hanno la persona da sé e coprirebbero quel lavoro.
 */
export function filtraPerPersona<T extends { id: string; origine: string; personaId?: string }>(righe: T[], filtro: FiltroPersona, esiti: Record<string, EsitoCollegamento | undefined>): T[] {
  if (!filtro) return righe
  if (filtro === 'collegati') return righe.filter(collegatoAMano)
  const voluto: EsitoCollegamento = filtro === 'da_decidere' ? 'omonimi' : 'nessuna'
  return righe.filter((r) => !r.personaId && esiti[r.id] === voluto)
}

/**
 * Il collegamento automatico a pacchetti: chiama `collegaSicuriPersona` finché ne restano, tutti con lo stesso lotto.
 * Non lancia mai: se un pacchetto si ferma rende quelli già collegati e la frase dell'errore, così chi chiama può
 * ancora togliere il lotto. Un giro per pacchetto, più due di margine se nel frattempo qualcuno ha scritto altro.
 */
export async function collegaTuttiISicuri(
  d: Pick<DatiSegreteria, 'collegaSicuriPersona'>,
  lotto: string,
  totale: number,
  suProgresso?: (collegati: number) => void,
): Promise<{ collegati: number; restano: number; errore?: string }> {
  let collegati = 0
  let restano = totale
  try {
    for (let giro = 0; giro < Math.ceil(totale / LIMITE_CAMBIO_VOCE) + 2; giro++) {
      const x = await d.collegaSicuriPersona(lotto, LIMITE_CAMBIO_VOCE)
      collegati += x.collegati
      restano = x.restano
      suProgresso?.(collegati)
      if (x.restano === 0 || x.collegati === 0) break
    }
  } catch (e) {
    return { collegati, restano, errore: e instanceof Error && e.message ? e.message : 'Non è cambiato niente in quel pacchetto: riprova.' }
  }
  return { collegati, restano }
}
