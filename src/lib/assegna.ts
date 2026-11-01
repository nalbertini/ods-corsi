// Un'entrata collegata a una persona (il bonifico) si assegna a quota e corsi, anche dei fratelli del nucleo, come saldo
// o parziale: ogni pezzo è una riga di PAGAMENTI col `movimentoId` del movimento. Dal movimento si fa poi la ricevuta,
// una per persona. In CONTABILITÀ quei soldi restano una volta sola, nel movimento: `incassiDerivati` salta le righe
// col movimento. Le stesse regole sono in `supabase/135-assegna-movimento.sql` e `136-assegna-una-volta.sql`, e per la modalità prova in
// `segreteriaProva.ts`.
import { NOME_CASSA_CONTANTI, VOCE_CORSI, VOCE_QUOTA, type Cassa, type MovimentoManuale, type VoceContabile } from './contabilita'
import type { PagamentoDiretto } from './pagamenti'
import type { VoceStorico } from './movimentiPersona'
import { QUOTA, vociDelCorso, vociPronte, type QuotaRicevuta, type Ricevuta, type VoceRicevuta } from './ricevute'
import { statoCorsi, type VoceCorso } from './corsiDaPagare'
import { stagioneDi } from './costi'
import type { CorsoRef, Listino } from './listino'
import { pagamentoDi, type PersonaSeg } from './segreteria'

/**
 * I soldi sempre con i centesimi, come nel canvas: «50,00 €». Il punto delle migliaia anche a quattro cifre
 * («1.234,50 €»), come `euro_assegna` del database: in italiano `toLocaleString` lo mette solo da cinque.
 */
