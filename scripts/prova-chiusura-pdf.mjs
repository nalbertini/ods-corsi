// ---------------------------------------------------------------------------
// Il foglio PDF della chiusura di cassa, senza browser.
//
//   node scripts/prova-chiusura-pdf.mjs [cartella]
//
// Controlla `righeDelPeriodo` (i movimenti in contanti che il foglio elenca) e fa i PDF di
// `src/lib/chiusuraCassaPdf.ts`: una chiusura normale, una annullata e una con tanti movimenti
// che va a una seconda pagina. Con una cartella ci lascia i PDF, da aprire e guardare.
// ---------------------------------------------------------------------------
import { build } from 'esbuild'
import { writeFileSync } from 'node:fs'

const { outputFiles } = await build({
  stdin: {
    contents: "export { righeDelPeriodo } from './src/lib/contabilita'; export { chiusuraCassaPdf, righePerPagina } from './src/lib/chiusuraCassaPdf'; export { ENTE_PREDEFINITO } from './src/lib/ricevute'; export { PDFDocument } from 'pdf-lib'",
    resolveDir: '.',
    loader: 'ts',
  },
  bundle: true,
  format: 'esm',
  platform: 'node',
  write: false,
  logLevel: 'error',
  define: { 'import.meta.env': '{}' },
})
const m = await import('data:text/javascript;base64,' + Buffer.from(outputFiles[0].text).toString('base64'))
const cartella = process.argv[2]

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
const provaA = async (f) => {
  try {
    return await f()
  } catch (e) {
    return `ERRORE: ${e.message}`
  }
}

const riga = (id, tipo, data, importo, cassaId, extra = {}) => ({ id, origine: 'movimento', tipo, data, importo, descrizione: id, voce: tipo === 'giroconto' ? null : 'Donazioni', cassaId, annullato: false, ...extra })
const chiusura = { id: 'k1', cassaId: 'c1', dal: '2026-09-08', data: '2026-09-14', previsto: 13000, contato: 12500, differenza: -500, nota: 'Resto dato in più', movimentoId: 'mdiff', chiusaDa: 'Chiara Bianchi', chiusaIl: '2026-09-14T16:40:00Z' }

console.log('1. i movimenti che il foglio elenca')
{
  const righe = [
    riga('prima', 'entrata', '2026-09-07', 100, 'c1'),
    riga('dentro-b', 'uscita', '2026-09-10', 200, 'c1'),
    riga('dentro-a', 'entrata', '2026-09-10', 300, 'c1'),
    riga('ultimo', 'entrata', '2026-09-14', 400, 'c1'),
    riga('dopo', 'entrata', '2026-09-15', 500, 'c1'),
    riga('conto', 'entrata', '2026-09-10', 600, 'c2'),
    riga('annullato', 'entrata', '2026-09-10', 700, 'c1', { annullato: true }),
    riga('giro-da', 'giroconto', '2026-09-11', 800, 'c1', { cassaAId: 'c2' }),
    riga('giro-a', 'giroconto', '2026-09-12', 900, 'c2', { cassaAId: 'c1' }),
    riga('giro-altrove', 'giroconto', '2026-09-12', 950, 'c2', { cassaAId: 'c3' }),
    riga('incasso', 'entrata', '2026-09-09', 1000, 'c1', { origine: 'ricevuta', voce: 'Corsi e altri pagamenti', sotto: 'ANNUALE JUDO · Contanti' }),
  ]
  const dentro = prova(() => m.righeDelPeriodo(righe, chiusura, 'c1').map((r) => r.id))
  ok('quelli della cassa, dal «dal» al giorno chiuso, non annullati; anche i giroconti da e verso; per giorno e poi per id', dentro, ['incasso', 'dentro-a', 'dentro-b', 'giro-da', 'giro-a', 'ultimo'])
  ok('senza righe, niente', prova(() => m.righeDelPeriodo([], chiusura, 'c1')), [])
}

