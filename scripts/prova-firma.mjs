// ---------------------------------------------------------------------------
// Il modulo firmato dal telefono, senza browser.
//
//   node scripts/prova-firma.mjs [cartella]
//
// Compila i due fogli di `generaFogli` (i PDF con i campi) con una firma
// finta, come fa il modulo di iscrizione, e controlla che ne esca un PDF di
// una pagina, senza più campi, coi dati sul foglio. Con una
// cartella ci lascia i PDF, da aprire per guardare che dati, crocette e firme
// stiano sulle righe: se la palestra cambia un foglio, si rimisura da lì.
// ---------------------------------------------------------------------------
import { build } from 'esbuild'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { deflateSync } from 'node:zlib'
import fontkit from '@pdf-lib/fontkit'

const { outputFiles } = await build({
  stdin: {
    contents: "export { moduloFirmato, viaECivico, dataDelFoglio } from './src/lib/firma'; export { generaFogli } from './src/lib/fogliModuli'; export { PDFDocument, PDFName, PDFDict, PDFArray, decodePDFRawStream } from 'pdf-lib'",
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

if (spawnSync('pdfcraft-cli', ['--help']).error) {
  console.log(process.env.CI ? '  ✗ pdfcraft-cli manca: in CI la prova non si salta' : '  - pdfcraft-cli non c’è: prova saltata')
  process.exit(process.env.CI ? 1 : 0)
}
const tmp = mkdtempSync(join(tmpdir(), 'firma-'))
let n = 0
/** Il testo del PDF, su una riga sola. */
const testo = (pdf) => {
  const f = join(tmp, `${n++}.pdf`)
  writeFileSync(f, pdf)
  return execFileSync('pdfcraft-cli', ['text', f], { encoding: 'utf8' }).replace(/\s+/g, ' ')
}
/** Le immagini disegnate sulla prima pagina. */
const immagini = (doc) => {
  const xo = doc.getPage(0).node.Resources()?.lookup(m.PDFName.of('XObject'), m.PDFDict)
  return xo ? xo.keys().filter((k) => String(xo.lookup(k).dict.get(m.PDFName.of('Subtype'))) === '/Image').length : 0
}
/** Quante immagini si disegnano sulla pagina (ogni firma, ogni logo): i `Do` del suo contenuto. */
const disegni = (doc) => {
  const c = doc.getPage(0).node.Contents()
  const pezzi = c instanceof m.PDFArray ? c.asArray().map((r) => doc.context.lookup(r)) : [c]
  return pezzi.reduce((tot, p) => tot + (Buffer.from(m.decodePDFRawStream(p).decode()).toString('latin1').match(/\/\S+\s+Do\b/g) ?? []).length, 0)
}
const leggi = (f) => new Uint8Array(readFileSync(f))
const fogli = await m.generaFogli({
  fontkit,
  fonts: {
      titolo: leggi('dati/moduli/fonts/big-shoulders-display-800.ttf'),
      corpo: leggi('dati/moduli/fonts/inter-regular.ttf'),
      corpoGrassetto: leggi('dati/moduli/fonts/inter-bold.ttf'),
    },
  loghi: { mascotte: leggi('dati/moduli/mascotte.png'), simbolo: leggi('dati/moduli/simbolo.png') },
  oggi: '2026-09-27',
})

let guai = 0
const ok = (cosa, avuto, voluto) => {
  const va = JSON.stringify(avuto) === JSON.stringify(voluto)
  console.log(va ? '  ✓' : '  ✗', cosa, va ? '' : `— atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`)
  if (!va) guai++
}

/** Una firma finta: un PNG trasparente con un ghirigoro blu. */
function firmaFinta(w = 600, h = 160) {
  const px = Buffer.alloc((w * 4 + 1) * h)
  for (let x = 0; x < w; x++) {
    const y0 = Math.round(h / 2 + (h / 3) * Math.sin(x / 25) * Math.cos(x / 70))
    for (let y = y0 - 3; y <= y0 + 3; y++) {
      if (y < 0 || y >= h) continue
      const i = y * (w * 4 + 1) + 1 + x * 4
      px[i] = 20
      px[i + 1] = 40
      px[i + 2] = 130
      px[i + 3] = 255
    }
  }
  const crc = (b) => {
    let c = ~0
    for (const x of b) {
      c ^= x
      for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1
    }
    return ~c >>> 0
  }
  const pezzo = (tipo, dati) => {
    const t = Buffer.concat([Buffer.from(tipo), dati])
    const n = Buffer.alloc(4)
    n.writeUInt32BE(dati.length)
    const c = Buffer.alloc(4)
    c.writeUInt32BE(crc(t))
    return Buffer.concat([n, t, c])
  }
  const testa = Buffer.alloc(13)
  testa.writeUInt32BE(w, 0)
  testa.writeUInt32BE(h, 4)
  testa[8] = 8
  testa[9] = 6
  return new Uint8Array(
    Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), pezzo('IHDR', testa), pezzo('IDAT', deflateSync(px)), pezzo('IEND', Buffer.alloc(0))]),
  )
}

const dati = {
  nome: 'Luca', cognome: 'Rossi', natoIl: '2014-03-05', natoA: 'Torino', codiceFiscale: 'RSSLCU14C05L219X',
  indirizzo: 'Via Roma, 12/B', cap: '10093', comune: 'Collegno', email: 'paola@esempio.it', telefono: '347 111 2233',
  genitoreNome: 'Paola', genitoreCognome: 'Rossi', genitoreCodiceFiscale: 'RSSPLA80A41L219P', corsi: ['judo-ragazzi'], formula: 'annuale',
}
const quando = new Date(2026, 8, 27, 10, 5)

