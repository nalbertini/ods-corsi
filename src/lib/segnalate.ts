import type { StatoPresenza, StatoSessione } from './sala'

/**
 * Le presenze segnalate: un iscritto che era a lezione ma nell'appello non
 * risulta (non segnato, o segnato assente per sbaglio) lo dice dalla sua
 * pagina, e la presenza la conferma chi può: l'istruttore di quella lezione,
 * dall'appello, o la segreteria, da PRESENZE SEGNALATE. Accolta, l'iscritto
 * risulta presente; rifiutata, resta com'era.
 *
 * Una sola per lezione e per persona, e solo delle lezioni degli ultimi
 * `GIORNI_SEGNALA` giorni, già cominciate e non annullate. Per ora solo in
 * prova, come l'area degli iscritti.
 */

export type StatoSegnalata = 'da_vedere' | 'accolta' | 'rifiutata'

export interface Segnalata {
  id: string
  sessioneId: string
  personaId: string
  /** Quando l'ha mandata. */
  il: string
  nota?: string
  stato: StatoSegnalata
  gestitaIl?: string
  /** Chi l'ha accolta o rifiutata: l'istruttore, o la segreteria. */
  gestitaDa?: string
}

/** Una segnalazione con quello che serve per guardarla: chi, che lezione, e il segno di adesso. */
export interface SegnalataVista extends Segnalata {
  nome: string
  cognome: string
  corso: string
  colore?: string
  inizio: string
  fine: string
  /** Chi fa la lezione, per id: l'istruttore che la può accogliere. */
  insegnanti: string[]
  /** Il segno che ha adesso nell'appello. */
  segno: StatoPresenza | null
}

/** Fin dove indietro si può segnalare una presenza mancante. */
export const GIORNI_SEGNALA = 30
export const MAX_NOTA_SEGNALATA = 200

/**
 * Perché questa presenza non si può segnalare, o `null` se si può. `lezione`
 * è quella dell'archivio (o `null` se non c'è), `suo` se la persona era
 * iscritta quel giorno, `segno` quello dell'appello, `gia` se ce n'è già una.
 */
export function cosaNonVaSegnalata(
  lezione: { inizio: string; stato: StatoSessione } | null,
  suo: boolean,
  segno: StatoPresenza | null,
  gia: Segnalata | undefined,
  nota: string | undefined,
  adesso = new Date(),
): string | null {
  if (!lezione || !suo) return 'Questa lezione non è di un tuo corso'
  if (lezione.stato === 'annullata') return 'La lezione è stata annullata'
  const inizio = new Date(lezione.inizio).getTime()
  if (inizio > adesso.getTime()) return 'La lezione non è ancora cominciata'
  if (inizio < adesso.getTime() - GIORNI_SEGNALA * 24 * 60 * 60_000) return `Si segnalano solo le lezioni degli ultimi ${GIORNI_SEGNALA} giorni: chiedi alla segreteria`
  if (segno === 'presente') return 'Risulti già presente'
  if (gia?.stato === 'da_vedere') return 'L’hai già segnalata: la guarda l’istruttore o la segreteria'
  if (gia) return gia.stato === 'accolta' ? 'Risulti già presente' : 'È già stata rifiutata: chiedi alla segreteria'
  if ((nota?.trim().length ?? 0) > MAX_NOTA_SEGNALATA) return `La nota è troppo lunga: al massimo ${MAX_NOTA_SEGNALATA} caratteri`
  return null
}
