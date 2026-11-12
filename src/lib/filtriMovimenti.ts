import { estrattoConto, filtraMovimenti, type Cassa, type EstrattoConto, type RigaMovimento } from './contabilita'
import { VOCE_DA_CLASSIFICARE } from './importaPrimaNota'
import { soldi } from './satispay'
import { senzaPersona, type EsitoCollegamento } from './movimentiPersona'

/**
 * I filtri di CONTABILITÀ › MOVIMENTI: il periodo a mese e anno, MOSTRA, TIPO e VOCE.
 * Stanno in un file loro e non in `contabilita.ts` perché guardano anche le persone
 * (`movimentiPersona` importa da `contabilita`: lì farebbero un giro).
 */

export type Mostra = 'da_assegnare' | 'tutti' | 'annullati'

export interface FiltriElenco {
  testo: string
  /** 1–12; 0 = tutti i mesi dell'anno. */
  mese: number
  /** 0 = tutti gli anni (e allora anche tutti i mesi). */
  anno: number
  mostra: Mostra
  tipo: '' | 'entrata' | 'uscita'
  /** Il nome della voce; '' = tutte. */
  voce: string
}

/** Quel che serve per dire «da assegnare» oltre alla riga: i movimenti con soldi ancora da assegnare e gli esiti del collegamento. */
export interface ContestoAssegna {
  ids: Set<string>
  esiti: Record<string, EsitoCollegamento | undefined>
}

const NOMI_MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre']
export const nomeMese = (m: number) => NOMI_MESI[m - 1] ?? ''

const meseDi = (data: string) => ({ mese: Number(data.slice(5, 7)), anno: Number(data.slice(0, 4)) })

/** La partenza: il mese corrente, quel che si guarda quasi sempre. */
export const filtriIniziali = (oggi: string): FiltriElenco => ({ testo: '', ...meseDi(oggi), mostra: 'tutti', tipo: '', voce: '' })

const due = (n: number) => String(n).padStart(2, '0')

export function intervalloFiltri(f: Pick<FiltriElenco, 'mese' | 'anno'>): { dal: string; al: string } {
  if (!f.anno) return { dal: '', al: '' }
  if (!f.mese) return { dal: `${f.anno}-01-01`, al: `${f.anno}-12-31` }
  // Il giorno 0 del mese dopo è l'ultimo di questo: febbraio bisestile compreso.
  const ultimo = new Date(Date.UTC(f.anno, f.mese, 0)).getUTCDate()
  return { dal: `${f.anno}-${due(f.mese)}-01`, al: `${f.anno}-${due(f.mese)}-${due(ultimo)}` }
}

/** Un menu del periodo cambiato. «Tutti gli anni» toglie il mese; un mese senza anno vuol dire quello di quest'anno. */
export function conPeriodo(f: FiltriElenco, x: { mese?: number; anno?: number }, oggi: string): FiltriElenco {
  if (x.anno !== undefined) return { ...f, anno: x.anno, mese: x.anno ? f.mese : 0 }
  const mese = x.mese ?? f.mese
  return { ...f, mese, anno: mese && !f.anno ? meseDi(oggi).anno : f.anno }
}

export function spostaMese(f: FiltriElenco, dir: 1 | -1): FiltriElenco {
  const n = f.anno * 12 + (f.mese - 1) + dir
  return { ...f, anno: Math.floor(n / 12), mese: (n % 12) + 1 }
}

/** Le frecce valgono solo su un mese preciso, e › non va oltre il mese corrente: dopo non c'è niente. */
export function puoSpostare(f: FiltriElenco, dir: 1 | -1, oggi: string): boolean {
  if (!f.mese || !f.anno) return false
  const o = meseDi(oggi)
  return dir < 0 || f.anno * 12 + f.mese < o.anno * 12 + o.mese
}

/** Gli anni del menu ANNO: quelli con movimenti, dal più recente, e sempre quello corrente. */
export function anniConMovimenti(righe: Pick<RigaMovimento, 'data'>[], oggi: string): number[] {
  return [...new Set([meseDi(oggi).anno, ...righe.map((r) => meseDi(r.data).anno)])].filter(Boolean).sort((a, b) => b - a)
}

export function testoConto(n: number, f: Pick<FiltriElenco, 'mese' | 'anno'>): string {
  const quanti = `${n} ${n === 1 ? 'movimento' : 'movimenti'}`
  if (!f.anno) return `${quanti} in tutto`
  if (!f.mese) return `${quanti} nel ${f.anno}`
  // «ad aprile», «ad agosto», come il menu di PRESENZE (ore.ts).
  const nome = nomeMese(f.mese)
  return `${quanti} ${nome.startsWith('a') ? 'ad' : 'a'} ${nome} ${f.anno}`
}

/** Da assegnare: manca la persona (una quota o un corso senza, uno storico con più omonimi), restano soldi da assegnare, o la voce è da classificare. */
export function daAssegnare(r: RigaMovimento, ctx: ContestoAssegna): boolean {
  if (r.annullato) return false
  return senzaPersona(r) || (!r.personaId && ctx.esiti[r.id] === 'omonimi') || ctx.ids.has(r.id) || r.voce === VOCE_DA_CLASSIFICARE
}

