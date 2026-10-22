// ---------------------------------------------------------------------------
// DA FARE: i testi delle righe e dei tasti, senza browser.
//
//   node scripts/prova-dafare.mjs
//
// src/lib/daFareTesti.ts esporta TESTI_DA_FARE; src/lib/daFareChi.ts i nomi di
// chi manca in ogni riga (fino a PRIMI_DA_FARE) e il tasto «Vedi tutti», uguale
// per tutte le righe. DaFare.tsx li importa. I titoli delle caselle di COSA MANCA stanno in cosaManca.ts.
// ---------------------------------------------------------------------------
import { existsSync, readFileSync } from 'node:fs'
import { build } from 'esbuild'

process.env.TZ = 'Europe/Rome'
const memoria = new Map()
globalThis.localStorage = { getItem: (k) => memoria.get(k) ?? null, setItem: (k, v) => memoria.set(k, String(v)), removeItem: (k) => memoria.delete(k) }
globalThis.window = { location: { search: '', hash: '' }, addEventListener() {} }

let guai = 0
const ok = (cosa, avuto, voluto) => {
  const va = JSON.stringify(avuto) === JSON.stringify(voluto)
  console.log(va ? '  ✓' : '  ✗', cosa, va ? '' : `— atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`)
  if (!va) guai++
}
const impacchetta = async (contents) => {
  const { outputFiles } = await build({
    stdin: { contents, resolveDir: '.', loader: 'ts' },
    bundle: true, format: 'esm', write: false, logLevel: 'error', define: { 'import.meta.env': '{}' },
  })
  return import('data:text/javascript;base64,' + Buffer.from(outputFiles[0].text).toString('base64'))
}

const c = existsSync('src/lib/daFareTesti.ts')
const m = c ? await impacchetta("export * from './src/lib/daFareTesti'") : {}
const T = m.TESTI_DA_FARE ?? 'src/lib/daFareTesti.ts non esiste'

const VOLUTI = {
  appelli: ['Lezione senza appello', 'Lezioni senza appello'],
  richieste: ['Richiesta online nuova', 'Richieste online nuove'],
  istruttori: ['Presenza istruttore da confermare', 'Presenze istruttori da confermare'],
  segnalate: ['Presenza segnalata da vedere', 'Presenze segnalate da vedere'],
  certificati: ['Iscritto senza certificato valido', 'Iscritti senza certificato valido'],
  scadenza: ['Certificato in scadenza', 'Certificati in scadenza'],
  arrivo: ['Iscritto compie 6 anni senza certificato', 'Iscritti compiono 6 anni senza certificato'],
  pagare: ['Iscritto da pagare', 'Iscritti da pagare'],
  corsi: ['Iscritto con un corso scaduto', 'Iscritti con un corso scaduto'],
  listino: ['Corso con un prezzo mancante', 'Corsi con un prezzo mancante'],
  'file-di-prima': ['Certificato non archiviato', 'Certificati non archiviati'],
  'documenti-stampa': ['Richiesta con documenti da stampare', 'Richieste con documenti da stampare'],
}

console.log('\nI testi')
ok('le dodici cose, e nessun\'altra', typeof T === 'object' ? Object.keys(T).sort() : T, Object.keys(VOLUTI).sort())
for (const [k, [singolare, plurale]] of Object.entries(VOLUTI))
  ok(`${k}: singolare, plurale`, [T[k]?.singolare, T[k]?.plurale], [singolare, plurale])
ok('nessun testo è tutto maiuscolo', typeof T === 'object'
  ? Object.values(T).flatMap((t) => [t.singolare, t.plurale]).filter((s) => s === s.toUpperCase()) : T, [])

console.log('\nDaFare.tsx')
const tsx = readFileSync('src/components/segreteria/DaFare.tsx', 'utf8')
ok('importa TESTI_DA_FARE', /import[^;]*TESTI_DA_FARE[^;]*daFareTesti/.test(tsx), true)
ok('non ha più TUTTE IN PRESENZE né VEDI CHI', [tsx.includes('TUTTE IN PRESENZE'), tsx.includes('VEDI CHI')], [false, false])
ok('non usa più classeTastoDaFare né sg-btn-pieno', [tsx.includes('classeTastoDaFare'), tsx.includes('sg-btn-pieno')], [false, false])
ok('usa TASTO_DA_FARE, importato da daFareChi', /import[^;]*TASTO_DA_FARE[^;]*daFareChi/.test(tsx) && tsx.includes('TASTO_DA_FARE'), true)
ok('il tasto ha l\'aria-label «Vedi tutti: <titolo>»', tsx.split('\n').some((r) => r.includes('aria-label') && r.includes('TASTO_DA_FARE')), true)
const testiTs = existsSync('src/lib/daFareTesti.ts') ? readFileSync('src/lib/daFareTesti.ts', 'utf8') : ''
ok('daFareTesti.ts non ha più il campo tasto né classeTastoDaFare', [/\btasto:/.test(testiTs), testiTs.includes('classeTastoDaFare')], [false, false])


