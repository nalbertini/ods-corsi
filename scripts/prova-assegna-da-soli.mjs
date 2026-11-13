// ---------------------------------------------------------------------------
// I bonifici che si assegnano da soli, senza browser.
//
//   node scripts/prova-assegna-da-soli.mjs
//
// Una sola regola di «sicuro» (`src/lib/sicuro.ts`): chi ha pagato (il punteggio dell'import, che vale anche per chi è
// già iscritto col nome intero) e come si divide un bonifico collegato (`ripartizioneSicura`: un solo modo di fare
// esattamente l'importo con quel che il nucleo deve). Poi `src/lib/assegna.ts`: quali movimenti si assegnano da soli
// (`daSoli`), perché gli altri no, l'esecutore (`assegnaDaSoli`) e «Togli questo lotto» (`togliLottoAssegnazioni`).
// Importi in centesimi, nomi inventati. Il progetto: canvas in docs/design-canvas/collega-e-assegna/.
// ---------------------------------------------------------------------------
process.env.TZ = 'Europe/Rome'

import { build } from 'esbuild'

globalThis.window = { location: { search: '', hash: '' }, addEventListener() {} }

const impacchetta = async (contents) => {
  const { outputFiles } = await build({
    stdin: { contents, resolveDir: '.', loader: 'ts' },
    bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent', define: { 'import.meta.env': '{}' },
  })
  return import('data:text/javascript;base64,' + Buffer.from(outputFiles[0].text).toString('base64'))
}

let guai = 0
const ok = (cosa, avuto, voluto) => {
  const va = JSON.stringify(avuto) === JSON.stringify(voluto)
  console.log(va ? '  ✓' : '  ✗', cosa, va ? '' : `— atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`)
  if (!va) guai++
}
const prova = (f) => {
  try {
    return f()
  } catch (e) {
    return `ERRORE: ${e.message}`
  }
}
const provaAsync = async (f) => {
  try {
    return await f()
  } catch (e) {
    return `ERRORE: ${e.message}`
  }
}

// Un modulo che ancora non c'è non ferma la prova: ogni caso dice la cosa che manca.
const carica = async (file) => {
  try {
    return await impacchetta(`export * from './src/lib/${file}'`)
  } catch (e) {
    console.log(`  (src/lib/${file}.ts non si carica:`, (e.errors?.[0]?.text ?? e.message).split('\n')[0], ')')
    return {}
  }
}
const S = await carica('sicuro')
const A = await carica('assegna')
const M = await carica('abbinaMovimenti')
const P = await carica('movimentiPersona')
const fn = (mod, file, nome) => (typeof mod[nome] === 'function' ? mod[nome] : () => { throw new Error(`manca ${nome} in src/lib/${file}.ts`) })

const personaSicura = fn(S, 'sicuro', 'personaSicura')
const ripartizioneSicura = fn(S, 'sicuro', 'ripartizioneSicura')
const daSoli = fn(A, 'assegna', 'daSoli')
const assegnaDaSoli = fn(A, 'assegna', 'assegnaDaSoli')
const togliLottoAssegnazioni = fn(A, 'assegna', 'togliLottoAssegnazioni')

// ---- chi ha pagato: una regola sola ------------------------------------------
console.log('Chi ha pagato è «sicuro»')
ok('almeno 4 punti e 2 più del secondo: sicuro', prova(() => personaSicura({ punti: 4, secondo: 0, giaIscritto: false, come: 'nome intero' })), true)
ok('…staccato di 1 solo: no', prova(() => personaSicura({ punti: 4, secondo: 3, giaIscritto: false, come: 'nome intero' })), false)
ok('…3 punti: no', prova(() => personaSicura({ punti: 3, secondo: 0, giaIscritto: false, come: 'genitore' })), false)
ok('già iscritto col nome intero: sicuro (deciso da Nicola il 13/11/2026)', prova(() => personaSicura({ punti: 4, secondo: 0, giaIscritto: true, come: 'nome intero' })), true)
ok('…già iscritto col genitore o il codice: no, come prima', prova(() => [personaSicura({ punti: 7, secondo: 0, giaIscritto: true, come: 'genitore' }), personaSicura({ punti: 4, secondo: 0, giaIscritto: true, come: 'codice fiscale' })]), [false, false])
ok('le soglie stanno in un posto solo', [S.PUNTI_SICURO, S.DISTACCO_SICURO], [4, 2])

