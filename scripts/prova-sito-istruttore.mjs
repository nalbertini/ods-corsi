// ---------------------------------------------------------------------------
// La pagina di un istruttore come nel design «tatami blu e giallo», senza browser.
//
//   node scripts/prova-sito-istruttore.mjs
//
// Design: docs/design-canvas/sito-rebrand/TatamiBlu-Istruttore.dc.html (computer, 1440px)
// e TatamiBluM-Istruttore.dc.html (telefono). Regola di testo: docs/sito/istruttore.md.
// Una pagina (non la Home, non di legge) il cui testo comincia con una foto e una
// citazione è «di persona»: testata a due colonne, ritratto con citazione, tessere.
// Il CSS si legge come testo e i `clamp()` si calcolano a 1440px.
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
const conta = (x, re) => (x.match(re) || []).length
const li = (a) => `<ul>${a.map((x) => `<li>${x}</li>`).join('')}</ul>`
const TESTO = `<img src="/r.svg" alt="Maurizio Innella"><blockquote><p>Lo sport è scuola.</p><p><em>Maurizio</em></p></blockquote>` +
  li(['<strong>Ruolo</strong> Presidente', '<strong>Corsi</strong> Judo', '<strong>Quando</strong> Lun e mer', '<strong>Titoli</strong> V Dan']) +
  `<h3>Chi è</h3><p>Docente.</p><h3>Come ha iniziato</h3><p>Dal 1989.</p><h3>Come insegna</h3><p>Dal 2000.</p><h2>Il percorso</h2><h3>Scuola</h3><p>Sì.</p><h2>Fuori dal tatami</h2><p>Assistente bagnanti con estensione MIP.</p>`
const dati = (slug, testo) => ({ dominio: 'https://officinedellosport.it', pagine: [{ slug, titolo: 'Maurizio Innella', descrizione: 'Maestro di Judo.', testo }, { slug: 'contatti', titolo: 'C', descrizione: '', testo: '<p>c</p>' }, { slug: 'chi-siamo', titolo: 'Chi siamo', descrizione: '', testo: '<p>x</p>' }], menu: [['Home', '/'], ['Chi siamo', 'chi-siamo'], ['Contattaci', 'contatti']].map(([e, sl], i) => ({ dove: 'menu', ordine: i, etichetta: e, slug: sl === '/' ? null : sl, indirizzo: sl === '/' ? '/' : null })).concat([{ dove: 'footer', ordine: 9, etichetta: 'Privacy policy', slug: null, indirizzo: '/privacy/' }]), rinvii: [] })
const file = (slug, testo, extra = {}) => g.generaSito({ ...dati(slug, testo), ...extra })
const pagina = (testo, slug = 'maurizio') => file(slug, testo)[`${slug}/index.html`] ?? ''
const h = pagina(TESTO)
const CSS = (h.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? '').replace(/\/\*[\s\S]*?\*\//g, '')
const regole = [...CSS.matchAll(/([^{}@]+)\{([^{}]*)\}/g)].map((m) => ({ sel: m[1].trim(), dich: m[2] }))
const regola = (sel) => regole.filter((r) => r.sel.split(',').map((x) => x.trim()).includes(sel)).map((r) => r.dich).join(';')
const proprieta = (sel, p) => (regola(sel).match(new RegExp(`(?:^|;)\\s*${p}:\\s*([^;]*)`)) || [, ''])[1].trim()
// Il valore in px a 1440px di un `clamp(min, ideale, max)` o di un numero in px.
const px = (v) => {
  const c = /^clamp\(([^,]+),([^,]+),([^)]+)\)$/.exec(v.replace(/\s+/g, ''))
  const un = (x) => (x.endsWith('vw') ? (parseFloat(x) * 1440) / 100 : parseFloat(x))
  return c ? Math.min(Math.max(un(c[2]), un(c[1])), un(c[3])) : parseFloat(v)
}
const tel = (re) => (CSS.match(new RegExp(`@media \\(max-width:900px\\)\\{([\\s\\S]*?)\\}\\n?(?=@media|$)`)) || [, ''])[1]

console.log('\n1. Quando una pagina è «di persona»')
{
  ok('foto e citazione in apertura: <main class="persona">', /<main class="persona">/.test(h), true)
  ok('la Home con le stesse prime righe non lo è', /class="persona"/.test(file('home', TESTO)['index.html']), false)
  ok('una pagina senza foto e citazione in apertura non lo è', /class="persona"/.test(pagina('<p>Ciao</p><h2>A</h2><p>b</p>')), false)
  ok('prima la foto, poi un paragrafo: non lo è', /class="persona"/.test(pagina(`<img src="/r.svg" alt="x"><p>Ciao</p><blockquote><p>q</p></blockquote>`)), false)
}

