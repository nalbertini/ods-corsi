// ---------------------------------------------------------------------------
// La pagina degli istruttori come nel design «tatami blu e giallo», senza browser.
//
//   node scripts/prova-sito-istruttori.mjs
//
// Da `generaSito` (src/lib/sitoGenera.ts), regola in docs/sito/istruttori.md:
//
//  1. Un testo senza `h2` che comincia con un `h3` è una griglia di ritratti:
//     ogni `h3` (il nome) con la foto, se c'è, e il paragrafo che lo segue (il ruolo).
//     Quel che viene dopo l'ultimo ritratto resta testo, sotto la griglia.
//  2. I colori ruotano come nel design (giallo, blu, inchiostro, sfalsati a ogni riga di tre).
//  3. Senza foto il cerchio porta l’iniziale; col link nel nome la tessera è tutta cliccabile.
//  4. La testata delle pagine senza collage: titolo a sinistra, descrizione e pulsante a destra.
//  5. Le misure del design, a 1440px e a telefono, lette dal CSS.
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
const P = 'https://abc.supabase.co/storage/v1/object/public/sito/'
const pagina = (testo, slug = 'istruttori') => g.generaSito({ dominio: 'https://officinedellosport.it', pagine: [{ slug, titolo: 'Gli istruttori', descrizione: 'd', testo }, { slug: 'contatti', titolo: 'C', descrizione: '', testo: '' }], menu: [], rinvii: [], ospitiImmagini: [P] })[slug === 'home' ? 'index.html' : `${slug}/index.html`] ?? ''
const main = (h) => h.match(/<main>([\s\S]*)<\/main>/)?.[1] ?? ''
const conta = (x, re) => (x.match(re) || []).length
const CSS = pagina('<p>x</p>').match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? ''
const regola = (re) => [...CSS.matchAll(/([^{}]+)\{([^{}]*)\}/g)].find((m) => re.test(m[1]))
const dentro = (re) => regola(re)?.[2] ?? ''
const px = (re, prop) => parseFloat((dentro(re).match(new RegExp(`(?:^|;)${prop}:\\s*([\\d.]+)px`)) || [, 'NaN'])[1])
// Dopo «@media (max-width:900px){» le regole del telefono.
const TELEFONO = CSS.slice(CSS.indexOf('@media (max-width:900px)'))
const telefono = (re, prop) => parseFloat((TELEFONO.match(new RegExp(`${re}\\{(?:[^}]*;)?${prop}:\\s*([\\d.]+)px`)) || [, 'NaN'])[1])

const R = (n, r, foto = '') => `<h3>${n}</h3>${foto}<p>${r}</p>`
const FOTO = `<img src="${P}m.jpg" alt="Maurizio">`
const NOMI = ['Maurizio', 'Diana', 'Katia', 'Serena', 'Tiziano', 'Fabio', 'Valerio', 'Giulia', 'Maura', 'Elena', 'Aldo', 'Manuel', 'Federico']
const tredici = NOMI.map((n, i) => R(n, `Cognome ${i} · Judo`, i === 0 ? FOTO : '')).join('')
const CHIUSURA = '<p>Ogni istruttore ha la sua pagina.</p>'
const ritratti = (h) => [...main(h).matchAll(/<article class="tessera ritratto ([a-z]+)">([\s\S]*?)<\/article>/g)].map((m) => ({ colore: m[1], html: m[2] }))

console.log('\n1. Un testo che comincia con un h3 è una griglia di ritratti')
{
  const h = pagina(`${tredici}${CHIUSURA}`)
  const r = ritratti(h)
  ok('13 ritratti in una sola griglia «ritratti»', [conta(main(h), /<div class="ritratti">/g), r.length], [1, 13])
  ok('la griglia sta in una sezione, senza titolo', /<section class="sezione ritratti-sezione"><div class="ritratti">/.test(main(h)), true)
  ok('con la foto: il cerchio contiene l’immagine', /^<span class="ritratto-foto"><img [^>]*alt="Maurizio"[^>]*><\/span>/.test(r[0].html), true)
  ok('nome e ruolo stanno insieme, in basso', /<div class="ritratto-testo"><h3>Maurizio<\/h3><p>Cognome 0 · Judo<\/p><\/div>$/.test(r[0].html), true)
  ok('senza foto: il cerchio ha l’iniziale e non si legge', r[1].html.startsWith('<span class="ritratto-foto" aria-hidden="true">D</span>'), true)
  ok('il paragrafo dopo l’ultimo ritratto è testo sotto la griglia, non un ritratto', [/<\/section><div class="testo"><p>Ogni istruttore ha la sua pagina\.<\/p><\/div>/.test(main(h)), conta(r[12].html, /Ogni istruttore/g)], [true, 0])
  ok('senza paragrafo di chiusura, niente testo', /<div class="testo">/.test(main(pagina(tredici))), false)
  ok('il ritratto senza ruolo è solo nome e cerchio', ritratti(pagina('<h3>A</h3><p>x</p><h3>B</h3><h3>C</h3><p>z</p>')).map((x) => /<p>/.test(x.html)), [true, false, true])
}

