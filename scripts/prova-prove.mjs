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
      "export { creaDatiProva } from './src/lib/datiProva'; export { creaTabletProva } from './src/lib/tabletProva'; export { creaSegreteriaProva } from './src/lib/segreteriaProva'; export { archivio } from './src/lib/archivioProva'; export { somiglianti, cosaNonVaProva, giaNellAppello } from './src/lib/prove'; export { sigleDeiProvati } from './src/lib/tablet'",
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
  ok('tre lettere fra nome e cognome sì: «ma n»', m.somiglianti(venuti, 'ma n').length, 1)
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
  ok('PIN sbagliato: nessuno', await t.provati('0000'), [])
  const sulTablet = await t.provati('1234')
  ok("chi ha provato, senza telefono e col cognome all'iniziale", sulTablet.map((x) => `${x.nome} ${x.sigla} ${x.telefono ?? '-'}`), ['Marco N. -'])
  ok('sul tablet «mar» lo trova', m.somiglianti(sulTablet, 'mar').map((x) => `${x.nome} ${x.sigla}`), ['Marco N.'])
  ok('e anche «nuo», dal cognome che non si vede', m.somiglianti(sulTablet, 'nuo').length, 1)
  ok('sul tablet «ma» non trova nessuno', m.somiglianti(sulTablet, 'ma').length, 0)
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
  // Dal pannello si può toccare chi è già in prova: resta col segno che ha.
  ok('riaggiunto, chi è assente resta assente', [
    await t.aggiungiProva('1234', LOTTA_VEN, { id: marco.personaId, nome: marco.nome, cognome: marco.cognome }),
    (await t.appello('1234', LOTTA_VEN)).filter((r) => r.prova).map((r) => `${r.cognome}:${r.stato}`),
  ], [marco.personaId, ['Nuovo:assente']])
  const prima = persone()
  // Il tablet riceve chi ha aggiunto, anche se nuovo: per non riproporlo fra i già venuti.
  const idSara = await t.aggiungiProva('1234', LOTTA_VEN, { nome: 'Sara', cognome: 'Dalla Sala' })
  ok('una prova nuova dal tablet', typeof idSara, 'string')
  ok('PIN sbagliato: non aggiunge', await t.aggiungiProva('0000', LOTTA_VEN, { nome: 'Ugo', cognome: 'Pin' }), null)
  ok('una persona in più', persone() - prima, 1)
  const ora = await t.appello('1234', LOTTA_VEN)
  ok('ora sono due, presente la nuova', ora.filter((r) => r.prova).map((r) => `${r.cognome}:${r.stato}`), ['Dalla Sala:presente', 'Nuovo:assente'])
  const sara = ora.find((r) => r.cognome === 'Dalla Sala')
  ok('chi ha aggiunto è proprio lei', sara.personaId, idSara)
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
  ok('neanche sul tablet', (await t.provati('1234')).map((x) => x.nome), ['Marco'])
}

console.log("\n7. chi è già nell'appello, anche se la rilettura non arriva")
{
  const elenco = (s) => [...s].sort()
  const prima = new Set(['a'])
  ok("l'appello riletto sostituisce l'elenco", elenco(m.giaNellAppello(prima, { letti: ['b'] })), ['b'])
  ok("chi si aggiunge entra nell'elenco", elenco(m.giaNellAppello(prima, { aggiunto: 'c' })), ['a', 'c'])
  ok("chi si toglie esce dall'elenco", elenco(m.giaNellAppello(new Set(['a', 'c']), { tolto: 'c' })), ['a'])
  ok("l'elenco di prima non cambia", elenco(prima), ['a'])
  ok("un appello riletto vuoto svuota l'elenco", elenco(m.giaNellAppello(prima, { letti: [] })), [])
}

console.log(guai ? `\n${guai} ${guai === 1 ? 'cosa non torna' : 'cose non tornano'}` : '\nTUTTO A POSTO')
process.exit(guai ? 1 : 0)
