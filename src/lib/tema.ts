import { useEffect, useState } from 'react'

/**
 * Il tema: nero, come il marchio, o bianco.
 *
 * Finché nessuno sceglie segue il dispositivo; chi tocca il tasto sceglie per
 * quel dispositivo, e la scelta resta. Il tema sta su `<html data-tema>`: i
 * colori li cambia `styles.css`, qui si decide soltanto quale.
 *
 * Il timer usa lo stesso tema con la stessa chiave: scelto in un'app, vale
 * anche nell'altra.
 */
export type Tema = 'scuro' | 'chiaro'

const DOVE = 'ods-tema'
const sistema = typeof window !== 'undefined' ? window.matchMedia?.('(prefers-color-scheme: light)') : undefined

// Senza localStorage la scelta vale finché la pagina resta aperta.
let inMemoria: Tema | null = null

function scelto(): Tema | null {
  try {
    const t = localStorage.getItem(DOVE)
    if (t === 'scuro' || t === 'chiaro') return t
  } catch {
    // niente: resta quella in memoria
  }
  return inMemoria
}

function attuale(): Tema {
  return scelto() ?? (sistema?.matches ? 'chiaro' : 'scuro')
}

const ascoltatori = new Set<(t: Tema) => void>()

function applica() {
  const t = attuale()
  document.documentElement.dataset.tema = t
  // La barra del browser e quella del telefono prendono il colore del fondo.
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t === 'chiaro' ? '#f4f4f1' : '#121212')
  ascoltatori.forEach((f) => f(t))
}

/** Da chiamare una volta, prima di disegnare l'app, così non lampeggia. */
export function avviaTema() {
  applica()
  sistema?.addEventListener?.('change', () => {
    if (!scelto()) applica()
  })
  // Il timer (nalbertini/Timer-) sta sullo stesso dominio e usa la stessa
  // chiave: se il tema si cambia lì, in un'altra scheda, cambia anche qui.
  window.addEventListener('storage', (e) => {
    if (e.key === DOVE || e.key === null) applica()
  })
}

export function scegliTema(t: Tema) {
  inMemoria = t
  try {
    localStorage.setItem(DOVE, t)
  } catch {
    // vedi sopra
  }
  applica()
}

export function useTema(): [Tema, () => void] {
  const [t, setT] = useState<Tema>(() => (document.documentElement.dataset.tema as Tema | undefined) ?? attuale())
  useEffect(() => {
    ascoltatori.add(setT)
    return () => {
      ascoltatori.delete(setT)
    }
  }, [])
  return [t, () => scegliTema(t === 'chiaro' ? 'scuro' : 'chiaro')]
}
