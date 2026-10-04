/**
 * Le lezioni fatte da un istruttore in un mese, per il compenso: lo stesso
 * conto nella scheda PRESENZE della segreteria e in LE MIE ORE
 * dell'istruttore, così al banco si guardano gli stessi numeri.
 *
 * Contano solo le presenze confermate; le ore vengono dall'orario della
 * lezione, non da quando si è entrati. Da confermare sono le presenze ancora
 * da decidere e le lezioni tenute in cui era previsto e nessuno si è segnato
 * (23-istruttori-dalle-lezioni.sql).
 */
import type { LezioneSenzaIstruttore, PresenzaIstruttoreSeg } from './segreteria'
import { chiaveGiorno } from './sala'

const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre']

/** I dodici mesi fino a questo, dal più recente. */
export function mesi() {
  const oggi = new Date()
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(oggi.getFullYear(), oggi.getMonth() - i, 1)
    return { chiave: `${d.getFullYear()}-${d.getMonth()}`, da: d, a: new Date(d.getFullYear(), d.getMonth() + 1, 0), nome: `${MESI[d.getMonth()]} ${d.getFullYear()}` }
  })
}

export const minutiDi = (x: { inizio: string; fine: string }) => Math.round((Date.parse(x.fine) - Date.parse(x.inizio)) / 60_000)

/** In ore coi decimali, all'italiana: «1,5», per moltiplicarle per la paga oraria. */
export const oreItaliane = (minuti: number) => (minuti / 60).toLocaleString('it-IT', { maximumFractionDigits: 2 })

/** Quel che serve del conto: l'istruttore non legge come la segreteria nome e previsti. */
export type MiaPresenza = Pick<PresenzaIstruttoreSeg, 'id' | 'sessioneId' | 'corso' | 'inizio' | 'fine' | 'personaId' | 'stato' | 'prevista' | 'gestitaDa' | 'gestitaIl'>

/**
 * Il mese di una persona. Si filtra qui anche chi è: chi è di segreteria e
 * insegna legge dal database le presenze di tutti.
 */
export function delMese<P extends MiaPresenza>(presenze: P[], senzaIstruttore: LezioneSenzaIstruttore[], personaId: string, mese: { da: Date; a: Date }) {
  const da = chiaveGiorno(mese.da)
  const a = chiaveGiorno(mese.a)
  // Il mese è quello della lezione, nel giorno di qui: non quando è stata decisa.
  const dentro = (inizio: string) => {
    const g = chiaveGiorno(new Date(inizio))
    return g >= da && g <= a
  }
  const righe = presenze.filter((x) => x.personaId === personaId && dentro(x.inizio)).sort((x, y) => x.inizio.localeCompare(y.inizio))
  const confermate = righe.filter((x) => x.stato === 'confermata')
  const nonSegnate = senzaIstruttore
    .filter((l) => dentro(l.inizio) && l.previsti.some((x) => x.id === personaId && !x.stato))
    .sort((x, y) => x.inizio.localeCompare(y.inizio))
  const perCorso = [...new Set(confermate.map((x) => x.corso))]
    .map((corso) => {
      const xs = confermate.filter((x) => x.corso === corso)
      return { corso, xs, lezioni: xs.length, minuti: xs.reduce((t, x) => t + minutiDi(x), 0) }
    })
    .sort((x, y) => x.corso.localeCompare(y.corso, 'it'))
  return {
    righe,
    confermate,
    minuti: confermate.reduce((t, x) => t + minutiDi(x), 0),
    daConfermare: righe.filter((x) => x.stato === 'da_confermare').length + nonSegnate.length,
    nonSegnate,
    perCorso,
  }
}

/** Una riga di `lezioni_senza_istruttore` come la dà il database. */
interface RigaSenzaIstruttore {
  sessione_id: string
  corso: string
  colore: string | null
  inizio: string
  fine: string
  sala: string | null
  presenti: number
  previsti: Array<{ id: string; nome: string; cognome: string; stato: PresenzaIstruttoreSeg['stato'] | null }> | null
}

/**
 * Le lezioni tenute senza segno, dalla risposta del database: le stesse per
 * la segreteria e per LE MIE ORE, così i due DA CONFERMARE non si separano.
 * Con `soloDi`, solo quelle dove quella persona è prevista: la segreteria che
 * insegna le riceve tutte. Prima di 37-mie-ore.sql un istruttore riceve
 * «permesso negato»: per lui non ce ne sono. Ogni altro errore si dice.
 */
export function daSenzaIstruttore(r: { data: unknown; error: { code?: string; message: string } | null }, soloDi?: string): LezioneSenzaIstruttore[] {
  if (r.error?.code === '42501' && soloDi) return []
  if (r.error) throw r.error
  // La forma la dice la funzione SQL: il client non ha tipi generati.
  return ((r.data ?? []) as RigaSenzaIstruttore[])
    .filter((x) => !soloDi || (x.previsti ?? []).some((p) => p.id === soloDi))
    .map((x) => ({
      sessioneId: x.sessione_id,
      corso: x.corso,
      colore: x.colore ?? undefined,
      inizio: x.inizio,
      fine: x.fine,
      sala: x.sala ?? undefined,
      presenti: x.presenti,
      previsti: (x.previsti ?? []).map((p) => ({ id: p.id, nome: `${p.nome} ${p.cognome}`.trim(), stato: p.stato ?? undefined })),
    }))
}
