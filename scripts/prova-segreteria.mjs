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
      "export { creaSegreteriaProva } from './src/lib/segreteriaProva'; export { tocca, ordinaSegnalazioni, cosaNonVaSegnalazione, etichettaChiudi, chiudiConRisposta, visibili, troppoLungo, avvisoChiusura, rigaFilo, motivoSpento, leggiBozza, scriviBozza, svuotaBozze, chiaveBozza, conBozza, cosaNonVaAllegato, allegatiScaduti, nomeAllegato, nomeUnico, motivoSenzaRete, scegliAllegati, haAnteprima, mandaAllegati, avvisoNonPartiti, MAX_ALLEGATI } from './src/lib/segnalazioni'; export { giornoPerEsteso, chiaveGiorno, oraDi } from './src/lib/sala'; export { comeCertificato, comePaga, confermaMesiPresenze, inRegola, pagamentoDi, paroleInRegola, timbriScheda, trovaIscritti, alGiorno, nomeVoce } from './src/lib/segreteria'; export { quoteDi } from './src/lib/ricevute'; export { creaDatiProva } from './src/lib/datiProva'; export { creaTabletProva } from './src/lib/tabletProva'; export { leggiFogli, importa, leggiTabella, indovinaColonne, scelteCorsi, indovinaCorso, leggiRisposte, divideScelte, dividiNome, leggiData } from './src/lib/importa'; export { memoria } from './src/lib/datiProva'; export { arrivoDalLink } from './src/lib/invito'; export { areeDi, daRuoloScelto, nomeDelRuolo, ruoloScelto } from './src/lib/ruoli'; export { archivio } from './src/lib/archivioProva'; export { creaSegreteriaSupabase } from './src/lib/segreteriaSupabase'; export { campiDiversi, possibiliDoppioni } from './src/lib/doppioni'",
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
  ok('il tasto dice i mesi', cinque?.tasto.includes('12 MESI'), true)
  const nonSo = conferma(24, 12, null)
  ok('conteggio non riuscito: si chiede lo stesso, senza un numero di presenze',
    [nonSo !== null, nonSo?.testo.includes('le presenze'), /\d+ presenz/.test(nonSo?.testo ?? ''), nonSo?.tasto.includes('12 MESI')], [true, true, false, true])
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
  ok('l\'esportazione ha anagrafica, iscrizioni, presenze, richieste, certificato, pagamento e ricevute', Object.keys(dati).sort(), ['certificato_e_pagamento', 'dati_anagrafici', 'esportato_il', 'iscrizioni', 'persona', 'presenze', 'ricevute', 'richieste_di_iscrizione'])
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
  ok('un numero già preso no', no.startsWith('La ricevuta numero 116 del 2026 c’è già'), true)
  no = ''
  await s.emettiRicevuta({ ...base, voci: [voce(100, 200)] }).catch((e) => (no = e.message))
  ok('pagato più del totale no', no, 'Si è pagato più del totale: controlla gli importi')
  ok('a gennaio si riparte', (await s.emettiRicevuta({ ...base, data: '2027-01-10', voci: [voce(100, 100)] })).numero, 1)
  await s.annullaRicevuta(prima.id)
  const sue = await s.ricevute(chi.id)
  ok('le sue, dalla più recente, anche l\'annullata', sue.map((r) => [r.numero, !!r.annullataIl]), [[1, false], [117, false], [116, true]])
  ok('il prossimo numero salta l\'annullata', await s.prossimoNumero(2026), 118)
  ok('i dati del socio ora vengono dall\'ultima ricevuta', (await s.intestatarioDi(chi.id)).cognome, chi.cognome)
  await s.salvaEnteRicevute({ ...ente, nome: 'Asd Nuova' })
  ok('l\'associazione cambiata', (await s.enteRicevute()).nome, 'Asd Nuova')
  ok('le ricevute nell\'esportazione', (await s.esporta(chi.id)).ricevute.length, 3)
  // Una ricevuta vecchia senza codice fiscale: quello scritto dopo in DATI ANAGRAFICI ci va lo stesso.
  await s.emettiRicevuta({ ...base, data: '2027-01-11', intestatario: { nome: chi.nome, cognome: chi.cognome, indirizzo: 'via Vecchia 3' }, voci: [voce(100, 100)] })
  await s.salvaAnagrafica(chi.id, { codiceFiscale: 'RSSMRA80A01L219X', indirizzo: 'via Altra 9' })
  const dopo = await s.intestatarioDi(chi.id)
  ok('il codice fiscale scritto dopo la ricevuta vecchia: c\'è', dopo.codiceFiscale, 'RSSMRA80A01L219X')
  ok('e quel che la ricevuta dice già resta', dopo.indirizzo, 'via Vecchia 3')
}

