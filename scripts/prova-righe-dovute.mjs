// ---------------------------------------------------------------------------
// Le righe dovute, senza browser: una sola funzione dice, per quota e corsi a
// pagamento in corso, stato, quanto manca, fino a quando e fonte. Deve dare
// gli stessi stati e le stesse scadenze di `pagamentoDi` e `statoCorsi`.
//
//   node scripts/prova-righe-dovute.mjs
//
// Senza `vociCorsi` le righe dei corsi non ci sono e `corsiLetti` è false.
// La parità guarda come righeDovute rilegge le due funzioni: la loro logica
// la provano prova:pagamenti e prova:corsi-da-pagare.
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

const { righeDovute } = await impacchetta("export { righeDovute } from './src/lib/righeDovute'")
const { vociCorsiDi, statoCorsi } = await impacchetta("export { vociCorsiDi, statoCorsi } from './src/lib/corsiDaPagare'")
const { pagamentoDi } = await impacchetta("export { pagamentoDi } from './src/lib/segreteria'")

// ---- i dati (come in prova-corsi-da-pagare.mjs) -----------------------------
const prezzi = (p) => ({ eta: '', orari: [], prezzi: [p] })
const listino = {
  quota: 5000, saldoEntro: '2026-08-31', offerte: [],
  corsi: [
    { corso: 'Judo 3', ...prezzi({ annuale: 340, trimestre: 130 }) },
    { corso: 'Judo kids', ...prezzi({ annuale: 300, trimestre: 100 }) },
    { corso: 'Pilates', ...prezzi({ annuale: 200 }) },
    { corso: 'Gratis', ...prezzi({ annuale: 0 }) },
    { corso: 'Interno', ...prezzi({ annuale: 100 }) },
  ],
  senzaPrezzoVaBene: ['interno'],
}
const corsi = [
  { id: 'judo3', nome: 'Judo 3' }, { id: 'kids', nome: 'Judo kids' }, { id: 'pilates', nome: 'Pilates' },
  { id: 'gratis', nome: 'Gratis' }, { id: 'interno', nome: 'Interno' }, { id: 'libero', nome: 'Corso non nel listino' },
]
const OGGI = '2026-12-16'

const voce = (descrizione, dal, al, { prezzo = 13000, pagato = prezzo } = {}) => ({
  descrizione, quantita: 1, prezzo, dal, al, pagamenti: pagato ? [{ data: '2026-09-16', importo: pagato, metodo: 'contanti' }] : [],
})
const ricevuta = (voci, extra = {}) => ({
  id: 'r' + Math.random(), anno: 2026, numero: 1, data: '2026-09-16', ente: 'ODS', intestatario: { nome: 'Laura', cognome: 'Rossi' },
  voci, anticipo: 0, totale: 0, pagato: 0, creataIl: '2026-09-16', ...extra,
})
const trimestre = (nome, dal, al, x) => voce(`Trimestre ${nome}`, dal, al, x)
const quotaOk = [{ anno: 2026, numero: 1, dal: '2026-09-01', al: '2027-07-31', mancano: 0 }]
let n = 0
const persona = ({ ricevute = [], iscrizioni = [{ corsoId: 'judo3', dal: '2026-09-16' }], conVoci = true, ...extra } = {}) => ({
  id: `p${++n}`, nome: 'Laura', cognome: 'Rossi', attiva: true, creataIl: '2026-09-01', iscrizioni,
  certificato: { scade: '2027-09-01', conFile: false }, documento: true, pagamento: { stato: 'da_pagare' },
  quote: quotaOk,
  ...(conVoci ? { vociCorsi: vociCorsiDi(ricevute) } : {}),
  ...extra,
})

const righe = (p, oggi = OGGI) => righeDovute(p, corsi, listino, oggi).righe
const quotaDi = (p, oggi = OGGI) => righe(p, oggi).filter((r) => r.cosa.tipo === 'quota')
const corsiDi = (p, oggi = OGGI) => righe(p, oggi).filter((r) => r.cosa.tipo === 'corso')
const proiezioneCorso = (r) => [r.cosa.id, r.stato, r.fino ?? null, r.manca ?? null, r.formula ?? null, r.entro ?? null, r.oltre ?? null]

