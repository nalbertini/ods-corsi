import type { StatoPresenza, StatoSessione } from './sala'
import { haUnServer } from './dati'
import { areaDelPercorso } from './percorso'
import type { ListaMusica } from './musica'
import type { ImpostazioniSala, TimerSala } from '../../timer/src/lib/impostazioniSala'
import type { FonteClip } from '../../timer/src/lib/voice'
import type { ChiProva, GiaProvato } from './prove'

/**
 * Il tablet di sala.
 *
 * Un tablet appeso al muro di ogni sala, con il calendario di quella sala: chi
 * arriva tocca il suo nome e la presenza è segnata. Ha un account suo, che non
 * è di nessuna persona e sa fare soltanto questo; l'istruttore, con il suo PIN,
 * ci apre l'appello completo.
 *
 * Come per il resto dell'app ci sono due implementazioni dietro la stessa
 * interfaccia: `tabletProva` (l'orario vero con iscritti inventati) e
 * `tabletSupabase` (le funzioni di `supabase/04-tablet.sql`). Chi può fare cosa
 * lo decide il server: qui ci sono solo le regole che servono a disegnare la
 * schermata giusta, e se divergessero da quelle vere vincerebbe il server.
 */

/** Le stesse di `tablet_regole()` in `04-tablet.sql`. */
export const REGOLE = {
  /** Ci si segna da mezz'ora prima dell'inizio… */
  primaMin: 30,
  /** …a dieci minuti dopo la fine: per tutta la lezione, non solo all'ingresso. */
  dopoMin: 10,
  /** Chi se n'è dimenticato recupera fino a due settimane indietro. */
  recuperoGiorni: 14,
  /** L'area istruttore si chiude da sola dopo due minuti senza tocchi. */
  istruttoreInattivoMin: 2,
} as const

export type Origine = 'appello' | 'tablet' | 'recupero'

/** Una lezione della sala come la vede il tablet. */
export interface LezioneSala {
  id: string
  corsoId: string
  corso: string
  colore?: string
  descrizione?: string
  /** Chi la fa: il sostituto se c'è, altrimenti chi insegna il corso. */
  istruttori?: string
  inizio: string
  fine: string
  stato: StatoSessione
  iscritti: number
  presenti: number
}

/** Un nome da toccare: il nome e l'iniziale del cognome, niente di più. */
export interface NomeSala {
  personaId: string
  nome: string
  /** «F.», o «Fon.» quando due iscritti sarebbero tutti e due «Giulia F.». */
  sigla: string
  segnato: boolean
}

/**
 * Cosa è successo al tocco:
 * - `segnata`: presenza scritta;
 * - `gia`: era già fra i presenti;
 * - `istruttore`: l'istruttore l'ha già segnato (assente, di solito) e il
 *   tablet non lo scavalca.
 */
export type EsitoTocco = 'segnata' | 'gia' | 'istruttore'

/** Una riga dell'appello dell'istruttore: qui il cognome c'è. */
export interface RigaAppelloTablet {
  personaId: string
  nome: string
  cognome: string
  stato: StatoPresenza | null
  origine: Origine | null
  /** Venuto a provare: non è iscritto, l'ha aggiunto chi fa l'appello (`prove.ts`). */
  prova?: boolean
}

/**
 * La presenza di un istruttore in una lezione, segnata dal suo PIN sul
 * tablet: confermata da sola se era previsto, se no da confermare in
 * segreteria, che la può anche rifiutare.
 */
export type StatoPresenzaIstruttore = 'confermata' | 'da_confermare' | 'rifiutata'

/** Cosa ha segnato il PIN, per dirlo all'istruttore appena entra. */
export interface PresenzaIstruttore {
  sessioneId: string
  corso: string
  stato: StatoPresenzaIstruttore
}

/** Chi è entrato col PIN, e in quali lezioni gli è stata segnata la presenza. */
export interface EntratoConPin {
  personaId: string
  nome: string
  /** Vuoto fuori dalle lezioni, o col database senza `15-presenze-istruttori.sql`. */
  presenze: PresenzaIstruttore[]
}

export interface Postazione {
  nome: string
  sala: string
}

