/**
 * Le discipline della palestra: Judo, Lotta, Pilates, Yoga…
 *
 * Gli esercizi, i timer e le liste di musica si dividono per disciplina, oltre
 * che per tipo. Una voce ne ha una sola, o nessuna. «Tutte» (id riservato)
 * non sta nella lista: è per le voci comuni, come il riscaldamento, e compare
 * sotto ogni disciplina. La lista la tiene la segreteria
 * (`supabase/40-discipline.sql`); quel che arriva dal database o da un backup
 * si ripulisce qui.
 */
export interface Disciplina {
  id: string
  nome: string
}

export const TUTTE = 'tutte'
export const NOME_TUTTE = 'Tutte'

export const DISCIPLINE_DI_PARTENZA: Disciplina[] = [
  { id: 'judo', nome: 'Judo' },
  { id: 'lotta', nome: 'Lotta' },
  { id: 'pilates', nome: 'Pilates' },
  { id: 'yoga', nome: 'Yoga' },
]

export const MAX_DISCIPLINE = 20
export const MAX_NOME_DISCIPLINA = 30

const ID_VALIDO = /^[a-z0-9-]{1,30}$/

/** Un id scritto come si scrivono gli id delle discipline (non vuol dire che esista). */
export const eIdDisciplina = (x: unknown): x is string => typeof x === 'string' && ID_VALIDO.test(x)

/** Senza accenti, senza maiuscole e senza spazi ai bordi: per confrontare due nomi. */
const chiave = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()

/** La lista come arriva dal database o da un backup, ripulita. Mancante o sbagliata: quella di partenza. */
export function disciplineDa(grezzo: unknown): Disciplina[] {
  if (!Array.isArray(grezzo)) return DISCIPLINE_DI_PARTENZA.map((d) => ({ ...d }))
  const ids = new Set<string>()
  const nomi = new Set<string>()
  const lista: Disciplina[] = []
  for (const g of grezzo) {
    if (lista.length >= MAX_DISCIPLINE) break
    if (!g || typeof g !== 'object') continue
    // `as`: è un oggetto non nullo (controllato qui sopra); i campi si verificano subito dopo.
    const { id, nome: n } = g as Record<string, unknown>
    if (typeof id !== 'string' || typeof n !== 'string') continue
    const nome = n.trim()
    if (!ID_VALIDO.test(id) || id === TUTTE) continue
    if (!nome || nome.length > MAX_NOME_DISCIPLINA) continue
    if (ids.has(id) || nomi.has(chiave(nome))) continue
    ids.add(id)
    nomi.add(chiave(nome))
    lista.push({ id, nome })
  }
  return lista
}

/** Perché un nome non va bene, detto a chi lo scrive; `null` se va bene. `eccetto` è la disciplina che si sta rinominando. */
export function nomeDisciplinaValido(nome: string, lista: Disciplina[], eccetto?: string): string | null {
  const n = nome.trim()
  if (!n) return 'Scrivi il nome della disciplina.'
  if (n.length > MAX_NOME_DISCIPLINA) return `Il nome è troppo lungo: al massimo ${MAX_NOME_DISCIPLINA} lettere.`
  if (chiave(n) === chiave(NOME_TUTTE)) return '«Tutte» c’è già: è per le voci comuni a tutte le discipline.'
  if (lista.some((d) => d.id !== eccetto && chiave(d.nome) === chiave(n))) return 'C’è già una disciplina con questo nome.'
  return null
}

/** Una disciplina nuova: l'id è il nome senza accenti, in minuscolo e con i trattini, e non c'è già. */
export function nuovaDisciplina(nome: string, lista: Disciplina[]): Disciplina {
  const pulito = nome.trim()
  const base = chiave(pulito).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, MAX_NOME_DISCIPLINA) || 'disciplina'
  const presi = new Set(lista.map((d) => d.id))
  let id = base
  for (let n = 2; presi.has(id) || id === TUTTE; n++) {
    const suffisso = `-${n}`
    id = base.slice(0, MAX_NOME_DISCIPLINA - suffisso.length) + suffisso
  }
  return { id, nome: pulito }
}

/** La disciplina di una voce, se è una che esiste: «tutte» o una della lista. */
export function ripulisciDisciplina(id: unknown, lista: Disciplina[]): string | undefined {
  if (typeof id !== 'string') return undefined
  if (id === TUTTE) return TUTTE
  return lista.some((d) => d.id === id) ? id : undefined
}

/** Le voci di una disciplina e quelle di «tutte»; senza filtro, tutte. L'ordine non cambia. */
export function dellaDisciplina<T extends { disciplina?: string | null }>(voci: T[], filtro: string | null): T[] {
  if (filtro === null) return voci
  return voci.filter((v) => v.disciplina === filtro || v.disciplina === TUTTE)
}

/** Le discipline della lista che hanno almeno una voce, nell'ordine della lista: il filtro mostra solo quelle. «Tutte» non ne accende nessuna. */
export function disciplineConVoci(voci: Array<{ disciplina?: string | null }>, lista: Disciplina[]): Disciplina[] {
  const usate = new Set(voci.map((v) => v.disciplina))
  return lista.filter((d) => usate.has(d.id))
}

/** Il filtro acceso, se è ancora una disciplina della lista; altrimenti spento (`null`). Una tolta nel frattempo, o «tutte» (che non è un pulsante), non resta accesa. */
export function filtroValido(filtro: string | null, lista: Disciplina[]): string | null {
  return filtro !== null && lista.some((d) => d.id === filtro) ? filtro : null
}

/** Come si chiama una disciplina in una riga o in un pulsante; `undefined` se la voce non ne ha una. */
export function nomeDisciplina(id: string | undefined, lista: Disciplina[]): string | undefined {
  if (id === TUTTE) return NOME_TUTTE
  return lista.find((d) => d.id === id)?.nome
}

const CHIAVE = 'ods-timer:discipline'

/** La lista com'era l'ultima volta che il dispositivo l'ha vista, per quando manca la rete. */
export function loadDiscipline(): Disciplina[] {
  try {
    const grezzo = localStorage.getItem(CHIAVE)
    return disciplineDa(grezzo ? JSON.parse(grezzo) : null)
  } catch {
    return disciplineDa(null)
  }
}

export function saveDiscipline(lista: Disciplina[]) {
  try {
    localStorage.setItem(CHIAVE, JSON.stringify(lista))
  } catch {
    // Si perde solo la copia senza rete.
  }
}
