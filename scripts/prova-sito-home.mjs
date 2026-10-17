// ---------------------------------------------------------------------------
// Le fasce della Home come nel design «tatami blu e giallo», senza browser.
//
//   node scripts/prova-sito-home.mjs
//
// Tre cose che il testo scritto dalla segreteria deve poter fare, sempre da
// `generaSito` (src/lib/sitoGenera.ts):
//
//  1. Quattro foto di fila in una sezione sono una fascia di quattro foto alte
//     (`<div class="foto-fila quattro">`), non tre più una; 2, 3 e 5 foto come prima.
//  2. La firma di una citazione ha l'avatar con le iniziali:
//     `<p class="firma"><span class="avatar" aria-hidden="true">NA</span><span class="nome">Nicola A.</span></p>`
//     (iniziali delle prime due parole del nome, prima di « - » o «—»).
//  3. Le tessere che hanno solo il titolo (i valori) lo tengono in basso, grande.
//  4. Il collage pieno della testata: 4 foto e un elenco di 9 voci sono le 13 tessere
//     del design (foto grande, 9 voci, 3 foto), ognuna al suo posto sulla griglia a 6x6.
//  5. Il pulsante in testata dice «Prova una settimana · 5 €» (l'invito in fondo resta «Prova»).
//  6. Il piede è una scheda scura in riga: nome a sinistra, poi gli elenchi.
//
// Il CSS si legge come testo e i `clamp()` si calcolano a 1440px.
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
const img = (n) => `<img src="${P}f${n}.jpg" alt="Foto ${n}" />`
const pagina = (testo) => g.generaSito({ dominio: 'https://officinedellosport.it', pagine: [{ slug: 'home', titolo: 'T', descrizione: 'd', testo }], menu: [], rinvii: [], ospitiImmagini: [P] })['index.html'] ?? ''
const main = (h) => h.match(/<main>([\s\S]*)<\/main>/)?.[1] ?? ''
const dopo = (h) => main(h).split('</section>').slice(1).join('</section>')
const conta = (x, re) => (x.match(re) || []).length
const sez = (corpo) => dopo(pagina(`<p>Intro</p><h2>S</h2>${corpo}`))
const file = (h) => [...h.matchAll(/<div class="foto-fila([^"]*)">([\s\S]*?)<\/div>/g)].map((m) => ({ classe: m[1].trim(), foto: conta(m[2], /<figure class="tessera foto">/g) }))

console.log('\n1. Quattro foto di fila: una fascia di quattro')
{
  ok('4 foto: una fascia «quattro» con 4 foto', file(sez([1, 2, 3, 4].map(img).join(''))), [{ classe: 'quattro', foto: 4 }])
  ok('3 foto: una fila di 3, come prima', file(sez([1, 2, 3].map(img).join(''))), [{ classe: '', foto: 3 }])
  ok('2 foto: una fila «due», come prima', file(sez([1, 2].map(img).join(''))), [{ classe: 'due', foto: 2 }])
  ok('5 foto: 3 più 2, come prima', file(sez([1, 2, 3, 4, 5].map(img).join(''))), [{ classe: '', foto: 3 }, { classe: 'due', foto: 2 }])
  ok('6 foto: 3 più 3, come prima', file(sez([1, 2, 3, 4, 5, 6].map(img).join(''))), [{ classe: '', foto: 3 }, { classe: '', foto: 3 }])
  ok('7 foto: 3 più 4 (la fascia alta è l’ultima)', file(sez([1, 2, 3, 4, 5, 6, 7].map(img).join(''))), [{ classe: '', foto: 3 }, { classe: 'quattro', foto: 4 }])
  ok('9 foto: 4 più 3 più 2', file(sez([1, 2, 3, 4, 5, 6, 7, 8, 9].map(img).join(''))).map((x) => x.foto), [4, 3, 2])
  ok('8 foto: 4 più 4', file(sez([1, 2, 3, 4, 5, 6, 7, 8].map(img).join(''))), [{ classe: 'quattro', foto: 4 }, { classe: 'quattro', foto: 4 }])
}

