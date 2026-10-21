// ---------------------------------------------------------------------------
// Il compenso pagato finisce in CONTABILITÀ, senza browser.
//
//   node scripts/prova-compensi-pagati.mjs
//
// Chi è segreteria e amministrazione insieme paga una o più ricevute dello
// stesso tecnico con UN movimento d'uscita, voce di sistema «Compensi
// istruttori», dalla Cassa Contanti o dal Conto Corrente
// (`supabase/81-compensi-pagati.sql`, provato da
// `supabase/prova/compensi-pagati.sql`, con gli stessi casi). La ricevuta
// pagata si vede (`pagata`), non si annulla, e torna da pagare quando il suo
// movimento si annulla in CONTABILITÀ. Il preso nell'anno conta per data di
// pagamento. Le regole stanno in `src/lib/compensi.ts`; qui anche la
// segreteria di prova e le chiamate al database.
// ---------------------------------------------------------------------------
import { build } from 'esbuild'

// Il giorno è quello di Roma, anche su una macchina in UTC.
process.env.TZ = 'Europe/Rome'

const importa = async (contents) => {
  const { outputFiles } = await build({
    stdin: { contents, resolveDir: '.', loader: 'ts' },
    bundle: true,
    format: 'esm',
    platform: 'browser',
    write: false,
    logLevel: 'silent',
    // Senza Vite `import.meta.env` non c'è: vuoto vuol dire «modalità prova».
    define: { 'import.meta.env': '{}' },
  })
  return import('data:text/javascript;base64,' + Buffer.from(outputFiles[0].text).toString('base64'))
}

const memoria = new Map()
globalThis.localStorage = {
  getItem: (k) => (memoria.has(k) ? memoria.get(k) : null),
  setItem: (k, v) => memoria.set(k, String(v)),
  removeItem: (k) => memoria.delete(k),
}
globalThis.window = { location: { search: '', hash: '' }, addEventListener() {} }

let guai = 0
const ok = (cosa, avuto, voluto) => {
  const va = JSON.stringify(avuto) === JSON.stringify(voluto)
  console.log(va ? '  ✓' : '  ✗', cosa, va ? '' : `— atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`)
  if (!va) guai++
}
// Una funzione che non c'è, o che si rompe, è un caso rosso, non la prova ferma.
const prova = async (cosa, f, voluto) => {
  let avuto
  try {
    avuto = await f()
  } catch (e) {
    avuto = `ERRORE: ${e.message}`
  }
  ok(cosa, avuto, voluto)
}
const errore = async (f) => {
  try {
    await f()
    return 'nessun errore'
  } catch (e) {
    return e.message
  }
}
// Un rifiuto della regola, non la funzione che manca.
const rifiuta = async (f) => {
  try {
    await f()
    return 'accettato'
  } catch (e) {
    return e instanceof TypeError ? `ERRORE: ${e.message}` : 'rifiutato'
  }
}
// Il campo che manca non è `null`: JSON lo scriverebbe uguale.
const campo = (v) => (v === undefined ? 'manca' : v)
const sicuro = (f) => {
  try {
    return f()
  } catch (e) {
    return `ERRORE: ${e.message}`
  }
}

const c = await importa("export * from './src/lib/compensi'")
const m = await importa(
  "export { creaSegreteriaProva } from './src/lib/segreteriaProva'; export { creaSegreteriaSupabase } from './src/lib/segreteriaSupabase'; export { archivio } from './src/lib/archivioProva'",
)

