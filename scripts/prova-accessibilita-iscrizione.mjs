// ---------------------------------------------------------------------------
// Tastiera, reflow e campi obbligatori, senza browser.
//
//   node scripts/prova-accessibilita-iscrizione.mjs
//
// Trovati da un controllo manuale con tastiera e zoom al 400%:
//  - i gruppi radio dell'iscrizione (`SceltaCorsi` con `una`) si muovono con le frecce;
//  - i campi obbligatori si annunciano (`aria-required`), il facoltativo no;
//  - a 320px la barra in cima alla segreteria e la ricerca degli iscritti vanno a capo;
//  - aprendo il timer il focus va sul tasto AVVIA, tornando indietro sulla scheda attiva.
// ---------------------------------------------------------------------------
import { build } from 'esbuild'
import { readFileSync } from 'node:fs'

const { outputFiles } = await build({
  stdin: {
    contents: [
      "export * from './src/lib/frecceRadio'",
      "export { campoObbligatorio } from './src/lib/passiIscrizione'",
    ].join('\n'),
    resolveDir: '.',
    loader: 'ts',
  },
  bundle: true,
  format: 'esm',
  write: false,
  logLevel: 'error',
  define: { 'import.meta.env': '{}' },
})
const L = await import('data:text/javascript;base64,' + Buffer.from(outputFiles[0].text).toString('base64'))

let fallite = 0
const ok = (cosa, avuto, voluto) => {
  const bene = JSON.stringify(avuto) === JSON.stringify(voluto)
  if (!bene) fallite++
  console.log(`${bene ? 'ok  ' : 'KO  '}${cosa}${bene ? '' : ` — avuto ${JSON.stringify(avuto)}, voluto ${JSON.stringify(voluto)}`}`)
}

// Le frecce: avanti con destra e giù, indietro con sinistra e su, in giro; Home e End agli estremi.
ok('freccia destra va alla voce dopo', L.prossimoRadio('ArrowRight', 0, 3), 1)
ok('freccia giù va alla voce dopo', L.prossimoRadio('ArrowDown', 1, 3), 2)
ok('dopo l’ultima si riparte dalla prima', L.prossimoRadio('ArrowRight', 2, 3), 0)
ok('freccia sinistra va alla voce prima', L.prossimoRadio('ArrowLeft', 2, 3), 1)
ok('freccia su dalla prima va all’ultima', L.prossimoRadio('ArrowUp', 0, 3), 2)
ok('Home va alla prima', L.prossimoRadio('Home', 2, 3), 0)
ok('End va all’ultima', L.prossimoRadio('End', 0, 3), 2)
ok('un altro tasto non fa niente', L.prossimoRadio('a', 0, 3), null)
ok('Tab non fa niente', L.prossimoRadio('Tab', 0, 3), null)

// Un solo tab stop per gruppo: la voce scelta, o la prima se nessuna lo è.
ok('tab stop sulla voce scelta', [0, 1, 2].map((i) => L.tabIndexRadio(i, 1)), [-1, 0, -1])
ok('senza scelta il tab stop è sulla prima', [0, 1, 2].map((i) => L.tabIndexRadio(i, -1)), [0, -1, -1])

ok('il telefono è obbligatorio', L.campoObbligatorio('telefono'), true)
ok('l’email è obbligatoria', L.campoObbligatorio('email'), true)
ok('il secondo telefono è facoltativo', L.campoObbligatorio('telefono2'), false)

// Cosa fa una freccia: con una scelta già fatta sceglie, senza (il comune dal CAP) sposta solo il focus,
// e con una voce sola non deve toccare la scelta (scegliCorso fa da interruttore: la toglierebbe).
ok('con una scelta la freccia sposta e sceglie', L.frecciaRadio('ArrowDown', 0, 3, true), { focus: 1, scegli: true })
ok('senza scelta la freccia sposta solo il focus', L.frecciaRadio('ArrowDown', 0, 3, false), { focus: 1, scegli: false })
ok('con una voce sola non si sceglie di nuovo', L.frecciaRadio('ArrowDown', 0, 1, true), { focus: 0, scegli: false })
ok('un altro tasto non fa niente', L.frecciaRadio('a', 0, 3, true), null)

