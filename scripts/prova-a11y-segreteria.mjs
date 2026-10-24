// ---------------------------------------------------------------------------
// L'accessibilità della segreteria da tastiera, senza browser.
//
//   node scripts/prova-a11y-segreteria.mjs
//
// Trovata provando la segreteria con la sola tastiera: la finestra «Cerca»
// (Ctrl+K) lasciava uscire il Tab verso la pagina sotto, che per chi usa uno
// screen reader è come se non esistesse (aria-modal).
// ---------------------------------------------------------------------------
import { readFileSync } from 'node:fs'

let fallite = 0
const ok = (cosa, avuto, voluto) => {
  const bene = JSON.stringify(avuto) === JSON.stringify(voluto)
  if (!bene) fallite++
  console.log(`${bene ? 'ok  ' : 'KO  '}${cosa}${bene ? '' : ` — avuto ${JSON.stringify(avuto)}, voluto ${JSON.stringify(voluto)}`}`)
}

const segreteria = readFileSync('src/components/segreteria/Segreteria.tsx', 'utf8')
const comune = readFileSync('src/components/segreteria/comune.tsx', 'utf8')

// Un dialogo modale tiene il Tab dentro con `useDialogo`: lo stesso di ogni altra finestra.
const corpo = segreteria.slice(segreteria.indexOf('aria-label="Cerca"') - 400, segreteria.indexOf('aria-label="Cerca"') + 100)
const finestra = segreteria.match(/function FinestraCerca[\s\S]*?\n}\n/)?.[0] ?? ''
ok('la finestra «Cerca» usa useDialogo', /useDialogo</.test(finestra), true)
ok('la finestra «Cerca» è un dialogo modale con nome', /role="dialog"[^>]*aria-modal="true"[^>]*aria-label="Cerca"/.test(corpo + finestra), true)

// useDialogo non toglie il fuoco al campo che la finestra ha già preso da sé.
ok('useDialogo non ruba il fuoco a chi è già dentro', /contains\(document\.activeElement\)/.test(comune.slice(0, comune.indexOf('const tasto'))), true)

// Alla chiusura il fuoco torna dov'era: si ricorda prima di aprire, quando il campo non ha ancora il fuoco.
ok('il fuoco di partenza si ricorda prima di aprire «Cerca»', /querySelector\('\.sg-ricerca-corpo'\)\)\s*primaDellaFinestra\.current = /.test(segreteria), true)

process.exit(fallite ? 1 : 0)
