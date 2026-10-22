// ---------------------------------------------------------------------------
// Lo scarico dei pagamenti Satispay del negozio, senza browser e senza rete.
//
//   node scripts/prova-satispay-scarico.mjs
//
// Le regole stanno in `src/lib/satispayScarico.ts`; il database (97-satispay-scarico.sql)
// dice la stessa cosa, e `supabase/prova/satispay-scarico.sql` ha gli stessi casi
// con gli stessi messaggi. Ordine delle regole: modulo, doppioni, giorno chiuso,
// movimento nuovo. Oggi, per la prova, è il 22 ottobre 2026.
//
// Forma dei dati di `applicaScarico` (dati.negozio): satispayId, tipo, stato,
// importo, quando, chi, esito, motivo, candidati, movimentoId: i nomi del database
// in camelCase.
// ---------------------------------------------------------------------------
import { build } from 'esbuild'

const OGGI = '2026-10-22'

// Un modulo che manca fa rosso i suoi casi, non ferma gli altri.
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
const s = await carica("export * from './src/lib/satispayScarico'")

let guai = 0
const ok = (cosa, avuto, voluto) => {
  const va = JSON.stringify(avuto) === JSON.stringify(voluto)
  console.log(va ? '  ✓' : '  ✗', cosa, va ? '' : `— atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`)
  if (!va) guai++
}
// Il risultato di una funzione, o «ERRORE: …» se non c'è o si rompe (anche una funzione che manca fa rosso).
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

console.log('1. lo scarico gira solo col negozio vero (R12)')
{
  ok('il server di prova di Satispay: no', prova(() => s.scaricoPermesso('staging.authservices.satispay.com')), false)
  ok('quello vero: sì', prova(() => s.scaricoPermesso('authservices.satispay.com')), true)
  ok('l\'host che è scritto in una costante', prova(() => s.HOST_VERO), 'authservices.satispay.com')
}

console.log('\n2. la cassa: Satispay dal 1 ottobre, prima il Conto Corrente')
const casse = [
  { id: 'co', nome: 'Cassa Contanti', saldoIniziale: 0 },
  { id: 'cc', nome: 'Conto Corrente', saldoIniziale: 0, dal: '2026-09-01' },
  { id: 'sa', nome: 'Satispay', saldoIniziale: 0, dal: '2026-10-01' },
]
{
  ok('il 30 settembre: Conto Corrente', prova(() => s.cassaSatispay('2026-09-30', casse)?.id), 'cc')
  ok('l\'1 ottobre: Satispay', prova(() => s.cassaSatispay('2026-10-01', casse)?.id), 'sa')
  ok('il giorno del cambio è una costante', prova(() => s.CAMBIO_CASSA_SATISPAY), '2026-10-01')
}

