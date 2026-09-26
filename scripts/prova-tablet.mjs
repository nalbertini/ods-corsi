// ---------------------------------------------------------------------------
// Le regole del tablet di sala, provate senza browser.
//
//   node scripts/prova-tablet.mjs
//
// Il tablet di prova rifà in TypeScript le regole di `supabase/04-tablet.sql`:
// le finestre di tempo, l'annullo, il PIN, il tablet che non scavalca
// l'istruttore. Qui si controlla che le rifaccia uguali, spostando l'orologio
// come si fa dall'indirizzo con `?adesso=`. Le stesse cose, dal lato del
// database, le prova `supabase/prova/tablet.sql`.
// ---------------------------------------------------------------------------
import { build } from 'esbuild'

const { outputFiles } = await build({
  stdin: {
    contents: "export * from './src/lib/tabletProva'; export { sigle } from './src/lib/tablet'",
    resolveDir: '.',
    loader: 'ts',
  },
  bundle: true,
  format: 'esm',
  write: false,
  logLevel: 'error',
  // Senza Vite `import.meta.env` non c'è: vuoto vuol dire «modalità prova».
  define: { 'import.meta.env': '{}' },
})
const modulo = 'data:text/javascript;base64,' + Buffer.from(outputFiles[0].text).toString('base64')

const memoria = new Map()
globalThis.localStorage = {
  getItem: (k) => (memoria.has(k) ? memoria.get(k) : null),
  setItem: (k, v) => memoria.set(k, String(v)),
  removeItem: (k) => memoria.delete(k),
}
globalThis.window = { location: { search: '', hash: '' }, addEventListener() {} }
/** Un tablet nuovo con l'orologio fermo a quest'ora. */
const alle = async (quando, sala = 'Lotta') => {
  window.location.search = `?adesso=${quando}`
  const t = m.creaTabletProva()
  await t.scegliSala(sala)
  return t
}

const m = await import(modulo)
let guai = 0
const ok = (cosa, avuto, voluto) => {
  const va = JSON.stringify(avuto) === JSON.stringify(voluto)
  console.log(va ? '  ✓' : '  ✗', cosa, va ? '' : `— atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`)
  if (!va) guai++
}
const errore = async (f) => {
  try {
    await f()
    return 'nessun errore'
  } catch (e) {
    return e.message
  }
}

// Lotta 2 è lunedì, mercoledì e venerdì alle 17 nella sala Lotta.
// Mercoledì 23 settembre 2026.
const LEZIONE = 's@lotta-2@2026-09-23@17:00'

console.log('\n1. la sala e il calendario')
{
  const t = await alle('2026-09-23T16:40')
  const l = await t.lezioni(new Date(2026, 8, 23), new Date(2026, 8, 23))
  ok('le lezioni di mercoledì in Lotta', l.map((x) => x.corso), ['Lotta 2', 'Lotta 3'])
  const tatami = await alle('2026-09-23T16:40', 'Tatami')
  ok('una lezione di un\'altra sala', await errore(() => tatami.elenco(LEZIONE)), "lezione di un'altra sala")
}

