import { centesimi, dataRicevuta, euro, type Ricevuta } from './ricevute'
import { piano } from './nomi'
import { csv } from './vestiario'
import { righeDaRicevute, righeDirette, type PagamentoDiretto, type RigaPagamento } from './pagamenti'

/**
 * La contabilità di base, per chi cura i conti (`supabase/59-contabilita.sql`):
 * voci, casse e movimenti, e i conti che se ne fanno. Niente browser, niente
 * database: le schermate e i dati la chiamano, e le prove la leggono sola.
 *
 * Gli incassi degli iscritti non si copiano nei movimenti: si derivano qui dalle
 * righe di PAGAMENTI (ricevute e pagamenti a mano), così un annullo si vede da sé.
 * Importi sempre in centesimi.
 */

export interface Cassa {
  id: string
  nome: string
  saldoIniziale: number
  /** Da questa data si contano i movimenti; vuoto = tutti. */
  dal?: string
}

export interface VoceContabile {
  id: string
  nome: string
  tipo: 'entrata' | 'uscita'
  /** Le due voci degli incassi degli iscritti: non si cambiano. */
  diSistema: boolean
  attiva: boolean
}

/** Un movimento scritto a mano. Un giroconto non ha voce e ha una seconda cassa. */
export interface MovimentoManuale {
  id: string
  tipo: 'entrata' | 'uscita' | 'giroconto'
  data: string
  importo: number
  voceId?: string
  cassaId: string
  cassaAId?: string
  descrizione: string
  nota?: string
  creatoIl: string
  annullatoIl?: string
}

/** Una riga dell'elenco: un movimento a mano o un incasso di un iscritto. */
export interface RigaMovimento {
  id: string
  origine: 'ricevuta' | 'pagamento' | 'movimento'
  tipo: 'entrata' | 'uscita' | 'giroconto'
  data: string
  importo: number
  descrizione: string
  sotto?: string
  voce: string | null
  cassaId: string
  cassaAId?: string
  /** Solo dei movimenti a mano: serve a chi ne corregge il testo, per non perderla. */
  nota?: string
  annullato: boolean
}

export const NOME_CASSA_CONTANTI = 'Cassa Contanti'
export const NOME_CASSA_CONTO = 'Conto Corrente'
export const VOCE_QUOTA = 'Quota associativa'
export const VOCE_CORSI = 'Corsi e altri pagamenti'

/** Contanti in Cassa Contanti, tutto il resto (bonifico, POS, Satispay, assegno) in Conto Corrente. */
export const cassaDelMetodo = (metodo: string): 'contanti' | 'conto' => (metodo.trim().toLowerCase() === 'contanti' ? 'contanti' : 'conto')

/** La voce di sistema di un incasso: la quota associativa, o tutto il resto. */
export const voceDiSistema = (voce: string) => (voce.trim().toLowerCase() === 'quota associativa' ? VOCE_QUOTA : VOCE_CORSI)

/**
 * Gli incassi degli iscritti come movimenti di entrata, uno per pagamento. Sono
 * le righe di PAGAMENTI (`righeDaRicevute`, `righeDirette`): `pagato fino al` e
 * l'anticipo non ci sono, e un annullo resta, segnato annullato.
 */
export function incassiDerivati(righe: RigaPagamento[], casse: Cassa[]): RigaMovimento[] {
  const cassa = (nome: string) => casse.find((c) => c.nome === nome)?.id ?? ''
  return righe.map((r) => ({
    id: `incasso:${r.id}`,
    origine: r.ricevuta ? 'ricevuta' : 'pagamento',
    tipo: 'entrata',
    data: r.data,
    importo: r.importo,
    descrizione: r.chi,
    sotto: `${r.voce} · ${r.metodo}`,
    voce: voceDiSistema(r.voce),
    cassaId: cassa(cassaDelMetodo(r.metodo) === 'contanti' ? NOME_CASSA_CONTANTI : NOME_CASSA_CONTO),
    annullato: r.annullato,
  }))
}

