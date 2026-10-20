// ---------------------------------------------------------------------------
// Satispay nel modulo di iscrizione, senza browser e senza rete.
//
//   node scripts/prova-satispay.mjs
//
// Le regole stanno in `src/lib/satispay.ts`; la firma delle chiamate a
// Satispay in `supabase/functions/satispay/firma.ts`. L'importo lo calcola il
// database (`importo_iscrizione`, provata da `supabase/prova/satispay.sql`):
// in prova lo fa `stimaIscrizione`, con lo stesso listino. Un pagamento
// arrivato entra in PAGAMENTI e CONTABILITÀ una volta sola, anche quando poi
// finisce in una ricevuta.
// ---------------------------------------------------------------------------
import { build } from 'esbuild'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

// Oggi, per la prova, è martedì 20 ottobre 2026 a mezzogiorno: il saldo è chiuso.
const OGGI = new Date(2026, 9, 20, 12, 0).getTime()
const DateVera = Date
globalThis.Date = class extends DateVera {
  constructor(...a) {
    super(...(a.length ? a : [OGGI]))
  }
  static now() {
    return OGGI
  }
}
const memoria = new Map()
globalThis.localStorage = {
  getItem: (k) => (memoria.has(k) ? memoria.get(k) : null),
  setItem: (k, v) => memoria.set(k, String(v)),
  removeItem: (k) => memoria.delete(k),
}
globalThis.window = { location: { search: '', hash: '' }, addEventListener() {} }

// Un modulo per volta: uno che manca fa rosso i suoi casi, non ferma gli altri.
const carica = async (contents) => {
  try {
    const { outputFiles } = await build({
      stdin: { contents, resolveDir: '.', loader: 'ts' },
      bundle: true,
      format: 'esm',
      platform: 'node',
      write: false,
      logLevel: 'silent',
      define: { 'import.meta.env': '{}' },
    })
    return await import('data:text/javascript;base64,' + Buffer.from(outputFiles[0].text).toString('base64'))
  } catch (e) {
    console.log(`  ✗ non si carica: ${contents}\n      ${String(e.message).split('\n').slice(0, 2).join(' ')}`)
    return {}
  }
}
const s = await carica("export * from './src/lib/satispay'")
const c = await carica("export * from './src/lib/contabilita'; export { ENTE_PREDEFINITO } from './src/lib/ricevute'")
const f = await carica("export * from './supabase/functions/satispay/firma'")
const p = await carica(
  "export { creaRichiesteProva, pagamentiSatispayProva } from './src/lib/richiesteProva'; export { creaSegreteriaProva } from './src/lib/segreteriaProva'; export { stimaIscrizione } from './src/lib/nucleo'",
)

let guai = 0
const ok = (cosa, avuto, voluto) => {
  const va = JSON.stringify(avuto) === JSON.stringify(voluto)
  console.log(va ? '  ✓' : '  ✗', cosa, va ? '' : `— atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`)
  if (!va) guai++
}
const prova = (fn) => {
  try {
    return fn()
  } catch (e) {
    return `ERRORE: ${e.message}`
  }
}
const aspetta = async (fn) => {
  try {
    return await fn()
  } catch (e) {
    return `ERRORE: ${e.message}`
  }
}

console.log('1. lo stato come lo dice Satispay')
{
  ok('ACCEPTED è pagato', prova(() => s.statoDa('ACCEPTED')), 'pagato')
  ok('CANCELED è non andato', prova(() => s.statoDa('CANCELED')), 'non-andato')
  ok('PENDING è in attesa', prova(() => s.statoDa('PENDING')), 'attesa')
  ok('una parola mai vista è in attesa', prova(() => s.statoDa('BOH')), 'attesa')
}