console.log('\n2. I colori sono quelli del design')
{
  const colori = ritratti(pagina(tredici)).map((x) => x.colore)
  ok('i tredici ritratti hanno i colori disegnati, uno per uno', colori, ['giallo', 'blu', 'inchiostro', 'blu', 'inchiostro', 'giallo', 'inchiostro', 'giallo', 'blu', 'blu', 'inchiostro', 'blu', 'inchiostro'])
  ok('oltre i tredici la sequenza ricomincia', ritratti(pagina(tredici + R('Z', 'x'))).map((x) => x.colore)[13], 'giallo')
}

console.log('\n3. Il link nel nome rende la tessera cliccabile')
{
  const h = pagina(`<h3><a href="/istruttori/maurizio/">Maurizio</a></h3>${FOTO}<p>Innella</p><h3>Diana</h3><p>Ballabio</p>`)
  ok('il link nel nome resta', /<h3><a href="\/istruttori\/maurizio\/">Maurizio<\/a><\/h3>/.test(h), true)
  ok('l’iniziale viene dal nome, non dal tag', ritratti(pagina(`<h3><a href="/a/">Diana</a></h3><p>x</p><h3>B</h3><p>y</p>`))[0].html.startsWith('<span class="ritratto-foto" aria-hidden="true">D</span>'), true)
  ok('la tessera col link è tutta cliccabile (il link si allarga con ::after)', /\.ritratto h3 a::after\{[^}]*position:\s*absolute[^}]*inset:\s*0/.test(CSS), true)
  ok('la freccia ↗ c’è solo se c’è il link (:has) e non si legge', [/\.ritratto:has\(h3 a\)::after\{[^}]*content:\s*"↗"\s*\/\s*""/.test(CSS)], [true])
}

console.log('\n4. Quel che non è una pagina di ritratti resta com’era')
{
  ok('un solo h3: nessuna griglia', conta(main(pagina(R('A', 'x'))), /ritratti/g), 0)
  ok('con un h2 prima: le tessere di sempre', conta(main(pagina(`<h2>S</h2>${R('A', 'x')}${R('B', 'y')}`)), /ritratti/g), 0)
  ok('con un h2 dopo: le tessere di sempre', conta(main(pagina(`${R('A', 'x')}${R('B', 'y')}<h2>S</h2><p>t</p>`)), /ritratti/g), 0)
  ok('un paragrafo prima del primo h3: resta una colonna', conta(main(pagina(`<p>Ciao</p>${R('A', 'x')}${R('B', 'y')}`)), /ritratti/g), 0)
  ok('la Home non cambia: il collage resta', conta(pagina(`<img src="${P}a.jpg" alt="a"><img src="${P}b.jpg" alt="b"><h2>S</h2><p>t</p>`, 'home'), /class="collage"/g), 1)
}

