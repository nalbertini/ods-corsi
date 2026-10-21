import { useMemo, useState, type ReactNode } from 'react'
import { createUsePuck, Puck, type Config, type Data } from '@puckeditor/core'
import '@puckeditor/core/puck.css'
import type { DatiSegreteria } from '../../lib/segreteria'
import type { PaginaSito } from '../../lib/sitoPagine'
import { CSS_SITO, invito } from '../../lib/sitoGenera'
import { cosaNonVaSalvare, daSalvare, pezziDaAprire, pezziInHtml, TESTO_DEL_SITO, type BozzaPezzi, type Pezzo } from '../../lib/sitoPezzi'
import { pulisciTesto } from '../../lib/sitoTesto'
import AnteprimaPagina from './AnteprimaPagina'
import { ScegliImmagine } from './ImmaginiSito'
import { chiedi, useAvviso, useBozza } from './comune'

/**
 * Il nuovo editor delle pagine, da provare accanto a quello di oggi: Puck completo, così com'è.
 * Puck tiene i blocchi, la struttura, i formati dello schermo e la colonna di destra; noi gli diamo
 * i quattro pezzi, titolo e descrizione, il CSS del sito e Salva bozza. Si pubblica dall'editor di oggi.
 * Il campo foto e il disegno delle foto ripetono quelli di `EditorPezzi`: si tiene uno dei due editor quando la prova finisce.
 */

/** Il testo è `string` nei dati; mentre si scrive nella pagina Puck lo dà al disegno già come editor (`RichText`). */
type Testo = string | ReactNode
type Props = {
  fotoInCima: { src: string; alt: string }
  testo: { html: Testo }
  foto: { src: string; alt: string }
  colonne: { colonne: Array<{ html: Testo }> }
  iscriviti: { titolo: string; frase: string }
  istruttore: { nome: string; cognome: string; corsi: string; src: string; alt: string; pagina: string }
}
type Radice = { titolo: string; descrizione: string }

const usePuck = createUsePuck<Config<Props, Radice>>()
/** La zona dei pezzi di Puck: una sola, quella della pagina. */
const ZONA = 'root:default-zone'

/** Quel che si salva, dai dati di Puck: nei dati il testo è sempre `string`, come nei pezzi (lo ricontrolla `cosaNonVaSalvare`). */
const bozzaDa = (data: Data<Props, Radice>): BozzaPezzi => ({
  titolo: data.root.props?.titolo ?? '',
  descrizione: data.root.props?.descrizione ?? '',
  pezzi: { content: data.content as unknown as Pezzo[] },
})

function Html({ v }: { v: Testo }) {
  // Sicuro: è ripulito dalla stessa funzione che lo ripulisce per il sito (sitoTesto.ts).
  return typeof v === 'string' ? <div dangerouslySetInnerHTML={{ __html: pulisciTesto(v) }} /> : <div>{v}</div>
}

/** Sceglie la foto e ne scrive anche il testo alternativo, come l'editor di oggi: un campo scrive solo se stesso, quindi si scrive sul pezzo scelto. */
function CampoFoto({ d, valore }: { d: DatiSegreteria; valore: string }) {
  const [apri, setApri] = useState(false)
  const dispatch = usePuck((s) => s.dispatch)
  const contenuto = usePuck((s) => s.appState.data.content)
  const id = usePuck((s) => s.selectedItem?.props.id)
  return (
    <>
      {valore ? <img src={valore} alt="" style={{ width: '100%', maxHeight: 140, objectFit: 'cover' }} /> : <span className="sito-pezzi-vuoto">Manca la foto</span>}
      <button type="button" className="sg-btn sg-btn-linea" onClick={() => setApri(true)}>{valore ? 'Cambia foto' : 'Scegli la foto'}</button>
      {apri && (
        <ScegliImmagine
          d={d}
          perFoto
          onChiudi={() => setApri(false)}
          onScelta={(url, alt) => {
            // `replace`: foto e testo alternativo in un passo solo, per ANNULLA e RIFAI.
            const i = contenuto.findIndex((c) => c.props.id === id)
            if (i >= 0) dispatch({ type: 'replace', destinationIndex: i, destinationZone: ZONA, data: { ...contenuto[i], props: { ...contenuto[i].props, src: url, alt } } })
            setApri(false)
          }}
        />
      )}
    </>
  )
}