console.log('\n2. quando il modulo offre Satispay')
{
  ok('attivo e tutti i corsi col prezzo: sì', prova(() => s.comePuoiPagare([], true)), { satispay: true })
  ok('non attivo: no, e non dice niente', prova(() => s.comePuoiPagare([], false)), { satispay: false, perche: '' })
  ok('non attivo vince anche su un corso senza prezzo', prova(() => s.comePuoiPagare(['Judo 3'], false)), { satispay: false, perche: '' })
  ok('un corso senza prezzo: lo dice', prova(() => s.comePuoiPagare(['Judo 3'], true)), { satispay: false, perche: 'Non ancora: il prezzo di Judo 3 lo conferma la segreteria' })
  ok('due corsi senza prezzo: con la «e»', prova(() => s.comePuoiPagare(['Judo 3', 'Lotta 3'], true)), { satispay: false, perche: 'Non ancora: il prezzo di Judo 3 e Lotta 3 lo conferma la segreteria' })
  ok('tre: virgola e «e»', prova(() => s.comePuoiPagare(['Judo 3', 'Lotta 3', 'Zumba'], true)), { satispay: false, perche: 'Non ancora: il prezzo di Judo 3, Lotta 3 e Zumba lo conferma la segreteria' })
}

console.log('\n2c. il prezzo che vale per Satispay: solo una voce del listino agganciata al corso')
{
  const listino = { quota: 50, saldoEntro: '2026-08-31', offerte: [], corsi: [
    { corso: 'Judo 3', corsoId: 'c1', prezzi: [{ annuale: 400 }] },
    { corso: 'Karate', prezzi: [{ annuale: 300 }] },
  ] }
  ok('agganciato per id: ha il prezzo', prova(() => s.senzaVoceDelCorso([{ id: 'c1', nome: 'Judo 3' }], listino)), [])
  ok('voce col solo nome: per il database non ha prezzo', prova(() => s.senzaVoceDelCorso([{ id: 'c2', nome: 'Karate' }], listino)), ['Karate'])
}

console.log('\n2b. come si paga dal modulo, e quali file si chiedono')
{
  const si = { satispay: true }
  const no = { satispay: false, perche: '' }
  ok('Satispay scelto e possibile: Satispay', prova(() => s.modoPagamento('satispay', si, false)), 'satispay')
  ok('Satispay scelto ma spento: in segreteria', prova(() => s.modoPagamento('satispay', no, false)), 'segreteria')
  ok('bonifico resta bonifico anche senza Satispay', prova(() => s.modoPagamento('bonifico', no, false)), 'bonifico')
  ok('dal nucleo nessuna scelta: come prima', prova(() => s.modoPagamento('satispay', si, true)), null)
  ok('la ricevuta del bonifico: col bonifico sì', prova(() => s.chiedeRicevuta('bonifico')), true)
  ok('con Satispay no', prova(() => s.chiedeRicevuta('satispay')), false)
  ok('in segreteria no', prova(() => s.chiedeRicevuta('segreteria')), false)
  ok('dal nucleo sì, come prima', prova(() => s.chiedeRicevuta(null)), true)
}

