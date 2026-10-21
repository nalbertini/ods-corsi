// ---------------------------------------------------------------------------
// Il bilancio di un anno, senza browser.
//
//   node scripts/prova-bilancio.mjs [cartella]
//
// Controlla `src/lib/bilancio.ts`: il bilancio per cassa di un anno solare
// (1 gen - 31 dic), calcolato dalle righe dell'elenco movimenti, col confronto con
// l'anno prima, i saldi delle casse a inizio e fine anno, il foglio CSV e il foglio
// PDF per il commercialista (senza nomi di iscritti). Con una cartella ci lascia il PDF.
// Poi i conti che legge la chat (strumenti `conti` e `da_classificare` di
// `src/lib/mcp.ts`, provati da scripts/prova-mcp.mjs): un periodo qualunque con
// lo stesso tratto dell'anno prima, il periodo detto a parole, le voci «da
// sistemare» e i gruppi di uscite ancora senza una voce vera.
// ---------------------------------------------------------------------------
import { build } from 'esbuild'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { inflateSync } from 'node:zlib'

const { outputFiles } = await build({
  stdin: {
    contents:
      "export * from './src/lib/bilancio'; export { bilancioPdf } from './src/lib/bilancioPdf'; export { filtraMovimenti, totali } from './src/lib/contabilita'; export { ENTE_PREDEFINITO } from './src/lib/ricevute'; export { PDFDocument, PDFArray, PDFRawStream, PDFName, PDFDict } from 'pdf-lib'",
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
const cartella = process.argv[2]

// Leggere una pagina come prova-lettere.mjs § 6 bis: solo il contenuto della pagina, non quello della carta
// disegnata sopra. Le righe scritte (dove, che corpo, cosa), i Form disegnati con `Do` e il riquadro che
// coprono sulla pagina (BBox per la Matrix del Form e per quella del momento), i punti delle linee, le curve.
const leggiPagina = ({ PDFArray, PDFRawStream, PDFName, PDFDict }) => (pg) => {
  const c = pg.node.Contents()
  const contenuto = (c instanceof PDFArray ? c.asArray().map((r) => pg.doc.context.lookup(r)) : [c])
    .filter((f) => f instanceof PDFRawStream)
    .map((f) => {
      try {
        return inflateSync(f.contents).toString('latin1')
      } catch {
        return Buffer.from(f.contents).toString('latin1')
      }
    })
    .join('\n')
  const xo = pg.node.Resources()?.lookup(PDFName.of('XObject'), PDFDict)
  const forma = (nome) => {
    const o = xo?.lookup(PDFName.of(nome.slice(1)))
    const d = o instanceof PDFRawStream ? o.dict : o
    return String(d?.get(PDFName.of('Subtype'))) === '/Form' ? d : null
  }
  const numeri = (d, k) => d.lookup(PDFName.of(k), PDFArray)?.asArray().map((n) => n.asNumber())
  const per = ([a, b, c, d, e, f], [A, B, C, D, E, F]) => [a * A + b * C, a * B + b * D, c * A + d * C, c * B + d * D, e * A + f * C + E, e * B + f * D + F]
  const punto = ([a, b, c, d, e, f], x, y) => [a * x + c * y + e, b * x + d * y + f]
  const scritte = []
  const forme = []
  const punti = []
  let curve = 0
  let ctm = [1, 0, 0, 1, 0, 0]
  let tm = [0, 0]
  let corpo = 0
  let num = []
  let prima = ''
  const pila = []
  for (const t of contenuto.split(/\s+/)) {
    if (/^-?[\d.]+$/.test(t)) {
      num.push(Number(t))
      continue
    }
    if (t === 'q') pila.push(ctm)
    else if (t === 'Q') ctm = pila.pop() ?? ctm
    else if (t === 'cm') ctm = per(num.slice(-6), ctm)
    else if (t === 'Tf') corpo = num.at(-1)
    else if (t === 'Tm') tm = punto(ctm, num.at(-2), num.at(-1))
    else if (t === 'Tj' && prima.startsWith('<')) scritte.push({ x: tm[0], y: tm[1], corpo, testo: Buffer.from(prima.slice(1, -1), 'hex').toString('latin1').replace(/\x92/g, '’') })
    else if (t === 'Do' && forma(prima)) {
      const d = forma(prima)
      const m = per(numeri(d, 'Matrix') ?? [1, 0, 0, 1, 0, 0], ctm)
      const [x0, y0, x1, y1] = numeri(d, 'BBox')
      const angoli = [punto(m, x0, y0), punto(m, x1, y1), punto(m, x0, y1), punto(m, x1, y0)]
      forme.push({ nome: prima, dopo: scritte.length, x0: Math.min(...angoli.map((a) => a[0])), x1: Math.max(...angoli.map((a) => a[0])), y0: Math.min(...angoli.map((a) => a[1])), y1: Math.max(...angoli.map((a) => a[1])) })
    } else if (t === 'm' || t === 'l') punti.push(punto(ctm, num.at(-2), num.at(-1)))
    else if (t === 'c') curve++
    num = []
    prima = t
  }
  const tratteggi = [...contenuto.matchAll(/\[([^\]]*)\]\s+-?[\d.]+\s+d\b/g)].filter((x) => x[1].trim()).length
  return { contenuto, scritte, righe: scritte.map((s) => s.testo), forme, punti, curve, tratteggi }
}

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

const OGGI = '2026-10-18'
const casse = [
  { id: 'c1', nome: 'Cassa Contanti', saldoIniziale: 100000 },
  { id: 'c2', nome: 'Conto Corrente', saldoIniziale: 0 },
]
let n = 0
const riga = (data, tipo, importo, voce, extra = {}) => ({
  id: `r${++n}`,
  origine: 'movimento',
  tipo,
  data,
  importo,
  descrizione: 'x',
  voce: tipo === 'giroconto' ? null : voce,
  cassaId: 'c2',
  annullato: false,
  ...extra,
})
const entrata = (data, importo, voce = 'Corsi e altri pagamenti', extra) => riga(data, 'entrata', importo, voce, extra)
const uscita = (data, importo, voce = 'Affitto sala', extra) => riga(data, 'uscita', importo, voce, extra)

console.log('1. gli anni che si possono scegliere')
{
  const righe = [entrata('2011-03-02', 100), entrata('2025-12-31', 100), entrata('2026-01-01', 100)]
  const tutti = Array.from({ length: 16 }, (_, i) => 2011 + i)
  ok('dal primo anno con movimenti all\'anno di oggi', prova(() => m.anniDelBilancio(righe, OGGI)), tutti)
  ok('senza movimenti, solo l\'anno di oggi', prova(() => m.anniDelBilancio([], OGGI)), [2026])
  ok('un movimento annullato non fa cominciare un anno', prova(() => m.anniDelBilancio([entrata('2005-05-05', 100, undefined, { annullato: true }), entrata('2024-02-02', 100)], OGGI)), [2024, 2025, 2026])
}

console.log('\n2. un movimento sta in un solo anno')
{
  const righe = [entrata('2025-12-31', 1000), entrata('2026-01-01', 700)]
  const b25 = prova(() => m.bilancioAnno(righe, casse, 2025, OGGI))
  const b26 = prova(() => m.bilancioAnno(righe, casse, 2026, OGGI))
  ok('2025: solo quello del 31 dicembre', [b25.entrate, b25.dal, b25.al], [1000, '2025-01-01', '2025-12-31'])
  ok('2026: solo quello dell\'1 gennaio', [b26.entrate, b26.dal], [700, '2026-01-01'])
}

console.log('\n3. entrate, uscite e risultato')
{
  const righe = [
    entrata('2025-05-05', 10000),
    uscita('2025-05-06', 3000),
    riga('2025-05-07', 'giroconto', 5000, null, { cassaId: 'c1', cassaAId: 'c2' }),
    entrata('2025-05-08', 99900, undefined, { annullato: true }),
  ]
  const b = prova(() => m.bilancioAnno(righe, casse, 2025, OGGI))
  ok('il giroconto e l\'annullato non contano', [b.entrate, b.uscite, b.risultato], [10000, 3000, 7000])
}

console.log('\n4. il dettaglio per voce torna coi totali')
{
  const righe = [
    entrata('2025-01-10', 5000, 'Quota associativa'),
    entrata('2025-02-10', 7000, 'Corsi e altri pagamenti'),
    entrata('2025-03-10', 1000, 'Quota associativa'),
    uscita('2025-04-10', 4000, 'Affitto sala'),
    uscita('2025-05-10', 2500, 'Tasse'),
    entrata('2024-12-31', 9999, 'Quota associativa'),
  ]
  const b = prova(() => m.bilancioAnno(righe, casse, 2025, OGGI))
  const somma = (tipo) => b.voci.filter((v) => v.tipo === tipo).reduce((s, v) => s + (v.totale ?? 0), 0)
  ok('la somma delle voci d\'entrata è il totale delle entrate', somma('entrata'), b.entrate)
  ok('la somma delle voci d\'uscita è il totale delle uscite', somma('uscita'), b.uscite)
  const elenco = m.totali(m.filtraMovimenti(righe, { dal: '2025-01-01', al: '2025-12-31' }))
  ok('uguale ai totali dell\'elenco movimenti dal 1/1 al 31/12', [b.entrate, b.uscite], [elenco.entrate, elenco.uscite])
  ok('le entrate prima, la più grande per prima', b.voci.map((v) => `${v.tipo}:${v.voce}:${v.totale}:${v.movimenti}`), ['entrata:Corsi e altri pagamenti:7000:1', 'entrata:Quota associativa:6000:2', 'uscita:Affitto sala:4000:1', 'uscita:Tasse:2500:1'])
}

console.log('\n5. gli anni non si mescolano')
{
  const righe = [entrata('2011-06-01', 500), entrata('2019-06-01', 800), uscita('2019-07-01', 300), entrata('2025-12-31', 1000), uscita('2026-01-01', 200), uscita('2026-02-01', 50, undefined, { annullato: true })]
  const anni = m.anniDelBilancio(righe, OGGI)
  const somma = prova(() => anni.reduce((s, a) => s + m.bilancioAnno(righe, casse, a, OGGI).risultato, 0))
  ok('la somma dei risultati di tutti gli anni è il totale di «Tutto»', somma, m.totali(righe).differenza)
  ok('un anno senza movimenti è vuoto', prova(() => m.bilancioAnno(righe, casse, 2012, OGGI).vuoto), true)
  ok('…e un anno con movimenti no', prova(() => m.bilancioAnno(righe, casse, 2019, OGGI).vuoto), false)
  ok('un anno con soli annullati o giroconti è vuoto', prova(() => m.bilancioAnno([entrata('2020-01-01', 5, undefined, { annullato: true }), riga('2020-01-02', 'giroconto', 5, null, { cassaId: 'c1', cassaAId: 'c2' })], casse, 2020, OGGI).vuoto), true)
}

console.log('\n6. se si annulla dopo, l\'anno vecchio cambia')
{
  const prima = [entrata('2025-03-03', 1000), entrata('2025-04-04', 400)]
  const dopo = [entrata('2025-03-03', 1000), entrata('2025-04-04', 400, undefined, { annullato: true })]
  ok('prima dell\'annullo', prova(() => m.bilancioAnno(prima, casse, 2025, '2027-03-10').entrate), 1400)
  ok('dopo l\'annullo nel 2027, il 2025 non conta più quell\'incasso', prova(() => m.bilancioAnno(dopo, casse, 2025, '2027-03-10').entrate), 1000)
}

console.log('\n7. «Da classificare»')
{
  const righe = [
    entrata('2014-01-10', 9000, 'Corsi e altri pagamenti'),
    uscita('2014-02-10', 1000, 'Affitto sala'),
    uscita('2014-03-10', 3000, 'Da classificare'),
    uscita('2014-04-10', 1000, null),
    entrata('2014-05-10', 500, 'Da classificare'),
  ]
  const b = prova(() => m.bilancioAnno(righe, casse, 2014, OGGI))
  ok('conta i movimenti, le uscite e la quota sulle uscite (anche senza voce)', b.daClassificare, { movimenti: 3, uscite: 4000, quotaUscite: 80 })
  ok('oltre metà delle uscite: il risultato è provvisorio', b.provvisorio, true)
  ok('i totali comprendono quei movimenti', [b.entrate, b.uscite], [9500, 5000])
  const riga4 = b.voci.filter((v) => v.daClassificare).map((v) => `${v.tipo}:${v.voce}:${v.totale}:${v.movimenti}`)
  ok('la riga «Da classificare» c\'è tra entrate e tra uscite, il «senza voce» ci finisce dentro', riga4, ['entrata:Da classificare:500:1', 'uscita:Da classificare:4000:2'])
  const ultima = b.voci.filter((v) => v.tipo === 'uscita').at(-1)
  ok('…ed è l\'ultima delle uscite', ultima?.voce, 'Da classificare')
  const poco = prova(() => m.bilancioAnno([entrata('2025-01-01', 9000), uscita('2025-01-02', 9000), uscita('2025-01-03', 1000, 'Da classificare')], casse, 2025, OGGI))
  ok('meno di metà: non è provvisorio, ma l\'avviso c\'è', [poco.provvisorio, poco.daClassificare?.quotaUscite], [false, 10])
  const confine = (sospese) => prova(() => m.bilancioAnno([entrata('2025-01-01', 9000), uscita('2025-01-02', 100000 - sospese), uscita('2025-01-03', sospese, 'Da classificare')], casse, 2025, OGGI).provvisorio)
  ok('il confine è sul rapporto vero: 50% no, 50,4% sì, 51% sì', [confine(50000), confine(50400), confine(51000)], [false, true, true])
  const niente = prova(() => m.bilancioAnno([entrata('2025-01-01', 9000), uscita('2025-01-02', 9000)], casse, 2025, OGGI))
  ok('senza movimenti da classificare, nessun avviso', [niente.daClassificare, niente.provvisorio], [null, false])
}

console.log('\n8. la «Differenza di cassa» sta a parte')
{
  const b = prova(() => m.bilancioAnno([uscita('2025-05-01', 3500, 'Differenza di cassa'), uscita('2025-05-02', 1000, 'Tasse'), entrata('2025-05-03', 900, 'Differenza di cassa')], casse, 2025, OGGI))
  ok('è marcata «a parte» e conta nei totali', [b.voci.filter((v) => v.aParte).map((v) => `${v.tipo}:${v.totale}`), b.uscite, b.entrate], [['entrata:900', 'uscita:3500'], 4500, 900])
  ok('in fondo alle uscite, ma dopo «Tasse» e prima di niente altro', b.voci.filter((v) => v.tipo === 'uscita').map((v) => v.voce), ['Tasse', 'Differenza di cassa'])
}

console.log('\n8b. lo storico importato e gli incassi dell\'app non si sovrappongono')
{
  const storico = (data, voce = 'Corsi e altri pagamenti') => entrata(data, 1000, voce)
  const app = (data) => entrata(data, 1000, 'Corsi e altri pagamenti', { origine: 'pagamento' })
  const solo = prova(() => m.bilancioAnno([storico('2026-03-01'), storico('2026-05-10', 'Quota associativa'), app('2026-05-11'), app('2026-08-01')], casse, 2026, OGGI))
  ok('il storico finisce prima che l\'app cominci: niente avviso', solo.sovrapposizione, null)
  const doppio = prova(() => m.bilancioAnno([storico('2026-03-01'), storico('2026-06-10'), app('2026-05-11'), app('2026-08-01')], casse, 2026, OGGI))
  ok('lo storico arriva dopo il primo incasso dell\'app: avviso col periodo', doppio.sovrapposizione, { dal: '2026-05-11', al: '2026-06-10' })
  ok('un anno con solo lo storico o solo l\'app: niente avviso', [prova(() => m.bilancioAnno([storico('2020-03-01')], casse, 2020, OGGI).sovrapposizione), prova(() => m.bilancioAnno([app('2026-03-01')], casse, 2026, OGGI).sovrapposizione)], [null, null])
  const annullato = prova(() => m.bilancioAnno([storico('2026-06-10', undefined), { ...storico('2026-07-10'), annullato: true }, app('2026-05-11')], casse, 2026, OGGI))
  ok('un annullato non fa sovrapposizione', annullato.sovrapposizione, { dal: '2026-05-11', al: '2026-06-10' })
  const altre = prova(() => m.bilancioAnno([storico('2026-09-10', 'Donazioni'), app('2026-05-11')], casse, 2026, OGGI).sovrapposizione)
  ok('un\'entrata a mano con una voce non di sistema non è dello storico', altre, null)
}

console.log('\n9. l\'anno in corso è parziale')
{
  const righe = [entrata('2026-03-03', 100), entrata('2025-03-03', 100)]
  const corso = prova(() => m.bilancioAnno(righe, casse, 2026, OGGI))
  const passato = prova(() => m.bilancioAnno(righe, casse, 2025, OGGI))
  ok('2026 è parziale: dal 1 gennaio a oggi', [corso.parziale, corso.dal, corso.al], [true, '2026-01-01', OGGI])
  ok('…e si confronta con lo stesso periodo del 2025', [corso.confrontoDal, corso.confrontoAl], ['2025-01-01', '2025-10-18'])
  ok('2025 è finito: dal 1 gennaio al 31 dicembre', [passato.parziale, passato.al], [false, '2025-12-31'])
  ok('…e si confronta con tutto il 2024', [passato.confrontoDal, passato.confrontoAl], ['2024-01-01', '2024-12-31'])
  ok('29 febbraio: l\'anno prima finisce il 28', prova(() => m.bilancioAnno([], casse, 2028, '2028-02-29').confrontoAl), '2027-02-28')
}

console.log('\n10. il confronto con l\'anno prima')
{
  const righe = [
    entrata('2025-06-01', 1000, 'Quota associativa'),
    uscita('2025-06-02', 400, 'Attrezzatura'),
    entrata('2024-06-01', 800, 'Quota associativa'),
    uscita('2024-06-02', 300, 'Corsi di formazione'),
  ]
  const b = prova(() => m.bilancioAnno(righe, casse, 2025, OGGI))
  ok('totali dell\'anno prima', b.prima, { entrate: 800, uscite: 300, risultato: 500 })
  ok('per voce: l\'importo e quello di prima; «null» dove la voce non c\'era', b.voci.map((v) => `${v.voce}:${v.totale}:${v.prima}`), ['Quota associativa:1000:800', 'Attrezzatura:400:null', 'Corsi di formazione:null:300'])
  ok('l\'anno prima vuoto: nessun dato, non zero', prova(() => m.bilancioAnno([entrata('2025-06-01', 1000)], casse, 2025, OGGI).prima), null)
  const corso = prova(() => m.bilancioAnno([entrata('2026-02-01', 100), entrata('2025-10-18', 40), entrata('2025-10-19', 5000)], casse, 2026, OGGI))
  ok('l\'anno in corso si confronta fino allo stesso giorno (il 19 ottobre 2025 non c\'è)', corso.prima?.entrate, 40)
  ok('variazione in percentuale', [m.variazione(1080, 1000), m.variazione(900, 1000), m.variazione(5, 0), m.variazione(0, 0), m.variazione(1000, 1000)], ['+8%', '−10%', null, null, '0%'])
  ok('una variazione oltre il 999% non si scrive: resta la differenza in euro', [m.variazione(100000, 100), m.variazione(1000, 100), m.variazione(0, 100000)], [null, '+900%', '−100%'])
  ok('differenza: col segno, «—» se manca uno dei due', [m.differenza(1000, 800), m.differenza(null, 800), m.differenza(800, null)], ['+2,00 €', '—', '—'])
  ok('il risultato a parole', [m.esito(5), m.esito(-5), m.esito(0)], ['In avanzo', 'In disavanzo', 'In pareggio'])
  const bb = prova(() => m.bilancioAnno([entrata('2025-06-01', 1000)], casse, 2025, OGGI))
  ok('il testo sotto un totale: anno prima, «nessun dato» se vuoto', [m.testoConfronto(bb, 800, 1000), m.testoConfronto(bb, undefined, 1000)], ['2024: 8,00 € · +25%', '2024: nessun dato'])
  ok('una differenza si scrive col segno', [m.conSegno(305), m.conSegno(-17), m.conSegno(0)], ['+3,05 €', '−0,17 €', '0,00 €'])
}

console.log('\n11. i saldi delle casse, anno per anno')
{
  const due = [
    { id: 'c1', nome: 'Cassa Contanti', saldoIniziale: 100000 },
    { id: 'c2', nome: 'Conto Corrente', saldoIniziale: 50000 },
  ]
  const righe = [
    entrata('2024-03-01', 20000, undefined, { cassaId: 'c1' }),
    uscita('2024-04-01', 5000, undefined, { cassaId: 'c2' }),
    riga('2024-05-01', 'giroconto', 10000, null, { cassaId: 'c1', cassaAId: 'c2' }),
    entrata('2025-03-01', 7000, undefined, { cassaId: 'c1' }),
    uscita('2025-04-01', 1000, undefined, { cassaId: 'c1' }),
    riga('2025-05-01', 'giroconto', 3000, null, { cassaId: 'c2', cassaAId: 'c1' }),
  ]
  const s24 = prova(() => m.bilancioAnno(righe, due, 2024, OGGI).saldi)
  const s25 = prova(() => m.bilancioAnno(righe, due, 2025, OGGI).saldi)
  ok('2024, Cassa Contanti: inizio = saldo iniziale, fine = inizio + entrate − uscite ± giroconti', [s24[0].inizio, s24[0].entrate, s24[0].uscite, s24[0].giroconti, s24[0].fine], [100000, 20000, 0, -10000, 110000])
  ok('2024, Conto Corrente', [s24[1].inizio, s24[1].entrate, s24[1].uscite, s24[1].giroconti, s24[1].fine], [50000, 0, 5000, 10000, 55000])
  ok('il saldo di fine 2024 è quello di inizio 2025', [s25[0].inizio, s25[1].inizio], [s24[0].fine, s24[1].fine])
  ok('2025, Cassa Contanti', [s25[0].entrate, s25[0].uscite, s25[0].giroconti, s25[0].fine], [7000, 1000, 3000, 119000])
  ok('i giroconti tornano: quel che esce da una cassa entra nell\'altra', s25[0].giroconti + s25[1].giroconti, 0)

  const conDal = [
    { id: 'c1', nome: 'Cassa Contanti', saldoIniziale: 10000, dal: '2025-09-01' },
    { id: 'c2', nome: 'Conto Corrente', saldoIniziale: 0 },
  ]
  const r2 = [entrata('2025-03-01', 999, undefined, { cassaId: 'c1' }), entrata('2025-10-01', 500, undefined, { cassaId: 'c1' })]
  const a25 = prova(() => m.bilancioAnno(r2, conDal, 2025, OGGI).saldi[0])
  ok('la cassa parte il 1 settembre 2025: il saldo iniziale vale da lì, i movimenti prima non contano', [a25.inizio, a25.entrate, a25.fine, a25.dal], [10000, 500, 10500, '2025-09-01'])
  const a24 = prova(() => m.bilancioAnno(r2, conDal, 2024, OGGI).saldi[0])
  ok('prima che la cassa parta: saldo non disponibile, mai uno zero', [a24.inizio, a24.fine, a24.parteIl], [null, null, '2025-09-01'])
  const a26 = prova(() => m.bilancioAnno(r2, conDal, 2026, OGGI).saldi[0])
  ok('l\'anno dopo parte dal saldo di fine 2025', [a26.inizio, a26.dal], [10500, undefined])
}

console.log('\n12. il foglio CSV')
{
  const righe = [
    entrata('2025-06-01', 100000, 'Quota associativa', { origine: 'ricevuta', descrizione: 'Rossi Giulia' }),
    uscita('2025-06-02', 40000, 'Affitto sala'),
    entrata('2024-06-01', 80000, 'Quota associativa'),
  ]
  const b = prova(() => m.bilancioAnno(righe, casse, 2025, OGGI))
  const testo = prova(() => m.csvBilancio(b, OGGI))
  ok('dice «per cassa», l\'anno e la data di calcolo', [/per cassa/.test(testo), /2025/.test(testo), /18\/10\/2026/.test(testo)], [true, true, true])
  ok('ha le voci con gli importi e quelli dell\'anno prima', [/Quota associativa;entrata;1000,00;800,00/.test(testo), /Affitto sala;uscita;400,00;/.test(testo)], [true, true])
  ok('nessun nome di iscritto', /Rossi|Giulia/.test(testo), false)
  const rosso = prova(() => m.csvBilancio(m.bilancioAnno([entrata('2025-06-01', 1000), uscita('2025-06-02', 270000)], casse, 2025, OGGI), OGGI))
  ok('un importo negativo è un numero, senza l\'apostrofo anti-formula', [/Risultato;;-2690,00/.test(rosso), /'-/.test(rosso)], [true, false])
  ok('i meno a schermo sono tutti «−», anche nel confronto', prova(() => [m.importoConMeno(-145000), m.importoConMeno(5), m.testoConfronto(m.bilancioAnno([entrata('2025-06-01', 1)], casse, 2025, OGGI), -500, 1)]), ['− 1.450,00 €', '0,05 €', '2024: − 5,00 € · +100%'])
  ok('i totali e il risultato ci sono', [/Totale entrate;;1000,00/.test(testo), /Totale uscite;;400,00/.test(testo), /Risultato;;600,00/.test(testo)], [true, true, true])
  ok('l\'anno parziale lo dice', /parziale/.test(prova(() => m.csvBilancio(m.bilancioAnno(righe, casse, 2026, OGGI), OGGI))), true)
  ok('il nome del file porta l\'anno', m.nomeFileBilancio(2025, 'csv'), 'bilancio-2025.csv')
}

console.log('\n13. il foglio PDF')
{
  const righe = [
    entrata('2025-06-01', 100000, 'Quota associativa', { origine: 'ricevuta', descrizione: 'Rossi Giulia' }),
    uscita('2025-06-02', 40000, 'Affitto sala'),
    uscita('2025-06-03', 5000, 'Da classificare'),
    entrata('2024-06-01', 80000, 'Quota associativa'),
  ]
  const b = prova(() => m.bilancioAnno(righe, casse, 2025, OGGI))
  const bytes = await Promise.resolve(prova(() => m.bilancioPdf({ ente: m.ENTE_PREDEFINITO, bilancio: b, oggi: OGGI }))).catch((e) => `ERRORE: ${e.message}`)
  ok('esce un PDF', typeof bytes === 'object' && String.fromCharCode(...bytes.slice(0, 5)), '%PDF-')
  if (typeof bytes === 'object') {
    const doc = await m.PDFDocument.load(bytes)
    ok('di una pagina A4', [doc.getPageCount(), Math.round(doc.getPage(0).getWidth()), Math.round(doc.getPage(0).getHeight())], [1, 595, 842])
    // Il testo sta in flussi compressi: li apro tutti e cerco le parole.
    let tutto = ''
    for (const f of Buffer.from(bytes).toString('latin1').matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
      try {
        tutto += inflateSync(Buffer.from(f[1], 'latin1')).toString('latin1')
      } catch {
        // un flusso che non è testo (font): si salta
      }
    }
    ok('nessun nome di iscritto', /Rossi|Giulia/.test(tutto), false)
    if (cartella) writeFileSync(`${cartella}/bilancio-2025.pdf`, bytes)
  }
}

console.log('\n13 bis. il foglio PDF sulla carta intestata')
{
  const leggi = leggiPagina(m)
  const carta = new Uint8Array(readFileSync('public/moduli/carta-intestata.pdf'))
  const ALTO = 841.89
  const ente = m.ENTE_PREDEFINITO
  const fai = async (b, su) => {
    try {
      const doc = await m.PDFDocument.load(await m.bilancioPdf({ ente, bilancio: b, oggi: OGGI, ...(su ? { carta: su } : {}) }))
      return { doc, pagine: doc.getPages().map(leggi) }
    } catch (e) {
      return { errore: e.message }
    }
  }
  const impronta = (p) => p.errore ?? createHash('sha256').update(p.pagine.map((q) => q.contenuto).join('\n')).digest('hex').slice(0, 16)
  const poche = prova(() => m.bilancioAnno([entrata('2025-06-01', 100000, 'Quota associativa'), uscita('2025-06-02', 40000, 'Affitto sala'), entrata('2024-06-01', 80000, 'Quota associativa')], casse, 2025, OGGI))
  // Sessanta voci di entrata: le righe non stanno in una pagina.
  const tante = prova(() => m.bilancioAnno(Array.from({ length: 60 }, (_, i) => entrata('2025-03-01', 1000 + i, `Voce ${String(i + 1).padStart(2, '0')}`)), casse, 2025, OGGI))

  // Senza carta il foglio è quello di oggi: lo stesso contenuto, pagina per pagina, e niente disegnato sopra.
  for (const [nome, b, oggi] of [['il bilancio corto', poche, '7446f9cdb5c09d06'], ['quello di sessanta voci', tante, 'fad537f969c71fcf']]) {
    const p = await fai(b)
    ok(`${nome}, senza carta: nessun XObject Form`, p.errore ?? p.pagine.map((q) => q.forme.length), p.pagine?.map(() => 0))
    ok(`${nome}, senza carta: lo stesso contenuto di oggi`, impronta(p), oggi)
  }

  for (const [nome, b] of [['il bilancio corto', poche], ['quello di sessanta voci', tante]]) {
    const p = await fai(b, carta)
    ok(`${nome}, con la carta: si fa`, p.errore ?? 'fatto', 'fatto')
    if (p.errore) continue
    const ps = p.pagine
    if (b === tante) ok(`${nome}: più di una pagina`, ps.length > 1, true)
    ok(`${nome}: ogni pagina ha la carta (un XObject Form)`, ps.map((q) => q.forme.length > 0), ps.map(() => true))
    ok(`${nome}: la pagina non scrive più da sé nome, indirizzo e C.F. dell’ente: li dice la carta`, ps.map((q) => q.righe.filter((r) => r === ente.nome || r.includes(ente.indirizzo) || r.startsWith('C.F.'))), ps.map(() => []))
    ok(`${nome}: il titolo «BILANCIO 2025» resta, sulla prima pagina`, ps[0].righe.includes('BILANCIO 2025'), true)
    ok(`${nome}: le firme restano, sull’ultima`, ['Chi ha preparato', 'Chi controlla'].filter((f) => !ps.at(-1).righe.includes(f)), [])
    const fuori = ps.flatMap((q, i) => q.scritte.filter((s) => s.y - 0.2 * s.corpo < 68 || s.y + 0.75 * s.corpo > ALTO - 92).map((s) => `pagina ${i + 1}: «${s.testo}» a y=${s.y}`))
    ok(`${nome}: nessuna riga nella testata (92 punti dall’alto) o nel piede (68 dal fondo) della carta vera`, fuori, [])
    if (ps.length > 1) ok(`${nome}: «pagina n di ${ps.length}» su ogni pagina, sopra il piede`, ps.map((q, i) => q.righe.some((r) => r.includes(`pagina ${i + 1} di ${ps.length}`))), ps.map(() => true))
  }
}

// ---------------------------------------------------------------------------
// I conti di un periodo qualunque (strumento `conti` della chat).
// contiPeriodo(righe, { dal, al, voce?, tipo? }, oggi): stesse regole di bilancioAnno.
// ---------------------------------------------------------------------------
console.log('\n14. i conti di un periodo: gli stessi del bilancio')
{
  const righe = [
    entrata('2025-01-10', 5000, 'Quota associativa'),
    entrata('2025-02-10', 7000, 'Corsi e altri pagamenti'),
    uscita('2025-04-10', 4000, 'Affitto sala'),
    uscita('2025-05-10', 2500, null),
    uscita('2025-05-11', 1500, 'Da classificare'),
    entrata('2025-05-12', 300, 'Differenza di cassa'),
    uscita('2025-05-13', 9999, 'Affitto sala', { annullato: true }),
    riga('2025-05-14', 'giroconto', 20000, null, { cassaId: 'c1', cassaAId: 'c2' }),
    entrata('2024-03-01', 6000, 'Quota associativa'),
    uscita('2024-03-02', 1000, 'Affitto sala'),
    entrata('2026-03-03', 800, 'Quota associativa'),
    uscita('2026-10-19', 200, 'Affitto sala'),
  ]
  const p = prova(() => m.contiPeriodo(righe, { dal: '2025-01-01', al: '2025-12-31' }, OGGI))
  const b = prova(() => m.bilancioAnno(righe, casse, 2025, OGGI))
  ok('un anno finito: entrate, uscite e risultato uguali al centesimo a bilancioAnno', prova(() => [p.entrate, p.uscite, p.risultato]), prova(() => [b.entrate, b.uscite, b.risultato]))
  ok('…e uguali ai totali dell\'elenco movimenti nello stesso periodo', prova(() => [p.entrate, p.uscite]), prova(() => { const t = m.totali(m.filtraMovimenti(righe, { dal: '2025-01-01', al: '2025-12-31' })); return [t.entrate, t.uscite] }))
  ok('…le stesse voci, col confronto', prova(() => p.voci), prova(() => b.voci))
  ok('…lo stesso anno prima', prova(() => [p.prima, p.confrontoDal, p.confrontoAl]), prova(() => [b.prima, b.confrontoDal, b.confrontoAl]))
  ok('annullati e giroconti fuori', prova(() => [p.entrate, p.uscite]), [12300, 8000])
  ok('il movimento senza voce sta sotto «Da classificare»', prova(() => p.voci.filter((v) => v.daClassificare).map((v) => `${v.tipo}:${v.voce}:${v.totale}:${v.movimenti}`)), ['uscita:Da classificare:4000:2'])
  ok('la «Differenza di cassa» conta nel totale ma è segnata a parte', prova(() => p.voci.filter((v) => v.aParte).map((v) => `${v.tipo}:${v.voce}:${v.totale}`)), ['entrata:Differenza di cassa:300'])
  const corso = prova(() => m.contiPeriodo(righe, { dal: '2026-01-01', al: '2026-12-31' }, OGGI))
  const b26 = prova(() => m.bilancioAnno(righe, casse, 2026, OGGI))
  ok('l\'anno in corso fino al 31 dicembre: si ferma a oggi ed è parziale, come bilancioAnno', prova(() => [corso.al, corso.parziale, corso.entrate, corso.uscite, corso.confrontoAl]), prova(() => [b26.al, b26.parziale, b26.entrate, b26.uscite, b26.confrontoAl]))
}

console.log('\n15. il periodo, l\'anno prima e i filtri')
{
  const righe = [
    entrata('2026-10-02', 10000, 'Donazioni'),
    uscita('2026-10-03', 4000, 'Utenze'),
    uscita('2026-10-04', 1000, null),
    uscita('2026-10-05', 700, 'Da classificare'),
    uscita('2026-10-06', 600, 'Varie'),
    uscita('2026-10-07', 500, 'VARIE'),
    entrata('2026-10-08', 900, 'Da classificare'),
    uscita('2026-10-09', 8888, 'Varie', { annullato: true }),
    entrata('2025-10-05', 8000, 'Donazioni'),
    entrata('2025-10-25', 99999, 'Donazioni'),
  ]
  const p = prova(() => m.contiPeriodo(righe, { dal: '2026-10-01', al: '2026-10-31' }, OGGI))
  ok('«al» nel futuro diventa oggi, ed è parziale', prova(() => [p.dal, p.al, p.parziale]), ['2026-10-01', OGGI, true])
  ok('si confronta con lo stesso tratto dell\'anno prima', prova(() => [p.confrontoDal, p.confrontoAl]), ['2025-10-01', '2025-10-18'])
  ok('…il 25 ottobre 2025 è fuori dal tratto', prova(() => p.prima), { entrate: 8000, uscite: 0, risultato: 8000 })
  ok('«al» che è oggi: non è parziale', prova(() => m.contiPeriodo(righe, { dal: '2026-10-01', al: OGGI }, OGGI).parziale), false)
  ok('l\'anno prima vuoto in quel tratto: nessun dato, non zero', prova(() => m.contiPeriodo(righe, { dal: '2026-10-01', al: '2026-10-04' }, OGGI).prima), null)
  ok('il 29 febbraio diventa il 28 dell\'anno prima', prova(() => { const x = m.contiPeriodo([], { dal: '2028-02-29', al: '2028-02-29' }, '2028-03-10'); return [x.confrontoDal, x.confrontoAl] }), ['2027-02-28', '2027-02-28'])
  ok('…anche in fondo a un periodo', prova(() => m.contiPeriodo([], { dal: '2028-02-01', al: '2028-02-29' }, '2028-03-10').confrontoAl), '2027-02-28')
  console.log('   da sistemare: «Da classificare», «Varie» (in qualunque modo scritta) e senza voce, solo uscite')
  ok('voceDaSistemare', prova(() => [null, 'Da classificare', 'da classificare', 'Varie', 'VARIE', ' varie ', 'Utenze', 'Varie spese'].map(m.voceDaSistemare)), [true, true, true, true, true, true, false, false])
  ok('le uscite da sistemare del periodo: quante e quanto (annullati e entrate fuori)', prova(() => p.daSistemare), { movimenti: 4, uscite: 2800 })
  ok('nessuna uscita da sistemare: null', prova(() => m.contiPeriodo([uscita('2026-10-03', 4000, 'Utenze')], { dal: '2026-10-01', al: OGGI }, OGGI).daSistemare), null)
  console.log('   i filtri')
  const u = prova(() => m.contiPeriodo(righe, { dal: '2026-10-01', al: OGGI, tipo: 'uscita' }, OGGI))
  ok('solo le uscite: le entrate sono zero, e nelle voci non ci sono', prova(() => [u.entrate, u.uscite, u.voci.every((v) => v.tipo === 'uscita')]), [0, 6800, true])
  ok('…anche nel confronto', prova(() => u.prima), null)
  const d = prova(() => m.contiPeriodo(righe, { dal: '2026-10-01', al: OGGI, voce: 'donazioni' }, OGGI))
  ok('una voce, scritta senza badare alle maiuscole: solo lei, anche nel confronto', prova(() => [d.entrate, d.uscite, d.prima?.entrate, d.voci.map((v) => v.voce)]), [10000, 0, 8000, ['Donazioni']])
  const dc = prova(() => m.contiPeriodo(righe, { dal: '2026-10-01', al: OGGI, voce: 'Da classificare', tipo: 'uscita' }, OGGI))
  ok('la voce «Da classificare» comprende i movimenti senza voce', prova(() => [dc.uscite, dc.voci.map((v) => `${v.voce}:${v.movimenti}`)]), [1700, ['Da classificare:2']])
}

console.log('\n16. il periodo a parole')
{
  ok('nello stesso mese', prova(() => m.periodoInParole('2026-10-01', '2026-10-20')), 'dal 1 al 20 ottobre 2026')
  ok('nello stesso anno', prova(() => m.periodoInParole('2026-01-01', '2026-10-20')), 'dal 1 gennaio al 20 ottobre 2026')
  ok('a cavallo di due anni', prova(() => m.periodoInParole('2025-12-01', '2026-01-31')), 'dal 1 dicembre 2025 al 31 gennaio 2026')
  ok('un giorno solo', prova(() => m.periodoInParole('2026-10-05', '2026-10-05')), 'il 5 ottobre 2026')
}

// ---------------------------------------------------------------------------
// Le uscite ancora da classificare, a gruppi (strumento `da_classificare`).
// gruppiDaClassificare(righe, voci, massimo = 20) → { gruppi, gruppiTotali, movimentiTotali }
// ---------------------------------------------------------------------------
console.log('\n17. le uscite da classificare, a gruppi')
{
  const vociG = [
    { id: 'v-dc', nome: 'Da classificare', tipo: 'uscita', diSistema: false, attiva: true },
    { id: 'v-var', nome: 'Varie', tipo: 'uscita', diSistema: false, attiva: true },
    { id: 'v-man', nome: 'Manutenzione', tipo: 'uscita', diSistema: false, attiva: true },
    { id: 'v-ut', nome: 'Utenze', tipo: 'uscita', diSistema: false, attiva: true },
    { id: 'v-tel', nome: 'Telefono', tipo: 'uscita', diSistema: false, attiva: false },
    { id: 'v-difu', nome: 'Differenza di cassa', tipo: 'uscita', diSistema: true, attiva: true },
    { id: 'v-dce', nome: 'Da classificare', tipo: 'entrata', diSistema: false, attiva: true },
  ]
  const u = (data, importo, voce, descrizione, extra = {}) => uscita(data, importo, voce, { descrizione, ...extra })
  const righe = [
    u('2026-03-01', 1000, 'Da classificare', 'Ferramenta Bianchi'),
    u('2026-05-01', 2000, 'Varie', 'FERRAMENTA   bianchi '),
    u('2026-04-01', 500, null, 'ferramenta bianchi'),
    u('2026-06-01', 9000, 'Da classificare', 'Lavori palestra'),
    u('2026-07-01', 700, 'VARIE', 'Amazon ordine'),
    u('2026-07-02', 300, 'Da classificare', 'Tim'),
    // quelli che non entrano mai
    u('2026-08-01', 50000, 'Da classificare', 'Annullato grosso', { annullato: true }),
    riga('2026-08-02', 'giroconto', 40000, null, { descrizione: 'Versamento', cassaId: 'c1', cassaAId: 'c2' }),
    entrata('2026-08-03', 30000, 'Da classificare', { descrizione: 'Entrata misteriosa' }),
    u('2026-08-04', 20000, 'Da classificare', 'Rimborso Rossi Luca', { personaId: 'p-rossi' }),
    u('2026-08-05', 15000, 'Da classificare', 'Cliente Rossi Luca per rimborso corso'),
    u('2026-08-06', 12000, 'Differenza di cassa', 'Differenza di cassa'),
    u('2026-08-07', 11000, 'Utenze', 'Enel'),
    // i simili già classificati, per la voce proposta
    u('2026-02-01', 800, 'Manutenzione', 'Ferramenta Bianchi'),
    u('2026-09-01', 800, 'Varie', 'ferramenta bianchi'),
    u('2026-01-15', 300, 'Telefono', 'TIM'),
    // Una «Differenza di cassa» con la descrizione di un gruppo, più recente: la voce proposta non è mai una di sistema.
    u('2026-09-15', 100, 'Differenza di cassa', 'Lavori palestra'),
  ]
  const g = prova(() => m.gruppiDaClassificare(righe, vociG))
  const breve = (x) => `${x.cerca}:${x.movimenti}:${x.totale}:${x.primo}:${x.ultimo}`
  ok('un gruppo per descrizione (minuscole, spazi), dal più grosso in euro', prova(() => g.gruppi.map(breve)), [
    'lavori palestra:1:9000:2026-06-01:2026-06-01',
    'ferramenta bianchi:4:4300:2026-03-01:2026-09-01',
    'amazon ordine:1:700:2026-07-01:2026-07-01',
    'tim:1:300:2026-07-02:2026-07-02',
  ])
  ok('in testa quanti gruppi e quanti movimenti in tutto', prova(() => [g.gruppiTotali, g.movimentiTotali]), [4, 7])
  ok('mai annullati, giroconti, entrate, collegati a una persona, «Cliente … per», voci di sistema, voci vere', prova(() => g.gruppi.some((x) => /annullato|versamento|misteriosa|rossi|differenza|enel/.test(x.cerca))), false)
  const fb = prova(() => g.gruppi.find((x) => x.cerca === 'ferramenta bianchi'))
  ok('le voci di partenza del gruppo, e se c\'è chi non ha voce', prova(() => [fb.voci, fb.senzaVoce]), [['Da classificare', 'Varie'], true])
  ok('la voce proposta: dal simile già classificato, mai «Varie»', prova(() => [fb.proposta, fb.avviso]), [{ id: 'v-man', nome: 'Manutenzione' }, null])
  const tim = prova(() => g.gruppi.find((x) => x.cerca === 'tim'))
  ok('se quella voce non è più in uso non la propone, e lo dice', prova(() => [tim.proposta, tim.avviso?.includes('«Telefono»')]), [null, true])
  ok('senza simili classificati, niente', prova(() => { const x = g.gruppi.find((y) => y.cerca === 'lavori palestra'); return [x.proposta, x.avviso] }), [null, null])
  const lp = prova(() => g.gruppi.find((x) => x.cerca === 'amazon ordine'))
  ok('il testo da cercare ritrova nell\'elenco (periodo «Tutto», voce di partenza) i movimenti del gruppo', prova(() => m.filtraMovimenti(righe, { testo: lp.cerca, voce: lp.voci[0] }).map((r) => r.descrizione)), ['Amazon ordine'])
  const tanti = Array.from({ length: 25 }, (_, i) => u('2026-02-02', 100 + i, 'Da classificare', `Fornitore ${i}`))
  const t = prova(() => m.gruppiDaClassificare([...tanti, u('2026-02-03', 1, 'Varie', 'fornitore 0')], vociG))
  ok('al massimo 20 gruppi, i più grossi', prova(() => [t.gruppi.length, t.gruppi[0].cerca, t.gruppi.at(-1).cerca]), [20, 'fornitore 24', 'fornitore 5'])
  ok('…ma in testa il conto di tutti', prova(() => [t.gruppiTotali, t.movimentiTotali]), [25, 26])
  ok('si può chiederne meno', prova(() => m.gruppiDaClassificare(tanti, vociG, 3).gruppi.length), 3)
  ok('niente da classificare: nessun gruppo', prova(() => { const x = m.gruppiDaClassificare([u('2026-02-02', 100, 'Utenze', 'Enel')], vociG); return [x.gruppi, x.gruppiTotali, x.movimentiTotali] }), [[], 0, 0])
}

console.log(guai ? `\n${guai} COSE NON TORNANO` : '\nTUTTO A POSTO')
process.exit(guai ? 1 : 0)
