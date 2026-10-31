import { dataLunga } from './sala'

/**
 * I verbali delle riunioni dei soci e del direttivo. Il testo si scrive fuori
 * dall'app (skill `preparare-verbale`) e si firma a mano: qui si carica la
 * scansione con i dati della riunione, e il verbale nasce «firmato». Da lì in
 * poi non si cambia: si rettifica con una nota datata o si sostituisce il PDF
 * dicendo perché. Vecchi (storici) e nuovi si caricano uguali.
 * Tutte funzioni pure: le date sono `AAAA-MM-GG`, le ore `HH:MM`, `oggi` lo
 * passa chi chiama. Il database è `supabase/127-verbali.sql`, con le regole di firma di `133-verbali-semplici.sql`.
 */

export type TipoVerbale = 'soci' | 'direttivo' | 'soci_direttivo' | 'straordinaria' | 'elettiva'
export type Argomento = 'bilancio' | 'elezioni' | 'quote' | 'statuto' | 'sede_affitto' | 'assicurazioni' | 'corsi' | 'istruttori' | 'varie' | 'altro'
export type TipoAllegato = 'firmato' | 'convocazione' | 'fogli_firme' | 'bilancio' | 'copia_coperta' | 'altro'

export interface Delibera {
  id: string
  titolo: string
  argomento: Argomento
  esito?: 'approvata' | 'respinta' | 'rinviata'
  /** «all’unanimità», «a maggioranza», «alzata di mano», «per scrutinio» o testo libero. */
  comeVotato?: string
  annoRif?: number
  bilancioTipo?: 'preventivo' | 'consuntivo'
  note?: string
}

export interface Carica {
  carica: string
  personaId: string
  dal?: string
  al?: string
}

export interface Allegato {
  id: string
  tipo: TipoAllegato
  nome: string
  peso: number
  /** Dove sta il file nello Storage (`<id del verbale>/<nome>`); in prova non c'è. */
  percorso?: string
  caricatoIl: string
  convocazioneInviataIl?: string
  /** Quando un altro PDF ha preso il suo posto; senza, è quello in vigore. */
  sostituitoIl?: string
  motivoSostituzione?: string
}

export interface Rettifica {
  data: string
  motivo: string
  testo: string
}

export interface Verbale {
  id: string
  anno: number
  numero: number
  tipo: TipoVerbale
  data: string
  oraInizio?: string
  oraFine?: string
  luogo?: string
  odg: string[]
  presidenteId?: string
  segretarioId?: string
  aventiDiritto?: number
  presenti?: number
  deleghe?: number
  testo?: string
  stato: 'bozza' | 'firmato'
  firmatoIl?: string
  /** Un verbale vecchio, caricato per archivio: bastano numero, data, tipo e PDF. */
  storico: boolean
  delibere: Delibera[]
  cariche: Carica[]
  allegati: Allegato[]
  rettifiche: Rettifica[]
}

export type VerbaleNuovo = Omit<Verbale, 'id'> & { id?: string }

export interface FiltroVerbali {
  anno?: number
  tipo?: TipoVerbale
  argomento?: Argomento
  stato?: 'bozza' | 'firmato' | 'rettificato'
  testo?: string
}

/** Un PDF da caricare: nome e peso li controllano le regole, il contenuto va nello Storage (in prova non serve). */
export interface FilePdf {
  nome: string
  peso: number
  contenuto?: Blob
}

export interface DatiVerbali {
  leggi(): Promise<Verbale[]>
  /** Una bozza nuova (senza id) o cambiata; torna l'id. Un firmato non si salva. */
  salva(v: VerbaleNuovo): Promise<string>
  elimina(id: string): Promise<void>
  /** Il PDF firmato della scansione, al posto di quello che c'è (solo in bozza). */
  caricaPdf(id: string, file: FilePdf): Promise<void>
  firma(id: string, data: string): Promise<void>
  rettifica(id: string, r: Rettifica): Promise<void>
  sostituisciPdf(id: string, file: FilePdf, motivo: string): Promise<void>
  /** Un indirizzo a tempo per aprire un PDF; vuoto in prova, dove i file non ci sono. */
  linkPdf(a: Allegato): Promise<string>
}

export const MAX_PESO_PDF = 20 * 1024 * 1024

const TIPI: Record<TipoVerbale, string> = {
  soci: 'Assemblea dei soci',
  direttivo: 'Direttivo',
  soci_direttivo: 'Soci e direttivo',
  straordinaria: 'Assemblea straordinaria',
  elettiva: 'Assemblea elettiva',
}
export const TIPI_VERBALE = Object.keys(TIPI) as TipoVerbale[]

const ARGOMENTI: Record<Argomento, string> = {
  bilancio: 'Bilancio',
  elezioni: 'Elezioni',
  quote: 'Quote',
  statuto: 'Statuto',
  sede_affitto: 'Sede e affitto',
  assicurazioni: 'Assicurazioni',
  corsi: 'Andamento e apertura dei corsi',
  istruttori: 'Andamento e inserimento di istruttori',
  varie: 'Cena e feste di Natale (varie)',
  altro: 'Altro',
}
export const ARGOMENTI_VERBALE = Object.keys(ARGOMENTI) as Argomento[]

