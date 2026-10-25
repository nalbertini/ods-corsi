// Lo scarico dei pagamenti Satispay del negozio in CONTABILITÀ (`supabase/97-satispay-scarico.sql`).
// Qui stanno le regole che si provano senza browser: lo scorrere delle pagine (copiato nella Edge Function
// `satispay-scarico/pagine.ts`), la stessa regola del database per la modalità prova, e la commissione del giroconto.
import {
  CAMBIO_CASSA_SATISPAY,
  NOME_CASSA_SATISPAY,
  giornoChiuso,
  giornoRoma,
  type Cassa,
  type ChiusuraCassa,
  type MovimentoManuale,
  type RigaMovimento,
  type VoceContabile,
} from './contabilita'
import { dataRicevuta } from './ricevute'
export { CAMBIO_CASSA_SATISPAY, NOME_CASSA_SATISPAY }

/** L'host di produzione di Satispay: con quello di staging lo scarico non scrive niente. */
export const HOST_VERO = 'authservices.satispay.com'
export const scaricoPermesso = (host: string): boolean => host.trim().toLowerCase() === HOST_VERO

// <pagine> — da qui a </pagine> è copiato in supabase/functions/satispay-scarico/pagine.ts (lo controlla prova:satispay-scarico).
export const ERRORE_SCARICO = 'Satispay non risponde: lo scarico riprova da solo stanotte'

/** Un pagamento come lo dà `GET /g_business/v1/payments`, coi soli campi che servono. */
export interface PagamentoGrezzo {
  id: string
  type: string
  status: string
  amount_unit: number
  insert_date: string
  sender?: { name?: string }
}
export interface Pagina {
  data: PagamentoGrezzo[]
  has_more: boolean
}
export type EsitoScorri = { ok: true; ripresa: string | null; completa: boolean } | { ok: false; errore: string; ripresa: string | null }

/**
 * Scorre l'elenco dal più nuovo al più vecchio. Per lo storico riparte da `ripresa` (l'ultimo salvato) e va fino in
 * fondo; con `soloNuovi` parte dal più nuovo e si ferma alla prima pagina che non porta niente di nuovo.
 * Ogni pagina salvata resta anche se dopo Satispay non risponde: il salvataggio è idempotente.
 */
export async function scorriPagine(
  leggi: (startingAfter?: string) => Promise<Pagina | null>,
  salva: (pagamenti: PagamentoGrezzo[]) => Promise<number | null>,
  ripresa: string | null,
  soloNuovi = false,
): Promise<EsitoScorri> {
  let dopo = soloNuovi ? undefined : (ripresa ?? undefined)
  let segno = ripresa
  for (;;) {
    const pagina = await leggi(dopo)
    if (!pagina) return { ok: false, errore: ERRORE_SCARICO, ripresa: segno }
    const nuovi = pagina.data.length ? await salva(pagina.data) : 0
    if (nuovi === null) return { ok: false, errore: ERRORE_SCARICO, ripresa: segno }
    const ultimo = pagina.data.at(-1)?.id
    if (!soloNuovi && ultimo) segno = ultimo
    if (!pagina.has_more || !ultimo) return { ok: true, ripresa: segno, completa: true }
    if (soloNuovi && nuovi === 0) return { ok: true, ripresa: segno, completa: true }
    dopo = ultimo
  }
}
// </pagine>

/** La cassa dello scarico: Satispay, di qualunque giorno. È `satispay_cassa` nel 115. */
export const cassaSatispay = (casse: Cassa[]): Cassa | undefined => casse.find((c) => c.nome === NOME_CASSA_SATISPAY)
/** Il confronto di `order by` sugli id: per byte, uguale a ogni giro. */
const perByte = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

