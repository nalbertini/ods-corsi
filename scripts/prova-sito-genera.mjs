// ---------------------------------------------------------------------------
// Il generatore del sito pubblico, senza browser.
//
//   node scripts/prova-sito-genera.mjs
//
// `src/lib/sitoGenera.ts`: dalle pagine pubblicate nel pannello SITO scrive i
// file HTML statici. Il testo si ripulisce anche qui (chi scrive all'API salta
// il pannello), titoli e voci di menu si escapano, e il sito non ha codice né
// risorse esterne: per questo ci sono gli attacchi, non solo il caso felice.
// ---------------------------------------------------------------------------
import { build } from 'esbuild'

const carica = async (file) => {
  try {
    const { outputFiles } = await build({
      entryPoints: [file],
      bundle: true,
      format: 'esm',
      platform: 'node',
      write: false,
      logLevel: 'silent',
      define: { 'import.meta.env': '{}' },
      banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(process.cwd() + '/');" },
    })
    return await import('data:text/javascript;base64,' + Buffer.from(outputFiles[0].text).toString('base64'))
  } catch (e) {
    console.log(`  (modulo mancante: ${file} — ${String(e.message).split('\n')[0]})`)
    return {}
  }
}
const g = await carica('src/lib/sitoGenera.ts')
const s = await carica('src/lib/sito.ts')

// L'unico <script> ammesso è il blocco dei dati strutturati (ld+json): è JSON con ogni «<» escapato, e non può contenere altri tag.
const senzaDati = (h) => h.replace(/<script type="application\/ld\+json">[^<]*<\/script>/g, '')
let guai = 0
const ok = (cosa, avuto, voluto) => {
  const va = JSON.stringify(avuto) === JSON.stringify(voluto)
  console.log(va ? '  ✓' : '  ✗', cosa, va ? '' : `— atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`)
  if (!va) guai++
}
const prova = (f) => {
  try {
    return f()
  } catch (e) {
    return `ERRORE: ${e.message}`
  }
}

const DOMINIO = 'https://officinedellosport.it'
const pag = (slug, extra = {}) => ({ slug, titolo: `Titolo ${slug}`, descrizione: `Descrizione ${slug}`, testo: `<p>Testo di ${slug}</p>`, ...extra })
const voce = (dove, ordine, etichetta, slug, indirizzo = null) => ({ dove, ordine, etichetta, slug, indirizzo })
const dati = (o = {}) => ({
  dominio: DOMINIO,
  pagine: [pag('home'), pag('judo'), pag('orari')],
  menu: [voce('menu', 1, 'Judo', 'judo'), voce('menu', 2, 'Orari', 'orari')],
  rinvii: [],
  ...o,
})
// Il risultato, o un oggetto vuoto se la funzione manca o scoppia (il caso fa rosso, non si ferma tutto).
const genera = (d) => {
  const r = prova(() => g.generaSito(d))
  return typeof r === 'object' && r !== null ? r : {}
}
const html = (r) => Object.keys(r).filter((f) => f.endsWith('.html'))
const ha = (r, f) => typeof r[f] === 'string'
// Il contenuto di un file, o '' se non c'è (le regole «non contiene» valgono solo se il file c'è: vedi `esiste`).
const c = (r, f) => (ha(r, f) ? r[f] : '')
const conta = (t, re) => (t.match(re) || []).length
const esiste = (r, f) => ha(r, f)

// ---------------------------------------------------------------------------
console.log('\nPercorsi: un file per pagina')
{
  const r = genera(dati())
  ok('la home è index.html', esiste(r, 'index.html'), true)
  ok('le altre pagine sono <slug>/index.html', [esiste(r, 'judo/index.html'), esiste(r, 'orari/index.html')], [true, true])
  ok('ci sono 404.html, sitemap.xml e robots.txt', [esiste(r, '404.html'), esiste(r, 'sitemap.xml'), esiste(r, 'robots.txt')], [true, true, true])
  ok('niente di più: 3 pagine + 4 file fissi', Object.keys(r).sort(), ['404.html', 'index.html', 'judo/index.html', 'llms.txt', 'orari/index.html', 'robots.txt', 'sitemap.xml'])
}
{
  const cattivi = ['../x', 'a b', 'Admin', 'x/y', '', '..', '/x', 'a\\b', 'é', 'x.html']
  const r = genera(dati({ pagine: [pag('home'), ...cattivi.map((x) => pag(x)), pag('judo')], menu: [] }))
  ok('slug non validi saltati, le altre pagine restano', Object.keys(r).filter((f) => f.endsWith('/index.html')).sort(), ['judo/index.html'])
  ok('la home resta anche con slug cattivi attorno', esiste(r, 'index.html'), true)
  const strani = Object.keys(r).filter((f) => f.startsWith('/') || f.includes('..') || /[^a-z0-9/\-.]/.test(f))
  ok('nessun percorso con «..», «/» iniziale o caratteri fuori [a-z0-9/-.]', Object.keys(r).length > 0 ? strani : 'nessun file', [])
  ok('con soli slug cattivi non cade (resta 404, llms.txt, sitemap, robots)', Object.keys(genera(dati({ pagine: cattivi.map((x) => pag(x)), menu: [] }))).sort(), ['404.html', 'llms.txt', 'robots.txt', 'sitemap.xml'])
}

