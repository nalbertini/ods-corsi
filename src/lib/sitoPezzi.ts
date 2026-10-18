import { testoTroppoLungo } from './sitoPagine'
import { pulisciTesto } from './sitoTesto'

/**
 * Una pagina del sito composta a pezzi: l'ordine e il contenuto che la
 * segreteria sceglie nell'editor (Puck). Il sito resta statico e fatto di testo:
 * i pezzi si salvano così come sono (`bozza_pezzi`, per riaprirli uguali) e
 * si traducono nel testo piatto di sempre (`pezziInHtml`), da cui il generatore
 * fa le tessere. Le regole stanno qui, non nella schermata, per provarle senza browser
 * (`scripts/prova-sito-pezzi.mjs`).
 */

export type Pezzo =
  | { type: 'fotoInCima'; props: { id: string; src: string; alt: string } }
  | { type: 'testo'; props: { id: string; html: string } }
  | { type: 'foto'; props: { id: string; src: string; alt: string } }
  | { type: 'colonne'; props: { id: string; colonne: Array<{ html: string }> } }

export interface PezziPagina {
  content: Pezzo[]
}

/** Quanti pezzi al massimo: oltre, la pagina non si legge più e il testo sfiora il limite del database. */
export const MASSIMO_PEZZI = 100
/** Il limite del database sul JSON dei pezzi (`supabase/62-sito-pezzi.sql`): oltre non si salva. */
export const MASSIMO_CARATTERI = 400000

/** Il nome di una parte nell'ELENCO, con le parole della segreteria. */
export const nomeParte = (p: Pezzo): string =>
  p.type === 'fotoInCima' ? 'Foto in cima' : p.type === 'testo' ? 'Testo' : p.type === 'foto' ? 'Foto' : p.props.colonne.length === 2 ? 'Due colonne' : 'Tre colonne'

/** Cosa dice il pannello delle impostazioni finché nessuna parte è scelta. */
export const FRASE_NESSUNA_PARTE = 'Tocca una parte della pagina per cambiarne le impostazioni.'

export const pezziVuoti = (): PezziPagina => ({ content: [] })

const stringa = (x: unknown): x is string => typeof x === 'string'
const oggetto = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x)

function pezzoValido(x: unknown): x is Pezzo {
  if (!oggetto(x) || !oggetto(x.props) || !stringa(x.props.id) || x.props.id === '') return false
  const p = x.props
  switch (x.type) {
    case 'testo':
      return stringa(p.html)
    case 'foto':
    case 'fotoInCima':
      return stringa(p.src) && p.src !== '' && stringa(p.alt)
    case 'colonne':
      return Array.isArray(p.colonne) && p.colonne.length >= 2 && p.colonne.length <= 3 && p.colonne.every((c) => oggetto(c) && stringa(c.html))
    default:
      return false
  }
}

/** Vero solo per pezzi fatti come li sa leggere il sito; tutto il resto (anche JSON arrivato da fuori) è falso. */
export function pezziValidi(x: unknown): x is PezziPagina {
  if (!oggetto(x) || !Array.isArray(x.content) || x.content.length > MASSIMO_PEZZI) return false
  if (!x.content.every(pezzoValido)) return false
  if (JSON.stringify(x).length > MASSIMO_CARATTERI) return false
  const pezzi = x.content as Pezzo[]
  if (new Set(pezzi.map((p) => p.props.id)).size !== pezzi.length) return false
  const incima = pezzi.flatMap((p, i) => (p.type === 'fotoInCima' ? [i] : []))
  return incima.length === 0 || (incima.length === 1 && incima[0] === 0)
}

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/'/g, '&#39;')

/** Senza testo e senza foto. Accetta anche `undefined`: Puck può dare una colonna appena aggiunta senza `html`. */
export const vuoto = (html: string | undefined) => !html || (!/<img\b/i.test(html) && html.replace(/<[^>]*>/g, '').trim() === '')

