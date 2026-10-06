import { type ReactNode, type RefObject, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { adattaTratti, daIsolare, firmaVera, limitaPunto, orientamento, risultatoFatto, serveBack, trattoVero, type Tratto } from '../lib/tratti'

/**
 * Il riquadro dove si firma col dito, o col mouse dal computer.
 *
 * La firma si tiene come tratti, punti in pixel del riquadro, e non come
 * immagine: sullo schermo si disegna col colore del tema (bianca sul fondo
 * scuro), e per il modulo se ne fa un PNG a parte, con l'inchiostro blu della
 * penna, su fondo trasparente e ritagliato attorno alla firma (`firmaPng`).
 */

// `Tratto` e `firmaVera` stanno in src/lib/tratti (con le prove); qui si riesportano
// perché i moduli li importano da questo file.
export { firmaVera, type Tratto }

const SPESSORE = 2.6

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

/**
 * La tela dove si disegna, la stessa nel riquadro piccolo e a schermo intero.
 * `limita` tiene i punti nei bordi (riquadro piccolo); `onTocco` riceve un
 * tocco senza movimento al posto di un tratto (apre lo schermo intero).
 */
function Tela({ id, tratti, onTratti, onTocco, limita, descritto }: { id?: string; tratti: readonly Tratto[]; onTratti: (t: Tratto[]) => void; onTocco?: () => void; limita?: boolean; descritto?: string }) {
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
    const p: [number, number] = [Math.round((e.clientX - r.left) * 10) / 10, Math.round((e.clientY - r.top) * 10) / 10]
    return limita ? limitaPunto(p, r.width, r.height) : p
  }
  const fine = () => {
    const t = inCorso.current
    inCorso.current = null
    if (!t) return
    if (onTocco && !trattoVero(t)) {
      ridisegna()
      onTocco()
    } else onTratti([...tratti, t])
  }

  return (
    <canvas
      id={id}
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
  )
}

/** Il riquadro con la riga e l'invito, lo stesso in piccolo e a schermo intero. */
function RiquadroFirma({ classe, rif, vuota, children }: { classe: string; rif?: RefObject<HTMLDivElement>; vuota: boolean; children: ReactNode }) {
  return (
    <div ref={rif} className={classe} data-vuota={vuota || undefined}>
      {children}
      <span className="firma-riga" aria-hidden />
      {vuota && (
        <span className="firma-invito" aria-hidden>
          FIRMA QUI COL DITO
        </span>
      )}
    </div>
  )
}

/**
 * La firma a schermo intero (design: FirmaSchermoIntero.dc.html). Una bozza:
 * ANNULLA la butta, FATTO la porta nel riquadro piccolo, CANCELLA E RIFAI la
 * svuota. Resta ferma: nulla deve poter spostare il riquadro mentre si firma.
 */
