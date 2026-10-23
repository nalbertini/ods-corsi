// ---------------------------------------------------------------------------
// Pagare con Satispay il saldo della quota associativa, senza browser e senza rete.
//
//   node scripts/prova-saldo-satispay.mjs
//
// Dall'area iscritti (DOCUMENTI e NUCLEO) l'iscritto, o il titolare per chi
// non ha un accesso suo, paga solo la quota associativa che manca: una
// ricevuta con QUOTA ASSOCIATIVA e `mancano` > 0 (`in_parte`, fonte ricevuta).
// Niente rinnovi, quote intere, corsi, da pagare/scaduto, pagato fuori app.
// Le regole stanno in `src/lib/satispay.ts`, `saldoSatispay.ts`, `segreteria.ts`
// (`pagamentoDi`) e `iscrittoProva.ts`; l'importo lo calcola il database
// (`satispay_prepara_saldo`, provata da `supabase/prova/saldo-satispay.sql`,
// con gli stessi casi e gli stessi messaggi).
// ---------------------------------------------------------------------------
import { build } from 'esbuild'

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
globalThis.window = { location: { search: '', hash: '', pathname: '/iscritti/' }, addEventListener() {} }

// Un modulo per volta: uno che manca fa rosso i suoi casi, non ferma gli altri.
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
const s = await carica("export * from './src/lib/satispay'")
const g = await carica("export { pagamentoDi } from './src/lib/segreteria'")
// `export *`: un modulo che non c'ancora non deve far cadere anche gli altri.
const sx = await carica("export * from './src/lib/saldoSatispay'")
// Un solo bundle: l'archivio di prova dev'essere lo stesso per chi scrive e per chi legge.
const pr = await carica(
  "export { archivio } from './src/lib/archivioProva'; export { pagamentiSatispayProva } from './src/lib/richiesteProva'; export * as iscrittoLib from './src/lib/iscrittoProva'",
)

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
const inCoda = (v) => String(v).startsWith('ERRORE: ')
// Un rifiuto vero, non la funzione che manca.
const rifiutata = (v) => inCoda(v) && !/not a function|undefined|not defined/.test(String(v))

const OGGI_ISO = '2026-10-20'
const quota = { anno: 2026, numero: 12, dal: '2026-09-01', al: '2027-08-31', mancano: 3000 }
const base = { pagamento: { stato: 'da_pagare' }, quote: [quota] }
const saldo = (id, extra = {}) => ({ id, personaId: 'p1', chi: 'Rossi Anna', importo: 3000, stato: 'pagato', creatoIl: '2026-10-20T08:00:00Z', pagatoIl: '2026-10-20T08:05:00Z', saldoDi: 'r1', ...extra })
const iscrizione = (id, extra = {}) => ({ id, personaId: 'p1', chi: 'Rossi Anna', importo: 45000, stato: 'pagato', creatoIl: '2026-10-20T08:00:00Z', pagatoIl: '2026-10-20T08:05:00Z', ...extra })

console.log('1. un saldo non è mai l\'iscrizione')
{
  ok('satispayPerPersona ignora il saldo', prova(() => [...s.satispayPerPersona([saldo('a'), iscrizione('b')])]), [['p1', 45000]])
  ok('…e con il solo saldo non c\'è niente', prova(() => [...s.satispayPerPersona([saldo('a')])]), [])
  ok('satispayDaUsare non prende il saldo per la ricevuta dell\'iscrizione', prova(() => s.satispayDaUsare([saldo('a')], 'p1')?.id ?? null), null)
  ok('…ma prende l\'iscrizione', prova(() => s.satispayDaUsare([saldo('a'), iscrizione('b')], 'p1')?.id ?? null), 'b')
}

