// ---------------------------------------------------------------------------
// Assegnare un movimento collegato a una persona, senza browser.
//
//   node scripts/prova-assegna-movimento.mjs
//
// Un'entrata già collegata a una persona (bonifico) si assegna a quota e corsi, anche dei fratelli del nucleo, come
// saldo o parziale; dal movimento si fa la ricevuta; in CONTABILITÀ quei soldi restano una volta sola.
// Controlla `src/lib/assegna.ts` (daAssegnare, proponiRipartizione, cosaNonVaAssegnazione, abbinamentiProposti,
// elencoDaAssegnare, quoteConAssegnazioni, vociCorsiConAssegnazioni, cosaNonVaMovimentoDaAssegnare, personeDelNucleo),
// `incassiDerivati` (nessun «Incasso iscritto» per i soldi di un movimento) e la modalità prova, che ha le stesse regole
// del database (`assegna_movimento`, `emetti_ricevuta_da_movimento`, `abbina_ricevuta_movimento`, `annulla_ricevuta`,
// `annulla_movimento`): gli stessi casi e gli stessi messaggi di `supabase/prova/assegna-movimento.sql`.
// Importi in centesimi, nomi tutti inventati. Il progetto: la PR «Assegna il pagamento», canvas in
// docs/design-canvas/assegna-pagamento/.
// ---------------------------------------------------------------------------
process.env.TZ = 'Europe/Rome'

import { build } from 'esbuild'

const memoria = new Map()
globalThis.localStorage = {
  getItem: (k) => (memoria.has(k) ? memoria.get(k) : null),
  setItem: (k, v) => memoria.set(k, String(v)),
  removeItem: (k) => memoria.delete(k),
}
globalThis.window = { location: { search: '', hash: '' }, addEventListener() {} }

const impacchetta = async (contents, platform = 'node') => {
  const { outputFiles } = await build({
    stdin: { contents, resolveDir: '.', loader: 'ts' },
    bundle: true, format: 'esm', platform, write: false, logLevel: 'silent', define: { 'import.meta.env': '{}' },
  })
  return import('data:text/javascript;base64,' + Buffer.from(outputFiles[0].text).toString('base64'))
}

let guai = 0
const ok = (cosa, avuto, voluto) => {
  const va = JSON.stringify(avuto) === JSON.stringify(voluto)
  console.log(va ? '  ✓' : '  ✗', cosa, va ? '' : `— atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`)
  if (!va) guai++
}
// Un rifiuto: il messaggio, o «nessun errore». Una funzione che manca dà «manca …», che non è mai il messaggio voluto.
const errore = async (f) => {
  try {
    await f()
    return 'nessun errore'
  } catch (e) {
    return e.message
  }
}
const prova = (f) => {
  try {
    return f()
  } catch (e) {
    return `ERRORE: ${e.message}`
  }
}

// Il modulo nuovo che ancora non c'è non ferma la prova: ogni caso dice la sua cosa mancante.
let A = {}
try {
  A = await impacchetta("export * from './src/lib/assegna'")
} catch (e) {
  console.log('  (src/lib/assegna.ts non si carica:', (e.errors?.[0]?.text ?? e.message).split('\n')[0], ')')
}
const lib = (nome) => (typeof A[nome] === 'function' ? A[nome] : () => { throw new Error(`manca ${nome} in src/lib/assegna.ts`) })
const daAssegnare = lib('daAssegnare')
const proponiRipartizione = lib('proponiRipartizione')
const cosaNonVaAssegnazione = lib('cosaNonVaAssegnazione')
const abbinamentiProposti = lib('abbinamentiProposti')
const elencoDaAssegnare = lib('elencoDaAssegnare')
const quoteConAssegnazioni = lib('quoteConAssegnazioni')
const vociCorsiConAssegnazioni = lib('vociCorsiConAssegnazioni')
const cosaNonVaMovimentoDaAssegnare = lib('cosaNonVaMovimentoDaAssegnare')
const personeDelNucleo = lib('personeDelNucleo')
const vociDaMovimento = lib('vociDaMovimento')
const cosaNonVaRicevutaDaMovimento = lib('cosaNonVaRicevutaDaMovimento')
const bonificiDaAssegnare = lib('bonificiDaAssegnare')
const euroAssegna = lib('euroAssegna')
const cosaNonVaQuota = lib('cosaNonVaQuota')

const B = await impacchetta(`
  export { elencoMovimenti, totali, previstoCassa, residui, incassiDerivati, righeMovimenti } from './src/lib/contabilita'
  export { bilancioAnno } from './src/lib/bilancio'
  export { statoCorsi } from './src/lib/corsiDaPagare'
  export { pagamentoDi, inRegola } from './src/lib/segreteria'
  export { creaSegreteriaProva } from './src/lib/segreteriaProva'
  export { righeDaRicevute, righeDirette } from './src/lib/pagamenti'
  export { fraseQuota } from './src/lib/schedeIscritto'
`)
// A parte e per il browser: la segreteria del database tira dentro sanitize-html, che per «node» chiede `require`.
const S = await impacchetta("export { creaSegreteriaSupabase } from './src/lib/segreteriaSupabase'", 'browser')

// ---- i dati ----------------------------------------------------------------
const CONTI = { id: 'conto', nome: 'Conto Corrente', saldoIniziale: 0 }
const CONTANTI = { id: 'contanti', nome: 'Cassa Contanti', saldoIniziale: 0 }
const casse = [CONTANTI, CONTI]
const voci = [
  { id: 'v-quota', nome: 'Quota associativa', tipo: 'entrata', diSistema: true, attiva: true },
  { id: 'v-corsi', nome: 'Corsi e altri pagamenti', tipo: 'entrata', diSistema: true, attiva: true },
  { id: 'v-gare', nome: 'Gare', tipo: 'entrata', diSistema: true, attiva: true },
  { id: 'v-spese', nome: 'Commissioni bancarie', tipo: 'uscita', diSistema: false, attiva: true },
]
const movimento = (id, importo, o = {}) => ({
  id, tipo: 'entrata', data: '2026-10-15', importo, voceId: 'v-corsi', cassaId: 'conto', descrizione: `Bonifico ${id}`, creatoIl: '2026-10-15T10:00:00Z', personaId: 'mario', ...o,
})
// Una riga di PAGAMENTI fatta a mano; con `movimentoId` è un'ASSEGNAZIONE del movimento.
const diretto = (id, personaId, importo, voce, o = {}) => ({
  id, personaId, data: '2026-10-15', importo, metodo: 'Bonifico', voce, creatoIl: '2026-10-15T10:00:00Z', ...o,
})
const voceRic = (descrizione, prezzo, pagato, o = {}) => ({
  descrizione, quantita: 1, prezzo, pagamenti: pagato ? [{ data: '2026-10-15', importo: pagato, metodo: 'Bonifico' }] : [], ...o,
})
const ricevuta = (id, personaId, voci2, o = {}) => ({
  id, anno: 2026, numero: 1, data: '2026-10-15', ente: 'ODS', personaId, intestatario: { nome: 'Mario', cognome: 'Rossi' }, voci: voci2, anticipo: 0,
  totale: voci2.reduce((s, v) => s + v.prezzo, 0), pagato: voci2.reduce((s, v) => s + v.pagamenti.reduce((t, p) => t + p.importo, 0), 0), creataIl: '2026-10-15T10:00:00Z', ...o,
})
const nomi = [{ id: 'mario', nome: 'Mario', cognome: 'Rossi' }, { id: 'luca', nome: 'Luca', cognome: 'Rossi' }, { id: 'sofia', nome: 'Sofia', cognome: 'Rossi' }]

console.log('1. Quanto resta da assegnare di un movimento')
{
  const m = movimento('m1', 42000)
  ok('niente assegnato: tutto da assegnare', prova(() => daAssegnare(m, [], [])), 42000)
  ok('bonifico da 420 € tutto sull’annuale Judo: 0 da assegnare', prova(() => daAssegnare(m, [diretto('d1', 'mario', 42000, 'Annuale Judo Kids', { movimentoId: 'm1' })], [])), 0)
  ok('assegnati 50 €: restano 370', prova(() => daAssegnare(m, [diretto('d1', 'mario', 5000, 'Quota associativa 2026/27', { movimentoId: 'm1' })], [])), 37000)
  ok('un’assegnazione annullata non conta', prova(() => daAssegnare(m, [diretto('d1', 'mario', 5000, 'Quota', { movimentoId: 'm1', annullatoIl: '2026-10-16T08:00:00Z' })], [])), 42000)
  ok('i pagamenti a mano di un altro movimento o senza movimento non contano', prova(() => daAssegnare(m, [diretto('d1', 'mario', 5000, 'Quota', { movimentoId: 'm2' }), diretto('d2', 'mario', 5000, 'Quota')], [])), 42000)
  // L'assegnazione diventata ricevuta è annullata col suo `ricevutaId`: i soldi ora sono nel `pagato` della ricevuta, una volta sola.
  const r = ricevuta('r1', 'mario', [voceRic('ANNUALE JUDO KIDS', 42000, 42000)], { movimentoId: 'm1' })
  const passata = diretto('d1', 'mario', 42000, 'Annuale Judo Kids', { movimentoId: 'm1', annullatoIl: '2026-10-16T08:00:00Z', ricevutaId: 'r1' })
  ok('assegnazione diventata ricevuta: non si conta due volte, 0 da assegnare', prova(() => daAssegnare(m, [passata], [r])), 0)
  ok('…una ricevuta annullata non conta: i soldi tornano da assegnare', prova(() => daAssegnare(m, [passata], [{ ...r, annullataIl: '2026-10-17T08:00:00Z' }])), 42000)
  ok('una ricevuta di un altro movimento, o senza movimento, non conta', prova(() => daAssegnare(m, [], [{ ...r, movimentoId: 'm2' }, { ...r, id: 'r2', movimentoId: undefined }])), 42000)
  ok('mai negativo, anche se i dati non tornano', prova(() => daAssegnare(m, [diretto('d1', 'mario', 50000, 'Quota', { movimentoId: 'm1' })], [])), 0)
  // Come `euro_assegna` del database: i messaggi dicono gli stessi soldi, con il punto delle migliaia.
  ok('gli euro coi centesimi e il punto delle migliaia: «1.234,50 €»', prova(() => [euroAssegna(123450), euroAssegna(5000), euroAssegna(12345678)]), ['1.234,50 €', '50,00 €', '123.456,78 €'])
}

