// ---------------------------------------------------------------------------
// I collegamenti della guida all'app, senza browser.
//
//   node scripts/prova-guida.mjs
//
// Nei file della guida i collegamenti all'app sono scritti per intero, con
// l'indirizzo pubblico: nell'app `risolvi` li riconosce e li tiene dentro
// l'app. Se l'indirizzo cambia e i file no, i collegamenti uscirebbero.
// ---------------------------------------------------------------------------
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { build } from 'esbuild'

const { outputFiles } = await build({
  stdin: { contents: "export * from './src/lib/guida'", resolveDir: '.', loader: 'ts' },
  bundle: true,
  format: 'esm',
  write: false,
  logLevel: 'error',
  // L'elenco dei file lo fa Vite; qui basta che non ci sia nessuna pagina.
  define: { 'import.meta.env': '{}', 'import.meta.glob': '__elenco' },
  banner: { js: 'const __elenco = () => ({})' },
})
const m = await import('data:text/javascript;base64,' + Buffer.from(outputFiles[0].text).toString('base64'))

let guai = 0
const ok = (cosa, avuto, voluto) => {
  const va = JSON.stringify(avuto) === JSON.stringify(voluto)
  console.log(va ? '  ✓' : '  ✗', cosa, va ? '' : `— atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`)
  if (!va) guai++
}

const APP = 'https://app.officinedellosport.it/'

console.log("L'indirizzo dell'app")
ok("un collegamento all'app resta nell'app", m.risolvi(`${APP}iscrizioni/`, ''), { href: 'iscrizioni/', esterno: false })
ok("l'app senza percorso porta all'inizio", m.risolvi(APP, ''), { href: '#', esterno: false })
ok("il vecchio indirizzo GitHub non è più dell'app", m.risolvi('https://nalbertini.github.io/ods-corsi/sala/', '').esterno, true)

console.log('I file della guida')
const md = (dir) =>
  readdirSync(dir).flatMap((f) => {
    const p = `${dir}/${f}`
    return statSync(p).isDirectory() ? md(p) : p.endsWith('.md') ? [p] : []
  })
ok("nessun file usa l'indirizzo vecchio",
  md('guida').filter((f) => readFileSync(f, 'utf8').includes('nalbertini.github.io/ods-corsi')),
  [])

if (guai) {
  console.log(`\n${guai} prove non passano.`)
  process.exit(1)
}
console.log('\nTutte le prove passano.')
