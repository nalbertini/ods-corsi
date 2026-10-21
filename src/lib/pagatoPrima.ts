import { VOCE_QUOTA } from './contabilita'
import { QUOTA_ASSOCIATIVA, stagioneDi } from './costi'
import { chiaveGiorno } from './sala'
import { pagamentoDi, type DatiSegreteria, type PersonaSeg } from './segreteria'

/**
 * Chi ha già pagato nel vecchio programma e nell'app risulta ancora da pagare (`supabase/71-pagato-vecchio-programma.sql`).
 * Il filtro «Pagato nel vecchio programma» dell'elenco ISCRITTI lo indica, non lo conta: lo storico resta a parte e non
 * cambia «Da pagare», le statistiche o la contabilità finché la segreteria non segna la persona. Niente browser, niente
 * database: le schermate e i dati la chiamano, e le prove la leggono sola.
 */

/** Un incasso dello storico nella stagione, col collegamento alla persona (vuoto se non è ancora collegato). Importo in centesimi. */
export interface IncassoPrima {
  personaId: string | null
  /** `AAAA-MM-GG` */
  data: string
  importo: number
  voce: string
}

/** Perché una persona sta fra quelli da guardare a mano, senza casella: lo decide la segreteria dalla scheda. */
export type MotivoDaGuardare = 'solo-corsi' | 'sotto-quota' | 'altra-persona'

export interface RigaPagatoPrima {
  personaId: string
  data: string
  importo: number
  voce: string
  /** La quota di adesso è scaduta (se no, da pagare): la riga lo dice col bollino. */
  scaduta: boolean
  motivo?: MotivoDaGuardare
  /** Con `altra-persona`: il titolare del nucleo a cui è collegato l'incasso. */
  daPersonaId?: string
}

export interface PagatoNelVecchio {
  /** Da segnare: almeno un incasso di quota di 50 € o più, collegato a lei. */
  quota: RigaPagatoPrima[]
  /** Da guardare a mano: solo corsi, quota sotto i 50 €, o l'incasso è di un altro. */
  daGuardare: RigaPagatoPrima[]
  /** Incassi della stagione che non hanno ancora una persona: si collegano in CONTABILITÀ › MOVIMENTI. */
  nonCollegati: number
}

export const NOTA_DI_DEFAULT = 'Dal vecchio programma'
const PACCHETTO = 10

const soloQuota = (i: IncassoPrima) => i.voce.trim().toLowerCase() === VOCE_QUOTA.toLowerCase()
const ultimo = (righe: IncassoPrima[]) => [...righe].sort((a, b) => b.data.localeCompare(a.data) || b.importo - a.importo)[0]
const riga = (p: PersonaSeg, i: IncassoPrima, oggi: string, extra: Pick<RigaPagatoPrima, 'motivo' | 'daPersonaId'> = {}): RigaPagatoPrima => ({
  personaId: p.id, data: i.data, importo: i.importo, voce: i.voce, scaduta: pagamentoDi(p, oggi).come === 'scaduto', ...extra,
})

/**
 * Le persone attive con un incasso della stagione corrente (confini compresi) che oggi risultano da pagare, scadute o
 * pagate in parte, divise fra «da segnare» e «da guardare a mano». Chi ha già la quota (ricevuta valida o segnata
 * senza ricevuta dell'app) non c'è: non resta niente da fare.
 */
