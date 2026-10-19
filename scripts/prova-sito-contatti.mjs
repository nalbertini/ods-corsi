// ---------------------------------------------------------------------------
// La pagina Contatti come nel design «tatami blu e giallo», senza browser.
//
//   node scripts/prova-sito-contatti.mjs
//
// La regola è in docs/sito/contatti.md: prima del primo titolo grande i `h3`
// sono le tessere dei recapiti (quattro colonne, giallo-blu-inchiostro-chiaro),
// il corpo di una tessera finisce alla prima foto; poi vengono la mappa (la
// prima foto), il pulsante delle indicazioni e la fila di foto, tutti nella
// stessa sezione. Le domande hanno le tessere a scacchiera giallo e chiaro.
// Il CSS si legge come testo.
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
const testo =
  '<h3>Telefono</h3><p>346 329 2786</p><h3>Instagram</h3><p>officine.dellosport</p><h3>Facebook</h3><p>Officine dello Sport</p>' +
  '<h3>Indirizzo</h3><p>Via Vittorio Sassi 26, Collegno</p><p>A pochi metri dalla metropolitana Fermi</p>' +
  `${img(1)}<p><a class="pulsante" href="https://maps.example/x">Ottieni indicazioni</a></p><p>A pochi metri dalla metropolitana Fermi</p>${img(2)}${img(3)}${img(4)}` +
  '<h2>Hai qualche domanda?</h2><p>Qui trovi le informazioni.</p>' + [1, 2, 3, 4, 5, 6].map((n) => `<h3>Domanda ${n}?</h3><p>Risposta ${n}</p>`).join('')
const genera = (slug, t) => g.generaSito({ dominio: 'https://officinedellosport.it', pagine: [{ slug: 'home', titolo: 'H', descrizione: 'd', testo: '<p>x</p>' }, { slug, titolo: 'T', descrizione: 'd', testo: t }], menu: [], rinvii: [], ospitiImmagini: [P] })
const html = genera('contatti', testo)['contatti/index.html']
const conta = (x, re) => (x.match(re) || []).length
const CSS = html.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? ''
const base = CSS.slice(0, CSS.indexOf('@media'))
const css = (sel) => [...base.matchAll(/([^{}@]+)\{([^{}]*)\}/g)].filter((m) => m[1].trim() === sel).map((m) => m[2]).join(';')
// La testata ha le sue regole in coda (CSS_TESTATA): di base, sul computer (≥901px) e sul telefono.
const coda = CSS.slice(CSS.indexOf('.tasto-menu,.testata .chiudi'))
const codaBase = coda.slice(0, coda.indexOf('@media'))
const codaPc = coda.slice(coda.indexOf('@media (min-width:901px)'), coda.indexOf('@media (max-width:900px)'))
const regolaDi = (parte, sel) => [...parte.matchAll(/([^{}@]+)\{([^{}]*)\}/g)].filter((m) => m[1].trim() === sel).map((m) => m[2]).join(';')
const apertura = (html.match(/<section class="sezione apertura">([\s\S]*?)<\/section>/) || [, ''])[1]

