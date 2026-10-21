// ---------------------------------------------------------------------------
// DA FARE: i testi delle righe e dei tasti, senza browser.
//
//   node scripts/prova-dafare.mjs
//
// src/lib/daFareTesti.ts esporta TESTI_DA_FARE e classeTastoDaFare;
// DaFare.tsx li importa. I titoli delle caselle di COSA MANCA stanno in cosaManca.ts.
// ---------------------------------------------------------------------------
import { existsSync, readFileSync } from 'node:fs'
import { build } from 'esbuild'

let guai = 0
const ok = (cosa, avuto, voluto) => {
  const va = JSON.stringify(avuto) === JSON.stringify(voluto)
  console.log(va ? '  ✓' : '  ✗', cosa, va ? '' : `— atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`)
  if (!va) guai++
}
const impacchetta = async (contents) => {
  const { outputFiles } = await build({
    stdin: { contents, resolveDir: '.', loader: 'ts' },
    bundle: true, format: 'esm', write: false, logLevel: 'error', define: { 'import.meta.env': '{}' },
  })
  return import('data:text/javascript;base64,' + Buffer.from(outputFiles[0].text).toString('base64'))
}

const c = existsSync('src/lib/daFareTesti.ts')
const m = c ? await impacchetta("export * from './src/lib/daFareTesti'") : {}
const T = m.TESTI_DA_FARE ?? 'src/lib/daFareTesti.ts non esiste'

const VOLUTI = {
  appelli: ['Lezione senza appello', 'Lezioni senza appello', 'Fai gli appelli'],
  richieste: ['Richiesta online nuova', 'Richieste online nuove', 'Accogli le richieste'],
  istruttori: ['Presenza istruttore da confermare', 'Presenze istruttori da confermare', 'Conferma le presenze'],
  segnalate: ['Presenza segnalata da vedere', 'Presenze segnalate da vedere', 'Apri le segnalate'],
  certificati: ['Iscritto senza certificato valido', 'Iscritti senza certificato valido', 'Chiedi i certificati'],
  scadenza: ['Certificato in scadenza', 'Certificati in scadenza', 'Vedi chi'],
  arrivo: ['Iscritto compie 6 anni senza certificato', 'Iscritti compiono 6 anni senza certificato', 'Vedi chi'],
  pagare: ['Iscritto da pagare', 'Iscritti da pagare', 'Vedi chi deve pagare'],
  corsi: ['Iscritto con un corso scaduto', 'Iscritti con un corso scaduto', 'Vedi chi'],
  listino: ['Corso con un prezzo mancante', 'Corsi con un prezzo mancante', 'Apri listino'],
  'file-di-prima': ['Certificato non archiviato', 'Certificati non archiviati', 'Vedi quali'],
  'documenti-stampa': ['Richiesta con documenti da stampare', 'Richieste con documenti da stampare', 'Vedi quali'],
}

console.log('\nI testi')
ok('le dodici cose, e nessun\'altra', typeof T === 'object' ? Object.keys(T).sort() : T, Object.keys(VOLUTI).sort())
for (const [k, [singolare, plurale, tasto]] of Object.entries(VOLUTI))
  ok(`${k}: singolare, plurale, tasto`, [T[k]?.singolare, T[k]?.plurale, T[k]?.tasto], [singolare, plurale, tasto])
ok('nessun testo è tutto maiuscolo', typeof T === 'object'
  ? Object.values(T).flatMap((t) => [t.singolare, t.plurale, t.tasto]).filter((s) => s === s.toUpperCase()) : T, [])

console.log('\nIl tasto principale')
ok('il primo tasto è pieno', m.classeTastoDaFare?.(0), 'sg-btn-pieno')
ok('gli altri undici sono a linea', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => m.classeTastoDaFare?.(i)), Array(11).fill('sg-btn-linea'))

console.log('\nDaFare.tsx')
const tsx = readFileSync('src/components/segreteria/DaFare.tsx', 'utf8')
ok('importa TESTI_DA_FARE', /import[^;]*TESTI_DA_FARE[^;]*daFareTesti/.test(tsx), true)
ok('non ha più TUTTE IN PRESENZE né VEDI CHI', [tsx.includes('TUTTE IN PRESENZE'), tsx.includes('VEDI CHI')], [false, false])

console.log('\nI titoli di COSA MANCA')
const cm = await impacchetta("export * from './src/lib/cosaManca'")
ok('i titoli delle cinque caselle', cm.caselleCosaManca({ appelli: 1, certificati: 2, pagamenti: 3, tessere: 4, richieste: 5, contato: true }).map((x) => x.titolo),
  ['Appelli non fatti', 'Certificati scaduti', 'Pagamenti', 'Senza tessera', 'Richieste online'])

ok('con il conto dei corsi le caselle diventano sei, «Corsi scaduti» dopo «Pagamenti»', cm.caselleCosaManca({ appelli: 1, certificati: 2, pagamenti: 3, corsi: 6, tessere: 4, richieste: 5, contato: true }).map((x) => x.titolo),
  ['Appelli non fatti', 'Certificati scaduti', 'Pagamenti', 'Corsi scaduti', 'Senza tessera', 'Richieste online'])

console.log(guai ? `\n${guai} ${guai === 1 ? 'cosa non torna' : 'cose non tornano'}` : '\nTUTTO A POSTO')
process.exit(guai ? 1 : 0)
