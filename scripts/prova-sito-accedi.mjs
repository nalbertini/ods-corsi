// ---------------------------------------------------------------------------
// Il pulsante «Accedi» nella testata del sito, senza browser.
//
//   node scripts/prova-sito-accedi.mjs
//
// `src/lib/sitoGenera.ts`: accanto a «Iscriviti» (che resta l'unico pieno) c'è
// «Accedi», a linea, verso la porta unica dell'app; sul telefono sta in fondo
// al menu, dopo «Iscriviti». Design: docs/design-canvas/sito-accedi.
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
const pag = (slug) => ({ slug, titolo: `Titolo ${slug}`, descrizione: `Descrizione ${slug}`, testo: `<p>Testo di ${slug}</p>` })
const r = g.generaSito({ dominio: 'https://officinedellosport.it', pagine: [pag('home'), pag('judo')], menu: [{ dove: 'menu', ordine: 1, etichetta: 'Judo', slug: 'judo', indirizzo: null }], rinvii: [] })
const conta = (t, re) => (t.match(re) || []).length
const RADICE = 'https://app.officinedellosport.it/'

console.log('\nAccedi in testata')
for (const f of Object.keys(r).filter((x) => x.endsWith('.html') && !x.startsWith('google'))) {
  const testata = (r[f].match(/<header class="testata">.*?<\/header>/s) || [''])[0]
  const accedi = testata.match(/<a [^>]*>Accedi<\/a>/g) || []
  ok(`${f}: due «Accedi» (testata e menu) verso la radice dell'app`, accedi.length === 2 && accedi.every((a) => a.includes(`href="${RADICE}"`)), true)
  ok(`${f}: «Accedi» è a linea, mai pieno`, accedi.length === 2 && accedi.every((a) => a.includes('pulsante secondario') && !a.includes('primario')), true)
  ok(`${f}: «Iscriviti» resta l'unico pulsante pieno`, conta(testata, /class="pulsante primario/g), 2)
  ok(`${f}: nel menu «Accedi» viene dopo «Iscriviti»`, /Iscriviti<\/a><a [^>]*nel-menu[^>]*>Accedi<\/a>/.test((testata.match(/<nav id="menu".*?<\/nav>/s) || [''])[0]), true)
  ok(`${f}: «Accedi» non apre un'altra scheda`, accedi.some((a) => a.includes('_blank')), false)
}
ok('«Accedi» non nomina le aree', /Accedi[^<]*(segreteria|amministrazione|sala)/i.test(r['index.html'] || ''), false)

process.exit(guai ? 1 : 0)
