// ---------------------------------------------------------------------------
// LE MIE ORE dell'area istruttori, senza browser.
//
//   node scripts/prova-ore.mjs
//
// L'istruttore vede mese per mese le lezioni che in segreteria risultano sue
// (`src/lib/ore.ts`): lezioni e ore delle confermate, quante da confermare,
// le rifiutate con chi e quando, e a parte le lezioni tenute in cui era
// previsto e nessuno si è segnato. Il mese è quello della lezione, non di
// quando è stata confermata. In fondo `mieOre` dei dati di prova, che legge
// quello che decide la segreteria di prova.
// ---------------------------------------------------------------------------
import { build } from 'esbuild'

// Il giorno della lezione è quello di Roma, anche su una macchina in UTC.
process.env.TZ = 'Europe/Rome'

const importa = async (contents) => {
  const { outputFiles } = await build({
    stdin: { contents, resolveDir: '.', loader: 'ts' },
    bundle: true,
    format: 'esm',
    write: false,
    logLevel: 'silent',
    // Senza Vite `import.meta.env` non c'è: vuoto vuol dire «modalità prova».
    define: { 'import.meta.env': '{}' },
  })
  return import('data:text/javascript;base64,' + Buffer.from(outputFiles[0].text).toString('base64'))
}

const memoria = new Map()
globalThis.localStorage = {
  getItem: (k) => (memoria.has(k) ? memoria.get(k) : null),
  setItem: (k, v) => memoria.set(k, String(v)),
  removeItem: (k) => memoria.delete(k),
}
globalThis.window = { location: { search: '', hash: '' }, addEventListener() {} }

// Oggi, per la prova, è sabato 26 settembre 2026 a mezzogiorno.
const OGGI = new Date(2026, 8, 26, 12, 0).getTime()
const DateVera = Date
globalThis.Date = class extends DateVera {
  constructor(...a) {
    super(...(a.length ? a : [OGGI]))
  }
  static now() {
    return OGGI
  }
}

let guai = 0
const ok = (cosa, avuto, voluto) => {
  const va = JSON.stringify(avuto) === JSON.stringify(voluto)
  console.log(va ? '  ✓' : '  ✗', cosa, va ? '' : `— atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`)
  if (!va) guai++
}
// Una funzione che non c'è, o che si rompe, è un caso rosso, non la prova ferma.
const prova = async (cosa, f, voluto) => {
  let avuto
  try {
    avuto = await f()
  } catch (e) {
    avuto = `ERRORE: ${e.message}`
  }
  ok(cosa, avuto, voluto)
}

let o = {}
try {
  o = await importa("export * from './src/lib/ore'")
} catch (e) {
  console.log('  ✗ src/lib/ore.ts non si carica —', e.errors?.[0]?.text ?? e.message)
  guai++
}
const m = await importa(
  "export { creaDatiProva, istruttoreDallAppello, lezioniFra, comeE } from './src/lib/datiProva'; export { creaSegreteriaProva } from './src/lib/segreteriaProva'; export { seminaEsempi } from './src/lib/esempiProva'; export { archivio } from './src/lib/archivioProva'",
)

const iso = (...a) => new Date(...a).toISOString()
const presenza = (id, personaId, corso, inizio, minuti, stato, altro = {}) => ({
  id,
  sessioneId: `s-${id}`,
  corso,
  inizio: iso(inizio),
  fine: iso(inizio.getTime() + minuti * 60_000),
  personaId,
  stato,
  prevista: true,
  ...altro,
})
const ottobre = { da: new Date(2026, 9, 1), a: new Date(2026, 9, 31) }
const novembre = { da: new Date(2026, 10, 1), a: new Date(2026, 10, 30) }

// Maurizio (A) e Maura (B), in disordine: l'ordine lo deve fare `delMese`.
const presenze = [
  presenza('p3', 'A', 'Judo', new Date(2026, 9, 31, 19, 0), 90, 'confermata', { prevista: false, gestitaDa: 'Anna', gestitaIl: iso(2026, 10, 2, 9, 0) }),
  presenza('p5', 'A', 'Pesi', new Date(2026, 9, 22, 18, 0), 60, 'rifiutata', { prevista: false, gestitaDa: 'Anna', gestitaIl: iso(2026, 9, 23, 9, 0) }),
  presenza('p1', 'A', 'Lotta 2', new Date(2026, 9, 5, 17, 0), 60, 'confermata'),
  presenza('p6', 'B', 'Lotta 2', new Date(2026, 9, 5, 17, 0), 60, 'confermata'),
  presenza('p4', 'A', 'Judo', new Date(2026, 9, 20, 19, 0), 60, 'da_confermare', { prevista: false }),
  presenza('p2', 'A', 'Lotta 2', new Date(2026, 9, 12, 17, 0), 60, 'confermata'),
  // Mezzanotte e mezza del primo novembre: in UTC è ancora il 31 ottobre.
  presenza('p7', 'A', 'Lotta 2', new Date(2026, 10, 1, 0, 30), 60, 'confermata'),
  presenza('p8', 'A', 'Lotta 2', new Date(2026, 8, 30, 17, 0), 60, 'confermata'),
]
const senza = (id, inizio, previsti) => ({ sessioneId: id, corso: 'Lotta 2', inizio: iso(inizio), fine: iso(inizio.getTime() + 3_600_000), presenti: 3, previsti })
const senzaIstruttore = [
  senza('s3', new Date(2026, 9, 16, 17), [{ id: 'B', nome: 'Maura' }]),
  senza('s1', new Date(2026, 9, 14, 17), [{ id: 'A', nome: 'Maurizio' }, { id: 'B', nome: 'Maura' }]),
  senza('s2', new Date(2026, 9, 15, 17), [{ id: 'A', nome: 'Maurizio', stato: 'rifiutata' }]),
  senza('s4', new Date(2026, 10, 3, 17), [{ id: 'A', nome: 'Maurizio' }]),
]
const delMese = (...x) => {
  try {
    return o.delMese(...x)
  } catch (e) {
    return { errore: e.message }
  }
}
const ids = (xs) => xs?.map((x) => x.id ?? x.sessioneId)

