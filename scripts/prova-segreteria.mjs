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
      "export { creaSegreteriaProva } from './src/lib/segreteriaProva'; export { creaDatiProva } from './src/lib/datiProva'; export { creaTabletProva } from './src/lib/tabletProva'; export { leggiFogli, importa, leggiTabella, indovinaColonne, scelteCorsi, indovinaCorso, leggiRisposte, divideScelte } from './src/lib/importa'; export { memoria } from './src/lib/datiProva'",
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
  await app.segnaTutti(lun.id, 'presente')
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

console.log('\n8. il registro e chi ha il PIN')
{
  const r = await s.registro(...giorno([8, 21], [8, 21]))
  ok('il registro di lunedì 21: solo lezioni passate, con gli iscritti', [r.length > 0, r.every((x) => x.appello.length > 0)], [true, true])
  ok('il PIN di un altro no', await errore(() => s.impostaPin('i-fabio', '1234')), 'questo PIN è già di un altro: scegline un altro')
  await s.impostaPin('i-fabio', '9090')
  window.location.search = '?adesso=2026-10-01T16:55'
  const t = m.creaTabletProva()
  await t.scegliSala('Motricità')
  ok('il tablet lo riconosce', (await t.entraConPin('9090'))?.nome, 'Fabio')
  ok('e il vecchio non vale più', await t.entraConPin('5678'), null)
  ok('la segreteria sa che ce l\'ha', (await s.personale()).find((p) => p.id === 'i-fabio').haPin, true)
}

console.log('\n9. sale e regole')
{
  await s.salvaSala({ id: 'Pesi', nome: 'Sala pesi', capienza: 12 })
  ok('la sala cambia nome ovunque', [(await s.corsi()).find((c) => c.id === 'pesi-1').sala, (await s.sale()).find((x) => x.nome === 'Sala pesi').capienza], ['Sala pesi', 12])
  ok('due sale con lo stesso nome no', await errore(() => s.salvaSala({ nome: 'lotta' })), 'C’è già una sala con questo nome')
  // Una presenza di tre anni fa, messa a mano nella memoria della prova.
  await s.straordinaria('judo-2', new Date(2023, 8, 1, 17), 60)
  const vecchia = (await s.settimana(new Date(2023, 8, 1), new Date(2023, 8, 1)))[0]
  m.memoria.segnate = { ...m.memoria.segnate, [vecchia.id]: { 'p-qualcuno': 'presente' } }
  ok('scaduta con ventiquattro mesi', await s.scadute(), 1)
  await s.salvaImpostazioni({ mesiPresenze: 48 })
  ok('non con quarantotto', await s.scadute(), 0)
  await s.salvaImpostazioni({ mesiPresenze: 24 })
  ok('la pulizia la toglie', [await s.pulisci(), await s.scadute()], [1, 0])
  const dati = await s.esporta((await app.dettaglio((await lotta2([9, 2]))[0].id)).elenco[0].id)
  ok('l\'esportazione ha anagrafica, iscrizioni, presenze e richieste', Object.keys(dati).sort(), ['esportato_il', 'iscrizioni', 'persona', 'presenze', 'richieste_di_iscrizione'])
}

