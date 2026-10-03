import type { Formula } from './richieste'
import type { Ricevuta } from './ricevute'
import { centesimi, euro, voceQuota, vociDelCorso } from './ricevute'
import type { CorsoRef, Listino } from './listino'

/**
 * Il nucleo familiare: chi iscrive anche figli, coniuge o fratelli li vede
 * con un accesso solo, e li aggiunge riusando i suoi dati.
 *
 * Il nucleo è di chi lo tiene, il **titolare**: un genitore, di solito. Ogni
 * persona del nucleo ha in `nucleo` l'id del titolare (in prova
 * `PersonaProva.nucleo`); il titolare vede tutti, gli altri solo sé stessi.
 * Una persona aggiunta dall'area degli iscritti nasce come una richiesta
 * online qualunque, con `nucleoDi`: la controlla la segreteria, e accolta
 * entra nel nucleo (vedi `accogli` in `richiesteProva.ts`).
 *
 * Qui ci sono anche i conti di quanto costa una persona in più, con lo
 * sconto famiglia del listino: l'annuale col costo minore del nucleo ha il
 * 20% di sconto, la quota associativa no. Gli annuali già pagati si leggono
 * dalle ricevute; è una stima, e l'importo giusto lo conferma la segreteria.
 * Sulla ricevuta lo sconto lo mette la segreteria da sé (vedi `NuovaRicevuta`):
 * il prezzo della voce è già scontato, e la descrizione dice su quanto.
 */

/** Lo sconto famiglia, sull'annuale col costo minore. */
export const SCONTO_FAMIGLIA = 0.2

/** Un abbonamento annuale del nucleo: di chi, quale, quanto (in centesimi). */
export interface Abbonamento {
  chi: string
  corso: string
  /** Il prezzo pieno, anche se lo sconto c'è già stato. */
  importo: number
  /** Lo sconto famiglia l'ha già avuto, sulla sua ricevuta. */
  scontato?: true
}

/** La descrizione di un annuale scontato: «Annuale Judo 2 · sconto famiglia 20% su 340,00 €». */
export const descrizioneScontata = (descrizione: string, pieno: number) =>
  `${descrizione} · sconto famiglia ${Math.round(SCONTO_FAMIGLIA * 100)}% su ${euro(pieno)} €`

/** Da una descrizione scontata, quella di prima e il prezzo pieno; `null` se non è scontata. */
export function scontoDellaVoce(descrizione: string): { descrizione: string; pieno: number } | null {
  const x = /^(.*) · sconto famiglia \d+% su ([\d.]+,\d{2}) €$/.exec(descrizione)
  const pieno = x ? centesimi(x[2]) : null
  return x && pieno !== null ? { descrizione: x[1], pieno } : null
}

/** Lo sconto di un annuale che costa `pieno` centesimi. */
export const importoSconto = (pieno: number) => Math.round(pieno * SCONTO_FAMIGLIA)

/**
 * Gli annuali già pagati dal nucleo, dalle ricevute non annullate: le voci
 * «Annuale …» (vedi `vociDelCorso` in `ricevute.ts`), col prezzo pieno anche
 * quelle scontate. `chi` è il nome da mostrare, per id.
 */
export function abbonamentiDalleRicevute(ricevute: Ricevuta[], chi: (personaId: string) => string): Abbonamento[] {
  return ricevute
    .filter((r) => !r.annullataIl && r.personaId)
    .flatMap((r) =>
      r.voci
        .filter((v) => /^annuale /i.test(v.descrizione))
        .map((v): Abbonamento => {
          const s = scontoDellaVoce(v.descrizione)
          const corso = (s?.descrizione ?? v.descrizione).replace(/^annuale /i, '')
          return s ? { chi: chi(r.personaId!), corso, importo: s.pieno * v.quantita, scontato: true } : { chi: chi(r.personaId!), corso, importo: v.prezzo * v.quantita }
        }),
    )
}

/**
 * Su quale annuale va lo sconto famiglia: su quello che l'ha già avuto, se
 * c'è; se no, con almeno due annuali, su quello che costa meno. A pari prezzo
 * vince il primo dei `suoi`, quelli da pagare adesso: gli altri hanno già
 * pagato. `null` se lo sconto non c'è.
 */
export function doveVaLoSconto<A extends Abbonamento>(suoi: A[], altri: Abbonamento[]): A | Abbonamento | null {
  const tutti: Abbonamento[] = [...suoi, ...altri]
  const gia = tutti.find((a) => a.scontato)
  if (gia) return gia
  if (tutti.length < 2) return null
  return tutti.reduce((x, y) => (y.importo < x.importo ? y : x))
}

export interface RigaStima {
  testo: string
  /** Centesimi; lo sconto è negativo. */
  importo: number
}

