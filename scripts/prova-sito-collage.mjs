// ---------------------------------------------------------------------------
// La testata della home con il collage di foto e numeri, senza browser.
//
//   node scripts/prova-sito-collage.mjs
//
// Si passa sempre da `generaSito` (src/lib/sitoGenera.ts): la prova non sa in
// quale file stia il codice. Il patto fra prova e codice è il markup:
//
//   <section class="pagina-hero">        la testata di sempre (h1, frase, «Contattaci»)
//     <div class="intro">…</div>         h1, descrizione, pulsante: come oggi
//     <div class="collage …">            SE ci sono foto (anche con i numeri): la griglia a 6 colonne
//     <div class="tessere n-N">          SE ci sono solo numeri (N tessere) o una sola foto (n-1)
//       <figure class="tessera foto [grande]">   la prima foto è «grande»
//       <article class="tessera blu|giallo|inchiostro|chiara numero [lunga]">
//         <strong class="cifra">35+</strong><span class="scritta">anni di sport</span>
//   </section>
//   <div class="testo">…</div>           i paragrafi dell'introduzione, SOTTO la testata
//
// Le tessere sono figlie dirette della griglia (niente `foto-fila` nel collage),
// nell'ordine: foto grande, numeri, altre foto. `lunga` va sulla tessera il cui
// grassetto supera i 30 caratteri o il cui resto supera i 40.
// Il CSS si legge come testo e la griglia si ricostruisce (colonne, righe, specificità).
// ---------------------------------------------------------------------------
import { build } from 'esbuild'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const carica = async (file) => {
  try {
    const { outputFiles } = await build({
      entryPoints: [file],
      bundle: true,
      format: 'esm',
      platform: 'node',
      write: false,
      logLevel: 'silent',
      define: { 'import.meta.env': '{}' },
      banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(process.cwd() + '/');" },
    })
    return await import('data:text/javascript;base64,' + Buffer.from(outputFiles[0].text).toString('base64'))
  } catch (e) {
    console.log(`  (modulo mancante: ${file} — ${String(e.message).split('\n')[0]})`)
    return {}
  }
}
const g = await carica('src/lib/sitoGenera.ts')
const t = await carica('src/lib/sitoTesto.ts')

// L'unico <script> ammesso è il blocco dei dati strutturati (ld+json): è JSON con ogni «<» escapato, e non può contenere altri tag.
const senzaDati = (h) => h.replace(/<script type="application\/ld\+json">[^<]*<\/script>/g, '')
let guai = 0
const ok = (cosa, avuto, voluto) => {
  const va = JSON.stringify(avuto) === JSON.stringify(voluto)
  console.log(va ? '  ✓' : '  ✗', cosa, va ? '' : `— atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`)
  if (!va) guai++
}
const prova = (f) => {
  try {
    return f()
  } catch (e) {
    return `ERRORE: ${e.message}`
  }
}

const DOMINIO = 'https://officinedellosport.it'
const TITOLO = 'Officine dello Sport'
const FRASE = 'La frase sotto il titolo'
const P = 'https://abc.supabase.co/storage/v1/object/public/sito/'
/** Il sito con la pagina di prova (di default la home) e, se serve, la pagina contatti. */
const gen = (testo, { slug = 'home', contatti = false, diLegge = false, ospiti } = {}) => {
  const pagine = [{ slug, titolo: TITOLO, descrizione: FRASE, testo, ...(diLegge ? { diLegge } : {}) }]
  if (slug !== 'home') pagine.unshift({ slug: 'home', titolo: 'Home', descrizione: 'd', testo: '<p>Home</p>' })
  if (contatti) pagine.push({ slug: 'contatti', titolo: 'Contatti', descrizione: 'd', testo: '<p>Scrivici</p>' })
  const r = prova(() => g.generaSito({ dominio: DOMINIO, pagine, menu: [], rinvii: [], ...(ospiti ? { ospitiImmagini: ospiti } : {}) }))
  return typeof r === 'object' && r !== null ? r : {}
}
const pag = (testo, o = {}) => gen(testo, o)[(o.slug ?? 'home') === 'home' ? 'index.html' : `${o.slug}/index.html`] ?? ''
const main = (h) => h.match(/<main>([\s\S]*)<\/main>/)?.[1] ?? ''
const hero = (h) => h.match(/<section class="pagina-hero">[\s\S]*?<\/section>/)?.[0] ?? ''
const dopoHero = (h) => main(h).split('</section>').slice(1).join('</section>')
const conta = (x, re) => (x.match(re) || []).length

