// ---------------------------------------------------------------------------
// «Chi deve pagare», contato dappertutto allo stesso modo: ISCRITTI (filtri
// DA PAGARE e CORSI SCADUTI), DA FARE, COSA MANCA, coda del banco, sollecito.
// Una persona deve se ha una riga non coperta: la quota o un corso.
//
//   node scripts/prova-conteggi-dovuti.mjs
//
// Regole: il titolare senza corsi (altri nel nucleo, nessuna iscrizione in
// corso) non è da incassare; il genitore non iscritto e chi non è attivo non
// sono contati da nessuno; «da controllare» non è da pagare; senza `vociCorsi`
// il conto dei corsi è assente (undefined), non 0. Il sollecito qui è provato
// solo per il titolare senza corsi e per «da controllare»: il resto in prova:sollecito.
// La coda del banco prende anche i corsi: `codaBanco({ …, corsi, listino })`.
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

const impacchetta = async (contents) => {
  const { outputFiles } = await build({
    stdin: { contents, resolveDir: '.', loader: 'ts' },
    bundle: true, format: 'esm', write: false, logLevel: 'silent', define: { 'import.meta.env': '{}' },
  })
  return import('data:text/javascript;base64,' + Buffer.from(outputFiles[0].text).toString('base64'))
}

let guai = 0
const ok = (cosa, avuto, voluto) => {
  const va = JSON.stringify(avuto) === JSON.stringify(voluto)
  console.log(va ? '  ✓' : '  ✗', cosa, va ? '' : `— atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`)
  if (!va) guai++
}

const m = await impacchetta(`
export { righeDovute } from './src/lib/righeDovute'
export { vociCorsiDi, corsiDaPagare, corsiScaduti, statoCorsi } from './src/lib/corsiDaPagare'
export { contiChip, passaChip, titolariDi } from './src/lib/filtriIscritti'
export { pagamentiNonInRegola, contiDellaStriscia } from './src/lib/cosaManca'
export { chiPagare, chiCorsi } from './src/lib/daFareChi'
export { codaBanco } from './src/lib/codaBanco'
export { sollecitoDi } from './src/lib/sollecito'
export { inCorso } from './src/lib/segreteria'
`)
const { righeDovute, vociCorsiDi, corsiDaPagare, corsiScaduti, statoCorsi, contiChip, titolariDi, pagamentiNonInRegola, contiDellaStriscia, chiPagare, chiCorsi, codaBanco, sollecitoDi, inCorso } = m

// ---- i dati (come in prova-righe-dovute.mjs) --------------------------------
const prezzi = (p) => ({ eta: '', orari: [], prezzi: [p] })
const listino = {
  quota: 5000, saldoEntro: '2026-08-31', offerte: [],
  corsi: [{ corso: 'Judo 3', ...prezzi({ annuale: 340, trimestre: 130 }) }, { corso: 'Pilates', ...prezzi({ annuale: 200 }) }],
  senzaPrezzoVaBene: [],
}
const corsi = [{ id: 'judo3', nome: 'Judo 3' }, { id: 'pilates', nome: 'Pilates' }]
const OGGI = '2026-12-16'

const voce = (descrizione, dal, al, { prezzo = 13000, pagato = prezzo } = {}) => ({
  descrizione, quantita: 1, prezzo, dal, al, pagamenti: pagato ? [{ data: '2026-09-16', importo: pagato, metodo: 'contanti' }] : [],
})
const ricevuta = (voci) => ({
  id: 'r' + Math.random(), anno: 2026, numero: 1, data: '2026-09-16', ente: 'ODS', intestatario: { nome: 'Laura', cognome: 'Rossi' },
  voci, anticipo: 0, totale: 0, pagato: 0, creataIl: '2026-09-16',
})
const trim = (dal, al, x) => ricevuta([voce('Trimestre Judo 3', dal, al, x)])
const corsoPagato = () => trim('2026-09-16', '2027-03-15')
const corsoScaduto = () => trim('2026-09-16', '2026-12-15')
const corsoInParte = () => trim('2026-09-16', '2027-03-15', { pagato: 5000 })
const corsoDaControllare = () => ricevuta([voce('Corso speciale', '2026-09-01', '2027-06-30')])
const quotaOk = [{ anno: 2026, numero: 1, dal: '2026-09-01', al: '2027-07-31', mancano: 0 }]
const quotaScaduta = [{ anno: 2025, numero: 3, dal: '2025-09-01', al: '2026-08-31', mancano: 0 }]

