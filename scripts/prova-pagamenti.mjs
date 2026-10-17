// ---------------------------------------------------------------------------
// Lo storico dei pagamenti, senza browser.
//
//   node scripts/prova-pagamenti.mjs
//
// Controlla `src/lib/pagamenti.ts`: le righe dalle ricevute e dai pagamenti a
// mano, i filtri, i totali, i periodi, da incassare e il foglio CSV.
// ---------------------------------------------------------------------------
import { build } from 'esbuild'

const { outputFiles } = await build({
  stdin: {
    contents: "export * from './src/lib/pagamenti'; export { ENTE_PREDEFINITO } from './src/lib/ricevute'",
    resolveDir: '.',
    loader: 'ts',
  },
  bundle: true,
  format: 'esm',
  platform: 'node',
  write: false,
  logLevel: 'error',
  define: { 'import.meta.env': '{}' },
})
const m = await import('data:text/javascript;base64,' + Buffer.from(outputFiles[0].text).toString('base64'))

let guai = 0
const ok = (cosa, avuto, voluto) => {
  const va = JSON.stringify(avuto) === JSON.stringify(voluto)
  console.log(va ? '  ✓' : '  ✗', cosa, va ? '' : `— atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`)
  if (!va) guai++
}
// Una funzione che non c'è ancora lancia: la prova fallisce con quel messaggio, non si ferma.
const prova = (f) => {
  try {
    return f()
  } catch (e) {
    return `ERRORE: ${e.message}`
  }
}

const pag = (data, importo, metodo = 'Contanti') => ({ data, importo, metodo })
const voce = (descrizione, prezzo, pagamenti, quantita = 1) => ({ descrizione, quantita, prezzo, pagamenti })
let n = 0
const ricevuta = (numero, nome, cognome, voci, extra = {}) => ({
  id: `r${++n}`,
  anno: 2026,
  numero,
  data: '2026-09-01',
  personaId: extra.personaId ?? `p-${cognome}`,
  ente: m.ENTE_PREDEFINITO,
  intestatario: { nome, cognome },
  voci,
  anticipo: 0,
  totale: voci.reduce((s, v) => s + v.quantita * v.prezzo, 0),
  pagato: voci.reduce((s, v) => s + v.pagamenti.reduce((t, p) => t + p.importo, 0), 0),
  creataIl: '2026-09-01T10:00:00Z',
  ...extra,
})
const diretto = (id, personaId, data, importo, extra = {}) => ({ id, personaId, data, importo, metodo: 'Contanti', voce: 'ALTRO', creatoIl: `${data}T10:00:00Z`, ...extra })
const nomeDi = (id) => ({ 'p-Rossi': 'Rossi Giulia', 'p-Bianchi': "D'Amico Zoë" })[id] ?? 'Sconosciuto'

