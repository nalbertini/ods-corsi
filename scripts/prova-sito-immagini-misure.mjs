// Le foto del sito escono in più misure: l'originale pesa 200–300 KB e il
// telefono ne mostra una frazione. `conCaricamento` le serve da /render/image
// (ridimensionate e con la cache di Supabase) con `srcset` e `sizes`.
//
//   node scripts/prova-sito-immagini-misure.mjs
import { build } from 'esbuild'

const { outputFiles } = await build({ entryPoints: ['src/lib/sitoLayout.ts'], bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent', define: { 'import.meta.env': '{}' } })
const { conCaricamento } = await import('data:text/javascript;base64,' + Buffer.from(outputFiles[0].text).toString('base64'))

let storti = 0
const ok = (cosa, avuto, voluto) => {
  const a = JSON.stringify(avuto), v = JSON.stringify(voluto)
  if (a !== v) { storti++; console.error(`✗ ${cosa}\n  avuto  ${a}\n  voluto ${v}`) } else console.log(`✓ ${cosa}`)
}

const BASE = 'https://abc.supabase.co/storage/v1'
const foto = `<img alt="Judo" src="${BASE}/object/public/sito/x-1.jpg">`
const t = conCaricamento(foto, false)
ok('src: la misura media da /render/image', /\bsrc="([^"]*)"/.exec(t)?.[1], `${BASE}/render/image/public/sito/x-1.jpg?width=800&quality=75`)
ok('srcset: tre misure', /\bsrcset="([^"]*)"/.exec(t)?.[1], ['480', '800', '1200'].map((w) => `${BASE}/render/image/public/sito/x-1.jpg?width=${w}&quality=75 ${w}w`).join(', '))
ok('sizes presente', /\bsizes="[^"]+"/.test(t), true)
ok('la prima foto resta fetchpriority high', conCaricamento(foto, true).includes('fetchpriority="high"'), true)
ok('un file del sito (/risorse) resta com\'è', conCaricamento('<img alt="x" src="/risorse/fipe.png">', false).includes('srcset'), false)
ok('un altro host resta com\'è', conCaricamento('<img alt="x" src="https://altro.it/a.jpg">', false).includes('srcset'), false)
process.exit(storti ? 1 : 0)
