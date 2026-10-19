// ---------------------------------------------------------------------------
// La pagina Contatti rivista (testo di docs/sito/contatti.html), senza browser.
//
//   node scripts/prova-sito-contatti-nuova.mjs
//
// Il testo nuovo si riconosce dal pulsante verso il modulo di iscrizione PRIMA del primo titolo
// grande; senza, la pagina resta quella di prima (prova-sito-contatti.mjs). Qui la struttura,
// i casi limite e le misure del CSS (a 1440, 768 e 375 px). Sempre da `generaSito`.
// ---------------------------------------------------------------------------
import { build } from 'esbuild'
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

let guai = 0
const ok = (cosa, avuto, voluto) => {
  const va = JSON.stringify(avuto) === JSON.stringify(voluto)
  console.log(va ? '  ✓' : '  ✗', cosa, va ? '' : `— atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`)
  if (!va) guai++
}

const P = 'https://abc.supabase.co/storage/v1/object/public/sito/'
const MODULO = 'https://app.officinedellosport.it/iscrizioni/'
const WA = 'https://wa.me/393463292786'
const NUOVO = readFileSync('docs/sito/contatti.html', 'utf8')
  .replace(/<!doctype[^>]*>\s*|<meta[^>]*>\s*|<title>.*?<\/title>\s*/gis, '')
  .replace(/https:\/\/[^"]*DA-CARICARE-contatti-(\w+)\.jpg/g, `${P}contatti-$1.jpg`)
const FOTO2 = NUOVO.match(/<img src="[^"]*contatti-lezione[^>]*>\s*<img src="[^"]*contatti-sala[^>]*>/)[0]
const foto = (k) => Array.from({ length: k }, (_, i) => `<img src="${P}contatti-f${i + 1}.jpg" alt="Foto ${i + 1}" />`).join('')
const conFoto = (k) => NUOVO.replace(FOTO2, foto(k))

// Il testo di prima (stesso di prova-sito-contatti.mjs).
const img1 = (n) => `<img src="${P}f${n}.jpg" alt="Foto ${n}" />`
const VECCHIO =
  '<h3>Telefono</h3><p>346 329 2786</p><h3>Instagram</h3><p>officine.dellosport</p><h3>Facebook</h3><p>Officine dello Sport</p>' +
  '<h3>Indirizzo</h3><p>Via Vittorio Sassi 26, Collegno</p><p>A pochi metri dalla metropolitana Fermi</p>' +
  `${img1(1)}<p><a class="pulsante" href="https://maps.example/x">Ottieni indicazioni</a></p><p>A pochi metri dalla metropolitana Fermi</p>${img1(2)}${img1(3)}${img1(4)}` +
  '<h2>Hai qualche domanda?</h2><p>Qui trovi le informazioni.</p>' + [1, 2, 3, 4, 5, 6].map((n) => `<h3>Domanda ${n}?</h3><p>Risposta ${n}</p>`).join('')

const dati = (testo, extra = {}) => ({
  dominio: 'https://officinedellosport.it',
  pagine: [
    { slug: 'home', titolo: 'Home', descrizione: 'd', testo: '<h2>Corsi</h2><p>Testo della Home.</p>' },
    { slug: 'contatti', titolo: 'Contatti', descrizione: 'Dove siamo e come scriverci.', testo },
    { slug: 'corsi', titolo: 'Corsi', descrizione: 'd', testo: '<h2>Tutti</h2><h3>Judo</h3><p>x</p>' },
  ],
  menu: [], rinvii: [], ospitiImmagini: [P], ...extra,
})
const gen = (testo) => g.generaSito(dati(testo))
const pag = (testo) => gen(testo)['contatti/index.html'] ?? ''
const main = (h) => h.match(/<main([^>]*)>([\s\S]*)<\/main>/)?.[2] ?? ''
const mainTag = (h) => h.match(/<main([^>]*)>/)?.[1] ?? ''
const conta = (x, re) => (x.match(re) || []).length
const testo = (h) => h.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
const classi = (attr) => (attr.match(/class="([^"]*)"/)?.[1] ?? '').split(/\s+/).filter(Boolean)
const sezioni = (m) => [...m.matchAll(/<section\b([^>]*)>([\s\S]*?)<\/section>/g)].map((x) => ({ classi: classi(x[1]), html: x[2] }))
const articoli = (html) => [...html.matchAll(/<article class="([^"]*)">([\s\S]*?)<\/article>/g)].map((m) => ({ cl: m[1].split(/\s+/), html: m[2] }))
const links = (html) => [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].map((m) => ({ cl: classi(m[1]), href: m[1].match(/href="([^"]*)"/)?.[1], rel: m[1].match(/rel="([^"]*)"/)?.[1], t: testo(m[2]) }))
const nuova = (h) => classi(mainTag(h)).includes('contatti-nuova')

