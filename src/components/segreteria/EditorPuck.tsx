import { createContext, useContext, useId, useMemo, useState, type ReactNode } from 'react'
import { AutoField, Button, createUsePuck, FieldLabel, Puck, RichTextMenu, type Config, type Data, type RichtextField } from '@puckeditor/core'
import type { Editor } from '@tiptap/react'
import '@puckeditor/core/puck.css'
import type { DatiSegreteria } from '../../lib/segreteria'
import { conteggio, controllaSlug, LIMITE_DESCRIZIONE, LIMITE_TITOLO, PAROLE_STATO, pagineDiLeggeProtette, statoPagina, type PaginaSito } from '../../lib/sitoPagine'
import { CSS_SITO, invito, parteSulSito } from '../../lib/sitoGenera'
import { CONTATTI } from '../../lib/sito'
import { segnapostoRimasti } from '../../lib/sitoAccessibilita'
import { avvisoIstruttori, conIndirizziGiusti, cosaNonVaPezzi, cosaNonVaPubblicare, cosaNonVaSalvare, daSalvare, dividiInParti, divisibileInParti, MASSIMO_DOMANDE, MASSIMO_PULSANTI, notaPaginaIstruttore, pagineIstruttore, parteAmmessa, pezziDaAprire, pezziInHtml, salvaAParti, senzaPunto, TESTO_DEL_SITO, type BozzaPezzi, type Domanda, type DovePorta, type Pezzo, type Pulsante } from '../../lib/sitoPezzi'
import { pulisciTesto } from '../../lib/sitoTesto'
import { ESTENSIONI_TESTO, indirizzoDelLink } from '../../lib/sitoTiptap'
import AnteprimaPagina from './AnteprimaPagina'
import { ScegliImmagine } from './ImmaginiSito'
import { OrarioSito } from './OrarioSito'
import { chiedi, useAvviso, useBozza } from './comune'

/**
 * L'editor delle pagine del sito: Puck completo, col suo aspetto. Puck tiene le parti, la struttura,
 * i formati dello schermo e la colonna di destra; noi gli diamo le parti, il CSS del sito, i campi della
 * pagina (titolo, descrizione, indirizzo, orario, nascondi, cancella) e i tasti Salva bozza e Pubblica.
 */

/** Il testo è `string` nei dati; mentre si scrive nella pagina Puck lo dà al disegno già come editor (`RichText`). */
type Testo = string | ReactNode
type Props = {
  fotoInCima: { src: string; alt: string }
  testo: { html: Testo }
  foto: { src: string; alt: string }
  colonne: { colonne: Array<{ html: Testo }> }
  iscriviti: { titolo: string; frase: string }
  pulsanti: { pulsanti: Pulsante[] }
  domande: { titolo: string; domande: Domanda[] }
  istruttore: { nome: string; cognome: string; corsi: string; src: string; alt: string; pagina: string }
}
/** I campi della pagina. Solo titolo e descrizione si salvano coi pezzi; gli altri agiscono subito e non tengono valori. */
type Radice = { titolo: string; descrizione: string; indirizzo?: string; orario?: string; dividi?: string; sulSito?: string }

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
      <Button variant="secondary" onClick={() => setApri(true)}>{valore ? 'Cambia foto' : 'Scegli la foto'}</Button>
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

/** Quel che i campi della pagina e della parte ISTRUTTORE leggono e fanno: cambia a ogni salvataggio, la config di Puck no. */
type Pagina = {
  d: DatiSegreteria
  pagina: PaginaSito
  pagine: PaginaSito[]
  lavora: boolean
  fai: ReturnType<typeof useAvviso>['fai']
  avvisa: ReturnType<typeof useAvviso>['avvisa']
  ricarica: () => Promise<void>
  onChiudi: () => void
}
const PaginaAperta = createContext<Pagina | null>(null)
function usePagina(): Pagina {
  const p = useContext(PaginaAperta)
  // shortcut: i campi si disegnano solo dentro EditorPuck, che dà sempre il contesto.
  if (!p) throw new Error('Campo della pagina fuori dall’editor')
  return p
}

