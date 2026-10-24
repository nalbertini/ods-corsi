// ---------------------------------------------------------------------------
// I contrasti del menu di segreteria e della mappa orari di Statistiche, senza browser.
//
//   node scripts/prova-contrasti-segreteria.mjs
//
// Lighthouse trovò del testo debole nella mappa orari di Statistiche. Qui i token di `styles.css` si
// risolvono per ogni tema e si calcola il rapporto: 4,5:1 per il testo.
// ---------------------------------------------------------------------------
import { readFileSync } from 'node:fs'

let guai = 0
const ok = (cosa, avuto, voluto) => {
  const va = JSON.stringify(avuto) === JSON.stringify(voluto)
  console.log(va ? '  ✓' : '  ✗', cosa, va ? '' : `— atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`)
  if (!va) guai++
}

const css = readFileSync('src/styles.css', 'utf8')
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
const luce = (h) => {
  const [r, g, b] = rgb(h).map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contrasto = (a, b) => {
  const [x, y] = [luce(a), luce(b)].sort((p, q) => q - p)
  return Math.floor(((x + 0.05) / (y + 0.05)) * 100) / 100
}
/** color-mix(in srgb, a p%, b) */
const mescola = (a, p, b) => a.map((v, i) => Math.round((v * p) / 100 + b[i] * (1 - p / 100)))

/** I token di un blocco `selettore { … }`, l'ultimo che c'è. */
const token = (selettore) => {
  const t = {}
  const re = new RegExp(`^${selettore.replace(/[[\]().']/g, '\\$&')}\\s*(?:,[^{]*)?\\{([^}]*)\\}`, 'gm')
  for (const m of css.matchAll(re)) for (const [, k, v] of m[1].matchAll(/(--[\w-]+):\s*(#[0-9a-f]{6})/gi)) t[k] = v
  return t
}
const radice = token(':root')
const temi = {
  scuro: radice,
  chiaro: { ...radice, ...token(":root[data-tema='chiaro']") },
  tatami: { ...radice, ...token(":root[data-tema='tatami']") },
  sito: { ...radice, ...token(":root[data-look='sito']") },
}
// Dentro il menu i token cambiano nel look sito. Il Tatami non c'è: la segreteria e gli istruttori
// hanno sempre il look sito (`lib/aspettoSegreteria.ts`), che comanda sul tema.
const dentroMenu = {
  scuro: temi.scuro,
  chiaro: temi.chiaro,
  sito: { ...temi.sito, ...token(":root[data-look='sito'] .sg-menu") },
}

for (const [nome, t] of Object.entries(dentroMenu)) {
  console.log(`menu · ${nome}`)
  for (const tk of ['--sec', '--dim']) ok(`${tk} sul fondo del menu ≥ 4,5`, contrasto(t[tk], t['--menu']) >= 4.5, true)
}
const percentualeSito = Number(css.match(/data-look='sito'\] \.sg-orario\[data-gradino='3'\] \{[^}]*color-mix\(in srgb, var\(--blu\) (\d+)%/)?.[1] ?? 78)
for (const [nome, t] of Object.entries(temi)) {
  console.log(`mappa orari · ${nome}`)
  const sup = rgb(t['--surface'])
  const blu = rgb(t['--blu'])
  const hex = (c) => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('')
  ok('gradino 0 (testo su surface-2)', contrasto(t['--text'], t['--surface-2']) >= 4.5, true)
  ok('gradino 1', contrasto(t['--text'], hex(mescola(blu, 30, sup))) >= 4.5, true)
  ok('gradino 2', contrasto(t['--text'], hex(mescola(blu, 55, sup))) >= 4.5, true)
  ok('gradino 3', contrasto(t['--text'], hex(mescola(blu, nome === 'sito' ? percentualeSito : 78, sup))) >= 4.5, true)
  // Il look sito scrive il gradino 4 in bianco (`su-rosso`): il suo `su-colore` su quel blu si ferma a 2,7:1.
  ok('gradino 4', contrasto(nome === 'sito' ? t['--su-rosso'] : t['--su-colore'], t['--blu']) >= 4.5, true)
}
process.exit(guai ? 1 : 0)