function FirmaSchermoIntero({ titolo, piccolo, ritorno, firmaPrima, onTratti, onChiudi }: { titolo: string; ritorno: RefObject<HTMLElement>; piccolo: { w: number; h: number }; firmaPrima: readonly Tratto[]; onTratti: (t: Tratto[]) => void; onChiudi: () => void }) {
  const radice = useRef<HTMLDivElement>(null)
  const riquadro = useRef<HTMLDivElement>(null)
  const annulla = useRef<HTMLButtonElement>(null)
  const [bozza, setBozza] = useState<Tratto[]>([])
  const [avviso, setAvviso] = useState('')
  const [verso, setVerso] = useState(() => orientamento(window.innerWidth, window.innerHeight))
  const fatto = risultatoFatto(bozza, piccolo.w, piccolo.h)

  // ANNULLA scarta la bozza (la firma di prima resta); FATTO la porta nel riquadro piccolo.
  const chiudi = (azione: 'annulla' | 'fatto') => {
    if (azione === 'fatto' && fatto.chiama) onTratti(fatto.tratti)
    onChiudi()
  }
  // Un solo ref per i listener dell'effetto, che parte una volta e non vede i render dopo.
  const chiudiRef = useRef(chiudi)
  chiudiRef.current = chiudi

  // La firma di prima si apre dentro, centrata e non ingrandita, a riquadro misurato.
  useLayoutEffect(() => {
    const { width, height } = riquadro.current!.getBoundingClientRect() // ref messo da RiquadroFirma, già montato qui
    setBozza(adattaTratti(firmaPrima, width, height))
  }, [])

  useEffect(() => {
    const el = radice.current! // il div del portale qui sotto, già montato
    // Il fuoco parte da ANNULLA e il resto della pagina non si raggiunge né si legge.
    annulla.current?.focus()
    // Solo chi non era già inert: alla chiusura si ripristina quello e basta.
    const altri = daIsolare(Array.from(document.body.children), el)
    altri.forEach((x) => x.setAttribute('inert', ''))
    // La pagina sotto non scorre, non si ricarica tirando, non si ingrandisce: iOS vuole
    // anche i listener non passivi, `touch-action` da solo non basta.
    document.documentElement.classList.add('firma-aperta')
    const ferma = (e: Event) => e.preventDefault()
    el.addEventListener('touchmove', ferma, { passive: false })
    el.addEventListener('gesturestart', ferma)
    // Il tasto indietro del browser non fa niente: si esce solo con ANNULLA, FATTO o Esc.
    // Una sola voce per apertura: in StrictMode (dev) l'effetto riparte prima che il back()
    // della pulizia sia avvenuto, e la voce nostra c'è già.
    if (!serveBack(history.state)) history.pushState({ firma: true }, '')
    const indietro = () => history.pushState({ firma: true }, '')
    window.addEventListener('popstate', indietro)
    // Girare il telefono cambia le misure e storta la firma: si ricomincia, e lo si dice.
    // Solo sui dispositivi a tocco: col mouse un resize della finestra non deve cancellare la firma.
    let prima = orientamento(window.innerWidth, window.innerHeight)
    const gira = () => {
      const nuovo = orientamento(window.innerWidth, window.innerHeight)
      setVerso(nuovo) // titolo e frase seguono il verso anche col mouse
      if (!window.matchMedia('(pointer: coarse)').matches) return
      if (nuovo === prima) return
      prima = nuovo
      setBozza([])
      setAvviso('Hai girato il telefono: firma di nuovo')
    }
    window.addEventListener('resize', gira)
    const tasti = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        chiudiRef.current('annulla')
      }
      if (e.key !== 'Tab') return
      const dentro = Array.from(el.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'))
      const primo = dentro[0]
      const ultimo = dentro[dentro.length - 1]
      const ora = document.activeElement
      if (e.shiftKey && (ora === primo || !el.contains(ora))) {
        e.preventDefault()
        ultimo.focus()
      } else if (!e.shiftKey && (ora === ultimo || !el.contains(ora))) {
        e.preventDefault()
        primo.focus()
      }
    }
    document.addEventListener('keydown', tasti)
    return () => {
      document.removeEventListener('keydown', tasti)
      window.removeEventListener('resize', gira)
      window.removeEventListener('popstate', indietro)
      el.removeEventListener('touchmove', ferma)
      el.removeEventListener('gesturestart', ferma)
      document.documentElement.classList.remove('firma-aperta')
      altri.forEach((x) => x.removeAttribute('inert'))
      // Il fuoco torna al tasto da cui si è partiti (anche se si è aperta con un tocco sul riquadro):
      // solo ora, con la pagina di nuovo raggiungibile.
      ritorno.current?.focus()
      // La voce di cronologia messa all'apertura si toglie, senza lasciare un passo in più.
      if (serveBack(history.state)) history.back()
    }
  }, [])

  return createPortal(
    <div ref={radice} className="firma-intera" role="dialog" aria-modal="true" aria-label={titolo}>
      <div className="firma-intera-testa">
        <button type="button" ref={annulla} className="firma-intera-tasto" onClick={() => chiudi('annulla')}>
          ANNULLA
        </button>
        {/* In verticale il titolo intero va a capo: resta solo il nome (l'etichetta del dialog è intera). */}
        <span className="firma-intera-titolo">{verso === 'verticale' ? titolo.replace(/^LA FIRMA DI /, '') : titolo}</span>
        <button type="button" className="firma-intera-tasto firma-intera-fatto" disabled={!fatto.chiama} onClick={() => chiudi('fatto')}>
          FATTO
        </button>
      </div>
      <RiquadroFirma classe="firma-intera-riquadro" rif={riquadro} vuota={!bozza.length}>
        <Tela tratti={bozza} onTratti={(t) => { setBozza(t); setAvviso('') }} />
      </RiquadroFirma>
      <div className="firma-intera-piede">
        {/* Sempre nel documento, se no chi usa uno screen reader non sente l'avviso comparire. */}
        <p className="firma-intera-avviso" role="status" aria-live="polite">
          {avviso}
        </p>
        {/* In orizzontale il riquadro più alto serve alla firma: la frase c'è solo in verticale. */}
        {verso === 'verticale' && <p className="firma-intera-frase">Gira il telefono per avere più spazio. La schermata non si muove mentre firmi.</p>}
        <button type="button" className="firma-intera-tasto" onClick={() => { setBozza([]); setAvviso('') }}>
          CANCELLA E RIFAI
        </button>
      </div>
    </div>,
    document.body,
  )
}

