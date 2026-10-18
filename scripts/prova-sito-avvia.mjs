// ---------------------------------------------------------------------------
// Il sito si rigenera subito, senza aspettare il giro dei cinque minuti.
//
//   node scripts/prova-sito-avvia.mjs
//
// Quando la segreteria cambia quello che il sito pubblica (PUBBLICA, indirizzo,
// nascondi, cancella, menu) l'app chiede alla funzione `sito` di Supabase di far
// partire il workflow. Cosa conta: parte solo se il cambio è riuscito, e se la
// funzione non c'è o non risponde il cambio resta fatto (il giro a tempo copre).
// ---------------------------------------------------------------------------
import { build } from 'esbuild'

const carica = async (file) => {
  try {
    const { outputFiles } = await build({
      entryPoints: [file], bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
      define: { 'import.meta.env': '{}' },
      banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(process.cwd() + '/');" },
    })
    return await import('data:text/javascript;base64,' + Buffer.from(outputFiles[0].text).toString('base64'))
  } catch (e) {
    console.log(`  (modulo mancante: ${file} — ${String(e.message).split('\n')[0]})`)
    return {}
  }
}
const sb = await carica('src/lib/segreteriaSupabase.ts')

let guai = 0
const ok = (cosa, avuto, voluto) => {
  const va = JSON.stringify(avuto) === JSON.stringify(voluto)
  console.log(va ? '  ✓' : '  ✗', cosa, va ? '' : `— atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`)
  if (!va) guai++
}

const risposta = (r) => ({ ...r, then: (f, ko) => Promise.resolve(r).then(f, ko) })
const buono = { data: 1, error: null }
const rifiuto = { data: null, error: { code: 'P0001', message: 'La pagina è cambiata mentre la modificavi: ricaricala prima di pubblicare' } }

/** Un database finto: `esito` è la risposta di ogni scrittura, `funzione` cosa fa `functions.invoke`. */
function mondo(esito, funzione = async () => ({ data: { partito: true }, error: null })) {
  const chiamate = []
  const scrittura = () => ({ eq: () => ({ select: () => risposta(esito.data === 1 ? { data: [{ id: 'p1' }], error: null } : esito) }) })
  const db = {
    auth: { getSession: async () => ({ data: { session: null } }) },
    rpc: () => risposta(esito),
    from: () => ({ update: scrittura, delete: scrittura }),
    functions: { invoke: async (nome, opzioni) => { chiamate.push([nome, opzioni?.body]); return funzione() } },
  }
  return { chiamate, s: sb.creaSegreteriaSupabase(db) }
}
const errore = async (f) => { try { await f(); return 'nessun errore' } catch (e) { return e.message } }

const CAMBI = {
  'pubblica': (s) => s.pubblicaPaginaSito('p1', 1),
  'cambia indirizzo': (s) => s.cambiaIndirizzoSito('p1', 'nuovo'),
  'nascondi': (s) => s.nascondiPaginaSito('p1', true),
  'cancella': (s) => s.cancellaPaginaSito('p1'),
  'menu': (s) => s.salvaMenuSito('menu', []),
}

console.log('\nSito: dopo un cambio riuscito parte la rigenerazione')
for (const [nome, cambia] of Object.entries(CAMBI)) {
  const { chiamate, s } = mondo(buono)
  await cambia(s)
  ok(`${nome}: chiede alla funzione «sito» di partire, una volta`, chiamate, [['sito', { azione: 'avvia' }]])
}

console.log('\nSito: un cambio fallito non fa partire niente')
for (const [nome, cambia] of Object.entries(CAMBI)) {
  const { chiamate, s } = mondo(rifiuto)
  const esito = await errore(() => cambia(s))
  ok(`${nome}: l'errore arriva alla segreteria e la funzione non è chiamata`, [esito !== 'nessun errore', chiamate.length], [true, 0])
}

console.log('\nSito: se la funzione non c\'è o non risponde, il cambio resta fatto')
for (const [cosa, funzione] of [
  ['errore della funzione', async () => ({ data: null, error: { name: 'FunctionsHttpError', message: 'boom' } })],
  ['funzione che lancia', async () => { throw new Error('rete') }],
]) {
  const { chiamate, s } = mondo(buono, funzione)
  ok(`pubblica con ${cosa}: nessun errore per la segreteria`, await errore(() => s.pubblicaPaginaSito('p1', 1)), 'nessun errore')
  ok(`pubblica con ${cosa}: la funzione è stata provata`, chiamate.length, 1)
}

console.log(guai ? `\n${guai} COSE NON TORNANO` : '\nTUTTO A POSTO')
process.exit(guai ? 1 : 0)
