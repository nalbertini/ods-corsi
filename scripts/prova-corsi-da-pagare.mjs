// ---------------------------------------------------------------------------
// I corsi da pagare, senza browser: «in regola» guarda solo la quota; chi ha il
// trimestre (o l'annuale) di un corso scaduto deve comparire a parte.
//
//   node scripts/prova-corsi-da-pagare.mjs
//
// La regola sta in `src/lib/corsiDaPagare.ts`: dalle voci di corso delle
// ricevute (non la QUOTA) dice, per ogni iscrizione in corso a un corso a
// pagamento, se è pagato, in parte, scaduto o da pagare. `pagamentoDi` (la
// quota), il bollino QUOTA e il filtro DA PAGARE non cambiano.
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

// Il modulo che ancora non c'è non ferma la prova: la rende rossa dicendolo.
let m = {}
try {
  m = await impacchetta("export * from './src/lib/corsiDaPagare'")
} catch (e) {
  guai++
  console.log('  ✗ manca src/lib/corsiDaPagare.ts —', (e.errors?.[0]?.text ?? e.message).split('\n')[0])
}
const lib = (nome) => (typeof m[nome] === 'function' ? m[nome] : () => `manca ${nome}`)
const vociCorsiDi = lib('vociCorsiDi')
const statoCorsi = lib('statoCorsi')
const corsiDaPagare = lib('corsiDaPagare')
const corsiScaduti = lib('corsiScaduti')
const testoCorso = lib('testoCorso')
const testoCorsoBreve = lib('testoCorsoBreve')
const seg = await impacchetta("export { pagamentoDi, comePaga, inRegola } from './src/lib/segreteria'; export { creaSegreteriaProva } from './src/lib/segreteriaProva'")

// ---- i dati ----------------------------------------------------------------
const prezzi = (p) => ({ eta: '', orari: [], prezzi: [p] })
const listino = {
  quota: 5000,
  saldoEntro: '2026-08-31',
  offerte: [],
  corsi: [
    { corso: 'Judo 3', ...prezzi({ annuale: 340, trimestre: 130 }) },
    { corso: 'Judo kids', ...prezzi({ annuale: 300, trimestre: 100 }) },
    { corso: 'MGA', ...prezzi({ annuale: 300, trimestre: 100 }) },
    { corso: 'Pilates', ...prezzi({ annuale: 200 }) },
    { corso: 'Fitness', eta: '', orari: [], prezzi: [{ etichetta: '2 GIORNI', annuale: 400 }, { etichetta: '3 GIORNI', annuale: 500 }] },
    { corso: 'Gratis', ...prezzi({ annuale: 0 }) },
    { corso: 'Interno', ...prezzi({ annuale: 100 }) },
  ],
  senzaPrezzoVaBene: ['interno'],
}
const corsi = [
  { id: 'judo3', nome: 'Judo 3' }, { id: 'kids', nome: 'Judo kids' }, { id: 'mga', nome: 'MGA' }, { id: 'pilates', nome: 'Pilates' },
  { id: 'fitness', nome: 'Fitness' }, { id: 'gratis', nome: 'Gratis' }, { id: 'interno', nome: 'Interno' }, { id: 'libero', nome: 'Corso non nel listino' },
]
const OGGI = '2026-12-16'

