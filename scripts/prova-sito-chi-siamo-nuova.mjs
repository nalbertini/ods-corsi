// ---------------------------------------------------------------------------
// La Chi siamo rivista (ChiSiamoProposta), senza browser: il testo della segreteria, scritto con la
// convenzione, diventa le fasce del design. Sempre da `generaSito`.
//
//   node scripts/prova-sito-chi-siamo-nuova.mjs
//
//  1. Si riconosce dal link all'iscrizione in una sezione (la chiamata finale); senza, il <main> è
//     identico a prima (impronta del testo vecchio in fixture-chi-siamo-vecchia.html) e le altre pagine non cambiano.
//  2. Introduzione: slogan (foto + frase), due tessere «oggi», numeri.
//  3. Sezioni per forma: pannello con foto (istruttori inchiostro, missione gialla), fila di foto con didascalie,
//     valori, chiamata finale. Una forma che non torna cade in `sezione` e nessun testo si perde.
//  4. Gerarchia dei titoli senza salti. 5. Misure e fuochi del CSS.
// ---------------------------------------------------------------------------
import { build } from 'esbuild'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

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
// Ogni link al modulo porta l'etichetta della sua pagina (`?da=home`…, provata in prova-sito-genera.mjs): qui si guarda
// l'impaginazione, che non cambia, e la si confronta senza l'etichetta con quella di prima.
const senzaDa = (r) => (r && typeof r === 'object' ? Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === 'string' ? v.replace(/(\?|&amp;|&)da=[a-z0-9-]+/g, '') : v])) : r)
const generaSito = (d) => senzaDa(g.generaSito(d))

let guai = 0
const ok = (cosa, avuto, voluto) => {
  const va = JSON.stringify(avuto) === JSON.stringify(voluto)
  console.log(va ? '  ✓' : '  ✗', cosa, va ? '' : `— atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`)
  if (!va) guai++
}
const P = 'https://abc.supabase.co/storage/v1/object/public/sito/'
const ISCR = 'https://app.officinedellosport.it/iscrizioni/'
const img = (n) => `<img src="${P}f${n}.jpg" alt="Foto ${n}" />`
const conta = (x, re) => (x.match(re) || []).length
const pagina = (testo, slug = 'chi-siamo') =>
  generaSito({ dominio: 'https://officinedellosport.it', pagine: [{ slug, titolo: 'Chi siamo', descrizione: 'La frase.', testo }, { slug: 'contatti', titolo: 'C', descrizione: '', testo: '' }], menu: [], rinvii: [], ospitiImmagini: [P] })[`${slug}/index.html`] ?? ''
