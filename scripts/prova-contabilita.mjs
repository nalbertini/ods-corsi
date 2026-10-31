// ---------------------------------------------------------------------------
// La contabilità, prima parte, senza browser.
//
//   node scripts/prova-contabilita.mjs
//
// Controlla `src/lib/contabilita.ts`: gli incassi degli iscritti ricavati da
// ricevute e pagamenti (mai copiati), i movimenti fatti a mano, il residuo di
// ogni cassa, i totali, i filtri, il foglio CSV e gli stessi rifiuti di
// `supabase/59-contabilita.sql` (provato da supabase/prova/contabilita.sql).
// In fondo quel che legge la chat (strumenti `conti` e `saldi_casse` di
// `src/lib/mcp.ts`): gli incassi senza nomi e i saldi delle casse, mai il
// previsto della Cassa Contanti.
// ---------------------------------------------------------------------------
import { readFileSync } from 'node:fs'
import { build } from 'esbuild'

const { outputFiles } = await build({
  stdin: {
    contents:
      "export * from './src/lib/contabilita'; export { righeDaRicevute, righeDirette, intervalloDi } from './src/lib/pagamenti'; export { ENTE_PREDEFINITO, euro, dataRicevuta } from './src/lib/ricevute'",
    resolveDir: '.',
    loader: 'ts',
  },
  bundle: true,
  format: 'esm',
  platform: 'node',
  write: false,
  logLevel: 'error',
  define: { 'import.meta.env': '{}' },
})
const m = await import('data:text/javascript;base64,' + Buffer.from(outputFiles[0].text).toString('base64'))

let guai = 0
const ok = (cosa, avuto, voluto) => {
  const va = JSON.stringify(avuto) === JSON.stringify(voluto)
  console.log(va ? '  ✓' : '  ✗', cosa, va ? '' : `— atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`)
  if (!va) guai++
}
// Una funzione che non c'è ancora lancia: la prova fallisce con quel messaggio, non si ferma.
const prova = (f) => {
  try {
    return f()
  } catch (e) {
    return `ERRORE: ${e.message}`
  }
}

console.log('1. i nomi di sistema')
ok('le due casse', [m.NOME_CASSA_CONTANTI, m.NOME_CASSA_CONTO], ['Cassa Contanti', 'Conto Corrente'])
ok('le due voci di sistema', [m.VOCE_QUOTA, m.VOCE_CORSI], ['Quota associativa', 'Corsi e altri pagamenti'])

// I dati di tutte le prove che seguono.
const casse = [
  { id: 'c1', nome: 'Cassa Contanti', saldoIniziale: 10000, dal: '2026-09-01' },
  { id: 'c2', nome: 'Conto Corrente', saldoIniziale: 0 },
]
const voci = [
  { id: 'v-quota', nome: 'Quota associativa', tipo: 'entrata', diSistema: true, attiva: true },
  { id: 'v-corsi', nome: 'Corsi e altri pagamenti', tipo: 'entrata', diSistema: true, attiva: true },
  { id: 'v-don', nome: 'Donazioni', tipo: 'entrata', diSistema: false, attiva: true },
  { id: 'v-aff', nome: 'Affitto sala', tipo: 'uscita', diSistema: false, attiva: true },
  { id: 'v-vecchia', nome: 'Vecchia', tipo: 'uscita', diSistema: false, attiva: false },
]

console.log('\n2. la cassa e la voce di un incasso')
{
  ok('Contanti va in Cassa Contanti', prova(() => m.cassaDelMetodo('Contanti', '2026-09-30')), 'contanti')
  ok('…senza badare a maiuscole e spazi', prova(() => [m.cassaDelMetodo('contanti ', '2026-09-30'), m.cassaDelMetodo(' CONTANTI', '2026-10-05')]), ['contanti', 'contanti'])
  ok('l\'Assegno va sul conto', prova(() => m.cassaDelMetodo('Assegno', '2026-10-05')), 'conto')
  ok('tutto il resto sul conto', prova(() => ['Bonifico', 'POS', 'Satispay', ''].map((x) => m.cassaDelMetodo(x, '2026-09-30'))), ['conto', 'conto', 'conto', 'conto'])
  // Con la carta dal modulo di iscrizione (115-carta.sql) la cassa è sua: era sul conto solo finché non c'era.
  ok('Carta: cassa Carta, senza badare a maiuscole e spazi', prova(() => [m.cassaDelMetodo('Carta', '2026-10-20'), m.cassaDelMetodo(' carta ', '2026-10-20'), m.cassaDelMetodo('Carta', '2026-09-30')]), ['carta', 'carta', 'carta'])
  ok('la cassa Carta si chiama Carta', prova(() => m.NOME_CASSA_CARTA), 'Carta')
  // Dal 1° ottobre 2026 Satispay è una cassa a sé (97-satispay-scarico.sql): ci vanno anche i pagamenti di PAGAMENTI.
  ok('Satispay dal 1° ottobre 2026: cassa Satispay', prova(() => [m.cassaDelMetodo('Satispay', '2026-10-01'), m.cassaDelMetodo(' SATISPAY ', '2026-11-15')]), ['satispay', 'satispay'])
  ok('…gli altri metodi non cambiano', prova(() => ['Contanti', 'POS', 'Bonifico'].map((x) => m.cassaDelMetodo(x, '2026-10-05'))), ['contanti', 'conto', 'conto'])
  ok('la quota associativa, comunque sia scritta', prova(() => ['QUOTA ASSOCIATIVA', 'Quota associativa', 'quota associativa ', '  Quota Associativa'].map((x) => m.voceDiSistema(x))), Array(4).fill('Quota associativa'))
  ok('le gare hanno la loro voce, comunque scritta', prova(() => ['Gare', 'GARE', ' gare '].map((x) => m.voceDiSistema(x))), Array(3).fill('Gare'))
  ok('tutto il resto è «Corsi e altri pagamenti»', prova(() => ['ANNUALE JUDO', 'TRIMESTRE KARATE', 'ALTRO', '', 'Quota associativa junior'].map((x) => m.voceDiSistema(x))), Array(5).fill('Corsi e altri pagamenti'))
}

// Come nelle prove dei pagamenti.
const pag = (data, importo, metodo = 'Contanti') => ({ data, importo, metodo })
const voce = (descrizione, prezzo, pagamenti, quantita = 1, extra = {}) => ({ descrizione, quantita, prezzo, pagamenti, ...extra })
let n = 0
const ricevuta = (numero, nome, cognome, vv, extra = {}) => ({
  id: `r${++n}`,
  anno: 2026,
  numero,
  data: '2026-09-01',
  personaId: `p-${cognome}`,
  ente: m.ENTE_PREDEFINITO,
  intestatario: { nome, cognome },
  voci: vv,
  anticipo: 0,
  totale: vv.reduce((s, v) => s + v.quantita * v.prezzo, 0),
  pagato: vv.reduce((s, v) => s + v.pagamenti.reduce((t, p) => t + p.importo, 0), 0),
  creataIl: '2026-09-01T10:00:00Z',
  ...extra,
})
const diretto = (id, personaId, data, importo, extra = {}) => ({ id, personaId, data, importo, metodo: 'Contanti', voce: 'ALTRO', creatoIl: `${data}T10:00:00Z`, ...extra })
const nomeDi = (id) => ({ 'p-Rossi': 'Rossi Giulia', 'p-Bianchi': "D'Amico Zoë" })[id] ?? 'Sconosciuto'
// Le sole parti che contano di una riga, per leggerle a colpo d'occhio.
const lette = (righe) => righe.map((r) => [r.origine, r.tipo, r.data, r.importo, r.descrizione, r.sotto ?? null, r.voce, r.cassaId, r.annullato])

console.log('\n3. gli incassi degli iscritti si ricavano, non si copiano')
{
  const r12 = ricevuta(12, 'Giulia', 'Rossi', [voce('QUOTA ASSOCIATIVA', 5000, [pag('2026-09-10', 3000), pag('2026-10-01', 2000, 'POS')]), voce('Senza pagamenti', 7000, [])])
  const aMano = diretto('d1', 'p-Bianchi', '2026-09-12', 1500, { metodo: 'Assegno', voce: 'ANNUALE JUDO' })
  const righe = prova(() => [...m.righeDaRicevute([r12]), ...m.righeDirette([aMano], nomeDi)])
  const derivati = prova(() => m.incassiDerivati(righe, casse))
  ok('una ricevuta con due pagamenti e uno a mano: tre righe di entrata, ciascuna nella sua cassa e con la sua voce',
    prova(() => lette(derivati)),
    [
      ['ricevuta', 'entrata', '2026-09-10', 3000, 'Rossi Giulia', 'ricevuta 12/2026', 'Quota associativa', 'c1', false],
      ['ricevuta', 'entrata', '2026-10-01', 2000, 'Rossi Giulia', 'ricevuta 12/2026', 'Quota associativa', 'c2', false],
      ['pagamento', 'entrata', '2026-09-12', 1500, "D'Amico Zoë", 'ANNUALE JUDO · senza ricevuta', 'Corsi e altri pagamenti', 'c2', false],
    ])
  ok('una quota di gara va sotto «Gare», e sotto il nome non si ripete la voce',
    prova(() => lette(m.incassiDerivati(m.righeDirette([diretto('g1', 'p-Rossi', '2026-10-25', 9000, { metodo: 'Contanti', voce: 'Gare' })], nomeDi), casse))),
    [['pagamento', 'entrata', '2026-10-25', 9000, 'Rossi Giulia', 'senza ricevuta', 'Gare', 'c1', false]])
  const conSatispay = [...casse, { id: 'c3', nome: 'Satispay', saldoIniziale: 0, dal: '2026-10-01' }]
  const sat = (data) => ({ ...diretto(`s-${data}`, 'p-Rossi', data, 2500), metodo: 'Satispay' })
  ok('un pagamento Satispay del 30 settembre: Conto Corrente; dell\'1 ottobre: cassa Satispay',
    prova(() => m.incassiDerivati(m.righeDirette([sat('2026-09-30'), sat('2026-10-01')], nomeDi), conSatispay).map((r) => r.cassaId)), ['c2', 'c3'])
  ok('gli incassi non hanno una seconda cassa', prova(() => derivati.map((r) => r.cassaAId ?? null)), [null, null, null])
  ok('l\'id è stabile: due volte lo stesso', prova(() => m.incassiDerivati(righe, casse).map((r) => r.id)), prova(() => derivati.map((r) => r.id)))
  ok('…e diverso per ogni pagamento', prova(() => new Set(derivati.map((r) => r.id)).size), 3)
  ok('…e non dipende dall\'ordine in cui arrivano', prova(() => Object.fromEntries(m.incassiDerivati([...righe].reverse(), casse).map((r) => [r.importo, r.id]))), prova(() => Object.fromEntries(derivati.map((r) => [r.importo, r.id]))))
  ok('la riga dice il numero della ricevuta, o che manca; Satispay senza richiesta non è «senza ricevuta»',
    prova(() => m.incassiDerivati([
      { id: 's1', data: '2026-10-02', importo: 100, metodo: 'POS', voce: 'ANNUALE', chi: 'Rossi Giulia', annullato: false, ricevuta: { id: 'r9', anno: 2026, numero: 7 } },
      { id: 's2', data: '2026-10-02', importo: 100, metodo: 'Contanti', voce: 'ANNUALE', chi: 'Rossi Giulia', annullato: false },
      { id: 's3', data: '2026-10-02', importo: 100, metodo: 'Satispay', voce: 'ANNUALE', chi: 'Rossi Giulia', annullato: false, senzaRichiesta: true },
    ], casse).map((r) => r.sotto)),
    ['ANNUALE · ricevuta 7/2026', 'ANNUALE · senza ricevuta', 'ANNUALE'])
  ok('la riga non ripete quel che dicono le colonne: né il metodo (c\'è la cassa) né la voce di sistema (c\'è sotto il nome)',
    prova(() => m.incassiDerivati([
      { id: 'q1', data: '2026-10-02', importo: 5000, metodo: 'Bonifico', voce: 'QUOTA ASSOCIATIVA', chi: 'Rossi Giulia', annullato: false, ricevuta: { id: 'r1', anno: 2026, numero: 308 } },
      { id: 'q2', data: '2026-10-02', importo: 5000, metodo: 'Contanti', voce: 'Quota associativa', chi: 'Rossi Giulia', annullato: false },
      { id: 'q3', data: '2026-10-02', importo: 5000, metodo: 'Satispay', voce: 'Quota associativa', chi: 'Rossi Giulia', annullato: false, senzaRichiesta: true },
    ], casse).map((r) => r.sotto ?? null)),
    ['ricevuta 308/2026', 'senza ricevuta', null])
  ok('l\'anticipo non è un incasso', prova(() => m.incassiDerivati(m.righeDaRicevute([ricevuta(30, 'Giulia', 'Rossi', [voce('Corso', 8000, [pag('2026-10-02', 3000)])], { anticipo: 1000 })]), casse).map((r) => r.importo)), [3000])
  ok('«pagato fino al» non è un incasso: una voce con le date e nessun pagamento non dà righe',
    prova(() => m.incassiDerivati(m.righeDaRicevute([ricevuta(31, 'Giulia', 'Rossi', [voce('Corso', 8000, [], 1, { dal: '2026-09-01', al: '2027-07-31' })], { anticipo: 8000 })]), casse)), [])
  ok('una ricevuta annullata: righe annullate, e si vedono', prova(() => lette(m.incassiDerivati(m.righeDaRicevute([{ ...r12, annullataIl: '2026-10-04T10:00:00Z' }]), casse)).map((x) => x[8])), [true, true])
  ok('un pagamento a mano annullato: annullato', prova(() => m.incassiDerivati(m.righeDirette([{ ...aMano, annullatoIl: '2026-10-04T10:00:00Z' }], nomeDi), casse).map((r) => r.annullato)), [true])
  ok('nessun pagamento, nessuna riga', prova(() => m.incassiDerivati([], casse)), [])
  ok('la voce «quota associativa » del pagamento a mano è la voce di sistema', prova(() => m.incassiDerivati(m.righeDirette([diretto('d2', 'p-Rossi', '2026-09-13', 5000, { voce: 'quota associativa ' })], nomeDi), casse).map((r) => r.voce)), ['Quota associativa'])
}

// Una riga di movimento già fatta, per le prove sui conti.
const riga = (id, tipo, data, importo, cassaId, extra = {}) => ({ id, origine: 'movimento', tipo, data, importo, descrizione: id, voce: tipo === 'giroconto' ? null : 'Donazioni', cassaId, annullato: false, ...extra })

console.log('\n4. gli incassi e i movimenti a mano insieme, dal più recente')
{
  const derivati = prova(() => m.incassiDerivati(
    [
      { id: 'x1', data: '2026-10-01', importo: 2000, metodo: 'POS', voce: 'QUOTA ASSOCIATIVA', chi: 'Rossi Giulia', annullato: false, ricevuta: { id: 'r1', anno: 2026, numero: 1 } },
      { id: 'x2', data: '2026-09-12', importo: 1500, metodo: 'Assegno', voce: 'ANNUALE JUDO', chi: 'Bianchi Luca', annullato: false },
    ],
    casse,
  ))
  const manuali = [
    { id: 'm1', tipo: 'entrata', data: '2026-09-05', importo: 4000, voceId: 'v-don', cassaId: 'c1', descrizione: 'Offerta di Rossi', creatoIl: '2026-09-05T10:00:00Z' },
    { id: 'm2', tipo: 'uscita', data: '2026-09-13', importo: 2500, voceId: 'v-aff', cassaId: 'c1', descrizione: 'Affitto sala di settembre', nota: 'Pagato a mano', creatoIl: '2026-09-13T10:00:00Z' },
    { id: 'm3', tipo: 'giroconto', data: '2026-09-15', importo: 1000, cassaId: 'c1', cassaAId: 'c2', descrizione: 'Giroconto da Cassa Contanti a Conto Corrente', creatoIl: '2026-09-15T10:00:00Z' },
    { id: 'm4', tipo: 'entrata', data: '2026-09-11', importo: 300, voceId: 'v-don', cassaId: 'c2', descrizione: 'Offerta annullata', creatoIl: '2026-09-11T10:00:00Z', annullatoIl: '2026-09-12T10:00:00Z' },
    { id: 'a-2', tipo: 'entrata', data: '2026-09-20', importo: 100, voceId: 'v-don', cassaId: 'c2', descrizione: 'Stesso giorno B', creatoIl: '2026-09-20T10:00:00Z' },
    { id: 'a-1', tipo: 'entrata', data: '2026-09-20', importo: 100, voceId: 'v-don', cassaId: 'c2', descrizione: 'Stesso giorno A', creatoIl: '2026-09-20T10:00:00Z' },
  ]
  const tutte = prova(() => m.righeMovimenti(derivati, manuali, voci))
  ok('dal più recente, e a pari data per id', prova(() => tutte.map((r) => `${r.data} ${r.origine === 'movimento' ? r.id : '·'}`)), [
    '2026-10-01 ·', '2026-09-20 a-1', '2026-09-20 a-2', '2026-09-15 m3', '2026-09-13 m2', '2026-09-12 ·', '2026-09-11 m4', '2026-09-05 m1',
  ])
  const di = (id) => (Array.isArray(tutte) ? tutte.find((r) => r.id === id) : {})
  ok('un\'entrata a mano: la voce col suo nome', prova(() => [di('m1').origine, di('m1').tipo, di('m1').voce, di('m1').cassaId, di('m1').annullato]), ['movimento', 'entrata', 'Donazioni', 'c1', false])
  ok('una uscita a mano', prova(() => [di('m2').tipo, di('m2').voce, di('m2').importo, di('m2').descrizione]), ['uscita', 'Affitto sala', 2500, 'Affitto sala di settembre'])
  ok('il giroconto: senza voce, con le due casse', prova(() => [di('m3').tipo, di('m3').voce, di('m3').cassaId, di('m3').cassaAId]), ['giroconto', null, 'c1', 'c2'])
  ok('la nota arriva fino alla riga (serve a chi corregge il testo senza perderla)', prova(() => [di('m2').nota ?? null, di('m1').nota ?? null]), ['Pagato a mano', null])
  ok('un movimento annullato si vede, annullato', prova(() => di('m4').annullato), true)
  ok('gli incassi hanno la loro origine', prova(() => tutte.filter((r) => r.origine !== 'movimento').map((r) => r.origine)), ['ricevuta', 'pagamento'])
  ok('niente va perso: sei movimenti e due incassi', prova(() => tutte.length), 8)
  ok('senza niente, niente', prova(() => m.righeMovimenti([], [], voci)), [])
}

