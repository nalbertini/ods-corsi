// ---------------------------------------------------------------------------
// La finestra delle presenze, provata senza browser.
//
//   node scripts/prova-finestra.mjs
//
// Da `supabase/52-presenze-finestra.sql`: un istruttore tocca le presenze da
// 30 minuti prima dell'inizio a 14 giorni dopo; la segreteria non ha limiti.
// Qui: la funzione pura, la modalità prova che rifà la regola, e la coda che
// davanti al rifiuto del server non lascia il segno «salvato».
// ---------------------------------------------------------------------------
import { build } from 'esbuild'

process.env.TZ = 'Europe/Rome'

const { outputFiles } = await build({
  stdin: {
    contents:
      "export * from './src/lib/finestra'; export { creaDatiProva, istruttoreDallAppello } from './src/lib/datiProva'; export { archivio } from './src/lib/archivioProva'; export { creaDatiSupabase } from './src/lib/datiSupabase'",
    resolveDir: '.',
    loader: 'ts',
  },
  bundle: true,
  format: 'esm',
  write: false,
  logLevel: 'error',
  define: { 'import.meta.env': '{}' },
})
const modulo = 'data:text/javascript;base64,' + Buffer.from(outputFiles[0].text).toString('base64')

const memoria = new Map()
globalThis.localStorage = {
  getItem: (k) => (memoria.has(k) ? memoria.get(k) : null),
  setItem: (k, v) => memoria.set(k, String(v)),
  removeItem: (k) => memoria.delete(k),
}
globalThis.window = {
  location: { search: '', hash: '', pathname: '/istruttori/' },
  addEventListener: () => {},
}
const area = (a) => { globalThis.window.location.pathname = `/${a}/` }

// Oggi, per la prova, è sabato 26 settembre 2026 a mezzogiorno.
const OGGI = new Date(2026, 8, 26, 12, 0).getTime()
const DateVera = Date
globalThis.Date = class extends DateVera {
  constructor(...a) {
    super(...(a.length ? a : [OGGI]))
  }
  static now() {
    return OGGI
  }
}

const m = await import(modulo)
let guai = 0
const ok = (cosa, avuto, voluto) => {
  const va = JSON.stringify(avuto) === JSON.stringify(voluto)
  console.log(va ? '  ✓' : '  ✗', cosa, va ? '' : `— atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`)
  if (!va) guai++
}
const prova = async (cosa, f, voluto) => {
  let avuto
  try {
    avuto = await f()
  } catch (e) {
    avuto = `ERRORE: ${e.message}`
  }
  ok(cosa, avuto, voluto)
}
const errore = async (f) => {
  try {
    await f()
    return 'nessun errore'
  } catch (e) {
    return e.message
  }
}

const MIN = 60_000
const GIORNO = 24 * 60 * MIN

console.log('\n1. la funzione: quando un istruttore può toccare le presenze')
{
  const a = (delta, senza = false) => m.appelloAperto(OGGI + delta, senza, OGGI)
  ok('fra 30 minuti: aperta', a(30 * MIN), 'aperta')
  ok('fra 31 minuti: ancora presto', a(31 * MIN), 'lontana')
  ok('domani: presto', a(GIORNO), 'lontana')
  ok('cominciata da poco: aperta', a(-10 * MIN), 'aperta')
  ok('14 giorni fa, giusti: aperta', a(-14 * GIORNO), 'aperta')
  ok('14 giorni e un minuto fa: vecchia', a(-14 * GIORNO - MIN), 'vecchia')
  ok('la segreteria non ha limiti, né dopo né prima', [a(-90 * GIORNO, true), a(10 * GIORNO, true)], ['aperta', 'aperta'])
  ok('accredita l\'ora fino a mezz\'ora prima', [m.accreditaOraIstruttore(OGGI + 30 * MIN, OGGI), m.accreditaOraIstruttore(OGGI + 31 * MIN, OGGI), m.accreditaOraIstruttore(OGGI - 20 * GIORNO, OGGI)], [true, false, true])
  ok('riconosce l\'errore del trigger, non un 42501 qualunque', [
    m.eFuoriFinestra({ code: '42501', message: m.MESSAGGIO_FUORI_FINESTRA }),
    m.eFuoriFinestra({ code: '42501', message: 'new row violates row-level security policy' }),
    m.eFuoriFinestra({ code: '', message: 'Failed to fetch' }),
  ], [true, false, false])
}

