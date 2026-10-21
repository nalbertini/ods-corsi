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
globalThis.window = { location: { search: '', hash: '', pathname: '/iscrizioni/' }, addEventListener() {} }

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
const g = await carica("export { pagamentoDi } from './src/lib/segreteria'; export { STAGIONE } from './src/lib/costi'")
const c = await carica("export * from './src/lib/contabilita'; export { ENTE_PREDEFINITO } from './src/lib/ricevute'")
const f = await carica("export * from './supabase/functions/satispay/firma'")
// La parte nuova di «prima paghi, poi mandi» si carica a parte: finché manca, fa rosso solo i suoi casi.
const pp = await carica("export { pagaSatispayProva } from './src/lib/richiesteProva'")
const p = await carica(
  "export { creaRichiesteProva, pagamentiSatispayProva, salvaSatispay } from './src/lib/richiesteProva'; export { creaSegreteriaProva } from './src/lib/segreteriaProva'; export { stimaIscrizione } from './src/lib/nucleo'",
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
  ok('un corso senza prezzo: lo dice', prova(() => s.comePuoiPagare(['Judo 3'], true)), { satispay: false, perche: 'Niente Satispay per ora: il prezzo di Judo 3 lo conferma la segreteria' })
  ok('due corsi senza prezzo: con la «e»', prova(() => s.comePuoiPagare(['Judo 3', 'Lotta 3'], true)), { satispay: false, perche: 'Niente Satispay per ora: il prezzo di Judo 3 e Lotta 3 lo conferma la segreteria' })
  ok('tre: virgola e «e»', prova(() => s.comePuoiPagare(['Judo 3', 'Lotta 3', 'Zumba'], true)), { satispay: false, perche: 'Niente Satispay per ora: il prezzo di Judo 3, Lotta 3 e Zumba lo conferma la segreteria' })
}

console.log('\n2c. il prezzo che vale per Satispay: solo una voce del listino agganciata al corso')
{
  const listino = { quota: 50, saldoEntro: '2026-08-31', offerte: [], corsi: [
    { corso: 'Judo 3', corsoId: 'c1', prezzi: [{ annuale: 400 }] },
    { corso: 'Karate', prezzi: [{ annuale: 300 }] },
  ] }
  ok('agganciato per id: ha il prezzo', prova(() => s.senzaVoceDelCorso([{ id: 'c1', nome: 'Judo 3' }], listino)), [])
  ok('voce col solo nome: per il database non ha prezzo', prova(() => s.senzaVoceDelCorso([{ id: 'c2', nome: 'Karate' }], listino)), ['Karate'])
  // Solo i casi semplici: un corso, una riga di prezzo. Il resto (offerte, giorni) lo conferma la segreteria.
  const conRighe = { ...listino, corsi: [...listino.corsi, { corso: 'Pesi', corsoId: 'c3', prezzi: [{ etichetta: '1 GIORNO', annuale: 340 }, { etichetta: '2 GIORNI', annuale: 450 }] }] }
  ok('un corso a riga sola: semplice', prova(() => s.nonSemplice([{ id: 'c1', nome: 'Judo 3' }], conRighe)), null)
  ok('due corsi: no, valgono le offerte', prova(() => s.nonSemplice([{ id: 'c1', nome: 'Judo 3' }, { id: 'c3', nome: 'Pesi' }], conRighe)), 'Niente Satispay per ora: con più corsi il prezzo lo conferma la segreteria')
  ok('un corso fuori età: no, la segreteria richiama e magari lo cambia', prova(() => s.nonSemplice([{ id: 'c1', nome: 'Judo 3' }], conRighe, ['Judo 3'])), 'Niente Satispay per ora: Judo 3 non è della sua età, la segreteria ti richiama')
  ok('un corso con più righe: no, dipende dai giorni', prova(() => s.nonSemplice([{ id: 'c3', nome: 'Pesi' }], conRighe)), 'Niente Satispay per ora: il prezzo di Pesi dipende dai giorni, lo conferma la segreteria')
}

