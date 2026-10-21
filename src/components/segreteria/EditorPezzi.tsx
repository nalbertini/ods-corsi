import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createUsePuck, Puck, registerOverlayPortal, type ComponentData, type Config, type Data } from '@puckeditor/core'
import '@puckeditor/core/puck.css'
import type { DatiSegreteria } from '../../lib/segreteria'
import type { PaginaSito } from '../../lib/sitoPagine'
import { FRASE_NESSUNA_PARTE, avvisoIstruttori, corsiDa, notaPaginaIstruttore, pagineIstruttore, parteAmmessa, attesaStoria, colonnaNuova, doveMettere, motivoSpento, puoMettere, spostabile, conTestoScritto, nomeParte, scriviTesto, selezioneDopoStoria, vuoto, type Pezzo, type PezziPagina } from '../../lib/sitoPezzi'
import { pulisciTesto } from '../../lib/sitoTesto'
import { invito } from '../../lib/sitoGenera'
import { TestoInPagina } from './TestoInPagina'
import { ScegliImmagine } from './ImmaginiSito'

/**
 * L'editor di una pagina a pezzi (Puck): si trascinano foto in cima, testi,
 * foto e colonne. Il testo dentro i pezzi si scrive con `EditorTesto`, lo
 * stesso di sempre, quindi ha solo le formattazioni che il sito ammette.
 * Quel che esce (`PezziPagina`) lo traduce `sitoPezzi.ts` nel testo del sito.
 * Qui si mostrano e si chiamano le cose; le regole stanno in `sitoPezzi.ts`.
 */

const usePuck = createUsePuck()
/** La zona dei pezzi di Puck: una sola, quella della pagina. */
const ZONA = 'root:default-zone'

type Props = {
  fotoInCima: { src: string; alt: string }
  testo: { html: string }
  foto: { src: string; alt: string }
  colonne: { colonne: Array<{ html: string }> }
  iscriviti: { titolo: string; frase: string }
  istruttore: { nome: string; cognome: string; corsi: string; src: string; alt: string; pagina: string }
}

/** Le pagine fra cui scegliere quella di un istruttore: basta sapere se è pubblicata. */
type Pagine = ReadonlyArray<Pick<PaginaSito, 'slug' | 'titolo' | 'pubblicato' | 'nascosta' | 'diLegge'>>

/** Il corpo di un testo come lo vede chi scrive: ripulito dalla stessa funzione che lo ripulisce per il sito. */
const Testo = ({ html }: { html: string }) => <div className="sito-testo" style={{ minHeight: 0, border: 0 }} dangerouslySetInnerHTML={{ __html: pulisciTesto(html) }} />

/** Sceglie la foto dalla libreria e ne scrive anche il testo alternativo (o «solo decorativa»), come nell'editor di testo. */
function CampoFoto({ d, id, src }: { d: DatiSegreteria; id: string; src: string }) {
  const [apri, setApri] = useState(false)
  const dispatch = usePuck((s) => s.dispatch)
  const contenuto = usePuck((s) => s.appState.data.content)
  return (
    <div className="stack" style={{ gap: 8 }}>
      {src && <img src={src} alt="" style={{ width: '100%', height: 120, objectFit: 'cover' }} />}
      <button type="button" className="sg-btn sg-btn-linea" onClick={() => setApri(true)}>
        {src ? 'Cambia foto' : 'Scegli la foto'}
      </button>
      {apri && (
        <ScegliImmagine
          d={d}
          perFoto
          onChiudi={() => setApri(false)}
          onScelta={(url, alt) => {
            // Un campo scrive solo se stesso: la foto e il suo testo alternativo si scrivono insieme sul pezzo.
            // `replace` è un passo solo per ANNULLA e RIFAI; `setData` rifarebbe tutta la pagina e li confonde.
            const i = contenuto.findIndex((c) => c.props.id === id)
            if (i >= 0) dispatch({ type: 'replace', destinationIndex: i, destinationZone: ZONA, data: { ...contenuto[i], props: { ...contenuto[i].props, src: url, alt } } })
            setApri(false)
          }}
        />
      )}
    </div>
  )
}

/**
 * Annulla e rifai di Puck, che riportano anche la parte scelta com'era: si rimette quella di prima, se c'è ancora,
 * se no scrivere nel testo e annullare toglierebbe il cursore dalla pagina a ogni passo.
 */
/** Quando si è dato a Puck l'ultimo testo (0: mai). */
let ultimaScrittura = 0

