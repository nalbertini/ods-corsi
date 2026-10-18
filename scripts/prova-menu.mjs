// ---------------------------------------------------------------------------
// Il menu della segreteria in cinque gruppi, senza browser.
//
//   node scripts/prova-menu.mjs
//
// src/lib/menuSegreteria.ts esporta GRUPPI_MENU, VOCI_AMMINISTRAZIONE e
// TITOLO_AMMINISTRAZIONE; Segreteria.tsx e Amministrazione.tsx li importano.
// ---------------------------------------------------------------------------
import { execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { build } from 'esbuild'

let guai = 0
const ok = (cosa, avuto, voluto) => {
  const va = JSON.stringify(avuto) === JSON.stringify(voluto)
  console.log(va ? '  ✓' : '  ✗', cosa, va ? '' : `— atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`)
  if (!va) guai++
}
const impacchetta = async (contents) => {
  const { outputFiles } = await build({
    stdin: { contents, resolveDir: '.', loader: 'ts' },
    bundle: true, format: 'esm', write: false, logLevel: 'error', define: { 'import.meta.env': '{}' },
    // Icons.tsx è JSX: senza questo cercherebbe React.createElement.
    jsx: 'automatic',
  })
  return import('data:text/javascript;base64,' + Buffer.from(outputFiles[0].text).toString('base64'))
}

const sg0 = () => readFileSync('src/components/segreteria/Segreteria.tsx', 'utf8')
const c = existsSync('src/lib/menuSegreteria.ts')
const m = c ? await impacchetta("export * from './src/lib/menuSegreteria'") : {}
const mancante = 'src/lib/menuSegreteria.ts non esiste'
const GRUPPI = m.GRUPPI_MENU ?? mancante
const AMM = m.VOCI_AMMINISTRAZIONE ?? mancante

console.log('\nI cinque gruppi')
ok('titoli e voci, nell\'ordine', Array.isArray(GRUPPI) ? GRUPPI.map((g) => [g.titolo, g.voci]) : GRUPPI, [
  ['Ogni giorno', [['dafare', 'Da fare'], ['richieste', 'Richieste online'], ['presenze', 'Presenze']]],
  ['Iscritti e soldi', [['iscritti', 'Iscritti'], ['tessere', 'Tessere'], ['pagamenti', 'Pagamenti']]],
  ['Corsi e orari', [['settimana', 'Settimana'], ['corsi', 'Corsi'], ['listino', 'Listino']]],
  ['Istruttori', [['istruttori', 'Presenze istruttori'], ['personale', 'Istruttori e accessi']]],
  ['Il resto', [['statistiche', 'Statistiche'], ['vestiario', 'Vestiario'], ['esercizi', 'Esercizi'], ['segnalazioni', 'Segnalazioni'], ['sito', 'Sito']]],
])
const ID16 = 'dafare settimana richieste presenze iscritti tessere pagamenti corsi istruttori personale statistiche listino vestiario esercizi segnalazioni sito'.split(' ')
ok('le 16 voci di prima ci sono ancora, una volta sola',
  Array.isArray(GRUPPI) ? GRUPPI.flatMap((g) => g.voci.map(([id]) => id)).sort() : GRUPPI, [...ID16].sort())
ok('solo «Il resto» è secondario',
  Array.isArray(GRUPPI) ? GRUPPI.filter((g) => g.secondario === true).map((g) => g.titolo) : GRUPPI, ['Il resto'])
ok('gli altri gruppi non dicono secondario',
  Array.isArray(GRUPPI) ? GRUPPI.filter((g) => g.titolo !== 'Il resto').map((g) => g.secondario ?? false) : GRUPPI, [false, false, false, false])

// Iniziale maiuscola e non tutto maiuscolo: il maiuscolo dei titoli lo mette il CSS.
const maiuscola = (t) => /^\p{Lu}/u.test(t) && t !== t.toUpperCase()
const testi = (v) => (Array.isArray(v) ? v : [])
ok('titoli dei gruppi e voci: iniziale maiuscola, non tutto maiuscolo',
  testi(GRUPPI).flatMap((g) => [g.titolo, ...g.voci.map(([, t]) => t)]).filter((t) => !maiuscola(t)),
  Array.isArray(GRUPPI) ? [] : ['mancano i gruppi'])

console.log('\nUn\'icona per ogni voce')
const ic = await impacchetta("export { ICONE_MENU } from './src/components/Icons'").catch(() => ({}))
const ICONE = ic.ICONE_MENU ?? {}
const chiavi = Object.keys(ICONE).sort()
const attese = [...ID16, 'amministrazione', 'areaIstruttori', 'link'].sort()
ok('ICONE_MENU ha una chiave per ogni voce, per i due passaggi d\'area e per i link', chiavi, attese)
ok('ognuna è un componente che disegna', Object.values(ICONE).filter((f) => typeof f !== 'function').length, 0)
ok('Segreteria.tsx disegna l\'icona di ogni voce', /ICONE_MENU\[id\]/.test(sg0()), true)
ok('«Amministrazione →» e i due link hanno la loro icona', [/ICONE_MENU\.amministrazione/.test(sg0()), /ICONE_MENU\.areaIstruttori/.test(sg0()), /ICONE_MENU\.link/.test(sg0() + readFileSync('src/components/segreteria/comune.tsx', 'utf8'))], [true, true, true])
ok('un filetto separa un gruppo dal successivo', /\.sg-gruppo \+ \.sg-gruppo\s*\{[^}]*border-top/.test(readFileSync('src/styles.css', 'utf8')), true)

console.log('\nIl menu dell\'amministrazione')
ok('voci e ordine', AMM, [['contabilita', 'Contabilità'], ['pagamenti', 'Pagamenti'], ['listino', 'Listino']])
ok('titolo del gruppo', m.TITOLO_AMMINISTRAZIONE ?? mancante, 'I conti')

console.log('\nIl piè del menu')
const sg = readFileSync('src/components/segreteria/Segreteria.tsx', 'utf8')
const am = readFileSync('src/components/segreteria/Amministrazione.tsx', 'utf8')
ok('«Istruttori →» e «Amministrazione →» (non più in maiuscolo)', [/>\s*Istruttori →\s*</.test(sg), />\s*Amministrazione →\s*</.test(sg)], [true, true])
ok('niente ISTRUTTORI → né AMMINISTRAZIONE → in Segreteria.tsx', /ISTRUTTORI →|AMMINISTRAZIONE →/.test(sg), false)
ok('«Segreteria →» e «Istruttori →» nel menu dell\'amministrazione', [/>\s*Segreteria →\s*</.test(am), />\s*Istruttori →\s*</.test(am)], [true, true])
ok('niente SEGRETERIA → né ISTRUTTORI → in Amministrazione.tsx', /SEGRETERIA →|ISTRUTTORI →/.test(am), false)
ok('«Copia link iscrizioni» e «Copia link ordini»', [/testo="Copia link iscrizioni"/.test(sg), /testo="Copia link ordini"/.test(sg)], [true, true])
ok('niente COPIA LINK in maiuscolo nei componenti', /testo="COPIA LINK/.test(sg), false)
ok('«DATI DI PROVA» resta maiuscolo (è una sigla di stato)', />DATI DI PROVA</.test(sg), true)
// banco/BarraBanco.tsx non esiste: i tasti del link stanno solo in Segreteria.tsx.
if (existsSync('src/components/banco/BarraBanco.tsx'))
  ok('BarraBanco.tsx: niente COPIA LINK in maiuscolo', /COPIA LINK/.test(readFileSync('src/components/banco/BarraBanco.tsx', 'utf8')), false)

console.log('\nIl menu del Banco non cambia')
const ora = await impacchetta("export { LUOGHI } from './src/lib/luoghiBanco'")
let prima = null
try {
  prima = execSync('git show origin/main:src/lib/luoghiBanco.ts', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
} catch {
  console.log('  - confronto con origin/main saltato: il ramo non c\'è')
}
if (prima !== null) {
  const { outputFiles } = await build({
    stdin: { contents: prima.replace(/^import type .*$/m, ''), loader: 'ts' },
    format: 'esm', write: false, logLevel: 'error',
  })
  const vecchio = await import('data:text/javascript;base64,' + Buffer.from(outputFiles[0].text).toString('base64'))
  ok('LUOGHI identico a quello di origin/main', ora.LUOGHI, vecchio.LUOGHI)
}

console.log(guai ? `\n${guai} ${guai === 1 ? 'cosa non torna' : 'cose non tornano'}` : '\nTUTTO A POSTO')
process.exit(guai ? 1 : 0)