const main = (h) => h.match(/<main[\s\S]*<\/main>/)?.[0] ?? ''
const css = (h) => [...h.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('')

const VALORI = [1, 2, 3, 4].map((n) => `<h3>Valore ${n}</h3><p>Frase ${n}.</p>`).join('')
const NUOVO = [
  img(1), '<blockquote><p>Nasciamo dal judo, mettiamo al centro la persona</p></blockquote>',
  '<h3>Chi siamo oggi</h3><p>Uno.</p><h3>Come tutto è iniziato</h3><p>Due.</p>',
  '<ul><li><strong>35+</strong> anni di sport</li><li><strong>9</strong> attività</li><li><strong>300+</strong> atleti</li><li><strong>13</strong> tecnici</li></ul>',
  `<h2>Gli istruttori</h2><p>Chi sono.</p><p><a class="pulsante" href="/istruttori/">Conosci gli istruttori</a></p>${img(2)}`,
  `<h2>I nostri corsi</h2>${img(3)}<p>Lotta</p>${img(4)}<p>Aikido</p>${img(5)}<p>Preparazione atletica</p>${img(6)}<p>Giocomotricità e psicomotricità</p><p><a class="pulsante" href="/corsi/">Vedi tutti i corsi</a></p>`,
  `<h2>Alleniamo il corpo. Coltiviamo il carattere.</h2><p>La missione.</p>${img(7)}`,
  `<h2>I nostri valori</h2><p>Introduzione.</p>${VALORI}`,
  `<h2>Vieni a provare.</h2><p>Una settimana a 5 €.</p><p>Ti aspettiamo in Via Vittorio Sassi 26, Collegno, vicino alla metro Fermi.</p><p><a class="pulsante" href="/contatti/">Scrivici</a> <a class="pulsante" href="${ISCR}">Prova una settimana a 5 €</a></p>${img(8)}`,
].join('')

console.log('\n1. Si riconosce dal link all’iscrizione; senza, la pagina è quella di prima')
{
  const vecchio = readFileSync('scripts/fixture-chi-siamo-vecchia.html', 'utf8').replaceAll('https://qfejpnkryrvjubcxvuco.supabase.co/storage/v1/object/public/sito/', P)
  const hv = pagina(vecchio)
  ok('il testo di oggi non ha le classi nuove', /chi-siamo-nuova|passo-unico/.test(main(hv)), false)
  // L'impronta è del <main> del testo di oggi, calcolata prima di toccare il codice (con le foto del sito vero).
  // Se cambia con ragione (un'altra pagina tocca impagina/testata), si ricalcola: stampa `createHash('sha256').update(main(hh)).digest('hex').slice(0, 16)`.
  const veroV = readFileSync('scripts/fixture-chi-siamo-vecchia.html', 'utf8')
  const hh = generaSito({ dominio: 'https://officinedellosport.it', pagine: [{ slug: 'chi-siamo', titolo: 'Chi siamo', descrizione: 'd', testo: veroV }], menu: [], rinvii: [], ospitiImmagini: ['https://qfejpnkryrvjubcxvuco.supabase.co/storage/v1/object/public/sito/'] })['chi-siamo/index.html']
  ok('<main> del testo di oggi identico a prima', createHash('sha256').update(main(hh)).digest('hex').slice(0, 16), 'c2b7beea12ebc275')
  const h = pagina(NUOVO)
  ok('il testo nuovo: <main class="passo-unico chi-siamo-nuova">', main(h).startsWith('<main class="passo-unico chi-siamo-nuova">'), true)
  ok('niente collage e niente invito globale (c’è la chiamata finale)', [conta(h, /class="collage/g), conta(h, /class="invito/g), conta(h, /<section class="sezione cta">/g)], [0, 0, 1])
  ok('lo stesso testo su un’altra pagina non ha le classi nuove', /chi-siamo-nuova/.test(pagina(NUOVO, 'contatti')), false)
  const senza = NUOVO.replace(ISCR, '/contatti/')
  ok('senza il link all’iscrizione torna la pagina di prima', /chi-siamo-nuova/.test(pagina(senza)), false)
  const home = generaSito({ dominio: 'https://officinedellosport.it', pagine: [{ slug: 'home', titolo: 'H', descrizione: '', testo: '<p>x</p>' }], menu: [], rinvii: [] })['index.html']
  ok('la Home non riceve le regole della Chi siamo', home.includes('chi-siamo-nuova'), false)
}

console.log('\n2. Introduzione: titolo, slogan, due tessere, numeri')
{
  const m = main(pagina(NUOVO))
  ok('titolo e frase nella testata, senza pulsanti né foto', [conta(m, /<section class="pagina-hero solo"><div class="intro"><h1>Chi siamo<\/h1><p>La frase\.<\/p><\/div><\/section>/g), conta(m, /hero-foto/g)], [1, 0])
  ok('slogan: foto a sinistra con caricamento prioritario, frase a destra', conta(m, /<section class="slogan-fascia"><figure class="slogan-foto"><img [^>]*f1\.jpg[^>]*fetchpriority="high"[^>]*><\/figure><blockquote class="slogan-frase"><p>Nasciamo dal judo, mettiamo al centro la persona<\/p><\/blockquote><\/section>/g), 1)
  ok('due tessere uguali, chiara e blu, titolo h2', [conta(m, /<div class="tessere n-2 oggi">/g), conta(m, /<article class="tessera chiara"><h2>Chi siamo oggi<\/h2><p>Uno\.<\/p><\/article>/g), conta(m, /<article class="tessera blu"><h2>Come tutto è iniziato<\/h2><p>Due\.<\/p><\/article>/g)], [1, 1, 1])
  ok('quattro numeri: blu, giallo, inchiostro, blu', [conta(m, /<div class="tessere n-4 numeri">/g), [...m.matchAll(/<article class="tessera (\w+) numero"><strong class="cifra">([^<]+)</g)].map((x) => `${x[1]} ${x[2]}`)], [1, ['blu 35+', 'giallo 9', 'inchiostro 300+', 'blu 13']])
  const resto = main(pagina(`<p>Un paragrafo solo.</p>${NUOVO}`))
  ok('un paragrafo fuori forma non si perde', resto.includes('Un paragrafo solo.'), true)
  const dopoNumeri = main(pagina(NUOVO.replace('</ul>', '</ul><p>Dopo i numeri.</p>')))
  ok('un paragrafo dopo i numeri non finisce in una tessera', [dopoNumeri.includes('Dopo i numeri.'), /<article class="tessera blu"><h2>Come tutto è iniziato<\/h2>[^]*?Dopo i numeri[^]*?<\/article>/.test(dopoNumeri.split('<div class="tessere n-4 numeri">')[0])], [true, false])
}

console.log('\n3. Sezioni')
{
  const m = main(pagina(NUOVO))
  ok('istruttori: pannello inchiostro, testo e pulsante giallo a sinistra, foto a destra', conta(m, /<div class="blocco-foto inchiostro"><div class="blocco-testo"><h2>Gli istruttori<\/h2><p>Chi sono\.<\/p><div class="pulsanti"><a class="pulsante primario" href="\/istruttori\/">Conosci gli istruttori<\/a><\/div><\/div><figure class="blocco-img"><img [^>]*f2\.jpg[^>]*loading="lazy"[^>]*><\/figure><\/div>/g), 1)
  ok('missione: pannello giallo, senza pulsanti', conta(m, /<div class="blocco-foto giallo"><div class="blocco-testo"><h2>Alleniamo il corpo\. Coltiviamo il carattere\.<\/h2><p>La missione\.<\/p><\/div><figure class="blocco-img"><img [^>]*f7\.jpg/g), 1)
  const senzaBottone = main(pagina(NUOVO.replace(/<p><a class="pulsante" href="\/istruttori\/">[^<]*<\/a><\/p>/, '')))
  ok('senza pulsante (la pagina Istruttori non c’è ancora) il pannello resta inchiostro', conta(senzaBottone, /<div class="blocco-foto inchiostro"><div class="blocco-testo"><h2>Gli istruttori/g), 1)
  ok('fila: titolo nascosto ma presente, 4 figure con la didascalia, «Vedi tutti i corsi» a linea', [conta(m, /<section class="sezione corsi-foto"><h2 class="nascosto">I nostri corsi<\/h2><div class="fila-foto">/g), conta(m, /<figure><img [^>]*><figcaption>[^<]+<\/figcaption><\/figure>/g), conta(m, /<a class="pulsante secondario" href="\/corsi\/">Vedi tutti i corsi<\/a>/g)], [1, 4, 1])
  ok('le didascalie nell’ordine del testo', [...m.matchAll(/<figcaption>([^<]+)</g)].map((x) => x[1]), ['Lotta', 'Aikido', 'Preparazione atletica', 'Giocomotricità e psicomotricità'])
  const senzaDidascalia = main(pagina(NUOVO.replace('<p>Aikido</p>', '')))
  ok('una foto senza didascalia resta, senza figcaption vuota', [conta(senzaDidascalia, /<figure><img /g), conta(senzaDidascalia, /<figcaption><\/figcaption>/g)], [4, 0])
  ok('valori: quattro tessere uguali con il numero decorativo', [conta(m, /<div class="tessere n-4 perche">/g), conta(m, /<span class="numero-perche" aria-hidden="true">/g)], [1, 4])
  ok('chiamata finale: solo «Iscriviti» giallo (il «Scrivici» verso Contatti scritto dalla segreteria non esce), foto, «vicino alla metro Fermi»', [conta(m, /<a class="pulsante primario" href="https:\/\/app\.officinedellosport\.it\/iscrizioni\/"[^>]*>Iscriviti/g), /<a [^>]*>Scrivici<\/a>/.test(m), conta(m, /<figure class="cta-foto"><img [^>]*f8\.jpg/g), m.includes('vicino alla metro Fermi')], [1, false, 1, true])
}

console.log('\n4. Forme che non tornano: il testo c’è lo stesso')
{
  const senzaFoto = main(pagina(NUOVO.replace(img(2), '')))
  ok('pannello senza foto: nessun pannello vuoto, testo e pulsante ci sono', [conta(senzaFoto, /<div class="blocco-testo"><h2>Gli istruttori/g), senzaFoto.includes('Chi sono.') && senzaFoto.includes('Conosci gli istruttori')], [0, true])
  const tre = main(pagina(NUOVO.replace('<h3>Valore 4</h3><p>Frase 4.</p>', '')))
  ok('tre valori: niente tessere «perche», ma i tre testi ci sono', [conta(tre, /tessere n-4 perche/g), ['Frase 1.', 'Frase 2.', 'Frase 3.'].every((x) => tre.includes(x))], [0, true])
  const extra = main(pagina(NUOVO.replace('<p>La missione.</p>', '<p>La missione.</p><h3>Altro</h3><p>Testo in più.</p>')))
  ok('un titolo in più nel pannello: tutto il testo resta', ['La missione.', 'Testo in più.'].every((x) => extra.includes(x)), true)
}

console.log('\n4b. Il testo da incollare (docs/sito/chi-siamo.html) è riconosciuto, intero')
{
  const vero = readFileSync('docs/sito/chi-siamo.html', 'utf8').replace(/^<!doctype html>\s*<meta charset="utf-8">\s*<title>[^<]*<\/title>\s*/, '')
  const host = 'https://qfejpnkryrvjubcxvuco.supabase.co/storage/v1/object/public/sito/'
  const m = main(generaSito({ dominio: 'https://officinedellosport.it', pagine: [{ slug: 'chi-siamo', titolo: 'Chi siamo', descrizione: 'd', testo: vero }], menu: [], rinvii: [], ospitiImmagini: [host] })['chi-siamo/index.html'])
  ok('riconosciuto, 8 foto, una chiamata finale, i 4 numeri e i 4 valori', [m.startsWith('<main class="passo-unico chi-siamo-nuova">'), conta(m, /<img /g), conta(m, /<section class="sezione cta">/g), conta(m, /class="tessera \w+ numero"/g), conta(m, /<span class="numero-perche"/g)], [true, 8, 1, 4, 4])
  ok('il testo pronto ha le tre citazioni (Serena, Maria, Rinaldo) ognuna con estratto, testo intero e «Leggi tutto», prima della chiamata finale', [conta(m, /<blockquote class="tessera citazione /g), conta(m, /<summary>Leggi tutto<\/summary>/g), m.indexOf('Lo sport secondo chi lo studia') > 0 && m.indexOf('Lo sport secondo chi lo studia') < m.indexOf('class="sezione cta')], [3, 3, true])
}

console.log('\n4c. Le citazioni di chi studia lo sport stanno in Chi siamo, prima della chiamata finale')
{
  const E1 = 'Primo estratto di Serena […] con il suo seguito.'
  const I1 = 'Primo estratto di Serena con il suo seguito, per intero.'
  const E2 = 'Secondo estratto di Maria, senza testo intero.'
  const CIT = `<h2>Lo sport secondo chi lo studia</h2><blockquote><p>${E1}</p><p>${I1}</p><p><em>Serena - Stud. di Medicina</em></p></blockquote><blockquote><p>${E2}</p><p><em>Maria - Psicologa</em></p></blockquote><blockquote><p>Terzo estratto di Rinaldo.</p><p>Terzo testo intero di Rinaldo.</p><p><em>Rinaldo - Prof. di Ed. Fisica</em></p></blockquote>`
  const h = pagina(NUOVO.replace('<h2>Vieni a provare.</h2>', CIT + '<h2>Vieni a provare.</h2>'))
  const m = main(h)
  const sez = m.match(/<section class="sezione"><h2>Lo sport secondo chi lo studia<\/h2>([\s\S]*?)<\/section>/)?.[1] ?? ''
  ok('tre carte «tessera citazione» in una griglia n-3 «estratti», col titolo della sezione', [/<div class="tessere n-3 estratti">/.test(sez), conta(sez, /<blockquote class="tessera citazione /g)], [true, 3])
  ok('«Leggi tutto» c’è solo dove la segreteria ha scritto il testo intero (Serena e Rinaldo)', [...sez.matchAll(/<blockquote class="[^"]*citazione[^"]*">([\s\S]*?)<\/blockquote>/g)].map((c) => /<summary>Leggi tutto<\/summary>/.test(c[1])), [true, false, true])
  ok('l’estratto è quello scritto, il testo intero sta dentro «Leggi tutto»', [sez.includes(E1), sez.includes(I1), sez.indexOf(I1) > sez.indexOf('<summary>')], [true, true, true])
  ok('le firme hanno nome e ruolo', ['Serena - Stud. di Medicina', 'Maria - Psicologa', 'Rinaldo - Prof. di Ed. Fisica'].every((x) => sez.includes(x.split(' - ')[0]) && sez.includes(x.split(' - ')[1])), true)
  ok('stanno prima della chiamata finale, che resta una sola', [m.indexOf('Lo sport secondo chi lo studia') < m.indexOf('class="sezione cta'), conta(m, /<section class="sezione cta/g)], [true, 1])
  const c = css(h)
  ok('la pagina porta il CSS delle citazioni e di «Leggi tutto»', [/\.tessera\.citazione/.test(c), /\.intero/.test(c)], [true, true])
  const livelli = [...m.matchAll(/<h([1-6])\b/g)].map((x) => Number(x[1]))
  ok('nessun salto di livello dei titoli', livelli.every((l, i) => i === 0 || l - livelli[i - 1] <= 1), true)
}

console.log('\n5. Titoli senza salti: h1, poi h2 per le sezioni, h3 per i valori')
{
  const m = main(pagina(NUOVO))
  const livelli = [...m.matchAll(/<h([1-6])\b/g)].map((x) => Number(x[1]))
  ok('un solo h1 e nessun salto di livello', [conta(m, /<h1\b/g), livelli.every((l, i) => i === 0 || l - livelli[i - 1] <= 1)], [1, true])
  ok('ogni foto ha l’alt', conta(m, /<img (?![^>]*alt="[^"]+")/g), 0)
}

console.log('\n6. Misure e fuochi del CSS')
{
  const c = css(pagina(NUOVO))
  const sotto = c.slice(c.indexOf('@media (max-width:900px){', c.indexOf('.chi-siamo-nuova')))
  ok('titolo da 120px a 1440 (56px sul telefono), sezioni 80/56, tessere 40/32', [/\.chi-siamo-nuova h1\{[^}]*font-size:120px/.test(c), /\.chi-siamo-nuova \.oggi h2\{[^}]*font-size:clamp\(32px,2\.78vw,40px\)/.test(c)], [true, true])
  ok('la frase dello slogan è 56px, in equilibrio, e sul telefono si impila', [/\.slogan-frase\{[^}]*font-size:clamp\(44px,3\.89vw,56px\)[^}]*text-wrap:balance/.test(c), /\.slogan-fascia\{[^}]*grid-template-columns:1fr/.test(sotto)], [true, true])
  ok('la fila: 4 colonne, riquadro 420px, sul telefono 2×2 e nessuna foto nascosta', [/\.fila-foto\{[^}]*grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/.test(c), /\.fila-foto figure img\{[^}]*height:420px/.test(c), /\.fila-foto\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)\}/.test(sotto), /\.fila-foto[^{]*\{[^}]*display:none/.test(c)], [true, true, true, false])
  ok('il titolo nascosto resta per chi usa lo screen reader', /\.chi-siamo-nuova \.nascosto\{[^}]*clip:rect\(0,0,0,0\)/.test(c), true)
  const fuochi = {
    '.slogan-foto img': ['50% 70%', '50% 75%'],
    '.blocco-foto.inchiostro .blocco-img img': ['50% 25%', '50% 25%'],
    '.blocco-foto.giallo .blocco-img img': ['50% 50%', '50% 50%'],
    '.fila-foto figure:nth-child(1) img': ['50% 62%', '50% 62%'],
    '.fila-foto figure:nth-child(2) img': ['40% 50%', '40% 50%'],
    '.fila-foto figure:nth-child(3) img': ['50% 90%', '50% 90%'],
    '.fila-foto figure:nth-child(4) img': ['60% 40%', '60% 40%'],
  }
  const regola = (parte, sel, foco) => parte.includes(`.chi-siamo-nuova ${sel}{object-position:${foco}!important}`)
  ok('fuoco per riquadro, computer', Object.entries(fuochi).filter(([s, f]) => !regola(c.slice(0, c.indexOf('@media', c.indexOf('.chi-siamo-nuova'))), s, f[0])).map(([s]) => s), [])
  ok('fuoco per riquadro, telefono (dopo, dentro il media)', Object.entries(fuochi).filter(([s, f]) => !regola(sotto, s, f[1])).map(([s]) => s), [])
  ok('telefono: le due tessere «oggi» tengono i loro colori, i pulsanti dei pannelli e della fila vanno a tutta larghezza, «Gli istruttori» è 56px', [/\.chi-siamo-nuova \.oggi>\.tessera\.chiara\{background:var\(--chiara\);color:var\(--inchiostro\)\}/.test(sotto), /\.chi-siamo-nuova \.oggi>\.tessera\.blu\{background:var\(--blu\);color:#fff\}/.test(sotto), /\.blocco-foto \.pulsante,\.corsi-foto \.pulsante\{width:100%\}/.test(sotto), /\.blocco-foto\.inchiostro h2\{font-size:56px\}/.test(sotto)], [true, true, true, true])
  ok('i bersagli: i pulsanti sono alti 56px', [/\.chi-siamo-nuova \.pulsante\{[^}]*min-height:56px/.test(c)], [true])
  ok('il passo tra sezioni è 96px (64 sul telefono), 48/32 tra foto e tessere', [/\.chi-siamo-nuova \.sezione\{padding-top:96px\}/.test(c), /\.chi-siamo-nuova \.sezione\{padding-top:64px\}/.test(sotto), /\.oggi\{[^}]*margin:48px var\(--margine\) 0/.test(c)], [true, true, true])
}

console.log(guai ? `\n${guai} da sistemare` : '\nTutto bene')
process.exit(guai ? 1 : 0)