console.log('\n2. La ripartizione proposta: prima le quote, poi i corsi dal più vecchio')
{
  const dovuti = [
    { personaId: 'luca', voce: 'Annuale Judo Kids', tipo: 'corso', dal: '2026-09-01', manca: 42000 },
    { personaId: 'luca', voce: 'Quota associativa 2026/27', tipo: 'quota', dal: '2026-09-01', manca: 5000 },
    { personaId: 'sofia', voce: 'Trimestre Danza moderna ottobre-dicembre', tipo: 'corso', dal: '2026-10-01', manca: 15000 },
    { personaId: 'sofia', voce: 'Quota associativa 2026/27', tipo: 'quota', dal: '2026-09-01', manca: 5000 },
  ]
  const p = prova(() => proponiRipartizione(60000, dovuti))
  ok('600 € per due fratelli: le due quote, l’annuale più vecchio, il resto sul trimestre; niente da assegnare', p.righe?.map((r) => [r.personaId, r.voce, r.importo]), [
    ['luca', 'Quota associativa 2026/27', 5000],
    ['sofia', 'Quota associativa 2026/27', 5000],
    ['luca', 'Annuale Judo Kids', 42000],
    ['sofia', 'Trimestre Danza moderna ottobre-dicembre', 8000],
  ])
  ok('…resta 0 da assegnare', p.daAssegnare, 0)
  ok('…le righe vanno a persone diverse', [...new Set(p.righe?.map((r) => r.personaId))].sort(), ['luca', 'sofia'])
  const poco = prova(() => proponiRipartizione(7000, [{ personaId: 'marco', voce: 'Quota associativa 2026/27', tipo: 'quota', dal: '2026-09-01', manca: 5000 }, { personaId: 'marco', voce: 'Annuale Kickboxing', tipo: 'corso', dal: '2026-09-01', manca: 0 }]))
  ok('70 € con la quota da 50 €: 50 € sulla quota, nessuna riga a 0 per l’annuale pagato', poco.righe?.map((r) => [r.voce, r.importo]), [['Quota associativa 2026/27', 5000]])
  ok('…e 20 € restano da assegnare', poco.daAssegnare, 2000)
  ok('meno del dovuto: tutto sulla prima voce', prova(() => proponiRipartizione(3000, dovuti).righe?.map((r) => [r.personaId, r.importo])), [['luca', 3000]])
  ok('a pari data di inizio, l’ordine dei dovuti', prova(() => proponiRipartizione(100000, [
    { personaId: 'b', voce: 'Corso B', tipo: 'corso', dal: '2026-09-01', manca: 1000 },
    { personaId: 'a', voce: 'Corso A', tipo: 'corso', dal: '2026-09-01', manca: 1000 },
  ]).righe?.map((r) => r.voce)), ['Corso B', 'Corso A'])
  ok('niente dovuto: tutto da assegnare', prova(() => proponiRipartizione(5000, [])), { righe: [], daAssegnare: 5000 })
}

console.log('\n3. Quando un’assegnazione non va (src/lib)')
{
  const dovuti = [
    { personaId: 'marco', voce: 'Quota associativa 2026/27', tipo: 'quota', dal: '2026-09-01', manca: 5000 },
    { personaId: 'marco', voce: 'Annuale Kickboxing', tipo: 'corso', dal: '2026-09-01', manca: 42000 },
  ]
  const riga = (voce, importo, personaId = 'marco') => ({ personaId, voce, importo })
  ok('70 € sulla quota da 50 €: rifiutato col messaggio del canvas', prova(() => cosaNonVaAssegnazione([riga('Quota associativa 2026/27', 7000)], 7000, dovuti)),
    'Alla quota mancano 50,00 €: metti 50,00 € o meno, il resto rimane da assegnare.')
  ok('50 € sulla quota: passa', prova(() => cosaNonVaAssegnazione([riga('Quota associativa 2026/27', 5000)], 7000, dovuti)), null)
  ok('…e 20 € restano da assegnare', prova(() => 7000 - [riga('Quota associativa 2026/27', 5000)].reduce((s, r) => s + r.importo, 0)), 2000)
  ok('su un corso oltre quel che manca, col nome della voce', prova(() => cosaNonVaAssegnazione([riga('Annuale Kickboxing', 43000)], 50000, dovuti)),
    'A «Annuale Kickboxing» mancano 420,00 €: metti 420,00 € o meno, il resto rimane da assegnare.')
  ok('un parziale sull’annuale passa', prova(() => cosaNonVaAssegnazione([riga('Annuale Kickboxing', 20000)], 20000, dovuti)), null)
  ok('la somma oltre il bonifico: il messaggio del canvas', prova(() => cosaNonVaAssegnazione([riga('Quota associativa 2026/27', 5000), riga('Annuale Kickboxing', 42000)], 40000, dovuti)),
    'Hai assegnato 70,00 € più del bonifico: togli da una voce.')
  ok('la somma giusta (anche tutta) passa', prova(() => cosaNonVaAssegnazione([riga('Quota associativa 2026/27', 5000), riga('Annuale Kickboxing', 35000)], 40000, dovuti)), null)
  ok('un importo a zero o negativo no', prova(() => cosaNonVaAssegnazione([riga('Annuale Kickboxing', 0)], 40000, dovuti)), 'Metti su ogni voce un importo maggiore di zero.')
  ok('…né negativo', prova(() => cosaNonVaAssegnazione([riga('Annuale Kickboxing', -100)], 40000, dovuti)), 'Metti su ogni voce un importo maggiore di zero.')
  ok('nessuna riga: niente da scrivere', prova(() => cosaNonVaAssegnazione([], 40000, dovuti)), 'Metti almeno un importo su una voce.')
}

console.log('\n3b. Il tetto della quota: una persona, una stagione, 50 € (cosaNonVaQuota)')
{
  // Le stesse parole di `assegna_movimento` (136-assegna-una-volta.sql). Somma: assegnazioni attive alla quota della
  // stagione + pagato delle ricevute attive con la quota della stagione + righe nuove; limite = quota del listino.
  const nuova = (personaId, voce, importo) => ({ personaId, voce, importo })
  const TETTO = (x) => `Alla quota mancano ${x}: metti ${x} o meno, il resto rimane da assegnare.`
  const va = (righe, diretti = [], ricevute = [], data = '2026-10-15', tetto = 5000) => prova(() => cosaNonVaQuota(righe, data, diretti, ricevute, tetto))
  const qDir = (id, personaId, importo, o = {}) => diretto(id, personaId, importo, 'Quota associativa 2026/27', { movimentoId: 'm-vecchio', ...o })
  const qRic = (id, personaId, pagato, o = {}, v = {}) => ricevuta(id, personaId, [voceRic('QUOTA ASSOCIATIVA', 5000, pagato, { dal: '2026-09-01', al: '2027-07-31', ...v })], o)

  ok('30 € già assegnati alla quota + 25 €: mancano 20 €', await va([nuova('mario', 'Quota associativa 2026/27', 2500)], [qDir('d1', 'mario', 3000)]), TETTO('20,00 €'))
  ok('…20 € passano', await va([nuova('mario', 'Quota associativa 2026/27', 2000)], [qDir('d1', 'mario', 3000)]), null)
  ok('la quota intera in una volta passa', await va([nuova('mario', 'Quota associativa 2026/27', 5000)]), null)
  ok('50,01 € no', await va([nuova('mario', 'Quota associativa 2026/27', 5001)]), TETTO('50,00 €'))
  ok('quota già piena (50 €): altri 5 € no, «mancano 0,00 €»', await va([nuova('mario', 'Quota associativa 2026/27', 500)], [qDir('d1', 'mario', 5000)]), TETTO('0,00 €'))
  ok('due righe nuove, 30 + 30 €: contano insieme, mancano 50 €', await va([nuova('mario', 'Quota associativa 2026/27', 3000), nuova('mario', 'Quota associativa 2026/27', 3000)]), TETTO('50,00 €'))
  ok('la voce è «Quota associativa…»: anche in minuscolo', await va([nuova('mario', 'quota associativa 2026/27', 6000)]), TETTO('50,00 €'))
  ok('un corso non ha il tetto (qui è dell’app)', await va([nuova('mario', 'Annuale Judo Kids', 80000)]), null)
  // Il secondo caso chiama la funzione senza tetto: `va(…, undefined)` userebbe il tetto di default di `va`.
  ok('senza tetto nel listino (0 o niente): nessun limite', [await va([nuova('mario', 'Quota associativa 2026/27', 99900)], [], [], '2026-10-15', 0), await prova(() => cosaNonVaQuota([nuova('mario', 'Quota associativa 2026/27', 99900)], '2026-10-15', [], []))], [null, null])

  console.log('  3b-2. Cosa conta')
  ok('un’assegnazione annullata non conta', await va([nuova('mario', 'Quota associativa 2026/27', 5000)], [qDir('d1', 'mario', 3000, { annullatoIl: '2026-10-16T10:00:00Z' })]), null)
  ok('una ricevuta annullata non conta', await va([nuova('mario', 'Quota associativa 2026/27', 5000)], [], [qRic('r1', 'mario', 3000, { annullataIl: '2026-10-16T10:00:00Z' })]), null)
  ok('una ricevuta attiva conta per quel che è stato pagato: 30 € + 25 € → mancano 20 €', await va([nuova('mario', 'Quota associativa 2026/27', 2500)], [], [qRic('r1', 'mario', 3000)]), TETTO('20,00 €'))
  ok('…e solo per il pagato, non per il prezzo (30 € di 50): 20 € passano', await va([nuova('mario', 'Quota associativa 2026/27', 2000)], [], [qRic('r1', 'mario', 3000)]), null)
  ok('assegnazione annullata perché diventata ricevuta: conta una volta sola (30 €, non 60)', await va([nuova('mario', 'Quota associativa 2026/27', 2000)], [qDir('d1', 'mario', 3000, { annullatoIl: '2026-10-16T10:00:00Z', ricevutaId: 'r1' })], [qRic('r1', 'mario', 3000)]), null)
  ok('…e 25 € no', await va([nuova('mario', 'Quota associativa 2026/27', 2500)], [qDir('d1', 'mario', 3000, { annullatoIl: '2026-10-16T10:00:00Z', ricevutaId: 'r1' })], [qRic('r1', 'mario', 3000)]), TETTO('20,00 €'))
  ok('la ricevuta di un’altra persona non conta', await va([nuova('mario', 'Quota associativa 2026/27', 5000)], [], [qRic('r1', 'luca', 3000)]), null)
  ok('l’assegnazione di un’altra persona non conta (fratelli: 50 € a testa)', await va([nuova('mario', 'Quota associativa 2026/27', 5000), nuova('luca', 'Quota associativa 2026/27', 5000)], [qDir('d1', 'sofia', 5000)]), null)
  ok('una ricevuta per un corso non conta', await va([nuova('mario', 'Quota associativa 2026/27', 5000)], [], [ricevuta('r1', 'mario', [voceRic('ANNUALE JUDO KIDS', 42000, 42000, { dal: '2026-09-01', al: '2027-06-30' })])]), null)
  ok('una ricevuta della quota di un’altra stagione (2025/26) non conta', await va([nuova('mario', 'Quota associativa 2026/27', 5000)], [], [qRic('r1', 'mario', 5000, {}, { dal: '2025-09-01', al: '2026-07-31' })]), null)

  console.log('  3b-3. La stagione: dal nome della voce, se no dalla data del movimento')
  ok('«2025/26» nel nome: un’altra stagione, il tetto riparte (50 € passano)', await va([nuova('mario', 'Quota associativa 2025/26', 5000)], [qDir('d1', 'mario', 5000)]), null)
  ok('…e conta con le sue: 30 € già alla 2025/26 + 25 € → mancano 20 €', await va([nuova('mario', 'Quota associativa 2025/26', 2500)], [qDir('d1', 'mario', 3000, { voce: 'Quota associativa 2025/26', data: '2026-02-01' })]), TETTO('20,00 €'))
  ok('senza stagione nel nome, bonifico del 31 luglio: è la 2025/26, con 50 € già alla 2026/27 passa', await va([nuova('mario', 'Quota associativa', 5000)], [qDir('d1', 'mario', 5000)], [], '2026-07-31'), null)
  ok('…bonifico del 1° agosto: è la 2026/27, e con 30 € già assegnati il 1° agosto mancano 20 €', await va([nuova('mario', 'Quota associativa', 3000)], [qDir('d1', 'mario', 3000, { voce: 'Quota associativa', data: '2026-08-01' })], [], '2026-08-01'), TETTO('20,00 €'))
  ok('…e il 31 luglio con 30 € già assegnati il 1° agosto: un’altra stagione, passa', await va([nuova('mario', 'Quota associativa', 3000)], [qDir('d1', 'mario', 3000, { voce: 'Quota associativa', data: '2026-08-01' })], [], '2026-07-31'), null)
}

