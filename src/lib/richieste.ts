import { haUnServer } from './dati'
import { cfNatoIl, cfTornaColNome, cfTornaConLaData, cfValido } from './codiceFiscale'

/**
 * Il modulo di iscrizione, quello che prima stava su Google Form.
 *
 * Chi si iscrive risponde alle domande e carica i file (il modulo firmato,
 * il documento d'identità, il certificato medico e la ricevuta); la segreteria trova la richiesta in RICHIESTE
 * ONLINE e la accoglie o la rifiuta. Come il resto dell'app, due
 * implementazioni dietro la stessa interfaccia: `richiesteProva` le tiene sul
 * dispositivo, `richiesteSupabase` le manda al database
 * (`supabase/06-iscrizioni.sql`), dove chi non ha un accesso può solo
 * mandarle e la segreteria è l'unica a leggerle.
 *
 * Il documento d'identità si carica per comodità, ma non resta online: la
 * segreteria lo stampa, lo tiene su carta e lo cancella dall'app
 * (`DA_STAMPARE`). Il certificato medico invece resta: accolta la richiesta
 * passa alla scheda, dove lo apre solo la segreteria.
 *
 * I controlli qui sotto sono gli stessi della funzione `invia_iscrizione`:
 * nel browser servono a dire subito cosa manca, ma a decidere è il server.
 */

export type Formula = 'annuale' | 'trimestre'
export type TipoFile = 'modulo' | 'documento' | 'documento-retro' | 'certificato' | 'ricevuta'
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
  /** Un secondo numero, facoltativo. */
  telefono2?: string
  genitoreNome?: string
  genitoreCognome?: string
  genitoreCodiceFiscale?: string
  corsi: string[]
  formula: Formula
  note?: string
  /** La casella «Accetto il Regolamento Sociale»: senza, la richiesta non parte. */
  regolamento?: boolean
  /**
   * Mandata dall'area degli iscritti per il nucleo di questa persona (il
   * titolare, per id): accolta, chi si iscrive entra nel suo nucleo. Solo in
   * prova, per ora (vedi `nucleo.ts`).
   */
  nucleoDi?: string
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
  /** Le richieste che hanno ancora un file `DA_STAMPARE` caricato, per id. */
  conDocumento(): Promise<Set<string>>
  /** Un file solo, per sempre: il documento o il certificato, dopo averlo stampato. */
  eliminaFile(richiestaId: string, tipo: TipoFile): Promise<void>
  /**
   * La persona in elenco, iscritta ai corsi scelti: torna il suo id. Con
   * `personaId` la scheda la sceglie la segreteria; senza, la si cerca (vedi
   * `accogli_iscrizione` in `06-iscrizioni.sql`) e se non c'è se ne fa una.
   */
  accogli(richiestaId: string, personaId?: string): Promise<string>
  rifiuta(richiestaId: string): Promise<void>
  /** La richiesta e i suoi file, per sempre. */
  elimina(richiestaId: string): Promise<void>
}

/** I file da caricare, nell'ordine in cui si chiedono. */
export const FILE: Array<{ tipo: TipoFile; etichetta: string; dettaglio: string; obbligatorio: boolean; seManca?: string }> = [
  { tipo: 'modulo', etichetta: 'MODULO FIRMATO', dettaglio: 'Una foto, o il PDF firmato dal telefono.', obbligatorio: true },
  { tipo: 'documento', etichetta: "CARTA D'IDENTITÀ", dettaglio: 'Il fronte. Per un minore, quella del genitore.', obbligatorio: true },
  { tipo: 'documento-retro', etichetta: 'RETRO DEL DOCUMENTO', dettaglio: 'Se il fronte non basta.', obbligatorio: false },
  // Si chiede dai 6 anni ma non ferma la richiesta: «facoltativo» direbbe che non serve.
  { tipo: 'certificato', etichetta: 'CERTIFICATO MEDICO', dettaglio: 'Se ce l’hai già: una foto o il PDF. Se no, lo porti in segreteria.', obbligatorio: false, seManca: 'PUOI PORTARLO DOPO' },
  // Non ferma la richiesta: chi vuole paga in contanti al banco.
  {
    tipo: 'ricevuta',
    etichetta: 'RICEVUTA DEL PAGAMENTO',
    dettaglio: 'Se hai già pagato la quota associativa e il trimestre, oppure l’annuale.',
    obbligatorio: false,
    seManca: 'PUOI PAGARE IN SEGRETERIA',
  },
]

