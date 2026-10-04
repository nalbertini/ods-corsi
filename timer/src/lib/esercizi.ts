import { uid } from './format'
import { type Disciplina, DISCIPLINE_DI_PARTENZA, ripulisciDisciplina } from './discipline'

/**
 * Il catalogo degli esercizi.
 *
 * Serve a non riscrivere gli stessi nomi a ogni timer, ma soprattutto a rendere
 * finito l'insieme dei nomi: la clip della voce di un esercizio si chiama come
 * il suo nome, quindi con un catalogo diventa un elenco che si può incidere.
 */
export interface Esercizio {
  id: string
  nome: string
  /**
   * L'unica divisione degli esercizi (per chi usa l'app, la «categoria»): una
   * voce dell'elenco della segreteria (`discipline.ts`) o `tutte`; senza, non è
   * in nessuna in particolare. Il campo si chiama ancora `disciplina` perché
   * timer e liste di musica usano lo stesso elenco.
   */
  disciplina?: string
  /** Vero per quelli aggiunti a mano: nel picker solo quelli si tolgono al volo. */
  propri?: boolean
}

const CHIAVE = 'ods-timer:esercizi'

/** Un punto di partenza per una palestra di judo, da curare a piacere. */
export function catalogoDiPartenza(): Esercizio[] {
  const per = (disciplina: string, nomi: string[]): Esercizio[] => nomi.map((nome) => ({ id: uid(), nome, disciplina }))
  return [
    ...per('judo', [
      'Uchi komi', 'Nage komi', 'Ukemi', 'Ne waza', 'Randori', 'Kuzushi',
      'Entrate di seoi nage', 'Passaggi di guardia', 'Sprawl', 'Fuga d’anca', 'Ponte',
    ]),
    ...per('corpo-libero', [
      'Burpee', 'Burpee + salto', 'Piegamenti', 'Squat', 'Jump squat', 'Affondi alternati',
      'Plank jack', 'Mountain climber', 'Salto sul box', 'Trazioni', 'Dip', 'Step up',
    ]),
    ...per('attrezzi', [
      'Kettlebell swing', 'Goblet squat', 'Stacco rumeno', 'Panca piana', 'Lat machine',
      'Leg press', 'Vogatore', 'Palla medica', 'Trascinamento sacco', 'Corda da arrampicata',
    ]),
    ...per('core', [
      'Plank', 'Plank laterale', 'Hollow hold', 'Russian twist', 'Bicicletta', 'V-up',
      'Superman', 'Sit up',
    ]),
    ...per('cardio', [
      'Corsa sul posto', 'Skip alto', 'Salti con la corda', 'Jumping jack', 'Scatti navetta', 'Cyclette',
    ]),
    ...per('mobilita', [
      'Mobilità anche', 'Mobilità spalle', 'Rotazioni del busto', 'Stretching collo', 'Respirazione',
    ]),
  ]
}

// Le vecchie categorie degli esercizi: ora sono voci dell'elenco, con questi id
// (gli stessi di `supabase/42-categorie-esercizi.sql`). «Judo» era una categoria ancora prima.
const VOCE_DELLA_CATEGORIA = new Map([
  ['Judo', 'judo'],
  ['A corpo libero', 'corpo-libero'],
  ['Attrezzi', 'attrezzi'],
  ['Core', 'core'],
  ['Cardio', 'cardio'],
  ['Mobilità', 'mobilita'],
])

/**
 * L'unica categoria di un esercizio letto da fuori (il browser, il database,
 * un backup, o un'app non ancora aggiornata che scrive ancora `categoria`).
 * Una disciplina scritta vince, anche se non c'è più nell'elenco (e allora
 * l'esercizio resta senza); se no, la vecchia categoria diventa la voce con lo
 * stesso nome, se c'è nell'elenco. Nessuna voce è permessa.
 */
export function disciplinaDi(
  categoria: unknown,
  disciplina: unknown,
  discipline: Disciplina[] = DISCIPLINE_DI_PARTENZA,
): string | undefined {
  if (typeof disciplina === 'string' && disciplina) return ripulisciDisciplina(disciplina, discipline)
  return ripulisciDisciplina(typeof categoria === 'string' ? VOCE_DELLA_CATEGORIA.get(categoria) : undefined, discipline)
}

/** Un esercizio con la categoria ripulita; il resto com'è. */
export function esercizioPulito(e: Esercizio, discipline?: Disciplina[]): Esercizio {
  // `as`: una copia vecchia può avere ancora `categoria`, che il tipo non ha più.
  const disciplina = disciplinaDi((e as { categoria?: unknown }).categoria, e.disciplina, discipline)
  const out: Esercizio = { id: e.id, nome: e.nome }
  if (disciplina) out.disciplina = disciplina
  if (e.propri) out.propri = e.propri
  return out
}

function leggi<T>(chiave: string, ripiego: T): T {
  try {
    const grezzo = localStorage.getItem(chiave)
    return grezzo ? (JSON.parse(grezzo) as T) : ripiego
  } catch {
    return ripiego
  }
}

export function loadEsercizi(discipline?: Disciplina[]): Esercizio[] {
  // Un elenco vuoto è una scelta, non un errore: chi svuota il catalogo per
  // incollare quello vero della palestra non se lo deve ritrovare com'era.
  const salvati = leggi<Esercizio[] | null>(CHIAVE, null)
  if (Array.isArray(salvati)) {
    const sani = salvati.map((e) => esercizioPulito(e, discipline))
    // Chi aveva «Judo» come categoria si ritrova il catalogo migrato: lo si risalva.
    if (JSON.stringify(sani) !== JSON.stringify(salvati)) saveEsercizi(sani)
    return sani
  }
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
  disciplina?: string,
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
    nuovi.push({ id: uid(), nome, ...(disciplina ? { disciplina } : {}), propri: true })
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
