// ---------------------------------------------------------------------------
// Le visite al sito pubblico, contate senza cookie (GoatCounter), senza browser.
//
//   node scripts/prova-sito-statistiche.mjs
//
// Il codice del sito su GoatCounter arriva solo dalla variabile SITO_STATISTICHE,
// che legge `scripts/genera-sito.mjs`. Senza (o vuota) il sito è identico a
// prima; con un codice fuori forma pure, e la pubblicazione non si ferma (un
// avviso nel giro). Con un codice buono ogni pagina ha un solo script esterno,
// quello del contatore, e i link a iscrizione, telefono e WhatsApp contano un
// clic col loro nome, mai col testo del link. I rinvii, la sitemap, robots.txt
// e llms.txt restano come sono; l'anteprima del pannello non conta niente.
// ---------------------------------------------------------------------------
import { build } from 'esbuild'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'

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

const CODICE = 'ods-prova'
const SCRIPT = `<script data-goatcounter="https://${CODICE}.goatcounter.com/count" async src="https://gc.zgo.at/count.js"></script>`
const SCRIPT_404 = `<script data-goatcounter="https://${CODICE}.goatcounter.com/count" data-goatcounter-settings='{"title":"404"}' async src="https://gc.zgo.at/count.js"></script>`
const ISCRIZIONE = 'https://app.officinedellosport.it/iscrizioni/'

const pag = (slug, testo, extra = {}) => ({ slug, titolo: `Titolo ${slug}`, descrizione: `Descrizione ${slug}`, testo, ...extra })
// Link di ogni tipo nel testo: quelli da contare e quelli che non si contano mai.
const LINK = [
  `<p><a href="${ISCRIZIONE}?corso=judo">Iscrivi Mario Rossi al judo</a></p>`,
  '<p><a href="tel:+393463292786">Chiama</a> o <a href="https://wa.me/393463292786?text=Ciao">WhatsApp</a></p>',
  '<p><a href="https://www.instagram.com/officine.dellosport/">Instagram</a> <a href="mailto:asdilcentrojudo@gmail.com">Email</a> <a href="/judo/">Judo</a> <a href="https://esempio.it/pagina">Altro</a></p>',
  // Somigliano ai link da contare ma non lo sono: un altro sito con /iscrizioni/, un tel: dentro un indirizzo, WhatsApp da un altro indirizzo, wa.me dentro un indirizzo.
  '<p><a href="https://esempio.it/iscrizioni/">Un altro sito</a> <a href="https://esempio.it/?x=tel:123">Non è un telefono</a> <a href="https://api.whatsapp.com/send?phone=39">Non è wa.me</a> <a href="https://esempio.it/?x=https://wa.me/39">wa.me dentro un indirizzo</a></p>',
].join('')
// Scritti a mano, non con le regole del codice: se le regole si allargano, la prova se ne accorge.
const NON_CONTATI = ['https://esempio.it/iscrizioni/', 'https://esempio.it/?x=tel:123', 'https://api.whatsapp.com/send?phone=39', 'https://esempio.it/?x=https://wa.me/39']
const dati = (o = {}) => ({
  dominio: 'https://www.officinedellosport.it',
  pagine: [pag('home', `<p>Benvenuti</p>${LINK}`), pag('contatti', `<p>Dove siamo</p>${LINK}`), pag('judo', `<p>Judo</p>${LINK}`), pag('privacy', '<p>Testo di legge</p>', { diLegge: true })],
  menu: [{ dove: 'menu', ordine: 1, etichetta: 'Judo', slug: 'judo', indirizzo: null }],
  rinvii: [{ da: 'vecchio-judo', a: 'judo' }],
  ...o,
})
const genera = (d) => {
  const r = prova(() => g.generaSito(d))
  return typeof r === 'object' && r !== null ? r : { errore: String(r) }
}
const PAGINE = ['index.html', 'contatti/index.html', 'judo/index.html', 'privacy/index.html', '404.html']
const head = (h) => h.slice(0, Math.max(0, h.indexOf('</head>')))
const script = (h) => [...h.matchAll(/<script\b[^>]*>/gi)].map((m) => m[0])
const esterni = (h) => script(h).filter((s) => /\ssrc=/i.test(s))
const link = (h) => [...h.matchAll(/<a\b[^>]*>/gi)].map((m) => m[0])
const href = (a) => /\shref="([^"]*)"/i.exec(a)?.[1] ?? ''
const nomeAtteso = (a) => (href(a).startsWith(ISCRIZIONE) ? 'iscriviti' : /^tel:/i.test(href(a)) ? 'chiama' : /^https:\/\/wa\.me\//i.test(href(a)) ? 'scrivici' : null)
const clic = (a) => /\sdata-goatcounter-click="([^"]*)"/.exec(a)?.[1] ?? null
const conGoat = (r) => Object.keys(r).filter((f) => /goatcounter|gc\.zgo\.at/i.test(r[f]))

