// ---------------------------------------------------------------------------
// «Entra con Google» sulla porta del personale, senza browser né rete.
//
//   node scripts/prova-accesso-google.mjs
//
// Il tasto parte per Google; al ritorno, se l'account non è di nessuno del
// personale (la porta si vede solo allora) la sessione si chiude e si dice
// perché, coi testi del personale (mai «usa il codice via email», che è degli
// iscritti). Chi invece è del personale entra da sé: lo fa `account()`.
// ---------------------------------------------------------------------------
import { build } from 'esbuild'
import { readFileSync } from 'node:fs'

let guai = 0
const ok = (cosa, avuto, voluto) => {
  const va = JSON.stringify(avuto) === JSON.stringify(voluto)
  console.log(va ? '  ✓' : '  ✗', cosa, va ? '' : `— atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`)
  if (!va) guai++
}

globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} }
const { outputFiles } = await build({
  stdin: { contents: `export * from './src/lib/accesso'`, resolveDir: '.', loader: 'ts' },
  bundle: true, format: 'esm', write: false, logLevel: 'error', define: { 'import.meta.env': '{}' },
})
const m = await import('data:text/javascript;base64,' + Buffer.from(outputFiles[0].text).toString('base64'))

const base = 'https://ods.example/segreteria/'
// `persona`: la riga in `persone` (o `null`); `guasto`: la lettura che cade (rete, server).
const finto = ({ sessione = true, oauthErrore = null, persona = null, guasto = false } = {}) => {
  const chiamate = { signOut: 0, oauth: null }
  const c = {
    rpc: async () => ({ data: null, error: null }),
    from: (tabella) => {
      const q = { select: () => q, eq: () => q }
      q.maybeSingle = async () =>
        guasto ? { data: null, error: { message: 'boom' } } : { data: tabella === 'persone' ? persona : null, error: null }
      return q
    },
    auth: {
      getSession: async () => ({ data: { session: sessione ? { user: { id: 'u1' } } : null } }),
      signOut: async () => void chiamate.signOut++,
      signInWithOAuth: async (o) => ((chiamate.oauth = o), { error: oauthErrore }),
    },
  }
  return { c, chiamate }
}

console.log('\nIl tasto')
{
  const { c, chiamate } = finto()
  await m.accediConGoogle(base + '?x=1', async () => c)
  ok('parte per Google e torna alla stessa pagina', chiamate.oauth, { provider: 'google', options: { redirectTo: base + '?x=1' } })
}
{
  const { c } = finto({ oauthErrore: { message: 'boom 0xdead' } })
  let e
  try { await m.accediConGoogle(base, async () => c) } catch (x) { e = x.message }
  ok('se non parte, un testo del personale e non quello grezzo', e, m.GOOGLE_NON_RIUSCITO_PERSONALE)
}
{
  const { c } = finto({ oauthErrore: { status: 429 } })
  let e
  try { await m.accediConGoogle(base, async () => c) } catch (x) { e = x.message }
  ok('troppe richieste: il testo di sempre', e, 'Troppe richieste: aspetta un minuto e riprova')
}

console.log('\nIl ritorno')
const ritorno = async (indirizzo, opzioni) => {
  const { c, chiamate } = finto(opzioni)
  return [await m.dopoGoogleSenzaAccount(indirizzo, async () => c), chiamate.signOut]
}
ok('senza segni di ritorno: niente da dire, niente da chiudere', await ritorno(base), [null, 0])
ok('annullato: lo dice, e la porta resta com\'è', await ritorno(base + '?error=access_denied'), [m.GOOGLE_ANNULLATO_PERSONALE, 0])
ok('errore di Google: lo dice', await ritorno(base + '#error=server_error'), [m.GOOGLE_NON_RIUSCITO_PERSONALE, 0])
ok('ritorno senza sessione: non è riuscito', await ritorno(base + '?code=1', { sessione: false }), [m.GOOGLE_NON_RIUSCITO_PERSONALE, 0])
ok('account di nessuno del personale: dice perché e chiude la sessione', await ritorno(base + '?code=1'), [m.NON_DEL_PERSONALE, 1])
ok('il server non risponde: non si sa, la sessione resta', await ritorno(base + '?code=1', { guasto: true }), [m.GOOGLE_NON_RIUSCITO_PERSONALE, 0])
ok(
  'è del personale (la porta si è vista per un guaio passeggero): niente da dire, la sessione resta',
  await ritorno(base + '?code=1', { persona: { id: 'p', nome: 'A', cognome: 'B', ruolo: 'staff' } }),
  [null, 0],
)
ok('i testi del personale non mandano al codice via email', [m.GOOGLE_ANNULLATO_PERSONALE, m.GOOGLE_NON_RIUSCITO_PERSONALE, m.NON_DEL_PERSONALE].some((t) => /codice/i.test(t)), false)

console.log('\nLa porta')
const porta = readFileSync('src/components/Porta.tsx', 'utf8')
ok('il tasto non c\'è nella pagina del consenso a Claude, né dalla Home', /!collega && googleDisponibile\(daHome\)/.test(porta), true)
ok('il ritorno si legge una volta sola, e non nella pagina del consenso', /const da = arrivoGoogle\s+arrivoGoogle = null\s+if \(!da \|\| collega\) return/.test(porta), true)

console.log(guai ? `\n${guai} da correggere` : '\nTutto in ordine')
process.exit(guai ? 1 : 0)
