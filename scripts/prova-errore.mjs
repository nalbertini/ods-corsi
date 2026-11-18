// ---------------------------------------------------------------------------
// La schermata d'errore, provata senza browser.
//
//   node scripts/prova-errore.mjs
//
// Un errore mentre si disegna una pagina non deve lasciare lo schermo bianco,
// e soprattutto non deve far perdere le presenze ancora in coda. Qui si prova
// la logica (`src/lib/schermataErrore.ts`: che cosa dire e quali tasti dare,
// mai il testo grezzo dell'errore) e la parte della coda che serve al confine
// (`soloInMemoriaDiTutte` in `src/lib/coda.ts`). Il confine in sé, in .tsx, si
// limita a mostrare e a chiamare.
// ---------------------------------------------------------------------------
import { build } from 'esbuild'

let guai = 0
const ok = (cosa, avuto, voluto) => {
  const va = JSON.stringify(avuto) === JSON.stringify(voluto)
  console.log(va ? '  ✓' : '  ✗', cosa, va ? '' : `— atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`)
  if (!va) guai++
}
const errore = (cosa, f) => {
  let lanciato = false
  try { f() } catch { lanciato = true }
  ok(cosa, lanciato, true)
}

const compila = async (contents) => {
  const { outputFiles } = await build({
    stdin: { contents, resolveDir: '.', loader: 'ts' },
    bundle: true,
    format: 'esm',
    write: false,
    logLevel: 'silent',
  })
  return outputFiles[0].text
}
// Ogni import di un testo uguale sarebbe lo stesso modulo in cache: il
// commento in coda lo rende un modulo nuovo, come una pagina ricaricata.
let giro = 0
const importa = (testo) =>
  import('data:text/javascript;base64,' + Buffer.from(testo + `\n// giro ${giro++}`).toString('base64'))

// --- Finto browser: localStorage (che può smettere di scrivere) e window -----
const memoria = new Map()
let scritturaRotta = false
globalThis.localStorage = {
  getItem: (k) => (memoria.has(k) ? memoria.get(k) : null),
  setItem: (k, v) => {
    if (scritturaRotta) throw new Error('QuotaExceededError')
    memoria.set(k, String(v))
  },
  removeItem: (k) => memoria.delete(k),
}
globalThis.window = { addEventListener: () => {} }
const attesa = () => new Promise((r) => setTimeout(r, 10))

// ===========================================================================
// 1. Le schermate
// ===========================================================================
let m = null
try {
  m = await importa(await compila("export * from './src/lib/schermataErrore'"))
} catch (e) {
  console.log('  ✗ manca src/lib/schermataErrore.ts (o non compila):', String(e.message).split('\n')[0])
  guai++
}

