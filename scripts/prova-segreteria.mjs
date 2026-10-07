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
      "export { creaSegreteriaProva } from './src/lib/segreteriaProva'; export { tocca, ordinaSegnalazioni, cosaNonVaSegnalazione, etichettaChiudi, chiudiConRisposta, visibili, troppoLungo, avvisoChiusura, rigaFilo, motivoSpento, segnapostoTesto, testoWhatsApp, avvisoCategoria, leggiBozza, scriviBozza, svuotaBozze, chiaveBozza, conBozza, cosaNonVaAllegato, allegatiScaduti, nomeAllegato, nomeUnico, motivoSenzaRete, scegliAllegati, haAnteprima, mandaAllegati, avvisoNonPartiti, MAX_ALLEGATI } from './src/lib/segnalazioni'; export { giornoPerEsteso, chiaveGiorno, oraDi } from './src/lib/sala'; export { comeCertificato, comePaga, confermaMesiPresenze, inRegola, pagamentoDi, paroleInRegola, timbriScheda, trovaIscritti, alGiorno, nomeVoce, corsoCambiato, personaCambiata, ricorrenzaIniziale, ricorrenzaCambiata, COLORI, tastoPrincipale } from './src/lib/segreteria'; export { quoteDi, enteCambiato } from './src/lib/ricevute'; export { listinoCambiato, cambiNellaBozza, domandaButta } from './src/lib/listino'; export { creaDatiProva } from './src/lib/datiProva'; export { creaTabletProva } from './src/lib/tabletProva'; export { leggiFogli, importa, leggiTabella, indovinaColonne, scelteCorsi, indovinaCorso, leggiRisposte, divideScelte, dividiNome, leggiData } from './src/lib/importa'; export * as importaLib from './src/lib/importa'; export { carattereControllo } from './src/lib/codiceFiscale'; export { arrivoDalLink } from './src/lib/invito'; export { areeDi, daRuoloScelto, nomeDelRuolo, ruoloScelto } from './src/lib/ruoli'; export { archivio } from './src/lib/archivioProva'; export { creaSegreteriaSupabase } from './src/lib/segreteriaSupabase'; export * from './src/lib/doppioni'; export { memoria, lezioniFra, trovaLezione, segnaIstruttoriLezioneProva } from './src/lib/datiProva'; export { testoDateSalvate, confermaDateCorsi } from './src/lib/segreteria'; export * from './src/lib/scorri'; export * as segreteriaLib from './src/lib/segreteria'; export { creaDatiSupabase } from './src/lib/datiSupabase'",
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
  ok('un\'email già usata no', await errore(() => s.salvaPersona({ nome: 'Altra', cognome: 'Marta', email: 'MARTA@esempio.it' })), 'Questo indirizzo è già di Marta Nuova: mettilo come email di contatto.')
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
  await prova('il fratello con l\'email del genitore resta una persona a sé, e il controllo lo scrive', async () => {
    const r = il.controllaRighe(f2, await situazione()).righe[3]
    return [r.esito, r.avvisi.some((x) => /senza email/.test(x))]
  }, ['nuova', true])

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
  // Dall'email di contatto (44-email-contatto.sql) l'email del personale non è più un blocco: l'iscritto entra con l'email vuota e quell'indirizzo come contatto.
  await prova('l\'email di un istruttore o della segreteria: entra lo stesso, nessuna riga da sistemare', async () => il.controllaRighe(f4, await situazione()).righe.map((r) => [r.riga, r.esito, r.motivo]),
    [[2, 'nuova', undefined], [3, 'nuova', undefined], [4, 'nuova', undefined], [5, 'nuova', undefined], [6, 'nuova', undefined]])
  await prova('e il controllo dice che l\'indirizzo va nel contatto', async () => il.controllaRighe(f4, await situazione()).righe.map((r) => r.avvisi.some((x) => /contatto/.test(x))), [false, true, false, true, false])
  n = await quante()
  const senzaFermarsi = async (f) => { try { return await f() } catch (e) { ok('l\'import non si ferma per una riga', `ERRORE: ${e.message}`, 'nessun errore'); return { daSistemare: [] } } }
  a = await senzaFermarsi(() => m.importa(s, f4, () => {}))
  ok('importando entrano tutte e cinque, anche chi ha l\'email del personale', [(await quante()) - n, !!(await persona('Zeno', 'Primo')), !!(await persona('Wanda', 'Terza')), !!(await persona('Ugo', 'Istr'))], [5, true, true, true])
  await prova('Ugo e Sandro: email vuota, e l\'indirizzo del personale come contatto', async () => [await persona('Ugo', 'Istr'), await persona('Sandro', 'Seg')].map((p) => [p.email ?? null, p.emailContatto ?? null]),
    [[null, 'istr.import@esempio.it'], [null, 'seg.import@esempio.it']])
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
  ok('riuscito da giorni: avvisa e dice dove farne uno nuovo', dice(copia('riuscito', 5)), { testo: 'Ultimo backup riuscito 5 giorni fa. Se importi tanto, fanne uno nuovo da IMPOSTAZIONI › IL BACKUP.', avviso: true })
  ok('i giorni sono di calendario, non di 24 ore: ieri alle 23:30, con adesso a mezzanotte e dieci, è ieri', il.promemoriaBackup(copia('riuscito', 1, 23), new Date(2026, 9, 5, 0, 10)), { testo: 'Ultimo backup riuscito ieri.', avviso: false })
  ok('mai fatto: avvisa', dice({ copie: [], ultimo: null }), { testo: 'Non risulta nessun backup. Prima di importare, fanne uno da IMPOSTAZIONI › IL BACKUP.', avviso: true })
  ok('non riuscito: avvisa', dice(copia('fallito', 0)), { testo: 'L\'ultimo backup non è riuscito. Riprova da IMPOSTAZIONI › IL BACKUP prima di importare.', avviso: true })
  ok('in corso: aspetta, senza allarme', dice(copia('in_corso', 0, 11)), { testo: 'Un backup è in corso: aspetta che finisca, poi importa.', avviso: false })
  ok('se i backup non si leggono: lo dice, e manda a controllare', dice(undefined), { testo: 'Non riesco a leggere i backup: controlla da IMPOSTAZIONI › IL BACKUP prima di importare.', avviso: true })
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
    const c = new Proxy(() => c, { get: (_, k) => (k === 'then' ? (fatto) => fatto(r) : () => c), apply: () => c })
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
  ok('senza 38-…: si rilegge senza, e il filo non ha categoria', [lette.length, fili.map((y) => [y.id, y.categoria])], [2, [['v1', undefined]]])
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
    ['niente certificato, niente quota', persona(), [{ tono: 'rosso', parola: 'NO CERTIFICATO' }, { tono: 'rosso', parola: 'DA PAGARE' }, { tono: 'spento', parola: 'MANCA LA DATA' }]],
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
    const fuori = (inElenco(p) ?? []).filter((b) => !['IN REGOLA', 'FUORI APP', 'MANCA LA DATA'].includes(b.parola))
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
  ok('i posti cambiati sono una modifica', cambiato(corso, { ...b, capienza: 25 }), true)
  ok('i posti tolti sono una modifica', cambiato(corso, { ...b, capienza: undefined }), true)
  ok('il colore cambiato è una modifica', cambiato(corso, { ...b, colore: m.COLORI[2].hex }), true)
  ok('gli istruttori scambiati di posto sono una modifica: il primo è quello di riferimento', cambiato(corso, { ...b, istruttori: ['y', 'x'] }), true)
  ok('gli stessi istruttori nello stesso ordine non sono una modifica', cambiato(corso, { ...b, istruttori: ['x', 'y'] }), false)
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
  ok('lasciare: il tasto per uscire è ESCI SENZA SALVARE', corpo.includes('ESCI SENZA SALVARE'), true)
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
  ok('LISTINO: il tasto si chiama BUTTA I CAMBI', tsx.includes('BUTTA I CAMBI'), true)
  ok('LISTINO: BUTTA I CAMBI è un tasto di pericolo, come RIMETTI', tsx.includes("'BUTTA I CAMBI', { pericolo: true }"), true)
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
      get: (_, k) => (k === 'then' ? (ok, ko) => Promise.resolve(risposta(t)).then(ok, ko) : () => q),
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

