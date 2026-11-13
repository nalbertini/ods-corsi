import type { RigaAssegnata, VoceDovuta } from './assegna'

/**
 * Una sola regola di «sicuro», per tutto quel che l'app fa da sé con un bonifico: chi l'ha pagato (l'import della
 * banca, «Collega i casi sicuri», il collegamento) e come si divide fra quota e corsi (l'assegnazione da sola). Quel
 * che non è sicuro lo sceglie l'amministrazione. Le stesse regole sono nel database: il punteggio in
 * `supabase/155-sicuro-nome-intero.sql` (`abbina_pagatori_movimento`), il nome della causale dello storico in
 * `70-movimenti-persona.sql`.
 */

/** I punti che servono al primo, e quanti più del secondo: misurati sui movimenti già collegati (121). */
export const PUNTI_SICURO = 4
export const DISTACCO_SICURO = 2

/**
 * Chi ha pagato è sicuro se ha almeno 4 punti, almeno 2 più del secondo, e non è già iscritto il giorno del movimento:
 * un iscritto si confonde con un omonimo nuovo. Col nome e cognome interi nella causale lo è anche già iscritto, così
 * il secondo corso o il trimestre di un iscritto si collegano da soli (deciso da Nicola il 13/11/2026).
 */
export function personaSicura(x: { punti: number; secondo: number; giaIscritto: boolean; come: string }): boolean {
  return x.punti >= PUNTI_SICURO && x.punti - x.secondo >= DISTACCO_SICURO && (!x.giaIscritto || x.come === 'nome intero')
}

/**
 * Lo storico del vecchio programma non ha iscrizioni né codici: lì «sicuro» è il caso del nome intero, il nome della
 * causale uguale a quello di una scheda sola. Due schede sono omonimi, e si sceglie a mano.
 */
export const schedaUnica = (ids: string[]): boolean => ids.length === 1

/** Perché un bonifico non si divide da solo: niente da pagare, più modi, meno o più di quel che serve. */
export type MotivoNonSicura = 'niente' | 'piu modi' | 'in parte' | 'di piu'

/** Oltre, i modi di dividere sono troppi da contare: si lascia scegliere. */
const MASSIMO_DOVUTI = 16

/**
 * La divisione di un bonifico è sicura quando c'è un solo modo di fare esattamente l'importo con le cose che il nucleo
 * deve, ognuna pagata per intero (deciso da Nicola il 13/11/2026: anche se non copre tutto quel che deve). Due corsi
 * dello stesso prezzo, o quota più l'uno o l'altro, sono più modi: si sceglie a mano. `dovuto` è il totale, per il perché.
 */
export function ripartizioneSicura(importo: number, dovuti: VoceDovuta[]): { righe: RigaAssegnata[] } | { motivo: MotivoNonSicura; dovuto: number } {
  const dovuto = dovuti.reduce((s, v) => s + v.manca, 0)
  if (!dovuti.length || dovuto <= 0) return { motivo: 'niente', dovuto: 0 }
  if (dovuti.length > MASSIMO_DOVUTI) return { motivo: 'piu modi', dovuto }
  const modi: number[] = []
  for (let scelta = 1; scelta < 1 << dovuti.length && modi.length < 2; scelta++) {
    const somma = dovuti.reduce((s, v, i) => (scelta & (1 << i) ? s + v.manca : s), 0)
    if (somma === importo) modi.push(scelta)
  }
  if (modi.length === 1) {
    return { righe: dovuti.filter((_, i) => modi[0] & (1 << i)).map((v) => ({ personaId: v.personaId, voce: v.voce, importo: v.manca })) }
  }
  if (modi.length > 1) return { motivo: 'piu modi', dovuto }
  return { motivo: importo < dovuto ? 'in parte' : 'di piu', dovuto }
}
