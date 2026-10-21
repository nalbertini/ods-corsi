// ---------------------------------------------------------------------------
// La lettera d'incarico dei tecnici, senza browser.
//
//   node scripts/prova-lettere.mjs [cartella]
//
// La lettera si fa dalla scheda di un tecnico: periodo, qualifica, giorni e
// le sue tariffe, coi suoi dati copiati dentro, come le ricevute
// (`src/lib/lettere.ts`, `src/lib/letteraPdf.ts`,
// `supabase/79-lettere-incarico.sql`, provato da
// `supabase/prova/lettere-incarico.sql`). Una lettera fatta non si cambia: si
// sostituisce, e dopo si spunta solo «firmata». Qui: gli importi a parole, la
// stagione, il saluto, i controlli, il testo della bozza, il PDF, la
// segreteria di prova e quella col database. Con una cartella ci lascia il
// PDF, da aprire e guardare.
// ---------------------------------------------------------------------------
import { build } from 'esbuild'
import { readFileSync, writeFileSync } from 'node:fs'
import { inflateSync } from 'node:zlib'

// pdf-lib vuole `platform: 'node'`; la segreteria no, come in prova-tariffe.mjs.
const importa = async (contents, platform = 'browser') => {
  const { outputFiles } = await build({
    stdin: { contents, resolveDir: '.', loader: 'ts' },
    bundle: true,
    format: 'esm',
    platform,
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
const cartella = process.argv[2]

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
const errore = async (f) => {
  try {
    await f()
    return 'nessun errore'
  } catch (e) {
    return e.message
  }
}
// Un rifiuto della regola, non la funzione che manca.
const rifiuta = async (f) => {
  try {
    await f()
    return 'accettato'
  } catch (e) {
    return e instanceof TypeError ? `ERRORE: ${e.message}` : 'rifiutato'
  }
}
// Un messaggio qualunque, purché ci sia: la funzione che manca non vale.
const unMessaggio = (f) => {
  try {
    const x = f()
    return typeof x === 'string' && x.trim() ? 'un messaggio' : x
  } catch (e) {
    return `ERRORE: ${e.message}`
  }
}
// Il testo scritto nel PDF: gli stream si aprono e le stringhe esadecimali dei `Tj` si rileggono byte per byte.
const testoDelPdf = (bytes) => {
  const b = Buffer.from(bytes)
  const s = b.toString('latin1')
  let fuori = ''
  for (const x of s.matchAll(/stream\r?\n/g)) {
    const da = x.index + x[0].length
    try {
      fuori += inflateSync(b.subarray(da, s.indexOf('endstream', da))).toString('latin1')
    } catch {
      /* non è un contenuto di pagina */
    }
  }
  return [...fuori.matchAll(/<([0-9A-F]+)> Tj/g)].map((t) => Buffer.from(t[1], 'hex').toString('latin1')).join('\n')
}
// Per cercare una frase: apostrofi diritti e spazi semplici, anche dove il testo va a capo.
const piatto = (s) => s.replace(/[’‘]/g, "'").replace(/\s+/g, ' ')

// Ognuno per sé: se manca il PDF, il resto si prova lo stesso.
const carica = async (contents, file) => {
  try {
    return await importa(contents, 'node')
  } catch (e) {
    console.log(`  ✗ ${file} non si carica —`, e.errors?.[0]?.text ?? e.message)
    guai++
    return {}
  }
}
const l = {
  ...(await carica("export * from './src/lib/lettere'", 'src/lib/lettere.ts')),
  ...(await carica("export { letteraPdf } from './src/lib/letteraPdf'; export { cartaIntestata } from './src/lib/cartaPdf'; export { PDFDocument, PDFName, PDFDict, PDFArray, PDFRawStream, StandardFonts } from 'pdf-lib'", 'src/lib/letteraPdf.ts')),
}
const m = await importa(
  "export { creaSegreteriaProva } from './src/lib/segreteriaProva'; export { creaSegreteriaSupabase } from './src/lib/segreteriaSupabase'",
)

const BALLABIO = {
  nome: 'Diana', cognome: 'Ballabio', indirizzo: 'Via Montelera 73', cap: '10040', comune: 'Val della Torre', provincia: 'TO',
  codiceFiscale: 'BLLDNI86H61H355W', natoIl: '1986-06-21', natoA: 'Pinerolo', provinciaNascita: 'TO',
}
const dati = {
  personaId: 'p1',
  stagione: '2026/27',
  dal: '2026-09-01',
  al: '2027-07-30',
  qualifica: 'Allenatore',
  giorni: 'venerdì',
  data: '2026-09-01',
  tariffe: [{ corso: 'Judo kids', centesimi: 1500 }, { corso: 'Judo adulti', centesimi: 2100 }],
  tecnico: BALLABIO,
}
const lettera = { ...dati, id: 'l1', firmata: false, sostituitaIl: null, creataIl: '2026-09-01T10:00:00Z' }

console.log('\n1. gli importi a parole, come nella lettera')
for (const [centesimi, voluto] of [
  [800, 'otto/00'],
  [80000, 'ottocento/00'],
  [1500, 'quindici/00'],
  [1550, 'quindici/50'],
  [125050, 'milleduecentocinquanta/50'],
  [100000, 'mille/00'],
  [200000, 'duemila/00'],
  [2100, 'ventuno/00'],
  [2800, 'ventotto/00'],
  [3100, 'trentuno/00'],
  [300, 'tre/00'],
  [2300, 'ventitré/00'],
  [1100, 'undici/00'],
  [1900, 'diciannove/00'],
  [10300, 'centotré/00'],
  [0, 'zero/00'],
])
  await prova(`${centesimi} centesimi → «${voluto}»`, () => l.importoInLettere(centesimi), voluto)

console.log('\n2. la stagione parte il 1° settembre, e la proposta di periodo e data')
await prova('il 21 ottobre 2026 è la 2026/27', () => l.stagioneDi('2026-10-21'), '2026/27')
await prova('il 1° marzo 2027 è ancora la 2026/27', () => l.stagioneDi('2027-03-01'), '2026/27')
await prova('il 31 agosto 2027 è ancora la 2026/27', () => l.stagioneDi('2027-08-31'), '2026/27')
await prova('il 1° settembre 2027 è la 2027/28', () => l.stagioneDi('2027-09-01'), '2027/28')
await prova('per la 2026/27: dal 1° settembre al 30 luglio, fatta il 1° settembre', () => {
  const p = l.propostaLettera('2026/27')
  return [p.dal, p.al, p.data]
}, ['2026-09-01', '2027-07-30', '2026-09-01'])
await prova('per la 2027/28 lo stesso, un anno dopo', () => {
  const p = l.propostaLettera('2027/28')
  return [p.dal, p.al, p.data]
}, ['2027-09-01', '2028-07-30', '2027-09-01'])

console.log('\n3. il saluto, dal codice fiscale')
await prova('una donna (il giorno di nascita +40): «Gentile signora»', () => l.saluto('BLLDNI86H61H355W'), 'Gentile signora')
await prova('anche col codice scritto in minuscolo', () => l.saluto('blldni86h61h355w'), 'Gentile signora')
await prova('anche con l\'omocodia (il giorno scritto a lettere)', () => l.saluto('BLLDNI86HSMH355A'), 'Gentile signora')
await prova('un uomo: «Gentile signor»', () => l.saluto('RSSMRA80A01L219M'), 'Gentile signor')
await prova('una donna nata il 5 (giorno 45 nel codice)', () => l.saluto('BLLDNI86H45H355W'), 'Gentile signora')
await prova('un altro uomo', () => l.saluto('LBRNCL80C02L219F'), 'Gentile signor')
await prova('senza codice fiscale: «Gentile»', () => l.saluto(), 'Gentile')
await prova('col codice vuoto: «Gentile»', () => l.saluto(''), 'Gentile')
await prova('con un codice che non si legge: «Gentile»', () => l.saluto('ABC'), 'Gentile')

console.log('\n4. cosa non va, prima di fare la lettera')
await prova('tutto giusto: niente', () => l.cosaNonVaLettera(dati), null)
await prova('senza tariffe', () => l.cosaNonVaLettera({ ...dati, tariffe: [] }), 'Scrivi almeno una tariffa nella scheda prima di fare la lettera')
await prova('la fine prima dell\'inizio', () => l.cosaNonVaLettera({ ...dati, al: '2026-08-01' }), "La fine viene prima dell'inizio")
ok('la fine lo stesso giorno dell\'inizio no', unMessaggio(() => l.cosaNonVaLettera({ ...dati, al: '2026-09-01' })), 'un messaggio')
ok('una qualifica fuori elenco no', unMessaggio(() => l.cosaNonVaLettera({ ...dati, qualifica: 'Bidello' })), 'un messaggio')
ok('una stagione che non torna no («2026/99»)', unMessaggio(() => l.cosaNonVaLettera({ ...dati, stagione: '2026/99' })), 'un messaggio')
ok('una stagione scritta male no', unMessaggio(() => l.cosaNonVaLettera({ ...dati, stagione: '2026-27' })), 'un messaggio')
ok('i giorni oltre 80 caratteri no', unMessaggio(() => l.cosaNonVaLettera({ ...dati, giorni: 'x'.repeat(81) })), 'un messaggio')
await prova('la fine dopo la stagione no', () => l.cosaNonVaLettera({ ...dati, al: '2030-07-30' }), 'Il periodo va dentro la stagione 2026/27')
await prova("l'inizio prima della stagione no", () => l.cosaNonVaLettera({ ...dati, dal: '2025-12-01' }), 'Il periodo va dentro la stagione 2026/27')
await prova('fino al 31 agosto sì', () => l.cosaNonVaLettera({ ...dati, al: '2027-08-31' }), null)
ok('una tariffa di zero no', unMessaggio(() => l.cosaNonVaLettera({ ...dati, tariffe: [{ corso: 'Judo kids', centesimi: 0 }] })), 'un messaggio')
ok('una tariffa coi decimali di centesimo no', unMessaggio(() => l.cosaNonVaLettera({ ...dati, tariffe: [{ corso: 'Judo kids', centesimi: 15.5 }] })), 'un messaggio')
ok('la data vuota no', unMessaggio(() => l.cosaNonVaLettera({ ...dati, data: '' })), 'un messaggio')
ok('una data scritta male no', unMessaggio(() => l.cosaNonVaLettera({ ...dati, dal: '2026-9-1' })), 'un messaggio')
await prova('i giorni vuoti sì', () => l.cosaNonVaLettera({ ...dati, giorni: '' }), null)
await prova('le qualifiche, nell\'ordine della lettera', () => l.QUALIFICHE, [
  'Allenatore', 'Istruttore', 'Direttore tecnico', 'Direttore sportivo', 'Preparatore atletico', 'Direttore di gara', 'Atleta', 'Altro',
])
for (const q of ['Istruttore', 'Direttore di gara', 'Altro']) await prova(`la qualifica «${q}» va bene`, () => l.cosaNonVaLettera({ ...dati, qualifica: q }), null)
const MANCANO = 'Mancano i dati per la lettera: codice fiscale e residenza'
await prova('senza codice fiscale', () => l.cosaNonVaLettera({ ...dati, tecnico: { ...BALLABIO, codiceFiscale: undefined } }), MANCANO)
await prova('senza indirizzo', () => l.cosaNonVaLettera({ ...dati, tecnico: { ...BALLABIO, indirizzo: '' } }), MANCANO)
await prova('senza comune', () => l.cosaNonVaLettera({ ...dati, tecnico: { ...BALLABIO, comune: undefined } }), MANCANO)

console.log('\n5. il testo: quello della bozza, coi dati della lettera')
{
  // Una stringa per paragrafo, o {numero, testo}: si leggono tutti e due.
  const paragrafi = async (x) => {
    try {
      return (await l.testoLettera(x)).map((p) => (typeof p === 'string' ? { testo: p } : p))
    } catch (e) {
      return [{ testo: `ERRORE: ${e.message}` }]
    }
  }
  const numeri = (ps) => ps.map((p) => p.numero ?? Number(/^\s*(\d+)\s*\./.exec(p.testo)?.[1])).filter((n) => Number.isFinite(n) && n > 0)
  const ps = await paragrafi(lettera)
  const tutto = piatto(ps.map((p) => p.testo).join('\n'))
  const c = (cosa, frase) => ok(cosa, tutto.includes(frase), true)
  const no = (cosa, frase) => ok(cosa, tutto.includes(frase), false)
  ok('più paragrafi, non uno solo', ps.length > 10, true)
  c('il saluto alla signora', 'Gentile signora')
  ok('nome e cognome in testa', tutto.toUpperCase().includes('BALLABIO DIANA'), true)
  ok('la residenza in testa', tutto.toUpperCase().includes('VIA MONTELERA 73') && tutto.toUpperCase().includes('VAL DELLA TORRE'), true)
  c('il codice fiscale', 'BLLDNI86H61H355W')
  c("l'oggetto", 'Oggetto: lettera di incarico per collaborazione coordinata e continuativa sportiva dilettantistica')
  c('il periodo', "E' a Lei conferito per il periodo dal 01/09/2026 al 30/07/2027, l'incarico di:")
  ok("la qualifica dopo «l'incarico di:»", /l'incarico di: -? ?Allenatore/.test(tutto), true)
  c('i giorni', 'preferibilmente nei giorni di venerdì')
  c('la tariffa del Judo kids', '€ 15,00 (quindici/00) per ogni ora di lezione nel corso Judo kids')
  c('la tariffa del Judo adulti', '€ 21,00 (ventuno/00) per ogni ora di lezione nel corso Judo adulti')
  c('la qualifica anche al punto 3', 'tesserato con qualifica Allenatore')
  c('il nome giusto della palestra', 'ASD IL CENTRO JUDO')
  no('senza il refuso «CENTROJUDO»', 'CENTROJUDO')
  no('senza il refuso «Gentila»', 'Gentila')
  ok('i punti numerati da 2 a 11, senza salti', numeri(ps), [2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
  c("l'approvazione dei punti 4 e 5", 'ivi compresi i punti 4, 5')
  c('la firma del presidente', 'Il Presidente')
  c("l'accettazione", 'Per accettazione')
  ok('la data della lettera', /Data: ?01\/09\/2026/.test(tutto), true)
  no('niente spazi civici', 'spazi civici')
  no('niente play district', 'play district')
  no('niente CUP', 'CUP')
  no('niente compenso complessivo («ottocento»)', 'ottocento')
  no('niente rate («10 rate»)', '10 rate')

  const sua = piatto((await paragrafi({ ...lettera, giorni: '', qualifica: 'Istruttore', tecnico: { ...BALLABIO, codiceFiscale: 'RSSMRA80A01L219M', nome: 'Mario', cognome: 'Rossi' } })).map((p) => p.testo).join('\n'))
  ok('senza giorni, niente «preferibilmente nei giorni di»', sua.includes('preferibilmente nei giorni di'), false)
  ok('un uomo: «Gentile signor»', /Gentile signor(?!a)/.test(sua), true)
  ok("un'altra qualifica: «Istruttore»", /l'incarico di: -? ?Istruttore/.test(sua) && sua.includes('tesserato con qualifica Istruttore'), true)
}

console.log('\n5 bis. i dati della lettera, dalla scheda del tecnico')
await prova(
  'nome, anagrafica e tariffe in ordine di corso; niente IBAN né genitore',
  () => l.datiPerLettera(
    { id: 'p1', nome: 'Diana', cognome: 'Ballabio' },
    { ...BALLABIO, iban: 'IT60X0542811101000000123456', genitoreNome: 'X' },
    [{ corsoId: 'c2', corso: 'Judo kids', centesimi: 1500 }, { corsoId: 'c1', corso: 'Aikido', centesimi: 1800 }],
    { stagione: '2026/27', dal: '2026-09-01', al: '2027-07-30', qualifica: 'Allenatore', giorni: ' venerdì ', data: '2026-09-01' },
  ),
  {
    personaId: 'p1', stagione: '2026/27', dal: '2026-09-01', al: '2027-07-30', qualifica: 'Allenatore', giorni: 'venerdì', data: '2026-09-01',
    tariffe: [{ corso: 'Aikido', centesimi: 1800 }, { corso: 'Judo kids', centesimi: 1500 }],
    tecnico: { nome: 'Diana', cognome: 'Ballabio', indirizzo: 'Via Montelera 73', cap: '10040', comune: 'Val della Torre', provincia: 'TO', codiceFiscale: 'BLLDNI86H61H355W', natoIl: '1986-06-21', natoA: 'Pinerolo', provinciaNascita: 'TO' },
  },
)

console.log('\n5 ter. quale lettera vale nella scheda')
{
  const x = (id, stagione, sostituitaIl = null) => ({ id, stagione, sostituitaIl })
  const ls = [x('n', '2026/27'), x('v', '2026/27', '2026-09-15T10:00:00Z'), x('p', '2025/26')]
  await prova('la valida della stagione, e le altre dalla più nuova', () => { const r = l.lettereDellaScheda(ls, '2026/27'); return [r.valida?.id, r.altre.map((y) => y.id)] }, ['n', ['v', 'p']])
  await prova('la valida anche se in elenco viene dopo la sostituita', () => l.lettereDellaScheda([x('v', '2026/27', '2026-09-15T10:00:00Z'), x('n', '2026/27')], '2026/27').valida?.id, 'n')
  await prova('nessuna valida per una stagione nuova', () => { const r = l.lettereDellaScheda(ls, '2027/28'); return [r.valida ?? null, r.altre.length] }, [null, 3])
}

console.log('\n5 quater. il nome del file, le scelte proposte, la riga sotto, il compenso')
await prova('il nome del file: stagione, chi, giorno', () => l.nomeFileLettera({ ...lettera, tecnico: { ...BALLABIO, cognome: 'Ballabìo' } }), 'lettera-incarico-2026-27-ballabio-diana-2026-09-01.pdf')
await prova('la sostituita si distingue', () => l.nomeFileLettera({ ...lettera, sostituitaIl: '2026-09-15T10:00:00Z' }), 'lettera-incarico-2026-27-ballabio-diana-2026-09-01-sostituita.pdf')
await prova('col cognome vuoto niente trattino doppio', () => l.nomeFileLettera({ ...lettera, tecnico: { ...BALLABIO, cognome: '', nome: 'Fabio' } }), 'lettera-incarico-2026-27-fabio-2026-09-01.pdf')
await prova('senza lettera valida: la proposta della stagione', () => l.scelteDaProporre(undefined, '2026/27'), { stagione: '2026/27', dal: '2026-09-01', al: '2027-07-30', data: '2026-09-01', qualifica: 'Allenatore', giorni: '' })
await prova('con la valida: i suoi valori, per correggerla', () => l.scelteDaProporre({ ...lettera, dal: '2026-10-01', qualifica: 'Istruttore' }, '2026/27'), { stagione: '2026/27', dal: '2026-10-01', al: '2027-07-30', qualifica: 'Istruttore', giorni: 'venerdì', data: '2026-09-01' })
await prova('la riga di una sostituita firmata', () => l.rigaLettera({ ...lettera, firmata: true, sostituitaIl: '2026-09-15T10:00:00Z' }), 'Sostituita · 2026/27 · lettera del 1 settembre 2026 · sostituita il 15 settembre 2026 · firmata')
await prova('la riga di una lettera di un\'altra stagione, non firmata', () => l.rigaLettera({ ...lettera, stagione: '2025/26', data: '2025-09-01' }), '2025/26 · lettera del 1 settembre 2025 · non firmata')
await prova('il compenso: lo stesso nella lettera e nella scheda', () => l.compensoDi({ corso: 'Judo kids', centesimi: 1500 }), '€\u00a015,00 (quindici/00) per ogni ora di lezione nel corso Judo kids')

await prova('quale campo non va: la fine prima dell\'inizio è «al»', () => l.campoCheNonVa({ ...dati, al: '2026-08-01' }), 'al')
await prova('l\'inizio prima della stagione è «dal»', () => l.campoCheNonVa({ ...dati, dal: '2025-12-01' }), 'dal')
await prova('la data che manca è «data»', () => l.campoCheNonVa({ ...dati, data: '' }), 'data')
await prova('tutto giusto: nessuno', () => l.campoCheNonVa(dati), null)
await prova('i corsi che insegna e restano fuori dalla lettera, senza tariffa', () => l.corsiFuoriLettera(['Aikido 2', 'Aikido 3', 'Judo kids'], [{ corso: 'Aikido 2', centesimi: 1500 }]), ['Aikido 3', 'Judo kids'])

// Una carta finta, una pagina A4 con una scritta: qui si prova letteraPdf; la carta vera è in prova-fogli-moduli.mjs.
const carta = await (async () => {
  const c = await l.PDFDocument.create()
  const pg = c.addPage([595.28, 841.89])
  pg.drawText('CARTA DI PROVA', { x: 40, y: 800, size: 12, font: await c.embedFont(l.StandardFonts.Helvetica) })
  return c.save()
})()

console.log('\n6. il PDF')
{
  const fai = async (x) => {
    try {
      const byte = await l.letteraPdf(x, carta)
      const doc = await l.PDFDocument.load(byte)
      return { byte, doc, testo: piatto(testoDelPdf(byte)) }
    } catch (e) {
      return { errore: e.message }
    }
  }
  const p = await fai(lettera)
  ok('si fa', p.errore ?? 'fatto', 'fatto')
  if (!p.errore) {
    const { width, height } = p.doc.getPage(0).getSize()
    ok('A4 in verticale', [Math.round(width), Math.round(height)], [595, 842])
    ok('due pagine o più', p.doc.getPageCount() >= 2, true)
    ok('il nome', p.testo.toUpperCase().includes('BALLABIO DIANA'), true)
    ok('il codice fiscale', p.testo.includes('BLLDNI86H61H355W'), true)
    ok('le tariffe', p.testo.includes('15,00 (quindici/00)') && p.testo.includes('21,00 (ventuno/00)') && p.testo.includes('Judo kids'), true)
    ok('«Il Presidente»', p.testo.includes('Il Presidente'), true)
    ok('«Per accettazione»', p.testo.includes('Per accettazione'), true)
    if (cartella) writeFileSync(`${cartella}/lettera-ballabio.pdf`, p.byte)
  }
  const tante = { ...lettera, tariffe: ['Judo kids', 'Judo adulti', 'Judo 2', 'Lotta 2', 'Lotta 3', 'Aikido', 'Karate', 'Ginnastica dolce'].map((corso, i) => ({ corso, centesimi: 1500 + i * 50 })) }
  const t = await fai(tante)
  ok('con otto tariffe si fa lo stesso', t.errore ?? 'fatto', 'fatto')
  if (!t.errore) {
    ok("e c'è anche l'ultima", t.testo.includes('Ginnastica dolce'), true)
    if (cartella) writeFileSync(`${cartella}/lettera-tante-tariffe.pdf`, t.byte)
  }
}

console.log('\n6 bis. la lettera sulla carta intestata')
{
  const fai = async (x, su = carta) => {
    try {
      const byte = await l.letteraPdf(x, su)
      return { doc: await l.PDFDocument.load(byte) }
    } catch (e) {
      return { errore: e.message }
    }
  }
  // Solo il contenuto della pagina, non quello della carta disegnata sopra: si vede cosa scrive la lettera da sé.
  const contenuto = (pg) => {
    const c = pg.node.Contents()
    const flussi = c instanceof l.PDFArray ? c.asArray().map((r) => pg.doc.context.lookup(r)) : [c]
    return flussi
      .filter((f) => f instanceof l.PDFRawStream)
      .map((f) => {
        try {
          return inflateSync(f.contents).toString('latin1')
        } catch {
          return Buffer.from(f.contents).toString('latin1')
        }
      })
      .join('\n')
  }
  // Le righe scritte sulla pagina, in WinAnsi: 0x92 è l'apostrofo curvo.
  const righe = (pg) => [...contenuto(pg).matchAll(/<([0-9A-F]+)> Tj/g)].map((t) => Buffer.from(t[1], 'hex').toString('latin1').replace(/\x92/g, '’'))
  const pagine = (doc) => doc.getPages().map((pg) => ({ righe: righe(pg), testo: piatto(righe(pg).join(' ')), pg }))
  /** I nomi degli XObject di tipo Form fra le risorse della pagina, e se la pagina li disegna (`Do`). */
  const disegnaForm = (pg) => {
    const xo = pg.node.Resources()?.lookup(l.PDFName.of('XObject'), l.PDFDict)
    if (!xo) return false
    const forme = xo.keys().filter((k) => {
      const o = xo.lookup(k)
      return String((o instanceof l.PDFRawStream ? o.dict : o)?.get(l.PDFName.of('Subtype'))) === '/Form'
    })
    const c = contenuto(pg)
    return forme.some((k) => c.includes(`${k.toString()} Do`))
  }
  const tante = { ...lettera, tariffe: ['Judo kids', 'Judo adulti', 'Judo 2', 'Lotta 2', 'Lotta 3', 'Aikido', 'Karate', 'Ginnastica dolce'].map((corso, i) => ({ corso, centesimi: 1500 + i * 50 })) }

  for (const [nome, x] of [['la lettera di Ballabio', lettera], ['quella con otto tariffe', tante]]) {
    const p = await fai(x)
    ok(`${nome}, con la carta: si fa`, p.errore ?? 'fatto', 'fatto')
    if (p.errore) continue
    const ps = pagine(p.doc)
    const N = ps.length
    ok(`${nome}: A4 in verticale`, Object.values(p.doc.getPage(0).getSize()).map(Math.round), [595, 842])
    ok(`${nome}: ogni pagina ha disegnata la carta (un XObject Form)`, ps.map((q) => disegnaForm(q.pg)), ps.map(() => true))
    ok(`${nome}: la lettera non scrive più da sé «ASD IL CENTRO JUDO» in testa`, ps.map((q) => q.righe.some((r) => r.trim() === 'ASD IL CENTRO JUDO')), ps.map(() => false))
    ok(`${nome}: né il piede «Corso Francia 224…»`, ps.map((q) => q.testo.includes('Corso Francia 224')), ps.map(() => false))
    // La lettera più corta (una tariffa, senza giorni) va comunque su due pagine: il caso a una pagina non c'è.
    ok(`${nome}: più di una pagina`, N > 1, true)
    ok(`${nome}: la pagina n ha «pagina n di ${N}»`, ps.map((q, i) => q.testo.includes(`pagina ${i + 1} di ${N}`)), ps.map(() => true))
    ok(
      `${nome}: dalla seconda, «Diana Ballabio · lettera d'incarico 2026/27 · pagina n di ${N}»`,
      ps.slice(1).map((q, i) => q.testo.includes(`Diana Ballabio · lettera d'incarico 2026/27 · pagina ${i + 2} di ${N}`)),
      ps.slice(1).map(() => true),
    )
    // Firma e puntini non si separano: la pagina con chi firma ha anche la sua riga «Firma:» dopo.
    const separate = ['Il Presidente', 'Per accettazione', 'A norma degli artt. 1341'].filter((chi) => {
      const q = ps.find((y) => y.righe.some((r) => r.startsWith(chi)))
      return !q || !q.righe.slice(q.righe.findIndex((r) => r.startsWith(chi))).some((r) => r.startsWith('Firma:'))
    })
    ok(`${nome}: ogni firma ha i suoi puntini sulla stessa pagina`, separate, [])
    const tutto = piatto(ps.map((q) => q.righe.join('\n')).join('\n'))
    ok(`${nome}: il testo della lettera c'è lo stesso`, ['BLLDNI86H61H355W', '15,00 (quindici/00)', 'Il Presidente', 'Per accettazione', 'ASD IL CENTRO JUDO il Suo'].filter((f) => !tutto.includes(f)), [])
  }

  // Dopo una firma, la riga che la chiude («Data: …» o il nome) sta sulla sua pagina: mai da sola sulla pagina dopo.
  // Con la carta il testo ha meno posto, e con quattro tariffe il nome finiva da solo in cima alla terza pagina.
  const staccate = []
  for (let n = 1; n <= 14; n++) {
    const x = { ...lettera, tariffe: Array.from({ length: n }, (_, i) => ({ corso: `Corso ${i + 1}`, centesimi: 1500 + i * 50 })) }
    const p = await fai(x)
    if (p.errore) {
      staccate.push(`${n}: ${p.errore}`)
      continue
    }
    const ps = pagine(p.doc)
    const dove = (f) => ps.findIndex((q) => q.righe.some(f))
    const data = dove((r) => r.startsWith('Data:'))
    const accettazione = dove((r) => r.startsWith('Per accettazione'))
    const nome = ps.findLastIndex((q) => q.righe.some((r) => r.trim() === 'BALLABIO DIANA'))
    const norma = dove((r) => r.startsWith('A norma degli artt.'))
    if (data !== accettazione) staccate.push(`${n} tariffe: «Data:» a pagina ${data + 1}, la sua firma a pagina ${accettazione + 1}`)
    if (nome !== norma) staccate.push(`${n} tariffe: il nome a pagina ${nome + 1}, la sua firma a pagina ${norma + 1}`)
  }
  ok('da 1 a 14 tariffe: la data e il nome stanno sulla pagina della loro firma', staccate, [])

  // La carta si scarica dall'app: se non arriva, o arriva altro (una pagina HTML del wifi), un messaggio per chi usa l'app.
  const AVVISO = 'La carta intestata non si scarica: controlla la connessione e riprova.'
  const risposta = (ok, byte) => async () => ({ ok, arrayBuffer: async () => new Uint8Array(byte).buffer })
  await prova('la carta: un PDF arriva com’è', async () => (await l.cartaIntestata(risposta(true, carta))).length, carta.length)
  await prova('la carta in 404: il messaggio', () => l.cartaIntestata(risposta(false, [])).then(() => 'scaricata', (e) => e.message), AVVISO)
  await prova('senza rete: il messaggio', () => l.cartaIntestata(async () => { throw new TypeError('Failed to fetch') }).then(() => 'scaricata', (e) => e.message), AVVISO)
  await prova('una pagina HTML al posto del PDF: il messaggio', () => l.cartaIntestata(risposta(true, Buffer.from('<!doctype html><html></html>'))).then(() => 'scaricata', (e) => e.message), AVVISO)

  // Sulla carta vera il testo della lettera sta fra la testata (fino a 92 punti dall'alto) e il piede (fino a 68 dal
  // fondo): nessuna riga ci finisce sopra. Le y sono le linee di base dei Tm che la lettera scrive da sé.
  const vera = new Uint8Array(readFileSync('public/moduli/carta-intestata.pdf'))
  const fuori = []
  for (let n = 1; n <= 14; n++) {
    const x = { ...lettera, tariffe: Array.from({ length: n }, (_, i) => ({ corso: `Corso ${i + 1}`, centesimi: 1500 + i * 50 })) }
    const p = await fai(x, vera)
    if (p.errore) {
      fuori.push(`${n}: ${p.errore}`)
      continue
    }
    p.doc.getPages().forEach((pg, i) => {
      for (const [, y] of contenuto(pg).matchAll(/ (-?[\d.]+) Tm/g)) if (Number(y) < 70 || Number(y) + 10 > 841.89 - 92) fuori.push(`${n} tariffe, pagina ${i + 1}: una riga a y=${y}`)
    })
  }
  ok('sulla carta vera, da 1 a 14 tariffe: nessuna riga nella testata o nel piede', fuori, [])
}

console.log('\n7. la segreteria di prova: fa, sostituisce, spunta firmata')
{
  const s = m.creaSegreteriaProva()
  const personale = await s.personale()
  const tecnico = personale.find((p) => p.ruolo === 'istruttore')
  const nonInsegna = personale.find((p) => p.ruolo === 'staff' && !p.ancheIstruttore)
  ok("c'è un istruttore e una segreteria che non insegna", [!!tecnico, !!nonInsegna], [true, true])
  const sua = { ...dati, personaId: tecnico.id }
  await prova('senza lettere, nessuna', () => s.lettere(tecnico.id), [])
  let prima
  await prova('fa la lettera', async () => {
    prima = await s.faiLettera(sua)
    return [typeof prima.id, prima.personaId, prima.stagione, prima.firmata, prima.sostituitaIl ?? null, prima.tecnico.codiceFiscale]
  }, ['string', tecnico.id, '2026/27', false, null, 'BLLDNI86H61H355W'])
  let seconda
  await prova('una seconda per la stessa stagione sostituisce la prima', async () => {
    seconda = await s.faiLettera({ ...sua, giorni: 'martedì e venerdì' })
    const tutte = await s.lettere(tecnico.id)
    return tutte.map((x) => [x.id === seconda.id ? 'nuova' : x.id === prima.id ? 'prima' : '?', x.sostituitaIl ? 'sostituita' : 'valida'])
  }, [['nuova', 'valida'], ['prima', 'sostituita']])
  await prova('una per la stagione dopo non sostituisce niente', async () => {
    await s.faiLettera({ ...sua, stagione: '2027/28', dal: '2027-09-01', al: '2028-07-30', data: '2027-09-01' })
    return (await s.lettere(tecnico.id)).map((x) => [x.stagione, x.sostituitaIl ? 'sostituita' : 'valida'])
  }, [['2027/28', 'valida'], ['2026/27', 'valida'], ['2026/27', 'sostituita']])
  await prova('la spunta firmata', async () => {
    await s.segnaFirmata(seconda.id, true)
    return (await s.lettere(tecnico.id)).find((x) => x.id === seconda.id)?.firmata
  }, true)
  await prova('e la toglie', async () => {
    await s.segnaFirmata(seconda.id, false)
    return (await s.lettere(tecnico.id)).find((x) => x.id === seconda.id)?.firmata
  }, false)
  ok('per chi non insegna no', await rifiuta(() => s.faiLettera({ ...sua, personaId: nonInsegna.id })), 'rifiutato')
  ok('senza tariffe no, col messaggio', await errore(() => s.faiLettera({ ...sua, tariffe: [] })), 'Scrivi almeno una tariffa nella scheda prima di fare la lettera')
  ok('la fine prima dell\'inizio no', await errore(() => s.faiLettera({ ...sua, al: '2026-08-01' })), "La fine viene prima dell'inizio")
  await prova('e le lettere sono ancora tre', async () => (await s.lettere(tecnico.id)).length, 3)
  await prova('chi non insegna non ne ha', () => s.lettere(nonInsegna.id), [])
  // Un tecnico nuovo, senza corsi né lezioni: l'unica cosa che lo tiene è la lettera.
  const nuovo = await s.salvaPersonale({ nome: 'Teo', cognome: 'Nuovo', ruolo: 'istruttore' })
  await s.faiLettera({ ...dati, personaId: nuovo })
  ok('un tecnico con lettere non si elimina, come col database', await errore(() => s.eliminaIstruttore(nuovo)), "Teo Nuovo ha già lavorato nei registri: non si elimina, gli si toglie l'accesso")
  await prova('le lettere stanno nei dati della persona che si esportano', async () => (await s.esporta(tecnico.id)).lettere_incarico?.length, 3)
}

console.log('\n8. col database vero: la funzione, la sola colonna firmata, la tabella')
{
  const chiesto = []
  const catena = (tabella, risposta) => {
    const c = new Proxy(() => c, {
      get: (_, k) => (k === 'then' ? (fatto, ko) => Promise.resolve(risposta).then(fatto, ko) : (...a) => (chiesto.push([tabella, k, ...a]), c)),
      apply: () => c,
    })
    return c
  }
  const riga = {
    id: 'l2', persona_id: 'p1', stagione: '2026/27', dal: '2026-09-01', al: '2027-07-30', qualifica: 'Allenatore', giorni: 'venerdì', data: '2026-09-01',
    tariffe: dati.tariffe, tecnico: BALLABIO, firmata: false, sostituita_il: null, creata_il: '2026-09-01T10:00:00Z', creata_da: 'a1',
  }
  const vecchia = { ...riga, id: 'l1', giorni: 'lunedì', firmata: true, sostituita_il: '2026-09-01T10:00:00Z', creata_il: '2026-08-30T10:00:00Z' }
  const db = m.creaSegreteriaSupabase({
    auth: { getSession: async () => ({ data: { session: null } }) },
    from: (tabella) => catena(tabella, tabella === 'lettere_incarico' ? { data: [riga, vecchia], error: null } : { data: null, error: null }),
    rpc: (f, args) => (chiesto.push([f, 'rpc', args]), catena(f, { data: riga, error: null })),
  })
  const sceltI = (x) => x && [x.id, x.personaId, x.stagione, x.qualifica, x.giorni, x.firmata, x.sostituitaIl ?? null, x.creataIl, x.tariffe, x.tecnico?.cognome]

  chiesto.length = 0
  await prova('fa la lettera con fai_lettera_incarico, e la rende', async () => sceltI(await db.faiLettera(dati)),
    ['l2', 'p1', '2026/27', 'Allenatore', 'venerdì', false, null, '2026-09-01T10:00:00Z', dati.tariffe, 'Ballabio'])
  const rpc = chiesto.find(([f, k]) => k === 'rpc')
  ok('la funzione giusta', rpc?.[0], 'fai_lettera_incarico')
  ok('coi nomi giusti degli argomenti', Object.keys(rpc?.[2] ?? {}).sort(), ['al', 'dal', 'data', 'giorni', 'persona', 'qualifica', 'stagione', 'tariffe', 'tecnico'])
  ok('e i valori', rpc?.[2] && [rpc[2].persona, rpc[2].stagione, rpc[2].dal, rpc[2].al, rpc[2].qualifica, rpc[2].giorni, rpc[2].data, rpc[2].tariffe, rpc[2].tecnico?.codiceFiscale],
    ['p1', '2026/27', '2026-09-01', '2027-07-30', 'Allenatore', 'venerdì', '2026-09-01', dati.tariffe, 'BLLDNI86H61H355W'])

  chiesto.length = 0
  ok('senza tariffe no, col messaggio', await errore(() => db.faiLettera({ ...dati, tariffe: [] })), 'Scrivi almeno una tariffa nella scheda prima di fare la lettera')
  ok('e non parte niente verso il database', chiesto.filter(([, k]) => k === 'rpc').length, 0)

  chiesto.length = 0
  await prova('spunta firmata', () => db.segnaFirmata('l2', true), undefined)
  ok('cambiando la sola colonna firmata', chiesto.filter(([tab, k]) => tab === 'lettere_incarico' && k === 'update').map(([, , r]) => r), [{ firmata: true }])
  ok('di quella lettera', chiesto.some(([tab, k, col, val]) => tab === 'lettere_incarico' && k === 'eq' && col === 'id' && val === 'l2'), true)
  chiesto.length = 0
  await prova('e la toglie', () => db.segnaFirmata('l2', false), undefined)
  ok('sempre con la sola colonna firmata', chiesto.filter(([tab, k]) => tab === 'lettere_incarico' && k === 'update').map(([, , r]) => r), [{ firmata: false }])

  chiesto.length = 0
  await prova('legge le lettere della persona da lettere_incarico', async () => (await db.lettere('p1')).map(sceltI), [
    ['l2', 'p1', '2026/27', 'Allenatore', 'venerdì', false, null, '2026-09-01T10:00:00Z', dati.tariffe, 'Ballabio'],
    ['l1', 'p1', '2026/27', 'Allenatore', 'lunedì', true, '2026-09-01T10:00:00Z', '2026-08-30T10:00:00Z', dati.tariffe, 'Ballabio'],
  ])
  ok('solo le sue', chiesto.some(([tab, k, col, val]) => tab === 'lettere_incarico' && k === 'eq' && col === 'persona_id' && val === 'p1'), true)
  ok('dalla più nuova', chiesto.some(([tab, k, col, o]) => tab === 'lettere_incarico' && k === 'order' && col === 'creata_il' && o?.ascending === false), true)
}

console.log('\n9. senza 79-lettere-incarico.sql: dice cosa lanciare')
{
  const tabella = { data: null, error: { message: 'relation "public.lettere_incarico" does not exist', code: '42P01' } }
  const funzione = {
    data: null,
    error: { message: 'Could not find the function public.fai_lettera_incarico(al, dal, data, giorni, persona, qualifica, stagione, tariffe, tecnico) in the schema cache', code: 'PGRST202' },
  }
  const risponde = (r) => {
    const c = new Proxy(() => c, { get: (_, k) => (k === 'then' ? (f, ko) => Promise.resolve(r).then(f, ko) : () => c), apply: () => c })
    return c
  }
  const db = m.creaSegreteriaSupabase({
    auth: { getSession: async () => ({ data: { session: null } }) },
    from: (t) => risponde(t === 'lettere_incarico' ? tabella : { data: null, error: null }),
    rpc: (f) => risponde(f === 'fai_lettera_incarico' ? funzione : { data: null, error: null }),
  })
  const lancia = (msg) => (msg.includes('va lanciato 79-lettere-incarico.sql') ? 'dice di lanciare 79-lettere-incarico.sql' : msg)
  ok('le lettere', lancia(await errore(() => db.lettere('p1'))), 'dice di lanciare 79-lettere-incarico.sql')
  ok('fare la lettera', lancia(await errore(() => db.faiLettera(dati))), 'dice di lanciare 79-lettere-incarico.sql')
  ok('spuntare firmata', lancia(await errore(() => db.segnaFirmata('l1', true))), 'dice di lanciare 79-lettere-incarico.sql')
  // PostgREST, quando la tabella non è nella sua cache, risponde così.
  const cache = m.creaSegreteriaSupabase({
    auth: { getSession: async () => ({ data: { session: null } }) },
    from: () => risponde({ data: null, error: { message: "Could not find the table 'public.lettere_incarico' in the schema cache", code: 'PGRST205' } }),
    rpc: () => risponde({ data: null, error: null }),
  })
  ok('le lettere, quando PostgREST non trova la tabella', lancia(await errore(() => cache.lettere('p1'))), 'dice di lanciare 79-lettere-incarico.sql')
}

console.log(guai ? `\n${guai} COSE NON TORNANO` : '\nTUTTO A POSTO')
process.exit(guai ? 1 : 0)
