// ---------------------------------------------------------------------------
// Il pagamento con la carta nel modulo di iscrizione, senza browser e senza rete.
//
//   node scripts/prova-pagamento-carta.mjs
//
// (Non è `prova-carta.mjs`: quello è la carta intestata dei documenti.)
// La carta è un circuito di `pagamenti_satispay` (`circuito: 'carta'`, assente
// = Satispay): paga PayPal, solo con i campi carta ospitati e Apple Pay / Google
// Pay. Le regole stanno in `src/lib/satispay.ts`, la modalità prova in
// `richiesteProva.ts`. La metà del database: `supabase/prova/carta.sql`,
// stessi casi e stessi messaggi.
//
// Le firme che le prove assumono (le sceglie questa prova, compatibili con quelle di oggi):
//   statoCarta(ordine: { status; cattura? }, creatoIl: string, ora: Date)       in satispay.ts
//   cosaNonVaMetodo(metodo, p)                  p.circuito 'carta': vuole il metodo «Carta»
//   cosaNonVaSatispay(voci, p)                  p.circuito 'carta': conta i pagamenti col metodo «Carta»
//   cosaNonVaSatispayAMano(metodo, libero, liberoCarta?)   liberoCarta: centesimi di carta liberi dal modulo
//   richieste: cartaAttiva(), prepara(scelta, 'carta'), statoSatispay(id, 'carta'), pagaCarta(id)
// I testi che le prove fissano per la segreteria:
//   ricevuta:  «Con la carta sono arrivati 230 €: nel pagato di questa ricevuta ce ne sono 0 €»
//   metodo:    «Con la carta sono già arrivati 230 €: scegli PAGATO CON «Carta», se no si contano due volte»
//   a mano:    «Con la carta sono già arrivati 230 € dal modulo: fai la ricevuta con quelli»
// ---------------------------------------------------------------------------
import { build } from 'esbuild'
import { readFileSync } from 'node:fs'

// Oggi, per la prova, è martedì 20 ottobre 2026 a mezzogiorno.
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
// PayPal non si chiama mai dalla prova: ogni chiamata di rete è un guaio, e si conta.
let chiamateDiRete = 0
globalThis.fetch = async () => {
  chiamateDiRete++
  throw new Error('rete')
}

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
const s = await carica("export * from './src/lib/satispay'; export { SERVE_RETE } from './src/lib/saldoSatispay'")
const c = await carica("export * from './src/lib/contabilita'; export { ENTE_PREDEFINITO } from './src/lib/ricevute'")
const p = await carica(
  "export { creaRichiesteProva, pagamentiSatispayProva, salvaSatispay } from './src/lib/richiesteProva'; export { creaSegreteriaProva } from './src/lib/segreteriaProva'; export { stimaIscrizione } from './src/lib/nucleo'",
)
const sb = await carica("export { creaRichiesteSupabase } from './src/lib/richiesteSupabase'; export { FunctionsHttpError } from '@supabase/supabase-js'")

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
// La parola che chi si iscrive non deve mai leggere.
const senzaPayPal = (x) => !/paypal/i.test(JSON.stringify(x ?? null))

console.log('1. le frasi e le costanti')
{
  ok('errore per chi paga', prova(() => s.ERRORE_CARTA), 'Il pagamento con la carta non risponde: riprova fra qualche minuto')
  ok('carta spenta', prova(() => s.CARTA_SPENTA), 'Carta per ora non è attiva: scegli il bonifico')
  ok('carta rifiutata, mai il testo della banca', prova(() => s.CARTA_RIFIUTATA), 'La carta non è passata: controlla i dati o usa un’altra carta. Non ti è stato addebitato niente.')
  ok('già pagato con la carta', prova(() => s.GIA_PAGATO_CARTA), 'Hai già pagato con la carta: rimetti Carta in «Paghi con» per mandare la richiesta, o chiama la segreteria')
  ok('senza rete: la frase di sempre', prova(() => s.SERVE_RETE), 'Serve la rete per pagare')
  ok('i rifiuti di invia_iscrizione: non arrivato', prova(() => s.PAGAMENTO_CARTA_NON_ARRIVATO), 'Il pagamento con la carta non è ancora arrivato: aspetta la conferma e riprova')
  ok('altra scelta', prova(() => s.PAGAMENTO_CARTA_ALTRA_SCELTA), 'Il pagamento con la carta era per un altro corso o un’altra formula: rimetti la scelta di prima, o chiama la segreteria')
  ok('non vale', prova(() => s.PAGAMENTO_CARTA_NON_VALE), 'Questo pagamento con la carta non vale più: paga di nuovo in fondo al modulo')
  ok('altra persona', prova(() => s.PAGAMENTO_CARTA_ALTRA_PERSONA), 'Il pagamento con la carta è a un altro nome o un’altra email: rimetti quelli di prima, o chiama la segreteria')
  ok('i testi Satispay non cambiano', prova(() => [s.PAGAMENTO_NON_ARRIVATO, s.GIA_PAGATO_SATISPAY]), [
    'Il pagamento Satispay non è ancora arrivato: conferma in Satispay e riprova',
    'Hai già pagato con Satispay: rimetti Satispay in «Paghi con» per mandare la richiesta, o chiama la segreteria',
  ])
  ok('nessuna di queste frasi dice PayPal', senzaPayPal([s.ERRORE_CARTA, s.CARTA_SPENTA, s.CARTA_RIFIUTATA, s.GIA_PAGATO_CARTA, s.PAGAMENTO_CARTA_NON_ARRIVATO, s.PAGAMENTO_CARTA_ALTRA_SCELTA, s.PAGAMENTO_CARTA_NON_VALE, s.PAGAMENTO_CARTA_ALTRA_PERSONA]), true)
}

console.log('\n2. quando c’è la carta: negli stessi casi di Satispay, con la stessa frase')
{
  ok('attivo e col prezzo: Satispay c’è, e con lei la carta', prova(() => s.comePuoiPagare([], true)), { satispay: true })
  ok('senza servizio: nessuna frase', prova(() => s.comePuoiPagare([], false)), { satispay: false, perche: '' })
  ok('un corso senza prezzo: la frase di oggi, senza parlare di carta', prova(() => s.comePuoiPagare(['Judo 3'], true)), { satispay: false, perche: 'Niente Satispay per ora: il prezzo di Judo 3 lo conferma la segreteria' })
  const listino = { quota: 50, saldoEntro: '2026-08-31', offerte: [], corsi: [
    { corso: 'Judo 3', corsoId: 'c1', prezzi: [{ annuale: 400 }] },
    { corso: 'Pesi', corsoId: 'c3', prezzi: [{ etichetta: '1 GIORNO', annuale: 340 }, { etichetta: '2 GIORNI', annuale: 450 }] },
  ] }
  ok('più corsi: la frase di oggi', prova(() => s.nonSemplice([{ id: 'c1', nome: 'Judo 3' }, { id: 'c3', nome: 'Pesi' }], listino)), 'Niente Satispay per ora: con più corsi il prezzo lo conferma la segreteria')
  ok('corso a giorni: la frase di oggi', prova(() => s.nonSemplice([{ id: 'c3', nome: 'Pesi' }], listino)), 'Niente Satispay per ora: il prezzo di Pesi dipende dai giorni, lo conferma la segreteria')
  ok('fuori età: la frase di oggi', prova(() => s.nonSemplice([{ id: 'c1', nome: 'Judo 3' }], listino, ['Judo 3'])), 'Niente Satispay per ora: Judo 3 non è della sua età, la segreteria ti richiama')
  ok('corso senza voce del listino: senza prezzo anche per la carta', prova(() => s.senzaVoceDelCorso([{ id: 'c2', nome: 'Karate' }], listino)), ['Karate'])
}

