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

// Il menu usa sg-conta (cifre gialle), il Banco resta con sg-tag.
for (const [file, classe] of [['src/components/segreteria/Segreteria.tsx', 'num sg-conta'], ['src/components/segreteria/banco/BarraBanco.tsx', 'num sg-tag']]) {
  const src = readFileSync(file, 'utf8')
  const da = src.indexOf(`<span className="${classe}"`)
  ok(`${file}: c'è un numero ${classe}`, da >= 0, true)
  if (da < 0) continue
  // Fino alla fine della parola letta: oltre, un aria-hidden del codice che segue farebbe passare la prova.
  const vh = src.indexOf('className="vh"', da)
  const segno = src.slice(da, vh < 0 ? da + 300 : src.indexOf('</span>', vh))
  ok(`${file}: il numero non ha un aria-label su uno span`, /aria-label=/.test(segno), false)
  ok(`${file}: la parola («nuove», «da vedere»…) è testo letto`, /className="vh"/.test(segno), true)
  ok(`${file}: il numero è fuori dall'albero di accessibilità`, /aria-hidden/.test(segno), true)
}

// Le linguette delle tre barre piccole hanno la loro icona, decorativa (`voce` mette aria-hidden).
const icone = readFileSync('src/components/Icons.tsx', 'utf8')
const schede = {
  'src/components/segreteria/Contabilita.tsx': ['movimenti', 'bilancio', 'voci', 'casse'],
  'src/components/segreteria/Corsi.tsx': ['dati', 'iscritti'],
  'src/components/segreteria/Segreteria.tsx': ['mese', 'segnalate'],
}
for (const [file, chiavi] of Object.entries(schede)) {
  const src = readFileSync(file, 'utf8')
  for (const k of chiavi) {
    ok(`ICONE_SCHEDE ha «${k}»`, new RegExp(`\\n  ${k}: `).test(icone.slice(icone.indexOf('export const ICONE_SCHEDE'))), true)
    ok(`${file}: la linguetta «${k}» mostra la sua icona`, src.includes(`ICONE_SCHEDE.${k}`) || (file.endsWith('Contabilita.tsx') && src.includes('ICONE_SCHEDE[')), true)
  }
}

// Le schede di IMPOSTAZIONI hanno ciascuna la sua icona, decorativa: il nome della scheda resta il testo.
const ids = [...readFileSync('src/lib/schedeImpostazioni.ts', 'utf8').matchAll(/\{ id: '(\w+)', nome:/g)].map((m) => m[1])
const blocco = icone.slice(icone.indexOf('ICONE_IMPOSTAZIONI = {'))
ok('ogni scheda di IMPOSTAZIONI ha la sua icona', ids.filter((id) => !new RegExp(`\\b${id}: (voce\\(|ICONE_)`).test(blocco)), [])
const regole = readFileSync('src/components/segreteria/Regole.tsx', 'utf8')
ok('la barra di IMPOSTAZIONI mostra l\'icona', /ICONE_IMPOSTAZIONI\[s\.id\]/.test(regole), true)

process.exit(fallite ? 1 : 0)
