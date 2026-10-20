// ---------------------------------------------------------------------------
// La pagina Corsi rivista, senza browser: il testo della segreteria (stesso modello della Home
// nuova) diventa hero solo con il titolo, nove schede e la chiamata finale. Sempre da `generaSito`.
//
//   node scripts/prova-sito-corsi-nuova.mjs
//
//  1. Quando è «nuova» (pulsante all'iscrizione + schede) e quando il <main> resta com'era
//     (snapshot-corsi-vecchia.json, preso prima del cambio).
//  2. Il <main> di prima non riceve classi nuove.  3. Hero solo.  4. Titolo 120px / 56px.
//  5. Frase del hero.  6. Schede.  7-8. Foto e fasce.  9. Numero di schede.  10. Schede a metà.
//  11-12. Pulsanti e chiamata finale.  13. Invito.  14. Bersagli e script.  15. docs/sito/corsi.html.
// ---------------------------------------------------------------------------
import { build } from 'esbuild'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import * as F from './fixture-corsi-nuova.mjs'

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

const pagina = (t, slug = 'corsi') => generaSito(F.dati(t, slug))[slug === 'home' ? 'index.html' : `${slug}/index.html`] ?? ''
const main = (h) => h.match(/<main([^>]*)>([\s\S]*)<\/main>/)?.[2] ?? ''
const mainTag = (h) => h.match(/<main([^>]*)>/)?.[1] ?? ''
const sha = (t) => createHash('sha256').update(t).digest('hex')
const testo = (h) => h.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
const conta = (x, re) => (x.match(re) || []).length
const classi = (attr) => (attr.match(/class="([^"]*)"/)?.[1] ?? '').split(/\s+/).filter(Boolean)
const COLORI = ['blu', 'giallo', 'inchiostro', 'chiara']
const colore = (cl) => cl.find((c) => COLORI.includes(c))
const sezioni = (m) => [...m.matchAll(/<section\b([^>]*)>([\s\S]*?)<\/section>/g)].map((x) => ({ classi: classi(x[1]), html: x[2] }))
const schede = (h) => [...main(h).matchAll(/<article class="([^"]*\bscheda\b[^"]*)">([\s\S]*?)<\/article>/g)].map((m) => ({ cl: m[1].split(/\s+/), html: m[2] }))
const nuova = (h) => classi(mainTag(h)).includes('pagina-corsi')
const snapshot = JSON.parse(readFileSync(new URL('./snapshot-corsi-vecchia.json', import.meta.url), 'utf8'))

const H = pagina(F.TESTO_NUOVO)
const M = main(H)
const eta = { Judo: 'Dai 7 anni agli adulti' }

