import { haUnServer } from './dati'
import { cfNatoIl, cfTornaColNome, cfTornaConLaData, cfValido } from './codiceFiscale'

/**
 * Il modulo di iscrizione, quello che prima stava su Google Form.
 *
 * Chi si iscrive risponde alle domande e carica i file (il modulo firmato, il
 * documento, la ricevuta); la segreteria trova la richiesta in RICHIESTE
 * ONLINE e la accoglie o la rifiuta. Come il resto dell'app, due
 * implementazioni dietro la stessa interfaccia: `richiesteProva` le tiene sul
 * dispositivo, `richiesteSupabase` le manda al database
 * (`supabase/06-iscrizioni.sql`), dove chi non ha un accesso può solo
 * mandarle e la segreteria è l'unica a leggerle.
 *
 * I controlli qui sotto sono gli stessi della funzione `invia_iscrizione`:
 * nel browser servono a dire subito cosa manca, ma a decidere è il server.
 */

export type Formula = 'annuale' | 'trimestre'
export type TipoFile = 'modulo' | 'documento' | 'documento-retro' | 'ricevuta'
export type StatoRichiesta = 'nuova' | 'accolta' | 'rifiutata'

export interface DatiRichiesta {
  nome: string
  cognome: string
  /** `AAAA-MM-GG`. */
  natoIl: string
  natoA: string
  codiceFiscale: string
  indirizzo: string
  cap: string
  comune: string
  /** Per un minore sono del genitore. */
  email: string
  telefono: string
  genitoreNome?: string
  genitoreCognome?: string
  genitoreCodiceFiscale?: string
  corsi: string[]
  formula: Formula
  note?: string
}

export interface Richiesta extends DatiRichiesta {
  id: string
  creataIl: string
  stato: StatoRichiesta
  /** La persona in elenco che ne è nata, quando è accolta. */
  personaId?: string
  gestitaIl?: string
  gestitaDa?: string
}

export interface FileRichiesta {
  tipo: TipoFile
  /** Un link che scade: si apre subito, non si salva. */
  url: string
  pdf: boolean
}

export interface CorsoAperto {
  id: string
  nome: string
}

export interface DatiRichieste {
  readonly modo: 'prova' | 'supabase'

  // Per chi si iscrive, senza accesso.
  corsiAperti(): Promise<CorsoAperto[]>
  /** Le risposte: torna l'id della richiesta, che fa da cartella ai file. */
  invia(dati: DatiRichiesta): Promise<string>
  /** Un file alla volta, così se uno non passa si riprova solo quello. */
  caricaFile(richiestaId: string, tipo: TipoFile, file: File): Promise<void>

  // Per la segreteria.
  richieste(): Promise<Richiesta[]>
  file(richiestaId: string): Promise<FileRichiesta[]>
  /** La persona in elenco, iscritta ai corsi scelti: torna il suo id. */
  accogli(richiestaId: string): Promise<string>
  rifiuta(richiestaId: string): Promise<void>
  /** La richiesta e i suoi file, per sempre. */
  elimina(richiestaId: string): Promise<void>
}

/** I file da caricare, nell'ordine in cui si chiedono. */
export const FILE: Array<{ tipo: TipoFile; etichetta: string; dettaglio: string; obbligatorio: boolean }> = [
  { tipo: 'modulo', etichetta: 'MODULO FIRMATO', dettaglio: 'Una foto, o il PDF firmato dal telefono.', obbligatorio: true },
  { tipo: 'documento', etichetta: "CARTA D'IDENTITÀ", dettaglio: 'Il fronte. Per un minore, quella del genitore.', obbligatorio: true },
  { tipo: 'documento-retro', etichetta: 'RETRO DEL DOCUMENTO', dettaglio: 'Se il fronte non basta.', obbligatorio: false },
  { tipo: 'ricevuta', etichetta: 'RICEVUTA DEL PAGAMENTO', dettaglio: 'La quota associativa e il trimestre, oppure l’annuale.', obbligatorio: true },
]

export const ETICHETTA_FILE = Object.fromEntries(FILE.map((f) => [f.tipo, f.etichetta])) as Record<TipoFile, string>

/** I tipi che il contenitore accetta, con l'estensione che il nome del file deve avere. */
export const ESTENSIONI: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'application/pdf': 'pdf',
}
export const MASSIMO_FILE = 10 * 1024 * 1024

export const FORMULE: Array<[Formula, string]> = [
  ['annuale', 'Annuale'],
  ['trimestre', 'Trimestre'],
]

/** Come la vuole il database: senza spazi, in maiuscolo. */
export const pulisciCf = (s: string) => s.replace(/\s/g, '').toUpperCase()

