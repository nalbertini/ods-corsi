// ---------------------------------------------------------------------------
// La Home rivista (HomeProposta), senza browser: il testo della segreteria, scritto
// con la convenzione, diventa le fasce del design. Sempre da `generaSito`.
//
//   node scripts/prova-sito-home-nuova.mjs
//
// Le misure (clamp, passo, bersagli) stanno in prova-sito-home-aspetto.mjs; qui la struttura:
//
//  1. La «Home nuova» si riconosce dal link all'iscrizione nell'introduzione; senza, il <main> è
//     identico a prima (snapshot in snapshot-home-vecchia.json) e le altre pagine non cambiano.
//  2. Introduzione: pulsanti (il primario, giallo, sempre primo), foto, numeri, motto.
//  3. Corsi: schede con foto o iniziale, età, descrizione, pastiglie.
//  4. Perché: quattro tessere numerate. 5. Citazioni: estratto + «Leggi tutto».
//  6. Recensioni: due carte larghe e «In breve». 7. Domande. 8. Chiamata finale.
//  9. Testata (pulsante, MENU senza script) e piede (indirizzo, metro Fermi) di ogni pagina.
// ---------------------------------------------------------------------------
import { build } from 'esbuild'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import * as F from './fixture-home-nuova.mjs'

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

const genera = (d) => g.generaSito(d)
const home = (testo, opz) => genera(F.dati(testo, opz))['index.html'] ?? ''
const main = (h) => h.match(/<main([^>]*)>([\s\S]*)<\/main>/)?.[2] ?? ''
const mainTag = (h) => h.match(/<main([^>]*)>/)?.[1] ?? ''
const sha = (t) => createHash('sha256').update(t).digest('hex')
const testo = (h) => h.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
const conta = (x, re) => (x.match(re) || []).length
const classi = (attr) => (attr.match(/class="([^"]*)"/)?.[1] ?? '').split(/\s+/).filter(Boolean)
const COLORI = ['blu', 'giallo', 'inchiostro', 'chiara']
const colore = (cl) => cl.find((c) => COLORI.includes(c))
const sezioni = (m) => [...m.matchAll(/<section\b([^>]*)>([\s\S]*?)<\/section>/g)].map((x) => ({ classi: classi(x[1]), html: x[2] }))
const sezDi = (h, titolo) => sezioni(main(h)).find((s) => new RegExp(`<h2[^>]*>\\s*${titolo.replace(/[?.]/g, '\\$&')}`).test(s.html))
const tessereDi = (html) => [...html.matchAll(/<div class="(tessere [^"]*)">/g)].map((m) => m[1].split(/\s+/))
const snapshot = JSON.parse(readFileSync(new URL('./snapshot-home-vecchia.json', import.meta.url), 'utf8'))

const H = home(F.TESTO_NUOVO)
const M = main(H)