console.log('\n10. l\'import dai fogli')
{
  const corsi = 'nome;sala;istruttore;giorno;ora;durata\r\nYoga;Sala nuova;Katia;sabato;10.00;60\r\nLotta 2;Lotta;Maura;sabato;11:00;60\r\nRotto;Pesi;;funedì;18:00;60\r\n'
  const iscritti = '\uFEFFnome;cognome;email;telefono;corso\nMarta;Nuova;marta@esempio.it;;Yoga\nGiorgia;;;;Yoga\nMarta;Nuova;marta@esempio.it;;Lotta 2\nPaolo;Verdi;marta@esempio.it;;Yoga\n'
  const f = m.leggiFogli(corsi, iscritti, (await s.corsi()).map((c) => c.nome))
  ok('le righe che non vanno', f.saltate.map((x) => `${x.foglio}:${x.riga}`), ['corsi.csv:4', 'iscritti.csv:3', 'iscritti.csv:5'])
  ok('Marta una volta sola, con due corsi', f.iscritti.map((x) => [x.nome, x.corsi]), [['Marta', ['Yoga', 'Lotta 2']]])
  const a1 = await m.importa(s, f, () => {})
  ok('entrano la sala, il corso, i giorni', [a1.saleNuove, a1.corsiNuovi, a1.ricorrenzeNuove], [['Sala nuova'], ['Yoga'], 2])
  ok('Katia si lega col solo nome', (await s.corsi()).find((c) => c.nome === 'Yoga').istruttori.map((i) => i.nome), ['Katia'])
  const a2 = await m.importa(s, m.leggiFogli(corsi, iscritti, (await s.corsi()).map((c) => c.nome)), () => {})
  ok('rifatto: niente di nuovo', [a2.saleNuove.length, a2.corsiNuovi.length, a2.ricorrenzeNuove, a2.iscrittiNuovi, a2.iscrizioniNuove], [0, 0, 0, 0, 0])
  ok('e nessun doppione', (await s.persone()).filter((p) => p.email === 'marta@esempio.it').length, 1)
}

