import { useEffect, useState } from 'react'

/**
 * Il tema: nero, come il marchio, bianco, o Tatami (paglia e verde muschio).
 *
 * Finché nessuno sceglie segue il dispositivo; chi tocca il tasto sceglie per
 * quel dispositivo, e la scelta resta. Il tema sta su `<html data-tema>`: i
 * colori li cambia `styles.css`, qui si decide soltanto quale.
 *
 * Il timer usa lo stesso tema con la stessa chiave: scelto in un'app, vale
 * anche nell'altra.
 */
export type Tema = 'scuro' | 'chiaro' | 'tatami'

/** In quest'ordine passa il tasto: ogni tocco porta al successivo, dopo l'ultimo si ricomincia. */
export const TEMI: readonly Tema[] = ['scuro', 'chiaro', 'tatami']

/** Il colore della barra del browser e del telefono per ogni tema: quello del fondo. */
export const COLORE_BARRA: Record<Tema, string> = { scuro: '#121212', chiaro: '#f4f4f1', tatami: '#ebe6d0' }

/** La barra con il look del sito (vedi `lookDellArea`): il fondo di quell'aspetto, qualunque sia il tema scelto. */
export const COLORE_BARRA_LOOK = '#eef5fa'

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
  const html = document.documentElement
  // Col look del sito (`aspettoSegreteria.ts`) il tema è sempre il chiaro: la scelta salvata non si tocca, vale per le altre aree.
  const look = !!html.dataset.look
  const t = look ? 'chiaro' : attuale()
  html.dataset.tema = t
  // La barra del browser e quella del telefono prendono il colore del fondo,
  // tranne nel modulo di iscrizione, che è sempre chiaro (`aspettoModulo.ts`).
  const barra = look ? COLORE_BARRA_LOOK : html.dataset.modulo ? null : COLORE_BARRA[t]
  if (barra) document.querySelector('meta[name="theme-color"]')?.setAttribute('content', barra)
  ascoltatori.forEach((f) => f(t))
}

/** Per chi cambia l'aspetto dell'area dopo l'avvio: rifà il tema com'è adesso. */
export function riapplicaTema() {
  applica()
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
  const [t, setT] = useState<Tema>(() => leggiTema(document.documentElement.dataset.tema) ?? attuale())
  useEffect(() => {
    ascoltatori.add(setT)
    return () => {
      ascoltatori.delete(setT)
    }
  }, [])
  return [t, () => scegliTema(prossimoTema(t))]
}