console.log('\n1. i mesi, i minuti e le ore')
{
  await prova('dodici mesi', () => o.mesi().length, 12)
  await prova('il primo è il mese in corso', () => o.mesi()[0].nome, 'Settembre 2026')
  await prova('dal primo all\'ultimo giorno', () => {
    const x = o.mesi()[0]
    return [x.chiave, x.da.getDate(), x.da.getMonth(), x.a.getDate(), x.a.getMonth()]
  }, ['2026-8', 1, 8, 30, 8])
  await prova('l\'ultimo è di undici mesi fa', () => o.mesi()[11].nome, 'Ottobre 2025')
  await prova('un\'ora sono 60 minuti', () => o.minutiDi({ inizio: iso(2026, 9, 5, 17, 0), fine: iso(2026, 9, 5, 18, 0) }), 60)
  await prova('i minuti si arrotondano', () => o.minutiDi({ inizio: iso(2026, 9, 5, 17, 0), fine: iso(2026, 9, 5, 17, 44, 40) }), 45)
  await prova('tre ore e mezza: «3,5»', () => o.oreItaliane(210), '3,5')
  await prova('tre quarti d\'ora: «0,75»', () => o.oreItaliane(45), '0,75')
  await prova('un\'ora: «1»', () => o.oreItaliane(60), '1')
  await prova('al massimo due decimali', () => o.oreItaliane(50), '0,83')
}

console.log('\n2. il mese di un istruttore')
{
  const mio = delMese(presenze, senzaIstruttore, 'A', ottobre)
  ok('A non vede le lezioni di B, in ordine di inizio', ids(mio.righe), ['p1', 'p2', 'p4', 'p5', 'p3'])
  ok('la lezione del 31 ottobre gestita il 2 novembre è di ottobre', mio.righe?.some((x) => x.id === 'p3'), true)
  ok('tre confermate, anche quella dove non era previsto', ids(mio.confermate), ['p1', 'p2', 'p3'])
  await prova('3,5 ore', () => o.oreItaliane(mio.minuti), '3,5')
  ok('minuti delle confermate', mio.minuti, 210)
  ok('la rifiutata c\'è, con chi e quando', mio.righe?.filter((x) => x.stato === 'rifiutata').map((x) => [x.id, x.gestitaDa, x.gestitaIl]), [['p5', 'Anna', iso(2026, 9, 23, 9, 0)]])
  ok('da confermare: la sua più la lezione dove nessuno si è segnato', mio.daConfermare, 2)
  ok('non segnate: solo dove è previsto senza stato, solo di ottobre', ids(mio.nonSegnate), ['s1'])
  ok('per corso, in ordine alfabetico', mio.perCorso?.map((c) => [c.corso, c.lezioni, c.minuti, ids(c.xs)]), [['Judo', 1, 90, ['p3']], ['Lotta 2', 2, 120, ['p1', 'p2']]])
  const b = delMese(presenze, senzaIstruttore, 'B', ottobre)
  ok('B vede solo la sua', ids(b.righe), ['p6'])
  ok('e le sue non segnate, in ordine di inizio', ids(b.nonSegnate), ['s1', 's3'])
  const nov = delMese(presenze, senzaIstruttore, 'A', novembre)
  ok('mezzanotte e mezza del primo novembre è di novembre', ids(nov.righe), ['p7'])
  ok('a novembre la non segnata di novembre', [ids(nov.nonSegnate), nov.daConfermare], [['s4'], 1])
}

