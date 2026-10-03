// ---------------------------------------------------------------------------
// Le prove, senza browser: chi viene a provare entra nell'appello.
//
//   node scripts/prova-prove.mjs
//
// La prova dell'app rifà in TypeScript le regole di `supabase/21-prove.sql`:
// la prova aggiunta dall'appello, già presente; la stessa persona ritrovata
// per un'altra lezione; il tablet col PIN; la prova tolta per sbaglio, con
// la persona se è nata lì; l'elenco della segreteria. Le stesse cose, dal
// lato del database, le prova `supabase/prova/prove.sql`.
// ---------------------------------------------------------------------------
import { build } from 'esbuild'

const { outputFiles } = await build({
  stdin: {
    contents:
      "export { creaDatiProva } from './src/lib/datiProva'; export { creaTabletProva } from './src/lib/tabletProva'; export { creaSegreteriaProva } from './src/lib/segreteriaProva'; export { archivio } from './src/lib/archivioProva'; export * from './src/lib/prove'; export { sigleDeiProvati } from './src/lib/tablet'",
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

// Lotta 2 è lunedì, mercoledì e venerdì alle 17 nella sala Lotta; il Judo
// agonisti il giovedì alle 18 nel Tatami. Le lezioni sono di settimane
// passate: le prove contano dagli ultimi novanta giorni, e l'orologio non si sposta.
const oggi = new Date()
const lunedi = new Date(oggi.getFullYear(), oggi.getMonth(), oggi.getDate() - ((oggi.getDay() + 6) % 7) - 7)
const g = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const dopo = (n) => new Date(lunedi.getFullYear(), lunedi.getMonth(), lunedi.getDate() + n)
const LOTTA = `s@lotta-2@${g(dopo(2))}@17:00`
const LOTTA_VEN = `s@lotta-2@${g(dopo(4))}@17:00`

const d = m.creaDatiProva()
const persone = () => m.archivio.dati.persone.length

console.log("\n1. l'istruttore aggiunge una prova dall'app")
{
  const esiste = await d.dettaglio(LOTTA)
  ok('la lezione di Lotta 2 di mercoledì scorso esiste', esiste?.sessione.corso, 'Lotta 2')
  const prima = persone()
  const iscritti = esiste.elenco.length
  const p = await d.aggiungiProva(LOTTA, { nome: '  Marco ', cognome: 'Nuovo', telefono: '333 1234567' })
  ok('una persona nuova', persone() - prima, 1)
  ok('nome pulito', `${p.nome}|${p.cognome}`, 'Marco|Nuovo')
  const det = await d.dettaglio(LOTTA)
  const lui = det.elenco.find((x) => x.id === p.id)
  ok("in fondo all'appello, presente, in prova", [det.elenco.indexOf(lui) === iscritti, lui.stato, lui.prova], [true, 'presente', true])
  ok('e conta fra i presenti della lezione', det.sessione.presenti, 1)
  // Il conto della scheda nel calendario: chi prova a parte, e quanti
  // iscritti mancano da segnare (a zero l'appello è fatto).
  ok('la scheda conta la prova a parte', [det.sessione.prove, det.sessione.daSegnare], [1, iscritti])
  ok('senza nome no', await errore(() => d.aggiungiProva(LOTTA, { nome: ' ', cognome: 'Vuoto' })), 'Servono nome e cognome.')
  ok('un telefono che non è un numero no', await errore(() => d.aggiungiProva(LOTTA, { nome: 'Ugo', cognome: 'Strano', telefono: 'chiamami' })), 'Il telefono non sembra un numero.')
  const iscritto = det.elenco[0]
  ok("chi è già iscritto è già nell'appello", await errore(() => d.aggiungiProva(LOTTA, iscritto)), "è già iscritto a questo corso: è nell'appello")
  await d.segna(LOTTA, p.id, 'assente')
  ok('si tocca come gli altri', (await d.dettaglio(LOTTA)).elenco.find((x) => x.id === p.id).stato, 'assente')
  await d.segnaTutti(LOTTA, 'presente')
  ok('TUTTI PRESENTI vale anche per lui', (await d.dettaglio(LOTTA)).elenco.find((x) => x.id === p.id).stato, 'presente')
  const fatta = (await d.dettaglio(LOTTA)).sessione
  ok('dopo TUTTI PRESENTI non manca nessuno', [fatta.daSegnare, fatta.prove, fatta.presenti], [0, 1, iscritti + 1])
}

console.log('\n2. il giorno dopo, un altro corso: si ritrova per nome')
{
  // Chi è collegato lo dice l'indirizzo, come in prova: istruttori o segreteria.
  window.location.pathname = '/istruttori/'
  const venuti = await d.provati()
  ok("fra chi ha provato, senza telefono per l'istruttore", venuti.map((x) => `${x.nome} ${x.telefono ?? '-'} ${x.corso}`), ['Marco - Lotta 2'])
  window.location.pathname = '/segreteria/'
  ok('la segreteria lo vede col telefono', (await d.provati()).map((x) => `${x.nome} ${x.telefono ?? '-'} ${x.corso}`), ['Marco 333 1234567 Lotta 2'])
  window.location.pathname = '/'
  ok('si trova scrivendo «mar nu»', m.somiglianti(venuti, 'mar nu').length, 1)
  ok('con niente scritto, nessuno', [m.somiglianti(venuti, '').length, m.somiglianti(venuti, ' ').length], [0, 0])
  ok("nell'app il cognome intero, senza sigla", venuti.map((x) => `${x.cognome} ${x.sigla ?? '-'}`), ['Nuovo -'])
  ok('con meno di tre lettere, nessuno: «ma»', m.somiglianti(venuti, 'ma').length, 0)
  ok('due lettere fra nome e cognome non bastano: «m n»', m.somiglianti(venuti, 'm n').length, 0)
  // Serve almeno una parola di tre lettere: tante parole corte non bastano.
  ok('tre lettere fra nome e cognome no: «ma n»', m.somiglianti(venuti, 'ma n').length, 0)
  ok('una parola di tre sì: «mar n»', m.somiglianti(venuti, 'mar n').length, 1)
  ok('«mar» lo trova col corso e il giorno', m.somiglianti(venuti, 'mar').map((x) => `${x.nome} ${x.corso} ${x.inizio.slice(0, 10)}`), [
    `Marco Lotta 2 ${new Date(dopo(2).setHours(17)).toISOString().slice(0, 10)}`,
  ])
  ok('e non scrivendo «luca»', m.somiglianti(venuti, 'luca').length, 0)
  // Apostrofi e trattini: chi scrive «d'am» o «deluca» deve ritrovare
  // D'Amico e De-Luca, comunque siano stati salvati.
  const gia = [
    ['Paolo', "D'Amico"], ['Sara', 'D’Amico'], ['Giulia', 'Damico'], ['Anna', 'De-Luca'],
    ['Marco', 'De Luca'], ['Ugo', 'Damiani'], ['Marco', 'Nuzzo'],
  ].map(([nome, cognome], i) => ({ id: `g${i}`, nome, cognome, corso: 'Lotta', inizio: '2026-01-01T17:00:00Z' }))
  const chi = (scritto) => m.somiglianti(gia, scritto).map((p) => `${p.cognome} ${p.nome}`).sort((a, b) => a.localeCompare(b, 'it'))
  const damici = ["D'Amico Paolo", 'D’Amico Sara', 'Damico Giulia']
  const conDamiani = ["D'Amico Paolo", 'D’Amico Sara', 'Damiani Ugo', 'Damico Giulia']
  ok("«d'am» trova i D'Amico, Damico e Damiani", chi("d'am"), conDamiani)
  ok('«d’am» (apostrofo tipografico) trova lo stesso', chi('d’am'), conDamiani)
  ok('«dʼam» (apostrofo modificatore) trova lo stesso', chi('dʼam'), conDamiani)
  ok('«d‘am» e «d´am» (da altre tastiere) trovano lo stesso', [chi('d‘am'), chi('d´am')], [conDamiani, conDamiani])
  ok("«D'Amico» trova i D'Amico e Damico, non Damiani", chi("D'Amico"), damici)
  ok("«amico» trova i due D'Amico", chi('amico'), ["D'Amico Paolo", 'D’Amico Sara'])
  ok("«damico» trova i D'Amico e Damico, non Damiani", chi('damico'), damici)
  ok('«de luca» trova i due De Luca', chi('de luca'), ['De Luca Marco', 'De-Luca Anna'])
  ok('«de-luca» trova i due De Luca', chi('de-luca'), ['De Luca Marco', 'De-Luca Anna'])
  ok('«deluca» trova i due De Luca', chi('deluca'), ['De Luca Marco', 'De-Luca Anna'])
  ok("«d'amico giu» trova solo Damico Giulia", chi("d'amico giu"), ['Damico Giulia'])
  ok('«mar nu» trova solo Nuzzo Marco', chi('mar nu'), ['Nuzzo Marco'])
  ok("apostrofi e trattini non sono lettere: «d'a» e «d-'» nessuno", [chi("d'a"), chi("d-'")], [[], []])
  ok('«d d d», «a a a», «de l», «de lu», «m n o»: nessuna parola di tre, nessuno', ['d d d', 'a a a', 'de l', 'de lu', 'm n o'].map(chi), [[], [], [], [], []])
  ok('«de luc» trova i due De Luca', chi('de luc'), ['De Luca Marco', 'De-Luca Anna'])
  // Lo spazio indivisibile e quello invisibile, da un copia e incolla, sono spazi come nel database.
  ok('«mar nu» con lo spazio indivisibile o invisibile', [chi('mar\u00a0nu'), chi('mar\ufeffnu')], [['Nuzzo Marco'], ['Nuzzo Marco']])
  // Al contrario: salvato attaccato, scritto staccato.
  const attaccati = [{ id: 'a1', nome: 'Rita', cognome: 'Deluca', corso: 'Lotta', inizio: '2026-01-01T17:00:00Z' }, { id: 'a2', nome: 'Giulia', cognome: 'Damico', corso: 'Lotta', inizio: '2026-01-01T17:00:00Z' }]
  ok('«de luca» e «d amico» trovano Deluca e Damico', [m.somiglianti(attaccati, 'de luca'), m.somiglianti(attaccati, 'd amico')].map((x) => x.map((p) => p.cognome)), [['Deluca'], ['Damico']])
  const prima = persone()
  await d.aggiungiProva(LOTTA_VEN, venuti[0])
  ok('la stessa persona, non una nuova', persone() - prima, 0)
  const di = await d.provati()
  ok('una volta sola, con l’ultima lezione', di.map((x) => x.inizio.slice(0, 10) === new Date(dopo(4).setHours(17)).toISOString().slice(0, 10)), [true])
}

console.log('\n3. dal tablet, col PIN')
{
  // Il tablet della Lotta, venerdì scorso a lezione appena cominciata.
  window.location.search = `?adesso=${g(dopo(4))}T17:05`
  const t = m.creaTabletProva()
  await t.scegliSala('Lotta')
  // Il tablet chiede solo chi somiglia a quel che si scrive: l'elenco intero non lo scarica.
  ok('PIN sbagliato: nessuno', await t.provati('0000', 'mar'), [])
  const sulTablet = await t.provati('1234', 'mar')
  ok("«mar»: chi ha provato, senza telefono e col cognome all'iniziale", sulTablet.map((x) => `${x.nome} ${x.sigla} ${x.telefono ?? '-'}`), ['Marco N. -'])
  ok('e anche «nuo», dal cognome che non si vede', (await t.provati('1234', 'nuo')).length, 1)
  ok('sul tablet «ma» non arriva nessuno', await t.provati('1234', 'ma'), [])
  ok('né con niente scritto, o «m n»', [await t.provati('1234', ''), await t.provati('1234', 'm n')], [[], []])
  ok('«luca» non trova Marco', await t.provati('1234', 'luca'), [])
  ok('«m n o» no, «mar n» sì', [(await t.provati('1234', 'm n o')).length, (await t.provati('1234', 'mar n')).length], [0, 1])
  ok('«mar nuo» con lo spazio indivisibile', (await t.provati('1234', 'mar\u00a0nuo')).length, 1)
  // Più di cento caratteri non è un nome: niente, e nessun errore.
  ok('cento caratteri si cercano', (await t.provati('1234', 'mar' + ' '.repeat(94) + 'nuo')).length, 1)
  ok('centouno no, né mille', [await t.provati('1234', 'mar' + ' '.repeat(95) + 'nuo'), await t.provati('1234', 'mar' + ' '.repeat(994) + 'nuo')], [[], []])
  // Su novanta giorni di prove due sigle uguali capitano: allora il cognome intero.
  const omonimi = m.sigleDeiProvati([
    { nome: 'Marco', cognome: 'Neri' },
    { nome: 'Marco', cognome: 'Nervi' },
    { nome: 'Marco', cognome: 'Nuovo' },
    { nome: 'Luca', cognome: 'Neri' },
  ])
  ok('due che si leggerebbero uguali, col cognome intero', omonimi.map((x) => `${x.nome} ${x.sigla}`), ['Marco Neri', 'Marco Nervi', 'Marco Nuo.', 'Luca N.'])
  const app = await t.appello('1234', LOTTA_VEN)
  ok("le prove in fondo all'appello", app.filter((r) => r.prova).map((r) => r.cognome), ['Nuovo'])
  ok("l'elenco da toccare resta degli iscritti", (await t.elenco(LOTTA_VEN)).some((n) => n.nome === 'Marco'), false)
  const marco = app.find((r) => r.prova)
  ok('non si segna da sé', await errore(() => t.segna(LOTTA_VEN, marco.personaId)), 'non è iscritto a questo corso')
  ok("l'istruttore lo segna assente", await t.correggi('1234', LOTTA_VEN, marco.personaId, 'assente', true), true)
  ok('e una prova non si «smarca»', await errore(() => t.correggi('1234', LOTTA_VEN, marco.personaId, null, true)), 'una prova si segna presente o assente')
  const prima = persone()
  ok('una prova nuova dal tablet', await t.aggiungiProva('1234', LOTTA_VEN, { nome: 'Sara', cognome: 'Dalla Sala' }), true)
  ok('PIN sbagliato: non aggiunge', await t.aggiungiProva('0000', LOTTA_VEN, { nome: 'Ugo', cognome: 'Pin' }), false)
  ok('una persona in più', persone() - prima, 1)
  const ora = await t.appello('1234', LOTTA_VEN)
  ok('ora sono due, presente la nuova', ora.filter((r) => r.prova).map((r) => `${r.cognome}:${r.stato}`), ['Dalla Sala:presente', 'Nuovo:assente'])
  const sara = ora.find((r) => r.cognome === 'Dalla Sala')
  ok("aggiunta da Maurizio, dall'appello", [m.archivio.dati.prove.find((x) => x.personaId === sara.personaId).da, sara.origine], ['i-maurizio', 'appello'])
  const tatami = m.creaTabletProva()
  await tatami.scegliSala('Tatami')
  ok("non nella lezione di un'altra sala", await errore(() => tatami.aggiungiProva('1234', LOTTA_VEN, { nome: 'Ugo', cognome: 'Judo' })), "lezione di un'altra sala")

  console.log('\n4. togliere una prova messa per sbaglio')
  const p = persone()
  ok('dal tablet', await t.togliProva('1234', LOTTA_VEN, sara.personaId), true)
  ok('la persona nata con la prova se ne va', p - persone(), 1)
  await d.togliProva(LOTTA_VEN, marco.personaId)
  ok('Marco resta: ha provato anche mercoledì', persone() - (p - 1), 0)
  ok('ma non è più nell’appello di venerdì', (await d.dettaglio(LOTTA_VEN)).elenco.some((x) => x.id === marco.personaId), false)
  ok('e mercoledì sì', (await d.dettaglio(LOTTA)).elenco.some((x) => x.id === marco.personaId), true)
}

console.log('\n5. la segreteria ritrova chi è venuto a provare')
{
  const s = m.creaSegreteriaProva()
  const elenco = await s.prove(dopo(0), dopo(6))
  ok('una prova, con telefono e corso', elenco.map((x) => `${x.cognome} ${x.telefono} ${x.corso} ${x.iscritto}`), ['Nuovo 333 1234567 Lotta 2 false'])
  ok('e fra gli iscritti c’è la sua scheda', (await s.persone()).some((x) => x.id === elenco[0].personaId), true)
  await s.iscrivi(elenco[0].personaId, 'lotta-2')
  ok('si iscrive: lo dice', (await s.prove(dopo(0), dopo(6)))[0].iscritto, true)
}

console.log('\n6. chi non si cerca più')
{
  // Una lezione di Lotta 2 di 91 giorni fa, fuori dai novanta: straordinaria,
  // perché la stagione di prova comincia dopo.
  const LOTTA_VECCHIA = 'x@lotta-vecchia'
  m.archivio.dati.lezioni[LOTTA_VECCHIA] = { straordinaria: { corsoId: 'lotta-2', inizio: new Date(Date.now() - 91 * 24 * 60 * 60_000).toISOString(), durata: 60 } }
  ok('la lezione di 91 giorni fa esiste', (await d.dettaglio(LOTTA_VECCHIA))?.sessione.corso, 'Lotta 2')
  await d.aggiungiProva(LOTTA_VECCHIA, { nome: 'Vito', cognome: 'Lontano' })
  const dora = await d.aggiungiProva(LOTTA, { nome: 'Dora', cognome: 'Spenta' })
  m.archivio.dati.persone.find((x) => x.id === dora.id).attiva = false
  window.location.pathname = '/segreteria/'
  ok('una prova di 91 giorni fa e una persona disattivata non ci sono', (await d.provati()).map((x) => x.nome), ['Marco'])
  window.location.pathname = '/'
  const t = m.creaTabletProva()
  await t.scegliSala('Lotta')
  ok('neanche sul tablet, cercandoli per nome', [await t.provati('1234', 'vito'), await t.provati('1234', 'dora')], [[], []])
  ok('e Marco sì', (await t.provati('1234', 'marco')).length, 1)
}

console.log('\n7. sul tablet, al massimo venti: i più recenti')
{
  // Venticinque Zeno, ognuno a una lezione di Lotta 2 di 1, 2, … 25 giorni fa.
  for (let n = 1; n <= 25; n++) {
    m.archivio.dati.lezioni[`x@zeno-${n}`] = { straordinaria: { corsoId: 'lotta-2', inizio: new Date(Date.now() - n * 24 * 60 * 60_000).toISOString(), durata: 60 } }
    m.archivio.dati.persone.push({ id: `zeno-${n}`, nome: 'Zeno', cognome: `Numero ${n}`, ruolo: 'iscritto', attiva: true })
    m.archivio.dati.prove.push({ sessioneId: `x@zeno-${n}`, personaId: `zeno-${n}` })
  }
  const t = m.creaTabletProva()
  await t.scegliSala('Lotta')
  const zeni = await t.provati('1234', 'zen')
  ok('«zen» ne dà venti', zeni.length, 20)
  ok('i più recenti, dal più recente: giorni fa', zeni.map((x) => Math.round((Date.now() - Date.parse(x.inizio)) / (24 * 60 * 60_000))), Array.from({ length: 20 }, (_, i) => i + 1))
}

console.log("\n8. app e segreteria leggono l'elenco una volta sola")
{
  ok('unaVolta c’è', typeof m.unaVolta, 'function')
  let letture = 0
  const cerca = m.unaVolta(async () => {
    letture++
    return ['Marco']
  })
  const [a, b] = await Promise.all([cerca('mar'), cerca('marc')])
  ok('due ricerche insieme, una lettura sola', [letture, a, b], [1, ['Marco'], ['Marco']])
  ok('e dopo non rilegge', [await cerca('nuo'), letture], [['Marco'], 1])
  let volte = 0
  const zoppa = m.unaVolta(async () => {
    if (++volte === 1) throw new Error('senza rete')
    return ['Marco']
  })
  ok('se la prima lettura fallisce, lo dice', await errore(() => zoppa('mar')), 'senza rete')
  ok('e la volta dopo riprova', [await zoppa('mar'), volte], [['Marco'], 2])
}

console.log('\n9. al massimo cento ricerche in dieci minuti per tablet')
{
  // Il tablet del Tatami, che finora non ha cercato niente.
  const tatami = m.creaTabletProva()
  await tatami.scegliSala('Tatami')
  let risposte = 0
  for (let i = 0; i < 100; i++) if ((await errore(() => tatami.provati('1234', 'mar'))) === 'nessun errore') risposte++
  ok('cento ricerche rispondono', risposte, 100)
  ok('la centounesima no', await errore(() => tatami.provati('1234', 'mar')), 'troppe ricerche: riprova fra qualche minuto')
  const lotta = m.creaTabletProva()
  await lotta.scegliSala('Lotta')
  ok('un altro tablet cerca ancora', (await lotta.provati('1234', 'mar')).map((x) => x.nome), ['Marco'])
}

console.log('\n10. e al massimo trecento in un giorno')
{
  // Cento ogni undici minuti: il tetto dei dieci minuti non scatta mai.
  const vero = Date.now
  const giudo = m.creaTabletProva()
  await giudo.scegliSala('Lotta')
  let risposte = 0
  try {
    for (let giro = 0; giro < 3; giro++) {
      Date.now = () => vero() + giro * 11 * 60_000
      for (let i = 0; i < 100; i++) if ((await errore(() => giudo.provati('1234', 'mar'))) === 'nessun errore') risposte++
    }
    ok('trecento in mezz’ora rispondono', risposte, 300)
    Date.now = () => vero() + 33 * 60_000
    ok('la trecentounesima no', await errore(() => giudo.provati('1234', 'mar')), 'troppe ricerche: riprova fra qualche minuto')
    Date.now = () => vero() + 25 * 60 * 60_000
    ok('il giorno dopo sì', (await giudo.provati('1234', 'mar')).map((x) => x.nome), ['Marco'])
  } finally {
    Date.now = vero
  }
}

console.log('\n11. cosa mostra il pannello')
{
  const marco = { id: 'm', nome: 'Marco', cognome: 'Neri', corso: 'Lotta', inizio: '2026-09-01T17:00:00Z' }
  const mario = { id: 'r', nome: 'Mario', cognome: 'Rossi', corso: 'Lotta', inizio: '2026-09-01T17:00:00Z' }
  const nessuno = new Set()
  const vedi = (o) => m.daMostrare({ ultimi: [], giaQui: nessuno, guaio: null, ...o })
  ok('daMostrare c’è', typeof m.daMostrare, 'function')
  if (typeof m.daMostrare === 'function') {
    ok('letto e nessuno somiglia: lo dice', vedi({ testo: 'xyz', venuti: [] }).stato, 'Nessuno è già venuto con questo nome.')
    ok('non ancora letto: cerca', vedi({ testo: 'xyz' }).stato, 'Cerco chi è già venuto…')
    ok('intanto, la risposta di prima filtrata con questo testo', vedi({ testo: 'marc', ultimi: [marco, mario] }).proposti.map((x) => x.id), ['m'])
    ok('e se c’è qualcuno, niente riga', vedi({ testo: 'marc', ultimi: [marco, mario] }).stato, null)
    ok('chi è già nell’appello no', vedi({ testo: 'mar', venuti: [marco, mario], giaQui: new Set(['m']) }).proposti.map((x) => x.id), ['r'])
    ok('sotto le tre lettere niente', [vedi({ testo: 'ma', venuti: [marco] }).proposti, vedi({ testo: 'ma', venuti: [marco] }).stato], [[], null])
    ok('senza rete lo dice', vedi({ testo: 'mar', guaio: new Error('Failed to fetch') }).avviso, 'Senza rete non vedo chi è già venuto: scrivi nome e cognome.')
    const troppe = vedi({ testo: 'mar', guaio: new Error('troppe ricerche: riprova fra qualche minuto') })
    ok('il tetto delle ricerche non è «senza rete»', troppe.avviso, 'Troppe ricerche da questo tablet: per qualche minuto scrivete nome e cognome.')
    ok('e allora niente «Cerco…»', troppe.stato, null)
    ok('tutto bene: nessun avviso', vedi({ testo: 'mar', venuti: [marco] }).avviso, null)
  }
}

console.log(guai ? `\n${guai} ${guai === 1 ? 'cosa non torna' : 'cose non tornano'}` : '\nTUTTO A POSTO')
process.exit(guai ? 1 : 0)