console.log('\n2. la modalità prova rifà la regola')
{
  const a = m.archivio.dati
  a.corsi.push({ id: 'fin', nome: 'Finestra', colore: '#16a54a', sala: 'Lotta', istruttori: ['i-maurizio'], attivo: true, ricorrenze: [] })
  // Una lezione straordinaria per ogni distanza dall'inizio.
  const lezione = (nome, delta) => {
    const id = `x@${nome}`
    a.lezioni = { ...a.lezioni, [id]: { straordinaria: { corsoId: 'fin', inizio: new Date(OGGI + delta).toISOString(), durata: 60 } } }
    return id
  }
  const ADESSO = lezione('adesso', -10 * MIN)
  const PRESTO = lezione('presto', 31 * MIN)
  const VECCHIA = lezione('vecchia', -15 * GIORNO)
  const LONTANA = lezione('lontana', 2 * GIORNO)
  const iscritto = a.persone.find((p) => p.ruolo === 'iscritto' && p.attiva).id
  a.iscrizioni.push({ corsoId: 'fin', personaId: iscritto, dal: '2020-01-01' })
  m.archivio.salva()
  const app = m.creaDatiProva()
  const chi = { nome: 'Mario', cognome: 'Provola', telefono: '3331234567' }
  const righe = () => m.archivio.dati.presenzeIstruttori ?? []
  const FRASE = 'La lezione è troppo vecchia o troppo lontana per cambiare le presenze: scrivete alla segreteria'

  area('istruttori')
  await prova('in finestra l\'istruttore segna, e la sua ora è accreditata', async () => (await app.segna(ADESSO, iscritto, 'presente'), (await app.dettaglio(ADESSO)).elenco.find((p) => p.id === iscritto)?.stato ?? null), 'presente')
  ok('…e la sua ora risulta', righe().some((r) => r.sessioneId === ADESSO && r.personaId === 'i-maurizio'), true)
  for (const [nome, id] of [['vecchia', VECCHIA], ['più di mezz\'ora prima', PRESTO], ['di dopodomani', LONTANA]]) {
    ok(`lezione ${nome}: segna rifiutato con la frase del server`, await errore(() => app.segna(id, iscritto, 'presente')), FRASE)
    ok(`lezione ${nome}: segnaTutti rifiutato`, await errore(() => app.segnaTutti(id, 'presente')), FRASE)
    ok(`lezione ${nome}: aggiungere chi prova rifiutato`, await errore(() => app.aggiungiProva(id, chi)), FRASE)
    ok(`lezione ${nome}: niente segni, niente ora accreditata`, [(await app.dettaglio(id)).elenco.filter((p) => p.stato).length, righe().some((r) => r.sessioneId === id)], [0, false])
  }
  ok('azzerare un segno (null) fuori finestra è rifiutato come il database', await errore(() => app.segna(VECCHIA, iscritto, null)), FRASE)

  console.log('\n   la segreteria non ha limiti')
  area('segreteria')
  await prova('segna una lezione vecchia', async () => (await app.segna(VECCHIA, iscritto, 'presente'), (await app.dettaglio(VECCHIA)).elenco.find((p) => p.id === iscritto)?.stato ?? null), 'presente')
  const prova1 = await app.aggiungiProva(VECCHIA, chi)
  ok('aggiunge chi prova su una lezione vecchia', (await app.dettaglio(VECCHIA)).elenco.some((p) => p.id === prova1.id), true)

  console.log('\n   togliere chi prova')
  area('istruttori')
  ok('con il suo segno su una lezione vecchia: rifiutato, la presenza non si tocca', await errore(() => app.togliProva(VECCHIA, prova1.id)), FRASE)
  area('segreteria')
  await app.segna(VECCHIA, prova1.id, null)
  area('istruttori')
  await prova('senza segno tocca solo `prove`: ancora permesso', async () => (await app.togliProva(VECCHIA, prova1.id), (await app.dettaglio(VECCHIA)).elenco.some((p) => p.id === prova1.id)), false)

  console.log('\n   l\'ora dell\'istruttore')
  m.archivio.dati.presenzeIstruttori = []
  area('segreteria')
  await app.segna(LONTANA, iscritto, 'presente')
  m.istruttoreDallAppello(LONTANA, 'i-maurizio')
  ok('una lezione che comincia fra più di mezz\'ora: nessuna ora accreditata, neanche da un\'altra via', righe().length, 0)
}

console.log('\n3. col database: il rifiuto non lascia il segno «salvato»')
{
  const DOVE = 'ods-corsi:coda'
  const inCoda = () => JSON.parse(memoria.get(DOVE) ?? '[]').length
  const attesa = () => new Promise((r) => setTimeout(r, 10))
  const FRASE = 'La lezione è troppo vecchia o troppo lontana per cambiare le presenze: scrivete alla segreteria'
  const tabella = (esito) => ({
    upsert: async () => esito,
    delete: () => ({ match: async () => esito }),
  })
  const database = (esito) => ({ from: () => tabella(esito), rpc: async () => esito })
  const fuori = { error: { code: '42501', message: FRASE } }
  const negato = { error: { code: '42501', message: 'new row violates row-level security policy for table "presenze"' } }

  memoria.delete(DOVE)
  const d = m.creaDatiSupabase(database(fuori))
  let scartate = 0
  const fuoriFinestra = []
  d.guardaScartate?.((n) => { scartate = n })
  d.guardaFuoriFinestra?.((s) => (fuoriFinestra.push(s), true))
  await d.segna('s1', 'p1', 'presente')
  await attesa()
  ok('il rifiuto della finestra: la coda si svuota', inCoda(), 0)
  ok('…dice a chi guarda quale lezione (così si rilegge)', fuoriFinestra, ['s1'])
  ok('…e non è una «presenza rifiutata» generica', scartate, 0)

  memoria.delete(DOVE)
  const d1 = m.creaDatiSupabase(database(fuori))
  let scartate1 = 0
  d1.guardaScartate?.((n) => { scartate1 = n })
  d1.guardaFuoriFinestra?.(() => false)
  await d1.segna('s1', 'p1', 'presente')
  await attesa()
  ok('nessun appello di quella lezione aperto: non si perde, è una presenza rifiutata', [inCoda(), scartate1], [0, 1])

  memoria.delete(DOVE)
  const d2 = m.creaDatiSupabase(database(negato))
  let scartate2 = 0
  const fuori2 = []
  d2.guardaScartate?.((n) => { scartate2 = n })
  d2.guardaFuoriFinestra?.((s) => (fuori2.push(s), true))
  await d2.segna('s1', 'p1', 'presente')
  await attesa()
  ok('un altro 42501 (permesso) resta una presenza rifiutata', [scartate2, fuori2], [1, []])
  memoria.delete(DOVE)
}

if (guai) {
  console.log(`\n${guai} da sistemare`)
  process.exit(1)
}
console.log('\ntutto a posto')
