// ---------------------------------------------------------------------------
// I numeri accanto alle voci del menu della segreteria, per chi usa lo screen reader.
//
//   node scripts/prova-a11y-segreteria-menu.mjs
//
// `aria-label` su un <span> senza ruolo non viene letto: «Richieste online 3»
// senza il «nuove». Il nome va nel testo, nascosto alla vista (.vh) e con il
// numero visibile fuori dall'albero di accessibilità.
// ---------------------------------------------------------------------------
import { readFileSync } from 'node:fs'

let fallite = 0
const ok = (cosa, avuto, voluto) => {
  const bene = JSON.stringify(avuto) === JSON.stringify(voluto)
  if (!bene) fallite++
  console.log(`${bene ? 'ok  ' : 'KO  '}${cosa}${bene ? '' : ` — avuto ${JSON.stringify(avuto)}, voluto ${JSON.stringify(voluto)}`}`)
}

for (const file of ['src/components/segreteria/Segreteria.tsx', 'src/components/segreteria/banco/BarraBanco.tsx']) {
  const src = readFileSync(file, 'utf8')
  const da = src.indexOf('<span className="num sg-tag"')
  const segno = src.slice(da, da + 300)
  ok(`${file}: il numero non ha un aria-label su uno span`, /aria-label=/.test(segno), false)
  ok(`${file}: la parola («nuove», «da vedere»…) è testo letto`, /className="vh"/.test(segno), true)
}

process.exit(fallite ? 1 : 0)