console.log('\n2b. come si paga dal modulo, e quali file si chiedono')
{
  const si = { satispay: true }
  const no = { satispay: false, perche: '' }
  ok('Satispay scelto e possibile: Satispay', prova(() => s.modoPagamento('satispay', si, false)), 'satispay')
  // Solo Satispay o il bonifico con la ricevuta (decisione del 2026-10-20): niente «in segreteria».
  ok('Satispay scelto ma non possibile: il bonifico', prova(() => s.modoPagamento('satispay', no, false)), 'bonifico')
  ok('bonifico resta bonifico anche senza Satispay', prova(() => s.modoPagamento('bonifico', no, false)), 'bonifico')
  ok('dal nucleo nessuna scelta: come prima', prova(() => s.modoPagamento('satispay', si, true)), null)
  ok('nessuna scelta già fatta: si sceglie', prova(() => s.modoPagamento(null, si, false)), null)
  const nessuno = { pronto: false, giaPagato: false }
  ok('senza scelta il modulo non parte', prova(() => s.cosaNonVaModo(null, false, false, nessuno)), 'Manca come paghi: Satispay o bonifico')
  ok('Satispay non ancora pagato: non parte', prova(() => s.cosaNonVaModo('satispay', false, false, nessuno)), 'Prima paga con Satispay, in fondo al modulo: la richiesta parte dopo')
  ok('Satispay pagato per questa scelta: va, senza ricevuta', prova(() => s.cosaNonVaModo('satispay', false, false, { pronto: true, giaPagato: true })), null)
  ok('bonifico senza ricevuta: non parte', prova(() => s.cosaNonVaModo('bonifico', false, false, nessuno)), 'Manca la ricevuta del bonifico: una foto, lo screenshot o il PDF')
  ok('bonifico con la ricevuta: va', prova(() => s.cosaNonVaModo('bonifico', false, true, nessuno)), null)
  ok('pagato con Satispay e poi scelto il bonifico: non parte, lo dice', prova(() => s.cosaNonVaModo('bonifico', false, true, { pronto: false, giaPagato: true })), s.GIA_PAGATO_SATISPAY)
  ok('e il testo dice di rimettere Satispay', String(prova(() => s.GIA_PAGATO_SATISPAY)).includes('rimetti Satispay'), true)
  ok('dal nucleo non si sceglie', prova(() => s.cosaNonVaModo(null, true, false, nessuno)), null)
  ok('la ricevuta del bonifico: col bonifico sì', prova(() => s.chiedeRicevuta('bonifico', false)), true)
  ok('con Satispay no', prova(() => s.chiedeRicevuta('satispay', false)), false)
  // Il vecchio campo «PUOI PAGARE IN SEGRETERIA» compariva nel modulo pubblico prima di scegliere come pagare.
  ok('dalla pagina pubblica, prima di scegliere come pagare: no', prova(() => s.chiedeRicevuta(null, false)), false)
  ok('dal nucleo sì, come prima', prova(() => s.chiedeRicevuta(null, true)), true)
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
  ok('l’errore è per chi usa l’app, mai quello grezzo', s.ERRORE_SATISPAY, 'Satispay non risponde: riprova fra qualche minuto')
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
  ok('non andato: niente, si riprova', prova(() => s.segnoRichiesta(nonAndato, 'nuova')), null)
  ok('in attesa', prova(() => s.segnoRichiesta(inAttesa, 'nuova')), { tag: 'Satispay in attesa', testo: 'Pagamento Satispay di 200\u00a0€ in attesa: chi si iscrive non l’ha ancora confermato.', tono: 'aspetta' })
  ok('pagata', prova(() => s.segnoRichiesta(pagato, 'nuova')), { tag: 'Pagata', testo: 'Pagata con Satispay il 20 ottobre: 230\u00a0€. Nella ricevuta dalla scheda il pagamento è già dentro: non segnarlo di nuovo.', tono: 'fatto' })
  ok('pagata e già in ricevuta', prova(() => s.segnoRichiesta(inRicevuta, 'accolta').testo), 'Pagata con Satispay il 20 ottobre: 230\u00a0€, già nella ricevuta.')
  ok('pagata e rifiutata: da restituire', prova(() => s.segnoRichiesta(pagato, 'rifiutata')), { tag: 'Da restituire', testo: 'Pagata con Satispay il 20 ottobre: 230\u00a0€ da restituire dall’app Satispay Business, e poi da registrare in CONTABILITÀ.', tono: 'guaio' })
}