// Una voce di ricevuta: prezzo in centesimi, pagato di default per intero.
const voce = (descrizione, dal, al, { prezzo = 13000, pagato = prezzo } = {}) => ({
  descrizione, quantita: 1, prezzo, dal, al, pagamenti: pagato ? [{ data: '2026-09-16', importo: pagato, metodo: 'contanti' }] : [],
})
const ricevuta = (voci, extra = {}) => ({
  id: 'r' + Math.random(), anno: 2026, numero: 1, data: '2026-09-16', ente: 'ODS', intestatario: { nome: 'Laura', cognome: 'Rossi' },
  voci, anticipo: 0, totale: 0, pagato: 0, creataIl: '2026-09-16', ...extra,
})
const quotaPagata = voce('QUOTA ASSOCIATIVA', '2026-09-01', '2027-07-31', { prezzo: 5000 })
const quotaScaduta = voce('QUOTA ASSOCIATIVA', '2025-09-01', '2026-08-31', { prezzo: 5000 })
let n = 0
// Laura: attiva, iscritta a Judo 3 dal 16 settembre, quota a posto. `ricevute` diventano quote e vociCorsi come in segreteriaProva.
const persona = ({ ricevute = [], iscrizioni = [{ corsoId: 'judo3', dal: '2026-09-16' }], conVoci = true, ...extra } = {}) => ({
  id: `p${++n}`, nome: 'Laura', cognome: 'Rossi', attiva: true, creataIl: '2026-09-01', iscrizioni,
  certificato: { scade: '2027-09-01', conFile: false }, documento: true, pagamento: { stato: 'da_pagare' },
  quote: [{ anno: 2026, numero: 1, dal: '2026-09-01', al: '2027-07-31', mancano: 0 }],
  ...(conVoci ? { vociCorsi: vociCorsiDi(ricevute) } : {}),
  ...extra,
})
const trimestre = (nome, dal, al, x) => voce(`Trimestre ${nome}`, dal, al, x)
// Per confrontare senza dipendere dall'ordine delle chiavi: [corso, come, al].
const cs = (s) => (Array.isArray(s) ? s.map((x) => [x.corso, x.come, x.al ?? null]) : s)
const stati = (p, oggi = OGGI) => cs(statoCorsi(p, corsi, listino, oggi))

console.log('1. vociCorsiDi: le voci di corso delle ricevute')
{
  const r = ricevute()
  function ricevute() {
    return [
      ricevuta([quotaPagata, trimestre('Judo 3', '2026-09-16', '2026-12-15'), voce('Annuale Pilates', '2026-09-01', '2027-06-30', { prezzo: 20000, pagato: 16000 })]),
      ricevuta([trimestre('MGA', '2026-09-16', '2026-12-15')], { annullataIl: '2026-10-01' }),
    ]
  }
  const v = vociCorsiDi(r)
  ok('la QUOTA non c\'è, la ricevuta annullata non conta', Array.isArray(v) ? v.map((x) => x.descrizione) : v, ['Trimestre Judo 3', 'Annuale Pilates'])
  ok('descrizione, dal, al e quanto manca (centesimi, 0 = pagata)', Array.isArray(v) ? v.map((x) => [x.dal, x.al, x.mancano]) : v, [['2026-09-16', '2026-12-15', 0], ['2026-09-01', '2027-06-30', 4000]])
  const anticipo = vociCorsiDi([ricevuta([voce('Annuale Pilates', '2026-09-01', '2027-06-30', { prezzo: 20000, pagato: 0 })], { anticipo: 20000 })])
  ok('un anticipo che copre la ricevuta: non manca niente (come quoteDi)', Array.isArray(anticipo) ? anticipo.map((x) => x.mancano) : anticipo, [0])
  ok('nessuna ricevuta: nessuna voce', vociCorsiDi([]), [])
}

console.log('\n2. Trimestre scaduto: il giorno dopo `al`')
{
  const p = persona({ ricevute: [ricevuta([trimestre('Judo 3', '2026-09-16', '2026-12-15')])] })
  ok('15 dicembre (ultimo giorno): pagato', stati(p, '2026-12-15'), [['Judo 3', 'pagato', '2026-12-15']])
  ok('16 dicembre: scaduto, al 15 dicembre', stati(p, '2026-12-16'), [['Judo 3', 'scaduto', '2026-12-15']])
  ok('il trimestre scaduto ha la formula trimestre', statoCorsi(p, corsi, listino, '2026-12-16')?.[0]?.formula, 'trimestre')
  ok('il 15 dicembre corsiDaPagare è vuoto', corsiDaPagare(p, corsi, listino, '2026-12-15'), [])
  ok('il 16 dicembre corsiDaPagare ha il corso scaduto', cs(corsiDaPagare(p, corsi, listino, '2026-12-16')), [['Judo 3', 'scaduto', '2026-12-15']])
  ok('lo stato porta l\'id del corso', statoCorsi(p, corsi, listino, '2026-12-16')?.[0]?.corsoId, 'judo3')
}