console.log('\n2. le finestre di tempo')
{
  const presto = await alle('2026-09-23T16:20')
  ok('41 minuti prima: l\'elenco non si apre', await errore(() => presto.elenco(LEZIONE)), 'lezione fuori dalla finestra del tablet')
  const t = await alle('2026-09-23T16:40')
  const nomi = await t.elenco(LEZIONE)
  ok('20 minuti prima: l\'elenco c\'è', nomi.length, 12)
  ok('solo nome e sigla', Object.keys(nomi[0]).sort(), ['nome', 'personaId', 'segnato', 'sigla'])
  ok('20 minuti prima si segna dal tablet', await t.segna(LEZIONE, nomi[0].personaId), 'segnata')
  ok('due volte: è già fra i presenti', await t.segna(LEZIONE, nomi[0].personaId), 'gia')
  // Le presenze le segnano anche gli allievi: a lezione in corso il tablet non si chiude.
  const inCorso = await alle('2026-09-23T17:25')
  ok('a lezione in corso si segna ancora dal tablet', await inCorso.segna(LEZIONE, nomi[1].personaId), 'segnata')
  const tardi = await alle('2026-09-23T18:15')
  ok('un quarto d\'ora dopo la fine: è un recupero', await tardi.segna(LEZIONE, nomi[3].personaId), 'segnata')
  const lontano = await alle('2026-10-09T18:00')
  ok('dopo 16 giorni non si recupera più', await errore(() => lontano.segna(LEZIONE, nomi[2].personaId)), 'fuori orario: la lezione non si può segnare adesso')
  const pin = await alle('2026-09-23T18:20')
  const appello = await pin.appello('2468', LEZIONE)
  ok('l\'appello sa da dove arriva', appello.filter((r) => r.stato).map((r) => r.origine).sort(), ['recupero', 'tablet', 'tablet'])
}

console.log('\n3. ANNULLA')
{
  const t = await alle('2026-09-23T16:50')
  const [, , p] = await t.elenco(LEZIONE)
  await t.segna(LEZIONE, p.personaId)
  ok('subito dopo si annulla', await t.annulla(LEZIONE, p.personaId), true)
  ok('e non è più segnato', (await t.elenco(LEZIONE)).find((x) => x.personaId === p.personaId).segnato, false)
  await t.segna(LEZIONE, p.personaId)
  const dopo = await alle('2026-09-23T16:53')
  ok('tre minuti dopo no', await dopo.annulla(LEZIONE, p.personaId), false)
  const altro = await alle('2026-09-23T16:50', 'Tatami')
  ok('un altro tablet non annulla', await errore(() => altro.annulla(LEZIONE, p.personaId)), "lezione di un'altra sala")
}

console.log('\n4. il tablet non scavalca l\'istruttore')
{
  const t = await alle('2026-09-23T16:55')
  const [, , , q] = await t.elenco(LEZIONE)
  ok('l\'istruttore lo segna assente', await t.correggi('2468', LEZIONE, q.personaId, 'assente'), true)
  ok('dal tablet resta assente', await t.segna(LEZIONE, q.personaId), 'istruttore')
  ok('e il segno dell\'istruttore non si toglie', await t.correggi('2468', LEZIONE, q.personaId, null), true)
  ok('è ancora assente', (await t.appello('2468', LEZIONE)).find((r) => r.personaId === q.personaId).stato, 'assente')
}

console.log('\n5. il PIN')
{
  const t = await alle('2026-09-23T16:55')
  ok('giusto', await t.entraConPin('1234'), { personaId: 'i-maurizio', nome: 'Maurizio' })
  ok('sbagliato', await t.entraConPin('0000'), null)
  ok('sbagliato, l\'appello è vuoto', await t.appello('0000', LEZIONE), [])
  ok('sbagliato, niente correzioni', await t.correggi('0000', LEZIONE, 'x', 'presente'), false)
  await t.entraConPin('0000')
  await t.entraConPin('0000')
  ok('al sesto: bloccato, anche col PIN giusto', await errore(() => t.entraConPin('1234')), 'troppi PIN sbagliati: riprova fra qualche minuto')
}

console.log('\n6. le sigle')
{
  const s = m.sigle([
    { nome: 'Giulia', cognome: 'Ferrari' },
    { nome: 'Giulia', cognome: 'Fontana' },
    { nome: 'Tommaso', cognome: 'De Luca' },
  ]).map((p) => p.sigla)
  ok('omonimi con la stessa iniziale', s, ['Fer.', 'Fon.', 'D.'])
}

console.log(guai ? `\n${guai} COSE NON TORNANO` : '\nTUTTO A POSTO')
process.exit(guai ? 1 : 0)
