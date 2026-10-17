import { conti, dataRicevuta, euro, METODI, QUOTA, type Ricevuta } from './ricevute'
import { piano } from './nomi'
import { csv } from './vestiario'

/**
 * Lo storico dei pagamenti: i pagamenti dentro le ricevute e quelli registrati
 * a mano senza ricevuta (`supabase/54-pagamenti-diretti.sql`), nella scheda di
 * una persona e nella pagina PAGAMENTI. Importi in centesimi.
 */

/** Un pagamento fatto a mano, senza ricevuta: in palestra, in contanti, prima dell'app. */
export interface PagamentoDiretto {
  id: string
  personaId: string
  /** `AAAA-MM-GG`. */
  data: string
  /** Centesimi. */
  importo: number
  metodo: string
  /** A cosa serve: QUOTA ASSOCIATIVA, un corso, ALTRO. */
  voce: string
  nota?: string
  creatoIl: string
  annullatoIl?: string
}

export type DatiPagamentoDiretto = Omit<PagamentoDiretto, 'id' | 'creatoIl' | 'annullatoIl'>

/** Una riga dello storico: un pagamento, di una ricevuta o fatto a mano. */
export interface RigaPagamento {
  id: string
  data: string
  importo: number
  metodo: string
  voce: string
  personaId?: string
  /** «Cognome Nome». */
  chi: string
  /** Senza: è un pagamento fatto a mano. */
  ricevuta?: { id: string; anno: number; numero: number }
  direttoId?: string
  nota?: string
  annullato: boolean
}

/** Minuscolo e senza accenti: «Zoë» e «zoe» sono la stessa parola. */
const semplice = (t: string) => piano(t).trim()

/** I modi di pagare che la segreteria sceglie, nel modulo e nei filtri: quelli delle ricevute e Satispay. */
export const METODI_A_MANO = [...METODI, 'Satispay']

/** Gli stessi rifiuti di `registra_pagamento_diretto`, per dirli subito sotto al modulo. */
export function cosaNonVaDiretto(d: DatiPagamentoDiretto): string | null {
  if (!d.personaId) return 'Manca la persona'
  // Una data vera (non il 30 febbraio) fra il 2000 e il 2100, come `registra_pagamento_diretto`.
  const giorno = /^\d{4}-\d{2}-\d{2}$/.test(d.data) ? new Date(`${d.data}T00:00:00Z`) : null
  if (!giorno || Number.isNaN(giorno.getTime()) || giorno.toISOString().slice(0, 10) !== d.data) return 'La data del pagamento non si capisce'
  if (d.data < '2000-01-01' || d.data > '2100-12-31') return 'La data del pagamento non torna'
  if (!Number.isInteger(d.importo)) return 'L’importo non si capisce'
  if (d.importo <= 0) return 'L’importo deve essere più di zero'
  if (d.importo > 10_000_000) return 'L’importo è troppo alto: controlla le cifre'
  if (!d.metodo.trim()) return 'Scegli come ha pagato'
  if (d.metodo.trim().length > 40) return 'Il modo di pagamento è troppo lungo'
  if (!d.voce.trim()) return 'Scrivi a cosa serve il pagamento'
  if (d.voce.trim().length > 120) return 'La voce è troppo lunga'
  if ((d.nota ?? '').length > 300) return 'La nota è troppo lunga: al massimo 300 caratteri'
  return null
}

const nomeIntestatario = (r: Ricevuta) => `${r.intestatario.cognome} ${r.intestatario.nome}`.trim()

/** Una riga per ogni pagamento delle voci; le righe di una ricevuta annullata sono annullate. L'anticipo non è una riga: è denaro dato prima. */
export const righeDaRicevute = (ricevute: Ricevuta[]): RigaPagamento[] =>
  ricevute.flatMap((r) =>
    r.voci.flatMap((v, i) =>
      v.pagamenti.map((p, j): RigaPagamento => ({
        id: `${r.id}:${i}:${j}`,
        data: p.data,
        importo: p.importo,
        metodo: p.metodo,
        voce: v.descrizione,
        personaId: r.personaId,
        chi: nomeIntestatario(r),
        ricevuta: { id: r.id, anno: r.anno, numero: r.numero },
        annullato: !!r.annullataIl,
      })),
    ),
  )