console.log('\n11. le risposte del modulo Google')
{
  // Com'è il CSV che scarica Google: virgole, domande fra virgolette, più
  // scelte in una cella, i link delle foto caricate.
  const csv = [
    '"Informazioni cronologiche","Indirizzo email","Nome dell\'atleta","Cognome dell\'atleta","Nome e cognome del genitore","Numero di telefono","A quali corsi vuoi iscriverti?","Carica il modulo firmato"',
    '"20/09/2026 18.01.22","Mamma@Esempio.it","Giulia","Neri","Paola Neri","347 000 1111","Judo 2 (nati 2017-2019, lunedì, mercoledì e venerdì), Lotta 3","https://drive.google.com/open?id=1"',
    '"20/09/2026 18.07.40","mamma@esempio.it","Marco","Neri","Paola Neri","347 000 1111","Psicomotricità","https://drive.google.com/open?id=2"',
    '"21/09/2026 09.12.03","andrea@esempio.it","Andrea","Blu","","333 222 3333","Judo adulti, Zumba","https://drive.google.com/open?id=3"',
    '"22/09/2026 10.00.00","andrea@esempio.it","Andrea","Blu","","333 999 9999","Judo adulti","https://drive.google.com/open?id=4"',
    '"22/09/2026 11.00.00","x@esempio.it","","Senzanome","","","Judo 2 (nati 2017-2019, lunedì, mercoledì e venerdì)",""',
  ].join('\n')
  const t = m.leggiTabella(csv)
  const col = m.indovinaColonne(t.testa)
  ok('le colonne si riconoscono, il genitore no', col, { cognome: 3, nome: 2, email: 1, telefono: 5, corsi: 6 })
  ok('la virgola dentro le parentesi non divide', m.divideScelte('Judo 2 (nati 2017-2019, lunedì), Lotta 3'), ['Judo 2 (nati 2017-2019, lunedì)', 'Lotta 3'])
  ok('nemmeno quella prima di una minuscola', m.divideScelte('Judo 2 lunedì, mercoledì e venerdì, Lotta 3'), ['Judo 2 lunedì, mercoledì e venerdì', 'Lotta 3'])
  const corsi = (await s.corsi()).filter((c) => c.attivo).map((c) => ({ id: c.id, nome: c.nome }))
  const scelte = m.scelteCorsi(t, col.corsi)
  ok('le scelte diverse, con quante volte', scelte.map((x) => `${x.testo.slice(0, 12)}·${x.quante}`), ['Judo 2 (nati·2', 'Judo adulti·2', 'Lotta 3·1', 'Psicomotrici·1', 'Zumba·1'])
  const abbinamenti = Object.fromEntries(scelte.flatMap((x) => { const id = m.indovinaCorso(x.testo, corsi); return id ? [[x.testo, id]] : [] }))
  ok('si abbinano da sole, tranne quella che non c\'è', scelte.filter((x) => !(x.testo in abbinamenti)).map((x) => x.testo), ['Zumba'])
  ok('«Judo 2 (…)» è Judo 2', abbinamenti[scelte[0].testo], 'judo-2')
  ok('Judo 22 non sarebbe Judo 2', m.indovinaCorso('Judo 22', [{ id: 'j2', nome: 'Judo 2' }]), undefined)

  const r = m.leggiRisposte(t, col, abbinamenti, corsi)
  ok('tre iscritti da cinque righe', r.iscritti.map((x) => `${x.nome} ${x.cognome}`), ['Giulia Neri', 'Marco Neri', 'Andrea Blu'])
  ok('senza nome si salta', r.saltate.map((x) => [x.riga, x.motivo]), [[6, '«Senzanome»: servono nome e cognome']])
  ok('Giulia, due corsi', r.iscritti[0].corsi, ['Judo 2', 'Lotta 3'])
  ok('Marco, la stessa email della sorella: entra senza', [r.iscritti[1].email, r.iscritti[1].telefono], [undefined, '347 000 1111'])
  ok('Andrea due volte: una persona, l\'ultimo telefono', [r.iscritti[2].corsi, r.iscritti[2].telefono], [['Judo adulti'], '333 999 9999'])
  ok('le note dicono cosa è entrato a metà', r.note.map((x) => x.riga), [3, 4])

  const f = { corsi: [], iscritti: r.iscritti, righe: { corsi: 0, iscritti: 0, risposte: r.righe }, saltate: r.saltate, note: r.note }
  const prima = (await s.persone()).length
  const a1 = await m.importa(s, f, () => {})
  ok('entrano i tre, con le loro iscrizioni', [a1.iscrittiNuovi, a1.iscrizioniNuove], [3, 4])
  // Nello stesso millisecondo, tre persone diverse: tre id diversi, ognuna coi suoi corsi.
  const nuovi = (await s.persone()).filter((x) => ['Neri', 'Blu'].includes(x.cognome) && x.creataIl)
  ok('tre id diversi', new Set(nuovi.map((x) => x.id)).size, nuovi.length)
  ok('Andrea non ha i corsi di Marco', nuovi.find((x) => x.nome === 'Andrea' && x.email === 'andrea@esempio.it').iscrizioni.map((i) => i.corsoId), ['judo-adulti'])
  const p = await s.persone()
  const giulia = p.find((x) => x.nome === 'Giulia' && x.cognome === 'Neri')
  ok('Giulia con l\'email, Marco senza', [giulia.email, p.find((x) => x.nome === 'Marco' && x.cognome === 'Neri').email], ['mamma@esempio.it', undefined])
  // Il foglio cresce e si reimporta tutto: niente doppioni.
  const a2 = await m.importa(s, f, () => {})
  ok('reimportato: niente di nuovo', [a2.iscrittiNuovi, a2.iscrizioniNuove, (await s.persone()).length - prima], [0, 0, 3])
  // Marco, che entrato senza email, non si confonde con la sorella al secondo giro.
  // Un altro modulo: nome e cognome in una domanda sola, prima quella del genitore.
  const t2 = m.leggiTabella('Timestamp,Nome e cognome del genitore,Nome e cognome dell\'iscritto,Cellulare,Email\n1,Paola Verdi,Maria Luisa Verdi,333,p@e.it\n')
  const c2 = m.indovinaColonne(t2.testa)
  ok('nome e cognome insieme, dell\'iscritto', c2, { nomeCompleto: 2, email: 4, telefono: 3 })
  ok('il cognome è l\'ultima parola', m.leggiRisposte(t2, c2, {}, []).iscritti.map((x) => [x.nome, x.cognome]), [['Maria Luisa', 'Verdi']])
  ok('Marco resta Marco', (await s.persone()).filter((x) => x.cognome === 'Neri').map((x) => x.nome).sort(), ['Giulia', 'Marco'])
}

console.log(guai ? `\n${guai} COSE NON TORNANO` : '\nTUTTO A POSTO')
process.exit(guai ? 1 : 0)
