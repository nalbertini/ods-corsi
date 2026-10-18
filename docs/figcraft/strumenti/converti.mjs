// Trasforma gli alberi letti dal sito (raw/*.json) in un file nel formato REST di Figma,
// che FigCraft apre così com'è (cartella images/ accanto, nomi = imageRef).
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, renameSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { join } from 'node:path'

const RAW = process.argv[2]
const OUT = process.argv[3]
mkdirSync(join(OUT, 'images'), { recursive: true })

const NOMI = {
  home: 'Home', corsi: 'Corsi', 'chi-siamo': 'Chi siamo', contatti: 'Contatti', istruttori: 'Istruttori',
  judo: 'Judo', lotta: 'Lotta', aikido: 'Aikido', 'pre-pugilistica': 'Pre pugilistica',
  'mga-metodo-globale-di-autodifesa': 'Metodo Globale di Autodifesa',
  'preparazione-atletica': 'Preparazione atletica', 'sollevamenti-pesi': 'Sollevamenti pesi',
  'giocomotricita-e-psicomotricita': 'Giocomotricità e psicomotricità',
  'avviamento-alle-arti-marziali': 'Avviamento alle arti marziali',
  'fabio-berta': 'Fabio Berta', 'maurizio-innella': 'Maurizio Innella',
  'contributi-pubblici': 'Contributi pubblici', privacy: 'Privacy', cookie: 'Cookie',
}
const ORDINE = Object.keys(NOMI)
const MISURE = [['desktop', 'Desktop 1440', 0], ['telefono', 'Telefono 390', 1640]]

// ---- colori
function colore(s) {
  if (!s) return null
  let m = s.match(/^rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/)
  if (m) {
    let a = m[4] === undefined ? 1 : (m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]))
    return { r: +m[1] / 255, g: +m[2] / 255, b: +m[3] / 255, a }
  }
  m = s.match(/^color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+%?))?\)$/)
  if (m) return { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : (m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4])) }
  return null
}
// variabili di colore = i sei colori del sito (:root della pagina); chi li usa li lega
const COLORI = [['fondo', '#eef5fa'], ['inchiostro', '#0d2a3d'], ['blu', '#14709f'], ['chiara', '#cfe6f4'], ['giallo', '#f4c31b'], ['bianco', '#ffffff']]
const hex = c => '#' + [c.r, c.g, c.b].map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('')
const idColore = new Map(COLORI.map(([n, h], i) => [h, `VariableID:1:${i + 1}`]))
const solido = (c, opacita = 1) => {
  const p = { type: 'SOLID', color: { r: c.r, g: c.g, b: c.b, a: 1 }, opacity: +(c.a * opacita).toFixed(4) }
  const v = idColore.get(hex(c))
  if (v) p.boundVariables = { color: { type: 'VARIABLE_ALIAS', id: v } }
  return p
}

// ---- immagini
const immagini = new Map() // src -> ref
const ref = src => {
  if (!immagini.has(src)) immagini.set(src, createHash('sha1').update(src).digest('hex').slice(0, 40))
  return immagini.get(src)
}

