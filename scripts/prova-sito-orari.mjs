// ---------------------------------------------------------------------------
// La pagina «Orari» del sito pubblico, senza browser.
//
//   node scripts/prova-sito-orari.mjs
//
// `src/lib/sitoOrari.ts`: dagli orari dei corsi attivi (`orari_sito()` del
// database) alla pagina del sito. Cosa conta: la voce «Martedì 19:00–20:00 ·
// corso», l'ordine da lunedì a domenica, il nome del corso escapato, nessun
// dato in più (sala, istruttore, iscritti), niente data di oggi nei file (stessi
// dati, stessi file), «Orari in arrivo» quando non ce n'è, e lo script del
// sito che si ferma se il database non dà gli orari. Il filtro «corso attivo,
// ricorrenza non finita» sta nel database (supabase/prova/orari-sito.sql); qui
// ne c'è la gemella della modalità prova. Il design: docs/design-canvas/orari-sito/.
//
// La pagina si riconosce dallo slug «orari» e da un paragrafo che dice solo
// «[orari]» (il segnaposto, come i «[C5: …]» di Contatti): il testo prima è
// l'introduzione, quello dopo la riga «Per variazioni contatta…».
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
const o = await carica('src/lib/sitoOrari.ts')
const g = await carica('src/lib/sitoGenera.ts')
const sp = await carica('src/lib/sitoProva.ts')

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
const errore = (f) => {
  try {
    f()
    return 'nessun errore'
  } catch (e) {
    return String(e.message)
  }
}

const DOMINIO = 'https://officinedellosport.it'
// Le righe come le dà orari_sito(): `ora` è un «time» di Postgres, quindi «HH:MM:SS».
const riga = (corso, giorno, ora, durata_min = 60, modificata_il = '2026-10-18T09:30:00+00:00') => ({ corso, giorno, ora, durata_min, modificata_il })
const testoOrari = '<p>I corsi della settimana.</p><p>[orari]</p><p>Per variazioni contatta la segreteria: 346 329 2786.</p>'
const pag = (slug, extra = {}) => ({ slug, titolo: `Titolo ${slug}`, descrizione: `Descrizione ${slug}`, testo: `<p>Testo di ${slug}</p>`, ...extra })
const dati = (orari, extra = {}) => ({
  dominio: DOMINIO,
  pagine: [pag('home'), pag('orari', { titolo: 'Orari', testo: testoOrari })],
  menu: [{ dove: 'menu', ordine: 1, etichetta: 'Orari', slug: 'orari', indirizzo: null }],
  rinvii: [],
  orariSito: orari,
  ...extra,
})
const pagina = (orari, extra) => {
  const r = prova(() => g.generaSito(dati(orari, extra)))
  return typeof r === 'object' && r !== null && typeof r['orari/index.html'] === 'string' ? r['orari/index.html'] : ''
}
/** Il testo visibile del <main>, a pezzi separati da « | ». */
const visibile = (h) => (h.match(/<main[\s\S]*?<\/main>/)?.[0] ?? '').replace(/<[^>]+>/g, '|').replace(/\|+/g, '|').replace(/\s+/g, ' ').replace(/\s*\|\s*/g, ' | ').trim()

// ---------------------------------------------------------------------------
console.log('\nLe voci: giorno, ora di inizio e di fine, corso')
{
  const v = (righe) => prova(() => o.vociOrari(righe))
  ok('martedì 19:00, 60 minuti → «Martedì 19:00–20:00 · Preparazione atletica»', v([riga('Preparazione atletica', 2, '19:00:00', 60)]), ['Martedì 19:00–20:00 · Preparazione atletica'])
  ok('anche l’ora senza secondi va bene', v([riga('Judo', 1, '18:00', 90)]), ['Lunedì 18:00–19:30 · Judo'])
  ok('la fine è ora + durata, anche con i minuti', v([riga('Judo', 5, '19:30:00', 45)]), ['Venerdì 19:30–20:15 · Judo'])
  ok('la fine oltre la mezzanotte riparte da 00', v([riga('Notte', 6, '23:30:00', 90)]), ['Sabato 23:30–01:00 · Notte'])
  ok('la fine a mezzanotte precisa è 00:00', v([riga('Notte', 6, '23:00:00', 60)]), ['Sabato 23:00–00:00 · Notte'])
  ok('senza righe, nessuna voce', v([]), [])
}

