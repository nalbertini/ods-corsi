// ---------------------------------------------------------------------------
// Il sito a tessere (design A2), senza browser.
//
//   node scripts/prova-sito-tessere.mjs
//
// Si passa sempre da `generaSito` (src/lib/sitoGenera.ts): la prova non sa in
// quale file stia il layout. Sa invece i nomi del markup, che sono il patto fra
// prova e codice:
//
//   <section class="sezione">            una per ogni <h2>, col suo <h2>
//     <div class="colonna">…</div>       paragrafi e liste lunghe, in colonna
//     <div class="tessere n-N">          N tessere (griglia a filo, gap 6px)
//       <article class="tessera blu|giallo|inchiostro|chiara [citazione] [larga]">
//     <div class="citazioni" tabindex="0" role="region" aria-label="…">  scorrimento
//     <figure class="tessera foto [larga]">; tre foto: <div class="foto-fila">
//     <p class="firma">                  ultima riga di una citazione
//
// Il CSS si legge come testo (come in prova-sito-aspetto): la griglia si
// ricostruisce dalle regole `.tessere`, `.n-N`, `.tessera` con grid-template-columns
// e grid-column, e si controllano righe e larghezze, non i nomi dei token.
// ---------------------------------------------------------------------------
import { build } from 'esbuild'

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
const dati = (testo, extra = {}) => ({
  dominio: DOMINIO,
  pagine: [
    { slug: 'home', titolo: 'Home', descrizione: 'd', testo: '<p>Home</p>' },
    { slug: 'judo', titolo: 'Judo', descrizione: 'd', testo, ...extra },
    { slug: 'privacy', titolo: 'Privacy', descrizione: '', testo, diLegge: true },
  ],
  menu: [],
  rinvii: [],
})
const sito = (testo, extra) => {
  const r = prova(() => g.generaSito(dati(testo, extra)))
  return typeof r === 'object' && r !== null ? r : {}
}
const pagina = (testo, extra) => sito(testo, extra)['judo/index.html'] ?? ''
const main = (h) => h.match(/<main>([\s\S]*)<\/main>/)?.[1] ?? ''
const conta = (x, re) => (x.match(re) || []).length

