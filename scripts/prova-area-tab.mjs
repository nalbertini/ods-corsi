// ---------------------------------------------------------------------------
// I tab della pagina dell'iscritto, senza browser (`src/lib/areaTab.ts`).
//
//   node scripts/prova-area-tab.mjs
//
// Quattro tab (LEZIONI, DOCUMENTI, FAMIGLIA, CONTATTI), FAMIGLIA solo per il titolare; si apre
// su LEZIONI; la tastiera col giro; il segno su DOCUMENTI dice DA SISTEMARE
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
ok('chi non è titolare: LEZIONI, DOCUMENTI e CONTATTI', f('tabArea', false), ['lezioni', 'regola', 'contatti'])
ok('il titolare: anche FAMIGLIA, prima di CONTATTI', f('tabArea', true), ['lezioni', 'regola', 'nucleo', 'contatti'])
ok('le etichette', ['lezioni', 'regola', 'nucleo', 'contatti'].map((t) => f('etichettaTab', t)), ['LEZIONI', 'DOCUMENTI', 'FAMIGLIA', 'CONTATTI'])
ok('si apre su LEZIONI', m.TAB_INIZIALE, 'lezioni')

console.log('La tastiera')
const tre = ['lezioni', 'regola', 'nucleo']
const quattro = [...tre, 'contatti']
ok('destra: avanti', f('tastoTabArea', tre, 'lezioni', { key: 'ArrowRight' }), 'regola')
ok('destra dall’ultimo: giro', f('tastoTabArea', tre, 'nucleo', { key: 'ArrowRight' }), 'lezioni')
ok('sinistra dal primo: giro', f('tastoTabArea', tre, 'lezioni', { key: 'ArrowLeft' }), 'nucleo')
ok('Home e Fine', [f('tastoTabArea', tre, 'regola', { key: 'Home' }), f('tastoTabArea', tre, 'regola', { key: 'End' })], ['lezioni', 'nucleo'])
ok('un altro tasto: niente', f('tastoTabArea', tre, 'regola', { key: 'a' }), null)
ok('con Alt, Ctrl o Cmd il tasto è del browser', [{ altKey: true }, { ctrlKey: true }, { metaKey: true }].map((m) => f('tastoTabArea', tre, 'regola', { key: 'ArrowLeft', ...m })), [null, null, null])
ok('senza modificatori la freccia vale', f('tastoTabArea', tre, 'regola', { key: 'ArrowLeft' }), 'lezioni')
ok('destra da FAMIGLIA: CONTATTI; da CONTATTI: giro', [f('tastoTabArea', quattro, 'nucleo', { key: 'ArrowRight' }), f('tastoTabArea', quattro, 'contatti', { key: 'ArrowRight' })], ['contatti', 'lezioni'])
ok('FAMIGLIA aperta ma non più titolare: si riparte da LEZIONI', f('tabAperto', ['lezioni', 'regola', 'contatti'], 'nucleo'), 'lezioni')
ok('CONTATTI resta aperto', f('tabAperto', quattro, 'contatti'), 'contatti')
ok('un tab che c\'è resta aperto', f('tabAperto', tre, 'nucleo'), 'nucleo')

console.log('Il segno su DOCUMENTI')
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

console.log('Il tab CONTATTI')
const g = f('gruppiContatti', { guida: '/guida/iscritti/', conEsci: true })
const C = { telefono: '346 329 2786', indirizzo: 'Via Vittorio Sassi 26, Collegno' }
ok('i gruppi, in ordine', Array.isArray(g) ? g.map((x) => x.titolo) : g, ['SEGRETERIA', 'SEGUICI', 'LA TUA PAGINA'])
const voci = (i) => (Array.isArray(g) ? g[i].voci.map((v) => v.nome) : g)
ok('SEGRETERIA: chiama, WhatsApp, come arrivare', voci(0), ['CHIAMA', 'WHATSAPP', 'COME ARRIVARE'])
ok('SEGUICI: Instagram e Facebook', voci(1), ['INSTAGRAM', 'FACEBOOK'])
ok('LA TUA PAGINA: guida ed esci', voci(2), ['GUIDA', 'ESCI'])
const href = (i, n) => (Array.isArray(g) ? g[i].voci[n].href : g)
ok('CHIAMA va al telefono della palestra', href(0, 0), 'tel:+393463292786')
ok('WHATSAPP allo stesso numero', href(0, 1), 'https://wa.me/393463292786')
ok('COME ARRIVARE alla mappa', href(0, 2), 'https://www.google.com/maps/dir/?api=1&destination=Via+Vittorio+Sassi+26,+10093+Collegno+TO')
ok('il numero e la via si leggono sulla riga', Array.isArray(g) ? [g[0].voci[0].nota, g[0].voci[2].nota] : g, [C.telefono, 'Via V. Sassi 26'])
ok('GUIDA va alla guida', href(2, 0), '/guida/iscritti/')
ok('ESCI non è un link: è un’azione', Array.isArray(g) ? [g[2].voci[1].href, g[2].voci[1].esci] : g, [undefined, true])
const senza = f('gruppiContatti', { guida: '/guida/iscritti/', conEsci: false })
ok('senza accesso vero (in prova) ESCI non c’è', Array.isArray(senza) ? senza[2].voci.map((v) => v.nome) : senza, ['GUIDA'])

console.log('Le lezioni e le presenze in un elenco solo')
ok('il conto è prossime + presenze', f('contoElenco', 3, 9), '3 + 9')
ok('senza prossime', f('contoElenco', 0, 9), '0 + 9')

console.log(guai ? `\n${guai} ${guai === 1 ? 'cosa non torna' : 'cose non tornano'}` : '\nTUTTO A POSTO')
process.exit(guai ? 1 : 0)