console.log('\n3. Pagato fuori dall\'app (eccezione), senza voce del corso')
{
  const p = persona({ ricevute: [], pagamento: { stato: 'pagato', fino: '2026-12-20' } })
  ok('20 dicembre: pagato fuori dall\'app, al 20 dicembre', stati(p, '2026-12-20'), [['Judo 3', 'fuori_app', '2026-12-20']])
  ok('21 dicembre: era pagato, ora da pagare', stati(p, '2026-12-21'), [['Judo 3', 'fuori_scaduto', '2026-12-20']])
  const senzaFino = persona({ ricevute: [], pagamento: { stato: 'pagato' } })
  ok('pagato senza data: vale fino a fine stagione, come pagamentoDi', stati(senzaFino, '2027-07-31'), [['Judo 3', 'fuori_app', '2027-07-31']])
  const scaduto = persona({ ricevute: [ricevuta([trimestre('Judo 3', '2026-09-16', '2026-12-15')])], pagamento: { stato: 'pagato', fino: '2026-12-31' } })
  ok('voce scaduta ma eccezione ancora valida: vale l\'eccezione', stati(scaduto, '2026-12-16'), [['Judo 3', 'fuori_app', '2026-12-31']])
  ok('un\'eccezione «da pagare» non è un pagamento', stati(persona({ ricevute: [] }), OGGI), [['Judo 3', 'da_pagare', null]])
}

console.log('\n4. Due corsi, una sola voce')
{
  const p = persona({
    ricevute: [ricevuta([trimestre('Judo 3', '2026-09-16', '2027-03-15')])],
    iscrizioni: [{ corsoId: 'mga', dal: '2026-09-16' }, { corsoId: 'judo3', dal: '2026-09-16' }],
  })
  ok('uno per iscrizione, ordinati per nome del corso', stati(p), [['Judo 3', 'pagato', '2027-03-15'], ['MGA', 'da_pagare', null]])
  ok('solo il secondo è da pagare', cs(corsiDaPagare(p, corsi, listino, OGGI)), [['MGA', 'da_pagare', null]])
}

console.log('\n5. Quota e corsi sono due cose')
{
  const ric = [ricevuta([trimestre('Judo 3', '2026-09-16', '2026-12-15')])]
  const corsoScadutoQuotaOk = persona({ ricevute: ric })
  ok('quota a posto e corso scaduto: per pagamentoDi è pagato', seg.pagamentoDi(corsoScadutoQuotaOk, OGGI).come, 'pagato')
  ok('quota a posto e corso scaduto: comePaga resta pagato, inRegola resta vero', [seg.comePaga(corsoScadutoQuotaOk, OGGI), seg.inRegola(corsoScadutoQuotaOk, OGGI)], ['pagato', true])
  ok('…ma il corso scaduto c\'è', corsiScaduti([corsoScadutoQuotaOk], corsi, listino, OGGI), 1)
  const tutteDue = persona({ ricevute: ric, quote: [{ anno: 2025, numero: 9, dal: '2025-09-01', al: '2026-08-31', mancano: 0 }] })
  ok('quota scaduta: pagamentoDi non è pagato (DA PAGARE)', seg.comePaga(tutteDue, OGGI) !== 'pagato', true)
  ok('quota scaduta e corso scaduto: compare anche in corsiScaduti', corsiScaduti([tutteDue], corsi, listino, OGGI), 1)
}

