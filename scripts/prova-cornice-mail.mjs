// ---------------------------------------------------------------------------
// La cornice delle email in uscita, senza browser.
//
//   node scripts/prova-cornice-mail.mjs
//
// Gli avvisi alla segreteria e la ricevuta alle famiglie escono con la stessa
// cornice HTML (`src/lib/cornicaMail.ts`, copiata identica nelle due cartelle
// delle funzioni, che girano su Deno). Qui la cornice da sola; gli avvisi e la
// ricevuta incorniciati si provano in prova-avvisi-segreteria.mjs e
// prova-ricevute-email.mjs.
//   incorniciaMail(corpoHtml: string, c: { testata: string; piede: string }) → string
//     il corpo è GIÀ convertito: non si converte di nuovo; testata e piede sono testo semplice.
//   tastoMail(etichetta: string, link: string) → string   (tasto vero + indirizzo scritto sotto)
//   tabellaMail(righe: [string, string][]) → string       (etichetta/valore, valori convertiti)
// ---------------------------------------------------------------------------
import { build } from 'esbuild'
import { existsSync, readFileSync } from 'node:fs'

const impacchetta = async (contents) => {
  const { outputFiles } = await build({ stdin: { contents, resolveDir: '.', loader: 'ts' }, bundle: true, format: 'esm', write: false, logLevel: 'silent' })
  return import('data:text/javascript;base64,' + Buffer.from(outputFiles[0].text).toString('base64'))
}

let c = {}
try {
  c = await impacchetta("export * from './src/lib/cornicaMail'")
} catch {
  console.log('(manca src/lib/cornicaMail.ts)')
}

let guai = 0
const ok = (cosa, avuto, voluto) => {
  const va = JSON.stringify(avuto) === JSON.stringify(voluto)
  console.log(va ? '  ✓' : '  ✗', cosa, va ? '' : `— atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`)
  if (!va) guai++
}
const lib = (nome) => (typeof c[nome] === 'function' ? c[nome] : () => `manca ${nome}`)
const incorniciaMail = lib('incorniciaMail')
const tastoMail = lib('tastoMail')
const tabellaMail = lib('tabellaMail')

const PROIBITI = ['<script', '<link', '@import', 'url(http', '<img']
const LINK = 'https://corsi.esempio.it/segreteria/#richieste/abc'
const C = { testata: 'ODS CORSI · AVVISO', piede: 'Avviso automatico dell’app ODS Corsi.' }

console.log('1. la cornice')
{
  const h = incorniciaMail('<p>Ciao</p>', C)
  ok('è una stringa col corpo, la testata e il piede', [typeof h, String(h).includes('<p>Ciao</p>'), String(h).includes(C.testata), String(h).includes(C.piede)], ['string', true, true, true])
  ok('colonna di 560px, in tabelle con stili inline', [/max-width:\s*560px/.test(h), /<table/.test(h), /style="/.test(h)], [true, true, true])
  ok('dichiara i colori chiari e scuri', [/<meta name="color-scheme"/.test(h), /supported-color-schemes/.test(h)], [true, true])
  ok('niente script, link, @import, immagini', PROIBITI.filter((x) => String(h).includes(x)), [])
}
{
  const h = incorniciaMail('<p>a &lt;b&gt; &amp; c</p>', { testata: 'A <b> & "c"', piede: '<i>fine</i>' })
  ok('un corpo già convertito non si riconverte', [h.includes('a &lt;b&gt; &amp; c'), h.includes('&amp;lt;'), h.includes('&amp;amp;')], [true, false, false])
  ok('testata e piede sono testo semplice: li converte la cornice', [h.includes('A &lt;b&gt; &amp; &quot;c&quot;'), h.includes('&lt;i&gt;fine&lt;/i&gt;'), h.includes('<i>')], [true, true, false])
}

console.log('\n2. il tasto')
{
  const h = tastoMail('Apri la richiesta', LINK)
  ok('un tasto vero: link con l\'indirizzo, cella colorata dentro una tabella', [h.includes(`<a href="${LINK}"`), /<table/.test(h), /background(-color)?:\s*#0d2a3d/i.test(h)], [true, true, true])
  ok('sotto, l\'indirizzo scritto', [h.split(LINK).length - 1, new RegExp(`>\\s*${LINK}\\s*<`).test(h), h.includes('Apri la richiesta')], [2, true, true])
  const brutto = tastoMail('Apri "così" <b>', 'https://x.it/?a="b"&c=<d>')
  ok('etichetta e indirizzo convertiti: nessun " nell\'href', [brutto.match(/href="([^"]*)"/)?.[1], brutto.includes('<b>'), brutto.includes('Apri &quot;così&quot; &lt;b&gt;')], ['https://x.it/?a=&quot;b&quot;&amp;c=&lt;d&gt;', false, true])
  // Contrasto WCAG del testo sul tasto: almeno 4,5.
  const luce = (hex) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }
  const sfondo = h.match(/background(?:-color)?:\s*(#[0-9a-f]{6})/i)?.[1]
  const testo = h.match(/(?:^|[;"'\s])color:\s*(#[0-9a-f]{6})/i)?.[1]
  const [chiaro, scuro] = sfondo && testo ? [Math.max(luce(sfondo), luce(testo)), Math.min(luce(sfondo), luce(testo))] : [0, 0]
  ok('testo #ffffff su #0d2a3d', [testo?.toLowerCase(), sfondo?.toLowerCase()], ['#ffffff', '#0d2a3d'])
  ok('contrasto almeno 4,5', (chiaro + 0.05) / (scuro + 0.05) >= 4.5, true)
  ok('niente script, link, @import, immagini', PROIBITI.filter((x) => h.includes(x)), [])
}

console.log('\n3. la tabella')
{
  const h = tabellaMail([['Ricevuta n.', '12/2026'], ['Intestata a', '<script>alert(1)</script> & "x"']])
  ok('etichette e valori', [h.includes('Ricevuta n.'), h.includes('12/2026'), h.includes('Intestata a'), /<table/.test(h)], [true, true, true, true])
  ok('i valori convertiti', [h.includes('&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;x&quot;'), h.includes('<script')], [true, false])
}

console.log('\n4. le copie per Deno sono identiche')
{
  const leggi = (f) => (existsSync(f) ? readFileSync(f, 'utf8') : `manca ${f}`)
  const originale = leggi('src/lib/cornicaMail.ts')
  ok('src/lib/cornicaMail.ts c\'è e non importa niente', [originale.startsWith('manca'), /^\s*import\s/m.test(originale)], [false, false])
  for (const dir of ['avvisi-segreteria', 'ricevuta-email'])
    ok(`${dir}/cornicaMail.ts è la copia`, leggi(`supabase/functions/${dir}/cornicaMail.ts`) === originale, true)
}

console.log(guai ? `\n${guai} COSE NON TORNANO` : '\nTUTTO A POSTO')
if (guai) process.exit(1)
