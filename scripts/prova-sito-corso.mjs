// ---------------------------------------------------------------------------
// La pagina di un corso come nel design «tatami blu e giallo», senza browser.
//
//   node scripts/prova-sito-corso.mjs
//
// Regole in docs/sito/corso.md. Una pagina che nel testo prima del primo `h2`
// ha una foto, un elenco di dati (grassetto + testo) e poi dei `h3` è la pagina
// di un corso: `<main class="corso">`, foto grande, dati a quattro colonne,
// tessere di presentazione. Il resto della pagina cambia solo dentro `main.corso`.
// ---------------------------------------------------------------------------
import { build } from 'esbuild'

const { outputFiles } = await build({
  entryPoints: ['src/lib/sitoGenera.ts'],
  bundle: true,
  format: 'esm',
  platform: 'node',
  write: false,
  logLevel: 'silent',
  define: { 'import.meta.env': '{}' },
  banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(process.cwd() + '/');" },
})
const g = await import('data:text/javascript;base64,' + Buffer.from(outputFiles[0].text).toString('base64'))

let guai = 0
const ok = (cosa, avuto, voluto) => {
  const va = JSON.stringify(avuto) === JSON.stringify(voluto)
  console.log(va ? '  ✓' : '  ✗', cosa, va ? '' : `— atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`)
  if (!va) guai++
}
const conta = (x, re) => (x.match(re) || []).length
const pagina = (testo, slug = 'judo') => g.generaSito({ dominio: 'https://officinedellosport.it', pagine: [{ slug, titolo: 'Judo', descrizione: 'd', testo }, { slug: 'corsi', titolo: 'Corsi', descrizione: '', testo: '<p>c</p>' }, { slug: 'contatti', titolo: 'Contatti', descrizione: '', testo: '<p>c</p>' }], menu: [{ dove: 'menu', ordine: 1, etichetta: 'Home', slug: 'home', indirizzo: null }, { dove: 'menu', ordine: 2, etichetta: 'I nostri corsi', slug: 'corsi', indirizzo: null }], rinvii: [] })[slug === 'home' ? 'index.html' : `${slug}/index.html`] ?? ''
const main = (h) => h.match(/<main[^>]*>([\s\S]*)<\/main>/)?.[1] ?? ''
const classi = (h) => h.match(/<main([^>]*)>/)?.[1] ?? ''
const colori = (h) => [...h.matchAll(/<article class="tessera (\w+)/g)].map((m) => m[1])

const IMG = '<img src="/foto/a.png" alt="Lezione">'
const DATI = '<ul><li><strong>Per chi</strong> Dai 7 anni</li><li><strong>Quando</strong> Lun, mer e ven</li><li><strong>Dove</strong> Via Sassi 26</li><li><strong>Per iniziare</strong> 1 settimana a 5 euro</li></ul>'
const PRES = '<h3>Cos’è il corso</h3><p>Un percorso.</p><h3>Cosa si fa</h3><p>Si lavora.</p><h3>Per chi è pensato</h3><p>Per tutti.</p>'
const TESTA = IMG + DATI + PRES

console.log('\n1. La testata del corso: foto, dati, presentazione')
{
  const h = pagina(TESTA + '<h2>Storia</h2><h3>1882</h3><p>Kano.</p>')
  ok('main ha la classe «corso»', /class="corso"/.test(classi(h)), true)
  const m = main(h)
  ok('la foto grande è la prima tessera, a tutta larghezza', /<section class="corso-testata"><div class="tessere n-1"><figure class="tessera foto larga">/.test(m), true)
  ok('i dati sono 4 tessere con titolo e testo, giallo-blu-inchiostro-giallo', colori((m.match(/<div class="tessere n-4 dati">[\s\S]*?<\/div>/) || [''])[0]), ['giallo', 'blu', 'inchiostro', 'giallo'])
  ok('la presentazione: 3 tessere giallo-blu-inchiostro', colori((m.match(/<div class="tessere n-3">[\s\S]*?<\/div>/) || [''])[0]), ['giallo', 'blu', 'inchiostro'])
  ok('le sezioni dopo la testata ripartono dal giallo', colori(m.split('</section>').slice(2).join('')), ['giallo'])
  ok('il titolo della pagina non si ripete nella testata (la foto non è nel testo)', conta(m, /<img /g), 1)
  ok('senza h2 dopo la testata: nessun errore e nessuna sezione in più', conta(main(pagina(TESTA)), /<section/g), 2)
}

console.log('\n2. Senza la testata intera la pagina resta com’era')
{
  ok('solo foto e paragrafo: niente classe corso', /corso/.test(classi(pagina(IMG + '<p>x</p><h2>S</h2><p>y</p>'))), false)
  ok('foto e dati ma senza h3: niente classe corso', /corso/.test(classi(pagina(IMG + DATI + '<h2>S</h2><p>y</p>'))), false)
  ok('la Home non è mai un corso', /corso/.test(classi(pagina(TESTA, 'home'))), false)
}

console.log('\n3. L’orario: ora in alto a destra, giorni ed età sotto')
{
  const o = (...t) => main(pagina(TESTA + '<h2>Orario</h2>' + t.join('')))
  const t1 = '<h3>Judo 2</h3><p><strong>17:00 – 18:00</strong></p><p>lun · mer · ven</p><p>7-9 anni</p>'
  const t2 = '<h3>Judo agonisti</h3><p><strong>18:00 – 19:30</strong></p><p>mar · gio</p>'
  const h = o(t1, t2)
  ok('la tessera orario ha titolo, ora e i dettagli', /<article class="tessera chiara orario"><h3>Judo 2<\/h3><p class="ora"><strong>17:00 – 18:00<\/strong><\/p><div class="dettagli"><p>lun · mer · ven<\/p><p>7-9 anni<\/p><\/div><\/article>/.test(h), true)
  ok('l’ultima è gialla (chiude la lista)', colori(h.split('Orario')[1]), ['chiara', 'giallo'])
  ok('senza dettagli: solo titolo e ora', /<article class="tessera chiara orario"><h3>X<\/h3><p class="ora"><strong>9:00<\/strong><\/p><\/article>|<article class="tessera giallo orario"><h3>X<\/h3><p class="ora"><strong>9:00<\/strong><\/p><\/article>/.test(o('<h3>X</h3><p><strong>9:00</strong></p>')), true)
  ok('una tessera con un grassetto in mezzo al testo non è un orario', /orario/.test(o('<h3>X</h3><p>Dalle <strong>9</strong> alle 10</p>')), false)
}

console.log('\n4. La banda «perché sceglierlo»')
{
  const m = main(pagina(TESTA + '<h2>Perché sceglierlo</h2><p>Per imparare rispetto.</p>'))
  ok('una sezione con un solo paragrafo breve è una banda blu', /<section class="sezione banda"><div class="banda-int"><h2>Perché sceglierlo<\/h2><p>Per imparare rispetto\.<\/p><\/div><\/section>/.test(m), true)
  ok('due paragrafi: sezione normale', /banda/.test(main(pagina(TESTA + '<h2>S</h2><p>Uno.</p><p>Due.</p>'))), false)
  ok('un paragrafo lungo (oltre 160 caratteri): sezione normale', /banda/.test(main(pagina(TESTA + `<h2>S</h2><p>${'a'.repeat(170)}</p>`))), false)
  ok('fuori da un corso un paragrafo solo resta una sezione normale', /banda/.test(main(pagina('<h2>S</h2><p>Uno.</p>'))), false)
}

console.log('\n5. Il CSS solo nelle pagine di un corso')
{
  const stili = (h) => conta(h, /<style>/g)
  ok('una pagina di corso ha due <style>, le altre uno', [stili(pagina(TESTA)), stili(pagina('<p>x</p>')), stili(pagina(TESTA, 'home'))], [2, 1, 1])
}

console.log('\n6. Il CSS: misure del design a 1440px e a telefono')
{
  const CSS = [...pagina(TESTA).matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('')
  const regole = [...CSS.matchAll(/([^{}@]+)\{([^{}]*)\}/g)].map((m) => ({ s: m[1].trim(), d: m[2] }))
  const dec = (sel, prop) => regole.filter((r) => r.s.split(',').includes(sel)).map((r) => (r.d.match(new RegExp(`(?:^|;)${prop}:([^;]*)`)) || [])[1]).filter(Boolean)
  const tetto = (v) => Math.max(...[...(v ?? '').matchAll(/(\d+(?:\.\d+)?)px/g)].map((m) => Number(m[1])))
  ok('titolo del corso a 200px', tetto(dec('.corso .pagina-hero h1', 'font-size')[0]), 200)
  ok('foto di testata alta 620px', tetto(dec('.corso .corso-testata .foto img', 'height')[0]), 620)
  ok('dati: titolo a 52px', tetto(dec('.corso .dati h3', 'font-size')[0]), 52)
  ok('titoli delle sezioni con testo a 64px', tetto(dec('.corso .sezione .tessera:not(.orario) h3', 'font-size')[0]), 64)
  ok('titoli degli orari a 46px', tetto(dec('.corso .orario h3', 'font-size')[0]), 46)
  ok('titoli senza testo a 54px', tetto(dec('.corso .sezione .tessera:has(>h3:only-child) h3', 'font-size')[0]), 54)
  ok('foto di fila alte 516px', tetto(dec('.corso .foto-fila img', 'height')[0]), 516)
  ok('banda: titolo a 120px', tetto(dec('.corso .banda-int h2', 'font-size')[0]), 120)
}

console.log('\n7. Testata, invito e piede come nel design (solo pagine di corso)')
{
  const h = pagina(TESTA)
  const altra = pagina('<p>x</p>')
  ok('il body ha la classe «pagina-corso» solo nel corso', [/<body class="pagina-corso">/.test(h), /pagina-corso/.test(altra)], [true, false])
  ok('il pulsante in testata ha la scritta lunga e quella corta (telefono)', /class="pulsante piccolo" href="\/contatti\/"><span class="lungo">Prova una settimana · 5 €<\/span><span class="corto">Prova<\/span><\/a>/.test(h), true)
  ok('nel menu «I nostri corsi» è la pagina corrente', /<a href="\/corsi\/" aria-current="page">I nostri corsi<\/a>/.test(h) && !/<a href="\/"[^>]*aria-current/.test(h), true)
  ok('fuori dai corsi il pulsante e il menu restano come prima', [/class="lungo"/.test(altra), /aria-current/.test(altra)], [false, false])
  const CSS = [...h.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('').replace(/\/\*[\s\S]*?\*\//g, '')
  const regole = [...CSS.matchAll(/([^{}@]+)\{([^{}]*)\}/g)].map((m) => ({ s: m[1].trim(), d: m[2] }))
  const dec = (sel, prop, n = 0) => regole.filter((r) => r.s.split(',').includes(sel)).map((r) => (r.d.match(new RegExp(`(?:^|;)${prop}:([^;]*)`)) || [])[1]).filter(Boolean)[n]
  const px = (v) => Math.max(...[...(v ?? '').matchAll(/(\d+(?:\.\d+)?)px/g)].map((m) => Number(m[1])))
  ok('testata: padding 22px, logo alto 110px', [dec('.pagina-corso .testata', 'padding'), px(dec('.pagina-corso .logo img', 'height'))], ['22px var(--margine)', 110])
  ok('menu: voci a 10px una dall’altra, la corrente gialla', [dec('.pagina-corso .testata nav ul', 'gap'), dec('.pagina-corso .testata nav [aria-current]', 'background')], ['10px', 'var(--giallo)'])
  ok('menu: voci alte come nel design (padding 9px 16px, interlinea 1.2)', [dec('.pagina-corso .testata nav a', 'padding'), dec('.pagina-corso .testata nav a', 'line-height')], ['9px 16px', '1.2'])
  ok('pulsante in testata: padding 0 26px', dec('.pagina-corso .testata .pulsante', 'padding'), '0 26px')
  ok('invito: alto 300px, padding 36px 40px, margini 96px e 6px', [px(dec('.pagina-corso .invito', 'min-height')), dec('.pagina-corso .invito', 'padding'), dec('.pagina-corso .invito', 'margin')], [300, '36px 40px', '96px var(--margine) 6px'])
  ok('invito: frase a 22px, «Prova» a 170px, senza freccia', [px(dec('.pagina-corso .invito .frase', 'font-size')), px(dec('.pagina-corso .invito .parola', 'font-size')), dec('.pagina-corso .invito .freccia', 'display')], [22, 170, 'none'])
  ok('piede: margini 0 e 48px, nome a 56px, senza titoli né riga finale', [dec('.pagina-corso .piede', 'margin'), px(dec('.pagina-corso .piede .nome', 'font-size')), dec('.pagina-corso .piede h2', 'display'), dec('.pagina-corso .piede .fine', 'display')], ['0 var(--margine) 48px', 56, 'none', 'none'])
  ok('piede: padding 40px, colonne senza riquadro (i recapiti prima delle altre)', [dec('.pagina-corso .piede', 'padding'), dec('.pagina-corso .piede .colonne', 'display')], ['40px', 'contents'])
  ok('telefono: logo 82px, menu a pillole chiare da 44px', [px(dec('.pagina-corso .logo img', 'height', 1)), dec('.pagina-corso .testata nav a', 'background')], [82, 'var(--chiara)'])
  ok('telefono: invito alto 260px, «Prova» a 120px; piede con nome a 44px e padding 24px', [px(dec('.pagina-corso .invito', 'min-height', 1)), px(dec('.pagina-corso .invito .parola', 'font-size', 1)), px(dec('.pagina-corso .piede .nome', 'font-size', 1)), dec('.pagina-corso .piede', 'padding', 1)], [260, 120, 44, '24px'])
}

console.log(guai ? `\n✗ ${guai} casi falliti` : '\nTutto a posto.')
process.exit(guai ? 1 : 0)