/** Un pagamento letto da Satispay, come la tabella `satispay_negozio`. */
export interface PagamentoNegozio {
  satispayId: string
  tipo: 'TO_BUSINESS' | 'REFUND_TO_BUSINESS'
  stato: string
  importo: number
  quando: string
  chi?: string | null
  esito?: 'scritto' | 'modulo' | 'pagamenti' | 'a_mano' | 'da_decidere' | 'fuori'
  motivo?: 'giorno_chiuso' | 'forse_doppione' | 'prima_della_cassa'
  candidati?: string[]
  movimentoId?: string
}
export interface DatiScarico {
  negozio: PagamentoNegozio[]
  /** Gli id Satispay dei pagamenti del modulo di iscrizione (`pagamenti_satispay`). */
  modulo: string[]
  /** Le righe di PAGAMENTI (ricevute e pagamenti a mano) fuori dal modulo: un incasso Satispay lì è già scritto. */
  pagamenti: Array<{ data: string; importo: number; metodo: string; annullato: boolean }>
  movimenti: MovimentoManuale[]
  casse: Cassa[]
  chiusure: ChiusuraCassa[]
  voci: VoceContabile[]
  oggi: string
}
export interface ContiScarico {
  incassi: number
  rimborsi: number
  modulo: number
  pagamenti: number
  a_mano: number
  da_decidere: number
  prima: number
  scritti: number
  dal: string | null
}

/** Il movimento nuovo di un pagamento: «Da classificare», col segno. È `satispay_scrivi` nel 96. */
export function movimentoDelPagamento(p: PagamentoNegozio, data: string, cassa: Cassa, voci: VoceContabile[]): MovimentoManuale {
  const tipo = p.tipo === 'TO_BUSINESS' ? 'entrata' : 'uscita'
  const chi = p.chi?.trim()
  return {
    id: crypto.randomUUID(),
    tipo,
    data,
    importo: p.importo,
    voceId: voci.find((v) => v.tipo === tipo && v.nome.trim().toLowerCase() === 'da classificare')?.id,
    cassaId: cassa.id,
    descrizione: `${tipo === 'entrata' ? 'Satispay' : 'Rimborso Satispay'}${chi ? ` · ${chi}` : ''}`,
    creatoIl: new Date().toISOString(),
    satispayId: p.satispayId,
  }
}

/**
 * Le regole di `satispay_negozio_applica` (97-satispay-scarico.sql) per la modalità prova: lo stesso ordine, gli
 * stessi conti. Con `scrivi` falso è l'anteprima: i dati non cambiano. Torna sempre array nuovi.
 */
