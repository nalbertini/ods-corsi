// ---------------------------------------------------------------------------
// IL MODULO DI ISCRIZIONE NELL'ASPETTO DEL SITO, senza browser.
//
//   node scripts/prova-iscrizione-sito.mjs
//
// Il modulo vero (ModuloIscrizione) è sempre chiaro «tatami blu e giallo»,
// qualunque sia il tema dell'app: `lib/aspettoModulo.ts` mette
// `data-modulo="sito"` su <html>, e `styles.css` ridefinisce i token solo lì.
// Vestiario e modulo a passi in prova non cambiano. Design: docs/design-canvas/iscrizione-sito.
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

// --- a. aspettoModulo, con un documento finto --------------------------------
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

/** Un <html> finto che regge sia dataset che setAttribute. */
const ambiente = ({ salvato = null } = {}) => {
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
  globalThis.localStorage = {
    getItem: (k) => (dati.has(k) ? dati.get(k) : null),
    setItem: (k, v) => dati.set(k, String(v)),
    removeItem: (k) => dati.delete(k),
  }
  globalThis.window = { matchMedia: () => ({ matches: false, addEventListener() {} }), addEventListener() {} }
  globalThis.document = doc
  return { doc, meta, modulo: () => html.getAttribute('data-modulo') }
}

console.log('\nL\'aspetto del modulo (src/lib/aspettoModulo.ts)')
let modulo
try {
  modulo = await impacchetta("export * from './src/lib/aspettoModulo'")
} catch (e) {
  ok('src/lib/aspettoModulo.ts si carica', e.errors?.[0]?.text ?? e.message, 'ok')
}
const BARRA = { scuro: '#121212', chiaro: '#f4f4f1', tatami: '#ebe6d0' }
if (modulo) {
  for (const t of ['scuro', 'chiaro', 'tatami']) {
    const a = ambiente({ salvato: t })
    const tema = await carica(await impacchetta("export * from './src/lib/tema'"))
    tema.avviaTema()
    const m = await carica(modulo)
    const chiudi = vedi(() => m.apriAspettoModulo(a.doc))
    ok(`tema ${t}: apri mette data-modulo="sito"`, a.modulo(), 'sito')
    ok(`tema ${t}: apri mette il theme-color del sito`, a.meta.content, '#eef5fa')
    ok(`tema ${t}: apri dà indietro chiudi()`, typeof chiudi, 'function')
    // L'utente tocca il tasto del tema nel modulo: la scelta vale dopo, il modulo resta chiaro.
    tema.scegliTema('tatami')
    ok(`tema ${t}: il tasto del tema non rimette il theme-color mentre il modulo è aperto`, a.meta.content, '#eef5fa')
    ok(`tema ${t}: il modulo resta chiaro`, a.modulo(), 'sito')
    vedi(() => chiudi())
    ok(`tema ${t}: chiudi toglie data-modulo`, a.modulo(), null)
    ok(`tema ${t}: chiudi rimette il theme-color del tema scelto (tatami)`, a.meta.content, BARRA.tatami)
    tema.scegliTema(t)
    ok(`tema ${t}: dopo chiudi applica() torna a lavorare`, a.meta.content, BARRA[t])
  }
  // Chiudere senza aver cambiato tema: torna il colore del tema di partenza.
  for (const t of ['scuro', 'chiaro', 'tatami']) {
    const a = ambiente({ salvato: t })
    const tema = await carica(await impacchetta("export * from './src/lib/tema'"))
    tema.avviaTema()
    const m = await carica(modulo)
    const chiudi = vedi(() => m.apriAspettoModulo(a.doc))
    vedi(() => chiudi())
    ok(`tema ${t}: apri e chiudi riportano la barra a ${BARRA[t]}`, [a.modulo(), a.meta.content], [null, BARRA[t]])
  }
}