// ---- CHI MANCA: i nomi sotto ogni riga ---------------------------------------
console.log('\nChi manca (src/lib/daFareChi.ts)')
let C = {}
if (existsSync('src/lib/daFareChi.ts')) C = await impacchetta("export * from './src/lib/daFareChi'")
else { guai++; console.log('  ✗ manca src/lib/daFareChi.ts') }
const f = (nome) => (typeof C[nome] === 'function' ? C[nome] : () => `manca ${nome}`)
const lib = await impacchetta(`
  export { certificatiDaSistemare, pagamentiNonInRegola } from './src/lib/cosaManca'
  export { corsiScaduti } from './src/lib/corsiDaPagare'
`)
const OGGI = '2026-10-22'
const tre = (v) => (Array.isArray(v) ? v.map((x) => [x.nome, x.perche, x.rosso]) : v)
const duo = (v) => (Array.isArray(v) ? v.map((x) => [x.nome, x.perche]) : v)

let n = 0
// Una persona in regola su tutto; ogni caso cambia quel che serve. nome «Cognome Nome» in `nome`/`cognome`.
const persona = (cognome, nome, extra = {}) => ({
  id: `p${++n}`, nome, cognome, attiva: true, creataIl: '2026-01-01', iscrizioni: [], documento: true,
  natoIl: '2000-01-01', certificato: { scade: '2027-06-01', conFile: false },
  pagamento: { stato: 'da_pagare' }, quote: [{ anno: 2026, numero: 1, dal: '2026-09-01', al: '2027-07-31', mancano: 0 }],
  ...extra,
})
const quote = (al, mancano = 0, dal = '2025-09-01') => [{ anno: 2026, numero: 1, dal, al, mancano }]
const primoId = (v) => (Array.isArray(v) ? v[0]?.id : v)

console.log(' costanti')
ok('PRIMI_DA_FARE = 5', C.PRIMI_DA_FARE, 5)
ok('primiDaFare: di 7 voci restano le prime 5, nello stesso ordine', typeof C.primiDaFare === 'function' ? C.primiDaFare([1, 2, 3, 4, 5, 6, 7]) : 'manca primiDaFare', [1, 2, 3, 4, 5])
ok('primiDaFare: senza elenco, niente', typeof C.primiDaFare === 'function' ? C.primiDaFare(null) : 'manca primiDaFare', [])
ok('TASTO_DA_FARE = «Vedi tutti»', C.TASTO_DA_FARE, 'Vedi tutti')
ok('COLONNE_DA_FARE: due colonne per certificati, scadenza, arrivo, pagare; una per corsi, richieste, listino',
  C.COLONNE_DA_FARE, { certificati: 2, scadenza: 2, arrivo: 2, pagare: 2, corsi: 1, richieste: 1, listino: 1 })

console.log(' nomeInElenco')
const N = f('nomeInElenco')
ok('«Cognome Nome»', N({ nome: 'Anna', cognome: 'Rossi' }), 'Rossi Anna')
ok('spazi in più tolti, niente doppi spazi', N({ nome: '  Anna  Maria ', cognome: ' De   Luca ' }), 'De Luca Anna Maria')
ok('solo il cognome', N({ nome: '', cognome: 'Rossi' }), 'Rossi')
ok('solo il nome', N({ nome: 'Anna', cognome: '  ' }), 'Anna')
ok('né l\'uno né l\'altro: «Senza nome»', N({ nome: '', cognome: '' }), 'Senza nome')

