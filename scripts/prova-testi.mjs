// ---------------------------------------------------------------------------
// I testi di tasti, tag e conferme della segreteria non gridano, senza browser.
//
//   node scripts/prova-testi.mjs
//
// Nelle schermate in FILE i tasti, i tag (sg-tag, sg-chip, sg-bollino) e le
// etichette dei tasti di conferma (chiedi(…, 'ETICHETTA')) vanno con la
// iniziale maiuscola. Le etichette di colonna e i titoli restano maiuscoli:
// non sono in questi contesti, quindi non si controllano. Le PR successive
// allargano FILE. Limiti: non vede `.toUpperCase()` nel codice né i tag con la class in una variabile.
// ---------------------------------------------------------------------------
import { readFileSync } from 'node:fs'

const D = 'src/components/segreteria/'
const FILE = ['Settimana', 'CalendarioSettimana', 'Presenze', 'PresenzeIstruttori', 'PresenzeSegnalate', 'Richieste', 'Corsi', 'Tessere', 'Listino', 'PagamentoAperto', 'Ricevute', 'Contabilita', 'Vestiario', 'Importa', 'Iscritti', 'Sito', 'EditorPuck', 'ImmaginiSito', 'Statistiche', 'Segnalazioni', 'TimerPalestra', 'Personale', 'Regole', 'Segreteria', 'CosaManca', 'comune', 'DaFare', 'CercaIscritto', 'FiltroRicerca', 'AnteprimaPagina', 'banco/BarraBanco', 'banco/Oggi', 'banco/PersonaBanco'].map((f) => `${D}${f}.tsx`)
// Parole che restano maiuscole per scelta, per file: il tasto MENU/CHIUDI della barra del telefono e il bollino DATI DI PROVA (una sigla di stato).
const ECCEZIONI = { Segreteria: ['MENU', 'CHIUDI', 'DATI', 'PROVA'], 'banco/BarraBanco': ['DATI', 'PROVA'] }
const SIGLE = new Set(['CSV', 'PDF', 'PIN', 'RASD', 'IBAN', 'FIJLKAM', 'FIPE'])

