// ---------------------------------------------------------------------------
// La pagina Contatti come nel design «tatami blu e giallo», senza browser.
//
//   node scripts/prova-sito-contatti.mjs
//
// La regola è in docs/sito/contatti.md: prima del primo titolo grande i `h3`
// sono le tessere dei recapiti (quattro colonne, giallo-blu-inchiostro-chiaro),
// il corpo di una tessera finisce alla prima foto; poi vengono la mappa (la
// prima foto), il pulsante delle indicazioni e la fila di foto, tutti nella
// stessa sezione. Le domande hanno le tessere a scacchiera giallo e chiaro.
// Il CSS si legge come testo.
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
const testo =
  '<h3>Telefono</h3><p>346 329 2786</p><h3>Instagram</h3><p>officine.dellosport</p><h3>Facebook</h3><p>Officine dello Sport</p>' +
  '<h3>Indirizzo</h3><p>Via Sassi 26, Collegno</p><p>A pochi metri dalla metropolitana Fermi</p>' +
  `${img(1)}<p><a class="pulsante" href="https://maps.example/x">Ottieni indicazioni</a></p>${img(2)}${img(3)}${img(4)}` +
  '<h2>Hai qualche domanda?</h2><p>Qui trovi le informazioni.</p>' + [1, 2, 3, 4, 5, 6].map((n) => `<h3>Domanda ${n}?</h3><p>Risposta ${n}</p>`).join('')
const genera = (slug, t) => g.generaSito({ dominio: 'https://officinedellosport.it', pagine: [{ slug: 'home', titolo: 'H', descrizione: 'd', testo: '<p>x</p>' }, { slug, titolo: 'T', descrizione: 'd', testo: t }], menu: [], rinvii: [], ospitiImmagini: [P] })
const html = genera('contatti', testo)['contatti/index.html']
const conta = (x, re) => (x.match(re) || []).length
const CSS = html.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? ''
const base = CSS.slice(0, CSS.indexOf('@media'))
const css = (sel) => [...base.matchAll(/([^{}@]+)\{([^{}]*)\}/g)].filter((m) => m[1].trim() === sel).map((m) => m[2]).join(';')
const apertura = (html.match(/<section class="sezione apertura">([\s\S]*?)<\/section>/) || [, ''])[1]