function useStoria() {
  const dispatch = usePuck((s) => s.dispatch)
  const storia = usePuck((s) => s.history)
  const scelto = usePuck((s) => s.appState.ui.itemSelector)
  const quanti = usePuck((s) => s.appState.data.content.length)
  // Il testo appena scritto Puck lo mette nella storia un attimo dopo: annullare prima toglierebbe il passo di prima.
  const con = (passo: () => void) => () => {
    window.setTimeout(() => {
      passo()
      const resta = selezioneDopoStoria(scelto, quanti)
      if (resta) dispatch({ type: 'setUi', ui: { itemSelector: resta } })
    }, attesaStoria(ultimaScrittura, Date.now()))
  }
  return { storia, indietro: con(() => storia.back()), avanti: con(() => storia.forward()) }
}

/** L'altezza della barra: una riga di tasti da 44px sul telefono, due dai 900px (come `.sito-barra-caja` in styles.css), più il bordo e il respiro. Meno spazio di così sopra il pezzo e la barra non ci sta. Misura a occhio, non provata senza browser. */
const spazioBarra = () => (window.matchMedia('(min-width: 900px)').matches ? 116 : 72)

/**
 * Un pezzo di testo (TESTO: una colonna sola; COLONNE: due o tre affiancate) scritto nella pagina. Finché il pezzo non è
 * scelto si vede soltanto; scelto, la colonna toccata diventa un editor vivo e la barra dei tasti sta sopra il pezzo.
 * Un editor solo alla volta: con tre colonne vive montarne tre sul telefono è pesante.
 */
/**
 * Una colonna (o il testo intero) del pezzo. Dentro un pezzo Puck spegne i puntatori: la colonna si dichiara a Puck come zona da usare
 * (`registerOverlayPortal`), così un tocco la sceglie (`onTocca`); scelta, il suo testo non si trascina più (si selezionano le parole).
 */
function Colonna({ viva, onTocca, children }: { viva: boolean | undefined; onTocca: () => void; children: ReactNode }) {
  const el = useRef<HTMLDivElement>(null)
  useEffect(() => registerOverlayPortal(el.current, { disableDrag: viva === true }), [viva])
  return (
    <div ref={el} className="sito-colonna" data-viva={viva} onPointerDown={onTocca}>
      {children}
    </div>
  )
}

/** Dove arriva il testo scritto, subito: chi salva la pagina (`onCambia` di `EditorPezzi`), senza aspettare Puck. */
const Cambia = createContext<(p: PezziPagina) => void>(() => {})

