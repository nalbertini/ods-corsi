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
import { readFileSync } from 'node:fs'
import { build } from 'esbuild'

const { outputFiles } = await build({
  stdin: {
    contents:
      "export { creaSegreteriaProva } from './src/lib/segreteriaProva'; export { tocca, ordinaSegnalazioni, cosaNonVaSegnalazione, etichettaChiudi, chiudiConRisposta, visibili, troppoLungo, avvisoChiusura, rigaFilo, motivoSpento, segnapostoTesto, testoWhatsApp, avvisoCategoria, leggiBozza, scriviBozza, svuotaBozze, chiaveBozza, conBozza, cosaNonVaAllegato, allegatiScaduti, nomeAllegato, nomeUnico, motivoSenzaRete, scegliAllegati, haAnteprima, mandaAllegati, avvisoNonPartiti, MAX_ALLEGATI } from './src/lib/segnalazioni'; export { giornoPerEsteso, chiaveGiorno, oraDi } from './src/lib/sala'; export { comeCertificato, comePaga, confermaMesiPresenze, inRegola, pagamentoDi, paroleInRegola, timbriScheda, trovaIscritti, alGiorno, nomeVoce, corsoCambiato, personaCambiata, ricorrenzaIniziale, ricorrenzaCambiata, COLORI, tastoPrincipale } from './src/lib/segreteria'; export { quoteDi, enteCambiato } from './src/lib/ricevute'; export { cosaNonVaDiretto } from './src/lib/pagamenti'; export { listinoCambiato, cambiNellaBozza, domandaButta } from './src/lib/listino'; export { creaDatiProva } from './src/lib/datiProva'; export { creaTabletProva } from './src/lib/tabletProva'; export { leggiFogli, importa, leggiTabella, indovinaColonne, scelteCorsi, indovinaCorso, leggiRisposte, divideScelte, dividiNome, leggiData } from './src/lib/importa'; export * as importaLib from './src/lib/importa'; export { carattereControllo } from './src/lib/codiceFiscale'; export { arrivoDalLink } from './src/lib/invito'; export { areeDi, daSpunte, nomeDelRuolo, spunteDi } from './src/lib/ruoli'; export { archivio } from './src/lib/archivioProva'; export { creaSegreteriaSupabase } from './src/lib/segreteriaSupabase'; export * from './src/lib/doppioni'; export { memoria, lezioniFra, trovaLezione, segnaIstruttoriLezioneProva } from './src/lib/datiProva'; export { testoDateSalvate, confermaDateCorsi } from './src/lib/segreteria'; export * as segreteriaLib from './src/lib/segreteria'; export { creaDatiSupabase } from './src/lib/datiSupabase'; export { dellaDisciplina } from './timer/src/lib/discipline'; export { tutteLeRighe } from './src/lib/tutteLeRighe'; export { creaRichiesteSupabase } from './src/lib/richiesteSupabase'",
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

// Come Supabase: dalla seconda pagina (`.range()` oltre la prima) un elenco
// finto è finito. Senza, `tutteLeRighe` rileggerebbe le stesse righe per sempre.
const oltre = { then: (f, ko) => Promise.resolve({ data: [], error: null }).then(f, ko) }
const memoria = new Map()
globalThis.localStorage = {
  getItem: (k) => (memoria.has(k) ? memoria.get(k) : null),
  setItem: (k, v) => memoria.set(k, String(v)),
  removeItem: (k) => memoria.delete(k),
}
globalThis.window = { location: { search: '', hash: '' }, addEventListener() {} }

// Oggi, per la prova, è sabato 26 settembre 2026 a mezzogiorno.
// `let`: una prova manda avanti l'orologio, e poi lo rimette.
let OGGI = new Date(2026, 8, 26, 12, 0).getTime()
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

console.log('\n1b. un giorno in un\'altra sala')
{
  // Aikido 2 è in Motricità il lunedì e il giovedì; il giovedì va in Tatami.
  const aikido = async (g) => (await s.settimana(...giorno(g))).find((l) => l.corsoId === 'aikido-2')
  const ric = async () => (await s.corsi()).find((c) => c.id === 'aikido-2').ricorrenze
  const gio = (await ric()).find((r) => r.giorno === 4)
  ok('di partenza nessun giorno ha una sala sua', (await ric()).map((r) => r.salaId ?? null), [null, null])
  await s.salaRicorrenza(gio.id, 'Tatami')
  ok('il giovedì ha la sua sala', (await ric()).map((r) => r.sala ?? null), [null, 'Tatami'])
  ok('la lezione di giovedì è in Tatami', (await aikido([9, 1])).sala, 'Tatami')
  ok('quella di lunedì resta in Motricità', (await aikido([8, 28])).sala, 'Motricità')
  ok('l\'app la vede in Tatami', (await app.calendario(...giorno([9, 1]))).find((l) => l.corsoId === 'aikido-2').sala, 'Tatami')
  const t = m.creaTabletProva()
  await t.scegliSala('Tatami')
  ok('ed è sul tablet del Tatami', (await t.lezioni(...giorno([9, 1]))).some((l) => l.corsoId === 'aikido-2'), true)
  await t.scegliSala('Motricità')
  ok('non su quello di Motricità', (await t.lezioni(...giorno([9, 1]))).some((l) => l.corsoId === 'aikido-2'), false)
  // Spostata a mano per un giorno, e poi «come da corso»: torna nella sala del giovedì.
  const l = await aikido([9, 1])
  await s.aggiornaLezione(l.id, { salaId: 'Lotta' })
  ok('spostata a mano in Lotta', (await aikido([9, 1])).sala, 'Lotta')
  await s.aggiornaLezione(l.id, { salaId: null })
  ok('«come da corso» è la sala del giovedì', (await aikido([9, 1])).sala, 'Tatami')
  // Il corso cambia sala: il lunedì lo segue, il giovedì no.
  const c = (await s.corsi()).find((x) => x.id === 'aikido-2')
  await s.salvaCorso({ id: c.id, nome: c.nome, salaId: 'Pesi', istruttori: c.istruttori.map((i) => i.id), capienza: c.capienza, colore: c.colore })
  ok('il corso in Pesi: lunedì in Pesi, giovedì in Tatami', [(await aikido([8, 28])).sala, (await aikido([9, 1])).sala], ['Pesi', 'Tatami'])
  await s.salaRicorrenza(gio.id, null)
  ok('il giovedì torna nella sala del corso', (await aikido([9, 1])).sala, 'Pesi')
  await s.salaRicorrenza(gio.id, 'Pesi')
  ok('la sala del corso non si scrive sul giorno', (await ric()).map((r) => r.salaId ?? null), [null, null])
  // Un giorno nuovo, già in un'altra sala.
  await s.aggiungiRicorrenza('aikido-2', { giorno: 6, ora: '10:00', durata: 60, salaId: 'Lotta' })
  ok('il sabato nasce in Lotta', (await aikido([9, 3])).sala, 'Lotta')
  // Una sala rinominata si porta dietro anche i giorni.
  await s.salvaSala({ id: 'Lotta', nome: 'Lotta libera' })
  ok('rinominata anche sul sabato', (await aikido([9, 3])).sala, 'Lotta libera')
  await s.salvaSala({ id: 'Lotta libera', nome: 'Lotta' })
  // Il corso va in Lotta: il sabato, che era già lì, torna a seguirlo.
  await s.salvaCorso({ id: c.id, nome: c.nome, salaId: 'Lotta', istruttori: c.istruttori.map((i) => i.id), capienza: c.capienza, colore: c.colore })
  ok('il giorno nella sala del corso torna «come il corso»', (await ric()).map((r) => r.salaId ?? null), [null, null, null])
  await s.salvaCorso({ id: c.id, nome: c.nome, salaId: 'Motricità', istruttori: c.istruttori.map((i) => i.id), capienza: c.capienza, colore: c.colore })
  await s.togliRicorrenza((await ric()).find((r) => r.giorno === 6).id)
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

console.log('\n5b. disattivare chiude le iscrizioni, riattivare non le riapre')
{
  const marco = await s.salvaPersona({ nome: 'Marco', cognome: 'Ritirato', email: 'marco@esempio.it' })
  const altra = await s.salvaPersona({ nome: 'Altra', cognome: 'Rimasta', email: 'altra@esempio.it' })
  await s.iscrivi(marco, 'lotta-2')
  await s.iscrivi(marco, 'lotta-3', '2026-10-05')
  await s.iscrivi(altra, 'lotta-2')
  // Un'iscrizione chiusa nel passato: `termina` non la sa fare, la si mette nell'archivio.
  m.archivio.dati.iscrizioni.push({ corsoId: 'judo-2', personaId: marco, dal: '2026-01-10', al: '2026-06-30' })
  const al = async (p, c) => (await s.persone()).find((x) => x.id === p).iscrizioni.find((i) => i.corsoId === c)?.al
  await s.attivaPersona(marco, false)
  ok('disattivata: l\'aperta si chiude oggi, quella futura al suo dal, quella passata com\'era', [await al(marco, 'lotta-2'), await al(marco, 'lotta-3'), await al(marco, 'judo-2')], ['2026-09-26', '2026-10-05', '2026-06-30'])
  ok('le iscrizioni di un\'altra persona non si toccano', await al(altra, 'lotta-2'), undefined)
  await s.attivaPersona(marco, true)
  ok('riattivata: non si riapre niente', [await al(marco, 'lotta-2'), await al(marco, 'lotta-3'), await al(marco, 'judo-2')], ['2026-09-26', '2026-10-05', '2026-06-30'])
  const [ven] = await lotta2([9, 2])
  ok('e il corso vecchio non la riprende nell\'appello', (await app.dettaglio(ven.id)).elenco.some((p) => p.id === marco), false)
  ok('l\'altra c\'è ancora', (await app.dettaglio(ven.id)).elenco.some((p) => p.id === altra), true)
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
  ok('la sala cambia nome ovunque', [(await s.corsi()).find((c) => c.id === 'pesistica').sala, (await s.sale()).find((x) => x.nome === 'Sala pesi').capienza], ['Sala pesi', 12])
  ok('due sale con lo stesso nome no', await errore(() => s.salvaSala({ nome: 'lotta' })), 'C’è già una sala con questo nome')
  // Le date contano da oggi: una data fissa, col tempo, passerebbe il limite da sola.
  const mesiFa = (n) => {
    const g = new Date()
    g.setMonth(g.getMonth() - n, 15)
    return new Date(g.getFullYear(), g.getMonth(), 15)
  }
  // Una presenza di tre anni fa, messa a mano nella memoria della prova.
  await s.straordinaria('judo-2', new Date(mesiFa(37).setHours(17)), 60)
  const vecchia = (await s.settimana(mesiFa(37), mesiFa(37)))[0]
  m.memoria.segnate = { ...m.memoria.segnate, [vecchia.id]: { 'p-qualcuno': 'presente' } }
  ok('scaduta con ventiquattro mesi', await s.scadute(), 1)
  await s.salvaImpostazioni({ mesiPresenze: 48 })
  ok('non con quarantotto', await s.scadute(), 0)
  await s.salvaImpostazioni({ mesiPresenze: 24 })
  ok('la pulizia la toglie', [await s.pulisci(), await s.scadute()], [1, 0])
  // Prima di accorciare i mesi si chiede quante presenze se ne andrebbero:
  // `scadute(mesi)` conta con quei mesi, senza salvarli.
  await s.straordinaria('judo-2', new Date(mesiFa(30).setHours(17)), 60)
  const di30 = (await s.settimana(mesiFa(30), mesiFa(30)))[0]
  m.memoria.segnate = { ...m.memoria.segnate, [di30.id]: { 'p-qualcuno': 'presente' } }
  ok('con dodici mesi la presenza di trenta mesi fa scadrebbe', await s.scadute(12), 1)
  ok('con trentasei no', await s.scadute(36), 0)
  ok('contare non salva i mesi', (await s.impostazioni()).mesiPresenze, 24)
  ok('senza mesi conta con quelli salvati', await s.scadute(), 1)
  await s.pulisci()

  const conferma = (prima, dopo, scadute, modo = 'supabase') => m.confermaMesiPresenze({ prima, dopo, scadute, modo })
  ok('più mesi: si salva senza chiedere', conferma(24, 36, 5), null)
  ok('meno mesi ma nessuna presenza da cancellare: si salva senza chiedere', conferma(24, 12, 0), null)
  const cinque = conferma(24, 12, 5)
  ok('meno mesi con cinque presenze: si chiede, col numero, i mesi e il primo del mese',
    [cinque?.testo.includes('5 presenze'), cinque?.testo.includes('12 mesi'), cinque?.testo.includes('primo del mese')], [true, true, true])
  ok('il tasto dice i mesi', cinque?.tasto.includes('12 mesi'), true)
  const nonSo = conferma(24, 12, null)
  ok('conteggio non riuscito: si chiede lo stesso, senza un numero di presenze',
    [nonSo !== null, nonSo?.testo.includes('le presenze'), /\d+ presenz/.test(nonSo?.testo ?? ''), nonSo?.tasto.includes('12 mesi')], [true, true, false, true])
  const una = conferma(24, 12, 1)?.testo ?? ''
  const unaProva = conferma(24, 12, 1, 'prova')?.testo ?? ''
  ok('una sola: «1 presenza più vecchia», col database e in prova',
    [una.includes('1 presenza più vecchia'), una.includes('1 presenze'), unaProva.includes('1 presenza più vecchia'), unaProva.includes('vecchie')], [true, false, true, false])
  const inProva = conferma(24, 12, 5, 'prova')?.testo ?? ''
  ok('in prova si parla di CANCELLA ORA, non del primo del mese', [inProva.includes('CANCELLA ORA'), inProva.includes('primo del mese')], [true, false])
  ok('è una domanda: comincia con «Accorciare a 12 mesi?»', [cinque?.testo.startsWith('Accorciare a 12 mesi?'), inProva.startsWith('Accorciare a 12 mesi?')], [true, true])

  // Col database vero: senza mesi conta la vista della pulizia; con altri mesi
  // le presenze delle lezioni iniziate prima del limite, senza salvare niente.
  const chiesto = []
  const conta = m.creaSegreteriaSupabase({
    from: (tabella) => {
      const q = { tabella, filtri: [] }
      chiesto.push(q)
      const passo = {
        select: (colonne, o) => ((q.colonne = colonne), (q.conta = o?.count), passo),
        lt: (colonna, valore) => (q.filtri.push([colonna, valore.slice(0, 10)]), passo),
        then: (fatto) => fatto({ count: 3, error: null }),
      }
      return passo
    },
  })
  const dodiciFa = new Date()
  dodiciFa.setMonth(dodiciFa.getMonth() - 12)
  ok('database, coi mesi salvati: la vista della pulizia', [await conta.scadute(), chiesto[0].tabella, chiesto[0].conta], [3, 'presenze_scadute', 'exact'])
  ok('database, con dodici mesi: presenze delle lezioni di prima di dodici mesi fa',
    [await conta.scadute(12), chiesto[1].tabella, chiesto[1].colonne.includes('sessioni!inner'), chiesto[1].filtri],
    [3, 'presenze', true, [['sessioni.inizio', dodiciFa.toISOString().slice(0, 10)]]])
  const dati = await s.esporta((await app.dettaglio((await lotta2([9, 2]))[0].id)).elenco[0].id)
  ok('l\'esportazione ha anagrafica, iscrizioni, presenze, richieste, certificato, pagamento, ricevute, pagamenti a mano, lettere d\'incarico e ricevute dei compensi', Object.keys(dati).sort(), ['certificato_e_pagamento', 'dati_anagrafici', 'esportato_il', 'iscrizioni', 'lettere_incarico', 'pagamenti_a_mano', 'persona', 'presenze', 'ricevute', 'ricevute_compensi', 'richieste_di_iscrizione'])
}

console.log('\n9b. le ricevute')
{
  const chi = (await s.persone())[0]
  const voce = (prezzo, pagato) => ({ descrizione: 'Annuale Lotta 3', quantita: 1, prezzo, dal: '2026-09-01', al: '2027-06-30', pagamenti: pagato ? [{ data: '2026-09-01', importo: pagato, metodo: 'Bonifico' }] : [] })
  const ente = await s.enteRicevute()
  ok('l\'associazione di partenza', ente.nome, 'Asd Il Centro Judo')
  const socio = await s.intestatarioDi(chi.id)
  ok('il socio ha il suo nome', [socio.nome, socio.cognome], [chi.nome, chi.cognome])
  const base = { data: '2026-09-01', personaId: chi.id, ente, intestatario: socio, anticipo: 0 }
  const prima = await s.emettiRicevuta({ ...base, numero: 116, voci: [voce(36800, 36800)] })
  ok('la prima col numero del programma di prima', [prima.numero, prima.anno, prima.totale, prima.pagato], [116, 2026, 36800, 36800])
  ok('la seguente va avanti da sé', (await s.emettiRicevuta({ ...base, voci: [voce(36800, 18000)] })).numero, 117)
  let no = ''
  await s.emettiRicevuta({ ...base, numero: 116, voci: [voce(100, 0)] }).catch((e) => (no = e.message))
  ok('il numero a mano in un anno che ha già le sue ricevute no', no, 'Il 2026 ha già le sue ricevute: lascia vuoto il numero, prende il primo libero')
  no = ''
  await s.emettiRicevuta({ ...base, data: '2026-09-27', voci: [voce(100, 100)] }).catch((e) => (no = e.message))
  ok('una data nel futuro no', no, 'La data della ricevuta è nel futuro: si fa per quel che è già successo')
  no = ''
  await s.emettiRicevuta({ ...base, voci: [voce(100, 200)] }).catch((e) => (no = e.message))
  ok('pagato più del totale no', no, 'Si è pagato più del totale: controlla gli importi')
  // Un anno prima, che non ha ricevute: si parte da 1 (nel futuro non si può).
  ok('un altro anno riparte da 1', (await s.emettiRicevuta({ ...base, data: '2025-01-10', voci: [voce(100, 100)] })).numero, 1)
  await s.annullaRicevuta(prima.id)
  const sue = await s.ricevute(chi.id)
  ok('le sue, dalla più recente, anche l\'annullata', sue.map((r) => [r.numero, !!r.annullataIl]), [[117, false], [116, true], [1, false]])
  ok('il prossimo numero salta l\'annullata', await s.prossimoNumero(2026), 118)
  ok('i dati del socio ora vengono dall\'ultima ricevuta', (await s.intestatarioDi(chi.id)).cognome, chi.cognome)
  await s.salvaEnteRicevute({ ...ente, nome: 'Asd Nuova' })
  ok('l\'associazione cambiata', (await s.enteRicevute()).nome, 'Asd Nuova')
  ok('le ricevute nell\'esportazione', (await s.esporta(chi.id)).ricevute.length, 3)
  // Una ricevuta vecchia senza codice fiscale: quello scritto dopo in DATI ANAGRAFICI ci va lo stesso.
  await s.emettiRicevuta({ ...base, data: '2026-09-20', intestatario: { nome: chi.nome, cognome: chi.cognome, indirizzo: 'via Vecchia 3' }, voci: [voce(100, 100)] })
  await s.salvaAnagrafica(chi.id, { codiceFiscale: 'RSSMRA80A01L219X', indirizzo: 'via Altra 9' })
  const dopo = await s.intestatarioDi(chi.id)
  ok('il codice fiscale scritto dopo la ricevuta vecchia: c\'è', dopo.codiceFiscale, 'RSSMRA80A01L219X')
  ok('e quel che la ricevuta dice già resta', dopo.indirizzo, 'via Vecchia 3')
}

console.log('\n9b. le parole della quota')
ok('la quota, in una parola', ['pagato', 'in_parte', 'scaduto', 'da_pagare'].map((c) => m.segreteriaLib.etichettaQuota(c)), ['PAGATA', 'IN PARTE', 'SCADUTA', 'DA PAGARE'])

console.log('\n9c. i pagamenti a mano')
{
  const a = await s.salvaPersona({ nome: 'Pia', cognome: 'Pagamenti' })
  const b = await s.salvaPersona({ nome: 'Pia', cognome: 'Pagamenti' })
  const dato = (personaId, data, importo, altro = {}) => ({ personaId, data, importo, metodo: 'Contanti', voce: 'QUOTA ASSOCIATIVA', ...altro })
  const vecchio = await s.registraPagamentoDiretto(dato(a, '2026-09-10', 5000, { nota: 'in palestra' }))
  const nuovo = await s.registraPagamentoDiretto(dato(a, '2026-09-25', 2000, { metodo: 'Satispay' }))
  await s.registraPagamentoDiretto(dato(b, '2026-09-20', 1000))
  ok('un pagamento registrato ha id e data di creazione', [typeof vecchio.id, !!vecchio.creatoIl, vecchio.annullatoIl ?? null], ['string', true, null])
  ok('i suoi, il più recente in cima', (await s.pagamentiDiretti(a)).map((p) => [p.data, p.importo, p.metodo]), [['2026-09-25', 2000, 'Satispay'], ['2026-09-10', 5000, 'Contanti']])
  ok('quelli di un\'altra scheda non ci sono', (await s.pagamentiDiretti(a)).every((p) => p.personaId === a), true)
  ok('senza persona: tutti', (await s.pagamentiDiretti()).length >= 3, true)
  ok('la nota resta', (await s.pagamentiDiretti(a)).find((p) => p.id === vecchio.id).nota, 'in palestra')
  ok('data sbagliata no', await errore(() => s.registraPagamentoDiretto(dato(a, '10/09/2026', 100))), m.cosaNonVaDiretto(dato(a, '10/09/2026', 100)))
  ok('importo a zero no', typeof (await errore(() => s.registraPagamentoDiretto(dato(a, '2026-09-10', 0)))), 'string')
  ok('importo con i decimali no', (await errore(() => s.registraPagamentoDiretto(dato(a, '2026-09-10', 10.5)))) !== 'nessun errore', true)
  ok('metodo vuoto no', (await errore(() => s.registraPagamentoDiretto(dato(a, '2026-09-10', 100, { metodo: '' })))) !== 'nessun errore', true)
  ok('voce vuota no', (await errore(() => s.registraPagamentoDiretto(dato(a, '2026-09-10', 100, { voce: '' })))) !== 'nessun errore', true)
  ok('nota oltre 300 caratteri no', (await errore(() => s.registraPagamentoDiretto(dato(a, '2026-09-10', 100, { nota: 'x'.repeat(301) })))) !== 'nessun errore', true)
  ok('senza persona no', (await errore(() => s.registraPagamentoDiretto(dato('', '2026-09-10', 100)))) !== 'nessun errore', true)
  ok('i rifiutati non sono entrati', (await s.pagamentiDiretti(a)).length, 2)
  // Oggi, nella prova, è il 26 settembre 2026: un pagamento a mano è quel che è già successo.
  // Una persona sua: se il codice non rifiuta, gli altri casi di questa sezione non ne risentono.
  const f = await s.salvaPersona({ nome: 'Fabio', cognome: 'Futuro' })
  const FUTURO = 'La data è nel futuro: si registra quel che è già successo'
  const entratiF = []
  const provaF = async (data, metodo = 'Contanti') => {
    let id
    const esito = await errore(async () => { id = (await s.registraPagamentoDiretto(dato(f, data, 100, { metodo }))).id })
    if (id) {
      entratiF.push(data)
      await s.annullaPagamentoDiretto(id)
    }
    return esito
  }
  ok('domani no', await provaF('2026-09-27'), FUTURO)
  ok('il 2099 no', await provaF('2099-01-01'), FUTURO)
  ok('nemmeno con un altro modo di pagare', await provaF('2026-09-27', 'Bonifico'), FUTURO)
  ok('la persona che non c\'è viene prima della data, come nel database', await errore(() => s.registraPagamentoDiretto(dato('p-non-esiste', '2026-09-27', 100))), 'Questa scheda non c’è più')
  ok('i pagamenti del futuro non sono entrati', entratiF, [])

  await s.annullaPagamentoDiretto(nuovo.id)
  const dopo = await s.pagamentiDiretti(a)
  ok('annullato resta in elenco, con annullatoIl', dopo.map((p) => [p.id === nuovo.id, !!p.annullatoIl]), [[true, true], [false, false]])
  ok('annullarlo due volte no: già annullato', await errore(() => s.annullaPagamentoDiretto(nuovo.id)), 'Pagamento inesistente o già annullato')
  ok('un id che non c\'è no', (await errore(() => s.annullaPagamentoDiretto('non-esiste'))) !== 'nessun errore', true)

  ok('una persona che non c\'è: la frase del database', await errore(() => s.registraPagamentoDiretto(dato('p-non-esiste', '2026-09-10', 100))), 'Questa scheda non c’è più')
  ok('una persona che non c\'è e un importo sbagliato: prima la persona, come il database', await errore(() => s.registraPagamentoDiretto(dato('p-non-esiste', '2026-09-10', 0))), 'Questa scheda non c’è più')
  ok('annullare un id che non c\'è: la stessa frase', await errore(() => s.annullaPagamentoDiretto('non-esiste')), 'Pagamento inesistente o già annullato')

  await s.unisciPersone(a, b)
  ok('unite due schede, i pagamenti a mano passano a quella che resta', (await s.pagamentiDiretti(a)).map((p) => [p.data, p.importo]), [['2026-09-25', 2000], ['2026-09-20', 1000], ['2026-09-10', 5000]])
  ok('e nessuno resta alla scheda che se ne va', (await s.pagamentiDiretti(b)).length, 0)
  ok('l\'annullato resta annullato', (await s.pagamentiDiretti(a)).filter((p) => p.annullatoIl).length, 1)

  // Come `registra_pagamento_diretto`: testo senza spazi attorno, la nota di soli spazi è vuota.
  const c = await s.salvaPersona({ nome: 'Carla', cognome: 'Spazi' })
  const pulito = await s.registraPagamentoDiretto(dato(c, '2026-09-25', 300, { metodo: '  POS  ', voce: '  ALTRO ', nota: '   ' }))
  ok('metodo e voce senza spazi, la nota di soli spazi non c\'è', [pulito.metodo, pulito.voce, pulito.nota ?? null], ['POS', 'ALTRO', null])
  const conNota = await s.registraPagamentoDiretto(dato(c, '2026-09-26', 300, { metodo: 'Bonifico', nota: '  ciao  ' }))
  ok('la nota si pulisce dagli spazi attorno', conNota.nota, 'ciao')
  const oggiStesso = await s.registraPagamentoDiretto(dato(c, '2026-09-26', 100, { metodo: 'Bonifico' }))
  ok('oggi va', oggiStesso.data, '2026-09-26')
  const vecchissimo = await s.registraPagamentoDiretto(dato(c, '2020-03-04', 100, { metodo: 'Bonifico' }))
  ok('il passato non ha soglie nuove: il 4 marzo 2020 va', vecchissimo.data, '2020-03-04')
}

console.log('\n10. l\'import dai fogli')
{
  const corsi = 'nome;sala;istruttore;giorno;ora;durata\r\nYoga;Sala nuova;Katia;sabato;10.00;60\r\nLotta 2;Lotta;Maura;sabato;11:00;60\r\nRotto;Pesi;;funedì;18:00;60\r\n'
  const iscritti = '\uFEFFnome;cognome;email;telefono;corso\nMarta;Nuova;marta@esempio.it;;Yoga\nGiorgia;;;;Yoga\nMarta;Nuova;marta@esempio.it;;Lotta 2\nPaolo;Verdi;marta@esempio.it;;Yoga\n'
  const f = m.leggiFogli(corsi, iscritti, (await s.corsi()).map((c) => c.nome))
  ok('le righe che non vanno', f.saltate.map((x) => `${x.foglio}:${x.riga}`), ['corsi.csv:4', 'iscritti.csv:3'])
  ok('Marta una volta sola, con due corsi', f.iscritti.map((x) => [x.nome, x.corsi]), [['Marta', ['Yoga', 'Lotta 2']], ['Paolo', ['Yoga']]])
  ok('Paolo, con la stessa email di Marta: entra con quella, senza note', [f.iscritti[1].email, f.note.length], ['marta@esempio.it', 0])
  const a1 = await m.importa(s, f, () => {})
  ok('entrano la sala, il corso, i giorni', [a1.saleNuove, a1.corsiNuovi, a1.ricorrenzeNuove], [['Sala nuova'], ['Yoga'], 2])
  ok('Katia si lega col solo nome', (await s.corsi()).find((c) => c.nome === 'Yoga').istruttori.map((i) => i.nome), ['Katia'])
  const a2 = await m.importa(s, m.leggiFogli(corsi, iscritti, (await s.corsi()).map((c) => c.nome)), () => {})
  ok('rifatto: niente di nuovo', [a2.saleNuove.length, a2.corsiNuovi.length, a2.ricorrenzeNuove, a2.iscrittiNuovi, a2.iscrizioniNuove], [0, 0, 0, 0, 0])
  ok('e nessun doppione', (await s.persone()).filter((p) => p.nome === 'Marta' && p.cognome === 'Nuova').length, 1)
  ok('Paolo c\'è, una volta', (await s.persone()).filter((p) => p.nome === 'Paolo' && p.cognome === 'Verdi').map((p) => p.email ?? null), ['marta@esempio.it'])

  // Un altro foglio, dopo: il fratello con l'email di Marta resta una scheda a sé.
  const altro = 'nome;cognome;email;telefono;corso\nLuca;Nuova;MARTA@esempio.it;333;Lotta 2\n'
  const f3 = m.leggiFogli(null, altro, (await s.corsi()).map((c) => c.nome))
  const a3 = await m.importa(s, f3, () => {})
  ok('Luca entra nuovo', a3.iscrittiNuovi, 1)
  const luca = (await s.persone()).filter((p) => p.nome === 'Luca' && p.cognome === 'Nuova')
  ok('Luca a sé, con l’email di Marta, con Lotta 2', luca.map((p) => [p.email ?? null, p.iscrizioni.length]), [['marta@esempio.it', 1]])
  const a4 = await m.importa(s, m.leggiFogli(null, altro, (await s.corsi()).map((c) => c.nome)), () => {})
  ok('rifatto: Luca non si duplica', [a4.iscrittiNuovi, a4.iscrizioniNuove, (await s.persone()).filter((p) => p.nome === 'Luca' && p.cognome === 'Nuova').length], [0, 0, 1])
}

console.log('\n10b. l\'import con un giorno in un\'altra sala')
{
  // La sala della prima riga è quella del corso; una riga con un'altra sala è quel giorno lì.
  const corsi = 'nome;sala;istruttore;giorno;ora;durata\nTai chi;;;lunedì;09:00;60\nTai chi;Tatami;;martedì;09:00;60\nTai chi;Lotta;;giovedì;09:00;60\nTai chi;Terrazza;;venerdì;09:00;60\n'
  const f = m.leggiFogli(corsi, null, (await s.corsi()).map((c) => c.nome))
  const a = await m.importa(s, f, () => {})
  ok('la sala che c\'è solo su un giorno entra lo stesso', a.saleNuove, ['Terrazza'])
  const tc = (await s.corsi()).find((c) => c.nome === 'Tai chi')
  ok('il corso in Tatami, due giorni altrove', [tc.sala, tc.ricorrenze.map((r) => r.sala ?? null)], ['Tatami', [null, null, 'Lotta', 'Terrazza']])
  const lezioni = (await s.settimana(...giorno([8, 28], [9, 2]))).filter((l) => l.corsoId === tc.id)
  ok('e le lezioni sono dove devono', lezioni.map((l) => l.sala), ['Tatami', 'Tatami', 'Lotta', 'Terrazza'])
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
  ok('le colonne si riconoscono, il genitore a parte', col, { cognome: 3, nome: 2, email: 1, telefono: 5, corsi: 6, dataRisposta: 0, genitore: 4 })
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
  ok('Marco, la stessa email della sorella: la tiene', [r.iscritti[1].email, r.iscritti[1].telefono], ['mamma@esempio.it', '347 000 1111'])
  ok('Andrea due volte: una persona, l\'ultimo telefono', [r.iscritti[2].corsi, r.iscritti[2].telefono], [['Judo adulti'], '333 999 9999'])
  // La riga 5 è la nota dei due telefoni diversi di Andrea (vale l'ultimo e lo dice).
  ok('le note dicono cosa è entrato a metà', r.note.map((x) => x.riga), [4, 5])

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
  ok('Giulia e Marco, la stessa email', [giulia.email, p.find((x) => x.nome === 'Marco' && x.cognome === 'Neri').email], ['mamma@esempio.it', 'mamma@esempio.it'])
  // Il foglio cresce e si reimporta tutto: niente doppioni.
  const a2 = await m.importa(s, f, () => {})
  ok('reimportato: niente di nuovo', [a2.iscrittiNuovi, a2.iscrizioniNuove, (await s.persone()).length - prima], [0, 0, 3])
  // Marco, che entrato senza email, non si confonde con la sorella al secondo giro.
  // Un altro modulo: nome e cognome in una domanda sola, prima quella del genitore.
  const t2 = m.leggiTabella('Timestamp,Nome e cognome del genitore,Nome e cognome dell\'iscritto,Cellulare,Email\n1,Paola Verdi,Maria Luisa Verdi,333,p@e.it\n')
  const c2 = m.indovinaColonne(t2.testa)
  ok('nome e cognome insieme, dell\'iscritto', c2, { nomeCompleto: 2, email: 4, telefono: 3, dataRisposta: 0, genitore: 1 })
  ok('il cognome è l\'ultima parola', m.leggiRisposte(t2, c2, {}, []).iscritti.map((x) => [x.nome, x.cognome]), [['Maria Luisa', 'Verdi']])
  ok('Marco resta Marco', (await s.persone()).filter((x) => x.cognome === 'Neri').map((x) => x.nome).sort(), ['Giulia', 'Marco'])

  // Il modulo con le sezioni: «COGNOME NOME» in una casella, scritto un po'
  // come capita, e le domande ripetute per i minorenni.
  const t3 = m.leggiTabella([
    'Informazioni cronologiche,Indirizzo email,COGNOME NOME ATLETA,CODICE FISCALE ATLETA,"NUMERO DI TELEFONO\n(per il gruppo)",Nome cognome genitore/tutore,CODICE FISCALE ATLETA,"NUMERO DI TELEFONO\n(per il gruppo)",CORSO (selezionare TUTTI i corsi)',
    '1,mario.rossi@esempio.it,Rossi,RSSMRA80A01L219X,333 111,,,,Judo adulti',
    '2,anna@esempio.it,Bianchi Anna,BNCNNA85C41L219Y,333 222,,,,Judo adulti',
    '3,papa@esempio.it,Sara De Luca,,,Carlo De Luca,DLCSRA15D45L219Z,333 333,Judo 2',
    '4,x@esempio.it,Verdi,,,,,,Judo 2',
  ].join('\n'))
  const c3 = m.indovinaColonne(t3.testa)
  ok('il codice fiscale dell\'atleta, non del genitore', c3, { nomeCompleto: 2, codiceFiscale: 3, email: 1, telefono: 4, corsi: 8, dataRisposta: 0, genitore: 5 })
  const r3 = m.leggiRisposte(t3, c3, { 'Judo adulti': 'judo-adulti', 'Judo 2': 'judo-2' }, corsi)
  ok('il codice dice cosa è il nome e cosa il cognome', r3.iscritti.map((x) => [x.nome, x.cognome]), [['Mario', 'Rossi'], ['Anna', 'Bianchi'], ['Sara', 'De Luca']])
  ok('la colonna vuota prende quella con la stessa domanda', r3.iscritti[2].telefono, '333 333')
  ok('il nome dall\'email si dice, senza codice si salta', [r3.note.filter((x) => /email/.test(x.motivo)).map((x) => x.riga), r3.saltate.map((x) => x.riga)], [[2], [5]])
  ok('senza codice, il cognome è l\'ultima parola', m.dividiNome('Rossi Mario'), { nome: 'Rossi', cognome: 'Mario' })
  ok('e un nome dall\'email che non torna col codice non si prende', m.dividiNome('Rossi', 'RSSMRA80A01L219X', 'luigi.rossi@esempio.it'), null)

  // Nascita, residenza e genitore, com'erano nel modulo Google: il genitore
  // che si è iscritto anche lui si riconosce, col suo codice fiscale.
  ok('le date come si scrivono', ['13/06/2014', '3-6-14', '2014-06-13', '31/02/2014', '1/1/2090'].map((x) => m.leggiData(x, new Date(2026, 8, 30))), ['2014-06-13', '2014-06-03', '2014-06-13', null, null])
  const t4 = m.leggiTabella([
    'Informazioni cronologiche,Indirizzo email,COGNOME NOME ATLETA,LUOGO DI NASCITA ATLETA,DATA DI NASCITA ATLETA,CODICE FISCALE ATLETA,CITTÀ DI RESIDENZA,INDIRIZZO DI RESIDENZA,NUMERO DI TELEFONO,Nome cognome genitore/tutore,Luogo e data di nascita genitore,CORSO',
    '1,luca.gialli@esempio.it,Gialli,Torino,15/03/1980,GLLLCU80C15L219D,Collegno,via Roma 1,333 1,,,Judo adulti',
    '2,luca.gialli@esempio.it,Emma Gialli,Torino,04/05/2016,GLLMME16E44L219J,Collegno,via Roma 1,333 1,Luca Gialli,"Torino, 15/03/1980",Judo 2',
    '3,z@esempio.it,Zeta Anna,Asti,32/13/1990,,Rivoli,,333 3,Mario Zeta,,Judo adulti',
  ].join('\n'))
  const c4 = m.indovinaColonne(t4.testa)
  ok('nascita, residenza e genitore si riconoscono', [c4.natoA, c4.natoIl, c4.codiceFiscale, c4.comune, c4.indirizzo, c4.genitore, c4.genitoreNato], [3, 4, 5, 6, 7, 9, 10])
  const r4 = m.leggiRisposte(t4, c4, { 'Judo adulti': 'judo-adulti', 'Judo 2': 'judo-2' }, corsi)
  const [luca, emma, anna] = r4.iscritti
  ok('Luca, dall\'email e dal codice', [luca.nome, luca.cognome, luca.anagrafica], ['Luca', 'Gialli', { natoIl: '1980-03-15', codiceFiscale: 'GLLLCU80C15L219D', natoA: 'Torino', comune: 'Collegno', indirizzo: 'via Roma 1' }])
  ok('Emma: il genitore è Luca, col suo codice', [emma.anagrafica.genitoreNome, emma.anagrafica.genitoreCognome, emma.anagrafica.genitoreCodiceFiscale, emma.anagrafica.genitoreNato], ['Luca', 'Gialli', 'GLLLCU80C15L219D', 'Torino, 15/03/1980'])
  ok('una data che non esiste resta fuori, e senza data il genitore resta: l\'età non si sa', [anna.anagrafica.natoIl, anna.anagrafica.genitoreCognome, anna.anagrafica.comune], [undefined, 'Zeta', 'Rivoli'])
  ok('la data sbagliata si dice', r4.note.some((x) => x.riga === 4 && /data di nascita «32\/13\/1990»/.test(x.motivo)), true)
  const t5 = m.leggiTabella('Email,Nome,Cognome,Data di nascita,Nome e cognome del genitore\nx@y.it,Carla,Neri,01/01/1990,Paola Neri\n')
  const r5 = m.leggiRisposte(t5, m.indovinaColonne(t5.testa), {}, [])
  ok('a una maggiorenne il genitore non si mette', [r5.iscritti[0].anagrafica, r5.note.map((x) => x.motivo)], [{ natoIl: '1990-01-01' }, ['Carla Neri: è maggiorenne, il genitore scritto nel modulo non entra']])

  const a4 = await m.importa(s, { corsi: [], iscritti: r4.iscritti, righe: { corsi: 0, iscritti: 0, risposte: r4.righe }, saltate: [], note: r4.note }, () => {})
  ok('tre con nascita o residenza', a4.anagrafiche, 3)
  const emmaDentro = (await s.persone()).find((x) => x.nome === 'Emma' && x.cognome === 'Gialli')
  const intest = await s.intestatarioDi(emmaDentro.id)
  ok('la ricevuta di Emma ha i suoi dati e il genitore', [intest.natoIl, intest.codiceFiscale, intest.indirizzo, intest.comune, intest.genitore, intest.genitoreCodiceFiscale], ['2016-05-04', 'GLLMME16E44L219J', 'via Roma 1', 'Collegno', 'Gialli Luca', 'GLLLCU80C15L219D'])
  ok('e l\'esportazione i dati anagrafici', (await s.esporta(emmaDentro.id)).dati_anagrafici.natoA, 'Torino')
  const perScheda = await s.anagraficaDi(emmaDentro.id)
  ok('la scheda li mostra, dall\'import', [perScheda.da, perScheda.dati.natoIl, perScheda.dati.genitoreCognome], ['segreteria', '2016-05-04', 'Gialli'])
  const senza = (await s.persone()).find((x) => x.nome === 'Andrea' && x.cognome === 'Blu')
  ok('chi non ha niente non ha niente', await s.anagraficaDi(senza.id), null)
  // La MODIFICA della scheda: tutto quello che si manda, e un campo vuoto si cancella.
  await s.salvaAnagrafica(emmaDentro.id, { ...perScheda.dati, codiceFiscale: 'gllmme16e44l219j ', genitoreNato: '' }, true)
  const corretta = (await s.anagraficaDi(emmaDentro.id)).dati
  ok('la modifica: il codice in maiuscolo, il campo vuoto via, il resto resta', [corretta.codiceFiscale, corretta.genitoreNato, corretta.natoA], ['GLLMME16E44L219J', undefined, 'Torino'])
  ok('e la ricevuta dopo prende i dati corretti', (await s.intestatarioDi(emmaDentro.id)).codiceFiscale, 'GLLMME16E44L219J')
  let detto = ''
  try { await s.salvaAnagrafica(emmaDentro.id, { cap: '100' }, true) } catch (e) { detto = e.message }
  ok('un CAP di tre cifre no', detto, 'Il CAP ha cinque cifre')
  ok('e non ha cancellato niente', (await s.anagraficaDi(emmaDentro.id)).dati.natoA, 'Torino')
  // Reimportato con una risposta che dice meno: quello che c'era resta.
  await s.salvaAnagrafica(emmaDentro.id, { comune: 'Rivoli', indirizzo: '' })
  ok('una risposta nuova aggiunge e non cancella', [(await s.intestatarioDi(emmaDentro.id)).comune, (await s.intestatarioDi(emmaDentro.id)).indirizzo], ['Rivoli', 'via Roma 1'])
  // Chi è già in palestra: il modulo riempie solo i campi vuoti, e non rimette il vecchio sulle correzioni a mano.
  const schedaPrima = (await s.anagraficaDi(emmaDentro.id)).dati
  const emmaModulo = { ...emma, anagrafica: { codiceFiscale: 'GLLMME16E44L219X', cap: '10100', indirizzo: 'via Altra 2', genitoreNome: 'Paolo', genitoreNato: 'Asti, 01/01/1980', natoA: 'Asti' } }
  await m.importa(s, { corsi: [], iscritti: [emmaModulo], righe: { corsi: 0, iscritti: 0, risposte: 1 }, saltate: [], note: [] }, () => {})
  const dopo = (await s.anagraficaDi(emmaDentro.id)).dati
  ok('reimport su chi è in palestra: il codice fiscale corretto a mano resta', dopo.codiceFiscale, schedaPrima.codiceFiscale)
  ok('…l\'indirizzo, il luogo di nascita e il genitore già compilati restano', [dopo.indirizzo, dopo.natoA, dopo.genitoreNome], [schedaPrima.indirizzo, schedaPrima.natoA, schedaPrima.genitoreNome])
  ok('…il CAP e il genitore vuoti nella scheda entrano', [dopo.cap, dopo.genitoreNato], ['10100', 'Asti, 01/01/1980'])
}

console.log('\n12. l\'import: ricaricare il foglio, doppioni, resoconto, archiviati, data d\'iscrizione')
{
  // `prova` registra un errore lanciato come risultato, così una prova che cade non ferma le altre.
  const il = m.importaLib
  const prova = async (cosa, f, voluto) => {
    let avuto
    try { avuto = await f() } catch (e) { avuto = `ERRORE: ${e.message}` }
    ok(cosa, avuto, voluto)
  }
  const nomiCorsi = async () => (await s.corsi()).map((c) => c.nome)
  const situazione = async () => {
    const [sale, personale, corsi, persone] = await Promise.all([s.sale(), s.personale(), s.corsi(), s.persone()])
    return { sale, personale, corsi, persone }
  }
  const excel = async (righe) => m.leggiFogli(null, 'nome;cognome;email;telefono;corso\n' + righe.join('\n') + '\n', await nomiCorsi())
  const risposte = async (testa, righe, extra = {}) => {
    const t = m.leggiTabella([testa, ...righe].join('\n'))
    const r = m.leggiRisposte(t, { ...m.indovinaColonne(t.testa), ...extra }, { 'Judo 2': 'judo-2', 'Judo adulti': 'judo-adulti' }, (await s.corsi()).map((c) => ({ id: c.id, nome: c.nome })))
    return { corsi: [], iscritti: r.iscritti, righe: { corsi: 0, iscritti: 0, risposte: r.righe }, saltate: r.saltate, note: r.note }
  }
  const persona = async (nome, cognome) => (await s.persone()).find((p) => p.nome === nome && p.cognome === cognome)
  const quante = async () => (await s.persone()).length

  // 1. Ricaricare un file già importato.
  const base = ['Mario;D\'Angelo;;;Judo 2', 'Anna;De Luca;;;Judo 2', 'Luigi;Dell\'Aglio;;;Lotta 2', 'Nicolò;Bianchi;;;Lotta 2']
  await m.importa(s, await excel(base), () => {})
  let n = await quante()
  let a = await m.importa(s, await excel(base), () => {})
  ok('lo stesso file due volte: 0 iscritti nuovi, 0 iscrizioni nuove, persone invariate', [a.iscrittiNuovi, a.iscrizioniNuove, (await quante()) - n], [0, 0, 0])
  a = await m.importa(s, await excel(['MARIO;D’ANGELO;;;Judo 2', 'Anna;Deluca;;;Judo 2', 'luigi;dell’aglio;;;Lotta 2', 'Nicolo;BIANCHI;;;Lotta 2']), () => {})
  ok('lo stesso file riscritto con maiuscole, accenti, apostrofi e doppi cognomi diversi: nessuno nuovo', [a.iscrittiNuovi, a.iscrizioniNuove, (await quante()) - n], [0, 0, 0])

  // 2. Il controllo, riga per riga, col nome.
  const f2 = await excel(['Mario;D\'Angelo;;;Judo 2', 'Giorgia;;;;Judo 2', 'Teresa;Nuova;teresa@esempio.it;;Judo 2', 'Paolo;Nuova;teresa@esempio.it;;Judo 2'])
  await prova('il controllo elenca ogni riga col nome e cosa succede', async () => il.controllaRighe(f2, await situazione()).righe.map((r) => [r.riga, r.nome, r.esito]),
    [[2, 'Mario D\'Angelo', 'in_palestra'], [3, 'Giorgia', 'da_sistemare'], [4, 'Teresa Nuova', 'nuova'], [5, 'Paolo Nuova', 'nuova']])
  await prova('e i totali per tipo', async () => il.controllaRighe(f2, await situazione()).totali, { nuova: 2, in_palestra: 1, da_sistemare: 1 })
  await prova('la riga da sistemare dice perché', async () => il.controllaRighe(f2, await situazione()).righe[1].motivo, 'Manca il cognome: «Giorgia», Judo 2')
  await prova('il fratello con l\'email del genitore resta una persona a sé, senza avvisi', async () => {
    const r = il.controllaRighe(f2, await situazione()).righe[3]
    return [r.esito, r.avvisi.length]
  }, ['nuova', 0])

  // 3. Possibili doppioni.
  await s.salvaPersona({ nome: 'Manuel', cognome: 'Prudente' })
  const testa = 'Informazioni cronologiche,Email,Nome e cognome,Codice fiscale,Corsi'
  const rd = await risposte(testa, [
    '1,p1@esempio.it,Prudente Manuel,,Judo 2',
    '2,p2@esempio.it,D’ANGELO MARIO,,Judo 2',
    '3,p3@esempio.it,De Luca Anna,,Judo 2',
    '4,p4@esempio.it,DELL\'AGLIO LUIGI,,Judo 2',
    '5,p5@esempio.it,Nicolò Bianchi,,Judo 2',
  ])
  ok('ogni riga porta il suo numero di riga del foglio', rd.iscritti.map((x) => x.riga), [2, 3, 4, 5, 6])
  await prova('«Prudente Manuel» con in app «Manuel Prudente»: forse è lui, e il nome giusto è scritto', async () => {
    const r = il.controllaRighe(rd, await situazione()).righe
    return r.slice(0, 4).map((x) => [x.esito, x.motivo])
  }, [
    ['da_sistemare', 'forse è già in palestra come Manuel Prudente'],
    ['da_sistemare', 'forse è già in palestra come Mario D\'Angelo'],
    ['da_sistemare', 'forse è già in palestra come Anna De Luca'],
    ['da_sistemare', 'forse è già in palestra come Luigi Dell\'Aglio'],
  ])
  await prova('stesso nome nell\'ordine giusto, solo con l\'accento diverso: è già in palestra, senza avviso', async () => {
    const x = il.controllaRighe(rd, await situazione()).righe[4]
    return [x.esito, x.motivo, x.avvisi]
  }, ['in_palestra', undefined, []])
  n = await quante()
  a = await m.importa(s, rd, () => {})
  ok('senza una scelta nessuno dei dubbi crea una persona nuova', [a.iscrittiNuovi, (await quante()) - n], [0, 0])
  await prova('e il resoconto li elenca', () => a.daSistemare.map((x) => [x.riga, x.nome]), [[2, 'Prudente Manuel'], [3, 'D’ANGELO MARIO'], [4, 'De Luca Anna'], [5, 'DELL\'AGLIO LUIGI']])
  a = await m.importa(s, rd, () => {}, { 'risposte:2': { doppione: 'lega' }, 'risposte:3': { doppione: 'nuova' } })
  ok('«lega» mette Manuel sulla scheda che c\'è, «nuova» ne crea una', [(await quante()) - n, (await persona('Manuel', 'Prudente')).iscrizioni.map((i) => i.corsoId)], [1, ['judo-2']])
  // Col codice fiscale che dà l'ordine si lega senza dubbi.
  const corpo = 'PRDMNL90A01L219'
  const cf = corpo + m.carattereControllo(corpo)
  const rc = await risposte(testa, [`1,cf@esempio.it,Prudente Manuel,${cf},Judo adulti`])
  await prova('col codice fiscale che dà l\'ordine: Manuel Prudente, già in palestra, senza avviso', async () => {
    const x = il.controllaRighe(rc, await situazione()).righe[0]
    return [x.nome, x.esito, x.motivo, x.avvisi, rc.note.length]
  }, ['Manuel Prudente', 'in_palestra', undefined, [], 0])

  // 4. L'email di un istruttore o della segreteria.
  await s.salvaPersonale({ nome: 'Ilaria', cognome: 'Istruttrice', email: 'istr.import@esempio.it', ruolo: 'istruttore' })
  await s.salvaPersonale({ nome: 'Sara', cognome: 'Segreteria', email: 'seg.import@esempio.it', ruolo: 'staff' })
  const f4 = await excel(['Zeno;Primo;zeno@esempio.it;;Judo 2', 'Ugo;Istr;ISTR.import@esempio.it;;Judo 2', 'Vera;Secondo;vera@esempio.it;;Judo 2', 'Sandro;Seg;seg.import@esempio.it;;Judo 2', 'Wanda;Terza;wanda@esempio.it;;Judo 2'])
  // L'email del personale non è un blocco: l'iscritto entra con quell'indirizzo, la regola dell'unicità vale solo per chi ha l'accesso.
  await prova('l\'email di un istruttore o della segreteria: entra lo stesso, nessuna riga da sistemare', async () => il.controllaRighe(f4, await situazione()).righe.map((r) => [r.riga, r.esito, r.motivo]),
    [[2, 'nuova', undefined], [3, 'nuova', undefined], [4, 'nuova', undefined], [5, 'nuova', undefined], [6, 'nuova', undefined]])
  n = await quante()
  const senzaFermarsi = async (f) => { try { return await f() } catch (e) { ok('l\'import non si ferma per una riga', `ERRORE: ${e.message}`, 'nessun errore'); return { daSistemare: [] } } }
  a = await senzaFermarsi(() => m.importa(s, f4, () => {}))
  ok('importando entrano tutte e cinque, anche chi ha l\'email del personale', [(await quante()) - n, !!(await persona('Zeno', 'Primo')), !!(await persona('Wanda', 'Terza')), !!(await persona('Ugo', 'Istr'))], [5, true, true, true])
  await prova('Ugo e Sandro: entrano con l\'indirizzo del personale', async () => [await persona('Ugo', 'Istr'), await persona('Sandro', 'Seg')].map((p) => p.email ?? null),
    ['istr.import@esempio.it', 'seg.import@esempio.it'])
  await prova('l\'istruttrice e la segreteria restano come sono', async () => (await s.personale()).filter((q) => ['Ilaria', 'Sara'].includes(q.nome) && ['Istruttrice', 'Segreteria'].includes(q.cognome)).map((q) => [q.nome, q.email]).sort(),
    [['Ilaria', 'istr.import@esempio.it'], ['Sara', 'seg.import@esempio.it']])
  await prova('e il resoconto non ha righe da sistemare', () => a.daSistemare, [])
  n = await quante()
  a = await senzaFermarsi(() => m.importa(s, f4, () => {}))
  ok('rifatto: nessuno si duplica, nemmeno chi è entrato col contatto', [a.iscrittiNuovi, (await quante()) - n], [0, 0])

  // 5. Un errore a metà elenco non ferma le righe dopo.
  const rotto = {
    ...s,
    async salvaPersona(p) {
      if (p.cognome === 'Guasto') throw new Error('duplicate key value violates unique constraint "persone_email_key"')
      return s.salvaPersona(p)
    },
  }
  const f5 = await excel(['Anna;Prima;;;Judo 2', 'Bruno;Guasto;;;Judo 2', 'Carla;Terza;;;Judo 2', 'Elia;;;;Judo 2', 'Dino;Guasto;;;Judo 2', 'Fabio;Ultimo;;;Judo 2'])
  let esito = ''
  try { a = await m.importa(rotto, f5, () => {}) } catch (e) { esito = e.message }
  ok('un errore su una riga non ferma l\'import', esito, '')
  ok('le righe dopo l\'errore sono entrate', [!!(await persona('Anna', 'Prima')), !!(await persona('Carla', 'Terza')), !!(await persona('Fabio', 'Ultimo'))], [true, true, true])
  await prova('il resoconto: riga del foglio, nome, motivo, in ordine', () => a.daSistemare.map((x) => [x.riga, x.nome]), [[3, 'Bruno Guasto'], [5, 'Elia'], [6, 'Dino Guasto']])
  await prova('il motivo è in italiano, mai il testo del database', () => a.daSistemare.map((x) => !!x.motivo && !/duplicate|constraint|violates|key/i.test(x.motivo)), [true, true, true])
  await prova('il resoconto finale dice FATTO e quante righe', () => il.testoResoconto(a).split('\n')[0], 'FATTO, 3 righe da sistemare')
  await prova('e sotto, una riga per ognuna', () => il.testoResoconto(a).split('\n').slice(1).map((l) => [/riga 3\b/.test(l) && /Bruno Guasto/.test(l), /riga 5\b/.test(l) && /Elia/.test(l), /riga 6\b/.test(l) && /Dino Guasto/.test(l)].some(Boolean)), [true, true, true])
  await prova('senza righe da sistemare dice solo FATTO', () => il.testoResoconto({ daSistemare: [] }).split('\n')[0], 'FATTO')

  // 8. Messaggi d'errore per chi usa l'app.
  await prova('un errore del database si traduce, e dice cosa fare', () => [
    'duplicate key value violates unique constraint "persone_email_key"',
    'new row violates row-level security policy for table "iscrizioni"',
    'FetchError: Failed to fetch',
  ].map((t) => { const x = il.messaggioRiga(new Error(t)); return !!x && !/duplicate|constraint|violates|policy|Fetch/i.test(x) }), [true, true, true])
  await prova('un errore che non conosciamo non mostra il testo grezzo', () => il.messaggioRiga(new TypeError('Cannot read properties of undefined (reading id)')).includes('Cannot'), false)
  await prova('un messaggio già in italiano resta com\'è', () => il.messaggioRiga(new Error('Questa email è già di Mario Rossi')), 'Questa email è già di Mario Rossi')
  const rotto2 = { ...s, async iscrivi() { throw new Error('new row violates row-level security policy for table "iscrizioni"') } }
  a = await senzaFermarsi(async () => m.importa(rotto2, await excel(['Gina;Quarta;;;Judo 2', 'Hugo;Quinto;;;Judo 2']), () => {}))
  await prova('anche un errore sull\'iscrizione si dice in italiano, e l\'altra riga prosegue', async () => [a.daSistemare.map((x) => x.riga), a.daSistemare.every((x) => !/row-level|policy/i.test(x.motivo)), !!(await persona('Hugo', 'Quinto'))], [[2, 3], true, true])

  // 7. Da quando è iscritto: la data della risposta, se c'è.
  const rt = await risposte('Informazioni cronologiche,Nome e cognome,Email,Corsi', [
    '"20/09/2026 18.01.22",Rita Datata,rita@esempio.it,Judo 2',
    ',Sergio Senzadata,sergio@esempio.it,Judo 2',
    'boh,Tina Storta,tina@esempio.it,Judo 2',
  ])
  ok('«Informazioni cronologiche» si propone da sola come data della risposta', m.indovinaColonne(m.leggiTabella('Informazioni cronologiche,Nome e cognome,Email,Corsi').testa).dataRisposta, 0)
  await prova('la data della risposta si legge (con l\'ora), o manca', () => rt.iscritti.map((x) => x.iscrittoIl), ['2026-09-20', undefined, undefined])
  await m.importa(s, rt, () => {})
  const dal = async (n, c) => (await persona(n, c)).iscrizioni.map((i) => i.dal)
  ok('dal = la data della risposta; senza data, o illeggibile, oggi', [await dal('Rita', 'Datata'), await dal('Sergio', 'Senzadata'), await dal('Tina', 'Storta')], [['2026-09-20'], ['2026-09-26'], ['2026-09-26']])
  const r2 = await risposte('Informazioni cronologiche,Nome e cognome,Email,Corsi', [
    '18/09/2026 10.00.00,Elena Doppia,elena.doppia@esempio.it,Judo 2',
    '12/09/2026 10.00.00,Elena Doppia,elena.doppia@esempio.it,Judo 2',
    '30/09/2026 10.00.00,Franco Futuro,franco.futuro@esempio.it,Judo 2',
    '17/09/2026 10.00.00,Nicolò Bianchi,,Judo adulti',
  ])
  await m.importa(s, r2, () => {})
  ok('chi manda il modulo due volte è iscritto dalla prima risposta', await dal('Elena', 'Doppia'), ['2026-09-12'])
  ok('una data nel futuro non vale: oggi', await dal('Franco', 'Futuro'), ['2026-09-26'])
  ok('una persona già in palestra, iscritta a un corso nuovo, ha la data della risposta', (await persona('Nicolò', 'Bianchi')).iscrizioni.filter((i) => i.corsoId === 'judo-adulti').map((i) => i.dal), ['2026-09-17'])

  // Le scelte sono per foglio e riga: la riga 2 di un foglio non è la riga 2 dell'altro.
  const quirino = await s.salvaPersona({ nome: 'Quirino', cognome: 'Archiviato' })
  const ugo = await s.salvaPersona({ nome: 'Ugo', cognome: 'Archiviato' })
  await s.attivaPersona(quirino, false)
  await s.attivaPersona(ugo, false)
  const dueFogli = await excel(['Quirino;Archiviato;;;Judo 2'])
  const dalModulo = await risposte('Nome e cognome,Corsi', ['Ugo Archiviato,Judo 2'])
  dueFogli.iscritti.push(...dalModulo.iscritti)
  await m.importa(s, dueFogli, () => {}, { 'iscritti.csv:2': { archiviato: 'riattiva' } })
  ok('una scelta sulla riga 2 di un foglio non vale per la riga 2 dell\'altro', [(await persona('Quirino', 'Archiviato')).attiva, (await persona('Ugo', 'Archiviato')).attiva], [true, false])

  // I conti di COSA ENTRA seguono le scelte.
  await s.salvaPersona({ nome: 'Gianni', cognome: 'Sbagliato' })
  const fg = await risposte('Nome e cognome,Corsi', ['Sbagliato Gianni,Judo 2'])
  const sit = await situazione()
  const conti = (sc) => { const x = il.anteprima(fg, sit, sc); return [x.iscrittiNuovi, x.iscrizioniNuove] }
  ok('il dubbio senza scelta non conta', conti({}), [0, 0])
  ok('«è un\'altra persona»: un iscritto nuovo e la sua iscrizione', conti({ 'risposte:2': { doppione: 'nuova' } }), [1, 1])
  ok('«è lei»: nessun iscritto nuovo, ma l\'iscrizione al corso sì', conti({ 'risposte:2': { doppione: 'lega' } }), [0, 1])

  // 6. Archiviati e iscrizioni terminate: si sceglie per riga, e di base non si tocca niente.
  const olga = await s.salvaPersona({ nome: 'Olga', cognome: 'Archiviata' })
  await s.attivaPersona(olga, false)
  const fo = await excel(['Olga;Archiviata;;;Judo 2'])
  await prova('archiviata: il controllo avvisa', async () => { const r = il.controllaRighe(fo, await situazione()).righe[0]; return [r.esito, r.avvisi.some((x) => /archiviat/.test(x))] }, ['in_palestra', true])
  await m.importa(s, fo, () => {})
  let o = await persona('Olga', 'Archiviata')
  ok('l\'import da solo non la riattiva e non la iscrive', [o.attiva, o.iscrizioni.length], [false, 0])
  await m.importa(s, fo, () => {}, { 'iscritti.csv:2': { archiviato: 'riattiva' } })
  o = await persona('Olga', 'Archiviata')
  ok('«riattiva»: torna attiva, con l\'iscrizione', [o.attiva, o.iscrizioni.map((i) => [i.corsoId, i.al ?? null])], [true, [['judo-2', null]]])

  const pietro = await s.salvaPersona({ nome: 'Pietro', cognome: 'Terminato' })
  await s.iscrivi(pietro, 'judo-2')
  await s.termina(pietro, 'judo-2')
  OGGI = new DateVera(2026, 8, 29, 12, 0).getTime()
  const fp = await excel(['Pietro;Terminato;;;Judo 2'])
  await prova('iscrizione terminata: il controllo avvisa', async () => il.controllaRighe(fp, await situazione()).righe[0].avvisi.some((x) => /terminat/.test(x)), true)
  await m.importa(s, fp, () => {})
  const attive = async () => (await persona('Pietro', 'Terminato')).iscrizioni.filter((i) => !i.al || i.al >= '2026-09-29').length
  ok('l\'import da solo non la riapre', await attive(), 0)
  await m.importa(s, fp, () => {}, { 'iscritti.csv:2': { terminate: 'riapri' } })
  ok('«riapri»: l\'iscrizione torna', await attive(), 1)
  OGGI = new DateVera(2026, 8, 26, 12, 0).getTime()
}

console.log('\n12b. un foglio nella casella sbagliata')
{
  const risposteGoogle = 'Informazioni cronologiche,Indirizzo email,COGNOME NOME ATLETA,CORSO\n14/08/2026 14.53.00,a@esempio.it,Rossi Anna,Judo 2\n14/08/2026 14.58.00,b@esempio.it,Verdi Luca,Judo 2\n'
  const f = m.leggiFogli(null, risposteGoogle, [])
  ok('le risposte del modulo nella casella di iscritti.csv: nessuna riga letta', [f.iscritti.length, f.righe.iscritti], [0, 0])
  ok('e una sola riga da sistemare, che dice di usare la casella delle risposte', f.saltate.map((x) => [x.foglio, x.riga, x.motivo]),
    [['iscritti.csv', 1, 'Le 2 righe di questo foglio non si leggono: mancano le colonne nome e cognome. Se è il foglio delle risposte del modulo Google, caricalo nella casella «risposte del modulo Google»']])
  const senzaCognome = m.leggiFogli(null, 'nome;email;corso\nAnna;a@esempio.it;Judo 2\n', [])
  ok('basta che manchi una colonna: lo dice anche così', [senzaCognome.iscritti.length, senzaCognome.saltate.length], [0, 1])
  const giusto = m.leggiFogli(null, 'nome;cognome;email;telefono;corso\nAnna;Rossi;;;\n;;;;\n', [])
  ok('un iscritti.csv giusto non è toccato', [giusto.iscritti.length, giusto.saltate.length], [1, 0])
}

console.log('\n12c. nome e cognome in una casella sola: l\'ordine e le particelle')
{
  const il = m.importaLib
  const prova = (f) => { try { return f() } catch (e) { return `ERRORE: ${e.message}` } }
  // L'ordine dell'intestazione: «COGNOME NOME» o «NOME E COGNOME».
  ok('«COGNOME NOME ATLETA» dice cognome prima', prova(() => il.indovinaOrdine(['Email', 'COGNOME NOME ATLETA'], { nomeCompleto: 1 })), 'cognomeNome')
  ok('«Cognome e nome» pure', prova(() => il.indovinaOrdine(['Cognome e nome'], { nomeCompleto: 0 })), 'cognomeNome')
  ok('«Nome e cognome» dice nome prima', prova(() => il.indovinaOrdine(['Nome e cognome'], { nomeCompleto: 0 })), 'nomeCognome')
  ok('e senza una colonna scelta, nome prima', prova(() => il.indovinaOrdine(['Email'], {})), 'nomeCognome')
  // Nome prima: le particelle restano col cognome.
  ok('nome prima: «Anna De Luca»', prova(() => m.dividiNome('Anna De Luca')), { nome: 'Anna', cognome: 'De Luca' })
  ok('nome prima: «Maria Grazia De Luca»', prova(() => m.dividiNome('Maria Grazia De Luca')), { nome: 'Maria Grazia', cognome: 'De Luca' })
  ok('nome prima: «Luigi Dell\'Aglio» (l\'apostrofo è una parola sola)', prova(() => m.dividiNome('Luigi Dell\'Aglio')), { nome: 'Luigi', cognome: 'Dell\'Aglio' })
  ok('nome prima: «Mario Di Biase»', prova(() => m.dividiNome('Mario Di Biase')), { nome: 'Mario', cognome: 'Di Biase' })
  ok('nome prima: «Maria Luisa Rossi» non cambia', prova(() => m.dividiNome('Maria Luisa Rossi')), { nome: 'Maria Luisa', cognome: 'Rossi' })
  // Cognome prima.
  ok('cognome prima: «Rossi Mario»', prova(() => m.dividiNome('Rossi Mario', undefined, undefined, 'cognomeNome')), { nome: 'Mario', cognome: 'Rossi' })
  ok('cognome prima: «Rossi Maria Grazia»', prova(() => m.dividiNome('Rossi Maria Grazia', undefined, undefined, 'cognomeNome')), { nome: 'Maria Grazia', cognome: 'Rossi' })
  ok('cognome prima: «De Luca Anna»', prova(() => m.dividiNome('De Luca Anna', undefined, undefined, 'cognomeNome')), { nome: 'Anna', cognome: 'De Luca' })
  ok('cognome prima: «Dell\'Aglio Luigi»', prova(() => m.dividiNome('Dell\'Aglio Luigi', undefined, undefined, 'cognomeNome')), { nome: 'Luigi', cognome: 'Dell\'Aglio' })
  ok('cognome prima: «Di Biase Raffaele»', prova(() => m.dividiNome('Di Biase Raffaele', undefined, undefined, 'cognomeNome')), { nome: 'Raffaele', cognome: 'Di Biase' })
  ok('una parola sola non si divide, in nessun ordine', [m.dividiNome('Rossi'), m.dividiNome('Rossi', undefined, undefined, 'cognomeNome')], [null, null])
  // Il codice fiscale, quando c'è, vince sull'ordine.
  const corpo = 'PRDMNL90A01L219'
  const cf = corpo + m.carattereControllo(corpo)
  ok('col codice fiscale l\'ordine non conta', [m.dividiNome('Prudente Manuel', cf, undefined, 'nomeCognome'), m.dividiNome('Prudente Manuel', cf, undefined, 'cognomeNome')],
    [{ nome: 'Manuel', cognome: 'Prudente' }, { nome: 'Manuel', cognome: 'Prudente' }])
  // Dalle risposte, con l'ordine scelto.
  const t = m.leggiTabella('Informazioni cronologiche,COGNOME NOME ATLETA,Email,Corsi\n14/08/2026 10.00.00,De Luca Anna,anna@esempio.it,\n14/08/2026 10.01.00,Rossi Maria Grazia,maria@esempio.it,\n')
  const col = m.indovinaColonne(t.testa)
  const dalFoglio = (ordine) => prova(() => m.leggiRisposte(t, col, {}, [], ordine).iscritti.map((x) => `${x.nome}|${x.cognome}`))
  ok('leggiRisposte con cognome prima', dalFoglio('cognomeNome'), ['Anna|De Luca', 'Maria Grazia|Rossi'])
  ok('e senza dirlo vale nome prima, come prima', dalFoglio(undefined), ['De Luca|Anna', 'Rossi Maria|Grazia'])
}

console.log('\n13. il promemoria del backup, prima di importare')
{
  const il = m.importaLib
  const adesso = new Date(2026, 9, 5, 12, 0)
  const copia = (stato, giorniFa, ore = 8) => ({ copie: [], ultimo: { stato, quando: new Date(2026, 9, 5 - giorniFa, ore, 0).toISOString(), link: '' } })
  const dice = (stato) => { try { return il.promemoriaBackup(stato, adesso) } catch (e) { return `ERRORE: ${e.message}` } }
  ok('backup riuscito oggi: lo dice, senza allarme', dice(copia('riuscito', 0)), { testo: 'Ultimo backup riuscito oggi.', avviso: false })
  ok('riuscito ieri: lo dice, senza allarme', dice(copia('riuscito', 1)), { testo: 'Ultimo backup riuscito ieri.', avviso: false })
  ok('riuscito da giorni: avvisa e dice dove farne uno nuovo', dice(copia('riuscito', 5)), { testo: 'Ultimo backup riuscito 5 giorni fa. Se importi tanto, fanne uno nuovo da IMPOSTAZIONI › DATI E PRIVACY › IL BACKUP.', avviso: true })
  ok('i giorni sono di calendario, non di 24 ore: ieri alle 23:30, con adesso a mezzanotte e dieci, è ieri', il.promemoriaBackup(copia('riuscito', 1, 23), new Date(2026, 9, 5, 0, 10)), { testo: 'Ultimo backup riuscito ieri.', avviso: false })
  ok('mai fatto: avvisa', dice({ copie: [], ultimo: null }), { testo: 'Non risulta nessun backup. Prima di importare, fanne uno da IMPOSTAZIONI › DATI E PRIVACY › IL BACKUP.', avviso: true })
  ok('non riuscito: avvisa', dice(copia('fallito', 0)), { testo: 'L\'ultimo backup non è riuscito. Riprova da IMPOSTAZIONI › DATI E PRIVACY › IL BACKUP prima di importare.', avviso: true })
  ok('in corso: aspetta, senza allarme', dice(copia('in_corso', 0, 11)), { testo: 'Un backup è in corso: aspetta che finisca, poi importa.', avviso: false })
  ok('se i backup non si leggono: lo dice, e manda a controllare', dice(undefined), { testo: 'Non riesco a leggere i backup: controlla da IMPOSTAZIONI › DATI E PRIVACY › IL BACKUP prima di importare.', avviso: true })
}

console.log('\nil certificato medico, il documento e il pagamento')
{
  const tutti = await s.persone()
  const oggi = '2026-09-26'
  const quanti = (f) => tutti.filter(f).length
  ok('in prova qualcuno è senza certificato, qualcuno scaduto, quasi tutti in regola',
    [quanti((p) => m.comeCertificato(p.certificato, oggi) === 'manca') > 0, quanti((p) => m.comeCertificato(p.certificato, oggi) === 'scaduto') > 0, quanti((p) => m.inRegola(p, oggi)) > tutti.length / 2],
    [true, true, true])
  // Uno senza ricevute: il suo pagamento è solo l'eccezione scritta a mano.
  const p = tutti.find((x) => x.attiva && !(x.quote ?? []).length)
  await s.togliCertificato(p.id)
  const come = async () => {
    const x = (await s.persone()).find((y) => y.id === p.id)
    return [m.comeCertificato(x.certificato, oggi), m.comePaga(x, oggi)]
  }
  ok('tolto: manca', (await come())[0], 'manca')
  ok('senza la data no', await errore(() => s.salvaCertificato(p.id, '')), 'Serve la data di scadenza del certificato')
  await s.salvaCertificato(p.id, '2027-09-01')
  ok('su carta, basta la scadenza: valido', (await come())[0], 'valido')
  ok('nessun file nell\'app', (await s.persone()).find((y) => y.id === p.id).certificato.conFile, false)
  await s.salvaCertificato(p.id, '2026-10-10')
  ok('la scadenza fra due settimane: in scadenza', (await come())[0], 'in_scadenza')
  await s.salvaCertificato(p.id, '2026-09-25')
  ok('ieri: scaduto', (await come())[0], 'scaduto')

  await s.salvaPagamento(p.id, { stato: 'da_pagare' })
  ok('da pagare', (await come())[1], 'da_pagare')
  await s.salvaPagamento(p.id, { stato: 'pagato', fino: '2026-12-31', nota: '  carta n. 12  ' })
  const x = (await s.persone()).find((y) => y.id === p.id)
  ok('pagata fuori dall\'app, con la nota pulita', [m.pagamentoDi(x, oggi).come, m.pagamentoDi(x, oggi).fonte, x.pagamento.nota], ['pagato', 'fuori_app', 'carta n. 12'])
  ok('passata la sua data è scaduta', [m.comePaga(x, '2027-01-01'), m.pagamentoDi(x, '2027-01-01').fino], ['scaduto', '2026-12-31'])
  ok('senza data vale fino alla fine della stagione', [m.comePaga({ pagamento: { stato: 'pagato' } }, '2027-07-31'), m.comePaga({ pagamento: { stato: 'pagato' } }, '2027-08-01')], ['pagato', 'da_pagare'])

  // Se ha pagato lo dicono le ricevute: la QUOTA ASSOCIATIVA che vale oggi.
  const ric = (voci, extra = {}) => ({ id: 'r', anno: 2026, numero: 7, data: '2026-09-10', voci, anticipo: 0, ...extra })
  const voce = (descrizione, prezzo, pagato, dal = '2026-09-01', al = '2027-07-31') => ({ descrizione, quantita: 1, prezzo, dal, al, pagamenti: pagato ? [{ data: '2026-09-10', importo: pagato, metodo: 'Contanti' }] : [] })
  const di = (quote, pagamento = { stato: 'da_pagare' }) => m.pagamentoDi({ pagamento, quote }, oggi)
  const pagata = m.quoteDi([ric([voce('Quota associativa', 5000, 5000), voce('Annuale Judo 2', 48000, 24000)])])
  ok('la quota pagata e il corso a metà: in regola, conta la quota', [di(pagata).come, di(pagata).fonte, di(pagata).ricevuta], ['pagato', 'ricevuta', '7/2026'])
  const meta = m.quoteDi([ric([voce('QUOTA ASSOCIATIVA', 5000, 2000)])])
  ok('la quota pagata in parte: in parte, con quanto manca', [di(meta).come, di(meta).mancano], ['in_parte', 3000])
  ok('un anticipo dato prima la copre', di(m.quoteDi([ric([voce('QUOTA ASSOCIATIVA', 5000, 0)], { anticipo: 5000 })])).come, 'pagato')
  ok('annullata non conta', di(m.quoteDi([ric([voce('QUOTA ASSOCIATIVA', 5000, 5000)], { annullataIl: '2026-09-20T10:00:00Z' })])).come, 'da_pagare')
  ok('senza la quota, un annuale da solo non basta', di(m.quoteDi([ric([voce('Annuale Judo 2', 48000, 48000)])])).come, 'da_pagare')
  const vecchia = m.quoteDi([ric([voce('QUOTA ASSOCIATIVA', 5000, 5000, '2025-09-01', '2026-07-31')])])
  ok('la quota della stagione passata è scaduta', [di(vecchia).come, di(vecchia).fino], ['scaduto', '2026-07-31'])
  ok('pagata fuori dall\'app vince su una ricevuta a metà', di(meta, { stato: 'pagato', fino: '2027-07-31' }).fonte, 'fuori_app')
  ok('una nota lunghissima no', await errore(() => s.salvaPagamento(p.id, { stato: 'pagato', nota: 'x'.repeat(301) })), 'La nota del pagamento è troppo lunga: al massimo 300 caratteri')
  await s.salvaDocumento(p.id, true)
  ok('il documento è in segreteria', (await s.persone()).find((y) => y.id === p.id).documento, true)
  const e = await s.esporta(p.id)
  ok('nell\'esportazione dei dati', [e.certificato_e_pagamento.certificato_scade, e.certificato_e_pagamento.stato, e.certificato_e_pagamento.documento_in_segreteria], ['2026-09-25', 'pagato', true])
  await s.salvaDocumento(p.id, false)
  ok('e non c\'è più', (await s.persone()).find((y) => y.id === p.id).documento, false)

  // Chi aveva il file caricato prima della nuova gestione lo ha ancora, e la scheda lo sa.
  const vecchio = tutti.find((x) => x.certificato.conFile)
  ok('in prova qualcuno ha ancora un file di prima', [!!vecchio, vecchio?.certificato.vecchio], [true, true])
}

console.log('\nla musica delle sale')
{
  const yt = 'https://www.youtube.com/playlist?list=PLx0sYbCqOb8TBPRdmBHs5Iftvv9TPboYG'
  const sp = 'https://open.spotify.com/intl-it/playlist/37i9dQZF1DX76Wlfdnj7AP?si=abc'
  const randori = await s.salvaListaMusica({ nome: '  Randori  ', link: yt, salaId: 'Lotta' })
  await s.salvaListaMusica({ nome: 'Riscaldamento', link: sp, salaId: null })
  await s.salvaListaMusica({ nome: 'Bambini', link: 'https://youtu.be/dQw4w9WgXcQ', salaId: 'Tatami' })
  ok('un link che non è musica no', await errore(() => s.salvaListaMusica({ nome: 'Altro', link: 'la mia musica', salaId: null })), 'Il link non è una playlist di YouTube o di Spotify, né una radio')
  ok('un indirizzo http no, e dice cosa fare', await errore(() => s.salvaListaMusica({ nome: 'Altro', link: 'http://esempio.it/lista', salaId: null })), 'Questo indirizzo non è sicuro: cerca l\'indirizzo che comincia con https.')
  ok('un link troppo lungo no', await errore(() => s.salvaListaMusica({ nome: 'Altro', link: 'https://stream.esempio.it/' + 'a'.repeat(500), salaId: null })), 'Il link è troppo lungo')
  const radio = await s.salvaListaMusica({ nome: 'Radio Rock', link: 'https://stream.esempio.it/rock', salaId: null })
  ok('una radio https sì', (await s.listeMusica()).find((l) => l.id === radio)?.link, 'https://stream.esempio.it/rock')
  await s.togliListaMusica(radio)
  ok('un nome vuoto no', await errore(() => s.salvaListaMusica({ nome: '  ', link: yt, salaId: null })), 'La lista ha bisogno di un nome')
  ok('una sala che non c\'è no', await errore(() => s.salvaListaMusica({ nome: 'X', link: yt, salaId: 'Piscina' })), 'Sala inesistente')
  ok('la segreteria le vede tutte, col nome pulito', (await s.listeMusica()).map((l) => l.nome), ['Randori', 'Riscaldamento', 'Bambini'])
  const t = m.creaTabletProva()
  await t.scegliSala('Lotta')
  ok('il tablet della Lotta: la sua e quella di tutte', (await t.musica()).map((l) => l.nome), ['Randori', 'Riscaldamento'])
  await s.salvaSala({ id: 'Lotta', nome: 'Lotta libera' })
  ok('la sala rinominata se la porta dietro', (await s.listeMusica()).find((l) => l.id === randori).salaId, 'Lotta libera')
  await s.salvaSala({ id: 'Lotta libera', nome: 'Lotta' })
  await s.togliListaMusica(randori)
  ok('tolta, il tablet non la vede più', (await t.musica()).map((l) => l.nome), ['Riscaldamento'])
}

console.log('\nl\'email di un iscritto e il personale')
{
  const f = await s.salvaPersona({ nome: 'Fede', cognome: 'Figlio', email: 'famiglia.pers@esempio.it' })
  const g = await s.salvaPersona({ nome: 'Gaia', cognome: 'Figlia', email: 'famiglia.pers@esempio.it' })
  const nuova = await s.salvaPersonale({ nome: 'Tina', cognome: 'Nuova', email: 'tina.pers@esempio.it', ruolo: 'istruttore' })
  const diventa = await s.salvaPersonale({ nome: 'Fede', cognome: 'Figlio', email: 'famiglia.pers@esempio.it', ruolo: 'istruttore' })
  ok('chi ha l\'email dei figli diventa personale, non un doppione: il primo iscritto', diventa, f)
  ok('e il fratello resta iscritto', (await s.personale()).some((p) => p.id === g), false)
  ok('modificando un\'altra scheda del personale con quell\'email si dice di chi è', await errore(() => s.salvaPersonale({ id: nuova, nome: 'Tina', cognome: 'Nuova', email: 'famiglia.pers@esempio.it', ruolo: 'istruttore' })), 'Questa email è già di Fede Figlio')
}

console.log('\nl\'invito per email')
{
  const id = await s.salvaPersonale({ nome: 'Ilaria', cognome: 'Invitata', email: 'ilaria@esempio.it', ruolo: 'istruttore' })
  ok('una persona con email si invita', await s.invita(id), 'invito')
  const senza = await s.salvaPersonale({ nome: 'Nadia', cognome: 'Senzamail', ruolo: 'istruttore' })
  ok('senza email no', await errore(() => s.invita(senza)), 'Nadia non ha un’email')
  await s.attivaPersona(id, false)
  ok('senza accesso no', await errore(() => s.invita(id)), 'Ilaria è senza accesso: prima va ridato')
  await s.attivaPersona(id, true)

  ok('il link dell\'invito', m.arrivoDalLink('#access_token=x&refresh_token=y&type=invite'), { tipo: 'invito' })
  ok('il link di «password dimenticata»', m.arrivoDalLink('#access_token=x&type=recovery'), { tipo: 'password' })
  ok('il link scaduto', m.arrivoDalLink('#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired').tipo, 'scaduto')
  ok('un\'area non è un link', m.arrivoDalLink('#segreteria'), null)
  ok('niente frammento', m.arrivoDalLink(''), null)
}

console.log('\nil ruolo doppio, segreteria e istruttore')
{
  const id = await s.salvaPersonale({ nome: 'Dora', cognome: 'Doppia', email: 'dora@esempio.it', ...m.daSpunte(['segreteria', 'istruttore']) })
  const dora = async () => (await s.personale()).find((p) => p.id === id)
  ok('è segreteria e insegna', m.spunteDi(await dora()), ['segreteria', 'istruttore'])
  ok('le si dà un corso', (await s.istruttori()).some((i) => i.id === id), true)
  ok('entra in tutte e due le aree', m.areeDi(await dora()), ['segreteria', 'istruttori'])
  ok('e lo si dice', m.nomeDelRuolo(await dora()), 'Segreteria e istruttore')
  await s.salvaPersonale({ ...(await dora()), nome: 'Dorotea' })
  ok('cambiando il nome resta doppia', m.spunteDi(await dora()), ['segreteria', 'istruttore'])
  await s.salvaPersonale({ ...(await dora()), ...m.daSpunte(['segreteria']) })
  ok('solo segreteria', m.spunteDi(await dora()), ['segreteria'])
  ok('non le si dà più un corso', (await s.istruttori()).some((i) => i.id === id), false)
  ok('entra solo in segreteria', m.areeDi(await dora()), ['segreteria'])
  await s.salvaPersonale({ ...(await dora()), ...m.daSpunte(['segreteria', 'istruttore']) })
  await s.salvaPersonale({ ...(await dora()), ...m.daSpunte(['istruttore']) })
  ok('istruttore e basta', [m.spunteDi(await dora()), (await dora()).ancheIstruttore], [['istruttore'], false])
  ok('entra solo nel calendario', m.areeDi(await dora()), ['istruttori'])
}

console.log('\nil ruolo amministrazione')
{
  const id = await s.salvaPersonale({ nome: 'Ada', cognome: 'Conti', email: 'ada@esempio.it', ...m.daSpunte(['amministrazione']) })
  const ada = async () => (await s.personale()).find((p) => p.id === id)
  ok('è solo amministrazione', [m.spunteDi(await ada()), (await ada()).ruolo], [['amministrazione'], 'amministrazione'])
  ok('entra nel menu unico (un posto solo, le voci dei conti)', m.areeDi(await ada()), ['segreteria'])
  ok('e lo si dice', m.nomeDelRuolo(await ada()), 'Amministrazione')
  ok('non le si dà un corso', (await s.istruttori()).some((i) => i.id === id), false)
  await s.salvaPersonale({ ...(await ada()), ...m.daSpunte(['segreteria', 'amministrazione']) })
  ok('segreteria e amministrazione: un posto solo, non due sezioni', m.areeDi(await ada()), ['segreteria'])
  ok('e lo si dice per esteso', m.nomeDelRuolo(await ada()), 'Segreteria e amministrazione')
  await s.salvaPersonale({ ...(await ada()), ...m.daSpunte(['amministrazione', 'istruttore']) })
  ok('amministrazione e istruttore: le si dà un corso', (await s.istruttori()).some((i) => i.id === id), true)
  ok('con l\'istruttore: il menu unico e il calendario', m.areeDi(await ada()), ['segreteria', 'istruttori'])
  await s.salvaPersonale({ ...(await ada()), ...m.daSpunte(['segreteria', 'amministrazione', 'istruttore']) })
  ok('tutte e tre le spunte tornano com\'erano', m.spunteDi(await ada()), ['segreteria', 'amministrazione', 'istruttore'])
  ok('i nomi di chi ha pagato, e nient\'altro', await s.nomiPersone([id, 'non-c-e']), [{ id, nome: 'Ada', cognome: 'Conti' }])
  const pia = await s.salvaPersonale({ nome: 'Pia', cognome: 'Pagatrice', email: 'pia.pagatrice@esempio.it', ...m.daSpunte(['istruttore']) })
  ok('chi ha pagato si cerca per nome: solo id, nome e cognome', await s.cercaPagatori('pagatric'), [{ id: pia, nome: 'Pia', cognome: 'Pagatrice' }])
  ok('anche col nome e senza maiuscole', (await s.cercaPagatori('PIA pagatric')).map((x) => x.id), [pia])
  ok('due lettere non bastano', await s.cercaPagatori('pa'), [])
  ok('al massimo otto', (await s.cercaPagatori('cos')).length <= 8, true)
  ok('l\'account di prova dell\'amministrazione c\'è', (await s.personale()).some((p) => p.id === 'a-prova' && p.ruolo === 'amministrazione'), true)
}

console.log('\nil ruolo amministrazione sul database (client finto)')
{
  const chiamate = []
  const finto = (risposta) => m.creaSegreteriaSupabase({ from: () => { throw new Error('non deve leggere tabelle') }, rpc: async (f, x) => (chiamate.push([f, x]), risposta(f)) })
  const bianchi = [{ persona_id: 'p1', nome: 'Marco', cognome: 'Bianchi' }]
  const db = finto(() => ({ data: bianchi, error: null }))
  ok('cerca chi ha pagato con cerca_pagatori e rende id, nome, cognome', await db.cercaPagatori('bian'), [{ id: 'p1', nome: 'Marco', cognome: 'Bianchi' }])
  ok('…col testo scritto, com\'è', chiamate, [['cerca_pagatori', { scritto: 'bian' }]])
  chiamate.length = 0
  const nomi = finto(() => ({ data: [{ id: 'p1', nome: 'Marco', cognome: 'Bianchi' }], error: null }))
  await nomi.nomiPersone(Array.from({ length: 1200 }, (_, i) => `p${i % 1000}`))
  ok('i nomi si chiedono mille alla volta al massimo, senza ripetizioni: 1000 id uguali due volte fanno 2 chiamate da 500', [chiamate.length, chiamate.map(([, x]) => x.ids.length)], [2, [500, 500]])
  const vecchio = finto((f) => ({ data: null, error: { code: 'PGRST202', message: `Could not find the function public.${f}(scritto) in the schema cache` } }))
  let guaio = ''
  try { await vecchio.cercaPagatori('bian') } catch (e) { guaio = e.message }
  const troppe = finto(() => ({ data: null, error: { code: '42501', message: 'troppe ricerche: riprova fra qualche minuto' } }))
  let tetto = ''
  try { await troppe.cercaPagatori('bian') } catch (e) { tetto = e.message }
  ok('troppe ricerche: lo dice, non «serve la segreteria»', tetto, 'Hai fatto troppe ricerche: riprova fra qualche minuto')
  ok('senza il file 55 la ricerca dice cosa lanciare', guaio, 'Il ruolo amministrazione non è ancora attivo sul database: va lanciato 55-amministrazione.sql')
}

console.log('\nil kanji degli istruttori')
{
  const kanji = async (id) => (await s.personale()).find((p) => p.id === id).kanji
  ok('Maurizio ha già il suo', await kanji('i-maurizio'), '龍')
  ok('e Fabio no', await kanji('i-fabio'), undefined)
  ok('quello di un altro no', await errore(() => s.salvaKanji('i-fabio', '龍')), '龍 è già di Maurizio: scegline un altro')
  ok('due segni no', await errore(() => s.salvaKanji('i-fabio', '山火')), 'Il kanji è un segno solo')
  ok('una lettera no', await errore(() => s.salvaKanji('i-fabio', 'F')), 'Il kanji è un segno solo')
  await s.salvaKanji('i-fabio', ' 狼 ')
  ok('il suo, ripulito', await kanji('i-fabio'), '狼')
  const sue = (await app.calendario(...giorno([9, 1], [9, 7]))).filter((l) => l.insegnanti?.length === 1 && l.insegnanti[0] === 'i-fabio')
  ok('il calendario lo mette accanto al nome', [sue.length > 0, sue.every((l) => l.kanji === '狼')], [true, true])
  await s.salvaKanji('i-fabio', null)
  ok('e lo si toglie', await kanji('i-fabio'), undefined)
  ok('un iscritto non ce l\'ha', await errore(async () => s.salvaKanji((await s.persone())[0].id, '山')), 'Il kanji è solo per istruttori e segreteria')
}

console.log('\nle segnalazioni della segreteria')
{
  const scegli = 'Scegli se è un\'idea o una correzione'
  ok('senza categoria no', await errore(() => s.apriSegnalazione('Appello', 'qualcosa')), scegli)
  ok('con una categoria che non c\'è no', await errore(() => s.apriSegnalazione('Appello', 'qualcosa', 'altro')), scegli)
  ok('la categoria si chiede prima del titolo', await errore(() => s.apriSegnalazione('  ', 'qualcosa')), scegli)
  ok('senza titolo no', await errore(() => s.apriSegnalazione('  ', 'qualcosa', 'correzione')), 'Manca il titolo')
  ok('senza testo no', await errore(() => s.apriSegnalazione('Appello', ' ', 'correzione')), 'Manca il testo')
  ok('e nessuna di queste è entrata', (await s.segnalazioni()).length, 0)
  await s.apriSegnalazione(' Appello lento ', ' Ci mette tanto ', 'correzione')
  const [x] = await s.segnalazioni()
  ok('aperta, ripulita', [x.titolo, x.messaggi[0].testo, x.chiusaIl], ['Appello lento', 'Ci mette tanto', undefined])
  ok('il filo porta la sua categoria', x.categoria, 'correzione')
  await s.categoriaSegnalazione(x.id, 'idea')
  ok('la segreteria la cambia dopo', (await s.segnalazioni())[0].categoria, 'idea')
  ok('una categoria che non c\'è no', await errore(() => s.categoriaSegnalazione(x.id, 'altro')), scegli)
  ok('e la categoria resta quella', (await s.segnalazioni())[0].categoria, 'idea')
  await s.categoriaSegnalazione(x.id, 'correzione')
  ok('scritta da me non aspetta me', m.tocca(x), false)
  await s.rispondiSegnalazione(x.id, 'Sistemato')
  ok('la risposta sotto', (await s.segnalazioni())[0].messaggi.map((y) => y.testo), ['Ci mette tanto', 'Sistemato'])
  ok('una risposta vuota no', await errore(() => s.rispondiSegnalazione(x.id, '')), 'Manca il testo')
  await s.chiudiSegnalazione(x.id, true)
  ok('chiusa', !!(await s.segnalazioni())[0].chiusaIl, true)
  await s.chiudiSegnalazione(x.id, false)
  ok('e riaperta', (await s.segnalazioni())[0].chiusaIl, undefined)
  ok('un messaggio altrui da aperta aspetta me', m.tocca({ messaggi: [{ mio: false }] }), true)

  // Chiudere con una risposta scritta: la risposta va, poi il filo si chiude.
  const filo = async (id) => (await s.segnalazioni()).find((y) => y.id === id)
  const apri = async (titolo) => {
    await s.apriSegnalazione(titolo, 'Da sistemare', 'correzione')
    return (await s.segnalazioni()).at(-1).id
  }
  const r2 = await apri('Chiusa con risposta')
  ok('chiudere con «Fatto» manda e chiude', await m.chiudiConRisposta(s, r2, 'Fatto'), { mandata: true, chiusa: true })
  ok('la risposta resta nel filo', (await filo(r2)).messaggi.map((y) => y.testo), ['Da sistemare', 'Fatto'])
  ok('e il filo è chiuso', !!(await filo(r2)).chiusaIl, true)

  const r3 = await apri('Chiusa senza risposta')
  ok('con la bozza di soli spazi chiude e basta', await m.chiudiConRisposta(s, r3, '   '), { mandata: false, chiusa: true })
  ok('senza messaggi in più', (await filo(r3)).messaggi.length, 1)
  ok('ma chiusa', !!(await filo(r3)).chiusaIl, true)

  const r4 = await apri('Risposta troppo lunga')
  ok('una risposta troppo lunga non chiude', await errore(() => m.chiudiConRisposta(s, r4, 'a'.repeat(4001))), 'Testo troppo lungo: togli 1 carattere (massimo 4000)')
  ok('nessun messaggio in più', (await filo(r4)).messaggi.length, 1)
  ok('e il filo resta aperto', (await filo(r4)).chiusaIl, undefined)

  const chiamate = []
  const guasto = {
    async rispondiSegnalazione(id, testo) {
      chiamate.push([id, testo])
    },
    async chiudiSegnalazione() {
      throw new Error('Rete giù')
    },
  }
  ok('se la chiusura salta dopo la risposta, non lancia', await m.chiudiConRisposta(guasto, 'f', 'Fatto'), { mandata: true, chiusa: false })
  ok('e la risposta è partita', chiamate, [['f', 'Fatto']])
  ok('se salta la sola chiusura, l\'errore arriva', await errore(() => m.chiudiConRisposta(guasto, 'f', '')), 'Rete giù')

  await s.chiudiSegnalazione(r2, false)
  ok('riaperta dopo la risposta', (await filo(r2)).chiusaIl, undefined)
  ok('la risposta c\'è ancora', (await filo(r2)).messaggi.map((y) => y.testo), ['Da sistemare', 'Fatto'])

  ok('senza bozza il bottone chiude e basta', [m.etichettaChiudi(''), m.etichettaChiudi('  ')], ['È FATTA, CHIUDILA', 'È FATTA, CHIUDILA'])
  ok('con la bozza il bottone manda e chiude', m.etichettaChiudi(' ok '), 'MANDA E CHIUDI')

  // In cima i fili che aspettano una mia risposta, poi le altre aperte, poi le chiuse.
  const f = (id, mio, il, chiusaIl) => ({ id, titolo: id, messaggi: [{ id, autore: 'x', mio, testo: 't', il }], chiusaIl })
  const A = f('A', true, '2026-09-26T10:00')
  const B = f('B', false, '2026-09-20T10:00')
  const C = f('C', false, '2026-09-26T11:00', '2026-09-26T11:00')
  ok('prima quelle che aspettano me', m.ordinaSegnalazioni([A, C, B]).map((y) => y.id), ['B', 'A', 'C'])
  const D = f('D', true, '2026-09-20T10:00')
  const E = f('E', true, '2026-09-26T11:00', '2026-09-26T11:00')
  ok('senza da rispondere, aperte per recenza poi chiuse', m.ordinaSegnalazioni([E, D, A]).map((y) => y.id), ['A', 'D', 'E'])

  ok('il titolo di 120 caratteri va', m.cosaNonVaSegnalazione('x', 'a'.repeat(120), 'idea'), null)
  ok('di 121 no', m.cosaNonVaSegnalazione('x', 'a'.repeat(121), 'idea'), 'Titolo troppo lungo: togli 1 carattere (massimo 120)')
  ok('un filo nuovo senza categoria no, prima del titolo', m.cosaNonVaSegnalazione('x', ''), scegli)
  ok('né con una categoria che non c\'è', m.cosaNonVaSegnalazione('x', 'Appello', 'altro'), scegli)
  ok('una risposta non ha categoria', m.cosaNonVaSegnalazione('x'), null)
  ok('un testo di 4000 caratteri va', m.cosaNonVaSegnalazione('a'.repeat(4000)), null)
  ok('di 4001 si dice, con quanto togliere', m.cosaNonVaSegnalazione('a'.repeat(4002)), 'Testo troppo lungo: togli 2 caratteri (massimo 4000)')

  // Le chiuse si nascondono, tranne quelle appena chiuse da chi guarda (tenute).
  const G = f('G', false, '2026-09-25T10:00', '2026-09-25T10:00')
  ok('si vedono solo le aperte', m.visibili([C, A, G, B], false, new Set()).map((y) => y.id), ['B', 'A'])
  ok('con «anche le chiuse» ci sono tutte, chiuse in fondo', m.visibili([C, A, G, B], true, new Set()).map((y) => y.id), ['B', 'A', 'C', 'G'])
  ok('una chiusa appena chiusa resta lì', m.visibili([C, A, G, B], false, new Set(['C'])).map((y) => y.id), ['B', 'A', 'C'])

  // Troppo lungo: si dice quanto togliere.
  ok('il titolo giusto va', m.troppoLungo('Titolo', 'a'.repeat(120), 120), null)
  ok('il titolo lungo dice quanto togliere', m.troppoLungo('Titolo', 'a'.repeat(125), 120), 'Titolo troppo lungo: togli 5 caratteri (massimo 120)')
  ok('un carattere solo, al singolare', m.troppoLungo('Testo', '  ' + 'a'.repeat(4001) + '  ', 4000), 'Testo troppo lungo: togli 1 carattere (massimo 4000)')

  // Dopo la chiusura, un avviso che dice cosa è successo.
  ok('mandata e chiusa', m.avvisoChiusura({ mandata: true, chiusa: true }), 'Risposta mandata. Segnalazione chiusa.')
  ok('solo chiusa', m.avvisoChiusura({ mandata: false, chiusa: true }), 'Segnalazione chiusa.')
  ok('mandata ma non chiusa, dice cosa fare', m.avvisoChiusura({ mandata: true, chiusa: false }), 'La risposta è andata, la segnalazione è ancora aperta: tocca di nuovo È FATTA, CHIUDILA.')

  // La riga sotto il titolo: sempre il nome di chi scrive, mai «Tu» (al banco l'accesso è in comune).
  const quando = (iso) => `${m.giornoPerEsteso(m.chiaveGiorno(new Date(iso)))}, ${m.oraDi(iso)}`
  const msg = (autore, il, mio = false) => ({ id: autore + il, autore, mio, testo: 't', il })
  const solo = { id: 'S', titolo: 'S', messaggi: [msg('Luca', '2026-09-25T09:30:00.000Z', true)] }
  ok('senza risposte: chi e quando', m.rigaFilo(solo), `Luca · ${quando('2026-09-25T09:30:00.000Z')}`)
  ok('senza risposte nessun «ultimo»', m.rigaFilo(solo).includes('ultimo'), false)
  const una = { ...solo, messaggi: [...solo.messaggi, msg('Marta', '2026-09-26T08:15:00.000Z')] }
  ok('con una risposta', m.rigaFilo(una), `Luca · una risposta · ultimo di Marta, ${quando('2026-09-26T08:15:00.000Z')}`)
  const due = { ...solo, messaggi: [...solo.messaggi, msg('Gino', '2026-09-25T10:00:00.000Z', true), msg('Marta', '2026-09-26T08:15:00.000Z')] }
  ok('con due risposte, chi ha scritto per ultimo', m.rigaFilo(due).includes('2 risposte · ultimo di Marta'), true)
  const mie = { ...solo, messaggi: [...solo.messaggi, msg('Luca', '2026-09-26T08:15:00.000Z', true)] }
  ok('niente «tuo» né «Tu» anche se è mio', /\btuo\b|\bTu\b|\bTua\b/i.test(m.rigaFilo(mie) + m.rigaFilo(solo)), false)
  ok('anche se è mio, il nome', m.rigaFilo(mie), `Luca · una risposta · ultimo di Luca, ${quando('2026-09-26T08:15:00.000Z')}`)

  // Il tasto spento dice perché.
  ok('mentre lavora non dice niente', m.motivoSpento({ titolo: '', testo: '', lavora: true }), null)
  ok('risposta vuota', m.motivoSpento({ testo: '  ', lavora: false, risposta: true }), 'Scrivi la risposta')
  ok('risposta scritta', m.motivoSpento({ testo: 'ok', lavora: false, risposta: true }), null)
  ok('nuova senza categoria, prima del titolo', m.motivoSpento({ titolo: '', testo: '', lavora: false }), scegli)
  ok('una risposta non chiede la categoria', m.motivoSpento({ testo: 'ok', lavora: false, risposta: true }), null)
  ok('nuova senza titolo', m.motivoSpento({ titolo: ' ', testo: 'x', lavora: false, categoria: 'correzione' }), 'Scrivi il titolo')
  ok('nuova correzione senza testo', m.motivoSpento({ titolo: 'Appello', testo: ' ', lavora: false, categoria: 'correzione' }), 'Scrivi cosa non va')
  ok('nuova idea senza testo', m.motivoSpento({ titolo: 'Appello', testo: ' ', lavora: false, categoria: 'idea' }), 'Scrivi cosa servirebbe')
  ok('troppo lunga: lo dice già la nota sotto il campo', m.motivoSpento({ titolo: 'a'.repeat(121), testo: 'x', lavora: false, categoria: 'idea' }), null)
  ok('tutto a posto', m.motivoSpento({ titolo: 'Appello', testo: 'lento', lavora: false, categoria: 'correzione' }), null)

  // Il segnaposto del testo segue la categoria scelta.
  ok('correzione: dove, cosa, cosa ti aspettavi', m.segnapostoTesto('correzione'), 'Dove, cosa hai fatto, cosa ti aspettavi')
  ok('senza categoria come la correzione', m.segnapostoTesto(), 'Dove, cosa hai fatto, cosa ti aspettavi')
  ok('idea: cosa servirebbe', m.segnapostoTesto('idea'), 'Cosa servirebbe, e per fare cosa')

  // L'avviso su WhatsApp comincia con la categoria; un filo vecchio senza, come prima.
  const link = 'https://ods.esempio/segreteria'
  const conCategoria = (categoria) => ({ id: 'W', titolo: 'Appello lento', categoria, messaggi: [] })
  ok('WhatsApp, una correzione', m.testoWhatsApp(conCategoria('correzione'), link),
    `Ti ho scritto sulla correzione «Appello lento»: la trovi in Segreteria, alla voce SEGNALAZIONI. ${link}`)
  ok('WhatsApp, un\'idea', m.testoWhatsApp(conCategoria('idea'), link),
    `Ti ho scritto sull'idea «Appello lento»: la trovi in Segreteria, alla voce SEGNALAZIONI. ${link}`)
  ok('avviso del cambio', [m.avvisoCategoria('idea'), m.avvisoCategoria('correzione')], ["Ora è un'idea", 'Ora è una correzione'])
  ok('WhatsApp, senza categoria come prima', m.testoWhatsApp(conCategoria(undefined), link),
    `Ti ho scritto sulla segnalazione «Appello lento»: la trovi in Segreteria, alla voce SEGNALAZIONI. ${link}`)

  // Le bozze stanno nello Storage passato, e non lanciano mai.
  const deposito = () => {
    const d = new Map()
    return {
      get length() { return d.size },
      key: (i) => [...d.keys()][i] ?? null,
      getItem: (k) => (d.has(k) ? d.get(k) : null),
      setItem: (k, v) => d.set(k, String(v)),
      removeItem: (k) => d.delete(k),
      clear: () => d.clear(),
    }
  }
  const st = deposito()
  ok('la chiave dice modo e campo', m.chiaveBozza('prova', 'nuova-testo'), 'ods-corsi:bozza:prova:nuova-testo')
  m.scriviBozza(st, m.chiaveBozza('prova', 'titolo'), 'Appello lento')
  ok('la bozza si rilegge', m.leggiBozza(st, m.chiaveBozza('prova', 'titolo')), 'Appello lento')
  ok('quella della prova non si legge dal vero', m.leggiBozza(st, m.chiaveBozza('supabase', 'titolo')), '')
  m.scriviBozza(st, m.chiaveBozza('prova', 'titolo'), '   ')
  ok('scritta vuota si toglie', st.getItem(m.chiaveBozza('prova', 'titolo')), null)
  m.scriviBozza(st, m.chiaveBozza('prova', 'a'), 'uno')
  m.scriviBozza(st, m.chiaveBozza('supabase', 'b'), 'due')
  st.setItem('ods-corsi:modo', 'prova')
  m.svuotaBozze(st)
  ok('svuotare toglie le bozze e lascia il resto', [st.getItem(m.chiaveBozza('prova', 'a')), st.getItem(m.chiaveBozza('supabase', 'b')), st.getItem('ods-corsi:modo')], [null, null, 'prova'])
  {
    const st2 = new Map()
    const finto = { getItem: (k) => st2.get(k) ?? null, setItem: (k, v) => st2.set(k, v), removeItem: (k) => st2.delete(k), get length() { return st2.size }, key: (i) => [...st2.keys()][i] ?? null }
    m.scriviBozza(finto, m.chiaveBozza('prova', 'risposta-f1'), 'mezza risposta')
    m.scriviBozza(finto, m.chiaveBozza('supabase', 'risposta-f2'), 'del vero')
    ok('i fili con una risposta a metà si sanno', [...m.conBozza(finto, 'prova', ['f1', 'f2', 'f3'])], ['f1'])
    ok('senza Storage nessuno', [...m.conBozza(undefined, 'prova', ['f1'])], [])
  }
  const rotto = new Proxy({}, { get() { throw new Error('Storage giù') } })
  ok('senza Storage si legge vuoto', m.leggiBozza(undefined, 'k'), '')
  ok('con lo Storage rotto si legge vuoto', m.leggiBozza(rotto, 'k'), '')
  ok('e scrivere o svuotare non lancia', [await errore(() => m.scriviBozza(undefined, 'k', 'x')), await errore(() => m.scriviBozza(rotto, 'k', 'x')), await errore(() => m.svuotaBozze(undefined)), await errore(() => m.svuotaBozze(rotto))], ['nessun errore', 'nessun errore', 'nessun errore', 'nessun errore'])

  // Aprire dà l'id della nuova, così la si può mostrare subito.
  const nuovaId = await s.apriSegnalazione('Con id', 'Da vedere', 'idea')
  ok('aprire dà l\'id della nuova', [typeof nuovaId, (await s.segnalazioni()).at(-1).id === nuovaId], ['string', true])

  // Un filo aperto prima delle categorie resta senza: non se ne inventa una.
  m.archivio.dati.segnalazioni.push({ id: 'sz-vecchio', titolo: 'Di prima', messaggi: [{ id: 'sz-vecchio', autore: 'Segreteria di prova', mio: true, testo: 'Vecchio', il: '2026-09-01T10:00:00.000Z' }] })
  ok('un filo di prima resta senza categoria', (await filo('sz-vecchio')).categoria, undefined)
  await s.chiudiSegnalazione('sz-vecchio', true)
  ok('e si chiude lo stesso', [!!(await filo('sz-vecchio')).chiusaIl, (await filo('sz-vecchio')).categoria], [true, undefined])

  // Col database vero: la categoria va nella riga del filo, e si cambia lì.
  const scritto = []
  const q = new Proxy(() => q, {
    get: (_, k) => (k === 'then' ? (fatto) => fatto({ data: { id: 'n1' }, error: null }) : k === 'insert' || k === 'update' ? (riga) => (scritto.push([k, riga]), q) : () => q),
    apply: () => q,
  })
  const vero = m.creaSegreteriaSupabase({ from: () => q, rpc: () => q })
  await vero.apriSegnalazione(' Idea ', ' Un tasto ', 'idea')
  await vero.categoriaSegnalazione('n1', 'correzione')
  ok('database: il filo nasce con la categoria, poi la cambia', scritto,
    [['insert', { titolo: 'Idea', testo: 'Un tasto', categoria: 'idea' }], ['update', { categoria: 'correzione' }]])
  ok('database: senza categoria non si scrive niente', [await errore(() => vero.apriSegnalazione('Idea', 'Un tasto')), scritto.length], [scegli, 2])

  // Col database senza 38-segnalazioni-categoria.sql: la colonna non c'è.
  const risposta = (r) => {
    const c = new Proxy(() => c, { get: (_, k) => (k === 'range' ? (da) => (da ? oltre : c) : k === 'then' ? (fatto) => fatto(r) : () => c), apply: () => c })
    return c
  }
  const lette = []
  const senzaCategoria = m.creaSegreteriaSupabase({
    auth: { getSession: async () => ({ data: { session: null } }) },
    from: (t) => ({
      select: (cols) => {
        if (t !== 'segnalazioni') return risposta({ data: [], error: null })
        lette.push(cols)
        return risposta(cols.includes('categoria')
          ? { data: null, error: { code: '42703', message: 'column segnalazioni.categoria does not exist' } }
          : { data: [{ id: 'v1', padre_id: null, titolo: 'Di prima', testo: 'Vecchio', scritta_il: '2026-09-01T10:00:00.000Z', chiusa_il: null, autore: null }], error: null })
      },
      insert: () => risposta({ data: null, error: { code: 'PGRST204', message: "Could not find the 'categoria' column of 'segnalazioni' in the schema cache" } }),
    }),
  })
  const fili = await senzaCategoria.segnalazioni()
  ok('senza 38-…: si rilegge senza, e il filo non ha categoria', [lette.map((c) => c.includes('categoria')), fili.map((y) => [y.id, y.categoria])], [[true, false, false], [['v1', undefined]]])
  ok('senza 38-…: aprire dice quale file lanciare', await errore(() => senzaCategoria.apriSegnalazione('T', 'x', 'idea')),
    'Le categorie delle segnalazioni non sono ancora attive sul database: va lanciato 38-segnalazioni-categoria.sql')
}

console.log('\nun file nelle segnalazioni')
{
  const MB = 1024 * 1024
  const f = (name, type, size = 1000) => ({ name, type, size })
  const png = f('schermata.png', 'image/png')
  ok('al massimo 3 per messaggio', m.MAX_ALLEGATI, 3)
  for (const t of ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'])
    ok(`${t} va`, m.cosaNonVaAllegato(f('x', t), 0), null)
  ok('10 MB giusti vanno', m.cosaNonVaAllegato(f('a.pdf', 'application/pdf', 10 * MB), 0), null)
  ok('più di 10 MB no, col nome e cosa fare', m.cosaNonVaAllegato(f('foto.jpg', 'image/jpeg', 14 * MB), 0), '«foto.jpg» pesa 14 MB: il massimo è 10. Rimpiccioliscilo o mandane un altro')
  ok('un tipo non ammesso no, col nome e cosa fare', m.cosaNonVaAllegato(f('cartella.zip', 'application/zip'), 0), '«cartella.zip» non si può allegare: vanno bene foto (JPEG, PNG, WebP, HEIC) e PDF. Mandane un altro')
  ok('un file vuoto no', m.cosaNonVaAllegato(f('vuoto.png', 'image/png', 0), 0), '«vuoto.png» è vuoto. Mandane un altro')
  ok('con 2 già, il terzo va', m.cosaNonVaAllegato(png, 2), null)
  ok('con 3 già, il quarto no, e dice cosa fare', m.cosaNonVaAllegato(png, 3), 'Si allegano al massimo 3 file per messaggio: togline uno prima di aggiungere «schermata.png»')

  // Lo screenshot incollato dagli appunti arriva sempre come «image.png».
  const adesso = new Date(2026, 8, 26, 12, 5)
  ok('uno screenshot incollato prende un nome dall\'ora', m.nomeAllegato(f('image.png', 'image/png'), adesso), 'schermata-2026-09-26-1205.png')
  ok('anche senza nome, con l\'estensione del tipo', m.nomeAllegato(f('', 'image/jpeg'), adesso), 'schermata-2026-09-26-1205.jpg')
  ok('un file scelto tiene il suo nome', m.nomeAllegato(f('lista.pdf', 'application/pdf'), adesso), 'lista.pdf')

  ok('lo stesso nome due volte non si sovrascrive', m.nomeUnico('schermata.png', ['schermata.png']), 'schermata (2).png')
  ok('e alla terza', m.nomeUnico('schermata.png', ['schermata.png', 'schermata (2).png']), 'schermata (3).png')
  ok('un nome nuovo resta', m.nomeUnico('lista.pdf', ['schermata.png']), 'lista.pdf')
  ok('senza rete un file non parte, e lo dice', m.motivoSenzaRete(false, 1), 'Niente rete: il file non parte')
  ok('senza rete e senza file non dice niente', m.motivoSenzaRete(false, 0), null)
  ok('con la rete niente', m.motivoSenzaRete(true, 2), null)

  ok('un nome da più di 200 caratteri no, e dice di rinominarlo', m.cosaNonVaAllegato(f('a'.repeat(201) + '.png', 'image/png'), 0), 'Il nome di questo file è troppo lungo (massimo 200 caratteri): rinominalo o mandane un altro')

  // I file scelti: entrano quelli che vanno, e il primo guaio resta detto (più uno se ce ne sono altri).
  const sc = m.scegliAllegati([png], [f('a.pdf', 'application/pdf'), f('b.zip', 'application/zip')])
  ok('scegliendone due, quello giusto entra', sc.dentro.map((x) => x.name), ['schermata.png', 'a.pdf'])
  ok('e quello sbagliato lo dice', sc.guaio, '«b.zip» non si può allegare: vanno bene foto (JPEG, PNG, WebP, HEIC) e PDF. Mandane un altro')
  const due = m.scegliAllegati([], [f('x.zip', 'application/zip'), f('y.zip', 'application/zip'), f('z.zip', 'application/zip')])
  ok('più file sbagliati: il primo guaio e quanti altri', due.guaio, '«x.zip» non si può allegare: vanno bene foto (JPEG, PNG, WebP, HEIC) e PDF. Mandane un altro (e altri 2 file)')
  ok('oltre il tetto non entrano', m.scegliAllegati([png, png, png], [f('d.pdf', 'application/pdf')]).dentro.length, 3)
  ok('senza file niente guaio', m.scegliAllegati([png], []).guaio, '')
  ok('un\'immagine che il browser disegna ha l\'anteprima', [m.haAnteprima('image/png'), m.haAnteprima('image/jpeg'), m.haAnteprima('image/webp')], [true, true, true])
  ok('HEIC e PDF no', [m.haAnteprima('image/heic'), m.haAnteprima('application/pdf')], [false, false])

  // Il messaggio parte, un file no: lo si dice, non si rimanda il messaggio.
  const caricati = []
  const falliti = await m.mandaAllegati([png, f('lista.pdf', 'application/pdf'), f('b.jpg', 'image/jpeg')], async (x) => {
    if (x.name === 'lista.pdf') return false
    caricati.push(x.name)
    return true
  })
  ok('i file che partono, partono', caricati, ['schermata.png', 'b.jpg'])
  ok('quello che non parte è detto per nome', falliti, ['lista.pdf'])
  ok('l\'avviso dice quale e cosa fare', m.avvisoNonPartiti(['lista.pdf']), 'Messaggio mandato, ma non è partito: lista.pdf. Allegalo a una nuova risposta.')

  // La pulizia: 30 giorni dopo la chiusura del filo, mai prima.
  const adessoIso = new Date(2026, 8, 26, 12, 0).toISOString()
  const fa = (g) => new Date(new Date(2026, 8, 26, 12, 0).getTime() - g * 24 * 3600 * 1000).toISOString()
  ok('un filo aperto: restano', m.allegatiScaduti(undefined, adessoIso), false)
  ok('chiuso da 29 giorni: restano', m.allegatiScaduti(fa(29), adessoIso), false)
  ok('chiuso da 30 giorni: si tolgono', m.allegatiScaduti(fa(30), adessoIso), true)
  ok('chiuso da 31: si tolgono', m.allegatiScaduti(fa(31), adessoIso), true)

  // In prova gli allegati stanno solo in memoria, con le stesse regole.
  await s.apriSegnalazione('Con file', 'Guarda', 'correzione')
  const filo = async () => (await s.segnalazioni()).at(-1)
  const id = (await filo()).id
  ok('allegato senza testo no', await errore(() => s.rispondiSegnalazione(id, ' ', [png])), 'Manca il testo')
  ok('un file troppo grande no, e dice quale', await errore(() => s.rispondiSegnalazione(id, 'Ecco', [f('foto.jpg', 'image/jpeg', 14 * MB)])), '«foto.jpg» pesa 14 MB: il massimo è 10. Rimpiccioliscilo o mandane un altro')
  ok('quattro no', (await errore(() => s.rispondiSegnalazione(id, 'Ecco', [png, png, png, png]))).startsWith('Si allegano al massimo 3 file'), true)
  ok('e non è entrato niente', (await filo()).messaggi.length, 1)
  await s.rispondiSegnalazione(id, 'Ecco', [png, f('lista.pdf', 'application/pdf')])
  const r = (await filo()).messaggi[1]
  ok('la risposta ha i suoi allegati', (r.allegati ?? []).map((a) => [a.nome, a.tipo]), [['schermata.png', 'image/png'], ['lista.pdf', 'application/pdf']])
  ok('un messaggio senza allegati ne ha zero', (await filo()).messaggi[0].allegati ?? [], [])
  await s.togliAllegato?.(r.allegati?.[0]?.id)
  const dopo = (await filo()).messaggi[1]
  ok('tolto, resta l\'altro', (dopo.allegati ?? []).map((a) => a.nome), ['lista.pdf'])
  ok('il testo non cambia', dopo.testo, 'Ecco')
  ok('nel filo resta la traccia di chi e quando, non del contenuto', dopo.tolti?.length === 1 && !JSON.stringify(dopo.tolti).includes('schermata'), true)
  ok('un allegato che non c\'è no', await errore(() => s.togliAllegato('non-esiste')), 'Questo allegato non c\'è più')
  // Chiuso da 30 giorni gli allegati non si vedono più (il testo sì), come nel database.
  await s.chiudiSegnalazione(id, true)
  ok('appena chiuso gli allegati ci sono ancora', (await filo()).messaggi[1].allegati.length, 1)
  m.archivio.dati.segnalazioni.find((x) => x.id === id).chiusaIl = new Date(Date.now() - 31 * 24 * 3600 * 1000).toISOString()
  const scaduto = (await filo()).messaggi[1]
  ok('chiuso da 31 giorni gli allegati non ci sono più', scaduto.allegati ?? [], [])
  ok('e il testo resta', scaduto.testo, 'Ecco')
}

console.log('\neliminare un istruttore')
{
  const id = await s.salvaPersonale({ nome: 'Pino', cognome: 'Sbagliato', email: 'pino@esempio.it', ruolo: 'istruttore' })
  await s.impostaPin(id, '8642')
  await s.eliminaIstruttore(id)
  ok('chi non ha mai insegnato se ne va', (await s.personale()).some((p) => p.id === id), false)
  const altro = await s.salvaPersonale({ nome: 'Pina', cognome: 'Giusta', email: 'pina@esempio.it', ruolo: 'istruttore' })
  ok('e il suo PIN torna libero', await errore(() => s.impostaPin(altro, '8642')), 'nessun errore')
  const fabio = await errore(() => s.eliminaIstruttore('i-fabio'))
  ok('chi tiene un corso no, e dice quale', fabio.startsWith('Fabio insegna ancora in '), true)
  ok('e resta', (await s.personale()).some((p) => p.id === 'i-fabio'), true)
  ok('se stessa no', await errore(() => s.eliminaIstruttore('s-prova')), "Non ci si elimina da soli: lo fa un'altra persona di segreteria")
  const bea = await s.salvaPersonale({ nome: 'Bea', cognome: 'Banco', email: 'bea@esempio.it', ruolo: 'staff' })
  await s.eliminaIstruttore(bea)
  ok('chi è solo di segreteria, senza storia, sì', (await s.personale()).some((p) => p.id === bea), false)
  const ada = await s.salvaPersonale({ nome: 'Olga', cognome: 'Conti', email: 'olga.conti@esempio.it', ruolo: 'amministrazione' })
  ok('chi è solo di amministrazione no', await errore(() => s.eliminaIstruttore(ada)), "Si eliminano solo gli istruttori e la segreteria: a Olga si toglie l'accesso")
  const dario = await s.salvaPersonale({ nome: 'Dario', cognome: 'Doppio', email: 'dario@esempio.it', ...m.daSpunte(['segreteria', 'istruttore']) })
  await s.eliminaIstruttore(dario)
  ok('la segreteria che insegna anche, senza corsi, sì', (await s.personale()).some((p) => p.id === dario), false)
  await s.iscrivi(altro, 'lotta-2')
  ok('chi è anche allievo no', await errore(() => s.eliminaIstruttore(altro)), "Pina Giusta è anche allievo: non si elimina, gli si toglie l'accesso")
  ok('un iscritto nemmeno', (await errore(async () => s.eliminaIstruttore((await s.persone())[0].id))).startsWith('Si eliminano solo gli istruttori e la segreteria'), true)
  const gino = await s.salvaPersonale({ nome: 'Gino', cognome: 'Pagato', email: 'gino@esempio.it', ruolo: 'istruttore' })
  await s.registraPagamentoDiretto({ personaId: gino, data: '2026-09-10', importo: 1000, metodo: 'Contanti', voce: 'ALTRO' })
  ok('chi ha pagamenti registrati no', await errore(() => s.eliminaIstruttore(gino)), "Gino Pagato ha dei pagamenti registrati: non si elimina, gli si toglie l'accesso")
}

console.log("\ncerca iscritto: D'Amico, De Luca, Rossi-Bianchi")
{
  const trova = m.trovaIscritti
  // Le stesse persone e gli stessi casi in `prova-prove.mjs` (somiglianti) e
  // `prova-segreteria.mjs` (trovaIscritti): l'apostrofo, di qualunque forma, e
  // il trattino non separano soltanto, si possono anche saltare; un cognome di
  // due parole si scrive anche attaccato.
  const p = (id, nome, cognome, attiva = true) => ({ id, nome, cognome, attiva, corso: 'Lotta 2', inizio: '' })
  const gente = [
    p('a', 'Anna', "D'Amico"),
    p('b', 'Bruno', 'D\u2019Amico'),
    p('c', 'Nicolò', 'De Luca'),
    p('d', 'Sara', 'Rossi-Bianchi'),
    p('e', 'Marco', 'Nuovo'),
    p('f', 'Marco', 'Rossi'),
  ]
  const chi = (scritto) => trova(gente, scritto).map((x) => x.nome).sort()
  for (const s of ["d'am", 'd\u2019am', 'd\u2018am', 'd\u02BCam', 'd\u00B4am', 'dam', 'damico', 'amico', "D'AM"])
    ok(`«${s}» trova D'Amico, scritto con l'apostrofo dritto e con quello tipografico`, chi(s), ['Anna', 'Bruno'])
  ok("«mico» non trova D'Amico: si comincia dall'inizio di una parola", chi('mico'), [])
  ok("«d'a»: senza contare l'apostrofo, la segreteria cerca già da due lettere", chi("d'a"), ['Anna', 'Bruno'])
  ok('«NICOLO deluca» trova Nicolò De Luca', chi('NICOLO deluca'), ['Nicolò'])
  for (const s of ['de lu', 'luca', 'del']) ok(`«${s}» trova De Luca`, chi(s), ['Nicolò'])
  ok('«eluca» non trova De Luca', chi('eluca'), [])
  for (const s of ['bianchi', 'rossibi', 'rossi-bi']) ok(`«${s}» trova Rossi-Bianchi`, chi(s), ['Sara'])
  // Il trattino lungo e quello tipografico escono da un tasto lungo o dal correttore.
  for (const s of ['rossi\u2013bi', 'rossi\u2014bi', 'rossi\u2010bi']) ok(`«${s}» trova Rossi-Bianchi`, chi(s), ['Sara'])
  ok('«mar nu» trova solo Marco Nuovo', trova(gente, 'mar nu').map((x) => x.id), ['e'])
  ok('«marconu» nessuno: nome e cognome non si attaccano fra loro', chi('marconu'), [])
  ok("«'», «-» e due spazi: nessuno", ["'", '-', '  '].map((s) => chi(s)), [[], [], []])
  const dieci = ["D'Amico", 'Damiani', "D'Amato", 'Dameri', 'D\u2019Ambrosio', 'Damasio', "D'Amelio", 'Damonte', "D'Amore", 'Damigella'].map((c, i) =>
    p(`x${i}`, 'Ugo', c, ![1, 2, 3].includes(i)),
  )
  const perCognome = (a, b) => a.cognome.localeCompare(b.cognome, 'it')
  const voluti = [...dieci.filter((x) => x.attiva).sort(perCognome), ...dieci.filter((x) => !x.attiva).sort(perCognome)].slice(0, 8)
  ok('con dieci che cominciano per «dam», otto: prima chi è attivo, poi per cognome', trova(dieci, 'dam').map((x) => x.cognome), voluti.map((x) => x.cognome))
}

console.log('\nunire due schede')
{
  const oggi = '2026-09-26'
  const di = async (id) => (await s.persone()).find((p) => p.id === id)
  const nuova = (nome, cognome, altro = {}) => s.salvaPersona({ nome, cognome, ...altro })
  const resta = await nuova('Mario', "D'Amico")
  const via = await nuova('Mario', 'Damico', { email: 'mario.damico@esempio.it', telefono: '333 1234567' })

  // Le tre lezioni passate di Lotta 2: nella prima tutti e due, nella seconda
  // tutti e due, nella terza solo il doppione.
  const [l1, l2, l3] = await lotta2([8, 14], [8, 25])
  m.memoria.segnate = {
    ...m.memoria.segnate,
    [l1.id]: { ...m.memoria.segnate[l1.id], [resta]: 'assente', [via]: 'presente' },
    [l2.id]: { ...m.memoria.segnate[l2.id], [resta]: 'giustificato', [via]: 'assente' },
    [l3.id]: { ...m.memoria.segnate[l3.id], [via]: 'presente' },
  }
  m.archivio.dati.prove = [...(m.archivio.dati.prove ?? []), { sessioneId: l3.id, personaId: via, il: l3.inizio }]
  m.archivio.dati.iscrizioni = [
    ...m.archivio.dati.iscrizioni,
    { corsoId: 'lotta-2', personaId: resta, dal: '2026-01-10', al: '2026-06-30' },
    { corsoId: 'lotta-2', personaId: via, dal: '2025-09-01' },
    { corsoId: 'judo-2', personaId: via, dal: '2026-09-14', al: '2027-06-30' },
    { corsoId: 'pesistica', personaId: resta, dal: '2026-02-01', al: '2026-03-31' },
    { corsoId: 'pesistica', personaId: via, dal: '2026-03-01', al: '2026-12-31' },
  ]
  await s.salvaCertificato(resta, '2026-12-31')
  await s.salvaCertificato(via, '2027-05-31')
  await s.salvaAnagrafica(resta, { comune: 'Collegno' })
  await s.salvaAnagrafica(via, { comune: 'Rivoli', codiceFiscale: 'DMCMRA10A01L219X', cap: '10098', genitoreNome: 'Anna' })
  const quota = { descrizione: 'QUOTA ASSOCIATIVA', quantita: 1, prezzo: 5000, dal: '2026-09-01', al: '2027-07-31', pagamenti: [{ data: '2026-09-10', importo: 5000, metodo: 'Contanti' }] }
  const ricevuta = await s.emettiRicevuta({ data: '2026-09-10', personaId: via, ente: await s.enteRicevute(), intestatario: await s.intestatarioDi(via), anticipo: 0, voci: [quota] })
  ok('prima, chi resta deve ancora pagare la quota', m.pagamentoDi(await di(resta), oggi).come, 'da_pagare')

  // Chi non si unisce.
  ok('una scheda con se stessa no', await errore(() => s.unisciPersone(resta, resta)), 'Scegli due schede diverse')
  ok('un istruttore no', await errore(() => s.unisciPersone(resta, 'i-fabio')), 'Si uniscono solo le schede degli iscritti, non quelle del personale')
  const sara1 = await nuova('Sara', 'Bianchi')
  const sara2 = await nuova('Sara', 'Bianchi')
  await s.salvaAnagrafica(sara1, { codiceFiscale: 'BNCSRA10A41L219X' })
  await s.salvaAnagrafica(sara2, { codiceFiscale: 'BNCSRA12B41L219Y' })
  ok('due codici fiscali diversi no', await errore(() => s.unisciPersone(sara1, sara2)), 'Hanno due codici fiscali diversi: non sono la stessa persona. Se uno è sbagliato, correggilo nella scheda e riprova')
  ok('e restano tutte e due', [!!(await di(sara1)), !!(await di(sara2))], [true, true])
  // Chi ha un file del certificato non blocca più l'unione: il file passa a chi resta (prova-certificati.mjs).
  const titolare = await nuova('Gina', 'Damico')
  const figlio = await nuova('Mario', 'Damico')
  await s.mettiNelNucleo(figlio, titolare)
  const nelNucleo = await errore(() => s.unisciPersone(resta, figlio))
  ok('chi è in un nucleo no: prima toglila dal nucleo', nelNucleo, "Mario Damico è nel nucleo familiare di un'altra persona: prima toglila dal nucleo")
  const ilTitolare = await errore(() => s.unisciPersone(resta, titolare))
  ok('nemmeno chi ne è titolare', ilTitolare, "Gina Damico è titolare di un nucleo familiare: prima rendi titolare qualcun altro o togli gli altri dal nucleo")

  ok('l\'anteprima dice cosa passa', await s.anteprimaUnione(resta, via), { presenze: 3, prove: 1, iscrizioni: 3, ricevute: 1 })
  ok('e non cambia niente', !!(await di(via)), true)

  await s.unisciPersone(resta, via)
  const r = await di(resta)
  ok('il doppione non c\'è più', !!(await di(via)), false)
  ok('il nome resta quello di chi resta, email e telefono vuoti si riempiono', [r.nome, r.cognome, r.email, r.telefono], ['Mario', "D'Amico", 'mario.damico@esempio.it', '333 1234567'])
  ok('presente vince su assente, giustificato su assente, la terza passa',
    [m.memoria.segnate[l1.id][resta], m.memoria.segnate[l2.id][resta], m.memoria.segnate[l3.id][resta]], ['presente', 'giustificato', 'presente'])
  ok('del doppione nessuna presenza', Object.values(m.memoria.segnate).some((x) => via in x), false)
  ok('la prova passa', (m.archivio.dati.prove ?? []).filter((x) => x.sessioneId === l3.id).map((x) => x.personaId), [resta])
  ok('le iscrizioni: una per corso, dalla più vecchia alla fine più lontana',
    r.iscrizioni.map((i) => [i.corsoId, i.dal, i.al ?? null]).sort((x, y) => x[0].localeCompare(y[0])),
    [['judo-2', '2026-09-14', '2027-06-30'], ['lotta-2', '2025-09-01', null], ['pesistica', '2026-02-01', '2026-12-31']])
  const sue = await s.ricevute(resta)
  ok('la ricevuta passa, con lo stesso numero e lo stesso intestatario', sue.map((x) => [x.numero, x.intestatario.cognome]), [[ricevuta.numero, 'Damico']])
  ok('e chi resta ha pagato la quota', m.pagamentoDi(r, oggi).come, 'pagato')
  ok('il certificato: la scadenza più lontana', r.certificato.scade, '2027-05-31')
  ok('l\'anagrafica: vince chi resta, i vuoti dal doppione', (({ comune, codiceFiscale, cap, genitoreNome }) => ({ comune, codiceFiscale, cap, genitoreNome }))((await s.anagraficaDi(resta)).dati),
    { comune: 'Collegno', codiceFiscale: 'DMCMRA10A01L219X', cap: '10098', genitoreNome: 'Anna' })

  const elena = await nuova('Elena', 'Verdi', { email: 'elena@esempio.it' })
  const elena2 = await nuova('Elena', 'Verdi', { email: 'elena.verdi@esempio.it' })
  await s.salvaPagamento(elena, { stato: 'pagato', fino: '2026-10-31' })
  await s.salvaPagamento(elena2, { stato: 'pagato', fino: '2027-01-31', nota: 'carta n. 12' })
  await s.unisciPersone(elena, elena2)
  const e = await di(elena)
  ok('due email diverse: resta quella di chi resta', e.email, 'elena@esempio.it')
  ok('pagata fuori dall\'app: la scadenza più lontana, e la nota vuota si riempie', [e.pagamento.fino, e.pagamento.nota], ['2027-01-31', 'carta n. 12'])

  // «Pagato» senza «fino»: pagato senza scadenza, come l'`al` vuoto delle iscrizioni.
  const ugo = await nuova('Ugo', 'Gialli')
  const ugo2 = await nuova('Ugo', 'Gialli')
  await s.salvaPagamento(ugo, { stato: 'pagato' })
  await s.salvaPagamento(ugo2, { stato: 'pagato', fino: '2026-08-27' })
  await s.unisciPersone(ugo, ugo2)
  const u = (await di(ugo)).pagamento
  ok('pagato senza scadenza e un doppione pagato fino a un mese fa: resta pagato senza scadenza', [u.stato, u.fino ?? null], ['pagato', null])
  const ivo = await nuova('Ivo', 'Blu')
  const ivo2 = await nuova('Ivo', 'Blu')
  await s.salvaPagamento(ivo2, { stato: 'pagato' })
  await s.unisciPersone(ivo, ivo2)
  const iv = (await di(ivo)).pagamento
  ok('da pagare e un doppione pagato senza scadenza: diventa pagato senza scadenza', [iv.stato, iv.fino ?? null], ['pagato', null])

  // Le richieste di iscrizione di prova stanno in localStorage, accanto all'archivio.
  const RICHIESTE = 'ods-corsi:prova-richieste'
  const richiesta = (personaId, codiceFiscale, gestitaIl) => ({
    id: `r-${personaId}`, creataIl: '2026-09-01T10:00:00.000Z', gestitaIl, stato: 'accolta', personaId,
    nome: 'Luca', cognome: 'Verdi', natoIl: '2012-02-01', natoA: 'Torino', codiceFiscale, indirizzo: 'via Po 2', cap: '10093', comune: 'Collegno',
    email: 'luca.verdi@esempio.it', telefono: '3337654321', corsi: ['judo-2'], formula: 'annuale',
  })
  const aggiungiRichiesta = (r) => localStorage.setItem(RICHIESTE, JSON.stringify([...JSON.parse(localStorage.getItem(RICHIESTE) ?? '[]'), r]))
  const diRichieste = (id) => JSON.parse(localStorage.getItem(RICHIESTE) ?? '[]').filter((r) => r.personaId === id).map((r) => r.id)

  // Il codice fiscale della richiesta accolta conta come quello della scheda.
  const luca = await nuova('Luca', 'Verdi')
  const luca2 = await nuova('Luca', 'Verdi')
  await s.salvaAnagrafica(luca, { codiceFiscale: 'VRDLCU10A01L219X' })
  aggiungiRichiesta(richiesta(luca2, 'VRDLCU12B01L219Y', '2026-09-02T10:00:00.000Z'))
  ok('un codice fiscale nella scheda e un altro solo nella richiesta accolta: no', await errore(() => s.unisciPersone(luca, luca2)),
    'Hanno due codici fiscali diversi: non sono la stessa persona. Se uno è sbagliato, correggilo nella scheda e riprova')
  ok('e restano tutti e due', [!!(await di(luca)), !!(await di(luca2))], [true, true])

  // Dopo l'unione l'anagrafica unita è la più recente, come col trigger
  // `anagrafiche_cambiata` del database; la richiesta e le segnalate del doppione passano.
  const gino = await nuova('Gino', 'Rosa')
  const gino2 = await nuova('Gino', 'Rosa')
  await s.salvaAnagrafica(gino, { comune: 'Collegno' })
  await s.salvaAnagrafica(gino2, { cap: '10098' })
  m.archivio.dati.anagrafiche[gino] = { ...m.archivio.dati.anagrafiche[gino], cambiataIl: '2026-09-01T10:00:00.000Z' }
  aggiungiRichiesta({ ...richiesta(gino2, 'RSOGNI12B01L219Y', '2026-09-20T10:00:00.000Z'), nome: 'Gino', cognome: 'Rosa', comune: 'Rivoli' })
  m.archivio.dati.segnalate = [...(m.archivio.dati.segnalate ?? []),
    { id: 'sg-gino2', sessioneId: l3.id, personaId: gino2, il: '2026-09-25T10:00:00.000Z', stato: 'da_vedere' }]
  await s.unisciPersone(gino, gino2)
  const ag = await s.anagraficaDi(gino)
  ok('dopo l\'unione vince l\'anagrafica unita, anche su una richiesta accolta più recente', [ag?.da, ag?.dati.comune, ag?.dati.cap], ['segreteria', 'Collegno', '10098'])
  ok('la richiesta di iscrizione del doppione passa', [diRichieste(gino), diRichieste(gino2)], [[`r-${gino2}`], []])
  ok('le presenze segnalate del doppione passano', (m.archivio.dati.segnalate ?? []).filter((x) => x.id === 'sg-gino2').map((x) => x.personaId), [gino])

  // Chi trova un doppione spesso l'ha disattivato: se l'altra era attiva, la scheda unita lo è.
  const spenta = await nuova('Marco', "D'Amico")
  const accesa = await nuova('Marco', 'Damico')
  await s.attivaPersona(spenta, false)
  await s.unisciPersone(spenta, accesa)
  ok('resta disattivata, se ne va attiva: la scheda unita è attiva', (await di(spenta)).attiva, true)

  // Col database senza 29-unisci-doppioni.sql: la funzione non c'è.
  const senza = m.creaSegreteriaSupabase({
    rpc: async (f) => ({ data: null, error: { code: 'PGRST202', message: `Could not find the function public.${f}(resta, via) in the schema cache` } }),
  })
  const manca = await errore(() => senza.unisciPersone(resta, via))
  ok('senza il file sul database dice quale lanciare', manca.includes('29-unisci-doppioni.sql') ? '29-unisci-doppioni.sql' : manca, '29-unisci-doppioni.sql')

  // I possibili doppioni, aperta una scheda: lo stesso cognome scritto in un altro modo, prima.
  const scheda = (id, nome, cognome, altro = {}) => ({ id, nome, cognome, attiva: true, creataIl: oggi, iscrizioni: [], certificato: { conFile: false }, documento: false, pagamento: { stato: 'da_pagare' }, ...altro })
  const mario = scheda('1', 'Mario', "D'Amico", { email: 'mario@esempio.it' })
  const tutte = [
    scheda('0', 'Anna', 'Rossi'),
    mario,
    scheda('2', 'Mario', 'DAmico', { email: 'mario.damico@esempio.it', telefono: '333 1234567' }),
    scheda('3', 'Luca', 'D’amico'),
  ]
  const proposti = m.possibiliDoppioni(mario, tutte)
  ok('aperto Mario D\'Amico: Mario DAmico e Luca D’amico, prima', proposti.slice(0, 2).map((p) => p.id).sort(), ['2', '3'])
  ok('non sé stesso', proposti.some((p) => p.id === '1'), false)
  ok('i campi che non tornano: cognome, email, telefono',
    m.campiDiversi(mario, tutte[2]).map((c) => [c.resta, c.via]),
    [["D'Amico", 'DAmico'], ['mario@esempio.it', 'mario.damico@esempio.it'], ['', '333 1234567']])
}

console.log('\ngli errori del server e le voci dei tablet, detti per la segreteria')
{
  // Un database finto che a ogni domanda risponde con lo stesso errore.
  const sbaglia = (error) => {
    const passo = new Proxy(() => {}, {
      get: (_, k) => (k === 'then' ? (fatto) => fatto({ data: null, error }) : () => passo),
      apply: () => passo,
    })
    return m.creaSegreteriaSupabase({ from: () => passo, rpc: () => passo })
  }
  const zitta = console.error
  console.error = () => {}
  const scaduto = await errore(() => sbaglia({ code: 'XX000', message: 'JWT expired' }).sale())
  ok('un errore sconosciuto non mostra il testo del server', /JWT|expired/.test(scaduto), false)
  ok('…e dice cosa fare', /riprova/i.test(scaduto), true)
  const senzaRete = await errore(() => sbaglia({ message: 'TypeError: Failed to fetch' }).sale())
  ok('senza rete lo dice', [/rete/i.test(senzaRete), /fetch/i.test(senzaRete)], [true, false])
  // I nostri `raise exception` sono già scritti per la segreteria: passano così come sono.
  ok('un messaggio del database in italiano arriva com’è', await errore(() => sbaglia({ code: 'P0001', message: 'Scegli due schede diverse' }).sale()), 'Scegli due schede diverse')
  ok('anche con P0002, «non c’è più»', await errore(() => sbaglia({ code: 'P0002', message: 'ricevuta inesistente o già annullata' }).sale()), 'ricevuta inesistente o già annullata')
  ok('anche con 22023', await errore(() => sbaglia({ code: '22023', message: 'La data della ricevuta non si capisce' }).sale()), 'La data della ricevuta non si capisce')
  ok('il permesso resta detto com’era', await errore(() => sbaglia({ code: '42501', message: 'permission denied for table sale' }).sale()), 'Non hai il permesso: serve un accesso da segreteria')
  console.error = zitta

  const tutte = ['Grandma (Italiano (Italia))', 'Alice (Enhanced)', 'Microsoft Elsa - Italian (Italy)', 'Federica']
  ok('la lingua tra parentesi se ne va', m.nomeVoce('Grandma (Italiano (Italia))', tutte), 'Grandma')
  ok('la marcatura di qualità resta', m.nomeVoce('Alice (Enhanced)', tutte), 'Alice (Enhanced)')
  ok('anche la lingua dopo il trattino', m.nomeVoce('Microsoft Elsa - Italian (Italy)', tutte), 'Microsoft Elsa')
  ok('un nome semplice resta', m.nomeVoce('Federica', tutte), 'Federica')
  const doppie = ['Luca (Italiano (Italia))', 'Luca (Italiano (Svizzera))']
  ok('due che diventerebbero uguali restano intere', doppie.map((v) => m.nomeVoce(v, doppie)), doppie)
}

// Il testo spento del tema chiaro sul fondo del menu e sui riquadri alti: le
// scritte piccole (titoli dei gruppi, ruolo, versione) devono arrivare a 4,5:1.
// L'app e il timer hanno lo stesso token: si provano tutti e due.
{
  const luce = (hex) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }
  // Il rapporto fino a 4,5: oltre basta, sotto la prova rossa dice di quanto manca.
  const contrasto = (a, b) => {
    const [x, y] = [luce(a), luce(b)].sort((p, q) => q - p)
    return Math.min(4.5, Math.floor(((x + 0.05) / (y + 0.05)) * 100) / 100)
  }
  for (const file of ['src/styles.css', 'timer/src/styles.css']) {
    const css = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
    const tema = (sel) => {
      const corpo = css.slice(css.indexOf(sel + ' {')).split('}')[0]
      return Object.fromEntries([...corpo.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1], m[2]]))
    }
    const chiaro = tema(":root[data-tema='chiaro']")
    for (const fondo of ['menu', 'surface-2'].filter((f) => chiaro[f])) ok(`${file}, tema chiaro: testo spento su --${fondo}`, contrasto(chiaro.dim, chiaro[fondo]), 4.5)
    ok(`${file}, tema scuro: il testo spento resta quello`, tema(':root').dim, '#8c8c88')
    // Il Tatami: il testo spento si legge su tutti i fondi chiari, e sul menu
    // verde muschio si legge quello che il menu rimappa (i token di testo lì
    // tornano chiari). Il blocco mancante è un caso rosso, non un errore.
    const tatami = tema(":root[data-tema='tatami']")
    for (const fondo of ['bg', 'surface', 'surface-2']) ok(`${file}, tema tatami: testo spento su --${fondo}`, tatami.dim && tatami[fondo] ? contrasto(tatami.dim, tatami[fondo]) : 0, 4.5)
    const nelMenu = [...css.matchAll(/:root\[data-tema=['"]?tatami['"]?\]\s+[^{}]+\{([^}]*)\}/g)].map((m) => m[1].match(/--dim:\s*(#[0-9a-f]{6})/i)?.[1]).find(Boolean)
    ok(`${file}, tema tatami: il testo spento nel menu su --menu`, nelMenu && tatami.menu ? contrasto(nelMenu, tatami.menu) : 0, 4.5)
  }
}

console.log('\ni timbri in cima alla scheda: certificato, quota, documento')
{
  // Oggi è il 26 settembre 2026.
  const oggi = '2026-09-26'
  const fra = (n) => {
    const x = new DateVera(Date.UTC(2026, 8, 26 + n))
    return x.toISOString().slice(0, 10)
  }
  const corta = (g) => `${g.slice(8, 10)}/${g.slice(5, 7)}`
  // Nei timbri la data intera, con l'anno: la scheda si legge anche fra un anno.
  const lunga = (g) => `${corta(g)}/${g.slice(0, 4)}`
  const persona = (altro = {}) => ({
    id: 'p-t', nome: 'Anna', cognome: 'Timbri', attiva: true, creataIl: '2026-09-01', iscrizioni: [],
    certificato: { conFile: false }, documento: false, pagamento: { stato: 'da_pagare' }, quote: [], ...altro,
  })
  const timbri = (p) => m.timbriScheda(p, oggi)
  const inElenco = (p) => m.paroleInRegola(p, oggi)
  const testi = (t) => (t ? [t.parola, ...t.righe.map((r) => (typeof r === 'string' ? r : r.testo))] : [])
  const riga = (t, testo) => t?.righe.find((r) => r.testo === testo) ?? null
  const cert = (scade, conFile = false) => timbri(persona({ certificato: { scade, conFile } }))?.certificato
  const pagata = { anno: 2026, numero: 12, dal: '2026-09-01', al: fra(200), mancano: 0 }
  const quota = (altro) => timbri(persona(altro))?.quota

  // 1. Il certificato.
  ok('certificato che scade fra 10 giorni: giallo', cert(fra(10))?.tono, 'giallo')
  ok('… con la data: SCADE IL gg/mm/aaaa', cert(fra(10))?.parola, `SCADE IL ${lunga(fra(10))}`)
  ok('… e sotto quanto manca: FRA 10 GIORNI', testi(cert(fra(10)))[1], 'FRA 10 GIORNI')
  ok('scade domani: sotto DOMANI, non FRA 1 GIORNI', testi(cert(fra(1)))[1], 'DOMANI')
  ok('scade oggi: niente FRA sotto', testi(cert(oggi)).some((x) => x.startsWith('FRA ') || x === 'DOMANI'), false)
  ok('in scadenza col file: solo FRA, il file non dice più DA STAMPARE', testi(cert(fra(10), true)).slice(1), ['FRA 10 GIORNI'])
  ok('certificato che scade fra 31 giorni: verde', cert(fra(31))?.tono, 'verde')
  ok('… VALIDO FINO AL gg/mm/aaaa', cert(fra(31))?.parola, `VALIDO FINO AL ${lunga(fra(31))}`)
  ok('… VALIDO FINO ALL’11/07/2027, non AL 11', cert('2027-07-11')?.parola, 'VALIDO FINO ALL’11/07/2027')
  ok('certificato scaduto ieri: rosso', cert(fra(-1))?.tono, 'rosso')
  ok('… SCADUTO IL gg/mm/aaaa', cert(fra(-1))?.parola, `SCADUTO IL ${lunga(fra(-1))}`)
  ok('nessuna data: rosso', cert(undefined)?.tono, 'rosso')
  ok('nessuna data: NO CERTIFICATO, come in elenco', cert(undefined)?.parola, 'NO CERTIFICATO')
  ok('scade oggi: giallo', cert(oggi)?.tono, 'giallo')
  ok('scade oggi: SCADE OGGI, non SCADE IL', [testi(cert(oggi)).includes('SCADE OGGI'), testi(cert(oggi)).some((x) => x.startsWith('SCADE IL'))], [true, false])

  // 2. Il file non cambia il timbro: né un DA STAMPARE, né un altro colore (il file di prima: prova-certificati.mjs).
  ok('con il file e valido fino a fra 100 giorni: verde', cert(fra(100), true)?.tono, 'verde')
  ok('… e nessuna riga DA STAMPARE', riga(cert(fra(100), true), 'DA STAMPARE'), null)
  ok('con il file e senza data: rosso', cert(undefined, true)?.tono, 'rosso')
  ok('… e nessuna riga DA STAMPARE', riga(cert(undefined, true), 'DA STAMPARE'), null)

  // 3. La quota.
  const q1 = quota({ quote: [pagata] })
  ok('ricevuta che vale oggi, tutta pagata: verde', q1?.tono, 'verde')
  ok('… con il numero della ricevuta', testi(q1).some((x) => x.includes('12/2026')), true)
  ok('… e FINO AL gg/mm/aaaa', testi(q1).includes(`FINO AL ${lunga(fra(200))}`), true)
  ok('pagata fino all’8 agosto: FINO ALL’8/08/2027', testi(quota({ quote: [{ ...pagata, al: '2027-08-08' }] })).includes('FINO ALL’8/08/2027'), true)
  const q2 = quota({ quote: [{ ...pagata, mancano: 2000 }] })
  ok('ricevuta che vale oggi, mancano 20 €: giallo', q2?.tono, 'giallo')
  ok('… con quanto manca, 20,00 €', testi(q2).some((x) => x.includes('20,00 €')), true)
  const q3 = quota({ quote: [{ ...pagata, dal: '2025-09-01', al: fra(-1) }] })
  ok('ricevuta che valeva fino a ieri: rosso', q3?.tono, 'rosso')
  ok('… QUOTA SCADUTA, come in elenco', q3?.parola, 'QUOTA SCADUTA')
  ok('… VALEVA FINO AL gg/mm/aaaa', testi(q3)[1], `VALEVA FINO AL ${lunga(fra(-1))}`)
  const q4 = quota({})
  ok('niente ricevute né eccezioni: rosso', q4?.tono, 'rosso')
  ok('… DA PAGARE, come in elenco', q4?.parola, 'DA PAGARE')
  const q5 = quota({ pagamento: { stato: 'pagato', fino: fra(100) } })
  ok('pagata fuori dall’app, che vale oggi: verde', q5?.tono, 'verde')
  // Una riga sola con la data: su due il timbro QUOTA era più alto degli altri.
  ok('… con una riga sola, FUORI APP · FINO AL…', testi(q5).length === 2 && testi(q5)[1].startsWith('FUORI APP · FINO AL'), true)
  ok('con la ricevuta, niente FUORI APP', q1 ? testi(q1).some((t) => t.startsWith('FUORI APP')) : 'nessun timbro', false)

  // 4. Il documento: si vede, ma non conta per «in regola».
  const doc = (documento) => timbri(persona({ documento }))?.documento
  ok('documento in segreteria: verde IN SEGRETERIA', [doc(true)?.tono, doc(true)?.parola], ['verde', 'IN SEGRETERIA'])
  ok('documento da portare: giallo DA PORTARE', [doc(false)?.tono, doc(false)?.parola], ['giallo', 'DA PORTARE'])
  // La scheda non sa l'età: il genitore lo dice la sezione DOCUMENTO, non il timbro di ogni adulto.
  ok('… e sotto solo NON SERVE PER ENTRARE', testi(doc(false)).slice(1), ['NON SERVE PER ENTRARE'])
  const senzaDoc = persona({ certificato: { scade: fra(100), conFile: false }, quote: [pagata], documento: false })
  ok('senza documento è in regola lo stesso', m.inRegola(senzaDoc, oggi), true)
  ok('… e in elenco resta IN REGOLA', inElenco(senzaDoc), [{ tono: 'verde', parola: 'In regola' }])

  // 5. Chi è disattivato: tutto spento, le parole restano.
  const guai5 = { certificato: { scade: fra(-1), conFile: false }, pagamento: { stato: 'da_pagare' }, quote: [] }
  const attiva = timbri(persona(guai5))
  const spenta = timbri(persona({ ...guai5, attiva: false }))
  const tre = (r) => (r ? [r.certificato, r.quota, r.documento] : [])
  ok('disattivata: i tre timbri spenti', tre(spenta).map((t) => t.tono), ['spento', 'spento', 'spento'])
  ok('… con le stesse parole di quando è attiva', spenta ? tre(spenta).map(testi) : 'nessun timbro', attiva ? tre(attiva).map(testi) : 'i timbri di quando è attiva')
  ok('… e lo dice: disattivata', spenta?.disattivata, true)
  ok('attiva: non disattivata', attiva ? !!attiva.disattivata : 'nessun timbro', false)
  ok('attiva con certificato scaduto e quota da pagare: rosso e rosso', tre(attiva).slice(0, 2).map((t) => t.tono), ['rosso', 'rosso'])

  // Parole mai vuote, in tutti i casi visti.
  const visti = [cert(fra(10)), cert(fra(31)), cert(fra(-1)), cert(undefined), cert(oggi), cert(fra(100), true), q1, q2, q3, q4, q5, doc(true), doc(false), ...tre(spenta)]
  ok('nessun timbro senza parola', visti.length > 0 && visti.every((t) => t && typeof t.parola === 'string' && t.parola.trim() !== ''), true)

  // 6. La colonna IN REGOLA e i timbri dicono le stesse parole, prese dallo stesso posto.
  const casi = [
    ['niente certificato, niente quota', persona(), [{ tono: 'rosso', parola: 'Manca il certificato' }, { tono: 'rosso', parola: 'Da pagare' }, { tono: 'spento', parola: 'Senza data' }]],
    ['certificato scaduto, quota scaduta', persona({ certificato: { scade: fra(-1), conFile: false }, quote: [{ ...pagata, dal: '2025-09-01', al: fra(-1) }] }), [{ tono: 'rosso', parola: 'Certificato scaduto' }, { tono: 'rosso', parola: 'Quota scaduta' }]],
    ['certificato valido, quota in parte', persona({ certificato: { scade: fra(100), conFile: false }, quote: [{ ...pagata, mancano: 2000 }] }), [{ tono: 'giallo', parola: 'Pagata in parte' }]],
    ['in regola', persona({ certificato: { scade: fra(100), conFile: false }, quote: [pagata] }), [{ tono: 'verde', parola: 'In regola' }]],
    ['in regola fuori dall’app', persona({ certificato: { scade: fra(100), conFile: false }, pagamento: { stato: 'pagato', fino: fra(100) } }), [{ tono: 'verde', parola: 'In regola' }, { tono: 'spento', parola: 'Fuori app' }]],
  ]
  for (const [cosa, p, voluto] of casi) ok(`in elenco, ${cosa}: le parole di oggi`, inElenco(p), voluto)
  // In elenco la forma corta del timbro, se ne ha una (SCADUTO IL gg/mm → CERT. SCADUTO): stesso tono, stessa funzione.
  const bollino = (t) => (t ? { tono: t.tono, parola: t.inElenco ?? t.parola } : null)
  for (const [cosa, p] of casi.slice(0, 3)) {
    const t = timbri(p)
    const fuori = (inElenco(p) ?? []).filter((b) => !['In regola', 'Fuori app', 'Senza data'].includes(b.parola))
    const daiTimbri = [t?.certificato, t?.quota].filter((x) => x && x.tono !== 'verde').map(bollino)
    ok(`${cosa}: in elenco le stesse parole dei timbri`, inElenco(p) && t ? fuori : 'manca l’elenco o i timbri', daiTimbri)
  }
  // Il certificato in scadenza: la parola in elenco è quella del timbro, qualunque sia.
  const inScadenza = persona({ certificato: { scade: fra(10), conFile: false }, quote: [pagata] })
  ok('certificato in scadenza: in elenco la parola del timbro', inElenco(inScadenza), [bollino(timbri(inScadenza)?.certificato)])
  // In elenco la colonna è stretta: la data resta corta, senza l'anno.
  ok('certificato in scadenza: in elenco Scade il gg/mm', inElenco(inScadenza), [{ tono: 'giallo', parola: `Scade il ${corta(fra(10))}` }])
  ok('scade oggi: in elenco Scade oggi', inElenco(persona({ certificato: { scade: oggi, conFile: false }, quote: [pagata] })), [{ tono: 'giallo', parola: 'Scade oggi' }])
  // Solo l'elenco cambia parole: i timbri della scheda restano in maiuscolo, con la forma d'elenco accanto.
  const tp = timbri(persona())
  ok('scheda: NO CERTIFICATO e DA PAGARE restano maiuscoli, con la parola d\'elenco', [tp?.certificato.parola, tp?.certificato.inElenco, tp?.quota.parola, tp?.quota.inElenco], ['NO CERTIFICATO', 'Manca il certificato', 'DA PAGARE', 'Da pagare'])
  const tq = timbri(persona({ certificato: { scade: fra(100), conFile: false }, quote: [{ ...pagata, mancano: 2000 }] }))?.quota
  ok('scheda: IN PARTE resta maiuscolo, in elenco Pagata in parte', [tq?.parola, tq?.inElenco], ['IN PARTE', 'Pagata in parte'])
  const ts = timbri(persona({ quote: [{ ...pagata, dal: '2025-09-01', al: fra(-1) }] }))?.quota
  ok('scheda: QUOTA SCADUTA resta maiuscolo, in elenco Quota scaduta', [ts?.parola, ts?.inElenco], ['QUOTA SCADUTA', 'Quota scaduta'])
  ok('scheda: SCADE OGGI resta maiuscolo, in elenco Scade oggi', [cert(oggi)?.parola, cert(oggi)?.inElenco], ['SCADE OGGI', 'Scade oggi'])

  // «AL» o «ALL’»: come si legge il giorno. 1, 8 e 11 cominciano per vocale.
  const al = [['2027-07-31', 'AL 31/07/2027'], ['2027-07-01', 'ALL’1/07/2027'], ['2027-08-08', 'ALL’8/08/2027'], ['2027-07-11', 'ALL’11/07/2027'], ['2027-07-18', 'AL 18/07/2027'], ['2027-07-05', 'AL 05/07/2027']]
  for (const [g, voluto] of al) ok(`${g}: ${voluto}`, m.alGiorno?.(g), voluto)

  // 6. Il tasto pieno della scheda: uno solo, quello che c'è da fare per primo.
  const tasto = (altro) => (m.tastoPrincipale ? m.tastoPrincipale(persona(altro), oggi) : 'nessuna tastoPrincipale')
  const valido = { scade: fra(100), conFile: false }
  const certInScadenza = { scade: fra(10), conFile: false }
  const inParte = [{ ...pagata, mancano: 2000 }]
  const scaduta = [{ ...pagata, dal: '2025-09-01', al: fra(-1) }]
  ok('tasto: senza certificato e quota da pagare, prima il certificato', tasto({}), 'certificato')
  ok('tasto: certificato scaduto e quota pagata, il certificato', tasto({ certificato: { scade: fra(-1), conFile: false }, quote: [pagata] }), 'certificato')
  ok('tasto: certificato valido e quota scaduta, la quota', tasto({ certificato: valido, quote: scaduta }), 'quota')
  ok('tasto: certificato valido e quota da pagare, la quota', tasto({ certificato: valido }), 'quota')
  ok('tasto: certificato in scadenza e quota in parte, prima la quota', tasto({ certificato: certInScadenza, quote: inParte }), 'quota')
  ok('tasto: certificato in scadenza e quota pagata, il certificato', tasto({ certificato: certInScadenza, quote: [pagata] }), 'certificato')
  ok('tasto: tutto a posto, la quota (si apre per incassare)', tasto({ certificato: valido, quote: [pagata], documento: true }), 'quota')
  ok('tasto: disattivata con tutto rosso, nessuno', tasto({ attiva: false, certificato: { scade: fra(-1), conFile: false } }), null)
  ok('tasto: il documento mancante non cambia niente', [tasto({ certificato: valido, quote: [pagata], documento: false }), tasto({ certificato: certInScadenza, quote: [pagata], documento: false })], ['quota', 'certificato'])

  // E l'elenco non se le scrive da sé: Iscritti.tsx le prende da src/lib.
  const { readFileSync } = await import('node:fs')
  const tsx = readFileSync('src/components/segreteria/Iscritti.tsx', 'utf8')
  const ricopiate = ["'NO CERTIFICATO'", "'CERT. SCADUTO'", "'QUOTA SCADUTA'", 'const TONO_CERTIFICATO', 'const TONO_PAGA', 'const PAROLA_PAGA'].filter((x) => tsx.includes(x))
  ok('Iscritti.tsx non ha parole né toni suoi per IN REGOLA', ricopiate, [])
}

console.log('\nuna modifica non salvata: CORSI e ISTRUTTORI E ACCESSI chiedono prima di lasciarla')
{
  const cambiato = (corso, bozza, sala) => m.corsoCambiato?.(corso, bozza, sala)
  const persona = (salvata, modifica) => m.personaCambiata?.(salvata, modifica)
  const primo = m.COLORI[0].hex
  const X = { id: 'x', nome: 'Anna' }
  const Y = { id: 'y', nome: 'Bruno' }
  const corso = { id: 'c1', nome: 'Karate', colore: m.COLORI[1].hex, salaId: 's1', sala: 'Sala 1', istruttori: [X, Y], capienza: 20, attivo: true, ricorrenze: [] }
  // Come la costruisce Corsi.tsx: un corso salvato senza colore prende il primo.
  const bozzaDi = (c) => ({ id: c?.id, nome: c?.nome ?? '', salaId: c?.salaId, istruttori: c?.istruttori.map((i) => i.id) ?? [], capienza: c?.capienza, colore: c?.colore ?? primo })
  const b = bozzaDi(corso)

  ok('la bozza uguale al corso salvato non è una modifica', cambiato(corso, b), false)
  ok('il nome cambiato è una modifica', cambiato(corso, { ...b, nome: 'Karate bambini' }), true)
  ok('il nome con uno spazio in più non è una modifica', cambiato(corso, { ...b, nome: 'Karate ' }), false)
  ok('la sala cambiata è una modifica', cambiato(corso, { ...b, salaId: 's2' }), true)
  ok('«a lezione basta uno» spuntata è una modifica', cambiato(corso, { ...b, bastaUno: true }), true)
  ok('«basta uno» vuota su un corso che non ce l’ha non è una modifica', cambiato(corso, { ...b, bastaUno: false }), false)
  ok('i posti cambiati sono una modifica', cambiato(corso, { ...b, capienza: 25 }), true)
  ok('i posti tolti sono una modifica', cambiato(corso, { ...b, capienza: undefined }), true)
  ok('il colore cambiato è una modifica', cambiato(corso, { ...b, colore: m.COLORI[2].hex }), true)
  ok('gli istruttori scambiati di posto sono una modifica: il primo è quello di riferimento', cambiato(corso, { ...b, istruttori: ['y', 'x'] }), true)
  ok('gli stessi istruttori nello stesso ordine non sono una modifica', cambiato(corso, { ...b, istruttori: ['x', 'y'] }), false)
  // La tessera richiesta (61-tessere.sql): cambiare solo quella è una modifica, e non vuol dire lo stesso che non averla.
  const conTessera = { ...corso, enteTessera: 'FIJLKAM' }
  ok('la tessera richiesta cambiata è una modifica', cambiato(conTessera, { ...bozzaDi(conTessera), enteTessera: 'FIPE' }), true)
  ok('la tessera richiesta tolta (vuota) è una modifica', cambiato(conTessera, { ...bozzaDi(conTessera), enteTessera: '' }), true)
  ok('la tessera richiesta data a un corso che non l\'aveva è una modifica', cambiato(corso, { ...b, enteTessera: 'FIPE' }), true)
  ok('senza tessera, vuota o assente, non è una modifica', [cambiato(corso, { ...b, enteTessera: '' }), cambiato(corso, b)], [false, false])
  const Z = { id: 'z', nome: 'Carla' }
  ok('gli altri istruttori in un altro ordine non sono una modifica: il database tiene solo il primo', cambiato({ ...corso, istruttori: [X, Y, Z] }, { ...b, istruttori: ['x', 'z', 'y'] }), false)
  ok('un istruttore tolto è una modifica', cambiato(corso, { ...b, istruttori: ['x'] }), true)
  const senzaColore = { ...corso, colore: undefined }
  ok('un corso salvato senza colore, aperto col primo colore, non è una modifica', cambiato(senzaColore, bozzaDi(senzaColore)), false)

  const nuovo = { ...bozzaDi(null), salaId: 's1' }
  ok('un corso nuovo appena aperto, con la prima sala, non è una modifica', cambiato(null, nuovo, 's1'), false)
  ok('un corso nuovo con un nome è una modifica', cambiato(null, { ...nuovo, nome: 'Judo' }, 's1'), true)
  ok('un corso nuovo con un istruttore è una modifica', cambiato(null, { ...nuovo, istruttori: ['x'] }, 's1'), true)
  ok('un corso nuovo con i posti è una modifica', cambiato(null, { ...nuovo, capienza: 10 }, 's1'), true)
  ok('un corso nuovo con un altro colore è una modifica', cambiato(null, { ...nuovo, colore: m.COLORI[3].hex }, 's1'), true)
  ok('un corso nuovo con un’altra sala è una modifica', cambiato(null, { ...nuovo, salaId: 's2' }, 's1'), true)

  const salvata = { nome: 'Anna', cognome: 'Neri', email: 'anna@esempio.it' }
  const mod = { nome: 'Anna', cognome: 'Neri', email: 'anna@esempio.it' }
  ok('la scheda aperta e non toccata non è una modifica', persona(salvata, mod), false)
  ok('l’email cambiata è una modifica', persona(salvata, { ...mod, email: 'anna.neri@esempio.it' }), true)
  ok('l’email con uno spazio in più non è una modifica', persona(salvata, { ...mod, email: ' anna@esempio.it ' }), false)
  ok('senza email salvata, il campo vuoto non è una modifica', persona({ nome: 'Anna', cognome: 'Neri' }, { ...mod, email: '' }), false)
  ok('senza email salvata, un’email scritta è una modifica', persona({ nome: 'Anna', cognome: 'Neri' }, mod), true)
  ok('il nome cambiato è una modifica', persona(salvata, { ...mod, nome: 'Annalisa' }), true)
  ok('il cognome cambiato è una modifica', persona(salvata, { ...mod, cognome: 'Bianchi' }), true)

  // Il giorno nuovo (+ AGGIUNGI UN GIORNO) si apre coi valori del primo giorno del corso.
  const ricCorso = { ...corso, ricorrenze: [{ id: 'r1', giorno: 3, ora: '18:30', durata: 90 }] }
  const ric = m.ricorrenzaIniziale?.(ricCorso)
  ok('il giorno nuovo parte dall’ora e dai minuti del primo giorno', ric, { giorno: 1, ora: '18:30', durata: 90 })
  ok('senza giorni, il giorno nuovo parte da lunedì alle 17:00 per un’ora', m.ricorrenzaIniziale?.(corso), { giorno: 1, ora: '17:00', durata: 60 })
  const ricCambiata = (r) => m.ricorrenzaCambiata?.(ricCorso, r)
  ok('il giorno nuovo appena aperto non è una modifica', ricCambiata(ric), false)
  ok('il giorno nuovo con un altro giorno è una modifica', ricCambiata({ ...ric, giorno: 2 }), true)
  ok('il giorno nuovo con un’altra ora è una modifica', ricCambiata({ ...ric, ora: '19:00' }), true)
  ok('il giorno nuovo con altri minuti è una modifica', ricCambiata({ ...ric, durata: 60 }), true)
  ok('il giorno nuovo con una sala scelta è una modifica', ricCambiata({ ...ric, salaId: 's2' }), true)

  // La domanda la fa `lasciare` in comune.tsx; la vecchia «LASCIALO A METÀ» non c'è più.
  const { readFileSync, readdirSync } = await import('node:fs')
  const vecchie = readdirSync('src', { recursive: true })
    .filter((f) => /\.(tsx?|css)$/.test(f))
    .filter((f) => readFileSync(`src/${f}`, 'utf8').includes('LASCIALO A METÀ'))
  ok('«LASCIALO A METÀ» non compare più in src/', vecchie, [])
  const comune = readFileSync('src/components/segreteria/comune.tsx', 'utf8')
  const corpo = comune.slice(comune.indexOf('export function lasciare'), comune.indexOf('\n}\n', comune.indexOf('export function lasciare')))
  ok('lasciare: il tasto in evidenza è restare', corpo.includes('restare: true'), true)
  ok('lasciare: dice che uscendo si perde', corpo.includes('Se esci si perdono'), true)
  ok('lasciare: il tasto per uscire è «Esci senza salvare»', corpo.includes('Esci senza salvare'), true)
}

console.log('\nuna modifica non salvata: CHI FA LE RICEVUTE e il LISTINO chiedono solo se è cambiato qualcosa')
{
  const ente = { nome: 'Asd Il Centro Judo', indirizzo: 'Corso Francia 224', cap: '10098', comune: 'Rivoli', codiceFiscale: '10002760014', dicitura: 'Esente da bollo' }
  const cambiato = (b) => m.enteCambiato?.(ente, b)
  ok('chi fa le ricevute, non toccato: non è una modifica', cambiato({ ...ente }), false)
  ok('chi fa le ricevute, il comune cambiato: è una modifica', cambiato({ ...ente, comune: 'Torino' }), true)
  ok('chi fa le ricevute, rimesso com’era: non è una modifica', cambiato({ ...ente, comune: 'Rivoli' }), false)
  ok('chi fa le ricevute, rimesso com’era con spazi in più: non è una modifica', cambiato({ ...ente, nome: ' Asd Il Centro Judo ', dicitura: 'Esente da bollo\n' }), false)
  ok('chi fa le ricevute, la partita IVA scritta: è una modifica', cambiato({ ...ente, partitaIva: '01234567890' }), true)
  ok('chi fa le ricevute, la partita IVA vuota dove non c’era: non è una modifica', cambiato({ ...ente, partitaIva: ' ' }), false)
  ok('chi fa le ricevute, la partita IVA tolta: è una modifica', m.enteCambiato?.({ ...ente, partitaIva: '01234567890' }, { ...ente, partitaIva: '' }), true)
  ok('chi fa le ricevute, il numero RASD scritto: è una modifica', cambiato({ ...ente, rasd: '12345' }), true)
  ok('chi fa le ricevute, il numero RASD vuoto dove non c’era: non è una modifica', cambiato({ ...ente, rasd: ' ' }), false)

  // Il numero RASD è un dato dell'associazione, come la partita IVA: ha il suo campo in IMPOSTAZIONI.
  const formEnte = readFileSync('src/components/segreteria/Ricevute.tsx', 'utf8')
  ok('chi fa le ricevute: il form ha il campo del numero RASD', formEnte.includes("campo('rasd',"), true)
  const prova = m.creaSegreteriaProva()
  await prova.salvaEnteRicevute({ ...ente, rasd: '12345' })
  ok('chi fa le ricevute: il numero RASD salvato si rilegge', (await prova.enteRicevute()).rasd, '12345')

  const voce = { corso: 'Judo', eta: '6-10', orari: ['lun 17:00'], prezzi: [{ saldo: 400, annuale: 480 }] }
  const listino = { quota: 30, saldoEntro: '2026-10-31', corsi: [voce, { ...voce, corso: 'Karate' }], offerte: [{ titolo: 'FAMIGLIA', testo: 'sconto' }] }
  const lc = (b) => m.listinoCambiato?.(listino, b)
  ok('listino non toccato: non è una modifica', lc(structuredClone(listino)), false)
  ok('listino con la quota cambiata: è una modifica', lc({ ...listino, quota: 35 }), true)
  ok('listino con i campi in un altro ordine: non è una modifica', lc({ offerte: listino.offerte, corsi: listino.corsi.map((c) => ({ prezzi: c.prezzi, orari: c.orari, eta: c.eta, corso: c.corso })), saldoEntro: listino.saldoEntro, quota: 30 }), false)
  ok('listino con i corsi scambiati di posto: è una modifica', lc({ ...listino, corsi: [listino.corsi[1], listino.corsi[0]] }), true)
  ok('listino con un prezzo che non si capisce: è una modifica', lc('Un prezzo di «Judo» non si capisce: «4x»'), true)
  ok('listino con i corsi senza prezzo in un altro ordine: non è una modifica', m.listinoCambiato?.({ ...listino, senzaPrezzoVaBene: ['a', 'b'] }, { ...listino, senzaPrezzoVaBene: ['b', 'a'] }), false)
}

console.log('\nil LISTINO, BUTTA I CAMBI: la domanda dice cosa si butta')
{
  // La bozza com'è scritta nel LISTINO: testo, anche quando non si capisce.
  const corso = (chiave, nome, prezzo = '320') => ({ chiave, corso: nome, corsoId: `c${chiave}`, eta: '', natiDal: '', natiAl: '', orari: 'lun 17:00', notaTrimestre: '', nota: '', prezzi: [{ etichetta: '', saldo: prezzo, annuale: '400', trimestre: '' }] })
  const salvata = {
    quota: '20',
    saldoEntro: '2026-10-31',
    corsi: [corso(1, 'Judo 1'), corso(2, 'Judo 2'), corso(3, 'Aikido')],
    offerte: [{ chiave: 1, titolo: 'FAMIGLIA', testo: 'sconto' }],
    senzaPrezzoVaBene: ['a', 'b'],
  }
  const conCorso = (chiave, x) => ({ ...salvata, corsi: salvata.corsi.map((c) => (c.chiave === chiave ? { ...c, ...x } : c)) })
  const cambi = (b) => m.cambiNellaBozza(salvata, b)
  ok('bozza uguale: niente da buttare', cambi(structuredClone(salvata)), [])
  ok('quota 20 → 25: la quota', cambi({ ...salvata, quota: '25' }), ['la quota'])
  ok('quota 20 → « 20 »: niente da buttare', cambi({ ...salvata, quota: ' 20 ' }), [])
  ok('data del saldo cambiata: la data del saldo', cambi({ ...salvata, saldoEntro: '2026-11-30' }), ['la data del saldo'])
  ok('un prezzo cambiato in «Judo 2»: «Judo 2»', cambi(conCorso(2, { prezzi: [{ etichetta: '', saldo: '330', annuale: '400', trimestre: '' }] })), ['«Judo 2»'])
  ok('un prezzo che non si capisce in «Judo 2»: «Judo 2»', cambi(conCorso(2, { prezzi: [{ etichetta: '', saldo: '32o', annuale: '400', trimestre: '' }] })), ['«Judo 2»'])
  ok('un corso nuovo senza nome: «un corso senza nome» (nuovo)', cambi({ ...salvata, corsi: [...salvata.corsi, corso(4, '')] }), ['«un corso senza nome» (nuovo)'])
  ok('un corso nuovo «Lotta 5»: «Lotta 5» (nuovo)', cambi({ ...salvata, corsi: [...salvata.corsi, corso(4, 'Lotta 5')] }), ['«Lotta 5» (nuovo)'])
  ok('«Aikido» tolto: «Aikido» (tolto)', cambi({ ...salvata, corsi: salvata.corsi.slice(0, 2) }), ['«Aikido» (tolto)'])
  ok('due corsi scambiati di posto: l’ordine dei corsi', cambi({ ...salvata, corsi: [salvata.corsi[1], salvata.corsi[0], salvata.corsi[2]] }), ['l’ordine dei corsi'])
  ok('un’offerta col testo cambiato: le offerte', cambi({ ...salvata, offerte: [{ chiave: 1, titolo: 'FAMIGLIA', testo: 'sconto del 10%' }] }), ['le offerte'])
  ok('corsi senza prezzo a,b → b,a: niente da buttare', cambi({ ...salvata, senzaPrezzoVaBene: ['b', 'a'] }), [])
  ok('corsi senza prezzo a → a,c: i corsi senza prezzo', m.cambiNellaBozza({ ...salvata, senzaPrezzoVaBene: ['a'] }, { ...salvata, senzaPrezzoVaBene: ['a', 'c'] }), ['i corsi senza prezzo'])
  ok(
    'quota, «Judo 2» cambiato e «Aikido» tolto: in quest’ordine',
    cambi({ ...salvata, quota: '25', corsi: [salvata.corsi[0], { ...salvata.corsi[1], nota: 'solo il sabato' }] }),
    ['la quota', '«Judo 2»', '«Aikido» (tolto)'],
  )
  // Prima quel che vale per tutto il listino, poi i corsi.
  ok(
    'quota, offerte e «Judo 2» cambiato: prima il listino, poi i corsi',
    cambi({ ...conCorso(2, { nota: 'solo il sabato' }), quota: '25', offerte: [{ chiave: 1, titolo: 'FAMIGLIA', testo: 'sconto del 10%' }] }),
    ['la quota', 'le offerte', '«Judo 2»'],
  )
  ok(
    'tutto cambiato: quota, data del saldo, ordine, offerte, senza prezzo, poi i corsi',
    cambi({
      quota: '25',
      saldoEntro: '2026-11-30',
      corsi: [salvata.corsi[1], { ...salvata.corsi[0], nota: 'nuova' }, corso(4, 'Lotta 5')],
      offerte: [],
      senzaPrezzoVaBene: ['a'],
    }),
    ['la quota', 'la data del saldo', 'l’ordine dei corsi', 'le offerte', 'i corsi senza prezzo', '«Judo 1»', '«Lotta 5» (nuovo)', '«Aikido» (tolto)'],
  )

  // La domanda di BUTTA I CAMBI: le prime sei voci, il resto contato.
  const domanda = (c) => m.domandaButta(c)
  const coda = 'Il listino torna com’è salvato, quello che vede la pagina di iscrizione.'
  ok('domanda senza cambi elencati', domanda([]), `Buttare i cambi al listino? ${coda}`)
  ok('domanda con la quota', domanda(['la quota']), `Buttare i cambi al listino? Hai cambiato: la quota. ${coda}`)
  ok('domanda con 7 cambi: le prime sei e un altro cambio', domanda(['a', 'b', 'c', 'd', 'e', 'f', 'g']), `Buttare i cambi al listino? Hai cambiato: a, b, c, d, e, f e un altro cambio. ${coda}`)
  ok('domanda con 8 cambi: le prime sei e altri 2 cambi', domanda(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']), `Buttare i cambi al listino? Hai cambiato: a, b, c, d, e, f e altri 2 cambi. ${coda}`)

  const { readFileSync } = await import('node:fs')
  const tsx = readFileSync('src/components/segreteria/Listino.tsx', 'utf8')
  ok('LISTINO: il tasto LASCIA STARE non c’è più', tsx.includes('LASCIA STARE'), false)
  ok('LISTINO: il tasto si chiama «Butta i cambi»', tsx.includes('Butta i cambi'), true)
  ok('LISTINO: «Butta i cambi» è un tasto di pericolo, come «Rimetti»', tsx.includes("'Butta i cambi', { pericolo: true }"), true)
  ok('LISTINO: la domanda la compone domandaButta', tsx.includes('domandaButta'), true)
  ok('LISTINO: dopo, dice «Listino tornato com’è salvato»', tsx.includes('Listino tornato com’è salvato'), true)
  ok('LISTINO: la domanda dice cosa si butta con cambiNellaBozza', tsx.includes('cambiNellaBozza'), true)
}

console.log('\npossibili doppioni')
{
  const scheda = (id, nome, cognome, altro = {}) => ({ id, nome, cognome, attiva: true, creataIl: '2026-09-26', iscrizioni: [], certificato: { conFile: false }, documento: false, pagamento: { stato: 'da_pagare' }, ...altro })
  // Le coppie come «id-id», ognuna con gli id in ordine: chi viene prima nella coppia non conta, l'ordine delle coppie sì.
  const coppie = (tutte, indizi = {}) =>
    typeof m.coppieDoppioni !== 'function'
      ? 'coppieDoppioni non c\'è'
      : m.coppieDoppioni(tutte, { codiciFiscali: {}, nascite: {}, nonDoppioni: [], ...indizi }).map((c) => c.map((p) => p.id).sort().join('-'))

  ok("«Luca D'Amico» e «luca damico»: in coppia", coppie([scheda('1', 'Luca', "D'Amico"), scheda('2', 'luca', 'damico')]), ['1-2'])
  ok('nomi diversi e lo stesso codice fiscale, scritto in un altro modo: in coppia',
    coppie([scheda('1', 'Anna', 'Rossi'), scheda('2', 'Anna Maria', 'Rossi')], { codiciFiscali: { 1: 'RSSNNA80A41L219X', 2: 'rssnna 80a41 l219x' } }), ['1-2'])
  const due = [scheda('1', 'Sara', 'Bianchi'), scheda('2', 'Sara', 'Bianchi')]
  ok('stesso nome, due codici fiscali diversi: no', coppie(due, { codiciFiscali: { 1: 'BNCSRA10A41L219X', 2: 'BNCSRA12B41L219Y' } }), [])
  ok('stesso nome, un codice fiscale solo: in coppia', coppie(due, { codiciFiscali: { 1: 'BNCSRA10A41L219X' } }), ['1-2'])
  ok('stesso nome, due nascite diverse: no', coppie(due, { nascite: { 1: '2010-01-01', 2: '2012-02-01' } }), [])
  ok('stesso nome, una nascita sola: in coppia', coppie(due, { nascite: { 2: '2012-02-01' } }), ['1-2'])
  ok('stesso codice fiscale ma due nascite diverse: no',
    coppie(due, { codiciFiscali: { 1: 'BNCSRA10A41L219X', 2: 'BNCSRA10A41L219X' }, nascite: { 1: '2010-01-01', 2: '2012-02-01' } }), [])
  ok('fratelli, stesso telefono e nomi diversi: no',
    coppie([scheda('1', 'Luca', 'Neri', { telefono: '333 1234567' }), scheda('2', 'Marco', 'Neri', { telefono: '333 1234567' })]), [])
  ok('una scheda disattivata conta', coppie([scheda('1', 'Ugo', 'Blu'), scheda('2', 'Ugo', 'Blu', { attiva: false })]), ['1-2'])
  ok('una coppia segnata «non sono doppioni»: no', coppie(due, { nonDoppioni: [['1', '2']] }), [])
  ok('anche segnata nell\'altro ordine', coppie(due, { nonDoppioni: [['2', '1']] }), [])
  ok('tre schede uguali: tre coppie',
    coppie([scheda('1', 'Teo', 'Neri'), scheda('2', 'Teo', 'Neri'), scheda('3', 'Teo', 'Neri')]).toSorted?.() ?? 'coppieDoppioni non c\'è', ['1-2', '1-3', '2-3'])
  const tre = [scheda('1', 'Teo', 'Neri'), scheda('2', 'Teo', 'Neri'), scheda('3', 'Teo', 'Neri'), scheda('4', 'Ada', 'Neri'), scheda('5', 'ada', 'neri')]
  const leCoppie = typeof m.coppieDoppioni === 'function' ? m.coppieDoppioni(tre, { codiciFiscali: {}, nascite: {}, nonDoppioni: [] }) : []
  ok('l\'altra della coppia, se è una sola', typeof m.altraDellaCoppia === 'function' ? [m.altraDellaCoppia(leCoppie, '4'), m.altraDellaCoppia(leCoppie, '1'), m.altraDellaCoppia(leCoppie, '9')] : 'altraDellaCoppia non c\'è', ['5', undefined, undefined])
  ok('ogni coppia una volta, per cognome e nome',
    coppie([scheda('1', 'Sara', 'Bianchi'), scheda('2', 'Zeno', 'Abate'), scheda('3', 'Sara', 'Bianchi'), scheda('4', 'zeno', 'abate'), scheda('5', 'Aldo', 'Bianchi'), scheda('6', 'Aldo', 'Bianchi')]),
    ['2-4', '5-6', '1-3'])

  // La segreteria di prova: codice fiscale e nascita dall'anagrafica, se no dalla richiesta accolta più recente.
  const RICHIESTE = 'ods-corsi:prova-richieste'
  const aggiungiRichiesta = (r) => localStorage.setItem(RICHIESTE, JSON.stringify([...JSON.parse(localStorage.getItem(RICHIESTE) ?? '[]'), r]))
  const richiesta = (id, personaId, codiceFiscale, natoIl, gestitaIl) => ({
    id, creataIl: '2026-08-01T10:00:00.000Z', gestitaIl, stato: 'accolta', personaId,
    nome: 'Pia', cognome: 'Fumagalli', natoIl, natoA: 'Torino', codiceFiscale, indirizzo: 'via Po 2', cap: '10093', comune: 'Collegno',
    email: 'pia@esempio.it', telefono: '3337654321', corsi: ['judo-2'], formula: 'annuale',
  })
  const pia1 = await s.salvaPersona({ nome: 'Pia', cognome: 'Fumagalli' })
  const pia2 = await s.salvaPersona({ nome: 'Pia', cognome: 'Fumagalli' })
  await s.salvaAnagrafica(pia1, { codiceFiscale: 'FMGPIA10A41L219X' })
  aggiungiRichiesta(richiesta('r-pia1', pia1, 'FMGPIA99A41L219Z', '2010-01-01', '2026-08-02T10:00:00.000Z'))
  aggiungiRichiesta(richiesta('r-pia2-vecchia', pia2, 'FMGPIA11A41L219X', '2011-01-01', '2026-08-02T10:00:00.000Z'))
  aggiungiRichiesta(richiesta('r-pia2', pia2, 'FMGPIA12B41L219Y', '2012-02-01', '2026-09-02T10:00:00.000Z'))
  const indizi = typeof s.indiziDoppioni === 'function' ? await s.indiziDoppioni() : null
  ok('il codice fiscale dall\'anagrafica della segreteria', indizi?.codiciFiscali?.[pia1], 'FMGPIA10A41L219X')
  ok('la nascita, che l\'anagrafica non ha, dalla richiesta accolta', indizi?.nascite?.[pia1], '2010-01-01')
  ok('senza anagrafica, dalla richiesta accolta più recente', [indizi?.codiciFiscali?.[pia2], indizi?.nascite?.[pia2]], ['FMGPIA12B41L219Y', '2012-02-01'])

  const lia1 = await s.salvaPersona({ nome: 'Lia', cognome: 'Fumagalli' })
  const lia2 = await s.salvaPersona({ nome: 'Lia', cognome: 'Fumagalli' })
  const stessa = ([x, y]) => [x, y].sort().join() === [lia1, lia2].sort().join()
  const prima = typeof s.indiziDoppioni === 'function' && typeof m.coppieDoppioni === 'function'
    ? m.coppieDoppioni(await s.persone(), await s.indiziDoppioni()).filter((c) => stessa(c.map((p) => p.id))).length : 'non c\'è'
  ok('prima di segnarle, le due Lia sono una coppia', prima, 1)
  ok('«non sono doppioni»', await errore(() => s.segnaNonDoppioni(lia2, lia1)), 'nessun errore')
  ok('segnate due volte', await errore(() => s.segnaNonDoppioni(lia1, lia2)), 'nessun errore')
  const dopo = typeof s.indiziDoppioni === 'function' ? await s.indiziDoppioni() : null
  ok('la coppia è fra le «non sono doppioni», una volta', (dopo?.nonDoppioni ?? []).filter(stessa).length, 1)
  ok('e non è più una coppia',
    typeof m.coppieDoppioni === 'function' && dopo ? m.coppieDoppioni(await s.persone(), dopo).filter((c) => stessa(c.map((p) => p.id))).length : 'non c\'è', 0)
  ok('una scheda con sé stessa no', await errore(() => s.segnaNonDoppioni(lia1, lia1)), 'Scegli due schede diverse')

  // Unendo due schede le coppie passano a chi resta, come in 33-non-doppioni.sql:
  // una con sé stessa, o una che c'è già, se ne va con la scheda.
  const [u1, u2, u3] = [await s.salvaPersona({ nome: 'Ugo', cognome: 'Verdi' }), await s.salvaPersona({ nome: 'Ugo', cognome: 'Verdi' }), await s.salvaPersona({ nome: 'Ugo', cognome: 'Verdi' })]
  await errore(() => s.segnaNonDoppioni(u1, u3))
  await errore(() => s.segnaNonDoppioni(u2, u3))
  await errore(() => s.segnaNonDoppioni(u1, u2))
  ok('unite due schede con coppie «non sono doppioni»', await errore(() => s.unisciPersone(u1, u2)), 'nessun errore')
  const diUgo = typeof s.indiziDoppioni === 'function' ? (await s.indiziDoppioni()).nonDoppioni.filter((c) => c.includes(u1) || c.includes(u2)) : 'non c\'è'
  ok('resta una coppia: chi resta e l\'omonimo', Array.isArray(diUgo) ? diUgo.map((c) => [...c].sort().join()) : diUgo, [[u1, u3].sort().join()])

  // Col database senza 33-non-doppioni.sql: la tabella non c'è.
  const risposta = (t) =>
    t === 'non_doppioni'
      ? { data: null, error: { code: 'PGRST205', message: "Could not find the table 'public.non_doppioni' in the schema cache" } }
      : { data: [], error: null }
  // Una richiesta finta: ogni metodo la rilancia, e attesa dà la risposta della tabella.
  const richiestaFinta = (t) => {
    const q = new Proxy(() => q, {
      get: (_, k) => (k === 'range' ? (da) => (da ? oltre : q) : k === 'then' ? (ok, ko) => Promise.resolve(risposta(t)).then(ok, ko) : () => q),
      apply: () => q,
    })
    return q
  }
  const senza = m.creaSegreteriaSupabase({
    from: (t) => richiestaFinta(t),
    rpc: async (f) => ({ data: null, error: { code: 'PGRST202', message: `Could not find the function public.${f} in the schema cache` } }),
  })
  ok('senza il file sul database, i possibili doppioni si vedono lo stesso', await errore(async () => {
    const i = await senza.indiziDoppioni()
    if (i.nonDoppioni.length) throw new Error(`nonDoppioni: ${JSON.stringify(i.nonDoppioni)}`)
  }), 'nessun errore')
  const manca = await errore(() => senza.segnaNonDoppioni(lia1, lia2))
  ok('ma «non sono doppioni» dice quale file lanciare', manca.includes('33-non-doppioni.sql') ? '33-non-doppioni.sql' : manca, '33-non-doppioni.sql')
}

console.log('\ninizio e fine dei corsi: le lezioni da ricorrenza stanno dentro')
{
  // Come il trigger `sessione_in_stagione` (12-calendario-da-se.sql): fuori
  // dalle date dei corsi una lezione da ricorrenza non nasce; le straordinarie
  // sì, e quelle già toccate (appello, cambi, istruttori, prove) restano.
  const fra = (da, a = da) => m.lezioniFra(new Date(2026, da[0], da[1]), new Date(2026, a[0], a[1]))
  const ordinarie = (da, a) => fra(da, a).filter((l) => !l.straordinaria)
  const passate = fra([8, 14], [8, 25]).length
  const ottobre15 = ordinarie([9, 15])
  const [lun20] = ordinarie([9, 20])
  await s.straordinaria('judo-2', new Date(2026, 9, 20, 20, 0), 60)
  const [extra20] = fra([9, 20]).filter((l) => l.straordinaria)

  // Le lezioni del 15 ottobre toccate prima di chiudere i corsi il 10.
  // Quella con la presenza dell'istruttore deve avere un istruttore previsto.
  const coninsegnante = ottobre15.find((l) => l.corso.istruttori.length)
  const [segnata, annullata, sostituita, spostata, conprova, ...intatte] = ottobre15.filter((l) => l !== coninsegnante)
  m.memoria.segnate = { ...m.memoria.segnate, [segnata.id]: { 'p-qualcuno': 'presente' } }
  await s.aggiornaLezione(annullata.id, { stato: 'annullata' })
  await s.aggiornaLezione(sostituita.id, { sostitutoId: 'i-fabio' })
  await s.aggiornaLezione(spostata.id, { salaId: spostata.corso.sala === 'Tatami' ? 'Pesi' : 'Tatami' })
  m.segnaIstruttoriLezioneProva(coninsegnante.id, coninsegnante.corso.istruttori.slice(0, 1), 's-prova')
  // La prova segna anche presente: si toglie il segno, così conta la sola prova.
  await app.aggiungiProva(conprova.id, { nome: 'Pia', cognome: 'Provetta', telefono: '333 000 1111' })
  m.memoria.segnate = { ...m.memoria.segnate, [conprova.id]: {} }

  await s.salvaImpostazioni({ fineCorsi: '2026-10-10' })
  ok('con la fine il 10 ottobre, dopo il 10 nessuna lezione da ricorrenza non toccata', ordinarie([9, 11], [9, 31]).filter((l) => ![segnata, annullata, sostituita, spostata, coninsegnante, conprova].some((x) => x.id === l.id)).length, 0)
  ok('fino al 10 ottobre le lezioni ci sono', ordinarie([9, 1], [9, 10]).length > 0, true)
  ok('la straordinaria del 20 ottobre resta', fra([9, 20]).some((l) => l.id === extra20.id), true)
  ok('una lezione del 20 ottobre si trova ancora per id', m.trovaLezione(lun20.id) !== null, true)
  const resta = (l) => fra([9, 15]).some((x) => x.id === l.id)
  ok('il 15 ottobre resta quella con l\'appello', resta(segnata), true)
  ok('resta quella annullata', resta(annullata), true)
  ok('resta quella col sostituto', resta(sostituita), true)
  ok('resta quella spostata di sala', resta(spostata), true)
  ok('resta quella con la presenza dell\'istruttore', resta(coninsegnante), true)
  ok('resta quella con una prova', resta(conprova), true)
  ok('le altre del 15 ottobre no', [intatte.length > 0, intatte.filter(resta).length], [true, 0])
  ok('con la fine il 20 dicembre il calendario è pronto fino al 20 dicembre', (await s.salvaImpostazioni({ fineCorsi: '2026-12-20' }), await s.prontoFino()), '2026-12-20')

  await s.salvaImpostazioni({ fineCorsi: null })
  ok('senza fine il calendario è pronto fino a fine stagione', await s.prontoFino(), '2027-06-30')
  ok('tolta la fine, a novembre le lezioni tornano', ordinarie([10, 1], [10, 7]).length > 0, true)

  await s.salvaImpostazioni({ inizioCorsi: '2026-10-05' })
  // Le prove di prima hanno già toccato qualche lezione di questa settimana: quelle restano.
  const a = m.archivio.dati
  const toccata = (l) => Object.keys(m.memoria.segnate[l.id] ?? {}).length > 0 || !!a.lezioni[l.id] || (a.presenzeIstruttori ?? []).some((x) => x.sessioneId === l.id) || (a.prove ?? []).some((x) => x.sessioneId === l.id)
  ok('con l\'inizio il 5 ottobre, la settimana prima niente lezioni da ricorrenza non toccate', ordinarie([8, 28], [9, 4]).filter((l) => !toccata(l)).length, 0)
  ok('dal 5 ottobre sì', ordinarie([9, 5], [9, 11]).length > 0, true)
  ok('il passato prima di oggi non cambia', fra([8, 14], [8, 25]).length, passate)

  await s.salvaImpostazioni({ inizioCorsi: null, fineCorsi: null })
}

console.log('\nle date dei corsi valgono da quando si scrivono, non da oggi')
{
  // Sul database una lezione scartata dal trigger non nasce più: passato il
  // giorno, non torna perché è diventata «passata».
  const a = m.archivio.dati
  const toccata = (l) => Object.keys(m.memoria.segnate[l.id] ?? {}).length > 0 || !!a.lezioni[l.id] || (a.presenzeIstruttori ?? []).some((x) => x.sessioneId === l.id) || (a.prove ?? []).some((x) => x.sessioneId === l.id)
  const fra = (da, b = da) => m.lezioniFra(new Date(2026, da[0], da[1]), new Date(2026, b[0], b[1]))
  const nonToccate = (da, b) => fra(da, b).filter((l) => !l.straordinaria && !toccata(l))
  ok('di partenza il 15 ottobre ha lezioni non toccate', nonToccate([9, 15]).length > 0, true)
  await s.salvaImpostazioni({ fineCorsi: '2026-10-10' })
  ok('scritta la fine il 26 settembre, il 15 ottobre non ne ha', nonToccate([9, 15]).length, 0)
  OGGI = new Date(2026, 9, 20, 12, 0).getTime()
  ok('arrivati al 20 ottobre, le lezioni del 15 non ricompaiono', nonToccate([9, 15]).length, 0)
  OGGI = new Date(2026, 8, 26, 12, 0).getTime()
  await s.salvaImpostazioni({ inizioCorsi: null, fineCorsi: null })

  // Il giorno è quello della prima volta: riscrivere la fine non lo sposta.
  await s.salvaImpostazioni({ fineCorsi: '2026-10-10' })
  OGGI = new Date(2026, 9, 20, 12, 0).getTime()
  await s.salvaImpostazioni({ fineCorsi: '2026-10-12' })
  ok('riscritta la fine il 20 ottobre, le lezioni del 15 non tornano', nonToccate([9, 15]).length, 0)
  OGGI = new Date(2026, 8, 26, 12, 0).getTime()
  await s.salvaImpostazioni({ inizioCorsi: null, fineCorsi: null })

  // Tolte entrambe, si riparte: riscritte il 20 ottobre, il 15 era già passato.
  await s.salvaImpostazioni({ fineCorsi: '2026-10-10' })
  await s.salvaImpostazioni({ inizioCorsi: null, fineCorsi: null })
  OGGI = new Date(2026, 9, 20, 12, 0).getTime()
  await s.salvaImpostazioni({ fineCorsi: '2026-10-10' })
  ok('tolte le date e riscritte il 20 ottobre, le lezioni del 15 ci sono', nonToccate([9, 15]).length > 0, true)
  OGGI = new Date(2026, 8, 26, 12, 0).getTime()
  await s.salvaImpostazioni({ inizioCorsi: null, fineCorsi: null })

  // Una straordinaria prima dell'inizio dei corsi è decisa a mano: resta.
  await s.straordinaria('judo-2', new Date(2026, 9, 2, 20, 0), 60)
  const [extra] = fra([9, 2]).filter((l) => l.straordinaria && l.corso.id === 'judo-2')
  await s.salvaImpostazioni({ inizioCorsi: '2026-10-05' })
  ok('la straordinaria prima dell\'inizio dei corsi resta', fra([9, 2]).some((l) => l.id === extra.id), true)
  await s.salvaImpostazioni({ inizioCorsi: null, fineCorsi: null })
}

console.log('\nuna lezione toccata e rimessa com\'era resta, e quelle di oggi pure')
{
  // Sul database la lezione toccata è una riga: rimessa com'era, la riga resta.
  const a = m.archivio.dati
  const toccata = (l) => Object.keys(m.memoria.segnate[l.id] ?? {}).length > 0 || !!a.lezioni[l.id] || (a.presenzeIstruttori ?? []).some((x) => x.sessioneId === l.id) || (a.prove ?? []).some((x) => x.sessioneId === l.id)
  const fra = (da, b = da) => m.lezioniFra(new Date(2026, da[0], da[1]), new Date(2026, b[0], b[1]))
  const pulite = (g) => fra(g).filter((l) => !l.straordinaria && !toccata(l))
  const c = pulite([9, 22])
  const istruttori = await s.istruttori()
  const [annullata, sostituita, segnata, provata] = [c[0], c.find((l) => istruttori.some((i) => !l.corso.istruttori.includes(i.id)) && l !== c[0]), c[2], c[3]]
  const [rimessaDopo] = pulite([9, 29])
  ok('il 22 ottobre ha quattro lezioni intatte, diverse', new Set([annullata, sostituita, segnata, provata].map((l) => l?.id)).size, 4)

  const prese = []
  await s.aggiornaLezione(annullata.id, { stato: 'annullata' })
  prese.push(toccata(annullata))
  await s.aggiornaLezione(annullata.id, { stato: 'prevista' })
  // Come la settimana della segreteria: «Come da corso» manda null.
  await s.aggiornaLezione(sostituita.id, { sostitutoId: istruttori.find((i) => !sostituita.corso.istruttori.includes(i.id)).id })
  prese.push(toccata(sostituita))
  await s.aggiornaLezione(sostituita.id, { sostitutoId: null })
  const chi = (await app.dettaglio(segnata.id)).elenco[0].id
  await app.segna(segnata.id, chi, 'presente')
  prese.push(toccata(segnata))
  await app.segna(segnata.id, chi, null)
  const rita = await app.aggiungiProva(provata.id, { nome: 'Rita', cognome: 'Ripensata', telefono: '333 000 2222' })
  prese.push(toccata(provata))
  await app.togliProva(provata.id, rita.id)
  ok('ogni cambio aveva preso, prima di essere tolto', prese, [true, true, true, true])
  // Annullata prima della fine, rimessa prevista dopo.
  await s.aggiornaLezione(rimessaDopo.id, { stato: 'annullata' })

  await s.salvaImpostazioni({ fineCorsi: '2026-10-10' })
  await s.aggiornaLezione(rimessaDopo.id, { stato: 'prevista' })
  const resta = (l, g) => fra(g).some((x) => x.id === l.id)
  ok('annullata e poi rimessa prevista, resta', resta(annullata, [9, 22]), true)
  ok('col sostituto e poi «come da corso», resta', resta(sostituita, [9, 22]), true)
  ok('una presenza segnata e poi tolta, resta', resta(segnata, [9, 22]), true)
  ok('una prova aggiunta e poi tolta, resta', resta(provata, [9, 22]), true)
  ok('rimessa prevista dopo aver scritto la fine, resta', resta(rimessaDopo, [9, 29]), true)
  await s.salvaImpostazioni({ inizioCorsi: null, fineCorsi: null })

  // Le lezioni di oggi sul database ci sono già: le date scritte oggi non le tolgono.
  OGGI = new Date(2026, 8, 28, 12, 0).getTime()
  const oggi = pulite([8, 28]).length
  await s.salvaImpostazioni({ inizioCorsi: '2026-09-29' })
  ok('con l\'inizio domani, le lezioni di oggi restano', [oggi > 0, pulite([8, 28]).length], [true, oggi])
  await s.salvaImpostazioni({ inizioCorsi: null, fineCorsi: null })
  OGGI = new Date(2026, 8, 26, 12, 0).getTime()
}

console.log('\ntogliere un «non sono doppioni»')
{
  const scheda = (id, nome, cognome, altro = {}) => ({ id, nome, cognome, attiva: true, creataIl: '2026-09-26', iscrizioni: [], certificato: { conFile: false }, documento: false, pagamento: { stato: 'da_pagare' }, ...altro })
  const segnate = (indizi, id, tutte) =>
    typeof m.segnateCon !== 'function'
      ? 'segnateCon non c\'è'
      : m.segnateCon({ codiciFiscali: {}, nascite: {}, nonDoppioni: [], ...indizi }, id, tutte).map((p) => p.id)

  // Funzioni pure: le altre schede segnate con una, per cognome e nome.
  const ivo = [scheda('i1', 'Ivo', 'Gallo'), scheda('i2', 'Ivo', 'Gallo'), scheda('i3', 'Ivo', 'Gallo')]
  const coppiaIvo = { nonDoppioni: [['i1', 'i2']] }
  ok('segnate Ivo1 e Ivo2: da Ivo1 si vede Ivo2', segnate(coppiaIvo, 'i1', ivo), ['i2'])
  ok('e da Ivo2 si vede Ivo1', segnate(coppiaIvo, 'i2', ivo), ['i1'])
  ok('una scheda senza coppie: nessuna', segnate(coppiaIvo, 'i3', ivo), [])
  ok('più coppie, per cognome e nome',
    segnate({ nonDoppioni: [['z', 'k'], ['a', 'k']] }, 'k', [scheda('k', 'Ivo', 'Gallo'), scheda('z', 'Zoe', 'Gallo'), scheda('a', 'Ada', 'Gallo')]), ['a', 'z'])
  ok('una coppia con una scheda che non c\'è fra le persone: no', segnate({ nonDoppioni: [['i1', 'sparita']] }, 'i1', ivo), [])
  ok('una delle due disattivata: c\'è lo stesso',
    segnate(coppiaIvo, 'i1', [ivo[0], { ...ivo[1], attiva: false }]), ['i2'])

  // La segreteria di prova.
  const togli = (a, b) => (typeof s.togliNonDoppioni === 'function' ? s.togliNonDoppioni(a, b) : Promise.reject(new Error('togliNonDoppioni non c\'è')))
  const nonDoppioni = async () => (await s.indiziDoppioni()).nonDoppioni.map((c) => [...c].sort().join())
  const inCoppia = async (a, b) => m.coppieDoppioni(await s.persone(), await s.indiziDoppioni()).some((c) => c.map((p) => p.id).sort().join() === [a, b].sort().join())

  const [eva1, eva2] = [await s.salvaPersona({ nome: 'Eva', cognome: 'Marchetti' }), await s.salvaPersona({ nome: 'Eva', cognome: 'Marchetti' })]
  await s.segnaNonDoppioni(eva1, eva2)
  ok('tolto «non sono doppioni», nell\'altro ordine', await errore(() => togli(eva2, eva1)), 'nessun errore')
  ok('la coppia non è più fra le «non sono doppioni»', (await nonDoppioni()).includes([eva1, eva2].sort().join()), false)
  ok('e torna fra i possibili doppioni', await inCoppia(eva1, eva2), true)
  ok('tolto di nuovo: nessun errore', await errore(() => togli(eva1, eva2)), 'nessun errore')

  const [rio1, rio2, rio3] = [await s.salvaPersona({ nome: 'Rio', cognome: 'Bassi' }), await s.salvaPersona({ nome: 'Rio', cognome: 'Bassi' }), await s.salvaPersona({ nome: 'Rio', cognome: 'Bassi' })]
  await s.segnaNonDoppioni(rio1, rio3)
  await s.segnaNonDoppioni(rio2, rio3)
  await errore(() => togli(rio1, rio3))
  ok('tolta Rio1–Rio3, resta Rio2–Rio3',
    (await nonDoppioni()).filter((c) => [rio1, rio2, rio3].some((id) => c.includes(id))), [[rio2, rio3].sort().join()])

  const [ada1, ada2] = [await s.salvaPersona({ nome: 'Ada', cognome: 'Conti' }), await s.salvaPersona({ nome: 'Ada', cognome: 'Conti' })]
  await s.salvaAnagrafica(ada1, { codiceFiscale: 'CNTDAA10A41L219X' })
  await s.salvaAnagrafica(ada2, { codiceFiscale: 'CNTDAA12B41L219Y' })
  await s.segnaNonDoppioni(ada1, ada2)
  await errore(() => togli(ada1, ada2))
  ok('due codici fiscali diversi: tolta la coppia, non torna fra i possibili doppioni', await inCoppia(ada1, ada2), false)

  // Col database senza 33-non-doppioni.sql: la tabella non c'è.
  const risposta = (t) =>
    t === 'non_doppioni'
      ? { data: null, error: { code: 'PGRST205', message: "Could not find the table 'public.non_doppioni' in the schema cache" } }
      : { data: [], error: null }
  const richiestaFinta = (t) => {
    const q = new Proxy(() => q, {
      get: (_, k) => (k === 'range' ? (da) => (da ? oltre : q) : k === 'then' ? (ok, ko) => Promise.resolve(risposta(t)).then(ok, ko) : () => q),
      apply: () => q,
    })
    return q
  }
  const senza = m.creaSegreteriaSupabase({
    from: (t) => richiestaFinta(t),
    rpc: async (f) => ({ data: null, error: { code: 'PGRST202', message: `Could not find the function public.${f} in the schema cache` } }),
  })
  const manca = await errore(() => (typeof senza.togliNonDoppioni === 'function' ? senza.togliNonDoppioni(eva1, eva2) : Promise.reject(new Error('togliNonDoppioni non c\'è'))))
  ok('senza il file sul database, togliere dice quale file lanciare', manca.includes('33-non-doppioni.sql') ? '33-non-doppioni.sql' : manca, '33-non-doppioni.sql')
}

console.log('\npossibili doppioni: nomi scambiati e un secondo nome')
{
  const scheda = (id, nome, cognome, altro = {}) => ({ id, nome, cognome, attiva: true, creataIl: '2026-09-26', iscrizioni: [], certificato: { conFile: false }, documento: false, pagamento: { stato: 'da_pagare' }, ...altro })
  const vuoti = { codiciFiscali: {}, nascite: {}, nonDoppioni: [] }
  const motivo = (a, b, indizi = {}) =>
    typeof m.motivoDoppione !== 'function' ? 'motivoDoppione non c\'è' : m.motivoDoppione(a, b, { ...vuoti, ...indizi })
  const chiara = scheda('1', 'Chiara', 'Rossi')

  ok('«Chiara Rossi» e una scheda Rossi Chiara: nome e cognome scambiati', motivo(chiara, scheda('2', 'Rossi', 'Chiara')), 'scambiati')
  ok('«Chiara Rossi» e «Maria Chiara Rossi»: un secondo nome', motivo(chiara, scheda('2', 'Maria Chiara', 'Rossi')), 'secondo nome')
  ok('«Chiara Rossi» e «Maria Chiara Anna Rossi»: due nomi in più, no', motivo(chiara, scheda('2', 'Maria Chiara Anna', 'Rossi')), null)
  ok('«A. Rossi» e «Anna Rossi»: un\'iniziale sola, no', motivo(scheda('1', 'A.', 'Rossi'), scheda('2', 'Anna', 'Rossi')), null)
  ok('«M. Chiara Rossi» e «Maria Chiara Rossi»: no', motivo(scheda('1', 'M. Chiara', 'Rossi'), scheda('2', 'Maria Chiara', 'Rossi')), null)
  ok('«Chiara Rossi» e «Chiara M. Rossi»: un secondo nome', motivo(chiara, scheda('2', 'Chiara M.', 'Rossi')), 'secondo nome')

  const anna = scheda('1', 'Anna', 'Rossi', { telefono: '333 1234567' })
  const annaMaria = scheda('2', 'Anna Maria', 'Rossi', { telefono: '333 1234567' })
  ok('un secondo nome, due nascite diverse: no', motivo(anna, annaMaria, { nascite: { 1: '2010-01-01', 2: '2012-02-01' } }), null)
  ok('un secondo nome, due codici fiscali diversi: no', motivo(anna, annaMaria, { codiciFiscali: { 1: 'RSSNNA10A41L219X', 2: 'RSSNNM12B41L219Y' } }), null)
  ok('un secondo nome, segnate «non sono doppioni»: no', motivo(anna, annaMaria, { nonDoppioni: [['1', '2']] }), null)
  ok('anche segnate nell\'altro ordine', motivo(anna, annaMaria, { nonDoppioni: [['2', '1']] }), null)
  ok('un secondo nome e lo stesso telefono, nient\'altro: un secondo nome', motivo(anna, annaMaria), 'secondo nome')

  ok('scambiati e un secondo nome insieme: no', motivo(chiara, scheda('2', 'Rossi', 'Maria Chiara')), null)
  ok('«Luca De Luca» e «Luca Luca»: no', motivo(scheda('1', 'Luca', 'De Luca'), scheda('2', 'Luca', 'Luca')), null)
  ok('«Marco Rossi Bianchi» e «Marco Rossi»: no', motivo(scheda('1', 'Marco', 'Rossi Bianchi'), scheda('2', 'Marco', 'Rossi')), null)
  ok('stesso codice fiscale e nomi scambiati: il codice fiscale',
    motivo(chiara, scheda('2', 'Rossi', 'Chiara'), { codiciFiscali: { 1: 'RSSCHR10A41L219X', 2: 'rsschr10a41l219x' } }), 'codice fiscale')
  ok("«Luca D'Amico» e «luca damico»: lo stesso nome", motivo(scheda('1', 'Luca', "D'Amico"), scheda('2', 'luca', 'damico')), 'nome')

  // Una coppia per motivo, seminate in disordine: prima il codice fiscale, poi il nome, gli scambiati, il secondo nome.
  const miste = [
    scheda('7', 'Anna', 'Abate'), scheda('8', 'Anna Maria', 'Abate'),
    scheda('5', 'Bice', 'Conti'), scheda('6', 'Conti', 'Bice'),
    scheda('3', 'Dino', 'Esposito'), scheda('4', 'dino', 'esposito'),
    scheda('1', 'Ugo', 'Zanetti'), scheda('2', 'Ugolino', 'Zanetti'),
  ]
  ok('le coppie in ordine di motivo: codice fiscale, nome, scambiati, secondo nome',
    typeof m.coppieDoppioni !== 'function' ? 'coppieDoppioni non c\'è'
      : m.coppieDoppioni(miste, { ...vuoti, codiciFiscali: { 1: 'ZNTGUO10A01L219X', 2: 'ZNTGUO10A01L219X' } }).map((c) => c.map((p) => p.id).sort().join('-')),
    ['1-2', '3-4', '5-6', '7-8'])

  const proposti = m.possibiliDoppioni(chiara, [scheda('9', 'Anna', 'Bianchi'), scheda('2', 'Rossi', 'Chiara'), scheda('8', 'Zeno', 'Verdi')])
  ok('aperta «Chiara Rossi»: la scheda scambiata prima di Anna Bianchi', proposti.map((p) => p.id), ['2', '9', '8'])

  ok('le etichette dei motivi', m.MOTIVI ?? 'MOTIVI non c\'è',
    { 'codice fiscale': 'stesso codice fiscale', nome: 'stesso nome', scambiati: 'nome e cognome scambiati', 'secondo nome': 'un secondo nome' })
}

console.log('\nSALVA LE DATE toglie le lezioni fuori dalle date dei corsi, tranne quelle con appello o prova')
{
  // Come `salva_date_corsi` (35-date-corsi.sql): da domani in poi, le lezioni
  // da ricorrenza fuori dalle date se ne vanno anche se toccate (annullate,
  // col sostituto, spostate); restano quelle con l'appello o una prova.
  await s.salvaImpostazioni({ inizioCorsi: null, fineCorsi: null })
  const a = m.archivio.dati
  const fra = (da, b = da) => m.lezioniFra(new Date(2026, da[0], da[1]), new Date(2026, b[0], b[1]))
  const ordinarie = (da, b) => fra(da, b).filter((l) => !l.straordinaria)
  const g = (l) => m.chiaveGiorno(l.inizio)
  const conAppelloOProva = (l) => Object.keys(m.memoria.segnate[l.id] ?? {}).length > 0 || (a.prove ?? []).some((x) => x.sessioneId === l.id)
  // Da domani a fine stagione, quelle fuori da [inizio, fine].
  const fuori = (inizio, fine) => ordinarie([8, 27], [17, 30]).filter((l) => (inizio && g(l) < inizio) || (fine && g(l) > fine))
  const salvaDate = (inizio, fine) => s.salvaDateCorsi(inizio, fine)
  const esito = (e) => [e.tolte, e.restano, e.prima, e.ultima]
  const rimaste = (...l) => l.map((x) => ({ corso: x.corso.nome, inizio: x.inizio.toISOString() }))
  // Le prove di prima hanno lasciato appelli e prove nel futuro: si partono senza.
  m.memoria.segnate = Object.fromEntries(Object.entries(m.memoria.segnate).map(([id, v]) => [id, (m.trovaLezione(id)?.inizio ?? 0) > new Date() ? {} : v]))
  a.prove = (a.prove ?? []).filter((x) => !((m.trovaLezione(x.sessioneId)?.inizio ?? 0) > new Date()))

  // Dopo il 10 ottobre: lunedì 19 una annullata, una col sostituto, una con
  // l'appello, una con l'appello segnato e poi tolto, una con la sola
  // presenza dell'istruttore; mercoledì 21 una con una prova.
  const lun19 = ordinarie([9, 19])
  const coninsegnante = lun19.find((l) => l.corso.istruttori.length)
  const [annullata, sostituita, segnata, rimessa] = lun19.filter((l) => l !== coninsegnante)
  const [conprova] = ordinarie([9, 21])
  await s.aggiornaLezione(annullata.id, { stato: 'annullata' })
  await s.aggiornaLezione(sostituita.id, { sostitutoId: 'i-fabio' })
  await app.segna(segnata.id, (await app.dettaglio(segnata.id)).elenco[0].id, 'presente')
  const chi = (await app.dettaglio(rimessa.id)).elenco[0].id
  await app.segna(rimessa.id, chi, 'presente')
  await app.segna(rimessa.id, chi, null)
  m.segnaIstruttoriLezioneProva(coninsegnante.id, coninsegnante.corso.istruttori.slice(0, 1), 's-prova')
  await app.aggiungiProva(conprova.id, { nome: 'Dora', cognome: 'Datata', telefono: '333 000 3333' })
  m.memoria.segnate = { ...m.memoria.segnate, [conprova.id]: {} }
  await s.straordinaria('judo-2', new Date(2026, 9, 20, 20, 0), 60)
  const [extra] = fra([9, 20]).filter((l) => l.straordinaria && l.corso.id === 'judo-2')
  ok('le sei lezioni del 19 e 21 ottobre sono diverse', new Set([annullata, sostituita, segnata, rimessa, coninsegnante, conprova].map((l) => l?.id)).size, 6)

  const primaFine = fuori(null, '2026-10-10')
  // Prima di salvare, il conto per la conferma: non scrive niente.
  const c1 = await s.contaDateCorsi(null, '2026-10-10')
  ok('contare non scrive le date', (await s.impostazioni()).fineCorsi ?? null, null)
  ok('contare non toglie lezioni', [fuori(null, '2026-10-10').length, annullata.id in a.lezioni, sostituita.id in a.lezioni], [primaFine.length, true, true])
  const e1 = await salvaDate(null, '2026-10-10')
  ok('il conto dice gli stessi numeri del salvataggio', [esito(c1), c1.rimaste], [esito(e1), e1.rimaste])
  ok('rimaste: corso e inizio di quella con l\'appello e di quella con la prova', e1.rimaste, rimaste(segnata, conprova))
  ok('fine il 10 ottobre: tolte le settimanali dopo il 10, tranne le due con appello o prova', [e1.tolte > 0, e1.tolte], [true, primaFine.length - 2])
  ok('restano due, dal giorno dell\'appello a quello della prova', [e1.restano, e1.prima, e1.ultima], [2, '2026-10-19', '2026-10-21'])
  const visti = (v) => (v.length > 3 ? `${v.length} lezioni` : v.map((l) => l.id))
  ok('dopo il 10 ottobre si vedono solo quella con l\'appello e quella con la prova', visti(fuori(null, '2026-10-10')), [segnata.id, conprova.id])
  ok('la fine è scritta', [(await s.impostazioni()).inizioCorsi ?? null, (await s.impostazioni()).fineCorsi], [null, '2026-10-10'])
  const via = (l) => [fra([9, 19], [9, 21]).some((x) => x.id === l.id), l.id in a.lezioni]
  ok('l\'annullata non c\'è più, nemmeno nell\'archivio', via(annullata), [false, false])
  ok('quella col sostituto non c\'è più, nemmeno nell\'archivio', via(sostituita), [false, false])
  ok('quella con l\'appello segnato e tolto non c\'è più, e nemmeno l\'appello vuoto', [via(rimessa)[0], rimessa.id in m.memoria.segnate], [false, false])
  ok('quella con la sola presenza dell\'istruttore non c\'è più, e nemmeno la presenza', [via(coninsegnante)[0], (a.presenzeIstruttori ?? []).some((x) => x.sessioneId === coninsegnante.id)], [false, false])
  ok('l\'appello resta', m.memoria.segnate[segnata.id] && Object.keys(m.memoria.segnate[segnata.id]).length, 1)
  ok('la prova resta', (a.prove ?? []).some((x) => x.sessioneId === conprova.id), true)
  ok('la straordinaria del 20 ottobre resta, e non è contata', fra([9, 20]).some((l) => l.id === extra.id), true)
  ok('fino al 10 ottobre le lezioni ci sono', ordinarie([9, 1], [9, 10]).length > 0, true)

  const e2 = await salvaDate(null, '2026-10-10')
  ok('risalvate le stesse date: niente tolto, le due restano', [esito(e2), e2.rimaste], [[0, 2, '2026-10-19', '2026-10-21'], rimaste(segnata, conprova)])

  // L'inizio spostato avanti: da domani al 4 ottobre. Oggi e il passato no.
  await s.salvaImpostazioni({ inizioCorsi: null, fineCorsi: null })
  const passate = fra([8, 14], [8, 25]).length
  const oggi = ordinarie([8, 26])
  const [oggiAnnullata] = oggi
  await s.aggiornaLezione(oggiAnnullata.id, { stato: 'annullata' })
  let gio1
  for (const l of ordinarie([9, 1])) if (!gio1 && (await app.dettaglio(l.id)).elenco.length) gio1 = l
  await app.segna(gio1.id, (await app.dettaglio(gio1.id)).elenco[0].id, 'presente')
  const primaInizio = fuori('2026-10-05', null)
  ok('prima, dal 27 settembre al 4 ottobre ci sono lezioni', primaInizio.length > 1, true)
  const c3 = await s.contaDateCorsi('2026-10-05', null)
  ok('contare l\'inizio non toglie niente', [fuori('2026-10-05', null).length, (await s.impostazioni()).inizioCorsi ?? null], [primaInizio.length, null])
  const e3 = await salvaDate('2026-10-05', null)
  ok('inizio il 5 ottobre: tolte quelle da domani al 4 ottobre, tranne quella con l\'appello', esito(e3), [primaInizio.length - 1, 1, '2026-10-01', '2026-10-01'])
  ok('…come diceva il conto, con la lezione rimasta', [esito(c3), c3.rimaste, e3.rimaste], [esito(e3), rimaste(gio1), rimaste(gio1)])
  ok('dal 27 settembre al 4 ottobre si vede solo quella con l\'appello', visti(ordinarie([8, 27], [9, 4])), [gio1.id])
  ok('le lezioni di oggi restano tutte', [oggi.length > 0, ordinarie([8, 26]).map((l) => l.id)], [true, oggi.map((l) => l.id)])
  ok('quella di oggi annullata resta annullata', a.lezioni[oggiAnnullata.id]?.stato, 'annullata')
  ok('il passato non cambia', fra([8, 14], [8, 25]).length, passate)
  ok('dal 5 ottobre le lezioni ci sono', ordinarie([9, 5], [9, 11]).length > 0, true)

  // Col database vero: la funzione del database, e il risultato com'è.
  const chiamate = []
  const scritte = []
  const richiesta = () => {
    const q = new Proxy(() => q, {
      get: (_, k) => (k === 'then' ? (fatto) => fatto({ data: null, error: null }) : k === 'update' ? (riga) => (scritte.push(riga), q) : () => q),
      apply: () => q,
    })
    return q
  }
  const db = (risposta) => m.creaSegreteriaSupabase({ from: () => richiesta(), rpc: async (f, x) => (chiamate.push([f, x]), risposta(f)) })
  const giudo = [{ corso: 'Judo 2', inizio: '2026-10-14T15:00:00+00:00' }]
  const vero = db(() => ({ data: { tolte: 3, restano: 1, prima: '2026-10-14', ultima: '2026-10-14', rimaste: giudo }, error: null }))
  const ev = await vero.salvaDateCorsi('2026-10-05', '2026-10-10')
  ok('database: chiede salva_date_corsi con le due date', [esito(ev), ev.rimaste], [[3, 1, '2026-10-14', '2026-10-14'], giudo])
  const cv = await vero.contaDateCorsi('2026-10-05', '2026-10-10')
  ok('…e per contare la stessa, con solo_contare', [esito(cv), cv.rimaste], [[3, 1, '2026-10-14', '2026-10-14'], giudo])
  ok('…con i nomi del database', chiamate, [
    ['salva_date_corsi', { inizio: '2026-10-05', fine: '2026-10-10', solo_contare: false }],
    ['salva_date_corsi', { inizio: '2026-10-05', fine: '2026-10-10', solo_contare: true }],
  ])
  // Senza 35-date-corsi.sql: le date si salvano lo stesso, e si dice cosa lanciare.
  const senza = db((f) => ({ data: null, error: { code: 'PGRST202', message: `Could not find the function public.${f}(fine, inizio) in the schema cache` } }))
  // Non si ferma: Regole rigenera e chiude la bozza, e l'avviso dice cosa lanciare.
  const e = await senza.salvaDateCorsi('2026-10-05', '2026-10-10').catch((x) => ({ lanciato: x.message }))
  ok('senza il file sul database non toglie niente, e dice quale lanciare', [esito(e), /35-date-corsi\.sql/.test(e.manca ?? '')], [[0, 0, null, null], true])
  ok('…ma le date le salva', scritte.some((r) => r.inizio_corsi === '2026-10-05' && r.fine_corsi === '2026-10-10'), true)
  const quante = scritte.length
  const cs = await senza.contaDateCorsi('2026-10-05', '2026-10-10').catch((x) => ({ lanciato: x.message }))
  ok('contare senza il file: esito vuoto, dice quale lanciare, non scrive niente', [esito(cs), /35-date-corsi\.sql/.test(cs.manca ?? ''), scritte.length], [[0, 0, null, null], true, quante])

  // Le parole dell'avviso.
  const testo = (tolte, restano = 0, prima = null, ultima = prima) => m.testoDateSalvate({ tolte, restano, prima, ultima })
  const t12 = 'Date salvate: tolte 12 lezioni. '
  ok('niente tolto né rimasto', testo(0), 'Date salvate')
  ok('una tolta', testo(1), 'Date salvate: tolta 1 lezione')
  ok('dodici tolte', testo(12), 'Date salvate: tolte 12 lezioni')
  ok('tolte, e una resta', testo(12, 1, '2026-10-14'), t12 + 'Resta la lezione del 14 ottobre: ha l’appello o una prova')
  ok('tolte, e due restano in due giorni dello stesso mese', testo(12, 2, '2026-10-14', '2026-10-21'), t12 + 'Restano le lezioni del 14 e del 21 ottobre: hanno l’appello o una prova')
  ok('tolte, e due restano in due mesi', testo(12, 2, '2026-09-28', '2026-10-03'), t12 + 'Restano le lezioni del 28 settembre e del 3 ottobre: hanno l’appello o una prova')
  ok('tolte, e due restano lo stesso giorno', testo(12, 2, '2026-10-14'), t12 + 'Restano 2 lezioni del 14 ottobre: hanno l’appello o una prova')
  ok('tolte, e tre restano', testo(12, 3, '2026-10-14', '2026-11-03'), t12 + 'Restano 3 lezioni fra il 14 ottobre e il 3 novembre: hanno l’appello o una prova')
  ok('niente tolto, una resta', testo(0, 1, '2026-10-14'), 'Date salvate. Resta la lezione del 14 ottobre: ha l’appello o una prova')
  // Con corso e ora delle rimaste, fino a tre. Gli inizi da date locali: l'ora non dipende dal fuso.
  const il = (corso, mese, giorno, ora) => ({ corso, inizio: new Date(2026, mese, giorno, ora, 0).toISOString() })
  const conRimaste = (tolte, restano, rimaste) => m.testoDateSalvate({ tolte, restano, prima: rimaste[0].inizio.slice(0, 10), ultima: rimaste.at(-1).inizio.slice(0, 10), rimaste })
  const hanno = ': hanno l’appello o una prova'
  ok('una rimasta, col corso e l\'ora', conRimaste(12, 1, [il('Judo 2', 9, 19, 17)]), t12 + 'Resta Judo 2 del 19 ottobre alle 17:00: ha l’appello o una prova')
  ok('niente tolto, una rimasta', conRimaste(0, 1, [il('Judo 2', 9, 19, 17)]), 'Date salvate. Resta Judo 2 del 19 ottobre alle 17:00: ha l’appello o una prova')
  ok('due rimaste lo stesso giorno: il giorno una volta, in fondo', conRimaste(12, 2, [il('Judo 2', 9, 19, 17), il('Judo 3', 9, 19, 18)]), t12 + 'Restano Judo 2 alle 17:00 e Judo 3 alle 18:00 del 19 ottobre' + hanno)
  ok('due rimaste in giorni diversi', conRimaste(12, 2, [il('Judo 2', 9, 14, 17), il('Judo 3', 9, 21, 18)]), t12 + 'Restano Judo 2 del 14 ottobre alle 17:00 e Judo 3 del 21 ottobre alle 18:00' + hanno)
  ok('tre rimaste lo stesso giorno', conRimaste(12, 3, [il('Judo 2', 9, 19, 17), il('Judo 3', 9, 19, 18), il('Lotta 2', 9, 19, 19)]), t12 + 'Restano Judo 2 alle 17:00, Judo 3 alle 18:00 e Lotta 2 alle 19:00 del 19 ottobre' + hanno)
  ok('tre rimaste in giorni diversi', conRimaste(12, 3, [il('Judo 2', 9, 14, 17), il('Judo 3', 9, 21, 18), il('Lotta 2', 10, 3, 19)]), t12 + 'Restano Judo 2 del 14 ottobre alle 17:00, Judo 3 del 21 ottobre alle 18:00 e Lotta 2 del 3 novembre alle 19:00' + hanno)
  ok('più di tre: le frasi senza corso', conRimaste(12, 4, [il('Judo 2', 9, 14, 17), il('Judo 3', 9, 21, 18), il('Lotta 2', 10, 3, 19)]), t12 + 'Restano 4 lezioni fra il 14 ottobre e il 3 novembre' + hanno)

  // La conferma prima di togliere, come per i mesi delle presenze.
  ok('conferma: il conto non è riuscito, si chiede lo stesso', m.confermaDateCorsi(null), { testo: 'Salvare le date? Da domani le lezioni fuori dalle date se ne vanno, tranne quelle con l’appello o una prova.', tasto: 'Salva le date' })
  ok('conferma: senza il file non si chiede', m.confermaDateCorsi({ tolte: 0, restano: 0, prima: null, ultima: null, manca: 'va lanciato 35-date-corsi.sql' }), null)
  ok('conferma: niente da togliere, non si chiede', m.confermaDateCorsi({ tolte: 0, restano: 2, prima: '2026-10-19', ultima: '2026-10-21' }), null)
  ok('conferma: tante da togliere, due restano', m.confermaDateCorsi({ tolte: 1877, restano: 2, prima: '2026-10-19', ultima: '2026-10-21' }), { testo: 'Togliere 1877 lezioni fuori dalle date? Restano 2 lezioni con l’appello o una prova.', tasto: 'Sì, togli 1877 lezioni' })
  ok('conferma: una da togliere', m.confermaDateCorsi({ tolte: 1, restano: 0, prima: null, ultima: null }), { testo: 'Togliere 1 lezione fuori dalle date?', tasto: 'Sì, togli 1 lezione' })
  ok('conferma: cinque da togliere, una resta', m.confermaDateCorsi({ tolte: 5, restano: 1, prima: '2026-10-19', ultima: '2026-10-19' }), { testo: 'Togliere 5 lezioni fuori dalle date? Resta 1 lezione con l’appello o una prova.', tasto: 'Sì, togli 5 lezioni' })
  ok('senza 35-date-corsi.sql', m.testoDateSalvate({ tolte: 0, restano: 0, prima: null, ultima: null, manca: 'va lanciato 35-date-corsi.sql' }), 'Date salvate, ma per togliere le lezioni fuori dalle date va lanciato 35-date-corsi.sql')

  await s.salvaImpostazioni({ inizioCorsi: null, fineCorsi: null })
  OGGI = new Date(2026, 8, 26, 12, 0).getTime()
}

console.log('\nl’«Attività» di ogni giorno dei corsi: le regole in src/lib/segreteria.ts')
// Le funzioni ancora da scrivere non fermano la prova: ogni caso dice «ERRORE: …» e si va avanti.
const lib = m.segreteriaLib
const pura = (f) => {
  try {
    return f()
  } catch (e) {
    return `ERRORE: ${e.message}`
  }
}
// Un messaggio vero, non l'errore di una funzione che manca: se no un «no» passerebbe senza che niente sia stato rifiutato.
const eMessaggio = (x) => typeof x === 'string' && !x.startsWith('ERRORE') && !/is not a function/.test(x) && x !== 'nessun errore'
{
  const gia = "C'è già un'attività con questo nome"
  const nomi = [{ id: '1', nome: 'Sacco' }, { id: '2', nome: 'Angoli' }]
  ok('un nome nuovo va bene', pura(() => lib.cosaNonVaAttivita('Sparring', nomi)), null)
  ok('con gli spazi intorno va bene', pura(() => lib.cosaNonVaAttivita('  Sparring  ', nomi)), null)
  ok('«sacco » è «Sacco»: già c\'è', pura(() => lib.cosaNonVaAttivita('sacco ', nomi)), gia)
  ok('«SACCO» pure', pura(() => lib.cosaNonVaAttivita('SACCO', nomi)), gia)
  ok('rinominare «Angoli» in «sacco» no', pura(() => lib.cosaNonVaAttivita(' sacco', nomi, '2')), gia)
  ok('la stessa voce può riscriversi, anche con le maiuscole diverse', [pura(() => lib.cosaNonVaAttivita('Sacco', nomi, '1')), pura(() => lib.cosaNonVaAttivita('SACCO', nomi, '1'))], [null, null])
  const vuoto = pura(() => lib.cosaNonVaAttivita('', nomi))
  const lungo = pura(() => lib.cosaNonVaAttivita('x'.repeat(41), nomi))
  ok('vuoto no, e lo dice', [eMessaggio(vuoto), vuoto === gia], [true, false])
  ok('solo spazi no, come vuoto', pura(() => lib.cosaNonVaAttivita('   ', nomi)), vuoto)
  ok('41 caratteri no, e lo dice', [eMessaggio(lungo), lungo === gia, lungo === vuoto], [true, false, false])
  ok('40 caratteri sì', pura(() => lib.cosaNonVaAttivita('x'.repeat(40), nomi)), null)
  ok('40 caratteri più gli spazi intorno sì', pura(() => lib.cosaNonVaAttivita(` ${'x'.repeat(40)} `, nomi)), null)

  ok('in ordine alfabetico, senza badare a maiuscole e accenti',
    pura(() => lib.ordinaAttivita([{ nome: 'sacco' }, { nome: 'Zumba' }, { nome: 'Èlite' }, { nome: 'arrampicata' }, { nome: 'Angoli' }]).map((a) => a.nome)),
    ['Angoli', 'arrampicata', 'Èlite', 'sacco', 'Zumba'])
  const tutte = [{ id: 'z', nome: 'Zumba', attiva: true }, { id: 's', nome: 'Sacco', attiva: false }, { id: 'a', nome: 'Angoli', attiva: true }]
  ok('i menu di giorno e lezione: solo quelle in uso, in ordine', pura(() => lib.attivitaPerMenu(tutte).map((a) => a.nome)), ['Angoli', 'Zumba'])
  ok('l\'elenco da cui si prende non cambia', tutte.map((a) => a.nome), ['Zumba', 'Sacco', 'Angoli'])

  ok('mai usata: si elimina', pura(() => lib.motivoAttivitaUsata(0, 0)), null)
  ok('usata: il motivo dice quanti giorni e quante lezioni, e cosa fare',
    pura(() => lib.motivoAttivitaUsata(2, 3)), 'È su 2 giorni e 3 lezioni: toglila dai giorni, oppure usa NON PIÙ IN USO')

  ok('la lezione come il giorno: non è cambiata a mano', pura(() => lib.attivitaCambiataAMano({ attivitaId: 's', straordinaria: false }, { attivitaId: 's' })), false)
  ok('un\'altra attività: cambiata a mano', pura(() => lib.attivitaCambiataAMano({ attivitaId: 'p', straordinaria: false }, { attivitaId: 's' })), true)
  ok('«Nessuna attività» su un giorno che ce l\'ha: cambiata a mano', pura(() => lib.attivitaCambiataAMano({ attivitaId: null, straordinaria: false }, { attivitaId: 's' })), true)
  ok('un\'attività su un giorno che non ce l\'ha: cambiata a mano', pura(() => lib.attivitaCambiataAMano({ attivitaId: 'p', straordinaria: false }, {})), true)
  ok('nessuna e nessuna: no, null e assente sono lo stesso', pura(() => lib.attivitaCambiataAMano({ attivitaId: null, straordinaria: false }, { attivitaId: undefined })), false)
  ok('una straordinaria non lo è mai, con o senza attività', [
    pura(() => lib.attivitaCambiataAMano({ attivitaId: 'p', straordinaria: true }, undefined)),
    pura(() => lib.attivitaCambiataAMano({ attivitaId: null, straordinaria: true }, undefined)),
  ], [false, false])

  // Il nome dell'attività del giorno di una lezione: giorno della settimana e ora.
  const mercoledi = new Date(2026, 9, 14, 18, 0).toISOString()
  const corsiAtt = [{ id: 'k', ricorrenze: [{ id: 'r1', giorno: 3, ora: '18:00', attivita: 'Sacco' }, { id: 'r2', giorno: 3, ora: '19:00' }] }]
  ok('il nome dell\'attività del giorno della lezione', pura(() => lib.attivitaDelGiorno(corsiAtt, { corsoId: 'k', inizio: mercoledi })), 'Sacco')
  ok('un giorno senza attività, o che non c\'è più: niente nome', [
    pura(() => lib.attivitaDelGiorno(corsiAtt, { corsoId: 'k', inizio: new Date(2026, 9, 14, 19, 0).toISOString() })),
    pura(() => lib.attivitaDelGiorno(corsiAtt, { corsoId: 'k', inizio: new Date(2026, 9, 15, 18, 0).toISOString() })),
    pura(() => lib.attivitaDelGiorno(corsiAtt, { corsoId: 'x', inizio: mercoledi })),
  ], [undefined, undefined, undefined])

  // Chi segue il giorno quando cambia: le future, senza appello né prove, con ancora l'attività di prima.
  const adesso = new Date(2026, 8, 26, 12, 0)
  const futura = new Date(2026, 9, 14, 18, 0).toISOString()
  const passata = new Date(2026, 8, 23, 18, 0).toISOString()
  const l = (id, extra = {}) => ({ id, inizio: futura, attivitaId: undefined, segnati: 0, prove: 0, ...extra })
  const seguono = (lezioni, prima) => pura(() => lib.lezioniCheSeguonoIlGiorno(lezioni, prima, adesso))
  ok('senza attività prima: seguono le future senza appello né prove, non cambiate a mano',
    seguono([l('passata', { inizio: passata }), l('appello', { segnati: 2 }), l('mano', { attivitaId: 'spar' }), l('a'), l('b', { attivitaId: null }), l('prova', { prove: 1 })], undefined), ['a', 'b'])
  ok('«null» e assente sono lo stesso giorno vuoto', seguono([l('a'), l('b', { attivitaId: null })], null), ['a', 'b'])
  ok('con «Sacco» prima: seguono quelle che hanno «Sacco»',
    seguono([l('a', { attivitaId: 'sacco' }), l('vuota'), l('spar', { attivitaId: 'spar' }), l('appello', { attivitaId: 'sacco', segnati: 1 }), l('passata', { attivitaId: 'sacco', inizio: passata }), l('prova', { attivitaId: 'sacco', prove: 1 }), l('b', { attivitaId: 'sacco' })], 'sacco'), ['a', 'b'])
  ok('nessuna da seguire', seguono([l('passata', { inizio: passata }), l('appello', { segnati: 1 })], undefined), [])
  ok('una lezione che comincia adesso non è più futura', seguono([l('ora', { inizio: adesso.toISOString() })], undefined), [])

  // Le voci dei menu: quelle in uso in ordine, più quella che la lezione o il giorno hanno già, se è uscita dall'uso.
  const vv = [{ id: '1', nome: 'Sacco', attiva: false }, { id: '2', nome: 'Zumba', attiva: true }, { id: '3', nome: 'Angoli', attiva: true }]
  const voci = (corrente) => pura(() => lib.vociAttivita(vv, corrente).map((a) => [a.nome, a.fuoriUso]))
  ok('le voci: solo quelle in uso, in ordine', voci(null), [['Angoli', false], ['Zumba', false]])
  ok('quella già messa e fuori uso resta, in fondo e marcata', voci('1'), [['Angoli', false], ['Zumba', false], ['Sacco', true]])
  ok('quella già messa e in uso non si ripete', voci('2'), [['Angoli', false], ['Zumba', false]])
  ok('una che non c\'è: niente di più', voci('x'), [['Angoli', false], ['Zumba', false]])

  // Cosa mostra il menu di una lezione: segue il giorno solo se il giorno la può ancora cambiare.
  const sc = (lez) => pura(() => lib.sceltaAttivitaLezione({ attivitaId: undefined, attivitaCambiata: false, straordinaria: false, inizio: futura, segnati: 0, ...lez }, adesso))
  ok('futura, senza appello, come il giorno: segue', sc({}), { valore: lib.COME_IL_GIORNO, segue: true, conGiorno: true })
  ok('futura cambiata a mano: la sua, con «Come il giorno» da offrire', sc({ attivitaCambiata: true, attivitaId: 'p' }), { valore: 'p', segue: false, conGiorno: true })
  ok('futura con «nessuna»: nessuna', sc({ attivitaCambiata: true }), { valore: lib.NESSUNA_ATTIVITA, segue: false, conGiorno: true })
  ok('straordinaria: la sua, senza giorno', sc({ straordinaria: true, attivitaId: 'p' }), { valore: 'p', segue: false, conGiorno: false })
  ok('passata: la sua, senza «Come il giorno»', sc({ inizio: passata, attivitaId: 'p' }), { valore: 'p', segue: false, conGiorno: false })
  ok('con l\'appello: la sua, senza «Come il giorno»', sc({ segnati: 3 }), { valore: lib.NESSUNA_ATTIVITA, segue: false, conGiorno: false })

  // Cambiata a mano: come per `attivitaCambiataAMano`, ma solo se il giorno la può ancora cambiare (il trigger non tocca passate né appelli).
  const cam = (lez, giorno) => pura(() => lib.attivitaCambiata({ attivitaId: undefined, straordinaria: false, inizio: futura, segnati: 0, ...lez }, giorno, adesso))
  ok('futura con un\'altra attività: cambiata a mano', cam({ attivitaId: 'p' }, { attivitaId: 's' }), true)
  ok('futura come il giorno: no', cam({ attivitaId: 's' }, { attivitaId: 's' }), false)
  ok('passata che il giorno ha poi cambiato: storia, non una scelta', cam({ inizio: passata }, { attivitaId: 's' }), false)
  ok('con l\'appello, stesso: no', cam({ segnati: 1 }, { attivitaId: 's' }), false)
  ok('straordinaria: mai', cam({ straordinaria: true, attivitaId: 'p' }, undefined), false)
}

console.log('\nl’«Attività» di ogni giorno dei corsi: la segreteria di prova')
try {
  const elenco = async () => (await s.attivita()).elenco
  const nomiElenco = async () => (await elenco()).map((a) => a.nome)
  const bf = async (g) => (await s.settimana(...giorno(g))).find((l) => l.corsoId === 'pre-pugilistica')
  // Prepugilistica è il mercoledì alle 19: due lezioni passate, e dopo oggi (sabato 26 settembre) 30 settembre,
  // 7, 14, 21 e 28 ottobre e 4 novembre.
  const DATE = [[8, 16], [8, 23], [8, 30], [9, 7], [9, 14], [9, 21], [9, 28], [10, 4]]
  const etichette = async () => Promise.all(DATE.map(async (g) => (await bf(g)).attivita ?? '-'))
  const giornoBf = async () => (await s.corsi()).find((c) => c.id === 'pre-pugilistica').ricorrenze[0]
  const sulGiorno = async (id) => s.attivitaRicorrenza((await giornoBf()).id, id)
  const gia = "C'è già un'attività con questo nome"

  ok('l’elenco parte vuoto', await elenco(), [])
  const sacco = await s.salvaAttivita({ nome: 'Sacco' })
  const angoli = await s.salvaAttivita({ nome: 'Angoli' })
  const sparring = await s.salvaAttivita({ nome: 'Sparring' })
  ok('in ordine alfabetico', await nomiElenco(), ['Angoli', 'Sacco', 'Sparring'])
  ok('ognuna in uso e su niente', (await elenco()).map((a) => [a.nome, a.attiva, a.giorni, a.lezioni]), [['Angoli', true, 0, 0], ['Sacco', true, 0, 0], ['Sparring', true, 0, 0]])
  ok('«sacco » è «Sacco»', await errore(() => s.salvaAttivita({ nome: 'sacco ' })), gia)
  ok('«SACCO» pure', await errore(() => s.salvaAttivita({ nome: 'SACCO' })), gia)
  ok('rinominare «Angoli» in «sacco» no', await errore(() => s.salvaAttivita({ id: angoli, nome: ' sacco' })), gia)
  ok('il nome vuoto no', eMessaggio(await errore(() => s.salvaAttivita({ nome: '  ' }))), true)
  ok('41 caratteri no', eMessaggio(await errore(() => s.salvaAttivita({ nome: 'x'.repeat(41) }))), true)
  ok('i rifiuti non aggiungono niente', await nomiElenco(), ['Angoli', 'Sacco', 'Sparring'])
  const lunga = await s.salvaAttivita({ nome: 'x'.repeat(40) })
  ok('40 caratteri sì', (await nomiElenco()).includes('x'.repeat(40)), true)
  await s.eliminaAttivita(lunga)
  ok('mai usata, si elimina', await nomiElenco(), ['Angoli', 'Sacco', 'Sparring'])

  // Le lezioni: una con l'appello, una cambiata a mano su Sparring, una con una prova.
  const l30 = await bf([8, 30])
  const chi = (await app.dettaglio(l30.id)).elenco[0].id
  await app.segna(l30.id, chi, 'presente')
  await s.aggiornaLezione((await bf([9, 7])).id, { attivitaId: sparring })
  await app.aggiungiProva((await bf([10, 4])).id, { nome: 'Pia', cognome: 'Prova' })
  ok('di partenza: solo quella cambiata a mano', await etichette(), ['-', '-', '-', 'Sparring', '-', '-', '-', '-'])
  ok('quella cambiata a mano si riconosce, le altre no', [(await bf([9, 7])).attivitaCambiata, (await bf([9, 14])).attivitaCambiata], [true, false])

  await sulGiorno(sacco)
  ok('«Sacco» sul giorno: le tre future che lo seguivano, non quella con l\'appello, quella a mano, quella con la prova, le passate',
    await etichette(), ['-', '-', '-', 'Sparring', 'Sacco', 'Sacco', 'Sacco', '-'])
  ok('solo la lezione scelta a mano risulta cambiata a mano: non le passate né quella con l\'appello, che il giorno ha solo dopo cambiato',
    // Anche quella con la prova (l'ultima) ha un appello: il giorno non la segue.
    await Promise.all(DATE.map(async (g) => (await bf(g)).attivitaCambiata)), [false, false, false, true, false, false, false, false])
  ok('il giorno dice «Sacco»', (await giornoBf()).attivita, 'Sacco')
  ok('anche l\'app degli istruttori', (await app.calendario(...giorno([9, 14]))).find((x) => x.corsoId === 'pre-pugilistica').attivita, 'Sacco')
  ok('e quella a mano sul suo', (await app.calendario(...giorno([9, 7]))).find((x) => x.corsoId === 'pre-pugilistica').attivita, 'Sparring')
  await sulGiorno(angoli)
  ok('da «Sacco» ad «Angoli»: le stesse tre', await etichette(), ['-', '-', '-', 'Sparring', 'Angoli', 'Angoli', 'Angoli', '-'])
  await sulGiorno(null)
  ok('«Nessuna attività» sul giorno: la tolgono anche a chi lo seguiva', await etichette(), ['-', '-', '-', 'Sparring', '-', '-', '-', '-'])
  ok('il giorno non ha attività', (await giornoBf()).attivita, undefined)
  await sulGiorno(angoli)
  ok('e da nessuna ad «Angoli»', await etichette(), ['-', '-', '-', 'Sparring', 'Angoli', 'Angoli', 'Angoli', '-'])
  await s.rigenera()
  ok('RIGENERA non cambia le attività', await etichette(), ['-', '-', '-', 'Sparring', 'Angoli', 'Angoli', 'Angoli', '-'])

  // Un giorno nuovo con la sua attività: le lezioni nascono con quella.
  await s.aggiungiRicorrenza('pre-pugilistica', { giorno: 6, ora: '10:00', durata: 60, attivitaId: sacco })
  const sabato = (await s.settimana(...giorno([9, 3]))).find((x) => x.corsoId === 'pre-pugilistica')
  ok('il giorno nuovo con «Sacco»: la sua lezione nasce con «Sacco»', sabato?.attivita, 'Sacco')
  await s.togliRicorrenza((await s.corsi()).find((c) => c.id === 'pre-pugilistica').ricorrenze.find((r) => r.giorno === 6).id)

  // Una lezione sola.
  const l14 = await bf([9, 14])
  await s.aggiornaLezione(l14.id, { attivitaId: sacco })
  ok('un\'altra attività a una lezione: cambia solo quella', await etichette(), ['-', '-', '-', 'Sparring', 'Sacco', 'Angoli', 'Angoli', '-'])
  ok('ed è cambiata a mano', (await bf([9, 14])).attivitaCambiata, true)
  await s.aggiornaLezione(l14.id, { attivitaId: null })
  await sulGiorno(sacco)
  ok('«Nessuna attività» a una lezione: il giorno dopo non la segue', await etichette(), ['-', '-', '-', 'Sparring', '-', 'Sacco', 'Sacco', '-'])
  ok('è ancora cambiata a mano', (await bf([9, 14])).attivitaCambiata, true)
  await s.attivitaComeIlGiorno(l14.id)
  ok('«Come il giorno»: prende quella del giorno', [(await bf([9, 14])).attivita, (await bf([9, 14])).attivitaCambiata], ['Sacco', false])
  await sulGiorno(angoli)
  ok('e torna a seguirlo', await etichette(), ['-', '-', '-', 'Sparring', 'Angoli', 'Angoli', 'Angoli', '-'])
  await sulGiorno(sacco)

  // Una straordinaria.
  await s.straordinaria('pre-pugilistica', new Date(2026, 9, 3, 10, 0), 60)
  const extra = (await s.settimana(...giorno([9, 3]))).find((x) => x.corsoId === 'pre-pugilistica' && x.straordinaria)
  await s.aggiornaLezione(extra.id, { attivitaId: sparring })
  const extraDopo = async () => (await s.settimana(...giorno([9, 3]))).find((x) => x.id === extra.id)
  ok('la straordinaria ha la sua attività, e non è mai cambiata a mano', [(await extraDopo()).attivita, (await extraDopo()).attivitaCambiata], ['Sparring', false])
  await sulGiorno(angoli)
  await sulGiorno(sacco)
  ok('il giorno cambia e lei no', (await extraDopo()).attivita, 'Sparring')
  await s.togliLezione(extra.id)

  // Annullata.
  await s.aggiornaLezione((await bf([9, 21])).id, { stato: 'annullata' })
  ok('annullata, tiene l\'attività', (await bf([9, 21])).attivita, 'Sacco')
  await s.aggiornaLezione((await bf([9, 21])).id, { stato: 'prevista' })

  // Rinominare: una riga, e il nome nuovo si vede ovunque, anche sulle passate.
  await s.aggiornaLezione((await bf([8, 23])).id, { attivitaId: sacco })
  ok('rinominare tiene la stessa voce', await s.salvaAttivita({ id: sacco, nome: 'Sacco pesante' }), sacco)
  ok('una riga sola nell\'elenco', await nomiElenco(), ['Angoli', 'Sacco pesante', 'Sparring'])
  ok('sul giorno, sulle future e sulla passata', [(await giornoBf()).attivita, await etichette()],
    ['Sacco pesante', ['-', 'Sacco pesante', '-', 'Sparring', 'Sacco pesante', 'Sacco pesante', 'Sacco pesante', '-']])
  await s.salvaAttivita({ id: sacco, nome: 'Sacco' })

  // Eliminare.
  const sua = (await elenco()).find((a) => a.id === sacco)
  ok('«Sacco» è su un giorno e su delle lezioni', [sua.giorni, sua.lezioni > 0], [1, true])
  ok('«Sacco»: bloccata, e il motivo dice quanti', await errore(() => s.eliminaAttivita(sacco)), lib.motivoAttivitaUsata(sua.giorni, sua.lezioni))
  await s.aggiornaLezione((await bf([8, 16])).id, { attivitaId: angoli })
  await sulGiorno(sacco)
  const suaAngoli = (await elenco()).find((a) => a.id === angoli)
  ok('«Angoli» è solo su lezioni passate: bloccata lo stesso', [suaAngoli.giorni, (await errore(() => s.eliminaAttivita(angoli))).startsWith('È su ')], [0, true])
  const libera = await s.salvaAttivita({ nome: 'Libera' })
  await s.eliminaAttivita(libera)
  ok('una mai usata sì', await nomiElenco(), ['Angoli', 'Sacco', 'Sparring'])
  ok('i rifiuti non hanno toccato niente', [(await giornoBf()).attivita, (await bf([9, 14])).attivita], ['Sacco', 'Sacco'])

  // Non più in uso.
  await s.attivaAttivita(sacco, false)
  ok('fuori uso resta nell\'elenco della segreteria', (await elenco()).find((a) => a.id === sacco).attiva, false)
  ok('ma non nei menu', lib.attivitaPerMenu(await elenco()).map((a) => a.nome), ['Angoli', 'Sparring'])
  ok('e non nell\'elenco dell\'istruttore', (await app.attivita()).map((a) => a.nome), ['Angoli', 'Sparring'])
  ok('sul giorno e sulle lezioni resta', [(await giornoBf()).attivita, (await bf([9, 14])).attivita], ['Sacco', 'Sacco'])
  await s.attivaAttivita(sacco, true)
  ok('si rimette con un tocco', lib.attivitaPerMenu(await elenco()).map((a) => a.nome), ['Angoli', 'Sacco', 'Sparring'])

  // L'istruttore: sceglie per le sue lezioni, mai per quelle di un altro, e l'elenco non lo scrive.
  window.location.pathname = '/istruttori/'
  const judo = async () => (await app.calendario(...giorno([9, 7]))).find((x) => x.corsoId === 'judo-2')
  ok('l\'istruttore vede l\'elenco in uso, in ordine', (await app.attivita()).map((a) => a.nome), ['Angoli', 'Sacco', 'Sparring'])
  await app.cambiaAttivita((await judo()).id, sparring)
  ok('cambia l\'attività di una sua lezione', (await judo()).attivita, 'Sparring')
  ok('e la segreteria la vede cambiata a mano', await (async () => {
    const x = (await s.settimana(...giorno([9, 7]))).find((y) => y.corsoId === 'judo-2')
    return [x.attivita, x.attivitaCambiata]
  })(), ['Sparring', true])
  await app.cambiaAttivita((await judo()).id, null)
  ok('anche «Nessuna attività»', (await judo()).attivita, undefined)
  const altrui = (await app.calendario(...giorno([9, 14]))).find((x) => x.corsoId === 'pre-pugilistica')
  ok('quella di un altro no', eMessaggio(await errore(() => app.cambiaAttivita(altrui.id, sparring))), true)
  ok('e non è cambiata', (await app.calendario(...giorno([9, 14]))).find((x) => x.corsoId === 'pre-pugilistica').attivita, 'Sacco')
  // Come la policy sessioni_aggiorna: chi la fa (il sostituto) o chi insegna il corso, anche se c'è un sostituto.
  await s.aggiornaLezione((await judo()).id, { sostitutoId: 'i-fabio' })
  await app.cambiaAttivita((await judo()).id, sparring)
  ok('il titolare del corso cambia l\'attività anche con un sostituto', (await judo()).attivita, 'Sparring')
  await s.aggiornaLezione((await judo()).id, { sostitutoId: null })
  await app.cambiaAttivita((await judo()).id, null)
  await s.aggiornaLezione(altrui.id, { sostitutoId: 'i-maurizio' })
  await app.cambiaAttivita(altrui.id, sparring)
  ok('il sostituto cambia quella della lezione che fa', (await app.calendario(...giorno([9, 14]))).find((x) => x.corsoId === 'pre-pugilistica').attivita, 'Sparring')
  await s.aggiornaLezione(altrui.id, { sostitutoId: null })
  await s.aggiornaLezione(altrui.id, { attivitaId: sacco })
  ok('un\'attività che non c\'è: errore, e non cambia niente', [
    await errore(async () => app.cambiaAttivita((await judo()).id, 'nope')),
    await errore(async () => s.aggiornaLezione((await judo()).id, { attivitaId: 'nope' })),
    (await judo()).attivita,
  ], ['Attività inesistente', 'Attività inesistente', undefined])
  ok('l\'elenco l\'istruttore non lo scrive: non ha come', ['salvaAttivita', 'eliminaAttivita', 'attivaAttivita'].map((k) => typeof app[k]), ['undefined', 'undefined', 'undefined'])
  delete window.location.pathname

  // Un archivio di prova salvato prima di questa funzione: l'elenco parte vuoto, senza errori.
  const vecchio = JSON.stringify(m.archivio.dati, (k, v) => (/attivit/i.test(k) ? undefined : v))
  memoria.set('ods-corsi:prova-archivio', vecchio)
  const m2 = await import('data:text/javascript;base64,' + Buffer.from(outputFiles[0].text + '\n// archivio salvato prima\n').toString('base64'))
  const s2 = m2.creaSegreteriaProva()
  const prova2 = (f) => Promise.resolve().then(f).catch((e) => `ERRORE: ${e.message}`)
  ok('archivio di prima: elenco vuoto', await prova2(() => s2.attivita().then((x) => x.elenco)), [])
  const l2 = (await s2.settimana(...giorno([9, 14]))).find((x) => x.corsoId === 'pre-pugilistica')
  ok('le lezioni si leggono come prima, senza attività', [l2?.corso, l2?.attivita], ['Prepugilistica', undefined])
  await s2.salvaAttivita({ nome: 'Nuova' })
  ok('e si può cominciare a scrivere', (await s2.attivita()).elenco.map((a) => a.nome), ['Nuova'])
  memoria.delete('ods-corsi:prova-archivio')
} catch (e) {
  delete window.location.pathname
  ok('la segreteria di prova fa l’«Attività» senza fermarsi', e.message, 'nessun errore')
}

console.log('\nl’«Attività» con un database senza 41-attivita.sql: la segreteria e gli istruttori leggono come prima')
{
  const risposta = (r) => {
    const c = new Proxy(() => c, { get: (_, k) => (k === 'range' ? (da) => (da ? oltre : c) : k === 'then' ? (f, ko) => Promise.resolve(r).then(f, ko) : () => c), apply: () => c })
    return c
  }
  const senzaRpc = async () => ({ data: null, error: { code: 'PGRST202', message: 'Could not find the function' } })
  // Come risponde Postgres/PostgREST quando manca la colonna, la tabella, o il legame fra le due.
  const MANCANZE = [
    ['42703', 'column sessioni.attivita_id does not exist'],
    ['PGRST200', "Could not find a relationship between 'sessioni' and 'attivita' in the schema cache"],
    ['PGRST205', "Could not find the table 'public.attivita' in the schema cache"],
    ['42P01', 'relation "attivita" does not exist'],
  ]
  const IN = new Date(2026, 9, 14, 12, 0)
  const prova = (f) => Promise.resolve().then(f).catch((e) => `ERRORE: ${e.message}`)

  // Segreteria.
  for (const [codice, messaggio] of MANCANZE) {
    const guaio = { data: null, error: { code: codice, message: messaggio } }
    const riga = {
      id: 'x1', corso_id: 'c1', ricorrenza_id: 'r1', inizio: '2026-10-14T16:00:00.000Z', fine: '2026-10-14T17:00:00.000Z', stato: 'prevista', sala_id: null, istruttore_id: null,
      corsi: { nome: 'Body functional', colore: null, capienza: null, sala_id: null, istruttore_id: null }, sale: null, persone: null,
    }
    const corso = { id: 'c1', nome: 'Body functional', colore: null, capienza: null, attivo: true, sala_id: null, istruttore_id: null, sale: null, ricorrenze: [{ id: 'r1', giorno: 3, ora: '18:00', durata_min: 60, dal: '2026-09-14', al: null, sala_id: null, sale: null }] }
    const scritto = []
    const vero = m.creaSegreteriaSupabase({
      auth: { getSession: async () => ({ data: { session: null } }) },
      from: (t) => ({
        select: (cols) => {
          if (t === 'attivita' || /attivita/.test(cols ?? '')) return risposta(guaio)
          if (t === 'sessioni') return risposta({ data: cols.includes('ricorrenza_id') ? [riga] : { corsi: { sala_id: null, istruttore_id: null }, ricorrenze: { sala_id: null } }, error: null })
          if (t === 'corsi') return risposta({ data: [corso], error: null })
          return risposta({ data: [], error: null })
        },
        insert: () => risposta(t === 'attivita' ? guaio : { data: null, error: null }),
        update: (v) => {
          scritto.push([t, Object.keys(v).join()])
          return risposta(/attivita/.test(Object.keys(v).join()) ? { data: null, error: { code: 'PGRST204', message: "Could not find the 'attivita_id' column of 'sessioni' in the schema cache" } } : { data: null, error: null })
        },
        delete: () => risposta(guaio),
      }),
      rpc: senzaRpc,
    })
    const cosa = `senza 41-attivita.sql (${codice})`
    const lez = await prova(() => vero.settimana(IN, IN))
    ok(`${cosa}: le lezioni si leggono come oggi, senza attività`, Array.isArray(lez) ? [lez.length, lez[0].corso, lez[0].attivita] : lez, [1, 'Body functional', undefined])
    const corsi = await prova(() => vero.corsi())
    ok(`${cosa}: i corsi pure, coi giorni`, Array.isArray(corsi) ? [corsi.length, corsi[0].ricorrenze.length, corsi[0].ricorrenze[0].attivita] : corsi, [1, 1, undefined])
    const att = await prova(() => vero.attivita())
    ok(`${cosa}: la segreteria vede l'avviso, e l'elenco vuoto`, att && typeof att === 'object' ? [att.elenco, String(att.manca).includes('41-attivita.sql')] : att, [[], true])
    ok(`${cosa}: scrivere un'attività dice quale file lanciare`, (await errore(() => vero.salvaAttivita({ nome: 'Sacco' }))).includes('41-attivita.sql'), true)
    ok(`${cosa}: scegliere un'attività per una lezione dice quale file lanciare`, (await errore(() => vero.aggiornaLezione('x1', { attivitaId: 'a1' }))).includes('41-attivita.sql'), true)
    ok(`${cosa}: cambiare la sala di una lezione funziona come prima`, await errore(() => vero.aggiornaLezione('x1', { salaId: 'sala-1' })), 'nessun errore')
    ok(`${cosa}: e nella scrittura non c'è l'attività`, scritto.filter(([, k]) => /attivita/.test(k) && k !== 'attivita_id').length, 0)
  }

  // L'app: calendario e appello, con le due colonne facoltative (kanji e attività) che non si mascherano.
  const riga = (conKanji, conAttivita) => ({
    id: 'x1', corso_id: 'c1', inizio: '2026-10-14T16:00:00.000Z', fine: '2026-10-14T17:00:00.000Z', stato: 'prevista', note: null, istruttore_id: 'p1',
    corsi: { nome: 'Body functional', colore: null, capienza: null, istruttore_id: 'p1', corsi_istruttori: [] },
    sale: { nome: 'Motricità' },
    persone: { nome: 'Tiziano', cognome: 'Tre', ...(conKanji ? { kanji: '虎' } : {}) },
    ...(conAttivita ? { attivita: { nome: 'Sacco' } } : {}),
  })
  const appDi = (conKanji, conAttivita, [codice, messaggio] = MANCANZE[0]) => {
    const letture = []
    const db = {
      from: (t) => ({
        select: (cols) => {
          if (t !== 'sessioni') return risposta({ data: [], error: null })
          letture.push(cols)
          if (!conAttivita && /attivita/.test(cols)) return risposta({ data: null, error: { code: codice, message: messaggio } })
          if (!conKanji && /kanji/.test(cols)) return risposta({ data: null, error: { code: '42703', message: 'column persone_1.kanji does not exist' } })
          // `calendario` aspetta una lista, `dettaglio` chiama `.single()` e aspetta la riga.
          const c = new Proxy(() => c, {
            get: (_, k) =>
              k === 'range' ? (da) => (da ? oltre : c) : k === 'then' ? (f, ko) => Promise.resolve({ data: [riga(conKanji, conAttivita)], error: null }).then(f, ko)
              : k === 'single' ? () => risposta({ data: riga(conKanji, conAttivita), error: null })
              : () => c,
            apply: () => c,
          })
          return c
        },
      }),
      rpc: senzaRpc,
    }
    return { dati: m.creaDatiSupabase(db), letture }
  }
  const vista = async (conKanji, conAttivita, mancanza) => {
    const { dati } = appDi(conKanji, conAttivita, mancanza)
    const [x] = await dati.calendario(IN, IN)
    return [x.corso, x.kanji, x.attivita]
  }
  const dettaglio = async (conKanji, conAttivita) => {
    const { dati } = appDi(conKanji, conAttivita)
    const d = await dati.dettaglio('x1')
    return [d.sessione.kanji, d.sessione.attivita]
  }
  ok('database completo: kanji e attività', await prova(() => vista(true, true)), ['Body functional', '虎', 'Sacco'])
  for (const mancanza of MANCANZE) {
    ok(`senza attività (${mancanza[0]}): le lezioni come oggi, il kanji resta`, await prova(() => vista(true, false, mancanza)), ['Body functional', '虎', undefined])
  }
  ok('senza kanji: l\'attività resta', await prova(() => vista(false, true)), ['Body functional', undefined, 'Sacco'])
  ok('senza né l\'uno né l\'altra: le lezioni come oggi', await prova(() => vista(false, false)), ['Body functional', undefined, undefined])
  ok('l\'appello: completo', await prova(() => dettaglio(true, true)), ['虎', 'Sacco'])
  ok('l\'appello senza attività: il kanji resta', await prova(() => dettaglio(true, false)), ['虎', undefined])
  ok('l\'appello senza kanji: l\'attività resta', await prova(() => dettaglio(false, true)), [undefined, 'Sacco'])
  ok('l\'appello senza né l\'uno né l\'altra', await prova(() => dettaglio(false, false)), [undefined, undefined])
}

// Le discipline: la segreteria le cura, il catalogo le tiene, il tablet le riceve.
{
  const nomi = (l) => l.map((d) => d.id)
  ok('di partenza: judo, lotta, pilates, yoga e le ex categorie degli esercizi', nomi(await s.discipline()), ['judo', 'lotta', 'pilates', 'yoga', 'corpo-libero', 'attrezzi', 'core', 'cardio', 'mobilita'])
  await s.salvaDiscipline([...(await s.discipline()), { id: 'karate', nome: 'Karate' }])
  // Un solo campo per esercizio: la disciplina (la «categoria» per chi usa l'app). Le vecchie categorie sono voci della lista.
  await s.salvaEserciziPalestra([
    { id: 'e1', nome: 'Kata', categoria: 'A corpo libero', disciplina: 'karate' },
    { id: 'e2', nome: 'Squat', categoria: 'Core', disciplina: 'tutte' },
    { id: 'e3', nome: 'Plank', categoria: 'Core', disciplina: 'inventata' },
    { id: 'e4', nome: 'Randori', categoria: 'Judo' },
    { id: 'e5', nome: 'Burpee', categoria: 'A corpo libero' },
    { id: 'e6', nome: 'Libero' },
    { id: 'e7', nome: 'Uchi komi', categoria: 'A corpo libero', disciplina: 'judo' },
  ])
  const cat = await s.eserciziPalestra()
  ok('il catalogo tiene la disciplina nuova e «tutte», toglie quella inventata; la vecchia categoria diventa la voce; una sola voce per esercizio',
    cat.map((e) => [e.nome, e.disciplina, 'categoria' in e]),
    [['Kata', 'karate', false], ['Squat', 'tutte', false], ['Plank', undefined, false], ['Randori', 'judo', false], ['Burpee', 'corpo-libero', false], ['Libero', undefined, false], ['Uchi komi', 'judo', false]])
  ok('in modalità prova l\'archivio salva solo id, nome e voce: niente categoria',
    JSON.parse(localStorage.getItem('ods-corsi:prova-archivio')).eserciziSale,
    [{ id: 'e1', nome: 'Kata', disciplina: 'karate' }, { id: 'e2', nome: 'Squat', disciplina: 'tutte' }, { id: 'e3', nome: 'Plank' }, { id: 'e4', nome: 'Randori', disciplina: 'judo' }, { id: 'e5', nome: 'Burpee', disciplina: 'corpo-libero' }, { id: 'e6', nome: 'Libero' }, { id: 'e7', nome: 'Uchi komi', disciplina: 'judo' }])
  ok('le ex categorie sono voci della lista di partenza, accanto a judo, lotta, pilates, yoga',
    nomi(await s.discipline()).slice(4, 9), ['corpo-libero', 'attrezzi', 'core', 'cardio', 'mobilita'])
  ok('«Tutte» non compare tra le voci', nomi(await s.discipline()).includes('tutte'), false)
  // Rinominare un esercizio: l'id resta, la voce resta, e la clip incisa (chiave dal nome) è quella del nome nuovo.
  await s.salvaEserciziPalestra(cat.map((e) => (e.id === 'e5' ? { ...e, nome: 'Burpee + salto' } : e)))
  ok('rinominato: la voce resta e non spunta una categoria', (await s.eserciziPalestra()).filter((e) => e.id === 'e5').map((e) => [e.nome, e.disciplina, 'categoria' in e]), [['Burpee + salto', 'corpo-libero', false]])
  // Togliere una voce dall'elenco non rompe né toglie gli esercizi che la usavano.
  await s.salvaDiscipline((await s.discipline()).filter((x) => x.id !== 'corpo-libero'))
  ok('tolta una voce dall\'elenco: l\'esercizio resta, senza voce', (await s.eserciziPalestra()).filter((e) => e.id === 'e5').map((e) => [e.nome, e.disciplina]), [['Burpee + salto', undefined]])
  await s.salvaDiscipline([...(await s.discipline()), { id: 'corpo-libero', nome: 'A corpo libero' }])
  await s.salvaEserciziPalestra([
    { id: 'e1', nome: 'Kata', categoria: 'A corpo libero', disciplina: 'karate' },
    { id: 'e2', nome: 'Squat', categoria: 'Core', disciplina: 'tutte' },
    { id: 'e3', nome: 'Plank', categoria: 'Core', disciplina: 'inventata' },
    { id: 'e4', nome: 'Randori', categoria: 'Judo' },
  ])
  const sala = await m.creaTabletProva().timerSala()
  ok('il tablet riceve la lista e il catalogo con le discipline, senza categoria', [nomi(sala.discipline).includes('karate'), sala.esercizi.find((e) => e.nome === 'Kata')?.disciplina, sala.esercizi.some((e) => 'categoria' in e)], [true, 'karate', false])
  await s.salvaDiscipline((await s.discipline()).filter((d) => d.id !== 'karate'))
  ok('tolta la disciplina, l\'esercizio resta senza', (await s.eserciziPalestra()).find((e) => e.nome === 'Kata')?.disciplina, undefined)
  ok('e la lista non ha più karate', nomi(await s.discipline()).includes('karate'), false)
  await s.salvaEserciziPalestra([])
}

// Il catalogo sul database vero: si scrivono id, nome e voce, mai la categoria; si legge anche quello di prima.
{
  const scritti = []
  const db = {
    from: () => ({
      select: () => ({ maybeSingle: async () => ({ data: { discipline: [{ id: 'judo', nome: 'Judo' }, { id: 'core', nome: 'Core' }], esercizi: [{ id: 'a', nome: 'Squat', categoria: 'Core' }, { id: 'b', nome: 'Randori', categoria: 'A corpo libero', disciplina: 'judo' }, { id: 'c', nome: 'Ukemi', categoria: 'Judo' }] }, error: null }) }),
      update: (riga) => ({ eq: async () => (scritti.push(riga), { data: null, error: null }) }),
    }),
  }
  const v = m.creaSegreteriaSupabase(db)
  ok('database: un catalogo di prima si legge, con una voce sola', (await v.eserciziPalestra()).map((e) => [e.nome, e.disciplina, 'categoria' in e]), [['Squat', 'core', false], ['Randori', 'judo', false], ['Ukemi', 'judo', false]])
  await v.salvaEserciziPalestra([{ id: 'a', nome: 'Squat', categoria: 'Core' }, { id: 'b', nome: 'Libero' }, { id: 'c', nome: 'Randori', categoria: 'A corpo libero', disciplina: 'judo' }])
  ok('database: salvando, il JSON non ha la categoria', scritti, [{ esercizi: [{ id: 'a', nome: 'Squat', disciplina: 'core' }, { id: 'b', nome: 'Libero' }, { id: 'c', nome: 'Randori', disciplina: 'judo' }] }])
}

// Le liste di musica per disciplina: la segreteria la sceglie, il tablet la riceve.
{
  const sala = 'Lotta'
  const id1 = await s.salvaListaMusica({ nome: 'Randori (disc.)', link: 'https://www.youtube.com/playlist?list=PLx0sYbCqOb8TBPRdmBHs5Iftvv9TPbo1Z', salaId: sala, disciplina: 'judo' })
  const id2 = await s.salvaListaMusica({ nome: 'Riscaldamento (disc.)', link: 'https://www.youtube.com/playlist?list=PLx0sYbCqOb8TBPRdmBHs5Iftvv9TPbo2Z', salaId: null, disciplina: 'tutte' })
  const id3 = await s.salvaListaMusica({ nome: 'Varie (disc.)', link: 'https://www.youtube.com/playlist?list=PLx0sYbCqOb8TBPRdmBHs5Iftvv9TPbo3Z', salaId: null, disciplina: 'inventata' })
  const id4 = await s.salvaListaMusica({ nome: 'Senza (disc.)', link: 'https://www.youtube.com/playlist?list=PLx0sYbCqOb8TBPRdmBHs5Iftvv9TPbo4Z', salaId: null })
  const liste = await s.listeMusica()
  const di = (id) => liste.find((l) => l.id === id)?.disciplina
  ok('la lista tiene la disciplina scelta, «tutte», e toglie una inventata', [di(id1), di(id2), di(id3), di(id4)], ['judo', 'tutte', undefined, undefined])
  await s.salvaListaMusica({ id: id1, nome: 'Randori (disc.)', link: 'https://www.youtube.com/playlist?list=PLx0sYbCqOb8TBPRdmBHs5Iftvv9TPbo1Z', salaId: sala, disciplina: null })
  ok('cambiandola in «nessuna» la disciplina si toglie', (await s.listeMusica()).find((l) => l.id === id1)?.disciplina, undefined)
  await s.salvaListaMusica({ id: id1, nome: 'Randori (disc.)', link: 'https://www.youtube.com/playlist?list=PLx0sYbCqOb8TBPRdmBHs5Iftvv9TPbo1Z', salaId: sala, disciplina: 'lotta' })
  const t = m.creaTabletProva()
  await t.scegliSala(sala)
  const tablet = await t.musica()
  ok('il tablet della sala riceve la disciplina delle sue liste e di quelle di tutte', tablet.filter((l) => l.nome.endsWith('(disc.)')).map((l) => [l.nome, l.disciplina]).sort(),
    [['Randori (disc.)', 'lotta'], ['Riscaldamento (disc.)', 'tutte'], ['Senza (disc.)', undefined], ['Varie (disc.)', undefined]])
  for (const id of [id1, id2, id3, id4]) await s.togliListaMusica(id)
}

// Il ramo Supabase delle liste di musica, con un database finto: senza 40-discipline.sql la colonna non c'è.
{
  const righe = [{ id: 'l1', nome: 'Randori', link: 'https://youtu.be/dQw4w9WgXcQ', sala_id: null, disciplina: 'judo' }, { id: 'l2', nome: 'Varie', link: 'https://youtu.be/dQw4w9WgXcQ', sala_id: null, disciplina: 'karate' }]
  const chiamate = []
  const finto = ({ colonna }) => ({
    from: (tab) => ({
      select: (cols) => {
        chiamate.push(`${tab}:${cols}`)
        const risposta = () => {
          if (tab === 'impostazioni') return { data: { discipline: [{ id: 'judo', nome: 'Judo' }] }, error: null }
          if (cols.includes('disciplina') && !colonna) return { data: null, error: { code: '42703', message: 'column musica_sale.disciplina does not exist' } }
          return { data: righe.map(({ disciplina, ...r }) => (cols.includes('disciplina') ? { ...r, disciplina } : r)), error: null }
        }
        const q = { order: () => q, maybeSingle: async () => risposta(), then: (ok, no) => Promise.resolve(risposta()).then(ok, no) }
        return q
      },
    }),
  })
  const con = await m.creaSegreteriaSupabase(finto({ colonna: true })).listeMusica()
  ok('con la colonna: la disciplina c\'è, una sconosciuta no', con.map((l) => [l.nome, l.disciplina]), [['Randori', 'judo'], ['Varie', undefined]])
  const senza = await m.creaSegreteriaSupabase(finto({ colonna: false })).listeMusica()
  ok('senza la colonna (42703): si leggono lo stesso, senza disciplina', senza.map((l) => [l.nome, l.disciplina]), [['Randori', undefined], ['Varie', undefined]])
  // Scrivere: il finto database risponde PGRST204 (colonna sconosciuta) se la riga porta `disciplina` e la colonna non c'è.
  const scrive = (colonna, scritti) => ({
    from: (tab) => {
      if (tab === 'impostazioni') return { select: () => ({ maybeSingle: async () => ({ data: { discipline: [{ id: 'judo', nome: 'Judo' }] }, error: null }) }) }
      const esito = (riga) => {
        scritti.push(riga)
        return 'disciplina' in riga && !colonna ? { data: null, error: { code: 'PGRST204', message: "Could not find the 'disciplina' column of 'musica_sale' in the schema cache" } } : { data: { id: 'nuova' }, error: null }
      }
      return {
        insert: (riga) => ({ select: () => ({ single: async () => esito(riga) }) }),
        update: (riga) => ({ eq: async () => esito(riga) }),
      }
    },
  })
  const yt = 'https://youtu.be/dQw4w9WgXcQ'
  {
    const scritti = []
    await m.creaSegreteriaSupabase(scrive(false, scritti)).salvaListaMusica({ id: 'l1', nome: 'Randori', link: yt, salaId: null })
    ok('senza la colonna, una lista si salva se la disciplina non c\'entra', scritti.map((r) => 'disciplina' in r), [false])
  }
  {
    const scritti = []
    const e = await errore(() => m.creaSegreteriaSupabase(scrive(false, scritti)).salvaListaMusica({ id: 'l1', nome: 'Randori', link: yt, salaId: null, disciplina: 'judo' }))
    ok('senza la colonna, scegliere una disciplina dice di lanciare il 40', e, 'Le discipline non sono ancora attive sul database: va lanciato 40-discipline.sql')
  }
  {
    const scritti = []
    await m.creaSegreteriaSupabase(scrive(true, scritti)).salvaListaMusica({ id: 'l1', nome: 'Randori', link: yt, salaId: null, disciplina: null })
    ok('con la colonna, nulla toglie la disciplina (null nella riga)', scritti.map((r) => r.disciplina), [null])
  }
}

// Le liste della musica nel timer dell'app istruttori: TUTTE quelle della
// segreteria (il telefono non sta in una sala), col filtro per categoria.
// `errore` dà solo il messaggio: qui serve il valore, o l'errore se c'è.
const valore = async (f) => { try { return await f() } catch (e) { return `ERRORE: ${e.message}` } }
{
  const yt = (n) => `https://www.youtube.com/playlist?list=PLx0sYbCqOb8TBPRdmBHs5Iftvv9TPbo${n}Z`
  const id1 = await s.salvaListaMusica({ nome: 'Randori (tel.)', link: yt(1), salaId: 'Lotta', disciplina: 'judo' })
  const id2 = await s.salvaListaMusica({ nome: 'Bambini (tel.)', link: yt(2), salaId: 'Tatami' })
  const id3 = await s.salvaListaMusica({ nome: 'Riscaldamento (tel.)', link: yt(3), salaId: null, disciplina: 'tutte' })
  const prima = JSON.stringify(m.archivio.dati)
  const liste = await valore(async () => (await app.listeMusica()).filter((l) => l.nome.endsWith('(tel.)')))
  const nomi = (x) => (Array.isArray(x) ? x.map((l) => l.nome).sort() : x)
  ok('prova: il telefono vede le liste di tutte le sale, come la segreteria', nomi(liste), ['Bambini (tel.)', 'Randori (tel.)', 'Riscaldamento (tel.)'])
  ok('prova: ogni lista ha sala e categoria', Array.isArray(liste) ? liste.map((l) => [l.nome, l.salaId, l.disciplina]).sort() : liste,
    [['Bambini (tel.)', 'Tatami', undefined], ['Randori (tel.)', 'Lotta', 'judo'], ['Riscaldamento (tel.)', null, 'tutte']])
  ok('prova: il filtro per categoria, come sul tablet', Array.isArray(liste) ? nomi(m.dellaDisciplina(liste, 'judo')) : liste, ['Randori (tel.)', 'Riscaldamento (tel.)'])
  ok('prova: leggere le liste non cambia l\'archivio', JSON.stringify(m.archivio.dati) === prima, true)
  // Una categoria tolta dalla segreteria: il database la ripulisce, la prova deve fare lo stesso.
  const tolta = m.archivio.dati.musica.find((l) => l.nome === 'Bambini (tel.)')
  tolta.disciplina = 'karate'
  const conTolta = await valore(async () => (await app.listeMusica()).find((l) => l.nome === 'Bambini (tel.)')?.disciplina)
  ok('prova: una categoria che non c\'è più si toglie, come col database', conTolta, undefined)
  for (const id of [id1, id2, id3]) await s.togliListaMusica(id)
}

// Lo stesso col database, finto: la tabella o la colonna disciplina possono mancare.
{
  const righe = [{ id: 'l1', nome: 'Randori', link: 'https://youtu.be/dQw4w9WgXcQ', sala_id: 'Lotta', disciplina: 'judo' }, { id: 'l2', nome: 'Varie', link: 'https://youtu.be/dQw4w9WgXcQ', sala_id: null, disciplina: null }, { id: 'l3', nome: 'Vecchia', link: 'https://youtu.be/dQw4w9WgXcQ', sala_id: null, disciplina: 'karate' }]
  const scritture = []
  const finto = ({ tabella, colonna, codice = '42P01' }) => {
    const risposta = (tab, cols) => {
      if (tab === 'impostazioni') return { data: { discipline: [{ id: 'judo', nome: 'Judo' }] }, error: null }
      if (tab !== 'musica_sale') return { data: [], error: null }
      if (!tabella) return { data: null, error: { code: codice, message: 'relation "musica_sale" does not exist' } }
      if (/disciplina/.test(cols) && !colonna) return { data: null, error: { code: '42703', message: 'column musica_sale.disciplina does not exist' } }
      return { data: righe.map(({ disciplina, ...r }) => (/disciplina/.test(cols) ? { ...r, disciplina } : r)), error: null }
    }
    const catena = (tab, cols) => {
      const c = new Proxy(() => c, {
        get: (_, k) =>
          k === 'range' ? (da) => (da ? oltre : c) : k === 'then' ? (f, ko) => Promise.resolve(risposta(tab, cols)).then(f, ko)
          : k === 'single' || k === 'maybeSingle' ? async () => risposta(tab, cols)
          : () => c,
        apply: () => c,
      })
      return c
    }
    const scrive = (tab) => () => { scritture.push(tab); return catena(tab, '') }
    return {
      from: (tab) => ({ select: (cols = '*') => catena(tab, cols), insert: scrive(tab), update: scrive(tab), upsert: scrive(tab), delete: scrive(tab) }),
      rpc: async (nome) => (nome === 'musica_sala' ? { data: null, error: { code: '42501', message: 'solo il tablet' } } : { data: null, error: null }),
    }
  }
  const leggi = async (o) => {
    return valore(async () => (await m.creaDatiSupabase(finto(o)).listeMusica()).map((l) => [l.nome, l.salaId, l.disciplina]))
  }
  ok('database: tutte le liste, con sala e categoria; una categoria tolta sparisce', await leggi({ tabella: true, colonna: true }), [['Randori', 'Lotta', 'judo'], ['Varie', null, undefined], ['Vecchia', null, undefined]])
  ok('database senza la colonna disciplina (42703): le liste, senza categoria', await leggi({ tabella: true, colonna: false }), [['Randori', 'Lotta', undefined], ['Varie', null, undefined], ['Vecchia', null, undefined]])
  ok('database senza la tabella (42P01): nessuna lista, nessun errore', await leggi({ tabella: false, codice: '42P01' }), [])
  ok('database senza la tabella (PGRST205): nessuna lista, nessun errore', await leggi({ tabella: false, codice: 'PGRST205' }), [])
  ok('database: leggere le liste non scrive niente', scritture, [])
}

console.log('\nsotto i 6 anni il certificato non serve')
{
  const L = m.segreteriaLib
  const oggi = '2026-09-26'
  // Una funzione che manca fa fallire il caso, non tutta la prova.
  const vedi = (f) => { try { return f() } catch (e) { return `ERRORE: ${e.message}` } }
  const quota = { numero: 1, anno: 2026, dal: '2026-09-01', al: '2027-08-31', mancano: 0 }
  const persona = (natoIl, certificato = { conFile: false }, extra = {}) => ({
    id: 'x', nome: 'Aldo', cognome: 'Rossi', attiva: true, creataIl: '2026-01-01', iscrizioni: [], documento: true,
    pagamento: { stato: 'da_pagare' }, quote: [quota], natoIl, certificato, ...extra,
  })
  const cinque = '2021-03-10'
  const parole = (p) => L.paroleInRegola(p, oggi)

  // La regola sola, per età.
  ok('5 anni: non serve', vedi(() => L.serveCertificato(cinque, oggi)), 'non_serve')
  ok('compie 6 anni oggi: serve', vedi(() => L.serveCertificato('2020-09-26', oggi)), 'serve')
  ok('compie 6 anni domani: non serve ancora, ma sta per servire', vedi(() => L.serveCertificato('2020-09-27', oggi)), 'in_arrivo')
  ok('fra 30 giorni: in arrivo', vedi(() => L.serveCertificato('2020-10-26', oggi)), 'in_arrivo')
  ok('fra 31 giorni: non serve', vedi(() => L.serveCertificato('2020-10-27', oggi)), 'non_serve')
  ok('senza data di nascita: serve', vedi(() => L.serveCertificato(undefined, oggi)), 'serve')
  ok('adulto: serve', vedi(() => L.serveCertificato('1990-01-01', oggi)), 'serve')
  ok('il giorno dei 6 anni', vedi(() => L.dalCertificato('2020-10-10')), '2026-10-10')

  // Lo stato del certificato, con l'età.
  const stato = (p) => vedi(() => L.statoCertificato(p, oggi))
  ok('5 anni senza certificato: non serve', stato(persona(cinque)), 'non_serve')
  ok('5 anni col certificato scaduto: non serve', stato(persona(cinque, { scade: '2026-01-01', conFile: false })), 'non_serve')
  ok('5 anni, ai 6 mancano 14 giorni, senza certificato: in arrivo', stato(persona('2020-10-10')), 'in_arrivo')
  ok('ai 6 anni mancano 14 giorni, con un certificato già segnato (anche scaduto): non serve, l\'avviso è solo per chi non ce l\'ha', [stato(persona('2020-10-10', { scade: '2026-01-01', conFile: false })), stato(persona('2020-10-10', { scade: '2027-06-01', conFile: false }))], ['non_serve', 'non_serve'])
  ok('6 anni oggi, senza certificato: manca', stato(persona('2020-09-26')), 'manca')
  ok('senza data di nascita, senza certificato: manca', stato(persona(undefined)), 'manca')
  ok('senza data di nascita, scaduto: scaduto', stato(persona(undefined, { scade: '2026-01-01', conFile: false })), 'scaduto')
  ok('adulto col certificato valido: valido', stato(persona('1990-01-01', { scade: '2027-06-01', conFile: false })), 'valido')

  // I filtri e i conteggi di ISCRITTI e DA FARE.
  const senza = (p) => vedi(() => L.senzaCertificatoValido(p, oggi))
  const scad = (p) => vedi(() => L.certificatoInScadenza(p, oggi))
  const arrivo = (p) => vedi(() => L.certificatoInArrivo(p, oggi))
  ok('SENZA CERTIFICATO VALIDO: l\'adulto sì, il bambino di 5 anni no', [senza(persona('1990-01-01')), senza(persona(cinque))], [true, false])
  ok('SENZA CERTIFICATO VALIDO: nemmeno il bambino di 5 anni col certificato scaduto', senza(persona(cinque, { scade: '2026-01-01', conFile: false })), false)
  ok('SENZA CERTIFICATO VALIDO: senza data di nascita sì', senza(persona(undefined)), true)
  ok('SENZA CERTIFICATO VALIDO: chi compie 6 anni oggi sì', senza(persona('2020-09-26')), true)
  ok('SENZA CERTIFICATO VALIDO: chi è disattivato no', senza(persona('1990-01-01', { conFile: false }, { attiva: false })), false)
  ok('CERTIFICATO IN SCADENZA: il bambino di 5 anni col certificato che scade fra una settimana no', scad(persona(cinque, { scade: '2026-10-03', conFile: false })), false)
  ok('CERTIFICATO IN SCADENZA: l\'adulto sì', scad(persona('1990-01-01', { scade: '2026-10-03', conFile: false })), true)
  ok('iscritti che compiono 6 anni senza certificato: chi li compie fra 14 giorni sì', arrivo(persona('2020-10-10')), true)
  ok('iscritti che compiono 6 anni senza certificato: chi li ha compiuti, no', arrivo(persona('2020-09-26')), false)
  ok('iscritti che compiono 6 anni senza certificato: chi ha già il certificato, no', arrivo(persona('2020-10-10', { scade: '2027-06-01', conFile: false })), false)
  ok('iscritti che compiono 6 anni senza certificato: chi è disattivato, no', arrivo(persona('2020-10-10', { conFile: false }, { attiva: false })), false)
  ok('iscritti che compiono 6 anni senza certificato: il bambino di 5 anni lontano dai 6, no', arrivo(persona(cinque)), false)
  // CHI NON È IN REGOLA (dal riquadro delle statistiche): certificato o quota da sistemare, fra chi è attivo.
  const fuori = (p) => vedi(() => L.fuoriRegola(p, oggi))
  ok('CHI NON È IN REGOLA: chi ha certificato e quota a posto no', fuori(persona('1990-01-01', { scade: '2027-06-01', conFile: false })), false)
  ok('CHI NON È IN REGOLA: certificato mancante sì', fuori(persona('1990-01-01')), true)
  ok('CHI NON È IN REGOLA: quota non pagata sì', fuori(persona(cinque, undefined, { quote: [] })), true)
  ok('CHI NON È IN REGOLA: chi è disattivato no', fuori(persona('1990-01-01', { conFile: false }, { attiva: false })), false)

  // La colonna IN REGOLA dell'elenco.
  ok('elenco: 5 anni, quota pagata, senza certificato: in regola e certificato spento', vedi(() => parole(persona(cinque))), [{ tono: 'verde', parola: 'In regola' }, { tono: 'spento', parola: 'Non serve il certificato' }])
  ok('elenco: 5 anni con la quota da pagare: non in regola, il guaio è la quota', vedi(() => parole(persona(cinque, undefined, { quote: [] }))).map((x) => x.parola), ['Da pagare', 'Non serve il certificato'])
  ok('elenco: ai 6 anni mancano 14 giorni: bollino giallo con la data', vedi(() => parole(persona('2020-10-10'))), [{ tono: 'giallo', parola: 'Serve dal 10/10' }])
  ok('elenco: 6 anni oggi: NO CERTIFICATO come oggi', vedi(() => parole(persona('2020-09-26'))), [{ tono: 'rosso', parola: 'Manca il certificato' }])
  ok('elenco: senza data di nascita e senza certificato: NO CERTIFICATO e MANCA LA DATA', vedi(() => parole(persona(undefined))), [{ tono: 'rosso', parola: 'Manca il certificato' }, { tono: 'spento', parola: 'Senza data' }])
  ok('elenco: senza data di nascita ma col certificato valido: niente MANCA LA DATA', vedi(() => parole(persona(undefined, { scade: '2027-06-01', conFile: false })).map((x) => x.parola)), ['In regola'])
  ok('manca la data: solo senza data e senza certificato (la frase della scheda parte da qui)', [persona(undefined), persona(undefined, { scade: '2027-06-01', conFile: false }), persona('2020-09-26')].map((p) => vedi(() => L.mancaLaData(p))), [true, false, false])
  ok('elenco: 5 anni col certificato valido: niente bollino del certificato: è verde come per tutti', vedi(() => parole(persona(cinque, { scade: '2027-06-01', conFile: false }))).map((x) => x.parola), ['In regola'])

  // In regola.
  ok('in regola: 5 anni, quota pagata, niente certificato', vedi(() => L.inRegola(persona(cinque), oggi)), true)
  ok('in regola: 5 anni senza quota no', vedi(() => L.inRegola(persona(cinque, undefined, { quote: [] }), oggi)), false)
  ok('in regola: ai 6 anni mancano 14 giorni, quota pagata: sì, in sala può entrare', vedi(() => L.inRegola(persona('2020-10-10'), oggi)), true)
  ok('in regola: 6 anni oggi senza certificato no', vedi(() => L.inRegola(persona('2020-09-26'), oggi)), false)
  ok('in regola: senza data di nascita e senza certificato no', vedi(() => L.inRegola(persona(undefined), oggi)), false)

  // La scheda.
  const cert = (p) => vedi(() => L.timbriScheda(p, oggi).certificato)
  ok('scheda: 5 anni senza certificato, timbro spento', cert(persona(cinque)), { tono: 'spento', parola: 'NON SERVE', righe: [{ testo: 'SOTTO I 6 ANNI' }], inElenco: 'Non serve il certificato' })
  ok('scheda: 5 anni col certificato valido, la data resta, verde', cert(persona(cinque, { scade: '2027-06-01', conFile: false })), { tono: 'verde', parola: 'VALIDO FINO ALL’1/06/2027', righe: [{ testo: 'NON SERVE SOTTO I 6 ANNI' }] })
  ok('scheda: 5 anni col certificato scaduto, la data resta, spento e non rosso', cert(persona(cinque, { scade: '2026-01-15', conFile: false })), { tono: 'spento', parola: 'SCADUTO IL 15/01/2026', inElenco: 'Certificato scaduto', righe: [{ testo: 'NON SERVE SOTTO I 6 ANNI' }] })
  ok('scheda: ai 6 anni mancano 14 giorni, giallo con la data e i giorni', cert(persona('2020-10-10')), { tono: 'giallo', parola: 'SERVE DAL 10/10/2026', inElenco: 'Serve dal 10/10', righe: [{ testo: 'FRA 14 GIORNI' }] })
  ok('scheda: 6 anni oggi, rosso come oggi', cert(persona('2020-09-26')).parola, 'NO CERTIFICATO')
  ok('scheda: senza data di nascita, rosso e una riga che dice che manca la data', cert(persona(undefined)), { tono: 'rosso', parola: 'NO CERTIFICATO', inElenco: 'Manca il certificato', righe: [{ testo: 'SENZA, IN SALA NON SI ENTRA' }, { testo: 'MANCA LA DATA DI NASCITA' }] })
  ok('scheda: con la data di nascita la riga non c\'è', cert(persona('2020-09-26')).righe, [{ testo: 'SENZA, IN SALA NON SI ENTRA' }])
  ok('scheda: il file non porta più DA STAMPARE, nemmeno sotto i 6 anni', vedi(() => cert(persona(cinque, { scade: '2027-06-01', conFile: true })).righe), [{ testo: 'NON SERVE SOTTO I 6 ANNI' }])
  ok('scheda: chi è disattivato ha il timbro spento, con le stesse parole', vedi(() => { const t = L.timbriScheda(persona(cinque, undefined, { attiva: false }), oggi); return [t.certificato.tono, t.certificato.parola] }), ['spento', 'NON SERVE'])

  // Il tasto grosso della scheda.
  ok('tasto: 5 anni senza certificato, con la quota pagata: quota', vedi(() => L.tastoPrincipale(persona(cinque), oggi)), 'quota')
  ok('tasto: 5 anni senza certificato, senza quota: quota, mai il certificato', vedi(() => L.tastoPrincipale(persona(cinque, undefined, { quote: [] }), oggi)), 'quota')
  ok('tasto: 6 anni oggi senza certificato: certificato', vedi(() => L.tastoPrincipale(persona('2020-09-26'), oggi)), 'certificato')
  ok('tasto: senza data di nascita senza certificato: certificato', vedi(() => L.tastoPrincipale(persona(undefined), oggi)), 'certificato')

  // Il riquadro CERTIFICATO delle statistiche.
  const conta = vedi(() => L.contaCertificati([persona(cinque), persona(cinque, { scade: '2026-01-01', conFile: false }), persona('2020-10-10'), persona(undefined), persona('1990-01-01', { scade: '2027-06-01', conFile: false })], oggi))
  ok('statistiche: i bambini di 5 anni non si contano, né chi sta per compiere 6 anni', conta, { valido: 1, in_scadenza: 0, scaduto: 0, manca: 1 })

  // La data di nascita dalle fonti: la più recente, intera.
  const fonti = (l) => [...L.nascitaDelleFonti(l)]
  ok('nascita: vince la fonte più recente', fonti([
    { personaId: 'a', da: 'modulo', quando: '2026-01-01', natoIl: '2021-03-10' },
    { personaId: 'a', da: 'segreteria', quando: '2026-02-01', natoIl: '2021-04-11' },
  ]), [['a', '2021-04-11']])
  ok('nascita: la scheda più recente senza data non passa la mano alla richiesta', fonti([
    { personaId: 'a', da: 'modulo', quando: '2026-01-01', natoIl: '2021-03-10' },
    { personaId: 'a', da: 'segreteria', quando: '2026-02-01' },
  ]), [])
  ok('nascita: a parità vince la segreteria, in qualunque ordine', [
    fonti([{ personaId: 'a', da: 'segreteria', quando: '2026-02-01', natoIl: '2021-04-11' }, { personaId: 'a', da: 'modulo', quando: '2026-02-01', natoIl: '2021-03-10' }]),
    fonti([{ personaId: 'a', da: 'modulo', quando: '2026-02-01', natoIl: '2021-03-10' }, { personaId: 'a', da: 'segreteria', quando: '2026-02-01', natoIl: '2021-04-11' }]),
  ], [[['a', '2021-04-11']], [['a', '2021-04-11']]])

  // Col database: persone() porta la data; senza le tabelle o col permesso negato, nessun errore e nessuna data.
  const persona1 = { id: 'p1', nome: 'Leo', cognome: 'Conti', email: null, telefono: null, attiva: true, creata_il: '2026-09-01T10:00:00Z', iscrizioni: [], schede_iscritti: null }
  const dbFinto = (tabelle) => m.creaSegreteriaSupabase({
    from: (t) => {
      const c = new Proxy(() => c, { get: (_, k) => (k === 'range' ? (da) => (da ? oltre : c) : k === 'then' ? (fatto) => fatto(tabelle[t] ?? { data: [], error: null }) : () => c), apply: () => c })
      return c
    },
  })
  const dal = async (tabelle) => (await dbFinto({ persone: { data: [persona1], error: null }, ...tabelle }).persone())[0].natoIl
  ok('database: la data della richiesta accolta arriva alla persona', await dal({ richieste_iscrizione: { data: [{ id: 'r1', persona_id: 'p1', nato_il: '2021-03-10', gestita_il: '2026-09-02T10:00:00Z', creata_il: '2026-09-01T10:00:00Z' }], error: null } }), '2021-03-10')
  ok('database: la scheda più recente vince sulla richiesta', await dal({
    richieste_iscrizione: { data: [{ id: 'r1', persona_id: 'p1', nato_il: '2021-03-10', gestita_il: '2026-09-02T10:00:00Z', creata_il: '2026-09-01T10:00:00Z' }], error: null },
    anagrafiche: { data: [{ persona_id: 'p1', nato_il: '2021-04-11', cambiata_il: '2026-09-05T10:00:00Z' }], error: null },
  }), '2021-04-11')
  ok('database: senza le tabelle nessuna data e nessun errore', await dal({ anagrafiche: { data: null, error: { code: '42P01' } }, richieste_iscrizione: { data: null, error: { code: '42P01' } } }), undefined)

  // La modalità prova: la data di nascita arriva a PersonaSeg.
  const tutti = await s.persone()
  const stati = tutti.filter((p) => p.attiva).map((p) => vedi(() => L.statoCertificato(p, oggi)))
  ok('in prova ci sono bambini di 5 anni senza obbligo', stati.filter((x) => x === 'non_serve').length >= 2, true)
  ok('in prova c\'è un iscritto prossimo ai 6 anni', stati.filter((x) => x === 'in_arrivo').length >= 1, true)
  const chi = tutti.find((p) => p.attiva)
  await s.salvaAnagrafica(chi.id, { natoIl: '2021-03-10' })
  ok('la data di nascita della scheda arriva alla persona', (await s.persone()).find((p) => p.id === chi.id).natoIl, '2021-03-10')
  ok('senza data di nascita la persona resta come prima', (await s.persone()).filter((p) => p.id !== chi.id).some((p) => p.natoIl === undefined), true)
}

// Supabase dà al massimo 1000 righe per richiesta, senza errore: il resto si
// perde. Con 1131 presenze in un mese, le lezioni in fondo all'elenco
// risultavano senza appello anche con l'appello fatto (Lotta 3, 9 ottobre).
{
  const MAX = 1000
  const sessione = (id) => ({
    id, corso_id: 'c1', ricorrenza_id: 'r1', inizio: '2026-10-09T16:00:00.000Z', fine: '2026-10-09T17:00:00.000Z', stato: 'prevista', sala_id: null, istruttore_id: null,
    corsi: { nome: 'Lotta 3', colore: null, capienza: null, sala_id: null, istruttore_id: null, corsi_istruttori: [] }, sale: null, persone: null, ricorrenze: null,
  })
  // 1000 segni sulla prima lezione, 131 sulla seconda: una richiesta sola si ferma alla prima.
  const presenze = [
    ...Array.from({ length: 1000 }, (_, i) => ({ sessione_id: 's1', persona_id: `p${i}`, stato: 'presente' })),
    ...Array.from({ length: 131 }, (_, i) => ({ sessione_id: 's2', persona_id: `p${1000 + i}`, stato: 'presente' })),
  ]
  const tabelle = {
    sessioni: [sessione('s1'), sessione('s2')],
    presenze,
    iscrizioni: [{ corso_id: 'c1', persona_id: 'p1130', dal: '2026-01-01', al: null, persone: { nome: 'Ultimo', cognome: 'Segnato', attiva: true } }],
  }
  const db = {
    auth: { getSession: async () => ({ data: { session: null } }) },
    rpc: async () => ({ data: null, error: null }),
    from: (t) => {
      let da = 0
      let a = Infinity
      const c = new Proxy(() => c, {
        get: (_, k) =>
          k === 'then' ? (f, ko) => Promise.resolve({ data: (tabelle[t] ?? []).slice(da, Math.min(a + 1, da + MAX)), error: null }).then(f, ko)
          : k === 'range' ? (x, y) => ((da = x), (a = y), c)
          : () => c,
        apply: () => c,
      })
      return c
    },
  }
  const IN = new Date(2026, 9, 9, 12, 0)
  const seg = m.creaSegreteriaSupabase(db)
  ok('oltre le 1000 presenze: DA FARE conta i segni di ogni lezione', (await seg.settimana(IN, IN)).map((l) => l.segnati), [1000, 131])
  ok('oltre le 1000 presenze: il registro ha il segno dell\'ultima', (await seg.registro(IN, IN))[1].appello.map((x) => x.stato), ['presente'])
  ok('oltre le 1000 presenze: il calendario conta i presenti', (await m.creaDatiSupabase(db).calendario(IN, IN)).map((l) => l.presenti), [1000, 131])
  // La lettura a pagine da sola: si ferma solo su una pagina vuota, così regge anche un tetto del server più basso.
  const fonte = (n, tetto, guasto) => {
    const chieste = []
    const pagina = async (da, a) => {
      chieste.push(da)
      if (guasto && chieste.length === guasto) return { data: null, error: 'giù' }
      return { data: Array.from({ length: Math.max(0, Math.min(n, a + 1, da + tetto) - da) }, (_, i) => da + i), error: null }
    }
    return { pagina, chieste }
  }
  const esatte = fonte(1000, 1000)
  const r1 = await m.tutteLeRighe(esatte.pagina)
  ok('a pagine: esattamente 1000 righe, tutte e poi si ferma', [r1.data.length, esatte.chieste.length], [1000, 2])
  const basso = await m.tutteLeRighe(fonte(1131, 500).pagina)
  ok('a pagine: col tetto del server a 500 non si perde niente', [basso.data.length, new Set(basso.data).size], [1131, 1131])
  ok('a pagine: un errore alla seconda pagina arriva a chi legge', (await m.tutteLeRighe(fonte(1131, 1000, 2).pagina)).error, 'giù')
  // Una lettura che ignora `.range()` rimanda sempre le stesse righe: prima girava
  // per sempre (nell'app e nelle prove). Le pagine arrivano con un setTimeout,
  // così l'orologio della prova scatta anche se il giro non finisce.
  const ripete = () => new Promise((v) => setTimeout(() => v({ data: [{ id: 'a' }, { id: 'b' }], error: null }), 0))
  const giro = await Promise.race([
    m.tutteLeRighe(ripete).then(() => 'finita senza errore', (e) => e.message),
    new Promise((v) => setTimeout(() => v('gira a vuoto'), 2000)),
  ])
  ok('a pagine: una lettura che ignora le pagine si ferma e lo dice', giro, "L'elenco non si è letto per intero. Riprova; se succede ancora, scrivilo in SEGNALAZIONI.")
  // Ma due pagine giuste possono cominciare con la stessa riga: le presenze si leggono senza id
  // (`sessione_id, stato`), e due presenti alla stessa lezione hanno lo stesso testo.
  const uguali = Array.from({ length: 1131 }, (_, i) => ({ sessione_id: i === 1000 ? 's0' : `s${i}`, stato: 'presente' }))
  const doppia = await m.tutteLeRighe(async (da, a) => ({ data: uguali.slice(da, a + 1), error: null })).catch((e) => e.message)
  ok('a pagine: una pagina che comincia come la prima non è un giro a vuoto', doppia.data?.length, 1131)
}

// Le tabelle che crescono con gli anni si leggono a pagine: un elenco che
// passa le 1000 righe di Supabase, letto in una richiesta sola, si accorcia
// senza errore. Il database finto si segna ogni lettura di un elenco
// (niente `.single()`, `.limit()`, conteggi) fatta senza `.range()`.
{
  const CRESCONO = ['presenze', 'iscrizioni', 'sessioni', 'persone', 'anagrafiche', 'richieste_iscrizione', 'ricevute', 'quote_ricevute', 'segnalazioni', 'segnalazioni_allegati', 'segnalazioni_allegati_tolti', 'presenze_istruttori']
  const senzaPagine = []
  const aPagine = []
  // Le tabelle che rispondono «non c'è», per provare i ripieghi.
  const assenti = new Set()
  // I filtri `.eq()` chiesti, per tabella: una pagina senza il suo filtro leggerebbe le righe di tutti.
  const filtri = []
  const db = {
    auth: { getSession: async () => ({ data: { session: null } }) },
    rpc: async () => ({ data: null, error: null }),
    from: (t) => {
      const fatto = new Set()
      const c = new Proxy(() => c, {
        get: (_, k) => {
          if (k !== 'then') return (...x) => (fatto.add(k), k === 'select' && x[1]?.head && fatto.add('head'), k === 'eq' && filtri.push([t, ...x]), c)
          const una = fatto.has('single') || fatto.has('maybeSingle')
          if (fatto.has('select') && CRESCONO.includes(t) && !una && !['range', 'limit', 'head'].some((x) => fatto.has(x))) senzaPagine.push(t)
          // A pagine senza un ordine fisso le pagine si accavallano: conta come senza.
          if (fatto.has('range')) (fatto.has('order') ? aPagine : senzaPagine).push(t)
          const r = assenti.has(t) ? { data: null, error: { code: '42P01', message: `relation "${t}" does not exist` } } : { data: una ? null : [], error: null }
          return (f, ko) => Promise.resolve(r).then(f, ko)
        },
        apply: () => c,
      })
      return c
    },
  }
  const IN = new Date(2026, 9, 9, 12, 0)
  const seg = m.creaSegreteriaSupabase(db)
  // Con le tabelle che ognuna deve leggere a pagine: se una funzione si fermasse prima, la prova lo vede.
  const letture = {
    persone: [() => seg.persone(), ['quote_ricevute', 'persone', 'anagrafiche', 'richieste_iscrizione']],
    settimana: [() => seg.settimana(IN, IN), ['sessioni', 'iscrizioni', 'presenze']],
    registro: [() => seg.registro(new Date(2025, 9, 1), IN), ['sessioni', 'iscrizioni', 'presenze']],
    indiziDoppioni: [() => seg.indiziDoppioni(), ['anagrafiche', 'richieste_iscrizione']],
    segnalazioni: [() => seg.segnalazioni(), ['segnalazioni', 'segnalazioni_allegati', 'segnalazioni_allegati_tolti']],
    presenzeIstruttori: [() => seg.presenzeIstruttori(30), ['presenze_istruttori']],
    calendario: [() => m.creaDatiSupabase(db).calendario(IN, IN), ['sessioni', 'iscrizioni', 'presenze']],
    richieste: [() => m.creaRichiesteSupabase(db).richieste(), ['richieste_iscrizione']],
    // Le ricevute si fermavano a 500, senza avviso; quelle di una persona e quelle di tutti.
    ricevute: [() => seg.ricevute(), ['ricevute']],
    'ricevute di una persona': [() => seg.ricevute('p1'), ['ricevute']],
  }
  for (const [nome, [leggi, tabelle]] of Object.entries(letture)) {
    senzaPagine.length = 0
    aPagine.length = 0
    await leggi()
    ok(`a pagine: ${nome} non legge elenchi che crescono in una richiesta sola`, [...new Set(senzaPagine)], [])
    ok(`a pagine: ${nome} legge a pagine, in ordine, quel che deve`, tabelle.filter((t) => !aPagine.includes(t)), [])
  }
  // Senza la vista delle quote (27-pagamento-dalle-ricevute.sql) si ripiega sulle ricevute: a pagine anche quelle.
  senzaPagine.length = 0
  aPagine.length = 0
  assenti.add('quote_ricevute')
  await seg.persone()
  assenti.clear()
  ok('a pagine: senza la vista delle quote, le ricevute a pagine, in ordine', [senzaPagine.includes('ricevute'), aPagine.includes('ricevute')], [false, true])
  // Le ricevute di una persona: ogni pagina chiesta porta il suo filtro.
  filtri.length = 0
  await seg.ricevute('p1')
  ok('a pagine: le ricevute di una persona, ogni pagina solo le sue', [filtri.length > 0, filtri.every((f) => f.join() === 'ricevute,persona_id,p1')], [true, true])
  // L'export di una persona: le sue presenze, anni di lezioni, a pagine.
  senzaPagine.length = 0
  aPagine.length = 0
  await seg.esporta('p1')
  ok('a pagine: esporta legge le presenze di una persona a pagine, in ordine', [senzaPagine.includes('presenze'), aPagine.includes('presenze')], [false, true])
}

// ---------------------------------------------------------------------------
// La contabilità (59-contabilita.sql): voci, casse e movimenti a mano. In
// prova stanno in memoria e rifiutano quel che rifiuta il database
// (supabase/prova/contabilita.sql), con gli stessi messaggi. Gli incassi degli
// iscritti non sono qui: si ricavano da ricevute e pagamenti (prova-contabilita.mjs).
// ---------------------------------------------------------------------------
// Ogni sezione si ferma da sé: se i metodi non ci sono ancora, una riga rossa per sezione e non un crollo.
const sezione = async (titolo, f) => {
  console.log(`\n${titolo}`)
  try {
    await f()
  } catch (e) {
    ok(`${titolo}: si fa senza fermarsi`, e.message, 'nessun errore')
  }
}
// Gli oggetti si confrontano senza badare all'ordine dei campi.
const stabile = (x) => JSON.stringify(x, (_, v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : 1))) : v))
const cx = {}
const SOLO_AMM = 'Le voci di sistema non si cambiano'
const sembra = (v) => ({ nome: v?.nome, tipo: v?.tipo, diSistema: v?.diSistema, attiva: v?.attiva })

await sezione('la contabilità di prova: le tre casse e le due voci di sistema', async () => {
  const casse = await s.casse()
  // La cassa Satispay parte il 1° ottobre 2026 (97-satispay-scarico.sql): prima i pagamenti Satispay stavano in Conto Corrente.
  ok('le tre casse, a zero; solo Satispay con la data', casse.map((c) => [c.nome, c.saldoIniziale, c.dal ?? null]).sort(), [['Cassa Contanti', 0, null], ['Conto Corrente', 0, null], ['Satispay', 0, '2026-10-01']])
  cx.contanti = casse.find((c) => c.nome === 'Cassa Contanti').id
  cx.conto = casse.find((c) => c.nome === 'Conto Corrente').id
  // «Differenza di cassa» arriva con 60-chiusura-cassa.sql e ha le sue prove (la chiusura di cassa, più sotto); «Compensi istruttori» con 81-compensi-pagati.sql (prova-compensi-pagati).
  const di = (await s.voci()).filter((v) => v.diSistema && v.nome !== 'Differenza di cassa' && v.nome !== 'Compensi istruttori')
  ok('le voci di sistema, attive', di.map((v) => [v.nome, v.tipo, v.attiva]).sort(), [['Corsi e altri pagamenti', 'entrata', true], ['Quota associativa', 'entrata', true]])
  cx.quota = di.find((v) => v.nome === 'Quota associativa').id
  cx.corsi = di.find((v) => v.nome === 'Corsi e altri pagamenti').id
  ok('la quota associativa non si rinomina', await errore(() => s.rinominaVoce(cx.quota, 'Tessera')), SOLO_AMM)
  ok('«Corsi e altri pagamenti» nemmeno', await errore(() => s.rinominaVoce(cx.corsi, 'Corsi')), SOLO_AMM)
  ok('la quota associativa non si disattiva', await errore(() => s.attivaVoce(cx.quota, false)), SOLO_AMM)
  ok('«Corsi e altri pagamenti» nemmeno', await errore(() => s.attivaVoce(cx.corsi, false)), SOLO_AMM)
  ok('un doppione della quota no', await errore(() => s.salvaVoce({ nome: 'QUOTA ASSOCIATIVA', tipo: 'entrata' })), 'C’è già una voce «QUOTA ASSOCIATIVA» tra le entrate')
  ok('né di «Corsi e altri pagamenti», con spazi', await errore(() => s.salvaVoce({ nome: '  corsi e altri pagamenti ', tipo: 'entrata' })), 'C’è già una voce «corsi e altri pagamenti» tra le entrate')
  ok('sono rimaste com\'erano', (await s.voci()).filter((v) => v.diSistema && v.nome !== 'Differenza di cassa' && v.nome !== 'Compensi istruttori').map((v) => [v.nome, v.attiva]).sort(), [['Corsi e altri pagamenti', true], ['Quota associativa', true]])
})

await sezione('le voci: il nome è unico per tipo, una voce si disattiva', async () => {
  cx.aff = await s.salvaVoce({ nome: 'Affitto sala', tipo: 'uscita' })
  ok('salvaVoce rende l\'id', typeof cx.aff, 'string')
  const voce = async (id) => (await s.voci()).find((v) => v.id === id)
  ok('…di uscita, attiva e non di sistema', stabile(sembra(await voce(cx.aff))), stabile({ nome: 'Affitto sala', tipo: 'uscita', diSistema: false, attiva: true }))
  cx.don = await s.salvaVoce({ nome: 'Donazioni', tipo: 'entrata' })
  const bigl = await s.salvaVoce({ nome: '  Biglietti  ', tipo: 'entrata' })
  ok('il nome si ripulisce dagli spazi', (await voce(bigl))?.nome, 'Biglietti')
  ok('«affitto sala» c\'è già, senza badare alle maiuscole', await errore(() => s.salvaVoce({ nome: 'affitto sala', tipo: 'uscita' })), 'C’è già una voce «affitto sala» tra le uscite')
  ok('«Affitto sala » c\'è già, senza badare agli spazi', await errore(() => s.salvaVoce({ nome: 'Affitto sala ', tipo: 'uscita' })), 'C’è già una voce «Affitto sala» tra le uscite')
  await s.salvaVoce({ nome: 'Rimborsi', tipo: 'entrata' })
  await s.salvaVoce({ nome: 'Rimborsi', tipo: 'uscita' })
  ok('lo stesso nome in due tipi va bene', (await s.voci()).filter((v) => v.nome === 'Rimborsi').map((v) => v.tipo).sort(), ['entrata', 'uscita'])
  ok('…ma non due volte fra le entrate', await errore(() => s.salvaVoce({ nome: 'RIMBORSI', tipo: 'entrata' })), 'C’è già una voce «RIMBORSI» tra le entrate')
  ok('il nome vuoto no', await errore(() => s.salvaVoce({ nome: '   ', tipo: 'entrata' })), 'Scrivi il nome della voce')
  await s.salvaVoce({ nome: 'x'.repeat(60), tipo: 'entrata' })
  ok('sessantuna lettere no', await errore(() => s.salvaVoce({ nome: 'y'.repeat(61), tipo: 'entrata' })), 'Il nome della voce è troppo lungo: al massimo 60 caratteri')
  ok('il tipo giroconto non è di una voce', await errore(() => s.salvaVoce({ nome: 'Giro', tipo: 'giroconto' })), 'Scegli se è un’entrata o un’uscita')
  await s.rinominaVoce(bigl, 'Biglietti ingresso')
  ok('si rinomina', (await voce(bigl))?.nome, 'Biglietti ingresso')
  await s.rinominaVoce(bigl, 'BIGLIETTI INGRESSO')
  ok('si può cambiare solo le maiuscole del proprio nome', (await voce(bigl))?.nome, 'BIGLIETTI INGRESSO')
  ok('rinominare in un nome già preso no', await errore(() => s.rinominaVoce(cx.don, ' rimborsi')), 'C’è già una voce «rimborsi» tra le entrate')
  ok('rinominare in un nome di un altro tipo sì', await errore(() => s.rinominaVoce(cx.don, 'Affitto sala')), 'nessun errore')
  await s.rinominaVoce(cx.don, 'Donazioni')
  ok('rinominare in vuoto no', await errore(() => s.rinominaVoce(cx.don, ' ')), 'Scrivi il nome della voce')
  ok('rinominare in un nome lungo no', await errore(() => s.rinominaVoce(cx.don, 'z'.repeat(61))), 'Il nome della voce è troppo lungo: al massimo 60 caratteri')
  ok('una voce che non c\'è', await errore(() => s.rinominaVoce('non-c-e', 'X')), 'La voce non c’è')
  ok('né si disattiva', await errore(() => s.attivaVoce('non-c-e', false)), 'La voce non c’è')
})

await sezione('il saldo iniziale è un campo della cassa, con la data da cui si conta', async () => {
  const cassa = async (id) => (await s.casse()).find((c) => c.id === id)
  await s.salvaSaldoCassa(cx.contanti, 10000, '2026-09-01')
  ok('si imposta il saldo di Cassa Contanti, con la data', stabile(await cassa(cx.contanti)), stabile({ id: cx.contanti, nome: 'Cassa Contanti', saldoIniziale: 10000, dal: '2026-09-01' }))
  await s.salvaSaldoCassa(cx.conto, 0)
  ok('la data può mancare: allora si conta tutto', stabile(await cassa(cx.conto)), stabile({ id: cx.conto, nome: 'Conto Corrente', saldoIniziale: 0 }))
  ok('un saldo negativo no', await errore(() => s.salvaSaldoCassa(cx.contanti, -100, '2026-09-01')), 'Il saldo iniziale non può essere negativo')
  ok('una cassa che non c\'è', await errore(() => s.salvaSaldoCassa('non-c-e', 0)), 'La cassa non c’è')
  ok('un saldo enorme no', await errore(() => s.salvaSaldoCassa(cx.contanti, 100_000_001, '2026-09-01')), 'Il saldo iniziale è troppo alto: controlla le cifre')
  ok('l\'inizio della cassa non può essere domani', await errore(() => s.salvaSaldoCassa(cx.contanti, 10000, '2026-09-27')), 'L’inizio della cassa non può essere nel futuro')
  ok('il saldo rifiutato non ha cambiato niente', [(await cassa(cx.contanti)).saldoIniziale, (await cassa(cx.contanti)).dal], [10000, '2026-09-01'])
})

// Oggi, in questa prova, è il 26 settembre 2026.
await sezione('i movimenti: entrano solo se hanno senso', async () => {
  const buono = { tipo: 'entrata', data: '2026-09-10', importo: 4000, voceId: cx.don, cassaId: cx.contanti, descrizione: 'Offerta di Rossi' }
  const per = async (descrizione) => (await s.movimenti()).find((x) => x.descrizione === descrizione)
  cx.prima = (await s.movimenti()).length
  cx.offerta = await s.registraMovimento(buono)
  ok('registraMovimento rende l\'id', typeof cx.offerta, 'string')
  const x = await per('Offerta di Rossi')
  ok('un\'entrata entra, com\'è stata scritta', stabile([x?.id === cx.offerta, x?.tipo, x?.data, x?.importo, x?.voceId === cx.don, x?.cassaId === cx.contanti, x?.cassaAId ?? null, x?.nota ?? null, x?.annullatoIl ?? null, typeof x?.creatoIl]), stabile([true, 'entrata', '2026-09-10', 4000, true, true, null, null, null, 'string']))
  await s.registraMovimento({ tipo: 'uscita', data: '2026-09-12', importo: 2500, voceId: cx.aff, cassaId: cx.contanti, descrizione: 'Affitto sala di settembre', nota: 'Pagato a mano' })
  ok('una uscita con la nota entra', (await per('Affitto sala di settembre'))?.nota, 'Pagato a mano')
  await s.registraMovimento({ ...buono, data: '2026-09-01', importo: 1000, descrizione: 'Primo giorno' })
  await s.registraMovimento({ tipo: 'uscita', data: '2026-08-31', importo: 700, voceId: cx.aff, cassaId: cx.conto, descrizione: 'Commissioni di agosto' })
  ok('il primo giorno della cassa va, e sul conto senza «dal» anche prima', [!!(await per('Primo giorno')), !!(await per('Commissioni di agosto'))], [true, true])
  await s.registraMovimento({ ...buono, data: '2026-09-26', importo: 100, cassaId: cx.conto, descrizione: 'Oggi' })
  ok('oggi va', !!(await per('Oggi')), true)
  const entrati = (await s.movimenti()).length
  const rifiuti = [
    ['importo zero', { importo: 0 }, 'L’importo deve essere più di zero'],
    ['importo negativo', { importo: -500 }, 'L’importo deve essere più di zero'],
    ['importo con la virgola', { importo: 12.5 }, 'L’importo non si capisce'],
    ['importo oltre i centomila euro', { importo: 10_000_001 }, 'L’importo è troppo alto: controlla le cifre'],
    ['il 30 febbraio', { data: '2026-02-30', cassaId: cx.conto }, 'La data non si capisce'],
    ['senza data', { data: '', cassaId: cx.conto }, 'La data non si capisce'],
    ['domani', { data: '2026-09-27' }, 'La data è nel futuro: si registra quel che è già successo'],
    ['una data di secoli fa', { data: '1999-12-31', cassaId: cx.conto }, 'La data non si capisce'],
    ['un\'entrata con la voce di un\'uscita', { voceId: cx.aff }, 'La voce scelta non va con questo tipo di movimento'],
    ['una uscita con la voce di un\'entrata', { tipo: 'uscita' }, 'La voce scelta non va con questo tipo di movimento'],
    ['senza voce', { voceId: undefined }, 'Scegli la voce'],
    ['con una voce che non c\'è', { voceId: 'non-c-e' }, 'Scegli la voce'],
    ['descrizione vuota', { descrizione: '   ' }, 'Scrivi una descrizione'],
    ['descrizione di 201 lettere', { descrizione: 'd'.repeat(201) }, 'La descrizione è troppo lunga: al massimo 200 caratteri'],
    ['nota di 301 lettere', { nota: 'n'.repeat(301) }, 'La nota è troppo lunga: al massimo 300 caratteri'],
    ['senza cassa', { cassaId: '' }, 'Scegli la cassa'],
    ['una cassa che non c\'è', { cassaId: 'non-c-e' }, 'Scegli la cassa'],
    ['il 31 agosto sulla cassa che comincia il 1 settembre', { data: '2026-08-31' }, 'La data è prima dell’inizio della cassa'],
    ['il giroconto non passa da qui', { tipo: 'giroconto' }, 'Scegli se è un’entrata o un’uscita'],
    ['un tipo che non c\'è', { tipo: 'prestito' }, 'Scegli se è un’entrata o un’uscita'],
  ]
  for (const [cosa, cambio, messaggio] of rifiuti) ok(cosa, await errore(() => s.registraMovimento({ ...buono, ...cambio })), messaggio)
  ok('dei rifiuti non è entrato niente', (await s.movimenti()).length, entrati)
  ok('l\'inizio di una cassa non salta i movimenti già registrati (il conto ha quello del 31 agosto)', await errore(() => s.salvaSaldoCassa(cx.conto, 0, '2026-09-01')), 'Ci sono movimenti prima di quella data: annullali o scegli una data più vecchia')
  ok('…e il conto è rimasto com\'era', (await s.casse()).find((c) => c.id === cx.conto)?.dal, undefined)

  // Una voce disattivata non si offre ai movimenti nuovi, e resta sui vecchi.
  await s.attivaVoce(cx.aff, false)
  ok('si disattiva una voce usata, e risulta spenta', (await s.voci()).find((v) => v.id === cx.aff)?.attiva, false)
  const aOttobre = { tipo: 'uscita', data: '2026-09-20', importo: 600, voceId: cx.aff, cassaId: cx.conto, descrizione: 'Affitto di ottobre' }
  ok('con quella voce non si registra più', await errore(() => s.registraMovimento(aOttobre)), 'La voce non è più in uso: scegline un’altra')
  ok('i movimenti vecchi ce l\'hanno ancora', (await s.movimenti()).filter((y) => y.voceId === cx.aff).length, 2)
  await s.attivaVoce(cx.aff, true)
  await s.registraMovimento(aOttobre)
  ok('riattivata, si usa di nuovo', !!(await per('Affitto di ottobre')), true)
})

await sezione('il giroconto sposta denaro fra le due casse', async () => {
  const giro = { daCassaId: cx.contanti, aCassaId: cx.conto, data: '2026-09-15', importo: 1000, nota: 'Versamento in banca' }
  const giroconti = async () => (await s.movimenti()).filter((x) => x.tipo === 'giroconto')
  const id = await s.registraGiroconto(giro)
  ok('registraGiroconto rende l\'id', typeof id, 'string')
  const g = (await giroconti())[0]
  ok('entra senza voce, fra le due casse', stabile([g?.id === id, g?.data, g?.importo, g?.voceId ?? null, g?.cassaId === cx.contanti, g?.cassaAId === cx.conto, g?.nota]), stabile([true, '2026-09-15', 1000, null, true, true, 'Versamento in banca']))
  ok('…con una descrizione che dice fra quali casse', g?.descrizione, 'Giroconto da Cassa Contanti a Conto Corrente')
  const rifiuti = [
    ['dalla stessa cassa alla stessa', { aCassaId: cx.contanti }, 'Scegli due casse diverse'],
    ['importo zero', { importo: 0 }, 'L’importo deve essere più di zero'],
    ['importo troppo alto', { importo: 10_000_001 }, 'L’importo è troppo alto: controlla le cifre'],
    ['una cassa che non c\'è', { aCassaId: 'non-c-e' }, 'Scegli le due casse'],
    ['senza casse', { daCassaId: '', aCassaId: '' }, 'Scegli le due casse'],
    ['data impossibile', { data: '2026-02-30' }, 'La data non si capisce'],
    ['data nel futuro', { data: '2026-09-27' }, 'La data è nel futuro: si registra quel che è già successo'],
    ['prima dell\'inizio di una delle due casse', { data: '2026-08-31' }, 'La data è prima dell’inizio della cassa'],
    ['nota di 301 lettere', { nota: 'n'.repeat(301) }, 'La nota è troppo lunga: al massimo 300 caratteri'],
  ]
  for (const [cosa, cambio, messaggio] of rifiuti) ok(cosa, await errore(() => s.registraGiroconto({ ...giro, ...cambio })), messaggio)
  ok('un solo giroconto, nient\'altro', (await giroconti()).length, 1)
  cx.giro = id
})

await sezione('un movimento non si cancella e non si cambia: si annulla', async () => {
  const per = async (descrizione) => (await s.movimenti()).find((x) => x.descrizione === descrizione)
  const prima = (await s.movimenti()).length
  await s.registraMovimento({ tipo: 'entrata', data: '2026-09-11', importo: 300, voceId: cx.don, cassaId: cx.conto, descrizione: 'Offerta anonima' })
  const anonima = (await per('Offerta anonima')).id
  await s.annullaMovimento(anonima)
  const a = await per('Offerta anonima')
  ok('si annulla un movimento: resta in elenco, annullato, com\'era', [!!a?.annullatoIl, a?.importo, a?.data, a?.tipo], [true, 300, '2026-09-11', 'entrata'])
  ok('due volte no', await errore(() => s.annullaMovimento(anonima)), 'Il movimento è già annullato')
  ok('uno che non c\'è no', await errore(() => s.annullaMovimento('non-c-e')), 'Il movimento non c’è')
  await s.annullaMovimento(cx.giro)
  ok('si annulla anche un giroconto, e resta', !!(await s.movimenti()).find((x) => x.id === cx.giro)?.annullatoIl, true)
  ok('i movimenti sono ancora tutti', (await s.movimenti()).length, prima + 1)

  // Descrizione e nota si correggono, il resto no.
  const o = await per('Offerta di Rossi')
  const resto = (x) => stabile([x.tipo, x.data, x.importo, x.voceId, x.cassaId, x.cassaAId ?? null, x.creatoIl, x.annullatoIl ?? null])
  await s.correggiTestoMovimento(o.id, '  Offerta della famiglia Rossi ', 'Per la gara')
  const dopo = (await s.movimenti()).find((x) => x.id === o.id)
  ok('si corregge il testo, ripulito', [dopo.descrizione, dopo.nota], ['Offerta della famiglia Rossi', 'Per la gara'])
  ok('…e tutto il resto è come prima', resto(dopo), resto(o))
  await s.correggiTestoMovimento(o.id, 'Offerta della famiglia Rossi')
  ok('la nota si toglie', (await s.movimenti()).find((x) => x.id === o.id)?.nota ?? null, null)
  ok('descrizione vuota no', await errore(() => s.correggiTestoMovimento(o.id, ' ')), 'Scrivi una descrizione')
  ok('descrizione di 201 lettere no', await errore(() => s.correggiTestoMovimento(o.id, 'd'.repeat(201))), 'La descrizione è troppo lunga: al massimo 200 caratteri')
  ok('descrizione di 200 lettere sì', await errore(() => s.correggiTestoMovimento(o.id, 'd'.repeat(200))), 'nessun errore')
  ok('nota di 301 lettere no', await errore(() => s.correggiTestoMovimento(o.id, 'Offerta', 'n'.repeat(301))), 'La nota è troppo lunga: al massimo 300 caratteri')
  ok('un movimento annullato non si corregge', await errore(() => s.correggiTestoMovimento(anonima, 'Cambiata')), 'Un movimento annullato non si corregge')
  ok('uno che non c\'è no', await errore(() => s.correggiTestoMovimento('non-c-e', 'X')), 'Il movimento non c’è')
  ok('l\'annullato è rimasto com\'era', (await s.movimenti()).find((x) => x.id === anonima)?.descrizione, 'Offerta anonima')
})

// ---------------------------------------------------------------------------
// La chiusura di cassa (60-chiusura-cassa.sql): in prova gli incassi in contanti si
// ricavano da ricevute e pagamenti a mano dell'archivio, e la chiusura scrive da sola
// il movimento di differenza. Gli stessi casi e gli stessi messaggi di
// supabase/prova/chiusura-cassa.sql; i numeri del previsto sono provati là e in
// prova-contabilita.mjs. Qui il previsto di partenza si ricalcola a mano dall'archivio
// (che ha già i suoi incassi di altre prove): contano le differenze che portano i
// movimenti e gli incassi aggiunti dopo.
// ---------------------------------------------------------------------------
const D1 = '2026-09-21'
const D2 = '2026-09-26'
const MSG_CHIUSO = 'Quel giorno è già chiuso: per correggere scrivi il movimento con una data dopo la chiusura e una voce di rettifica (si crea in VOCI), oppure annulla la chiusura'
const MSG_ANNULLA_CHIUSO = 'Quel giorno è già chiuso: annulla prima la chiusura, o scrivi una rettifica con una data dopo la chiusura'
const MSG_SALDO_CHIUSA = 'La cassa ha una chiusura: annullala prima di cambiare il saldo iniziale'
const MSG_DIFFERENZA = 'La «Differenza di cassa» si scrive da sola chiudendo la cassa'
// Il previsto della Cassa Contanti, contato a mano dall'archivio: saldo iniziale, movimenti non annullati e incassi in contanti.
const aMano = async (fino) => {
  const c = (await s.casse()).find((x) => x.id === cx.contanti)
  const dentro = (g) => (!c.dal || g >= c.dal) && g <= fino
  let t = c.saldoIniziale
  for (const x of await s.movimenti()) {
    if (x.annullatoIl || !dentro(x.data)) continue
    if (x.tipo === 'giroconto') {
      if (x.cassaId === c.id) t -= x.importo
      if (x.cassaAId === c.id) t += x.importo
    } else if (x.cassaId === c.id) t += x.tipo === 'entrata' ? x.importo : -x.importo
  }
  const contanti = (metodo) => metodo.trim().toLowerCase() === 'contanti'
  for (const r of await s.ricevute()) if (!r.annullataIl) for (const v of r.voci) for (const p of v.pagamenti) if (contanti(p.metodo) && dentro(p.data)) t += p.importo
  for (const x of await s.pagamentiDiretti()) if (!x.annullatoIl && contanti(x.metodo) && dentro(x.data)) t += x.importo
  return t
}

await sezione('la chiusura di cassa di prova: le voci della differenza e i rifiuti', async () => {
  const dif = (await s.voci()).filter((v) => v.nome === 'Differenza di cassa')
  ok('le voci della differenza: una di entrata e una di uscita, di sistema e attive', dif.map((v) => [v.tipo, v.diSistema, v.attiva]).sort(), [['entrata', true, true], ['uscita', true, true]])
  cx.difE = dif.find((v) => v.tipo === 'entrata')?.id
  cx.difU = dif.find((v) => v.tipo === 'uscita')?.id
  ok('non si rinominano', await errore(() => s.rinominaVoce(cx.difU, 'Ammanco')), SOLO_AMM)
  ok('non si disattivano', await errore(() => s.attivaVoce(cx.difE, false)), SOLO_AMM)
  ok('un doppione nelle entrate no', await errore(() => s.salvaVoce({ nome: ' differenza di cassa', tipo: 'entrata' })), 'C’è già una voce «differenza di cassa» tra le entrate')
  ok('né nelle uscite', await errore(() => s.salvaVoce({ nome: 'DIFFERENZA DI CASSA', tipo: 'uscita' })), 'C’è già una voce «DIFFERENZA DI CASSA» tra le uscite')
  ok('all\'inizio non c\'è nessuna chiusura', await s.chiusure(), [])
  cx.P1 = await aMano(D1)
  const buona = { cassaId: cx.contanti, data: D1, contato: cx.P1 - 500 }
  const rifiuti = [
    ['senza cassa', { cassaId: '' }, 'Scegli la cassa'],
    ['una cassa che non c\'è', { cassaId: 'non-c-e' }, 'Scegli la cassa'],
    ['il Conto Corrente non si chiude', { cassaId: cx.conto }, 'Si chiude solo la Cassa Contanti'],
    ['…prima di guardare la data', { cassaId: cx.conto, data: '2026-02-30' }, 'Si chiude solo la Cassa Contanti'],
    ['il 30 febbraio', { data: '2026-02-30' }, 'La data non si capisce'],
    ['senza data', { data: '' }, 'La data non si capisce'],
    ['una data di secoli fa', { data: '1999-12-31' }, 'La data non si capisce'],
    ['domani', { data: '2026-09-27' }, 'La data è nel futuro: si chiude quel che è già successo'],
    ['il 31 agosto, prima dell\'inizio della cassa', { data: '2026-08-31' }, 'La data è prima dell’inizio della cassa'],
    ['…la data prima dei contanti', { data: '2026-02-30', contato: -5 }, 'La data non si capisce'],
    ['contanti con la virgola', { contato: 95.5 }, 'I contanti contati non si capiscono'],
    ['contanti che non sono un numero', { contato: Number.NaN }, 'I contanti contati non si capiscono'],
    ['contanti negativi', { contato: -1 }, 'I contanti contati non possono essere negativi'],
    ['contanti oltre un milione di euro', { contato: 100_000_001 }, 'I contanti contati sono troppi: controlla le cifre'],
    ['nota di 301 lettere', { nota: 'n'.repeat(301) }, 'La nota è troppo lunga: al massimo 300 caratteri'],
    ['…dopo i contanti', { contato: -1, nota: 'n'.repeat(301) }, 'I contanti contati non possono essere negativi'],
  ]
  const movimentiPrima = (await s.movimenti()).length
  for (const [cosa, cambio, messaggio] of rifiuti) ok(cosa, await errore(() => s.chiudiCassa({ ...buona, ...cambio })), messaggio)
  ok('di tutti questi rifiuti non è entrato niente', [(await s.chiusure()).length, (await s.movimenti()).length], [0, movimentiPrima])
})

await sezione('si chiude fino al 21 settembre: i contanti sono 5,00 in meno', async () => {
  cx.k1 = await s.chiudiCassa({ cassaId: cx.contanti, data: D1, contato: cx.P1 - 500, nota: 'Contati in cassa' })
  ok('chiudiCassa rende l\'id', typeof cx.k1, 'string')
  const k = (await s.chiusure()).find((x) => x.id === cx.k1)
  ok('…della Cassa Contanti, dal primo giorno della cassa, con previsto, contato, differenza e nota',
    stabile([k?.cassaId === cx.contanti, k?.dal, k?.data, k?.previsto, k?.contato, k?.differenza, k?.nota]),
    stabile([true, '2026-09-01', D1, cx.P1, cx.P1 - 500, -500, 'Contati in cassa']))
  ok('…chi e quando c\'è, non è annullata', [typeof k?.chiusaDa, typeof k?.chiusaIl, k?.annullataIl ?? null], ['string', 'string', null])
  const mv = (await s.movimenti()).find((x) => x.id === k?.movimentoId)
  const voce = (await s.voci()).find((v) => v.id === mv?.voceId)
  ok('…con un\'uscita di 5,00 scritta da sola, voce «Differenza di cassa»',
    stabile([mv?.tipo, mv?.data, mv?.importo, voce?.nome, voce?.tipo, mv?.cassaId === cx.contanti, mv?.descrizione, mv?.nota]),
    stabile(['uscita', D1, 500, 'Differenza di cassa', 'uscita', true, 'Differenza di cassa', 'Contati in cassa']))
  ok('…e a fine giorno in cassa c\'è quel che si è contato', await aMano(D1), cx.P1 - 500)
  ok('il giorno stesso è chiuso: si dice da quando si può', await errore(() => s.chiudiCassa({ cassaId: cx.contanti, data: D1, contato: 0 })), 'Quel giorno è già chiuso: scegli un giorno dopo il 21/09/2026')
  ok('…anche un giorno prima', await errore(() => s.chiudiCassa({ cassaId: cx.contanti, data: '2026-09-10', contato: 0 })), 'Quel giorno è già chiuso: scegli un giorno dopo il 21/09/2026')
  ok('…e il Conto Corrente resta quello che non si chiude', await errore(() => s.chiudiCassa({ cassaId: cx.conto, data: D2, contato: 0 })), 'Si chiude solo la Cassa Contanti')
  // Un pagamento a mano in contanti in un giorno chiuso cambierebbe il previsto già contato; carta e bonifico no.
  const GIORNO_CHIUSO = 'Quel giorno la cassa è già chiusa: scegli una data dopo la chiusura'
  const gino = await s.salvaPersona({ nome: 'Gino', cognome: 'Chiuso' })
  // Quel che entra si annulla subito: un annullato non conta nel previsto, e le chiusure di dopo tengono i loro numeri.
  const entrati = []
  const provaPagaA = async (data, metodo) => {
    let id
    const esito = await errore(async () => { id = (await s.registraPagamentoDiretto({ personaId: gino, data, importo: 700, metodo, voce: 'ALTRO' })).id })
    if (id) {
      entrati.push([data, metodo])
      await s.annullaPagamentoDiretto(id)
    }
    return esito
  }
  ok('contanti nel giorno della chiusura no', await provaPagaA(D1, 'Contanti'), GIORNO_CHIUSO)
  ok('contanti prima della chiusura no', await provaPagaA('2026-09-10', 'Contanti'), GIORNO_CHIUSO)
  ok('«contanti» in minuscolo e con gli spazi, uguale', await provaPagaA(D1, '  contanti '), GIORNO_CHIUSO)
  ok('contanti il giorno dopo la chiusura sì', await provaPagaA('2026-09-22', 'Contanti'), 'nessun errore')
  ok('carta nello stesso giorno sì', await provaPagaA(D1, 'POS'), 'nessun errore')
  ok('bonifico nello stesso giorno sì', await provaPagaA(D1, 'Bonifico'), 'nessun errore')
  ok('sono entrati solo i tre permessi', entrati, [['2026-09-22', 'Contanti'], [D1, 'POS'], [D1, 'Bonifico']])
})

await sezione('i giorni chiusi: fino al 21 settembre non si scrive e non si annulla', async () => {
  const mov = { tipo: 'entrata', data: '2026-09-10', importo: 100, voceId: cx.don, cassaId: cx.contanti, descrizione: 'Tardivo' }
  const entrati = (await s.movimenti()).length
  const rifiuti = [
    ['un movimento il 21 settembre', { data: D1 }, MSG_CHIUSO],
    ['…il 10', {}, MSG_CHIUSO],
    ['una uscita nemmeno', { tipo: 'uscita', voceId: cx.aff }, MSG_CHIUSO],
    ['l\'inizio della cassa viene prima del giorno chiuso', { data: '2026-08-31' }, 'La data è prima dell’inizio della cassa'],
    ['una cassa che non c\'è viene prima', { cassaId: 'non-c-e' }, 'Scegli la cassa'],
    ['l\'importo viene prima', { importo: 0 }, 'L’importo deve essere più di zero'],
    ['il giorno chiuso viene prima della descrizione', { descrizione: '   ' }, MSG_CHIUSO],
    ['«Differenza di cassa» in entrata a mano no', { voceId: cx.difE, cassaId: cx.conto, data: D2 }, MSG_DIFFERENZA],
    ['…e in uscita', { tipo: 'uscita', voceId: cx.difU, cassaId: cx.conto, data: D2 }, MSG_DIFFERENZA],
    ['prima si guarda se la voce va col tipo', { voceId: cx.difU, cassaId: cx.conto, data: D2 }, 'La voce scelta non va con questo tipo di movimento'],
  ]
  for (const [cosa, cambio, messaggio] of rifiuti) ok(cosa, await errore(() => s.registraMovimento({ ...mov, ...cambio })), messaggio)
  ok('il Conto Corrente non è chiuso: il 10 settembre si scrive', await errore(() => s.registraMovimento({ ...mov, cassaId: cx.conto, descrizione: 'Sul conto' })), 'nessun errore')
  ok('dei rifiuti non è entrato niente (solo il movimento sul conto)', (await s.movimenti()).length, entrati + 1)
  const giro = { daCassaId: cx.conto, aCassaId: cx.contanti, data: '2026-09-15', importo: 100 }
  ok('un giroconto dal conto ai contanti no', await errore(() => s.registraGiroconto(giro)), MSG_CHIUSO)
  ok('…né dai contanti al conto', await errore(() => s.registraGiroconto({ ...giro, daCassaId: cx.contanti, aCassaId: cx.conto })), MSG_CHIUSO)
  ok('l\'inizio della cassa viene prima', await errore(() => s.registraGiroconto({ ...giro, data: '2026-08-31' })), 'La data è prima dell’inizio della cassa')
  ok('l\'importo viene prima', await errore(() => s.registraGiroconto({ ...giro, importo: 0 })), 'L’importo deve essere più di zero')
  // Annullare.
  const per = async (descrizione) => (await s.movimenti()).find((x) => x.descrizione === descrizione)
  const k = (await s.chiusure()).find((x) => x.id === cx.k1)
  ok('un movimento dei contanti di un giorno chiuso non si annulla', await errore(() => s.annullaMovimento(cx.offerta)), MSG_ANNULLA_CHIUSO)
  ok('…nemmeno quello di differenza', await errore(() => s.annullaMovimento(k?.movimentoId)), MSG_ANNULLA_CHIUSO)
  ok('…il suo testo si corregge', await errore(() => s.correggiTestoMovimento(cx.offerta, 'Offerta di Rossi', 'Per la gara')), 'nessun errore')
  ok('…anche quello della differenza', await errore(() => s.correggiTestoMovimento(k?.movimentoId, 'Differenza di cassa')), 'nessun errore')
  const ottobre = await per('Affitto di ottobre')
  ok('un movimento del conto si annulla', await errore(() => s.annullaMovimento(ottobre?.id)), 'nessun errore')
  // Il saldo.
  ok('il saldo di una cassa chiusa no', await errore(() => s.salvaSaldoCassa(cx.contanti, 10000, '2026-09-01')), MSG_SALDO_CHIUSA)
  ok('…prima degli altri controlli', await errore(() => s.salvaSaldoCassa(cx.contanti, -100, '2026-09-01')), MSG_SALDO_CHIUSA)
  ok('…ma una cassa che non c\'è resta una cassa che non c\'è', await errore(() => s.salvaSaldoCassa('non-c-e', 0)), 'La cassa non c’è')
  ok('il Conto Corrente non ha chiusure: il suo saldo si cambia', await errore(() => s.salvaSaldoCassa(cx.conto, 0)), 'nessun errore')
  ok('il saldo dei contanti è rimasto', (await s.casse()).find((c) => c.id === cx.contanti)?.saldoIniziale, 10000)
})

await sezione('una chiusura che copre più giorni: +3,00', async () => {
  // Dopo la chiusura del 21: incassi e movimenti dal 22 al 25. Contano 30,00 + 20,00 − 10,00 − 20,00 = 20,00; il resto no.
  const pia = await s.salvaPersona({ nome: 'Ciro', cognome: 'Chiusure' })
  const ente = await s.enteRicevute()
  const intestatario = await s.intestatarioDi(pia)
  const rcv = (voci, anticipo = 0) => s.emettiRicevuta({ data: '2026-09-22', personaId: pia, ente, intestatario, anticipo, voci })
  const voce = (prezzo, pagamenti, altro = {}) => ({ descrizione: 'ALTRO', quantita: 1, prezzo, pagamenti, ...altro })
  await rcv([voce(3000, [{ data: '2026-09-22', importo: 3000, metodo: 'Contanti' }])])
  await rcv([voce(5000, [{ data: '2026-09-22', importo: 5000, metodo: 'POS' }])])
  const annullata = await rcv([voce(4000, [{ data: '2026-09-23', importo: 4000, metodo: 'Contanti' }])])
  await s.annullaRicevuta(annullata.id)
  await rcv([voce(8000, [], { dal: '2026-09-01', al: '2027-07-31' })], 5000)
  const diretto = (importo, extra = {}) => s.registraPagamentoDiretto({ personaId: pia, data: '2026-09-24', importo, metodo: 'Contanti', voce: 'ALTRO', ...extra })
  await diretto(2000)
  await diretto(700, { metodo: 'Assegno' })
  await s.annullaPagamentoDiretto((await diretto(900)).id)
  await s.registraMovimento({ tipo: 'uscita', data: '2026-09-25', importo: 1000, voceId: cx.aff, cassaId: cx.contanti, descrizione: 'Pulizie di settembre' })
  await s.registraGiroconto({ daCassaId: cx.contanti, aCassaId: cx.conto, data: '2026-09-25', importo: 2000 })
  const k1 = (await s.chiusure()).find((x) => x.id === cx.k1)
  cx.C2 = k1.contato + 2000
  cx.k2 = await s.chiudiCassa({ cassaId: cx.contanti, data: D2, contato: cx.C2 + 300 })
  const k = (await s.chiusure()).find((x) => x.id === cx.k2)
  ok('la seconda parte dal giorno dopo la prima, e il previsto riparte da quel che si è contato', stabile([k?.dal, k?.data, k?.previsto, k?.contato, k?.differenza, k?.nota ?? null]), stabile(['2026-09-22', D2, cx.C2, cx.C2 + 300, 300, null]))
  const mv = (await s.movimenti()).find((x) => x.id === k?.movimentoId)
  ok('…con un\'entrata di 3,00', stabile([mv?.tipo, mv?.data, mv?.importo, mv?.voceId === cx.difE, mv?.nota ?? null]), stabile(['entrata', D2, 300, true, null]))
  ok('…e a fine giorno in cassa c\'è quel che si è contato', await aMano(D2), cx.C2 + 300)
  ok('il 26 è chiuso, si dice da quando si può', await errore(() => s.chiudiCassa({ cassaId: cx.contanti, data: D2, contato: 0 })), 'Quel giorno è già chiuso: scegli un giorno dopo il 26/09/2026')
  ok('le chiusure sono due, tutte attive', (await s.chiusure()).filter((x) => !x.annullataIl).length, 2)
})

await sezione('si annulla solo l\'ultima, e i giorni si riaprono', async () => {
  const k2 = () => s.chiusure().then((l) => l.find((x) => x.id === cx.k2))
  ok('una chiusura che non c\'è', await errore(() => s.annullaChiusuraCassa('non-c-e')), 'La chiusura non c’è')
  ok('quella del 21 non è l\'ultima', await errore(() => s.annullaChiusuraCassa(cx.k1)), 'Si annulla solo l’ultima chiusura della cassa')
  ok('l\'ultima, del 26, si annulla', await errore(() => s.annullaChiusuraCassa(cx.k2)), 'nessun errore')
  const k = await k2()
  const mv = (await s.movimenti()).find((x) => x.id === k?.movimentoId)
  ok('…resta in elenco, annullata, e il suo movimento di differenza con lei', [!!k?.annullataIl, !!mv?.annullatoIl, mv?.importo], [true, true, 300])
  ok('…e il previsto non conta più i 3,00', await aMano(D2), cx.C2)
  ok('annullarla due volte no', await errore(() => s.annullaChiusuraCassa(cx.k2)), 'La chiusura è già annullata')
  ok('il 22 settembre è di nuovo aperto', await errore(() => s.registraMovimento({ tipo: 'entrata', data: '2026-09-22', importo: 100, voceId: cx.don, cassaId: cx.contanti, descrizione: 'Dopo l\'annullo' })), 'nessun errore')
  await s.annullaMovimento((await s.movimenti()).find((x) => x.descrizione === 'Dopo l\'annullo').id)
  ok('il 21 è ancora chiuso', await errore(() => s.registraMovimento({ tipo: 'entrata', data: D1, importo: 100, voceId: cx.don, cassaId: cx.contanti, descrizione: 'Ancora no' })), MSG_CHIUSO)
  // Si richiude lo stesso giorno: i conti ora tornano.
  cx.k3 = await s.chiudiCassa({ cassaId: cx.contanti, data: D2, contato: cx.C2 })
  const k3 = (await s.chiusure()).find((x) => x.id === cx.k3)
  ok('si richiude il 26: un\'altra chiusura, senza differenza e senza movimento', stabile([cx.k3 !== cx.k2, k3?.previsto, k3?.differenza, k3?.movimentoId ?? null]), stabile([true, cx.C2, 0, null]))
  ok('con le chiusure il saldo è bloccato', await errore(() => s.salvaSaldoCassa(cx.contanti, 10000, '2026-09-01')), MSG_SALDO_CHIUSA)
  await s.annullaChiusuraCassa(cx.k3)
  ok('…anche con una sola: resta quella del 21', await errore(() => s.salvaSaldoCassa(cx.contanti, 10000, '2026-09-01')), MSG_SALDO_CHIUSA)
  await s.annullaChiusuraCassa(cx.k1)
  ok('annullate tutte, il saldo si cambia', await errore(() => s.salvaSaldoCassa(cx.contanti, 10000, '2026-09-01')), 'nessun errore')
  ok('…e i giorni di prima sono aperti', await errore(() => s.registraMovimento({ tipo: 'entrata', data: '2026-09-05', importo: 100, voceId: cx.don, cassaId: cx.contanti, descrizione: 'Tutto aperto' })), 'nessun errore')
  ok('…il movimento del 10 settembre si annulla di nuovo', await errore(() => s.annullaMovimento(cx.offerta)), 'nessun errore')
  const dopo1 = (await s.chiusure()).find((x) => x.id === cx.k1)
  ok('…la chiusura del 21 è annullata, con la sua differenza', [!!dopo1?.annullataIl, !!(await s.movimenti()).find((x) => x.id === dopo1?.movimentoId)?.annullatoIl], [true, true])
})

await sezione('cambiare la voce di un movimento (67-cambia-voce.sql): stesse regole del database', async () => {
  // «Da classificare» c'è già: la porta lo scarico Satispay (97-satispay-scarico.sql).
  const dc = (await s.voci()).find((v) => v.nome === 'Da classificare' && v.tipo === 'uscita').id
  const en = await s.salvaVoce({ nome: 'Energia', tipo: 'uscita' })
  const spenta = await s.salvaVoce({ nome: 'Vecchia due', tipo: 'uscita' })
  await s.attivaVoce(spenta, false)
  const ev = await s.salvaVoce({ nome: 'Eventi', tipo: 'entrata' })
  const nuovo = async (descrizione, cambio = {}) => {
    await s.registraMovimento({ tipo: 'uscita', data: '2026-09-12', importo: 8400, voceId: dc, cassaId: cx.conto, descrizione, ...cambio })
    return (await s.movimenti()).find((x) => x.descrizione === descrizione).id
  }
  const uno = await nuovo('BONIFICO UNO')
  const due = await nuovo('BONIFICO DUE', { nota: 'da guardare' })
  const tre = await nuovo('BONIFICO TRE')
  const gia = await nuovo('GIÀ A POSTO', { voceId: en })
  const don = await nuovo('BONIFICO DONAZ', { tipo: 'entrata', voceId: cx.don })
  await s.registraGiroconto({ daCassaId: cx.conto, aCassaId: cx.contanti, data: '2026-09-18', importo: 700 })
  const giro = (await s.movimenti()).find((x) => x.tipo === 'giroconto' && !x.annullatoIl && x.importo === 700).id
  const disfare = await nuovo('DA DISFARE')
  await s.annullaMovimento(disfare)
  const per = async (id) => (await s.movimenti()).find((x) => x.id === id)
  const senzaVoce = async (id) => { const { voceId: _v, ...resto } = await per(id); return stabile(resto) }
  const prima = await senzaVoce(due)
  const tutto = async () => stabile(await s.movimenti())

  ok('un lotto di uno: cambiato 1', stabile(await s.cambiaVoceMovimenti([uno], en)), stabile({ cambiati: 1, giaCosi: 0 }))
  ok('…la voce è la nuova', (await per(uno)).voceId, en)
  ok('un lotto: due da cambiare, uno già così, il doppione conta una volta', stabile(await s.cambiaVoceMovimenti([due, tre, gia, due], en)), stabile({ cambiati: 2, giaCosi: 1 }))
  ok('importo, data, cassa, nota, testo: tutto com\'era', await senzaVoce(due), prima)
  ok('il residuo delle casse non si muove', (await s.movimenti()).filter((x) => [uno, due, tre].includes(x.id)).map((x) => [x.cassaId === cx.conto, x.importo]), [[true, 8400], [true, 8400], [true, 8400]])
  ok('rifatto uguale: niente da cambiare', stabile(await s.cambiaVoceMovimenti([due], en)), stabile({ cambiati: 0, giaCosi: 1 }))
  const traccia = await s.cambiVoceMovimento(due)
  ok('la traccia: una riga, chi, quando, voce di prima e di dopo', stabile(traccia.map((c) => [typeof c.quando, c.chi, c.prima, c.dopo])), stabile([['string', 'Amministrazione', 'Da classificare', 'Energia']]))
  ok('…chi è già a posto non ne ha', await s.cambiVoceMovimento(gia), [])

  const prima2 = await tutto()
  const rifiuti = [
    ['nessun movimento', [], en, 'Scegli almeno un movimento'],
    ['501 movimenti', Array.from({ length: 501 }, (_, i) => `x${i}`), en, 'Troppi movimenti in una volta: al massimo 500'],
    ['senza voce', [uno], '', 'Scegli la voce'],
    ['una voce che non c\'è', [uno], 'non-c-e', 'Scegli la voce'],
    ['una voce spenta', [uno], spenta, 'La voce non è più in uso: scegline un’altra'],
    ['«Differenza di cassa» come arrivo', [uno], cx.difU, 'La «Differenza di cassa» si scrive da sola chiudendo la cassa'],
    ['un movimento che non c\'è', ['non-c-e'], en, 'Il movimento non c’è'],
    ['un annullato', [disfare], en, 'Il movimento del 12/09/2026 (DA DISFARE) è annullato: non si cambia'],
    ['un giroconto', [giro], en, 'Un giroconto non ha voce'],
    ['una voce di uscita a un\'entrata', [don], en, 'La voce scelta non va con questo tipo di movimento'],
    ['entrate e uscite insieme', [don, uno], en, 'La voce scelta non va con questo tipo di movimento'],
    ['un annullato in fondo: nessuno dei primi cambia', [uno, due, tre, disfare], dc, 'Il movimento del 12/09/2026 (DA DISFARE) è annullato: non si cambia'],
  ]
  for (const [cosa, ids, voce, messaggio] of rifiuti) ok(cosa, await errore(() => s.cambiaVoceMovimenti(ids, voce)), messaggio)
  ok('dei rifiuti non è cambiato niente, nemmeno la traccia', [await tutto(), (await s.cambiVoceMovimento(uno)).length], [prima2, 1])
  ok('una voce di entrata a un\'entrata va', await errore(() => s.cambiaVoceMovimenti([don], ev)), 'nessun errore')

  // Un giorno chiuso: la voce si cambia, la chiusura non se ne accorge.
  await nuovo('OFFERTA IN CONTANTI', { tipo: 'entrata', voceId: cx.don, cassaId: cx.contanti })
  const offerta = (await s.movimenti()).find((x) => x.descrizione === 'OFFERTA IN CONTANTI').id
  const k = await s.chiudiCassa({ cassaId: cx.contanti, data: '2026-09-20', contato: 100 })
  const chiusura = async () => stabile((await s.chiusure()).find((x) => x.id === k))
  const dopoChiusura = await chiusura()
  ok('un movimento di un giorno chiuso: la voce cambia', await errore(() => s.cambiaVoceMovimenti([offerta], ev)), 'nessun errore')
  ok('…ora ha la voce nuova', (await per(offerta)).voceId, ev)
  ok('…la chiusura è quella di prima (previsto, contato, differenza)', await chiusura(), dopoChiusura)
  ok('…il giorno è ancora chiuso', await errore(() => s.registraMovimento({ tipo: 'uscita', data: '2026-09-19', importo: 100, voceId: en, cassaId: cx.contanti, descrizione: 'No' })), MSG_CHIUSO)
  const dif = (await s.chiusure()).find((x) => x.id === k)?.movimentoId
  ok('la differenza scritta dalla chiusura non cambia voce', await errore(() => s.cambiaVoceMovimenti([dif], en)), `Il movimento del 20/09/2026 (Differenza di cassa) è scritto dalla chiusura di cassa: non si cambia`)
  await s.annullaChiusuraCassa(k)
})

await sezione('collegare lo storico alla persona (70-movimenti-persona.sql): stesse regole del database', async () => {
  const L = ['11111111-aaaa-0000-0000-000000000001', '11111111-aaaa-0000-0000-000000000002', '11111111-aaaa-0000-0000-000000000003']
  const ent = await s.salvaVoce({ nome: 'Non classificato', tipo: 'entrata' })
  const usc = await s.salvaVoce({ nome: 'Spese vecchie', tipo: 'uscita' })
  const nuova = (nome, cognome) => s.salvaPersona({ nome, cognome })
  const giulia = await nuova('Giulia', 'Verdelli')
  const marco = await nuova('Marco', 'Biancardi')
  const sara1 = await nuova('Sara', 'Nerini')
  const sara2 = await nuova('Sara', 'Nerini')
  const elena = await nuova('Elena', 'D\'Angelo')
  const mgrazia = await nuova('Maria Grazia', 'Fontanelli')
  const jose = await nuova('José', 'Ferraresi')
  const anna = await nuova('Anna', 'Altra')
  // Anno di nascita e corso: servono a scegliere fra due omonime.
  const corso = (await s.corsi()).find((c) => c.id === 'lotta-2')
  m.archivio.dati.anagrafiche[sara1] = { natoIl: '2010-02-03' }
  m.archivio.dati.anagrafiche[sara2] = { natoIl: '2012-07-09' }
  // Giulia è minorenne e iscritta a un corso: se è la sola candidata, di lei non si dice né l'anno né il corso.
  m.archivio.dati.anagrafiche[giulia] = { natoIl: '2016-05-04' }
  m.archivio.dati.iscrizioni = [...m.archivio.dati.iscrizioni, { corsoId: 'lotta-2', personaId: giulia, dal: '2022-09-05' }]
  m.archivio.dati.iscrizioni = [...m.archivio.dati.iscrizioni, { corsoId: 'lotta-2', personaId: sara1, dal: '2024-09-10' }]
  // Lo storico del vecchio programma: la modalità prova non ha l'import, lo si semina nell'archivio con la sua chiave.
  const st = (n, data, importo, descrizione, o = {}) => ({ id: `st${n}`, tipo: 'entrata', data, importo, voceId: cx.corsi, cassaId: cx.conto, descrizione, creatoIl: `${data}T10:00:00.000Z`, origineImport: `prima-nota:${n}`, ...o })
  m.archivio.dati.movimenti = [
    ...(m.archivio.dati.movimenti ?? []),
    st(1, '2025-09-02', 31000, 'Cliente Giulia Verdelli per annuale judo kids'),
    st(2, '2025-09-03', 3000, 'Cliente VERDELLI GIULIA per quota associativa', { voceId: cx.quota }),
    st(3, '2026-09-03', 4700, 'Cliente Marco Biancardi per mensile judo', { cassaId: cx.contanti }),
    st(4, '2025-10-05', 4500, 'Cliente Sara Nerini per mensile judo'),
    st(5, '2025-11-05', 4500, 'Cliente Nerini Sara per mensile judo'),
    st(6, '2024-10-10', 6000, 'Cliente Paolo Gialloni per quota associativa', { voceId: cx.quota }),
    st(7, '2024-10-15', 5200, 'Cliente Elena D\'Angelo per corso danza'),
    st(8, '2025-01-20', 5500, 'Cliente Maria Grazia Fontanelli per corso'),
    st(9, '2023-11-05', 2000, 'Cliente Jose Ferraresi per quota associativa', { voceId: cx.quota }),
    st(10, '2025-03-01', 1500, 'Bonifico anonimo per quota', { voceId: cx.quota }),
    st(11, '2025-03-02', 7000, 'Cliente Giulia Verdelli per regalo', { voceId: ent }),
    st(12, '2025-03-03', 8000, 'Cliente Giulia Verdelli per rimborso', { tipo: 'uscita', voceId: usc }),
    st(13, '2025-03-04', 1000, 'Cliente Giulia Verdelli per extra', { annullatoIl: '2025-03-05T10:00:00.000Z' }),
    st(14, '2026-05-10', 2500, 'Cliente\nJOSÈ  FERRARESI\nper mensile'),
  ]
  // A mano e senza persona, com'era scritta prima di 98-quote-persona.sql: `registraMovimento` ora la chiede, quindi la si semina.
  m.archivio.dati.movimenti = [...m.archivio.dati.movimenti, { id: 'mano-1', tipo: 'entrata', data: '2026-09-10', importo: 3000, voceId: cx.quota, cassaId: cx.conto, descrizione: 'Cliente Giulia Verdelli per mano', creatoIl: '2026-09-10T10:00:00.000Z' }]
  await s.registraGiroconto({ daCassaId: cx.contanti, aCassaId: cx.conto, data: '2026-09-06', importo: 1000 })
  const k = await s.chiudiCassa({ cassaId: cx.contanti, data: '2026-09-07', contato: 100 })
  const per = async (id) => (await s.movimenti()).find((x) => x.id === id)
  const di = async (n) => (await per(`st${n}`)).personaId
  const stato = async () => stabile(await Promise.all([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14].map(di)))
  const idsGiro = (await s.movimenti()).find((x) => x.tipo === 'giroconto' && !x.annullatoIl)?.id
  const idMano = (await s.movimenti()).find((x) => x.descrizione === 'Cliente Giulia Verdelli per mano').id
  const idDiff = (await s.movimenti()).find((x) => x.descrizione === 'Differenza di cassa' && !x.annullatoIl)?.id
  const senzaPersona = async () => stabile((await s.movimenti()).map(({ personaId: _p, ...r }) => r))
  const chiusura = async () => stabile((await s.chiusure()).find((x) => x.id === k))
  const dopoChiusura = await chiusura()
  const prima = await senzaPersona()
  const senzaCampione = ({ campione: _c, ...r }) => stabile(r)

  const r0 = await s.riepilogoCollegamentiPersona()
  ok('il riepilogo: 7 sicuri di 5 persone, 2 omonimi da decidere, 2 senza scheda, nessuno già collegato', senzaCampione(r0), stabile({
    sicuri: { movimenti: 7, persone: 5, centesimi: 53900, dal: '2023-11-05', al: '2026-09-03' },
    daDecidere: { movimenti: 2, centesimi: 9000 },
    senzaScheda: { movimenti: 2, centesimi: 7500 },
    giaCollegati: 0,
  }))
  ok('…il campione ha cinque esempi con causale e persona', [r0.campione.length, r0.campione.every((c) => typeof c.causale === 'string' && typeof c.persona === 'string')], [5, true])
  ok('il riepilogo non scrive niente', [await stato(), await senzaPersona()], [stabile(Array(14).fill(null).map(() => undefined)), prima])

  console.log('   gli esiti per riga (i tag dell\'elenco)')
  const esiti = async () => (await s.esitiCollegamentiPersona()).map((e) => `${e.id}:${e.esito}`).sort()
  const conta = async () => {
    const e = await s.esitiCollegamentiPersona()
    return ['sicuro', 'omonimi', 'nessuna'].map((x) => e.filter((y) => y.esito === x).length)
  }
  const dalRiepilogo = async () => {
    const r = await s.riepilogoCollegamentiPersona()
    return [r.sicuri.movimenti, r.daDecidere.movimenti, r.senzaScheda.movimenti]
  }
  ok('gli esiti: sicuri, omonimi e senza scheda; non ci sono uscite, giroconti, annullati, il movimento a mano né la differenza', await esiti(), [
    'st1:sicuro', 'st10:nessuna', 'st14:sicuro', 'st2:sicuro', 'st3:sicuro', 'st4:omonimi', 'st5:omonimi', 'st6:nessuna', 'st7:sicuro', 'st8:sicuro', 'st9:sicuro',
  ].sort())
  ok('…gli stessi numeri del riepilogo', await conta(), await dalRiepilogo())

  console.log('   a mano: una persona sola, correggere, scollegare')
  ok('un movimento a una persona (per sbaglio, apposta)', stabile(await s.collegaMovimentiPersona(['st2'], marco)), stabile({ collegati: 1, giaCosi: 0 }))
  const rMano = await s.riepilogoCollegamentiPersona()
  ok('…il riepilogo ora: sei sicuri, uno già collegato', [stabile(rMano.sicuri), rMano.giaCollegati], [stabile({ movimenti: 6, persone: 5, centesimi: 50900, dal: '2023-11-05', al: '2026-09-03' }), 1])

  console.log('   il blocco dei sicuri')
  ok('collega i sei sicuri, ne restano zero', stabile(await s.collegaSicuriPersona(L[0], 500)), stabile({ collegati: 6, restano: 0 }))
  ok('…ognuno alla sua scheda (cognome e nome, accento, apostrofo, nome doppio, a capo); gli omonimi, Paolo e l\'anonimo no; il «VERDELLI» di Marco non si sposta',
    [await di(1), await di(2), await di(3), await di(4), await di(5), await di(6), await di(7), await di(8), await di(9), await di(10), await di(11), await di(12), await di(13), await di(14)],
    [giulia, marco, marco, undefined, undefined, undefined, elena, mgrazia, jose, undefined, undefined, undefined, undefined, jose])
  ok('…importi, date, casse, voci e testi sono quelli di prima', await senzaPersona(), prima)
  ok('…la chiusura è quella di prima (il giorno chiuso si è collegato lo stesso)', await chiusura(), dopoChiusura)
  ok('dopo il blocco restano negli esiti solo omonimi e senza scheda (e il «VERDELLI» collegato a mano è uscito)', [await esiti(), await conta(), await dalRiepilogo()], [['st10:nessuna', 'st4:omonimi', 'st5:omonimi', 'st6:nessuna'], [0, 2, 2], [0, 2, 2]])
  ok('rilanciato con un lotto nuovo: niente da collegare', stabile(await s.collegaSicuriPersona(L[1])), stabile({ collegati: 0, restano: 0 }))
  const r1 = await s.riepilogoCollegamentiPersona()
  ok('…il riepilogo: nessun sicuro, sette già collegati, campione vuoto', [stabile(r1.sicuri), r1.giaCollegati, r1.campione], [stabile({ movimenti: 0, persone: 0, centesimi: 0, dal: null, al: null }), 7, []])
  ok('quanti = 0', await errore(() => s.collegaSicuriPersona(L[2], 0)), 'Scegli almeno un movimento')
  ok('cinquecentouno in un colpo', await errore(() => s.collegaSicuriPersona(L[2], 501)), 'Troppi movimenti in una volta: al massimo 500')
  ok('senza lotto (vuoto o mancante)', [await errore(() => s.collegaSicuriPersona('')), await errore(() => s.collegaSicuriPersona(undefined))], ['Manca il lotto', 'Manca il lotto'])
  ok('togliere un lotto vuoto o mancante: niente da togliere, nessun errore', [stabile(await s.togliLottoCollegamenti('')), stabile(await s.togliLottoCollegamenti(undefined))], [stabile({ tolti: 0 }), stabile({ tolti: 0 })])

  console.log('   correggere, gli omonimi, scollegare, il giorno chiuso')
  ok('«VERDELLI GIULIA»: da Marco a Giulia', stabile(await s.collegaMovimentiPersona(['st2'], giulia)), stabile({ collegati: 1, giaCosi: 0 }))
  ok('rifatto uguale: già così', stabile(await s.collegaMovimentiPersona(['st2'], giulia)), stabile({ collegati: 0, giaCosi: 1 }))
  ok('i candidati di una causale con due omonime: le due, con anno di nascita e corso della prima', stabile((await s.candidatiPersonaMovimento('st4')).sort((a, b) => a.annoNascita - b.annoNascita).map((c) => [c.id, c.nome, c.cognome, c.annoNascita, c.corsi, c.iscrittoDal ?? '-'])), stabile([
    [sara1, 'Sara', 'Nerini', 2010, [corso.nome], '2024-09-10'],
    [sara2, 'Sara', 'Nerini', 2012, [], '-'],
  ]))
  ok('…anche scritta alla rovescia', (await s.candidatiPersonaMovimento('st5')).map((c) => c.id).sort(), [sara1, sara2].sort())
  ok('…una sola per Giulia, con la causale a capo e l\'accento José, nessuna per Paolo o l\'anonimo', [(await s.candidatiPersonaMovimento('st1')).map((c) => c.id), (await s.candidatiPersonaMovimento('st14')).map((c) => c.id), await s.candidatiPersonaMovimento('st6'), await s.candidatiPersonaMovimento('st10')], [[giulia], [jose], [], []])
  ok('i candidati di un movimento che non c\'è', await errore(() => s.candidatiPersonaMovimento('non-c-e')), 'Il movimento non c’è')
  ok('con una candidata sola: id, nome e cognome; anno di nascita, corsi e iscritta dal restano vuoti', (await s.candidatiPersonaMovimento('st1')).map((c) => [c.id, c.nome, c.cognome, c.annoNascita ?? null, c.corsi, c.iscrittoDal ?? null]), [[giulia, 'Giulia', 'Verdelli', null, [], null]])
  const frasiCandidati = [
    ['un\'uscita', 'st12', 'Il movimento del 03/03/2025 (Cliente Giulia Verdelli per rimborso) è un’uscita: si collegano solo le entrate'],
    ['un annullato', 'st13', 'Il movimento del 04/03/2025 (Cliente Giulia Verdelli per extra) è annullato: non si collega'],
    ['un\'entrata su un\'altra voce', 'st11', 'Il movimento del 02/03/2025 (Cliente Giulia Verdelli per regalo) è su «Non classificato»: si collegano solo quelli su «Quota associativa» e «Corsi e altri pagamenti»'],
    ['un giroconto', idsGiro, 'Un giroconto non ha una persona'],
    ['la differenza di una chiusura', idDiff, 'Il movimento del 07/09/2026 (Differenza di cassa) è scritto dalla chiusura di cassa: non si collega'],
  ]
  for (const [cosa, id, frase] of frasiCandidati) ok(`candidati, ${cosa}: rifiutati con la frase del collegamento`, await errore(() => s.candidatiPersonaMovimento(id)), frase)
  ok('la prima Sara Nerini; lo stesso id due volte conta una', stabile(await s.collegaMovimentiPersona(['st4', 'st4'], sara1)), stabile({ collegati: 1, giaCosi: 0 }))
  ok('la seconda all\'altra', stabile(await s.collegaMovimentiPersona(['st5'], sara2)), stabile({ collegati: 1, giaCosi: 0 }))
  ok('un movimento ha una persona sola: spostato sull\'altra', [stabile(await s.collegaMovimentiPersona(['st4'], sara2)), await di(4)], [stabile({ collegati: 1, giaCosi: 0 }), sara2])
  await s.collegaMovimentiPersona(['st4'], sara1)
  ok('scollegare: il quinto sì, il sesto non aveva nessuno', stabile(await s.scollegaMovimentiPersona(['st5', 'st6'])), stabile({ scollegati: 1, giaSenza: 1 }))
  ok('…rifatto: nessuno da scollegare', stabile(await s.scollegaMovimentiPersona(['st5', 'st6'])), stabile({ scollegati: 0, giaSenza: 2 }))
  ok('…scollegato, il quinto rientra negli esiti come omonimo', [(await esiti()).includes('st5:omonimi'), await conta(), await dalRiepilogo()], [true, [0, 1, 2], [0, 1, 2]])
  ok('il giorno chiuso (3 settembre, chiusa al 7) cambia scheda', [stabile(await s.collegaMovimentiPersona(['st3'], giulia)), await di(3)], [stabile({ collegati: 1, giaCosi: 0 }), giulia])
  ok('…la chiusura è quella di prima', await chiusura(), dopoChiusura)
  ok('…il giorno è ancora chiuso', await errore(() => s.registraMovimento({ tipo: 'entrata', data: '2026-09-06', importo: 100, voceId: cx.quota, personaId: giulia, cassaId: cx.contanti, descrizione: 'No' })), MSG_CHIUSO)
  ok('niente di questo ha toccato un importo, una data, una cassa, una voce', await senzaPersona(), prima)

  console.log('   quel che non va si rifiuta, tutto o niente')
  const tutto = async () => stabile(await s.movimenti())
  const stato0 = await tutto()
  const rifiuti = [
    ['nessun movimento', [], giulia, 'Scegli almeno un movimento'],
    ['cinquecentouno movimenti', Array.from({ length: 501 }, (_, i) => `x${i}`), giulia, 'Troppi movimenti in una volta: al massimo 500'],
    ['senza persona', ['st6'], '', 'Scegli la persona'],
    ['una persona che non c\'è', ['st6'], 'non-c-e', 'Scegli la persona'],
    ['un movimento che non c\'è', ['non-c-e'], giulia, 'Il movimento non c’è'],
    ['un annullato', ['st13'], giulia, 'Il movimento del 04/03/2025 (Cliente Giulia Verdelli per extra) è annullato: non si collega'],
    ['un giroconto', [idsGiro], giulia, 'Un giroconto non ha una persona'],
    ['un\'uscita', ['st12'], giulia, 'Il movimento del 03/03/2025 (Cliente Giulia Verdelli per rimborso) è un’uscita: si collegano solo le entrate'],
    ['la differenza di una chiusura', [idDiff], giulia, 'Il movimento del 07/09/2026 (Differenza di cassa) è scritto dalla chiusura di cassa: non si collega'],
    ['un\'entrata su un\'altra voce', ['st11'], giulia, 'Il movimento del 02/03/2025 (Cliente Giulia Verdelli per regalo) è su «Non classificato»: si collegano solo quelli su «Quota associativa» e «Corsi e altri pagamenti»'],
    ['uno cattivo in fondo ferma tutto e dice quale', ['st5', 'st6', 'st11'], sara2, 'Il movimento del 02/03/2025 (Cliente Giulia Verdelli per regalo) è su «Non classificato»: si collegano solo quelli su «Quota associativa» e «Corsi e altri pagamenti»'],
  ]
  for (const [cosa, ids, persona, messaggio] of rifiuti) ok(cosa, await errore(() => s.collegaMovimentiPersona(ids, persona)), messaggio)
  ok('scollegare: nessun movimento', await errore(() => s.scollegaMovimentiPersona([])), 'Scegli almeno un movimento')
  ok('scollegare: cinquecentouno', await errore(() => s.scollegaMovimentiPersona(Array.from({ length: 501 }, (_, i) => `x${i}`))), 'Troppi movimenti in una volta: al massimo 500')
  ok('scollegare: un movimento che non c\'è', await errore(() => s.scollegaMovimentiPersona(['non-c-e'])), 'Il movimento non c’è')
  ok('dei rifiuti non è rimasto niente', await tutto(), stato0)

  console.log('   TOGLI QUESTO LOTTO')
  await s.collegaMovimentiPersona(['st8'], anna)
  ok('si toglie il lotto: tornano senza persona solo i quattro che nessuno ha toccato', stabile(await s.togliLottoCollegamenti(L[0])), stabile({ tolti: 4 }))
  ok('…quelli ricollegati a mano restano dove li ha messi la mano', await stato(), stabile([undefined, giulia, giulia, sara1, undefined, undefined, undefined, anna, undefined, undefined, undefined, undefined, undefined, undefined]))
  ok('togliere due volte lo stesso lotto, o un lotto che non c\'è: niente da togliere', [stabile(await s.togliLottoCollegamenti(L[0])), stabile(await s.togliLottoCollegamenti('11111111-aaaa-0000-0000-000000000099'))], [stabile({ tolti: 0 }), stabile({ tolti: 0 })])
  ok('…tolto il lotto, i conti sono uguali', await senzaPersona(), prima)
  const r2 = await s.riepilogoCollegamentiPersona()
  ok('gli esiti ritrovano i quattro sicuri, come il riepilogo', [await conta(), await dalRiepilogo()], [[4, 1, 2], [4, 1, 2]])
  ok('il riepilogo ritrova i quattro sicuri (Giulia, Elena, José)', [stabile(r2.sicuri), r2.giaCollegati], [stabile({ movimenti: 4, persone: 3, centesimi: 40700, dal: '2023-11-05', al: '2026-05-10' }), 4])
  ok('un altro blocco: i quattro tornano, i due di un\'altra persona non si spostano', [stabile(await s.collegaSicuriPersona(L[2])), (await di(3)) === giulia, (await di(8)) === anna], [stabile({ collegati: 4, restano: 0 }), true, true])
  await s.collegaMovimentiPersona(['st3'], marco)
  await s.collegaMovimentiPersona(['st8'], mgrazia)
  // Un lotto collega, poi si scollega e si ricollega a mano alla STESSA persona: togliere il lotto non lo tocca.
  const tullia = await nuova('Tullia', 'Bruni')
  m.archivio.dati.movimenti = [...m.archivio.dati.movimenti, st(29, '2025-05-05', 2800, 'Cliente Tullia Bruni per quota', { voceId: cx.quota })]
  ok('il lotto 4 collega Tullia (è l\'unico sicuro rimasto)', stabile(await s.collegaSicuriPersona('11111111-aaaa-0000-0000-000000000004')), stabile({ collegati: 1, restano: 0 }))
  await s.scollegaMovimentiPersona(['st29'])
  await s.collegaMovimentiPersona(['st29'], tullia)
  ok('togliere il lotto 4: niente, l\'ultima parola è della mano; Tullia resta collegata', [stabile(await s.togliLottoCollegamenti('11111111-aaaa-0000-0000-000000000004')), (await di(29)) === tullia], [stabile({ tolti: 0 }), true])

  console.log('   lo storico di una scheda')
  const sto = async (p) => (await s.storicoPersona(p)).map((r) => `${r.data}|${r.descrizione}|${r.importo}|${r.voce}|${r.cassa}`)
  ok('lo storico di Giulia: due movimenti, dal più recente, con voce e cassa', await sto(giulia), [
    '2025-09-03|Cliente VERDELLI GIULIA per quota associativa|3000|Quota associativa|Conto Corrente',
    '2025-09-02|Cliente Giulia Verdelli per annuale judo kids|31000|Corsi e altri pagamenti|Conto Corrente',
  ])
  ok('lo storico di Marco: il giorno chiuso, in contanti', await sto(marco), ['2026-09-03|Cliente Marco Biancardi per mensile judo|4700|Corsi e altri pagamenti|Cassa Contanti'])
  ok('una scheda senza storico, o che non c\'è: nessuno', [await sto(sara2), await sto('non-c-e')], [[], []])
  ok('un movimento annullato dopo il collegamento: l\'etichetta resta, esce dallo storico', await (async () => {
    await s.collegaMovimentiPersona(['st7'], elena)
    const prima = (await sto(elena)).length
    await s.annullaMovimento('st7')
    return [prima, (await sto(elena)).length, (await di(7)) === elena]
  })(), [1, 0, true])

  console.log('   due schede che sono la stessa persona')
  const carlo1 = await nuova('Carlo', 'Salvi')
  const carlo2 = await nuova('Carlo', 'Salvi')
  m.archivio.dati.movimenti = [...m.archivio.dati.movimenti, st(16, '2025-04-01', 3500, 'Cliente Carlo Salvi per mensile'), st(17, '2025-04-02', 3000, 'Cliente Salvi Carlo per quota', { voceId: cx.quota })]
  const r3 = await s.riepilogoCollegamentiPersona()
  ok('con due Carlo Salvi gli esiti dicono omonimi, come il riepilogo', [(await esiti()).filter((e) => /^st1[67]:/.test(e)), await conta(), await dalRiepilogo()], [['st16:omonimi', 'st17:omonimi'], [0, 3, 2], [0, 3, 2]])
  ok('con due Carlo Salvi il blocco non decide: da decidere, mai in blocco', [stabile(r3.sicuri.movimenti), stabile(r3.daDecidere), stabile(await s.collegaSicuriPersona(L[2]))], [stabile(0), stabile({ movimenti: 3, centesimi: 11000 }), stabile({ collegati: 0, restano: 0 })])
  await s.collegaMovimentiPersona(['st16'], carlo1)
  await s.collegaMovimentiPersona(['st17'], carlo2)
  await s.unisciPersone(carlo1, carlo2)
  ok('unite le schede, i movimenti di chi se ne va sono di chi resta', [await di(16), await di(17)], [carlo1, carlo1])
  ok('…lo storico di chi resta li ha tutti e due', (await sto(carlo1)).length, 2)
  ok('…e la scheda che se ne va non c\'è più', (await s.persone()).some((p) => p.id === carlo2), false)

  console.log('   un istruttore eliminato: come «on delete set null»')
  const ugo = await s.salvaPersonale({ nome: 'Ugo', cognome: 'Tirocinante', email: 'ugo.tirocinante@esempio.it', ruolo: 'istruttore' })
  await s.collegaMovimentiPersona(['st10'], ugo)
  const traccia = () => m.archivio.dati.collegamentiPersona ?? []
  ok('prima: il movimento è suo e la traccia lo nomina', [await di(10), traccia().some((x) => x.movimentoId === 'st10' && x.dopo === ugo)], [ugo, true])
  await s.eliminaIstruttore(ugo)
  ok('eliminato: il movimento resta, senza persona', [(await per('st10')) !== undefined, await di(10)], [true, undefined])
  ok('…e la traccia non nomina più la sua scheda (né prima né dopo), ma la riga c\'è ancora', [traccia().some((x) => x.prima === ugo || x.dopo === ugo), traccia().some((x) => x.movimentoId === 'st10')], [false, true])

  await s.annullaChiusuraCassa(k)
})

await sezione('quote e corsi scritti a mano con la persona (98-quote-persona.sql): stesse regole del database', async () => {
  const UNA_RIGA = 'Una quota o un corso si sposta una riga alla volta, con la persona: apri il movimento dall’elenco e cambia la voce lì.'
  const giulia = await s.salvaPersona({ nome: 'Giulia', cognome: 'Quotini' })
  const marco = await s.salvaPersona({ nome: 'Marco', cognome: 'Corsetti' })
  const ent = await s.salvaVoce({ nome: 'Eventi quote', tipo: 'entrata' })
  const base = { tipo: 'entrata', data: '2026-09-12', importo: 4500, cassaId: cx.conto }
  const seme = (id, o) => ({ id, ...base, voceId: cx.don, descrizione: `Seme ${id}`, creatoIl: '2026-09-12T10:00:00.000Z', ...o })
  const per = async (descrizione) => (await s.movimenti()).find((x) => x.descrizione === descrizione)
  const traccia = () => m.archivio.dati.collegamentiPersona ?? []
  const quanti = async () => (await s.movimenti()).length
  // Una funzione che manca o rifiuta non ferma la sezione: il risultato è il messaggio e la prova sotto fallisce da sé.
  const cosi = (f) => f().catch((e) => `ERRORE: ${e.message}`)

  console.log('   registrare: la persona è obbligatoria su una quota o un corso')
  const prima = await quanti()
  const t0 = traccia().length
  ok('una quota senza persona no', await errore(() => s.registraMovimento({ ...base, voceId: cx.quota, descrizione: 'Quota senza' })), 'Scegli la persona')
  ok('un corso senza persona no', await errore(() => s.registraMovimento({ ...base, voceId: cx.corsi, descrizione: 'Corso senza' })), 'Scegli la persona')
  ok('…con la persona vuota no', await errore(() => s.registraMovimento({ ...base, voceId: cx.quota, personaId: '', descrizione: 'Quota vuota' })), 'Scegli la persona')
  ok('una persona che non c\'è no', await errore(() => s.registraMovimento({ ...base, voceId: cx.quota, personaId: 'non-c-e', descrizione: 'Quota fantasma' })), 'Scegli la persona')
  ok('dei rifiuti non è entrato niente', [await quanti(), traccia().length], [prima, t0])
  const scheda = async (id) => JSON.stringify((await s.persone()).find((p) => p.id === id))
  const schedaPrima = await scheda(giulia)
  ok('una quota con la persona va', await errore(() => s.registraMovimento({ ...base, voceId: cx.quota, personaId: giulia, descrizione: 'Quota di Giulia' })), 'nessun errore')
  ok('un corso con la persona va', await errore(() => s.registraMovimento({ ...base, voceId: cx.corsi, personaId: marco, descrizione: 'Corso di Marco' })), 'nessun errore')
  ok('…e la scheda di Giulia resta com\'era: la quota scritta a mano non conta come pagata', await scheda(giulia), schedaPrima)
  ok('il movimento ha la persona', [(await per('Quota di Giulia')).personaId, (await per('Corso di Marco')).personaId], [giulia, marco])
  const q = await per('Quota di Giulia')
  ok('…e la traccia del collegamento: da nessuno a lei, senza lotto', traccia().filter((x) => x.movimentoId === q.id).map((x) => [x.prima, x.dopo, x.lotto]), [[undefined, giulia, undefined]])
  ok('una donazione non ha bisogno della persona, e se c\'è non si scrive', [
    await errore(() => s.registraMovimento({ ...base, voceId: cx.don, descrizione: 'Donazione senza' })),
    await errore(() => s.registraMovimento({ ...base, voceId: cx.don, personaId: giulia, descrizione: 'Donazione con' })),
    (await per('Donazione con')).personaId,
  ], ['nessun errore', 'nessun errore', undefined])
  ok('un\'uscita non ha bisogno della persona', await errore(() => s.registraMovimento({ ...base, tipo: 'uscita', voceId: cx.aff, descrizione: 'Affitto senza' })), 'nessun errore')

  console.log('   cambiare la voce: a mano una riga alla volta, con la persona')
  m.archivio.dati.movimenti = [
    ...m.archivio.dati.movimenti,
    seme('qx1'), seme('qx2'), seme('qx3'),
    seme('qp1', { origineImport: 'prima-nota:901', voceId: ent }), seme('qp2', { origineImport: 'prima-nota:902', voceId: ent }),
    seme('qq1', { voceId: cx.quota }), seme('qq2', { voceId: cx.quota, personaId: giulia }),
  ]
  const tutto = async () => stabile([await s.movimenti(), traccia(), (await Promise.all(['qx1', 'qx2', 'qx3', 'qp1'].map((id) => s.cambiVoceMovimento(id))))])
  const fermo = await tutto()
  const rifiuti = [
    ['due a mano verso Quota', ['qx1', 'qx2'], cx.quota, giulia, UNA_RIGA],
    ['…verso Corsi', ['qx1', 'qx2'], cx.corsi, giulia, UNA_RIGA],
    ['uno a mano e uno dello storico, verso Quota', ['qx1', 'qp1'], cx.quota, giulia, UNA_RIGA],
    ['uno a mano senza persona', ['qx1'], cx.quota, undefined, 'Scegli la persona'],
    ['…con la persona vuota', ['qx1'], cx.corsi, '', 'Scegli la persona'],
    ['…con una persona che non c\'è', ['qx1'], cx.quota, 'non-c-e', 'Scegli la persona'],
  ]
  for (const [cosa, ids, voce, persona, messaggio] of rifiuti) ok(cosa, await errore(() => s.cambiaVoceMovimenti(ids, voce, persona)), messaggio)
  ok('dei rifiuti non è cambiato niente, nemmeno le tracce', await tutto(), fermo)
  ok('uno a mano con la persona: cambiato', stabile(await s.cambiaVoceMovimenti(['qx1'], cx.quota, giulia)), stabile({ cambiati: 1, giaCosi: 0 }))
  const x1 = await per('Seme qx1')
  ok('…ha la voce nuova e la persona', [x1.voceId, x1.personaId], [cx.quota, giulia])
  ok('…la traccia del cambio voce c\'è', (await s.cambiVoceMovimento('qx1')).map((c) => [c.prima, c.dopo]), [['Donazioni', 'Quota associativa']])
  ok('…e quella del collegamento', traccia().filter((x) => x.movimentoId === 'qx1').map((x) => [x.prima, x.dopo, x.lotto]), [[undefined, giulia, undefined]])
  ok('lo storico in blocco verso Quota senza persona: come oggi', [stabile(await s.cambiaVoceMovimenti(['qp1', 'qp2'], cx.quota)), (await per('Seme qp1')).personaId, (await per('Seme qp2')).voceId], [stabile({ cambiati: 2, giaCosi: 0 }), undefined, cx.quota])
  ok('movimenti già sulla voce di arrivo: già così, la persona non serve', stabile(await s.cambiaVoceMovimenti(['qq1', 'qq2'], cx.quota)), stabile({ cambiati: 0, giaCosi: 2 }))
  ok('altre voci in blocco, a mano compresi: come oggi', [stabile(await s.cambiaVoceMovimenti(['qx2', 'qx3'], ent)), (await per('Seme qx2')).voceId, (await per('Seme qx2')).personaId], [stabile({ cambiati: 2, giaCosi: 0 }), ent, undefined])

  console.log('   la scheda: gli scritti in contabilità a parte dallo storico')
  m.archivio.dati.movimenti = [...m.archivio.dati.movimenti, seme('qs1', { origineImport: 'prima-nota:903', voceId: cx.quota, descrizione: 'Cliente Giulia Quotini per quota' })]
  await s.collegaMovimentiPersona(['qs1'], giulia)
  const dellaScheda = (await s.storicoPersona(giulia)).map((r) => `${r.descrizione}|${r.aMano}`).sort()
  ok('lo storico di Giulia dice quali sono scritti a mano (aMano) e quali vengono dal vecchio programma', dellaScheda, ['Cliente Giulia Quotini per quota|false', 'Quota di Giulia|true', 'Seme qq2|true', 'Seme qx1|true'].sort())

  console.log('   collegare: un\'entrata a mano su Quota o Corsi si collega, il blocco la lascia stare')
  m.archivio.dati.movimenti = [...m.archivio.dati.movimenti, seme('qc1', { voceId: cx.corsi, descrizione: 'Cliente Marco Corsetti per Satispay' })]
  ok('i candidati di un\'entrata a mano: la scheda col nome, non un rifiuto', await cosi(async () => (await s.candidatiPersonaMovimento('qc1')).map((c) => c.id)), [marco])
  const riepilogo = await s.riepilogoCollegamentiPersona()
  ok('il riepilogo e gli esiti non la contano', [(await s.esitiCollegamentiPersona()).some((e) => e.id === 'qc1'), riepilogo.sicuri.movimenti], [false, 0])
  ok('il blocco automatico non la collega', [stabile(await s.collegaSicuriPersona('11111111-aaaa-0000-0000-0000000000a1')), (await per('Cliente Marco Corsetti per Satispay')).personaId], [stabile({ collegati: 0, restano: 0 }), undefined])
  ok('a mano sì', [await cosi(async () => stabile(await s.collegaMovimentiPersona(['qc1'], marco))), (await per('Cliente Marco Corsetti per Satispay')).personaId], [stabile({ collegati: 1, giaCosi: 0 }), marco])
  ok('…e si scollega', [await cosi(async () => stabile(await s.scollegaMovimentiPersona(['qc1']))), (await per('Cliente Marco Corsetti per Satispay')).personaId], [stabile({ scollegati: 1, giaSenza: 0 }), undefined])
  ok('una donazione a mano no: non è quota né corso', await errore(() => s.collegaMovimentiPersona(['qx2'], marco)), 'Il movimento del 12/09/2026 (Seme qx2) è su «Eventi quote»: si collegano solo quelli su «Quota associativa» e «Corsi e altri pagamenti»')
})

// ---- Il database vero: le chiamate giuste, e il file 59 che può mancare.
const MANCA_CONTABILITA = 'Il database non è ancora aggiornato per la contabilità: va lanciato 59-contabilita.sql'
const tabelleContab = {
  voci_contabili: [
    { id: 'v1', nome: 'Quota associativa', tipo: 'entrata', di_sistema: true, attiva: true },
    { id: 'v2', nome: 'Affitto sala', tipo: 'uscita', di_sistema: false, attiva: false },
  ],
  casse: [
    { id: 'c1', nome: 'Cassa Contanti', saldo_iniziale: 10000, dal: '2026-09-01' },
    { id: 'c2', nome: 'Conto Corrente', saldo_iniziale: 0, dal: null },
  ],
  movimenti: [
    { id: 'm1', tipo: 'uscita', data: '2026-09-12', importo: 2500, voce_id: 'v2', cassa_id: 'c1', cassa_a_id: null, descrizione: 'Affitto', nota: 'Pagato a mano', creato_il: '2026-09-12T08:00:00+00:00', annullato_il: null },
    { id: 'm2', tipo: 'giroconto', data: '2026-09-15', importo: 1000, voce_id: null, cassa_id: 'c1', cassa_a_id: 'c2', descrizione: 'Giroconto da Cassa Contanti a Conto Corrente', nota: null, creato_il: '2026-09-15T08:00:00+00:00', annullato_il: '2026-09-16T08:00:00+00:00' },
  ],
}
// Un client finto: le tabelle rispondono con `lettura(nome)`, le funzioni con `funzione(nome)`.
const clientContab = ({ lettura = (t) => ({ data: tabelleContab[t] ?? [], error: null }), funzione = (f) => ({ data: ['salva_voce', 'registra_movimento', 'registra_giroconto'].includes(f) ? { id: 'nuovo-1' } : null, error: null }) } = {}) => {
  const chiamate = []
  const risposta = (r) => {
    const c = new Proxy(() => c, { get: (_, k) => (k === 'range' ? (da) => (da ? oltre : c) : k === 'then' ? (f, ko) => Promise.resolve(r).then(f, ko) : () => c), apply: () => c })
    return c
  }
  const db = { from: (t) => risposta(lettura(t)), rpc: async (f, x) => (chiamate.push([f, x]), funzione(f)) }
  return { db: m.creaSegreteriaSupabase(db), chiamate }
}

await sezione('la contabilità sul database (client finto): le letture', async () => {
  const { db } = clientContab()
  const perId = (a, b) => (a.id < b.id ? -1 : 1)
  ok('le voci, dai nomi del database', stabile((await db.voci()).sort(perId)), stabile([{ id: 'v1', nome: 'Quota associativa', tipo: 'entrata', diSistema: true, attiva: true }, { id: 'v2', nome: 'Affitto sala', tipo: 'uscita', diSistema: false, attiva: false }]))
  ok('le casse: la data che manca non c\'è', stabile((await db.casse()).sort(perId)), stabile([{ id: 'c1', nome: 'Cassa Contanti', saldoIniziale: 10000, dal: '2026-09-01' }, { id: 'c2', nome: 'Conto Corrente', saldoIniziale: 0 }]))
  ok('i movimenti: voce e nota che mancano non ci sono, l\'annullo sì', stabile((await db.movimenti()).sort(perId)), stabile([
    { id: 'm1', tipo: 'uscita', data: '2026-09-12', importo: 2500, voceId: 'v2', cassaId: 'c1', descrizione: 'Affitto', nota: 'Pagato a mano', creatoIl: '2026-09-12T08:00:00+00:00' },
    { id: 'm2', tipo: 'giroconto', data: '2026-09-15', importo: 1000, cassaId: 'c1', cassaAId: 'c2', descrizione: 'Giroconto da Cassa Contanti a Conto Corrente', creatoIl: '2026-09-15T08:00:00+00:00', annullatoIl: '2026-09-16T08:00:00+00:00' },
  ]))
})

await sezione('la contabilità sul database (client finto): le funzioni giuste coi parametri giusti', async () => {
  const { db, chiamate } = clientContab()
  const ultima = () => stabile(chiamate.at(-1))
  ok('salvaVoce rende l\'id e manda nome ripulito e tipo', [await db.salvaVoce({ nome: ' Pulizie ', tipo: 'uscita' }), ultima()], ['nuovo-1', stabile(['salva_voce', { dati: { nome: 'Pulizie', tipo: 'uscita' } }])])
  await db.rinominaVoce('v2', 'Affitto locali')
  ok('rinominaVoce', ultima(), stabile(['rinomina_voce', { id: 'v2', nome: 'Affitto locali' }]))
  await db.attivaVoce('v2', true)
  ok('attivaVoce', ultima(), stabile(['imposta_voce_attiva', { id: 'v2', attiva: true }]))
  await db.salvaSaldoCassa('c1', 12000, '2026-09-01')
  ok('salvaSaldoCassa con la data', ultima(), stabile(['imposta_saldo_cassa', { id: 'c1', saldo: 12000, dal: '2026-09-01' }]))
  await db.salvaSaldoCassa('c2', 0)
  ok('…e senza: la data è null', ultima(), stabile(['imposta_saldo_cassa', { id: 'c2', saldo: 0, dal: null }]))
  const mov = { tipo: 'entrata', data: '2026-09-10', importo: 4000, voceId: 'v1', cassaId: 'c2', descrizione: ' Offerta di Rossi ' }
  ok('registraMovimento rende l\'id e manda i campi del database', [await db.registraMovimento(mov), ultima()], ['nuovo-1', stabile(['registra_movimento', { dati: { tipo: 'entrata', data: '2026-09-10', importo: 4000, voce_id: 'v1', cassa_id: 'c2', descrizione: 'Offerta di Rossi', nota: null } }])])
  await db.registraMovimento({ ...mov, nota: ' per la gara ' })
  ok('…con la nota ripulita', ultima(), stabile(['registra_movimento', { dati: { tipo: 'entrata', data: '2026-09-10', importo: 4000, voce_id: 'v1', cassa_id: 'c2', descrizione: 'Offerta di Rossi', nota: 'per la gara' } }]))
  await db.registraMovimento({ ...mov, voceId: 'v1', personaId: 'p1' })
  ok('…con la persona (una quota o un corso): `persona_id`', ultima(), stabile(['registra_movimento', { dati: { tipo: 'entrata', data: '2026-09-10', importo: 4000, voce_id: 'v1', cassa_id: 'c2', descrizione: 'Offerta di Rossi', nota: null, persona_id: 'p1' } }]))
  ok('registraGiroconto rende l\'id e manda da, a, data, importo, nota', [await db.registraGiroconto({ daCassaId: 'c1', aCassaId: 'c2', data: '2026-09-15', importo: 1000 }), ultima()], ['nuovo-1', stabile(['registra_giroconto', { dati: { da: 'c1', a: 'c2', data: '2026-09-15', importo: 1000, nota: null } }])])
  await db.annullaMovimento('m1')
  ok('annullaMovimento', ultima(), stabile(['annulla_movimento', { id: 'm1' }]))
  await db.correggiTestoMovimento('m1', ' Affitto di settembre ')
  ok('correggiTestoMovimento, senza nota', ultima(), stabile(['correggi_testo_movimento', { id: 'm1', descrizione: 'Affitto di settembre', nota: null }]))
  await db.correggiTestoMovimento('m1', 'Affitto', ' pagato ')
  ok('…e con la nota ripulita', ultima(), stabile(['correggi_testo_movimento', { id: 'm1', descrizione: 'Affitto', nota: 'pagato' }]))
})

await sezione('la contabilità sul database (client finto): gli errori', async () => {
  const guasto = (error) => clientContab({ funzione: () => ({ data: null, error }) }).db
  ok('un rifiuto del database arriva com\'è', await errore(() => guasto({ code: '22023', message: 'La data non si capisce' }).annullaMovimento('m1')), 'La data non si capisce')
  ok('«già annullato» arriva com\'è', await errore(() => guasto({ code: 'P0002', message: 'Il movimento è già annullato' }).annullaMovimento('m1')), 'Il movimento è già annullato')
  const vietato = await errore(() => guasto({ code: '42501', message: 'la contabilità la cura l’amministrazione' }).annullaMovimento('m1'))
  ok('chi non è amministrazione sente dire amministrazione, non segreteria', [/amministrazione/.test(vietato), /segreteria/.test(vietato)], [true, false])
})

await sezione('la contabilità sul database (client finto): senza 59-contabilita.sql', async () => {
  const senzaFunzioni = (codice, messaggio) => clientContab({ funzione: (f) => ({ data: null, error: { code: codice, message: messaggio(f) } }) }).db
  const senzaTabelle = (codice, messaggio) => clientContab({ lettura: (t) => ({ data: null, error: { code: codice, message: messaggio(t) } }) }).db
  const scritture = {
    salvaVoce: (d) => d.salvaVoce({ nome: 'Pulizie', tipo: 'uscita' }),
    rinominaVoce: (d) => d.rinominaVoce('v2', 'Affitto locali'),
    attivaVoce: (d) => d.attivaVoce('v2', false),
    salvaSaldoCassa: (d) => d.salvaSaldoCassa('c1', 100, '2026-09-01'),
    registraMovimento: (d) => d.registraMovimento({ tipo: 'entrata', data: '2026-09-10', importo: 4000, voceId: 'v1', cassaId: 'c2', descrizione: 'Offerta' }),
    registraGiroconto: (d) => d.registraGiroconto({ daCassaId: 'c1', aCassaId: 'c2', data: '2026-09-15', importo: 1000 }),
    annullaMovimento: (d) => d.annullaMovimento('m1'),
    correggiTestoMovimento: (d) => d.correggiTestoMovimento('m1', 'Affitto'),
  }
  const letture = { voci: (d) => d.voci(), casse: (d) => d.casse(), movimenti: (d) => d.movimenti() }
  for (const [codice, messaggio] of [['PGRST202', (f) => `Could not find the function public.${f} in the schema cache`], ['42883', (f) => `function ${f}(jsonb) does not exist`]])
    for (const [nome, chiama] of Object.entries(scritture)) ok(`senza 59: ${nome} (${codice}) dice quale file lanciare`, await errore(() => chiama(senzaFunzioni(codice, messaggio))), MANCA_CONTABILITA)
  for (const [codice, messaggio] of [['PGRST205', (t) => `Could not find the table 'public.${t}' in the schema cache`], ['42P01', (t) => `relation "${t}" does not exist`]])
    for (const [nome, chiama] of Object.entries(letture)) ok(`senza 59: ${nome} (${codice}) dice quale file lanciare`, await errore(() => chiama(senzaTabelle(codice, messaggio))), MANCA_CONTABILITA)
})

// ---- Cambiare la voce sul database vero: le chiamate giuste, e il file 67 che può mancare.
const MANCA_CAMBIA_VOCE = 'Il database non è ancora aggiornato per cambiare la voce dei movimenti: va lanciato 67-cambia-voce.sql'
// Come le dà il database: dal più vecchio (il client finto non ordina).
const righeCambi = [
  { id: 'x1', movimento_id: 'm1', voce_prima_id: null, voce_dopo_id: 'v2', cambiato_il: '2026-09-17T10:00:00+00:00', cambiato_da: null },
  { id: 'x2', movimento_id: 'm1', voce_prima_id: 'v2', voce_dopo_id: 'v1', cambiato_il: '2026-09-18T10:00:00+00:00', cambiato_da: null },
]

await sezione('cambiare la voce sul database (client finto): la funzione giusta coi parametri giusti', async () => {
  const { db, chiamate } = clientContab({ funzione: () => ({ data: { cambiati: 2, gia_cosi: 1 }, error: null }) })
  const r = await db.cambiaVoceMovimenti(['m1', 'm2', 'm3'], 'v2')
  ok('manda gli id e la voce, e rende cambiati e già così', [stabile(r), stabile(chiamate.at(-1))], [stabile({ cambiati: 2, giaCosi: 1 }), stabile(['cambia_voce_movimenti', { ids: ['m1', 'm2', 'm3'], voce: 'v2' }])])
  await db.cambiaVoceMovimenti(['m1'], 'v1', 'p1')
  ok('con la persona (una quota o un corso): la manda come `persona`', stabile(chiamate.at(-1)), stabile(['cambia_voce_movimenti', { ids: ['m1'], voce: 'v1', persona: 'p1' }]))
})

await sezione('cambiare la voce sul database (client finto): la traccia', async () => {
  const { db } = clientContab({ lettura: (t) => ({ data: t === 'cambi_voce' ? righeCambi : tabelleContab[t] ?? [], error: null }) })
  ok('dal più vecchio; la voce che non c\'era è un trattino; chi non c\'è più pure', stabile((await db.cambiVoceMovimento('m1')).map((c) => [c.prima, c.dopo, c.chi])), stabile([['—', 'Affitto sala', '—'], ['Affitto sala', 'Quota associativa', '—']]))
})

await sezione('cambiare la voce sul database (client finto): gli errori', async () => {
  const guasto = (error) => clientContab({ funzione: () => ({ data: null, error }) }).db
  ok('un rifiuto del database arriva com\'è', await errore(() => guasto({ code: '22023', message: 'Il movimento del 12/03/2019 (BONIFICO) è annullato: non si cambia' }).cambiaVoceMovimenti(['m1'], 'v2')), 'Il movimento del 12/03/2019 (BONIFICO) è annullato: non si cambia')
  const vietato = await errore(() => guasto({ code: '42501', message: 'la contabilità la cura l’amministrazione' }).cambiaVoceMovimenti(['m1'], 'v2'))
  ok('chi non è amministrazione sente dire amministrazione, non segreteria', [/amministrazione/.test(vietato), /segreteria/.test(vietato)], [true, false])
})

await sezione('cambiare la voce sul database (client finto): senza 67-cambia-voce.sql', async () => {
  const senzaFunzione = (codice, messaggio) => clientContab({ funzione: (f) => ({ data: null, error: { code: codice, message: messaggio(f) } }) }).db
  const senzaTabella = (codice, messaggio) => clientContab({ lettura: (t) => ({ data: null, error: { code: codice, message: messaggio(t) } }) }).db
  for (const [codice, messaggio] of [['PGRST202', (f) => `Could not find the function public.${f}(ids, voce) in the schema cache`], ['42883', (f) => `function ${f}(uuid[], uuid) does not exist`]])
    ok(`senza 67: cambiaVoceMovimenti (${codice}) dice quale file lanciare`, await errore(() => senzaFunzione(codice, messaggio).cambiaVoceMovimenti(['m1'], 'v2')), MANCA_CAMBIA_VOCE)
  for (const [codice, messaggio] of [['PGRST205', (t) => `Could not find the table 'public.${t}' in the schema cache`], ['42P01', (t) => `relation "${t}" does not exist`]])
    ok(`senza 67: la traccia (${codice}) dice quale file lanciare`, await errore(() => senzaTabella(codice, messaggio).cambiVoceMovimento('m1')), MANCA_CAMBIA_VOCE)
  ok('senza 59 il messaggio resta quello della contabilità', await errore(() => clientContab({ funzione: (f) => ({ data: null, error: { code: 'PGRST202', message: `Could not find the function public.${f} in the schema cache` } }) }).db.annullaMovimento('m1')), MANCA_CONTABILITA)
})

// ---- Collegare lo storico alla persona sul database vero: le chiamate giuste, e il file 70 che può mancare.
const MANCA_MOVIMENTI_PERSONA = 'Il database non è ancora aggiornato per collegare i movimenti alle persone: va lanciato 70-movimenti-persona.sql'
const LOTTO = '11111111-aaaa-0000-0000-000000000001'

await sezione('collegare lo storico alla persona sul database (client finto): le funzioni giuste coi parametri giusti', async () => {
  const chiama = async (risposta, f) => {
    const { db, chiamate } = clientContab({ funzione: () => ({ data: risposta, error: null }) })
    const r = await f(db)
    return [r, chiamate.at(-1)]
  }
  const [rie, cRie] = await chiama({ sicuri: { movimenti: 7, persone: 5, centesimi: 53900, dal: '2023-11-05', al: '2026-09-03' }, da_decidere: { movimenti: 2, centesimi: 9000 }, senza_scheda: { movimenti: 2, centesimi: 7500 }, gia_collegati: 1, campione: [{ causale: 'Cliente Giulia Verdelli per quota', persona: 'Giulia Verdelli' }] }, (db) => db.riepilogoCollegamentiPersona())
  ok('il riepilogo: la funzione, e i nomi del database in camelCase', [cRie[0], stabile(rie)], ['riepilogo_collegamenti_persona', stabile({
    sicuri: { movimenti: 7, persone: 5, centesimi: 53900, dal: '2023-11-05', al: '2026-09-03' },
    daDecidere: { movimenti: 2, centesimi: 9000 },
    senzaScheda: { movimenti: 2, centesimi: 7500 },
    giaCollegati: 1,
    campione: [{ causale: 'Cliente Giulia Verdelli per quota', persona: 'Giulia Verdelli' }],
  })])
  const [sic, cSic] = await chiama({ collegati: 3, restano: 4 }, (db) => db.collegaSicuriPersona(LOTTO, 3))
  ok('il blocco: lotto e quanti, collegati e restano', [stabile(sic), stabile(cSic)], [stabile({ collegati: 3, restano: 4 }), stabile(['collega_sicuri_persona', { lotto: LOTTO, quanti: 3 }])])
  const [man, cMan] = await chiama({ collegati: 2, gia_cosi: 1 }, (db) => db.collegaMovimentiPersona(['m1', 'm2', 'm3'], 'p1'))
  ok('a mano: gli id e la persona, collegati e già così', [stabile(man), stabile(cMan)], [stabile({ collegati: 2, giaCosi: 1 }), stabile(['collega_movimenti_persona', { ids: ['m1', 'm2', 'm3'], persona: 'p1' }])])
  const [scol, cScol] = await chiama({ scollegati: 1, gia_senza: 1 }, (db) => db.scollegaMovimentiPersona(['m1', 'm2']))
  ok('scollegare: gli id, scollegati e già senza', [stabile(scol), stabile(cScol)], [stabile({ scollegati: 1, giaSenza: 1 }), stabile(['scollega_movimenti_persona', { ids: ['m1', 'm2'] }])])
  const [tolti, cTolti] = await chiama({ tolti: 4 }, (db) => db.togliLottoCollegamenti(LOTTO))
  ok('togli questo lotto: il lotto, quanti tolti', [stabile(tolti), stabile(cTolti)], [stabile({ tolti: 4 }), stabile(['togli_lotto_collegamenti', { lotto: LOTTO }])])
  const [cand, cCand] = await chiama([{ id: 'p1', nome: 'Sara', cognome: 'Nerini', anno_nascita: 2010, corsi: ['Judo kids'], iscritto_dal: '2024-09-10' }, { id: 'p2', nome: 'Sara', cognome: 'Nerini', anno_nascita: null, corsi: [], iscritto_dal: null }], (db) => db.candidatiPersonaMovimento('m4'))
  ok('i candidati: il movimento, le persone con i nomi in camelCase', [stabile(cand.map((c) => [c.id, c.nome, c.cognome, c.annoNascita ?? null, c.corsi, c.iscrittoDal ?? null])), stabile(cCand)], [stabile([['p1', 'Sara', 'Nerini', 2010, ['Judo kids'], '2024-09-10'], ['p2', 'Sara', 'Nerini', null, [], null]]), stabile(['candidati_persona_movimento', { movimento: 'm4' }])])
  const [sto, cSto] = await chiama([{ id: 'm1', data: '2025-09-03', descrizione: 'Cliente Giulia Verdelli per quota', importo: 3000, voce: 'Quota associativa', cassa: 'Conto Corrente' }], (db) => db.storicoPersona('p1'))
  // Cambiata da 98-quote-persona.sql: senza `a_mano` (database prima del 98) la riga è dello storico, `aMano: false`.
  ok('lo storico di una scheda: la persona, le righe com\'erano', [stabile(sto), stabile(cSto)], [stabile([{ id: 'm1', data: '2025-09-03', descrizione: 'Cliente Giulia Verdelli per quota', importo: 3000, voce: 'Quota associativa', cassa: 'Conto Corrente', aMano: false }]), stabile(['storico_persona', { persona: 'p1' }])])
  const [stoMano] = await chiama([{ id: 'm2', data: '2026-09-10', descrizione: 'Quota di Giulia', importo: 4000, voce: 'Quota associativa', cassa: 'Cassa Contanti', a_mano: true }], (db) => db.storicoPersona('p1'))
  ok('…e `a_mano` del database diventa `aMano`', stabile(stoMano), stabile([{ id: 'm2', data: '2026-09-10', descrizione: 'Quota di Giulia', importo: 4000, voce: 'Quota associativa', cassa: 'Cassa Contanti', aMano: true }]))
  ok('senza righe: lista vuota (il database può rendere null)', (await chiama(null, (db) => db.storicoPersona('p1')))[0], [])
  const [esi, cEsi] = await chiama([{ id: 'm1', esito: 'sicuro' }, { id: 'm2', esito: 'omonimi' }, { id: 'm3', esito: 'nessuna' }], (db) => db.esitiCollegamentiPersona())
  ok('gli esiti per riga: la funzione senza parametri, le righe com\'erano', [cEsi[0], cEsi[1] ?? null, stabile(esi)], ['esiti_collegamenti_persona', null, stabile([{ id: 'm1', esito: 'sicuro' }, { id: 'm2', esito: 'omonimi' }, { id: 'm3', esito: 'nessuna' }])])
  ok('…senza righe (null): lista vuota', (await chiama(null, (db) => db.esitiCollegamentiPersona()))[0], [])
})

await sezione('collegare lo storico alla persona sul database (client finto): gli errori', async () => {
  const guasto = (error) => clientContab({ funzione: () => ({ data: null, error }) }).db
  ok('un rifiuto del database arriva com\'è', await errore(() => guasto({ code: '22023', message: 'Il movimento del 12/03/2019 (BONIFICO) è annullato: non si collega' }).collegaMovimentiPersona(['m1'], 'p1')), 'Il movimento del 12/03/2019 (BONIFICO) è annullato: non si collega')
  const vietato = await errore(() => guasto({ code: '42501', message: 'la contabilità la cura l’amministrazione' }).collegaMovimentiPersona(['m1'], 'p1'))
  ok('chi non è amministrazione sente dire amministrazione, non segreteria', [/amministrazione/.test(vietato), /segreteria/.test(vietato)], [true, false])
  const vietatoBlocco = await errore(() => guasto({ code: '42501', message: 'la contabilità la cura l’amministrazione' }).collegaSicuriPersona(LOTTO))
  ok('…anche per il blocco', [/amministrazione/.test(vietatoBlocco), /segreteria/.test(vietatoBlocco)], [true, false])
  const vietatoEsiti = await errore(() => guasto({ code: '42501', message: 'la contabilità la cura l’amministrazione' }).esitiCollegamentiPersona())
  ok('…e per gli esiti per riga', [/amministrazione/.test(vietatoEsiti), /segreteria/.test(vietatoEsiti)], [true, false])
})

await sezione('collegare lo storico alla persona sul database (client finto): senza 70-movimenti-persona.sql', async () => {
  const senzaFunzione = (codice, messaggio) => clientContab({ funzione: (f) => ({ data: null, error: { code: codice, message: messaggio(f) } }) }).db
  const chiamate = {
    riepilogoCollegamentiPersona: (db) => db.riepilogoCollegamentiPersona(),
    collegaSicuriPersona: (db) => db.collegaSicuriPersona(LOTTO, 3),
    collegaMovimentiPersona: (db) => db.collegaMovimentiPersona(['m1'], 'p1'),
    scollegaMovimentiPersona: (db) => db.scollegaMovimentiPersona(['m1']),
    togliLottoCollegamenti: (db) => db.togliLottoCollegamenti(LOTTO),
    candidatiPersonaMovimento: (db) => db.candidatiPersonaMovimento('m1'),
    storicoPersona: (db) => db.storicoPersona('p1'),
    esitiCollegamentiPersona: (db) => db.esitiCollegamentiPersona(),
  }
  for (const [codice, messaggio] of [['PGRST202', (f) => `Could not find the function public.${f}(ids, persona) in the schema cache`], ['42883', (f) => `function ${f}(uuid[], uuid) does not exist`]])
    for (const [nome, chiama] of Object.entries(chiamate)) ok(`senza 70: ${nome} (${codice}) dice quale file lanciare`, await errore(() => chiama(senzaFunzione(codice, messaggio))), MANCA_MOVIMENTI_PERSONA)
})

// ---- La chiusura di cassa sul database vero: le chiamate giuste, e il file 60 che può mancare.
const MANCA_CHIUSURA = 'Il database non è ancora aggiornato per la chiusura della cassa: va lanciato 60-chiusura-cassa.sql'
const righeChiusure = [
  { id: 'h1', cassa_id: 'c1', dal: '2026-09-01', data: '2026-09-07', previsto: 10000, contato: 9500, differenza: -500, nota: 'Contati in cassa', movimento_id: 'm9', chiusa_da: null, chiusa_il: '2026-09-07T18:00:00+00:00', annullata_il: '2026-09-08T09:00:00+00:00', annullata_da: null },
  { id: 'h2', cassa_id: 'c1', dal: '2026-09-08', data: '2026-09-20', previsto: 9500, contato: 9500, differenza: 0, nota: null, movimento_id: null, chiusa_da: null, chiusa_il: '2026-09-20T18:00:00+00:00', annullata_il: null, annullata_da: null },
]

await sezione('la chiusura di cassa sul database (client finto): le letture', async () => {
  const { db } = clientContab({ lettura: (t) => ({ data: t === 'chiusure_cassa' ? righeChiusure : [], error: null }) })
  const perId = (a, b) => (a.id < b.id ? -1 : 1)
  ok('le chiusure, dai nomi del database; chi ha chiuso e non c\'è più è un trattino; ciò che manca non c\'è', stabile((await db.chiusure()).sort(perId)), stabile([
    { id: 'h1', cassaId: 'c1', dal: '2026-09-01', data: '2026-09-07', previsto: 10000, contato: 9500, differenza: -500, nota: 'Contati in cassa', movimentoId: 'm9', chiusaDa: '—', chiusaIl: '2026-09-07T18:00:00+00:00', annullataIl: '2026-09-08T09:00:00+00:00' },
    { id: 'h2', cassaId: 'c1', dal: '2026-09-08', data: '2026-09-20', previsto: 9500, contato: 9500, differenza: 0, chiusaDa: '—', chiusaIl: '2026-09-20T18:00:00+00:00' },
  ]))
})

await sezione('la chiusura di cassa sul database (client finto): le funzioni giuste coi parametri giusti', async () => {
  const { db, chiamate } = clientContab({ funzione: () => ({ data: { id: 'nuovo-1' }, error: null }) })
  const ultima = () => stabile(chiamate.at(-1))
  ok('chiudiCassa rende l\'id e manda cassa, data, contanti e nota', [await db.chiudiCassa({ cassaId: 'c1', data: '2026-09-07', contato: 9500, nota: ' Contati in cassa ' }), ultima()],
    ['nuovo-1', stabile(['chiudi_cassa', { dati: { cassa_id: 'c1', data: '2026-09-07', contato: 9500, nota: 'Contati in cassa' } }])])
  await db.chiudiCassa({ cassaId: 'c1', data: '2026-09-07', contato: 0 })
  ok('…senza nota è null', ultima(), stabile(['chiudi_cassa', { dati: { cassa_id: 'c1', data: '2026-09-07', contato: 0, nota: null } }]))
  await db.annullaChiusuraCassa('h2')
  ok('annullaChiusuraCassa', ultima(), stabile(['annulla_chiusura_cassa', { id: 'h2' }]))
})

await sezione('la chiusura di cassa sul database (client finto): gli errori', async () => {
  const guasto = (error) => clientContab({ funzione: () => ({ data: null, error }) }).db
  const chiudi = (d) => d.chiudiCassa({ cassaId: 'c1', data: '2026-09-07', contato: 9500 })
  ok('un rifiuto del database arriva com\'è', await errore(() => chiudi(guasto({ code: '22023', message: 'Quel giorno è già chiuso: scegli un giorno dopo il 07/09/2026' }))), 'Quel giorno è già chiuso: scegli un giorno dopo il 07/09/2026')
  ok('«già annullata» arriva com\'è', await errore(() => guasto({ code: 'P0002', message: 'La chiusura è già annullata' }).annullaChiusuraCassa('h1')), 'La chiusura è già annullata')
  const vietato = await errore(() => chiudi(guasto({ code: '42501', message: 'la contabilità la cura l’amministrazione' })))
  ok('chi non è amministrazione sente dire amministrazione, non segreteria', [/amministrazione/.test(vietato), /segreteria/.test(vietato)], [true, false])
})

await sezione('la chiusura di cassa sul database (client finto): senza 60-chiusura-cassa.sql', async () => {
  const senzaFunzioni = (codice, messaggio) => clientContab({ funzione: (f) => ({ data: null, error: { code: codice, message: messaggio(f) } }) }).db
  const senzaTabelle = (codice, messaggio) => clientContab({ lettura: (t) => ({ data: null, error: { code: codice, message: messaggio(t) } }) }).db
  const scritture = {
    chiudiCassa: (d) => d.chiudiCassa({ cassaId: 'c1', data: '2026-09-07', contato: 9500 }),
    annullaChiusuraCassa: (d) => d.annullaChiusuraCassa('h1'),
  }
  for (const [codice, messaggio] of [['PGRST202', (f) => `Could not find the function public.${f} in the schema cache`], ['42883', (f) => `function ${f}(jsonb) does not exist`]])
    for (const [nome, chiama] of Object.entries(scritture)) ok(`senza 60: ${nome} (${codice}) dice quale file lanciare`, await errore(() => chiama(senzaFunzioni(codice, messaggio))), MANCA_CHIUSURA)
  for (const [codice, messaggio] of [['PGRST205', (t) => `Could not find the table 'public.${t}' in the schema cache`], ['42P01', (t) => `relation "${t}" does not exist`]])
    ok(`senza 60: chiusure (${codice}) dice quale file lanciare`, await errore(() => senzaTabelle(codice, messaggio).chiusure()), MANCA_CHIUSURA)
  // Il 59 manca davvero un'altra cosa: il messaggio resta quello della contabilità, non della chiusura.
  ok('senza 59 le chiamate di prima dicono ancora 59', await errore(() => senzaFunzioni('PGRST202', (f) => `Could not find the function public.${f} in the schema cache`).registraMovimento({ tipo: 'entrata', data: '2026-09-10', importo: 4000, voceId: 'v1', cassaId: 'c2', descrizione: 'Offerta' })), MANCA_CONTABILITA)
})

// ---------------------------------------------------------------------------
// La ricevuta una volta sola (86-ricevuta-una-volta.sql): FAI LA RICEVUTA
// ripremuto dopo una rete caduta. Il modulo aperto ha una chiave sua; con la
// stessa chiave torna la ricevuta già fatta, come `emetti_ricevuta`
// (supabase/prova/ricevute.sql, sezione 5), con gli stessi messaggi.
// ---------------------------------------------------------------------------
await sezione('la ricevuta una volta sola, in prova: la chiave del modulo', async () => {
  const [chi, altro] = await s.persone()
  const voce = (pagato) => ({ descrizione: 'Annuale Lotta 3', quantita: 1, prezzo: 36800, pagamenti: [{ data: '2024-03-01', importo: pagato, metodo: 'Bonifico' }] })
  const base = { data: '2024-03-01', personaId: chi.id, ente: await s.enteRicevute(), intestatario: { nome: chi.nome, cognome: chi.cognome }, anticipo: 0, voci: [voce(36800)] }
  // Nel 2024, così i numeri partono da 1; il numero a mano nel 2023, che è vuoto (a mano solo in un anno senza ricevute).
  const diProva = async () => (await s.ricevute()).filter((r) => r.anno === 2024 || r.anno === 2023).length
  const K = (n) => `dddddddd-0000-4000-8000-00000000000${n}`
  const prima = await s.emettiRicevuta({ ...base, chiave: K(1) })
  ok('la prima con la chiave: il numero 1', prima.numero, 1)
  const ancora = await s.emettiRicevuta({ ...base, chiave: K(1) })
  ok('la stessa chiave: torna la stessa ricevuta, col suo numero', [ancora.id, ancora.numero], [prima.id, 1])
  ok('…e la ricevuta resta una', await diProva(), 1)
  ok('la seguente senza chiave prende il numero dopo, nessuno consumato', (await s.emettiRicevuta({ ...base, data: '2024-03-02' })).numero, 2)

  const annullanda = await s.emettiRicevuta({ ...base, data: '2024-03-03', chiave: K(3) })
  await s.annullaRicevuta(annullanda.id)
  ok('la stessa chiave di una ricevuta annullata: no, e dice cosa fare', await errore(() => s.emettiRicevuta({ ...base, data: '2024-03-03', chiave: K(3) })),
    'La ricevuta n. 3/2024 fatta da questo modulo è stata annullata: chiudi il modulo e riaprilo per farne un’altra')
  ok('…e nessuna ricevuta in più', await diProva(), 3)

  const aMano = await s.emettiRicevuta({ ...base, data: '2023-03-04', numero: 50, chiave: K(4) })
  ok('il numero a mano ripetuto con la stessa chiave: non «c’è già», torna quella',
    await s.emettiRicevuta({ ...base, data: '2023-03-04', numero: 50, chiave: K(4) }).then((r) => r.id, (e) => e.message), aMano.id)
  ok('…e la ricevuta resta una', await diProva(), 4)

  ok('la stessa chiave per un’altra persona: no, e dice cosa fare',
    await errore(() => s.emettiRicevuta({ ...base, personaId: altro.id, intestatario: { nome: altro.nome, cognome: altro.cognome }, chiave: K(1) })),
    'Questa ricevuta è già stata fatta per un’altra persona: chiudi il modulo e riaprilo')
  ok('…e nessuna ricevuta in più', await diProva(), 4)

  const altriDati = await s.emettiRicevuta({ ...base, data: '2024-03-09', voci: [voce(18000)], chiave: K(1) })
  ok('la stessa chiave con altri dati: torna quella fatta, com’è', [altriDati.id, altriDati.data, altriDati.pagato], [prima.id, '2024-03-01', 36800])
  ok('…e nessuna ricevuta in più', await diProva(), 4)

  await s.emettiRicevuta({ ...base, data: '2024-03-10' })
  await s.emettiRicevuta({ ...base, data: '2024-03-10' })
  ok('senza chiave, come prima: due volte, due ricevute', await diProva(), 6)
  await s.emettiRicevuta({ ...base, data: '2024-03-10', chiave: '' })
  await s.emettiRicevuta({ ...base, data: '2024-03-10', chiave: '' })
  ok('con la chiave vuota, come senza: due ricevute', await diProva(), 8)

  ok('una chiave che non è un uuid: no, e dice cosa fare', await errore(() => s.emettiRicevuta({ ...base, data: '2024-03-11', chiave: 'non-un-uuid' })),
    'La ricevuta non si capisce: ricarica la pagina')
  ok('…e nessuna ricevuta in più', await diProva(), 8)
})

await sezione('la ricevuta una volta sola, sul database (client finto): la chiave va alle due funzioni', async () => {
  const chiamate = []
  const riga = { id: 'r1', anno: 2024, numero: 1, data: '2024-03-01', persona_id: 'p1', ente: {}, intestatario: { nome: 'Pietro', cognome: 'Chiave' }, voci: [], totale: 0, pagato: 0, anticipo: 0, note: null, creata_il: '2024-03-01T10:00:00Z', annullata_il: null }
  const db = m.creaSegreteriaSupabase({ from: () => { throw new Error('non deve leggere tabelle') }, rpc: async (f, x) => (chiamate.push([f, x]), { data: riga, error: null }) })
  const dati = {
    data: '2024-03-01', personaId: 'p1', ente: { nome: 'Asd Il Centro Judo' }, intestatario: { nome: 'Pietro', cognome: 'Chiave' }, anticipo: 0,
    voci: [{ descrizione: 'Annuale', quantita: 1, prezzo: 36800, pagamenti: [{ data: '2024-03-01', importo: 36800, metodo: 'Satispay' }] }],
    chiave: 'dddddddd-0000-4000-8000-000000000001',
  }
  await db.emettiRicevuta(dati).catch(() => {})
  await db.emettiRicevuta(dati, 'sp-1').catch(() => {})
  ok('emetti_ricevuta ed emetti_ricevuta_satispay ricevono la chiave del modulo', chiamate.map(([f, x]) => [f, x?.dati?.chiave]),
    [['emetti_ricevuta', dati.chiave], ['emetti_ricevuta_satispay', dati.chiave]])
})

await sezione('lo scarico Satispay in prova: c’è un caso da decidere, per vedere l’avviso giallo', async () => {
  const s = m.creaSegreteriaProva()
  await s.scaricaSatispay(true)
  const stato = await s.statoScaricoSatispay()
  ok('dopo l’anteprima, un pagamento da decidere per un giorno chiuso', stato.daDecidere.map((c) => c.motivo), ['giorno_chiuso'])
})

console.log(guai ? `\n${guai} COSE NON TORNANO` : '\nTUTTO A POSTO')
process.exit(guai ? 1 : 0)