console.log('\n3. come si paga: tre scelte, nessuna già scelta')
{
  const si = { satispay: true, carta: true }
  ok('carta scelta e possibile: carta', prova(() => s.modoPagamento('carta', si, false)), 'carta')
  ok('carta scelta ma non possibile: il bonifico', prova(() => s.modoPagamento('carta', { satispay: true, carta: false }, false)), 'bonifico')
  ok('carta scelta senza dire se si può: il bonifico', prova(() => s.modoPagamento('carta', { satispay: true }, false)), 'bonifico')
  ok('senza Satispay non c’è nemmeno la carta, anche se il servizio c’è', prova(() => s.modoPagamento('carta', { satispay: false, carta: true }, false)), 'bonifico')
  ok('Satispay scelto e possibile: Satispay, come prima', prova(() => s.modoPagamento('satispay', { satispay: true }, false)), 'satispay')
  ok('Satispay non possibile: bonifico, come prima', prova(() => s.modoPagamento('satispay', { satispay: false }, false)), 'bonifico')
  ok('dal nucleo nessuna scelta', prova(() => s.modoPagamento('carta', si, true)), null)
  ok('niente scelto: si sceglie', prova(() => s.modoPagamento(null, si, false)), null)
  ok('la carta non chiede la ricevuta del bonifico', prova(() => s.chiedeRicevuta('carta', false)), false)

  const nessuno = { pronto: false, giaPagato: false }
  ok('senza scelta, con la carta: le tre parole', prova(() => s.cosaNonVaModo(null, false, false, nessuno, true)), 'Manca come paghi: Satispay, carta o bonifico')
  ok('senza scelta, senza carta: il testo di oggi', prova(() => s.cosaNonVaModo(null, false, false, nessuno)), 'Manca come paghi: Satispay o bonifico')
  ok('senza scelta, carta esplicitamente spenta: il testo di oggi', prova(() => s.cosaNonVaModo(null, false, false, nessuno, false)), 'Manca come paghi: Satispay o bonifico')
  ok('carta non ancora pagata: non parte', prova(() => s.cosaNonVaModo('carta', false, false, nessuno, true)), 'Prima paga con la carta, in fondo al modulo: la richiesta parte dopo')
  ok('carta pagata per questa scelta: va, senza ricevuta', prova(() => s.cosaNonVaModo('carta', false, false, { pronto: true, giaPagato: true, circuito: 'carta' }, true)), null)
  ok('pagato con la carta e poi scelto Satispay: non parte, lo dice', prova(() => s.cosaNonVaModo('satispay', false, false, { pronto: false, giaPagato: true, circuito: 'carta' }, true)), s.GIA_PAGATO_CARTA)
  ok('pagato con la carta e poi scelto il bonifico: non parte, lo dice', prova(() => s.cosaNonVaModo('bonifico', false, true, { pronto: false, giaPagato: true, circuito: 'carta' }, true)), s.GIA_PAGATO_CARTA)
  ok('pagato con Satispay e poi scelta la carta: non parte, lo dice', prova(() => s.cosaNonVaModo('carta', false, false, { pronto: false, giaPagato: true }, true)), s.GIA_PAGATO_SATISPAY)
  ok('pagato con Satispay e poi scelto il bonifico: come prima', prova(() => s.cosaNonVaModo('bonifico', false, true, { pronto: false, giaPagato: true })), s.GIA_PAGATO_SATISPAY)
  ok('Satispay pagato per questa scelta: va, come prima', prova(() => s.cosaNonVaModo('satispay', false, false, { pronto: true, giaPagato: true })), null)
  ok('dal nucleo non si sceglie', prova(() => s.cosaNonVaModo(null, true, false, nessuno, true)), null)
  ok('la frase «già pagato con la carta» dice di rimettere Carta', String(prova(() => s.GIA_PAGATO_CARTA)).includes('rimetti Carta'), true)

  // Cosa si manda: l'id solo se è pagato e del circuito del modo.
  const cp = { id: 'cp1', stato: 'pagato', circuito: 'carta' }
  const sp = { id: 'sp1', stato: 'pagato' }
  ok('carta pagata: si manda il pagamento', prova(() => s.pagamentoDaMandare('carta', cp)), 'cp1')
  ok('carta non pagata: niente', prova(() => s.pagamentoDaMandare('carta', { ...cp, stato: 'attesa' })), undefined)
  ok('modo Satispay con un pagamento carta pagato: niente', prova(() => s.pagamentoDaMandare('satispay', cp)), undefined)
  ok('modo carta con un pagamento Satispay pagato: niente', prova(() => s.pagamentoDaMandare('carta', sp)), undefined)
  ok('bonifico: niente, anche con la carta pagata', prova(() => s.pagamentoDaMandare('bonifico', cp)), undefined)
  ok('Satispay pagato: come prima', prova(() => s.pagamentoDaMandare('satispay', sp)), 'sp1')
}

console.log('\n4. lo stato come lo dice la carta: mai pagato per sbaglio')
{
  const creato = '2026-10-20T10:00:00Z'
  const alle = (hh, mm) => new Date(`2026-10-20T${hh}:${mm}:00Z`)
  const st = (ordine, ora = alle('10', '05')) => prova(() => s.statoCarta(ordine, creato, ora))
  ok('catturato (COMPLETED): pagato', st({ status: 'APPROVED', cattura: 'COMPLETED' }), 'pagato')
  ok('catturato dopo più di 30 minuti: resta pagato, i soldi ci sono', st({ status: 'COMPLETED', cattura: 'COMPLETED' }, alle('12', '00')), 'pagato')
  ok('rifiutata dalla banca (DECLINED): non andato', st({ status: 'APPROVED', cattura: 'DECLINED' }), 'non-andato')
  ok('FAILED: non andato', st({ status: 'APPROVED', cattura: 'FAILED' }), 'non-andato')
  ok('ordine annullato (VOIDED): non andato', st({ status: 'VOIDED' }), 'non-andato')
  ok('appena creato: in attesa', st({ status: 'CREATED' }), 'attesa')
  ok('approvato ma non catturato: in attesa', st({ status: 'APPROVED' }), 'attesa')
  ok('uno stato mai visto: in attesa, mai pagato', st({ status: 'BOH' }), 'attesa')
  ok('una cattura mai vista: in attesa, mai pagato', st({ status: 'APPROVED', cattura: 'BOH' }), 'attesa')
  ok('in attesa da 29 minuti: ancora in attesa', st({ status: 'CREATED' }, alle('10', '29')), 'attesa')
  ok('in attesa da più di 30 minuti: non andato', st({ status: 'CREATED' }, alle('10', '31')), 'non-andato')
  ok('uno stato mai visto da più di 30 minuti: non andato, non pagato', st({ status: 'BOH' }, alle('11', '00')), 'non-andato')
}

