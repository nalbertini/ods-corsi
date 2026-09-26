import { useEffect, useState } from 'react'
import { eUnTablet } from './tablet'
import { eIndirizzoGuida } from './guida'

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
 * E poi la guida, `#guida`, con un indirizzo per pagina (`#guida/sala`), che
 * non ha porta: vedi `guida.ts`.
 *
 * Senza niente in fondo all'indirizzo si apre una pagina con le quattro, a
 * meno che il dispositivo non sia un tablet di sala: quello riapre sempre il
 * tablet (vedi `eUnTablet`). Un indirizzo scritto vince sempre sul ricordo.
 */
export type Area = 'segreteria' | 'iscrizioni' | 'istruttori' | 'sala' | 'guida' | 'scelta'

export const INDIRIZZI: Record<Exclude<Area, 'scelta' | 'guida'>, string> = {
  segreteria: '#segreteria',
  iscrizioni: '#iscrizioni',
  istruttori: '#istruttori',
  sala: '#sala',
}

/**
 * Il timer delle lezioni. Il codice sta in `timer/`, in questo repository, ma
 * resta un'app a sé con il suo service worker: si pubblica nella sottocartella
 * `timer/` dello stesso sito, e da qui c'è il collegamento. Relativo, così vale
 * dovunque sia pubblicata l'app; e l'origine resta la stessa, quindi i timer
 * salvati sul dispositivo sono quelli di sempre.
 */
export const TIMER = 'timer/'

/**
 * Il timer aperto da una lezione: in cima ci sono i timer del suo corso, e lo
 * storico si ricorda in che lezione sono partiti (vedi `timer/src/lib/lezione.ts`).
 * Nella query e non nel frammento, che nel timer è dei timer mandati col QR.
 */
export function timerDellaLezione(l: { id: string; corsoId: string; corso: string }): string {
  const q = new URLSearchParams({ corso: l.corsoId, lezione: l.id, nome: l.corso })
  return `${TIMER}?${q.toString()}`
}

function areaAdesso(): Area {
  // Va chiamata comunque: con `#sala` o `#tablet` è lei a ricordarselo.
  const tablet = eUnTablet()
  // La guida ha un indirizzo per pagina (`#guida/sala`): si riconosce dal
  // principio, e vale anche su un tablet di sala.
  if (eIndirizzoGuida(window.location.hash)) return 'guida'
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
