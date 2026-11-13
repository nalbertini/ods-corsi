import type { LezioneSeg } from './segreteria'

export interface EtichettaLezione {
  /** Come si colora il tag: manca (rosso ✕), aspetta (giallo scuro …), sostituto (giallo scuro …); senza tipo è neutro. */
  tipo?: 'manca' | 'aspetta' | 'sostituto'
  testo: string
  titolo?: string
}

/**
 * I tag di una lezione nella settimana, in parole: se l'appello
 * manca, se non ha l'istruttore, il sostituto, e le cose fuori dall'orario.
 * Una lezione annullata non chiede più niente: solo «Annullata».
 */
export function etichetteLezione(
  l: Pick<LezioneSeg, 'stato' | 'segnati' | 'istruttori' | 'sostitutoId' | 'attivitaCambiata' | 'straordinaria'>,
  passata: boolean,
): EtichettaLezione[] {
  const annullata = l.stato === 'annullata'
  const e: EtichettaLezione[] = []
  if (annullata) e.push({ testo: 'Annullata' })
  // L'appello fatto non ha tag: lo dice il conto dei presenti in verde. Si segna solo quello che manca.
  if (passata && !annullata && l.segnati === 0) e.push({ tipo: 'manca', testo: 'Senza appello' })
  if (!annullata && !l.istruttori) e.push({ tipo: 'aspetta', testo: 'Manca l’istruttore' })
  if (l.sostitutoId) e.push({ tipo: 'sostituto', testo: 'Sostituto' })
  if (l.attivitaCambiata) e.push({ tipo: 'sostituto', testo: '✎ Cambiata a mano', titolo: "L'attività di questa lezione è stata scelta a mano: non segue più il giorno" })
  if (l.straordinaria) e.push({ testo: 'Straordinaria' })
  return e
}
