// ---------------------------------------------------------------------------
// I bersagli da toccare nelle tabelle della segreteria, senza browser.
//
//   node scripts/prova-a11y-segreteria-bersagli.mjs
//
// Il nome dell'iscritto nelle righe (Iscritti, Richieste, Contabilità,
// Personale, Vestiario) era un tasto alto 19px: sotto il minimo di 24px
// (WCAG 2.5.8).
// ---------------------------------------------------------------------------
import { readFileSync } from 'node:fs'

let fallite = 0
const ok = (cosa, avuto, voluto) => {
  const bene = JSON.stringify(avuto) === JSON.stringify(voluto)
  if (!bene) fallite++
  console.log(`${bene ? 'ok  ' : 'KO  '}${cosa}${bene ? '' : ` — avuto ${JSON.stringify(avuto)}, voluto ${JSON.stringify(voluto)}`}`)
}

const css = readFileSync('src/segreteria.css', 'utf8')
const stili = readFileSync('src/styles.css', 'utf8')
const regola = css.match(/^\.sg-riga-apri \{([^}]*)\}/m)?.[1] ?? ''
const alto = Number(regola.match(/min-height:\s*(\d+)px/)?.[1] ?? 0)
ok('il nome nella riga è alto almeno 24px', alto >= 24, true)

// Il corso nelle tabelle di STATISTICHE (filtro) era 22px: padding 2px e riga di testo.
const regolaStat = css.match(/^\.sg-stat-corso \{([^}]*)\}/m)?.[1] ?? ''
const altoStat = Number(regolaStat.match(/min-height:\s*(\d+)px/)?.[1] ?? 0)
ok('il corso nelle statistiche è alto almeno 24px', altoStat >= 24, true)

// «Segreteria in ordine»: link, intestazioni che ordinano e schede sono bersagli
// da 44px veri (il canvas segreteria-ordine li vuole tutti alti 44), non da 24
// con un'area allargata col dito soltanto.
for (const sel of ['.sg-link', '.sg-ordina', '.scheda']) {
  const r = stili.match(new RegExp(`^${sel.replace('.', '\\.')} \\{([^}]*)\\}`, 'm'))?.[1] ?? ''
  const a = Number(r.match(/min-height:\s*(\d+)px/)?.[1] ?? 0)
  ok(`${sel} è alto almeno 44px`, a >= 44, true)
}

process.exit(fallite ? 1 : 0)