console.log('\n2. i saldi arrivati e non ancora in ricevuta, per persona')
{
  ok('un saldo pagato conta per la persona', prova(() => [...s.saldoPerPersona([saldo('a')])]), [['p1', 3000]])
  ok('due persone, due totali', prova(() => [...s.saldoPerPersona([saldo('a'), saldo('b', { personaId: 'p2', importo: 1500 })])]), [['p1', 3000], ['p2', 1500]])
  ok('in attesa non conta', prova(() => [...s.saldoPerPersona([saldo('a', { stato: 'attesa' })])]), [])
  ok('non andato non conta', prova(() => [...s.saldoPerPersona([saldo('a', { stato: 'non-andato' })])]), [])
  ok('già in una ricevuta conta la ricevuta, non il saldo', prova(() => [...s.saldoPerPersona([saldo('a', { ricevutaId: 'r2' })])]), [])
  ok('l\'iscrizione non è un saldo', prova(() => [...s.saldoPerPersona([iscrizione('b')])]), [])
}

console.log('\n3. PAGAMENTI e CONTABILITÀ: un incasso solo')
{
  const nome = () => 'Anna Rossi'
  const righe = prova(() => s.righeSatispay([saldo('a')], nome))
  ok('un saldo pagato e non in ricevuta è una riga', Array.isArray(righe) && righe.length, 1)
  ok('…con la voce «QUOTA ASSOCIATIVA (saldo)», non ISCRIZIONE', prova(() => righe[0].voce), 'QUOTA ASSOCIATIVA (saldo)')
  ok('…per la cifra arrivata, con Satispay, di quella persona', prova(() => [righe[0].importo, righe[0].metodo, righe[0].personaId, righe[0].chi]), [3000, 'Satispay', 'p1', 'Anna Rossi'])
  ok('…non è un pagamento senza richiesta da restituire', prova(() => righe[0].senzaRichiesta ?? false), false)
  ok('con la ricevuta non c\'è riga: conta la ricevuta', prova(() => s.righeSatispay([saldo('a', { ricevutaId: 'r2' })], nome)), [])
  ok('in attesa non c\'è riga', prova(() => s.righeSatispay([saldo('a', { stato: 'attesa', pagatoIl: undefined })], nome)), [])
  ok('l\'iscrizione resta ISCRIZIONE', prova(() => s.righeSatispay([iscrizione('b')], nome)[0].voce), 'ISCRIZIONE')
}

console.log('\n4. com\'è messa la quota con un saldo in arrivo')
{
  const sen = (extra) => prova(() => g.pagamentoDi({ ...base, ...extra }, OGGI_ISO))
  ok('senza saldo: in parte, mancano 3000, dalla ricevuta', [sen({}).come, sen({}).fonte, sen({}).mancano, sen({}).ricevuta], ['in_parte', 'ricevuta', 3000, '12/2026'])
  const meta = sen({ saldo: 1000 })
  ok('un saldo di 1000: in parte, ne mancano 2000', [meta.come, meta.fonte, meta.mancano, meta.ricevuta], ['in_parte', 'ricevuta', 2000, '12/2026'])
  const tutto = sen({ saldo: 3000 })
  ok('un saldo che copre tutto: pagata con Satispay', [tutto.come, tutto.fonte, tutto.importo], ['pagato', 'satispay', 3000])
  ok('un saldo senza ricevuta con la quota da pagare non fa niente', sen({ quote: [], saldo: 1000 }).come, 'da_pagare')
  ok('il saldo non tocca una quota già pagata dalla ricevuta', (() => { const x = sen({ quote: [{ ...quota, mancano: 0 }], saldo: 1000 }); return [x.come, x.fonte] })(), ['pagato', 'ricevuta'])
  const dopo = prova(() => g.pagamentoDi({ ...base, quote: [quota, { ...quota, numero: 13, mancano: 0 }] }, OGGI_ISO))
  ok('dopo la ricevuta del saldo: pagata dalla ricevuta, la nuova', [dopo.come, dopo.fonte, dopo.ricevuta], ['pagato', 'ricevuta', '13/2026'])
}

