// ---------------------------------------------------------------------------
// Le pagine del sito a pezzi (PR 1), senza browser.
//
//   node scripts/prova-sito-pezzi.mjs
//
// `src/lib/sitoPezzi.ts`: i pezzi (foto in cima, testo, foto, colonne) e il
// loro HTML piatto; `pulisciTesto` ammette le colonne; `generaSito` le lascia
// intatte e il CSS le affianca (le impila sul telefono). Il sito resta statico.
// ---------------------------------------------------------------------------
import { build } from 'esbuild'

const carica = async (file) => {
  try {
    const { outputFiles } = await build({
      entryPoints: [file], bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
      define: { 'import.meta.env': '{}' },
      banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(process.cwd() + '/');" },
    })
    return await import('data:text/javascript;base64,' + Buffer.from(outputFiles[0].text).toString('base64'))
  } catch (e) {
    console.log(`  (modulo mancante: ${file} — ${String(e.message).split('\n')[0]})`)
    return {}
  }
}
const z = await carica('src/lib/sitoPezzi.ts')
const t = await carica('src/lib/sitoTesto.ts')
const g = await carica('src/lib/sitoGenera.ts')
const sp = await carica('src/lib/sitoProva.ts')
const sb = await carica('src/lib/segreteriaSupabase.ts')

let guai = 0
const ok = (cosa, avuto, voluto) => {
  const va = JSON.stringify(avuto) === JSON.stringify(voluto)
  console.log(va ? '  ✓' : '  ✗', cosa, va ? '' : `— atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`)
  if (!va) guai++
}
const prova = (f) => {
  try { return f() } catch (e) { return `ERRORE: ${e.message}` }
}
const valido = (x) => prova(() => z.pezziValidi(x))
const html = (content) => prova(() => z.pezziInHtml({ content }))
const T = (id, h) => ({ type: 'testo', props: { id, html: h } })
const F = (id, src = 'https://x.it/a.jpg', alt = 'Un tatami') => ({ type: 'foto', props: { id, src, alt } })
const C = (id, colonne) => ({ type: 'colonne', props: { id, colonne } })
const CIMA = (id) => ({ type: 'fotoInCima', props: { id, src: 'https://x.it/c.jpg', alt: 'Cima' } })
const buono = (r) => typeof r === 'string' && !r.startsWith('ERRORE')
const pulisci = (h) => prova(() => t.pulisciTesto(h))

console.log('\nPezzi: pagina vuota e validità')
ok('pezziVuoti è una pagina senza pezzi', prova(() => z.pezziVuoti()), { content: [] })
ok('una pagina vuota è valida', valido({ content: [] }), true)
ok('una pagina con tutti i tipi è valida', valido({ content: [CIMA('a'), T('b', '<p>x</p>'), F('c'), C('d', [{ html: '<p>1</p>' }, { html: '' }])] }), true)
ok('tre colonne sono valide', valido({ content: [C('d', [{ html: 'a' }, { html: 'b' }, { html: 'c' }])] }), true)
for (const [cosa, x] of [
  ['null', null], ['una stringa', 'testo'], ['un array', []], ['senza content', {}], ['content non array', { content: 'x' }],
  ['un tipo sconosciuto', { content: [{ type: 'video', props: { id: 'a' } }] }],
  ['quattro colonne', { content: [C('a', [{ html: '1' }, { html: '2' }, { html: '3' }, { html: '4' }])] }],
  ['una colonna sola', { content: [C('a', [{ html: '1' }])] }],
  ['id doppi', { content: [T('a', 'x'), F('a')] }],
  ['id vuoto', { content: [T('', 'x')] }],
  ['id che non è stringa', { content: [T(1, 'x')] }],
  ['html che non è stringa', { content: [T('a', 5)] }],
  ['html di colonna che non è stringa', { content: [C('a', [{ html: 1 }, { html: 'b' }])] }],
  ['due foto in cima', { content: [CIMA('a'), CIMA('b')] }],
  ['foto in cima non al primo posto', { content: [T('a', 'x'), CIMA('b')] }],
  ['101 pezzi', { content: Array.from({ length: 101 }, (_, i) => T('p' + i, 'x')) }],
  ['foto senza src', { content: [{ type: 'foto', props: { id: 'a', alt: '' } }] }],
]) ok(`non è valida: ${cosa}`, valido(x), false)
const grosso = (n) => ({ content: Array.from({ length: n }, (_, i) => T('g' + i, 'x'.repeat(150000))) })
ok('non è valida: più di 400000 caratteri in tutto (il limite del database)', valido(grosso(3)), false)
ok('due testi da 150000 caratteri sono ancora validi', valido(grosso(2)), true)
ok('100 pezzi sono ancora validi', valido({ content: Array.from({ length: 100 }, (_, i) => T('p' + i, 'x')) }), true)

