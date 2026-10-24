// ---------------------------------------------------------------------------
// La Content-Security-Policy delle pagine, senza browser.
//
//   node scripts/prova-csp.mjs
//
// GitHub Pages non dà header: la regola sta in una <meta> (`src/lib/csp.ts`,
// messa nelle pagine da vite.config.ts). Qui si prova che resti stretta.
// ---------------------------------------------------------------------------
import { build } from 'esbuild'

const { outputFiles } = await build({ entryPoints: ['src/lib/csp.ts'], bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent' })
const { politicaCsp, senzaImportEsterni } = await import('data:text/javascript;base64,' + Buffer.from(outputFiles[0].text).toString('base64'))

let guai = 0
const ok = (cosa, avuto, voluto) => {
  const va = JSON.stringify(avuto) === JSON.stringify(voluto)
  console.log(va ? '  ✓' : '  ✗', cosa, va ? '' : `— atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`)
  if (!va) guai++
}
const direttiva = (p, nome) => p.split(';').map((d) => d.trim().split(/\s+/)).find((d) => d[0] === nome)?.slice(1)

const p = politicaCsp('https://abc.supabase.co')
ok('niente codice dentro la pagina né eval', direttiva(p, 'script-src')?.some((s) => /unsafe/.test(s)), false)
ok('object-src è chiuso', direttiva(p, 'object-src'), ["'none'"])
ok('base-uri e form-action restano della pagina', [direttiva(p, 'base-uri'), direttiva(p, 'form-action')], [["'self'"], ["'self'"]])
ok('default-src è la pagina', direttiva(p, 'default-src'), ["'self'"])
ok('il database è raggiungibile, anche in tempo reale', direttiva(p, 'connect-src')?.filter((s) => s.includes('supabase')), ['https://abc.supabase.co', 'wss://abc.supabase.co'])
ok('un database con dominio suo si legge dall’indirizzo', direttiva(politicaCsp('https://db.palestra.it/rest/v1'), 'connect-src')?.includes('https://db.palestra.it'), true)
ok('senza database (modalità prova) non resta un indirizzo mezzo scritto', direttiva(politicaCsp(undefined), 'connect-src')?.some((s) => s.includes('undefined')), false)
ok('un indirizzo che non è un indirizzo non apre niente', direttiva(politicaCsp('boh'), 'connect-src')?.filter((s) => s !== "'self'" && !s.includes('spotify')), [])
ok('nessuna direttiva che una <meta> ignora', /frame-ancestors|report-uri|sandbox/.test(p), false)

ok('un @import di un altro sito si toglie', senzaImportEsterni('@import "https://rsms.me/inter/inter.css";:root{--a:1}'), ':root{--a:1}')
ok('anche scritto con url() e senza spazi', senzaImportEsterni('@import url("https://x.it/a.css");a{b:c}'), 'a{b:c}')
ok('un @import dei nostri file resta', senzaImportEsterni('@import "./a.css";a{b:c}'), '@import "./a.css";a{b:c}')

console.log(guai ? `\n${guai} COSE NON TORNANO` : '\nTUTTO A POSTO')
process.exit(guai ? 1 : 0)
