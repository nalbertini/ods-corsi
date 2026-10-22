// ---------------------------------------------------------------------------
// La ricevuta di compenso EXTRA (uno stage, per esempio), senza browser.
//
//   node scripts/prova-compensi-extra.mjs
//
// Un compenso fuori dal conto delle lezioni, con la sua ricevuta separata da
// quella del mese (`supabase/96-compensi-extra.sql`, provato da
// `supabase/prova/compensi-extra.sql`, con gli stessi casi e gli stessi
// messaggi). Ha la descrizione (`extra`), nessuna riga corso, nessun calcolato;
// non è mai «la ricevuta del mese»: non la fa tornare né non tornare, non entra
// in «Prepara e stampa», si paga insieme a quelle del mese. Le regole stanno in
// `src/lib/compensi.ts`; qui anche la segreteria di prova e le chiamate al
// database.
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
const sicuro = (f) => {
  try {
    return f()
  } catch (e) {
    return `ERRORE: ${e.message}`
  }
}

const c = await importa("export * from './src/lib/compensi'")
const m = await importa(
  "export { creaSegreteriaProva } from './src/lib/segreteriaProva'; export { creaSegreteriaSupabase } from './src/lib/segreteriaSupabase'",
)

// `quanti` giorni fa (0 oggi, -1 domani), `AAAA-MM-GG`.
const giorno = (quanti = 0) => {
  const d = new Date()
  d.setDate(d.getDate() - quanti)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
// Il primo del mese, `quanti` mesi da questo.
const primo = (quanti = 0) => {
  const d = new Date(new Date().getFullYear(), new Date().getMonth() + quanti, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

const BALLABIO = {
  nome: 'Diana', cognome: 'Ballabio', indirizzo: 'Via Montelera 73', cap: '10040', comune: 'Val della Torre', provincia: 'TO',
  codiceFiscale: 'BLLDNI86H61H355W', natoIl: '1986-06-21', natoA: 'Pinerolo', provinciaNascita: 'TO', iban: 'IT60X0542811101000000123456',
}
const STAGE = 'Stage di judo a Bardonecchia'
// Una ricevuta del mese (quattro lezioni, 120 €) e una extra (250 €) dello stesso tecnico e mese.
const ric = (id, extra = {}) => ({
  id, personaId: 'A', mese: '2026-10-01', righe: [{ corso: 'Judo kids', lezioni: 4, minuti: 480, centesimiOra: 1500, importo: 12000 }], calcolato: 12000, importo: 12000, motivo: null,
  tecnico: BALLABIO, qualifica: 'Allenatore', data: '2026-10-21', firmata: false, annullataIl: null, creataIl: '2026-10-21T10:00:00Z', movimentoId: null, pagataIl: null, extra: null, ...extra,
})
const extra = (id, e = {}) => ric(id, { righe: [], calcolato: 0, importo: 25000, extra: STAGE, ...e })

console.log('\n1. cosa non va in una extra, prima di salvare (le stesse parole del database)')
{
  const v = (x) => sicuro(() => c.cosaNonVaExtra({ descrizione: STAGE, importo: 25000, ...x }))
  ok('tutto giusto: niente', v({}), null)
  ok('importo zero', v({ importo: 0 }), 'Il compenso è un importo più grande di zero')
  ok('importo negativo', v({ importo: -100 }), 'Il compenso è un importo più grande di zero')
  ok('importo coi decimali (non in centesimi)', v({ importo: 100.5 }), 'Il compenso è un importo più grande di zero')
  ok('oltre 100.000 €', v({ importo: 10_000_001 }), 'Il compenso è al massimo 100.000 €')
  ok('proprio 100.000 € sì', v({ importo: 10_000_000 }), null)
  ok('descrizione di due lettere', v({ descrizione: 'ok' }), 'Scrivi per che cosa è il compenso: almeno tre lettere')
  ok('descrizione di soli spazi', v({ descrizione: '     ' }), 'Scrivi per che cosa è il compenso: almeno tre lettere')
  ok('descrizione di tre lettere sì', v({ descrizione: 'abc' }), null)
  ok('descrizione di 201 caratteri', v({ descrizione: 'x'.repeat(201) }), 'La descrizione è troppo lunga: al massimo 200 caratteri')
  ok('descrizione di 200 caratteri sì', v({ descrizione: 'x'.repeat(200) }), null)
  ok('gli spazi attorno non contano', v({ descrizione: ` ${'x'.repeat(200)} ` }), null)
  // Come il database: l'emoji è un carattere solo, non due.
  ok('200 emoji sì, come nel database', v({ descrizione: '🥋'.repeat(200) }), null)
  ok('201 emoji no', v({ descrizione: '🥋'.repeat(201) }), 'La descrizione è troppo lunga: al massimo 200 caratteri')
}

console.log('\n2. la riga del mese: la extra non è la ricevuta del mese')
{
  const conto = { righe: [], lezioni: 4, minuti: 480, calcolato: 12000, daConfermare: 0, senzaTariffa: [] }
  ok('statoCompenso: la ricevuta del mese fatta resta fatta', sicuro(() => c.statoCompenso({ conto, ricevuta: ric('r1') })), 'fatta')
  const righe = (ricevute, presenze = []) =>
    c.righeCompensi({
      tecnici: [{ id: 'A', nome: 'Anna', cognome: 'Gialli' }],
      presenze,
      senzaIstruttore: [],
      mese: { da: new Date(2026, 9, 1), a: new Date(2026, 9, 31) },
      tariffe: {},
      ricevute,
    })
  ok('ricevuta del mese fatta e una extra: la ricevuta è quella del mese, la extra è a parte',
    sicuro(() => righe([ric('r1'), extra('e1')]).map((r) => [r.ricevuta?.id ?? null, (r.extra ?? []).map((e) => e.id)])), [['r1', ['e1']]])
  ok('la extra non cambia lo stato: con la ricevuta del mese, fatta o non torna come senza',
    sicuro(() => righe([ric('r1'), extra('e1')]).map((r) => r.stato)), sicuro(() => righe([ric('r1')]).map((r) => r.stato)))
  ok('una extra annullata non si elenca', sicuro(() => righe([extra('e1', { annullataIl: '2026-10-22T10:00:00Z' })]).map((r) => (r.extra ?? []).map((e) => e.id))), [])
  ok('la extra di un altro mese non è di questo', sicuro(() => righe([extra('e1', { mese: '2026-09-01' })]).length), 0)
  ok('il tecnico con solo una extra e nessuna lezione: la riga c\'è, «solo-extra», senza ricevuta del mese',
    sicuro(() => righe([extra('e1')]).map((r) => [r.persona.id, r.ricevuta ?? null, r.stato, r.extra.map((e) => e.id)])), [['A', null, 'solo-extra', ['e1']]])
  ok('anche due extra uguali: solo-extra, tutte e due elencate',
    sicuro(() => righe([extra('e1'), extra('e2')]).map((r) => [r.stato, r.extra.map((e) => e.id)])), [['solo-extra', ['e1', 'e2']]])
  ok('la extra pagata non cambia lo stato di chi non ha altro', sicuro(() => righe([extra('e1', { movimentoId: 'mv1', pagataIl: '2026-10-25' })]).map((r) => r.stato)), ['solo-extra'])
  // Una lezione senza la sua firma non toglie la extra da pagare: niente «niente da pagare, per ora».
  const senzaLaSua = [{
    id: 's1-B', sessioneId: 's1', corso: 'Judo', inizio: new Date(2026, 9, 5, 18).toISOString(), fine: new Date(2026, 9, 5, 19).toISOString(),
    personaId: 'B', nome: 'Bruno', stato: 'confermata', previstiElenco: [{ id: 'A', nome: 'Anna' }, { id: 'B', nome: 'Bruno' }],
  }]
  ok('con una extra e una lezione senza la sua firma resta solo-extra',
    sicuro(() => righe([extra('e1')], senzaLaSua).map((r) => r.stato)), ['solo-extra'])
}

console.log('\n3. il testo della ricevuta di una extra')
{
  const testo = (r) => sicuro(() => c.testoRicevutaCompenso(r)).join?.('\n') ?? ''
  const t = testo(extra('e1', { qualifica: 'Allenatore' }))
  ok('i dati del tecnico', [/COGNOME: BALLABIO/.test(t), /NOME: DIANA/.test(t), /CODICE FISCALE: BLLDNI86H61H355W/.test(t), /IBAN IT60X0542811101000000123456/.test(t)], [true, true, true, true])
  ok('la qualifica barrata', /☒ ALLENATORE/.test(t), true)
  ok('la descrizione della extra', t.includes(STAGE), true)
  ok('l\'importo: 250,00 €', /250,00/.test(t), true)
  ok('luogo e data', t.includes('Collegno, 21/10/2026'), true)
  ok('nessuna riga per corso', /Judo kids/.test(t), false)
  ok('la ricevuta del mese non nomina nessuna extra', testo(ric('r1')).includes(STAGE), false)
}

console.log('\n4. senza codice fiscale, residenza o IBAN la extra non si fa')
{
  ok('mancaPerRicevuta ferma anche la extra: senza IBAN', sicuro(() => c.mancaPerRicevuta({ ...BALLABIO, iban: undefined })), 'Mancano i dati per la ricevuta: IBAN')
  ok('senza codice fiscale', sicuro(() => c.mancaPerRicevuta({ ...BALLABIO, codiceFiscale: undefined })), 'Mancano i dati per la ricevuta: codice fiscale')
  ok('senza residenza', sicuro(() => c.mancaPerRicevuta({ ...BALLABIO, indirizzo: undefined })), 'Mancano i dati per la ricevuta: residenza')
}

console.log('\n5. i totali: il preso nell\'anno e le ricevute da pagare')
{
  const ricevute = [
    ric('r1', { movimentoId: 'mv1', pagataIl: '2026-11-05' }),
    extra('e1', { movimentoId: 'mv1', pagataIl: '2026-11-05' }),
    // Annullata: non conta, anche col giorno del pagamento.
    extra('e2', { annullataIl: '2026-11-06T10:00:00Z', pagataIl: '2026-11-05', importo: 99900 }),
    // Fatta e da pagare: non è presa.
    extra('e3', { importo: 5000 }),
    ric('r4', { mese: '2026-09-01' }),
  ]
  ok('il 2026 comprende la extra pagata (120 + 250 €), non l\'annullata né la da pagare', sicuro(() => c.presoNellAnno(ricevute, 2026)), 37000)
  ok('pagabili: la extra da pagare c\'è, con la ricevuta del mese più vecchia prima', sicuro(() => c.pagabili(ricevute, 'A').map((r) => r.id)), ['r4', 'e3'])
  ok('una extra annullata non si paga', sicuro(() => c.pagabili(ricevute, 'A').some((r) => r.id === 'e2')), false)
  ok('una extra non torna o non torna: pagabili non guarda il conto del mese', sicuro(() => c.pagabili([extra('e1')], 'A', () => 1).map((r) => r.id)), ['e1'])
  const riga = (stato, ricevuta, ex = []) => ({ persona: { id: 'A' }, stato, ricevuta, extra: ex })
  ok('da pagare: la ricevuta fatta e le extra non pagate, col totale',
    sicuro(() => { const x = c.daPagareCompensi([riga('fatta', ric('r1'), [extra('e1'), extra('e2', { pagataIl: '2026-10-25', movimentoId: 'mv' })]), riga('da-fare', undefined), riga('solo-extra', undefined, [extra('e3', { importo: 5000 })])]); return [x.righe.length, x.totale] }),
    [2, 12000 + 25000 + 5000])
  ok('una ricevuta del mese che non torna non conta nel totale, le sue extra sì',
    sicuro(() => c.daPagareCompensi([riga('non-torna', ric('r1'), [extra('e1')])]).totale), 25000)
}

console.log('\n6. la descrizione del movimento nomina il testo della extra')
{
  const d = (...x) => sicuro(() => c.descrizionePagamento(...x))
  ok('un mese e una extra', d('Anna', 'Gialli', ['2026-10-01'], [STAGE]), `Compenso · Anna Gialli · ott 2026 · ${STAGE}`)
  ok('due extra, una dopo l\'altra', d('Anna', 'Gialli', ['2026-10-01'], ['Stage A', 'Stage B']), 'Compenso · Anna Gialli · ott 2026 · Stage A · Stage B')
  ok('senza extra, come prima', d('Anna', 'Gialli', ['2026-10-01']), 'Compenso · Anna Gialli · ott 2026')
  ok('la extra pagata sola', d('Anna', 'Gialli', ['2026-10-01'], [STAGE]).includes(STAGE), true)
  const lunga = d('Anna', 'Gialli', ['2026-10-01'], ['x'.repeat(200)])
  ok('oltre 200 caratteri si accorcia a 200, coi puntini', [lunga.length, lunga.startsWith('Compenso · Anna Gialli · '), lunga.at(-1)], [200, true, '…'])
  const emoji = d('Anna', 'Gialli', ['2026-10-01'], ['🥋'.repeat(200)])
  ok('con le emoji conta i caratteri, come il database', [[...emoji].length, emoji.at(-1)], [200, '…'])
  ok('le extra del pagamento in ordine di creazione, a pari ora per id come il database',
    sicuro(() => c.extraDelPagamento([extra('z', { extra: 'Terza', creataIl: '2026-10-23T10:00:00Z' }), ric('r1'), extra('b', { extra: 'Seconda' }), extra('a', { extra: 'Prima' })])),
    ['Prima', 'Seconda', 'Terza'])
}

console.log('\n7. la segreteria di prova: fa, cambia, annulla, paga una extra')
{
  const s = m.creaSegreteriaProva()
  const personale = await s.personale()
  const tecnico = personale.find((p) => p.ruolo === 'istruttore')
  const nonInsegna = personale.find((p) => p.ruolo === 'staff' && !p.ancheIstruttore)
  ok('c\'è un istruttore e una segreteria che non insegna', [!!tecnico, !!nonInsegna], [true, true])
  const senzaScheda = await s.salvaPersonale({ nome: 'Gino', cognome: 'Senzaiban', ruolo: 'istruttore' })
  await s.salvaAnagrafica(tecnico.id, { codiceFiscale: BALLABIO.codiceFiscale, indirizzo: BALLABIO.indirizzo, cap: BALLABIO.cap, comune: BALLABIO.comune, iban: BALLABIO.iban })
  await s.salvaAnagrafica(senzaScheda, { codiceFiscale: BALLABIO.codiceFiscale, indirizzo: BALLABIO.indirizzo, cap: BALLABIO.cap, comune: BALLABIO.comune })
  const casse = await s.casse()
  const conto = casse.find((x) => x.nome === 'Conto Corrente')?.id
  await s.salvaSaldoCassa(conto, 0, giorno(60))
  const mese = primo(-1)
  const dati = (x = {}) => ({ personaId: tecnico.id, mese, descrizione: STAGE, importo: 25000, ...x })
  const del_mese = { personaId: tecnico.id, mese, righe: [{ corso: 'Judo kids', lezioni: 4, minuti: 480, centesimiOra: 1500, importo: 12000 }], calcolato: 12000, importo: 12000, motivo: null, tecnico: BALLABIO, qualifica: 'Allenatore', data: giorno(0) }
  const sue = async (id) => (await s.ricevuteCompensi()).find((x) => x.id === id)

  const mensile = await s.faiRicevutaCompenso(del_mese)
  let e1
  await prova('fa la extra: una ricevuta con il suo id, la descrizione, l\'importo', async () => {
    e1 = await s.faiRicevutaCompensoExtra(dati())
    return [typeof e1.id, e1.id !== mensile.id, e1.extra, e1.importo, e1.calcolato, e1.righe, e1.motivo ?? null, e1.mese, e1.data]
  }, ['string', true, STAGE, 25000, 0, [], null, mese, giorno(0)])
  ok('i dati del tecnico dalla sua scheda, IBAN compreso', [e1?.tecnico?.nome, e1?.tecnico?.codiceFiscale, e1?.tecnico?.iban], [tecnico.nome, BALLABIO.codiceFiscale, BALLABIO.iban])
  ok('la qualifica è quella della ricevuta del mese', e1?.qualifica, 'Allenatore')
  ok('non firmata, non annullata, da pagare', [e1?.firmata, e1?.annullataIl ?? null, e1?.movimentoId ?? null, e1?.pagataIl ?? null], [false, null, null, null])
  await prova('due valide nello stesso mese: la ricevuta del mese e la extra', async () => (await s.ricevuteCompensi(tecnico.id)).filter((x) => x.mese === mese && !x.annullataIl).map((x) => x.extra ?? '').sort(), ['', STAGE])
  await prova('la seconda extra, identica, riesce', async () => typeof (await s.faiRicevutaCompensoExtra(dati())).id, 'string')
  ok('una seconda ricevuta del mese no, come prima', await errore(() => s.faiRicevutaCompenso(del_mese)), 'C\'è già la ricevuta di questo mese: annullala prima di rifarla')
  await prova('senza ricevuta del mese, per un altro mese, la extra riesce', async () => (await s.faiRicevutaCompensoExtra(dati({ mese: primo(-3) }))).qualifica ?? null, null)
  await prova('e dopo la ricevuta del mese di quel mese si fa lo stesso', async () => typeof (await s.faiRicevutaCompenso({ ...del_mese, mese: primo(-3) })).id, 'string')

  console.log('   cosa non si fa: e allora niente')
  const prima = (await s.ricevuteCompensi()).length
  ok('importo zero, col messaggio', await errore(() => s.faiRicevutaCompensoExtra(dati({ importo: 0 }))), 'Il compenso è un importo più grande di zero')
  ok('oltre 100.000 €', await errore(() => s.faiRicevutaCompensoExtra(dati({ importo: 10_000_001 }))), 'Il compenso è al massimo 100.000 €')
  ok('descrizione corta', await errore(() => s.faiRicevutaCompensoExtra(dati({ descrizione: 'ok' }))), 'Scrivi per che cosa è il compenso: almeno tre lettere')
  ok('descrizione oltre 200 caratteri', await errore(() => s.faiRicevutaCompensoExtra(dati({ descrizione: 'x'.repeat(201) }))), 'La descrizione è troppo lunga: al massimo 200 caratteri')
  ok('mese futuro', await rifiuta(() => s.faiRicevutaCompensoExtra(dati({ mese: primo(1) }))), 'rifiutato')
  ok('mese che non è il primo', await rifiuta(() => s.faiRicevutaCompensoExtra(dati({ mese: giorno(40).slice(0, 8) + '15' }))), 'rifiutato')
  ok('una persona che non insegna', await errore(() => s.faiRicevutaCompensoExtra(dati({ personaId: nonInsegna.id }))), 'La ricevuta del compenso si fa a chi insegna')
  ok('un tecnico senza IBAN', await errore(() => s.faiRicevutaCompensoExtra(dati({ personaId: senzaScheda }))), 'Mancano i dati per la ricevuta: IBAN')
  ok('nessuna ricevuta in più', (await s.ricevuteCompensi()).length, prima)

  console.log('   si cambia finché non è pagata')
  await prova('cambia descrizione e importo', async () => { const x = await s.modificaRicevutaCompensoExtra(e1.id, { descrizione: 'Stage di judo a Sauze', importo: 27000 }); return [x.extra, x.importo] }, ['Stage di judo a Sauze', 27000])
  await prova('cambiata, il foglio firmato non vale più: torna da firmare', async () => {
    await s.segnaFirmataCompenso(e1.id, true)
    return (await s.modificaRicevutaCompensoExtra(e1.id, { descrizione: 'Stage di judo a Sauze', importo: 27000 })).firmata
  }, false)
  await prova('e li rilegge', async () => { const x = await sue(e1.id); return [x.extra, x.importo, x.mese, x.tecnico.nome] }, ['Stage di judo a Sauze', 27000, mese, tecnico.nome])
  ok('importo zero no', await errore(() => s.modificaRicevutaCompensoExtra(e1.id, { descrizione: 'Stage', importo: 0 })), 'Il compenso è un importo più grande di zero')
  ok('descrizione corta no', await errore(() => s.modificaRicevutaCompensoExtra(e1.id, { descrizione: 'ok', importo: 1000 })), 'Scrivi per che cosa è il compenso: almeno tre lettere')
  ok('la ricevuta del mese non si cambia da qui', await errore(() => s.modificaRicevutaCompensoExtra(mensile.id, { descrizione: 'Stage', importo: 1000 })), 'Si cambiano solo le ricevute extra')
  ok('una che non c\'è no', await rifiuta(() => s.modificaRicevutaCompensoExtra('non-ce', { descrizione: 'Stage', importo: 1000 })), 'rifiutato')

  console.log('   si paga con la ricevuta del mese, in un movimento solo')
  const voce = (await s.voci()).find((v) => v.nome === 'Compensi istruttori')?.id
  const deiCompensi = async () => (await s.movimenti()).filter((x) => x.voceId === voce && !x.annullatoIl)
  await prova('paga la ricevuta del mese e la extra', () => s.pagaCompensi([mensile.id, e1.id], giorno(3), conto), undefined)
  await prova('un movimento solo, la somma (120 + 270 €), col testo della extra', async () => (await deiCompensi()).map((x) => [x.importo, x.personaId === tecnico.id, x.descrizione.endsWith('Stage di judo a Sauze')]), [[39000, true, true]])
  await prova('tutte e due pagate', async () => [await sue(mensile.id), await sue(e1.id)].map((x) => [!!x.movimentoId, x.pagataIl]), [[true, giorno(3)], [true, giorno(3)]])
  ok('annullare la extra pagata no, col messaggio', await errore(() => s.annullaRicevutaCompenso(e1.id)), 'È pagata: prima annulla il pagamento in CONTABILITÀ → MOVIMENTI')
  ok('cambiarla no, col messaggio', await errore(() => s.modificaRicevutaCompensoExtra(e1.id, { descrizione: 'Altro', importo: 1000 })), 'È pagata: prima annulla il pagamento in CONTABILITÀ → MOVIMENTI')
  await prova('una extra nuova nel mese già pagato riesce, e la ricevuta del mese resta pagata', async () => {
    const nuova = await s.faiRicevutaCompensoExtra(dati({ descrizione: 'Stage di ottobre', importo: 15000 }))
    return [typeof nuova.id, !!(await sue(mensile.id)).movimentoId, nuova.movimentoId ?? null]
  }, ['string', true, null])
  await prova('annullato il pagamento tornano da pagare tutte e due', async () => {
    await s.annullaMovimento((await deiCompensi())[0].id)
    return [await sue(mensile.id), await sue(e1.id)].map((x) => [x.movimentoId ?? null, x.pagataIl ?? null])
  }, [[null, null], [null, null]])

  console.log('   si annulla: la ricevuta del mese resta com\'è')
  await prova('annulla la extra', async () => { await s.annullaRicevutaCompenso(e1.id); return typeof (await sue(e1.id)).annullataIl }, 'string')
  await prova('la ricevuta del mese è valida, com\'era', async () => (await sue(mensile.id)).annullataIl ?? null, null)
  ok('annullata due volte no', await rifiuta(() => s.annullaRicevutaCompenso(e1.id)), 'rifiutato')
  ok('cambiare un\'annullata no', await rifiuta(() => s.modificaRicevutaCompensoExtra(e1.id, { descrizione: 'Altro', importo: 1000 })), 'rifiutato')
}

console.log('\n8. col database vero: le funzioni e la colonna')
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
    id: 'e1', persona_id: 'p1', mese: '2026-10-01', righe: [], calcolato: 0, importo: 25000, motivo: null, tecnico: { nome: 'Anna' }, qualifica: 'Allenatore', data: '2026-10-21',
    firmata: false, annullata_il: null, creata_il: '2026-10-21T10:00:00Z', creata_da: 'a1', movimento_id: null, pagata_il: null, extra: STAGE,
  }
  const db = m.creaSegreteriaSupabase({
    auth: { getSession: async () => ({ data: { session: null } }) },
    from: (tabella) => catena(tabella, tabella === 'ricevute_compensi' ? { data: [riga, { ...riga, id: 'r1', extra: null, righe: [{ corso: 'Judo kids', lezioni: 4, minuti: 480, centesimi_ora: 1500, importo: 12000 }], calcolato: 12000, importo: 12000 }], error: null } : { data: null, error: null }),
    rpc: (f, args) => (chiesto.push([f, 'rpc', args]), catena(f, { data: f.endsWith('_extra') ? riga : null, error: null })),
  })
  chiesto.length = 0
  await prova('fa la extra con fai_ricevuta_compenso_extra e rende la ricevuta con la descrizione', async () => {
    const x = await db.faiRicevutaCompensoExtra({ personaId: 'p1', mese: '2026-10-01', descrizione: STAGE, importo: 25000 })
    return [x.id, x.extra, x.righe, x.importo]
  }, ['e1', STAGE, [], 25000])
  ok('la funzione giusta, coi nomi giusti degli argomenti', chiesto.filter(([, k]) => k === 'rpc').map(([f, , a]) => [f, a]),
    [['fai_ricevuta_compenso_extra', { persona: 'p1', mese: '2026-10-01', descrizione: STAGE, importo: 25000 }]])
  chiesto.length = 0
  await prova('la cambia con modifica_ricevuta_compenso_extra', async () => (await db.modificaRicevutaCompensoExtra('e1', { descrizione: 'Stage nuovo', importo: 26000 })).id, 'e1')
  ok('coi nomi giusti', chiesto.filter(([, k]) => k === 'rpc').map(([f, , a]) => [f, a]), [['modifica_ricevuta_compenso_extra', { id: 'e1', descrizione: 'Stage nuovo', importo: 26000 }]])
  await prova('le ricevute rilette hanno la descrizione, e null quella del mese', async () => (await db.ricevuteCompensi('p1')).map((x) => [x.id, x.extra ?? null]), [['e1', STAGE], ['r1', null]])
  ok('importo zero: non parte neanche la chiamata', await errore(() => db.faiRicevutaCompensoExtra({ personaId: 'p1', mese: '2026-10-01', descrizione: STAGE, importo: 0 })), 'Il compenso è un importo più grande di zero')
  ok('descrizione corta: non parte neanche la chiamata', await errore(() => db.modificaRicevutaCompensoExtra('e1', { descrizione: 'ok', importo: 1000 })), 'Scrivi per che cosa è il compenso: almeno tre lettere')
  ok('nessun\'altra chiamata', chiesto.filter(([, k]) => k === 'rpc').length, 1)

  const rispondeErrore = (errore) => m.creaSegreteriaSupabase({
    auth: { getSession: async () => ({ data: { session: null } }) },
    from: () => catena('x', { data: null, error: null }),
    rpc: (f) => catena(f, { data: null, error: errore }),
  })
  ok('senza il file 96: dice cosa lanciare',
    (await errore(() => rispondeErrore({ code: 'PGRST202', message: 'Could not find the function public.fai_ricevuta_compenso_extra(descrizione, importo, mese, persona) in the schema cache' })
      .faiRicevutaCompensoExtra({ personaId: 'p1', mese: '2026-10-01', descrizione: STAGE, importo: 25000 }))).includes('va lanciato 96-compensi-extra.sql'), true)
  ok('il rifiuto del database arriva com\'è', await errore(() => rispondeErrore({ code: 'P0001', message: 'È pagata: prima annulla il pagamento in CONTABILITÀ → MOVIMENTI' }).modificaRicevutaCompensoExtra('e1', { descrizione: STAGE, importo: 25000 })),
    'È pagata: prima annulla il pagamento in CONTABILITÀ → MOVIMENTI')
}

console.log(guai ? `\n${guai} COSE NON TORNANO` : '\nTUTTO A POSTO')
process.exit(guai ? 1 : 0)
