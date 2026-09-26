// ---------------------------------------------------------------------------
// La segreteria di prova, senza browser.
//
//   node scripts/prova-segreteria.mjs
//
// La segreteria di prova cambia l'archivio sul dispositivo e deve comportarsi
// come il database (`supabase/05-segreteria.sql`, provato da
// `supabase/prova/segreteria.sql`): qui si controlla che i cambi arrivino
// dove devono — al calendario dell'app, all'appello, al tablet.
// ---------------------------------------------------------------------------
import { build } from 'esbuild'

const { outputFiles } = await build({
  stdin: {
    contents:
      "export { creaSegreteriaProva } from './src/lib/segreteriaProva'; export { creaDatiProva } from './src/lib/datiProva'; export { creaTabletProva } from './src/lib/tabletProva'",
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
globalThis.window = { location: { search: '', hash: '' }, addEventListener() {} }

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
const s = m.creaSegreteriaProva()
const app = m.creaDatiProva()
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
const giorno = (a, b = a) => [new Date(2026, a[0], a[1]), new Date(2026, b[0], b[1])]
const lotta2 = async (da, a) => (await s.settimana(...giorno(da, a))).filter((l) => l.corsoId === 'lotta-2')

console.log('\n1. il corso cambia sala: le lezioni lo seguono, tranne quelle spostate a mano')
{
  // Lunedì 28 settembre Lotta 2 va in Tatami per quel giorno.
  const [lun] = await lotta2([8, 28])
  await s.aggiornaLezione(lun.id, { salaId: 'Tatami' })
  ok('spostata a mano', (await lotta2([8, 28]))[0].sala, 'Tatami')
  const c = (await s.corsi()).find((x) => x.id === 'lotta-2')
  await s.salvaCorso({ id: c.id, nome: c.nome, salaId: 'Motricità', istruttori: c.istruttori.map((i) => i.id), capienza: c.capienza, colore: c.colore })
  ok('il corso va in Motricità', (await lotta2([8, 30]))[0].sala, 'Motricità')
  ok('quella spostata resta in Tatami', (await lotta2([8, 28]))[0].sala, 'Tatami')
  ok('e l\'app la vede lì', (await app.calendario(...giorno([8, 28]))).find((l) => l.corsoId === 'lotta-2').sala, 'Tatami')
}

console.log('\n2. il sostituto')
{
  const [mer] = await lotta2([8, 30])
  await s.aggiornaLezione(mer.id, { sostitutoId: 'i-fabio' })
  const x = (await lotta2([8, 30]))[0]
  ok('la lezione la fa Fabio', [x.istruttori, x.sostitutoId], ['Fabio', 'i-fabio'])
  await s.aggiornaLezione(mer.id, { sostitutoId: 'i-maura' })
  ok('Maura insegna il corso: non è un sostituto', (await lotta2([8, 30]))[0].sostitutoId, undefined)
  ok('la settimana dopo resta com\'era', (await lotta2([9, 7]))[0].istruttori, 'Maura, Federico')
}

console.log('\n3. i giorni del corso')
{
  await s.aggiungiRicorrenza('lotta-2', { giorno: 6, ora: '10:00', durata: 90 })
  ok('un sabato in più, da oggi', (await lotta2([9, 3])).map((l) => new Date(l.inizio).getHours()), [10])
  ok('non due volte la stessa ora', await errore(() => s.aggiungiRicorrenza('lotta-2', { giorno: 6, ora: '10:00', durata: 60 })), 'Questo corso ha già una lezione quel giorno a quell’ora')
  const sabato = (await s.corsi()).find((c) => c.id === 'lotta-2').ricorrenze.find((r) => r.giorno === 6)
  await s.togliRicorrenza(sabato.id)
  ok('tolto: sparisce, non era ancora cominciato', (await s.corsi()).find((c) => c.id === 'lotta-2').ricorrenze.some((r) => r.giorno === 6), false)
  const lunedi = (await s.corsi()).find((c) => c.id === 'lotta-2').ricorrenze.find((r) => r.giorno === 1)
  await s.togliRicorrenza(lunedi.id)
  ok('il lunedì non c\'è più da oggi in avanti', (await lotta2([8, 28], [9, 4])).map((l) => new Date(l.inizio).getDay()), [3, 5])
  ok('ma quelli passati restano', (await lotta2([8, 21])).length, 1)
}

console.log('\n4. le lezioni straordinarie')
{
  await s.straordinaria('lotta-2', new Date(2026, 9, 3, 11, 0), 60)
  const [x] = (await lotta2([9, 3])).filter((l) => l.straordinaria)
  ok('c\'è, di sabato', [x.straordinaria, new Date(x.inizio).getHours()], [true, 11])
  ok('con gli iscritti del corso nell\'appello', (await app.dettaglio(x.id)).elenco.length, 12)
  await app.segna(x.id, (await app.dettaglio(x.id)).elenco[0].id, 'presente')
  ok('con un appello non si toglie', await errore(() => s.togliLezione(x.id)), 'Ha già un appello: si annulla invece di toglierla')
  await s.aggiornaLezione(x.id, { stato: 'annullata' })
  ok('si annulla', (await lotta2([9, 3])).find((l) => l.id === x.id).stato, 'annullata')
  ok('le altre non si tolgono', await errore(async () => s.togliLezione((await lotta2([9, 2]))[0].id)), 'Si tolgono solo le lezioni straordinarie: le altre si annullano')
}

console.log('\n5. iscritti')
{
  const id = await s.salvaPersona({ nome: 'Marta', cognome: 'Nuova', email: 'marta@esempio.it' })
  ok('un\'email già usata no', await errore(() => s.salvaPersona({ nome: 'Altra', cognome: 'Marta', email: 'MARTA@esempio.it' })), 'Questa email è già di Marta Nuova')
  await s.iscrivi(id, 'lotta-2')
  const [ven] = await lotta2([9, 2])
  ok('iscritta da oggi: è nell\'appello di venerdì', (await app.dettaglio(ven.id)).elenco.some((p) => p.id === id), true)
  ok('non in quello di ieri', (await app.dettaglio((await lotta2([8, 25]))[0].id)).elenco.some((p) => p.id === id), false)
  window.location.search = '?adesso=2026-10-02T16:45'
  const tablet = m.creaTabletProva()
  await tablet.scegliSala('Motricità')
  ok('e sul tablet della sala nuova', (await tablet.elenco(ven.id)).some((p) => p.personaId === id), true)
  await s.termina(id, 'lotta-2')
  ok('terminata: oggi c\'è ancora, venerdì no', [
    (await s.persone()).find((p) => p.id === id).iscrizioni[0].al,
    (await app.dettaglio(ven.id)).elenco.some((p) => p.id === id),
  ], ['2026-09-26', false])
  const [primo] = (await app.dettaglio(ven.id)).elenco
  await s.attivaPersona(primo.id, false)
  ok('disattivato: sparisce dall\'appello', (await app.dettaglio(ven.id)).elenco.some((p) => p.id === primo.id), false)
  await s.attivaPersona(primo.id, true)
}

console.log('\n6. quanto viene ciascuno')
{
  const [lun] = (await s.settimana(...giorno([8, 21]))).filter((l) => l.corsoId === 'judo-2')
  await s.tuttiPresenti(lun.id)
  const f = await s.frequenze()
  const chi = (await app.dettaglio(lun.id)).elenco[0].id
  ok('una sulle sei lezioni di Judo 2 dall\'inizio della stagione', f.get(chi), { presenti: 1, dovute: 6 })
  ok('le ultime lezioni, dalla più vecchia', (await s.storico(chi, 12)).map((x) => x.stato), [null, null, null, 'presente', null, null])
}

console.log('\n7. archiviare')
{
  await s.archiviaCorso('lotta-2', false)
  ok('fuori dal calendario', (await lotta2([9, 5], [9, 9])).length, 0)
  ok('ma il registro di una lezione passata si legge ancora', (await app.dettaglio((await s.settimana(...giorno([8, 21]))).find(() => true).id)) !== null, true)
  await s.archiviaCorso('lotta-2', true)
  ok('ripristinato: mercoledì e venerdì di nuovo lì', (await lotta2([9, 5], [9, 9])).length, 2)
}

console.log(guai ? `\n${guai} COSE NON TORNANO` : '\nTUTTO A POSTO')
process.exit(guai ? 1 : 0)
