// La scheda di una persona del personale divisa in schede: quali ci sono per
// chi, quale si apre, il segno sulla linguetta e le voci del menù «Altro».
// Il .tsx mostra e chiama.
import { insegna, puo, siElimina } from './ruoli'
import { tastoLinguette } from './schedaSezioni'

export type IdSchedaPersonale = 'dati' | 'presenze' | 'accesso' | 'persona'

type Chi = { ruolo: string; ancheIstruttore?: boolean; ancheAmministrazione?: boolean; attiva: boolean }

/** Gli id di linguetta e pannello: un posto solo, se no il collegamento fra i due si rompe senza errori. */
export const idLinguettaPersonale = (id: IdSchedaPersonale) => `schp-${id}`
export const idPannelloPersonale = (id: IdSchedaPersonale) => `panp-${id}`

/** L'ordine è questo: prima quel che si fa ogni mese, per ultimo chi è. */
const ORDINE: readonly IdSchedaPersonale[] = ['dati', 'presenze', 'accesso', 'persona']

/**
 * DATI (compensi) solo a chi insegna; PRESENZE solo a chi sta in sala, come il
 * PIN e il kanji; ACCESSO e PERSONA a tutti. Una scheda senza contenuto non c'è.
 */
export function schedePersonale(p: Chi): IdSchedaPersonale[] {
  const ha: Record<IdSchedaPersonale, boolean> = { dati: insegna(p), presenze: puo(p, 'pin'), accesso: true, persona: true }
  return ORDINE.filter((id) => ha[id])
}

export const schedaInizialePersonale = (p: Chi): IdSchedaPersonale => schedePersonale(p)[0]

/** La scheda da mostrare: quella tenuta aperta, se questa persona la ha, se no la prima. */
export const schedaAperta = (p: Chi, voluta: IdSchedaPersonale): IdSchedaPersonale => (schedePersonale(p).includes(voluta) ? voluta : schedaInizialePersonale(p))

/** IN MODIFICA sulla linguetta PERSONA quando c'è una modifica aperta e si sta guardando altro. */
export const segnoPersonale = (aperta: IdSchedaPersonale, inModifica: boolean): { parola: string; tono: 'giallo' } | null =>
  inModifica && aperta !== 'persona' ? { parola: 'IN MODIFICA', tono: 'giallo' } : null

export const tastoSchedaPersonale = (ordine: readonly IdSchedaPersonale[], aperta: IdSchedaPersonale, tasto: string): IdSchedaPersonale | null =>
  tastoLinguette(ordine, aperta, tasto)

export interface VoceAltro {
  id: 'accesso' | 'elimina'
  etichetta: string
  /** Chiede conferma con il tasto rosso. */
  pericolo: boolean
}

/** Le voci del menù «Altro»: togliere o ridare l'accesso sempre, eliminare solo a chi si può (`siElimina`). */
export function vociAltro(p: Chi): VoceAltro[] {
  return [
    { id: 'accesso', etichetta: p.attiva ? 'Togli l’accesso' : 'Ridai l’accesso', pericolo: p.attiva },
    ...(siElimina(p) ? [{ id: 'elimina' as const, etichetta: 'Elimina', pericolo: true }] : []),
  ]
}