console.log('1. lo storico di una persona')
const r12 = ricevuta(12, 'Giulia', 'Rossi', [voce('QUOTA ASSOCIATIVA', 5000, [pag('2026-09-10', 3000), pag('2026-10-01', 2000, 'POS')]), voce('Senza pagamenti', 7000, [])])
{
  const righe = prova(() => m.righeDaRicevute([r12]))
  ok('una riga per pagamento, due sulla stessa voce sono due righe, la voce senza pagamenti nessuna',
    prova(() => righe.map((r) => [r.data, r.importo, r.metodo, r.voce, r.ricevuta?.anno, r.ricevuta?.numero, r.chi, r.annullato])),
    [['2026-09-10', 3000, 'Contanti', 'QUOTA ASSOCIATIVA', 2026, 12, 'Rossi Giulia', false], ['2026-10-01', 2000, 'POS', 'QUOTA ASSOCIATIVA', 2026, 12, 'Rossi Giulia', false]])
  ok('la riga porta l\'id della ricevuta e della persona', prova(() => [righe[0].ricevuta.id, righe[0].personaId]), [r12.id, 'p-Rossi'])
  const conAnticipo = ricevuta(30, 'Giulia', 'Rossi', [voce('Corso', 8000, [pag('2026-10-02', 3000)])], { anticipo: 1000 })
  ok('l\'anticipo non è una riga', prova(() => m.righeDaRicevute([conAnticipo]).length), 1)
  ok('una ricevuta senza voci pagate non dà righe', prova(() => m.righeDaRicevute([ricevuta(31, 'Giulia', 'Rossi', [voce('Corso', 8000, [])])])), [])
  ok('una ricevuta senza persona dà righe lo stesso, col nome dell\'intestatario',
    prova(() => m.righeDaRicevute([ricevuta(32, 'Ugo', 'Neri', [voce('Corso', 100, [pag('2026-10-02', 100)])], { personaId: undefined })]).map((r) => [r.personaId ?? null, r.chi])),
    [[null, 'Neri Ugo']])
  const r = { ...ricevuta(33, "Zoë", "D'Amico", [voce('Corso', 100, [pag('2026-10-02', 100)])]) }
  ok('nomi con apostrofo e accento restano com\'è', prova(() => m.righeDaRicevute([r])[0].chi), "D'Amico Zoë")

  const a = ricevuta(5, 'A', 'A', [voce('x', 10, [pag('2026-10-01', 10)])])
  const b = ricevuta(9, 'B', 'B', [voce('x', 10, [pag('2026-10-01', 10)])])
  const c = ricevuta(2, 'C', 'C', [voce('x', 10, [pag('2026-10-05', 10)])])
  const d = ricevuta(1, 'D', 'D', [voce('x', 10, [pag('2026-09-01', 10)])])
  ok('dal più recente; a pari data, il numero più alto',
    prova(() => m.inOrdine(m.righeDaRicevute([a, b, c, d])).map((x) => x.ricevuta.numero)), [2, 9, 5, 1])
  ok('inOrdine non cambia l\'originale', prova(() => { const rr = m.righeDaRicevute([a, d]); m.inOrdine(rr); return rr.map((x) => x.ricevuta.numero) }), [5, 1])
  ok('i pagamenti a mano stanno nell\'ordine per data, anche a pari data con una ricevuta',
    prova(() => m.inOrdine([...m.righeDaRicevute([d]), ...m.righeDirette([diretto('d1', 'p-Rossi', '2026-09-02', 100)], nomeDi)]).map((x) => x.ricevuta?.numero ?? 'a mano')), ['a mano', 1])
}

console.log('\n2. una ricevuta annullata')
{
  const annullata = ricevuta(14, 'Luca', 'Bianchi', [voce('Corso', 9900, [pag('2026-10-05', 9900)])], { annullataIl: '2026-10-06T10:00:00Z' })
  const righe = prova(() => m.righeDaRicevute([r12, annullata]))
  ok('le sue righe ci sono ma annullate', prova(() => righe.filter((r) => r.ricevuta.numero === 14).map((r) => r.annullato)), [true])
  ok('quelle dell\'altra no', prova(() => righe.filter((r) => r.ricevuta.numero === 12).map((r) => r.annullato)), [false, false])
  ok('totalePagato non le conta', prova(() => m.totalePagato(righe)), 5000)
  ok('totalePagato di nessuna riga è 0', prova(() => m.totalePagato([])), 0)
  ok('filtra di base non le mostra', prova(() => m.filtra(righe, {}).map((r) => r.ricevuta.numero)), [12, 12])
  ok('con annullati: true sì', prova(() => m.filtra(righe, { annullati: true }).length), 3)
  ok('il totale di quel che si vede con annullati: true non le conta lo stesso', prova(() => m.totalePagato(m.filtra(righe, { annullati: true }))), 5000)
  ok('riassunto non le conta', prova(() => m.riassunto([r12, annullata], [])), { pagato: 5000, manca: 7000 })
  ok('daIncassare non le conta', prova(() => m.daIncassare([annullata])), [])
}