export interface DatiTablet {
  readonly modo: 'prova' | 'supabase'
  /** L'ora del tablet. In prova si può spostare, per vedere una lezione che si apre. */
  adesso(): Date
  /** In che sala è appeso questo tablet; `null` se non è ancora stato preparato. */
  postazione(): Promise<Postazione | null>
  /** Prova: le sale fra cui scegliere. */
  readonly sale?: string[]
  /** Prova: il tablet diventa quello di una sala. */
  scegliSala?(sala: string): Promise<void>
  /** Il tablet smette di essere il tablet di una sala. */
  scollega(): Promise<void>

  /** Le lezioni della sala fra due giorni, estremi inclusi. */
  lezioni(da: Date, a: Date): Promise<LezioneSala[]>
  elenco(sessioneId: string): Promise<NomeSala[]>
  segna(sessioneId: string, personaId: string): Promise<EsitoTocco>
  /** Il tasto ANNULLA. `false` se il tocco non si può più togliere. */
  annulla(sessioneId: string, personaId: string): Promise<boolean>

  /**
   * Chi ha questo PIN, o `null`. Dopo troppi errori solleva. Durante una
   * lezione gli segna anche la presenza (vedi `15-presenze-istruttori.sql`).
   */
  entraConPin(pin: string): Promise<EntratoConPin | null>
  /**
   * Di chi è questo PIN, senza segnare niente: per uscire dal tablet basta
   * il PIN di un istruttore qualsiasi. Dopo troppi errori solleva, come
   * `entraConPin`, e gli errori contano insieme.
   */
  verificaPin(pin: string): Promise<{ personaId: string; nome: string } | null>
  appello(pin: string, sessioneId: string): Promise<RigaAppelloTablet[]>
  /**
   * `null` toglie il segno, ma solo a una presenza arrivata dal tablet. Una
   * prova (`prova`) si segna presente o assente, e basta.
   */
  correggi(pin: string, sessioneId: string, personaId: string, stato: StatoPresenza | null, prova?: boolean): Promise<boolean>
  /**
   * Chi è già venuto a provare, senza telefono. Con un PIN che non va più,
   * nessuno: se ne accorge l'aggiunta, come col database.
   */
  provati(pin: string): Promise<GiaProvato[]>
  /** Aggiunge chi viene a provare, già presente. `false` se il PIN non va più. */
  aggiungiProva(pin: string, sessioneId: string, chi: ChiProva): Promise<boolean>
  /** Toglie una prova messa per sbaglio. `false` se il PIN non va più. */
  togliProva(pin: string, sessioneId: string, personaId: string): Promise<boolean>

  /** Le liste della musica di questa sala e di tutte, preparate dalla segreteria. */
  musica(): Promise<ListaMusica[]>
  /** Come va il timer della sala, uguale per tutti i tablet, con la voce e gli esercizi scelti dalla segreteria. */
  timerSala(): Promise<TimerSala>
  /** Maurizio, i segnali e lo schermo scelti su questo tablet: valgono per tutti. */
  salvaTimerSala(i: ImpostazioniSala): Promise<void>
  /** Le clip della voce incise dalla segreteria. */
  clipSala(): Promise<FonteClip>
}

// ---------------------------------------------------------------------------
// L'account della sala.
//
// Una sala non ha un'email: ha un nome utente, «lotta», e una password.
// Supabase però fa entrare solo con un'email, e allora il nome diventa
// un'email interna, `lotta@sale.ods-corsi.it`, che è quella con cui la
// segreteria crea l'utente. Non ci arriva mai niente: serve solo da nome.
// Chi scrive un'email intera entra con quella, così valgono anche gli
// account fatti prima.
// ---------------------------------------------------------------------------
export const DOMINIO_SALE = 'sale.ods-corsi.it'

export function emailDellaSala(utente: string): string {
  const u = utente.trim().toLowerCase()
  return u.includes('@') ? u : `${u}@${DOMINIO_SALE}`
}

// ---------------------------------------------------------------------------
// Il dispositivo è un tablet di sala?
//
// Ci si entra aprendo l'app all'indirizzo `sala/` (i vecchi `#sala` e
// `#tablet` ci portano da soli), e da lì il dispositivo se lo ricorda: il
// tablet in sala riapre sempre il tablet, anche installato come app, senza
// che nessuno debba ridigitare niente.
// ---------------------------------------------------------------------------
const DOVE_MODO = 'ods-corsi:modo'

const eIndirizzoTablet = () => areaDelPercorso() === 'sala'