function PezzoTesto({ d, id, colonne }: { d: DatiSegreteria; id: string; colonne: Array<{ html: string }> }) {
  const scelto = usePuck((s) => s.selectedItem?.props.id === id)
  const dispatch = usePuck((s) => s.dispatch)
  const contenuto = usePuck((s) => s.appState.data.content)
  const { indietro, avanti } = useStoria()
  const cambia = useContext(Cambia)
  const [slot, setSlot] = useState<HTMLElement | null>(null)
  const [toccata, setViva] = useState(0)
  // L'editor parte appena si tocca la colonna, senza aspettare che Puck segni il pezzo come scelto (mezzo secondo): i primi tasti non si perdono.
  const [premuto, setPremuto] = useState(false)
  useEffect(() => (scelto ? () => setPremuto(false) : undefined), [scelto])
  const attivo = scelto || premuto
  // Scelto un altro pezzo, questo smette di scrivere anche se Puck non l'aveva mai segnato come scelto.
  const altro = usePuck((s) => { const k = s.selectedItem?.props.id; return typeof k === 'string' && k !== id })
  useEffect(() => { if (altro) setPremuto(false) }, [altro])
  // Tolta una colonna, la viva non resta oltre l'ultima.
  const viva = Math.min(toccata, colonne.length - 1)
  // In cima alla pagina sopra il pezzo non c'è posto per la barra: lì sta nel pezzo, sopra il testo, e lo spinge giù.
  const pezzo = useRef<HTMLDivElement>(null)
  const [inCima, setInCima] = useState(false)
  useEffect(() => {
    const el = pezzo.current
    const pagina = el?.closest('.sito-pezzi-pagina')
    if (!attivo || !el || !(pagina instanceof HTMLElement)) return
    const sopra = el.getBoundingClientRect().top - pagina.getBoundingClientRect().top + pagina.scrollTop - parseFloat(getComputedStyle(pagina).paddingTop)
    setInCima(sopra < spazioBarra())
  }, [attivo, contenuto.length])
  // Il testo si dà a Puck con `replace`, un passo solo per ANNULLA e RIFAI (come per la foto).
  const scrivi = (i: number) => (html: string) => {
    const k = contenuto.findIndex((c) => c.props.id === id)
    // Puck dà il contenuto senza tipo; i pezzi sono quelli di `Props` (li controlla `pezziValidi` al salvataggio).
    ultimaScrittura = Date.now()
    if (k >= 0) dispatch({ type: 'replace', destinationIndex: k, destinationZone: ZONA, data: scriviTesto(contenuto[k] as unknown as Pezzo, html, i) as unknown as ComponentData })
  }
  // Un tocco sulla colonna non arriva al pezzo di Puck (la colonna è una zona sua, vedi `Colonna`): il pezzo si sceglie da qui, se no SU, GIÙ, TOGLI e le impostazioni non lo vedono.
  const sceglimi = () => {
    const k = contenuto.findIndex((c) => c.props.id === id)
    if (k >= 0 && !scelto) dispatch({ type: 'setUi', ui: { itemSelector: { index: k, zone: ZONA } } })
  }
  const solo = colonne.length === 1
  return (
    <div ref={pezzo} className="sito-pezzo" data-scelto={attivo || undefined}>
      {attivo && <div ref={setSlot} className="sito-barra-flotta" data-in-cima={inCima || undefined} />}
      <div className={solo ? undefined : 'sito-colonne'} style={solo ? undefined : { gridTemplateColumns: `repeat(${colonne.length}, minmax(0, 1fr))` }}>
        {colonne.map((c, i) => (
          <Colonna key={i} viva={attivo && !solo ? i === viva : undefined} onTocca={() => { setViva(i); setPremuto(true); sceglimi() }}>
            {attivo && i === viva ? (
              <TestoInPagina
                d={d}
                html={c.html}
                etichetta={solo ? 'Testo' : `Colonna ${i + 1}`}
                slot={slot}
                onCambia={(html) => cambia(conTestoScritto({ content: contenuto as unknown as Pezzo[] }, id, html, i))}
                onPausa={scrivi(i)}
                onStoria={(verso) => (verso === 'indietro' ? indietro() : avanti())}
              />
            ) : vuoto(c.html) ? (
              <span className="sito-pezzi-vuoto">{solo ? 'Testo vuoto' : `Colonna ${i + 1} vuota`}</span>
            ) : (
              <Testo html={c.html} />
            )}
          </Colonna>
        ))}
      </div>
    </div>
  )
}

/** Sotto una parte che spezza le tessere degli istruttori, la frase che dice cosa fare (`avvisoIstruttori`). */
function AvvisoIstruttori({ id }: { id: string }) {
  const frase = usePuck((s) => { const c = s.appState.data.content; return avvisoIstruttori(c, c.findIndex((x) => x.props.id === id)) })
  return frase ? <p className="sito-pezzi-avviso sotto-parte" role="note"><span aria-hidden="true">! </span>{frase}</p> : null
}

/** Un istruttore come lo vede chi scrive: foto (o iniziale), nome e cognome, corsi in pastiglie. La tessera vera la mostra «Com'è sul sito». */
function PezzoIstruttore({ nome, cognome, corsi, src, alt }: Props['istruttore']) {
  const pastiglie = corsiDa(corsi)
  // Appena messa, come le altre parti vuote: il tratteggio dice cosa manca.
  if (nome.trim() === '') return <span className="sito-pezzi-vuoto">Istruttore: scrivi il nome a destra</span>
  return (
    <div className="sito-pezzo-istruttore">
      {src ? <img src={src} alt={alt} /> : <span className="iniziale" aria-hidden="true">{nome.trim().slice(0, 1).toUpperCase()}</span>}
      <span className="stack" style={{ gap: 6, minWidth: 0 }}>
        <span className="nome">{nome.trim()} {cognome && <span className="cognome">{cognome}</span>}</span>
        {pastiglie.length > 0 && <span className="row" style={{ gap: 6, flexWrap: 'wrap' }}>{pastiglie.map((c, i) => <span key={i} className="pillola">{c}</span>)}</span>}
      </span>
    </div>
  )
}

