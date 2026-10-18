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

/** Senza testo e senza foto. */
export const vuoto = (html: string) => !/<img\b/i.test(html) && html.replace(/<[^>]*>/g, '').trim() === ''

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

/**
 * Il testo piatto di una pagina vecchia, spezzato nei pezzi dell'editor: foto iniziale, colonne, testo.
 * Non si fida di sé: se i pezzi non rifanno esattamente il testo (`pezziInHtml`), la pagina resta un solo
 * pezzo di testo, così «Porta ai pezzi» non cambia mai quello che c'è scritto.
 */
export function htmlInPezzi(html: string): PezziPagina {
  const t = pulisciTesto(html)
  if (t.trim() === '') return pezziVuoti()
  const pezzi: Pezzo[] = []
  const aggiungi = (nuovo: (id: string) => Pezzo) => pezzi.push(nuovo(`p${pezzi.length + 1}`))
  const testo = (h: string) => {
    if (h !== '') aggiungi((id) => ({ type: 'testo', props: { id, html: h } }))
  }
  let da = 0
  for (const b of divDi(t, /\bcolonne\b/)) {
    testo(t.slice(da, b.da))
    const colonne = divDi(b.dentro, /\bcolonna\b/).map((c) => ({ html: c.dentro }))
    // Colonne dentro una colonna non si riaprono nell'editor: si lasciano come testo.
    if (colonne.some((c) => /<div\b/i.test(c.html))) return unico(t)
    aggiungi((id) => ({ type: 'colonne', props: { id, colonne } }))
    da = b.a
  }
  testo(t.slice(da))
  const primo = pezzi[0]
  const foto = primo?.type === 'testo' ? /^<img\b[^>]*>/i.exec(primo.props.html) : null
  if (primo?.type === 'testo' && foto) {
    const src = attributo(foto[0], 'src')
    const alt = attributo(foto[0], 'alt')
    if (src && alt !== null) {
      const resto = primo.props.html.slice(foto[0].length)
      pezzi.splice(0, 1, { type: 'fotoInCima', props: { id: 'p0', src, alt } }, ...(resto === '' ? [] : [{ type: 'testo' as const, props: { id: primo.props.id, html: resto } }]))
    }
  }
  const candidato: PezziPagina = { content: pezzi }
  return pezziValidi(candidato) && pezziInHtml(candidato) === t ? candidato : unico(t)
}

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