const passaMostra = (r: RigaMovimento, mostra: Mostra, ctx: ContestoAssegna) =>
  mostra === 'annullati' ? !!r.annullato : mostra === 'da_assegnare' ? daAssegnare(r, ctx) : !r.annullato

export const filtraMostra = (righe: RigaMovimento[], mostra: Mostra, ctx: ContestoAssegna) => righe.filter((r) => passaMostra(r, mostra, ctx))

/** Da assegnare guarda tutto lo storico: una quota senza persona di marzo non deve restare nascosta dal mese. */
export const conMostra = (f: FiltriElenco, mostra: Mostra): FiltriElenco => (mostra === 'da_assegnare' ? { ...f, mostra, mese: 0, anno: 0 } : { ...f, mostra })

/** Il menu VOCE: le voci che i movimenti hanno davvero (anche lo storico e quelle spente), del TIPO scelto. */
export function vociDelFiltro(righe: Pick<RigaMovimento, 'tipo' | 'voce'>[], tipo: FiltriElenco['tipo']): string[] {
  const nomi = righe.flatMap((r) => (r.voce && (r.tipo === 'entrata' || r.tipo === 'uscita') && (!tipo || r.tipo === tipo) ? [r.voce] : []))
  return [...new Set(nomi)].sort((a, b) => a.localeCompare(b, 'it'))
}

/** TIPO cambiato: una voce che con quel tipo non c'è si toglie, se no l'elenco resta vuoto senza dire perché. */
export function conTipo(righe: Pick<RigaMovimento, 'tipo' | 'voce'>[], f: FiltriElenco, tipo: FiltriElenco['tipo']): FiltriElenco {
  return { ...f, tipo, voce: f.voce && !vociDelFiltro(righe, tipo).includes(f.voce) ? '' : f.voce }
}

/**
 * Un movimento appena scritto che i filtri nascondono: la schermata lo dice, se no sembra perso.
 * Senza il contesto: di un movimento nuovo si sa solo se è senza persona o da classificare.
 */
export function nonSiVedra(r: RigaMovimento, f: FiltriElenco): boolean {
  if (f.mostra === 'annullati') return true
  if (f.mostra === 'da_assegnare' && !daAssegnare(r, { ids: new Set(), esiti: {} })) return true
  return filtraMovimenti([r], { ...intervalloFiltri(f), testo: f.testo, tipo: f.tipo, voce: f.voce }).length === 0
}

/** Il tasto «Mostralo»: il mese del movimento, con tutti i movimenti. */
export const filtriPer = (r: Pick<RigaMovimento, 'data'>): FiltriElenco => ({ testo: '', ...meseDi(r.data), mostra: 'tutti', tipo: '', voce: '' })

/**
 * L'estratto conto con MOSTRA: il saldo resta quello vero delle casse, MOSTRA nasconde righe.
 * Gli annullati sono in elenco ma valgono zero, quindi i loro totali sono zero.
 */
export function estrattoMostra(righe: RigaMovimento[], casse: Cassa[], f: FiltriElenco, ctx: ContestoAssegna): EstrattoConto {
  const e = estrattoConto(righe, casse, { ...intervalloFiltri(f), testo: f.testo, tipo: f.tipo, voce: f.voce, annullati: f.mostra === 'annullati' })
  const viste = e.righe.filter((x) => passaMostra(x.riga, f.mostra, ctx))
  return { ...e, righe: viste, entrate: viste.reduce((s, x) => s + x.entrata, 0), uscite: viste.reduce((s, x) => s + x.uscita, 0) }
}

/** Il segno solo se c'è una cifra: «− 0,00 €» non vuol dire niente. */
const conSegno = (segno: '+' | '−', c: number) => (c ? `${segno} ${soldi(c)}` : soldi(c))
const saldo = (c: number) => (c < 0 ? `− ${soldi(-c)}` : soldi(c))

/**
 * La striscia sopra l'elenco. I saldi sono delle casse, entrate e uscite delle righe
 * viste: con MOSTRA, TIPO o una ricerca insieme non tornerebbero, quindi restano
 * solo entrate e uscite.
 */
export function striscia(e: EstrattoConto, f: FiltriElenco): { nome: string; cifra: string; entrata?: boolean }[] {
  const righe = [
    { nome: 'ENTRATE', cifra: conSegno('+', e.entrate), entrata: e.entrate > 0 },
    { nome: 'USCITE', cifra: conSegno('−', e.uscite) },
  ]
  if (f.mostra !== 'tutti' || f.tipo || f.voce || f.testo.trim()) return righe
  return [{ nome: 'SALDO INIZIALE', cifra: saldo(e.saldoIniziale) }, ...righe, { nome: 'SALDO FINALE', cifra: saldo(e.saldoFinale) }]
}