/** La pagina dell'istruttore si sceglie fra quelle del sito; sotto, se non è pubblicata, che il nome non sarà ancora un link. */
function CampoPagina({ pagine, value, onChange }: { pagine: Pagine; value: string; onChange: (v: string) => void }) {
  const nota = notaPaginaIstruttore(value, pagine)
  return (
    <label className="stack" style={{ gap: 6 }}>
      <span className="sg-etichetta">LA SUA PAGINA</span>
      <select className="sg-campo" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Nessuna</option>
        {/* Una pagina tolta resta scelta finché non se ne sceglie un'altra: la nota lo dice. */}
        {value && !pagine.some((p) => p.slug === value) && <option value={value}>/{value}/</option>}
        {pagineIstruttore(pagine).map((p) => <option key={p.slug} value={p.slug}>{p.titolo} · /{p.slug}/</option>)}
      </select>
      {nota && <span className="sito-pezzi-avviso">{nota}</span>}
    </label>
  )
}

function configura(d: DatiSegreteria, pagine: Pagine): Config<Props> {
  const foto = {
    src: {
      type: 'custom' as const,
      label: 'FOTO',
      render: ({ value }: { value: string }) => <FotoDelPezzo d={d} src={value} />,
    },
    alt: { type: 'text' as const, label: 'COSA SI VEDE (vuoto = solo decorativa)' },
  }
  return {
    // La pagina non ha campi suoi (il titolo è quello del pannello).
    root: { fields: {}, render: ({ children }) => <>{children}</> },
    components: {
      fotoInCima: {
        label: 'FOTO IN CIMA',
        fields: foto,
        defaultProps: { src: '', alt: '' },
        render: ({ id, src, alt }) => <>{src ? <img src={src} alt={alt} style={{ width: '100%', maxHeight: 260, objectFit: 'cover' }} /> : <span className="sito-pezzi-vuoto">Foto in cima: scegli la foto</span>}<AvvisoIstruttori id={id} /></>,
      },
      testo: {
        label: 'TESTO',
        // Il testo si scrive nella pagina: il pannello di destra non ha niente da mostrare per questo campo (`Destra` dice dov'è).
        fields: { html: { type: 'custom', render: () => <></> } },
        defaultProps: { html: '' },
        render: ({ id, html }) => <><PezzoTesto d={d} id={id} colonne={[{ html }]} /><AvvisoIstruttori id={id} /></>,
      },
      foto: {
        label: 'FOTO',
        fields: foto,
        defaultProps: { src: '', alt: '' },
        render: ({ id, src, alt }) => <>{src ? <img src={src} alt={alt} style={{ width: '100%', maxHeight: 360, objectFit: 'cover' }} /> : <span className="sito-pezzi-vuoto">Foto: scegli la foto</span>}<AvvisoIstruttori id={id} /></>,
      },
      colonne: {
        label: 'COLONNE',
        // Le colonne si scrivono nella pagina; nel pannello restano solo quante sono (da 2 a 3), con aggiungi e togli.
        fields: { colonne: { type: 'array', label: 'COLONNE (da 2 a 3)', min: 2, max: 3, arrayFields: { html: { type: 'custom', render: () => <></> } }, defaultItemProps: colonnaNuova(), getItemSummary: (_, i) => `Colonna ${(i ?? 0) + 1}` } },
        defaultProps: { colonne: [{ html: '' }, { html: '' }] },
        render: ({ id, colonne }) => <><PezzoTesto d={d} id={id} colonne={colonne} /><AvvisoIstruttori id={id} /></>,
      },
      iscriviti: {
        label: 'ISCRIVITI',
        fields: {
          titolo: { type: 'text', label: 'TITOLO (vuoto = «Vieni a provare.»)' },
          frase: { type: 'textarea', label: 'FRASE (vuoto = quella di sempre)' },
        },
        defaultProps: { titolo: '', frase: '' },
        // Una per pagina e sempre in fondo: niente copia né trascinamento (SU e GIÙ la lasciano dov'è, `spostabile`).
        permissions: { duplicate: false, drag: false },
        // Sicuro: `invito` mette titolo e frase con le entità, il resto è fisso. La forma vera la mostra «Com'è sul sito».
        render: ({ titolo, frase }) => <div className="sito-testo" style={{ minHeight: 0, border: 0 }} dangerouslySetInnerHTML={{ __html: invito({ titolo, frase }, true) }} />,
      },
      istruttore: {
        label: 'ISTRUTTORE',
        fields: {
          src: foto.src,
          alt: { type: 'text', label: 'COSA SI VEDE (vuoto = «Ritratto di Nome Cognome»)' },
          nome: { type: 'text', label: 'NOME' },
          cognome: { type: 'text', label: 'COGNOME' },
          corsi: { type: 'text', label: 'CORSI (separati da una virgola)' },
          pagina: { type: 'custom', render: ({ value, onChange }) => <CampoPagina pagine={pagine} value={value} onChange={onChange} /> },
        },
        defaultProps: { nome: '', cognome: '', corsi: '', src: '', alt: '', pagina: '' },
        render: (p) => <PezzoIstruttore {...p} />,
      },
    },
  }
}

