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
  return useSchermo(LARGO)
}

/**
 * Il telefono della segreteria: il menu si chiude dietro il tasto MENU. È la
 * stessa di `@media (max-width: 767px)` in `styles.css`.
 */
export const TELEFONO = '(max-width: 767px)'

/** Se lo schermo risponde a una media query, e si aggiorna quando cambia. */
export function useSchermo(query: string): boolean {
  const [si, setSi] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const m = window.matchMedia(query)
    const cambia = () => setSi(m.matches)
    cambia()
    m.addEventListener('change', cambia)
    return () => m.removeEventListener('change', cambia)
  }, [query])
  return si
}