// ---------------------------------------------------------------------------
console.log('\nSenza codice: il sito è quello di sempre')
{
  const senza = genera(dati())
  ok('il sito si genera', typeof senza.errore, 'undefined')
  ok('nessun file nomina goatcounter', conGoat(senza), [])
  for (const [nome, valore] of [['vuoto', ''], ['di soli spazi', '   '], ['undefined', undefined]]) {
    ok(`con il codice ${nome} i file sono identici byte per byte`, JSON.stringify(genera(dati({ statistiche: valore }))), JSON.stringify(senza))
  }
}

// ---------------------------------------------------------------------------
console.log('\nCon un codice buono')
{
  const r = genera(dati({ statistiche: CODICE }))
  ok('il sito si genera', typeof r.errore, 'undefined')
  for (const f of PAGINE) {
    const h = r[f] ?? ''
    const attesto = f === '404.html' ? SCRIPT_404 : SCRIPT
    ok(`${f}: un solo script esterno, quello di GoatCounter`, esterni(h), [attesto.replace('</script>', '')])
    ok(`${f}: lo script sta nella <head>, una volta sola`, [head(h).split(attesto).length - 1, h.split(attesto).length - 1], [1, 1])
    ok(`${f}: gli altri script sono solo i dati strutturati (ld+json)`, script(h).filter((s) => !/\ssrc=/i.test(s) && s !== '<script type="application/ld+json">'), [])
    ok(`${f}: nessun attributo on…= (codice in linea)`, /<[^>]*\son[a-z]+\s*=/i.test(h), false)
  }
  ok('le pagine non dicono niente di impostazioni (solo la 404)', PAGINE.filter((f) => f !== '404.html' && /data-goatcounter-settings/.test(r[f] ?? '')), [])
  ok('la 404 non ha il canonical, così GoatCounter conta l\'indirizzo chiesto e non /404.html', /rel="canonical"/.test(r['404.html'] ?? 'rel="canonical"'), false)
  ok('le altre pagine il canonical ce l\'hanno ancora', PAGINE.filter((f) => f !== '404.html' && !/<link rel="canonical"/.test(r[f] ?? '')), [])

  console.log('\nI clic che si contano')
  const tutti = PAGINE.flatMap((f) => link(r[f] ?? '').map((a) => [f, a]))
  const daContare = tutti.filter(([, a]) => nomeAtteso(a))
  ok('ci sono link a iscrizione, telefono e WhatsApp da contare', [...new Set(daContare.map(([, a]) => nomeAtteso(a)))].sort(), ['chiama', 'iscriviti', 'scrivici'])
  ok('ognuno ha il suo nome nel clic', daContare.filter(([, a]) => clic(a) !== nomeAtteso(a)).map(([f, a]) => `${f}: ${a}`), [])
  ok('e lo stesso nome come titolo (GoatCounter altrimenti manda il testo del link)', daContare.filter(([, a]) => !a.includes(` data-goatcounter-title="${nomeAtteso(a)}"`)).map(([f, a]) => `${f}: ${a}`), [])
  ok('un attributo solo per link, mai due', tutti.filter(([, a]) => (a.match(/data-goatcounter-click=/g) ?? []).length > 1).length, 0)
  ok('i link che somigliano a quelli da contare non si contano', tutti.filter(([, a]) => NON_CONTATI.includes(href(a)) && /data-goatcounter/.test(a)).map(([f, a]) => `${f}: ${a}`), [])
  ok('e ci sono davvero, in ogni pagina col testo', tutti.filter(([, a]) => NON_CONTATI.includes(href(a))).length > 0, true)
  ok('nessun altro link è contato (menu, Instagram, email, pagine, siti altri)', tutti.filter(([, a]) => !nomeAtteso(a) && /data-goatcounter/.test(a)).map(([f, a]) => `${f}: ${a}`), [])
  ok('il link «Iscrivi Mario Rossi» non porta il suo testo nel clic', /data-goatcounter-[a-z]+="[^"]*Mario/.test(r['index.html'] ?? ''), false)
  // Il contatore non tocca gli indirizzi: quelli del modulo hanno l'etichetta della pagina (?da=) anche senza codice, e restano quelli.
  const senzaCodice = genera(dati())
  ok('il testo e l\'indirizzo dei link restano com\'erano', PAGINE.every((f) => JSON.stringify(link(r[f] ?? '').map(href)) === JSON.stringify(link(senzaCodice[f] ?? '').map(href))) && (r['judo/index.html'] ?? '').includes(`href="${ISCRIZIONE}?corso=judo&amp;da=`) && (r['judo/index.html'] ?? '').includes('>Iscrivi Mario Rossi al judo</a>'), true)
  ok('un link al modulo con l\'etichetta si conta lo stesso', tutti.filter(([, a]) => /[?&;]da=/.test(href(a)) && href(a).startsWith(ISCRIZIONE)).every(([, a]) => clic(a) === 'iscriviti') && tutti.some(([, a]) => /[?&;]da=/.test(href(a))), true)

  console.log('\nQuello che non cambia')
  const senza = genera(dati())
  for (const f of ['sitemap.xml', 'robots.txt', 'llms.txt']) ok(`${f} identico con e senza codice`, r[f], senza[f])
  ok('il rinvio è identico, senza script', [r['vecchio-judo/index.html'] === senza['vecchio-judo/index.html'], /<script|goatcounter/i.test(r['vecchio-judo/index.html'] ?? '<script')], [true, false])
  ok('stessi file, nessuno in più', Object.keys(r).sort(), Object.keys(senza).sort())
  const via = (h) => h.replace(SCRIPT, '').replace(SCRIPT_404, '').replace(/ data-goatcounter-click="[a-z]+" data-goatcounter-title="[a-z]+"/g, '')
  ok('tolto lo script e i nomi dei clic, le pagine sono quelle di prima (404 a parte il canonical)', PAGINE.filter((f) => f !== '404.html' && via(r[f] ?? '') !== senza[f]), [])
  ok('lo stesso codice due volte dà gli stessi file', JSON.stringify(genera(dati({ statistiche: CODICE }))), JSON.stringify(r))
  const finto = genera(dati({ statistiche: CODICE, pagine: [pag('home', '<p><a href="/judo/" data-goatcounter-click="falso" data-goatcounter-title="Mario">Judo</a> <a href="tel:+39011" data-goatcounter-click="doppio">Tel</a></p>')] }))['index.html'] ?? ''
  ok('un data-goatcounter scritto nel testo della segreteria non passa (né un nome finto né un doppione)', [/falso|doppio|"Mario"/.test(finto), link(finto).filter((a) => (a.match(/data-goatcounter-click=/g) ?? []).length > 1).length], [false, 0])
  ok('un testo della segreteria con uno script GoatCounter suo non passa (resta solo il nostro)', esterni(genera(dati({ statistiche: CODICE, pagine: [pag('home', '<p>x</p><script data-goatcounter="https://altro.goatcounter.com/count" async src="//gc.zgo.at/count.js"></script>')] }))['index.html'] ?? ''), [SCRIPT.replace('</script>', '')])
}

