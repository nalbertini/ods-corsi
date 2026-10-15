import { inCodaDiTutte, mandaTutto, svuotaTutte } from './coda'

/**
 * Uscire senza perdere in silenzio le scritture non ancora arrivate.
 *
 * Il tablet o il PC della palestra sono di tutti: la coda sta in
 * `localStorage`, e quel che resta dopo l'uscita lo rilegge e lo riesegue il
 * prossimo account, col suo token (presenze attribuite a lui, o rifiutate).
 * Perciò prima si prova a mandare tutto, ancora col token giusto; se qualcosa
 * resta, si chiede a chi esce; e quando si esce la coda si svuota.
 */

export interface Pendenza {
  quante: number
  /** ESCI LO STESSO: butta le scritture e porta a termine l'uscita. */
  esciComunque(): Promise<void>
}

const ascoltatori = new Set<(p: Pendenza | null) => void>()

/** Chi mostra l'avviso (vedi `AvvisoUscita`). */
export function guardaUscita(f: (p: Pendenza | null) => void): () => void {
  ascoltatori.add(f)
  return () => ascoltatori.delete(f)
}

export const avvisoUscita = (n: number) =>
  `${n === 1 ? 'C’è 1 cosa non ancora arrivata' : `Ci sono ${n} cose non ancora arrivate`}: ESCI LO STESSO ${n === 1 ? 'la' : 'le'} perde.`

/**
 * Esegue `fai` (l'uscita vera) se non si perde niente, altrimenti chiede.
 * `attesaMs`: quanto aspettare il server prima di dire che non risponde.
 */
export async function uscita(fai: () => Promise<void>, attesaMs = 4000): Promise<void> {
  await mandaTutto(attesaMs)
  const quante = inCodaDiTutte()
  const esciComunque = async () => {
    svuotaTutte()
    await fai()
  }
  if (!quante) return esciComunque()
  // Senza nessuno che mostri l'avviso non si esce: meglio restare che perdere.
  if (!ascoltatori.size) throw new Error('Ci sono scritture non ancora arrivate: aspetta che torni la rete e riprova')
  for (const f of ascoltatori) f({ quante, esciComunque })
}
