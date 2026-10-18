// ---------------------------------------------------------------------------
// I pulsanti che tolgono qualcosa, in Segreteria, provati senza browser.
//
//   node scripts/prova-pericolo.mjs
//
// Cancellare, eliminare, annullare, togliere, disattivare: il pulsante è
// rosso (`sg-pericolo`, o `sg-btn-rosso`) e prima di fare chiede conferma con
// `chiedi`. Fanno eccezione i pulsanti che toccano una bozza ancora da
// salvare (`data-bozza`): sono rossi lo stesso, ma lì SALVA è la conferma e Lascia stare butta tutto.
// ---------------------------------------------------------------------------
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

let guai = 0
const ok = (cosa, avuto, voluto) => {
  const va = JSON.stringify(avuto) === JSON.stringify(voluto)
  console.log(va ? '  ✓' : '  ✗', cosa, va ? '' : `— atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`)
  if (!va) guai++
}

const file = (cartella) =>
  readdirSync(cartella).flatMap((n) => {
    const p = join(cartella, n)
    return statSync(p).isDirectory() ? file(p) : p.endsWith('.tsx') ? [p] : []
  })

// L'attributo `onClick={...}` e quelli come lui: si scorre le graffe in pari.
function fineAttributi(src, da) {
  let graffe = 0
  let apice = ''
  for (let i = da; i < src.length; i++) {
    const c = src[i]
    if (apice) {
      if (c === '\\') i++
      else if (c === apice) apice = ''
    } else if (c === '"' || c === "'" || c === '`') apice = c
    else if (c === '{') graffe++
    else if (c === '}') graffe--
    else if (c === '>' && graffe === 0 && src[i - 1] !== '=') return i
  }
  return -1
}

const DICE = /^(Cancella|Elimina|Annulla\s+\S|Togli(?!.*(filtri|ricerca))|Disattiva|Azzera|Rimuovi|Svuota)/i

function pulsanti(src) {
  const fuori = []
  for (let a = src.indexOf('<button'); a >= 0; a = src.indexOf('<button', a + 1)) {
    const f = fineAttributi(src, a + 7)
    const chiude = src.indexOf('</button>', f)
    if (f < 0 || chiude < 0) continue
    const attr = src.slice(a + 7, f)
    const dentro = src.slice(f + 1, chiude)
    // Il testo che si legge: il testo semplice e le stringhe dentro le graffe.
    const parole = [
      ...dentro.replace(/\{[^}]*\}/g, (g) => ` ${[...g.matchAll(/'([^']*)'|"([^"]*)"/g)].map((m) => m[1] ?? m[2]).join(' | ')} `).split('|'),
      attr.match(/aria-label="([^"]*)"/)?.[1] ?? '',
      attr.match(/aria-label=\{`([^`]*)`\}/)?.[1] ?? '',
    ].map((x) => x.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim())
    if (!parole.some((p) => DICE.test(p))) continue
    const riga = src.slice(0, a).split('\n').length
    fuori.push({ riga, attr, parole: parole.filter(Boolean).join(' / ') })
  }
  return fuori
}

// Il contenuto di `nome={...}` fra le graffe in pari.
function espressione(attr, nome) {
  const a = attr.indexOf(`${nome}={`)
  if (a < 0) return ''
  const da = a + nome.length + 2
  const f = fineAttributi(attr + '>', da - 1)
  let g = 1
  let apice = ''
  for (let i = da; i < attr.length; i++) {
    const c = attr[i]
    if (apice) {
      if (c === '\\') i++
      else if (c === apice) apice = ''
    } else if (c === '"' || c === "'" || c === '`') apice = c
    else if (c === '{') g++
    else if (c === '}' && --g === 0) return attr.slice(da, i)
  }
  return attr.slice(da, f)
}

// Il corpo di una funzione dello stesso file, abbastanza per vedere se chiede.
function chiede(src, attr) {
  const click = espressione(attr, 'onClick')
  if (/\bchiedi\(/.test(click)) return true
  const nomi = [...click.matchAll(/(?<![.\w])([a-zA-Z_]\w*)\(/g)].map((m) => m[1]).filter((n) => !['void', 'async', 'await', 'fai', 'if', 'return', 'setBozza', 'cambia'].includes(n))
  if (/^[a-zA-Z_]\w*$/.test(click.trim())) nomi.push(click.trim())
  for (const n of nomi) {
    for (const d of src.matchAll(new RegExp(`(?:const|function|let)\\s+${n}\\b`, 'g'))) {
      if (/\bchiedi\(/.test(src.slice(d.index, d.index + 3000).split(/\n  (?:const|function) /)[0])) return true
    }
  }
  // Ceiling: un gestore passato dal genitore (`onTogli`, `onAnnulla`): lo definisce un altro componente dello stesso file.
  return /^on[A-Z]\w*$/.test(click.trim()) && /\bchiedi\(/.test(src)
}

const radice = 'src/components/segreteria'
let visti = 0
for (const f of file(radice)) {
  const src = readFileSync(f, 'utf8')
  if (f.endsWith('comune.tsx')) continue
  if (/window\.confirm\(/.test(src)) ok(`${f}: niente confirm del browser, si usa chiedi`, true, false)
  for (const p of pulsanti(src)) {
    visti++
    const nome = `${f}:${p.riga} «${p.parole}»`
    ok(`${nome} è rosso`, /sg-pericolo|sg-btn-rosso/.test(p.attr), true)
    if (/\bdata-bozza\b/.test(p.attr)) continue
    ok(`${nome} chiede conferma`, chiede(src, p.attr), true)
  }
}
ok('ci sono pulsanti da controllare', visti > 15, true)

// Gli argomenti di una chiamata, divisi alla virgola di primo livello (stringhe e template compresi).
function argomenti(src, aperta) {
  const arg = []
  let da = aperta + 1
  let livello = 0
  for (let i = da; i < src.length; i++) {
    const c = src[i]
    if (c === "'" || c === '"' || c === '`') {
      for (i++; i < src.length && src[i] !== c; i++) {
        if (src[i] === '\\') i++
        else if (c === '`' && src[i] === '$' && src[i + 1] === '{') {
          let g = 0
          for (; i < src.length; i++) {
            if (src[i] === '{') g++
            else if (src[i] === '}' && --g === 0) break
          }
        }
      }
    } else if ('([{'.includes(c)) livello++
    else if (')]}'.includes(c)) {
      if (livello === 0) return [...arg, src.slice(da, i)]
      livello--
    } else if (c === ',' && livello === 0) {
      arg.push(src.slice(da, i))
      da = i + 1
    }
  }
  return arg
}

// La conferma di ciò che toglie ha il «sì» rosso: `pericolo: true`.
const TOGLIE = /^['"`](Sì, )?(cancella|elimina|togli|annulla|disattiva|azzera|svuota|butta)/i
for (const f of file(radice)) {
  const src = readFileSync(f, 'utf8')
  if (f.endsWith('comune.tsx')) continue
  for (const m of src.matchAll(/\bchiedi\(/g)) {
    const [, si, opz = ''] = argomenti(src, m.index + 6).map((x) => x.trim())
    if (!si || !TOGLIE.test(si)) continue
    const riga = src.slice(0, m.index).split('\n').length
    ok(`${f}:${riga} la conferma ${si} ha il sì rosso`, /pericolo:\s*true/.test(opz), true)
  }
}

if (guai) {
  console.log(`\n${guai} guai`)
  process.exit(1)
}
console.log('\nTutto a posto')
