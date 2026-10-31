// ---------------------------------------------------------------------------
// Le schede della pagina IMPOSTAZIONI, senza browser (`src/lib/schedeImpostazioni.ts`).
//
//   node scripts/prova-impostazioni.mjs
//
// Sette schede in ordine, la prima si apre da sé, QUESTO COMPUTER è l'ultima;
// la tastiera con il giro, come quella della scheda iscritto.
// ---------------------------------------------------------------------------
import { existsSync, readFileSync } from 'node:fs'
import { build } from 'esbuild'

// Il modulo che manca è una prova che fallisce, non un errore di build.
let m = {}
if (existsSync('src/lib/schedeImpostazioni.ts')) {
  const { outputFiles } = await build({
    stdin: { contents: "export * from './src/lib/schedeImpostazioni'", resolveDir: '.', loader: 'ts' },
    bundle: true,
    format: 'esm',
    write: false,
    logLevel: 'error',
    define: { 'import.meta.env': '{}' },
  })
  m = await import('data:text/javascript;base64,' + Buffer.from(outputFiles[0].text).toString('base64'))
}

let guai = 0
const ok = (cosa, avuto, voluto) => {
  const va = JSON.stringify(avuto) === JSON.stringify(voluto)
  console.log(va ? '  ✓' : '  ✗', cosa, va ? '' : `— atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`)
  if (!va) guai++
}
const f = (nome, ...args) => (typeof m[nome] === 'function' ? m[nome](...args) : `manca ${nome}()`)

const schede = m.SCHEDE_IMPOSTAZIONI ?? []

console.log('Le schede, in ordine')
ok('nove, in ordine', schede.map((s) => s.id), ['stagione', 'sale', 'esercizi', 'ricevute', 'pagamenti', 'avvisi', 'dati', 'importa', 'computer'])
ok('i nomi, in maiuscolo', schede.map((s) => s.nome), ['LA STAGIONE', 'LE SALE E I TABLET', 'GLI ESERCIZI', 'LE RICEVUTE', 'COME SI PAGA', 'GLI AVVISI', 'DATI E PRIVACY', 'IMPORTA', 'QUESTO COMPUTER'])
ok('QUESTO COMPUTER è l’ultima', schede.at(-1)?.nome, 'QUESTO COMPUTER')
ok('la prima si apre senza scelta', m.SCHEDA_IMPOSTAZIONI_INIZIALE, 'stagione')

console.log('\nLa tastiera')
const t = (aperta, tasto, mod = {}) => f('tastoImpostazioni', aperta, { key: tasto, ...mod })
ok('→ passa alla successiva', t('stagione', 'ArrowRight'), 'sale')
ok('→ dall’ultima torna alla prima', t('computer', 'ArrowRight'), 'stagione')
ok('← passa alla precedente', t('avvisi', 'ArrowLeft'), 'pagamenti')
ok('← dalla prima va all’ultima', t('stagione', 'ArrowLeft'), 'computer')
ok('Home: la prima', t('dati', 'Home'), 'stagione')
ok('End: l’ultima', t('dati', 'End'), 'computer')
ok('un altro tasto: niente', [t('dati', 'Enter'), t('dati', 'ArrowDown'), t('dati', 'a')], [null, null, null])
ok('con Alt, Ctrl o Cmd: niente, la scorciatoia resta al browser', [t('dati', 'ArrowLeft', { altKey: true }), t('dati', 'ArrowRight', { ctrlKey: true }), t('dati', 'Home', { metaKey: true })], [null, null, null])

// La pagina non si prova senza browser: si legge il sorgente, per le due regole
// che, rotte, non si vedrebbero subito.
console.log('\nLa pagina')
const pagina = readFileSync('src/components/segreteria/Regole.tsx', 'utf8')
ok('ogni scheda ha il suo pannello', schede.filter((s) => !pagina.includes(`<Pannello apri={setAperta} id="${s.id}"`)).map((s) => s.id), [])
ok('i pannelli chiusi restano montati e nascosti: una sala a metà non si perde', [pagina.includes('hidden={aperta !== id}'), /aperta === '\w+' &&/.test(pagina)], [true, false])
ok('«Torna a finire» riapre la scheda della bozza', pagina.includes('<MostraBozza.Provider value={mostra}>'), true)
ok('…anche della sala, che sta fuori dai pannelli', /useBozza\([^\n]*, mostraSale\)/.test(pagina), true)

console.log(guai ? `\n${guai} ${guai === 1 ? 'cosa non torna' : 'cose non tornano'}` : '\nTUTTO A POSTO')
process.exit(guai ? 1 : 0)