export function euroAssegna(cent: number): string {
  // A mano e non con `useGrouping: 'always'`: i tipi di ES2022 non lo conoscono.
  const segno = cent < 0 ? '-' : ''
  const tutto = Math.round(Math.abs(cent))
  const interi = String(Math.floor(tutto / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${segno}${interi},${String(tutto % 100).padStart(2, '0')} €`
}

/** Una cosa ancora da pagare, nel dialogo ASSEGNA IL BONIFICO. `manca` in centesimi. */
export interface VoceDovuta {
  personaId: string
  voce: string
  tipo: 'quota' | 'corso'
  dal: string
  manca: number
}

/** Un pezzo del bonifico: a chi, su che voce, quanto. */
export interface RigaAssegnata {
  personaId: string
  voce: string
  importo: number
}

/** Un'assegnazione diventa ricevuta solo dal movimento (il trigger `assegnazione_solo_dal_movimento`, 135). */
export const SOLO_DAL_MOVIMENTO = 'Questi soldi vengono da un bonifico: la ricevuta si fa dal movimento, in CONTABILITÀ.'

const delMovimento = (movimentoId: string) => (x: { movimentoId?: string }) => x.movimentoId === movimentoId

/** Quel che del movimento è già assegnato: le righe attive col movimento, più il pagato delle sue ricevute non annullate. */
export function assegnato(movimentoId: string, diretti: PagamentoDiretto[], ricevute: Ricevuta[]): number {
  const righe = diretti.filter(delMovimento(movimentoId)).filter((d) => !d.annullatoIl).reduce((s, d) => s + d.importo, 0)
  const inRicevuta = ricevute.filter(delMovimento(movimentoId)).filter((r) => !r.annullataIl).reduce((s, r) => s + r.pagato, 0)
  return righe + inRicevuta
}

/** Le parole del trigger `movimento_assegnato_resta` (135) quando si cambia chi o cosa a un movimento con soldi assegnati. */
export const MOVIMENTO_ASSEGNATO = 'Il movimento ha dei soldi assegnati: annulla prima ricevute e assegnazioni.'

/**
 * Persona o voce di questi movimenti non si cambiano se uno ha soldi assegnati: le assegnazioni e le ricevute
 * resterebbero di qualcun altro, o su un'entrata che non è più un incasso della palestra. Tutto o niente.
 */
export const cosaNonVaCambioMovimento = (ids: string[], diretti: PagamentoDiretto[], ricevute: Ricevuta[]): string | undefined =>
  ids.some((id) => assegnato(id, diretti, ricevute) > 0) ? MOVIMENTO_ASSEGNATO : undefined

/**
 * Un'importazione si annulla solo se nessun suo movimento ha una ricevuta attiva: la ricevuta direbbe soldi che
 * nell'elenco non ci sono più. Si nomina la prima, come il database.
 */
export function cosaNonVaAnnullaLotto(ids: string[], ricevute: Ricevuta[]): string | undefined {
  const dentro = new Set(ids)
  const prima = ricevute
    .filter((r) => !!r.movimentoId && dentro.has(r.movimentoId) && !r.annullataIl)
    .sort((x, y) => x.anno - y.anno || x.numero - y.numero)[0]
  return prima ? `Annulla prima la ricevuta n. ${prima.numero}/${prima.anno}` : undefined
}

/**
 * Quanto del movimento non è ancora assegnato. Un'assegnazione diventata ricevuta è annullata e i suoi soldi sono nel
 * pagato della ricevuta: si contano una volta. Mai sotto zero, anche se i dati non tornano.
 */
export const daAssegnare = (m: Pick<MovimentoManuale, 'id' | 'importo'>, diretti: PagamentoDiretto[], ricevute: Ricevuta[]): number =>
  Math.max(0, m.importo - assegnato(m.id, diretti, ricevute))

/** Prima le quote, poi i corsi dal più vecchio; a pari data l'ordine in cui arrivano. Nessuna riga a zero. */
export function proponiRipartizione(importo: number, dovuti: VoceDovuta[]): { righe: RigaAssegnata[]; daAssegnare: number } {
  const ordinati = dovuti
    .map((d, i) => ({ d, i }))
    .sort((a, b) => Number(a.d.tipo !== 'quota') - Number(b.d.tipo !== 'quota') || a.d.dal.localeCompare(b.d.dal) || a.i - b.i)
  let resta = importo
  const righe: RigaAssegnata[] = []
  for (const { d } of ordinati) {
    const quanto = Math.min(resta, d.manca)
    if (quanto <= 0) continue
    righe.push({ personaId: d.personaId, voce: d.voce, importo: quanto })
    resta -= quanto
  }
  return { righe, daAssegnare: resta }
}

const stessa = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

/** Perché le righe non si scrivono, o null. `importo` è quel che del bonifico resta da assegnare. */
export function cosaNonVaAssegnazione(righe: RigaAssegnata[], importo: number, dovuti: VoceDovuta[]): string | null {
  if (!righe.length) return 'Metti almeno un importo su una voce.'
  if (righe.some((r) => !(r.importo > 0))) return 'Metti su ogni voce un importo maggiore di zero.'
  if (righe.some((r) => !r.voce.trim())) return 'Scrivi a cosa serve ogni importo.'
  for (const d of dovuti) {
    const messo = righe.filter((r) => r.personaId === d.personaId && stessa(r.voce, d.voce)).reduce((s, r) => s + r.importo, 0)
    if (messo > d.manca) {
      const chi = d.tipo === 'quota' ? 'Alla quota' : `A «${d.voce}»`
      return `${chi} mancano ${euroAssegna(d.manca)}: metti ${euroAssegna(d.manca)} o meno, il resto rimane da assegnare.`
    }
  }
  const totale = righe.reduce((s, r) => s + r.importo, 0)
  if (totale > importo) return `Hai assegnato ${euroAssegna(totale - importo)} più del bonifico: togli da una voce.`
  return null
}

/**
 * Il tetto della quota (136-assegna-una-volta.sql), o null: per persona e stagione, le righe nuove sulla quota più
 * quel che la quota ha già (assegnazioni attive e pagato delle ricevute attive) non passano `tetto`, il prezzo della
 * quota nel listino in centesimi; senza tetto, nessun limite. Le assegnazioni diventate ricevuta sono annullate e
 * contano tramite la ricevuta, una volta sola. La stagione è quella del nome della voce, se no della data: `data` del
 * movimento per le righe nuove, del pagamento, il `dal` della voce della ricevuta o la sua data. Il tetto dei corsi è
 * in `cosaNonVaAssegnazione`.
 */
export function cosaNonVaQuota(righe: RigaAssegnata[], data: string, diretti: PagamentoDiretto[], ricevute: Ricevuta[], tetto?: number): string | null {
  if (!tetto || tetto <= 0) return null
  const gruppi = new Map<string, { personaId: string; stagione: number; nuovo: number }>()
  for (const r of righe.filter((x) => eQuota(x.voce))) {
    const stagione = annoQuota(r.voce, data)
    const g = gruppi.get(`${r.personaId}|${stagione}`) ?? { personaId: r.personaId, stagione, nuovo: 0 }
    g.nuovo += r.importo
    gruppi.set(`${r.personaId}|${stagione}`, g)
  }
  for (const g of gruppi.values()) {
    const assegnati = diretti
      .filter((d) => !d.annullatoIl && d.personaId === g.personaId && eQuota(d.voce) && annoQuota(d.voce, d.data) === g.stagione)
      .reduce((s, d) => s + d.importo, 0)
    const inRicevuta = ricevute
      .filter((r) => !r.annullataIl && r.personaId === g.personaId)
      .flatMap((r) => r.voci.filter((v) => eQuota(v.descrizione) && annoQuota(v.descrizione, v.dal || r.data) === g.stagione))
      .reduce((s, v) => s + v.pagamenti.reduce((t, p) => t + p.importo, 0), 0)
    const gia = assegnati + inRicevuta
    if (gia + g.nuovo > tetto) {
      const manca = euroAssegna(Math.max(0, tetto - gia))
      return `Alla quota mancano ${manca}: metti ${manca} o meno, il resto rimane da assegnare.`
    }
  }
  return null
}

/**
 * Perché il movimento non si assegna, o null: solo le entrate collegate su quota e corsi, e non i contanti (entrano già da
 * PAGAMENTI). Lo storico del vecchio programma solo dalla stagione di `oggi` (dal 1° agosto, come
 * `71-pagato-vecchio-programma.sql`): quello delle stagioni passate non ha niente da pagare a cui andare.
 */
export function cosaNonVaMovimentoDaAssegnare(
  m: Pick<MovimentoManuale, 'tipo' | 'voceId' | 'cassaId' | 'personaId' | 'annullatoIl' | 'data' | 'origineImport'>,
  casse: Cassa[],
  voci: VoceContabile[],
  oggi: string,
): string | null {
  if (m.annullatoIl) return 'Il movimento è annullato: non si assegna.'
  if (m.tipo !== 'entrata') return 'Un’uscita non si assegna: si assegnano solo le entrate.'
  if (!m.personaId) return 'Collega prima il movimento a una persona.'
  const voce = voci.find((v) => v.id === m.voceId)?.nome
  if (voce !== VOCE_QUOTA && voce !== VOCE_CORSI) return `Si assegnano solo le entrate su «${VOCE_QUOTA}» e «${VOCE_CORSI}».`
  if (casse.find((c) => c.id === m.cassaId)?.nome === NOME_CASSA_CONTANTI) return 'I contanti non si assegnano da qui: registra il pagamento in PAGAMENTI.'
  if (m.origineImport?.startsWith('prima-nota:') && m.data < stagioneDi(oggi).dal) return 'Questo bonifico è del vecchio programma, di una stagione passata: resta nello storico, non si assegna.'
  return null
}

/** A chi si può assegnare il bonifico di `id`: il titolare del nucleo e le persone attive del suo nucleo. */
export function personeDelNucleo(id: string, persone: Array<{ id: string; nucleo?: string; attiva: boolean }>): string[] {
  const titolare = persone.find((p) => p.id === id)?.nucleo ?? id
  return [titolare, ...persone.filter((p) => p.attiva && p.nucleo === titolare && p.id !== titolare).map((p) => p.id)]
}

const GIORNO = 86_400_000
const giorni = (a: string, b: string) => Math.abs(Date.parse(`${a}T12:00:00Z`) - Date.parse(`${b}T12:00:00Z`)) / GIORNO

/** Una ricevuta fatta prima a parte si abbina a un bonifico entro tanti giorni. */
export const GIORNI_ABBINAMENTO = 30

/** Perché la ricevuta non è quella del bonifico, o null. I controlli sul movimento li fa `cosaNonVaMovimentoDaAssegnare`. */
export function cosaNonVaAbbinamento(m: { id: string; importo: number; data: string; personaId?: string }, r: Ricevuta): string | null {
  if (r.annullataIl) return 'La ricevuta è annullata.'
  if (r.movimentoId && r.movimentoId !== m.id) return `La ricevuta n. ${r.numero}/${r.anno} è già abbinata a un altro bonifico.`
  if (r.personaId !== m.personaId) return 'La ricevuta è di un’altra persona.'
  if (r.pagato !== m.importo) return 'La ricevuta e il bonifico non hanno lo stesso importo.'
  const pagamenti = r.voci.flatMap((v) => v.pagamenti)
  if (!pagamenti.length || pagamenti.some((p) => !stessa(p.metodo, 'Bonifico'))) return 'La ricevuta non è tutta pagata con bonifico.'
  if (giorni(r.data, m.data) > GIORNI_ABBINAMENTO) return `La ricevuta e il bonifico distano più di ${GIORNI_ABBINAMENTO} giorni.`
  return null
}

/**
 * «Collegati prima»: per i bonifici collegati prima di questo cambio, la ricevuta già fatta a parte che è la sua.
 * Una ricevuta va a un solo bonifico, il più vicino di data; un bonifico prende una ricevuta sola.
 */
export function abbinamentiProposti(
  movimenti: Array<{ id: string; importo: number; data: string; personaId?: string }>,
  ricevute: Ricevuta[],
): Array<{ movimentoId: string; ricevutaId: string }> {
  const coppie = movimenti
    .flatMap((m) => ricevute.filter((r) => !r.movimentoId && cosaNonVaAbbinamento(m, r) === null).map((r) => ({ m, r, d: giorni(r.data, m.data) })))
    .sort((a, b) => a.d - b.d || a.m.data.localeCompare(b.m.data) || a.r.numero - b.r.numero)
  const presiM = new Set<string>()
  const presiR = new Set<string>()
  const fuori: Array<{ movimentoId: string; ricevutaId: string }> = []
  for (const { m, r } of coppie) {
    if (presiM.has(m.id) || presiR.has(r.id)) continue
    presiM.add(m.id)
    presiR.add(r.id)
    fuori.push({ movimentoId: m.id, ricevutaId: r.id })
  }
  return fuori
}

/** Le entrate che hanno ancora soldi da assegnare, dalla più vecchia, e quanto fanno in tutto. */
export function elencoDaAssegnare(manuali: MovimentoManuale[], diretti: PagamentoDiretto[], ricevute: Ricevuta[], casse: Cassa[], voci: VoceContabile[], oggi: string) {
  const righe = manuali
    .filter((m) => cosaNonVaMovimentoDaAssegnare(m, casse, voci, oggi) === null)
    // `as string`: il filtro qui sopra lascia solo i movimenti collegati, ma TypeScript non lo sa.
    .map((m) => ({ movimentoId: m.id, personaId: m.personaId as string, data: m.data, importo: m.importo, daAssegnare: daAssegnare(m, diretti, ricevute) }))
    .filter((r) => r.daAssegnare > 0)
    .sort((a, b) => a.data.localeCompare(b.data) || a.movimentoId.localeCompare(b.movimentoId))
  return { righe, totale: righe.reduce((s, r) => s + r.daAssegnare, 0) }
}

const assegnazioniDi = (diretti: PagamentoDiretto[], personaId: string) => diretti.filter((d) => d.movimentoId && !d.annullatoIl && d.personaId === personaId)
const eQuota = (voce: string) => voce.trim().toLowerCase().startsWith(VOCE_QUOTA.toLowerCase())
/** «2026/27»: la stagione nel nome della voce, come la scrive il dialogo. */
export const nomeStagione = (dal: string) => {
  const anno = Number(dal.slice(0, 4))
  return `${anno}/${String((anno + 1) % 100).padStart(2, '0')}`
}

/**
 * Le quote della persona con le assegnazioni dentro: i soldi assegnati alla quota della stagione (detta nel nome
 * della voce, se no dalla data) fanno una quota in più, pagata o in parte. Senza assegnazioni, le quote di prima.
 */
export function quoteConAssegnazioni(quote: QuotaRicevuta[], quota: { prezzo: number; dal: string; al: string }, diretti: PagamentoDiretto[], personaId: string): QuotaRicevuta[] {
  const stagione = nomeStagione(quota.dal)
  const sue = assegnazioniDi(diretti, personaId).filter((d) => {
    if (!eQuota(d.voce)) return false
    const detta = d.voce.match(/\d{4}\/\d{2}/)?.[0]
    return detta ? detta === stagione : d.data >= quota.dal && d.data <= quota.al
  })
  if (!sue.length) return quote
  const messo = sue.reduce((s, d) => s + d.importo, 0)
  // Si parte da quel che manca ancora dopo le ricevute della stessa stagione (un acconto già in ricevuta), se no dal
  // prezzo: un saldo assegnato dopo un acconto chiude la quota. Le assegnazioni attive non sono mai in una ricevuta.
  const prima = quote.filter((q) => !!q.dal && q.dal <= quota.al && (q.al ?? '9999-12-31') >= quota.dal).map((q) => q.mancano)
  const base = prima.length ? Math.min(...prima) : quota.prezzo
  // Numero 0: non c'è una ricevuta, ci sono i bonifici. La scheda lo dice così.
  return [...quote, { anno: Number(quota.dal.slice(0, 4)), numero: 0, dal: quota.dal, al: quota.al, mancano: Math.max(0, base - messo) }]
}

/** Due periodi si toccano. Senza le date del prezzo vale la sola descrizione; una voce senza date non si sa di quando sia. */
const stessoPeriodo = (v: { dal?: string; al?: string }, p: { dal?: string; al?: string }) =>
  !p.dal || (!!v.dal && v.dal <= (p.al ?? '9999-12-31') && (v.al ?? '9999-12-31') >= p.dal)

/** Come `quoteConAssegnazioni`, per le voci dei corsi: una voce per prezzo del listino che ha soldi assegnati. */
export function vociCorsiConAssegnazioni(
  voci: VoceCorso[],
  prezzi: Array<{ descrizione: string; prezzo: number; dal?: string; al?: string }>,
  diretti: PagamentoDiretto[],
  personaId: string,
): VoceCorso[] {
  const sue = assegnazioniDi(diretti, personaId).filter((d) => !eQuota(d.voce))
  const fatte = new Set<string>()
  const nuove: VoceCorso[] = []
  for (const p of prezzi) {
    const chiave = p.descrizione.trim().toLowerCase()
    if (chiave === QUOTA.toLowerCase() || fatte.has(chiave)) continue
    const sulla = sue.filter((d) => stessa(d.voce, p.descrizione))
    if (!sulla.length) continue
    fatte.add(chiave)
    const messo = sulla.reduce((s, d) => s + d.importo, 0)
    const data = sulla.map((d) => d.data).sort()[0]
    // Come per la quota: dopo un acconto già in ricevuta si parte da quel che manca, se no dal prezzo. Solo le
    // ricevute dello stesso periodo: l'annuale della stagione passata, tutto pagato, non chiude quello di adesso.
    const prima = voci
      .filter((v) => stessa(v.descrizione, p.descrizione) && stessoPeriodo(v, p))
      .map((v) => v.mancano)
    const base = prima.length ? Math.min(...prima) : p.prezzo
    nuove.push({ descrizione: p.descrizione, dal: p.dal, al: p.al, mancano: Math.max(0, base - messo), data })
  }
  return nuove.length ? [...voci, ...nuove] : voci
}

/** I prezzi del listino in quel giorno, come voci di ricevuta (senza la quota): quelli che `vociCorsiConAssegnazioni` cerca. */
export const prezziDelListino = (listino: Listino, giorno: string) =>
  vociPronte([], giorno, listino).map((v) => v.voce(giorno)).filter((v) => v.descrizione !== QUOTA)

/** La quota della stagione di quel giorno, col prezzo del listino. */
export const quotaDelListino = (listino: Listino, giorno: string) => ({ prezzo: Math.round(listino.quota * 100), ...stagioneDi(giorno).quota })

/**
 * Le assegnazioni dentro quota e corsi di una persona: quel che legge la scheda (`pagamentoDi`, `statoCorsi`). I prezzi
 * sono quelli del listino nel giorno della prima assegnazione.
 */
export function conAssegnazioni<P extends Pick<PersonaSeg, 'id' | 'quote' | 'vociCorsi'>>(p: P, diretti: PagamentoDiretto[], listino: Listino, oggi: string): P {
  const sue = assegnazioniDi(diretti, p.id)
  if (!sue.length) return p
  const giorno = sue.map((d) => d.data).sort()[0]
  return {
    ...p,
    quote: quoteConAssegnazioni(p.quote ?? [], quotaDelListino(listino, oggi), diretti, p.id),
    vociCorsi: p.vociCorsi ? vociCorsiConAssegnazioni(p.vociCorsi, prezziDelListino(listino, giorno), diretti, p.id) : p.vociCorsi,
  }
}

/**
 * Le cose ancora da pagare di una persona, per la ripartizione: la quota (intera, o quel che manca) e i corsi in cui è
 * iscritta (l'annuale del listino, o quel che manca di quello che ha).
 */
export function dovutiDi(p: PersonaSeg, corsi: CorsoRef[], listino: Listino, oggi: string): VoceDovuta[] {
  const stagione = stagioneDi(oggi)
  const fuori: VoceDovuta[] = []
  const q = pagamentoDi(p, oggi)
  const quota = Math.round(listino.quota * 100)
  const mancaQuota = q.come === 'pagato' ? 0 : q.come === 'in_parte' && q.mancano !== undefined ? q.mancano : quota
  if (mancaQuota > 0) fuori.push({ personaId: p.id, voce: `${VOCE_QUOTA} ${nomeStagione(stagione.quota.dal)}`, tipo: 'quota', dal: stagione.quota.dal, manca: mancaQuota })
  for (const s of statoCorsi(p, corsi, listino, oggi) ?? []) {
    if (!['in_parte', 'da_pagare', 'scaduto'].includes(s.come)) continue
    const corso = corsi.find((c) => c.id === s.corsoId)
    if (!corso) continue
    const formula = s.come === 'in_parte' ? s.formula : 'annuale'
    const voce = vociDelCorso(corso, oggi, listino).map((v) => v.voce(oggi)).find((v) => v.descrizione.toLowerCase().startsWith(formula ?? 'annuale'))
    if (!voce) continue
    const manca = s.come === 'in_parte' ? (s.mancano ?? 0) : voce.prezzo
    const dal = p.iscrizioni.find((i) => i.corsoId === s.corsoId)?.dal ?? stagione.corsi.dal
    if (manca > 0) fuori.push({ personaId: p.id, voce: voce.descrizione, tipo: 'corso', dal, manca })
  }
  return fuori
}

/** La stagione di una quota assegnata: quella detta nel nome della voce («2026/27»), se no quella del giorno. */
const stagioneQuota = (voce: string, giorno: string) => {
  const detta = voce.match(/(\d{4})\/\d{2}/)?.[1]
  return stagioneDi(detta ? `${detta}-09-01` : giorno).quota
}

/** L'anno in cui comincia la stagione di una quota, come `stagione_quota` del database (136). */
const annoQuota = (voce: string, giorno: string) => Number(stagioneQuota(voce, giorno).dal.slice(0, 4))

/**
 * Le voci della ricevuta fatta dal bonifico, per una persona: una per voce assegnata, pagata col bonifico alla sua
 * data. Il prezzo è quello del listino, così un parziale resta un parziale anche nella ricevuta; una voce che il
 * listino non ha costa quel che è assegnato.
 */
export function vociDaMovimento(sue: PagamentoDiretto[], dataMovimento: string, listino: Listino): VoceRicevuta[] {
  const prezzi = prezziDelListino(listino, dataMovimento)
  const gruppi = new Map<string, { voce: string; importo: number }>()
  for (const d of sue.filter((x) => !x.annullatoIl)) {
    const k = d.voce.trim().toLowerCase()
    const g = gruppi.get(k) ?? { voce: d.voce.trim(), importo: 0 }
    g.importo += d.importo
    gruppi.set(k, g)
  }
  return [...gruppi.values()].map(({ voce, importo }) => {
    const pagamenti = [{ data: dataMovimento, importo, metodo: 'Bonifico' }]
    if (eQuota(voce)) return { descrizione: QUOTA, quantita: 1, prezzo: Math.max(importo, Math.round(listino.quota * 100)), ...stagioneQuota(voce, dataMovimento), pagamenti }
    const p = prezzi.find((x) => stessa(x.descrizione, voce))
    return { descrizione: voce, quantita: 1, prezzo: Math.max(importo, p?.prezzo ?? importo), dal: p?.dal, al: p?.al, pagamenti }
  })
}

/**
 * Lo stesso rifiuto di `emetti_ricevuta_da_movimento` (135): nella ricevuta il bonifico entra così com'è, tutto
 * Bonifico, alla data del movimento, per quel che è assegnato alla persona. Un pagamento senza data è del giorno della
 * ricevuta, come in `emetti_ricevuta`.
 */
export function cosaNonVaRicevutaDaMovimento(voci: VoceRicevuta[], giorno: string, dataMovimento: string, sue: Array<{ importo: number }>): string | null {
  const pagamenti = voci.flatMap((v) => v.pagamenti).filter((p) => p.importo > 0)
  const somma = (xs: Array<{ importo: number }>) => xs.reduce((t, x) => t + x.importo, 0)
  return pagamenti.some((p) => !stessa(p.metodo, 'Bonifico') || (p.data || giorno) !== dataMovimento) || somma(pagamenti) !== somma(sue)
    ? 'Il bonifico va nella ricevuta così com’è: rimettilo, o torna ad «Assegna» per cambiare gli importi.'
    : null
}

/**
 * I bonifici di una persona (le righe «SCRITTI IN CONTABILITÀ» della scheda) che hanno ancora soldi da assegnare, dal
 * più vecchio: le stesse regole di `cosaNonVaMovimentoDaAssegnare`, con voce e cassa per nome e `aMano` falso per lo
 * storico del vecchio programma.
 */
export function bonificiDaAssegnare(storico: VoceStorico[], diretti: PagamentoDiretto[], ricevute: Ricevuta[], oggi: string) {
  const inizio = stagioneDi(oggi).dal
  return storico
    .filter((v) => (v.voce === VOCE_QUOTA || v.voce === VOCE_CORSI) && v.cassa !== NOME_CASSA_CONTANTI && (v.aMano || v.data >= inizio))
    .map((v) => ({ movimentoId: v.id, data: v.data, importo: v.importo, daAssegnare: daAssegnare(v, diretti, ricevute) }))
    .filter((x) => x.daAssegnare > 0)
    .sort((a, b) => a.data.localeCompare(b.data) || a.movimentoId.localeCompare(b.movimentoId))
}
