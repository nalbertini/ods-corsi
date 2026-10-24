// ---------------------------------------------------------------------------
// I font del timer stanno in casa, senza browser.
//
//   node scripts/prova-timer-font.mjs
//
// Il CSS di Google Fonts blocca il disegno della pagina e gli manda l'indirizzo
// di chi la apre. I font si servono da `timer/public/fonts`, con la loro licenza.
// ---------------------------------------------------------------------------
import { existsSync, readFileSync } from 'node:fs'

let fallite = 0
const ok = (cosa, avuto, voluto) => {
  const bene = JSON.stringify(avuto) === JSON.stringify(voluto)
  if (!bene) fallite++
  console.log(`${bene ? 'ok  ' : 'KO  '}${cosa}${bene ? '' : ` — avuto ${JSON.stringify(avuto)}, voluto ${JSON.stringify(voluto)}`}`)
}

const file = ['timer/index.html', 'timer/src/styles.css', 'timer/public/guida.html', 'timer/vite.config.ts']
for (const f of file) ok(`${f}: nessun riferimento a Google Fonts`, /googleapis|gstatic/.test(readFileSync(f, 'utf8')), false)

const html = readFileSync('timer/index.html', 'utf8')
const css = readFileSync('timer/src/styles.css', 'utf8')
const pesi = { 'saira-condensed': [500, 600, 700], barlow: [400, 500, 600, 700] }
for (const [nome, lista] of Object.entries(pesi)) {
  for (const peso of lista) {
    for (const parte of ['latin', 'latin-ext']) {
      const f = `${nome}-${peso}-${parte}.woff2`
      ok(`${f} c'è e il CSS lo dichiara`, [existsSync(`timer/public/fonts/${f}`), css.includes(`/fonts/${f}`)], [true, true])
    }
  }
}
ok('font-display: swap su ogni @font-face', (css.match(/@font-face/g) ?? []).length === (css.match(/font-display:\s*swap/g) ?? []).length, true)
ok('le licenze OFL ci sono', ['OFL-Barlow.txt', 'OFL-SairaCondensed.txt'].map((f) => existsSync(`timer/public/fonts/${f}`)), [true, true])
// Niente preload: la pagina è vuota finché non parte il JS, e i font rubano banda al bundle (FCP +0,4 s su Lighthouse mobile).
ok('nessun preload dei font', /rel="preload"[^>]*as="font"/.test(html), false)

if (fallite) process.exit(1)