console.log('\n4. Quali movimenti si assegnano, e a chi')
{
  const no = (m, oggi = '2026-10-20') => prova(() => cosaNonVaMovimentoDaAssegnare(m, casse, voci, oggi))
  ok('un bonifico collegato su «Corsi e altri pagamenti»: sì', no(movimento('m1', 42000)), null)
  ok('…anche su «Quota associativa»', no(movimento('m1', 5000, { voceId: 'v-quota' })), null)
  ok('annullato: no', no(movimento('m1', 42000, { annullatoIl: '2026-10-16T08:00:00Z' })), 'Il movimento è annullato: non si assegna.')
  ok('un’uscita: no', no(movimento('m1', 1000, { tipo: 'uscita', voceId: 'v-spese' })), 'Un’uscita non si assegna: si assegnano solo le entrate.')
  ok('senza persona: prima si collega', no(movimento('m1', 42000, { personaId: undefined })), 'Collega prima il movimento a una persona.')
  ok('su un’altra voce (Gare): no', no(movimento('m1', 42000, { voceId: 'v-gare' })), 'Si assegnano solo le entrate su «Quota associativa» e «Corsi e altri pagamenti».')
  ok('Cassa Contanti: no, i contanti entrerebbero due volte', no(movimento('m1', 42000, { cassaId: 'contanti' })), 'I contanti non si assegnano da qui: registra il pagamento in PAGAMENTI.')
  // Lo storico del vecchio programma: dalla stagione di oggi (1° agosto, come `71-pagato-vecchio-programma.sql`) sì,
  // prima no. Sono 1.695 bonifici dal 2019: per le stagioni passate non c'è niente da pagare a cui assegnarli.
  const VECCHIO = 'Questo bonifico è del vecchio programma, di una stagione passata: resta nello storico, non si assegna.'
  ok('vecchio programma, settembre della stagione di oggi: sì', no(movimento('m1', 42000, { data: '2026-09-03', origineImport: 'prima-nota:12' })), null)
  ok('…anche dal 1° agosto', no(movimento('m1', 42000, { data: '2026-08-01', origineImport: 'prima-nota:12' })), null)
  ok('…il 31 luglio è la stagione passata: no', no(movimento('m1', 42000, { data: '2026-07-31', origineImport: 'prima-nota:12' })), VECCHIO)
  ok('…a luglio di oggi la stagione è ancora quella: sì', no(movimento('m1', 42000, { data: '2025-09-10', origineImport: 'prima-nota:12' }), '2026-07-15'), null)
  ok('scritto qui, anche di un anno fa: sì', no(movimento('m1', 42000, { data: '2025-03-10' })), null)
  ok('dalla banca, di un anno fa: sì', no(movimento('m1', 42000, { data: '2025-03-10', origineImport: 'banca:abc' })), null)
  const p = (id, nucleo, attiva = true) => ({ id, nome: id, cognome: 'X', nucleo, attiva })
  const persone = [p('mario'), p('luca', 'mario'), p('sofia', 'mario'), p('estraneo'), p('altra', 'estraneo'), p('spenta', 'mario', false)]
  ok('il nucleo di chi ha il movimento (titolare): lui e i suoi', prova(() => [...personeDelNucleo('mario', persone)].sort()), ['luca', 'mario', 'sofia'])
  ok('…se il movimento è di un figlio: lui, il titolare e i fratelli', prova(() => [...personeDelNucleo('luca', persone)].sort()), ['luca', 'mario', 'sofia'])
  ok('…chi è fuori dal nucleo e chi è disattivato no', prova(() => personeDelNucleo('mario', persone).filter((x) => ['estraneo', 'altra', 'spenta'].includes(x))), [])
  ok('una persona senza nucleo: solo lei', prova(() => personeDelNucleo('estraneo', persone.slice(0, 4))), ['estraneo'])
}

console.log('\n5. In CONTABILITÀ i soldi ci sono una volta sola')
{
  const manuali = [movimento('m1', 42000)]
  const elenco = (diretti, ricevute) => B.elencoMovimenti(ricevute, diretti, nomi, casse, manuali, voci)
  const attive = (righe) => righe.filter((r) => !r.annullato && r.tipo === 'entrata')
  const senza = elenco([], [])
  ok('solo il bonifico: una entrata da 420 €', attive(senza).map((r) => [r.id, r.importo]), [['m1', 42000]])

  const assegnato = diretto('d1', 'mario', 42000, 'Annuale Judo Kids', { movimentoId: 'm1' })
  const conAssegnazione = elenco([assegnato], [])
  ok('assegnato senza ricevuta: sempre una sola entrata, il movimento (nessun «Incasso iscritto»)', attive(conAssegnazione).map((r) => r.id), ['m1'])
  ok('…il totale delle entrate non cambia', B.totali(conAssegnazione).entrate, B.totali(senza).entrate)

  const fatta = ricevuta('r1', 'mario', [voceRic('ANNUALE JUDO KIDS', 42000, 42000)], { movimentoId: 'm1' })
  const passata = { ...assegnato, annullatoIl: '2026-10-16T08:00:00Z', ricevutaId: 'r1' }
  const conRicevuta = elenco([passata], [fatta])
  ok('assegnato con ricevuta dal movimento: ancora una sola entrata', attive(conRicevuta).map((r) => r.id), ['m1'])
  ok('…il totale non cambia', B.totali(conRicevuta).entrate, 42000)

  // Il caso di prima di questo cambio: bonifico collegato + ricevuta fatta a parte = due entrate. Abbinati, una.
  const vecchia = ricevuta('r2', 'mario', [voceRic('ANNUALE JUDO KIDS', 42000, 42000)])
  ok('prima dell’abbinamento (ricevuta fatta a parte) le entrate sono due: è il guaio che l’abbinamento toglie', attive(elenco([], [vecchia])).length, 2)
  ok('abbinata al movimento: l’Incasso iscritto sparisce, resta il bonifico', attive(elenco([], [{ ...vecchia, movimentoId: 'm1' }])).map((r) => r.id), ['m1'])

  const normale = elenco([diretto('d9', 'mario', 3000, 'ALTRO')], [])
  ok('un pagamento a mano senza movimento resta un «Incasso iscritto», come oggi', attive(normale).map((r) => r.id).sort(), ['incasso:diretto:d9', 'm1'])
  const oggi = '2026-10-31'
  ok('BILANCIO: le entrate dell’anno sono le stesse con o senza assegnazione e ricevuta',
    [conAssegnazione, conRicevuta].map((r) => prova(() => B.bilancioAnno(r, casse, 2026, oggi).entrate)), [42000, 42000])
  const prev = (r) => B.previstoCassa(casse, r, 'contanti', oggi)
  ok('previsto della Cassa Contanti: invariato dall’assegnazione e dalla ricevuta (il bonifico non è contanti)', [prev(conAssegnazione), prev(conRicevuta)], [prev(senza), prev(senza)])
  ok('…e il Conto Corrente conta 420 € una volta', B.residui(casse, conRicevuta).find((c) => c.cassaId === 'conto').residuo, 42000)
}

console.log('\n6. Da assegnare, in CONTABILITÀ e nella scheda')
{
  const manuali = [
    movimento('m1', 7000, { data: '2026-10-03', personaId: 'marco', descrizione: 'Bianchi M.' }),
    movimento('m2', 42000, { data: '2026-10-15', personaId: 'anna' }),
    movimento('m3', 12000, { data: '2025-09-12', personaId: 'chiara', cassaId: 'contanti' }),
    movimento('m4', 9000, { data: '2026-10-05', personaId: 'mario' }),
    movimento('m5', 9000, { data: '2026-10-06', personaId: undefined }),
    movimento('m6', 9000, { data: '2026-10-07', personaId: 'mario', annullatoIl: '2026-10-08T08:00:00Z' }),
    movimento('m7', 1000, { data: '2026-10-08', tipo: 'uscita', voceId: 'v-spese', personaId: undefined }),
    movimento('m8', 9000, { data: '2024-10-08', origineImport: 'prima-nota:7' }),
  ]
  const diretti = [diretto('d1', 'marco', 5000, 'Quota associativa 2026/27', { movimentoId: 'm1', data: '2026-10-03' }), diretto('d4', 'mario', 9000, 'Quota', { movimentoId: 'm4' })]
  const e = prova(() => elencoDaAssegnare(manuali, diretti, [], casse, voci, '2026-10-20'))
  ok('le righe da assegnare, dalla più vecchia: m1 (avanzano 20 €) e m2 (tutto); m4 è già tutto assegnato', e.righe?.map((r) => [r.movimentoId, r.personaId, r.daAssegnare, r.importo]), [['m1', 'marco', 2000, 7000], ['m2', 'anna', 42000, 42000]])
  ok('…senza contanti, annullati, senza persona, uscite e storico vecchio', e.righe?.some((r) => ['m3', 'm5', 'm6', 'm7', 'm8'].includes(r.movimentoId)), false)
  ok('…il totale è la somma di quel che c’è da assegnare', e.totale, 44000)
  ok('…ogni riga porta la data del movimento', e.righe?.map((r) => r.data), ['2026-10-03', '2026-10-15'])
}

