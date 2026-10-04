// ---------------------------------------------------------------------------
// CRONOMETRO E ALLA ROVESCIA nella lista dei timer, senza browser.
//
//   node scripts/prova-strumenti.mjs
//
// (`timer/src/lib/gruppi.ts`) Sono due schede fisse in una sezione in cima,
// sempre quella: non sono timer salvati, quindi non stanno nelle sezioni di
// `gruppiDi` (da cui il tablet ricava i timer della lezione), e i filtri per
// tipo le nascondono.
// ---------------------------------------------------------------------------
import { build } from 'esbuild'

const importa = async (contents) => {
  const { outputFiles } = await build({
    stdin: { contents, resolveDir: '.', loader: 'ts' },
    bundle: true,
    format: 'esm',
    write: false,
    logLevel: 'silent',
  })
  return import('data:text/javascript;base64,' + Buffer.from(outputFiles[0].text).toString('base64'))
}

let guai = 0
const ok = (cosa, avuto, voluto) => {
  const va = JSON.stringify(avuto) === JSON.stringify(voluto)
  console.log(va ? '  ✓' : '  ✗', cosa, va ? '' : `— atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`)
  if (!va) guai++
}

const { strumentiDa, gruppiDi, conBarra, aTuttoSchermo } = await importa(`
  import { strumentiDa, gruppiDi, conBarra, aTuttoSchermo } from './timer/src/lib/gruppi'
  export { strumentiDa, gruppiDi, conBarra, aTuttoSchermo }
`)

ok('senza filtro: cronometro e alla rovescia, in quest\'ordine', strumentiDa('all').map((s) => s.chiave), ['crono', 'countdown'])
ok('ognuna ha etichetta, titolo e riassunto', strumentiDa('all').every((s) => s.tipo && s.nome && s.riassunto), true)
ok('con un filtro per tipo non compaiono', ['interval', 'emom', 'amrap', 'circuit', 'fortime'].map((m) => strumentiDa(m).length), [0, 0, 0, 0, 0])
const sezioni = gruppiDi([], { chi: 'sala' }, null).map((g) => g.chiave)
ok('non entrano nelle sezioni dei timer', sezioni.some((c) => c === 'crono' || c === 'countdown' || c === 'strumenti'), false)
ok('barra: sul tablet con una voce sola no, con due sì', [conBarra(true, 1), conBarra(true, 2)], [false, true])
ok('barra: sul timer da solo sempre (logo, versione, ritorno)', conBarra(false, 1), true)
ok('lo strumento prende lo schermo solo nei timer', [aTuttoSchermo('timer', 'crono'), aTuttoSchermo('timer', null), aTuttoSchermo('impostazioni', 'crono')], [true, false, false])

console.log(guai ? `\n${guai} ${guai === 1 ? 'cosa non torna' : 'cose non tornano'}` : '\nTUTTO A POSTO')
process.exit(guai ? 1 : 0)