export function TavolaFirma({ id, tratti, onTratti, descritto }: { id: string; tratti: readonly Tratto[]; onTratti: (t: Tratto[]) => void; descritto?: string }) {
  const tasto = useRef<HTMLButtonElement>(null)
  const [aperta, setAperta] = useState<{ titolo: string; w: number; h: number } | null>(null)
  // Il titolo è lo stesso nome del modulo («LA FIRMA DI Giulia Rossi»): lo si legge dall'etichetta
  // del riquadro, così i moduli non devono passarlo. La misura è quella del riquadro piccolo.
  const apri = () => {
    // `id` è la tela di questo stesso componente: c'è sempre, il tasto non esiste prima.
    const { width, height } = document.getElementById(id)!.getBoundingClientRect()
    // Dipende dal modulo: la label for={id} del riquadro. Senza, il titolo è «LA FIRMA».
    setAperta({ titolo: (document.querySelector(`label[for="${id}"]`)?.textContent?.trim() || 'LA FIRMA').toLocaleUpperCase('it'), w: width, h: height })
  }

  return (
    <>
      <RiquadroFirma classe="firma" vuota={!tratti.length}>
        <Tela id={id} tratti={tratti} onTratti={onTratti} onTocco={apri} limita descritto={descritto} />
      </RiquadroFirma>
      <button ref={tasto} type="button" className={`btn ${tratti.length ? 'btn-ghost' : 'btn-primary'} firma-apri`} onClick={apri}>
        {tratti.length ? 'RIFAI LA FIRMA A SCHERMO INTERO' : 'FIRMA A SCHERMO INTERO'}
      </button>
      <p className="firma-apri-frase">
        {tratti.length ? 'Firma pronta: parte con la richiesta. Toccando il riquadro si riapre a schermo intero.' : 'Più spazio per il dito: si apre a tutto schermo, e puoi anche girare il telefono. Si può firmare anche qui nel riquadro.'}
      </p>
      {aperta && (
        <FirmaSchermoIntero
          titolo={aperta.titolo}
          piccolo={aperta}
          firmaPrima={tratti}
          onTratti={onTratti}
          ritorno={tasto}
          onChiudi={() => setAperta(null)}
        />
      )}
    </>
  )
}