/** Minorenne oggi, da una data `AAAA-MM-GG`. */
export function minorenne(natoIl: string, oggi = new Date()): boolean {
  const [a, m, g] = natoIl.split('-').map(Number)
  if (!a || !m || !g) return false
  const diciotto = new Date(a + 18, m - 1, g)
  return diciotto > oggi
}

/** I campi del modulo che possono non andare, per segnarli uno per uno. */
export type CampoModulo = Exclude<keyof DatiRichiesta, 'note'>

/**
 * Una cosa che non va: `messaggio` è quello del server, `testo` quello corto
 * che si scrive sotto il campo.
 */
interface Guaio {
  campo: CampoModulo
  messaggio: string
  testo: string
}

/** I campi di testo obbligatori, nell'ordine di «Mancano: …». */
const OBBLIGATORI = ['nome', 'cognome', 'natoIl', 'natoA', 'codiceFiscale', 'indirizzo', 'cap', 'comune', 'email', 'telefono'] as const

const CF_CORTO = 'Un campo non va: il codice fiscale ha 16 caratteri, lettere e numeri'

/** Il codice fiscale di chi si iscrive o del genitore: scritto giusto, e di chi deve essere. */
function guaiCf(campo: 'codiceFiscale' | 'genitoreCodiceFiscale', grezzo: string, di: string): Guaio | null {
  const cf = pulisciCf(grezzo)
  if (!cf) return null
  if (!/^[A-Z0-9]{16}$/.test(cf)) return { campo, messaggio: CF_CORTO, testo: 'Sono 16 caratteri, lettere e numeri' }
  if (!cfValido(cf))
    return { campo, messaggio: `Il codice fiscale${di && ' ' + di} non torna: controlla di averlo copiato giusto`, testo: 'Non torna: controlla lettere e numeri, uno per uno' }
  return null
}

/**
 * Tutto quello che non va, nell'ordine in cui lo guarda `invia_iscrizione`,
 * con al massimo una cosa per campo.
 */
function guai(d: DatiRichiesta, oggi: Date): Guaio[] {
  const g: Guaio[] = []
  const metti = (x: Guaio | null) => x && !g.some((y) => y.campo === x.campo) && g.push(x)

  for (const k of OBBLIGATORI) if (!d[k]?.trim()) metti({ campo: k, messaggio: '', testo: 'Manca' })

  const nato = new Date(`${d.natoIl}T12:00:00`)
  const cento = new Date(oggi)
  cento.setFullYear(cento.getFullYear() - 100)
  const dataOk = /^\d{4}-\d{2}-\d{2}$/.test(d.natoIl) && !Number.isNaN(nato.getTime()) && nato <= oggi && nato >= cento
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.natoIl) || Number.isNaN(nato.getTime()))
    metti({ campo: 'natoIl', messaggio: 'La data di nascita non si capisce', testo: 'Non si capisce' })
  else if (!dataOk) metti({ campo: 'natoIl', messaggio: 'La data di nascita non torna', testo: 'Non torna: è nel futuro, o più di cento anni fa' })

  const minore = dataOk && minorenne(d.natoIl, oggi)
  if (minore)
    for (const k of ['genitoreNome', 'genitoreCognome', 'genitoreCodiceFiscale'] as const)
      if (!d[k]?.trim()) metti({ campo: k, messaggio: 'Per un minore servono nome, cognome e codice fiscale del genitore', testo: 'Manca' })

  for (const k of minore ? (['nome', 'cognome', 'genitoreNome', 'genitoreCognome'] as const) : (['nome', 'cognome'] as const))
    if (/\d/.test(d[k] ?? '')) metti({ campo: k, messaggio: 'Un campo non va: nome e cognome non hanno numeri', testo: 'Senza numeri' })

  const cf = pulisciCf(d.codiceFiscale)
  metti(guaiCf('codiceFiscale', d.codiceFiscale, ''))
  if (dataOk && cfValido(cf) && !cfTornaConLaData(cf, d.natoIl))
    metti({
      campo: 'codiceFiscale',
      messaggio: 'Il codice fiscale e la data di nascita non dicono lo stesso giorno: controlla l’uno e l’altra',
      testo: 'Non torna con la data di nascita',
    })
  if (minore) {
    const gen = pulisciCf(d.genitoreCodiceFiscale ?? '')
    metti(guaiCf('genitoreCodiceFiscale', gen, 'del genitore'))
    const suo = cfValido(gen) ? cfNatoIl(gen, oggi) : null
    if (gen && gen === cf)
      metti({ campo: 'genitoreCodiceFiscale', messaggio: 'Il codice fiscale del genitore è lo stesso di chi si iscrive', testo: 'È lo stesso di chi si iscrive' })
    else if (suo && minorenne(suo, oggi))
      metti({ campo: 'genitoreCodiceFiscale', messaggio: 'Il codice fiscale del genitore è di un minorenne', testo: 'È di un minorenne' })
  }

  if (!d.corsi.length) metti({ campo: 'corsi', messaggio: 'Scegli almeno un corso', testo: 'Scegline almeno uno' })
  else if (d.corsi.length > 6) metti({ campo: 'corsi', messaggio: 'Un campo non va: si possono scegliere al massimo sei corsi', testo: 'Al massimo sei' })

  if (d.cap.trim() && !/^\d{5}$/.test(d.cap.trim())) metti({ campo: 'cap', messaggio: 'Un campo non va: il CAP ha 5 cifre', testo: 'Sono 5 cifre' })
  if (d.email.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email.trim()))
    metti({ campo: 'email', messaggio: "Un campo non va: l'email non sembra giusta", testo: 'Non sembra giusta' })
  const tel = d.telefono.trim()
  const cifre = tel.replace(/\D/g, '').length
  if (tel && (!/^\+?[0-9 ./()-]+$/.test(tel) || cifre < 6 || cifre > 15))
    metti({ campo: 'telefono', messaggio: 'Un campo non va: il telefono non sembra giusto', testo: 'Non sembra giusto: solo cifre, spazi e il + davanti' })
  if (d.formula !== 'annuale' && d.formula !== 'trimestre')
    metti({ campo: 'formula', messaggio: "Un campo non va: si paga l'annuale o il trimestre", testo: 'Annuale o trimestre' })
  return g
}

