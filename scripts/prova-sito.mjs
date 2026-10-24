// ---------------------------------------------------------------------------
// Il pannello SITO della segreteria, senza browser.
//
//   node scripts/prova-sito.mjs
//
// Due moduli: `src/lib/sitoTesto.ts` (il testo ricco delle pagine, ripulito
// prima di salvarlo e prima di mostrarlo) e `src/lib/sitoPagine.ts` (indirizzi,
// stato bozza/pubblicato, menu e footer). Chi apre il sito non deve mai
// eseguire codice scritto in una pagina: per questo la pulizia si prova con
// una lista di attacchi noti.
// ---------------------------------------------------------------------------
import { build } from 'esbuild'
import { readFileSync } from 'node:fs'

// Se un modulo non c'è ancora, i suoi casi falliscono uno a uno (non si ferma tutto).
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
      // sanitize-html (e le sue dipendenze) usa `require`, che un modulo letto da un indirizzo data: non ha.
      banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(process.cwd() + '/');" },
    })
    return await import('data:text/javascript;base64,' + Buffer.from(outputFiles[0].text).toString('base64'))
  } catch (e) {
    console.log(`  (modulo mancante: ${file} — ${String(e.message).split('\n')[0]})`)
    return {}
  }
}
const t = await carica('src/lib/sitoTesto.ts')
const p = await carica('src/lib/sitoPagine.ts')
const sp = await carica('src/lib/sitoProva.ts')
const ac = await carica('src/lib/sitoAccessibilita.ts')
const pz = await carica('src/lib/sitoPezzi.ts')
const sg = await carica('src/lib/sitoGenera.ts')

let guai = 0
const ok = (cosa, avuto, voluto) => {
  const va = JSON.stringify(avuto) === JSON.stringify(voluto)
  console.log(va ? '  ✓' : '  ✗', cosa, va ? '' : `— atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`)
  if (!va) guai++
}
// Una funzione che manca o che scoppia deve far rosso quel caso, non fermare tutto.
const prova = (f) => {
  try {
    return f()
  } catch (e) {
    return `ERRORE: ${e.message}`
  }
}
const pulisci = (h) => prova(() => t.pulisciTesto(h))
// Un «non c'è» (es. href tolto) vale solo se la funzione c'è e risponde: un errore non conta.
const buono = (r) => typeof r === 'string' && !r.startsWith('ERRORE')
const senza = (r, re) => buono(r) && !re.test(r)

// ---------------------------------------------------------------------------
console.log('\nTesto: cosa resta')
ok('stringa vuota resta vuota', pulisci(''), '')
ok('testo normale intatto (accenti, apostrofi)', pulisci("<p>Perché l'attività è già qui: è così.</p>"), "<p>Perché l'attività è già qui: è così.</p>")
ok('«&amp;» resta «&amp;»', pulisci('<p>Danza &amp; teatro</p>'), '<p>Danza &amp; teatro</p>')
for (const tag of ['h2', 'h3', 'p', 'strong', 'em', 'blockquote']) ok(`ammesso ${tag}`, pulisci(`<${tag}>ciao</${tag}>`), `<${tag}>ciao</${tag}>`)
ok('ammessi elenchi', pulisci('<ul><li>a</li></ul><ol><li>b</li></ol>'), '<ul><li>a</li></ul><ol><li>b</li></ol>')
ok('ammesso br', /^<p>a<br ?\/?>b<\/p>$/.test(pulisci('<p>a<br>b</p>')), true)
ok('link https tiene href e rel', pulisci('<a href="https://esempio.it/x">qui</a>'), '<a href="https://esempio.it/x" rel="noopener noreferrer">qui</a>')
ok('link interno «/…» ammesso', pulisci('<a href="/chi-siamo">qui</a>'), '<a href="/chi-siamo">qui</a>')
ok('link interno non prende rel', senza(pulisci('<a href="/chi-siamo">qui</a>'), /rel=/), true)
ok('mailto ammesso', pulisci('<a href="mailto:a@b.it">scrivi</a>').includes('href="mailto:a@b.it"'), true)
ok('tel ammesso', pulisci('<a href="tel:+390123456">chiama</a>').includes('href="tel:+390123456"'), true)
ok('mailto esce con rel', pulisci('<a href="mailto:a@b.it">x</a>').includes('rel="noopener noreferrer"'), true)
ok('target ammesso', pulisci('<a href="https://e.it" target="_blank">x</a>').includes('target="_blank"'), true)
ok('rel dichiarato ma esterno: sempre noopener noreferrer', pulisci('<a href="https://e.it" rel="opener">x</a>').includes('rel="noopener noreferrer"'), true)
ok('pulsante-link tiene la classe', pulisci('<a class="pulsante" href="/iscriviti">Iscriviti</a>'), '<a class="pulsante" href="/iscriviti">Iscriviti</a>')
ok('pulsante esterno: classe e rel', /class="pulsante"/.test(pulisci('<a class="pulsante" href="https://e.it">x</a>')) && /rel="noopener noreferrer"/.test(pulisci('<a class="pulsante" href="https://e.it">x</a>')), true)
ok('classe diversa da «pulsante» tolta', pulisci('<a class="altro" href="/x">x</a>'), '<a href="/x">x</a>')
ok('classe «pulsante altro» tolta', senza(pulisci('<a class="pulsante altro" href="/x">x</a>'), /altro/), true)
ok('classe su un paragrafo tolta', pulisci('<p class="pulsante">x</p>'), '<p>x</p>')
ok('immagine tiene src', pulisci('<img src="https://x/y.png" alt="foto">').includes('src="https://x/y.png"'), true)
ok('immagine tiene alt', pulisci('<img src="https://x/y.png" alt="foto">').includes('alt="foto"'), true)

