// ---------------------------------------------------------------------------
// L'aspetto del sito pubblico («A2 · Tatami blu e giallo»), senza browser.
//
//   node scripts/prova-sito-aspetto.mjs
//
// `src/lib/sitoGenera.ts`: colori, carattere, contrasto, testata, invito e
// piede del sito generato. Il CSS si legge come testo: si trovano le regole, si
// risolvono le variabili (`var(--x)`) e si guarda quel che vale davvero, così la
// prova non dipende dai nomi che il codice dà ai token. Token: sezione A2 di
// docs/design-canvas/sito-approvato/token-proposta.md.
// ---------------------------------------------------------------------------
import { build } from 'esbuild'
import { existsSync, readdirSync, readFileSync } from 'node:fs'

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
const genera = (d) => {
  const r = prova(() => g.generaSito(d))
  return typeof r === 'object' && r !== null ? r : {}
}
const c = (r, f) => (typeof r[f] === 'string' ? r[f] : '')
const conta = (t, re) => (t.match(re) || []).length

// --- Il CSS come dati -------------------------------------------------------
const stile = (t) => t.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? ''
/** Il contenuto del primo blocco che comincia con `inizio` (parentesi bilanciate), e il CSS senza quel blocco. */
const blocco = (t, inizio) => {
  const i = t.indexOf(inizio)
  if (i < 0) return null
  const a = t.indexOf('{', i)
  for (let k = a, p = 0; k < t.length; k++) {
    if (t[k] === '{') p++
    else if (t[k] === '}' && --p === 0) return { dentro: t.slice(a + 1, k), senza: t.slice(0, i) + t.slice(k + 1) }
  }
  return null
}
/** Le regole semplici, anche quelle dentro i @media: {sel: [selettori], dich: {proprietà: valore}}. */
const regole = (t) =>
  [...t.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
    sel: m[1].trim().split(/\s*,\s*/),
    dich: Object.fromEntries(m[2].split(';').filter((x) => x.includes(':')).map((x) => { const i = x.indexOf(':'); return [x.slice(0, i).trim(), x.slice(i + 1).trim()] })),
  }))
