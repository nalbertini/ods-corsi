// ---------------------------------------------------------------------------
// L'ordine dei titoli sul sito pubblico (WCAG 1.3.1): dopo un h1 viene un h2, mai
// un h3 (chi legge con lo schermo salta da un titolo all'altro e perde il filo).
//
//   node scripts/prova-sito-titoli.mjs
//
//  1. Corsi: le schede dei corsi stanno sotto un h2.
//  2. Contatti nuova (docs/sito/contatti.html): i recapiti sono h3 sotto l'h1.
//  3. Un testo con h3 e nessun h2 (la privacy scritta così) non salta più il livello.
// ---------------------------------------------------------------------------
import { build } from 'esbuild'
import { readFileSync } from 'node:fs'
import * as F from './fixture-corsi-nuova.mjs'

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

/** I livelli dei titoli del <main>, nell'ordine in cui compaiono. */
const livelli = (h) => [...(h.match(/<main[\s\S]*<\/main>/)?.[0] ?? '').matchAll(/<h([1-6])\b/g)].map((m) => Number(m[1]))
/** I salti: un titolo che scende di più di un livello rispetto al precedente. */
const salti = (ls) => ls.flatMap((l, i) => (i > 0 && l > ls[i - 1] + 1 ? [`h${ls[i - 1]}→h${l}`] : []))

const generata = (d, file) => g.generaSito(d)[file] ?? ''

console.log('1. Corsi')
ok('nessun titolo salta un livello', salti(livelli(generata(F.dati(F.TESTO_NUOVO), 'corsi/index.html'))), [])

console.log('2. Contatti nuova')
const P = 'https://abc.supabase.co/storage/v1/object/public/sito/'
const contatti = readFileSync('docs/sito/contatti.html', 'utf8')
  .replace(/<!doctype[^>]*>\s*|<meta[^>]*>\s*|<title>.*?<\/title>\s*/gis, '')
  .replace(/https:\/\/[^"]*DA-CARICARE-contatti-(\w+)\.jpg/g, `${P}contatti-$1.jpg`)
const htmlContatti = generata({ ...F.dati(contatti, 'contatti'), ospitiImmagini: [P] }, 'contatti/index.html')
ok('è la pagina Contatti nuova', /class="contatti-nuova/.test(htmlContatti), true)
ok('nessun titolo salta un livello', salti(livelli(htmlContatti)), [])

console.log('3. Un testo con h3 e senza h2')
const testo = '<p>Chi siamo.</p><h3>Chi tratta i dati</h3><p>Noi.</p><h3>I tuoi diritti</h3><p>Tutti.</p>'
const legge = F.dati(testo, 'privacy')
legge.pagine = legge.pagine.map((p) => (p.slug === 'privacy' ? { ...p, diLegge: true } : p))
ok('nessun titolo salta un livello', salti(livelli(generata(legge, 'privacy/index.html'))), [])

console.log('4. Pagine di un corso e degli istruttori (docs/sito)')
const dellaCartella = (slug) =>
  readFileSync(`docs/sito/${slug}.html`, 'utf8').replace(/<!doctype[^>]*>\s*|<meta[^>]*>\s*|<title>.*?<\/title>\s*/gis, '')
for (const slug of ['pre-pugilistica', 'mga-metodo-globale-di-autodifesa', 'istruttori']) {
  ok(`${slug}: nessun titolo salta un livello`, salti(livelli(generata(F.dati(dellaCartella(slug), slug), `${slug}/index.html`))), [])
}

if (guai) {
  console.log(`\n${guai} da correggere`)
  process.exit(1)
}
console.log('\nTutto a posto')