const ferri = (id, nome, iscrizioni = []) => ({ id, nome, cognome: 'Ferri', attiva: true, codiceFiscale: null, genitoreNome: null, genitoreCognome: null, genitoreCodiceFiscale: null, iscrizioni })
const abbina = (testo, persone) => prova(() => fn(M, 'abbinaMovimenti', 'abbinaMovimento')({ testo, data: '2026-10-09', codiciFiscali: [] }, persone).preselezionato)
ok('all\'import: Ennio, già iscritto, col nome intero nella causale è preselezionato', abbina('Da Ferri Ennio BONIFICO SEPA', [ferri('ennio', 'Ennio', [{ dal: '2026-09-01', al: null }])]), 'ennio')
ok('…due già iscritti col nome intero: nessuno', abbina('Da Ferri Ennio, Ferri Anna', [ferri('ennio', 'Ennio', [{ dal: '2026-09-01', al: null }]), ferri('anna', 'Anna', [{ dal: '2026-09-01', al: null }])]), null)
ok('lo storico: il nome della causale di una scheda sola è «sicuro», di due no', prova(() => [
  fn(P, 'movimentiPersona', 'abbinaPersone')('Ennio Ferri', [{ id: 'ennio', nome: 'Ennio', cognome: 'Ferri' }]).esito,
  fn(P, 'movimentiPersona', 'abbinaPersone')('Ennio Ferri', [{ id: 'a', nome: 'Ennio', cognome: 'Ferri' }, { id: 'b', nome: 'Ennio', cognome: 'Ferri' }]).esito,
]), ['sicuro', 'omonimi'])

// ---- come si divide: un solo modo ----------------------------------------------
console.log('La divisione è «sicura»')
const v = (personaId, voce, manca, tipo = 'corso') => ({ personaId, voce, tipo, dal: '2026-09-01', manca })
const divisa = (importo, dovuti) => prova(() => {
  const r = ripartizioneSicura(importo, dovuti)
  return r.righe ? r.righe.map((x) => [x.personaId, x.voce, x.importo]) : r.motivo
})
ok('220,00 € e un corso da 220,00 €: tutto lì', divisa(22000, [v('irene', 'Annuale Avviamento', 22000)]), [['irene', 'Annuale Avviamento', 22000]])
ok('270,00 € e quota 50,00 € + corso 220,00 €: tutti e due', divisa(27000, [v('irene', 'Quota associativa 2026/27', 5000, 'quota'), v('irene', 'Annuale Avviamento', 22000)]),
  [['irene', 'Quota associativa 2026/27', 5000], ['irene', 'Annuale Avviamento', 22000]])
ok('un solo modo anche se non copre tutto quel che deve: la quota sola', divisa(5000, [v('irene', 'Quota associativa 2026/27', 5000, 'quota'), v('irene', 'Annuale Avviamento', 22000)]), [['irene', 'Quota associativa 2026/27', 5000]])
ok('440,00 € fra due fratelli e tre corsi da 220,00 €: più modi', divisa(44000, [v('irene', 'Annuale A', 22000), v('marco', 'Annuale B', 22000), v('irene', 'Annuale C', 22000)]), 'piu modi')
ok('270,00 € con quota e due corsi da 220,00 €: più modi', divisa(27000, [v('irene', 'Quota', 5000, 'quota'), v('irene', 'Annuale A', 22000), v('irene', 'Annuale B', 22000)]), 'piu modi')
ok('180,00 € contro 220,00 €: pagato in parte', divisa(18000, [v('irene', 'Annuale A', 22000)]), 'in parte')
ok('500,00 € contro 220,00 €: più di quel che deve', divisa(50000, [v('irene', 'Annuale A', 22000)]), 'di piu')
ok('niente da pagare', divisa(22000, []), 'niente')
ok('troppe cose da pagare per contarle: non si rischia', divisa(22000, Array.from({ length: 17 }, (_, i) => v('x', `Voce ${i}`, 100 + i))), 'piu modi')

// ---- quali bonifici, e perché gli altri no -------------------------------------
console.log('Quali bonifici si assegnano da soli')
const oggi = '2026-11-12'
const CONTO = { id: 'conto', nome: 'Conto Corrente', saldoIniziale: 0 }
const CONTANTI = { id: 'contanti', nome: 'Cassa Contanti', saldoIniziale: 0 }
const voci = [
  { id: 'v-quota', nome: 'Quota associativa', tipo: 'entrata', diSistema: true, attiva: true },
  { id: 'v-corsi', nome: 'Corsi e altri pagamenti', tipo: 'entrata', diSistema: true, attiva: true },
]
const listino = { quota: 50, saldoEntro: '2026-08-31', offerte: [], corsi: [{ corso: 'Judo adulti', eta: '', orari: [], prezzi: [{ annuale: 610, trimestre: 200 }] }], senzaPrezzoVaBene: [] }
const corsi = [{ id: 'adulti', nome: 'Judo adulti' }]
const persona = (id, o = {}) => ({ id, nome: id, cognome: 'Test', attiva: true, certificato: { scade: '2027-09-01', conFile: false }, documento: true, pagamento: { stato: 'da_pagare' }, natoIl: '1990-01-01', iscrizioni: [{ corsoId: 'adulti', dal: '2026-09-01' }], quote: [], vociCorsi: [], ...o })
const mov = (id, importo, personaId, o = {}) => ({ id, tipo: 'entrata', data: '2026-11-04', importo, voceId: 'v-corsi', cassaId: 'conto', descrizione: `Bonifico ${id}`, creatoIl: '2026-11-04T10:00:00Z', personaId, ...o })
const contesto = (manuali, o = {}) => ({ manuali, diretti: [], ricevute: [], casse: [CONTO, CONTANTI], voci, persone: [persona('sofia'), persona('luca', { pagamento: { stato: 'pagato', fino: '2027-07-31' } }), persona('anna')], corsi, listino, oggi, ...o })
const elenco = (c, ids) => prova(() => {
  const r = daSoli(c, ids)
  return { pronti: r.pronti.map((x) => [x.movimentoId, x.righe.map((y) => [y.personaId, y.voce, y.importo])]), perche: r.perche }
})
ok('660,00 € di Sofia (quota + annuale): si assegna da solo', elenco(contesto([mov('m1', 66000, 'sofia')])).pronti,
  [['m1', [['sofia', 'Quota associativa 2026/27', 5000], ['sofia', 'Annuale Judo adulti', 61000]]]])