const radice = (R) => Object.assign({}, ...R.filter((r) => r.sel.includes(':root')).map((r) => r.dich))
const risolvi = (v, V) => {
  let x = v ?? ''
  for (let i = 0; i < 5; i++) x = x.replace(/var\((--[\w-]+)\)/g, (_, n) => V[n] ?? '')
  return x.trim().toLowerCase()
}
const hex = (v) => {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(v)
  return m ? '#' + (m[1].length === 3 ? [...m[1]].map((x) => x + x).join('') : m[1]) : null
}
const luce = (h) => {
  const [r, gg, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * gg + 0.0722 * b
}
const contrasto = (a, b) => {
  const [x, y] = [luce(a), luce(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}
/** Le dichiarazioni (variabili risolte) di tutte le regole che hanno un selettore con `quale`. */
const dich = (R, V, quale) => {
  const fuori = {}
  for (const r of R) if (r.sel.some(quale)) for (const [k, v] of Object.entries(r.dich)) fuori[k] = risolvi(v, V)
  return fuori
}
const sfondo = (d) => hex(d.background ?? d['background-color'] ?? '')

const FONDO = '#eef5fa', INCHIOSTRO = '#0d2a3d', BLU = '#14709f', CHIARA = '#cfe6f4', GIALLO = '#f4c31b', BIANCO = '#ffffff'

// ---------------------------------------------------------------------------
const con = genera(dati({
  pagine: [pag('home'), pag('judo'), pag('contatti'), pag('privacy', { diLegge: true })],
  menu: [voce('menu', 1, 'Judo', 'judo'), voce('menu', 2, 'Contatti', 'contatti')],
}))
const senza = genera(dati())
const home = c(con, 'index.html')
const CSS = stile(home)
const R = regole(CSS)
const V = radice(R)
const testata = (t) => (t.match(/<header[\s\S]*?<\/header>/) || [''])[0]
const piedeDi = (t) => (t.match(/<footer[\s\S]*?<\/footer>/) || [''])[0]

console.log('\nColori: solo i token A2 e il bianco')
{
  ok('il file ha un CSS da guardare', CSS.length > 0, true)
  const usati = [...new Set([...home.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map((m) => hex(m[0].toLowerCase()) ?? m[0].toLowerCase()))].sort()
  const ammessi = [FONDO, INCHIOSTRO, BLU, CHIARA, GIALLO, BIANCO]
  ok('nessun #rrggbb fuori da fondo, inchiostro, blu, tessera chiara, giallo e bianco', CSS ? usati.filter((x) => !ammessi.includes(x)) : 'nessun CSS', [])
  ok('i cinque colori A2 ci sono tutti', CSS ? [FONDO, INCHIOSTRO, BLU, CHIARA, GIALLO].filter((x) => !usati.includes(x)) : 'nessun CSS', [])
  ok('il fondo della pagina è #eef5fa e il testo #0d2a3d', [hex(dich(R, V, (x) => x === 'body').background ?? dich(R, V, (x) => x === 'body')['background-color'] ?? ''), hex(dich(R, V, (x) => x === 'body').color ?? '')], [FONDO, INCHIOSTRO])
}

console.log('\nCarattere: Big Shoulders Display e Inter, file del sito')
{
  const facce = [...CSS.matchAll(/@font-face\{([^}]*)\}/g)].map((m) => m[1])
  const famiglia = (f) => (f.match(/font-family:\s*"?([^";]+?)"?\s*(;|$)/) || [, ''])[1]
  ok('due @font-face: Big Shoulders Display e Inter', facce.map(famiglia).sort(), ['Big Shoulders Display', 'Inter'])
  ok('ognuno con font-display:swap', facce.length > 0 && facce.every((f) => /font-display:\s*swap/.test(f)), true)
  const file = facce.flatMap((f) => [...f.matchAll(/url\(\/risorse\/([^)]+\.woff2)\)/g)].map((m) => m[1]))
  ok('ognuno con un url(/risorse/….woff2) e format("woff2")', facce.length > 0 && facce.every((f) => /url\(\/risorse\/[^)]+\.woff2\)\s*format\("woff2"\)/.test(f)), true)
  ok('i file esistono in sito/risorse', file.length > 0 && file.every((n) => existsSync(`sito/risorse/${n}`)), true)
  const risorse = existsSync('sito/risorse') ? readdirSync('sito/risorse') : []
  const ofl = risorse.filter((n) => /^OFL/i.test(n)).map((n) => readFileSync(`sito/risorse/${n}`, 'utf8')).join('\n')
  ok('la licenza OFL di Big Shoulders e quella di Inter sono accanto ai file', [/Big Shoulders/i.test(ofl), /\bInter\b/.test(ofl), /SIL OPEN FONT LICENSE/i.test(ofl)], [true, true, true])
  ok('Bricolage Grotesque è uscito: né nel CSS né in sito/risorse', [/bricolage/i.test(CSS), risorse.filter((n) => /bricolage/i.test(n))], [false, []])
  ok('nessun indirizzo esterno nel CSS (niente fonts.googleapis.com, niente http)', /https?:\/\/|\/\/[a-z]/i.test(CSS.replace(/\/\*[\s\S]*?\*\//g, '')), false)
  ok('nessun @import né <script', [/@import/i.test(home), /<script/i.test(senzaDati(home))], [false, false])
  const fam = (d) => d['font-family'] ?? ''
  const corpo = fam(dich(R, V, (x) => x === 'body'))
  ok('il testo è Inter, con ripiego Helvetica Neue e Arial', [/^"?inter"?\s*,/.test(corpo), /helvetica neue/.test(corpo), /\barial\b/.test(corpo)], [true, true, true])
  const titolo = fam(dich(R, V, (x) => /(^|\s)h1$/.test(x)))
  ok('l’h1 è Big Shoulders Display, con ripiego Arial Narrow', [/big shoulders display/.test(titolo), /arial narrow/.test(titolo)], [true, true])
  const t1 = dich(R, V, (x) => /(^|\s)h1$/.test(x))
  const t2 = dich(R, V, (x) => /^\.testo h2$/.test(x))
  ok('h1 in maiuscolo', t1['text-transform'], 'uppercase')
  ok('h2 del testo in maiuscolo e col font display', [t2['text-transform'], /big shoulders display/.test(t2['font-family'] ?? '')], ['uppercase', true])
}

console.log('\nContrasto: almeno 4,5:1')
{
  const coppie = [['bianco su blu', BIANCO, BLU], ['bianco su inchiostro', BIANCO, INCHIOSTRO], ['inchiostro su giallo', INCHIOSTRO, GIALLO], ['inchiostro su tessera chiara', INCHIOSTRO, CHIARA], ['inchiostro su fondo', INCHIOSTRO, FONDO]]
  for (const [nome, a, b] of coppie) ok(`${nome}: ≥ 4,5:1`, contrasto(a, b) >= 4.5, true)
  // Le coppie che il CSS usa davvero: una regola con sfondo e colore dichiarati insieme.
  const male = []
  let guardate = 0
  for (const r of R) {
    const sf = sfondo(Object.fromEntries(Object.entries(r.dich).map(([k, v]) => [k, risolvi(v, V)])))
    const co = hex(risolvi(r.dich.color, V))
    if (sf && co) { guardate++; if (contrasto(sf, co) < 4.5) male.push(`${r.sel.join(',')}: ${co} su ${sf}`) }
  }
  ok('ogni regola con sfondo e colore insieme arriva a 4,5:1', guardate > 0 ? male : 'nessuna regola trovata', [])
  const inv = dich(R, V, (x) => x === '.invito')
  ok('l’invito è una tessera gialla con l’inchiostro sopra', [sfondo(inv), hex(inv.color ?? '')], [GIALLO, INCHIOSTRO])
  const pulsanti = R.filter((r) => r.sel.some((x) => /pulsante/.test(x) && !/:hover/.test(x)))
  ok('c’è un pulsante giallo con l’inchiostro sopra', pulsanti.some((r) => sfondo(Object.fromEntries(Object.entries(r.dich).map(([k, v]) => [k, risolvi(v, V)]))) === GIALLO && hex(risolvi(r.dich.color, V)) === INCHIOSTRO), true)
}

console.log('\nPulsante al passaggio del mouse: non schiarisce')
{
  const hover = R.filter((r) => r.sel.some((x) => /pulsante.*:hover/.test(x)))
  const peggio = []
  for (const r of hover) {
    for (const x of r.sel.filter((x) => /pulsante.*:hover/.test(x))) {
      const dopo = sfondo(Object.fromEntries(Object.entries(r.dich).map(([k, v]) => [k, risolvi(v, V)])))
      const base = sfondo(dich(R, V, (y) => y === x.replace(':hover', '')))
      if (dopo && base && luce(dopo) > luce(base)) peggio.push(`${x}: ${base} → ${dopo}`)
    }
  }
  ok('ogni :hover del pulsante cambia qualcosa che si vede (sottolineatura)', hover.length > 0 && hover.every((r) => /underline/.test(r.dich['text-decoration'] ?? '')), true)
  ok('nessun :hover del pulsante ha lo sfondo più chiaro di quello a riposo', peggio, [])
}

console.log('\nLogo: le misure dichiarate sono quelle del file')
{
  const b = readFileSync('sito/risorse/logo.webp')
  let w = 0, h = 0
  if (b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') {
    const tipo = b.toString('ascii', 12, 16)
    if (tipo === 'VP8 ') { w = b.readUInt16LE(26) & 0x3fff; h = b.readUInt16LE(28) & 0x3fff }
    else if (tipo === 'VP8X') { w = 1 + b.readUIntLE(24, 3); h = 1 + b.readUIntLE(27, 3) }
    else if (tipo === 'VP8L') { const x = b.readUInt32LE(21); w = (x & 0x3fff) + 1; h = ((x >> 14) & 0x3fff) + 1 }
  }
  const img = testata(home).match(/<img\b[^>]*>/)?.[0] ?? ''
  ok('width e height dell’<img> sono quelle di sito/risorse/logo.webp', [Number(/\bwidth="(\d+)"/.exec(img)?.[1]), Number(/\bheight="(\d+)"/.exec(img)?.[1])], [w, h])
}

console.log('\nTastiera e movimento')
{
  const fv = dich(R, V, (x) => /:focus-visible/.test(x))
  const sel = R.filter((r) => r.sel.some((x) => /:focus-visible/.test(x))).flatMap((r) => r.sel).join(',')
  ok(':focus-visible vale per i link e per i pulsanti (button)', [/\ba:focus-visible/.test(sel), /button:focus-visible/.test(sel)], [true, true])
  ok('il contorno del focus è di almeno 3px', parseFloat((/(\d+(?:\.\d+)?)px/.exec(fv.outline ?? fv['outline-width'] ?? '') || [, 0])[1]) >= 3, true)
  const mov = blocco(CSS, '@media (prefers-reduced-motion:no-preference)')
  ok('c’è un @media (prefers-reduced-motion:no-preference)', mov !== null, true)
  ok('le transizioni e le animazioni stanno solo lì dentro', mov ? !/transition|animation/.test(mov.senza) : 'nessun blocco', true)
}

console.log('\nTitolo lungo e menu lungo')
{
  const lungo = 'Judo'.repeat(50)
  const voci = Array.from({ length: 12 }, (_, i) => voce('menu', i + 1, `Voce numero ${i + 1}`, i % 2 ? 'orari' : 'judo'))
  const r = genera(dati({ pagine: [pag('home', { titolo: lungo }), pag('judo'), pag('orari')], menu: voci }))
  const t = c(r, 'index.html')
  ok('il titolo di 200 caratteri è nell’h1 e ce n’è uno solo', [conta(t, /<h1[\s>]/g), t.includes(`>${lungo}</h1>`)], [1, true])
  ok('l’h1 manda a capo anche una parola lunghissima (overflow-wrap)', /anywhere|break-word/.test(dich(R, V, (x) => /(^|\s)h1$/.test(x))['overflow-wrap'] ?? ''), true)
  ok('le 12 voci sono nel menu', conta((t.match(/<nav[\s\S]*?<\/nav>/) || [''])[0], /<li>/g), 12)
  const fuoriMedia = regole(blocco(CSS, '@media (max-width:900px)')?.senza ?? CSS)
  ok('il menu va a capo (flex-wrap:wrap) anche sopra i 900px, non solo sotto', /wrap/.test(dich(fuoriMedia, V, (x) => /nav ul$/.test(x))['flex-wrap'] ?? ''), true)
}

console.log('\nTestata: logo intero, menu, pulsante «Prova»')
{
  const t = testata(home)
  const imgs = t.match(/<img\b[^>]*>/g) || []
  ok('un solo logo in testata, un’immagine con alt', [imgs.length, /src="\/risorse\/logo\.webp"/.test(imgs[0] ?? ''), /\balt="[^"]+"/.test(imgs[0] ?? '')], [1, true, true])
  const ritaglio = R.filter((r) => r.sel.some((x) => /logo/.test(x))).filter((r) => /overflow:\s*hidden|object-position|background-position|object-fit:\s*cover/.test(JSON.stringify(r.dich)) || /^-/.test(r.dich.left ?? '') || /^-/.test(r.dich.top ?? '') || /%/.test(r.dich.width ?? '') && /img/.test(r.sel.join()))
  ok('il logo non è ritagliato (niente overflow nascosto, spostamenti o larghezza oltre il 100%)', ritaglio.map((r) => r.sel.join()), [])
  ok('il menu è nella testata, senza icona a tre righe', [/<nav\b[^>]*aria-label="Principale"/.test(t), /<button\b/.test(t), /burger|hamburger|menu-toggle/i.test(home)], [true, false, false])
  ok('con la pagina contatti: pulsante «Iscriviti» verso il modulo di iscrizione in testata', /<a class="pulsante primario" href="https:\/\/app\.officinedellosport\.it\/iscrizioni\/"[^>]*>Iscriviti<\/a>/.test(t), true)
  ok('con la pagina contatti: in testata a destra c’è solo «Iscriviti», niente «Scrivici»; «Contatti» è una voce dell’elenco del menu', [/<div class="azioni"><a class="pulsante primario" href="https:\/\/app\.officinedellosport\.it\/iscrizioni\/"[^>]*>[^<]*<\/a><\/div>/.test(t), /Scrivici/.test(t), /<a [^>]*href="\/contatti\/"[^>]*>Contatti<\/a>/.test((t.match(/<nav[\s\S]*?<ul>([\s\S]*?)<\/ul>/) || ['', ''])[1])], [true, false, true])
  ok('nel piede «Contatti» resta tra le pagine', /<nav class="piede-menu"[^>]*>[\s\S]*?href="\/contatti\/"/.test(piedeDi(home)), true)
  ok('senza la pagina contatti: nessun pulsante «Prova» né link a /contatti/', c(senza, 'index.html') !== '' && !/\/contatti\//.test(c(senza, 'index.html')), true)
  const mob = blocco(CSS, '@media (max-width:900px)')
  const rm = mob ? regole(mob.dentro) : []
  ok('sotto i 900px il tasto MENU sta accanto al logo e il menu, chiuso, si apre in colonna', [dich(R, V, (x) => x === '.testata .tasto-menu').display, dich(R, V, (x) => x === '#menu').display, dich(R, V, (x) => x === '#menu:target').display, dich(R, V, (x) => /nav ul$/.test(x))['flex-direction']], ['inline-flex', 'none', 'block', 'column'])
  ok('le voci del menu sono alte almeno 48px', parseFloat((/(\d+(?:\.\d+)?)px/.exec(dich(R, V, (x) => /nav a$/.test(x))['min-height'] ?? '') || [, 0])[1]) >= 48, true)
}

console.log('\nNiente ingranaggio decorativo')
{
  const piede = piedeDi(home)
  ok('nessun disegno di ingranaggio (fill-rule, .motivo, .nel-foro, .marchio) nel file', [/fill-rule/.test(home), /motivo|nel-foro/.test(home), /class="marchio"/.test(home)], [false, false, false])
  ok('né nella testata né nel piede c’è un <svg', [/<svg/.test(testata(home)), /<svg/.test(piede)], [false, false])
  ok('il logo resta in testata', /<img[^>]*logo\.webp/.test(testata(home)), true)
}

console.log('\nPiede e invito')
{
  const C = s.CONTATTI || {}
  const piede = piedeDi(home)
  const pie = dich(R, V, (x) => x === '.piede')
  ok('il piede è una tessera scura #0d2a3d', [sfondo(pie), piede !== ''], [INCHIOSTRO, true])
  ok('i recapiti di oggi: indirizzo, telefono, Instagram, Facebook', [piede.includes(C.indirizzo ?? '?'), piede.includes(C.telefono ?? '?'), piede.includes(C.instagram ?? '?'), piede.includes(C.facebook ?? '?')], [true, true, true, true])
  ok('e niente di più: quattro recapiti in elenco e le voci del menu come link a parte, senza voci di piede', [conta(piede, /<li>/g), conta(piede, /<nav class="piede-menu"[^>]*>(?:<a\b[^>]*>[^<]*<\/a>)+<\/nav>/g)], [4, 1])
  const inv = (t) => (t.match(/<a class="invito"[\s\S]*?<\/a>/) || [''])[0]
  const j = c(con, 'judo/index.html')
  ok('l’invito in fondo: link al modulo di iscrizione con «Iscriviti», dopo il contenuto e prima del piede', [/href="https:\/\/app\.officinedellosport\.it\/iscrizioni\/"/.test(inv(j)), />Iscriviti</.test(inv(j)), j.indexOf('</main>') < j.indexOf('class="invito"'), j.indexOf('class="invito"') < j.indexOf('<footer')], [true, true, true, true])
  ok('c’è anche nella pagina contatti (il design la ha)', /href="https:\/\/app\.officinedellosport\.it\/iscrizioni\/"/.test(inv(c(con, 'contatti/index.html'))), true)
  ok('non c’è se la pagina contatti non esiste', inv(c(senza, 'index.html')), '')
  ok('«Prova» dell’invito è grande', /clamp\(\s*\d{2,3}px|^\d{2,3}px/.test(dich(R, V, (x) => /^\.invito .*parola$/.test(x))['font-size'] ?? ''), true)
}

console.log('\nPulsante «Contattaci» sotto titolo e frase: in nessuna pagina (sta già in testata)')
{
  const r = genera(dati({ pagine: [pag('home'), pag('judo'), pag('chi-siamo'), pag('contatti')] }))
  const sotto = (t) => /<a class="pulsante" href="\/contatti\/">Contattaci<\/a>/.test(t.replace(testata(t), ''))
  ok('né la Home né Judo, Chi siamo e Contatti lo hanno', ['index.html', 'judo/index.html', 'chi-siamo/index.html', 'contatti/index.html'].map((f) => sotto(c(r, f))), [false, false, false, false])
}

console.log('\nPagine di legge: una colonna di testo')
{
  const t = c(con, 'privacy/index.html')
  ok('niente scena né pulsante «Contattaci» nell’intestazione', [/class="scena"/.test(t), /Contattaci/.test(t.replace(testata(t), '')), /class="[^"]*pagina-hero/.test(t)], [false, false, false])
  ok('titolo e testo in una colonna: pagina-testo + .testo', [/class="pagina-testo"/.test(t), /<div class="testo">/.test(t)], [true, true])
}

console.log('\nAngoli: 6px')
{
  const raggi = R.flatMap((r) => (r.dich['border-radius'] ? [{ sel: r.sel.join(), v: risolvi(r.dich['border-radius'], V) }] : []))
  // Le pillole (999px) sono capsule come nel design: quelle d'età della Home (`.pillola`) e le fasce della pagina Corsi (`ul.fasce li`). Tutto il resto è 6px, 0 o un cerchio.
  ok('ogni border-radius è 6px (o 0, o un cerchio al 50%; le pillole sono capsule, i puntini delle citazioni sono tondi)', raggi.filter((x) => !['6px', '0', '50%'].includes(x.v) && !(['.pillola', 'ul.fasce li'].includes(x.sel) && x.v === '999px') && !/::scroll-marker$/.test(x.sel)).map((x) => `${x.sel}: ${x.v}`), [])
  ok('pulsante, invito e immagini del testo hanno 6px', ['.pulsante', '.invito', '.testo img'].map((n) => dich(R, V, (x) => x === n)['border-radius']), ['6px', '6px', '6px'])
}

console.log('\nLarghezza')
{
  // Su uno schermo largo la pagina non si allarga senza fine: sta in una colonna centrata, e il fondo resta quello.
  const b = dich(R, V, (x) => x === 'body')
  ok('il body ha una larghezza massima', /^\d+px$/.test(b['max-width'] ?? ''), true)
  ok('il body è centrato', b.margin, '0 auto')
}

console.log('\nLa freccia ↗')
{
  // Senza U+FE0E (variante testo) Safari su iPhone disegna ↗ come emoji, un riquadro azzurro, invece della freccia nel colore del testo.
  const tutto = Object.values(con).filter((x) => typeof x === 'string').join('\n')
  ok('c’è almeno una freccia nel sito', tutto.includes('↗'), true)
  ok('ogni freccia ↗ è testo, non emoji', conta(tutto, /↗(?!\uFE0E)/g), 0)
}

console.log('\nDeterminismo')
{
  const d = dati({ pagine: [pag('home'), pag('contatti'), pag('privacy', { diLegge: true })] })
  ok('stesso input due volte: file identici', JSON.stringify(genera(d)) === JSON.stringify(genera(JSON.parse(JSON.stringify(d)))) && Object.keys(genera(d)).length > 0, true)
}

console.log(guai ? `\n✗ ${guai} casi falliti` : '\nTutto a posto.')
process.exit(guai ? 1 : 0)
