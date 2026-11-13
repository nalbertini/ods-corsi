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
  nome: 'SCADUTO IL 9 SETTEMBRE 2026', sotto: '43 giorni fa · data scritta dalla segreteria, senza file', tono: 'rosso', tasto: 'Dai una data',
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
ok('nessun certificato, adulto', cert({ conFile: false }, '1990-05-10'), { nome: 'CERTIFICATO NON ARRIVATO', sotto: 'senza un termine per portarlo · la presenza si segna', tono: 'rosso', tasto: 'Dai una data' })
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

// ---- 4-5. I corsi ----------------------------------------------------------
console.log('\n4. Il bollino del corso')
const stato = (come, altro = {}) => ({ corsoId: 'c1', corso: 'Lotta 3', come, ...altro })
for (const [come, parola, tono] of [
  ['pagato', 'PAGATO', 'verde'], ['fuori_app', 'PAGATO FUORI APP', 'verde'], ['satispay', 'PAGATO CON SATISPAY', 'verde'],
  ['in_parte', 'PAGATO IN PARTE', 'giallo'], ['da_controllare', 'DA CONTROLLARE', 'giallo'],
  ['scaduto', 'DA PAGARE', 'rosso'], ['fuori_scaduto', 'DA PAGARE', 'rosso'], ['da_pagare', 'DA PAGARE', 'rosso'],
]) ok(come, f('bollinoCorso', stato(come)), { parola, tono })

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

// ---- 10. I timbri dei corsi ------------------------------------------------
// Chiavi in qualunque ordine: contano i valori.
const piatto = (x) => x === undefined ? null : JSON.parse(JSON.stringify(x, (_, v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b))) : v)))
const okp = (cosa, avuto, voluto) => ok(cosa, piatto(avuto), piatto(voluto))
const corso = (come, extra = {}) => ({ corsoId: 'judo3', corso: 'Judo 3', come, ...extra })
const tc = (...stati) => f('timbriCorsi', stati)

console.log('\n10. I timbri dei corsi (timbriCorsi)')
for (const come of ['pagato', 'fuori_app', 'satispay']) okp(`${come}: nessun timbro`, tc(corso(come)), [])
okp('in parte: quanto manca, entro quando, quanto è stato pagato', tc(corso('in_parte', { mancano: 35000, totale: 48000, entro: '2026-12-31' })), [
  { titolo: 'JUDO 3 · MANCANO', parola: '350,00 €', tono: 'giallo', righe: [{ testo: 'ENTRO IL 31/12/2026' }, { testo: 'PAGATI 130,00 € SU 480,00 €' }] }])
okp('in parte senza entro: niente riga ENTRO', tc(corso('in_parte', { mancano: 35000, totale: 48000 }))[0]?.righe, [{ testo: 'PAGATI 130,00 € SU 480,00 €' }])
okp('in parte senza totale: niente riga PAGATI', tc(corso('in_parte', { mancano: 35000, entro: '2026-12-31' }))[0]?.righe, [{ testo: 'ENTRO IL 31/12/2026' }])
ok('in parte oltre il termine: rosso', tc(corso('in_parte', { mancano: 35000, totale: 48000, entro: '2026-12-31', oltre: true }))[0]?.tono, 'rosso')
okp('da pagare col totale: il prezzo dell’annuale', tc(corso('da_pagare', { totale: 48000 })), [
  { titolo: 'JUDO 3 · DA PAGARE', parola: '480,00 €', tono: 'rosso', righe: [{ testo: 'ANNUALE, NESSUN PAGAMENTO' }] }])
okp('da pagare senza totale: DA PAGARE', tc(corso('da_pagare')), [{ titolo: 'JUDO 3 · DA PAGARE', parola: 'DA PAGARE', tono: 'rosso', righe: [{ testo: 'NESSUN PAGAMENTO' }] }])
for (const come of ['scaduto', 'fuori_scaduto'])
  okp(`${come}: DA PAGARE, scaduto il`, tc(corso(come, { al: '2026-09-30' })), [{ titolo: 'JUDO 3 · DA PAGARE', parola: 'DA PAGARE', tono: 'rosso', righe: [{ testo: 'SCADUTO IL 30/09/2026' }] }])
okp('da controllare: voce scritta a mano', tc(corso('da_controllare')), [{ titolo: 'JUDO 3 · DA CONTROLLARE', parola: 'DA CONTROLLARE', tono: 'giallo', righe: [{ testo: 'VOCE SCRITTA A MANO' }] }])
ok('un timbro per corso non pagato, nell’ordine dato', tc(corso('pagato'), corso('da_pagare', { corso: 'MGA' }), corso('da_controllare', { corso: 'Pilates' }))?.map?.((t) => t.titolo), ['MGA · DA PAGARE', 'PILATES · DA CONTROLLARE'])

