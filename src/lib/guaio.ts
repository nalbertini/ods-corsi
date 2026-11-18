// La traduzione unica degli errori: il testo grezzo delle API (Supabase,
// PostgREST, Postgres, Storage, Auth, il browser) non arriva mai a video.
// I messaggi scritti da noi in italiano (raise exception nel database, guaio
// delle Edge Functions) passano identici; il resto diventa una frase per chi
// legge, e il grezzo va solo in console.error per chi cura l'app.

/** Chi legge il messaggio: cambia la frase, perché cambia cosa può fare. */
export type Lettore = 'personale' | 'tablet' | 'iscritto' | 'pubblico'

/** La frase di riserva quando dell'errore non si sa niente. */
export const RIPIEGO = 'Non è andata: riprova fra poco'

const SEGRETERIA = '346 329 2786'

type Caso = 'rete' | 'tentativi' | 'troppoGrande' | 'tipoFile' | 'sessione' | 'permesso' | 'doppione' | 'collegato' | 'nonAttiva'

// Una frase per lettore; quella che manca vuol dire «il ripiego»: per quel
// lettore il caso non dice niente di utile (un doppione al tablet).
const FRASI: Record<Caso, Partial<Record<Lettore, string>>> = {
  rete: {
    personale: 'Non si collega: controlla la connessione e riprova',
    iscritto: 'Non si collega: controlla la connessione e riprova',
    pubblico: 'Non si collega: controlla la connessione e riprova',
    tablet: 'Non si collega: controlla il Wi-Fi e riprova',
  },
  tentativi: tutti('Troppi tentativi di fila: aspetta qualche minuto e riprova'),
  troppoGrande: tutti('Il file è troppo grande: al massimo 10 MB'),
  tipoFile: tutti('Questo tipo di file non va: serve una foto o un PDF'),
  sessione: {
    personale: 'Accedi di nuovo a ODS Corsi',
    tablet: 'Il tablet va riaperto: chiedi alla segreteria di rientrare. Non ricaricare la pagina finché non è fatto',
    iscritto: "Accedi di nuovo all'area iscritti",
    pubblico: `La pagina è rimasta aperta troppo a lungo: ricaricala e riprova; se non va, chiama la segreteria al ${SEGRETERIA}`,
  },
  permesso: {
    personale: "Non hai il permesso di farlo. Esci e rientra; se ricapita, avvisa chi cura l'app",
    tablet: 'Il tablet non può farlo: chiedi alla segreteria',
    iscritto: `Questa operazione non si può fare da qui: se ti serve, chiama la segreteria al ${SEGRETERIA}`,
    pubblico: `Non è andata: chiama la segreteria al ${SEGRETERIA}, ti aiutiamo noi`,
  },
  doppione: {
    personale: "C'è già: per esempio un'email già usata o un corso già assegnato. Cerca prima di aggiungere",
    iscritto: `Non riesco a completare l'iscrizione: chiama la segreteria al ${SEGRETERIA}, ti aiutiamo noi`,
    pubblico: `Non riesco a completare l'iscrizione: chiama la segreteria al ${SEGRETERIA}, ti aiutiamo noi`,
  },
  collegato: {
    personale: 'Non si può togliere: è ancora collegato ad altro, per esempio iscritti o pagamenti. Togli prima quelli',
  },
  nonAttiva: {
    personale: "Questa funzione non è ancora attiva: avvisa chi cura l'app",
    tablet: 'Questa parte del tablet non è ancora attiva: avvisa la segreteria',
    iscritto: "L'area degli iscritti non è ancora attiva: chiedi alla segreteria",
    pubblico: `Il modulo non è disponibile in questo momento: riprova più tardi o chiama la segreteria al ${SEGRETERIA}`,
  },
}

function tutti(frase: string): Record<Lettore, string> {
  return { personale: frase, tablet: frase, iscritto: frase, pubblico: frase }
}

/** Quel che serve di un errore, qualunque forma abbia (Error, PostgrestError, StorageError, AuthError, stringa). */
interface Pezzi {
  testo: string
  codice: string
  stato: string
  nome: string
  errore: string
}