if (m) {
  const base = { dispositivo: 'telefono', cosa: 'presenze', inCoda: 0, soloInMemoria: 0, pezzoMancante: false, ripetuto: false, mandando: false }
  const s = (resto) => m.schermataErrore({ ...base, ...resto })
  const tasti = (x) => x.tasti.map((t) => [t.etichetta, t.azione, t.variante, t.disabilitato])

  console.log('P1 A, niente in coda')
  {
    const x = s({})
    ok('titolo', x.titolo, 'LA PAGINA SI È BLOCCATA')
    ok('testo', x.testo, 'Con RICARICA riparte da capo. Non perdi niente di quello che è già arrivato.')
    ok('un tasto RICARICA principale', tasti(x), [['RICARICA', 'ricarica', 'principale', false]])
  }

  console.log('P2 B, con la coda')
  ok('telefono, 2 presenze', s({ inCoda: 2 }).testo,
    'Con RICARICA riparte da capo. Le 2 presenze non ancora arrivate restano su questo telefono e partono da sole appena c’è rete.')
  ok('computer, 2 cose', s({ dispositivo: 'computer', cosa: 'cose', inCoda: 2 }).testo,
    'Con RICARICA riparte da capo. Le 2 cose non ancora arrivate restano su questo computer e partono da sole appena c’è rete.')
  ok('singolare, presenza', s({ inCoda: 1 }).testo,
    'Con RICARICA riparte da capo. La presenza non ancora arrivata resta su questo telefono e parte da sola appena c’è rete.')
  ok('singolare, cosa', s({ dispositivo: 'computer', cosa: 'cose', inCoda: 1 }).testo,
    'Con RICARICA riparte da capo. La cosa non ancora arrivata resta su questo computer e parte da sola appena c’è rete.')
  ok('titolo di B come A', s({ inCoda: 2 }).titolo, 'LA PAGINA SI È BLOCCATA')
  ok('B ha RICARICA principale', tasti(s({ inCoda: 2 })), [['RICARICA', 'ricarica', 'principale', false]])

  console.log('P3 C, tablet')
  {
    const x = s({ dispositivo: 'tablet', inCoda: 3 })
    ok('testo con 3 presenze', x.testo,
      'Tocca RICARICA e l’appello riparte. Le 3 presenze non ancora arrivate restano su questo tablet e partono da sole appena c’è rete.')
    ok('un tasto RICARICA principale', tasti(x), [['RICARICA', 'ricarica', 'principale', false]])
    ok('tablet senza coda', s({ dispositivo: 'tablet' }).testo,
      'Tocca RICARICA e l’appello riparte. Non perdi niente di quello che è già arrivato.')
  }

  console.log('P4 D, scritture solo in memoria')
  {
    const x = s({ dispositivo: 'tablet', inCoda: 3, soloInMemoria: 3 })
    ok('titolo plurale', x.titolo, '3 PRESENZE NON SONO ANCORA ARRIVATE')
    ok('testo plurale', x.testo, 'Questo tablet non riesce a tenerle da parte: ricaricando adesso si perdono. Prima prova a mandarle.')
    ok('tasti: manda, poi ricarica lo stesso', tasti(x), [
      ['PROVA A MANDARLE', 'manda', 'principale', false],
      ['RICARICA LO STESSO', 'ricaricaLoStesso', 'linea', false],
    ])
    const uno = s({ dispositivo: 'tablet', inCoda: 1, soloInMemoria: 1 })
    ok('titolo singolare', uno.titolo, '1 PRESENZA NON È ANCORA ARRIVATA')
    ok('testo singolare', uno.testo, 'Questo tablet non riesce a tenerla da parte: ricaricando adesso si perde. Prima prova a mandarla.')
    ok('titolo con le cose', s({ cosa: 'cose', inCoda: 3, soloInMemoria: 3 }).titolo, '3 COSE NON SONO ANCORA ARRIVATE')
    for (const d of ['telefono', 'tablet', 'computer']) {
      const y = s({ dispositivo: d, inCoda: 2, soloInMemoria: 2 })
      ok(`${d}: D senza un RICARICA semplice`, y.tasti.some((t) => t.azione === 'ricarica'), false)
    }
  }

  console.log('P5 E, sta mandando')
  for (const cosa of ['presenze', 'cose']) {
    const stato = { cosa, dispositivo: 'tablet', inCoda: 3, soloInMemoria: 3 }
    const prima = s(stato)
    const x = s({ ...stato, mandando: true })
    ok(`${cosa}: stesso titolo di D`, x.titolo, prima.titolo)
    ok(`${cosa}: stesso testo di D`, x.testo, prima.testo)
    ok(`${cosa}: un solo tasto, disabilitato`, [x.tasti.length, x.tasti[0]?.disabilitato], [1, true])
    ok(`${cosa}: etichetta`, x.tasti[0]?.etichetta, cosa === 'presenze' ? 'STO MANDANDO LE PRESENZE…' : 'STO MANDANDO…')
  }

  console.log('P6 F, il pezzo di pagina non arriva')
  {
    const x = s({ pezzoMancante: true })
    ok('titolo', x.titolo, 'NON RIESCO A CARICARE LA PAGINA')
    ok('testo', x.testo, 'Di solito è la rete o un aggiornamento appena uscito. Controlla la connessione e tocca RICARICA.')
    ok('un tasto RICARICA principale', tasti(x), [['RICARICA', 'ricarica', 'principale', false]])
    ok('con la coda', s({ pezzoMancante: true, inCoda: 2 }).testo,
      'Di solito è la rete o un aggiornamento appena uscito. Controlla la connessione e tocca RICARICA. Le 2 presenze non ancora arrivate restano su questo telefono e partono da sole appena c’è rete.')
    ok('D vince su F', s({ pezzoMancante: true, inCoda: 2, soloInMemoria: 2 }).titolo, '2 PRESENZE NON SONO ANCORA ARRIVATE')
  }

  console.log('P7 G, il blocco ritorna')
  {
    const x = s({ ripetuto: true })
    ok('titolo', x.titolo, 'SUCCEDE ANCORA')
    ok('testo', x.testo, 'Avvisa la segreteria.')
    ok('RICARICA in linea', tasti(x), [['RICARICA', 'ricarica', 'linea', false]])
    ok('con la coda', s({ dispositivo: 'tablet', inCoda: 3, ripetuto: true }).testo,
      'Avvisa la segreteria. Le 3 presenze non ancora arrivate restano su questo tablet e partono da sole appena c’è rete.')
    ok('D vince su G', s({ inCoda: 2, soloInMemoria: 2, ripetuto: true }).titolo, '2 PRESENZE NON SONO ANCORA ARRIVATE')
  }

  console.log('P8 I, il timer')
  {
    const t = m.schermataTimer(true)
    ok('nel tablet: titolo', t.titolo, 'IL TIMER SI È BLOCCATO')
    ok('nel tablet: testo', t.testo, 'L’appello e le presenze non sono toccati. Torna all’appello, o ricarica il timer.')
    ok('nel tablet: tasti', tasti(t), [
      ['TORNA ALL’APPELLO', 'tornaAllAppello', 'principale', false],
      ['RICARICA IL TIMER', 'ricarica', 'linea', false],
    ])
    const solo = m.schermataTimer(false)
    ok('da solo: titolo', solo.titolo, 'IL TIMER SI È BLOCCATO')
    ok('da solo: testo', solo.testo, 'Con RICARICA riparte da capo.')
    ok('da solo: un tasto', tasti(solo), [['RICARICA', 'ricarica', 'principale', false]])
  }

  console.log('P9 nessun testo grezzo')
  {
    const grezzo = /errore|error|eccezione|bug|undefined/i
    const grezzoCasuale = /null|NaN/
    const MESSAGGIO = 'Cannot read properties of undefined (reading SEGRETO-DELL-API)'
    const tutte = []
    for (const dispositivo of ['telefono', 'tablet', 'computer'])
      for (const cosa of ['presenze', 'cose'])
        for (const inCoda of [0, 1, 2])
          for (const soloInMemoria of [0, 1, 3])
            for (const pezzoMancante of [false, true])
              for (const ripetuto of [false, true])
                for (const mandando of [false, true])
                  tutte.push(m.schermataErrore({ dispositivo, cosa, inCoda, soloInMemoria, pezzoMancante, ripetuto, mandando }))
    tutte.push(m.schermataTimer(true), m.schermataTimer(false))
    const brutte = tutte.filter((x) => {
      const parole = [x.titolo, x.testo, ...x.tasti.map((t) => t.etichetta)].join(' | ')
      return grezzo.test(parole) || grezzoCasuale.test(parole) || parole.includes('SEGRETO')
    })
    ok(`${tutte.length} combinazioni senza parole tecniche`, brutte.length, 0)
    ok('ogni schermata ha almeno un tasto', tutte.filter((x) => !x.tasti.length).length, 0)
    ok('D e E mai con un RICARICA semplice', tutte.filter((x, i) => i < tutte.length - 2 && /NON (SONO|È) ANCORA ARRIVAT/.test(x.titolo) && x.tasti.some((t) => t.azione === 'ricarica')).length, 0)
    void MESSAGGIO
  }

  console.log('P10 ripetuto')
  const ORA = 1_000_000
  ok('mai ricaricata', m.ripetuto(null, ORA), false)
  ok('stringa vuota', m.ripetuto('', ORA), false)
  ok('non è un numero', m.ripetuto('boh', ORA), false)
  ok('10 secondi fa', m.ripetuto(String(ORA - 10_000), ORA), true)
  ok('31 secondi fa', m.ripetuto(String(ORA - 31_000), ORA), false)

  console.log('P11 dopo aver mandato')
  ok('niente più solo in memoria: ricarica', m.dopoAverMandato(0), 'ricarica')
  ok('ne restano 2: resta sulla schermata', m.dopoAverMandato(2), 'resta')

  console.log('P12 errori di un pezzo che non arriva')
  const nome = (name, message) => Object.assign(new Error(message), { name })
  ok('Failed to fetch dynamically imported module', m.eErrorePezzo(new TypeError('Failed to fetch dynamically imported module: https://x/a.js')), true)
  ok('Importing a module script failed', m.eErrorePezzo(new TypeError('Importing a module script failed.')), true)
  ok('error loading dynamically imported module', m.eErrorePezzo(new TypeError('error loading dynamically imported module')), true)
  ok('ChunkLoadError', m.eErrorePezzo(nome('ChunkLoadError', 'Loading chunk 3 failed')), true)
  ok('un TypeError qualunque', m.eErrorePezzo(new TypeError('x is not a function')), false)
  ok('null', m.eErrorePezzo(null), false)
  ok('una stringa', m.eErrorePezzo('Failed to fetch dynamically imported module'), false)

  console.log('P14 dove si blocca')
  const dove = (area, largo) => (typeof m.doveSiBlocca === 'function' ? m.doveSiBlocca(area, largo) : 'manca doveSiBlocca')
  ok('la sala è il tablet, con le presenze', dove('sala', true), { dispositivo: 'tablet', cosa: 'presenze', luogo: 'TABLET DI SALA' })
  ok('la sala resta tablet anche stretta', dove('sala', false).dispositivo, 'tablet')
  ok('istruttori al telefono: presenze', dove('istruttori', false), { dispositivo: 'telefono', cosa: 'presenze', luogo: 'ISTRUTTORI' })
  ok('segreteria larga: computer, cose', dove('segreteria', true), { dispositivo: 'computer', cosa: 'cose', luogo: 'SEGRETERIA' })
  ok('iscritti al telefono', dove('iscritti', false), { dispositivo: 'telefono', cosa: 'cose', luogo: 'ISCRITTI' })
  ok('la scelta dell’area dice CORSI', dove('scelta', false).luogo, 'CORSI')
}