export const etichettaTipo = (t: TipoVerbale) => TIPI[t]
export const etichettaArgomento = (a: Argomento) => ARGOMENTI[a]
export const numeroDi = (v: Pick<Verbale, 'numero' | 'anno'>) => `n.${v.numero}-${v.anno}`

export function etichettaStato(v: Verbale): string {
  if (v.stato === 'bozza') return 'Bozza'
  return v.firmatoIl ? `Firmato il ${dataLunga(v.firmatoIl)}` : 'Firmato'
}

export function prossimoNumero(verbali: Pick<Verbale, 'anno' | 'numero'>[], anno: number): number {
  return verbali.reduce((max, v) => (v.anno === anno ? Math.max(max, v.numero) : max), 0) + 1
}

const vuoto = (s: string | undefined) => !s || !s.trim()

export const pdfInVigore = (v: Verbale): Allegato | undefined => v.allegati.find((a) => a.tipo === 'firmato' && !a.sostituitoIl)

/** Cosa impedisce di salvare (o, con `staFirmando`, di firmare); null se va. */
export function cosaNonVaVerbale(v: Verbale, { staFirmando = false } = {}): string | null {
  if (v.numero === undefined || Number.isNaN(v.numero)) return 'Manca il numero del verbale'
  if (!Number.isInteger(v.numero) || v.numero < 1) return 'Il numero del verbale deve essere un intero da 1 in su'
  if (!v.data) return 'Manca la data della riunione'
  if (!v.tipo) return 'Manca il tipo di riunione'
  if (v.delibere.some((d) => vuoto(d.titolo))) return 'Una delibera non ha il titolo: scrivilo o toglila'
  if (v.cariche.some((c) => c.dal && c.al && c.al < c.dal)) return 'Una carica finisce prima di cominciare: controlla le date'
  if (!staFirmando) return null
  // Il resto (ore, luogo, presidente, presenti…) sta nel PDF firmato: l'app non lo chiede.
  if (!pdfInVigore(v)) return 'Per firmare serve il PDF firmato: caricalo prima'
  return null
}

/** Cose strane ma non bloccanti, una per caso. `altri` sono gli altri verbali, per i numeri doppi. */
export function avvisiVerbale(v: Verbale, altri: Verbale[] = []): string[] {
  const a: string[] = []
  if (v.aventiDiritto !== undefined && (v.presenti ?? 0) + (v.deleghe ?? 0) > v.aventiDiritto) a.push('Presenti e deleghe sono più degli aventi diritto')
  if (v.data && Number(v.data.slice(0, 4)) !== v.anno) a.push('L’anno del numero è diverso dall’anno della data')
  if (altri.some((o) => o.id !== v.id && o.anno === v.anno && o.numero === v.numero)) a.push(`Il numero ${numeroDi(v)} è già usato da un altro verbale: scegline un altro, se no non si carica`)
  if (v.oraInizio && v.oraFine && v.oraFine < v.oraInizio) a.push('L’ora di fine è prima dell’ora d’inizio')
  const visti = new Set<string>()
  const doppio = v.delibere.some((d) => {
    if (d.argomento !== 'bilancio') return false
    const k = `${d.bilancioTipo ?? ''}|${d.annoRif ?? ''}`
    return visti.size === visti.add(k).size
  })
  if (doppio) a.push('Ci sono due delibere sullo stesso bilancio (stesso tipo e stesso anno)')
  return a
}

export const puoModificare = (v: Verbale) => v.stato === 'bozza'
export const puoEliminare = (v: Verbale) => v.stato === 'bozza'
export const puoFirmare = (v: Verbale) => v.stato === 'bozza' && !cosaNonVaVerbale(v, { staFirmando: true })
export const puoRettificare = (v: Verbale) => v.stato === 'firmato'
export const puoSostituirePdf = (v: Verbale) => v.stato === 'firmato'

export function cosaNonVaRettifica(r: Rettifica): string | null {
  if (vuoto(r.motivo)) return 'Scrivi il motivo della rettifica'
  if (vuoto(r.testo)) return 'Scrivi cosa cambia: il testo della nota'
  if (!r.data) return 'Manca la data della rettifica'
  return null
}

export const cosaNonVaSostituzione = (motivo: string) => (vuoto(motivo) ? 'Scrivi il motivo della sostituzione del PDF' : null)

export function cosaNonVaDataFirma(v: Pick<Verbale, 'data'>, data: string, oggi: string): string | null {
  if (!data) return 'Scrivi la data della firma'
  if (data > oggi) return 'La firma non può essere nel futuro: al massimo oggi'
  if (data < v.data) return 'La firma non può essere prima della riunione'
  return null
}