const H = pag(NUOVO)
const M = main(H)
const S = sezioni(M)
const hero = S.find((s) => s.classi.includes('pagina-hero'))
const arrivare = S.find((s) => s.classi.includes('arrivare'))
const sceglie = S.find((s) => /Una settimana per scegliere/.test(s.html))
const domande = S.find((s) => /Hai qualche domanda/.test(s.html))

console.log('\n1. Quando Contatti è «nuova», e quando resta com’era')
{
  ok('con il pulsante verso il modulo prima del primo titolo: contatti-nuova passo-unico, non pagina-contatti', [classi(mainTag(H)), classi(mainTag(H)).includes('pagina-contatti')], [['contatti-nuova', 'passo-unico'], false])
  const v = pag(VECCHIO)
  ok('il testo di prima ha ancora <main class="pagina-contatti">', [mainTag(v), nuova(v)], [' class="pagina-contatti"', false])
  const dopo = pag(VECCHIO + `<h2>Un altro titolo</h2><p><a class="pulsante" href="${MODULO}">Prova</a></p>`)
  ok('un pulsante verso il modulo DOPO il primo titolo non basta', [mainTag(dopo), nuova(dopo)], [' class="pagina-contatti"', false])
  const altro = pag(`<p><a class="pulsante" href="${WA}">Scrivici</a></p>` + VECCHIO)
  ok('un pulsante verso un altro indirizzo non basta', nuova(altro), false)
  const www = pag(NUOVO.replace(MODULO, 'http://www.app.officinedellosport.it/iscrizioni'))
  ok('il modulo scritto con http://www e senza «/» finale si riconosce, e il primario ha l’indirizzo canonico', [nuova(www), links(main(www)).find((l) => l.cl.includes('primario'))?.href], [true, MODULO])
  const a = gen(NUOVO)
  const b = gen(VECCHIO)
  ok('Home e Corsi identiche a prima (stessa pagina, qualunque testo di Contatti)', [a['index.html'] === b['index.html'], a['corsi/index.html'] === b['corsi/index.html']], [true, true])
  ok('la pagina nuova non ha classi «pagina-contatti» né «apertura»', /pagina-contatti|sezione apertura/.test(M), false)
}

console.log('\n2. La testata: prova (primario) e Scrivici (secondario)')
{
  const pul = hero?.html.match(/<div class="pulsanti">([\s\S]*?)<\/div>/)?.[1] ?? ''
  const l = links(pul)
  ok('sezione «pagina-hero con-pulsanti solo» con h1 e descrizione', [hero?.classi, /<h1>Contatti<\/h1>/.test(hero?.html ?? ''), (hero?.html ?? '').includes('Dove siamo e come scriverci.')], [['pagina-hero', 'con-pulsanti', 'solo'], true, true])
  ok('due pulsanti: primario verso il modulo, poi Scrivici secondario verso WhatsApp', l.map((x) => [x.cl, x.href, x.t]), [[['pulsante', 'primario'], MODULO, 'Iscriviti'], [['pulsante', 'secondario'], WA, 'Scrivici']])
  ok('Scrivici apre in sicurezza: rel noopener noreferrer', l[1]?.rel?.split(/\s+/).sort(), ['noopener', 'noreferrer'])
  const scambiati = pag(NUOVO.replace(/^<p>.*?<\/p>/, `<p><a class="pulsante" href="${WA}">Scrivici</a> <a class="pulsante" href="${MODULO}">Prova una settimana a 5 €</a></p>`))
  const ls = links(main(scambiati).match(/<div class="pulsanti">([\s\S]*?)<\/div>/)?.[1] ?? '')
  ok('il primario è primo anche se scritto dopo', ls.map((x) => x.cl[1]), ['primario', 'secondario'])
  const solo = pag(NUOVO.replace(/^<p>.*?<\/p>/, `<p><a class="pulsante" href="${MODULO}">Prova una settimana a 5 €</a></p>`))
  const lo = links(main(solo).match(/<div class="pulsanti">([\s\S]*?)<\/div>/)?.[1] ?? '')
  ok('con un solo pulsante esce solo quello', [nuova(solo), lo.map((x) => x.cl[1])], [true, ['primario']])
  // Un secondo paragrafo di pulsanti prima dei recapiti non va in testata, ma non sparisce.
  const due = pag(NUOVO.replace(/^(<p>.*?<\/p>)/, `$1<p><a class="pulsante" href="https://esempio.it/altro">Un altro invito</a></p>`))
  ok('un secondo paragrafo di pulsanti resta nella pagina', [nuova(due), main(due).includes('Un altro invito')], [true, true])
}