console.log('\nla scheda a pieno schermo parte dalla cima, e chiusa la pagina torna dov\'era')
{
  // Il corpo che scorre è un oggetto finto: conta solo `scrollTop`. Lo
  // smontaggio rimette la posizione dopo un microtask, come in React.
  const dopo = () => new Promise((r) => setTimeout(r))
  {
    const corpo = { scrollTop: 800 }
    const chiudi = m.apriScheda(corpo)
    ok('aperta una scheda dall\'elenco a 800, la pagina va in cima', corpo.scrollTop, 0)
    chiudi()
    await dopo()
  }
  {
    const corpo = { scrollTop: 800 }
    const chiudiA = m.apriScheda(corpo)
    corpo.scrollTop = 500
    chiudiA()
    const chiudiB = m.apriScheda(corpo)
    await dopo()
    ok('da una scheda all\'altra, la nuova parte dalla cima', corpo.scrollTop, 0)
    chiudiB()
    await dopo()
    ok('chiusa la seconda, si torna dove si era nell\'elenco', corpo.scrollTop, 800)
  }
  {
    const corpo = { scrollTop: 800 }
    const chiudiA = m.apriScheda(corpo)
    corpo.scrollTop = 500
    chiudiA()
    const chiudiB = m.apriScheda(corpo)
    corpo.scrollTop = 400
    chiudiB()
    const chiudiC = m.apriScheda(corpo)
    corpo.scrollTop = 600
    chiudiC()
    await dopo()
    ok('tre schede di fila, chiusa l\'ultima: si torna dove si era nell\'elenco', corpo.scrollTop, 800)
    corpo.scrollTop = 300
    const chiudiD = m.apriScheda(corpo)
    corpo.scrollTop = 50
    chiudiD()
    await dopo()
    ok('aperta di nuovo dall\'elenco a 300: si torna a 300, non alla posizione di prima', corpo.scrollTop, 300)
  }
  {
    // Lo StrictMode di sviluppo monta, smonta e rimonta nello stesso giro.
    const corpo = { scrollTop: 800 }
    m.apriScheda(corpo)()
    const chiudi = m.apriScheda(corpo)
    await dopo()
    ok('montata due volte di fila, la scheda resta in cima', corpo.scrollTop, 0)
    corpo.scrollTop = 250
    chiudi()
    await dopo()
    ok('e chiusa si torna a 800', corpo.scrollTop, 800)
  }
  {
    const uno = { scrollTop: 100 }
    const due = { scrollTop: 200 }
    const chiudiUno = m.apriScheda(uno)
    const chiudiDue = m.apriScheda(due)
    uno.scrollTop = 30
    due.scrollTop = 40
    chiudiUno()
    chiudiDue()
    await dopo()
    ok('due corpi diversi tornano ognuno al suo posto', [uno.scrollTop, due.scrollTop], [100, 200])
  }
  // Nello stesso commit React nasconde l'elenco e monta la scheda: quando
  // apriScheda legge scrollTop il browser l'ha già tagliato all'altezza della
  // scheda. Conta l'ultima posizione segnata da `scorre` (onScroll del corpo).
  {
    const corpo = { scrollTop: 1500 }
    m.scorre(corpo)
    corpo.scrollTop = 594
    const chiudi = m.apriScheda(corpo)
    chiudi()
    await dopo()
    ok('elenco scorso a 1500 e tagliato dal browser a 594: chiusa la scheda si torna a 1500', corpo.scrollTop, 1500)
  }
  {
    const corpo = { scrollTop: 1500 }
    m.scorre(corpo)
    corpo.scrollTop = 594
    const chiudi = m.apriScheda(corpo)
    corpo.scrollTop = 594
    m.scorre(corpo)
    corpo.scrollTop = 200
    m.scorre(corpo)
    chiudi()
    await dopo()
    ok('gli scroll dentro la scheda aperta non spostano la posizione segnata: si torna a 1500', corpo.scrollTop, 1500)
  }
  {
    const corpo = { scrollTop: 1500 }
    m.scorre(corpo)
    corpo.scrollTop = 594
    m.apriScheda(corpo)()
    await dopo()
    corpo.scrollTop = 700
    m.scorre(corpo)
    corpo.scrollTop = 300
    const chiudi = m.apriScheda(corpo)
    chiudi()
    await dopo()
    ok('tornati all\'elenco e scorsi a 700, tagliato a 300: chiusa la scheda si torna a 700', corpo.scrollTop, 700)
  }
  {
    const corpo = { scrollTop: 400 }
    const chiudi = m.apriScheda(corpo)
    chiudi()
    await dopo()
    ok('un elenco mai scorso a 400: chiusa la scheda si torna a 400', corpo.scrollTop, 400)
  }
}