console.log('\nTesto: link vietati')
const href = (h) => pulisci(`<a href="${h}">testo</a>`)
for (const [nome, h] of [
  ['javascript:', 'javascript:alert(1)'],
  ['JaVaScRiPt:', 'JaVaScRiPt:alert(1)'],
  ['jav&#x61;script:', 'jav&#x61;script:alert(1)'],
  ['jav&#97;script:', 'jav&#97;script:alert(1)'],
  ['java\\tscript:', 'java\tscript:alert(1)'],
  ['java&Tab;script:', 'java&Tab;script:alert(1)'],
  ['spazio davanti', '  javascript:alert(1)'],
  ['a capo davanti', '\njavascript:alert(1)'],
  ['vbscript:', 'vbscript:msgbox(1)'],
  ['data:text/html', 'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg=='],
  ['DATA:', 'DATA:text/html,<script>alert(1)</script>'],
  ['«//» (stesso protocollo di un altro sito)', '//evil.example/x'],
  ['«/\\» (il browser lo legge come «//»)', '/\\evil.example/x'],
  ['senza protocollo', 'evil.example/x'],
  ['ftp:', 'ftp://evil.example/x'],
  ['file:', 'file:///etc/passwd'],
]) {
  const r = href(h)
  ok(`href ${nome}: il testo resta, l'href no`, senza(r, /href=|script/i) && r.includes('testo'), true)
}
ok('«//» non lascia href', senza(href('//evil.example/x'), /href=/), true)

console.log('\nTesto: attacchi noti')
const attacchi = [
  ['<script>alert(1)</script>', 'script'],
  ['<img src=x onerror=alert(1)>', 'onerror'],
  ['<a href="javascript:alert(1)">x</a>', 'javascript'],
  ['<iframe src="https://evil.example"></iframe>', 'iframe'],
  ['<svg onload=alert(1)><circle/></svg>', 'svg'],
  ['<p style="background:url(javascript:alert(1))">x</p>', 'style'],
  ['<a href="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">x</a>', 'data:'],
  ['<scr<script>ipt>alert(1)</scr</script>ipt>', '<script'],
  ['<img src="https://x/y.png" onerror="alert(1)">', 'onerror'],
  ['<object data="x"></object><embed src="x">', 'object'],
  ['<form action="/x"><input name="a"></form>', 'form'],
  ['<style>body{display:none}</style>', 'style'],
  ['<p id="x" onclick="alert(1)">x</p>', 'onclick'],
  ['<a href="https://e.it" onmouseover="alert(1)">x</a>', 'onmouseover'],
  ['<body onload=alert(1)>', 'onload'],
  ['<math><mi xlink:href="javascript:alert(1)">x</mi></math>', 'javascript'],
  ['<img src="javascript:alert(1)">', 'javascript'],
  ['<img src="data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=">', 'data:'],
]
for (const [att, cosa] of attacchi) {
  const r = pulisci(att)
  ok(`${att.slice(0, 50)}: niente «${cosa}» nell'uscita`, typeof r === 'string' && !r.startsWith('ERRORE') && !r.toLowerCase().includes(cosa), true)
  ok(`${att.slice(0, 50)}: l'uscita è sicura`, prova(() => t.testoSicuro(r)), true)
  ok(`${att.slice(0, 50)}: l'originale non è sicuro`, prova(() => t.testoSicuro(att)), false)
}
ok('tag spezzato: nessun <script> vivo', senza(pulisci('<scr<script>ipt>alert(1)</scr</script>ipt>'), /<script/i), true)
ok('script: sparisce anche il contenuto', pulisci('<p>a</p><script>alert(1)</script>'), '<p>a</p>')
ok('onerror tolto ma l\'immagine https resta', /^<img [^>]*src="https:\/\/x\/y\.png"[^>]*>$/.test(pulisci('<img src="https://x/y.png" onerror="alert(1)">')), true)
ok('style tolto, il paragrafo resta', pulisci('<p style="color:red">x</p>'), '<p>x</p>')
ok('id tolto', pulisci('<p id="a">x</p>'), '<p>x</p>')

console.log('\nTesto: HTML da Word')
const word = '<p class="MsoNormal" style="margin:0cm"><span style="font-size:12pt" class="MsoNormal">Ciao <o:p></o:p>mondo</span></p>'
ok('Word: restano solo testo e paragrafo', pulisci(word), '<p>Ciao mondo</p>')
ok('Word: niente span, style, Mso, o:p', senza(pulisci(word), /span|style|Mso|o:p/), true)

console.log('\nTesto: idempotenza e sicurezza')
for (const x of ['', '<p>Perché &amp; così</p>', '<a href="https://e.it">x</a>', '<a class="pulsante" href="/x">x</a>', word, ...attacchi.map((a) => a[0])]) {
  ok(`pulisci(pulisci(x)) = pulisci(x) per ${x.slice(0, 40) || '«vuoto»'}`, buono(pulisci(x)) && prova(() => t.pulisciTesto(t.pulisciTesto(x))) === pulisci(x), true)
}
ok('testoSicuro: testo pulito', prova(() => t.testoSicuro('<p>Ciao <strong>mondo</strong></p>')), true)
ok('testoSicuro: link esterno già ripulito', prova(() => t.testoSicuro(pulisci('<a href="https://e.it">x</a>'))), true)
ok('testoSicuro: vuoto', prova(() => t.testoSicuro('')), true)
ok('testoSicuro: script', prova(() => t.testoSicuro('<p>a</p><script>x</script>')), false)
ok('testoSicuro: link esterno senza rel', prova(() => t.testoSicuro('<a href="https://e.it">x</a>')), false)

// ---------------------------------------------------------------------------
console.log('\nIndirizzo (slug) dal titolo')
const slug = (s) => prova(() => p.slugDaTitolo(s))
ok('minuscolo e trattini', slug('Chi Siamo'), 'chi-siamo')
ok('senza accenti', slug('Giocomotricità e psicomotricità'), 'giocomotricita-e-psicomotricita')
ok('segni tolti', slug('Chi siamo!'), 'chi-siamo')
ok('spazi e segni doppi → un trattino', slug('Orari  &  prezzi -- 2026'), 'orari-prezzi-2026')
ok('niente trattini a inizio e fine', slug('  --Ciao--  '), 'ciao')
ok('se non resta niente, vuoto', slug('!!! ???'), '')
ok('titolo vuoto, slug vuoto', slug(''), '')

