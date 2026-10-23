// ---------------------------------------------------------------------------
// Pagare con Satispay un corso semplice, dall'area iscritti, senza browser e senza rete.
//
//   node scripts/prova-corso-satispay.mjs
//
// Un corso «semplice» ha una sola riga di prezzo nel listino: l'iscritto, o il
// titolare per chi non ha un accesso suo, lo paga annuale o trimestre. Con più
// righe (sconti, più corsi insieme) il prezzo lo fa la segreteria. L'importo lo
// calcola il database dal listino (`satispay_prepara_corso`, provata da
// `supabase/prova/corso-satispay.sql`, con gli stessi casi e gli stessi messaggi).
// Le regole stanno in `src/lib/satispay.ts`, `corsiDaPagare.ts`,
// `corsoSatispay.ts` e `iscrittoProva.ts`.
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
const cd = await carica("export { statoCorsi } from './src/lib/corsiDaPagare'")
const cs = await carica("export * from './src/lib/corsoSatispay'")
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
// Un rifiuto col testo che il database dà a chi paga (supabase/prova/corso-satispay.sql).
const conTesto = (v, testo) => (rifiutata(v) ? String(v) === `ERRORE: ${testo}` : false)

// Gli stessi testi del 106 (`satispay_prepara_corso`).
const T_NON_ISCRITTO = 'Questa persona non è iscritta a questo corso'
const T_FORMULA = 'Scegli se pagare l’annuale o il trimestre'
const T_NON_IN_LISTINO = 'Il corso non è nel listino: chiedi alla segreteria'
const T_SEGRETERIA = 'Per questo corso il prezzo lo fa la segreteria: chiedi lì o paga in palestra'
const T_RICEVUTA = 'Il corso ha già una ricevuta: per quel che manca chiedi alla segreteria'
const T_FUORI_APP = 'Il corso risulta già pagato fuori dall’app: chiedi alla segreteria'
const T_SATISPAY = 'Hai già pagato con Satispay: la segreteria prepara la ricevuta'

const OGGI_ISO = '2026-10-20'
const dalCorso = (id, extra = {}) => ({ id, personaId: 'p1', chi: 'Rossi Anna', importo: 30000, stato: 'pagato', creatoIl: '2026-10-20T08:00:00Z', pagatoIl: '2026-10-20T08:05:00Z', voce: 'corso', corsoId: 'c1', formula: 'annuale', corso: 'Judo', ...extra })
const dellaQuota = (id, extra = {}) => ({ id, personaId: 'p1', chi: 'Rossi Anna', importo: 5000, stato: 'pagato', creatoIl: '2026-10-20T08:00:00Z', pagatoIl: '2026-10-20T08:05:00Z', voce: 'quota', ...extra })

console.log('1. il corso pagato con Satispay: come entra nei conti')
{
  const nome = () => 'Anna Rossi'
  ok('satispayPerPersona non conta il corso: è dell\'iscrizione di prima, non della quota', prova(() => [...s.satispayPerPersona([dalCorso('a')])]), [])
  ok('…la quota sì, anche se c\'è un corso', prova(() => [...s.satispayPerPersona([dalCorso('a'), dellaQuota('b')])]), [['p1', 5000]])
  ok('satispayCorsiPerPersona: i corsi pagati e non ancora in ricevuta, per persona', prova(() => [...s.satispayCorsiPerPersona([dalCorso('a'), dalCorso('b', { corsoId: 'c2' })])]), [['p1', ['c1', 'c2']]])
  ok('…in attesa, non andato e già in ricevuta no', prova(() => [...s.satispayCorsiPerPersona([dalCorso('a', { stato: 'attesa' }), dalCorso('b', { stato: 'non-andato' }), dalCorso('c', { ricevutaId: 'r1' })])]), [])
  ok('…la quota e l\'iscrizione non sono un corso', prova(() => [...s.satispayCorsiPerPersona([dellaQuota('a'), { ...dalCorso('b'), voce: undefined }])]), [])
  ok('saldoPerPersona non conta il corso', prova(() => [...s.saldoPerPersona([dalCorso('a')])]), [])
  ok('satispayDaUsare la prende per la ricevuta del corso', prova(() => s.satispayDaUsare([dalCorso('a')], 'p1')?.id ?? null), 'a')

  const righe = prova(() => s.righeSatispay([dalCorso('a')], nome))
  ok('un corso pagato e non in ricevuta è una riga in PAGAMENTI', Array.isArray(righe) && righe.length, 1)
  ok('…con la voce della formula e del corso, non ISCRIZIONE', prova(() => righe[0].voce), 'ANNUALE JUDO')
  ok('…il trimestre si legge TRIMESTRE', prova(() => s.righeSatispay([dalCorso('a', { formula: 'trimestre', corso: 'Pilates' })], nome)[0].voce), 'TRIMESTRE PILATES')
  ok('…per la cifra arrivata, con Satispay, di quella persona', prova(() => [righe[0].importo, righe[0].metodo, righe[0].personaId, righe[0].chi]), [30000, 'Satispay', 'p1', 'Anna Rossi'])
  ok('…non è un pagamento senza richiesta da restituire', prova(() => [righe[0].senzaRichiesta ?? false, righe[0].nota ?? null]), [false, null])
  ok('con la ricevuta non c\'è riga: conta la ricevuta', prova(() => s.righeSatispay([dalCorso('a', { ricevutaId: 'r2' })], nome)), [])
}

