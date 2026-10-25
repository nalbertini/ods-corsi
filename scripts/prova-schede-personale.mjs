// ---------------------------------------------------------------------------
// La scheda di una persona del personale divisa in schede (DATI, PRESENZE,
// ACCESSO, PERSONA), senza browser: quali ci sono, quale si apre, il segno
// IN MODIFICA e le voci del menù «Altro».
//
//   node scripts/prova-schede-personale.mjs
//
// Le funzioni stanno in `src/lib/schedePersonale.ts`.
// ---------------------------------------------------------------------------
import { build } from 'esbuild'

const impacchetta = async (contents) => {
  const { outputFiles } = await build({
    stdin: { contents, resolveDir: '.', loader: 'ts' },
    bundle: true, format: 'esm', write: false, logLevel: 'silent', define: { 'import.meta.env': '{}' },
  })
  return import('data:text/javascript;base64,' + Buffer.from(outputFiles[0].text).toString('base64'))
}

let guai = 0
const ok = (cosa, avuto, voluto) => {
  const va = JSON.stringify(avuto) === JSON.stringify(voluto)
  console.log(va ? '  ✓' : '  ✗', cosa, va ? '' : `— atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`)
  if (!va) guai++
}

// Il modulo che ancora non c'è non ferma la prova: la rende rossa dicendolo.
let m = {}
try {
  m = await impacchetta("export * from './src/lib/schedePersonale'")
} catch (e) {
  guai++
  console.log('  ✗ manca src/lib/schedePersonale.ts —', (e.errors?.[0]?.text ?? e.message).split('\n')[0])
}
const f = (nome, ...args) => (typeof m[nome] === 'function' ? m[nome](...args) : `manca ${nome}()`)

const p = (ruolo, ancheIstruttore = false, attiva = true) => ({ ruolo, ancheIstruttore, attiva })
const istruttore = p('istruttore')
const segreteria = p('staff')
const segreteriaCheInsegna = p('staff', true)
const amministrazione = p('amministrazione')

console.log('1. Quali schede, in che ordine')
ok('istruttore: DATI, PRESENZE, ACCESSO, PERSONA', f('schedePersonale', istruttore), ['dati', 'presenze', 'accesso', 'persona'])
ok('segreteria che insegna: tutte e quattro', f('schedePersonale', segreteriaCheInsegna), ['dati', 'presenze', 'accesso', 'persona'])
// La segreteria è della sala (`puo(p, 'pin')`) anche senza corsi: le presenze le ha, i compensi no.
ok('segreteria che non insegna: PRESENZE, ACCESSO, PERSONA', f('schedePersonale', segreteria), ['presenze', 'accesso', 'persona'])
ok('amministrazione sola: ACCESSO, PERSONA', f('schedePersonale', amministrazione), ['accesso', 'persona'])
ok('amministrazione che insegna: DATI, PRESENZE, ACCESSO, PERSONA', f('schedePersonale', p('amministrazione', true)), ['dati', 'presenze', 'accesso', 'persona'])

console.log('2. Quale si apre')
ok('la prima disponibile: DATI per chi insegna', f('schedaInizialePersonale', istruttore), 'dati')
ok('la prima disponibile: PRESENZE per la segreteria', f('schedaInizialePersonale', segreteria), 'presenze')
ok('la prima disponibile: ACCESSO per l\'amministrazione sola', f('schedaInizialePersonale', amministrazione), 'accesso')
ok('una scheda che non c\'è per questa persona ripiega sulla prima', f('schedaAperta', amministrazione, 'dati'), 'accesso')
ok('una scheda che c\'è resta', f('schedaAperta', istruttore, 'persona'), 'persona')

console.log('3. Il segno IN MODIFICA')
ok('su PERSONA se c\'è una modifica e si guarda altro', f('segnoPersonale', 'dati', true), { parola: 'IN MODIFICA', tono: 'giallo' })
ok('niente se si guarda PERSONA', f('segnoPersonale', 'persona', true), null)
ok('niente se non c\'è modifica', f('segnoPersonale', 'dati', false), null)

console.log('4. La tastiera sulle schede')
const ordine = f('schedePersonale', amministrazione)
ok('freccia destra: avanti', f('tastoSchedaPersonale', ordine, 'accesso', 'ArrowRight'), 'persona')
ok('freccia destra dall\'ultima: gira alla prima', f('tastoSchedaPersonale', ordine, 'persona', 'ArrowRight'), 'accesso')
ok('freccia sinistra dalla prima: gira all\'ultima', f('tastoSchedaPersonale', ordine, 'accesso', 'ArrowLeft'), 'persona')
ok('Home e End', [f('tastoSchedaPersonale', ordine, 'persona', 'Home'), f('tastoSchedaPersonale', ordine, 'accesso', 'End')], ['accesso', 'persona'])
ok('un altro tasto non muove', f('tastoSchedaPersonale', ordine, 'accesso', 'a'), null)

console.log('5. Il menù «Altro»')
const voci = (x) => f('vociAltro', x)?.map?.((v) => `${v.id}:${v.etichetta}`) ?? f('vociAltro', x)
ok('istruttore con accesso: togli e elimina', voci(istruttore), ['accesso:Togli l’accesso', 'elimina:Elimina'])
ok('istruttore senza accesso: ridai e elimina', voci(p('istruttore', false, false)), ['accesso:Ridai l’accesso', 'elimina:Elimina'])
ok('segreteria: anche elimina', voci(segreteria), ['accesso:Togli l’accesso', 'elimina:Elimina'])
ok('amministrazione sola: niente elimina, solo l\'accesso', voci(amministrazione), ['accesso:Togli l’accesso'])
ok('solo l\'accesso toglie con la conferma pericolosa; elimina pure', f('vociAltro', istruttore)?.map?.((v) => v.pericolo), [true, true])
ok('ridare l\'accesso non è pericoloso', f('vociAltro', p('istruttore', false, false))?.[0]?.pericolo, false)

console.log(guai ? `\n${guai} prove non passano.` : '\nTutto passa.')
process.exit(guai ? 1 : 0)
