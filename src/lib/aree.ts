import { useEffect, useState } from 'react'
import { eUnTablet } from './tablet'

/**
 * Le quattro facce dell'app, ognuna col suo indirizzo e la sua porta:
 *
 * - `#segreteria`: il computer della reception, solo per chi ha il ruolo di
 *   segreteria;
 * - `#iscrizioni`: la pagina pubblica, quella del link da mandare a chi vuole
 *   iscriversi, senza accesso;
 * - `#istruttori`: il calendario e l'appello, per istruttori e segreteria;
 * - `#sala`: il tablet appeso al muro (`#tablet`, il vecchio indirizzo, vale
 *   ancora).
 *
 * Senza niente in fondo all'indirizzo si apre una pagina con le quattro, a
 * meno che il dispositivo non sia un tablet di sala: quello riapre sempre il
 * tablet (vedi `eUnTablet`). Un indirizzo scritto vince sempre sul ricordo.
 */
export type Area = 'segreteria' | 'iscrizioni' | 'istruttori' | 'sala' | 'scelta'

export const INDIRIZZI: Record<Exclude<Area, 'scelta'>, string> = {
  segreteria: '#segreteria',
  iscrizioni: '#iscrizioni',
  istruttori: '#istruttori',
  sala: '#sala',
}

/**
 * Il timer delle lezioni, che è un'app a sé (nalbertini/Timer-): da qui c'è
 * solo il collegamento. Sta sullo stesso dominio, quindi i timer salvati sul
 * dispositivo sono quelli di sempre.
 */
export const TIMER = 'https://nalbertini.github.io/Timer-/'

function areaAdesso(): Area {
  // Va chiamata comunque: con `#sala` o `#tablet` è lei a ricordarselo.
  const tablet = eUnTablet()
  const scritta = Object.entries(INDIRIZZI).find(([, i]) => window.location.hash === i)?.[0] as Area | undefined
  return scritta ?? (tablet ? 'sala' : 'scelta')
}

/** L'area dell'indirizzo, che cambia coi link fra un'area e l'altra. */
export function useArea(): Area {
  const [area, setArea] = useState(areaAdesso)
  useEffect(() => {
    const cambia = () => setArea(areaAdesso())
    window.addEventListener('hashchange', cambia)
    return () => window.removeEventListener('hashchange', cambia)
  }, [])
  return area
}