console.log('\n2. La firma di una citazione ha l’avatar con le iniziali')
{
  const firma = (p) => (sez(`<blockquote><p>Bravi</p><p>${p}</p></blockquote>`).match(/<p class="firma">([\s\S]*?)<\/p>/) || [, 'MANCA'])[1]
  ok('«Nicola A.» in corsivo: iniziali NA', firma('<em>Nicola A.</em>'), '<span class="avatar" aria-hidden="true">NA</span><span class="nome"><em>Nicola A.</em></span>')
  ok('«Serena - Stud. di Medicina»: solo la S (il ruolo non conta)', /<span class="avatar" aria-hidden="true">S<\/span>/.test(firma('<em>Serena - Stud. di Medicina</em>')), true)
  ok('con «—» davanti: le iniziali sono del nome', /<span class="avatar" aria-hidden="true">MR<\/span>/.test(firma('— Mario Rossi')), true)
  ok('le iniziali sono maiuscole', /<span class="avatar" aria-hidden="true">NA<\/span>/.test(firma('<strong>nicola a.</strong>')), true)
  ok('tre parole: solo le prime due iniziali', /<span class="avatar" aria-hidden="true">MR<\/span>/.test(firma('<em>Mario Rossi Bianchi</em>')), true)
  ok('nome accentato: «Élodie Ünal» è ÉÜ', /<span class="avatar" aria-hidden="true">ÉÜ<\/span>/.test(firma('<em>Élodie Ünal</em>')), true)
  ok('cifre davanti: «1 2 Anna» è A', /<span class="avatar" aria-hidden="true">A<\/span>/.test(firma('<em>1 2 Anna</em>')), true)
  ok('con un’emoji davanti il nome resta: «😀 Anna» è A', /<span class="avatar" aria-hidden="true">A<\/span>/.test(firma('<em>😀 Anna</em>')), true)
  ok('una firma di sole cifre non ha avatar', /class="avatar"/.test(firma('<em>123</em>')), false)
  ok('una firma senza lettere non ha avatar vuoto', /class="avatar"/.test(firma('<em>…</em>')), false)
  ok('il testo dell’avatar non si legge due volte (aria-hidden)', /<span class="avatar" aria-hidden="true">/.test(firma('<em>Anna</em>')), true)
}

