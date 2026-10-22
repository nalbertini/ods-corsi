// Lo scarico dei pagamenti Satispay del negozio in CONTABILITÀ (`supabase/97-satispay-scarico.sql`).
// Qui stanno le regole che si provano senza browser: lo scorrere delle pagine (copiato nella Edge Function
// `satispay-scarico/pagine.ts`), la stessa regola del database per la modalità prova, e la commissione del giroconto.
import {
  CAMBIO_CASSA_SATISPAY,
  NOME_CASSA_CONTO,
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

/** La cassa di un giorno: Satispay dal cambio, prima Conto Corrente. È `satispay_cassa` nel 96. */
export const cassaSatispay = (data: string, casse: Cassa[]): Cassa | undefined =>
  casse.find((c) => c.nome === (data >= CAMBIO_CASSA_SATISPAY ? NOME_CASSA_SATISPAY : NOME_CASSA_CONTO))
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
  const nomiCandidate = [NOME_CASSA_CONTO, NOME_CASSA_SATISPAY]
  const candidate = dati.casse.filter((c) => nomiCandidate.includes(c.nome)).map((c) => c.id)
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
    const cassa = cassaSatispay(data, dati.casse)
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
              .filter((m) => m.tipo === 'entrata' && !m.annullatoIl && !m.satispayId && m.data === data && m.importo === p.importo && candidate.includes(m.cassaId))
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
      candidati: dati.movimenti
        .filter((m) => n.candidati?.includes(m.id))
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
    const m = movimenti.find((x) => x.id === movimentoId && !x.satispayId && !x.annullatoIl)
    if (!m) throw new Error('Quel movimento non c’è più o è già di un altro pagamento: ricarica la pagina')
    m.satispayId = p.satispayId
    p.esito = 'a_mano'
    p.movimentoId = m.id
  } else if (scelta === 'oggi' || scelta === 'scrivi') {
    const giorno = scelta === 'oggi' ? dati.oggi : giornoRoma(p.quando)
    const cassa = cassaSatispay(giorno, dati.casse)
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
