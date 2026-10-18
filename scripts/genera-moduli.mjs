// ---------------------------------------------------------------------------
// I fogli di public/moduli/ (autorizzazioni e costi), ricostruiti dal codice.
//
//   node scripts/genera-moduli.mjs [--oggi AAAA-MM-GG]
//
// `src/lib/fogliModuli.ts` disegna i fogli; qui si danno i font (dati/moduli/fonts),
// i loghi (dati/moduli) e il giorno, che decide se il foglio dei costi ha
// ancora il prezzo a saldo. Senza `--oggi` è oggi. Da lanciare quando cambia
// `costi.ts`, le parole di un foglio o il suo aspetto, e da committare.
// ---------------------------------------------------------------------------
import { build } from 'esbuild'
import { readFileSync, writeFileSync } from 'node:fs'
import fontkit from '@pdf-lib/fontkit'

const { outputFiles } = await build({
  stdin: { contents: "export { generaFogli } from './src/lib/fogliModuli'", resolveDir: '.', loader: 'ts' },
  bundle: true,
  format: 'esm',
  platform: 'node',
  write: false,
  logLevel: 'error',
  define: { 'import.meta.env': '{}' },
})
const { generaFogli } = await import('data:text/javascript;base64,' + Buffer.from(outputFiles[0].text).toString('base64'))

const i = process.argv.indexOf('--oggi')
const oggi = i > 0 ? process.argv[i + 1] : new Date().toISOString().slice(0, 10)
if (!/^\d{4}-\d{2}-\d{2}$/.test(oggi)) {
  console.error('--oggi vuole una data come 2026-10-18')
  process.exit(1)
}

const leggi = (p) => new Uint8Array(readFileSync(p))
const fogli = await generaFogli({
  fontkit,
  fonts: {
    titolo: leggi('dati/moduli/fonts/big-shoulders-display-800.ttf'),
    corpo: leggi('dati/moduli/fonts/inter-regular.ttf'),
    corpoGrassetto: leggi('dati/moduli/fonts/inter-bold.ttf'),
  },
  loghi: { mascotte: leggi('dati/moduli/mascotte.png'), simbolo: leggi('dati/moduli/simbolo.png') },
  oggi,
})
writeFileSync('public/moduli/autorizzazioni-maggiorenni.pdf', fogli.maggiorenni)
writeFileSync('public/moduli/autorizzazioni-minori.pdf', fogli.minori)
writeFileSync('public/moduli/costi-2026-27.pdf', fogli.costi)
console.log(`Fogli scritti in public/moduli/ (oggi = ${oggi})`)