console.log('\n3. il riassunto di una scheda')
{
  const t80 = ricevuta(40, 'Giulia', 'Rossi', [voce('Corso', 8000, [pag('2026-09-10', 3000), pag('2026-10-01', 2000)])])
  ok('totale 80 con 30 + 20: pagato 50, manca 30', prova(() => m.riassunto([t80], [])), { pagato: 5000, manca: 3000 })
  const conAnticipo = ricevuta(41, 'Giulia', 'Rossi', [voce('Corso', 8000, [pag('2026-09-10', 5000)])], { anticipo: 1000 })
  ok('con 50 pagati e anticipo 10: pagato 60, manca 20', prova(() => m.riassunto([conAnticipo], [])), { pagato: 6000, manca: 2000 })
  ok('un diretto da 40: pagato in più, manca uguale', prova(() => m.riassunto([conAnticipo], [diretto('d1', 'p-Rossi', '2026-10-01', 4000)])), { pagato: 10000, manca: 2000 })
  ok('un diretto annullato non conta', prova(() => m.riassunto([conAnticipo], [diretto('d1', 'p-Rossi', '2026-10-01', 4000, { annullatoIl: '2026-10-02T10:00:00Z' })])), { pagato: 6000, manca: 2000 })
  ok('l\'anticipo di una ricevuta annullata non conta', prova(() => m.riassunto([{ ...conAnticipo, annullataIl: '2026-10-02T10:00:00Z' }], [])), { pagato: 0, manca: 0 })
  ok('il manca somma più ricevute', prova(() => m.riassunto([t80, conAnticipo], [])), { pagato: 11000, manca: 5000 })
  ok('mai negativo: una ricevuta saldata non toglie dalle altre', prova(() => m.riassunto([ricevuta(42, 'G', 'R', [voce('x', 100, [pag('2026-10-01', 100)])]), t80], [])), { pagato: 5100, manca: 3000 })
  ok('senza niente: zero', prova(() => m.riassunto([], [])), { pagato: 0, manca: 0 })
}

console.log('\n4. il pagamento a mano: cosa non va')
{
  const buono = { personaId: 'p-Rossi', data: '2026-10-01', importo: 3000, metodo: 'Contanti', voce: 'QUOTA ASSOCIATIVA', nota: 'in palestra' }
  const no = (cosa, cambio) => ok(cosa, prova(() => typeof m.cosaNonVaDiretto({ ...buono, ...cambio })), 'string')
  ok('il caso giusto va', prova(() => m.cosaNonVaDiretto(buono)), null)
  ok('senza nota va', prova(() => m.cosaNonVaDiretto({ ...buono, nota: undefined })), null)
  for (const metodo of ['Bonifico', 'Contanti', 'POS', 'Assegno', 'Satispay', 'a'.repeat(40)])
    ok(`il metodo «${metodo.slice(0, 12)}» va`, prova(() => m.cosaNonVaDiretto({ ...buono, metodo })), null)
  no('la data in un altro formato no', { data: '01/10/2026' })
  no('la data vuota no', { data: '' })
  no('l\'importo con i decimali no', { importo: 30.5 })
  no('l\'importo zero no', { importo: 0 })
  no('l\'importo negativo no', { importo: -100 })
  no('il metodo vuoto no', { metodo: '' })
  no('il metodo di soli spazi no', { metodo: '   ' })
  no('il metodo oltre 40 caratteri no', { metodo: 'a'.repeat(41) })
  no('la voce vuota no', { voce: '' })
  no('la voce di soli spazi no', { voce: '  ' })
  no('la nota di 301 caratteri no', { nota: 'a'.repeat(301) })
  ok('la nota di 300 va', prova(() => m.cosaNonVaDiretto({ ...buono, nota: 'a'.repeat(300) })), null)
  no('senza persona no', { personaId: '' })
}

