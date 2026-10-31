// Lo scarico dei pagamenti Satispay del negozio in CONTABILITÀ (`supabase/97-satispay-scarico.sql`).
// Qui stanno le regole che si provano senza browser: lo scorrere delle pagine (copiato nella Edge Function
// `satispay-scarico/pagine.ts`), la stessa regola del database per la modalità prova, e «chi ha pagato».
import {
  NOME_CASSA_SATISPAY,
  giornoChiuso,
  giornoRoma,
  type Cassa,
  type ChiusuraCassa,
  type MovimentoManuale,
  type VoceContabile,
} from './contabilita'
import type { RigaPagamento } from './pagamenti'
import type { PagamentoSatispay } from './satispay'
export { NOME_CASSA_SATISPAY }

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
  description?: string
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
  motivo?: 'giorno_chiuso' | 'forse_doppione' | 'prima_della_cassa' | 'nel_versamento'
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

/**
 * Le regole di `satispay_negozio_applica` (132-satispay-solo-chi-ha-pagato.sql) per la modalità prova: lo stesso
 * ordine, gli stessi conti. Non scrive movimenti: i soldi arrivano col versamento in banca, il pagamento dice solo
 * chi ha pagato. Con `scrivi` falso è l'anteprima: i dati non cambiano. Torna sempre array nuovi.
 */
export function applicaScarico(dati: DatiScarico, scrivi: boolean): { conti: ContiScarico; movimenti: MovimentoManuale[]; negozio: PagamentoNegozio[] } {
  const negozio = dati.negozio.map((n) => ({ ...n }))
  const conti: ContiScarico = { incassi: 0, rimborsi: 0, modulo: 0, pagamenti: 0, a_mano: 0, da_decidere: 0, prima: 0, scritti: 0, dal: null }
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
    if (dati.modulo.includes(p.satispayId)) {
      p.esito = 'modulo'
      conti.modulo++
    } else if (p.tipo === 'TO_BUSINESS' && righePagamenti(data, p.importo) > giaPresi(data, p.importo)) {
      p.esito = 'pagamenti'
      conti.pagamenti++
    } else {
      p.esito = 'fuori'
      p.motivo = 'nel_versamento'
      conti[p.tipo === 'TO_BUSINESS' ? 'incassi' : 'rimborsi']++
    }
  }
  conti.dal = negozio.map((n) => giornoRoma(n.quando)).sort()[0] ?? null
  const movimenti = dati.movimenti.map((m) => ({ ...m }))
  return { conti, movimenti, negozio: scrivi ? negozio : dati.negozio.map((n) => ({ ...n })) }
}

/** A che punto è lo scarico, per la striscia in MOVIMENTI. */
export interface StatoScarico {
  primoFatto: boolean
  ultimo: string | null
  errore: string | null
}

/**
 * `satispay_scollega`, «Non è questo»: il movimento a mano perde il segno e il pagamento resta nel versamento
 * (132), come se non fosse mai stato collegato. Nei giorni chiusi no: il collegamento è già nei conti di quella chiusura.
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
  p.esito = 'fuori'
  p.motivo = 'nel_versamento'
  delete p.movimentoId
  delete p.candidati
  return { movimenti, negozio }
}

const delMese = (p: PagamentoNegozio, mese: string) => giornoRoma(p.quando).slice(0, 7) === mese

/** Come è riconosciuto un pagamento Satispay: da una ricevuta, in PAGAMENTI, dal modulo, a mano, o da nessuno. */
export type ComeRiconosciuto = 'ricevuta' | 'pagamenti' | 'modulo' | 'a_mano' | 'rimborso' | 'non_riconosciuto'
export interface RigaChiHaPagato {
  satispayId: string
  tipo: PagamentoNegozio['tipo']
  importo: number
  data: string
  chi: string | null
  come: ComeRiconosciuto
  detto: string
  /** Il movimento a mano collegato, per «Non è questo». */
  movimentoId: string | null
}

/**
 * «Chi ha pagato» con Satispay in un mese (`AAAA-MM`, giorno di Roma), e a chi è stato riconosciuto. Sola lettura:
 * i soldi sono nel versamento in banca. Una riga di PAGAMENTI col metodo Satispay, lo stesso giorno e importo,
 * riconosce un pagamento solo, il primo in ordine di tempo.
 */
