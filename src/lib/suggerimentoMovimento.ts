import { VOCE_DIFFERENZA, VOCE_VARIE, vociOfferte, vuolePersonaRiga, type RigaMovimento, type VoceContabile } from './contabilita'
import { VOCE_DA_CLASSIFICARE } from './importaPrimaNota'
import { ordinaAbbinati, type Abbinato, type ComeAbbinato } from './abbinaMovimenti'
import { normalizzaNome, nomeDallaCausale, type PersonaPerNome } from './movimentiPersona'

/**
 * Cosa propone l'app per un movimento «Da classificare»: la voce, dalle altre righe uguali, e la persona, dal nome
 * scritto nel testo. Propone e basta: niente si scrive finché chi amministra non conferma. Senza elenco delle persone
 * né di quel che devono pagare (l'amministrazione non li vede): la persona si cerca per nome con `cercaPagatori`.
 */

export type Come = ComeAbbinato | 'nome e iniziale'

/** Il nome nel testo del movimento: «Satispay · Elisa M.» → «Elisa M.»; «Cliente X per …» → «X». */
export function nomeDalTesto(descrizione: string): string | null {
  const s = /^\s*(?:rimborso\s+)?satispay\s*[·:-]\s*(\S[\s\S]*)$/i.exec(descrizione)
  return s ? s[1].replace(/\s+/g, ' ').trim() : nomeDallaCausale(descrizione)
}

const parole = (s: string): string[] => normalizzaNome(s).replace(/\./g, ' ').split(' ').filter(Boolean)

/** La parola con cui cercare le schede (almeno tre lettere, la più lunga): un'iniziale sola non cerca niente. */
export function parolaDaCercare(nome: string | null): string | null {
  const piene = parole(nome ?? '').filter((p) => p.length >= 3)
  return piene.sort((a, b) => b.length - a.length)[0] ?? null
}

const uguali = (a: string[], b: string[]): boolean => a.length === b.length && [...a].sort().join(' ') === [...b].sort().join(' ')

/**
 * Le persone che il nome può essere: per nome intero (in qualunque ordine) o per nome più l'iniziale dell'altra parte
 * («Elisa M.», «M. Rossi»). Un nome solo, o due iniziali, non bastano. In ordine di cognome e nome.
 */
export function abbinaPerNomeOIniziale(nome: string | null, persone: PersonaPerNome[]): Array<{ id: string; come: Come }> {
  const p = parole(nome ?? '')
  if (!p.length) return []
  const trovate: Array<{ id: string; come: Come; ordine: string }> = []
  const grezze = normalizzaNome(nome ?? '').split(' ')
  const iniziali = grezze.filter((x) => x.replace('.', '').length === 1)
  const piene = p.filter((x) => x.length > 1)
  for (const x of persone) {
    const dNome = parole(x.nome)
    const dCognome = parole(x.cognome)
    const ordine = `${normalizzaNome(x.cognome)} ${normalizzaNome(x.nome)} ${x.id}`
    if (!iniziali.length && uguali(p, [...dNome, ...dCognome])) trovate.push({ id: x.id, come: 'nome intero', ordine })
    else if (iniziali.length === 1 && piene.length) {
      const i = iniziali[0].replace('.', '')
      const quadra = (data: string[], altra: string[]) => piene.every((w) => data.includes(w)) && altra.some((w) => w[0] === i && !piene.includes(w))
      if (quadra(dNome, dCognome) || quadra(dCognome, dNome)) trovate.push({ id: x.id, come: 'nome e iniziale', ordine })
    }
  }
  return trovate.sort((a, b) => a.ordine.localeCompare(b.ordine, 'it')).map(({ id, come }) => ({ id, come }))
}

