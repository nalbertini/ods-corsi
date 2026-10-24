// ---------------------------------------------------------------------------
// I pagamenti Satispay e le ricevute, senza browser.
//
//   node scripts/prova-embed-satispay.mjs
//
// `pagamenti_satispay` punta a `ricevute` con due colonne (`ricevuta_id` e, da
// `103-saldo-satispay.sql`, `saldo_di`): scrivere `ricevute ( … )` nella select
// è ambiguo e PostgREST risponde «more than one relationship», cioè la
// contabilità non vede i pagamenti Satispay. Va scelta la colonna.
// ---------------------------------------------------------------------------
import { readFileSync } from 'node:fs'

let guai = 0
const ok = (cosa, avuto, voluto) => {
  const va = JSON.stringify(avuto) === JSON.stringify(voluto)
  console.log(va ? '  ✓' : '  ✗', cosa, va ? '' : `— atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`)
  if (!va) guai++
}

const src = readFileSync('src/lib/segreteriaSupabase.ts', 'utf8')
const riga = src.split('\n').find((r) => r.includes("const colonne = 'id, richiesta_id"))
ok('la select dei pagamenti Satispay c’è', Boolean(riga), true)
ok('le ricevute si prendono dalla colonna ricevuta_id, non per nome della tabella', /ricevute!ricevuta_id\s*\(/.test(riga ?? ''), true)

console.log(guai ? `\n${guai} COSE NON TORNANO` : '\nTUTTO A POSTO')
process.exit(guai ? 1 : 0)
