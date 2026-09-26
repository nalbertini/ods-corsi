import { useEffect, useState } from 'react'

/**
 * Da qui in su lo schermo è largo abbastanza per calendario e appello uno
 * accanto all'altro: un computer, o un tablet tenuto in orizzontale. Sotto,
 * resta il telefono, una faccia per volta.
 *
 * La stessa soglia è in `styles.css`, nelle regole per lo schermo largo.
 */
export const LARGO = '(min-width: 960px)'

export function useLargo(): boolean {
  const [largo, setLargo] = useState(() => window.matchMedia(LARGO).matches)
  useEffect(() => {
    const m = window.matchMedia(LARGO)
    const cambia = () => setLargo(m.matches)
    m.addEventListener('change', cambia)
    return () => m.removeEventListener('change', cambia)
  }, [])
  return largo
}