// Senza cifre né punteggiatura: «Affitto 03/2026» e «Affitto 04/2026» sono la stessa spesa.
const confrontabile = (s: string): string => normalizzaNome(s).replace(/[^\p{L}' ]/gu, ' ').replace(/\s+/g, ' ').trim()

const VOCI_DA_SISTEMARE = [VOCE_DA_CLASSIFICARE, VOCE_VARIE, VOCE_DIFFERENZA]

export interface VoceSuggerita {
  voceId: string
  nome: string
  motivo: string
}

/** Almeno due altre righe con lo stesso testo, già classificate, tutte sulla stessa voce: quella voce. */
export function vocePerDescrizione(riga: RigaMovimento, righe: RigaMovimento[], voci: VoceContabile[]): VoceSuggerita | null {
  if (riga.tipo !== 'entrata' && riga.tipo !== 'uscita') return null
  const k = confrontabile(riga.descrizione)
  if (!k) return null
  const altre = righe.filter((r) => r.id !== riga.id && r.origine === 'movimento' && !r.annullato && r.tipo === riga.tipo && r.voce && !VOCI_DA_SISTEMARE.includes(r.voce) && confrontabile(r.descrizione) === k)
  if (altre.length < 2 || altre.some((r) => r.voce !== altre[0].voce)) return null
  const voce = vociOfferte(voci, riga.tipo).find((v) => v.nome === altre[0].voce)
  return voce ? { voceId: voce.id, nome: voce.nome, motivo: `Altre ${altre.length} voci uguali sono su «${voce.nome}»` } : null
}

/** La parola con cui cercare le schede per questo movimento; `null` se il blocco non deve cercare niente (non è un'entrata da classificare, o ha già la persona). */
export function parolaDelMovimento(riga: RigaMovimento): string | null {
  return cercaPersonaDelMovimento(riga) ? parolaDaCercare(nomeDalTesto(riga.descrizione)) : null
}

/** Il blocco deve cercare la persona (nome, genitore, codice fiscale, importo): anche se dal testo non si ricava un nome, come nei bonifici («Da VACCARO ANDREA»). */
export function cercaPersonaDelMovimento(riga: RigaMovimento): boolean {
  return riga.origine === 'movimento' && !riga.annullato && riga.tipo === 'entrata' && !riga.personaId && riga.voce === VOCE_DA_CLASSIFICARE
}

export type PersonaSuggerita = 'candidati' | 'nessuna-spesa' | 'nessuna-senza-persona' | 'gia-collegata' | 'da-scegliere'

export interface SuggerimentoMovimento {
  /** A un candidato, B più candidati, C voce senza persona (o persona da scegliere), D niente. */
  caso: 'A' | 'B' | 'C' | 'D'
  voce: VoceSuggerita | null
  persona: PersonaSuggerita
  candidati: Array<PersonaPerNome & { come: Come; giaIscritto: boolean }>
  /** Solo con un candidato solo, e non già iscritto: più di uno si sceglie. */
  preselezionato: string | null
}

/** Il blocco «Suggerito» di un movimento da classificare; `null` per ogni altro movimento: lì non c'è. */
export function suggerisciMovimento(riga: RigaMovimento, righe: RigaMovimento[], voci: VoceContabile[], persone: PersonaPerNome[], abbinati: Abbinato[] = []): SuggerimentoMovimento | null {
  if (riga.origine !== 'movimento' || riga.annullato || (riga.tipo !== 'entrata' && riga.tipo !== 'uscita') || riga.voce !== VOCE_DA_CLASSIFICARE) return null
  const voce = vocePerDescrizione(riga, righe, voci)
  const senza = { voce, candidati: [], preselezionato: null }
  if (riga.personaId) return { caso: voce ? 'C' : 'D', ...senza, persona: 'gia-collegata' }
  if (riga.tipo === 'uscita') return { caso: voce ? 'C' : 'D', ...senza, persona: 'nessuna-spesa' }
  // Lo storico non porta la persona (vuolePersonaRiga): lì si propone solo la voce.
  if (riga.origineImport?.startsWith('prima-nota:') || (voce && !vuolePersonaRiga(riga, voce.nome))) return { caso: voce ? 'C' : 'D', ...senza, persona: 'nessuna-senza-persona' }
  // Le persone abbinate dal database (nome, genitore, codice fiscale) vincono sul solo nome; senza, vale il nome.
  const perId = new Map(persone.map((p) => [p.id, p]))
  const { candidati, preselezionato } = abbinati.length
    ? ordinaAbbinati(abbinati)
    : {
        candidati: abbinaPerNomeOIniziale(nomeDalTesto(riga.descrizione), persone).flatMap((c) => {
          const p = perId.get(c.id)
          return p ? [{ id: p.id, nome: p.nome, cognome: p.cognome, come: c.come, giaIscritto: false }] : []
        }),
        preselezionato: null,
      }
  if (!candidati.length) return { caso: voce ? 'C' : 'D', ...senza, persona: voce ? 'da-scegliere' : 'nessuna-senza-persona' }
  return { caso: candidati.length === 1 ? 'A' : 'B', voce, persona: 'candidati', candidati, preselezionato: abbinati.length ? preselezionato : candidati.length === 1 ? candidati[0].id : null }
}

/** Cosa scrive «Conferma»; `null` se non si può ancora (manca la voce o la persona): il tasto resta spento. */
export function confermaDi(s: SuggerimentoMovimento, sceltaId: string | null): { voceId: string; personaId?: string } | null {
  if (!s.voce) return null
  if (s.persona === 'da-scegliere') return null
  if (s.persona !== 'candidati') return { voceId: s.voce.voceId }
  const id = sceltaId ?? s.preselezionato
  return id && s.candidati.some((c) => c.id === id) ? { voceId: s.voce.voceId, personaId: id } : null
}

/** La riga sotto i candidati: perché sono questi. Il motivo è quello del primo, che ha vinto la regola: gli altri hanno lo stesso. */
export function motivoCandidati(candidati: ReadonlyArray<{ come: Come; giaIscritto: boolean }>): string {
  const [primo] = candidati
  const base =
    primo?.come === 'nome intero' && candidati.length === 1 ? 'Il nome nel testo combacia con questa scheda.'
    : primo?.come === 'nome intero' ? 'Nome e cognome sono nel testo, ma la scheda è più di una: scegli.'
    : primo?.come === 'genitore' ? 'Nei dati di registrazione il genitore ha il nome che c’è nel testo: di solito paga per i figli.'
    : primo?.come === 'codice fiscale' ? 'Il codice fiscale scritto nella causale è di questa persona o del suo genitore.'
    : primo?.come === 'corso e cognome' ? 'L’importo è quello di un corso a cui è iscritta e il cognome è nel testo.'
    : 'Il nome nel testo potrebbe essere di chi paga, non di chi frequenta: controlla.'
  return candidati.length > 1 && candidati.some((c) => c.giaIscritto) ? `${base} Chi ha già l’iscrizione in corso è in fondo.` : base
}