/** L'elenco unico, dal più recente; a parità di giorno per id, così non salta da un giro all'altro. */
export function righeMovimenti(derivati: RigaMovimento[], manuali: MovimentoManuale[], voci: VoceContabile[]): RigaMovimento[] {
  const mie = manuali.map(
    (x): RigaMovimento => ({
      id: x.id,
      origine: 'movimento',
      tipo: x.tipo,
      data: x.data,
      importo: x.importo,
      descrizione: x.descrizione,
      voce: voci.find((v) => v.id === x.voceId)?.nome ?? null,
      cassaId: x.cassaId,
      cassaAId: x.cassaAId,
      nota: x.nota,
      annullato: !!x.annullatoIl,
    }),
  )
  return [...derivati, ...mie].sort((a, b) => b.data.localeCompare(a.data) || a.id.localeCompare(b.id))
}

/** L'elenco della schermata: gli incassi (ricevute e pagamenti a mano, col nome di chi ha pagato) e i movimenti a mano. */
export function elencoMovimenti(
  ricevute: Ricevuta[],
  diretti: PagamentoDiretto[],
  nomi: Array<{ id: string; nome: string; cognome: string }>,
  casse: Cassa[],
  manuali: MovimentoManuale[],
  voci: VoceContabile[],
): RigaMovimento[] {
  const chi = new Map(nomi.map((p) => [p.id, `${p.cognome} ${p.nome}`.trim()]))
  const incassi = [...righeDaRicevute(ricevute), ...righeDirette(diretti, (id) => chi.get(id) ?? '—')]
  return righeMovimenti(incassiDerivati(incassi, casse), manuali, voci)
}

/** Quanti movimenti non annullati usano una voce. */
export const quanteUsate = (righe: RigaMovimento[], voce: VoceContabile): number =>
  righe.filter((r) => r.voce === voce.nome && r.tipo === voce.tipo && !r.annullato).length

export const totaleResidui = (conti: Array<{ residuo: number }>): number => conti.reduce((s, c) => s + c.residuo, 0)

/** Il giorno di oggi a Roma, come lo conta il database: a mezzanotte il browser di chi è altrove può essere un giorno indietro. */
export const oggiARoma = (adesso: Date = new Date()): string => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(adesso)

/**
 * Il residuo di ogni cassa: saldo iniziale + entrate − uscite ± giroconti, dei
 * soli movimenti non annullati dal giorno di partenza. Un giroconto sposta i
 * soldi e non conta come entrata né uscita.
 */
export function residui(casse: Cassa[], righe: RigaMovimento[]): Array<{ cassaId: string; entrate: number; uscite: number; residuo: number }> {
  return casse.map((c) => {
    let entrate = 0
    let uscite = 0
    let giroconti = 0
    for (const r of righe) {
      if (r.annullato || (c.dal && r.data < c.dal)) continue
      if (r.tipo === 'giroconto') {
        if (r.cassaId === c.id) giroconti -= r.importo
        if (r.cassaAId === c.id) giroconti += r.importo
      } else if (r.cassaId === c.id) {
        if (r.tipo === 'entrata') entrate += r.importo
        else uscite += r.importo
      }
    }
    return { cassaId: c.id, entrate, uscite, residuo: c.saldoIniziale + entrate - uscite + giroconti }
  })
}

/** Entrate, uscite e la differenza: i giroconti e gli annullati non contano. */
export function totali(righe: RigaMovimento[]): { entrate: number; uscite: number; differenza: number } {
  const valide = righe.filter((r) => !r.annullato)
  const somma = (tipo: RigaMovimento['tipo']) => valide.filter((r) => r.tipo === tipo).reduce((s, r) => s + r.importo, 0)
  const entrate = somma('entrata')
  const uscite = somma('uscita')
  return { entrate, uscite, differenza: entrate - uscite }
}

export interface FiltroMovimenti {
  testo?: string
  dal?: string
  al?: string
  tipo?: string
  cassaId?: string
  voce?: string
  annullati?: boolean
}