// --- Il markup come dati ----------------------------------------------------
const sezioni = (h) => [...h.matchAll(/<section class="[^"]*\bsezione\b[^"]*"[^>]*>[\s\S]*?<\/section>/g)].map((m) => m[0])
const INIZIO = /<[a-z0-9]+\b[^>]*\bclass="[^"]*\btessera\b[^"]*"[^>]*>/g
/** Le tessere di un pezzo di markup: classi e contenuto (fino alla tessera dopo). */
const tessere = (h) => {
  const m = [...h.matchAll(INIZIO)]
  return m.map((x, i) => ({ classi: (x[0].match(/class="([^"]*)"/)?.[1] ?? '').split(/\s+/), html: h.slice(x.index, m[i + 1]?.index ?? h.length) }))
}
const colore = (tt) => ['blu', 'giallo', 'inchiostro', 'chiara'].find((c) => tt.classi.includes(c)) ?? '?'
const testoDi = (h) => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

// --- Il CSS come dati (le stesse mosse di prova-sito-aspetto) -----------------
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
const TINTE = { blu: BLU, giallo: GIALLO, inchiostro: INCHIOSTRO, chiara: CHIARA }
const SUL = { blu: BIANCO, giallo: INCHIOSTRO, inchiostro: BIANCO, chiara: INCHIOSTRO }
const ROTAZIONE = ['blu', 'giallo', 'inchiostro', 'chiara']

/** CSS di una pagina: base (senza i @media ≤900px), telefono (solo quei @media), tutto, e le variabili. */
const cssDi = (h) => {
  const tutto = stile(h)
  let base = tutto
  let tel = ''
  for (let b = blocco(base, '@media (max-width:900px)'); b; b = blocco(base, '@media (max-width:900px)')) { tel += b.dentro; base = b.senza }
  const R = regole(base)
  const V = Object.assign({}, ...R.filter((r) => r.sel.includes(':root')).map((r) => r.dich))
  return { tutto, base: R, tel: regole(tel), V, tuttoR: regole(tutto) }
}

const unaDichiarazione = (R, V, quale) => {
  const fuori = {}
  for (const r of R) if (r.sel.some(quale)) for (const [k, v] of Object.entries(r.dich)) fuori[k] = risolvi(v, V)
  return fuori
}
const sfondoDi = (d) => hex(d.background ?? d['background-color'] ?? '')
/** Il selettore che parla di tessere di quel colore (".tessera.blu", ".blu", ".tessera.blu a"…): ultima parte senza pseudo. */
const dellaTinta = (c, extra = (x) => true) => (x) => new RegExp(`\\.${c}\\b`).test(x) && extra(x)

// --- La griglia: righe e larghezze dal CSS ------------------------------------
const parti = (sel) => sel.split(/[\s>]+/).filter(Boolean)
const pseudoOk = (comp, i, n) => {
  for (const [, tipo, arg] of comp.matchAll(/:(first-child|last-child|nth-child|nth-last-child)(?:\(([^)]*)\))?/g)) {
    if (tipo === 'first-child' && i !== 1) return false
    if (tipo === 'last-child' && i !== n) return false
    if (tipo === 'nth-child' && !(arg === 'odd' ? i % 2 === 1 : arg === 'even' ? i % 2 === 0 : Number(arg) === i)) return false
    if (tipo === 'nth-last-child' && Number(arg) !== n - i + 1) return false
  }
  return !/:(?!first-child|last-child|nth-child|nth-last-child|not)/.test(comp.replace(/\([^)]*\)/g, ''))
}
const nDi = (comp) => comp.match(/\.n-(\d+)/)?.[1]
/** La regola vale per il contenitore di N tessere? (ultima parte `.tessere`, e se ha `.n-x` deve essere N.) */
// Le griglie della testata (`.pagina-hero …`) hanno la loro prova in prova-sito-collage: qui contano solo quelle delle sezioni.
const delContenitore = (sel, n) => {
  if (/\.pagina-hero/.test(sel)) return false
  const p = parti(sel)
  const ultima = p[p.length - 1]
  if (!/\.tessere\b/.test(ultima) || /:/.test(ultima.replace(/\([^)]*\)/g, ''))) return false
  return p.every((c) => nDi(c) === undefined || nDi(c) === String(n))
}
const dellaTessera = (sel, i, n, N) => {
  if (/\.pagina-hero/.test(sel)) return false
  const p = parti(sel)
  const ultima = p[p.length - 1]
  if (!/\.tessera\b/.test(ultima)) return false
  return p.every((c) => nDi(c) === undefined || nDi(c) === String(N)) && pseudoOk(ultima, i, n)
}
const colonne = (v) => {
  const rep = /repeat\(\s*(\d+)\s*,/.exec(v ?? '')
  return rep ? Number(rep[1]) : v ? v.trim().split(/\s+/).length : 0
}
const larga = (v, K) => {
  const s = /span\s+(\d+)/.exec(v ?? '')
  if (s) return Number(s[1])
  const r = /(-?\d+)\s*\/\s*(-?\d+)/.exec(v ?? '')
  if (r) { const a = Number(r[1]), b = Number(r[2]); return (b < 0 ? K + 2 + b : b) - (a < 0 ? K + 2 + a : a) }
  return 1
}
/** Le righe (quante tessere ognuna) e se rimangono buchi, per N tessere; `telefono` aggiunge le regole dei @media. */
const griglia = (css, N, telefono) => {
  const R = telefono ? [...css.base, ...css.tel] : css.base
  let K = 0
  for (const r of R) for (const s of r.sel) if (delContenitore(s, N) && r.dich['grid-template-columns']) K = colonne(risolvi(r.dich['grid-template-columns'], css.V))
  const spans = []
  for (let i = 1; i <= N; i++) {
    let v
    for (const r of R) for (const s of r.sel) if (dellaTessera(s, i, N, N) && r.dich['grid-column']) v = risolvi(r.dich['grid-column'], css.V)
    spans.push(K ? Math.min(larga(v, K), K) : 1)
  }
  if (!K) return { K, righe: 'nessuna griglia', pieno: false }
  const righe = [[]]
  let usato = 0
  for (const s of spans) {
    if (usato + s > K) { righe.push([]); usato = 0 }
    righe[righe.length - 1].push(s)
    usato += s
  }
  return { K, righe: righe.map((r) => r.length), pieno: righe.every((r) => r.reduce((a, b) => a + b, 0) === K) }
}

// ---------------------------------------------------------------------------
const h3 = (n, mezzo = (i) => `<p>Testo ${i}</p>`) => Array.from({ length: n }, (_, i) => `<h3>Titolo ${i + 1}</h3>${mezzo(i + 1)}`).join('')
const CONTA = (n) => `<h2>Sezione</h2>${h3(n)}`

console.log('\n1. Pagine di legge e pagine senza h2: come oggi')
{
  const testo = '<p>Intro</p><h2>Uno</h2><h3>A</h3><p>a</p><h3>B</h3><p>b</p><ul><li>x</li><li>y</li></ul>'
  const puro = t.pulisciTesto ? t.pulisciTesto(testo) : testo
  const leg = main(sito(testo)['privacy/index.html'] ?? '')
  ok('pagina di legge: il testo sta tutto in una colonna .testo, uguale a oggi', leg.includes(`<div class="testo">${puro}</div>`), true)
  ok('pagina di legge: nessuna classe di tessera o di sezione', /class="[^"]*\b(tessera|tessere|sezione|colonna)\b/.test(leg), false)
  const senzaH2 = '<p>Intro</p><h3>A</h3><p>a</p><ul><li>x</li><li>y</li><li>z</li></ul>'
  const p = main(pagina(senzaH2))
  ok('senza h2: il testo sta tutto in una colonna .testo, uguale a oggi', p.includes(`<div class="testo">${t.pulisciTesto ? t.pulisciTesto(senzaH2) : senzaH2}</div>`), true)
  ok('senza h2: nessuna classe di tessera o di sezione', /class="[^"]*\b(tessera|tessere|sezione|colonna)\b/.test(p), false)
  ok('con h2 (pagina non di legge) il layout c’è: almeno una sezione', sezioni(pagina(testo)).length, 1)
}