export const righeDirette = (diretti: PagamentoDiretto[], nomeDi: (personaId: string) => string): RigaPagamento[] =>
  diretti.map((x) => ({
    id: `diretto:${x.id}`,
    data: x.data,
    importo: x.importo,
    metodo: x.metodo,
    voce: x.voce,
    personaId: x.personaId,
    chi: nomeDi(x.personaId),
    direttoId: x.id,
    nota: x.nota,
    annullato: !!x.annullatoIl,
  }))

/** Dal più recente; a pari data, la ricevuta col numero più alto. */
export const inOrdine = (righe: RigaPagamento[]): RigaPagamento[] =>
  [...righe].sort((a, b) => b.data.localeCompare(a.data) || (b.ricevuta?.anno ?? 0) - (a.ricevuta?.anno ?? 0) || (b.ricevuta?.numero ?? 0) - (a.ricevuta?.numero ?? 0))

/** Quanto è stato pagato: le annullate non contano. */
export const totalePagato = (righe: RigaPagamento[]): number => righe.reduce((s, r) => (r.annullato ? s : s + r.importo), 0)

export interface FiltroPagamenti {
  /** Un nome, o un numero di ricevuta («12» o «12/2026»). */
  testo?: string
  dal?: string
  al?: string
  metodo?: string
  soloSenzaRicevuta?: boolean
  /** Mostra anche le annullate (di base no). */
  annullati?: boolean
}

const NUMERO_RICEVUTA = /^(\d+)(?:\/(\d{4}))?$/

/** Se `testo` (già semplificato) è di questa persona o di questa ricevuta. */
function corrisponde(testo: string, chi: string, ricevuta?: { anno: number; numero: number }): boolean {
  if (!testo) return true
  const numero = NUMERO_RICEVUTA.exec(testo)
  // Un numero cerca fra le ricevute, esatto: «12» non è «112».
  if (numero) return !!ricevuta && ricevuta.numero === Number(numero[1]) && (!numero[2] || ricevuta.anno === Number(numero[2]))
  // Nome e cognome in qualunque ordine: ogni parola scritta deve esserci.
  const nome = semplice(chi)
  return testo.split(/\s+/).every((parola) => nome.includes(parola))
}

export function filtra(righe: RigaPagamento[], f: FiltroPagamenti): RigaPagamento[] {
  const testo = semplice(f.testo ?? '')
  const metodo = semplice(f.metodo ?? '')
  return righe.filter((r) => {
    if (r.annullato && !f.annullati) return false
    if (f.dal && r.data < f.dal) return false
    if (f.al && r.data > f.al) return false
    if (metodo && semplice(r.metodo) !== metodo) return false
    if (f.soloSenzaRicevuta && r.ricevuta) return false
    return corrisponde(testo, r.chi, r.ricevuta)
  })
}

const giorno = (d: Date) => d.toISOString().slice(0, 10)

/** Primo e ultimo giorno del mese di `oggi`, spostato di `scarto` mesi (-1: il mese scorso). */
export function intervalloMese(oggi: string, scarto: number): { dal: string; al: string } {
  const anno = Number(oggi.slice(0, 4))
  const mese = Number(oggi.slice(5, 7)) - 1 + scarto
  return { dal: giorno(new Date(Date.UTC(anno, mese, 1))), al: giorno(new Date(Date.UTC(anno, mese + 1, 0))) }
}

