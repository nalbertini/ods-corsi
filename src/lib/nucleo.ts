import type { Formula } from './richieste'
import type { Anagrafica } from './segreteria'
import { minorenne } from './richieste'
import type { Ricevuta } from './ricevute'
import { centesimi, euro, voceQuota, vociDelCorso } from './ricevute'
import { PIU_CORSI, stagioneDi } from './costi'
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
 * Qui ci sono anche i conti di quanto costa una persona in più, con le
 * offerte del listino: PIÙ CORSI, gli annuali di una persona costano in tutto
 * al massimo `PIU_CORSI` (la quota a parte); e lo sconto famiglia, fra persone
 * diverse: l'annuale col costo minore del nucleo ha il 20% di sconto, la
 * quota associativa no. Chi ha più corsi conta come un annuale solo. Gli annuali già pagati si leggono
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
 * Gli annuali già pagati dal nucleo per la stagione dei corsi di `giorno`,
 * dalle ricevute non annullate: le voci «Annuale …» (vedi `vociDelCorso` in
 * `ricevute.ts`), col prezzo pieno anche quelle scontate. La stagione è quella
 * della voce (`dal`), o della ricevuta se la voce non la dice: un annuale
 * dell'anno prima non dà né toglie lo sconto. `chi` è il nome da mostrare, per id.
 */
export function abbonamentiDalleRicevute(ricevute: Ricevuta[], chi: (personaId: string) => string, giorno: string): Abbonamento[] {
  const stagione = stagioneDi(giorno).corsi.dal
  return ricevute
    .filter((r) => !r.annullataIl && r.personaId)
    .flatMap((r) =>
      r.voci
        .filter((v) => /^annuale /i.test(v.descrizione) && stagioneDi(v.dal ?? r.data).corsi.dal === stagione)
        .map((v): Abbonamento => {
          const s = scontoDellaVoce(v.descrizione)
          const corso = (s?.descrizione ?? v.descrizione).replace(/^annuale /i, '')
          return s ? { chi: chi(r.personaId!), corso, importo: s.pieno * v.quantita, scontato: true } : { chi: chi(r.personaId!), corso, importo: v.prezzo * v.quantita }
        }),
    )
}

/**
 * Gli annuali di una persona come uno solo, per l'offerta PIÙ CORSI: i corsi
 * insieme, la somma fino a `PIU_CORSI`. Con un annuale solo torna quello.
 */
export function piuCorsi<A extends Abbonamento>(suoi: A[]): A | Abbonamento {
  if (suoi.length === 1) return suoi[0]
  const somma = suoi.reduce((s, a) => s + a.importo, 0)
  return { chi: suoi[0].chi, corso: suoi.map((a) => a.corso).join(', '), importo: Math.min(somma, PIU_CORSI * 100) }
}

/**
 * Su quale annuale va lo sconto famiglia: su quello che l'ha già avuto, se
 * c'è; se no, con almeno due persone, su quello che costa meno. Chi ha più
 * annuali conta come uno (vedi `piuCorsi`). A pari prezzo vince il primo dei
 * `suoi`, quelli da pagare adesso: gli altri hanno già pagato. `null` se lo
 * sconto non c'è.
 */
export function doveVaLoSconto<A extends Abbonamento>(suoi: A[], altri: Abbonamento[]): A | Abbonamento | null {
  const tutti: Abbonamento[] = [...suoi, ...altri]
  const gia = tutti.find((a) => a.scontato)
  if (gia) return gia
  const persone = [...new Set(tutti.map((a) => a.chi))].map((chi) => piuCorsi(tutti.filter((a) => a.chi === chi)))
  if (persone.length < 2) return null
  return persone.reduce((x, y) => (y.importo < x.importo ? y : x))
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
  // PIÙ CORSI: i suoi annuali insieme non passano il tetto.
  const tutto = suoi.length ? piuCorsi(suoi) : null
  const oltre = suoi.reduce((s, a) => s + a.importo, 0) - (tutto?.importo ?? 0)
  if (oltre > 0) righe.push({ testo: `Più corsi: in tutto ${PIU_CORSI} €`, importo: -oltre })
  // Lo sconto è della famiglia: servono almeno due persone con un annuale nel nucleo.
  let sconto: Stima['sconto']
  const minimo = doveVaLoSconto(tutto ? [tutto] : [], altri)
  if (minimo) {
    const qui = minimo === tutto
    const importo = importoSconto(minimo.importo)
    sconto = { qui, chi: minimo.chi, corso: minimo.corso, importo }
    if (qui) righe.push({ testo: `Sconto famiglia: ${Math.round(SCONTO_FAMIGLIA * 100)}% su annuale ${minimo.corso}`, importo: -importo })
  }
  return { righe, totale: righe.reduce((s, r) => s + r.importo, 0), sconto, senzaPrezzo }
}