export interface Stima {
  righe: RigaStima[]
  totale: number
  /**
   * Dove va lo sconto famiglia, se c'è: sull'annuale di questa persona
   * (`qui`), o su quello di un altro del nucleo, che costa meno.
   */
  sconto?: { qui: boolean; chi: string; corso: string; importo: number }
  /** I corsi che il listino non conosce: li conta la segreteria. */
  senzaPrezzo: string[]
}

/**
 * Quanto costa iscrivere una persona in più: la quota, e ogni corso con la
 * formula scelta (l'annuale a saldo se si è ancora in tempo). Con `altri`,
 * gli annuali che il nucleo paga già, lo sconto famiglia va sull'annuale che
 * costa meno fra tutti: se è uno di questa persona si toglie dal totale.
 */
export function stimaIscrizione(
  nuovo: { chi: string; corsi: Array<string | CorsoRef>; formula: Formula },
  altri: Abbonamento[],
  giorno: string,
  listino: Listino,
): Stima {
  const quota = voceQuota(listino).voce(giorno)
  const righe: RigaStima[] = [{ testo: 'Quota associativa', importo: quota.prezzo }]
  const suoi: Abbonamento[] = []
  const senzaPrezzo: string[] = []
  for (const corso of nuovo.corsi) {
    const voci = vociDelCorso(corso, giorno, listino)
    const vuole = nuovo.formula === 'annuale' ? ['~saldo', '~annuale'] : ['~trimestre']
    const v = vuole.map((s) => voci.find((x) => x.chiave.endsWith(s))).find(Boolean)
    const nome = typeof corso === 'string' ? corso : corso.nome
    if (!v) {
      senzaPrezzo.push(nome)
      continue
    }
    const x = v.voce(giorno)
    righe.push({ testo: x.descrizione, importo: x.prezzo * x.quantita })
    if (nuovo.formula === 'annuale') suoi.push({ chi: nuovo.chi, corso: nome, importo: x.prezzo * x.quantita })
  }
  // Lo sconto è della famiglia: servono almeno due annuali nel nucleo.
  let sconto: Stima['sconto']
  const minimo = doveVaLoSconto(suoi, altri)
  if (minimo) {
    const qui = suoi.includes(minimo)
    const importo = importoSconto(minimo.importo)
    sconto = { qui, chi: minimo.chi, corso: minimo.corso, importo }
    if (qui) righe.push({ testo: `Sconto famiglia: ${Math.round(SCONTO_FAMIGLIA * 100)}% su annuale ${minimo.corso}`, importo: -importo })
  }
  return { righe, totale: righe.reduce((s, r) => s + r.importo, 0), sconto, senzaPrezzo }
}

/** Una persona per le regole del nucleo: chi è, se è attiva, e di quale nucleo fa parte. */
type InNucleo = { id: string; attiva: boolean; nucleo?: string }

/**
 * Perché `personaId` non può entrare nel nucleo di `titolareId`, o `null` se
 * può. Il nucleo è uno solo, di un titolare che non è nel nucleo di nessuno:
 * chi ha già un nucleo suo, con altri dentro, non entra in un altro.
 */
export function cosaNonVaNucleo(persone: InNucleo[], personaId: string, titolareId: string): string | null {
  const p = persone.find((x) => x.id === personaId)
  const t = persone.find((x) => x.id === titolareId)
  if (!p || !t) return 'Persona inesistente'
  if (p.id === t.id) return 'Una persona non entra nel suo stesso nucleo'
  if (!p.attiva || !t.attiva) return 'Le schede disattivate non entrano in un nucleo'
  if (t.nucleo) return 'È già nel nucleo di un altro: scegli il titolare'
  if (p.nucleo === t.id) return 'È già in questo nucleo'
  if (p.nucleo) return 'È già nel nucleo di un altro: prima toglilo da lì'
  if (persone.some((x) => x.nucleo === p.id)) return 'Ha un nucleo suo, con altri dentro: prima toglili, o fai titolare un altro'
  return null
}

/**
 * Il nucleo dopo che `personaId` ne diventa titolare: lei esce dal nucleo,
 * e il titolare di prima e gli altri passano a lei. Torna i nuovi `nucleo`
 * per id, `null` per chi non ne ha più; o un errore detto.
 */
export function nuovoTitolare(persone: InNucleo[], personaId: string): Map<string, string | null> | string {
  const p = persone.find((x) => x.id === personaId)
  if (!p?.nucleo) return 'Non è nel nucleo di nessuno'
  const vecchio = p.nucleo
  const m = new Map<string, string | null>([[personaId, null], [vecchio, personaId]])
  for (const x of persone) if (x.nucleo === vecchio && x.id !== personaId) m.set(x.id, personaId)
  return m
}

/** La causale del bonifico per una persona: si ritrova in segreteria senza chiedere. */
export const causale = (nome: string, cognome: string, corsi: string[]) =>
  `Iscrizione ${nome} ${cognome}${corsi.length ? ` · ${corsi.join(', ')}` : ''}`.trim()
