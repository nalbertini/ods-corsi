// Mette in un canvas solo la libreria e tutte le sezioni di docs/design-canvas, una pagina per sezione.
// Uso: node docs/design-canvas/unico.mjs <cartella-di-uscita>
// Scrive <uscita>/project/ (i .dc.html più canvas.json nel formato dell'Artifact «Design») e
// <uscita>/files.json (l'elenco dei file da pubblicare). Non pubblica niente.
// Una sezione nuova si aggiunge a SEZIONI. I file propri di una sezione prendono il prefisso `<id>-` per non
// scontrarsi (ogni sezione ha il suo Main); quelli della libreria restano col loro nome.
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, copyFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const base = import.meta.dirname
const uscita = resolve(process.argv[2] ?? '')
if (!process.argv[2]) {
  console.error('Uso: node docs/design-canvas/unico.mjs <cartella-di-uscita>')
  process.exit(1)
}

const LIBRERIA = 'ods-design-system'
const FONDAMENTA = new Set(['Main', 'Pagina', 'PaginaTelefono'])
const SEZIONI = [
  { id: 'istruttore', nome: 'Sezione istruttore', cartella: 'istruttore' },
  { id: 'tablet-sala', nome: 'Tablet di sala', cartella: 'tablet-sala' },
  { id: 'iscrizione', nome: 'Registrazione utente', cartella: 'iscrizione' },
  { id: 'importa-fogli', nome: 'Importa da Excel', cartella: 'import-fogli' },
  { id: 'timer-desktop', nome: 'Timer desktop · proposte', cartella: 'timer-desktop' },
  { id: 'certificato-piccoli', nome: 'Certificato sotto i 6 anni', cartella: 'certificato-piccoli' },
]

const stem = (f) => f.replace(/\.dc\.html$/, '')
const leggi = (p) => readFileSync(p, 'utf8')
const dcHtml = (cartella) => readdirSync(cartella).filter((f) => f.endsWith('.dc.html'))
// La misura di un artboard: `$preview` se c'è; se no, larghezza e altezza (anche minima) del primo elemento
// dopo <helmet>, che nelle schermate è fisso (la regola del canvas). Senza niente, 400x200.
const anteprima = (testo) => {
  const m = testo.match(/"\$preview":\{"width":(\d+),"height":(\d+)/)
  if (m) return { w: Number(m[1]), h: Number(m[2]) }
  const da = testo.includes('</helmet>') ? testo.indexOf('</helmet>') : testo.indexOf('<x-dc>')
  const stile = testo.slice(Math.max(da, 0)).match(/style="([^"]*)"/)?.[1] ?? ''
  const w = stile.match(/(?<![-\w])width:\s*(\d+)px/)
  const h = stile.match(/(?<![-\w])(?:min-)?height:\s*(\d+)px/)
  return w && h ? { w: Number(w[1]), h: Number(h[1]) } : { w: 400, h: 200 }
}
// Senza canvas.json di una sezione: una griglia, a righe larghe al massimo 2800.
function griglia(cartella, file) {
  let x = 0, y = 0, riga = 0
  return file.map((f) => {
    const { w, h } = anteprima(leggi(join(cartella, f)))
    if (x > 0 && x + w > 2800) { x = 0; y += riga + 120; riga = 0 }
    const b = { file: f, x, y, w, h }
    x += w + 120
    riga = Math.max(riga, h)
    return b
  })
}

mkdirSync(join(uscita, 'project'), { recursive: true })
const boards = {}
const order = []
const pages = []
const notes = {}
const nomiLibreria = new Set(dcHtml(join(base, LIBRERIA)).map(stem))

function copia(da, nome, riscrivi) {
  let t = leggi(da)
  if (riscrivi) t = t.replace(/(<dc-import name=")([A-Za-z0-9]+)(")/g, (m, a, n, c) => (riscrivi.has(n) ? `${a}${riscrivi.get(n)}${c}` : m))
  writeFileSync(join(uscita, 'project', nome), t)
}

