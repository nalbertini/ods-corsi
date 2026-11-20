import { diAltriDiTutte, inCodaDiTutte, mandaTutto, svuotaTutte, type DiAltri } from './coda'

/**
 * Uscire senza perdere in silenzio le scritture non ancora arrivate.
 *
 * Il tablet o il PC della palestra sono di tutti: la coda sta in
 * `localStorage`, e quel che resta dopo l'uscita lo rilegge e lo riesegue il
 * prossimo account, col suo token (presenze attribuite a lui, o rifiutate).
 * Perciò prima si prova a mandare tutto, ancora col token giusto; se qualcosa
 * resta, si chiede a chi esce; e quando si esce la coda si svuota. Le
 * presenze di un altro account non partono col token di chi esce: si contano,
 * si dice di chi sono, e si perdono solo con ESCI LO STESSO.
 */

export interface Pendenza {
  /** Solo quelle di chi esce: le altre stanno in `diAltri`. */
  quante: number
  diAltri: DiAltri[]
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

const elenco = (nomi: string[]) => (nomi.length < 2 ? nomi.join('') : `${nomi.slice(0, -1).join(', ')} e ${nomi[nomi.length - 1]}`)
const presenze = (n: number) => `${n} ${n === 1 ? 'presenza' : 'presenze'}`

/** Le parole di «Uscire adesso?»: chi esce deve sapere quante sono sue e quante aspettano un altro. */
export function testoUscita({ quante, diAltri }: Pick<Pendenza, 'quante' | 'diAltri'>): string {
  if (!diAltri.length) return `${avvisoUscita(quante)} Se torna la rete partono da sole: premi TORNA e aspetta.`
  const nomi = elenco(diAltri.map((a) => a.nome || 'un altro account'))
  const altre = diAltri.reduce((t, a) => t + a.quante, 0)
  const testa =
    quante + altre === 1
      ? `C’è 1 presenza di ${nomi} non ancora arrivata: ESCI LO STESSO la perde.`
      : `Ci sono ${quante ? `${presenze(quante)} ${quante === 1 ? 'tua' : 'tue'} e ` : ''}${presenze(altre)} di ${nomi} non ancora arrivate: ESCI LO STESSO le perde tutte.`
  if (quante) return `${testa} Se torna la rete le tue partono da sole: premi TORNA e aspetta.`
  const una = altre === 1
  return `${testa} ${una ? 'Parte' : 'Partono'} solo quando ${nomi} ${diAltri.length === 1 ? 'entra' : 'entrano'} di nuovo: premi TORNA per ${una ? 'lasciarla' : 'lasciarle'} qui.`
}

/**
 * Esegue `fai` (l'uscita vera) se non si perde niente, altrimenti chiede.
 * Dice se è uscito: `false` vuol dire che aspetta la risposta all'avviso.
 * `attesaMs`: quanto aspettare il server prima di dire che non risponde.
 */
export async function uscita(fai: () => Promise<void>, attesaMs = 4000): Promise<boolean> {
  await mandaTutto(attesaMs)
  const tutte = inCodaDiTutte()
  const diAltri = diAltriDiTutte()
  const quante = tutte - diAltri.reduce((t, a) => t + a.quante, 0)
  const esciComunque = async () => {
    svuotaTutte()
    await fai()
  }
  if (!tutte) {
    await esciComunque()
    return true
  }
  // Senza nessuno che mostri l'avviso non si esce: meglio restare che perdere.
  for (const f of ascoltatori) f({ quante, diAltri, esciComunque })
  return false
}
