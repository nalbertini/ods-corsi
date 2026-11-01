// ---------------------------------------------------------------------------
// Chi viene e chi si sta perdendo, senza browser.
//
//   node scripts/prova-frequenza.mjs
//
// · `src/lib/frequenza.ts`: `conto`, `percento`, `conAppello`, `DI_FILA` e
//   `chiSiStaPerdendo`, spostati da `components/segreteria/Presenze.tsx`
//   (PRESENZE e lo strumento `chi_manca` della chat li usano tutti e due).
//   Il risultato deve essere lo stesso di prima: qui sotto c'è la copia della
//   logica di Presenze.tsx com'era, e si confronta con quella.
// · `GIORNI_RECENTI`: quanto indietro guarda `chi_manca` (prova-mcp.mjs, sezione 30).
// L'età per la chat è di `chat_eta`, nel database: supabase/prova/75-chat-segreteria.sql.
// ---------------------------------------------------------------------------
import { build } from 'esbuild'

// Un modulo che non c'è ancora: si dice e si va avanti, ogni prova fallisce col suo nome.
const carica = async (percorso) => {
  try {
    const { outputFiles } = await build({
      stdin: { contents: `export * from '${percorso}'`, resolveDir: '.', loader: 'ts' },
      bundle: true,
      format: 'esm',
      platform: 'node',
      write: false,
      logLevel: 'silent',
      define: { 'import.meta.env': '{}' },
    })
    return await import('data:text/javascript;base64,' + Buffer.from(outputFiles[0].text).toString('base64'))
  } catch (e) {
    console.log(`  ✗ ${percorso} non si carica: ${e.errors?.[0]?.text ?? e.message}`)
    return {}
  }
}
const f = await carica('./src/lib/frequenza')

let guai = 0
const ok = (cosa, avuto, voluto) => {
  const va = JSON.stringify(avuto) === JSON.stringify(voluto)
  console.log(va ? '  ✓' : '  ✗', cosa, va ? '' : `— atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`)
  if (!va) guai++
}
const prova = (fn) => {
  try {
    return fn()
  } catch (e) {
    return `ERRORE: ${e.message}`
  }
}

// La logica di Presenze.tsx com'era prima dello spostamento, copiata così com'è: il metro.
const DI_FILA_OGGI = 3
const conAppelloOggi = (r) => r.appello.some((p) => p.stato !== null)
function contoOggi(righe) {
  let presenti = 0
  let dovute = 0
  for (const r of righe) {
    if (r.stato === 'annullata' || !conAppelloOggi(r)) continue
    for (const p of r.appello) {
      if (p.stato === 'giustificato') continue
      dovute++
      if (p.stato === 'presente') presenti++
    }
  }
  return { presenti, dovute }
}
function persiOggi(recenti, corso) {
  const perPersona = new Map()
  for (const r of [...recenti].sort((a, b) => a.inizio.localeCompare(b.inizio))) {
    if (r.stato === 'annullata' || !conAppelloOggi(r)) continue
    if (corso && r.corsoId !== corso) continue
    for (const x of r.appello) {
      if (x.stato === 'giustificato') continue
      const v = perPersona.get(x.personaId) ?? { nome: `${x.cognome} ${x.nome}`, segni: [] }
      v.segni.push({ stato: x.stato, corso: r.corso, inizio: r.inizio })
      perPersona.set(x.personaId, v)
    }
  }
  return [...perPersona.entries()]
    .map(([id, v]) => {
      let fila = 0
      for (let i = v.segni.length - 1; i >= 0 && v.segni[i].stato !== 'presente'; i--) fila++
      const ultima = [...v.segni].reverse().find((s) => s.stato === 'presente')
      return { id, nome: v.nome, fila, corsi: [...new Set(v.segni.slice(-fila).map((s) => s.corso))], ultima: ultima?.inizio }
    })
    .filter((x) => x.fila >= DI_FILA_OGGI)
    .sort((a, b) => b.fila - a.fila || a.nome.localeCompare(b.nome, 'it'))
}