// ---------------------------------------------------------------------------
console.log('\nTesto: ripulito anche qui')
{
  const attacco = '<p>ok</p><script>alert(1)</script><img src=x onerror=alert(1)><a href="javascript:alert(1)">x</a><iframe src="https://e.it"></iframe><p style="color:red">s</p>'
  const r = genera(dati({ pagine: [pag('home'), pag('judo', { testo: attacco })] }))
  const f = c(r, 'judo/index.html')
  const area = f.slice(f.indexOf('Titolo judo'))
  ok('il file della pagina c’è', esiste(r, 'judo/index.html'), true)
  ok('niente <script', esiste(r, 'judo/index.html') && !/<script/i.test(senzaDati(f)), true)
  ok('niente onerror', esiste(r, 'judo/index.html') && !/onerror/i.test(f), true)
  ok('niente javascript:', esiste(r, 'judo/index.html') && !/javascript:/i.test(f), true)
  ok('niente <iframe', esiste(r, 'judo/index.html') && !/<iframe/i.test(f), true)
  ok('niente style= nel testo', esiste(r, 'judo/index.html') && !/style\s*=\s*"color/i.test(area) && !/color:red/i.test(f), true)
  ok('«ok» e «s» restano', [f.includes('<p>ok</p>'), />s<\/p>/.test(f)], [true, true])
}

// ---------------------------------------------------------------------------
console.log('\nTitolo, descrizione e menu: escapati')
{
  const titolo = '"><script>alert(1)</script>'
  const descrizione = '" onload="x'
  const r = genera(dati({
    pagine: [pag('home'), pag('judo', { titolo, descrizione })],
    menu: [voce('menu', 1, titolo, 'judo'), voce('footer', 1, titolo, 'judo')],
  }))
  const f = c(r, 'judo/index.html')
  ok('il file c’è', esiste(r, 'judo/index.html'), true)
  ok('nessun <script in tutto il file', esiste(r, 'judo/index.html') && !/<script/i.test(senzaDati(f)), true)
  ok('<title> con il titolo escapato', f.includes('<title>&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;') , true)
  const meta = f.match(/<meta name="description" content="([^"]*)"/)
  ok('meta description: un solo attributo, il testo escapato', meta ? meta[1] : null, '&quot; onload=&quot;x')
  ok('nessun attributo onload=" inventato', esiste(r, 'judo/index.html') && !/\sonload\s*=\s*"/i.test(f), true)
  const og = f.match(/<meta property="og:title" content="([^"]*)"/)
  ok('og:title escapato', og ? og[1] : null, '&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;')
  const h1 = f.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)
  ok('h1 escapato', h1 ? h1[1].trim() : null, '&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;')
  const nav = f.match(/<nav[\s\S]*?<\/nav>/)
  ok('voce di menu escapata', nav ? /<script/i.test(nav[0]) || !nav[0].includes('&lt;script&gt;') : 'niente nav', false)
}