console.log('\n7. «Collegati prima»: le ricevute già fatte da abbinare')
{
  const mov = (id, importo, data, personaId = 'anna') => ({ id, importo, data, personaId })
  const ric = (id, personaId, importo, data, o = {}) => ricevuta(id, personaId, [voceRic('QUOTA E TRIMESTRE', importo, importo, { pagamenti: [{ data, importo, metodo: 'Bonifico' }] })], { data, numero: Number(id.slice(1)), ...o })
  const prop = (movimenti, ricevute) => prova(() => abbinamentiProposti(movimenti, ricevute).map((x) => [x.movimentoId, x.ricevutaId]))
  ok('stessa persona, stesso importo, Bonifico, 3 giorni dopo: si propone', prop([mov('m1', 12000, '2026-09-02')], [ric('r201', 'anna', 12000, '2026-09-05')]), [['m1', 'r201']])
  ok('…30 giorni giusti: sì', prop([mov('m1', 12000, '2026-09-02')], [ric('r201', 'anna', 12000, '2026-10-02')]), [['m1', 'r201']])
  ok('…31 giorni: no', prop([mov('m1', 12000, '2026-09-02')], [ric('r201', 'anna', 12000, '2026-10-03')]), [])
  ok('un’altra persona: no', prop([mov('m1', 12000, '2026-09-02')], [ric('r201', 'pietro', 12000, '2026-09-05')]), [])
  ok('importo diverso: no', prop([mov('m1', 12000, '2026-09-02')], [ric('r201', 'anna', 11000, '2026-09-05')]), [])
  ok('pagata in contanti: no', prop([mov('m1', 12000, '2026-09-02')], [ricevuta('r201', 'anna', [voceRic('QUOTA', 12000, 0, { pagamenti: [{ data: '2026-09-05', importo: 12000, metodo: 'Contanti' }] })], { data: '2026-09-05', numero: 201 })]), [])
  ok('un bonifico e un contante insieme: no, tutti i pagamenti devono essere Bonifico', prop([mov('m1', 12000, '2026-09-02')], [ricevuta('r201', 'anna', [voceRic('QUOTA', 12000, 0, { pagamenti: [{ data: '2026-09-05', importo: 7000, metodo: 'Bonifico' }, { data: '2026-09-05', importo: 5000, metodo: 'Contanti' }] })], { data: '2026-09-05', numero: 201 })]), [])
  ok('ricevuta annullata: no', prop([mov('m1', 12000, '2026-09-02')], [ric('r201', 'anna', 12000, '2026-09-05', { annullataIl: '2026-09-06T08:00:00Z' })]), [])
  ok('ricevuta già abbinata a un movimento: no', prop([mov('m1', 12000, '2026-09-02')], [ric('r201', 'anna', 12000, '2026-09-05', { movimentoId: 'm9' })]), [])
  ok('una ricevuta va a un solo movimento: la offre al più vicino, l’altro resta fuori',
    prop([mov('m1', 12000, '2026-09-02'), mov('m2', 12000, '2026-09-04')], [ric('r201', 'anna', 12000, '2026-09-05')]), [['m2', 'r201']])
  const due = prop([mov('m1', 12000, '2026-09-02'), mov('m2', 12000, '2026-09-04')], [ric('r201', 'anna', 12000, '2026-09-05'), ric('r202', 'anna', 12000, '2026-09-03')])
  ok('due ricevute e due movimenti uguali: uno a testa, senza ripetere', Array.isArray(due) ? due.map((x) => x[1]).sort() : due, ['r201', 'r202'])
}

console.log('\n8. Dopo un’assegnazione, quota e corsi lo sanno (parziale e saldo)')
{
  const quota = { prezzo: 5000, dal: '2026-09-01', al: '2027-07-31' }
  const oggi = '2026-10-20'
  const d = (importo, o = {}) => diretto('d' + importo, 'marco', importo, 'Quota associativa 2026/27', { movimentoId: 'm1', ...o })
  const p = (quote) => ({ attiva: true, certificato: { scade: '2027-09-01', conFile: false }, documento: true, pagamento: { stato: 'da_pagare' }, natoIl: '2000-01-01', iscrizioni: [], quote })
  const parziale = prova(() => quoteConAssegnazioni([], quota, [d(3000)], 'marco'))
  ok('parziale sulla quota (30 su 50 €): mancano 20 €', Array.isArray(parziale) ? parziale.map((q) => q.mancano) : parziale, [2000])
  ok('…la quota è IN PARTE e la persona non è «in regola»', prova(() => [B.pagamentoDi(p(parziale), oggi).come, B.inRegola(p(parziale), oggi)]), ['in_parte', false])
  const intera = prova(() => quoteConAssegnazioni([], quota, [d(5000)], 'marco'))
  ok('saldo (50 €): pagata e «in regola»', prova(() => [B.pagamentoDi(p(intera), oggi).come, B.inRegola(p(intera), oggi)]), ['pagato', true])
  // La quota assegnata senza ricevuta non ha numero: la scheda non deve dire «ricevuta 0/2026».
  ok('…e nessun numero di ricevuta, né pagata né in parte', prova(() => [B.pagamentoDi(p(intera), oggi).ricevuta, B.pagamentoDi(p(parziale), oggi).ricevuta]), [undefined, undefined])
  ok('…e la frase della quota non dice «ricevuta undefined»', prova(() => [B.fraseQuota(B.pagamentoDi(p(intera), oggi)), B.fraseQuota(B.pagamentoDi(p(parziale), oggi))].some((f) => f.includes('ricevuta'))), false)
  ok('un’assegnazione annullata, o di un’altra persona, non conta', prova(() => quoteConAssegnazioni([], quota, [d(5000, { annullatoIl: '2026-10-16T08:00:00Z' }), d(5000, { personaId: 'altro', id: 'dx' })], 'marco')), [])
  ok('senza assegnazioni le quote restano quelle delle ricevute', prova(() => quoteConAssegnazioni([{ anno: 2026, numero: 4, mancano: 0 }], quota, [], 'marco')), [{ anno: 2026, numero: 4, mancano: 0 }])
  // Una ricevuta da 30 € (mancano 20) e poi il bonifico da 20 € assegnato: la quota è saldata, non ancora «in parte».
  const conRicevuta = prova(() => quoteConAssegnazioni([{ anno: 2026, numero: 7, dal: '2026-09-01', al: '2027-07-31', mancano: 2000 }], quota, [d(2000)], 'marco'))
  ok('ricevuta parziale (mancano 20 €) più bonifico da 20 € assegnato: la quota è pagata', prova(() => [B.pagamentoDi(p(conRicevuta), oggi).come, B.inRegola(p(conRicevuta), oggi)]), ['pagato', true])
  const conRicevuta2 = prova(() => quoteConAssegnazioni([{ anno: 2026, numero: 7, dal: '2026-09-01', al: '2027-07-31', mancano: 2000 }], quota, [d(1000)], 'marco'))
  ok('…con 10 € assegnati mancano 10 €, non 20', prova(() => [B.pagamentoDi(p(conRicevuta2), oggi).come, B.pagamentoDi(p(conRicevuta2), oggi).mancano]), ['in_parte', 1000])
  ok('…la ricevuta di un’altra stagione non conta', prova(() => quoteConAssegnazioni([{ anno: 2025, numero: 7, dal: '2025-09-01', al: '2026-07-31', mancano: 2000 }], quota, [d(2000)], 'marco').map((q) => q.mancano)), [2000, 3000])

  const listino = { quota: 5000, saldoEntro: '2026-08-31', offerte: [], corsi: [{ corso: 'Judo kids', eta: '', orari: [], prezzi: [{ annuale: 420, trimestre: 120 }] }], senzaPrezzoVaBene: [] }
  const corsi = [{ id: 'kids', nome: 'Judo kids' }]
  const prezzi = [{ descrizione: 'Annuale Judo kids', prezzo: 42000, dal: '2026-09-01', al: '2027-06-30' }]
  const corso = (...importi) => {
    const dd = importi.map((x, i) => diretto('c' + i, 'marco', x, 'Annuale Judo kids', { movimentoId: 'm' + i }))
    const persona = { attiva: true, pagamento: { stato: 'da_pagare' }, iscrizioni: [{ corsoId: 'kids', dal: '2026-09-01' }], vociCorsi: vociCorsiConAssegnazioni([], prezzi, dd, 'marco') }
    const s = B.statoCorsi(persona, corsi, listino, oggi)
    return [s[0].come, s[0].mancano ?? 0]
  }
  ok('due bonifici da 200 e 220 € sull’annuale da 420: dopo il primo manca 220, IN PARTE', prova(() => corso(20000)), ['in_parte', 22000])
  ok('…dopo il secondo manca 0, pagato', prova(() => corso(20000, 22000)), ['pagato', 0])
  ok('nessun bonifico assegnato: da pagare', prova(() => corso()), ['da_pagare', 0])
  // Una ricevuta che ha pagato 200 € dell'annuale (mancano 220) e poi il bonifico da 220 € assegnato: l'annuale è saldato.
  const corsoConRicevuta = (importo, prima = [{ descrizione: 'ANNUALE JUDO KIDS', dal: '2026-09-01', al: '2027-06-30', mancano: 22000, data: '2026-09-10' }]) => {
    const persona = { attiva: true, pagamento: { stato: 'da_pagare' }, iscrizioni: [{ corsoId: 'kids', dal: '2026-09-01' }], vociCorsi: vociCorsiConAssegnazioni(prima, prezzi, [diretto('c9', 'marco', importo, 'Annuale Judo kids', { movimentoId: 'm9' })], 'marco') }
    const s = B.statoCorsi(persona, corsi, listino, oggi)
    return [s[0].come, s[0].mancano ?? 0]
  }
  ok('ricevuta parziale dell’annuale (mancano 220 €) più bonifico da 220 € assegnato: pagato', prova(() => corsoConRicevuta(22000)), ['pagato', 0])
  ok('…con 100 € assegnati mancano 120 €', prova(() => corsoConRicevuta(10000)), ['in_parte', 12000])
  ok('l’annuale della stagione passata, tutto pagato, non conta: con 100 € assegnati mancano 320 €',
    prova(() => corsoConRicevuta(10000, [{ descrizione: 'ANNUALE JUDO KIDS', dal: '2025-09-01', al: '2026-06-30', mancano: 0, data: '2025-09-10' }])), ['in_parte', 32000])
}

