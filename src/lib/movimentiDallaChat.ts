import { cfValido } from './codiceFiscale'
import { cosaNonVaMovimento, vociOfferte, VOCE_DIFFERENZA, type Cassa, type ChiusuraCassa, type VoceContabile } from './contabilita'
import { VOCE_DA_CLASSIFICARE } from './importaPrimaNota'
import { nomeDallaCausale } from './movimentiPersona'
import { centesimi } from './ricevute'

/**
 * Le fatture dalla chat (`supabase/72-movimenti-dalla-chat.sql`): chi cura i conti fotografa a Claude la fattura
 * o lo scontrino di un fornitore, e il server MCP (`mcp.ts`) registra il movimento dopo il suo «ok». Qui le regole
 * che il server applica prima di scrivere, le stesse di «Nuovo movimento» più quelle della chat: gli incassi degli
 * iscritti si registrano in PAGAMENTI, codice fiscale e IBAN non vanno nella descrizione, e un movimento che
 * sembra lo stesso si fa confermare.
 */

export const MSG_INCASSI = 'Gli incassi degli iscritti si registrano in PAGAMENTI'
export const MSG_PRIVATI = 'Togli codice fiscale e IBAN dalla descrizione'
export const MSG_AMMINISTRAZIONE = 'La contabilità la cura l’amministrazione'
export const MSG_ACCEDI = 'Accedi di nuovo a ODS Corsi'
export const MSG_DATABASE_INDIETRO = 'Il database non è ancora aggiornato per registrare dalla chat: va chiesto a chi cura l’app'
const MSG_DATABASE_INDIETRO_LETTURA = 'Il database non è ancora aggiornato per leggere i conti dalla chat: va chiesto a chi cura l’app'
const MSG_GUASTO = 'Qualcosa non è andato: riprova tra poco, o fallo da CONTABILITÀ nell’app'

/** Quanti giorni indietro una spesa uguale dello stesso fornitore fa pensare alla stessa fattura. */
export const GIORNI_DOPPIONE = 60

/** Un movimento come lo manda Claude: l'importo è il testo letto sul documento. */
export interface MovimentoDallaChat {
  chiave?: string
  tipo?: string
  data?: string
  importo?: string
  voce_id?: string
  cassa_id?: string
  descrizione?: string
  nota?: string
  fornitore?: string
  confermo_doppione?: boolean
}

/** Un movimento già scritto, per il doppione. */
export interface MovimentoEsistente {
  id: string
  tipo: string
  data: string
  importo: number
  descrizione: string
  voceId: string
  personaId: string | null
  annullato: boolean
}

/** Una riga di `movimenti_simili`: mai persone né chi l'ha scritta. */
export interface Simile {
  id: string
  data: string
  tipo: string
  importo: number
  descrizione: string
  voce: string
  voceId: string
  voceAttiva: boolean
  cassa: string
}

/** Le voci che la chat può proporre: quelle di «Nuovo movimento» senza gli incassi degli iscritti. «Da classificare» solo se la si chiede. */
export const vociPerLaChat = (voci: VoceContabile[], tipo: 'entrata' | 'uscita') =>
  vociOfferte(voci, tipo)
    .filter((v) => !v.diSistema)
    .map((v) => ({ id: v.id, nome: v.nome, soloSeLaChiedi: v.nome === VOCE_DA_CLASSIFICARE }))

/** «312,40 €», «45.90», «1.234,50» in centesimi, o perché no (il segno meno si dice, non «non si capisce»). */
export function importoInCentesimi(testo: string): { centesimi: number } | { errore: string } {
  if (/^\s*-/.test(testo)) return { errore: 'L’importo deve essere più di zero' }
  const c = centesimi(testo)
  if (c === null) return { errore: 'L’importo non si capisce' }
  if (c <= 0) return { errore: 'L’importo deve essere più di zero' }
  if (c > 10_000_000) return { errore: 'L’importo è troppo alto: controlla le cifre' }
  return { centesimi: c }
}

const vuoto = (x: unknown) => typeof x !== 'string' || x.trim() === ''

/** Un codice fiscale scritto giusto o un IBAN italiano, anche spezzato dagli spazi. */
function datiPersonali(testo: string): boolean {
  const t = testo.toUpperCase()
  if ((t.match(/\b[A-Z0-9]{16}\b/g) ?? []).some(cfValido)) return true
  return /IT\d{2}[A-Z]\d{10}[0-9A-Z]{12}/.test(t.replace(/\s/g, ''))
}