console.log('\n3. cosa vede chi ha mandato la richiesta')
{
  ok('in attesa', prova(() => s.esitoPagamento({ stato: 'attesa', importo: 23000 })), {
    titolo: 'RICHIESTA ARRIVATA',
    tono: 'avviso',
    testi: ['Manca il pagamento: 230\u00a0€ con Satispay.', 'Se hai chiuso Satispay senza confermare, riaprilo da qui: è lo stesso pagamento, non paghi due volte.'],
  })
  ok('in attesa, coi centesimi', prova(() => s.esitoPagamento({ stato: 'attesa', importo: 1250 }).testi[0]), 'Manca il pagamento: 12,50\u00a0€ con Satispay.')
  ok('pagato, per chi', prova(() => s.esitoPagamento({ stato: 'pagato', importo: 23000, pagatoIl: '2026-10-20T10:00:00Z', chi: 'Paolo Bianchi' })), {
    titolo: 'RICHIESTA ARRIVATA · PAGATO',
    tono: 'fatto',
    testi: ['Hai pagato 230\u00a0€ con Satispay il 20 ottobre, per Paolo Bianchi.'],
  })
  ok('pagato, senza chi', prova(() => s.esitoPagamento({ stato: 'pagato', importo: 1250, pagatoIl: '2026-10-20T10:00:00Z' }).testi[0]), 'Hai pagato 12,50\u00a0€ con Satispay il 20 ottobre.')
  ok('pagato alle 23:30 UTC: a Roma è già il giorno dopo', prova(() => s.esitoPagamento({ stato: 'pagato', importo: 23000, pagatoIl: '2026-10-19T23:30:00Z' }).testi[0]), 'Hai pagato 230\u00a0€ con Satispay il 20 ottobre.')
  const nonAndato = prova(() => s.esitoPagamento({ stato: 'non-andato', importo: 23000, chi: 'Paolo Bianchi' }))
  ok('non andato: titolo e tono', prova(() => [nonAndato.titolo, nonAndato.tono]), ['IL PAGAMENTO NON È ANDATO', 'avviso'])
  ok('non andato: dice quanto', prova(() => nonAndato.testi[0].startsWith('La richiesta è arrivata, ma i 230\u00a0€ non sono stati pagati: ')), true)
  ok('non andato, coi centesimi', prova(() => s.esitoPagamento({ stato: 'non-andato', importo: 1250 }).testi[0].startsWith('La richiesta è arrivata, ma i 12,50\u00a0€ non sono stati pagati: ')), true)
  ok('l’errore è per chi usa l’app, mai quello grezzo', s.ERRORE_SATISPAY, 'Satispay non risponde: riprova o paga in segreteria')
  const funzione = readFileSync('supabase/functions/satispay/index.ts', 'utf8')
  ok('la Edge Function dice lo stesso errore dell’app', funzione.includes(`const NON_RISPONDE = '${s.ERRORE_SATISPAY}'`), true)
}

// I pagamenti come li legge la segreteria.
const pagato = { id: 'sp1', richiestaId: 'r1', chi: 'Bianchi Paolo', importo: 23000, stato: 'pagato', creatoIl: '2026-10-19T23:20:00Z', pagatoIl: '2026-10-19T23:30:00Z' }
const inAttesa = { id: 'sp2', richiestaId: 'r2', chi: 'Verdi Sara', importo: 20000, stato: 'attesa', creatoIl: '2026-10-19T10:00:00Z' }
const nonAndato = { id: 'sp3', richiestaId: 'r3', chi: 'Neri Gino', importo: 20000, stato: 'non-andato', creatoIl: '2026-10-19T10:00:00Z' }
const inRicevuta = { ...pagato, id: 'sp4', ricevutaId: 'ric1', personaId: 'p-Bianchi' }
// Gli importi nei testi hanno lo spazio che non va a capo prima di «€» (`soldi`).
const nomeDi = (id) => ({ 'p-Bianchi': 'Bianchi Paolo Maria' })[id] ?? '—'
const lette = (righe) => righe.map((r) => ({ data: r.data, importo: r.importo, metodo: r.metodo, chi: r.chi, annullato: r.annullato }))

console.log('\n4. in PAGAMENTI: solo i pagati non ancora in una ricevuta')
{
  ok('uno pagato, uno in attesa, uno non andato, uno già in ricevuta: una riga', prova(() => lette(s.righeSatispay([pagato, inAttesa, nonAndato, inRicevuta], nomeDi))), [
    { data: '2026-10-20', importo: 23000, metodo: 'Satispay', chi: 'Bianchi Paolo', annullato: false },
  ])
  ok('con la scheda, il nome è quello della scheda', prova(() => s.righeSatispay([{ ...pagato, personaId: 'p-Bianchi' }], nomeDi)[0].chi), 'Bianchi Paolo Maria')
  ok('nessun pagamento, nessuna riga', prova(() => s.righeSatispay([], nomeDi)), [])
}

