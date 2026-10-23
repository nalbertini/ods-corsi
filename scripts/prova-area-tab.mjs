// ---------------------------------------------------------------------------
// I tab della pagina dell'iscritto, senza browser (`src/lib/areaTab.ts`).
//
//   node scripts/prova-area-tab.mjs
//
// Tre tab (LEZIONI, IN REGOLA, NUCLEO), NUCLEO solo per il titolare; si apre
// su LEZIONI; la tastiera col giro; il segno su IN REGOLA dice DA SISTEMARE
// quando certificato o quota non vanno (il peggiore vince).
// Canvas: docs/design-canvas/area-iscritti-tab.
// ---------------------------------------------------------------------------
process.env.TZ = 'Europe/Rome'

import { build } from 'esbuild'

const memoria = new Map()
globalThis.localStorage = {
  getItem: (k) => (memoria.has(k) ? memoria.get(k) : null),
  setItem: (k, v) => memoria.set(k, String(v)),
  removeItem: (k) => memoria.delete(k),
}
globalThis.window = { location: { search: '', hash: '' }, addEventListener() {} }

const { outputFiles } = await build({
  stdin: { contents: "export * from './src/lib/areaTab'", resolveDir: '.', loader: 'ts' },
  bundle: true,
  format: 'esm',
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
const f = (nome, ...args) => (typeof m[nome] === 'function' ? m[nome](...args) : `manca ${nome}()`)

console.log('Quali tab')
ok('chi non è titolare: LEZIONI e IN REGOLA', f('tabArea', false), ['lezioni', 'regola'])
ok('il titolare: anche NUCLEO', f('tabArea', true), ['lezioni', 'regola', 'nucleo'])
ok('le etichette', [f('etichettaTab', 'lezioni'), f('etichettaTab', 'regola'), f('etichettaTab', 'nucleo')], ['LEZIONI', 'IN REGOLA', 'NUCLEO'])
ok('si apre su LEZIONI', m.TAB_INIZIALE, 'lezioni')

console.log('La tastiera')
const tre = ['lezioni', 'regola', 'nucleo']
ok('destra: avanti', f('tastoTabArea', tre, 'lezioni', { key: 'ArrowRight' }), 'regola')
ok('destra dall’ultimo: giro', f('tastoTabArea', tre, 'nucleo', { key: 'ArrowRight' }), 'lezioni')
ok('sinistra dal primo: giro', f('tastoTabArea', tre, 'lezioni', { key: 'ArrowLeft' }), 'nucleo')
ok('Home e Fine', [f('tastoTabArea', tre, 'regola', { key: 'Home' }), f('tastoTabArea', tre, 'regola', { key: 'End' })], ['lezioni', 'nucleo'])
ok('un altro tasto: niente', f('tastoTabArea', tre, 'regola', { key: 'a' }), null)
ok('con Alt, Ctrl o Cmd il tasto è del browser', [{ altKey: true }, { ctrlKey: true }, { metaKey: true }].map((m) => f('tastoTabArea', tre, 'regola', { key: 'ArrowLeft', ...m })), [null, null, null])
ok('senza modificatori la freccia vale', f('tastoTabArea', tre, 'regola', { key: 'ArrowLeft' }), 'lezioni')
ok('NUCLEO aperto ma non più titolare: si riparte da LEZIONI', f('tabAperto', ['lezioni', 'regola'], 'nucleo'), 'lezioni')
ok('un tab che c\'è resta aperto', f('tabAperto', tre, 'nucleo'), 'nucleo')

console.log('Il segno su IN REGOLA')
const s = (cert, paga) => f('segnoInRegola', cert, paga)
ok('tutto a posto: niente', s('valido', 'pagato'), null)
ok('sotto i 6 anni e pagato: niente', s('non_serve', 'pagato'), null)
ok('certificato scaduto: rosso', s('scaduto', 'pagato'), { parola: 'DA SISTEMARE', tono: 'rosso' })
ok('certificato che manca: rosso', s('manca', 'pagato'), { parola: 'DA SISTEMARE', tono: 'rosso' })
ok('certificato in scadenza: giallo', s('in_scadenza', 'pagato'), { parola: 'DA SISTEMARE', tono: 'giallo' })
ok('a 6 anni in arrivo: giallo', s('in_arrivo', 'pagato'), { parola: 'DA SISTEMARE', tono: 'giallo' })
ok('quota da pagare: rosso', s('valido', 'da_pagare'), { parola: 'DA SISTEMARE', tono: 'rosso' })
ok('quota scaduta: rosso', s('valido', 'scaduto'), { parola: 'DA SISTEMARE', tono: 'rosso' })
ok('quota pagata in parte: giallo', s('valido', 'in_parte'), { parola: 'DA SISTEMARE', tono: 'giallo' })
ok('il peggiore vince', s('in_scadenza', 'da_pagare'), { parola: 'DA SISTEMARE', tono: 'rosso' })

console.log('Lo stato sotto il nome (le chip delle persone)')
const guaio = { tono: 'guaio', testo: 'Manca il certificato medico.' }
const avviso = { tono: 'avviso', testo: 'La quota è pagata in parte: mancano 30 €.' }
ok('nessun avviso: IN REGOLA', f('statoChip', []), { parola: 'IN REGOLA', tono: 'fatto' })
ok('un avviso giallo: DA SISTEMARE, giallo', f('statoChip', [avviso]), { parola: 'DA SISTEMARE', tono: 'avviso' })
ok('un guaio: DA SISTEMARE, rosso', f('statoChip', [guaio]), { parola: 'DA SISTEMARE', tono: 'guaio' })
ok('il peggiore vince', f('statoChip', [avviso, guaio]), { parola: 'DA SISTEMARE', tono: 'guaio' })

console.log('L\'avviso in una riga, sotto la testata')
ok('niente da dire: niente riga', f('rigaAvviso', [], 'lezioni'), null)
ok('su LEZIONI: la riga, col tab che lo sistema', f('rigaAvviso', [guaio], 'lezioni'), { testo: guaio.testo, tono: 'guaio', altri: 0, vai: 'regola' })
ok('su NUCLEO: la stessa riga', f('rigaAvviso', [guaio], 'nucleo')?.vai, 'regola')
ok('su IN REGOLA: niente, lo dice già il tab', f('rigaAvviso', [guaio], 'regola'), null)
ok('più avvisi: il peggiore, e quanti altri', f('rigaAvviso', [avviso, guaio], 'lezioni'), { testo: guaio.testo, tono: 'guaio', altri: 1, vai: 'regola' })

console.log(guai ? `\n${guai} ${guai === 1 ? 'cosa non torna' : 'cose non tornano'}` : '\nTUTTO A POSTO')
process.exit(guai ? 1 : 0)