// ---------------------------------------------------------------------------
console.log('\nSito statico: niente codice né servizi esterni')
{
  const lunga = pag('judo', { testo: '<p>Vai a <a href="https://www.fijlkam.it/">FIJLKAM</a></p>' })
  const r = genera(dati({ pagine: [pag('home'), lunga], menu: [voce('menu', 1, 'Mappa', null, 'https://maps.example/x')] }))
  const tutti = html(r)
  ok('ci sono file da guardare', tutti.length >= 3, true)
  ok('nessun file con <script', tutti.filter((f) => /<script/i.test(senzaDati(r[f]))), [])
  ok('nessun @import', tutti.filter((f) => /@import/i.test(r[f])), [])
  ok('nessun font di Google', tutti.filter((f) => /fonts\.(googleapis|gstatic)\.com/i.test(r[f])), [])
  const risorse = []
  for (const f of tutti) {
    for (const m of r[f].matchAll(/<(?:link|img|style|source|video|audio|iframe|object|embed)\b[^>]*>/gi)) {
      for (const u of m[0].matchAll(/\b(?:src|href|srcset|data)\s*=\s*"(https?:)?\/\/([^"/]*)/gi)) {
        // canonical è il dominio nostro; il resto sarebbe una risorsa di terzi
        if (!/rel="canonical"/.test(m[0]) && u[2] !== 'officinedellosport.it') risorse.push(`${f}: ${u[0]}`)
      }
    }
    for (const u of r[f].matchAll(/url\(\s*['"]?(?:https?:)?\/\/[^)]*\)/gi)) risorse.push(`${f}: ${u[0]}`)
  }
  ok('nessuna risorsa (link/img/style) da un indirizzo assoluto esterno', risorse, [])
  ok('i link scritti dalla segreteria restano', [c(r, 'judo/index.html').includes('https://www.fijlkam.it/'), c(r, 'index.html').includes('https://maps.example/x')], [true, true])
}

// ---------------------------------------------------------------------------
console.log('\nOgni pagina: la struttura')
{
  const r = genera(dati())
  for (const f of ['index.html', 'judo/index.html', '404.html']) {
    const t = c(r, f)
    ok(`${f}: <html lang="it">`, /<html[^>]*\blang="it"/.test(t), true)
    ok(`${f}: un solo <h1>`, conta(t, /<h1[\s>]/g), 1)
    ok(`${f}: un solo <main>`, conta(t, /<main[\s>]/g), 1)
    ok(`${f}: meta viewport`, /<meta name="viewport"/.test(t), true)
    ok(`${f}: <nav> con aria-label`, /<nav[^>]*\baria-label="[^"]+"/.test(t), true)
    const imgs = t.match(/<img\b[^>]*>/g) || []
    ok(`${f}: il logo c’è, con alt, e nessun <img> senza alt`, imgs.length > 0 && imgs.every((i) => /\balt="[^"]*"/.test(i)), true)
  }
  const j = c(r, 'judo/index.html')
  ok('judo: <title> col titolo', j.includes('<title>Titolo judo'), true)
  ok('judo: meta description', j.includes('<meta name="description" content="Descrizione judo"'), true)
  ok('judo: canonical = dominio + /judo/', j.includes(`<link rel="canonical" href="${DOMINIO}/judo/"`), true)
  ok('home: canonical = dominio + /', c(r, 'index.html').includes(`<link rel="canonical" href="${DOMINIO}/"`), true)
  // senza questi link il sito non ha l'icona nella scheda del browser né nei risultati di Google
  const testa = c(r, 'index.html')
  ok('home: link a icona svg, png e apple-touch-icon', ['<link rel="icon" type="image/svg+xml" href="/risorse/icon.svg">', '<link rel="icon" type="image/png" sizes="192x192" href="/risorse/icon-192.png">', '<link rel="apple-touch-icon" href="/risorse/apple-touch-icon.png">'].map((l) => testa.includes(l)), [true, true, true])
  const senzaDescr = c(genera(dati({ pagine: [pag('home'), pag('judo', { descrizione: '' })] })), 'judo/index.html')
  ok('senza descrizione niente meta description', senzaDescr !== '' && !/<meta name="description"/.test(senzaDescr), true)
}

// ---------------------------------------------------------------------------
console.log('\nMenu e footer')
{
  const r = genera(dati({
    pagine: [pag('home'), pag('judo'), pag('orari')],
    menu: [
      voce('menu', 3, 'Orari', 'orari'),
      voce('menu', 1, 'Casa', 'home'),
      voce('menu', 2, 'Judo', 'judo'),
      voce('menu', 4, 'Scrivici', null, 'mailto:info@officinedellosport.it'),
      voce('menu', 5, 'Chiama', null, 'tel:+393463292786'),
      voce('menu', 6, 'Sito FIJLKAM', null, 'https://www.fijlkam.it/'),
      voce('menu', 7, 'Interno', null, '/orari'),
      voce('menu', 8, 'XSSVOCE', null, 'javascript:alert(1)'),
      voce('menu', 9, 'SLASHVOCE', null, '//evil.example'),
      voce('menu', 10, 'FTPVOCE', null, 'ftp://x'),
      voce('menu', 11, 'SPAZIOVOCE', null, 'https://a b'),
      voce('footer', 1, 'FOOTERJUDO', 'judo'),
      voce('footer', 2, 'FOOTERFANTASMA', 'non-c-e'),
    ],
  }))
  const t = c(r, 'judo/index.html')
  const nav = (t.match(/<nav[\s\S]*?<\/nav>/) || [''])[0]
  const href = (txt) => (new RegExp(`<a[^>]*href="([^"]*)"[^>]*>\\s*${txt}\\s*<`).exec(nav) || [, null])[1]
  ok('voce con slug → /slug/', href('Judo'), '/judo/')
  ok('voce verso la home → /', href('Casa'), '/')
  ok('mailto: resta', href('Scrivici'), 'mailto:info@officinedellosport.it')
  ok('tel: resta', href('Chiama'), 'tel:+393463292786')
  ok('https:// resta', href('Sito FIJLKAM'), 'https://www.fijlkam.it/')
  ok('indirizzo interno resta', href('Interno'), '/orari')
  ok('la pagina esiste lo stesso', esiste(r, 'judo/index.html'), true)
  for (const x of ['XSSVOCE', 'SLASHVOCE', 'FTPVOCE', 'SPAZIOVOCE']) ok(`indirizzo non valido scartato: la voce ${x} sparisce`, esiste(r, 'judo/index.html') && !t.includes(x), true)
  ok('nessun javascript:, //evil, ftp: nel file', esiste(r, 'judo/index.html') && !/javascript:|\/\/evil\.example|ftp:\/\//i.test(t), true)
  const ordine = ['Casa', 'Judo', 'Orari', 'Scrivici'].map((x) => nav.indexOf(`>${x}<`)).filter((i) => i >= 0)
  ok('le voci seguono «ordine»', ordine.length === 4 && ordine.every((v, i) => i === 0 || ordine[i - 1] < v), true)
  const pie = (t.match(/<footer[\s\S]*?<\/footer>/) || [''])[0]
  ok('il footer ha la sua voce', pie.includes('FOOTERJUDO') && pie.includes('href="/judo/"'), true)
  ok('una voce di footer verso una pagina assente è scartata', esiste(r, 'judo/index.html') && !t.includes('FOOTERFANTASMA') && !t.includes('non-c-e'), true)
  ok('le voci del footer non finiscono nel menu', nav !== '' && !nav.includes('FOOTERJUDO'), true)
}

// ---------------------------------------------------------------------------
console.log('\nSitemap e robots')
{
  const r = genera(dati({
    pagine: [pag('home', { pubblicataIl: '2026-03-04' }), pag('judo', { pubblicataIl: '2026-05-06T10:20:30Z' }), pag('orari'), pag('a&b', { titolo: 'x' }), pag('x'.repeat(5))],
    rinvii: [{ da: 'vecchia', a: 'judo' }],
  }))
  const m = c(r, 'sitemap.xml')
  const locs = [...m.matchAll(/<loc>([^<]*)<\/loc>/g)].map((x) => x[1])
  ok('sitemap: le pagine generate, home compresa', locs, [`${DOMINIO}/`, `${DOMINIO}/judo/`, `${DOMINIO}/orari/`, `${DOMINIO}/xxxxx/`])
  ok('sitemap: lastmod solo dove c’è pubblicataIl (AAAA-MM-GG)', [...m.matchAll(/<lastmod>([^<]*)<\/lastmod>/g)].map((x) => x[1]), ['2026-03-04', '2026-05-06'])
  ok('sitemap: niente rinvii né 404', m !== '' && !/vecchia|404/.test(m), true)
  ok('sitemap: dichiarazione XML e urlset', m.startsWith('<?xml') && m.includes('<urlset'), true)
  ok('sitemap: ogni <url> ha un solo <loc>', m !== '' ? conta(m, /<url>/g) : -1, conta(m, /<loc>/g) || 4)
  ok('sitemap: un dominio con una «?» e una «&» è rifiutato (finirebbe nella sitemap)', /ERRORE: /.test(String(prova(() => g.generaSito(dati({ dominio: 'https://a.it/?x=1&y=2' }))))), true)
  const rb = c(r, 'robots.txt')
  ok('robots: User-agent e Allow', /^User-agent: \*$/m.test(rb) && /^Allow: \/$/m.test(rb), true)
  ok('robots: Sitemap del dominio', rb.split('\n').includes(`Sitemap: ${DOMINIO}/sitemap.xml`), true)
  ok('robots: mai Disallow: /', rb !== '' && !/^Disallow:\s*\/\s*$/m.test(rb), true)
}

// ---------------------------------------------------------------------------
console.log('\nRinvii')
{
  const r = genera(dati({
    rinvii: [
      { da: 'vecchio-judo', a: 'judo' },
      { da: 'fantasma', a: 'non-c-e' },
      { da: 'orari', a: 'judo' },
      { da: '../x', a: 'judo' },
      { da: 'A B', a: 'judo' },
      { da: '', a: 'judo' },
      { da: 'vecchia-home', a: 'home' },
    ],
  }))
  const t = c(r, 'vecchio-judo/index.html')
  ok('il rinvio è un file', esiste(r, 'vecchio-judo/index.html'), true)
  ok('meta refresh verso /judo/', t.includes('<meta http-equiv="refresh" content="0; url=/judo/"'), true)
  ok('link di ripiego a /judo/', /<a[^>]*href="\/judo\/"/.test(t), true)
  ok('canonical verso la pagina nuova', t.includes(`<link rel="canonical" href="${DOMINIO}/judo/"`), true)
  ok('noindex', /<meta name="robots" content="[^"]*noindex/.test(t), true)
  ok('un rinvio verso la home va a /', c(r, 'vecchia-home/index.html').includes('content="0; url=/"'), true)
  ok('rinvio verso una pagina che non c’è: saltato', esiste(r, 'index.html') && !esiste(r, 'fantasma/index.html'), true)
  ok('rinvio con «da» uguale a una pagina: la pagina non è sostituita', c(r, 'orari/index.html').includes('Testo di orari') && !c(r, 'orari/index.html').includes('refresh'), true)
  ok('rinvio con «da» non valido: saltato', Object.keys(r).length === 0 ? -1 : Object.keys(r).filter((f) => f.includes('..') || f.includes('A B') || f.startsWith('/') || f === 'index.html/index.html').length, 0)
  ok('file totali: 3 pagine, 2 rinvii, 4 fissi', Object.keys(r).length, 9)
}

// ---------------------------------------------------------------------------
console.log('\nPagina 404')
{
  const t = c(genera(dati()), '404.html')
  ok('404.html esiste', t !== '', true)
  ok('dice «404» o «non trovata» a parole', /404|non trovata/i.test(t), true)
  ok('ha il menu', /<nav[\s\S]*href="\/judo\/"/.test(t), true)
  ok('ha un link alla home', /<main[\s\S]*<a[^>]*href="\/"/.test(t), true)
  ok('non si indicizza', /<meta name="robots" content="[^"]*noindex/.test(t), true)
}

// ---------------------------------------------------------------------------
console.log('\nDeterminismo')
{
  const d = dati({ rinvii: [{ da: 'vecchia', a: 'judo' }] })
  const a = genera(d)
  const copia = JSON.parse(JSON.stringify(d))
  const b = genera(copia)
  ok('ci sono file', Object.keys(a).length > 0, true)
  ok('stessi dati → stessi file identici', JSON.stringify(a), JSON.stringify(b))
  ok('generare due volte è uguale', JSON.stringify(genera(d)), JSON.stringify(a))
  ok('i dati in ingresso non sono modificati', JSON.stringify(d), JSON.stringify(copia))
  const oggi = new Date().getFullYear()
  ok('nessuna data di oggi nei file', Object.keys(a).length > 0 && !Object.values(a).some((v) => v.includes(new Date().toISOString().slice(0, 10))) , true)
  void oggi
}

// ---------------------------------------------------------------------------
console.log('\nPagine vuote e modelli')
{
  const r = genera(dati({ pagine: [pag('home'), pag('vuota', { testo: '' }), pag('spazi', { testo: '   \n  ' }), pag('privacy', { diLegge: true }), pag('judo')] }))
  ok('testo vuoto: la pagina c’è', esiste(r, 'vuota/index.html'), true)
  ok('testo di soli spazi: la pagina c’è', esiste(r, 'spazi/index.html'), true)
  ok('la pagina vuota ha comunque h1 e main', conta(c(r, 'vuota/index.html'), /<h1[\s>]/g) === 1 && conta(c(r, 'vuota/index.html'), /<main[\s>]/g) === 1, true)
  ok('pagina di legge: classe pagina-testo, non pagina-hero', [/class="[^"]*\bpagina-testo\b/.test(c(r, 'privacy/index.html')), /class="[^"]*\bpagina-hero\b/.test(c(r, 'privacy/index.html'))], [true, false])
  ok('pagina normale: pagina-hero', [/class="[^"]*\bpagina-hero\b/.test(c(r, 'judo/index.html')), /class="[^"]*\bpagina-testo\b/.test(c(r, 'judo/index.html'))], [true, false])
  ok('home: pagina-hero', /class="[^"]*\bpagina-hero\b/.test(c(r, 'index.html')), true)
  const h1 = c(r, 'index.html').match(/<h1[^>]*>([\s\S]*?)<\/h1>/)
  ok('home: h1 è il titolo', h1 ? h1[1].replace(/<[^>]*>/g, '').trim() : null, 'Titolo home')
}