console.log('\n1. Quando una Home è «nuova», e quando resta com’era')
{
  ok('con il link all’iscrizione nell’introduzione il <main> è «passo-unico»', classi(mainTag(H)).includes('passo-unico'), true)
  const vecchia = genera(F.datiVecchi())
  ok('la Home di prima (nessun pulsante) ha lo stesso <main> di prima, parola per parola', [sha(main(vecchia['index.html'])), main(vecchia['index.html']).length], [snapshot.homeVecchia.sha256, snapshot.homeVecchia.lunghezza])
  ok('la Home di prima non è «passo-unico»', classi(mainTag(vecchia['index.html'])).includes('passo-unico'), false)
  ok('la Home di prima ha ancora il collage pieno, le firme a due iniziali e l’invito', [/class="collage pieno"/.test(vecchia['index.html']), />NA<\/span>/.test(vecchia['index.html']), /class="invito"/.test(vecchia['index.html'])], [true, true, true])
  ok('il testo nuovo senza i pulsanti: <main> identico a prima (snapshot)', [sha(main(home(F.TESTO_SENZA_LINK))), classi(mainTag(home(F.TESTO_SENZA_LINK))).includes('passo-unico')], [snapshot.homeSenzaLink.sha256, false])
  ok('Corsi e Contatti: <main> identico a prima', [sha(main(vecchia['corsi/index.html'])), sha(main(vecchia['contatti/index.html']))], [snapshot.corsi.sha256, snapshot.contatti.sha256])
  const soloPulsanteInfondo = F.INTRO.replace(/^<p>.*?<\/p>/, '') + F.CORSI + F.CTA()
  ok('il link all’iscrizione solo in fondo (non nell’introduzione): non è Home nuova', classi(mainTag(home(soloPulsanteInfondo))).includes('passo-unico'), false)
  const altroLink = F.TESTO_NUOVO.replace(`<p><a class="pulsante" href="/contatti/">Scrivici</a> <a class="pulsante" href="${F.ISCRIZIONE}">Prova una settimana a 5 €</a></p>`, '<p><a class="pulsante" href="/contatti/">Scrivici</a></p>')
  ok('un pulsante verso un altro indirizzo non basta', classi(mainTag(home(altroLink))).includes('passo-unico'), false)
  const diLegge = genera({ ...F.dati(F.TESTO_NUOVO), pagine: [{ slug: 'home', titolo: 'T', descrizione: 'd', testo: F.TESTO_NUOVO, diLegge: true }] })['index.html']
  ok('una pagina di legge non è Home nuova', classi(mainTag(diLegge)).includes('passo-unico'), false)
  const altra = genera({ ...F.dati(F.TESTO_NUOVO), pagine: [{ slug: 'corsi', titolo: 'Corsi', descrizione: 'd', testo: F.TESTO_NUOVO }] })['corsi/index.html']
  ok('la stessa pagina con altro indirizzo (non «home») non è Home nuova', classi(mainTag(altra)).includes('passo-unico'), false)
  const NUOVE = ['passo-unico', 'scheda', 'scheda-foto', 'perche', 'estratti', 'estratto', 'intero', 'recensioni', 'in-breve', 'cta', 'motto', 'pastiglie', 'pulsanti', 'primario', 'secondario']
  const tokens = new Set([...main(altra).matchAll(/class="([^"]*)"/g)].flatMap((m) => m[1].split(/\s+/)))
  ok('le altre pagine non ricevono nessuna classe nuova nel <main>', NUOVE.filter((c) => tokens.has(c)), [])
  ok('nel <main> della Home nuova nessuna classe «home-»', /class="[^"]*\bhome-/.test(M), false)
  ok('niente collage nella Home nuova', /class="collage/.test(M), false)
  ok('con la sezione finale non c’è l’invito globale', /class="invito"/.test(H), false)
  const senzaCta = home(F.INTRO + F.CORSI + F.FAQ)
  ok('senza la chiamata finale resta l’invito di prima', [/class="invito"/.test(senzaCta), classi(mainTag(senzaCta)).includes('passo-unico')], [true, true])
}

console.log('\n2. Introduzione: pulsanti, foto, numeri, motto')
{
  const hero = sezioni(M).find((s) => s.classi.includes('pagina-hero'))
  const pul = hero?.html.match(/<div class="pulsanti">([\s\S]*?)<\/div>/)?.[1] ?? ''
  const link = [...pul.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].map((m) => ({ cl: classi(m[1]), href: m[1].match(/href="([^"]*)"/)?.[1], t: testo(m[2]) }))
  ok('i pulsanti stanno in un <div class="pulsanti"> della testata, non in un paragrafo', [Boolean(pul), /<p><a class="pulsante"/.test(hero?.html ?? '')], [true, false])
  ok('il primario (giallo) è il link all’iscrizione ed è primo, anche se la segreteria l’ha scritto per secondo', [link[0]?.cl, link[0]?.href, link[0]?.t], [['pulsante', 'primario'], F.ISCRIZIONE, 'Prova una settimana a 5 €'])
  ok('l’altro è secondario (a linea) e porta a Contatti', [link[1]?.cl, link[1]?.href, link[1]?.t, link.length], [['pulsante', 'secondario'], '/contatti/', 'Scrivici', 2])
  ok('la foto è nella testata, nella seconda colonna; la testata non è «solo»', [conta(hero?.html ?? '', /<img\b/g), hero?.classi.includes('solo')], [1, false])
  const senzaFoto = sezioni(main(home(F.TESTO_NUOVO.replace(/<img [^>]*gruppo[^>]*>|<img [^>]*18c88f1d[^>]*>/, '')))).find((s) => s.classi.includes('pagina-hero'))
  ok('senza foto la testata è «solo»', [senzaFoto?.classi.includes('solo'), conta(senzaFoto?.html ?? '', /<img\b/g)], [true, 0])

  const nu = tessereDi(M).find((c) => c.includes('numeri'))
  ok('i numeri sono 4 tessere uguali: tessere n-4 numeri', nu, ['tessere', 'n-4', 'numeri'])
  const tess = [...(M.match(/<div class="tessere n-4 numeri">([\s\S]*?)<\/div>/)?.[1] ?? '').matchAll(/<article class="([^"]*)">([\s\S]*?)<\/article>/g)]
  ok('colori: blu, giallo, inchiostro, blu', tess.map((t) => colore(t[1].split(/\s+/))), ['blu', 'giallo', 'inchiostro', 'blu'])
  ok('ogni tessera ha il numero in grassetto e la scritta', tess.map((t) => [t[2].match(/<strong[^>]*>([\s\S]*?)<\/strong>/)?.[1], testo(t[2].replace(/<strong[^>]*>[\s\S]*?<\/strong>/, ''))]), [['35+', 'anni di sport'], ['9', 'attività'], ['300+', 'atleti'], ['13', 'tecnici']])
  const conUl = (ul) => home(F.TESTO_NUOVO.replace(/<ul><li><strong>35\+.*?<\/ul>/, ul))
  const voci = (n, strong = true) => `<ul>${Array.from({ length: n }, (_, i) => `<li>${strong ? `<strong>${i + 1}0</strong> cose` : `cose ${i}`}</li>`).join('')}</ul>`
  ok('6 voci: tessere n-6 numeri', tessereDi(main(conUl(voci(6)))).find((c) => c.includes('numeri')), ['tessere', 'n-6', 'numeri'])
  ok('7 voci: resta un elenco', [tessereDi(main(conUl(voci(7)))).some((c) => c.includes('numeri')), /<ul>/.test(main(conUl(voci(7))))], [false, true])
  ok('1 voce: resta un elenco', [tessereDi(main(conUl(voci(1)))).some((c) => c.includes('numeri')), /<ul>/.test(main(conUl(voci(1))))], [false, true])
  ok('senza il grassetto: resta un elenco', [tessereDi(main(conUl(voci(4, false)))).some((c) => c.includes('numeri')), /<ul>/.test(main(conUl(voci(4, false))))], [false, true])

  const motto = M.match(/class="motto">([\s\S]*?)(?=<h2|<section)/)?.[1] ?? ''
  ok('il motto è una fascia: il titolo, poi la frase e il motto', [motto.indexOf('<h3>Il corso giusto, il gruppo giusto</h3>') >= 0, testo(motto)], [true, 'Il corso giusto, il gruppo giusto Professionisti dello sport, da oltre 35 anni accanto a bambini, ragazzi e adulti. Armonia nel movimento, rispetto nelle relazioni, costanza nel tempo.'])
  ok('la frase e il motto sono due paragrafi, dopo il titolo', [conta(motto, /<p>/g), motto.indexOf('<h3>') < motto.indexOf('<p>')], [2, true])
  ok('il motto non resta anche fuori dalla fascia', conta(M, /Il corso giusto, il gruppo giusto/g), 1)
}

console.log('\n3. I corsi: schede con foto o iniziale')
{
  const s = sezDi(H, 'I nostri corsi')
  const art = [...(s?.html ?? '').matchAll(/<article class="([^"]*)">([\s\S]*?)<\/article>/g)].map((m) => ({ cl: m[1].split(/\s+/), html: m[2] }))
  ok('9 schede «tessera COLORE scheda» in una griglia n-9', [art.length, art.every((a) => a.cl[0] === 'tessera' && a.cl.includes('scheda')), tessereDi(s?.html ?? '').some((c) => c.includes('n-9'))], [9, true, true])
  ok('colori: blu giallo inchiostro giallo inchiostro blu inchiostro blu giallo', art.map((a) => colore(a.cl)), ['blu', 'giallo', 'inchiostro', 'giallo', 'inchiostro', 'blu', 'inchiostro', 'blu', 'giallo'])
  ok('la prima ha la foto nel riquadro, caricata in ritardo', /<div class="scheda-foto"><img\b[^>]*loading="lazy"[^>]*>/.test(art[0]?.html ?? ''), true)
  ok('la foto è quella scritta', (art[0]?.html ?? '').includes(F.FOTO.judo), true)
  ok('le schede con foto sono 5 (Judo, Lotta, Aikido, Prep. atletica, Giocomotricità) e ognuna ne ha una sola', art.map((a) => conta(a.html, /<img\b/g)), [1, 1, 1, 0, 0, 1, 1, 0, 0])
  const senza = art.filter((a) => conta(a.html, /<img\b/g) === 0)
  ok('senza foto: riquadro «scheda-foto senza-foto» con l’iniziale nascosta a chi legge', senza.map((a) => a.html.match(/<div class="scheda-foto senza-foto"><span aria-hidden="true">([^<]*)<\/span><\/div>/)?.[1]), ['P', 'M', 'A', 'S'])
  ok('il titolo è un link verso la pagina del corso', art.map((a) => a.html.match(/<h3><a href="([^"]*)"[^>]*>([^<]*)<\/a><\/h3>/)?.slice(1)).slice(0, 3), [['/judo/', 'Judo'], ['/lotta/', 'Lotta'], ['/aikido/', 'Aikido']])
  ok('età e descrizione sono due paragrafi', [/<p class="eta">Dai 7 anni agli adulti<\/p>\s*<p>Tecnica, disciplina e rispetto per crescere sul tatami, dai primi passi fino alle gare\.<\/p>/.test(art[0]?.html ?? ''), /<p class="eta">Da 3 a 5 anni<\/p>/.test(art[6]?.html ?? '')], [true, true])
  const past = (a) => [...((a?.html ?? '').match(/<ul class="pastiglie">([\s\S]*?)<\/ul>/)?.[1] ?? '').matchAll(/<li>([\s\S]*?)<\/li>/g)].map((m) => testo(m[1]))
  ok('le pastiglie sono le fasce, nell’ordine scritto', [past(art[0]), past(art[2]), past(art[3])], [['Bambini', 'Adulti', 'Agonisti'], ['Bambini', 'Adulti', 'Anziani'], ['Adulti']])
  ok('il corsivo delle fasce non resta nel testo', art.some((a) => /<em>/.test(a.html)), false)
  const dueFoto = home(F.TESTO_NUOVO.replace(`<p>Dai 7 anni agli adulti</p><p>Tecnica`, `<p>Dai 7 anni agli adulti</p><img src="${F.P}${F.FOTO.lotta}" alt="x" /><p>Tecnica`))
  ok('con due foto nella scheda se ne tiene una: la prima', conta((sezDi(dueFoto, 'I nostri corsi')?.html ?? '').match(/<article[\s\S]*?<\/article>/)?.[0] ?? '', /<img\b/g), 1)
  const unoSenzaLink = home(F.TESTO_NUOVO.replace('<h3><a href="/aikido/">Aikido</a></h3>', '<h3>Aikido</h3>'))
  ok('se un titolo non ha il link non sono schede dei corsi', /class="tessera [a-z]+ scheda"/.test(sezDi(unoSenzaLink, 'I nostri corsi')?.html ?? ''), false)
}

console.log('\n4. Perché unirti a noi: quattro tessere numerate')
{
  const s = sezDi(H, 'Perché unirti a noi?')
  const art = [...(s?.html ?? '').matchAll(/<article class="([^"]*)">([\s\S]*?)<\/article>/g)].map((m) => ({ cl: m[1].split(/\s+/), html: m[2] }))
  ok('tessere n-4 perche', tessereDi(s?.html ?? '').find((c) => c.includes('perche')), ['tessere', 'n-4', 'perche'])
  ok('colori: giallo blu inchiostro giallo', art.map((a) => colore(a.cl)), ['giallo', 'blu', 'inchiostro', 'giallo'])
  ok('il numero 1-4 è decorativo (aria-hidden)', art.map((a) => a.html.match(/aria-hidden="true">\s*(\d)\s*</)?.[1]), ['1', '2', '3', '4'])
  ok('titolo e testo di ogni tessera', art.map((a) => [a.html.match(/<h3>([^<]*)<\/h3>/)?.[1], /<p>[^<]{20,}<\/p>/.test(a.html)]), [['La crescita viene prima del risultato', true], ['Educazione sportiva, prima di tutto', true], ['Un ambiente sicuro e stimolante', true], ['Attività agonistiche con svariati podi ogni anno', true]])
  ok('nessuna foto, nessuna fascia di foto', [/<img\b/.test(s?.html ?? ''), /foto-fila/.test(s?.html ?? '')], [false, false])
  ok('l’apertura resta un paragrafo sopra le tessere', (s?.html ?? '').indexOf('Qui lo sport è un percorso condiviso') < (s?.html ?? '').indexOf('class="tessere'), true)
  const lungo = 'Parola '.repeat(120).trim() + '.'
  const l = sezDi(home(F.TESTO_NUOVO.replace('Contano i progressi di ciascuno, a ogni età e livello. I risultati arrivano di conseguenza.', lungo)), 'Perché unirti a noi?')
  ok('un testo lungo non si taglia', testo(l?.html ?? '').includes(lungo), true)
}

console.log('\n5. Citazioni: estratto e «Leggi tutto»')
{
  const s = sezDi(H, 'Lo sport secondo chi lo studia')
  const cit = [...(s?.html ?? '').matchAll(/<(blockquote|article) class="([^"]*\bcitazione\b[^"]*)">([\s\S]*?)<\/\1>/g)].map((m) => ({ cl: m[2].split(/\s+/), html: m[3] }))
  ok('tre tessere n-3 estratti, senza carosello', [tessereDi(s?.html ?? '').find((c) => c.includes('estratti')), /class="citazioni"/.test(s?.html ?? ''), cit.length], [['tessere', 'n-3', 'estratti'], false, 3])
  ok('l’estratto è il primo paragrafo, uguale a quello scritto', cit.map((c) => testo(c.html.match(/<p class="estratto">([\s\S]*?)<\/p>/)?.[1] ?? '')), [F.ESTRATTO_SERENA, F.ESTRATTO_MARIA, F.ESTRATTO_RINALDO])
  ok('«Leggi tutto» c’è solo dove la segreteria ha scritto il testo intero (Serena e Rinaldo)', cit.map((c) => /<details class="intero">\s*<summary>Leggi tutto<\/summary>/.test(c.html)), [true, false, true])
  const intero = (c) => testo(((c?.html ?? '').match(/<details class="intero">([\s\S]*?)<\/details>/)?.[1] ?? '').replace(/<summary>[\s\S]*?<\/summary>/, ''))
  ok('dentro il details c’è il testo intero, uguale a quello scritto', [intero(cit[0]), intero(cit[2])], [F.INTERO_SERENA, F.INTERO_RINALDO])
  ok('il details è chiuso e l’estratto sta fuori', [/<details[^>]*\bopen\b/.test(s?.html ?? ''), cit.map((c) => c.html.indexOf('class="estratto"') < c.html.indexOf('<details') || !c.html.includes('<details'))], [false, [true, true, true]])
  ok('la firma ha UNA iniziale (S, M, R) e il nome', cit.map((c) => [c.html.match(/<span class="avatar" aria-hidden="true">([^<]*)<\/span>/)?.[1], testo(c.html.match(/<p class="firma">([\s\S]*?)<\/p>/)?.[1] ?? '').replace(/^\S\s/, '')]), [['S', 'Serena - Stud. di Medicina'], ['M', 'Maria - Psicologa'], ['R', 'Rinaldo - Prof. di Ed. Fisica']])
  ok('la firma è in corsivo, come l’ha scritta la segreteria', cit.map((c) => /<p class="firma">[\s\S]*<em>[\s\S]*<\/em>/.test(c.html)), [true, true, true])
  const una = home(F.TESTO_NUOVO.replace(/<blockquote>.*?<\/blockquote><blockquote><p>Facendo.*?<\/blockquote><blockquote><p>Il judo.*?<\/blockquote>/, `<blockquote><p>${F.ESTRATTO_MARIA}</p><p><em>Maria - Psicologa</em></p></blockquote>`))
  ok('una sola citazione non è una fila di estratti', /estratti/.test(sezDi(una, 'Lo sport secondo chi lo studia')?.html ?? ''), false)
}

console.log('\n6. Recensioni: due carte larghe e «In breve»')
{
  const s = sezDi(H, 'Cosa dicono di noi')
  const div = s?.html.match(/<div class="([^"]*\brecensioni\b[^"]*)">([\s\S]*)<\/div>/)
  const cit = [...(div?.[2] ?? '').matchAll(/<(blockquote|article) class="([^"]*\bcitazione\b[^"]*)">([\s\S]*?)<\/\1>/g)].map((m) => ({ cl: m[2].split(/\s+/), html: m[3] }))
  ok('un contenitore «recensioni»', Boolean(div), true)
  ok('due carte «tessera citazione larga», col testo intero e la firma', [cit.length, cit.every((c) => ['tessera', 'citazione', 'larga'].every((k) => c.cl.includes(k))), cit.map((c) => testo(c.html.match(/<p>([\s\S]*?)<\/p>/)?.[1] ?? ''))], [2, true, [F.NICOLA, F.NANDO]])
  ok('la firma ha una iniziale: N e N (Nicola A., Nando)', cit.map((c) => c.html.match(/<span class="avatar" aria-hidden="true">([^<]*)<\/span>/)?.[1]), ['N', 'N'])
  const breve = (div?.[2] ?? '').match(/<(div|aside|article|section) class="([^"]*\bin-breve\b[^"]*)">([\s\S]*?)<\/\1>/)
  ok('una scheda «in-breve» con le tre frasi e i tre nomi, nell’ordine scritto', [...(breve?.[3] ?? '').matchAll(/<li>([\s\S]*?)<\/li>/g)].map((m) => testo(m[1])), F.IN_BREVE.map(([f, n]) => `${f} ${n}`))
  ok('«In breve» viene dopo le due carte larghe', (div?.[2] ?? '').indexOf('in-breve') > (div?.[2] ?? '').lastIndexOf('larga'), true)
  ok('nessuna stella né fonte inventate', /★|☆|stell|google|facebook|⭐/i.test(s?.html ?? ''), false)
  ok('niente «Leggi tutto» né estratti nelle recensioni', /<details|estratti/.test(s?.html ?? ''), false)
  ok('refusi lasciati come sono («x chi»)', (s?.html ?? '').includes('è ideale x chi si avvicina'), true)
  const sole = sezDi(home(F.TESTO_NUOVO.replace(F.RECENSIONI, F.RECENSIONI_SOLE)), 'Cosa dicono di noi')
  ok('senza «In breve» sono carte normali: niente «recensioni» né «in-breve»', [/recensioni|in-breve/.test(sole?.html ?? ''), conta(sole?.html ?? '', /<blockquote|<article[^>]*citazione/g)], [false, 2])
}

console.log('\n7. Le domande')
{
  const s = sezDi(H, 'Hai qualche domanda?')
  const art = [...(s?.html ?? '').matchAll(/<article class="([^"]*)">([\s\S]*?)<\/article>/g)].map((m) => ({ cl: m[1].split(/\s+/), html: m[2] }))
  ok('cinque tessere chiare in una griglia n-5', [art.length, art.every((a) => a.cl.includes('tessera') && a.cl.includes('chiara')), tessereDi(s?.html ?? '').some((c) => c.includes('n-5'))], [5, true, true])
  ok('domande e risposte per intero, nell’ordine scritto', art.map((a) => [a.html.match(/<h3>([^<]*)<\/h3>/)?.[1], testo(a.html.replace(/<h3>[\s\S]*?<\/h3>/, ''))]), F.DOMANDE)
  ok('le risposte si vedono sempre: niente details', /<details|<summary/.test(s?.html ?? ''), false)
  ok('la frase sotto il titolo resta sopra le tessere', (s?.html ?? '').indexOf('Qui trovi le informazioni principali') < (s?.html ?? '').indexOf('class="tessere'), true)
}

console.log('\n8. La chiamata finale')
{
  const tutte = sezioni(M)
  const ultima = tutte[tutte.length - 1]
  ok('l’ultima sezione è «sezione cta»; è l’unica', [ultima?.classi.includes('sezione'), ultima?.classi.includes('cta'), tutte.filter((s) => s.classi.includes('cta')).length], [true, true, 1])
  ok('titolo, testo con l’indirizzo e la metro', [testo(ultima?.html.match(/<h2[^>]*>[\s\S]*?<\/h2>/)?.[0] ?? ''), testo(ultima?.html ?? '').includes('Via Vittorio Sassi 26, Collegno, vicino alla metro Fermi')], ['Una settimana per scegliere.', true])
  const pul = [...(ultima?.html.match(/<div class="pulsanti">([\s\S]*?)<\/div>/)?.[1] ?? '').matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].map((m) => [classi(m[1]), m[1].match(/href="([^"]*)"/)?.[1], testo(m[2])])
  ok('i pulsanti: il primario verso l’iscrizione, poi Scrivici', pul, [[['pulsante', 'primario'], F.ISCRIZIONE, 'Prova una settimana a 5 €'], [['pulsante', 'secondario'], '/contatti/', 'Scrivici']])
  ok('la foto degli istruttori sta nella sezione', [conta(ultima?.html ?? '', /<img\b/g), (ultima?.html ?? '').includes(F.FOTO.istruttori)], [1, true])
  const senza = sezioni(main(home(F.TESTO_NUOVO.replace(F.CTA(), F.CTA(false))))).pop()
  ok('senza la foto resta «cta», a una colonna', [senza?.classi.includes('cta'), senza?.classi.includes('solo'), conta(senza?.html ?? '', /<img\b/g)], [true, true, 0])
  const ultimaFaq = sezioni(main(home(F.INTRO + F.CORSI + F.FAQ))).pop()
  ok('una sezione senza link all’iscrizione non è mai «cta»', ultimaFaq?.classi.includes('cta'), false)
}

console.log('\n9. Testata e piede di ogni pagina')
{
  const tutte = genera(F.datiVecchi())
  const test = (h) => h.match(/<header class="testata">[\s\S]*?<\/header>/)?.[0] ?? ''
  const primario = new RegExp(`<a class="pulsante primario" href="${F.ISCRIZIONE.replace(/[./]/g, '\\$&')}"[^>]*>Prova una settimana a 5 €</a>`)
  for (const [nome, h] of [['Home', tutte['index.html']], ['Corsi', tutte['corsi/index.html']], ['Contatti', tutte['contatti/index.html']], ['404', tutte['404.html']]]) {
    const t = test(h)
    ok(`${nome}: il pulsante «Prova una settimana a 5 €» è primario e intero (niente «estensione»)`, [primario.test(t), /estensione/.test(t)], [true, false])
    ok(`${nome}: «Scrivici» secondario verso Contatti`, /<a class="pulsante secondario" href="\/contatti\/"[^>]*>Scrivici<\/a>/.test(t), true)
    ok(`${nome}: sul telefono MENU apre #menu, senza script`, [/<a class="tasto-menu" href="#menu">MENU<\/a>/.test(t), /<nav\b[^>]*\bid="menu"/.test(t), /<script(?![^>]*application\/ld\+json)/i.test(h)], [true, true, false])
    const nav = t.match(/<nav\b[^>]*\bid="menu"[^>]*>([\s\S]*?)<\/nav>/)?.[1] ?? ''
    ok(`${nome}: il menu aperto ha «Chiudi» e poi le voci`, /<a [^>]*href="#"[^>]*>Chiudi<\/a>/.test(nav), true)
    ok(`${nome}: nel menu aperto il pulsante primario viene dopo le voci (con tutto in una riga non si capiva cosa fosse cosa)`, nav.indexOf('>Corsi<') >= 0 && nav.indexOf('>Corsi<') < nav.indexOf('pulsante primario'), true)
  }
  const senzaContatti = genera(F.dati(F.TESTO_NUOVO, { conContatti: false }))['index.html']
  ok('senza la pagina Contatti non c’è «Scrivici» in testata', [/Scrivici/.test(test(senzaContatti)), primario.test(test(senzaContatti))], [false, true])
  const piede = (h) => h.match(/<footer class="piede">[\s\S]*<\/footer>/)?.[0] ?? ''
  const pi = piede(tutte['index.html'])
  ok('il piede ha l’indirizzo e il riferimento alla metro, senza minuti', [pi.includes('Via Vittorio Sassi 26, Collegno'), pi.includes('vicino alla metro Fermi'), /minut/i.test(pi)], [true, true, false])
  ok('il piede ha lo stesso numero di voci di prima', conta(pi, /<li/g), snapshot.piedeLi)
  ok('il piede ha l’indirizzo anche nelle altre pagine', piede(tutte['corsi/index.html']).includes('vicino alla metro Fermi'), true)
}

console.log('\n13. Il testo pronto in docs/sito/home.html è una Home nuova completa')
{
  const html = readFileSync('docs/sito/home.html', 'utf8').replace(/^<!doctype[^>]*>\s*<meta[^>]*>\s*<title>.*?<\/title>\s*/s, '')
  const md = readFileSync('docs/sito/home.md', 'utf8')
  const titolo = md.match(/## Titolo\s+(.+)/)?.[1] ?? ''
  const frase = md.match(/## Descrizione\s+(.+)/)?.[1] ?? ''
  const h = genera({ dominio: F.DOMINIO, pagine: [{ slug: 'home', titolo, descrizione: frase, testo: html }, { slug: 'contatti', titolo: 'Contatti', descrizione: 'd', testo: '<p>x</p>' }], menu: [], rinvii: [], ospitiImmagini: [F.OSPITE_VECCHIO] })['index.html'] ?? ''
  ok('è riconosciuta come Home nuova, con il titolo e la frase di home.md', [/<main class="passo-unico">/.test(h), h.includes(`<h1>${titolo}</h1>`), h.includes(frase)], [true, true, true])
  ok('4 numeri, 9 schede, 3 citazioni col «Leggi tutto», 2 recensioni, 5 domande, la chiamata finale', [conta(h, /tessera [a-z]+ numero/g), conta(h, /<article class="tessera [a-z]+ scheda">/g), conta(h, /<details class="intero">/g), conta(h, /citazione [a-z]+ larga/g), conta(h, /<article class="tessera chiara">/g), /<section class="sezione cta">/.test(h)], [4, 9, 3, 2, 5, true])
  ok('i due pulsanti: prova primo, Scrivici secondo, in testata, hero e chiamata finale', conta(h, /class="pulsante primario"[^>]*>Prova una settimana a 5 €<\/a><a class="pulsante secondario" href="\/contatti\/"[^>]*>Scrivici/g), 3)
  ok('tutte le foto sono del contenitore delle immagini', [...h.matchAll(/<img[^>]*src="([^"]+)"/g)].every((m) => m[1].startsWith(F.OSPITE_VECCHIO) || m[1].startsWith('/')), true)
}

console.log('\n14. Niente testo si perde in silenzio')
{
  const corsoTre = F.TESTO_NUOVO.replace('<p>Dai 7 anni agli adulti</p>\n', '<p>Dai 7 anni agli adulti</p>').replace('<p>Dai 7 anni agli adulti</p>', '<p>Dai 7 anni agli adulti</p><p>Paragrafo di mezzo da non perdere.</p>')
  ok('una scheda con tre paragrafi li tiene tutti', [testo(home(corsoTre)).includes('Paragrafo di mezzo da non perdere.'), /<p class="eta">Dai 7 anni agli adulti<\/p>/.test(home(corsoTre))], [true, true])
  const soloFirma = F.TESTO_NUOVO.replace(/<blockquote><p>Facendo sport/, '<blockquote><p><em>Solo una firma</em></p></blockquote><blockquote><p>Facendo sport')
  const hf = home(soloFirma)
  ok('un blockquote con la sola riga in corsivo non lascia un estratto vuoto con le virgolette', /<p class="estratto"><\/p>/.test(hf), false)
  ok('…e il testo di quella riga c’è ancora', testo(hf).includes('Solo una firma'), true)
  const firmaDoppia = F.TESTO_NUOVO.replace('<p><em>Maria - Psicologa</em></p>', '<p><em>Maria</em> - e poi <em>Psicologa</em></p>')
  ok('una riga con due corsivi e testo in mezzo non è una firma', />MP<|class="firma"><span class="avatar" aria-hidden="true">M<\/span><span class="nome"><em>Maria<\/em> - e poi/.test(home(firmaDoppia)), false)
  const pPrima = F.TESTO_NUOVO.replace('<h2>Lo sport secondo chi lo studia</h2>', '<h2>Lo sport secondo chi lo studia</h2><p>Una frase prima delle citazioni.</p>')
  ok('un paragrafo prima delle citazioni non sparisce', testo(home(pPrima)).includes('Una frase prima delle citazioni.'), true)
  const ulInIntro = F.TESTO_NUOVO.replace('<h2>Perché unirti a noi?</h2>', '<h2>Perché unirti a noi?</h2><ul><li>Voce dell’elenco</li><li>Altra voce</li></ul>')
  ok('un elenco prima dei quattro motivi non sparisce', testo(home(ulInIntro)).includes('Voce dell’elenco'), true)
}

console.log(guai ? `\n✗ ${guai} casi falliti` : '\nTutto a posto.')
process.exit(guai ? 1 : 0)
