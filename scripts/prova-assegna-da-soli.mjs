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
ok('già assegnato per intero (un giro rifatto dopo una rete caduta): fuori, non si riscrive', elenco(contesto([mov('m9', 66000, 'sofia')], { diretti: [
  { id: 'd2', personaId: 'sofia', data: '2026-11-04', importo: 5000, metodo: 'Bonifico', voce: 'Quota associativa 2026/27', movimentoId: 'm9', creatoIl: '2026-11-04T10:00:00Z' },
  { id: 'd3', personaId: 'sofia', data: '2026-11-04', importo: 61000, metodo: 'Bonifico', voce: 'Annuale Judo adulti', movimentoId: 'm9', creatoIl: '2026-11-04T10:00:00Z' },
] })), { pronti: [], perche: {} })
ok('con la ricevuta già fatta a parte: resta, va abbinata', elenco(contesto([mov('m6', 66000, 'sofia')], {
  ricevute: [{ id: 'r1', anno: 2026, numero: 9, data: '2026-11-05', personaId: 'sofia', pagato: 66000, metodo: 'Bonifico', voci: [{ descrizione: 'Annuale Judo adulti', quantita: 1, prezzo: 66000, pagamenti: [{ data: '2026-11-05', importo: 66000, metodo: 'Bonifico' }] }], creataIl: '2026-11-05T10:00:00Z' }],
})).perche, { m6: 'C’è già la ricevuta: abbinala qui sopra.' })

ok('due bonifici uguali della stessa persona: se ne assegna uno, l\'altro resta col perché (non si conta due volte)', elenco(contesto([mov('m7', 66000, 'sofia'), mov('m8', 66000, 'sofia', { data: '2026-11-05' })])),
  { pronti: [['m7', [['sofia', 'Quota associativa 2026/27', 5000], ['sofia', 'Annuale Judo adulti', 61000]]]], perche: { m8: 'Nel nucleo non c’è niente da pagare: decidi tu a cosa va.' } })
ok('un bonifico della banca di una stagione passata: fuori, anche se l\'importo torna', elenco(contesto([mov('b1', 66000, 'sofia', { data: '2025-10-01', origineImport: 'banca:x' })])), { pronti: [], perche: {} })

// ---- dopo un collegamento ------------------------------------------------------
console.log('Dopo un collegamento')
const finto = (o = {}) => {
  const fatti = []
  return {
    fatti,
    movimenti: async () => [mov('m1', 66000, 'sofia'), mov('m2', 66000, 'anna')], pagamentiDiretti: async () => [], ricevute: async () => [],
    casse: async () => [CONTO, CONTANTI], voci: async () => voci, persone: async () => contesto([]).persone, corsi: async () => corsi, listino: async () => ({ listino }),
    assegnaMovimento: async (id) => { fatti.push(id) }, ...o,
  }
}
const dd = finto()
ok('senza movimenti chiesti non legge e non scrive niente', await provaAsync(async () => (await fn(A, 'assegna', 'assegnaDopoIlCollegamento')(dd, [], oggi)).chiavi), [])
const r3 = await provaAsync(() => fn(A, 'assegna', 'assegnaDopoIlCollegamento')(dd, ['m2'], oggi))
ok('assegna solo quelli appena collegati', [dd.fatti, r3.chiavi?.length], [['m2'], 1])
ok('un guasto nel leggere non lancia: lo dice', await provaAsync(async () => (await fn(A, 'assegna', 'assegnaDopoIlCollegamento')(finto({ movimenti: async () => { throw new Error('Il server non risponde') } }), ['m1'], oggi)).errore), 'Il server non risponde')
ok('…e dice quanti restano da scegliere', await provaAsync(async () => (await fn(A, 'assegna', 'assegnaDopoIlCollegamento')(finto(), ['m1', 'm2', 'm3'], oggi)).restano), 1)