// I pagamenti come li legge la segreteria. Con la carta: `circuito: 'carta'`.
const carta = { id: 'cp1', circuito: 'carta', richiestaId: 'r1', chi: 'Bianchi Paolo', importo: 23000, stato: 'pagato', creatoIl: '2026-10-19T23:20:00Z', pagatoIl: '2026-10-19T23:30:00Z' }
const cartaInAttesa = { id: 'cp2', circuito: 'carta', richiestaId: 'r2', chi: 'Verdi Sara', importo: 20000, stato: 'attesa', creatoIl: '2026-10-19T10:00:00Z' }
const cartaNonAndata = { id: 'cp3', circuito: 'carta', richiestaId: 'r3', chi: 'Neri Gino', importo: 20000, stato: 'non-andato', creatoIl: '2026-10-19T10:00:00Z' }
const cartaInRicevuta = { ...carta, id: 'cp4', ricevutaId: 'ric1', personaId: 'p-Bianchi' }
const satispay = { id: 'sp1', richiestaId: 'r9', chi: 'Rossi Luca', importo: 23000, stato: 'pagato', creatoIl: '2026-10-19T23:20:00Z', pagatoIl: '2026-10-19T23:30:00Z' }
const nomeDi = (id) => ({ 'p-Bianchi': 'Bianchi Paolo Maria' })[id] ?? '—'
const lette = (righe) => righe.map((r) => ({ id: r.id, data: r.data, importo: r.importo, metodo: r.metodo, chi: r.chi }))

console.log('\n5. in PAGAMENTI: la carta pagata, una riga, col metodo Carta')
{
  ok('pagata, in attesa, non andata, già in ricevuta: una riga', prova(() => lette(s.righeSatispay([carta, cartaInAttesa, cartaNonAndata, cartaInRicevuta], nomeDi))), [
    { id: 'carta:cp1', data: '2026-10-20', importo: 23000, metodo: 'Carta', chi: 'Bianchi Paolo' },
  ])
  ok('con Satispay e carta insieme, ognuna col suo metodo', prova(() => lette(s.righeSatispay([satispay, carta], nomeDi)).map((r) => [r.id, r.metodo])), [['satispay:sp1', 'Satispay'], ['carta:cp1', 'Carta']])
  const senzaRichiesta = { id: 'cp5', circuito: 'carta', chi: 'Verdi Sara', nome: 'Sara', cognome: 'Verdi', email: 'sara@esempio.it', corsoId: 'c1', formula: 'trimestre', corso: 'MGA', importo: 20000, stato: 'pagato', creatoIl: '2026-10-20T08:40:00Z', pagatoIl: '2026-10-20T08:42:00Z' }
  const riga = prova(() => s.righeSatispay([senzaRichiesta], nomeDi)[0])
  ok('pagata senza richiesta: la nota comincia con «Carta senza richiesta»', String(riga?.nota ?? '').startsWith('Carta senza richiesta'), true)
  ok('con l’email e il corso, per richiamare o restituire', prova(() => riga.nota), 'Carta senza richiesta · sara@esempio.it · trimestre MGA')
  ok('segnata come senza richiesta', riga?.senzaRichiesta, true)
  ok('quella con la sua richiesta non lo dice', JSON.stringify(prova(() => s.righeSatispay([carta], nomeDi))).includes('senza richiesta'), false)
  ok('Satispay senza richiesta dice ancora Satispay', prova(() => s.righeSatispay([{ ...senzaRichiesta, circuito: undefined }], nomeDi)[0].nota), 'Satispay senza richiesta · sara@esempio.it · trimestre MGA')
}

console.log('\n6. in RICHIESTE ONLINE: il segno, e cosa fare')
{
  ok('non andata: niente, si riprova', prova(() => s.segnoRichiesta(cartaNonAndata, 'nuova')), null)
  const att = prova(() => s.segnoRichiesta(cartaInAttesa, 'nuova'))
  ok('in attesa: «Carta in attesa»', [att?.tag, att?.tono], ['Carta in attesa', 'aspetta'])
  ok('…e dice «con la carta», non Satispay', [String(att?.testo).includes('con la carta'), String(att?.testo).includes('Satispay')], [true, false])
  const pag = prova(() => s.segnoRichiesta(carta, 'nuova'))
  ok('pagata', [pag?.tag, pag?.tono, String(pag?.testo).includes('Pagata con la carta il 20 ottobre')], ['Pagata', 'fatto', true])
  ok('pagata e già in ricevuta', [prova(() => s.segnoRichiesta(cartaInRicevuta, 'accolta').tag), String(prova(() => s.segnoRichiesta(cartaInRicevuta, 'accolta').testo)).includes('già nella ricevuta')], ['Pagata', true])
  const res = prova(() => s.segnoRichiesta(carta, 'rifiutata'))
  ok('pagata e rifiutata: da restituire', [res?.tag, res?.tono], ['Da restituire', 'guaio'])
  ok('…dal conto PayPal (la segreteria lo legge)', [String(res?.testo).includes('da restituire dal conto PayPal'), String(res?.testo).includes('Satispay')], [true, false])
  ok('Satispay rifiutata: come prima', prova(() => s.segnoRichiesta(satispay, 'rifiutata').testo.includes('app Satispay Business')), true)
  ok('prima di rifiutare: la carta pagata resta in PAGAMENTI, da restituire dal conto PayPal',
    prova(() => s.daRestituire(carta)), 'I 230 € pagati con la carta restano in PAGAMENTI: vanno restituiti dal conto PayPal.')
  ok('già in ricevuta: niente da restituire qui', prova(() => s.daRestituire(cartaInRicevuta)), null)
  ok('in attesa: niente', prova(() => s.daRestituire(cartaInAttesa)), null)
  ok('Satispay: la frase di oggi', prova(() => s.daRestituire(satispay)), 'I 230 € pagati con Satispay restano in PAGAMENTI: vanno restituiti dall’app Satispay Business.')
}