console.log('\n4d. la quota nella scheda: col Satispay arrivato non è «da pagare»')
{
  const nessuno = { pagamento: { stato: 'da_pagare' }, quote: [] }
  ok('senza Satispay: da pagare', prova(() => g.pagamentoDi(nessuno, '2026-10-20').come), 'da_pagare')
  ok('Satispay arrivato, senza ricevuta: pagata, con Satispay', prova(() => g.pagamentoDi({ ...nessuno, satispay: 23000 }, '2026-10-20')), { come: 'pagato', fonte: 'satispay', fino: g.STAGIONE.quota.al, importo: 23000 })
  ok('Satispay a ottobre 2027: pagata fino al 31/7/2028', prova(() => g.pagamentoDi({ ...nessuno, satispay: 23000 }, '2027-10-20').fino), '2028-07-31')
  const conRicevuta = { ...nessuno, satispay: 23000, quote: [{ anno: 2026, numero: 7, dal: '2026-09-01', al: g.STAGIONE.quota.al, mancano: 0 }] }
  ok('con la ricevuta della quota vale la ricevuta', prova(() => g.pagamentoDi(conRicevuta, '2026-10-20').fonte), 'ricevuta')
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
  ok('Satispay arrivato e la ricevuta con un altro metodo: no, conterebbe due volte', prova(() => s.cosaNonVaMetodo('Contanti', suo)), 'Con Satispay sono già arrivati 230\u00a0€: scegli PAGATO CON «Satispay», se no si contano due volte')
  ok('con Satispay: va', prova(() => s.cosaNonVaMetodo('Satispay', suo)), null)
  ok('nessun Satispay arrivato: ogni metodo va', prova(() => s.cosaNonVaMetodo('Contanti', undefined)), null)
  ok('da restituire: pagata e non in ricevuta', prova(() => s.daRestituire(suo)), 'I 230\u00a0€ pagati con Satispay restano in PAGAMENTI: vanno restituiti dall’app Satispay Business.')
  ok('già in ricevuta: niente da restituire qui', prova(() => s.daRestituire(inRicevuta)), null)
  ok('in attesa: niente', prova(() => s.daRestituire(inAttesa)), null)
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
  ok('un link con una richiesta che non c’è: la frase di chi paga', await aspetta(() => r.paga('r-che-non-ce')), 'ERRORE: Questa richiesta non si può più pagare online: scrivi alla segreteria')
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
  ok('e la scheda sa che ha pagato con Satispay', (await aspetta(() => seg.persone())).find?.((x) => x.id === personaId)?.satispay, stima.totale)
  const ricevuta = (pagato) => ({
    data: '2026-10-20', personaId, ente: c.ENTE_PREDEFINITO, intestatario: { nome: 'Luca', cognome: 'Rossi', codiceFiscale: 'RSSLCU96A01L219K' },
    voci: [{ descrizione: 'Annuale', quantita: 1, prezzo: stima.totale, pagamenti: [{ data: '2026-10-20', importo: pagato, metodo: 'Satispay' }] }], anticipo: 0,
  })
  ok('con un pagato diverso: no', await aspetta(async () => { await seg.emettiRicevuta(ricevuta(stima.totale - 100), sp.id); return 'fatta' }), `ERRORE: Con Satispay sono arrivati ${s.soldi(stima.totale)}: nel pagato di questa ricevuta ce ne sono ${s.soldi(stima.totale - 100)}`)
  ok('di un’altra persona: no', await aspetta(async () => { await seg.emettiRicevuta({ ...ricevuta(stima.totale), personaId: 'p-altra' }, sp.id); return 'fatta' }), 'ERRORE: Il pagamento Satispay è di un’altra persona: accogli prima la sua richiesta')
  ok('quella giusta: fatta', await aspetta(async () => typeof (await seg.emettiRicevuta(ricevuta(stima.totale), sp.id)).id), 'string')
  ok('e il pagamento ora è nella ricevuta: non è più un incasso a parte', prova(() => s.righeSatispay(p.pagamentiSatispayProva(), () => '').length), 0)
  ok('una seconda volta: no', await aspetta(async () => { await seg.emettiRicevuta(ricevuta(stima.totale), sp.id); return 'fatta' }), 'ERRORE: Questo pagamento Satispay è già in una ricevuta')
  ok('fatta la ricevuta, la scheda non lo conta più a parte', (await aspetta(() => seg.persone())).find?.((x) => x.id === personaId)?.satispay, undefined)

  // La ricevuta si annulla: i soldi arrivati tornano un incasso a parte, e possono entrare in quella giusta.
  const prima = (await aspetta(() => seg.ricevute(personaId))).find?.((x) => !x.annullataIl)
  await aspetta(() => seg.annullaRicevuta(prima.id))
  const libero = (await aspetta(() => seg.pagamentiSatispay())).find?.((x) => x.id === sp.id)
  ok('ricevuta annullata: il pagamento non è più in una ricevuta', libero?.ricevutaId, undefined)
  ok('e torna fra i pagamenti', prova(() => s.righeSatispay([libero], () => '').length), 1)
  ok('e si propone per la ricevuta nuova', prova(() => s.satispayDaUsare([libero], personaId)?.id), sp.id)
  ok('la ricevuta rifatta: fatta', await aspetta(async () => typeof (await seg.emettiRicevuta(ricevuta(stima.totale), sp.id)).id), 'string')

  // FAI LA RICEVUTA ripremuto dopo una rete caduta: con la chiave del modulo torna la ricevuta fatta, come `emetti_ricevuta_satispay`
  // (supabase/prova/satispay.sql, sezione 14). Il pagamento torna libero annullando la rifatta.
  const rifatta = (await aspetta(() => seg.ricevute(personaId))).find?.((x) => !x.annullataIl)
  await aspetta(() => seg.annullaRicevuta(rifatta.id))
  const conChiave = (chiave) => ({ ...ricevuta(stima.totale), chiave })
  const fatta = await aspetta(() => seg.emettiRicevuta(conChiave('dddddddd-0000-4000-8000-000000000010'), sp.id))
  ok('con la chiave del modulo: fatta', typeof fatta?.id, 'string')
  const quante = (await aspetta(() => seg.ricevute(personaId))).length
  ok('la stessa chiave, col pagamento già dentro: torna la stessa ricevuta',
    await aspetta(async () => (await seg.emettiRicevuta(conChiave('dddddddd-0000-4000-8000-000000000010'), sp.id)).id), fatta?.id)
  ok('…e nessuna ricevuta in più', (await aspetta(() => seg.ricevute(personaId))).length, quante)
  ok('…e il pagamento resta in quella', (await aspetta(() => seg.pagamentiSatispay())).find?.((x) => x.id === sp.id)?.ricevutaId, fatta?.id)
  ok('una chiave nuova col pagamento già usato: no, come sempre',
    await aspetta(async () => { await seg.emettiRicevuta(conChiave('dddddddd-0000-4000-8000-000000000011'), sp.id); return 'fatta' }), 'ERRORE: Questo pagamento Satispay è già in una ricevuta')
  // Il modulo ha fatto la ricevuta senza Satispay: la stessa chiave col pagamento non lo lega a quella.
  await aspetta(() => seg.annullaRicevuta(fatta.id))
  const senza = await aspetta(() => seg.emettiRicevuta(conChiave('dddddddd-0000-4000-8000-000000000012')))
  const primaDi = (await aspetta(() => seg.ricevute(personaId))).length
  ok('la stessa chiave di una ricevuta fatta senza il pagamento: no',
    await aspetta(async () => { await seg.emettiRicevuta(conChiave('dddddddd-0000-4000-8000-000000000012'), sp.id); return 'fatta' }),
    `ERRORE: La ricevuta n. ${senza?.numero}/${senza?.anno} fatta da questo modulo non ha dentro questo pagamento Satispay: chiudi il modulo e riaprilo`)
  ok('…e nessuna ricevuta in più', (await aspetta(() => seg.ricevute(personaId))).length, primaDi)
  ok('…e il pagamento non è in nessuna ricevuta', (await aspetta(() => seg.pagamentiSatispay())).find?.((x) => x.id === sp.id)?.ricevutaId, undefined)
}