/** Il periodo scelto in PAGAMENTI, come primo e ultimo giorno; `date` sono quelle scritte, una vuota è nessun limite. */
export function intervalloDi(periodo: 'mese' | 'scorso' | 'anno' | 'tutto' | 'date', oggi: string, dal: string, al: string): { dal?: string; al?: string } {
  if (periodo === 'mese') return intervalloMese(oggi, 0)
  if (periodo === 'scorso') return intervalloMese(oggi, -1)
  if (periodo === 'anno') return intervalloAnno(oggi)
  if (periodo === 'date') return { ...(dal && { dal }), ...(al && { al }) }
  return {}
}

/** I suggerimenti di A COSA SERVE: la quota, annuale e trimestre di ogni corso, altro. */
export const vociSuggerite = (corsi: string[]): string[] => [QUOTA, ...corsi.flatMap((c) => [`ANNUALE ${c.toUpperCase()}`, `TRIMESTRE ${c.toUpperCase()}`]), 'ALTRO']

export const intervalloAnno = (oggi: string): { dal: string; al: string } => ({ dal: `${oggi.slice(0, 4)}-01-01`, al: `${oggi.slice(0, 4)}-12-31` })

/** Una ricevuta non annullata a cui manca ancora qualcosa. */
export interface Residuo {
  ricevuta: Ricevuta
  chi: string
  /** Centesimi. */
  manca: number
}

/** Dalla ricevuta con più da pagare; le annullate e le saldate non ci sono. */
export const daIncassare = (ricevute: Ricevuta[]): Residuo[] =>
  ricevute
    .filter((r) => !r.annullataIl)
    .map((r) => ({ ricevuta: r, chi: nomeIntestatario(r), manca: conti(r).netto }))
    .filter((x) => x.manca > 0)
    .sort((a, b) => b.manca - a.manca)

/** Chi deve ancora pagare, cercato per nome o per numero di ricevuta come in `filtra`. */
export const filtraResidui = (residui: Residuo[], testo: string): Residuo[] => {
  const t = semplice(testo)
  return residui.filter((x) => corrisponde(t, x.chi, x.ricevuta))
}

/** I numeri in cima a PAGAMENTI: sui pagamenti trovati (le annullate non contano) e sulle ricevute da incassare. */
export function riepilogo(trovate: RigaPagamento[], ricevute: Ricevuta[]) {
  const validi = trovate.filter((x) => !x.annullato)
  const residui = daIncassare(ricevute)
  const totale = totalePagato(validi)
  const contanti = totalePagato(validi.filter((x) => semplice(x.metodo) === 'contanti'))
  return {
    totale,
    contanti,
    pagamenti: validi.length,
    senzaRicevuta: validi.filter((x) => !x.ricevuta).length,
    daIncassare: residui.reduce((s, x) => s + x.manca, 0),
    ricevuteDaIncassare: residui.length,
  }
}

/** Quanto è stato pagato e quanto manca, per la scheda: ricevute (anticipo compreso) e pagamenti a mano. Le annullate non contano. */
export function riassunto(ricevute: Ricevuta[], diretti: PagamentoDiretto[]): { pagato: number; manca: number } {
  const valide = ricevute.filter((r) => !r.annullataIl)
  const dalleRicevute = valide.reduce((s, r) => s + conti(r).pagato + r.anticipo, 0)
  const aMano = diretti.reduce((s, x) => (x.annullatoIl ? s : s + x.importo), 0)
  return { pagato: dalleRicevute + aMano, manca: valide.reduce((s, r) => s + conti(r).netto, 0) }
}

/** Il foglio per il commercialista (punto e virgola, importi all'italiana); le annullate non ci sono. */
export const csvPagamenti = (righe: RigaPagamento[]): string =>
  csv([
    ['data', 'chi', 'a cosa serve', 'come', 'ricevuta', 'importo', 'nota'],
    ...righe
      .filter((r) => !r.annullato)
      .map((r) => [dataRicevuta(r.data), r.chi, r.voce, r.metodo, r.ricevuta ? `${r.ricevuta.numero}/${r.ricevuta.anno}` : '', euro(r.importo), r.nota ?? '']),
  ])
