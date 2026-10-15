// ---------------------------------------------------------------------------
// IL TEMA TATAMI (paglia e verde muschio), senza browser.
//
//   node scripts/prova-tema.mjs
//
// Il terzo tema, accanto a scuro e bianco, in ODS Corsi e nel timer: la logica
// di `lib/tema.ts` (le due copie), i colori in `styles.css` (le due copie),
// il foglio del timer dentro il riquadro del tablet. Il tasto cicla
// scuro → chiaro → tatami → scuro.
//
// Il blocco «timer già pubblicato» prova la compatibilità: il timer vecchio,
// che di temi ne conosce due, trova `tatami` nel localStorage condiviso e non
// deve rompersi né riscriverlo. Passa anche prima del codice, ed è giusto.
// ---------------------------------------------------------------------------
import { readFileSync } from 'node:fs'
import { build } from 'esbuild'

let guai = 0
const ok = (cosa, avuto, voluto) => {
  const va = JSON.stringify(avuto) === JSON.stringify(voluto)
  console.log(va ? '  ✓' : '  ✗', cosa, va ? '' : `— atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`)
  if (!va) guai++
}
// Una funzione che manca o si rompe è un caso rosso, non la prova ferma.
const vedi = (f) => {
  try {
    return f()
  } catch (e) {
    return `ERRORE: ${e.message}`
  }
}

// --- WCAG: la formula sta qui, una volta sola -------------------------------
const luce = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
/** Il rapporto, a due decimali verso il basso: 4,499 non diventa 4,5. */
const contrasto = (a, b) => {
  const [x, y] = [luce(a), luce(b)].sort((p, q) => q - p)
  return Math.floor(((x + 0.05) / (y + 0.05)) * 100) / 100
}
// Un valore mancante (blocco non scritto) è un caso rosso, non un'eccezione.
const arriva = (cosa, a, b, soglia) => ok(cosa, !!a && !!b && contrasto(a, b) >= soglia, true)

// --- caricare tema.ts con un ambiente finto, ogni volta nuovo ----------------
// Il modulo guarda `window` e `matchMedia` quando si carica e tiene lo stato
// in variabili sue: per ogni scenario si ricarica da capo (il commento col
// numero cambia l'indirizzo, così Node non lo riprende dalla memoria).
const impacchetta = async (contents, resolveDir) => {
  const { outputFiles } = await build({
    stdin: { contents, resolveDir, loader: 'ts' },
    bundle: true,
    format: 'esm',
    platform: 'node',
    write: false,
    logLevel: 'silent',
    define: { 'import.meta.env': '{}' },
  })
  return outputFiles[0].text
}
let n = 0
const carica = (testo) => import('data:text/javascript;base64,' + Buffer.from(testo + `\n// ${++n}`).toString('base64'))

/**
 * L'ambiente: `salvato` è il localStorage (null = vuoto), `luce` se il sistema
 * è chiaro, `rotto` se localStorage lancia. Restituisce quel che serve a
 * guardare: l'attributo su <html>, il theme-color, le scritture, gli ascoltatori.
 */
const ambiente = ({ salvato = null, luce: chiaro = false, rotto = false } = {}) => {
  const dati = new Map(salvato === null ? [] : [['ods-tema', salvato]])
  const scritture = []
  const sotto = { storage: [], media: [] }
  const meta = { content: null, setAttribute(k, v) { if (k === 'content') this.content = v } }
  globalThis.localStorage = {
    getItem(k) { if (rotto) throw new Error('storage negato'); return dati.has(k) ? dati.get(k) : null },
    setItem(k, v) { if (rotto) throw new Error('storage negato'); scritture.push(['set', k, v]); dati.set(k, String(v)) },
    removeItem(k) { if (rotto) throw new Error('storage negato'); scritture.push(['del', k]); dati.delete(k) },
  }
  globalThis.window = {
    matchMedia: () => ({ matches: chiaro, addEventListener: (_, f) => sotto.media.push(f) }),
    addEventListener: (ev, f) => ev === 'storage' && sotto.storage.push(f),
  }
  globalThis.document = {
    documentElement: { dataset: {} },
    querySelector: (s) => (s === 'meta[name="theme-color"]' ? meta : null),
  }
  return {
    dati, scritture, meta, sotto,
    tema: () => document.documentElement.dataset.tema,
    storage: (e) => sotto.storage.forEach((f) => f(e)),
    sistema: () => sotto.media.forEach((f) => f({})),
  }
}