console.log('\n3. leggere le pagine di Satispay (R8, R9)')
{
  const pagamento = (id) => ({ id })
  // Satispay a pagine di due: a,b / c,d / e. Registra cosa gli si chiede.
  const pagine = { '': { data: ['a', 'b'].map(pagamento), has_more: true }, b: { data: ['c', 'd'].map(pagamento), has_more: true }, d: { data: ['e'].map(pagamento), has_more: false } }
  const lettore = (cadeDopo = null) => {
    const chiamate = []
    return {
      chiamate,
      leggi: async (dopo) => {
        chiamate.push(dopo)
        if (dopo === cadeDopo) return null
        return pagine[dopo ?? '']
      },
    }
  }
  // Un database che dice quanti nuovi: i salvati si contano per id.
  const archivio = () => {
    const visti = []
    return { visti, salva: async (pagina) => (visti.push(...pagina.map((x) => x.id)), pagina.length) }
  }

  {
    const l = lettore('b')
    const a = archivio()
    const r = await aspetta(() => s.scorriPagine(l.leggi, a.salva, undefined))
    ok('R8: la seconda pagina non risponde: errore', { ok: r.ok, errore: r.errore }, { ok: false, errore: s.ERRORE_SCARICO })
    ok('…salvata solo la prima', a.visti, ['a', 'b'])
    ok('…la ripresa è l\'ultimo della prima', r.ripresa, 'b')
    ok('l\'errore dice che riprova da solo', String(s.ERRORE_SCARICO).includes('riprova da solo'), true)
  }
  {
    const l = lettore()
    const a = archivio()
    const r = await aspetta(() => s.scorriPagine(l.leggi, a.salva, undefined))
    ok('R9: tre pagine, tre salva, starting_after giusti', l.chiamate, [undefined, 'b', 'd'])
    ok('…salvati tutti, uno per uno', a.visti, ['a', 'b', 'c', 'd', 'e'])
    ok('…completa, la ripresa è l\'ultimo', { ok: r.ok, ripresa: r.ripresa, completa: r.completa }, { ok: true, ripresa: 'e', completa: true })
  }
  {
    // Interrotto alla terza pagina, poi si riparte dalla ripresa.
    const a = archivio()
    const l1 = lettore('d')
    const r1 = await aspetta(() => s.scorriPagine(l1.leggi, a.salva, undefined))
    const l2 = lettore()
    const r2 = await aspetta(() => s.scorriPagine(l2.leggi, a.salva, r1.ripresa))
    ok('R9: interrotto, la ripresa è l\'ultimo della seconda pagina', r1.ripresa, 'd')
    ok('…ripartendo non rilegge la prima pagina', l2.chiamate, ['d'])
    ok('…nessun id salvato due volte', a.visti, ['a', 'b', 'c', 'd', 'e'])
    ok('…e finisce', { ok: r2.ok, completa: r2.completa }, { ok: true, completa: true })
  }
  {
    // Il database non ha preso la pagina: come Satispay che non risponde.
    const l = lettore()
    const r = await aspetta(() => s.scorriPagine(l.leggi, async () => null, undefined))
    ok('il database non salva: ERRORE_SCARICO', { ok: r.ok, errore: r.errore }, { ok: false, errore: s.ERRORE_SCARICO })
    ok('…e si ferma alla prima pagina', l.chiamate, [undefined])
  }
  {
    // Lo scarico di ogni notte: si ferma alla prima pagina senza novità.
    const l = lettore()
    const r = await aspetta(() => s.scorriPagine(l.leggi, async () => 0, undefined, true))
    ok('soloNuovi: la prima pagina non ha novità, si ferma', l.chiamate, [undefined])
    ok('…senza errore', r.ok, true)
    const l2 = lettore()
    const novita = [2, 0, 0]
    const r2 = await aspetta(() => s.scorriPagine(l2.leggi, async () => novita.shift(), undefined, true))
    ok('soloNuovi: due novità, poi una pagina vecchia: si ferma lì', l2.chiamate, [undefined, 'b'])
    ok('…senza errore', r2.ok, true)
    const l3 = lettore()
    await aspetta(() => s.scorriPagine(l3.leggi, async () => 0, undefined))
    ok('senza soloNuovi legge tutto anche se non c\'è niente di nuovo', l3.chiamate, [undefined, 'b', 'd'])
  }
}