console.log('\n8. prima paghi, poi mandi: il riquadro PAGA')
{
  const scelta = { corso: 'c1', formula: 'annuale', nome: 'Luca', cognome: 'Rossi', email: 'luca@esempio.it' }
  const vivo = { id: 'sp1', corsoId: 'c1', formula: 'annuale', nome: 'Luca', cognome: 'Rossi', email: 'luca@esempio.it', stato: 'attesa', importo: 45000 }
  const altro = (x = {}) => ({ stima: 45000, corso: 'Judo adulti', manca: null, preparo: false, guaio: null, ...x })
  const rq = (sc, p, x) => prova(() => s.statoRiquadroPaga(sc, p, altro(x)))
  ok('il modulo non è a posto: niente tasto, la frase dice cosa manca', prova(() => { const x = rq(scelta, null, { manca: 'Manca la firma sul modulo' }); return [x.cosa, x.tasto, x.sotto] }),
    ['manca', null, 'Prima di pagare: manca la firma sul modulo'])
  ok('niente ancora preparato: si prepara, il tasto è spento', prova(() => { const x = rq(scelta, null); return [x.cosa, x.tasto, x.spento] }), ['prepara', 'PREPARO IL PAGAMENTO…', true])
  ok('in attesa ma senza link: si aspetta che sia pronto', rq(scelta, vivo)?.cosa, 'prepara')
  ok('la preparazione non è andata: RIPROVA, e il guaio si legge', prova(() => { const x = rq(scelta, null, { guaio: 'Satispay non risponde: riprova fra qualche minuto' }); return [x.tasto, x.azione, x.spento, x.testo] }),
    ['RIPROVA CON SATISPAY', 'prepara', false, 'Satispay non risponde: riprova fra qualche minuto'])
  const pronto = rq(scelta, { ...vivo, link: 'https://online.satispay.com/pay/SP-1' })
  ok('link pronto: si paga', pronto?.cosa, 'paga')
  ok('il tasto apre il link già pronto', [pronto?.azione, pronto?.link], ['link', 'https://online.satispay.com/pay/SP-1'])
  ok('il tasto dice quanto, coi centesimi', pronto?.tasto, `PAGA ${s.soldi(45000)} CON SATISPAY`)
  ok('il riquadro: bordo blu, la cifra, la riga di cosa si paga', prova(() => [pronto.bordo, pronto.importo, pronto.riga]), ['blu', 45000, 'Quota associativa e annuale Judo adulti.'])
  ok('il trimestre si dice così', rq({ ...scelta, formula: 'trimestre' }, null, { corso: 'MGA' })?.riga, 'Quota associativa e trimestre MGA.')
  ok('sotto il tasto: lo stesso pagamento se si chiude Satispay', pronto?.sotto, 'Se chiudi Satispay senza confermare, torna qui: è lo stesso pagamento, non paghi due volte.')
  ok('in attesa per un altro corso: se ne prepara uno nuovo, con la cifra di adesso',
    prova(() => { const x = rq({ ...scelta, corso: 'c2' }, { ...vivo, link: 'x' }, { stima: 20000 }); return [x.cosa, x.importo] }), ['prepara', 20000])
  ok('in attesa per un’altra email: se ne prepara uno nuovo', rq({ ...scelta, email: 'luca.rossi@esempio.it' }, { ...vivo, link: 'x' })?.cosa, 'prepara')
  ok('nome scritto con le maiuscole diverse: è lo stesso', rq({ ...scelta, nome: ' luca ', email: 'LUCA@esempio.it' }, { ...vivo, link: 'x' })?.cosa, 'paga')
  // Le 10.42 a Roma: alle 8.42 UTC d'ottobre.
  const fatto = rq(scelta, { ...vivo, stato: 'pagato', link: 'x', pagatoIl: '2026-10-20T08:42:00Z' })
  ok('pagato: si manda la richiesta', [fatto?.cosa, fatto?.tasto, fatto?.azione], ['pagato', 'MANDA LA RICHIESTA', 'manda'])
  ok('pagato: bordo verde e l’ora di Roma', [fatto?.bordo, fatto?.testo], ['fatto', '✓ Pagati con Satispay alle 10.42. Ora manda la richiesta.'])
  ok('pagato anche col modulo che ancora non va: il tasto resta MANDA, lo dice il riquadro dei guai', rq(scelta, { ...vivo, stato: 'pagato', pagatoIl: '2026-10-20T08:42:00Z' }, { manca: 'Manca la firma sul modulo' })?.cosa, 'pagato')
  const andato = rq(scelta, { ...vivo, stato: 'non-andato', link: 'x' })
  ok('non andato: si riprova', [andato?.cosa, andato?.tasto, andato?.azione], ['non-andato', 'RIPROVA CON SATISPAY', 'prepara'])
  ok('non andato: bordo giallo, la frase col segno, il bonifico sotto', prova(() => [andato.bordo, andato.testo.startsWith('! '), andato.sotto]),
    ['avviso', true, 'Oppure torna a «Paghi con» e scegli il bonifico.'])
  ok('mentre si riprepara il tasto è spento', rq(scelta, { ...vivo, stato: 'non-andato' }, { preparo: true })?.spento, true)
  const nonVale = rq({ ...scelta, corso: 'c2' }, { ...vivo, stato: 'pagato', pagatoIl: '2026-10-20T08:42:00Z' })
  ok('pagato e poi cambiato il corso: il pagamento non vale più', nonVale?.cosa, 'non-vale')
  ok('non vale: la cifra è quella pagata, e si chiama la segreteria', prova(() => [nonVale.importo, nonVale.tasto, nonVale.azione, nonVale.link?.startsWith('tel:')]), [45000, 'CHIAMA LA SEGRETERIA', 'chiama', true])
  ok('pagato e poi cambiata la formula: il pagamento non vale più', rq({ ...scelta, formula: 'trimestre' }, { ...vivo, stato: 'pagato' })?.cosa, 'non-vale')
  ok('pagato e poi cambiata l’email: non vale più', rq({ ...scelta, email: 'altra@esempio.it' }, { ...vivo, stato: 'pagato' })?.cosa, 'non-vale')

  // Quando preparare: il modulo a posto, e la stessa chiave per la stessa scelta e la stessa persona.
  ok('modulo non a posto: niente chiave, non si prepara', prova(() => s.chiavePreparo(scelta, 'Manca la firma sul modulo')), '')
  ok('modulo a posto: la chiave è scelta e persona, ripulite', prova(() => s.chiavePreparo({ ...scelta, nome: ' Luca ', email: 'Luca@Esempio.it ' }, null)), 'c1|annuale|luca|rossi|luca@esempio.it')
  ok('cambia l’email: cambia la chiave, si riprepara', prova(() => s.chiavePreparo(scelta, null) !== s.chiavePreparo({ ...scelta, email: 'altra@esempio.it' }, null)), true)

  // Cosa si manda: il pagamento solo se si paga con Satispay ed è arrivato.
  const sp = { id: 'sp1', stato: 'pagato' }
  ok('Satispay pagato: si manda il pagamento', prova(() => s.pagamentoDaMandare('satispay', sp)), 'sp1')
  ok('Satispay non pagato: niente', prova(() => s.pagamentoDaMandare('satispay', { ...sp, stato: 'attesa' })), undefined)
  ok('bonifico: niente, anche col Satispay pagato', prova(() => s.pagamentoDaMandare('bonifico', sp)), undefined)
}