// ---- icone SVG a un tracciato (Phosphor, viewBox 256): scalo il tracciato alla misura vera
function scalaTracciato(d, k) {
  const tok = d.match(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/g) || []
  const n = { m: 2, l: 2, h: 1, v: 1, c: 6, s: 4, q: 4, t: 2, a: 7, z: 0 }
  const out = []
  let i = 0, cmd = ''
  while (i < tok.length) {
    if (/[a-zA-Z]/.test(tok[i])) { cmd = tok[i++]; out.push(cmd); if (cmd.toLowerCase() === 'z') continue }
    const c = cmd.toLowerCase(), cnt = n[c]
    const args = tok.slice(i, i + cnt).map(Number); i += cnt
    if (c === 'a') out.push(args[0] * k, args[1] * k, args[2], args[3], args[4], args[5] * k, args[6] * k)
    else out.push(...args.map(v => v * k))
    if (c === 'm') cmd = cmd === 'm' ? 'l' : 'L'
  }
  return out.map(v => typeof v === 'number' ? +v.toFixed(3) : v).join(' ')
}
function nodoSvg(n, id, ox, oy) {
  const vb = (n.svg.match(/viewBox="([^"]+)"/) || [])[1]?.split(/\s+/).map(Number) || [0, 0, n.w, n.h]
  const k = n.w / vb[2]
  const fill = colore((n.svg.match(/\sfill="([^"]+)"/) || [])[1]) || { r: 0, g: 0, b: 0, a: 1 }
  const tracciati = [...n.svg.matchAll(/<path[^>]*\sd="([^"]+)"/g)].map(m => ({ path: scalaTracciato(m[1], k), windingRule: 'NONZERO' }))
  return { id, name: 'icona', type: 'VECTOR', absoluteBoundingBox: { x: n.x + ox, y: n.y + oy, width: n.w, height: n.h },
    fills: [solido(fill, n.opacita ?? 1)], fillGeometry: tracciati }
}

// ---- ombre
function ombre(s) {
  if (!s) return []
  const out = []
  for (const parte of s.split(/,(?![^(]*\))/)) {
    if (/inset/.test(parte)) continue
    const c = parte.match(/(rgba?\([^)]*\)|color\([^)]*\))/)?.[1]
    const num = parte.replace(c || '', '').match(/-?[\d.]+px/g)?.map(parseFloat) || []
    const col = colore(c)
    if (!col || num.length < 2) continue
    out.push({ type: 'DROP_SHADOW', color: col, offset: { x: num[0], y: num[1] }, radius: num[2] || 0, spread: num[3] || 0, visible: true, blendMode: 'NORMAL' })
  }
  return out
}

let seq = 0
const rifinire = [] // immagini a copertura: il punto di fuoco (object-position) si calcola a file scaricato
const nuovoId = () => `${Math.floor(++seq / 1000) + 1}:${seq % 1000}`
const nomeRiquadro = n => {
  const cl = (n.classe || '').split(/\s+/).filter(Boolean)
  return cl.length ? `${n.tag}.${cl.join('.')}` : n.tag
}
const allineo = { left: 'LEFT', start: 'LEFT', center: 'CENTER', right: 'RIGHT', end: 'RIGHT', justify: 'JUSTIFIED' }

function testo(n, ox, oy) {
  const s = n.stile
  const c = colore(s.colore) || { r: 0, g: 0, b: 0, a: 1 }
  const righe = Math.max(1, n.righe)
  const passo = s.interlinea || (n.h / righe)
  let alt, y
  if (righe === 1) { alt = Math.max(passo, n.h); y = n.y - (alt - n.h) / 2 }
  else {
    const contenuto = n.h - (righe - 1) * passo
    alt = righe * passo; y = n.y - (passo - contenuto) / 2
  }
  // le a capo sono già nel testo: la scatola è più larga di Chrome, così FigCraft non ne aggiunge altre
  const slack = Math.max(4, Math.round(n.w * 0.08))
  const x = s.allineo === 'center' ? n.x - slack / 2 : (s.allineo === 'right' || s.allineo === 'end') ? n.x - slack : n.x
  return { id: nuovoId(), name: n.testo.slice(0, 40), type: 'TEXT', characters: n.testo,
    absoluteBoundingBox: { x: x + ox, y: y + oy, width: n.w + slack, height: alt },
    fills: [solido(c, s.opacita ?? 1)],
    style: { fontFamily: s.famiglia, fontWeight: s.peso, italic: s.corsivo, fontSize: s.corpo,
      textAlignHorizontal: allineo[s.allineo] || 'LEFT', textAlignVertical: 'TOP', lineHeightPx: passo,
      letterSpacing: s.spaziatura, textAutoResize: 'NONE', textDecoration: s.sottolineato ? 'UNDERLINE' : 'NONE' } }
}

