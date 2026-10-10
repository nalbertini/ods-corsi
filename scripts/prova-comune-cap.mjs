// ---------------------------------------------------------------------------
// Il comune dal CAP, senza browser.
//
//   node scripts/prova-comune-cap.mjs
//
// Nel modulo di iscrizione, scritto il CAP, il comune lo propone l'app per i
// CAP della provincia di Torino (`src/lib/comuneDalCap.ts`, dati in
// `src/lib/capTorino.json`): un comune solo si scrive da sé se il campo è vuoto,
// pochi comuni si scelgono coi tasti, molti con la tendina, fuori provincia niente.
// ---------------------------------------------------------------------------
import { build } from 'esbuild'

const { outputFiles } = await build({
  stdin: { contents: "export * from './src/lib/comuneDalCap'", resolveDir: '.', loader: 'ts' },
  bundle: true,
  format: 'esm',
  write: false,
  logLevel: 'error',
})
const m = await import('data:text/javascript;base64,' + Buffer.from(outputFiles[0].text).toString('base64'))

let rotte = 0
const ok = (cosa, avuto, voluto) => {
  const va = JSON.stringify(avuto) === JSON.stringify(voluto)
  if (!va) rotte++
  console.log(`  ${va ? '✓' : '✗'} ${cosa}${va ? '' : ` — atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`}`)
}

console.log('\n1. i dati')
ok('Collegno ha il 10093', m.ELENCO_CAP['10093'], ['Collegno'])
ok('Torino ha i suoi CAP di città', m.ELENCO_CAP['10121'], ['Torino'])
ok('solo provincia di Torino: niente 20081', m.ELENCO_CAP['20081'], undefined)

console.log('\n2. un comune solo')
ok('campo vuoto: il comune si scrive da sé, con la nota', m.comuneDalCap('10093', ''), { scrivi: 'Collegno', scelte: [], tendina: false, nota: 'Dal CAP 10093. Se non è il tuo comune, correggilo.' })
ok('il comune già giusto: niente da scrivere, la nota resta', m.comuneDalCap('10093', 'collegno'), { scelte: [], tendina: false, nota: 'Dal CAP 10093. Se non è il tuo comune, correggilo.' })
ok('un altro comune già scritto: non si tocca, niente nota', m.comuneDalCap('10093', 'Grugliasco'), { scelte: [], tendina: false })
ok('spazi attorno al CAP: vale lo stesso', m.comuneDalCap(' 10093 ', '').scrivi, 'Collegno')

ok('conIlComune: il CAP e il comune insieme', m.conIlComune({ cap: '', comune: '', nome: 'Paolo' }, '10093'), { cap: '10093', comune: 'Collegno', nome: 'Paolo' })
ok('conIlComune: un comune già scritto resta', m.conIlComune({ cap: '', comune: 'Grugliasco' }, '10093'), { cap: '10093', comune: 'Grugliasco' })
ok('conIlComune: CAP a metà, solo il CAP', m.conIlComune({ cap: '100', comune: '' }, '1009'), { cap: '1009', comune: '' })

console.log('\n3. più comuni')
ok('pochi comuni: i tasti', m.comuneDalCap('10046', ''), { scelte: ['Isolabella', 'Poirino'], tendina: false })
ok('molti comuni (più di sei): la tendina', [m.comuneDalCap('10040', '').scelte.length, m.comuneDalCap('10040', '').tendina], [21, true])
ok('sei è ancora coi tasti', m.TETTO_TASTI, 6)
ok('il comune già scelto fra quelli: niente scelta', m.comuneDalCap('10046', 'Poirino'), { scelte: [], tendina: false })
ok('un comune scritto che non è fra quelli: la scelta resta', m.comuneDalCap('10046', 'Chieri').scelte, ['Isolabella', 'Poirino'])
ok('la frase della scelta', m.fraseDellaScelta('10046', 2), 'Il CAP 10046 è di 2 comuni: tocca il tuo.')
ok('l’etichetta della tendina', m.etichettaTendina('10040', 21), 'IL CAP 10040 È DI 21 COMUNI')

console.log('\n4. niente da proporre')
ok('fuori provincia', m.comuneDalCap('20081', ''), { scelte: [], tendina: false })
ok('CAP a metà', m.comuneDalCap('1009', ''), { scelte: [], tendina: false })
ok('CAP vuoto', m.comuneDalCap('', ''), { scelte: [], tendina: false })
ok('non sono cifre', m.comuneDalCap('1009A', ''), { scelte: [], tendina: false })

console.log(rotte ? `\n${rotte} COSE NON TORNANO` : '\nTUTTO A POSTO')
process.exit(rotte ? 1 : 0)