console.log('\n1. I recapiti: tessere prima del primo titolo grande')
{
  ok('una griglia da 4 tessere «recapiti» nella sezione di apertura', conta(apertura, /<div class="tessere n-4 recapiti">/g), 1)
  ok('i colori: giallo, blu, inchiostro, chiara', [...apertura.matchAll(/<article class="tessera (\w+)/g)].map((m) => m[1]), ['giallo', 'blu', 'inchiostro', 'chiara'])
  ok('il telefono è un valore breve, l’Instagram no', [...apertura.matchAll(/<article class="tessera \w+( breve)?">/g)].map((m) => Boolean(m[1])), [true, false, false, false])
  ok('l’indirizzo ha il valore e la nota', /<h3>Indirizzo<\/h3><p>Via Vittorio Sassi 26, Collegno<\/p><p>A pochi metri dalla metropolitana Fermi<\/p>/.test(apertura), true)
  ok('l’ultima tessera non si prende la mappa', conta(apertura.split('</article></div>')[0], /<img/g), 0)
  ok('la mappa è la prima foto: larga, dopo le tessere', apertura.indexOf('tessera foto larga') > apertura.indexOf('recapiti'), true)
  ok('poi il pulsante «Ottieni indicazioni», poi la fila di 3 foto', [apertura.indexOf('Ottieni indicazioni') > apertura.indexOf('tessera foto larga'), apertura.indexOf('foto-fila') > apertura.indexOf('Ottieni indicazioni'), conta(apertura, /<div class="foto-fila">/g)], [true, true, 1])
  ok('le domande sono una sezione a parte con 6 tessere', conta(html.split('Hai qualche domanda?')[1], /<article class="tessera/g), 6)
  ok('senza foto dopo i recapiti la sezione è solo le tessere', (genera('contatti', '<h3>Telefono</h3><p>1</p><h3>Mail</h3><p>2</p>')['contatti/index.html'].match(/<section class="sezione apertura">([\s\S]*?)<\/section>/) || [, ''])[1].replace(/<article[\s\S]*?<\/article>/g, '').replace(/<\/?div[^>]*>/g, ''), '')
  ok('altre pagine: i titoli prima del primo grande restano un testo in colonna', /class="apertura"|sezione apertura/.test(genera('altra', testo)['altra/index.html']), false)
  ok('la pagina ha la sua classe su main, la Home no', [/<main class="pagina-contatti">/.test(html), /<main>/.test(g.generaSito({ dominio: 'https://officinedellosport.it', pagine: [{ slug: 'home', titolo: 'H', descrizione: 'd', testo: '<p>x</p>' }], menu: [], rinvii: [] })['index.html'])], [true, true])
}

console.log('\n2. Le misure del design a 1440px')
{
  ok('titolo da 200px', /clamp\(56px,\s*13\.9vw,\s*200px\)/.test(css('.pagina-contatti h1')), true)
  ok('recapiti: titolo 56px, tessere alte 300px, padding 24px 26px', [/font-size:\s*56px/.test(css('.recapiti h3')), /minmax\(300px,\s*auto\)/.test(css('.recapiti')), /padding:\s*24px 26px/.test(css('.recapiti .tessera'))], [true, true, true])
  ok('quattro tessere per riga: 12 colonne, ognuna ne prende 3 (la regola n-4)', /repeat\(12,\s*1fr\)/.test(css('.recapiti')), true)
  ok('il valore è 36px, 44px se breve', [/font-size:\s*36px/.test(css('.recapiti p:first-of-type')), /font-size:\s*44px/.test(css('.recapiti .breve p:first-of-type'))], [true, true])
  ok('la nota è Inter 17px', /font-size:\s*17px/.test(css('.recapiti p:not(:first-of-type)')), true)
  ok('mappa alta 520px, 96px dopo i recapiti', [/height:\s*520px/.test(css('.apertura figure.larga img')), /padding-bottom:\s*96px/.test(css('.sezione.apertura')), /margin-top:\s*96px/.test(css('.apertura>.tessere+*'))], [true, true, true])
  ok('foto alte 536px, 96px sopra', [/height:\s*536px/.test(css('.apertura .foto-fila img')), /margin-top:\s*96px/.test(css('.apertura>.foto-fila'))], [true, true])
  ok('domande: titolo 38px, tessere alte 330px, padding 26px 28px', [/font-size:\s*38px/.test(css('.pagina-contatti .sezione:not(.apertura) .tessera h3')), /minmax\(330px,\s*auto\)/.test(css('.pagina-contatti .sezione:not(.apertura) .tessere')), /padding:\s*26px 28px/.test(css('.pagina-contatti .sezione:not(.apertura) .tessera'))], [true, true, true])
  ok('domande: tessere dispari gialle, scacchiera col chiaro', /background:\s*var\(--giallo\)/.test(css('.pagina-contatti .sezione:not(.apertura) .tessera:nth-child(odd)')), true)
  ok('introduzione delle domande a 22px', /font-size:\s*22px/.test(css('.pagina-contatti .sezione:not(.apertura) .colonna')), true)
}

console.log('\n3. Il telefono (≤900px)')
{
  const mob = CSS.slice(CSS.indexOf('@media (max-width:900px)'))
  const m = (sel) => [...mob.matchAll(/([^{}@]+)\{([^{}]*)\}/g)].filter((x) => x[1].trim() === sel).map((x) => x[2]).join(';')
  ok('sul telefono i recapiti in colonna', [/grid-template-columns:\s*1fr/.test(m('.recapiti')), /grid-column:\s*1/.test(m('.tessere.n-4.recapiti>*'))], [true, true])
  ok('titolo 19.5vw (76px a 390)', /font-size:\s*19\.5vw/.test(m('.pagina-contatti h1')), true)
  ok('recapiti: titolo 38px, valore 32px, alti 130px, padding 20px', [/font-size:\s*38px/.test(m('.recapiti h3')), /font-size:\s*32px/.test(m('.recapiti p:first-of-type,.recapiti .breve p:first-of-type')), /minmax\(130px,\s*auto\)/.test(m('.recapiti')), /padding:\s*20px/.test(m('.recapiti .tessera'))], [true, true, true, true])
  ok('mappa alta 380px, foto alte 200px e la terza non c’è', [/height:\s*380px/.test(m('.apertura figure.larga img')), /height:\s*200px/.test(m('.apertura .foto-fila img')), /display:\s*none/.test(m('.apertura .foto-fila figure:nth-child(3)'))], [true, true, true])
  ok('domande: titolo 30px, tessere alte 160px, padding 20px', [/font-size:\s*30px/.test(m('.pagina-contatti .sezione:not(.apertura) .tessera h3')), /minmax\(160px,\s*auto\)/.test(m('.pagina-contatti .sezione:not(.apertura) .tessere')), /padding:\s*20px/.test(m('.pagina-contatti .sezione:not(.apertura) .tessera'))], [true, true, true])
}

console.log('\n4. Testata e piede come nel design')
{
  const voce = (e, sl) => ({ dove: 'menu', ordine: 1, etichetta: e, slug: sl, indirizzo: null })
  const due = g.generaSito({ dominio: 'https://officinedellosport.it', pagine: [{ slug: 'home', titolo: 'H', descrizione: 'd', testo: '<p>x</p>' }, { slug: 'contatti', titolo: 'C', descrizione: 'd', testo: '<p>y</p>' }], menu: [voce('Home', 'home'), { ...voce('Contattaci', 'contatti'), ordine: 2 }], rinvii: [] })
  // Niente pulsante «Scrivici»: «Contatti» è solo una voce del menu, con questa etichetta qualunque cosa scriva la segreteria; in /contatti/ è la voce segnata.
  const testataDi = (h) => (h.match(/<header class="testata">[\s\S]*?<\/header>/) || [''])[0]
  const tc = testataDi(due['contatti/index.html'])
  const th = testataDi(due['index.html'])
  ok('in Contatti la voce del menu è «Contatti» con aria-current="page", anche se la segreteria ha scritto «Contattaci»', /<nav id="menu"[\s\S]*?<a [^>]*href="\/contatti\/"[^>]*aria-current="page"[^>]*>Contatti<\/a>/.test(tc) || /<a [^>]*aria-current="page"[^>]*href="\/contatti\/"[^>]*>Contatti<\/a>/.test(tc), true)
  ok('in Contatti la testata non ha nessun «Scrivici»', /Scrivici/.test(tc), false)
  ok('in Contatti la testata non ha pulsanti segnati come pagina corrente', /<span class="pulsante/.test(tc), false)
  ok('nelle altre pagine la testata ha un solo link a /contatti/ (la voce «Contatti» del menu), nessun «Scrivici» e il menu del telefono ha solo «Iscriviti» come pulsante', [(th.match(/<a [^>]*href="\/contatti\/"[^>]*>Contatti<\/a>/g) || []).length, (th.match(/href="\/contatti\/"/g) || []).length, /Scrivici/.test(th), /nel-menu[^>]*href="\/contatti\/"/.test(th)], [1, 1, false, false])
  ok('nessun <a> dice «Contattaci», anche se la segreteria ha scritto così nel menu', [due['index.html'], due['contatti/index.html']].map((h) => /<a [^>]*>\s*Contattaci\s*<\/a>/.test(h)), [false, false])
  ok('il piede di ogni pagina mostra «Contatti» verso /contatti/, mai «Scrivici»', [due['index.html'], due['contatti/index.html']].map((h) => [/<footer[\s\S]*<a href="\/contatti\/"[^>]*>Contatti<\/a>[\s\S]*<\/footer>/.test(h), /Scrivici/.test(h)]), [[true, false], [true, false]])
  // Etichetta sempre «Contatti» e posto scelto dalla segreteria in MENU (non più tolta dall'elenco).
  const ordinato = g.generaSito({ dominio: 'https://officinedellosport.it', pagine: [{ slug: 'home', titolo: 'H', descrizione: 'd', testo: '<p>x</p>' }, { slug: 'corsi', titolo: 'Co', descrizione: 'd', testo: '<p>x</p>' }, { slug: 'contatti', titolo: 'C', descrizione: 'd', testo: '<p>y</p>' }], menu: [voce('Home', 'home'), { ...voce('Parlaci', 'contatti'), ordine: 2 }, { ...voce('Corsi', 'corsi'), ordine: 3 }], rinvii: [] })
  const elenco = ((ordinato['corsi/index.html'].match(/<nav id="menu"[\s\S]*?<\/nav>/) || [''])[0].match(/<a [^>]*>[^<]*<\/a>/g) || []).map((x) => x.replace(/<[^>]*>/g, ''))
  ok('«Parlaci» scritto dalla segreteria diventa «Contatti», al posto scelto nel menu', [elenco.filter((x) => /Home|Parlaci|Contatti|Corsi/.test(x)), /Parlaci|Scrivici/.test(ordinato['corsi/index.html'])], [['Home', 'Contatti', 'Corsi'], false])
  const senzaC = g.generaSito({ dominio: 'https://officinedellosport.it', pagine: [{ slug: 'home', titolo: 'H', descrizione: 'd', testo: '<p>x</p>' }], menu: [voce('Home', 'home')], rinvii: [] })
  ok('senza la pagina Contatti pubblicata: nessuna voce, nessun link a /contatti/', /\/contatti\/|Contatti/.test(senzaC['index.html']), false)
  ok('il titolo della pagina dato dal database non si tocca', /<h1[^>]*>[\s\S]*C[\s\S]*<\/h1>/.test(due['contatti/index.html']) && /<title>C\b/.test(due['contatti/index.html']), true)
  ok('la voce segnata ha il fondo giallo', /background:\s*var\(--giallo\)/.test(regolaDi(codaBase, '.testata nav a[aria-current]')), true)
  ok('testata: 22px sopra e sotto, marchio alto 110px, voci a 4px (più 16px di imbottitura)', [/padding:\s*22px var\(--margine\)/.test(css('.testata')), /height:\s*110px/.test(css('.logo img')), /gap:\s*4px/.test(regolaDi(codaPc, '.testata nav ul'))], [true, true, true])
  ok('i pulsanti in testata hanno 24px ai lati', /padding:\s*0 24px/.test(regolaDi(codaBase, '.testata .pulsante')), true)
  ok('titolo con interlinea .82', /line-height:\s*\.82/.test(css('.pagina-contatti h1')), true)
  ok('piede: margini come la pagina e 48px sotto, nome da 56px', [/margin:\s*0 var\(--margine\) 48px/.test(css('.piede')), /clamp\(44px,\s*3\.9vw,\s*56px\)/.test(css('.piede .nome'))], [true, true])
  const mob = CSS.slice(CSS.indexOf('@media (max-width:900px)'))
  const m = (sel) => [...mob.matchAll(/([^{}@]+)\{([^{}]*)\}/g)].filter((x) => x[1].trim() === sel).map((x) => x[2]).join(';')
  ok('telefono: testata 12px 16px, marchio alto 82px, menu aperto su fondo pieno con voci da 16px ai lati', [/padding:\s*12px var\(--margine\)(;|$)/.test(m('.testata')), /height:\s*82px/.test(m('.logo img')), /background:\s*var\(--fondo\)/.test(m('#menu:target')), /padding:\s*0 16px/.test(m('.testata nav a'))], [true, true, true, true])
  ok('telefono: la voce segnata resta gialla', /background:\s*var\(--giallo\)/.test(regolaDi(codaBase, '.testata nav a[aria-current]')), true)
  ok('telefono: pulsante nel menu con 24px ai lati, piede con 24px di margine sotto e 24px di spazio dentro', [/padding:\s*0 24px/.test(m('.testata .nel-menu')), /margin-bottom:\s*24px/.test(m('.piede')), /padding:\s*24px/.test(m('.piede'))], [true, true, true])
}

console.log('\n5. Quel che il design ha e il sito non aveva')
{
  const vuoto = g.generaSito({ dominio: 'https://officinedellosport.it', pagine: [{ slug: 'home', titolo: 'H', descrizione: 'd', testo: '<p>x</p>' }, { slug: 'contatti', titolo: 'C', descrizione: 'd', testo: '<p>y</p>' }], menu: [{ dove: 'menu', ordine: 1, etichetta: 'Home', slug: 'home', indirizzo: null }, { dove: 'menu', ordine: 2, etichetta: 'Contattaci', slug: 'contatti', indirizzo: null }, { dove: 'footer', ordine: 1, etichetta: 'Privacy policy', slug: null, indirizzo: '/privacy/' }], rinvii: [] })
  const c = vuoto['contatti/index.html']
  const pie = (c.match(/<footer[\s\S]*?<\/footer>/) || [''])[0]
  ok('la pagina Contatti non ha il pulsante «Contattaci» sotto il titolo e ha l’invito «Prova» in fondo', [/<a class="pulsante" href="\/contatti\/">Contattaci<\/a>/.test(c), /class="invito"/.test(c)], [false, true])
  ok('il pulsante in testata dice «Iscriviti», intero', /<a class="pulsante primario" href="https:\/\/app\.officinedellosport\.it\/iscrizioni\/"[^>]*>Iscriviti<\/a>/.test(c), true)
  ok('piede: il nome va a capo dopo «Officine», senza titoli né riga «©»', [/<p class="nome">Officine<br>dello Sport<\/p>/.test(pie), /<h2/.test(pie), /class="fine"/.test(pie)], [true, false, false])
  ok('piede: le pagine del menu e quelle di legge sono due elenchi senza titolo', [/<nav class="piede-menu" aria-label="Pagine"><a href="\/">Home<\/a><a href="\/contatti\/"[^>]*>Contatti<\/a><\/nav>/.test(pie), /<ul class="piede-legale"><li><a href="\/privacy\/">Privacy policy<\/a><\/li><\/ul>/.test(pie)], [true, true])
  const mappa = (apertura.match(/<figure class="tessera foto larga mappa">([\s\S]*?)<\/figure>/) || [, ''])[1]
  ok('la mappa ha segnaposto, targhetta con nome e indirizzo, e il credito OpenStreetMap', [/<span class="segnaposto" aria-hidden="true"><\/span>/.test(mappa), /<span class="targhetta">Officine dello Sport<span>Via Vittorio Sassi 26, Collegno<\/span><\/span>/.test(mappa), /<span class="credito">© OpenStreetMap contributors<\/span>/.test(mappa)], [true, true, true])
  ok('una sola mappa: le foto di dopo non l’hanno', conta(apertura, /mappa"/g), 1)
  ok('accanto al pulsante delle indicazioni c’è la nota (in una pillola bianca)', /<p>A pochi metri dalla metropolitana Fermi<\/p>/.test(apertura.split('foto-fila')[0].split('Ottieni indicazioni')[1] ?? ''), true)
  ok('mappa: segnaposto al centro (44px), targhetta a destra e in alto', [/left:\s*calc\(50% - 22px\)/.test(css('.mappa .segnaposto')), /top:\s*calc\(50% - 52px\)/.test(css('.mappa .targhetta')), /background:\s*var\(--giallo\)/.test(css('.mappa .segnaposto'))], [true, true, true])
  ok('mappa: targhetta con nome da 30px e indirizzo Inter 16px; credito da 12px', [/font-size:\s*30px/.test(css('.mappa .targhetta')), /font-size:\s*16px/.test(css('.mappa .targhetta span')), /font-size:\s*12px/.test(css('.mappa .credito'))], [true, true, true])
  ok('pillola: bianca, alta 56px, accanto al pulsante a 6px', [/background:\s*#fff/.test(css('.apertura>.tessere+.colonna p+p')), /min-height:\s*56px/.test(css('.apertura>.tessere+.colonna p+p')), /gap:\s*6px/.test(css('.apertura>.tessere+.colonna'))], [true, true, true])
  ok('foto: ritagliate a 50% 55%, la terza a 50% 30%', [/object-position:\s*50% 55%/.test(css('.apertura .foto-fila img')), /object-position:\s*50% 30%/.test(css('.apertura .foto-fila figure:nth-child(3) img'))], [true, true])
  const mob = CSS.slice(CSS.indexOf('@media (max-width:900px)'))
  const m = (sel) => [...mob.matchAll(/([^{}@]+)\{([^{}]*)\}/g)].filter((x) => x[1].trim() === sel).map((x) => x[2]).join(';')
  ok('telefono: la nota dell’indirizzo, la pillola e la frase delle domande non si vedono', [/display:\s*none/.test(m('.recapiti p:not(:first-of-type)')), /display:\s*none/.test(m('.apertura>.tessere+.colonna p+p')), /display:\s*none/.test(m('.pagina-contatti .sezione:not(.apertura) .colonna'))], [true, true, true])
  ok('telefono: mappa con targhetta in alto a sinistra (nome 26px), segnaposto da 40px, credito da 11px', [/left:\s*16px/.test(m('.mappa .targhetta')), /font-size:\s*26px/.test(m('.mappa .targhetta')), /width:\s*40px/.test(m('.mappa .segnaposto')), /font-size:\s*11px/.test(m('.mappa .credito'))], [true, true, true, true])
  ok('telefono: il piede è a blocco; menu e legge in riga con « · »', [/display:\s*block/.test(m('.piede')), /display:\s*inline/.test(m('.piede-menu a')), /content:\s*" · "/.test(m('.piede-menu a+a::before')), /opacity:\s*\.85/.test(m('.piede-legale'))], [true, true, true, true])
  ok('piede sul computer: social in riga con « · », colonne a 40px', [/content:\s*" · "/.test(css('.recapiti-piede li:last-child::before')), /gap:\s*40px/.test(css('.piede'))], [true, true])
}

console.log('\n6. L’invito e il piede, misure del design')
{
  ok('invito: 96px sopra, 6px sotto, alto 300px, padding 36px 40px', [/margin:\s*96px var\(--margine\) 6px/.test(css('.invito')), /height:\s*300px/.test(css('.invito')), /padding:\s*36px 40px/.test(css('.invito'))], [true, true, true])
  ok('invito: frase da 22px (520px al massimo), senza freccia, «Prova» da 170px', [/font-size:\s*22px/.test(css('.invito .frase')), /max-width:\s*520px/.test(css('.invito .frase')), /display:\s*none/.test(css('.invito .freccia')), /font-size:\s*170px/.test(css('.invito .parola')), /line-height:\s*\.8/.test(css('.invito .parola'))], [true, true, true, true, true])
  ok('piede: Inter 16px, interlinea 1.9, 40px dentro su tutti i lati', [/font-size:\s*16px/.test(css('.piede')), /line-height:\s*1\.9/.test(css('.piede')), /padding:\s*40px;|padding:\s*40px$/.test(css('.piede'))], [true, true, true])
  const mob = CSS.slice(CSS.indexOf('@media (max-width:900px)'))
  const m = (sel) => [...mob.matchAll(/([^{}@]+)\{([^{}]*)\}/g)].filter((x) => x[1].trim() === sel).map((x) => x[2]).join(';')
  ok('telefono invito: 48px sopra, alto almeno 260px, padding 22px, frase 17px, «Prova» 120px', [/margin(-top)?:\s*48px/.test(m('.invito')), /min-height:\s*260px/.test(m('.invito')), /padding:\s*22px/.test(m('.invito')), /font-size:\s*17px/.test(m('.invito .frase')), /font-size:\s*120px/.test(m('.invito .parola'))], [true, true, true, true, true])
}

console.log('\n7. La mappa del sito')
{
  const { existsSync, statSync } = await import('node:fs')
  ok('sito/risorse/mappa.webp c’è ed è sotto i 200 KB', existsSync('sito/risorse/mappa.webp') && statSync('sito/risorse/mappa.webp').size < 200 * 1024, true)
}

console.log('\n8. Il filtro dei pulsanti verso Contatti scritti nel testo')
{
  const D = 'https://officinedellosport.it'
  const f = (h) => g.senzaPulsantiContatti(h, D)
  const SCR = (href) => `<a class="pulsante" href="${href}">Scrivici</a>`
  ok('relativo, con o senza «/», con ? o #', [f(`<p>${SCR('/contatti/')}</p>`), f(`<p>${SCR('/contatti')}</p>`), f(`<p>${SCR('/contatti/?a=1')}</p>`), f(`<p>${SCR('/contatti/#mappa')}</p>`)], ['', '', '', ''])
  ok('assoluto sul dominio del sito sì, su un altro sito no', [f(`<p>${SCR(D + '/contatti/')}</p>`), f(`<p>${SCR('https://altrosito.it/contatti/')}</p>`)], ['', `<p>${SCR('https://altrosito.it/contatti/')}</p>`])
  ok('«Iscriviti» accanto resta; il paragrafo vuoto (anche con attributi o &nbsp;) sparisce', [f(`<p><a class="pulsante" href="/x/">Iscriviti</a> ${SCR('/contatti/')}</p>`), f(`<p class="x">${SCR('/contatti/')}&nbsp;</p>`)], ['<p><a class="pulsante" href="/x/">Iscriviti</a> </p>', ''])
  ok('un link in linea, un’altra classe e un altro indirizzo restano', [f('<p>Vai ai <a href="/contatti/">contatti</a></p>'), f('<p><a class="pulsante-x" href="/contatti/">A</a></p>'), f(`<p>${SCR('https://wa.me/39346')}</p>`)], ['<p>Vai ai <a href="/contatti/">contatti</a></p>', '<p><a class="pulsante-x" href="/contatti/">A</a></p>', `<p>${SCR('https://wa.me/39346')}</p>`])
}

console.log(guai ? `\n✗ ${guai} casi falliti` : '\nTutto a posto.')
process.exit(guai ? 1 : 0)