function visivo(n) {
  return n.sfondo || n.sfondoImmagine || n.ombra || n.bordi?.some(b => b.w > 0)
}

// ::before/::after in linea (« » · •) non si disegnano a parte: il loro testo entra nel testo
// accanto, se no la prima riga di un paragrafo a più righe si sovrappone al segno.
function fondiPseudo(figli) {
  const solo = p => p.pseudo && !p.sfondo && p.figli?.length === 1 && p.figli[0].tipo === 'testo' && /^inline/.test(p.display || 'inline')
  const out = []
  for (let i = 0; i < figli.length; i++) {
    const f = figli[i]
    if (solo(f)) {
      const t = f.figli[0]
      const prossimo = f.pseudo === '::before' ? figli[i + 1] : null
      const prima = f.pseudo === '::after' ? out[out.length - 1] : null
      const a = prossimo?.tipo === 'testo' ? prossimo : (prima?.tipo === 'testo' ? prima : null)
      if (a) {
        const x0 = Math.min(a.x, t.x), x1 = Math.max(a.x + a.w, t.x + t.w)
        const sp = f.pseudo === '::before' ? (/\s$/.test(t.testo) || /^\s/.test(a.testo) ? '' : '') : ''
        a.testo = f.pseudo === '::before' ? t.testo + sp + a.testo : a.testo + t.testo
        a.x = x0; a.w = x1 - x0
        continue
      }
    }
    out.push(f)
  }
  return out
}


// ---- componenti: le strutture che si ripetono (pulsanti, schede, tessere, citazioni)
const BASI = [['scheda', 'Scheda'], ['citazione', 'Citazione'], ['tessera', 'Tessera'], ['pulsante', 'Pulsante']]
const GENERICHE = new Set(BASI.map(b => b[0]))
const firma = n => {
  if (n.tipo === 'testo') return 'T'
  if (n.tipo === 'svg') return 'S'
  if (n.tipo === 'immagine') return 'I'
  const cl = (n.classe || '').split(/\s+/).filter(Boolean).sort().join('.')
  return `${n.tag}${cl ? '.' + cl : ''}(${(n.figli || []).map(firma).join(',')})`
}
const baseDi = n => {
  if (n.tipo !== 'riquadro' || !n.classe) return null
  const cl = n.classe.split(/\s+/)
  return BASI.find(([k]) => cl.includes(k)) || null
}
const conteggi = new Map()
function conta(n, dentro = false) {
  const b = !dentro && baseDi(n)
  if (b) { const f = firma(n); conteggi.set(f, (conteggi.get(f) || 0) + 1) }
  for (const f of n.figli || []) conta(f, dentro || !!b)
}
// conto solo il desktop: la stessa scheda vista sul telefono non è un secondo uso
for (const slug of ORDINE) for (const [chiave] of MISURE.slice(0, 1)) {
  const f = join(RAW, `${slug}.${chiave}.json`)
  if (existsSync(f)) conta(JSON.parse(readFileSync(f, 'utf8')).radice)
}
const gruppi = new Map() // firma -> { id, base, nome, istanze: [] }
function gruppoDi(n) {
  const f = firma(n)
  if (!gruppi.has(f)) {
    const [k, etichetta] = baseDi(n)
    const varianti = n.classe.split(/\s+/).filter(x => x && !GENERICHE.has(x))
    gruppi.set(f, { id: null, base: etichetta, variante: varianti.join(' ') || 'base', istanze: [] })
  }
  return gruppi.get(f)
}