export function applicaScarico(dati: DatiScarico, scrivi: boolean): { conti: ContiScarico; movimenti: MovimentoManuale[]; negozio: PagamentoNegozio[] } {
  const movimenti = dati.movimenti.map((m) => ({ ...m }))
  const negozio = dati.negozio.map((n) => ({ ...n }))
  const conti: ContiScarico = { incassi: 0, rimborsi: 0, modulo: 0, pagamenti: 0, a_mano: 0, da_decidere: 0, prima: 0, scritti: 0, dal: null }
  // Un incasso Satispay non è un incasso della banca: i candidati sono solo le entrate della cassa Satispay (115).
  const candidate = dati.casse.filter((c) => c.nome === NOME_CASSA_SATISPAY).map((c) => c.id)
  // Fino a ieri: oggi la palestra può ancora scriverlo in PAGAMENTI.
  const daFare = negozio
    .filter((p) => !p.esito && p.stato === 'ACCEPTED' && giornoRoma(p.quando) < dati.oggi)
    .sort((a, b) => Date.parse(a.quando) - Date.parse(b.quando) || perByte(a.satispayId, b.satispayId))
  // Le righe di PAGAMENTI sono intercambiabili: ognuna vale per un pagamento, anche fra un giro e l'altro.
  const righePagamenti = (data: string, importo: number) =>
    dati.pagamenti.filter((x) => !x.annullato && x.metodo.trim().toLowerCase() === 'satispay' && x.data === data && x.importo === importo).length
  const giaPresi = (data: string, importo: number) => negozio.filter((n) => n.esito === 'pagamenti' && n.importo === importo && giornoRoma(n.quando) === data).length
  for (const p of daFare) {
    const data = giornoRoma(p.quando)
    const cassa = cassaSatispay(dati.casse)
    if (dati.modulo.includes(p.satispayId)) {
      p.esito = 'modulo'
      conti.modulo++
    } else if (!cassa || (cassa.dal && data < cassa.dal)) {
      p.esito = 'fuori'
      p.motivo = 'prima_della_cassa'
      conti.prima++
    } else if (p.tipo === 'TO_BUSINESS' && righePagamenti(data, p.importo) > giaPresi(data, p.importo)) {
      p.esito = 'pagamenti'
      conti.pagamenti++
    } else {
      const cand =
        p.tipo === 'TO_BUSINESS'
          ? movimenti
              .filter((m) => m.tipo === 'entrata' && !m.annullatoIl && !m.satispayId && !m.bancaChiave && m.data === data && m.importo === p.importo && candidate.includes(m.cassaId))
              .sort((a, b) => a.creatoIl.localeCompare(b.creatoIl))
          : []
      if (cand.length === 1) {
        cand[0].satispayId = p.satispayId
        p.esito = 'a_mano'
        p.movimentoId = cand[0].id
        conti.a_mano++
      } else if (cand.length > 1) {
        p.esito = 'da_decidere'
        p.motivo = 'forse_doppione'
        p.candidati = cand.map((m) => m.id)
        conti.da_decidere++
      } else if (giornoChiuso(dati.chiusure, [cassa.id], data)) {
        p.esito = 'da_decidere'
        p.motivo = 'giorno_chiuso'
        conti.da_decidere++
      } else {
        const m = movimentoDelPagamento(p, data, cassa, dati.voci)
        movimenti.push(m)
        p.esito = 'scritto'
        p.movimentoId = m.id
        conti[p.tipo === 'TO_BUSINESS' ? 'incassi' : 'rimborsi']++
        conti.scritti++
      }
    }
  }
  conti.dal = negozio.map((n) => giornoRoma(n.quando)).sort()[0] ?? null
  if (!scrivi) return { conti, movimenti: dati.movimenti.map((m) => ({ ...m })), negozio: dati.negozio.map((n) => ({ ...n })) }
  return { conti, movimenti, negozio }
}

/** Un pagamento da decidere, come lo dà `satispay_scarico_stato`: coi movimenti a mano che potrebbero essere lui. */
export interface DaDecidere {
  satispayId: string
  tipo: PagamentoNegozio['tipo']
  importo: number
  chi?: string | null
  motivo: 'giorno_chiuso' | 'forse_doppione'
  data: string
  candidati: Array<{ id: string; descrizione: string; voce: string | null; cassa: string; importo: number }>
}
/** A che punto è lo scarico, per la striscia in MOVIMENTI. */
export interface StatoScarico {
  primoFatto: boolean
  ultimo: string | null
  errore: string | null
  daDecidere: DaDecidere[]
}
export type SceltaSatispay = 'oggi' | 'fuori' | 'a_mano' | 'scrivi'

/** I pagamenti da decidere, dal più vecchio: la parte `da_decidere` di `satispay_scarico_stato`. */
export function daDecidere(dati: Pick<DatiScarico, 'negozio' | 'movimenti' | 'voci' | 'casse'>): DaDecidere[] {
  return dati.negozio
    .filter((n) => n.esito === 'da_decidere')
    .sort((a, b) => Date.parse(a.quando) - Date.parse(b.quando))
    .map((n) => ({
      satispayId: n.satispayId,
      tipo: n.tipo,
      importo: n.importo,
      chi: n.chi,
      // `as`: un pagamento da decidere ha sempre uno di questi due motivi (`satispay_negozio_applica`).
      motivo: n.motivo as DaDecidere['motivo'],
      data: giornoRoma(n.quando),
      // Un movimento preso nel frattempo da un altro pagamento, o annullato, non è più una scelta possibile.
      candidati: dati.movimenti
        .filter((m) => n.candidati?.includes(m.id) && !m.satispayId && !m.bancaChiave && !m.annullatoIl)
        .sort((a, b) => a.creatoIl.localeCompare(b.creatoIl))
        .map((m) => ({
          id: m.id,
          descrizione: m.descrizione,
          voce: dati.voci.find((v) => v.id === m.voceId)?.nome ?? null,
          cassa: dati.casse.find((c) => c.id === m.cassaId)?.nome ?? '',
          importo: m.importo,
        })),
    }))
}

