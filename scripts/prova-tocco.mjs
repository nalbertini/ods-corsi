// ---------------------------------------------------------------------------
// ERO PRESENTE parte una volta sola, anche col doppio tocco.
//
//   node scripts/prova-tocco.mjs
//
// Il tasto si spegne solo al giro dopo di React: un secondo tocco svelto
// arriverebbe prima, e il secondo invio tornerebbe «L'hai già segnalata».
// La guardia sta in `src/lib/tocco.ts`, qui provata senza browser.
// ---------------------------------------------------------------------------
import { build } from 'esbuild'

const { outputFiles } = await build({
  entryPoints: ['src/lib/tocco.ts'],
  bundle: true,
  format: 'esm',
  write: false,
  logLevel: 'error',
})
const { unToccoAllaVolta } = await import('data:text/javascript;base64,' + Buffer.from(outputFiles[0].text).toString('base64'))

let guai = 0
const ok = (cosa, avuto, voluto) => {
  const va = JSON.stringify(avuto) === JSON.stringify(voluto)
  console.log(va ? '  ✓' : '  ✗', cosa, va ? '' : `— atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`)
  if (!va) guai++
}

// Un invio che finisce quando lo dice la prova.
const invio = () => {
  let fine, guasto
  const p = new Promise((si, no) => ((fine = si), (guasto = no)))
  return { p, fine: () => fine(), guasto: () => guasto(new Error('rete giù')) }
}

console.log('\nil secondo tocco mentre il primo è in corso non parte')
{
  const tocca = unToccoAllaVolta()
  const primo = invio()
  let partiti = 0
  const uno = tocca(() => (partiti++, primo.p))
  const due = tocca(() => (partiti++, Promise.resolve()))
  ok('parte solo il primo', partiti, 1)
  let dueFinito = false
  await due.then(() => (dueFinito = true))
  ok('il secondo tocco torna subito, senza aspettare il primo', dueFinito, true)
  primo.fine()
  await uno
}

console.log('\ndopo la fine si può ritoccare')
{
  const tocca = unToccoAllaVolta()
  const primo = invio()
  let partiti = 0
  const uno = tocca(() => (partiti++, primo.p))
  primo.fine()
  await uno
  await tocca(() => (partiti++, Promise.resolve()))
  ok('il tocco dopo la fine parte', partiti, 2)
}

console.log('\ndopo un errore si può ritoccare')
{
  const tocca = unToccoAllaVolta()
  const primo = invio()
  let partiti = 0
  const uno = tocca(() => (partiti++, primo.p))
  primo.guasto()
  let errore = null
  await uno.catch((e) => (errore = e.message))
  ok('l\'errore arriva a chi ha toccato', errore, 'rete giù')
  await tocca(() => (partiti++, Promise.resolve()))
  ok('il tocco dopo l\'errore parte', partiti, 2)
}

console.log(guai ? `\n✗ ${guai} casi falliti` : '\nTUTTO A POSTO')
process.exit(guai ? 1 : 0)