export function pagatoNelVecchio(persone: PersonaSeg[], incassi: IncassoPrima[], oggi: string): PagatoNelVecchio {
  // La stagione di oggi, come la calcola il database (`incassi_vecchio_programma`): agosto è già della nuova.
  const stagione = stagioneDi(oggi)
  const dentro = incassi.filter((i) => i.data >= stagione.dal && i.data <= stagione.al)
  const perId = new Map(persone.map((p) => [p.id, p]))
  const quota: RigaPagatoPrima[] = []
  const daGuardare: RigaPagatoPrima[] = []

  const ordinate = persone
    .filter((p) => p.attiva && pagamentoDi(p, oggi).come !== 'pagato')
    .sort((a, b) => a.cognome.localeCompare(b.cognome, 'it') || a.nome.localeCompare(b.nome, 'it'))
  for (const p of ordinate) {
    const suoi = dentro.filter((i) => i.personaId === p.id)
    const quote = suoi.filter(soloQuota)
    const intera = quote.filter((i) => i.importo >= QUOTA_ASSOCIATIVA * 100)
    if (intera.length) {
      quota.push(riga(p, ultimo(intera), oggi))
    } else if (quote.length) {
      // Le quote non si sommano: due da 30 € possono essere due persone diverse nella stessa causale.
      daGuardare.push(riga(p, [...quote].sort((a, b) => b.importo - a.importo)[0], oggi, { motivo: 'sotto-quota' }))
    } else if (suoi.length) {
      daGuardare.push(riga(p, ultimo(suoi), oggi, { motivo: 'solo-corsi' }))
    } else if (p.nucleo && perId.has(p.nucleo)) {
      // Il pagamento è intestato al genitore: non si segna il figlio per un incasso che non è suo.
      const delTitolare = dentro.filter((i) => i.personaId === p.nucleo && soloQuota(i))
      if (delTitolare.length) daGuardare.push(riga(p, ultimo(delTitolare), oggi, { motivo: 'altra-persona', daPersonaId: p.nucleo }))
    }
  }
  return { quota, daGuardare, nonCollegati: dentro.filter((i) => !i.personaId).length }
}

/** Solo le persone ammesse (la ricerca e il corso scelti sopra l'elenco); i non collegati restano tutti, non hanno una persona da cercare. */
export function soloQueste(g: PagatoNelVecchio, ammessi: ReadonlySet<string>): PagatoNelVecchio {
  return { ...g, quota: g.quota.filter((r) => ammessi.has(r.personaId)), daGuardare: g.daGuardare.filter((r) => ammessi.has(r.personaId)) }
}

/** «28/09/2026 · 50 € quota associativa»: perché la persona sta nell'elenco. */
export function frasePagatoPrima(i: Pick<IncassoPrima, 'data' | 'importo' | 'voce'>): string {
  const [a, m, g] = i.data.split('-')
  const cifra = (i.importo / 100).toLocaleString('it-IT', { minimumFractionDigits: i.importo % 100 ? 2 : 0, maximumFractionDigits: 2 })
  return `${g}/${m}/${a} · ${cifra} € ${i.voce.toLowerCase()}`
}

export interface EsitoSegnatura {
  riusciti: string[]
  falliti: Array<{ id: string; nome: string; errore: string }>
}

/**
 * Segna le persone «pagato», senza ricevuta dell'app, a pacchetti da dieci. Non lancia mai: chi non riesce si riporta
 * per nome, e le altre restano segnate. `fino` e `nota` si cambiano prima di confermare; chi sbaglia la data la
 * corregge persona per persona dalla scheda.
 */
export async function segnaPagatoPrima(
  d: Pick<DatiSegreteria, 'salvaPagamento'>,
  persone: Array<{ id: string; nome: string; cognome: string }>,
  opzioni: { fino?: string; nota?: string } = {},
  suProgresso?: (fatte: number) => void,
): Promise<EsitoSegnatura> {
  const pagamento = { stato: 'pagato' as const, fino: opzioni.fino ?? stagioneDi(chiaveGiorno(new Date())).quota.al, nota: opzioni.nota ?? NOTA_DI_DEFAULT }
  const esito: EsitoSegnatura = { riusciti: [], falliti: [] }
  for (let i = 0; i < persone.length; i += PACCHETTO) {
    const giro = persone.slice(i, i + PACCHETTO)
    const risposte = await Promise.all(
      giro.map((p) => d.salvaPagamento(p.id, pagamento).then(() => null, () => 'Non è stata segnata: riprova, o aprila e segnala la quota dalla scheda.')),
    )
    giro.forEach((p, k) => {
      const errore = risposte[k]
      if (errore) esito.falliti.push({ id: p.id, nome: `${p.cognome} ${p.nome}`, errore })
      else esito.riusciti.push(p.id)
    })
    suProgresso?.(esito.riusciti.length + esito.falliti.length)
  }
  return esito
}

/** Senza `71-pagato-vecchio-programma.sql` la funzione non c'è: il filtro non si offre, mai «nessuno». */
export const mancaPagatoPrima = (e: { code?: string; message?: string } | null | undefined): boolean =>
  !!e && (e.code === 'PGRST202' || e.code === '42883') && /incassi_vecchio_programma/.test(e.message ?? '')
