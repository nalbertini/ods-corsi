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
  stdin: { contents: "export * from './src/lib/presenzeCsv'", resolveDir: '.', loader: 'ts' },
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
if (guai) {
  console.log(`\n${guai} da correggere`)
  process.exit(1)
}
console.log('\ntutto a posto')
