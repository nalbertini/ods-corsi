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
const PAYPAL = ['https://www.paypal.com', 'https://*.paypal.com', 'https://*.paypalobjects.com']
ok('un indirizzo che non è un indirizzo non apre niente', direttiva(politicaCsp('boh'), 'connect-src')?.filter((s) => s !== "'self'" && !s.includes('spotify') && !PAYPAL.includes(s) && s !== 'https://pay.google.com'), [])
ok('nessuna direttiva che una <meta> ignora', /frame-ancestors|report-uri|sandbox/.test(p), false)

// La carta nel modulo di iscrizione (PayPal: campi carta ospitati, Apple Pay, Google Pay): solo questi domini.
const ospiti = (nome) => direttiva(p, nome) ?? []
for (const dir of ['script-src', 'connect-src', 'frame-src'])
  ok(`${dir}: PayPal e i suoi file`, ['https://www.paypal.com', 'https://*.paypal.com', 'https://*.paypalobjects.com'].map((h) => ospiti(dir).includes(h)), [true, true, true])
ok('Google Pay: gli script e il riquadro', [ospiti('script-src').includes('https://pay.google.com'), ospiti('frame-src').includes('https://pay.google.com')], [true, true])
ok('Google Pay: le chiamate', ospiti('connect-src').some((h) => h === 'https://pay.google.com' || h === 'https://*.google.com'), true)
ok('Apple Pay', ospiti('script-src').includes('https://applepay.cdn-apple.com') || ospiti('connect-src').includes('https://applepay.cdn-apple.com'), true)
// Host scritti per intero: un'espressione su «google» lascerebbe passare anche «google.evil.it».
ok('la carta non apre altro: script-src', ospiti('script-src'),
  ["'self'", 'https://www.youtube.com', 'https://s.ytimg.com', ...PAYPAL, 'https://pay.google.com', 'https://applepay.cdn-apple.com'])
ok('la carta non apre altro: frame-src', ospiti('frame-src'),
  ['https://www.youtube-nocookie.com', 'https://www.youtube.com', ...PAYPAL, 'https://pay.google.com'])
ok('la carta non apre altro: connect-src', ospiti('connect-src'),
  ["'self'", 'https://accounts.spotify.com', 'https://api.spotify.com', ...PAYPAL, 'https://pay.google.com', 'https://abc.supabase.co', 'wss://abc.supabase.co'])
ok('niente codice dentro la pagina anche con la carta', ospiti('script-src').some((x) => /unsafe/.test(x)), false)
ok('object-src e base-uri restano chiusi con la carta', [direttiva(p, 'object-src'), direttiva(p, 'base-uri')], [["'none'"], ["'self'"]])

ok('un @import di un altro sito si toglie', senzaImportEsterni('@import "https://rsms.me/inter/inter.css";:root{--a:1}'), ':root{--a:1}')
ok('anche scritto con url() e senza spazi', senzaImportEsterni('@import url("https://x.it/a.css");a{b:c}'), 'a{b:c}')
ok('un @import dei nostri file resta', senzaImportEsterni('@import "./a.css";a{b:c}'), '@import "./a.css";a{b:c}')

console.log(guai ? `\n${guai} COSE NON TORNANO` : '\nTUTTO A POSTO')
process.exit(guai ? 1 : 0)
