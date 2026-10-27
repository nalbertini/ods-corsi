import type { Cassa, RigaMovimento } from './contabilita'
import { GIORNI_DI_DIFFERENZA, PREFISSO_CHIAVE_BANCA, type CopertoBanca, type MovimentoBanca } from './importaBanca'
import { VOCE_DA_CLASSIFICARE } from './importaPrimaNota'
import { centesimi, euro } from './ricevute'

/**
 * La quadratura mensile del Conto Corrente con l'estratto BancoPosta: il saldo dell'app contro i quattro
 * numeri del riepilogo (tabella `saldo_banca`, `supabase/123-quadratura-banca.sql`), e le righe che spiegano
 * la differenza. L'abbinamento segue la regola dell'importazione (`importaBanca.ts`): prima la chiave della
 * banca, poi stesso tipo e importo entro GIORNI_DI_DIFFERENZA giorni. Importi in centesimi.
 */

export interface SaldoBanca {
  mese: string
  saldoIniziale: number
  entrate: number
  uscite: number
  saldoFinale: number
  verificatoIl?: string | null
  verificatoDa?: string | null
  improntaVerifica?: string | null
}

export type RigaBanca = Pick<MovimentoBanca, 'chiave' | 'data' | 'tipo' | 'importo' | 'descrizione'>

export interface RigaApp {
  id: string
  data: string
  /** Come la vede il conto: un giroconto verso il conto è un'entrata, da conto un'uscita. */
  tipo: 'entrata' | 'uscita'
  importo: number
  descrizione: string
  voce: string | null
}

export interface SaldoMese {
  saldoIniziale: number
  entrate: number
  uscite: number
  saldoFinale: number
}

export type StatoQuadratura =
  | 'non ancora finito'
  | 'saldo da scrivere'
  | 'CSV del mese mancante'
  | 'verificato'
  | 'cambiato dopo la verifica'
  | 'non torna'
  | 'da classificare'
  | 'torna'

export interface Coppia {
  app: RigaApp
  banca: RigaBanca
}

export interface Quadratura {
  mese: string
  stato: StatoQuadratura
  app: SaldoMese
  /** App − banca, sui saldi finali: positiva = nell'app c'è più di quanto dice la banca. */
  differenza: number | null
  nonSpiegato: number | null
  soloApp: { riga: RigaApp; causa: string | null }[] | null
  soloBanca: { riga: RigaBanca; causa: string | null }[] | null
  dataDiversa: Coppia[] | null
  abbinate: Coppia[] | null
  daClassificare: number
  avvisi: { tipo: 'discontinuita' | 'csv-incompleto'; testo: string }[]
}

const MESE = /^\d{4}-(0[1-9]|1[0-2])$/

export const meseInLettere = (mese: string) =>
  new Date(`${mese}-15T12:00:00Z`).toLocaleDateString('it-IT', { month: 'long', year: 'numeric', timeZone: 'UTC' })

export function mesePrima(mese: string): string {
  const [a, m] = mese.split('-').map(Number)
  return m === 1 ? `${a - 1}-12` : `${a}-${String(m - 1).padStart(2, '0')}`
}

/** Di quanto una riga sposta il conto: positivo se entra, negativo se esce, 0 se non lo tocca. */
function effetto(r: RigaMovimento, conto: Cassa | undefined): number {
  if (!conto || r.annullato || (conto.dal && r.data < conto.dal)) return 0
  if (r.tipo === 'giroconto') return (r.cassaAId === conto.id ? r.importo : 0) - (r.cassaId === conto.id ? r.importo : 0)
  if (r.cassaId !== conto.id) return 0
  return r.tipo === 'entrata' ? r.importo : -r.importo
}

export function saldoAppDelMese(casse: Cassa[], righe: RigaMovimento[], contoId: string, mese: string): SaldoMese {
  const conto = casse.find((c) => c.id === contoId)
  let saldoIniziale = conto?.saldoIniziale ?? 0
  let entrate = 0
  let uscite = 0
  for (const r of righe) {
    const e = effetto(r, conto)
    const m = r.data.slice(0, 7)
    if (m < mese) saldoIniziale += e
    else if (m === mese) {
      if (e > 0) entrate += e
      else uscite -= e
    }
  }
  return { saldoIniziale, entrate, uscite, saldoFinale: saldoIniziale + entrate - uscite }
}