// ---- chi ha pagato e per cosa: la stessa logica dovunque ---------------------------
console.log('Chi ha pagato e per cosa')
const chiEPerCosa = fn(A, 'assegna', 'chiEPerCosa')
const tipologiaDaRighe = fn(A, 'assegna', 'tipologiaDaRighe')
const situa = (personaId, importo, o = {}) => prova(() => {
  const r = chiEPerCosa(personaId, importo, { ...contesto([]), ...o })
  return { chi: r.nucleo.map((x) => [x.persona.id, x.dovuti.map((v) => [v.voce, v.manca]), x.pagamenti.length]), proposta: r.proposta.map((y) => [y.personaId, y.voce, y.importo]), sicura: r.sicura, chiedere: r.daChiedere }
})
ok('la persona e il suo nucleo: cosa deve, i pagamenti, la proposta già sicura', situa('sofia', 66000),
  { chi: [['sofia', [['Quota associativa 2026/27', 5000], ['Annuale Judo adulti', 61000]], 0]], proposta: [['sofia', 'Quota associativa 2026/27', 5000], ['sofia', 'Annuale Judo adulti', 61000]], sicura: true, chiedere: [] })
ok('non sicura: la proposta c\'è lo stesso (prima la quota), da correggere a mano', situa('sofia', 18000), { chi: [['sofia', [['Quota associativa 2026/27', 5000], ['Annuale Judo adulti', 61000]], 0]], proposta: [['sofia', 'Quota associativa 2026/27', 5000], ['sofia', 'Annuale Judo adulti', 13000]], sicura: false, chiedere: [] })
ok('segnato pagato a mano: si chiede, e non è sicura', situa('luca', 66000), { chi: [['luca', [], 0]], proposta: [], sicura: false, chiedere: ['luca'] })
ok('i pagamenti già fatti, dal più recente, senza gli annullati', prova(() => chiEPerCosa('sofia', 5000, { ...contesto([]), diretti: [
  { id: 'x1', personaId: 'sofia', data: '2026-09-10', importo: 20000, metodo: 'Bonifico', voce: 'Trimestre Judo adulti', creatoIl: '2026-09-10T10:00:00Z' },
  { id: 'x2', personaId: 'sofia', data: '2026-10-01', importo: 5000, metodo: 'Contanti', voce: 'Gara', creatoIl: '2026-10-01T10:00:00Z' },
  { id: 'x3', personaId: 'sofia', data: '2026-10-02', importo: 7000, metodo: 'Contanti', voce: 'Gara', creatoIl: '2026-10-02T10:00:00Z', annullatoIl: '2026-10-03T10:00:00Z' },
] }).nucleo[0].pagamenti.map((x) => [x.data, x.voce, x.importo])), [['2026-10-01', 'Gara', 5000], ['2026-09-10', 'Trimestre Judo adulti', 20000]])
ok('il riquadro «Si assegnano da soli» usa la stessa logica: stessa proposta', prova(() => daSoli(contesto([mov('m1', 66000, 'sofia')])).pronti[0].righe), prova(() => chiEPerCosa('sofia', 66000, contesto([])).proposta))
ok('la tipologia viene da quel che paga: solo quota → «Quota associativa»', prova(() => tipologiaDaRighe([{ personaId: 'a', voce: 'Quota associativa 2026/27', importo: 5000 }])), 'Quota associativa')
ok('…con un corso → «Corsi e altri pagamenti»', prova(() => tipologiaDaRighe([{ personaId: 'a', voce: 'Quota associativa 2026/27', importo: 5000 }, { personaId: 'a', voce: 'Annuale Judo adulti', importo: 61000 }])), 'Corsi e altri pagamenti')
ok('…senza righe nessuna (resta quella che c\'è)', prova(() => tipologiaDaRighe([])), null)

const conAss = fn(A, 'assegna', 'conAssegnazioni')
const dA = { id: 'dA', personaId: 'sofia', data: '2026-10-01', importo: 6000, metodo: 'Bonifico', voce: 'Annuale Judo adulti', movimentoId: 'mA', creatoIl: '2026-10-01T10:00:00Z' }
const giaDentro = prova(() => conAss(persona('sofia'), [dA], listino, oggi))
ok('le schede dal database hanno già le assegnazioni dentro: non si tolgono due volte', prova(() => chiEPerCosa('sofia', 5000, { ...contesto([]), persone: [giaDentro], diretti: [dA] }).dovuti.map((v) => [v.voce, v.manca])),
  [['Quota associativa 2026/27', 5000], ['Annuale Judo adulti', 55000]])