// `quanti` giorni fa (0 oggi, -1 domani), `AAAA-MM-GG`.
const giorno = (quanti = 0) => {
  const d = new Date()
  d.setDate(d.getDate() - quanti)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

console.log('\n1. lo stato: pagata')
{
  const conto = { righe: [], lezioni: 4, minuti: 270, calcolato: 6450, daConfermare: 0, senzaTariffa: [] }
  const fatta = { calcolato: 6450, annullataIl: null, movimentoId: null, pagataIl: null }
  const pagata = { ...fatta, movimentoId: 'mv1', pagataIl: '2026-11-05' }
  ok('fatta e da pagare: fatta', sicuro(() => c.statoCompenso({ conto, ricevuta: fatta })), 'fatta')
  ok('fatta e pagata: pagata', sicuro(() => c.statoCompenso({ conto, ricevuta: pagata })), 'pagata')
  ok('pagata anche se il conto adesso non torna', sicuro(() => c.statoCompenso({ conto: { ...conto, calcolato: 7450 }, ricevuta: pagata })), 'pagata')
  ok('da pagare col conto che non torna: non torna, come prima', sicuro(() => c.statoCompenso({ conto: { ...conto, calcolato: 7450 }, ricevuta: fatta })), 'non-torna')
  ok('una annullata è come non averla, anche col giorno del pagamento', sicuro(() => c.statoCompenso({ conto, ricevuta: { ...pagata, annullataIl: '2026-11-06T10:00:00Z' } })), 'da-fare')
  await prova('nella pagina COMPENSI la riga dice pagata',
    () => c.righeCompensi({
      tecnici: [{ id: 'A', nome: 'Anna', cognome: 'Gialli' }],
      presenze: [],
      senzaIstruttore: [],
      mese: { da: new Date(2026, 9, 1), a: new Date(2026, 9, 31) },
      tariffe: {},
      ricevute: [{ id: 'r1', personaId: 'A', mese: '2026-10-01', calcolato: 6450, importo: 6450, annullataIl: null, movimentoId: 'mv1', pagataIl: '2026-11-05' }],
    }).map((r) => [r.persona.id, r.stato]),
    [['A', 'pagata']])
}

console.log('\n2. la descrizione del movimento')
{
  const d = (...x) => sicuro(() => c.descrizionePagamento(...x))
  ok('un mese', d('Anna', 'Gialli', ['2026-10-01']), 'Compenso · Anna Gialli · ott 2026')
  ok('più mesi dello stesso anno, in ordine', d('Anna', 'Gialli', ['2026-10-01', '2026-09-01']), 'Compenso · Anna Gialli · set, ott 2026')
  ok('anni diversi: ogni anno coi suoi mesi', d('Anna', 'Gialli', ['2027-01-01', '2026-12-01']), 'Compenso · Anna Gialli · dic 2026, gen 2027')
  ok('i dodici mesi brevi',
    d('Anna', 'Gialli', Array.from({ length: 12 }, (_, i) => `2026-${String(12 - i).padStart(2, '0')}-01`)),
    'Compenso · Anna Gialli · gen, feb, mar, apr, mag, giu, lug, ago, set, ott, nov, dic 2026')
}

const ric = (id, personaId, mese, importo, extra = {}) => ({ id, personaId, mese, importo, calcolato: importo, annullataIl: null, movimentoId: null, pagataIl: null, creataIl: `${mese}T10:00:00Z`, ...extra })

console.log('\n3. il preso nell\'anno, per data di pagamento')
{
  const ricevute = [
    ric('r1', 'A', '2026-09-01', 10000, { movimentoId: 'mv1', pagataIl: '2026-10-05' }),
    ric('r2', 'A', '2026-10-01', 15000, { movimentoId: 'mv1', pagataIl: '2026-10-05' }),
    // Di dicembre, pagata a gennaio: conta l'anno dopo.
    ric('r3', 'A', '2026-12-01', 12000, { movimentoId: 'mv2', pagataIl: '2027-01-10' }),
    // Fatta e da pagare: non è presa.
    ric('r4', 'A', '2026-11-01', 9000),
    // Annullata: non conta, anche col giorno del pagamento.
    ric('r5', 'A', '2026-08-01', 7000, { annullataIl: '2026-09-02T10:00:00Z', pagataIl: '2026-09-01' }),
  ]
  ok('il 2026: settembre e ottobre', sicuro(() => c.presoNellAnno(ricevute, 2026)), 25000)
  ok('il 2027: il dicembre pagato a gennaio', sicuro(() => c.presoNellAnno(ricevute, 2027)), 12000)
  ok('un anno senza pagamenti: zero', sicuro(() => c.presoNellAnno(ricevute, 2025)), 0)
  ok('senza ricevute: zero', sicuro(() => c.presoNellAnno([], 2026)), 0)
}

console.log('\n4. le ricevute da pagare di un tecnico')
{
  const ricevute = [
    ric('r1', 'A', '2026-10-01', 15000),
    ric('r2', 'A', '2026-08-01', 10000),
    ric('r3', 'A', '2026-09-01', 12000, { movimentoId: 'mv1', pagataIl: '2026-10-05' }),
    ric('r4', 'A', '2026-07-01', 9000, { annullataIl: '2026-08-02T10:00:00Z' }),
    ric('r5', 'B', '2026-06-01', 8000),
    ric('r6', 'A', '2026-09-01', 11000),
  ]
  ok('fatte, non annullate, non pagate, sue, dalla più vecchia', sicuro(() => c.pagabili(ricevute, 'A').map((r) => r.id)), ['r2', 'r6', 'r1'])
  ok('di un altro solo le sue', sicuro(() => c.pagabili(ricevute, 'B').map((r) => r.id)), ['r5'])
  ok('chi non ne ha: nessuna', sicuro(() => c.pagabili(ricevute, 'Z')), [])
}

console.log('\n5. la segreteria di prova paga, rifiuta, e annullato il movimento tornano da pagare')
{
  const s = m.creaSegreteriaProva()
  const vociDi = async () => (await s.voci()).filter((v) => v.nome === 'Compensi istruttori').map((v) => [v.tipo, v.diSistema, v.attiva])
  await prova('la voce «Compensi istruttori» c\'è fra quelle di partenza: una, d\'uscita, di sistema', vociDi, [['uscita', true, true]])
  const casse = await s.casse()
  const contanti = casse.find((x) => x.nome === 'Cassa Contanti')?.id
  const conto = casse.find((x) => x.nome === 'Conto Corrente')?.id
  const voce = (await s.voci()).find((v) => v.nome === 'Compensi istruttori')?.id
  // Il Conto Corrente parte da 30 giorni fa; la Cassa Contanti è chiusa fino a 5 giorni fa.
  await s.salvaSaldoCassa(conto, 0, giorno(30))
  await s.salvaSaldoCassa(contanti, 0, giorno(60))
  await s.chiudiCassa({ cassaId: contanti, data: giorno(5), contato: 0 })

  const anna = await s.salvaPersonale({ nome: 'Anna', cognome: 'Gialli', ruolo: 'istruttore' })
  const bruno = await s.salvaPersonale({ nome: 'Bruno', cognome: 'Neri', ruolo: 'istruttore' })
  const BASE = {
    righe: [{ corso: 'Judo kids', lezioni: 6, minuti: 720, centesimiOra: 1500, importo: 18000 }],
    calcolato: 18000, importo: 18000, motivo: null, qualifica: 'Allenatore', data: giorno(0),
    tecnico: { nome: 'Anna', cognome: 'Gialli', codiceFiscale: 'GLLNNA80A41L219X', iban: 'IT60X0542811101000000123456' },
  }
  const fai = (personaId, mese, extra = {}) => s.faiRicevutaCompenso({ ...BASE, personaId, mese, ...extra })
  const set = await fai(anna, '2025-09-01')
  const ott = await fai(anna, '2025-10-01', { importo: 20000, motivo: 'Una lezione in più non segnata' })
  const nov = await fai(anna, '2025-11-01')
  await s.annullaRicevutaCompenso(nov.id)
  const dic = await fai(anna, '2025-12-01')
  const gen = await fai(anna, '2026-01-01')
  const feb = await fai(anna, '2026-02-01')
  const bOtt = await fai(bruno, '2025-10-01')
  const bNov = await fai(bruno, '2025-11-01')
  ok('una ricevuta fatta adesso è da pagare', [campo(set.movimentoId), campo(set.pagataIl)], [null, null])

  const deiCompensi = async () => (await s.movimenti()).filter((x) => x.voceId === voce)
  const sue = async (id) => (await s.ricevuteCompensi()).find((x) => x.id === id)
  await prova('paga ottobre e settembre di Anna col bonifico', () => s.pagaCompensi([ott.id, set.id], giorno(3), conto), undefined)
  const [pag] = await deiCompensi()
  ok('un movimento solo', (await deiCompensi()).length, 1)
  ok('un\'uscita «Compensi istruttori» dal Conto Corrente, il giorno scelto', pag && [pag.tipo, pag.voceId === voce, pag.cassaId === conto, pag.data], ['uscita', true, true, giorno(3)])
  ok('l\'importo è la somma delle due ricevute (200 + 180 €)', pag?.importo, 38000)
  ok('la persona è il tecnico', pag?.personaId, anna)
  ok('la descrizione, coi mesi in ordine', pag?.descrizione, 'Compenso · Anna Gialli · set, ott 2025')
  ok('mai codice fiscale né IBAN', /GLLNNA80A41L219X|IT60X/.test(`${pag?.descrizione} ${pag?.nota ?? ''}`), false)
  ok('non annullato', pag?.annullatoIl ?? null, null)
  await prova('le due ricevute col movimento e il giorno del pagamento', async () => [await sue(set.id), await sue(ott.id)].map((x) => [!!pag && x.movimentoId === pag.id, campo(x.pagataIl)]), [[true, giorno(3)], [true, giorno(3)]])
  await prova('e sono pagate per la pagina COMPENSI', async () => c.pagabili(await s.ricevuteCompensi(), anna).map((x) => x.mese), ['2025-12-01', '2026-01-01', '2026-02-01'])
  await prova('un mese solo, in contanti', () => s.pagaCompensi([bOtt.id], giorno(1), contanti), undefined)
  await prova('anche oggi, dicembre e gennaio', () => s.pagaCompensi([gen.id, dic.id], giorno(0), conto), undefined)
  await prova('in contanti: la Cassa Contanti, la descrizione col mese solo',
    async () => (await deiCompensi()).filter((x) => x.personaId === bruno).map((x) => [x.cassaId === contanti, x.importo, x.descrizione]),
    [[true, 18000, 'Compenso · Bruno Neri · ott 2025']])
  await prova('dicembre e gennaio: ogni anno coi suoi mesi',
    async () => (await deiCompensi()).filter((x) => x.data === giorno(0)).map((x) => [x.importo, x.descrizione]),
    [[36000, 'Compenso · Anna Gialli · dic 2025, gen 2026']])

  console.log('   cosa non si paga: e allora niente')
  ok('nessuna ricevuta no', await rifiuta(() => s.pagaCompensi([], giorno(0), conto)), 'rifiutato')
  ok('due tecnici insieme no', await rifiuta(() => s.pagaCompensi([feb.id, bNov.id], giorno(0), conto)), 'rifiutato')
  ok('con una annullata no', await rifiuta(() => s.pagaCompensi([feb.id, nov.id], giorno(0), conto)), 'rifiutato')
  ok('una già pagata no', await rifiuta(() => s.pagaCompensi([set.id], giorno(0), conto)), 'rifiutato')
  ok('una già pagata con una da pagare no', await rifiuta(() => s.pagaCompensi([feb.id, set.id], giorno(0), conto)), 'rifiutato')
  ok('una ricevuta che non c\'è no', await rifiuta(() => s.pagaCompensi(['non-ce'], giorno(0), conto)), 'rifiutato')
  ok('domani no', await rifiuta(() => s.pagaCompensi([feb.id], giorno(-1), conto)), 'rifiutato')
  ok('prima dell\'inizio della cassa no', await rifiuta(() => s.pagaCompensi([feb.id], giorno(31), conto)), 'rifiutato')
  ok('in un giorno chiuso no', await rifiuta(() => s.pagaCompensi([feb.id], giorno(6), contanti)), 'rifiutato')
  ok('una cassa che non c\'è no', await rifiuta(() => s.pagaCompensi([feb.id], giorno(0), 'non-ce')), 'rifiutato')
  ok('nessun movimento in più', (await deiCompensi()).length, 3)
  await prova('e febbraio e il novembre di Bruno ancora da pagare', async () => [await sue(feb.id), await sue(bNov.id)].map((x) => [campo(x.movimentoId), campo(x.pagataIl)]), [[null, null], [null, null]])
  // Accettato o no, la stessa ricevuta due volte non si paga due volte.
  await s.pagaCompensi?.([bNov.id, bNov.id], giorno(0), conto).catch(() => {})
  ok('la stessa ricevuta due volte non conta doppio', (await deiCompensi()).some((x) => x.importo === 36000 && x.personaId === bruno), false)

  console.log('   una pagata non si annulla')
  ok('annullare settembre, pagato: no, col messaggio', await errore(() => s.annullaRicevutaCompenso(set.id)), 'È pagata: prima annulla il pagamento in CONTABILITÀ → MOVIMENTI')
  await prova('e resta valida e pagata', async () => { const x = await sue(set.id); return [x.annullataIl, !!pag && x.movimentoId === pag.id] }, [null, true])

  console.log('   annullato il movimento in CONTABILITÀ, tornano da pagare')
  await prova('si annulla il pagamento', () => s.annullaMovimento(pag?.id), undefined)
  await prova('settembre e ottobre tornano da pagare', async () => [await sue(set.id), await sue(ott.id)].map((x) => [campo(x.movimentoId), campo(x.pagataIl)]), [[null, null], [null, null]])
  await prova('le altre pagate restano pagate', async () => [await sue(bOtt.id), await sue(dic.id), await sue(gen.id)].every((x) => x.movimentoId && x.pagataIl), true)
  await prova('e settembre si ripaga, da solo', () => s.pagaCompensi([set.id], giorno(2), conto), undefined)
  await prova('il pagamento nuovo, col mese solo', async () => (await deiCompensi()).filter((x) => !x.annullatoIl && x.data === giorno(2)).map((x) => [x.importo, x.descrizione]), [[18000, 'Compenso · Anna Gialli · set 2025']])
  await prova('ottobre, da pagare, si annulla', async () => { await s.annullaRicevutaCompenso(ott.id); return typeof (await sue(ott.id)).annullataIl }, 'string')

  // Un archivio di prima, con le voci salvate senza «Compensi istruttori»: la voce c'è lo stesso.
  m.archivio.dati.voci = (await s.voci()).filter((v) => v.nome !== 'Compensi istruttori')
  await prova('anche in un archivio fatto prima, la voce c\'è', vociDi, [['uscita', true, true]])
}

console.log('\n6. col database vero: paga_compensi, e le colonne nuove')
{
  const chiesto = []
  const catena = (tabella, risposta) => {
    const x = new Proxy(() => x, {
      get: (_, k) => (k === 'then' ? (fatto, ko) => Promise.resolve(risposta).then(fatto, ko) : (...a) => (chiesto.push([tabella, k, ...a]), x)),
      apply: () => x,
    })
    return x
  }
  const riga = {
    id: 'r2', persona_id: 'p1', mese: '2026-10-01', righe: [{ corso: 'Judo kids', lezioni: 6, minuti: 720, centesimi_ora: 1500, importo: 18000 }], calcolato: 18000, importo: 18000,
    motivo: null, tecnico: { nome: 'Anna' }, qualifica: 'Allenatore', data: '2026-10-21', firmata: false, annullata_il: null, creata_il: '2026-10-21T10:00:00Z', creata_da: 'a1',
  }
  const pagata = { ...riga, id: 'r3', movimento_id: 'mv1', pagata_il: '2026-11-05' }
  const daPagare = { ...riga, movimento_id: null, pagata_il: null }
  // Senza 81-compensi-pagati.sql le colonne non ci sono: `riga` così com'è.
  const db = m.creaSegreteriaSupabase({
    auth: { getSession: async () => ({ data: { session: null } }) },
    from: (tabella) => catena(tabella, tabella === 'ricevute_compensi' ? { data: [pagata, daPagare, riga], error: null } : { data: null, error: null }),
    rpc: (f, args) => (chiesto.push([f, 'rpc', args]), catena(f, { data: f === 'paga_compensi' ? { id: 'mv9' } : null, error: null })),
  })
  chiesto.length = 0
  await prova('paga con paga_compensi, e non rende niente', () => db.pagaCompensi(['r1', 'r2'], '2026-11-05', 'c2'), undefined)
  ok('la funzione giusta, coi nomi giusti degli argomenti', chiesto.filter(([, k]) => k === 'rpc').map(([f, , a]) => [f, a]),
    [['paga_compensi', { ricevute: ['r1', 'r2'], data: '2026-11-05', cassa: 'c2' }]])
  await prova('le ricevute col movimento e il giorno del pagamento', async () => (await db.ricevuteCompensi('p1')).map((x) => [x.id, campo(x.movimentoId), campo(x.pagataIl)]),
    [['r3', 'mv1', '2026-11-05'], ['r2', null, null], ['r2', null, null]])

  const rispondeErrore = (errore) => m.creaSegreteriaSupabase({
    auth: { getSession: async () => ({ data: { session: null } }) },
    from: () => catena('x', { data: null, error: null }),
    rpc: (f) => catena(f, { data: null, error: errore }),
  })
  ok('annullare una pagata: il messaggio del database, così com\'è',
    await errore(() => rispondeErrore({ code: 'P0001', message: 'È pagata: prima annulla il pagamento in CONTABILITÀ → MOVIMENTI' }).annullaRicevutaCompenso('r3')),
    'È pagata: prima annulla il pagamento in CONTABILITÀ → MOVIMENTI')
  ok('senza amministrazione: non hai il permesso',
    await errore(() => rispondeErrore({ code: '42501', message: 'la contabilità la cura l’amministrazione' }).pagaCompensi(['r1'], '2026-11-05', 'c2')),
    'Non hai il permesso: la contabilità la cura l’amministrazione')
}

console.log('\n7. senza 81-compensi-pagati.sql: dice cosa lanciare')
{
  const risponde = (r) => {
    const x = new Proxy(() => x, { get: (_, k) => (k === 'then' ? (f, ko) => Promise.resolve(r).then(f, ko) : () => x), apply: () => x })
    return x
  }
  const senza = (errore) => m.creaSegreteriaSupabase({
    auth: { getSession: async () => ({ data: { session: null } }) },
    from: () => risponde({ data: null, error: null }),
    rpc: () => risponde({ data: null, error: errore }),
  })
  const lancia = (msg) => (msg.includes('va lanciato 81-compensi-pagati.sql') ? 'dice di lanciare 81-compensi-pagati.sql' : msg)
  ok('pagare, quando PostgREST non trova la funzione',
    lancia(await errore(() => senza({ code: 'PGRST202', message: 'Could not find the function public.paga_compensi(cassa, data, ricevute) in the schema cache' }).pagaCompensi(['r1'], '2026-11-05', 'c2'))),
    'dice di lanciare 81-compensi-pagati.sql')
  ok('pagare, quando Postgres non trova la funzione',
    lancia(await errore(() => senza({ code: '42883', message: 'function paga_compensi(uuid[], date, uuid) does not exist' }).pagaCompensi(['r1'], '2026-11-05', 'c2'))),
    'dice di lanciare 81-compensi-pagati.sql')
}

console.log(guai ? `\n${guai} COSE NON TORNANO` : '\nTUTTO A POSTO')
process.exit(guai ? 1 : 0)
