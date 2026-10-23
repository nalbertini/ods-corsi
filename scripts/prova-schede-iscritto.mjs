// ---------------------------------------------------------------------------
// Le schede DOCUMENTI, QUOTA E PAGAMENTI e CORSI dell'iscritto, senza browser:
// ogni cosa è un riquadro con lo stato in grande (`nome`), il dettaglio sotto
// (`sotto`) e i tasti a destra.
//
//   node scripts/prova-schede-iscritto.mjs
//
// Le funzioni stanno in `src/lib/schedeIscritto.ts`.
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
  m = await impacchetta("export * from './src/lib/schedeIscritto'")
} catch (e) {
  guai++
  console.log('  ✗ manca src/lib/schedeIscritto.ts —', (e.errors?.[0]?.text ?? e.message).split('\n')[0])
}
const f = (nome, ...args) => (typeof m[nome] === 'function' ? m[nome](...args) : `manca ${nome}()`)
const seg = await impacchetta("export { timbriScheda } from './src/lib/segreteria'")

const OGGI = '2026-10-22'

// ---- 1. Il certificato -----------------------------------------------------
console.log('1. Riquadro del certificato')
const cert = (c, nato = '2015-03-01') => f('riquadroCertificato', c, nato, OGGI)
ok('scaduto, solo la data, mai un file', cert({ scade: '2026-09-09', conFile: false }), {
  nome: 'SCADUTO IL 9 SETTEMBRE 2026', sotto: '43 giorni fa · data scritta dalla segreteria, senza file', tono: 'rosso',
})
ok('valido, con il file', cert({ scade: '2027-06-30', conFile: true, caricatoIl: '2026-09-03' }), {
  nome: 'VALIDO FINO AL 30 GIUGNO 2027', sotto: 'file caricato il 3 settembre 2026', tono: 'verde',
})
const scad = cert({ scade: '2026-11-01', conFile: true, caricatoIl: '2026-09-03' })
ok('in scadenza: nome', scad.nome, 'SCADE IL 1 NOVEMBRE 2026')
ok('in scadenza: tono', scad.tono, 'giallo')
ok('in scadenza: fra 10 giorni, col file', scad.sotto?.startsWith('fra 10 giorni · file caricato il'), true)
ok('scade oggi: «oggi»', cert({ scade: '2026-10-22', conFile: true, caricatoIl: '2026-09-03' }).sotto?.startsWith('oggi'), true)
ok('scade domani: «domani»', cert({ scade: '2026-10-23', conFile: true, caricatoIl: '2026-09-03' }).sotto?.startsWith('domani'), true)
ok('scaduto con il file cancellato', cert({ scade: '2026-09-09', conFile: false, caricatoIl: '2026-08-01' }).sotto?.endsWith('file cancellato'), true)
ok('nessun certificato, adulto', cert({ conFile: false }, '1990-05-10'), { nome: 'MANCA', sotto: 'nessun file e nessuna data', tono: 'rosso' })
const piccolo = cert({ conFile: false }, '2022-03-01')
ok('bambino di 4 anni: non serve', [piccolo.nome, piccolo.tono], ['NON SERVE', 'spento'])

// ---- 2. Il documento -------------------------------------------------------
console.log('\n2. Riquadro del documento')
ok('in segreteria, minore', f('riquadroDocumento', true, true), { nome: 'IN SEGRETERIA', sotto: 'copia del genitore, in segreteria', tono: 'verde', tasto: 'Non c’è più' })
ok('in segreteria, adulto', f('riquadroDocumento', true, false), { nome: 'IN SEGRETERIA', sotto: 'copia in segreteria', tono: 'verde', tasto: 'Non c’è più' })
const senzaDoc = { attiva: true, certificato: { conFile: false }, documento: false, pagamento: { stato: 'da_pagare' }, quote: [], natoIl: '2012-10-01' }
const parolaDoc = seg.timbriScheda(senzaDoc, OGGI).documento.parola
ok('senza documento, minore', f('riquadroDocumento', false, true), { nome: parolaDoc, sotto: 'va mostrato in segreteria, quello del genitore', tono: 'giallo', tasto: 'La copia è in segreteria' })
ok('senza documento, adulto: il sotto', f('riquadroDocumento', false, false).sotto, 'va mostrato in segreteria')

// ---- 3. La quota -----------------------------------------------------------
console.log('\n3. Riquadro della quota')
const persona = (pagamento) => ({ ...senzaDoc, pagamento })
const q0 = f('riquadroQuota', persona({ stato: 'da_pagare' }), OGGI)
ok('nessuna ricevuta: nome e tono del timbro', [q0.nome, q0.tono], ['QUOTA ASSOCIATIVA · DA PAGARE', 'rosso'])
ok('nessuna ricevuta: il sotto', q0.sotto, 'Nessuna ricevuta con la quota di questa stagione.')
const q1 = f('riquadroQuota', persona({ stato: 'pagato', fino: '2027-07-31' }), OGGI)
ok('pagata fuori app: nome e tono', [q1.nome, q1.tono], ['QUOTA ASSOCIATIVA · PAGATA', 'verde'])
ok('pagata fuori app: il sotto', q1.sotto, 'Pagata fuori dall’app, fino al 31 luglio 2027.')
ok('pagata fuori app con la nota della segreteria', f('riquadroQuota', persona({ stato: 'pagato', fino: '2027-07-31', nota: 'Bonifico del 3 settembre.' }), OGGI).sotto, 'Pagata fuori dall’app, fino al 31 luglio 2027. Bonifico del 3 settembre.')