// ---------------------------------------------------------------------------
console.log('\nLink leggibili e recapiti')
{
  const r = genera(dati())
  const vuoti = []
  for (const f of html(r)) {
    for (const m of r[f].matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/g)) {
      const dentro = m[1].replace(/<img[^>]*\balt="([^"]*)"[^>]*>/g, '$1').replace(/<[^>]*>/g, '').trim()
      if (!dentro && !/aria-label="[^"]+"/.test(m[0])) vuoti.push(`${f}: ${m[0].slice(0, 60)}`)
    }
  }
  ok('ci sono link da guardare', html(r).length > 0, true)
  ok('nessun link o pulsante senza testo', vuoti, [])
  const pie = (c(r, 'judo/index.html').match(/<footer[\s\S]*?<\/footer>/) || [''])[0]
  const C = s.CONTATTI || {}
  ok('CONTATTI esiste in src/lib/sito.ts', typeof C.indirizzo === 'string' && typeof C.telefono === 'string', true)
  ok('il piede ha l’indirizzo di CONTATTI', C.indirizzo !== undefined && pie.includes(C.indirizzo), true)
  ok('il piede ha il telefono di CONTATTI', C.telefono !== undefined && pie.includes(C.telefono), true)
  ok('e sono quelli attesi (Via Vittorio Sassi 26, Collegno · 346 329 2786)', [C.indirizzo, C.telefono], ['Via Vittorio Sassi 26, Collegno', '346 329 2786'])
}