/** Cosa non va in un movimento dalla chat, o `null`: prima i campi che mancano, poi le regole di «Nuovo movimento». */
export function cosaNonVaDallaChat(
  m: MovimentoDallaChat,
  c: { voci: VoceContabile[]; casse: Cassa[]; chiusure: ChiusuraCassa[]; oggi: string },
): string | null {
  if (m.tipo !== 'entrata' && m.tipo !== 'uscita') return 'Scegli se è un’entrata o un’uscita'
  if (vuoto(m.data)) return 'Scrivi la data'
  if (vuoto(m.importo)) return 'Scrivi l’importo'
  if (vuoto(m.voce_id)) return 'Scegli la voce'
  if (vuoto(m.cassa_id)) return 'Scegli la cassa'
  if (vuoto(m.descrizione)) return 'Scrivi una descrizione'
  const importo = importoInCentesimi(m.importo ?? '')
  if ('errore' in importo) return importo.errore
  const voce = c.voci.find((v) => v.id === m.voce_id)
  if (voce?.diSistema && voce.nome !== VOCE_DIFFERENZA) return MSG_INCASSI
  const regola = cosaNonVaMovimento(
    { tipo: m.tipo, data: m.data ?? '', importo: importo.centesimi, voceId: m.voce_id, cassaId: m.cassa_id ?? '', descrizione: m.descrizione ?? '', nota: m.nota },
    c.voci,
    c.casse,
    c.oggi,
    c.chiusure,
  )
  if (regola) return regola
  if (datiPersonali(m.descrizione ?? '') || datiPersonali(m.nota ?? '')) return MSG_PRIVATI
  return null
}

/** I giorni in cui cercare la stessa fattura: i 60 prima, compreso, fino al giorno del movimento. */
export const finestraDoppione = (data: string): { dal: string; al: string } => ({
  dal: new Date(Date.parse(`${data}T12:00:00Z`) - GIORNI_DOPPIONE * 86_400_000).toISOString().slice(0, 10),
  al: data,
})

const giorni = (da: string, a: string) => Math.round((Date.parse(`${a}T12:00:00Z`) - Date.parse(`${da}T12:00:00Z`)) / 86_400_000)

/**
 * Un movimento non annullato che sembra la stessa fattura: stesso tipo e importo, e lo stesso giorno, o lo stesso
 * fornitore nella descrizione nei 60 giorni prima (la fattura registrata con la sua data, poi col giorno del pagamento).
 * Mai un incasso di un iscritto (collegato a una persona, su una voce di sistema, o «Cliente <nome> per …» dello storico):
 * la sua descrizione andrebbe a Claude.
 */
export function doppioneDi(
  nuovo: { tipo: string; data: string; importo: number; fornitore?: string },
  esistenti: MovimentoEsistente[],
  voci: VoceContabile[],
): MovimentoEsistente | null {
  const fornitore = nuovo.fornitore?.trim().toLowerCase() ?? ''
  const diSistema = new Set(voci.filter((v) => v.diSistema).map((v) => v.id))
  return (
    esistenti.find((e) => {
      if (e.annullato || e.personaId || diSistema.has(e.voceId) || nomeDallaCausale(e.descrizione)) return false
      if (e.tipo !== nuovo.tipo || e.importo !== nuovo.importo) return false
      if (e.data === nuovo.data) return true
      const prima = giorni(e.data, nuovo.data)
      return fornitore !== '' && prima >= 0 && prima <= GIORNI_DOPPIONE && e.descrizione.toLowerCase().includes(fornitore)
    }) ?? null
  )
}

/** La voce dell'ultima volta: quella del simile più recente che non è «Da classificare», se è ancora in uso. */
export function voceProposta(simili: Simile[]): { proposta: { id: string; nome: string } | null; avviso: string | null } {
  const ultimo = [...simili].sort((x, y) => y.data.localeCompare(x.data)).find((s) => s.voce !== VOCE_DA_CLASSIFICARE)
  if (!ultimo) return { proposta: null, avviso: null }
  if (!ultimo.voceAttiva) return { proposta: null, avviso: `L’ultima volta era su «${ultimo.voce}», che non è più in uso: scegli tu la voce` }
  return { proposta: { id: ultimo.voceId, nome: ultimo.voce }, avviso: null }
}

/**
 * L'errore di Supabase detto per chi usa l'app: i rifiuti del database con le loro parole, il resto mai grezzo.
 * `per` dice cosa si stava facendo, perché il database indietro si spiega diversamente a chi legge e a chi registra.
 */
export function testoDellErrore(e: unknown, per: 'registrare' | 'leggere' = 'registrare'): string {
  // Un errore qualunque: si leggono solo `code` e `message`, se ci sono, e restano `unknown` finché non si guardano.
  const { code, message } = (typeof e === 'object' && e !== null ? e : {}) as { code?: unknown; message?: unknown }
  const testo = typeof message === 'string' ? message : ''
  if (code === '22023' && testo) return testo
  if (code === '42501') return MSG_AMMINISTRAZIONE
  if (code === 'PGRST301' || code === 'PGRST303' || /JWT/i.test(testo)) return MSG_ACCEDI
  // La funzione o la colonna del 72 che non ci sono ancora.
  if (code === 'PGRST202' || code === '42883' || code === '42703') return per === 'leggere' ? MSG_DATABASE_INDIETRO_LETTURA : MSG_DATABASE_INDIETRO
  return MSG_GUASTO
}
