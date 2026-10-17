// ---------------------------------------------------------------------------
// Anteprime social e llms.txt del sito pubblico, senza browser.
//
//   node scripts/prova-sito-social.mjs
//
// `src/lib/sitoGenera.ts`: ogni pagina indicizzabile porta le meta Open Graph
// e Twitter con un'immagine 1200×630 e indirizzi assoluti; il 404 e i rinvii
// no (non si condividono). `llms.txt` alla radice racconta il sito agli
// assistenti AI con quel che c'è nelle pagine pubblicate, senza dati inventati
// e senza date di oggi: gli stessi dati danno lo stesso file.
// ---------------------------------------------------------------------------
import { build } from 'esbuild'
import { existsSync, readFileSync } from 'node:fs'

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
const IMMAGINE = `${DOMINIO}/risorse/social.png`
const pag = (slug, extra = {}) => ({ slug, titolo: `Titolo ${slug}`, descrizione: `Descrizione ${slug}`, testo: `<p>Testo di ${slug}</p>`, ...extra })
const voce = (dove, ordine, etichetta, slug) => ({ dove, ordine, etichetta, slug, indirizzo: null })
const dati = (o = {}) => ({
  dominio: DOMINIO,
  pagine: [
    pag('home'),
    pag('corsi', { testo: '<p><a href="/judo/">Judo</a> <a href="/aikido/">Aikido</a> <a href="/contatti/">Contatti</a></p>' }),
    pag('judo', { pubblicataIl: '2026-03-04T10:00:00Z' }),
    pag('aikido'),
    pag('contatti'),
    pag('orari'),
    pag('privacy', { diLegge: true }),
  ],
  menu: [voce('menu', 1, 'Corsi', 'corsi'), voce('menu', 2, 'Orari', 'orari'), voce('footer', 1, 'Privacy', 'privacy')],
  rinvii: [{ da: 'vecchia', a: 'judo' }],
  ...o,
})
const genera = (d) => {
  const r = prova(() => g.generaSito(d))
  return typeof r === 'object' && r !== null ? r : {}
}
const c = (r, f) => (typeof r[f] === 'string' ? r[f] : '')
/** Il valore di `<meta property|name="chiave" content="…">`, o null se non c'è. */
const meta = (h, chiave) => h.match(new RegExp(`<meta (?:property|name)="${chiave}" content="([^"]*)">`))?.[1] ?? null

// ---------------------------------------------------------------------------
console.log('\nAnteprima: Open Graph e Twitter su ogni pagina indicizzabile')
{
  const r = genera(dati())
  for (const f of ['index.html', 'judo/index.html', 'privacy/index.html']) {
    const h = c(r, f)
    ok(`${f}: og:image assoluta col dominio`, meta(h, 'og:image'), IMMAGINE)
    ok(`${f}: og:image:width e height`, [meta(h, 'og:image:width'), meta(h, 'og:image:height')], ['1200', '630'])
    ok(`${f}: og:image:alt c'è`, (meta(h, 'og:image:alt') ?? '').length > 0, true)
    ok(`${f}: og:locale e og:site_name`, [meta(h, 'og:locale'), meta(h, 'og:site_name')], ['it_IT', 'Officine dello Sport'])
    ok(`${f}: twitter:card`, meta(h, 'twitter:card'), 'summary_large_image')
    ok(`${f}: twitter:image come og:image`, meta(h, 'twitter:image'), IMMAGINE)
  }
  const j = c(r, 'judo/index.html')
  ok('twitter:title come og:title', [meta(j, 'twitter:title'), meta(j, 'og:title')], ['Titolo judo', 'Titolo judo'])
  ok('twitter:description come og:description', [meta(j, 'twitter:description'), meta(j, 'og:description')], ['Descrizione judo', 'Descrizione judo'])
  ok('og:url resta quello della pagina', meta(j, 'og:url'), `${DOMINIO}/judo/`)
  ok('le meta stanno nel head, una volta sola', [(j.match(/property="og:image"/g) || []).length, (j.match(/name="twitter:card"/g) || []).length, j.indexOf('twitter:card') < j.indexOf('</head>')], [1, 1, true])
}
{
  const r = genera(dati({ pagine: [pag('home', { descrizione: '' }), pag('judo', { descrizione: '' })], menu: [], rinvii: [] }))
  const h = c(r, 'judo/index.html')
  ok('senza descrizione niente twitter:description (come og:description)', [meta(h, 'og:description'), meta(h, 'twitter:description')], [null, null])
  ok('ma immagine e card ci sono lo stesso', [meta(h, 'og:image'), meta(h, 'twitter:card')], [IMMAGINE, 'summary_large_image'])
}