let n = 0
const persona = ({ ricevute = [], iscrizioni = [{ corsoId: 'judo3', dal: '2026-09-16' }], conVoci = true, ...extra } = {}) => ({
  id: `p${++n}`, nome: `Nome${n}`, cognome: `Cognome${n}`, attiva: true, creataIl: '2026-09-01', iscrizioni,
  certificato: { scade: '2027-09-01', conFile: false }, documento: true, pagamento: { stato: 'da_pagare' },
  quote: quotaOk,
  ...(conVoci ? { vociCorsi: vociCorsiDi(ricevute) } : {}),
  ...extra,
})

// ---- i punti ----------------------------------------------------------------
const contesto = (oggi = OGGI) => ({ oggi, scopertiDi: (p) => corsiDaPagare(p, corsi, listino, oggi), tesseraDi: () => [] })
const iscrittiPagare = (set) => contiChip(set, () => true, contesto()).pagare
const iscrittiCorsi = (set) => contiChip(set, () => true, contesto())['corsi-scaduti']
const pagareDi = (set) => ({
  iscritti: iscrittiPagare(set),
  cosaManca: pagamentiNonInRegola(set, OGGI),
  daFare: chiPagare(set, OGGI).length,
})
const corsiDi = (set) => ({
  iscritti: iscrittiCorsi(set),
  daFare: corsiScaduti(set, corsi, listino, OGGI),
  cosaManca: contiDellaStriscia({ persone: set, lezioni: null, richieste: null, corsi: corsiScaduti(set, corsi, listino, OGGI) }, 0, OGGI).corsi,
  elenco: chiCorsi(set, corsi, listino, OGGI)?.length,
})
const tutti = (o, v) => Object.fromEntries(Object.keys(o).map((k) => [k, v]))
const inCoda = (set, p) => codaBanco({ appelli: [], persone: set, richieste: 0, istruttori: 0, corsi, listino }, OGGI).some((r) => r.vai.persona === p.id)
const pagaIds = (set) => chiPagare(set, OGGI).map((v) => v.id)

// Un nucleo: il titolare (nessuna iscrizione, quota non pagata) e un figlio a posto.
const nucleo = (titolare = {}) => {
  const t = persona({ iscrizioni: [], quote: [], ...titolare })
  const f = persona({ nucleo: t.id, ricevute: [corsoPagato()] })
  return { t, f, set: [t, f] }
}

console.log('1. Il titolare senza corsi non è da incassare (criterio 1)')
{
  const { t, set } = nucleo()
  ok('senza iscrizione in corso: non è nel filtro DA PAGARE', iscrittiPagare(set), 0)
  ok('senza iscrizione in corso: non è in pagamentiNonInRegola', pagamentiNonInRegola(set, OGGI), 0)
  ok('senza iscrizione in corso: non è in chiPagare', pagaIds(set), [])
  ok('senza iscrizione in corso: non è nella coda del banco', inCoda(set, t), false)
  const s = sollecitoDi(t, undefined, 5000, OGGI, { titolari: titolariDi(set) })
  ok('senza iscrizione in corso: il sollecito non nomina la quota', (s?.motivi ?? []).some((m) => /quota/i.test(m.testo)), false)
}
{
  const { t, set } = nucleo({ iscrizioni: [{ corsoId: 'judo3', dal: '2026-09-16' }], ricevute: [corsoPagato()] })
  ok('con un’iscrizione in corso: è nel filtro DA PAGARE', iscrittiPagare(set), 1)
  ok('con un’iscrizione in corso: è in pagamentiNonInRegola', pagamentiNonInRegola(set, OGGI), 1)
  ok('con un’iscrizione in corso: è in chiPagare', pagaIds(set), [t.id])
  ok('con un’iscrizione in corso: è nella coda del banco', inCoda(set, t), true)
}

console.log('\n2. Il genitore non iscritto non è contato da nessuno (criteri 2 e 3)')
{
  const g = persona({ genitoreNonIscritto: true, quote: [], iscrizioni: [] })
  ok('quota non pagata: nessun punto lo conta', [iscrittiPagare([g]), pagamentiNonInRegola([g], OGGI), pagaIds([g]), inCoda([g], g)], [0, 0, [], false])
  const gc = persona({ genitoreNonIscritto: true, quote: [] })
  ok('con un corso in corso: corsiDaPagare è vuoto', corsiDaPagare(gc, corsi, listino, OGGI), [])
  ok('con un corso in corso: corsiScaduti dà 0', corsiScaduti([gc], corsi, listino, OGGI), 0)
  ok('con un corso in corso: chiCorsi non lo nomina', chiCorsi([gc], corsi, listino, OGGI), [])
  ok('con un corso in corso: il filtro CORSI SCADUTI non lo conta', iscrittiCorsi([gc]), 0)
  ok('con un corso in corso: non è nella coda del banco', inCoda([gc], gc), false)
  // Il certificato non gli serve: la coda non lo chiede, come il filtro CERTIFICATO di ISCRITTI.
  const gs = persona({ genitoreNonIscritto: true, quote: [], iscrizioni: [], certificato: { conFile: false } })
  ok('senza certificato: non è nella coda del banco', inCoda([gs], gs), false)
}