console.log('\nL’ordine: lunedì → domenica, poi per ora, poi per nome')
{
  const mescolate = [
    riga('Aikido', 0, '10:00:00'),
    riga('Lotta', 4, '19:00:00'),
    riga('Judo', 1, '19:30:00'),
    riga('Judo ragazzi', 1, '18:00:00'),
    riga('Zeta', 1, '18:00:00'),
    riga('Alfa', 1, '18:00:00'),
    riga('Sollevamenti', 6, '11:00:00'),
  ]
  const attese = [
    'Lunedì 18:00–19:00 · Alfa',
    'Lunedì 18:00–19:00 · Judo ragazzi',
    'Lunedì 18:00–19:00 · Zeta',
    'Lunedì 19:30–20:30 · Judo',
    'Giovedì 19:00–20:00 · Lotta',
    'Sabato 11:00–12:00 · Sollevamenti',
    'Domenica 10:00–11:00 · Aikido',
  ]
  ok('la domenica (0) va in fondo; stessa ora → per nome', prova(() => o.vociOrari(mescolate)), attese)
  ok('l’ordine non dipende da come arrivano le righe', prova(() => o.vociOrari([...mescolate].reverse())), attese)
  ok('le righe date non si toccano (niente sort sul posto)', (() => { const c = [...mescolate]; prova(() => o.vociOrari(mescolate)); return JSON.stringify(c) === JSON.stringify(mescolate) })(), true)
  const giorni = prova(() => o.giorniOrari(mescolate))
  ok('per giorno: i giorni senza lezioni si saltano (telefono: lista per giorno)', Array.isArray(giorni) ? giorni.map((x) => x.giorno) : giorni, ['Lunedì', 'Giovedì', 'Sabato', 'Domenica'])
  ok('per giorno: le voci sono ora e corso, in ordine', Array.isArray(giorni) ? giorni[0].voci : giorni, [{ ora: '18:00–19:00', corso: 'Alfa' }, { ora: '18:00–19:00', corso: 'Judo ragazzi' }, { ora: '18:00–19:00', corso: 'Zeta' }, { ora: '19:30–20:30', corso: 'Judo' }])
}

console.log('\n«Aggiornato al»: dall’ultima modifica degli orari, non da oggi')
{
  const a = (righe) => prova(() => o.aggiornatoAl(righe))
  ok('il formato è «18 ottobre 2026»', a([riga('Judo', 1, '18:00:00', 60, '2026-10-18T09:30:00+00:00')]), '18 ottobre 2026')
  ok('vale la modifica più recente fra le righe', a([riga('A', 1, '18:00:00', 60, '2026-03-01T09:00:00+00:00'), riga('B', 2, '18:00:00', 60, '2026-09-05T09:00:00+00:00'), riga('C', 3, '18:00:00', 60, '2026-05-02T09:00:00+00:00')]), '5 settembre 2026')
  ok('il giorno è quello di Roma: le 22:30 UTC del 17 sono già il 18', a([riga('Judo', 1, '18:00:00', 60, '2026-10-17T22:30:00+00:00')]), '18 ottobre 2026')
  ok('il primo del mese non ha lo zero', a([riga('Judo', 1, '18:00:00', 60, '2026-12-01T10:00:00+00:00')]), '1 dicembre 2026')
  ok('senza righe, nessuna data', a([]), null)
}