console.log('\n4b. le stesse frasi del database')
{
  const buono = { personaId: 'p-Rossi', data: '2026-10-01', importo: 3000, metodo: 'Contanti', voce: 'QUOTA ASSOCIATIVA' }
  const frase = (cambio) => prova(() => m.cosaNonVaDiretto({ ...buono, ...cambio }))
  ok('una data che non esiste (30 febbraio) no', frase({ data: '2026-02-30' }), 'La data del pagamento non si capisce')
  ok('un mese che non esiste no', frase({ data: '2026-13-01' }), 'La data del pagamento non si capisce')
  ok('l\'anno 1 no', frase({ data: '0001-01-01' }), 'La data del pagamento non torna')
  ok('l\'anno 9999 no', frase({ data: '9999-12-31' }), 'La data del pagamento non torna')
  ok('il primo giorno del 2000 va', frase({ data: '2000-01-01' }), null)
  ok('l\'ultimo del 2100 va', frase({ data: '2100-12-31' }), null)
  ok('29 febbraio bisestile va', frase({ data: '2028-02-29' }), null)
  ok('importo con i decimali: non si capisce', frase({ importo: 30.5 }), 'L’importo non si capisce')
  ok('importo zero', frase({ importo: 0 }), 'L’importo deve essere più di zero')
  ok('importo negativo', frase({ importo: -5 }), 'L’importo deve essere più di zero')
  ok('importo massimo 10.000.000 va', frase({ importo: 10_000_000 }), null)
  ok('importo oltre il massimo no', frase({ importo: 10_000_001 }), 'L’importo è troppo alto: controlla le cifre')
  ok('senza persona', frase({ personaId: '' }), 'Manca la persona')
  ok('metodo vuoto', frase({ metodo: ' ' }), 'Scegli come ha pagato')
  ok('metodo di 41', frase({ metodo: 'a'.repeat(41) }), 'Il modo di pagamento è troppo lungo')
  ok('voce vuota', frase({ voce: '' }), 'Scrivi a cosa serve il pagamento')
  ok('voce di 120 va, di 121 no', [frase({ voce: 'a'.repeat(120) }), frase({ voce: 'a'.repeat(121) })], [null, 'La voce è troppo lunga'])
  ok('nota di 300 va, di 301 no', [frase({ nota: 'a'.repeat(300) }), frase({ nota: 'a'.repeat(301) })], [null, 'La nota è troppo lunga: al massimo 300 caratteri'])
}

console.log('\n5. le righe dei pagamenti a mano')
{
  const righe = prova(() => m.righeDirette([diretto('d1', 'p-Rossi', '2026-10-03', 4000, { nota: 'x' }), diretto('d2', 'p-Bianchi', '2026-10-04', 500, { annullatoIl: '2026-10-05T10:00:00Z', metodo: 'Satispay', voce: 'QUOTA ASSOCIATIVA' })], nomeDi))
  ok('senza ricevuta, con direttoId, chi da nomeDi, annullato se annullatoIl',
    prova(() => righe.map((r) => [r.id !== undefined, r.ricevuta ?? null, r.direttoId, r.chi, r.personaId, r.data, r.importo, r.metodo, r.voce, r.nota ?? null, r.annullato])),
    [[true, null, 'd1', 'Rossi Giulia', 'p-Rossi', '2026-10-03', 4000, 'Contanti', 'ALTRO', 'x', false], [true, null, 'd2', "D'Amico Zoë", 'p-Bianchi', '2026-10-04', 500, 'Satispay', 'QUOTA ASSOCIATIVA', null, true]])
  ok('gli id delle righe sono distinti da quelli delle ricevute', prova(() => new Set([...m.righeDirette([diretto('d1', 'p-Rossi', '2026-10-03', 1)], nomeDi), ...m.righeDaRicevute([r12])].map((r) => r.id)).size), 3)
}