// Le lezioni degli ultimi 60 giorni, in disordine come possono arrivare.
const P = 'presente'
const A = 'assente'
const G = 'giustificato'
const chi = {
  mario: ['p-mario', 'Mario', 'Rossi'],
  gino: ['p-gino', 'Gino', 'Bianchi'],
  lia: ['p-lia', 'Lia', 'Verdi'],
  ada: ['p-ada', 'Ada', 'Neri'],
  bruno: ['p-bruno', 'Bruno', 'Gialli'],
  zeno: ['p-zeno', 'Zeno', 'Abete'],
}
const lezione = (corsoId, giorno, segni, stato = 'svolta') => ({
  corsoId,
  corso: corsoId === 'c-judo' ? 'Judo' : 'Yoga',
  inizio: `${giorno}T16:00:00Z`,
  stato,
  appello: Object.entries(segni).map(([k, s]) => ({ personaId: chi[k][0], nome: chi[k][1], cognome: chi[k][2], stato: s })),
})
const righe = [
  lezione('c-judo', '2026-10-13', { mario: A, gino: A, ada: null, bruno: P, zeno: A }),
  lezione('c-judo', '2026-09-01', { mario: P, gino: P, lia: A }),
  lezione('c-yoga', '2026-09-03', { lia: A }),
  lezione('c-judo', '2026-09-08', { mario: A, lia: A, bruno: A, zeno: A }),
  lezione('c-yoga', '2026-09-10', { lia: A }),
  lezione('c-judo', '2026-09-15', { mario: P, gino: P, lia: P }, 'annullata'),
  lezione('c-yoga', '2026-09-17', { lia: A }),
  lezione('c-judo', '2026-09-22', { mario: A, gino: A, ada: A, bruno: A, zeno: A }),
  lezione('c-judo', '2026-09-29', { mario: null, gino: null, ada: null }),
  lezione('c-judo', '2026-10-06', { mario: A, gino: G, ada: null, bruno: A, zeno: A }),
]

console.log('1. conto, percento, conAppello')
{
  ok('DI_FILA è 3', f.DI_FILA, 3)
  ok('GIORNI_RECENTI è 60: chi si sta perdendo, negli ultimi 60 giorni', f.GIORNI_RECENTI, 60)
  ok('una lezione senza nessun segno non ha l\'appello', prova(() => f.conAppello(lezione('c-judo', '2026-09-29', { mario: null, gino: null }))), false)
  ok('…con un segno sì', prova(() => f.conAppello(lezione('c-judo', '2026-09-29', { mario: null, gino: A }))), true)
  const una = [lezione('c-judo', '2026-10-06', { mario: P, gino: A, lia: G, ada: null })]
  ok('presenti su dovute: il giustificato non conta, chi non è segnato sì', prova(() => f.conto(una)), { presenti: 1, dovute: 3 })
  ok('annullate e lezioni senza appello non contano', prova(() => f.conto([lezione('c-judo', '2026-09-15', { mario: P }, 'annullata'), lezione('c-judo', '2026-09-29', { mario: null })])), { presenti: 0, dovute: 0 })
  ok('percento: 1 su 3 è 33', prova(() => f.percento({ presenti: 1, dovute: 3 })), 33)
  ok('…niente dovute, niente percento', prova(() => f.percento({ presenti: 0, dovute: 0 })), null)
  ok('conto su tutte le lezioni: come Presenze.tsx', prova(() => f.conto(righe)), contoOggi(righe))
}

