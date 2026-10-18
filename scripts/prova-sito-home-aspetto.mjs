// ---------------------------------------------------------------------------
// Le misure della Home rivista (HomeProposta a 1440px, 768px e 375px), lette dal CSS
// generato, senza browser.
//
//   node scripts/prova-sito-home-aspetto.mjs
//
// Il CSS si legge come regole (`@media` compreso) e per ogni larghezza si prende l'ultima
// dichiarazione delle regole che hanno quel selettore; i `clamp()` si calcolano alla larghezza.
// Non c'è un vero cascade: a parità di selettore vince l'ultima nel file, come nel browser.
// La struttura (classi, ordine, testi) sta in prova-sito-home-nuova.mjs.
// ---------------------------------------------------------------------------
import { build } from 'esbuild'
import * as F from './fixture-home-nuova.mjs'

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

// --- Il CSS come elenco di regole -----------------------------------------------------------
const stili = (h) => [...h.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n')
/** [{ media, sel, corpo, n }]: `media` è il testo dopo `@media` (o ''), `n` l'ordine nel file. */
function regole(css) {
  const fuori = []
  let n = 0
  const leggi = (testo, media) => {
    let i = 0
    while (i < testo.length) {
      const apre = testo.indexOf('{', i)
      if (apre < 0) break
      const prelude = testo.slice(i, apre).trim()
      let prof = 1
      let j = apre + 1
      while (j < testo.length && prof > 0) { if (testo[j] === '{') prof++; else if (testo[j] === '}') prof--; j++ }
      const dentro = testo.slice(apre + 1, j - 1)
      if (/^@(media|supports)/.test(prelude)) leggi(dentro, prelude.replace(/^@(media|supports)\s*/, ''))
      else if (!prelude.startsWith('@')) for (const sel of prelude.split(',')) fuori.push({ media, sel: sel.trim().replace(/\s+/g, ' '), corpo: dentro, n: n++ })
      i = j
    }
  }
  leggi(css.replace(/\/\*[\s\S]*?\*\//g, ''), '')
  return fuori
}
/** La media query vale a questa larghezza? Solo min-width / max-width semplici; le altre (motion, print…) no. */
const vale = (media, w) => {
  if (!media) return true
  const cond = [...media.matchAll(/\((min|max)-width:\s*(\d+)px\)/g)]
  if (!cond.length || /,|prefers|print|hover|pointer/.test(media)) return false
  return cond.every((c) => (c[1] === 'min' ? w >= +c[2] : w <= +c[2]))
}
const dichiarazioni = (corpo) => [...corpo.matchAll(/([a-z-]+)\s*:\s*([^;]+?)\s*(?:;|$)/g)].map((m) => [m[1], m[2].replace(/\s*!important$/, '')])
/** Le dichiarazioni di `prop` delle regole il cui selettore passa `re`, a larghezza `w`, nell'ordine del file. */
const valori = (R, re, prop, w) => R.filter((r) => vale(r.media, w) && re.test(r.sel)).flatMap((r) => dichiarazioni(r.corpo).filter(([p]) => p === prop).map(([, v]) => v))
const ultimo = (R, re, prop, w) => valori(R, re, prop, w).at(-1)

/** `clamp(a,b,c)` o `Npx` alla larghezza `w`, arrotondato; altrimenti il testo com'è. */
function px(v, w) {
  if (v === undefined) return undefined
  const num = (t) => (/vw$/.test(t.trim()) ? (parseFloat(t) * w) / 100 : parseFloat(t))
  const c = v.match(/^clamp\(([^,]+),([^,]+),([^)]+)\)$/)
  if (c) return Math.round(Math.max(num(c[1]), Math.min(num(c[2]), num(c[3]))))
  return /^-?[\d.]+px$/.test(v) ? Math.round(parseFloat(v)) : v
}
/** Il primo valore di `padding-top`, `margin-top` (o dei loro abbreviati). */
const sopra = (R, re, w) => {
  const v = ultimo(R, re, 'padding-top', w) ?? ultimo(R, re, 'margin-top', w) ?? ultimo(R, re, 'padding', w)?.split(/\s+/)[0] ?? ultimo(R, re, 'margin', w)?.split(/\s+/)[0]
  return px(v, w)
}

const pagina = (testo) => g.generaSito(F.dati(testo))['index.html'] ?? ''
const R = regole(stili(pagina(F.TESTO_NUOVO)))
// La pagina di un corso ha un secondo <style>: lo si legge insieme.
const corso = g.generaSito({ dominio: F.DOMINIO, pagine: [{ slug: 'judo', titolo: 'Judo', descrizione: 'd', testo: `<img src="/foto/a.png" alt="L"><ul><li><strong>Per chi</strong> Dai 7 anni</li><li><strong>Quando</strong> Lun e mer</li><li><strong>Dove</strong> Via Vittorio Sassi 26</li><li><strong>Per iniziare</strong> 1 settimana</li></ul><h3>Cos’è</h3><p>Un percorso.</p><h3>Cosa si fa</h3><p>Si lavora.</p><h3>Per chi</h3><p>Tutti.</p>` }, { slug: 'corsi', titolo: 'Corsi', descrizione: '', testo: '<ul><li><strong><a href="/judo/">Judo</a></strong> x</li></ul>' }, { slug: 'contatti', titolo: 'Contatti', descrizione: '', testo: '<p>c</p>' }], menu: [{ dove: 'menu', ordine: 1, etichetta: 'Home', slug: 'home', indirizzo: null }], rinvii: [] })['judo/index.html'] ?? ''
const RC = regole(stili(corso))
const W = [1440, 768, 375]

console.log('\n1. Titoli: clamp a 1440, 768 e 375 (come da design)')
{
  const h1 = /\.passo-unico[^,]* h1$/
  ok('h1 della Home nuova: 156px a 1440, 92px a 768 e a 375 (clamp(92px,10.83vw,156px))', W.map((w) => px(ultimo(R, h1, 'font-size', w), w)), [156, 92, 92])
  ok('l’h1 della Home nuova non è sovrascritto da quello del telefono (h1{font-size:84px} ha meno peso)', R.filter((r) => vale(r.media, 375) && h1.test(r.sel)).every((r) => dichiarazioni(r.corpo).filter(([p]) => p === 'font-size').every(([, v]) => px(v, 375) === 92)), true)
  const h2 = /\.passo-unico \.sezione h2$/
  ok('titoli di sezione: 80px a 1440, 56px a 768 e 375 (clamp(56px,5.56vw,80px))', W.map((w) => px(ultimo(R, h2, 'font-size', w), w)), [80, 56, 56])
  const cta = /\.cta h2$/
  ok('titolo della chiamata finale: 88px a 1440, 48px a 768 e 375 (clamp(48px,6.11vw,88px))', W.map((w) => px(ultimo(R, cta, 'font-size', w), w)), [88, 48, 48])
  ok('il titolo della chiamata va a capo bilanciato', ultimo(R, cta, 'text-wrap', 1440), 'balance')
  const ordine = (re) => R.findIndex((r) => re.test(r.sel) && r.corpo.includes('font-size'))
  ok('la regola del titolo finale viene dopo quella dei titoli di sezione (a parità di peso vince)', ordine(cta) > ordine(h2), true)
  ok('le altre pagine hanno ancora i loro titoli (clamp(48px,9vw,120px))', px(ultimo(R, /^\.sezione h2$/, 'font-size', 1440), 1440), 120)
}

console.log('\n2. Il passo tra le sezioni e gli stacchi')
{
  ok('passo: 96px sopra ogni sezione a 1440, 64px a 768 e 375', W.map((w) => sopra(R, /\.passo-unico \.sezione$/, w)), [96, 64, 64])
  ok('stacco testata → numeri: 48px, 32px sul telefono', [1440, 768, 375].map((w) => sopra(R, /\.numeri$/, w)), [48, 32, 32])
  ok('stacco numeri → motto: 48px, 32px sul telefono', [1440, 768, 375].map((w) => sopra(R, /\.motto$/, w)), [48, 32, 32])
  const sotto = (w) => px(ultimo(R, /\.cta$/, 'margin-bottom', w) ?? ultimo(R, /\.cta$/, 'padding-bottom', w) ?? ultimo(R, /\.passo-unico[^,]*\.piede$|\.passo-unico \+ [^,]*\.piede$/, 'margin-top', w), w)
  ok('dalla chiamata al piede 24px', W.map(sotto), [24, 24, 24])
}

console.log('\n3. Numeri, schede, citazioni, recensioni, chiamata finale')
{
  ok('numeri: alti almeno 150px, 160px sul telefono', [1440, 768, 375].map((w) => px(ultimo(R, /\.numeri \.tessera$/, 'min-height', w), w)), [150, 160, 160])
  ok('numeri: 2 colonne sul telefono', [768, 375].map((w) => /repeat\(2/.test(ultimo(R, /\.numeri$/, 'grid-template-columns', w) ?? '')), [true, true])
  ok('numeri: 4 colonne sul computer', /repeat\(4|(1fr\s*){4}/.test(ultimo(R, /\.numeri$/, 'grid-template-columns', 1440) ?? ''), true)
  ok('foto della scheda: 240px a 1440, 230px a 768, 220px a 375 (clamp(220px,30vw,240px))', W.map((w) => px(ultimo(R, /^\.scheda-foto$/, 'height', w), w)), [240, 230, 220])
  ok('scheda senza foto: sul telefono è alta 120px', [768, 375].map((w) => px(ultimo(R, /\.scheda-foto\.senza-foto$/, 'height', w), w)), [120, 120])
  const col = (w) => ultimo(R, /\.tessere\.n-9$|\.tessere\.corsi$|\.tessere\.schede$/, 'grid-template-columns', w) ?? ''
  ok('schede: 3 colonne dal computer (901px), 1 colonna sotto', [1440, 901].map((w) => /repeat\(3|(1fr\s*){3}/.test(col(w))).concat([768, 375].map((w) => /^(1fr|repeat\(1,)/.test(col(w)))), [true, true, true, true])
  ok('la scheda mostra l’iniziale grande se non c’è la foto (l’iniziale è nel riquadro)', valori(R, /\.scheda-foto\.senza-foto span$/, 'font-size', 1440).length > 0, true)
  ok('il «Leggi tutto» aperto nasconde l’estratto', R.some((r) => /\.citazione:has\(\.intero\[open\]\) \.estratto$/.test(r.sel) && /display:\s*none/.test(r.corpo)), true)
  ok('recensioni: sul computer sei colonne, tre carte per riga da due colonne; a cinque carte le ultime due da tre colonne (nessun buco)', [/^repeat\(6,\s*minmax\(0,\s*1fr\)\)$/.test(ultimo(R, /\.recensioni$/, 'grid-template-columns', 1440) ?? ''), ultimo(R, /^\.recensioni>\*$/, 'grid-column', 1440), ultimo(R, /^\.recensioni>:nth-child\(4\):nth-last-child\(2\)$/, 'grid-column', 1440), ultimo(R, /^\.recensioni>:nth-child\(5\):last-child$/, 'grid-column', 1440), ultimo(R, /^\.recensioni>:nth-child\(4\):nth-last-child\(2\)$/, 'grid-column', 375) ?? null], [true, 'span 2', 'span 3', 'span 3', null])
  ok('recensioni: una colonna sul telefono', [768, 375].map((w) => /^(1fr|repeat\(1,)/.test(ultimo(R, /\.recensioni$/, 'grid-template-columns', w) ?? '')), [true, true])
  ok('chiamata finale: due colonne dal computer, una sul telefono', [1440, 901].map((w) => (ultimo(R, /\.cta$/, 'grid-template-columns', w) ?? '').trim().split(/\s+/).length).concat([768, 375].map((w) => /^(1fr|repeat\(1,)/.test(ultimo(R, /\.cta$/, 'grid-template-columns', w) ?? ''))), [2, 2, true, true])
  ok('chiamata finale senza foto: una colonna anche sul computer', /^(1fr|repeat\(1,)/.test(ultimo(R, /\.cta\.solo$/, 'grid-template-columns', 1440) ?? ''), true)
  ok('pulsanti della testata: alti 60px, 56px sul telefono', [1440, 768, 375].map((w) => px(ultimo(R, /\.pulsanti \.pulsante$/, 'min-height', w), w)), [60, 56, 56])
  ok('il pulsante primario è giallo, il secondario è a linea (bordo 2px, fondo trasparente)', [/giallo/.test(ultimo(R, /\.pulsante\.primario$/, 'background', 1440) ?? ''), /^2px /.test(ultimo(R, /\.pulsante\.secondario$/, 'border', 1440) ?? ''), /transparent/.test(ultimo(R, /\.pulsante\.secondario$/, 'background', 1440) ?? '')], [true, true, true])
}

console.log('\n4. Bersagli da almeno 48px')
{
  const BERSAGLI = [
    ['le voci del menu', /\.testata nav a$/],
    ['i pulsanti', /\.pulsante(\.[\w-]+)*$/],
    ['il tasto MENU', /\.tasto-menu$/],
    ['«Leggi tutto»', /\.intero summary$/],
    ['i link del piede', /\.piede[^,]* a$/],
    ['il titolo-link della scheda', /\.scheda h3 a$/],
  ]
  for (const [nome, re] of BERSAGLI) {
    const larghezze = nome === 'il tasto MENU' ? [768, 375] : W
    for (const w of larghezze) {
      const tutti = valori(R, re, 'min-height', w).map((v) => px(v, w))
      ok(`${nome} a ${w}px: min-height almeno 48px e nessuna regola che lo abbassa`, [tutti.length > 0, tutti.every((v) => typeof v === 'number' && v >= 48)], [true, true])
    }
  }
  const nav = valori(RC, /\.pagina-corso \.testata nav a$/, 'min-height', 375).concat(valori(RC, /\.pagina-corso \.testata nav a$/, 'min-height', 1440))
  ok('la pagina di un corso non abbassa le voci del menu (niente min-height:0 né 44px)', nav.every((v) => px(v, 1440) >= 48), true)
  const tutteCorso = valori(RC, /\.testata nav a$/, 'min-height', 375)
  ok('nemmeno altrove nel CSS di un corso, sul telefono', tutteCorso.length > 0 && tutteCorso.every((v) => px(v, 375) >= 48), true)
}

console.log('\n5. Il tasto MENU senza script')
{
  ok('sul computer il tasto MENU non si vede, sul telefono sì', [px(ultimo(R, /\.tasto-menu$/, 'display', 1440)), ultimo(R, /\.tasto-menu$/, 'display', 375) !== 'none' && ultimo(R, /\.tasto-menu$/, 'display', 375) !== undefined], ['none', true])
  ok('sul computer il menu (#menu) è la riga di voci', ultimo(R, /#menu$/, 'display', 1440) !== 'none', true)
  ok('sul telefono il menu è chiuso…', ultimo(R, /#menu$/, 'display', 375), 'none')
  ok('…e si apre con :target (display:block)', ultimo(R, /#menu:target$/, 'display', 375), 'block')
  ok('anche a 768px (sotto i 901)', [ultimo(R, /#menu$/, 'display', 768), ultimo(R, /#menu:target$/, 'display', 768)], ['none', 'block'])
  ok('«Chiudi» si vede solo sul telefono', [ultimo(R, /#menu [^,]*chiudi$|#menu \.chiudi$|\.chiudi$/, 'display', 1440), ultimo(R, /#menu [^,]*chiudi$|#menu \.chiudi$|\.chiudi$/, 'display', 375) !== 'none'], ['none', true])
  // Aperto sul telefono il menu era una riga con «Chiudi» e due pulsanti insieme, prima delle voci: non si capiva cosa fosse cosa.
  const nav = pagina(F.TESTO_NUOVO).match(/<nav id="menu"[\s\S]*?<\/nav>/)?.[0] ?? ''
  ok('nel menu le voci vengono prima dei pulsanti, «Chiudi» è il primo', [nav.indexOf('class="chiudi"') < nav.indexOf('<ul>'), nav.indexOf('<ul>') < nav.indexOf('nel-menu')], [true, true])
  ok('sul telefono «Chiudi» e i pulsanti del menu occupano una riga intera', [ultimo(R, /\.testata \.chiudi$/, 'display', 375), ultimo(R, /\.testata \.nel-menu$/, 'display', 375)], ['flex', 'flex'])
}

console.log('\n6. Nomi e regole')
{
  const css = stili(pagina(F.TESTO_NUOVO))
  ok('nessuna classe «home-» nel CSS (le classi sono generiche)', /[.#]home-/.test(css), false)
  ok('le regole nuove stanno sotto «.passo-unico» o su una classe: nessuna riguarda «.collage.pieno»', R.filter((r) => /\.passo-unico/.test(r.sel)).some((r) => /\.collage\.pieno/.test(r.sel)), false)
  ok('la Home di prima ha ancora il suo collage pieno nel CSS', R.some((r) => /^\.collage\.pieno$/.test(r.sel)), true)
}

console.log('\n6. Dopo la revisione del design')
{
  const Hc = stili(g.generaSito(F.dati(F.TESTO_NUOVO))['index.html'] ?? '')
  const Rc = regole(Hc)
  ok('sul telefono le 5 domande sono una per riga (nessuna colonna da 3 su 6)', ultimo(Rc, /\.n-5 \.tessera:nth-child\(n\)$/, 'grid-column', 375), '1 / -1')
  ok('sul computer le 5 domande restano 3 + 2', ultimo(Rc, /\.tessere\.n-5 \.tessera:nth-child\(5\)$/, 'grid-column', 1440), 'span 3')
  ok('le schede dei corsi hanno righe alte uguali', ultimo(Rc, /\.tessere\.schede$/, 'grid-auto-rows', 1440), '1fr')
  ok('«· chiudi» tiene lo spazio davanti', ultimo(Rc, /\.intero\[open\] summary::after$/, 'white-space', 1440), 'pre')
  ok('«Chiudi» del menu è alto 48px', px(ultimo(Rc, /\.chiudi$/, 'min-height', 375), 375), 48)
  ok('i link del piede sono larghi almeno 48px', px(ultimo(Rc, /\.piede a$/, 'min-width', 375), 375), 48)
}

console.log('\n7. Il contrasto dei numeri 1–4 (WCAG, almeno 3:1 con l’opacity mescolata sul fondo)')
{
  const radice = Object.fromEntries([...(stili(pagina(F.TESTO_NUOVO)).match(/:root\{([^}]*)\}/)?.[1] ?? '').matchAll(/--([a-z]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1], m[2]]))
  const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
  const lum = (c) => c.map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)).reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0)
  const contrasto = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }
  const sfuma = (t, f, o) => t.map((v, i) => v * o + f[i] * (1 - o))
  const fondi = [['giallo', radice.inchiostro], ['blu', '#ffffff'], ['inchiostro', '#ffffff']]
  // La pagina del corso rivista: pulsante all'iscrizione, foto, 4 dati e «Cosa aspettarsi» a 4 tessere (come in prova-sito-corso-nuovo.mjs).
  const P = 'https://abc.supabase.co/storage/v1/object/public/sito/'
  const testoCorso = `<p><a class="pulsante" href="/contatti/">Scrivici</a> <a class="pulsante" href="https://app.officinedellosport.it/iscrizioni/">Prova una settimana a 5 €</a></p><img src="${P}a.jpg" alt="Una lezione" /><ul>${[1, 2, 3, 4].map((n) => `<li><strong>Etichetta ${n}</strong> Valore ${n}</li>`).join('')}</ul><h2>Cosa aspettarsi</h2>${[1, 2, 3, 4].map((n) => `<h3>Aspetto ${n}</h3><p>Testo ${n}.</p>`).join('')}`
  const nuovo = g.generaSito({ dominio: F.DOMINIO, pagine: [{ slug: 'judo', titolo: 'Judo', descrizione: 'd', testo: testoCorso }, { slug: 'corsi', titolo: 'Corsi', descrizione: '', testo: '<p>c</p>' }, { slug: 'contatti', titolo: 'Contatti', descrizione: '', testo: '<p>c</p>' }], menu: [], rinvii: [], ospitiImmagini: [P] })['judo/index.html'] ?? ''
  ok('la pagina di prova è un corso rivista (ha il CSS di .corso-nuovo)', /\.corso-nuovo \.corso-apertura/.test(nuovo), true)
  const Rn = regole(stili(nuovo))
  const pagine = [['home', R], ['corso', Rn]]
  for (const [nome, Rp] of pagine) {
    const o = parseFloat(ultimo(Rp, /\.numero-perche$/, 'opacity', 1440))
    for (const [fondo, testo] of fondi) {
      const c = contrasto(sfuma(rgb(testo), rgb(radice[fondo] ?? ''), o), rgb(radice[fondo] ?? ''))
      ok(`${nome}: il numero su ${fondo} ha contrasto >= 3 (opacity ${o}, avuto ${c.toFixed(2)})`, c >= 3, true)
    }
  }
  ok('l’opacity è la stessa in tutte le pagine: nessuna regola propria per «.corso-nuovo .numero-perche»', R.concat(Rn).some((r) => /^\.corso-nuovo \.numero-perche$/.test(r.sel) && /opacity/.test(r.corpo)), false)
}

console.log(guai ? `\n✗ ${guai} casi falliti` : '\nTutto a posto.')
process.exit(guai ? 1 : 0)
