// ---------------------------------------------------------------------------
// Il modulo firmato dal telefono, senza browser.
//
//   node scripts/prova-firma.mjs [cartella]
//
// Compila i due moduli di `public/moduli/` con una firma finta, come fa il
// modulo di iscrizione, e controlla che ne esca un PDF di una pagina. Con una
// cartella ci lascia i PDF, da aprire per guardare che dati, crocette e firme
// stiano sulle righe: se la palestra cambia un foglio, si rimisura da lì.
// ---------------------------------------------------------------------------
import { build } from 'esbuild'
import { readFileSync, writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

const { outputFiles } = await build({
  stdin: {
    contents: "export { moduloFirmato, viaECivico, dataDelFoglio } from './src/lib/firma'; export { PDFDocument } from 'pdf-lib'",
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
ok('la data come sul foglio', m.dataDelFoglio(quando), '27/09/2026')

console.log('\n2. i moduli compilati e firmati')
const casi = [
  ['maggiorenni', 'maggiorenne', false, { tesseramento: true, foto: false }, { ...dati, nome: 'Łucja', cognome: 'Dell’Àcqua', natoIl: '1996-01-01' }],
  ['minori', 'minore-tutto', true, { tesseramento: true, foto: true }, dati],
  ['minori', 'minore-niente', true, { tesseramento: false, foto: false }, dati],
]
for (const [foglio, nome, minore, scelte, d] of casi) {
  const originale = readFileSync(`public/moduli/autorizzazioni-${foglio}.pdf`)
  const pdf = await m.moduloFirmato({ dati: d, minore, scelte, genitoreNatoA: 'Pinerolo', genitoreProvincia: 'to', firma: firmaFinta(), originale, quando, stagione: '2026/27' })
  const letto = await m.PDFDocument.load(pdf)
  ok(`${nome}: una pagina, della misura del foglio`, [letto.getPageCount(), ...Object.values(letto.getPage(0).getSize()).map(Math.round)], [1, 596, 842])
  ok(`${nome}: il titolo col nome`, letto.getTitle(), `Autorizzazioni ${d.nome} ${d.cognome}`)
  if (cartella) writeFileSync(`${cartella}/modulo-${nome}.pdf`, pdf)
}

console.log(guai ? `\n${guai} controlli non tornano\n` : '\nTutto torna\n')
process.exit(guai ? 1 : 0)