export function cosaNonVaFile(f: { nome: string; tipo: string; peso: number }): string | null {
  if (vuoto(f.nome)) return 'Il file non ha un nome'
  if (f.tipo !== 'application/pdf') return 'Si carica solo un PDF: scansiona il verbale firmato in PDF'
  if (!(f.peso > 0)) return 'Il file è vuoto: rifai la scansione'
  if (f.peso > MAX_PESO_PDF) return 'Il PDF pesa più di 20 MB: rifai la scansione più leggera'
  return null
}

/** Cosa impedisce di caricare un verbale già firmato (il file, la riunione, la data della firma); null se va. */
export function cosaNonVaCaricamento(v: Verbale, file: { nome: string; peso: number; tipo: string } | undefined, firmatoIl: string, oggi: string): string | null {
  if (!file) return 'Scegli il PDF firmato'
  return cosaNonVaFile(file) ?? cosaNonVaVerbale(v) ?? cosaNonVaDataFirma(v, firmatoIl, oggi)
}

/**
 * Salva la riunione, carica il PDF e firma: tre chiamate, non una transazione. `onId` riceve l'id appena
 * la bozza esiste: se il PDF o la firma cadono, chi chiama lo ripassa in `v.id` al tentativo dopo, così
 * si riusa la stessa bozza invece di crearne un'altra col numero già preso.
 */
export async function caricaVerbaleFirmato(dati: Pick<DatiVerbali, 'salva' | 'caricaPdf' | 'firma'>, v: VerbaleNuovo, file: FilePdf, firmatoIl: string, onId: (id: string) => void): Promise<string> {
  const id = await dati.salva(v)
  onId(id)
  await dati.caricaPdf(id, file)
  await dati.firma(id, firmatoIl)
  return id
}

/** Firma, sostituzioni del PDF e rettifiche, dal più vecchio al più nuovo. */
export function storiaPdf(v: Verbale): { quando: string; cosa: string; motivo?: string }[] {
  const voci: { quando: string; cosa: string; motivo?: string }[] = []
  if (v.firmatoIl) voci.push({ quando: v.firmatoIl, cosa: 'Firmato' })
  for (const a of v.allegati) if (a.tipo === 'firmato' && a.sostituitoIl) voci.push({ quando: a.sostituitoIl, cosa: 'PDF firmato sostituito', motivo: a.motivoSostituzione })
  for (const r of v.rettifiche) voci.push({ quando: r.data, cosa: 'Rettificato', motivo: r.motivo })
  return voci.sort((x, y) => (x.quando < y.quando ? -1 : x.quando > y.quando ? 1 : 0))
}

const semplice = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

export function cercaVerbali(verbali: Verbale[], f: FiltroVerbali): Verbale[] {
  const ago = f.testo ? semplice(f.testo.trim()) : ''
  return verbali.filter((v) => {
    if (f.anno !== undefined && v.anno !== f.anno) return false
    if (f.tipo && v.tipo !== f.tipo) return false
    if (f.argomento && !v.delibere.some((d) => d.argomento === f.argomento)) return false
    if (f.stato === 'bozza' && v.stato !== 'bozza') return false
    if (f.stato === 'firmato' && !(v.stato === 'firmato' && !v.rettifiche.length)) return false
    if (f.stato === 'rettificato' && !(v.stato === 'firmato' && v.rettifiche.length)) return false
    if (!ago) return true
    const fieno = [numeroDi(v), ...v.delibere.flatMap((d) => [d.titolo, etichettaArgomento(d.argomento)]), ...v.odg, v.testo ?? '']
    return fieno.some((s) => semplice(s).includes(ago))
  })
}

const piuRecenti = (a: Verbale, b: Verbale) => (a.data === b.data ? b.numero - a.numero : a.data < b.data ? 1 : -1)

export function ordinaVerbali(verbali: Verbale[]): { daCompletare: Verbale[]; firmati: Verbale[] } {
  return {
    daCompletare: verbali.filter((v) => v.stato === 'bozza').sort(piuRecenti),
    firmati: verbali.filter((v) => v.stato === 'firmato').sort(piuRecenti),
  }
}

export const anniDei = (verbali: Pick<Verbale, 'anno'>[]): number[] => [...new Set(verbali.map((v) => v.anno))].sort((a, b) => b - a)

export interface PersonaNome {
  id: string
  nome: string
  cognome: string
}

/** Il segretario di seduta è uno dei segretari della lista che quel giorno era presente nel direttivo. */
export function segretariPossibili<P extends PersonaNome>(segretariIds: string[], presentiDirettivoIds: string[], persone: P[]): P[] {
  const ammessi = presentiDirettivoIds.length ? segretariIds.filter((id) => presentiDirettivoIds.includes(id)) : segretariIds
  const trovate = ammessi.flatMap((id) => persone.find((p) => p.id === id) ?? [])
  return trovate.sort((a, b) => a.cognome.localeCompare(b.cognome, 'it') || a.nome.localeCompare(b.nome, 'it'))
}