export function chiHaPagato(
  dati: { negozio: PagamentoNegozio[]; movimenti: MovimentoManuale[]; pagamenti: RigaPagamento[]; modulo: PagamentoSatispay[] },
  mese: string,
): RigaChiHaPagato[] {
  const delModulo = new Map(dati.modulo.map((m) => [m.id, m]))
  // Una ricevuta fatta dal modulo è già «dal modulo», come nel 132.
  const ricevuteModulo = new Set(dati.modulo.flatMap((m) => (m.ricevutaId ? [m.ricevutaId] : [])))
  const libere = dati.pagamenti.filter((r) => !r.annullato && r.metodo.trim().toLowerCase() === 'satispay' && !(r.ricevuta && ricevuteModulo.has(r.ricevuta.id)))
  return dati.negozio
    .filter((p) => p.stato === 'ACCEPTED' && delMese(p, mese))
    .sort((a, b) => perByte(a.quando, b.quando) || perByte(a.satispayId, b.satispayId))
    .map((p): RigaChiHaPagato => {
      const data = giornoRoma(p.quando)
      const riga = (come: ComeRiconosciuto, detto: string, movimentoId: string | null = null): RigaChiHaPagato =>
        ({ satispayId: p.satispayId, tipo: p.tipo, importo: p.importo, data, chi: p.chi ?? null, come, detto, movimentoId })
      if (p.tipo !== 'TO_BUSINESS') return riga('rimborso', 'Rimborso · esce dal versamento, non dai conti')
      const m = p.esito === 'a_mano' ? dati.movimenti.find((x) => x.id === p.movimentoId) : undefined
      if (m) return riga('a_mano', `Collegato a mano · ${m.descrizione}`, m.id)
      const modulo = delModulo.get(p.satispayId)
      if (modulo || p.esito === 'modulo') return riga('modulo', `Dal modulo · iscrizione di ${modulo?.chi || p.chi || '—'}`)
      const i = libere.findIndex((r) => r.data === data && r.importo === p.importo)
      if (i >= 0) {
        const [r] = libere.splice(i, 1)
        return r.ricevuta
          ? riga('ricevuta', `In una ricevuta · ${r.ricevuta.numero}/${r.ricevuta.anno}, ${r.chi}`)
          : riga('pagamenti', `Nei pagamenti · ${r.chi}, ${r.voce.toLowerCase()}`)
      }
      return p.esito === 'pagamenti' ? riga('pagamenti', 'Nei pagamenti') : riga('non_riconosciuto', 'Non riconosciuto')
    })
}

/** I conti di «Chi ha pagato»: il totale (rimborsi in meno) e quanti pagamenti sono riconosciuti. */
export function contiChiHaPagato(righe: RigaChiHaPagato[]) {
  const pagamenti = righe.filter((r) => r.tipo === 'TO_BUSINESS')
  const non = pagamenti.filter((r) => r.come === 'non_riconosciuto').length
  return {
    totale: righe.reduce((s, r) => s + (r.tipo === 'TO_BUSINESS' ? r.importo : -r.importo), 0),
    pagamenti: pagamenti.length,
    rimborsi: righe.length - pagamenti.length,
    riconosciuti: pagamenti.length - non,
    nonRiconosciuti: non,
  }
}

/** Cerca per nome (tutte le parole, in chi ha pagato o in chi l'ha riconosciuto) o per importo in euro («12» o «12,50»). */
export function filtraChiHaPagato(righe: RigaChiHaPagato[], cerca: string, soloNonRiconosciuti: boolean): RigaChiHaPagato[] {
  const q = cerca.trim().toLowerCase()
  const euro = /^\d+([.,]\d{1,2})?$/.test(q) ? Math.round(Number(q.replace(',', '.')) * 100) : null
  const parole = q.split(/\s+/).filter(Boolean)
  return righe.filter((r) => {
    if (soloNonRiconosciuti && r.come !== 'non_riconosciuto') return false
    if (euro !== null) return r.importo === euro
    const testo = `${r.chi ?? ''} ${r.detto}`.toLowerCase()
    return parole.every((x) => testo.includes(x))
  })
}