function converti(n, ox, oy, dentro = false) {
  if (n.figli?.length) n.figli = fondiPseudo(n.figli)
  if (n.tipo === 'testo') return testo(n, ox, oy)
  if (n.tipo === 'svg') return nodoSvg(n, nuovoId(), ox, oy)
  if (n.w <= 0 || n.h <= 0) return null
  const candidato = !dentro && baseDi(n) && (conteggi.get(firma(n)) || 0) >= 2
  const figli = (n.figli || []).map(f => converti(f, ox, oy, dentro || !!candidato)).filter(Boolean)
  if (n.tipo === 'riquadro' && !visivo(n) && !figli.length) return null

  const nodo = { id: nuovoId(), name: n.tipo === 'immagine' ? `immagine: ${(n.alt || '').slice(0, 40)}` : nomeRiquadro(n),
    type: n.tipo === 'immagine' ? 'RECTANGLE' : 'FRAME',
    absoluteBoundingBox: { x: n.x + ox, y: n.y + oy, width: n.w, height: n.h } }
  const fills = []
  const bg = colore(n.sfondo)
  if (bg && bg.a > 0) fills.push(solido(bg, n.opacita < 1 ? 1 : 1))
  if (n.sfondoImmagine) fills.push({ type: 'IMAGE', scaleMode: 'FILL', imageRef: ref(n.sfondoImmagine) })
  if (n.tipo === 'immagine' && n.src) {
    const riempi = { type: 'IMAGE', scaleMode: n.adatta === 'contain' ? 'FIT' : 'FILL', imageRef: ref(n.src) }
    if (n.adatta === 'cover' || n.adatta === 'fill' && false) rifinire.push({ riempi, src: n.src, w: n.w, h: n.h, pos: n.posizione })
    fills.push(riempi)
  }
  nodo.fills = fills
  // bordi
  const b = n.bordi || []
  const spessori = b.map(x => x.w)
  const conBordo = spessori.some(w => w > 0)
  if (conBordo) {
    const cb = colore((b.find(x => x.w > 0) || {}).c)
    if (cb) {
      nodo.strokes = [solido(cb)]
      nodo.strokeAlign = 'INSIDE'
      if (new Set(spessori).size === 1) nodo.strokeWeight = spessori[0]
      else { nodo.strokeWeight = Math.max(...spessori); nodo.individualStrokeWeights = { top: spessori[0], right: spessori[1], bottom: spessori[2], left: spessori[3] } }
    }
  }
  const r = n.raggi || [0, 0, 0, 0]
  if (new Set(r).size === 1) { if (r[0] > 0) nodo.cornerRadius = Math.min(r[0], n.w / 2, n.h / 2) }
  else nodo.rectangleCornerRadii = r
  const ef = ombre(n.ombra)
  if (ef.length) nodo.effects = ef
  if (n.opacita < 1) nodo.opacity = n.opacita
  if (n.fusione) nodo.blendMode = n.fusione.toUpperCase().replace(/-/g, '_')
  if (nodo.type === 'FRAME') nodo.clipsContent = !!n.taglia
  if (figli.length && nodo.type === 'FRAME') nodo.children = figli
  nodo._pos = n.posizioneCss
  if (candidato && nodo.type === 'FRAME') {
    const g = gruppoDi(n)
    nodo.type = 'INSTANCE'; nodo._gruppo = g
    g.istanze.push(nodo)
  }
  return nodo
}


// ---- auto layout ricavato dalle posizioni vere
// Lo accetto solo se rifacendo i conti con padding, spazio e allineamento ottengo gli stessi
// numeri di Chrome (1px di tolleranza): così il frame si comporta come il sito quando lo si modifica.
const TOL = 1
const bb = k => k.absoluteBoundingBox
const vicini = (a, b) => Math.abs(a - b) <= TOL

function ricavaLayout(f) {
  const tutti = f.children || []
  const assoluti = tutti.filter(k => k._pos === 'absolute' || k._pos === 'fixed')
  const flusso = tutti.filter(k => !assoluti.includes(k))
  if (!flusso.length) return false
  const F = bb(f)
  for (const dir of ['V', 'H']) {
    const r = provaDirezione(f, F, flusso, dir)
    if (r) return applica(f, flusso, assoluti, r)
  }
  if (flusso.length >= 3) {
    const r = provaWrap(f, F, flusso)
    if (r) return applica(f, flusso, assoluti, r)
  }
  return false
}