// Il legame con SceltaCorsi, davvero: la funzione dà l'albero dei bottoni, e `onKeyDown` si prova con eventi finti.
const { outputFiles: dsOut } = await build({
  stdin: {
    contents: "export { SceltaCorsi } from './src/components/ds'",
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
const DS = await import('data:text/javascript;base64,' + Buffer.from(dsOut[0].text).toString('base64'))
const voci = ['a', 'b', 'c'].map((id) => ({ id, testo: id }))
const bottoni = (scelti, onScegli = () => {}) => {
  const trovati = []
  const visita = (n) => {
    if (!n || typeof n !== 'object') return
    if (Array.isArray(n)) return n.forEach(visita)
    if (n.type === 'button') trovati.push(n.props)
    visita(n.props?.children)
  }
  visita(DS.SceltaCorsi({ id: 'x', etichetta: 'Corsi', una: true, voci, scelti, onScegli }))
  return trovati
}
ok('i radio hanno il tab stop sulla voce scelta', bottoni(['b']).map((b) => b.tabIndex), [-1, 0, -1])
ok('senza scelta il tab stop è sul primo radio', bottoni([]).map((b) => b.tabIndex), [0, -1, -1])
const premi = (scelti, i, key) => {
  const chiamate = { scelto: [], focus: [], fermato: 0 }
  const fratelli = voci.map((_, k) => ({ focus: () => chiamate.focus.push(k) }))
  const e = { key, preventDefault: () => chiamate.fermato++, currentTarget: { parentElement: { querySelectorAll: () => fratelli } } }
  bottoni(scelti, (id) => chiamate.scelto.push(id))[i].onKeyDown(e)
  return chiamate
}
ok('freccia giù con una scelta: focus sul successivo e lo sceglie', premi(['a'], 0, 'ArrowDown'), { scelto: ['b'], focus: [1], fermato: 1 })
ok('freccia giù senza scelta: solo il focus', premi([], 0, 'ArrowDown'), { scelto: [], focus: [1], fermato: 1 })
ok('un altro tasto lascia fare al browser', premi(['a'], 0, 'Tab'), { scelto: [], focus: [], fermato: 0 })
ok('i gruppi a scelta multipla non hanno ruolo radio né frecce', (() => {
  const t = []
  const visita = (n) => { if (!n || typeof n !== 'object') return; if (Array.isArray(n)) return n.forEach(visita); if (n.type === 'button') t.push(n.props); visita(n.props?.children) }
  visita(DS.SceltaCorsi({ id: 'x', etichetta: 'Corsi', voci, scelti: [], onScegli() {} }))
  return t.map((b) => [b.role, !!b.onKeyDown])
})(), [[undefined, false], [undefined, false], [undefined, false]])

// Reflow a 320px: la barra e la riga di ricerca vanno a capo.
const css = readFileSync('src/segreteria.css', 'utf8')
const cssApp = readFileSync('src/styles.css', 'utf8')
const barra = css.match(/\.sg-barra-tel \{[^}]*display: flex[^}]*\}/)?.[0] ?? ''
ok('la barra del telefono va a capo', /flex-wrap:\s*wrap/.test(barra), true)
ok('a 320px la barra ha l’altezza che il menu aperto si aspetta', /max-width: 479px[^}]*\}[^}]*\}[^}]*sg-menu \{ inset: calc\(var\(--safe-t\) \+ 102px\)/.test(cssApp), true)
const iscritti = readFileSync('src/components/segreteria/Iscritti.tsx', 'utf8')
ok('la ricerca degli iscritti può restringersi', /flexBasis: '100%', minWidth: 0/.test(iscritti), true)

// Il timer: il focus non resta sul body.
const timer = readFileSync('timer/src/components/TimerScreen.tsx', 'utf8')
ok('il timer porta il focus su AVVIA', /avviaRef\.current\?\.focus\(\)/.test(timer), true)
const app = readFileSync('timer/src/App.tsx', 'utf8')
ok('tornando dal timer il focus va sulla scheda attiva', /\.navitem\[aria-current="page"\], \.tab\[data-on="true"\]/.test(app), true)

// Il legame di IscrizioneAPassi (troppo grande per renderlo senza browser): il testo dei sorgenti, e il DOM vero a mano.
const passi = readFileSync('src/components/IscrizioneAPassi.tsx', 'utf8')
ok('i campi obbligatori hanno aria-required', /'aria-required': P\.campoObbligatorio\(k\)/.test(passi), true)
ok('la privacy ha aria-required', /id="n-privacy"[^>]*aria-required|aria-required[^>]*id="n-privacy"/s.test(passi), true)

process.exit(fallite ? 1 : 0)