console.log('\n2. Due h2 = due sezioni, titolo grande, un solo h1')
{
  const h = pagina('<p>Benvenuti</p><h2>Primo</h2><p>uno</p><h2>Secondo</h2><p>due</p>')
  const sz = sezioni(h)
  ok('due sezioni', sz.length, 2)
  ok('ognuna col suo h2', sz.map((s) => s.match(/<h2[^>]*>([^<]*)<\/h2>/)?.[1]), ['Primo', 'Secondo'])
  ok('un solo h1 nella pagina', conta(h, /<h1[\s>]/g), 1)
  const i = h.indexOf('Benvenuti')
  ok('l’introduzione sta in colonna .testo, prima della prima sezione', [i > 0, /<div class="testo">[^]*Benvenuti/.test(h.slice(0, h.search(/class="[^"]*\bsezione\b/) + 1)), i < h.search(/class="[^"]*\bsezione\b/)], [true, true, true])
  const css = cssDi(h)
  const t2 = unaDichiarazione(css.base, css.V, (x) => /(^|\s)\.sezione h2$|^\.sezione>h2$|^\.sezione \.titolo$/.test(x))
  const max = Math.max(0, ...[...(t2['font-size'] ?? '').matchAll(/(\d+(?:\.\d+)?)px/g)].map((m) => Number(m[1])))
  ok('il titolo di sezione è grande (fino a 100px o più), in maiuscolo, col font display', [max >= 100, t2['text-transform'], /big shoulders display|--display/i.test(css.base.filter((r) => r.sel.some((x) => /\.sezione h2/.test(x))).map((r) => r.dich['font-family'] ?? '').join()) || /big shoulders display/.test(t2['font-family'] ?? '')], [true, 'uppercase', true])
}

console.log('\n3. Un h2 con N h3 = N tessere, a filo, senza celle vuote')
{
  const attese = { 1: [1], 2: [2], 3: [3], 4: [2, 2], 5: [3, 2], 6: [3, 3], 7: [3, 3, 1] }
  for (let n = 1; n <= 7; n++) {
    const h = pagina(CONTA(n))
    const tt = tessere(sezioni(h)[0] ?? '')
    const css = cssDi(h)
    const grid = griglia(css, n, false)
    ok(`${n} h3: ${n} tessere, nel contenitore .tessere.n-${n}`, [tt.length, new RegExp(`class="[^"]*\\btessere\\b[^"]*\\bn-${n}\\b|class="[^"]*\\bn-${n}\\b[^"]*\\btessere\\b`).test(h)], [n, true])
    ok(`${n} h3: righe di ${attese[n].join('+')} tessere, ogni riga piena`, [grid.righe, grid.pieno], [attese[n], true])
    const tel = griglia(css, n, true)
    ok(`${n} h3: sul telefono (≤900px) una colonna`, [tel.K, tel.righe.length === n], [1, true])
  }
  // Da 8 a 16 tessere: l'ultima riga si allarga e non resta nessun buco. Oltre le 16 si fanno più griglie, ognuna piena.
  for (let n = 8; n <= 16; n++) {
    const h = pagina(CONTA(n))
    const attese = Array(Math.floor(n / 3)).fill(3).concat(n % 3 ? [n % 3] : [])
    const grid = griglia(cssDi(h), n, false)
    ok(`${n} h3: righe di ${attese.join('+')} tessere, ogni riga piena`, [grid.righe, grid.pieno], [attese, true])
  }
  {
    const h = pagina(CONTA(17))
    ok('17 h3: più griglie (12 + 5), 17 tessere in tutto, ognuna piena', [conta(h, /class="tessere n-12"/g), conta(h, /class="tessere n-5"/g), tessere(sezioni(h)[0] ?? '').length], [1, 1, 17])
  }
  const css = cssDi(pagina(CONTA(3)))
  const gap = unaDichiarazione(css.base, css.V, (x) => /\.tessere\b/.test(x))
  ok('griglia a filo: gap di 6px', [gap.gap, gap['column-gap']].some((v) => /^6px( 6px)?$/.test(v ?? '')), true)
  const pt = tessere(sezioni(pagina('<h2>S</h2><h3>A</h3><p>dentro</p><h3>B</h3><p>ultimo</p><p>coda</p>'))[0] ?? '')
  ok('il paragrafo dopo l’ultimo h3 sta dentro l’ultima tessera', [pt.length, testoDi(pt[1]?.html ?? '').includes('coda'), testoDi(pt[0]?.html ?? '').includes('coda')], [2, true, false])
}

