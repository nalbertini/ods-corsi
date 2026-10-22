// ---------------------------------------------------------------------------
// LA SEGRETERIA E L'AMMINISTRAZIONE CON I COLORI E I CARATTERI DEL SITO, senza browser.
//
//   node scripts/prova-look.mjs
//
// Sono sempre chiare: `lib/aspettoSegreteria.ts` mette `data-look="sito"` su
// <html> quando l'area è segreteria, amministrazione, istruttori o iscritti, `tema.ts` allora forza
// `chiaro` senza toccare `ods-tema` (che resta per tablet e timer),
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
// Le aree col look del sito: segreteria, amministrazione, istruttori e iscritti.
const LOOK_AREE = ['segreteria', 'amministrazione', 'istruttori', 'iscritti']
const AREE = ['segreteria', 'amministrazione', 'iscrizioni', 'iscritti', 'istruttori', 'sala', 'guida', 'scelta']
console.log('\nL\'aspetto per area (src/lib/aspettoSegreteria.ts)')
let asp
try {
  asp = await carica(await impacchetta("export * from './src/lib/aspettoSegreteria'"))
} catch (e) {
  ok('src/lib/aspettoSegreteria.ts si carica', e.errors?.[0]?.text ?? e.message, 'ok')
}
for (const a of AREE) ok(`lookDellArea('${a}')`, asp ? vedi(() => asp.lookDellArea(a)) : 'manca', LOOK_AREE.includes(a) ? 'sito' : null)

// --- 2. accendi e spegni su un documento finto -------------------------------
console.log('\nAccendere e spegnere data-look')
for (const a of AREE) {
  const e = ambiente()
  vedi(() => asp.applicaLook(a, e.doc))
  ok(`area ${a}: data-look su <html>`, e.look(), LOOK_AREE.includes(a) ? 'sito' : null)
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
  // Il look forza il chiaro: nell'area iscritti il tasto del tema non servirebbe a niente.
  const app = readFileSync('src/App.tsx', 'utf8')
  ok('la Testata di ISCRITTI è senzaTema', /<Testata luogo="ISCRITTI"[^>]*\bsenzaTema\b/.test(app), true)
  // Il calendario dell'istruttore ha la tinta in alto; l'iscritto la tiene a sinistra, come prima.
  ok('le lezioni dell\'iscritto: la tinta del corso resta il filo a sinistra',
    /:root\[data-look='sito'\] \.mia-lezione \{[^}]*border-top: 0;[^}]*border-left: 6px solid var\(--tinta\)/.test(readFileSync('src/styles.css', 'utf8')), true)
  // SEGNALA si tocca dal telefono, in piedi: 44px, e il bordo blu del tasto come nella proposta.
  const segnala = readFileSync('src/styles.css', 'utf8').match(/\n\.mia-segnala \{[^}]*\}/)?.[0] ?? ''
  ok('SEGNALA: alto almeno 44px, col bordo blu', [/min-height: 44px/.test(segnala), /border: 2px solid var\(--blu\)/.test(segnala)], [true, true])
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
// `.faccia-timer` è stato tra i selettori del blocco :root (la pagina TIMER scura, prima del tema `sito`): non cambia i valori del blocco, e qui non lo si conta.
const esatta = (r) => r.selettori.filter((s) => s !== '.faccia-timer').join(',') + '{' + r.corpo + '}' // byte per byte, spazi compresi

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

// --- 9. forme, tasti, campi e stati -------------------------------------------
// Solo CSS sotto il look (token-proposta.md): raggio 6, niente obliquo, tessere bianche con la barra
// dello stato a sinistra, giallo pieno solo per il tasto principale e la voce di menu corrente,
// tag col segno, fuoco blu (bianco nel menu). Una regola che non c'è fa fallire il caso: mai «vuoto = ok».
console.log('\nForme, tasti, campi e stati')
const esatto = (sel) => delLook.filter((r) => r.selettori.includes(`${LOOK} ${sel}`)).map((r) => r.corpo).join(' ; ')
const ha = (sel, re) => re.test(esatto(sel))
const GIALLO_PIENO = /var\(--giallo\)|#f4c31b/i
const SENZA_BORDO = /(?<![-\w])border(-width)?:\s*(0|none)(px)?\s*(;|$)/

for (const c of ['.sg-btn', '.sg-chip', '.sg-campo', '.sg-tag', '.sg-bollino', '.sg-riquadro', '.sg-dafare-riga', '.sg-scelta', '.card', '.sg-segno-regola', '.sg-dialogo', '.sg-scheda', '.sg-timbro', '.sg-lezione', '.sg-dafare-lezione'])
  ok(`${c}: angoli da 6px`, ha(c, /border-radius:\s*6px/), true)