console.log('\n3. I recapiti: quattro tessere cliccabili')
{
  const sez = S.find((s) => s.classi.includes('recapiti-sez'))
  const gr = sez?.html.match(/<div class="tessere n-4 recapiti">([\s\S]*)<\/div>/)?.[1] ?? ''
  const t = articoli(gr)
  ok('«recapiti-sez» con una griglia «tessere n-4 recapiti» di 4 tessere', [Boolean(sez), t.length], [true, 4])
  ok('colori: giallo, blu, inchiostro, chiara; la prima è «breve»', t.map((x) => x.cl.slice(1)), [['giallo', 'breve'], ['blu'], ['inchiostro'], ['chiara']])
  ok('titoli: Telefono, Instagram, Facebook, Indirizzo', t.map((x) => x.html.match(/<h3>([^<]*)<\/h3>/)?.[1]), ['Telefono', 'Instagram', 'Facebook', 'Indirizzo'])
  ok('il valore è un paragrafo', t.map((x) => testo(x.html.match(/<p>([\s\S]*?)<\/p>/)?.[1] ?? '')), ['346 329 2786', '@officine.dellosport', 'Officine dello Sport', 'Via Vittorio Sassi 26, Collegno'])
  const az = t.map((x) => links(x.html.match(/<div class="azione">([\s\S]*?)<\/div>/)?.[1] ?? ''))
  ok('ogni azione è un solo link dentro div.azione; Telefono: tel:+393463292786', [az.map((a) => a.length), az[0]?.[0]?.href, az[0]?.[0]?.t], [[1, 1, 1, 1], 'tel:+393463292786', 'Chiama ora →'])
  ok('Instagram, Facebook e indicazioni vanno ai loro indirizzi', az.slice(1).map((a) => a[0]?.href?.replace(/\?.*/, '')), ['https://www.instagram.com/officine.dellosport/', 'https://www.facebook.com/ilCentroJudo/', 'https://www.google.com/maps/dir/'])
  ok('i link esterni delle tessere hanno rel noopener noreferrer', az.slice(1).map((a) => a[0]?.rel?.split(/\s+/).sort()), [['noopener', 'noreferrer'], ['noopener', 'noreferrer'], ['noopener', 'noreferrer']])
  ok('il testo del link non resta anche fuori dal div.azione', t.map((x) => testo(x.html.replace(/<div class="azione">[\s\S]*?<\/div>/, '')).includes('→')), [false, false, false, false])
}

