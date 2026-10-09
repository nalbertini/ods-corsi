import { useEffect, useRef, useSyncExternalStore } from 'react'
import { leggiLink, monta } from '../lib/youtube'

/**
 * Il lettore di YouTube, uno solo per tutta l'app.
 *
 * Un iframe spostato da un punto all'altro della pagina si ricarica, e la
 * musica ripartirebbe da capo a ogni cambio di scheda. Allora il lettore non
 * si sposta: sta fermo alla radice dell'app, e si *appoggia* sopra il posto
 * che la schermata di turno gli ha preparato — la barra delle schede, quella
 * del timer. Cambiando schermata cambia il posto, non il lettore.
 *
 * Dove un posto non c'è (l'editor, lo storico…) il lettore resta visibile in
 * un angolo, come YouTube vuole: nascosto, smetterebbe di suonare. Chi ha
 * delle barre in basso alza l'angolo con `--angolo-player`.
 */

/* ---------- i posti ---------- */

let posti: HTMLElement[] = []
const ascoltatori = new Set<() => void>()
const avvisa = () => ascoltatori.forEach((f) => f())
const ascolta = (f: () => void) => {
  ascoltatori.add(f)
  return () => {
    ascoltatori.delete(f)
  }
}
/** L'ultimo posto montato è quello della schermata in primo piano. */
const postoAttivo = () => posti[posti.length - 1] ?? null

/** Il posto del lettore dentro una schermata: un riquadro vuoto da 200×200. */
export function PostoPlayer() {
  const el = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const e = el.current
    if (!e) return
    posti = [...posti, e]
    avvisa()
    return () => {
      posti = posti.filter((p) => p !== e)
      avvisa()
    }
  }, [])
  return <div className="musica-video" ref={el} />
}

/** Il lettore vero: da montare una volta, alla radice dell'app. */
export function PlayerYoutube({ link, parti = false }: { link: string; parti?: boolean }) {
  const host = useRef<HTMLDivElement>(null)
  // Vale al momento del montaggio: un link scelto adesso, col dito, parte da solo.
  const partiRef = useRef(parti)
  partiRef.current = parti
  const posto = useSyncExternalStore(ascolta, postoAttivo)

  useEffect(() => {
    const s = leggiLink(link)
    if (!host.current || !s) return
    return monta(host.current, s, partiRef.current)
  }, [link])

  // Segue il posto a ogni fotogramma: il posto si sposta anche senza cambiare
  // misura (una riga che compare sopra, la tastiera che si apre), e nessun
  // osservatore del browser lo dice. Leggere un rettangolo costa poco.
  useEffect(() => {
    const h = host.current
    if (!h) return
    let giro = 0
    let prima = ''
    const segui = () => {
      const r = posto?.getBoundingClientRect()
      const visibile = r && r.width > 0 && r.height > 0
      const stile = visibile
        ? `left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px`
        : 'right:12px;bottom:calc(var(--angolo-player, 0px) + env(safe-area-inset-bottom) + 12px);width:200px;height:200px'
      if (stile !== prima) {
        prima = stile
        h.setAttribute('style', stile)
        h.dataset.angolo = String(!visibile)
      }
      giro = requestAnimationFrame(segui)
    }
    segui()
    return () => cancelAnimationFrame(giro)
  }, [posto])

  return <div className="player-youtube" ref={host} />
}