console.log('\n4. Colori a rotazione, domande chiare, contrasto')
{
  for (const n of [1, 2, 3, 4, 5, 6, 7]) ok(`${n} tessere: ${n === 4 ? 'giallo, blu, inchiostro, giallo (i quattro valori del design)' : 'blu, giallo, inchiostro, chiara a rotazione'}`, tessere(sezioni(pagina(CONTA(n)))[0] ?? '').map(colore), n === 4 ? ['giallo', 'blu', 'inchiostro', 'giallo'] : Array.from({ length: n }, (_, i) => ROTAZIONE[i % 4]))
  const due = pagina(`<h2>Uno</h2>${h3(3)}<h2>Due</h2>${h3(2)}`)
  ok('a ogni sezione si riparte da blu', sezioni(due).map((s) => colore(tessere(s)[0] ?? { classi: [] })), ['blu', 'blu'])
  const dom = pagina('<h2>Domande</h2><h3>Quanto costa?</h3><p>a</p><h3>Serve il certificato?</h3><p>b</p><h3>Si può provare?</h3><p>c</p><h3>Da che età?</h3><p>d</p>')
  ok('sezione di domande: tutte le tessere chiare', tessere(sezioni(dom)[0] ?? '').map(colore), ['chiara', 'chiara', 'chiara', 'chiara'])
  const mista = pagina('<h2>Misto</h2><h3>Quanto costa?</h3><p>a</p><h3>Le sedi</h3><p>b</p>')
  ok('se un solo h3 non è una domanda, si ruota come al solito', tessere(sezioni(mista)[0] ?? '').map(colore), ['blu', 'giallo'])
  const css = cssDi(pagina(CONTA(4)))
  for (const c of ROTAZIONE) {
    const d = unaDichiarazione(css.base, css.V, (x) => /\.tessera\b/.test(x) && dellaTinta(c, (y) => !/pillola/.test(y) && !/a\b|:focus|:hover|pulsante|\bh3\b/.test(y.replace(/\.[\w-]+/g, '')))(x))
    ok(`.${c}: sfondo ${TINTE[c]} e testo ${SUL[c]}`, [sfondoDi(d), hex(d.color ?? '')], [TINTE[c], SUL[c]])
    ok(`.${c}: contrasto ≥ 4,5:1`, sfondoDi(d) && hex(d.color ?? '') ? contrasto(sfondoDi(d), hex(d.color)) >= 4.5 : 'coppia non trovata', true)
  }
}

