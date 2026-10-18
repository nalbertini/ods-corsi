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
  { id: 'iscrizione', nome: 'Iscrizione · modulo attuale', cartella: 'iscrizione' },
  { id: 'iscrizione-nuovo', nome: 'Iscrizione · nuovo flusso a passi', cartella: 'iscrizione-nuovo' },
  { id: 'iscrizione-rifinitura', nome: 'Iscrizione · passi, rifinitura', cartella: 'iscrizione-rifinitura' },
  { id: 'navigazione-passi', nome: 'Iscrizione · testa dei passi (ipotesi)', cartella: 'navigazione-passi' },
  { id: 'iscrizione-famiglia', nome: 'Iscrizione · famiglia', cartella: 'iscrizione-famiglia' },
  { id: 'famiglia-passo', nome: 'Iscrizione · famiglia, un passo a sé', cartella: 'famiglia-passo' },
  { id: 'famiglia-ultimo', nome: 'Iscrizione · famiglia all\'ultimo passo', cartella: 'famiglia-ultimo-passo' },
  { id: 'anche-tu', nome: 'Iscrizione · anche tu, stessa ora', cartella: 'anche-tu-stessa-ora' },
  { id: 'orari-evidenziati', nome: 'Iscrizione · orari compatibili', cartella: 'orari-evidenziati' },
  { id: 'corsi-vicini', nome: 'Iscrizione · corsi vicini', cartella: 'corsi-vicini' },
  { id: 'quanto-paghi', nome: 'Iscrizione · quanto paghi', cartella: 'quanto-paghi' },
  { id: 'totale-barra', nome: 'Iscrizione · totale del modulo', cartella: 'totale-barra' },
  { id: 'comune-dal-cap', nome: 'Iscrizione · comune dal CAP', cartella: 'comune-dal-cap' },
  { id: 'firma-schermo-intero', nome: 'Iscrizione · firma a schermo intero', cartella: 'firma-schermo-intero' },
  { id: 'riempi-prova', nome: 'Iscrizione · riempi per prova', cartella: 'riempi-prova' },
  { id: 'esci-dalla-prova', nome: 'Iscrizione · esci dalla prova', cartella: 'esci-dalla-prova' },
  { id: 'iscrizione-sito', nome: 'Iscrizione · modulo nell\'aspetto del sito', cartella: 'iscrizione-sito' },
  { id: 'vestiario', nome: 'Vestiario · ordini', cartella: 'vestiario' },
  { id: 'vestiario-modulo', nome: 'Vestiario · come il modulo', cartella: 'vestiario-modulo' },
  { id: 'sito-pannello', nome: 'Sito · pannello', cartella: 'sito-pannello' },
  { id: 'sito-pubblico', nome: 'Sito · pagine pubbliche', cartella: 'sito-pubblico' },
  { id: 'sito-rebrand', nome: 'Sito · tre rebrand', cartella: 'sito-rebrand' },
  { id: 'segreteria-tatami', nome: 'Segreteria · tema Tatami', cartella: 'segreteria-tatami' },
  { id: 'banco', nome: 'Segreteria · il Banco, ridisegnata', cartella: 'banco' },
  { id: 'cerca-universale', nome: 'Segreteria · ricerca universale', cartella: 'cerca-universale' },
  { id: 'importa-fogli', nome: 'Segreteria · importa da Excel', cartella: 'import-fogli' },
  { id: 'iscritti-del-corso', nome: 'Segreteria · iscritti del corso', cartella: 'iscritti-del-corso' },
  { id: 'iscritti-riepilogo', nome: 'Segreteria · iscritti, riepilogo', cartella: 'iscritti-riepilogo' },
  { id: 'storico-pagamenti', nome: 'Segreteria · storico pagamenti', cartella: 'storico-pagamenti' },
  { id: 'tessere', nome: 'Segreteria · tessere e incrocio', cartella: 'tessere' },
  { id: 'prezzi-mancanti', nome: 'Segreteria · prezzi mancanti', cartella: 'prezzi-mancanti' },
  { id: 'certificati-online', nome: 'Segreteria · certificati online', cartella: 'certificati-online' },
  { id: 'certificato-piccoli', nome: 'Segreteria · certificato sotto i 6 anni', cartella: 'certificato-piccoli' },
  { id: 'email-contatto', nome: 'Segreteria · email di contatto', cartella: 'email-contatto' },
  { id: 'ruolo-amministrazione', nome: 'Segreteria · ruolo amministrazione', cartella: 'ruolo-amministrazione' },
  { id: 'contabilita', nome: 'Segreteria · contabilità', cartella: 'contabilita' },
  { id: 'chiusura-cassa', nome: 'Segreteria · chiusura di cassa', cartella: 'chiusura-cassa' },
  { id: 'istruttore', nome: 'Istruttori · sezione', cartella: 'istruttore' },
  { id: 'istruttore-collega', nome: 'Istruttori · insegna con te', cartella: 'istruttore-collega' },
  { id: 'tablet-sala', nome: 'Tablet di sala', cartella: 'tablet-sala' },
  { id: 'timer-desktop', nome: 'Timer · desktop', cartella: 'timer-desktop' },
  { id: 'timer-istruttori', nome: 'Timer · app istruttori', cartella: 'timer-istruttori' },
  { id: 'timer-musica', nome: 'Timer · musica', cartella: 'timer-musica' },
  { id: 'timer-youtube', nome: 'Timer · YouTube', cartella: 'timer-youtube' },
  { id: 'moduli-pdf', nome: 'Moduli PDF · carta (proposta)', cartella: 'moduli-pdf' },
  { id: 'sito-blocchi', nome: 'Sito · pagine a pezzi · proposta', cartella: 'sito-blocchi' },
]

