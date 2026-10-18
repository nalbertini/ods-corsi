// ---------------------------------------------------------------------------
// Il fuoco delle foto del sito, senza browser.
//
//   node scripts/prova-sito-foto.mjs
//
// Le foto stanno in riquadri più larghi o più stretti di loro (`object-fit:cover`):
// il ritaglio taglia teste e mani se il punto che resta al centro è quello sbagliato.
// `src/lib/sitoFoto.ts` dice, foto per foto, dove stanno le persone (`x% y%`), e il
// generatore scrive una regola `img[src$="nome.jpg"]{object-position:…!important}`
// che vale in ogni pagina e in ogni riquadro, sul computer e sul telefono.
// Una foto che non è nella tabella resta col ritaglio del suo riquadro.
// ---------------------------------------------------------------------------
import { build } from 'esbuild'
import * as F from './fixture-home-nuova.mjs'

const carica = async (file) => {
  const { outputFiles } = await build({ entryPoints: [file], bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent', define: { 'import.meta.env': '{}' }, banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(process.cwd() + '/');" } })
  return import('data:text/javascript;base64,' + Buffer.from(outputFiles[0].text).toString('base64'))
}
const g = await carica('src/lib/sitoGenera.ts')
let f = {}
try { f = await carica('src/lib/sitoFoto.ts') } catch (e) { console.log('  (modulo mancante: src/lib/sitoFoto.ts)') }

let guai = 0
const ok = (cosa, avuto, voluto) => {
  const va = JSON.stringify(avuto) === JSON.stringify(voluto)
  console.log(va ? '  ✓' : '  ✗', cosa, va ? '' : `— atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`)
  if (!va) guai++
}
// Tutto il CSS della Home nuova (il fuoco delle schede sta nel suo foglio, che le altre pagine non portano).
const css = [...(g.generaSito(F.dati(F.TESTO_NUOVO))['index.html'] ?? '').matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('')
const FOTO = {
  '12e605fc-cd00-47b8-b15d-4eb2443c3f21.jpg': '50% 56%',
  '18c88f1d-5cea-4284-b45a-cc8fabd1a645.jpg': '50% 40%',
  '1a03b6b2-3311-441f-b35d-bd7a8e2471cb.jpg': '50% 50%',
  '40ae8db3-5d53-4075-a708-134f0cef6e81.jpg': '75% 50%',
  '46c39293-7092-49c1-bf6f-36927c36ecd1.jpg': '70% 38%',
  '6e742106-7c45-452a-b698-257bbf9309b0.jpg': '45% 68%',
  '701a887f-9ed5-4a9d-9637-bc8e54f45e6c.jpg': '50% 45%',
  '72d0e1bc-70a3-4407-9215-5c64ee721624.jpg': '50% 42%',
  '814a717b-91a2-441c-b34c-ef376d4781c6.jpg': '50% 25%',
  '9b15677c-7a5f-431b-ac7a-f5ae0994e8bf.jpg': '50% 25%',
  'fbfe492b-1c27-400d-bd74-983f26de7ffe.jpg': '45% 35%',
}
// Le foto delle schede dei corsi della Home si ritagliano per corso, non per file: il nome lo decide l'app al
// caricamento e cambiare foto non deve far rifare il fuoco. [computer, telefono]
const SCHEDE = {
  judo: ['50% 0%', '50% 30%'],
  lotta: ['50% 85%', '50% 50%'],
  aikido: ['50% 5%', '35% 50%'],
  'preparazione-atletica': ['50% 50%', '50% 50%'],
  'giocomotricita-e-psicomotricita': ['75% 50%', '75% 50%'],
}

console.log('\n1. Ogni foto del sito ha il suo fuoco')
for (const [nome, foco] of Object.entries(FOTO)) {
  ok(`${nome.slice(0, 8)}: ${foco}`, css.includes(`img[src$="${nome}"]{object-position:${foco}!important}`), true)
}
ok('la tabella ha le stesse foto e non una di più', Object.keys(f.FOCI_FOTO ?? {}).sort(), Object.keys(FOTO).sort())

console.log('\n1b. Le foto delle schede: il fuoco segue il corso, sul telefono può cambiare')
{
  ok('la tabella dei corsi ha gli stessi corsi e non uno di più', Object.keys(f.FOCI_SCHEDE ?? {}).sort(), Object.keys(SCHEDE).sort())
  for (const [corso, [d, t]] of Object.entries(SCHEDE)) {
    const reg = (x) => `.scheda-foto img[data-corso="${corso}"]{object-position:${x}!important}`
    const dove = css.indexOf(reg(d))
    const tel = css.lastIndexOf(reg(t))
    const prima = css.slice(0, Math.max(tel, 0))
    const media = prima.lastIndexOf('@media (max-width:900px){')
    ok(`${corso}: ${d} sul computer, ${t} sul telefono (dentro @media (max-width:900px), dopo)`, [dove >= 0, tel >= dove, media >= 0 && !prima.slice(media).includes('}}')], [true, true, true])
  }
  ok('un corso con un nome strano si salta', typeof f.cssFociSchede === 'function' && f.cssFociSchede({ 'a"b': ['10% 10%', '10% 10%'] }) === '', true)
}

console.log('\n2. La tabella è fatta bene')
{
  const t = f.FOCI_FOTO ?? {}
  ok('ogni fuoco è «x% y%» con numeri da 0 a 100', Object.values(t).every((v) => /^(\d{1,3})% (\d{1,3})%$/.test(v) && v.split(' ').every((n) => parseInt(n, 10) <= 100)), true)
  ok('ogni nome è un file jpg o webp semplice (niente virgolette né barre nel selettore)', Object.keys(t).every((n) => /^[A-Za-z0-9._-]+\.(jpg|webp)$/.test(n)), true)
  ok('una foto che non è in tabella non ha regole', /img\[src\$="sconosciuta\.jpg"\]/.test(css), false)
  ok('le regole del fuoco vengono dopo quelle dei riquadri (stesso CSS, in fondo)', css.lastIndexOf('object-position:') > css.indexOf('img[src$='), true)
  ok('un fuoco sbagliato non entra nel CSS (si salta, non si rompe)', typeof f.cssFoci === 'function' && !f.cssFoci({ 'a.jpg': 'url(x)', 'b"].jpg': '10% 10%', 'c.jpg': '20% 30%' }).includes('url') && f.cssFoci({ 'c.jpg': '20% 30%' }) === 'img[src$="c.jpg"]{object-position:20% 30%!important}', true)
}

console.log(guai ? `\n✗ ${guai} casi falliti` : '\nTutto a posto.')
process.exit(guai ? 1 : 0)