console.log('\n6. i filtri')
{
  const r112 = ricevuta(112, 'Anna', 'Verdi', [voce('Corso', 1000, [pag('2026-10-02', 1000, 'Bonifico')])])
  const r120 = ricevuta(120, 'Piero', 'Gialli', [voce('Corso', 1000, [pag('2026-10-20', 1000, 'POS')])])
  const rA = ricevuta(12, 'Zoë', "D'Amico", [voce('Corso', 1000, [pag('2026-11-01', 1000, 'Bonifico')])], { anno: 2025 })
  const tutte = prova(() => m.inOrdine([...m.righeDaRicevute([r12, r112, r120, rA]), ...m.righeDirette([diretto('d1', 'p-Rossi', '2026-10-03', 4000)], nomeDi)]))
  const numeri = (f) => prova(() => m.filtra(tutte, f).map((r) => (r.ricevuta ? `${r.ricevuta.anno}/${r.ricevuta.numero}` : 'a mano')))
  ok('senza filtri: tutte, annullate escluse', prova(() => m.filtra(tutte, {}).length), 6)
  ok('«ROSSI» e «rossi» uguali', numeri({ testo: 'ROSSI' }), numeri({ testo: 'rossi' }))
  ok('«rossi» le trova (tre righe)', prova(() => m.filtra(tutte, { testo: 'rossi' }).length), 3)
  ok('«gìulia» trova Rossi Giulia (accenti ignorati)', prova(() => m.filtra(tutte, { testo: 'gìulia' }).length), 3)
  ok('«zoe» trova Zoë', prova(() => m.filtra(tutte, { testo: 'zoe' }).length), 1)
  ok('con apostrofo: «d\'amico»', prova(() => m.filtra(tutte, { testo: "d'amico" }).length), 1)
  ok('un nome che non c\'è: niente', numeri({ testo: 'zzz' }), [])
  ok('nome e cognome in qualunque ordine', prova(() => [m.filtra(tutte, { testo: 'giulia rossi' }).length, m.filtra(tutte, { testo: 'rossi giulia' }).length, m.filtra(tutte, { testo: 'giulia  ross' }).length]), [3, 3, 3])
  ok('tutte le parole devono esserci', prova(() => m.filtra(tutte, { testo: 'giulia verdi' }).length), 0)
  ok('«12» trova solo la ricevuta 12, non 112 né 120', prova(() => m.filtra(tutte, { testo: '12' }).map((r) => r.ricevuta.numero)), [12, 12, 12])
  ok('«12/2026» solo quella del 2026', numeri({ testo: '12/2026' }), ['2026/12', '2026/12'])
  ok('«112» trova solo la 112', numeri({ testo: '112' }), ['2026/112'])
  ok('dal e al sono inclusivi', prova(() => m.filtra(tutte, { dal: '2026-10-02', al: '2026-10-03' }).map((r) => r.data).sort()), ['2026-10-02', '2026-10-03'])
  ok('solo dal', prova(() => m.filtra(tutte, { dal: '2026-10-20' }).map((r) => r.data)), ['2026-11-01', '2026-10-20'])
  ok('solo al', prova(() => m.filtra(tutte, { al: '2026-09-10' }).map((r) => r.data)), ['2026-09-10'])
  ok('il metodo, senza maiuscole', numeri({ metodo: 'bonifico' }), ['2025/12', '2026/112'])
  ok('soloSenzaRicevuta', numeri({ soloSenzaRicevuta: true }), ['a mano'])
  ok('i filtri insieme', numeri({ testo: 'rossi', metodo: 'contanti', dal: '2026-10-01' }), ['a mano'])
  ok('il totale del periodo vale su tutte le righe', prova(() => m.totalePagato(m.filtra(tutte, { dal: '2026-10-01', al: '2026-10-31' }))), 2000 + 1000 + 1000 + 4000)
  ok('filtra non cambia l\'originale', prova(() => { const l = tutte.length; m.filtra(tutte, { testo: 'rossi' }); return tutte.length === l }), true)
}

console.log('\n7. i periodi')
{
  const mese = (o, s) => prova(() => m.intervalloMese(o, s))
  ok('questo mese', mese('2026-10-17', 0), { dal: '2026-10-01', al: '2026-10-31' })
  ok('il mese scorso', mese('2026-10-17', -1), { dal: '2026-09-01', al: '2026-09-30' })
  ok('da gennaio, dicembre dell\'anno prima', mese('2026-01-05', -1), { dal: '2025-12-01', al: '2025-12-31' })
  ok('febbraio bisestile finisce il 29', mese('2028-02-10', 0), { dal: '2028-02-01', al: '2028-02-29' })
  ok('febbraio normale finisce il 28', mese('2027-02-10', 0), { dal: '2027-02-01', al: '2027-02-28' })
  ok('marzo bisestile, il mese scorso finisce il 29', mese('2028-03-31', -1), { dal: '2028-02-01', al: '2028-02-29' })
  ok('l\'anno', prova(() => m.intervalloAnno('2026-10-17')), { dal: '2026-01-01', al: '2026-12-31' })
}

