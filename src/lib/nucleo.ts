import type { Formula } from './richieste'
import type { Ricevuta } from './ricevute'
import { voceQuota, vociDelCorso } from './ricevute'
import type { Listino } from './listino'

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
 */

/** Lo sconto famiglia, sull'annuale col costo minore. */
export const SCONTO_FAMIGLIA = 0.2

/** Un abbonamento annuale del nucleo: di chi, quale, quanto (in centesimi). */
export interface Abbonamento {
  chi: string
  corso: string
  importo: number
}

/**
 * Gli annuali già pagati dal nucleo, dalle ricevute non annullate: le voci
 * «Annuale …» (vedi `vociDelCorso` in `ricevute.ts`). `chi` è il nome da mostrare, per id.
 */
export function abbonamentiDalleRicevute(ricevute: Ricevuta[], chi: (personaId: string) => string): Abbonamento[] {
  return ricevute
    .filter((r) => !r.annullataIl && r.personaId)
    .flatMap((r) =>
      r.voci
        .filter((v) => /^annuale /i.test(v.descrizione))
        .map((v) => ({ chi: chi(r.personaId!), corso: v.descrizione.replace(/^annuale /i, ''), importo: v.prezzo * v.quantita })),
    )
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
  nuovo: { chi: string; corsi: string[]; formula: Formula },
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
    if (!v) {
      senzaPrezzo.push(corso)
      continue
    }
    const x = v.voce(giorno)
    righe.push({ testo: x.descrizione, importo: x.prezzo * x.quantita })
    if (nuovo.formula === 'annuale') suoi.push({ chi: nuovo.chi, corso, importo: x.prezzo * x.quantita })
  }
  // Lo sconto è della famiglia: servono almeno due annuali nel nucleo. A
  // pari prezzo va sulla persona nuova: gli altri hanno già pagato.
  const tutti = [...suoi, ...altri]
  let sconto: Stima['sconto']
  if (tutti.length >= 2) {
    const minimo = tutti.reduce((x, y) => (y.importo < x.importo ? y : x))
    const qui = suoi.includes(minimo)
    const importo = Math.round(minimo.importo * SCONTO_FAMIGLIA)
    sconto = { qui, chi: minimo.chi, corso: minimo.corso, importo }
    if (qui) righe.push({ testo: `Sconto famiglia: 20% su annuale ${minimo.corso}`, importo: -importo })
  }
  return { righe, totale: righe.reduce((s, r) => s + r.importo, 0), sconto, senzaPrezzo }
}

/** La causale del bonifico per una persona: si ritrova in segreteria senza chiedere. */
export const causale = (nome: string, cognome: string, corsi: string[]) =>
  `Iscrizione ${nome} ${cognome}${corsi.length ? ` · ${corsi.join(', ')}` : ''}`.trim()
