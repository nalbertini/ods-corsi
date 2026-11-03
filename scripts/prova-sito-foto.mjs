// ---------------------------------------------------------------------------
// Il fuoco delle foto del sito, senza browser.
//
//   node scripts/prova-sito-foto.mjs
//
// Le foto stanno in riquadri più larghi o più stretti di loro (`object-fit:cover`):
// il ritaglio taglia teste e mani se il punto che resta al centro è quello sbagliato.
// La segreteria sceglie, foto per foto, dove stanno le persone (un punto x,y in percentuale, nel
// database: tabella `sito_punti`, funzione `sito_punti_pubblici()`). `src/lib/sitoFoto.ts` ne fa il
// CSS: una regola `img[src*="nome.jpg"]{object-position:x% y%!important}` (il nome ovunque
// nell'indirizzo: anche in quello di /render/image, che finisce con ?width=…) che vale in ogni
// pagina e in ogni riquadro, sul computer e sul telefono. Senza punto la foto resta col ritaglio
// del suo riquadro. Nel codice non c'è più nessuna tabella di fuochi.
// ---------------------------------------------------------------------------
import { build } from 'esbuild'
import * as F from './fixture-home-nuova.mjs'

const carica = async (file) => {
  const { outputFiles } = await build({ entryPoints: [file], bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent', define: { 'import.meta.env': '{}' }, banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(process.cwd() + '/');" } })
  return import('data:text/javascript;base64,' + Buffer.from(outputFiles[0].text).toString('base64'))
}
const g = await carica('src/lib/sitoGenera.ts')
let f = {}
try { f = await carica('src/lib/sitoFoto.ts') } catch (e) { console.log('  (modulo mancante: src/lib/sitoFoto.ts)') }

let guai = 0
const ok = (cosa, avuto, voluto) => {
  const va = JSON.stringify(avuto) === JSON.stringify(voluto)
  console.log(va ? '  ✓' : '  ✗', cosa, va ? '' : `— atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`)
  if (!va) guai++
}
const U = (n) => `${n.toString(16).padStart(8, '0')}-0000-4000-8000-000000000000`
const A = `${U(1)}.jpg`
const B = `${U(2)}.webp`
const C = `${U(3)}.png`
const html = (d, f = 'index.html') => g.generaSito(d)[f] ?? ''
const stili = (h) => [...h.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('')
const base = F.dati(F.TESTO_NUOVO)
// Se la funzione manca il caso fa rosso con «manca» (un «null» atteso non deve passare per sbaglio).
const sposta = (...a) => (typeof f.spostaPunto === 'function' ? f.spostaPunto(...a) : 'manca')
const daClic = (...a) => (typeof f.puntoDaClic === 'function' ? f.puntoDaClic(...a) : 'manca')

console.log('\n1. puntoValido')
ok('un punto intero dentro 0..100 va bene', [f.puntoValido?.({ x: 0, y: 100 }), f.puntoValido?.({ x: 50, y: 25 })], [true, true])
ok('fuori da 0..100 no', [f.puntoValido?.({ x: 101, y: 5 }), f.puntoValido?.({ x: 5, y: -1 })], [false, false])
ok('decimali, NaN, stringhe, mancanti no', [f.puntoValido?.({ x: 1.5, y: 5 }), f.puntoValido?.({ x: NaN, y: 5 }), f.puntoValido?.({ x: '50', y: 5 }), f.puntoValido?.({ x: 5 }), f.puntoValido?.(null), f.puntoValido?.('50% 50%')], [false, false, false, false, false, false])

console.log('\n2. cssPunti')
ok('una regola per foto, unite da a capo', f.cssPunti?.({ [A]: { x: 50, y: 0 }, [B]: { x: 45, y: 35 } }), `img[src*="${A}"]{object-position:50% 0%!important}\nimg[src*="${B}"]{object-position:45% 35%!important}`)
ok('nessun punto, nessuna regola', f.cssPunti?.({}), '')
ok('un nome strano si salta (virgolette, barre, .html, maiuscole, non uuid)', f.cssPunti?.({ 'a"b.jpg': { x: 1, y: 1 }, [`x/${A}`]: { x: 1, y: 1 }, [`${U(4)}.html`]: { x: 1, y: 1 }, [`${U(5)}.JPG`]: { x: 1, y: 1 }, 'pagina.jpg': { x: 1, y: 1 }, [C]: { x: 20, y: 30 } }), `img[src*="${C}"]{object-position:20% 30%!important}`)
ok('un punto non valido si salta', f.cssPunti?.({ [A]: { x: 101, y: 1 }, [B]: { x: 1.5, y: 1 }, [C]: { x: 'url(x)', y: 1 } }), '')
ok('niente tabella nel codice: FOCI_FOTO, FOCI_SCHEDE, cssFoci, cssFociSchede non ci sono più', ['FOCI_FOTO', 'FOCI_SCHEDE', 'cssFoci', 'cssFociSchede'].filter((n) => n in f), [])

console.log('\n3. puntoDaClic: il clic sulla foto diventa percentuali')
{
  const r = { left: 100, top: 50, width: 400, height: 200 }
  ok('il centro è 50,50', daClic(300, 150, r), { x: 50, y: 50 })
  ok('l’angolo in alto a sinistra è 0,0', daClic(100, 50, r), { x: 0, y: 0 })
  ok('arrotonda all’intero', daClic(100 + 133, 50 + 67, r), { x: 33, y: 34 })
  ok('un clic fuori dalla foto finisce sul bordo', [daClic(10, 400, r), daClic(900, -20, r)], [{ x: 0, y: 100 }, { x: 100, y: 0 }])
}

console.log('\n4. spostaPunto: le frecce da tastiera')
{
  const p = { x: 50, y: 50 }
  ok('freccia: di 1', ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].map((t) => sposta(p, t)), [{ x: 49, y: 50 }, { x: 51, y: 50 }, { x: 50, y: 49 }, { x: 50, y: 51 }])
  ok('con grande: di 10', ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].map((t) => sposta(p, t, true)), [{ x: 40, y: 50 }, { x: 60, y: 50 }, { x: 50, y: 40 }, { x: 50, y: 60 }])
  ok('mai fuori da 0..100', [sposta({ x: 0, y: 0 }, 'ArrowLeft'), sposta({ x: 5, y: 0 }, 'ArrowUp', true), sposta({ x: 100, y: 98 }, 'ArrowRight'), sposta({ x: 3, y: 98 }, 'ArrowDown', true)], [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 100, y: 98 }, { x: 3, y: 100 }])
  ok('un altro tasto non fa niente (null)', [sposta(p, 'Enter'), sposta(p, 'a')], [null, null])
  ok('il punto di partenza non cambia', p, { x: 50, y: 50 })
}