console.log('\n5. quando si può pagare il saldo')
{
  const tutto = { online: true, attivo: true, adulto: true, haAccessoProprio: true, comeTitolare: false }
  const puoi = (p, o = {}) => prova(() => sx.puoiPagareIlSaldo(p, OGGI_ISO, { ...tutto, ...o }))
  const veto = (r) => !!r && typeof r === 'object' && 'perche' in r && typeof r.perche === 'string'
  ok('adulto, in parte da ricevuta: sì, quale ricevuta e quanto', puoi(base), { ricevuta: '12/2026', mancano: 3000 })
  ok('senza rete: serve la rete', puoi(base, { online: false }), { perche: 'Serve la rete per pagare', motivo: 'rete' })
  ok('Satispay spento: si paga in palestra', puoi(base, { attivo: false }), { perche: 'Pagare online non è ancora attivo: il resto si paga in palestra.' })
  ok('minorenne, da sé: no', veto(puoi(base, { adulto: false })), true)
  ok('minorenne senza accesso, dal titolare: sì', puoi(base, { adulto: false, haAccessoProprio: false, comeTitolare: true }), { ricevuta: '12/2026', mancano: 3000 })
  ok('adulto senza accesso suo, dal titolare: sì', puoi(base, { haAccessoProprio: false, comeTitolare: true }), { ricevuta: '12/2026', mancano: 3000 })
  ok('familiare con accesso proprio, dal titolare: niente tasto', veto(puoi(base, { haAccessoProprio: true, comeTitolare: true })), true)
  ok('minorenne con accesso proprio, dal titolare: niente tasto', veto(puoi(base, { adulto: false, haAccessoProprio: true, comeTitolare: true })), true)
  ok('saldo già arrivato, ricevuta non ancora fatta: niente tasto', puoi(base, { giaPagato: true }), { perche: 'Questo resto è già stato pagato: la segreteria prepara la ricevuta.', motivo: 'pagato' })
  ok('quota pagata dalla ricevuta: niente tasto', veto(puoi({ ...base, quote: [{ ...quota, mancano: 0 }] })), true)
  ok('da pagare (nessuna ricevuta): niente tasto, è un\'iscrizione', veto(puoi({ pagamento: { stato: 'da_pagare' }, quote: [] })), true)
  ok('scaduta: niente tasto, è un rinnovo', veto(puoi({ pagamento: { stato: 'da_pagare' }, quote: [{ ...quota, dal: '2025-09-01', al: '2026-08-31' }] })), true)
  ok('in parte fuori app: niente tasto', veto(puoi({ pagamento: { stato: 'in_parte', fino: '2027-01-01' }, quote: [] })), true)
  ok('già pagata con Satispay dal modulo: niente tasto', veto(puoi({ ...base, quote: [], satispay: 4500 })), true)
  ok('il perché ha un codice: pagato, rete, nessuno per gli altri', [puoi(base, { giaPagato: true }).motivo, puoi(base, { online: false }).motivo, puoi(base, { attivo: false }).motivo], ['pagato', 'rete', undefined])
}