console.log('\n1. I recapiti: tessere prima del primo titolo grande')
{
  ok('una griglia da 4 tessere «recapiti» nella sezione di apertura', conta(apertura, /<div class="tessere n-4 recapiti">/g), 1)
  ok('i colori: giallo, blu, inchiostro, chiara', [...apertura.matchAll(/<article class="tessera (\w+)/g)].map((m) => m[1]), ['giallo', 'blu', 'inchiostro', 'chiara'])
  ok('il telefono è un valore breve, l’Instagram no', [...apertura.matchAll(/<article class="tessera \w+( breve)?">/g)].map((m) => Boolean(m[1])), [true, false, false, false])
  ok('l’indirizzo ha il valore e la nota', /<h3>Indirizzo<\/h3><p>Via Sassi 26, Collegno<\/p><p>A pochi metri dalla metropolitana Fermi<\/p>/.test(apertura), true)
  ok('l’ultima tessera non si prende la mappa', conta(apertura.split('</article></div>')[0], /<img/g), 0)
  ok('la mappa è la prima foto: larga, dopo le tessere', apertura.indexOf('tessera foto larga') > apertura.indexOf('recapiti'), true)
  ok('poi il pulsante «Ottieni indicazioni», poi la fila di 3 foto', [apertura.indexOf('Ottieni indicazioni') > apertura.indexOf('tessera foto larga'), apertura.indexOf('foto-fila') > apertura.indexOf('Ottieni indicazioni'), conta(apertura, /<div class="foto-fila">/g)], [true, true, 1])
  ok('le domande sono una sezione a parte con 6 tessere', conta(html.split('Hai qualche domanda?')[1], /<article class="tessera/g), 6)
  ok('senza foto dopo i recapiti la sezione è solo le tessere', (genera('contatti', '<h3>Telefono</h3><p>1</p><h3>Mail</h3><p>2</p>')['contatti/index.html'].match(/<section class="sezione apertura">([\s\S]*?)<\/section>/) || [, ''])[1].replace(/<article[\s\S]*?<\/article>/g, '').replace(/<\/?div[^>]*>/g, ''), '')
  ok('altre pagine: i titoli prima del primo grande restano un testo in colonna', /class="apertura"|sezione apertura/.test(genera('altra', testo)['altra/index.html']), false)
  ok('la pagina ha la sua classe su main, la Home no', [/<main class="pagina-contatti">/.test(html), /<main>/.test(g.generaSito({ dominio: 'https://officinedellosport.it', pagine: [{ slug: 'home', titolo: 'H', descrizione: 'd', testo: '<p>x</p>' }], menu: [], rinvii: [] })['index.html'])], [true, true])
}

console.log('\n2. Le misure del design a 1440px')
{
  ok('titolo da 200px', /clamp\(56px,\s*13\.9vw,\s*200px\)/.test(css('.pagina-contatti h1')), true)
  ok('titolo e testo affiancati, in basso, 56px di distanza', [/flex-wrap:\s*nowrap/.test(css('.pagina-contatti .pagina-hero')), /align-items:\s*flex-end/.test(css('.pagina-contatti .pagina-hero .intro')), /flex-direction:\s*row/.test(css('.pagina-contatti .pagina-hero .intro')), /gap:\s*56px/.test(css('.pagina-contatti .pagina-hero .intro'))], [true, true, true, true])
  ok('il titolo non si spezza a lettere (come nel design, sporge di 14px nello spazio)', /overflow-wrap:\s*break-word/.test(css('.pagina-contatti .pagina-hero .intro h1')), true)
  ok('il testo è largo 520px', /flex:\s*0 0 520px/.test(css('.pagina-contatti .pagina-hero .intro p')), true)
  ok('recapiti: titolo 56px, tessere alte 300px, padding 24px 26px', [/font-size:\s*56px/.test(css('.recapiti h3')), /minmax\(300px,\s*auto\)/.test(css('.recapiti')), /padding:\s*24px 26px/.test(css('.recapiti .tessera'))], [true, true, true])
  ok('quattro tessere per riga: 12 colonne, ognuna ne prende 3 (la regola n-4)', /repeat\(12,\s*1fr\)/.test(css('.recapiti')), true)
  ok('il valore è 36px, 44px se breve', [/font-size:\s*36px/.test(css('.recapiti p:first-of-type')), /font-size:\s*44px/.test(css('.recapiti .breve p:first-of-type'))], [true, true])
  ok('la nota è Inter 17px', /font-size:\s*17px/.test(css('.recapiti p:not(:first-of-type)')), true)
  ok('mappa alta 520px, 96px dopo i recapiti', [/height:\s*520px/.test(css('.apertura figure.larga img')), /padding-bottom:\s*96px/.test(css('.sezione.apertura')), /margin-top:\s*96px/.test(css('.apertura>.tessere+*'))], [true, true, true])
  ok('foto alte 536px, 96px sopra', [/height:\s*536px/.test(css('.apertura .foto-fila img')), /margin-top:\s*96px/.test(css('.apertura>.foto-fila'))], [true, true])
  ok('domande: titolo 38px, tessere alte 330px, padding 26px 28px', [/font-size:\s*38px/.test(css('.pagina-contatti .sezione:not(.apertura) .tessera h3')), /minmax\(330px,\s*auto\)/.test(css('.pagina-contatti .sezione:not(.apertura) .tessere')), /padding:\s*26px 28px/.test(css('.pagina-contatti .sezione:not(.apertura) .tessera'))], [true, true, true])
  ok('domande: tessere dispari gialle, scacchiera col chiaro', /background:\s*var\(--giallo\)/.test(css('.pagina-contatti .sezione:not(.apertura) .tessera:nth-child(odd)')), true)
  ok('introduzione delle domande a 22px', /font-size:\s*22px/.test(css('.pagina-contatti .sezione:not(.apertura) .colonna')), true)
}

console.log('\n3. Il telefono (≤900px)')
{
  const mob = CSS.slice(CSS.indexOf('@media (max-width:900px)'))
  const m = (sel) => [...mob.matchAll(/([^{}@]+)\{([^{}]*)\}/g)].filter((x) => x[1].trim() === sel).map((x) => x[2]).join(';')
  ok('sul telefono i recapiti in colonna', [/grid-template-columns:\s*1fr/.test(m('.recapiti')), /grid-column:\s*1/.test(m('.tessere.n-4.recapiti>*'))], [true, true])
  ok('titolo 19.5vw (76px a 390)', /font-size:\s*19\.5vw/.test(m('.pagina-contatti h1')), true)
  ok('titolo e testo in colonna', /flex-direction:\s*column/.test(m('.pagina-contatti .pagina-hero .intro')), true)
  ok('recapiti: titolo 38px, valore 32px, alti 130px, padding 20px', [/font-size:\s*38px/.test(m('.recapiti h3')), /font-size:\s*32px/.test(m('.recapiti p:first-of-type,.recapiti .breve p:first-of-type')), /minmax\(130px,\s*auto\)/.test(m('.recapiti')), /padding:\s*20px/.test(m('.recapiti .tessera'))], [true, true, true, true])
  ok('mappa alta 380px, foto alte 200px e la terza non c’è', [/height:\s*380px/.test(m('.apertura figure.larga img')), /height:\s*200px/.test(m('.apertura .foto-fila img')), /display:\s*none/.test(m('.apertura .foto-fila figure:nth-child(3)'))], [true, true, true])
  ok('domande: titolo 30px, tessere alte 160px, padding 20px', [/font-size:\s*30px/.test(m('.pagina-contatti .sezione:not(.apertura) .tessera h3')), /minmax\(160px,\s*auto\)/.test(m('.pagina-contatti .sezione:not(.apertura) .tessere')), /padding:\s*20px/.test(m('.pagina-contatti .sezione:not(.apertura) .tessera'))], [true, true, true])
}

console.log(guai ? `\n✗ ${guai} casi falliti` : '\nTutto a posto.')
process.exit(guai ? 1 : 0)
