// ---------------------------------------------------------------------------
// La Edge Function `paypal`, la cattura: oltre i 30 minuti non si incassa, il
// no di PayPal si legge dall'ordine riletto. Senza browser e senza rete: la
// decisione sta in `supabase/functions/paypal/cattura.ts`, che riceve da fuori
// PayPal e il database (qui finti, e si contano le chiamate).
//
//   node scripts/prova-paypal-cattura.mjs
// ---------------------------------------------------------------------------
import { build } from 'esbuild'

const { outputFiles } = await build({
  entryPoints: ['supabase/functions/paypal/cattura.ts'],
  bundle: true,
  format: 'esm',
  platform: 'node',
  write: false,
  logLevel: 'silent',
})
const { catturaOrdine } = await import('data:text/javascript;base64,' + Buffer.from(outputFiles[0].text).toString('base64'))

let guai = 0
const ok = (cosa, avuto, voluto) => {
  const va = JSON.stringify(avuto) === JSON.stringify(voluto)
  console.log(va ? '  ✓' : '  ✗', cosa, va ? '' : `— atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`)
  if (!va) guai++
}

const creato = '2026-10-20T10:00:00Z'
const alle = (mm) => new Date(`2026-10-20T10:${mm}:00Z`)
const PAGAMENTO = '11111111-1111-4111-8111-111111111111'

// PayPal e il database finti: `cattura` è la risposta alla POST /capture, `riletto` quella al GET dell'ordine.
const mondo = ({ cattura, riletto = null, scrive = true }) => {
  const m = { catture: [], riletture: 0, scritti: [] }
  m.dip = {
    cattura: async (ordine, idempotenza) => (m.catture.push({ ordine, idempotenza }), cattura),
    rileggi: async () => (m.riletture++, riletto),
    scrivi: async (ordine, stato) => (m.scritti.push({ ordine, stato }), scrive ? { stato, importo: 23000, pagato_il: stato === 'pagato' ? 'ora' : null } : null),
  }
  return m
}
const lancia = (m, mm) => catturaOrdine({ creato_il: creato }, 'ORD1', PAGAMENTO, alle(mm), m.dip)

console.log('1. oltre i 30 minuti non si cattura')
{
  const m = mondo({ cattura: { status: 'COMPLETED', purchase_units: [{ payments: { captures: [{ status: 'COMPLETED' }] } }] } })
  const r = await lancia(m, '31')
  ok('PayPal non viene chiamato per catturare', m.catture.length, 0)
  ok('si scrive «non-andato»', m.scritti, [{ ordine: 'ORD1', stato: 'non-andato' }])
  ok('chi paga vede lo stato scritto', r, { errore: false, nuovo: { stato: 'non-andato', importo: 23000, pagato_il: null } })
  const t = mondo({ cattura: null, scrive: false })
  ok('scrittura fallita: nessun errore, chi paga vede com’era', await lancia(t, '31'), { errore: false, nuovo: null })
}

console.log('\n2. entro i 30 minuti si cattura')
{
  const m = mondo({ cattura: { status: 'COMPLETED', cattura: 'COMPLETED' } })
  const r = await lancia(m, '29')
  ok('una cattura, con la chiave che impedisce la doppia cattura', m.catture, [{ ordine: 'ORD1', idempotenza: `cattura-${PAGAMENTO}` }])
  ok('catturata: pagato', [r.errore, r.nuovo?.stato, m.scritti], [false, 'pagato', [{ ordine: 'ORD1', stato: 'pagato' }]])
  ok('con la risposta in mano non si rilegge', m.riletture, 0)
}

console.log('\n3. il rifiuto di PayPal (422) decide l’ordine riletto')
{
  const a = mondo({ cattura: 'rifiuto', riletto: { status: 'APPROVED' } })
  ok('carta rifiutata, ordine non catturato: non andato', (await lancia(a, '05')).nuovo?.stato, 'non-andato')
  const b = mondo({ cattura: 'rifiuto', riletto: { status: 'COMPLETED', cattura: 'COMPLETED' } })
  ok('già catturato (risposta persa): pagato, mai non andato', (await lancia(b, '05')).nuovo?.stato, 'pagato')
  ok('si è riletto una volta', b.riletture, 1)
  const c = mondo({ cattura: 'rifiuto', riletto: null })
  ok('rifiuto e ordine che non si rilegge: errore, niente scritto', [await lancia(c, '05'), c.scritti], [{ errore: true, nuovo: null }, []])
  const d = mondo({ cattura: null, riletto: { status: 'COMPLETED', cattura: 'COMPLETED' } })
  ok('PayPal non risponde, riletto catturato: pagato', (await lancia(d, '05')).nuovo?.stato, 'pagato')
  const e = mondo({ cattura: null, riletto: null })
  ok('PayPal non risponde e niente da rileggere: errore, niente scritto', [await lancia(e, '05'), e.scritti], [{ errore: true, nuovo: null }, []])
  const f = mondo({ cattura: { status: 'COMPLETED', cattura: 'COMPLETED' }, scrive: false })
  ok('pagato su PayPal ma non scritto: errore (chi paga riprova)', await lancia(f, '05'), { errore: true, nuovo: null })
}

if (guai) {
  console.log(`\n${guai} prove non passano`)
  process.exit(1)
}
console.log('\nTutte le prove passano')
