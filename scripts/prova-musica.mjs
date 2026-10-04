// ---------------------------------------------------------------------------
// L'interruttore della musica nelle impostazioni del timer, senza browser.
//
//   node scripts/prova-musica.mjs
// ---------------------------------------------------------------------------
import { build } from 'esbuild'

const { outputFiles } = await build({
  stdin: {
    contents:
      "export { DEFAULT_SETTINGS } from './timer/src/lib/storage'; export { musicaAttiva } from './timer/src/lib/musicaAttiva'",
    resolveDir: '.',
    loader: 'ts',
  },
  bundle: true,
  format: 'esm',
  write: false,
  logLevel: 'error',
  define: { 'import.meta.env': '{}' },
})
const modulo = 'data:text/javascript;base64,' + Buffer.from(outputFiles[0].text).toString('base64')

const memoria = new Map()
globalThis.localStorage = {
  getItem: (k) => (memoria.has(k) ? memoria.get(k) : null),
  setItem: (k, v) => memoria.set(k, String(v)),
  removeItem: (k) => memoria.delete(k),
}
const m = await import(modulo)
let guai = 0
const ok = (cosa, avuto, voluto) => {
  const va = JSON.stringify(avuto) === JSON.stringify(voluto)
  console.log(va ? '  ✓' : '  ✗', cosa, va ? '' : `— atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`)
  if (!va) guai++
}

console.log('La musica si può spegnere')
ok('di fabbrica è accesa: chi aveva già la musica non la perde', m.DEFAULT_SETTINGS.musica, true)
ok('accesa e con qualcosa da comandare: attiva', m.musicaAttiva({ musica: true }, true), true)
ok('accesa ma senza niente da comandare: non attiva', m.musicaAttiva({ musica: true }, false), false)
ok('spenta, anche con Spotify collegato o un link valido: non attiva', m.musicaAttiva({ musica: false }, true), false)
ok('un salvataggio vecchio, senza il campo: resta accesa', m.musicaAttiva({}, true), true)

console.log(guai ? `\n${guai} COSE NON TORNANO` : '\nTUTTO A POSTO')
process.exit(guai ? 1 : 0)