// --- Il markup come dati (le mosse di prova-sito-tessere) ---------------------
const INIZIO = /<[a-z0-9]+\b[^>]*\bclass="[^"]*\btessera\b[^"]*"[^>]*>/g
const tessere = (h) => {
  const m = [...h.matchAll(INIZIO)]
  return m.map((x, i) => ({ classi: (x[0].match(/class="([^"]*)"/)?.[1] ?? '').split(/\s+/), html: h.slice(x.index, m[i + 1]?.index ?? h.length) }))
}
const COLORI = ['blu', 'giallo', 'inchiostro', 'chiara']
const colore = (tt) => COLORI.find((c) => tt.classi.includes(c)) ?? '?'
const testoDi = (h) => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
const radice = (h) => (h.match(/<div\b[^>]*\bclass="[^"]*\b(?:collage|tessere)\b[^"]*"[^>]*>/)?.[0].match(/class="([^"]*)"/)?.[1] ?? '').split(/\s+/).filter(Boolean)
const numeri = (h) => tessere(hero(h)).filter((x) => x.classi.includes('numero'))
const foto = (h) => tessere(hero(h)).filter((x) => x.classi.includes('foto'))
const imgs = (h) => [...h.matchAll(/<img\b[^>]*>/g)].map((m) => m[0])
const attr = (tag, nome) => (tag ?? '').match(new RegExp(`\\s${nome}="([^"]*)"`))?.[1]
const dentro = (x, cl) => testoDi(x.match(new RegExp(`class="${cl}"[^>]*>([\\s\\S]*?)</`))?.[1] ?? '')

// --- Il CSS come dati --------------------------------------------------------
const stile = (h) => h.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? ''
const blocco = (x, inizio) => {
  const i = x.indexOf(inizio)
  if (i < 0) return null
  const a = x.indexOf('{', i)
  for (let k = a, p = 0; k < x.length; k++) {
    if (x[k] === '{') p++
    else if (x[k] === '}' && --p === 0) return { dentro: x.slice(a + 1, k), senza: x.slice(0, i) + x.slice(k + 1) }
  }
  return null
}
const regole = (x) =>
  [...x.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
    sel: m[1].trim().split(/\s*,\s*/),
    dich: Object.fromEntries(m[2].split(';').filter((y) => y.includes(':')).map((y) => { const i = y.indexOf(':'); return [y.slice(0, i).trim(), y.slice(i + 1).trim()] })),
  }))
const risolvi = (v, V) => {
  let x = v ?? ''
  for (let i = 0; i < 5; i++) x = x.replace(/var\((--[\w-]+)\)/g, (_, n) => V[n] ?? '')
  return x.trim().toLowerCase()
}
const hex = (v) => {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(v)
  return m ? '#' + (m[1].length === 3 ? [...m[1]].map((x) => x + x).join('') : m[1]) : null
}
const luce = (h) => {
  const [r, gg, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * gg + 0.0722 * b
}
const contrasto = (a, b) => {
  const [x, y] = [luce(a), luce(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}
const FONDO = '#eef5fa', INCHIOSTRO = '#0d2a3d', BLU = '#14709f', CHIARA = '#cfe6f4', GIALLO = '#f4c31b', BIANCO = '#ffffff'

const cssDi = (h) => {
  const tutto = stile(h)
  let base = tutto
  let tel = ''
  for (let b = blocco(base, '@media (max-width:900px)'); b; b = blocco(base, '@media (max-width:900px)')) { tel += b.dentro; base = b.senza }
  const R = regole(base)
  const V = Object.assign({}, ...R.filter((r) => r.sel.includes(':root')).map((r) => r.dich))
  return { tutto, base: R, tel: regole(tel), V, tuttoR: regole(tutto) }
}

// --- La griglia: colonne, righe, specificità, piazzamento in ordine ------------
const parti = (sel) => sel.split(/[\s>]+/).filter(Boolean)
const classiDi = (c) => [...c.matchAll(/\.([\w-]+)/g)].map((m) => m[1])
const senzaNot = (c) => c.replace(/:not\([^)]*\)/g, '')
const nonVuole = (c) => [...c.matchAll(/:not\(\s*\.([\w-]+)\s*\)/g)].map((m) => m[1])
// :not(.x) pesa come .x (non conta il :not stesso)
const specificita = (sel) => (sel.replace(/:not\(/g, '(').match(/\.[\w-]+/g) || []).length + (senzaNot(sel).match(/:[\w-]+/g) || []).length
const pseudoOk = (comp, i, n) => {
  for (const [, tipo, arg] of comp.matchAll(/:(first-child|last-child|nth-child|nth-last-child)(?:\(([^)]*)\))?/g)) {
    if (tipo === 'first-child' && i !== 1) return false
    if (tipo === 'last-child' && i !== n) return false
    if (tipo === 'nth-child' && !(arg === 'odd' ? i % 2 === 1 : arg === 'even' ? i % 2 === 0 : Number(arg) === i)) return false
    if (tipo === 'nth-last-child' && Number(arg) !== n - i + 1) return false
  }
  return !/:(?!first-child|last-child|nth-child|nth-last-child|not)/.test(comp.replace(/\([^)]*\)/g, ''))
}
/** Il selettore vale per la griglia (`radice`) o per una tessera (`figlia`)? Gli antenati ammessi sono la griglia stessa e la testata. */
const combacia = (sel, radiceCl, figlia) => {
  const p = parti(sel)
  const ultima = p[p.length - 1]
  const cl = classiDi(senzaNot(ultima))
  if (!cl.length) return false
  const antenatiOk = p.slice(0, -1).every((x) => classiDi(x).every((c) => radiceCl.includes(c) || c === 'pagina-hero'))
  if (!antenatiOk) return false
  if (!figlia) return !/:/.test(senzaNot(ultima)) && nonVuole(ultima).every((c) => !radiceCl.includes(c)) && cl.every((c) => radiceCl.includes(c))
  return cl.every((c) => figlia.classi.includes(c)) && nonVuole(ultima).every((c) => !figlia.classi.includes(c)) && pseudoOk(senzaNot(ultima), figlia.i, figlia.n)
}
/** Il valore finale di una proprietà: vince la specificità, a parità l'ordine (il @media viene dopo). */
const vince = (R, prop, quale) => {
  let v = null, spec = -1
  R.forEach((r) => {
    if (!(prop in r.dich)) return
    for (const s of r.sel) if (quale(s) && specificita(s) >= spec) { spec = specificita(s); v = r.dich[prop] }
  })
  return v
}
/** `span 4`, `1 / 5`, `1 / span 3`, `1 / -1`: da dove parte (se lo dice) e quanto copre. */
const traccia = (v, K) => {
  const x = (v ?? '').trim()
  let m = /^(\d+)\s*\/\s*span\s+(\d+)$/.exec(x)
  if (m) return { start: Number(m[1]), span: Number(m[2]) }
  m = /^(\d+)\s*\/\s*(-?\d+)$/.exec(x)
  if (m) { const a = Number(m[1]), b = Number(m[2]); return { start: a, span: (b < 0 ? K + 2 + b : b) - a } }
  m = /^span\s+(\d+)$/.exec(x)
  return { start: null, span: m ? Number(m[1]) : 1 }
}
const piazza = (voci, K) => {
  const occ = new Set()
  const libera = (r, c, w, h) => { for (let i = 0; i < h; i++) for (let j = 0; j < w; j++) if (occ.has(`${r + i},${c + j}`)) return false; return true }
  let cr = 1, cc = 1
  return voci.map((v) => {
    const w = Math.min(v.c.span, K), h = v.r.span
    let r = cr, c = cc
    if (v.c.start) {
      c = v.c.start
      r = c < cc ? cr + 1 : cr
      while (r < 200 && (c + w - 1 > K || !libera(r, c, w, h))) r++
    } else {
      while (r < 200 && (c + w - 1 > K || !libera(r, c, w, h))) { c++; if (c + w - 1 > K) { c = 1; r++ } }
    }
    for (let i = 0; i < h; i++) for (let j = 0; j < w; j++) occ.add(`${r + i},${c + j}`)
    cr = r; cc = c
    return { r, c, w, h }
  })
}
/** La pagina `h`: quante colonne, e dove cadono le sue tessere (in ordine), sul desktop o sul telefono. */
const mappa = (h, telefono) => {
  const css = cssDi(h)
  const R = telefono ? [...css.base, ...css.tel] : css.base
  const rad = radice(hero(h))
  const tt = tessere(hero(h))
  const K = colonne(risolvi(vince(R, 'grid-template-columns', (s) => combacia(s, rad, null)) ?? '', css.V))
  const celle = tt.map((x, i) => {
    const f = { classi: x.classi, i: i + 1, n: tt.length }
    const val = (p) => risolvi(vince(R, p, (s) => combacia(s, rad, f)) ?? '', css.V)
    return { c: traccia(val('grid-column'), K), r: traccia(val('grid-row'), K) }
  })
  const posti = K ? piazza(celle, K) : []
  const occ = new Set(posti.flatMap((p) => Array.from({ length: p.w * p.h }, (_, k) => `${p.r + Math.floor(k / p.w)},${p.c + (k % p.w)}`)))
  const righe = posti.reduce((m, p) => Math.max(m, p.r + p.h - 1), 0)
  let buchi = 0
  for (let r = 1; r <= righe; r++) for (let c = 1; c <= K; c++) if (!occ.has(`${r},${c}`)) buchi++
  return { K, posti, tt, righe, buchi, css, R }
}
const colonne = (v) => {
  const rep = /repeat\(\s*(\d+)\s*,/.exec(v ?? '')
  return rep ? Number(rep[1]) : v ? v.trim().split(/\s+/).length : 0
}
/** Le righe viste: quante tessere in ognuna. */
const perRiga = (posti) => {
  const m = new Map()
  for (const p of posti) m.set(p.r, (m.get(p.r) ?? 0) + 1)
  return [...m.keys()].sort((a, b) => a - b).map((k) => m.get(k))
}
const aspetto = (m) => risolvi(vince(m.R, 'aspect-ratio', (s) => /\.foto\b.*\bimg\b/.test(s) && !/quattro|citazioni/.test(s)) ?? '', m.css.V)

// --- Casi ---------------------------------------------------------------------
const img = (n, alt = `Foto ${n}`) => `<img src="/risorse/f${n}.webp" alt="${alt}">`
const ul = (vv) => `<ul>${vv.map(([a, b]) => `<li><strong>${a}</strong> ${b}</li>`).join('')}</ul>`
const NUM = (n) => ul(Array.from({ length: n }, (_, i) => [`${i + 1}0`, `cose ${i + 1}`]))
const SEZIONI = '<h2>Corsi</h2><h3>Judo</h3><p>Per tutti</p>'
const TRE = ul([['35+', 'anni di sport'], ['3', 'sedi'], ['12', 'corsi']])

console.log('\n1. Il collage c’è solo nella home che non è di legge (R1)')
{
  const testo = `<p>Benvenuti</p>${img(1)}${TRE}${SEZIONI}`
  const h = pag(testo)
  ok('home: la testata ha le tessere del collage (1 foto + 3 numeri)', [foto(h).length, numeri(h).length], [1, 3])
  const altra = pag(testo, { slug: 'chi-siamo' })
  ok('chi-siamo: nessuna tessera nella testata', tessere(hero(altra)).length, 0)
  ok('chi-siamo: l’introduzione resta com’è oggi, in una colonna .testo con la foto e l’elenco', main(altra).includes(`<div class="testo">${t.pulisciTesto ? t.pulisciTesto(`<p>Benvenuti</p>${img(1)}${TRE}`) : ''}</div>`), true)
  const legge = pag(testo, { diLegge: true })
  ok('home di legge: nessuna tessera nella testata', tessere(hero(legge)).length, 0)
  ok('home di legge: nessun collage nel markup', /class="[^"]*\bcollage\b/.test(legge), false)
  // La pagina di legge non si tocca: il suo testo resta tutto lì, foto e voci dell'elenco comprese, uguale a quello di un'altra pagina di legge.
  const leggeAltra = pag(testo, { slug: 'privacy', diLegge: true })
  ok('home di legge: il testo c’è tutto (foto e voci dell’elenco), come in un’altra pagina di legge', [main(legge) === main(leggeAltra), main(legge).includes('f1.webp'), conta(main(legge), /<li>/g)], [true, true, 3])
  const solo = '<p>Solo parole</p>' + SEZIONI
  ok('introduzione senza foto né elenco: il main della home è identico a quello di un’altra pagina (R13)', main(pag(solo)) === main(pag(solo, { slug: 'chi-siamo' })) && main(pag(solo)).includes('Solo parole'), true)
  ok('…e la testata non ha tessere', tessere(hero(pag(solo))).length, 0)
}

console.log('\n2. L’introduzione è il testo prima del primo h2 (R2, R6)')
{
  const h = pag(`<p>Primo paragrafo</p>${img(1)}${TRE}<h2>Corsi</h2>${NUM(3)}`)
  ok('l’elenco di numeri dopo il primo h2 non entra nella testata', numeri(h).length, 3)
  const sez = h.slice(h.indexOf('<section class="sezione"'))
  ok('…resta nella sezione come in PR 399: 3 tessere (non «numero»)', [tessere(sez).length, tessere(sez).some((x) => x.classi.includes('numero'))], [3, false])
  const dopo = pag(`<p>Intro</p><h2>Corsi</h2>${NUM(3)}${img(1)}`)
  ok('foto ed elenco solo dopo il primo h2: la testata non ha tessere', tessere(hero(dopo)).length, 0)
  const senzaH2 = pag(`<p>Tutto intro</p>${img(1)}${TRE}`)
  ok('senza h2 tutto il testo è introduzione: collage con 1 foto e 3 numeri', [foto(senzaH2).length, numeri(senzaH2).length], [1, 3])
  ok('i paragrafi restano in colonna SOTTO la testata', [hero(h).includes('Primo paragrafo'), dopoHero(h).includes('Primo paragrafo'), h.indexOf('</section>', h.indexOf('pagina-hero')) < h.indexOf('Primo paragrafo')], [false, true, true])
  ok('la frase sotto il titolo è la descrizione della pagina, non il paragrafo', [hero(h).includes(`<p>${FRASE}</p>`), /<div class="intro">[\s\S]*Primo paragrafo/.test(hero(h))], [true, false])
  ok('il collage sta nella testata, dopo il titolo', hero(h).indexOf('<h1>') >= 0 && hero(h).indexOf('<h1>') < hero(h).search(/<[a-z]+ class="[^"]*\b(collage|tessere)\b/), true)
  const vuota = pag(`${img(1)}${TRE}<h2>Corsi</h2><p>x</p>`)
  ok('introduzione fatta solo di foto ed elenco: nessun .testo vuoto', [/<div class="testo">\s*<\/div>/.test(vuota), foto(vuota).length, numeri(vuota).length], [false, 1, 3])
}

console.log('\n3. Le foto: ordine, la prima è grande, tetto 3, alt (R3, R7, R10)')
{
  const h = pag(`<p>Ciao</p>${img(1)}<p>${img(2, '')}</p>${img(3, 'Terza')}${img(4)}<p>Dopo</p>${TRE}${SEZIONI}`)
  const f = foto(h)
  ok('tre tessere foto, nell’ordine scritto, anche se separate da un paragrafo', f.map((x) => attr(x.html.match(/<img[^>]*>/)?.[0] ?? '', 'src')), ['/risorse/f1.webp', '/risorse/f2.webp', '/risorse/f3.webp'])
  ok('solo la prima è grande', f.map((x) => x.classi.includes('grande')), [true, false, false])
  ok('alt originali, anche quello vuoto', f.map((x) => attr(x.html.match(/<img[^>]*>/)?.[0] ?? '', 'alt')), ['Foto 1', '', 'Terza'])
  const testo = dopoHero(h).slice(0, dopoHero(h).indexOf('<section class="sezione"'))
  ok('la quarta foto resta in colonna (nel .testo) come scritta, nessun contenuto sparisce', [imgs(testo).length, imgs(testo)[0]?.includes('f4.webp'), testo.includes('Ciao'), testo.includes('Dopo')], [1, true, true, true])
  ok('i paragrafi dell’introduzione restano nell’ordine', testo.indexOf('Ciao') < testo.indexOf('Dopo'), true)
  ok('la foto dentro un paragrafo con del testo non è una tessera', foto(pag(`<p>Guarda <img src="/risorse/a.webp" alt="a"> qui</p>${TRE}`)).length, 0)
  ok('una foto sola: una tessera foto a tutta larghezza, in tessere n-1', (() => { const x = pag(img(1)); return [radice(hero(x)).includes('n-1'), foto(x).length, foto(x)[0]?.classi.includes('larga')] })(), [true, 1, true])
  const fuori = pag(`${img(1)}${SEZIONI.replace('<p>Per tutti</p>', '<p>Per tutti</p>' + img(9))}`)
  ok('una foto dopo il primo h2 non è nel collage', [foto(fuori).length, imgs(dopoHero(fuori)).length], [1, 1])
}

console.log('\n4. Le immagini di un host non dichiarato non entrano (invariante)')
{
  const ext = '<img src="https://tracker.example/p.png" alt="x">'
  const h = pag(`${ext}${img(1)}${img(2)}${TRE}`)
  ok('la foto esterna non diventa tessera: restano due foto, la prima è la locale grande', [foto(h).length, foto(h)[0]?.html.includes('f1.webp'), foto(h)[0]?.classi.includes('grande'), h.includes('tracker.example')], [2, true, true, false])
  const soloExt = pag(`${ext}${TRE}`)
  ok('con tutte le foto tolte il collage è solo numeri: tessere n-3, nessuna foto', [foto(soloExt).length, numeri(soloExt).length, radice(hero(soloExt)).includes('n-3'), radice(hero(soloExt)).includes('collage')], [0, 3, true, false])
  const dich = pag(`<img src="${P}a1.jpg" alt="d">${TRE}`, { ospiti: [P] })
  ok('un’immagine del contenitore dichiarato è una tessera foto', [foto(dich).length, dich.includes(`${P}a1.jpg`)], [1, true])
}

console.log('\n5. I numeri: un solo ul di 2–6 voci con il grassetto iniziale (R4, R5)')
{
  const h = pag(`<p>x</p>${TRE}${SEZIONI}`)
  const n = numeri(h)
  ok('3 tessere numero: cifra in grande, scritta piccola sotto', n.map((x) => [dentro(x.html, 'cifra'), dentro(x.html, 'scritta')]), [['35+', 'anni di sport'], ['3', 'sedi'], ['12', 'corsi']])
  ok('solo numeri: griglia tessere n-3 (non collage)', [radice(hero(h)).includes('tessere'), radice(hero(h)).includes('n-3'), /<li\b/.test(hero(h)), /<ul\b/.test(hero(h))], [true, true, false, false])
  ok('l’elenco non resta anche in colonna', /<ul\b/.test(dopoHero(h).slice(0, dopoHero(h).indexOf('<section class="sezione"'))), false)
  for (const k of [2, 6]) ok(`${k} voci: ${k} tessere numero`, numeri(pag(NUM(k))).length, k)
  for (const k of [1, 7]) {
    const x = pag(`<p>x</p>${NUM(k)}${SEZIONI}`)
    ok(`${k} voce/i: resta un elenco in colonna`, [numeri(x).length, conta(dopoHero(x), /<li>/g) >= k], [0, true])
  }
  const senza = pag(`<p>x</p><ul><li><strong>35+</strong> anni</li><li>senza grassetto</li><li><strong>3</strong> sedi</li></ul>`)
  ok('una voce senza grassetto iniziale: resta un elenco', [numeri(senza).length, conta(dopoHero(senza), /<li>/g)], [0, 3])
  const sporco = pag(`<ul><li>un <strong>35+</strong> anni</li><li><strong>3</strong> sedi</li></ul>`)
  ok('il grassetto non all’inizio non conta: resta un elenco', numeri(sporco).length, 0)
  const due = pag(`${NUM(3)}<p>in mezzo</p>${NUM(3)}`)
  ok('due elenchi nell’introduzione: restano elenchi', [numeri(due).length, conta(dopoHero(due), /<ul>/g)], [0, 2])
  const x = (k) => 'x'.repeat(k)
  ok('grassetto di 30 caratteri: normale; di 31: tessera «lunga»', [numeri(pag(ul([[x(30), 'a'], ['2', 'b']])))[0]?.classi.includes('lunga'), numeri(pag(ul([[x(31), 'a'], ['2', 'b']])))[0]?.classi.includes('lunga')], [false, true])
  ok('resto di 40 caratteri: normale; di 41: tessera «lunga»', [numeri(pag(ul([['1', x(40)], ['2', 'b']])))[0]?.classi.includes('lunga'), numeri(pag(ul([['1', x(41)], ['2', 'b']])))[0]?.classi.includes('lunga')], [false, true])
  const prova5 = pag(ul([['1 settimana di prova', 'in omaggio, senza impegno, quando vuoi tu'], ['3', 'sedi'], ['12', 'corsi']]))
  ok('una voce lunga resta tessera numero, le altre no «lunga»', numeri(prova5).map((y) => y.classi.includes('lunga')), [true, false, false])
  const lungaCss = cssDi(prova5)
  ok('la classe «lunga» ha una regola nel CSS (testo piccolo)', lungaCss.tuttoR.some((r) => r.sel.some((s) => /\.lunga\b/.test(s)) && /font-size/.test(Object.keys(r.dich).join())), true)
}

console.log('\n6. Colori dei numeri (R8) e nessun colore nuovo')
{
  for (const k of [2, 3, 4, 5, 6]) ok(`${k} numeri: blu, giallo, inchiostro, chiara a rotazione`, numeri(pag(NUM(k))).map(colore), Array.from({ length: k }, (_, i) => COLORI[i % 4]))
  const m = pag(`${img(1)}${img(2)}${NUM(5)}`)
  ok('5 numeri accanto alle foto: blu, giallo, inchiostro, chiara, blu (le foto non ruotano)', [numeri(m).map(colore), foto(m).map(colore)], [['blu', 'giallo', 'inchiostro', 'chiara', 'blu'], ['?', '?']])
  const due = pag(`${NUM(3)}<h2>Corsi</h2><h3>A</h3><p>a</p><h3>B</h3><p>b</p>`)
  ok('la sezione sotto riparte da blu', colore(tessere(due.slice(due.indexOf('<section class="sezione"')))[0] ?? { classi: [] }), 'blu')
  const css = cssDi(pag(`${img(1)}${NUM(4)}`))
  const usati = [...new Set([...stile(pag(`${img(1)}${NUM(4)}`)).matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map((x) => hex(x[0].toLowerCase()) ?? x[0].toLowerCase()))]
  ok('nessun colore nuovo nel CSS', usati.filter((c) => ![FONDO, INCHIOSTRO, BLU, CHIARA, GIALLO, BIANCO].includes(c)), [])
  const coppie = css.tuttoR.filter((r) => r.sel.some((s) => /\.tessera\b|\.numero\b|\.cifra\b|\.scritta\b/.test(s))).map((r) => [hex(risolvi(r.dich.background ?? r.dich['background-color'], css.V) ?? ''), hex(risolvi(r.dich.color, css.V) ?? '')]).filter(([a, b]) => a && b)
  ok('ogni coppia sfondo/testo delle tessere è ≥ 4,5:1', coppie.filter(([a, b]) => contrasto(a, b) < 4.5), [])
}

console.log('\n7. «35+ anni di sport» è testo, non titolo (R9)')
{
  const h = pag(`${img(1)}${TRE}${SEZIONI}`)
  const e = hero(h)
  ok('nessun aria-hidden e nessun <br> nella testata', [/aria-hidden/.test(e), /<br/i.test(e)], [false, false])
  ok('un solo h1 e nessun altro titolo nella testata', [conta(e, /<h1[\s>]/g), conta(e, /<h[2-6][\s>]/g)], [1, 0])
  ok('la tessera si legge come una frase unica', testoDi(numeri(h)[0]?.html ?? '').startsWith('35+ anni di sport'), true)
  ok('la cifra non è un titolo', numeri(h).length === 3 && numeri(h).every((x) => !/<h[1-6]/.test(x.html)), true)
}

console.log('\n8. Gli attributi li mette il generatore, dopo la pulizia (R11)')
{
  const sporca = (n, extra) => `<img src="/risorse/f${n}.webp" alt="F${n}" ${extra}>`
  const h = pag(sporca(1, 'loading="lazy" fetchpriority="low" onerror="x()"') + sporca(2, 'loading="eager" fetchpriority="high" decoding="sync"') + sporca(3, 'onload="y()"') + sporca(4, 'loading="lazy" fetchpriority="high"') + TRE + `<h2>S</h2>${sporca(5, 'loading="lazy"')}`)
  const col = imgs(hero(h))
  ok('tre foto nel collage', col.length, 3)
  ok('la prima: fetchpriority="high" e decoding="async", mai loading', [attr(col[0], 'fetchpriority'), attr(col[0], 'decoding'), attr(col[0], 'loading')], ['high', 'async', undefined])
  ok('la seconda e la terza: loading="lazy" e decoding="async", niente fetchpriority', [1, 2].map((i) => [attr(col[i], 'loading'), attr(col[i], 'decoding'), attr(col[i], 'fetchpriority')]), [['lazy', 'async', undefined], ['lazy', 'async', undefined]])
  ok('ogni attributo una volta sola per foto', col.map((c) => ['loading', 'fetchpriority', 'decoding'].map((a) => conta(c, new RegExp(`\\s${a}=`, 'g'))).join()), ['0,1,1', '1,0,1', '1,0,1'])
  ok('nessun onerror né onload scritto a mano arriva alla pagina', /\son(error|load|click)\s*=/i.test(h), false)
  const fuori = imgs(dopoHero(h))
  ok('la quarta foto (in colonna) e quella delle sezioni non cambiano: niente loading, fetchpriority, decoding', fuori.map((c) => ['loading', 'fetchpriority', 'decoding'].map((a) => attr(c, a))), fuori.map(() => [undefined, undefined, undefined]))
  ok('le foto fuori dal collage sono due', fuori.length, 2)
}

console.log('\n9. Contattaci e prezzo (R12)')
{
  const testo = `${img(1)}${TRE}${SEZIONI}`
  const senza = pag(testo)
  ok('senza la pagina contatti: nessun pulsante «Contattaci» né /contatti/ nella testata', /Contattaci|\/contatti\//.test(hero(senza)), false)
  const con = pag(testo, { contatti: true })
  ok('con la pagina contatti: un solo pulsante verso /contatti/, fuori dalle tessere', [conta(hero(con), /<a class="pulsante" href="\/contatti\/">Contattaci<\/a>/g), tessere(hero(con)).some((x) => /pulsante/.test(x.html))], [1, false])
  ok('«5 €» non compare se non lo scrive la segreteria', [/5\s*€|€/.test(hero(con)), testoDi(hero(con)).includes('prova')], [false, false])
  const scritto = pag(ul([['1 settimana', 'di prova: 5 €'], ['3', 'sedi']]))
  ok('se la segreteria lo scrive in una voce, compare una volta sola', [conta(testoDi(hero(scritto)), /5 €/g), numeri(scritto).length], [1, 2])
}

console.log('\n10. Testo ostile esce ripulito')
{
  const h = pag(`<script>alert(1)</script><p class="collage" onclick="x()">Ciao</p><img src="javascript:alert(1)" alt="j"><div class="tessera blu numero">falso</div><ul class="numeri"><li><strong onclick="y()">1</strong> a</li><li><strong>2</strong> b</li></ul>${SEZIONI}`)
  ok('niente script, onclick o javascript:', [/<script/i.test(senzaDati(h)), /\son[a-z]+\s*=/i.test(main(h)), /javascript:/i.test(h)], [false, false, false])
  ok('la classe «collage» della segreteria non sopravvive', /class="[^"]*\bcollage\b/.test(main(h)), false)
  ok('la classe «tessera numero» scritta a mano non crea tessere: solo le due vere', numeri(h).length, 2)
  ok('le due vere sono blu e giallo', numeri(h).map(colore), ['blu', 'giallo'])
}

console.log('\n11. Il CSS sul desktop (R13, R14)')
{
  for (const k of [2, 3, 4, 5, 6]) {
    const m = mappa(pag(NUM(k)), false)
    const attese = { 2: [2], 3: [3], 4: [2, 2], 5: [3, 2], 6: [3, 3] }[k]
    ok(`solo ${k} numeri: griglia a 6 colonne, righe di ${attese.join('+')}, piene`, [m.K, perRiga(m.posti), m.buchi], [6, attese, 0])
  }
  const una = mappa(pag(img(1)), false)
  ok('una sola foto: tutta la larghezza (6 colonne) e aspect-ratio 3/2', [una.K, una.posti.map((p) => p.w), /^3\s*\/\s*2$/.test(aspetto(una))], [6, [6], true])
  for (const f of [1, 3]) {
    for (const k of [2, 3, 4, 5, 6]) {
      const h = pag(Array.from({ length: f }, (_, i) => img(i + 1)).join('') + NUM(k))
      const m = mappa(h, false)
      const nn = m.tt.map((x, i) => ({ x, p: m.posti[i] })).filter((y) => y.x.classi.includes('numero')).map((y) => y.p)
      const ff = m.tt.map((x, i) => ({ x, p: m.posti[i] })).filter((y) => y.x.classi.includes('foto')).map((y) => y.p)
      const nome = `${f} foto + ${k} numeri, desktop`
      ok(`${nome}: 6 colonne, e la foto grande copre 4 colonne × 3 righe, in alto a sinistra`, [m.K, ff[0] && [ff[0].c, ff[0].r, ff[0].w, ff[0].h]], [6, [1, 1, 4, 3]])
      ok(`${nome}: i numeri sono tessere da 2 colonne, il primo accanto alla foto`, [nn.length === k && nn.every((p) => p.w === 2), nn[0] && [nn[0].c, nn[0].r]], [true, [5, 1]])
      if (f === 3) {
        const fondo = Math.max(...nn.map((p) => p.r + p.h - 1))
        ok(`${nome}: seconda e terza foto in una fila sola, in fondo sotto tutto`, [ff[1]?.r === ff[2]?.r, ff[1]?.r > fondo, ff[1]?.r >= 4, ff[1]?.w + ff[2]?.w], [true, true, true, 6])
      }
    }
  }
}

console.log('\n12. Il CSS sotto i 900px (R15)')
{
  for (const k of [2, 3, 4, 5, 6]) {
    const m = mappa(pag(NUM(k)), true)
    ok(`solo ${k} numeri sul telefono: 2 colonne, ${k % 2 ? 'l’ultimo a due colonne' : 'tutti da una colonna'}, senza buchi`, [m.K, m.posti.map((p) => p.w), m.buchi], [2, m.posti.map((_, i) => (k % 2 && i === k - 1 ? 2 : 1)), 0])
  }
  for (const f of [1, 3]) {
    for (const k of [2, 3, 4, 5, 6]) {
      const m = mappa(pag(Array.from({ length: f }, (_, i) => img(i + 1)).join('') + NUM(k)), true)
      const nn = m.tt.map((x, i) => ({ x, p: m.posti[i] })).filter((y) => y.x.classi.includes('numero')).map((y) => y.p)
      const ff = m.tt.map((x, i) => ({ x, p: m.posti[i] })).filter((y) => y.x.classi.includes('foto')).map((y) => y.p)
      const nome = `${f} foto + ${k} numeri, telefono`
      ok(`${nome}: collage a 2 colonne, foto a tutta larghezza e una riga sola`, [m.K, ff.map((p) => [p.w, p.h])], [2, Array.from({ length: f }, () => [2, 1])])
      ok(`${nome}: numeri a una colonna (l’ultimo a due se dispari), senza buchi`, [nn.map((p) => p.w), m.buchi], [Array.from({ length: k }, (_, i) => (k % 2 && i === k - 1 ? 2 : 1)), 0])
      ok(`${nome}: foto con aspect-ratio 3/2`, /^3\s*\/\s*2$/.test(aspetto(m)), true)
    }
  }
}

{
  const media = blocco(stile(pag(img(1) + NUM(3))), '@media (max-width:900px)')
  const ordini = regole(media?.dentro ?? '').filter((r) => r.sel.some((x) => /\.collage\b.*\.foto\b/.test(x)) && 'order' in r.dich).map((r) => Number(r.dich.order))
  ok('sul telefono le foto del collage vengono dopo i numeri (order maggiore di 0)', ordini.length > 0 && ordini.every((o) => o > 0), true)
}

console.log('\n13. Stessi dati, stessi file; testi strani non rompono')
{
  const testo = `<p>Intro</p>${img(1)}${img(2)}${TRE}${SEZIONI}`
  const a = JSON.stringify(gen(testo)), b = JSON.stringify(gen(testo))
  ok('stessi dati due volte: file identici, con il collage', [a === b, /tessera [a-z]+ numero/.test(a)], [true, true])
  for (const strano of ['<h2></h2><p>x</p>', '<ul></ul><h2>S</h2>', `${img(1)}<ul></ul>${TRE}<h2></h2>`, '<ul><li></li><li></li></ul>', '<ul><li><strong></strong></li><li><strong></strong></li></ul>']) {
    ok(`si genera: ${strano.slice(0, 40)}`, pag(strano).includes('</html>'), true)
  }
  ok('una voce con grassetto vuoto non crea una cifra vuota: l’elenco resta elenco (R5)', (() => { const h = pag('<ul><li><strong></strong> a</li><li><strong>2</strong> b</li></ul>'); return [numeri(h).length, /<ul/.test(dopoHero(h) + h)] })(), [0, true])
}

console.log('\n14. Niente di nuovo fuori dal generatore')
{
  const base = ['main', 'origin/main'].find((r) => { try { execSync(`git rev-parse --verify --quiet ${r}`, { stdio: 'ignore' }); return true } catch { return false } })
  if (!base) console.log('  (nessun `main` in questo checkout: confronto saltato; in locale e nelle PR si fa)')
  else {
    const dip = (j) => JSON.stringify({ d: j.dependencies, v: j.devDependencies })
    const prima = JSON.parse(execSync(`git show ${base}:package.json`, { encoding: 'utf8' }))
    ok('nessuna dipendenza nuova', dip(JSON.parse(readFileSync('package.json', 'utf8'))), dip(prima))
    const toccati = execSync(`git diff --name-only ${base} -- src/lib/sito.ts src/lib/sitoPagine.ts src/lib/sitoTesto.ts src/lib/sitoImmagini.ts supabase`, { encoding: 'utf8' }).trim()
    ok('il pannello (sito.ts, sitoPagine.ts, sitoTesto.ts, sitoImmagini.ts) e supabase/ non cambiano', toccati, '')
  }
}

console.log('\n15. Il testo della Home in docs/sito/home.html fa il collage del design')
{
  const html = readFileSync('docs/sito/home.html', 'utf8').replace(/^<!doctype[^>]*>\s*<meta[^>]*>\s*<title>.*?<\/title>\s*/s, '')
  const md = readFileSync('docs/sito/home.md', 'utf8')
  const titolo = md.match(/## Titolo\s+(.+)/)?.[1] ?? ''
  const frase = md.match(/## Descrizione\s+(.+)/)?.[1] ?? ''
  const h = (() => { const r = prova(() => g.generaSito({ dominio: DOMINIO, pagine: [{ slug: 'home', titolo, descrizione: frase, testo: html }], menu: [], rinvii: [], ospitiImmagini: ['https://qfejpnkryrvjubcxvuco.supabase.co/storage/v1/object/public/sito/'] })); return r?.['index.html'] ?? '' })()
  const e = hero(h)
  ok('il titolo è breve e sta nella testata', [titolo.length < 30, e.includes(`<h1>${titolo}</h1>`)], [true, true])
  ok('la frase della descrizione sta nella testata', e.includes(frase), true)
  ok('3 foto nel collage, la prima grande', [conta(e, /<figure class="tessera foto/g), /<figure class="tessera foto grande/.test(e)], [3, true])
  ok('5 numeri nel collage', conta(e, /tessera [a-z]+ numero/g), 5)
  ok('le foto e l’elenco dei numeri non restano sotto la testata', [/<img/.test(dopoHero(h).split('<h2')[0]), /<ul/.test(dopoHero(h).split('<h2')[0])], [false, false])
  ok('tutte e 9 le righe dei corsi diventano tessere', conta(dopoHero(h), /<a href="\/[a-z-]+\/">/g) >= 9, true)
}

console.log(guai ? `\n✗ ${guai} casi falliti` : '\nTutto a posto.')
process.exit(guai ? 1 : 0)