console.log('\n5. il residuo di ogni cassa')
{
  const sole = [casse[0]]
  const base = [riga('e1', 'entrata', '2026-09-10', 4000, 'c1'), riga('u1', 'uscita', '2026-09-12', 2500, 'c1')]
  ok('100,00 + 40,00 − 25,00 = 115,00', prova(() => m.residui(sole, base)), [{ cassaId: 'c1', entrate: 4000, uscite: 2500, residuo: 11500 }])
  ok('senza movimenti c\'è il saldo iniziale', prova(() => m.residui(sole, [])), [{ cassaId: 'c1', entrate: 0, uscite: 0, residuo: 10000 }])
  ok('un incasso prima del «dal» non conta', prova(() => m.residui(sole, [...base, riga('e0', 'entrata', '2026-08-31', 9999, 'c1')])), [{ cassaId: 'c1', entrate: 4000, uscite: 2500, residuo: 11500 }])
  ok('…il giorno del «dal» sì', prova(() => m.residui(sole, [riga('e2', 'entrata', '2026-09-01', 100, 'c1')])), [{ cassaId: 'c1', entrate: 100, uscite: 0, residuo: 10100 }])
  ok('un movimento annullato non conta', prova(() => m.residui(sole, [...base, riga('e3', 'entrata', '2026-09-11', 777, 'c1', { annullato: true }), riga('u3', 'uscita', '2026-09-11', 555, 'c1', { annullato: true })])), [{ cassaId: 'c1', entrate: 4000, uscite: 2500, residuo: 11500 }])
  ok('senza «dal» si conta tutto', prova(() => m.residui([casse[1]], [riga('e4', 'entrata', '2020-01-01', 300, 'c2'), riga('u4', 'uscita', '2026-09-01', 100, 'c2')])), [{ cassaId: 'c2', entrate: 300, uscite: 100, residuo: 200 }])
  ok('un movimento di una cassa che non c\'è non conta', prova(() => m.residui(sole, [riga('e5', 'entrata', '2026-09-10', 5000, 'cX')])), [{ cassaId: 'c1', entrate: 0, uscite: 0, residuo: 10000 }])
  ok('un uscita più grande del residuo lo porta sotto zero, senza fermarsi', prova(() => m.residui(sole, [riga('u5', 'uscita', '2026-09-12', 20000, 'c1')])), [{ cassaId: 'c1', entrate: 0, uscite: 20000, residuo: -10000 }])
  const giro = riga('g1', 'giroconto', '2026-09-15', 1000, 'c1', { cassaAId: 'c2' })
  ok('1000 dai contanti al conto: i contanti calano, il conto cresce, e non sono né entrate né uscite',
    prova(() => m.residui(casse, [...base, giro])),
    [{ cassaId: 'c1', entrate: 4000, uscite: 2500, residuo: 10500 }, { cassaId: 'c2', entrate: 0, uscite: 0, residuo: 1000 }])
  ok('un giroconto annullato non sposta niente', prova(() => m.residui(casse, [...base, { ...giro, annullato: true }])),
    [{ cassaId: 'c1', entrate: 4000, uscite: 2500, residuo: 11500 }, { cassaId: 'c2', entrate: 0, uscite: 0, residuo: 0 }])
  ok('un giroconto all\'indietro (dal conto ai contanti)', prova(() => m.residui(casse, [riga('g2', 'giroconto', '2026-09-16', 300, 'c2', { cassaAId: 'c1' })])),
    [{ cassaId: 'c1', entrate: 0, uscite: 0, residuo: 10300 }, { cassaId: 'c2', entrate: 0, uscite: 0, residuo: -300 }])
  ok('i residui escono nell\'ordine delle casse', prova(() => m.residui([casse[1], casse[0]], []).map((r) => r.cassaId)), ['c2', 'c1'])
}

console.log('\n6. i totali non contano i giroconti né gli annullati')
{
  const righe = [
    riga('e1', 'entrata', '2026-09-10', 4000, 'c1'),
    riga('e2', 'entrata', '2026-09-11', 999, 'c1', { annullato: true }),
    riga('u1', 'uscita', '2026-09-12', 2500, 'c1'),
    riga('u2', 'uscita', '2026-09-12', 888, 'c1', { annullato: true }),
    riga('g1', 'giroconto', '2026-09-15', 1000, 'c1', { cassaAId: 'c2' }),
  ]
  ok('entrate, uscite e differenza', prova(() => m.totali(righe)), { entrate: 4000, uscite: 2500, differenza: 1500 })
  ok('un giroconto da solo non fa niente', prova(() => m.totali([righe[4]])), { entrate: 0, uscite: 0, differenza: 0 })
  ok('senza righe, zero', prova(() => m.totali([])), { entrate: 0, uscite: 0, differenza: 0 })
  ok('si può spendere più di quel che entra', prova(() => m.totali([riga('u1', 'uscita', '2026-09-12', 300, 'c1'), riga('e1', 'entrata', '2026-09-12', 100, 'c1')])), { entrate: 100, uscite: 300, differenza: -200 })
}

console.log('\n7. i filtri')
{
  const a = riga('a', 'entrata', '2026-09-10', 3000, 'c1', { descrizione: 'Rossi Giulia', sotto: 'QUOTA ASSOCIATIVA · Contanti', voce: 'Quota associativa', origine: 'ricevuta' })
  const b = riga('b', 'entrata', '2026-09-12', 1500, 'c2', { descrizione: "D'Amico Zoë", sotto: 'ANNUALE JUDO · Assegno', voce: 'Corsi e altri pagamenti', origine: 'pagamento' })
  const c = riga('c', 'uscita', '2026-09-13', 2500, 'c1', { descrizione: 'Affitto sala di settembre', voce: 'Affitto sala' })
  const d = riga('d', 'giroconto', '2026-09-15', 1000, 'c1', { cassaAId: 'c2', descrizione: 'Giroconto da Cassa Contanti a Conto Corrente' })
  const e = riga('e', 'entrata', '2026-09-11', 300, 'c1', { descrizione: 'Offerta annullata', voce: 'Donazioni', annullato: true })
  const tutte = [a, b, c, d, e]
  const chi = (f) => prova(() => m.filtraMovimenti(tutte, f).map((r) => r.id).join(''))
  ok('senza filtri: tutto tranne gli annullati, nell\'ordine in cui arriva', chi({}), 'abcd')
  ok('con annullati: tutto', chi({ annullati: true }), 'abcde')
  ok('per nome, senza accenti né maiuscole', [chi({ testo: 'zoe' }), chi({ testo: 'ZOË' }), chi({ testo: "d'amico" })], ['b', 'b', 'b'])
  ok('…anche nella riga sotto (la voce e il metodo)', [chi({ testo: 'judo' }), chi({ testo: 'assegno' }), chi({ testo: 'quota' })], ['b', 'b', 'a'])
  ok('…nella descrizione di un movimento a mano', chi({ testo: 'AFFITTO' }), 'c')
  ok('un nome che non c\'è', chi({ testo: 'nessuno' }), '')
  ok('un testo vuoto o di spazi non filtra', [chi({ testo: '' }), chi({ testo: '  ' })], ['abcd', 'abcd'])
  ok('dal e al comprendono i giorni scritti', chi({ dal: '2026-09-12', al: '2026-09-13' }), 'bc')
  ok('dal da solo, al da solo', [chi({ dal: '2026-09-13' }), chi({ al: '2026-09-10' })], ['cd', 'a'])
  ok('per tipo', [chi({ tipo: 'entrata' }), chi({ tipo: 'uscita' }), chi({ tipo: 'giroconto' })], ['ab', 'c', 'd'])
  ok('per cassa: un giroconto è di tutte e due', [chi({ cassaId: 'c1' }), chi({ cassaId: 'c2' })], ['acd', 'bd'])
  ok('per voce', [chi({ voce: 'Affitto sala' }), chi({ voce: 'Quota associativa' })], ['c', 'a'])
  ok('più filtri insieme', chi({ tipo: 'entrata', cassaId: 'c1' }), 'a')
  ok('un annullato con annullati e un filtro', chi({ annullati: true, voce: 'Donazioni' }), 'e')
  ok('non cambia l\'originale', prova(() => { const x = [b, a]; m.filtraMovimenti(x, { testo: 'rossi' }); return x.map((r) => r.id) }), ['b', 'a'])
}

console.log('\n8. i totali per voce')
{
  const righe = [
    riga('1', 'entrata', '2026-09-10', 3000, 'c1', { voce: 'Quota associativa' }),
    riga('2', 'entrata', '2026-09-11', 2000, 'c2', { voce: 'Quota associativa' }),
    riga('3', 'entrata', '2026-09-12', 1500, 'c2', { voce: 'Corsi e altri pagamenti' }),
    riga('4', 'entrata', '2026-09-12', 100, 'c1', { voce: 'Rimborsi' }),
    riga('5', 'uscita', '2026-09-13', 2500, 'c1', { voce: 'Affitto sala' }),
    riga('6', 'uscita', '2026-09-13', 4000, 'c1', { voce: 'Pulizie' }),
    riga('7', 'uscita', '2026-09-14', 50, 'c1', { voce: 'Rimborsi' }),
    riga('8', 'giroconto', '2026-09-15', 1000, 'c1', { cassaAId: 'c2' }),
    riga('9', 'entrata', '2026-09-15', 9999, 'c1', { voce: 'Quota associativa', annullato: true }),
  ]
  ok('entrate poi uscite, ognuna dalla più grossa; stesso nome in tipi diversi sono due voci; niente giroconti né annullati',
    prova(() => m.perVoce(righe)),
    [
      { voce: 'Quota associativa', tipo: 'entrata', totale: 5000 },
      { voce: 'Corsi e altri pagamenti', tipo: 'entrata', totale: 1500 },
      { voce: 'Rimborsi', tipo: 'entrata', totale: 100 },
      { voce: 'Pulizie', tipo: 'uscita', totale: 4000 },
      { voce: 'Affitto sala', tipo: 'uscita', totale: 2500 },
      { voce: 'Rimborsi', tipo: 'uscita', totale: 50 },
    ])
  ok('senza righe, niente', prova(() => m.perVoce([])), [])
  ok('un giroconto da solo non è una voce', prova(() => m.perVoce([righe[7]])), [])
}

console.log('\n9. il foglio per il commercialista')
{
  const righe = [
    riga('1', 'entrata', '2026-09-10', 3000, 'c1', { descrizione: 'Rossi Giulia', voce: 'Quota associativa' }),
    riga('2', 'entrata', '2026-09-12', 123456, 'c2', { descrizione: "D'Amico Zoë", voce: 'Corsi e altri pagamenti' }),
    riga('3', 'uscita', '2026-09-13', 2500, 'c1', { descrizione: 'Affitto sala', voce: 'Affitto sala' }),
    riga('4', 'giroconto', '2026-09-15', 1000, 'c1', { cassaAId: 'c2', descrizione: 'Giroconto da Cassa Contanti a Conto Corrente' }),
    riga('5', 'entrata', '2026-09-16', 999, 'c1', { descrizione: 'Annullata', annullato: true }),
  ]
  const intestazione = 'data;tipo;descrizione;voce;cassa;importo'
  ok('intestazione, data GG/MM/AAAA, importo all\'italiana, ; e \\r\\n, mai gli annullati',
    prova(() => m.csvMovimenti(righe, casse)),
    [
      intestazione,
      '10/09/2026;entrata;Rossi Giulia;Quota associativa;Cassa Contanti;30,00',
      "12/09/2026;entrata;D'Amico Zoë;Corsi e altri pagamenti;Conto Corrente;1.234,56",
      '13/09/2026;uscita;Affitto sala;Affitto sala;Cassa Contanti;25,00',
      '15/09/2026;giroconto;Giroconto da Cassa Contanti a Conto Corrente;;Cassa Contanti → Conto Corrente;10,00',
    ].join('\r\n'))
  ok('senza righe, solo l\'intestazione', prova(() => m.csvMovimenti([], casse)), intestazione)
  ok('di soli annullati, solo l\'intestazione', prova(() => m.csvMovimenti([righe[4]], casse)), intestazione)
  // Solo il campo della descrizione: tolti l'inizio e la fine della riga.
  const una = (descrizione) => prova(() => m.csvMovimenti([riga('x', 'entrata', '2026-09-10', 100, 'c1', { descrizione })], casse).split('\r\n')[1].slice('10/09/2026;entrata;'.length, -';Donazioni;Cassa Contanti;1,00'.length))
  ok('un testo che comincia per = non è una formula', una('=SOMMA(A1)'), "'=SOMMA(A1)")
  ok('…né per + - @', [una('+39 333'), una('-5 euro'), una('@mario')], ["'+39 333", "'-5 euro", "'@mario"])
  ok('un testo con ; e virgolette si racchiude fra virgolette', una('Rossi; "Giulia"'), '"Rossi; ""Giulia"""')
  ok('apostrofo e accenti nel nome restano com\'è', una("D'Amico Zoë Niccolò"), "D'Amico Zoë Niccolò")
}

console.log('\n10. cosa non va in un movimento (gli stessi rifiuti del database)')
{
  const oggi = '2026-09-26'
  const buono = { tipo: 'entrata', data: '2026-09-10', importo: 4000, voceId: 'v-don', cassaId: 'c1', descrizione: 'Offerta di Rossi' }
  const di = (cambio) => prova(() => m.cosaNonVaMovimento({ ...buono, ...cambio }, voci, casse, oggi))
  ok('il caso giusto va', di({}), null)
  ok('con la nota va', di({ nota: 'Pagato a mano' }), null)
  ok('una uscita con una voce di uscita va', di({ tipo: 'uscita', voceId: 'v-aff' }), null)
  ok('oggi va', di({ data: oggi }), null)
  ok('il primo giorno della cassa va', di({ data: '2026-09-01' }), null)
  ok('sul conto, senza «dal», anche prima di settembre', di({ cassaId: 'c2', data: '2026-08-31' }), null)
  ok('diecimila euro tondi vanno', di({ importo: 10_000_000 }), null)
  ok('descrizione di 200 lettere e nota di 300 vanno', di({ descrizione: 'd'.repeat(200), nota: 'n'.repeat(300) }), null)
  const mancano = [
    ['il giroconto non passa da qui', { tipo: 'giroconto' }, 'Scegli se è un’entrata o un’uscita'],
    ['un tipo che non c\'è', { tipo: 'prestito' }, 'Scegli se è un’entrata o un’uscita'],
    ['importo zero', { importo: 0 }, 'L’importo deve essere più di zero'],
    ['importo negativo', { importo: -500 }, 'L’importo deve essere più di zero'],
    ['importo con la virgola', { importo: 12.5 }, 'L’importo non si capisce'],
    ['importo che non è un numero', { importo: Number.NaN }, 'L’importo non si capisce'],
    ['importo oltre i centomila euro', { importo: 10_000_001 }, 'L’importo è troppo alto: controlla le cifre'],
    ['il 30 febbraio', { data: '2026-02-30' }, 'La data non si capisce'],
    ['senza data', { data: '' }, 'La data non si capisce'],
    ['data scritta male', { data: '10/09/2026' }, 'La data non si capisce'],
    ['domani', { data: '2026-09-27' }, 'La data è nel futuro: si registra quel che è già successo'],
    ['senza voce', { voceId: undefined }, 'Scegli la voce'],
    ['una voce che non c\'è', { voceId: 'v-xxx' }, 'Scegli la voce'],
    ['un\'entrata con la voce di un\'uscita', { voceId: 'v-aff' }, 'La voce scelta non va con questo tipo di movimento'],
    ['una uscita con la voce di un\'entrata', { tipo: 'uscita' }, 'La voce scelta non va con questo tipo di movimento'],
    ['una voce non più in uso', { tipo: 'uscita', voceId: 'v-vecchia' }, 'La voce non è più in uso: scegline un’altra'],
    ['senza cassa', { cassaId: '' }, 'Scegli la cassa'],
    ['una cassa che non c\'è', { cassaId: 'cX' }, 'Scegli la cassa'],
    ['il 31 agosto su una cassa che comincia il 1 settembre', { data: '2026-08-31' }, 'La data è prima dell’inizio della cassa'],
    ['descrizione vuota', { descrizione: '   ' }, 'Scrivi una descrizione'],
    ['descrizione di 201 lettere', { descrizione: 'd'.repeat(201) }, 'La descrizione è troppo lunga: al massimo 200 caratteri'],
    ['nota di 301 lettere', { nota: 'n'.repeat(301) }, 'La nota è troppo lunga: al massimo 300 caratteri'],
  ]
  for (const [cosa, cambio, messaggio] of mancano) ok(cosa, di(cambio), messaggio)
}

console.log('\n11. cosa non va in un giroconto')
{
  const oggi = '2026-09-26'
  const buono = { daCassaId: 'c1', aCassaId: 'c2', data: '2026-09-15', importo: 1000 }
  const di = (cambio) => prova(() => m.cosaNonVaGiroconto({ ...buono, ...cambio }, casse, oggi))
  ok('il caso giusto va', di({}), null)
  ok('dal conto ai contanti va', di({ daCassaId: 'c2', aCassaId: 'c1' }), null)
  ok('con la nota va', di({ nota: 'Versamento in banca' }), null)
  const mancano = [
    ['dalla stessa cassa alla stessa', { aCassaId: 'c1' }, 'Scegli due casse diverse'],
    ['una cassa che non c\'è', { aCassaId: 'cX' }, 'Scegli le due casse'],
    ['senza casse', { daCassaId: '', aCassaId: '' }, 'Scegli le due casse'],
    ['importo zero', { importo: 0 }, 'L’importo deve essere più di zero'],
    ['importo con la virgola', { importo: 10.5 }, 'L’importo non si capisce'],
    ['importo troppo alto', { importo: 10_000_001 }, 'L’importo è troppo alto: controlla le cifre'],
    ['data impossibile', { data: '2026-02-30' }, 'La data non si capisce'],
    ['data nel futuro', { data: '2026-09-27' }, 'La data è nel futuro: si registra quel che è già successo'],
    ['prima dell\'inizio della cassa di partenza', { data: '2026-08-31' }, 'La data è prima dell’inizio della cassa'],
    ['prima dell\'inizio della cassa di arrivo', { daCassaId: 'c2', aCassaId: 'c1', data: '2026-08-31' }, 'La data è prima dell’inizio della cassa'],
    ['nota di 301 lettere', { nota: 'n'.repeat(301) }, 'La nota è troppo lunga: al massimo 300 caratteri'],
  ]
  for (const [cosa, cambio, messaggio] of mancano) ok(cosa, di(cambio), messaggio)
}

console.log('\n12. cosa non va in una voce')
{
  const di = (nome, tipo) => prova(() => m.cosaNonVaVoce(nome, tipo, voci))
  ok('una voce nuova va', di('Pulizie', 'uscita'), null)
  ok('con gli spazi intorno va', di('  Pulizie  ', 'uscita'), null)
  ok('sessanta lettere vanno', di('x'.repeat(60), 'entrata'), null)
  ok('lo stesso nome in un altro tipo va', di('Affitto sala', 'entrata'), null)
  ok('nome vuoto', di('', 'entrata'), 'Scrivi il nome della voce')
  ok('nome di soli spazi', di('   ', 'entrata'), 'Scrivi il nome della voce')
  ok('sessantuna lettere', di('x'.repeat(61), 'entrata'), 'Il nome della voce è troppo lungo: al massimo 60 caratteri')
  ok('un tipo che non c\'è', di('Pulizie', 'giroconto'), 'Scegli se è un’entrata o un’uscita')
  ok('senza tipo', di('Pulizie', undefined), 'Scegli se è un’entrata o un’uscita')
  ok('un nome già preso, scritto con altre maiuscole', di('affitto sala', 'uscita'), 'C’è già una voce «affitto sala» tra le uscite')
  ok('…o con uno spazio in più', di('Affitto sala ', 'uscita'), 'C’è già una voce «Affitto sala» tra le uscite')
  ok('anche una voce spenta tiene il suo nome', di('VECCHIA', 'uscita'), 'C’è già una voce «VECCHIA» tra le uscite')
  ok('le voci di sistema: il loro nome è preso', di('quota associativa ', 'entrata'), 'C’è già una voce «quota associativa» tra le entrate')
  ok('…anche «Corsi e altri pagamenti»', di('Corsi e altri pagamenti', 'entrata'), 'C’è già una voce «Corsi e altri pagamenti» tra le entrate')
  ok('rinominando una voce, la si toglie dall\'elenco e il suo nome si può riscrivere con altre maiuscole', prova(() => m.cosaNonVaVoce('AFFITTO SALA', 'uscita', voci.filter((v) => v.id !== 'v-aff'))), null)
}

