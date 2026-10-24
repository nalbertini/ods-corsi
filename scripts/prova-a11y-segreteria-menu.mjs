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

// Le schede di IMPOSTAZIONI hanno ciascuna la sua icona, decorativa: il nome della scheda resta il testo.
const ids = [...readFileSync('src/lib/schedeImpostazioni.ts', 'utf8').matchAll(/\{ id: '(\w+)', nome:/g)].map((m) => m[1])
const icone = readFileSync('src/components/Icons.tsx', 'utf8')
const blocco = icone.slice(icone.indexOf('ICONE_IMPOSTAZIONI = {'))
ok('ogni scheda di IMPOSTAZIONI ha la sua icona', ids.filter((id) => !new RegExp(`\\b${id}: (voce\\(|ICONE_)`).test(blocco)), [])
const regole = readFileSync('src/components/segreteria/Regole.tsx', 'utf8')
ok('la barra di IMPOSTAZIONI mostra l\'icona', /ICONE_IMPOSTAZIONI\[s\.id\]/.test(regole), true)

process.exit(fallite ? 1 : 0)