console.log('\nIndirizzo: controlli')
const cs = (s, altri = []) => prova(() => p.controllaSlug(s, altri))
const frase = (r) => typeof r === 'string' && /[a-z]{3,} [a-z]{2,}/i.test(r) && !r.startsWith('ERRORE')
ok('indirizzo buono → nessun problema', cs('chi-siamo', ['orari']), null)
ok('con numeri → va bene', cs('corso-2026'), null)
ok('vuoto → una frase', frase(cs('')), true)
ok('maiuscole → una frase', frase(cs('Chi-siamo')), true)
ok('accenti → una frase', frase(cs('attività')), true)
ok('spazi → una frase', frase(cs('chi siamo')), true)
ok('caratteri strani → una frase', frase(cs('chi_siamo!')), true)
ok('già usato → una frase', frase(cs('orari', ['chi-siamo', 'orari'])), true)
ok('già usato: la frase non è quella del vuoto', cs('orari', ['orari']) !== cs(''), true)
for (const r of ['contact', 'contattaci', 'privacy', 'cookie', 'admin', 'api', 'app', 'sitemap.xml', 'robots.txt']) {
  ok(`riservato «${r}» → una frase`, frase(cs(r)), true)
}
ok('80 caratteri vanno bene', cs('a'.repeat(80)), null)
ok('81 caratteri → una frase', frase(cs('a'.repeat(81))), true)
ok('niente codici nelle frasi', ['', 'Ab', 'a b', 'admin', 'a'.repeat(81)].every((s) => !/[A-Z_]{4,}|undefined|Error/.test(String(cs(s, [])))), true)

console.log('\nConteggio caratteri')
ok('limite titolo 60', prova(() => p.LIMITE_TITOLO), 60)
ok('limite descrizione 160', prova(() => p.LIMITE_DESCRIZIONE), 160)
ok('dentro il limite', prova(() => p.conteggio('ciao', 60)), { n: 4, troppo: false })
ok('al limite non è troppo', prova(() => p.conteggio('a'.repeat(60), 60)), { n: 60, troppo: false })
ok('oltre il limite', prova(() => p.conteggio('a'.repeat(61), 60)), { n: 61, troppo: true })
ok('vuoto', prova(() => p.conteggio('', 160)), { n: 0, troppo: false })

console.log('\nStato della pagina')
const stato = (o) => prova(() => p.statoPagina(o))
ok('mai pubblicata → solo bozza', stato({ nascosta: false, bozza: '<p>a</p>', pubblicato: null }), 'solo-bozza')
ok('bozza uguale al pubblicato → pubblicata', stato({ nascosta: false, bozza: '<p>a</p>', pubblicato: '<p>a</p>' }), 'pubblicata')
ok('bozza diversa dal pubblicato → modificata', stato({ nascosta: false, bozza: '<p>b</p>', pubblicato: '<p>a</p>' }), 'modificata')
ok('nascosta vince su pubblicata', stato({ nascosta: true, bozza: 'a', pubblicato: 'a' }), 'nascosta')
ok('nascosta vince su modificata', stato({ nascosta: true, bozza: 'b', pubblicato: 'a' }), 'nascosta')
ok('nascosta vince su solo bozza', stato({ nascosta: true, bozza: 'b', pubblicato: null }), 'nascosta')
ok('pubblicato vuoto non è «mai pubblicato»', stato({ nascosta: false, bozza: '', pubblicato: '' }), 'pubblicata')

console.log('\nMenu e footer')
const pag = (id, titolo, o = {}) => ({ id, titolo, nascosta: false, pubblicato: '<p>x</p>', diLegge: false, ...o })
const pagine = [
  pag('1', 'Chi siamo'),
  pag('2', 'Orari'),
  pag('3', 'Privacy', { diLegge: true }),
  pag('4', 'Cookie', { diLegge: true }),
  pag('5', 'Bozza nuova', { pubblicato: null }),
  pag('6', 'Vecchia', { nascosta: true }),
]
const voce = (etichetta, paginaId = null, indirizzo = null) => ({ etichetta, paginaId, indirizzo })
const menu = (dove, voci, pg = pagine) => prova(() => p.controllaMenu(dove, voci, pg))
const leggi = [voce('Privacy', '3'), voce('Cookie', '4')]
const nomina = (r, testo) => Array.isArray(r) && r.some((f) => typeof f === 'string' && f.includes(testo))

ok('menu giusto → nessun problema', menu('menu', [voce('Chi siamo', '1'), voce('Sito', null, 'https://esempio.it'), voce('Casa', null, '/')]), [])
ok('menu vuoto → nessun problema', menu('menu', []), [])
ok('menu: le pagine di legge non servono', menu('menu', [voce('Chi siamo', '1')]), [])
ok('etichetta vuota → un problema', menu('menu', [voce('', '1')]).length, 1)
ok('etichetta di soli spazi → un problema', menu('menu', [voce('   ', '1')]).length, 1)
ok('senza destinazione → un problema che nomina la voce', nomina(menu('menu', [voce('Vuota')]), 'Vuota'), true)
ok('due destinazioni → un problema che nomina la voce', nomina(menu('menu', [voce('Doppia', '1', '/x')]), 'Doppia'), true)
ok('verso pagina nascosta → nomina la voce', nomina(menu('menu', [voce('Verso vecchia', '6')]), 'Verso vecchia'), true)
ok('verso pagina mai pubblicata → nomina la voce', nomina(menu('menu', [voce('Verso bozza', '5')]), 'Verso bozza'), true)
ok('verso pagina inesistente → nomina la voce', nomina(menu('menu', [voce('Verso nulla', '99')]), 'Verso nulla'), true)
for (const [nome, ind] of [['javascript:', 'javascript:alert(1)'], ['data:', 'data:text/html,x'], ['«//»', '//evil.example'], ['senza protocollo', 'esempio.it'], ['ftp:', 'ftp://x.it']]) {
  ok(`indirizzo ${nome} → nomina la voce`, nomina(menu('menu', [voce('Fuori', null, ind)]), 'Fuori'), true)
}
for (const ind of ['https://esempio.it/x', 'http://esempio.it', 'mailto:a@b.it', 'tel:+390123456', '/orari']) {
  ok(`indirizzo ${ind} → va bene`, menu('menu', [voce('Ok', null, ind)]), [])
}
ok('più problemi → più frasi', menu('menu', [voce('', '1'), voce('Verso vecchia', '6')]).length, 2)
ok('footer completo → nessun problema', menu('footer', leggi), [])
ok('footer senza Privacy → nomina «Privacy»', nomina(menu('footer', [voce('Cookie', '4')]), 'Privacy'), true)
ok('footer senza Cookie → nomina «Cookie»', nomina(menu('footer', [voce('Privacy', '3')]), 'Cookie'), true)
ok('footer vuoto → nomina tutte e due', nomina(menu('footer', []), 'Privacy') && nomina(menu('footer', []), 'Cookie'), true)
ok('footer: legge nascosta → nomina il titolo', nomina(menu('footer', leggi, pagine.map((x) => (x.id === '3' ? { ...x, nascosta: true } : x))), 'Privacy'), true)
// Cambiato con la Dichiarazione di accessibilità: nel footer una pagina di legge può esserci anche prima di essere pubblicata.
ok('footer: legge mai pubblicata ma nel footer → nessun problema', menu('footer', leggi, pagine.map((x) => (x.id === '4' ? { ...x, pubblicato: null } : x))), [])
ok('footer: la legge richiede anche pagine non di legge? no', menu('footer', [...leggi, voce('Chi siamo', '1')]), [])

