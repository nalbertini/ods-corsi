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
  ok('le foto della fascia sono verticali (aspect-ratio più alto che largo)', (() => { const m = /aspect-ratio:\s*(\d+)\s*\/\s*(\d+)/.exec(alte?.[2] ?? ''); return m ? Number(m[1]) < Number(m[2]) : false })(), true)
  ok('sul telefono la fascia va a 2 colonne', /@media\s*\(max-width:\s*900px\)[\s\S]*\.foto-fila\.quattro[^{]*\{[^}]*repeat\(2,\s*1fr\)/.test(CSS), true)
  ok('sul telefono le foto della fascia sono 3/4', /@media\s*\(max-width:\s*900px\)[\s\S]*\.foto-fila\.quattro img\{[^}]*aspect-ratio:\s*3\s*\/\s*4/.test(CSS), true)
  const firmaCss = regola(/^\s*\.firma\s*$/)
  ok('la firma mette avatar e nome in fila, centrati, a 14px', [/display:\s*flex/.test(firmaCss?.[2] ?? ''), /align-items:\s*center/.test(firmaCss?.[2] ?? ''), /gap:\s*14px/.test(firmaCss?.[2] ?? '')], [true, true, true])
  const av = regola(/\.firma \.avatar|\.avatar/)
  ok('l’avatar è tondo da 56px, non si schiaccia e centra le iniziali', [/width:\s*56px/.test(av?.[2] ?? ''), /height:\s*56px/.test(av?.[2] ?? ''), /flex:\s*none/.test(av?.[2] ?? ''), /justify-content:\s*center/.test(av?.[2] ?? '')], [true, true, true, true])
  ok('l’avatar è un cerchio giallo con l’inchiostro (#f4c31b su #0d2a3d)', [/border-radius:\s*50%/.test(av?.[2] ?? ''), /background:\s*var\(--giallo\)|background:\s*#f4c31b/.test(av?.[2] ?? '')], [true, true])
}

console.log('\n4. Una foto e il carosello dei clienti: affiancati')
{
  const Q = (n) => `<blockquote><p>Bravi ${n}</p><p><em>Anna ${n}</em></p></blockquote>`
  const duo = (h) => (h.match(/<div class="foto-citazioni">([\s\S]*?)<\/div><\/div>/) || [, null])[1]
  const h1 = sez(`${img(1)}${Q(1)}${Q(2)}${Q(3)}`)
  ok('una foto seguita da 3 citazioni: un solo blocco foto-citazioni', conta(h1, /class="foto-citazioni"/g), 1)
  ok('dentro: la tessera foto prima, poi il carosello con le 3 citazioni', (() => { const d = duo(h1) ?? ''; return [d.indexOf('class="tessera foto') < d.indexOf('class="citazioni"'), conta(d, /<blockquote/g)] })(), [true, 3])
  ok('la foto non resta anche fuori, in una tessera a parte', conta(h1, /<figure class="tessera foto/g), 1)
  ok('una foto e una sola citazione: come prima (foto larga e citazione larga)', [conta(sez(`${img(1)}${Q(1)}`), /foto-citazioni/g), conta(sez(`${img(1)}${Q(1)}`), /tessera foto larga/g)], [0, 1])
  ok('due foto e le citazioni: non si affiancano', conta(sez(`${img(1)}${img(2)}${Q(1)}${Q(2)}`), /foto-citazioni/g), 0)
  ok('le citazioni senza foto: il carosello di prima', [conta(sez(`${Q(1)}${Q(2)}`), /foto-citazioni/g), conta(sez(`${Q(1)}${Q(2)}`), /class="citazioni"/g)], [0, 1])
  ok('il carosello ha ancora il nome per chi usa la tastiera (region con aria-label)', /class="citazioni" tabindex="0" role="region" aria-label="S"/.test(h1), true)
  const h2c = sez(`${img(1)}${Q(1)}${Q(2)}`)
  ok('una foto e solo 2 citazioni: si affiancano', [conta(h2c, /class="foto-citazioni"/g), conta(h2c, /<blockquote/g)], [1, 2])
  ok('le citazioni compaiono una volta sola nella sezione (non anche fuori dal blocco)', conta(h1, /<blockquote/g), 3)
  const hp = sez(`${img(1)}${Q(1)}${Q(2)}<p>Dopo</p>`)
  ok('un paragrafo dopo le citazioni resta fuori dal carosello', [/<p>Dopo<\/p>/.test((duo(hp) ?? '')), /<p>Dopo<\/p>/.test(hp)], [false, true])
  ok('la foto affiancata non è «larga»', /tessera foto larga/.test(h1), false)
  const CSS = pagina('<p>x</p>').match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? ''
  const regola = (re) => [...CSS.matchAll(/([^{}]+)\{([^{}]*)\}/g)].find((m) => re.test(m[1]))
  const dd = regola(/^\s*\.foto-citazioni\s*$/)
  ok('sul computer la foto a sinistra (640px al massimo) e il carosello a destra', [/display:\s*grid/.test(dd?.[2] ?? ''), /grid-template-columns:\s*minmax\(0,\s*640px\)\s+minmax\(0,\s*1fr\)/.test(dd?.[2] ?? '')], [true, true])
  ok('la foto sta nella sua colonna (non va a span 2 come le altre tessere)', /\.foto-citazioni \.foto\{[^}]*grid-column:\s*auto/.test(CSS), true)
  ok('alti fino a 560px', /560px/.test(dd?.[2] ?? ''), true)
  ok('la foto riempie l’altezza (object-fit:cover, height:100%)', /\.foto-citazioni \.foto img\{[^}]*height:\s*100%[^}]*object-fit:\s*cover|\.foto-citazioni \.foto img\{[^}]*object-fit:\s*cover[^}]*height:\s*100%/.test(CSS), true)
  ok('sul telefono la foto è 3/2 e il blocco non ha altezza fissa', [/@media\s*\(max-width:\s*900px\)[\s\S]*\.foto-citazioni \.foto img\{[^}]*aspect-ratio:\s*3\s*\/\s*2/.test(CSS), /@media\s*\(max-width:\s*900px\)[\s\S]*\.foto-citazioni\{[^}]*height:\s*auto/.test(CSS), /@media\s*\(max-width:\s*900px\)[\s\S]*\.foto-citazioni \.citazioni\{[^}]*height:\s*auto/.test(CSS)], [true, true, true])
  ok('sul computer il carosello riempie l’altezza e la foto è tagliata a misura', [/\.foto-citazioni \.citazioni\{[^}]*height:\s*100%/.test(CSS), /\.foto-citazioni \.foto img\{[^}]*aspect-ratio:\s*auto/.test(CSS)], [true, true])
  ok('tra foto e carosello 6px, sotto 6px', [/\.foto-citazioni\{[^}]*gap:\s*6px/.test(CSS), /\.foto-citazioni\{[^}]*margin:\s*0 0 6px/.test(CSS)], [true, true])
  ok('sul telefono foto e carosello vanno una sotto l’altra', /@media\s*\(max-width:\s*900px\)[\s\S]*\.foto-citazioni\{[^}]*grid-template-columns:\s*1fr/.test(CSS), true)
}

console.log('\n5. Il collage pieno della testata (design TatamiBlu)')
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

console.log(guai ? `\n✗ ${guai} casi falliti` : '\nTutto a posto.')
process.exit(guai ? 1 : 0)
