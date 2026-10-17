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

console.log('\n5. Le tessere dei corsi: fascia d’età e pillole')
{
  const corso = (nome, eta, desc, pill) => `<li><strong>${nome}</strong> <strong>${eta}</strong><br>${desc}${pill ? `<em>${pill}</em>` : ''}</li>`
  const lista = (...li) => `<ul>${li.join('')}</ul>`
  const j = lista(corso('Judo', 'Dai 7 anni agli adulti', 'Tecnica e rispetto', 'Bambini · Adulti · Agonisti'), corso('Aikido', 'Dai 7 anni', 'Armonia', 'Bambini · Anziani'))
  const h = sez(j)
  const t1 = h.match(/<article class="tessera [a-z]+">[\s\S]*?<\/article>/)?.[0] ?? ''
  ok('il titolo del corso è l’h3 della tessera', /<h3>Judo<\/h3>/.test(t1), true)
  ok('la fascia d’età resta in grassetto, poi a capo e la descrizione', /<p><strong>Dai 7 anni agli adulti<\/strong><br\s*\/?>Tecnica e rispetto<\/p>/.test(t1), true)
  ok('le pillole sono 3, nell’ordine scritto, ognuna con la sua icona nascosta a chi legge', [...t1.matchAll(/<span class="pillola"><svg[^>]*aria-hidden="true"[^>]*>[\s\S]*?<\/svg>([^<]+)<\/span>/g)].map((m) => m[1]), ['Bambini', 'Adulti', 'Agonisti'])
  ok('le pillole stanno in un solo contenitore, dopo la descrizione', [conta(t1, /class="pillole"/g), t1.indexOf('Tecnica') < t1.indexOf('class="pillole"')], [1, true])
  ok('l’em delle pillole non resta nel testo', /<em>/.test(t1), false)
  ok('anche la seconda tessera ha le sue (2)', conta(h.split('</article>')[1], /class="pillola"/g), 2)
  const p2 = (pill) => sez(lista(corso('A', 'x', 'y', pill), corso('B', 'x', 'y', '')))
  ok('minuscole e altri separatori: «bambini, adulti / anziani»', [...p2('bambini, adulti / anziani').matchAll(/<\/svg>([^<]+)<\/span>/g)].map((m) => m[1]), ['Bambini', 'Adulti', 'Anziani'])
  ok('doppioni: «Adulti · adulti» è una pillola sola', conta(p2('Adulti · adulti'), /class="pillola"/g), 1)
  ok('un’etichetta sconosciuta: resta un corsivo, niente pillole', [conta(p2('Per tutti'), /class="pillola"/g), /<em>Per tutti<\/em>/.test(p2('Per tutti'))], [0, true])
  ok('una nota e un’etichetta insieme («Adulti · Per tutti»): resta un corsivo', [conta(p2('Adulti · Per tutti'), /class="pillola"/g), /<em>Adulti · Per tutti<\/em>/.test(p2('Adulti · Per tutti'))], [0, true])
  ok('un corsivo in mezzo al testo non diventa pillole', conta(sez(lista('<li><strong>A</strong> <em>Bambini</em> poi altro</li>', '<li><strong>B</strong> x</li>')), /class="pillola"/g), 0)
  ok('una voce senza pillole non ha il contenitore', conta(sez(lista(corso('A', 'x', 'y', ''), corso('B', 'x', 'y', ''))), /class="pillole"/g), 0)
  ok('le quattro etichette del design: bambini, adulti, anziani, agonisti', [...p2('Bambini · Adulti · Anziani · Agonisti').matchAll(/<\/svg>([^<]+)<\/span>/g)].map((m) => m[1]), ['Bambini', 'Adulti', 'Anziani', 'Agonisti'])
  const etichette = (h) => [...h.matchAll(/<\/svg>([^<]+)<\/span>/g)].map((m) => m[1])
  ok('un corsivo di soli spazi non fa un contenitore vuoto', [conta(p2(' '), /class="pillole"/g), conta(p2('&nbsp;'), /class="pillola"/g)], [0, 0])
  ok('un corsivo con html dentro resta un corsivo', [conta(p2('Bambini<strong>x</strong>'), /class="pillola"/g), /<em>Bambini<strong>x<\/strong><\/em>/.test(p2('Bambini<strong>x</strong>'))], [0, true])
  ok('una sola etichetta («Anziani»)', etichette(p2('Anziani')), ['Anziani'])
  ok('l’ordine scritto resta: «Agonisti · Bambini»', etichette(p2('Agonisti · Bambini')), ['Agonisti', 'Bambini'])
  ok('un separatore in fondo non crea una pillola vuota: «Bambini ·»', etichette(p2('Bambini ·')), ['Bambini'])
  ok('una voce senza titolo in grassetto con le pillole: le ha lo stesso', conta(sez(lista('<li>Judo per tutti<em>Bambini</em></li>', '<li>Aikido<em>Adulti</em></li>')), /class="pillola"/g), 2)
  ok('uno spazio dopo la descrizione prima del corsivo non cambia niente', etichette(sez(lista('<li><strong>A</strong> x <em>Adulti</em></li>', '<li><strong>B</strong> y</li>'))), ['Adulti'])
  const lunga = (n) => 'x'.repeat(n)
  ok('150 caratteri di testo con pillole: tessera con pillole; 260 (oltre il limite della voce): resta un elenco', [conta(sez(lista(`<li><strong>A</strong> ${lunga(150)}<em>Adulti</em></li>`, '<li><strong>B</strong> y</li>')), /class="pillola"/g), conta(sez(lista(`<li><strong>A</strong> ${lunga(260)}<em>Adulti</em></li>`, '<li><strong>B</strong> y</li>')), /class="pillola"/g)], [1, 0])
  const icone = [...p2('Bambini · Adulti · Anziani · Agonisti').matchAll(/<svg[^>]*>([\s\S]*?)<\/svg>/g)].map((m) => m[1])
  ok('le quattro icone sono diverse tra loro (Adulti e Anziani differiscono)', [icone.length, new Set(icone).size], [4, 4])
  const CSS = pagina('<p>x</p>').match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? ''
  const regola = (re) => [...CSS.matchAll(/([^{}]+)\{([^{}]*)\}/g)].find((m) => re.test(m[1]))
  const pl = regola(/^\s*\.pillola\s*$/)
  ok('la pillola è una capsula con icona e testo (inline-flex, raggio 999px, gap 6px)', [/display:\s*inline-flex/.test(pl?.[2] ?? ''), /border-radius:\s*999px/.test(pl?.[2] ?? ''), /gap:\s*6px/.test(pl?.[2] ?? '')], [true, true, true])
  ok('è azzurra con l’inchiostro (e blu con il bianco sulle tessere azzurre)', [/background:\s*var\(--chiara\)/.test(pl?.[2] ?? ''), /\.tessera\.chiara \.pillola\{[^}]*background:\s*var\(--blu\)[^}]*color:\s*#fff|\.tessera\.chiara \.pillola\{[^}]*color:\s*#fff[^}]*background:\s*var\(--blu\)/.test(CSS)], [true, true])
  ok('le pillole stanno in fondo alla tessera e vanno a capo', [/margin-top:\s*auto/.test(regola(/^\s*\.pillole\s*$/)?.[2] ?? ''), /flex-wrap:\s*wrap/.test(regola(/^\s*\.pillole\s*$/)?.[2] ?? '')], [true, true])
  ok('le pillole stanno a 6px l’una dall’altra e a 12px dal testo', [/gap:\s*6px/.test(regola(/^\s*\.pillole\s*$/)?.[2] ?? ''), /padding-top:\s*12px/.test(regola(/^\s*\.pillole\s*$/)?.[2] ?? '')], [true, true])
  ok('la pillola: 14px, 600, riga 1, centrata, con padding 6px 12px 6px 8px', [/font-size:\s*14px/.test(pl?.[2] ?? ''), /font-weight:\s*600/.test(pl?.[2] ?? ''), /line-height:\s*1(;|$)/.test(pl?.[2] ?? ''), /align-items:\s*center/.test(pl?.[2] ?? ''), /padding:\s*6px 12px 6px 8px/.test(pl?.[2] ?? '')], [true, true, true, true, true])
  ok('l’icona è da 20px', /\.pillola svg\{[^}]*width:\s*20px[^}]*height:\s*20px|\.pillola svg\{[^}]*height:\s*20px[^}]*width:\s*20px/.test(CSS), true)
}

console.log(guai ? `\n✗ ${guai} casi falliti` : '\nTutto a posto.')
process.exit(guai ? 1 : 0)
