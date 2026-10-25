// Le chiusure della palestra (118-chiusure.sql): Natale, Pasqua, un ponte.
// Qui le regole che l'app dice prima di chiudere; il database le ripete.
import { chiaveGiorno, giornoPerEsteso, oraDi } from './sala'

export interface Chiusura {
  id: string
  dal: string
  al: string
  /** `null`: tutte le sale. */
  salaId: string | null
  /** Quante lezioni ha annullato. */
  lezioni: number
}

export interface ContoChiusura {
  lezioni: number
  straordinarie: number
  /** Le lezioni con almeno una presenza o una prova, per data. */
  conAppello: Array<{ corso: string; inizio: string; prova: boolean }>
}

const giorno = (g: string) => new Date(g + 'T12:00:00')
const esiste = (g: string) => /^\d{4}-\d{2}-\d{2}$/.test(g) && chiaveGiorno(giorno(g)) === g
const unAnnoDopo = (g: string) => String(Number(g.slice(0, 4)) + 1) + g.slice(4)

/** Perché il periodo non va, o `null`. Un anno al massimo, come il vincolo del database. */
export function cosaNonVaChiusura(dal: string, al: string): string | null {
  if (!dal || !esiste(dal)) return 'Scegli il primo giorno della chiusura.'
  if (!al || !esiste(al)) return "Scegli l'ultimo giorno della chiusura."
  if (al < dal) return "L'ultimo giorno viene prima del primo: correggi le date."
  if (al > unAnnoDopo(dal)) return 'Una chiusura dura al massimo un anno: accorcia il periodo.'
  return null
}

/** «dal 24 dicembre al 6 gennaio», «il 24 dicembre»: l'anno solo per un anno preciso, se no i due giorni si confondono. */
export function periodoInLettere(dal: string, al: string): string {
  const conAnno = dal !== al && dal.slice(5) === al.slice(5)
  const scrivi = (g: string) => giorno(g).toLocaleDateString('it-IT', conAnno ? { day: 'numeric', month: 'long', year: 'numeric' } : { day: 'numeric', month: 'long' })
  return dal === al ? `il ${scrivi(dal)}` : `dal ${scrivi(dal)} al ${scrivi(al)}`
}

export const nelPassato = (dal: string, oggi: string) => dal < oggi

/** I giorni del periodo in cui le lezioni non ci sono ancora: nasceranno già annullate. */
export function giorniOltreIlCalendario(dal: string, al: string, prontoFino: string | null): string[] {
  const x: string[] = []
  for (const d = giorno(dal); chiaveGiorno(d) <= al; d.setDate(d.getDate() + 1)) {
    const g = chiaveGiorno(d)
    if (!prontoFino || g > prontoFino) x.push(g)
  }
  return x
}

export function chiusureDellaSettimana(chiusure: Chiusura[], lunedi: Date): Chiusura[] {
  const domenica = new Date(lunedi)
  domenica.setDate(domenica.getDate() + 6)
  const da = chiaveGiorno(lunedi)
  const a = chiaveGiorno(domenica)
  return chiusure.filter((c) => c.dal <= a && c.al >= da)
}

/** La chiusura che copre una lezione di quel giorno in quella sala: di tutte le sale, o proprio di quella. */
export function chiusoIl(chiusure: Chiusura[], giorno: string, salaId: string | null): Chiusura | null {
  return chiusure.find((c) => c.dal <= giorno && giorno <= c.al && (c.salaId === null || c.salaId === salaId)) ?? null
}

const lezioni = (n: number, verbo: string) => (n === 1 ? `1 lezione ${verbo}a` : `${n} lezioni ${verbo}e`)

export function testoConferma(conto: ContoChiusura, dal: string, al: string, nomeSala: string | null): { titolo: string; righe: string[] } {
  const quante = conto.lezioni === 0 ? "Non c'è nessuna lezione da annullare." : conto.lezioni === 1 ? 'Si annulla 1 lezione.' : `Si annullano ${conto.lezioni} lezioni.`
  const righe: string[] = []
  if (nomeSala) righe.push(`Solo la sala ${nomeSala}: le altre sale restano aperte.`)
  if (conto.straordinarie) righe.push(conto.straordinarie === 1 ? 'Fra queste c’è 1 lezione straordinaria.' : `Fra queste ci sono ${conto.straordinarie} lezioni straordinarie.`)
  for (const l of conto.conAppello) righe.push(`${l.corso}, ${giornoPerEsteso(chiaveGiorno(new Date(l.inizio)))} alle ${oraDi(l.inizio)}: ha già ${l.prova ? 'una prova' : "l'appello"}.`)
  if (conto.conAppello.length) righe.push('Le presenze e le prove già segnate restano salvate.')
  righe.push('Gli iscritti non vengono avvisati: se serve, avvisali tu.')
  return { titolo: `Chiudere ${periodoInLettere(dal, al)}? ${quante}`, righe }
}

export function avvisoFatto(dal: string, al: string, n: number): string {
  return `Chiusa ${periodoInLettere(dal, al)}: ${n ? lezioni(n, 'annullat') : 'nessuna lezione annullata'}.`
}

/** La domanda prima di togliere: la prima riga fino al «?» è la domanda, il resto la spiega. */
export function testoTogli(c: Chiusura, nomeSala: string | null): string {
  const quali =
    c.lezioni === 0
      ? 'Non ci sono lezioni da rimettere: si toglie solo la chiusura.'
      : c.lezioni === 1
        ? 'La lezione annullata dalla chiusura torna PREVISTA, con le presenze che aveva.'
        : `Le ${c.lezioni} lezioni annullate dalla chiusura tornano PREVISTE, con le presenze che avevano.`
  return [
    `Togliere la chiusura${nomeSala ? ` della sala ${nomeSala}` : ''} ${periodoInLettere(c.dal, c.al)}?`,
    c.lezioni ? `${quali} Quelle annullate a mano, prima o dopo, restano annullate.` : quali,
    'Gli iscritti non vengono avvisati: se serve, avvisali tu.',
  ].join('\n')
}

/** La riga di una chiusura, nella fascia della settimana e nell'elenco. */
export function rigaChiusura(c: Chiusura, nomeSala: string | null): string {
  const quante = c.lezioni === 0 ? 'nessuna lezione' : c.lezioni === 1 ? '1 lezione' : `${c.lezioni} lezioni`
  return `${periodoInLettere(c.dal, c.al).replace(/^./, (x) => x.toUpperCase())} · ${nomeSala ?? 'Tutte le sale'} · ${quante}`
}

export const avvisoTolta = (n: number) => (n ? `Chiusura tolta: ${n === 1 ? '1 lezione di nuovo prevista' : `${n} lezioni di nuovo previste`}.` : 'Chiusura tolta.')

/** Il database non ha ancora 118-chiusure.sql: il tasto lo dice, il resto dell'app va avanti. */
export const mancaChiusure = (e: { code?: string; message?: string } | null | undefined): boolean =>
  !!e && ['42P01', '42883', 'PGRST202', 'PGRST205'].includes(e.code ?? '') && /chiusure|chiudi_palestra/.test(e.message ?? '')

export const SENZA_CHIUSURE = 'La chiusura della palestra non è ancora disponibile: chiedi a chi cura il database di lanciare il file 118-chiusure.sql.'