// Il canvas mostra al massimo 40 pagine: le sezioni vicine stanno sulla stessa pagina, una sotto l'altra, ognuna col suo titolo.
// Una sezione che non è in un gruppo ha una pagina sua.
const MAX_PAGINE = 40
const GRUPPI = {
  'iscrizione-flusso': { nome: 'Iscrizione · il modulo', sezioni: ['iscrizione', 'iscrizione-nuovo', 'iscrizione-rifinitura', 'navigazione-passi', 'iscrizione-sito'] },
  'iscrizione-famiglia': { nome: 'Iscrizione · famiglia', sezioni: ['iscrizione-famiglia', 'famiglia-passo', 'famiglia-ultimo', 'anche-tu'] },
  'iscrizione-dettagli': { nome: 'Iscrizione · dettagli', sezioni: ['orari-evidenziati', 'corsi-vicini', 'quanto-paghi', 'totale-barra', 'comune-dal-cap', 'firma-schermo-intero', 'riempi-prova', 'esci-dalla-prova'] },
  'vestiario': { nome: 'Vestiario', sezioni: ['vestiario', 'vestiario-modulo'] },
  'sito': { nome: 'Sito', sezioni: ['sito-pannello', 'sito-pubblico', 'sito-rebrand'] },
  'segreteria-iscritti': { nome: 'Segreteria · iscritti e prezzi', sezioni: ['iscritti-del-corso', 'iscritti-riepilogo', 'storico-pagamenti', 'tessere', 'prezzi-mancanti'] },
  'segreteria-certificati': { nome: 'Segreteria · certificati', sezioni: ['certificati-online', 'certificato-piccoli'] },
  'segreteria-strumenti': { nome: 'Segreteria · strumenti', sezioni: ['segreteria-tatami', 'banco', 'cerca-universale', 'importa-fogli'] },
  'segreteria-conti': { nome: 'Segreteria · conti e ruoli', sezioni: ['contabilita', 'chiusura-cassa', 'ruolo-amministrazione', 'email-contatto'] },
  'istruttori': { nome: 'Istruttori', sezioni: ['istruttore', 'istruttore-collega'] },
  'timer': { nome: 'Timer', sezioni: ['timer-desktop', 'timer-istruttori', 'timer-musica', 'timer-youtube'] },
}
const gruppoDi = (id) => Object.keys(GRUPPI).find((g) => GRUPPI[g].sezioni.includes(id))

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
const cursori = new Map() // pagina → fondo dell'ultima sezione messa, per i gruppi
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
    // Una sezione con più pagine diventa una pagina sola: ogni pagina ripartirebbe da 0,0 sopra le altre,
    // quindi si mettono una sotto l'altra, nell'ordine di canvas.json.
    let yPagina = 0
    for (const p of c.pages ?? []) {
      const suoi = posti.filter((a) => (a.page ?? 'page-1') === p.id)
      if (!suoi.length) continue
      for (const a of suoi) a.y += yPagina
      yPagina = Math.max(...suoi.map((a) => a.y + a.h)) + 300
    }
    const senzaPosto = propri.filter((f) => !posti.some((a) => a.file === f))
    const yMax = Math.max(0, ...posti.map((a) => a.y + a.h)) + 160
    posti.push(...griglia(cartella, senzaPosto).map((e) => ({ ...e, y: e.y + yMax })))
  } else {
    posti = griglia(cartella, propri)
  }
  const g = gruppoDi(s.id)
  const pagina = g ?? s.id
  if (!pages.some((p) => p.id === pagina)) pages.push({ id: pagina, name: g ? GRUPPI[g].nome : s.nome })
  // In un gruppo ogni sezione parte sotto la precedente, con un titolo sopra (≥ 223 px sopra la prima riga).
  let dy = 0
  if (g) {
    const sx = Math.min(...posti.map((a) => a.x)), larg = Math.max(...posti.map((a) => a.x + a.w)) - sx
    dy = (cursori.get(pagina) ?? 0) + 300
    notes[`${s.id}-titolo`] = { x: sx, y: dy - 260, text: s.nome, kind: 'title1', maxW: Math.min(Math.max(larg, 600), 1840), page: pagina }
    cursori.set(pagina, dy + Math.max(...posti.map((a) => a.y + a.h)))
  }
  for (const a of posti) {
    const nome = `${s.id}-${a.file}`
    boards[nome] = { x: a.x, y: a.y + dy, w: a.w, h: a.h, page: pagina, title: a.title ?? stem(a.file) }
    order.push(nome)
    copia(join(cartella, a.file), nome, nuovo)
  }
  for (const n of c?.annotations ?? []) {
    if (n.page && n.page !== 'page-1') continue
    // Un titolo (`kind`) resta titolo: un post-it largo si allunga a 4/3 e copre le tavole sotto.
    notes[`${s.id}-${n.id}`] = { x: n.x, y: n.y + dy, w: n.w, text: n.text, page: pagina, ...(n.kind && { kind: n.kind, maxW: n.maxW }) }
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
if (pages.length > MAX_PAGINE) { console.error(`${pages.length} pagine: il canvas ne mostra ${MAX_PAGINE}. Raggruppa altre sezioni in GRUPPI.`); errori++ }
writeFileSync(join(uscita, 'project', 'canvas.json'), JSON.stringify(indice, null, 1))
writeFileSync(join(uscita, 'files.json'), JSON.stringify(['project/canvas.json', ...order.map((f) => `project/${f}`)]))
console.log(`${order.length} artboard in ${pages.length} pagine → ${uscita}`)
process.exit(errori ? 1 : 0)