console.log('\n4b. in RICHIESTE ONLINE: il segno e cosa fare')
{
  ok('nessun pagamento: niente', prova(() => s.segnoRichiesta(undefined, 'nuova')), null)
  ok('non andato: niente, si paga in segreteria come prima', prova(() => s.segnoRichiesta(nonAndato, 'nuova')), null)
  ok('in attesa', prova(() => s.segnoRichiesta(inAttesa, 'nuova')), { tag: 'Satispay in attesa', testo: 'Pagamento Satispay di 200\u00a0€ in attesa: chi si iscrive non l’ha ancora confermato.', tono: 'aspetta' })
  ok('pagata', prova(() => s.segnoRichiesta(pagato, 'nuova')), { tag: 'Pagata', testo: 'Pagata con Satispay il 20 ottobre: 230\u00a0€. Nella ricevuta dalla scheda il pagamento è già dentro: non segnarlo di nuovo.', tono: 'fatto' })
  ok('pagata e già in ricevuta', prova(() => s.segnoRichiesta(inRicevuta, 'accolta').testo), 'Pagata con Satispay il 20 ottobre: 230\u00a0€, già nella ricevuta.')
  ok('pagata e rifiutata: da restituire', prova(() => s.segnoRichiesta(pagato, 'rifiutata')), { tag: 'Da restituire', testo: 'Pagata con Satispay il 20 ottobre: 230\u00a0€ da restituire dall’app Satispay Business, e poi da registrare in CONTABILITÀ.', tono: 'guaio' })
}

console.log('\n4c. la ricevuta col pagamento Satispay dentro')
{
  const suo = { ...pagato, personaId: 'p-Bianchi' }
  ok('il pagamento da usare: arrivato, di questa persona, non ancora in ricevuta', prova(() => s.satispayDaUsare([{ ...pagato, id: 'sp9', personaId: 'p-Altro' }, inAttesa, { ...inRicevuta }, suo], 'p-Bianchi')?.id), 'sp1')
  ok('quello di un altro non si propone', prova(() => s.satispayDaUsare([{ ...pagato, id: 'sp9', personaId: 'p-Altro' }], 'p-Bianchi')), undefined)
  ok('nessuno da usare', prova(() => s.satispayDaUsare([inAttesa, inRicevuta], 'p-Bianchi')), undefined)
  const voce = (importo, metodo) => ({ descrizione: 'Annuale Judo adulti', quantita: 1, prezzo: 23000, pagamenti: importo ? [{ data: '2026-10-20', importo, metodo }] : [] })
  ok('pagato con Satispay quanto è arrivato: va', prova(() => s.cosaNonVaSatispay([voce(5000, 'Satispay'), voce(18000, 'Satispay')], suo)), null)
  ok('meno di quanto è arrivato: lo dice', prova(() => s.cosaNonVaSatispay([voce(20000, 'Satispay')], suo)), 'Con Satispay sono arrivati 230\u00a0€: nel pagato di questa ricevuta ce ne sono 200\u00a0€')
  ok('più di quanto è arrivato: lo dice', prova(() => s.cosaNonVaSatispay([voce(25000, 'Satispay')], suo)), 'Con Satispay sono arrivati 230\u00a0€: nel pagato di questa ricevuta ce ne sono 250\u00a0€')
  ok('un po’ Satispay e un po’ contanti: contano solo i Satispay', prova(() => s.cosaNonVaSatispay([voce(20000, 'Satispay'), voce(3000, 'Contanti')], suo)), 'Con Satispay sono arrivati 230\u00a0€: nel pagato di questa ricevuta ce ne sono 200\u00a0€')
  ok('tutto Satispay e in più contanti: va', prova(() => s.cosaNonVaSatispay([voce(23000, 'Satispay'), voce(5000, 'Contanti')], suo)), null)
  ok('niente pagato: lo dice', prova(() => s.cosaNonVaSatispay([voce(0, 'Satispay')], suo)), 'Con Satispay sono arrivati 230\u00a0€: nel pagato di questa ricevuta ce ne sono 0\u00a0€')
}