console.log('\n4. le regole dello scarico: come il database (applicaScarico)')
const voci = [
  { id: 'vde', nome: 'Da classificare', tipo: 'entrata', diSistema: false, attiva: true },
  { id: 'vdu', nome: 'Da classificare', tipo: 'uscita', diSistema: false, attiva: true },
  { id: 'vcor', nome: 'Corsi e altri pagamenti', tipo: 'entrata', diSistema: true, attiva: true },
]
const neg = (satispayId, tipo, stato, importo, quando, chi) => ({ satispayId, tipo, stato, importo, quando, chi })
const inc = (id, importo, quando, chi = 'Mario', stato = 'ACCEPTED') => neg(id, 'TO_BUSINESS', stato, importo, quando, chi)
const man = (id, data, importo, cassaId, extra = {}) => ({
  id, tipo: 'entrata', data, importo, voceId: 'vcor', cassaId, descrizione: `A mano ${id}`, creatoIl: '2026-10-01T10:00:00Z', ...extra,
})
const chiusura = (cassaId, data) => ({
  id: `ch-${cassaId}-${data}`, cassaId, dal: '2026-10-01', data, previsto: 0, contato: 0, differenza: 0, chiusaIl: '2026-10-16T10:00:00Z',
})
const dati = (negozio, extra = {}) => ({ negozio, modulo: [], pagamenti: [], movimenti: [], casse, chiusure: [], voci, oggi: OGGI, ...extra })
const CHIAVI = ['incassi', 'rimborsi', 'modulo', 'a_mano', 'da_decidere', 'scritti']
const conti = (r) => (r && r.conti ? CHIAVI.map((k) => r.conti[k] ?? 0).join('/') : r)
const applica = (d, scrivi = true) => prova(() => s.applicaScarico(d, scrivi))
const riga = (r, id) => r.negozio?.find((x) => x.satispayId === id)
const esitoDi = (r, id) => `${riga(r, id)?.esito ?? 'senza esito'}/${riga(r, id)?.motivo ?? '-'}`
const movDi = (r, id) => {
  const m = r.movimenti?.find((x) => x.satispayId === id)
  if (!m) return 'nessuno'
  const cassa = casse.find((c) => c.id === m.cassaId)?.nome
  const voce = voci.find((v) => v.id === m.voceId)?.nome
  return [m.tipo, m.data, m.importo, cassa, voce, m.descrizione].join('|')
}
const di = (r, f) => (typeof r === 'string' ? r : f(r))
const ripassa = (r, extra = {}) => ({ negozio: r.negozio, modulo: [], pagamenti: [], movimenti: r.movimenti, casse, chiusure: [], voci, oggi: OGGI, ...extra })
{
  console.log('  — un incasso entra una volta sola (R1, R2, R5)')
  const p1 = inc('P1', 1250, '2026-10-14T10:00:00Z', 'Mario Rossi')
  const r = applica(dati([p1]))
  ok('applica: un incasso scritto', conti(r), '1/0/0/0/0/1')
  ok('il 14 ottobre sta nella cassa Satispay, «Da classificare», «Satispay · chi»', di(r, (x) => movDi(x, 'P1')), 'entrata|2026-10-14|1250|Satispay|Da classificare|Satispay · Mario Rossi')
  ok('esito scritto', di(r, (x) => esitoDi(x, 'P1')), 'scritto/-')
  const r2 = di(r, (x) => applica(ripassa(x)))
  ok('applica di fila: niente', conti(r2), '0/0/0/0/0/0')
  ok('…un movimento solo', di(r2, (x) => x.movimenti?.filter((m) => m.satispayId === 'P1').length), 1)
  ok('senza nome: solo «Satispay»', di(applica(dati([inc('P2', 300, '2026-10-15T09:00:00Z', null)])), (x) => movDi(x, 'P2')), 'entrata|2026-10-15|300|Satispay|Da classificare|Satispay')
  ok('il 20 settembre entra in Conto Corrente', di(applica(dati([inc('P3', 2000, '2026-09-20T10:00:00Z', 'Sara')])), (x) => movDi(x, 'P3')), 'entrata|2026-09-20|2000|Conto Corrente|Da classificare|Satispay · Sara')

  console.log('  — il giorno è quello di Roma')
  ok('14 ottobre 22:30Z è il 15', di(applica(dati([inc('T1', 1234, '2026-10-14T22:30:00Z', 'Notte')])), (x) => movDi(x, 'T1')), 'entrata|2026-10-15|1234|Satispay|Da classificare|Satispay · Notte')
  ok('30 settembre 22:30Z è l\'1 ottobre: Satispay', di(applica(dati([inc('T2', 100, '2026-09-30T22:30:00Z', 'Cambio')])), (x) => movDi(x, 'T2')), 'entrata|2026-10-01|100|Satispay|Da classificare|Satispay · Cambio')
  ok('30 settembre 19:30Z è ancora settembre: Conto Corrente', di(applica(dati([inc('T3', 100, '2026-09-30T19:30:00Z', 'Sera')])), (x) => movDi(x, 'T3')), 'entrata|2026-09-30|100|Conto Corrente|Da classificare|Satispay · Sera')

  console.log('  — PENDING aspetta, CANCELED non entra mai (R2)')
  const w = applica(dati([inc('W1', 1000, '2026-10-14T10:00:00Z', 'Attesa', 'PENDING')]))
  ok('PENDING: non entra', conti(w), '0/0/0/0/0/0')
  ok('…resta senza esito', di(w, (x) => esitoDi(x, 'W1')), 'senza esito/-')
  const w2 = di(w, (x) => applica(ripassa(x, { negozio: x.negozio.map((n) => ({ ...n, stato: 'ACCEPTED', importo: 1100 })) })))
  ok('…poi ACCEPTED: entra, con l\'importo nuovo', di(w2, (x) => movDi(x, 'W1')), 'entrata|2026-10-14|1100|Satispay|Da classificare|Satispay · Attesa')
  const c = applica(dati([inc('C1', 700, '2026-10-14T10:00:00Z', 'Annullato', 'CANCELED')]))
  ok('CANCELED: non entra', conti(c) + ' ' + di(c, (x) => movDi(x, 'C1')), '0/0/0/0/0/0 nessuno')
  ok('…e al giro dopo nemmeno', conti(di(c, (x) => applica(ripassa(x)))), '0/0/0/0/0/0')

  console.log('  — un rimborso è un\'uscita (R7)')
  const rf = applica(dati([neg('R1', 'REFUND_TO_BUSINESS', 'ACCEPTED', 500, '2026-10-16T10:00:00Z', 'Mario Rossi')]))
  ok('conti', conti(rf), '0/1/0/0/0/1')
  ok('uscita «Da classificare» nella cassa Satispay', di(rf, (x) => movDi(x, 'R1')), 'uscita|2026-10-16|500|Satispay|Da classificare|Rimborso Satispay · Mario Rossi')

  console.log('  — il pagamento del modulo (R3, R4)')
  const mo = applica(dati([inc('M1', 5000, '2026-10-14T10:00:00Z', 'Paolo')], { modulo: ['M1'] }))
  ok('esito modulo, nessun movimento', conti(mo) + ' ' + di(mo, (x) => esitoDi(x, 'M1') + ' ' + x.movimenti.length), '0/0/1/0/0/0 modulo/- 0')

  console.log('  — annullato resta annullato (R6)')
  const an = applica(
    dati([{ ...inc('A1', 1250, '2026-10-14T10:00:00Z', 'Mario'), esito: 'scritto' }], {
      movimenti: [man('mv', '2026-10-14', 1250, 'sa', { satispayId: 'A1', annullatoIl: '2026-10-15T10:00:00Z' })],
    }),
  )
  ok('niente di nuovo', conti(an) + ' ' + di(an, (x) => x.movimenti.length), '0/0/0/0/0/0 1')

  console.log('  — doppione certo e dubbio')
  const d1 = applica(dati([inc('D1', 1250, '2026-10-14T10:00:00Z')], { movimenti: [man('m1', '2026-10-14', 1250, 'cc')] }))
  ok('certo: a_mano, nessun movimento nuovo', conti(d1) + ' ' + di(d1, (x) => esitoDi(x, 'D1') + ' ' + x.movimenti.length), '0/0/0/1/0/0 a_mano/- 1')
  ok('…il movimento a mano prende il segno', di(d1, (x) => x.movimenti[0].satispayId), 'D1')
  const d2 = applica(dati([inc('D2', 1250, '2026-10-14T10:00:00Z')], { movimenti: [man('m1', '2026-10-14', 1250, 'cc'), man('m2', '2026-10-14', 1250, 'sa')] }))
  ok('dubbio: da decidere, forse doppione', conti(d2) + ' ' + di(d2, (x) => esitoDi(x, 'D2') + ' ' + x.movimenti.length), '0/0/0/0/1/0 da_decidere/forse_doppione 2')
  ok('…i candidati sono i due', di(d2, (x) => [...(riga(x, 'D2').candidati ?? [])].sort()), ['m1', 'm2'])
  ok('…nessuno ha il segno', di(d2, (x) => x.movimenti.filter((m) => m.satispayId).length), 0)
  const d3 = applica(dati([inc('D3', 1250, '2026-10-14T10:00:00Z')], { movimenti: [man('m1', '2026-10-14', 1250, 'co')] }))
  ok('Cassa Contanti non è candidata: movimento nuovo', conti(d3) + ' ' + di(d3, (x) => x.movimenti.length), '1/0/0/0/0/1 2')
  const d4 = applica(dati([inc('D4', 1250, '2026-10-14T10:00:00Z')], { movimenti: [man('m1', '2026-10-14', 1250, 'cc', { annullatoIl: '2026-10-15T10:00:00Z' })] }))
  ok('un\'entrata annullata non è candidata', conti(d4), '1/0/0/0/0/1')
  const d5 = applica(dati([inc('E1', 1250, '2026-10-14T09:00:00Z', 'Primo'), inc('E2', 1250, '2026-10-14T11:00:00Z', 'Secondo')], { movimenti: [man('m1', '2026-10-14', 1250, 'cc')] }))
  ok('due pagamenti uguali, un movimento a mano: il primo lo prende, il secondo entra nuovo', conti(d5) + ' ' + di(d5, (x) => esitoDi(x, 'E1') + ' ' + esitoDi(x, 'E2') + ' ' + x.movimenti.length), '1/0/0/1/0/1 a_mano/- scritto/- 2')
  ok('…il segno del movimento a mano è del primo', di(d5, (x) => x.movimenti.find((m) => m.id === 'm1').satispayId), 'E1')

  console.log('  — giorno chiuso e prima della cassa')
  const ch = [chiusura('sa', '2026-10-15')]
  const g1 = applica(dati([inc('G1', 1250, '2026-10-14T10:00:00Z')], { chiusure: ch }))
  ok('giorno chiuso: da decidere, nessun movimento', conti(g1) + ' ' + di(g1, (x) => esitoDi(x, 'G1') + ' ' + x.movimenti.length), '0/0/0/0/1/0 da_decidere/giorno_chiuso 0')
  ok('un giorno dopo la chiusura entra', conti(applica(dati([inc('G2', 100, '2026-10-16T10:00:00Z')], { chiusure: ch }))), '1/0/0/0/0/1')
  const g3 = applica(dati([neg('G3', 'REFUND_TO_BUSINESS', 'ACCEPTED', 100, '2026-10-15T10:00:00Z', 'Via')], { chiusure: ch }))
  ok('anche un rimborso in un giorno chiuso aspetta', conti(g3), '0/0/0/0/1/0')
  const g4 = applica(dati([inc('G4', 4200, '2026-10-12T10:00:00Z')], { chiusure: ch, movimenti: [man('m1', '2026-10-12', 4200, 'cc')] }))
  ok('un doppione certo in un giorno chiuso è a_mano', conti(g4) + ' ' + di(g4, (x) => esitoDi(x, 'G4')), '0/0/0/1/0/0 a_mano/-')
  const b1 = applica(dati([inc('B1', 900, '2026-08-20T10:00:00Z', 'Vecchio')]))
  ok('prima dell\'inizio del Conto Corrente: fuori, nessun movimento', conti(b1) + ' ' + di(b1, (x) => esitoDi(x, 'B1') + ' ' + x.movimenti.length), '0/0/0/0/0/0 fuori/prima_della_cassa 0')
  ok('…e nei conti conta «prima»', di(b1, (x) => x.conti.prima), 1)

  console.log('  — già scritto in PAGAMENTI col metodo Satispay (fatto in palestra col QR)')
  const pg = (data, importo, metodo = 'Satispay', annullato = false) => ({ data, importo, metodo, annullato })
  const q1 = applica(dati([inc('Q1', 1250, '2026-10-14T10:00:00Z', 'Palestra')], { pagamenti: [pg('2026-10-14', 1250)] }))
  ok('stesso giorno e importo: già scritto, nessun movimento', conti(q1) + ' ' + di(q1, (x) => esitoDi(x, 'Q1') + ' ' + x.movimenti.length + ' ' + x.conti.pagamenti), '0/0/0/0/0/0 pagamenti/- 0 1')
  ok('…il metodo senza badare a maiuscole e spazi', di(applica(dati([inc('Q2', 1250, '2026-10-14T10:00:00Z')], { pagamenti: [pg('2026-10-14', 1250, ' SATISPAY ')] })), (x) => esitoDi(x, 'Q2')), 'pagamenti/-')
  ok('…anche prima del 1° ottobre (allora era nel Conto Corrente)', di(applica(dati([inc('Q3', 900, '2026-09-20T10:00:00Z')], { pagamenti: [pg('2026-09-20', 900)] })), (x) => esitoDi(x, 'Q3')), 'pagamenti/-')
  ok('un pagamento annullato non conta: movimento nuovo', di(applica(dati([inc('Q4', 1250, '2026-10-14T10:00:00Z')], { pagamenti: [pg('2026-10-14', 1250, 'Satispay', true)] })), (x) => esitoDi(x, 'Q4')), 'scritto/-')
  ok('un altro metodo non conta', di(applica(dati([inc('Q5', 1250, '2026-10-14T10:00:00Z')], { pagamenti: [pg('2026-10-14', 1250, 'POS')] })), (x) => esitoDi(x, 'Q5')), 'scritto/-')
  ok('un altro giorno o importo non conta', di(applica(dati([inc('Q6', 1250, '2026-10-14T10:00:00Z')], { pagamenti: [pg('2026-10-13', 1250), pg('2026-10-14', 1200)] })), (x) => esitoDi(x, 'Q6')), 'scritto/-')
  const q7 = applica(dati([inc('Q7', 1250, '2026-10-14T09:00:00Z', 'Primo'), inc('Q8', 1250, '2026-10-14T11:00:00Z', 'Secondo')], { pagamenti: [pg('2026-10-14', 1250)] }))
  ok('due pagamenti uguali, uno in PAGAMENTI: il primo è già scritto, il secondo entra', di(q7, (x) => esitoDi(x, 'Q7') + ' ' + esitoDi(x, 'Q8') + ' ' + x.movimenti.length), 'pagamenti/- scritto/- 1')
  const q9 = di(q7, (x) => applica(ripassa(x, { negozio: [...x.negozio, inc('Q9', 1250, '2026-10-14T12:00:00Z', 'Terzo')], pagamenti: [pg('2026-10-14', 1250)] })))
  ok('…al giro dopo la riga di PAGAMENTI è già presa: il terzo entra', di(q9, (x) => esitoDi(x, 'Q9')), 'scritto/-')
  const q10 = applica(dati([inc('Q10', 1250, '2026-10-14T10:00:00Z')], { pagamenti: [pg('2026-10-14', 1250)], movimenti: [man('m1', '2026-10-14', 1250, 'cc')] }))
  ok('PAGAMENTI viene prima di un movimento a mano uguale: quello resta senza segno', di(q10, (x) => esitoDi(x, 'Q10') + ' ' + (x.movimenti[0].satispayId ?? '-')), 'pagamenti/- -')
  const rq = applica(dati([neg('Q11', 'REFUND_TO_BUSINESS', 'ACCEPTED', 1250, '2026-10-14T10:00:00Z', 'Via')], { pagamenti: [pg('2026-10-14', 1250)] }))
  ok('un rimborso non guarda PAGAMENTI: è un\'uscita', di(rq, (x) => esitoDi(x, 'Q11')), 'scritto/-')

  console.log('  — i pagamenti di oggi aspettano domani: una registrazione in palestra dello stesso giorno vince')
  const og = applica(dati([inc('O1', 1250, `${OGGI}T08:00:00Z`, 'Stamattina')]))
  ok('oggi: resta senza esito, nessun movimento', conti(og) + ' ' + di(og, (x) => esitoDi(x, 'O1') + ' ' + x.movimenti.length), '0/0/0/0/0/0 senza esito/- 0')
  const og2 = di(og, (x) => applica(ripassa(x, { oggi: '2026-10-23', pagamenti: [pg(OGGI, 1250)] })))
  ok('…domani, registrato in PAGAMENTI nel frattempo: già scritto', di(og2, (x) => esitoDi(x, 'O1')), 'pagamenti/-')

  console.log('  — anteprima (R10)')
  const base = dati(
    [
      inc('N1', 1250, '2026-10-14T10:00:00Z', 'A mano'), inc('N2', 800, '2026-10-16T10:00:00Z', 'Nuovo'), inc('AM', 5000, '2026-10-13T10:00:00Z', 'Modulo'),
      inc('N4', 3000, '2026-10-10T10:00:00Z', 'Chiuso'), neg('N5', 'REFUND_TO_BUSINESS', 'ACCEPTED', 200, '2026-10-17T10:00:00Z', 'Rimborso'),
      inc('N6', 400, '2026-10-17T10:00:00Z', 'Attesa', 'PENDING'),
    ],
    { modulo: ['AM'], chiusure: [chiusura('sa', '2026-10-12')], movimenti: [man('m1', '2026-10-14', 1250, 'cc')] },
  )
  const prima = JSON.stringify(base)
  const ante = applica(base, false)
  const vero = applica(base, true)
  ok('l\'anteprima dà i conti', conti(ante), '1/1/1/1/1/2')
  ok('…e applica(true) gli stessi', conti(vero), '1/1/1/1/1/2')
  ok('…l\'anteprima non cambia movimenti, esiti e segni (nuovi array, dati invariati)', typeof ante === 'object' && JSON.stringify(base) === prima, true)
  ok('…nemmeno nell\'uscita: movimenti e negozio come prima', JSON.stringify([ante.movimenti, ante.negozio]), JSON.stringify([base.movimenti, base.negozio]))
  ok('…mentre applica(true) li cambia', typeof vero === 'object' && JSON.stringify(vero.movimenti) !== JSON.stringify(base.movimenti), true)
}