console.log('\n5. La testata senza collage: titolo a sinistra, descrizione e pulsante a destra')
{
  const h = pagina(tredici)
  ok('la testata ha la classe «solo»', /<section class="pagina-hero( interna)? solo">/.test(h), true)
  ok('la Home col collage non la ha', /pagina-hero solo/.test(pagina(`<img src="${P}a.jpg" alt="a"><img src="${P}b.jpg" alt="b"><h2>S</h2><p>t</p>`, 'home')), false)
  ok('titolo, descrizione e pulsante sono nello stesso blocco «intro»', /<div class="intro"><h1>Gli istruttori<\/h1><p>d<\/p><div><a class="pulsante" href="\/contatti\/">Contattaci<\/a><\/div><\/div>/.test(h), true)
  const intro = dentro(/^\s*\.pagina-hero\.solo \.intro\s*$/)
  ok('a destra una colonna da 520px, a sinistra il titolo, tutto in basso (grid, align-items:end)', [/display:\s*grid/.test(intro), /grid-template-columns:\s*1fr 520px/.test(intro), /align-items:\s*end/.test(intro), /gap:\s*0 56px/.test(intro)], [true, true, true, true])
  ok('il titolo occupa le due righe della colonna di destra', /grid-row:\s*1 \/ span 2/.test(dentro(/^\s*\.pagina-hero\.solo h1\s*$/)), true)
  ok('il titolo è 200px a 1440px (13.9vw) e 80px sul telefono', [/font-size:\s*clamp\(80px,\s*13\.9vw,\s*200px\)/.test(dentro(/^\s*\.pagina-hero\.solo h1\s*$/))], [true])
  ok('interlinea .82 sul computer, .84 sul telefono', [/line-height:\s*\.82/.test(dentro(/^\s*\.pagina-hero\.solo h1\s*$/)), /\.pagina-hero\.solo h1\{[^}]*line-height:\s*\.84/.test(TELEFONO)], [true, true])
  ok('la descrizione ha 28px sotto; il pulsante sta a destra', [px(/^\s*\.pagina-hero\.solo \.intro p\s*$/, 'margin-bottom'), /grid-column:\s*2/.test(dentro(/^\s*\.pagina-hero\.solo \.intro p\s*$/))], [28, true])
  ok('72px sotto il titolo, 40 sopra', /padding:\s*40px var\(--margine\) 72px/.test(dentro(/^\s*\.pagina-hero\.solo\s*$/)), true)
  ok('sul telefono: una colonna, 20px sopra e 36 sotto, descrizione 18px con 22 sotto', [/\.pagina-hero\.solo \.intro\{[^}]*grid-template-columns:\s*1fr[;}]/.test(TELEFONO), /\.pagina-hero\.solo\{[^}]*padding:\s*20px var\(--margine\) 36px/.test(TELEFONO), telefono('\\.pagina-hero\\.solo \\.intro p', 'margin-bottom')], [true, true, 22])
}

{
  ok('sul telefono il pulsante è più basso: 52px, 26px di fianco, 17px', [telefono('\\.pagina-hero\\.solo \\.pulsante', 'min-height'), telefono('\\.pagina-hero\\.solo \\.pulsante', 'font-size'), /\.pagina-hero\.solo \.pulsante\{[^}]*padding:\s*0 26px/.test(TELEFONO)], [52, 17, true])
}