console.log('\nPezzi: l\'HTML piatto')
ok('una pagina vuota dà testo vuoto', html([]), '')
ok('un testo è il suo html', html([T('a', '<p>Ciao</p>')]), '<p>Ciao</p>')
ok('una foto è un img con alt', html([F('a')]), '<img alt="Un tatami" src="https://x.it/a.jpg" />')
ok('alt vuoto resta alt=""', html([F('a', 'https://x.it/a.jpg', '')]), '<img alt="" src="https://x.it/a.jpg" />')
ok('la foto in cima è un img', html([CIMA('a')]), '<img alt="Cima" src="https://x.it/c.jpg" />')
ok('due colonne: contenitore c-2', html([C('a', [{ html: '<p>1</p>' }, { html: '<p>2</p>' }])]),
  '<div class="colonne c-2"><div class="colonna"><p>1</p></div><div class="colonna"><p>2</p></div></div>')
ok('tre colonne: contenitore c-3', html([C('a', [{ html: 'a' }, { html: 'b' }, { html: 'c' }])]),
  '<div class="colonne c-3"><div class="colonna">a</div><div class="colonna">b</div><div class="colonna">c</div></div>')
// Una colonna lasciata vuota non è un buco sul sito: non si scrive (l'editor di testo vuoto dà «<p></p>»).
ok('una colonna vuota tra due piene non si scrive: restano due colonne', html([C('a', [{ html: '<p>1</p>' }, { html: '<p></p>' }, { html: '<p>3</p>' }])]),
  '<div class="colonne c-2"><div class="colonna"><p>1</p></div><div class="colonna"><p>3</p></div></div>')
ok('una sola colonna piena è il suo testo, senza contenitore', html([C('a', [{ html: '<p>1</p>' }, { html: '' }])]), '<p>1</p>')
ok('colonne tutte vuote: niente', html([C('a', [{ html: '<p></p>' }, { html: '' }])]), '')
ok('una colonna con solo una foto non è vuota', (r => r.includes('colonne c-2') && r.includes('<img'))(html([C('a', [{ html: '<img src="https://x.it/a.jpg" alt="x">' }, { html: '<p>2</p>' }])])), true)
ok('l\'ordine è quello dell\'array', html([T('a', '<p>Uno</p>'), F('b'), T('c', '<p>Tre</p>')]).replace(/<img[^>]*>/, '|'), '<p>Uno</p>|<p>Tre</p>')
ok('script tolto da un testo', html([T('a', '<p>x</p><script>alert(1)</script>')]), '<p>x</p>')
ok('onclick tolto', (r => buono(r) && !r.includes('onclick'))(html([T('a', '<p onclick="alert(1)">x</p>')])), true)
ok('style tolto', (r => buono(r) && !r.includes('style'))(html([T('a', '<p style="color:red">x</p>')])), true)
ok('classe non ammessa tolta', (r => buono(r) && !r.includes('mia'))(html([T('a', '<p class="mia">x</p>')])), true)
ok('link javascript: tolto', (r => buono(r) && !r.includes('javascript'))(html([T('a', '<a href="javascript:alert(1)">x</a>')])), true)
ok('script tolto anche dentro una colonna', html([C('a', [{ html: '<p>1</p><script>alert(1)</script>' }, { html: '<a href="javascript:x()">2</a>' }])]),
  '<div class="colonne c-2"><div class="colonna"><p>1</p></div><div class="colonna"><a>2</a></div></div>')

console.log('\nTesto: le colonne sono le sole novità')
const COL = '<div class="colonne c-2"><div class="colonna"><p>1</p></div><div class="colonna"><p>2</p></div></div>'
ok('colonne c-2 restano', pulisci(COL), COL)
ok('colonne c-3 restano', pulisci(COL.replace('c-2', 'c-3')), COL.replace('c-2', 'c-3'))
ok('un div senza classe sparisce, il contenuto resta', pulisci('<div><p>x</p></div>'), '<p>x</p>')
ok('un div con altra classe sparisce, il contenuto resta', pulisci('<div class="altro"><p>x</p></div>'), '<p>x</p>')
ok('una classe estranea su colonne si toglie', pulisci('<div class="colonne c-2 brutta"><div class="colonna"><p>1</p></div></div>'),
  '<div class="colonne c-2"><div class="colonna"><p>1</p></div></div>')
