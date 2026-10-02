import type { DettaglioSessione, Persona, SessioneVista, StatoPresenza } from './sala'
import type { ChiProva, GiaProvato } from './prove'

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
  /** Chi è già venuto a provare negli ultimi novanta giorni, dal più recente. */
  provati(): Promise<GiaProvato[]>
  /**
   * Aggiunge all'appello chi viene a provare, già presente: uno già venuto o
   * uno nuovo. Restituisce la persona, con l'id che avrà anche sul server.
   */
  aggiungiProva(sessioneId: string, chi: ChiProva): Promise<Persona>
  /** Toglie una prova messa per sbaglio, col suo segno. */
  togliProva(sessioneId: string, personaId: string): Promise<void>
  /** Chiude la lezione: da «prevista» a «svolta». */
  chiudi(sessioneId: string): Promise<void>
  /** Quante scritture non sono ancora arrivate al server. Sempre 0 in prova. */
  guardaCoda?(f: (n: number) => void): () => void
}

const URL_SUPABASE = import.meta.env.VITE_SUPABASE_URL as string | undefined
const CHIAVE_SUPABASE = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** Vero quando il pacchetto è stato compilato con un database vero. */
export const configurato = !!(URL_SUPABASE && CHIAVE_SUPABASE)

/**
 * La prova scelta a mano, su un'app che il database ce l'ha: per far vedere
 * l'app a chi non ha un account, o provarla senza toccare niente di vero.
 * Si accende dalla porta (o con `?prova` nell'indirizzo), si spegne dal
 * nastro giallo (o con `?prova=no`), e resta sul dispositivo finché non la
 * si spegne. Il database non si tocca nemmeno: il client non si carica.
 */
const DOVE_PROVA = 'ods-corsi:prova'   // vedi la nota in coda.ts

function provaScelta(): boolean {
  if (!configurato) return false
  try {
    const q = new URLSearchParams(window.location.search).get('prova')
    if (q !== null) {
      if (q === 'no') localStorage.removeItem(DOVE_PROVA)
      else localStorage.setItem(DOVE_PROVA, '1')
    }
    return localStorage.getItem(DOVE_PROVA) === '1'
  } catch {
    return false
  }
}

/** Vero quando l'app è in prova per scelta, pur avendo un database. */
export const inProvaScelta = provaScelta()

/**
 * Chi è l'istruttore in prova: un istruttore vero dei dati di prova (vedi
 * `archivioProva.ts`), così il calendario mostra le sue lezioni come le
 * vedrebbe lui, e non tutte quelle della palestra.
 */
export const ISTRUTTORE_PROVA = { id: 'i-maurizio', nome: 'Maurizio' }

/** Vero quando l'app parla con un database vero. */
export const haUnServer = configurato && !inProvaScelta

/** Accende o spegne la prova scelta, e riapre l'app nel modo nuovo. */
export function scegliProva(accesa: boolean) {
  try {
    if (accesa) localStorage.setItem(DOVE_PROVA, '1')
    else localStorage.removeItem(DOVE_PROVA)
  } catch {
    /* senza localStorage resta com'è */
  }
  const u = new URL(window.location.href)
  u.searchParams.delete('prova')
  window.location.replace(u.toString())
}

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
    unico = (haUnServer
      ? Promise.all([import('./datiSupabase'), import('./supabase')]).then(([m, s]) => m.creaDatiSupabase(s.clientSupabase()))
      : Promise.all([import('./datiProva'), import('./esempiProva')]).then(([m, e]) => (e.seminaEsempi(), m.creaDatiProva())))
      // Se il pezzo non arriva (rete, o un aggiornamento pubblicato nel
      // frattempo), la volta dopo si riprova invece di restare rotti.
      .catch((e) => {
        unico = null
        throw e
      })
  }
  return unico
}

/** Solo per le prove: rimette lo strato dati com'era. */
export function scordaDati() {
  unico = null
}