/** Un campo di testo di Puck col conteggio delle lettere sotto: oltre il limite lo dice anche a parole. */
function CampoConto({ label, limite, area, value, onChange, oltre }: { label: string; limite: number; area?: boolean; value: string; onChange: (v: string) => void; oltre: string }) {
  // Gli spazi in fondo non contano: il salvataggio li toglie.
  const { n, troppo } = conteggio((value ?? '').trim(), limite)
  return (
    <FieldLabel label={label}>
      <AutoField field={{ type: area ? 'textarea' : 'text', label }} value={value ?? ''} onChange={onChange} />
      <p className={troppo ? 'sito-puck-nota sito-puck-troppo' : 'sito-puck-nota'}>{n} su {limite}{troppo ? ` · ${oltre}` : ''}</p>
    </FieldLabel>
  )
}

/** L'indirizzo della pagina si cambia subito, non col salvataggio: il vecchio porta al nuovo. Le pagine di legge lo tengono fisso. */
function CampoIndirizzoPagina() {
  const { d, pagina, pagine, lavora, fai, ricarica } = usePagina()
  const [slug, setSlug] = useState(pagina.slug)
  if (pagina.diLegge) return <FieldLabel label="Indirizzo della pagina"><p className="sito-puck-nota">/{pagina.slug}/ · {pagineDiLeggeProtette(pagina, 'indirizzo')}</p></FieldLabel>
  const no = slug === pagina.slug ? null : controllaSlug(slug, pagine.filter((p) => p.id !== pagina.id).map((p) => p.slug))
  return (
    <FieldLabel label="Indirizzo della pagina">
      <input className="sito-puck-campo" data-avviso={!!no} value={slug} onChange={(e) => setSlug(e.target.value.trim())} />
      {no ? <p className="sito-puck-nota sito-puck-troppo">{no}</p> : pagina.pubblicato !== null && <p className="sito-puck-nota">Se lo cambi, il vecchio indirizzo porta al nuovo: i link già mandati funzionano ancora.</p>}
      {slug !== pagina.slug && (
        <div style={{ marginTop: 8 }}>
          <Button variant="secondary" disabled={lavora || !!no} onClick={() => void fai(() => d.cambiaIndirizzoSito(pagina.id, slug), 'Indirizzo cambiato', ricarica)}>Cambia indirizzo</Button>
        </div>
      )}
    </FieldLabel>
  )
}

/** I corsi collegati: valgono subito, senza Salva bozza né Pubblica. */
function CampoOrario() {
  const { d, pagina, lavora, fai, ricarica } = usePagina()
  return (
    <FieldLabel label="Orario dai corsi">
      <OrarioSito d={d} pagina={pagina} lavora={lavora} onCambia={(corsi) => void fai(() => d.collegaCorsiSito(pagina.id, corsi), 'Fatto. Il sito si aggiorna da solo entro 5 minuti', ricarica)} />
      {!!pagina.corsiCollegati?.length && <p className="sito-puck-nota">Va subito sul sito, entro 5 minuti, senza Salva bozza né Pubblica.</p>}
    </FieldLabel>
  )
}

/** Un testo lungo coi titoli diventa una parte per titolo; resta da salvare, e ANNULLA lo rimette com'era. */
function CampoDividi() {
  const { avvisa } = usePagina()
  const dati = usePuck((s) => s.appState.data)
  const dispatch = usePuck((s) => s.dispatch)
  // Nei dati di Puck il testo è sempre `string`, come nei pezzi (vedi `bozzaDa`).
  const pezzi = { content: dati.content as unknown as Pezzo[] }
  if (!divisibileInParti(pezzi)) return <></>
  const dividi = async () => {
    const nuovi = dividiInParti(pezzi)
    const no = cosaNonVaPezzi(nuovi)
    if (no) return avvisa(no, true)
    if (!(await chiedi('Dividere il testo in parti? Ogni titolo e ogni foto aprono una parte nuova. Il testo non cambia, e non va online finché non pubblichi. Se non ti piace, premi Annulla in alto.', 'Dividi', { no: 'Lascia stare' }))) return
    // Un passo nella storia: Annulla in alto rimette il testo com'era.
    // Stessi pezzi, nel tipo dei dati di Puck (il testo `string` è uno dei casi di `Testo`).
    dispatch({ type: 'setData', data: { ...dati, content: nuovi.content as unknown as typeof dati.content }, recordHistory: true })
  }
  return (
    <FieldLabel label="Dividi in parti">
      <p className="sito-puck-nota">Ogni titolo e ogni foto del testo aprono una parte nuova. Il testo non cambia.</p>
      <div style={{ marginTop: 8 }}><Button variant="secondary" onClick={() => void dividi()}>Dividi in parti</Button></div>
    </FieldLabel>
  )
}