console.log('\n5b. il ritorno da Satispay e gli altri del nucleo')
{
  ok('l\'indirizzo del ritorno: ricevuta e persona', sx.ritornoDelSaldo?.('?saldo=r1&persona=p1&x=2'), { ricevuta: 'r1', persona: 'p1' })
  ok('…senza la persona non è un ritorno', sx.ritornoDelSaldo?.('?saldo=r1'), null)
  ok('…né senza niente', sx.ritornoDelSaldo?.(''), null)
  const mem = (id, nome) => ({ ...base, id, nome, cognome: 'Rossi' })
  const rs = (id, personaId, numero) => ({ id, personaId, numero, anno: 2026 })
  const nucleo = [mem('a', 'Anna'), mem('b', 'Luca'), { ...mem('c', 'Gaia'), quote: [], pagamento: { stato: 'pagato', fino: '2027-01-01' } }]
  const altri = prova(() => sx.altriConResto(nucleo, [rs('ra', 'a', 12), rs('rb', 'b', 12)], OGGI_ISO, 'a'))
  ok('gli altri con un resto: nome e cognome, la ricevuta e quanto, non chi ha appena pagato né chi è a posto', altri, [{ persona: 'b', ricevuta: 'rb', chi: 'Luca Rossi', mancano: 3000 }])
  ok('senza la loro ricevuta non si può pagare: nessuno', prova(() => sx.altriConResto(nucleo, [], OGGI_ISO, 'a')), [])
  const due = [{ persona: 'b', ricevuta: 'rb', chi: 'Luca Rossi', mancano: 3000 }, { persona: 'd', ricevuta: 'rd', chi: 'Dino Rossi', mancano: 1000 }]
  ok('il primo resto è quello non ancora pagato', sx.primoResto?.(due, ['pagato', null])?.chi, 'Dino Rossi')
  ok('…se non si sa, resta da pagare', sx.primoResto?.(due, [null, 'pagato'])?.chi, 'Luca Rossi')
  ok('…se sono tutti pagati, nessuno', sx.primoResto?.(due, ['pagato', 'pagato']), null)
}

console.log('\n6. i testi dopo il pagamento')
{
  const esito = (p, restano = null) => prova(() => (sx.esitoSaldo ?? s.esitoSaldo)(p, restano))
  const testi = (e) => (e && Array.isArray(e.testi) ? e.testi.join(' ') : '')
  const att = esito({ stato: 'attesa', importo: 5500, chi: 'Anna Rossi' })
  ok('in attesa: il titolo', att.titolo, 'IN ATTESA DI SATISPAY')
  ok('…dice chi, quanto e di non pagare di nuovo', [testi(att).includes('Anna Rossi'), testi(att).includes(s.soldi(5500)), testi(att).includes('Non pagare di nuovo')], [true, true, true])
  ok('…tono d\'avviso, come esitoPagamento', att.tono, 'avviso')

  const pag = esito({ stato: 'pagato', importo: 5500, pagatoIl: '2026-10-20T08:05:00Z', chi: 'Anna Rossi' })
  ok('pagato: il titolo con la cifra', pag.titolo, `PAGATO · ${s.soldi(5500)}`)
  ok('…la ricevuta la prepara la segreteria', testi(pag).includes('La segreteria prepara la ricevuta e la trovi in RICEVUTE'), true)
  ok('…tono fatto', pag.tono, 'fatto')
  ok('…senza altri da pagare non dice niente di «ancora»', [String(pag.titolo).startsWith('PAGATO'), testi(pag).includes('ANCORA DA PAGARE')], [true, false])
  const resta = esito({ stato: 'pagato', importo: 5500, chi: 'Anna Rossi' }, { chi: 'Luca Rossi', mancano: 3000 })
  ok('…con un altro che ha ancora il saldo: lo dice, con nome e cifra', testi(resta).includes(`ANCORA DA PAGARE Luca Rossi · ${s.soldi(3000)}`), true)

  const no = esito({ stato: 'non-andato', importo: 5500, chi: 'Anna Rossi' })
  ok('non andato: il titolo', no.titolo, 'NON È ANDATO')
  ok('…dice che non sono stati presi soldi', testi(no).includes('non ti abbiamo preso soldi'), true)
  ok('…tono d\'avviso', no.tono, 'avviso')
}

