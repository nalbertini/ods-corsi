// ---------------------------------------------------------------------------
// La firma a schermo intero, senza browser: le regole pure di `src/lib/tratti.ts`.
//
//   node scripts/prova-firma-tratti.mjs
//
// I tratti fatti a schermo intero si portano nel riquadro piccolo (mai
// ingranditi, un solo fattore per x e y, centrati); lo spessore non si scala.
// ---------------------------------------------------------------------------
import { build } from 'esbuild'

const { outputFiles } = await build({
  stdin: {
    contents: "export { adattaTratti, daIsolare, firmaVera, limitaPunto, orientamento, altezzaVisibile, invitoGirare, rotazioneCancella, risultatoFatto, serveBack, trattoVero } from './src/lib/tratti'",
    resolveDir: '.',
    loader: 'ts',
  },
  bundle: true,
  format: 'esm',
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
const vicino = (a, b) => Math.abs(a - b) < 0.5
// Il rettangolo che contiene i punti, arrotondato al decimo.
const rett = (tratti) => {
  const p = tratti.flat()
  const xs = p.map((q) => q[0])
  const ys = p.map((q) => q[1])
  const r = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]
  return { x0: r[0], y0: r[1], x1: r[2], y1: r[3], w: r[2] - r[0], h: r[3] - r[1] }
}

const R = { w: 350, h: 170 }
// Un tratto che riempie il rettangolo (x, y, w, h), passando per i due angoli e uno in mezzo.
const tratto = (x, y, w, h) => [[x, y], [x + w / 2, y + h], [x + w, y + h / 2]]

console.log('\n1. un tratto più grande del riquadro')
{
  const grande = [tratto(100, 300, 700, 100)]
  const a = m.adattaTratti(grande, R.w, R.h)
  const b = rett(a)
  ok('il rettangolo sta nel riquadro', b.x0 >= -0.01 && b.y0 >= -0.01 && b.x1 <= R.w + 0.01 && b.y1 <= R.h + 0.01, true)
  ok('stesso rapporto di prima (7 a 1)', vicino(b.w / b.h, 7), true)
  ok('riempie la larghezza: 350', vicino(b.w, 350), true)
  ok('centrato in orizzontale', vicino(b.x0 + b.w / 2, R.w / 2), true)
  ok('centrato in verticale', vicino(b.y0 + b.h / 2, R.h / 2), true)
  ok('stessi punti di prima, uno per uno', a[0].length, 3)
  ok('i tratti di prima non si toccano', grande[0][0], [100, 300])
}

console.log('\n2. un tratto che nel riquadro ci sta')
{
  const a = m.adattaTratti([tratto(500, 600, 100, 40)], R.w, R.h)
  const b = rett(a)
  ok('non si ingrandisce: larghezza 100', vicino(b.w, 100), true)
  ok('non si ingrandisce: altezza 40', vicino(b.h, 40), true)
  ok('è solo centrato in orizzontale', vicino(b.x0 + b.w / 2, R.w / 2), true)
  ok('è solo centrato in verticale', vicino(b.y0 + b.h / 2, R.h / 2), true)
}

console.log('\n3. lo spessore')
{
  // Lo spessore non è nei tratti: la riduzione tocca solo le coordinate.
  const a = m.adattaTratti([tratto(0, 0, 1400, 200)], R.w, R.h)
  ok('i punti restano coppie [x, y]', a.flat().every((p) => p.length === 2), true)
  ok('un solo fattore: 1400x200 diventa 350x50', [vicino(rett(a).w, 350), vicino(rett(a).h, 50)], [true, true])
}

console.log('\n4. firmaVera sulla firma adattata')
{
  const vera = (t) => m.firmaVera(m.adattaTratti(t, R.w, R.h))
  ok('40x20 è un segnetto, non una firma', vera([[[10, 10], [50, 30]]]), false)
  ok('200x900 ridotta è larga meno di 40: non è una firma', vera([[[0, 0], [100, 900], [200, 0]]]), false)
  ok('200x40 è una firma', vera([[[0, 0], [100, 40], [200, 0]]]), true)
  ok('senza adattare, 200x900 sembrerebbe vera', m.firmaVera([[[0, 0], [100, 900], [200, 0]]]), true)
}

console.log('\n5. verticale o orizzontale')
{
  ok('390x844 e 844x390 sono diversi', m.orientamento(390, 844) !== m.orientamento(844, 390), true)
  ok('390x800 e 390x844 sono uguali: la barra del browser non conta', m.orientamento(390, 800), m.orientamento(390, 844))
  ok('390x844 è verticale', m.orientamento(390, 844), 'verticale')
  ok('844x390 è orizzontale', m.orientamento(844, 390), 'orizzontale')
}

console.log('\n6. un tocco non è un tratto')
{
  ok('un solo punto: non è un tratto', m.trattoVero([[10, 10]]), false)
  ok('due punti uguali: non è un tratto', m.trattoVero([[10, 10], [10, 10]]), false)
  ok('movimento di 3 px: non è un tratto', m.trattoVero([[10, 10], [12, 12], [11, 11]]), false)
  ok('movimento di 20 px: è un tratto', m.trattoVero([[10, 10], [30, 10]]), true)
  ok('va e torna lontano: è un tratto', m.trattoVero([[10, 10], [40, 10], [10, 10]]), true)
  ok('esattamente 6 px: ancora un tocco', m.trattoVero([[10, 10], [16, 10]]), false)
  ok('oltre 6 px: è un tratto', m.trattoVero([[10, 10], [16.1, 10]]), true)
}

console.log('\n7. il tasto FATTO')
{
  ok('un segnetto: spento', m.firmaVera(m.adattaTratti([[[10, 10], [50, 30]]], R.w, R.h)), false)
  ok('una firma: acceso', m.firmaVera(m.adattaTratti([[[0, 0], [100, 40], [200, 0]]], R.w, R.h)), true)
}

console.log('\n8. i punti non escono dal riquadro')
{
  ok('un punto dentro resta com\'è', m.limitaPunto([100.5, 50], R.w, R.h), [100.5, 50])
  ok('fuori a sinistra e in alto: sul bordo 0', m.limitaPunto([-12, -3], R.w, R.h), [0, 0])
  ok('fuori a destra e in basso: sul bordo opposto', m.limitaPunto([400, 999], R.w, R.h), [350, 170])
  ok('fuori solo su un asse: l\'altro non cambia', m.limitaPunto([-5, 80], R.w, R.h), [0, 80])
}

console.log('\n9. niente tratti, niente guai')
{
  ok('adattaTratti([]) è vuoto', m.adattaTratti([], R.w, R.h), [])
  ok('un tratto vuoto non rompe', m.adattaTratti([[]], R.w, R.h), [[]])
  ok('firmaVera([]) è spenta', m.firmaVera([]), false)
  ok('trattoVero([]) è falso', m.trattoVero([]), false)
  ok('riquadro senza misura: nessun NaN', m.adattaTratti([tratto(0, 0, 100, 50)], 0, 0).flat().every((p) => p.every(Number.isFinite)), true)
}

console.log('\n10. FATTO: cosa resta e se si chiama onTratti')
{
  const bozza = [[[0, 0], [300, 60], [600, 0]]]
  const segnetto = [[[10, 10], [50, 30]]]
  const f = m.risultatoFatto(bozza, R.w, R.h)
  ok('i tratti della bozza adattati al riquadro piccolo', f.tratti, m.adattaTratti(bozza, R.w, R.h))
  ok('con una firma vera: chiama onTratti', f.chiama, true)
  ok('con un segnetto: non chiama', m.risultatoFatto(segnetto, R.w, R.h).chiama, false)
  ok('senza bozza: non chiama', m.risultatoFatto([], R.w, R.h).chiama, false)
  ok('la bozza di partenza non si tocca', bozza[0][1], [300, 60])
}

console.log('\n11. la voce di cronologia e l\'inert')
{
  ok('back se la voce in cima è la nostra', m.serveBack({ firma: true }), true)
  ok('niente back se la voce è della pagina', m.serveBack({ altro: 1 }), false)
  ok('niente back senza stato (null)', m.serveBack(null), false)
  const el = (inert) => ({ hasAttribute: () => inert })
  const [radice, libero, giaInert] = [el(false), el(false), el(true)]
  const da = m.daIsolare([libero, radice, giaInert], radice)
  ok('si isola solo chi non lo era già, e non la radice', [da.length, da[0] === libero], [1, true])
}

console.log('\n12. l\'altezza visibile (barre del browser in vista)')
{
  ok('con le barre in vista vince la visualViewport, più bassa', m.altezzaVisibile(420, 780), 420)
  ok('senza visualViewport vale innerHeight', m.altezzaVisibile(undefined, 390), 390)
  ok('arrotonda per difetto, i decimali fanno scorrere', m.altezzaVisibile(419.6, 430), 419)
  ok('una visualViewport a zero (non ancora misurata) non vale', m.altezzaVisibile(0, 390), 390)
}

console.log('\n13. l\'invito a girare il telefono (solo in verticale, solo prima di firmare)')
{
  ok('in verticale, riquadro vuoto e intatto: si mostra', m.invitoGirare('verticale', 0, false, ''), true)
  ok('in orizzontale non serve', m.invitoGirare('orizzontale', 0, false, ''), false)
  ok('al primo dito sparisce, anche prima del tratto finito', m.invitoGirare('verticale', 0, true, ''), false)
  ok('con una firma già nel riquadro sparisce', m.invitoGirare('verticale', 2, false, ''), false)
  ok('non si somma all\'avviso di rotazione', m.invitoGirare('verticale', 0, false, 'Hai girato il telefono: firma di nuovo'), false)
}

console.log('\n14. girare il telefono cancella bozza e dito già sceso (così l\'invito ricompare)')
{
  ok('a tocco, verso cambiato: cancella', m.rotazioneCancella('verticale', 'orizzontale', true), true)
  ok('a tocco, stesso verso: no', m.rotazioneCancella('verticale', 'verticale', true), false)
  ok('col mouse un resize non cancella', m.rotazioneCancella('verticale', 'orizzontale', false), false)
}

console.log(guai ? `\n${guai} COSE NON TORNANO` : '\nTUTTO A POSTO')
process.exit(guai ? 1 : 0)