ok('…e due bonifici uguali nel giro restano uno solo anche con quelle schede', prova(() => daSoli({ ...contesto([mov('m7', 60000, 'sofia'), mov('m8', 60000, 'sofia', { data: '2026-11-05' })]), persone: [giaDentro], diretti: [dA] }).pronti.map((x) => x.movimentoId)), ['m7'])

console.log('Import: chi e per cosa scelti prima di importare')
const B = await carica('importaBanca')
const pianoDiAssegnazione = fn(B, 'importaBanca', 'pianoDiAssegnazione')
const scrittiImport = [{ id: 'mv1', origineImport: 'k1' }, { id: 'mv2', origineImport: 'k2' }, { id: 'mv3', origineImport: 'k3' }, { id: 'vecchio', origineImport: 'k4', annullatoIl: '2026-11-01T10:00:00Z' }]
const righe1 = [{ personaId: 'sofia', voce: 'Annuale Judo adulti', importo: 61000 }]
ok('si assegnano le righe scelte nella finestra, sui movimenti appena scritti e classificati', prova(() => pianoDiAssegnazione(
  { k1: { voceId: 'v-corsi', personaId: 'sofia', righe: righe1 }, k2: { voceId: 'v-corsi', personaId: 'anna' }, k3: { voceId: 'v-corsi', personaId: 'sofia', righe: righe1 }, k4: { voceId: 'v-corsi', personaId: 'sofia', righe: righe1 } },
  new Set(['mv1', 'mv2']), new Set(), scrittiImport)), [{ chiave: 'k1', movimentoId: 'mv1', righe: righe1 }])
ok('…non quelli che vanno con la ricevuta già fatta', prova(() => pianoDiAssegnazione({ k1: { voceId: 'v-corsi', personaId: 'sofia', righe: righe1 } }, new Set(['mv1']), new Set(['mv1']), scrittiImport)), [])
ok('la scelta della finestra porta la tipologia giusta', prova(() => fn(B, 'importaBanca', 'sceltaDaFinestra')({ personaId: 'sofia', nomePersona: 'Sofia Test', righe: righe1 }, voci)), { voceId: 'v-corsi', personaId: 'sofia', nomePersona: 'Sofia Test', righe: righe1 })
ok('…«Solo la persona»: la tipologia resta quella proposta', prova(() => fn(B, 'importaBanca', 'sceltaDaFinestra')({ personaId: 'sofia', nomePersona: 'Sofia Test', righe: [] }, voci, 'v-quota')), { voceId: 'v-quota', personaId: 'sofia', nomePersona: 'Sofia Test', soloPersona: true })

ok('«Solo la persona» all\'import non si assegna da solo: non entra fra i collegati da assegnare', prova(() => fn(B, 'importaBanca', 'collegatiDaAssegnare')(
  { lotti: [{ ids: ['mv1'], voceId: 'v-corsi', personaId: 'sofia' }, { ids: ['mv2'], voceId: 'v-corsi', personaId: 'anna' }, { ids: ['mv3'], voceId: 'v-corsi' }] },
  { k1: { voceId: 'v-corsi', personaId: 'sofia', soloPersona: true }, k2: { voceId: 'v-corsi', personaId: 'anna' } }, scrittiImport, new Set(['mv1', 'mv2', 'mv3']), new Set())), ['mv2'])

