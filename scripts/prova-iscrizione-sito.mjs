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
if (modulo) {
  const a = ambiente({})
  const m = await carica(modulo)
  const chiudi = vedi(() => m.apriAspettoModulo(a.doc))
  ok('apri mette data-modulo="sito"', a.modulo(), 'sito')
  ok('apri dà indietro chiudi()', typeof chiudi, 'function')
  ok('la barra del browser non si tocca: sta già in index.html', a.meta.content, null)
  vedi(() => chiudi())
  ok('chiudi toglie data-modulo', a.modulo(), null)
  // Chi aveva scelto un tema (nero, bianco, Tatami) lo ha ancora in `ods-tema`: va ignorato, senza errori né riscritture.
  for (const salvato of ['scuro', 'chiaro', 'tatami']) {
    const s = ambiente({ salvato })
    const ms = await carica(modulo)
    const ch = vedi(() => ms.apriAspettoModulo(s.doc))
    ok(`con ods-tema="${salvato}" il modulo ha comunque l'aspetto del sito`, s.modulo(), 'sito')
    ok(`con ods-tema="${salvato}" la chiave non si tocca`, globalThis.localStorage.getItem('ods-tema'), salvato)
    vedi(() => ch())
  }
}

// --- il CSS ------------------------------------------------------------------
const pulisci = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '')
const regole = (css) => [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, sel, corpo]) => ({ selettori: sel.split(',').map((s) => s.trim().replace(/"/g, "'")), corpo: corpo.trim() }))
const dichiarazioni = (corpo) => Object.fromEntries([...corpo.matchAll(/(--[\w-]+)\s*:\s*([^;]+?)\s*(?:;|$)/g)].map((m) => [m[1], m[2]]))
const PREFISSO = ":root[data-modulo='sito']"
// Il CSS è in due file (vedi prova-css-ingresso): le regole di prima stanno nell'uno o nell'altro.
const ora = pulisci(readFileSync('src/styles.css', 'utf8') + readFileSync('src/segreteria.css', 'utf8'))
// Il confronto è con main, non con HEAD: nel ramo o in CI HEAD contiene già le regole nuove e
// il confronto sarebbe vuoto. Senza un main con cui confrontare quei casi si saltano, non passano a vuoto.
let prima = null
for (const base of ['main', 'origin/main']) {
  try {
    const mostra = (f) => execSync(`git show ${base}:${f}`, { encoding: 'utf8', maxBuffer: 1 << 26, stdio: ['ignore', 'pipe', 'ignore'] })
    // main prima di questa divisione non ha ancora segreteria.css.
    let segreteria = ''
    try {
      segreteria = mostra('src/segreteria.css')
    } catch {
      /* tutto in styles.css */
    }
    prima = pulisci(mostra('src/styles.css') + segreteria)
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
// Senza una riserva con le stesse misure, quando il carattere arriva il testo cambia larghezza e altezza e la pagina salta (CLS).
for (const [nome, token] of [['Big Shoulders Display', '--cond'], ['Inter', '--body']]) {
  const riserva = `${nome} riserva`
  const f = faccia(`'${riserva}'`) ?? ''
  ok(`@font-face '${riserva}': Arial locale con size-adjust e ascent-override`, [/local\(['"]?Arial/.test(f), /size-adjust:/.test(f), /ascent-override:/.test(f), /descent-override:/.test(f)], [true, true, true, true])
  ok(`${token} del modulo: subito dopo ${nome} viene '${riserva}'`, new RegExp(`^['"]?${nome}['"]?\\s*,\\s*'${riserva}'`).test(T[token] ?? ''), true)
}

console.log('\nIl confinamento')
ok('ci sono regole del modulo', delModulo.length > 0, true)
ok('ogni regola che nomina data-modulo comincia per ' + PREFISSO, rOra.filter((r) => r.selettori.some((x) => x.includes('data-modulo')) && !r.selettori.every((x) => x.startsWith(PREFISSO))).map((r) => r.selettori.join(',')), [])
// Solo le regole che nominano il modulo: un'altra PR può aggiungere il suo CSS (la segreteria, il timer…), purché il modulo resti confinato.
if (prima !== null) ok('ogni regola nuova del modulo comincia per ' + PREFISSO + ' (o è un @font-face)', nuove.filter((r) => r.selettori.some((s) => s.includes('data-modulo')) && !r.selettori.every((s) => s.startsWith(PREFISSO) || s === '@font-face')).map((r) => r.selettori.join(',')), [])
// Il look della segreteria (`data-look`, PR successive a questa) ha la sua prova (`prova:look`): le sue regole possono cambiare.
const delLook = (r) => r.selettori.some((x) => x.includes('data-look'))
// Le regole di Tatami per le classi della segreteria (`.sg-*`) sono state tolte: la segreteria è sempre nel look del sito (`prova:tema` lo controlla).
const tatamiSegreteria = (r) => r.selettori.some((x) => x.includes("data-tema='tatami'") && x.includes('.sg-'))
// I temi nero, bianco e Tatami e il loro tasto sono tolti di proposito (`prova:tema`): l'aspetto è uno solo, quello del sito. Le regole del blocco base `:root` (colori e caratteri) sono passate sotto `data-look='sito'`.
const temiTolti = (r) => r.selettori.some((x) => /data-tema='(chiaro|tatami)'|tasto-tema|^:root$/.test(x)) || (r.selettori.includes('.tb-fascia') && /box-shadow/.test(r.corpo))
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
// ISCRITTI ha la colonna FAMIGLIA: la griglia della riga (anche col sollecito) e le colonne nascoste a 1000px sono cambiate di proposito, ora si passa alla vista stretta a 1200px.
const iscrittiFamiglia = (r) => r.selettori.every((x) => /^(\.sg-lista-testa)?\.sg-riga-iscritti(\[data-sollecito\])?( > :nth-child\(\d\))?$/.test(x))
// La scheda dell'iscritto rivista: i timbri tutti larghi uguale (niente più DOCUMENTO piccolo né colonna in più con la TESSERA) e la linguetta aperta scura; le loro regole sono cambiate di proposito.
const SCHEDA_RIVISTA = ['.sg-timbri', '.sg-timbri[data-con-tessera]', ".sg-timbro[data-piccolo='true']", ".sg-timbro[data-piccolo='true'] .sg-timbro-parola", ".sg-timbro[data-piccolo='true'] .sg-timbro-riga", ".sg-schede-scheda .scheda[data-on='true'] .sg-scheda-segno[data-tono='giallo']"]
// La riga di «Importa dalla banca» ha ora tipologia e persona: la griglia e le regole sotto i 1400px sono cambiate di proposito.
const rigaBancaConVoce = (r) => r.selettori.every((x) => x.startsWith('.sg-banca-'))
const schedaRivista = (r) => r.selettori.every((x) => SCHEDA_RIVISTA.includes(x))
// Le cifre di OGGI nel Banco sono le caselle della striscia (cinque o sei, colore dallo stato): `.bn-cifre` e il vecchio `data-guaio` sono cambiati di proposito.
const cifreBanco = (r) => r.selettori.some((x) => /^\.bn-cifre$|^\.bn-cifra\[data-guaio/.test(x))
// L'area iscritti ha il look del sito: SEGNALA è cresciuto a 44px col bordo blu (`prova:look`).
const segnalaIscritti = (r) => r.selettori.includes('.mia-segnala')
// I chip del nucleo (`.mia-chip-tasto`, `.mio-nucleo-scelta`) sono tolti di proposito: si cambia persona toccando il nome (`.mio-nome-scelta`, 44px, in `prova:look`).
const chipIscritti = (r) => r.selettori.some((x) => /^\.(mia-chip-tasto|mio-nucleo-scelta)\b/.test(x))
// Le presenze dell'area iscritti sono righe a sé, ognuna col suo riquadro (come le lezioni): `.mie-presenze` senza riquadro e il filo fra le righe sono cambiati di proposito.
const presenzeARighe = (r) => r.selettori.some((x) => /^\.mie-presenze$|^\.mia-presenza(-voce)? \+ \.mia-presenza(-voce)?$/.test(x))
// La scheda DOCUMENTI ha i tasti del certificato nel riquadro (`.sg-stato`): `.sg-tasti-cert` non c'è più, e la sua regola dei telefoni con lei.
const tastiCert = (r) => r.selettori.some((x) => x.startsWith('.sg-tasti-cert'))
// Aiuto e Impostazioni con il loro nome stanno nel riquadro di chi è dentro (`prova:menu`): la riga di icone in cima al menu non c'è più, il riquadro è più basso e DATI DI PROVA sta sempre lì; i risultati della ricerca hanno la loro icona.
const menuConNomi = (r) => r.selettori.some((x) => /^#sg-menu \.sg-icone( > \.sg-bollino)?$|^#sg-menu \.sg-chi > \.sg-bollino$|^\.sg-chi$/.test(x))
// PRESENZE non ha più le barre per corso né i numeri (rimanda a STATISTICHE): `.sg-presenze` e `.sg-barra*` sono tolte di proposito; `.sg-barra-binario` e `.sg-barra-pieno` restano, le usa STATISTICHE.
const presenzeSenzaBarre = (r) => r.selettori.some((x) => /^\.sg-presenze$|^\.sg-barra(-nome|-suggerimento|-scala)?$|^\.sg-barra[:\[]/.test(x))
// Il sollecito è un tasto in testata e le azioni rare stanno in «Altro» (`prova:scheda-iscritto`): il gruppo a destra del piede e la riga «Sollecitato…» nel riquadro sono tolti di proposito.
const testataScheda = (r) => r.selettori.some((x) => /^\.sg-scheda-piede > \.sg-scheda-piede-destra$|^\.sg-sollecito-ultimo$/.test(x))
// L'area iscritti: VEDI TUTTE e lo stato della presenza (NON SEGNATO, PRESENTE) sono scuri abbastanza (`prova:a11y-iscritti`). Ha il nome nel saluto sottolineato, l'etichetta a destra della lezione che può andare a capo (e niente più verde: non c'è un «fatto» nelle lezioni) e il segno della presenza come icona: le loro regole sono cambiate di proposito.
const areaIscrittiRivista = (r) => r.selettori.some((x) => /^\.mio-nome$|^\.mia-lezione-cosa(\[data-tono='fatto'\])?$|^\.mia-presenza-segno$|^\.mia-vedi-tutte$|^\.mia-presenza-detto$|^\.mia-presenza-piccola \.mia-presenza-detto$|^\.mia-presenza-piccola\[data-tono='spento'\]$/.test(x))
// La barra del menu sui telefoni va a capo a 320px (reflow, WCAG 1.4.10): `.sg-barra-tel` ha `flex-wrap` e il suo gap a due valori, e la regola è cambiata di proposito.
const barraTelefono = (r) => r.selettori.includes('.sg-barra-tel')
// Il tasto di ordinamento delle colonne è alto almeno 24px (WCAG 2.5.8, `prova:a11y-dietro-login`): la sua regola base è cambiata di proposito.
const ordinaAlto = (r) => r.selettori.includes('.sg-ordina') && /display:\s*inline-flex/.test(r.corpo)
// Il luogo in testata è l'h1 di alcune pagine (`prova:a11y-dietro-login`): la sua regola base ha ora il margine a zero (l'h1 ne ha uno suo), per non cambiare l'aspetto.
const testataH1 = (r) => r.selettori.includes('.testata-luogo') && /font-size:\s*11px/.test(r.corpo)
// Il nome nelle righe delle tabelle è alto almeno 24px (WCAG 2.5.8, `prova:a11y-segreteria-bersagli`): la sua regola base è cambiata di proposito.
// Il corso nelle tabelle di STATISTICHE è alto almeno 24px (WCAG 2.5.8): la regola base di `.sg-stat-corso` è cambiata di proposito.
const statCorsoAlto = (r) => r.selettori.includes('.sg-stat-corso') && /padding:\s*2px 0 2px 10px/.test(r.corpo) && !/min-height/.test(r.corpo)
const nomeInRigaAlto = (r) => r.selettori.includes('.sg-riga-apri') && /min-height:\s*0;/.test(r.corpo)
// Le schede «Quali lezioni» del tablet istruttore hanno l'icona sopra il nome: la regola base di `.tb-scheda` (colonna, più alta) è cambiata di proposito.
const schedeTabletConIcona = (r) => r.selettori.includes('.tb-scheda') && /min-height:\s*60px/.test(r.corpo)
// Il dettaglio di una persona si apre in una finestra più larga (1200px invece di 920px, qui si riconosce la regola di prima): la regola base di `.sg-finestra` è cambiata di proposito.
const finestraLarga = (r) => r.selettori.includes('.sg-finestra') && /width:\s*min\(920px/.test(r.corpo)
const listinoLargo = (r) => r.selettori.includes('.sg-listino') && /max-width:\s*980px/.test(r.corpo)
// La pagina non salta (CLS): le pile dei caratteri del sito hanno la riserva misurata, e l'attesa del listino non ha più un'altezza fissa (`prova:iscrizione-pagina`).
// Le icone dappertutto (`prova:icone`): i titoli, gli stati delle ore e i tasti piccoli del tablet affiancano l'icona alla parola (flex),
// ▲ ▼ ↕ delle colonne sono icone (`.sg-ordina-segno` non c'è più) e l'icona del contatto in ISCRITTI è la stessa dell'elenco unico.
const iconeDappertutto = (r) => r.selettori.some((x) => /^\.rule-label$|^\.mie-ore-stato$|^\.tb-tasto\[data-piccolo='true'\]$|\.sg-ordina-segno$|^\.sg-icona-contatto$/.test(x))
const senzaSalti = (r) => (/--cond:\s*'Big Shoulders Display', 'Arial Narrow'/.test(r.corpo) && /--body:\s*Inter, 'Helvetica Neue'/.test(r.corpo)) || r.selettori.includes('.iscrizioni-costi-attesa > *')
// La scheda di una gara ha le righe degli atleti a due piani (`.sg-gara-atleta`, `prova:gare`): la tabella a colonne `.sg-riga-atleta-gara` e le sue regole (anche quelle condivise con `.sg-riga-gara`) sono tolte di proposito.
// La finestra del movimento aperto è a colonna unica (testata, suggerimento a due colonne, piede): `.sg-movimento-colonne` e le sue regole sono tolte di proposito.
const movimentoAColonnaUnica = (r) => r.selettori.some((x) => /sg-movimento-colonne/.test(x))
const schedaGaraRivista = (r) => r.selettori.some((x) => /sg-riga-atleta-gara/.test(x))
// La segreteria in ordine (`prova:segreteria-ordine`): le schede sono linguette sottolineate, `.sg-link` e `.sg-ordina` sono alti 44px
// da sé (niente più ::after che allarga il tocco), la testata tiene i tasti a destra, il segno dello stato è a 14px e sta in styles.css,
// le sezioni di PRESENZE sono `.sg-elenco` (`.sg-chiudibile` tolta) e i presenti del registro stanno nella riga, senza un bordo loro.
// Una per una, le regole di prima che cambiano: un'altra regola con gli stessi selettori, se sparisce, fa ancora cadere la prova.
const SEGRETERIA_IN_ORDINE = new Set([
  // Al computer il sotto di un movimento sta su una riga, tagliato con «…» (`prova:segreteria-ordine`).
  ".sg-sotto-movimento{display: flex; flex-direction: column; font-size: 13px; color: var(--sec); font-weight: 400; overflow-wrap: anywhere;}",
  ".scheda{min-height: 40px; background: var(--surface); border: 2px solid var(--line); font-family: var(--cond); font-size: 14px; font-weight: 700; letter-spacing: 0.18em; color: var(--dim);}",
  ".scheda[data-on='true']{background: var(--surface-2); border-color: var(--text); color: var(--text);}",
  ".sg-link{font-size: 13px; color: var(--dim); text-decoration: underline; text-underline-offset: 3px; text-align: left;}",
  ".sg-link,.sg-ordina{position: relative;}",
  ".sg-link::after,.sg-ordina::after{content: ''; position: absolute; inset: -13px -6px;}",
  ".sg-chi > .sg-link::after{content: none;}",
  ".sg-ordina::after{inset: -13px 0;}",
  ".sg-testa{display: flex; align-items: center; gap: 12px; flex-wrap: wrap;}",
  ".sg-filtro-menu-valore{font-weight: 600; max-width: 220px; overflow: hidden; text-overflow: ellipsis;}",
  ".sg-ordina{display: inline-flex; align-items: center; min-height: 24px; gap: 4px; white-space: nowrap; font: inherit; letter-spacing: inherit; color: inherit; text-align: inherit;}",
  ".sg-chiudibile > summary > .sg-riga-titolo{flex: 1;}",
  ".sg-lista-testa.sg-riga-iscritti .sg-ordina::after{inset: -13px -8px;}",
  ".sg-segno-elenco{display: inline-flex; align-items: center; gap: 7px; font-size: 13px; font-weight: 500; color: var(--text); white-space: nowrap;}",
  ".sg-registro[open] > summary{border-color: var(--text);}",
  ".sg-registro-nomi{display: flex; flex-direction: column; gap: 4px; padding: 10px 14px 12px; border: 2px solid var(--line); border-top: 0;}",
  ".sg-chiudibile > summary{display: flex; align-items: center; gap: 14px; min-height: 44px; cursor: pointer; list-style: none;}",
  ".sg-chiudibile > summary::-webkit-details-marker{display: none;}",
  ".sg-chiudibile > summary::after{content: '⌄'; font-size: 18px; color: var(--dim);}",
  ".sg-chiudibile[open] > summary::after{content: '⌃';}",
  ".sg-chiudibile[open] > summary{margin-bottom: 10px;}",
  ".sg-chiudibile[data-allarme='true']{box-shadow: inset 4px 0 0 var(--rosso);}",
])
const segreteriaInOrdine = (r) => SEGRETERIA_IN_ORDINE.has(chiaveR(r))
if (prima !== null) ok('le regole di prima ci sono ancora tutte', rPrima.filter((r) => !segreteriaInOrdine(r) && !senzaSalti(r) && !schedaGaraRivista(r) && !movimentoAColonnaUnica(r) && !testataH1(r) && !barraTelefono(r) && !testataScheda(r) && !tastiCert(r) && !menuConNomi(r) && !schedaRivista(r) && !rigaBancaConVoce(r) && !areaIscrittiRivista(r) && !presenzeSenzaBarre(r) && !segnalaIscritti(r) && !chipIscritti(r) && !presenzeARighe(r) && !cifreBanco(r) && !numeriConti(r) && !numeriCompensi(r) && !impostazioniAGruppi(r) && !delLook(r) && !vestiarioSottoLaPagina(r) && !rigaMovimentoConCasella(r) && !movimentiCompatti(r) && !tatamiSegreteria(r) && !temiTolti(r) && !impaginazioneVecchia(r) && !pezziVecchio(r) && !puckNativo(r) && !schedaAffiancata(r) && !grigliaScheda(r) && !settimanaVecchia(r) && !ordinaAlto(r) && !nomeInRigaAlto(r) && !statCorsoAlto(r) && !iscrittiFamiglia(r) && !listinoLargo(r) && !finestraLarga(r) && !schedeTabletConIcona(r) && !iconeDappertutto(r) && !rOra.some((o) => chiaveR(o) === chiaveR(r))).length, 0)
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


console.log(guai ? `\n${guai} ${guai === 1 ? 'cosa non torna' : 'cose non tornano'}` : '\nTUTTO A POSTO')
process.exit(guai ? 1 : 0)