console.log('\n13. cosa non va nel saldo iniziale')
{
  const di = (saldo, dal) => prova(() => m.cosaNonVaSaldo(saldo, dal))
  ok('saldo e data vanno', di(10000, '2026-09-01'), null)
  ok('saldo zero va', di(0, '2026-09-01'), null)
  ok('senza data (si conta tutto) va', [di(0, undefined), di(0, ''), di(500, null)], [null, null, null])
  ok('saldo negativo', di(-100, '2026-09-01'), 'Il saldo iniziale non può essere negativo')
  ok('saldo con la virgola', di(10.5, '2026-09-01'), 'Il saldo iniziale non si capisce')
  ok('saldo che non è un numero', di(Number.NaN, '2026-09-01'), 'Il saldo iniziale non si capisce')
  ok('data impossibile', di(0, '2026-02-30'), 'La data non si capisce')
  ok('data scritta male', di(0, '1 settembre'), 'La data non si capisce')
  const con = (dal, extra) => prova(() => m.cosaNonVaSaldo(0, dal, { oggi: '2026-10-17', primoMovimento: '2026-09-10', ...extra }))
  ok('l\'inizio della cassa nel futuro no', con('2026-10-18'), 'L’inizio della cassa non può essere nel futuro')
  ok('…oggi sì', con('2026-09-10'), null)
  ok('un movimento già registrato prima di quella data no: il saldo lo ignorerebbe in silenzio', con('2026-09-11'), 'Ci sono movimenti prima di quella data: annullali o scegli una data più vecchia')
  ok('…il giorno stesso del movimento sì', con('2026-09-10'), null)
  ok('senza movimenti a mano qualunque data va', con('2026-10-17', { primoMovimento: undefined }), null)
  ok('senza data si conta tutto, movimenti compresi', con('', {}), null)
  ok('un saldo scritto negativo dice «negativo», non «non si capisce»', prova(() => m.cosaNonVaSaldoTesto('-5', null)), 'Il saldo iniziale non può essere negativo')
  ok('un testo che non è un numero', prova(() => m.cosaNonVaSaldoTesto('abc', null)), 'Il saldo non si capisce: scrivi un numero, per esempio 500,00.')
  ok('un saldo scritto bene va', prova(() => m.cosaNonVaSaldoTesto('500,50', '2026-09-01')), null)
  ok('l\'inizio della cassa nel 1999 no, come una data di movimento', di(0, '1999-12-31'), 'La data non si capisce')
  const rr = [
    riga('a', 'entrata', '2026-09-10', 100, 'c1'),
    riga('b', 'entrata', '2026-08-01', 100, 'c1', { annullato: true }),
    riga('c', 'giroconto', '2026-09-05', 100, 'c2', { cassaAId: 'c1' }),
    riga('d', 'entrata', '2026-01-01', 100, 'c1', { origine: 'ricevuta' }),
  ]
  ok('il primo movimento a mano di una cassa: non gli annullati, non gli incassi, anche come seconda cassa di un giroconto', prova(() => [m.primoMovimentoManuale(rr, 'c1'), m.primoMovimentoManuale(rr, 'c2'), m.primoMovimentoManuale(rr, 'cX')]), ['2026-09-05', '2026-09-05', undefined])
}

console.log('\n14. i casi al bordo, detti come fa il database')
{
  const base = { tipo: 'entrata', data: '2026-09-10', importo: 100, voceId: 'v-don', cassaId: 'c2', descrizione: 'Offerta' }
  const oggi = '2026-10-17'
  const di = (extra) => prova(() => m.cosaNonVaMovimento({ ...base, ...extra }, voci, casse, oggi))
  ok('una nota di 300 lettere con spazi ai bordi va: il database la ripulisce prima di contarla', di({ nota: `  ${'n'.repeat(300)}  ` }), null)
  ok('una data di secoli fa no', di({ data: '1999-12-31' }), 'La data non si capisce')
  ok('il primo giorno del 2000 sì', di({ data: '2000-01-01' }), null)
  ok('un saldo di un milione di euro va', prova(() => m.cosaNonVaSaldo(100_000_000, null)), null)
  ok('…di più no', prova(() => m.cosaNonVaSaldo(100_000_001, null)), 'Il saldo iniziale è troppo alto: controlla le cifre')
}

console.log('\n15. l\'importo scritto a mano, e il giorno di Roma')
{
  const di = (testo, esempio = '40,00') => prova(() => m.cosaNonVaImporto(testo, esempio))
  ok('vuoto: non è ancora un errore', di(''), null)
  ok('un numero va', [di('40,00'), di('12,5'), di('7')], [null, null, null])
  ok('un testo no, e dice come scriverlo', di('abc'), 'L’importo non si capisce: scrivi un numero, per esempio 40,00.')
  ok('…con l\'esempio che serve alla schermata', di('abc', '1000,00'), 'L’importo non si capisce: scrivi un numero, per esempio 1000,00.')
  ok('alle 23:30 UTC d\'autunno a Roma è già il giorno dopo', prova(() => m.oggiARoma(new Date('2026-10-17T22:30:00Z'))), '2026-10-18')
  ok('a mezzogiorno è lo stesso giorno', prova(() => m.oggiARoma(new Date('2026-10-17T10:00:00Z'))), '2026-10-17')
  ok('d\'estate l\'ora legale sposta il confine alle 22:00 UTC', prova(() => [m.oggiARoma(new Date('2026-07-10T21:59:00Z')), m.oggiARoma(new Date('2026-07-10T22:00:00Z'))]), ['2026-07-10', '2026-07-11'])
}

console.log('\n16. l\'elenco dei movimenti, messo insieme dalla lib')
{
  const r12 = ricevuta(40, 'Giulia', 'Rossi', [voce('QUOTA ASSOCIATIVA', 5000, [pag('2026-09-10', 3000)])])
  const aMano = diretto('d9', 'p-Bianchi', '2026-09-12', 1500, { metodo: 'Assegno', voce: 'ANNUALE JUDO' })
  const manuali = [{ id: 'm9', tipo: 'uscita', data: '2026-09-11', importo: 2500, voceId: 'v-aff', cassaId: 'c1', descrizione: 'Affitto', creatoIl: '2026-09-11T10:00:00Z' }]
  const nomi = [{ id: 'p-Bianchi', nome: 'Zoë', cognome: "D'Amico" }]
  const elenco = prova(() => m.elencoMovimenti([r12], [aMano], nomi, casse, manuali, voci))
  ok('incassi e movimenti, dal più recente, col nome di chi ha pagato a mano', prova(() => elenco.map((r) => `${r.data} ${r.descrizione}`)), ["2026-09-12 D'Amico Zoë", '2026-09-11 Affitto', '2026-09-10 Rossi Giulia'])
  ok('un nome che non si trova è un trattino', prova(() => m.elencoMovimenti([], [aMano], [], casse, [], voci).map((r) => r.descrizione)), ['—'])
  ok('senza incassi restano i movimenti a mano', prova(() => m.elencoMovimenti([], [], [], casse, manuali, voci).map((r) => r.descrizione)), ['Affitto'])
  ok('quante volte è usata una voce, senza gli annullati', prova(() => [
    m.quanteUsate([...elenco, riga('m10', 'uscita', '2026-09-14', 100, 'c1', { voce: 'Affitto sala', annullato: true })], voci[3]),
    m.quanteUsate(elenco, voci[2]),
  ]), [1, 0])
  ok('il totale dei residui', prova(() => m.totaleResidui(m.residui(casse, elenco))), 10000 + 3000 + 1500 - 2500)
}

// ---------------------------------------------------------------------------
// La chiusura di cassa (60-chiusura-cassa.sql, provato da supabase/prova/chiusura-cassa.sql):
// le stesse regole, con gli stessi messaggi e gli stessi numeri.
// ---------------------------------------------------------------------------
const vociD = [
  ...voci,
  { id: 'v-dife', nome: 'Differenza di cassa', tipo: 'entrata', diSistema: true, attiva: true },
  { id: 'v-difu', nome: 'Differenza di cassa', tipo: 'uscita', diSistema: true, attiva: true },
]
const man = (id, tipo, data, importo, cassaId, extra = {}) => ({
  id, tipo, data, importo, cassaId, descrizione: id, creatoIl: `${data}T10:00:00Z`,
  ...(tipo === 'giroconto' ? {} : { voceId: tipo === 'entrata' ? 'v-don' : 'v-aff' }),
  ...extra,
})
// Una chiusura già fatta, della Cassa Contanti.
const chiusa = (id, data, extra = {}) => ({ id, cassaId: 'c1', dal: '2026-09-01', data, previsto: 10000, contato: 9500, differenza: -500, chiusaDa: 'Ada Conti', chiusaIl: `${data}T18:00:00Z`, ...extra })
const MSG_CHIUSO = 'Quel giorno è già chiuso: per correggere scrivi il movimento con una data dopo la chiusura e una voce di rettifica (si crea in VOCI), oppure annulla la chiusura'
const MSG_ANNULLA_CHIUSO = 'Quel giorno è già chiuso: annulla prima la chiusura, o scrivi una rettifica con una data dopo la chiusura'
const MSG_SALDO_CHIUSA = 'La cassa ha una chiusura: annullala prima di cambiare il saldo iniziale'

// Il dataset del previsto è lo STESSO di supabase/prova/chiusura-cassa.sql (sezione 2): se cambia là, cambia qui.
//   Cassa Contanti dal 2026-09-01, saldo iniziale 100,00
//   + ricevuta contanti 30,00 (3/9); − uscita a mano 10,00 (4/9); − giroconto 20,00 da Contanti a Conto (5/9)
//   non contano: ricevuta POS 50,00, ricevuta contanti 40,00 ANNULLATA, uscita 44,44 annullata, entrata 7,00 sul Conto
//   all'8/9: + pagamento a mano «  contanti» 20,00 + 15,00 in contanti di una ricevuta (voce a «CONTANTI »)
//     non contano: bonifico 10,00 della stessa ricevuta, anticipo 50,00, «pagato fino al», assegno 7,00, contanti 9,00 annullato
//   al 20/9: + 8,88 (ricevuta contanti); non contano 7,77 (31/8, prima del «dal») e 9,99 (25/9, dopo)
// `cambi`: annullaR6, annullaD1 (annullati dopo la chiusura), diff1 e diff2 (i movimenti di differenza delle chiusure del 7 e del 20).
const datiPrevisto = (cambi = {}) => {
  const rcv = (numero, vv, extra = {}) => ricevuta(numero, 'Luca', 'Rossi', vv, extra)
  const annullata = { annullataIl: '2026-09-26T10:00:00Z' }
  const ricevute = [
    rcv(1, [voce('QUOTA ASSOCIATIVA', 3000, [pag('2026-09-03', 3000)])]),
    rcv(2, [voce('ANNUALE JUDO', 5000, [pag('2026-09-03', 5000, 'POS')])]),
    rcv(3, [voce('ANNUALE JUDO', 4000, [pag('2026-09-03', 4000)])], annullata),
    rcv(4, [
      voce('TRIMESTRE KARATE', 3000, [pag('2026-09-08', 1500, 'CONTANTI ')]),
      voce('QUOTA ASSOCIATIVA', 1000, [pag('2026-09-08', 1000, 'Bonifico')]),
      voce('ANNUALE JUDO', 8000, [], 1, { dal: '2026-09-01', al: '2027-07-31' }),
    ], { anticipo: 5000 }),
    rcv(5, [voce('ALTRO', 777, [pag('2026-08-31', 777)])]),
    rcv(6, [voce('ALTRO', 888, [pag('2026-09-20', 888, 'contanti')])], cambi.annullaR6 ? annullata : {}),
    rcv(7, [voce('ALTRO', 999, [pag('2026-09-25', 999)])]),
    // FANNE LA RICEVUTA del pagamento a mano dd1: gli stessi 20,00 in contanti dell'8, nella ricevuta.
    ...(cambi.dd1Ricevuta ? [rcv(8, [voce('ALTRO', 2000, [pag('2026-09-08', 2000, 'Contanti')])])] : []),
  ]
  const diretti = [
    diretto('dd1', 'p-Rossi', '2026-09-08', 2000, { metodo: '  contanti', ...(cambi.annullaD1 ? { annullatoIl: '2026-09-26T10:00:00Z' } : {}), ...(cambi.dd1Ricevuta ? { annullatoIl: '2026-09-26T10:00:00Z', ricevutaId: 'r8' } : {}) }),
    diretto('dd2', 'p-Rossi', '2026-09-08', 700, { metodo: 'Assegno' }),
    diretto('dd3', 'p-Rossi', '2026-09-08', 900, { annullatoIl: '2026-09-09T10:00:00Z' }),
  ]
  const manuali = [
    man('u1', 'uscita', '2026-09-04', 1000, 'c1'),
    man('u2', 'uscita', '2026-09-04', 4444, 'c1', { annullatoIl: '2026-09-04T12:00:00Z' }),
    man('e1', 'entrata', '2026-09-05', 700, 'c2'),
    man('g1', 'giroconto', '2026-09-05', 2000, 'c1', { cassaAId: 'c2' }),
    ...(cambi.diff1 ? [man('mdiff1', 'uscita', '2026-09-07', 500, 'c1', { voceId: 'v-difu' })] : []),
    ...(cambi.diff2 ? [man('mdiff2', 'entrata', '2026-09-20', 300, 'c1', { voceId: 'v-dife' })] : []),
  ]
  return m.elencoMovimenti(ricevute, diretti, [{ id: 'p-Rossi', nome: 'Luca', cognome: 'Rossi' }], casse, manuali, vociD)
}

console.log('\n17. le due costanti della chiusura')
// «Annulla tutta l'importazione» riconosce il lotto dall'istante di scrittura: solo le righe della banca (e della chat) lo portano.
{
  const base = { tipo: 'entrata', data: '2026-09-05', importo: 100, voceId: 'v-don', cassaId: 'c2', descrizione: 'x', creatoIl: '2026-09-05T10:00:00.123Z' }
  const r = m.righeMovimenti([], [{ ...base, id: 'b1', origineImport: 'banca:1' }, { ...base, id: 'b2' }], voci)
  ok('solo la riga della banca porta creatoIl', r.sort((a, b) => a.id.localeCompare(b.id)).map((x) => x.creatoIl ?? null), ['2026-09-05T10:00:00.123Z', null])
}
ok('la voce della differenza', prova(() => m.VOCE_DIFFERENZA), 'Differenza di cassa')
ok('sopra venti euro la schermata chiede conferma', prova(() => m.SOGLIA_DIFFERENZA), 2000)

console.log('\n18. il previsto di cassa: lo stesso numero del database')
{
  const righe = prova(() => datiPrevisto())
  const al = (giorno, r = righe) => prova(() => m.previstoCassa(casse, r, 'c1', giorno))
  ok('al 7 settembre: 100,00 + 30,00 − 10,00 − 20,00', al('2026-09-07'), 10000)
  ok('all\'8: + 20,00 a mano + 15,00 in contanti della ricevuta', al('2026-09-08'), 13500)
  ok('al 20: + 8,88', al('2026-09-20'), 14388)
  ok('fino al 24, prima dei 9,99 del 25: lo stesso', al('2026-09-24'), 14388)
  ok('il 25 entrano i 9,99', al('2026-09-25'), 15387)
  ok('il 3: solo i 30,00 della ricevuta', al('2026-09-03'), 13000)
  ok('il pagamento a mano diventato ricevuta: il previsto dell\'8 non cambia', al('2026-09-08', prova(() => datiPrevisto({ dd1Ricevuta: true }))), 13500)
  const con = prova(() => datiPrevisto({ diff1: true, diff2: true }))
  ok('la differenza di una chiusura (−5,00 il 7) conta: a fine giorno in cassa c\'è quel che si è contato', al('2026-09-07', con), 9500)
  ok('…e il +3,00 del 20: 143,88 − 5,00 + 3,00 = 141,88', al('2026-09-20', con), 14188)
  ok('senza righe c\'è il saldo iniziale', prova(() => m.previstoCassa(casse, [], 'c1', '2026-09-07')), 10000)
  ok('non cambia le righe che riceve', prova(() => { const x = [...righe]; m.previstoCassa(casse, x, 'c1', '2026-09-20'); return x.map((r) => r.id) }), prova(() => righe.map((r) => r.id)))
}

console.log('\n19. l\'ultima chiusura e i giorni chiusi')
{
  const c7 = chiusa('k7', '2026-09-07')
  const c20 = chiusa('k20', '2026-09-20')
  const c22 = chiusa('k22', '2026-09-22', { annullataIl: '2026-09-23T10:00:00Z' })
  const conto = chiusa('kc', '2026-09-30', { cassaId: 'c2' })
  const tutte = [c20, c7, c22, conto]
  ok('l\'ultima è quella con la data più grande tra le attive', prova(() => m.ultimaChiusura(tutte, 'c1')?.id), 'k20')
  ok('…qualunque sia l\'ordine', prova(() => m.ultimaChiusura([...tutte].reverse(), 'c1')?.id), 'k20')
  ok('ogni cassa ha la sua', prova(() => m.ultimaChiusura(tutte, 'c2')?.id), 'kc')
  ok('un\'annullata non è l\'ultima', prova(() => m.ultimaChiusura([c7, c22], 'c1')?.id), 'k7')
  ok('senza chiusure attive, niente', prova(() => [m.ultimaChiusura([], 'c1'), m.ultimaChiusura([c22], 'c1'), m.ultimaChiusura([conto], 'c1')].map((x) => x ?? null)), [null, null, null])
  const chiuso = (cassaIds, data, lista = [c7]) => prova(() => m.giornoChiuso(lista, cassaIds, data))
  ok('il giorno della chiusura è chiuso', chiuso(['c1'], '2026-09-07'), true)
  ok('…e quelli di prima', chiuso(['c1'], '2026-09-03'), true)
  ok('…il giorno dopo no', chiuso(['c1'], '2026-09-08'), false)
  ok('il Conto Corrente non è chiuso', chiuso(['c2'], '2026-09-03'), false)
  ok('un giroconto è chiuso se lo è una delle due casse', [chiuso(['c2', 'c1'], '2026-09-05'), chiuso(['c1', 'c2'], '2026-09-05'), chiuso(['c2', 'c2'], '2026-09-05')], [true, true, false])
  ok('una chiusura annullata riapre i giorni', chiuso(['c1'], '2026-09-03', [{ ...c7, annullataIl: '2026-09-08T10:00:00Z' }]), false)
  ok('senza chiusure niente è chiuso', chiuso(['c1'], '2026-09-03', []), false)
}