// ===========================================================================
// 2. La coda: quante scritture stanno solo in memoria
// ===========================================================================
console.log('P13 coda')
const testoCoda = await compila("export * from './src/lib/coda'")
const senzaRete = async () => { throw new Error('niente rete') }
const sul_disco = (dove) => JSON.parse(memoria.get(dove) ?? '[]').length
const solo = (c) => (typeof c.soloInMemoriaDiTutte === 'function' ? c.soloInMemoriaDiTutte() : 'manca soloInMemoriaDiTutte')

{
  memoria.clear()
  scritturaRotta = false
  const c = await importa(testoCoda)
  const sala = new c.Coda(senzaRete, 'ods-corsi:coda-sala')
  ok('prima di tutto niente solo in memoria', solo(c), 0)

  scritturaRotta = true
  sala.accoda('segna:s1:p1', 'segna', ['s1', 'p1', 'presente'])
  sala.accoda('segna:s1:p2', 'segna', ['s1', 'p2', 'presente'])
  await attesa()
  ok('setItem che lancia: 2 solo in memoria', solo(c), 2)
  ok('e sono comunque 2 in coda', c.inCodaDiTutte(), 2)
  ok('su disco non c’è niente', sul_disco('ods-corsi:coda-sala'), 0)

  scritturaRotta = false
  sala.accoda('segna:s1:p3', 'segna', ['s1', 'p3', 'presente'])
  await attesa()
  ok('una scrittura riuscita: torna 0', solo(c), 0)
  ok('su disco ci sono 3 operazioni', sul_disco('ods-corsi:coda-sala'), 3)
  ok('e 3 in coda', c.inCodaDiTutte(), 3)
}

