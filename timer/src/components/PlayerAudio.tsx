import { useEffect, useRef } from 'react'
import { avvia } from '../lib/musicaAudio'

/**
 * Il suono dei file e della radio: da montare una volta, alla radice, come
 * `PlayerYoutube`. Non disegna niente: cambiando scheda o aprendo un
 * allenamento il suono non si interrompe, e cambiando fonte si smonta e si ferma.
 */
export function PlayerAudio({
  fonte,
  link,
  nome,
  parti = false,
}: {
  fonte: 'file' | 'radio'
  link: string
  nome: string
  parti?: boolean
}) {
  // Vale al montaggio: una radio scelta adesso, col dito, parte da sola.
  const partiRef = useRef(parti)
  partiRef.current = parti
  useEffect(() => avvia(fonte, link, nome, partiRef.current), [fonte, link, nome])
  return null
}
