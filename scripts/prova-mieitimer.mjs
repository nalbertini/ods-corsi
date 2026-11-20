// ---------------------------------------------------------------------------
// I MIEI TIMER non mostrano il testo grezzo del database (issue #905): quando
// una lettura o un collegamento non va, l'errore che arriva a video è la
// frase di src/lib/guaio.ts per il personale, mai quella di Supabase.
//
//   node scripts/prova-mieitimer.mjs
// ---------------------------------------------------------------------------
import { build } from 'esbuild'

let guai = 0
const ok = (cosa, avuto, voluto) => {
  const va = JSON.stringify(avuto) === JSON.stringify(voluto)
  console.log(va ? '  ✓' : '  ✗', cosa, va ? '' : `— atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`)
  if (!va) guai++
}

const { outputFiles } = await build({
  stdin: {
    contents: "export { conDatabase } from './src/lib/mieiTimer.ts'; export { fraseGuaio } from './src/lib/guaio.ts'",
    resolveDir: '.',
    loader: 'ts',
  },
  bundle: true,
  format: 'esm',
  platform: 'node',
  write: false,
  logLevel: 'error',
  define: { 'import.meta.env': '{}' },
})
const { conDatabase, fraseGuaio } = await import('data:text/javascript;base64,' + Buffer.from(outputFiles[0].text).toString('base64'))

if (typeof conDatabase !== 'function') {
  console.log('  ✗ src/lib/mieiTimer.ts non esporta conDatabase: la parte col database non si prova')
  process.exit(1)
}

// Un database finto: ogni catena (from().select().order(), upsert, delete().eq()…)
// finisce con la risposta che dà Supabase, { data, error }.
function dbCon(error) {
  const catena = new Proxy(
    {},
    {
      get(_, nome) {
        if (nome === 'then') return (fatto) => fatto({ data: null, error })
        return () => catena
      },
    },
  )
  return { from: () => catena }
}

// Il grezzo va in console.error: qui non serve vederlo.
console.error = () => {}

const RETE = fraseGuaio({ message: 'TypeError: Failed to fetch' })
const PERMESSO = fraseGuaio({ code: '42501' })

const casi = [
  ['senza rete', { message: 'TypeError: Failed to fetch', details: '', hint: '', code: '' }, RETE],
  ['senza permesso (42501)', { message: 'permission denied for table timer', details: null, hint: null, code: '42501' }, PERMESSO],
]

async function messaggio(f) {
  try {
    await f()
    return 'nessun errore'
  } catch (e) {
    return e instanceof Error ? e.message : String(e)
  }
}

for (const [nome, errore, frase] of casi) {
  console.log(`\nI miei timer, ${nome}`)
  const d = conDatabase(dbCon(errore), 'io')
  ok('leggere i timer dà la frase per il personale', await messaggio(() => d.timer()), frase)
  ok('leggere i collegamenti dà la frase per il personale', await messaggio(() => d.collegamenti()), frase)
  ok('collegare un timer a un corso dà la frase', await messaggio(() => d.collegaCorso('c1', 't1', true)), frase)
  ok('scollegarlo dal corso dà la frase', await messaggio(() => d.collegaCorso('c1', 't1', false)), frase)
  ok('collegare un timer a una lezione dà la frase', await messaggio(() => d.collegaLezione('l1', 't1', true)), frase)
  ok('scollegarlo dalla lezione dà la frase', await messaggio(() => d.collegaLezione('l1', 't1', false)), frase)
}

// Una tabella per volta può dare il suo errore: le altre rispondono vuote.
function dbPer(errori) {
  const catena = (error) =>
    new Proxy(
      {},
      {
        get(_, nome) {
          if (nome === 'then') return (fatto) => fatto({ data: error ? null : [], error })
          return () => catena(error)
        },
      },
    )
  return { from: (tabella) => catena(errori[tabella] ?? null) }
}

const MANCA = { message: 'relation "public.sessioni_timer" does not exist', details: null, hint: null, code: '42P01' }

console.log('\nI miei timer, prima che ci sia 11-timer-lezioni.sql')
{
  const d = conDatabase(dbPer({ sessioni_timer: MANCA }), 'io')
  ok('senza la tabella delle lezioni i collegamenti si leggono, senza lezioni', await d.collegamenti(), { corsi: {}, lezioni: {}, lezioniPronte: false })
  const c = conDatabase(dbPer({ corsi_timer: { ...MANCA, message: 'relation "public.corsi_timer" does not exist' } }), 'io')
  ok('senza la tabella dei corsi dice che la funzione non è attiva', await messaggio(() => c.collegamenti()), fraseGuaio({ code: '42P01' }))
}

console.log('\nI miei timer, un errore che guaio.ts non conosce')
{
  const d = conDatabase(dbCon({ message: 'JSON object requested, multiple (or no) rows returned', details: null, hint: null, code: 'PGRST116' }), 'io')
  const m = await messaggio(() => d.timer())
  ok('non mostra il testo del database', m.includes('JSON object'), false)
  ok('mostra la frase di ripiego', m, 'Non è andata: riprova fra poco')
}

console.log('\nLe frasi sono quelle giuste, non il ripiego')
ok('senza rete dice di controllare la connessione', RETE, 'Non si collega: controlla la connessione e riprova')
ok('senza permesso dice di uscire e rientrare', PERMESSO, "Non hai il permesso di farlo. Esci e rientra; se ricapita, avvisa chi cura l'app")

console.log(guai ? `\n${guai} prove fallite` : '\nTutto a posto')
process.exit(guai ? 1 : 0)
