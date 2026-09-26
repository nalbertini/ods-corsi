import type { SegmentKind } from '../types'

/**
 * Le illustrazioni di Maurizio.
 *
 * Non sono precaricate con l'app: restano fuori dalla precache e si scaricano
 * la prima volta che servono, così chi non usa la modalità non se le porta
 * dietro. Da quel momento restano in cache e funzionano anche offline.
 */
const url = (nome: string) => `adesivi/${nome}.webp`

/** Quando lo becchi a sbagliare il conto: al centro, con la frase. */
export const BECCATO = ['meno-pause', 'cronometro', 'indica', 'idea', 'carponi'].map(url)

/** A fine allenamento. */
export const FINALE = ['ottimo-lavoro', 'esultanza', 'maurizio-innella', 'inchino', 'borsa'].map(url)

/**
 * Gli stati tranquilli: piccole, in un angolo. Il lavoro non ne ha, di
 * proposito — durante lo sforzo lo schermo deve dire solo il tempo.
 */
const PER_STATO: Partial<Record<SegmentKind, string[]>> = {
  prepare: ['meditazione', 'scrivania'],
  rest: ['borraccia', 'pollice-su', 'shaka', 'cuore'],
  setRest: ['dorme', 'braccia-conserte', 'cuore'],
  cooldown: ['meditazione', 'dorme'],
}

export const a_caso = (lista: string[]) => lista[Math.floor(Math.random() * lista.length)]

/** L'illustrazione dello stato, o null se quello stato non ne prevede. */
export function perStato(kind: SegmentKind | undefined): string | null {
  const lista = kind ? PER_STATO[kind] : undefined
  return lista ? url(a_caso(lista)) : null
}