ok('i testi di oggi restano identici', pulisci('<h2>T</h2><p>a <strong>b</strong> <a href="/x" class="pulsante">c</a></p><ul><li>d</li></ul>'),
  '<h2>T</h2><p>a <strong>b</strong> <a class="pulsante" href="/x">c</a></p><ul><li>d</li></ul>')

console.log('\nSito: le colonne nella pagina generata')
const dati = (testo) => ({
  dominio: 'https://officinedellosport.it',
  pagine: [
    { slug: 'home', titolo: 'Home', descrizione: 'd', testo: '<p>Home</p>' },
    { slug: 'judo', titolo: 'Judo', descrizione: 'd', testo },
    { slug: 'privacy', titolo: 'Privacy', descrizione: '', testo: '<p>p</p>', diLegge: true },
  ],
  menu: [], rinvii: [],
})
const pagina = (testo) => {
  const r = prova(() => g.generaSito(dati(testo)))
  return (typeof r === 'object' && r ? r['judo/index.html'] : '') ?? ''
}
const main = (h) => h.match(/<main>([\s\S]*)<\/main>/)?.[1] ?? ''
const prima = main(pagina(`<p>Intro</p>${COL}<h2>Titolo</h2><p>Dopo</p>`))
ok('colonne intatte prima di un h2', prima.includes(COL), true)
ok('e nel punto giusto: dopo l\'introduzione, prima del titolo', prima.indexOf('Intro') < prima.indexOf(COL) && prima.indexOf(COL) < prima.indexOf('<h2'), true)
const dopo = main(pagina(`<h2>Titolo</h2><p>Sopra</p>${COL}<p>Sotto</p>`))
ok('colonne intatte dopo un h2', dopo.includes(COL), true)
ok('e nel punto giusto: tra i due paragrafi', dopo.indexOf('Sopra') < dopo.indexOf(COL) && dopo.indexOf(COL) < dopo.indexOf('Sotto'), true)
ok('le colonne nello stesso ordine', prima.indexOf('<p>1</p>') < prima.indexOf('<p>2</p>'), true)
ok('un testo senza colonne non ne ha', (h => h.length > 0 && !h.includes('class="colonne'))(main(pagina('<p>Ciao</p>'))), true)
ok('un testo di oggi esce come sempre', main(pagina('<p>Ciao</p>')).endsWith('<div class="testo"><p>Ciao</p></div>'), true)