function configura(d: DatiSegreteria): Config<Props, Radice> {
  const foto = {
    src: { type: 'custom' as const, label: 'Foto', render: ({ value }: { value: string }) => <CampoFoto d={d} valore={value} /> },
    alt: { type: 'text' as const, label: 'Cosa si vede (vuoto = solo decorativa)' },
  }
  const immagine = (alta: number) => ({ src, alt }: { src: string; alt: string }) =>
    src ? <img src={src} alt={alt} style={{ width: '100%', maxHeight: alta, objectFit: 'cover', display: 'block' }} /> : <span className="sito-pezzi-vuoto">Manca la foto: sceglila a destra</span>
  return {
    root: {
      fields: {
        titolo: { type: 'text', label: 'Titolo (anche su Google)' },
        descrizione: { type: 'textarea', label: 'Descrizione' },
      },
      // La pagina nell'iframe col CSS vero del sito e la stessa testa (titolo e descrizione) che le dà il generatore.
      // Tessere, collage e colonne del sito li fa il generatore sull'HTML intero: si vedono con «Com'è sul sito».
      render: ({ children, titolo, descrizione }) => (
        <>
          <style>{CSS_SITO}</style>
          <main>
            <section className="pagina-hero interna solo">
              <div className="intro">
                <h1>{titolo}</h1>
                {descrizione && <p>{descrizione}</p>}
              </div>
            </section>
            <div className="testo">{children}</div>
          </main>
        </>
      ),
    },
    components: {
      fotoInCima: { label: 'Foto in cima', fields: foto, defaultProps: { src: '', alt: '' }, render: immagine(260) },
      testo: {
        label: 'Testo',
        fields: { html: { type: 'richtext', label: 'Testo', contentEditable: true, options: TESTO_DEL_SITO } },
        defaultProps: { html: '' },
        render: ({ html }) => <Html v={html} />,
      },
      foto: { label: 'Foto', fields: foto, defaultProps: { src: '', alt: '' }, render: immagine(360) },
      colonne: {
        label: 'Colonne',
        fields: { colonne: { type: 'array', label: 'Colonne (da 2 a 3)', min: 2, max: 3, arrayFields: { html: { type: 'richtext', label: 'Testo', options: TESTO_DEL_SITO } }, defaultItemProps: { html: '' }, getItemSummary: (_, i) => `Colonna ${(i ?? 0) + 1}` } },
        defaultProps: { colonne: [{ html: '' }, { html: '' }] },
        render: ({ colonne }) => (
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${colonne.length}, minmax(0, 1fr))`, gap: 24 }}>
            {colonne.map((c, i) => <Html key={i} v={c.html} />)}
          </div>
        ),
      },
      iscriviti: {
        label: 'Iscriviti',
        fields: {
          titolo: { type: 'text', label: 'Titolo (vuoto = «Vieni a provare.»)' },
          frase: { type: 'textarea', label: 'Frase (vuoto = quella di sempre)' },
        },
        defaultProps: { titolo: '', frase: '' },
        // Una per pagina e sempre in fondo: niente copia né trascinamento. Dal cassetto se ne può mettere un'altra: la ferma `cosaNonVaSalvare`.
        permissions: { duplicate: false, drag: false },
        // Sicuro: `invito` mette titolo e frase con le entità, il resto è fisso.
        render: ({ titolo, frase }) => <div dangerouslySetInnerHTML={{ __html: invito({ titolo, frase }, true) }} />,
      },
      // Le parti della pagina Istruttori aperte qui restano intere; la pagina della scheda si sceglie nell'editor di oggi.
      istruttore: {
        label: 'Istruttore',
        fields: {
          src: foto.src,
          alt: { type: 'text', label: 'Cosa si vede (vuoto = «Ritratto di Nome Cognome»)' },
          nome: { type: 'text', label: 'Nome' },
          cognome: { type: 'text', label: 'Cognome' },
          corsi: { type: 'text', label: 'Corsi (separati da una virgola)' },
          pagina: { type: 'text', label: 'La sua pagina (l’indirizzo, es. fabio-berta)' },
        },
        defaultProps: { nome: '', cognome: '', corsi: '', src: '', alt: '', pagina: '' },
        render: ({ id, nome, cognome, corsi, src, alt, pagina }) => <Html v={pezziInHtml({ content: [{ type: 'istruttore', props: { id, nome, cognome, corsi, src, alt, pagina } }] })} />,
      },
    },
  }
}

/** Le parole di Puck che si vedono, nelle nostre. */
const PAROLE = {
  'label-page': 'Pagina',
  'label-component': 'Parte',
  'action-duplicate': 'Copia',
  'action-delete': 'Togli',
  'action-selectparent': 'Scegli quella sopra',
  'drawer-category-other': 'Parti',
  'plugin-blocks': 'Parti',
  'plugin-components': 'Parti',
  'plugin-fields': 'Campi',
  'plugin-outline': 'Struttura',
  'outline-header-title': 'Struttura',
  'outline-empty': 'Nessuna parte',
  'outline-header-collapseall': 'Chiudi tutto',
  'outline-item-collapse': 'Chiudi',
  'outline-item-expand': 'Apri',
  'outline-item-delete': 'Togli',
  'outline-item-duplicate': 'Copia',
  'field-arrayitem-summary': 'Colonna {index}',
  'field-arrayitem-duplicate': 'Copia',
  'field-arrayitem-delete': 'Togli',
  'field-richtext-bold': 'Grassetto',
  'field-richtext-italic': 'Corsivo',
  'field-richtext-blockquote': 'Citazione',
  'field-richtext-list-bullet': 'Elenco puntato',
  'field-richtext-list-ordered': 'Elenco numerato',
  'field-richtext-listselect-bullet': 'Elenco puntato',
  'field-richtext-listselect-ordered': 'Elenco numerato',
  'field-richtext-headingselect-2': 'Titolo',
  'field-richtext-headingselect-3': 'Sottotitolo',
  'field-richtext-select': 'Scegli',
  'header-undo': 'Annulla',
  'header-redo': 'Rifai',
  'header-toggle-leftsidebar': 'Mostra o nascondi il pannello a sinistra',
  'header-toggle-rightsidebar': 'Mostra o nascondi il pannello a destra',
  'header-toggle-menubar': 'Mostra o nascondi i tasti',
  'viewport-switch': 'Guarda come su {label}',
  'viewport-switch-default': 'Cambia schermo',
  'viewport-toggle-menu': 'Scegli lo schermo',
  'viewport-zoom-auto': '{zoom}% (da sé)',
  'viewport-zoom-in': 'Ingrandisci',
  'viewport-zoom-out': 'Rimpicciolisci',
  'loader-loading': 'Carico…',
  'field-richtext-underline': 'Sottolineato',
  'field-richtext-strikethrough': 'Barrato',
  'field-richtext-code-inline': 'Codice',
  'field-richtext-code-block': 'Blocco di codice',
  'field-richtext-horizontalrule': 'Riga',
  'field-richtext-align-left': 'A sinistra',
  'field-richtext-align-center': 'Al centro',
  'field-richtext-align-right': 'A destra',
  'field-richtext-align-justify': 'Giustificato',
  'field-richtext-alignselect-left': 'A sinistra',
  'field-richtext-alignselect-center': 'Al centro',
  'field-richtext-alignselect-right': 'A destra',
  'field-richtext-alignselect-justify': 'Giustificato',
  'field-richtext-headingselect-1': 'Titolo grande',
  'field-richtext-headingselect-4': 'Titolo 4',
  'field-richtext-headingselect-5': 'Titolo 5',
  'field-richtext-headingselect-6': 'Titolo 6',
  'drawer-category-collapse': 'Chiudi {title}',
  'drawer-category-expand': 'Apri {title}',
  'field-readonly': 'Solo da leggere',
  'layout-maximize': 'Allarga',
  'layout-minimize': 'Stringi',
  'canvas-noconfig': 'Questa parte ({type}) non si può mostrare',
}

const SCHERMI = [
  { width: 360, label: 'telefono', icon: 'Smartphone' as const },
  { width: 768, label: 'tablet', icon: 'Tablet' as const },
  { width: 1280, label: 'computer', icon: 'Monitor' as const },
]

export default function EditorPuck({ d, pagina, onChiudi, ricarica }: { d: DatiSegreteria; pagina: PaginaSito; onChiudi: () => void; ricarica: () => Promise<void> }) {
  // Le pagine del vecchio editor si aprono già a pezzi; sul database restano com'erano finché non si salva.
  // I pezzi salvati hanno il testo come `string`, uno dei casi di `Testo`.
  const [iniziali] = useState<Data<Props, Radice>>(() => ({
    root: { props: { titolo: pagina.titolo, descrizione: pagina.descrizione } },
    content: pezziDaAprire(pagina).content,
  }))
  // Una config sola per tutta la prova: rifatta a ogni tasto, Puck rimonterebbe i campi.
  const config = useMemo(() => configura(d), [d])
  const [ora, setOra] = useState<BozzaPezzi>(() => bozzaDa(iniziali))
  const { avviso, fai, lavora } = useAvviso()
  /** La pagina da mostrare com'è sul sito (null: si scrive). */
  const [sulSito, setSulSito] = useState<BozzaPezzi | null>(null)
  const sporca = daSalvare(pagina, ora)
  const no = cosaNonVaSalvare(ora)
  useBozza(sporca, pagina.titolo)

  const chiudi = async () => {
    if (sporca && !(await chiedi('Ci sono modifiche non salvate. Se chiudi si perdono.', 'Chiudi', { no: 'Resta qui', restare: true }))) return
    onChiudi()
  }
  // Dopo il salvataggio `ricarica` porta la pagina nuova (e la sua versione): `sporca` torna falso da sé.
  // Gli spazi si tolgono qui: la modalità prova non li toglie, il database sì.
  const salva = async () => {
    // Come «Porta ai pezzi»: una pagina del vecchio editor, salvata qui, resta a parti per sempre.
    if (pagina.pezzi === null && !(await chiedi(`Salvare «${pagina.titolo}» a parti? Non si torna più al vecchio editor di testo. Il sito non cambia finché non pubblichi.`, 'Salva a parti', { no: 'Lascia stare' }))) return
    await fai(() => d.salvaBozzaPezziSito(pagina.id, pagina.versione, { ...ora, titolo: ora.titolo.trim(), descrizione: ora.descrizione.trim() }), 'Bozza salvata. Il sito non è cambiato: si pubblica dall’editor di sempre', ricarica)
  }

  // Il «Publish» di Puck (`children`) non si mostra: si pubblica dall'editor di oggi, che fa tutti i controlli.
  const tasti = () => (
    <>
      <button type="button" className="sg-btn sg-btn-linea" onClick={() => void chiudi()}>Chiudi</button>
      <button type="button" className="sg-btn sg-btn-linea" onClick={() => setSulSito(ora)}>Com’è sul sito</button>
      <button type="button" className="sg-btn sg-btn-pieno" disabled={lavora || !sporca || !!no} onClick={() => void salva()}>Salva bozza</button>
    </>
  )

  return (
    <div className="sito-puck">
      <Puck
        config={config}
        data={iniziali}
        dictionary={PAROLE}
        viewports={SCHERMI}
        headerTitle={pagina.titolo}
        overrides={{ headerActions: tasti }}
        onChange={(data) => setOra(bozzaDa(data))}
        // Si apre sul tablet: sul computer (1280) la pagina viene troppo piccola per leggerla; la misura vera è in «Com'è sul sito».
        ui={{ viewports: { current: { width: 768, height: 'auto' }, controlsVisible: true, options: SCHERMI } }}
      />
      {no && sporca && <p role="alert" className="sito-puck-guaio">{no}</p>}
      {sulSito && (
        <div className="sito-puck sito-puck-sul-sito">
          <div className="row" style={{ gap: 8, padding: 8 }}>
            <button type="button" className="sg-btn sg-btn-linea" onClick={() => setSulSito(null)}>‹ Torna a scrivere</button>
          </div>
          <div style={{ flex: 1, display: 'flex' }}>
            <AnteprimaPagina d={d} slug={pagina.slug} titolo={sulSito.titolo} descrizione={sulSito.descrizione} testo={pezziInHtml(sulSito.pezzi)} />
          </div>
        </div>
      )}
      {avviso}
    </div>
  )
}