/** Cosa nasce quando la segreteria aggiunge una colonna: vuota, ma con il suo `html` (il campo array di Puck non ne mette uno da solo). */
export const colonnaNuova = (): { html: string } => ({ html: '' })

/**
 * Il pezzo con il testo scritto nella pagina: il testo di un TESTO, o quello della colonna `colonna` di COLONNE.
 * Non cambia mai il pezzo ricevuto; per una foto o una colonna che non c'è lo restituisce com'è, così nessuna
 * scrittura finisce nel posto sbagliato.
 */
export function scriviTesto(p: Pezzo, html: string, colonna = 0): Pezzo {
  if (p.type === 'testo') return { ...p, props: { ...p.props, html } }
  if (p.type === 'colonne' && colonna >= 0 && colonna < p.props.colonne.length) {
    return { ...p, props: { ...p.props, colonne: p.props.colonne.map((c, i) => (i === colonna ? { html } : c)) } }
  }
  return p
}

/** La pagina con il testo scritto nel pezzo `id` (e nella colonna `colonna`): quello che si salva senza aspettare Puck. Un pezzo che non c'è lascia la pagina com'è. */
export function conTestoScritto(pagina: PezziPagina, id: string, html: string, colonna = 0): PezziPagina {
  const i = pagina.content.findIndex((p) => p.props.id === id)
  if (i < 0) return pagina
  return { content: pagina.content.map((p, k) => (k === i ? scriviTesto(p, html, colonna) : p)) }
}

/** Cosa fa un tasto premuto dentro il testo: annulla o rifai di Puck (Cmd o Ctrl con Z, Maiusc+Z, Y), altrimenti `null`: il tasto è del testo. */
export function versoStoria(tasto: string, conMeta: boolean, conMaiusc: boolean, conAlt: boolean): 'indietro' | 'avanti' | null {
  if (!conMeta || conAlt) return null
  const k = tasto.toLowerCase()
  if (k === 'y') return 'avanti'
  if (k === 'z') return conMaiusc ? 'avanti' : 'indietro'
  return null
}

/** La parte scelta dopo ANNULLA o RIFAI: la stessa di prima se c'è ancora, se no nessuna (Puck riporta la scelta di allora). */
export const selezioneDopoStoria = <S extends { index: number }>(scelto: S | null, quanti: number): S | null => (scelto && scelto.index < quanti ? scelto : null)

/** Dopo quanto Puck ha registrato nella storia l'ultima scrittura (lui aspetta 250ms dall'ultima: qui un po' di più). */
export const FINESTRA_STORIA_MS = 300

/** Quanto aspettare prima di annullare o rifare, perché l'ultima scrittura (all'istante `ultima`, 0 se mai) sia già nella storia di Puck. */
export const attesaStoria = (ultima: number, ora: number): number => (ultima === 0 ? 0 : Math.max(0, FINESTRA_STORIA_MS - (ora - ultima)))

function inHtml(p: Pezzo): string {
  switch (p.type) {
    case 'testo':
      return p.props.html
    case 'foto':
    case 'fotoInCima':
      return `<img src="${esc(p.props.src)}" alt="${esc(p.props.alt)}">`
    case 'colonne': {
      // Una colonna lasciata vuota non deve restare sul sito come un buco: l'editor di testo vuoto dà «<p></p>».
      const piene = p.props.colonne.filter((c) => !vuoto(c.html))
      if (piene.length < 2) return piene[0]?.html ?? ''
      return `<div class="colonne c-${piene.length}">${piene.map((c) => `<div class="colonna">${c.html}</div>`).join('')}</div>`
    }
  }
}

/** Il testo piatto della pagina, già ripulito: quello che si salva come bozza e che il sito pubblica. */
export const pezziInHtml = (p: PezziPagina): string => pulisciTesto(p.content.map(inHtml).join(''))