// Parità: per ogni persona, la riga quota = pagamentoDi e le righe corso = statoCorsi.
const pari = (cosa, p, oggi = OGGI) => {
  const q = pagamentoDi(p, oggi)
  const voluta = [q.come, q.fino ?? null, q.fonte ?? null]
  const rq = quotaDi(p, oggi)
  ok(`${cosa}: la quota è come pagamentoDi`, rq.map((r) => [r.stato, r.fino ?? null, r.fonte ?? null]), [voluta])
  const sc = statoCorsi(p, corsi, listino, oggi) ?? []
  const rc = corsiDi(p, oggi)
  ok(`${cosa}: i corsi sono come statoCorsi`, rc.map(proiezioneCorso), sc.map((s) => [s.corsoId, s.come, s.al ?? null, s.mancano ?? null, s.formula ?? null, s.entro ?? null, s.oltre ?? null]))
  return { rq, rc, sc }
}

console.log('1. Parità con pagamentoDi e statoCorsi: la quota')
pari('quota pagata da ricevuta', persona())
pari('quota pagata fuori, data valida', persona({ quote: [], pagamento: { stato: 'pagato', fino: '2027-07-31' } }))
pari('quota pagata fuori, data scaduta', persona({ quote: [], pagamento: { stato: 'pagato', fino: '2026-10-01' } }))
pari('quota Satispay senza ricevuta', persona({ quote: [], satispay: 5000, satispayQuota: 5000 }))
pari('nessuna quota', persona({ quote: [] }))
pari('quota scaduta da ricevuta', persona({ quote: [{ anno: 2025, numero: 3, dal: '2025-09-01', al: '2026-08-31', mancano: 0 }] }))
pari('quota in parte', persona({ quote: [{ anno: 2026, numero: 1, dal: '2026-09-01', al: '2027-07-31', mancano: 2000 }] }))
{
  const q = quotaDi(persona())
  ok('la quota pagata dice ricevuta come fonte', q.map((r) => [r.stato, r.fonte]), [['pagato', 'ricevuta']])
  const d = quotaDi(persona({ quote: [{ anno: 2026, numero: 1, dal: '2026-09-01', al: '2027-07-31', mancano: 2000 }] }))
  ok('la quota in parte dice quanto manca, in centesimi', d.map((r) => r.manca), [2000])
}

console.log('\n2. Parità: i corsi')
{
  const t = pari('trimestre pagato', persona({ ricevute: [ricevuta([trimestre('Judo 3', '2026-09-16', '2027-03-15')])] }))
  ok('il trimestre pagato non manca di niente', t.rc.map((r) => [r.stato, r.manca ?? 0, r.fonte]), [['pagato', 0, 'ricevuta']])
  const s = pari('trimestre scaduto', persona({ ricevute: [ricevuta([trimestre('Judo 3', '2026-09-16', '2026-12-15')])] }))
  ok('il trimestre scaduto è scaduto, fino al giorno di fine', s.rc.map((r) => [r.stato, r.fino]), [['scaduto', '2026-12-15']])
}
{
  const annuale = (oggi) => {
    const p = persona({
      iscrizioni: [{ corsoId: 'pilates', dal: '2026-09-01' }],
      ricevute: [ricevuta([voce('Annuale Pilates', '2026-09-01', '2027-06-30', { prezzo: 20000, pagato: 13400 })])],
    })
    return pari(`annuale a 3 rate, 2 pagate, il ${oggi}`, p, oggi)
  }
  const prima = annuale('2026-12-16')
  ok('prima del 31/12: in parte, mancano 66 euro, da chiudere entro il 31/12', prima.rc.map((r) => [r.stato, r.manca, r.entro, !!r.oltre]), [['in_parte', 6600, '2026-12-31', false]])
  const dopo = annuale('2027-01-05')
  ok('dopo il 31/12: in parte e oltre', dopo.rc.map((r) => [r.stato, r.manca, r.entro, r.oltre]), [['in_parte', 6600, '2026-12-31', true]])
}
{
  const g = pari('corso gratuito, «senza prezzo» e non nel listino', persona({ iscrizioni: [{ corsoId: 'gratis', dal: '2026-09-01' }, { corsoId: 'interno', dal: '2026-09-01' }, { corsoId: 'libero', dal: '2026-09-01' }] }))
  ok('nessuna riga di corso', g.rc.length, 0)
  const f = pari('iscrizione futura o finita', persona({ iscrizioni: [{ corsoId: 'judo3', dal: '2027-01-10' }, { corsoId: 'pilates', dal: '2026-09-01', al: '2026-11-30' }] }))
  ok('nessuna riga di corso', f.rc.length, 0)
  const c = pari('voce non riconosciuta', persona({ ricevute: [ricevuta([voce('Corso speciale', '2026-09-01', '2027-06-30')])] }))
  ok('è da controllare, non da pagare', c.rc.map((r) => r.stato), ['da_controllare'])
  const a = pari('ricevuta annullata', persona({ ricevute: [ricevuta([trimestre('Judo 3', '2026-09-16', '2027-03-15')], { annullataIl: '2026-10-01' })] }))
  ok('non conta: il corso è da pagare', a.rc.map((r) => r.stato), ['da_pagare'])
}