// ---------------------------------------------------------------------------
console.log('\nDimensione')
{
  const testo = '<p>' + 'Judo per tutti. '.repeat(1250) + '</p>' // ~20 KB
  const r = genera(dati({ pagine: [pag('home'), pag('judo', { testo })] }))
  const f = c(r, 'judo/index.html')
  ok('la pagina con 20 KB di testo c’è e contiene il testo', f.length > 20000, true)
  ok('nessun file HTML oltre 300 KB', html(r).length > 0 && html(r).every((n) => Buffer.byteLength(r[n]) <= 300 * 1024), true)
  ok('il CSS è incluso una volta sola', conta(f, /<style[\s>]/g), 1)
}

// ---------------------------------------------------------------------------
console.log('\nLo script scripts/genera-sito.mjs')
{
  const { mkdtempSync, writeFileSync, existsSync, readFileSync, readdirSync } = await import('node:fs')
  const { tmpdir } = await import('node:os')
  const { join } = await import('node:path')
  const { spawnSync } = await import('node:child_process')
  const cartella = mkdtempSync(join(tmpdir(), 'sito-'))
  const dati = join(cartella, 'dati.json')
  const uscita = join(cartella, 'fuori')
  const lancia = (...a) => spawnSync('node', ['scripts/genera-sito.mjs', ...a], { encoding: 'utf8', env: { PATH: process.env.PATH } })
  const pagine = [
    { slug: 'home', titolo: 'Casa', descrizione: '', testo: '<p>Ciao</p><script>x</script>', pubblicata_il: '2026-10-17T09:00:00Z' },
    { slug: 'privacy', titolo: 'Privacy', descrizione: '', testo: '<p>Testo</p>', pubblicata_il: null },
  ]
  writeFileSync(dati, JSON.stringify({ pagine, menu: [{ dove: 'menu', ordine: 1, etichetta: 'Casa', slug: 'home', indirizzo: null }], rinvii: [] }))
  const r = lancia(uscita, '--da-file', dati)
  ok('con i dati giusti finisce bene', r.status, 0)
  ok('scrive la home, la privacy come pagina di legge, la sitemap e le risorse', ['index.html', 'privacy/index.html', 'sitemap.xml', 'risorse/logo.webp', 'risorse/icon.svg', 'risorse/icon-192.png', 'risorse/apple-touch-icon.png'].every((f) => existsSync(join(uscita, f))), true)
  const caratteri = [...readFileSync(join(uscita, 'index.html'), 'utf8').matchAll(/url\(\/risorse\/([^)]+\.woff2)\)/g)].map((m) => m[1])
  ok('i caratteri Big Shoulders Display e Inter sono copiati con il sito', [caratteri.length >= 2, caratteri.every((f) => existsSync(join(uscita, 'risorse', f))), caratteri.some((f) => /bricolage/i.test(f))], [true, true, false])
  ok('la pagina di legge ha il modello solo testo (la funzione pubblica non dice quali sono)', readFileSync(join(uscita, 'privacy/index.html'), 'utf8').includes('pagina-testo'), true)
  ok('il testo scritto con uno script esce pulito', senzaDati(readFileSync(join(uscita, 'index.html'), 'utf8')).includes('<script'), false)
  ok('il dominio di norma è www', readFileSync(join(uscita, 'sitemap.xml'), 'utf8').includes('https://www.officinedellosport.it/'), true)
  const prima = readdirSync(uscita).sort().join()
  writeFileSync(dati, JSON.stringify({ pagine: [pagine[1]], menu: [], rinvii: [] }))
  const senzaHome = lancia(uscita, '--da-file', dati)
  ok('senza la home non genera niente, e lo dice col codice 2 («non c\'è ancora niente da pubblicare»: chi pubblica il sito lo distingue da un guasto)', [senzaHome.status, /home/.test(senzaHome.stderr)], [2, true])
  ok('e il sito di prima resta com\'è', readdirSync(uscita).sort().join(), prima)
  ok('senza SUPABASE_URL e chiave lo dice', (() => { const x = lancia(uscita); return x.status !== 0 && /SUPABASE_URL/.test(x.stderr) })(), true)
  ok('non lascia cartelle a metà', existsSync(`${uscita}.nuovo`), false)
}

