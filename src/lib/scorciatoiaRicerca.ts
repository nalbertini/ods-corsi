/**
 * ⌘K su Mac, Ctrl+K su Windows: apre la ricerca in una finestra. Con altri tasti insieme (⇧, ⌥) la
 * combinazione è di qualcun altro e si lascia stare.
 */
export const eScorciatoiaDiRicerca = (e: Pick<KeyboardEvent, 'key' | 'metaKey' | 'ctrlKey' | 'altKey' | 'shiftKey'>): boolean =>
  e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey

/** Esc nel campo della ricerca: nella finestra chiude subito (come il clic sul fondo); nel menu svuota il campo e ne esce. */
export const cosaFaEsc = (inFinestra: boolean): 'chiudi' | 'svuota-e-esci' => (inFinestra ? 'chiudi' : 'svuota-e-esci')
