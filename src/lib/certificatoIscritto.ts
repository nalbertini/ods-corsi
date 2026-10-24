import { AVVISO_CERTIFICATO, spostaGiorno, statoCertificato, type CertificatoSeg } from './segreteria'

/**
 * Il certificato medico che l'iscritto manda dall'area iscritti
 * (`102-certificato-iscritto.sql`): il file resta «in attesa» finché la
 * segreteria scrive la scadenza o lo rifiuta. Qui le regole che si provano
 * senza browser: il file, i messaggi d'errore, cosa mostra il riquadro.
 */

/** Più piccolo del contenitore (10 MB): una foto del telefono ci sta, e sul 4G sale. */
const MASSIMO_MANDATO = 5 * 1024 * 1024

/** I tipi che la policy di `102-certificato-iscritto.sql` lascia salire, con l'estensione del nome. */
export const ESTENSIONI_MANDATO: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
}

/** Cosa dire a chi ha scelto un file che non va, o `null` se va bene. */
export function cosaNonVaFileMandato(file: Pick<File, 'type' | 'size'>): string | null {
  if (!ESTENSIONI_MANDATO[file.type]) return 'Questo tipo di file non va: serve una foto o un PDF'
  if (file.size === 0) return 'Il file è vuoto: scegline un altro'
  if (file.size > MASSIMO_MANDATO) return 'Il file è troppo grande: al massimo 5 MB'
  return null
}

interface ErroreDb {
  message?: string
  code?: string
}

/** Mai il testo grezzo dell'API: cosa fare, in parole di chi usa l'app. */
export function guaioMandaCertificato(e: ErroreDb | null): Error {
  const testo = e?.message ?? ''
  if (/fetch|network|load failed/i.test(testo)) return new Error('Il server non risponde: c’è rete? Riprova fra poco')
  // PostgREST non trova la funzione: 102-certificato-iscritto.sql non è sul database.
  if (e?.code === 'PGRST202') return new Error('Mandare il certificato da qui non è ancora attivo: portalo in segreteria')
  // Il tetto di 110-tetto-certificato-messaggio.sql: Storage non passa il codice, solo il testo.
  if (e?.code === '54000' || /troppi file/.test(testo)) return new Error('Hai già mandato tre file: aspetta che la segreteria li guardi, poi potrai mandarne altri')
  if (e?.code === '42501') return new Error('Non puoi mandare il certificato di questa persona')
  return new Error('Il certificato non è partito: riprova fra poco')
}

export interface BoxCertificato {
  /** `manda-altro` solo con un invio in attesa: sostituisce quello. */
  tasto: 'manda' | 'manda-altro' | null
  testo: string
}

const data = (g: string) => g.split('-').reverse().join('/')

/**
 * Cosa scrive il riquadro CERTIFICATO MEDICO e se c'è il tasto per mandarlo.
 * `attivo` è falso quando il database non ha ancora 102: niente tasto, e il
 * testo manda in segreteria come prima.
 */
export function boxCertificato(
  s: { certificato: Pick<CertificatoSeg, 'scade'> & { inAttesaIl?: string }; natoIl?: string },
  oggi: string,
  attivo: boolean,
): BoxCertificato {
  const stato = statoCertificato(s, oggi)
  if (stato === 'non_serve') return { tasto: null, testo: 'Non serve ancora: dal sesto compleanno sì.' }
  if (!attivo) return { tasto: null, testo: 'Per il certificato medico passa in segreteria.' }
  const attesa = s.certificato.inAttesaIl
  if (attesa) return { tasto: 'manda-altro', testo: `In attesa di conferma: l’hai mandato il ${data(attesa)}, la segreteria scrive la scadenza.` }
  // `in_scadenza` è entro `AVVISO_CERTIFICATO` giorni, lo stesso mese dell'avviso in cima alla pagina.
  const scade = s.certificato.scade
  if (stato === 'valido' && scade && scade > spostaGiorno(oggi, AVVISO_CERTIFICATO)) return { tasto: null, testo: `Valido fino al ${data(scade)}.` }
  return { tasto: 'manda', testo: 'Manda una foto o un PDF del certificato: la segreteria lo controlla e scrive la scadenza.' }
}