console.log('\n2. La testata: nome grande a sinistra, frase e pulsante a destra')
{
  ok('nella testata c’è l’h1 e la colonna «lato» con la frase («Contattaci» sta in alto)', /<section class="pagina-hero persona-hero"><h1>Maurizio Innella<\/h1><div class="lato"><p>Maestro di Judo\.<\/p><\/div><\/section>/.test(h), true)
  ok('l’h1 è di 150px a 1440px', px(proprieta('.persona-hero h1', 'font-size')), 150)
  ok('interlinea .82 e il nome sta in basso a sinistra (flex:1, allineato in basso)', [proprieta('.persona-hero h1', 'line-height'), proprieta('.persona-hero h1', 'flex'), /align-items:\s*flex-end/.test(regola('.persona-hero'))], ['.82', '1', true])
  ok('la colonna di destra è larga 520px e non si stringe', px((proprieta('.persona-hero .lato', 'flex') || '').split(/\s+/)[2] ?? ''), 520)
  ok('la frase è di 22px, interlinea 1.45, con 28px sotto', [px(proprieta('.persona-hero .lato p', 'font-size')), proprieta('.persona-hero .lato p', 'line-height'), proprieta('.persona-hero .lato p', 'margin')], [22, '1.45', '0 0 28px'])
  ok('sotto la testata 72px', (proprieta('.persona-hero', 'padding').split(/\s+/)[2] ?? ''), '72px')
}

console.log('\n3. Il ritratto: foto col nome e citazione blu')
{
  const r = h.match(/<section class="sezione apertura">([\s\S]*?)<\/section>/)?.[1] ?? ''
  ok('la sezione di apertura non ha titolo grande', /<h2/.test(r), false)
  ok('prima il ritratto: foto con il nome (l’alt) in didascalia, poi la citazione blu', /^<div class="ritratto"><figure class="tessera foto"><img alt="Maurizio Innella" src="\/r\.svg" \/><figcaption><span class="nome">Maurizio Innella<\/span><\/figcaption><\/figure><blockquote class="tessera citazione blu larga">/.test(r), true)
  ok('poi le 4 tessere dell’elenco e le 3 dei sottotitoli', [conta(r, /<div class="tessere n-4 fila-4">/g), conta(r, /<div class="tessere n-3 fila-3">/g)], [1, 1])
  ok('la foto e la citazione non compaiono due volte', [conta(h, /<figure class="tessera foto"><img alt="Maurizio Innella"/g), conta(h, /<blockquote/g)], [1, 1])
  ok('il ritratto è alto 620px, con la citazione larga 560px', [px(proprieta('.persona .ritratto', 'height')), proprieta('.persona .ritratto', 'grid-template-columns')], [620, 'minmax(0,1fr) minmax(0,560px)'])
  ok('il nome sulla foto: inchiostro, bianco, display 44px, in basso a sinistra', [proprieta('.persona .ritratto figcaption', 'background'), proprieta('.persona .ritratto figcaption', 'color'), px(proprieta('.persona .ritratto figcaption', 'font-size')), proprieta('.persona .ritratto figcaption', 'position'), proprieta('.persona .ritratto figcaption', 'left'), proprieta('.persona .ritratto figcaption', 'bottom')], ['var(--inchiostro)', '#fff', 44, 'absolute', '0', '0'])
  ok('la foto riempie il riquadro, la testa in alto (50% 34%)', [proprieta('.persona .ritratto .foto img', 'height'), proprieta('.persona .ritratto .foto img', 'object-position')], ['100%', '50% 34%'])
  ok('la citazione è di 30px; la firma è il nome in display 44px, senza avatar', [px(proprieta('.persona .ritratto .citazione', 'font-size')), px(proprieta('.persona .ritratto .firma', 'font-size')), proprieta('.persona .ritratto .avatar', 'display')], [30, 44, 'none'])
  ok('padding 36px nella citazione', proprieta('.persona .ritratto .citazione', 'padding'), '36px')
}