console.log('\n8. da incassare')
{
  const piccola = ricevuta(50, 'Anna', 'Verdi', [voce('Corso', 5000, [pag('2026-09-10', 4000)])])
  const grande = ricevuta(51, 'Piero', 'Gialli', [voce('Corso', 9000, [pag('2026-09-10', 1000)])])
  const saldata = ricevuta(52, 'Ugo', 'Neri', [voce('Corso', 100, [pag('2026-09-10', 100)])])
  const saldataConAnticipo = ricevuta(53, 'Ugo', 'Neri', [voce('Corso', 100, [])], { anticipo: 100 })
  const annullata = ricevuta(54, 'Ugo', 'Neri', [voce('Corso', 100, [])], { annullataIl: '2026-10-01T10:00:00Z' })
  ok('dalla più grande, solo chi deve, «Cognome Nome»',
    prova(() => m.daIncassare([piccola, saldata, grande, saldataConAnticipo, annullata]).map((x) => [x.ricevuta.numero, x.chi, x.manca])),
    [[51, 'Gialli Piero', 8000], [50, 'Verdi Anna', 1000]])
  ok('niente da incassare: elenco vuoto', prova(() => m.daIncassare([saldata])), [])
}

console.log('\n8b. chi deve ancora pagare, cercato')
{
  const a = ricevuta(12, 'Anna', 'Verdi', [voce('Corso', 5000, [pag('2026-09-10', 4000)])])
  const b = ricevuta(112, 'Piero', "D'Amico", [voce('Corso', 9000, [])])
  const residui = prova(() => m.daIncassare([a, b]))
  const numeri = (testo) => prova(() => m.filtraResidui(residui, testo).map((x) => x.ricevuta.numero))
  ok('senza testo: tutti', numeri(''), [112, 12])
  ok('per nome, senza maiuscole né accenti', numeri('verdì'), [12])
  ok('con apostrofo', numeri("d'amico"), [112])
  ok('«12» è la ricevuta 12, non la 112', numeri('12'), [12])
  ok('«12/2026» ', numeri('12/2026'), [12])
  ok('«12/2025» è un\'altra annata', numeri('12/2025'), [])
  ok('un nome che non c\'è: niente', numeri('zzz'), [])
}

console.log('\n8c. i numeri della pagina')
{
  const a = ricevuta(60, 'Anna', 'Verdi', [voce('Corso', 5000, [pag('2026-10-02', 4000, 'Contanti'), pag('2026-10-03', 500, 'Bonifico')])])
  const b = ricevuta(61, 'Ugo', 'Neri', [voce('Corso', 3000, [pag('2026-10-04', 3000, 'CONTANTI')])])
  const annullata = ricevuta(62, 'Zoe', 'Rossi', [voce('Corso', 9000, [pag('2026-10-05', 9000, 'Contanti')])], { annullataIl: '2026-10-06T10:00:00Z' })
  const righe = prova(() => [...m.righeDaRicevute([a, b, annullata]), ...m.righeDirette([diretto('d1', 'p-Rossi', '2026-10-06', 1000, { metodo: 'Satispay' })], nomeDi)])
  ok('totale, contanti (senza badare alle maiuscole), pagamenti, senza ricevuta, da incassare',
    prova(() => m.riepilogo(m.filtra(righe, {}), [a, b, annullata])),
    { totale: 8500, contanti: 7000, pagamenti: 4, senzaRicevuta: 1, daIncassare: 500, ricevuteDaIncassare: 1 })
  ok('senza righe e senza ricevute: tutto zero', prova(() => m.riepilogo([], [])), { totale: 0, contanti: 0, pagamenti: 0, senzaRicevuta: 0, daIncassare: 0, ricevuteDaIncassare: 0 })
  ok('una riga annullata mostrata non conta nei numeri', prova(() => m.riepilogo(m.filtra(righe, { annullati: true }), []).pagamenti), 4)
}