const css = pagina(`<p>x</p>${COL}`).match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? ''
const blocco = (x, inizio) => {
  const i = x.indexOf(inizio)
  if (i < 0) return ''
  const a = x.indexOf('{', i)
  for (let k = a, p = 0; k < x.length; k++) {
    if (x[k] === '{') p++
    else if (x[k] === '}' && --p === 0) return x.slice(a + 1, k)
  }
  return ''
}
const media = blocco(css, '@media (max-width:720px)')
const base = css.replace(media, '')
const regola = (x, re) => [...x.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter((m) => re.test(m[1])).map((m) => m[2]).join(';')
ok('le colonne sono una griglia', /display:\s*grid/.test(regola(base, /\.colonne(?![\w-])/)), true)
const nCol = (d) => { const v = /grid-template-columns:\s*([^;]+)/.exec(d)?.[1] ?? ''; const r = /repeat\(\s*(\d+)/.exec(v); return r ? Number(r[1]) : v.trim() ? v.trim().split(/\s+(?![^(]*\))/).length : 0 }
ok('c-2 ha due colonne', nCol(regola(base, /\.c-2/)), 2)
ok('c-3 ha tre colonne', nCol(regola(base, /\.c-3/)), 3)
ok('c\'è una regola @media (max-width:720px) per le colonne', /\.colonne/.test(media), true)
ok('sul telefono sono una colonna sola', /grid-template-columns:\s*(1fr|minmax\(0,\s*1fr\)|repeat\(1,)/.test(regola(media, /\.colonne|\.c-[23]/)), true)
ok('niente scorrimento orizzontale: celle che si restringono', /minmax\(0,|min-width:\s*0|overflow-wrap|overflow-x:\s*hidden/.test(regola(css, /\.colonne|\.colonna/)), true)

console.log('\nModalità prova: le stesse regole di salva_bozza_pezzi_sito')
{
  const P = { content: [T('a', '<p>Ciao</p>'), C('b', [{ html: '<p>1</p>' }, { html: '<p>2</p>' }])] }
  const stato = () => sp.sitoIniziale()
  const r = prova(() => sp.nuovaPagina(stato(), 'Prova', 'prova-pezzi', P))
  const nuova = r.stato ? r.stato.pagine.find((x) => x.id === r.id) : undefined
  ok('una pagina nuova a pezzi porta i pezzi e il testo piatto', [nuova?.pezzi, nuova?.bozza], [P, z.pezziInHtml?.(P)])
  const senza = prova(() => sp.nuovaPagina(stato(), 'Vecchia', 'vecchia'))
  ok('una pagina nuova senza pezzi resta col vecchio editor (pezzi null)', senza.stato ? senza.stato.pagine.find((x) => x.id === senza.id)?.pezzi : senza, null)
  ok('la pagina di oggi ha pezzi null', stato().pagine.every((x) => x.pezzi === null), true)
  ok('pezzi non validi: la pagina nuova non si crea', String(prova(() => sp.nuovaPagina(stato(), 'X', 'x-y', { content: [{ type: 'boh', props: { id: 'a' } }] }))).startsWith('ERRORE'), true)
  const s0 = r.stato
  const salvata = prova(() => sp.salvaBozzaPezzi(s0, r.id, 1, { titolo: 'Prova', descrizione: '', pezzi: { content: [T('a', '<p>Nuovo</p>')] } }))
  const dopo = salvata.stato ? salvata.stato.pagine.find((x) => x.id === r.id) : undefined
  ok('salvare i pezzi: versione +1, testo piatto e pezzi nuovi', [salvata.versione, dopo?.bozza, dopo?.pezzi?.content?.length], [2, '<p>Nuovo</p>', 1])
  ok('versione vecchia: fermata con la frase di oggi', prova(() => sp.salvaBozzaPezzi(s0, r.id, 99, { titolo: 'Prova', descrizione: '', pezzi: P })), 'ERRORE: La pagina è cambiata mentre la modificavi: ricaricala per vedere le modifiche di chi l’ha toccata')
  ok('pezzi non validi: non si salva', String(prova(() => sp.salvaBozzaPezzi(s0, r.id, 1, { titolo: 'Prova', descrizione: '', pezzi: { content: [T('a', 'x'), T('a', 'y')] } }))).startsWith('ERRORE'), true)
  const vecchia = prova(() => sp.salvaBozza(salvata.stato, r.id, 2, { titolo: 'Prova', descrizione: '', bozza: '<p>A mano</p>' }))
  ok('il salvataggio di testo non tocca i pezzi', vecchia.stato ? vecchia.stato.pagine.find((x) => x.id === r.id)?.pezzi?.content?.length : vecchia, 1)
}

{
  // Un dispositivo che aveva già salvato i dati di prova prima dei pezzi: le pagine non hanno il campo, e valgono «vecchio editor», non «database senza il 62».
  const vecchio = sp.sitoIniziale()
  vecchio.pagine.forEach((x) => delete x.pezzi)
  ok('dati di prova salvati prima dei pezzi: ogni pagina ha pezzi null', prova(() => sp.conPezzi(vecchio).pagine.every((x) => x.pezzi === null)), true)
}

console.log('\nCosa non va nei pezzi, a parole')
{
  const cosa = (x) => prova(() => z.cosaNonVaPezzi(x))
  ok('pezzi buoni: niente da dire', cosa({ content: [T('a', '<p>x</p>')] }), null)
  ok('foto senza immagine', /immagine/.test(String(cosa({ content: [{ type: 'foto', props: { id: 'a', src: '', alt: '' } }] }))), true)
  ok('due foto in cima', /foto in cima/.test(String(cosa({ content: [CIMA('a'), CIMA('b')] }))), true)
  ok('foto in cima non in alto', /foto in cima/.test(String(cosa({ content: [T('a', 'x'), CIMA('b')] }))), true)
  ok('più di 100 pezzi: dice il limite', /100/.test(String(cosa({ content: Array.from({ length: 101 }, (_, i) => T('p' + i, 'x')) }))), true)
  ok('troppo lunga: dice di toglierne', /lunga/.test(String(cosa(grosso(3)))), true)
  ok('una colonna sola: dice da due a tre', /colonne/.test(String(cosa({ content: [C('a', [{ html: 'x' }])] }))), true)
  ok('le cause diverse non danno la stessa frase', new Set([cosa({ content: [CIMA('a'), CIMA('b')] }), cosa({ content: Array.from({ length: 101 }, (_, i) => T('p' + i, 'x')) }), cosa(grosso(3))]).size, 3)
  ok('pezzi che non sono pezzi: una frase che dice di ricaricare', /ricarica/.test(String(cosa({ content: [T('a', 'x'), T('a', 'y')] }))), true)
  const c = (a, b) => prova(() => z.pezziCambiati(a, b))
  ok('pezzi uguali a quelli salvati: non cambiati', c({ content: [T('a', 'x')] }, { content: [T('a', 'x')] }), false)
  ok('un testo diverso: cambiati', c({ content: [T('a', 'y')] }, { content: [T('a', 'x')] }), true)
  ok('stessi pezzi in un altro ordine: cambiati', c({ content: [T('a', 'x'), T('b', 'y')] }, { content: [T('b', 'y'), T('a', 'x')] }), true)
  const db = (...v) => prova(() => z.databaseConPezzi(v.map((pezzi) => ({ pezzi }))))
  ok('nessuna pagina: non si sa, vale «senza 62»', db(), false)
  ok('tutte senza il campo: il database non ha il 62', db(undefined, undefined), false)
  ok('pagine col vecchio editor (null): il database ha il 62', db(null, null), true)
  ok('una pagina a pezzi: il database ha il 62', db({ content: [] }, null), true)
}

console.log('\nDatabase senza 62-sito-pezzi.sql: l\'app regge')
{
  const risposta = (r) => ({ ...r, then: (f, ko) => Promise.resolve(r).then(f, ko) })
  const riga = { id: 'p1', slug: 'home', titolo: 'Home', descrizione: '', titolo_pubblicato: null, descrizione_pubblicata: null, bozza: '<p>x</p>', pubblicato: null, nascosta: false, di_legge: false, versione: 1, pubblicata_il: null }
  const errore = async (f) => { try { await f(); return 'nessun errore' } catch (e) { return e.message } }
  const letture = []
  const manca = (codice, messaggio) => sb.creaSegreteriaSupabase({
    auth: { getSession: async () => ({ data: { session: null } }) },
    from: () => ({
      select: (cols) => {
        letture.push(cols)
        const r = cols.includes('bozza_pezzi') ? { data: null, error: { code: '42703', message: 'column sito_pagine.bozza_pezzi does not exist' } } : { data: [riga], error: null }
        return { order: () => risposta(r) }
      },
      insert: () => ({ select: () => ({ single: () => risposta({ data: null, error: { code: codice, message: messaggio } }) }) }),
    }),
    rpc: () => risposta({ data: null, error: { code: codice, message: messaggio } }),
  })
  const FRASE = 'Le pagine a pezzi non sono ancora attive sul database: va lanciato 62-sito-pezzi.sql'
  const s = manca('PGRST202', 'Could not find the function public.salva_bozza_pezzi_sito(p_id) in the schema cache')
  const pagine = await prova(() => s.sitoPagine())
  ok('senza il 62: le pagine si leggono lo stesso, senza il campo pezzi', [Array.isArray(pagine) && pagine.length, Array.isArray(pagine) && pagine.every((x) => x.pezzi === undefined), letture.map((c) => c.includes('bozza_pezzi'))], [1, true, [true, false]])
  ok('senza il 62: salvare i pezzi dice quale file lanciare (funzione assente, PGRST202)', await errore(() => s.salvaBozzaPezziSito('p1', 1, { titolo: 'T', descrizione: '', pezzi: { content: [] } })), FRASE)
  ok('senza il 62: salvare i pezzi, funzione assente (42883)', await errore(() => manca('42883', 'function public.salva_bozza_pezzi_sito does not exist').salvaBozzaPezziSito('p1', 1, { titolo: 'T', descrizione: '', pezzi: { content: [] } })), FRASE)
  ok('senza il 62: creare una pagina a pezzi dice quale file lanciare (colonna assente, PGRST204)', await errore(() => manca('PGRST204', "Could not find the 'bozza_pezzi' column of 'sito_pagine' in the schema cache").nuovaPaginaSito('T', 't-t', { content: [] })), FRASE)
  ok('un limite del database sui pezzi: frase per chi usa l\'app', await errore(() => manca('23514', 'new row for relation "sito_pagine" violates check constraint "sito_pagine_bozza_pezzi_check"').nuovaPaginaSito('T', 't-t', { content: [] })), 'La pagina è troppo lunga: togli qualcosa e riprova')
}

console.log(guai ? `\n${guai} COSE NON TORNANO` : '\nTUTTO A POSTO')
process.exit(guai ? 1 : 0)
