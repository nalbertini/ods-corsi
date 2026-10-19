// ---------------------------------------------------------------------------
// La pagina degli istruttori come nel design «tatami blu e giallo», senza browser.
//
//   node scripts/prova-sito-istruttori.mjs
//
// Da `generaSito` (src/lib/sitoGenera.ts), regola in docs/sito/istruttori.md:
//
//  1. Un testo senza `h2` che comincia con un `h3` è una griglia di ritratti:
//     ogni `h3` (il nome) con la foto, se c'è, e il paragrafo che lo segue (il ruolo).
//     Quel che viene dopo l'ultimo ritratto resta testo, sotto la griglia.
//  2. L'ordine è fisso per i primi otto (Maurizio, Maura, Diana, Fabio, Tiziano, Valerio, Manuel, Federico), poi gli altri
//     come scritti. I colori vanno a diagonali: nessun vicino, in riga o in colonna, ha lo stesso colore.
//  3. Senza foto il cerchio porta l’iniziale; col link nel nome la tessera è tutta cliccabile.
//  4. La testata delle pagine senza collage: titolo a sinistra, descrizione e pulsante a destra.
//  5. Le misure del design, a 1440px e a telefono, lette dal CSS.
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
const P = 'https://abc.supabase.co/storage/v1/object/public/sito/'
const pagineDi = (testo, slug, extra) => [{ slug, titolo: slug === 'fabio-berta' ? 'Fabio Berta' : 'Gli istruttori', descrizione: 'd', testo }, { slug: 'contatti', titolo: 'C', descrizione: '', testo: '' }, ...extra.map((s) => ({ slug: s, titolo: s, descrizione: '', testo: '' }))]
const pagina = (testo, slug = 'istruttori', extra = [], contatti = true) => g.generaSito({ dominio: 'https://officinedellosport.it', pagine: pagineDi(testo, slug, extra).filter((p) => contatti || p.slug !== 'contatti'), menu: [], rinvii: [], ospitiImmagini: [P] })[slug === 'home' ? 'index.html' : `${slug}/index.html`] ?? ''
const main = (h) => h.match(/<main[^>]*>([\s\S]*)<\/main>/)?.[1] ?? ''
const conta = (x, re) => (x.match(re) || []).length
const CSS = pagina('<p>x</p>').match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? ''
const regola = (re) => [...CSS.matchAll(/([^{}]+)\{([^{}]*)\}/g)].find((m) => re.test(m[1]))
const dentro = (re) => regola(re)?.[2] ?? ''
const px = (re, prop) => parseFloat((dentro(re).match(new RegExp(`(?:^|;)${prop}:\\s*([\\d.]+)px`)) || [, 'NaN'])[1])
// Dopo «@media (max-width:900px){» le regole del telefono.
const TELEFONO = CSS.slice(CSS.indexOf('@media (max-width:900px)'))
const telefono = (re, prop) => parseFloat((TELEFONO.match(new RegExp(`${re}\\{(?:[^}]*;)?${prop}:\\s*([\\d.]+)px`)) || [, 'NaN'])[1])

const R = (n, r, foto = '') => `<h3>${n}</h3>${foto}<p>${r}</p>`
const FOTO = `<img src="${P}m.jpg" alt="Maurizio">`
const NOMI = ['Maurizio', 'Diana', 'Katia', 'Serena', 'Tiziano', 'Fabio', 'Valerio', 'Giulia', 'Maura', 'Elena', 'Aldo', 'Manuel', 'Federico']
const unElenco = (n) => NOMI.slice(0, n).map((x, i) => R(x, `Cognome${i} · Judo, Pesi`, i === 0 ? FOTO : '')).join('')
const tredici = unElenco(13)
const dodici = unElenco(12)
const CHIUSURA = '<p>Ogni istruttore ha la sua pagina.</p>'
const tessere = (h) => [...main(h).matchAll(/<article class="tessera ritratto ([a-z]+)">([\s\S]*?)<\/article>/g)].map((m) => ({ colore: m[1], html: m[2] }))
const invitoTessera = (h) => main(h).match(/<div class="tessera ritratto-invito[^"]*">[\s\S]*?<\/div>\s*<\/div>|<div class="tessera ritratto-invito[^"]*">[\s\S]*?<\/div>/)?.[0] ?? ''