/** `satispay_decidi` per la modalità prova: stessi controlli, stessi messaggi. Torna array nuovi, i dati non cambiano. */
export function decidiScarico(dati: DatiScarico, satispayId: string, scelta: SceltaSatispay, movimentoId?: string): { movimenti: MovimentoManuale[]; negozio: PagamentoNegozio[] } {
  const movimenti = dati.movimenti.map((m) => ({ ...m }))
  const negozio = dati.negozio.map((n) => ({ ...n }))
  const p = negozio.find((n) => n.satispayId === satispayId)
  if (!p) throw new Error('Il pagamento non c’è')
  if (p.esito !== 'da_decidere') throw new Error('Questo pagamento è già deciso')
  if (scelta === 'fuori') {
    p.esito = 'fuori'
  } else if (scelta === 'a_mano') {
    if (!movimentoId || !p.candidati?.includes(movimentoId)) throw new Error('Scegli uno dei movimenti proposti')
    // Un movimento a mano copre un soldo arrivato solo: se lo copre già la banca, non è anche di Satispay.
    if (movimenti.some((x) => x.id === movimentoId && x.bancaChiave)) throw new Error('Quel movimento è già coperto da un movimento della banca: ricarica la pagina')
    const m = movimenti.find((x) => x.id === movimentoId && !x.satispayId && !x.annullatoIl)
    if (!m) throw new Error('Quel movimento non c’è più o è già di un altro pagamento: ricarica la pagina')
    m.satispayId = p.satispayId
    p.esito = 'a_mano'
    p.movimentoId = m.id
  } else if (scelta === 'oggi' || scelta === 'scrivi') {
    const giorno = scelta === 'oggi' ? dati.oggi : giornoRoma(p.quando)
    const cassa = cassaSatispay(dati.casse)
    if (!cassa || (cassa.dal && giorno < cassa.dal)) throw new Error('Quel giorno la cassa non c’era ancora: scrivilo oggi')
    if (giornoChiuso(dati.chiusure, [cassa.id], giorno)) throw new Error('Quel giorno la cassa è chiusa: scrivilo oggi')
    const m = movimentoDelPagamento(p, giorno, cassa, dati.voci)
    movimenti.push(m)
    p.esito = 'scritto'
    p.movimentoId = m.id
  } else {
    throw new Error('Scegli cosa fare del pagamento')
  }
  return { movimenti, negozio }
}

/** I pagamenti da decidere che si decidono insieme: stesso tipo, motivo, giorno e importo, coi candidati di tutti. */
export interface GruppoDaDecidere {
  tipo: DaDecidere['tipo']
  motivo: DaDecidere['motivo']
  data: string
  importo: number
  pagamenti: DaDecidere[]
  candidati: DaDecidere['candidati']
}

/** I casi da decidere a gruppi, per giorno e poi importo: lo stesso movimento si vede una volta, non per ogni pagamento. */
export function gruppiDaDecidere(casi: DaDecidere[]): GruppoDaDecidere[] {
  const gruppi = new Map<string, GruppoDaDecidere>()
  for (const c of casi) {
    const chiave = [c.tipo, c.motivo, c.data, c.importo].join('|')
    const g = gruppi.get(chiave) ?? { tipo: c.tipo, motivo: c.motivo, data: c.data, importo: c.importo, pagamenti: [], candidati: [] }
    g.pagamenti.push(c)
    for (const m of c.candidati) if (!g.candidati.some((x) => x.id === m.id)) g.candidati.push(m)
    gruppi.set(chiave, g)
  }
  return [...gruppi.values()].sort((a, b) => perByte(a.data, b.data) || a.importo - b.importo)
}