/** Nascondi e cancella: subito, con la domanda prima. Le pagine di legge restano sempre sul sito. */
function CampoSulSito() {
  const { d, pagina, lavora, fai, ricarica, onChiudi } = usePagina()
  if (pagina.diLegge) return <p className="sito-puck-nota">{pagineDiLeggeProtette(pagina, 'cancella')}</p>
  const nascondi = async () => {
    if (!pagina.nascosta && !(await chiedi(`Nascondere «${pagina.titolo}»? Sparisce dal sito alla prossima pubblicazione, ma resta qui.`, 'Nascondi', { pericolo: true }))) return
    await fai(() => d.nascondiPaginaSito(pagina.id, !pagina.nascosta), pagina.nascosta ? 'Di nuovo sul sito' : 'Nascosta', ricarica)
  }
  const cancella = async () => {
    if (!(await chiedi(`Cancellare «${pagina.titolo}»? Non si può rimettere.`, 'Cancella la pagina', { pericolo: true }))) return
    await fai(() => d.cancellaPaginaSito(pagina.id), 'Pagina cancellata', async () => {
      await ricarica()
      onChiudi()
    })
  }
  return (
    <FieldLabel label="Sul sito">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Button variant="secondary" fullWidth disabled={lavora} onClick={() => void nascondi()}>{pagina.nascosta ? 'Mostra sul sito' : 'Nascondi dal sito'}</Button>
        <Button variant="secondary" fullWidth disabled={lavora} onClick={() => void cancella()}>Cancella la pagina</Button>
      </div>
    </FieldLabel>
  )
}

/** La pagina di un istruttore si sceglie fra quelle del sito; sotto, se non è pubblicata, che il nome non sarà ancora un link. */
function CampoPaginaIstruttore({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { pagine } = usePagina()
  const nota = notaPaginaIstruttore(value, pagine)
  return (
    <FieldLabel label="La sua pagina">
      <select className="sito-puck-campo" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Nessuna</option>
        {/* Una pagina tolta resta scelta finché non se ne sceglie un'altra: la nota lo dice. */}
        {value && !pagine.some((p) => p.slug === value) && <option value={value}>/{value}/</option>}
        {pagineIstruttore(pagine).map((p) => <option key={p.slug} value={p.slug}>{p.titolo} · /{p.slug}/</option>)}
      </select>
      {nota && <p className="sito-puck-nota sito-puck-avviso">{nota}</p>}
    </FieldLabel>
  )
}

/** Sotto una parte che spezza le tessere degli istruttori, la frase che dice cosa fare (`avvisoIstruttori`). Nell'iframe c'è solo il CSS del sito: lo stile è qui, col «!» davanti. */
function AvvisoIstruttori({ id }: { id: string }) {
  const frase = usePuck((s) => { const c = s.appState.data.content; return avvisoIstruttori(c, c.findIndex((x) => x.props.id === id)) })
  return frase ? <p role="note" style={{ margin: '6px 0 12px', fontSize: 14, fontWeight: 600 }}>! {frase}</p> : null
}

/** La barra di un testo: quella di Puck, più Link e Pulsante (Puck non ne ha), con l'indirizzo scritto sotto. */
function MenuTesto({ children, editor }: { children: ReactNode; editor: Editor | null }) {
  const [link, setLink] = useState<{ indirizzo: string; pulsante: boolean; guaio?: string } | null>(null)
  // `getAttributes` dà un oggetto senza tipo: qui si legge solo quello che il link porta.
  const attuale = (editor?.getAttributes('link') ?? {}) as { href?: string; class?: string | null }
  const ePulsante = attuale.class === 'pulsante'
  const apri = (pulsante: boolean) => setLink({ indirizzo: attuale.href ?? '', pulsante })
  // Puck passa la modifica ai dati solo se il campo ha il fuoco, e col fuoco sul campo dell'indirizzo non ce l'ha:
  // si riporta il fuoco nel testo e si cambia solo dopo, se no il link si vede ma non risulta «da salvare».
  const conFuoco = (cambia: () => void) => {
    if (!editor) return
    if (editor.isFocused) return cambia()
    editor.once('focus', cambia)
    editor.commands.focus()
  }
  const metti = () => {
    if (!editor || !link) return
    // Senza parole selezionate il link non avrebbe dove stare, e premere METTI sembrerebbe non fare nulla.
    if (editor.state.selection.empty && !editor.isActive('link')) return setLink({ ...link, guaio: 'Prima seleziona le parole che devono diventare un link' })
    const r = indirizzoDelLink(link.indirizzo)
    if ('guaio' in r) return setLink({ ...link, guaio: r.guaio })
    conFuoco(() => editor.chain().extendMarkRange('link').setMark('link', { href: r.indirizzo, class: link.pulsante ? 'pulsante' : null }).run())
    setLink(null)
  }
  const inLink = !!editor?.isActive('link')
  return (
    <RichTextMenu>
      {children}
      <RichTextMenu.Group>
        <RichTextMenu.Control title="Link" icon={<span style={{ textDecoration: 'underline' }}>Link</span>} active={inLink && !ePulsante} disabled={!editor} onClick={() => apri(false)} />
        <RichTextMenu.Control title="Pulsante" icon={<span>Pulsante</span>} active={inLink && ePulsante} disabled={!editor} onClick={() => apri(true)} />
      </RichTextMenu.Group>
      {link && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, width: '100%', padding: 6 }}>
          <input
            className="sito-puck-campo"
            aria-label={link.pulsante ? 'Dove porta il pulsante' : 'Dove porta il link'}
            placeholder="https://… oppure /chi-siamo"
            autoFocus
            onFocus={(e) => e.target.select()}
            value={link.indirizzo}
            data-avviso={!!link.guaio}
            onChange={(e) => setLink({ ...link, indirizzo: e.target.value, guaio: undefined })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); metti() }
              if (e.key === 'Escape') setLink(null)
            }}
          />
          {link.guaio && <p className="sito-puck-nota sito-puck-troppo" style={{ width: '100%' }}>{link.guaio}</p>}
          <Button variant="primary" onClick={metti}>Metti</Button>
          {inLink && <Button variant="secondary" onClick={() => { conFuoco(() => editor?.chain().extendMarkRange('link').unsetLink().run()); setLink(null) }}>Togli</Button>}
          <Button variant="secondary" onClick={() => setLink(null)}>Lascia stare</Button>
        </div>
      )}
    </RichTextMenu>
  )
}