export function cosaNonVaSaldoBanca(s: SaldoBanca, oggi: string): string | null {
  if (!MESE.test(s.mese)) return 'Scegli il mese dell’estratto dall’elenco.'
  if (s.mese > oggi.slice(0, 7)) return `${meseInLettere(s.mese)} non è ancora cominciato: scegli un mese passato, o aspetta il suo estratto.`
  if (s.entrate < 0 || s.uscite < 0) return 'Scrivi entrate e uscite senza il segno meno, come nel riepilogo dell’estratto.'
  const calcolato = s.saldoIniziale + s.entrate - s.uscite
  if (calcolato !== s.saldoFinale)
    return `I numeri non tornano fra loro: ${euro(s.saldoIniziale)} + ${euro(s.entrate)} − ${euro(s.uscite)} fa ${euro(calcolato)} €, non ${euro(s.saldoFinale)} €. Ricontrolla l’estratto: di solito è una cifra copiata male.`
  return null
}

/**
 * Le righe della banca che l'app conosce: quelle importate (anche annullate: in banca ci sono comunque) e quelle
 * coperte da un movimento già scritto (`bancaCoperti`, null senza il 114). Una chiave conta una volta.
 */
export function righeBanca(righe: RigaMovimento[], coperti: CopertoBanca[] | null): RigaBanca[] {
  const importate = righe.flatMap((r) =>
    r.origineImport?.startsWith(PREFISSO_CHIAVE_BANCA) && r.tipo !== 'giroconto' ? [{ chiave: r.origineImport, data: r.data, tipo: r.tipo, importo: r.importo, descrizione: r.descrizione }] : [],
  )
  const viste = new Set(importate.map((b) => b.chiave))
  return [...importate, ...(coperti ?? []).filter((c) => !viste.has(c.chiave)).map((c) => ({ chiave: c.chiave, data: c.data, tipo: c.tipo, importo: c.importo, descrizione: c.descrizione }))]
}

export const saldoInizialeProposto = (saldi: SaldoBanca[], mese: string): number | null =>
  saldi.find((s) => s.mese === mesePrima(mese))?.saldoFinale ?? null

const tocca = (r: RigaMovimento, contoId: string) => r.cassaId === contoId || (r.tipo === 'giroconto' && r.cassaAId === contoId)