console.log('\n5. Focus, link e pulsanti nelle tessere')
{
  const css = cssDi(pagina(CONTA(4)))
  const fv = (c) => unaDichiarazione(css.base, css.V, (x) => /:focus-visible/.test(x) && /\.tessera\b|\.tessere\b/.test(x) && dellaTinta(c)(x))
  const cont = (d) => hex((/#[0-9a-f]{6}/.exec(d['outline-color'] ?? d.outline ?? '') || [''])[0])
  ok('tessere blu e inchiostro: contorno giallo al focus da tastiera', [cont(fv('blu')), cont(fv('inchiostro'))], [GIALLO, GIALLO])
  ok('tessere gialle e chiare: contorno inchiostro', [cont(fv('giallo')), cont(fv('chiara'))], [INCHIOSTRO, INCHIOSTRO])
  const link = unaDichiarazione(css.base, css.V, (x) => !/\bh3\b/.test(x) && (/\.tessera\b[^,]*\ba$/.test(x) || /\.tessera a$/.test(x)))
  ok('link nelle tessere: sottolineati e col colore del testo', [/underline/.test(link['text-decoration'] ?? link['text-decoration-line'] ?? ''), /inherit|currentcolor/.test(link.color ?? '')], [true, true])
  const pul = (c) => unaDichiarazione(css.base, css.V, (x) => /pulsante/.test(x) && !/:hover|:focus/.test(x) && /\.tessera\b/.test(x) && dellaTinta(c)(x))
  ok('a.pulsante su tessera blu e inchiostro: giallo con inchiostro', ['blu', 'inchiostro'].map((c) => [sfondoDi(pul(c)), hex(pul(c).color ?? '')]), [[GIALLO, INCHIOSTRO], [GIALLO, INCHIOSTRO]])
  ok('a.pulsante su tessera gialla e chiara: inchiostro con bianco', ['giallo', 'chiara'].map((c) => [sfondoDi(pul(c)), hex(pul(c).color ?? '')]), [[INCHIOSTRO, BIANCO], [INCHIOSTRO, BIANCO]])
  const h = pagina('<h2>S</h2><h3>A</h3><p><a class="pulsante" href="/contatti/">Scrivici</a></p>')
  ok('il pulsante della segreteria resta, dentro la tessera', /<a class="pulsante" href="\/contatti\/">Scrivici<\/a>/.test(tessere(sezioni(h)[0] ?? '')[0]?.html ?? ''), true)
}

console.log('\n6. h2 senza h3: paragrafi in colonna, elenchi corti a tessere')
{
  const p = sezioni(pagina('<h2>Chi siamo</h2><p>Uno</p><p>Due</p>'))[0] ?? ''
  ok('solo paragrafi: in colonna, nessuna tessera', [/class="[^"]*\bcolonna\b/.test(p), tessere(p).length, conta(p, /<p>/g)], [true, 0, 2])
  const voci = (n, f = (i) => `<strong>Voce ${i}</strong> descrizione ${i}`) => Array.from({ length: n }, (_, i) => `<li>${f(i + 1)}</li>`).join('')
  const ul3 = sezioni(pagina(`<h2>Corsi</h2><ul>${voci(3)}</ul>`))[0] ?? ''
  const t3 = tessere(ul3)
  ok('ul di 3 voci = 3 tessere, niente <li>', [t3.length, /<li/.test(ul3)], [3, false])
  ok('il grassetto iniziale è il titolo della tessera, il resto il testo', [/<h3[^>]*>\s*Voce 1\s*<\/h3>/.test(t3[0]?.html ?? '') || /class="titolo"[^>]*>\s*Voce 1\s*</.test(t3[0]?.html ?? ''), testoDi(t3[0]?.html ?? '').includes('descrizione 1')], [true, true])
  for (const [n, tess] of [[2, 2], [12, 12]]) ok(`ul di ${n} voci = ${tess} tessere`, tessere(sezioni(pagina(`<h2>S</h2><ul>${voci(n)}</ul>`))[0] ?? '').length, tess)
  const l13 = sezioni(pagina(`<h2>S</h2><ul>${voci(13)}</ul>`))[0] ?? ''
  ok('ul di 13 voci resta un elenco', [tessere(l13).length, conta(l13, /<li>/g)], [0, 13])
  const l1 = sezioni(pagina(`<h2>S</h2><ul>${voci(1)}</ul>`))[0] ?? ''
  ok('ul di 1 voce resta un elenco', [tessere(l1).length, conta(l1, /<li>/g)], [0, 1])
  const lungo = sezioni(pagina(`<h2>S</h2><ul>${voci(3, (i) => (i === 2 ? '<strong>Lunga</strong> ' + 'x'.repeat(250) : `<strong>V${i}</strong> ok`))}</ul>`))[0] ?? ''
  ok('ul con una voce oltre i 200 caratteri resta un elenco', [tessere(lungo).length, conta(lungo, /<li>/g)], [0, 3])
  const x = (n) => 'x'.repeat(n)
  const dueCentonovantotto = sezioni(pagina(`<h2>S</h2><ul>${voci(3, (i) => `<strong>T</strong> ${x(198)}`)}</ul>`))[0] ?? ''
  const dueUno = sezioni(pagina(`<h2>S</h2><ul>${voci(3, (i) => `<strong>T</strong> ${x(199)}`)}</ul>`))[0] ?? ''
  ok('una voce di 200 caratteri è ancora una tessera, una di 201 fa restare l’elenco', [tessere(dueCentonovantotto).length, tessere(dueUno).length, conta(dueUno, /<li>/g)], [3, 0, 3])
  const dueElenchi = sezioni(pagina(`<h2>S</h2><ul>${voci(3)}</ul><p>in mezzo</p><ul>${voci(3)}</ul>`))[0] ?? ''
  ok('due elenchi corti nella stessa sezione restano due elenchi', [tessere(dueElenchi).length, conta(dueElenchi, /<ul>/g), conta(dueElenchi, /<li>/g)], [0, 2, 6])
  const ol = sezioni(pagina(`<h2>S</h2><ol>${voci(3)}</ol>`))[0] ?? ''
  ok('ogni ol resta un elenco numerato', [tessere(ol).length, conta(ol, /<ol>/g), conta(ol, /<li>/g)], [0, 1, 3])
}

{
  const annidato = sezioni(pagina('<h2>S</h2><ul><li>a<ul><li>n</li><li>m</li></ul></li><li>b</li></ul>'))[0] ?? ''
  ok('ul con un elenco dentro: resta un elenco, con i tag bilanciati', [tessere(annidato).length, conta(annidato, /<ul>/g), conta(annidato, /<\/ul>/g), conta(annidato, /<li>/g), conta(annidato, /<\/li>/g)], [0, 2, 2, 4, 4])
  const senzaTitolo = sezioni(pagina('<h2>S</h2><ul><li>solo testo uno</li><li>solo testo due</li></ul>'))[0] ?? ''
  ok('voci senza grassetto: tessere senza <h3> vuoto', [tessere(senzaTitolo).length, /<h3><\/h3>/.test(senzaTitolo)], [2, false])
}

console.log('\n7. Citazioni')
{
  const bq = (n) => Array.from({ length: n }, (_, i) => `<blockquote><p>Parole ${i + 1}</p></blockquote>`).join('')
  const h = pagina(`<h2>Dicono</h2>${bq(3)}`)
  const s = sezioni(h)[0] ?? ''
  const reg = s.match(/<[a-z]+\b[^>]*role="region"[^>]*>/)?.[0] ?? ''
  const classe = reg.match(/class="([^"]*)"/)?.[1]?.split(/\s+/) ?? []
  ok('3 citazioni di fila: un contenitore con tabindex="0", role="region" e aria-label', [/tabindex="0"/.test(reg), /role="region"/.test(reg), /aria-label="[^"]+"/.test(reg)], [true, true, true])
  const css = cssDi(h)
  ok('il contenitore ha scroll-snap-type', /x/.test(unaDichiarazione(css.base, css.V, (x) => classe.some((c) => c && x.includes('.' + c)))['scroll-snap-type'] ?? ''), true)
  ok('3 tessere citazione, blu e inchiostro alternate', tessere(s).map((x) => [x.classi.includes('citazione'), colore(x)]), [[true, 'blu'], [true, 'inchiostro'], [true, 'blu']])
  ok('nessun <script> né gestore di eventi nella pagina', [/<script/i.test(senzaDati(h)), /\son[a-z]+\s*=/i.test(main(h))], [false, false])
  const una = sezioni(pagina(`<h2>Dicono</h2>${bq(1)}`))[0] ?? ''
  const u = tessere(una)
  ok('una citazione sola: una tessera citazione larga blu, senza contenitore a scorrimento', [u.length, u[0]?.classi.includes('citazione'), u[0]?.classi.includes('larga'), colore(u[0] ?? { classi: [] }), /role="region"/.test(una)], [1, true, true, 'blu', false])
  const firma = (ultimo) => sezioni(pagina(`<h2>S</h2><blockquote><p>Detto</p>${ultimo}</blockquote>`))[0] ?? ''
  ok('ultimo paragrafo tutto in em: firma', conta(firma('<p><em>Anna, mamma</em></p>'), /class="[^"]*\bfirma\b/g), 1)
  ok('ultimo paragrafo tutto in strong: firma', conta(firma('<p><strong>Anna</strong></p>'), /class="[^"]*\bfirma\b/g), 1)
  ok('ultimo paragrafo che comincia con «—»: firma', conta(firma('<p>— Anna, mamma</p>'), /class="[^"]*\bfirma\b/g), 1)
  ok('ultimo paragrafo normale: nessuna firma', conta(firma('<p>Anche questo è detto</p>'), /class="[^"]*\bfirma\b/g), 0)
  const f = unaDichiarazione(css.base, css.V, (x) => /\.firma\b/.test(x))
  ok('la firma è in carattere display', /big shoulders display|--display/i.test(css.base.filter((r) => r.sel.some((x) => /\.firma\b/.test(x))).map((r) => r['dich']['font-family'] ?? '').join()) || /big shoulders display/.test(f['font-family'] ?? ''), true)
}

