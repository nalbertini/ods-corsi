import { useEffect, useRef } from 'react'

/**
 * Il riquadro dove si firma col dito, o col mouse dal computer.
 *
 * La firma si tiene come tratti, punti in pixel del riquadro, e non come
 * immagine: sullo schermo si disegna col colore del tema (bianca sul fondo
 * scuro), e per il modulo se ne fa un PNG a parte, con l'inchiostro blu della
 * penna, su fondo trasparente e ritagliato attorno alla firma (`firmaPng`).
 */

export type Tratto = Array<[number, number]>

const SPESSORE = 2.6

/** Abbastanza segno da essere una firma e non un tocco per sbaglio. */
export function firmaVera(tratti: readonly Tratto[]): boolean {
  let lungo = 0
  let [x0, x1] = [Infinity, -Infinity]
  for (const t of tratti)
    t.forEach(([x, y], i) => {
      x0 = Math.min(x0, x)
      x1 = Math.max(x1, x)
      if (i) lungo += Math.hypot(x - t[i - 1][0], y - t[i - 1][1])
    })
  return lungo >= 60 && x1 - x0 >= 40
}

function disegna(g: CanvasRenderingContext2D, tratti: readonly Tratto[], dx = 0, dy = 0) {
  g.lineCap = 'round'
  g.lineJoin = 'round'
  for (const t of tratti) {
    g.beginPath()
    t.forEach(([x, y], i) => (i ? g.lineTo(x - dx, y - dy) : g.moveTo(x - dx, y - dy)))
    // Un tocco solo è un punto.
    if (t.length === 1) g.lineTo(t[0][0] - dx + 0.1, t[0][1] - dy)
    g.stroke()
  }
}

/** La firma per il modulo: PNG trasparente, blu, tre volte più fitto dello schermo. */
export async function firmaPng(tratti: readonly Tratto[]): Promise<Uint8Array> {
  const punti = tratti.flat()
  const m = SPESSORE * 2
  const x0 = Math.min(...punti.map((p) => p[0])) - m
  const y0 = Math.min(...punti.map((p) => p[1])) - m
  const w = Math.max(...punti.map((p) => p[0])) - x0 + m
  const h = Math.max(...punti.map((p) => p[1])) - y0 + m
  const scala = 3
  const tela = document.createElement('canvas')
  tela.width = Math.ceil(w * scala)
  tela.height = Math.ceil(h * scala)
  const g = tela.getContext('2d')!
  g.scale(scala, scala)
  g.strokeStyle = '#142985'
  g.lineWidth = SPESSORE
  disegna(g, tratti, x0, y0)
  const blob = await new Promise<Blob | null>((ok) => tela.toBlob(ok, 'image/png'))
  if (!blob) throw new Error('La firma non si salva')
  return new Uint8Array(await blob.arrayBuffer())
}

export function TavolaFirma({ id, tratti, onTratti, descritto }: { id: string; tratti: readonly Tratto[]; onTratti: (t: Tratto[]) => void; descritto?: string }) {
  const tela = useRef<HTMLCanvasElement>(null)
  const inCorso = useRef<Tratto | null>(null)
  // Per il ridisegno dopo un cambio di misura, senza rifare l'osservatore.
  const ultimi = useRef(tratti)
  ultimi.current = tratti

  const ridisegna = () => {
    const c = tela.current
    if (!c) return
    const g = c.getContext('2d')!
    const r = window.devicePixelRatio || 1
    g.setTransform(r, 0, 0, r, 0, 0)
    g.clearRect(0, 0, c.width, c.height)
    g.strokeStyle = getComputedStyle(c).color
    g.lineWidth = SPESSORE
    disegna(g, inCorso.current ? [...ultimi.current, inCorso.current] : ultimi.current)
  }

  // La tela ha i pixel dello schermo, non quelli CSS, se no la firma è sfocata.
  useEffect(() => {
    const c = tela.current
    if (!c) return
    const misura = () => {
      const r = window.devicePixelRatio || 1
      const { width, height } = c.getBoundingClientRect()
      c.width = Math.round(width * r)
      c.height = Math.round(height * r)
      ridisegna()
    }
    misura()
    const o = typeof ResizeObserver === 'function' ? new ResizeObserver(misura) : null
    o?.observe(c)
    // Il tema scuro o chiaro cambia il colore dell'inchiostro sullo schermo.
    const tema = new MutationObserver(ridisegna)
    tema.observe(document.documentElement, { attributes: true })
    return () => {
      o?.disconnect()
      tema.disconnect()
    }
  }, [])

  useEffect(ridisegna)

  const punto = (e: { clientX: number; clientY: number }): [number, number] => {
    const r = tela.current!.getBoundingClientRect()
    return [Math.round((e.clientX - r.left) * 10) / 10, Math.round((e.clientY - r.top) * 10) / 10]
  }
  const fine = () => {
    const t = inCorso.current
    inCorso.current = null
    if (t) onTratti([...tratti, t])
  }

  return (
    <div className="firma" data-vuota={!tratti.length || undefined}>
      <canvas
        id={id}
        // Senza tabindex il fuoco non ci arriva: VAI A: FIRMA della barra non lo sposterebbe.
        tabIndex={-1}
        ref={tela}
        className="firma-tela"
        role="img"
        aria-label={tratti.length ? 'La firma' : 'Il riquadro della firma, vuoto'}
        aria-describedby={descritto}
        onPointerDown={(e) => {
          if (e.button !== 0) return
          e.currentTarget.setPointerCapture(e.pointerId)
          inCorso.current = [punto(e)]
          ridisegna()
        }}
        onPointerMove={(e) => {
          const t = inCorso.current
          if (!t) return
          const tutti = typeof e.nativeEvent.getCoalescedEvents === 'function' ? e.nativeEvent.getCoalescedEvents() : []
          for (const x of tutti.length ? tutti : [e]) t.push(punto(x))
          ridisegna()
        }}
        onPointerUp={fine}
        onPointerCancel={fine}
      />
      <span className="firma-riga" aria-hidden />
      {!tratti.length && (
        <span className="firma-invito" aria-hidden>
          FIRMA QUI COL DITO
        </span>
      )}
    </div>
  )
}
