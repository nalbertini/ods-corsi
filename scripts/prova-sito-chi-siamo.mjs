// ---------------------------------------------------------------------------
// La pagina Chi siamo come nel design «tatami blu e giallo», senza browser.
//
//   node scripts/prova-sito-chi-siamo.mjs
//
// Il testo prima del primo titolo grande (`h2`) si legge a fasce, in ordine:
//  1. una foto e una citazione sole: foto a sinistra, frase grande gialla a destra;
//  2. uno o più `h3` di fila con i loro paragrafi: uno solo è un pannello, più sono tessere larghe;
//  3. un elenco con il grassetto iniziale: i numeri grandi, uno accanto all'altro;
//  4. foto di fila: la fila di foto (quattro: la fascia alta).
// Senza foto né `h3` l'introduzione resta testo in colonna, come prima.
// La testata senza collage (solo l'introduzione) ha il titolo a sinistra e il testo a destra (solo CSS).
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
const img = (n) => `<img src="${P}f${n}.jpg" alt="Foto ${n}" />`
const html = (testo) => g.generaSito({ dominio: 'https://officinedellosport.it', pagine: [{ slug: 'chi-siamo', titolo: 'T', descrizione: 'd', testo }], menu: [], rinvii: [], ospitiImmagini: [P] })['chi-siamo/index.html'] ?? ''
const conta = (x, re) => (x.match(re) || []).length
const fasce = (h) => conta(h, /<section class="sezione fascia">/g)

console.log('\n1. Foto e citazione sole: la frase grande accanto alla foto')
{
  const h = html(`${img(1)}<blockquote><p>Nasciamo dal judo</p></blockquote><h2>S</h2><p>x</p>`)
  ok('una fascia «slogan» con foto e frase gialla', [conta(h, /<div class="foto-citazioni slogan"><figure class="tessera foto">/g), conta(h, /<blockquote class="tessera slogan giallo"><p>Nasciamo dal judo<\/p><\/blockquote>/g)], [1, 1])
}

console.log('\n2. Gli h3 dell’introduzione: pannello se uno solo, tessere larghe se più')
{
  const due = html('<h3>A</h3><p>a</p><h3>B</h3><p>b</p><h2>S</h2><p>x</p>')
  ok('due h3: una griglia «ampie» con tessere chiara e blu', [conta(due, /<div class="tessere n-2 ampie">/g), conta(due, /<article class="tessera chiara">/g), conta(due, /<article class="tessera blu">/g)], [1, 1, 1])
  const uno = html('<h3>A</h3><p>a</p><p>b</p><h2>S</h2><p>x</p>')
  ok('un h3: un pannello a tutta riga, inchiostro, con tutti i paragrafi', [conta(uno, /<div class="tessere n-1 pannello"><article class="tessera inchiostro"><h3>A<\/h3><p>a<\/p><p>b<\/p>/g)], [1])
  const duePannelli = html(`<h3>A</h3><p>a</p>${img(1)}${img(2)}<h3>B</h3><p>b</p><h2>S</h2><p>x</p>`)
  ok('due pannelli separati: inchiostro poi giallo', [conta(duePannelli, /pannello"><article class="tessera inchiostro">/g), conta(duePannelli, /pannello"><article class="tessera giallo">/g)], [1, 1])
}

console.log('\n3. Un elenco con il grassetto iniziale: i numeri grandi')
{
  const h = html('<h3>A</h3><p>a</p><ul><li><strong>300+</strong> atleti</li><li><strong>9</strong> tecnici</li><li><strong>8</strong> attività</li><li><strong>35+</strong> anni</li></ul><h2>S</h2><p>x</p>')
  ok('4 numeri in una griglia «numeri»', [conta(h, /<div class="tessere n-4 numeri">/g), conta(h, /<strong class="cifra">/g)], [1, 4])
  ok('giallo, blu, inchiostro, giallo', [...h.matchAll(/<article class="tessera (\w+) numero">/g)].map((m) => m[1]), ['giallo', 'blu', 'inchiostro', 'giallo'])
}

console.log('\n4. Foto di fila in mezzo all’introduzione: la fila, a quattro la fascia alta')
{
  const h = html(`<h3>A</h3><p>a</p>${[1, 2, 3, 4].map(img).join('')}<h3>B</h3><p>b</p><h2>S</h2><p>x</p>`)
  ok('quattro foto: una fila «quattro»', conta(h, /<div class="foto-fila quattro">/g), 1)
}

console.log('\n5. Senza h3 né foto con citazione l’introduzione resta testo in colonna')
{
  const h = html('<p>Ciao</p><h2>S</h2><p>x</p>')
  ok('niente fasce, un «testo»', [fasce(h), conta(h, /<div class="testo"><p>Ciao<\/p><\/div>/g)], [0, 1])
}

