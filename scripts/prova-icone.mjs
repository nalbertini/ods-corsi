// ---------------------------------------------------------------------------
// LE ICONE DI TUTTA L'APP, senza browser.
//
//   node scripts/prova-icone.mjs
//
// Un elenco solo (`src/lib/icone.ts`), uguale alla libreria
// (docs/design-canvas/ods-design-system/Icona.dc.html); tratto 1,75, 2,5 sui
// tasti grandi del tablet; l'icona solo sulle azioni che tornano in ogni
// pagina; le frecce delle tabelle sono icone; le pastiglie tinte del look
// sito leggibili; nessun svg scritto a mano fuori dagli Icons.
// ---------------------------------------------------------------------------
import { readFileSync, readdirSync } from 'node:fs'
import { build } from 'esbuild'

let guai = 0
let asserzioni = 0
const ok = (cosa, avuto, voluto) => {
  asserzioni++
  const va = JSON.stringify(avuto) === JSON.stringify(voluto)
  console.log(va ? '  ✓' : '  ✗', cosa, va ? '' : `— atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`)
  if (!va) guai++
}
const leggi = (f) => readFileSync(f, 'utf8')

const impacchetta = async (contents) => {
  const { outputFiles } = await build({
    stdin: { contents, resolveDir: '.', loader: 'ts' },
    bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
  })
  return outputFiles[0].text
}
const carica = (testo) => import('data:text/javascript;base64,' + Buffer.from(testo).toString('base64'))

let lib = {}
try {
  lib = await carica(await impacchetta(`export * from './src/lib/icone.ts'`))
} catch (e) {
  console.log('  ✗ src/lib/icone.ts non si carica:', e.message.split('\n')[0])
  guai++
}
const { ICONE = {}, TRATTO, TRATTO_TABLET, iconaAzione = () => 'manca', iconaVerso = () => 'manca' } = lib

console.log('\nL\'elenco è quello della libreria')
const dc = leggi('docs/design-canvas/ods-design-system/Icona.dc.html')
// C, R e GRUPPI della libreria, valutati come lì: la libreria resta la fonte.
const pezzo = dc.slice(dc.indexOf('const C = '), dc.indexOf('const ICONE = '))
const GRUPPI = new Function(`${pezzo}; return GRUPPI`)()
const libreria = Object.fromEntries(GRUPPI.flatMap(([, v]) => v.map(([n, t]) => [n, t])))
ok('gli stessi nomi', Object.keys(ICONE).sort(), Object.keys(libreria).sort())
const diversi = Object.keys(libreria).filter((n) => JSON.stringify(ICONE[n]) !== JSON.stringify(libreria[n]))
ok('gli stessi tracciati', diversi, [])

console.log('\nIl tratto')
ok('1,75 dappertutto', TRATTO, 1.75)
ok('2,5 sui tasti grandi del tablet', TRATTO_TABLET, 2.5)

console.log('\nL\'icona sul tasto: solo le azioni che tornano')
for (const [etichetta, icona] of [
  ['Salva', 'salva'], ['Salva, già saldato', 'salva'], ['Annulla il movimento', 'annulla'], ['Aggiungi', 'aggiungi'],
  ['Cerca', 'cerca'], ['Elimina richiesta e file', 'elimina'], ['Scarica CSV', 'scarica'], ['Stampa la lettera', 'stampa'],
  ['Copia l’elenco', 'copia'], ['Importa tessere', 'carica'], ['Modifica il compenso', 'modifica'], ['Chiudi', 'chiudi'],
  ['Chiudi la cassa', null], ['Prepara', null], ['Segna firmata', null], ['Segna pagato', null], ['C’era', null], ['Salvataggio', null],
]) ok(`«${etichetta}»`, iconaAzione(etichetta), icona)

