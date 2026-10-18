// ---------------------------------------------------------------------------
// Il sito sul computer ha la scala del design «tatami blu e giallo», senza browser.
//
//   node scripts/prova-sito-scala.mjs
//
// Il design è disegnato a 1440px: titolo 228px, collage largo 640px con righe da
// 128px, sezioni distanziate di 96px, tessere alte (min 190px). Il CSS di
// `generaSito` si legge come testo e i `clamp()` si calcolano a 1440px, così la
// prova non dipende da come il codice scrive i numeri. Sotto i 900px non cambia
// niente: le prove del telefono sono in prova-sito-collage.mjs e -tessere.mjs.
// ---------------------------------------------------------------------------
import { build } from 'esbuild'

const { outputFiles } = await build({
  entryPoints: ['src/lib/sitoGenera.ts'],
  bundle: true,
  format: 'esm',
  platform: 'node',
  write: false,
  logLevel: 'silent',
  define: { 'import.meta.env': '{}' },
  banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(process.cwd() + '/');" },
})
const g = await import('data:text/javascript;base64,' + Buffer.from(outputFiles[0].text).toString('base64'))

let guai = 0
const ok = (cosa, avuto, voluto) => {
  const va = JSON.stringify(avuto) === JSON.stringify(voluto)
  console.log(va ? '  ✓' : '  ✗', cosa, va ? '' : `— atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`)
  if (!va) guai++
}