console.log('\n8. Immagini')
{
  const img = (n, alt = `Foto ${n}`) => `<img src="/risorse/f${n}.webp" alt="${alt}">`
  const h1 = pagina(`<h2>Foto</h2>${img(1)}`)
  const u = tessere(sezioni(h1)[0] ?? '')
  ok('una sola immagine = una tessera foto a tutta larghezza', [u.length, u[0]?.classi.includes('foto'), u[0]?.classi.includes('larga')], [1, true, true])
  const css = cssDi(h1)
  const foto = unaDichiarazione(css.base, css.V, (x) => /\.foto\b/.test(x) && !/img/.test(x) && !/quattro|citazioni/.test(x))
  const fotoImg = unaDichiarazione(css.base, css.V, (x) => /\.foto\b.*img\b/.test(x) && !/quattro|citazioni/.test(x))
  ok('la tessera foto ha un aspect-ratio fisso e l’immagine object-fit:cover', [/\d/.test(foto['aspect-ratio'] ?? fotoImg['aspect-ratio'] ?? ''), fotoImg['object-fit']], [true, 'cover'])
  ok('l’alt è quello originale', /<img[^>]*alt="Foto 1"/.test(u[0]?.html ?? ''), true)
  const h3f = pagina(`<h2>Foto</h2>${img(1)}${img(2)}${img(3, '')}`)
  const s3 = sezioni(h3f)[0] ?? ''
  ok('3 immagini di fila: una fila di 3 tessere foto', [tessere(s3).length, conta(s3, /class="[^"]*\bfoto-fila\b/g), tessere(s3).every((x) => x.classi.includes('foto'))], [3, 1, true])
  ok('gli alt restano com’erano, anche quello vuoto', [...s3.matchAll(/<img[^>]*>/g)].map((m) => m[0].match(/\balt="([^"]*)"/)?.[1]), ['Foto 1', 'Foto 2', ''])
  const fila = (R) => unaDichiarazione(R, css.V, (x) => /\.foto-fila\b/.test(x) && !/quattro|citazioni/.test(x))['grid-template-columns']
  ok('la fila: 3 colonne uguali, 2 sul telefono', [colonne(fila(css.base)), colonne(fila(css.tel))], [3, 2])
  const due = pagina(`<h2>Foto</h2>${img(1)}${img(2)}`)
  ok('due foto: una fila «due», con 2 colonne', [conta(due, /class="foto-fila due"/g), colonne(unaDichiarazione(cssDi(due).base, cssDi(due).V, (x) => /^\.due$|\.foto-fila\.due/.test(x))['grid-template-columns'])], [1, 2])
  ok('la tessera foto ha aspect-ratio 3/2', /3\s*\/\s*2/.test(fotoImg['aspect-ratio'] ?? foto['aspect-ratio'] ?? ''), true)
  const dentro = tessere(sezioni(pagina(`<h2>S</h2><h3>Titolo</h3>${img(1)}<p>Testo</p>`))[0] ?? '')[0]?.html ?? ''
  ok('immagine in una tessera h3: sta in cima, prima del titolo', [dentro.indexOf('<img') >= 0, dentro.indexOf('<img') < dentro.search(/<h3/)], [true, true])
  const mezzo = sezioni(pagina(`<h2>S</h2><p>Prima</p>${img(1)}<p>Dopo</p>`))[0] ?? ''
  ok('immagine in mezzo a un testo in colonna: resta tra i paragrafi, senza tessera', [tessere(mezzo).length, mezzo.indexOf('Prima') < mezzo.indexOf('<img') && mezzo.indexOf('<img') < mezzo.indexOf('Dopo')], [0, true])
}