// --- Il CSS come elenco di regole (lo stesso lettore di prova-sito-home-aspetto) -----------
const stili = (h) => [...h.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n')
function regole(css) {
  const fuori = []
  let n = 0
  const leggi = (t, media) => {
    let i = 0
    while (i < t.length) {
      const apre = t.indexOf('{', i)
      if (apre < 0) break
      const prelude = t.slice(i, apre).trim()
      let prof = 1
      let j = apre + 1
      while (j < t.length && prof > 0) { if (t[j] === '{') prof++; else if (t[j] === '}') prof--; j++ }
      const dentro = t.slice(apre + 1, j - 1)
      if (/^@(media|supports)/.test(prelude)) leggi(dentro, prelude.replace(/^@(media|supports)\s*/, ''))
      else if (!prelude.startsWith('@')) for (const sel of prelude.split(',')) fuori.push({ media, sel: sel.trim().replace(/\s+/g, ' '), corpo: dentro, n: n++ })
      i = j
    }
  }
  leggi(css.replace(/\/\*[\s\S]*?\*\//g, ''), '')
  return fuori
}
const vale = (media, w) => {
  if (!media) return true
  const cond = [...media.matchAll(/\((min|max)-width:\s*(\d+)px\)/g)]
  if (!cond.length || /,|prefers|print|hover|pointer/.test(media)) return false
  return cond.every((c) => (c[1] === 'min' ? w >= +c[2] : w <= +c[2]))
}
const dichiarazioni = (corpo) => [...corpo.matchAll(/([a-z-]+)\s*:\s*([^;]+?)\s*(?:;|$)/g)].map((m) => [m[1], m[2].replace(/\s*!important$/, '')])
const valori = (R, re, prop, w) => R.filter((r) => vale(r.media, w) && re.test(r.sel)).flatMap((r) => dichiarazioni(r.corpo).filter(([p]) => p === prop).map(([, v]) => v))
const ultimo = (R, re, prop, w) => valori(R, re, prop, w).at(-1)
const px = (v, w) => {
  if (v === undefined) return undefined
  const num = (t) => (/vw$/.test(t.trim()) ? (parseFloat(t) * w) / 100 : parseFloat(t))
  const c = v.match(/^clamp\(([^,]+),([^,]+),([^)]+)\)$/)
  if (c) return Math.round(Math.max(num(c[1]), Math.min(num(c[2]), num(c[3]))))
  return /^-?[\d.]+px$/.test(v) ? Math.round(parseFloat(v)) : v
}
const R = regole(stili(H))

console.log('\n1. Quando la pagina è «nuova», e quando resta com’era')
{
  ok('con il pulsante all’iscrizione e le schede il <main> è «passo-unico pagina-corsi»', classi(mainTag(H)), ['passo-unico', 'pagina-corsi'])
  const senza = pagina(F.TESTO_SENZA_PULSANTE)
  ok('lo stesso testo senza pulsante: <main> di prima, parola per parola (snapshot)', [sha(main(senza)), nuova(senza), classi(mainTag(senza)).includes('passo-unico')], [snapshot.senzaPulsante, false, false])
  const altro = pagina(F.TESTO_NUOVO.replace(F.ISCRIZIONE, 'https://esempio.it/altro/'))
  ok('un pulsante verso un altro indirizzo non basta: <main> di prima (snapshot)', [sha(main(altro)), nuova(altro)], [snapshot.altroIndirizzo, false])
  const h3SenzaLink = pagina(F.TESTO_NUOVO.replace('<h3><a href="/aikido/">Aikido</a></h3>', '<h3>Aikido</h3>'))
  ok('un h3 senza link prima del primo h2: <main> di prima (snapshot), niente schede', [sha(main(h3SenzaLink)), nuova(h3SenzaLink)], [snapshot.h3SenzaLink, false])
  ok('il pulsante da solo non basta: senza h3 con link è la pagina di prima', nuova(pagina(`<p>${F.FRASE}</p>${F.CTA()}`)), false)
  const altreSlug = ['home', 'chi-siamo'].map((s) => nuova(pagina(F.TESTO_NUOVO, s)))
  ok('lo stesso testo su home e chi-siamo non è Corsi nuova', altreSlug, [false, false])
  const diLegge = generaSito(F.dati(F.TESTO_NUOVO, 'corsi', { pagine: [{ slug: 'corsi', titolo: 'T', descrizione: 'd', testo: F.TESTO_NUOVO, diLegge: true }] }))['corsi/index.html'] ?? ''
  ok('una pagina di legge non è Corsi nuova', nuova(diLegge), false)
  ok('il testo della Home nuova su «corsi» (h3 senza link) resta com’era', nuova(pagina(readFileSync(new URL('../docs/sito/home.html', import.meta.url), 'utf8').replace(/^[\s\S]*?<p>/, '<p>'))), false)
  ok('il pulsante in un punto qualunque del testo basta (anche prima delle schede)', nuova(pagina(`<p>${F.PULSANTE}</p><p>${F.FRASE}</p>${F.SCHEDE_HOME}`)), true)
  ok('l’indirizzo dell’iscrizione con http, www o senza «/» finale basta', ['http://app.officinedellosport.it/iscrizioni/', 'https://www.app.officinedellosport.it/iscrizioni', 'https://app.officinedellosport.it/iscrizioni'].map((u) => nuova(pagina(F.TESTO_NUOVO.replaceAll(F.ISCRIZIONE, u)))), [true, true, true])
}

console.log('\n2. Il <main> di prima non riceve niente di nuovo')
{
  const v = pagina(F.TESTO_SENZA_PULSANTE)
  const NUOVE = ['scheda', 'cta', 'pulsanti', 'primario', 'secondario', 'pagina-corsi', 'passo-unico']
  const tokens = new Set([...main(v).matchAll(/class="([^"]*)"/g)].flatMap((m) => m[1].split(/\s+/)))
  ok('<main> senza classi', mainTag(v).trim(), '')
  ok('c’è ancora la sezione senza titolo', /class="sezione senza-titolo"/.test(main(v)), true)
  ok('nessuna classe nuova nel <main> di prima', NUOVE.filter((c) => tokens.has(c)), [])
}

console.log('\n3. Hero solo: il titolo e la frase')
{
  const hero = sezioni(M).find((s) => s.classi.includes('pagina-hero'))
  ok('la testata è «pagina-hero solo»', ['pagina-hero', 'solo'].map((c) => hero?.classi.includes(c)), [true, true])
  ok('un h1, nessuna immagine, nessun pulsante nel hero', [conta(hero?.html ?? '', /<h1\b/g), conta(hero?.html ?? '', /<img\b/g), /pulsant/.test(hero?.html ?? '')], [1, 0, false])
  ok('nessun hero-foto', /hero-foto/.test(M), false)
}

console.log('\n3b. Lo spazio tra la frase e le schede')
{
  // L'hero è una <section> anch'essa: `:first-of-type` non prende la sezione delle schede e restano i 96px della Home.
  const sotto = /\.pagina-corsi \.pagina-hero\+\.sezione$/
  ok('spazio sopra le schede: 40px sul computer, 32px sul telefono', [1440, 375].map((w) => px(ultimo(R, sotto, 'padding-top', w), w)), [40, 32])
}

console.log('\n4. Il titolo: 120px, 56px sul telefono')
{
  const h1 = /\.pagina-corsi.*\bh1$|\bh1\.pagina-corsi$|\.pagina-corsi h1/
  ok('h1 a 1440px: 120px', px(ultimo(R, h1, 'font-size', 1440), 1440), 120)
  ok('h1 a 901px: 120px', px(ultimo(R, h1, 'font-size', 901), 901), 120)
  ok('h1 a 900px e 375px: 56px', [900, 375].map((w) => px(ultimo(R, h1, 'font-size', w), w)), [56, 56])
  ok('line-height fisso (un numero, non «normal»)', [1440, 375].map((w) => /^[\d.]+(px)?$/.test(ultimo(R, h1, 'line-height', w) ?? '')), [true, true])
  ok('nessun white-space che spezzi il titolo', valori(R, h1, 'white-space', 1440).filter((v) => /pre|break/.test(v)), [])
  ok('niente classe sul titolo e niente <br> nell’h1', [/<h1[^>]*class=/.test(H), /<h1[^>]*>[^<]*<br/.test(H)], [false, false])
}

console.log('\n5. La frase del hero')
{
  const hero = (h) => sezioni(main(h)).find((s) => s.classi.includes('pagina-hero'))?.html ?? ''
  ok('la frase è il primo paragrafo, identica, nel hero', hero(H).includes(`<p>${F.FRASE}</p>`), true)
  ok('la descrizione (nei meta) non è nel hero', testo(hero(H)).includes('Descrizione dei corsi.'), false)
  ok('e la frase non resta anche fuori dal hero', conta(M, new RegExp(F.FRASE.slice(0, 30), 'g')), 1)
  const due = pagina(`<p>${F.FRASE}</p><p>Un secondo paragrafo.</p>${F.SCHEDE_HOME}${F.CTA()}`)
  const hd = sezioni(main(due)).find((s) => s.classi.includes('pagina-hero'))?.html ?? ''
  ok('due paragrafi: il primo nel hero, il secondo in colonna sopra la griglia', [hd.includes(F.FRASE), hd.includes('secondo paragrafo'), main(due).indexOf('Un secondo paragrafo') < main(due).indexOf('tessere n-9'), main(due).indexOf('Un secondo paragrafo') >= 0], [true, false, true, true])
  const nessuno = pagina(`${F.SCHEDE_HOME}${F.CTA()}`)
  const hn = sezioni(main(nessuno)).find((s) => s.classi.includes('pagina-hero'))?.html ?? ''
  ok('senza paragrafo: hero solo col titolo, nessun <p>', [nuova(nessuno), conta(hn, /<h1\b/g), conta(hn, /<p\b/g)], [true, 1, 0])
}

console.log('\n6. Le nove schede come nella Home')
{
  const s = schede(H)
  ok('9 article «tessera COLORE scheda» in una griglia «tessere n-9 schede»', [s.length, s.every((a) => a.cl[0] === 'tessera'), /<div class="tessere n-9 schede">/.test(M)], [9, true, true])
  ok('colori: blu giallo inchiostro giallo inchiostro blu inchiostro blu giallo', s.map((a) => colore(a.cl)), ['blu', 'giallo', 'inchiostro', 'giallo', 'inchiostro', 'blu', 'inchiostro', 'blu', 'giallo'])
  ok('nessuna sezione h2 attorno alle schede (section.sezione senza titolo)', (() => { const se = sezioni(M).find((x) => x.html.includes('tessere n-9')); return [se?.classi.includes('sezione'), /<h2/.test(se?.html ?? '')] })(), [true, false])
  ok('ogni scheda: p.eta, descrizione, ul.pastiglie, in quest’ordine', s.map((a) => /<h3>[\s\S]*<p class="eta">[\s\S]*<\/p><p>[\s\S]*<\/p><ul class="pastiglie">/.test(a.html)).every(Boolean), true)
  ok('il titolo è il link al corso', s.map((a) => a.html.match(/<h3><a href="([^"]*)">/)?.[1]).slice(0, 3), ['/judo/', '/lotta/', '/aikido/'])
  ok('la prima età è «Dai 7 anni agli adulti»', (s[0]?.html ?? '').match(/<p class="eta">([^<]*)</)?.[1], eta.Judo)
  ok('nessun <em> rimasto nelle schede', s.some((a) => /<em>/.test(a.html)), false)
  ok('le pastiglie di Judo: Bambini, Adulti, Agonisti', [...(s[0]?.html ?? '').replace(/<svg[\s\S]*?<\/svg>/g, '').matchAll(/<li[^>]*>([^<]*)</g)].map((m) => m[1].trim()), ['Bambini', 'Adulti', 'Agonisti'])
}

console.log('\n7. Foto di scheda o iniziale')
{
  const s = schede(H)
  const di = (nome) => s.find((a) => a.html.includes(`>${nome}</a>`)) ?? { html: '' }
  ok('Pre pugilistica senza foto: fascia con la «P» aria-hidden, nessun img', [/<div class="scheda-foto senza-foto"><span aria-hidden="true">P<\/span><\/div>/.test(di('Pre pugilistica').html), /<img/.test(di('Pre pugilistica').html)], [true, false])
  ok('Judo con foto: img loading="lazy" data-corso="judo"', /<img[^>]*loading="lazy"[^>]*data-corso="judo"|<img[^>]*data-corso="judo"[^>]*loading="lazy"/.test(di('Judo').html), true)
  ok('con home.html: 5 schede con foto e 4 con la fascia', [s.filter((a) => /<img/.test(a.html)).length, s.filter((a) => /senza-foto/.test(a.html)).length], [5, 4])
  ok('foto: judo, lotta, aikido, preparazione atletica, giocomotricità; fasce: pre pugilistica, autodifesa, avviamento, pesi', [
    s.filter((a) => /<img/.test(a.html)).map((a) => a.html.match(/data-corso="([^"]*)"/)?.[1]),
    s.filter((a) => /senza-foto/.test(a.html)).map((a) => a.html.match(/<span aria-hidden="true">(.)</)?.[1]),
  ], [['judo', 'lotta', 'aikido', 'preparazione-atletica', 'giocomotricita-e-psicomotricita'], ['P', 'M', 'A', 'S']])
  ok('il CSS dei fuochi ha judo, su desktop e su telefono', [1440, 375].map((w) => R.some((r) => vale(r.media, w) && r.sel === '.scheda-foto img[data-corso="judo"]')), [true, true])
  ok('…e ci sono regole diverse per il telefono', R.some((r) => r.media.includes('max-width:900px') && r.sel === '.scheda-foto img[data-corso="judo"]'), true)
}

console.log('\n8. Le immagini dopo l’ultima scheda non finiscono nell’ultima')
{
  const img = (n) => `<img src="${F.P}ffff${n}.jpg" alt="Extra ${n}" />`
  const h = pagina(`<p>${F.FRASE}</p>${F.SCHEDE_HOME}${img(1)}${img(2)}<p>Un testo in coda.</p>${F.CTA()}`)
  const pesi = schede(h).at(-1) ?? { html: '' }
  ok('la scheda Pesi non prende le immagini: fascia con la «S»', [/senza-foto/.test(pesi.html), /<img/.test(pesi.html), />S</.test(pesi.html)], [true, false, true])
  ok('le immagini sono scartate dalla scheda, il testo resta nel main', [main(h).includes('ffff1.jpg') && schede(h).some((a) => a.html.includes('ffff')), testo(main(h)).includes('Un testo in coda.')], [false, true])
}

console.log('\n9. Quante schede')
{
  const lista = F.SCHEDE_HOME.split(/(?=<h3>)/)
  const con = (k) => pagina(`<p>${F.FRASE}</p>${Array.from({ length: k }, (_, i) => lista[i % 9].replace(/>([^<]*)<\/a><\/h3>/, `>$1 ${i}</a></h3>`)).join('')}${F.CTA()}`)
  for (const k of [8, 10]) {
    const h = con(k)
    ok(`${k} schede: tessere n-${k}, ${k} article, tutte col colore`, [/<div class="tessere n-/.test(main(h)) && main(h).includes(`tessere n-${k} schede`), schede(h).length, schede(h).every((a) => colore(a.cl))], [true, k, true])
  }
  ok('10 schede: sempre tre colonne a 1440px', valori(R, /\.n-10(\.schede)?$|\.schede$/, 'grid-template-columns', 1440).some((v) => /repeat\(3|(1fr\s+){2}1fr/.test(v)), true)
}

console.log('\n10. Una scheda a metà non fa una pagina a metà')
{
  const h = pagina(F.TESTO_NUOVO.replace('<h3><a href="/aikido/">Aikido</a></h3>', '<h3>Aikido</h3>'))
  ok('Aikido senza link: pagina di prima, nessuna scheda', [nuova(h), schede(h).length], [false, 0])
}

console.log('\n11. I pulsanti: l’iscrizione prima e primaria')
{
  const bottoni = (h) => [...main(h).matchAll(/<a\b([^>]*class="pulsante[^"]*"[^>]*)>([\s\S]*?)<\/a>/g)].map((m) => ({ cl: classi(m[1]), href: m[1].match(/href="([^"]*)"/)?.[1] }))
  const h = pagina(F.TESTO_NUOVO.replace(/<p><a class="pulsante" href="[^"]*">Prova[^]*?<\/p>/, `<p><a class="pulsante" href="/contatti/">Scrivici</a> ${F.PULSANTE}</p>`))
  const b = bottoni(h)
  ok('in ordine inverso il primario verso l’iscrizione resta, e il «Scrivici» verso /contatti/ non esce', [b[0]?.cl, b[0]?.href, b.length], [['pulsante', 'primario'], F.ISCRIZIONE, 1])
  for (const u of ['http://app.officinedellosport.it/iscrizioni/', 'https://www.app.officinedellosport.it/iscrizioni', 'https://app.officinedellosport.it/iscrizioni']) {
    ok(`iscrizione scritta ${u}: href normalizzato`, bottoni(pagina(F.TESTO_NUOVO.replaceAll(F.ISCRIZIONE, u)))[0]?.href, F.ISCRIZIONE)
  }
  const uno = pagina(F.TESTO_NUOVO.replace(/<p><a class="pulsante" href="[^"]*">Prova[^]*?<\/p>/, `<p>${F.PULSANTE}</p>`))
  ok('un solo pulsante: un bottone primario', [bottoni(uno).length, bottoni(uno)[0]?.cl], [1, ['pulsante', 'primario']])
}

console.log('\n12. La chiamata finale')
{
  const ultima = sezioni(M).at(-1)
  ok('l’ultima sezione è «sezione cta», con testo, pulsanti e foto', [ultima?.classi, /<h2>Una settimana per scegliere\.<\/h2>/.test(ultima?.html ?? ''), /class="pulsanti"/.test(ultima?.html ?? ''), conta(ultima?.html ?? '', /<img\b/g)], [['sezione', 'cta'], true, true, 1])
  const senzaFoto = sezioni(main(pagina(`<p>${F.FRASE}</p>${F.SCHEDE_HOME}${F.CTA(false)}`))).at(-1)
  ok('senza foto: «cta solo», nessun img', [senzaFoto?.classi, conta(senzaFoto?.html ?? '', /<img\b/g)], [['sezione', 'cta', 'solo'], 0])
  ok('la chiamata finale ha solo «Iscriviti»: il «Scrivici» verso /contatti/ scritto dalla segreteria non esce', [/<a [^>]*>Scrivici<\/a>/.test(ultima?.html ?? ''), conta(ultima?.html ?? '', /<a\b[^>]*class="pulsante/g)], [false, 1])
}

console.log('\n13. L’invito globale')
{
  ok('con la chiamata finale non c’è l’invito', /class="invito"/.test(H), false)
  const senzaCta = pagina(`<p>${F.PULSANTE}</p><p>${F.FRASE}</p>${F.SCHEDE_HOME}`)
  ok('senza la sezione finale (pulsante solo nel testo) l’invito c’è ancora e il main è comunque nuovo', [/class="invito"/.test(senzaCta), nuova(senzaCta)], [true, true])
}

console.log('\n14. Bersagli e script')
{
  for (const [nome, re] of [['il titolo-link della scheda', /\.scheda h3 a$/], ['i pulsanti', /\.pulsante(\.[\w-]+)*$/]]) {
    for (const w of [1440, 375]) {
      const v = valori(R, re, 'min-height', w).map((x) => px(x, w))
      ok(`${nome} a ${w}px: min-height almeno 48px`, [v.length > 0, v.every((x) => typeof x === 'number' && x >= 48)], [true, true])
    }
  }
  const fre = valori(R, /\.scheda .*(freccia|a)(::after)?$|\.scheda h3 a(::after)?$/, 'min-width', 1440).concat(valori(R, /\.scheda h3 a$/, 'min-height', 1440))
  ok('la freccia/area del titolo è alta almeno 48px', fre.map((x) => px(x, 1440)).some((x) => typeof x === 'number' && x >= 48), true)
  ok('nessuno script nel main', /<script/.test(M), false)
  ok('nessuno script nella pagina fuori da application/ld+json', [...H.matchAll(/<script\b([^>]*)>/g)].filter((m) => !/application\/ld\+json/.test(m[1])).length, 0)
}

console.log('\n15. docs/sito/corsi.html è il testo da copiare nuovo')
{
  const doc = readFileSync(new URL('../docs/sito/corsi.html', import.meta.url), 'utf8')
  const prima = (t) => t.slice(0, t.indexOf('<h2') < 0 ? undefined : t.indexOf('<h2'))
  const norm = (t) => t.replace(/\s+/g, ' ').replace(/> </g, '><').trim()
  const schedeDoc = doc.slice(doc.indexOf('<h3>'))
  const sd = F.SCHEDE_HOME.split(/(?=<h3>)/)
  const dd = norm(prima(schedeDoc)).split(/(?=<h3>)/)
  ok('nove schede', dd.length, 9)
  ok('ogni scheda (titolo, età, descrizione, fasce) coincide con quella di home.html', dd.map((s, i) => s === norm(sd[i])), Array(9).fill(true))
  ok('la frase del hero è quella del canvas', doc.includes(`<p>${F.FRASE}</p>`), true)
  ok('c’è il pulsante verso l’iscrizione', doc.includes(`class="pulsante" href="${F.ISCRIZIONE}"`), true)
  ok('il testo da copiare, così com’è, diventa la pagina nuova', nuova(pagina(doc.replace(/^[\s\S]*?<\/title>/, ''))), true)
}

console.log(guai ? `\n✗ ${guai} casi falliti` : '\nTutto a posto.')
process.exit(guai ? 1 : 0)