// ---------------------------------------------------------------------------
console.log('\nLa pagina nel sito')
const ORARI = [
  riga('Judo ragazzi', 1, '18:00:00', 60, '2026-10-18T09:30:00+00:00'),
  riga('Preparazione atletica', 2, '19:00:00', 60, '2026-10-10T09:30:00+00:00'),
  riga('Aikido', 1, '19:30:00', 60, '2026-10-01T09:30:00+00:00'),
]
{
  const h = pagina(ORARI)
  const t = visibile(h)
  ok('la pagina «orari» c’è, con un solo <h1> e un solo <main>', [h !== '', (h.match(/<h1[\s>]/g) || []).length, (h.match(/<main[\s>]/g) || []).length], [true, 1, 1])
  ok('martedì: 19:00–20:00 e il corso', /Martedì[^|]*\|[^|]*19:00–20:00[^|]*\|[^|]*Preparazione atletica/.test(t), true)
  ok('l’ordine nella pagina: lunedì 18:00, lunedì 19:30, martedì', [t.indexOf('Judo ragazzi'), t.indexOf('Aikido'), t.indexOf('Preparazione atletica')].every((x, i, a) => x >= 0 && (i === 0 || x > a[i - 1])), true)
  ok('i giorni senza lezioni non ci sono', ['Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'].filter((x) => t.includes(x)), [])
  ok('l’introduzione scritta dalla segreteria c’è', t.includes('I corsi della settimana.'), true)
  ok('la riga «Per variazioni contatta…» c’è, com’è scritta', t.includes('Per variazioni contatta la segreteria: 346 329 2786.'), true)
  ok('«Aggiornato al 18 ottobre 2026» dalla modifica più recente', t.includes('Aggiornato al 18 ottobre 2026'), true)
  ok('il segnaposto «[orari]» non si vede', /\[orari\]/i.test(h), false)
  ok('«Orari in arrivo» non c’è quando gli orari ci sono', h.includes('Orari in arrivo'), false)
  ok('nessuna griglia a 7 colonne (la lista per giorno regge sul telefono)', /repeat\(\s*7\s*,/.test(h), false)
  ok('nessun <table> (non si legge su telefono)', /<table[\s>]/i.test(h), false)
  ok('il menu ha la voce «Orari» che porta a /orari/', /<a[^>]*href="\/orari\/"[^>]*>Orari<\/a>/.test(h), true)
}
{
  const m = pagina([riga('Judo ragazzi', 1, '18:00:00')])
  const n = pagina([riga('Judo ragazzi', 1, '17:00:00')])
  ok('cambiando l’orario cambia la pagina', [m !== '', m !== n, visibile(n).includes('17:00–18:00'), visibile(n).includes('18:00–19:00')], [true, true, true, false])
  const meno = pagina([riga('Judo ragazzi', 1, '18:00:00'), riga('Aikido', 3, '19:00:00')])
  ok('un corso in più, una voce in più', [visibile(meno).includes('Aikido'), visibile(m).includes('Aikido')], [true, false])
}
{
  const a = pagina(ORARI)
  const b = pagina(ORARI.map((x) => ({ ...x })))
  ok('stessi dati → file identici', [a !== '', a === b], [true, true])
  ok('nessuna data di oggi nei file (solo quella dei dati)', (() => { const r = prova(() => g.generaSito(dati(ORARI))); return typeof r === 'object' ? Object.values(r).some((f) => f.includes(String(new Date().getFullYear() + 1))) : 'ERRORE' })(), false)
}

console.log('\nSenza orari: «Orari in arrivo»')
{
  const h = pagina([])
  const t = visibile(h)
  ok('la pagina c’è e dice «Orari in arrivo»', [h !== '', t.includes('Orari in arrivo')], [true, true])
  ok('senza data «Aggiornato al»', h.includes('Aggiornato al'), false)
  ok('la riga «Per variazioni contatta…» resta', t.includes('Per variazioni contatta'), true)
  ok('l’elenco dei dati può mancare del tutto (sito di prima, senza `orari`)', (() => { const r = prova(() => g.generaSito(dati(undefined))); return typeof r === 'object' && visibile(r['orari/index.html'] ?? '').includes('Orari in arrivo') })(), true)
  ok('il sito si genera lo stesso: home, 404, sitemap', (() => { const r = prova(() => g.generaSito(dati([]))); return typeof r === 'object' ? ['index.html', '404.html', 'sitemap.xml'].every((f) => typeof r[f] === 'string') : false })(), true)
}

console.log('\nIn fondo l’invito «Iscriviti» come nelle altre pagine, niente WhatsApp')
{
  const conContatti = { pagine: [pag('home'), pag('contatti'), pag('orari', { titolo: 'Orari', testo: testoOrari })] }
  for (const [cosa, h] of [['con gli orari', pagina(ORARI, conContatti)], ['senza orari', pagina([], conContatti)]]) {
    // Il «Scrivici» dell'invito (design invito-iscriviti) è quello di tutte le pagine: qui si guarda il resto della pagina.
    const fuori = h.replace(/<section class="invito"[\s\S]*?<\/section>/, '')
    ok(`${cosa}: nessun tasto «Scrivici su WhatsApp»`, [/wa\.me/.test(fuori), /WhatsApp/.test(fuori)], [false, false])
    ok(`${cosa}: dopo il <main> l’invito giallo «Iscriviti», come nelle altre pagine`, /<\/main><section class="invito"[^>]*>(?:(?!<\/section>)[\s\S])*>Iscriviti<\/a>/.test(h), true)
    ok(`${cosa}: la riga «Per variazioni contatta…» resta nella fascia`, /<div class="variazioni">[\s\S]*Per variazioni contatta/.test(h), true)
  }
  ok('senza la pagina Contatti niente invito, come nelle altre pagine', /class="invito"/.test(pagina(ORARI)), false)
}

console.log('\nSenza orari: la frase del design sotto il titolo')
{
  const t = visibile(pagina([]))
  ok('«L’orario della settimana comparirà qui.» al posto dell’introduzione', [t.includes('L’orario della settimana comparirà qui.'), t.includes('I corsi della settimana.')], [true, false])
  ok('con gli orari resta l’introduzione della segreteria', [visibile(pagina(ORARI)).includes('I corsi della settimana.'), visibile(pagina(ORARI)).includes('comparirà qui')], [true, false])
}

console.log('\nPagine che non sono la pagina degli orari: non si toccano')
{
  const mano = '<h2>Orari</h2><p>Lunedì 18:00 Judo.</p><p>[orari]</p>'
  const r = prova(() => g.generaSito(dati(ORARI, { pagine: [pag('home'), pag('judo', { testo: mano })] })))
  const f = typeof r === 'object' ? r['judo/index.html'] ?? '' : ''
  ok('un’altra pagina (anche col segnaposto) resta com’è: gli orari scritti a mano restano', [f.includes('Lunedì 18:00 Judo.'), f.includes('Aggiornato al'), f.includes('Preparazione atletica')], [true, false, false])
  const senza = pagina(ORARI, { pagine: [pag('home'), pag('orari', { titolo: 'Orari', testo: '<p>Orari scritti a mano: lunedì alle 18.</p>' })] })
  ok('la pagina «orari» senza il segnaposto resta quella di prima (niente orari aggiunti)', [senza.includes('Orari scritti a mano'), senza.includes('Preparazione atletica'), senza.includes('Aggiornato al')], [true, false, false])
}

// ---------------------------------------------------------------------------
console.log('\nNel file solo quello che si deve')
{
  const piene = ORARI.map((x) => ({ ...x, sala: 'SALAPRIVATA', istruttore: 'ISTRUTTOREPRIVATO', iscritti: 'ISCRITTIPRIVATI', capienza: 'CAPIENZAPRIVATA', corso_id: 'IDPRIVATO' }))
  const h = pagina(piene)
  ok('sala, istruttore, iscritti, capienza e id non entrano nel file', ['SALAPRIVATA', 'ISTRUTTOREPRIVATO', 'ISCRITTIPRIVATI', 'CAPIENZAPRIVATA', 'IDPRIVATO'].filter((x) => h.includes(x)), [])
  ok('(e il file c’è)', h !== '', true)
}

console.log('\nIl nome del corso: escapato')
{
  const cattivo = '"><script>alert(1)</script> & \'x\''
  const h = pagina([riga(cattivo, 1, '18:00:00')])
  ok('nessun <script oltre ai dati strutturati', [h !== '', /<script/i.test(senzaDati(h))], [true, false])
  ok('il nome è escapato: &lt;script&gt;, &amp;, &quot;', ['&lt;script&gt;alert(1)&lt;/script&gt;', '&amp;', '&quot;'].map((x) => h.includes(x)), [true, true, true])
  ok('nessun attributo inventato dalle virgolette', /\sonerror\s*=|\sonload\s*=/i.test(h), false)
  const tag = pagina([riga('<img src=x onerror=alert(1)>', 2, '19:00:00')])
  ok('un <img> nel nome non diventa un’immagine', [tag !== '', /<img[^>]*onerror/i.test(tag)], [true, false])
  const lungo = 'Metodo Globale di Autodifesa (MGA) '.repeat(4).trim()
  ok('un nome lungo c’è per intero (il design lo manda a capo, mai tagliato)', pagina([riga(lungo, 4, '19:00:00', 90)]).includes(lungo), true)
}

// ---------------------------------------------------------------------------
console.log('\nLe risposte del database')
{
  const pagine = [{ slug: 'home', titolo: 'Casa', descrizione: null, testo: '<p>x</p>', pubblicata_il: null }]
  const d = prova(() => g.datiDaRisposte(DOMINIO, pagine, [], [], undefined, ORARI))
  ok('datiDaRisposte porta gli orari nei dati del sito', typeof d === 'object' ? d.orariSito : d, ORARI)
  const senza = prova(() => g.datiDaRisposte(DOMINIO, pagine, [], []))
  ok('senza il sesto argomento, nessun orario', typeof senza === 'object' ? senza.orariSito ?? [] : senza, [])
}

// ---------------------------------------------------------------------------
console.log('\nLo script scripts/genera-sito.mjs e orari_sito()')
{
  const { mkdtempSync, writeFileSync, existsSync, readFileSync, readdirSync } = await import('node:fs')
  const { tmpdir } = await import('node:os')
  const { join } = await import('node:path')
  const { spawn } = await import('node:child_process')
  const cartella = mkdtempSync(join(tmpdir(), 'sito-orari-'))
  // Lo script scrive in «dist-sito» della cartella da cui lo si lancia (con un solo argomento, quello è preso per l'uscita solo se non è il primo): si lancia da una cartella temporanea.
  const uscita = join(cartella, 'dist-sito')
  const pagineDb = [
    { slug: 'home', titolo: 'Casa', descrizione: '', testo: '<p>Ciao</p>', pubblicata_il: '2026-10-17T09:00:00Z' },
    { slug: 'orari', titolo: 'Orari', descrizione: '', testo: testoOrari, pubblicata_il: '2026-10-17T09:00:00Z' },
  ]
  const menuDb = [{ dove: 'menu', ordine: 1, etichetta: 'Orari', slug: 'orari', indirizzo: null }]
  // Un finto database: risponde alle funzioni pubbliche; `orari_sito` come dice `orari`.
  const { createServer } = await import('node:http')
  let orari = { stato: 200, corpo: ORARI }
  const chiamate = []
  const server = createServer((rq, rs) => {
    const f = rq.url.split('/').pop()
    chiamate.push(f)
    const risposte = { sito_pagine_pubbliche: pagineDb, sito_menu_pubblico: menuDb, sito_redirect_pubblici: [] }
    const r = f === 'orari_sito' ? orari : { stato: f in risposte ? 200 : 404, corpo: risposte[f] ?? { code: 'PGRST202', message: 'non c’è' } }
    rs.writeHead(r.stato, { 'Content-Type': 'application/json' })
    rs.end(JSON.stringify(r.corpo))
  })
  await new Promise((fine) => server.listen(0, '127.0.0.1', fine))
  const url = `http://127.0.0.1:${server.address().port}`
  // spawn asincrono: lo spawnSync bloccherebbe il finto database nello stesso processo.
  const lancia = () => new Promise((fine) => {
    const p = spawn('node', [join(process.cwd(), 'scripts/genera-sito.mjs')], { cwd: cartella, env: { PATH: process.env.PATH, SUPABASE_URL: url, SUPABASE_ANON_KEY: 'chiave-anon' } })
    let err = ''
    p.stderr.on('data', (x) => (err += x))
    p.on('close', (status) => fine({ status, err }))
  })

  const buono = await lancia()
  ok('con orari_sito() che risponde finisce bene e la chiama', [buono.status, chiamate.includes('orari_sito')], [0, true])
  const file = join(uscita, 'orari/index.html')
  const prima = existsSync(file) ? readFileSync(file, 'utf8') : ''
  ok('la pagina «orari» ha gli orari del database', visibile(prima).includes('Martedì | 19:00–20:00 | Preparazione atletica') || /Martedì[\s\S]*19:00–20:00[\s\S]*Preparazione atletica/.test(prima), true)
  const elenco = readdirSync(uscita).sort().join()

  for (const [cosa, r] of [
    ['manca (404, 56…/69-orari-sito.sql non lanciato)', { stato: 404, corpo: { code: 'PGRST202', message: 'non c’è' } }],
    ['rifiutata (401/403)', { stato: 403, corpo: { code: '42501', message: 'permission denied' } }],
    ['risponde una cosa che non è un elenco', { stato: 200, corpo: { no: 1 } }],
  ]) {
    orari = r
    const x = await lancia()
    ok(`orari_sito() ${cosa}: il giro si ferma (uscita 1) e dice quale funzione`, [x.status, /orari_sito/.test(x.err)], [1, true])
    ok('   e il messaggio non è il testo grezzo dell’API', /PGRST202|permission denied|<!DOCTYPE|\bundefined\b/i.test(x.err), false)
    ok('   e il sito di prima resta com’è', [readdirSync(uscita).sort().join() === elenco, readFileSync(file, 'utf8') === prima, existsSync(`${uscita}.nuovo`)], [true, true, false])
  }
  orari = { stato: 200, corpo: [] }
  const vuoto = await lancia()
  ok('orari_sito() con zero righe non è un guasto: il sito si genera con «Orari in arrivo»', [vuoto.status, readFileSync(file, 'utf8').includes('Orari in arrivo')], [0, true])
  // Con --da-file: `orari` può mancare (i file di dati di prima) e può esserci.
  const dati1 = join(cartella, 'dati.json')
  writeFileSync(dati1, JSON.stringify({ pagine: pagineDb, menu: menuDb, rinvii: [], orariSito: ORARI }))
  const { spawnSync } = await import('node:child_process')
  const conFile = spawnSync('node', [join(process.cwd(), 'scripts/genera-sito.mjs'), join(cartella, 'f1'), '--da-file', dati1], { encoding: 'utf8', env: { PATH: process.env.PATH } })
  ok('--da-file: gli orari del file entrano nella pagina', [conFile.status, readFileSync(join(cartella, 'f1/orari/index.html'), 'utf8').includes('Preparazione atletica')], [0, true])
  writeFileSync(dati1, JSON.stringify({ pagine: pagineDb, menu: menuDb, rinvii: [] }))
  const senzaChiave = spawnSync('node', [join(process.cwd(), 'scripts/genera-sito.mjs'), join(cartella, 'f2'), '--da-file', dati1], { encoding: 'utf8', env: { PATH: process.env.PATH } })
  ok('--da-file senza `orari`: va, con «Orari in arrivo»', [senzaChiave.status, readFileSync(join(cartella, 'f2/orari/index.html'), 'utf8').includes('Orari in arrivo')], [0, true])
  server.close()
}

// ---------------------------------------------------------------------------
console.log('\nModalità prova: gli stessi orari, lo stesso filtro')
{
  const OGGI = '2026-10-18'
  const corsi = [
    { nome: 'Judo 3', attivo: true, ricorrenze: [
      { giorno: 1, ora: '18:00', durata: 60 },
      { giorno: 4, ora: '18:00', durata: 90, al: OGGI },
      { giorno: 3, ora: '17:00', durata: 60, al: '2026-10-17' },
      { giorno: 5, ora: '19:30', durata: 45, al: '2027-06-30' },
    ] },
    { nome: 'Corso chiuso', attivo: false, ricorrenze: [{ giorno: 2, ora: '18:00', durata: 60 }] },
  ]
  const r = prova(() => sp.orariSitoProva(corsi, OGGI))
  ok('corsi attivi, ricorrenze non finite (la fine di oggi c’è ancora)', Array.isArray(r) ? r.map((x) => `${x.corso} ${x.giorno} ${x.ora.slice(0, 5)} ${x.durata_min}`) : r, ['Judo 3 1 18:00 60', 'Judo 3 4 18:00 90', 'Judo 3 5 19:30 45'])
  ok('stesse chiavi di orari_sito(): corso, giorno, ora, durata_min, modificata_il', Array.isArray(r) && r[0] ? Object.keys(r[0]).sort() : r, ['corso', 'durata_min', 'giorno', 'modificata_il', 'ora'])
  ok('nessun campo in più (sala, istruttori, capienza)', Array.isArray(r) ? r.some((x) => 'sala' in x || 'istruttori' in x || 'capienza' in x) : r, false)
  ok('la data di modifica è fissa (gli stessi dati, la stessa pagina)', Array.isArray(r) ? JSON.stringify(r) === JSON.stringify(prova(() => sp.orariSitoProva(corsi, OGGI))) : r, true)
  ok('l’elenco della prova dà una pagina vera', Array.isArray(r) ? visibile(pagina(r)).includes('Judo 3') : false, true)
}

console.log('\nIl menu: «Orari» solo se la pagina esiste ed è pubblicata')
{
  const s0 = prova(() => sp.sitoIniziale())
  const { stato, id } = prova(() => sp.nuovaPagina(s0, 'Orari', 'orari')) ?? {}
  const voci = [{ etichetta: 'Orari', paginaId: id, indirizzo: null }]
  const nega = (f) => errore(f)
  ok('pagina «orari» ancora in bozza → il menu la rifiuta, col nome della voce', /Orari/.test(nega(() => sp.salvaMenu(stato, 'menu', voci))), true)
  const v = stato?.pagine.find((x) => x.id === id).versione
  const pubblicata = prova(() => { const b = sp.salvaBozza(stato, id, v, { titolo: 'Orari', descrizione: '', bozza: testoOrari }); return sp.pubblica(b.stato, id, b.versione) })
  ok('pubblicata → il menu la accetta', typeof pubblicata === 'object' ? prova(() => sp.salvaMenu(pubblicata.stato, 'menu', voci)).menu?.length : pubblicata, 1)
  ok('una voce verso una pagina che non c’è → rifiutata', /Orari/.test(nega(() => sp.salvaMenu(s0, 'menu', [{ etichetta: 'Orari', paginaId: 'sp-orari-che-non-c-e', indirizzo: null }]))), true)
}

console.log(guai ? `\n✗ ${guai} casi falliti` : '\nTutto a posto.')
process.exit(guai ? 1 : 0)
