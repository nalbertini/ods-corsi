// ---------------------------------------------------------------------------
// I dati strutturati (JSON-LD) del sito pubblico, senza browser.
//
//   node scripts/prova-sito-dati.mjs
//
// Servono a Google e agli assistenti AI (ChatGPT, Gemini, Perplexity) per
// capire chi siamo, dove, quali corsi e che domande ci fanno. In ogni pagina
// c'è al massimo UN blocco <script type="application/ld+json"> con un `@graph`:
// è un dato, non codice, e non contiene mai testo preso dalle pagine senza
// averlo escapato (un titolo con «</script>» non deve poter uscire dal blocco).
// ---------------------------------------------------------------------------
import { build } from 'esbuild'
import { existsSync } from 'node:fs'

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
const sito = await carica('src/lib/sito.ts')

let guai = 0
const ok = (cosa, avuto, voluto) => {
  const va = JSON.stringify(avuto) === JSON.stringify(voluto)
  console.log(va ? '  ✓' : '  ✗', cosa, va ? '' : `— atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`)
  if (!va) guai++
}

const DOMINIO = 'https://www.officinedellosport.it'
const pag = (slug, extra = {}) => ({ slug, titolo: `Titolo ${slug}`, descrizione: `Descrizione ${slug}`, testo: `<p>Testo di ${slug}</p>`, ...extra })
const FAQ = '<h2>Hai qualche domanda?</h2><h3>Posso fare una prova?</h3><p>Sì, <strong>la prima lezione</strong> è gratis. <a href="/contatti/">Scrivici</a>.</p><h3>Servono scarpe?</h3><p>No, si sta scalzi.</p>'
const ELENCO_CORSI = '<ul><li><a href="/judo/">Judo</a></li><li><a href="/aikido/">Aikido</a></li><li><a href="/contatti/">Contatti</a></li></ul>'
const dati = (o = {}) => ({
  dominio: DOMINIO,
  pagine: [
    pag('home', { testo: FAQ }),
    pag('corsi', { testo: ELENCO_CORSI }),
    pag('judo'),
    pag('aikido'),
    pag('orari'),
    pag('contatti'),
    pag('privacy', { diLegge: true }),
  ],
  menu: [],
  rinvii: [{ da: 'vecchia', a: 'judo' }],
  ...o,
})
const genera = (d) => {
  try {
    return g.generaSito(d)
  } catch (e) {
    return {}
  }
}
const RE = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g
const blocchi = (f) => [...(f ?? '').matchAll(RE)].map((m) => m[1])
/** I nodi del @graph di una pagina, o null se non c'è esattamente un blocco che si legge. */
const nodi = (r, file) => {
  const b = blocchi(r[file])
  if (b.length !== 1) return null
  try {
    return JSON.parse(b[0])['@graph'] ?? null
  } catch {
    return null
  }
}
const tipo = (n, t) => (n ?? []).filter((x) => [x['@type']].flat().includes(t))
const uno = (n, t) => tipo(n, t)[0]