console.log('\n4. Come arrivare: mappa e tre modi')
{
  const h2 = arrivare?.html.match(/<h2[^>]*>([\s\S]*?)<\/h2>/)?.[1]
  const arrivo = arrivare?.html.match(/<div class="arrivo">([\s\S]*)<\/div>\s*$/)?.[1] ?? arrivare?.html.match(/<div class="arrivo">([\s\S]*)/)?.[1] ?? ''
  ok('«sezione arrivare» con h2 «Come arrivare», intro in div.colonna e div.arrivo', [arrivare?.classi.slice(0, 2), h2, /<div class="colonna">[\s\S]*Via Vittorio Sassi 26, a Collegno\./.test(arrivare?.html ?? ''), Boolean(arrivo)], [['sezione', 'arrivare'], 'Come arrivare', true, true])
  const fig = arrivo.match(/<figure class="([^"]*)">([\s\S]*?)<\/figure>/)
  ok('una figure «tessera foto larga mappa»', fig?.[1].split(/\s+/), ['tessera', 'foto', 'larga', 'mappa'])
  const im = fig?.[2].match(/<img\b[^>]*>/)?.[0] ?? ''
  ok('l’immagine è quella interna, con larghezza e altezza (1344×520)', [/src="\/risorse\/mappa\.webp"/.test(im), /width="1344"/.test(im), /height="520"/.test(im)], [true, true, true])
  ok('segnaposto, targhetta con nome e indirizzo, credito OpenStreetMap', [/<span class="segnaposto" aria-hidden="true"><\/span>/.test(fig?.[2] ?? ''), /<span class="targhetta">Officine dello Sport<span>Via Vittorio Sassi 26, Collegno<\/span><\/span>/.test(fig?.[2] ?? ''), /<span class="credito">© OpenStreetMap contributors<\/span>/.test(fig?.[2] ?? '')], [true, true, true])
  const az = links(fig?.[2].match(/<div class="mappa-azioni">([\s\S]*?)<\/div>/)?.[1] ?? '')
  ok('in div.mappa-azioni un solo pulsante primario «Ottieni indicazioni» verso Google Maps, in sicurezza', [az.length, az[0]?.cl, az[0]?.t, az[0]?.href?.startsWith('https://www.google.com/maps/dir/'), az[0]?.rel?.split(/\s+/).sort()], [1, ['pulsante', 'primario'], 'Ottieni indicazioni', true, ['noopener', 'noreferrer']])
  const righe = articoli(arrivo.replace(/<figure[\s\S]*?<\/figure>/, '')).filter((a) => a.cl.includes('arrivo-riga'))
  ok('div.arrivi con 3 «tessera arrivo-riga»', [/<div class="arrivi">/.test(arrivo), righe.length, righe.every((r) => r.cl.includes('tessera'))], [true, 3, true])
  ok('sigla = iniziale dell’ultima parola del titolo: M, A, N', righe.map((r) => r.html.match(/<span class="sigla"[^>]*>([^<]*)<\/span>/)?.[1]), ['M', 'A', 'N'])
  ok('titoli e testo: In metro, In auto, Col navigatore', righe.map((r) => [r.html.match(/<h3>([^<]*)<\/h3>/)?.[1], /<p>[^<]+<\/p>/.test(r.html)]), [['In metro', true], ['In auto', true], ['Col navigatore', true]])
  ok('«vicino alla metro Fermi» c’è e il segnaposto [C5: dove si parcheggia] esce com’è', [H.includes('vicino alla metro Fermi'), righe[1]?.html.includes('[C5: dove si parcheggia]')], [true, true])
  const senzaMappa = pag(NUOVO.replace(/<img src="\/risorse\/mappa\.webp"[^>]*>/, ''))
  const ms = main(senzaMappa)
  ok('senza immagine la pagina non si rompe e le sezioni dopo restano', [nuova(senzaMappa), /Una settimana per scegliere/.test(ms), /Hai qualche domanda/.test(ms), /class="tessera foto larga mappa"/.test(ms)], [true, true, true, false])
  ok('…e nessun testo si perde (metro, auto, navigatore, intro)', ['In metro', 'In auto', 'Col navigatore', 'Via Vittorio Sassi 26, a Collegno.'].map((x) => testo(ms).includes(x)), [true, true, true, true])
}