// ---- 11. Lo storico con i bonifici ------------------------------------------
console.log('\n11. Lo storico: un bonifico assegnato è una riga sola')
const parte = (id, importo, creatoIl, extra = {}) => ({ ...dir(id, '2026-10-03', importo), movimentoId: 'm1', metodo: 'bonifico', creatoIl, ...extra })
const mov = (id, data, importo, descrizione = 'Cliente Mario Rossi per quota e corso') => ({ id, data, descrizione, importo, voce: 'CORSI', cassa: 'CC', aMano: true })
const due = [parte('d2', 30000, '2026-10-05T10:00:00Z'), parte('d1', 20000, '2026-10-05T09:00:00Z'), parte('dx', 7000, '2026-10-05T11:00:00Z', { annullatoIl: '2026-10-06' })]
const riga = (x) => (Array.isArray(x) ? x.find((y) => y.tipo === 'bonifico') : x)
// sigla() dei test vecchi legge x.x.id: una riga «bonifico» non ce l'ha, qui non serve.
okp('due parti dello stesso movimento: una riga «bonifico», importo senza le annullate, parti per creatoIl', riga(f('storicoPagamenti', [], due)), {
  tipo: 'bonifico', movimentoId: 'm1', data: '2026-10-03', importo: 50000, parti: [due[1], due[0], due[2]] })
okp('col movimento: data, importo e nome dal movimento', riga(f('storicoPagamenti', [], due, [mov('m1', '2026-10-02', 53000)])), {
  tipo: 'bonifico', movimentoId: 'm1', data: '2026-10-02', importo: 53000, da: 'Mario Rossi', parti: [due[1], due[0], due[2]] })
ok('una causale senza nome: niente «da»', ((r) => [r?.tipo, r?.da])(riga(f('storicoPagamenti', [], due, [mov('m1', '2026-10-02', 53000, 'Bonifico generico')]))), ['bonifico', undefined])
ok('i diretti senza movimentoId restano «diretto»; ordine per data decrescente',
  f('storicoPagamenti', [ric('r1', 1, '2026-09-10')], [dir('d9', '2026-10-20'), ...due])?.map?.((x) => x.tipo), ['diretto', 'bonifico', 'ricevuta'])

// ---- 12. I bonifici da assegnare e le righe di contabilità ------------------
console.log('\n12. Righe da assegnare e filtro di contabilità')
const bonifici = [{ movimentoId: 'm2', data: '2026-10-02', importo: 53000, daAssegnare: 23000 }, { movimentoId: 'm5', data: '2026-10-04', importo: 1000, daAssegnare: 1000 }]
okp('righeDaAssegnare: da assegnare, nome e causale dal movimento', f('righeDaAssegnare', bonifici, [mov('m2', '2026-10-02', 53000), mov('m5', '2026-10-04', 1000, 'Bonifico generico')]), [
  { movimentoId: 'm2', data: '2026-10-02', importo: 23000, da: 'Mario Rossi', causale: 'Cliente Mario Rossi per quota e corso' },
  { movimentoId: 'm5', data: '2026-10-04', importo: 1000, causale: 'Bonifico generico' }])
okp('righeDaAssegnare: movimento che non si trova, solo i dati del bonifico', f('righeDaAssegnare', [bonifici[0]], []), [{ movimentoId: 'm2', data: '2026-10-02', importo: 23000 }])
const inCont = ['m1', 'm2', 'm3', 'm4', 'm5'].map((id) => mov(id, '2026-10-02', 1000))
const diretti = [parte('a', 1000, '2026-10-05'), parte('b', 500, '2026-10-05', { movimentoId: 'm2' }), parte('c', 500, '2026-10-05', { movimentoId: 'm4', annullatoIl: '2026-10-06' }), parte('e', 500, '2026-10-05', { movimentoId: 'm5' })]
ok('daMostrareInContabilita: restano il movimento a mano e quello con la sola parte annullata',
  f('daMostrareInContabilita', inCont, diretti, bonifici)?.map?.((x) => x.id), ['m3', 'm4'])

console.log('\n13. Il pagato della stagione non conta i bonifici da assegnare')
ok('conta solo le parti assegnate non annullate, più le ricevute', f('pagatoNellaStagione', [ric('r1', 1, '2026-10-03', 5000)], [parte('a', 2000, '2026-10-05'), parte('x', 9000, '2026-10-05', { annullatoIl: '2026-10-06' })], OGGI), 7000)
// La scheda passa a pagatoNellaStagione solo ricevute e incassi a mano: i bonifici da assegnare (bonificiAperti)
// non sono PagamentoDiretto e non devono finirci. Se la chiamata cambia, questa prova cade.
const ricevuteTsx = (await import('node:fs')).readFileSync('src/components/segreteria/Ricevute.tsx', 'utf8')
ok('la scheda chiama pagatoNellaStagione(tutteRicevute, aMano, oggi), senza i da assegnare',
  ricevuteTsx.match(/pagatoNellaStagione\(([^)]*)\)/g), ['pagatoNellaStagione(tutteRicevute, aMano, oggi)'])
ok('aMano sono solo gli incassi a mano letti', /const aMano = diretti\.dato \?\? \[\]/.test(ricevuteTsx), true)

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