/**
 * Cosa non va, detto come lo dice il server; `null` se si può mandare.
 * I messaggi sono gli stessi di `invia_iscrizione`, così la prova e il
 * database rispondono uguale.
 */
export function controlla(d: DatiRichiesta, oggi = new Date()): string | null {
  const tutti = guai(d, oggi)
  const vuoti = tutti.filter((x) => !x.messaggio)
  if (vuoti.length) return `Mancano: ${vuoti.map((x) => NOMI_CAMPI[x.campo]).join(', ')}`
  return tutti[0]?.messaggio ?? null
}

/** Cosa non va campo per campo, da scrivere sotto ognuno. */
export function problemi(d: DatiRichiesta, oggi = new Date()): Partial<Record<CampoModulo, string>> {
  return Object.fromEntries(guai(d, oggi).map((x) => [x.campo, x.testo]))
}

/**
 * Quello che non ferma l'invio ma vale la pena guardare: un codice fiscale
 * giusto che però non sembra della persona scritta accanto.
 */
export function avvisi(d: DatiRichiesta, oggi = new Date()): Partial<Record<CampoModulo, string>> {
  const a: Partial<Record<CampoModulo, string>> = {}
  const cf = pulisciCf(d.codiceFiscale)
  if (cfValido(cf) && d.nome.trim() && d.cognome.trim() && !cfTornaColNome(cf, d.nome, d.cognome))
    a.codiceFiscale = `Non sembra di ${d.nome.trim()} ${d.cognome.trim()}: controlla che sia il suo`
  const gen = pulisciCf(d.genitoreCodiceFiscale ?? '')
  if (minorenne(d.natoIl, oggi) && cfValido(gen) && d.genitoreNome?.trim() && d.genitoreCognome?.trim() && !cfTornaColNome(gen, d.genitoreNome, d.genitoreCognome))
    a.genitoreCodiceFiscale = `Non sembra di ${d.genitoreNome.trim()} ${d.genitoreCognome.trim()}: controlla che sia il suo`
  return a
}

/** Il nome di un campo com'è scritto nel modulo, per «Mancano: …». */
const NOMI_CAMPI: Partial<Record<CampoModulo, string>> = {
  nome: 'nome',
  cognome: 'cognome',
  natoIl: 'data di nascita',
  natoA: 'luogo di nascita',
  codiceFiscale: 'codice fiscale',
  indirizzo: 'indirizzo',
  cap: 'CAP',
  comune: 'comune',
  email: 'email',
  telefono: 'telefono',
}

let unico: Promise<DatiRichieste> | null = null

export function datiRichieste(): Promise<DatiRichieste> {
  if (!unico) {
    unico = haUnServer
      ? Promise.all([import('./richiesteSupabase'), import('./supabase')]).then(([m, s]) => m.creaRichiesteSupabase(s.clientSupabase()))
      : import('./richiesteProva').then((m) => m.creaRichiesteProva())
  }
  return unico
}