/** I filtri dell'elenco. Gli annullati ci sono solo se li si chiede; un giroconto è di tutte e due le sue casse. */
export function filtraMovimenti(righe: RigaMovimento[], f: FiltroMovimenti): RigaMovimento[] {
  const testo = piano(f.testo ?? '').trim()
  return righe.filter((r) => {
    if (r.annullato && !f.annullati) return false
    if (f.dal && r.data < f.dal) return false
    if (f.al && r.data > f.al) return false
    if (f.tipo && r.tipo !== f.tipo) return false
    if (f.cassaId && r.cassaId !== f.cassaId && r.cassaAId !== f.cassaId) return false
    if (f.voce && r.voce !== f.voce) return false
    return !testo || piano(`${r.descrizione} ${r.sotto ?? ''}`).includes(testo)
  })
}

/** I totali per voce, le entrate prima e in ciascun gruppo la più grande: senza giroconti e annullati. */
export function perVoce(righe: RigaMovimento[]): Array<{ voce: string; tipo: 'entrata' | 'uscita'; totale: number }> {
  const gruppi = new Map<string, { voce: string; tipo: 'entrata' | 'uscita'; totale: number }>()
  for (const r of righe) {
    if (r.annullato || r.tipo === 'giroconto' || !r.voce) continue
    const chiave = `${r.tipo}|${r.voce}`
    const g = gruppi.get(chiave) ?? { voce: r.voce, tipo: r.tipo, totale: 0 }
    g.totale += r.importo
    gruppi.set(chiave, g)
  }
  return [...gruppi.values()].sort((a, b) => (a.tipo === b.tipo ? b.totale - a.totale : a.tipo === 'entrata' ? -1 : 1))
}

/** Il foglio per Excel e per il commercialista: come quello di PAGAMENTI, senza gli annullati e con l'importo senza segno (il tipo dice se esce). */
export function csvMovimenti(righe: RigaMovimento[], casse: Cassa[]): string {
  const nome = (id?: string) => casse.find((c) => c.id === id)?.nome ?? ''
  return csv([
    ['data', 'tipo', 'descrizione', 'voce', 'cassa', 'importo'],
    ...righe
      .filter((r) => !r.annullato)
      .map((r) => [dataRicevuta(r.data), r.tipo, r.descrizione, r.voce ?? '', r.tipo === 'giroconto' ? `${nome(r.cassaId)} → ${nome(r.cassaAId)}` : nome(r.cassaId), euro(r.importo)]),
  ])
}

// Gli stessi rifiuti delle funzioni di 59-contabilita.sql, detti subito sotto al modulo.

/** Una data vera (non il 30 febbraio) in forma `AAAA-MM-GG`. */
const dataVera = (data: string) => {
  const giorno = /^\d{4}-\d{2}-\d{2}$/.test(data) ? new Date(`${data}T00:00:00Z`) : null
  return !!giorno && !Number.isNaN(giorno.getTime()) && giorno.toISOString().slice(0, 10) === data
}

/** Importo, data e nota: quello che un movimento e un giroconto hanno in comune. */
function cosaNonVaIlComune(importo: number, data: string, nota: string | undefined, oggi: string): string | null {
  if (!Number.isInteger(importo)) return 'L’importo non si capisce'
  if (importo <= 0) return 'L’importo deve essere più di zero'
  if (importo > 10_000_000) return 'L’importo è troppo alto: controlla le cifre'
  if (!dataVera(data) || data < '2000-01-01') return 'La data non si capisce'
  if (data > oggi) return 'La data è nel futuro: si registra quel che è già successo'
  if ((nota ?? '').trim().length > 300) return 'La nota è troppo lunga: al massimo 300 caratteri'
  return null
}

/** L'importo scritto in un campo: vuoto non è ancora un errore, un testo che non è un numero sì. */
export function cosaNonVaImporto(testo: string, esempio: string): string | null {
  if (testo === '' || centesimi(testo) !== null) return null
  return `L’importo non si capisce: scrivi un numero, per esempio ${esempio}.`
}

export interface DatiMovimento {
  tipo: string
  data: string
  importo: number
  voceId?: string
  cassaId: string
  descrizione: string
  nota?: string
}