// ---------------------------------------------------------------------------
console.log('\nDopo la revisione')
{
  const r = genera(dati())
  const home = c(r, 'index.html')
  ok('sotto i 900px il menu non sparisce', /\.testata nav\{display:none\}/.test(home), false)
  ok('sotto i 900px il menu è chiuso e si apre sotto la testata con #menu:target', /@media \(max-width:900px\)[\s\S]*#menu\{display:none[^}]*\}#menu:target\{display:block;position:absolute[^}]*top:100%/.test(home), true)
  ok('la nav c\'è ancora nell\'HTML', /<nav id="menu" aria-label="Principale">/.test(home), true)
  ok('niente ingranaggio decorativo (il disegno è uscito dal sito)', [/fill-rule/.test(home), /class="(motivo|marchio)"/.test(home)], [false, false])
  // Il contrasto dell'invito (inchiostro sul giallo) e il pulsante che non schiarisce: scripts/prova-sito-aspetto.mjs, con i valori A2.
  const css = home.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? ''
  const { existsSync } = await import('node:fs')
  const risorse = [...css.matchAll(/url\(\/risorse\/([^)]+)\)/g)].map((m) => m[1])
  ok('il CSS nomina almeno due file di risorse', risorse.length >= 2, true)
  ok('e ognuno esiste in sito/risorse', risorse.every((f) => existsSync(`sito/risorse/${f}`)), true)
  ok('il logo, anche', existsSync('sito/risorse/logo.webp'), true)
}
{
  const r = genera(dati({ pagine: [pag('home', { testo: '<p>x</p><img src="https://tracker.example/p.png" alt="a"><img src="/risorse/x.webp" alt="b">' })] }))
  const home = c(r, 'index.html')
  ok('un\'immagine di un altro sito nel testo non entra (il sito non chiama servizi esterni)', home.includes('tracker.example'), false)
  ok('una del sito sì', home.includes('/risorse/x.webp'), true)
  const P = 'https://abc.supabase.co/storage/v1/object/public/sito/'
  const img = (src, alt = 'a') => `<img src="${src}" alt="${alt}">`
  const homeCon = (testo, prefissi = [P]) => c(genera(dati({ pagine: [pag('home', { testo })], ospitiImmagini: prefissi })), 'index.html')
  ok('un\'immagine col prefisso dichiarato e un nome semplice passa', homeCon(img(`${P}0b9f6c1e.jpg`)).includes(`${P}0b9f6c1e.jpg`), true)
  ok('l\'host si confronta senza maiuscole', homeCon(img('https://ABC.supabase.co/storage/v1/object/public/sito/a.png')).includes('/storage/v1/object/public/sito/a.png'), true)
  ok('stesso host, bucket «certificati» → tolta', homeCon(img('https://abc.supabase.co/storage/v1/object/public/certificati/a.jpg')).includes('certificati'), false)
  ok('stesso host, /object/sign/ → tolta', homeCon(img('https://abc.supabase.co/storage/v1/object/sign/sito/a.jpg?token=x')).includes('abc.supabase.co'), false)
  ok('nome con «..» → tolta', homeCon(img(`${P}..%2Fcertificati%2Fa.jpg`)).includes('abc.supabase.co'), false)
  ok('nome con «..» (letterale) → tolta', homeCon(img(`${P}../a.jpg`)).includes('abc.supabase.co'), false)
  ok('stesso host, un altro contenitore col nome lungo uguale («abcd» come «sito») → tolta', homeCon(img(P.replace('/sito/', '/abcd/') + 'a.jpg')).includes('abc.supabase.co'), false)
  ok('stesso host, /object/sign/ di pari lunghezza → tolta', homeCon(img(P.replace('/public/', '/signn/') + 'a.jpg')).includes('abc.supabase.co'), false)
  ok('un nome fatto solo di punti → tolta', homeCon(img(`${P}..`)).includes('abc.supabase.co'), false)
  ok('un nome con «..» in mezzo → tolta', homeCon(img(`${P}a..b.jpg`)).includes('abc.supabase.co'), false)
  ok('nome con «?token=» → tolta', homeCon(img(`${P}a.jpg?token=x`)).includes('abc.supabase.co'), false)
  ok('nome con «#» → tolta', homeCon(img(`${P}a.jpg#x`)).includes('abc.supabase.co'), false)
  ok('nome con sottocartella → tolta', homeCon(img(`${P}a/b.jpg`)).includes('abc.supabase.co'), false)
  ok('un altro progetto Supabase → tolta', homeCon(img('https://altro.supabase.co/storage/v1/object/public/sito/a.jpg')).includes('altro.supabase.co'), false)
  ok('senza prefissi dichiarati nessuna immagine esterna', homeCon(img(`${P}a.jpg`), []).includes('abc.supabase.co'), false)
  ok('le immagini «/…» del sito passano come prima', homeCon(img('/risorse/x.webp')).includes('/risorse/x.webp'), true)
  ok('un host qualunque non dichiarato resta fuori', homeCon(img('https://tracker.example/p.png')).includes('tracker.example'), false)
  ok('l\'alt con virgolette resta escapato', homeCon(img(`${P}a.jpg`, 'Il &quot;dojo&quot; &lt;b&gt;')).includes('alt="Il &quot;dojo&quot; &lt;b&gt;"'), true)
  const t0 = img('/risorse/x.webp') + img('https://tracker.example/p.png')
  const senzaOpz = genera(dati({ pagine: [pag('home', { testo: t0 })] }))
  const conVuoto = genera(dati({ pagine: [pag('home', { testo: t0 })], ospitiImmagini: [] }))
  ok('senza ospitiImmagini i file sono identici a quelli con elenco vuoto', JSON.stringify(senzaOpz), JSON.stringify(conVuoto))
}
for (const [nome, dom] of [['con un a capo (iniettava righe in robots.txt)', 'https://x.it\nDisallow: /'], ['con una virgoletta', 'https://x.it"><script>'], ['javascript:', 'javascript:alert(1)'], ['senza schema', 'www.x.it'], ['con una barra in fondo', 'https://www.x.it/']]) {
  ok(`il dominio ${nome} è rifiutato`, /ERRORE: /.test(String(prova(() => g.generaSito(dati({ dominio: dom }))))), true)
}
ok('il dominio giusto va', typeof prova(() => g.generaSito(dati({ dominio: 'https://www.officinedellosport.it' }))), 'object')
{
  const { mkdtempSync, writeFileSync, existsSync, readdirSync, readFileSync } = await import('node:fs')
  const { tmpdir } = await import('node:os')
  const { join } = await import('node:path')
  const { spawnSync } = await import('node:child_process')
  const radiceRepo = process.cwd()
  const { mkdirSync, copyFileSync, symlinkSync } = await import('node:fs')
  const cartella = mkdtempSync(join(tmpdir(), 'sito-'))
  // Lo script con una cartella di uscita che non si può cancellare deve rifiutare PRIMA di toccare qualunque cosa.
  // Per non rischiare il repository vero se un giorno si rompesse, queste prove girano in un repository finto:
  // lo script copiato, e src, sito e node_modules collegati a quelli veri.
  const finto = join(cartella, 'sopra', 'repo')
  mkdirSync(join(finto, 'scripts'), { recursive: true })
  copyFileSync(join(radiceRepo, 'scripts/genera-sito.mjs'), join(finto, 'scripts/genera-sito.mjs'))
  copyFileSync(join(radiceRepo, 'package.json'), join(finto, 'package.json'))
  for (const n of ['src', 'sito', 'node_modules']) symlinkSync(join(radiceRepo, n), join(finto, n))
  const casa = join(cartella, 'casa')
  mkdirSync(casa)
  const lanciaFinto = (cwd, env, ...a) => spawnSync('node', [join(finto, 'scripts/genera-sito.mjs'), ...a], { encoding: 'utf8', cwd, env: { PATH: process.env.PATH, ...env } })
  const lancia = (cwd, ...a) => spawnSync('node', [join(radiceRepo, 'scripts/genera-sito.mjs'), ...a], { encoding: 'utf8', cwd, env: { PATH: process.env.PATH } })
  const buoni = join(cartella, 'dati.json')
  writeFileSync(buoni, JSON.stringify({ pagine: [{ slug: 'home', titolo: 'C', descrizione: '', testo: '<p>x</p>', pubblicata_il: null }], menu: [], rinvii: [] }))
  for (const [nome, uscita, cwd, env] of [
    ['la cartella del repository («.»)', '.', finto, {}],
    ['il repository a percorso intero', finto, cartella, {}],
    ['la cartella sopra il repository', '..', finto, {}],
    ['la cartella di casa', casa, cartella, { HOME: casa }],
  ]) {
    const x = lanciaFinto(cwd, env, uscita, '--da-file', buoni)
    ok(`non cancella ${nome}`, x.status !== 0 && /cartella|percorso|sito/i.test(x.stderr) && existsSync(join(finto, 'package.json')) && existsSync(join(finto, 'scripts/genera-sito.mjs')) && existsSync(casa), true)
  }
  const dentro = join(cartella, 'uscita')
  ok('una cartella di lavoro qualunque va bene', lancia(radiceRepo, dentro, '--da-file', buoni).status, 0)
  const rotto = join(cartella, 'rotto.json')
  writeFileSync(rotto, '{ non è json')
  const x1 = lancia(radiceRepo, dentro, '--da-file', rotto)
  ok('un file json rotto dà una frase, non uno stack', x1.status !== 0 && !/\n\s+at /.test(x1.stderr) && /json|file|dati/i.test(x1.stderr), true)
  writeFileSync(rotto, JSON.stringify({ pagine: 'no', menu: [], rinvii: [] }))
  const x2 = lancia(radiceRepo, dentro, '--da-file', rotto)
  ok('pagine che non sono un elenco: una frase', x2.status !== 0 && !/\n\s+at /.test(x2.stderr), true)
  ok('e la cartella di prima resta', existsSync(join(dentro, 'index.html')), true)
  ok('nessuna cartella .nuovo né .vecchio in giro', readdirSync(cartella).filter((n) => /\.(nuovo|vecchio)$/.test(n)), [])
  {
    const P = 'https://abc.supabase.co/storage/v1/object/public/sito/'
    const conImg = join(cartella, 'immagini.json')
    const testo = `<p>x</p><img src="${P}mia.jpg" alt="mia"><img src="https://altro.supabase.co/storage/v1/object/public/sito/loro.jpg" alt="loro">`
    writeFileSync(conImg, JSON.stringify({ pagine: [{ slug: 'home', titolo: 'C', descrizione: '', testo, pubblicata_il: null }], menu: [], rinvii: [] }))
    const letto = (u) => (existsSync(join(u, 'index.html')) ? readFileSync(join(u, 'index.html'), 'utf8') : '')
    const u1 = join(cartella, 'u-con-url')
    const r1 = spawnSync('node', [join(radiceRepo, 'scripts/genera-sito.mjs'), u1, '--da-file', conImg], { encoding: 'utf8', cwd: radiceRepo, env: { PATH: process.env.PATH, SUPABASE_URL: 'https://abc.supabase.co/' } })
    ok('con SUPABASE_URL (e --da-file) lo script riesce', r1.status, 0)
    ok('l\'immagine del bucket «sito» di quel progetto compare', letto(u1).includes(`${P}mia.jpg`), true)
    ok('quella di un altro progetto no', letto(u1).includes('altro.supabase.co'), false)
    const u2 = join(cartella, 'u-senza-url')
    const r2 = lancia(radiceRepo, u2, '--da-file', conImg)
    ok('senza SUPABASE_URL nessuna immagine esterna', r2.status === 0 && !letto(u2).includes('supabase.co'), true)
  }
  const altrove = mkdtempSync(join(tmpdir(), 'altrove-'))
  ok('lanciato da un\'altra cartella funziona lo stesso (sanitize-html si trova)', lancia(altrove, join(altrove, 'sito'), '--da-file', buoni).status, 0)
}