// ---------------------------------------------------------------------------
console.log('\nAnteprima: testo escapato, mai markup dai dati')
{
  const brutto = `A "B" <i>C</i> & D 'E'`
  const r = genera(dati({ pagine: [pag('home'), pag('judo', { titolo: brutto, descrizione: `"><script>x()</script> ${brutto}` })], menu: [], rinvii: [] }))
  const h = c(r, 'judo/index.html')
  const escapato = 'A &quot;B&quot; &lt;i&gt;C&lt;/i&gt; &amp; D &#39;E&#39;'
  ok('twitter:title escapato', meta(h, 'twitter:title'), escapato)
  ok('og:title escapato', meta(h, 'og:title'), escapato)
  ok('twitter:description senza < > "', /[<>"]/.test(meta(h, 'twitter:description') ?? '<'), false)
  ok('nessun <script> uscito dalla descrizione', h.includes('<script>x()'), false)
  ok('nessuna meta nuova con attributi spezzati', (h.match(/<meta [^>]*>/g) || []).filter((m) => /(og|twitter):/.test(m)).every((m) => /^<meta (property|name)="[a-z:_]+" content="[^"]*">$/.test(m)), true)
}
{
  const r = genera(dati({ dominio: 'https://www.officinedellosport.it' }))
  ok('col dominio www le immagini restano sul suo dominio', meta(c(r, 'judo/index.html'), 'og:image'), 'https://www.officinedellosport.it/risorse/social.png')
  ok('nessun indirizzo relativo in og:image / twitter:image', Object.keys(r).filter((f) => f.endsWith('.html') && /(og:image|twitter:image)" content="\//.test(r[f])), [])
}

// ---------------------------------------------------------------------------
console.log('\nAnteprima: il 404 e i rinvii non si condividono')
{
  const r = genera(dati())
  const e = c(r, '404.html')
  ok('404: noindex', /<meta name="robots" content="noindex">/.test(e), true)
  ok('404: niente og:image, twitter:image né twitter:card', [meta(e, 'og:image'), meta(e, 'twitter:image'), meta(e, 'twitter:card')], [null, null, null])
  const v = c(r, 'vecchia/index.html')
  ok('rinvio: noindex e niente meta social', [/noindex/.test(v), /og:image|twitter:/.test(v)], [true, false])
}

// ---------------------------------------------------------------------------
console.log("\nL'immagine sociale: 1200×630 in sito/risorse")
{
  const f = 'sito/risorse/social.png'
  ok('il file c\'è', existsSync(f), true)
  const b = existsSync(f) ? readFileSync(f) : Buffer.alloc(0)
  ok('è un PNG', b.subarray(0, 8).toString('hex'), '89504e470d0a1a0a')
  ok('misura 1200×630', b.length >= 24 ? [b.readUInt32BE(16), b.readUInt32BE(20)] : null, [1200, 630])
  ok('pesa meno di 300 KB (le anteprime lente si scartano)', b.length > 0 && b.length < 300 * 1024, true)
}

// ---------------------------------------------------------------------------
console.log('\nllms.txt: generato dalle pagine pubblicate')
{
  const r = genera(dati())
  const t = c(r, 'llms.txt')
  const righe = t.split('\n')
  ok('llms.txt c\'è alla radice', typeof r['llms.txt'], 'string')
  ok('comincia col nome del sito', righe[0], '# Officine dello Sport')
  ok('poi la descrizione della home come citazione', righe[2], '> Descrizione home')
  ok('sezione Corsi: solo i corsi della pagina «corsi», con link assoluto e riga', t.includes(`## Corsi\n\n- [Titolo judo](${DOMINIO}/judo/): Descrizione judo\n- [Titolo aikido](${DOMINIO}/aikido/): Descrizione aikido\n`), true)
  ok('sezione Pagine: le altre pagine (non corsi, non di legge), in ordine di indirizzo', t.includes(`## Pagine\n\n- [Titolo contatti](${DOMINIO}/contatti/): Descrizione contatti\n- [Titolo corsi](${DOMINIO}/corsi/): Descrizione corsi\n- [Titolo orari](${DOMINIO}/orari/): Descrizione orari\n`), true)
  ok('le pagine di legge stanno in Opzionale', t.includes(`## Opzionale\n\n- [Titolo privacy](${DOMINIO}/privacy/): Descrizione privacy\n`), true)
  ok('la home non è un elemento dell\'elenco (è già nella citazione)', t.includes(`](${DOMINIO}/)`), false)
  ok('contatti veri, presi da CONTATTI', ['Via Sassi 26, Collegno', '346 329 2786', 'instagram.com/officine.dellosport', 'facebook.com/ilCentroJudo'].map((x) => t.includes(x)), [true, true, true, true])
  ok('niente HTML', /<[a-z/]/i.test(t), false)
  ok('niente data di oggi né lastmod', /20\d\d-\d\d-\d\d|lastmod/.test(t), false)
  ok('finisce con un a capo, senza righe doppie in fondo', [t.endsWith('\n'), t.endsWith('\n\n')], [true, false])
  ok('deterministico: due volte lo stesso file', c(genera(dati()), 'llms.txt'), t)
  ok('non dipende dall\'ordine delle pagine nei dati', c(genera(dati({ pagine: dati().pagine.slice().reverse() })), 'llms.txt'), t)
}
{
  const r = genera(dati({ pagine: [pag('home', { descrizione: '' }), pag('judo', { titolo: 'Judo\n[x](http://evil)', descrizione: 'Riga\ndue <b>g</b> &amp; "q"' }), pag('x/y'), pag('../z')], menu: [], rinvii: [] }))
  const t = c(r, 'llms.txt')
  ok('titolo e descrizione su una riga sola, senza tag', t.split('\n').filter((x) => x.includes('/judo/')).length, 1)
  ok('un titolo non apre un link finto', t.includes('http://evil)') && t.split('\n').some((x) => x.startsWith('[x]')), false)
  ok('slug non validi saltati', /x\/y|\.\.\/z/.test(t), false)
  ok('senza descrizione della home niente citazione vuota', /^>\s*$/m.test(t), false)
  ok('senza pagina «corsi» niente sezione Corsi inventata', t.includes('## Corsi'), false)
}
{
  const r = genera(dati({ pagine: [pag('home')], menu: [], rinvii: [] }))
  ok('anche col solo home il file c\'è e ha i contatti', [typeof r['llms.txt'], c(r, 'llms.txt').includes('## Contatti')], ['string', true])
  ok('sitemap e robots restano', ['sitemap.xml', 'robots.txt'].map((f) => typeof r[f]), ['string', 'string'])
}

console.log(guai ? `\n${guai} da correggere` : '\nTutto a posto')
process.exit(guai ? 1 : 0)