// ---- 4-5. I corsi ----------------------------------------------------------
console.log('\n4. Il bollino del corso')
const stato = (come, altro = {}) => ({ corsoId: 'c1', corso: 'Lotta 3', come, ...altro })
for (const [come, parola, tono] of [
  ['pagato', 'PAGATO', 'verde'], ['fuori_app', 'PAGATO FUORI APP', 'verde'], ['satispay', 'PAGATO CON SATISPAY', 'verde'],
  ['in_parte', 'PAGATO IN PARTE', 'giallo'], ['da_controllare', 'DA CONTROLLARE', 'giallo'],
  ['scaduto', 'DA PAGARE', 'rosso'], ['fuori_scaduto', 'DA PAGARE', 'rosso'], ['da_pagare', 'DA PAGARE', 'rosso'],
]) ok(come, f('bollinoCorso', stato(come)), { parola, tono })

console.log('\n5. Il riquadro del corso')
ok('da pagare: il sotto non ripete il nome', f('riquadroCorso', stato('da_pagare')), { nome: 'LOTTA 3 · DA PAGARE', sotto: '', tono: 'rosso' })
ok('pagato fino al', f('riquadroCorso', stato('pagato', { al: '2026-12-31' })), { nome: 'LOTTA 3 · PAGATO', sotto: 'pagato fino al 31 dicembre 2026', tono: 'verde' })
ok('in parte: mancano', f('riquadroCorso', stato('in_parte', { mancano: 2500 })).sotto?.startsWith('pagato in parte, mancano'), true)
ok('scaduto', f('riquadroCorso', stato('scaduto', { al: '2026-09-30' })), { nome: 'LOTTA 3 · DA PAGARE', sotto: 'scaduto il 30 settembre 2026, da pagare', tono: 'rosso' })

// ---- 6-8. I pagamenti ------------------------------------------------------
const voce = (importo) => ({ descrizione: 'QUOTA ASSOCIATIVA', quantita: 1, prezzo: importo, pagamenti: [{ importo, metodo: 'contanti' }] })
const ric = (id, numero, data, importo = 5000, annullataIl) => ({
  id, anno: 2026, numero, data, voci: [voce(importo)], anticipo: 0, totale: importo, pagato: importo, creataIl: data, annullataIl,
})
const dir = (id, data, importo = 1000, annullatoIl) => ({ id, personaId: 'p1', data, importo, metodo: 'contanti', voce: 'ALTRO', creatoIl: data, annullatoIl })
const sigla = (l) => (Array.isArray(l) ? l.map((x) => (x.tipo === 'ricevuta' ? x.r.id : x.x.id)) : l)

console.log('\n6. Lo storico dei pagamenti')
ok('dalla più recente; a pari data la ricevuta col numero più alto, poi i pagamenti a mano', sigla(f('storicoPagamenti',
  [ric('r1', 1, '2026-09-10'), ric('r5', 5, '2026-10-03'), ric('r4', 4, '2026-10-03')],
  [dir('d1', '2026-10-03'), dir('d2', '2026-10-15')])), ['d2', 'r5', 'r4', 'd1', 'r1'])
ok('le annullate restano', sigla(f('storicoPagamenti', [ric('r1', 1, '2026-09-10', 5000, '2026-09-11')], [dir('d1', '2026-09-12', 1000, '2026-09-13')])), ['d1', 'r1'])

console.log('\n7. Le prime righe')
const otto = [1, 2, 3, 4, 5, 6, 7, 8]
ok('8 elementi, non tutte', f('primeRighe', otto, false), { righe: [1, 2, 3, 4, 5], altre: 3 })
ok('8 elementi, tutte', f('primeRighe', otto, true), { righe: otto, altre: 0 })
ok('4 elementi', f('primeRighe', [1, 2, 3, 4], false), { righe: [1, 2, 3, 4], altre: 0 })

console.log('\n8. Il pagato della stagione')
ok('conta la stagione di oggi, non le annullate né la stagione prima', f('pagatoNellaStagione',
  [ric('r1', 1, '2026-10-03', 5000), ric('r2', 2, '2026-10-04', 7000, '2026-10-05'), ric('r3', 3, '2026-06-15', 9000)],
  [dir('d1', '2026-10-10', 1000), dir('d2', '2026-10-11', 2000, '2026-10-12'), dir('d3', '2026-07-01', 3000)], OGGI), 6000)

// ---- 9. Le iscrizioni ------------------------------------------------------
console.log('\n9. Le iscrizioni della scheda')
const isc = (corsoId, dal, al) => ({ corsoId, dal, al })
const r9 = f('iscrizioniDellaScheda', [
  isc('a', '2026-09-01'), isc('b', '2026-01-01', '2026-10-22'), isc('c', '2025-09-01', '2026-06-30'), isc('d', '2024-09-01', '2025-06-30'), isc('e', '2027-01-01'),
], OGGI)
ok('correnti: senza fine, o che finisce oggi', r9.correnti?.map((i) => i.corsoId), ['a', 'b'])
ok('terminate: dalla più recente', r9.terminate?.map((i) => i.corsoId), ['c', 'd'])

console.log(guai ? `\n${guai} prove non passano.` : '\nTutto passa.')
process.exit(guai ? 1 : 0)