console.log('\n6. Trimestre successivo già pagato')
{
  const avanti = persona({ ricevute: [ricevuta([trimestre('Judo 3', '2026-09-16', '2026-12-15'), trimestre('Judo 3', '2026-12-16', '2027-03-15')])] })
  ok('quello di oggi pagato e il prossimo pure: pagato fino al più lontano', stati(avanti, '2026-12-16'), [['Judo 3', 'pagato', '2027-03-15']])
  const anticipo = persona({ ricevute: [ricevuta([trimestre('Judo 3', '2026-09-16', '2026-12-15'), trimestre('Judo 3', '2026-12-20', '2027-03-20')])] })
  ok('quello di oggi scaduto e il prossimo (dal 20) già pagato: non è da pagare', stati(anticipo, '2026-12-16'), [['Judo 3', 'pagato', '2027-03-20']])
  ok('…e non è nei corsi da pagare', corsiDaPagare(anticipo, corsi, listino, '2026-12-16'), [])
}

console.log('\n7. Pagato in parte')
{
  const p = persona({ ricevute: [ricevuta([voce('Annuale Pilates', '2026-09-01', '2027-06-30', { prezzo: 20000, pagato: 16000 })])], iscrizioni: [{ corsoId: 'pilates', dal: '2026-09-01' }] })
  ok('annuale a rate, valido oggi: in parte', stati(p), [['Pilates', 'in_parte', '2027-06-30']])
  ok('mancano in centesimi', statoCorsi(p, corsi, listino, OGGI)?.[0]?.mancano, 4000)
  ok('formula annuale', statoCorsi(p, corsi, listino, OGGI)?.[0]?.formula, 'annuale')
  // Caso 315/2026: l'annuale si chiude entro il 31 dicembre dell'anno della ricevuta (data 2026-09-16 qui).
  ok('l’annuale a rate porta la scadenza del 31 dicembre', statoCorsi(p, corsi, listino, OGGI)?.[0]?.entro, '2026-12-31')
  ok('il 31 dicembre non è ancora oltre', statoCorsi(p, corsi, listino, '2026-12-31')?.[0]?.oltre ?? false, false)
  ok('dal 1° gennaio è oltre', statoCorsi(p, corsi, listino, '2027-01-01')?.[0]?.oltre, true)
  ok('dal 1° gennaio è ancora fra i corsi da pagare, con i suoi 40 €', cs(corsiDaPagare(p, corsi, listino, '2027-01-01')), [['Pilates', 'in_parte', '2027-06-30']])
  ok('un trimestre pagato in parte non ha la scadenza di dicembre', statoCorsi(persona({ ricevute: [ricevuta([trimestre('Judo 3', '2026-09-16', '2027-03-15', { pagato: 5000 })])] }), corsi, listino, OGGI)?.[0]?.entro, undefined)
  ok('è fra i corsi da pagare', corsiScaduti([p], corsi, listino, OGGI), 1)
  const pagataEIn = persona({ ricevute: [ricevuta([voce('Annuale Pilates', '2026-09-01', '2027-06-30', { prezzo: 20000, pagato: 16000 }), voce('Annuale Pilates', '2026-09-01', '2027-06-30')])], iscrizioni: [{ corsoId: 'pilates', dal: '2026-09-01' }] })
  ok('una voce pagata valida batte quella in parte', stati(pagataEIn), [['Pilates', 'pagato', '2027-06-30']])
}

console.log('\n8. Chi non c\'è: corsi gratuiti, iscrizioni finite, disattivati')
{
  const solo = (iscrizioni, extra = {}) => stati(persona({ iscrizioni, ...extra }))
  ok('corso a 0 €: nessuna riga', solo([{ corsoId: 'gratis', dal: '2026-09-16' }]), [])
  ok('corso in senzaPrezzoVaBene: nessuna riga', solo([{ corsoId: 'interno', dal: '2026-09-16' }]), [])
  ok('corso senza voce nel listino: nessuna riga', solo([{ corsoId: 'libero', dal: '2026-09-16' }]), [])
  ok('iscrizione finita: nessuna riga', solo([{ corsoId: 'judo3', dal: '2026-09-16', al: '2026-12-15' }]), [])
  ok('iscrizione che finisce oggi: c\'è ancora', solo([{ corsoId: 'judo3', dal: '2026-09-16', al: '2026-12-16' }]), [['Judo 3', 'da_pagare', null]])
  ok('iscrizione che comincia domani: ancora no', solo([{ corsoId: 'judo3', dal: '2026-12-17' }]), [])
  ok('persona disattivata: nessuna riga', solo([{ corsoId: 'judo3', dal: '2026-09-16' }], { attiva: false }), [])
  ok('persona disattivata: non conta in corsiScaduti', corsiScaduti([persona({ attiva: false })], corsi, listino, OGGI), 0)
}