console.log('\n20. cosa non va in una chiusura (gli stessi rifiuti del database, nello stesso ordine)')
{
  const oggi = '2026-09-26'
  const buono = { cassaId: 'c1', data: '2026-09-07', contato: 9500 }
  const di = (cambio, chiusure = []) => prova(() => m.cosaNonVaChiusura({ ...buono, ...cambio }, casse, chiusure, oggi))
  ok('il caso giusto va', di({}), null)
  ok('con la nota va', di({ nota: 'Contati in cassa' }), null)
  ok('nota di 300 lettere, con spazi ai bordi, va', di({ nota: ` ${'n'.repeat(300)} ` }), null)
  ok('zero contanti vanno: la cassa può essere vuota', di({ contato: 0 }), null)
  ok('oggi va', di({ data: oggi }), null)
  ok('il primo giorno della cassa va', di({ data: '2026-09-01' }), null)
  ok('dopo l\'ultima chiusura va', di({ data: '2026-09-08' }, [chiusa('k7', '2026-09-07')]), null)
  ok('una chiusura annullata non pesa', di({ data: '2026-09-10' }, [chiusa('k7', '2026-09-07'), chiusa('k20', '2026-09-20', { annullataIl: '2026-09-21T10:00:00Z' })]), null)
  const mancano = [
    ['senza cassa', { cassaId: '' }, 'Scegli la cassa'],
    ['una cassa che non c\'è', { cassaId: 'cX' }, 'Scegli la cassa'],
    ['il Conto Corrente non si chiude', { cassaId: 'c2' }, 'Si chiude solo la Cassa Contanti'],
    ['…prima di guardare la data', { cassaId: 'c2', data: '2026-02-30' }, 'Si chiude solo la Cassa Contanti'],
    ['il 30 febbraio', { data: '2026-02-30' }, 'La data non si capisce'],
    ['senza data', { data: '' }, 'La data non si capisce'],
    ['data scritta male', { data: '07/09/2026' }, 'La data non si capisce'],
    ['una data di secoli fa', { data: '1999-12-31' }, 'La data non si capisce'],
    ['domani', { data: '2026-09-27' }, 'La data è nel futuro: si chiude quel che è già successo'],
    ['il 31 agosto, prima dell\'inizio della cassa', { data: '2026-08-31' }, 'La data è prima dell’inizio della cassa'],
    ['…la data prima dei contanti', { data: '2026-02-30', contato: -5 }, 'La data non si capisce'],
    ['contanti con la virgola', { contato: 95.5 }, 'I contanti contati non si capiscono'],
    ['contanti che non sono un numero', { contato: Number.NaN }, 'I contanti contati non si capiscono'],
    ['senza contanti', { contato: undefined }, 'I contanti contati non si capiscono'],
    ['contanti negativi', { contato: -1 }, 'I contanti contati non possono essere negativi'],
    ['contanti oltre un milione di euro', { contato: 100_000_001 }, 'I contanti contati sono troppi: controlla le cifre'],
    ['nota di 301 lettere', { nota: 'n'.repeat(301) }, 'La nota è troppo lunga: al massimo 300 caratteri'],
    ['…dopo i contanti', { contato: -1, nota: 'n'.repeat(301) }, 'I contanti contati non possono essere negativi'],
  ]
  for (const [cosa, cambio, messaggio] of mancano) ok(cosa, di(cambio), messaggio)
  const k7 = chiusa('k7', '2026-09-07')
  ok('il giorno dell\'ultima chiusura è già chiuso, e dice da quando si può', di({ data: '2026-09-07' }, [k7]), 'Quel giorno è già chiuso: scegli un giorno dopo il 07/09/2026')
  ok('…anche un giorno prima', di({ data: '2026-09-03' }, [k7]), 'Quel giorno è già chiuso: scegli un giorno dopo il 07/09/2026')
  ok('…con due chiusure vale l\'ultima', di({ data: '2026-09-10' }, [k7, chiusa('k20', '2026-09-20')]), 'Quel giorno è già chiuso: scegli un giorno dopo il 20/09/2026')
  ok('…e vale in qualunque ordine', di({ data: '2026-09-10' }, [chiusa('k20', '2026-09-20'), k7]), 'Quel giorno è già chiuso: scegli un giorno dopo il 20/09/2026')
  ok('una data impossibile vince su una chiusura', di({ data: '2026-02-30' }, [k7]), 'La data non si capisce')
  ok('una chiusura del Conto non pesa sui contanti', di({ data: '2026-09-10' }, [chiusa('kc', '2026-09-30', { cassaId: 'c2' })]), null)
}

console.log('\n21. quanto sono tornati i conti, e annullare una chiusura')
{
  ok('zero: tornano', prova(() => m.differenzaInParole(0)), 'tornano')
  ok('cinque euro in più', prova(() => m.differenzaInParole(500)), '5,00 € in più')
  ok('cinque euro in meno', prova(() => m.differenzaInParole(-500)), '5,00 € in meno')
  ok('un centesimo', prova(() => [m.differenzaInParole(1), m.differenzaInParole(-1)]), ['0,01 € in più', '0,01 € in meno'])
  ok('le migliaia all\'italiana', prova(() => m.differenzaInParole(123456)), '1.234,56 € in più')
  const k7 = chiusa('k7', '2026-09-07')
  const k20 = chiusa('k20', '2026-09-20')
  const di = (id, lista) => prova(() => m.cosaNonVaAnnulloChiusura(id, lista))
  ok('l\'ultima si annulla', di('k20', [k7, k20]), null)
  ok('l\'unica pure', di('k7', [k7]), null)
  ok('una che non c\'è', di('zz', [k7, k20]), 'La chiusura non c’è')
  ok('senza id', di('', [k7, k20]), 'La chiusura non c’è')
  ok('una che non è l\'ultima no', di('k7', [k7, k20]), 'Si annulla solo l’ultima chiusura della cassa')
  ok('…in qualunque ordine', di('k7', [k20, k7]), 'Si annulla solo l’ultima chiusura della cassa')
  ok('una già annullata', di('k20', [k7, { ...k20, annullataIl: '2026-09-21T10:00:00Z' }]), 'La chiusura è già annullata')
  ok('…e allora l\'altra diventa l\'ultima', di('k7', [k7, { ...k20, annullataIl: '2026-09-21T10:00:00Z' }]), null)
  ok('ogni cassa ha la sua ultima', di('k7', [k7, chiusa('kc', '2026-09-30', { cassaId: 'c2' })]), null)
}

console.log('\n22. ricevute e pagamenti annullati dopo la chiusura: l\'app avvisa')
{
  const k7 = chiusa('k7', '2026-09-07', { previsto: 10000, movimentoId: 'mdiff1' })
  const k20 = chiusa('k20', '2026-09-20', { dal: '2026-09-08', previsto: 13888, contato: 14188, differenza: 300, movimentoId: 'mdiff2' })
  const k22 = chiusa('k22', '2026-09-22', { dal: '2026-09-21', previsto: 14188, contato: 14188, differenza: 0 })
  const casi = (cambi) => {
    const righe = prova(() => datiPrevisto({ diff1: true, diff2: true, ...cambi }))
    return prova(() => [k7, k20, k22].map((k) => m.chiusuraNonPiuInRegola(k, casse, righe)))
  }
  ok('com\'erano, le chiusure sono in regola (il movimento di differenza non conta nel ricalcolo)', casi({}), [false, false, false])
  ok('una ricevuta del 20 annullata: la chiusura del 20 e quella del 22 non tornano più, quella del 7 sì', casi({ annullaR6: true }), [false, true, true])
  ok('un pagamento a mano dell\'8 annullato: idem', casi({ annullaD1: true }), [false, true, true])
  const righe = prova(() => datiPrevisto({ diff1: true, diff2: true, annullaR6: true }))
  ok('una chiusura annullata non avvisa', prova(() => m.chiusuraNonPiuInRegola({ ...k20, annullataIl: '2026-09-21T10:00:00Z' }, casse, righe)), false)
}

console.log('\n23. un movimento in un giorno chiuso, o la «Differenza di cassa» scritta a mano')
{
  const oggi = '2026-10-17'
  const k20 = chiusa('k20', '2026-09-20')
  const buono = { tipo: 'entrata', data: '2026-09-10', importo: 4000, voceId: 'v-don', cassaId: 'c1', descrizione: 'Offerta di Rossi' }
  const di = (cambio, chiusure = [k20]) => prova(() => m.cosaNonVaMovimento({ ...buono, ...cambio }, vociD, casse, oggi, chiusure))
  ok('senza chiusure va com\'era', prova(() => m.cosaNonVaMovimento(buono, vociD, casse, oggi)), null)
  ok('…anche con l\'elenco vuoto', prova(() => m.cosaNonVaMovimento(buono, vociD, casse, oggi, [])), null)
  ok('il giorno dopo la chiusura va', di({ data: '2026-09-21' }), null)
  ok('sul conto, che non è chiuso, va', di({ cassaId: 'c2' }), null)
  ok('una chiusura annullata non chiude', di({}, [{ ...k20, annullataIl: '2026-09-21T10:00:00Z' }]), null)
  ok('un giorno prima della chiusura no', di({}), MSG_CHIUSO)
  ok('il giorno stesso no', di({ data: '2026-09-20' }), MSG_CHIUSO)
  ok('una uscita nemmeno', di({ tipo: 'uscita', voceId: 'v-aff' }), MSG_CHIUSO)
  ok('l\'inizio della cassa viene prima del giorno chiuso', di({ data: '2026-08-31' }), 'La data è prima dell’inizio della cassa')
  ok('una cassa che non c\'è viene prima', di({ cassaId: 'cX' }), 'Scegli la cassa')
  ok('l\'importo viene prima', di({ importo: 0 }), 'L’importo deve essere più di zero')
  ok('il giorno chiuso viene prima della descrizione', di({ descrizione: '   ' }), MSG_CHIUSO)
  const DIFF = 'La «Differenza di cassa» si scrive da sola chiudendo la cassa'
  ok('«Differenza di cassa» in entrata a mano no', di({ voceId: 'v-dife', cassaId: 'c2' }), DIFF)
  ok('…e in uscita', di({ tipo: 'uscita', voceId: 'v-difu', cassaId: 'c2' }), DIFF)
  ok('…anche senza chiusure', prova(() => m.cosaNonVaMovimento({ ...buono, voceId: 'v-dife' }, vociD, casse, oggi)), DIFF)
  ok('prima si guarda se la voce va col tipo', di({ voceId: 'v-difu', cassaId: 'c2' }), 'La voce scelta non va con questo tipo di movimento')
  ok('prima si guarda se la voce è in uso', prova(() => m.cosaNonVaMovimento({ ...buono, voceId: 'v-dife', cassaId: 'c2' }, vociD.map((v) => (v.id === 'v-dife' ? { ...v, attiva: false } : v)), casse, oggi, [])), 'La voce non è più in uso: scegline un’altra')
  // Il giroconto: basta una delle due casse.
  const giro = { daCassaId: 'c1', aCassaId: 'c2', data: '2026-09-15', importo: 1000 }
  const g = (cambio, chiusure = [k20]) => prova(() => m.cosaNonVaGiroconto({ ...giro, ...cambio }, casse, oggi, chiusure))
  ok('un giroconto senza chiusure va com\'era', prova(() => m.cosaNonVaGiroconto(giro, casse, oggi)), null)
  ok('dopo la chiusura va', g({ data: '2026-09-21' }), null)
  ok('prima no', g({}), MSG_CHIUSO)
  ok('…nemmeno all\'indietro, dal conto ai contanti', g({ daCassaId: 'c2', aCassaId: 'c1' }), MSG_CHIUSO)
  ok('una chiusura annullata non chiude', g({}, [{ ...k20, annullataIl: '2026-09-21T10:00:00Z' }]), null)
  ok('l\'inizio della cassa viene prima', g({ data: '2026-08-31' }), 'La data è prima dell’inizio della cassa')
  ok('l\'importo viene prima', g({ importo: 0 }), 'L’importo deve essere più di zero')
  ok('le casse vengono prima', g({ aCassaId: 'c1' }), 'Scegli due casse diverse')
}

console.log('\n24. annullare un movimento di un giorno chiuso, il saldo di una cassa chiusa, le voci da offrire')
{
  const k7 = chiusa('k7', '2026-09-07')
  const mano = (id, data, extra = {}) => riga(id, 'uscita', data, 1000, 'c1', extra)
  const di = (r, chiusure = [k7]) => prova(() => m.cosaNonVaAnnulloMovimento(r, chiusure))
  ok('un movimento di un giorno chiuso no', di(mano('a', '2026-09-04')), MSG_ANNULLA_CHIUSO)
  ok('…il giorno stesso', di(mano('a', '2026-09-07')), MSG_ANNULLA_CHIUSO)
  ok('…nemmeno quello di differenza', di(mano('d', '2026-09-07', { voce: 'Differenza di cassa' })), MSG_ANNULLA_CHIUSO)
  ok('dopo la chiusura sì', di(mano('a', '2026-09-08')), null)
  ok('sul conto sì', di(riga('c', 'entrata', '2026-09-04', 100, 'c2')), null)
  ok('un giroconto con una cassa chiusa no', di(riga('g', 'giroconto', '2026-09-05', 100, 'c2', { cassaAId: 'c1' })), MSG_ANNULLA_CHIUSO)
  ok('…un giroconto fra casse aperte sì', di(riga('g', 'giroconto', '2026-09-05', 100, 'c2', { cassaAId: 'c3' })), null)
  ok('con la chiusura annullata sì', di(mano('a', '2026-09-04'), [{ ...k7, annullataIl: '2026-09-08T10:00:00Z' }]), null)
  ok('senza chiusure sì', di(mano('a', '2026-09-04'), []), null)
  ok('un incasso di un iscritto si annulla dalle ricevute: qui non lo ferma', di(mano('r', '2026-09-04', { origine: 'ricevuta' })), null)
  const con = (saldo, dal, contesto) => prova(() => m.cosaNonVaSaldo(saldo, dal, contesto))
  const ctx = { oggi: '2026-10-17', chiusa: true }
  ok('il saldo di una cassa chiusa no', con(10000, '2026-09-01', ctx), MSG_SALDO_CHIUSA)
  ok('…anche senza data', con(10000, null, ctx), MSG_SALDO_CHIUSA)
  ok('…prima di ogni altro controllo (saldo negativo)', con(-5, '2026-09-01', ctx), MSG_SALDO_CHIUSA)
  ok('…(saldo con la virgola)', con(10.5, null, ctx), MSG_SALDO_CHIUSA)
  ok('…(data impossibile)', con(0, '2026-02-30', ctx), MSG_SALDO_CHIUSA)
  ok('non chiusa va com\'era', [con(10000, '2026-09-01', { oggi: '2026-10-17', chiusa: false }), con(-5, null, { oggi: '2026-10-17', chiusa: false })], [null, 'Il saldo iniziale non può essere negativo'])
  ok('senza contesto va com\'era', con(10000, '2026-09-01'), null)
  // Nel «Nuovo movimento» la differenza non si offre.
  const nomi = (tipo) => prova(() => m.vociOfferte(vociD, tipo).map((v) => v.nome))
  ok('le entrate da offrire: attive, senza la differenza, in ordine', nomi('entrata'), ['Corsi e altri pagamenti', 'Donazioni', 'Quota associativa'])
  ok('le uscite: senza la differenza e senza le voci spente', nomi('uscita'), ['Affitto sala'])
  ok('l\'elenco delle voci non cambia', prova(() => { m.vociOfferte(vociD, 'entrata'); return vociD.length }), 7)
}

console.log('\n25. le piccole regole della schermata di chiusura, in lib dove si provano')
{
  const contanti = { id: 'c1', nome: 'Cassa Contanti', saldoIniziale: 10000, dal: '2026-09-01' }
  const senzaDal = { id: 'c1', nome: 'Cassa Contanti', saldoIniziale: 0 }
  ok('il periodo parte dal giorno dopo l\'ultima chiusura', prova(() => m.dalDellaChiusura(contanti, chiusa('k', '2026-09-30'))), '2026-10-01')
  ok('…anche a cavallo dell\'anno e di febbraio', prova(() => [m.dalDellaChiusura(contanti, chiusa('k', '2026-12-31')), m.dalDellaChiusura(contanti, chiusa('k', '2028-02-28'))]), ['2027-01-01', '2028-02-29'])
  ok('senza chiusure parte dall\'inizio della cassa', prova(() => m.dalDellaChiusura(contanti, undefined)), '2026-09-01')
  ok('…e senza nemmeno quello, dal 2000', prova(() => m.dalDellaChiusura(senzaDal, undefined)), '2000-01-01')
  ok('giusto fino a 20,00 la differenza non chiede conferma', prova(() => [m.serveConfermaDifferenza(0), m.serveConfermaDifferenza(2000), m.serveConfermaDifferenza(-2000)]), [false, false, false])
  ok('sopra 20,00, in più o in meno, sì', prova(() => [m.serveConfermaDifferenza(2001), m.serveConfermaDifferenza(-2001)]), [true, true])
  ok('il segno di una riga per la cassa: entrata +, uscita −, versamento che arriva +, che parte −', prova(() => [
    m.importoPerCassa(riga('e', 'entrata', '2026-09-10', 300, 'c1'), 'c1'),
    m.importoPerCassa(riga('u', 'uscita', '2026-09-10', 300, 'c1'), 'c1'),
    m.importoPerCassa(riga('g', 'giroconto', '2026-09-10', 300, 'c2', { cassaAId: 'c1' }), 'c1'),
    m.importoPerCassa(riga('g', 'giroconto', '2026-09-10', 300, 'c1', { cassaAId: 'c2' }), 'c1'),
  ]), [300, -300, 300, -300])
  ok('l\'etichetta: un movimento a mano si legge com\'è, un incasso non porta il nome dell\'iscritto', prova(() => [
    m.descrizioneRiga(riga('m', 'uscita', '2026-09-10', 300, 'c1', { descrizione: 'Detersivo' })),
    m.descrizioneRiga(riga('i', 'entrata', '2026-09-10', 300, 'c1', { origine: 'ricevuta', descrizione: 'Rossi Giulia', voce: 'Quota associativa' })),
  ]), ['Detersivo', 'Incasso iscritto · Quota associativa'])
  ok('il giorno di una chiusura è quello di Roma: alle 23:30 UTC è già il giorno dopo', prova(() => [m.giornoRoma('2026-09-14T21:59:00Z'), m.giornoRoma('2026-09-14T22:30:00Z')]), ['2026-09-14', '2026-09-15'])
}