console.log('\n8b. in PAGAMENTI: il pagato senza richiesta, da richiamare o restituire')
{
  const senzaRichiesta = { id: 'sp5', chi: 'Verdi Sara', nome: 'Sara', cognome: 'Verdi', email: 'sara@esempio.it', corsoId: 'c1', formula: 'trimestre', importo: 20000, stato: 'pagato', creatoIl: '2026-10-20T08:40:00Z', pagatoIl: '2026-10-20T08:42:00Z' }
  const riga = prova(() => s.righeSatispay([senzaRichiesta], nomeDi)[0])
  ok('pagato e senza richiesta: una riga che lo dice', JSON.stringify(riga ?? null).includes('Satispay senza richiesta'), true)
  ok('con nome, importo e giorno', prova(() => [riga.chi, riga.importo, riga.data]), ['Verdi Sara', 20000, '2026-10-20'])
  ok('con l’email per richiamare', JSON.stringify(riga ?? null).includes('sara@esempio.it'), true)
  ok('con il corso e la formula', prova(() => s.righeSatispay([{ ...senzaRichiesta, corso: 'MGA' }], nomeDi)[0].nota), 'Satispay senza richiesta · sara@esempio.it · trimestre MGA')
  ok('uno con la sua richiesta non lo dice', JSON.stringify(prova(() => s.righeSatispay([pagato], nomeDi))).includes('senza richiesta'), false)
  ok('in attesa senza richiesta: nessuna riga', prova(() => s.righeSatispay([{ ...senzaRichiesta, stato: 'attesa', pagatoIl: undefined }], nomeDi).length), 0)
}