console.log('\n3. Chi non è attivo non è contato da nessuno (criterio 9)')
{
  const a = persona({ attiva: false, quote: quotaScaduta, ricevute: [corsoScaduto()] })
  ok('quota scaduta: nessun punto della quota lo conta', [iscrittiPagare([a]), pagamentiNonInRegola([a], OGGI), pagaIds([a]), inCoda([a], a)], [0, 0, [], false])
  ok('corso scaduto: nessun punto dei corsi lo conta', [iscrittiCorsi([a]), corsiScaduti([a], corsi, listino, OGGI), chiCorsi([a], corsi, listino, OGGI)], [0, 0, []])
}

console.log('\n4. Un insieme misto: gli stessi numeri dappertutto (criteri 4, 5 e 10)')
const { t: titolare, f: figlio } = nucleo()
const misto = [
  persona({ ricevute: [corsoPagato()] }), // tutto pagato
  persona({ quote: [], ricevute: [corsoPagato()] }), // quota da pagare
  persona({ ricevute: [corsoScaduto()] }), // corso scaduto
  persona({ ricevute: [corsoDaControllare()] }), // solo da controllare
  persona({ quote: quotaScaduta, ricevute: [corsoInParte()] }), // quota scaduta, corso in parte
  persona({ attiva: false, quote: quotaScaduta, ricevute: [corsoScaduto()] }),
  persona({ genitoreNonIscritto: true, quote: [], ricevute: [] }),
  persona({ quote: [], pagamento: { stato: 'pagato', fino: '2027-07-31' } }), // pagato fuori: copre quota e corso
  persona({ quote: [], satispay: 5000, satispayQuota: 5000, satispayCorsi: ['judo3'] }), // Satispay: copre
  titolare, figlio,
]
{
  const p = pagareDi(misto)
  ok('DA PAGARE di ISCRITTI, pagamenti di COSA MANCA e di DA FARE sono uguali', [p.iscritti === p.cosaManca, p.cosaManca === p.daFare], [true, true])
  ok('sono 2: quota da pagare e quota scaduta', p.cosaManca, 2)
  const c = corsiDi(misto)
  ok('i corsi scaduti di ISCRITTI, DA FARE e COSA MANCA sono uguali, e anche l’elenco', [c.iscritti === c.daFare, c.daFare === c.cosaManca, c.cosaManca === c.elenco], [true, true, true])
  ok('sono 2: corso scaduto e corso in parte (non il da controllare)', c.daFare, 2)
}
{
  // Il verdetto di righeDovute, persona per persona, contro ogni punto.
  const titolari = titolariDi(misto)
  const esclusa = (p) => titolari.has(p.id) && !p.iscrizioni.some((i) => inCorso(i, OGGI))
  const non_coperti = ['scaduto', 'fuori_scaduto', 'da_pagare', 'in_parte']
  const deveQuota = (p) => !esclusa(p) && righeDovute(p, corsi, listino, OGGI).righe.some((r) => r.cosa.tipo === 'quota' && non_coperti.includes(r.stato))
  const deveCorsi = (p) => righeDovute(p, corsi, listino, OGGI).righe.some((r) => r.cosa.tipo === 'corso' && non_coperti.includes(r.stato))
  const quota = misto.map((p) => p.id).filter((id) => deveQuota(misto.find((p) => p.id === id)))
  const corsiNon = misto.map((p) => p.id).filter((id) => deveCorsi(misto.find((p) => p.id === id)))
  ok('chiPagare nomina chi ha una riga di quota non coperta', pagaIds(misto).sort(), [...quota].sort())
  ok('chiCorsi nomina chi ha una riga di corso non coperta', (chiCorsi(misto, corsi, listino, OGGI) ?? []).map((v) => v.id).sort(), [...corsiNon].sort())
  ok('il filtro DA PAGARE è il conto di chi ha una riga di quota non coperta', iscrittiPagare(misto), quota.length)
  ok('il filtro CORSI SCADUTI è il conto di chi ha una riga di corso non coperta', iscrittiCorsi(misto), corsiNon.length)
  for (const p of misto) {
    const dovuto = deveQuota(p) || deveCorsi(p)
    ok(`coda del banco, ${p.nome}: c’è se e solo se ha una riga non coperta`, inCoda(misto, p), dovuto)
  }
}

