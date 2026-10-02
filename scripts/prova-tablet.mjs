// ---------------------------------------------------------------------------
// Le regole del tablet di sala, provate senza browser.
//
//   node scripts/prova-tablet.mjs
//
// Il tablet di prova rifà in TypeScript le regole di `supabase/04-tablet.sql`:
// le finestre di tempo, l'annullo, il PIN, il tablet che non scavalca
// l'istruttore, la presenza dell'istruttore che entra col PIN (anche di
// `15-presenze-istruttori.sql`), quella di chi fa l'appello e le lezioni
// tenute da confermare (`23-istruttori-dalle-lezioni.sql`). Qui si controlla che le rifaccia uguali, spostando l'orologio
// come si fa dall'indirizzo con `?adesso=`. Le stesse cose, dal lato del
// database, le prova `supabase/prova/tablet.sql`.
// ---------------------------------------------------------------------------
import { build } from 'esbuild'

const { outputFiles } = await build({
  stdin: {
    contents:
      "export * from './src/lib/tabletProva'; export { sigle } from './src/lib/tablet'; export { creaSegreteriaProva } from './src/lib/segreteriaProva'; export { creaDatiProva, comeE, lezioniFra } from './src/lib/datiProva'; export { archivio } from './src/lib/archivioProva'",
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
globalThis.window = { location: { search: '', hash: '', pathname: '/' }, addEventListener() {} }
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
  ok('giusto', (await t.entraConPin('1234')).nome, 'Maurizio')
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

console.log('\n7. il timer della sala, uguale per tutti i tablet')
{
  const lotta = await alle('2026-09-23T16:55')
  const prima = (await lotta.timerSala()).impostazioni
  ok('di fabbrica Maurizio è classico', prima.coach, 'classico')
  await lotta.salvaTimerSala({ ...prima, coach: 'spietato', volume: 0.5 })
  const tatami = await alle('2026-09-23T16:55', 'Tatami')
  const dopo = (await tatami.timerSala()).impostazioni
  ok('cambiato sulla Lotta, il Tatami lo vede', [dopo.coach, dopo.volume], ['spietato', 0.5])
  await tatami.salvaTimerSala({ ...dopo, coach: 'boh', volume: 7 })
  const pulito = (await lotta.timerSala()).impostazioni
  ok('un valore strano torna quello di partenza', [pulito.coach, pulito.volume], ['classico', 1])
}

console.log('\n8. la presenza dell\'istruttore col PIN')
{
  const seg = m.creaSegreteriaProva()
  const presenze = (x) => x.presenze.map((p) => `${p.corso} ${p.stato}`)
  // Maura insegna Lotta 2 e Lotta 3. Lunedì 21 settembre in Lotta: la 2 alle 17, la 3 alle 18.
  const lotta = await alle('2026-09-21T17:40')
  ok('Maura, prevista: confermata da sé', presenze(await lotta.entraConPin('2468')), ['Lotta 2 confermata', 'Lotta 3 confermata'])
  await lotta.entraConPin('2468')
  ok('rimette il PIN: niente doppioni', (await seg.presenzeIstruttori(365)).filter((x) => x.nome === 'Maura' && x.inizio.startsWith('2026-09-21')).length, 2)
  // Fabio insegna Aikido, in Motricità: in Lotta non è previsto.
  const fabio = await lotta.entraConPin('5678')
  ok('Fabio, non previsto: da confermare, nella lezione in corso', presenze(fabio), ['Lotta 2 da_confermare'])
  ok('la segreteria lo vede da confermare', (await seg.presenzeIstruttori(0)).filter((x) => x.stato === 'da_confermare' && x.nome === 'Fabio').map((x) => x.previsti), ['Maura, Federico'])
  const presto = await alle('2026-09-21T12:00')
  ok('fuori dalle lezioni non segna niente', (await presto.entraConPin('5678')).presenze, [])
  // La segreteria di prova col suo PIN (quello di partenza non ce l'ha): apre l'appello, non si segna.
  await seg.impostaPin('s-prova', '9090')
  ok('la segreteria non prevista non si segna', (await lotta.entraConPin('9090')).presenze, [])
  const id = (await seg.presenzeIstruttori(0)).find((x) => x.stato === 'da_confermare' && x.nome === 'Fabio').id
  await seg.gestisciPresenzaIstruttore(id, true)
  const gestita = (await seg.presenzeIstruttori(365)).find((x) => x.id === id)
  ok('confermata dalla segreteria', [gestita.stato, gestita.gestitaDa], ['confermata', 'Segreteria di prova'])
  // Fabio sostituisce Maura nel Lotta 3 del mercoledì: al suo PIN è previsto.
  await seg.aggiornaLezione('s@lotta-3@2026-09-23@18:00', { sostitutoId: 'i-fabio' })
  const sost = await alle('2026-09-23T18:20')
  ok('il sostituto è previsto', presenze(await sost.entraConPin('5678')), ['Lotta 3 confermata'])
  ok('e Maura, sostituita, no', presenze(await sost.entraConPin('2468')), ['Lotta 3 da_confermare'])
  const rifiuta = (await seg.presenzeIstruttori(0)).find((x) => x.stato === 'da_confermare' && x.nome === 'Maura').id
  await seg.gestisciPresenzaIstruttore(rifiuta, false)
  ok('rifiutata, al PIN dopo resta rifiutata', presenze(await sost.entraConPin('2468')), ['Lotta 3 rifiutata'])
}

console.log('\n9. chi fa l\'appello c\'era, e le lezioni tenute senza istruttore')
{
  const seg = m.creaSegreteriaProva()
  const di = async (sessioneId, nome) => {
    const x = (await seg.presenzeIstruttori(365)).find((p) => p.sessioneId === sessioneId && p.nome === nome)
    return x ? `${x.stato} ${x.come}` : 'nessuna'
  }
  // Venerdì 25 settembre, Lotta 2 alle 17: Fabio, che non la insegna, fa l'appello col PIN.
  const lotta = await alle('2026-09-25T17:30')
  const venerdi = 's@lotta-2@2026-09-25@17:00'
  const allievo = (await lotta.appello('5678', venerdi))[0].personaId
  await lotta.correggi('5678', venerdi, allievo, 'presente')
  ok('Fabio fa l\'appello col PIN: da confermare', await di(venerdi, 'Fabio'), 'da_confermare appello')
  // Maura, che la insegna, fa l'appello del venerdì dopo dall'app.
  window.location.pathname = '/istruttori/'
  const app = m.creaDatiProva()
  const maurizio = m.lezioniFra(new Date('2026-09-21'), new Date('2026-09-27')).find((l) => m.comeE(l).istruttori.includes('i-maurizio') && m.comeE(l).istruttori.length === 1)
  const dettaglio = await app.dettaglio(maurizio.id)
  await app.segna(maurizio.id, dettaglio.elenco[0].id, 'presente')
  ok('Maurizio fa l\'appello dall\'app: confermato', await di(maurizio.id, 'Maurizio'), 'confermata appello')
  // La segreteria fa l'appello dal banco: non si segna nessuno.
  window.location.pathname = '/segreteria/'
  const lotta3 = 's@lotta-3@2026-09-21@18:00'
  const d3 = await app.dettaglio(lotta3)
  await app.segna(lotta3, d3.elenco[0].id, 'presente')
  ok('dalla segreteria non si segna nessuno', (await seg.presenzeIstruttori(365)).filter((x) => x.sessioneId === lotta3 && x.come === 'appello').length, 0)

  // Lunedì 28 la segreteria fa l'appello del Lotta 2 dal banco: nessun istruttore si è segnato.
  const lunedi = 's@lotta-2@2026-09-28@17:00'
  await app.segna(lunedi, (await app.dettaglio(lunedi)).elenco[0].id, 'presente')

  m.archivio.dati.proposteIstruttoriDal = '2026-09-01T00:00:00'
  const proposte = await seg.lezioniSenzaIstruttore()
  ok('Maurizio, segnato, non si propone', proposte.some((l) => l.sessioneId === maurizio.id), false)
  ok('il Lotta 3, con Maura segnata col PIN, nemmeno: ne basta uno', proposte.some((l) => l.sessioneId === lotta3), false)
  ok('il Lotta 2 di Fabio nemmeno, anche se non era previsto', proposte.some((l) => l.sessioneId === venerdi), false)
  const l2 = proposte.find((l) => l.sessioneId === lunedi)
  ok('il Lotta 2 di lunedì si propone, coi previsti', l2 && l2.previsti.map((x) => `${x.nome} ${x.stato ?? '-'}`), ['Maura -', 'Federico -'])
  ok('non uno fuori dai previsti', await errore(() => seg.segnaIstruttoriLezione(lunedi, ['i-fabio'])), 'si sceglie fra gli istruttori previsti')
  await seg.segnaIstruttoriLezione(lunedi, ['i-federico'])
  ok('scelto Federico: confermato', await di(lunedi, 'Federico'), 'confermata segreteria')
  ok('e Maura rifiutata', await di(lunedi, 'Maura'), 'rifiutata segreteria')
  ok('e la lezione esce dall\'elenco', (await seg.lezioniSenzaIstruttore()).some((l) => l.sessioneId === lunedi), false)
  m.archivio.dati.proposteIstruttoriDal = '2026-12-01T00:00:00'
  ok('quelle di prima non si propongono', (await seg.lezioniSenzaIstruttore()).length, 0)
}

console.log(guai ? `\n${guai} COSE NON TORNANO` : '\nTUTTO A POSTO')
process.exit(guai ? 1 : 0)