console.log('\n8c. il ritorno da Satispay: la richiesta non è ancora partita')
{
  ok('pagato: si torna alla scheda del modulo a mandare', prova(() => s.ritornoSatispay({ stato: 'pagato', importo: 18000 }).testi[1]), 'Torna alla scheda dove hai compilato il modulo e premi MANDA LA RICHIESTA.')
  ok('non andato', prova(() => s.ritornoSatispay({ stato: 'non-andato', importo: 18000 }).titolo), 'IL PAGAMENTO NON È ANDATO')
  ok('un pagamento che non si trova: lo dice il titolo', prova(() => s.ritornoSatispay(null).titolo), 'PAGAMENTO NON TROVATO')
  ok('già preso da una richiesta: è arrivata, pagata', prova(() => s.ritornoSatispay({ stato: 'pagato', importo: 18000, collegato: true }).titolo), 'RICHIESTA ARRIVATA · PAGATO')
}

console.log('\n9. in prova: prima paghi, poi mandi')
{
  const r = prova(() => p.creaRichiesteProva())
  const seg = prova(() => p.creaSegreteriaProva())
  const listino = await aspetta(async () => (await seg.listino()).listino)
  const corsi = await aspetta(async () => (await seg.corsi()).filter((x) => x.id === 'judo-adulti'))
  const stima = prova(() => p.stimaIscrizione({ chi: 'Rossi Luca', corsi, formula: 'annuale' }, [], '2026-10-20', listino))
  const scelta = { corso: 'judo-adulti', formula: 'annuale', nome: 'Luca', cognome: 'Rossi', email: 'luca.prima@esempio.it' }
  const modulo = (cambi = {}) => ({
    nome: 'Luca', cognome: 'Rossi', natoIl: '1996-01-01', natoA: 'Torino', codiceFiscale: 'RSSLCU96A01L219K',
    indirizzo: 'Via Roma 1', cap: '10093', comune: 'Collegno', email: 'luca.prima@esempio.it', telefono: '347 111 2233',
    corsi: ['judo-adulti'], formula: 'annuale', regolamento: true, ...cambi,
  })
  const quante = async () => (await aspetta(() => r.richieste())).length

  const primo = await aspetta(() => r.prepara(scelta))
  ok('prepara: in attesa, col link e l’importo della stima', prova(() => [primo.stato, typeof primo.link === 'string' && primo.link !== '', primo.importo]), ['attesa', true, stima.totale])
  ok('prepara una seconda volta: lo stesso pagamento', await aspetta(async () => (await r.prepara(scelta)).id), primo?.id)
  ok('il link porta alla pagina di ritorno di questa cartella', prova(() => primo.link.startsWith('/iscrizioni/?prova&satispay=')), true)
  ok('prima di pagare: in attesa', await aspetta(async () => (await r.statoSatispay(primo.id))?.stato), 'attesa')
  const prima = await quante()
  // Gli stessi testi di invia_iscrizione in 83-satispay-prima.sql (supabase/prova/satispay.sql, sezione 10).
  ok('invia col pagamento in attesa: no', await aspetta(() => r.invia(modulo({ pagamentoSatispay: primo.id }))), `ERRORE: ${s.PAGAMENTO_NON_ARRIVATO}`)
  ok('e nessuna richiesta entrata', await quante(), prima)

  await aspetta(() => pp.pagaSatispayProva(primo.id))
  ok('aperto il link: pagato', await aspetta(async () => (await r.statoSatispay(primo.id))?.stato), 'pagato')
  ok('pagato per l’annuale, la richiesta col trimestre: no', await aspetta(() => r.invia(modulo({ formula: 'trimestre', pagamentoSatispay: primo.id }))), `ERRORE: ${s.PAGAMENTO_ALTRA_SCELTA}`)
  ok('un pagamento che non c’è: no', await aspetta(() => r.invia(modulo({ pagamentoSatispay: 'sp-che-non-ce' }))), `ERRORE: ${s.PAGAMENTO_NON_VALE}`)
  ok('pagato per un corso, la richiesta per un altro: no', await aspetta(() => r.invia(modulo({ corsi: ['judo-agonisti'], pagamentoSatispay: primo.id }))), `ERRORE: ${s.PAGAMENTO_ALTRA_SCELTA}`)
  ok('la richiesta con due corsi: no', await aspetta(() => r.invia(modulo({ corsi: ['judo-adulti', 'judo-agonisti'], pagamentoSatispay: primo.id }))), `ERRORE: ${s.PAGAMENTO_ALTRA_SCELTA}`)
  ok('a nome di un altro (chi ha trovato l’id): no', await aspetta(() => r.invia(modulo({ nome: 'Gino', cognome: 'Neri', codiceFiscale: 'NREGNI96A01L219Q', email: 'gino@esempio.it', pagamentoSatispay: primo.id }))), `ERRORE: ${s.PAGAMENTO_ALTRA_PERSONA}`)
  ok('ricaricata la pagina dopo aver pagato: prepara ritrova il pagato, non se ne paga un altro',
    await aspetta(async () => { const x = await r.prepara(scelta); return [x.id === primo.id, x.stato, x.link] }), [true, 'pagato', undefined])
  ok('e ancora nessuna richiesta entrata', await quante(), prima)

  const id = await aspetta(() => r.invia(modulo({ pagamentoSatispay: primo.id })))
  ok('pagato, stesso corso e formula: la richiesta parte', typeof id === 'string' && !id.startsWith('ERRORE') ? 'partita' : id, 'partita')
  const suo = prova(() => p.pagamentiSatispayProva().find((x) => x.id === primo.id))
  ok('il pagamento è collegato alla richiesta', suo?.richiestaId, id)
  ok('in RICHIESTE è Pagata', prova(() => s.segnoRichiesta(suo, 'nuova').tag), 'Pagata')
  ok('e statoPagamento della richiesta lo sa', await aspetta(async () => (await r.statoPagamento(id))?.stato), 'pagato')
  ok('la risposta si è persa e si rimanda lo stesso: si ritrova la stessa richiesta', await aspetta(() => r.invia(modulo({ pagamentoSatispay: primo.id }))), id)
  ok('lo stesso pagamento con un’altra email: no', await aspetta(() => r.invia(modulo({ email: 'luca.due@esempio.it', pagamentoSatispay: primo.id }))), `ERRORE: ${s.PAGAMENTO_NON_VALE}`)
  ok('e le richieste entrate sono una', await quante(), prima + 1)
  // La richiesta si cancella: il pagamento torna senza richiesta, ma è già stato preso e non si riusa.
  prova(() => p.salvaSatispay(p.pagamentiSatispayProva().map((x) => (x.id === primo.id ? { ...x, richiestaId: undefined } : x))))
  ok('preso e poi rimasto senza richiesta: non vale per un’altra', await aspetta(() => r.invia(modulo({ codiceFiscale: 'RSSLCU96A01L219K', pagamentoSatispay: primo.id }))), `ERRORE: ${s.PAGAMENTO_NON_VALE}`)

  const nuovo = await aspetta(() => r.prepara(scelta))
  ok('dopo, lo stesso modulo prepara un pagamento nuovo', prova(() => nuovo.id !== primo.id && nuovo.stato === 'attesa'), true)
  await aspetta(() => p.salvaSatispay(p.pagamentiSatispayProva().map((x) => (x.id === nuovo.id ? { ...x, stato: 'non-andato' } : x))))
  ok('non andato, mandato con la richiesta: no', await aspetta(() => r.invia(modulo({ email: 'luca.tre@esempio.it', pagamentoSatispay: nuovo.id }))), `ERRORE: ${s.PAGAMENTO_NON_ARRIVATO}`)
  ok('nome lunghissimo: lo dice, come il database', await aspetta(() => r.prepara({ ...scelta, nome: 'L'.repeat(81) })), 'ERRORE: Un campo non va: nome e cognome hanno al massimo 80 caratteri')
}