const parole = (testo: string) =>
  testo
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((p) => p && p !== 'cliente')

/** Il nome di chi ha pagato su Satispay sta tutto nella descrizione del movimento: un indizio, non una scelta. */
export function nomeSimile(chi: string, descrizione: string): boolean {
  const nome = parole(chi)
  const dove = new Set(parole(descrizione))
  return nome.length > 0 && nome.every((p) => dove.has(p))
}

/** I candidati per un pagamento: quelli col nome simile prima, gli altri nell'ordine di scrittura. */
export const candidatiInOrdine = <C extends { descrizione: string }>(chi: string | null | undefined, candidati: C[]): C[] =>
  [...candidati].sort((a, b) => Number(nomeSimile(chi ?? '', b.descrizione)) - Number(nomeSimile(chi ?? '', a.descrizione)))

export interface SceltaGruppo {
  satispayId: string
  scelta: SceltaSatispay
  movimentoId?: string
}

/** `satispay_decidi_gruppo`: tutte le scelte o nessuna, e un movimento vale per un pagamento solo. */
export function decidiGruppo(dati: DatiScarico, scelte: SceltaGruppo[]): { movimenti: MovimentoManuale[]; negozio: PagamentoNegozio[] } {
  const presi = scelte.filter((s) => s.scelta === 'a_mano').map((s) => s.movimentoId)
  if (new Set(presi).size < presi.length) throw new Error('Lo stesso movimento è scelto per due pagamenti')
  // `decidiScarico` non tocca i dati che riceve: se una scelta lancia, quelli di partenza restano come sono.
  return scelte.reduce((d, s) => ({ ...d, ...decidiScarico(d, s.satispayId, s.scelta, s.movimentoId) }), dati)
}

/** Le scelte di un gruppo mentre si fanno, per pagamento. */
export type ScelteInCorso = Record<string, { scelta: SceltaSatispay; movimentoId?: string }>

/** Come si dice un pagamento scritto nuovo: un rimborso esce, non entra. */
export function dettoNuovo(tipo: PagamentoNegozio['tipo'], n: number) {
  const rimborso = tipo === 'REFUND_TO_BUSINESS'
  return {
    scelta: rimborso ? 'Rimborso nuovo' : 'Incasso nuovo',
    conto: rimborso ? `${n} ${n === 1 ? 'rimborso nuovo' : 'rimborsi nuovi'}` : `${n} ${n === 1 ? 'incasso nuovo' : 'incassi nuovi'}`,
    verso: rimborso ? 'in meno' : 'in più',
  }
}

/**
 * Il riepilogo sotto un gruppo, prima della conferma: quante scelte mancano, chi si collega a cosa (col nome che
 * somiglia o no), gli incassi nuovi, i movimenti già presi. `scelte` è null finché non si può confermare.
 */
export function riepilogoGruppo(gruppo: GruppoDaDecidere, inCorso: ScelteInCorso) {
  const presi: Record<string, string> = {}
  const collegati: Array<{ chi: string; descrizione: string; simile: boolean }> = []
  const nuovi = { conteggio: 0, importo: 0 }
  const scelte: SceltaGruppo[] = []
  for (const p of gruppo.pagamenti) {
    const s = inCorso[p.satispayId]
    if (!s || (s.scelta === 'a_mano' && !s.movimentoId)) continue
    scelte.push({ satispayId: p.satispayId, ...s })
    if (s.scelta === 'scrivi' || s.scelta === 'oggi') {
      nuovi.conteggio++
      nuovi.importo += p.importo
    }
    const m = s.scelta === 'a_mano' ? gruppo.candidati.find((c) => c.id === s.movimentoId) : undefined
    if (!m) continue
    if (presi[m.id]) return { mancano: gruppo.pagamenti.length - scelte.length, collegati, nuovi, presi, scelte: null }
    presi[m.id] = p.satispayId
    collegati.push({ chi: p.chi ?? '', descrizione: m.descrizione, simile: nomeSimile(p.chi ?? '', m.descrizione) })
  }
  const mancano = gruppo.pagamenti.length - scelte.length
  return { mancano, collegati, nuovi, presi, scelte: mancano ? null : scelte }
}