console.log('\nRiordinare le voci')
const sposta = (v, da, verso) => prova(() => p.spostaVoce(v, da, verso))
ok('sposta avanti', sposta(['a', 'b', 'c'], 0, 2), ['b', 'c', 'a'])
ok('sposta indietro', sposta(['a', 'b', 'c'], 2, 0), ['c', 'a', 'b'])
ok('sposta di uno', sposta(['a', 'b', 'c'], 1, 2), ['a', 'c', 'b'])
ok('stesso posto → copia identica', sposta(['a', 'b'], 1, 1), ['a', 'b'])
ok('da fuori range → copia identica', sposta(['a', 'b'], 5, 0), ['a', 'b'])
ok('verso fuori range → copia identica', sposta(['a', 'b'], 0, 9), ['a', 'b'])
ok('negativo → copia identica', sposta(['a', 'b'], -1, 0), ['a', 'b'])
const orig = ['a', 'b', 'c']
const nuovo = prova(() => p.spostaVoce(orig, 0, 2))
ok('non muta l\'originale', Array.isArray(nuovo) && orig.join() === 'a,b,c', true)
const copia = prova(() => p.spostaVoce(orig, 9, 0))
ok('la copia non è lo stesso array', Array.isArray(copia) && copia !== orig, true)
ok('funziona con oggetti', sposta([{ n: 1 }, { n: 2 }], 0, 1), [{ n: 2 }, { n: 1 }])

console.log('\nPagine di legge protette')
const prot = (o, a) => prova(() => p.pagineDiLeggeProtette(o, a))
ok('di legge: non si nasconde → una frase', frase(prot({ diLegge: true }, 'nascondi')), true)
ok('di legge: non si cancella → una frase', frase(prot({ diLegge: true }, 'cancella')), true)
ok('le due frasi dicono cose diverse', prot({ diLegge: true }, 'nascondi') !== prot({ diLegge: true }, 'cancella'), true)
ok('normale: si nasconde', prot({ diLegge: false }, 'nascondi'), null)
ok('normale: si cancella', prot({ diLegge: false }, 'cancella'), null)

// ---------------------------------------------------------------------------
console.log('\nModalità prova: le regole del database in memoria')
const nega = (f) => {
  try {
    f()
    return 'NON HA LANCIATO'
  } catch (e) {
    return String(e.message)
  }
}
const ini = () => sp.sitoIniziale()
const idDi = (s, slug) => s.pagine.find((x) => x.slug === slug)?.id
{
  const s = ini()
  const id = idDi(s, 'chi-siamo')
  const v = s.pagine.find((x) => x.id === id).versione
  const salvata = prova(() => sp.salvaBozza(s, id, v, { titolo: 'Chi siamo', descrizione: '', bozza: '<p>Nuovo</p>' }))
  ok('salva la bozza e la versione sale', salvata.versione, v + 1)
  ok('il pubblicato non cambia salvando la bozza', salvata.stato.pagine.find((x) => x.id === id).pubblicato, null)
  ok('versione vecchia → la pagina è cambiata', /è cambiata mentre la modificavi/.test(nega(() => sp.salvaBozza(salvata.stato, id, v, { titolo: 'x', descrizione: '', bozza: '' }))), true)
  ok('testo con script → rifiutato', /non ammette/.test(nega(() => sp.salvaBozza(s, id, v, { titolo: 'x', descrizione: '', bozza: '<script>x</script>' }))), true)
  const pub = prova(() => sp.pubblica(salvata.stato, id, salvata.versione))
  ok('pubblica: il pubblicato è la bozza', pub.stato.pagine.find((x) => x.id === id).pubblicato, '<p>Nuovo</p>')
  ok('pubblica con versione vecchia → fermata', /è cambiata/.test(nega(() => sp.pubblica(salvata.stato, id, v))), true)
  ok('pagina che non c\'è → frase', /non c’è più/.test(nega(() => sp.salvaBozza(s, 'nessuna', 1, { titolo: 'x', descrizione: '', bozza: '' }))), true)
}
{
  const s = ini()
  ok('legge: non si nasconde', /devono restare/.test(nega(() => sp.nascondi(s, idDi(s, 'privacy'), true))), true)
  ok('legge: non si cancella', /devono restare/.test(nega(() => sp.cancella(s, idDi(s, 'cookie')))), true)
  ok('pagina normale: si nasconde', prova(() => sp.nascondi(s, idDi(s, 'chi-siamo'), true)).pagine.find((x) => x.slug === 'chi-siamo').nascosta, true)
  ok('pagina nel menu: non si cancella', /nel menu o nel footer/.test(nega(() => sp.cancella(s, idDi(s, 'home')))), true)
  ok('pagina fuori dal menu: si cancella', prova(() => sp.cancella(s, idDi(s, 'chi-siamo'))).pagine.some((x) => x.slug === 'chi-siamo'), false)
  const n = prova(() => sp.nuovaPagina(s, 'Orari', 'orari'))
  ok('pagina nuova: solo bozza', n.stato.pagine.find((x) => x.id === n.id).pubblicato, null)
  ok('pagina nuova con indirizzo già usato → rifiutata', /già di un/.test(nega(() => sp.nuovaPagina(s, 'Altra', 'home'))), true)
  ok('pagina nuova con indirizzo riservato → rifiutata', nega(() => sp.nuovaPagina(s, 'Admin', 'admin')) !== 'NON HA LANCIATO', true)
  ok('cambia indirizzo', prova(() => sp.cambiaIndirizzo(s, idDi(s, 'home'), 'casa')).pagine.some((x) => x.slug === 'casa'), true)
  ok('cambia indirizzo su uno già usato → rifiutato', nega(() => sp.cambiaIndirizzo(s, idDi(s, 'home'), 'chi-siamo')) !== 'NON HA LANCIATO', true)
  const voci = [{ etichetta: 'Chi siamo', paginaId: idDi(s, 'chi-siamo'), indirizzo: null }]
  ok('menu verso pagina mai pubblicata → rifiutato con il nome', /Chi siamo/.test(nega(() => sp.salvaMenu(s, 'menu', voci))), true)
  ok('footer senza le pagine di legge → rifiutato', /Contributi pubblici|Privacy|Cookie/.test(nega(() => sp.salvaMenu(s, 'footer', []))), true)
}