/** Perché i pezzi non vanno, a parole e una causa per volta; `null` se vanno. Chi legge sa cosa fare. */
export function cosaNonVaPezzi(x: unknown): string | null {
  if (pezziValidi(x)) return null
  if (oggetto(x) && Array.isArray(x.content)) {
    const parti = x.content.filter(oggetto)
    if (x.content.length > MASSIMO_PEZZI) return `La pagina ha troppe parti: al massimo ${MASSIMO_PEZZI}`
    const incima = parti.filter((p) => p.type === 'fotoInCima')
    if (incima.length > 1 || (incima.length === 1 && x.content[0] !== incima[0])) return 'La foto in cima è una sola e sta in alto'
    const foto = parti.filter((p) => (p.type === 'foto' || p.type === 'fotoInCima') && oggetto(p.props))
    if (foto.some((p) => !stringa((p.props as Record<string, unknown>).src) || (p.props as Record<string, unknown>).src === '')) return 'Ogni foto ha bisogno della sua immagine: scegline una o togli la foto'
    const colonne = parti.filter((p) => p.type === 'colonne' && oggetto(p.props) && Array.isArray((p.props as Record<string, unknown>).colonne))
    if (colonne.some((p) => { const n = ((p.props as Record<string, unknown>).colonne as unknown[]).length; return n < 2 || n > 3 })) return 'Le colonne sono due o tre'
    if (JSON.stringify(x).length > MASSIMO_CARATTERI) return 'La pagina è troppo lunga: togli qualcosa'
  }
  return 'La pagina non è fatta come il sito la vuole: ricaricala e riprova'
}

/** I pezzi di ora sono diversi da quelli salvati (anche solo nell'ordine). */
// Il database (jsonb) rimette le chiavi in un altro ordine: i pezzi appena salvati, riletti, non sono una modifica.
const chiaviInOrdine = (_: string, v: unknown) => (oggetto(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : 1))) : v)
export const pezziCambiati = (locali: PezziPagina, salvati: PezziPagina | null | undefined): boolean => JSON.stringify(locali, chiaviInOrdine) !== JSON.stringify(salvati, chiaviInOrdine)

/**
 * Il database sa i pezzi (c'è `62-sito-pezzi.sql`) se almeno una pagina arriva col campo, anche vuoto (`null`):
 * senza il file la colonna non c'è e nessuna pagina lo porta. Con nessuna pagina non si sa, e vale «no».
 */
export const databaseConPezzi = (pagine: ReadonlyArray<{ pezzi?: PezziPagina | null }>): boolean => pagine.some((p) => p.pezzi !== undefined)

const disesc = (t: string) => t.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
const attributo = (tag: string, nome: string) => {
  const m = new RegExp(`\\b${nome}\\s*=\\s*"([^"]*)"`, 'i').exec(tag)
  return m ? disesc(m[1]) : null
}

/** I `div` di primo livello di `html` che hanno una delle classi, con il loro contenuto: serve a spezzare il testo senza DOM. */
function divDi(html: string, classe: RegExp): Array<{ da: number; a: number; dentro: string }> {
  const trovati: Array<{ da: number; a: number; dentro: string }> = []
  let profondita = 0
  let aperto: { da: number; apertura: number } | null = null
  for (const m of html.matchAll(/<(\/?)div\b[^>]*>/gi)) {
    const fine = m.index + m[0].length
    if (m[1]) {
      if (profondita > 0 && --profondita === 0 && aperto) {
        trovati.push({ da: aperto.da, a: fine, dentro: html.slice(aperto.apertura, m.index) })
        aperto = null
      }
    } else if (profondita++ === 0 && classe.test(m[0])) aperto = { da: m.index, apertura: fine }
  }
  return trovati
}

/** Tutto il testo in un pezzo solo: quando dividerlo rischierebbe di cambiare quello che c'è scritto. */
const unico = (t: string): PezziPagina => ({ content: [{ type: 'testo', props: { id: 'p1', html: t } }] })

const TAG = /<(\/?)([a-z][a-z0-9]*)\b[^>]*?(\/?)>/gi
const SENZA_CHIUSURA = new Set(['img', 'br', 'hr'])

