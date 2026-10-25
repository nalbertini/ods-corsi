// ---------------------------------------------------------------------------
// L'accessibilità delle pagine dietro il login, senza browser.
//
//   node scripts/prova-a11y-dietro-login.mjs
//
// Quattro punti trovati da Lighthouse in modalità prova: i tasti di ordinamento
// piccoli (WCAG 2.5.8), la sala senza <main>, la tabella dei movimenti con
// figli che non sono righe, i titoli che saltano un livello.
// ---------------------------------------------------------------------------
import { readFileSync } from 'node:fs'

let fallite = 0
const ok = (cosa, avuto, voluto) => {
  const bene = JSON.stringify(avuto) === JSON.stringify(voluto)
  if (!bene) fallite++
  console.log(`${bene ? 'ok  ' : 'KO  '}${cosa}${bene ? '' : ` — avuto ${JSON.stringify(avuto)}, voluto ${JSON.stringify(voluto)}`}`)
}

const css = readFileSync('src/styles.css', 'utf8')
const tablet = readFileSync('src/components/tablet/Tablet.tsx', 'utf8')
const comune = readFileSync('src/components/segreteria/comune.tsx', 'utf8')
const app = readFileSync('src/App.tsx', 'utf8')
const contabilita = readFileSync('src/components/segreteria/Contabilita.tsx', 'utf8')

const regolaOrdina = css.match(/^\.sg-ordina \{([^}]*)\}/m)?.[1] ?? ''
const alto = Number(regolaOrdina.match(/min-height:\s*(\d+)px/)?.[1] ?? 0)
ok('il tasto di ordinamento è alto almeno 24px', alto >= 24, true)

ok('ogni schermata della sala ha un <main>', (tablet.match(/<div className="tb">/g) ?? []).length, 0)
ok('la sala ha il suo <main>', (tablet.match(/<main className="tb">/g) ?? []).length >= 4, true)

ok('i titoli di sezione sono h2, sotto l\'h1 della pagina', /<h2 className="sg-etichetta"[^>]*>\s*(\{icona\}\s*)?\{titolo\}/.test(comune), true)

// Una tabella con ruoli ARIA ha per figli solo righe: il messaggio «nessun movimento»
// e «Mostra altre» stanno in una riga con la loro cella.
const mezzo = contabilita.slice(contabilita.indexOf('aria-label="Movimenti"'))
ok('«Nessun movimento» sta in una riga', /role="row"[^>]*>\s*<p role="cell"/.test(contabilita), true)
ok('«Mostra altre» sta in una riga', /role="row"[\s\S]{0,200}<div role="cell">\s*<button[\s\S]{0,150}Mostra altre/.test(mezzo), true)

// Una pagina senza <h1> (Lighthouse/axe: page-has-heading-one): la testata e il menu di queste quattro pagine
// non hanno altri titoli, il luogo («CORSI», «CONTABILITÀ», «ISTRUTTORI») diventa l'h1. Le altre pagine ne hanno già uno.
ok('la testata fa del luogo un h1 solo se glielo si chiede', /\{h1 \? <h1 className="testata-luogo">[^]*?<span className="testata-luogo">/.test(app), true)
for (const luogo of ['CORSI', 'CONTABILITÀ'])
  ok(`la pagina «${luogo}» ha l'h1`, new RegExp(`<Testata luogo="${luogo}"[^>]*\\bh1\\b`).test(app), true)
ok('le due testate di «ISTRUTTORI» (telefono) hanno l\'h1', (app.match(/<Testata luogo="ISTRUTTORI"[^>]*\bh1\b/g) ?? []).length, 2)
ok('il menu di «ISTRUTTORI» (schermo largo) ha l\'h1', /<h1[^>]*>ISTRUTTORI<\/h1>/.test(app), true)

process.exit(fallite ? 1 : 0)