console.log('\n2. lo stato dei corsi: «pagato con Satispay» è del singolo corso')
{
  const listino = {
    quota: 50,
    saldoEntro: '2026-08-31',
    offerte: [],
    corsi: [
      { corso: 'Judo', corsoId: 'c1', eta: '', orari: [], prezzi: [{ annuale: 300, trimestre: 120 }] },
      { corso: 'Pilates', corsoId: 'c2', eta: '', orari: [], prezzi: [{ annuale: 250 }] },
    ],
  }
  const corsi = [{ id: 'c1', nome: 'Judo' }, { id: 'c2', nome: 'Pilates' }]
  const persona = (extra = {}) => ({
    id: 'p1', attiva: true, pagamento: { stato: 'da_pagare' }, quote: [], vociCorsi: [],
    iscrizioni: [{ corsoId: 'c1', dal: '2026-09-01' }, { corsoId: 'c2', dal: '2026-09-01' }], ...extra,
  })
  const come = (p) => prova(() => cd.statoCorsi(p, corsi, listino, OGGI_ISO)?.map((x) => [x.corso, x.come]))
  ok('senza Satispay, tutti e due da pagare', come(persona()), [['Judo', 'da_pagare'], ['Pilates', 'da_pagare']])
  ok('il Judo pagato con Satispay: solo il Judo risulta pagato', come(persona({ satispayCorsi: ['c1'] })), [['Judo', 'satispay'], ['Pilates', 'da_pagare']])
  ok('la quota pagata con Satispay non copre i corsi', come(persona({ satispay: 5000, satispayQuota: 5000 })), [['Judo', 'da_pagare'], ['Pilates', 'da_pagare']])
  ok('l\'iscrizione di prima (Satispay su tutto) copre tutti i corsi, com\'è sempre stato', come(persona({ satispay: 35000 })), [['Judo', 'satispay'], ['Pilates', 'satispay']])
}

