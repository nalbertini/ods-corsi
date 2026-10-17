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

console.log(guai ? `\n✗ ${guai} casi falliti` : '\nTutto a posto.')
process.exit(guai ? 1 : 0)