ok('nessuna regola del look è obliqua', delLook.filter((r) => /font-style:\s*oblique/.test(r.corpo)).map((r) => r.selettori.join(',')), [])
for (const c of ['.sg-btn', '.ob']) ok(`${c}: font-style normal`, ha(c, /font-style:\s*normal/), true)

for (const c of ['.sg-riquadro', '.sg-dafare-riga', '.card', '.sg-mancano']) {
  ok(`${c}: tessera senza bordo`, ha(c, SENZA_BORDO), true)
  ok(`${c}: tessera bianca (var(--surface))`, ha(c, /background(-color)?:\s*var\(--surface\)/), true)
}
for (const [c, colore] of [[".sg-dafare-riga[data-livello='blocca']", 'rosso'], [".sg-dafare-riga[data-livello='presto']", 'giallo-testo'], [".sg-riquadro[data-fatto='true']", 'verde']])
  ok(`${c}: barra a sinistra var(--${colore})`, ha(c, new RegExp(`box-shadow:\\s*inset 4px 0 0 var\\(--${colore}\\)`)), true)

// Il giallo pieno è di quattro cose sole: il tasto principale della segreteria e quello dell'appello (TUTTI PRESENTI),
// la voce di menu corrente e la voce corrente della barra in basso dell'istruttore.
const PIENO_AMMESSO = [`${LOOK} .sg-btn-pieno`, `${LOOK} .sg-voce[aria-current='page']`, `${LOOK} .barra-voce[aria-current='page']`, `${LOOK} .appello-testa .btn-go`]
ok('giallo pieno nel look: solo .sg-btn-pieno, .appello-testa .btn-go e le due voci di menu correnti',
  delLook.filter((r) => r !== bloccoLook && GIALLO_PIENO.test(r.corpo) && !r.selettori.every((s) => PIENO_AMMESSO.includes(s))).map((r) => r.selettori.join(',')), [])
ok('.sg-btn-pieno: fondo var(--giallo), testo var(--su-colore)', ha('.sg-btn-pieno', /background(-color)?:\s*var\(--giallo\)/) && ha('.sg-btn-pieno', /(?<![-\w])color:\s*var\(--su-colore\)/), true)
// Ogni regola di fuori del look con un .sg- e il giallo pieno ne ha una gemella nel look col giallo scritto.
// Tutte le regole con il giallo pieno, non solo quelle .sg-: l'appello, il Banco e il nastro di prova sono nella stessa area.
// Restano fuori il tablet, la pagina TIMER (scura, i token del tema scuro: ha il suo giallo del marchio), i timer degli istruttori e il tasto del modulo di iscrizione: non sono in segreteria.
const FUORI_DALLA_SEGRETERIA = /\.tb-|\.faccia-timer|\.miei-timer|data-modulo|\.btn-primary/
const giallePiene = rOra.filter((r) => !r.selettori.some((s) => s.includes('data-look')) && GIALLO_PIENO.test(r.corpo)).flatMap((r) => r.selettori.filter((s) => s !== ':root' && !FUORI_DALLA_SEGRETERIA.test(s)))
for (const s of [...new Set(giallePiene)]) {
  const g = esatto(s)
  ok(`${s}: nel look è giallo scritto (var(--giallo-testo)), mai fondo giallo`, !!g && !GIALLO_PIENO.test(g) && /var\(--giallo-testo\)/.test(g), true)
}

for (const [t, segno, colore] of [['manca', '✕', 'rosso-testo'], ['aspetta', '…', 'giallo-testo'], ['sostituto', '…', 'giallo-testo'], ['fatto', '✓', 'verde-testo']]) {
  const c = `.sg-tag[data-tipo='${t}']`
  ok(`${c}::before: segno ${segno}`, new RegExp(`content:\\s*['"]${segno}`).test(esatto(c + '::before')), true)
  ok(`${c}: fondo bianco, bordo e testo var(--${colore})`, ha(c, /background(-color)?:\s*var\(--surface\)/) && ha(c, new RegExp(`border(-color)?:[^;]*var\\(--${colore}\\)`)) && ha(c, new RegExp(`(?<![-\\w])color:\\s*var\\(--${colore}\\)`)), true)
}
ok(".sg-tag[data-tipo='presto'] (numero del menu): nessun segno", /content:/.test(esatto(".sg-tag[data-tipo='presto']::before")), false)
ok(".sg-tag[data-tipo='presto']: c'è la regola, fondo bianco", ha(".sg-tag[data-tipo='presto']", /background(-color)?:\s*var\(--surface\)/), true)
ok('.sg-tag neutro: fondo bianco, bordo e testo var(--dim)', ha('.sg-tag', /background(-color)?:\s*var\(--surface\)/) && ha('.sg-tag', /border(-color)?:[^;]*var\(--dim\)/) && ha('.sg-tag', /(?<![-\w])color:\s*var\(--dim\)/), true)

