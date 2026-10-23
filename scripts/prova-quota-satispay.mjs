// ---------------------------------------------------------------------------
// Pagare con Satispay la quota associativa intera, senza browser e senza rete.
//
//   node scripts/prova-quota-satispay.mjs
//
// Dall'area iscritti l'iscritto, o il titolare per chi non ha un accesso suo,
// paga la quota di un rinnovo o di una prima iscrizione: la persona è
// `da_pagare` o `scaduto`. Niente quota già pagata, in parte (per il resto c'è
// il saldo), pagata fuori app, o già arrivata con Satispay.
// Le regole stanno in `src/lib/satispay.ts`, `saldoSatispay.ts`, `segreteria.ts`
// (`pagamentoDi`) e `iscrittoProva.ts`; l'importo lo calcola il database dal
// listino (`satispay_prepara_quota`, provata da `supabase/prova/quota-satispay.sql`,
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
const carica = async (contents, muto = false) => {
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
    if (!muto) console.log(`  ✗ non si carica: ${contents}\n      ${String(e.message).split('\n').slice(0, 2).join(' ')}`)
    return {}
  }
}
const s = await carica("export * from './src/lib/satispay'")
const g = await carica("export { pagamentoDi } from './src/lib/segreteria'")
// `export *`: un modulo che non c'è ancora non deve far cadere anche gli altri.
// La funzione può stare in `saldoSatispay.ts` o in un file vicino (`quotaSatispay.ts`).
const sx = { ...(await carica("export * from './src/lib/quotaSatispay'", true)), ...(await carica("export * from './src/lib/saldoSatispay'")) }
const li = await carica("export { LISTINO_PREDEFINITO, salvaListinoProva, scordaListinoProva } from './src/lib/listino'")
// Un solo bundle: l'archivio di prova dev'essere lo stesso per chi scrive e per chi legge.
const pr = await carica(
  "export { archivio } from './src/lib/archivioProva'; export { pagamentiSatispayProva, salvaSatispay } from './src/lib/richiesteProva'; export * as iscrittoLib from './src/lib/iscrittoProva'",
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
// Un rifiuto col testo che il database dà a chi paga (supabase/prova/quota-satispay.sql).
const conTesto = (v, testo) => (rifiutata(v) ? String(v) === `ERRORE: ${testo}` : false)

// Gli stessi testi del 105 (`satispay_prepara_quota`).
const T_RICEVUTA = 'La quota associativa ha già una ricevuta: per quel che manca c’è il saldo'
const T_FUORI_APP = 'La quota risulta già pagata fuori dall’app: chiedi alla segreteria'
const T_SATISPAY = 'Hai già pagato con Satispay: la segreteria prepara la ricevuta'

const OGGI_ISO = '2026-10-20'
const quota = { anno: 2026, numero: 12, dal: '2026-09-01', al: '2027-08-31', mancano: 3000 }
const scaduta = { anno: 2025, numero: 7, dal: '2025-09-01', al: '2026-08-31', mancano: 0 }
const dellaQuota = (id, extra = {}) => ({ id, personaId: 'p1', chi: 'Rossi Anna', importo: 5000, stato: 'pagato', creatoIl: '2026-10-20T08:00:00Z', pagatoIl: '2026-10-20T08:05:00Z', voce: 'quota', ...extra })
const saldo = (id, extra = {}) => ({ id, personaId: 'p1', chi: 'Rossi Anna', importo: 3000, stato: 'pagato', creatoIl: '2026-10-20T08:00:00Z', pagatoIl: '2026-10-20T08:05:00Z', saldoDi: 'r1', ...extra })
const iscrizione = (id, extra = {}) => ({ id, personaId: 'p1', chi: 'Rossi Anna', importo: 45000, stato: 'pagato', creatoIl: '2026-10-20T08:00:00Z', pagatoIl: '2026-10-20T08:05:00Z', ...extra })

console.log('1. la quota pagata con Satispay: come entra nei conti')
{
  const nome = () => 'Anna Rossi'
  ok('satispayPerPersona conta la quota come l\'iscrizione: la persona risulta pagata', prova(() => [...s.satispayPerPersona([dellaQuota('a')])]), [['p1', 5000]])
  ok('…e non conta il saldo', prova(() => [...s.satispayPerPersona([dellaQuota('a'), saldo('b')])]), [['p1', 5000]])
  ok('…in attesa o non andata non conta', prova(() => [...s.satispayPerPersona([dellaQuota('a', { stato: 'attesa' }), dellaQuota('b', { stato: 'non-andato' })])]), [])
  ok('…già in una ricevuta conta la ricevuta', prova(() => [...s.satispayPerPersona([dellaQuota('a', { ricevutaId: 'r2' })])]), [])
  ok('saldoPerPersona non conta la quota', prova(() => [...s.saldoPerPersona([dellaQuota('a')])]), [])
  ok('satispayDaUsare la prende per la ricevuta', prova(() => s.satispayDaUsare([dellaQuota('a')], 'p1')?.id ?? null), 'a')

  const righe = prova(() => s.righeSatispay([dellaQuota('a')], nome))
  ok('una quota pagata e non in ricevuta è una riga in PAGAMENTI', Array.isArray(righe) && righe.length, 1)
  ok('…con la voce «QUOTA ASSOCIATIVA», non ISCRIZIONE e non «(saldo)»', prova(() => righe[0].voce), 'QUOTA ASSOCIATIVA')
  ok('…per la cifra arrivata, con Satispay, di quella persona', prova(() => [righe[0].importo, righe[0].metodo, righe[0].personaId, righe[0].chi]), [5000, 'Satispay', 'p1', 'Anna Rossi'])
  ok('…non è un pagamento senza richiesta da restituire', prova(() => [righe[0].senzaRichiesta ?? false, righe[0].nota ?? null]), [false, null])
  ok('con la ricevuta non c\'è riga: conta la ricevuta', prova(() => s.righeSatispay([dellaQuota('a', { ricevutaId: 'r2' })], nome)), [])
  ok('in attesa non c\'è riga', prova(() => s.righeSatispay([dellaQuota('a', { stato: 'attesa', pagatoIl: undefined })], nome)), [])
  ok('l\'iscrizione resta ISCRIZIONE, il saldo resta «(saldo)»', prova(() => [s.righeSatispay([iscrizione('b')], nome)[0].voce, s.righeSatispay([saldo('c')], nome)[0].voce]), ['ISCRIZIONE', 'QUOTA ASSOCIATIVA (saldo)'])
}

console.log('\n2. com\'è messa la quota dopo il pagamento')
{
  const sen = (extra) => prova(() => g.pagamentoDi({ pagamento: { stato: 'da_pagare' }, quote: [], ...extra }, OGGI_ISO))
  const pagata = sen({ satispay: 5000 })
  ok('da pagare con 50 € di Satispay: pagata, fonte Satispay', [pagata.come, pagata.fonte, pagata.importo], ['pagato', 'satispay', 5000])
  const rinnovo = sen({ quote: [scaduta], satispay: 5000 })
  ok('scaduta con 50 € di Satispay: pagata, fonte Satispay', [rinnovo.come, rinnovo.fonte, rinnovo.importo], ['pagato', 'satispay', 5000])
  ok('senza Satispay, da pagare e scaduta restano come sono', [sen({}).come, sen({ quote: [scaduta] }).come], ['da_pagare', 'scaduto'])
}

console.log('\n3. quando si può pagare la quota')
{
  const tutto = { online: true, attivo: true, adulto: true, haAccessoProprio: true, comeTitolare: false, importo: 5000 }
  const puoi = (p, o = {}) => prova(() => sx.puoiPagareLaQuota(p, OGGI_ISO, { ...tutto, ...o }))
  const veto = (r) => !!r && typeof r === 'object' && 'perche' in r && typeof r.perche === 'string'
  const daPagare = { pagamento: { stato: 'da_pagare' }, quote: [] }
  const inScadenza = { pagamento: { stato: 'da_pagare' }, quote: [scaduta] }
  ok('da pagare, adulto: sì, per l\'importo che arriva dal database', puoi(daPagare), { importo: 5000 })
  ok('scaduta, adulto: sì', puoi(inScadenza), { importo: 5000 })
  ok('scaduta fuori app (eccezione finita): sì', puoi({ pagamento: { stato: 'pagato', fino: '2026-09-01' }, quote: [] }), { importo: 5000 })
  ok('l\'importo è quello che dà chi chiama, mai un altro', puoi(daPagare, { importo: 4250 }), { importo: 4250 })
  ok('senza importo (il database non lo dà: non si paga adesso): niente tasto', veto(puoi(daPagare, { importo: null })), true)
  ok('…nemmeno se manca del tutto', veto(puoi(daPagare, { importo: undefined })), true)
  ok('senza rete: serve la rete', puoi(daPagare, { online: false }), { perche: 'Serve la rete per pagare', motivo: 'rete' })
  ok('Satispay spento: niente tasto, e dice cosa fare', veto(puoi(daPagare, { attivo: false })), true)
  ok('…col motivo vuoto: non è né «pagato» né «rete»', [veto(puoi(daPagare, { attivo: false })), puoi(daPagare, { attivo: false }).motivo], [true, undefined])
  ok('minorenne, da sé: no', veto(puoi(daPagare, { adulto: false })), true)
  ok('minorenne senza accesso, dal titolare: sì', puoi(daPagare, { adulto: false, haAccessoProprio: false, comeTitolare: true }), { importo: 5000 })
  ok('adulto senza accesso suo, dal titolare: sì', puoi(daPagare, { haAccessoProprio: false, comeTitolare: true }), { importo: 5000 })
  ok('familiare con accesso proprio, dal titolare: niente tasto', veto(puoi(daPagare, { comeTitolare: true })), true)
  ok('minorenne con accesso proprio, dal titolare: niente tasto', veto(puoi(daPagare, { adulto: false, comeTitolare: true })), true)
  const gia = puoi(daPagare, { giaPagato: true })
  ok('quota già arrivata, ricevuta non ancora fatta: niente tasto, motivo «pagato»', [veto(gia), gia.motivo], [true, 'pagato'])
  ok('quota pagata dalla ricevuta: niente tasto', veto(puoi({ pagamento: { stato: 'da_pagare' }, quote: [{ ...quota, mancano: 0 }] })), true)
  ok('quota in parte (per il resto c\'è il saldo): niente tasto', veto(puoi({ pagamento: { stato: 'da_pagare' }, quote: [quota] })), true)
  ok('pagata fuori app: niente tasto', veto(puoi({ pagamento: { stato: 'pagato', fino: '2027-01-01' }, quote: [] })), true)
  ok('in parte fuori app: niente tasto', veto(puoi({ pagamento: { stato: 'in_parte', fino: '2027-01-01' }, quote: [] })), true)
  ok('già pagata con Satispay (la proposta non si offre più): niente tasto', veto(puoi({ ...daPagare, satispay: 5000 })), true)
  ok('…anche il rinnovo', veto(puoi({ ...inScadenza, satispay: 5000 })), true)
  ok('il perché ha un codice: pagato, rete, nessuno per gli altri', [puoi(daPagare, { giaPagato: true }).motivo, puoi(daPagare, { online: false }).motivo, puoi(daPagare, { adulto: false }).motivo], ['pagato', 'rete', undefined])
}

console.log('\n4. i testi dopo il pagamento')
{
  const esito = (p) => prova(() => sx.esitoQuota(p))
  const testi = (e) => (e && Array.isArray(e.testi) ? e.testi.join(' ') : '')
  const att = esito({ stato: 'attesa', importo: 5000, chi: 'Anna Rossi' })
  ok('in attesa: il titolo', att.titolo, 'IN ATTESA DI SATISPAY')
  ok('…dice chi, quanto e di non pagare di nuovo', [testi(att).includes('Anna Rossi'), testi(att).includes(s.soldi(5000)), testi(att).includes('Non pagare di nuovo')], [true, true, true])
  ok('…tono d\'avviso', att.tono, 'avviso')

  const pag = esito({ stato: 'pagato', importo: 5000, pagatoIl: '2026-10-20T08:05:00Z', chi: 'Anna Rossi' })
  ok('pagato: il titolo con la cifra', pag.titolo, `PAGATO · ${s.soldi(5000)}`)
  ok('…il testo, con chi e la ricevuta', testi(pag), `Hai pagato ${s.soldi(5000)} con Satispay per Anna Rossi. La segreteria prepara la ricevuta e la trovi in DOCUMENTI, sotto RICEVUTE.`)
  ok('…tono fatto', pag.tono, 'fatto')

  const no = esito({ stato: 'non-andato', importo: 5000, chi: 'Anna Rossi' })
  ok('non andato: il titolo', no.titolo, 'NON È ANDATO')
  ok('…dice che non sono stati presi soldi', testi(no).includes('non ti abbiamo preso soldi'), true)
  ok('…tono d\'avviso', no.tono, 'avviso')
}

console.log('\n5. la modalità prova: pagaQuotaProva')
{
  const i = pr.iscrittoLib ?? {}
  const d = pr.archivio?.dati
  const iscritti = (d?.persone ?? []).filter((p) => p.ruolo === 'iscritto' && p.attiva)
  const [anna, luca] = iscritti
  const voce = (pagato, dal = '2026-09-01', al = '2027-08-31') => ({ descrizione: 'QUOTA ASSOCIATIVA', quantita: 1, prezzo: 5000, dal, al, pagamenti: pagato ? [{ data: OGGI_ISO, importo: pagato, metodo: 'Contanti' }] : [] })
  const ricevuta = (id, numero, persona, pagato, extra = {}, v = voce(pagato)) => ({
    id, anno: 2026, numero, data: OGGI_ISO, personaId: persona?.id, ente: { nome: 'ODS' }, intestatario: { nome: persona?.nome ?? '', cognome: persona?.cognome ?? '' },
    voci: [v], anticipo: 0, totale: 5000, pagato, creataIl: '2026-10-20T08:00:00Z', ...extra,
  })
  const dei = () => (pr.pagamentiSatispayProva?.() ?? []).filter((p) => p.voce === 'quota')
  // Annalisa e Luca partono da pagare e senza ricevute: ognuno dei casi cambia solo quel che gli serve.
  const riparti = (ric = [], pagamento = { stato: 'da_pagare' }) => {
    if (!d || !anna || !luca) return
    d.ricevute = (d.ricevute ?? []).filter((r) => r.personaId !== anna.id && r.personaId !== luca.id).concat(ric)
    anna.pagamento = pagamento
    luca.pagamento = { stato: 'da_pagare' }
    pr.salvaSatispay?.([])
  }
  const tocca = (p) => aspetta(() => i.pagaQuotaProva(p?.id))
  const nessunaScrittura = async (cosa, testo) => {
    const prima = (pr.pagamentiSatispayProva?.() ?? []).length
    const v = await tocca(anna)
    ok(cosa, conTesto(v, testo), true)
    ok('…e non ha scritto niente', (pr.pagamentiSatispayProva?.() ?? []).length, prima)
  }

  // I rifiuti, con gli stessi testi del database.
  riparti([ricevuta('r-q-1', 901, anna, 5000)])
  await nessunaScrittura('una quota pagata tutta, con la ricevuta, non si paga', T_RICEVUTA)
  riparti([ricevuta('r-q-2', 902, anna, 2000)])
  await nessunaScrittura('una quota pagata in parte non si paga: per il resto c\'è il saldo', T_RICEVUTA)
  riparti([], { stato: 'pagato', fino: '2027-01-01' })
  await nessunaScrittura('pagata fuori app, oggi valido: no', T_FUORI_APP)
  riparti([], { stato: 'in_parte', fino: '2027-01-01' })
  await nessunaScrittura('…anche «in parte» fuori app: no', T_FUORI_APP)
  riparti()
  pr.salvaSatispay?.([saldo('s1', { personaId: anna?.id, saldoDi: 'r-qualunque', creatoIl: '2026-10-20T08:00:00Z' })])
  await nessunaScrittura('un saldo di Satispay già arrivato e non in ricevuta: no', T_SATISPAY)
  riparti()
  ok('una persona che non c\'è non si paga', rifiutata(await aspetta(() => i.pagaQuotaProva('non-esiste'))), true)

  // La quota che si paga: ricevuta annullata e quota finita non contano; l'importo è quello del listino.
  riparti([ricevuta('r-q-3', 903, anna, 5000, { annullataIl: '2026-10-20T09:00:00Z' }), ricevuta('r-q-4', 904, anna, 5000, {}, voce(5000, '2025-09-01', '2026-08-31'))])
  const primo = await tocca(anna)
  ok('il primo tocco scrive un pagamento, e non dà errore', inCoda(primo), false)
  ok('…uno solo, della quota', dei().length, 1)
  ok('…pagato, di quella persona, per la quota del listino (50 €), non è un saldo né un\'iscrizione', [dei()[0]?.stato, dei()[0]?.personaId, dei()[0]?.importo, dei()[0]?.saldoDi ?? null], ['pagato', anna?.id, 5000, null])
  ok('…con il chi (cognome nome) e il quando', [dei()[0]?.chi, !!dei()[0]?.pagatoIl], [`${anna?.cognome} ${anna?.nome}`, true])
  ok('…e la persona risulta pagata con Satispay: la proposta non si offre più', (() => {
    const q = g.pagamentoDi?.({ pagamento: { stato: 'da_pagare' }, quote: [], satispay: s.satispayPerPersona?.(pr.pagamentiSatispayProva?.() ?? []).get(anna?.id) }, OGGI_ISO)
    return [q?.come, q?.fonte, q?.importo]
  })(), ['pagato', 'satispay', 5000])
  ok('…e non è un saldo', [...(s.saldoPerPersona?.(pr.pagamentiSatispayProva?.() ?? []) ?? [])], [])
  ok('un secondo tocco è rifiutato (non resta niente da pagare), e non scrive', [conTesto(await tocca(anna), T_SATISPAY), dei().length], [true, 1])

  // Il listino cambia: l'importo cambia con lui, mai dal telefono.
  riparti()
  li.salvaListinoProva?.({ ...li.LISTINO_PREDEFINITO, quota: 42.5 })
  await tocca(anna)
  ok('con la quota del listino a 42,50 €, si paga 42,50 €', dei().map((p) => p.importo), [4250])
  li.scordaListinoProva?.()

  // Dal titolare, dall'oggetto che usa l'app: scaduta fuori app è un rinnovo.
  riparti([], { stato: 'pagato', fino: '2026-09-01' })
  luca.pagamento = { stato: 'pagato', fino: '2026-09-01' }
  const dati = i.creaIscrittoProva?.()
  const dal = await aspetta(() => dati.pagaQuota(luca?.id))
  ok('pagaQuota di chi usa l\'app: nessun errore e nessun link (in prova non c\'è Satispay)', dal, null)
  ok('…scrive il pagamento di Luca, pagato', dei().filter((p) => p.personaId === luca?.id).map((p) => [p.stato, p.importo]), [['pagato', 5000]])
  const stato = await aspetta(() => dati.statoQuota(luca?.id))
  ok('statoQuota: pagato, la cifra, il quando e il chi', [stato?.stato, stato?.importo, !!stato?.pagatoIl, typeof stato?.chi], ['pagato', 5000, true, 'string'])
  ok('…e di chi non ha pagato niente: null', await aspetta(() => dati.statoQuota(anna?.id)), null)

  // La scheda che vede l'iscritto non deve contraddirsi: pagata con Satispay vuol dire quota pagata anche nel riquadro e negli avvisi.
  const sch = await aspetta(() => dati.scheda(luca?.id))
  ok('la scheda di Luca dopo il pagamento: quota pagata con Satispay (non «da pagare»)', [g.pagamentoDi?.(sch, OGGI_ISO)?.come, g.pagamentoDi?.(sch, OGGI_ISO)?.fonte], ['pagato', 'satispay'])
  ok('…e nel nucleo (Luca è titolare di sé stesso) vale lo stesso', (await aspetta(() => dati.nucleo(luca?.id)))?.filter?.((x) => x.id === luca?.id).map((x) => g.pagamentoDi?.(x, OGGI_ISO)?.come), ['pagato'])
  anna.pagamento = { stato: 'da_pagare' }
  ok('…chi non ha pagato niente resta da pagare', g.pagamentoDi?.(await aspetta(() => dati.scheda(anna?.id)), OGGI_ISO)?.come, 'da_pagare')
}

console.log(guai ? `\n${guai} da sistemare` : '\nTutto a posto')
process.exit(guai ? 1 : 0)