console.log('\n6. Il CSS: titolo a sinistra e testo a destra senza collage')
{
  const css = html('<p>x</p>').match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? ''
  ok('la testata senza collage è una griglia a due colonne', /\.pagina-hero:has\(>\.intro:only-child\) \.intro\{display:grid;grid-template-columns:1fr minmax\(0,520px\)/.test(css), true)
  ok('titolo a 200px a 1440px', /\.intro h1\{grid-row:1 \/ span 2;font-size:clamp\(56px,13\.9vw,200px\)/.test(css), true)
}

console.log('\n7. Testata e invito come nel design')
{
  const h = g.generaSito({ dominio: 'https://officinedellosport.it', pagine: [{ slug: 'chi-siamo', titolo: 'T', descrizione: 'd', testo: '<p>x</p>' }, { slug: 'contatti', titolo: 'C', descrizione: '', testo: '' }], menu: [{ dove: 'menu', ordine: 1, etichetta: 'Chi siamo', slug: 'chi-siamo', indirizzo: null }, { dove: 'menu', ordine: 2, etichetta: 'Contattaci', slug: 'contatti', indirizzo: null }], rinvii: [] })['chi-siamo/index.html']
  ok('nella testata la pagina aperta è segnata (aria-current) e una sola', [conta(h, /aria-current="page"/g), /<a href="\/chi-siamo\/" aria-current="page">/.test(h)], [1, true])
  ok('l’invito dice anche della settimana a 5 euro', h.includes('Collegno. Una settimana a 5 euro: provi tutte le discipline e scegli.'), true)
  const css = h.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? ''
  ok('l’invito alto 300px, con margini della pagina e 36px 40px dentro', /\.invito\{margin:96px var\(--margine\) 6px;padding:36px 40px;min-height:300px\}/.test(css), true)
  ok('«Prova» a 170px a 1440px', /\.invito \.parola\{font-size:clamp\(96px,11\.8vw,170px\)\}/.test(css), true)
  ok('logo alto 110px e testata con 22px sopra e sotto', [/\.logo img\{height:110px\}/.test(css), /\.testata\{padding:22px var\(--margine\)\}/.test(css)], [true, true])
  ok('la pagina aperta è gialla', /\.testata nav a\[aria-current\]\{background:var\(--giallo\)\}/.test(css), true)
  ok('sul telefono le voci sono tessere azzurre da 44px con 14px ai lati e il logo è alto 82px', [/\.testata nav a\{background:var\(--chiara\);padding:0 14px\}/.test(css), /\.logo img\{height:82px\}/.test(css)], [true, true])
}

console.log('\n8. Valori, invito e piede come nel design')
{
  const css = html('<p>x</p>').match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? ''
  ok('il paragrafo prima delle tessere è da 24px a 1440px, largo 900px al massimo', [/\.colonna:has\(\+\.tessere\) p\{font-size:clamp\(19px,1\.67vw,24px\);line-height:1\.4\}/.test(css), /\.colonna:has\(\+\.tessere\)\{max-width:900px\}/.test(css)], [true, true])
  ok('le tessere dopo quel paragrafo hanno 26px 30px dentro, sul telefono 20px e titolo da 36px', [/\.colonna:has\(\+\.tessere\)\+\.tessere>\*\{padding:26px 30px;/.test(css), /\.colonna:has\(\+\.tessere\)\+\.tessere>\*\{padding:20px;font-size:16px;min-height:150px\}/.test(css), /\.colonna:has\(\+\.tessere\)\+\.tessere h3\{font-size:36px\}/.test(css)], [true, true, true])
  ok('il titolo di sezione sul telefono: almeno 56px, 20px sotto', [/\.sezione h2\{[^}]*font-size:clamp\(56px,9vw,120px\)/.test(css), /\.sezione h2\{margin-bottom:20px\}/.test(css)], [true, true])
  ok('sul telefono il pulsante della testata sta accanto al logo (padding stretto, 15px)', /\.testata \.pulsante\{padding:0 14px;font-size:15px\}/.test(css), true)
  ok('l’invito non ha spazio tra frase e «Prova» oltre a quello che li separa', /\.invito\{gap:0\}/.test(css), true)
  ok('il nome nel piede è 56px a 1440px e 44px sul telefono', /\.piede \.nome\{[^}]*font-size:clamp\(44px,3\.9vw,56px\)/.test(css), true)
}

console.log(guai ? `\n${guai} da sistemare` : '\nTutto bene')
process.exit(guai ? 1 : 0)
