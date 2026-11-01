// ---------------------------------------------------------------------------
// Il CSV del registro presenze, senza browser.
//
//   node scripts/prova-presenze-csv.mjs
//
// Il nome di chi si iscrive dal modulo pubblico finisce nel foglio che la
// segreteria apre con Excel: se comincia per «=» diventa una formula.
// ---------------------------------------------------------------------------
import { build } from 'esbuild'

const { outputFiles } = await build({
  stdin: { contents: "export * from './src/lib/presenzeCsv'; export { mesi } from './src/lib/ore'", resolveDir: '.', loader: 'ts' },
  bundle: true,
  format: 'esm',
  platform: 'node',
  write: false,
  logLevel: 'error',
  define: { 'import.meta.env': '{}' },
})
const m = await import('data:text/javascript;base64,' + Buffer.from(outputFiles[0].text).toString('base64'))

let guai = 0
const ok = (cosa, avuto, voluto) => {
  const va = JSON.stringify(avuto) === JSON.stringify(voluto)
  console.log(va ? '  ✓' : '  ✗', cosa, va ? '' : `— atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`)
  if (!va) guai++
}
const prova = (f) => {
  try {
    return f()
  } catch (e) {
    return `ERRORE: ${e.message}`
  }
}

const riga = (appello, stato = 'svolta') => ({
  sessioneId: 's1', corsoId: 'c1', corso: 'Judo', sala: 'Sala 1', istruttori: 'Anna Verdi',
  inizio: '2026-10-05T17:00:00', stato, appello,
})
const p = (cognome, nome, stato = 'presente') => ({ personaId: 'p', cognome, nome, stato })

const righe = (r) => String(prova(() => m.csvRegistro(r))).split('\r\n')

console.log('Il registro presenze in CSV')
ok('l\'intestazione e una riga, col punto e virgola', righe([riga([p('Rossi', 'Luca')])]).map((x) => x.split(';').length), [8, 8])
ok('un nome che comincia per «=» non è una formula', righe([riga([p('Rossi', '=HYPERLINK("http://x";"clic")')])])[1].includes(';"\'=HYPERLINK'), true)
ok('nemmeno per + - @', righe([riga([p('+1', '@x'), p('-cmd', 'a')])]).slice(1).map((x) => x.split(';').slice(5, 7)), [["'+1", "'@x"], ["'-cmd", 'a']])
ok('una lezione annullata lo dice', righe([riga([p('Rossi', 'Luca', null)], 'annullata')])[1].endsWith(';lezione annullata'), true)
console.log('\nScarica CSV spento: la riga sotto dice perché')
{
  // Il tasto resta, spento; la frase dice che il periodo scelto è vuoto, così non si cerca il guasto.
  const perche = (...a) => (typeof m.nienteDaScaricare === 'function' ? m.nienteDaScaricare(...a) : 'manca nienteDaScaricare')
  // Il «quando» lo porta il periodo, già scritto: la frase non lo ricava dall'etichetta del menu.
  ok('un mese, tutti i corsi', perche('presenze', 'a novembre 2026', false, { arrivato: true, righe: 0 }), 'Nessuna presenza a novembre 2026: niente da scaricare.')
  ok('un mese, un corso scelto', perche('presenze', 'a ottobre 2026', true, { arrivato: true, righe: 0 }), 'Nessuna presenza a ottobre 2026 per questo corso: niente da scaricare.')
  ok('gli ultimi 30 giorni', perche('presenze', 'negli ultimi 30 giorni', false, { arrivato: true, righe: 0 }), 'Nessuna presenza negli ultimi 30 giorni: niente da scaricare.')
  ok('STATISTICHE, gli ultimi 3 mesi', perche('lezioni', 'negli ultimi 3 mesi', false, { arrivato: true, righe: 0 }), 'Nessuna lezione negli ultimi 3 mesi: niente da scaricare.')
  ok('STATISTICHE, da settembre, un corso', perche('lezioni', 'da settembre', true, { arrivato: true, righe: 0 }), 'Nessuna lezione da settembre per questo corso: niente da scaricare.')
  ok('un «quando» qualsiasi passa com\'è, senza indovinare la grammatica', perche('presenze', 'nel periodo scelto', false, { arrivato: true, righe: 0 }), 'Nessuna presenza nel periodo scelto: niente da scaricare.')
  // Mentre carica, o se la lettura non è riuscita, il periodo non è vuoto: non si sa. Niente frase, il Guaio sopra dice cosa fare.
  ok('mentre carica: niente frase', perche('presenze', 'a novembre 2026', false, { arrivato: false, righe: 0 }), '')
  ok('lettura non riuscita: niente frase', perche('lezioni', 'negli ultimi 3 mesi', false, { arrivato: false, righe: 0 }), '')
  ok('con qualcosa da scaricare: niente frase', perche('presenze', 'a novembre 2026', false, { arrivato: true, righe: 3 }), '')
  ok('arrivato e vuoto: la frase', perche('presenze', 'a novembre 2026', false, { arrivato: true, righe: 0 }), 'Nessuna presenza a novembre 2026: niente da scaricare.')
  // I mesi del menu di PRESENZE portano il loro «quando»: «ad» davanti ad aprile e agosto.
  const quando = prova(() => m.mesi().map((x) => [x.nome, x.quando]))
  ok('ogni mese ha il suo quando, in minuscolo', Array.isArray(quando) && quando.every(([n, q]) => q === `${/^A/.test(n) ? 'ad' : 'a'} ${n.toLowerCase()}`), true)
  ok('«ad aprile», «ad agosto»: c\'è uno dei due nei dodici mesi', Array.isArray(quando) && quando.some(([, q]) => /^ad (aprile|agosto) /.test(q)), true)
}

if (guai) {
  console.log(`\n${guai} da correggere`)
  process.exit(1)
}
console.log('\ntutto a posto')