console.log('\n5. in CONTABILITÀ: il lordo, nel Conto Corrente, una volta sola')
{
  const casse = [
    { id: 'c1', nome: 'Cassa Contanti', saldoIniziale: 0 },
    { id: 'c2', nome: 'Conto Corrente', saldoIniziale: 0 },
  ]
  const voci = [
    { id: 'v-quota', nome: 'Quota associativa', tipo: 'entrata', diSistema: true, attiva: true },
    { id: 'v-corsi', nome: 'Corsi e altri pagamenti', tipo: 'entrata', diSistema: true, attiva: true },
  ]
  const entrate = (righe) => righe.map((r) => [r.tipo, r.data, r.importo, r.cassaId, r.annullato])
  ok('un Satispay pagato è un’entrata nel Conto Corrente', prova(() => entrate(c.elencoMovimenti([], [], [], casse, [], voci, [pagato]))), [['entrata', '2026-10-20', 23000, 'c2', false]])
  ok('in attesa e non andati non entrano', prova(() => c.elencoMovimenti([], [], [], casse, [], voci, [inAttesa, nonAndato]).length), 0)
  ok('senza Satispay l’elenco è quello di prima', prova(() => c.elencoMovimenti([], [], [], casse, [], voci).length), 0)
  const ricevuta = {
    id: 'ric1', anno: 2026, numero: 7, data: '2026-10-20', personaId: 'p-Bianchi', ente: c.ENTE_PREDEFINITO,
    intestatario: { nome: 'Paolo', cognome: 'Bianchi' },
    voci: [{ descrizione: 'Annuale Judo adulti', quantita: 1, prezzo: 23000, pagamenti: [{ data: '2026-10-20', importo: 23000, metodo: 'Satispay' }] }],
    anticipo: 0, totale: 23000, pagato: 23000, creataIl: '2026-10-20T10:00:00Z',
  }
  const elenco = prova(() => c.elencoMovimenti([ricevuta], [], [], casse, [], voci, [inRicevuta]))
  ok('lo stesso pagamento già in ricevuta: una sola entrata, quella della ricevuta', prova(() => elenco.map((r) => [r.origine, r.importo, r.cassaId])), [['ricevuta', 23000, 'c2']])
}

console.log('\n6. la firma delle chiamate a Satispay')
{
  ok('il digest del corpo vuoto', await aspetta(() => f.digest('')), 'SHA-256=47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=')
  const corpo = '{"flow":"MATCH_CODE","amount_unit":23000,"currency":"EUR"}'
  ok('il digest di un corpo: SHA-256 in base64', await aspetta(() => f.digest(corpo)), `SHA-256=${createHash('sha256').update(corpo).digest('base64')}`)
  const d = 'SHA-256=47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU='
  ok('cosa si firma: quattro righe, nell’ordine', prova(() => f.daFirmare('post', '/g_business/v1/payments', 'staging.authservices.satispay.com', 'Tue, 20 Oct 2026 10:00:00 GMT', d)),
    `(request-target): post /g_business/v1/payments\nhost: staging.authservices.satispay.com\ndate: Tue, 20 Oct 2026 10:00:00 GMT\ndigest: ${d}`)
}

