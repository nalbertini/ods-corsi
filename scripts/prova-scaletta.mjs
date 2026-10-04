// ---------------------------------------------------------------------------
// LA SCALETTA E LA LINEA DEL TEMPO del timer, senza browser.
//
//   node scripts/prova-scaletta.mjs
//
// (`timer/src/lib/scaletta.ts`) Dal segmento in corso: quali righe mostrare
// (il corrente e i successivi, mai i fatti), la linea con un blocco per
// segmento e la scritta del giro. Il giro in più di Maurizio (`extra`) è una
// sorpresa: non compare fra i successivi e non sposta la linea.
// ---------------------------------------------------------------------------
import { build } from 'esbuild'

const importa = async (contents) => {
  const { outputFiles } = await build({
    stdin: { contents, resolveDir: '.', loader: 'ts' },
    bundle: true,
    format: 'esm',
    write: false,
    logLevel: 'silent',
  })
  return import('data:text/javascript;base64,' + Buffer.from(outputFiles[0].text).toString('base64'))
}

let guai = 0
const ok = (cosa, avuto, voluto) => {
  const va = JSON.stringify(avuto) === JSON.stringify(voluto)
  console.log(va ? '  ✓' : '  ✗', cosa, va ? '' : `— atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`)
  if (!va) guai++
}
const prova = async (cosa, f, voluto) => {
  let avuto
  try {
    avuto = await f()
  } catch (e) {
    avuto = `ERRORE: ${e.message}`
  }
  ok(cosa, avuto, voluto)
}

const { righeScaletta, lineaDelTempo, giroCorrente, oraDiFine, righeDaMostrare, buildSegments } = await importa(`
  import { righeScaletta, lineaDelTempo, giroCorrente, oraDiFine, righeDaMostrare } from './timer/src/lib/scaletta'
  import { buildSegments } from './timer/src/lib/engine'
  export { righeScaletta, lineaDelTempo, giroCorrente, oraDiFine, righeDaMostrare, buildSegments }
`)

const timer = (extra = {}) => ({
  id: 't', name: 'T', mode: 'interval', prepare: 10, work: 40, rest: 20, rounds: 3, sets: 1, setRest: 0,
  cooldown: 0, duration: 600, exercises: [], updatedAt: 0, ...extra,
})
// prepare 10, lavoro 40, recupero 20, lavoro 40, recupero 20, lavoro 40
const base = () => buildSegments(timer())
const conExtra = (segs, dopo) => [...segs.slice(0, dopo + 1), { ...segs[dopo], kind: 'work', label: 'ANCORA UNO', name: '', duration: 30, extra: 0 }, ...segs.slice(dopo + 1)]
const riga = (kind, nome, durata, corrente = false) => ({ kind, nome, durata, corrente })

console.log('Le righe della scaletta')
await prova('prima di avviare (-1) il corrente è il primo segmento', () =>
  righeScaletta(base(), -1, 3).righe.map((r) => [r.nome, r.corrente]), [['PREPARATI', true], ['Lavoro', false], ['RECUPERO', false]])
await prova('interval 3 round: righe intere con kind, nome e durata', () =>
  righeScaletta(base(), 0, 6), {
    righe: [riga('prepare', 'PREPARATI', 10, true), riga('work', 'Lavoro', 40), riga('rest', 'RECUPERO', 20),
      riga('work', 'Lavoro', 40), riga('rest', 'RECUPERO', 20), riga('work', 'Lavoro', 40)],
    altri: 0, altriSecondi: 0,
  })
await prova('a metà i segmenti fatti spariscono', () =>
  righeScaletta(base(), 3, 6).righe.map((r) => [r.kind, r.corrente]), [['work', true], ['rest', false], ['work', false]])
await prova('il corrente è l’ultimo: nessun altro', () =>
  righeScaletta(base(), 5, 4), { righe: [riga('work', 'Lavoro', 40, true)], altri: 0, altriSecondi: 0 })
await prova('quelli che non entrano finiscono in altri, con i secondi', () => {
  const r = righeScaletta(base(), 0, 3)
  return [r.righe.length, r.altri, r.altriSecondi]
}, [3, 3, 100])
await prova('massimo 1: solo il corrente, il resto in altri', () => {
  const r = righeScaletta(base(), 1, 1)
  return [r.righe.length, r.righe[0].corrente, r.altri, r.altriSecondi]
}, [1, true, 4, 120])
await prova('un extra fra i successivi è nascosto e non conta in altri', () => {
  const r = righeScaletta(conExtra(base(), 1), 1, 2)
  return [r.righe.map((x) => x.kind), r.altri, r.altriSecondi]
}, [['work', 'rest'], 3, 100])
await prova('un extra come corrente si mostra, e il dopo prosegue', () => {
  const r = righeScaletta(conExtra(base(), 1), 2, 3)
  return [r.righe[0].corrente, r.righe[0].durata, r.righe.length, r.righe[1].kind]
}, [true, 30, 3, 'rest'])
await prova('+30 secondi: la riga corrente mostra la durata più lunga', () => {
  const s = base().map((x, i) => (i === 1 ? { ...x, duration: x.duration + 30 } : x))
  return righeScaletta(s, 1, 2).righe[0].durata
}, 70)
await prova('AMRAP con nome lungo: il nome passa intero', () => {
  const nome = 'Squat · Burpee · Trazioni · Affondi · Plank · Kettlebell swing'
  const s = buildSegments(timer({ mode: 'amrap', duration: 600, exercises: nome.split(' · ').map((n, i) => ({ id: String(i), name: n })) }))
  return righeScaletta(s, 1, 2).righe[0].nome
}, 'Squat · Burpee · Trazioni · Affondi · Plank · Kettlebell swing')
await prova('FOR TIME senza esercizi: «Giro libero» intero', () =>
  righeScaletta(buildSegments(timer({ mode: 'fortime', duration: 600 })), 1, 3).righe[0].nome, 'Giro libero')
