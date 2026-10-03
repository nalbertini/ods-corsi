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
 * Sotto questa soglia CORSI e RICHIESTE non mettono la scheda accanto
 * all'elenco: la aprono al posto suo. Il menu (240 px), l'elenco (470) e una
 * scheda che si legga (almeno 420) vogliono 1240 px: a 1024, il portatile
 * della reception, la scheda restava larga 210 e i campi uscivano. È la
 * stessa di `@media (max-width: 1240px)` in `styles.css`.
 */
export const STRETTO = '(max-width: 1240px)'

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