/** I file che non restano nell'app: la segreteria li stampa, li tiene su carta e li cancella. Il certificato no: passa alla scheda. */
export const DA_STAMPARE: TipoFile[] = ['documento', 'documento-retro']

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

/** Cosa manca del certificato arrivato col modulo prima di accogliere: la data, che la richiesta non porta. */
export const problemiCertificato = (conFile: boolean, scade: string): string[] => (conFile && !scade ? ['Manca la data del certificato.'] : [])

/**
 * Accoglie la richiesta e, se c'è, scrive la data del certificato sulla
 * scheda: un passo solo per chi usa l'app. Se la richiesta è accolta ma la
 * data no, lo dice con la causa e dice dove scriverla: accogliere non si
 * annulla, e rifarlo non serve.
 */
export async function accogliConCertificato(
  r: Pick<DatiRichieste, 'accogli'>,
  d: { salvaCertificato(personaId: string, scade: string): Promise<void> },
  richiestaId: string,
  personaId: string | undefined,
  scade: string,
): Promise<string> {
  const id = await r.accogli(richiestaId, personaId)
  if (scade) {
    try {
      await d.salvaCertificato(id, scade)
    } catch (e) {
      const causa = e instanceof Error ? e.message : ''
      throw new Error(`Richiesta accolta, ma la data del certificato non si è salvata${causa ? `: ${causa}` : ''}. Scrivila dalla scheda dell’iscritto.`, { cause: e })
    }
  }
  return id
}

/** Come la vuole il database: senza spazi, in maiuscolo. */
export const pulisciCf = (s: string) => s.replace(/\s/g, '').toUpperCase()

/** Se oggi ha compiuto `anni` anni, da una data `AAAA-MM-GG`; senza data, no. */
export function compiuti(natoIl: string, anni: number, oggi = new Date()): boolean {
  const [a, m, g] = natoIl.split('-').map(Number)
  if (!a || !m || !g) return false
  return new Date(a + anni, m - 1, g) <= oggi
}

/** Quanti anni ha oggi chi è nato in quel giorno. */
export const anni = (natoIl: string, oggi = new Date()) => {
  const [a, m, g] = natoIl.split('-').map(Number)
  return oggi.getFullYear() - a - (oggi.getMonth() + 1 < m || (oggi.getMonth() + 1 === m && oggi.getDate() < g) ? 1 : 0)
}

/** Gli anni a parole: «9 anni», «1 anno». */
export function anniScritti(natoIl: string, oggi = new Date()): string {
  const n = anni(natoIl, oggi)
  return `${n} ${n === 1 ? 'anno' : 'anni'}`
}

/**
 * La data di nascita che dice il codice fiscale, se è valido e la data esiste:
 * chi lo scrive non la scrive. Se la data già scritta dice lo stesso giorno
 * resta quella, perché l'anno del codice ha due cifre e il secolo lo sa chi
 * scrive. `null`: il codice non dice niente, la data si scrive a mano.
 */
export function dataDaCf(codiceFiscale: string, natoIl: string, oggi = new Date()): string | null {
  const cf = pulisciCf(codiceFiscale)
  const dal = cfNatoIl(cf, oggi)
  if (!dal) return null
  return cfTornaConLaData(cf, natoIl) ? natoIl : dal
}

/** Minorenne oggi, da una data `AAAA-MM-GG`. */
export function minorenne(natoIl: string, oggi = new Date()): boolean {
  const [a, m, g] = natoIl.split('-').map(Number)
  if (!a || !m || !g) return false
  const diciotto = new Date(a + 18, m - 1, g)
  return diciotto > oggi
}

/**
 * Se firma il genitore (true) o chi si iscrive. Mentre si corregge la data
 * dalla tastiera il campo passa per vuoto o per anni come 0002: lì chi firma
 * resta quello di `prima`, se no firma e caselle sparirebbero per niente.
 */