console.log('\n4. Le tessere')
{
  ok('le griglie dell’apertura hanno la classe fila-N (la prima da 4, la seconda da 3)', [conta(h, /<div class="tessere n-4 fila-4">/g), conta(h, /<div class="tessere n-3 fila-3">/g)], [1, 1])
  ok('anche quella sotto un titolo grande (la tessera del percorso e «Fuori dal tatami»)', conta(h.split('<h2>Il percorso</h2>')[1] ?? '', /<div class="tessere n-\d fila-\d">/g), 2)
  ok('una pagina che non è di persona non le ha', /<div class="tessere n-\d fila-/.test(pagina('<h2>A</h2><h3>x</h3><p>y</p>')), false)
  ok('le 4 tessere dell’apertura stanno su 4 colonne, alte 220px, titolo 52px, testo 18px', [proprieta('.persona .fila-4', 'grid-template-columns'), px(proprieta('.persona .apertura .fila-4>article', 'min-height')), px(proprieta('.persona .apertura .fila-4 h3', 'font-size')), px(proprieta('.persona .apertura .fila-4 .tessera', 'font-size'))], ['repeat(4,1fr)', 220, 52, 18])
  ok('e ognuna sta in una colonna (non span 3)', proprieta('.persona .tessere.fila-4>article', 'grid-column'), 'auto')
  ok('le 3 tessere dell’apertura: alte 400px, titolo 64px, testo 19px, 30px di margine interno', [px(proprieta('.persona .apertura .fila-3>article', 'min-height')), px(proprieta('.persona .apertura .tessere h3', 'font-size')), px(proprieta('.persona .apertura .tessere .tessera', 'font-size')), proprieta('.persona .apertura .tessere .tessera', 'padding')], [400, 64, 19, '30px'])
  ok('tra le 4 e le 3 tessere 96px', proprieta('.persona .apertura>.tessere+.tessere', 'margin-top'), '96px')
  ok('le tessere delle sezioni col titolo: alte 520px, titolo 48px, testo 16px', [px(proprieta('.persona .sezione:not(.apertura) .tessere>article', 'min-height')), px(proprieta('.persona .sezione:not(.apertura) h3', 'font-size')), px(proprieta('.persona .sezione:not(.apertura) .tessera', 'font-size'))], [520, 48, 16])
  ok('titolo in alto e testo in basso (space-between)', proprieta('.persona .tessera', 'justify-content'), 'space-between')
  ok('le tessere con una foto (gli altri istruttori) l’hanno tonda da 110px, alte 250px', [proprieta('.persona article>img', 'border-radius'), px(proprieta('.persona article>img', 'width')), proprieta('.persona article>img', 'aspect-ratio'), px(proprieta('.persona .sezione:not(.apertura) .tessere>article:has(>img)', 'min-height'))], ['50%', 110, '1', 250])
  ok('le tessere hanno il testo a interlinea 1.45', proprieta('.persona .tessera', 'line-height'), '1.45')
}

console.log('\n5. Sul telefono')
{
  const T = tel()
  const dentro = (re) => re.test(T)
  ok('la testata (come ogni pagina) va in colonna, il nome è di 70px a 390px', [dentro(/\.pagina-hero\{[^}]*flex-direction:\s*column/), /\.persona-hero h1\{[^}]*font-size:\s*70px/.test(T)], [true, true])
  ok('la colonna di destra non ha più larghezza fissa', dentro(/\.persona-hero \.lato\{[^}]*flex:\s*none/), true)
  ok('il ritratto è una colonna: foto da 320px, citazione sotto con 6px', [dentro(/\.ritratto\{[^}]*grid-template-columns:\s*1fr/), dentro(/\.ritratto\{[^}]*height:\s*auto/), dentro(/\.ritratto \.foto\{[^}]*height:\s*320px/)], [true, true, true])
  ok('le 4 tessere: due colonne', dentro(/\.persona \.fila-4\{[^}]*repeat\(2,\s*1fr\)/), true)
  ok('titoli più piccoli: 34px le 4 tessere, 40px le 3', [/\.persona \.apertura \.fila-4 h3\{[^}]*font-size:\s*34px/.test(T), /\.persona \.apertura \.tessere h3\{[^}]*font-size:\s*40px/.test(T)], [true, true])
  ok('il nome sulla foto non c’è (il nome è già nel titolo)', dentro(/\.ritratto figcaption\{[^}]*display:\s*none/), true)
}

console.log('\n6. Testata, invito e piede come nel design (solo nelle pagine di persona)')
{
  const T = tel()
  const T1 = 'body:has(.persona)'
}

console.log('\n7. Le differenze che restavano: menu, ruolo, «Fuori dal tatami», colori, piede')
{
  const T = tel()
  ok('le altre pagine non hanno voci attive', /class="attiva"/.test(file('home', TESTO)['index.html']), false)
  // La testata ha le sue regole in coda al CSS (CSS_TESTATA): non nel primo blocco @media del telefono.
  const TT = CSS.slice(CSS.indexOf('.tasto-menu,.testata .chiudi'))
  ok('sul telefono il tasto MENU sta a fianco del logo: il menu è chiuso e la testata non va a capo', [/\.testata \.tasto-menu\{[^}]*display:\s*inline-flex/.test(TT) && /#menu\{[^}]*display:\s*none/.test(TT), /\.testata\{[^}]*flex-wrap:\s*nowrap/.test(TT)], [true, true])
  const ruolo = pagina(TESTO.replace('alt="Maurizio Innella"', 'alt="Maurizio Innella — Maestro di Judo V Dan"'))
  ok('l’alt «Nome — ruolo»: il nome grande e il ruolo sotto, a 16px', [/<figcaption><span class="nome">Maurizio Innella<\/span><span class="ruolo">Maestro di Judo V Dan<\/span><\/figcaption>/.test(ruolo), px(proprieta('.persona .ritratto figcaption .ruolo', 'font-size'))], [true, 16])
  ok('la didascalia ha l’angolo in alto a destra a 6px', proprieta('.persona .ritratto figcaption', 'border-top-right-radius'), '6px')
  const f = h.match(/<section class="sezione solo">([\s\S]*?)<\/section>/)?.[1] ?? ''
  ok('«Fuori dal tatami» (titolo e solo paragrafi) è una tessera blu larga come la riga', /^<div class="tessere n-1 fila-1"><article class="tessera blu"><h2>Fuori dal tatami<\/h2><p>Assistente bagnanti/.test(f), true)
  ok('quella tessera: alta 160px, 28px di margine, titolo 44px, testo 18px', [px(proprieta('.persona .sezione.solo:not(.apertura) .tessere>article', 'min-height')), proprieta('.persona .sezione.solo:not(.apertura) .tessera', 'padding'), px(proprieta('.persona .sezione.solo h2', 'font-size')), px(proprieta('.persona .sezione.solo:not(.apertura) .tessera', 'font-size'))], [160, '28px', 44, 18])
  ok('sta a 6px dalla sezione che precede (non a 96)', proprieta('.persona .sezione:has(+ .solo)', 'padding-bottom'), '6px')
  ok('l’ultima sezione non aggiunge spazio: sotto ci sono già i 96px dell’invito', proprieta('.persona .sezione:last-child', 'padding-bottom'), '0')
  ok('una sezione con titolo e un solo paragrafo, in una pagina non di persona, resta com’è', /sezione solo/.test(pagina('<h2>A</h2><p>b</p>')), false)
  ok('il titolo grande delle sezioni ha interlinea .85', proprieta('.persona .sezione h2', 'line-height'), '.85')
  ok('gli elenchi nelle tessere hanno il pallino davanti, senza rientro', [proprieta('.persona .tessera ul', 'list-style'), proprieta('.persona .tessera li::before', 'content')], ['none', '"• "'])
  const c = (sel) => proprieta(sel, 'background')
  ok('colori come nel design: 4 in riga giallo, blu, inchiostro, giallo', [1, 2, 3, 4].map((i) => c(`.persona .apertura .fila-4 .tessera:nth-child(${i})`)), ['var(--giallo)', 'var(--blu)', 'var(--inchiostro)', 'var(--giallo)'])
  ok('le 3 sotto: chiara, giallo, blu', [1, 2, 3].map((i) => c(`.persona .apertura .fila-3 .tessera:nth-child(${i})`)), ['var(--chiara)', 'var(--giallo)', 'var(--blu)'])
  ok('il percorso: inchiostro, giallo, chiara', [1, 2, 3].map((i) => c(`.persona .sezione:not(.apertura) .fila-3 .tessera:nth-child(${i})`)), ['var(--inchiostro)', 'var(--giallo)', 'var(--chiara)'])
  ok('gli altri istruttori: giallo, blu, inchiostro, giallo', [1, 2, 3, 4].map((i) => c(`.persona .sezione:not(.apertura) .fila-4 .tessera:nth-child(${i})`)), ['var(--giallo)', 'var(--blu)', 'var(--inchiostro)', 'var(--giallo)'])
  ok('il testo sulle tessere gialle e chiare è inchiostro, sulle altre bianco', [proprieta('.persona .apertura .fila-4 .tessera:nth-child(1)', 'color'), proprieta('.persona .apertura .fila-4 .tessera:nth-child(2)', 'color')], ['var(--inchiostro)', '#fff'])
  ok('sul telefono le altezze del design: 260, 240, 220 e 420, 320, 340', [260, 240, 220].map((v, i) => new RegExp(`\\.persona \\.apertura \\.fila-3>article:nth-child\\(${i + 1}\\)\\{[^}]*min-height:\\s*${v}px`).test(T)).concat([420, 320, 340].map((v, i) => new RegExp(`\\.persona \\.sezione:not\\(\\.apertura\\) \\.fila-3>article:nth-child\\(${i + 1}\\)\\{[^}]*min-height:\\s*${v}px`).test(T))), [true, true, true, true, true, true])
  const p = h.match(/<footer class="piede">([\s\S]*?)<\/footer>/)?.[1] ?? ''
  const inv = h.match(/<a class="invito"[\s\S]*?<\/a>/)?.[0] ?? ''
}

console.log(guai ? `\n${guai} da correggere` : '\nTutto a posto')
process.exit(guai ? 1 : 0)