/** Una persona per le regole del nucleo: chi è, se è attiva, di quale nucleo fa parte e quando è nata. */
type InNucleo = { id: string; attiva: boolean; nucleo?: string; natoIl?: string; genitoreNonIscritto?: boolean }

export const TITOLARE_MINORENNE = 'Il titolare deve essere maggiorenne: scegli un adulto'

/** Senza data di nascita il titolare passa: la segreteria non sa, e non si blocca per questo. */
const nonAdulto = (p: InNucleo) => !!p.natoIl && minorenne(p.natoIl)

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
  if (nonAdulto(t)) return TITOLARE_MINORENNE
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
  if (nonAdulto(p)) return TITOLARE_MINORENNE
  const vecchio = p.nucleo
  const m = new Map<string, string | null>([[personaId, null], [vecchio, personaId]])
  for (const x of persone) if (x.nucleo === vecchio && x.id !== personaId) m.set(x.id, personaId)
  return m
}

export const GENITORE_SENZA_CF = 'Per aggiungere il genitore serve il suo codice fiscale'
export const GENITORE_GIA_IN_ELENCO = 'C’è già una persona con questo codice fiscale: mettilo nel suo nucleo'
export const GENITORE_SENZA_NOME = 'Scrivi nome e cognome del genitore'

/** I dati di una persona che servono per il suo genitore: il blocco GENITORE e il suo codice fiscale. */
export type DatiGenitore = Pick<Anagrafica, 'genitoreNome' | 'genitoreCognome' | 'genitoreCodiceFiscale' | 'codiceFiscale'>

/** Il codice fiscale come lo scrive il database: maiuscolo, senza spazi; `null` se non sono 16 lettere e cifre. */
export function codicePulito(cf: string | undefined): string | null {
  const c = (cf ?? '').replace(/\s/g, '').toUpperCase()
  return /^[A-Z0-9]{16}$/.test(c) ? c : null
}

/** Cosa propone la scheda di un minorenne senza nucleo: il genitore nuovo, quello che c'è già, o il codice che manca. */
export type PropostaGenitore =
  | { tipo: 'nuovo'; nome: string; cognome: string; codiceFiscale: string }
  | { tipo: 'iscritto' | 'gia-in-elenco'; titolare: string }
  | { tipo: 'manca-cf'; sbagliato?: true }

/**
 * Il genitore da mettere titolare del nucleo di un minorenne che non ne ha
 * uno: `null` per un adulto, per chi non ha la data di nascita o è già in un
 * nucleo. Il genitore si riconosce dal codice fiscale: se è già di un'altra
 * persona si usa lei, senza doppioni (`aggiungi_genitore` fa la stessa prova).
 */
