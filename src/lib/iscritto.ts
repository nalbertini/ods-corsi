import type { StatoPresenza, StatoSessione } from './sala'
import type { CertificatoSeg, PagamentoSeg } from './segreteria'
import { comeCertificato, comePaga } from './segreteria'
import type { Ricevuta } from './ricevute'
import type { DatiRichiesta, StatoRichiesta } from './richieste'

/**
 * L'area degli iscritti: quello che di sé vede chi frequenta i corsi, dal
 * telefono. Per ora solo da leggere: i suoi corsi e le prossime lezioni, con
 * quello che cambia (annullate, sostituti, un'altra sala), le sue presenze,
 * il certificato medico, il pagamento e le ricevute.
 *
 * È il pilota, e c'è solo in prova: col database vero un iscritto non entra
 * ancora (vedi `personaDi` in `accesso.ts`), e quello che può leggere di sé
 * va deciso prima, con funzioni che restituiscano solo le sue righe invece di
 * allargare le policy della segreteria. Quando ci sarà, `datiIscritto()`
 * sceglierà fra le due implementazioni come fanno gli altri strati dati.
 */

/** Chi si può essere, in prova. */
export interface IscrittoDiProva {
  id: string
  nome: string
  cognome: string
}

export interface SchedaIscritto {
  id: string
  nome: string
  cognome: string
  /** I corsi a cui è iscritto oggi, per nome. */
  corsi: Array<{ id: string; nome: string; colore?: string }>
  certificato: CertificatoSeg
  pagamento: PagamentoSeg
}

/** Una lezione di uno dei suoi corsi, con quello che è cambiato rispetto al solito. */
export interface MiaLezione {
  id: string
  corso: string
  colore?: string
  inizio: string
  fine: string
  stato: StatoSessione
  sala?: string
  istruttore?: string
  /** La fa un sostituto. */
  sostituto: boolean
  /** In una sala diversa da quella del suo giorno. */
  altraSala: boolean
  /** Fuori dall'orario: uno stage, un recupero. */
  straordinaria: boolean
}

export interface MiaPresenza {
  sessioneId: string
  inizio: string
  corso: string
  stato: StatoPresenza | null
}

/** Una persona aggiunta al nucleo dall'area, finché la segreteria non l'ha accolta. */
export interface AggiuntaNucleo {
  id: string
  nome: string
  cognome: string
  corsi: string[]
  creataIl: string
  stato: Exclude<StatoRichiesta, 'accolta'>
}

export interface DatiIscritto {
  readonly modo: 'prova'
  /** Gli iscritti fra cui scegliere chi essere, in ordine di cognome. */
  iscritti(): Promise<IscrittoDiProva[]>
  scheda(personaId: string): Promise<SchedaIscritto | null>
  /** Le lezioni dei suoi corsi fra due giorni, estremi inclusi, anche annullate. */
  lezioni(personaId: string, da: Date, a: Date): Promise<MiaLezione[]>
  /** Le lezioni già fatte degli ultimi `giorni`, dalla più recente; le annullate no. */
  presenze(personaId: string, giorni: number): Promise<MiaPresenza[]>
  /** Le sue ricevute, dalla più recente; anche le annullate. */
  ricevute(personaId: string): Promise<Ricevuta[]>
  /**
   * Il nucleo familiare visto da questa persona (vedi `nucleo.ts`): il
   * titolare vede sé stesso per primo e poi gli altri, in ordine di nome; chi
   * è nel nucleo di un altro vede solo sé stesso.
   */
  nucleo(personaId: string): Promise<SchedaIscritto[]>
  /** Può aggiungere persone al nucleo: è il titolare, o non è nel nucleo di nessuno. */
  titolare(personaId: string): Promise<boolean>
  /** Le persone aggiunte dal titolare che la segreteria non ha ancora accolto, e le rifiutate dell'ultimo mese. */
  aggiunte(personaId: string): Promise<AggiuntaNucleo[]>
  /**
   * Quello che il modulo di una persona in più può già sapere dal titolare:
   * cognome, residenza, email e telefono, e i suoi dati da genitore per un
   * minore. Si cambia tutto, prima di mandare.
   */
  datiDelNucleo(personaId: string): Promise<Partial<DatiRichiesta>>
}

/** Quanto viene: le presenze sulle lezioni che contano (le giustificate no). */
export function contoPresenze(p: MiaPresenza[]): { presenti: number; dovute: number } {
  const contano = p.filter((x) => x.stato !== 'giustificato')
  return { presenti: contano.filter((x) => x.stato === 'presente').length, dovute: contano.length }
}

export interface Avviso {
  testo: string
  /** `guaio` ferma l'ingresso in sala; `avviso` è da guardare. */
  tono: 'guaio' | 'avviso'
}

const data = (g: string) => g.split('-').reverse().join('/')

/**
 * Le cose da sapere in cima alla pagina: il certificato che manca o scade,
 * il pagamento da fare. Le lezioni cambiate si vedono già nell'elenco.
 */
export function avvisi(s: Pick<SchedaIscritto, 'certificato' | 'pagamento'>, oggi: string): Avviso[] {
  const x: Avviso[] = []
  const c = comeCertificato(s.certificato, oggi)
  if (c === 'manca') x.push({ tono: 'guaio', testo: 'Manca il certificato medico: portalo in segreteria prima della prossima lezione.' })
  if (c === 'scaduto') x.push({ tono: 'guaio', testo: `Il certificato medico è scaduto il ${data(s.certificato.scade!)}: portane uno nuovo in segreteria.` })
  if (c === 'in_scadenza') x.push({ tono: 'avviso', testo: `Il certificato medico scade il ${data(s.certificato.scade!)}: prenota la visita.` })
  const p = comePaga(s.pagamento, oggi)
  if (p === 'da_pagare') x.push({ tono: 'guaio', testo: 'La quota non risulta pagata: passa in segreteria.' })
  if (p === 'in_parte') x.push({ tono: 'avviso', testo: `La quota è pagata in parte${s.pagamento.nota ? `: ${s.pagamento.nota.toLowerCase()}` : ''}.` })
  if (p === 'scaduto') x.push({ tono: 'guaio', testo: `Il pagamento valeva fino al ${data(s.pagamento.fino!)}: passa in segreteria per rinnovarlo.` })
  return x
}

/** Chi si è scelto di essere in prova, su questo dispositivo. */
const DOVE_CHI = 'ods-corsi:prova-iscritto'   // vedi la nota in coda.ts

export function iscrittoScelto(): string | null {
  try {
    return localStorage.getItem(DOVE_CHI)
  } catch {
    return null
  }
}

export function scegliIscritto(id: string) {
  try {
    localStorage.setItem(DOVE_CHI, id)
  } catch {
    /* senza memoria si riparte dal primo */
  }
}

let unico: Promise<DatiIscritto> | null = null

/** Solo la prova, per ora: vedi in cima. */
export function datiIscritto(): Promise<DatiIscritto> {
  if (!unico) {
    unico = Promise.all([import('./iscrittoProva'), import('./esempiProva')])
      .then(([m, e]) => (e.seminaEsempi(), m.creaIscrittoProva()))
      .catch((e) => {
        unico = null
        throw e
      })
  }
  return unico
}