// ---------------------------------------------------------------------------
console.log('\nDopo le revisioni')
// La bozza dell'editor e quella salvata si scrivono in modo diverso («<br>» contro «<br />»): non è un cambio.
ok('bozza uguale dopo la pulizia → non cambiata', prova(() => p.bozzaCambiata('<p>a<br>b</p>', t.pulisciTesto('<p>a<br>b</p>'))), false)
ok('bozza con una parola in più → cambiata', prova(() => p.bozzaCambiata('<p>a b</p>', '<p>a</p>')), true)
ok('bozza con codice che si toglie → non cambiata', prova(() => p.bozzaCambiata('<p>a</p><script>x</script>', '<p>a</p>')), false)
// I due elenchi (qui e in 56-sito.sql) dei nomi che il sito tiene per sé.
for (const r of ['sitemap', 'robots']) ok(`riservato «${r}» → una frase`, frase(prova(() => p.controllaSlug(r, []))), true)
ok('di legge: l\'indirizzo non si cambia', frase(prot({ diLegge: true }, 'indirizzo')), true)
ok('normale: l\'indirizzo si cambia', prot({ diLegge: false }, 'indirizzo'), null)
ok('titolo cambiato dopo la pubblicazione → modificata', stato({ nascosta: false, bozza: 'a', pubblicato: 'a', titolo: 'Nuovo', titoloPubblicato: 'Vecchio', descrizione: '', descrizionePubblicata: '' }), 'modificata')
ok('descrizione cambiata dopo la pubblicazione → modificata', stato({ nascosta: false, bozza: 'a', pubblicato: 'a', titolo: 'T', titoloPubblicato: 'T', descrizione: 'nuova', descrizionePubblicata: '' }), 'modificata')
ok('titolo e descrizione uguali → pubblicata', stato({ nascosta: false, bozza: 'a', pubblicato: 'a', titolo: 'T', titoloPubblicato: 'T', descrizione: 'd', descrizionePubblicata: 'd' }), 'pubblicata')
ok('menu: una voce senza nome dice cosa fare', menu('menu', [voce('', '1')])[0], 'Ogni voce ha bisogno di un nome')
ok('footer: stessa frase del database', menu('footer', [voce('Cookie', '4')])[0], 'Nel footer deve esserci «Privacy»: è una pagina di legge')
{
  const s = ini()
  const id = idDi(s, 'chi-siamo')
  const v = s.pagine.find((x) => x.id === id).versione
  ok('legge: l\'indirizzo non si cambia (prova)', /tengono il loro indirizzo/.test(nega(() => sp.cambiaIndirizzo(s, idDi(s, 'privacy'), 'riservata-ai-miei'))), true)
  ok('titolo vuoto → rifiutato', nega(() => sp.salvaBozza(s, id, v, { titolo: '  ', descrizione: '', bozza: '' })) !== 'NON HA LANCIATO', true)
  ok('titolo oltre 120 → rifiutato', nega(() => sp.salvaBozza(s, id, v, { titolo: 'a'.repeat(121), descrizione: '', bozza: '' })) !== 'NON HA LANCIATO', true)
  ok('descrizione oltre 300 → rifiutata', nega(() => sp.salvaBozza(s, id, v, { titolo: 'x', descrizione: 'a'.repeat(301), bozza: '' })) !== 'NON HA LANCIATO', true)
  ok('nascondere una pagina che non c\'è → frase', /non c’è più/.test(nega(() => sp.nascondi(s, 'nessuna', true))), true)
  ok('cancellare una pagina che non c\'è → frase', /non c’è più/.test(nega(() => sp.cancella(s, 'nessuna'))), true)
  const dopo = prova(() => sp.cambiaIndirizzo(s, idDi(s, 'home'), 'casa'))
  ok('un indirizzo lasciato è un rinvio: una pagina nuova non lo prende', /era di una pagina che ha cambiato indirizzo/.test(nega(() => sp.nuovaPagina(dopo, 'Home vecchia', 'home'))), true)
  const pub = prova(() => sp.pubblica(prova(() => sp.salvaBozza(s, id, v, { titolo: 'Nuovo titolo', descrizione: 'd', bozza: '<p>x</p>' })).stato, id, v + 1))
  const pagPub = pub.stato.pagine.find((x) => x.id === id)
  ok('pubblica copia anche titolo e descrizione', [pagPub.titoloPubblicato, pagPub.descrizionePubblicata], ['Nuovo titolo', 'd'])
}