/** Il campo foto dentro il pannello di Puck: ha bisogno dell'id del pezzo scelto per scrivergli foto e testo alternativo insieme. */
function FotoDelPezzo({ d, src }: { d: DatiSegreteria; src: string }) {
  const id = usePuck((s) => s.selectedItem?.props.id)
  return typeof id === 'string' ? <CampoFoto d={d} id={id} src={src} /> : null
}

const FRASE_TESTO_IN_PAGINA = 'Il testo si scrive direttamente nella pagina.'

const PARTI: Array<{ tipo: keyof Props; nome: string }> = [
  { tipo: 'istruttore', nome: 'ISTRUTTORE' },
  { tipo: 'fotoInCima', nome: 'FOTO IN CIMA' },
  { tipo: 'testo', nome: 'TESTO' },
  { tipo: 'foto', nome: 'FOTO' },
  { tipo: 'colonne', nome: 'COLONNE' },
  { tipo: 'iscriviti', nome: 'ISCRIVITI' },
]

/**
 * I gesti senza trascinare: mettere una parte (dopo quella scelta, o in fondo), spostarla su o giù, toglierla.
 * Col dito sul tablet trascinare sbaglia facile; qui sono tasti da 44px.
 */
function Comandi({ onNuova, slug }: { onNuova: () => void; slug: string }) {
  const dispatch = usePuck((s) => s.dispatch)
  const scelto = usePuck((s) => s.appState.ui.itemSelector)
  const contenuto = usePuck((s) => s.appState.data.content)
  const { storia, indietro, avanti } = useStoria()
  const vai = (verso: number) => {
    if (!scelto) return
    dispatch({ type: 'move', sourceIndex: scelto.index, sourceZone: ZONA, destinationIndex: scelto.index + verso, destinationZone: ZONA })
    // La parte spostata resta scelta: spostarla di più posti non vuol dire toccarla ogni volta.
    dispatch({ type: 'setUi', ui: { itemSelector: { index: scelto.index + verso, zone: ZONA } } })
  }
  const metti = (tipo: keyof Props) => {
    const dove = doveMettere(tipo, scelto ? scelto.index : null, contenuto)
    dispatch({ type: 'insert', componentType: tipo, destinationIndex: dove, destinationZone: ZONA })
    // La parte nuova resta scelta: SU, GIÙ, TOGLI e i suoi campi sono lì, senza un tocco in più.
    dispatch({ type: 'setUi', ui: { itemSelector: { index: dove, zone: ZONA } } })
    onNuova()
  }
  // Tolta la parte, nessuna è scelta: l'indice di prima punterebbe alla seguente (o a nulla) senza che si veda.
  const togli = () => {
    if (!scelto) return
    dispatch({ type: 'remove', index: scelto.index, zone: ZONA })
    dispatch({ type: 'setUi', ui: { itemSelector: null } })
  }
  return (
    <div className="row" style={{ gap: 6, flexWrap: 'wrap', padding: 8 }}>
      {PARTI.filter((p) => parteAmmessa(p.tipo, slug)).map((p) => (
        <button key={p.tipo} type="button" className="sg-chip num" disabled={!puoMettere(p.tipo, contenuto)} title={motivoSpento(p.tipo, contenuto) ?? undefined} onClick={() => metti(p.tipo)}>
          + {p.nome}
        </button>
      ))}
      <span className="grow" />
      <button type="button" className="sg-chip num" disabled={!storia.hasPast} onClick={indietro}>Annulla</button>
      <button type="button" className="sg-chip num" disabled={!storia.hasFuture} onClick={avanti}>Rifai</button>
      <button type="button" className="sg-chip num" disabled={!scelto || !spostabile(contenuto, scelto.index, -1)} onClick={() => vai(-1)}>Su ▲</button>
      <button type="button" className="sg-chip num" disabled={!scelto || !spostabile(contenuto, scelto.index, 1)} onClick={() => vai(1)}>Giù ▼</button>
      <button data-bozza type="button" className="sg-chip num sg-pericolo" disabled={!scelto} onClick={togli}>Togli</button>
    </div>
  )
}