console.log('\n5. la commissione di Satispay (giroconto con meno soldi di quelli incassati)')
{
  const SA = 'sa'
  let n = 0
  const mv = (tipo, data, importo, extra = {}) => ({
    id: `r${n++}`, origine: 'movimento', tipo, data, importo, descrizione: 'x', voce: null, cassaId: SA, annullato: false, ...extra,
  })
  // 31 entrate dal 13 al 19 (30 da 13,00 e una da 25,00) e un rimborso da 5,00: 410,00.
  const pagamenti = Array.from({ length: 31 }, (_, i) =>
    mv('entrata', `2026-10-${String(13 + (i % 7)).padStart(2, '0')}`, i === 0 ? 2500 : 1300, { satispayId: `p${i}` }),
  )
  const rimborso = mv('uscita', '2026-10-15', 500, { satispayId: 'rimb' })
  const righe = [
    mv('giroconto', '2026-10-13', 10000, { cassaAId: 'cc' }), // il giroconto precedente: fissa «dal»
    mv('entrata', '2026-10-12', 9999, { satispayId: 'vecchio' }), // prima del giroconto: non conta
    mv('uscita', '2026-10-14', 300, {}), // la commissione precedente: senza satispayId
    mv('entrata', '2026-10-16', 99999, { satispayId: 'annullato', annullato: true }),
    mv('entrata', '2026-10-16', 77777, { satispayId: 'altra-cassa', cassaId: 'cc' }),
    ...pagamenti,
    rimborso,
  ]
  const giro = (arrivato, rr = righe) => prova(() => s.commissioneSatispay(rr, SA, '2026-10-20', arrivato))
  const campi = (r) => (r && typeof r === 'object' ? { dal: r.dal, al: r.al, incassato: r.incassato, pagamenti: r.pagamenti, rimborsi: r.rimborsi, commissione: r.commissione } : r)
  ok('410,00 incassati, 404,30 arrivati: commissione 5,70 dal 13 al 19', campi(giro(40430)), { dal: '2026-10-13', al: '2026-10-19', incassato: 41000, pagamenti: 31, rimborsi: 1, commissione: 570 })
  ok('arrivato uguale: non è una commissione', giro(41000), null)
  ok('arrivato maggiore: nemmeno', giro(42000), null)
  ok('arrivato zero: sarebbe tutto commissione, non lo è', giro(0), null)
  ok('senza giroconto precedente, «dal» è l\'inizio della cassa', giro(40430, righe.filter((r) => r.tipo !== 'giroconto'))?.dal, '2026-10-01')
  const prima = [...righe, mv('giroconto', '2026-10-05', 5000, { cassaAId: 'cc' })]
  ok('con due giroconti precedenti conta l\'ultimo', giro(40430, prima)?.dal, '2026-10-13')
  // Un pagamento del modulo col metodo Satispay entra nella cassa Satispay (cassaDelMetodo): anche lui fa la commissione.
  const conModulo = [...righe, mv('entrata', '2026-10-17', 5000, { origine: 'ricevuta' }), mv('entrata', '2026-10-18', 1000, { origine: 'pagamento' })]
  ok('i pagamenti di PAGAMENTI nella cassa Satispay contano', campi(giro(46430, conModulo)), { dal: '2026-10-13', al: '2026-10-19', incassato: 47000, pagamenti: 33, rimborsi: 1, commissione: 570 })
}

