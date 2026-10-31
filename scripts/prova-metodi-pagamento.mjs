// ---------------------------------------------------------------------------
// I metodi di pagamento che la segreteria accende e spegne, senza browser.
//
//   node scripts/prova-metodi-pagamento.mjs
//
// Controlla `src/lib/metodiPagamento.ts` e dove i metodi spenti spariscono
// dalle scelte (`metodiRicevuta`), e la modalità prova che li salva.
// ---------------------------------------------------------------------------
import { build } from 'esbuild'

const memoria = new Map()
globalThis.localStorage = {
  getItem: (k) => (memoria.has(k) ? memoria.get(k) : null),
  setItem: (k, v) => memoria.set(k, String(v)),
  removeItem: (k) => memoria.delete(k),
}
globalThis.window = { location: { search: '', hash: '' }, addEventListener() {} }

const { outputFiles } = await build({
  stdin: {
    contents: "export * from './src/lib/metodiPagamento'; export { metodiRicevuta, modoPagamento, cosaNonVaModo } from './src/lib/satispay'; export { METODI_A_MANO } from './src/lib/pagamenti'; export { creaSegreteriaProva } from './src/lib/segreteriaProva'; export { creaRichiesteProva } from './src/lib/richiesteProva'; export { creaIscrittoProva } from './src/lib/iscrittoProva'; export { SATISPAY_SPENTO, CARTA_SPENTA } from './src/lib/satispay'; export { SALDO_SPENTO } from './src/lib/saldoSatispay'; export { QUOTA_SPENTA } from './src/lib/quotaSatispay'; export { CORSO_SPENTO } from './src/lib/corsoSatispay'",
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

console.log('1. quali metodi ci sono')
ok('sei metodi, nell\'ordine della pagina', m.METODI_PAGAMENTO.map((x) => x.id), ['satispay', 'carta', 'bonifico', 'contanti', 'pos', 'assegno'])

console.log('2. cosa è spento')
ok('niente spento: tutti accesi', ['Satispay', 'Carta', 'Bonifico', 'Contanti', 'POS', 'Assegno'].map((n) => m.acceso([], n)), [true, true, true, true, true, true])
ok('si riconosce il nome delle ricevute (maiuscole comprese)', [m.acceso(['pos'], 'POS'), m.acceso(['pos'], 'Contanti')], [false, true])
ok('un nome che non è nell\'elenco (storico, import) resta acceso', m.acceso(['pos'], 'Paypal'), true)
ok('da una riga del database restano solo gli id veri, una volta', m.spentiDa(['pos', 'pos', 'bitcoin', 3, null]), ['pos'])
ok('da un valore che non è un elenco, niente spento', [m.spentiDa(null), m.spentiDa('pos'), m.spentiDa(undefined)], [[], [], []])
ok('spegnere e riaccendere', [m.cambiaSpento([], 'pos', false), m.cambiaSpento(['pos', 'carta'], 'pos', true), m.cambiaSpento(['pos'], 'pos', false)], [['pos'], ['carta'], ['pos']])

console.log('3. le scelte')
ok('un metodo spento sparisce dalla scelta', m.accesi(['Bonifico', 'Contanti', 'POS'], ['contanti']), ['Bonifico', 'POS'])
ok('quello già scritto su un pagamento resta, anche spento', m.accesi(['Bonifico', 'Contanti', 'POS'], ['contanti'], 'Contanti'), ['Bonifico', 'Contanti', 'POS'])
ok('PAGATO CON della ricevuta senza i metodi spenti', m.metodiRicevuta(undefined, undefined, ['pos', 'assegno']), ['Bonifico', 'Contanti'])
ok('un pagamento Satispay già arrivato resta fra le scelte, Satispay spento', m.metodiRicevuta({}, undefined, ['satispay']), ['Bonifico', 'Contanti', 'POS', 'Assegno', 'Satispay'])
ok('senza spenti nulla cambia', m.metodiRicevuta(undefined, 'Satispay'), ['Bonifico', 'Contanti', 'POS', 'Assegno', 'Satispay'])

console.log('4. la modalità prova li salva')
{
  const s = m.creaSegreteriaProva()
  ok('all\'inizio niente è spento', (await s.impostazioni()).metodiSpenti ?? [], [])
  await s.salvaImpostazioni({ metodiSpenti: ['pos', 'carta'] })
  ok('spenti, restano spenti', (await s.impostazioni()).metodiSpenti, ['pos', 'carta'])
  ok('e il resto delle impostazioni è intatto', (await s.impostazioni()).mesiPresenze, 24)
  await s.salvaImpostazioni({ metodiSpenti: [] })
  ok('riaccesi', (await s.impostazioni()).metodiSpenti, [])
}

// L'ultimo metodo acceso non si spegne: la segreteria non potrebbe più registrare un pagamento.
{
  const sei = m.METODI_PAGAMENTO.map((x) => x.id)
  const cinque = sei.filter((x) => x !== 'pos')
  ok('l\'ultimo acceso resta acceso', m.cambiaSpento(cinque, 'pos', false), cinque)
  ok('con un altro acceso si spegne', m.cambiaSpento(sei.filter((x) => x !== 'pos' && x !== 'carta'), 'pos', false).includes('pos'), true)
}

// Con un metodo spento la modalità prova rifiuta come le Edge Function (richiesteSupabase, iscrittoSupabase).
{
  const s = m.creaSegreteriaProva()
  await s.salvaImpostazioni({ metodiSpenti: ['satispay', 'carta'] })
  const rifiuta = async (f) => { try { await f(); return null } catch (e) { return e.message } }
  const r = m.creaRichiesteProva()
  const i = m.creaIscrittoProva()
  ok('Satispay spento: non si prepara', await rifiuta(() => r.prepara({})), m.SATISPAY_SPENTO)
  ok('carta spenta: non si prepara', await rifiuta(() => r.prepara({}, 'carta')), m.CARTA_SPENTA)
  ok('Satispay spento: saldo, quota e corso non si pagano', [await rifiuta(() => i.pagaSaldo('x', 'y')), await rifiuta(() => i.pagaQuota('x')), await rifiuta(() => i.pagaCorso('x', 'y'))], [m.SALDO_SPENTO, m.QUOTA_SPENTA, m.CORSO_SPENTO])
  await s.salvaImpostazioni({ metodiSpenti: [] })
}

// Il modulo pubblico con il bonifico spento: senza Satispay né carta non c'è un modo da scegliere.
{
  const senza = { pronto: false, giaPagato: false }
  ok('bonifico spento e Satispay non possibile: nessun modo', m.modoPagamento('satispay', { satispay: false }, false, false), null)
  ok('bonifico scelto prima che si sappia che è spento: nessun modo', m.modoPagamento('bonifico', { satispay: false }, false, false), null)
  ok('bonifico acceso: Satispay non possibile ricade sul bonifico', m.modoPagamento('satispay', { satispay: false }, false), 'bonifico')
  ok('senza modi da scegliere il modulo parte', m.cosaNonVaModo(null, false, false, senza, false, false), null)
  ok('con un modo da scegliere, scegliere si deve', typeof m.cosaNonVaModo(null, false, false, senza, false, true), 'string')
}

if (guai) {
  console.log(`\n${guai} da correggere`)
  process.exit(1)
}
console.log('\nTutto a posto')
