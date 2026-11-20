// ---------------------------------------------------------------------------
// L'elenco delle persone non finge di essere completo, senza browser.
//
//   node scripts/prova-persone-incomplete.mjs
//
// `persone()` (src/lib/segreteriaSupabase.ts) mette insieme le persone con i
// pagamenti Satispay, le quote delle ricevute e le date di nascita. Se una di
// quelle letture non riesce (rete, server), chi ha pagato sembrerebbe ancora da
// incassare: l'app deve dire «dati incompleti» e cosa fare, non un elenco che
// sembra a posto. Una tabella che il database non ha ancora (il file SQL non è
// passato) resta invece un ripiego voluto: l'elenco si vede come prima.
// ---------------------------------------------------------------------------
process.env.TZ = 'Europe/Rome'

import { build } from 'esbuild'

const memoria = new Map()
globalThis.localStorage = {
  getItem: (k) => (memoria.has(k) ? memoria.get(k) : null),
  setItem: (k, v) => memoria.set(k, String(v)),
  removeItem: (k) => memoria.delete(k),
}
globalThis.window = { location: { search: '', hash: '' }, addEventListener() {} }

const { outputFiles } = await build({
  stdin: { contents: "export { creaSegreteriaSupabase } from './src/lib/segreteriaSupabase'", resolveDir: '.', loader: 'ts' },
  bundle: true, format: 'esm', write: false, logLevel: 'silent', define: { 'import.meta.env': '{}' },
})
const m = await import('data:text/javascript;base64,' + Buffer.from(outputFiles[0].text).toString('base64'))

let guai = 0
const ok = (cosa, avuto, voluto) => {
  const va = JSON.stringify(avuto) === JSON.stringify(voluto)
  console.log(va ? '  ✓' : '  ✗', cosa, va ? '' : `— atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`)
  if (!va) guai++
}

// Un database finto: ogni catena di query risponde con quel che dice la sua tabella, solo alla prima pagina.
const finto = (tabelle) => {
  const catena = (t, pagina = 0) => new Proxy({}, {
    get: (_, k) => k === 'then'
      ? (bene, male) => Promise.resolve(tabelle[t]?.error ? { data: null, error: tabelle[t].error } : { data: pagina === 0 ? (tabelle[t]?.data ?? []) : [], error: null }).then(bene, male)
      : (...a) => catena(t, k === 'range' ? a[0] : pagina),
  })
  return { from: (t) => catena(t), rpc: async () => ({ data: null, error: null }) }
}
const laura = { id: 'laura', nome: 'Laura', cognome: 'Rossi', email: null, telefono: null, attiva: true, creata_il: '2026-09-01T10:00:00Z', iscrizioni: [], schede_iscritti: null }
const leggi = async (tabelle) => {
  try { return await m.creaSegreteriaSupabase(finto({ persone: { data: [laura] }, ...tabelle })).persone() } catch (e) { return `errore: ${e.message}` }
}
const RETE = { code: '', message: 'TypeError: Failed to fetch' }
const SERVER = { code: '500', message: 'internal server error' }
const MANCA = { code: '42P01', message: 'relation "x" does not exist' }
const NONCE = { code: 'PGRST205', message: "Could not find the table 'public.x' in the schema cache" }

const incompleto = (r) => typeof r === 'string' && r.includes('Dati incompleti')
const diceCosaFare = (r) => typeof r === 'string' && /Ricarica la pagina/.test(r)
const grezzo = (r) => typeof r === 'string' && /Failed to fetch|internal server error|PGRST|relation/.test(r)

console.log('\n1. Tutto si legge: l\'elenco c\'è')
{
  const r = await leggi({})
  ok('Laura c\'è', Array.isArray(r) ? r.map((p) => p.id) : r, ['laura'])
}

console.log('\n2. I pagamenti Satispay non si leggono: dati incompleti')
for (const [come, errore] of [['senza rete', RETE], ['il server sbaglia', SERVER]]) {
  const r = await leggi({ pagamenti_satispay: { error: errore } })
  ok(`${come}: lo dice`, incompleto(r), true)
  ok(`${come}: dice cosa fare`, diceCosaFare(r), true)
  ok(`${come}: senza il testo grezzo`, grezzo(r), false)
  ok(`${come}: nomina Satispay`, typeof r === 'string' && /Satispay/.test(r), true)
}

console.log('\n3. Le quote non si leggono: dati incompleti')
{
  const vista = await leggi({ quote_ricevute: { error: SERVER } })
  ok('la vista delle quote sbaglia: lo dice', incompleto(vista), true)
  ok('…e nomina le quote', typeof vista === 'string' && /quote/.test(vista), true)
  ok('…senza il testo grezzo', grezzo(vista), false)
  const tutteDue = await leggi({ quote_ricevute: { error: NONCE }, ricevute: { error: RETE } })
  ok('vista che non c\'è e ricevute che non si leggono: lo dice', incompleto(tutteDue), true)
}

console.log('\n4. Le date di nascita non si leggono: dati incompleti')
{
  const an = await leggi({ anagrafiche: { error: SERVER } })
  ok('le anagrafiche sbagliano: lo dice', incompleto(an), true)
  ok('…e nomina le date di nascita', typeof an === 'string' && /date di nascita/.test(an), true)
  const rich = await leggi({ richieste_iscrizione: { error: RETE } })
  ok('le richieste sbagliano: lo dice', incompleto(rich), true)
}

console.log('\n5. Le tabelle che il database non ha ancora restano un ripiego: l\'elenco si vede')
{
  const r = await leggi({ pagamenti_satispay: { error: MANCA }, anagrafiche: { error: NONCE }, richieste_iscrizione: { error: MANCA } })
  ok('senza Satispay e anagrafiche: Laura c\'è', Array.isArray(r) ? r.map((p) => p.id) : r, ['laura'])
  const q = await leggi({ quote_ricevute: { error: NONCE } })
  ok('senza la vista delle quote: le quote dalle ricevute, Laura c\'è', Array.isArray(q) ? q.map((p) => p.id) : q, ['laura'])
  const senzaRicevute = await leggi({ quote_ricevute: { error: NONCE }, ricevute: { error: MANCA } })
  ok('senza vista né ricevute sul database: Laura c\'è, senza quote', Array.isArray(senzaRicevute) ? senzaRicevute.map((p) => [p.id, p.quote]) : senzaRicevute, [['laura', []]])
}

console.log('\n6. Se non si leggono nemmeno le persone, le altre letture non restano rifiuti senza nessuno che li guardi')
{
  let senzaGestore = 0
  const conta = () => senzaGestore++
  process.on('unhandledRejection', conta)
  const r = await leggi({ persone: { error: SERVER }, quote_ricevute: { error: SERVER }, anagrafiche: { error: SERVER } })
  await new Promise((fatto) => setTimeout(fatto, 50))
  process.off('unhandledRejection', conta)
  ok('l\'elenco non si legge: lo dice', typeof r === 'string' && r.startsWith('errore:'), true)
  ok('nessun rifiuto senza gestore', senzaGestore, 0)
}

console.log(guai ? `\n${guai} ${guai === 1 ? 'cosa non torna' : 'cose non tornano'}` : '\nTUTTO A POSTO')
process.exit(guai ? 1 : 0)