console.log('\n26. una cassa senza giorno di partenza non si chiude, e un previsto che non torna')
{
  const senzaDal = [{ id: 'c1', nome: 'Cassa Contanti', saldoIniziale: 0 }, casse[1]]
  ok('senza «dal» il previsto conterebbe tutti i contanti di sempre: prima si imposta la cassa', prova(() => m.cosaNonVaChiusura({ cassaId: 'c1', data: '2026-09-07', contato: 0 }, senzaDal, [], '2026-09-26')), 'Imposta prima il saldo iniziale e il giorno di partenza della Cassa Contanti')
  ok('…ma il Conto Corrente viene prima', prova(() => m.cosaNonVaChiusura({ cassaId: 'c2', data: '2026-09-07', contato: 0 }, senzaDal, [], '2026-09-26')), 'Si chiude solo la Cassa Contanti')
  const NON_TORNA = 'Il previsto della Cassa Contanti non torna: controlla le ricevute in contanti'
  ok('un previsto normale va', prova(() => [m.cosaNonVaPrevisto(13000, 12500), m.cosaNonVaPrevisto(0, 0)]), [null, null])
  ok('una differenza oltre un milione di euro no', prova(() => [m.cosaNonVaPrevisto(100_000_001 + 5, 5), m.cosaNonVaPrevisto(0, 100_000_001)]), [NON_TORNA, NON_TORNA])
  ok('un previsto oltre dieci milioni di euro no', prova(() => m.cosaNonVaPrevisto(1_000_000_001, 1_000_000_001)), NON_TORNA)
}

console.log('\n27. annullare un incasso in contanti di un giorno chiuso: l\'avviso prima di farlo (avvisoCassaChiusa(pagamenti, fino))')
{
  // `fino` è la data dell'ultima chiusura non annullata (`contantiChiusiFino`, che legge anche la segreteria): quale chiusura conta lo dice lei.
  const avviso = (pagamenti, fino = '2026-09-14') => prova(() => m.avvisoCassaChiusa(pagamenti, fino))
  const ATTENZIONE = 'Attenzione: la cassa contanti è chiusa fino al 14/09/2026 e questo incasso in contanti è di quei giorni: la chiusura non sarà più in regola e dovrai scrivere una rettifica.'
  ok('un incasso in contanti dentro i giorni chiusi avvisa', avviso([{ data: '2026-09-10', metodo: 'Contanti' }]), ATTENZIONE)
  ok('…il giorno stesso della chiusura', avviso([{ data: '2026-09-14', metodo: 'Contanti' }]), ATTENZIONE)
  ok('…senza badare a maiuscole e spazi del metodo', avviso([{ data: '2026-09-10', metodo: ' CONTANTI ' }]), ATTENZIONE)
  ok('basta uno dei pagamenti di una ricevuta', avviso([{ data: '2026-09-20', metodo: 'Contanti' }, { data: '2026-09-02', metodo: 'Contanti' }]), ATTENZIONE)
  ok('il giorno dopo la chiusura no', avviso([{ data: '2026-09-15', metodo: 'Contanti' }]), null)
  ok('un pagamento con carta o bonifico non tocca la cassa', avviso([{ data: '2026-09-10', metodo: 'POS' }, { data: '2026-09-10', metodo: 'Bonifico' }]), null)
  ok('senza chiusure (fino null) niente', avviso([{ data: '2026-09-10', metodo: 'Contanti' }], null), null)
  ok('la data di chiusura cambia la frase', avviso([{ data: '2026-09-17', metodo: 'Contanti' }], '2026-09-20'), ATTENZIONE.replace('14/09', '20/09'))
  ok('senza pagamenti niente', avviso([]), null)
}

console.log('\n27b. i contanti di una ricevuta in un giorno già chiuso (contantiInGiornoChiuso(pagamenti, dataRicevuta, fino, tranne?))')
{
  // Le stesse regole di `emetti_ricevuta` (92-ricevuta-cassa-chiusa.sql), provate da supabase/prova/ricevuta-cassa-chiusa.sql.
  const CHIUSO = 'Quel giorno la cassa è già chiusa: scegli una data dopo la chiusura'
  const FINO = '2026-09-10'
  const no = (pagamenti, dataRicevuta = '2026-09-10', fino = FINO, tranne) => prova(() => m.contantiInGiornoChiuso(pagamenti, dataRicevuta, fino, tranne))
  const c = (data, importo = 3000, metodo = 'Contanti') => ({ ...(data ? { data } : {}), importo, metodo })
  ok('contanti datati il giorno della chiusura no', no([c('2026-09-10')]), CHIUSO)
  ok('…prima della chiusura no', no([c('2026-09-05')]), CHIUSO)
  ok('«CONTANTI » maiuscolo e con lo spazio è lo stesso', no([c('2026-09-10', 3000, 'CONTANTI ')]), CHIUSO)
  ok('contanti del giorno dopo la chiusura sì', no([c('2026-09-11')], '2026-09-11'), null)
  ok('conta la data del pagamento: ricevuta del 20 con contanti del 10 no', no([c('2026-09-10')], '2026-09-20'), CHIUSO)
  ok('…e ricevuta del 10 con contanti del 20 sì', no([c('2026-09-20')], '2026-09-10'), null)
  ok('senza data il pagamento è del giorno della ricevuta: ricevuta del 10 no', no([c(null)], '2026-09-10'), CHIUSO)
  ok('…ricevuta dell\'11 sì', no([c(null)], '2026-09-11'), null)
  ok('un pagamento a 0 € in contanti non entra in cassa', no([c('2026-09-10', 0)]), null)
  ok('carta, POS, bonifico, Satispay in un giorno chiuso sì', ['Carta', 'POS', 'Bonifico', 'Satispay'].map((metodo) => no([c('2026-09-10', 3000, metodo)])), [null, null, null, null])
  ok('senza chiusure (fino null) tutto va', no([c('2026-09-10')], '2026-09-10', null), null)
  ok('basta uno dei pagamenti', no([c('2026-09-20'), c('2026-09-10', 3000, 'POS'), c('2026-09-05', 2000)], '2026-09-20'), CHIUSO)
  ok('chiusa fino al 9: contanti del 10 sì', no([c('2026-09-10')], '2026-09-10', '2026-09-09'), null)
  // Il pagamento a mano registrato prima della chiusura (FANNE LA RICEVUTA): i suoi contanti sono già nel previsto.
  const tranne = { data: '2026-09-10', metodo: 'Contanti' }
  ok('i contanti del pagamento a mano, stessa data, passano', no([c('2026-09-10', 3000)], '2026-09-10', FINO, tranne), null)
  ok('…anche scritti « contanti » e senza data nella ricevuta dello stesso giorno', no([c(null, 3000, ' contanti ')], '2026-09-10', FINO, tranne), null)
  ok('…ma altri contanti in un giorno chiuso no', no([c('2026-09-10', 3000), c('2026-09-05', 2000)], '2026-09-10', FINO, tranne), CHIUSO)
  ok('…né contanti di un altro giorno chiuso al posto suo', no([c('2026-09-09', 3000)], '2026-09-10', FINO, tranne), CHIUSO)
  ok('un pagamento a mano col POS non salva i contanti del suo giorno', no([c('2026-09-10', 3000, 'POS'), c('2026-09-10', 2000)], '2026-09-10', FINO, { data: '2026-09-10', metodo: 'POS' }), CHIUSO)
}

console.log('\n28. la voce di rettifica che manca')
{
  const con = (...nomi) => nomi.map(([nome, tipo]) => ({ id: `${nome}-${tipo}`, nome, tipo, diSistema: false, attiva: true }))
  ok('senza «Rettifica» mancano entrata e uscita', prova(() => m.rettificheMancanti(con(['Affitto sala', 'uscita']))), ['entrata', 'uscita'])
  ok('con quella di uscita manca l\'entrata', prova(() => m.rettificheMancanti(con(['Rettifica', 'uscita']))), ['entrata'])
  ok('con tutte e due non manca niente', prova(() => m.rettificheMancanti(con(['Rettifica', 'uscita'], ['Rettifica', 'entrata']))), [])
  ok('senza badare a maiuscole e spazi', prova(() => m.rettificheMancanti(con([' RETTIFICA ', 'uscita'], ['rettifica', 'entrata']))), [])
  ok('«Rettifica» spenta si può riattivare: non manca', prova(() => m.rettificheMancanti([{ id: 'x', nome: 'Rettifica', tipo: 'uscita', diSistema: false, attiva: false }, ...con(['Rettifica', 'entrata'])])), [])
  ok('un nome che la contiene non basta', prova(() => m.rettificheMancanti(con(['Rettifica cassa', 'uscita'], ['Rettifica cassa', 'entrata']))), ['entrata', 'uscita'])
}

console.log('\n29. il saldo salvato non è una bozza')
{
  ok('«100» e «100,00» sono lo stesso saldo di 10000 centesimi', prova(() => [m.saldoCambiato('100', 10000), m.saldoCambiato('100,00', 10000)]), [false, false])
  ok('un saldo diverso è cambiato', prova(() => m.saldoCambiato('100,01', 10000)), true)
  ok('uno zero scritto in vari modi non è cambiato', prova(() => [m.saldoCambiato('0', 0), m.saldoCambiato('0,00', 0)]), [false, false])
  ok('un testo che non è un importo conta come cambiato (la bozza non si perde)', prova(() => [m.saldoCambiato('', 10000), m.saldoCambiato('abc', 10000)]), [true, true])
}

console.log('\n30. il riepilogo prima di registrare un movimento o un giroconto')
{
  const mov = { tipo: 'uscita', data: '2026-09-20', importo: 12345, voceId: 'v-aff', cassaId: 'c2', descrizione: 'Affitto di settembre', nota: 'bonifico del 20' }
  const t = (d = mov) => prova(() => m.riepilogoMovimento(d, 'Affitto sala', 'Conto Corrente')).toString()
  ok('il movimento è un elenco di righe', Array.isArray(prova(() => m.riepilogoMovimento(mov, 'Affitto sala', 'Conto Corrente'))), true)
  ok('il movimento dice importo, voce, cassa, data e descrizione', [`${m.euro(12345)} €`, 'Affitto sala', 'Conto Corrente', m.dataRicevuta('2026-09-20'), 'Affitto di settembre'].map((x) => t().includes(x)), [true, true, true, true, true])
  ok('…e la nota', t().includes('bonifico del 20'), true)
  ok('…dice se è un\'uscita o un\'entrata', [/uscita/i.test(t()), /entrata/i.test(t()), /entrata/i.test(t({ ...mov, tipo: 'entrata' }))], [true, false, true])
  const giro = { daCassaId: 'c1', aCassaId: 'c2', data: '2026-09-15', importo: 1000, nota: 'Versamento in banca' }
  const g = () => prova(() => m.riepilogoGiroconto(giro, 'Cassa Contanti', 'Conto Corrente')).toString()
  ok('il giroconto è un elenco di righe', Array.isArray(prova(() => m.riepilogoGiroconto(giro, 'Cassa Contanti', 'Conto Corrente'))), true)
  ok('il giroconto dice importo, le due casse, data e nota', [`${m.euro(1000)} €`, 'Cassa Contanti', 'Conto Corrente', m.dataRicevuta('2026-09-15'), 'Versamento in banca'].map((x) => g().includes(x)), [true, true, true, true, true])
  ok('…da quale cassa a quale: la prima viene prima', g().indexOf('Cassa Contanti') < g().indexOf('Conto Corrente') && g().indexOf('Cassa Contanti') >= 0, true)
}