console.log('\n10. l\'import dai fogli')
{
  const corsi = 'nome;sala;istruttore;giorno;ora;durata\r\nYoga;Sala nuova;Katia;sabato;10.00;60\r\nLotta 2;Lotta;Maura;sabato;11:00;60\r\nRotto;Pesi;;funedì;18:00;60\r\n'
  const iscritti = '\uFEFFnome;cognome;email;telefono;corso\nMarta;Nuova;marta@esempio.it;;Yoga\nGiorgia;;;;Yoga\nMarta;Nuova;marta@esempio.it;;Lotta 2\nPaolo;Verdi;marta@esempio.it;;Yoga\n'
  const f = m.leggiFogli(corsi, iscritti, (await s.corsi()).map((c) => c.nome))
  ok('le righe che non vanno', f.saltate.map((x) => `${x.foglio}:${x.riga}`), ['corsi.csv:4', 'iscritti.csv:3'])
  ok('Marta una volta sola, con due corsi', f.iscritti.map((x) => [x.nome, x.corsi]), [['Marta', ['Yoga', 'Lotta 2']], ['Paolo', ['Yoga']]])
  ok('Paolo, con la stessa email di Marta: entra senza', [f.iscritti[1].email, f.note.map((x) => `${x.foglio}:${x.riga}`)], [undefined, ['iscritti.csv:5']])
  const a1 = await m.importa(s, f, () => {})
  ok('entrano la sala, il corso, i giorni', [a1.saleNuove, a1.corsiNuovi, a1.ricorrenzeNuove], [['Sala nuova'], ['Yoga'], 2])
  ok('Katia si lega col solo nome', (await s.corsi()).find((c) => c.nome === 'Yoga').istruttori.map((i) => i.nome), ['Katia'])
  const a2 = await m.importa(s, m.leggiFogli(corsi, iscritti, (await s.corsi()).map((c) => c.nome)), () => {})
  ok('rifatto: niente di nuovo', [a2.saleNuove.length, a2.corsiNuovi.length, a2.ricorrenzeNuove, a2.iscrittiNuovi, a2.iscrizioniNuove], [0, 0, 0, 0, 0])
  ok('e nessun doppione', (await s.persone()).filter((p) => p.email === 'marta@esempio.it').length, 1)
  ok('Paolo c\'è, una volta', (await s.persone()).filter((p) => p.nome === 'Paolo' && p.cognome === 'Verdi').map((p) => p.email ?? null), [null])

  // Un altro foglio, dopo: il fratello con l'email di Marta non finisce sulla sua scheda.
  const altro = 'nome;cognome;email;telefono;corso\nLuca;Nuova;MARTA@esempio.it;333;Lotta 2\n'
  const f3 = m.leggiFogli(null, altro, (await s.corsi()).map((c) => c.nome))
  const a3 = await m.importa(s, f3, () => {})
  ok('Luca entra nuovo, e si dice perché senza email', [a3.iscrittiNuovi, a3.emailDiAltri.length], [1, 1])
  const luca = (await s.persone()).filter((p) => p.nome === 'Luca' && p.cognome === 'Nuova')
  ok('Luca a sé, senza email, con Lotta 2', luca.map((p) => [p.email ?? null, p.iscrizioni.length]), [[null, 1]])
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
  ok('le colonne si riconoscono, il genitore a parte', col, { cognome: 3, nome: 2, email: 1, telefono: 5, corsi: 6, genitore: 4 })
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
  ok('nome e cognome insieme, dell\'iscritto', c2, { nomeCompleto: 2, email: 4, telefono: 3, genitore: 1 })
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
  ok('il codice fiscale dell\'atleta, non del genitore', c3, { nomeCompleto: 2, codiceFiscale: 3, email: 1, telefono: 4, corsi: 8, genitore: 5 })
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

  // Chi aveva il file caricato prima della carta: si stampa e si cancella, la scadenza resta.
  const vecchio = tutti.find((x) => x.certificato.conFile)
  ok('in prova qualcuno ha ancora il file da stampare', !!vecchio, true)
  await s.cancellaFileCertificato(vecchio.id)
  const dopo = (await s.persone()).find((y) => y.id === vecchio.id)
  ok('stampato e cancellato: la scadenza resta', [dopo.certificato.conFile, dopo.certificato.scade], [false, vecchio.certificato.scade])
  ok('e il file non si apre più', await s.apriCertificato(vecchio.id), null)
}