console.log('\n8b. La ricevuta dal bonifico: le voci già pronte, e il bonifico così com’è')
{
  const listino = { quota: 50, saldoEntro: '2026-08-31', offerte: [], corsi: [{ corso: 'Judo kids', eta: '', orari: [], prezzi: [{ annuale: 420, trimestre: 120 }] }], senzaPrezzoVaBene: [] }
  const sue = [diretto('a1', 'luca', 5000, 'Quota associativa 2026/27', { movimentoId: 'm1' }), diretto('a2', 'luca', 20000, 'Annuale Judo kids', { movimentoId: 'm1' })]
  const vv = prova(() => vociDaMovimento(sue, '2026-10-15', listino))
  ok('una voce per assegnazione, la quota come QUOTA ASSOCIATIVA della stagione detta', prova(() => vv.map((v) => [v.descrizione, v.prezzo, v.dal, v.al])), [['QUOTA ASSOCIATIVA', 5000, '2026-09-01', '2027-07-31'], ['Annuale Judo kids', 42000, '2026-09-01', '2027-06-30']])
  ok('…pagate col bonifico, alla sua data, per quel che è assegnato (il parziale resta parziale)', prova(() => vv.map((v) => v.pagamenti)), [[{ data: '2026-10-15', importo: 5000, metodo: 'Bonifico' }], [{ data: '2026-10-15', importo: 20000, metodo: 'Bonifico' }]])
  ok('due assegnazioni sulla stessa voce fanno una voce', prova(() => vociDaMovimento([...sue, diretto('a3', 'luca', 2000, 'annuale judo kids', { movimentoId: 'm1' })], '2026-10-15', listino).length), 2)
  ok('un’assegnazione annullata non entra', prova(() => vociDaMovimento([sue[0], { ...sue[1], annullatoIl: '2026-10-16T08:00:00Z' }], '2026-10-15', listino).length), 1)
  ok('così com’è: va', prova(() => cosaNonVaRicevutaDaMovimento(vv, '2026-10-20', '2026-10-15', sue)), null)
  const no = 'Il bonifico va nella ricevuta così com’è: rimettilo, o torna ad «Assegna» per cambiare gli importi.'
  ok('un importo cambiato: no', prova(() => cosaNonVaRicevutaDaMovimento([vv[0], { ...vv[1], pagamenti: [{ ...vv[1].pagamenti[0], importo: 19000 }] }], '2026-10-20', '2026-10-15', sue)), no)
  ok('un altro metodo: no', prova(() => cosaNonVaRicevutaDaMovimento([vv[0], { ...vv[1], pagamenti: [{ ...vv[1].pagamenti[0], metodo: 'Contanti' }] }], '2026-10-20', '2026-10-15', sue)), no)
  ok('senza data vale il giorno della ricevuta: se non è quello del bonifico, no', prova(() => cosaNonVaRicevutaDaMovimento([vv[0], { ...vv[1], pagamenti: [{ ...vv[1].pagamenti[0], data: '' }] }], '2026-10-20', '2026-10-15', sue)), no)
}