export function cosaNonVaMovimento(d: DatiMovimento, voci: VoceContabile[], casse: Cassa[], oggi: string): string | null {
  if (d.tipo !== 'entrata' && d.tipo !== 'uscita') return 'Scegli se è un’entrata o un’uscita'
  const comune = cosaNonVaIlComune(d.importo, d.data, d.nota, oggi)
  if (comune) return comune
  const voce = voci.find((v) => v.id === d.voceId)
  if (!voce) return 'Scegli la voce'
  if (voce.tipo !== d.tipo) return 'La voce scelta non va con questo tipo di movimento'
  if (!voce.attiva) return 'La voce non è più in uso: scegline un’altra'
  const cassa = casse.find((c) => c.id === d.cassaId)
  if (!cassa) return 'Scegli la cassa'
  if (cassa.dal && d.data < cassa.dal) return 'La data è prima dell’inizio della cassa'
  if (!d.descrizione.trim()) return 'Scrivi una descrizione'
  if (d.descrizione.trim().length > 200) return 'La descrizione è troppo lunga: al massimo 200 caratteri'
  return null
}

export interface DatiGiroconto {
  daCassaId: string
  aCassaId: string
  data: string
  importo: number
  nota?: string
}

export function cosaNonVaGiroconto(d: DatiGiroconto, casse: Cassa[], oggi: string): string | null {
  const da = casse.find((c) => c.id === d.daCassaId)
  const a = casse.find((c) => c.id === d.aCassaId)
  if (!da || !a) return 'Scegli le due casse'
  if (da.id === a.id) return 'Scegli due casse diverse'
  const comune = cosaNonVaIlComune(d.importo, d.data, d.nota, oggi)
  if (comune) return comune
  if ((da.dal && d.data < da.dal) || (a.dal && d.data < a.dal)) return 'La data è prima dell’inizio della cassa'
  return null
}

/** Per rinominare una voce si passa l'elenco senza quella voce: il nome suo non è un doppione. */
export function cosaNonVaVoce(nome: string, tipo: string | undefined, voci: VoceContabile[]): string | null {
  const n = nome.trim()
  if (!n) return 'Scrivi il nome della voce'
  if (n.length > 60) return 'Il nome della voce è troppo lungo: al massimo 60 caratteri'
  if (tipo !== 'entrata' && tipo !== 'uscita') return 'Scegli se è un’entrata o un’uscita'
  if (voci.some((v) => v.tipo === tipo && v.nome.trim().toLowerCase() === n.toLowerCase())) return `C’è già una voce «${n}» tra le ${tipo === 'entrata' ? 'entrate' : 'uscite'}`
  return null
}

/** Il giorno del primo movimento a mano non annullato di una cassa (anche come seconda cassa di un giroconto): gli incassi degli iscritti non contano, come nel database. */
export function primoMovimentoManuale(righe: RigaMovimento[], cassaId: string): string | undefined {
  return righe
    .filter((r) => r.origine === 'movimento' && !r.annullato && (r.cassaId === cassaId || r.cassaAId === cassaId))
    .map((r) => r.data)
    .sort()[0]
}

/** `contesto` c'è dove si salva davvero (non basta una data vera: oggi e movimenti già registrati contano). */
export function cosaNonVaSaldo(saldo: number, dal?: string | null, contesto?: { oggi: string; primoMovimento?: string }): string | null {
  if (!Number.isInteger(saldo)) return 'Il saldo iniziale non si capisce'
  if (saldo < 0) return 'Il saldo iniziale non può essere negativo'
  if (saldo > 100_000_000) return 'Il saldo iniziale è troppo alto: controlla le cifre'
  if (dal && !dataVera(dal)) return 'La data non si capisce'
  if (dal && contesto) {
    if (dal > contesto.oggi) return 'L’inizio della cassa non può essere nel futuro'
    if (contesto.primoMovimento && contesto.primoMovimento < dal) return 'Ci sono movimenti prima di quella data: annullali o scegli una data più vecchia'
  }
  return null
}