// Fine di un tag aperto che comincia in i: salta {…} e apici (c'è «=>» negli attributi).
function fineTag(s, i) {
  let g = 0
  for (let k = i; k < s.length; k++) {
    const c = s[k]
    if (c === '{') g++
    else if (c === '}') g--
    else if (g === 0 && (c === '"' || c === "'")) k = s.indexOf(c, k + 1)
    else if (g === 0 && c === '>') return k
    if (k < 0) return s.length
  }
  return s.length
}
// Il testo che si vede: il JSX fuori dalle graffe più le stringhe dentro.
function testo(s) {
  let fuori = ''
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '<') { i = fineTag(s, i); fuori += ' '; continue }
    if (s[i] === '{') {
      let g = 1, k = i + 1
      for (; k < s.length && g; k++) g += s[k] === '{' ? 1 : s[k] === '}' ? -1 : 0
      for (const m of s.slice(i, k).matchAll(/'([^'\n]*)'|"([^"\n]*)"|`([^`]*)`/g)) fuori += ' ' + (m[1] ?? m[2] ?? m[3])
      i = k - 1
      continue
    }
    fuori += s[i]
  }
  return fuori
}
// Il secondo argomento di ogni chiedi( …, 'ETICHETTA', …).
function etichetteChiedi(s) {
  const out = []
  for (const m of s.matchAll(/\bchiedi\(/g)) {
    // il secondo argomento va dalla prima virgola alla successiva
    const resto = s.slice(m.index + m[0].length)
    let g2 = 0, v = []
    for (let k = 0; k < resto.length; k++) {
      const c = resto[k]
      if (c === '"' || c === "'" || c === '`') { k = resto.indexOf(c, k + 1); continue }
      if ('([{'.includes(c)) g2++
      else if (')]}'.includes(c)) { if (g2 === 0) { v.push(k); break } g2-- }
      else if (c === ',' && g2 === 0) v.push(k)
    }
    if (v.length >= 2) out.push(resto.slice(v[0] + 1, v[1]))
    else if (v.length === 1 && resto[v[0]] === ')') out.push('')
  }
  return out.map((a) => [...a.matchAll(/'([^'\n]*)'|"([^"\n]*)"|`([^`]*)`/g)].map((x) => x[1] ?? x[2] ?? x[3]).join(' '))
}

export function trovaMaiuscole(src) {
  const testi = []
  for (const m of src.matchAll(/<(\w+)\b/g)) {
    const fine = fineTag(src, m.index)
    const apertura = src.slice(m.index, fine + 1)
    if (apertura.endsWith('/>')) continue
    const classe = /class(Name)?=("[^"]*"|\{[^}]*\})/.exec(apertura)?.[2] ?? ''
    if (m[1] !== 'button' && !/sg-(tag|chip|bollino|btn)/.test(classe)) continue
    const chiusura = src.indexOf(`</${m[1]}>`, fine)
    if (chiusura > 0) testi.push(testo(src.slice(fine + 1, chiusura)))
  }
  testi.push(...etichetteChiedi(src))
  // L'altra etichetta di una conferma (`no: 'NO, LASCIALA'`) e l'azione di un avviso (`etichetta: 'ANNULLA'`).
  for (const m of src.matchAll(/\b(?:no|etichetta):\s*(['"])([^'"\n]*)\1/g)) testi.push(m[2])
  const parole = new Set()
  for (const t of testi) for (const w of t.matchAll(/(?<![\p{L}\p{N}_])\p{Lu}{4,}(?![\p{L}\p{N}_])/gu)) if (w[0] === w[0].toUpperCase() && !SIGLE.has(w[0])) parole.add(w[0])
  return [...parole]
}

let guai = 0
const ok = (cosa, avuto, voluto) => {
  const va = JSON.stringify(avuto) === JSON.stringify(voluto)
  console.log(va ? '  ✓' : '  ✗', cosa, va ? '' : `— atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`)
  if (!va) guai++
}

console.log('\nIl controllo trova i casi e non dà falsi allarmi')
ok('l\'etichetta di colonna non conta', trovaMaiuscole('<span className="sg-etichetta">APPELLO</span>'), [])
ok('un tasto tutto maiuscolo sì', trovaMaiuscole('<button>AZZERA</button>'), ['AZZERA'])
ok('un tasto con onClick a freccia e più righe', trovaMaiuscole('<button onClick={() => fai()}>\n  Salva e TORNA\n</button>'), ['TORNA'])
ok('le stringhe dentro le graffe di un tasto', trovaMaiuscole("<button>{x ? 'FATTO' : 'NON ANCORA'}</button>"), ['FATTO', 'ANCORA'])
ok('un tag sg-tag, con l\'attributo data-tipo', trovaMaiuscole('<span className="num sg-tag" data-tipo="manca">SENZA APPELLO</span>'), ['SENZA', 'APPELLO'])
ok('la conferma: il secondo argomento di chiedi', trovaMaiuscole("chiedi(`Togli ${nome}?`, 'TOGLI', { x: 1 })"), ['TOGLI'])
ok('un tasto fatto con una label sg-btn', trovaMaiuscole('<label className="sg-btn sg-btn-linea">SCEGLI IL FOGLIO</label>'), ['SCEGLI', 'FOGLIO'])
ok('l\'altra etichetta di una conferma e l\'azione di un avviso', trovaMaiuscole("chiedi(`Togli?`, 'Togli', { no: 'NO, LASCIALA' }) avviso({ etichetta: 'ANNULLA' })"), ['LASCIALA', 'ANNULLA'])
ok('iniziale maiuscola e sigle vanno bene', trovaMaiuscole('<button>Segna tutti</button><span className="sg-chip">CSV</span><button>Apri PDF</button>'), [])
ok('il testo fuori dai tasti non conta', trovaMaiuscole('<p>ATTENZIONE</p> chiedi(`Togli?`, \'Togli\', {})'), [])

// Il tasto di conferma comincia con la maiuscola («Sì, annulla…»), non con «sì, annulla…».
export const conferme = (src) => etichetteChiedi(src).map((t) => t.trim()).filter((t) => /^\p{Ll}/u.test(t))
ok('una conferma che comincia minuscola si vede', conferme("chiedi(`Togli?`, 'togli il giorno', {})"), ['togli il giorno'])
ok('una conferma con la maiuscola va bene', conferme("chiedi(`Togli?`, 'Sì, togli', {})"), [])

if (process.argv[1]?.endsWith('prova-testi.mjs')) {
  console.log('\nI testi dei file controllati')
  for (const f of FILE) ok(`${f.replace(D, '')}: nessuna parola tutta maiuscola`, trovaMaiuscole(readFileSync(f, 'utf8')).filter((w) => !(ECCEZIONI[f.replace(D, '').replace('.tsx', '')] ?? []).includes(w)), [])
  for (const f of FILE) ok(`${f.replace(D, '')}: i tasti di conferma cominciano con la maiuscola`, conferme(readFileSync(f, 'utf8')), [])
  console.log(guai ? `\n${guai} da sistemare` : '\ntutto a posto')
  process.exit(guai ? 1 : 0)
}