console.log('\n1. via e numero dall’indirizzo')
ok('via e numero con la virgola', m.viaECivico('Via Roma, 12/B'), { via: 'Via Roma', civico: '12/B' })
ok('senza virgola', m.viaECivico('Corso Francia 224'), { via: 'Corso Francia', civico: '224' })
ok('senza numero', m.viaECivico('Strada del Portone'), { via: 'Strada del Portone', civico: '' })
ok('un numero nel nome della via', m.viaECivico('Via 4 Novembre 7'), { via: 'Via 4 Novembre', civico: '7' })
ok('un interno dopo il civico resta nel numero', m.viaECivico('Via Fratelli Cervi Sant’Ambrogio 128/bis int. 12'), { via: 'Via Fratelli Cervi Sant’Ambrogio', civico: '128/bis int. 12' })
ok('«interno» per esteso', m.viaECivico('Via Roma 5 interno 3'), { via: 'Via Roma', civico: '5 interno 3' })
ok('la data come sul foglio', m.dataDelFoglio(quando), '27/09/2026')

console.log('\n1b. i fogli veri di public/moduli: il firmato non lascia riferimenti vuoti')
// Il foglio che l'app scarica è il file di public/moduli, già salvato una volta: da lì, togliere i campi
// lascia le annotazioni nella pagina se non si tolgono anch'esse, e i lettori ne vedono i riferimenti rotti.
for (const [foglio, minore] of [['maggiorenni', false], ['minori', true]]) {
  const pdf = await m.moduloFirmato({ dati, minore, scelte: { tesseramento: true, foto: true }, genitoreNatoA: 'Pinerolo', genitoreProvincia: 'to', firma: firmaFinta(), originale: leggi(`public/moduli/autorizzazioni-${foglio}.pdf`), quando, stagione: '2026/27' })
  const doc = await m.PDFDocument.load(pdf)
  const annot = doc.getPage(0).node.Annots()
  const rotti = annot ? annot.asArray().filter((r) => doc.context.lookup(r) === undefined).length : 0
  ok(`${foglio}: nessuna annotazione che punta a un oggetto che non c’è`, rotti, 0)
}

console.log('\n2. i moduli compilati e firmati')
const casi = [
  ['maggiorenni', 'maggiorenne', false, { tesseramento: true, foto: false }, { ...dati, nome: 'Łucja', cognome: 'Dell’Àcqua', natoIl: '1996-01-01' }],
  ['minori', 'minore-tutto', true, { tesseramento: true, foto: true }, dati],
  ['minori', 'minore-niente', true, { tesseramento: false, foto: false }, dati],
]
for (const [foglio, nome, minore, scelte, d] of casi) {
  const originale = fogli[foglio]
  const pdf = await m.moduloFirmato({ dati: d, minore, scelte, genitoreNatoA: 'Pinerolo', genitoreProvincia: 'to', firma: firmaFinta(), originale, quando, stagione: '2026/27' })
  const letto = await m.PDFDocument.load(pdf)
  const t = testo(pdf)
  ok(`${nome}: una pagina, della misura del foglio`, [letto.getPageCount(), ...Object.values(letto.getPage(0).getSize()).map(Math.round)], [1, 595, 842])
  ok(`${nome}: il titolo col nome`, letto.getTitle(), `Autorizzazioni ${d.nome} ${d.cognome}`)
  ok(`${nome}: nessun campo da compilare`, letto.getForm().getFields().map((c) => c.getName()), [])
  ok(`${nome}: la firma è un’immagine in più dei loghi`, immagini(letto) > immagini(await m.PDFDocument.load(originale)), true)
  // Un minore firma accanto a ogni scelta fatta; il secondo genitore non firma mai; chi non sceglie niente firma solo in fondo.
  const firme = !minore ? 1 : 1 + (scelte.foto ? 1 : 0) + (scelte.tesseramento ? 1 : 0)
  ok(`${nome}: la firma sta dove deve, e il secondo genitore no`, disegni(letto), disegni(await m.PDFDocument.load(originale)) + firme)
  // «Ł» può diventare «L» se il carattere manca al font.
  const sulFoglio = [d.nome === 'Łucja' ? (t.includes('Łucja') ? 'Łucja' : 'Lucja') : d.nome, d.cognome, '27/09/2026']
  // «Via» è già stampata sul foglio, e il minore non ha il codice fiscale.
  if (minore) sulFoglio.push(d.genitoreCodiceFiscale, 'Roma', '12/B', d.cap, d.comune, d.natoA, '05/03/2014', '01/01/1980', 'Pinerolo', d.genitoreNome)
  const piatto = t.replace(/[’‘]/g, "'")
  ok(`${nome}: i dati dati si leggono sul foglio`, sulFoglio.filter((v) => !piatto.includes(v.replace(/[’‘]/g, "'"))), [])
  ok(`${nome}: l’anno di stagione solo se si accetta il tesseramento`, t.includes('2026/27'), scelte.tesseramento)
  if (cartella) writeFileSync(`${cartella}/modulo-${nome}.pdf`, pdf)
}

console.log(guai ? `\n${guai} controlli non tornano\n` : '\nTutto torna\n')
process.exit(guai ? 1 : 0)