console.log('\n1. Un testo che comincia con un h3 è l’elenco dei tecnici')
{
  const h = pagina(`${tredici}${CHIUSURA}`)
  const r = tessere(h)
  ok('13 tessere in una sola griglia «ritratti»', [conta(main(h), /<div class="ritratti">/g), r.length], [1, 13])
  ok('con la foto: la foto è quadrata in cima, dentro «ritratto-foto»', /^<span class="ritratto-foto"><img [^>]*alt="Maurizio"[^>]*><\/span>/.test(r[0].html), true)
  ok('nome e cognome sono nel titolo, il cognome in un suo span', /<h3><span class="nome">Maurizio<\/span> <span class="cognome">Cognome0<\/span><\/h3>/.test(r[0].html), true)
  ok('i corsi sono pastiglie, una per corso, nell’ordine scritto, senza la frase', [conta(r[0].html, /<span class="pillola">/g), /<span class="pillola">Judo<\/span><span class="pillola">Pesi<\/span>/.test(r[0].html), /·/.test(r[0].html)], [2, true, false])
  ok('senza foto: fascia con l’iniziale, che non si legge', r[1].html.startsWith('<span class="ritratto-foto" aria-hidden="true">M</span>'), true)
  ok('il paragrafo dopo l’ultimo tecnico è testo sotto la griglia, non un tecnico', [/<\/section><div class="testo"><p>Ogni istruttore ha la sua pagina\.<\/p><\/div>/.test(main(h)), conta(r[12].html, /Ogni istruttore/g)], [true, 0])
  ok('senza paragrafo di chiusura, niente testo', /<div class="testo">/.test(main(pagina(tredici))), false)
  ok('un nome senza cognome: solo il nome, nessun «·» e nessuno span vuoto', (() => { const t = tessere(pagina('<h3>A</h3><h3>B</h3><p>Rossi · Judo</p>')); return [/class="cognome"/.test(t[0].html), /class="cognome"/.test(t[1].html)] })(), [false, true])
  ok('un nome con la riga senza «·»: nessun cognome, e sono corsi', (() => { const t = tessere(pagina('<h3>A</h3><p>Judo, Pesi</p><h3>B</h3><p>Rossi</p>')); return [conta(t[0].html, /pillola">/g), /<span class="cognome">Rossi/.test(t[1].html), conta(t[1].html, /pillola">/g)] })(), [2, true, 0])
  ok('cognome doppio e corsi senza spazi', (() => { const t = tessere(pagina('<h3>A</h3><p>De Luca · Judo,Pesi</p><h3>B</h3><p>x</p>')); return [/<span class="cognome">De Luca<\/span>/.test(t[0].html), conta(t[0].html, /pillola">/g)] })(), [true, 2])
  ok('la foto senza «alt»: lo scrive il sito, «Ritratto di Nome Cognome»', /<img [^>]*alt="Ritratto di Diana Cognome1"/.test(main(pagina(`<h3>Diana</h3><img src="${P}d.jpg"><p>Cognome1 · Judo</p><h3>B</h3><p>x</p>`))), true)
  ok('la foto con «alt» scritto dalla segreteria lo tiene', /alt="Diana in tuta"/.test(main(pagina(`<h3>Diana</h3><img src="${P}d.jpg" alt="Diana in tuta"><p>Cognome1 · Judo</p><h3>B</h3><p>x</p>`))), true)
}

console.log('\n2. L’ordine è fisso e i colori vanno a diagonali')
{
  const nomi = (h) => tessere(h).map((x) => x.html.match(/class="nome">([^<]*)</)?.[1])
  ok('prima gli otto in ordine, poi gli altri come scritti', nomi(pagina(tredici)), ['Maurizio', 'Maura', 'Diana', 'Fabio', 'Tiziano', 'Valerio', 'Manuel', 'Federico', 'Katia', 'Serena', 'Giulia', 'Elena', 'Aldo'])
  ok('maiuscole e link nel nome non contano', nomi(pagina('<h3>x</h3><h3>MAURA</h3><h3><a href="/m/">maurizio</a></h3>')), ['maurizio', 'MAURA', 'x'])
  const colori = tessere(pagina(tredici)).map((x) => x.colore)
  ok('colori a diagonali (riga + colonna) su quattro colonne', colori, ['giallo', 'blu', 'inchiostro', 'giallo', 'blu', 'inchiostro', 'giallo', 'blu', 'inchiostro', 'giallo', 'blu', 'inchiostro', 'giallo'])
  ok('nessun vicino in riga o in colonna ha lo stesso colore', colori.every((c, i) => (i % 4 === 3 || c !== colori[i + 1]) && (i + 4 >= colori.length || c !== colori[i + 4])), true)
}

console.log('\n3. Il nome è un link solo se la scheda è pubblicata')
{
  const MAURIZIO = `<h3><a href="/maurizio-innella/">Maurizio</a></h3>${FOTO}<p>Innella · Judo</p><h3>Diana</h3><p>Ballabio · MGA</p>`
  const con = tessere(pagina(MAURIZIO, 'istruttori', ['maurizio-innella']))
  ok('pagina pubblicata: il link resta, piatto, intorno a nome e cognome', /<h3><a href="\/maurizio-innella\/"><span class="nome">Maurizio<\/span> <span class="cognome">Innella<\/span><\/a><\/h3>/.test(con[0].html), true)
  const senza = tessere(pagina(MAURIZIO))
  ok('pagina non pubblicata: nome semplice, niente link (sarebbe un 404)', [/<a /.test(senza[0].html), /<span class="nome">Maurizio<\/span>/.test(senza[0].html)], [false, true])
  ok('link a una pagina con «istruttori/» davanti: non esiste, niente link', /<a /.test(tessere(pagina(`<h3><a href="/istruttori/maurizio-innella/">Maurizio</a></h3><p>Innella · Judo</p><h3>D</h3><p>x</p>`, 'istruttori', ['maurizio-innella']))[0].html), false)
  ok('link esterno: niente link', /<a /.test(tessere(pagina(`<h3><a href="https://esempio.it/">Maurizio</a></h3><p>Innella · Judo</p><h3>D</h3><p>x</p>`))[0].html), false)
  ok('l’iniziale viene dal nome, non dal tag', tessere(pagina(`<h3><a href="/diana/">Diana</a></h3><p>x</p><h3>B</h3><p>y</p>`, 'istruttori', ['diana']))[0].html.startsWith('<span class="ritratto-foto" aria-hidden="true">D</span>'), true)
  ok('la tessera col link è tutta cliccabile (il link si allarga con ::after)', /\.ritratto h3 a::after\{[^}]*position:\s*absolute[^}]*inset:\s*0/.test(CSS), true)
  ok('la freccia ↗ c’è solo se c’è il link (:has) e non si legge', /\.ritratto:has\(h3 a\)::after\{[^}]*content:\s*"↗︎"\s*\/\s*""/.test(CSS), true)
}

console.log('\n3b. La tessera «Vieni a conoscerli» completa la riga di quattro')
{
  const inv = (n) => invitoTessera(pagina(unElenco(n)))
  ok('con 13 tecnici c’è, larga 3 colonne, e sostituisce l’invito di fondo pagina', [/ritratto-invito s3/.test(inv(13)), conta(pagina(tredici), /<a class="invito"/g)], [true, 0])
  ok('con 14 tecnici è larga 2', /ritratto-invito s2/.test(invitoTessera(pagina(unElenco(13) + R('Z', 'x · Judo')))), true)
  ok('con 12 tecnici non c’è: la riga è piena, resta l’invito di fondo pagina', [inv(12), conta(pagina(dodici), /<a class="invito"/g)], ['', 1])
  const t = inv(13)
  ok('ha i due pulsanti: prova una settimana (modulo) e Scrivici (contatti)', [/<a class="pulsante primario" href="https:\/\/app\.officinedellosport\.it\/iscrizioni\/"[^>]*>Iscriviti<\/a>/.test(t), /<a class="pulsante secondario" href="\/contatti\/">Scrivici<\/a>/.test(t)], [true, true])
  ok('senza la pagina Contatti, niente «Scrivici»', /Scrivici/.test(invitoTessera(pagina(tredici, 'istruttori', [], false))), false)
  ok('non è un tecnico: non ha la classe «ritratto» delle tessere', tessere(pagina(tredici)).length, 13)
}

console.log('\n6. Le misure del design: computer (1440px)')
{
  const g4 = dentro(/^\s*\.ritratti\s*$/)
  ok('quattro colonne a filo (gap 6)', [/grid-template-columns:\s*repeat\(4,\s*1fr\)/.test(g4), px(/^\s*\.ritratti\s*$/, 'gap')], [true, 6])
  ok('ogni ritratto occupa una colonna', /\.ritratti article\{[^}]*grid-column:\s*auto/.test(CSS), true)
  const t = dentro(/^\s*\.ritratti-sezione \.ritratti article\.ritratto\s*$/)
  ok('tessera: tutte alte uguali (484px), foto in cima, nome e pastiglie sotto', [px(/^\s*\.ritratti-sezione \.ritratti article\.ritratto\s*$/, 'min-height'), /flex-direction:\s*column/.test(t)], [484, true])
  ok('l’altezza della tessera batte quella delle sezioni (3 classi e l’elemento)', /^\s*\.ritratti-sezione \.ritratti article\.ritratto\s*$/.test(regola(/article\.ritratto/)?.[1] ?? ''), true)
  const f = dentro(/^\s*\.ritratto-foto\s*$/)
  ok('la foto è quadrata a tutta larghezza, alta 300, non tonda', [px(/^\s*\.ritratto-foto\s*$/, 'height'), /width:\s*100%/.test(f), /border-radius:\s*50%/.test(f)], [300, true, false])
  ok('la foto riempie il riquadro, centrata un po’ sopra (50% 30%)', /\.ritratto-foto img\{[^}]*object-fit:\s*cover[^}]*object-position:\s*50% 30%/.test(CSS), true)
  ok('nome 48px con interlinea .95; cognome 20px', [px(/^\s*\.ritratto \.nome\s*$/, 'font-size'), /line-height:\s*\.95/.test(dentro(/^\s*\.ritratto \.nome\s*$/)), px(/^\s*\.ritratto \.cognome\s*$/, 'font-size')], [48, true, 20])
  ok('la freccia è un cerchio bianco da 48px, in alto a destra', [px(/^\s*\.ritratto:has\(h3 a\)::after\s*$/, 'top'), px(/^\s*\.ritratto:has\(h3 a\)::after\s*$/, 'right'), px(/^\s*\.ritratto:has\(h3 a\)::after\s*$/, 'width')], [12, 12, 48])
  ok('la pastiglia ha il bersaglio da 32px', px(/^\s*\.ritratto \.pillola\s*$/, 'min-height'), 32)
  ok('l’invito: sfondo inchiostro, titolo 96px', [/background:\s*var\(--inchiostro\)/.test(dentro(/^\s*\.ritratti \.ritratto-invito\s*$/)), px(/^\s*\.ritratto-invito \.parola\s*$/, 'font-size')], [true, 96])
  ok('il titolo della pagina è su una riga, 120px come Chi siamo e Corsi', px(/^\s*\.interna\.elenco-tecnici h1\s*$/, 'font-size') === 120, true)
}

console.log('\n7. Le misure del design: telefono')
{
  ok('una colonna', /\.ritratti\{[^}]*grid-template-columns:\s*1fr[;}]/.test(TELEFONO), true)
  ok('tessera: foto a sinistra da 112px, alta 136', [/\.ritratti-sezione \.ritratti article\.ritratto\{[^}]*flex-direction:\s*row/.test(TELEFONO), telefono('\\.ritratti-sezione \\.ritratti article\\.ritratto', 'min-height'), telefono('\\.ritratto-foto', 'width')], [true, 136, 112])
  ok('nome 34px, cognome 16px', [telefono('\\.ritratto \\.nome', 'font-size'), telefono('\\.ritratto \\.cognome', 'font-size')], [34, 16])
  ok('sul telefono non c’è la freccia, e l’invito non si allarga su più colonne', [/\.ritratto:has\(h3 a\)::after\{[^}]*display:\s*none/.test(TELEFONO), /\.ritratto-invito\{[^}]*grid-column:\s*auto/.test(TELEFONO)], [true, true])
}

console.log('\n10. La scheda scarna di un istruttore (nome, foto o iniziale, corsi, due pulsanti)')
{
  const FA = `<img src="${P}f.jpg" alt="Fabio ai tatami">`
  const scheda = (testo, extra = [], contatti = true, slug = 'fabio-berta') => pagina(testo, slug, extra, contatti)
  const h = scheda(`${FA}<ul><li><strong>Corsi</strong> Aikido</li></ul>`, ['istruttori'])
  const m = main(h)
  ok('il nome è il titolo grande, nome e cognome su due righe', /<h1><span>Fabio<\/span> <span>Berta<\/span><\/h1>/.test(m), true)
  ok('la foto c’è, col suo «alt»', /<div class="scheda-ritratto"><img [^>]*alt="Fabio ai tatami"/.test(m), true)
  ok('i corsi sono una tessera «Corsi» con il testo scritto', /<h2>Corsi<\/h2><p>Aikido<\/p>/.test(m), true)
  ok('due pulsanti: prova (modulo) e Scrivici (contatti)', [/<a class="pulsante primario" href="https:\/\/app\.officinedellosport\.it\/iscrizioni\/"[^>]*>Iscriviti<\/a>/.test(m), /<a class="pulsante secondario" href="\/contatti\/">Scrivici<\/a>/.test(m)], [true, true])
  ok('c’è l’invito di fondo pagina e nessuna tessera vuota', [conta(h, /<a class="invito"/g), /da scrivere|<article class="tessera[^"]*">\s*<\/article>/i.test(m)], [1, false])
  ok('il ritorno «Gli istruttori» c’è se la pagina esiste', /<a class="indietro" href="\/istruttori\/">/.test(m), true)
  ok('e non c’è se non esiste (sarebbe un 404)', /class="indietro"/.test(main(scheda(`${FA}<ul><li><strong>Corsi</strong> Aikido</li></ul>`))), false)
  ok('senza «Contatti» pubblicata non c’è «Scrivici»', /Scrivici/.test(main(scheda(`${FA}<ul><li><strong>Corsi</strong> Aikido</li></ul>`, [], false))), false)
  const s = main(scheda('<ul><li><strong>Corsi</strong> Aikido</li></ul>'))
  ok('senza foto: fascia con l’iniziale, che non si legge', /<div class="scheda-ritratto senza-foto"><span aria-hidden="true">F<\/span><\/div>/.test(s), true)
  ok('la foto senza «alt»: lo scrive il sito, «Ritratto di Fabio Berta»', /alt="Ritratto di Fabio Berta"/.test(main(scheda(`<img src="${P}f.jpg"><ul><li><strong>Corsi</strong> Aikido</li></ul>`))), true)
  ok('un titolo di una parola sola: una riga', /<h1><span>Fabio<\/span><\/h1>/.test(main(g.generaSito({ dominio: 'https://officinedellosport.it', pagine: [{ slug: 'fabio', titolo: 'Fabio', descrizione: '', testo: '<ul><li><strong>Corsi</strong> Aikido</li></ul>' }], menu: [], rinvii: [] })['fabio/index.html'])), true)
  ok('la voce del menu evidenziata è «Chi siamo», come per le altre schede', /aria-current="page"/.test(scheda('<ul><li><strong>Corsi</strong> Aikido</li></ul>')), false)
  ok('non è una scheda: un elenco senza «Corsi»', /<div class="scheda-ritratto/.test(scheda(`${FA}<ul><li><strong>Orari</strong> Lunedì</li></ul>`)), false)
  ok('non è una scheda: con un h2', /<div class="scheda-ritratto/.test(scheda(`${FA}<ul><li><strong>Corsi</strong> Aikido</li></ul><h2>Storia</h2><p>x</p>`)), false)
  ok('non è una scheda: la Home e Chi siamo', [/<div class="scheda-ritratto/.test(scheda('<ul><li><strong>Corsi</strong> Aikido</li></ul>', [], true, 'home')), /<div class="scheda-ritratto/.test(scheda('<ul><li><strong>Corsi</strong> Aikido</li></ul>', [], true, 'chi-siamo'))], [false, false])
  const completa = `<img src="${P}m.jpg" alt="Maurizio Innella — Maestro"><blockquote><p>Frase</p><p><em>Maurizio</em></p></blockquote><ul><li><strong>Ruolo</strong> Maestro</li><li><strong>Corsi</strong> Judo</li></ul><h2>Il percorso</h2><p>x</p>`
  ok('la scheda completa (foto, citazione) resta quella di sempre', [/<div class="scheda-ritratto/.test(scheda(completa)), /class="ritratto"><figure class="tessera foto"/.test(main(scheda(completa)))], [false, true])
}

console.log('\n4. Quel che non è una pagina di ritratti resta com’era')
{
  ok('un solo h3: nessuna griglia', conta(main(pagina(R('A', 'x'))), /ritratti/g), 0)
  ok('con un h2 prima: le tessere di sempre', conta(main(pagina(`<h2>S</h2>${R('A', 'x')}${R('B', 'y')}`)), /ritratti/g), 0)
  ok('con un h2 dopo: le tessere di sempre', conta(main(pagina(`${R('A', 'x')}${R('B', 'y')}<h2>S</h2><p>t</p>`)), /ritratti/g), 0)
  ok('un paragrafo prima del primo h3: resta una colonna', conta(main(pagina(`<p>Ciao</p>${R('A', 'x')}${R('B', 'y')}`)), /ritratti/g), 0)
  ok('la Home non cambia: il collage resta', conta(pagina(`<img src="${P}a.jpg" alt="a"><img src="${P}b.jpg" alt="b"><h2>S</h2><p>t</p>`, 'home'), /class="collage"/g), 1)
}

console.log('\n5. La testata senza collage: titolo a sinistra, descrizione e pulsante a destra')
{
  const h = pagina(tredici)
  ok('la testata ha la classe «solo»', /<section class="pagina-hero( interna)? solo( elenco-tecnici)?">/.test(h), true)
  ok('la Home col collage non la ha', /pagina-hero solo/.test(pagina(`<img src="${P}a.jpg" alt="a"><img src="${P}b.jpg" alt="b"><h2>S</h2><p>t</p>`, 'home')), false)
  ok('titolo e descrizione sono nello stesso blocco «intro», senza pulsante («Contattaci» sta in alto)', /<div class="intro"><h1>Gli istruttori<\/h1><p>d<\/p><\/div>/.test(h), true)
  const intro = dentro(/^\s*\.pagina-hero\.solo \.intro\s*$/)
}

console.log('\n8. La cornice (testata, invito, piede) con le misure del design')
{
  const ri = (re) => dentro(re)
  const logo = ri(/^\s*\.logo img\s*$/)
  ok('testata: 22px sopra e sotto, logo alto 110px (82px sul telefono)', [/padding:\s*22px var\(--margine\)/.test(ri(/^\s*\.testata\s*$/)), px(/^\s*\.logo img\s*$/, 'height'), /\.logo img\{[^}]*height:\s*82px/.test(TELEFONO)], [true, 110, true])
  ok('sul telefono le voci sono alte 48px, 16px di fianco, nel menu aperto su fondo pieno, con 6px tra loro', [/\.testata nav a\{[^}]*min-height:\s*48px/.test(TELEFONO), /\.testata nav a\{[^}]*padding:\s*0 16px/.test(TELEFONO), /#menu:target\{[^}]*background:\s*var\(--fondo\)/.test(TELEFONO), /\.testata nav ul\{[^}]*gap:\s*6px/.test(TELEFONO)], [true, true, true, true])
  ok('pulsanti in testata: 24px di fianco; sul telefono il tasto MENU ne ha 22', [/padding:\s*0 24px/.test(ri(/^\s*\.testata \.pulsante\s*$/)), /\.testata \.tasto-menu\{[^}]*padding:\s*0 22px/.test(TELEFONO)], [true, true])
  const h = pagina(tredici)
  const conMenu = g.generaSito({ dominio: 'https://officinedellosport.it', pagine: [{ slug: 'istruttori', titolo: 'T', descrizione: '', testo: '' }, { slug: 'contatti', titolo: 'C', descrizione: '', testo: '' }], menu: [{ dove: 'menu', ordine: 1, etichetta: 'Chi siamo', slug: 'istruttori', indirizzo: null }, { dove: 'menu', ordine: 2, etichetta: 'Contattaci', slug: 'contatti', indirizzo: null }], rinvii: [] })['istruttori/index.html']
  ok('la voce del menu della pagina aperta ha aria-current, le altre no', [conta(conMenu, /<a [^>]*aria-current="page"/g), /<a href="\/istruttori\/" aria-current="page">Chi siamo<\/a>/.test(conMenu)], [1, true])
  const inv = ri(/^\s*\.invito\s*$/)
  ok('invito sul telefono: 22px di padding, alto 260px, frase 17px', [/\.invito\{[^}]*padding:\s*22px/.test(TELEFONO), /\.invito\{[^}]*min-height:\s*260px/.test(TELEFONO), /\.invito \.frase\{[^}]*font-size:\s*17px/.test(TELEFONO)], [true, true, true])
  const pie = ri(/^\s*\.piede\s*$/)
  ok('piede sul telefono: 24px di padding e di margine sotto', [/\.piede\{[^}]*margin-bottom:\s*24px/.test(TELEFONO), /\.piede\{[^}]*padding:\s*24px/.test(TELEFONO)], [true, true])
}

console.log('\n9. Le differenze che restavano: pulsante corto, invito, piede, testo sul telefono')
{
  const h = pagina(dodici)
  ok('l’invito dice anche della settimana a 5 euro, come nel design', />Vieni a provare: ti aspettiamo in Via Vittorio Sassi 26, Collegno\. Una settimana a 5 euro: provi tutte le discipline e scegli\.<\/span>/.test(h), true)
  const pie = (h.match(/<footer[\s\S]*?<\/footer>/) || [''])[0]
  ok('instagram e facebook stanno su una riga, divisi da «·» (li in linea, il separatore è CSS)', [/\.recapiti li:nth-child\(n\+3\)\{[^}]*display:\s*inline/.test(CSS), /\.recapiti li:nth-child\(4\)::before\{[^}]*content:\s*" · "/.test(CSS)], [true, true])
  const voci = [{ dove: 'menu', ordine: 1, etichetta: 'Home', slug: 'istruttori', indirizzo: null }, { dove: 'footer', ordine: 1, etichetta: 'Privacy', slug: null, indirizzo: '/privacy/' }]
  const conVoci = (g.generaSito({ dominio: 'https://officinedellosport.it', pagine: [{ slug: 'istruttori', titolo: 'T', descrizione: '', testo: '' }], menu: voci, rinvii: [] })['istruttori/index.html'].match(/<footer[\s\S]*?<\/footer>/) || [''])[0]
  const pi = dentro(/^\s*\.piede\s*$/)
  ok('sul telefono il testo sotto la griglia non c’è (il design telefono non lo ha)', /\.ritratti-sezione \+ \.testo\{[^}]*display:\s*none/.test(TELEFONO), true)
  ok('e allora la griglia non lascia i 96px sotto: l’invito sta a 48px', /\.ritratti-sezione\{[^}]*padding-bottom:\s*0/.test(TELEFONO), true)
}

console.log(guai ? `\n✗ ${guai} casi falliti` : '\nTutto a posto.')
process.exit(guai ? 1 : 0)