// ---------------------------------------------------------------------------
console.log('\nLa Dichiarazione di accessibilità: la pagina di legge nel footer')
{
  const SLUG = 'dichiarazione-accessibilita'
  ok('lo slug è tra le pagine di legge del sito', sg.PAGINE_DI_LEGGE?.includes(SLUG), true)
  ok('lo slug è riservato: una pagina nuova non lo prende', p.controllaSlug?.(SLUG, []), 'Questo indirizzo serve al sito: scegline un altro')
  const acc = (o = {}) => pag('7', 'Dichiarazione di accessibilità', { diLegge: true, pubblicato: null, ...o })
  const tutte = (o) => [...pagine, acc(o)]
  const footer = [...leggi, voce('Accessibilità', '7')]
  ok('legge non pubblicata ma nel footer → nessun problema', menu('footer', footer, tutte()), [])
  ok('legge assente dal footer → «Nel footer deve esserci…»', nomina(menu('footer', leggi, tutte()), 'Nel footer deve esserci «Dichiarazione di accessibilità»'), true)
  ok('legge presente ma nascosta → errore', nomina(menu('footer', footer, tutte({ nascosta: true })), 'Dichiarazione di accessibilità'), true)
  ok('legge pubblicata e nel footer → nessun problema', menu('footer', footer, tutte({ pubblicato: '<p>x</p>' })), [])
  ok('una pagina normale mai pubblicata nel footer resta un errore', nomina(menu('footer', [...footer, voce('Bozza', '5')], tutte()), 'Bozza'), true)
  ok('nel menu in alto la legge non pubblicata resta un errore', nomina(menu('menu', [voce('Accessibilità', '7')], tutte()), 'Accessibilità'), true)
}

console.log('\nI segnaposto [DA COMPILARE]')
{
  const n = (x) => prova(() => ac.segnapostoRimasti(x))
  const pezzi = (...html) => ({ content: html.map((h, i) => ({ type: 'testo', props: { id: `p${i}`, html: h } })) })
  ok('testo vuoto → 0', n(''), 0)
  ok('testo pulito → 0', n('<p>Il sito è stato verificato il 3 novembre.</p>'), 0)
  ok('un segnaposto → 1', n('<p>Stato: [DA COMPILARE: conforme o parzialmente conforme]</p>'), 1)
  ok('tre segnaposto → 3', n('<p>[DA COMPILARE: a]</p><p>[DA COMPILARE: b] e [DA COMPILARE: c]</p>'), 3)
  ok('maiuscole e minuscole miste → contati', n('<p>[da compilare: a] [Da Compilare: b]</p>'), 2)
  ok('un segnaposto spezzato da un grassetto → contato', n('<p>[DA <strong>COMPILARE</strong>: a]</p>'), 1)
  ok('una parola vicina non è un segnaposto', n('<p>Da compilare a mano? No: è tutto fatto.</p>'), 0)
  ok('a pezzi: si sommano i blocchi', n(pezzi('<p>[DA COMPILARE: a]</p>', '<p>niente</p>', '<p>[DA COMPILARE: b] [DA COMPILARE: c]</p>')), 3)
  ok('a pezzi puliti → 0', n(pezzi('<p>fatto</p>', '<p>fatto</p>')), 0)
  ok('a pezzi vuoti → 0', n({ content: [] }), 0)
  // L'editor conta sui pezzi che escono dalla bozza, non sull'HTML: la conversione non deve perderne.
  ok('la traccia aperta a pezzi ha gli stessi segnaposto', n(pz.htmlInPezzi(ac.TRACCIA_ACCESSIBILITA)), n(ac.TRACCIA_ACCESSIBILITA))
}

console.log('\nIl testo-traccia della Dichiarazione')
{
  const T = ac.TRACCIA_ACCESSIBILITA
  ok('la traccia è un testo', typeof T === 'string' && T.length > 0, true)
  const t = typeof T === 'string' ? T : ''
  const testo = t.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ')
  ok('ha almeno quattro segnaposto', ac.segnapostoRimasti?.(t) >= 4, true)
  for (const [cosa, re] of [['lo stato di conformità', /conformit/i], ['i contenuti non accessibili', /non accessibil/i], ['la data della verifica', /data/i], ['il metodo della verifica', /metodo/i], ['il contatto per le segnalazioni', /segnalazion/i]]) {
    ok(`un segnaposto per ${cosa}`, [...testo.matchAll(/\[DA COMPILARE[^\]]*\]/gi)].some((m) => re.test(m[0])), true)
  }
  // Mai un'affermazione senza il segnaposto accanto: la frase («è conforme», «accessibile a tutti») deve stare nella stessa frase di un [DA COMPILARE].
  const frasi = testo.split(/(?<=[.!?])\s+/)
  const nudi = frasi.filter((f) => /\b(è|sono|risulta|risultano)\s+(pienamente\s+|totalmente\s+)?(conform|accessibil)/i.test(f) && !/\[DA COMPILARE/i.test(f))
  ok('nessuna frase «è conforme» senza segnaposto accanto', t !== '' ? nudi : ['(traccia mancante)'], [])
  ok('dice che copre solo il sito pubblico', /sito pubblico/i.test(testo), true)
  ok('dice che non copre l’app per iscritti, segreteria e istruttori', [/iscritti/i.test(testo), /segreteria/i.test(testo), /istruttori/i.test(testo)], [true, true, true])
}