// Libreria e fondamenta: la cartella della libreria, le prime tre in una pagina, il resto in un'altra.
{
  const cartella = join(base, LIBRERIA)
  const c = JSON.parse(leggi(join(cartella, 'canvas.json')))
  const posti = new Map(c.artboards.map((a) => [a.file, a]))
  const mancanti = dcHtml(cartella).filter((f) => !posti.has(f))
  const extra = griglia(cartella, mancanti)
  const yBase = Math.max(0, ...c.artboards.filter((a) => a.page === 'page-2').map((a) => a.y + a.h)) + 160
  for (const e of extra) posti.set(e.file, { ...e, y: e.y + yBase, page: 'page-2' })
  pages.push({ id: 'design-system', name: 'Design System' }, { id: 'libreria', name: 'Libreria' })
  for (const [file, a] of posti) {
    const fond = FONDAMENTA.has(stem(file))
    boards[file] = { x: a.x, y: a.y, w: a.w, h: a.h, page: fond ? 'design-system' : 'libreria', title: a.title ?? stem(file) }
    order.push(file)
    copia(join(cartella, file), file)
  }
  for (const n of c.annotations ?? []) {
    notes[`libreria-${n.id}`] = { x: n.x, y: n.y, w: n.w, text: n.text, page: n.page === 'page-1' ? 'design-system' : 'libreria' }
  }
}
// Main della libreria in testa: è l'entrata del canvas.
order.sort((a, b) => (a === 'Main.dc.html' ? -1 : b === 'Main.dc.html' ? 1 : 0))

for (const s of SEZIONI) {
  const cartella = join(base, s.cartella)
  if (!existsSync(cartella)) { console.error(`${s.cartella}: manca, salto`); continue }
  const propri = dcHtml(cartella)
  if (!propri.length) { console.error(`${s.cartella}: nessun .dc.html, salto`); continue }
  const nuovo = new Map(propri.map((f) => [stem(f), `${s.id}-${stem(f)}`]))
  let posti
  const cj = join(cartella, 'canvas.json')
  const c = existsSync(cj) ? JSON.parse(leggi(cj)) : null
  if (c) {
    posti = c.artboards.filter((a) => propri.includes(a.file) && !(a.page === 'page-2' && nomiLibreria.has(stem(a.file))))
    for (const a of posti) Object.assign(a, anteprima(leggi(join(cartella, a.file))))
    const senzaPosto = propri.filter((f) => !posti.some((a) => a.file === f))
    const yMax = Math.max(0, ...posti.map((a) => a.y + a.h)) + 160
    posti.push(...griglia(cartella, senzaPosto).map((e) => ({ ...e, y: e.y + yMax })))
  } else {
    posti = griglia(cartella, propri)
  }
  pages.push({ id: s.id, name: s.nome })
  for (const a of posti) {
    const nome = `${s.id}-${a.file}`
    boards[nome] = { x: a.x, y: a.y, w: a.w, h: a.h, page: s.id, title: a.title ?? stem(a.file) }
    order.push(nome)
    copia(join(cartella, a.file), nome, nuovo)
  }
  for (const n of c?.annotations ?? []) {
    if (n.page && n.page !== 'page-1') continue
    notes[`${s.id}-${n.id}`] = { x: n.x, y: n.y, w: n.w, text: n.text, page: s.id }
  }
}

// Ogni <dc-import> deve avere il suo file nel canvas.
const presenti = new Set(order.map(stem))
let errori = 0
for (const f of order) {
  for (const m of leggi(join(uscita, 'project', f)).matchAll(/<dc-import name="([A-Za-z0-9-]+)"/g)) {
    if (!presenti.has(m[1])) { console.error(`${f}: importa ${m[1]}, che non c'è`); errori++ }
  }
}

const indice = {
  v: 3,
  createdOnFiles: { v: 1, at: new Date().toISOString().replace(/\.\d+Z$/, 'Z') },
  title: 'ODS Corsi · Design',
  launch: { view: 'canvas', page: 'design-system' },
  pages,
  boards,
  order,
  notes,
  designSystems: [],
}
writeFileSync(join(uscita, 'project', 'canvas.json'), JSON.stringify(indice, null, 1))
writeFileSync(join(uscita, 'files.json'), JSON.stringify(['project/canvas.json', ...order.map((f) => `project/${f}`)]))
console.log(`${order.length} artboard in ${pages.length} pagine → ${uscita}`)
process.exit(errori ? 1 : 0)