/** Un campo di testo del sito: le opzioni che il sito tiene, foto e pulsanti che restano (`sitoTiptap.ts`), Link e Pulsante nella barra. */
const testoDelSito = (label: string, altro: Partial<RichtextField> = {}): RichtextField => ({
  type: 'richtext',
  label,
  options: TESTO_DEL_SITO,
  tiptap: { extensions: ESTENSIONI_TESTO },
  renderMenu: ({ children, editor }) => <MenuTesto editor={editor}>{children}</MenuTesto>,
  ...altro,
})

const DOVE: Array<{ label: string; value: DovePorta }> = [
  { label: 'Modulo di iscrizione', value: 'modulo' },
  { label: 'Telefono', value: 'telefono' },
  { label: 'WhatsApp', value: 'whatsapp' },
  { label: 'Una pagina del sito', value: 'pagina' },
  { label: 'Altro indirizzo', value: 'altro' },
]

/** Il numero del pulsante nel campo array di Puck, dal nome del campo («pulsanti[1].testo»). */
const numeroDi = (name: string) => Number(/\[(\d+)\]/.exec(name)?.[1] ?? -1)

/** Quello che il pulsante sa già, dal pezzo scelto: il campo di Puck vede solo il suo valore. */
function useDove(name: string): DovePorta | undefined {
  return usePuck((s) => {
    const p = s.selectedItem?.props
    return p && 'pulsanti' in p ? p.pulsanti[numeroDi(name)]?.dove : undefined
  })
}

/** Il testo del pulsante: quello del modulo non si scrive, sul sito è sempre «Iscriviti». */
function CampoTesto({ name, value, onChange }: { name: string; value: string; onChange: (v: string) => void }) {
  const dove = useDove(name)
  if (dove === 'modulo') return <p className="sito-puck-nota">Sul sito si legge sempre «Iscriviti», giallo e per primo. Il prezzo scrivilo nella parte Testo.</p>
  return <FieldLabel label="Testo"><input className="sito-puck-campo" value={value} onChange={(e) => onChange(e.target.value)} /></FieldLabel>
}

