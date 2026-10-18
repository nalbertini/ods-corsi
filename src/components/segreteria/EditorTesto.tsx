import { useEffect, useState } from 'react'
import { EditorContent, Node, useEditor, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import { indirizzoValido } from '../../lib/sitoPagine'
import { altDellaFoto, controllaAlt } from '../../lib/sitoImmagini'
import type { DatiSegreteria } from '../../lib/segreteria'
import { ScegliImmagine } from './ImmaginiSito'

/**
 * L'editor del testo di una pagina del sito. Sa fare solo quello che il sito
 * ammette (titolo, sottotitolo, grassetto, corsivo, elenchi, citazione, link
 * e pulsante: vedi `sitoTesto.ts`); quel che si incolla da Word o da altri
 * siti e non è in elenco sparisce da sé. Il testo che esce si ripulisce
 * comunque prima di salvarlo.
 */

// Il pulsante è un link con la classe «pulsante»: è l'unica classe che il sito ammette.
const LinkPulsante = Link.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      pulsante: {
        default: false,
        parseHTML: (el) => el.classList.contains('pulsante'),
        renderHTML: (a) => (a.pulsante ? { class: 'pulsante' } : {}),
      },
    }
  },
})

// L'immagine è un blocco con indirizzo e testo alternativo, e nient'altro: è quello che il sito ammette (`sitoTesto.ts`).
// `alt=""` (solo decorativa) resta com'è, non sparisce; un'immagine che arriva senza `alt` si salva come decorativa.
const Immagine = Node.create({
  name: 'immagine',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    return { src: { default: '' }, alt: { default: '' } }
  },
  parseHTML() {
    return [{ tag: 'img[src]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['img', { src: HTMLAttributes.src, alt: HTMLAttributes.alt ?? '' }]
  },
})

// `getAttributes` dà un oggetto senza tipo: qui si legge solo quello che il link porta (`pulsante` lo aggiunge `LinkPulsante`).
const attributiLink = (editor: Editor) => editor.getAttributes('link') as { href?: string; pulsante?: boolean }

function Tasto({ nome, etichetta, acceso, onClick, larghezzaPiena }: { nome: string; etichetta: string; acceso?: boolean; onClick: () => void; larghezzaPiena?: boolean }) {
  return (
    <button type="button" className="sg-chip num sito-tasto" aria-pressed={acceso} aria-label={nome} title={nome} data-larga={larghezzaPiena || undefined} onClick={onClick}>
      {etichetta}
    </button>
  )
}

/**
 * Con una foto scelta nel testo la barra dei tasti del testo non serve: dice che la foto è scelta e offre quel che si
 * può fare (testo alternativo, solo decorativa, cambiare foto, toglierla). Si sposta trascinandola, come ogni blocco.
 */
function BarraFoto({ editor, d }: { editor: Editor; d: DatiSegreteria }) {
  const attuale = editor.getAttributes('immagine') as { alt?: string }
  const [alt, setAlt] = useState(attuale.alt ?? '')
  const [decorativa, setDecorativa] = useState((attuale.alt ?? '') === '')
  const [cambia, setCambia] = useState(false)
  const guaio = controllaAlt(alt.trim(), decorativa)
  // Il testo si dà alla pagina uscendo dal campo o con Invio; senza testo e non decorativa la foto resta com'era.
  const dai = (testo: string, deco: boolean) => {
    if (!controllaAlt(testo.trim(), deco)) editor.chain().updateAttributes('immagine', { alt: altDellaFoto(testo, deco) }).run()
  }
  return (
    <div className="row sito-barra sito-barra-foto" role="toolbar" aria-label="Cosa puoi fare con la foto">
      <span className="sg-etichetta">FOTO SCELTA</span>
      <input
        className="sg-campo grow"
        aria-label="Testo alternativo: cosa si vede nella foto"
        placeholder="Cosa si vede nella foto"
        value={alt}
        disabled={decorativa}
        aria-invalid={guaio ? true : undefined}
        onChange={(e) => setAlt(e.target.value)}
        onBlur={() => dai(alt, decorativa)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); dai(alt, decorativa) } }}
      />
      <label className="row" style={{ gap: 8, alignItems: 'center' }}>
        <input type="checkbox" checked={decorativa} onChange={(e) => { setDecorativa(e.target.checked); if (e.target.checked) setAlt(''); dai(e.target.checked ? '' : alt, e.target.checked) }} />
        <span>Solo decorativa</span>
      </label>
      <Tasto nome="Cambia foto" etichetta="CAMBIA FOTO" onClick={() => setCambia(true)} />
      <button data-bozza type="button" className="sg-btn sg-btn-linea sg-pericolo sito-tasto" onClick={() => editor.chain().focus().deleteSelection().run()}>
        Togli la foto
      </button>
      {guaio && <span role="alert" className="modulo-nota" style={{ flexBasis: '100%' }}>{guaio}</span>}
      {cambia && (
        <ScegliImmagine
          d={d}
          perFoto
          onChiudi={() => setCambia(false)}
          onScelta={(url, nuovoAlt) => {
            editor.chain().updateAttributes('immagine', { src: url, alt: nuovoAlt }).run()
            setAlt(nuovoAlt)
            setDecorativa(nuovoAlt === '')
            setCambia(false)
          }}
        />
      )}
    </div>
  )
}

