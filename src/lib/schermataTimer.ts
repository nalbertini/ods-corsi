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

/** Quanto si aspetta la rete prima di ricaricare: un server muto non deve tenere ferma la sala. */
export const ATTESA_MANDA = 3000

/** Dopo PROVA A MANDARLE: si ricarica solo se non resta niente da perdere. */
export function dopoAverMandato(soloInMemoria: number): 'ricarica' | 'resta' {
  return soloInMemoria > 0 ? 'resta' : 'ricarica'
}

/**
 * RICARICA e PROVA A MANDARLE: prima si prova a mandare quel che è in coda,
 * poi si ricarica. Quel che non parte resta comunque sul disco; quel che sta
 * solo in memoria si riconta dopo, perché il disco può aver smesso di
 * prendere le scritture proprio adesso. Il timer da solo non ha una
 * schermata per chiedere, e non passa `soloInMemoria`: ricarica sempre.
 */
export async function mandaPoiRicarica(f: {
  manda: (ms: number) => Promise<unknown>
  soloInMemoria?: () => number
  ricarica: () => void
}): Promise<'ricaricata' | 'resta'> {
  await f.manda(ATTESA_MANDA)
  if (f.soloInMemoria && dopoAverMandato(f.soloInMemoria()) === 'resta') return 'resta'
  f.ricarica()
  return 'ricaricata'
}
