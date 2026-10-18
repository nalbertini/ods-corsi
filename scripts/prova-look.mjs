// ---------------------------------------------------------------------------
// LA SEGRETERIA E L'AMMINISTRAZIONE CON I COLORI E I CARATTERI DEL SITO, senza browser.
//
//   node scripts/prova-look.mjs
//
// Sono sempre chiare: `lib/aspettoSegreteria.ts` mette `data-look="sito"` su
// <html> quando l'area è segreteria o amministrazione, `tema.ts` allora forza
// `chiaro` senza toccare `ods-tema` (che resta per istruttori, tablet, timer),
// e `styles.css` ridefinisce i token solo sotto `:root[data-look='sito']`.
// Il Banco prende solo colori e caratteri; il tasto del tema lì sparisce.
// ---------------------------------------------------------------------------
import { execSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import { build } from 'esbuild'

let guai = 0
let asserzioni = 0
const ok = (cosa, avuto, voluto) => {
  asserzioni++
  const va = JSON.stringify(avuto) === JSON.stringify(voluto)
  console.log(va ? '  ✓' : '  ✗', cosa, va ? '' : `— atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`)
  if (!va) guai++
}
const vedi = (f) => {
  try {
    return f()
  } catch (e) {
    return `ERRORE: ${e.message}`
  }
}

// --- WCAG, come in prova-tema.mjs --------------------------------------------
const luce = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contrasto = (a, b) => {
  const [x, y] = [luce(a), luce(b)].sort((p, q) => q - p)
  return Math.floor(((x + 0.05) / (y + 0.05)) * 100) / 100
}
const arriva = (cosa, a, b, soglia) => ok(cosa, !!a && !!b && contrasto(a, b) >= soglia, true)
// Un valore che manca (blocco non scritto) non conta come «non arriva»: è un caso rosso.
const nonArriva = (cosa, a, b, soglia) => ok(cosa, !!a && !!b && contrasto(a, b) < soglia, true)

const impacchetta = async (contents) => {
  const { outputFiles } = await build({
    stdin: { contents, resolveDir: '.', loader: 'ts' },
    bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
    define: { 'import.meta.env': '{}' },
  })
  return outputFiles[0].text
}
let n = 0
const carica = (testo) => import('data:text/javascript;base64,' + Buffer.from(testo + `\n// ${++n}`).toString('base64'))

/** Un <html> finto (dataset e attributi) con localStorage, finestra e meta theme-color. */
const ambiente = ({ salvato = null, luce: chiaro = false, look = false } = {}) => {
  const attr = new Map()
  const chiave = (k) => 'data-' + k.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())
  const dataset = new Proxy({}, {
    get: (_, k) => (attr.has(chiave(String(k))) ? attr.get(chiave(String(k))) : undefined),
    set: (_, k, v) => (attr.set(chiave(String(k)), String(v)), true),
    deleteProperty: (_, k) => (attr.delete(chiave(String(k))), true),
  })
  const html = {
    dataset,
    setAttribute: (k, v) => attr.set(k, String(v)),
    removeAttribute: (k) => attr.delete(k),
    getAttribute: (k) => (attr.has(k) ? attr.get(k) : null),
    hasAttribute: (k) => attr.has(k),
  }
  const meta = { content: null, setAttribute(k, v) { if (k === 'content') this.content = v } }
  const doc = { documentElement: html, querySelector: (s) => (s === 'meta[name="theme-color"]' ? meta : null) }
  const dati = new Map(salvato === null ? [] : [['ods-tema', salvato]])
  const scritture = []
  const sotto = { storage: [], media: [] }
  globalThis.localStorage = {
    getItem: (k) => (dati.has(k) ? dati.get(k) : null),
    setItem: (k, v) => (scritture.push(['set', k, v]), dati.set(k, String(v))),
    removeItem: (k) => (scritture.push(['del', k]), dati.delete(k)),
  }
  globalThis.window = {
    matchMedia: () => ({ matches: chiaro, addEventListener: (_, f) => sotto.media.push(f) }),
    addEventListener: (ev, f) => ev === 'storage' && sotto.storage.push(f),
  }
  globalThis.document = doc
  if (look) html.setAttribute('data-look', 'sito')
  return {
    doc, meta, dati, scritture,
    look: () => html.getAttribute('data-look'),
    tema: () => dataset.tema,
    accendi: () => html.setAttribute('data-look', 'sito'),
    spegni: () => html.removeAttribute('data-look'),
    storage: (e) => sotto.storage.forEach((f) => f(e)),
    sistema: () => sotto.media.forEach((f) => f({})),
  }
}