console.log('\n5b. la commissione è un movimento a parte, dopo il giroconto (spesaCommissione)')
{
  const c = { dal: '2026-10-13', al: '2026-10-19', incassato: 41000, pagamenti: 31, rimborsi: 1, commissione: 570 }
  const vc = [{ id: 'vcb', nome: 'Commissioni bancarie', tipo: 'uscita', diSistema: false, attiva: true }]
  ok('un\'uscita «Commissioni bancarie» dalla cassa Satispay, il giorno del versamento',
    prova(() => { const x = s.spesaCommissione(c, 'sa', '2026-10-20', vc); return [x.tipo, x.data, x.importo, x.cassaId, x.voceId, x.descrizione] }),
    ['uscita', '2026-10-20', 570, 'sa', 'vcb', 'Commissione Satispay · dal 13/10 al 19/10'])
  ok('senza la voce «Commissioni bancarie»: un errore che dice cosa fare', prova(() => s.spesaCommissione(c, 'sa', '2026-10-20', [])), 'ERRORE: Manca la voce «Commissioni bancarie»: aggiungila in CONTABILITÀ → VOCI e scrivi la commissione a mano')
}

console.log('\n6. i pagamenti da decidere: come satispay_decidi e satispay_scarico_stato')
{
  const ch = [chiusura('sa', '2026-10-18')]
  const negozio = [
    { ...inc('G1', 2500, '2026-10-18T10:00:00Z', 'Giulia R.'), esito: 'da_decidere', motivo: 'giorno_chiuso' },
    { ...inc('F1', 2500, '2026-10-20T10:00:00Z', 'Paolo T.'), esito: 'da_decidere', motivo: 'forse_doppione', candidati: ['m1', 'm2'] },
    { ...inc('S1', 900, '2026-10-19T10:00:00Z', 'Già'), esito: 'scritto' },
  ]
  const movimenti = [man('m1', '2026-10-20', 2500, 'cc'), man('m2', '2026-10-20', 2500, 'sa', { creatoIl: '2026-10-20T11:00:00Z' })]
  const base = dati(negozio, { chiusure: ch, movimenti })
  const elenco = prova(() => s.daDecidere(base))
  ok('l\'elenco: i due da decidere, dal più vecchio', di(elenco, (x) => x.map((d) => `${d.satispayId}|${d.motivo}|${d.data}|${d.chi}`)), ['G1|giorno_chiuso|2026-10-18|Giulia R.', 'F1|forse_doppione|2026-10-20|Paolo T.'])
  ok('…coi candidati: descrizione, voce, cassa, importo', di(elenco, (x) => x[1].candidati.map((c) => [c.id, c.descrizione, c.voce, c.cassa, c.importo].join('|'))), ['m1|A mano m1|Corsi e altri pagamenti|Conto Corrente|2500', 'm2|A mano m2|Corsi e altri pagamenti|Satispay|2500'])
  const decidi = (id, scelta, mov, d = base) => prova(() => s.decidiScarico(d, id, scelta, mov))

  const oggi = decidi('G1', 'oggi')
  ok('«Scrivilo oggi»: un movimento nuovo il 22, cassa Satispay', di(oggi, (x) => movDi(x, 'G1')), 'entrata|2026-10-22|2500|Satispay|Da classificare|Satispay · Giulia R.')
  ok('…ed è scritto', di(oggi, (x) => esitoDi(x, 'G1')), 'scritto/giorno_chiuso')
  ok('…i dati di partenza non cambiano', base.movimenti.length + ' ' + base.negozio[0].esito, '2 da_decidere')
  ok('«Lascialo fuori»: fuori, nessun movimento', di(decidi('G1', 'fuori'), (x) => esitoDi(x, 'G1') + ' ' + x.movimenti.length), 'fuori/giorno_chiuso 2')
  ok('«Scrivilo» il suo giorno, che è chiuso: no', decidi('G1', 'scrivi'), 'ERRORE: Quel giorno la cassa è chiusa: scrivilo oggi')

  const am = decidi('F1', 'a_mano', 'm2')
  ok('«È questo»: resta quello a mano, col segno', di(am, (x) => esitoDi(x, 'F1') + ' ' + x.movimenti.find((m) => m.id === 'm2').satispayId + ' ' + x.movimenti.length), 'a_mano/forse_doppione F1 2')
  ok('…un movimento che non è fra i proposti: no', decidi('F1', 'a_mano', 'altro'), 'ERRORE: Scegli uno dei movimenti proposti')
  const preso = dati(negozio, { chiusure: ch, movimenti: [movimenti[0], { ...movimenti[1], satispayId: 'X9' }] })
  ok('…uno già di un altro pagamento: no', decidi('F1', 'a_mano', 'm2', preso), 'ERRORE: Quel movimento non c’è più o è già di un altro pagamento: ricarica la pagina')
  ok('«Nessuno dei due: scrivilo» il suo giorno', di(decidi('F1', 'scrivi'), (x) => movDi(x, 'F1') + ' ' + x.movimenti.length), 'entrata|2026-10-20|2500|Satispay|Da classificare|Satispay · Paolo T. 3')
  ok('uno già deciso: no', decidi('S1', 'fuori'), 'ERRORE: Questo pagamento è già deciso')
  ok('uno che non c\'è: no', decidi('ZZ', 'fuori'), 'ERRORE: Il pagamento non c’è')
  ok('una scelta che non c\'è: no', decidi('G1', 'boh'), 'ERRORE: Scegli cosa fare del pagamento')
}