console.log('\n3. Satispay con ricevuta: non raddoppia')
{
  const q = pari('quota con ricevuta e Satispay ancora segnato', persona({ satispay: 5000, satispayQuota: 5000 }))
  ok('una sola riga di quota, dalla ricevuta', q.rq.map((r) => [r.stato, r.fonte]), [['pagato', 'ricevuta']])
  const c = pari('corso pagato con ricevuta e Satispay del corso ancora segnato', persona({ satispayCorsi: ['judo3'], ricevute: [ricevuta([trimestre('Judo 3', '2026-09-16', '2027-03-15')])] }))
  ok('una sola riga per il corso, dalla ricevuta', c.rc.map((r) => [r.cosa.id, r.stato, r.fonte]), [['judo3', 'pagato', 'ricevuta']])
  const s = pari('corso solo Satispay', persona({ satispayCorsi: ['judo3'] }))
  ok('è Satispay', s.rc.map((r) => [r.stato, r.fonte]), [['satispay', 'satispay']])
}

console.log('\n3b. La fonte di ogni stato del corso')
{
  const f = pari('corso pagato fuori dall’app', persona({ pagamento: { stato: 'pagato', fino: '2027-07-31' } }))
  ok('fuori dall’app, fonte fuori_app', f.rc.map((r) => [r.stato, r.fonte]), [['fuori_app', 'fuori_app']])
  const fs = pari('corso pagato fuori dall’app, scaduto', persona({ pagamento: { stato: 'pagato', fino: '2026-10-01' } }))
  ok('fuori dall’app e scaduto, senza fonte', fs.rc.map((r) => [r.stato, r.fonte ?? null]), [['fuori_scaduto', null]])
  const p = pari('trimestre pagato in parte', persona({ ricevute: [ricevuta([trimestre('Judo 3', '2026-09-16', '2027-03-15', { pagato: 5000 })])] }))
  ok('in parte, fonte ricevuta', p.rc.map((r) => [r.stato, r.manca, r.fonte]), [['in_parte', 8000, 'ricevuta']])
  const s = pari('trimestre scaduto', persona({ ricevute: [ricevuta([trimestre('Judo 3', '2026-09-16', '2026-12-15')])] }))
  ok('scaduto, senza fonte', s.rc.map((r) => [r.stato, r.fonte ?? null]), [['scaduto', null]])
}

console.log('\n4. Ricevute non lette, genitore, archiviata')
{
  const r = righeDovute(persona({ conVoci: false }), corsi, listino, OGGI)
  ok('senza vociCorsi: corsiLetti è false', r.corsiLetti, false)
  ok('senza vociCorsi: solo la quota, nessuna riga di corso', r.righe.map((x) => x.cosa.tipo), ['quota'])
  ok('come oggi: statoCorsi dà undefined', statoCorsi(persona({ conVoci: false }), corsi, listino, OGGI), undefined)
  ok('con vociCorsi: corsiLetti è true', righeDovute(persona(), corsi, listino, OGGI).corsiLetti, true)
  const g = righe(persona({ genitoreNonIscritto: true, quote: [], iscrizioni: [] }))
  ok('il genitore non iscritto non ha righe', g.length, 0)
  const a = righe(persona({ attiva: false, quote: [] }))
  ok('la persona archiviata non ha righe', a.length, 0)
  const sv = righeDovute(persona({ attiva: false, conVoci: false }), corsi, listino, OGGI)
  ok('archiviata e ricevute non lette: nessuna riga, corsiLetti false', [sv.righe.length, sv.corsiLetti], [0, false])
  const gc = righe(persona({ genitoreNonIscritto: true, quote: [] }))
  ok('il genitore non iscritto non ha righe neanche con un corso in corso', gc.length, 0)
}

console.log(guai ? `\n${guai} da sistemare` : '\nTutto a posto')
process.exit(guai ? 1 : 0)
