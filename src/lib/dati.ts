import type { DettaglioSessione, SessioneVista, StatoPresenza } from './sala'

/**
 * Da dove arrivano corsi, lezioni e presenze.
 *
 * Due implementazioni dietro la stessa interfaccia: `datiProva` (tutto in
 * locale, dati inventati) e `datiSupabase` (il database vero). Non è
 * un'astrazione messa lì per bellezza — decide come si sviluppa e come si
 * prova: senza, non si potrebbe toccare una riga di questa parte dell'app
 * senza un progetto Supabase acceso.
 */
export interface Dati {
  readonly modo: 'prova' | 'supabase'
  /** Le lezioni comprese fra due giorni, estremi inclusi. */
  calendario(da: Date, a: Date): Promise<SessioneVista[]>
  dettaglio(sessioneId: string): Promise<DettaglioSessione | null>
  /** `null` toglie il segno: serve a correggere un tocco sbagliato. */
  segna(sessioneId: string, personaId: string, stato: StatoPresenza | null): Promise<void>
  segnaTutti(sessioneId: string, stato: StatoPresenza): Promise<void>
  /** Chiude la lezione: da «prevista» a «svolta». */
  chiudi(sessioneId: string): Promise<void>
  /** Quante scritture non sono ancora arrivate al server. Sempre 0 in prova. */
  guardaCoda?(f: (n: number) => void): () => void
}

const URL_SUPABASE = import.meta.env.VITE_SUPABASE_URL as string | undefined
const CHIAVE_SUPABASE = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** Vero quando l'app è configurata per parlare con un database vero. */
export const haUnServer = !!(URL_SUPABASE && CHIAVE_SUPABASE)

let unico: Promise<Dati> | null = null

/**
 * Senza le due variabili d'ambiente l'app parte in **modalità prova**, con un
 * orario e degli iscritti inventati. È voluto: così la si può aprire e provare
 * senza avere niente acceso, e il deploy pubblico non ha bisogno di segreti.
 * L'adattatore vero si carica solo se serve: il client Supabase pesa più di
 * tutto il resto dell'app, e in modalità prova non serve a niente.
 */
export function dati(): Promise<Dati> {
  if (!unico) {
    unico = haUnServer
      ? import('./datiSupabase').then((m) => m.creaDatiSupabase(URL_SUPABASE!, CHIAVE_SUPABASE!))
      : import('./datiProva').then((m) => m.creaDatiProva())
  }
  return unico
}

/** Solo per le prove: rimette lo strato dati com'era. */
export function scordaDati() {
  unico = null
}