function assi(dir) {
  return dir === 'V'
    ? { m: 'y', ms: 'height', c: 'x', cs: 'width' }
    : { m: 'x', ms: 'width', c: 'y', cs: 'height' }
}

function provaDirezione(f, F, items, dir) {
  const { m, ms, c, cs } = assi(dir)
  const v = [...items].sort((a, b) => bb(a)[m] - bb(b)[m] || bb(a)[c] - bb(b)[c])
  // niente sovrapposizioni lungo l'asse principale
  const gap = []
  for (let i = 1; i < v.length; i++) {
    const g = bb(v[i])[m] - (bb(v[i - 1])[m] + bb(v[i - 1])[ms])
    if (g < -0.6) return null
    gap.push(g)
  }
  if (gap.length && Math.max(...gap) - Math.min(...gap) > TOL) return null
  const spazio = gap.length ? gap.reduce((s, x) => s + x, 0) / gap.length : 0
  const inizio = bb(v[0])[m] - F[m]
  const fine = F[m] + F[ms] - (bb(v[v.length - 1])[m] + bb(v[v.length - 1])[ms])
  if (inizio < -0.6 || fine < -0.6) return null
  // asse trasversale
  const s = v.map(k => bb(k)[c] - F[c])
  const e = v.map(k => F[c] + F[cs] - (bb(k)[c] + bb(k)[cs]))
  if (s.some(x => x < -0.6) || e.some(x => x < -0.6)) return null
  const eguali = a => Math.max(...a) - Math.min(...a) <= TOL
  let allineo, padC0, padC1
  if (eguali(s)) { allineo = 'MIN'; padC0 = s[0]; padC1 = Math.min(...e) }
  else if (eguali(e)) { allineo = 'MAX'; padC0 = Math.min(...s); padC1 = e[0] }
  else if (s.every((x, i) => vicini(x, e[i]))) { allineo = 'CENTER'; padC0 = padC1 = Math.min(...s) }
  else return null
  // un figlio unico, centrato sull'asse principale: lo dichiaro centrato (bottoni, pastiglie)
  let primario = 'MIN', pad0 = inizio, pad1 = fine
  if (v.length === 1 && inizio > 0.6 && vicini(inizio, fine)) { primario = 'CENTER'; pad0 = pad1 = 0 }
  const stira = v.map(k => vicini(bb(k)[cs], F[cs] - padC0 - padC1) && allineo === 'MIN')
  return { dir, spazio, primario, pad0, pad1, allineo, padC0, padC1, stira, wrap: false }
}