// ---------------------------------------------------------------------------
console.log('\nHome: la sede')
{
  const r = genera(dati())
  const n = nodi(r, 'index.html')
  ok('un solo blocco ld+json che si legge', n !== null, true)
  const s = uno(n, 'SportsActivityLocation')
  ok('c’è la sede, con @id fisso', s?.['@id'], `${DOMINIO}/#sede`)
  ok('nome e indirizzo web', [s?.name, s?.url], ['Officine dello Sport', `${DOMINIO}/`])
  ok('indirizzo postale', s?.address, { '@type': 'PostalAddress', streetAddress: 'Via Vittorio Sassi 26', postalCode: '10093', addressLocality: 'Collegno', addressRegion: 'TO', addressCountry: 'IT' })
  ok('telefono internazionale, senza spazi', s?.telephone, '+393463292786')
  ok('logo del sito', s?.logo, `${DOMINIO}/risorse/logo.webp`)
  ok('sameAs: Instagram e Facebook', s?.sameAs, ['https://www.instagram.com/officine.dellosport/', 'https://www.facebook.com/ilCentroJudo/'])
  ok('la descrizione della pagina', s?.description, 'Descrizione home')
  // L'indirizzo postale sta in sitoDati.ts a mano: se la sede cambia in sito.ts e là no, questa prova diventa rossa.
  const mappa = decodeURIComponent(String(sito.CONTATTI?.mappa ?? '')).replace(/\+/g, ' ')
  const a = s?.address
  ok('l’indirizzo postale è quello di CONTATTI.mappa', [mappa.includes(String(a?.streetAddress)), mappa.includes(String(a?.postalCode)), mappa.includes(String(a?.addressLocality)), mappa.endsWith(String(a?.addressRegion))], [true, true, true, true])
  ok('il logo indicato esiste in sito/risorse', existsSync('sito/risorse/logo.webp'), true)
  ok('la home non ha BreadcrumbList né Course', [tipo(n, 'BreadcrumbList').length, tipo(n, 'Course').length], [0, 0])
  ok('la pagina contatti ha la stessa sede', uno(nodi(r, 'contatti/index.html'), 'SportsActivityLocation')?.['@id'], `${DOMINIO}/#sede`)
  ok('le altre pagine non la ripetono', ['judo/index.html', 'orari/index.html', 'privacy/index.html'].map((f) => tipo(nodi(r, f), 'SportsActivityLocation').length), [0, 0, 0])
}

// ---------------------------------------------------------------------------
console.log('\nDomande e risposte: FAQPage')
{
  const r = genera(dati())
  const f = uno(nodi(r, 'index.html'), 'FAQPage')
  const q = f?.mainEntity ?? []
  ok('una domanda per ogni titolo che finisce con «?»', q.map((x) => x.name), ['Posso fare una prova?', 'Servono scarpe?'])
  ok('tipo Question con risposta Answer', q.map((x) => [x['@type'], x.acceptedAnswer?.['@type']]), [['Question', 'Answer'], ['Question', 'Answer']])
  ok('la risposta è testo semplice, senza tag', q.map((x) => x.acceptedAnswer?.text), ['Sì, la prima lezione è gratis. Scrivici.', 'No, si sta scalzi.'])
  const r3 = genera(dati({ pagine: [pag('home', { testo: '<h2>D</h2><h3>Senza risposta?</h3><h3><strong>Con grassetto?</strong></h3><p>Sì.</p><h2>Altro</h2><p>Fuori sezione.</p>' })] }))
  ok('domanda senza risposta scartata, tag nel titolo tolti, la sezione dopo non entra', uno(nodi(r3, 'index.html'), 'FAQPage')?.mainEntity?.map((x) => [x.name, x.acceptedAnswer.text]), [['Con grassetto?', 'Sì.']])
  ok('pagina senza domande: niente FAQPage', tipo(nodi(r, 'judo/index.html'), 'FAQPage').length, 0)
  const r2 = genera(dati({ pagine: [pag('home', { testo: '<h2>Titoli</h2><h3>Chi siamo</h3><p>Noi.</p>' })] }))
  ok('titoli senza «?»: niente FAQPage', blocchi(r2['index.html']).length === 1 && tipo(nodi(r2, 'index.html'), 'FAQPage').length, 0)
}

