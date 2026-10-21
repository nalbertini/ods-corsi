// ---------------------------------------------------------------------------
// La carta intestata dei documenti, senza browser.
//
//   node scripts/prova-carta.mjs
//
// Ricevute, compensi, bilancio, chiusura di cassa, report e lettera escono
// sulla carta intestata di public/moduli (`src/lib/cartaPdf.ts`). Qui come si
// prende: `cartaIntestata` la scarica o dice perché no, `stampaSuCarta` chiede
// a chi stampa se va bene senza, `cartaSePuoi` va avanti senza dove non c'è
// nessuno a cui chiedere (il genitore nell'area iscritti, la ricevuta per
// email). Lo scaricatore è finto: la carta arriva, 404, rete giù, HTML al posto
// del PDF. Come esce ogni documento sulla carta lo provano i loro script.
// ---------------------------------------------------------------------------
import { build } from 'esbuild'

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

let c = {}
try {
  const { outputFiles } = await build({
    stdin: { contents: "export * from './src/lib/cartaPdf'", resolveDir: '.', loader: 'ts' },
    bundle: true,
    format: 'esm',
    platform: 'node',
    write: false,
    logLevel: 'silent',
    define: { 'import.meta.env': '{}' },
  })
  c = await import('data:text/javascript;base64,' + Buffer.from(outputFiles[0].text).toString('base64'))
} catch (e) {
  console.log('  ✗ src/lib/cartaPdf.ts non si carica —', e.errors?.[0]?.text ?? e.message)
  guai++
}

const AVVISO = 'La carta intestata non si scarica: controlla la connessione e riprova.'
const PDF = new Uint8Array(Buffer.from('%PDF-1.7\n%finta\n%%EOF\n'))
const testo = (byte) => new TextDecoder().decode(byte)
const risposta = (va, byte) => async () => ({ ok: va, arrayBuffer: async () => new Uint8Array(byte).buffer })
const scaricatori = [
  ['in 404', risposta(false, [])],
  ['senza rete', async () => { throw new TypeError('Failed to fetch') }],
  ['con una pagina HTML al posto del PDF', risposta(true, Buffer.from('<!doctype html><html></html>'))],
]

console.log('1. cartaIntestata: la carta, o un messaggio per chi usa l’app')
await prova('la carta arriva: il PDF com’è', async () => testo(await c.cartaIntestata(risposta(true, PDF))), testo(PDF))
for (const [come, scarica] of scaricatori) await prova(`la carta ${come}: il messaggio`, () => c.cartaIntestata(scarica).then(() => 'scaricata', (e) => e.message), AVVISO)

console.log('\n2. stampaSuCarta: con la carta stampa, senza chiede')
{
  /** Cosa succede, in ordine: chi è chiamato e con cosa. */
  const giro = async (scarica, rispondi) => {
    const fatto = []
    const stampa = async (carta) => {
      fatto.push(carta === undefined ? 'stampa senza carta' : `stampa con ${carta.length} byte`)
    }
    const senzaCarta = async (messaggio, stampaSenza) => {
      fatto.push(`chiede: ${messaggio}`)
      if (rispondi) await stampaSenza()
    }
    await c.stampaSuCarta(stampa, senzaCarta, scarica)
    return fatto
  }
  await prova('la carta arriva: stampa con la carta, senza chiedere', () => giro(risposta(true, PDF), true), [`stampa con ${PDF.length} byte`])
  for (const [come, scarica] of scaricatori) {
    await prova(`la carta ${come}: chiede col messaggio, e se si dice sì stampa senza carta`, () => giro(scarica, true), [`chiede: ${AVVISO}`, 'stampa senza carta'])
    await prova(`la carta ${come}: se non si dice sì, non stampa`, () => giro(scarica, false), [`chiede: ${AVVISO}`])
  }
}

console.log('\n3. cartaSePuoi: la carta, o niente')
await prova('la carta arriva: la carta', async () => testo(await c.cartaSePuoi(risposta(true, PDF))), testo(PDF))
for (const [come, scarica] of scaricatori) await prova(`la carta ${come}: niente, senza errore`, async () => (await c.cartaSePuoi(scarica)) ?? 'niente', 'niente')

console.log('\n4. una carta che comincia bene ma è tagliata (un file a metà, un proxy) non è arrivata')
await prova('una carta senza la fine del PDF: il messaggio', () => c.cartaIntestata(risposta(true, Buffer.from('%PDF-1.7\n1 0 obj'))).then(() => 'scaricata', (e) => e.message), AVVISO)

console.log('\n5. suCarta: senza carta un guaio col tasto SENZA CARTA, che stampa e dice com’è andata')
{
  const chiamate = []
  // Il `fai` della segreteria, finto: dice com'è andata e fa l'operazione.
  const fai = async (op, riuscito) => {
    chiamate.push(riuscito ?? '(niente)')
    await op()
    return true
  }
  const stampate = []
  let errore
  await Promise.resolve(c.suCarta?.(fai, async (carta) => void stampate.push(carta ? 'con carta' : 'senza carta'), risposta(false, []))).catch((e) => (errore = e))
  ok('senza carta: un guaio, che non stampa da solo', [typeof c.GuaioConAzione === 'function' && errore instanceof c.GuaioConAzione, errore?.message, stampate], [true, AVVISO, []])
  ok('col tasto «Senza carta»', errore?.azione?.etichetta, 'Senza carta')
  await errore?.azione?.fa()
  await new Promise((r) => setTimeout(r, 0))
  ok('il tasto stampa senza carta e l’esito prende il posto del guaio', [stampate, chiamate], [['senza carta'], ['PDF scaricato senza carta intestata']])
  await prova('con la carta stampa e basta', async () => {
    const s = []
    await c.suCarta(fai, async (carta) => void s.push(carta ? 'con carta' : 'senza carta'), risposta(true, PDF))
    return s
  }, ['con carta'])
}

console.log(guai ? `\n${guai} ${guai === 1 ? 'cosa non torna' : 'cose non tornano'}` : '\nTUTTO A POSTO')
process.exit(guai ? 1 : 0)