console.log('\n5. Senza vociCorsi il conto dei corsi è assente (criterio 6)')
{
  const set = [persona({ conVoci: false }), persona({ conVoci: false, quote: [] })]
  ok('corsiScaduti è undefined, non 0', corsiScaduti(set, corsi, listino, OGGI), undefined)
  ok('chiCorsi è undefined, non []', chiCorsi(set, corsi, listino, OGGI), undefined)
  ok('la casella dei corsi in COSA MANCA non c’è', contiDellaStriscia({ persone: set, lezioni: null, richieste: null, corsi: corsiScaduti(set, corsi, listino, OGGI) }, 0, OGGI).corsi, undefined)
  ok('conta solo la quota: ne manca una', pagareDi(set), tutti(pagareDi(set), 1))
  const solaQuota = persona({ conVoci: false, quote: [] })
  ok('coda del banco: senza corsi letti entra per la quota', inCoda([solaQuota], solaQuota), true)
  const pagata = persona({ conVoci: false })
  ok('coda del banco: senza corsi letti e quota pagata non entra', inCoda([pagata], pagata), false)
}

console.log('\n6. «Da controllare» non è da pagare (criterio 7)')
{
  const d = persona({ ricevute: [corsoDaControllare()] })
  ok('lo stato resta riconoscibile', (statoCorsi(d, corsi, listino, OGGI) ?? []).map((s) => s.come), ['da_controllare'])
  ok('corsiDaPagare non lo prende', corsiDaPagare(d, corsi, listino, OGGI), [])
  ok('corsiScaduti non lo conta', corsiScaduti([d], corsi, listino, OGGI), 0)
  ok('il filtro CORSI SCADUTI non lo conta', iscrittiCorsi([d]), 0)
  ok('chiCorsi non lo nomina', chiCorsi([d], corsi, listino, OGGI), [])
  const s = sollecitoDi(d, undefined, 5000, OGGI, { corsi: statoCorsi(d, corsi, listino, OGGI) })
  ok('il sollecito non lo nomina: non c’è niente da dire', s, null)
  const m2 = persona({ quote: [], ricevute: [corsoDaControllare()] })
  const s2 = sollecitoDi(m2, undefined, 5000, OGGI, { corsi: statoCorsi(m2, corsi, listino, OGGI) })
  ok('con la quota da pagare il sollecito parla solo della quota', (s2?.motivi ?? []).map((x) => /Judo/.test(x.testo)), [false])
}

console.log('\n7. Coda del banco: anche i corsi (criterio 8)')
{
  const c = persona({ ricevute: [corsoScaduto()] })
  ok('quota pagata e corso scaduto: c’è', inCoda([c], c), true)
  const tutto = persona({ ricevute: [corsoPagato()] })
  ok('tutto pagato: non c’è', inCoda([tutto], tutto), false)
  const dc = persona({ ricevute: [corsoDaControllare()] })
  ok('solo un corso da controllare: non c’è', inCoda([dc], dc), false)
  const ip = persona({ ricevute: [corsoInParte()] })
  ok('corso pagato in parte: c’è', inCoda([ip], ip), true)
  const coda = (set) => codaBanco({ appelli: [], persone: set, richieste: 0, istruttori: 0, corsi, listino }, OGGI)
  const qc = persona({ ricevute: [corsoScaduto()], quote: quotaScaduta })
  ok('quota e corso da pagare: una riga sola', coda([qc]).filter((r) => r.vai.persona === qc.id).length, 1)
  const quattro = [1, 2, 3, 4].map(() => persona({ ricevute: [corsoScaduto()] }))
  ok('quattro con un corso da pagare: tre righe e «Altri 1»', coda(quattro).map((r) => r.id.startsWith('corsi-altri') ? r.titolo : r.id.split('-')[0]), ['corsi', 'corsi', 'corsi', 'Altri 1 con un corso da pagare'])
}

console.log(guai ? `\n${guai} da sistemare` : '\nTutto a posto')
process.exit(guai ? 1 : 0)