export function Barra({ editor, d }: { editor: Editor; d: DatiSegreteria }) {
  const [immagine, setImmagine] = useState(false)
  const [link, setLink] = useState<{ indirizzo: string; pulsante: boolean; guaio?: string } | null>(null)
  // La barra segue il cursore: i tasti accesi dicono come è scritto il punto dove si è.
  const [, giro] = useState(0)
  useEffect(() => {
    const f = () => giro((n) => n + 1)
    editor.on('transaction', f)
    return () => {
      editor.off('transaction', f)
    }
  }, [editor])

  const apriLink = () => {
    const attuale = attributiLink(editor)
    setLink({ indirizzo: attuale.href ?? '', pulsante: !!attuale.pulsante })
  }
  const mettiLink = (pulsante: boolean) => {
    const indirizzo = link?.indirizzo.trim() ?? ''
    // Un indirizzo che il sito non ammette (javascript:, senza https://…) non diventa un collegamento vuoto: si dice cosa scrivere.
    if (indirizzo && !indirizzoValido(indirizzo)) return setLink((l) => (l ? { ...l, guaio: 'Scrivi un indirizzo che cominci con https://, mailto:, tel: oppure /, senza spazi' } : l))
    if (indirizzo) editor.chain().focus().extendMarkRange('link').setMark('link', { href: indirizzo, pulsante }).run()
    setLink(null)
  }

  // Una foto scelta ha i suoi tasti; `key` rimette a zero i campi quando si sceglie un'altra foto.
  if (editor.isActive('immagine')) return <BarraFoto key={editor.state.selection.from} editor={editor} d={d} />

  return (
    <div className="stack" style={{ gap: 8 }}>
      <div className="row sito-barra" role="toolbar" aria-label="Come è scritto il testo">
        <Tasto nome="Titolo" etichetta="TITOLO" acceso={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} />
        <Tasto nome="Sottotitolo" etichetta="SOTTOTITOLO" acceso={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} />
        <Tasto nome="Grassetto" etichetta="G" acceso={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} />
        <Tasto nome="Corsivo" etichetta="C" acceso={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} />
        <Tasto nome="Elenco puntato" etichetta="•" acceso={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} />
        <Tasto nome="Elenco numerato" etichetta="1." acceso={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} />
        <Tasto nome="Citazione" etichetta="“" acceso={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()} />
        <Tasto nome="Link" etichetta="LINK" acceso={editor.isActive('link') && !attributiLink(editor).pulsante} onClick={apriLink} />
        <Tasto nome="Immagine" etichetta="IMMAGINE" onClick={() => setImmagine(true)} />
        <Tasto nome="Pulsante" etichetta="PULSANTE" acceso={editor.isActive('link') && !!attributiLink(editor).pulsante} onClick={() => { apriLink(); setLink((l) => (l ? { ...l, pulsante: true } : l)) }} />
      </div>
      {immagine && (
        <ScegliImmagine
          d={d}
          onChiudi={() => { setImmagine(false); editor.commands.focus() }}
          onScelta={(url, alt) => {
            // Dopo la selezione, non al suo posto: con un'immagine appena messa (selezionata) `insertContent` la sostituirebbe.
            editor.chain().focus().insertContentAt(editor.state.selection.to, { type: 'immagine', attrs: { src: url, alt } }).run()
            setImmagine(false)
          }}
        />
      )}
      {link && (
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <label className="sg-etichetta" htmlFor="sito-link">
            {link.pulsante ? 'DOVE PORTA IL PULSANTE' : 'DOVE PORTA IL LINK'}
          </label>
          <input
            id="sito-link"
            className="sg-campo grow"
            style={{ minWidth: 220 }}
            value={link.indirizzo}
            placeholder="https://… oppure /chi-siamo"
            // Il campo si apre dopo un tocco su LINK o PULSANTE: il fuoco ci va subito, perché si scrive subito.
            autoFocus
            aria-describedby={link.guaio ? 'sito-link-guaio' : undefined}
            onChange={(e) => setLink({ ...link, indirizzo: e.target.value, guaio: undefined })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                mettiLink(link.pulsante)
              }
              if (e.key === 'Escape') setLink(null)
            }}
          />
          <button type="button" className="sg-btn sg-btn-pieno" onClick={() => mettiLink(link.pulsante)}>
            Metti
          </button>
          <button data-bozza type="button" className="sg-btn sg-btn-linea sg-pericolo" onClick={() => { editor.chain().focus().extendMarkRange('link').unsetLink().run(); setLink(null) }}>
            Togli
          </button>
          <button type="button" className="sg-btn sg-btn-linea" onClick={() => setLink(null)}>
            Annulla
          </button>
          {link.guaio && (
            <span id="sito-link-guaio" role="alert" className="modulo-nota" style={{ flexBasis: '100%' }}>
              {link.guaio}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Le estensioni di TipTap: solo quello che il sito ammette. `senzaStoria` toglie annulla e rifai di TipTap: nella
 * pagina a pezzi la storia è una sola, quella di Puck (ANNULLA e RIFAI in alto), se no i due si contraddicono.
 */
export const estensioni = (senzaStoria = false) => [
  StarterKit.configure({
    heading: { levels: [2, 3] },
    // Quel che il sito non ammette non si può scrivere.
    code: false,
    codeBlock: false,
    strike: false,
    horizontalRule: false,
    link: false,
    underline: false,
    // `as const`: per TypeScript l'opzione è `false` o le sue impostazioni, non un booleano qualunque.
    ...(senzaStoria && { undoRedo: false as const }),
  }),
  Immagine,
  LinkPulsante.configure({ openOnClick: false, autolink: false, HTMLAttributes: { rel: null, target: null } }),
]

export function EditorTesto({ valore, onCambia, etichetta, d }: { valore: string; onCambia: (html: string) => void; etichetta: string; d: DatiSegreteria }) {
  const editor = useEditor({
    extensions: estensioni(),
    content: valore,
    editorProps: { attributes: { class: 'sito-testo', role: 'textbox', 'aria-multiline': 'true', 'aria-label': etichetta } },
    onUpdate: ({ editor: e }) => onCambia(e.getHTML()),
  })
  // Il testo cambia da fuori (un'altra pagina aperta, la bozza ricaricata): l'editor lo segue, senza spostare il cursore se è già lo stesso.
  useEffect(() => {
    if (editor && valore !== editor.getHTML()) editor.commands.setContent(valore, { emitUpdate: false })
  }, [editor, valore])
  if (!editor) return null
  return (
    <div className="stack" style={{ gap: 8 }}>
      <Barra editor={editor} d={d} />
      <EditorContent editor={editor} />
    </div>
  )
}
