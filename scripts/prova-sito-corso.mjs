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
const DATI = '<ul><li><strong>Per chi</strong> Dai 7 anni</li><li><strong>Quando</strong> Lun, mer e ven</li><li><strong>Dove</strong> Via Vittorio Sassi 26</li><li><strong>Per iniziare</strong> 1 settimana a 5 euro</li></ul>'
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
  ok('un corso senza pulsante verso il modulo ha il <main class="corso"> di sempre', classi(pagina(TESTA + '<h2>Storia</h2><h3>1882</h3><p>Kano.</p>')).trim(), 'class="corso"')
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
  ok('nel menu «I nostri corsi» è la pagina corrente', /<a href="\/corsi\/" aria-current="page">I nostri corsi<\/a>/.test(h) && !/<a href="\/"[^>]*aria-current/.test(h), true)
  const CSS = [...h.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('').replace(/\/\*[\s\S]*?\*\//g, '')
  const regole = [...CSS.matchAll(/([^{}@]+)\{([^{}]*)\}/g)].map((m) => ({ s: m[1].trim(), d: m[2] }))
  const dec = (sel, prop, n = 0) => regole.filter((r) => r.s.split(',').includes(sel)).map((r) => (r.d.match(new RegExp(`(?:^|;)${prop}:([^;]*)`)) || [])[1]).filter(Boolean)[n]
  const px = (v) => Math.max(...[...(v ?? '').matchAll(/(\d+(?:\.\d+)?)px/g)].map((m) => Number(m[1])))
  ok('testata: padding 22px, logo alto 110px', [dec('.pagina-corso .testata', 'padding'), px(dec('.pagina-corso .logo img', 'height'))], ['22px var(--margine)', 110])
  ok('menu: voci a 4px una dall’altra sul computer (più 16px di imbottitura), la corrente gialla', [dec('.testata nav ul', 'gap', 1), dec('.testata nav a[aria-current]', 'background')], ['4px', 'var(--giallo)'])
  ok('menu: voci alte 48px, con 16px di imbottitura anche sul computer', [dec('.testata nav a', 'min-height'), dec('.testata nav a', 'padding', 1)], ['48px', '0 16px'])
  ok('pulsanti in testata: padding 0 24px', dec('.testata .pulsante', 'padding'), '0 24px')
  ok('invito: alto 300px, padding 36px 40px, margini 96px e 6px', [px(dec('.pagina-corso .invito', 'min-height')), dec('.pagina-corso .invito', 'padding'), dec('.pagina-corso .invito', 'margin')], [300, '36px 40px', '96px var(--margine) 6px'])
  ok('invito: frase a 22px, «Prova» a 170px, senza freccia', [px(dec('.pagina-corso .invito .frase', 'font-size')), px(dec('.pagina-corso .invito .parola', 'font-size')), dec('.pagina-corso .invito .freccia', 'display')], [22, 170, 'none'])
  ok('piede: margini 0 e 48px, nome a 56px', [dec('.pagina-corso .piede', 'margin'), px(dec('.pagina-corso .piede .nome', 'font-size'))], ['0 var(--margine) 48px', 56])
  ok('piede: padding 40px, colonne senza riquadro (i recapiti prima delle altre)', [dec('.pagina-corso .piede', 'padding'), dec('.pagina-corso .piede .colonne', 'display')], ['40px', 'contents'])
  ok('telefono: logo 82px, menu aperto su fondo pieno con voci da 48px', [px(dec('.pagina-corso .logo img', 'height', 1)), dec('#menu:target', 'background'), dec('.testata nav a', 'min-height', 1)], [82, 'var(--fondo)', '48px'])
  ok('telefono: invito alto 260px, «Prova» a 120px; piede con nome a 44px e padding 24px', [px(dec('.pagina-corso .invito', 'min-height', 1)), px(dec('.pagina-corso .invito .parola', 'font-size', 1)), px(dec('.pagina-corso .piede .nome', 'font-size', 1)), dec('.pagina-corso .piede', 'padding', 1)], [260, 120, 44, '24px'])
}

console.log('\n8. Le differenze che restavano')
{
  const h = pagina(TESTA)
  // 8.1 foto: dove si taglia
  const CSS = [...h.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('').replace(/\/\*[\s\S]*?\*\//g, '')
  const regole = [...CSS.matchAll(/([^{}@]+)\{([^{}]*)\}/g)].map((m) => ({ s: m[1].trim(), d: m[2] }))
  const dec = (sel, prop, n = 0) => regole.filter((r) => r.s.split(',').includes(sel)).map((r) => (r.d.match(new RegExp(`(?:^|;)${prop}:([^;]*)`)) || [])[1]).filter(Boolean)[n]
  ok('foto di testata tagliata al 58%, fila: prima al 30%, le altre al 55%', [dec('.corso .corso-testata .foto img', 'object-position'), dec('.corso .foto-fila img', 'object-position'), dec('.corso .foto-fila figure:first-child img', 'object-position')], ['50% 58%', '50% 55%', '50% 30%'])
  // 8.2 un h2 vuoto apre una sezione senza titolo (la fila di foto)
  const f = main(pagina(TESTA + '<h2></h2><img src="/a.png" alt="a"><img src="/b.png" alt="b"><img src="/c.png" alt="c"><h2>Dopo</h2><h3>X</h3><p>y</p>'))
  ok('h2 vuoto: la sezione ha la fila di foto e nessun h2 vuoto', [/<section class="sezione"><div class="foto-fila">/.test(f), /<h2><\/h2>/.test(f), conta(f, /<h2/g)], [true, false, 1])
  ok('anche con un a capo dentro: nessun h2 vuoto', conta(main(pagina('<h2><br></h2><p>x</p><h2>S</h2><p>y</p>')), /<h2/g), 1)
  // 8.3 colori: con testo il quarto è azzurro, senza testo torna giallo
  const sez = (t) => colori(main(pagina(TESTA + '<h2>S</h2>' + t)).split('<h2>S</h2>')[1])
  ok('quattro tessere con testo: giallo, blu, inchiostro, azzurro', sez('<h3>a</h3><p>1</p><h3>b</h3><p>2</p><h3>c</h3><p>3</p><h3>d</h3><p>4</p>'), ['giallo', 'blu', 'inchiostro', 'chiara'])
  ok('quattro tessere senza testo: giallo, blu, inchiostro, giallo', sez('<h3>a</h3><h3>b</h3><h3>c</h3><h3>d</h3>'), ['giallo', 'blu', 'inchiostro', 'giallo'])
  // 8.4 titoli lunghi
  ok('un titolo oltre 30 caratteri ha la classe «lungo», uno corto no', [/<h2 class="lungo">Cosa può aspettarsi un genitore o un atleta<\/h2>/.test(main(pagina(TESTA + '<h2>Cosa può aspettarsi un genitore o un atleta</h2><h3>a</h3>'))), /<h2 class="lungo"/.test(main(pagina(TESTA + '<h2>Orario delle lezioni</h2><h3>a</h3>')))], [true, false])
  ok('titolo lungo: 22px sotto sul computer, 48px sul telefono', [dec('.corso .sezione h2.lungo', 'margin-bottom'), dec('.corso .sezione h2.lungo', 'font-size')], ['22px', '48px'])
  // 8.5 telefono: terza tessera di presentazione, menu
  ok('telefono: la terza tessera di presentazione è alta 180px, il menu a 17px', [dec('.corso .corso-testata .n-3 .tessera:last-child', 'min-height'), dec('.testata nav a', 'font-size')], ['180px', '17px'])
  // 8.6 piede: recapiti, menu, link legali
  const pie = (h2) => h2.match(/<footer class="piede">[\s\S]*<\/footer>/)?.[0] ?? ''
  const dati2 = (testo) => g.generaSito({ dominio: 'https://officinedellosport.it', pagine: [{ slug: 'judo', titolo: 'Judo', descrizione: 'd', testo }, { slug: 'contatti', titolo: 'C', descrizione: '', testo: '<p>c</p>' }, { slug: 'privacy', titolo: 'Privacy', descrizione: '', testo: '<p>p</p>', diLegge: true }], menu: [{ dove: 'menu', ordine: 1, etichetta: 'Home', slug: null, indirizzo: '/' }, { dove: 'footer', ordine: 1, etichetta: 'Privacy policy', slug: 'privacy', indirizzo: null }], rinvii: [] })['judo/index.html']
  const p1 = pie(dati2(TESTA))
  ok('fuori dai corsi il piede resta com’era', /class="menu"|class="recapiti"/.test(pie(pagina('<p>x</p>'))), false)
  ok('telefono: menu e link legali su una riga con «·»; i legali più tenui', [dec('.pagina-corso .piede .menu li', 'display'), dec('.pagina-corso .piede .legali', 'opacity')], ['inline', '.85'])
}

console.log(guai ? `\n✗ ${guai} casi falliti` : '\nTutto a posto.')
process.exit(guai ? 1 : 0)