// righe che vanno a capo (griglie di schede): rifaccio il flusso e confronto
function provaWrap(f, F, items) {
  const v = [...items].sort((a, b) => bb(a).y - bb(b).y || bb(a).x - bb(b).x)
  const righe = []
  for (const k of v) {
    const r = righe[righe.length - 1]
    if (r && bb(k).y < r.fondo - 0.6) { r.k.push(k); r.fondo = Math.max(r.fondo, bb(k).y + bb(k).height) }
    else righe.push({ k: [k], top: bb(k).y, fondo: bb(k).y + bb(k).height })
  }
  if (righe.length < 2) return null
  for (const r of righe) r.k.sort((a, b) => bb(a).x - bb(b).x)
  const padL = bb(righe[0].k[0]).x - F.x, padT = bb(righe[0].k[0]).y - F.y
  // spazio fra schede nella riga e fra righe
  const gx = [], gy = []
  for (const r of righe) for (let i = 1; i < r.k.length; i++) gx.push(bb(r.k[i]).x - (bb(r.k[i - 1]).x + bb(r.k[i - 1]).width))
  for (let i = 1; i < righe.length; i++) gy.push(righe[i].top - righe[i - 1].fondo)
  if (!gx.length || !gy.length) return null
  if (Math.max(...gx) - Math.min(...gx) > TOL || Math.max(...gy) - Math.min(...gy) > TOL) return null
  const sx = gx.reduce((a, b) => a + b, 0) / gx.length, sy = gy.reduce((a, b) => a + b, 0) / gy.length
  if (righe.some(r => r.k.some(k => !vicini(bb(k).y, r.top)))) return null // dentro la riga in alto
  if (righe.some(r => bb(r.k[0]).x - F.x < padL - TOL || !vicini(bb(r.k[0]).x - F.x, padL))) return null
  const larghezzaUtile = Math.max(...righe.map(r => bb(r.k[r.k.length - 1]).x + bb(r.k[r.k.length - 1]).width)) - F.x
  const padR = Math.max(0, F.width - larghezzaUtile)
  const inner = F.width - padL - padR
  // rifaccio il flusso: la prossima scheda va a capo quando non entra
  let ok = true
  righe.forEach((r, ri) => {
    let x = 0
    r.k.forEach((k, i) => {
      if (i > 0) x += sx
      if (!vicini(bb(k).x - F.x - padL, x)) ok = false
      x += bb(k).width
    })
    const prossima = righe[ri + 1]
    if (prossima && x + sx + bb(prossima.k[0]).width <= inner + TOL) ok = false // sarebbe entrata
  })
  if (!ok) return null
  return { dir: 'H', spazio: sx, spazioRighe: sy, primario: 'MIN', pad0: padL, pad1: padR, allineo: 'MIN', padC0: padT, padC1: Math.max(0, F.y + F.height - righe[righe.length - 1].fondo), stira: items.map(() => false), wrap: true }
}

function applica(f, flusso, assoluti, r) {
  f.layoutMode = r.dir === 'V' ? 'VERTICAL' : 'HORIZONTAL'
  f.itemSpacing = +r.spazio.toFixed(2)
  f.primaryAxisSizingMode = 'FIXED'; f.counterAxisSizingMode = 'FIXED'
  f.primaryAxisAlignItems = r.primario
  f.counterAxisAlignItems = r.allineo
  const [p0, p1, c0, c1] = [r.pad0, r.pad1, r.padC0, r.padC1].map(x => +x.toFixed(2))
  if (r.dir === 'V') Object.assign(f, { paddingTop: p0, paddingBottom: p1, paddingLeft: c0, paddingRight: c1 })
  else Object.assign(f, { paddingLeft: p0, paddingRight: p1, paddingTop: c0, paddingBottom: c1 })
  if (r.wrap) { f.layoutWrap = 'WRAP'; f.counterAxisSpacing = +r.spazioRighe.toFixed(2) }
  // l'ordine dei figli è l'ordine del flusso
  const { m, c } = assi(r.dir)
  const ordinati = [...flusso].sort((a, b) => bb(a)[m] - bb(b)[m] || bb(a)[c] - bb(b)[c])
  if (r.wrap) ordinati.sort((a, b) => bb(a).y - bb(b).y || bb(a).x - bb(b).x)
  const mappa = new Map(flusso.map((k, i) => [k, r.stira[i]]))
  for (const k of ordinati) if (mappa.get(k)) k.layoutAlign = 'STRETCH'
  for (const k of assoluti) k.layoutPositioning = 'ABSOLUTE'
  f.children = [...ordinati, ...assoluti]
  return true
}

function visita(n, fn) { fn(n); (n.children || []).forEach(k => visita(k, fn)) }