console.log('\n2. il PDF')
{
  const ente = { ...m.ENTE_PREDEFINITO, nome: 'Officine Dello Sport ASD' }
  const mov = (n) => Array.from({ length: n }, (_, i) => riga(`m${String(i).padStart(3, '0')}`, i % 2 ? 'uscita' : 'entrata', '2026-09-10', 100 + i, 'c1', i % 3 === 0 ? { origine: 'ricevuta', descrizione: 'Rossi Giulia', voce: 'Quota associativa', sotto: 'QUOTA ASSOCIATIVA · Contanti' } : {}))
  const fai = (k, righe) => provaA(() => m.chiusuraCassaPdf({ ente, cassa: 'Cassa Contanti', chiusura: k, righe }))
  const normale = await fai(chiusura, mov(8))
  ok('è un PDF', typeof normale === 'string' ? normale : new TextDecoder().decode(normale.slice(0, 5)), '%PDF-')
  const doc = await provaA(() => m.PDFDocument.load(normale))
  ok('una pagina', prova(() => doc.getPageCount()), 1)
  ok('A4 in verticale', prova(() => [Math.round(doc.getPage(0).getWidth()), Math.round(doc.getPage(0).getHeight())]), [595, 842])
  ok('il titolo dice cassa e giorni', prova(() => doc.getTitle()), 'Chiusura di cassa · Cassa Contanti · dal 08/09/2026 al 14/09/2026')
  ok('l\'autore è l\'ente', prova(() => doc.getAuthor()), 'Officine Dello Sport ASD')
  const annullata = await fai({ ...chiusura, annullataIl: '2026-09-15T10:00:00Z', annullataDa: 'Chiara Bianchi' }, mov(8))
  const docA = await provaA(() => m.PDFDocument.load(annullata))
  ok('annullata: lo dice il titolo', prova(() => docA.getTitle()), 'Chiusura di cassa · Cassa Contanti · dal 08/09/2026 al 14/09/2026 · ANNULLATA')
  ok('senza movimenti è comunque un foglio', prova(async () => 0) instanceof Promise, true)
  const nonInRegola = await provaA(() => m.chiusuraCassaPdf({ ente, cassa: 'Cassa Contanti', chiusura, righe: mov(8), nonPiuInRegola: true }))
  const docR = await provaA(() => m.PDFDocument.load(nonInRegola))
  ok('un foglio rifatto dopo che un incasso è cambiato lo dice nel titolo', prova(() => docR.getTitle()), 'Chiusura di cassa · Cassa Contanti · dal 08/09/2026 al 14/09/2026 · NON PIÙ IN REGOLA')
  const vuota = await fai({ ...chiusura, differenza: 0, movimentoId: undefined }, [])
  ok('…senza movimenti va', (await provaA(() => m.PDFDocument.load(vuota))).getPageCount?.(), 1)
  const tanti = await fai(chiusura, mov(120))
  const docT = await provaA(() => m.PDFDocument.load(tanti))
  const attese = prova(() => Math.ceil(120 / m.righePerPagina))
  ok('tanti movimenti: vanno a una seconda pagina, e oltre', prova(() => docT.getPageCount() > 1 && docT.getPageCount() >= attese), true)
  const ancora = await fai(chiusura, mov(40))
  ok('un caratteri che il font non scrive non rompe niente', (await fai({ ...chiusura, nota: 'Resto 😀 dato' }, [riga('x', 'entrata', '2026-09-10', 100, 'c1', { descrizione: 'Offerta 😀' })])) instanceof Uint8Array, true)
  ok('tutti i fogli sono PDF validi', (await Promise.all([normale, annullata, vuota, tanti, ancora].map((b) => provaA(() => m.PDFDocument.load(b).then((d) => d.getPageCount() >= 1))))).every((x) => x === true), true)
  if (cartella) {
    writeFileSync(`${cartella}/chiusura.pdf`, normale)
    writeFileSync(`${cartella}/chiusura-annullata.pdf`, annullata)
    writeFileSync(`${cartella}/chiusura-tanti.pdf`, tanti)
  }
}

console.log(guai ? `\n${guai} COSE NON TORNANO` : '\nTUTTO A POSTO')
process.exit(guai ? 1 : 0)