export function chiFirma(natoIl: string, prima?: boolean, oggi = new Date()): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(natoIl) || Number(natoIl.slice(0, 4)) < 1900) return prima ?? false
  return minorenne(natoIl, oggi)
}

/** I corsi per cui dai 12 anni serve il certificato agonistico. */
const AGONISTICI = /\b(judo|aikido|lotta)\b/i

/**
 * INDIETRO dal modulo lo chiude, e quello che c'è scritto si perde: nessuna
 * bozza resta sul telefono, per i dati dei minori. Se c'è qualcosa di nuovo
 * rispetto a quando si è aperto (per il nucleo, i dati già scritti), lo chiede
 * prima, come la freccia dell'appello (`domandaIndietro`).
 */
export function domandaUscita(m: {
  risposte: DatiRichiesta
  inizio: DatiRichiesta
  file: number
  scelte: number
  tratti: number
  privacy: boolean
  luogoGenitore: string
}): string | undefined {
  // Object.keys dà string[]: le chiavi sono quelle di due DatiRichiesta.
  const chiavi = new Set([...Object.keys(m.risposte), ...Object.keys(m.inizio)]) as Set<keyof DatiRichiesta>
  const cambiate = [...chiavi].some((k) => JSON.stringify(m.risposte[k]) !== JSON.stringify(m.inizio[k]))
  const nuovo = cambiate || m.file > 0 || m.scelte > 0 || m.tratti > 0 || m.privacy || !!m.luogoGenitore.trim()
  return nuovo ? 'LE RISPOSTE SI PERDONO · ESCI?' : undefined
}

/**
 * Se cambia chi firma (la data di nascita dice minore, o non più), cambia il
 * foglio: firma, caselle e foto del foglio di prima non valgono, e si dice
 * perché sono sparite. Se non c'era niente, non c'è niente da dire; se
 * l'avviso c'era già (la data cambiata due volte), resta e dice chi firma ora.
 */
export function firmaDaRifare(minore: boolean, prima: { tratti: number; scelte: number; foto: boolean; avvisato: boolean }): string | undefined {
  if (!prima.tratti && !prima.scelte && !prima.foto && !prima.avvisato) return undefined
  return `Firma e autorizzazioni vanno rifatte: ora firma ${minore ? 'il genitore' : 'chi si iscrive'}.`
}

/**
 * Quale certificato medico ricordare a chi si iscrive: nessuno sotto i 6
 * anni (o finché non c'è la data di nascita), l'agonistico dai 12 per judo,
 * aikido e lotta, se no quello normale. Si può caricare col modulo o portare
 * in segreteria: è un dato sulla salute, e lo vede solo la segreteria.
 */
export function certificatoDaPortare(natoIl: string, nomiCorsi: string[], oggi = new Date()): 'nessuno' | 'normale' | 'agonistico' {
  if (!compiuti(natoIl, 6, oggi)) return 'nessuno'
  return compiuti(natoIl, 12, oggi) && nomiCorsi.some((n) => AGONISTICI.test(n)) ? 'agonistico' : 'normale'
}

/** I campi del modulo che possono non andare, per segnarli uno per uno. */
export type CampoModulo = Exclude<keyof DatiRichiesta, 'note' | 'nucleoDi'>

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
const CF_NOME = 'Il codice fiscale non torna con nome e cognome: scrivili tutti, come sul documento'
const CF_NOME_GENITORE = 'Il codice fiscale del genitore non torna con il suo nome e cognome: scrivili tutti, come sul documento'

/** Sotto il campo, cosa fare con un codice che non ha 16 lettere e numeri: quanti ne mancano o quanti toglierne. */
function quantiCaratteri(cf: string): string {
  if (/[^A-Z0-9]/.test(cf)) return 'Solo lettere e numeri'
  const n = Math.abs(16 - cf.length)
  const caratteri = n === 1 ? '1 carattere' : `${n} caratteri`
  return cf.length < 16 ? `${n === 1 ? 'Manca' : 'Mancano'} ${caratteri}` : `Togli ${caratteri}`
}

