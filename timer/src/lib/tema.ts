import { useEffect, useState } from 'react'

/**
 * Il tema: nero, come il marchio, o bianco.
 *
 * Finché nessuno sceglie segue il dispositivo; chi sceglie sceglie per quel
 * dispositivo, e la scelta resta. Il tema sta su `<html data-tema>`: i colori
 * li cambia `styles.css`, qui si decide soltanto quale.
 *
 * È lo stesso di ODS Corsi (nalbertini/ods-corsi, `src/lib/tema.ts`), con la
 * stessa chiave: le due app stanno sullo stesso dominio e quindi nello stesso
 * `localStorage`, e il tema scelto in una vale anche nell'altra. Se una delle
 * due è aperta in un'altra scheda, cambia anche lì (l'evento `storage`).
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
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', coloreFondo())
  ascoltatori.forEach((f) => f(t))
}

/** Da chiamare una volta, prima di disegnare l'app, così non lampeggia. */
export function avviaTema() {
  applica()
  sistema?.addEventListener?.('change', () => {
    if (!scelto()) applica()
  })
  window.addEventListener('storage', (e) => {
    if (e.key === DOVE || e.key === null) applica()
  })
}

/** Il colore del fondo, per la barra del browser quando nessuno la colora. */
export function coloreFondo(): string {
  return document.documentElement.dataset.tema === 'chiaro' ? '#f4f4f1' : '#121212'
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

export function useTema(): [Tema, (t: Tema) => void] {
  const [t, setT] = useState<Tema>(() => (document.documentElement.dataset.tema as Tema | undefined) ?? attuale())
  useEffect(() => {
    ascoltatori.add(setT)
    return () => {
      ascoltatori.delete(setT)
    }
  }, [])
  return [t, scegliTema]
}
