/**
 * Il riquadro del timer quando si blocca, e i pezzi che ha in comune con
 * quello dell'app. Sta da solo, senza `aree`: il timer lo importa, e non deve
 * tirarsi dietro il resto dell'app (il tablet, supabase).
 */

export type Azione = 'ricarica' | 'manda' | 'ricaricaLoStesso' | 'tornaAllAppello'

export interface Tasto {
  etichetta: string
  azione: Azione
  variante: 'principale' | 'linea'
  disabilitato: boolean
}

export interface Schermata {
  titolo: string
  testo: string
  tasti: Tasto[]
}

export const tasto = (etichetta: string, azione: Azione, variante: Tasto['variante'] = 'principale'): Tasto => ({
  etichetta,
  azione,
  variante,
  disabilitato: false,
})

export const RICARICA = tasto('RICARICA', 'ricarica')

/** Il timer ha il suo riquadro: nel tablet l'appello accanto non è toccato. */
export function schermataTimer(nelTablet: boolean): Schermata {
  if (!nelTablet) return { titolo: 'IL TIMER SI È BLOCCATO', testo: 'Con RICARICA riparte da capo.', tasti: [RICARICA] }
  return {
    titolo: 'IL TIMER SI È BLOCCATO',
    testo: 'L’appello e le presenze non sono toccati. Torna all’appello, o ricarica il timer.',
    tasti: [tasto('TORNA ALL’APPELLO', 'tornaAllAppello'), tasto('RICARICA IL TIMER', 'ricarica', 'linea')],
  }
}