console.log('\n9. Una voce scritta a mano: da controllare')
{
  const mano = (voci, extra) => persona({ ricevute: [ricevuta(voci)], ...extra })
  ok('«Lezioni private» valida oggi, corso senza voce: da controllare', stati(mano([voce('Lezioni private', '2026-09-01', '2027-06-30')])), [['Judo 3', 'da_controllare', null]])
  ok('anche senza date', stati(mano([voce('Lezioni private', undefined, undefined)])), [['Judo 3', 'da_controllare', null]])
  ok('«Trimestre» di un nome che non è di nessun corso: da controllare', stati(mano([voce('Trimestre Boh', '2026-09-01', '2027-06-30')])), [['Judo 3', 'da_controllare', null]])
  ok('una voce scritta a mano già finita: da pagare', stati(mano([voce('Lezioni private', '2026-09-01', '2026-10-30')])), [['Judo 3', 'da_pagare', null]])
  ok('la voce di un altro corso del listino non fa dubitare: da pagare', stati(mano([trimestre('MGA', '2026-09-16', '2027-03-15')])), [['Judo 3', 'da_pagare', null]])
  ok('da controllare è fra quelli da pagare', corsiScaduti([mano([voce('Lezioni private', '2026-09-01', '2027-06-30')])], corsi, listino, OGGI), 1)
}

console.log('\n10. Come si riconosce la voce del corso')
{
  const tri = (descrizione, iscr = [{ corsoId: 'judo3', dal: '2026-09-16' }]) => persona({ ricevute: [ricevuta([voce(descrizione, '2026-09-16', '2026-12-15')])], iscrizioni: iscr })
  ok('maiuscole indifferenti', stati(tri('TRIMESTRE JUDO 3')), [['Judo 3', 'scaduto', '2026-12-15']])
  ok('Annuale: formula annuale', statoCorsi(tri('Annuale Judo 3'), corsi, listino, OGGI)?.[0]?.formula, 'annuale')
  ok('Saldo: formula annuale', statoCorsi(tri('Saldo Judo 3'), corsi, listino, OGGI)?.[0]?.formula, 'annuale')
  ok('con l\'etichetta della riga di listino', stati(tri('Annuale Fitness 2 giorni', [{ corsoId: 'fitness', dal: '2026-09-16' }])), [['Fitness', 'scaduto', '2026-12-15']])
  ok('Judo 3 non è Judo kids', stati(tri('Trimestre Judo kids')), [['Judo 3', 'da_pagare', null]])
  ok('due voci scadute: vale la più recente', stati(persona({ ricevute: [ricevuta([trimestre('Judo 3', '2026-06-16', '2026-09-15'), trimestre('Judo 3', '2026-09-16', '2026-12-15')])] })), [['Judo 3', 'scaduto', '2026-12-15']])
}

console.log('\n11. Satispay: pagato, ricevuta da fare')
{
  const p = persona({ ricevute: [], satispay: 8000 })
  ok('come la quota: satispay', stati(p), [['Judo 3', 'satispay', null]])
  ok('non è da pagare', corsiDaPagare(p, corsi, listino, OGGI), [])
}

