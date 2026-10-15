import { useEffect, useState } from 'react'

/**
 * Il tema: nero, come il marchio, bianco, o Tatami (paglia e verde muschio).
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
export type Tema = 'scuro' | 'chiaro' | 'tatami'

/** In quest'ordine passa il tasto: ogni tocco porta al successivo, dopo l'ultimo si ricomincia. */
export const TEMI: readonly Tema[] = ['scuro', 'chiaro', 'tatami']

/** Il colore della barra del browser e del telefono per ogni tema: quello del fondo. */
export const COLORE_BARRA: Record<Tema, string> = { scuro: '#121212', chiaro: '#f4f4f1', tatami: '#ebe6d0' }

/** Un valore salvato che non è esattamente uno dei temi (un altro nome, una versione più nuova) non conta. */
export function leggiTema(valore: unknown): Tema | null {
  return TEMI.find((t) => t === valore) ?? null
}

export function prossimoTema(t: Tema): Tema {
  return TEMI[(TEMI.indexOf(t) + 1) % TEMI.length]
}

const DOVE = 'ods-tema'
const sistema = typeof window !== 'undefined' ? window.matchMedia?.('(prefers-color-scheme: light)') : undefined

// Senza localStorage la scelta vale finché la pagina resta aperta.
let inMemoria: Tema | null = null

function scelto(): Tema | null {
  try {
    const t = leggiTema(localStorage.getItem(DOVE))
    if (t) return t
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
  return COLORE_BARRA[leggiTema(document.documentElement.dataset.tema) ?? 'scuro']
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
  const [t, setT] = useState<Tema>(() => leggiTema(document.documentElement.dataset.tema) ?? attuale())
  useEffect(() => {
    ascoltatori.add(setT)
    return () => {
      ascoltatori.delete(setT)
    }
  }, [])
  return [t, scegliTema]
}