{
  memoria.clear()
  scritturaRotta = true
  const c = await importa(testoCoda)
  const timer = new c.Coda(senzaRete, 'ods-timer:coda')
  timer.accoda('k1', 'segna', ['s1'])
  await attesa()
  ok('la coda del timer non conta come solo in memoria', solo(c), 0)
  ok('né come in coda dell’app', c.inCodaDiTutte(), 0)
  scritturaRotta = false
}

{
  // Il confine ricarica la pagina: quel che è su disco deve ritrovarsi.
  memoria.clear()
  scritturaRotta = false
  const prima = await importa(testoCoda)
  const sala = new prima.Coda(senzaRete, 'ods-corsi:coda-sala')
  for (const p of ['p1', 'p2', 'p3']) sala.accoda(`segna:s1:${p}`, 'segna', ['s1', p, 'presente'])
  await attesa()
  const dopo = await importa(testoCoda)   // pagina ricaricata: modulo nuovo, registro vuoto
  const rinata = new dopo.Coda(senzaRete, 'ods-corsi:coda-sala')
  ok('dopo il ricarico la nuova coda ritrova 3 operazioni', rinata.inAttesa, 3)
  ok('inCodaDiTutte le vede', dopo.inCodaDiTutte(), 3)
  ok('niente è solo in memoria', solo(dopo), 0)
  ok('su disco restano 3 operazioni', sul_disco('ods-corsi:coda-sala'), 3)
}

console.log(guai ? `\n${guai} PROBLEMI` : '\nTUTTO A POSTO')
process.exit(guai ? 1 : 0)