console.log(' certificati')
{
  const persone = [
    persona('Neri', 'Carla', { certificato: { conFile: false } }), // manca
    persona('Zanetti', 'Ugo', { certificato: { conFile: false } }), // manca, dopo Èvola nella collazione italiana
    persona('Èvola', 'Ugo', { certificato: { conFile: false } }), // manca
    persona('Bianchi', 'Marco', { certificato: { scade: '2026-10-03', conFile: false } }), // scaduto di recente
    persona('Verdi', 'Lia', { certificato: { scade: '2026-09-10', conFile: false } }), // scaduto prima
    persona('Gialli', 'Sara', { certificato: { conFile: false }, natoIl: undefined }), // manca, nessuna data di nascita
    persona('Rossi', 'Anna'), // valido
    persona('Bruni', 'Elia', { attiva: false, certificato: { conFile: false } }), // non attiva: fuori
    persona('Piccoli', 'Teo', { natoIl: '2022-05-05', certificato: { conFile: false } }), // sotto i 6 anni: non serve
  ]
  const v = f('chiCertificati')(persone, OGGI)
  ok('tante voci quante certificatiDaSistemare', Array.isArray(v) ? v.length : v, lib.certificatiDaSistemare(persone, OGGI))
  ok('scaduti prima (dal più vecchio), poi i «manca» per cognome; perché e rosso',
    tre(v), [
      ['Verdi Lia', 'scaduto il 10 settembre', true],
      ['Bianchi Marco', 'scaduto il 3 ottobre', true],
      ['Èvola Ugo', 'manca', true],
      ['Gialli Sara', 'manca · senza data di nascita', true],
      ['Neri Carla', 'manca', true],
      ['Zanetti Ugo', 'manca', true],
    ])
  ok('l\'id è quello della persona', primoId(v), persone[4].id)
  ok('nessuno: elenco vuoto', f('chiCertificati')([persona('Rossi', 'Anna')], OGGI), [])
}

console.log(' in scadenza')
{
  const persone = [
    persona('Neri', 'Carla', { certificato: { scade: '2026-11-02', conFile: false } }),
    persona('Bianchi', 'Marco', { certificato: { scade: '2026-10-22', conFile: false } }),
    persona('Verdi', 'Lia', { certificato: { scade: '2026-10-30', conFile: false } }),
    persona('Rossi', 'Anna', { certificato: { scade: '2027-03-01', conFile: false } }), // lontano
    persona('Bruni', 'Elia', { attiva: false, certificato: { scade: '2026-10-25', conFile: false } }),
  ]
  const v = f('chiScadenza')(persone, OGGI)
  ok('tante voci quanti i certificati in scadenza fra gli attivi', Array.isArray(v) ? v.length : v, 3)
  ok('dalla più vicina, «scade oggi» oggi, mai rosso', tre(v), [
    ['Bianchi Marco', 'scade oggi', false],
    ['Verdi Lia', 'scade il 30 ottobre', false],
    ['Neri Carla', 'scade il 2 novembre', false],
  ])
}

console.log(' compie 6 anni')
{
  const persone = [
    persona('Neri', 'Carla', { natoIl: '2020-11-20', certificato: { conFile: false } }),
    persona('Bianchi', 'Marco', { natoIl: '2020-11-12', certificato: { conFile: false } }),
    persona('Rossi', 'Anna', { natoIl: '2021-03-01', certificato: { conFile: false } }), // lontano
    persona('Bruni', 'Elia', { natoIl: '2020-11-15', certificato: { conFile: false }, attiva: false }),
  ]
  const v = f('chiArrivo')(persone, OGGI)
  ok('tante voci quante chi compie 6 anni entro un mese', Array.isArray(v) ? v.length : v, 2)
  ok('dal più vicino, «serve dal …», mai rosso', tre(v), [
    ['Bianchi Marco', 'serve dal 12 novembre', false],
    ['Neri Carla', 'serve dal 20 novembre', false],
  ])
}

console.log(' da pagare')
{
  const persone = [
    persona('Rossi', 'Anna', { quote: [], pagamento: { stato: 'da_pagare' } }), // da pagare
    persona('Bianchi', 'Marco', { quote: quote('2026-09-30') }), // scaduta il 30 settembre
    persona('Verdi', 'Lia', { quote: quote('2026-08-31') }), // scaduta prima
    persona('Neri', 'Carla', { quote: quote('2027-07-31', 6000, '2026-09-01') }), // in parte, 60 €
    persona('Gialli', 'Sara', { quote: [], pagamento: { stato: 'in_parte' } }), // in parte, senza importo
    persona('Alfa', 'Zeno', { quote: [], pagamento: { stato: 'da_pagare' } }), // da pagare, prima di Rossi
    persona('Verdoni', 'Gina'), // in regola
    persona('Bruni', 'Elia', { attiva: false, quote: [] }),
  ]
  const v = f('chiPagare')(persone, OGGI)
  ok('tante voci quante pagamentiNonInRegola', Array.isArray(v) ? v.length : v, lib.pagamentiNonInRegola(persone, OGGI))
  ok('quota scaduta (la più vecchia prima), poi da pagare, poi in parte; mai rosso', tre(v), [
    ['Verdi Lia', 'quota scaduta il 31 agosto', false],
    ['Bianchi Marco', 'quota scaduta il 30 settembre', false],
    ['Alfa Zeno', 'da pagare', false],
    ['Rossi Anna', 'da pagare', false],
    ['Neri Carla', 'pagato in parte: mancano 60 €', false],
    ['Gialli Sara', 'pagato in parte', false],
  ])
}