console.log('\n7. la ricevuta e il pagamento a mano: una volta sola')
{
  const suo = { ...carta, personaId: 'p-Bianchi' }
  const voce = (importo, metodo) => ({ descrizione: 'Annuale Judo adulti', quantita: 1, prezzo: 23000, pagamenti: importo ? [{ data: '2026-10-20', importo, metodo }] : [] })
  ok('pagato con la carta quanto è arrivato: va', prova(() => s.cosaNonVaSatispay([voce(5000, 'Carta'), voce(18000, 'Carta')], suo)), null)
  ok('con la carta in due ricevute o per meno: lo dice, col metodo Carta', prova(() => s.cosaNonVaSatispay([voce(20000, 'Carta')], suo)), 'Con la carta sono arrivati 230 €: nel pagato di questa ricevuta ce ne sono 200 €')
  ok('il pagamento carta nella ricevuta come Satispay: una sola riga, ma è sbagliato', prova(() => s.cosaNonVaSatispay([voce(23000, 'Satispay')], suo)), 'Con la carta sono arrivati 230 €: nel pagato di questa ricevuta ce ne sono 0 €')
  ok('un po’ carta e un po’ contanti: contano solo i Carta', prova(() => s.cosaNonVaSatispay([voce(20000, 'Carta'), voce(3000, 'Contanti')], suo)), 'Con la carta sono arrivati 230 €: nel pagato di questa ricevuta ce ne sono 200 €')
  ok('Satispay: come prima, conta i Satispay', prova(() => s.cosaNonVaSatispay([voce(23000, 'Satispay')], { ...satispay })), null)
  ok('carta arrivata e la ricevuta con un altro metodo: no, conterebbe due volte', prova(() => s.cosaNonVaMetodo('Contanti', suo)), 'Con la carta sono già arrivati 230 €: scegli PAGATO CON «Carta», se no si contano due volte')
  ok('carta arrivata e la ricevuta con Satispay: no', prova(() => s.cosaNonVaMetodo('Satispay', suo)), 'Con la carta sono già arrivati 230 €: scegli PAGATO CON «Carta», se no si contano due volte')
  ok('con Carta: va', prova(() => s.cosaNonVaMetodo('Carta', suo)), null)
  ok('Satispay arrivato e metodo Carta: no, come prima si vuole Satispay', prova(() => s.cosaNonVaMetodo('Carta', { ...satispay })), 'Con Satispay sono già arrivati 230 €: scegli PAGATO CON «Satispay», se no si contano due volte')
  const FRASE = 'Con la carta sono già arrivati 310 € dal modulo: fai la ricevuta con quelli'
  ok('a mano con «Carta» e una carta libera: no', prova(() => s.cosaNonVaSatispayAMano('Carta', undefined, 31000)), FRASE)
  ok('…« carta » minuscolo e con gli spazi, uguale', prova(() => s.cosaNonVaSatispayAMano(' carta ', 0, 31000)), FRASE)
  ok('a mano con «Carta» senza carta libera: va', prova(() => s.cosaNonVaSatispayAMano('Carta', 0, 0)), null)
  ok('a mano in contanti con una carta libera: va', prova(() => s.cosaNonVaSatispayAMano('Contanti', 0, 31000)), null)
  ok('a mano con Satispay e solo carta libera: va', prova(() => s.cosaNonVaSatispayAMano('Satispay', 0, 31000)), null)
  ok('a mano con Satispay e Satispay libero: la frase di oggi', prova(() => s.cosaNonVaSatispayAMano('Satispay', 31000, 0)), 'Con Satispay sono già arrivati 310 € dal modulo: fai la ricevuta con quelli')
}