console.log('\n9. Quello che scrive la segreteria si pulisce prima del layout')
{
  const h = pagina('<h2>S</h2><div class="tessera blu">X</div><script>alert(1)</script><h3 class="tessera giallo" onclick="x()">A</h3><p onclick="y()">Z</p>')
  ok('niente script né gestori di eventi', [/<script/i.test(senzaDati(h)), /\son[a-z]+\s*=/i.test(main(h)), h.includes('alert(1)') && /<script/.test(senzaDati(h))], [false, false, false])
  ok('una sola tessera, la nostra (l’h3), blu: la classe della segreteria non conta', tessere(sezioni(h)[0] ?? '').map(colore), ['blu'])
  const senzaH3 = pagina('<h2>S</h2><div class="tessera blu">X</div><p>Y</p>')
  ok('senza h3 la classe «tessera» scritta a mano non crea tessere (e la sezione c’è)', [sezioni(senzaH3).length, tessere(sezioni(senzaH3)[0] ?? '').length], [1, 0])
}

console.log('\n10. Titoli e testi lunghissimi')
{
  const h = pagina(`<h2>S</h2><h3>${'W'.repeat(200)}</h3><p>${'parola '.repeat(715)}</p>`)
  const css = cssDi(h)
  const tit = unaDichiarazione(css.base, css.V, (x) => /\.tessera\b[^,]*\bh3\b|\.tessera\s+\.titolo/.test(x))
  ok('il titolo della tessera manda a capo (overflow-wrap)', /anywhere|break-word/.test(tit['overflow-wrap'] ?? tit['word-break'] ?? ''), true)
  ok('la tessera di 5000 caratteri è intera nella pagina', testoDi(tessere(sezioni(h)[0] ?? '')[0]?.html ?? '').length >= 5000, true)
  const rigide = css.base.filter((r) => r.sel.some((x) => /\.tessera\b|\.tessere\b|\.sezione\b/.test(x) && !/\.foto\b|::scroll-marker/.test(x))).filter((r) => 'height' in r.dich || 'max-height' in r.dich || /hidden/.test(r.dich.overflow ?? '') || 'overflow-y' in r.dich)
  ok('nessuna altezza fissa né overflow nascosto sulle tessere e sulle sezioni', rigide.map((r) => r.sel.join()), [])
  const x = css.base.filter((r) => r.sel.some((s) => /^(html|body|main)$/.test(s))).filter((r) => /overflow(-x)?/.test(Object.keys(r.dich).join()) && /scroll|auto/.test(r.dich['overflow-x'] ?? r.dich.overflow ?? ''))
  ok('nessun overflow-x su html, body, main', x.length, 0)
}

