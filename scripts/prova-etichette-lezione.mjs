// ---------------------------------------------------------------------------
// I tag di una lezione nella settimana, senza browser.
//
//   node scripts/prova-etichette-lezione.mjs
//
// src/lib/etichetteLezione.ts esporta etichetteLezione(lezione, passata);
// la Tessera di Settimana.tsx le mostra, la legenda le spiega con le stesse parole (scritte a mano).
// ---------------------------------------------------------------------------
import { existsSync } from 'node:fs'
import { build } from 'esbuild'

let guai = 0
const ok = (cosa, avuto, voluto) => {
  const va = JSON.stringify(avuto) === JSON.stringify(voluto)
  console.log(va ? '  ✓' : '  ✗', cosa, va ? '' : `— atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`)
  if (!va) guai++
}
const impacchetta = async (contents) => {
  const { outputFiles } = await build({
    stdin: { contents, resolveDir: '.', loader: 'ts' },
    bundle: true, format: 'esm', write: false, logLevel: 'error', define: { 'import.meta.env': '{}' },
  })
  return import('data:text/javascript;base64,' + Buffer.from(outputFiles[0].text).toString('base64'))
}

const m = existsSync('src/lib/etichetteLezione.ts') ? await impacchetta("export * from './src/lib/etichetteLezione'") : {}
const el = m.etichetteLezione ?? (() => 'src/lib/etichetteLezione.ts non esiste')
const L = (x = {}) => ({ stato: 'prevista', segnati: 0, istruttori: 'Fabio', ...x })
const testi = (x, passata) => { const r = el(L(x), passata); return Array.isArray(r) ? r.map((e) => e.testo) : r }

console.log('\nCosa dice la lezione')
ok('annullata: solo «Annullata», senza «Senza appello» né «Manca l’istruttore»', el(L({ stato: 'annullata', istruttori: '' }), true), [{ testo: 'Annullata' }])
ok('passata senza segni: «Senza appello», tipo manca', el(L(), true), [{ tipo: 'manca', testo: 'Senza appello' }])
ok('passata con segni: «Appello fatto»', el(L({ segnati: 5 }), true), [{ tipo: 'fatto', testo: 'Appello fatto' }])
ok('non passata: l\'appello non si dice', testi(L(), false), [])
ok('non passata, anche con segni: niente', testi({ segnati: 3 }, false), [])
ok('senza istruttore: «Manca l’istruttore», tipo aspetta', el(L({ istruttori: '' }), false), [{ tipo: 'aspetta', testo: 'Manca l’istruttore' }])
ok('istruttore undefined: come vuoto', testi({ istruttori: undefined }, false), ['Manca l’istruttore'])
ok('sostituto: «Sostituto», tipo sostituto', el(L({ sostitutoId: 'i-1' }), false), [{ tipo: 'sostituto', testo: 'Sostituto' }])
ok('attività scelta a mano: testo e titolo', el(L({ attivitaCambiata: true }), false), [{ tipo: 'sostituto', testo: '✎ Cambiata a mano', titolo: "L'attività di questa lezione è stata scelta a mano: non segue più il giorno" }])
ok('straordinaria: «Straordinaria», senza tipo', el(L({ straordinaria: true }), false), [{ testo: 'Straordinaria' }])
ok('sostituto + straordinaria, in quest\'ordine', testi({ sostitutoId: 'i-1', straordinaria: true }, false), ['Sostituto', 'Straordinaria'])
ok('annullata e straordinaria: anche «Straordinaria»', testi({ stato: 'annullata', straordinaria: true }, true), ['Annullata', 'Straordinaria'])
ok('l\'ordine di tutte', testi({ segnati: 0, istruttori: '', sostitutoId: 'i-1', attivitaCambiata: true, straordinaria: true }, true),
  ['Senza appello', 'Manca l’istruttore', 'Sostituto', '✎ Cambiata a mano', 'Straordinaria'])

console.log(guai ? `\n${guai} da sistemare` : '\ntutto a posto')
process.exit(guai ? 1 : 0)