console.log('\n3. Le tessere col solo titolo (i valori) lo tengono in basso')
{
  const CSS = pagina('<p>x</p>').match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? ''
  const regola = (re) => [...CSS.matchAll(/([^{}]+)\{([^{}]*)\}/g)].find((m) => re.test(m[1]))
  const solo = regola(/\.tessera:has\(\s*>\s*h3:only-child\s*\)/)
  ok('c’è una regola per la tessera che ha solo il titolo (:has(> h3:only-child))', Boolean(solo), true)
  ok('il titolo sta in basso (justify-content:flex-end)', /justify-content:\s*flex-end/.test(solo?.[2] ?? ''), true)
  const h3 = (CSS.match(/\.tessera h3\{[^}]*font-size:clamp\(([^)]*)\)/) || [, ''])[1].split(',')
  ok('il titolo della tessera arriva a 58px (nel design)', parseFloat(h3[2] ?? '0'), 58)
  const q = regola(/\.foto-fila\.quattro/)
  ok('la fascia «quattro» ha 4 colonne', /repeat\(4,\s*1fr\)/.test(q?.[2] ?? ''), true)
  const alte = regola(/\.foto-fila\.quattro\s+img/)
  ok('le foto della fascia sono alte 540px come nel design (più alte che larghe)', /height:\s*540px/.test(alte?.[2] ?? ''), true)
  ok('sul telefono la fascia va a 2 colonne', /@media\s*\(max-width:\s*900px\)[\s\S]*\.foto-fila\.quattro[^{]*\{[^}]*repeat\(2,\s*1fr\)/.test(CSS), true)
  ok('sul telefono le foto della fascia sono alte 220px', /@media\s*\(max-width:\s*900px\)[\s\S]*\.foto-fila\.quattro img\{[^}]*height:\s*220px/.test(CSS), true)
  const firmaCss = regola(/^\s*\.firma\s*$/)
  ok('la firma mette avatar e nome in fila, centrati, a 14px', [/display:\s*flex/.test(firmaCss?.[2] ?? ''), /align-items:\s*center/.test(firmaCss?.[2] ?? ''), /gap:\s*14px/.test(firmaCss?.[2] ?? '')], [true, true, true])
  const av = regola(/\.firma \.avatar|\.avatar/)
  ok('l’avatar è tondo da 56px, non si schiaccia e centra le iniziali', [/width:\s*56px/.test(av?.[2] ?? ''), /height:\s*56px/.test(av?.[2] ?? ''), /flex:\s*none/.test(av?.[2] ?? ''), /justify-content:\s*center/.test(av?.[2] ?? '')], [true, true, true, true])
  ok('l’avatar è un cerchio giallo con l’inchiostro (#f4c31b su #0d2a3d)', [/border-radius:\s*50%/.test(av?.[2] ?? ''), /background:\s*var\(--giallo\)|background:\s*#f4c31b/.test(av?.[2] ?? '')], [true, true])
}

console.log('\n4. Il collage pieno della testata (design TatamiBlu)')
{
  const VOCI = [
    '<strong>35+</strong> anni di sport',
    '<strong>1 settimana di prova: 5 €</strong>',
    '<strong>8</strong> attività',
    '<strong>300+</strong> atleti',
    '<strong>13</strong> tecnici',
    'Via Sassi 26, Collegno<br>vicino alla metro Fermi',
    '<strong>Il corso giusto, il gruppo giusto</strong>',
    'Armonia nel movimento, rispetto nelle relazioni.',
    '<strong>Bambini, ragazzi, adulti</strong>',
  ]
  const elenco = (v) => `<ul>${v.map((x) => `<li>${x}</li>`).join('')}</ul>`
  const testata = (testo) => pagina(testo).match(/<section class="pagina-hero">[\s\S]*?<\/section>/)?.[0] ?? ''
  const h = testata(`<p>Intro</p>${[1, 2, 3, 4].map(img).join('')}${elenco(VOCI)}<h2>S</h2><p>x</p>`)
  const tess = [...h.matchAll(/<(figure|article) class="tessera ([^"]*)">([\s\S]*?)<\/\1>/g)].map((m) => ({ classi: m[2].split(' '), html: m[3] }))
  ok('la griglia è «collage pieno»', /<div class="collage pieno">/.test(h), true)
  ok('13 tessere: foto grande, 9 voci, 3 foto', tess.map((t) => (t.classi.includes('foto') ? 'f' : 'v')).join(''), 'fvvvvvvvvvfff')
  ok('la prima foto è «grande», le altre «meta»', tess.filter((t) => t.classi.includes('foto')).map((t) => t.classi[1]), ['grande', 'meta', 'meta', 'meta'])
  const voci = tess.filter((t) => !t.classi.includes('foto'))
  ok('colori come nel design: blu, giallo, giallo, inchiostro, giallo, blu, inchiostro, giallo, blu', voci.map((t) => t.classi[0]), ['blu', 'giallo', 'giallo', 'inchiostro', 'giallo', 'blu', 'inchiostro', 'giallo', 'blu'])
  ok('numero (grassetto + resto), titolo (solo grassetto), nota (niente grassetto)', voci.map((t) => t.classi[1]), ['numero', 'titolo', 'numero', 'numero', 'numero', 'nota', 'titolo', 'nota', 'titolo'])
  ok('la nota tiene l’a capo dell’indirizzo', /Via Sassi 26, Collegno<br ?\/?>vicino/.test((voci[5]?.html ?? '')), true)
  ok('le foto portano gli attributi di caricamento (la prima subito)', [/fetchpriority="high"/.test((tess[0]?.html ?? '')), /loading="lazy"/.test((tess[10]?.html ?? ''))], [true, true])
  ok('nessun elenco resta nella testata', /<ul|<li/.test(h), false)
  ok('con 3 foto e 9 voci: come prima (non è «pieno»)', /collage pieno/.test(testata(`${[1, 2, 3].map(img).join('')}${elenco(VOCI)}`)), false)
  ok('con 4 foto e 4 numeri: come prima (non è «pieno»)', /collage pieno/.test(testata(`${[1, 2, 3, 4].map(img).join('')}${elenco(VOCI.slice(0, 4))}`)), false)
  ok('con 4 foto e 8 voci: come prima (non è «pieno»)', /collage pieno/.test(testata(`${[1, 2, 3, 4].map(img).join('')}${elenco(VOCI.slice(0, 8))}`)), false)
  ok('il testo in più prima delle foto sta sotto la testata, non dentro', /Intro/.test(h), false)
  // Il CSS: i posti sulla griglia a 6 colonne (desktop). Tessera n → [colonna, righe]
  const CSS = pagina('<p>x</p>').match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? ''
  const desk = CSS.match(/@media \(min-width:901px\)\{(.*?)\}\}/)?.[1] ?? ''
  const posto = (n) => {
    const r = [...desk.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter((m) => m[1].split(',').some((s) => new RegExp(`\\.collage\\.pieno\\s*>?\\s*\\.tessera:nth-child\\(${n}\\)$`).test(s.trim()))).map((m) => m[2]).join(';')
    return [(r.match(/grid-column:\s*([^;]+)/) || [, ''])[1].trim(), (r.match(/grid-row:\s*([^;]+)/) || [, ''])[1].trim()]
  }
  const ATTESI = [['1 / span 3', '1 / span 4'], ['4', '1 / span 2'], ['5 / span 2', '1'], ['5 / span 2', '2'], ['4 / span 2', '3'], ['6', '3 / span 2'], ['4 / span 2', '4'], ['3 / span 2', '5'], ['5 / span 2', '5'], ['1 / span 2', '6'], ['1 / span 2', '5'], ['3 / span 2', '6'], ['5 / span 2', '6']]
  ATTESI.forEach((a, i) => ok(`tessera ${i + 1}: colonna ${a[0]}, riga ${a[1]}`, posto(i + 1), a))
  ok('le righe sono 6 da almeno 128px', /\.collage\.pieno\{[^}]*grid-template-rows:\s*repeat\(6,\s*minmax\(128px,\s*auto\)\)/.test(CSS), true)
  ok('sul telefono i posti non valgono (il blocco è solo per i 901px in su)', /@media \(max-width:900px\)\{[\s\S]*nth-child\(1[0-3]\)/.test(CSS), false)
  const cifra = CSS.match(/\.collage\.pieno \.cifra\{[^}]*font-size:\s*([^;}]+)/)?.[1]
  ok('la cifra è da 60px come nel design', cifra, '60px')
  ok('il titolo della tessera è in display da 32px', /\.collage\.pieno \.titolo\{[^}]*font-size:\s*32px/.test(CSS), true)
  ok('la nota è da 15px', /\.collage\.pieno \.nota[^{]*\{[^}]*font-size:\s*15px/.test(CSS), true)
}

console.log('\n5. Il pulsante in testata')
{
  const h = g.generaSito({ dominio: 'https://officinedellosport.it', pagine: [{ slug: 'home', titolo: 'T', descrizione: 'd', testo: '<p>x</p>' }, { slug: 'contatti', titolo: 'C', descrizione: 'd', testo: '<p>y</p>' }], menu: [], rinvii: [] })['index.html'] ?? ''
  ok('in testata: «Prova una settimana · 5 €» verso /contatti/', /<header class="testata">[\s\S]*<a class="pulsante piccolo" href="\/contatti\/">Prova una settimana · 5 €<\/a>/.test(h), true)
  ok('l’invito in fondo resta «Prova»', /class="parola">Prova</.test(h), true)
}

console.log('\n6. Il piede è una scheda scura in riga')
{
  const CSS = pagina('<p>x</p>').match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? ''
  const r = (re) => [...CSS.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter((m) => re.test(m[1].trim())).map((m) => m[2]).join(';')
  ok('il piede ha il fondo scuro e gli angoli da 6px', [/background:\s*var\(--inchiostro\)/.test(r(/^\.piede$/)), /border-radius:\s*6px/.test(r(/^\.piede$/))], [true, true])
  ok('sul desktop il piede è una riga: nome, elenchi', [/display:\s*flex/.test(r(/^\.piede$/)), /justify-content:\s*space-between/.test(r(/^\.piede$/))], [true, true])
  ok('la riga finale («©») va a capo, a tutta larghezza', /flex-basis:\s*100%/.test(r(/^\.piede \.fine$/)), true)
  ok('il nome nel piede non ha margine sotto', /margin:\s*0/.test(r(/^\.piede \.nome$/)), true)
}

// Le misure del design (TatamiBlu.dc.html a 1440px, TatamiBluM-Home.dc.html a telefono), lette dal CSS generato.
const cssPagina = pagina('<p>x</p>').match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? ''
const mobile = (cssPagina.match(/@media \(max-width:900px\)\{(.*?)\}\}/)?.[1] ?? '') + '}'
const scrivania = (cssPagina.match(/@media \(min-width:901px\)\{(.*?)\}\}/)?.[1] ?? '') + '}'
const base = cssPagina.replace(/@media[^{]*\{.*?\}\}/g, '')
const regola = (css, sel) => [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter((m) => m[1].split(',').some((s) => s.trim() === sel)).map((m) => m[2]).join(';')
const ha = (css, sel, dich) => new RegExp(`(^|;)${dich.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(;|$)`).test(regola(css, sel))

console.log('\n7. Desktop: le misure del design')
{
  ok('testata: padding 22px sui lati del margine', ha(base, '.testata', 'padding:22px var(--margine)'), true)
  ok('testata: le voci del menu stanno a 36px una dall’altra, senza imbottitura', [ha(scrivania, '.testata nav ul', 'gap:36px'), ha(scrivania, '.testata nav a', 'padding:0')], [true, true])
  ok('testata: il pulsante ha 26px di imbottitura', ha(base, '.pulsante.piccolo', 'padding:0 26px'), true)
  ok('titolo grande: interlinea .82', ha(base, 'h1', 'line-height:.82'), true)
  ok('testata: il collage non si allunga con la colonna del titolo', ha(scrivania, '.pagina-hero>.collage', 'align-self:start'), true)
  ok('testata: il pulsante «Contattaci» è alto 60px, con 34px di imbottitura', [ha(base, '.intro .pulsante', 'min-height:60px'), ha(base, '.intro .pulsante', 'padding:0 34px')], [true, true])
  ok('testata: la frase sotto il titolo sta in 520px, con 28px sotto', [ha(base, '.intro p', 'max-width:520px'), ha(base, '.intro p', 'margin:0 0 28px')], [true, true])
  ok('titoli di sezione: interlinea .85', ha(base, '.sezione h2', 'line-height:.85'), true)
  ok('corsi: ogni scheda è alta almeno 340px, titolo da 46px, in colonna con titolo in alto e testo in basso', [ha(scrivania, '.sezione .tessera.tessera:not(.foto):has(h3 a)', 'min-height:340px'), ha(base, '.tessera.tessera:has(h3 a) h3', 'font-size:46px'), ha(base, '.tessera.tessera:has(h3 a)', 'justify-content:space-between')], [true, true, true])
  ok('corsi: il titolo non è sottolineato', ha(base, '.tessera h3 a', 'text-decoration:none'), true)
  ok('fascia di quattro foto: alta 540px', ha(base, '.foto-fila.quattro img', 'height:540px'), true)
  ok('quattro tessere dei valori: alte almeno 190px, imbottitura 26px 30px, titolo da 58px', [ha(scrivania, '.sezione .tessere.n-4 .tessera:not(.foto)', 'min-height:190px'), ha(base, '.tessere.n-4 .tessera', 'padding:26px 30px'), ha(base, '.tessere.n-4 h3', 'font-size:58px')], [true, true, true])
  ok('domande: scheda chiara alta almeno 260px, con 26px 28px, titolo da 30px, testo da 17px', [ha(scrivania, '.sezione .tessera.chiara:not(.foto)', 'min-height:260px'), ha(base, '.tessera.chiara', 'padding:26px 28px'), ha(base, '.tessera.chiara h3', 'font-size:30px'), ha(base, '.tessera.chiara', 'font-size:17px')], [true, true, true, true])
  ok('invito: margini del contenuto, alto 300px, frase da 22px, parola da 170px', [ha(base, '.invito', 'margin:0 var(--margine) 6px'), ha(base, '.invito', 'min-height:300px'), ha(base, '.invito .frase', 'font-size:22px'), ha(base, '.invito .parola', 'font-size:170px')], [true, true, true, true])
  ok('piede: margini del contenuto, 48px sotto, nome da 56px', [ha(base, '.piede', 'margin:0 var(--margine) 48px'), ha(base, '.piede .nome', 'font-size:56px')], [true, true])
}

console.log('\n8. Citazioni con la foto a sinistra')
{
  const q = (n) => Array.from({ length: n }, (_, i) => `<blockquote><p>Testo ${i}</p><p><em>Nome ${i}</em></p></blockquote>`).join('')
  const sez = (t) => pagina(`<h2>Titolo</h2>${t}`).match(/<section class="sezione">[\s\S]*?<\/section>/)?.[0] ?? ''
  const con = sez(`${img(1)}${q(3)}`)
  ok('foto + citazioni: una fascia con la foto a sinistra e le citazioni a fianco', /<div class="citazioni-foto"><figure class="tessera foto">[\s\S]*<\/figure><div class="citazioni"/.test(con), true)
  ok('le citazioni restano tre', (con.match(/<blockquote/g) ?? []).length, 3)
  ok('senza foto: solo le citazioni, come prima', /citazioni-foto/.test(sez(q(3))), false)
  ok('la foto è larga 640px e la fascia alta almeno 560px sul desktop', [ha(scrivania, '.citazioni-foto .foto', 'flex:0 0 640px'), ha(scrivania, '.citazioni-foto', 'min-height:560px')], [true, true])
  ok('le citazioni sono larghe 560px, con 36px 40px, testo da 26px', [ha(base, '.citazioni .tessera', 'flex:0 0 min(560px,85%)'), ha(base, '.tessera.citazione', 'padding:36px 40px'), ha(base, '.tessera.citazione', 'font-size:26px')], [true, true, true])
}

console.log('\n9. Telefono: le misure del design')
{
  ok('testata: padding 12px 16px', ha(mobile, '.testata', 'padding:12px var(--margine) 0'), true)
  ok('menu a tessere: la voce della pagina è gialla, le altre chiare', [ha(mobile, '.testata nav a', 'background:var(--chiara)'), ha(mobile, '.testata nav a[aria-current]', 'background:var(--giallo)')], [true, true])
  ok('titolo da 84px', ha(mobile, 'h1', 'font-size:84px'), true)
  ok('titoli di sezione da 64px, sezioni a 48px una dall’altra', [ha(mobile, '.sezione h2', 'font-size:64px'), ha(mobile, '.sezione', 'padding:48px var(--margine) 0')], [true, true])
  ok('collage: i numeri stanno in 2 colonne, alti 150px, cifra da 68px', [ha(mobile, '.collage.pieno .tessera.numero', 'min-height:150px'), ha(mobile, '.collage.pieno .cifra', 'font-size:68px')], [true, true])
  ok('collage: le altre tessere (indirizzo, valori, foto in più) non si mostrano', ha(mobile, '.collage.pieno>.tessera:nth-child(n+7)', 'display:none'), true)
  ok('collage: la foto grande è alta 300px', ha(mobile, '.collage .foto.grande', 'height:300px'), true)
  ok('quattro foto: alte 220px', ha(mobile, '.foto-fila.quattro img', 'height:220px'), true)
  ok('quattro tessere dei valori: alte almeno 120px, titolo da 40px', [ha(mobile, '.tessere.n-4 .tessera', 'min-height:120px'), ha(mobile, '.tessere.n-4 h3', 'font-size:40px')], [true, true])
  ok('citazioni: larghe 300px, alte almeno 300px, testo da 19px', [ha(mobile, '.citazioni .tessera', 'flex:0 0 300px'), ha(mobile, '.tessera.citazione', 'min-height:300px'), ha(mobile, '.tessera.citazione', 'font-size:19px')], [true, true, true])
  ok('invito: alto almeno 260px, parola da 120px', [ha(mobile, '.invito', 'min-height:260px'), ha(mobile, '.invito .parola', 'font-size:120px')], [true, true])
  ok('piede: nome da 44px, 24px di imbottitura', [ha(mobile, '.piede .nome', 'font-size:44px'), ha(mobile, '.piede', 'padding:24px')], [true, true])
  const m = g.generaSito({ dominio: 'https://officinedellosport.it', pagine: [{ slug: 'home', titolo: 'T', descrizione: 'd', testo: '<p>x</p>' }, { slug: 'contatti', titolo: 'C', descrizione: 'd', testo: '<p>y</p>' }], menu: [{ dove: 'menu', ordine: 1, etichetta: 'Home', slug: 'home', indirizzo: null }, { dove: 'menu', ordine: 2, etichetta: 'Contatti', slug: 'contatti', indirizzo: null }], rinvii: [] })
  ok('domande: una gialla e una chiara, a turno', ha(mobile, '.tessere .tessera.chiara:nth-child(odd)', 'background:var(--giallo)'), true)
  ok('la voce della pagina aperta ha aria-current="page", solo quella', [/<a href="\/" aria-current="page">Home/.test(m['index.html']), /<a href="\/contatti\/" aria-current="page">Contatti/.test(m['contatti/index.html']), (m['index.html'].match(/aria-current="page"/g) ?? []).length], [true, true, 1])
}

console.log('\n10. I colori delle tessere come nel design')
{
  const col = (html) => [...html.matchAll(/<article class="tessera (\w+)"/g)].map((m) => m[1])
  const sez = (t) => pagina(`<h2>Titolo</h2>${t}`).match(/<section class="sezione">[\s\S]*?<\/section>/)?.[0] ?? ''
  const voci = (n) => `<ul>${Array.from({ length: n }, (_, i) => `<li><strong>Voce ${i}</strong> testo</li>`).join('')}</ul>`
  const gruppi = (n) => Array.from({ length: n }, (_, i) => `<h3>Titolo ${i}</h3>`).join('')
  ok('9 schede (i corsi): blu, giallo, inchiostro, giallo, inchiostro, blu, inchiostro, blu, giallo', col(sez(voci(9))), ['blu', 'giallo', 'inchiostro', 'giallo', 'inchiostro', 'blu', 'inchiostro', 'blu', 'giallo'])
  ok('4 tessere dei valori: giallo, blu, inchiostro, giallo', col(sez(gruppi(4))), ['giallo', 'blu', 'inchiostro', 'giallo'])
  ok('le altre quantità ruotano come prima (3: blu, giallo, inchiostro)', col(sez(gruppi(3))), ['blu', 'giallo', 'inchiostro'])
}

console.log('\n11. Dettagli visibili: firme, virgolette, invito, piede')
{
  ok('la firma non è in corsivo', ha(base, '.firma em', 'font-style:normal'), true)
  ok('le citazioni hanno le virgolette « » (si aggiungono nel CSS, il testo non cambia)', [/\.citazione>p:first-child::before\{content:"«"/.test(cssPagina), /\.citazione>p:first-child::after\{content:"»"/.test(cssPagina)], [true, true])
  ok('l’invito non ha la freccia', ha(base, '.invito .freccia', 'display:none'), true)
  const h = g.generaSito({ dominio: 'https://officinedellosport.it', pagine: [{ slug: 'home', titolo: 'T', descrizione: 'd', testo: '<p>x</p>' }, { slug: 'contatti', titolo: 'C', descrizione: 'd', testo: '<p>y</p>' }], menu: [{ dove: 'menu', ordine: 1, etichetta: 'Home', slug: 'home', indirizzo: null }, { dove: 'footer', ordine: 1, etichetta: 'Privacy', slug: null, indirizzo: '/privacy/' }], rinvii: [] })['index.html'] ?? ''
  const piede = h.match(/<footer class="piede">[\s\S]*<\/footer>/)?.[0] ?? ''
  ok('il piede ha tre colonne: recapiti, menu, altri link (come nel design)', (piede.match(/<ul>/g) ?? []).length, 3)
  ok('il menu del piede ripete le voci del menu', /<li><a href="\/"[^>]*>Home<\/a><\/li>/.test(piede), true)
  ok('il nome nel piede va a capo in due righe', ha(base, '.piede .nome', 'max-width:5.5em'), true)
  ok('i titoli delle colonne del piede restano per chi legge con lo schermo ma non si vedono', ha(base, '.piede h2', 'position:absolute'), true)
}

console.log('\n12. Schede dei corsi, marchio ritagliato, puntini, pulsante breve')
{
  const sez = (t) => pagina(`<h2>Titolo</h2>${t}`).match(/<section class="sezione">[\s\S]*?<\/section>/)?.[0] ?? ''
  const corso = (i) => `<li><strong><a href="/c${i}/">Corso ${i}</a></strong> ${i === 0 ? img(1) + ' ' : ''}<strong>Dai 7 anni agli adulti</strong><br>Tecnica e rispetto <em>Bambini · Adulti · Agonisti</em></li>`
  const h = sez(`<ul>${[0, 1, 2].map(corso).join('')}</ul>`)
  const schede = [...h.matchAll(/<article class="tessera[^"]*">([\s\S]*?)<\/article>/g)].map((m) => m[1])
  ok('la foto del corso sta prima del titolo, in un riquadro', /^<div class="corso-foto"><img /.test(schede[0] ?? ''), true)
  ok('senza foto non c’è il riquadro', /corso-foto/.test(schede[1] ?? ''), false)
  ok('il testo tiene la riga in grassetto e l’a capo', /<p><strong>Dai 7 anni agli adulti<\/strong><br ?\/?>Tecnica e rispetto<\/p>/.test(schede[1] ?? ''), true)
  const chip = [...(schede[1] ?? '').matchAll(/<span class="etichetta">(?:<svg[^>]*aria-hidden="true">[\s\S]*?<\/svg>)?([^<]*)<\/span>/g)].map((m) => m[1])
  ok('l’ultimo corsivo diventa le etichette: Bambini, Adulti, Agonisti', chip, ['Bambini', 'Adulti', 'Agonisti'])
  ok('ogni etichetta nota ha la sua icona', ((schede[1] ?? '').match(/<svg/g) ?? []).length, 3)
  ok('le etichette stanno in un paragrafo a parte', /<p class="etichette">/.test(schede[1] ?? ''), true)
  ok('sul desktop la foto del corso non si vede, sul telefono è alta 150px', [ha(base, '.corso-foto', 'display:none'), ha(mobile, '.corso-foto', 'height:150px')], [true, true])
  ok('sul telefono il titolo ha la freccia ↗', /\.tessera:has\(h3 a\) h3::after\{content:"↗"/.test(mobile), true)
  ok('etichetta: pastiglia chiara da 14px', [ha(base, '.etichetta', 'background:var(--chiara)'), ha(base, '.etichetta', 'border-radius:999px'), ha(base, '.etichetta', 'font-size:14px')], [true, true, true])
  ok('colori dei corsi sul telefono: giallo, blu, inchiostro, blu, inchiostro, giallo, inchiostro, giallo, blu', [1, 2, 3, 4, 5, 6, 7, 8, 9].map((k) => /var\(--(giallo|blu|inchiostro)\)/.exec(regola(mobile, `.tessere.n-9 .tessera.tessera:nth-child(${k})`).replace(/.*?background:/, 'background:'))?.[1]), ['giallo', 'blu', 'inchiostro', 'blu', 'inchiostro', 'giallo', 'inchiostro', 'giallo', 'blu'])
  const tp = pagina(`<ul>${[1, 2].map((i) => `<li><strong>Cifra ${i}</strong> cose</li>`).join('')}<li><strong>Prova</strong><br><em>Provi tutto.</em></li></ul>`)
  ok('una voce «titolo + a capo + corsivo» ha la scritta sotto, nascosta sul desktop', [ha(base, '.sotto', 'display:none'), ha(mobile, '.sotto', 'display:block')], [true, true])
  ok('il marchio (già tagliato ai margini) è 112x110 sul desktop e 84x82 sul telefono, come nel design', [ha(base, '.logo img', 'width:112px'), ha(base, '.logo img', 'height:110px'), ha(mobile, '.logo img', 'width:84px'), ha(mobile, '.logo img', 'height:82px')], [true, true, true, true])
  ok('il pulsante in testata sul telefono mostra «Prova»', /\.testata \.pulsante::before\{content:"Prova"/.test(mobile), true)
  ok('le citazioni hanno i puntini (scroll-marker)', [/scroll-marker-group:\s*after/.test(cssPagina), /\.citazioni \.tessera::scroll-marker\{/.test(cssPagina)], [true, true])
  ok('sul telefono le foto della fascia sono due', ha(mobile, '.foto-fila.quattro .foto:nth-child(n+3)', 'display:none'), true)
  const piede = pagina('<p>x</p>')
  ok('il piede ripete le voci del menu', /<footer class="piede">[\s\S]*Contatti/.test(g.generaSito({ dominio: 'https://officinedellosport.it', pagine: [{ slug: 'home', titolo: 'T', descrizione: 'd', testo: '<p>x</p>' }, { slug: 'contatti', titolo: 'C', descrizione: 'd', testo: '<p>y</p>' }], menu: [{ dove: 'menu', ordine: 1, etichetta: 'Contatti', slug: 'contatti', indirizzo: null }], rinvii: [] })['index.html']?.match(/<footer[\s\S]*<\/footer>/)?.[0] ?? ''), true)
}

console.log(guai ? `\n✗ ${guai} casi falliti` : '\nTutto a posto.')
process.exit(guai ? 1 : 0)