console.log('\n11. CSS: colori, indirizzi, movimento')
{
  const h = pagina(`<h2>S</h2>${h3(4)}`)
  const css = cssDi(h)
  const usati = [...new Set([...stile(h).matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map((m) => hex(m[0].toLowerCase()) ?? m[0].toLowerCase()))]
  ok('solo i cinque colori A2 e il bianco', usati.filter((c) => ![FONDO, INCHIOSTRO, BLU, CHIARA, GIALLO, BIANCO].includes(c)), [])
  ok('niente @import né indirizzi esterni nel CSS', [/@import/i.test(h), /https?:\/\/|\/\/[a-z]/i.test(css.tutto.replace(/\/\*[\s\S]*?\*\//g, ''))], [false, false])
  const mov = blocco(css.tutto, '@media (prefers-reduced-motion:no-preference)')
  ok('transition e animation solo dentro prefers-reduced-motion:no-preference', mov ? !/transition|animation|scroll-behavior:\s*smooth/.test(mov.senza) : 'nessun blocco', true)
  const coppie = css.tuttoR.filter((r) => /\.tessera\b/.test(r.sel.join())).map((r) => [sfondoDi(Object.fromEntries(Object.entries(r.dich).map(([k, v]) => [k, risolvi(v, css.V)]))), hex(risolvi(r.dich.color, css.V))]).filter(([a, b]) => a && b)
  ok('le regole delle tessere con sfondo e colore sono almeno quattro e tutte a 4,5:1', [coppie.length >= 4, coppie.filter(([a, b]) => contrasto(a, b) < 4.5)], [true, []])
  const angoli = css.tuttoR.filter((r) => r.sel.some((x) => /\.tessera\b/.test(x) && !/::scroll-marker/.test(x)) && r.dich['border-radius']).map((r) => risolvi(r.dich['border-radius'], css.V))
  ok('le tessere hanno gli angoli a 6px', angoli.length > 0 && angoli.every((v) => v === '6px'), true)
}

console.log('\n12. Stessi dati, stessi file; testi strani non rompono')
{
  const testo = '<p>Intro</p><h2>Uno</h2>' + h3(3) + '<h2>Due</h2><ul><li><strong>A</strong> a</li><li><strong>B</strong> b</li></ul>'
  const a = JSON.stringify(sito(testo)), b = JSON.stringify(sito(testo))
  ok('stessi dati due volte: file identici', [a === b, a.length > 100], [true, true])
  ok('h2 vuoto: si genera', pagina('<h2></h2><p>x</p>').includes('</html>'), true)
  ok('h2 seguito da h2: si genera, due sezioni', [pagina('<h2>A</h2><h2>B</h2><p>x</p>').includes('</html>'), sezioni(pagina('<h2>A</h2><h2>B</h2><p>x</p>')).length], [true, 2])
  const solo = tessere(sezioni(pagina('<h2>S</h2><h3>Solo titolo</h3>'))[0] ?? '')
  ok('h3 senza testo: una tessera col solo titolo', [solo.length, testoDi(solo[0]?.html ?? '')], [1, 'Solo titolo'])
  ok('h3 vuoto: si genera', pagina('<h2>S</h2><h3></h3><p>x</p>').includes('</html>'), true)
}

console.log(guai ? `\n✗ ${guai} casi falliti` : '\nTutto a posto.')
process.exit(guai ? 1 : 0)
