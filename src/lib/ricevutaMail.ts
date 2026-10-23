// ---------------------------------------------------------------------------
// Il nome del PDF di una ricevuta, il testo della mail che lo porta alla
// famiglia, e quello che decide la Edge Function `ricevuta-email` (cosa
// accetta, a chi manda, cosa risponde), così che si provi senza posta né
// database.
//
// Questo file ha una copia identica in supabase/functions/ricevuta-email/
// mail.ts: la funzione gira su Deno, che src/lib non lo legge. Per questo qui
// si importa solo la cornice (cornicaMail.ts, con la sua copia accanto);
// `npm run prova:ricevute-email` controlla che le copie siano uguali. Si
// cambia qui e si ricopia là.
// ---------------------------------------------------------------------------

import { incorniciaMail, tabellaMail } from './cornicaMail.ts'

/** Il telefono della palestra: lo stesso di `CONTATTI` in sito.ts, e la prova lo controlla. */
const TELEFONO = '346 329 2786'

const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre']

interface RicevutaMail {
  numero: number
  anno: number
  /** `AAAA-MM-GG`. */
  data: string
  /** Centesimi. */
  totale: number
  intestatario: { nome: string; cognome: string }
}

/** Minuscole senza accenti né segni: come `nomeCorso` di listino.ts, che qui non si importa. */
const pulito = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/[^a-z0-9]+/g, ' ').trim()

export const nomeFileRicevuta = (r: Pick<RicevutaMail, 'numero' | 'anno' | 'intestatario'>) =>
  `ricevuta-${r.numero}-${r.anno}-${pulito(`${r.intestatario.cognome} ${r.intestatario.nome}`).replace(/ /g, '-')}.pdf`

const euro = (cent: number) => (cent / 100).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: true })

/** «21 ottobre 2026»: a mano, perché la data della ricevuta è un giorno e non un istante. */
const giorno = (d: string) => `${Number(d.slice(8, 10))} ${MESI[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}`

/**
 * Oggetto, testo e nome dell'allegato della mail. Solo nome, numero, data e
 * totale: niente codice fiscale, indirizzo o nascita, che stanno nel PDF.
 */
export function testoMail(r: RicevutaMail): { oggetto: string; testo: string; html: string; allegato: string } {
  const chi = `${r.intestatario.nome} ${r.intestatario.cognome}`.trim()
  const n = `${r.numero}/${r.anno}`
  return {
    oggetto: `Ricevuta n. ${n} per ${chi} · Officine Dello Sport`,
    testo:
      `Buongiorno, in allegato la ricevuta n. ${n} del ${giorno(r.data)} per ${chi}: ${euro(r.totale)} €.\n\n` +
      `Per qualsiasi domanda chiamaci al ${TELEFONO}. A presto in palestra, Officine Dello Sport.`,
    html: cornice(r, chi, n),
    allegato: nomeFileRicevuta(r),
  }
}

/** L'HTML con la cornice: i valori li converte la tabella. */
function cornice(r: RicevutaMail, chi: string, n: string): string {
  const corpo =
    `<p style="margin:0 0 14px">Buongiorno, ecco la ricevuta del pagamento: la trovi in allegato, in PDF.</p>` +
    tabellaMail([['Ricevuta n.', n], ['Data', giorno(r.data)], ['Intestata a', chi], ['Totale', `${euro(r.totale)} €`]]) +
    `<p style="margin:14px 0 0">Per qualsiasi domanda chiamaci al <a href="tel:+39${TELEFONO.replace(/ /g, '')}">${TELEFONO}</a>. A presto in palestra.</p>`
  return incorniciaMail(corpo, { testata: 'Officine Dello Sport', piede: 'Officine Dello Sport' })
}