let conLayout = 0
const canvases = []
let mancano = []
for (const slug of ORDINE) {
  const frames = []
  for (const [chiave, etichetta, x0] of MISURE) {
    const f = join(RAW, `${slug}.${chiave}.json`)
    if (!existsSync(f)) { mancano.push(f); continue }
    const d = JSON.parse(readFileSync(f, 'utf8'))
    const radice = d.radice
    const fr = converti(radice, x0, 0)
    fr.name = `${NOMI[slug]} · ${etichetta}`
    fr.absoluteBoundingBox = { x: x0, y: 0, width: d.larghezza, height: d.altezza }
    fr.clipsContent = true
    visita(fr, k => { if ((k.type === 'FRAME' || k.type === 'INSTANCE') && k.children?.length) { if (ricavaLayout(k)) conLayout++ } })
    frames.push(fr)
  }
  canvases.push({ id: `0:${canvases.length + 1}`, name: NOMI[slug], type: 'CANVAS', children: frames })
}

// ---- pagina «Componenti»: un principale per gruppo, le istanze lo richiamano
const pulisci = n => JSON.parse(JSON.stringify(n, (k, v) => k.startsWith('_') ? undefined : v))
function rinumera(n) { n.id = nuovoId(); (n.children || []).forEach(rinumera) }
function trasla(n, dx, dy) { const b = n.absoluteBoundingBox; b.x += dx; b.y += dy; (n.children || []).forEach(k => trasla(k, dx, dy)) }
const componenti = {}
const mains = []
const nomiUsati = new Map()
const colonne = new Map()
for (const g of gruppi.values()) {
  if (g.istanze.length < 2) { g.istanze.forEach(i => { i.type = 'FRAME'; delete i._gruppo }); continue }
  let nome = `${g.base}/${g.variante}`
  const k = (nomiUsati.get(nome) || 0) + 1; nomiUsati.set(nome, k)
  if (k > 1) nome += ` ${k}`
  const prima = g.istanze[0]
  const main = pulisci(prima)
  rinumera(main)
  main.type = 'COMPONENT'; main.name = nome
  g.id = main.id; g.nome = nome
  // colonna per famiglia (Pulsante, Tessera…), uno sotto l'altro
  const col = colonne.get(g.base) ?? { x: colonne.size * 1700, y: 0 }
  colonne.set(g.base, col)
  const b = main.absoluteBoundingBox
  trasla(main, col.x - b.x, col.y - b.y)
  col.y += b.height + 60
  mains.push(main)
  for (const i of g.istanze) { i.componentId = g.id; i.name = nome.split('/')[0]; delete i._gruppo }
  componenti[g.id] = { key: createHash('sha1').update(nome).digest('hex').slice(0, 40), name: nome, description: `${g.istanze.length} usi nel sito` }
}
canvases.unshift({ id: '0:900', name: 'Componenti', type: 'CANVAS', children: mains })

const doc = { name: 'Officine dello Sport · sito', components: componenti, document: { id: '0:0', name: 'Document', type: 'DOCUMENT', children: canvases } }
writeFileSync(join(OUT, 'ods-sito.json'), JSON.stringify(doc, (k, v) => k.startsWith('_') ? undefined : v))
const rgb = h => ({ r: parseInt(h.slice(1, 3), 16) / 255, g: parseInt(h.slice(3, 5), 16) / 255, b: parseInt(h.slice(5, 7), 16) / 255, a: 1 })
writeFileSync(join(OUT, 'ods-sito.variables.json'), JSON.stringify({ status: 200, error: false, meta: {
  variableCollections: { 'VariableCollectionId:1:0': { id: 'VariableCollectionId:1:0', name: 'Colori del sito', modes: [{ modeId: '1:0', name: 'Sito' }], defaultModeId: '1:0', variableIds: COLORI.map((_, i) => `VariableID:1:${i + 1}`) } },
  variables: Object.fromEntries(COLORI.map(([n, h], i) => [`VariableID:1:${i + 1}`, { id: `VariableID:1:${i + 1}`, name: n, variableCollectionId: 'VariableCollectionId:1:0', resolvedType: 'COLOR', valuesByMode: { '1:0': rgb(h) } }])) } }))