const ric = (id, o = {}) => ({ id, anno: 2026, numero: Number(id.replace(/\D/g, '')) || 1, data: '2026-11-05', personaId: 'sofia', pagato: 66000, metodo: 'Bonifico', voci: [{ descrizione: 'Annuale Judo adulti', quantita: 1, prezzo: 66000, pagamenti: [{ data: '2026-11-05', importo: 66000, metodo: 'Bonifico' }] }], creataIl: 'x', ...o })
const mvB = { chiave: 'k9', importo: 66000, data: '2026-11-04', descrizione: 'Da Sofia', tipo: 'entrata' }
const ricevutaDellaPersona = fn(B, 'importaBanca', 'ricevutaDellaPersona')
ok('all\'import la ricevuta già fatta: una sola libera della persona → quella', prova(() => ricevutaDellaPersona(mvB, 'sofia', [ric('r1')], [])), 'r1')
ok('…due → nessuna (si sceglie dopo); una già abbinata → nessuna; un\'uscita → nessuna', prova(() => [
  ricevutaDellaPersona(mvB, 'sofia', [ric('r1'), ric('r2')], []) ?? null, ricevutaDellaPersona(mvB, 'sofia', [ric('r1', { movimentoId: 'altro' })], []) ?? null, ricevutaDellaPersona({ ...mvB, tipo: 'uscita' }, 'sofia', [ric('r1')], []) ?? null,
]), [null, null, null])
ok('dai movimenti la stessa domanda: la ricevuta per la persona scelta, anche se il movimento è Da classificare', prova(() => fn(A, 'assegna', 'ricevutaPerChi')(mov('m5', 66000, undefined, { voceId: 'v-dacl' }), 'sofia', { ...contesto([mov('m5', 66000, undefined, { voceId: 'v-dacl' })]), voci: [...voci, { id: 'v-dacl', nome: 'Da classificare', tipo: 'entrata', diSistema: true, attiva: true }], ricevute: [ric('r1')] })?.id), 'r1')
ok('i pagamenti fatti contano le voci delle ricevute (con numero), non le annullate', prova(() => fn(A, 'assegna', 'pagamentiFatti')('sofia', [], [ric('r1'), ric('r2', { annullataIl: 'x' })]).map((x) => [x.voce, x.importo, x.ricevuta?.numero])), [['Annuale Judo adulti', 66000, 1]])
ok('gli importi scritti a mano: le righe e cosa non va, senza browser', prova(() => {
  const dv = [v('sofia', 'Quota', 5000, 'quota'), v('sofia', 'Annuale', 61000)]
  const f = fn(A, 'assegna', 'righeDaCampi')
  return [f(dv, { 'sofia\u0000Quota': '50,00', 'sofia\u0000Annuale': '' }, 66000), f(dv, { 'sofia\u0000Quota': '5x' }, 66000).guaio, f(dv, { 'sofia\u0000Annuale': '700' }, 66000).guaio]
}), [{ righe: [{ personaId: 'sofia', voce: 'Quota', importo: 5000 }], guaio: null }, 'L’importo di «Quota» non si capisce.', 'A «Annuale» mancano 610,00 €: metti 610,00 € o meno, il resto rimane da assegnare.'])

console.log('Scrivere chi e per cosa da MOVIMENTI')
const scriviChiEPerCosa = fn(A, 'assegna', 'scriviChiEPerCosa')
const chiamate = []
const dScrivi = {
  cambiaVoceMovimenti: async (ids, voceId, personaId) => { chiamate.push(['voce', ids, voceId, personaId]); return { cambiati: 1, giaCosi: 0 } },
  collegaMovimentiPersona: async (ids, personaId) => { chiamate.push(['persona', ids, personaId]); return { collegati: 1, giaCosi: 0 } },
  assegnaMovimento: async (id, righe, chiave) => { chiamate.push(['assegna', id, righe.length, typeof chiave]) },
}
const sc = (mov0, scelta) => provaAsync(async () => { chiamate.length = 0; await scriviChiEPerCosa(dScrivi, mov0, scelta, [...voci, { id: 'v-dacl', nome: 'Da classificare', tipo: 'entrata', diSistema: true, attiva: true }]); return [...chiamate] })
ok('un Da classificare: tipologia e persona insieme, poi le righe', await sc({ id: 'm1', voceId: 'v-dacl', personaId: undefined }, { personaId: 'sofia', righe: righe1 }),
  [['voce', ['m1'], 'v-corsi', 'sofia'], ['assegna', 'm1', 1, 'string']])
ok('già sulla tipologia giusta e con un\'altra persona: solo la persona, poi le righe', await sc({ id: 'm2', voceId: 'v-corsi', personaId: 'anna' }, { personaId: 'sofia', righe: righe1 }),
  [['persona', ['m2'], 'sofia'], ['assegna', 'm2', 1, 'string']])