/** Il codice fiscale di chi si iscrive o del genitore: scritto giusto, e di chi deve essere. */
function guaiCf(campo: 'codiceFiscale' | 'genitoreCodiceFiscale', grezzo: string, di: string): Guaio | null {
  const cf = pulisciCf(grezzo)
  if (!cf) return null
  if (!/^[A-Z0-9]{16}$/.test(cf)) return { campo, messaggio: CF_CORTO, testo: quantiCaratteri(cf) }
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
  if (cfValido(cf) && d.nome.trim() && d.cognome.trim() && !cfTornaColNome(cf, d.nome, d.cognome))
    metti({ campo: 'codiceFiscale', messaggio: CF_NOME, testo: 'Non torna con nome e cognome' })
  if (minore) {
    const gen = pulisciCf(d.genitoreCodiceFiscale ?? '')
    metti(guaiCf('genitoreCodiceFiscale', gen, 'del genitore'))
    const suo = cfValido(gen) ? cfNatoIl(gen, oggi) : null
    if (gen && gen === cf)
      metti({ campo: 'genitoreCodiceFiscale', messaggio: 'Il codice fiscale del genitore è lo stesso di chi si iscrive', testo: `Metti il tuo codice fiscale, non quello ${d.nome?.trim() ? `di ${d.nome.trim()}` : 'del bambino'}.` })
    else if (suo && minorenne(suo, oggi))
      metti({ campo: 'genitoreCodiceFiscale', messaggio: 'Il codice fiscale del genitore è di un minorenne', testo: 'È di un minorenne' })
    else if (cfValido(gen) && d.genitoreNome?.trim() && d.genitoreCognome?.trim() && !cfTornaColNome(gen, d.genitoreNome, d.genitoreCognome))
      metti({ campo: 'genitoreCodiceFiscale', messaggio: CF_NOME_GENITORE, testo: 'Non torna con nome e cognome del genitore' })
  }

  if (!d.corsi.length) metti({ campo: 'corsi', messaggio: 'Scegli almeno un corso', testo: 'Scegline almeno uno' })
  else if (d.corsi.length > 6) metti({ campo: 'corsi', messaggio: 'Un campo non va: si possono scegliere al massimo sei corsi', testo: 'Al massimo sei' })

  if (d.cap.trim() && !/^\d{5}$/.test(d.cap.trim())) metti({ campo: 'cap', messaggio: 'Un campo non va: il CAP ha 5 cifre', testo: 'Sono 5 cifre' })
  if (d.email.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email.trim()))
    metti({ campo: 'email', messaggio: "Un campo non va: l'email non sembra giusta", testo: 'Non sembra giusta' })
  for (const campo of ['telefono', 'telefono2'] as const) {
    const tel = (d[campo] ?? '').trim()
    const cifre = tel.replace(/\D/g, '').length
    if (tel && (!/^\+?[0-9 ./()-]+$/.test(tel) || cifre < 6 || cifre > 15))
      metti({
        campo,
        messaggio: `Un campo non va: il ${campo === 'telefono' ? 'telefono' : 'secondo telefono'} non sembra giusto`,
        testo: 'Non sembra giusto: solo cifre, spazi e il + davanti',
      })
  }
  if (d.formula !== 'annuale' && d.formula !== 'trimestre')
    metti({ campo: 'formula', messaggio: "Un campo non va: si paga l'annuale o il trimestre", testo: 'Annuale o trimestre' })
  if (!d.regolamento) metti({ campo: 'regolamento', messaggio: 'Serve accettare il Regolamento Sociale', testo: 'Serve accettarlo per iscriversi' })
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
    unico = (haUnServer
      ? Promise.all([import('./richiesteSupabase'), import('./supabase')]).then(([m, s]) => m.creaRichiesteSupabase(s.clientSupabase()))
      : Promise.all([import('./richiesteProva'), import('./esempiProva')]).then(([m, e]) => (e.seminaEsempi(), m.creaRichiesteProva())))
      // Se il pezzo non arriva (rete, o un aggiornamento pubblicato nel
      // frattempo), la volta dopo si riprova invece di restare rotti.
      .catch((e) => {
        unico = null
        throw e
      })
  }
  return unico
}
