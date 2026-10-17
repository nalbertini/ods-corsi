// ---------------------------------------------------------------------------
// Un pezzo dell'app che non c'è più, provato senza browser.
//
//   node scripts/prova-aggiornamento.mjs
//
// Dopo una pubblicazione i file con l'impronta nel nome (`supabase-xxx.js`)
// cambiano: una pagina rimasta aperta chiede quelli vecchi e non li trova.
// Si ricarica una volta; se il guaio resta, non si ricarica all'infinito.
// ---------------------------------------------------------------------------
import { build } from 'esbuild'

const { outputFiles } = await build({
  stdin: { contents: "export * from './src/lib/aggiornamento'", resolveDir: '.', loader: 'ts' },
  bundle: true,
  format: 'esm',
  write: false,
  logLevel: 'error',
})
const m = await import('data:text/javascript;base64,' + Buffer.from(outputFiles[0].text).toString('base64'))

let guai = 0
const ok = (cosa, avuto, voluto) => {
  const va = JSON.stringify(avuto) === JSON.stringify(voluto)
  console.log(va ? '  ✓' : '  ✗', cosa, va ? '' : `— atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`)
  if (!va) guai++
}

const ORA = 1_000_000
ok('mai ricaricata: si ricarica', m.ricaricarePerPezzoMancante(null, ORA), true)
ok('ricaricata 5 secondi fa: non si ripete', m.ricaricarePerPezzoMancante(String(ORA - 5_000), ORA), false)
ok('ricaricata un minuto fa: si può ancora', m.ricaricarePerPezzoMancante(String(ORA - 60_000), ORA), true)
ok('valore illeggibile: si ricarica', m.ricaricarePerPezzoMancante('boh', ORA), true)

if (guai) process.exit(1)