// ---------------------------------------------------------------------------
console.log('\nUn codice fuori forma non entra mai')
const CATTIVI = [
  ['con virgolette e tag', 'x"><script>alert(1)</script>'],
  ['con uno spazio', 'a b'],
  ['un indirizzo', 'https://x'],
  ['un percorso', '../'],
  ['di 60 lettere', 'a'.repeat(60)],
  ['con un a capo', 'ods\nprova'],
  ['con un a capo in fondo', 'ods-prova\n'],
  ['di una lettera', 'a'],
  ['con le maiuscole', 'ODS'],
  ['con un punto', 'ods.prova'],
]
{
  const senza = genera(dati())
  for (const [nome, valore] of CATTIVI) {
    const r = genera(dati({ statistiche: valore }))
    ok(`${nome}: generaSito non si ferma e i file sono quelli senza codice`, JSON.stringify(r), JSON.stringify(senza))
  }
  ok('50 lettere sono ancora un codice buono', esterni(genera(dati({ statistiche: 'a'.repeat(50) }))['index.html'] ?? '').length, 1)
  ok('2 lettere anche', esterni(genera(dati({ statistiche: 'ab' }))['index.html'] ?? '').length, 1)
}

// ---------------------------------------------------------------------------
console.log('\nLo script scripts/genera-sito.mjs e la variabile SITO_STATISTICHE')
{
  const cartella = mkdtempSync(join(tmpdir(), 'sito-statistiche-'))
  const file = join(cartella, 'dati.json')
  const p = (slug, testo) => ({ slug, titolo: `T ${slug}`, descrizione: '', testo, pubblicata_il: null })
  writeFileSync(file, JSON.stringify({ pagine: [p('home', `<p>Ciao</p>${LINK}`), p('judo', '<p>Judo</p>')], menu: [], rinvii: [{ da: 'vecchio', a: 'judo' }] }))
  const lancia = (nome, env) => {
    const uscita = join(cartella, nome)
    const x = spawnSync('node', ['scripts/genera-sito.mjs', uscita, '--da-file', file], { encoding: 'utf8', env: { PATH: process.env.PATH, ...env } })
    return { ...x, uscita }
  }
  // Tutti i file di testo generati (le risorse sono copiate, uguali sempre).
  const leggi = (u) => {
    const fuori = {}
    const giro = (d) => {
      for (const n of readdirSync(d)) {
        const pieno = join(d, n)
        if (statSync(pieno).isDirectory()) {
          if (n !== 'risorse') giro(pieno)
        } else fuori[relative(u, pieno)] = readFileSync(pieno, 'utf8')
      }
    }
    if (existsSync(u)) giro(u)
    return fuori
  }
  const base = lancia('senza', {})
  ok('senza variabile finisce bene, senza avvisi', [base.status, /::warning::/.test(base.stdout + base.stderr)], [0, false])
  const testo = leggi(base.uscita)
  ok('e nessun file nomina goatcounter', conGoat(testo), [])
  for (const [nome, valore] of [['vuota', ''], ['di soli spazi', '  '], ['con un a capo e basta', '\n']]) {
    const x = lancia(`vuota-${nome.replace(/\s/g, '-')}`, { SITO_STATISTICHE: valore })
    ok(`variabile ${nome}: finisce bene, senza avvisi, file identici`, [x.status, /::warning::/.test(x.stdout + x.stderr), JSON.stringify(leggi(x.uscita)) === JSON.stringify(testo)], [0, false, true])
  }
  const buono = lancia('buono', { SITO_STATISTICHE: CODICE })
  const conCodice = leggi(buono.uscita)
  ok('con un codice buono finisce bene, senza avvisi', [buono.status, /::warning::/.test(buono.stdout + buono.stderr)], [0, false])
  ok('la home ha lo script del contatore nella <head>', head(conCodice['index.html'] ?? '').includes(SCRIPT), true)
  ok('la 404 lo ha con il titolo «404»', (conCodice['404.html'] ?? '').includes(SCRIPT_404), true)
  ok('il rinvio no', /goatcounter/.test(conCodice['vecchio/index.html'] ?? 'goatcounter'), false)
  ok('sitemap, robots e llms come senza variabile', ['sitemap.xml', 'robots.txt', 'llms.txt'].map((f) => conCodice[f] === testo[f]), [true, true, true])
  for (const [nome, valore] of CATTIVI) {
    const x = lancia(`cattivo-${CATTIVI.findIndex(([n]) => n === nome)}`, { SITO_STATISTICHE: valore })
    const uscitaTesto = x.stdout + x.stderr
    ok(`${nome}: finisce bene (codice 0) con un ::warning:: che dice cosa fare`, [x.status, /^::warning::.*SITO_STATISTICHE/m.test(uscitaTesto)], [0, true])
    ok(`${nome}: il valore non finisce nell'avviso (né nei comandi di GitHub)`, valore.split('\n').filter((pezzo) => pezzo.length > 1 && uscitaTesto.includes(pezzo)), [])
    ok(`${nome}: i file sono quelli senza variabile`, JSON.stringify(leggi(x.uscita)) === JSON.stringify(testo), true)
  }
}

