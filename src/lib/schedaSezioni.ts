// La scheda iscritto divisa in schede: quali sono, dove portano i timbri, come
// si muove la tastiera e quali segni mettono sulla linguetta. Il .tsx mostra e chiama.
import { timbriScheda, type CorsoSeg, type PersonaSeg } from './segreteria'
import { timbroTessera } from './tessere'
import type { StatoCorso } from './corsiDaPagare'

export type IdScheda = 'persona' | 'documenti' | 'quota' | 'corsi'

export interface SchedaDef {
  id: IdScheda
  etichetta: string
  /** Sul telefono la linguetta è più corta. */
  etichettaTelefono: string
  /** Il nome per il lettore schermo: sempre intero. */
  nome: string
}

export const SCHEDE: readonly SchedaDef[] = [
  { id: 'persona', etichetta: 'PERSONA', etichettaTelefono: 'PERSONA', nome: 'PERSONA' },
  { id: 'documenti', etichetta: 'DOCUMENTI', etichettaTelefono: 'DOCUMENTI', nome: 'DOCUMENTI' },
  { id: 'quota', etichetta: 'QUOTA E PAGAMENTI', etichettaTelefono: 'QUOTA', nome: 'QUOTA E PAGAMENTI' },
  { id: 'corsi', etichetta: 'CORSI', etichettaTelefono: 'CORSI', nome: 'CORSI' },
]

/** Gli id di linguetta e pannello: un posto solo, se no il collegamento fra i due si rompe senza errori. */
export const idLinguetta = (id: IdScheda) => `sch-${id}`
export const idPannello = (id: IdScheda) => `pan-${id}`

export const SCHEDA_INIZIALE: IdScheda = SCHEDE[0].id

const DELLA_SEZIONE: Record<string, IdScheda> = { 'sez-certificato': 'documenti', 'sez-tessere': 'documenti', 'sez-documento': 'documenti', 'sez-quota': 'quota' }

/** L'evento con cui il Banco dice alla scheda sotto quale scheda aprire (detail: IdScheda). */
export const APRI_SCHEDA = 'ods-apri-scheda'

/** La scheda che contiene una sezione (gli id `sez-*` dei timbri); nessuna per un id sconosciuto. */
export const schedaDellaSezione = (id: string): IdScheda | null => DELLA_SEZIONE[id] ?? null

/** Cambiare scheda serve solo se la destinazione c'è ed è un'altra. */
export const serveCambiare = (aperta: IdScheda, destinazione: IdScheda | null): boolean => destinazione !== null && destinazione !== aperta

/** La linguetta dopo un tasto, fra quelle date in ordine: frecce con il giro, Home e Fine ai capi, altro niente. */
export function tastoLinguette<T>(ordine: readonly T[], aperta: T, tasto: string): T | null {
  const i = ordine.indexOf(aperta)
  const n = ordine.length
  if (tasto === 'ArrowRight') return ordine[(i + 1) % n]
  if (tasto === 'ArrowLeft') return ordine[(i + n - 1) % n]
  if (tasto === 'Home') return ordine[0]
  if (tasto === 'End') return ordine[n - 1]
  return null
}

export const tastoScheda = (aperta: IdScheda, tasto: string): IdScheda | null => tastoLinguette(SCHEDE.map((s) => s.id), aperta, tasto)

export interface SegnoScheda {
  parola: string
  tono: 'giallo' | 'rosso'
}
export type SegniSchede = Record<IdScheda, SegnoScheda | null>

const GRAVE = { giallo: 1, rosso: 2 } as const

/**
 * Cosa mettere sulla linguetta di ogni scheda: DOCUMENTI e QUOTA dicono a parole
 * se un timbro è giallo o rosso (il peggiore vince), PERSONA dice IN MODIFICA
 * quando si guarda altro. Chi è disattivato ha i timbri spenti: nessun segno.
 */
export function segniSchede(
  p: Pick<PersonaSeg, 'attiva' | 'certificato' | 'documento' | 'pagamento' | 'quote' | 'natoIl' | 'id' | 'iscrizioni'> & { tessere?: PersonaSeg['tessere'] },
  corsi: Array<Pick<CorsoSeg, 'id' | 'nome'> & { enteTessera?: string | null }>,
  oggi: string,
  stato: { aperta: IdScheda; inModifica: boolean },
  /** I corsi da pagare (`corsiDaPagare`): con la quota a posto, la QUOTA dice «CORSO SCADUTO». */
  scoperti: ReadonlyArray<Pick<StatoCorso, 'come'>> = [],
): SegniSchede {
  const t = timbriScheda(p, oggi)
  // Senza le tessere lette (il database non le ha ancora) il timbro non c'è, come nella scheda.
  const tessera = p.attiva && p.tessere ? timbroTessera(p, corsi, oggi) : null
  const peggiore = (toni: Array<string | undefined>): SegnoScheda['tono'] | null => {
    const gravi = toni.filter((x): x is SegnoScheda['tono'] => x === 'giallo' || x === 'rosso')
    return gravi.length ? gravi.reduce((m, x) => (GRAVE[x] > GRAVE[m] ? x : m)) : null
  }
  const doc = peggiore([t.certificato.tono, t.documento.tono, tessera?.tono])
  const quota = peggiore([t.quota.tono])
  // Il giallo solo se nessuno è scaduto (pagato in parte, da controllare): uno scaduto è rosso come la quota.
  const corso = p.attiva && scoperti.length ? (scoperti.every((s) => s.come === 'in_parte' || s.come === 'da_controllare') ? 'giallo' : 'rosso') : null
  return {
    persona: stato.inModifica && stato.aperta !== 'persona' ? { parola: 'IN MODIFICA', tono: 'giallo' } : null,
    documenti: doc ? { parola: 'DA SISTEMARE', tono: doc } : null,
    quota: quota ? { parola: 'DA PAGARE', tono: quota } : corso ? { parola: 'CORSO SCADUTO', tono: corso } : null,
    corsi: null,
  }
}

/** Con un'altra persona si riparte da PERSONA; dopo una ricevuta si torna alla QUOTA. */
export const schedaIniziale = (dopoRicevuta = false): IdScheda => (dopoRicevuta ? 'quota' : SCHEDA_INIZIALE)

/** Dal Banco: il tasto del problema porta alla scheda che lo sistema, ogni altra apertura a PERSONA. */
export function schedaPerApertura(tasto: string | null | undefined): IdScheda {
  if (tasto === 'quota') return 'quota'
  if (tasto === 'certificato') return 'documenti'
  return SCHEDA_INIZIALE
}