console.log('\nla musica delle sale')
{
  const yt = 'https://www.youtube.com/playlist?list=PLx0sYbCqOb8TBPRdmBHs5Iftvv9TPboYG'
  const sp = 'https://open.spotify.com/intl-it/playlist/37i9dQZF1DX76Wlfdnj7AP?si=abc'
  const randori = await s.salvaListaMusica({ nome: '  Randori  ', link: yt, salaId: 'Lotta' })
  await s.salvaListaMusica({ nome: 'Riscaldamento', link: sp, salaId: null })
  await s.salvaListaMusica({ nome: 'Bambini', link: 'https://youtu.be/dQw4w9WgXcQ', salaId: 'Tatami' })
  ok('un link che non è musica no', await errore(() => s.salvaListaMusica({ nome: 'Altro', link: 'https://esempio.it/lista', salaId: null })), 'Il link non è una playlist di YouTube o di Spotify')
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
  const id = await s.salvaPersonale({ nome: 'Dora', cognome: 'Doppia', email: 'dora@esempio.it', ...m.daRuoloScelto('entrambi') })
  const dora = async () => (await s.personale()).find((p) => p.id === id)
  ok('è segreteria e insegna', m.ruoloScelto(await dora()), 'entrambi')
  ok('le si dà un corso', (await s.istruttori()).some((i) => i.id === id), true)
  ok('entra in tutte e due le aree', m.areeDi(await dora()), ['segreteria', 'istruttori'])
  ok('e lo si dice', m.nomeDelRuolo(await dora()), 'Segreteria e istruttore')
  await s.salvaPersonale({ ...(await dora()), nome: 'Dorotea' })
  ok('cambiando il nome resta doppia', m.ruoloScelto(await dora()), 'entrambi')
  await s.salvaPersonale({ ...(await dora()), ...m.daRuoloScelto('staff') })
  ok('solo segreteria', m.ruoloScelto(await dora()), 'staff')
  ok('non le si dà più un corso', (await s.istruttori()).some((i) => i.id === id), false)
  ok('entra solo in segreteria', m.areeDi(await dora()), ['segreteria'])
  await s.salvaPersonale({ ...(await dora()), ...m.daRuoloScelto('entrambi') })
  await s.salvaPersonale({ ...(await dora()), ...m.daRuoloScelto('istruttore') })
  ok('istruttore e basta', [m.ruoloScelto(await dora()), (await dora()).ancheIstruttore], ['istruttore', false])
  ok('entra solo nel calendario', m.areeDi(await dora()), ['istruttori'])
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
  ok('senza titolo no', await errore(() => s.apriSegnalazione('  ', 'qualcosa')), 'Manca il titolo')
  ok('senza testo no', await errore(() => s.apriSegnalazione('Appello', ' ')), 'Manca il testo')
  await s.apriSegnalazione(' Appello lento ', ' Ci mette tanto ')
  const [x] = await s.segnalazioni()
  ok('aperta, ripulita', [x.titolo, x.messaggi[0].testo, x.chiusaIl], ['Appello lento', 'Ci mette tanto', undefined])
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
    await s.apriSegnalazione(titolo, 'Da sistemare')
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

  ok('il titolo di 120 caratteri va', m.cosaNonVaSegnalazione('x', 'a'.repeat(120)), null)
  ok('di 121 no', m.cosaNonVaSegnalazione('x', 'a'.repeat(121)), 'Titolo troppo lungo: togli 1 carattere (massimo 120)')
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
  ok('nuova senza titolo', m.motivoSpento({ titolo: ' ', testo: 'x', lavora: false }), 'Scrivi il titolo')
  ok('nuova senza testo', m.motivoSpento({ titolo: 'Appello', testo: ' ', lavora: false }), 'Scrivi cosa non va')
  ok('troppo lunga: lo dice già la nota sotto il campo', m.motivoSpento({ titolo: 'a'.repeat(121), testo: 'x', lavora: false }), null)
  ok('tutto a posto', m.motivoSpento({ titolo: 'Appello', testo: 'lento', lavora: false }), null)

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
  const nuovaId = await s.apriSegnalazione('Con id', 'Da vedere')
  ok('aprire dà l\'id della nuova', [typeof nuovaId, (await s.segnalazioni()).at(-1).id === nuovaId], ['string', true])
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
  await s.apriSegnalazione('Con file', 'Guarda')
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
  ok('chi è solo di segreteria no', await errore(() => s.eliminaIstruttore(bea)), "Si eliminano solo gli istruttori: a Bea si toglie l'accesso")
  const dario = await s.salvaPersonale({ nome: 'Dario', cognome: 'Doppio', email: 'dario@esempio.it', ...m.daRuoloScelto('entrambi') })
  await s.eliminaIstruttore(dario)
  ok('la segreteria che insegna anche, senza corsi, sì', (await s.personale()).some((p) => p.id === dario), false)
  await s.iscrivi(altro, 'lotta-2')
  ok('chi è anche allievo no', await errore(() => s.eliminaIstruttore(altro)), "Pina Giusta è anche allievo: non si elimina, gli si toglie l'accesso")
  ok('un iscritto nemmeno', (await errore(async () => s.eliminaIstruttore((await s.persone())[0].id))).startsWith('Si eliminano solo gli istruttori'), true)
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
    { corsoId: 'pesi-1', personaId: resta, dal: '2026-02-01', al: '2026-03-31' },
    { corsoId: 'pesi-1', personaId: via, dal: '2026-03-01', al: '2026-12-31' },
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
  const colFile = await nuova('Mario', 'Damico')
  m.archivio.dati.persone = m.archivio.dati.persone.map((p) => (p.id === colFile ? { ...p, certificato: { scade: '2027-01-31', file: `${colFile}/certificato-1.pdf` } } : p))
  const file = await errore(() => s.unisciPersone(resta, colFile))
  ok('chi ha ancora il file del certificato no, e dice di stamparlo prima', /certificato/.test(file) && /stampa/i.test(file) ? 'dice di stamparlo' : file, 'dice di stamparlo')
  ok('e il file resta', (await di(colFile)).certificato.conFile, true)
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
    [['judo-2', '2026-09-14', '2027-06-30'], ['lotta-2', '2025-09-01', null], ['pesi-1', '2026-02-01', '2026-12-31']])
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
  ok('in scadenza col file: prima FRA, poi DA STAMPARE', testi(cert(fra(10), true)).slice(1), ['FRA 10 GIORNI', 'DA STAMPARE'])
  ok('certificato che scade fra 31 giorni: verde', cert(fra(31))?.tono, 'verde')
  ok('… VALIDO FINO AL gg/mm/aaaa', cert(fra(31))?.parola, `VALIDO FINO AL ${lunga(fra(31))}`)
  ok('… VALIDO FINO ALL’11/07/2027, non AL 11', cert('2027-07-11')?.parola, 'VALIDO FINO ALL’11/07/2027')
  ok('certificato scaduto ieri: rosso', cert(fra(-1))?.tono, 'rosso')
  ok('… SCADUTO IL gg/mm/aaaa', cert(fra(-1))?.parola, `SCADUTO IL ${lunga(fra(-1))}`)
  ok('nessuna data: rosso', cert(undefined)?.tono, 'rosso')
  ok('nessuna data: NO CERTIFICATO, come in elenco', cert(undefined)?.parola, 'NO CERTIFICATO')
  ok('scade oggi: giallo', cert(oggi)?.tono, 'giallo')
  ok('scade oggi: SCADE OGGI, non SCADE IL', [testi(cert(oggi)).includes('SCADE OGGI'), testi(cert(oggi)).some((x) => x.startsWith('SCADE IL'))], [true, false])

  // 2. Il file ancora da stampare: sempre giallo, anche sotto un timbro verde.
  ok('con il file e valido fino a fra 100 giorni: verde', cert(fra(100), true)?.tono, 'verde')
  ok('… e la riga DA STAMPARE gialla', riga(cert(fra(100), true), 'DA STAMPARE')?.tono, 'giallo')
  ok('con il file e senza data: rosso', cert(undefined, true)?.tono, 'rosso')
  ok('… e la riga DA STAMPARE gialla', riga(cert(undefined, true), 'DA STAMPARE')?.tono, 'giallo')
  ok('senza file, niente DA STAMPARE', cert(fra(100)) ? riga(cert(fra(100)), 'DA STAMPARE') : 'nessun timbro', null)

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
  ok('… con la riga FUORI APP', !!riga(q5, 'FUORI APP'), true)
  ok('con la ricevuta, niente FUORI APP', q1 ? riga(q1, 'FUORI APP') : 'nessun timbro', null)

  // 4. Il documento: si vede, ma non conta per «in regola».
  const doc = (documento) => timbri(persona({ documento }))?.documento
  ok('documento in segreteria: verde IN SEGRETERIA', [doc(true)?.tono, doc(true)?.parola], ['verde', 'IN SEGRETERIA'])
  ok('documento da portare: giallo DA PORTARE', [doc(false)?.tono, doc(false)?.parola], ['giallo', 'DA PORTARE'])
  // La scheda non sa l'età: il genitore lo dice la sezione DOCUMENTO, non il timbro di ogni adulto.
  ok('… e sotto solo NON SERVE PER ENTRARE', testi(doc(false)).slice(1), ['NON SERVE PER ENTRARE'])
  const senzaDoc = persona({ certificato: { scade: fra(100), conFile: false }, quote: [pagata], documento: false })
  ok('senza documento è in regola lo stesso', m.inRegola(senzaDoc, oggi), true)
  ok('… e in elenco resta IN REGOLA', inElenco(senzaDoc), [{ tono: 'verde', parola: 'IN REGOLA' }])

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
    ['niente certificato, niente quota', persona(), [{ tono: 'rosso', parola: 'NO CERTIFICATO' }, { tono: 'rosso', parola: 'DA PAGARE' }]],
    ['certificato scaduto, quota scaduta', persona({ certificato: { scade: fra(-1), conFile: false }, quote: [{ ...pagata, dal: '2025-09-01', al: fra(-1) }] }), [{ tono: 'rosso', parola: 'CERT. SCADUTO' }, { tono: 'rosso', parola: 'QUOTA SCADUTA' }]],
    ['certificato valido, quota in parte', persona({ certificato: { scade: fra(100), conFile: false }, quote: [{ ...pagata, mancano: 2000 }] }), [{ tono: 'giallo', parola: 'IN PARTE' }]],
    ['in regola', persona({ certificato: { scade: fra(100), conFile: false }, quote: [pagata] }), [{ tono: 'verde', parola: 'IN REGOLA' }]],
    ['in regola fuori dall’app', persona({ certificato: { scade: fra(100), conFile: false }, pagamento: { stato: 'pagato', fino: fra(100) } }), [{ tono: 'verde', parola: 'IN REGOLA' }, { tono: 'spento', parola: 'FUORI APP' }]],
  ]
  for (const [cosa, p, voluto] of casi) ok(`in elenco, ${cosa}: le parole di oggi`, inElenco(p), voluto)
  // In elenco la forma corta del timbro, se ne ha una (SCADUTO IL gg/mm → CERT. SCADUTO): stesso tono, stessa funzione.
  const bollino = (t) => (t ? { tono: t.tono, parola: t.inElenco ?? t.parola } : null)
  for (const [cosa, p] of casi.slice(0, 3)) {
    const t = timbri(p)
    const fuori = (inElenco(p) ?? []).filter((b) => !['IN REGOLA', 'FUORI APP'].includes(b.parola))
    const daiTimbri = [t?.certificato, t?.quota].filter((x) => x && x.tono !== 'verde').map(bollino)
    ok(`${cosa}: in elenco le stesse parole dei timbri`, inElenco(p) && t ? fuori : 'manca l’elenco o i timbri', daiTimbri)
  }
  // Il certificato in scadenza: la parola in elenco è quella del timbro, qualunque sia.
  const inScadenza = persona({ certificato: { scade: fra(10), conFile: false }, quote: [pagata] })
  ok('certificato in scadenza: in elenco la parola del timbro', inElenco(inScadenza), [bollino(timbri(inScadenza)?.certificato)])
  // In elenco la colonna è stretta: la data resta corta, senza l'anno.
  ok('certificato in scadenza: in elenco SCADE IL gg/mm', inElenco(inScadenza), [{ tono: 'giallo', parola: `SCADE IL ${corta(fra(10))}` }])
  ok('scade oggi: in elenco SCADE OGGI', inElenco(persona({ certificato: { scade: oggi, conFile: false }, quote: [pagata] })), [{ tono: 'giallo', parola: 'SCADE OGGI' }])

  // «AL» o «ALL’»: come si legge il giorno. 1, 8 e 11 cominciano per vocale.
  const al = [['2027-07-31', 'AL 31/07/2027'], ['2027-07-01', 'ALL’1/07/2027'], ['2027-08-08', 'ALL’8/08/2027'], ['2027-07-11', 'ALL’11/07/2027'], ['2027-07-18', 'AL 18/07/2027'], ['2027-07-05', 'AL 05/07/2027']]
  for (const [g, voluto] of al) ok(`${g}: ${voluto}`, m.alGiorno?.(g), voluto)

  // E l'elenco non se le scrive da sé: Iscritti.tsx le prende da src/lib.
  const { readFileSync } = await import('node:fs')
  const tsx = readFileSync('src/components/segreteria/Iscritti.tsx', 'utf8')
  const ricopiate = ["'NO CERTIFICATO'", "'CERT. SCADUTO'", "'QUOTA SCADUTA'", 'const TONO_CERTIFICATO', 'const TONO_PAGA', 'const PAROLA_PAGA'].filter((x) => tsx.includes(x))
  ok('Iscritti.tsx non ha parole né toni suoi per IN REGOLA', ricopiate, [])
}

console.log(guai ? `\n${guai} COSE NON TORNANO` : '\nTUTTO A POSTO')
process.exit(guai ? 1 : 0)
