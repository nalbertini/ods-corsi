// ---------------------------------------------------------------------------
// IL CSS DELLA PRIMA SCHERMATA, senza browser.
//
//   node scripts/prova-css-ingresso.mjs
//
// `styles.css` blocca il disegno della pagina finché non è scaricato: ogni
// regola che serve solo alla segreteria sta in `segreteria.css`, che arriva col
// pezzo di Segreteria (`import` in Segreteria.tsx). Qui si controlla che il
// CSS iniziale non torni a gonfiarsi e che quel che sta nel pezzo non serva
// a chi non lo carica.
// ---------------------------------------------------------------------------
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

let guai = 0
const ok = (cosa, avuto, voluto) => {
  const va = JSON.stringify(avuto) === JSON.stringify(voluto)
  console.log(va ? '  ✓' : '  ✗', cosa, va ? '' : `— atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`)
  if (!va) guai++
}

const LIMITE = 190_000 // byte del CSS iniziale: sopra, una regola nuova va nel CSS dell'area
const SEGRETERIA = 'src/components/segreteria'
const dentro = (d, f) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? dentro(join(d, e.name), f) : f(join(d, e.name)) ? [join(d, e.name)] : []))

ok('styles.css sta sotto il limite', statSync('src/styles.css').size <= LIMITE, true)
ok('Segreteria.tsx importa segreteria.css', /import '\.\.\/\.\.\/segreteria\.css'/.test(readFileSync(`${SEGRETERIA}/Segreteria.tsx`, 'utf8')), true)

// Fuori dal pezzo di Segreteria c'è anche `comune.tsx`, che si carica subito.
const fuori = dentro('src', (p) => /\.tsx?$/.test(p) && (!p.startsWith(SEGRETERIA) || p.endsWith('/comune.tsx')))
  .map((p) => readFileSync(p, 'utf8'))
  .join('\n')
const classi = [...new Set([...readFileSync('src/segreteria.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map((m) => m[1]))]
const usate = classi.filter((c) => new RegExp(`(?<![\\w-])${c.replace(/-/g, '\\-')}(?![\\w-])`).test(fuori))
ok('segreteria.css non ha classi usate fuori dalla segreteria', usate, [])

console.log(guai ? `\n${guai} prove fallite` : '\nTutto ok')
process.exit(guai ? 1 : 0)
