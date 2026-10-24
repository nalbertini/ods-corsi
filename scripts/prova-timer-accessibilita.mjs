// ---------------------------------------------------------------------------
// L'accessibilità della pagina del timer, senza browser (`timer/index.html`, `timer/src/styles.css`).
//
//   node scripts/prova-timer-accessibilita.mjs
//
// Lo zoom non si blocca, la pagina ha un <main>, e la scheda accesa in basso
// resta leggibile (4,5:1) sul tema chiaro. Trovati da Lighthouse sul timer.
// ---------------------------------------------------------------------------
import { readFileSync } from 'node:fs'

let fallite = 0
const ok = (cosa, avuto, voluto) => {
  const bene = JSON.stringify(avuto) === JSON.stringify(voluto)
  if (!bene) fallite++
  console.log(`${bene ? 'ok  ' : 'KO  '}${cosa}${bene ? '' : ` — avuto ${JSON.stringify(avuto)}, voluto ${JSON.stringify(voluto)}`}`)
}

const html = readFileSync('timer/index.html', 'utf8')
const css = readFileSync('timer/src/styles.css', 'utf8')

ok('lo zoom non è bloccato', /user-scalable\s*=\s*no|maximum-scale/.test(html), false)
ok('la pagina ha un <main>', /<main[\s>]/.test(html), true)

const luce = (h) => {
  const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}
const contrasto = (a, b) => {
  const [x, y] = [luce(a), luce(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}

const blocco = css.match(/:root\[data-tema='chiaro'\] \{([^}]*)\}/)?.[1] ?? ''
const menu = blocco.match(/--menu:\s*(#[0-9a-f]{6})/i)?.[1]
const scheda = css.match(/:root\[data-tema='chiaro'\] \.tab\[data-on='true'\] \{\s*color:\s*(#[0-9a-f]{6})/i)?.[1]
ok('la scheda accesa del tema chiaro ha un colore suo', Boolean(scheda), true)
ok('e si legge sul fondo della barra (4,5:1)', scheda && menu ? contrasto(scheda, menu) >= 4.5 : false, true)

// La versione in fondo alla barra: --faint è per i decori (sotto 4,5:1 sullo scuro), il testo usa --dim.
ok('la versione in fondo alla barra non è --faint', /\.sidebar-versione\s*\{[^}]*var\(--faint\)/.test(css), false)
const variabile = (selettore, nome) => css.match(new RegExp(`${selettore.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`))?.[1].match(new RegExp(`${nome}:\\s*(#[0-9a-f]{6})`, 'i'))?.[1]
for (const [tema, radice, dim, menu] of [
  ['scuro', ':root', ':root', ':root'],
  ['chiaro', ":root[data-tema='chiaro']", ":root[data-tema='chiaro']", ":root[data-tema='chiaro']"],
  // Nel tema tatami la barra ha i suoi colori (--dim chiaro su --menu scuro).
  ['tatami', ":root[data-tema='tatami']", ":root[data-tema='tatami'] .sidebar,\n:root[data-tema='tatami'] .tabbar", ":root[data-tema='tatami']"],
  ['sito', ":root[data-tema='sito']", ":root[data-tema='sito']", ":root[data-tema='sito']"],
]) {
  const d = variabile(dim, '--dim')
  const m = variabile(menu, '--menu')
  ok(`la versione si legge sulla barra · ${tema} (4,5:1)`, d && m ? contrasto(d, m) >= 4.5 : false, true)
}

process.exit(fallite ? 1 : 0)