export function propostaGenitore(persone: InNucleo[], personaId: string, dati: Map<string, DatiGenitore>, oggi: string): PropostaGenitore | null {
  const p = persone.find((x) => x.id === personaId)
  if (!p?.natoIl || !minorenne(p.natoIl, new Date(`${oggi}T12:00:00`))) return null
  if (p.nucleo || persone.some((x) => x.nucleo === p.id)) return null
  const suoi = dati.get(personaId)
  const scritto = suoi?.genitoreCodiceFiscale?.trim()
  const cf = codicePulito(scritto)
  // Il codice del figlio stesso è sbagliato quanto uno corto: `aggiungi_genitore` lo rifiuta.
  if (!cf || cf === codicePulito(suoi?.codiceFiscale)) return scritto ? { tipo: 'manca-cf', sbagliato: true } : { tipo: 'manca-cf' }
  const chi = persone.find((x) => x.id !== personaId && codicePulito(dati.get(x.id)?.codiceFiscale) === cf)
  if (chi) return { tipo: chi.genitoreNonIscritto ? 'gia-in-elenco' : 'iscritto', titolare: chi.id }
  return { tipo: 'nuovo', nome: suoi?.genitoreNome?.trim() ?? '', cognome: suoi?.genitoreCognome?.trim() ?? '', codiceFiscale: cf }
}

/**
 * I fratelli già in un nucleo: le persone attive con lo stesso codice fiscale
 * del genitore, nel nucleo di qualcuno che non è quello dove sta già lei.
 */
export function fratelliDi(persone: InNucleo[], personaId: string, dati: Map<string, DatiGenitore>): Array<{ personaId: string; titolare: string }> {
  const p = persone.find((x) => x.id === personaId)
  return p ? fratelliPerGenitore(persone, dati.get(personaId)?.genitoreCodiceFiscale, dati, p) : []
}

/**
 * I fratelli da proporre nella scheda: uno per nucleo, non quello già
 * proposto come genitore, e solo dove le regole del nucleo la fanno entrare.
 */
export function fratelliDaProporre(
  persone: InNucleo[],
  personaId: string,
  dati: Map<string, DatiGenitore>,
  proposta: PropostaGenitore | null,
): Array<{ personaId: string; titolare: string }> {
  const giaProposto = proposta && 'titolare' in proposta ? proposta.titolare : null
  return fratelliDi(persone, personaId, dati).filter(
    (f, i, tutti) => tutti.findIndex((y) => y.titolare === f.titolare) === i && f.titolare !== giaProposto && !cosaNonVaNucleo(persone, personaId, f.titolare),
  )
}

/** I fratelli dal codice fiscale del genitore: anche per una richiesta che non è ancora una persona. */
export function fratelliPerGenitore(
  persone: InNucleo[],
  codiceGenitore: string | undefined,
  dati: Map<string, DatiGenitore>,
  esclusa?: Pick<InNucleo, 'id' | 'nucleo'>,
): Array<{ personaId: string; titolare: string }> {
  const cf = codicePulito(codiceGenitore)
  if (!cf) return []
  return persone
    .filter((x) => x.id !== esclusa?.id && x.attiva && x.nucleo && x.nucleo !== esclusa?.nucleo && codicePulito(dati.get(x.id)?.genitoreCodiceFiscale) === cf)
    .map((x) => ({ personaId: x.id, titolare: x.nucleo! }))
}

/**
 * Da quando è maggiorenne chi sta nel nucleo di un genitore non iscritto:
 * ora può fare da titolare, e la segreteria lo deve sapere. `null` se è
 * ancora minorenne o il titolare è un iscritto vero.
 */
export function maggiorenneDal(persone: InNucleo[], personaId: string, oggi: string): string | null {
  const p = persone.find((x) => x.id === personaId)
  if (!p?.natoIl || !p.nucleo || !persone.find((x) => x.id === p.nucleo)?.genitoreNonIscritto) return null
  const [a, m, g] = p.natoIl.split('-').map(Number)
  if (!a || !m || !g) return null
  // Come `minorenne`: chi è nato il 29 febbraio, in un anno non bisestile compie gli anni il 1 marzo.
  const dal = new Date(Date.UTC(a + 18, m - 1, g)).toISOString().slice(0, 10)
  return dal <= oggi ? dal : null
}

/** La causale del bonifico per una persona: si ritrova in segreteria senza chiedere. */
export const causale = (nome: string, cognome: string, corsi: string[]) =>
  `Iscrizione ${nome} ${cognome}${corsi.length ? ` · ${corsi.join(', ')}` : ''}`.trim()