console.log('\n3. mieOre dei dati di prova, con le decisioni della segreteria')
{
  m.seminaEsempi()
  const app = m.creaDatiProva()
  const seg = m.creaSegreteriaProva()
  const da = new Date(2026, 8, 1)
  const a = new Date(2026, 8, 30)
  const mieOre = (chi) => app.mieOre(chi, da, a)
  ok('i dati di prova hanno mieOre', typeof app.mieOre, 'function')
  ok('negli esempi c\'è anche chi non è Maurizio', (m.archivio.dati.presenzeIstruttori ?? []).some((x) => x.personaId !== 'i-maurizio'), true)
  await prova('solo le righe di Maurizio', async () => {
    const r = await mieOre('i-maurizio')
    return r.presenze.length > 0 && r.presenze.every((x) => x.personaId === 'i-maurizio')
  }, true)
  await prova('con corso, inizio e fine della lezione', async () => {
    const r = await mieOre('i-maurizio')
    return r.presenze.every((x) => typeof x.corso === 'string' && x.corso && x.inizio < x.fine)
  }, true)
  await prova('le lezioni senza istruttore solo dove è previsto', async () => {
    const r = await mieOre('i-maurizio')
    return r.senzaIstruttore.every((l) => l.previsti.some((x) => x.id === 'i-maurizio'))
  }, true)

  // Due appelli di Maurizio in lezioni non sue di questo mese: da confermare.
  const giaSuo = new Set((m.archivio.dati.presenzeIstruttori ?? []).filter((x) => x.personaId === 'i-maurizio').map((x) => x.sessioneId))
  const nonSue = m
    .lezioniFra(da, new Date())
    .filter((l) => l.fine < new Date() && m.comeE(l).stato !== 'annullata' && !m.comeE(l).istruttori.includes('i-maurizio') && !giaSuo.has(l.id))
  const [conferma, rifiuta] = nonSue
  for (const l of [conferma, rifiuta]) m.istruttoreDallAppello(l.id, 'i-maurizio')
  const idDi = (l) => m.archivio.dati.presenzeIstruttori.find((x) => x.sessioneId === l.id && x.personaId === 'i-maurizio').id
  const statoIn = async (l) => {
    const x = (await mieOre('i-maurizio')).presenze.find((p) => p.sessioneId === l.id)
    return x && [x.stato, !!x.gestitaDa, !!x.gestitaIl]
  }
  await prova('l\'appello fuori dalle sue risulta da confermare', () => statoIn(conferma), ['da_confermare', false, false])
  await seg.gestisciPresenzaIstruttore(idDi(conferma), true)
  await seg.gestisciPresenzaIstruttore(idDi(rifiuta), false)
  await prova('confermata dalla segreteria, con chi e quando', () => statoIn(conferma), ['confermata', true, true])
  await prova('rifiutata dalla segreteria, con chi e quando', () => statoIn(rifiuta), ['rifiutata', true, true])

  // Il criterio di tutto: l'istruttore e la sua scheda in segreteria contano uguale.
  const mese = { da, a }
  const numeri = (x) => [x.confermate.length, x.minuti, x.daConfermare, x.righe.length]
  for (const chi of ['i-maurizio', 'i-maura', 'i-fabio']) {
    await prova(`${chi}: gli stessi numeri della scheda in segreteria`, async () => {
      const mio = await mieOre(chi)
      const giorni = Math.ceil((Date.now() - da.getTime()) / 86_400_000) + 1
      const scheda = o.delMese(await seg.presenzeIstruttori(giorni), await seg.lezioniSenzaIstruttore(), chi, mese)
      return JSON.stringify(numeri(o.delMese(mio.presenze, mio.senzaIstruttore, chi, mese))) === JSON.stringify(numeri(scheda)) && scheda.righe.length > 0
    }, true)
  }
}

console.log('\n4. le lezioni senza segno lette dal database')
{
  const riga = (id, previsti) => ({ sessione_id: id, corso: 'Lotta 2', colore: null, inizio: iso(2026, 9, 14, 17), fine: iso(2026, 9, 14, 18), sala: null, presenti: 3, previsti })
  const righe = [
    riga('s1', [{ id: 'A', nome: 'Maurizio', cognome: 'Rossi', stato: null }]),
    riga('s2', [{ id: 'B', nome: 'Maura', cognome: 'Bianchi', stato: 'rifiutata' }]),
  ]
  const leggi = (...x) => o.daSenzaIstruttore(...x)
  await prova('come le legge la segreteria: tutte, coi nomi', () => leggi({ data: righe, error: null }).map((l) => [l.sessioneId, l.previsti[0].nome, l.previsti[0].stato ?? null]), [
    ['s1', 'Maurizio Rossi', null],
    ['s2', 'Maura Bianchi', 'rifiutata'],
  ])
  // La segreteria che insegna riceve dal database le lezioni di tutti.
  await prova('per una persona, solo dove è prevista', () => leggi({ data: righe, error: null }, 'A').map((l) => l.sessioneId), ['s1'])
  await prova('prima di 37-mie-ore.sql (permesso negato): nessuna', () => leggi({ data: null, error: { code: '42501', message: 'le lezioni da confermare le vede la segreteria' } }, 'A'), [])
  // Un DA CONFERMARE più basso di quello della segreteria, senza dirlo, è peggio di niente.
  await prova('un altro errore non passa per «nessuna»', () => leggi({ data: null, error: { code: 'PGRST000', message: 'rete' } }, 'A').length, 'ERRORE: rete')
}

console.log(guai ? `\n${guai} ${guai === 1 ? 'cosa non torna' : 'cose non tornano'}` : '\nTUTTO A POSTO')
process.exit(guai ? 1 : 0)
