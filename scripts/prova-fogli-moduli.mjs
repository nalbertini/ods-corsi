// ---------------------------------------------------------------------------
// I tre fogli di `public/moduli/`, costruiti da codice, senza browser.
//
//   node scripts/prova-fogli-moduli.mjs
//
// I PDF si rifanno con `npm run moduli:genera` (`src/lib/fogliModuli.ts`).
// Qui si controlla che i file COMMITTATI e quelli che `generaFogli` produce
// adesso siano la stessa cosa: le autorizzazioni con i campi giusti e le
// stesse parole di prima (`fixture-moduli/*.txt`, prese dai PDF di Google
// Docs con `pdfcraft-cli text` e normalizzate da `parole`), il foglio dei
// costi con ogni voce di `costi.ts`.
//
// Il testo si estrae con `pdfcraft-cli`: in locale, senza, la prova si salta
// con un avviso; in CI (CI=true) non si salta, fallisce.
// ---------------------------------------------------------------------------
import { build } from 'esbuild'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import fontkit from '@pdf-lib/fontkit'

const { outputFiles } = await build({
  stdin: {
    contents:
      "export { generaFogli, CAMPI_MAGGIORENNI, CAMPI_MINORI } from './src/lib/fogliModuli'; export { COSTI, OFFERTE, QUOTA_ASSOCIATIVA, STAGIONE, saldoAperto } from './src/lib/costi'; export { PAGAMENTO } from './src/lib/iscrizione'; export { PDFDocument, PDFName, PDFDict, PDFRawStream, PDFCheckBox, PDFTextField } from 'pdf-lib'",
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

if (spawnSync('pdfcraft-cli', ['--help']).error) {
  console.log(process.env.CI ? '  ✗ pdfcraft-cli manca: in CI la prova non si salta' : '  - pdfcraft-cli non c’è: prova saltata')
  process.exit(process.env.CI ? 1 : 0)
}

let guai = 0
const ok = (cosa, avuto, voluto) => {
  const va = JSON.stringify(avuto) === JSON.stringify(voluto)
  console.log(va ? '  ✓' : '  ✗', cosa, va ? '' : `— atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`)
  if (!va) guai++
}

const cartella = mkdtempSync(join(tmpdir(), 'fogli-moduli-'))
let n = 0
/** Il testo del PDF, pagine separate da \f. */
const testo = (pdf) => {
  const f = join(cartella, `${n++}.pdf`)
  writeFileSync(f, pdf)
  return execFileSync('pdfcraft-cli', ['text', f], { encoding: 'utf8' }).replace(/​/g, '')
}
/** Le parole come si confrontano: minuscole, senza punteggiatura né righe da riempire. */
const parole = (t) => t.toLowerCase().normalize('NFC').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(' ').filter(Boolean)
/** Il testo su una riga, apostrofi dritti, per cercarci una frase. */
const piatto = (t) => t.normalize('NFC').replace(/[’‘]/g, "'").replace(/\s+/g, ' ').toLowerCase()
const fixture = (nome) => readFileSync(`scripts/fixture-moduli/${nome}.txt`, 'utf8').split(/\s+/).filter(Boolean)

/**
 * Le parole di un'autorizzazione non cambiano: il foglio nuovo ha in più solo i titoletti di sezione e le
 * etichette sotto i campi (la pelle B approvata nel canvas `docs/design-canvas/moduli-pdf`), e perde solo
 * le parole che erano stampate accanto ai campi («C.F.», «nato/a», «il», «CAP», il «2» di «2___»), ora
 * etichette. Le differenze sono elencate una per una: una parola legale che cambia o sparisce le rompe.
 */
const DIFFERENZE = {
  maggiorenni: {
    tolte: ['2'],
    aggiunte: ['chi', 'firma', 'tesseramento', 'anno', 'immagini', 'e', 'fotografie', 'privacy'],
  },
  minori: {
    tolte: ['c', 'f', 'e', 'cap', 'nato', 'a', 'il'],
    aggiunte: ['chi', 'firma', 'codice', 'fiscale', 'a', 'prov', 'cap', 'il', 'minore', 'e', 'cognome', 'nato', 'a', 'a', 'il', 'immagini', 'e', 'video', 'tesseramento', 'anno', 'privacy'],
  },
}
/** Cosa manca e cosa c'è in più fra due liste di parole, alla più lunga sottosequenza comune. */
function differenze(prima, dopo) {
  const n = prima.length
  const k = dopo.length
  const L = Array.from({ length: n + 1 }, () => new Array(k + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) for (let j = k - 1; j >= 0; j--) L[i][j] = prima[i] === dopo[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1])
  const tolte = []
  const aggiunte = []
  let i = 0
  let j = 0
  while (i < n && j < k) {
    if (prima[i] === dopo[j]) {
      i++
      j++
    } else if (L[i + 1][j] >= L[i][j + 1]) {
      tolte.push(prima[i++])
    } else {
      aggiunte.push(dopo[j++])
    }
  }
  tolte.push(...prima.slice(i))
  aggiunte.push(...dopo.slice(j))
  return { tolte, aggiunte }
}

const campi = async (pdf) => (await m.PDFDocument.load(pdf)).getForm().getFields()
const vuoto = (c) => (c instanceof m.PDFCheckBox ? !c.isChecked() : c instanceof m.PDFTextField ? !c.getText() : true)
/** Gli oggetti del PDF che sono dizionari (anche di stream). */
const dizionari = (doc) =>
  doc.context.enumerateIndirectObjects().map(([, o]) => (o instanceof m.PDFDict ? o : o instanceof m.PDFRawStream ? o.dict : null)).filter(Boolean)
const diz = (o) => (o instanceof m.PDFRawStream ? o.dict : o)
const nomi = (d, k) => String(diz(d).get(m.PDFName.of(k)) ?? '')
/** Le immagini disegnate sulla prima pagina (le maschere di trasparenza non contano). */
const immagini = (doc) => {
  const xo = doc.getPage(0).node.Resources()?.lookup(m.PDFName.of('XObject'), m.PDFDict)
  return xo ? xo.keys().filter((k) => nomi(xo.lookup(k), 'Subtype') === '/Image').length : 0
}

const leggi = (f) => new Uint8Array(readFileSync(f))
const genera = (oggi) =>
  m.generaFogli({
    fontkit,
    fonts: {
      titolo: leggi('dati/moduli/fonts/big-shoulders-display-800.ttf'),
      corpo: leggi('dati/moduli/fonts/inter-regular.ttf'),
      corpoGrassetto: leggi('dati/moduli/fonts/inter-bold.ttf'),
    },
    loghi: { mascotte: leggi('dati/moduli/mascotte.png'), simbolo: leggi('dati/moduli/simbolo.png') },
    oggi,
  })
const generati = await genera('2026-10-18')
const committati = {
  maggiorenni: leggi('public/moduli/autorizzazioni-maggiorenni.pdf'),
  minori: leggi('public/moduli/autorizzazioni-minori.pdf'),
  costi: leggi('public/moduli/costi-2026-27.pdf'),
}
const origini = { committato: committati, generato: generati }

for (const [origine, pdf] of Object.entries(origini)) {
  console.log(`\n1. le autorizzazioni (${origine}): una pagina, i campi giusti`)
  for (const [foglio, attesi] of [['maggiorenni', m.CAMPI_MAGGIORENNI], ['minori', m.CAMPI_MINORI]]) {
    const doc = await m.PDFDocument.load(pdf[foglio])
    const cs = doc.getForm().getFields()
    ok(`${foglio}: una pagina A4`, [doc.getPageCount(), ...Object.values(doc.getPage(0).getSize()).map(Math.round)], [1, 595, 842])
    ok(`${foglio}: esattamente i campi di CAMPI_*`, cs.map((c) => c.getName()).sort(), [...attesi].sort())
    ok(`${foglio}: nessun campo ha un valore`, cs.filter((c) => !vuoto(c)).map((c) => c.getName()), [])
    const caselle = attesi.filter((c) => c === 'privacy' || c === 'foto' || c === 'tesseramento' || /^(tesseramento|foto)(Si|No)$/.test(c))
    ok(
      `${foglio}: le caselle sono caselle`,
      cs.filter((c) => c instanceof m.PDFCheckBox).map((c) => c.getName()).sort(),
      caselle.sort(),
    )
    ok(`${foglio}: il titolo del documento c’è`, Boolean(doc.getTitle()?.trim()), true)
    ok(`${foglio}: la lingua è italiano`, doc.catalog.lookup(m.PDFName.of('Lang'))?.decodeText?.(), 'it')
    const ds = dizionari(doc)
    ok(`${foglio}: nessun JavaScript`, ds.some((d) => d.has(m.PDFName.of('JS')) || d.has(m.PDFName.of('AA')) || nomi(d, 'S') === '/JavaScript') || doc.catalog.has(m.PDFName.of('OpenAction')), false)
  }
}

console.log('\n2. le parole delle autorizzazioni sono quelle di prima')
for (const [origine, pdf] of Object.entries(origini)) {
  for (const foglio of ['maggiorenni', 'minori']) {
    const t = testo(pdf[foglio])
    const avute = parole(t)
    const volute = fixture(foglio)
    const { tolte, aggiunte } = differenze(volute, avute)
    ok(`${origine} ${foglio}: le parole di prima ci sono, tranne ${tolte.length ? '«' + tolte.join(' ') + '»' : 'nessuna'}`, tolte, DIFFERENZE[foglio].tolte)
    ok(`${origine} ${foglio}: le parole in più sono solo titoletti ed etichette dei campi`, aggiunte, DIFFERENZE[foglio].aggiunte)
    const p = piatto(t)
    ok(`${origine} ${foglio}: il piè di pagina legale`, ['corso francia 224', 'p.iva', 'asd il centro judo'].filter((s) => !p.includes(s) && !p.includes(s.replace('p.iva', 'p.iva:'))), [])
  }
}

/** Le cifre del testo: ogni «340€», «340 €», «340» è un 340. */
const cifre = (t) => new Set(t.replace(/€/g, ' ').split(/\s+/).filter((s) => /^\d+$/.test(s)))

console.log('\n3. il foglio dei costi')
const costi = async (pdf, oggi) => {
  const doc = await m.PDFDocument.load(pdf)
  const t = testo(pdf)
  const p = piatto(t)
  const mancano = []
  for (const v of m.COSTI) {
    if (!p.includes(piatto(v.corso))) mancano.push(v.corso)
    const c = cifre(t)
    for (const pz of v.prezzi) {
      for (const k of ['annuale', 'trimestre', ...(m.saldoAperto(oggi) ? ['saldo'] : [])]) {
        if (pz[k] != null && !c.has(String(pz[k]))) mancano.push(`${v.corso} ${k} ${pz[k]}`)
      }
    }
  }
  if (!cifre(t).has(String(m.QUOTA_ASSOCIATIVA))) mancano.push(`quota ${m.QUOTA_ASSOCIATIVA}`)
  if (!/2026\s*[-/]\s*(20)?27/.test(t)) mancano.push(`stagione ${m.STAGIONE}`)
  for (const o of m.OFFERTE) {
    if (!p.includes(piatto(o.titolo))) mancano.push(o.titolo)
    if (!p.includes(piatto(o.testo))) mancano.push(o.testo)
  }
  if (!p.replace(/ /g, '').includes(m.PAGAMENTO.iban.replace(/ /g, '').toLowerCase())) mancano.push('iban')
  if (!p.includes(piatto(m.PAGAMENTO.intestatario))) mancano.push('intestatario')
  return { doc, t, mancano }
}
{
  const { doc, mancano } = await costi(committati.costi, '2026-10-18')
  ok('committato: al massimo 2 pagine', doc.getPageCount() <= 2, true)
  ok('committato: tutte le voci, la quota, la stagione, le offerte, l’IBAN', mancano, [])
}
const agosto = await costi((await genera('2026-08-01')).costi, '2026-08-01')
const ottobre = await costi(generati.costi, '2026-10-18')
ok('1 agosto: al massimo 2 pagine', agosto.doc.getPageCount() <= 2, true)
ok('1 agosto: tutte le voci, anche il saldo', agosto.mancano, [])
ok('1 agosto: la colonna SALDO', /\bsaldo\b/i.test(agosto.t), true)
ok('18 ottobre: al massimo 2 pagine', ottobre.doc.getPageCount() <= 2, true)
ok('18 ottobre: tutte le voci, senza saldo', ottobre.mancano, [])
ok('18 ottobre: la parola SALDO non c’è', /\bsaldo\b/i.test(ottobre.t), false)
// Una cifra di saldo che non è anche un annuale, un trimestre o altro del foglio: a ottobre non può esserci.
const altre = new Set(m.COSTI.flatMap((v) => v.prezzi.flatMap((p) => [p.annuale, p.trimestre])).concat(m.QUOTA_ASSOCIATIVA).map(String))
const soloSaldo = [...new Set(m.COSTI.flatMap((v) => v.prezzi.map((p) => p.saldo)).filter((s) => s != null && !altre.has(String(s))).map(String))]
ok('ci sono cifre di solo saldo da cercare', soloSaldo.length > 0, true)
ok('18 ottobre: nessuna cifra di solo saldo', soloSaldo.filter((s) => cifre(ottobre.t).has(s)), [])
ok('1 agosto: le cifre di solo saldo ci sono', soloSaldo.filter((s) => !cifre(agosto.t).has(s)), [])

console.log('\n4. i file committati sono quelli che si generano (con oggi = 2026-10-18)')
for (const foglio of ['maggiorenni', 'minori', 'costi']) {
  ok(`${foglio}: stesso testo`, testo(committati[foglio]), testo(generati[foglio]))
  const f = async (pdf) => (await campi(pdf)).map((c) => `${c.getName()}:${c.constructor.name}`)
  ok(`${foglio}: stessi campi`, await f(committati[foglio]), await f(generati[foglio]))
  ok(`${foglio}: stesse pagine`, (await m.PDFDocument.load(committati[foglio])).getPageCount(), (await m.PDFDocument.load(generati[foglio])).getPageCount())
}

console.log('\n5. i font e le immagini della testata')
for (const [origine, pdf] of Object.entries(origini)) {
  for (const foglio of ['maggiorenni', 'minori', 'costi']) {
    const doc = await m.PDFDocument.load(pdf[foglio])
    const fonts = dizionari(doc).filter((d) => nomi(d, 'Type') === '/Font').map((d) => nomi(d, 'BaseFont'))
    ok(`${origine} ${foglio}: Big Shoulders incorporato`, fonts.some((f) => /big\s*shoulders/i.test(f)), true)
    ok(`${origine} ${foglio}: Inter incorporato`, fonts.some((f) => /inter/i.test(f)), true)
    ok(`${origine} ${foglio}: due immagini in testata`, immagini(doc), 2)
  }
}

console.log(guai ? `\n${guai} controlli non tornano\n` : '\nTutto torna\n')
process.exit(guai ? 1 : 0)