console.log('\n12. Ricevuta annullata, lettura fallita')
{
  const annullata = persona({ ricevute: [ricevuta([trimestre('Judo 3', '2026-09-16', '2027-03-15')], { annullataIl: '2026-10-01' })] })
  ok('la voce di una ricevuta annullata non conta: da pagare', stati(annullata), [['Judo 3', 'da_pagare', null]])
  const nonLetto = persona({ conVoci: false })
  ok('vociCorsi non c\'è: statoCorsi è undefined', statoCorsi(nonLetto, corsi, listino, OGGI), undefined)
  ok('vociCorsi non c\'è: corsiDaPagare è []', corsiDaPagare(nonLetto, corsi, listino, OGGI), [])
  ok('nessuno ha vociCorsi: corsiScaduti è undefined (il riquadro non appare)', corsiScaduti([nonLetto, persona({ conVoci: false })], corsi, listino, OGGI), undefined)
  ok('nessuna persona: corsiScaduti è undefined', corsiScaduti([], corsi, listino, OGGI), undefined)
}

console.log('\n13. corsiScaduti: quanti attivi')
{
  const scaduto = () => persona({ ricevute: [ricevuta([trimestre('Judo 3', '2026-09-16', '2026-12-15')])] })
  const aPosto = () => persona({ ricevute: [ricevuta([trimestre('Judo 3', '2026-09-16', '2027-03-15')])] })
  const due = persona({ iscrizioni: [{ corsoId: 'judo3', dal: '2026-09-16' }, { corsoId: 'mga', dal: '2026-09-16' }], ricevute: [] })
  ok('conta le persone, non i corsi: chi ne ha due vale uno', corsiScaduti([due], corsi, listino, OGGI), 1)
  ok('uno scaduto, uno a posto, uno disattivato, uno non letto', corsiScaduti([scaduto(), aPosto(), { ...scaduto(), attiva: false }, persona({ conVoci: false })], corsi, listino, OGGI), 1)
  ok('tutti a posto: 0 (non undefined)', corsiScaduti([aPosto()], corsi, listino, OGGI), 0)
}

console.log('\n14. Le parole della scheda (testoCorso)')
{
  const t = (s) => testoCorso(s)
  ok('pagato', t({ corsoId: 'kids', corso: 'Judo kids', come: 'pagato', formula: 'trimestre', al: '2027-03-31' }), { testo: 'Judo kids: pagato fino al 31 marzo 2027', tono: 'sec' })
  ok('fuori dall\'app', t({ corsoId: 'mga', corso: 'MGA', come: 'fuori_app', al: '2026-11-30' }), { testo: 'MGA: pagato fuori dall’app fino al 30 novembre 2026', tono: 'sec' })
  ok('satispay', t({ corsoId: 'x', corso: 'X', come: 'satispay' }), { testo: 'X: pagato con Satispay, ricevuta da fare', tono: 'sec' })
  ok('scaduto', t({ corsoId: 'judo3', corso: 'Judo 3', come: 'scaduto', formula: 'trimestre', al: '2026-12-15' }), { testo: 'Judo 3: scaduto il 15 dicembre 2026, da pagare', tono: 'rosso' })
  ok('fuori dall\'app scaduto', t({ corsoId: 'mga', corso: 'MGA', come: 'fuori_scaduto', al: '2026-11-30' }), { testo: 'MGA: pagata fuori dall’app fino al 30 novembre 2026, ora da pagare', tono: 'rosso' })
  ok('da pagare', t({ corsoId: 'x', corso: 'X', come: 'da_pagare' }), { testo: 'X: da pagare', tono: 'rosso' })
  ok('in parte', t({ corsoId: 'pilates', corso: 'Pilates', come: 'in_parte', formula: 'annuale', al: '2027-06-30', mancano: 4000 }), { testo: 'Pilates: pagato in parte, mancano 40 €', tono: 'giallo' })
  ok('in parte, con la scadenza di dicembre davanti', t({ corsoId: 'pilates', corso: 'Pilates', come: 'in_parte', formula: 'annuale', al: '2027-06-30', mancano: 4000, entro: '2026-12-31' }), { testo: 'Pilates: pagato in parte, mancano 40 €, da chiudere entro il 31 dicembre 2026', tono: 'giallo' })
  ok('in parte, scadenza passata', t({ corsoId: 'pilates', corso: 'Pilates', come: 'in_parte', formula: 'annuale', al: '2027-06-30', mancano: 4000, entro: '2026-12-31', oltre: true }), { testo: 'Pilates: l’annuale andava chiuso entro il 31 dicembre 2026, mancano ancora 40 €', tono: 'rosso' })
  ok('da controllare', t({ corsoId: 'x', corso: 'X', come: 'da_controllare' }), { testo: 'X: da controllare, c’è una voce scritta a mano', tono: 'giallo' })
}

