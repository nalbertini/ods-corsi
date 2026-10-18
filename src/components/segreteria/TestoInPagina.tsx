import { useEffect, useRef, type MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { EditorContent, useEditor } from '@tiptap/react'
import type { DatiSegreteria } from '../../lib/segreteria'
import { Barra, estensioni } from './EditorTesto'

/**
 * Il testo di un pezzo scritto dentro la pagina, a tutta larghezza. La barra dei tasti (la stessa di `EditorTesto`)
 * sta sopra il pezzo, nel posto `slot` che il pezzo le tiene. La storia è una sola, quella di Puck: il testo gli arriva
 * a ogni pausa (e quando si lascia il testo), non a ogni lettera, così ANNULLA toglie un pezzo di testo e non una lettera.
 */

/** Quanto si aspetta, dopo l'ultima lettera, prima di dare il testo a Puck. */
const PAUSA_MS = 500

export function TestoInPagina({
  d,
  html,
  etichetta,
  slot,
  onScrivi,
  onStoria,
}: {
  d: DatiSegreteria
  html: string
  etichetta: string
  slot: HTMLElement | null
  onScrivi: (html: string) => void
  onStoria: (verso: 'indietro' | 'avanti') => void
}) {
  // Le funzioni di chi ci chiama cambiano a ogni giro: l'editor, che si crea una volta, legge sempre l'ultima.
  const scrivi = useRef(onScrivi)
  const storia = useRef(onStoria)
  scrivi.current = onScrivi
  storia.current = onStoria
  const pendente = useRef<string | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const contenitore = useRef<HTMLDivElement>(null)

  const dai = () => {
    window.clearTimeout(timer.current)
    if (pendente.current === null) return
    const testo = pendente.current
    pendente.current = null
    scrivi.current(testo)
  }

  const editor = useEditor({
    extensions: estensioni(true),
    content: html,
    autofocus: 'end',
    editorProps: {
      attributes: { class: 'sito-testo', role: 'textbox', 'aria-multiline': 'true', 'aria-label': etichetta },
      // Annulla e rifai della tastiera sono quelli di Puck, gli stessi dei tasti in alto: prima gli si dà il testo scritto.
      handleKeyDown: (_, e) => {
        if (!(e.metaKey || e.ctrlKey) || e.altKey) return false
        const k = e.key.toLowerCase()
        if (k !== 'z' && k !== 'y') return false
        e.preventDefault()
        dai()
        storia.current(k === 'y' || e.shiftKey ? 'avanti' : 'indietro')
        return true
      },
    },
    onUpdate: ({ editor: e }) => {
      pendente.current = e.getHTML()
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(dai, PAUSA_MS)
    },
    onBlur: dai,
  })

  // Il testo cambia da fuori (annulla, rifai, un'altra pagina): l'editor lo segue; non mentre c'è testo scritto non ancora dato.
  useEffect(() => {
    if (editor && pendente.current === null && html !== editor.getHTML()) editor.commands.setContent(html, { emitUpdate: false })
  }, [editor, html])

  // Lasciato il pezzo, il testo scritto arriva comunque a Puck.
  useEffect(() => dai, []) // eslint-disable-line react-hooks/exhaustive-deps -- `dai` legge solo refs

  // Trascinare il pezzo e selezionare le parole sono due gesti: sul testo vince la selezione. Il pezzo si sposta da fuori dal testo e con SU e GIÙ.
  useEffect(() => {
    const el = contenitore.current
    if (!el) return
    const ferma = (e: Event) => e.stopPropagation()
    const eventi = ['pointerdown', 'mousedown', 'touchstart'] as const
    eventi.forEach((n) => el.addEventListener(n, ferma))
    return () => eventi.forEach((n) => el.removeEventListener(n, ferma))
  }, [])

  // La barra occupa il suo posto: il posto prende la sua altezza per stare sopra il pezzo senza spostare la pagina.
  const caja = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const c = caja.current
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
    if (!(e.target as HTMLElement).closest('input, textarea, select, [role="dialog"]')) e.preventDefault()
  }

  if (!editor) return null
  return (
    <>
      {slot && createPortal(<div ref={caja} className="sito-barra-caja" onMouseDown={tieniFuoco}><Barra editor={editor} d={d} /></div>, slot)}
      <div ref={contenitore}>
        <EditorContent editor={editor} />
      </div>
    </>
  )
}