console.log('\n6. Le misure del design: computer (1440px)')
{
  const g3 = dentro(/^\s*\.ritratti\s*$/)
  ok('tre colonne a filo (gap 6)', [/grid-template-columns:\s*repeat\(3,\s*1fr\)/.test(g3), px(/^\s*\.ritratti\s*$/, 'gap')], [true, 6])
  ok('ogni ritratto occupa una colonna', /\.ritratti article\{[^}]*grid-column:\s*auto/.test(CSS), true)
  const t = dentro(/^\s*\.ritratti-sezione \.ritratti article\.ritratto\s*$/)
  ok('tessera: padding 24px 26px, alta almeno 380px, foto in alto e testo in basso', [/padding:\s*24px 26px/.test(t), px(/^\s*\.ritratti-sezione \.ritratti article\.ritratto\s*$/, 'min-height'), /justify-content:\s*space-between/.test(t)], [true, 380, true])
  // La regola delle sezioni (`.sezione .tessera:not(.foto)`, a 901px, 3 classi) viene dopo: perde solo con più specificità (l'elemento `article`).
  ok('l’altezza della tessera batte quella delle sezioni (3 classi e l’elemento)', /^\s*\.ritratti-sezione \.ritratti article\.ritratto\s*$/.test(regola(/article\.ritratto/)?.[1] ?? ''), true)
  ok('il cerchio è 140px, tondo', [px(/^\s*\.ritratto-foto\s*$/, 'width'), px(/^\s*\.ritratto-foto\s*$/, 'height'), /border-radius:\s*50%/.test(dentro(/^\s*\.ritratto-foto\s*$/))], [140, 140, true])
  ok('la foto riempie il cerchio, centrata un po’ sopra (50% 40%)', /\.ritratto-foto img\{[^}]*object-fit:\s*cover[^}]*object-position:\s*50% 40%/.test(CSS) || /\.ritratto-foto img\{[^}]*object-position:\s*50% 40%[^}]*object-fit:\s*cover/.test(CSS), true)
  ok('nome 54px con interlinea .95; ruolo 18px/1.45 con 10px sopra', [px(/^\s*\.ritratti h3\s*$/, 'font-size'), /line-height:\s*\.95/.test(dentro(/^\s*\.ritratti h3\s*$/)), px(/^\s*\.ritratto-testo p\s*$/, 'font-size'), /line-height:\s*1\.45/.test(dentro(/^\s*\.ritratto-testo p\s*$/)), /margin:\s*10px 0 0/.test(dentro(/^\s*\.ritratto-testo p\s*$/))], [54, true, 18, true, true])
  ok('la freccia è nell’angolo in alto a destra, 44px', [px(/^\s*\.ritratto:has\(h3 a\)::after\s*$/, 'top'), px(/^\s*\.ritratto:has\(h3 a\)::after\s*$/, 'right'), px(/^\s*\.ritratto:has\(h3 a\)::after\s*$/, 'font-size')], [24, 26, 44])
  ok('i cerchi senza foto: chiaro su giallo e blu, blu su inchiostro', [/\.ritratto\.giallo \.ritratto-foto,\.ritratto\.blu \.ritratto-foto\{[^}]*background:\s*var\(--chiara\)/.test(CSS), /\.ritratto\.inchiostro \.ritratto-foto\{[^}]*background:\s*var\(--blu\)/.test(CSS)], [true, true])
  ok('il testo di chiusura: 24px, 96px sotto la griglia (nessun 40 di padding), largo 900', [px(/^\s*\.ritratti-sezione \+ \.testo\s*$/, 'font-size'), /padding:\s*0 var\(--margine\)/.test(dentro(/^\s*\.ritratti-sezione \+ \.testo\s*$/)), /max-width:\s*calc\(900px \+ var\(--margine\) \* 2\)/.test(dentro(/^\s*\.ritratti-sezione \+ \.testo\s*$/))], [24, true, true])
}

console.log('\n7. Le misure del design: telefono')
{
  ok('due colonne', /\.ritratti\{[^}]*grid-template-columns:\s*repeat\(2,\s*1fr\)/.test(TELEFONO), true)
  ok('tessera: padding 16, alta 230, 12px tra cerchio e testo', [/\.ritratti-sezione \.ritratti article\.ritratto\{[^}]*padding:\s*16px[;}]/.test(TELEFONO), telefono('\\.ritratti-sezione \\.ritratti article\\.ritratto', 'min-height'), px(/^\s*\.ritratti-sezione \.ritratti article\.ritratto\s*$/, 'gap')], [true, 230, 12])
  ok('cerchio 84px, nome 34px, ruolo 14px con 6px sopra', [telefono('\\.ritratto-foto', 'width'), telefono('\\.ritratto-foto', 'height'), telefono('\\.ritratti h3', 'font-size'), telefono('\\.ritratto-testo p', 'font-size'), /\.ritratto-testo p\{[^}]*margin-top:\s*6px/.test(TELEFONO)], [84, 84, 34, 14, true])
  ok('sul telefono non c’è la freccia', /\.ritratto:has\(h3 a\)::after\{[^}]*display:\s*none/.test(TELEFONO), true)
}

