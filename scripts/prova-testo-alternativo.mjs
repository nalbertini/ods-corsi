// ---------------------------------------------------------------------------
// Immagini, icone e tasti-icona hanno un nome o sono nascosti a chi legge lo schermo,
// senza browser: scansione dei sorgenti di `src/` e `timer/src/`.
//
//   node scripts/prova-testo-alternativo.mjs
//
// Ogni <img> ha `alt` (vuoto se decorativa), ogni <svg> è `aria-hidden` o ha
// `role="img"` con un nome, ogni <button> senza lettere ha `aria-label`.
// ---------------------------------------------------------------------------
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

let fallite = 0
const ok = (cosa, avuto, voluto) => {
  const bene = JSON.stringify(avuto) === JSON.stringify(voluto)
  if (!bene) fallite++
  console.log(`${bene ? 'ok  ' : 'KO  '}${cosa}${bene ? '' : ` — avuto ${JSON.stringify(avuto)}, voluto ${JSON.stringify(voluto)}`}`)
}

const tsx = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? tsx(join(d, e.name)) : e.name.endsWith('.tsx') ? [join(d, e.name)] : []))
const riga = (s, i) => s.slice(0, i).split('\n').length

// Gli attributi di un tag JSX: `{…}` può contenere `>` (le frecce) e altre graffe.
const ATTRI = String.raw`((?:[^>{]|\{(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*\})*)`

/** Le violazioni di un sorgente, come «file:riga cosa». */
export function trova(file, s) {
  const male = []
  for (const m of s.matchAll(new RegExp(`<img\\b${ATTRI}>`, 'g'))) {
    if (!/\balt=/.test(m[1])) male.push(`${file}:${riga(s, m.index)} <img> senza alt`)
  }
  for (const m of s.matchAll(new RegExp(`<svg\\b${ATTRI}>`, 'g'))) {
    if (!/aria-hidden|role="img"/.test(m[1])) male.push(`${file}:${riga(s, m.index)} <svg> né nascosto né col nome`)
    if (/role="img"/.test(m[1]) && !/aria-label/.test(m[1])) male.push(`${file}:${riga(s, m.index)} <svg role="img"> senza aria-label`)
  }
  for (const m of s.matchAll(new RegExp(`<button\\b${ATTRI}>([\\s\\S]*?)</button>`, 'g'))) {
    if (/aria-label|aria-labelledby|title=/.test(m[1])) continue
    const testo = m[2]
      .replace(/<svg[\s\S]*?<\/svg>/g, '')
      .replace(/<[^>]*aria-hidden[^>]*>[^<]*<\/\w+>/g, '')
      .replace(/<[A-Z]\w*[^>]*\/>/g, '')
      .replace(/<[^>]*>/g, '')
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    if (!/[\p{L}\p{N}]/u.test(testo)) male.push(`${file}:${riga(s, m.index)} <button> senza testo né aria-label`)
  }
  return male
}

// La prova sa riconoscere i casi sbagliati (se no non vedrebbe mai niente).
ok('un <img> senza alt si vede', trova('x.tsx', '<img src={u} />').length, 1)
ok('un <img alt=""> (decorativa) va bene', trova('x.tsx', '<img src={u} alt="" />').length, 0)
ok('un <svg> senza aria-hidden si vede', trova('x.tsx', '<svg width={1}><path /></svg>').length, 1)
ok('un <svg role="img"> senza nome si vede', trova('x.tsx', '<svg role="img"><path /></svg>').length, 1)
ok('un <button> con la sola icona si vede', trova('x.tsx', '<button onClick={() => f()}><Chiudi /></button>').length, 1)
ok('un <button> con la sola icona e aria-label va bene', trova('x.tsx', '<button aria-label="Chiudi" onClick={() => f()}><Chiudi /></button>').length, 0)
ok('un <button> con testo va bene', trova('x.tsx', '<button onClick={() => f()}><Chiudi />Chiudi</button>').length, 0)

const tutte = ['src', 'timer/src'].flatMap(tsx).flatMap((f) => trova(f, readFileSync(f, 'utf8')))
ok('nei sorgenti non c’è niente senza nome o senza alt', tutte, [])

if (fallite) process.exit(1)