await prova('circuito: ogni stazione una riga col suo nome', () =>
  righeScaletta(buildSegments(timer({ mode: 'circuit', rounds: 1, prepare: 0, exercises: [{ id: 'a', name: 'Squat' }, { id: 'b', name: 'Plank' }] })), 0, 5)
    .righe.filter((r) => r.kind === 'work').map((r) => r.nome), ['Squat', 'Plank'])
await prova('un lavoro senza nome usa l’etichetta', () =>
  righeScaletta([{ ...base()[1], name: '' }], 0, 1).righe[0].nome, 'LAVORO')
await prova('un recupero usa l’etichetta, non il nome', () =>
  righeScaletta(base(), 2, 1).righe[0].nome, 'RECUPERO')
await prova('lista vuota: niente righe', () => righeScaletta([], 0, 3), { righe: [], altri: 0, altriSecondi: 0 })
await prova('allenamento finito (indice oltre la fine): niente righe', () => righeScaletta(base(), 6, 3).righe, [])
await prova('non muta i segmenti e dà la stessa uscita', () => {
  const s = base()
  const copia = JSON.stringify(s)
  const a = righeScaletta(s, 2, 3)
  return [JSON.stringify(s) === copia, JSON.stringify(righeScaletta(s, 2, 3)) === JSON.stringify(a)]
}, [true, true])

console.log('\nLa linea del tempo')
await prova('un blocco per segmento con la sua durata', () =>
  lineaDelTempo(base(), 0, 0).map((b) => [b.kind, b.durata]), [['prepare', 10], ['work', 40], ['rest', 20], ['work', 40], ['rest', 20], ['work', 40]])
await prova('fatti pieni, corrente a metà, il resto vuoto', () =>
  lineaDelTempo(base(), 2, 0.5).map((b) => b.riempito), [1, 1, 0.5, 0, 0, 0])
await prova('prima di avviare (-1) è tutto vuoto', () =>
  lineaDelTempo(base(), -1, 0.7).map((b) => b.riempito), [0, 0, 0, 0, 0, 0])
await prova('il progresso si tiene fra 0 e 1', () =>
  [lineaDelTempo(base(), 1, 1.8)[1].riempito, lineaDelTempo(base(), 1, -0.3)[1].riempito], [1, 0])
await prova('gli extra non hanno un blocco', () =>
  lineaDelTempo(conExtra(base(), 1), 0, 0).length, 6)
await prova('corrente è un extra: la barra non si sposta', () =>
  lineaDelTempo(conExtra(base(), 1), 2, 0.5).map((b) => b.riempito), [1, 1, 0, 0, 0, 0])
await prova('dopo l’extra il segmento riprende dal suo posto', () =>
  lineaDelTempo(conExtra(base(), 1), 3, 0.5).map((b) => b.riempito), [1, 1, 0.5, 0, 0, 0])
await prova('indice oltre la fine: tutto pieno', () =>
  lineaDelTempo(base(), 6, 0).map((b) => b.riempito), [1, 1, 1, 1, 1, 1])
await prova('lista vuota: nessun blocco', () => lineaDelTempo([], 0, 0), [])
await prova('non muta i segmenti', () => {
  const s = base()
  const copia = JSON.stringify(s)
  lineaDelTempo(s, 2, 0.5)
  return JSON.stringify(s) === copia
}, true)

console.log('\nLa scritta del giro')
await prova('giro 3 di 8, con gli spazi attorno alla barra', () =>
  giroCorrente({ ...base()[1], round: 3, rounds: 8 }), '3 / 8')
await prova('nei preparati (round 0) conta come giro 1', () => giroCorrente(base()[0]), '1 / 3')
await prova('senza segmento: un trattino', () => giroCorrente(null), '—')

console.log("L'ora di fine")
const alle = (h, m) => new Date(2026, 9, 4, h, m, 0).getTime()
await prova('17:30 più mezz\'ora: 18:00', () => oraDiFine(alle(17, 30), 1800), '18:00')
await prova('i secondi non arrotondano: 17:30 più 32 minuti e mezzo è 18:02', () => oraDiFine(alle(17, 30), 1950), '18:02')
await prova('passa la mezzanotte: 23:50 più venti minuti è 00:10', () => oraDiFine(alle(23, 50), 1200), '00:10')

console.log('Quante righe entrano')
await prova('di fianco, schermo normale: tre', () => righeDaMostrare({ verticale: false, poco: false, alto: false }), 3)
await prova('di fianco, schermo alto: cinque', () => righeDaMostrare({ verticale: false, poco: false, alto: true }), 5)
await prova('in verticale, schermo normale: due', () => righeDaMostrare({ verticale: true, poco: false, alto: false }), 2)
await prova('in verticale, schermo alto: quattro', () => righeDaMostrare({ verticale: true, poco: false, alto: true }), 4)
await prova('dove l\'altezza non basta: nessuna, in qualunque orientamento', () =>
  [righeDaMostrare({ verticale: true, poco: true, alto: false }), righeDaMostrare({ verticale: false, poco: true, alto: true })], [0, 0])

console.log(guai ? `\n${guai} ${guai === 1 ? 'cosa non torna' : 'cose non tornano'}` : '\nTUTTO A POSTO')
process.exit(guai ? 1 : 0)