console.log('\n5. Il sito usa i punti del database, in ogni pagina')
{
  const punti = { [A]: { x: 50, y: 0 }, [B]: { x: 45, y: 35 } }
  const regola = (n, p) => `img[src*="${n}"]{object-position:${p.x}% ${p.y}%!important}`
  const home = stili(html({ ...base, punti }))
  ok('la Home ha una regola per foto', [home.includes(regola(A, punti[A])), home.includes(regola(B, punti[B]))], [true, true])
  ok('le regole vengono dopo quelle dei riquadri', home.indexOf(regola(A, punti[A])) > home.indexOf('.corso-apertura'), true)
  const altra = g.generaSito({ dominio: 'https://officinedellosport.it', pagine: [{ slug: 'contatti', titolo: 'C', descrizione: '', testo: '<p>x</p>' }], menu: [], rinvii: [], punti })['contatti/index.html'] ?? ''
  ok('anche una pagina qualunque', stili(altra).includes(regola(A, punti[A])), true)
  ok('senza punti nessuna regola img[src*=', [stili(html(base)).includes('img[src*='), stili(html({ ...base, punti: {} })).includes('img[src*=')], [false, false])
  ok('i fuochi di una volta non ci sono più (nessuna foto del vecchio elenco, nessun .scheda-foto img[data-corso)', [/img\[src\*="12e605fc/.test(stili(html(base))), /\.scheda-foto img\[data-corso=/.test(stili(html(base)))], [false, false])
}

console.log('\n6. datiDaRisposte: le righe di sito_punti_pubblici() diventano i punti')
{
  const pag = [{ slug: 'home', titolo: 'Casa', descrizione: '', testo: '<p>x</p>', pubblicata_il: '2026-10-17T09:00:00Z' }]
  const d = (righe) => { try { return g.datiDaRisposte('https://officinedellosport.it', pag, [], [], undefined, undefined, righe) } catch (e) { return { errore: e.message } } }
  ok('le righe diventano un Record nome → punto', d([{ nome: A, x: 50, y: 0 }, { nome: B, x: 45, y: 35 }]).punti, { [A]: { x: 50, y: 0 }, [B]: { x: 45, y: 35 } })
  ok('righe fuori forma si saltano', d([{ nome: A, x: 101, y: 0 }, { nome: B, x: '5', y: 3 }, { x: 1, y: 1 }, null, 'x', { nome: C, x: 20, y: 30 }]).punti, { [C]: { x: 20, y: 30 } })
  ok('senza il settimo argomento: le pagine ci sono e punti no', [d(undefined).pagine?.length, 'punti' in d(undefined) && d(undefined).punti !== undefined], [1, false])
}

console.log(guai ? `\n✗ ${guai} casi falliti` : '\nTutto a posto.')
process.exit(guai ? 1 : 0)