console.log('\n7. il segno DA SATISPAY arriva nelle righe dell\'elenco')
{
  const c = await carica("export * from './src/lib/contabilita'")
  const righe = prova(() => c.righeMovimenti([], [man('m1', '2026-10-20', 2500, 'sa', { satispayId: 'P1' }), man('m2', '2026-10-20', 100, 'sa')], voci))
  ok('con satispayId, e solo dove c\'è', di(righe, (x) => x.map((r) => r.satispayId ?? '-')), ['P1', '-'])
}

// La Edge Function legge con la stessa regola dell'app: pagine.ts è la parte <pagine> di src/lib/satispayScarico.ts.
{
  const { readFileSync } = await import('node:fs')
  const testo = (f) => { try { return readFileSync(f, 'utf8') } catch { return '' } }
  const lib = testo('src/lib/satispayScarico.ts')
  const parte = lib.slice(lib.indexOf('// <pagine>'), lib.indexOf('// </pagine>') + '// </pagine>'.length) + '\n'
  ok('pagine.ts è la copia della parte <pagine>', testo('supabase/functions/satispay-scarico/pagine.ts') === parte, true)
  const fn = testo('supabase/functions/satispay-scarico/index.ts')
  ok('la funzione usa la copia', fn.includes("from './pagine.ts'"), true)
  ok('la funzione scrive solo col negozio vero', fn.includes("'authservices.satispay.com'"), true)
}

if (guai) {
  console.log(`\n${guai} cose non tornano`)
  process.exit(1)
}
console.log('\nTutto a posto')