/** Le parole di Puck, nelle nostre. */
const PAROLE = {
  'label-page': 'Pagina',
  'label-component': 'Parte',
  'action-selectparent': 'Scegli quella sopra',
  'action-duplicate': 'Copia',
  'action-delete': 'Togli',
  'field-arrayitem-summary': 'Colonna {index}',
  'field-arrayitem-duplicate': 'Copia',
  'field-arrayitem-delete': 'Togli',
  'drawer-category-other': 'Parti',
}

/**
 * A destra due schede: le impostazioni della parte scelta e l'elenco delle parti. Le parti si mettono coi tasti in alto,
 * quindi a sinistra non serve un pannello: la pagina prende lo spazio.
 */
type Scheda = 'impostazioni' | 'elenco'

function Destra({ scheda, setScheda }: { scheda: Scheda; setScheda: (k: Scheda) => void }) {
  const dispatch = usePuck((s) => s.dispatch)
  const scelto = usePuck((s) => s.appState.ui.itemSelector)
  const content = usePuck((s) => s.appState.data.content)
  const scelta = usePuck((s) => s.selectedItem)
  return (
    <div className="sito-pezzi-destra">
      <div role="tablist" aria-label="Pannello della parte" className="schede sg-schede">
        {(['impostazioni', 'elenco'] as const).map((k) => (
          <button key={k} type="button" role="tab" aria-selected={scheda === k} data-on={scheda === k} className="scheda" onClick={() => setScheda(k)}>
            {k === 'impostazioni' ? 'Impostazioni' : 'Elenco'}
          </button>
        ))}
      </div>
      {scheda === 'elenco' ? (
        <div className="stack" style={{ gap: 6 }}>
          {content.length === 0 && <p className="sito-pezzi-frase">Nessuna parte: mettine una coi tasti + in alto.</p>}
          {content.map((c, i) => (
            <button
              key={String(c.props.id)}
              type="button"
              className="sito-pezzi-riga"
              data-on={scelto?.index === i}
              onClick={() => dispatch({ type: 'setUi', ui: { itemSelector: { index: i, zone: ZONA } } })}
            >
              {/* Puck dà il contenuto come dati senza tipo; i pezzi sono quelli di `Props` (li controlla `pezziValidi` al salvataggio). */}
              {i + 1} · {nomeParte(c as unknown as Pezzo)}
            </button>
          ))}
        </div>
      ) : scelta?.type === 'testo' ? (
        <p className="sito-pezzi-frase">{FRASE_TESTO_IN_PAGINA}</p>
      ) : scelta ? (
        <Puck.Fields />
      ) : (
        <p className="sito-pezzi-frase">{FRASE_NESSUNA_PARTE}</p>
      )}
    </div>
  )
}

/** `slug`: l'indirizzo della pagina, che decide quali parti si mettono (`parteAmmessa`). */
export default function EditorPezzi({ d, pezzi, onCambia, pagine, slug }: { d: DatiSegreteria; pezzi: PezziPagina; onCambia: (p: PezziPagina) => void; pagine: Pagine; slug: string }) {
  const config = useMemo(() => configura(d, pagine), [d, pagine])
  // Puck vuole anche `root`; i pezzi sono quelli che teniamo noi. Si parte una volta sola: poi i pezzi li tiene Puck.
  const [iniziali] = useState<Data>(() => ({ root: { props: {} }, content: pezzi.content }))
  const [scheda, setScheda] = useState<Scheda>('impostazioni')
  return (
    <div className="sito-pezzi" aria-label="Pezzi della pagina">
      <Cambia.Provider value={onCambia}>
      <Puck
        config={config}
        data={iniziali}
        iframe={{ enabled: false }}
        dictionary={PAROLE}
        onChange={(data) => {
          // I pezzi escono da Puck come dati senza tipo: `pezziValidi` li controlla prima di salvarli (Sito.tsx).
          onCambia({ content: data.content as unknown as Pezzo[] })
        }}
      >
        <div className="sito-pezzi-corpo">
          <Comandi onNuova={() => setScheda('impostazioni')} slug={slug} />
          <div className="sito-pezzi-colonne">
            {/* Toccare una parte nella pagina porta alle sue impostazioni; dall'elenco si resta lì, per spostarla con «Su» e «Giù». */}
            <div className="sito-pezzi-pagina" onClickCapture={() => setScheda('impostazioni')}><Puck.Preview /></div>
            <Destra scheda={scheda} setScheda={setScheda} />
          </div>
        </div>
      </Puck>
      </Cambia.Provider>
    </div>
  )
}