/**
 * `satispay_scollega`, «Non è questo»: il movimento a mano perde il segno e il pagamento torna da decidere, coi
 * candidati di `applicaScarico`. Nei giorni chiusi no: il collegamento è già nei conti di quella chiusura.
 */
export function scollegaScarico(dati: DatiScarico, satispayId: string): { movimenti: MovimentoManuale[]; negozio: PagamentoNegozio[] } {
  const movimenti = dati.movimenti.map((m) => ({ ...m }))
  const negozio = dati.negozio.map((n) => ({ ...n }))
  const p = negozio.find((n) => n.satispayId === satispayId)
  if (!p) throw new Error('Il pagamento non c’è')
  const m = movimenti.find((x) => x.id === p.movimentoId)
  if (p.esito !== 'a_mano' || !m) throw new Error('Questo pagamento non è collegato a un movimento a mano')
  if (giornoChiuso(dati.chiusure, [m.cassaId], m.data)) throw new Error('Quel giorno la cassa è chiusa: il collegamento resta')
  delete m.satispayId
  const data = giornoRoma(p.quando)
  const candidate = dati.casse.filter((c) => c.nome === NOME_CASSA_SATISPAY).map((c) => c.id)
  p.esito = 'da_decidere'
  p.motivo = 'forse_doppione'
  delete p.movimentoId
  p.candidati = movimenti
    .filter((x) => x.tipo === 'entrata' && !x.annullatoIl && !x.satispayId && !x.bancaChiave && x.data === data && x.importo === p.importo && candidate.includes(x.cassaId))
    .sort((a, b) => a.creatoIl.localeCompare(b.creatoIl))
    .map((x) => x.id)
  return { movimenti, negozio }
}

/** Gli esiti di un pagamento che è in contabilità: scritto dallo scarico, già a mano, dal modulo, in PAGAMENTI. */
const ENTRATI: NonNullable<PagamentoNegozio['esito']>[] = ['scritto', 'a_mano', 'modulo', 'pagamenti']
const delMese = (p: PagamentoNegozio, mese: string) => giornoRoma(p.quando).slice(0, 7) === mese
const conSegno = (p: PagamentoNegozio) => (p.tipo === 'TO_BUSINESS' ? p.importo : -p.importo)

export interface RigaEntrato {
  satispayId: string
  tipo: PagamentoNegozio['tipo']
  importo: number
  data: string
  chi: string | null
  esito: NonNullable<PagamentoNegozio['esito']>
  voce: string | null
  movimento: { id: string; descrizione: string; cassa: string } | null
}

/** «Cosa è entrato» da Satispay in un mese (`AAAA-MM`, giorno di Roma): ogni pagamento in contabilità e dove è finito. */
export function righeEntrato(dati: Pick<DatiScarico, 'negozio' | 'movimenti' | 'voci' | 'casse'>, mese: string): RigaEntrato[] {
  return dati.negozio
    .filter((p) => p.esito && ENTRATI.includes(p.esito) && delMese(p, mese))
    .map((p) => {
      const m = p.movimentoId ? dati.movimenti.find((x) => x.id === p.movimentoId) : undefined
      return {
        satispayId: p.satispayId,
        tipo: p.tipo,
        importo: p.importo,
        data: giornoRoma(p.quando),
        chi: p.chi ?? null,
        // `as`: il filtro qui sopra tiene solo i pagamenti con un esito.
        esito: p.esito as RigaEntrato['esito'],
        voce: dati.voci.find((v) => v.id === m?.voceId)?.nome ?? null,
        movimento: m ? { id: m.id, descrizione: m.descrizione, cassa: dati.casse.find((c) => c.id === m.cassaId)?.nome ?? '' } : null,
      }
    })
    .sort((a, b) => perByte(a.data, b.data) || perByte(a.satispayId, b.satispayId))
}

