// ---------------------------------------------------------------------------
// `public/robots.txt`: l'app (app.officinedellosport.it) è uno strumento
// interno, non va nei motori di ricerca; il sito pubblico è un altro dominio.
// Senza il file il server risponde con `index.html` e Lighthouse lo legge
// come un robots.txt pieno di errori.
//
//   node scripts/prova-robots.mjs
// ---------------------------------------------------------------------------
import { existsSync, readFileSync } from 'node:fs'

let guai = 0
const ok = (cosa, avuto, voluto) => {
  const va = JSON.stringify(avuto) === JSON.stringify(voluto)
  console.log(va ? '  ✓' : '  ✗', cosa, va ? '' : `— atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`)
  if (!va) guai++
}

const file = 'public/robots.txt'
ok('il file c\'è', existsSync(file), true)
const righe = existsSync(file)
  ? readFileSync(file, 'utf8').split('\n').map((r) => r.trim()).filter((r) => r && !r.startsWith('#'))
  : []
ok('le sole righe sono User-agent e Disallow', righe, ['User-agent: *', 'Disallow: /'])
ok('nessun tag HTML (non è l\'index.html)', righe.some((r) => r.includes('<')), false)

console.log(guai ? `\n${guai} da correggere` : '\nTutto in ordine')
process.exit(guai ? 1 : 0)