console.log(' corsi scaduti')
{
  const listino = {
    quota: 5000, saldoEntro: '2026-08-31', offerte: [],
    corsi: ['Judo 3', 'Judo kids', 'MGA', 'Pilates'].map((corso) => ({ corso, eta: '', orari: [], prezzi: [{ annuale: 300, trimestre: 100 }] })),
  }
  const corsi = [{ id: 'judo3', nome: 'Judo 3' }, { id: 'kids', nome: 'Judo kids' }, { id: 'mga', nome: 'MGA' }, { id: 'pilates', nome: 'Pilates' }]
  const iscr = (...ids) => ids.map((corsoId) => ({ corsoId, dal: '2026-07-01' }))
  const voce = (descrizione, al, mancano = 0) => ({ descrizione, dal: '2026-07-01', al, mancano })
  const persone = [
    persona('Rossi', 'Anna', { iscrizioni: iscr('kids'), vociCorsi: [voce('Trimestre Judo kids', '2026-09-30')] }),
    persona('Bianchi', 'Marco', { iscrizioni: iscr('pilates'), vociCorsi: [voce('Annuale Pilates', '2026-10-15')] }),
    persona('Neri', 'Carla', { iscrizioni: iscr('judo3'), vociCorsi: [] }), // nessuna voce: da pagare, senza data
    persona('Alfa', 'Zeno', { iscrizioni: iscr('kids', 'mga'), vociCorsi: [voce('Trimestre Judo kids', '2026-09-30')] }), // due corsi non coperti
    persona('Verdi', 'Lia', { iscrizioni: iscr('judo3'), vociCorsi: [voce('Trimestre Judo 3', '2026-12-15')] }), // coperto
    persona('Bruni', 'Elia', { attiva: false, iscrizioni: iscr('judo3'), vociCorsi: [] }),
  ]
  const v = f('chiCorsi')(persone, corsi, listino, OGGI)
  ok('tante voci quante corsiScaduti', Array.isArray(v) ? v.length : v, lib.corsiScaduti(persone, corsi, listino, OGGI))
  ok('il corso non coperto con la sua frase; più corsi uniti con « · »; scaduto più vecchio prima, senza data dopo',
    duo(v), [
      ['Alfa Zeno', 'Judo kids: scaduto il 30 settembre · MGA: da pagare'],
      ['Rossi Anna', 'Judo kids: scaduto il 30 settembre'],
      ['Bianchi Marco', 'Pilates: scaduto il 15 ottobre'],
      ['Neri Carla', 'Judo 3: da pagare'],
    ])
  ok('senza ricevute lette: undefined, come corsiScaduti', f('chiCorsi')(persone.map(({ vociCorsi, ...p }) => p), corsi, listino, OGGI), undefined)
}