ok('la chiave è quella dell\'apertura della finestra: un nuovo tentativo non riscrive', await provaAsync(async () => {
  const k = []
  const dk = { ...dScrivi, assegnaMovimento: async (_id, _r, chiave) => { k.push(chiave) } }
  await scriviChiEPerCosa(dk, { id: 'm3', voceId: 'v-corsi', personaId: 'sofia' }, { personaId: 'sofia', righe: righe1, chiave: 'apertura-1' }, voci)
  await scriviChiEPerCosa(dk, { id: 'm3', voceId: 'v-corsi', personaId: 'sofia' }, { personaId: 'sofia', righe: righe1, chiave: 'apertura-1' }, voci)
  return k
}), ['apertura-1', 'apertura-1'])
ok('«Sì, è questa» da un Da classificare: si abbina e basta, la voce la prende dalla ricevuta', await provaAsync(async () => {
  const k = []
  const dr = { ...dScrivi, abbinaRicevutaMovimento: async (id, r) => { k.push(['abbina', id, r]) }, collegaMovimentiPersona: async (ids, p) => { k.push(['persona', ids, p]) }, cambiaVoceMovimenti: async () => { k.push(['voce']) } }
  const vv = [...voci, { id: 'v-dacl', nome: 'Da classificare', tipo: 'entrata', diSistema: true, attiva: true }]
  await fn(A, 'assegna', 'abbinaDaFinestra')(dr, { id: 'm1', voceId: 'v-dacl' }, 'sofia', 'r1', vv)
  await fn(A, 'assegna', 'abbinaDaFinestra')(dr, { id: 'm2', voceId: 'v-corsi', personaId: 'anna' }, 'sofia', 'r2', vv)
  return k
}), [['abbina', 'm1', 'r1'], ['persona', ['m2'], 'sofia'], ['abbina', 'm2', 'r2']])
ok('tutto già giusto: solo le righe', await sc({ id: 'm3', voceId: 'v-corsi', personaId: 'sofia' }, { personaId: 'sofia', righe: righe1 }), [['assegna', 'm3', 1, 'string']])
ok('«Solo la persona»: la tipologia resta (o «Corsi e altri pagamenti» se era da classificare), niente righe', await sc({ id: 'm4', voceId: 'v-dacl', personaId: undefined }, { personaId: 'sofia', righe: [] }),
  [['voce', ['m4'], 'v-corsi', 'sofia']])

console.log('Quali entrate aprono la finestra in MOVIMENTI')
const apre = (m, o = {}) => prova(() => fn(A, 'assegna', 'apreChiEPerCosa')(m, [CONTO, CONTANTI], [...voci, { id: 'v-dacl', nome: 'Da classificare', tipo: 'entrata', diSistema: true, attiva: true }, { id: 'v-varie', nome: 'Varie', tipo: 'entrata', diSistema: false, attiva: true }], o.diretti ?? [], [], oggi))
ok('un\'entrata Da classificare del conto: sì', apre(mov('d1', 22000, undefined, { voceId: 'v-dacl' })), true)
ok('…ma non il versamento di Satispay', apre(mov('d2', 22000, undefined, { voceId: 'v-dacl', descrizione: 'SATISPAY EUROPE SA versamento' })), false)
ok('quota o corsi ancora intera, con o senza persona: sì', [apre(mov('d3', 22000, 'sofia')), apre(mov('d4', 22000, undefined))], [true, true])
ok('già assegnata in parte, contanti, uscita, altra voce, annullata: no', [
  apre(mov('d5', 22000, 'sofia'), { diretti: [{ id: 'z', personaId: 'sofia', data: '2026-11-04', importo: 100, metodo: 'Bonifico', voce: 'Quota', movimentoId: 'd5', creatoIl: 'x' }] }),
  apre(mov('d6', 22000, 'sofia', { cassaId: 'contanti' })), apre(mov('d7', 22000, 'sofia', { tipo: 'uscita' })), apre(mov('d8', 22000, 'sofia', { voceId: 'v-varie' })), apre(mov('d9', 22000, 'sofia', { annullatoIl: 'x' })),
], [false, false, false, false, false])

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