/** I conti del mese: quel che è in contabilità contro quel che dice Satispay; a mese deciso tornano. */
export function riepilogoEntrato(dati: Pick<DatiScarico, 'negozio'>, mese: string) {
  const delMeseAccettati = dati.negozio.filter((p) => p.stato === 'ACCEPTED' && delMese(p, mese))
  const entrati = delMeseAccettati.filter((p) => p.esito && ENTRATI.includes(p.esito))
  const aMano = entrati.filter((p) => p.esito === 'a_mano')
  return {
    entrato: entrati.reduce((s, p) => s + conSegno(p), 0),
    secondoSatispay: delMeseAccettati.reduce((s, p) => s + conSegno(p), 0),
    aMano: { conteggio: aMano.length, importo: aMano.reduce((s, p) => s + p.importo, 0) },
  }
}

/**
 * La commissione di un versamento Satispay in banca: quel che è entrato nella cassa Satispay dal versamento prima
 * fino al giorno prima di questo, meno quel che è arrivato. Null se non torna (niente da trattenere, o più dell'incassato).
 */
export function commissioneSatispay(righe: RigaMovimento[], cassaSatispayId: string, data: string, arrivato: number) {
  const al = new Date(new Date(`${data}T12:00:00Z`).getTime() - 86_400_000).toISOString().slice(0, 10)
  const prima = righe
    .filter((r) => r.tipo === 'giroconto' && !r.annullato && r.cassaId === cassaSatispayId && r.data < data)
    .map((r) => r.data)
    .sort()
    .at(-1)
  const dal = prima ?? CAMBIO_CASSA_SATISPAY
  // Gli incassi dello scarico e quelli di PAGAMENTI col metodo Satispay (`cassaDelMetodo`): non le uscite scritte a mano.
  const conti = righe.filter((r) => (r.satispayId || r.origine !== 'movimento') && !r.annullato && r.cassaId === cassaSatispayId && r.data >= dal && r.data <= al)
  const pagamenti = conti.filter((r) => r.tipo === 'entrata').length
  const rimborsi = conti.filter((r) => r.tipo === 'uscita').length
  const incassato = conti.reduce((s, r) => s + (r.tipo === 'entrata' ? r.importo : -r.importo), 0)
  const commissione = incassato - arrivato
  if (commissione <= 0 || commissione >= incassato) return null
  return { dal, al, incassato, pagamenti, rimborsi, commissione }
}

/** L'uscita della commissione, scritta dopo il giroconto: se manca la voce, il giroconto resta e la commissione si scrive a mano. */
export function spesaCommissione(c: { dal: string; al: string; commissione: number }, cassaSatispayId: string, data: string, voci: VoceContabile[]) {
  const voce = voci.find((v) => v.tipo === 'uscita' && v.nome.trim().toLowerCase() === 'commissioni bancarie')
  if (!voce) throw new Error('Manca la voce «Commissioni bancarie»: aggiungila in CONTABILITÀ → VOCI e scrivi la commissione a mano')
  const giorno = (d: string) => dataRicevuta(d).slice(0, 5)
  return { tipo: 'uscita' as const, data, importo: c.commissione, cassaId: cassaSatispayId, voceId: voce.id, descrizione: `Commissione Satispay · dal ${giorno(c.dal)} al ${giorno(c.al)}` }
}
