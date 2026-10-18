// ---------------------------------------------------------------------------
// La contabilità, prima parte, senza browser.
//
//   node scripts/prova-contabilita.mjs
//
// Controlla `src/lib/contabilita.ts`: gli incassi degli iscritti ricavati da
// ricevute e pagamenti (mai copiati), i movimenti fatti a mano, il residuo di
// ogni cassa, i totali, i filtri, il foglio CSV e gli stessi rifiuti di
// `supabase/59-contabilita.sql` (provato da supabase/prova/contabilita.sql).
// ---------------------------------------------------------------------------
import { readFileSync } from 'node:fs'
import { build } from 'esbuild'

const { outputFiles } = await build({
  stdin: {
    contents:
      "export * from './src/lib/contabilita'; export { righeDaRicevute, righeDirette } from './src/lib/pagamenti'; export { ENTE_PREDEFINITO, euro, dataRicevuta } from './src/lib/ricevute'",
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
  ok('Contanti va in Cassa Contanti', prova(() => m.cassaDelMetodo('Contanti')), 'contanti')
  ok('…senza badare a maiuscole e spazi', prova(() => [m.cassaDelMetodo('contanti '), m.cassaDelMetodo(' CONTANTI')]), ['contanti', 'contanti'])
  ok('l\'Assegno va sul conto', prova(() => m.cassaDelMetodo('Assegno')), 'conto')
  ok('tutto il resto sul conto', prova(() => ['Bonifico', 'POS', 'Satispay', 'Carta', ''].map((x) => m.cassaDelMetodo(x))), ['conto', 'conto', 'conto', 'conto', 'conto'])
  ok('la quota associativa, comunque sia scritta', prova(() => ['QUOTA ASSOCIATIVA', 'Quota associativa', 'quota associativa ', '  Quota Associativa'].map((x) => m.voceDiSistema(x))), Array(4).fill('Quota associativa'))
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
      ['ricevuta', 'entrata', '2026-09-10', 3000, 'Rossi Giulia', 'QUOTA ASSOCIATIVA · Contanti', 'Quota associativa', 'c1', false],
      ['ricevuta', 'entrata', '2026-10-01', 2000, 'Rossi Giulia', 'QUOTA ASSOCIATIVA · POS', 'Quota associativa', 'c2', false],
      ['pagamento', 'entrata', '2026-09-12', 1500, "D'Amico Zoë", 'ANNUALE JUDO · Assegno', 'Corsi e altri pagamenti', 'c2', false],
    ])
  ok('gli incassi non hanno una seconda cassa', prova(() => derivati.map((r) => r.cassaAId ?? null)), [null, null, null])
  ok('l\'id è stabile: due volte lo stesso', prova(() => m.incassiDerivati(righe, casse).map((r) => r.id)), prova(() => derivati.map((r) => r.id)))
  ok('…e diverso per ogni pagamento', prova(() => new Set(derivati.map((r) => r.id)).size), 3)
  ok('…e non dipende dall\'ordine in cui arrivano', prova(() => Object.fromEntries(m.incassiDerivati([...righe].reverse(), casse).map((r) => [r.importo, r.id]))), prova(() => Object.fromEntries(derivati.map((r) => [r.importo, r.id]))))
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
  ]
  const diretti = [
    diretto('dd1', 'p-Rossi', '2026-09-08', 2000, { metodo: '  contanti', ...(cambi.annullaD1 ? { annullatoIl: '2026-09-26T10:00:00Z' } : {}) }),
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

console.log('\n27. annullare un incasso in contanti di un giorno chiuso: l\'avviso prima di farlo')
{
  const k14 = chiusa('k14', '2026-09-14')
  const avviso = (pagamenti, chiusure = [k14]) => prova(() => m.avvisoCassaChiusa(pagamenti, chiusure))
  const ATTENZIONE = 'Attenzione: la cassa contanti è chiusa fino al 14/09/2026 e questo incasso in contanti è di quei giorni: la chiusura non sarà più in regola e dovrai scrivere una rettifica.'
  ok('un incasso in contanti dentro i giorni chiusi avvisa', avviso([{ data: '2026-09-10', metodo: 'Contanti' }]), ATTENZIONE)
  ok('…il giorno stesso della chiusura', avviso([{ data: '2026-09-14', metodo: 'Contanti' }]), ATTENZIONE)
  ok('…senza badare a maiuscole e spazi del metodo', avviso([{ data: '2026-09-10', metodo: ' CONTANTI ' }]), ATTENZIONE)
  ok('basta uno dei pagamenti di una ricevuta', avviso([{ data: '2026-09-20', metodo: 'Contanti' }, { data: '2026-09-02', metodo: 'Contanti' }]), ATTENZIONE)
  ok('il giorno dopo la chiusura no', avviso([{ data: '2026-09-15', metodo: 'Contanti' }]), null)
  ok('un pagamento con carta o bonifico non tocca la cassa', avviso([{ data: '2026-09-10', metodo: 'POS' }, { data: '2026-09-10', metodo: 'Bonifico' }]), null)
  ok('senza chiusure niente', avviso([{ data: '2026-09-10', metodo: 'Contanti' }], []), null)
  ok('una chiusura annullata non conta', avviso([{ data: '2026-09-10', metodo: 'Contanti' }], [{ ...k14, annullataIl: '2026-09-15T10:00:00Z' }]), null)
  ok('con due chiusure vale l\'ultima', avviso([{ data: '2026-09-17', metodo: 'Contanti' }], [k14, chiusa('k20', '2026-09-20')]), ATTENZIONE.replace('14/09', '20/09'))
  ok('senza pagamenti niente', avviso([]), null)
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
  for (const [chiamata, riepilogo] of [['registraMovimento', 'riepilogoMovimento'], ['registraGiroconto', 'riepilogoGiroconto']]) {
    ok(`una sola chiamata a ${chiamata}`, tsx.split(`${chiamata}(`).length - 1, 1)
    const i = tsx.indexOf(`${chiamata}(`)
    const inizi = [...tsx.slice(0, i).matchAll(/onClick=\{|=\s*async\b/g)]
    const gestore = tsx.slice(inizi.at(-1)?.index ?? 0, i)
    ok(`${chiamata} sta dopo un \`await chiedi(\` col ${riepilogo}`, [/await chiedi\(/.test(gestore), gestore.includes(`${riepilogo}(`)], [true, true])
    ok(`…e senza il sì si esce prima di scrivere`, /if \(!\(await chiedi\([\s\S]*?\)\)\) return/.test(gestore), true)
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

console.log(guai ? `\n${guai} COSE NON TORNANO` : '\nTUTTO A POSTO')
process.exit(guai ? 1 : 0)
