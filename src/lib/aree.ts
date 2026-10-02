import { useEffect, useState } from 'react'
import { eUnTablet } from './tablet'
import { areaDelPercorso } from './percorso'
import { eIndirizzoGuida } from './guida'

/**
 * Le facce dell'app, ognuna col suo indirizzo vero e la sua porta:
 *
 * - `segreteria/`: il computer della reception, solo per chi ha il ruolo di
 *   segreteria;
 * - `iscrizioni/`: la pagina pubblica, quella del link da mandare a chi vuole
 *   iscriversi, senza accesso;
 * - `iscritti/`: la pagina di chi frequenta i corsi, col suo calendario, le
 *   presenze, il certificato e le ricevute; per ora solo in prova (vedi
 *   `iscritto.ts`);
 * - `istruttori/`: il calendario e l'appello, per istruttori e segreteria;
 * - `sala/`: il tablet appeso al muro.
 *
 * Sono cartelle vere del sito (`…/ods-corsi/segreteria/`): GitHub Pages non sa
 * rimandare un indirizzo qualunque all'app, quindi la compilazione mette in
 * ogni cartella una copia della pagina, con `<base href="../">` perché i file
 * relativi (lo stile, i moduli, il timer, la guida) si prendano dalla radice
 * come prima. Vedi `pagineDelleAree` in `vite.config.ts`. Per lo stesso motivo
 * gli indirizzi qui sotto sono relativi alla radice: scritti in un link, da
 * qualunque area, portano all'area giusta.
 *
 * I vecchi indirizzi col cancelletto (`#segreteria`, `#sala`, `#tablet`…)
 * valgono ancora: portano all'indirizzo nuovo (vedi `vecchioIndirizzo`), così
 * i tablet già appesi e i link già mandati continuano a funzionare.
 *
 * E poi la guida, `#guida`, con un indirizzo per pagina (`#guida/sala`), che
 * non ha porta e sta sulla radice: vedi `guida.ts`.
 *
 * Senza niente in fondo all'indirizzo si apre una pagina con tutte, a
 * meno che il dispositivo non sia un tablet di sala: quello va sempre al
 * tablet (vedi `eUnTablet`). Un indirizzo scritto vince sempre sul ricordo:
 * per questo la pagina con tutte ha anche il suo, `#aree`, ed è lì che
 * portano i link «tutte le aree». Con la radice e basta, un dispositivo che
 * una volta ha aperto `sala/` tornerebbe al tablet.
 */
export type Area = 'segreteria' | 'iscrizioni' | 'iscritti' | 'istruttori' | 'sala' | 'guida' | 'scelta'

export type AreaConIndirizzo = Exclude<Area, 'scelta' | 'guida'>

export const INDIRIZZI: Record<AreaConIndirizzo, string> = {
  segreteria: 'segreteria/',
  iscrizioni: 'iscrizioni/',
  iscritti: 'iscritti/',
  istruttori: 'istruttori/',
  sala: 'sala/',
}

/** La pagina con tutte le aree, anche su un dispositivo che si ricorda di essere un tablet. */
export const INDIRIZZO_AREE = '#aree'

/**
 * Un indirizzo di questa pagina, intero. Relativo alla base del documento,
 * che nelle cartelle delle aree è la radice: `indirizzo('sala/')` è la sala da
 * qualunque area lo si chieda.
 */
export const indirizzo = (relativo: string) => new URL(relativo, document.baseURI).href

/** Va a un'altra area, come un link. */
export function vaiA(area: AreaConIndirizzo) {
  window.location.assign(indirizzo(INDIRIZZI[area]))
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
  // Va chiamata comunque: con `sala/` è lei a ricordarselo.
  const tablet = eUnTablet()
  const scritta = areaDelPercorso()
  if (scritta) return scritta
  // La guida ha un indirizzo per pagina (`#guida/sala`): si riconosce dal
  // principio, e vale anche su un tablet di sala.
  if (eIndirizzoGuida(window.location.hash)) return 'guida'
  if (window.location.hash === INDIRIZZO_AREE) return 'scelta'
  return tablet ? 'sala' : 'scelta'
}

/**
 * Dove va chi arriva da un indirizzo vecchio, o `null` se l'indirizzo va bene
 * così: `#segreteria` diventa `segreteria/`, `#sala` e `#tablet` `sala/`, e
 * un tablet di sala aperto dalla radice (l'app installata parte da lì) va a
 * `sala/`. La query resta: `?adesso=…` serve alle prove.
 */
export function vecchioIndirizzo(): string | null {
  if (areaDelPercorso()) return null
  const h = window.location.hash.slice(1)
  const area = h === 'tablet' ? 'sala' : (Object.keys(INDIRIZZI) as AreaConIndirizzo[]).find((a) => a === h)
  const verso = area ?? (areaAdesso() === 'sala' ? 'sala' : null)
  return verso ? indirizzo(INDIRIZZI[verso] + window.location.search) : null
}

/** L'area dell'indirizzo, che cambia coi link fra un'area e l'altra. */
export function useArea(): Area {
  const [area, setArea] = useState(areaAdesso)
  useEffect(() => {
    // Fra le aree si cambia pagina; resta il cancelletto, per la guida e `#aree`.
    const cambia = () => setArea(areaAdesso())
    window.addEventListener('hashchange', cambia)
    return () => window.removeEventListener('hashchange', cambia)
  }, [])
  return area
}