type Segmento = { html: string } | { foto: { src: string; alt: string } }

/**
 * Taglia un testo piatto solo a livello più alto, mai dentro un elenco o un paragrafo: un titolo `<h2>` apre un pezzo
 * di testo, un'immagine rifatta uguale dall'editor è una foto. Il resto resta com'è, così il testo non cambia.
 */
function spezzaTesto(t: string): Segmento[] {
  const segmenti: Segmento[] = []
  const testo = (h: string) => {
    if (h !== '') segmenti.push({ html: h })
  }
  let profondita = 0
  let inizio = 0
  for (const m of t.matchAll(TAG)) {
    const nome = m[2].toLowerCase()
    if (m[1]) {
      profondita = Math.max(0, profondita - 1)
      continue
    }
    // Un titolo vuoto non apre una parte: resta nel testo che c'è.
    if (profondita === 0 && nome === 'h2' && !/^<h2\b[^>]*>\s*<\/h2>/i.test(t.slice(m.index))) {
      testo(t.slice(inizio, m.index))
      inizio = m.index
    } else if (profondita === 0 && nome === 'img') {
      const src = attributo(m[0], 'src')
      const alt = attributo(m[0], 'alt')
      // Un'immagine che l'editor non riscrive uguale (altri attributi, niente `alt`) resta nel testo.
      if (src && alt !== null && pulisciTesto(inHtml({ type: 'foto', props: { id: 'x', src, alt } })) === m[0]) {
        testo(t.slice(inizio, m.index))
        segmenti.push({ foto: { src, alt } })
        inizio = m.index + m[0].length
      }
    }
    if (!SENZA_CHIUSURA.has(nome) && !m[3]) profondita++
  }
  testo(t.slice(inizio))
  return segmenti
}

/**
 * Il testo piatto di una pagina vecchia, spezzato nei pezzi dell'editor: foto iniziale, colonne, foto tra i
 * paragrafi, testo che comincia a ogni titolo. Non si fida di sé: se i pezzi non rifanno esattamente il testo
 * (`pezziInHtml`), la pagina resta un solo pezzo di testo, così «Porta ai pezzi» non cambia mai quello che c'è scritto.
 */
export function htmlInPezzi(html: string): PezziPagina {
  const t = pulisciTesto(html)
  if (t.trim() === '') return pezziVuoti()
  const pezzi: Pezzo[] = []
  const id = () => `p${pezzi.length + 1}`
  const testo = (h: string) => {
    // Un `<p></p>` non è una parte: si unisce al testo prima, o a quello dopo; solo se non ne ha (dopo una foto, in fondo) resta da solo.
    let vuotoInAttesa = ''
    const scarica = () => {
      if (vuotoInAttesa !== '') pezzi.push({ type: 'testo', props: { id: id(), html: vuotoInAttesa } })
      vuotoInAttesa = ''
    }
    for (const s of spezzaTesto(h)) {
      const prima = pezzi[pezzi.length - 1]
      if ('foto' in s) {
        scarica()
        pezzi.push({ type: 'foto', props: { id: id(), ...s.foto } })
      } else if (vuoto(s.html) && prima?.type === 'testo') prima.props.html += s.html
      else if (vuoto(s.html)) vuotoInAttesa += s.html
      else {
        pezzi.push({ type: 'testo', props: { id: id(), html: vuotoInAttesa + s.html } })
        vuotoInAttesa = ''
      }
    }
    scarica()
  }
  let da = 0
  for (const b of divDi(t, /\bcolonne\b/)) {
    testo(t.slice(da, b.da))
    const colonne = divDi(b.dentro, /\bcolonna\b/).map((c) => ({ html: c.dentro }))
    // Colonne dentro una colonna non si riaprono nell'editor: si lasciano come testo.
    if (colonne.some((c) => /<div\b/i.test(c.html))) return unico(t)
    pezzi.push({ type: 'colonne', props: { id: id(), colonne } })
    da = b.a
  }
  testo(t.slice(da))
  const primo = pezzi[0]
  if (primo?.type === 'foto') pezzi[0] = { type: 'fotoInCima', props: { ...primo.props, id: 'p0' } }
  const candidato: PezziPagina = { content: pezzi }
  // Con troppe parti `pezziValidi` è falso: non si accorpa, `cosaNonVaPortare` avvisa e la segreteria toglie qualcosa.
  return (pezziValidi(candidato) || pezzi.length > MASSIMO_PEZZI) && pezziInHtml(candidato) === t ? candidato : unico(t)
}

