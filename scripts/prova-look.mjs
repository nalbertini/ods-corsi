// ---------------------------------------------------------------------------
// LA SEGRETERIA E L'AMMINISTRAZIONE CON I COLORI E I CARATTERI DEL SITO, senza browser.
//
//   node scripts/prova-look.mjs
//
// Sono sempre chiare: `index.html` mette `data-look="sito"` su <html> e
// `styles.css` ridefinisce i token solo sotto `:root[data-look='sito']`.
// Il Banco prende solo colori e caratteri.
// ---------------------------------------------------------------------------
import { execSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'

let guai = 0
let asserzioni = 0
const ok = (cosa, avuto, voluto) => {
  asserzioni++
  const va = JSON.stringify(avuto) === JSON.stringify(voluto)
  console.log(va ? '  ✓' : '  ✗', cosa, va ? '' : `— atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`)
  if (!va) guai++
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

// --- 1. l'aspetto è uno solo, acceso da index.html ---------------------------
console.log('\nL\'aspetto del sito su <html>')
ok('index.html: <html data-look="sito">', /<html[^>]*\bdata-look="sito"/.test(readFileSync('index.html', 'utf8')), true)
{
  const app = readFileSync('src/App.tsx', 'utf8')
  ok('tutta l\'area iscrizioni accende l\'aspetto del modulo', /function Iscrizioni\(\)[\s\S]*?apriAspettoModulo\(\)/.test(app), true)
  // Il calendario dell'istruttore ha la tinta in alto; l'iscritto la tiene a sinistra, come prima.
  ok('le lezioni dell\'iscritto: la tinta del corso resta il filo a sinistra',
    /:root\[data-look='sito'\] \.mia-lezione \{[^}]*border-top: 0;[^}]*border-left: 6px solid var\(--tinta\)/.test(readFileSync('src/styles.css', 'utf8')), true)
  // SEGNALA si tocca dal telefono, in piedi: 44px, e il bordo blu del tasto come nella proposta.
  const segnala = readFileSync('src/styles.css', 'utf8').match(/\n\.mia-segnala \{[^}]*\}/)?.[0] ?? ''
  ok('SEGNALA: alto almeno 44px, col bordo blu', [/min-height: 44px/.test(segnala), /border: 2px solid var\(--blu\)/.test(segnala)], [true, true])
}
{
  const main = readFileSync('src/main.tsx', 'utf8')
  ok('main.tsx non sceglie più l\'aspetto per area', /applicaLook|lookDellArea|avviaTema/.test(main), false)
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
// Le riserve misurate dei caratteri (perché la pagina non salti, `prova:iscrizione-sito`) non cambiano l'aspetto: qui non le si conta.
const esatta = (r) => r.selettori.filter((s) => s !== '.faccia-timer').join(',') + '{' + r.corpo.replace(/, '(Big Shoulders Display|Inter) riserva'/g, '') + '}' // byte per byte, spazi compresi

const bloccoLook = rOra.find((r) => r.selettori.length === 1 && r.selettori[0] === LOOK)
const bloccoModulo = rOra.find((r) => r.selettori.length === 1 && r.selettori[0] === MODULO)
const T = bloccoLook ? dichiarazioni(bloccoLook.corpo) : {}
const M = bloccoModulo ? dichiarazioni(bloccoModulo.corpo) : {}

console.log('\nI colori (blocco ' + LOOK + ')')
ok('c\'è il blocco dei token', !!bloccoLook, true)
ok('color-scheme: light', /color-scheme:\s*light/.test(bloccoLook?.corpo ?? ''), true)
ok('--menu è #0d2a3d', T['--menu'], '#0d2a3d')
// Le tinte dei segni con l'icona (`prova:icone`) servono solo alla segreteria: il modulo d'iscrizione non ha Tag.
const TINTE = { '--tinta-rosso': '#fbe9e9', '--tinta-giallo': '#fcf6e6', '--tinta-verde': '#e3f2e8', '--tinta-neutro': '#e6eef3' }
ok('stessi token del blocco data-modulo (nessuno in più o in meno, tranne le tinte)', Object.keys(T).filter((k) => !(k in TINTE)).sort(), Object.keys(M).sort())
ok('le tinte dei Tag, coi loro valori', Object.fromEntries(Object.keys(TINTE).map((k) => [k, T[k]])), TINTE)
ok('stessi valori del blocco data-modulo tranne --menu', Object.keys(M).filter((k) => k !== '--menu' && T[k] !== M[k]), [])
const AMMESSI = new Set(['#eef5fa', '#ffffff', '#cfe6f4', '#14709f', '#0d2a3d', '#46606f', '#f4c31b', '#b81d1d', '#e4292a', '#0b7a33', '#8f6a00', '#12913f'])
ok('solo colori ammessi nel blocco (i 12 del sito e le tinte)', bloccoLook ? [...bloccoLook.corpo.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map((m) => m[0].toLowerCase()).filter((c) => !AMMESSI.has(c) && !Object.values(TINTE).includes(c)) : 'manca', [])
ok('--cond comincia con Big Shoulders Display', /^['"]?Big Shoulders Display['"]?\s*,/.test(T['--cond'] ?? ''), true)
ok('--body comincia con Inter', /^['"]?Inter['"]?\s*,/.test(T['--body'] ?? ''), true)

console.log('\nI blocchi che non cambiano')
if (prima !== null) {
  for (const sel of [MODULO])
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

// Il giallo pieno è di sei cose sole (con il tasto verde del tablet, che nella sala è giallo): il tasto principale della segreteria e quello dell'appello (TUTTI PRESENTI),
// il tasto principale di tutto il resto (.btn-primary: CHIUDI e simili), la voce di menu corrente e la voce corrente
// della barra in basso dell'istruttore.
const PIENO_AMMESSO = [`${LOOK} .sg-btn-pieno`, `${LOOK} .sg-voce[aria-current='page']`, `${LOOK} .barra-voce[aria-current='page']`, `${LOOK} .appello-testa .btn-go`, `${LOOK} .appello-fine .btn-go`, `${LOOK} .btn-primary`, `${LOOK} .tb-btn-verde`]
ok('giallo pieno nel look: solo .sg-btn-pieno, .btn-primary, .tb-btn-verde, .appello-testa .btn-go, .appello-fine .btn-go e le due voci di menu correnti',
  delLook.filter((r) => r !== bloccoLook && GIALLO_PIENO.test(r.corpo) && !r.selettori.every((s) => PIENO_AMMESSO.includes(s))).map((r) => r.selettori.join(',')), [])
ok('.sg-btn-pieno: fondo var(--giallo), testo var(--su-colore)', ha('.sg-btn-pieno', /background(-color)?:\s*var\(--giallo\)/) && ha('.sg-btn-pieno', /(?<![-\w])color:\s*var\(--su-colore\)/), true)
// Ogni regola di fuori del look con un .sg- e il giallo pieno ne ha una gemella nel look col giallo scritto.
// Tutte le regole con il giallo pieno, non solo quelle .sg-: l'appello, il Banco e il nastro di prova sono nella stessa area.
// Restano fuori il tablet, la pagina TIMER, i timer degli istruttori: non sono in segreteria.
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
ok('colori nelle regole del look: solo i 12 del sito, #ffffff, #121212 e le tinte',
  delLook.flatMap((r) => (r.corpo.match(HEX) ?? []).map((h) => h.toLowerCase())).filter((h) => !AMMESSI_LOOK.has(h) && !Object.values(TINTE).includes(h)), [])


// Il menu in cinque gruppi: il titolo resta maiuscolo per CSS (il testo è con l'iniziale maiuscola), voci da 44px.
ok('.sg-gruppo-titolo: maiuscolo per CSS', ha('.sg-gruppo-titolo', /text-transform:\s*uppercase/), true)
ok('.sg-gruppo-titolo: Inter (var(--body))', ha('.sg-gruppo-titolo', /font-family:\s*var\(--body\)/), true)
ok('.sg-gruppo-titolo: 12px, peso 600', ha('.sg-gruppo-titolo', /font-size:\s*12px/) && ha('.sg-gruppo-titolo', /font-weight:\s*600/), true)
ok('.mia-barra: in fondo anche a pagina corta (margin-top: auto)', /\n\.mia-barra \{[^}]*margin-top: auto/.test(readFileSync('src/styles.css', 'utf8')), true)
ok('.mio-nome-scelta (cambio persona): alto almeno 44px', /\n\.mio-nome-scelta \{[^}]*min-height: 44px/.test(readFileSync('src/styles.css', 'utf8')), true)
ok('.sg-voce: altezza minima 44px', ha('.sg-voce', /min-height:\s*44px/), true)
ok('.sg-voce: raggio 6px, peso 500', ha('.sg-voce', /border-radius:\s*6px/) && ha('.sg-voce', /font-weight:\s*500/), true)

// Componenti condivisi del sistema vecchio, al passo del sito.
// Gli stessi valori di `:root[data-modulo='sito'] .btn`: il modulo di iscrizione non cambia.
console.log('\nComponenti condivisi: tasti, titoletti, campi')
ok('.btn: niente obliquo, angoli 6px, 22px, spaziatura 0.06em', ha('.btn', /font-style:\s*normal/) && ha('.btn', /border-radius:\s*6px/) && ha('.btn', /font-size:\s*22px/) && ha('.btn', /letter-spacing:\s*0\.06em/), true)
ok('.btn-primary: fondo var(--giallo), testo var(--su-colore)', ha('.btn-primary', /background(-color)?:\s*var\(--giallo\)/) && ha('.btn-primary', /(?<![-\w])color:\s*var\(--su-colore\)/), true)
ok("il tasto «tocca di nuovo per eliminare» (.btn-primary[data-sicuro='true']) resta rosso: senza fondo, bordo 2px var(--rosso-testo)",
  ha(".btn-primary[data-sicuro='true']", /background(-color)?:\s*transparent/) && ha(".btn-primary[data-sicuro='true']", /border:\s*2px solid var\(--rosso-testo\)/) && ha(".btn-primary[data-sicuro='true']", /(?<![-\w])color:\s*var\(--rosso-testo\)/), true)
// Il bordo di .btn-ghost è var(--blu) (regola dell'appello, che vince sull'ordine): nel look vale quanto --riga-campo.
for (const [c, bordo] of [['.btn-ghost', /border(-color)?:[^;]*var\(--blu\)/], ['.btn-dashed', /border(-color)?:[^;]*dashed[^;]*var\(--riga-campo\)/]])
  ok(`${c}: bordo ${c === '.btn-dashed' ? 'tratteggiato var(--riga-campo)' : 'var(--blu)'}, testo var(--text)`, ha(c, bordo) && ha(c, /(?<![-\w])color:\s*var\(--text\)/), true)
// CHIUDI L'APPELLO (tutto segnato) è .btn-go: giallo come CHIUDI · N ASSENTI, approvato dall'utente.
ok(".appello-fine .btn-go: fondo var(--giallo), testo var(--su-colore)", ha('.appello-fine .btn-go', /background(-color)?:\s*var\(--giallo\)/) && ha('.appello-fine .btn-go', /(?<![-\w])color:\s*var\(--su-colore\)/), true)
// TUTTI PRESENTI spento: grigio come ogni tasto spento, non azzurro.
ok('.appello-testa .btn-go:disabled: fondo var(--surface-2)', ha('.appello-testa .btn-go:disabled', /background(-color)?:\s*var\(--surface-2\)/) && !ha('.appello-testa .btn-go:disabled', /var\(--line\)/), true)
ok('.btn:disabled: grigio (fondo var(--surface-2), testo var(--dim)), mai sbiadito (opacity 1)', ha('.btn:disabled', /background(-color)?:\s*var\(--surface-2\)/) && ha('.btn:disabled', /(?<![-\w])color:\s*var\(--dim\)/) && ha('.btn:disabled', /opacity:\s*1\s*(;|$)/), true)
for (const c of ['.btn-ghost:disabled', '.btn-dashed:disabled'])
  ok(`${c}: senza bordo (border-color transparent)`, ha(c, /border-color:\s*transparent/), true)
ok('.rule-label: 15px, spaziatura 0.12em', ha('.rule-label', /font-size:\s*15px/) && ha('.rule-label', /letter-spacing:\s*0\.12em/), true)
for (const c of ['.modulo-etichetta', '.etichetta-riquadro', '.testata-luogo'])
  ok(`${c}: spaziatura 0.12em`, ha(c, /letter-spacing:\s*0\.12em/), true)
ok('.scelta-titolo: niente obliquo, spaziatura 0.06em', ha('.scelta-titolo', /font-style:\s*normal/) && ha('.scelta-titolo', /letter-spacing:\s*0\.06em/), true)
ok('.campo: angoli 6px', ha('.campo', /border-radius:\s*6px/), true)
ok('.nastro-prova: 13px, peso 800, spaziatura 0.08em', ha('.nastro-prova', /font-size:\s*13px/) && ha('.nastro-prova', /font-weight:\s*800/) && ha('.nastro-prova', /letter-spacing:\s*0\.08em/), true)
arriva('--su-colore su --giallo (tasto principale): 4,5:1', T['--su-colore'], T['--giallo'], 4.5)
arriva('--dim su --surface-2 (tasto spento): 4,5:1', T['--dim'], T['--surface-2'], 4.5)
arriva('--rosso-testo su --bg (conferma di eliminazione): 4,5:1', T['--rosso-testo'], T['--bg'], 4.5)
ok('il modulo di iscrizione non cambia: nessuna regola del look contiene data-modulo', delLook.filter((r) => r.selettori.some((s) => s.includes('data-modulo')) || /data-modulo/.test(r.corpo)).map((r) => r.selettori.join(',')), [])


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

// Il tablet di sala (.tb-btn) ha sempre il look sito: i tasti prendono forma e colori del sito, le misure restano.
const TB = [
  ['.tb-btn', /font-style:\s*normal/, 'font-style normal'],
  ['.tb-btn', /border-radius:\s*6px/, 'angoli da 6px'],
  ['.tb-btn', /font-weight:\s*800/, 'peso 800'],
  ['.tb-btn', /letter-spacing:\s*0\.06em/, 'spaziatura 0.06em'],
  ['.tb-btn-verde', /background(-color)?:\s*var\(--giallo\)/, 'fondo var(--giallo)'],
  ['.tb-btn-verde', /(?<![-\w])color:\s*var\(--su-colore\)/, 'testo var(--su-colore)'],
  ['.tb-btn-linea', /border-color:\s*var\(--blu\)/, 'bordo var(--blu)'],
  ['.tb-btn-linea[aria-expanded=\'true\']', /border-color:\s*var\(--text\)/, 'aperto: bordo var(--text)'],
  ['.tb-btn-rosso', /background(-color)?:\s*transparent/, 'a linea: fondo transparent'],
  ['.tb-btn-rosso', /border:\s*2px solid var\(--rosso-testo\)/, 'a linea: bordo 2px var(--rosso-testo)'],
  ['.tb-btn-rosso', /(?<![-\w])color:\s*var\(--rosso-testo\)/, 'testo var(--rosso-testo)'],
  ['.tb-btn:disabled', /background(-color)?:\s*var\(--surface-2\)/, 'spento: fondo var(--surface-2)'],
  ['.tb-btn:disabled', /(?<![-\w])color:\s*var\(--dim\)/, 'spento: testo var(--dim)'],
  ['.tb-btn:disabled', /opacity:\s*1\s*(;|$)/, 'spento: opacity 1'],
  ['.tb-btn-linea:disabled', /border-color:\s*transparent/, 'spento: bordo transparent'],
  ['.tb-btn-rosso:disabled', /border-color:\s*transparent/, 'spento: bordo transparent'],
]
for (const [sel, re, cosa] of TB) ok(`${sel}: ${cosa}`, ha(sel, re), true)
ok('tasti del tablet: nessuna regola del look cambia min-height, font-size, padding o width',
  delLook.filter((r) => r.selettori.some((s) => /\.tb-btn/.test(s)) && /(?<![-\w])(min-height|font-size|padding(-[a-z]+)?|width)\s*:/.test(r.corpo)).map((r) => r.selettori.join(',')), [])
ok('TabletHome: nessun bordo giallo inline (il tasto TI SEI DIMENTICATO DI SEGNARTI? è blu come gli altri a linea)',
  /style=\{\{[^}]*var\(--giallo\)/.test(readFileSync('src/components/tablet/TabletHome.tsx', 'utf8')), false)
// Un giallo per schermata: col pannello delle prove aperto il giallo è il suo, TUTTI PRESENTI passa a linea.
ok('TabletIstruttore: TUTTI PRESENTI a linea quando il pannello PROVE è aperto',
  /className=\{`tb-btn \$\{conProve \? 'tb-btn-linea' : 'tb-btn-verde'\}`\}[^>]*onClick=\{\(\) => tutti\('tutti'\)\}/.test(readFileSync('src/components/tablet/TabletIstruttore.tsx', 'utf8')), true)
console.log(`\n${asserzioni} asserzioni.`)
console.log(guai ? `${guai} ${guai === 1 ? 'cosa non torna' : 'cose non tornano'}` : 'TUTTO A POSTO')
process.exit(guai ? 1 : 0)