console.log('\n8. La cornice (testata, invito, piede) con le misure del design')
{
  const ri = (re) => dentro(re)
  const logo = ri(/^\s*\.logo img\s*$/)
  ok('testata: 22px sopra e sotto, logo alto 110px (82px sul telefono)', [/padding:\s*22px var\(--margine\)/.test(ri(/^\s*\.testata\s*$/)), px(/^\s*\.logo img\s*$/, 'height'), /\.logo img\{[^}]*height:\s*82px/.test(TELEFONO)], [true, 110, true])
  ok('sul telefono le voci sono alte 44px, 14px di fianco, su fondo chiaro, con 6px tra loro', [/\.testata nav a\{[^}]*min-height:\s*44px/.test(TELEFONO), /\.testata nav a\{[^}]*padding:\s*0 14px/.test(TELEFONO), /\.testata nav a\{[^}]*background:\s*var\(--chiara\)/.test(TELEFONO), /\.testata nav ul\{[^}]*gap:\s*6px/.test(TELEFONO)], [true, true, true, true])
  ok('pulsante in testata: 26px di fianco, 22 sul telefono', [/padding:\s*0 26px/.test(ri(/^\s*\.pulsante\.piccolo\s*$/)), /\.testata \.pulsante\{[^}]*padding:\s*0 22px/.test(TELEFONO)], [true, true])
  const h = pagina(tredici)
  const conMenu = g.generaSito({ dominio: 'https://officinedellosport.it', pagine: [{ slug: 'istruttori', titolo: 'T', descrizione: '', testo: '' }, { slug: 'contatti', titolo: 'C', descrizione: '', testo: '' }], menu: [{ dove: 'menu', ordine: 1, etichetta: 'Chi siamo', slug: 'istruttori', indirizzo: null }, { dove: 'menu', ordine: 2, etichetta: 'Contattaci', slug: 'contatti', indirizzo: null }], rinvii: [] })['istruttori/index.html']
  ok('la voce del menu della pagina aperta ha aria-current, le altre no', [conta(conMenu, /<a [^>]*aria-current="page"/g), /<a href="\/istruttori\/" aria-current="page">Chi siamo<\/a>/.test(conMenu)], [1, true])
  const inv = ri(/^\s*\.invito\s*$/)
  ok('invito sul telefono: 22px di padding, alto 260px, frase 17px', [/\.invito\{[^}]*padding:\s*22px/.test(TELEFONO), /\.invito\{[^}]*min-height:\s*260px/.test(TELEFONO), /\.invito \.frase\{[^}]*font-size:\s*17px/.test(TELEFONO)], [true, true, true])
  const pie = ri(/^\s*\.piede\s*$/)
  ok('piede sul telefono: 24px di padding e di margine sotto', [/\.piede\{[^}]*margin-bottom:\s*24px/.test(TELEFONO), /\.piede\{[^}]*padding:\s*24px/.test(TELEFONO)], [true, true])
}

console.log('\n9. Le differenze che restavano: pulsante corto, invito, piede, testo sul telefono')
{
  const h = pagina(tredici)
  ok('l’invito dice anche della settimana a 5 euro, come nel design', />Vieni a provare: ti aspettiamo in Via Sassi 26, Collegno\. Una settimana a 5 euro: provi tutte le discipline e scegli\.<\/span>/.test(h), true)
  const pie = (h.match(/<footer[\s\S]*?<\/footer>/) || [''])[0]
  ok('instagram e facebook stanno su una riga, divisi da «·» (li in linea, il separatore è CSS)', [/\.recapiti li:nth-child\(n\+3\)\{[^}]*display:\s*inline/.test(CSS), /\.recapiti li:nth-child\(4\)::before\{[^}]*content:\s*" · "/.test(CSS)], [true, true])
  const voci = [{ dove: 'menu', ordine: 1, etichetta: 'Home', slug: 'istruttori', indirizzo: null }, { dove: 'footer', ordine: 1, etichetta: 'Privacy', slug: null, indirizzo: '/privacy/' }]
  const conVoci = (g.generaSito({ dominio: 'https://officinedellosport.it', pagine: [{ slug: 'istruttori', titolo: 'T', descrizione: '', testo: '' }], menu: voci, rinvii: [] })['istruttori/index.html'].match(/<footer[\s\S]*?<\/footer>/) || [''])[0]
  const pi = dentro(/^\s*\.piede\s*$/)
  ok('sul telefono il testo sotto la griglia non c’è (il design telefono non lo ha)', /\.ritratti-sezione \+ \.testo\{[^}]*display:\s*none/.test(TELEFONO), true)
  ok('e allora la griglia non lascia i 96px sotto: l’invito sta a 48px', /\.ritratti-sezione\{[^}]*padding-bottom:\s*0/.test(TELEFONO), true)
}

console.log(guai ? `\n✗ ${guai} casi falliti` : '\nTutto a posto.')
process.exit(guai ? 1 : 0)
