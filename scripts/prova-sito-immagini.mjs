// ---------------------------------------------------------------------------
// Le foto del sito pesano poco e non fanno saltare la pagina, senza browser.
//
//   node scripts/prova-sito-immagini.mjs
//
// Le foto del contenitore «sito» erano senza width/height (la pagina salta mentre arrivano), con la cache di
// 1 ora, e solo quelle del collage avevano le misure ridotte di /render/image (`conMisure` in sitoLayout.ts).
// Ora: il pannello le carica con la cache di un anno (i nomi sono uuid e non si sovrascrivono), il generatore
// scrive width/height sulle foto che conosce (`DatiSito.immagini`, chiave l'indirizzo pubblico: le misure le
// legge `dimensioniImmagine` dall'intestazione) e le misure ridotte valgono per ogni foto del testo.
// ---------------------------------------------------------------------------
import { build } from 'esbuild'
import * as F from './fixture-home-nuova.mjs'

const carica = async (file) => {
  const { outputFiles } = await build({ entryPoints: [file], bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent', define: { 'import.meta.env': '{}' }, banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(process.cwd() + '/');" } })
  return import('data:text/javascript;base64,' + Buffer.from(outputFiles[0].text).toString('base64'))
}
const g = await carica('src/lib/sitoGenera.ts')
const I = await carica('src/lib/sitoImmagini.ts')

let guai = 0
const ok = (cosa, avuto, voluto) => {
  const va = JSON.stringify(avuto) === JSON.stringify(voluto)
  console.log(va ? '  ✓' : '  ✗', cosa, va ? '' : `— atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`)
  if (!va) guai++
}
// Una funzione che manca fa fallire il caso, non la prova.
const chiama = (nome, ...a) => {
  if (typeof I[nome] !== 'function') return `(manca ${nome})`
  try { return I[nome](...a) } catch (e) { return `(eccezione: ${e.message})` }
}

const UUID = '18c88f1d-5cea-4284-b45a-cc8fabd1a645'
const SIZES = '(max-width: 800px) calc(100vw - 32px), 880px'

console.log('\n1. La cache')
ok('un anno, in secondi', I.CACHE_IMMAGINI, '31536000')

console.log('\n2. Le misure dall\'intestazione')
const be16 = (n) => [(n >> 8) & 255, n & 255]
const be32 = (n) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]
const le16 = (n) => [n & 255, (n >> 8) & 255]
const le24 = (n) => [n & 255, (n >> 8) & 255, (n >> 16) & 255]
const asc = (s) => [...s].map((c) => c.charCodeAt(0))
const jpeg = (w, h, { sof = 0xc0, prima = [] } = []) => new Uint8Array([0xff, 0xd8, ...prima, 0xff, sof, ...be16(17), 8, ...be16(h), ...be16(w), 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1, 0xff, 0xd9])
const segmento = (marcatore, n) => [0xff, marcatore, ...be16(n + 2), ...new Array(n).fill(0x41)]
const png = (w, h) => new Uint8Array([0x89, ...asc('PNG'), 13, 10, 26, 10, ...be32(13), ...asc('IHDR'), ...be32(w), ...be32(h), 8, 2, 0, 0, 0, 0, 0, 0, 0])
const riff = (...pezzi) => new Uint8Array([...asc('RIFF'), ...le16(0), 0, 0, ...asc('WEBP'), ...pezzi.flat()])
const webpVP8 = (w, h) => riff(asc('VP8 '), ...le16(10), 0, 0, [0x30, 0x01, 0x00, 0x9d, 0x01, 0x2a, ...le16(w), ...le16(h)])
const webpVP8L = (w, h) => { const v = (w - 1) | ((h - 1) << 14); return riff(asc('VP8L'), ...le16(5), 0, 0, [0x2f, v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255]) }
const webpVP8X = (w, h) => riff(asc('VP8X'), ...le16(10), 0, 0, [0, 0, 0, 0, ...le24(w - 1), ...le24(h - 1)])
const mis = (b) => chiama('dimensioniImmagine', b)
ok('JPEG baseline (SOF0)', mis(jpeg(1800, 1200)), { larghezza: 1800, altezza: 1200 })
ok('JPEG esteso (SOF1)', mis(jpeg(640, 480, { sof: 0xc1 })), { larghezza: 640, altezza: 480 })
ok('JPEG progressivo (SOF2)', mis(jpeg(1024, 768, { sof: 0xc2 })), { larghezza: 1024, altezza: 768 })
ok('JPEG con APP1 (EXIF) prima del SOF', mis(jpeg(1800, 1350, { prima: segmento(0xe1, 300) })), { larghezza: 1800, altezza: 1350 })
ok('JPEG con APP0, APP1 e DHT (0xFFC4 non è un SOF) prima del SOF', mis(jpeg(333, 222, { prima: [...segmento(0xe0, 14), ...segmento(0xe1, 40), ...segmento(0xc4, 20)] })), { larghezza: 333, altezza: 222 })
ok('JPEG senza SOF', mis(new Uint8Array([0xff, 0xd8, ...segmento(0xe1, 30), 0xff, 0xd9])), null)
ok('JPEG troncato a metà del SOF', mis(jpeg(1800, 1200).slice(0, 9)), null)
ok('JPEG troncato dentro l\'APP1', mis(jpeg(1800, 1200, { prima: segmento(0xe1, 300) }).slice(0, 100)), null)
// L'orientamento EXIF (tag 0x0112 nell'APP1): da 5 a 8 la foto si vede girata di 90°, larghezza e altezza si scambiano.
const exif = (orientamento, motorola = true) => {
  const b16 = motorola ? be16 : le16
  const b32 = motorola ? be32 : (n) => [n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >>> 24) & 255]
  const tiff = [...asc(motorola ? 'MM' : 'II'), ...b16(42), ...b32(8), ...b16(1), ...b16(0x0112), ...b16(3), ...b32(1), ...b16(orientamento), 0, 0, ...b32(0)]
  const corpo = [...asc('Exif'), 0, 0, ...tiff]
  return [0xff, 0xe1, ...be16(corpo.length + 2), ...corpo]
}
ok('JPEG con EXIF orientamento 6 (girata): misure scambiate', mis(jpeg(1800, 1200, { prima: exif(6) })), { larghezza: 1200, altezza: 1800 })
ok('JPEG con EXIF orientamento 8, little endian: scambiate', mis(jpeg(1800, 1200, { prima: exif(8, false) })), { larghezza: 1200, altezza: 1800 })
ok('JPEG con EXIF orientamento 1: come sono', mis(jpeg(1800, 1200, { prima: exif(1) })), { larghezza: 1800, altezza: 1200 })
ok('JPEG con EXIF orientamento 3 (capovolta): come sono', mis(jpeg(1800, 1200, { prima: exif(3) })), { larghezza: 1800, altezza: 1200 })
ok('JPEG con byte di riempimento FF prima del SOF', mis(jpeg(640, 480, { prima: [0xff] })), { larghezza: 640, altezza: 480 })
ok('PNG', mis(png(1200, 800)), { larghezza: 1200, altezza: 800 })
ok('PNG troncato', mis(png(1200, 800).slice(0, 20)), null)
ok('WebP VP8 (lossy)', mis(webpVP8(1600, 900)), { larghezza: 1600, altezza: 900 })
ok('WebP VP8L (lossless)', mis(webpVP8L(1280, 853)), { larghezza: 1280, altezza: 853 })
ok('WebP VP8X (esteso)', mis(webpVP8X(1920, 1080)), { larghezza: 1920, altezza: 1080 })
ok('WebP troncato', mis(webpVP8(1600, 900).slice(0, 24)), null)
ok('una GIF non si legge', mis(new Uint8Array([...asc('GIF89a'), 1, 0, 1, 0, 0, 0, 0])), null)
ok('byte a caso', mis(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28])), null)
ok('vuoto', mis(new Uint8Array(0)), null)
ok('un solo byte', mis(new Uint8Array([0xff])), null)
ok('solo la firma JPEG', mis(new Uint8Array([0xff, 0xd8])), null)