// ---------------------------------------------------------------------------
console.log('\nBriciole e corsi')
{
  const r = genera(dati())
  const briciole = (f) => (uno(nodi(r, f), 'BreadcrumbList')?.itemListElement ?? []).map((x) => [x.position, x.name, x.item])
  ok('un corso: Home › Corsi › Corso', briciole('judo/index.html'), [[1, 'Officine dello Sport', `${DOMINIO}/`], [2, 'Titolo corsi', `${DOMINIO}/corsi/`], [3, 'Titolo judo', `${DOMINIO}/judo/`]])
  ok('una pagina che non è un corso: Home › Pagina', briciole('orari/index.html'), [[1, 'Officine dello Sport', `${DOMINIO}/`], [2, 'Titolo orari', `${DOMINIO}/orari/`]])
  ok('anche la pagina di legge ha le briciole', briciole('privacy/index.html').length, 2)
  ok('la pagina Corsi: Home › Corsi', briciole('corsi/index.html').length, 2)
  const c = uno(nodi(r, 'judo/index.html'), 'Course')
  ok('Course: nome, descrizione, indirizzo', [c?.name, c?.description, c?.url], ['Titolo judo', 'Descrizione judo', `${DOMINIO}/judo/`])
  ok('Course: chi lo tiene, con nome (Google lo chiede)', c?.provider, { '@type': 'Organization', name: 'Officine dello Sport', url: `${DOMINIO}/` })
  ok('anche l’altro corso linkato da Corsi', tipo(nodi(r, 'aikido/index.html'), 'Course').length, 1)
  ok('non sono corsi: orari, contatti, legge, corsi, home', ['orari', 'contatti', 'privacy', 'corsi'].map((s) => tipo(nodi(r, `${s}/index.html`), 'Course').length).concat(tipo(nodi(r, 'index.html'), 'Course').length), [0, 0, 0, 0, 0])
  const legge = genera(dati({ pagine: [...dati().pagine, pag('cookie', { diLegge: true })].map((p) => (p.slug === 'corsi' ? { ...p, testo: `${ELENCO_CORSI}<a href="/privacy/">p</a><a href="/non-c-e/">x</a>` } : p)) }))
  ok('un link di «corsi» a una pagina di legge o inesistente non crea corsi', [tipo(nodi(legge, 'privacy/index.html'), 'Course').length, Object.keys(legge).includes('non-c-e/index.html')], [0, false])
  const senza = genera(dati({ pagine: dati().pagine.filter((p) => p.slug !== 'corsi') }))
  ok('senza la pagina Corsi: nessun Course e briciole Home › Pagina', [tipo(nodi(senza, 'judo/index.html'), 'Course').length, (uno(nodi(senza, 'judo/index.html'), 'BreadcrumbList')?.itemListElement ?? []).length], [0, 2])
}

// ---------------------------------------------------------------------------
console.log('\nSicurezza e stabilità')
{
  const titolo = '</script><script>alert(1)</script> & "x"'
  const r = genera(dati({ pagine: [pag('home'), pag('judo', { titolo, descrizione: '</script>' })] }))
  const f = r['judo/index.html'] ?? ''
  ok('un solo <script, quello nostro', (f.match(/<script/gi) ?? []).length, 1)
  ok('un solo </script>', (f.match(/<\/script/gi) ?? []).length, 1)
  ok('il titolo torna uguale una volta letto il JSON', uno(nodi(r, 'judo/index.html'), 'BreadcrumbList')?.itemListElement?.[1]?.name, titolo)
  const intero = genera(dati())
  ok('404 e rinvii senza blocco', [blocchi(intero['404.html']).length, blocchi(intero['vecchia/index.html']).length], [0, 0])
  ok('stessi dati, stessi file', JSON.stringify(intero) === JSON.stringify(genera(dati())), true)
  // Un blocco ld+json scritto a mano nell'editor non deve arrivare in pagina: ne resta uno solo, il nostro.
  const ostile = genera(dati({ pagine: [pag('home'), pag('judo', { testo: '<p>ok</p><script type="application/ld+json">{"@type":"Course"}</script>' })] }))
  ok('testo con un suo ld+json: nel file ce n’è uno solo, il nostro', [blocchi(ostile['judo/index.html']).length, (ostile['judo/index.html'] ?? '').includes('"@type":"Course"}')], [1, false])
  const strani = genera(dati({ pagine: [pag('home'), pag('judo', { titolo: 'A & B\u2028C' })] }))
  ok('«&» e U+2028 nel JSON sono escapati e tornano uguali', [blocchi(strani['judo/index.html'])[0]?.includes('&'), /\u2028/.test(blocchi(strani['judo/index.html'])[0] ?? ''), uno(nodi(strani, 'judo/index.html'), 'BreadcrumbList')?.itemListElement?.[1]?.name], [false, false, 'A & B\u2028C'])
}

console.log(guai ? `\n✗ ${guai} casi falliti` : '\nTutto a posto.')
process.exit(guai ? 1 : 0)
