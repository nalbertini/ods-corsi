import { useEffect, useState } from 'react'

/**
 * L'aspetto della segreteria: com'è oggi, col menu a sinistra, o «Il Banco»,
 * con la ricerca in cima e cinque luoghi.
 *
 * Come il tema: la scelta vale per questo computer e resta dopo la ricarica.
 * Chi non sceglie vede la segreteria di sempre, così nessuno trova un'app
 * cambiata senza averlo voluto.
 */
export type Aspetto = 'oggi' | 'banco'

const DOVE = 'ods-aspetto'

// Senza localStorage la scelta vale finché la pagina resta aperta.
let inMemoria: Aspetto = 'oggi'

/** Un valore salvato che non si capisce (vecchio, storpiato) torna all'aspetto di oggi, senza errori. */
export const aspettoDa = (valore: unknown): Aspetto => (valore === 'banco' ? 'banco' : 'oggi')

export function leggiAspetto(): Aspetto {
  try {
    const v = localStorage.getItem(DOVE)
    if (v !== null) return aspettoDa(v)
  } catch {
    // niente: vale quella in memoria
  }
  return inMemoria
}

const ascoltatori = new Set<(a: Aspetto) => void>()

export function scegliAspetto(a: Aspetto) {
  inMemoria = a
  try {
    localStorage.setItem(DOVE, a)
  } catch {
    // vedi sopra
  }
  ascoltatori.forEach((f) => f(a))
}

/** Sul telefono Il Banco non c'è ancora (non è disegnato): sotto i 768px resta l'aspetto di oggi. */
/** E il Banco è della segreteria: chi cura solo i conti (`conSegreteria` falso) ha l'aspetto di sempre. */
export const aspettoInUso = (scelto: Aspetto, telefono: boolean, conSegreteria = true): Aspetto => (telefono || !conSegreteria ? 'oggi' : scelto)

export function useAspetto(): [Aspetto, (a: Aspetto) => void] {
  const [a, setA] = useState<Aspetto>(leggiAspetto)
  useEffect(() => {
    ascoltatori.add(setA)
    return () => {
      ascoltatori.delete(setA)
    }
  }, [])
  return [a, scegliAspetto]
}