// ---------------------------------------------------------------------------
console.log('\nChi legge la variabile: il generatore e, per i due eventi del modulo, contaIscrizione.ts; mai il resto dell\'app')
{
  const tutti = (d) => readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? tutti(join(d, n)) : [join(d, n)]))
  const src = tutti('src').filter((f) => /\.(ts|tsx|js|css)$/.test(f))
  // contaIscrizione.ts è l'eccezione voluta: il modulo d'iscrizione conta due eventi (prova-conta-iscrizione.mjs); l'anteprima del pannello no.
  ok('in src/ solo sitoGenera.ts e contaIscrizione.ts nominano gc.zgo.at', src.filter((f) => readFileSync(f, 'utf8').includes('gc.zgo.at')), ['src/lib/contaIscrizione.ts', 'src/lib/sitoGenera.ts'])
  // I commenti la possono nominare: conta chi la legge dall'ambiente (process.env, import.meta.env).
  ok('in src/ solo contaIscrizione.ts legge SITO_STATISTICHE dall\'ambiente', src.filter((f) => /env\s*(\.\s*|\[\s*['"`])\w*SITO_STATISTICHE/.test(readFileSync(f, 'utf8'))), ['src/lib/contaIscrizione.ts'])
  ok('fra gli script solo genera-sito.mjs la legge', readdirSync('scripts').filter((f) => /\.(mjs|js|sh)$/.test(f) && f !== 'prova-sito-statistiche.mjs' && /env\s*(\.\s*|\[\s*['"`])SITO_STATISTICHE/.test(readFileSync(join('scripts', f), 'utf8'))), ['genera-sito.mjs'])
  ok('l\'anteprima del pannello non passa un codice a generaSito', /statistiche/i.test(readFileSync('src/components/segreteria/AnteprimaPagina.tsx', 'utf8')), false)
  const yml = readFileSync('.github/workflows/sito.yml', 'utf8')
  const passo = yml.slice(yml.indexOf('- name: Genera il sito'), yml.indexOf('- name:', yml.indexOf('- name: Genera il sito') + 1))
  ok('il giro del sito passa la variabile del repository al passo che genera', /\n\s+SITO_STATISTICHE: \$\{\{ vars\.SITO_STATISTICHE \}\}\n/.test(passo), true)
}

console.log(guai ? `\n✗ ${guai} casi falliti` : '\nTutto a posto.')
process.exit(guai ? 1 : 0)