const SORGENTI = { app: 'src/lib/tema.ts', timer: 'timer/src/lib/tema.ts' }
const moduli = {}
for (const [nome, file] of Object.entries(SORGENTI)) {
  try {
    moduli[nome] = await impacchetta(`export * from './${file}'`, '.')
  } catch (e) {
    console.log('  ✗', file, 'non si carica —', e.errors?.[0]?.text ?? e.message)
    guai++
  }
}

// Avvia il tema nell'ambiente dato e restituisce l'ambiente e il modulo.
const avvia = async (nome, opzioni) => {
  const a = ambiente(opzioni)
  const m = await carica(moduli[nome])
  m.avviaTema()
  return { a, m }
}

for (const nome of Object.keys(moduli)) {
  console.log(`\nIl tema in ${SORGENTI[nome]}`)

  {
    ambiente()
    const m = await carica(moduli[nome])
    ok('i temi sono tre, in ordine', m.TEMI, ['scuro', 'chiaro', 'tatami'])
    const giro = (t) => vedi(() => m.prossimoTema(t))
    ok('il tasto cicla: scuro → chiaro', giro('scuro'), 'chiaro')
    ok('il tasto cicla: chiaro → tatami', giro('chiaro'), 'tatami')
    ok('il tasto cicla: tatami → scuro', giro('tatami'), 'scuro')
    ok('tre giri partendo da ogni tema tornano al primo', ['scuro', 'chiaro', 'tatami'].map((t) => giro(giro(giro(t)))), ['scuro', 'chiaro', 'tatami'])
    for (const v of ['scuro', 'chiaro', 'tatami']) ok(`leggiTema('${v}')`, vedi(() => m.leggiTema(v)), v)
    // Solo i tre nomi esatti: il resto non è un tema e non deve diventarlo.
    for (const v of ['Tatami', 'TATAMI', ' tatami', 'bianco', '', null, undefined, '{"tema":"tatami"}', 'tatami"', 1, 0, true, {}, ['tatami']])
      ok(`leggiTema(${JSON.stringify(v) ?? 'undefined'}) non è un tema`, vedi(() => m.leggiTema(v)), null)
    ok('i colori della barra, per tema', m.COLORE_BARRA, { scuro: '#121212', chiaro: '#f4f4f1', tatami: '#ebe6d0' })
  }

  // 1. La scelta salvata vince sul sistema.
  for (const luce of [true, false]) {
    const { a } = await avvia(nome, { salvato: 'tatami', luce })
    ok(`ods-tema=tatami, sistema ${luce ? 'chiaro' : 'scuro'}: tatami`, a.tema(), 'tatami')
  }
  // 2. Senza scelta segue il sistema, e non arriva mai a tatami.
  for (const [luce, voluto] of [[true, 'chiaro'], [false, 'scuro']]) {
    const { a } = await avvia(nome, { luce })
    ok(`niente scelta, sistema ${luce ? 'chiaro' : 'scuro'}: ${voluto}`, a.tema(), voluto)
  }
  // 3. Un valore che non è un tema vale «nessuna scelta», e nessuno lo tocca.
  for (const v of ['Tatami', 'bianco', '', 'seppia', '{"tema":"tatami"}', '1', 'null'])
    for (const luce of [true, false]) {
      const { a } = await avvia(nome, { salvato: v, luce })
      ok(`ods-tema=${JSON.stringify(v)}, sistema ${luce ? 'chiaro' : 'scuro'}: come se mancasse`, a.tema(), luce ? 'chiaro' : 'scuro')
      ok(`ods-tema=${JSON.stringify(v)}: non riscritto né cancellato`, [a.scritture, a.dati.get('ods-tema')], [[], v])
    }
  // 4. Senza localStorage la scelta vale finché la pagina resta aperta.
  {
    const a = ambiente({ rotto: true, luce: true })
    const m = await carica(moduli[nome])
    ok('localStorage che lancia: l\'avvio non lancia', vedi(() => (m.avviaTema(), 'bene')), 'bene')
    ok('localStorage che lancia: scegliere tatami non lancia', vedi(() => (m.scegliTema('tatami'), 'bene')), 'bene')
    ok('localStorage che lancia: sceglie tatami', a.tema(), 'tatami')
    ok('localStorage che lancia: il sistema che cambia non lo sposta', vedi(() => (a.sistema(), a.tema())), 'tatami')
    ok('localStorage che lancia: l\'evento storage non lo sposta', vedi(() => (a.storage({ key: 'ods-tema' }), a.tema())), 'tatami')
  }
  // 6. La barra del browser prende il colore del fondo di ogni tema.
  for (const [t, colore] of [['scuro', '#121212'], ['chiaro', '#f4f4f1'], ['tatami', '#ebe6d0']]) {
    const a = ambiente()
    const m = await carica(moduli[nome])
    m.avviaTema()
    vedi(() => m.scegliTema(t))
    ok(`theme-color con il tema ${t}`, [a.tema(), a.meta.content], [t, colore])
    if (nome === 'timer') ok(`coloreFondo() con il tema ${t}`, vedi(() => m.coloreFondo()), colore)
  }
  // 7. Il tema cambiato in un'altra scheda, o l'altra app: si riapplica.
  {
    const { a } = await avvia(nome, { salvato: 'scuro', luce: true })
    a.dati.set('ods-tema', 'tatami')
    a.storage({ key: 'ods-tema', newValue: 'tatami' })
    ok('storage: ods-tema diventa tatami, si riapplica', a.tema(), 'tatami')
    a.dati.delete('ods-tema')
    a.storage({ key: 'ods-tema', newValue: null })
    ok('storage: chiave tolta, torna al sistema (chiaro)', a.tema(), 'chiaro')
    a.dati.set('ods-tema', 'tatami')
    a.storage({ key: 'ods-tema' })
    a.dati.delete('ods-tema')
    a.storage({ key: null })
    ok('storage: svuotato del tutto (key null), torna al sistema', a.tema(), 'chiaro')
    a.dati.set('ods-tema', 'tatami')
    a.storage({ key: 'altra-chiave' })
    ok('storage: un\'altra chiave non cambia niente', a.tema(), 'chiaro')
  }
}

