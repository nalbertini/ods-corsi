// ---------------------------------------------------------------------------
// I CAP della provincia di Torino, per proporre il comune nel modulo.
//
//   node scripts/cap-torino.mjs comuni.json
//
// `comuni.json` è l'elenco non ufficiale di https://github.com/matteocontrini/comuni-json
// (comuni ISTAT, CAP da più fonti, aggiornato al 2020): Poste non pubblica i CAP,
// quindi l'elenco può avere buchi o errori. Per questo il comune proposto è solo
// un aiuto: si corregge a mano. Teniamo la sola provincia di Torino, che è da
// dove vengono gli iscritti. Scrive `src/lib/capTorino.json`: CAP → comuni.
// ---------------------------------------------------------------------------
import { readFileSync, writeFileSync } from 'node:fs'

const [file] = process.argv.slice(2)
if (!file) {
  console.error('Uso: node scripts/cap-torino.mjs comuni.json')
  process.exit(1)
}
const per = {}
for (const c of JSON.parse(readFileSync(file, 'utf8')).filter((c) => c.sigla === 'TO')) {
  for (const cap of c.cap) (per[cap] ??= []).push(c.nome)
}
const ordinato = Object.fromEntries(Object.keys(per).sort().map((cap) => [cap, per[cap].sort((a, b) => a.localeCompare(b, 'it'))]))
writeFileSync(new URL('../src/lib/capTorino.json', import.meta.url), JSON.stringify(ordinato) + '\n')
console.log(`${Object.keys(ordinato).length} CAP, ${new Set(Object.values(ordinato).flat()).size} comuni`)