console.log('\nIl logo: una variante piccola per lo schermo normale')
{
  const { existsSync, statSync } = await import('node:fs')
  const r = genera(dati())
  const loghi = html(r).flatMap((f) => (c(r, f).match(/<img\b[^>]*\/risorse\/logo[^>]*>/g) || []).map((i) => [f, i]))
  ok('il logo compare nelle pagine', loghi.length > 0, true)
  ok('ogni logo tiene width="1060" height="1040" (aspetto invariato)', loghi.every(([, i]) => /\bwidth="1060"/.test(i) && /\bheight="1040"/.test(i)), true)
  ok('ogni logo ha uno srcset con la variante piccola (224w) e la grande (1060w)', loghi.every(([, i]) => /\bsrcset="[^"]*\s224w/.test(i) && /\bsrcset="[^"]*\/risorse\/logo\.webp 1060w/.test(i)), true)
  const piccolo = (loghi[0]?.[1].match(/srcset="([^"]*?)\s+224w/)?.[1] ?? '').split(/[\s,]+/).pop()
  ok('il logo ha un src valido e le sizes dicono 112px', loghi.every(([, i]) => /\bsrc="\/risorse\/logo\.webp"/.test(i) && /\bsizes="112px"/.test(i)), true)
  ok('la variante piccola esiste in sito/risorse/', !!piccolo && existsSync(`sito${piccolo}`), true)
  ok('la variante piccola pesa meno di 20 KB', !!piccolo && existsSync(`sito${piccolo}`) && statSync(`sito${piccolo}`).size < 20480, true)
}

console.log(guai ? `\n✗ ${guai} casi falliti` : '\nTutto a posto.')
process.exit(guai ? 1 : 0)