console.log('\n3. quando si può pagare il corso')
{
  const tutto = { online: true, attivo: true, adulto: true, haAccessoProprio: true, comeTitolare: false, prezzi: { annuale: 30000, trimestre: 12000 }, segreteria: false }
  const puoi = (stato, o = {}) => prova(() => cs.puoiPagareIlCorso(stato, { ...tutto, ...o }))
  const veto = (r) => !!r && typeof r === 'object' && 'perche' in r && typeof r.perche === 'string'
  const dapagare = { corsoId: 'c1', corso: 'Judo', come: 'da_pagare' }
  const scaduto = { corsoId: 'c1', corso: 'Judo', come: 'scaduto', formula: 'trimestre', al: '2026-09-30' }
  ok('da pagare: sì, l\'annuale, con la cifra del database', puoi(dapagare), { formula: 'annuale', importo: 30000 })
  ok('…solo trimestre nel listino: il trimestre', puoi(dapagare, { prezzi: { trimestre: 12000 } }), { formula: 'trimestre', importo: 12000 })
  ok('scaduto: la formula di prima, così come costava', puoi(scaduto), { formula: 'trimestre', importo: 12000 })
  ok('…scaduto l\'annuale ma ora c\'è solo il trimestre: niente tasto, non si cambia formula da sé', veto(puoi({ ...scaduto, formula: 'annuale' }, { prezzi: { trimestre: 12000 } })), true)
  ok('pagata fuori app e finita: sì', puoi({ ...dapagare, come: 'fuori_scaduto' }), { formula: 'annuale', importo: 30000 })
  ok('senza importi dal database: niente tasto', veto(puoi(dapagare, { prezzi: {} })), true)
  ok('…nemmeno se mancano del tutto', veto(puoi(dapagare, { prezzi: undefined })), true)
  ok('con più righe di prezzo il prezzo lo fa la segreteria: niente tasto, dice cosa fare', [veto(puoi(dapagare, { segreteria: true })), puoi(dapagare, { segreteria: true }).perche?.includes('segreteria')], [true, true])
  ok('senza rete: serve la rete', puoi(dapagare, { online: false }), { perche: 'Serve la rete per pagare', motivo: 'rete' })
  ok('Satispay spento: niente tasto, e dice cosa fare', veto(puoi(dapagare, { attivo: false })), true)
  ok('minorenne, da sé: no', veto(puoi(dapagare, { adulto: false })), true)
  ok('minorenne senza accesso, dal titolare: sì', puoi(dapagare, { adulto: false, haAccessoProprio: false, comeTitolare: true }), { formula: 'annuale', importo: 30000 })
  ok('adulto senza accesso suo, dal titolare: sì', puoi(dapagare, { haAccessoProprio: false, comeTitolare: true }), { formula: 'annuale', importo: 30000 })
  ok('familiare con accesso proprio, dal titolare: niente tasto', veto(puoi(dapagare, { comeTitolare: true })), true)
  const gia = puoi(dapagare, { giaPagato: true })
  ok('già arrivato, ricevuta non ancora fatta: niente tasto, motivo «pagato»', [veto(gia), gia.motivo], [true, 'pagato'])
  for (const come of ['pagato', 'fuori_app', 'satispay', 'in_parte', 'da_controllare'])
    ok(`${come}: niente tasto`, veto(puoi({ ...dapagare, come })), true)
  ok('il perché ha un codice: pagato, rete, nessuno per gli altri', [puoi(dapagare, { giaPagato: true }).motivo, puoi(dapagare, { online: false }).motivo, puoi(dapagare, { adulto: false }).motivo], ['pagato', 'rete', undefined])
}

console.log('\n4. i testi dopo il pagamento e il ritorno da Satispay')
{
  const esito = (p) => prova(() => cs.esitoCorso(p))
  const testi = (e) => (e && Array.isArray(e.testi) ? e.testi.join(' ') : '')
  const base = { importo: 30000, chi: 'Anna Rossi', corso: 'Judo', formula: 'annuale' }
  const att = esito({ ...base, stato: 'attesa' })
  ok('in attesa: il titolo', att.titolo, 'IN ATTESA DI SATISPAY')
  ok('…dice chi, il corso, quanto e di non pagare di nuovo', [testi(att).includes('Anna Rossi'), testi(att).includes('Judo'), testi(att).includes(s.soldi(30000)), testi(att).includes('Non pagare di nuovo')], [true, true, true, true])
  ok('…tono d\'avviso', att.tono, 'avviso')
  const pag = esito({ ...base, stato: 'pagato', pagatoIl: '2026-10-20T08:05:00Z' })
  ok('pagato: il titolo con la cifra', pag.titolo, `PAGATO · ${s.soldi(30000)}`)
  ok('…il testo, con chi, il corso e la ricevuta', testi(pag), `Hai pagato ${s.soldi(30000)} con Satispay il corso Judo per Anna Rossi. La segreteria prepara la ricevuta: la trovi in DOCUMENTI, sotto RICEVUTE, appena è pronta.`)
  ok('…tono fatto', pag.tono, 'fatto')
  const no = esito({ ...base, stato: 'non-andato' })
  ok('non andato: il titolo', no.titolo, 'NON È ANDATO')
  ok('…dice che non sono stati presi soldi', testi(no).includes('non ti abbiamo preso soldi'), true)
  ok('ritornoDelCorso legge corso e persona dall\'indirizzo', prova(() => cs.ritornoDelCorso('?corso=c1&persona=p1')), { corso: 'c1', persona: 'p1' })
  ok('…senza la persona o il corso no', prova(() => [cs.ritornoDelCorso('?corso=c1'), cs.ritornoDelCorso('?persona=p1')]), [null, null])
  ok('…la quota e il saldo non sono un corso', prova(() => [cs.ritornoDelCorso('?quota=1&persona=p1'), cs.ritornoDelCorso('?saldo=r1&persona=p1')]), [null, null])
}