console.log('\n7. in prova: paga finge l’approvazione, con l’importo della stima')
{
  const r = prova(() => p.creaRichiesteProva())
  const seg = prova(() => p.creaSegreteriaProva())
  const id = await aspetta(() => r.invia({
    nome: 'Luca', cognome: 'Rossi', natoIl: '1996-01-01', natoA: 'Torino', codiceFiscale: 'RSSLCU96A01L219K',
    indirizzo: 'Via Roma 1', cap: '10093', comune: 'Collegno', email: 'luca@esempio.it', telefono: '347 111 2233',
    corsi: ['judo-adulti'], formula: 'annuale', regolamento: true,
  }))
  ok('la richiesta di prova è partita', typeof id === 'string' && !id.startsWith('ERRORE') ? 'partita' : id, 'partita')
  // Come in produzione: il listino salvato dalla segreteria, con le voci agganciate ai corsi (senza, il database non dà un prezzo).
  await aspetta(async () => seg.salvaListino((await seg.listino()).listino))
  const corsi = await aspetta(async () => (await seg.corsi()).filter((x) => x.id === 'judo-adulti'))
  const listino = await aspetta(async () => (await seg.listino()).listino)
  const stima = prova(() => p.stimaIscrizione({ chi: 'Rossi Luca', corsi, formula: 'annuale' }, [], '2026-10-20', listino))
  ok('la stima ha un prezzo (altrimenti la prova non dice niente)', prova(() => [stima.senzaPrezzo, stima.totale > 0]), [[], true])
  ok('prima di pagare non risulta pagata', await aspetta(async () => (await r.statoPagamento(id))?.stato !== 'pagato'), true)
  await aspetta(() => r.paga(id))
  const dopo = await aspetta(() => r.statoPagamento(id))
  ok('dopo paga: pagata, con l’importo della stima', prova(() => ({ stato: dopo.stato, importo: dopo.importo })), { stato: 'pagato', importo: stima.totale })
  await aspetta(() => r.paga(id))
  ok('pagare due volte non cambia niente', await aspetta(async () => (await r.statoPagamento(id)).importo), stima.totale)

  // Accolta, la segreteria fa la ricevuta col pagamento dentro: una volta sola.
  const personaId = await aspetta(() => r.accogli(id))
  const sp = (await aspetta(() => seg.pagamentiSatispay())).find?.((x) => x.richiestaId === id)
  ok('accolta: il pagamento è della sua scheda', sp?.personaId, personaId)
  const ricevuta = (pagato) => ({
    data: '2026-10-20', personaId, ente: c.ENTE_PREDEFINITO, intestatario: { nome: 'Luca', cognome: 'Rossi', codiceFiscale: 'RSSLCU96A01L219K' },
    voci: [{ descrizione: 'Annuale', quantita: 1, prezzo: stima.totale, pagamenti: [{ data: '2026-10-20', importo: pagato, metodo: 'Satispay' }] }], anticipo: 0,
  })
  ok('con un pagato diverso: no', await aspetta(async () => { await seg.emettiRicevuta(ricevuta(stima.totale - 100), sp.id); return 'fatta' }), `ERRORE: Con Satispay sono arrivati ${s.soldi(stima.totale)}: nel pagato di questa ricevuta ce ne sono ${s.soldi(stima.totale - 100)}`)
  ok('di un’altra persona: no', await aspetta(async () => { await seg.emettiRicevuta({ ...ricevuta(stima.totale), personaId: 'p-altra' }, sp.id); return 'fatta' }), 'ERRORE: Il pagamento Satispay è di un’altra persona: accogli prima la sua richiesta')
  ok('quella giusta: fatta', await aspetta(async () => typeof (await seg.emettiRicevuta(ricevuta(stima.totale), sp.id)).id), 'string')
  ok('e il pagamento ora è nella ricevuta: non è più un incasso a parte', prova(() => s.righeSatispay(p.pagamentiSatispayProva(), () => '').length), 0)
  ok('una seconda volta: no', await aspetta(async () => { await seg.emettiRicevuta(ricevuta(stima.totale), sp.id); return 'fatta' }), 'ERRORE: Questo pagamento Satispay è già in una ricevuta')

  // La ricevuta si annulla: i soldi arrivati tornano un incasso a parte, e possono entrare in quella giusta.
  const prima = (await aspetta(() => seg.ricevute(personaId))).find?.((x) => !x.annullataIl)
  await aspetta(() => seg.annullaRicevuta(prima.id))
  const libero = (await aspetta(() => seg.pagamentiSatispay())).find?.((x) => x.id === sp.id)
  ok('ricevuta annullata: il pagamento non è più in una ricevuta', libero?.ricevutaId, undefined)
  ok('e torna fra i pagamenti', prova(() => s.righeSatispay([libero], () => '').length), 1)
  ok('e si propone per la ricevuta nuova', prova(() => s.satispayDaUsare([libero], personaId)?.id), sp.id)
  ok('la ricevuta rifatta: fatta', await aspetta(async () => typeof (await seg.emettiRicevuta(ricevuta(stima.totale), sp.id)).id), 'string')
}

if (guai) {
  console.log(`\n${guai} cose non tornano`)
  process.exit(1)
}
console.log('\nTutto a posto')
