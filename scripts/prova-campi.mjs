// ---------------------------------------------------------------------------
// I campi e le scelte del modulo, senza browser.
//
//   node scripts/prova-campi.mjs
//
// Il bordo di un campo deve vedersi sullo sfondo, anche nel tema scuro
// (WCAG 1.4.11, 3:1): per questo c'è `--riga-campo`, più chiaro di `--line`,
// che resta per le righe e i contenitori di tutta l'app. Le scelte a una sola
// risposta (`una` di SceltaCorsi) sono un segmento pieno, non una casella.
// ---------------------------------------------------------------------------
import { readFileSync } from 'node:fs'
import { build } from 'esbuild'

const { outputFiles } = await build({
  stdin: {
    contents:
      "import { createElement } from 'react'; import { renderToStaticMarkup } from 'react-dom/server'; import { SceltaCorsi } from './src/components/ds'; export const rendi = (props) => renderToStaticMarkup(createElement(SceltaCorsi, props))",
    resolveDir: '.',
    loader: 'tsx',
  },
  bundle: true,
  format: 'esm',
  platform: 'node',
  jsx: 'automatic',
  write: false,
  logLevel: 'error',
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(process.cwd() + '/x.js');" },
  define: { 'import.meta.env': '{}', 'process.env.NODE_ENV': '"production"' },
})
const { rendi } = await import('data:text/javascript;base64,' + Buffer.from(outputFiles[0].text).toString('base64'))

let guai = 0
const ok = (cosa, avuto, voluto) => {
  const va = JSON.stringify(avuto) === JSON.stringify(voluto)
  console.log(va ? '  ✓' : '  ✗', cosa, va ? '' : `— atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`)
  if (!va) guai++
}

// --- il CSS e DESIGN.md, letti ----------------------------------------------

const css = readFileSync('src/styles.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
const regole = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, sel, corpo]) => ({
  selettori: sel.split(',').map((s) => s.trim()),
  corpo,
}))
/** Le dichiarazioni di `proprieta` nelle regole che hanno proprio `selettore`, l'ultima vince. */
const dichiarato = (selettore, proprieta) => {
  let v = null
  for (const r of regole.filter((r) => r.selettori.includes(selettore)))
    for (const m of r.corpo.matchAll(new RegExp(`(?:^|[;\\s])${proprieta}\\s*:\\s*([^;]+)`, 'g'))) v = m[1].trim()
  return v
}
const bordo = (selettore) => dichiarato(selettore, 'border-color') ?? dichiarato(selettore, 'border')
const token = (selettoreTema, nome) => regole.find((r) => r.selettori.includes(selettoreTema))?.corpo.match(new RegExp(`${nome}:\\s*(#[0-9a-fA-F]{6})`))?.[1] ?? null

const luce = (hex) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}
const contrasto = (a, b) => {
  const [x, y] = [luce(a), luce(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}

const TEMI = { scuro: ':root', chiaro: ":root[data-tema='chiaro']" }

console.log('Il token --riga-campo')
const valore = {}
for (const [tema, sel] of Object.entries(TEMI)) {
  valore[tema] = token(sel, '--riga-campo')
  ok(`il tema ${tema} definisce --riga-campo`, valore[tema] !== null, true)
}
ok('scuro: --riga-campo è #6e6e6a', valore.scuro, '#6e6e6a')
ok('chiaro: --riga-campo è #8a8a85', valore.chiaro, '#8a8a85')

console.log('Il contrasto contro lo sfondo (almeno 3:1)')
for (const [tema, sel] of Object.entries(TEMI))
  for (const sfondo of ['--surface', '--bg']) {
    const r = valore[tema] ? contrasto(valore[tema], token(sel, sfondo)) : 0
    ok(`${tema}: il bordo del campo su ${sfondo} arriva a 3:1`, r >= 3, true)
  }

console.log('Dove si usa')
const RIGA = 'var(--riga-campo)'
for (const sel of ['.campo', '.modulo-corso'])
  ok(`${sel} ha il bordo --riga-campo`, bordo(sel)?.includes(RIGA) ?? false, true)
ok('.sg-campo resta su --line', bordo('.sg-campo')?.includes('var(--line)') ?? false, true)
ok('le card restano su --line', bordo('.card')?.includes('var(--line)') ?? false, true)
ok('il campo con un errore resta rosso', bordo(".modulo .campo[aria-invalid='true']"), 'var(--rosso)')
ok('il campo a fuoco resta --text', bordo('.campo:focus'), 'var(--text)')
ok('il tasto scelto (premuto) resta --text', bordo(".modulo-corso[aria-pressed='true']"), 'var(--text)')

console.log('Le scelte a una sola risposta')
const voci = [{ id: 'a', testo: 'Annuale' }, { id: 't', testo: 'Trimestre' }]
const una = rendi({ id: 'x', etichetta: 'Durata', voci, scelti: ['a'], onScegli() {}, una: true })
const molte = rendi({ id: 'x', etichetta: 'Corsi', voci, scelti: ['a'], onScegli() {} })
ok('una sola risposta: niente casella', una.includes('modulo-spunta'), false)
ok('una sola risposta: niente pallino', una.includes('●'), false)
ok('una sola risposta: sono radio, la scelta attiva è una', (una.match(/aria-checked="true"/g) ?? []).length, 1)
ok('più risposte: resta il quadratino', molte.includes('modulo-spunta'), true)
ok('più risposte: resta la spunta ✓', molte.includes('✓'), true)
const attivo = ".modulo-corso[aria-checked='true']"
ok('la scelta attiva ha il fondo --text', dichiarato(attivo, 'background') ?? dichiarato(attivo, 'background-color'), 'var(--text)')
ok('la scelta attiva ha il testo --bg', dichiarato(attivo, 'color'), 'var(--bg)')
ok('la riga sotto il nome della scelta attiva ha il testo --bg', dichiarato(attivo + ' .modulo-corso-riga', 'color'), 'var(--bg)')
ok('INDIETRO ha il bordo --riga-campo', dichiarato('.barra-indietro', 'border-color'), 'var(--riga-campo)')
ok('le altre scelte hanno il bordo --riga-campo', bordo('.modulo-corso')?.includes(RIGA) ?? false, true)

console.log('DESIGN.md')
const design = readFileSync('DESIGN.md', 'utf8')
ok('ha il token riga-campo', /^\s*riga-campo:\s*"#6e6e6a"/m.test(design), true)
ok('ha il token riga-campo-chiara', /^\s*riga-campo-chiara:\s*"#8a8a85"/m.test(design), true)
ok('la descrizione dei campi cita riga-campo', /campi[^\n]*riga-campo|riga-campo[^\n]*campi|\*\*Riga Campo\*\*/i.test(design.split('---').slice(2).join('---')), true)

console.log(guai ? `\n${guai} DA SISTEMARE` : '\nTUTTO A POSTO')
process.exit(guai ? 1 : 0)
