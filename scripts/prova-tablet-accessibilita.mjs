// ---------------------------------------------------------------------------
// L'accessibilità del tablet di sala e del timer, senza browser.
//
//   node scripts/prova-tablet-accessibilita.mjs
//
// Chi usa un lettore di schermo deve sentire l'esito di un tocco e il cambio
// di fase del timer. Una regione `role="status"` che nasce già piena non è
// affidabile: gli annunci vanno in una regione sempre presente, che cambia testo.
// ---------------------------------------------------------------------------
import { readFileSync } from 'node:fs'
import { build } from 'esbuild'

let fallite = 0
const ok = (cosa, avuto, voluto) => {
  const bene = JSON.stringify(avuto) === JSON.stringify(voluto)
  if (!bene) fallite++
  console.log(`${bene ? 'ok  ' : 'KO  '}${cosa}${bene ? '' : ` — avuto ${JSON.stringify(avuto)}, voluto ${JSON.stringify(voluto)}`}`)
}

const { outputFiles } = await build({
  stdin: { contents: "export { annuncioFascia } from './src/lib/tablet'", resolveDir: '.', loader: 'ts' },
  bundle: true, format: 'esm', write: false, logLevel: 'error', define: { 'import.meta.env': '{}' },
})
const { annuncioFascia } = await import('data:text/javascript;base64,' + Buffer.from(outputFiles[0].text).toString('base64'))

const p = { nome: 'Anna', sigla: 'M.' }
ok('nessuna fascia: niente da dire', annuncioFascia?.(null, false, ''), '')
ok('segnato: dice chi e che si può annullare', annuncioFascia?.({ tipo: 'fatto', p }, false, ''), 'Anna M.: presenza segnata. Toccato il nome sbagliato? C’è il tasto Annulla.')
ok('senza rete: lo dice', /rete/.test(annuncioFascia?.({ tipo: 'fatto', p, attesa: true }, false, '') ?? ''), true)
ok('lezione passata: dice il giorno', /sabato 24 ottobre/.test(annuncioFascia?.({ tipo: 'fatto', p }, true, 'sabato 24 ottobre') ?? ''), true)
ok('già presente', /già tra i presenti/.test(annuncioFascia?.({ tipo: 'gia', p, annulla: false }, false, '') ?? ''), true)
ok('istruttore', /istruttore/.test(annuncioFascia?.({ tipo: 'istruttore', p }, false, '') ?? ''), true)
ok('annullato', /annullat/i.test(annuncioFascia?.({ tipo: 'annullato', p }, false, '') ?? ''), true)
ok('errore: ripete il testo', /Anna: non segnato/.test(annuncioFascia?.({ tipo: 'errore', testo: 'Anna: non segnato. Riprova.' }, false, '') ?? ''), true)

const tocchi = readFileSync('src/components/tablet/tocchi.tsx', 'utf8')
ok('la fascia visibile non è una regione live (la sua è fissa)', /<div role="status" className="tb-fascia"/.test(tocchi), false)
ok('esiste la regione fissa degli annunci', /role="status"[^>]*className="vh"/.test(tocchi) || /className="vh"[^>]*role="status"/.test(tocchi), true)
for (const f of ['TabletPresenza', 'AppelloVeloce'])
  ok(`${f} monta la regione degli annunci anche senza fascia`, /<AnnuncioTocco\b/.test(readFileSync(`src/components/tablet/${f}.tsx`, 'utf8')), true)

const timer = readFileSync('timer/src/components/TimerScreen.tsx', 'utf8')
const css = readFileSync('timer/src/styles.css', 'utf8')
ok('il timer annuncia la fase (regione fissa)', /role="status"[^>]*className="vh"|className="vh"[^>]*role="status"/.test(timer), true)
ok('il timer ha la classe .vh (vive in un’ombra: non vede quella dell’app)', /^\.vh\s*\{/m.test(css), true)

// Le schede «Quali lezioni» hanno un'icona ciascuna; il nome accessibile resta il testo (le icone sono aria-hidden).
const istr = readFileSync('src/components/tablet/TabletIstruttore.tsx', 'utf8')
const icone = readFileSync('src/components/Icons.tsx', 'utf8')
ok('le schede Quali lezioni hanno un\'icona', /ICONE_TABLET\[id\]/.test(istr), true)
ok('le icone del tablet sono decorative', /export const ICONE_TABLET/.test(icone) && /function IconaVoce[\s\S]*aria-hidden="true"/.test(icone), true)
ok('la scheda tiene il testo come nome', /<span>\{nome\}<\/span>/.test(istr), true)

process.exit(fallite ? 1 : 0)
