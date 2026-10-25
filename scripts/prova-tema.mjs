// ---------------------------------------------------------------------------
// UN SOLO TEMA: IL SITO, senza browser.
//
//   node scripts/prova-tema.mjs
//
// Non ci sono più il nero, il bianco e il Tatami, né il tasto che li cambia, né
// la scelta salvata: l'app e il timer hanno sempre l'aspetto del sito della
// palestra. La prova controlla che il meccanismo dei temi non torni e che
// `<html>` nasca già con l'aspetto giusto, senza lampeggiare.
// ---------------------------------------------------------------------------
import { existsSync, readFileSync, readdirSync } from 'node:fs'

let guai = 0
const ok = (cosa, avuto, voluto) => {
  const va = JSON.stringify(avuto) === JSON.stringify(voluto)
  console.log(va ? '  ✓' : '  ✗', cosa, va ? '' : `— atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`)
  if (!va) guai++
}
const leggi = (f) => readFileSync(f, 'utf8')

const FONDO_SITO = '#eef5fa'

console.log('\nIl meccanismo dei temi non c\'è più')
for (const f of ['src/lib/tema.ts', 'timer/src/lib/tema.ts', 'src/components/TastoTema.tsx', 'src/lib/aspettoSegreteria.ts', 'scripts/congelati']) {
  ok(`${f} non esiste`, existsSync(f), false)
}

console.log('\n<html> nasce già con l\'aspetto del sito')
const app = leggi('index.html')
const timer = leggi('timer/index.html')
ok('app: <html data-look="sito">', /<html[^>]*\bdata-look="sito"/.test(app), true)
ok('timer: <html data-tema="sito">', /<html[^>]*\bdata-tema="sito"/.test(timer), true)
for (const [nome, h] of [['app', app], ['timer', timer]]) {
  ok(`${nome}: la barra del browser è il fondo del sito (${FONDO_SITO})`, /<meta name="theme-color" content="#eef5fa"/.test(h), true)
}

console.log('\nIl CSS non ha altri temi')
const cssApp = leggi('src/styles.css')
const cssTimer = leggi('timer/src/styles.css')
for (const [nome, css] of [['src/styles.css', cssApp], ['timer/src/styles.css', cssTimer]]) {
  ok(`${nome}: nessun data-tema chiaro o tatami`, /data-tema=['"]?(chiaro|tatami|scuro)/.test(css), false)
  ok(`${nome}: nessun color-scheme: dark`, /color-scheme:\s*dark/.test(css), false)
  ok(`${nome}: non segue il tema del dispositivo`, /prefers-color-scheme/.test(css), false)
}
ok('src/styles.css: nessuna regola per .tasto-tema', /tasto-tema/.test(cssApp), false)

console.log('\nIl codice non conosce altri temi')
const sorgenti = (cartella) =>
  readdirSync(cartella, { recursive: true, withFileTypes: true })
    .filter((d) => d.isFile() && /\.(ts|tsx)$/.test(d.name))
    .map((d) => `${d.parentPath}/${d.name}`)
const ELENCO = [...sorgenti('src'), ...sorgenti('timer/src')]
const COLPE = /\b(useTema|scegliTema|prossimoTema|avviaTema|riapplicaTema|leggiTema|TastoTema|lookDellArea|applicaLook|COLORE_BARRA|senzaTema)\b|ods-tema|data-tema=['"]?(chiaro|tatami|scuro)|'(scuro|chiaro|tatami)'/
ok('nessun file di src/ o timer/src/ nomina i vecchi temi', ELENCO.filter((f) => COLPE.test(leggi(f))), [])

console.log(guai ? `\n${guai} cose da sistemare` : '\nTutto in regola')
process.exit(guai ? 1 : 0)