console.log('\n9. In modalità prova: le stesse regole del database')
try {
  const s = B.creaSegreteriaProva()
  const OGGI = '2026-10-20'
  const tutte = await s.persone()
  const lista = tutte.filter((p) => p.attiva && !p.nucleo)
  const [mario, luca, sofia, estraneo, marco, anna, pietro] = lista
  const nome = (p) => `${p.cognome} ${p.nome}`
  await s.mettiNelNucleo(luca.id, mario.id)
  await s.mettiNelNucleo(sofia.id, mario.id)
  const bonifico = (importo, personaId, o = {}) =>
    s.registraMovimento({ tipo: 'entrata', data: '2026-10-15', importo, voceId: 'voce-corsi', cassaId: 'cassa-conto', descrizione: `Bonifico ${importo}`, personaId, ...o })
  const riga = (p, voce, importo) => ({ personaId: p.id, voce, importo })
  const attive = async (mid) => (await s.pagamentiDiretti()).filter((x) => x.movimentoId === mid && !x.annullatoIl)
  const resta = async (mid) => {
    const m = (await s.movimenti()).find((x) => x.id === mid)
    try { return daAssegnare(m, await s.pagamentiDiretti(), await s.ricevute()) } catch (e) { return 'ERRORE: ' + e.message }
  }
  const datiRicevuta = (p, voci2, o = {}) => ({ data: '2026-10-15', personaId: p.id, ente: 'ODS', intestatario: { nome: p.nome, cognome: p.cognome }, voci: voci2, anticipo: 0, ...o })
  const vr = (descrizione, importo, o = {}) => ({ descrizione, quantita: 1, prezzo: importo, pagamenti: [{ data: '2026-10-15', importo, metodo: 'Bonifico' }], ...o })

  console.log('  9a. 420 € a Mario, saldo sull’annuale')
  const m1 = await bonifico(42000, mario.id)
  const scritte = await errore(async () => { await s.assegnaMovimento(m1, [riga(mario, 'Annuale Judo Kids', 42000)]) })
  ok('si assegna', scritte, 'nessun errore')
  const a1 = (await attive(m1))[0]
  ok('la voce risulta pagata 420 €, con la data del movimento e il metodo Bonifico', a1 && [a1.personaId, a1.voce, a1.importo, a1.data, a1.metodo, a1.movimentoId], [mario.id, 'Annuale Judo Kids', 42000, '2026-10-15', 'Bonifico', m1])
  ok('…e non resta niente da assegnare', await resta(m1), 0)

  console.log('  9b. 70 € a Marco: oltre il bonifico no, 50 € sì e 20 € restano')
  const m2 = await bonifico(7000, marco.id)
  ok('50 € sulla quota e 30 € su un corso fanno 80 €: 10 € più del bonifico', await errore(() => s.assegnaMovimento(m2, [riga(marco, 'Quota associativa 2026/27', 5000), riga(marco, 'Annuale Kickboxing', 3000)])),
    'Hai assegnato 10,00 € più del bonifico: togli da una voce.')
  ok('…e non ha scritto niente', (await attive(m2)).length, 0)
  ok('un importo a zero no', await errore(() => s.assegnaMovimento(m2, [riga(marco, 'Quota associativa 2026/27', 0)])), 'Metti su ogni voce un importo maggiore di zero.')
  ok('50 € sulla quota: passa', await errore(() => s.assegnaMovimento(m2, [riga(marco, 'Quota associativa 2026/27', 5000)])), 'nessun errore')
  ok('…20 € restano da assegnare', await resta(m2), 2000)
  ok('altri 25 € no: 5 € più di quel che resta', await errore(() => s.assegnaMovimento(m2, [riga(marco, 'Annuale Kickboxing', 2500)])), 'Hai assegnato 5,00 € più del bonifico: togli da una voce.')
  ok('altri 20 € sì: 0 da assegnare', [await errore(() => s.assegnaMovimento(m2, [riga(marco, 'Annuale Kickboxing', 2000)])), await resta(m2)], ['nessun errore', 0])

  console.log('  9c. 600 € per il nucleo: due fratelli, una ricevuta per persona')
  const m3 = await bonifico(60000, mario.id)
  ok('una persona fuori dal nucleo è rifiutata', await errore(() => s.assegnaMovimento(m3, [riga(estraneo, 'Quota associativa 2026/27', 5000)])),
    `${nome(estraneo)} non è nella famiglia di ${nome(mario)}: il bonifico si assegna solo a chi è nel suo nucleo.`)
  ok('…anche insieme a righe giuste: tutto o niente', [await errore(() => s.assegnaMovimento(m3, [riga(luca, 'Quota associativa 2026/27', 5000), riga(estraneo, 'Quota associativa 2026/27', 5000)])), (await attive(m3)).length],
    [`${nome(estraneo)} non è nella famiglia di ${nome(mario)}: il bonifico si assegna solo a chi è nel suo nucleo.`, 0])
  ok('la somma oltre l’importo: rifiutata', await errore(() => s.assegnaMovimento(m3, [riga(luca, 'Annuale Judo Kids', 42000), riga(sofia, 'Trimestre Danza', 20000)])), 'Hai assegnato 20,00 € più del bonifico: togli da una voce.')
  const scritte3 = await errore(() => s.assegnaMovimento(m3, [riga(luca, 'Quota associativa 2026/27', 5000), riga(luca, 'Annuale Judo Kids', 42000), riga(sofia, 'Quota associativa 2026/27', 5000), riga(sofia, 'Trimestre Danza', 8000)]))
  ok('le quattro righe passano, a due persone', [scritte3, [...new Set((await attive(m3)).map((x) => x.personaId))].sort()], ['nessun errore', [luca.id, sofia.id].sort()])
  const lucaPaga = [vr('QUOTA ASSOCIATIVA', 5000), vr('ANNUALE JUDO KIDS', 42000)]
  ok('la ricevuta di Luca con altri importi: rifiutata, il bonifico va dentro così com’è',
    await errore(() => s.emettiRicevutaDaMovimento(datiRicevuta(luca, [vr('QUOTA ASSOCIATIVA', 5000), vr('ANNUALE JUDO KIDS', 40000)]), m3)),
    'Il bonifico va nella ricevuta così com’è: rimettilo, o torna ad «Assegna» per cambiare gli importi.')
  ok('…con un altro metodo: rifiutata', await errore(() => s.emettiRicevutaDaMovimento(datiRicevuta(luca, [vr('QUOTA ASSOCIATIVA', 5000), vr('ANNUALE JUDO KIDS', 42000, { pagamenti: [{ data: '2026-10-15', importo: 42000, metodo: 'Contanti' }] })]), m3)),
    'Il bonifico va nella ricevuta così com’è: rimettilo, o torna ad «Assegna» per cambiare gli importi.')
  ok('…con un’altra data: rifiutata', await errore(() => s.emettiRicevutaDaMovimento(datiRicevuta(luca, [vr('QUOTA ASSOCIATIVA', 5000), vr('ANNUALE JUDO KIDS', 42000, { pagamenti: [{ data: '2026-10-16', importo: 42000, metodo: 'Bonifico' }] })]), m3)),
    'Il bonifico va nella ricevuta così com’è: rimettilo, o torna ad «Assegna» per cambiare gli importi.')
  ok('per chi non ha niente di assegnato: rifiutata', await errore(() => s.emettiRicevutaDaMovimento(datiRicevuta(estraneo, [vr('QUOTA ASSOCIATIVA', 5000)]), m3)), 'Non c’è niente di assegnato a questa persona su questo bonifico.')
  const chiave = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa'
  let rl
  ok('la ricevuta di Luca, con le sue due voci', await errore(async () => { rl = await s.emettiRicevutaDaMovimento(datiRicevuta(luca, lucaPaga, { chiave }), m3) }), 'nessun errore')
  ok('…è sua, del movimento, 470 € in Bonifico del 15/10', rl && [rl.personaId, rl.movimentoId, rl.pagato, rl.voci.flatMap((v) => v.pagamenti).map((p) => [p.importo, p.metodo, p.data])], [luca.id, m3, 47000, [[5000, 'Bonifico', '2026-10-15'], [42000, 'Bonifico', '2026-10-15']]])
  ok('…le assegnazioni di Luca sono annullate e legate a lei, non sparite', (await s.pagamentiDiretti(luca.id)).filter((x) => x.movimentoId === m3).map((x) => [!!x.annullatoIl, x.ricevutaId]), [[true, rl?.id], [true, rl?.id]])
  ok('…quelle di Sofia restano attive', (await attive(m3)).map((x) => x.personaId), [sofia.id, sofia.id])
  ok('ripetuta con la stessa chiave dà la stessa ricevuta', (await s.emettiRicevutaDaMovimento(datiRicevuta(luca, lucaPaga, { chiave }), m3)).id, rl?.id)
  ok('senza chiave non ne fa una seconda: non c’è più niente di assegnato a Luca', await errore(() => s.emettiRicevutaDaMovimento(datiRicevuta(luca, lucaPaga), m3)), 'Non c’è niente di assegnato a questa persona su questo bonifico.')
  const rs = await s.emettiRicevutaDaMovimento(datiRicevuta(sofia, [vr('QUOTA ASSOCIATIVA', 5000), vr('TRIMESTRE DANZA', 15000, { pagamenti: [{ data: '2026-10-15', importo: 8000, metodo: 'Bonifico' }] })]), m3)
  ok('una ricevuta per persona: quella di Sofia è un’altra, da 130 €', [rs.id !== rl?.id, rs.personaId, rs.pagato, rs.movimentoId], [true, sofia.id, 13000, m3])
  ok('…il movimento è tutto assegnato, nelle ricevute', await resta(m3), 0)
  ok('la ricevuta del movimento nell’elenco dei pagamenti: i soldi sono quelli del movimento', B.righeDaRicevute([rl]).map((r) => [r.importo, r.metodo, r.data]), [[5000, 'Bonifico', '2026-10-15'], [42000, 'Bonifico', '2026-10-15']])

  console.log('  9d. Annullare')
  ok('il movimento con le ricevute attive non si annulla: «Annulla prima la ricevuta n. N/AAAA»', await errore(() => s.annullaMovimento(m3)), `Annulla prima la ricevuta n. ${rl.numero}/${rl.anno}`)
  await s.annullaRicevuta(rs.id)
  ok('annullata la ricevuta di Sofia: i suoi 130 € tornano da assegnare', await resta(m3), 13000)
  ok('…e le righe di Sofia non tornano attive', (await attive(m3)).map((x) => x.personaId), [])
  ok('…restano annullate, col collegamento alla ricevuta', (await s.pagamentiDiretti(sofia.id)).filter((x) => x.movimentoId === m3).every((x) => x.annullatoIl), true)
  ok('con l’altra ricevuta ancora attiva il movimento non si annulla', await errore(() => s.annullaMovimento(m3)), `Annulla prima la ricevuta n. ${rl.numero}/${rl.anno}`)
  await s.annullaRicevuta(rl?.id)
  ok('annullate tutte: tutti i 600 € tornano da assegnare', await resta(m3), 60000)
  ok('…e il movimento si annulla', await errore(() => s.annullaMovimento(m3)), 'nessun errore')
  ok('un movimento annullato non si assegna', await errore(() => s.assegnaMovimento(m3, [riga(luca, 'Quota associativa 2026/27', 5000)])), 'Il movimento è annullato: non si assegna.')

  console.log('  9e. Annullare il movimento con assegnazioni senza ricevuta: le annulla insieme')
  const m4 = await bonifico(5000, anna.id)
  await s.assegnaMovimento(m4, [riga(anna, 'Quota associativa 2026/27', 5000)])
  await s.annullaMovimento(m4)
  ok('le assegnazioni non restano attive: i soldi non contano senza il movimento', (await attive(m4)).length, 0)
  const mFanne = await bonifico(5000, anna.id)
  await s.assegnaMovimento(mFanne, [riga(anna, 'Quota associativa 2026/27', 5000)])
  const pdFanne = (await attive(mFanne))[0]
  ok('un’assegnazione non diventa ricevuta da FANNE LA RICEVUTA: si fa dal movimento', await errore(() => s.emettiRicevuta(datiRicevuta(anna, [vr('QUOTA ASSOCIATIVA', 5000)]), undefined, pdFanne.id)), 'Questi soldi vengono da un bonifico: la ricevuta si fa dal movimento, in CONTABILITÀ.')
  ok('…e resta attiva', (await attive(mFanne)).length, 1)
  await s.annullaMovimento(mFanne)

  console.log('  9f. Quando il movimento non si assegna')
  const contanti = await bonifico(5000, pietro.id, { cassaId: 'cassa-contanti', data: '2026-10-10' })
  ok('Cassa Contanti', await errore(() => s.assegnaMovimento(contanti, [riga(pietro, 'Quota associativa 2026/27', 5000)])), 'I contanti non si assegnano da qui: registra il pagamento in PAGAMENTI.')
  const uscita = await s.registraMovimento({ tipo: 'uscita', data: '2026-10-15', importo: 1000, voceId: 'voce-commissioni', cassaId: 'cassa-conto', descrizione: 'Commissioni' })
  ok('un’uscita', await errore(() => s.assegnaMovimento(uscita, [riga(pietro, 'Quota associativa 2026/27', 1000)])), 'Un’uscita non si assegna: si assegnano solo le entrate.')
  const senzaPersona = await s.registraMovimento({ tipo: 'entrata', data: '2026-10-15', importo: 5000, voceId: 'voce-da-classificare-entrata', cassaId: 'cassa-conto', descrizione: 'Bonifico sconosciuto' })
  ok('senza persona', await errore(() => s.assegnaMovimento(senzaPersona, [riga(pietro, 'Quota associativa 2026/27', 5000)])), 'Collega prima il movimento a una persona.')
  ok('annullato', await errore(() => s.assegnaMovimento(m4, [riga(anna, 'Quota associativa 2026/27', 5000)])), 'Il movimento è annullato: non si assegna.')

  console.log('  9g. Il giorno è chiuso: si assegna e si fa la ricevuta lo stesso, la chiusura non cambia')
  const m5 = await bonifico(10000, pietro.id, { data: '2026-10-12' })
  await s.salvaSaldoCassa('cassa-contanti', 0, '2026-01-01')
  await s.chiudiCassa({ cassaId: 'cassa-contanti', data: '2026-10-19', contato: 5000 })
  const chiusureDopo = async () => JSON.stringify(await s.chiusure())
  const prima = await chiusureDopo()
  const previsto = async () => {
    const righe = B.elencoMovimenti(await s.ricevute(), await s.pagamentiDiretti(), nomi, await s.casse(), await s.movimenti(), await s.voci())
    return B.previstoCassa(await s.casse(), righe, 'cassa-contanti', '2026-10-19')
  }
  const previstoPrima = await previsto()
  ok('assegnare nel giorno chiuso', await errore(() => s.assegnaMovimento(m5, [riga(pietro, 'Annuale Judo Kids', 10000)])), 'nessun errore')
  let rp
  ok('…e la ricevuta dal movimento', await errore(async () => { rp = await s.emettiRicevutaDaMovimento(datiRicevuta(pietro, [vr('ANNUALE JUDO KIDS', 10000, { pagamenti: [{ data: '2026-10-12', importo: 10000, metodo: 'Bonifico' }] })], { data: '2026-10-12' }), m5) }), 'nessun errore')
  ok('la chiusura non è cambiata', await chiusureDopo(), prima)
  ok('…né il previsto della Cassa Contanti', await previsto(), previstoPrima)
  // La chiusura serviva solo qui: tolta, le prove che seguono possono fare ricevute in contanti di settembre.
  await s.annullaChiusuraCassa((await s.chiusure()).find((c) => !c.annullataIl).id)

  console.log('  9h. In CONTABILITÀ una sola entrata per i soldi di un movimento')
  {
    const righe = B.elencoMovimenti(await s.ricevute(), await s.pagamentiDiretti(), nomi, await s.casse(), await s.movimenti(), await s.voci())
    const daiMovimenti = (await s.movimenti()).filter((x) => x.tipo === 'entrata' && !x.annullatoIl).reduce((t, x) => t + x.importo, 0)
    ok('le entrate sono quelle dei movimenti, e basta: nessun «Incasso iscritto» per i soldi dei bonifici assegnati', righe.filter((r) => !r.annullato && r.origine !== 'movimento').length, 0)
    ok('…il totale è la somma dei movimenti', B.totali(righe).entrate, daiMovimenti)
  }

  console.log('  9i. «Collegati prima»: abbinare una ricevuta già fatta')
  const ricevutaVecchia = (p, importo, data, metodo = 'Bonifico') => s.emettiRicevuta(datiRicevuta(p, [vr('QUOTA ASSOCIATIVA', importo, { pagamenti: [{ data, importo, metodo }] })], { data }))
  const mv = (importo, p, data) => bonifico(importo, p.id, { data })
  const mA = await mv(12000, anna, '2026-09-01')
  const rA = await ricevutaVecchia(anna, 12000, '2026-10-01')
  ok('la ricevuta di Anna, stesso importo, Bonifico, 30 giorni dopo: si abbina', await errore(() => s.abbinaRicevutaMovimento(mA, rA.id)), 'nessun errore')
  ok('…la ricevuta punta al movimento', (await s.ricevute(anna.id)).find((r) => r.id === rA.id)?.movimentoId, mA)
  ok('…e l’Incasso iscritto doppio sparisce', B.elencoMovimenti(await s.ricevute(), await s.pagamentiDiretti(), nomi, await s.casse(), await s.movimenti(), await s.voci()).filter((r) => !r.annullato && r.origine === 'ricevuta' && r.personaId === rA.personaId).length, 0)
  const mB = await mv(12000, anna, '2026-09-01')
  ok('la stessa ricevuta a un altro movimento: no, ha già il suo', await errore(() => s.abbinaRicevutaMovimento(mB, rA.id)), `La ricevuta n. ${rA.numero}/${rA.anno} è già abbinata a un altro bonifico.`)
  const rLontana = await ricevutaVecchia(anna, 12000, '2026-10-02')
  ok('31 giorni dopo: no', await errore(() => s.abbinaRicevutaMovimento(mB, rLontana.id)), 'La ricevuta e il bonifico distano più di 30 giorni.')
  const rAltra = await ricevutaVecchia(marco, 12000, '2026-09-03')
  ok('la ricevuta di un’altra persona: no', await errore(() => s.abbinaRicevutaMovimento(mB, rAltra.id)), 'La ricevuta è di un’altra persona.')
  const rImporto = await ricevutaVecchia(anna, 11000, '2026-09-03')
  ok('un altro importo: no', await errore(() => s.abbinaRicevutaMovimento(mB, rImporto.id)), 'La ricevuta e il bonifico non hanno lo stesso importo.')
  const rContanti = await ricevutaVecchia(anna, 12000, '2026-09-03', 'Contanti')
  ok('pagata in contanti: no', await errore(() => s.abbinaRicevutaMovimento(mB, rContanti.id)), 'La ricevuta non è tutta pagata con bonifico.')
  const rBuona = await ricevutaVecchia(anna, 12000, '2026-09-03')
  await s.annullaRicevuta(rBuona.id)
  ok('una ricevuta annullata: no', await errore(() => s.abbinaRicevutaMovimento(mB, rBuona.id)), 'La ricevuta è annullata.')
  const rOk = await ricevutaVecchia(anna, 12000, '2026-09-03')
  // Su un corso e non sulla quota: Anna ha già in ricevuta (abbinata) 120 € di quota, e con il tetto di 50 € la quota non ne prende altri.
  await s.assegnaMovimento(mB, [riga(anna, 'Annuale Judo Kids', 2000)])
  ok('un movimento che ha già dei soldi assegnati: no', await errore(() => s.abbinaRicevutaMovimento(mB, rOk.id)), 'Il bonifico ha già dei soldi assegnati: annulla prima le ricevute e le assegnazioni.')
  ok('un movimento che non si assegna (contanti): no', await errore(() => s.abbinaRicevutaMovimento(contanti, rOk.id)), 'I contanti non si assegnano da qui: registra il pagamento in PAGAMENTI.')
  // Dopo l'abbinamento la ricevuta è del movimento: annullarla lo libera, come per quelle fatte dal movimento.
  await s.annullaRicevuta(rA.id)
  ok('annullata la ricevuta abbinata, il bonifico torna da assegnare', await resta(mA), 12000)

  console.log('  9j. La chiave del modulo, come `ricevuta_gia_fatta`')
  const mK = await bonifico(5000, pietro.id)
  await s.assegnaMovimento(mK, [riga(pietro, 'Quota associativa 2026/27', 5000)])
  const chiaveK = 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb'
  const rK = await s.emettiRicevutaDaMovimento(datiRicevuta(pietro, [vr('QUOTA ASSOCIATIVA', 5000)], { chiave: chiaveK }), mK)
  ok('la chiave già usata per un’altra persona: rifiutata', await errore(() => s.emettiRicevutaDaMovimento(datiRicevuta(anna, [vr('QUOTA ASSOCIATIVA', 5000)], { chiave: chiaveK }), mK)),
    'Questa ricevuta è già stata fatta per un’altra persona: chiudi il modulo e riaprilo')
  await s.annullaRicevuta(rK.id)
  ok('la ricevuta della chiave è annullata: non la ridà, dice di riaprire il modulo', await errore(() => s.emettiRicevutaDaMovimento(datiRicevuta(pietro, [vr('QUOTA ASSOCIATIVA', 5000)], { chiave: chiaveK }), mK)),
    `La ricevuta n. ${rK.numero}/${rK.anno} fatta da questo modulo è stata annullata: chiudi il modulo e riaprilo per farne un’altra`)
  await s.annullaMovimento(mK)

  console.log('  9k. La ricevuta di un pagamento a mano, abbinata al bonifico e poi annullata: i soldi contano una volta')
  const pdMano = await s.registraPagamentoDiretto({ personaId: marco.id, data: '2026-10-01', importo: 12000, metodo: 'Bonifico', voce: 'QUOTA ASSOCIATIVA' })
  const idMano = typeof pdMano === 'string' ? pdMano : pdMano?.id
  const rMano = await s.emettiRicevuta(datiRicevuta(marco, [vr('QUOTA ASSOCIATIVA', 12000, { pagamenti: [{ data: '2026-10-01', importo: 12000, metodo: 'Bonifico' }] })], { data: '2026-10-01' }), undefined, idMano)
  const mMano = await bonifico(12000, marco.id, { data: '2026-10-01' })
  await s.abbinaRicevutaMovimento(mMano, rMano.id)
  await s.annullaRicevuta(rMano.id)
  ok('annullata, il bonifico torna da assegnare', await resta(mMano), 12000)
  ok('…e il pagamento a mano resta annullato: se no i 120 € conterebbero due volte', (await s.pagamentiDiretti(marco.id)).find((x) => x.id === idMano)?.annullatoIl ? 'annullato' : 'attivo', 'annullato')

  console.log('  9l. Un bonifico con soldi assegnati non cambia persona né voce, e non si annulla con l’importazione')
  const ASSEGNATO = 'Il movimento ha dei soldi assegnati: annulla prima ricevute e assegnazioni.'
  const mL = await bonifico(5000, pietro.id)
  // Su un corso: la quota di Pietro (50 €) è per il bonifico della banca più sotto, e il tetto non ne ammette due.
  await s.assegnaMovimento(mL, [riga(pietro, 'Annuale Judo Kids', 2000)])
  ok('collegarlo a un’altra persona: no', await errore(() => s.collegaMovimentiPersona([mL], anna.id)), ASSEGNATO)
  ok('scollegarlo: no', await errore(() => s.scollegaMovimentiPersona([mL])), ASSEGNATO)
  ok('…la persona è quella di prima', (await s.movimenti()).find((x) => x.id === mL)?.personaId, pietro.id)
  ok('spostarlo su una voce che non si assegna: no', await errore(() => s.cambiaVoceMovimenti([mL], 'voce-gare', pietro.id)), ASSEGNATO)
  ok('…su «Quota associativa» sì: resta un bonifico che si assegna', await errore(() => s.cambiaVoceMovimenti([mL], 'voce-quota', pietro.id)), 'nessun errore')
  await s.importaMovimentiBanca([{ chiave: 'banca:prova-9l', tipo: 'entrata', data: '2026-10-15', importo: 5000, voce: 'Da classificare', descrizione: 'Bonifico banca 9l' }])
  const mB9 = (await s.movimenti()).find((x) => x.origineImport === 'banca:prova-9l')
  // Come dall'app: la banca arriva in «Da classificare», poi passa su «Corsi» con la persona.
  await s.cambiaVoceMovimenti([mB9.id], 'voce-corsi', pietro.id)
  await s.assegnaMovimento(mB9.id, [riga(pietro, 'Quota associativa 2026/27', 5000)])
  const rB9 = await s.emettiRicevutaDaMovimento(datiRicevuta(pietro, [vr('QUOTA ASSOCIATIVA', 5000)]), mB9.id)
  ok('annullare l’importazione con la ricevuta del bonifico attiva: no', await errore(() => s.annullaImportazioneBanca(mB9.creatoIl)), `Annulla prima la ricevuta n. ${rB9.numero}/${rB9.anno}`)
  ok('…e il movimento resta', (await s.movimenti()).find((x) => x.id === mB9.id)?.annullatoIl, undefined)
  await s.annullaRicevuta(rB9.id)
  await s.assegnaMovimento(mB9.id, [riga(pietro, 'Quota associativa 2026/27', 3000)])
  ok('senza ricevuta l’importazione si annulla', await errore(() => s.annullaImportazioneBanca(mB9.creatoIl)), 'nessun errore')
  ok('…e le assegnazioni vanno via col movimento', (await attive(mB9.id)).length, 0)

  console.log('  9m. Una rete che cade e si riprova: la chiave dell’apertura, come nel database (136-assegna-una-volta.sql)')
  {
    const [p1, p2] = lista.slice(7, 9)
    const ALTRO_BONIFICO = 'Questa assegnazione è già stata fatta su un altro bonifico: chiudi la finestra e riaprila.'
    const KA = 'cccccccc-1111-4111-8111-aaaaaaaaaaaa', KB = 'cccccccc-1111-4111-8111-bbbbbbbbbbbb', KC = 'cccccccc-1111-4111-8111-cccccccccccc'
    const mC = await bonifico(10000, p1.id)
    ok('la prima volta con la chiave: si scrive', await errore(() => s.assegnaMovimento(mC, [riga(p1, 'Annuale Judo Kids', 4000)], KA)), 'nessun errore')
    ok('la stessa chiave ripetuta (la risposta si era persa): nessun errore', await errore(() => s.assegnaMovimento(mC, [riga(p1, 'Annuale Judo Kids', 4000)], KA)), 'nessun errore')
    ok('…una riga sola, non due', (await attive(mC)).length, 1)
    ok('…restano 60 € da assegnare, non 20', await resta(mC), 6000)
    ok('con la stessa chiave vale la prima scrittura, le righe non si confrontano: nessun errore', await errore(() => s.assegnaMovimento(mC, [riga(p1, 'Trimestre Danza', 3000)], KA)), 'nessun errore')
    ok('…e la riga è ancora quella di prima', (await attive(mC)).map((x) => [x.voce, x.importo]), [['Annuale Judo Kids', 4000]])
    const mD = await bonifico(10000, p1.id)
    ok('la stessa chiave su un altro bonifico: rifiutata', await errore(() => s.assegnaMovimento(mD, [riga(p1, 'Annuale Judo Kids', 4000)], KA)), ALTRO_BONIFICO)
    ok('…e sull’altro bonifico non scrive niente', (await attive(mD)).length, 0)
    ok('una chiave diversa è un’assegnazione nuova', await errore(() => s.assegnaMovimento(mC, [riga(p1, 'Trimestre Danza', 1000)], KB)), 'nessun errore')
    ok('senza chiave è un’assegnazione nuova', await errore(() => s.assegnaMovimento(mC, [riga(p1, 'Trimestre Danza', 1000)])), 'nessun errore')
    ok('…tre assegnazioni: 40 + 10 + 10 €, restano 40 €', [(await attive(mC)).length, await resta(mC)], [3, 4000])

    const mE = await bonifico(6000, p2.id)
    await s.assegnaMovimento(mE, [riga(p2, 'Annuale Judo Kids', 6000)], KC)
    const rE = await s.emettiRicevutaDaMovimento(datiRicevuta(p2, [vr('ANNUALE JUDO KIDS', 6000)]), mE)
    ok('la ricevuta dal movimento: le righe sono annullate', (await attive(mE)).length, 0)
    ok('la stessa chiave dopo la ricevuta: nessun errore', await errore(() => s.assegnaMovimento(mE, [riga(p2, 'Annuale Judo Kids', 6000)], KC)), 'nessun errore')
    ok('…nessuna riga attiva in più', (await attive(mE)).length, 0)
    ok('…i soldi sono una volta, nella ricevuta', await resta(mE), 0)
    ok('la stessa chiave, dopo la ricevuta, su un altro bonifico: rifiutata', await errore(() => s.assegnaMovimento(mD, [riga(p1, 'Annuale Judo Kids', 1000)], KC)), ALTRO_BONIFICO)
    await s.annullaRicevuta(rE.id)
  }

  console.log('  9n. Il tetto della quota: 50 € a persona e stagione, anche con le ricevute')
  {
    const [p3, p4] = lista.slice(9, 11)
    const TETTO = (x) => `Alla quota mancano ${x}: metti ${x} o meno, il resto rimane da assegnare.`
    const QUOTA_VOCE = 'Quota associativa 2026/27'
    const mQ = await bonifico(10000, p3.id)
    ok('30 € alla quota: passano', await errore(() => s.assegnaMovimento(mQ, [riga(p3, QUOTA_VOCE, 3000)])), 'nessun errore')
    ok('altri 25 €: 55 € su 50, mancano 20 €', await errore(() => s.assegnaMovimento(mQ, [riga(p3, QUOTA_VOCE, 2500)])), TETTO('20,00 €'))
    ok('…e non ha scritto niente', (await attive(mQ)).length, 1)
    ok('altri 20 €: passano', await errore(() => s.assegnaMovimento(mQ, [riga(p3, QUOTA_VOCE, 2000)])), 'nessun errore')
    ok('…poi anche 5 € in più no: mancano 0 €', await errore(() => s.assegnaMovimento(mQ, [riga(p3, QUOTA_VOCE, 500)])), TETTO('0,00 €'))
    ok('un corso sullo stesso bonifico passa: il tetto è della quota', await errore(() => s.assegnaMovimento(mQ, [riga(p3, 'Annuale Judo Kids', 5000)])), 'nessun errore')
    const mQ2 = await bonifico(6000, p4.id)
    ok('due righe di quota nella stessa chiamata: 30 + 30 € su 50, mancano 50 €', await errore(() => s.assegnaMovimento(mQ2, [riga(p4, QUOTA_VOCE, 3000), riga(p4, QUOTA_VOCE, 3000)])), TETTO('50,00 €'))
    ok('…e non scrive nessuna delle due', (await attive(mQ2)).length, 0)

    // 30 € di quota già in una ricevuta (fatta dal movimento): contano una volta, non due.
    const mR = await bonifico(3000, p4.id)
    await s.assegnaMovimento(mR, [riga(p4, QUOTA_VOCE, 3000)])
    const quotaRic = vr('QUOTA ASSOCIATIVA', 5000, { dal: '2026-09-01', al: '2027-07-31', pagamenti: [{ data: '2026-10-15', importo: 3000, metodo: 'Bonifico' }] })
    const rQ = await s.emettiRicevutaDaMovimento(datiRicevuta(p4, [quotaRic]), mR)
    const mS = await bonifico(10000, p4.id)
    ok('30 € di quota nella ricevuta attiva, altri 25 €: mancano 20 €', await errore(() => s.assegnaMovimento(mS, [riga(p4, QUOTA_VOCE, 2500)])), TETTO('20,00 €'))
    ok('…20 € passano: i 30 € delle righe diventate ricevuta non si contano due volte', await errore(() => s.assegnaMovimento(mS, [riga(p4, QUOTA_VOCE, 2000)])), 'nessun errore')
    ok('…e altri 5 € no: mancano 0 €', await errore(() => s.assegnaMovimento(mS, [riga(p4, QUOTA_VOCE, 500)])), TETTO('0,00 €'))
    await s.annullaRicevuta(rQ.id)
    ok('annullata la ricevuta, i 30 € non contano più: altri 25 € passano (20 + 25 = 45)', await errore(() => s.assegnaMovimento(mS, [riga(p4, QUOTA_VOCE, 2500)])), 'nessun errore')
  }

  console.log('  9o. «Pagato nel vecchio programma» in prova: l’incasso dice da quale movimento viene e quanto ne è assegnato')
  {
    // Una persona non ancora usata nelle sezioni prima (le prime undici lo sono), o l'ultima se l'elenco è corto.
    const p5 = lista[11] ?? lista[lista.length - 1]
    // Il 1° agosto della stagione di oggi: `pagatoPrima` della prova guarda la stagione del giorno vero.
    const adesso = new Date()
    const inizio = `${adesso.getMonth() >= 7 ? adesso.getFullYear() : adesso.getFullYear() - 1}-08-01`
    // Lo storico entra «Da classificare», poi passa sulla quota con la persona: come lo sistema la segreteria.
    await s.importaMovimentiBanca([{ chiave: 'prima-nota:9001', data: inizio, cassa: 'conto', tipo: 'entrata', importo: 5000, descrizione: 'Bonifico quota', voce: 'Da classificare' }])
    const mV = (await s.movimenti()).find((x) => x.origineImport === 'prima-nota:9001')
    const voceQuota = (await s.voci()).find((v) => v.nome === 'Quota associativa' && v.tipo === 'entrata')
    await s.cambiaVoceMovimenti([mV.id], voceQuota.id)
    await s.collegaMovimentiPersona([mV.id], p5.id)
    const incasso = async () => (await s.pagatoPrima()).elenco.find((i) => i.personaId === p5.id)
    const prima = await incasso()
    ok('non assegnato: c’è, col movimento e 0 assegnato', prima && [prima.movimentoId, prima.assegnato], [mV.id, 0])
    await s.assegnaMovimento(mV.id, [riga(p5, 'Annuale Judo Kids', 2000)])
    const dopo = await incasso()
    ok('assegnati 20 €: assegnato 2.000 centesimi, come `movimento_assegnato`', dopo && [dopo.movimentoId, dopo.assegnato], [mV.id, 2000])
  }
} catch (e) {
  // Una funzione che non c'è ancora ferma la sezione: si conta come un guaio, non come un errore della prova.
  guai++
  console.log(`  ✗ la sezione si ferma qui: ${e.message}`)
}