ok('.sg-btn-linea: bordo var(--riga-campo), testo var(--text)', ha('.sg-btn-linea', /border(-color)?:[^;]*var\(--riga-campo\)/) && ha('.sg-btn-linea', /(?<![-\w])color:\s*var\(--text\)/), true)
ok('.sg-chip: bordo var(--riga-campo)', ha('.sg-chip', /border(-color)?:[^;]*var\(--riga-campo\)/), true)
for (const c of [".sg-chip[aria-pressed='true']", ".sg-chip[aria-selected='true']", '.sg-chip-pieno'])
  ok(`${c}: fondo var(--blu), testo #ffffff`, ha(c, /background(-color)?:\s*var\(--blu\)/) && ha(c, /(?<![-\w])color:\s*#ffffff/i), true)
ok('.sg-campo: bordo var(--riga-campo), fondo var(--surface)', ha('.sg-campo', /border(-color)?:[^;]*var\(--riga-campo\)/) && ha('.sg-campo', /background(-color)?:\s*var\(--surface\)/), true)

for (const c of ['.sg-mancano-casella:hover', ".sg-iscritto[data-scelto='true']"]) {
  ok(`${c}: c'è la regola, senza fondo var(--surface-2)`, !!esatto(c) && !/background(-color)?:\s*var\(--surface-2\)/.test(esatto(c)), true)
  ok(`${c}: contorno var(--blu)`, ha(c, /(outline|border(-color)?|box-shadow):[^;]*var\(--blu\)/), true)
}

for (const c of ['.sg-btn', '.sg-chip', '.sg-campo', '.sg-link', '.sg-scelta'])
  ok(`${c}:focus-visible: outline 3px solid var(--blu)`, ha(`${c}:focus-visible`, /outline:\s*3px solid var\(--blu\)/), true)
ok('.sg-menu :focus-visible: outline var(--text) (bianco nel menu)', ha('.sg-menu :focus-visible', /outline:[^;]*var\(--text\)/), true)

arriva('bianco su --blu (chip e campi pieni): 4,5:1', '#ffffff', T['--blu'], 4.5)
arriva('#121212 su --verde (tasto «vai»): 4,5:1', '#121212', T['--verde'], 4.5)
for (const x of ['--giallo-testo', '--rosso-testo', '--verde-testo', '--dim']) arriva(`${x} su --surface (tag bianco): 4,5:1`, T[x], T['--surface'], 4.5)

const AMMESSI_LOOK = new Set([...AMMESSI, '#121212'])
ok('colori nelle regole del look: solo i 12 del sito, #ffffff e #121212',
  delLook.flatMap((r) => (r.corpo.match(HEX) ?? []).map((h) => h.toLowerCase())).filter((h) => !AMMESSI_LOOK.has(h)), [])


// Il menu in cinque gruppi: il titolo resta maiuscolo per CSS (il testo è con l'iniziale maiuscola), voci da 44px.
ok('.sg-gruppo-titolo: maiuscolo per CSS', ha('.sg-gruppo-titolo', /text-transform:\s*uppercase/), true)
ok('.sg-gruppo-titolo: Inter (var(--body))', ha('.sg-gruppo-titolo', /font-family:\s*var\(--body\)/), true)
ok('.sg-gruppo-titolo: 12px, peso 600', ha('.sg-gruppo-titolo', /font-size:\s*12px/) && ha('.sg-gruppo-titolo', /font-weight:\s*600/), true)
ok('.sg-voce: altezza minima 44px', ha('.sg-voce', /min-height:\s*44px/), true)
ok('.sg-voce: raggio 6px, peso 500', ha('.sg-voce', /border-radius:\s*6px/) && ha('.sg-voce', /font-weight:\s*500/), true)


// --- 10. il menu e la barra del telefono, dove --dim è chiaro -----------------
console.log('\nNel menu e nella barra del telefono')
for (const sel of ['.sg-menu .sg-tag', '.sg-barra-tel .sg-tag'])
  ok(`${sel}: tag neutro con l'inchiostro (--dim lì è chiaro)`, ha(sel, /(?<![-\w])color:\s*var\(--su-colore\)/) && ha(sel, /border-color:\s*var\(--su-colore\)/), true)
ok('.sg-menu .sg-campo::placeholder: --faint (--dim nel menu è chiaro sul campo bianco)', ha('.sg-menu .sg-campo::placeholder', /(?<![-\w])color:\s*var\(--faint\)/), true)
arriva('--faint su bianco (segnaposto del campo di ricerca): 4,5:1', T['--faint'], '#ffffff', 4.5)
// A parità di specificità vince l'ultima: il fuoco bianco del menu deve stare dopo quello blu dei tasti.
{
  const dove = (sel) => rOra.findIndex((r) => r.selettori.includes(`${LOOK} ${sel}`))
  ok('il fuoco del menu viene dopo il fuoco blu dei tasti', dove('.sg-menu :focus-visible') > dove('.sg-btn:focus-visible') && dove('.sg-btn:focus-visible') > 0, true)
}


// --- 11. i segni delle schede e le tessere di SETTIMANA ------------------------
console.log('\nSegni delle schede, lezioni e righe scelte')
for (const [t, segno] of [['rosso', '✕'], ['giallo', '…'], ['verde', '✓']])
  ok(`.sg-segno-regola[data-tono='${t}']::before: segno ${segno}`, new RegExp(`content:\\s*['"]${segno}`).test(esatto(`.sg-segno-regola[data-tono='${t}']::before`)), true)
ok(".sg-segno-regola[data-tono='spento']: nessun segno", /content:/.test(esatto(".sg-segno-regola[data-tono='spento']::before")), false)
ok('.sg-lezione: senza bordo da 2px (resta la tinta in alto)', ha('.sg-lezione', /(?<![-\w])border:\s*0\s*;/) && ha('.sg-lezione', /border-top:\s*4px solid var\(--tinta\)/), true)
ok('.sg-lezione[data-manca]: barra rossa a sinistra', ha(".sg-lezione[data-manca='true']", /inset 4px 0 0 var\(--rosso\)/), true)
ok('.sg-lezione[data-annullata]: niente opacità (4,5:1)', ha(".sg-lezione[data-annullata='true']", /opacity:\s*1/), true)
for (const sel of ['.sg-corso[aria-pressed=\'true\']', '.sg-lista-tasto[aria-pressed=\'true\']', '.sg-sett-titolo[aria-expanded=\'true\']'])
  ok(`${sel}: scelto senza celeste, con contorno var(--blu)`, ha(sel, /background:\s*var\(--surface\)/) && !/--surface-2/.test(esatto(sel)) && /var\(--blu\)/.test(esatto(sel)), true)

ok('la testata del Banco (.bn-alto) prende i token chiari del menu, come .sg-menu', ha('.bn-alto', /--text:\s*#ffffff/) && ha('.bn-alto', /--dim:\s*#cfe6f4/), true)
ok('le voci del menu non vanno a capo (white-space: nowrap)', ha('.sg-voce', /white-space:\s*nowrap/), true)

// --- 12. DA FARE e COSA MANCA: titoli in Inter, cinque caselle in riga ---------
console.log('\nDA FARE e COSA MANCA')
for (const [sel, re, cosa] of [
  ['.sg-mancano', /grid-template-columns:\s*repeat\(5, minmax\(0, 1fr\)\)/, 'cinque caselle in una riga'],
  [".sg-mancano-nota[data-fissa='true']", /display:\s*none/, 'senza la nota di sempre (gli avvisi sul conto si vedono)'],
  ['.sg-mancano-n', /font-size:\s*44px/, 'numero a 44px'],
  ['.sg-mancano-titolo', /font-family:\s*var\(--body\)/, 'titolo in Inter'],
  ['.sg-mancano-titolo', /font-size:\s*14px/, 'titolo a 14px'],
  ['.sg-mancano-titolo', /font-weight:\s*600/, 'titolo a 600'],
  ['.sg-mancano-titolo', /letter-spacing:\s*0\s*;/, 'titolo senza spaziatura'],
  ['.sg-dafare-titolo', /font-family:\s*var\(--body\)/, 'titolo della riga in Inter'],
  ['.sg-dafare-titolo', /font-size:\s*21px/, 'titolo della riga a 21px'],
  ['.sg-dafare-titolo', /font-weight:\s*700/, 'titolo della riga a 700'],
  ['.sg-dafare-titolo', /letter-spacing:\s*0\s*;/, 'titolo della riga senza spaziatura'],
]) ok(`${sel}: ${cosa}`, ha(sel, re), true)
ok('fra 768 e 1360px le cinque caselle non prendono i bordi e lo spazio del caso a due colonne (nth-child 5 e n+3)', /grid-column:\s*auto/.test(esatto(".sg-mancano-casella:nth-child(5)")) && /border-top:\s*0/.test(esatto('.sg-mancano-casella:nth-child(n + 3)')), true)
for (const [sel, corpo] of [['.sg-btn', /letter-spacing:\s*0\s*;/], ['.sg-chip', /letter-spacing:\s*0\s*;/]])
  ok(`${sel}: senza la spaziatura da maiuscolo (i testi sono con l'iniziale maiuscola)`, ha(sel, corpo) && ha(sel, /font-weight:\s*600/), true)
console.log(`\n${asserzioni} asserzioni.`)
console.log(guai ? `${guai} ${guai === 1 ? 'cosa non torna' : 'cose non tornano'}` : 'TUTTO A POSTO')
process.exit(guai ? 1 : 0)
