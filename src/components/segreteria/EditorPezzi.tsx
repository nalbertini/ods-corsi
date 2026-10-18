import { useMemo, useState } from 'react'
import { createUsePuck, Puck, type Config, type Data } from '@puckeditor/core'
import '@puckeditor/core/puck.css'
import type { DatiSegreteria } from '../../lib/segreteria'
import { FRASE_NESSUNA_PARTE, MASSIMO_PEZZI, colonnaNuova, nomeParte, vuoto, type Pezzo, type PezziPagina } from '../../lib/sitoPezzi'
import { pulisciTesto } from '../../lib/sitoTesto'
import { EditorTesto } from './EditorTesto'
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
}

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

function configura(d: DatiSegreteria): Config<Props> {
  const campoTesto = (etichetta: string) => ({
    type: 'custom' as const,
    label: etichetta,
    render: ({ value, onChange, name }: { value: string; onChange: (v: string) => void; name: string }) => (
      <EditorTesto valore={value} onCambia={onChange} etichetta={`${etichetta} (${name})`} d={d} />
    ),
  })
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
        render: ({ src, alt }) => (src ? <img src={src} alt={alt} style={{ width: '100%', maxHeight: 260, objectFit: 'cover' }} /> : <span className="sito-pezzi-vuoto">Foto in cima: scegli la foto</span>),
      },
      testo: {
        label: 'TESTO',
        fields: { html: campoTesto('Testo') },
        defaultProps: { html: '' },
        render: ({ html }) => (vuoto(html) ? <span className="sito-pezzi-vuoto">Testo vuoto</span> : <Testo html={html} />),
      },
      foto: {
        label: 'FOTO',
        fields: foto,
        defaultProps: { src: '', alt: '' },
        render: ({ src, alt }) => (src ? <img src={src} alt={alt} style={{ width: '100%', maxHeight: 360, objectFit: 'cover' }} /> : <span className="sito-pezzi-vuoto">Foto: scegli la foto</span>),
      },
      colonne: {
        label: 'COLONNE',
        fields: { colonne: { type: 'array', label: 'COLONNE (da 2 a 3)', min: 2, max: 3, arrayFields: { html: campoTesto('Colonna') }, defaultItemProps: colonnaNuova(), getItemSummary: (_, i) => `Colonna ${(i ?? 0) + 1}` } },
        defaultProps: { colonne: [{ html: '' }, { html: '' }] },
        render: ({ colonne }) => (
          <div style={{ display: 'grid', gap: 16, gridTemplateColumns: `repeat(${colonne.length}, minmax(0, 1fr))` }}>
            {colonne.map((c, i) => (vuoto(c.html) ? <span key={i} className="sito-pezzi-vuoto">{`Colonna ${i + 1} vuota`}</span> : <Testo key={i} html={c.html} />))}
          </div>
        ),
      },
    },
  }
}

/** Il campo foto dentro il pannello di Puck: ha bisogno dell'id del pezzo scelto per scrivergli foto e testo alternativo insieme. */
function FotoDelPezzo({ d, src }: { d: DatiSegreteria; src: string }) {
  const id = usePuck((s) => s.selectedItem?.props.id)
  return typeof id === 'string' ? <CampoFoto d={d} id={id} src={src} /> : null
}

const PARTI: Array<{ tipo: keyof Props; nome: string }> = [
  { tipo: 'fotoInCima', nome: 'FOTO IN CIMA' },
  { tipo: 'testo', nome: 'TESTO' },
  { tipo: 'foto', nome: 'FOTO' },
  { tipo: 'colonne', nome: 'COLONNE' },
]

/**
 * I gesti senza trascinare: mettere una parte (dopo quella scelta, o in fondo), spostarla su o giù, toglierla.
 * Col dito sul tablet trascinare sbaglia facile; qui sono tasti da 44px.
 */
function Comandi({ onNuova }: { onNuova: () => void }) {
  const dispatch = usePuck((s) => s.dispatch)
  const scelto = usePuck((s) => s.appState.ui.itemSelector)
  const quanti = usePuck((s) => s.appState.data.content.length)
  const storia = usePuck((s) => s.history)
  const vai = (verso: number) => {
    if (!scelto) return
    dispatch({ type: 'move', sourceIndex: scelto.index, sourceZone: ZONA, destinationIndex: scelto.index + verso, destinationZone: ZONA })
    // La parte spostata resta scelta: spostarla di più posti non vuol dire toccarla ogni volta.
    dispatch({ type: 'setUi', ui: { itemSelector: { index: scelto.index + verso, zone: ZONA } } })
  }
  const metti = (tipo: keyof Props) => {
    const dove = scelto ? scelto.index + 1 : quanti
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
      {PARTI.map((p) => (
        <button key={p.tipo} type="button" className="sg-chip num" disabled={quanti >= MASSIMO_PEZZI} onClick={() => metti(p.tipo)}>
          + {p.nome}
        </button>
      ))}
      <span className="grow" />
      <button type="button" className="sg-chip num" disabled={!storia.hasPast} onClick={() => storia.back()}>Annulla</button>
      <button type="button" className="sg-chip num" disabled={!storia.hasFuture} onClick={() => storia.forward()}>Rifai</button>
      <button type="button" className="sg-chip num" disabled={!scelto || scelto.index === 0} onClick={() => vai(-1)}>Su ▲</button>
      <button type="button" className="sg-chip num" disabled={!scelto || scelto.index >= quanti - 1} onClick={() => vai(1)}>Giù ▼</button>
      <button type="button" className="sg-chip num" disabled={!scelto} onClick={togli}>Togli</button>
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
      ) : scelta ? (
        <Puck.Fields />
      ) : (
        <p className="sito-pezzi-frase">{FRASE_NESSUNA_PARTE}</p>
      )}
    </div>
  )
}

export default function EditorPezzi({ d, pezzi, onCambia }: { d: DatiSegreteria; pezzi: PezziPagina; onCambia: (p: PezziPagina) => void }) {
  const config = useMemo(() => configura(d), [d])
  // Puck vuole anche `root`; i pezzi sono quelli che teniamo noi. Si parte una volta sola: poi i pezzi li tiene Puck.
  const [iniziali] = useState<Data>(() => ({ root: { props: {} }, content: pezzi.content }))
  const [scheda, setScheda] = useState<Scheda>('impostazioni')
  return (
    <div className="sito-pezzi" aria-label="Pezzi della pagina">
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
          <Comandi onNuova={() => setScheda('impostazioni')} />
          <div className="sito-pezzi-colonne">
            {/* Toccare una parte nella pagina porta alle sue impostazioni; dall'elenco si resta lì, per spostarla con «Su» e «Giù». */}
            <div className="sito-pezzi-pagina" onClickCapture={() => setScheda('impostazioni')}><Puck.Preview /></div>
            <Destra scheda={scheda} setScheda={setScheda} />
          </div>
        </div>
      </Puck>
    </div>
  )
}