console.log('\n31. Contabilita.tsx scrive solo dopo il sì del riepilogo')
{
  const tsx = readFileSync('src/components/segreteria/Contabilita.tsx', 'utf8')
  // registraMovimento due volte: il movimento a mano e la commissione Satispay, che parte col sì del giroconto.
  for (const [chiamata, riepiloghi] of [['registraMovimento', ['riepilogoMovimento', 'riepilogoGiroconto']], ['registraGiroconto', ['riepilogoGiroconto']]]) {
    const posti = [...tsx.matchAll(new RegExp(`${chiamata}\\(`, 'g'))].map((x) => x.index)
    ok(`${riepiloghi.length === 1 ? 'una sola chiamata' : 'due chiamate'} a ${chiamata}`, posti.length, riepiloghi.length)
    posti.forEach((i, n) => {
      const inizi = [...tsx.slice(0, i).matchAll(/onClick=\{|=\s*async\b/g)]
      const gestore = tsx.slice(inizi.at(-1)?.index ?? 0, i)
      ok(`${chiamata} n. ${n + 1} sta dopo un \`await chiedi(\` col ${riepiloghi[n]}`, [/await chiedi\(/.test(gestore), gestore.includes(`${riepiloghi[n]}(`)], [true, true])
      ok(`…e senza il sì si esce prima di scrivere`, /if \(!\(await chiedi\([\s\S]*?\)\)\) return/.test(gestore), true)
    })
  }
}

console.log('\n32. la chiusura alla cieca: il previsto si vede solo dopo aver contato')
{
  const visibile = (contati, previsto = 26000) => prova(() => m.chiusuraVisibile(contati, previsto))
  ok('senza aver scritto niente: niente da vedere', visibile(''), null)
  ok('con soli spazi: niente', visibile('   '), null)
  ok('con un testo che non è un importo: niente', [visibile('abc'), visibile('12,345'), visibile('-5')], [null, null, null])
  ok('«0» è un importo valido: si vede, e la differenza è tutto il previsto in meno', visibile('0'), { previsto: 26000, differenza: -26000 })
  ok('«0,00» come «0»', visibile('0,00'), { previsto: 26000, differenza: -26000 })
  ok('contati giusti: tornano', visibile('260,00'), { previsto: 26000, differenza: 0 })
  ok('contati in più', visibile('1.235,00', 100000), { previsto: 100000, differenza: 23500 })
  ok('il previsto negativo si vede, dopo aver contato', visibile('10', -500), { previsto: -500, differenza: 1500 })
  ok('senza contati il previsto non esce nemmeno se è zero o negativo', [visibile('', 0), visibile('', -500)], [null, null])
}

console.log('\n33. ChiudiCassa non mostra il previsto prima di aver contato')
{
  const tsx = readFileSync('src/components/segreteria/Contabilita.tsx', 'utf8')
  const da = tsx.indexOf('function ChiudiCassa(')
  const fino = tsx.indexOf('function ElencoChiusure(')
  const corpo = da >= 0 && fino > da ? tsx.slice(da, fino) : ''
  ok('ChiudiCassa ricava `visibile` da chiusuraVisibile(contati, previsto)', /const visibile = chiusuraVisibile\(/.test(corpo), true)
  for (const segno of ['IN CASSA SECONDO I CONTI', 'COSA C’È DENTRO', '>DIFFERENZA<', 'Meno di zero']) {
    const k = corpo.indexOf(segno)
    ok(`«${segno.replace(/[<>]/g, '')}» sta dopo un \`{visibile\``, k > 0 && corpo.lastIndexOf('{visibile', k) > 0, true)
  }
  const k = corpo.indexOf('Meno di zero')
  ok('«Meno di zero» guarda il previsto visibile, non quello di prima', k > 0 && corpo.slice(Math.max(0, k - 250), k).includes('visibile'), true)
  ok('il previsto non si scrive più a vista: `soldiConSegno(previsto)` non c\'è', corpo.includes('soldiConSegno(previsto)'), false)
  ok('i movimenti del periodo hanno importi solo dietro `visibile`', corpo.lastIndexOf('{visibile', corpo.indexOf('importoPerCassa(r, cassa.id)')) > 0, true)
}

console.log('\n34. il dettaglio di un movimento è una pagina intera, come quello di un iscritto')
{
  const tsx = readFileSync('src/components/segreteria/Contabilita.tsx', 'utf8')
  const da = tsx.indexOf('function Movimenti(')
  const fino = tsx.indexOf('function NuovoMovimento(')
  const corpo = da >= 0 && fino > da ? tsx.slice(da, fino) : ''
  ok('`SchedaPiena` arriva da ./comune', /import \{[^}]*\bSchedaPiena\b[^}]*\} from '\.\/comune'/.test(tsx), true)
  const k = corpo.indexOf('<MovimentoAperto')
  const prima = k > 0 ? corpo.slice(corpo.lastIndexOf('{aperto &&', k), k) : ''
  ok('`MovimentoAperto` sta dentro una `SchedaPiena`', prima.includes('<SchedaPiena'), true)
  ok('…e non più in un `InVista`', prima.includes('<InVista'), false)
  ok('si torna all\'elenco chiedendo prima se c\'è una correzione non salvata (`lasciare`)', /lasciare\(\)/.test(corpo), true)
}

console.log('\n35. cambiare la voce: cosa si può e cosa no (le stesse parole di supabase/67-cambia-voce.sql)')
{
  const vv = [
    ...voci,
    { id: 'v-dc', nome: 'Da classificare', tipo: 'uscita', diSistema: false, attiva: true },
    { id: 'v-dcE', nome: 'Da classificare', tipo: 'entrata', diSistema: false, attiva: true },
    { id: 'v-en', nome: 'Energia', tipo: 'uscita', diSistema: false, attiva: true },
    { id: 'v-difU', nome: 'Differenza di cassa', tipo: 'uscita', diSistema: true, attiva: true },
    { id: 'v-difE', nome: 'Differenza di cassa', tipo: 'entrata', diSistema: true, attiva: true },
  ]
  const mv = (id, o) => ({ id, tipo: 'uscita', data: '2019-03-14', importo: 8400, voceId: 'v-dc', cassaId: 'c2', descrizione: 'BONIFICO SIAE', creatoIl: '2019-03-14T10:00:00Z', ...o })
  const manuali = [
    mv('a1'),
    mv('a2', { descrizione: 'BONIFICO ENEL', importo: 31240 }),
    mv('a3', { descrizione: 'GIÀ A POSTO', voceId: 'v-en' }),
    mv('a4', { descrizione: 'DONAZIONE', tipo: 'entrata', voceId: 'v-dcE', importo: 5000 }),
    mv('an', { descrizione: 'DA DISFARE', data: '2019-02-10', annullatoIl: '2019-02-11T00:00:00Z' }),
    mv('g1', { tipo: 'giroconto', voceId: undefined, cassaAId: 'c1', descrizione: 'Giroconto' }),
    mv('d1', { descrizione: 'Differenza di cassa', data: '2026-09-07', voceId: 'v-difU' }),
  ]
  const righe = m.righeMovimenti([{ id: 'incasso:1', origine: 'ricevuta', tipo: 'entrata', data: '2026-09-01', importo: 100, descrizione: 'Rossi', voce: 'Quota associativa', cassaId: 'c2', annullato: false }], manuali, vv)
  const no = (ids, voce) => prova(() => m.cosaNonVaCambioVoce(ids, righe, vv, voce))
  ok('il limite è 500 (come il database)', m.LIMITE_CAMBIO_VOCE, 500)
  ok('un lotto buono: niente da dire', no(['a1', 'a2', 'a3'], 'v-en'), null)
  ok('nessun movimento', no([], 'v-en'), 'Scegli almeno un movimento')
  ok('501 movimenti', no(Array.from({ length: 501 }, (_, i) => `x${i}`), 'v-en'), 'Troppi movimenti in una volta: al massimo 500')
  ok('lo stesso id due volte conta una', no(['a1', 'a1'], 'v-en'), null)
  ok('senza voce', no(['a1'], ''), 'Scegli la voce')
  ok('una voce che non c\'è', no(['a1'], 'zz'), 'Scegli la voce')
  ok('una voce spenta', no(['a1'], 'v-vecchia'), 'La voce non è più in uso: scegline un’altra')
  ok('«Differenza di cassa» come arrivo', no(['a1'], 'v-difU'), 'La «Differenza di cassa» si scrive da sola chiudendo la cassa')
  ok('un movimento che non c\'è', no(['nulla'], 'v-en'), 'Il movimento non c’è')
  ok('un incasso di un iscritto non è un movimento', no(['incasso:1'], 'v-aff'), 'Il movimento non c’è')
  ok('un annullato', no(['an'], 'v-en'), 'Il movimento del 10/02/2019 (DA DISFARE) è annullato: non si cambia')
  ok('un giroconto', no(['g1'], 'v-en'), 'Un giroconto non ha voce')
  ok('la differenza di una chiusura', no(['d1'], 'v-en'), 'Il movimento del 07/09/2026 (Differenza di cassa) è scritto dalla chiusura di cassa: non si cambia')
  ok('una voce di entrata a un\'uscita', no(['a1'], 'v-don'), 'La voce scelta non va con questo tipo di movimento')
  ok('entrate e uscite insieme', no(['a4', 'a1'], 'v-en'), 'La voce scelta non va con questo tipo di movimento')
  ok('uno cattivo in mezzo ferma il lotto e dice quale', no(['a1', 'a2', 'an'], 'v-en'), 'Il movimento del 10/02/2019 (DA DISFARE) è annullato: non si cambia')
  ok('cambiabile: sì per un movimento a mano in uscita o entrata', righe.filter(m.cambiabile).map((r) => r.id).sort(), ['a1', 'a2', 'a3', 'a4'])
  ok('…no per incassi, annullati, giroconti e la differenza', righe.filter((r) => !m.cambiabile(r)).map((r) => r.id).sort(), ['an', 'd1', 'g1', 'incasso:1'])

  console.log('   il riepilogo e i pacchetti')
  const r1 = prova(() => m.riepilogoCambioVoce(['a1', 'a2', 'a3'], righe, 'v-en', vv))
  ok('3 uscite: quante, di che tipo, quanto, da quali voci, quante già così', r1, { quanti: 3, tipo: 'uscita', totale: 8400 + 31240 + 8400, daVoci: [{ voce: 'Da classificare', quanti: 2 }, { voce: 'Energia', quanti: 1 }], giaCosi: 1 })
  ok('entrate e uscite insieme: il tipo è «misto»', prova(() => m.riepilogoCambioVoce(['a1', 'a4'], righe, 'v-en', vv)).tipo, 'misto')
  ok('pacchetti da 500: 1.200 → 500, 500, 200', m.pacchetti(Array.from({ length: 1200 }, (_, i) => i)).map((p) => p.length), [500, 500, 200])
  ok('…e uno solo se ci sta', m.pacchetti([1, 2, 3]).length, 1)
  ok('…nessuno se non c\'è niente', m.pacchetti([]), [])
  ok('«Solo le N entrate/uscite»: al singolare dice «Solo 1 entrata»', [m.soloTipo(4, 'entrata'), m.soloTipo(1, 'entrata'), m.soloTipo(2, 'uscita'), m.soloTipo(1, 'uscita')], ['Solo le 4 entrate', 'Solo 1 entrata', 'Solo le 2 uscite', 'Solo 1 uscita'])
  ok('l\'esito', [m.esitoCambioVoce(12, 3), m.esitoCambioVoce(1, 0), m.esitoCambioVoce(0, 3), m.esitoCambioVoce(2, 1)], ['12 cambiati, 3 erano già così', '1 cambiato', '3 erano già così: non è cambiato niente', '2 cambiati, 1 era già così'])
  ok('la scelta è di un tipo solo? vale l\'elenco dei trovati', prova(() => m.vociPerLaScelta(['a1', 'a2'], righe, vv)).map((v) => v.nome), ['Affitto sala', 'Da classificare', 'Energia'])
  ok('…con entrate e uscite insieme non se ne offre nessuna', prova(() => m.vociPerLaScelta(['a1', 'a4'], righe, vv)), [])
  ok('…senza scelta nemmeno', prova(() => m.vociPerLaScelta([], righe, vv)), [])
}

console.log('\n36. Contabilita.tsx cambia la voce dopo il riepilogo, a pacchetti, e mai per un incasso')
{
  const tsx = readFileSync('src/components/segreteria/Contabilita.tsx', 'utf8')
  const da = tsx.indexOf('function CambiaVoce(')
  const fino = tsx.indexOf('function NuovoMovimento(')
  const corpo = da >= 0 && fino > da ? tsx.slice(da, fino) : ''
  ok('tre chiamate a cambiaVoceMovimenti: il riepilogo, il movimento aperto e il suggerimento (dopo cosaNonVaCambioVoce)', tsx.split('cambiaVoceMovimenti(').length - 1, 3)
  ok('il riepilogo scrive a pacchetti', [corpo.includes('pacchetti('), /await d\.cambiaVoceMovimenti\(/.test(corpo)], [true, true])
  ok('…e dice com\'è andata con esitoCambioVoce', corpo.includes('esitoCambioVoce('), true)
  ok('…il sì resta spento finché cosaNonVaCambioVoce ha qualcosa da dire', /disabled=\{[^}]*guaio/.test(corpo), true)
  ok('…le voci offerte sono quelle di vociPerLaScelta (entrate e uscite insieme: nessuna)', corpo.includes('vociPerLaScelta('), true)
  ok('la casella c\'è solo per le righe che cambiabile() ammette', /cambiabile\(r\) &&/.test(tsx), true)
  ok('cambiando i filtri la scelta si svuota', /setScelti\(new Set\(\)\)[\s\S]{0,80}\[chiave\]/.test(tsx), true)
  ok('l\'elenco mostra le righe a pezzi: MOSTRA ALTRE', tsx.includes('Mostra altre'), true)
  ok('il movimento aperto legge la traccia', tsx.includes('cambiVoceMovimento('), true)
}

console.log('\n37. collegare alla persona: le righe dell\'elenco portano chiave dell\'import e persona, e cosaNonVaCollegato le legge (supabase/70-movimenti-persona.sql)')
{
  // Un build a parte: se il modulo non c'è ancora, fallisce questa sezione e non le altre.
  const persona = await build({
    stdin: { contents: "export { cosaNonVaCollegato } from './src/lib/movimentiPersona'", resolveDir: '.', loader: 'ts' },
    bundle: true,
    format: 'esm',
    platform: 'node',
    write: false,
    logLevel: 'silent',
    define: { 'import.meta.env': '{}' },
  }).then(
    (r) => import('data:text/javascript;base64,' + Buffer.from(r.outputFiles[0].text).toString('base64')),
    (e) => ({ errore: e.errors?.[0]?.text ?? e.message }),
  )
  ok('il modulo src/lib/movimentiPersona.ts c\'è', persona.errore ?? 'c\'è', 'c\'è')
  const vv = [
    ...voci,
    { id: 'v-dc', nome: 'Da classificare', tipo: 'entrata', diSistema: false, attiva: true },
    { id: 'v-difE', nome: 'Differenza di cassa', tipo: 'entrata', diSistema: true, attiva: true },
  ]
  const mv = (id, o) => ({ id, tipo: 'entrata', data: '2025-03-04', importo: 3000, voceId: 'v-corsi', cassaId: 'c2', descrizione: 'Cliente Giulia Verdelli per extra', creatoIl: '2025-03-04T10:00:00Z', origineImport: 'prima-nota:1', ...o })
  const manuali = [
    mv('s1'),
    mv('s2', { personaId: 'p1', voceId: 'v-quota' }),
    mv('s3', { origineImport: undefined, descrizione: 'Cliente Giulia Verdelli per mano' }),
    mv('s4', { voceId: 'v-dc' }),
    mv('s5', { tipo: 'uscita', voceId: 'v-aff' }),
    mv('s6', { annullatoIl: '2025-03-05T00:00:00Z' }),
    mv('s7', { tipo: 'giroconto', voceId: undefined, cassaAId: 'c1', origineImport: undefined, descrizione: 'Giroconto' }),
    mv('s8', { voceId: 'v-difE', origineImport: undefined, descrizione: 'Differenza di cassa', data: '2026-09-07' }),
  ]
  const righe = m.righeMovimenti([], manuali, vv)
  const riga = (id) => righe.find((r) => r.id === id)
  ok('una riga porta la chiave dell\'import e la persona dei movimenti', [riga('s1')?.origineImport, riga('s2')?.personaId, riga('s3')?.origineImport], ['prima-nota:1', 'p1', undefined])
  const no = (id) => prova(() => persona.cosaNonVaCollegato(riga(id)))
  ok('l\'entrata dello storico su una voce di sistema, con o senza persona: niente da dire', [no('s1'), no('s2')], [null, null])
  ok('una voce che non è un incasso', no('s4'), 'Il movimento del 04/03/2025 (Cliente Giulia Verdelli per extra) è su «Da classificare»: si collegano solo quelli su «Quota associativa» e «Corsi e altri pagamenti»')
  ok('un\'uscita', no('s5'), 'Il movimento del 04/03/2025 (Cliente Giulia Verdelli per extra) è un’uscita: si collegano solo le entrate')
  // Cambiata da quote-persona: un'entrata scritta a mano su Quota o Corsi si collega (prima: «non viene dal vecchio programma»).
  ok('a mano, su una voce di sistema: si collega', no('s3'), null)
  ok('un annullato', no('s6'), 'Il movimento del 04/03/2025 (Cliente Giulia Verdelli per extra) è annullato: non si collega')
  ok('un giroconto', no('s7'), 'Un giroconto non ha una persona')
  ok('la differenza di una chiusura', no('s8'), 'Il movimento del 07/09/2026 (Differenza di cassa) è scritto dalla chiusura di cassa: non si collega')
  ok('gli incassi degli iscritti non sono movimenti: nessuna chiave, nessuna persona', prova(() => {
    const incasso = m.righeMovimenti([{ id: 'incasso:1', origine: 'ricevuta', tipo: 'entrata', data: '2026-09-01', importo: 100, descrizione: 'Rossi', voce: 'Quota associativa', cassaId: 'c2', annullato: false }], [], vv)[0]
    return [incasso.origineImport, incasso.personaId, persona.cosaNonVaCollegato(incasso)]
  }), [undefined, undefined, 'Il movimento del 01/09/2026 (Rossi) non viene dal vecchio programma: non si collega'])
}

console.log('\n38. i movimenti partono da «Tutto l\'anno»; i filtri diversi dalla partenza si contano e si vedono')
{
  ok('il periodo di partenza è l\'anno', m.PERIODO_INIZIALE, 'anno')
  const { dal, al } = prova(() => m.intervalloDi(m.PERIODO_INIZIALE, '2026-10-18', '', ''))
  ok('con oggi 2026-10-18 va dal 1 gennaio al 31 dicembre', [dal, al], ['2026-01-01', '2026-12-31'])
  const riga = (id, data) => ({ id, origine: 'movimento', tipo: 'uscita', data, importo: 100, descrizione: id, voce: 'Affitto sala', cassaId: 'c1', annullato: false })
  const viste = m.filtraMovimenti([riga('a', '2025-12-31'), riga('b', '2026-01-01'), riga('c', '2026-12-31')], { dal, al }).map((r) => r.id)
  ok('una riga del 31 dicembre dell\'anno scorso non c\'è, quelle dell\'anno sì', viste, ['b', 'c'])
  const base = { testo: '', periodo: 'anno', tipo: '', cassaId: '', voce: '', persona: '', annullati: false }
  ok('alla partenza i filtri attivi sono 0', prova(() => m.filtriAttivi(base)), 0)
  ok('ricerca, tipo e cassa: 3', prova(() => m.filtriAttivi({ ...base, testo: 'affitto', tipo: 'uscita', cassaId: 'c1' })), 3)
  ok('una ricerca di soli spazi non conta', prova(() => m.filtriAttivi({ ...base, testo: '   ' })), 0)
  ok('«Tutto» al posto di «Tutto l\'anno» conta uno', prova(() => m.filtriAttivi({ ...base, periodo: 'tutto' })), 1)
  ok('voce, persona e annullati contano', prova(() => m.filtriAttivi({ ...base, voce: 'Affitto sala', persona: 'collegati', annullati: true })), 3)
  const f = { dal, al, persona: '' }
  const nuovo = (o) => ({ ...riga('n', '2026-10-18'), ...o })
  ok('un movimento dentro i filtri si vedrà', prova(() => m.nonSiVedra(nuovo({}), f)), false)
  ok('uno dell\'anno scorso no', prova(() => m.nonSiVedra(nuovo({ data: '2025-06-01' }), f)), true)
  ok('uno su un\'altra cassa, con la cassa filtrata, no', prova(() => m.nonSiVedra(nuovo({ cassaId: 'c2' }), { ...f, cassaId: 'c1' })), true)
  ok('con una persona scelta un movimento nuovo non si vede (non ha persona)', prova(() => m.nonSiVedra(nuovo({}), { ...f, persona: 'collegati' })), true)
  const g = prova(() => m.rigaAppenaScritta({ tipo: 'giroconto', data: '2026-10-18', importo: 100, descrizione: 'Giroconto da Cassa Contanti a Conto Corrente', cassaId: 'c2', cassaAId: 'c1' }))
  ok('la riga di un giroconto appena scritto è com\'è nell\'elenco: senza voce, due casse, non annullata', [g?.origine, g?.voce, g?.cassaAId, g?.annullato], ['movimento', null, 'c1', false])
  ok('cercando «contanti» un giroconto da Cassa Contanti si vede', prova(() => m.nonSiVedra(g, { ...f, testo: 'contanti' })), false)
  ok('cercando «cena» no', prova(() => m.nonSiVedra(g, { ...f, testo: 'cena' })), true)
  ok('un giroconto verso la cassa filtrata si vede', prova(() => m.nonSiVedra(nuovo({ tipo: 'giroconto', voce: null, cassaAId: 'c1', cassaId: 'c2' }), { ...f, cassaId: 'c1' })), false)
}

console.log('\n39. Contabilita.tsx: Nuovo movimento e Giroconto sono una pagina intera, e i filtri hanno il loro ordine')
{
  const tsx = readFileSync('src/components/segreteria/Contabilita.tsx', 'utf8')
  const da = tsx.indexOf('function Movimenti(')
  const fino = tsx.indexOf('function CambiaVoce(')
  const corpo = da >= 0 && fino > da ? tsx.slice(da, fino) : ''
  ok('i filtri partono da FILTRI_INIZIALI', /useState<FiltriElenco>\(FILTRI_INIZIALI\)/.test(corpo), true)
  ok('Nuovo movimento non è più un riquadro sopra l\'elenco (`InVista`)', /<InVista><NuovoMovimento/.test(corpo), false)
  ok('…né il Giroconto', /<InVista><NuovoGiroconto/.test(corpo), false)
  ok('con il modulo aperto l\'elenco non c\'è: si torna con «I movimenti» chiedendo prima (`lasciare`)', /if \(scrivo\)/.test(corpo) && /I movimenti/.test(corpo) && /lasciare\(\)/.test(corpo), true)
  ok('«Raggruppa per voce» non è più un chip dei filtri', /Raggruppa per voce/.test(corpo), false)
  ok('c\'è la vista Elenco | Per voce, a segmenti', /<Segmenti[^>]*Vista/.test(corpo) && /Per voce/.test(corpo), true)
  ok('il periodo è a segmenti, non quattro chip', /<Segmenti[^>]*Periodo/.test(corpo), true)
  ok('le pillole della riga di stato vengono da `filtriAccesi`, e la ✕ toglie con `togliFiltro`', /filtriAccesi\(/.test(corpo) && /togliFiltro\(/.test(corpo), true)
  ok('«Scegli tutte» è la casella in testa alla tabella, non un tasto a sé', /Scegli tutte le/.test(corpo), false)
  ok('…la casella c\'è', /columnheader[^>]*>\s*<input type="checkbox"/.test(corpo), true)
  ok('le azioni della pagina vanno nella testata (`createPortal`)', /createPortal\(/.test(corpo), true)
  ok('c\'è «Togli i filtri»', /Togli i filtri/.test(corpo), true)
  // Le azioni in testata restano in vista col dettaglio aperto: toccarle non deve buttare una correzione non salvata.
  ok('Giroconto e Nuovo movimento chiedono prima di lasciare il dettaglio', /const apri = async[^]*?if \(!\(await lasciare\(\)\)\) return[^]*?setScrivo\(cosa\)/.test(corpo), true)
  // Le regole dell'elenco stanno nel componente: queste fermano chi le cambia per sbaglio.
  ok('la ✕ di una pillola toglie solo quel filtro (`togliFiltro(f, a.chiave)`)', /togliFiltro\(f, a\.chiave\)/.test(corpo), true)
  ok('le somme della riga di stato sono dell\'estratto conto (`estrattoConto`)', /estrattoConto\(righe, casse,/.test(corpo) && /estratto\.saldoFinale/.test(corpo), true)
  ok('la casella in testa sceglie solo quelli che si possono cambiare', /const scegliibili = trovate\.filter\(cambiabile\)/.test(corpo), true)
  ok('«Togli i filtri» riporta tutti i filtri alla partenza', /const azzera = \(\) => \{\s*setF\(FILTRI_INIZIALI\)/.test(corpo), true)
  ok('…anche «Collega i casi sicuri»', /const collegaSicuri = async[^]*?if \(!\(await lasciare\(\)\)\) return[^]*?setCollegando\('sicuri'\)/.test(corpo), true)
  ok('«Vedi i da decidere» parte da filtri spenti, se no un filtro acceso li nasconde', /onVediDaDecidere=\{[^}]*setF\(\{ \.\.\.FILTRI_INIZIALI, periodo: 'tutto', persona: 'da_decidere' \}\)/.test(corpo), true)
  ok('i filtri attivi si contano con `filtriAttivi`', /filtriAttivi\(/.test(corpo), true)
  ok('dopo la registrazione fuori dai filtri lo dice (`nonSiVedra`)', /nonSiVedra\(/.test(tsx), true)
  ok('PERSONA è un menu, non quattro chip', /id="filtro-persona"/.test(corpo), true)
  ok('TIPO è un menu e le CASSE sono a scelta multipla', /<FiltroCasse /.test(corpo) && /id="filtro-tipo"/.test(corpo), true)
}

console.log('\n40. la colonna PERSONA mostra l\'iscritto anche per gli incassi; «Collegati» resta lo storico collegato a mano')
{
  const persona = await build({
    stdin: { contents: "export { cosaNonVaCollegato, filtraPerPersona, collegatoAMano } from './src/lib/movimentiPersona'", resolveDir: '.', loader: 'ts' },
    bundle: true,
    format: 'esm',
    platform: 'node',
    write: false,
    logLevel: 'silent',
    define: { 'import.meta.env': '{}' },
  }).then(
    (r) => import('data:text/javascript;base64,' + Buffer.from(r.outputFiles[0].text).toString('base64')),
    (e) => ({ errore: e.errors?.[0]?.text ?? e.message }),
  )
  ok('il modulo src/lib/movimentiPersona.ts c\'è', persona.errore ?? 'c\'è', 'c\'è')
  const nomi = [{ id: 'p1', nome: 'Giulia', cognome: 'Rossi' }, { id: 'p2', nome: 'Zoë', cognome: "D'Amico" }, { id: 'p3', nome: 'Luca', cognome: 'Neri' }]
  const conP1 = ricevuta(70, 'Giulia', 'Rossi', [voce('QUOTA ASSOCIATIVA', 3000, [pag('2026-09-20', 3000)])], { personaId: 'p1' })
  const senzaP = ricevuta(71, 'Mario', 'Verdi', [voce('ANNUALE JUDO', 2000, [pag('2026-09-21', 2000, 'POS')])], { personaId: undefined })
  const aMano = diretto('d70', 'p2', '2026-09-22', 1500, { metodo: 'Assegno', voce: 'ANNUALE JUDO' })
  const sp = (id, personaId) => ({ id, chi: 'Neri Luca', importo: 2500, stato: 'pagato', creatoIl: '2026-09-23T08:00:00Z', pagatoIl: '2026-09-23T10:00:00Z', personaId })
  const storico = [
    { id: 'st1', tipo: 'entrata', data: '2025-03-04', importo: 3000, voceId: 'v-quota', cassaId: 'c2', descrizione: 'Cliente Giulia Rossi per quota', creatoIl: '2025-03-04T10:00:00Z', origineImport: 'prima-nota:1', personaId: 'p1' },
    { id: 'st2', tipo: 'entrata', data: '2025-03-05', importo: 3000, voceId: 'v-quota', cassaId: 'c2', descrizione: 'Cliente Anna Bruni per quota', creatoIl: '2025-03-05T10:00:00Z', origineImport: 'prima-nota:2' },
  ]
  const elenco = prova(() => m.elencoMovimenti([conP1, senzaP], [aMano], nomi, casse, storico, voci, [sp('s1', 'p3'), sp('s2', undefined)]))
  const di = (pred) => prova(() => elenco.find(pred))
  const ric = di((r) => r.id === `incasso:${conP1.id}:0:0`)
  const ricSenza = di((r) => r.id === `incasso:${senzaP.id}:0:0`)
  const dir = di((r) => r.id === 'incasso:diretto:d70')
  const sat = di((r) => r.id === 'incasso:satispay:s1')
  const satSenza = di((r) => r.id === 'incasso:satispay:s2')

  // 1.
  ok('una ricevuta con la scheda p1: la riga dell\'incasso ha personaId p1', ric?.personaId, 'p1')
  ok('un pagamento a mano: la riga ha la persona del pagamento', dir?.personaId, 'p2')
  ok('un Satispay con la scheda: la riga ha la sua persona', sat?.personaId, 'p3')
  ok('incassiDerivati copia la persona della riga di PAGAMENTI', prova(() => m.incassiDerivati(m.righeDaRicevute([conP1]), casse).map((r) => r.personaId)), ['p1'])
  // 2.
  ok('una ricevuta senza scheda: nessuna persona', ricSenza?.personaId ?? null, null)
  ok('un Satispay senza scheda: nessuna persona', satSenza?.personaId ?? null, null)
  // 3.
  ok('un incasso con la persona non è cambiabile: nessuna casella, quindi né Collega né Scollega', [ric, dir, sat].map((r) => prova(() => m.cambiabile(r))), [false, false, false])
  ok('…e non si collega: non viene dal vecchio programma', prova(() => persona.cosaNonVaCollegato(ric)), 'Il movimento del 20/09/2026 (Rossi Giulia) non viene dal vecchio programma: non si collega')
  // 4.
  ok('la descrizione resta il nome della ricevuta', [ric?.descrizione, dir?.descrizione, sat?.descrizione], ['Rossi Giulia', "D'Amico Zoë", 'Neri Luca'])
  ok('cercando «rossi giulia» la si trova', prova(() => m.filtraMovimenti(elenco, { testo: 'rossi giulia' }).map((r) => r.id)), [`incasso:${conP1.id}:0:0`])
  ok('cercando la voce («quota») si trova l\'incasso, che la voce non la ripete più sotto', prova(() => m.filtraMovimenti(elenco, { testo: 'quota' }).some((r) => r.id === `incasso:${conP1.id}:0:0`)), true)
  // 5.
  ok('«Collegati» è solo lo storico collegato a mano, non gli incassi con la persona', prova(() => persona.filtraPerPersona(elenco, 'collegati', {}).map((r) => r.id)), ['st1'])
  ok('…anche con una riga d\'incasso che porta la persona', prova(() => persona.filtraPerPersona([{ ...riga('st9', 'entrata', '2025-01-01', 100, 'c2'), personaId: 'p1' }, { id: 'incasso:x', origine: 'ricevuta', tipo: 'entrata', data: '2026-09-01', importo: 100, descrizione: 'Rossi Giulia', voce: 'Quota associativa', cassaId: 'c2', annullato: false, personaId: 'p1' }], 'collegati', {}).map((r) => r.id)), ['st9'])
  ok('collegatoAMano: sì lo storico con la persona, no l\'incasso con la persona né lo storico senza', prova(() => [elenco.find((r) => r.id === 'st1'), ric, { ...riga('st8', 'entrata', '2025-01-01', 100, 'c2') }].map(persona.collegatoAMano)), [true, false, false])
  ok('il conteggio di «Collegati» resta quello dello storico', prova(() => persona.filtraPerPersona(elenco, 'collegati', {}).length), storico.filter((x) => x.personaId).length)
  // 6.
  ok('sul foglio di chiusura un incasso con la persona è «Incasso iscritto · …», senza nome', prova(() => m.descrizioneRiga(ric)), 'Incasso iscritto · Quota associativa')
  // 7.
  const senzaPersone = prova(() => elenco.map(({ personaId: _p, ...r }) => (r.origine === 'movimento' ? { ...r, personaId: _p } : r)))
  ok('i residui sono gli stessi con e senza la persona negli incassi', prova(() => m.residui(casse, elenco)), prova(() => m.residui(casse, senzaPersone)))
  ok('…e i totali', prova(() => m.totali(elenco)), prova(() => m.totali(senzaPersone)))
}

// ---------------------------------------------------------------------------
// Quel che legge la chat (src/lib/mcp.ts, provato da scripts/prova-mcp.mjs).
// incassiPerConti(incassi, casse): gli incassi con solo data, importo, metodo, voce, annullato.
// saldiCasse(casse, righe, chiusure, giorno): il saldo di ogni cassa, mai il previsto della Cassa Contanti.
// ---------------------------------------------------------------------------
console.log('\n90. gli incassi per i conti della chat, senza nomi')
{
  const r1 = ricevuta(40, 'Luca', 'Rossi', [voce('QUOTA ASSOCIATIVA', 3000, [pag('2026-09-05', 3000)]), voce('TRIMESTRE BIMBI', 12000, [pag('2026-09-15', 6000, 'POS'), pag('2026-10-15', 6000, 'POS')])], { note: 'Luca Rossi, corso bimbi' })
  const r2 = ricevuta(41, 'Giulia', 'Bianchi', [voce('ALTRO', 8000, [pag('2026-10-11', 8000)])], { annullataIl: '2026-10-12T10:00:00Z' })
  const d1 = diretto('d40', 'p-Rossi', '2026-10-16', 4000, { metodo: 'Satispay', voce: 'ANNUALE BIMBI', nota: 'Pagato per Rossi Luca' })
  const pagamenti = [...m.righeDaRicevute([r1, r2]), ...m.righeDirette([d1], nomeDi)]
  const incassi = pagamenti.map((r) => ({ data: r.data, importo: r.importo, metodo: r.metodo, voce: r.voce, annullato: r.annullato }))
  const conNomi = prova(() => m.incassiDerivati(pagamenti, casse))
  const senza = prova(() => m.incassiPerConti(incassi, casse))
  ok('una riga per pagamento: la rata conta nel giorno del suo pagamento', prova(() => senza.map((r) => [r.tipo, r.data, r.importo, r.voce, r.cassaId, r.annullato])), prova(() => conNomi.map((r) => [r.tipo, r.data, r.importo, r.voce, r.cassaId, r.annullato])))
  ok('gli stessi residui delle casse degli incassi con i nomi', prova(() => m.residui(casse, senza)), prova(() => m.residui(casse, conNomi)))
  ok('gli stessi totali per voce', prova(() => m.perVoce(senza)), prova(() => m.perVoce(conNomi)))
  ok('ogni riga ha un id suo', prova(() => [new Set(senza.map((r) => r.id)).size, senza.length]), [5, 5])
  ok('nessun testo contiene un nome', prova(() => (Array.isArray(senza) && senza.length ? JSON.stringify(senza).match(/Rossi|Luca|Bianchi|Giulia/g) : 'nessuna riga')), null)
  ok('non sono movimenti a mano: lo storico importato si riconosce ancora (sovrapposizione del bilancio)', prova(() => senza.every((r) => r.origine !== 'movimento')), true)
}

console.log('\n91. i saldi delle casse per la chat')
{
  const tre = [
    { id: 'c1', nome: 'Cassa Contanti', saldoIniziale: 10000, dal: '2026-09-01' },
    { id: 'c2', nome: 'Conto Corrente', saldoIniziale: 50000 },
    { id: 'c3', nome: 'Cassa eventi', saldoIniziale: 2000, dal: '2026-10-15' },
  ]
  const r = (id, data, tipo, importo, cassaId, extra = {}) => ({ id, origine: 'movimento', tipo, data, importo, descrizione: 'x', voce: tipo === 'giroconto' ? null : 'Varie', cassaId, annullato: false, ...extra })
  const righe = [
    r('a', '2026-09-10', 'entrata', 3000, 'c1'),
    r('b', '2026-09-20', 'uscita', 1200, 'c2'),
    r('c', '2026-10-05', 'giroconto', 2000, 'c1', { cassaAId: 'c2' }),
    r('k', '2026-10-10', 'entrata', 300, 'c1', { voce: 'Differenza di cassa' }),
    r('d', '2026-10-13', 'uscita', 1800, 'c1'),
    r('e', '2026-10-16', 'entrata', 700, 'c3'),
    r('f', '2026-10-17', 'uscita', 400, 'c2', { annullato: true }),
  ]
  // In regola: il previsto scritto è quello che torna ancora, senza la differenza della chiusura.
  const previsto = prova(() => m.previstoCassa(tre, righe.filter((x) => x.id !== 'k'), 'c1', '2026-10-10'))
  const k = { id: 'k1', cassaId: 'c1', dal: '2026-09-01', data: '2026-10-10', previsto, contato: previsto + 300, differenza: 300, movimentoId: 'k', chiusaIl: '2026-10-10T19:00:00Z' }
  const s = prova(() => m.saldiCasse(tre, righe, [k], '2026-10-20'))
  const di = (id, x = s) => prova(() => x.find((c) => c.cassaId === id))
  ok('il Conto Corrente: il saldo secondo i conti al giorno chiesto', prova(() => di('c2').saldo), prova(() => m.previstoCassa(tre, righe, 'c2', '2026-10-20')))
  ok('…cioè saldo iniziale + entrate − uscite ± giroconti, annullati fuori', prova(() => di('c2').saldo), 50000 - 1200 + 2000)
  ok('la Cassa Contanti: mai il previsto, la chiusura è alla cieca', prova(() => di('c1').saldo), null)
  ok('…solo l\'ultima chiusura: il giorno e quanto si è contato, in regola', prova(() => { const u = di('c1').ultimaChiusura; return [u.data, u.contato, u.nonPiuInRegola] }), prova(() => ['2026-10-10', previsto + 300, false]))
  const storta = prova(() => m.saldiCasse(tre, righe, [{ ...k, previsto: previsto - 1000 }], '2026-10-20'))
  ok('…«non più in regola» se il previsto di allora non torna più', prova(() => di('c1', storta).ultimaChiusura.nonPiuInRegola), true)
  ok('senza chiusure: niente, e nessun importo', prova(() => { const c = di('c1', m.saldiCasse(tre, righe, [], '2026-10-20')); return [c.saldo, c.ultimaChiusura] }), [null, null])
  ok('una chiusura annullata non conta', prova(() => di('c1', m.saldiCasse(tre, righe, [{ ...k, annullataIl: '2026-10-11T08:00:00Z' }], '2026-10-20')).ultimaChiusura), null)
  ok('una chiusura dopo il giorno chiesto non c\'è ancora', prova(() => di('c1', m.saldiCasse(tre, righe, [k], '2026-10-08')).ultimaChiusura), null)
  ok('una cassa partita: il suo saldo', prova(() => di('c3').saldo), 2700)
  const prima = prova(() => di('c3', m.saldiCasse(tre, righe, [k], '2026-10-10')))
  ok('una cassa non ancora partita al giorno chiesto: da quando, mai un importo', prova(() => [prima.saldo, prima.parteIl]), [null, '2026-10-15'])
  ok('al giorno chiesto: i movimenti dopo non contano', prova(() => di('c2', m.saldiCasse(tre, righe, [k], '2026-09-30')).saldo), 50000 - 1200)
  ok('le casse nell\'ordine in cui arrivano, col nome', prova(() => s.map((c) => c.nome)), ['Cassa Contanti', 'Conto Corrente', 'Cassa eventi'])
}

console.log('\n92. la ricerca di MOVIMENTI non bada agli spazi in più')
{
  const r = (id, descrizione) => ({ id, origine: 'movimento', tipo: 'uscita', data: '2026-10-01', importo: 100, descrizione, voce: null, cassaId: 'c2', annullato: false })
  const righe = [r('a', 'FERRAMENTA   bianchi'), r('b', 'ferramenta bianchi'), r('c', 'ferramentabianchi')]
  ok('«ferramenta bianchi» trova anche quella con tre spazi in mezzo, non quella attaccata', m.filtraMovimenti(righe, { testo: 'ferramenta bianchi' }).map((x) => x.id), ['a', 'b'])
  ok('…e scritta con due spazi trova le stesse', m.filtraMovimenti(righe, { testo: 'ferramenta  bianchi' }).map((x) => x.id), ['a', 'b'])
}

console.log('\n93. la riga di stato di MOVIMENTI dice quali filtri sono accesi, e ognuno si toglie da solo')
{
  const base = prova(() => m.FILTRI_INIZIALI)
  ok('alla partenza: tutto l\'anno, il resto vuoto', base, { testo: '', periodo: 'anno', tipo: '', cassaId: '', voce: '', persona: '', annullati: false })
  const nomi = { nomeCassa: (id) => ({ c1: 'Cassa Contanti', c2: 'Conto Corrente' })[id] ?? '', mese: 'Ottobre 2026' }
  ok('alla partenza nessuna pillola', prova(() => m.filtriAccesi(base, nomi)), [])
  const tutti = { testo: '  affitto ', periodo: 'mese', tipo: 'uscita', cassaId: 'c2', voce: 'Affitto sala', persona: 'da_decidere', annullati: true }
  ok('ogni filtro acceso ha la sua pillola, nell\'ordine dei filtri', prova(() => m.filtriAccesi(tutti, nomi)), [
    { chiave: 'testo', testo: '«affitto»' },
    { chiave: 'periodo', testo: 'Ottobre 2026' },
    { chiave: 'tipo', testo: 'Uscite' },
    { chiave: 'cassaId', testo: 'Conto Corrente' },
    { chiave: 'voce', testo: 'Affitto sala' },
    { chiave: 'persona', testo: 'Da decidere' },
    { chiave: 'annullati', testo: 'Con gli annullati' },
  ])
  ok('le pillole sono tante quanti i filtri attivi', prova(() => m.filtriAccesi(tutti, nomi).length === m.filtriAttivi(tutti)), true)
  ok('«Mese scorso», «Tutto», «Entrate», «Giroconti», «Collegati», «Senza scheda»', prova(() => [
    m.filtriAccesi({ ...base, periodo: 'scorso' }, nomi)[0].testo,
    m.filtriAccesi({ ...base, periodo: 'tutto' }, nomi)[0].testo,
    m.filtriAccesi({ ...base, tipo: 'entrata' }, nomi)[0].testo,
    m.filtriAccesi({ ...base, tipo: 'giroconto' }, nomi)[0].testo,
    m.filtriAccesi({ ...base, persona: 'collegati' }, nomi)[0].testo,
    m.filtriAccesi({ ...base, persona: 'senza_scheda' }, nomi)[0].testo,
  ]), ['Mese scorso', 'Tutto', 'Entrate', 'Giroconti', 'Collegati', 'Senza scheda'])
  ok('una cassa che non si trova fa comunque una pillola che si legge', prova(() => m.filtriAccesi({ ...base, cassaId: 'sparita' }, nomi)), [{ chiave: 'cassaId', testo: 'Cassa' }])
  ok('una ricerca di soli spazi non fa pillola', prova(() => m.filtriAccesi({ ...base, testo: '   ' }, nomi)), [])
  ok('la ✕ del periodo lo riporta a tutto l\'anno, il resto resta', prova(() => m.togliFiltro(tutti, 'periodo')), { ...tutti, periodo: 'anno' })
  ok('la ✕ della cassa toglie solo la cassa', prova(() => m.togliFiltro(tutti, 'cassaId')), { ...tutti, cassaId: '' })
  ok('la ✕ di «Con gli annullati» li nasconde di nuovo', prova(() => m.togliFiltro(tutti, 'annullati').annullati), false)
}

console.log('\n94. le icone di casse e voci: solo per i nomi che si riconoscono')
{
  ok('le tre casse della palestra', prova(() => ['Cassa Contanti', 'Conto Corrente', 'Satispay'].map(m.iconaCassa)), ['banconota', 'banca', 'telefono'])
  ok('una cassa con un altro nome: nessuna icona', prova(() => m.iconaCassa('Cassa eventi')), null)
  const voci = ['Quota associativa', 'Tesseramento', 'Corsi e altri pagamenti', 'Pagamento istruttori', 'Pagamento utenze', 'Spese telefoniche', 'Attrezzature', 'Affitto sala', 'Affitto palestre Rivoli', 'Commissioni bancarie']
  ok('le voci della palestra che si riconoscono', prova(() => voci.map(m.iconaVoce)), ['tessera', 'tessera', 'persone', 'persone', 'lampadina', 'telefono', 'manubrio', 'casa', 'casa', 'banca'])
  ok('maiuscole e spazi non contano', prova(() => m.iconaVoce('  AFFITTO sala ')), 'casa')
  ok('«Varie», «Da classificare» e una voce senza nome: nessuna icona', prova(() => ['Varie', 'Da classificare', null].map(m.iconaVoce)), [null, null, null])
}

console.log('\n95. quote e corsi scritti a mano hanno la persona (supabase/98-quote-persona.sql)')
{
  const oggi = '2026-09-26'
  ok('la frase «una riga alla volta» è una sola', m.UNA_RIGA_ALLA_VOLTA, 'Una quota o un corso si sposta una riga alla volta, con la persona: apri il movimento dall’elenco e cambia la voce lì.')
  ok('vuolePersona: solo le entrate su Quota e Corsi', prova(() => [
    m.vuolePersona('entrata', 'Quota associativa'), m.vuolePersona('entrata', 'Corsi e altri pagamenti'),
    m.vuolePersona('entrata', 'Donazioni'), m.vuolePersona('uscita', 'Quota associativa'), m.vuolePersona('uscita', 'Affitto sala'), m.vuolePersona('entrata', null),
  ]), [true, true, false, false, false, false])

  console.log('   cosaNonVaMovimento: la persona')
  const buono = { tipo: 'entrata', data: '2026-09-10', importo: 4000, voceId: 'v-quota', cassaId: 'c1', descrizione: 'Quota di Rossi' }
  const di = (cambio) => prova(() => m.cosaNonVaMovimento({ ...buono, ...cambio }, voci, casse, oggi))
  ok('una quota senza persona: scegli la persona', di({}), 'Scegli la persona')
  ok('…con la persona vuota anche', di({ personaId: '' }), 'Scegli la persona')
  ok('…con la persona va', di({ personaId: 'g1' }), null)
  ok('un corso senza persona: scegli la persona', di({ voceId: 'v-corsi' }), 'Scegli la persona')
  ok('…con la persona va', di({ voceId: 'v-corsi', personaId: 'g1' }), null)
  ok('una donazione non ha bisogno della persona', di({ voceId: 'v-don' }), null)
  ok('…e se c\'è non dà fastidio', di({ voceId: 'v-don', personaId: 'g1' }), null)
  ok('un\'uscita non ha bisogno della persona', di({ tipo: 'uscita', voceId: 'v-aff' }), null)
  ok('come il database: senza persona e senza descrizione dice prima della persona', di({ descrizione: '' }), 'Scegli la persona')
  ok('gli altri rifiuti restano: una quota senza descrizione dice della descrizione', di({ personaId: 'g1', descrizione: '' }), m.cosaNonVaMovimento({ ...buono, voceId: 'v-don', descrizione: '' }, voci, casse, oggi))

  console.log('   cosaNonVaCambioVoce: la persona e le righe una alla volta')
  const vv = [
    ...voci,
    { id: 'v-dcE', nome: 'Da classificare', tipo: 'entrata', diSistema: false, attiva: true },
    { id: 'v-difU', nome: 'Differenza di cassa', tipo: 'uscita', diSistema: true, attiva: true },
  ]
  const mv = (id, o) => ({ id, tipo: 'entrata', data: '2026-09-02', importo: 5000, voceId: 'v-don', cassaId: 'c2', descrizione: `Movimento ${id}`, creatoIl: '2026-09-02T10:00:00Z', ...o })
  const righe = m.righeMovimenti([], [
    mv('x1'), mv('x2'),
    mv('p1', { voceId: 'v-dcE', origineImport: 'prima-nota:1', data: '2019-03-14' }), mv('p2', { voceId: 'v-dcE', origineImport: 'prima-nota:2', data: '2019-03-15' }),
    mv('q1', { voceId: 'v-quota' }), mv('q2', { voceId: 'v-quota', personaId: 'g1' }),
    mv('an', { annullatoIl: '2026-09-03T00:00:00Z' }),
    mv('u1', { tipo: 'uscita', voceId: 'v-aff' }),
  ], vv)
  const no = (ids, voce, persona) => prova(() => m.cosaNonVaCambioVoce(ids, righe, vv, voce, persona))
  ok('due a mano verso Quota: una riga alla volta', no(['x1', 'x2'], 'v-quota', 'g1'), m.UNA_RIGA_ALLA_VOLTA)
  ok('…verso Corsi anche', no(['x1', 'x2'], 'v-corsi', 'g1'), m.UNA_RIGA_ALLA_VOLTA)
  ok('…senza persona prima la regola delle righe', no(['x1', 'x2'], 'v-quota'), m.UNA_RIGA_ALLA_VOLTA)
  ok('uno a mano e uno dello storico insieme, verso Quota: una riga alla volta', no(['x1', 'p1'], 'v-quota', 'g1'), m.UNA_RIGA_ALLA_VOLTA)
  ok('uno a mano senza persona: scegli la persona', no(['x1'], 'v-quota'), 'Scegli la persona')
  ok('…con la persona vuota anche', no(['x1'], 'v-corsi', ''), 'Scegli la persona')
  ok('uno a mano con la persona: va', no(['x1'], 'v-quota', 'g1'), null)
  ok('lo storico in blocco verso Quota senza persona: va (resta come oggi)', no(['p1', 'p2'], 'v-quota'), null)
  ok('…verso Corsi anche', no(['p1', 'p2'], 'v-corsi'), null)
  ok('lo storico da solo, senza persona: va', no(['p1'], 'v-quota'), null)
  ok('movimenti già sulla voce di arrivo: niente da cambiare, la persona non serve', no(['q1', 'q2'], 'v-quota'), null)
  ok('altre voci in blocco, a mano compresi: come prima', no(['x1', 'x2'], 'v-dcE'), null)
  ok('…e la persona non dà fastidio', no(['x1'], 'v-dcE', 'g1'), null)
  ok('vuolePersonaRiga: a mano verso Quota sì, dallo storico no, già lì no, verso altro no, un\'uscita no', prova(() => [
    m.vuolePersonaRiga({ tipo: 'entrata', voce: 'Donazioni' }, 'Quota associativa'),
    m.vuolePersonaRiga({ tipo: 'entrata', voce: 'Da classificare', origineImport: 'prima-nota:1' }, 'Quota associativa'),
    m.vuolePersonaRiga({ tipo: 'entrata', voce: 'Quota associativa' }, 'Quota associativa'),
    m.vuolePersonaRiga({ tipo: 'entrata', voce: 'Donazioni' }, 'Da classificare'),
    m.vuolePersonaRiga({ tipo: 'uscita', voce: 'Affitto sala' }, 'Quota associativa'),
  ]), [true, false, false, false, false])
  ok('il cambio in blocco usa vuolePersonaRiga: anche uno solo a mano verso Quota va aperto dal dettaglio', /vuolePersonaRiga\(r, nomeVoce\)\)\) return UNA_RIGA_ALLA_VOLTA/.test(readFileSync('src/components/segreteria/Contabilita.tsx', 'utf8')), true)
  ok('un annullato resta annullato, con o senza persona', [no(['an'], 'v-quota', 'g1'), no(['an'], 'v-quota')], Array(2).fill('Il movimento del 02/09/2026 (Movimento an) è annullato: non si cambia'))
  ok('una voce di entrata a un\'uscita: prima il tipo, poi la persona', no(['u1'], 'v-quota', 'g1'), 'La voce scelta non va con questo tipo di movimento')
  ok('senza movimenti, i controlli di prima', no([], 'v-quota', 'g1'), 'Scegli almeno un movimento')

  console.log('   ricevutaDoppione: l\'avviso prima di scrivere una quota che sembra già pagata')
  const r = (id, o) => ({ id, origine: 'ricevuta', tipo: 'entrata', data: '2026-09-10', importo: 4500, descrizione: 'Rossi', voce: 'Quota associativa', cassaId: 'c2', annullato: false, personaId: 'g1', ...o })
  const doppio = (rr, persona = 'g1', importo = 4500, data = '2026-09-10') => prova(() => m.ricevutaDoppione(rr, persona, importo, data)?.id ?? null)
  ok('una ricevuta della stessa persona, stesso importo, stesso giorno: è un doppione', doppio([r('a')]), 'a')
  ok('…un pagamento di PAGAMENTI anche', doppio([r('a', { origine: 'pagamento' })]), 'a')
  ok('…30 giorni prima ancora sì', doppio([r('a', { data: '2026-08-11' })]), 'a')
  ok('…31 giorni prima no', doppio([r('a', { data: '2026-08-10' })]), null)
  ok('…dopo la data no', doppio([r('a', { data: '2026-09-11' })]), null)
  ok('un\'altra persona no', doppio([r('a', { personaId: 'g2' })]), null)
  ok('un altro importo no', doppio([r('a', { importo: 4600 })]), null)
  ok('un annullato no', doppio([r('a', { annullato: true })]), null)
  ok('un movimento a mano no: non è un incasso iscritto', doppio([r('a', { origine: 'movimento' })]), null)
  ok('senza righe, nessun doppione', doppio([]), null)
  ok('senza persona, nessun doppione', doppio([r('a', { personaId: undefined })], ''), null)
  ok('se ce n\'è più d\'uno rende il primo dell\'elenco', doppio([r('a', { origine: 'movimento' }), r('b'), r('c')]), 'b')
}

console.log('\n96. le schede di CONTABILITÀ sono come quelle di IMPOSTAZIONI, sotto il titolo')
{
  const tsx = readFileSync('src/components/segreteria/Contabilita.tsx', 'utf8')
  ok('non più Segmenti per le quattro schede', /<Segmenti\s+etichetta="Contabilità"/.test(tsx), false)
  const testa = tsx.indexOf('<Testa titolo="CONTABILITÀ"')
  const schede = tsx.search(/role="tablist"\s+aria-label="Contabilità"\s+className="schede sg-schede"/)
  ok('un tablist «Contabilità» con le schede, dopo la Testa', testa >= 0 && schede > testa, true)
  ok('ogni scheda è un role="tab" con aria-selected', /role="tab"[^>]*aria-selected=\{scheda === s\}/.test(tsx), true)
  // Come IMPOSTAZIONI: frecce, Home e Fine; nel giro del Tab solo la scheda aperta.
  ok('la tastiera delle schede viene da `tastoLinguette`, e solo la scheda aperta ha tabIndex 0', /tastoLinguette\(/.test(tsx) && /tabIndex=\{scheda === s \? 0 : -1\}/.test(tsx), true)
}

console.log('\n96b. CONTABILITÀ non manda a una pagina PAGAMENTI che non c\'è più')
{
  const tsx = readFileSync('src/components/segreteria/Contabilita.tsx', 'utf8')
  // Solo i testi che si leggono: i commenti possono ricordare com'era.
  const testi = tsx.split('\n').filter((r) => !/^\s*(\/\/|\*|\/\*)/.test(r)).join('\n')
  ok('nessun testo dice «PAGAMENTI» in maiuscolo', testi.match(/\bPAGAMENTI\b/g) ?? [], [])
}

console.log('\n97. l\'estratto conto: le righe di MOVIMENTI con il saldo dopo ognuna, sulle casse scelte')
{
  const K = [
    { id: 'c1', nome: 'Cassa Contanti', saldoIniziale: 10000, dal: '2026-09-01' },
    { id: 'c2', nome: 'Conto Corrente', saldoIniziale: 0 },
    { id: 'c3', nome: 'Satispay', saldoIniziale: 500 },
  ]
  const R = [
    riga('v0', 'entrata', '2026-08-31', 9999, 'c1'), // prima del «dal» di c1: non conta mai
    riga('e1', 'entrata', '2026-09-10', 4000, 'c1'),
    riga('a1', 'entrata', '2026-09-11', 777, 'c1', { annullato: true }),
    riga('u1', 'uscita', '2026-09-12', 2500, 'c1'),
    riga('g1', 'giroconto', '2026-09-15', 1000, 'c1', { cassaAId: 'c2' }),
    riga('g2', 'giroconto', '2026-09-18', 200, 'c2', { cassaAId: 'c3' }),
    riga('e2', 'entrata', '2026-09-20', 1000, 'c2'),
    riga('e3', 'entrata', '2026-09-25', 300, 'c3'),
    riga('u2', 'uscita', '2026-10-02', 100, 'c3'),
  ]
  const ec = (f = {}, righe = R) => prova(() => m.estrattoConto(righe, K, f))
  const somme = (x) => (x.righe ? [x.saldoIniziale, x.entrate, x.uscite, x.saldoFinale] : x)
  // Se la funzione non c'è, `ec` dà il testo dell'errore: lo si mostra come unica riga.
  const per = (x) => (x.righe ? x.righe.map((r) => [r.riga.id, r.entrata, r.uscita, r.saldo]) : [[x]])

  const tutte = ec()
  ok('tutte le casse, senza periodo: saldo iniziale, entrate, uscite, saldo finale', somme(tutte), [10500, 5300, 2600, 13200])
  ok('dal più recente, con il saldo dopo ogni movimento; i giroconti fra casse considerate non lo spostano', per(tutte), [
    ['u2', 0, 100, 13200], ['e3', 300, 0, 13300], ['e2', 1000, 0, 13000], ['g2', 0, 0, 12000], ['g1', 0, 0, 12000], ['u1', 0, 2500, 12000], ['e1', 4000, 0, 14500],
  ])
  ok('la riga in cima ha il saldo finale', tutte.righe ? tutte.righe[0].saldo === tutte.saldoFinale : tutte, true)
  ok('con tutte le casse e senza periodo il saldo finale è la somma dei residui del BILANCIO',
    tutte.righe ? tutte.saldoFinale : tutte, prova(() => m.totaleResidui(m.residui(K, R))))
  ok('cassaIds vuoto = tutte le casse', somme(ec({ cassaIds: [] })), [10500, 5300, 2600, 13200])

  const due = ec({ cassaIds: ['c1', 'c3'] })
  ok('tre casse, filtro su due: iniziale 10500, entrate 4500, uscite 3600, finale 11400', somme(due), [10500, 4500, 3600, 11400])
  ok('…il giroconto verso una cassa fuori è un\'uscita, quello da una fuori un\'entrata, e i movimenti dell\'altra cassa non ci sono', per(due), [
    ['u2', 0, 100, 11400], ['e3', 300, 0, 11500], ['g2', 200, 0, 11200], ['g1', 0, 1000, 11000], ['u1', 0, 2500, 12000], ['e1', 4000, 0, 14500],
  ])
  ok('il saldo finale è la somma dei residui delle due casse', due.righe ? due.saldoFinale : due,
    prova(() => m.residui(K, R).filter((x) => x.cassaId !== 'c2').reduce((t, x) => t + x.residuo, 0)))
  const trattoDue = ec({ cassaIds: ['c1', 'c2'] })
  ok('c1 e c2: il giroconto fra le due c\'è, a zero; quello verso c3 è un\'uscita; c3 non c\'è', per(trattoDue), [
    ['e2', 1000, 0, 12300], ['g2', 0, 200, 11300], ['g1', 0, 0, 11500], ['u1', 0, 2500, 11500], ['e1', 4000, 0, 14000],
  ])
  ok('…e i conti tornano', somme(trattoDue), [10000, 5000, 2700, 12300])
  ok('un giroconto fra casse che non sono considerate non compare', per(ec({ cassaIds: ['c3'] })).filter(([id]) => id === 'g1'), [])

  const dal = ec({ dal: '2026-09-15' })
  ok('un periodo sposta il saldo iniziale: conta quel che è successo prima (e gli annullati no)', somme(dal), [12000, 1300, 100, 13200])
  ok('…e dal periodo restano solo le righe dentro', per(dal).map(([id]) => id), ['u2', 'e3', 'e2', 'g2', 'g1'])
  ok('dal e al sono inclusivi', per(ec({ dal: '2026-09-12', al: '2026-09-12' })), [['u1', 0, 2500, 12000]])
  ok('…e il saldo iniziale è quello della sera prima', somme(ec({ dal: '2026-09-12', al: '2026-09-12' })), [14500, 0, 2500, 12000])
  ok('un movimento prima del «dal» della cassa non conta mai, nemmeno senza periodo', somme(ec({ cassaIds: ['c1'] })), [10000, 4000, 3500, 10500])

  const conAnnullati = ec({ annullati: true })
  ok('un annullato compare solo se lo si chiede, a zero e col saldo di prima', per(conAnnullati).filter(([id]) => id === 'a1'), [['a1', 0, 0, 14500]])
  ok('…e non cambia nessun totale', somme(conAnnullati), [10500, 5300, 2600, 13200])
  ok('…senza la richiesta non c\'è', per(tutte).filter(([id]) => id === 'a1'), [])

  ok('tipo uscita su c1 e c3: le uscite vere e il giroconto che esce', per(ec({ cassaIds: ['c1', 'c3'], tipo: 'uscita' })).map(([id]) => id), ['u2', 'g1', 'u1'])
  ok('tipo entrata su c1 e c3: le entrate vere e il giroconto che entra', per(ec({ cassaIds: ['c1', 'c3'], tipo: 'entrata' })).map(([id]) => id), ['e3', 'g2', 'e1'])
  ok('tipo vuoto: tutti', per(ec({ tipo: '' })).length, 7)
  ok('il testo cerca come nell\'elenco', per(ec({ testo: 'e2' })).map(([id]) => id), ['e2'])
  ok('…e il saldo resta quello vero: cercare non lo cambia', [per(ec({ testo: 'e2' }))[0][3], ec({ testo: 'e2' }).saldoFinale], [per(tutte).find(([id]) => id === 'e2')[3], tutte.saldoFinale])
  ok('una voce che non c\'è: nessuna riga', per(ec({ voce: 'Inesistente' })), [])

  const pari = [riga('p1', 'entrata', '2026-09-20', 100, 'c1'), riga('p2', 'entrata', '2026-09-20', 50, 'c1')]
  ok('a pari data il più in basso dell\'elenco è il primo nel tempo', per(ec({ cassaIds: ['c1'] }, pari)), [['p1', 100, 0, 10150], ['p2', 50, 0, 10050]])
}

console.log('\n98. il tipo di un movimento ha una colonna sua, e la riga non ripete i dati delle colonne')
{
  const tipo = (origine, t) => prova(() => m.tipoMovimento({ origine, tipo: t }))
  ok('un incasso di un iscritto (da ricevuta o diretto)', [tipo('ricevuta', 'entrata'), tipo('pagamento', 'entrata')], [{ nome: 'Incasso iscritto', icona: 'tessera' }, { nome: 'Incasso iscritto', icona: 'tessera' }])
  ok('un giroconto', tipo('movimento', 'giroconto'), { nome: 'Giroconto', icona: 'frecce' })
  ok('un\'entrata e un\'uscita a mano', [tipo('movimento', 'entrata'), tipo('movimento', 'uscita')], [{ nome: 'Entrata', icona: 'banconota' }, { nome: 'Uscita', icona: 'banconota' }])
  const voce = (r, persona) => prova(() => m.lineaVoce(r, persona))
  ok('la linea della voce dice la voce', voce({ descrizione: 'Rossi Giulia', voce: 'Quota associativa' }, undefined), 'Quota associativa')
  ok('…e la persona solo se non è già il nome della riga', [voce({ descrizione: 'Affitto sala', voce: 'Affitto sala' }, 'Rossi Giulia'), voce({ descrizione: 'Rossi Giulia', voce: 'Quota associativa' }, 'Rossi Giulia')], ['Affitto sala · Rossi Giulia', 'Quota associativa'])
  ok('…senza badare a maiuscole e spazi', voce({ descrizione: ' ROSSI giulia ', voce: 'Quota associativa' }, 'Rossi Giulia'), 'Quota associativa')
  ok('un giroconto non ha voce', voce({ descrizione: 'Giroconto da A a B', voce: null }, undefined), '')
}

console.log('\n99. ogni riga dice da dove viene')
{
  const da = (r) => prova(() => m.originiMovimento(r))
  ok('un incasso di un iscritto e un movimento scritto qui', [da({ origine: 'ricevuta' }), da({ origine: 'pagamento' }), da({ origine: 'movimento' })], ['Dal gestionale', 'Dal gestionale', 'Dal gestionale'])
  ok('dalla banca, dallo storico, da Satispay, dalla chat', [da({ origine: 'movimento', origineImport: 'banca:x' }), da({ origine: 'movimento', origineImport: 'prima-nota:3' }), da({ origine: 'movimento', satispayId: 's1' }), da({ origine: 'movimento', dallaChat: true })], ['Dalla banca', 'Dallo storico', 'Da Satispay', 'Dalla chat'])
}

console.log(guai ? `\n${guai} COSE NON TORNANO` : '\nTUTTO A POSTO')
process.exit(guai ? 1 : 0)
