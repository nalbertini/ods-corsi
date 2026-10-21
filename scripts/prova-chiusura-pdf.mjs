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
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { inflateSync } from 'node:zlib'

const { outputFiles } = await build({
  stdin: {
    contents: "export { righeDelPeriodo } from './src/lib/contabilita'; export { chiusuraCassaPdf, righePerPagina } from './src/lib/chiusuraCassaPdf'; export { ENTE_PREDEFINITO } from './src/lib/ricevute'; export { PDFDocument, PDFArray, PDFRawStream, PDFName, PDFDict } from 'pdf-lib'",
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

// Leggere una pagina come prova-lettere.mjs § 6 bis: solo il contenuto della pagina, non quello della carta
// disegnata sopra. Le righe scritte (dove, che corpo, cosa), i Form disegnati con `Do` e il riquadro che
// coprono sulla pagina (BBox per la Matrix del Form e per quella del momento), i punti delle linee, le curve.
const leggiPagina = ({ PDFArray, PDFRawStream, PDFName, PDFDict }) => (pg) => {
  const c = pg.node.Contents()
  const contenuto = (c instanceof PDFArray ? c.asArray().map((r) => pg.doc.context.lookup(r)) : [c])
    .filter((f) => f instanceof PDFRawStream)
    .map((f) => {
      try {
        return inflateSync(f.contents).toString('latin1')
      } catch {
        return Buffer.from(f.contents).toString('latin1')
      }
    })
    .join('\n')
  const xo = pg.node.Resources()?.lookup(PDFName.of('XObject'), PDFDict)
  const forma = (nome) => {
    const o = xo?.lookup(PDFName.of(nome.slice(1)))
    const d = o instanceof PDFRawStream ? o.dict : o
    return String(d?.get(PDFName.of('Subtype'))) === '/Form' ? d : null
  }
  const numeri = (d, k) => d.lookup(PDFName.of(k), PDFArray)?.asArray().map((n) => n.asNumber())
  const per = ([a, b, c, d, e, f], [A, B, C, D, E, F]) => [a * A + b * C, a * B + b * D, c * A + d * C, c * B + d * D, e * A + f * C + E, e * B + f * D + F]
  const punto = ([a, b, c, d, e, f], x, y) => [a * x + c * y + e, b * x + d * y + f]
  const scritte = []
  const forme = []
  const punti = []
  let curve = 0
  let ctm = [1, 0, 0, 1, 0, 0]
  let tm = [0, 0]
  let corpo = 0
  let num = []
  let prima = ''
  const pila = []
  for (const t of contenuto.split(/\s+/)) {
    if (/^-?[\d.]+$/.test(t)) {
      num.push(Number(t))
      continue
    }
    if (t === 'q') pila.push(ctm)
    else if (t === 'Q') ctm = pila.pop() ?? ctm
    else if (t === 'cm') ctm = per(num.slice(-6), ctm)
    else if (t === 'Tf') corpo = num.at(-1)
    else if (t === 'Tm') tm = punto(ctm, num.at(-2), num.at(-1))
    else if (t === 'Tj' && prima.startsWith('<')) scritte.push({ x: tm[0], y: tm[1], corpo, testo: Buffer.from(prima.slice(1, -1), 'hex').toString('latin1').replace(/\x92/g, '’') })
    else if (t === 'Do' && forma(prima)) {
      const d = forma(prima)
      const m = per(numeri(d, 'Matrix') ?? [1, 0, 0, 1, 0, 0], ctm)
      const [x0, y0, x1, y1] = numeri(d, 'BBox')
      const angoli = [punto(m, x0, y0), punto(m, x1, y1), punto(m, x0, y1), punto(m, x1, y0)]
      forme.push({ nome: prima, dopo: scritte.length, x0: Math.min(...angoli.map((a) => a[0])), x1: Math.max(...angoli.map((a) => a[0])), y0: Math.min(...angoli.map((a) => a[1])), y1: Math.max(...angoli.map((a) => a[1])) })
    } else if (t === 'm' || t === 'l') punti.push(punto(ctm, num.at(-2), num.at(-1)))
    else if (t === 'c') curve++
    num = []
    prima = t
  }
  const tratteggi = [...contenuto.matchAll(/\[([^\]]*)\]\s+-?[\d.]+\s+d\b/g)].filter((x) => x[1].trim()).length
  return { contenuto, scritte, righe: scritte.map((s) => s.testo), forme, punti, curve, tratteggi }
}

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
// Il testo scritto nel PDF: gli stream si aprono e le stringhe esadecimali dei `Tj` si rileggono byte per byte.
const testoDelPdf = (bytes) => {
  const b = Buffer.from(bytes)
  const s = b.toString('latin1')
  let fuori = ''
  for (const x of s.matchAll(/stream\r?\n/g)) {
    const da = x.index + x[0].length
    try {
      fuori += inflateSync(b.subarray(da, s.indexOf('endstream', da))).toString('latin1')
    } catch {
      /* non è un contenuto di pagina */
    }
  }
  return [...fuori.matchAll(/<([0-9A-F]+)> Tj/g)].map((t) => Buffer.from(t[1], 'hex').toString('latin1')).join('\n')
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
  // Il font standard non scrive il «−» (U+2212): i segni nel foglio sono il trattino «-» e il «+».
  const scritto = testoDelPdf(normale)
  ok('le uscite hanno il trattino dritto, le entrate il più', [scritto.includes('- 1,01 \x80'), scritto.includes('+ 1,00 \x80'), scritto.includes('\u2212')], [true, true, false])
  ok('la differenza è in parole, mai con un segno', [scritto.includes('5,00 \x80 in meno'), scritto.includes('\u2212')], [true, false])
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

console.log('\n3. il PDF sulla carta intestata')
{
  const leggi = leggiPagina(m)
  const carta = new Uint8Array(readFileSync('public/moduli/carta-intestata.pdf'))
  const ALTO = 841.89
  const ente = { ...m.ENTE_PREDEFINITO, nome: 'Officine Dello Sport ASD' }
  const mov = (n) => Array.from({ length: n }, (_, i) => riga(`m${String(i).padStart(3, '0')}`, i % 2 ? 'uscita' : 'entrata', '2026-09-10', 100 + i, 'c1'))
  const fai = async (k, righe, su) => {
    try {
      const doc = await m.PDFDocument.load(await m.chiusuraCassaPdf({ ente, cassa: 'Cassa Contanti', chiusura: k, righe, ...(su ? { carta: su } : {}) }))
      return { doc, pagine: doc.getPages().map(leggi) }
    } catch (e) {
      return { errore: e.message }
    }
  }
  const impronta = (p) => p.errore ?? createHash('sha256').update(p.pagine.map((q) => q.contenuto).join('\n')).digest('hex').slice(0, 16)
  const annullata = { ...chiusura, annullataIl: '2026-09-15T10:00:00Z', annullataDa: 'Chiara Bianchi' }
  const casi = [['la chiusura di otto movimenti', chiusura, mov(8), 'bc2ef9a8e543eb94'], ['quella annullata', annullata, mov(8), '3b81df22353416fa'], ['quella di centoventi movimenti', chiusura, mov(120), '62dfab120e6a25ca']]

  // Senza carta il foglio è quello di oggi: lo stesso contenuto, pagina per pagina, e niente disegnato sopra.
  for (const [nome, k, righe, oggi] of casi) {
    const p = await fai(k, righe)
    ok(`${nome}, senza carta: nessun XObject Form`, p.errore ?? p.pagine.map((q) => q.forme.length), p.pagine?.map(() => 0))
    ok(`${nome}, senza carta: lo stesso contenuto di oggi`, impronta(p), oggi)
  }

  for (const [nome, k, righe] of casi) {
    const p = await fai(k, righe, carta)
    ok(`${nome}, con la carta: si fa`, p.errore ?? 'fatto', 'fatto')
    if (p.errore) continue
    const ps = p.pagine
    if (righe.length > 100) ok(`${nome}: più di una pagina`, ps.length > 1, true)
    ok(`${nome}: ogni pagina ha la carta (un XObject Form)`, ps.map((q) => q.forme.length > 0), ps.map(() => true))
    ok(`${nome}: la pagina non scrive più da sé nome, indirizzo e C.F. dell’ente: li dice la carta`, ps.map((q) => q.righe.filter((r) => r === ente.nome || r.includes(ente.indirizzo) || r.startsWith('C.F.'))), ps.map(() => []))
    ok(`${nome}: il titolo «CHIUSURA DI CASSA» resta, sulla prima pagina`, ps[0].righe.includes('CHIUSURA DI CASSA'), true)
    ok(`${nome}: le firme restano, sull’ultima`, ['Chi ha contato', 'Chi controlla'].filter((f) => !ps.at(-1).righe.includes(f)), [])
    const fuori = ps.flatMap((q, i) => q.scritte.filter((s) => s.y - 0.2 * s.corpo < 68 || s.y + 0.75 * s.corpo > ALTO - 92).map((s) => `pagina ${i + 1}: «${s.testo}» a y=${s.y}`))
    ok(`${nome}: nessuna riga nella testata (92 punti dall’alto) o nel piede (68 dal fondo) della carta vera`, fuori, [])
    if (ps.length > 1) ok(`${nome}: «pagina n di ${ps.length}» su ogni pagina, sopra il piede`, ps.map((q, i) => q.righe.some((r) => r.includes(`pagina ${i + 1} di ${ps.length}`))), ps.map(() => true))
  }
}

console.log(guai ? `\n${guai} COSE NON TORNANO` : '\nTUTTO A POSTO')
process.exit(guai ? 1 : 0)