console.log(' richieste online')
{
  const r = (cognome, nome, creata, corsi, stato = 'nuova') => ({
    id: `r${++n}`, nome, cognome, creataIl: `${creata}T12:00:00.000Z`, stato, corsi, natoIl: '2000-01-01', formula: 'annuale',
  })
  const richieste = [
    r('Neri', 'Carla', '2026-10-22', ['Judo kids']),
    r('Rossi', 'Anna', '2026-10-21', ['Pilates', 'Fitness']),
    r('Verdi', 'Lia', '2026-10-19', ['MGA']),
    r('Gialli', 'Sara', '2026-10-16', ['MGA']),
    r('Bianchi', 'Marco', '2026-10-15', ['Judo 3']),
    r('Bruni', 'Elia', '2026-10-03', ['Judo 3']),
    r('Alfa', 'Zeno', '2026-10-01', ['Judo 3'], 'accolta'),
    r('Beta', 'Zeno', '2026-10-01', ['Judo 3'], 'rifiutata'),
    r('', '', '2026-10-20', ['Judo 3']),
  ]
  // Le richieste hanno gli id dei corsi: il nome si legge dai corsi, come in RICHIESTE ONLINE.
  const nomi = new Map(['Judo kids', 'Pilates', 'Fitness', 'MGA', 'Judo 3'].map((x) => [x, x]))
  const v = f('chiRichieste')(richieste, OGGI, nomi)
  ok('tante voci quante le richieste «nuova»', Array.isArray(v) ? v.length : v, richieste.filter((x) => x.stato === 'nuova').length)
  ok('dalla più vecchia; corsi uniti con «, », poi quando', duo(v), [
    ['Bruni Elia', 'Judo 3 · arrivata il 3 ottobre'],
    ['Bianchi Marco', 'Judo 3 · arrivata il 15 ottobre'],
    ['Gialli Sara', 'MGA · arrivata 6 giorni fa'],
    ['Verdi Lia', 'MGA · arrivata 3 giorni fa'],
    ['Senza nome', 'Judo 3 · arrivata 2 giorni fa'],
    ['Rossi Anna', 'Pilates, Fitness · arrivata ieri'],
    ['Neri Carla', 'Judo kids · arrivata oggi'],
  ])
  ok('l\'id è quello della richiesta', primoId(v), richieste[5].id)
  const ignoti = [r('Rossi', 'Anna', '2026-10-21', ['pesi-1', 'MGA']), r('Neri', 'Carla', '2026-10-22', ['pesi-1'])]
  ok('un corso che non si trova non mostra il suo id: si salta, e senza corsi resta il quando', duo(f('chiRichieste')(ignoti, OGGI, nomi)), [
    ['Rossi Anna', 'MGA · arrivata ieri'],
    ['Neri Carla', 'arrivata oggi'],
  ])
  ok('senza i nomi dei corsi letti, nessun id', duo(f('chiRichieste')(ignoti, OGGI, new Map())), [
    ['Rossi Anna', 'arrivata ieri'],
    ['Neri Carla', 'arrivata oggi'],
  ])
}

console.log(' listino')
{
  const v = f('chiListino')([
    { id: 'z', nome: 'Zumba', frase: 'senza prezzo nel listino' },
    { id: 'e', nome: 'Èdera', frase: 'manca il prezzo del trimestre' },
    { id: 'j', nome: 'Judo', frase: 'manca il prezzo dell’annuale e del trimestre' },
  ])
  ok('id e nome del corso, la frase come perché, in ordine alfabetico (collazione italiana)', Array.isArray(v) ? v.map((x) => [x.id, x.nome, x.perche]) : v, [
    ['e', 'Èdera', 'manca il prezzo del trimestre'],
    ['j', 'Judo', 'manca il prezzo dell’annuale e del trimestre'],
    ['z', 'Zumba', 'senza prezzo nel listino'],
  ])
}

console.log(' a pari merito')
{
  const uguali = [
    persona('Rossi', 'Zeno', { certificato: { conFile: false } }),
    persona('Rossi', 'Anna', { certificato: { conFile: false } }),
    persona('De Luca', 'Mia', { certificato: { conFile: false } }),
  ]
  ok('cognome, poi nome', tre(f('chiCertificati')(uguali, OGGI))?.map?.((x) => x[0]), ['De Luca Mia', 'Rossi Anna', 'Rossi Zeno'])
}

console.log('\nI titoli di COSA MANCA')
const cm = await impacchetta("export * from './src/lib/cosaManca'")
ok('i titoli delle cinque caselle', cm.caselleCosaManca({ appelli: 1, certificati: 2, pagamenti: 3, tessere: 4, richieste: 5, contato: true }).map((x) => x.titolo),
  ['Appelli non fatti', 'Certificati scaduti', 'Pagamenti', 'Senza tessera', 'Richieste online'])

ok('con il conto dei corsi le caselle diventano sei, «Corsi scaduti» dopo «Pagamenti»', cm.caselleCosaManca({ appelli: 1, certificati: 2, pagamenti: 3, corsi: 6, tessere: 4, richieste: 5, contato: true }).map((x) => x.titolo),
  ['Appelli non fatti', 'Certificati scaduti', 'Pagamenti', 'Corsi scaduti', 'Senza tessera', 'Richieste online'])

console.log(guai ? `\n${guai} ${guai === 1 ? 'cosa non torna' : 'cose non tornano'}` : '\nTUTTO A POSTO')
process.exit(guai ? 1 : 0)