console.log('\nLe frecce delle tabelle')
ok('crescente', iconaVerso(1), 'crescente')
ok('decrescente', iconaVerso(-1), 'decrescente')
ok('non ordinata', iconaVerso(0), 'ordina')
const comune = leggi('src/components/segreteria/comune.tsx')
ok('niente più ▲ ▼ ↕ in colonna()', /[▲▼↕]/.test(comune), false)

console.log('\nLa segreteria: nessun tasto ricorrente scritto a mano')
const AZIONI = ['salva', 'annulla', 'aggiungi', 'cerca', 'elimina', 'scarica', 'stampa', 'copia', 'importa', 'modifica', 'chiudi']
const aMano = []
for (const nome of readdirSync('src/components/segreteria', { recursive: true }).filter((f) => f.endsWith('.tsx'))) {
  const s = leggi(`src/components/segreteria/${nome}`).replaceAll('=>', '=)').replaceAll('>=', '=)').replaceAll(' > ', ' ) ')
  for (const m of s.matchAll(/<(button|a)\b([^>]*?)>(.*?)<\/(button|a)>/gs)) {
    if (!m[2].includes('sg-btn')) continue
    const piano = m[3].replace(/\{[^{}]*\}/g, '').replace(/<[^>]*>/g, '').split(/\s+/).join(' ').trim()
    const testi = [piano, ...[...m[3].matchAll(/'([^']*)'|"([^"]*)"|`([^`]*)`/g)].map((x) => x[1] ?? x[2] ?? x[3])]
    const t = testi.find((x) => AZIONI.includes(x.trim().split(' ')[0].toLowerCase().replace(/[…,.]/g, '')))
    if (t && !t.toLowerCase().startsWith('chiudi la cassa')) aMano.push(`${nome}:${s.slice(0, m.index).split('\n').length} ${t}`)
  }
}
ok('tutti passano da Tasto', aMano, [])

console.log('\nLe pastiglie tinte del look sito')
const css = leggi('src/styles.css')
const sito = css.slice(css.indexOf(":root[data-look='sito'] {"), css.indexOf('}', css.indexOf(":root[data-look='sito'] {")))
const token = (nome) => sito.match(new RegExp(`--${nome}:\\s*(#[0-9a-f]{6})`, 'i'))?.[1]?.toLowerCase()
const luce = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contrasto = (a, b) => {
  const [x, y] = [luce(a), luce(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}
for (const [tinta, testo] of [['rosso', 'rosso-testo'], ['giallo', 'giallo-testo'], ['verde', 'verde-testo'], ['neutro', 'dim']]) {
  const a = token(`tinta-${tinta}`)
  const b = token(testo)
  ok(`--tinta-${tinta} c'è`, !!a, true)
  ok(`--${testo} su --tinta-${tinta} almeno 4,5:1`, !!a && !!b && contrasto(a, b) >= 4.5, true)
}

console.log('\nUn file solo per le icone')
const icons = leggi('src/components/Icons.tsx')
ok('Icons.tsx disegna da src/lib/icone', /from '\.\.\/lib\/icone'/.test(icons), true)
ok('Icons.tsx: niente tratti 2, 2,2, 2,6 o 3', icons.match(/strokeWidth:?\s*=?\{?\s*(2|2\.2|2\.6|3)\b(?!\.)/g) ?? [], [])
const timer = leggi('timer/src/components/Icons.tsx')
ok('il timer disegna da src/lib/icone', /src\/lib\/icone/.test(timer), true)
ok('il timer: play e pausa a linea, niente fill pieno', /fill="currentColor"/.test(timer), false)
for (const f of ['src/components/AreaIscritti.tsx', 'src/components/tablet/MusicaSala.tsx']) ok(`${f}: nessun <svg> a mano`, /<svg\b/.test(leggi(f)), false)

console.log(`\n${asserzioni} asserzioni.`)
console.log(guai ? `${guai} ${guai === 1 ? 'cosa non torna' : 'cose non tornano'}` : 'TUTTO A POSTO')
process.exit(guai ? 1 : 0)