console.log('\nLa Dichiarazione in modalità prova')
{
  const s = ini()
  const d = s.pagine.find((x) => x.slug === 'dichiarazione-accessibilita')
  ok('la quarta pagina di legge c’è, bozza non pubblicata', [d?.titolo, d?.diLegge, d?.pubblicato, d?.nascosta], ['Dichiarazione di accessibilità', true, null, false])
  ok('la bozza è la traccia, con i segnaposto', [d?.bozza !== undefined && d.bozza === ac.TRACCIA_ACCESSIBILITA, ac.segnapostoRimasti?.(d?.bozza ?? '') > 0], [true, true])
  // La traccia vive due volte (app e migrazione): qui si tiene che non si allontanino.
  ok('la migrazione 107 scrive la stessa traccia', prova(() => readFileSync('supabase/107-sito-accessibilita.sql', 'utf8').includes(String(ac.TRACCIA_ACCESSIBILITA).replaceAll("'", "''"))), true)
  ok('la voce «Accessibilità» è in coda al footer', s.footer.map((v) => v.etichetta), ['Privacy policy', 'Cookie policy', 'Contributi pubblici', 'Accessibilità'])
  ok('la voce porta alla pagina', s.footer.at(-1)?.paginaId, d?.id)
  ok('il footer di partenza passa il controllo', prova(() => p.controllaMenu('footer', s.footer, s.pagine)), [])
  ok('si può risalvare il footer com’è, con la pagina ancora in bozza', prova(() => sp.salvaMenu(s, 'footer', s.footer)).footer?.length, 4)
  ok('togliere la voce dal footer è rifiutato', /Nel footer deve esserci «Dichiarazione di accessibilità»/.test(nega(() => sp.salvaMenu(s, 'footer', s.footer.slice(0, 3)))), true)
  ok('non si nasconde', /devono restare/.test(nega(() => sp.nascondi(s, d.id, true))), true)
  ok('non si cancella', /devono restare/.test(nega(() => sp.cancella(s, d.id))), true)
  ok('l’indirizzo non si cambia', /tengono il loro indirizzo/.test(nega(() => sp.cambiaIndirizzo(s, d.id, 'accessibilita'))), true)
  ok('una pagina nuova non può prendere lo slug', /serve al sito/.test(nega(() => sp.nuovaPagina(s, 'Altra', 'dichiarazione-accessibilita'))), true)
}

console.log('\nDopo il collaudo')
for (const ind of ['https://', 'mailto:', 'https://a b', '/<script>', 'https://x.it/"onmouseover="a', '/' + 'a'.repeat(300)]) {
  ok(`indirizzo «${ind.slice(0, 30)}» → nomina la voce`, nomina(menu('menu', [voce('Fuori', null, ind)]), 'Fuori'), true)
  ok(`indirizzo «${ind.slice(0, 30)}» non è valido`, prova(() => p.indirizzoValido(ind)), false)
}
for (const ind of ['https://esempio.it/x?a=1&b=2', 'mailto:a@b.it', 'tel:+390123456', '/orari', '/']) ok(`indirizzo ${ind} è valido`, prova(() => p.indirizzoValido(ind)), true)
ok('«javascript:» non è un indirizzo valido', prova(() => p.indirizzoValido('javascript:alert(1)')), false)
ok('nome di 60 lettere → va bene', menu('menu', [voce('a'.repeat(60), '1')]), [])
ok('nome di 61 lettere → una frase che lo dice', frase(menu('menu', [voce('a'.repeat(61), '1')])[0]) && /60/.test(menu('menu', [voce('a'.repeat(61), '1')])[0]), true)
ok('testo di 200000 lettere → va bene', prova(() => p.testoTroppoLungo('a'.repeat(200000))), null)
ok('testo di 200001 lettere → una frase', frase(prova(() => p.testoTroppoLungo('a'.repeat(200001)))), true)
{
  const s = ini()
  const id = idDi(s, 'chi-siamo')
  const v = s.pagine.find((x) => x.id === id).versione
  ok('bozza oltre 200000 → rifiutata (prova)', nega(() => sp.salvaBozza(s, id, v, { titolo: 'x', descrizione: '', bozza: 'a'.repeat(200001) })) !== 'NON HA LANCIATO', true)
}