/** cyrb53: un'impronta corta e stabile, non un segreto. */
function impronta(testo: string): string {
  let h1 = 0xdeadbeef
  let h2 = 0x41c6ce57
  for (let i = 0; i < testo.length; i++) {
    const c = testo.charCodeAt(i)
    h1 = Math.imul(h1 ^ c, 2654435761)
    h2 = Math.imul(h2 ^ c, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36)
}

export function improntaMese(righe: RigaMovimento[], contoId: string, mese: string): string {
  const vive = righe
    .filter((r) => !r.annullato && r.data.slice(0, 7) === mese && tocca(r, contoId))
    .map((r) => JSON.stringify([r.data, r.tipo, r.importo, r.voce, r.descrizione, r.cassaId, r.cassaAId ?? null]))
    .sort()
  return `${vive.length}-${impronta(vive.join('\n'))}`
}

const giorniTra = (a: string, b: string) => Math.abs(Date.parse(a) - Date.parse(b)) / 86_400_000

function causaSoloBanca(r: RigaBanca): string | null {
  if (r.tipo === 'entrata' && /versament/i.test(r.descrizione) && /contant/i.test(r.descrizione)) return 'forse un giroconto'
  if (r.tipo === 'uscita' && /commission|spese/i.test(r.descrizione)) return 'commissione di Poste'
  return null
}

/** L'importo col segno: le entrate in più, le uscite in meno. */
export const firmato = (r: { tipo: 'entrata' | 'uscita'; importo: number }) => (r.tipo === 'entrata' ? r.importo : -r.importo)

/** Le coppie app–banca su tutte le righe, uno a uno: prima per chiave, poi per tipo, importo e data vicina. */
function abbina(app: (RigaApp & { chiavi: string[] })[], banca: RigaBanca[]): Coppia[] {
  const coppie: Coppia[] = []
  const usate = new Set<string>()
  const restano: RigaBanca[] = []
  const perChiave = new Map(app.flatMap((a) => a.chiavi.map((k) => [k, a] as const)))
  for (const b of banca) {
    const a = perChiave.get(b.chiave)
    if (a && !usate.has(a.id)) {
      usate.add(a.id)
      coppie.push({ app: a, banca: b })
    } else restano.push(b)
  }
  const perImporto = new Map<string, RigaApp[]>()
  for (const a of app) if (!usate.has(a.id)) perImporto.set(`${a.tipo}|${a.importo}`, [...(perImporto.get(`${a.tipo}|${a.importo}`) ?? []), a])
  for (const b of [...restano].sort((x, y) => x.data.localeCompare(y.data) || x.chiave.localeCompare(y.chiave))) {
    const scelta = (perImporto.get(`${b.tipo}|${b.importo}`) ?? [])
      .filter((a) => !usate.has(a.id) && giorniTra(a.data, b.data) <= GIORNI_DI_DIFFERENZA)
      .sort((x, y) => giorniTra(x.data, b.data) - giorniTra(y.data, b.data) || x.id.localeCompare(y.id))[0]
    if (scelta) {
      usate.add(scelta.id)
      coppie.push({ app: scelta, banca: b })
    }
  }
  return coppie
}

export function quadratura(o: {
  mese: string
  oggi: string
  contoId: string
  casse: Cassa[]
  righe: RigaMovimento[]
  banca: RigaBanca[]
  saldo: SaldoBanca | null
  saldoPrima: SaldoBanca | null
}): Quadratura {
  const { mese, contoId, saldo } = o
  const app = saldoAppDelMese(o.casse, o.righe, contoId, mese)
  const differenza = saldo ? app.saldoFinale - saldo.saldoFinale : null
  const nelMese = (d: string) => d.slice(0, 7) === mese
  const daClassificare = o.righe.filter((r) => !r.annullato && r.cassaId === contoId && nelMese(r.data) && r.voce === VOCE_DA_CLASSIFICARE).length
  const conto = o.casse.find((c) => c.id === contoId)
  // Solo i cinque campi: il codice fiscale letto dalla banca non esce di qui.
  const banca: RigaBanca[] = o.banca.map((b) => ({ chiave: b.chiave, data: b.data, tipo: b.tipo, importo: b.importo, descrizione: b.descrizione }))
  const bancaDelMese = banca.filter((b) => nelMese(b.data))
  // Anche prima della prima importazione: chi ha scritto il saldo del mese ne vuole il confronto.
  const senzaCsv = bancaDelMese.length ? null : 'CSV del mese mancante'

  const avvisi: Quadratura['avvisi'] = []
  if (saldo && o.saldoPrima && saldo.saldoIniziale !== o.saldoPrima.saldoFinale)
    avvisi.push({ tipo: 'discontinuita', testo: `Il saldo iniziale di ${meseInLettere(mese)} (${euro(saldo.saldoIniziale)} €) non è il finale del mese prima (${euro(o.saldoPrima.saldoFinale)} €): ricontrolla uno dei due estratti.` })

  let liste: Pick<Quadratura, 'soloApp' | 'soloBanca' | 'dataDiversa' | 'abbinate'> = { soloApp: null, soloBanca: null, dataDiversa: null, abbinate: null }
  let nonSpiegato: number | null = null
  if (!senzaCsv) {
    const satispay = new Set<string>()
    const righeApp = o.righe.flatMap((r) => {
      const e = effetto(r, conto)
      if (!e) return []
      if (r.satispayId) satispay.add(r.id)
      const riga: RigaApp = { id: r.id, data: r.data, tipo: e > 0 ? 'entrata' : 'uscita', importo: Math.abs(e), descrizione: r.descrizione, voce: r.voce }
      return [{ ...riga, chiavi: [r.origineImport, r.bancaChiave].filter((k): k is string => !!k) }]
    })
    const coppie = abbina(righeApp, banca)
    const appiate = new Set(coppie.map((c) => c.app.id))
    const bancaAppiate = new Set(coppie.map((c) => c.banca.chiave))
    const togliChiavi = ({ chiavi: _, ...r }: RigaApp & { chiavi: string[] }): RigaApp => r
    const abbinate = coppie.filter((c) => nelMese(c.app.data) || nelMese(c.banca.data))
    // A cavallo di mese la coppia c'è, ma nel saldo del mese conta una parte sola: per il non spiegato è «solo».
    const aCavallo = abbinate.filter((c) => nelMese(c.app.data) !== nelMese(c.banca.data))
    const soloApp = righeApp.filter((a) => nelMese(a.data) && !appiate.has(a.id)).map((a) => ({ riga: togliChiavi(a), causa: satispay.has(a.id) ? 'forse un doppione Satispay' : null }))
    const soloBanca = bancaDelMese.filter((b) => !bancaAppiate.has(b.chiave)).map((b) => ({ riga: b, causa: causaSoloBanca(b) }))
    liste = { soloApp, soloBanca, dataDiversa: abbinate.filter((c) => c.app.data !== c.banca.data), abbinate }
    if (saldo && differenza !== null) {
      const spiegato =
        soloApp.reduce((s, x) => s + firmato(x.riga), 0) -
        soloBanca.reduce((s, x) => s + firmato(x.riga), 0) +
        aCavallo.reduce((s, c) => s + (nelMese(c.app.data) ? firmato(c.app) : -firmato(c.banca)), 0)
      nonSpiegato = differenza - (app.saldoIniziale - saldo.saldoIniziale) - spiegato
      const entrate = bancaDelMese.reduce((s, b) => s + (b.tipo === 'entrata' ? b.importo : 0), 0)
      const uscite = bancaDelMese.reduce((s, b) => s + (b.tipo === 'uscita' ? b.importo : 0), 0)
      if (entrate !== saldo.entrate || uscite !== saldo.uscite)
        avvisi.push({ tipo: 'csv-incompleto', testo: `Le righe della banca di ${meseInLettere(mese)} fanno ${euro(entrate)} € di entrate e ${euro(uscite)} € di uscite, l’estratto ${euro(saldo.entrate)} € e ${euro(saldo.uscite)} €: scarica di nuovo la «Lista movimenti» del mese intero e importala.` })
    }
  }

  // Anche con le righe del mese intatte, un mese prima cambiato sposta il saldo iniziale: la differenza lo dice.
  const verifica = saldo?.verificatoIl ? (saldo.improntaVerifica === improntaMese(o.righe, contoId, mese) && differenza === 0 ? 'verificato' : 'cambiato dopo la verifica') : null
  const stato: StatoQuadratura =
    mese >= o.oggi.slice(0, 7) ? 'non ancora finito'
    : !saldo ? 'saldo da scrivere'
    : senzaCsv ?? verifica ?? (differenza !== 0 ? 'non torna' : daClassificare ? 'da classificare' : 'torna')
  return { mese, stato, app, differenza, nonSpiegato, ...liste, daClassificare, avvisi }
}

/**
 * La differenza divisa nelle sue parti, col segno di «app − banca»: sommate fanno `differenza`. «altroMese» sono
 * le coppie con la data a cavallo di mese: ci sono in tutti e due, ma nel saldo del mese conta una parte sola.
 */
export function riepilogoDifferenza(q: Quadratura, saldo: SaldoBanca | null) {
  if (!saldo || q.differenza === null || q.nonSpiegato === null || !q.soloApp || !q.soloBanca) return null
  const soloApp = q.soloApp.reduce((s, x) => s + firmato(x.riga), 0)
  const soloBanca = -q.soloBanca.reduce((s, x) => s + firmato(x.riga), 0)
  const inizioDiverso = q.app.saldoIniziale - saldo.saldoIniziale
  return { soloApp, soloBanca, inizioDiverso, altroMese: q.differenza - soloApp - soloBanca - inizioDiverso - q.nonSpiegato, nonSpiegato: q.nonSpiegato }
}

/** Quel che serve per segnare un mese verificato: lo controllano la schermata e chi scrive. */
export type QuadraturaDaVerificare = Pick<Quadratura, 'mese' | 'stato' | 'differenza' | 'daClassificare'>
export function cosaNonVaVerifica(q: QuadraturaDaVerificare): string | null {
  if (q.stato === 'verificato') return 'Questo mese è già verificato.'
  if (q.stato !== 'torna' && q.stato !== 'cambiato dopo la verifica' && q.stato !== 'da classificare' && q.stato !== 'non torna')
    return q.stato === 'non ancora finito' ? 'Il mese non è ancora finito: lo segni verificato quando c’è il suo estratto.'
      : q.stato === 'saldo da scrivere' ? 'Scrivi prima il saldo dell’estratto.'
      : 'Mancano le righe della banca del mese: importa la «Lista movimenti» e riprova.'
  if (q.differenza !== 0) return 'Il conto non torna ancora con la banca: sistema le righe che mancano, poi segnalo verificato.'
  if (q.daClassificare) return `Ci sono ancora ${q.daClassificare === 1 ? '1 riga' : `${q.daClassificare} righe`} «Da classificare»: dagli una voce, poi segnalo verificato.`
  return null
}

export type CampoSaldoBanca = 'iniziale' | 'finale' | 'entrate' | 'uscite'

/**
 * I quattro numeri scritti nel modulo del saldo: `saldo` solo se si può salvare, `errore` per chi scrive (null finché
 * manca un campo e niente è scritto male), `campi` quelli da segnare: nessuno se non si sa quale dei quattro sbaglia.
 */
export function leggiSaldoBanca(t: Record<CampoSaldoBanca, string>, mese: string, oggi: string): { saldo: SaldoBanca | null; errore: string | null; campi: CampoSaldoBanca[] } {
  const nomi: CampoSaldoBanca[] = ['iniziale', 'finale', 'entrate', 'uscite']
  const c = { iniziale: centesimiConSegno(t.iniziale), finale: centesimiConSegno(t.finale), entrate: centesimiConSegno(t.entrate), uscite: centesimiConSegno(t.uscite) }
  const male = nomi.filter((k) => t[k].trim() && c[k] === null)
  if (male.length) return { saldo: null, errore: 'Scrivi gli importi come nell’estratto, per esempio 1.234,56 (con il meno davanti se il saldo è sotto zero).', campi: male }
  if (c.iniziale === null || c.finale === null || c.entrate === null || c.uscite === null) return { saldo: null, errore: null, campi: [] }
  const saldo: SaldoBanca = { mese, saldoIniziale: c.iniziale, entrate: c.entrate, uscite: c.uscite, saldoFinale: c.finale }
  const errore = cosaNonVaSaldoBanca(saldo, oggi)
  if (!errore) return { saldo, errore: null, campi: [] }
  return { saldo: null, errore, campi: (['entrate', 'uscite'] as const).filter((k) => (c[k] ?? 0) < 0) }
}

/** Un saldo dell'estratto può essere sotto zero: `centesimi` non vuole il meno, qui si accetta anche quello lungo. */
export function centesimiConSegno(testo: string): number | null {
  const meno = /^\s*[-−]/.test(testo)
  const c = centesimi(testo.replace(/^\s*[-−]/, ''))
  return c === null ? null : meno ? -c : c
}

/**
 * I mesi finiti che chiedono qualcosa, dal più recente, per i segni sulla tessera del Conto Corrente. «Saldo da
 * scrivere» si chiede solo dal primo mese con un saldo scritto, e sempre per l'ultimo finito: prima di cominciare
 * non è un dovere arretrato.
 */
export type SegnoDelConto = { mese: string; stato: StatoQuadratura; tono: 'rosso' | 'giallo' }
export function segniDelConto(q: Pick<Quadratura, 'mese' | 'stato'>[], saldi: SaldoBanca[]): SegnoDelConto[] {
  const primo = saldi.reduce<string | null>((p, s) => (p === null || s.mese < p ? s.mese : p), null)
  const ultimo = q.reduce<string | null>((p, x) => (x.stato !== 'non ancora finito' && (p === null || x.mese > p) ? x.mese : p), null)
  return q
    .flatMap((x): SegnoDelConto[] => {
      if (x.stato === 'non torna' || x.stato === 'cambiato dopo la verifica') return [{ mese: x.mese, stato: x.stato, tono: 'rosso' }]
      if (x.stato === 'CSV del mese mancante' || x.stato === 'da classificare') return [{ mese: x.mese, stato: x.stato, tono: 'giallo' }]
      if (x.stato === 'saldo da scrivere' && (x.mese === ultimo || (primo !== null && x.mese >= primo))) return [{ mese: x.mese, stato: x.stato, tono: 'giallo' }]
      return []
    })
    .sort((a, b) => b.mese.localeCompare(a.mese))
}

/** Il database non ha ancora 123-quadratura-banca.sql: il riquadro lo dice, il resto dell'app va avanti. */
export const mancaSaldoBanca = (e: { code?: string; message?: string } | null | undefined): boolean =>
  !!e && ['42P01', 'PGRST205'].includes(e.code ?? '') && /saldo_banca/.test(e.message ?? '')

export const SENZA_SALDO_BANCA = 'Il conto con la banca non è ancora disponibile: chiedi a chi cura il database di lanciare il file 123-quadratura-banca.sql.'