console.log('\n10. Nella scheda della persona: i bonifici con soldi da assegnare')
{
  // Le righe di «SCRITTI IN CONTABILITÀ» (`storicoPersona`): voce e cassa per nome, `aMano` falso per lo storico vecchio.
  const st = (id, data, importo, o = {}) => ({ id, data, descrizione: `Bonifico ${id}`, importo, voce: 'Corsi e altri pagamenti', cassa: 'Conto Corrente', aMano: true, ...o })
  const storico = [
    st('s1', '2026-10-15', 42000),
    st('s2', '2026-10-03', 7000, { voce: 'Quota associativa' }),
    st('s3', '2026-10-04', 12000, { cassa: 'Cassa Contanti' }),
    st('s4', '2026-10-05', 3000, { voce: 'Gare' }),
    st('s5', '2026-09-10', 9000, { aMano: false }),
    st('s6', '2025-10-10', 9000, { aMano: false }),
    st('s7', '2026-10-06', 5000),
  ]
  const diretti = [diretto('d1', 'mario', 5000, 'Quota associativa 2026/27', { movimentoId: 's2' }), diretto('d2', 'mario', 5000, 'Quota', { movimentoId: 's7' })]
  const ricevute = [ricevuta('r1', 'mario', [voceRic('Annuale', 40000, 40000)], { movimentoId: 's1' })]
  const b = prova(() => bonificiDaAssegnare(storico, diretti, ricevute, '2026-10-20'))
  ok('quelli che hanno ancora soldi da assegnare, dal più vecchio, con quanto resta', b?.map?.((x) => [x.movimentoId, x.data, x.daAssegnare]), [['s2', '2026-10-03', 2000], ['s5', '2026-09-10', 9000], ['s1', '2026-10-15', 2000]].sort((x, y) => x[1].localeCompare(y[1])))
  ok('…né i contanti, né le altre voci, né lo storico delle stagioni passate, né quelli già tutti assegnati', b?.some?.((x) => ['s3', 's4', 's6', 's7'].includes(x.movimentoId)), false)
  ok('…ogni riga porta l’importo del bonifico', b?.find?.((x) => x.movimentoId === 's1')?.importo, 42000)
  ok('nessun bonifico: niente', prova(() => bonificiDaAssegnare([], [], [], '2026-10-20')), [])
}