console.log('\n2. chi si sta perdendo')
{
  const tutti = prova(() => f.chiSiStaPerdendo(righe))
  ok('lo stesso risultato di Presenze.tsx, tutti i corsi', tutti, persiOggi(righe))
  ok('…solo il Judo', prova(() => f.chiSiStaPerdendo(righe, 'c-judo')), persiOggi(righe, 'c-judo'))
  ok('…solo lo Yoga', prova(() => f.chiSiStaPerdendo(righe, 'c-yoga')), persiOggi(righe, 'c-yoga'))
  ok('in ordine: più assenze di fila prima, a pari assenze per nome', prova(() => tutti.map((x) => [x.nome, x.fila])), [['Verdi Lia', 5], ['Abete Zeno', 4], ['Rossi Mario', 4], ['Neri Ada', 3]])
  const mario = prova(() => tutti.find((x) => x.id === 'p-mario'))
  ok('Mario: assente nelle ultime lezioni con l\'appello, con l\'ultima presenza e il corso', prova(() => [mario.fila, mario.ultima, mario.corsi]), [4, '2026-09-01T16:00:00Z', ['Judo']])
  ok('…l\'annullata (dove era «presente») e la lezione senza appello non rompono la fila', prova(() => mario.fila >= f.DI_FILA), true)
  ok('Gino: 2 assenze e un giustificato in mezzo, non c\'è', prova(() => tutti.some((x) => x.id === 'p-gino')), false)
  ok('Bruno: presente all\'ultima, non c\'è', prova(() => tutti.some((x) => x.id === 'p-bruno')), false)
  ok('Ada: non segnata in lezioni con l\'appello conta come assente (come oggi)', prova(() => tutti.find((x) => x.id === 'p-ada')?.fila), 3)
  ok('Lia: mai presente, nessuna ultima presenza, e i corsi della fila', prova(() => { const l = tutti.find((x) => x.id === 'p-lia'); return [l.ultima ?? null, l.corsi] }), [null, ['Judo', 'Yoga']])
  ok('Lia solo nello Yoga: 3 di fila', prova(() => f.chiSiStaPerdendo(righe, 'c-yoga').map((x) => [x.nome, x.fila, x.corsi])), [['Verdi Lia', 3, ['Yoga']]])
  ok('nessuna lezione, nessuno', prova(() => f.chiSiStaPerdendo([])), [])
  console.log('   il caso della chat: 3 assenze di fila, o 2 con un giustificato in mezzo')
  const tre = [lezione('c-judo', '2026-09-22', { mario: P, gino: P }), lezione('c-judo', '2026-09-29', { mario: A, gino: A }), lezione('c-judo', '2026-10-06', { mario: A, gino: G }), lezione('c-judo', '2026-10-13', { mario: A, gino: A })]
  ok('Mario con 3 assenze di fila c\'è, con l\'ultima presenza; Gino (2 e un giustificato) no', prova(() => f.chiSiStaPerdendo(tre).map((x) => [x.id, x.fila, x.ultima])), [['p-mario', 3, '2026-09-22T16:00:00Z']])
  console.log('   gli elenchi lunghi di PRESENZE: le prime voci e «Mostra tutti»')
  const venti = Array.from({ length: 20 }, (_, i) => i)
  ok('accorciato: le prime 5 e quante restano', prova(() => { const a = f.accorcia(venti, 5, false); return [a.visibili, a.nascoste] }), [[0, 1, 2, 3, 4], 15])
  ok('«Mostra tutti»: c\'è tutto, niente nascosto', prova(() => { const a = f.accorcia(venti, 5, true); return [a.visibili.length, a.nascoste] }), [20, 0])
  ok('un elenco già corto non nasconde niente', prova(() => { const a = f.accorcia([1, 2, 3], 5, false); return [a.visibili, a.nascoste] }), [[1, 2, 3], 0])
  ok('esattamente al limite: niente nascosto', prova(() => f.accorcia([1, 2, 3, 4, 5], 5, false).nascoste), 0)
  ok('elenco vuoto', prova(() => { const a = f.accorcia([], 5, false); return [a.visibili, a.nascoste] }), [[], 0])
}

console.log('   il sottotitolo di CHI SI STA PERDENDO: dice da quanto guarda, perché non segue il filtro del mese')
{
  const sotto = typeof f.sottoPersi === 'function' ? f.sottoPersi() : 'manca sottoPersi'
  ok('dice le assenze di fila e i giorni', sotto, '3 assenze di fila o più, negli ultimi 60 giorni')
  ok('i numeri sono quelli della regola, non scritti a mano', sotto, `${f.DI_FILA} assenze di fila o più, negli ultimi ${f.GIORNI_RECENTI} giorni`)
}

console.log(guai ? `\n${guai} COSE NON TORNANO` : '\nTUTTO A POSTO')
process.exit(guai ? 1 : 0)