// immagini: scarico ogni indirizzo una volta, il nome del file è l'imageRef
let ok = 0, ko = []
for (const [src, r] of immagini) {
  const dest = join(OUT, 'images', r)
  if (existsSync(dest)) { ok++; continue }
  try {
    const res = await fetch(src.startsWith('http') ? src : new URL(src, 'https://www.officinedellosport.it/').href)
    if (!res.ok) throw new Error(res.status)
    writeFileSync(dest, Buffer.from(await res.arrayBuffer())); ok++
  } catch (e) { ko.push(src + ' ' + e.message) }
}
// ---- punto di fuoco delle foto: object-position -> imageTransform
function misuraImmagine(b) {
  if (b[0] === 0x89 && b[1] === 0x50) return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) }
  if (b[0] === 0xff && b[1] === 0xd8) {
    let i = 2
    while (i < b.length) {
      if (b[i] !== 0xff) { i++; continue }
      const m = b[i + 1]
      if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) }
      i += 2 + b.readUInt16BE(i + 2)
    }
  }
  if (b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') {
    const t = b.toString('ascii', 12, 16)
    if (t === 'VP8X') return { w: 1 + b.readUIntLE(24, 3), h: 1 + b.readUIntLE(27, 3) }
    if (t === 'VP8L') { const v = b.readUInt32LE(21); return { w: 1 + (v & 0x3fff), h: 1 + ((v >> 14) & 0x3fff) } }
    if (t === 'VP8 ') return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff }
  }
  return null
}
const frazione = (s, centro = 0.5) => {
  if (s === 'left' || s === 'top') return 0
  if (s === 'right' || s === 'bottom') return 1
  if (s === 'center') return 0.5
  const m = /^(-?[\d.]+)%$/.exec(s || '')
  return m ? +m[1] / 100 : centro
}
let fuochi = 0
for (const r of rifinire) {
  const file = join(OUT, 'images', immagini.get(r.src))
  if (!existsSync(file)) continue
  const d = misuraImmagine(readFileSync(file))
  if (!d) continue
  const [px, py] = (r.pos || '50% 50%').split(/\s+/).map(s => frazione(s))
  const s = Math.max(r.w / d.w, r.h / d.h)
  const sx = Math.min(1, r.w / (d.w * s)), sy = Math.min(1, r.h / (d.h * s))
  if (Math.abs(px - 0.5) < 0.005 && Math.abs(py - 0.5) < 0.005) continue // centrata: FILL basta
  // FigCraft non applica lo spostamento verticale di un ritaglio importato: ritaglio la foto davvero
  const cw = Math.min(d.w, Math.round(r.w / s)), ch = Math.min(d.h, Math.round(r.h / s))
  const nuovo = createHash('sha1').update(`${r.src}|${cw}x${ch}|${px}|${py}`).digest('hex').slice(0, 40)
  const dest = join(OUT, 'images', nuovo)
  // sips con scarto 0 0 ritaglia al centro: parto da 1
  if (!existsSync(dest)) {
    const tmp = dest + '.jpg'
    execFileSync('sips', ['--cropToHeightWidth', String(ch), String(cw), '--cropOffset', String(Math.max(1, Math.round((d.h - ch) * py))), String(Math.max(1, Math.round((d.w - cw) * px))), file, '--out', tmp], { stdio: 'ignore' })
    renameSync(tmp, dest)
  }
  r.riempi.imageRef = nuovo; r.riempi.scaleMode = 'FILL'
  fuochi++
}
// il JSON va riscritto con i fuochi
writeFileSync(join(OUT, 'ods-sito.json'), JSON.stringify(doc, (k, v) => k.startsWith('_') ? undefined : v))
console.log(`pagine ${canvases.length}, foto con fuoco ${fuochi}, nodi ${seq}, con auto layout ${conLayout}, immagini ${ok}/${immagini.size}`, ko.length ? ko : '', mancano.length ? mancano : '')