/** Dove porta, quando non lo sa già il sito: una pagina pubblicata da scegliere, o l'indirizzo scritto. */
function CampoIndirizzo({ name, value, onChange, verso }: { name: string; value: string; onChange: (v: string) => void; verso: Array<{ slug: string; titolo: string }> }) {
  const dove = useDove(name)
  if (dove === 'pagina')
    return (
      <>
        <FieldLabel label="Pagina">
          <select className="sito-puck-campo" value={value} onChange={(e) => onChange(e.target.value)}>
            <option value="">Scegli la pagina</option>
            {verso.map((p) => <option key={p.slug} value={p.slug}>{p.titolo}</option>)}
          </select>
        </FieldLabel>
        <p className="sito-puck-nota">Solo le pagine pubblicate. Contatti non c’è: sul sito è nel menu.</p>
      </>
    )
  if (dove === 'altro') return <FieldLabel label="Indirizzo"><input className="sito-puck-campo" placeholder="https://… oppure /chi-siamo" value={value} onChange={(e) => onChange(e.target.value)} /></FieldLabel>
  // Il modulo lo dice già il campo di sotto; il numero non va a capo a metà.
  return dove === 'modulo' ? <></> : <p className="sito-puck-nota">Il numero del sito, {CONTATTI.telefono.replace(/ /g, '\u00a0')}.</p>
}