console.log('\n15. Le parole dell\'elenco filtrato (testoCorsoBreve, senza anno)')
{
  const b = (s) => testoCorsoBreve(s)
  ok('scaduto', b({ corsoId: 'judo3', corso: 'Judo 3', come: 'scaduto', formula: 'trimestre', al: '2026-12-15' }), 'Judo 3: scaduto il 15 dicembre')
  ok('in parte', b({ corsoId: 'pilates', corso: 'Pilates', come: 'in_parte', al: '2027-06-30', mancano: 4000 }), 'Pilates: mancano 40 €')
  ok('fuori dall\'app', b({ corsoId: 'mga', corso: 'MGA', come: 'fuori_app', al: '2026-11-30' }), 'MGA: pagato fuori dall’app fino al 30 novembre')
  ok('da pagare', b({ corsoId: 'x', corso: 'X', come: 'da_pagare' }), 'X: da pagare')
  ok('da controllare', b({ corsoId: 'x', corso: 'X', come: 'da_controllare' }), 'X: da controllare')
}

console.log('\n16. In modalità prova ogni persona ha le voci dei corsi')
{
  const s = seg.creaSegreteriaProva()
  const persone = await s.persone()
  ok('ci sono persone', persone.length > 0, true)
  ok('vociCorsi è un elenco per tutte (letto, anche se vuoto)', persone.filter((p) => !Array.isArray(p.vociCorsi)).length, 0)
}

console.log('\n17. Col database: persone() legge le voci dei corsi dalle ricevute')
{
  const sup = await impacchetta("export { creaSegreteriaSupabase } from './src/lib/segreteriaSupabase'")
  // Un database finto: ogni catena di query risponde con la riga della sua tabella, solo alla prima pagina (tutteLeRighe si ferma alla vuota).
  const finto = (tabelle) => {
    const catena = (t, pagina = 0) => new Proxy({}, {
      get: (_, k) => k === 'then'
        ? (bene, male) => Promise.resolve(tabelle[t]?.error ? tabelle[t] : { data: pagina === 0 ? (tabelle[t]?.data ?? []) : [], error: null }).then(bene, male)
        : (...a) => catena(t, k === 'range' ? a[0] : pagina),
    })
    return { from: (t) => catena(t), rpc: async () => ({ data: null, error: null }) }
  }
  const riga = { id: 'laura', nome: 'Laura', cognome: 'Rossi', email: null, telefono: null, attiva: true, creata_il: '2026-09-01T10:00:00Z', iscrizioni: [{ corso_id: 'judo3', dal: '2026-09-16', al: null }], schede_iscritti: null }
  const ric = (voci) => ({ persona_id: 'laura', anno: 2026, numero: 1, voci, anticipo: 0 })
  const leggi = async (tabelle) => {
    try { return await sup.creaSegreteriaSupabase(finto({ persone: { data: [riga] }, ...tabelle })).persone() } catch (e) { return `errore: ${e.message}` }
  }
  const pagata = await leggi({ ricevute: { data: [ric([trimestre('Judo 3', '2026-12-16', '2027-03-15')])] } })
  ok('ricevuta col trimestre in corso: Judo 3 pagato', cs(statoCorsi(pagata[0], corsi, listino, OGGI)), [['Judo 3', 'pagato', '2027-03-15']])
  const scaduta = await leggi({ ricevute: { data: [ric([trimestre('Judo 3', '2026-09-16', '2026-12-15')])] } })
  ok('ricevuta col trimestre finito: Judo 3 scaduto', cs(statoCorsi(scaduta[0], corsi, listino, OGGI)), [['Judo 3', 'scaduto', '2026-12-15']])
  ok('…e conta nei corsi scaduti', corsiScaduti(scaduta, corsi, listino, OGGI), 1)
  const senza = await leggi({ ricevute: { data: [] } })
  ok('nessuna ricevuta: vociCorsi è un elenco vuoto, il corso è da pagare', [senza[0]?.vociCorsi, cs(statoCorsi(senza[0], corsi, listino, OGGI))], [[], [['Judo 3', 'da_pagare', null]]])
  const rotta = await leggi({ ricevute: { data: null, error: { code: '42501', message: 'permission denied' } } })
  ok('le ricevute non si leggono: vociCorsi assente', rotta[0] && 'vociCorsi' in rotta[0] ? rotta[0].vociCorsi : undefined, undefined)
  ok('…e nessuno è da pagare: il riquadro non appare', corsiScaduti(rotta, corsi, listino, OGGI), undefined)
}