export function eUnTablet(): boolean {
  try {
    if (eIndirizzoTablet()) {
      localStorage.setItem(DOVE_MODO, 'tablet')
      return true
    }
    return localStorage.getItem(DOVE_MODO) === 'tablet'
  } catch {
    return eIndirizzoTablet()
  }
}

/** Il dispositivo smette di aprirsi come tablet, senza cambiare pagina. */
export function smettiTablet() {
  try {
    localStorage.removeItem(DOVE_MODO)
  } catch {
    /* pazienza */
  }
}

/** Torna all'app di sempre: il dispositivo smette di aprirsi come tablet. */
export function lasciaTablet() {
  smettiTablet()
  // La radice: nelle cartelle delle aree la base del documento è lei.
  window.location.assign(new URL('./', document.baseURI).href)
}

let unico: Promise<DatiTablet> | null = null

/** Lo strato dati del tablet, caricato solo quando serve (vedi `dati()`). */
export function datiTablet(): Promise<DatiTablet> {
  if (!unico) {
    unico = (haUnServer
      ? Promise.all([import('./tabletSupabase'), import('./supabase')]).then(([m, s]) => m.creaTabletSupabase(s.clientSupabase()))
      : Promise.all([import('./tabletProva'), import('./esempiProva')]).then(([m, e]) => (e.seminaEsempi(), m.creaTabletProva())))
      // Se il pezzo non arriva (rete, o un aggiornamento pubblicato nel
      // frattempo), la volta dopo si riprova invece di restare rotti.
      .catch((e) => {
        unico = null
        throw e
      })
  }
  return unico
}

// ---------------------------------------------------------------------------
// Le fasi di una lezione, dal punto di vista di chi sta davanti al tablet.
// ---------------------------------------------------------------------------

export type Fase = 'dopo' | 'aperta' | 'finita'

const MIN = 60_000

/**
 * - `aperta`: ci si segna adesso (da 30' prima dell'inizio a 10' dopo la
 *   fine). Le presenze le segnano anche gli allievi, sul tablet: la lezione
 *   non si chiude a loro mentre è in corso;
 * - `finita`, `dopo`: già fatta, o più tardi.
 */
export function fase(l: Pick<LezioneSala, 'inizio' | 'fine'>, adesso: Date): Fase {
  const t = adesso.getTime()
  const inizio = Date.parse(l.inizio)
  const fine = Date.parse(l.fine)
  if (t >= inizio - REGOLE.primaMin * MIN && t <= fine + REGOLE.dopoMin * MIN) return 'aperta'
  return t < inizio ? 'dopo' : 'finita'
}

/** Si recupera una lezione cominciata da non più di due settimane e non più aperta. */
export function recuperabile(l: Pick<LezioneSala, 'inizio' | 'fine' | 'stato'>, adesso: Date): boolean {
  const t = adesso.getTime()
  const inizio = Date.parse(l.inizio)
  return (
    l.stato !== 'annullata' &&
    inizio <= t &&
    inizio >= t - REGOLE.recuperoGiorni * 24 * 60 * MIN &&
    fase(l, adesso) !== 'aperta'
  )
}

/**
 * «Giulia F.», e «Giulia Fon.» quando nella stessa lezione ci sarebbero due
 * «Giulia F.». È la stessa regola di `elenco_sala`: serve alla prova, perché
 * col database la sigla arriva già fatta e il cognome intero non arriva mai.
 */
export function sigle<T extends { nome: string; cognome: string }>(persone: T[]): Array<T & { sigla: string }> {
  const iniziale = (c: string) => c.replace(/^(De|Di|Da|Del|Della|Lo|La)\s+/i, '$1').charAt(0).toUpperCase()
  const chiave = (p: T) => `${p.nome}|${iniziale(p.cognome)}`
  const quanti = new Map<string, number>()
  for (const p of persone) quanti.set(chiave(p), (quanti.get(chiave(p)) ?? 0) + 1)
  return persone.map((p) => ({
    ...p,
    // Senza spazi: «De Luca» e «De Santis» sarebbero entrambi «De .».
    sigla: ((quanti.get(chiave(p)) ?? 0) > 1 ? p.cognome.replace(/\s+/g, '').slice(0, 3) : iniziale(p.cognome)) + '.',
  }))
}