// --- il timer già pubblicato (compatibilità) ---------------------------------
// Il timer di nalbertini/Timer- sta sullo stesso dominio e legge la stessa
// chiave: se in ODS Corsi si sceglie Tatami, lui trova `tatami` e di temi ne
// conosce due. Si prova il file com'era prima di questa PR (copia congelata in
// scripts/congelati), non quello di oggi: ha da restare vero anche quando la
// copia nuova conosce il Tatami. Non si legge da git: in CI il checkout è superficiale.
console.log('\nIl timer già pubblicato trova tatami nel localStorage')
{
  let vecchio
  try {
    const testo = readFileSync('scripts/congelati/timer-tema-due-temi.ts', 'utf8')
    vecchio = await impacchetta(testo, 'timer/src/lib')
  } catch (e) {
    ok('la copia congelata del timer si legge', e.message, 'ok')
  }
  if (vecchio)
    for (const luce of [true, false]) {
      const a = ambiente({ salvato: 'tatami', luce })
      const m = await carica(vecchio)
      ok(`sistema ${luce ? 'chiaro' : 'scuro'}: l'avvio non lancia`, vedi(() => (m.avviaTema(), 'bene')), 'bene')
      ok('sceglie il tema del sistema', a.tema(), luce ? 'chiaro' : 'scuro')
      ok('l\'evento storage non lancia', vedi(() => (a.storage({ key: 'ods-tema' }), 'bene')), 'bene')
      ok('tatami non viene riscritto né cancellato', [a.scritture, a.dati.get('ods-tema')], [[], 'tatami'])
    }
}

