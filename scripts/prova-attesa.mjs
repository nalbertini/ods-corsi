// ---------------------------------------------------------------------------
// Le voci della segreteria non si spostano mentre i dati arrivano, senza browser.
//
//   node scripts/prova-attesa.mjs
//
// Una tabella che compare dopo i dati spinge giù tutto quello che ha sotto
// (CLS 0,6–0,8 su ISCRITTI, STATISTICHE, PRESENZE ISTRUTTORI, ISTRUTTORI E ACCESSI).
// `lette` dice quando si può mostrare l'elenco: tutte le letture sono arrivate
// (o fallite: il guaio si vede al suo posto). Le voci poi non montano nulla
// sopra o sotto la tabella prima di quel punto.
// ---------------------------------------------------------------------------
import { readFileSync } from 'node:fs'
import { build } from 'esbuild'

let guai = 0
const ok = (cosa, avuto, voluto) => {
  const va = JSON.stringify(avuto) === JSON.stringify(voluto)
  console.log(va ? '  ✓' : '  ✗', cosa, va ? '' : `— atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`)
  if (!va) guai++
}

const { outputFiles } = await build({
  entryPoints: ['src/lib/letture.ts'],
  bundle: true,
  format: 'esm',
  write: false,
  logLevel: 'error',
})
const { lette } = await import('data:text/javascript;base64,' + Buffer.from(outputFiles[0].text).toString('base64'))

const arriva = { dato: [], guaio: null }
const attesa = { dato: null, guaio: null }
const guasta = { dato: null, guaio: 'non si legge' }
ok('una lettura in corso: non ancora', lette(attesa), false)
ok('una lettura arrivata', lette(arriva), true)
ok('una lettura fallita: si mostra il guaio, non si aspetta', lette(guasta), true)
ok('due letture, una in corso: non ancora', lette(arriva, attesa), false)
ok('due letture, una arrivata e una fallita', lette(arriva, guasta), true)

// Le quattro voci usano `lette` per tenere l'elenco fuori finché non è tutto arrivato.
const voce = (nome) => readFileSync(`src/components/segreteria/${nome}.tsx`, 'utf8')
ok('ISCRITTI aspetta le persone', /lette\(persone\)/.test(voce('Iscritti')), true)
ok('PRESENZE ISTRUTTORI aspetta presenze e lezioni da confermare', /lette\(elenco, proposte\)/.test(voce('PresenzeIstruttori')), true)
ok('ISTRUTTORI E ACCESSI aspetta il personale', /lette\(lista\)/.test(voce('Personale')), true)
ok('STATISTICHE aspetta le lezioni prima del blocco del sito', /lette\(stat\) && \(\s+<StatisticheSito/.test(voce('Statistiche')), true)
ok('PRESENZE ISTRUTTORI: la tabella aspetta come il riepilogo', /\{pronte && \(\s+<div role="table"/.test(voce('PresenzeIstruttori')), true)
ok('PRESENZE ISTRUTTORI: i menu di corso e istruttore hanno larghezza fissa', /id="corso-pi"[^>]*style=\{\{ width: \d+/.test(voce('PresenzeIstruttori')) && /id="istr-pi"[^>]*style=\{\{ width: \d+/.test(voce('PresenzeIstruttori')), true)
ok('STATISTICHE: il menu dei corsi ha larghezza fissa', /id="corso-s"[^>]*style=\{\{ width: \d+/.test(voce('Statistiche')), true)

console.log(guai ? `\n${guai} da correggere` : '\nTutto in ordine')
process.exit(guai ? 1 : 0)