/**
 * Il tasto «Dividi in parti»: ogni TESTO di una pagina già a pezzi si divide come `htmlInPezzi` divide una pagina vecchia
 * (un titolo apre una parte, una foto tra i paragrafi è una FOTO). Foto, foto in cima e colonne restano dove sono; un testo che
 * non si divide, o che conterrebbe colonne, resta com'è. Se il testo ricomposto cambiasse, la pagina resta quella di prima.
 * Oltre `MASSIMO_PEZZI` il risultato resta com'è: lo mostra l'avviso di `cosaNonVaPezzi`, e la schermata non lo applica.
 */
export function dividiInParti(p: PezziPagina): PezziPagina {
  const usati = new Set(p.content.map((x) => x.props.id))
  let n = Math.max(0, ...p.content.map((x) => Number(/^p(\d+)$/.exec(x.props.id)?.[1] ?? 0)))
  const idNuovo = () => {
    do n++
    while (usati.has(`p${n}`))
    usati.add(`p${n}`)
    return `p${n}`
  }
  const content = p.content.flatMap((x): Pezzo[] => {
    if (x.type !== 'testo') return [x]
    const parti = htmlInPezzi(x.props.html).content
    if (parti.length < 2 || parti.some((q) => q.type === 'colonne')) return [x]
    return parti.flatMap((q, i): Pezzo[] => {
      if (q.type === 'colonne') return [] // già escluso sopra: serve solo a restringere il tipo
      // La prima parte tiene l'id del testo; la foto in cima di una divisione è una foto qualunque: in cima ce n'è una sola.
      const id = i === 0 && q.type === 'testo' ? x.props.id : idNuovo()
      return [q.type === 'testo' ? { type: 'testo', props: { id, html: q.props.html } } : { type: 'foto', props: { id, src: q.props.src, alt: q.props.alt } }]
    })
  })
  const nuova: PezziPagina = { content }
  return (content.length > MASSIMO_PEZZI || pezziValidi(nuova)) && pezziInHtml(nuova) === pezziInHtml(p) ? nuova : p
}

/** Il tasto «Dividi in parti» c'è solo se dividere dà più parti di adesso. */
export const divisibileInParti = (p: PezziPagina): boolean => dividiInParti(p).content.length > p.content.length

/** Cosa dice la pagina subito dopo la divisione: quante parti ci sono e come tenerle o scartarle. */
export const frasePartiNuove = (n: number): string => `Ora ci sono ${n} parti, nell'ELENCO. Il testo è lo stesso. Per tenerle premi SALVA BOZZA; per lasciare tutto com'era, TORNA ALLE PAGINE.`

/** Il tasto «Porta ai pezzi»: solo per una pagina col vecchio editor (`null`; `undefined` = database senza il 62) e che non è di legge. */
export const portabileAiPezzi = (p: { pezzi?: PezziPagina | null; diLegge: boolean }): boolean => p.pezzi === null && !p.diLegge

/**
 * Perché una pagina vecchia non si può portare ai pezzi, a parole; `null` se si può. Da chiedere prima della conferma:
 * il testo ripulito e il suo JSON devono stare nei limiti, o il salvataggio fallirebbe con una frase che non dice cosa fare.
 */
export function cosaNonVaPortare(bozza: string): string | null {
  const pezzi = htmlInPezzi(bozza)
  return cosaNonVaPezzi(pezzi) ?? testoTroppoLungo(pezziInHtml(pezzi))
}