console.log('\n5. la modalità prova: pagaCorsoProva')
{
  const i = pr.iscrittoLib ?? {}
  const d = pr.archivio?.dati
  const iscritti = (d?.persone ?? []).filter((p) => p.ruolo === 'iscritto' && p.attiva)
  const [anna, luca] = iscritti
  const corsoA = d?.corsi?.[0]
  const corsoB = d?.corsi?.[1]
  const listino = (corsi) => ({ quota: 50, saldoEntro: '2026-08-31', offerte: [], corsi })
  const voce = (corso, prezzi) => ({ corso: corso?.nome, corsoId: corso?.id, eta: '', orari: [], prezzi })
  const listinoSemplice = () =>
    listino([voce(corsoA, [{ annuale: 300, trimestre: 120 }]), voce(corsoB, [{ annuale: 200 }, { etichetta: '2 giorni', annuale: 350 }])])
  const dei = () => (pr.pagamentiSatispayProva?.() ?? []).filter((p) => p.voce === 'corso')
  const ricevutaDel = (corso, persona, pagato, al = '2027-08-31', formula = 'Annuale') => ({
    id: `r-${corso?.id}-${persona?.id}`, anno: 2026, numero: 900, data: OGGI_ISO, personaId: persona?.id, ente: { nome: 'ODS' },
    intestatario: { nome: persona?.nome ?? '', cognome: persona?.cognome ?? '' },
    voci: [{ descrizione: `${formula} ${corso?.nome}`, quantita: 1, prezzo: 30000, dal: '2026-09-01', al, pagamenti: pagato ? [{ data: OGGI_ISO, importo: pagato, metodo: 'Contanti' }] : [] }],
    anticipo: 0, totale: 30000, pagato, creataIl: '2026-10-20T08:00:00Z',
  })
  // Annalisa e Luca partono iscritti a tutti e due i corsi, da pagare e senza ricevute: ogni caso cambia solo quel che gli serve.
  const riparti = (ric = [], pagamento = { stato: 'da_pagare' }) => {
    if (!d || !anna || !luca || !corsoA || !corsoB) return
    d.ricevute = (d.ricevute ?? []).filter((r) => r.personaId !== anna.id && r.personaId !== luca.id).concat(ric)
    d.iscrizioni = d.iscrizioni.filter((x) => x.personaId !== anna.id && x.personaId !== luca.id)
    for (const p of [anna, luca]) for (const c of [corsoA, corsoB]) d.iscrizioni.push({ corsoId: c.id, personaId: p.id, dal: '2026-09-01' })
    anna.pagamento = pagamento
    luca.pagamento = { stato: 'da_pagare' }
    pr.salvaSatispay?.([])
    li.salvaListinoProva?.(listinoSemplice())
  }
  const tocca = (p, c, f) => aspetta(() => i.pagaCorsoProva(p?.id, c?.id, f))
  const nessunaScrittura = async (cosa, testo, c = corsoA, f = 'annuale') => {
    const prima = (pr.pagamentiSatispayProva?.() ?? []).length
    const v = await tocca(anna, c, f)
    ok(cosa, conTesto(v, testo), true)
    ok('…e non ha scritto niente', (pr.pagamentiSatispayProva?.() ?? []).length, prima)
  }

  // I rifiuti, con gli stessi testi del database.
  riparti()
  await nessunaScrittura('una persona non iscritta al corso non lo paga', T_NON_ISCRITTO, { id: 'non-esiste' })
  await nessunaScrittura('senza scegliere la formula non si paga', T_FORMULA, corsoA, null)
  await nessunaScrittura('…né con una formula che non c\'è', T_FORMULA, corsoA, 'mensile')
  li.salvaListinoProva?.(listino([voce(corsoA, [{ annuale: 300, trimestre: 120 }]), voce(corsoB, [{ annuale: 200 }])]))
  await nessunaScrittura('…né una formula senza prezzo (qui il Pilates ha solo l\'annuale)', T_NON_IN_LISTINO, corsoB, 'trimestre')
  li.salvaListinoProva?.(listinoSemplice())
  await nessunaScrittura('con più righe di prezzo il prezzo lo fa la segreteria', T_SEGRETERIA, corsoB, 'annuale')
  // Un listino vuoto non vale (torna quello di fabbrica): il corso manca perché il listino ne ha un altro.
  li.salvaListinoProva?.(listino([voce({ id: 'altro', nome: 'Karate' }, [{ annuale: 100 }])]))
  await nessunaScrittura('un corso fuori listino non si paga', T_NON_IN_LISTINO)
  riparti([ricevutaDel(corsoA, anna, 30000)])
  await nessunaScrittura('un corso con la ricevuta valida, pagata tutta, non si paga', T_RICEVUTA)
  riparti([ricevutaDel(corsoA, anna, 10000)])
  await nessunaScrittura('…né pagata in parte: per il resto chiede alla segreteria', T_RICEVUTA)
  riparti([], { stato: 'pagato', fino: '2027-01-01' })
  await nessunaScrittura('pagato fuori app, oggi valido: no', T_FUORI_APP)
  riparti()
  pr.salvaSatispay?.([dalCorso('s1', { personaId: anna?.id, corsoId: corsoA?.id })])
  await nessunaScrittura('lo stesso corso già arrivato con Satispay e non in ricevuta: no', T_SATISPAY)
  ok('una persona che non c\'è non si paga', rifiutata(await aspetta(() => i.pagaCorsoProva('non-esiste', corsoA?.id, 'annuale'))), true)

  // Ricevuta finita, annullata, quota o saldo: non bloccano il corso.
  riparti([ricevutaDel(corsoA, anna, 30000, '2026-08-31'), { ...ricevutaDel(corsoA, anna, 30000), id: 'annullata', annullataIl: '2026-10-20T09:00:00Z' }])
  pr.salvaSatispay?.([dellaQuota('q1', { personaId: anna?.id }), { ...dellaQuota('q2', { personaId: anna?.id }), voce: undefined, saldoDi: 'r-x' }])
  const primo = await tocca(anna, corsoA, 'annuale')
  ok('con una ricevuta finita, una annullata, una quota e un saldo già arrivati: il corso si paga', inCoda(primo), false)
  const nuovi = dei()
  ok('…un solo pagamento del corso', nuovi.length, 1)
  ok('…pagato, di quella persona, per l\'annuale del listino (300 €), non una quota né un saldo', [nuovi[0]?.stato, nuovi[0]?.personaId, nuovi[0]?.importo, nuovi[0]?.formula, nuovi[0]?.saldoDi ?? null], ['pagato', anna?.id, 30000, 'annuale', null])
  ok('…col corso, il chi e il quando', [nuovi[0]?.corsoId, nuovi[0]?.corso, nuovi[0]?.chi, !!nuovi[0]?.pagatoIl], [corsoA?.id, corsoA?.nome, `${anna?.cognome} ${anna?.nome}`, true])
  ok('…e solo quel corso risulta pagato con Satispay', [...(s.satispayCorsiPerPersona?.(pr.pagamentiSatispayProva?.() ?? []) ?? [])].filter(([p]) => p === anna?.id).map(([, c]) => c), [[corsoA?.id]])
  ok('…e la quota non cambia (non è la quota né l\'iscrizione di prima)', [...(s.satispayPerPersona?.(pr.pagamentiSatispayProva?.() ?? []) ?? [])].filter(([p]) => p === anna?.id).map(([, v]) => v), [5000])
  ok('un secondo tocco è rifiutato (non resta niente da pagare), e non scrive', [conTesto(await tocca(anna, corsoA, 'annuale'), T_SATISPAY), dei().length], [true, 1])

  // Il trimestre, il listino che cambia: l'importo cambia con lui, mai dal telefono.
  riparti()
  await tocca(anna, corsoA, 'trimestre')
  ok('il trimestre del listino (120 €)', dei().map((p) => [p.formula, p.importo]), [['trimestre', 12000]])
  riparti()
  li.salvaListinoProva?.(listino([voce(corsoA, [{ annuale: 275.5 }])]))
  await tocca(anna, corsoA, 'annuale')
  ok('con l\'annuale del listino a 275,50 €, si paga 275,50 €', dei().map((p) => p.importo), [27550])
  riparti()
  li.salvaListinoProva?.(listino([voce(corsoA, [{ annuale: 300, saldo: 250 }])]))
  await tocca(anna, corsoA, 'annuale')
  ok('finito il saldo (oltre «saldoEntro») il prezzo è l\'annuale, non il saldo', dei().map((p) => p.importo), [30000])

  // Dall'oggetto che usa l'app.
  riparti()
  const dati = i.creaIscrittoProva?.()
  const dal = await aspetta(() => dati.pagaCorso(luca?.id, corsoA?.id, 'annuale'))
  ok('pagaCorso di chi usa l\'app: nessun errore e nessun link (in prova non c\'è Satispay)', dal, null)
  ok('…scrive il pagamento di Luca, pagato', dei().filter((p) => p.personaId === luca?.id).map((p) => [p.stato, p.importo, p.corsoId]), [['pagato', 30000, corsoA?.id]])
  const stato = await aspetta(() => dati.statoCorso(luca?.id, corsoA?.id))
  ok('statoCorso: pagato, la cifra, il quando e il chi', [stato?.stato, stato?.importo, !!stato?.pagatoIl, typeof stato?.chi], ['pagato', 30000, true, 'string'])
  ok('…di un altro corso, o di chi non ha pagato niente: null', [await aspetta(() => dati.statoCorso(luca?.id, corsoB?.id)), await aspetta(() => dati.statoCorso(anna?.id, corsoA?.id))], [null, null])
  const chi = await aspetta(() => dati.chiPagaCorsi(luca?.id, luca?.id))
  ok('chiPagaCorsi: i prezzi per corso e quali sono della segreteria', [chi?.adulto, (chi?.corsi ?? []).map((c) => [c.corsoId, c.annuale ?? null, c.trimestre ?? null, !!c.segreteria])], [true, [[corsoA?.id, null, null, false], [corsoB?.id, null, null, true]]])
  ok('…chi non ha pagato niente vede i prezzi del corso semplice, e nessuno per quello della segreteria', (await aspetta(() => dati.chiPagaCorsi(anna?.id, luca?.id)))?.corsi?.map((c) => [c.corsoId, c.annuale ?? null, c.trimestre ?? null, !!c.segreteria]), [[corsoA?.id, 30000, 12000, false], [corsoB?.id, null, null, true]])

  // La scheda: il corso pagato con Satispay non contraddice il resto.
  const sch = await aspetta(() => dati.scheda(luca?.id))
  ok('la scheda di Luca: i corsi pagati con Satispay, e la quota resta da pagare', [sch?.satispayCorsi, g.pagamentoDi?.(sch, OGGI_ISO)?.come], [[corsoA?.id], 'da_pagare'])

  // Chi ha pagato la quota con Satispay ha ancora il corso da pagare (la quota non lo copre), anche visto dall'area iscritti.
  pr.salvaSatispay?.([dellaQuota('q9', { personaId: anna?.id })])
  const schAnna = await aspetta(() => dati.scheda(anna?.id))
  const chiAnna = await aspetta(() => dati.chiPagaCorsi(anna?.id, anna?.id))
  ok('dopo la quota con Satispay il corso risulta ancora da pagare', cs.statoCorsiDi(schAnna, [], chiAnna, OGGI_ISO).filter((x) => x.corsoId === corsoA?.id).map((x) => x.come), ['da_pagare'])
  li.scordaListinoProva?.()
}

console.log(guai ? `\n${guai} da sistemare` : '\nTutto a posto')
process.exit(guai ? 1 : 0)
