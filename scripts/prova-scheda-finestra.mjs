// ---------------------------------------------------------------------------
// I dettagli della segreteria in una finestra sopra l'elenco, senza browser.
//
//   node scripts/prova-scheda-finestra.mjs
//
// Richieste, Corsi, Iscritti, Personale e Vestiario aprono il dettaglio in
// una finestra (`SchedaPiena`), a ogni larghezza: non c'è più la scheda
// affiancata, né una soglia dello schermo che decide. Le regole che si
// provano qui stanno in src/lib/schedaFinestra.ts: il passaggio alla scheda dopo e
// prima, il «2 DI 14», e il clic fuori che chiude solo se non si perde niente.
// ---------------------------------------------------------------------------
import { existsSync, readFileSync } from 'node:fs'
import { build } from 'esbuild'

let guai = 0
const ok = (cosa, avuto, voluto) => {
  const va = JSON.stringify(avuto) === JSON.stringify(voluto)
  console.log(va ? '  ✓' : '  ✗', cosa, va ? '' : `— atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`)
  if (!va) guai++
}
const leggi = (f) => readFileSync(f, 'utf8')

console.log('\nPassare da una scheda all\'altra')
const m = existsSync('src/lib/schedaFinestra.ts')
  ? await (async () => {
      const { outputFiles } = await build({
        stdin: { contents: "export * from './src/lib/schedaFinestra'", resolveDir: '.', loader: 'ts' },
        bundle: true, format: 'esm', write: false, logLevel: 'error',
      })
      return import('data:text/javascript;base64,' + Buffer.from(outputFiles[0].text).toString('base64'))
    })()
  : null
ok('src/lib/schedaFinestra.ts c\'è', m !== null, true)
if (m) {
  const ids = ['a', 'b', 'c']
  ok('la successiva è quella dopo', m.vicina(ids, 'a', 1), 'b')
  ok('la precedente è quella prima', m.vicina(ids, 'c', -1), 'b')
  ok('in fondo non c\'è una successiva: non gira in tondo', m.vicina(ids, 'c', 1), null)
  ok('in cima non c\'è una precedente', m.vicina(ids, 'a', -1), null)
  ok('una scheda che non è nell\'elenco (filtrato, sparita) non ha vicine', m.vicina(ids, 'x', 1), null)
  ok('senza scheda aperta non ha vicine', m.vicina(ids, null, 1), null)
  ok('un elenco vuoto non ha vicine', m.vicina([], 'a', 1), null)
  ok('«2 DI 3» per la scheda in mezzo', m.posizione(ids, 'b'), '2 DI 3')
  ok('«1 DI 1» se è sola', m.posizione(['a'], 'a'), '1 DI 1')
  ok('niente posizione se non è nell\'elenco', m.posizione(ids, 'x'), null)
  ok('il clic fuori chiude se non c\'è niente da perdere', m.clicFuoriChiude(false), true)
  ok('il clic fuori non fa niente con modifiche non salvate', m.clicFuoriChiude(true), false)
}

console.log('\nLa finestra, a ogni larghezza')
const comune = leggi('src/components/segreteria/comune.tsx')
const finestra = comune.slice(comune.indexOf('export function SchedaPiena'), comune.indexOf('type Ordine<'))
ok('SchedaPiena è una finestra modale', /role="dialog"[^>]*aria-modal="true"|aria-modal="true"[^>]*role="dialog"/.test(finestra), true)
ok('Esc e il tasto Chiudi passano da onTorna (che chiede delle modifiche)', [/useDialogo(<[^>]*>)?\(onTorna\)/.test(finestra), /onClick=\{onTorna\}/.test(finestra)], [true, true])
ok('il clic fuori chiede a `clicFuoriChiude` se chiudere', /clicFuoriChiude\(bozzaAperta\(\)\)/.test(finestra), true)
ok('non porta più la pagina in cima (apriScheda)', /apriScheda/.test(finestra), false)
for (const f of ['Richieste', 'Corsi']) {
  const src = leggi(`src/components/segreteria/${f}.tsx`)
  ok(`${f}: nessuna soglia dello schermo (STRETTO)`, /STRETTO|useSchermo/.test(src), false)
  ok(`${f}: la scheda sta sempre nella finestra`, /<SchedaPiena/.test(src), true)
  ok(`${f}: PRECEDENTE e SUCCESSIVA passano da lib/schedaFinestra`, /from '\.\.\/\.\.\/lib\/schedaFinestra'/.test(src), true)
}
for (const f of ['Iscritti', 'Personale', 'Vestiario'])
  ok(`${f}: l'elenco resta visibile sotto la finestra`, /className="stack" style=\{\{ gap: 18 \}\} hidden=/.test(leggi(`src/components/segreteria/${f}.tsx`)), false)
ok('Richieste: accolta o rifiutata la finestra si chiude (onConclusa)', /onConclusa/.test(leggi('src/components/segreteria/Richieste.tsx')), true)
const richieste = leggi('src/components/segreteria/Richieste.tsx')
ok('Richieste: la data del certificato scritta è una bozza (clic fuori e PRECEDENTE non la perdono)', /useBozza\(scadeCert/.test(richieste), true)
ok('Richieste: ✕, Esc, PRECEDENTE e SUCCESSIVA chiedono prima (lasciare)', /if \(await lasciare\(\)\) setScelta\(id\)/.test(richieste) && /onTorna=\{\(\) => void apri\(null\)\}/.test(richieste) && /\(\) => void apri\(id\)/.test(richieste), true)
ok('Corsi non apre più da solo il primo corso', /visti\[0\]/.test(leggi('src/components/segreteria/Corsi.tsx')), false)

console.log('\nIl CSS')
const css = leggi('src/styles.css')
ok('nessuna regola tiene la scheda affiancata a 420px (PR 478)', /\.sg-due-colonne > \.sg-scheda/.test(css), false)
ok('c\'è la finestra, con la sua barra in alto', /\.sg-finestra\s*\{[^}]*border-top/.test(css), true)
ok('il corpo scorre e il piede resta (la finestra è una colonna)', /\.sg-finestra\s*\{[^}]*flex-direction:\s*column/.test(css) && /\.sg-finestra-corpo\s*\{[^}]*overflow-y:\s*auto/.test(css), true)
ok('la finestra sta sopra il suo velo (se no il velo prende i clic)', [/\.sg-finestra-velo\s*\{[^}]*z-index:\s*0/.test(css), /\.sg-finestra\s*\{[^}]*z-index:\s*1/.test(css)], [true, true])
ok('sul telefono la testa non va a capo: il ✕ resta con PRECEDENTE e SUCCESSIVA', /@media \(max-width: 767px\)[^@]*\.sg-finestra-testa\s*\{[^}]*flex-wrap:\s*nowrap/.test(css.replace(/\n/g, ' ')), true)
ok('a una colonna i campi che occupano due colonne tornano a una (se no si sovrappongono)', /@media \(max-width: 1000px\)\s*\{\s*\.sg-tre > \* \{[^}]*grid-column:\s*auto/.test(css), true)
ok('sul telefono la finestra prende tutto lo schermo', /@media \(max-width: 767px\)\s*\{[^}]*\.sg-finestra\s*\{/.test(css.replace(/\n/g, ' ')), true)

console.log(guai ? `\n${guai} cosa non torna` : '\nTUTTO A POSTO')
process.exit(guai ? 1 : 0)
