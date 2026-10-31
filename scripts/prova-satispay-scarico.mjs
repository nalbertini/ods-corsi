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


console.log('\n2. leggere le pagine di Satispay (R8, R9)')
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
const casse = [
  { id: 'co', nome: 'Cassa Contanti', saldoIniziale: 0 },
  { id: 'cc', nome: 'Conto Corrente', saldoIniziale: 0, dal: '2026-09-01' },
  { id: 'sa', nome: 'Satispay', saldoIniziale: 0, dal: '2025-01-01' },
]
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
  console.log('  — un incasso non scrive niente: i soldi sono nel versamento in banca')
  const FUORI = 'fuori/nel_versamento'
  const nessuno = (r) => di(r, (x) => x.movimenti.length)
  const p1 = inc('P1', 1250, '2026-10-14T10:00:00Z', 'Mario Rossi')
  const r = applica(dati([p1]))
  ok('applica: un incasso (nel versamento), niente scritto, niente da decidere', conti(r), '1/0/0/0/0/0')
  ok('nessun movimento, né in Satispay né nel Conto Corrente', di(r, (x) => movDi(x, 'P1') + ' ' + nessuno(x)), 'nessuno 0')
  ok('esito fuori, motivo nel_versamento', di(r, (x) => esitoDi(x, 'P1')), FUORI)
  const r2 = di(r, (x) => applica(ripassa(x)))
  ok('applica di fila: niente di nuovo, ancora nessun movimento', conti(r2) + ' ' + di(r2, (x) => nessuno(x) + ' ' + esitoDi(x, 'P1')), '0/0/0/0/0/0 0 ' + FUORI)
  ok('senza nome: stesso esito, nessun movimento', di(applica(dati([inc('P2', 300, '2026-10-15T09:00:00Z', null)])), (x) => esitoDi(x, 'P2') + ' ' + nessuno(x)), FUORI + ' 0')
  ok('di qualunque data (20 settembre, 15 novembre): nessun movimento', di(applica(dati([inc('P3', 2000, '2026-09-20T10:00:00Z', 'Sara'), inc('P5', 700, '2026-11-15T10:00:00Z', 'Lia')], { oggi: '2026-11-20' })), (x) => conti(x) + ' ' + nessuno(x)), '2/0/0/0/0/0 0')

  console.log('  — PENDING aspetta, CANCELED non entra mai')
  const w = applica(dati([inc('W1', 1000, '2026-10-14T10:00:00Z', 'Attesa', 'PENDING')]))
  ok('PENDING: resta senza esito', di(w, (x) => esitoDi(x, 'W1') + ' ' + nessuno(x)), 'senza esito/- 0')
  const w2 = di(w, (x) => applica(ripassa(x, { negozio: x.negozio.map((n) => ({ ...n, stato: 'ACCEPTED', importo: 1100 })) })))
  ok('…poi ACCEPTED: fuori, nessun movimento', di(w2, (x) => esitoDi(x, 'W1') + ' ' + nessuno(x)), FUORI + ' 0')
  const c = applica(dati([inc('C1', 700, '2026-10-14T10:00:00Z', 'Annullato', 'CANCELED')]))
  ok('CANCELED: nessun esito, nessun movimento', di(c, (x) => esitoDi(x, 'C1') + ' ' + nessuno(x)), 'senza esito/- 0')

  console.log('  — un rimborso non diventa un\'uscita')
  const rf = applica(dati([neg('R1', 'REFUND_TO_BUSINESS', 'ACCEPTED', 500, '2026-10-16T10:00:00Z', 'Mario Rossi')]))
  ok('un rimborso nel versamento, nessuna uscita', conti(rf) + ' ' + di(rf, (x) => nessuno(x)), '0/1/0/0/0/0 0')
  ok('esito fuori/nel_versamento', di(rf, (x) => esitoDi(x, 'R1')), FUORI)

  console.log('  — il pagamento del modulo')
  const mo = applica(dati([inc('M1', 5000, '2026-10-14T10:00:00Z', 'Paolo')], { modulo: ['M1'] }))
  ok('esito modulo, nessun movimento', conti(mo) + ' ' + di(mo, (x) => esitoDi(x, 'M1') + ' ' + nessuno(x)), '0/0/1/0/0/0 modulo/- 0')

  console.log('  — un movimento a mano uguale non prende più il segno (nessun collegamento nuovo)')
  const d1 = applica(dati([inc('D1', 1250, '2026-10-14T10:00:00Z')], { movimenti: [man('m1', '2026-10-14', 1250, 'sa')] }))
  ok('uno solo uguale: non a_mano, fuori/nel_versamento', conti(d1) + ' ' + di(d1, (x) => esitoDi(x, 'D1') + ' ' + nessuno(x)), '1/0/0/0/0/0 ' + FUORI + ' 1')
  ok('…e il movimento a mano resta senza segno', di(d1, (x) => x.movimenti[0].satispayId ?? '-'), '-')
  const d2 = applica(dati([inc('D2', 1250, '2026-10-14T10:00:00Z')], { movimenti: [man('m1', '2026-10-14', 1250, 'sa'), man('m2', '2026-10-14', 1250, 'sa')] }))
  ok('due uguali: non da decidere, nessun segno', conti(d2) + ' ' + di(d2, (x) => esitoDi(x, 'D2') + ' ' + x.movimenti.filter((m) => m.satispayId).length), '1/0/0/0/0/0 ' + FUORI + ' 0')
  const cc4 = ['c1', 'c2', 'c3', 'c4'].map((id) => man(id, '2026-08-31', 5000, 'cc'))
  const d6 = applica(dati([inc('K1', 5000, '2026-08-31T10:00:00Z', 'Reale')], { movimenti: cc4 }))
  ok('4 entrate a mano uguali in Conto Corrente: nessun movimento nuovo, nessun segno', conti(d6) + ' ' + di(d6, (x) => esitoDi(x, 'K1') + ' ' + x.movimenti.length + ' ' + x.movimenti.filter((m) => m.satispayId).length), '1/0/0/0/0/0 ' + FUORI + ' 4 0')
  const d4 = applica(dati([inc('D4', 1250, '2026-10-14T10:00:00Z')], { movimenti: [man('m1', '2026-10-14', 1250, 'co')] }))
  ok('Cassa Contanti: nessun movimento nuovo', di(d4, (x) => nessuno(x)), 1)
  const an = applica(
    dati([{ ...inc('A1', 1250, '2026-10-14T10:00:00Z', 'Mario'), esito: 'scritto' }], {
      movimenti: [man('mv', '2026-10-14', 1250, 'sa', { satispayId: 'A1', annullatoIl: '2026-10-15T10:00:00Z' })],
    }),
  )
  ok('annullato resta annullato: niente di nuovo', conti(an) + ' ' + di(an, (x) => x.movimenti.length), '0/0/0/0/0/0 1')

  console.log('  — giorno chiuso e prima della cassa: stesso esito, mai da decidere')
  const ch = [chiusura('sa', '2026-10-15')]
  const g1 = applica(dati([inc('G1', 1250, '2026-10-14T10:00:00Z')], { chiusure: ch }))
  ok('giorno chiuso: non da decidere, nessun movimento', conti(g1) + ' ' + di(g1, (x) => esitoDi(x, 'G1') + ' ' + nessuno(x)), '1/0/0/0/0/0 ' + FUORI + ' 0')
  ok('un rimborso in un giorno chiuso: lo stesso', di(applica(dati([neg('G3', 'REFUND_TO_BUSINESS', 'ACCEPTED', 100, '2026-10-15T10:00:00Z', 'Via')], { chiusure: ch })), (x) => esitoDi(x, 'G3')), FUORI)
  ok('un giorno dopo la chiusura: nessun movimento', di(applica(dati([inc('G2', 100, '2026-10-16T10:00:00Z')], { chiusure: ch })), nessuno), 0)
  const b1 = applica(dati([inc('B1', 900, '2024-12-20T10:00:00Z', 'Vecchio')]))
  ok('prima dell\'inizio della cassa: nessun movimento, il motivo non è prima_della_cassa', di(b1, (x) => esitoDi(x, 'B1') + ' ' + nessuno(x)), FUORI + ' 0')

  console.log('  — già scritto in PAGAMENTI col metodo Satispay (fatto in palestra col QR)')
  const pg = (data, importo, metodo = 'Satispay', annullato = false) => ({ data, importo, metodo, annullato })
  const q1 = applica(dati([inc('Q1', 1250, '2026-10-14T10:00:00Z', 'Palestra')], { pagamenti: [pg('2026-10-14', 1250)] }))
  ok('stesso giorno e importo: pagamenti, nessun movimento', conti(q1) + ' ' + di(q1, (x) => esitoDi(x, 'Q1') + ' ' + nessuno(x) + ' ' + x.conti.pagamenti), '0/0/0/0/0/0 pagamenti/- 0 1')
  ok('…il metodo senza badare a maiuscole e spazi', di(applica(dati([inc('Q2', 1250, '2026-10-14T10:00:00Z')], { pagamenti: [pg('2026-10-14', 1250, ' SATISPAY ')] })), (x) => esitoDi(x, 'Q2')), 'pagamenti/-')
  ok('…anche prima del 1° ottobre', di(applica(dati([inc('Q3', 900, '2026-09-20T10:00:00Z')], { pagamenti: [pg('2026-09-20', 900)] })), (x) => esitoDi(x, 'Q3')), 'pagamenti/-')
  ok('un pagamento annullato non conta: fuori/nel_versamento', di(applica(dati([inc('Q4', 1250, '2026-10-14T10:00:00Z')], { pagamenti: [pg('2026-10-14', 1250, 'Satispay', true)] })), (x) => esitoDi(x, 'Q4')), FUORI)
  ok('un altro metodo non conta', di(applica(dati([inc('Q5', 1250, '2026-10-14T10:00:00Z')], { pagamenti: [pg('2026-10-14', 1250, 'POS')] })), (x) => esitoDi(x, 'Q5')), FUORI)
  const q7 = applica(dati([inc('Q7', 1250, '2026-10-14T09:00:00Z', 'Primo'), inc('Q8', 1250, '2026-10-14T11:00:00Z', 'Secondo')], { pagamenti: [pg('2026-10-14', 1250)] }))
  ok('due pagamenti uguali, uno in PAGAMENTI: il primo pagamenti, il secondo fuori, nessun movimento', di(q7, (x) => esitoDi(x, 'Q7') + ' ' + esitoDi(x, 'Q8') + ' ' + nessuno(x)), 'pagamenti/- ' + FUORI + ' 0')
  const rq = applica(dati([neg('Q11', 'REFUND_TO_BUSINESS', 'ACCEPTED', 1250, '2026-10-14T10:00:00Z', 'Via')], { pagamenti: [pg('2026-10-14', 1250)] }))
  ok('un rimborso non guarda PAGAMENTI', di(rq, (x) => esitoDi(x, 'Q11')), FUORI)

  console.log('  — i pagamenti di oggi aspettano domani: una registrazione in palestra dello stesso giorno vince')
  const og = applica(dati([inc('O1', 1250, `${OGGI}T08:00:00Z`, 'Stamattina')]))
  ok('oggi: resta senza esito, nessun movimento', conti(og) + ' ' + di(og, (x) => esitoDi(x, 'O1') + ' ' + nessuno(x)), '0/0/0/0/0/0 senza esito/- 0')
  const og2 = di(og, (x) => applica(ripassa(x, { oggi: '2026-10-23', pagamenti: [pg(OGGI, 1250)] })))
  ok('…domani, registrato in PAGAMENTI nel frattempo: pagamenti', di(og2, (x) => esitoDi(x, 'O1')), 'pagamenti/-')

  console.log('  — anteprima')
  const base = dati(
    [
      inc('N1', 1250, '2026-10-14T10:00:00Z', 'A mano'), inc('N2', 800, '2026-10-16T10:00:00Z', 'Nuovo'), inc('AM', 5000, '2026-10-13T10:00:00Z', 'Modulo'),
      inc('N4', 3000, '2026-10-10T10:00:00Z', 'Chiuso'), neg('N5', 'REFUND_TO_BUSINESS', 'ACCEPTED', 200, '2026-10-17T10:00:00Z', 'Rimborso'),
      inc('N6', 400, '2026-10-17T10:00:00Z', 'Attesa', 'PENDING'),
    ],
    { modulo: ['AM'], chiusure: [chiusura('sa', '2026-10-12')], movimenti: [man('m1', '2026-10-14', 1250, 'sa')] },
  )
  const prima = JSON.stringify(base)
  const ante = applica(base, false)
  const vero = applica(base, true)
  ok('l\'anteprima dà i conti: tre incassi e un rimborso nel versamento, un modulo', conti(ante), '3/1/1/0/0/0')
  ok('…e applica(true) gli stessi', conti(vero), '3/1/1/0/0/0')
  ok('…l\'anteprima non cambia movimenti, esiti e segni', typeof ante === 'object' && JSON.stringify(base) === prima, true)
  ok('…nemmeno nell\'uscita: movimenti e negozio come prima', JSON.stringify([ante.movimenti, ante.negozio]), JSON.stringify([base.movimenti, base.negozio]))
  ok('applica(true) non cambia i movimenti: né nuovi né col segno', typeof vero === 'object' && JSON.stringify(vero.movimenti) === JSON.stringify(base.movimenti), true)
  ok('…e nessun pagamento è scritto o da decidere', di(vero, (x) => x.negozio.filter((n) => n.esito === 'scritto' || n.esito === 'da_decidere').length), 0)
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
  ok('finito lo scarico avvisa la segreteria, coi conti o con l\'errore', fn.includes("rpc('satispay_scarico_avvisa', { conti, errore })"), true)
  ok('…anche quando Satispay non risponde o i movimenti non si scrivono', fn.includes('await fine(esito.errore)') && fn.includes('await fine(errore)') && fn.includes('await fine(null, conti.data)'), true)
  const guardia = fn.indexOf('if (anteprima) return')
  ok('…ma l\'anteprima no: la guardia viene prima dell\'avviso', guardia > -1 && guardia < fn.indexOf("rpc('satispay_scarico_avvisa'"), true)
}

if (guai) {
  console.log(`\n${guai} cose non tornano`)
  process.exit(1)
}
console.log('\nTutto a posto')
