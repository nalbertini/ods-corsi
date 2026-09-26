import { uid } from './format'

/**
 * Il catalogo degli esercizi.
 *
 * Serve a non riscrivere gli stessi nomi a ogni timer, ma soprattutto a rendere
 * finito l'insieme dei nomi: la clip della voce di un esercizio si chiama come
 * il suo nome, quindi con un catalogo diventa un elenco che si può incidere.
 */
export type Categoria = 'Judo' | 'A corpo libero' | 'Attrezzi' | 'Core' | 'Cardio' | 'Mobilità'

export const CATEGORIE: Categoria[] = ['Judo', 'A corpo libero', 'Attrezzi', 'Core', 'Cardio', 'Mobilità']

export interface Esercizio {
  id: string
  nome: string
  categoria: Categoria
  /** Vero per quelli aggiunti a mano: nel picker solo quelli si tolgono al volo. */
  propri?: boolean
}

const CHIAVE = 'ods-timer:esercizi'

/** Un punto di partenza per una palestra di judo, da curare a piacere. */
export function catalogoDiPartenza(): Esercizio[] {
  const per = (categoria: Categoria, nomi: string[]): Esercizio[] =>
    nomi.map((nome) => ({ id: uid(), nome, categoria }))
  return [
    ...per('Judo', [
      'Uchi komi', 'Nage komi', 'Ukemi', 'Ne waza', 'Randori', 'Kuzushi',
      'Entrate di seoi nage', 'Passaggi di guardia', 'Sprawl', 'Fuga d’anca', 'Ponte',
    ]),
    ...per('A corpo libero', [
      'Burpee', 'Burpee + salto', 'Piegamenti', 'Squat', 'Jump squat', 'Affondi alternati',
      'Plank jack', 'Mountain climber', 'Salto sul box', 'Trazioni', 'Dip', 'Step up',
    ]),
    ...per('Attrezzi', [
      'Kettlebell swing', 'Goblet squat', 'Stacco rumeno', 'Panca piana', 'Lat machine',
      'Leg press', 'Vogatore', 'Palla medica', 'Trascinamento sacco', 'Corda da arrampicata',
    ]),
    ...per('Core', [
      'Plank', 'Plank laterale', 'Hollow hold', 'Russian twist', 'Bicicletta', 'V-up',
      'Superman', 'Sit up',
    ]),
    ...per('Cardio', [
      'Corsa sul posto', 'Skip alto', 'Salti con la corda', 'Jumping jack', 'Scatti navetta', 'Cyclette',
    ]),
    ...per('Mobilità', [
      'Mobilità anche', 'Mobilità spalle', 'Rotazioni del busto', 'Stretching collo', 'Respirazione',
    ]),
  ]
}

function leggi<T>(chiave: string, ripiego: T): T {
  try {
    const grezzo = localStorage.getItem(chiave)
    return grezzo ? (JSON.parse(grezzo) as T) : ripiego
  } catch {
    return ripiego
  }
}

export function loadEsercizi(): Esercizio[] {
  // Un elenco vuoto è una scelta, non un errore: chi svuota il catalogo per
  // incollare quello vero della palestra non se lo deve ritrovare com'era.
  const salvati = leggi<Esercizio[] | null>(CHIAVE, null)
  if (Array.isArray(salvati)) return salvati
  const iniziale = catalogoDiPartenza()
  saveEsercizi(iniziale)
  return iniziale
}

export function saveEsercizi(lista: Esercizio[]) {
  try {
    localStorage.setItem(CHIAVE, JSON.stringify(lista))
  } catch {
    // Spazio esaurito o storage negato: il catalogo resta valido per questa sessione.
  }
}

/** Ricerca tollerante: senza accenti e senza badare alle maiuscole. */
export function normalizza(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
}

/** Due nomi che si riferiscono allo stesso esercizio. */
export const stessoNome = (a: string, b: string) => normalizza(a) === normalizza(b)

/**
 * Aggiunge un elenco di nomi al catalogo, saltando quelli che ci sono già e i
 * doppioni interni all'elenco stesso. Serve a incollare la lista della
 * palestra in un colpo solo invece di scriverla riga per riga.
 */
export function aggiungiNomi(
  catalogo: Esercizio[],
  nomi: string[],
  categoria: Categoria,
): { lista: Esercizio[]; aggiunti: string[]; saltati: string[] } {
  const visti = new Set(catalogo.map((e) => normalizza(e.nome)))
  const aggiunti: string[] = []
  const saltati: string[] = []
  const nuovi: Esercizio[] = []
  for (const grezzo of nomi) {
    const nome = grezzo.trim()
    if (!nome) continue
    const chiave = normalizza(nome)
    if (visti.has(chiave)) {
      saltati.push(nome)
      continue
    }
    visti.add(chiave)
    nuovi.push({ id: uid(), nome, categoria, propri: true })
    aggiunti.push(nome)
  }
  return { lista: [...catalogo, ...nuovi], aggiunti, saltati }
}

/** I nomi di un testo incollato: uno per riga, oppure separati da virgola. */
export function nomiDaTesto(testo: string): string[] {
  return testo
    .split(/[\n,;]+/)
    .map((r) => r.replace(/^[\s\-–—•*\d.)]+/, '').trim())
    .filter(Boolean)
}
