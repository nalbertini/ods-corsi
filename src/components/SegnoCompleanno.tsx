import { Torta } from './Icons'

/**
 * «È il compleanno di questa persona oggi»: torta e parola, mai l'età. È un
 * avviso e basta, quindi non si tocca. Fuori dal look sito è giallo e nero
 * fisso; nel look sito (sala e istruttori) è giallo scritto con un filo.
 * `torta` è la sola torta, per le tessere troppo strette per la parola: chi
 * legge lo schermo la trova nell'aria-label della tessera.
 */
export function SegnoCompleanno({ misura = 'tablet' }: { misura?: 'tablet' | 'telefono' | 'torta' }) {
  return (
    <span className="segno-compleanno" data-misura={misura} aria-hidden={misura === 'torta' ? true : undefined}>
      <Torta size={misura === 'telefono' ? 14 : 22} />
      {misura !== 'torta' && 'COMPLEANNO'}
    </span>
  )
}