// --- il CSS ------------------------------------------------------------------
const leggi = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
const regole = (css) => [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, sel, corpo]) => ({ selettori: sel.split(',').map((s) => s.trim().replace(/"/g, "'")), corpo }))
const dichiarazioni = (corpo) => Object.fromEntries([...corpo.matchAll(/(--[\w-]+)\s*:\s*([^;]+?)\s*(?:;|$)/g)].map((m) => [m[1], m[2]]))
/** I token del blocco che ha proprio quel selettore (null se non c'è). */
const blocco = (r, sel) => {
  const x = r.find((q) => q.selettori.includes(sel))
  return x ? dichiarazioni(x.corpo) : null
}
const TATAMI = ":root[data-tema='tatami']"
const FILE_CSS = { app: 'src/styles.css', timer: 'timer/src/styles.css' }
const css = {}
for (const [k, f] of Object.entries(FILE_CSS)) {
  const testo = leggi(f)
  const r = regole(testo)
  css[k] = { testo, r, radice: blocco(r, ':root'), chiaro: blocco(r, ":root[data-tema='chiaro']"), tatami: blocco(r, TATAMI) }
}

for (const [k, f] of Object.entries(FILE_CSS)) {
  const { r, radice, chiaro, tatami } = css[k]
  console.log(`\nI colori del Tatami in ${f}`)
  ok('c\'è il blocco :root[data-tema=\'tatami\']', tatami !== null, true)
  const t = tatami ?? {}
  ok('ha tutti i token del blocco chiaro', Object.keys(chiaro ?? {}).filter((x) => !(x in t)), [])
  for (const [nome, v] of [['--bg', '#ebe6d0'], ['--surface', '#f6f3e4'], ['--surface-2', '#d9d2b0'], ['--text', '#1d1d1b'], ['--menu', '#2f3d2b'], ['color-scheme', 'light']])
    ok(`${nome} è ${v}`, nome === 'color-scheme' ? new RegExp(`color-scheme:\\s*light`).test(r.find((q) => q.selettori.includes(TATAMI))?.corpo ?? '') : t[nome], nome === 'color-scheme' ? true : v)

  // Il valore che vale in tatami: il suo, se lo ridefinisce; se no quello del :root.
  const vale = (x) => t[x] ?? radice?.[x]
  // I token che questo foglio ha: il timer non ha --sec né --verde-testo.
  const suoi = (lista) => lista.filter((x) => radice && x in radice)
  for (const x of suoi(['--dim', '--giallo-testo', '--verde-testo', '--rosso-testo', '--sec']))
    for (const fondo of ['--bg', '--surface', '--surface-2']) arriva(`testo ${x} su ${fondo}: 4,5:1`, t[x], t[fondo], 4.5)
  for (const x of suoi(['--riga-campo']))
    for (const fondo of ['--bg', '--surface']) arriva(`bordo del campo ${x} su ${fondo}: 3:1`, t[x], t[fondo], 3)
  arriva('--su-colore sul --giallo: 4,5:1', vale('--su-colore'), vale('--giallo'), 4.5)
  arriva('--su-colore sul --verde: 4,5:1', vale('--su-colore'), vale('--verde'), 4.5)
  arriva('--su-rosso sul --rosso: 4,5:1', vale('--su-rosso'), vale('--rosso'), 4.5)

  // Dentro il menu i token di testo tornano chiari, sul verde muschio.
  const contenitori = k === 'app' ? ['.sg-menu', '.barra-nav', '.sg-barra-tel'] : ['.sidebar', '.tabbar']
  for (const c of contenitori) {
    const regola = r.find((q) => q.selettori.some((s) => s.startsWith(TATAMI + ' ') && s.endsWith(' ' + c)) && /--text\s*:/.test(q.corpo))
    const m = regola ? dichiarazioni(regola.corpo) : {}
    ok(`${c}: --text si rimappa a #f6f3e4`, m['--text'], '#f6f3e4')
    for (const x of suoi(['--sec', '--dim'])) ok(`${c}: ${x} si rimappa a #cfd6c0`, m[x], '#cfd6c0')
    for (const x of ['--text', ...suoi(['--sec', '--dim'])]) arriva(`${c}: ${x} su --menu: 4,5:1`, m[x], t['--menu'], 4.5)
  }

  if (k === 'app') {
    ok('.tb-fascia ha l\'ombra anche per tatami', r.some((q) => q.selettori.some((s) => /^:root\[data-tema=('?)tatami\1\] \.tb-fascia$/.test(s)) && /box-shadow/.test(q.corpo)), true)
    // Quella dell'ombra leggera è la stessa del chiaro, non quella nera del tema scuro.
    const ombra = (tema) => r.find((q) => q.selettori.includes(`:root[data-tema='${tema}'] .tb-fascia`))?.corpo.match(/box-shadow:\s*([^;]+)/)?.[1]
    ok('.tb-fascia: l\'ombra di tatami è quella del chiaro', ombra('tatami'), ombra('chiaro'))
  }
}

console.log('\nApp e timer: i token comuni hanno gli stessi valori')
{
  const a = css.app.tatami ?? {}
  const t = css.timer.tatami ?? {}
  const comuni = Object.keys(a).filter((x) => x in t)
  ok('ne hanno in comune almeno i principali', ['--bg', '--surface', '--surface-2', '--line', '--text', '--dim', '--menu', '--giallo-testo'].filter((x) => !comuni.includes(x)), [])
  ok('stesso valore per ogni token comune', comuni.filter((x) => a[x] !== t[x]).map((x) => [x, a[x], t[x]]), [])
}

// --- il timer dentro il riquadro del tablet ---------------------------------
console.log('\nIl timer nel riquadro del tablet')
{
  const { perLaSala } = await carica(await impacchetta("export { perLaSala } from './src/lib/timerNelRiquadro'", '.'))
  const sala = (q) => vedi(() => perLaSala(q))
  ok('chiaro: com\'era', sala(":root[data-tema='chiaro'] .a { x: 1 }"), ':host([data-tema=chiaro]) .a { x: 1 }')
  for (const q of ["'tatami'", 'tatami', '"tatami"'])
    ok(`:root[data-tema=${q}] diventa :host([data-tema=tatami])`, sala(`:root[data-tema=${q}] .a { x: 1 }`), ':host([data-tema=tatami]) .a { x: 1 }')
  ok('mai :host[data-tema', sala(":root[data-tema='tatami'] { --bg: #ebe6d0 }").includes(':host[data-tema'), false)
  // Sul foglio vero del timer, com'è e compresso dalla compilazione (virgolette tolte).
  const vero = readFileSync(new URL('../timer/src/styles.css', import.meta.url), 'utf8')
  const dentro = sala(vero)
  ok('timer/src/styles.css: il blocco tatami diventa :host([data-tema=tatami])', /:host\(\[data-tema=tatami\]\)\s*\{/.test(dentro), true)
  ok('timer/src/styles.css: nessun :root[data-tema=tatami] rimasto', /:root\[data-tema/.test(dentro), false)
  ok('timer/src/styles.css: nessun :host[data-tema', dentro.includes(':host[data-tema'), false)
  ok('compresso: il blocco tatami diventa :host([data-tema=tatami])', sala(':root[data-tema=tatami]{--bg:#ebe6d0}'), ':host([data-tema=tatami]){--bg:#ebe6d0}')

  // Il tablet copia `data-tema` dall'<html> sul riquadro (TimerSala.tsx): già
  // vale per qualunque valore, quindi tatami arriva da sé. La prova guarda il
  // sorgente e vuole che quella copia non filtri sui due temi di prima.
  const tablet = readFileSync(new URL('../src/components/tablet/TimerSala.tsx', import.meta.url), 'utf8')
  ok('TimerSala copia data-tema com\'è, senza elencare i temi', /h\.dataset\.tema\s*=\s*t\b/.test(tablet) && !/['"](scuro|chiaro)['"]/.test(tablet), true)
}

console.log('\nI due posti dove si sceglie il tema')
{
  const leggi = (f) => readFileSync(new URL(f, import.meta.url), 'utf8')
  const impostazioni = leggi('../timer/src/components/SettingsScreen.tsx')
  const tasto = leggi('../src/components/TastoTema.tsx')
  for (const t of ['scuro', 'chiaro', 'tatami']) {
    ok(`timer, impostazioni: il selettore ha la voce ${t}`, impostazioni.includes(`['${t}',`), true)
    ok(`tasto del tema: ha il nome di ${t}`, new RegExp(`\\b${t}:\\s*'`).test(tasto), true)
  }
  ok('tasto del tema: passa al successivo con prossimoTema', tasto.includes('prossimoTema'), true)
}

console.log(guai ? `\n${guai} ${guai === 1 ? 'cosa non torna' : 'cose non tornano'}` : '\nTUTTO A POSTO')
process.exit(guai ? 1 : 0)