/** La domanda, con l'avviso se non finisce con «?»: si salva lo stesso, ma sul sito non esce come domanda. */
function CampoDomanda({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const manca = senzaPunto(value)
  const avviso = useId()
  return (
    <FieldLabel label="Domanda">
      <input className="sito-puck-campo" data-avviso={manca} aria-describedby={manca ? avviso : undefined} value={value} onChange={(e) => onChange(e.target.value)} />
      {manca && <p id={avviso} className="sito-puck-nota sito-puck-avviso">Finisce senza «?»: sul sito tutte le domande di questa parte escono come tessere colorate, e Google non legge questa. Scrivila come domanda, per esempio «Quanto costa?».</p>}
    </FieldLabel>
  )
}

/**
 * Le domande nella pagina, dai dati di Puck: al disegno Puck passa la risposta (richtext) già come editor, non come testo,
 * e la parte resterebbe sempre vuota. I dati hanno il testo vero.
 */
function DomandeInPagina({ id }: { id: string }) {
  const parte = usePuck((s) => s.appState.data.content.find((c) => c.props.id === id))
  const html = parte?.type === 'domande' ? parteSulSito({ type: 'domande', props: { id, titolo: parte.props.titolo, domande: parte.props.domande.map((q) => ({ domanda: q.domanda, risposta: typeof q.risposta === 'string' ? q.risposta : '' })) } }) : ''
  // Sicuro: `parteSulSito` passa da `pezziInHtml`, che ripulisce. Le tessere col colore che avranno (chiare solo se tutte finiscono con «?»).
  return html ? <div dangerouslySetInnerHTML={{ __html: html }} /> : <span className="sito-pezzi-vuoto">Nessuna domanda pronta: scrivi domanda e risposta a destra</span>
}

function configura(d: DatiSegreteria, slug: string, diLegge: boolean, verso: Array<{ slug: string; titolo: string }>): Config<Props, Radice> {
  const foto = {
    src: { type: 'custom' as const, label: 'Foto', render: ({ value }: { value: string }) => <CampoFoto d={d} valore={value} /> },
    alt: { type: 'text' as const, label: 'Cosa si vede (vuoto = solo decorativa)' },
  }
  const immagine = (alta: number) => ({ id, src, alt }: { id: string; src: string; alt: string }) => (
    <>
      {src ? <img src={src} alt={alt} style={{ width: '100%', maxHeight: alta, objectFit: 'cover', display: 'block' }} /> : <span className="sito-pezzi-vuoto">Manca la foto: sceglila a destra</span>}
      <AvvisoIstruttori id={id} />
    </>
  )
  const nascoste = (['fotoInCima', 'testo', 'foto', 'colonne', 'pulsanti', 'domande', 'iscriviti', 'istruttore'] as const).filter((t) => !parteAmmessa(t, slug, diLegge))
  // Un campo che fa (indirizzo, orario, dividi, nascondi): disegna solo il suo componente, il valore non c'è.
  const fa = (Campo: () => ReactNode) => ({ type: 'custom' as const, render: () => <Campo /> })
  return {
    // Le parti che questa pagina non ammette non sono fra quelle da mettere (`parteAmmessa`): ISTRUTTORE fuori da Istruttori, tutto tranne Testo in una pagina di legge.
    ...(nascoste.length ? { categories: { nascoste: { components: [...nascoste], visible: false } } } : {}),
    root: {
      fields: {
        titolo: { type: 'custom', render: ({ value, onChange }) => <CampoConto label="Titolo (anche su Google)" limite={LIMITE_TITOLO} value={value} onChange={onChange} oltre="per pubblicare accorcialo" /> },
        descrizione: { type: 'custom', render: ({ value, onChange }) => <CampoConto label="Descrizione" area limite={LIMITE_DESCRIZIONE} value={value} onChange={onChange} oltre="Google la taglia" /> },
        indirizzo: fa(CampoIndirizzoPagina),
        ...(diLegge ? {} : { orario: fa(CampoOrario), dividi: fa(CampoDividi) }),
        sulSito: fa(CampoSulSito),
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
        fields: { html: testoDelSito('Testo', { contentEditable: true }) },
        defaultProps: { html: '' },
        render: ({ id, html }) => <><Html v={html} /><AvvisoIstruttori id={id} /></>,
      },
      foto: { label: 'Foto', fields: foto, defaultProps: { src: '', alt: '' }, render: immagine(360) },
      colonne: {
        label: 'Colonne',
        fields: { colonne: { type: 'array', label: 'Colonne (da 2 a 3)', min: 2, max: 3, arrayFields: { html: testoDelSito('Testo') }, defaultItemProps: { html: '' }, getItemSummary: (_, i) => `Colonna ${(i ?? 0) + 1}` } },
        defaultProps: { colonne: [{ html: '' }, { html: '' }] },
        render: ({ id, colonne }) => (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${colonne.length}, minmax(0, 1fr))`, gap: 24 }}>
              {colonne.map((c, i) => <Html key={i} v={c.html} />)}
            </div>
            <AvvisoIstruttori id={id} />
          </>
        ),
      },
      pulsanti: {
        label: 'Pulsanti',
        fields: {
          pulsanti: {
            type: 'array',
            label: `Pulsanti (da 1 a ${MASSIMO_PULSANTI})`,
            min: 1,
            max: MASSIMO_PULSANTI,
            arrayFields: {
              dove: { type: 'select', label: 'Dove porta', options: DOVE },
              indirizzo: { type: 'custom', label: 'Dove', render: ({ name, value, onChange }) => <CampoIndirizzo name={name} value={value} onChange={onChange} verso={verso} /> },
              testo: { type: 'custom', label: 'Testo', render: ({ name, value, onChange }) => <CampoTesto name={name} value={value} onChange={onChange} /> },
            },
            defaultItemProps: { dove: 'modulo', testo: '', indirizzo: '' },
            // Corto: nel pannello del tablet ogni parola in più è una riga in più. Dove porta lo dice il pulsante aperto.
            getItemSummary: (b, i) => `${(i ?? 0) + 1} · ${b.dove === 'modulo' ? 'Iscriviti' : b.testo.trim() || 'Senza testo'}`,
          },
        },
        defaultProps: { pulsanti: [{ dove: 'modulo', testo: '', indirizzo: '' }] },
        resolveData: (data, { lastData }) => ({ ...data, props: { ...data.props, pulsanti: conIndirizziGiusti(lastData?.props.pulsanti ?? [], data.props.pulsanti) } }),
        // Sicuro: `parteSulSito` passa da `pezziInHtml`, che ripulisce. È la fila com'è sul sito.
        render: ({ id, pulsanti }) => {
          const html = parteSulSito({ type: 'pulsanti', props: { id, pulsanti } })
          return html ? <div dangerouslySetInnerHTML={{ __html: html }} /> : <span className="sito-pezzi-vuoto">Nessun pulsante pronto: scegli dove porta e scrivi il testo a destra</span>
        },
      },
      domande: {
        label: 'Domande',
        fields: {
          titolo: { type: 'text', label: 'Titolo (vuoto = «Domande frequenti»)' },
          domande: {
            type: 'array',
            label: 'Domande',
            max: MASSIMO_DOMANDE,
            arrayFields: {
              domanda: { type: 'custom', label: 'Domanda', render: ({ value, onChange }) => <CampoDomanda value={value} onChange={onChange} /> },
              // Niente titoli nella risposta: aprirebbero un'altra domanda (li toglie comunque `pezziInHtml`).
              risposta: testoDelSito('Risposta', { options: { ...TESTO_DEL_SITO, heading: false } }),
            },
            defaultItemProps: { domanda: '', risposta: '' },
            getItemSummary: (q, i) => `${(i ?? 0) + 1} · ${q.domanda || 'Nuova domanda'}`,
          },
        },
        defaultProps: { titolo: '', domande: [{ domanda: '', risposta: '' }] },
        render: ({ id }) => <DomandeInPagina id={id} />,
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
      istruttore: {
        label: 'Istruttore',
        fields: {
          src: foto.src,
          alt: { type: 'text', label: 'Cosa si vede (vuoto = «Ritratto di Nome Cognome»)' },
          nome: { type: 'text', label: 'Nome' },
          cognome: { type: 'text', label: 'Cognome' },
          corsi: { type: 'text', label: 'Corsi (separati da una virgola)' },
          pagina: { type: 'custom', render: ({ value, onChange }) => <CampoPaginaIstruttore value={value} onChange={onChange} /> },
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

export default function EditorPuck({ d, pagina, pagine, verso, onChiudi, ricarica }: { d: DatiSegreteria; pagina: PaginaSito; pagine: PaginaSito[]; verso: Array<{ slug: string; titolo: string }>; onChiudi: () => void; ricarica: () => Promise<void> }) {
  // Le pagine scritte col testo solo si aprono già a parti; sul database restano com'erano finché non si salva.
  // I pezzi salvati hanno il testo come `string`, uno dei casi di `Testo`.
  const [iniziali] = useState<Data<Props, Radice>>(() => ({
    root: { props: { titolo: pagina.titolo, descrizione: pagina.descrizione } },
    content: pezziDaAprire(pagina).content,
  }))
  // Una config sola per la pagina aperta: rifatta a ogni tasto, Puck rimonterebbe i campi.
  const config = useMemo(() => configura(d, pagina.slug, pagina.diLegge, verso), [d, pagina.slug, pagina.diLegge, verso])
  const [ora, setOra] = useState<BozzaPezzi>(() => bozzaDa(iniziali))
  const { avviso, avvisa, fai, lavora } = useAvviso()
  /** La pagina da mostrare com'è sul sito (null: si scrive). */
  const [sulSito, setSulSito] = useState<BozzaPezzi | null>(null)
  const sporca = daSalvare(pagina, ora)
  const no = cosaNonVaSalvare(ora)
  const noPubblica = cosaNonVaPubblicare(ora)
  // Letto una volta all'apertura: Puck usa `ui` solo per partire.
  const [stretto] = useState(() => window.innerWidth < 1024)
  useBozza(sporca, pagina.titolo)

  const chiudi = async () => {
    if (sporca && !(await chiedi('Ci sono modifiche non salvate. Se torni alle pagine si perdono.', 'Torna alle pagine', { no: 'Resta qui', restare: true }))) return
    onChiudi()
  }
  // Una pagina scritta col testo solo, salvata qui, resta a parti per sempre: la prima volta si chiede.
  const aParti = (si: string, sulSito: string) => !salvaAParti(pagina) || chiedi(`Salvare «${pagina.titolo}» a parti? ${sulSito} Da qui in poi la pagina si scrive a parti.`, si, { no: 'Lascia stare' })
  // Gli spazi si tolgono qui, come fanno il database e la modalità prova: la bozza salvata torna uguale a quella scritta.
  const salvata = () => d.salvaBozzaPezziSito(pagina.id, pagina.versione, { ...ora, titolo: ora.titolo.trim(), descrizione: ora.descrizione.trim() })
  // Dopo il salvataggio `ricarica` porta la pagina nuova (e la sua versione): `sporca` torna falso da sé.
  const salva = async () => {
    if (!(await aParti('Salva a parti', 'Sul sito non cambia niente finché non pubblichi.'))) return
    await fai(salvata, 'Bozza salvata. Il sito non è cambiato: serve Pubblica', ricarica)
  }
  const pubblica = async () => {
    if (!(await chiedi(`Pubblicare «${ora.titolo.trim() || pagina.titolo}»? Il sito mostrerà la pagina nuova al prossimo aggiornamento.`, 'Pubblica'))) return
    // Un segnaposto pubblicato è una frase sbagliata davanti a tutti (e, nella dichiarazione, una conformità non verificata): si chiede, non si blocca.
    const segnaposto = segnapostoRimasti(ora.pezzi)
    if (segnaposto > 0 && !(await chiedi(`Nel testo ${segnaposto === 1 ? 'c’è ancora 1 [DA COMPILARE]' : `ci sono ancora ${segnaposto} [DA COMPILARE]`}. Pubblicare lo stesso?`, 'Pubblica lo stesso', { no: 'Torna a scrivere', restare: true }))) return
    if (sporca && !(await aParti('Salva a parti e pubblica', 'Il sito mostrerà il testo com’è adesso.'))) return
    await fai(
      async () => {
        const versione = sporca ? await salvata() : pagina.versione
        try {
          await d.pubblicaPaginaSito(pagina.id, versione)
        } catch (e) {
          // La bozza è già salvata, la versione è salita: si rilegge, o il secondo tentativo litiga con noi.
          await ricarica()
          throw e
        }
      },
      'Pubblicata',
      ricarica,
    )
  }

  // Il «Publish» di Puck (`children`) non si mostra: Pubblica è nostro, salva prima la bozza e fa i controlli del database.
  const tasti = () => (
    <>
      <Button variant="secondary" onClick={() => void chiudi()}>‹ Tutte le pagine</Button>
      <Button variant="secondary" onClick={() => setSulSito(ora)}>Com’è sul sito</Button>
      <Button variant="secondary" disabled={lavora || !sporca || !!no} onClick={() => void salva()}>Salva bozza</Button>
      <Button variant="primary" disabled={lavora || !!noPubblica} onClick={() => void pubblica()}>Pubblica</Button>
    </>
  )
  // Accanto al titolo, in piccolo: se c'è da salvare (per primo: è quel che non va), lo stato e i corsi. L'indirizzo è nel pannello della pagina.
  const corsi = pagina.corsiCollegati?.length ?? 0
  const sotto = [sporca ? 'da salvare' : '', PAROLE_STATO[statoPagina(pagina)], corsi ? `collegata a ${corsi} ${corsi === 1 ? 'corso' : 'corsi'}` : ''].filter(Boolean).join(' · ')

  return (
    <PaginaAperta.Provider value={{ d, pagina, pagine, lavora, fai, avvisa, ricarica, onChiudi }}>
      <div className="sito-puck" data-guaio={!!noPubblica || undefined}>
        <Puck
          config={config}
          data={iniziali}
          dictionary={PAROLE}
          viewports={SCHERMI}
          headerTitle={pagina.titolo}
          headerPath={sotto}
          overrides={{ headerActions: tasti }}
          onChange={(data) => setOra(bozzaDa(data))}
          // Si apre sul tablet: sul computer (1280) la pagina viene troppo piccola per leggerla; la misura vera è in «Com'è sul sito».
          // Su uno schermo stretto si apre senza il pannello delle parti, e sul telefono come sul telefono: se no la pagina è un francobollo.
          ui={{ ...(stretto ? { leftSideBarVisible: false } : {}), viewports: { current: { width: window.innerWidth < 768 ? 360 : 768, height: 'auto' }, controlsVisible: true, options: SCHERMI } }}
        />
        {/* Perché Pubblica (e Salva bozza) è spento: in fondo, a parole. */}
        {noPubblica && <p role="alert" className="sito-puck-guaio">{noPubblica}</p>}
        {sulSito && (
          <div className="sito-puck sito-puck-sul-sito">
            <div style={{ display: 'flex', gap: 8, padding: 8 }}>
              <Button variant="secondary" onClick={() => setSulSito(null)}>‹ Torna a scrivere</Button>
            </div>
            <div style={{ flex: 1, display: 'flex' }}>
              <AnteprimaPagina d={d} slug={pagina.slug} titolo={sulSito.titolo} descrizione={sulSito.descrizione} testo={pezziInHtml(sulSito.pezzi)} />
            </div>
          </div>
        )}
        {avviso}
      </div>
    </PaginaAperta.Provider>
  )
}