console.log('\n8d. suggerimenti e periodi scelti')
{
  ok('le voci suggerite: la quota, annuale e trimestre di ogni corso, altro',
    prova(() => m.vociSuggerite(['Judo kids', 'Pilates'])),
    ['QUOTA ASSOCIATIVA', 'ANNUALE JUDO KIDS', 'TRIMESTRE JUDO KIDS', 'ANNUALE PILATES', 'TRIMESTRE PILATES', 'ALTRO'])
  ok('senza corsi: quota e altro', prova(() => m.vociSuggerite([])), ['QUOTA ASSOCIATIVA', 'ALTRO'])
  ok('il periodo scelto: mese', prova(() => m.intervalloDi('mese', '2026-10-17', '', '')), { dal: '2026-10-01', al: '2026-10-31' })
  ok('il mese scorso', prova(() => m.intervalloDi('scorso', '2026-10-17', '', '')), { dal: '2026-09-01', al: '2026-09-30' })
  ok('l\'anno', prova(() => m.intervalloDi('anno', '2026-10-17', '', '')), { dal: '2026-01-01', al: '2026-12-31' })
  ok('tutto: nessun limite', prova(() => m.intervalloDi('tutto', '2026-10-17', '', '')), {})
  ok('dal-al: le date scritte, una vuota è nessun limite', prova(() => m.intervalloDi('date', '2026-10-17', '2026-10-01', '')), { dal: '2026-10-01' })
  ok('dal-al con tutte e due', prova(() => m.intervalloDi('date', '2026-10-17', '2026-10-01', '2026-10-05')), { dal: '2026-10-01', al: '2026-10-05' })
}

console.log('\n9. il foglio per il commercialista')
{
  const rc = ricevuta(12, 'Giulia', 'Rossi', [voce('QUOTA ASSOCIATIVA', 5000, [pag('2026-09-10', 3000)])])
  const righe = prova(() => [...m.righeDaRicevute([rc]), ...m.righeDirette([diretto('d1', 'p-Rossi', '2026-10-03', 123456, { voce: 'ALTRO', nota: 'a; "mano"' })], nomeDi)])
  ok('intestazione, data GG/MM/AAAA, importo all\'italiana, ricevuta o vuoto, ; e \\r\\n',
    prova(() => m.csvPagamenti(righe)),
    'data;chi;a cosa serve;come;ricevuta;importo;nota\r\n10/09/2026;Rossi Giulia;QUOTA ASSOCIATIVA;Contanti;12/2026;30,00;\r\n03/10/2026;Rossi Giulia;ALTRO;Contanti;;1.234,56;"a; ""mano"""')
  ok('senza righe, solo l\'intestazione', prova(() => m.csvPagamenti([])), 'data;chi;a cosa serve;come;ricevuta;importo;nota')
  ok('una nota che comincia per = non è una formula', prova(() => m.csvPagamenti(m.righeDirette([diretto('d1', 'p-Rossi', '2026-10-03', 100, { nota: '=SOMMA(A1)' })], nomeDi)).split('\r\n')[1]), "03/10/2026;Rossi Giulia;ALTRO;Contanti;;1,00;'=SOMMA(A1)")
  ok('le annullate non sono nel foglio', prova(() => m.csvPagamenti(m.righeDirette([diretto('d1', 'p-Rossi', '2026-10-03', 100, { annullatoIl: '2026-10-04T10:00:00Z' })], nomeDi))), 'data;chi;a cosa serve;come;ricevuta;importo;nota')
  ok('quelle di una ricevuta annullata nemmeno', prova(() => m.csvPagamenti(m.righeDaRicevute([{ ...rc, annullataIl: '2026-10-04T10:00:00Z' }]))), 'data;chi;a cosa serve;come;ricevuta;importo;nota')
  ok('un nome con accento e apostrofo resta intero', prova(() => m.csvPagamenti(m.righeDirette([diretto('d1', 'p-Bianchi', '2026-10-03', 100)], nomeDi)).split('\r\n')[1].split(';')[1]), "D'Amico Zoë")
}

console.log(guai ? `\n${guai} COSE NON TORNANO` : '\nTUTTO A POSTO')
process.exit(guai ? 1 : 0)