function pezzi(e: unknown): Pezzi {
  if (typeof e === 'string') return { testo: e, codice: '', stato: '', nome: '', errore: '' }
  if (!e || typeof e !== 'object') return { testo: '', codice: '', stato: '', nome: '', errore: '' }
  // Un oggetto qualunque: si leggono solo i campi che le API usano, come stringhe.
  const o = e as Record<string, unknown>
  const s = (v: unknown) => (typeof v === 'string' || typeof v === 'number' ? String(v) : '')
  return { testo: s(o.message), codice: s(o.code), stato: s(o.status) || s(o.statusCode), nome: s(o.name), errore: s(o.error) }
}

// Parole che in un nostro messaggio non ci sono, e nel grezzo sì: bastano a
// dire «inglese» anche se il testo ha una lettera accentata (un nome).
const INGLESE = /\b(the|of|for|to|is|not|does|could|cannot|failed|denied|violates|too|many|found|invalid|expired|exceeded|returned|error|from|with|on|table|column|function|relation|requests?|supported|properties|reading|undefined|null|status|code|key|session|payload|duplicate|row|allowed|maximum|exist)\b/i

// Parole italiane frequenti nei nostri messaggi: un testo senza accenti è
// nostro solo se ne ha almeno una. Contare le vocali finali faceva passare
// l'inglese corto («Service Unavailable», «Storage quota»). «token» non sta
// fra le parole inglesi: lo usano i nostri messaggi.
const ITALIANO = /\b(il|lo|la|le|gli|un|una|uno|non|di|del|della|dei|delle|da|dal|dalla|per|con|che|si|ci|va|manca|mancano|solo|questo|questa|quello|più|già|ancora|prima|dopo|serve|servono|può|sono|hai|ha|deve|richiesta|chi|come|col|li|te|fra|qualche|riprova|scegli|troppi|troppe|troppo|nessuna|nessun|nessuno|inesistente|annullata|annullato|sconosciuto|sconosciuta|data)\b/i

/** Vero se il testo è un nostro messaggio italiano, da mostrare com'è. */
export function italiano(testo: string): boolean {
  // Un codice come «invalid_mime_type» non è una frase; i nostri messaggi
  // nominano solo segreti in maiuscolo (SMTP_PASSWORD).
  if (!testo.trim() || /\b[a-z]+_[a-z_]+\b/.test(testo) || INGLESE.test(testo)) return false
  return /[àèéìòùÀÈÉÌÒÙ’]/.test(testo) || ITALIANO.test(testo)
}

function caso({ testo, codice, stato, nome, errore }: Pezzi): Caso | null {
  const t = `${testo} ${errore}`
  if (nome === 'FunctionsFetchError' || /failed to fetch|networkerror|load failed|failed to send a request/i.test(t)) return 'rete'
  if (stato === '429' || /rate_limit|rate limit|too many requests/i.test(`${t} ${codice}`)) return 'tentativi'
  if (stato === '413' || /payload too large|exceeded the maximum allowed size/i.test(t)) return 'troppoGrande'
  if (stato === '415' || /invalid_mime_type|mime type/i.test(t)) return 'tipoFile'
  if (codice === 'PGRST301' || codice === 'refresh_token_not_found' || codice === 'session_not_found' || stato === '401' || /\bjwt\b|refresh token/i.test(t)) return 'sessione'
  if (codice === '42501' || /permission denied|row-level security/i.test(t)) return 'permesso'
  if (codice === '23505' || /duplicate key/i.test(t)) return 'doppione'
  if (codice === '23503' || /foreign key/i.test(t)) return 'collegato'
  if (['PGRST202', 'PGRST204', 'PGRST205', '42P01', '42703'].includes(codice) || /schema cache|does not exist/i.test(t)) return 'nonAttiva'
  return null
}

/**
 * La frase da mostrare per un errore. Un nostro messaggio italiano passa
 * com'è; un errore riconosciuto dà la frase del suo caso per chi legge;
 * il resto dà `ripiego` (o RIPIEGO), con il grezzo in console.error.
 */
export function fraseGuaio(e: unknown, opzioni: { per?: Lettore; ripiego?: string } = {}): string {
  const per = opzioni.per ?? 'personale'
  const p = pezzi(e)
  if (italiano(p.testo)) return p.testo
  const c = caso(p)
  const frase = c ? FRASI[c][per] : undefined
  if (frase) return frase
  console.error(e)
  return opzioni.ripiego || RIPIEGO
}
