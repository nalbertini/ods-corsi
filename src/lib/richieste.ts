import { haUnServer } from './dati'

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

/**
 * Cosa non va, detto come lo dice il server; `null` se si può mandare.
 * I messaggi sono gli stessi di `invia_iscrizione`, così la prova e il
 * database rispondono uguale.
 */
export function controlla(d: DatiRichiesta, oggi = new Date()): string | null {
  const vuoti = (['nome', 'cognome', 'natoA', 'indirizzo', 'cap', 'comune', 'email', 'telefono'] as const).filter((k) => !d[k]?.trim())
  if (vuoti.length) return `Mancano: ${vuoti.map((k) => NOMI_CAMPI[k]).join(', ')}`
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.natoIl)) return 'La data di nascita non si capisce'
  const nato = new Date(`${d.natoIl}T12:00:00`)
  const cento = new Date(oggi)
  cento.setFullYear(cento.getFullYear() - 100)
  if (Number.isNaN(nato.getTime()) || nato > oggi || nato < cento) return 'La data di nascita non torna'
  if (minorenne(d.natoIl, oggi) && (!d.genitoreNome?.trim() || !d.genitoreCognome?.trim() || !d.genitoreCodiceFiscale?.trim()))
    return 'Per un minore servono nome, cognome e codice fiscale del genitore'
  if (!d.corsi.length) return 'Scegli almeno un corso'
  if (d.corsi.length > 6) return 'Un campo non va: si possono scegliere al massimo sei corsi'
  if (!/^[A-Z0-9]{16}$/.test(pulisciCf(d.codiceFiscale))) return 'Un campo non va: il codice fiscale ha 16 caratteri, lettere e numeri'
  if (minorenne(d.natoIl, oggi) && !/^[A-Z0-9]{16}$/.test(pulisciCf(d.genitoreCodiceFiscale ?? '')))
    return 'Un campo non va: il codice fiscale ha 16 caratteri, lettere e numeri'
  if (!/^\d{5}$/.test(d.cap.trim())) return 'Un campo non va: il CAP ha 5 cifre'
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email.trim())) return "Un campo non va: l'email non sembra giusta"
  const cifre = d.telefono.replace(/\D/g, '').length
  if (cifre < 6 || cifre > 15) return 'Un campo non va: il telefono non sembra giusto'
  if (d.formula !== 'annuale' && d.formula !== 'trimestre') return "Un campo non va: si paga l'annuale o il trimestre"
  return null
}

/** Il nome di un campo com'è scritto nel modulo, per «Mancano: …». */
const NOMI_CAMPI: Record<string, string> = {
  nome: 'nome',
  cognome: 'cognome',
  natoA: 'luogo di nascita',
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