/** Una risposta di no della Edge Function: `tipo` è un MotivoNonPartita di ricevuteEmail.ts. Mai 404: per l'app vuol dire «la funzione non è pubblicata». */
export interface Rifiuto {
  guaio: string
  stato: number
  tipo: 'posta' | 'soglia' | 'troppe' | 'senza-indirizzo' | 'annullata' | 'manca-sql' | 'manca-password'
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
/** Una ricevuta è di poche decine di KB: 2 MB sono già un PDF che non è il nostro. */
const PDF_MASSIMO = 2 * 1024 * 1024

/**
 * Il corpo della richiesta: solo la ricevuta e il PDF in base64. Tutto il
 * resto, un indirizzo compreso, si butta: l'indirizzo lo sceglie il database.
 * Del PDF si controlla solo che lo sia e che non sia troppo grosso.
 */
export function leggiCorpo(corpo: unknown): { ricevuta: string; pdf: string } | Rifiuto {
  const ricevuta = corpo && typeof corpo === 'object' && 'ricevuta' in corpo ? corpo.ricevuta : undefined
  const pdf = corpo && typeof corpo === 'object' && 'pdf' in corpo ? corpo.pdf : undefined
  if (typeof ricevuta !== 'string' || !UUID.test(ricevuta)) return { guaio: 'Manca la ricevuta', stato: 400, tipo: 'posta' }
  const storto: Rifiuto = { guaio: 'Il PDF non va', stato: 400, tipo: 'posta' }
  // In base64 il PDF pesa un terzo in più.
  if (typeof pdf !== 'string' || pdf.length > (PDF_MASSIMO * 4) / 3 + 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(pdf)) return storto
  let inizio = ''
  try {
    inizio = atob(pdf.slice(0, 8))
  } catch {
    // Non è base64: sotto si rifiuta.
  }
  return inizio.startsWith('%PDF') ? { ricevuta, pdf } : storto
}

/** Il no di `controlla_invio_ricevuta`, dal codice dell'errore e mai dal testo (76-ricevute-email.sql). */
export function noDalControllo(codice: string | undefined): Rifiuto {
  if (codice === 'PGRST202' || codice === '42883') return { guaio: 'Va lanciato 76-ricevute-email.sql: vedi supabase/LEGGIMI.md', stato: 501, tipo: 'manca-sql' }
  if (codice === '55000') return { guaio: 'La ricevuta è annullata: non si manda', stato: 409, tipo: 'annullata' }
  if (codice === '54000') return { guaio: 'Questa ricevuta è già partita 3 volte nelle ultime 24 ore', stato: 429, tipo: 'troppe' }
  if (codice === '42501') return { guaio: 'Serve un accesso da segreteria', stato: 403, tipo: 'posta' }
  return { guaio: 'La ricevuta non si legge', stato: 400, tipo: 'posta' }
}

/** Quello che serve qui di `controlla_invio_ricevuta`: mai l'indirizzo. */
export interface ControlloInvio {
  ha_indirizzo: boolean
  oltre_soglia: boolean
  segreteria: boolean
}

/**
 * Se la mail parte, e a chi: all'indirizzo che dà il database
 * (`indirizzo_ricevuta`), mai a uno del corpo. Se no, il rifiuto e il motivo
 * da lasciare in `invii_ricevute` (`registra`); senza indirizzo non resta
 * niente, come quando la mail non si prova nemmeno.
 */
export function decidiInvio(c: ControlloInvio, indirizzo: string | null, haPassword: boolean): { manda: true; a: string } | (Rifiuto & { manda: false; registra: string | null }) {
  if (!c.ha_indirizzo || !indirizzo) return { manda: false, guaio: 'Nessuna email in scheda', stato: 409, tipo: 'senza-indirizzo', registra: null }
  if (c.oltre_soglia) return { manda: false, guaio: 'Oggi sono partite 400 mail, il massimo', stato: 429, tipo: 'soglia', registra: 'soglia' }
  if (!haPassword)
    return { manda: false, guaio: 'Manca la password della posta fra i segreti della funzione: vedi supabase/LEGGIMI.md, «La ricevuta per email»', stato: 501, tipo: 'manca-password', registra: 'manca SMTP_PASSWORD' }
  return { manda: true, a: indirizzo }
}

/** La risposta a mail partita: a chi solo alla segreteria (l'amministrazione i recapiti non li vede), e se non è rimasta nello storico. */
export function rispostaMandata(c: ControlloInvio, indirizzo: string, registrata: boolean): { esito: 'mandata'; indirizzo?: string; registrata?: false } {
  return { esito: 'mandata', ...(c.segreteria ? { indirizzo } : {}), ...(registrata ? {} : { registrata: false }) }
}