// --- il CSS ------------------------------------------------------------------
const pulisci = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '')
const regole = (css) => [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, sel, corpo]) => ({ selettori: sel.split(',').map((s) => s.trim().replace(/"/g, "'")), corpo: corpo.trim() }))
const dichiarazioni = (corpo) => Object.fromEntries([...corpo.matchAll(/(--[\w-]+)\s*:\s*([^;]+?)\s*(?:;|$)/g)].map((m) => [m[1], m[2]]))
const PREFISSO = ":root[data-modulo='sito']"
const ora = pulisci(readFileSync('src/styles.css', 'utf8'))
// Il confronto è con main, non con HEAD: nel ramo o in CI HEAD contiene già le regole nuove e
// il confronto sarebbe vuoto. Senza un main con cui confrontare quei casi si saltano, non passano a vuoto.
let prima = null
for (const base of ['main', 'origin/main']) {
  try {
    prima = pulisci(execSync(`git show ${base}:src/styles.css`, { encoding: 'utf8', maxBuffer: 1 << 26, stdio: ['ignore', 'pipe', 'ignore'] }))
    break
  } catch {
    /* quel ramo qui non c'è: si prova l'altro */
  }
}
if (prima === null) console.log('  - confronto con main saltato: senza un ramo main con cui confrontare')
const rOra = regole(ora)
const rPrima = prima === null ? [] : regole(prima)
// `.faccia-timer` è stato tra i selettori del blocco :root (la pagina TIMER scura, prima del tema `sito`): non cambia i valori del blocco, e qui non lo si conta.
const chiaveR = (r) => r.selettori.filter((s) => s !== '.faccia-timer').join(',') + '{' + r.corpo.replace(/\s+/g, ' ') + '}'
const vecchie = new Set(rPrima.map(chiaveR))
const nuove = rOra.filter((r) => !vecchie.has(chiaveR(r)))
const delModulo = rOra.filter((r) => r.selettori.every((s) => s.startsWith(PREFISSO)))
const bloccoR = delModulo.find((r) => r.selettori.length === 1 && r.selettori[0] === PREFISSO)
const T = bloccoR ? dichiarazioni(bloccoR.corpo) : {}

console.log('\nI colori del modulo (blocco ' + PREFISSO + ')')
ok('c\'è il blocco dei token', !!bloccoR, true)
ok('color-scheme: light', /color-scheme:\s*light/.test(bloccoR?.corpo ?? ''), true)
for (const [k, v] of Object.entries({ '--bg': '#eef5fa', '--surface': '#ffffff', '--surface-2': '#cfe6f4', '--riga-campo': '#14709f', '--text': '#0d2a3d', '--dim': '#46606f', '--blu': '#14709f', '--giallo': '#f4c31b', '--tasto': '#0d2a3d' }))
  ok(`${k} è ${v}`, T[k], v)
for (const f of ['--bg', '--surface', '--surface-2']) {
  arriva(`--text su ${f}: 4,5:1`, T['--text'], T[f], 4.5)
  arriva(`--dim su ${f}: 4,5:1`, T['--dim'], T[f], 4.5)
}
for (const f of ['--bg', '--surface']) {
  arriva(`--riga-campo su ${f}: 3:1`, T['--riga-campo'], T[f], 3)
  for (const x of ['--giallo-testo', '--rosso-testo', '--verde-testo']) arriva(`${x} su ${f}: 4,5:1`, T[x], T[f], 4.5)
}
arriva('--su-colore su --giallo: 4,5:1', T['--su-colore'], T['--giallo'], 4.5)
arriva('bianco su --text: 4,5:1', '#ffffff', T['--text'], 4.5)
const AMMESSI = new Set(['#eef5fa', '#0d2a3d', '#14709f', '#cfe6f4', '#f4c31b', '#ffffff', '#12913f', '#8f6a00', '#0b7a33', '#b81d1d', '#e4292a', '#46606f'])
ok('solo colori ammessi nel blocco', [...(bloccoR?.corpo ?? '').matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map((m) => m[0].toLowerCase()).filter((c) => !AMMESSI.has(c)), [])
ok('la barra del browser (COLORE_BARRA_MODULO) è il --bg del modulo', modulo ? (await carica(modulo)).COLORE_BARRA_MODULO : null, T['--bg'])
ok('il blocco ridefinisce almeno 20 token', Object.keys(T).length >= 20, true)

console.log('\nI caratteri sono locali')
const fontFace = [...ora.matchAll(/@font-face\s*\{([^}]*)\}/g)].map((m) => m[1])
const faccia = (nome) => fontFace.find((c) => c.includes(nome))
for (const [nome, file, licenza] of [['Big Shoulders Display', 'big-shoulders-display-800.woff2', 'OFL-Big-Shoulders.txt'], ['Inter', 'inter-variable.woff2', 'OFL-Inter.txt']]) {
  const f = faccia(`'${nome}'`) ?? faccia(`"${nome}"`) ?? ''
  ok(`@font-face di ${nome} punta a /fonts/${file}`, f.includes(`/fonts/${file}`), true)
  ok(`public/fonts/${file} esiste`, existsSync(`public/fonts/${file}`), true)
  ok(`public/fonts/${licenza} esiste`, existsSync(`public/fonts/${licenza}`), true)
}
ok('Big Shoulders è il peso 800', /font-weight:\s*800/.test(faccia('Big Shoulders') ?? ''), true)
ok('nessun @import url(http', /@import\s+url\(\s*['"]?http/.test(ora), false)
ok('nessun https:// nelle regole del modulo e nei @font-face nuovi', [...delModulo, ...nuove.filter((r) => r.selettori[0].startsWith('@font-face'))].filter((r) => /https?:\/\//.test(r.corpo)).length, 0)
ok('--cond del modulo: Big Shoulders Display con riserva', /^['"]?Big Shoulders Display['"]?\s*,\s*\S+/.test(T['--cond'] ?? ''), true)
ok('--body del modulo: Inter con riserva', /^['"]?Inter['"]?\s*,\s*\S+/.test(T['--body'] ?? ''), true)
const radice = dichiarazioni(rOra.find((r) => r.selettori.includes(':root'))?.corpo ?? '')
ok(':root --cond resta Saira Condensed', /Saira Condensed/.test(radice['--cond'] ?? ''), true)
ok(':root --body resta Barlow', /Barlow/.test(radice['--body'] ?? ''), true)

console.log('\nIl confinamento')
ok('ci sono regole del modulo', delModulo.length > 0, true)
ok('ogni regola che nomina data-modulo comincia per ' + PREFISSO, rOra.filter((r) => r.selettori.some((x) => x.includes('data-modulo')) && !r.selettori.every((x) => x.startsWith(PREFISSO))).map((r) => r.selettori.join(',')), [])
// Solo le regole che nominano il modulo: un'altra PR può aggiungere il suo CSS (la segreteria, il timer…), purché il modulo resti confinato.
if (prima !== null) ok('ogni regola nuova del modulo comincia per ' + PREFISSO + ' (o è un @font-face)', nuove.filter((r) => r.selettori.some((s) => s.includes('data-modulo')) && !r.selettori.every((s) => s.startsWith(PREFISSO) || s === '@font-face')).map((r) => r.selettori.join(',')), [])
for (const sel of [':root', ":root[data-tema='chiaro']", ":root[data-tema='tatami']"])
  if (prima !== null) ok(`il blocco ${sel} non è cambiato`, rOra.filter((r) => r.selettori.includes(sel)).map(chiaveR), rPrima.filter((r) => r.selettori.includes(sel)).map(chiaveR))
// Il look della segreteria (`data-look`, PR successive a questa) ha la sua prova (`prova:look`): le sue regole possono cambiare.
const delLook = (r) => r.selettori.some((x) => x.includes('data-look'))
// Le regole di Tatami per le classi della segreteria (`.sg-*`) sono state tolte: la segreteria è sempre nel look del sito (`prova:tema` lo controlla).
const tatamiSegreteria = (r) => r.selettori.some((x) => x.includes("data-tema='tatami'") && x.includes('.sg-'))
// La griglia a due colonne della pagina d'ingresso (passi | costi) e le regole dell'elenco dei passi sono tolte di proposito: ora è una colonna sola (`prova:iscrizione-pagina`). Le altre regole restano tutte.
const impaginazioneVecchia = (r) => /grid-area:\s*nota/.test(r.corpo) || r.selettori.some((x) => /^\.scroll > \.iscrizioni$|^\.iscrizioni-passi$|^\.iscrizioni #costi$|^\.passi$|^\.passo$|^\.passo-num$|^\.passo-testo$|^\.pagamento$/.test(x))
// L'editor a pezzi non ha più i tre pannelli di Puck (parti, pagina, campi) ma la sua pagina e due schede: le regole sulla sua impaginazione di prima (`.sito-pezzi > div`, le classi interne di Puck) sono tolte di proposito.
const pezziVecchio = (r) => r.selettori.some((x) => /^\.sito-pezzi > div$|^\.sito-pezzi \[class\*=/.test(x))
// L'editor delle pagine ha l'aspetto di Puck: i suoi campi, le note e la riga del perché prendono i colori di Puck, non quelli dell'app, e i tasti `.sg-btn` lì dentro non ci sono più.
// Il vecchio editor (EditorPezzi, EditorTesto, la colonna destra) è tolto: le sue regole (`.sito-due`, `.sito-barra*`, `.sito-pezzi*`, `.sito-pezzo*`, `.sito-colonn*`, `.sito-testo*`) con lui.
const puckNativo = (r) => r.selettori.some((x) => /^\.sito-puck|^\.sito-(due|barra|tasto|sep|pezzi|pezzo|colonne|colonna|testo)\b/.test(x))
// La scheda accanto all'elenco (`.sg-due-colonne`, `.sg-torna`, e la soglia dei 1240 px) è tolta di proposito: i dettagli della segreteria si aprono in una finestra sopra l'elenco (`prova:scheda-finestra`). `.sg-lista` e `.sg-scheda` perdono la larghezza fissa e la posizione sticky fuori dalla finestra.
const schedaAffiancata = (r) => r.selettori.some((x) => /^\.sg-due-colonne( > \.sg-scheda)?$|^\.sg-torna$|^\.sg-lista$|^\.sg-scheda$/.test(x))
// Le schede dell'iscritto e del personale non vanno più su due colonne: `.sg-scheda-griglia` è tolta di proposito, sia la regola sia quella dei telefoni.
const grigliaScheda = (r) => r.selettori.includes('.sg-scheda-griglia')
// La griglia della SETTIMANA ha ora una linea per fascia e niente tratteggio nelle caselle vuote: le cinque regole di prima (griglia, ora, casella, casella vuota, tessera chiusa) sono cambiate di proposito.
const settimanaVecchia = (r) => r.selettori.some((x) => /^\.sg-griglia$|^\.sg-ora$|^\.sg-casella$|^\.sg-casella\[data-vuota='true'\]$|^\.sg-lezione\[data-chiusa='true'\]$/.test(x))
// La riga dei movimenti ha ora la colonna della casella per scegliere (44px davanti, anche sul telefono): le tre regole di prima di `.sg-riga-movimento` (griglia, telefono: colonne e colonne nascoste) sono cambiate di proposito.
// La pagina iscrizioni/ corta: il riquadro IL VESTIARIO non sta più sotto (gli ordini si aprono solo a #vestiario, scelta dell'utente) e i
// tasti social in fondo non ci sono più, quindi le loro regole sono tolte; il fondo col tasto per cominciare ha ora respiro (gap e 32px sotto).
const vestiarioSottoLaPagina = (r) => r.selettori.some((x) => x === '.scroll > .iscrizioni-contatti' || x === '.iscrizioni-piede' || x === '.iscrizioni-richiesta')
// Le righe senza casella (`data-senza-casella`) non ci sono più: l'estratto conto le ha tutte con la casella.
// MOVIMENTI più compatti: i saldi in alto hanno la cifra a 22px (`.sg-saldo`, `.sg-saldo-cifra`), la ricerca dei filtri è più stretta (`.sg-elenco-cerca`, per stare in una riga sola) e la riga non ha più la colonna SALDO, quindi sul telefono restano solo la casella e la descrizione.
const movimentiCompatti = (r) => r.selettori.some((x) => /^\.sg-saldo$|^\.sg-elenco-cerca$|^\.sg-saldo-cifra$|^\.sg-riga-movimento > :not\(:first-child\):not\(:nth-child\(3\)\):not\(:last-child\)$/.test(x))
const rigaMovimentoConCasella = (r) => r.selettori.some((x) => /^\.sg-riga-movimento$|^\.sg-riga-movimento > :not\(:nth-child\(2\)\):not\(:last-child\)$|^\.sg-riga-movimento\[data-senza-casella='true'\]( > :first-child)?$/.test(x))
// Sul telefono COMPENSI tiene anche DA PAGARE (tre numeri, si nasconde solo TECNICI): le due regole di `.sg-numeri[data-telefono-due]` sono cambiate di proposito.
const numeriCompensi = (r) => r.selettori.some((x) => x.startsWith('.sg-numeri[data-telefono-due]'))
// IMPOSTAZIONI va a schede (`prova:impostazioni`): l'indice in cima e i titoli dei gruppi (`.sg-indice`, `.sg-regole-gruppo`, `.sg-regole-titolo`) sono tolti di proposito.
const impostazioniAGruppi = (r) => r.selettori.some((x) => /^\.sg-indice$|^\.sg-regole-(gruppo|titolo)(:focus-visible)?$/.test(x))
// CONTABILITÀ ha tre casse (Satispay): `.sg-numeri.sg-numeri-conti` va a capo da 220px invece che da 280px, così le tre stanno su una riga.
const numeriConti = (r) => r.selettori.includes('.sg-numeri.sg-numeri-conti')
// La scheda dell'iscritto rivista: i timbri tutti larghi uguale (niente più DOCUMENTO piccolo né colonna in più con la TESSERA) e la linguetta aperta scura; le loro regole sono cambiate di proposito.
const SCHEDA_RIVISTA = ['.sg-timbri', '.sg-timbri[data-con-tessera]', ".sg-timbro[data-piccolo='true']", ".sg-timbro[data-piccolo='true'] .sg-timbro-parola", ".sg-timbro[data-piccolo='true'] .sg-timbro-riga", ".sg-schede-scheda .scheda[data-on='true'] .sg-scheda-segno[data-tono='giallo']"]
const schedaRivista = (r) => r.selettori.every((x) => SCHEDA_RIVISTA.includes(x))
// Le cifre di OGGI nel Banco sono le caselle della striscia (cinque o sei, colore dallo stato): `.bn-cifre` e il vecchio `data-guaio` sono cambiati di proposito.
const cifreBanco = (r) => r.selettori.some((x) => /^\.bn-cifre$|^\.bn-cifra\[data-guaio/.test(x))
// L'area iscritti ha il look del sito: SEGNALA è cresciuto a 44px col bordo blu (`prova:look`).
const segnalaIscritti = (r) => r.selettori.includes('.mia-segnala')
// La scheda DOCUMENTI ha i tasti del certificato nel riquadro (`.sg-stato`): `.sg-tasti-cert` non c'è più, e la sua regola dei telefoni con lei.
const tastiCert = (r) => r.selettori.some((x) => x.startsWith('.sg-tasti-cert'))
// Aiuto e Impostazioni con il loro nome stanno nel riquadro di chi è dentro (`prova:menu`): la riga di icone in cima al menu non c'è più, il riquadro è più basso e DATI DI PROVA sta sempre lì; i risultati della ricerca hanno la loro icona.
const menuConNomi = (r) => r.selettori.some((x) => /^#sg-menu \.sg-icone( > \.sg-bollino)?$|^#sg-menu \.sg-chi > \.sg-bollino$|^\.sg-chi$/.test(x))
// PRESENZE non ha più le barre per corso né i numeri (rimanda a STATISTICHE): `.sg-presenze` e `.sg-barra*` sono tolte di proposito; `.sg-barra-binario` e `.sg-barra-pieno` restano, le usa STATISTICHE.
const presenzeSenzaBarre = (r) => r.selettori.some((x) => /^\.sg-presenze$|^\.sg-barra(-nome|-suggerimento|-scala)?$|^\.sg-barra[:\[]/.test(x))
if (prima !== null) ok('le regole di prima ci sono ancora tutte', rPrima.filter((r) => !tastiCert(r) && !menuConNomi(r) && !schedaRivista(r) && !presenzeSenzaBarre(r) && !segnalaIscritti(r) && !cifreBanco(r) && !numeriConti(r) && !numeriCompensi(r) && !impostazioniAGruppi(r) && !delLook(r) && !vestiarioSottoLaPagina(r) && !rigaMovimentoConCasella(r) && !movimentiCompatti(r) && !tatamiSegreteria(r) && !impaginazioneVecchia(r) && !pezziVecchio(r) && !puckNativo(r) && !schedaAffiancata(r) && !grigliaScheda(r) && !settimanaVecchia(r) && !rOra.some((o) => chiaveR(o) === chiaveR(r))).length, 0)
const sorgente = (f) => readFileSync(f, 'utf8')
ok('ModuloIscrizione.tsx usa aspettoModulo', /aspettoModulo/.test(sorgente('src/components/ModuloIscrizione.tsx')), true)
ok('ModuloIscrizione.tsx chiama apriAspettoModulo', /apriAspettoModulo\(/.test(sorgente('src/components/ModuloIscrizione.tsx')), true)
for (const f of ['OrdinaVestiario', 'IscrizioneAPassi']) ok(`${f}.tsx non usa aspettoModulo`, /aspettoModulo/.test(sorgente(`src/components/${f}.tsx`)), false)

console.log('\nLe misure')
const del = (cls) => delModulo.filter((r) => r.selettori.some((s) => new RegExp(`${cls.replace('.', '\\.')}(?![\\w-])`).test(s) && !s.slice(PREFISSO.length).includes(':')))
for (const c of ['.campo', '.modulo-corso', '.btn', '.modulo-file', '.card'])
  ok(`${c}: raggio 6px`, del(c).some((r) => /border-radius:\s*6px/.test(r.corpo)), true)
for (const [c, min] of [['.campo', 52], ['.btn', 56], ['.modulo-corso', 52]])
  ok(`${c}: nessun min-height sotto ${min}px`, del(c).flatMap((r) => [...r.corpo.matchAll(/min-height:\s*(\d+)px/g)].map((m) => +m[1])).filter((v) => v < min), [])
ok('fuoco da tastiera su ogni controllo (:focus-visible senza altro): contorno 3px var(--blu)', delModulo.some((r) => r.selettori.includes(PREFISSO + ' :focus-visible') && /outline:\s*3px solid var\(--blu\)/.test(r.corpo)), true)
ok('l\'etichetta di un file va a capo (a 320px non finisce sotto SCEGLI)', delModulo.some((r) => r.selettori.some((x) => x.includes('.modulo-etichetta')) && /overflow-wrap:\s*anywhere/.test(r.corpo)), true)
ok('il codice fiscale non è in Big Shoulders (1 e I uguali)', delModulo.some((r) => r.selettori.some((x) => x.includes('.campo-codice')) && /font-family:\s*var\(--body\)/.test(r.corpo)), true)
const firma = (cls) => delModulo.filter((r) => r.selettori.includes(`${PREFISSO} ${cls}`)).map((r) => r.corpo).join(' ')
ok('la firma a schermo intero: tasti non obliqui', /font-style:\s*normal/.test(firma('.firma-intera-tasto')), true)
ok('la firma a schermo intero: bordo dei tasti var(--riga-campo), non il filo decorativo', /border-color:\s*var\(--riga-campo\)/.test(firma('.firma-intera-tasto')), true)
ok('FATTO resta rosso, spento torna al filo', [/border-color:\s*var\(--rosso\)/.test(firma('.firma-intera-fatto')), /border-color:\s*var\(--line\)/.test(firma('.firma-intera-fatto:disabled'))], [true, true])
// Il fuoco di link e caselle: le regole di base (.costo-link:focus-visible, 2px var(--text)) hanno specificità 0,2,0; quella del modulo deve vincere (0,3,0).
ok('fuoco su link e caselle: la regola del modulo batte quelle di base (0,3,0)', delModulo.some((r) => r.selettori.includes(PREFISSO + ' :focus-visible')), true)
ok('fuoco da tastiera: contorno 3px var(--blu)', delModulo.some((r) => r.selettori.some((s) => s.includes(':focus')) && /outline:\s*3px solid var\(--blu\)/.test(r.corpo)), true)

// Il tasto del tema, a modulo aperto: il modulo è sempre chiaro, il tasto cambierebbe solo l'icona. Sparisce con una regola sotto il prefisso.
ok('a modulo aperto il tasto del tema non si vede', delModulo.some((r) => r.selettori.includes(`${PREFISSO} .tasto-tema`) && /display:\s*none/.test(r.corpo)), true)
ok('il tasto del tema porta la classe che il modulo nasconde', /className="[^"]*(?<![\w-])tasto-tema(?![\w-])/.test(readFileSync('src/components/TastoTema.tsx', 'utf8')), true)

console.log(guai ? `\n${guai} ${guai === 1 ? 'cosa non torna' : 'cose non tornano'}` : '\nTUTTO A POSTO')
process.exit(guai ? 1 : 0)