ok('…anche solo fra i movimenti chiesti (dopo un collegamento)', elenco(contesto([mov('m1', 66000, 'sofia'), mov('m2', 66000, 'anna')]), ['m2']).pronti?.map((x) => x[0]), ['m2'])
ok('180,00 € contro 660,00 €: resta, col perché', elenco(contesto([mov('m3', 18000, 'sofia')])), { pronti: [], perche: { m3: 'Pagato in parte: 180,00 € di 660,00 €. Decidi tu su cosa.' } })
ok('segnato pagato a mano: resta, col perché', elenco(contesto([mov('m4', 66000, 'luca')])).perche, { m4: 'È segnato pagato a mano: di’ tu se è questo bonifico.' })
ok('Satispay o contanti, uscite, senza persona, annullati: fuori, senza perché', elenco(contesto([
  mov('c1', 66000, 'sofia', { cassaId: 'contanti' }), mov('u1', 66000, 'sofia', { tipo: 'uscita' }), mov('s1', 66000, undefined), mov('a1', 66000, 'sofia', { annullatoIl: '2026-11-05T10:00:00Z' }),
])), { pronti: [], perche: {} })
ok('del vecchio programma, di una stagione passata: fuori', elenco(contesto([mov('p1', 66000, 'sofia', { origineImport: 'prima-nota:1', data: '2025-10-01' })])).pronti, [])
ok('già assegnato in parte: fuori, si finisce a mano', elenco(contesto([mov('m5', 66000, 'sofia')], { diretti: [{ id: 'd1', personaId: 'sofia', data: '2026-11-04', importo: 5000, metodo: 'Bonifico', voce: 'Quota associativa 2026/27', movimentoId: 'm5', creatoIl: '2026-11-04T10:00:00Z' }] })), { pronti: [], perche: {} })
ok('con la ricevuta già fatta a parte: resta, va abbinata', elenco(contesto([mov('m6', 66000, 'sofia')], {
  ricevute: [{ id: 'r1', anno: 2026, numero: 9, data: '2026-11-05', personaId: 'sofia', pagato: 66000, metodo: 'Bonifico', voci: [{ descrizione: 'Annuale Judo adulti', quantita: 1, prezzo: 66000, pagamenti: [{ data: '2026-11-05', importo: 66000, metodo: 'Bonifico' }] }], creataIl: '2026-11-05T10:00:00Z' }],
})).perche, { m6: 'C’è già la ricevuta: abbinala in COLLEGATI PRIMA.' })

// ---- scrivere, e togliere il lotto ---------------------------------------------
console.log('Assegnare e togliere il lotto')
const scritti = []
const d = { assegnaMovimento: async (id, righe, chiave) => { if (id === 'rotto') throw new Error('La rete è caduta'); scritti.push([id, righe.length, chiave]) } }
const pronti = [{ movimentoId: 'm1', righe: [{ personaId: 'sofia', voce: 'Quota', importo: 5000 }] }, { movimentoId: 'm2', righe: [{ personaId: 'anna', voce: 'Quota', importo: 5000 }] }]
const r1 = await provaAsync(() => assegnaDaSoli(d, pronti))
ok('scrive ogni bonifico con la sua chiave, diversa', [scritti.map((x) => x[0]), new Set(scritti.map((x) => x[2])).size, r1.chiavi?.length], [['m1', 'm2'], 2, 2])
const r2 = await provaAsync(() => assegnaDaSoli(d, [pronti[0], { movimentoId: 'rotto', righe: [] }, pronti[1]]))
ok('un guaio ferma il giro e lo dice; quelli fatti restano nel lotto', [r2.chiavi?.length, r2.errore], [1, 'La rete è caduta'])
const annullati = []
const dLotto = {
  pagamentiDiretti: async () => [
    { id: 'p1', chiave: 'k1' }, { id: 'p2', chiave: 'k1' }, { id: 'p3', chiave: 'k2', annullatoIl: '2026-11-06T10:00:00Z' }, { id: 'p4', chiave: 'altra' }, { id: 'p5' },
  ],
  annullaPagamentoDiretto: async (id) => { annullati.push(id) },
}
const t = await provaAsync(() => togliLottoAssegnazioni(dLotto, ['k1', 'k2']))
ok('«Togli questo lotto»: annulla solo le righe attive del lotto (una diventata ricevuta resta)', [annullati, t.tolti], [['p1', 'p2'], 2])

console.log(guai ? `\n${guai} da sistemare` : '\nTUTTO A POSTO')
process.exit(guai ? 1 : 0)
