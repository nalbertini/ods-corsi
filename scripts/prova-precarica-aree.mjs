// Il precarico delle pagine d'area, senza browser (`scripts/precarica-aree.mjs`).
//
//   node scripts/prova-precarica-aree.mjs
//
// La pagina /segreteria/ scarica subito il pezzo della segreteria e quel che
// importa (vestiarioDati…), non il codice principale; le aree senza un primo
// pezzo restano com'erano.
import { daPrecaricare, conPrecarica } from './precarica-aree.mjs'

let falliti = 0
const ok = (cosa, avuto, voluto) => {
  const a = JSON.stringify(avuto)
  const v = JSON.stringify(voluto)
  if (a !== v) falliti++
  console.log(`${a === v ? 'ok  ' : 'KO  '}${cosa}${a === v ? '' : ` — avuto ${a}, voluto ${v}`}`)
}

const bundle = {
  'assets/index.js': { type: 'chunk', fileName: 'assets/index.js', isEntry: true, imports: ['assets/commonjs.js'] },
  'assets/commonjs.js': { type: 'chunk', fileName: 'assets/commonjs.js', imports: [] },
  'assets/Segreteria.js': {
    type: 'chunk', fileName: 'assets/Segreteria.js', moduleIds: ['/x/src/components/segreteria/Segreteria.tsx'],
    imports: ['assets/index.js', 'assets/vestiarioDati.js', 'assets/schedaSezioni.js'],
  },
  'assets/vestiarioDati.js': { type: 'chunk', fileName: 'assets/vestiarioDati.js', imports: ['assets/schedaSezioni.js'] },
  'assets/schedaSezioni.js': { type: 'chunk', fileName: 'assets/schedaSezioni.js', imports: [] },
  'assets/IscrizioniScreen.js': {
    type: 'chunk', fileName: 'assets/IscrizioniScreen.js', moduleIds: ['/x/src/components/IscrizioniScreen.tsx'], imports: ['assets/index.js'],
  },
  'index.html': { type: 'asset', fileName: 'index.html' },
}

ok('segreteria: il suo pezzo e i sotto-pezzi, senza il principale', daPrecaricare(bundle, 'segreteria'),
  ['assets/Segreteria.js', 'assets/vestiarioDati.js', 'assets/schedaSezioni.js'])
ok('amministrazione come la segreteria', daPrecaricare(bundle, 'amministrazione').length, 3)
ok('iscrizioni: solo il suo pezzo', daPrecaricare(bundle, 'iscrizioni'), ['assets/IscrizioniScreen.js'])
ok('un\'area senza primo pezzo non precarica nulla', daPrecaricare(bundle, 'sala'), [])
ok('il link va nell\'head', conPrecarica('<head>\n  </head>', ['assets/a.js']).includes('<link rel="modulepreload" crossorigin href="./assets/a.js">'), true)
ok('senza file la pagina non cambia', conPrecarica('<head></head>', []), '<head></head>')

if (falliti) process.exit(1)