console.log('\ncambiata voce, la pagina parte dalla cima e una scheda chiusa dopo non riporta giù')
{
  // Il corpo che scorre è uno per tutte le voci: CORSI scorso a 900, «Cerca
  // iscritto» apre una scheda, ISCRITTI deve partire dalla cima, non da 900.
  const dopo = () => new Promise((r) => setTimeout(r))
  const { cambiaVoce } = m
  {
    const corpo = { scrollTop: 900 }
    m.scorre(corpo)
    cambiaVoce(corpo)
    ok('elenco a 900, cambiata voce: la pagina va in cima', corpo.scrollTop, 0)
    corpo.scrollTop = 0
    const chiudi = m.apriScheda(corpo)
    chiudi()
    await dopo()
    ok('nella voce nuova, aperta e chiusa una scheda: si torna in cima, non a 900', corpo.scrollTop, 0)
  }
  {
    const corpo = { scrollTop: 900 }
    m.scorre(corpo)
    const chiudi = m.apriScheda(corpo)
    cambiaVoce(corpo)
    chiudi()
    await dopo()
    ok('scheda aperta dall\'elenco a 900, cambiata voce, chiusa la scheda: in cima', corpo.scrollTop, 0)
  }
  {
    const corpo = { scrollTop: 900 }
    m.scorre(corpo)
    const chiudi = m.apriScheda(corpo)
    cambiaVoce(corpo)
    corpo.scrollTop = 300
    chiudi()
    await dopo()
    ok('cambiata voce con la scheda aperta e scorsa a 300, chiusa la scheda: in cima', corpo.scrollTop, 0)
  }
  {
    const corpo = { scrollTop: 900 }
    m.scorre(corpo)
    const chiudiA = m.apriScheda(corpo)
    chiudiA()
    const chiudiB = m.apriScheda(corpo)
    cambiaVoce(corpo)
    await dopo()
    ok('da una scheda all\'altra, cambiata voce: in cima', corpo.scrollTop, 0)
    chiudiB()
    await dopo()
    ok('…e chiusa la seconda resta in cima, non a 900', corpo.scrollTop, 0)
  }
  {
    const corpo = { scrollTop: 900 }
    m.scorre(corpo)
    const chiudiA = m.apriScheda(corpo)
    chiudiA()
    await dopo()
    cambiaVoce(corpo)
    ok('chiusa la scheda e tornati a 900, cambiata voce: in cima', corpo.scrollTop, 0)
  }
  {
    const corpo = { scrollTop: 700 }
    m.scorre(corpo)
    const chiudiA = m.apriScheda(corpo)
    chiudiA()
    const chiudiB = m.apriScheda(corpo)
    await dopo()
    chiudiB()
    await dopo()
    ok('senza cambiare voce, da una scheda all\'altra: si torna a 700', corpo.scrollTop, 700)
  }
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
      get: (_, k) => (k === 'then' ? (ok, ko) => Promise.resolve(risposta(t)).then(ok, ko) : () => q),
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
  ok('conferma: il conto non è riuscito, si chiede lo stesso', m.confermaDateCorsi(null), { testo: 'Salvare le date? Da domani le lezioni fuori dalle date se ne vanno, tranne quelle con l’appello o una prova.', tasto: 'SALVA LE DATE' })
  ok('conferma: senza il file non si chiede', m.confermaDateCorsi({ tolte: 0, restano: 0, prima: null, ultima: null, manca: 'va lanciato 35-date-corsi.sql' }), null)
  ok('conferma: niente da togliere, non si chiede', m.confermaDateCorsi({ tolte: 0, restano: 2, prima: '2026-10-19', ultima: '2026-10-21' }), null)
  ok('conferma: tante da togliere, due restano', m.confermaDateCorsi({ tolte: 1877, restano: 2, prima: '2026-10-19', ultima: '2026-10-21' }), { testo: 'Togliere 1877 lezioni fuori dalle date? Restano 2 lezioni con l’appello o una prova.', tasto: 'SÌ, TOGLI 1877 LEZIONI' })
  ok('conferma: una da togliere', m.confermaDateCorsi({ tolte: 1, restano: 0, prima: null, ultima: null }), { testo: 'Togliere 1 lezione fuori dalle date?', tasto: 'SÌ, TOGLI 1 LEZIONE' })
  ok('conferma: cinque da togliere, una resta', m.confermaDateCorsi({ tolte: 5, restano: 1, prima: '2026-10-19', ultima: '2026-10-19' }), { testo: 'Togliere 5 lezioni fuori dalle date? Resta 1 lezione con l’appello o una prova.', tasto: 'SÌ, TOGLI 5 LEZIONI' })
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
  const bf = async (g) => (await s.settimana(...giorno(g))).find((l) => l.corsoId === 'body-functional')
  // Body functional è il mercoledì alle 18: due lezioni passate, e dopo oggi (sabato 26 settembre) 30 settembre,
  // 7, 14, 21 e 28 ottobre e 4 novembre.
  const DATE = [[8, 16], [8, 23], [8, 30], [9, 7], [9, 14], [9, 21], [9, 28], [10, 4]]
  const etichette = async () => Promise.all(DATE.map(async (g) => (await bf(g)).attivita ?? '-'))
  const giornoBf = async () => (await s.corsi()).find((c) => c.id === 'body-functional').ricorrenze[0]
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
  ok('anche l\'app degli istruttori', (await app.calendario(...giorno([9, 14]))).find((x) => x.corsoId === 'body-functional').attivita, 'Sacco')
  ok('e quella a mano sul suo', (await app.calendario(...giorno([9, 7]))).find((x) => x.corsoId === 'body-functional').attivita, 'Sparring')
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
  await s.aggiungiRicorrenza('body-functional', { giorno: 6, ora: '10:00', durata: 60, attivitaId: sacco })
  const sabato = (await s.settimana(...giorno([9, 3]))).find((x) => x.corsoId === 'body-functional')
  ok('il giorno nuovo con «Sacco»: la sua lezione nasce con «Sacco»', sabato?.attivita, 'Sacco')
  await s.togliRicorrenza((await s.corsi()).find((c) => c.id === 'body-functional').ricorrenze.find((r) => r.giorno === 6).id)

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
  await s.straordinaria('body-functional', new Date(2026, 9, 3, 10, 0), 60)
  const extra = (await s.settimana(...giorno([9, 3]))).find((x) => x.corsoId === 'body-functional' && x.straordinaria)
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
  const altrui = (await app.calendario(...giorno([9, 14]))).find((x) => x.corsoId === 'body-functional')
  ok('quella di un altro no', eMessaggio(await errore(() => app.cambiaAttivita(altrui.id, sparring))), true)
  ok('e non è cambiata', (await app.calendario(...giorno([9, 14]))).find((x) => x.corsoId === 'body-functional').attivita, 'Sacco')
  // Come la policy sessioni_aggiorna: chi la fa (il sostituto) o chi insegna il corso, anche se c'è un sostituto.
  await s.aggiornaLezione((await judo()).id, { sostitutoId: 'i-fabio' })
  await app.cambiaAttivita((await judo()).id, sparring)
  ok('il titolare del corso cambia l\'attività anche con un sostituto', (await judo()).attivita, 'Sparring')
  await s.aggiornaLezione((await judo()).id, { sostitutoId: null })
  await app.cambiaAttivita((await judo()).id, null)
  await s.aggiornaLezione(altrui.id, { sostitutoId: 'i-maurizio' })
  await app.cambiaAttivita(altrui.id, sparring)
  ok('il sostituto cambia quella della lezione che fa', (await app.calendario(...giorno([9, 14]))).find((x) => x.corsoId === 'body-functional').attivita, 'Sparring')
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
  const l2 = (await s2.settimana(...giorno([9, 14]))).find((x) => x.corsoId === 'body-functional')
  ok('le lezioni si leggono come prima, senza attività', [l2?.corso, l2?.attivita], ['Body functional', undefined])
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
    const c = new Proxy(() => c, { get: (_, k) => (k === 'then' ? (f, ko) => Promise.resolve(r).then(f, ko) : () => c), apply: () => c })
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
              k === 'then' ? (f, ko) => Promise.resolve({ data: [riga(conKanji, conAttivita)], error: null }).then(f, ko)
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
  ok('elenco: 5 anni, quota pagata, senza certificato: in regola e certificato spento', vedi(() => parole(persona(cinque))), [{ tono: 'verde', parola: 'IN REGOLA' }, { tono: 'spento', parola: 'CERT. NON SERVE' }])
  ok('elenco: 5 anni con la quota da pagare: non in regola, il guaio è la quota', vedi(() => parole(persona(cinque, undefined, { quote: [] }))).map((x) => x.parola), ['DA PAGARE', 'CERT. NON SERVE'])
  ok('elenco: ai 6 anni mancano 14 giorni: bollino giallo con la data', vedi(() => parole(persona('2020-10-10'))), [{ tono: 'giallo', parola: 'SERVE DAL 10/10' }])
  ok('elenco: 6 anni oggi: NO CERTIFICATO come oggi', vedi(() => parole(persona('2020-09-26'))), [{ tono: 'rosso', parola: 'NO CERTIFICATO' }])
  ok('elenco: senza data di nascita e senza certificato: NO CERTIFICATO e MANCA LA DATA', vedi(() => parole(persona(undefined))), [{ tono: 'rosso', parola: 'NO CERTIFICATO' }, { tono: 'spento', parola: 'MANCA LA DATA' }])
  ok('elenco: senza data di nascita ma col certificato valido: niente MANCA LA DATA', vedi(() => parole(persona(undefined, { scade: '2027-06-01', conFile: false })).map((x) => x.parola)), ['IN REGOLA'])
  ok('manca la data: solo senza data e senza certificato (la frase della scheda parte da qui)', [persona(undefined), persona(undefined, { scade: '2027-06-01', conFile: false }), persona('2020-09-26')].map((p) => vedi(() => L.mancaLaData(p))), [true, false, false])
  ok('elenco: 5 anni col certificato valido: niente bollino del certificato: è verde come per tutti', vedi(() => parole(persona(cinque, { scade: '2027-06-01', conFile: false }))).map((x) => x.parola), ['IN REGOLA'])

  // In regola.
  ok('in regola: 5 anni, quota pagata, niente certificato', vedi(() => L.inRegola(persona(cinque), oggi)), true)
  ok('in regola: 5 anni senza quota no', vedi(() => L.inRegola(persona(cinque, undefined, { quote: [] }), oggi)), false)
  ok('in regola: ai 6 anni mancano 14 giorni, quota pagata: sì, in sala può entrare', vedi(() => L.inRegola(persona('2020-10-10'), oggi)), true)
  ok('in regola: 6 anni oggi senza certificato no', vedi(() => L.inRegola(persona('2020-09-26'), oggi)), false)
  ok('in regola: senza data di nascita e senza certificato no', vedi(() => L.inRegola(persona(undefined), oggi)), false)

  // La scheda.
  const cert = (p) => vedi(() => L.timbriScheda(p, oggi).certificato)
  ok('scheda: 5 anni senza certificato, timbro spento', cert(persona(cinque)), { tono: 'spento', parola: 'NON SERVE', righe: [{ testo: 'SOTTO I 6 ANNI' }], inElenco: 'CERT. NON SERVE' })
  ok('scheda: 5 anni col certificato valido, la data resta, verde', cert(persona(cinque, { scade: '2027-06-01', conFile: false })), { tono: 'verde', parola: 'VALIDO FINO ALL’1/06/2027', righe: [{ testo: 'NON SERVE SOTTO I 6 ANNI' }] })
  ok('scheda: 5 anni col certificato scaduto, la data resta, spento e non rosso', cert(persona(cinque, { scade: '2026-01-15', conFile: false })), { tono: 'spento', parola: 'SCADUTO IL 15/01/2026', inElenco: 'CERT. SCADUTO', righe: [{ testo: 'NON SERVE SOTTO I 6 ANNI' }] })
  ok('scheda: ai 6 anni mancano 14 giorni, giallo con la data e i giorni', cert(persona('2020-10-10')), { tono: 'giallo', parola: 'SERVE DAL 10/10/2026', inElenco: 'SERVE DAL 10/10', righe: [{ testo: 'FRA 14 GIORNI' }] })
  ok('scheda: 6 anni oggi, rosso come oggi', cert(persona('2020-09-26')).parola, 'NO CERTIFICATO')
  ok('scheda: senza data di nascita, rosso e una riga che dice che manca la data', cert(persona(undefined)), { tono: 'rosso', parola: 'NO CERTIFICATO', righe: [{ testo: 'SENZA, IN SALA NON SI ENTRA' }, { testo: 'MANCA LA DATA DI NASCITA' }] })
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
      const c = new Proxy(() => c, { get: (_, k) => (k === 'then' ? (fatto) => fatto(tabelle[t] ?? { data: [], error: null }) : () => c), apply: () => c })
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

console.log(guai ? `\n${guai} COSE NON TORNANO` : '\nTUTTO A POSTO')
process.exit(guai ? 1 : 0)