// ---------------------------------------------------------------------------
console.log('\nImmagini: regole (src/lib/sitoImmagini.ts)')
const im = await carica('src/lib/sitoImmagini.ts')
ok('pulisciAlt: via virgolette, < e > (il filtro del database rifiuta le entità), spazi in ordine', im.pulisciAlt('  Il "ring" <b>  di   sala '), 'Il ring b di sala')
ok('pulisciAlt: & resta (il database ammette &amp;)', im.pulisciAlt('Judo & lotta'), 'Judo & lotta')
ok('eNomeDelContenitore: uuid.png sì, pagina.html no', [im.eNomeDelContenitore('a.png'), im.eNomeDelContenitore('a.html')], [true, false])
ok('cosaNonVaImmagini: 404 = file 58 da lanciare', /58-sito-immagini/.test(im.cosaNonVaImmagini('Bucket not found', '404')), true)
ok('cosaNonVaImmagini: 403 = solo la segreteria', im.cosaNonVaImmagini('new row violates row-level security policy', '403'), 'Solo la segreteria può caricare le immagini')
ok('cosaNonVaImmagini: troppo grande = la frase del peso', im.cosaNonVaImmagini('Payload too large', '413'), "L'immagine pesa più di 1 MB: prova con una più piccola")
ok('cosaNonVaImmagini: altro = connessione, mai il testo grezzo', /connessione/.test(im.cosaNonVaImmagini('boom: ECONNRESET')), true)
ok('pagineCheUsano: un indirizzo con &amp; nel testo si riconosce', im.pagineCheUsano('https://a.it/x?a=1&b=2', [{ titolo: 'P', bozza: '<img src="https://a.it/x?a=1&amp;b=2" alt="">', pubblicato: null }]), ['P'])
ok('un alt fatto di sole virgolette, ripulito, non basta', im.controllaAlt(im.pulisciAlt('""'), false) !== null, true)
const UUID = '0b9f6c1e-3a4d-4c1b-8e2a-5d7f9a1c2b3e'
ok('contenitore «sito»', im.CONTENITORE, 'sito')
ok('massimo 1 MB', im.MASSIMO_BYTE, 1048576)
ok('tipi ammessi', im.TIPI_AMMESSI, ['image/jpeg', 'image/png', 'image/webp'])
for (const [tipo, est] of [['image/jpeg', 'jpg'], ['image/png', 'png'], ['image/webp', 'webp']]) {
  ok(`nome per ${tipo}: uuid.${est}`, prova(() => im.nomeNelContenitore(UUID, tipo)), `${UUID}.${est}`)
}
for (const tipo of ['image/svg+xml', 'image/gif', 'application/pdf', 'image/heic', '']) {
  ok(`nome per «${tipo}» → null (non ammesso)`, prova(() => im.nomeNelContenitore(UUID, tipo)), null)
}
// Il nome del file di chi carica non entra mai nel contenitore: si usa l'uuid.
ok('«Foto Mario Rossi (1).JPG» non è mai il nome nel bucket', /^[0-9a-f-]{36}\.jpg$/.test(String(prova(() => im.nomeNelContenitore(UUID, 'image/jpeg')))), true)
ok('tipo ammesso e piccolo → nessun messaggio', prova(() => im.controllaImmagine({ type: 'image/png', size: 500000 })), null)
ok('esattamente 1 MB → va bene', prova(() => im.controllaImmagine({ type: 'image/webp', size: 1048576 })), null)
ok('SVG → «solo JPEG, PNG o WebP»', prova(() => im.controllaImmagine({ type: 'image/svg+xml', size: 100 })), 'Vanno bene solo immagini JPEG, PNG o WebP')
ok('oltre 1 MB → «prova con una più piccola»', prova(() => im.controllaImmagine({ type: 'image/jpeg', size: 1048577 })), "L'immagine pesa più di 1 MB: prova con una più piccola")
ok('senza testo e non decorativa → una frase', prova(() => im.controllaAlt('  ', false)), 'Scrivi cosa si vede nell\'immagine, oppure scegli «solo decorativa»')
ok('con testo → nessun messaggio', prova(() => im.controllaAlt('Il tatami', false)), null)
ok('decorativa senza testo → nessun messaggio', prova(() => im.controllaAlt('', true)), null)
// Il testo alternativo di una foto già nel testo: decorativa = vuoto di proposito, altrimenti ripulito come alla scelta.
ok('altDellaFoto: decorativa → vuoto anche se c\'era testo', prova(() => im.altDellaFoto('Il tatami', true)), '')
ok('altDellaFoto: ripulito come alla scelta', prova(() => im.altDellaFoto('  Il "ring"  di sala ', false)), 'Il ring di sala')
ok('immaginiNelTesto: src in ordine, senza doppioni', prova(() => im.immaginiNelTesto('<p>a</p><img src="u1" alt="x"><img alt="" src="u2"><img src="u1" alt="y">')), ['u1', 'u2'])
ok('immaginiNelTesto: senza immagini → vuoto', prova(() => im.immaginiNelTesto('<p>solo testo</p>')), [])
{
  const U = 'https://x.supabase.co/storage/v1/object/public/sito/a.jpg'
  const pagine = [
    { titolo: 'Solo bozza', bozza: `<img src="${U}" alt="">`, pubblicato: null },
    { titolo: 'Solo pubblicato', bozza: '<p>tolta</p>', pubblicato: `<img src="${U}" alt="">` },
    { titolo: 'Tutte e due', bozza: `<img src="${U}" alt="">`, pubblicato: `<img src="${U}" alt="">` },
    { titolo: 'Nessuna', bozza: '<p>x</p>', pubblicato: null },
  ]
  ok('pagineCheUsano: bozza O pubblicato, una volta sola', prova(() => im.pagineCheUsano(U, pagine)), ['Solo bozza', 'Solo pubblicato', 'Tutte e due'])
  ok('pagineCheUsano: altra immagine → nessuna', prova(() => im.pagineCheUsano(U.replace('a.jpg', 'b.jpg'), pagine)), [])
}
ok('urlImmagine', prova(() => im.urlImmagine('https://x.supabase.co', 'a.jpg')), 'https://x.supabase.co/storage/v1/object/public/sito/a.jpg')
ok('urlImmagine: barra finale tolta', prova(() => im.urlImmagine('https://x.supabase.co/', 'a.jpg')), 'https://x.supabase.co/storage/v1/object/public/sito/a.jpg')

console.log('\nImmagini: segreteria in modalità prova')
{
  const mem = new Map()
  globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) }
  globalThis.window = { location: { search: '', hash: '' }, addEventListener() {} }
  const sg = await carica('src/lib/segreteriaProva.ts')
  const s = prova(() => sg.creaSegreteriaProva())
  const chiama = async (f) => {
    try {
      return await f()
    } catch (e) {
      return `ERRORE: ${e.message}`
    }
  }
  const png = (n) => new File([new Uint8Array(10)], n, { type: 'image/png' })
  const elenco = async () => await chiama(() => s.sitoImmagini())
  const nomi = async () => {
    const e = await elenco()
    return Array.isArray(e) ? e.map((x) => x.nome) : e
  }
  ok('all\'inizio l\'elenco è vuoto', await nomi(), [])
  const a = await chiama(() => s.caricaImmagineSito(png('Foto Mario Rossi (1).PNG')))
  await new Promise((r) => setTimeout(r, 5))
  const b = await chiama(() => s.caricaImmagineSito(png('seconda.png')))
  ok('caricata: nome come uuid.png, non quello del file', /^[0-9a-f-]{36}\.png$/.test(String(a?.nome)), true)
  ok('caricata: url è una stringa non vuota', typeof a?.url === 'string' && a.url.length > 0, true)
  ok('l\'elenco le ha, la più recente prima', await nomi(), [b?.nome, a?.nome])
  ok('ogni voce dell\'elenco ha un url', (await elenco()).every?.((x) => typeof x.url === 'string' && x.url.length > 0), true)
  const svg = await chiama(() => s.caricaImmagineSito(new File(['<svg/>'], 'a.svg', { type: 'image/svg+xml' })))
  ok('un SVG è rifiutato con la frase', svg, 'ERRORE: Vanno bene solo immagini JPEG, PNG o WebP')
  const grande = await chiama(() => s.caricaImmagineSito(new File([new Uint8Array(2 * 1024 * 1024)], 'g.png', { type: 'image/png' })))
  ok('un file da 2 MB è rifiutato con la frase', grande, "ERRORE: L'immagine pesa più di 1 MB: prova con una più piccola")
  ok('dopo i rifiuti l\'elenco non cambia', await nomi(), [b?.nome, a?.nome])
  await chiama(() => s.cancellaImmagineSito(a?.nome))
  ok('cancella ne toglie una', await nomi(), [b?.nome])
}

console.log(guai ? `\n${guai} ✗` : '\nTutto ✓')
process.exit(guai ? 1 : 0)