console.log('\n7b. la segreteria distingue la carta da Satispay')
{
  const suo = { ...carta, personaId: 'p-Bianchi' }
  const suoSp = { ...satispay, personaId: 'p-Bianchi', importo: 10000 }
  ok('metodoDi: Carta o Satispay', prova(() => [s.metodoDi(suo), s.metodoDi(suoSp)]), ['Carta', 'Satispay'])
  ok('cartaPerPersona: solo la carta libera', prova(() => [...s.cartaPerPersona([suo, suoSp, cartaInRicevuta])]), [['p-Bianchi', 23000]])
  ok('satispayPerPersona conta ancora tutto quel che è arrivato (la persona ha pagato)', prova(() => [...s.satispayPerPersona([suo, suoSp])]), [['p-Bianchi', 33000]])
  ok('la frase della scheda: con la carta', prova(() => s.fraseDalModulo(23000, 23000)), `Ha pagato ${s.soldi(23000)} con la carta dal modulo: fai la ricevuta, con PAGATO CON «Carta».`)
  ok('…con Satispay, come prima', prova(() => s.fraseDalModulo(10000, 0)), `Ha pagato ${s.soldi(10000)} con Satispay dal modulo: fai la ricevuta, con PAGATO CON «Satispay».`)
  ok('…con tutti e due', prova(() => s.fraseDalModulo(33000, 23000)), `Ha pagato ${s.soldi(10000)} con Satispay e ${s.soldi(23000)} con la carta dal modulo: fai una ricevuta per ciascuno.`)
  ok('…niente dal modulo: niente frase', prova(() => s.fraseDalModulo(undefined, undefined)), null)
  const M = ['Bonifico', 'Contanti', 'POS', 'Assegno']
  ok('PAGATO CON nella ricevuta: con la carta arrivata c’è «Carta»', prova(() => s.metodiRicevuta(suo, undefined)), [...M, 'Carta'])
  ok('…con Satispay arrivato c’è «Satispay»', prova(() => s.metodiRicevuta(suoSp, undefined)), [...M, 'Satispay'])
  ok('…dal pagamento a mano con Satispay, «Satispay»', prova(() => s.metodiRicevuta(undefined, 'Satispay')), [...M, 'Satispay'])
  ok('…senza niente, i soliti', prova(() => s.metodiRicevuta(undefined, undefined)), M)
  const ric = readFileSync('src/components/segreteria/Ricevute.tsx', 'utf8')
  ok('Ricevute.tsx: il metodo della ricevuta è quello del pagamento arrivato, non sempre Satispay', [/setMetodo\('Satispay'\)/.test(ric), /setMetodo\(metodoDi\(sp\)\)/.test(ric)], [false, true])
  ok('Ricevute.tsx: il pagamento a mano separa la carta da Satispay', /cosaNonVaSatispayAMano\(metodo, \(p\.satispay \?\? 0\) - \(p\.carta \?\? 0\), p\.carta\)/.test(ric), true)
  const sup = readFileSync('src/lib/segreteriaSupabase.ts', 'utf8')
  const leggi = sup.slice(sup.indexOf('const leggiSatispay'), sup.indexOf('return {', sup.indexOf('const leggiSatispay')))
  ok('segreteriaSupabase: leggiSatispay legge il circuito, e senza 115 legge come prima', [/saldo_di, voce, circuito/.test(leggi), /42703.*circuito/.test(leggi), /circuito: x\.circuito/.test(leggi)], [true, true, true])
  const sp = readFileSync('src/lib/segreteriaProva.ts', 'utf8')
  ok('segreteriaProva: il pagamento a mano separa la carta da Satispay, come il database', /cosaNonVaSatispayAMano\(dati\.metodo, [^\n]*cartaPerPersona/.test(sp), true)
}

console.log('\n8. in CONTABILITÀ: cassa Carta, l’incasso pieno, una volta sola')
{
  ok('il nome della cassa', prova(() => c.NOME_CASSA_CARTA), 'Carta')
  const casse = [
    { id: 'c1', nome: 'Cassa Contanti', saldoIniziale: 0 },
    { id: 'c2', nome: 'Conto Corrente', saldoIniziale: 0 },
    { id: 'c3', nome: 'Satispay', saldoIniziale: 0, dal: '2026-10-01' },
    { id: 'c4', nome: 'Carta', saldoIniziale: 0, dal: '2026-10-01' },
  ]
  const voci = [
    { id: 'v-quota', nome: 'Quota associativa', tipo: 'entrata', diSistema: true, attiva: true },
    { id: 'v-corsi', nome: 'Corsi e altri pagamenti', tipo: 'entrata', diSistema: true, attiva: true },
  ]
  const entrate = (righe) => righe.map((r) => [r.tipo, r.data, r.importo, r.cassaId, r.annullato])
  ok('una carta pagata è un’entrata piena nella cassa Carta (la commissione entra al versamento, a mano)',
    prova(() => entrate(c.elencoMovimenti([], [], [], casse, [], voci, [carta]))), [['entrata', '2026-10-20', 23000, 'c4', false]])
  ok('in attesa e non andate non entrano', prova(() => c.elencoMovimenti([], [], [], casse, [], voci, [cartaInAttesa, cartaNonAndata]).length), 0)
  ok('Satispay non entra (i soldi sono nel versamento in banca), la carta sì nella sua cassa', prova(() => entrate(c.elencoMovimenti([], [], [], casse, [], voci, [satispay, carta])).map((r) => r[3]).sort()), ['c4'])
  const ricevuta = {
    id: 'ric1', anno: 2026, numero: 7, data: '2026-10-20', personaId: 'p-Bianchi', ente: c.ENTE_PREDEFINITO,
    intestatario: { nome: 'Paolo', cognome: 'Bianchi' },
    voci: [{ descrizione: 'Annuale Judo adulti', quantita: 1, prezzo: 23000, pagamenti: [{ data: '2026-10-20', importo: 23000, metodo: 'Carta' }] }],
    anticipo: 0, totale: 23000, pagato: 23000, creataIl: '2026-10-20T10:00:00Z',
  }
  const elenco = prova(() => c.elencoMovimenti([ricevuta], [], [], casse, [], voci, [cartaInRicevuta]))
  ok('lo stesso pagamento già in ricevuta: una sola entrata, quella della ricevuta, nella cassa Carta', prova(() => elenco.map((r) => [r.origine, r.importo, r.cassaId])), [['ricevuta', 23000, 'c4']])
}

console.log('\n9. il riquadro PAGA con la carta')
{
  const scelta = { corso: 'c1', formula: 'annuale', nome: 'Luca', cognome: 'Rossi', email: 'luca@esempio.it' }
  const vivo = { id: 'cp1', circuito: 'carta', corsoId: 'c1', formula: 'annuale', nome: 'Luca', cognome: 'Rossi', email: 'luca@esempio.it', stato: 'attesa', importo: 45000 }
  const altro = (x = {}) => ({ stima: 45000, corso: 'Judo adulti', manca: null, preparo: false, guaio: null, metodo: 'carta', ...x })
  const rq = (sc, pg, x) => prova(() => s.statoRiquadroPaga(sc, pg, altro(x)))
  const TESTO = 'Paghi adesso con la carta; la richiesta parte solo quando il pagamento è confermato.'
  ok('il modulo non è a posto: niente tasto, il testo della carta', prova(() => { const x = rq(scelta, null, { manca: 'Manca la firma sul modulo' }); return [x.cosa, x.testo, x.tasto, x.sotto] }),
    ['manca', TESTO, null, 'Prima di pagare: manca la firma sul modulo'])
  ok('niente ancora preparato: si prepara, col testo della carta', prova(() => { const x = rq(scelta, null); return [x.cosa, x.testo, x.tasto, x.spento] }), ['prepara', TESTO, 'PREPARO IL PAGAMENTO…', true])
  ok('in attesa ma senza ordine: si aspetta che sia pronto', rq(scelta, vivo)?.cosa, 'prepara')
  ok('un link non basta: serve l’ordine', rq(scelta, { ...vivo, link: 'https://x.it' })?.cosa, 'prepara')
  const pronto = rq(scelta, { ...vivo, ordine: 'ORD-1' })
  ok('con l’ordine: si paga', pronto?.cosa, 'paga')
  ok('il tasto apre i campi carta, nessun link', prova(() => [pronto.azione, pronto.link]), ['carta', undefined])
  ok('il tasto dice quanto, la stessa cifra di Satispay', pronto?.tasto, `PAGA ${s.soldi(45000)} CON LA CARTA`)
  ok('la stessa cifra del riquadro Satispay', prova(() => [pronto.importo, s.statoRiquadroPaga(scelta, { ...vivo, circuito: undefined, link: 'x' }, { ...altro(), metodo: undefined }).importo]), [45000, 45000])
  ok('il testo, e sotto il tasto cosa non arriva alla palestra', [pronto?.testo, pronto?.sotto, pronto?.bordo], [TESTO, 'Non serve nessun conto. I dati della carta non arrivano alla palestra.', 'blu'])
  ok('la riga di cosa si paga è quella di sempre', pronto?.riga, 'Quota associativa e annuale Judo adulti.')
  // Cosa si fa col pagamento di un altro circuito.
  ok('Satispay in attesa con metodo carta: non è suo, se ne prepara un altro', rq(scelta, { ...vivo, circuito: undefined, link: 'https://online.satispay.com/pay/SP-1' })?.cosa, 'prepara')
  ok('carta in attesa con metodo Satispay: non è suo, se ne prepara un altro', rq(scelta, { ...vivo, ordine: 'ORD-1' }, { metodo: undefined })?.cosa, 'prepara')
  ok('in attesa per un altro corso: se ne prepara uno nuovo, con la cifra di adesso',
    prova(() => { const x = rq({ ...scelta, corso: 'c2' }, { ...vivo, ordine: 'ORD-1' }, { stima: 20000 }); return [x.cosa, x.importo] }), ['prepara', 20000])
  // Le 10.42 a Roma: alle 8.42 UTC d'ottobre.
  const fatto = rq(scelta, { ...vivo, stato: 'pagato', ordine: 'ORD-1', pagatoIl: '2026-10-20T08:42:00Z' })
  ok('pagato: si manda la richiesta', [fatto?.cosa, fatto?.tasto, fatto?.azione], ['pagato', 'MANDA LA RICHIESTA', 'manda'])
  ok('pagato: bordo verde e l’ora di Roma', [fatto?.bordo, fatto?.testo], ['fatto', '✓ Pagati con la carta alle 10.42. Ora manda la richiesta.'])
  const andato = rq(scelta, { ...vivo, stato: 'non-andato', ordine: 'ORD-1' })
  ok('non andato: si riprova con la carta', [andato?.cosa, andato?.tasto, andato?.azione], ['non-andato', 'RIPROVA CON LA CARTA', 'prepara'])
  ok('non andato: bordo giallo, il testo che dice che non è stato addebitato niente', [andato?.bordo, andato?.testo],
    ['avviso', '! La carta non è passata, o hai chiuso prima di confermare. Non ti è stato addebitato niente e la richiesta non è partita.'])
  ok('non andato: sotto, un’altra carta o un’altra scelta', andato?.sotto, 'Puoi usare un’altra carta, o tornare a «Paghi con» e scegliere Satispay o il bonifico.')
  ok('mentre si riprepara il tasto è spento', rq(scelta, { ...vivo, stato: 'non-andato' }, { preparo: true })?.spento, true)
  // Pagato, ma non è quello che si sta facendo.
  const altroCorso = rq({ ...scelta, corso: 'c2' }, { ...vivo, stato: 'pagato', ordine: 'ORD-1' })
  ok('carta pagata e poi cambiato il corso: non vale più', [altroCorso?.cosa, altroCorso?.importo, altroCorso?.azione], ['non-vale', 45000, 'chiama'])
  const satPagato = rq(scelta, { ...vivo, circuito: undefined, stato: 'pagato', link: 'x', pagatoIl: '2026-10-20T08:42:00Z' })
  ok('pagato con Satispay e poi scelta la carta: non vale, col testo Satispay', [satPagato?.cosa, satPagato?.testo], ['non-vale', s.GIA_PAGATO_SATISPAY])
  const cartaPagata = rq(scelta, { ...vivo, stato: 'pagato', ordine: 'ORD-1', pagatoIl: '2026-10-20T08:42:00Z' }, { metodo: undefined })
  ok('pagato con la carta e poi scelto Satispay: non vale, col testo della carta', [cartaPagata?.cosa, cartaPagata?.testo], ['non-vale', s.GIA_PAGATO_CARTA])
  ok('il riquadro Satispay di oggi non cambia', prova(() => { const x = s.statoRiquadroPaga(scelta, { ...vivo, circuito: undefined, link: 'https://online.satispay.com/pay/SP-1' }, { ...altro(), metodo: undefined }); return [x.tasto, x.azione, x.link, x.testo] }),
    [`PAGA ${s.soldi(45000)} CON SATISPAY`, 'link', 'https://online.satispay.com/pay/SP-1', 'Paghi adesso con Satispay; la richiesta parte solo quando Satispay conferma.'])
  // Criterio 1: chi si iscrive non legge mai «PayPal».
  const stati = [
    rq(scelta, null, { manca: 'Manca la firma sul modulo' }), rq(scelta, null), pronto, fatto, andato, altroCorso, satPagato, cartaPagata,
    rq(scelta, null, { guaio: s.ERRORE_CARTA }),
  ]
  ok('mai «PayPal» nel riquadro', senzaPayPal(stati), true)
}

console.log('\n10. in prova: prima paghi con la carta, poi mandi, e PayPal non si chiama mai')
{
  const r = prova(() => p.creaRichiesteProva())
  const seg = prova(() => p.creaSegreteriaProva())
  // Come in produzione: il listino salvato dalla segreteria, con le voci agganciate ai corsi (senza, il database non dà un prezzo).
  await aspetta(async () => seg.salvaListino((await seg.listino()).listino))
  const listino = await aspetta(async () => (await seg.listino()).listino)
  const corsi = await aspetta(async () => (await seg.corsi()).filter((x) => x.id === 'judo-adulti'))
  const stima = prova(() => p.stimaIscrizione({ chi: 'Rossi Luca', corsi, formula: 'annuale' }, [], '2026-10-20', listino))
  const scelta = { corso: 'judo-adulti', formula: 'annuale', nome: 'Luca', cognome: 'Rossi', email: 'luca.carta@esempio.it', chiave: 'k-luca' }
  const modulo = (cambi = {}) => ({
    nome: 'Luca', cognome: 'Rossi', natoIl: '1996-01-01', natoA: 'Torino', codiceFiscale: 'RSSLCU96A01L219K',
    indirizzo: 'Via Roma 1', cap: '10093', comune: 'Collegno', email: 'luca.carta@esempio.it', telefono: '347 111 2233',
    corsi: ['judo-adulti'], formula: 'annuale', regolamento: true, chiavePagamento: 'k-luca', ...cambi,
  })
  const quante = async () => (await aspetta(() => r.richieste())).length

  const attiva = await aspetta(() => r.cartaAttiva())
  ok('in prova la carta c’è: un client id finto, in sandbox', [typeof attiva?.clientId === 'string' && attiva.clientId !== '' && !attiva.clientId.startsWith('ERRORE'), attiva?.sandbox], [true, true])
  const primo = await aspetta(() => r.prepara(scelta, 'carta'))
  ok('prepara: in attesa, con l’ordine e l’importo della stima, senza link', prova(() => [primo.stato, typeof primo.ordine === 'string' && primo.ordine !== '', primo.importo, primo.link]), ['attesa', true, stima.totale, undefined])
  // Doppio tocco: un solo ordine.
  const [d1, d2] = await Promise.all([aspetta(() => r.prepara(scelta, 'carta')), aspetta(() => r.prepara(scelta, 'carta'))])
  ok('doppio tocco: lo stesso pagamento, un solo ordine', [d1?.id, d2?.id, d1?.ordine, d2?.ordine], [primo?.id, primo?.id, primo?.ordine, primo?.ordine])
  ok('un solo pagamento vivo con la carta', prova(() => p.pagamentiSatispayProva().filter((x) => x.circuito === 'carta' && x.stato === 'attesa').length), 1)
  ok('il pagamento è del circuito carta', prova(() => p.pagamentiSatispayProva().find((x) => x.id === primo.id)?.circuito), 'carta')
  ok('Satispay con la stessa scelta: un altro pagamento, mai quello della carta', await aspetta(async () => { const x = await r.prepara(scelta); return [x.id !== primo.id, x.stato, typeof x.link] }), [true, 'attesa', 'string'])
  ok('…e la carta ritrova ancora il suo', await aspetta(async () => (await r.prepara(scelta, 'carta')).id), primo?.id)
  ok('prima di pagare: in attesa', await aspetta(async () => (await r.statoSatispay(primo.id, 'carta'))?.stato), 'attesa')
  ok('abbandonato e ripreso: lo stesso ordine', await aspetta(async () => (await r.prepara(scelta, 'carta')).ordine), primo?.ordine)
  // Chi conosce nome, email e scelta di Luca non ritrova il suo pagamento: serve la chiave del browser di Luca.
  const altro = await aspetta(() => r.prepara({ ...scelta, chiave: 'k-altro' }, 'carta'))
  ok('un altro browser (un’altra chiave): un altro pagamento', prova(() => altro.id !== primo.id), true)
  ok('senza chiave: ricarica la pagina, come il database', await aspetta(() => r.prepara({ ...scelta, chiave: undefined }, 'carta')), 'ERRORE: Ricarica la pagina e riprova a pagare')
  ok('in attesa, per lo stato col modo Satispay: niente (un altro circuito)', await aspetta(() => r.statoSatispay(primo.id)), null)

  const prima = await quante()
  ok('invia con la carta in attesa: no', await aspetta(() => r.invia(modulo({ pagamentoSatispay: primo.id }))), `ERRORE: ${s.PAGAMENTO_CARTA_NON_ARRIVATO}`)
  ok('e nessuna richiesta entrata', await quante(), prima)

  const pagato = await aspetta(() => r.pagaCarta(primo.id))
  ok('pagaCarta: pagato, con l’importo e l’ora', prova(() => [pagato.stato, pagato.importo, typeof pagato.pagatoIl]), ['pagato', stima.totale, 'string'])
  ok('lo stato lo dice pagato', await aspetta(async () => (await r.statoSatispay(primo.id, 'carta'))?.stato), 'pagato')
  ok('pagare di nuovo non cambia niente', await aspetta(async () => (await r.pagaCarta(primo.id)).importo), stima.totale)
  ok('PayPal non è mai stato chiamato', chiamateDiRete, 0)

  ok('pagato per l’annuale, la richiesta col trimestre: no', await aspetta(() => r.invia(modulo({ formula: 'trimestre', pagamentoSatispay: primo.id }))), `ERRORE: ${s.PAGAMENTO_CARTA_ALTRA_SCELTA}`)
  ok('un pagamento che non c’è: no', await aspetta(() => r.invia(modulo({ pagamentoSatispay: 'cp-che-non-ce' }))), `ERRORE: ${s.PAGAMENTO_NON_VALE}`)
  ok('pagato per un corso, la richiesta per un altro: no', await aspetta(() => r.invia(modulo({ corsi: ['judo-agonisti'], pagamentoSatispay: primo.id }))), `ERRORE: ${s.PAGAMENTO_CARTA_ALTRA_SCELTA}`)
  ok('la richiesta con due corsi: no', await aspetta(() => r.invia(modulo({ corsi: ['judo-adulti', 'judo-agonisti'], pagamentoSatispay: primo.id }))), `ERRORE: ${s.PAGAMENTO_CARTA_ALTRA_SCELTA}`)
  ok('a nome di un altro: no', await aspetta(() => r.invia(modulo({ nome: 'Gino', cognome: 'Neri', codiceFiscale: 'NREGNI96A01L219Q', email: 'gino@esempio.it', pagamentoSatispay: primo.id }))), `ERRORE: ${s.PAGAMENTO_CARTA_ALTRA_PERSONA}`)
  ok('ricaricata la pagina dopo aver pagato: prepara ritrova il pagato', await aspetta(async () => { const x = await r.prepara(scelta, 'carta'); return [x.id === primo.id, x.stato] }), [true, 'pagato'])
  ok('…ma non da un altro browser', await aspetta(async () => (await r.prepara({ ...scelta, chiave: 'k-terzo' }, 'carta')).id !== primo.id), true)
  ok('e ancora nessuna richiesta entrata', await quante(), prima)

  const id = await aspetta(() => r.invia(modulo({ pagamentoSatispay: primo.id })))
  ok('pagato, stesso corso, formula e nome: la richiesta parte', typeof id === 'string' && !id.startsWith('ERRORE') ? 'partita' : id, 'partita')
  const suo = prova(() => p.pagamentiSatispayProva().find((x) => x.id === primo.id))
  ok('il pagamento è collegato alla richiesta', suo?.richiestaId, id)
  ok('in RICHIESTE è Pagata', prova(() => s.segnoRichiesta(suo, 'nuova').tag), 'Pagata')
  ok('in PAGAMENTI non è «senza richiesta»: ha la sua', prova(() => s.righeSatispay([suo], () => '')[0].senzaRichiesta ?? false), false)
  ok('la risposta si è persa e si rimanda lo stesso: la stessa richiesta', await aspetta(() => r.invia(modulo({ pagamentoSatispay: primo.id }))), id)
  ok('lo stesso pagamento con un’altra email: no', await aspetta(() => r.invia(modulo({ email: 'luca.due@esempio.it', pagamentoSatispay: primo.id }))), `ERRORE: ${s.PAGAMENTO_CARTA_NON_VALE}`)
  ok('le richieste entrate sono una', await quante(), prima + 1)

  // Rifiutata dalla banca: non va, e non entra niente in PAGAMENTI.
  const nuovo = await aspetta(() => r.prepara(scelta, 'carta'))
  ok('dopo, lo stesso modulo prepara un ordine nuovo', prova(() => nuovo.id !== primo.id && nuovo.stato === 'attesa'), true)
  await aspetta(() => p.salvaSatispay(p.pagamentiSatispayProva().map((x) => (x.id === nuovo.id ? { ...x, stato: 'non-andato' } : x))))
  ok('carta non andata, mandata con la richiesta: no', await aspetta(() => r.invia(modulo({ email: 'luca.tre@esempio.it', pagamentoSatispay: nuovo.id }))), `ERRORE: ${s.PAGAMENTO_CARTA_NON_ARRIVATO}`)
  ok('la carta non andata non è una riga di PAGAMENTI', prova(() => s.righeSatispay(p.pagamentiSatispayProva().filter((x) => x.id === nuovo.id), () => '').length), 0)
  // I 30 minuti, come nel database: un ordine lasciato a metà non si riprende né si cattura.
  const vecchio = await aspetta(() => r.prepara({ ...scelta, email: 'luca.vecchio@esempio.it' }, 'carta'))
  const invecchia = (id) => aspetta(() => p.salvaSatispay(p.pagamentiSatispayProva().map((x) => (x.id === id ? { ...x, creatoIl: '2026-10-20T09:00:00Z' } : x))))
  await invecchia(vecchio.id)
  const dopo = await aspetta(() => r.prepara({ ...scelta, email: 'luca.vecchio@esempio.it' }, 'carta'))
  ok('in attesa da più di 30 minuti: prepara ne fa uno nuovo', prova(() => [dopo.id !== vecchio.id, dopo.stato]), [true, 'attesa'])
  ok('…e il vecchio non è andato', prova(() => p.pagamentiSatispayProva().find((x) => x.id === vecchio.id)?.stato), 'non-andato')
  await invecchia(dopo.id)
  ok('pagare dopo 30 minuti: non andato, non si incassa', await aspetta(async () => (await r.pagaCarta(dopo.id)).stato), 'non-andato')
  ok('pagare un pagamento che non c’è: lo dice', await aspetta(() => r.pagaCarta('cp-che-non-ce')), `ERRORE: ${s.ERRORE_CARTA}`)
  ok('nome lunghissimo: lo dice, come il database', await aspetta(() => r.prepara({ ...scelta, nome: 'L'.repeat(81) }, 'carta')), 'ERRORE: Un campo non va: nome e cognome hanno al massimo 80 caratteri')
  ok('un corso che non c’è: lo dice, come Satispay', await aspetta(() => r.prepara({ ...scelta, corso: 'corso-che-non-ce' }, 'carta')), 'ERRORE: Uno dei corsi scelti non c\'è più: ricarica la pagina')

  // Un pagamento Satispay mandato col modo carta (o l'inverso) non entra: l'id è di un altro circuito.
  const sp = await aspetta(() => r.prepara({ ...scelta, email: 'luca.sp@esempio.it' }))
  await aspetta(() => p.salvaSatispay(p.pagamentiSatispayProva().map((x) => (x.id === sp.id ? { ...x, stato: 'pagato', pagatoIl: new Date().toISOString() } : x))))
  ok('un Satispay pagato resta Satispay: invia lo prende coi suoi testi', await aspetta(() => r.invia(modulo({ email: 'luca.sp@esempio.it', formula: 'trimestre', pagamentoSatispay: sp.id }))), `ERRORE: ${s.PAGAMENTO_ALTRA_SCELTA}`)
  ok('PayPal non è mai stato chiamato, nemmeno alla fine', chiamateDiRete, 0)
}

console.log('\n11. senza rete e senza il file SQL (la parte che parla col server)')
{
  const scelta = { corso: 'c1', formula: 'annuale', nome: 'Luca', cognome: 'Rossi', email: 'luca@esempio.it', chiave: 'k-luca' }
  let mandato
  const ascolta = { functions: { invoke: async (_f, { body }) => ((mandato = body), { data: { stato: 'attesa', id: 'cp1', importo: 100, ordine: 'PP-1' }, error: null }) } }
  await aspetta(() => sb.creaRichiesteSupabase(ascolta).prepara(scelta, 'carta'))
  ok('prepara manda alla funzione la chiave del browser', mandato?.chiave, 'k-luca')
  const senzaRete = { functions: { invoke: async () => ({ data: null, error: new Error('Failed to fetch') }) }, rpc: async () => ({ data: null, error: new Error('Failed to fetch') }) }
  const r = prova(() => sb.creaRichiesteSupabase(senzaRete))
  ok('senza rete: la carta non si offre, nessun errore', await aspetta(() => r.cartaAttiva()), null)
  ok('senza rete: Satispay e bonifico non cambiano (satispayAttivo non lancia)', await aspetta(() => r.satispayAttivo()), false)
  ok('senza rete: prepara dice SERVE_RETE', await aspetta(() => r.prepara(scelta, 'carta')), `ERRORE: ${s.SERVE_RETE}`)
  ok('senza rete: pagaCarta dice SERVE_RETE', await aspetta(() => r.pagaCarta('cp1')), `ERRORE: ${s.SERVE_RETE}`)
  // Senza 115-carta.sql la funzione risponde 404 / PGRST202: la carta non c'è, il resto va.
  const non404 = () => new sb.FunctionsHttpError(new Response('{}', { status: 404 }))
  const senzaSql = { functions: { invoke: async () => ({ data: null, error: non404() }) }, rpc: async () => ({ data: null, error: { code: 'PGRST202', message: 'Could not find the function' } }) }
  const r2 = prova(() => sb.creaRichiesteSupabase(senzaSql))
  ok('senza il file SQL: cartaAttiva è null', await aspetta(() => r2.cartaAttiva()), null)
  // Google Pay vuole sapere se PayPal è la sandbox: lo dice la funzione, che sa a quale PayPal parla.
  const accesa = (sandbox) => ({ functions: { invoke: async () => ({ data: { attivo: true, clientId: 'abc', sandbox }, error: null }) } })
  ok('accesa in sandbox', await aspetta(() => sb.creaRichiesteSupabase(accesa(true)).cartaAttiva()), { clientId: 'abc', sandbox: true })
  ok('accesa in produzione', await aspetta(() => sb.creaRichiesteSupabase(accesa(false)).cartaAttiva()), { clientId: 'abc', sandbox: false })
  ok('senza il file SQL: prepara con la carta dice CARTA_SPENTA', await aspetta(() => r2.prepara(scelta, 'carta')), `ERRORE: ${s.CARTA_SPENTA}`)
}

console.log('\n11b. la chiave del browser')
{
  const k = prova(() => s.chiaveDelBrowser())
  ok('è un uuid', /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(k), true)
  ok('la stessa a ogni chiamata (si ritrova dopo aver ricaricato la pagina)', prova(() => s.chiaveDelBrowser()), k)
  const vera = globalThis.localStorage
  globalThis.localStorage = { getItem() { throw new Error('bloccato') }, setItem() { throw new Error('bloccato') } }
  const senza = prova(() => s.chiaveDelBrowser())
  ok('senza localStorage (navigazione privata): una chiave lo stesso, la stessa finché resta la pagina', [typeof senza, senza === prova(() => s.chiaveDelBrowser())], ['string', true])
  globalThis.localStorage = vera
}

console.log('\n11c. la Edge Function: catturare o no, e dopo la cattura')
{
  const creato = '2026-10-20T10:00:00Z'
  const alle = (mm) => new Date(`2026-10-20T10:${mm}:00Z`)
  ok('confermato a 29 minuti: si cattura', prova(() => s.siCattura(creato, alle('29'))), true)
  ok('confermato a 31 minuti: non si cattura, il modulo l’ha già dato per non andato', prova(() => s.siCattura(creato, alle('31'))), false)
  const dopo = (risposta, riletto) => prova(() => s.statoDopoCattura(risposta, riletto, creato, alle('05')))
  ok('catturata: pagato', dopo({ status: 'COMPLETED', cattura: 'COMPLETED' }, null), 'pagato')
  ok('catturata ma rifiutata dalla banca: non andato', dopo({ status: 'COMPLETED', cattura: 'DECLINED' }, null), 'non-andato')
  ok('422, e l’ordine riletto non è catturato: la carta rifiutata, non andato', dopo('rifiuto', { status: 'APPROVED' }), 'non-andato')
  ok('422 perché già catturato (la prima risposta persa): pagato, mai non andato', dopo('rifiuto', { status: 'COMPLETED', cattura: 'COMPLETED' }), 'pagato')
  ok('422 e l’ordine non si rilegge: non si sa, niente si scrive', dopo('rifiuto', null), null)
  ok('nessuna risposta, riletto catturato: pagato', dopo(null, { status: 'COMPLETED', cattura: 'COMPLETED' }), 'pagato')
  ok('nessuna risposta, riletto in attesa: in attesa', dopo(null, { status: 'APPROVED' }), 'attesa')
  ok('nessuna risposta e niente da rileggere: niente si scrive', dopo(null, null), null)
}

console.log('\n11d. cosa dice il riquadro quando la carta non passa')
{
  ok('i dati scritti male: controllali', prova(() => s.guaioInvio(false, null)), s.DATI_CARTA)
  ok('dati giusti, e la banca ha già detto no: resta quello', prova(() => s.guaioInvio(true, s.CARTA_RIFIUTATA)), s.CARTA_RIFIUTATA)
  ok('dati giusti e nessun motivo: non risponde, mai «controlla i dati»', prova(() => s.guaioInvio(true, null)), s.ERRORE_CARTA)
  ok('non si sa se i dati sono giusti: non risponde', prova(() => s.guaioInvio(null, null)), s.ERRORE_CARTA)
  ok('Google Pay chiuso da chi paga: nessun guaio', prova(() => s.guaioGoogle({ statusCode: 'CANCELED' })), null)
  ok('Google Pay che non parte: non risponde', prova(() => s.guaioGoogle({ statusCode: 'DEVELOPER_ERROR' })), s.ERRORE_CARTA)
  ok('la carta di Google Pay non passa: rifiutata', prova(() => s.guaioGoogle(new Error('x'))), s.CARTA_RIFIUTATA)
  ok('nessuna di queste frasi dice PayPal', /paypal/i.test(prova(() => s.DATI_CARTA)), false)
}

console.log('\n12. nessun dato della carta nei tipi')
{
  const sorgente = readFileSync('src/lib/satispay.ts', 'utf8')
  const tipo = (nome) => sorgente.match(new RegExp(`(?:interface|type) ${nome}\\b[\\s\\S]*?\\n}(?=\\n)|type ${nome} = [^\\n]*`))?.[0] ?? ''
  const dati = /\b(numero|cvv|cvc|scadenza|pan|iban|titolare)\b/i
  ok('PagamentoSatispay non ha campi per la carta', dati.test(tipo('PagamentoSatispay')), false)
  ok('PagamentoPrima non ha campi per la carta', dati.test(tipo('PagamentoPrima')), false)
  ok('PagamentoPrima porta l’ordine e il circuito', [/\bordine\?: string/.test(tipo('PagamentoPrima')), /circuito\?: 'carta'/.test(tipo('PagamentoPrima'))], [true, true])
  ok('PagamentoSatispay porta il circuito', /circuito\?: 'carta'/.test(tipo('PagamentoSatispay')), true)
}

console.log('\n13. la pagina finale dopo la carta')
{
  ok('pagato con la carta', prova(() => s.esitoPagamento({ stato: 'pagato', importo: 18000, pagatoIl: '2026-10-20T10:00:00Z', circuito: 'carta' }).testi[0]), 'Hai pagato 180 € con la carta il 20 ottobre.')
  ok('senza circuito resta Satispay', prova(() => s.esitoPagamento({ stato: 'pagato', importo: 18000, pagatoIl: '2026-10-20T10:00:00Z' }).testi[0]), 'Hai pagato 180 € con Satispay il 20 ottobre.')
}

if (guai) {
  console.log(`\n${guai} cose non tornano`)
  process.exit(1)
}
console.log('\nTutto a posto')