console.log('\n7. la modalità prova: pagaSaldoProva')
{
  const i = pr.iscrittoLib ?? {}
  const d = pr.archivio?.dati
  const iscritti = (d?.persone ?? []).filter((p) => p.ruolo === 'iscritto' && p.attiva)
  const [anna, luca] = iscritti
  const voce = (pagato) => ({ descrizione: 'QUOTA ASSOCIATIVA', quantita: 1, prezzo: 5000, dal: '2026-09-01', al: '2027-08-31', pagamenti: pagato ? [{ data: OGGI_ISO, importo: pagato, metodo: 'Contanti' }] : [] })
  const ricevuta = (id, numero, persona, pagato) => ({
    id, anno: 2026, numero, data: OGGI_ISO, personaId: persona?.id, ente: { nome: 'ODS' }, intestatario: { nome: persona?.nome ?? '', cognome: persona?.cognome ?? '' },
    voci: [voce(pagato)], anticipo: 0, totale: 5000, pagato, creataIl: '2026-10-20T08:00:00Z',
  })
  if (d && anna && luca) {
    d.ricevute = [...(d.ricevute ?? []), ricevuta('r-saldo-1', 901, anna, 2000), ricevuta('r-saldo-2', 902, luca, 5000), ricevuta('r-saldo-3', 903, luca, 0)]
  }
  const dei = () => (pr.pagamentiSatispayProva?.() ?? []).filter((p) => p.saldoDi === 'r-saldo-1')

  const primo = await aspetta(() => i.pagaSaldoProva(anna?.id, 'r-saldo-1'))
  ok('il primo tocco scrive un pagamento, e non dà errore', inCoda(primo), false)
  ok('…uno solo', dei().length, 1)
  ok('…pagato, di quella persona, per quanto manca adesso (50 − 20 €)', [dei()[0]?.stato, dei()[0]?.personaId, dei()[0]?.importo], ['pagato', anna?.id, 3000])
  await aspetta(() => i.pagaSaldoProva(anna?.id, 'r-saldo-1'))
  ok('un secondo tocco non crea un secondo pagamento', dei().length, 1)
  ok('…e il saldo non è l\'iscrizione', [dei().length, [...s.satispayPerPersona(pr.pagamentiSatispayProva?.() ?? [])]], [1, []])

  const prima = (pr.pagamentiSatispayProva?.() ?? []).length
  ok('la ricevuta di un altro non si paga', rifiutata(await aspetta(() => i.pagaSaldoProva(anna?.id, 'r-saldo-2'))), true)
  ok('una quota già pagata tutta non si paga', rifiutata(await aspetta(() => i.pagaSaldoProva(luca?.id, 'r-saldo-2'))), true)
  ok('una ricevuta che non c\'è non si paga', rifiutata(await aspetta(() => i.pagaSaldoProva(anna?.id, 'non-esiste'))), true)
  d && (d.ricevute = d.ricevute.map((r) => (r.id === 'r-saldo-3' ? { ...r, annullataIl: '2026-10-20T09:00:00Z' } : r)))
  ok('una ricevuta annullata non si paga', rifiutata(await aspetta(() => i.pagaSaldoProva(luca?.id, 'r-saldo-3'))), true)
  ok('…e i rifiuti non scrivono niente', (pr.pagamentiSatispayProva?.() ?? []).length, prima)
  ok('un saldo già pagato e non in ricevuta: un altro tocco è rifiutato (non resta niente)', rifiutata(await aspetta(() => i.pagaSaldoProva(anna?.id, 'r-saldo-1'))), true)
  // La quota cresce dopo il primo pagamento: si paga solo la differenza, come `saldo_mancano`.
  d && (d.ricevute = d.ricevute.map((r) => (r.id === 'r-saldo-1' ? { ...r, pagato: 1000, voci: [voce(1000)] } : r)))
  await aspetta(() => i.pagaSaldoProva(anna?.id, 'r-saldo-1'))
  ok('…e se la quota cresce, si paga la differenza (40 − 30 €)', dei().map((p) => p.importo).sort(), [1000, 3000])
}

console.log(guai ? `\n${guai} da sistemare` : '\nTutto a posto')
process.exit(guai ? 1 : 0)
