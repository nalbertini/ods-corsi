// ---------------------------------------------------------------------------
// GLI ESERCIZI DALL'ANTEPRIMA del timer, senza browser.
//
//   node scripts/prova-anteprima.mjs
//
// Gli esercizi si scelgono toccando le righe dell'anteprima, non in un
// elenco a parte (`timer/src/lib/anteprima.ts`): la riga di un round dice
// quale esercizio è (`esercizioId`), il tocco lo cambia o, se il round non
// ne ha ancora uno, ne aggiunge uno. Amrap e for time hanno un solo
// intervallo: lì c'è una riga per esercizio.
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

const { applicaScelta, righeAnteprima } = await importa(`
  import { applicaScelta, righeAnteprima } from './timer/src/lib/anteprima'
  export { applicaScelta, righeAnteprima }
`)

const ex = (id, name, extra = {}) => ({ id, name, ...extra })
const timer = (extra = {}) => ({
  id: 't', name: 'T', mode: 'interval', prepare: 20, work: 60, rest: 10, rounds: 4, sets: 1, setRest: 0,
  cooldown: 0, duration: 600, exercises: [], updatedAt: 0, ...extra,
})
const nomi = (l) => l.map((e) => e.name)

console.log('Cosa succede toccando una riga')
await prova('un round che ha il suo esercizio: lo cambia, stessa riga', () =>
  nomi(applicaScelta([ex('a', 'Uchi komi'), ex('b', 'Burpee')], 'b', ['Squat'])), ['Uchi komi', 'Squat'])
await prova('cambiare esercizio non porta con sé l’obiettivo del vecchio', () =>
  applicaScelta([ex('a', 'Squat', { sets: 3, reps: 10, kg: 20 })], 'a', ['Plank'])[0], { id: 'a', name: 'Plank' })
await prova('cambiare esercizio tiene serie e durata della riga', () =>
  applicaScelta([ex('a', 'Squat', { serie: 2, duration: 45, reps: 5 })], 'a', ['Plank'])[0], { id: 'a', name: 'Plank', duration: 45, serie: 2 })
await prova('un round senza esercizio: ne aggiunge uno in fondo', () =>
  nomi(applicaScelta([ex('a', 'Uchi komi')], undefined, ['Burpee'])), ['Uchi komi', 'Burpee'])
await prova('più esercizi scelti su una riga: il primo la cambia, gli altri vanno in fondo', () =>
  nomi(applicaScelta([ex('a', 'Uchi komi'), ex('b', 'Ukemi')], 'a', ['Squat', 'Plank'])), ['Squat', 'Ukemi', 'Plank'])
await prova('guardando una serie, i nuovi esercizi vanno solo in quella', () =>
  applicaScelta([], undefined, ['Squat'], 2).map((e) => e.serie), [2])
await prova('guardando tutte, i nuovi esercizi valgono per tutte', () =>
  applicaScelta([], undefined, ['Squat']).map((e) => e.serie), [undefined])
await prova('non cambia l’elenco di partenza', () => {
  const prima = [ex('a', 'Uchi komi')]
  applicaScelta(prima, 'a', ['Squat'])
  return prima[0].name
}, 'Uchi komi')

console.log('\nLe righe dell’anteprima')
await prova('un solo esercizio su 4 round: tutti i round hanno il suo id', () =>
  righeAnteprima(timer({ exercises: [ex('a', 'Uchi komi')] }), 0)
    .filter((r) => r.segment.kind === 'work').map((r) => r.esercizioId ?? null), ['a', 'a', 'a', 'a'])
await prova('due esercizi si alternano per id', () =>
  righeAnteprima(timer({ exercises: [ex('a', 'A'), ex('b', 'B')] }), 0)
    .filter((r) => r.segment.kind === 'work').map((r) => r.esercizioId), ['a', 'b', 'a', 'b'])
await prova('senza esercizi le righe di lavoro non hanno id', () =>
  righeAnteprima(timer(), 0).filter((r) => r.segment.kind === 'work').map((r) => r.esercizioId ?? null), [null, null, null, null])
await prova('recuperi e preparati non hanno id', () =>
  righeAnteprima(timer({ exercises: [ex('a', 'A')] }), 0).filter((r) => r.segment.kind !== 'work').map((r) => r.esercizioId ?? null), [null, null, null, null])
await prova('circuito: una riga per stazione', () =>
  righeAnteprima(timer({ mode: 'circuit', rounds: 1, exercises: [ex('a', 'A'), ex('b', 'B')] }), 0)
    .filter((r) => r.segment.kind === 'work').map((r) => r.esercizioId), ['a', 'b'])
await prova('amrap: una riga per esercizio, la durata solo sulla prima', () =>
  righeAnteprima(timer({ mode: 'amrap', exercises: [ex('a', 'A'), ex('b', 'B')] }), 0)
    .filter((r) => r.segment.kind === 'work').map((r) => [r.esercizioId, r.durata]), [['a', true], ['b', false]])
await prova('amrap senza esercizi: una riga libera, senza id', () =>
  righeAnteprima(timer({ mode: 'amrap' }), 0).filter((r) => r.segment.kind === 'work').map((r) => [r.esercizioId ?? null, r.durata]), [[null, true]])
await prova('guardando una serie, solo le sue righe, senza preparati', () =>
  righeAnteprima(timer({ sets: 2, setRest: 30, rounds: 1, exercises: [ex('a', 'A', { serie: 1 }), ex('b', 'B', { serie: 2 })] }), 2)
    .map((r) => [r.segment.kind, r.esercizioId ?? null]), [['work', 'b']])

console.log(guai ? `\n${guai} ${guai === 1 ? 'cosa non torna' : 'cose non tornano'}` : '\nTUTTO A POSTO')
process.exit(guai ? 1 : 0)