console.log('\n5. Una settimana per scegliere: tre passi numerati')
{
  const gr = sceglie?.html.match(/<div class="tessere n-3 perche">([\s\S]*?)<\/div>/)?.[1] ?? ''
  const t = articoli(gr)
  ok('div.tessere.n-3.perche con 3 tessere numerate 1, 2, 3', [t.length, t.map((x) => x.html.match(/<span class="numero-perche"[^>]*>\s*(\d)\s*<\/span>/)?.[1])], [3, ['1', '2', '3']])
  ok('titoli e testi per intero', t.map((x) => [x.html.match(/<h3>([^<]*)<\/h3>/)?.[1], testo(x.html.replace(/<h3>[\s\S]*?<\/h3>/, '')).length > 40]), [['Prenota online', true], ['Scrivici o chiamaci', true], ['Passa in sede', true]])
  ok('la frase di apertura resta sopra le tessere', (sceglie?.html ?? '').indexOf('Tre modi per cominciare') < (sceglie?.html ?? '').indexOf('class="tessere'), true)
  const due = NUOVO.replace(/<h3>Passa in sede<\/h3>\s*<p>[^<]*<\/p>/, '')
  const quattro = NUOVO.replace(FOTO2, '<h3>Quarto modo</h3><p>Un quarto modo di cominciare, scritto per intero.</p>' + FOTO2)
  for (const [n, tx] of [[2, due], [4, quattro]]) {
    const h = pag(tx)
    ok(`con ${n} gruppi cade nella sezione generica (niente «perche»), senza perdere testo`, [/numero-perche|tessere n-3 perche/.test(main(h)), nuova(h), testo(main(h)).includes('Scrivici o chiamaci'), n === 4 ? testo(main(h)).includes('Un quarto modo di cominciare') : !testo(main(h)).includes('Passa in sede')], [false, true, true, true])
  }
  const conPunto = pag(NUOVO.replace('<h3>Prenota online</h3>', '<h3>Prenota online?</h3>'))
  ok('un titolo con «?» non è un passo: sezione generica', /numero-perche/.test(main(conPunto)), false)
  ok('niente «orari della segreteria» né «Quando trovarci»', [/orari della segreteria/i.test(H), /Quando trovarci/i.test(H)], [false, false])
}

console.log('\n6. Le foto in fondo: fuori dalla tessera')
{
  for (const k of [0, 1, 2, 3]) {
    const h = pag(conFoto(k))
    const m = main(h)
    const fc = m.match(/<div class="foto-contatti n-(\d)">([\s\S]*?)<\/div>\s*(?=<section|<\/main|$)/)
    const sc = sezioni(m).find((s) => /Una settimana per scegliere/.test(s.html))
    ok(`${k} foto: ${k ? `div.foto-contatti n-${k} con ${k} figure` : 'nessun div.foto-contatti'}, nessuna foto dentro le tessere`, [k ? [fc?.[1], conta(fc?.[2] ?? '', /<figure\b/g), conta(fc?.[2] ?? '', /<img\b/g)] : /foto-contatti/.test(m), conta(sc?.html ?? '', /<img\b/g)], [k ? [String(k), k, k] : false, 0])
    if (k) ok(`${k} foto: stanno dopo la sezione dei passi e prima delle domande, senza figure vuote`, [m.indexOf('foto-contatti') > m.indexOf('Passa in sede'), m.indexOf('foto-contatti') < m.indexOf('Hai qualche domanda'), /<figure[^>]*>\s*<\/figure>/.test(fc?.[2] ?? ''), fc?.[2].includes(`${P}contatti-f${k}.jpg`)], [true, true, false, true])
  }
  const h = pag(NUOVO)
  ok('il testo vero: le due foto (lezione, sala) escono in un div.foto-contatti n-2 con il loro alt', [conta(main(h), /<div class="foto-contatti n-2">/g), main(h).includes('Una lezione di judo'), main(h).includes('La sala attrezzata')], [1, true, true])
}

console.log('\n7. Le domande e i dati strutturati')
{
  const t = articoli(domande?.html ?? '')
  ok('«Hai qualche domanda?» è la sezione generica con 5 tessere', [domande?.classi.includes('sezione'), t.length, t.every((x) => x.cl.includes('tessera'))], [true, 5, true])
  const ld = [...H.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]))
  const faq = ld.flatMap((x) => x['@graph'] ?? [x]).find((x) => x['@type'] === 'FAQPage')
  const nomi = (faq?.mainEntity ?? []).map((q) => q.name)
  ok('il JSON-LD FAQPage ha 5 Question, con il nome degli h3 delle domande', [nomi.length, nomi], [5, t.map((x) => x.html.match(/<h3>([^<]*)<\/h3>/)?.[1])])
  ok('nessuna «In metro» né «Prenota online» tra le Question', nomi.filter((n) => /In metro|Prenota online/.test(n)), [])
}

console.log('\n8. Il testo: cosa non c’è più')
{
  ok('niente «pochi metri», «capolinea», «openingHours»', ['pochi metri', 'capolinea', 'openingHours'].map((x) => new RegExp(x, 'i').test(H)), [false, false, false])
  ok('i link esterni del <main> (tranne il modulo) hanno rel noopener noreferrer', links(M).filter((l) => /^https?:/.test(l.href ?? '') && !l.href.startsWith(MODULO)).every((l) => /noopener/.test(l.rel ?? '') && /noreferrer/.test(l.rel ?? '')), true)
}