console.log('\n3. Il sito generato: width e height, misure ridotte in ogni pagina')
const P = F.P
const src = (nome) => `${P}${nome}`
const render = (nome, w) => `${P.replace('/object/public/', '/render/image/public/')}${nome}?width=${w}&quality=75`
const tagDi = (html, nome) => [...html.matchAll(/<img\b[^>]*>/gi)].map((m) => m[0]).find((t) => t.includes(nome))
const attr = (tag, a) => tag?.match(new RegExp(`\\s${a}="([^"]*)"`))?.[1]
const tutteLeFoto = (file) => Object.values(file).flatMap((h) => (typeof h === 'string' ? [...h.matchAll(/<img\b[^>]*>/gi)].map((m) => m[0]) : []))
const IMM = {
  [src(F.FOTO.gruppo)]: { larghezza: 1800, altezza: 1200 },
  [src(F.FOTO.sala)]: { larghezza: 400, altezza: 300 },
}
const senza = g.generaSito(F.dati(F.TESTO_NUOVO))
const con = g.generaSito({ ...F.dati(F.TESTO_NUOVO), immagini: IMM })
{
  const t = tagDi(con['index.html'], F.FOTO.gruppo)
  ok('la foto del collage: width e height dell\'originale', [attr(t, 'width'), attr(t, 'height')], ['1800', '1200'])
  ok('…e le misure ridotte di prima, una volta sola', [attr(t, 'src'), (t.match(/\ssrcset=/g) ?? []).length], [render(F.FOTO.gruppo, 800), 1])
  ok('…con fetchpriority, senza loading', [/fetchpriority="high"/.test(t), /loading=/.test(t)], [true, false])
}
ok('una foto piccola: le sue misure', [attr(tagDi(con['index.html'], F.FOTO.sala), 'width'), attr(tagDi(con['index.html'], F.FOTO.sala), 'height')], ['400', '300'])
ok('una foto senza voce: niente width né height', [attr(tagDi(con['index.html'], F.FOTO.cubi), 'width'), attr(tagDi(con['index.html'], F.FOTO.cubi), 'height')], [undefined, undefined])
ok('senza `immagini` nessuna foto del contenitore ha width o height', tutteLeFoto(senza).filter((t) => t.includes('/sito/') && /\s(width|height)=/.test(t)), [])
ok('`immagini` vuoto è come senza', JSON.stringify(g.generaSito({ ...F.dati(F.TESTO_NUOVO), immagini: {} })) === JSON.stringify(senza), true)
ok('una voce che non corrisponde a nessuna foto non cambia nulla', JSON.stringify(g.generaSito({ ...F.dati(F.TESTO_NUOVO), immagini: { [src('00000000-0000-4000-8000-000000000000.jpg')]: { larghezza: 1, altezza: 1 } } })) === JSON.stringify(senza), true)
ok('nessuna foto del contenitore esce con l\'indirizzo dell\'originale (tutte da /render/image)', tutteLeFoto(con).filter((t) => t.includes('/object/public/sito/')), [])
{
  const x = g.generaSito({ ...F.dati(F.TESTO_NUOVO, { ospiti: [] }), immagini: IMM })
  ok('un\'immagine di un ospite non ammesso sparisce anche se ha una voce', tutteLeFoto(x).some((t) => t.includes(F.FOTO.gruppo)), false)
}
{
  const html = (testo, immagini) => g.generaSito({ dominio: F.DOMINIO, pagine: [{ slug: 'chi-siamo', titolo: 'T', descrizione: 'd', testo }], menu: [], rinvii: [], ospitiImmagini: [P], ...(immagini ? { immagini } : {}) })['chi-siamo/index.html'] ?? ''
  const nome = '40ae8db3-5d53-4075-a708-134f0cef6e81.png'
  const t = tagDi(html(`<h2>Titolo</h2><p>x</p><img src="${src(nome)}" alt="Cubi">`, { [src(nome)]: { larghezza: 1000, altezza: 500 } }), nome)
  ok('una foto nel testo di una pagina qualunque: misure ridotte di /render/image', [attr(t, 'src'), attr(t, 'srcset')], [render(nome, 800), [480, 800, 1200].map((w) => `${render(nome, w)} ${w}w`).join(', ')])
  ok('…sizes, alt, width e height', [!!attr(t, 'sizes'), attr(t, 'alt'), attr(t, 'width'), attr(t, 'height')], [true, 'Cubi', '1000', '500'])
}

console.log('\n4. Il pannello col database: la cache di un anno all\'upload')
{
  let S = {}
  try { S = await carica('src/lib/segreteriaSupabase.ts') } catch (e) { console.log(`  (non si carica src/lib/segreteriaSupabase.ts: ${e.message})`) }
  const reg = []
  const db = { storage: { from: () => ({ upload: async (nome, _file, opz) => (reg.push([opz?.cacheControl, opz?.upsert]), { data: { path: nome }, error: null }) }) } }
  const seg = typeof S.creaSegreteriaSupabase === 'function' ? S.creaSegreteriaSupabase(db) : {}
  try { await seg.caricaImmagineSito(new File([new Uint8Array(1000)], 'f.jpg', { type: 'image/jpeg' })) } catch (e) { reg.push(`errore: ${e.message}`) }
  ok('l\'originale entra con la cache di un anno, senza sovrascrivere', reg, [['31536000', false]])
}

console.log(guai ? `\n✗ ${guai} casi falliti` : '\nTutto a posto.')
process.exit(guai ? 1 : 0)