// --- 1. lookDellArea ---------------------------------------------------------
const AREE = ['segreteria', 'amministrazione', 'iscrizioni', 'iscritti', 'istruttori', 'sala', 'guida', 'scelta']
console.log('\nL\'aspetto per area (src/lib/aspettoSegreteria.ts)')
let asp
try {
  asp = await carica(await impacchetta("export * from './src/lib/aspettoSegreteria'"))
} catch (e) {
  ok('src/lib/aspettoSegreteria.ts si carica', e.errors?.[0]?.text ?? e.message, 'ok')
}
for (const a of AREE) ok(`lookDellArea('${a}')`, asp ? vedi(() => asp.lookDellArea(a)) : 'manca', a === 'segreteria' || a === 'amministrazione' ? 'sito' : null)

// --- 2. accendi e spegni su un documento finto -------------------------------
console.log('\nAccendere e spegnere data-look')
for (const a of AREE) {
  const e = ambiente()
  vedi(() => asp.applicaLook(a, e.doc))
  ok(`area ${a}: data-look su <html>`, e.look(), a === 'segreteria' || a === 'amministrazione' ? 'sito' : null)
}
{
  const e = ambiente()
  vedi(() => asp.applicaLook('segreteria', e.doc))
  vedi(() => asp.applicaLook('sala', e.doc))
  ok('da segreteria a sala (hashchange): si spegne', e.look(), null)
  vedi(() => asp.applicaLook('amministrazione', e.doc))
  ok('da sala ad amministrazione: si riaccende', e.look(), 'sito')
  vedi(() => asp.applicaLook('amministrazione', e.doc))
  ok('due volte la stessa area: resta acceso', e.look(), 'sito')
}
{
  const main = readFileSync('src/main.tsx', 'utf8')
  const i = main.indexOf('applicaLook(')
  ok('main.tsx chiama applicaLook prima di createRoot', i >= 0 && i < main.indexOf('createRoot('), true)
  ok('main.tsx lo chiama anche a ogni hashchange', /hashchange[\s\S]{0,200}applicaLook\(|applicaLook\([\s\S]{0,200}hashchange/.test(main), true)
}

// --- 3. tema.ts con il look acceso -------------------------------------------
console.log('\nIl tema con il look acceso (src/lib/tema.ts)')
const temaTesto = await impacchetta("export * from './src/lib/tema'")
const BARRA = { scuro: '#121212', chiaro: '#f4f4f1', tatami: '#ebe6d0' }
{
  const e = ambiente({ salvato: 'tatami', look: true })
  const t = await carica(temaTesto)
  t.avviaTema()
  ok('avvio con look acceso e ods-tema=tatami: chiaro', e.tema(), 'chiaro')
  ok('theme-color del sito (#eef5fa)', e.meta.content, '#eef5fa')
  for (const v of ['scuro', 'chiaro', 'tatami']) {
    e.dati.set('ods-tema', v)
    e.storage({ key: 'ods-tema', newValue: v })
    ok(`evento storage con ${v}: resta chiaro`, [e.tema(), e.meta.content], ['chiaro', '#eef5fa'])
  }
  e.storage({ key: null })
  ok('storage svuotato (key null): resta chiaro', e.tema(), 'chiaro')
  e.sistema()
  ok('cambio del tema di sistema: resta chiaro', e.tema(), 'chiaro')
  ok('ods-tema non è stato né riscritto né cancellato (resta l\'ultimo valore messo qui sopra)', [e.scritture, e.dati.get('ods-tema')], [[], 'tatami'])
}
for (const sistema of [true, false]) {
  const e = ambiente({ luce: sistema, look: true })
  const t = await carica(temaTesto)
  t.avviaTema()
  e.sistema()
  ok(`senza scelta, sistema ${sistema ? 'chiaro' : 'scuro'}: chiaro, e ods-tema non scritto`, [e.tema(), e.scritture], ['chiaro', []])
}
for (const salvato of ['scuro', 'chiaro', 'tatami']) {
  const e = ambiente({ salvato, look: true })
  const t = await carica(temaTesto)
  t.avviaTema()
  e.spegni()
  e.storage({ key: 'ods-tema' }) // qualunque applica() dopo lo spegnimento
  ok(`look spento, ods-tema=${salvato}: torna il tema salvato e la sua barra`, [e.tema(), e.meta.content, e.dati.get('ods-tema')], [salvato, BARRA[salvato], salvato])
}

// --- 4. il CSS ---------------------------------------------------------------
const pulisci = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '')
const regole = (css) => [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, sel, corpo]) => ({ selettori: sel.split(',').map((s) => s.trim().replace(/"/g, "'")), corpo: corpo.trim() }))
const dichiarazioni = (corpo) => Object.fromEntries([...corpo.matchAll(/(--[\w-]+)\s*:\s*([^;]+?)\s*(?:;|$)/g)].map((m) => [m[1], m[2]]))
const LOOK = ":root[data-look='sito']"
const MODULO = ":root[data-modulo='sito']"
const ora = pulisci(readFileSync('src/styles.css', 'utf8'))
const rOra = regole(ora)
// Il confronto è col punto in cui il ramo è partito da main (non con HEAD, che dopo il commit
// contiene già le regole nuove). Senza main con cui confrontare quei casi si saltano.
let base = null
for (const b of ['main', 'origin/main']) {
  try {
    base = execSync(`git merge-base ${b} HEAD`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
    break
  } catch {
    /* quel ramo qui non c'è */
  }
}
let prima = null
if (base) prima = pulisci(execSync(`git show ${base}:src/styles.css`, { encoding: 'utf8', maxBuffer: 1 << 26 }))
if (prima === null) console.log('  - confronto con main saltato: senza un ramo main con cui confrontare')
const rPrima = prima === null ? [] : regole(prima)
const esatta = (r) => r.selettori.join(',') + '{' + r.corpo + '}' // byte per byte, spazi compresi

const bloccoLook = rOra.find((r) => r.selettori.length === 1 && r.selettori[0] === LOOK)
const bloccoModulo = rOra.find((r) => r.selettori.length === 1 && r.selettori[0] === MODULO)
const T = bloccoLook ? dichiarazioni(bloccoLook.corpo) : {}
const M = bloccoModulo ? dichiarazioni(bloccoModulo.corpo) : {}

console.log('\nI colori (blocco ' + LOOK + ')')
ok('c\'è il blocco dei token', !!bloccoLook, true)
const iTatami = rOra.findLastIndex((r) => r.selettori.length === 1 && r.selettori[0] === ":root[data-tema='tatami']")
ok('viene dopo il blocco data-tema=\'tatami\' (a parità di specificità vince l\'ordine)', !!bloccoLook && rOra.indexOf(bloccoLook) > iTatami, true)
ok('color-scheme: light', /color-scheme:\s*light/.test(bloccoLook?.corpo ?? ''), true)
ok('--menu è #0d2a3d', T['--menu'], '#0d2a3d')
ok('stessi token del blocco data-modulo (nessuno in più o in meno)', Object.keys(T).sort(), Object.keys(M).sort())
ok('stessi valori del blocco data-modulo tranne --menu', Object.keys(M).filter((k) => k !== '--menu' && T[k] !== M[k]), [])
const AMMESSI = new Set(['#eef5fa', '#ffffff', '#cfe6f4', '#14709f', '#0d2a3d', '#46606f', '#f4c31b', '#b81d1d', '#e4292a', '#0b7a33', '#8f6a00', '#12913f'])
ok('solo colori ammessi nel blocco', bloccoLook ? [...bloccoLook.corpo.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map((m) => m[0].toLowerCase()).filter((c) => !AMMESSI.has(c)) : 'manca', [])
ok('--cond comincia con Big Shoulders Display', /^['"]?Big Shoulders Display['"]?\s*,/.test(T['--cond'] ?? ''), true)
ok('--body comincia con Inter', /^['"]?Inter['"]?\s*,/.test(T['--body'] ?? ''), true)

console.log('\nI blocchi che non cambiano')
if (prima !== null) {
  for (const sel of [':root', ":root[data-tema='chiaro']", ":root[data-tema='tatami']", MODULO])
    ok(`il blocco ${sel} è identico a quello di prima`, rOra.filter((r) => r.selettori.includes(sel)).map(esatta), rPrima.filter((r) => r.selettori.includes(sel)).map(esatta))
}
const delLook = rOra.filter((r) => r.selettori.some((s) => s.includes('data-look')))
const delModulo = rOra.filter((r) => r.selettori.some((s) => s.includes('data-modulo')))
ok('ci sono regole del look', delLook.length > 0, true)
ok('nessuna regola del look nomina data-modulo', delLook.filter((r) => r.selettori.some((s) => s.includes('data-modulo'))).length, 0)
ok('nessuna regola del modulo nomina data-look', delModulo.filter((r) => r.selettori.some((s) => s.includes('data-look'))).length, 0)
ok('ogni regola che nomina data-look comincia per ' + LOOK, delLook.filter((r) => !r.selettori.every((s) => s.startsWith(LOOK))).map((r) => r.selettori.join(',')), [])

// --- 5. i caratteri ----------------------------------------------------------
console.log('\nI caratteri sotto il look')
const sotto = (cls) => delLook.filter((r) => r.selettori.some((s) => s.startsWith(LOOK) && new RegExp(`\\${cls}(?![\\w-])`).test(s)))
const fam = (r) => r.corpo.match(/font-family:\s*([^;]+)/)?.[1].trim()
const num = sotto('.num')
ok('.num: font-family var(--body)', num.some((r) => fam(r) === 'var(--body)'), true)
ok('.num: tabular-nums', num.some((r) => /font-variant-numeric:\s*tabular-nums/.test(r.corpo)), true)
for (const c of ['.sg-btn', '.sg-chip', '.sg-voce', '.sg-tag', '.sg-etichetta'])
  ok(`${c}: var(--body)`, sotto(c).some((r) => fam(r) === 'var(--body)'), true)
for (const c of ['.sg-titolo', '.sg-dafare-n', '.sg-mancano-n'])
  ok(`${c}: non cambia famiglia (resta --cond)`, sotto(c).map(fam).filter((f) => f && f !== 'var(--cond)'), [])

// --- 6. il tasto del tema ----------------------------------------------------
console.log('\nIl tasto del tema')
ok('sotto il look .tasto-tema è display: none', delLook.some((r) => r.selettori.includes(`${LOOK} .tasto-tema`) && /display:\s*none/.test(r.corpo)), true)
ok('TastoTema.tsx porta ancora la classe tasto-tema', /className="[^"]*(?<![\w-])tasto-tema(?![\w-])/.test(readFileSync('src/components/TastoTema.tsx', 'utf8')), true)

// --- 7. i contrasti ----------------------------------------------------------
console.log('\nI contrasti dei colori del look')
for (const f of ['--bg', '--surface', '--surface-2'])
  for (const x of ['--text', '--dim', '--rosso-testo']) arriva(`${x} su ${f}: 4,5:1`, T[x], T[f], 4.5)
for (const f of ['--bg', '--surface']) {
  for (const x of ['--giallo-testo', '--verde-testo']) arriva(`${x} su ${f}: 4,5:1`, T[x], T[f], 4.5)
  arriva(`bordo dei campi --riga-campo su ${f}: 3:1`, T['--riga-campo'], T[f], 3)
}
arriva('--su-colore su --giallo: 4,5:1', T['--su-colore'], T['--giallo'], 4.5)
arriva('bianco su --menu: 4,5:1', '#ffffff', T['--menu'], 4.5)
// Queste due coppie non arrivano: non si usano (il giallo e il verde del testo non vanno sul riquadro azzurro).
nonArriva('--giallo-testo su --surface-2 è sotto 4,5: non va usato', T['--giallo-testo'], T['--surface-2'], 4.5)
nonArriva('--verde-testo su --surface-2 è sotto 4,5: non va usato', T['--verde-testo'], T['--surface-2'], 4.5)

// --- 8. niente colori sparsi -------------------------------------------------
console.log('\nNiente esadecimali nuovi')
const HEX = /#[0-9a-fA-F]{3,8}\b/g
const conta = (css) => regole(css).filter((r) => !r.selettori.some((s) => s.startsWith(':root'))).reduce((t, r) => t + (r.corpo.match(HEX) ?? []).length, 0)
const filiSg = readdirSync('src/components/segreteria').filter((f) => f.endsWith('.tsx'))
ok('src/components/segreteria/*.tsx: nessun esadecimale', filiSg.flatMap((f) => (readFileSync(`src/components/segreteria/${f}`, 'utf8').match(HEX) ?? []).map((h) => `${f} ${h}`)), [])
// Calcolato dal punto di partenza del ramo (git show <merge-base>:src/styles.css), fuori dai blocchi :root/tema/modulo/look.
const HEX_FUORI_DAI_BLOCCHI = 3
ok(`styles.css fuori dai blocchi :root: al massimo ${HEX_FUORI_DAI_BLOCCHI} letterali #hex (quanti ne aveva)`, conta(ora) <= HEX_FUORI_DAI_BLOCCHI, true)

console.log(`\n${asserzioni} asserzioni.`)
console.log(guai ? `${guai} ${guai === 1 ? 'cosa non torna' : 'cose non tornano'}` : 'TUTTO A POSTO')
process.exit(guai ? 1 : 0)