let L = 1440 // la larghezza a cui si calcolano vw e clamp: 1440 (design), poi 1100 e 1920
const html = g.generaSito({ dominio: 'https://officinedellosport.it', pagine: [{ slug: 'home', titolo: 'T', descrizione: 'd', testo: '<p>x</p>' }], menu: [], rinvii: [] })['index.html']
const CSS = html.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? ''
/** Il CSS senza i blocchi `@media (max-width…)`: qui si guarda il computer. */
const senzaTelefono = (t) => {
  for (;;) {
    const i = t.search(/@media\s*\(max-width/)
    if (i < 0) return t
    const a = t.indexOf('{', i)
    let k = a, p = 0
    for (; k < t.length; k++) { if (t[k] === '{') p++; else if (t[k] === '}' && --p === 0) break }
    t = t.slice(0, i) + t.slice(k + 1)
  }
}
const R = [...senzaTelefono(CSS).replace(/@media\s*\(min-width[^{]*\{/g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
  sel: m[1].trim().split(/\s*,\s*/),
  dich: Object.fromEntries(m[2].split(';').filter((x) => x.includes(':')).map((x) => { const i = x.indexOf(':'); return [x.slice(0, i).trim(), x.slice(i + 1).trim()] })),
}))
const V = Object.assign({}, ...R.filter((r) => r.sel.includes(':root')).map((r) => r.dich))
const risolvi = (v) => { let x = v ?? ''; for (let i = 0; i < 5; i++) x = x.replace(/var\((--[\w-]+)\)/g, (_, n) => V[n] ?? ''); return x.trim() }

/** Un valore CSS in px a 1440px: px, vw, rem e clamp/min/max/calc semplici. */
const px = (v) => {
  let x = risolvi(v).replace(/\s+/g, '')
  const num = (t) => {
    t = t.trim()
    if (/^-?[\d.]+px$/.test(t)) return parseFloat(t)
    if (/^-?[\d.]+vw$/.test(t)) return (parseFloat(t) * L) / 100
    if (/^-?[\d.]+rem$/.test(t)) return parseFloat(t) * 16
    if (/^-?[\d.]+$/.test(t)) return parseFloat(t)
    return NaN
  }
  const args = (t) => { const out = []; let p = 0, a = 0; for (let i = 0; i <= t.length; i++) { if (i === t.length || (t[i] === ',' && !p)) { out.push(t.slice(a, i)); a = i + 1 } else if (t[i] === '(') p++; else if (t[i] === ')') p-- } return out }
  const val = (t) => {
    let m
    if ((m = /^clamp\((.*)\)$/.exec(t))) { const [a, b, c] = args(m[1]).map(val); return Math.min(Math.max(b, a), c) }
    if ((m = /^min\((.*)\)$/.exec(t))) return Math.min(...args(m[1]).map(val))
    if ((m = /^max\((.*)\)$/.exec(t))) return Math.max(...args(m[1]).map(val))
    if ((m = /^calc\((.*)\)$/.exec(t))) return val(m[1])
    if (/[+](?![^(]*\))/.test(t)) return t.split(/[+](?![^(]*\))/).map(val).reduce((s, n) => s + n, 0)
    return num(t)
  }
  const r = val(x)
  return Number.isNaN(r) ? null : Math.round(r * 10) / 10
}
/** Il valore finale di `prop` per i selettori `quale` (l'ultima regola che lo dichiara vince; a parità di selettore è l'ordine nel file). */
const dich = (quale, prop) => { let v; for (const r of R) if (r.sel.some(quale)) if (prop in r.dich) v = r.dich[prop]; return v }

console.log('\n1. La testata della home sul computer')
{
  ok('il titolo grande è almeno 200px a 1440px (nel design 228px)', (px(dich((x) => x === 'h1', 'font-size')) ?? 0) >= 200, true)
  ok('il titolo grande non supera 240px', (px(dich((x) => x === 'h1', 'font-size')) ?? 999) <= 240, true)
  ok('il collage è largo 640px a 1440px', px(dich((x) => /^\.pagina-hero>\.collage/.test(x), 'max-width')), 640)
  ok('le righe del collage sono da 128px', px((dich((x) => x === '.collage', 'grid-auto-rows') ?? '').replace(/^minmax\(([^,]+),.*$/, '$1')), 128)
  ok('la testata si stira in altezza: il titolo in alto, la frase e il pulsante in basso', [dich((x) => x === '.pagina-hero', 'align-items'), /auto/.test(dich((x) => /^\.pagina-hero \.intro h1|^\.intro h1/.test(x), 'margin-bottom') ?? '')], ['stretch', true])
}

console.log('\n2. Il ritmo delle sezioni')
{
  const pad = (dich((x) => x === '.sezione', 'padding') ?? '').split(/\s+/)
  ok('sotto ogni sezione ci sono 96px (nel design)', px(pad[2] ?? pad[0]), 96)
  ok('il titolo di sezione resta da 120px a 1440px', px(dich((x) => x === '.sezione h2', 'font-size')), 120)
  ok('lo spazio sotto il titolo di sezione è 28px', px((dich((x) => x === '.sezione h2', 'margin') ?? '').split(/\s+/)[2]), 28)
}

console.log('\n3. Le tessere sono alte come nel design')
{
  // Le schede dei corsi (con un link nel titolo) sono alte 340px come nel design: non contano tra le tessere di sezione.
  const alte = R.filter((r) => r.sel.some((x) => /\.tessera/.test(x) && !/:has\(h3 a\)/.test(x)) && 'min-height' in r.dich).map((r) => px(r.dich['min-height']))
  ok('una tessera di sezione è alta almeno 190px a 1440px', Math.max(0, ...alte) >= 190, true)
  ok('e al massimo 300px', Math.max(0, ...alte) <= 300, true)
  ok('l’altezza vale solo dal computer in su: sul telefono la tessera resta com’è', /@media\s*\(min-width:\s*\d+px\)\s*\{[^@]*\.tessera[^}]*min-height/.test(CSS), true)
  ok('le tessere foto e i numeri del collage non hanno altezza minima (hanno le loro righe)', R.filter((r) => r.sel.some((x) => /\.tessera/.test(x) && 'min-height' in r.dich)).every((r) => r.sel.every((x) => /:not\(\.foto\)/.test(x))), true)
}

console.log('\n3b. Il titolo e le tessere reggono anche a 1100px e a 1920px')
{
  const h1 = dich((x) => x === 'h1', 'font-size')
  const tess = R.filter((r) => r.sel.some((x) => /\.tessera/.test(x) && !/:has\(h3 a\)/.test(x)) && 'min-height' in r.dich).map((r) => r.dich['min-height'])
  const a = (larghezza, f) => { const v = L; L = larghezza; const r = f(); L = v; return r }
  ok('a 1920px il titolo si ferma a 228px (non cresce oltre il design)', a(1920, () => px(h1)), 228)
  ok('a 1100px il titolo è almeno 160px (non cade al minimo del telefono)', a(1100, () => px(h1) ?? 0) >= 160, true)
  ok('a 1920px la tessera è alta al massimo 260px', a(1920, () => Math.max(0, ...tess.map(px))), 260)
  ok('a 1100px la tessera è alta almeno 170px', a(1100, () => Math.max(0, ...tess.map(px))) >= 170, true)
  ok('l’altezza delle tessere comincia a 901px, dove finisce il telefono', /@media\s*\(min-width:\s*901px\)\s*\{[^@]*\.tessera/.test(CSS), true)
}

console.log('\n4. Sul telefono la testata non si allunga')
{
  const tel = [...CSS.matchAll(/@media\s*\(max-width:\s*900px\)\s*\{/g)].map((m) => { let p = 1, k = m.index + m[0].length; for (; k < CSS.length && p; k++) { if (CSS[k] === '{') p++; else if (CSS[k] === '}') p-- } return CSS.slice(m.index + m[0].length, k - 1) }).join('\n')
  ok('sul telefono la testata va in colonna e collage e numeri non hanno più il tetto di 640px', [/\.pagina-hero\{[^}]*flex-direction:\s*column/.test(tel), /\.pagina-hero>\.collage[^{]*\{[^}]*max-width:\s*none/.test(tel)], [true, true])
  ok('il testo della testata non ha altezza propria (altrimenti titolo e frase restano lontani)', /\.pagina-hero \.intro[^{]*\{[^}]*flex:\s*none/.test(tel), true)
}

console.log(guai ? `\n✗ ${guai} casi falliti` : '\nTutto a posto.')
process.exit(guai ? 1 : 0)