console.log('\n18. In modalità prova una ricevuta emessa o annullata cambia il corso')
{
  const s = seg.creaSegreteriaProva()
  const tutte = await s.persone()
  const chi = tutte.find((p) => p.attiva && p.iscrizioni.length > 0)
  const voce = { descrizione: 'Trimestre Prova corso', quantita: 1, prezzo: 10000, dal: '2026-01-01', al: '2099-12-31', pagamenti: [{ data: '2026-01-01', importo: 10000, metodo: 'contanti' }] }
  const prima = chi.vociCorsi.length
  const r = await s.emettiRicevuta({ data: '2026-01-01', personaId: chi.id, ente: 'ODS', intestatario: { nome: chi.nome, cognome: chi.cognome }, voci: [voce], anticipo: 0 })
  const dopo = (await s.persone()).find((p) => p.id === chi.id)
  ok('dopo la ricevuta la voce del corso c\'è', dopo.vociCorsi.length === prima + 1 && dopo.vociCorsi.some((v) => v.descrizione === 'Trimestre Prova corso'), true)
  await s.annullaRicevuta(r.id)
  const annullata = (await s.persone()).find((p) => p.id === chi.id)
  ok('annullata, la voce non c\'è più', annullata.vociCorsi.some((v) => v.descrizione === 'Trimestre Prova corso'), false)
}

console.log('\n19. Casi al limite delle date')
{
  ok('una voce senza date: vale sempre, pagata', cs(statoCorsi(persona({ ricevute: [ricevuta([trimestre('Judo 3', undefined, undefined)])] }), corsi, listino, OGGI)), [['Judo 3', 'pagato', null]])
  ok('una voce senza date pagata a metà: in parte', cs(statoCorsi(persona({ ricevute: [ricevuta([trimestre('Judo 3', undefined, undefined, { pagato: 5000 })])] }), corsi, listino, OGGI)), [['Judo 3', 'in_parte', null]])
  const futura = persona({ ricevute: [ricevuta([trimestre('Judo 3', '2026-12-20', '2027-03-20', { pagato: 5000 })])] })
  ok('un trimestre pagato in parte che comincia fra quattro giorni non è «in parte» oggi', cs(statoCorsi(futura, corsi, listino, OGGI)), [['Judo 3', 'da_pagare', null]])
}

console.log('\n20. Il consiglio della scheda: con quale voce si rimette a posto')
{
  const consiglio = lib('consiglioCorso')
  ok('trimestre', consiglio({ corsoId: 'judo3', corso: 'Judo 3', come: 'scaduto', formula: 'trimestre', al: '2026-12-15' }), 'Una ricevuta nuova con «Trimestre Judo 3» lo rimette a posto. In sala entra lo stesso.')
  ok('annuale', consiglio({ corsoId: 'pilates', corso: 'Pilates', come: 'scaduto', formula: 'annuale', al: '2026-06-30' }), 'Una ricevuta nuova con «Annuale Pilates» lo rimette a posto. In sala entra lo stesso.')
}

console.log(guai ? `\n${guai} ${guai === 1 ? 'cosa non torna' : 'cose non tornano'}` : '\nTUTTO A POSTO')
process.exit(guai ? 1 : 0)
