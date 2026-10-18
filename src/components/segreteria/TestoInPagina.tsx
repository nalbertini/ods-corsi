import { useEffect, useLayoutEffect, useRef, type MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { registerOverlayPortal } from '@puckeditor/core'
import { EditorContent, useEditor } from '@tiptap/react'
import type { DatiSegreteria } from '../../lib/segreteria'
import { versoStoria } from '../../lib/sitoPezzi'
import { Barra, estensioni } from './EditorTesto'

/**
 * Il testo di un pezzo scritto dentro la pagina, a tutta larghezza. La barra dei tasti (la stessa di `EditorTesto`)
 * sta sopra il pezzo, nel posto `slot` che il pezzo le tiene. Il testo scritto arriva subito a chi salva (`onCambia`,
 * a ogni lettera: SALVA, PUBBLICA e chiudere la pagina lo vedono senza aspettare). La storia è una sola, quella di
 * Puck, e il testo le arriva a ogni pausa (`onPausa`, anche quando si lascia il testo), non a ogni lettera, così
 * ANNULLA toglie un pezzo di testo e non una lettera.
 */

/** Quanto si aspetta, dopo l'ultima lettera, prima di dare il testo a Puck. */
const PAUSA_MS = 500

export function TestoInPagina({
  d,
  html,
  etichetta,
  slot,
  onCambia,
  onPausa,
  onStoria,
}: {
  d: DatiSegreteria
  html: string
  etichetta: string
  slot: HTMLElement | null
  onCambia: (html: string) => void
  onPausa: (html: string) => void
  onStoria: (verso: 'indietro' | 'avanti') => void
}) {
  // Le funzioni di chi ci chiama cambiano a ogni giro: l'editor, che si crea una volta, legge sempre l'ultima.
  const cambia = useRef(onCambia)
  const pausa = useRef(onPausa)
  const storia = useRef(onStoria)
  useLayoutEffect(() => {
    cambia.current = onCambia
    pausa.current = onPausa
    storia.current = onStoria
  })
  /** Il testo scritto e non ancora dato a Puck. */
  const pendente = useRef<string | null>(null)
  /** L'ultimo testo dato a Puck: quando torna come `html` non è un cambio da fuori. */
  const dato = useRef(html)
  const timer = useRef<number | undefined>(undefined)
  const contenitore = useRef<HTMLDivElement>(null)

  /** Dà a Puck il testo in sospeso; dice se ce n'era. */
  const daiAPuck = (): boolean => {
    window.clearTimeout(timer.current)
    if (pendente.current === null) return false
    const testo = pendente.current
    pendente.current = null
    dato.current = testo
    pausa.current(testo)
    return true
  }

  const editor = useEditor({
    extensions: estensioni(true),
    content: html,
    autofocus: 'end',
    editorProps: {
      attributes: { class: 'sito-testo', role: 'textbox', 'aria-multiline': 'true', 'aria-label': etichetta },
      // Annulla e rifai della tastiera sono quelli di Puck, gli stessi dei tasti in alto: prima gli si dà il testo scritto.
      handleKeyDown: (_, e) => {
        const verso = versoStoria(e.key, e.metaKey || e.ctrlKey, e.shiftKey, e.altKey)
        if (!verso) return false
        e.preventDefault()
        daiAPuck()
        storia.current(verso)
        return true
      },
    },
    onUpdate: ({ editor: e }) => {
      const testo = e.getHTML()
      pendente.current = testo
      cambia.current(testo)
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(daiAPuck, PAUSA_MS)
    },
    onBlur: () => void daiAPuck(),
  })

  // Il testo cambia da fuori (annulla, rifai, un'altra pagina): l'editor lo segue. Non se è quello che Puck ha appena ricevuto da qui
  // (il suo ritorno non è un cambio) né mentre c'è testo scritto non ancora dato.
  useEffect(() => {
    if (!editor || pendente.current !== null || html === dato.current || html === editor.getHTML()) return
    dato.current = html
    editor.commands.setContent(html, { emitUpdate: false })
  }, [editor, html])

  // Lasciato il pezzo, il testo scritto arriva comunque a Puck.
  useEffect(() => () => void daiAPuck(), []) // eslint-disable-line react-hooks/exhaustive-deps -- `daiAPuck` legge solo refs

  // Dentro un pezzo Puck spegne i puntatori e porta il trascinamento su tutta la sua area: il testo e la barra si dichiarano a Puck
  // come zone da usare (`registerOverlayPortal`) e senza trascinamento, così col mouse e col dito si scrive, si selezionano le parole
  // e si premono i tasti. Il pezzo si sposta da fuori dal testo e con SU e GIÙ. La barra è in un portale ma per React è figlia del pezzo.
  const cassetta = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const els = [contenitore.current, cassetta.current].filter((x): x is HTMLDivElement => x !== null)
    const fine = els.map((el) => registerOverlayPortal(el, { disableDrag: true }))
    return () => fine.forEach((f) => f?.())
  }, [editor, slot])

  // La barra occupa il suo posto: il posto prende la sua altezza per stare sopra il pezzo senza spostare la pagina.
    useEffect(() => {
    const c = cassetta.current
    if (!slot || !c) return
    const misura = () => slot.style.setProperty('--hb', `${c.offsetHeight}px`)
    misura()
    const o = new ResizeObserver(misura)
    o.observe(c)
    return () => {
      o.disconnect()
      slot.style.removeProperty('--hb')
    }
  }, [slot, editor])

  // Un tasto della barra non porta via il fuoco al testo (le caselle e le finestre sì lo prendono).
  const tieniFuoco = (e: MouseEvent) => {
    // Il bersaglio di un mousedown è sempre un elemento.
    if (!(e.target as HTMLElement).closest('input, textarea, select, [role="dialog"]')) e.preventDefault()
  }

  if (!editor) return null
  return (
    <>
      {slot && createPortal(<div ref={cassetta} className="sito-barra-caja" onMouseDown={tieniFuoco}><Barra editor={editor} d={d} /></div>, slot)}
      <div ref={contenitore}>
        <EditorContent editor={editor} />
      </div>
    </>
  )
}
