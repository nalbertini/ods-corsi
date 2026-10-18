import { useEffect, useState } from 'react'
import { preferenzaStriscia, valorePreferenzaStriscia } from './cosaManca'

/**
 * Se la striscia COSA MANCA si vede, su questo dispositivo. Si sceglie da IMPOSTAZIONI e si ricorda qui, come il tema:
 * niente nel database, ognuno decide per il suo schermo. Senza `localStorage` (navigazione privata) vale finché la pagina resta aperta.
 */
const DOVE = 'ods-striscia'

let inMemoria: boolean | null = null
const ascoltatori = new Set<(voluta: boolean) => void>()

function attuale(): boolean {
  let salvato: string | null = null
  try {
    salvato = localStorage.getItem(DOVE)
  } catch {
    // niente: vale quella in memoria, o la striscia visibile
  }
  return preferenzaStriscia(salvato, inMemoria)
}

function scegli(voluta: boolean) {
  inMemoria = voluta
  try {
    localStorage.setItem(DOVE, valorePreferenzaStriscia(voluta))
  } catch {
    // niente: resta quella in memoria
  }
  ascoltatori.forEach((f) => f(voluta))
}

export function useStrisciaVoluta(): [boolean, (voluta: boolean) => void] {
  const [voluta, setVoluta] = useState(attuale)
  useEffect(() => {
    ascoltatori.add(setVoluta)
    // La stessa scelta fatta in un'altra scheda si vede anche qui.
    const altra = (e: StorageEvent) => {
      if (e.key !== DOVE && e.key !== null) return
      // La scelta fatta in un'altra scheda vale più di quella tenuta in memoria qui.
      inMemoria = null
      setVoluta(attuale())
    }
    window.addEventListener('storage', altra)
    return () => {
      ascoltatori.delete(setVoluta)
      window.removeEventListener('storage', altra)
    }
  }, [])
  return [voluta, scegli]
}
