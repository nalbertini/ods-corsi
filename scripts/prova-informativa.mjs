// ---------------------------------------------------------------------------
// Per quanto si tengono le presenze, nell'informativa privacy, senza browser.
//
//   node scripts/prova-informativa.mjs
//
// L'informativa la legge anche chi non ha un accesso, e i mesi delle presenze
// li sceglie la segreteria in IMPOSTAZIONI: la pagina li chiede al database
// (`src/lib/informativa.ts`) e, se la risposta non è un numero di mesi
// sensato, lascia il testo scritto nella pagina, che vale sempre. Qui si
// controlla che solo un numero valido cambi il testo, che un guaio di rete o
// del database lo lasci com'è, e che il testo scritto non dica un numero.
// ---------------------------------------------------------------------------
import { build } from 'esbuild'
import { readFileSync } from 'node:fs'

const { outputFiles } = await build({
  stdin: {
    contents: "export { RIPIEGO_PRESENZE, testoPresenze, presenzeDalDatabase } from './src/lib/informativa'",
    resolveDir: '.',
    loader: 'ts',
  },
  bundle: true,
  format: 'esm',
  write: false,
  logLevel: 'error',
  define: { 'import.meta.env': '{}' },
})
const m = await import('data:text/javascript;base64,' + Buffer.from(outputFiles[0].text).toString('base64'))

let guai = 0
const ok = (cosa, avuto, voluto) => {
  const va = JSON.stringify(avuto) === JSON.stringify(voluto)
  console.log(va ? '  ✓' : '  ✗', cosa, va ? '' : `— atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`)
  if (!va) guai++
}

const RIPIEGO = 'Per il periodo stabilito dalla palestra (oggi indicato in segreteria), poi si cancellano da sole'

console.log('La risposta del database')
ok('il ripiego è quello deciso', m.RIPIEGO_PRESENZE, RIPIEGO)
ok('36 → 36 mesi', m.testoPresenze(36), '36 mesi dalla lezione, poi si cancellano da sole')
ok('24 → 24 mesi', m.testoPresenze(24), '24 mesi dalla lezione, poi si cancellano da sole')
ok('1 → 1 mese', m.testoPresenze(1), '1 mese dalla lezione, poi si cancellano da sole')
ok('120 → 120 mesi', m.testoPresenze(120), '120 mesi dalla lezione, poi si cancellano da sole')
for (const [cosa, v] of [['0', 0], ['121', 121], ['-3', -3], ['24,5', 24.5], ['"24" (testo)', '24'], ['null', null],
  ['niente', undefined], ['un oggetto', { mesi: 24 }], ['un elenco', [24]], ['NaN', NaN], ['vero', true]]) {
  ok(`${cosa} → ripiego`, m.testoPresenze(v), RIPIEGO)
}

console.log('La lettura')
const URL_PROVA = 'https://abc.supabase.co'
// Un fetch finto che ricorda cosa gli si chiede e risponde come gli si dice.
function finto(risposta) {
  const chieste = []
  const f = async (url, init) => {
    chieste.push({ url, init })
    return risposta(init)
  }
  return { f, chieste }
}
const json = (corpo, status = 200) => async () => new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } })

{
  const { f, chieste } = finto(json(36))
  ok('36 dal database → 36 mesi', await m.presenzeDalDatabase(URL_PROVA + '/rest/v1/', ' chiave ', f),
    '36 mesi dalla lezione, poi si cancellano da sole')
  ok('una richiesta sola', chieste.length, 1)
  ok('alla funzione, sull\'indirizzo del progetto', chieste[0]?.url, URL_PROVA + '/rest/v1/rpc/mesi_presenze_pubblici')
  ok('con la chiave pubblica', new Headers(chieste[0]?.init?.headers).get('apikey'), 'chiave')
  ok('senza la sessione di chi è entrato', new Headers(chieste[0]?.init?.headers).has('Authorization'), false)
}
for (const [cosa, risposta] of [
  ['0', json(0)], ['121', json(121)], ['"24"', json('24')], ['null', json(null)], ['un oggetto', json({ mesi: 24 })],
  ['la funzione che non c\'è ancora (PGRST202)', json({ code: 'PGRST202', message: 'Could not find the function' }, 404)],
  ['un errore del server', json({ message: 'boh' }, 500)],
  ['una risposta che non è JSON', async () => new Response('<html>', { status: 200 })],
  ['la rete che non va', async () => { throw new TypeError('Failed to fetch') }],
]) {
  const { f } = finto(risposta)
  ok(`${cosa} → ripiego`, await m.presenzeDalDatabase(URL_PROVA, 'chiave', f), RIPIEGO)
}
{
  // Un database che non risponde mai: si smette di aspettare, e resta il ripiego.
  const { f } = finto((init) => new Promise((_, no) => init.signal.addEventListener('abort', () => no(init.signal.reason))))
  const prima = Date.now()
  // In Node il timer di `AbortSignal.timeout` non tiene vivo il processo:
  // senza questo, Node uscirebbe prima che scatti.
  const vivo = setTimeout(() => {}, 5000)
  ok('nessuna risposta → ripiego', await m.presenzeDalDatabase(URL_PROVA, 'chiave', f, 50), RIPIEGO)
  clearTimeout(vivo)
  ok('senza aspettare troppo', Date.now() - prima < 2000, true)
}
for (const [cosa, indirizzo, chiave] of [['senza indirizzo', undefined, 'chiave'], ['con l\'indirizzo vuoto', '  ', 'chiave'], ['senza chiave', URL_PROVA, undefined]]) {
  const { f, chieste } = finto(json(36))
  ok(`${cosa} → ripiego`, await m.presenzeDalDatabase(indirizzo, chiave, f), RIPIEGO)
  ok(`${cosa}, nessuna richiesta`, chieste.length, 0)
}

console.log("L'informativa senza script")
const html = readFileSync(new URL('../informativa.html', import.meta.url), 'utf8')
const cella = /<td id="presenze-per-quanto">([^<]*)<\/td>/.exec(html)?.[1]
ok('la cella delle presenze c\'è, col ripiego', cella, RIPIEGO)
ok('nessun numero di mesi nella cella', /\d/.test(cella ?? ''), false)
ok('la pagina chiama src/lib/informativa.ts', /<script type="module">[^]*src\/lib\/informativa\.ts[^]*<\/script>/.test(html), true)

if (guai) {
  console.log(`\n${guai} cose non tornano`)
  process.exit(1)
}
console.log('\nTutto a posto')