// --- Il CSS come elenco di regole (stesso metodo di prova-sito-home-aspetto.mjs) ------------
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
function px(v, w) {
  if (v === undefined) return undefined
  const num = (t) => (/vw$/.test(t.trim()) ? (parseFloat(t) * w) / 100 : parseFloat(t))
  const c = v.match(/^clamp\(([^,]+),([^,]+),([^)]+)\)$/)
  if (c) return Math.round(Math.max(num(c[1]), Math.min(num(c[2]), num(c[3]))))
  return /^-?[\d.]+px$/.test(v) ? Math.round(parseFloat(v)) : v
}
const R = regole(stili(H))
const W = [1440, 768, 375]

console.log('\n9. Le misure (CSS) a 1440, 768 e 375 px')
{
  ok('h1: 120px a 1440 e a 768, come I corsi', [ultimo(R, /^\.contatti-nuova h1$/, 'font-size', 1440), px(ultimo(R, /^\.contatti-nuova h1$/, 'font-size', 1440), 1440)], ['120px', 120])
  ok('h1 a ≤900px: 56px', [768, 375].map((w) => px(ultimo(R, /^\.contatti-nuova h1$/, 'font-size', w), w)), [56, 56])
  ok('.recapiti-sez: padding-top 48px a 1440', [1440].map((w) => px(ultimo(R, /^\.recapiti-sez$/, 'padding-top', w) ?? ultimo(R, /^\.recapiti-sez$/, 'padding', w)?.split(/\s+/)[0], w)), [48])
  ok('il link dell’azione è alto almeno 48px, a 1440 e a 375', [1440, 375].map((w) => px(ultimo(R, /^\.recapiti-sez \.azione a$/, 'min-height', w), w)), [48, 48])
  ok('…e un ::after lo allarga su tutta la tessera (position:absolute, inset 0), a 1440 e a 375', [1440, 375].map((w) => [valori(R, /^\.recapiti-sez \.azione a::after$/, 'content', w).length > 0, ultimo(R, /^\.recapiti-sez \.azione a::after$/, 'position', w), ultimo(R, /^\.recapiti-sez \.azione a::after$/, 'inset', w) ?? ultimo(R, /^\.recapiti-sez \.azione a::after$/, 'top', w)]), [[true, 'absolute', '0'], [true, 'absolute', '0']])
  ok('.contatti-nuova .arrivo: 780px 1fr con gap 6px a 1440', [ultimo(R, /^\.contatti-nuova \.arrivo$/, 'grid-template-columns', 1440), ultimo(R, /^\.contatti-nuova \.arrivo$/, 'gap', 1440)], ['780px 1fr', '6px'])
  ok('.arrivo a una colonna a 768 e 375', [768, 375].map((w) => ultimo(R, /^\.contatti-nuova \.arrivo$/, 'grid-template-columns', w)), ['1fr', '1fr'])
  ok('.mappa alta 500px a 1440, 380px a 768 e 375', W.map((w) => px(ultimo(R, /\.mappa$/, 'height', w), w)), [500, 380, 380])
  ok('.foto-contatti: gap 6px; figure alte 360px a 1440, 220px a 768 e 375', [px(ultimo(R, /^\.foto-contatti$/, 'gap', 1440), 1440), ...W.map((w) => px(ultimo(R, /^\.foto-contatti figure$/, 'height', w), w))], [6, 360, 220, 220])
  const sopra = (w) => px(ultimo(R, /^\.passo-unico \.sezione$/, 'padding-top', w) ?? ultimo(R, /^\.passo-unico \.sezione$/, 'padding', w)?.split(/\s+/)[0], w)
  ok('.passo-unico .sezione: 96px sopra a 1440, 64px a ≤900 (vale anche qui)', W.map(sopra), [96, 64, 64])
  ok('nessun overflow-x nelle regole della pagina nuova', R.filter((r) => /contatti-nuova|recapiti-sez|foto-contatti|\.arrivo|\.mappa|\.arrivi/.test(r.sel)).flatMap((r) => dichiarazioni(r.corpo)).some(([p]) => p === 'overflow-x'), false)
}

console.log(guai ? `\n✗ ${guai} casi falliti` : '\nTutto a posto.')
process.exit(guai ? 1 : 0)