console.log('\n11. Verso il database: la chiave dell’apertura dentro ogni riga')
{
  const KEY = 'dddddddd-2222-4222-8222-dddddddddddd'
  const chiamate = []
  const db = { rpc: async (nome, args) => { chiamate.push([nome, args]); return { data: null, error: null } } }
  const righe2 = [{ personaId: 'p1', voce: ' Quota associativa 2026/27 ', importo: 3000 }, { personaId: 'p1', voce: 'Annuale Judo Kids', importo: 2000 }]
  const manda = async (...args) => { chiamate.length = 0; const e = await errore(() => S.creaSegreteriaSupabase(db).assegnaMovimento('m1', righe2, ...args)); return [e, chiamate[0]] }
  const [e1, c1] = await manda(KEY)
  ok('con la chiave: assegna_movimento(movimento, righe) e la chiave in ogni riga, come «chiave»', [e1, c1?.[0], c1?.[1]?.movimento, c1?.[1]?.righe],
    ['nessun errore', 'assegna_movimento', 'm1', [{ persona_id: 'p1', voce: 'Quota associativa 2026/27', importo: 3000, chiave: KEY }, { persona_id: 'p1', voce: 'Annuale Judo Kids', importo: 2000, chiave: KEY }]])
  const [e2, c2] = await manda()
  ok('senza chiave: nessun campo «chiave» nelle righe (come prima)', [e2, c2?.[1]?.righe], ['nessun errore', [{ persona_id: 'p1', voce: 'Quota associativa 2026/27', importo: 3000 }, { persona_id: 'p1', voce: 'Annuale Judo Kids', importo: 2000 }]])
  ok('gli argomenti della funzione sono solo movimento e righe: la firma (uuid, jsonb) non cambia', Object.keys(c1?.[1] ?? {}), ['movimento', 'righe'])
}

console.log(guai ? `\n${guai} COSE NON TORNANO` : '\nTUTTO A POSTO')
process.exit(guai ? 1 : 0)