console.log('\n10. il modulo: il tasto PAGA è un link già pronto')
{
  const tsx = readFileSync('src/components/ModuloIscrizione.tsx', 'utf8')
  ok('nessun window.location.assign verso il link di Satispay', /window\.location\.assign\([^)]*link/.test(tsx), false)
  ok('il tasto PAGA è un Tasto con href al link', /<Tasto\b[^>]*\bhref=\{[^}]*link[^}]*\}/.test(tsx), true)
  ok('il riquadro segue statoRiquadroPaga', tsx.includes('statoRiquadroPaga('), true)
  ok('niente più MANDA E PAGA CON SATISPAY', tsx.includes('MANDA E PAGA CON SATISPAY'), false)
  ok('lo stato si richiede quando la pagina torna visibile', tsx.includes('visibilitychange'), true)
  ok('il pagamento da mandare viene da pagamentoDaMandare', tsx.includes('pagamentoSatispay: pagamentoDaMandare('), true)
  ok('quando preparare viene da chiavePreparo', tsx.includes('chiavePreparo('), true)
  ok('le etichette del tasto non sono scritte nel modulo', /RIPROVA CON SATISPAY|PREPARO IL PAGAMENTO/.test(tsx), false)
  ok('nome e cognome hanno al massimo 80 caratteri', (tsx.match(/maxLength=\{80\}/g) ?? []).length >= 2, true)
}

if (guai) {
  console.log(`\n${guai} cose non tornano`)
  process.exit(1)
}
console.log('\nTutto a posto')
