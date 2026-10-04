import { useSyncExternalStore } from 'react'

/** Vero finché la finestra soddisfa la media query: la schermata sceglie quante righe mostrare. */
export function useMedia(query: string): boolean {
  return useSyncExternalStore(
    (avvisa) => {
      const m = window.matchMedia(query)
      m.addEventListener('change', avvisa)
      return () => m.removeEventListener('change', avvisa)
    },
    () => window.matchMedia(query).matches,
    () => false,
  )
}
