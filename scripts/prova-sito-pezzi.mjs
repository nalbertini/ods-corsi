// ---------------------------------------------------------------------------
// Le pagine del sito a pezzi (PR 1), senza browser.
//
//   node scripts/prova-sito-pezzi.mjs
//
// `src/lib/sitoPezzi.ts`: i pezzi (foto in cima, testo, foto, colonne, iscriviti,
// istruttore) e il loro HTML piatto; un istruttore per parte, nell'ordine delle
// tessere sul sito, con l'avviso per la parte che li spezza e la nota sulla
// sua pagina. `pulisciTesto` ammette le colonne; `generaSito` le lascia intatte
// e il CSS le affianca (le impila sul telefono). Il sito resta statico.
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
const sa = await carica('src/lib/sitoPagine.ts')

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

// Il «+» sotto «Colonna 2» nell'editor aggiunge una colonna: nasce senza html se nessuno glielo dà, e l'editor andava in schermo bianco.
console.log('\nColonne: la colonna aggiunta')
ok('la colonna nuova è un html vuoto', prova(() => z.colonnaNuova()), { html: '' })
ok('una colonna senza html conta come vuota', prova(() => z.vuoto(undefined)), true)
ok('due colonne più una nuova sono valide', valido({ content: [C('a', [{ html: '<p>1</p>' }, { html: '<p>2</p>' }, z.colonnaNuova()])] }), true)

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
// Dentro .testo e .sezione il margine laterale c'è già: le colonne non lo raddoppiano e non ereditano il 62ch di .colonna.
ok('le colonne non raddoppiano il margine né il 62ch', (r => [/padding:\s*0\s+0\s+24px/.test(regola(css, /\.colonne\s*$/)), /max-width:\s*none/.test(r), /padding:\s*0(;|$)/.test(r)])(regola(css, /\.colonne>\.colonna/)), [true, true, true])
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
  // Judo è l'unica pagina di prova già a pezzi: un solo TESTO lungo, per provare «Dividi in parti».
  ok('le pagine di oggi hanno pezzi null, tranne Judo', stato().pagine.filter((x) => x.slug !== 'judo').every((x) => x.pezzi === null), true)
  ok('Judo è a pezzi con un solo testo', stato().pagine.find((x) => x.slug === 'judo')?.pezzi?.content.map((c) => c.type), ['testo'])
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
  // Il database (jsonb) rimette le chiavi in un altro ordine: leggere i pezzi appena salvati non è una modifica.
  ok('stesse chiavi in un altro ordine (jsonb): non cambiati', c({ content: [{ type: 'foto', props: { id: 'a', src: 'https://x.it/a.jpg', alt: 'x' } }] }, { content: [{ type: 'foto', props: { id: 'a', alt: 'x', src: 'https://x.it/a.jpg' } }] }), false)
  ok('niente salvato (null): cambiati', c({ content: [T('a', 'x')] }, null), true)
  ok('niente salvato (undefined): cambiati', c({ content: [T('a', 'x')] }, undefined), true)
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

console.log('\nPorta ai pezzi: le funzioni ci sono')
ok('htmlInPezzi è una funzione di sitoPezzi', typeof z.htmlInPezzi, 'function')
ok('portabileAiPezzi è una funzione di sitoPezzi', typeof z.portabileAiPezzi, 'function')

console.log('\nPorta ai pezzi: htmlInPezzi')
{
  const pezzi = (x) => prova(() => z.htmlInPezzi(x))
  // Solo tipo e contenuto: gli id sono a scelta di chi divide, purché unici (si prova a parte).
  const forma = (r) => (r && Array.isArray(r.content) ? r.content.map((p) => [p.type, p.props.html ?? p.props.colonne?.map((c) => c.html) ?? [p.props.src, p.props.alt]]) : r)
  const uno = (x) => (pulisci(x) === '' ? [] : [['testo', pulisci(x)]])
  const giro = (x) => prova(() => z.pezziInHtml(z.htmlInPezzi(x)))
  const FOTO = '<img src="https://x.it/a.jpg" alt="Il tatami">'
  const col = (n, ...c) => `<div class="colonne c-${n}">${c.map((h) => `<div class="colonna">${h}</div>`).join('')}</div>`

  ok('testo vuoto: nessun pezzo', pezzi(''), { content: [] })
  ok('solo spazi: nessun pezzo', pezzi('  \n '), { content: [] })
  ok('un paragrafo: un pezzo testo', forma(pezzi('<p>Ciao</p>')), [['testo', '<p>Ciao</p>']])
  ok('foto iniziale, titolo e paragrafo: foto in cima poi un testo', forma(pezzi(`${FOTO}<h2>Titolo</h2><p>Ciao</p>`)), [['fotoInCima', ['https://x.it/a.jpg', 'Il tatami']], ['testo', '<h2>Titolo</h2><p>Ciao</p>']])
  ok('solo la foto iniziale: un solo pezzo', forma(pezzi(FOTO)), [['fotoInCima', ['https://x.it/a.jpg', 'Il tatami']]])
  ok('colonne in mezzo al testo: testo, colonne, testo (in ordine)', forma(pezzi(`<p>Prima</p>${col(2, '<p>A</p>', '<p>B</p>')}<p>Dopo</p>`)), [['testo', '<p>Prima</p>'], ['colonne', ['<p>A</p>', '<p>B</p>']], ['testo', '<p>Dopo</p>']])
  ok('tre colonne: un pezzo colonne con tre html', forma(pezzi(col(3, '<p>A</p>', '<p>B</p>', '<p>C</p>'))), [['colonne', ['<p>A</p>', '<p>B</p>', '<p>C</p>']]])
  ok('foto, testo, colonne, testo: tutto in ordine', prova(() => forma(pezzi(`${FOTO}<p>1</p>${col(2, '<p>A</p>', '<p>B</p>')}<p>2</p>`)).map((p) => p[0])), ['fotoInCima', 'testo', 'colonne', 'testo'])
  const molti = pezzi(`${FOTO}<p>1</p>${col(2, '<p>A</p>', '<p>B</p>')}<p>2</p>${col(3, '<p>A</p>', '<p>B</p>', '<p>C</p>')}`)
  ok('id unici e non vuoti', prova(() => { const id = molti.content.map((p) => p.props.id); return new Set(id).size === id.length && id.every((i) => typeof i === 'string' && i !== '') }), true)
  ok('il risultato con più pezzi passa pezziValidi', valido(molti), true)

  // Il div chiuso in più lo toglie già la pulizia: il testo che resta è in ordine e si divide. Una foto in una colonna
  // sta nell'editor di testo della colonna (IMMAGINE c'è anche lì): niente si perde.
  ok('un div chiuso in più (tolto dalla pulizia): colonne e testo', forma(pezzi(`${col(2, '<p>A</p>', '<p>B</p>')}</div><p>Dopo</p>`)), [['colonne', ['<p>A</p>', '<p>B</p>']], ['testo', '<p>Dopo</p>']])
  ok('una foto dentro una colonna: resta nella colonna', forma(pezzi(col(2, `<p>A</p>${FOTO}`, '<p>B</p>'))).map((p) => p[0]), ['colonne'])
  ok('una foto dentro una colonna: il giro rida il testo', giro(col(2, `<p>A</p>${FOTO}`, '<p>B</p>')), pulisci(col(2, `<p>A</p>${FOTO}`, '<p>B</p>')))

  console.log('\nPorta ai pezzi: se non regge il giro, un solo pezzo testo')
  const colonne2 = col(2, '<p>A</p>', '<p>B</p>')
  const fuori = [
    ['una colonna vuota', col(2, '<p>A</p>', '<p></p>')],
    ['una colonna senza niente dentro', col(2, '<p>A</p>', '')],
    ['una colonna sola', col(2, '<p>A</p>').replace('c-2', 'c-1')],
    ['c-3 con due colonne', col(3, '<p>A</p>', '<p>B</p>')],
    ['c-2 con tre colonne', col(2, '<p>A</p>', '<p>B</p>', '<p>C</p>')],
    ['quattro colonne', col(3, '<p>A</p>', '<p>B</p>', '<p>C</p>', '<p>D</p>').replace('c-3', 'c-4')],
    ['un’immagine senza alt', '<img src="https://x.it/a.jpg"><p>Ciao</p>'],
    ['un’immagine senza src', '<img alt="Niente"><p>Ciao</p>'],
    ['un’immagine con src vuoto', '<img src="" alt="Niente"><p>Ciao</p>'],
    ['div sbilanciati (uno in più aperto)', `<div class="colonne c-2"><div class="colonna"><p>A</p></div><div class="colonna"><p>B</p></div><p>Dopo</p>`],
    ['colonne annidate', col(2, col(2, '<p>A</p>', '<p>B</p>'), '<p>C</p>')],
    ['un’immagine dentro un paragrafo', `<p>Guarda ${FOTO} qui</p>`],
    ['colonne con altro dentro il contenitore', `<div class="colonne c-2"><p>Fuori</p><div class="colonna"><p>A</p></div><div class="colonna"><p>B</p></div></div>`],
  ]
  for (const [cosa, x] of fuori) {
    ok(`${cosa}: un solo pezzo testo, mai spezzata male`, forma(pezzi(x)), uno(x))
    ok(`${cosa}: il giro rida il testo ripulito`, giro(x), pulisci(x))
    ok(`${cosa}: i pezzi sono validi`, valido(pezzi(x)), true)
  }

  console.log('\nPorta ai pezzi: il giro regge per ogni testo')
  const iniziali = prova(() => sp.sitoIniziale().pagine.flatMap((p) => [p.bozza, p.pubblicato ?? '']))
  const insieme = [
    ...(Array.isArray(iniziali) ? iniziali : []),
    `${FOTO}<h2>Titolo</h2><p>Ciao</p>`,
    `<p>Prima</p>${colonne2}<p>Dopo</p>`,
    col(3, '<p>A</p>', '<p>B</p>', '<p>C</p>'),
    `${FOTO}${colonne2}`,
    '<h2>Solo titolo</h2>',
    '<p>Con <strong>grassetto</strong> e <a href="/corsi" class="pulsante">un pulsante</a></p>',
    '<script>x()</script><p>Pulito</p>',
    '',
    ...fuori.map(([, x]) => x),
  ]
  ok('i testi di prova sono quelli di sitoIniziale (almeno sei pagine)', Array.isArray(iniziali) && iniziali.length >= 6, true)
  for (const x of insieme) {
    ok(`giro: ${JSON.stringify(x).slice(0, 70)}`, [giro(x), valido(pezzi(x))], [pulisci(x), true])
  }

  console.log('\nPorta ai pezzi: testo troppo grande')
  // ponytail: il testo cresce fino al limite dei pezzi (400000) mentre quello della bozza è 200000:
  // un testo ammesso può dare pezzi che il database non prende. htmlInPezzi non può evitarlo (il testo è uno solo),
  // quindi il risultato non è valido e chi chiama lo sa da cosaNonVaPezzi.
  const grande = `<p>${'a'.repeat(z.MASSIMO_CARATTERI ?? 400000)}</p>`
  const gr = pezzi(grande)
  ok('troppo grande: i pezzi non sono validi', valido(gr), false)
  ok('troppo grande: cosaNonVaPezzi dice di toglierne', /lunga/.test(String(prova(() => z.cosaNonVaPezzi(gr)))), true)
  ok('troppo grande: il testo resta tutto (niente tagli)', forma(gr), uno(grande))
}

console.log('\nPorta ai pezzi: si taglia ai titoli h2 e alle foto isolate')
{
  const pezzi = (x) => prova(() => z.htmlInPezzi(x))
  const forma = (r) => (r && Array.isArray(r.content) ? r.content.map((p) => [p.type, p.props.html ?? p.props.colonne?.map((c) => c.html) ?? [p.props.src, p.props.alt]]) : r)
  const tipi = (x) => { const f = forma(pezzi(x)); return Array.isArray(f) ? f.map((p) => p[0]) : f }
  const giro = (x) => prova(() => z.pezziInHtml(z.htmlInPezzi(x)))
  const col = (n, ...c) => `<div class="colonne c-${n}">${c.map((h) => `<div class="colonna">${h}</div>`).join('')}</div>`
  // Sempre vero, per ogni testo: il giro rida il testo, i pezzi sono validi, gli id unici, la foto in cima solo prima.
  const regge = (cosa, x) => {
    const r = pezzi(x)
    const c = Array.isArray(r?.content) ? r.content : []
    const id = c.map((p) => p.props.id)
    ok(`${cosa}: il giro rida il testo ripulito`, giro(x), pulisci(x))
    ok(`${cosa}: pezzi validi, id unici, foto in cima solo in testa`, [valido(r), new Set(id).size === id.length, c.every((p, i) => p.type !== 'fotoInCima' || i === 0)], [true, true, true])
  }

  const AIKIDO = '<p><a class="pulsante" href="https://x/">Prova</a> <a class="pulsante" href="/c/">Scrivici</a></p><img alt="Quattro" src="https://x/a.jpg" /><ul><li><strong>Per chi</strong> Dai 7 anni</li></ul><h2>Orario</h2><h3>Aikido 2</h3><p><strong>17:00</strong></p><h2></h2><h3>Cosa si fa</h3><p>Testo</p><img alt="Una" src="https://x/b.jpg" /><h2>Cosa aspettarsi</h2><p>x</p><p><a class="pulsante" href="/c/">Scrivici</a></p><img alt="Un adulto" src="https://x/c.jpg" /><p></p>'
  const ai = forma(pezzi(AIKIDO))
  ok('Aikido: testo, foto, testo, testo (h2), foto, testo (h2), foto, e in fondo il p vuoto', Array.isArray(ai) ? ai.map((p) => p[0]) : ai, ['testo', 'foto', 'testo', 'testo', 'foto', 'testo', 'foto', 'testo'])
  ok('Aikido: le tre foto con il loro alt', Array.isArray(ai) ? ai.filter((p) => p[0] === 'foto').map((p) => p[1]) : ai, [['https://x/a.jpg', 'Quattro'], ['https://x/b.jpg', 'Una'], ['https://x/c.jpg', 'Un adulto']])
  ok('Aikido: i testi cominciano com\'è giusto (ul, h2 Orario, h2 Cosa aspettarsi)', Array.isArray(ai) ? ai.filter((p) => p[0] === 'testo').map((p) => p[1].slice(0, 7)) : ai, ['<p><a c', '<ul><li', '<h2>Ora', '<h2>Cos', '<p></p>'])
  // Il p vuoto in fondo viene dopo una foto: non ha un testo vicino, quindi resta da solo (cambiarlo cambierebbe il testo).
  ok('Aikido: l\'h2 vuoto resta nel testo vicino; solo il p finale, senza testo vicino, sta da solo', Array.isArray(ai) ? ai.filter((p) => p[0] === 'testo' && z.vuoto(p[1])).map((p) => p[1]) : ai, ['<p></p>'])
  ok('Aikido: l\'h2 vuoto sta nel testo di Orario, prima della foto Una', Array.isArray(ai) ? /<h2><\/h2>/.test(ai[3]?.[1] ?? '') : ai, true)
  regge('Aikido', AIKIDO)

  // 2. Più titoli h2: un testo per titolo, ognuno comincia dal suo h2.
  const dueH2 = forma(pezzi('<p>a</p><h2>X</h2><p>b</p><h2>Y</h2><p>c</p>'))
  ok('h2: tre testi', Array.isArray(dueH2) ? dueH2.map((p) => p[0]) : dueH2, ['testo', 'testo', 'testo'])
  ok('h2: il secondo e il terzo cominciano con l\'h2', Array.isArray(dueH2) ? dueH2.map((p) => p[1].startsWith('<h2>')) : dueH2, [false, true, true])
  ok('h2: il testo è diviso nei tre pezzi giusti', dueH2, [['testo', '<p>a</p>'], ['testo', '<h2>X</h2><p>b</p>'], ['testo', '<h2>Y</h2><p>c</p>']])
  regge('h2', '<p>a</p><h2>X</h2><p>b</p><h2>Y</h2><p>c</p>')
  ok('h3: non si taglia', tipi('<p>a</p><h3>X</h3><p>b</p>'), ['testo'])
  ok('un h2 in testa non fa un pezzo vuoto prima', tipi('<h2>X</h2><p>b</p><h2>Y</h2><p>c</p>'), ['testo', 'testo'])

  // 3 e 4. La foto isolata prende solo sé stessa.
  ok('foto isolata in mezzo: testo, foto, testo', forma(pezzi('<p>a</p><img src="https://x.it/s.jpg" alt="d" /><p>b</p>')), [['testo', '<p>a</p>'], ['foto', ['https://x.it/s.jpg', 'd']], ['testo', '<p>b</p>']])
  regge('foto in mezzo', '<p>a</p><img src="https://x.it/s.jpg" alt="d" /><p>b</p>')
  ok('foto isolata con alt vuoto: foto con alt vuoto', forma(pezzi('<p>a</p><img src="https://x.it/s.jpg" alt="" />')), [['testo', '<p>a</p>'], ['foto', ['https://x.it/s.jpg', '']]])
  ok('due foto di fila: due foto', tipi('<p>a</p><img src="https://x.it/s.jpg" alt="d" /><img src="https://x.it/t.jpg" alt="e" /><p>b</p>'), ['testo', 'foto', 'foto', 'testo'])
  regge('due foto di fila', '<p>a</p><img src="https://x.it/s.jpg" alt="d" /><img src="https://x.it/t.jpg" alt="e" /><p>b</p>')
  ok('foto isolata dopo un h2: l\'h2 resta col suo testo, la foto è sua', forma(pezzi('<h2>X</h2><img src="https://x.it/s.jpg" alt="d" /><p>b</p>')), [['testo', '<h2>X</h2>'], ['foto', ['https://x.it/s.jpg', 'd']], ['testo', '<p>b</p>']])

  // 5. Le foto che non si possono dire «foto» restano nel testo.
  const restano = [
    ['senza alt', '<p>a</p><img src="https://x.it/s.jpg" /><p>b</p>'],
    ['dentro un paragrafo', '<p>a</p><p><img src="https://x.it/s.jpg" alt="d" /></p><p>b</p>'],
    ['dentro un link', '<p>a</p><a href="/c/"><img src="https://x.it/s.jpg" alt="d" /></a><p>b</p>'],
  ]
  for (const [cosa, x] of restano) {
    ok(`foto ${cosa}: resta nel testo`, tipi(x), ['testo'])
    regge(`foto ${cosa}`, x)
  }

  // 6. Dentro un elenco o una colonna non si taglia.
  ok('h2 dentro un elenco: nessun taglio', tipi('<p>a</p><ul><li><h2>X</h2></li></ul><p>b</p>'), ['testo'])
  ok('foto dentro un elenco: nessun taglio', tipi('<p>a</p><ul><li><img src="https://x.it/s.jpg" alt="d" /></li></ul><p>b</p>'), ['testo'])
  ok('h2 e foto dentro una colonna: la colonna resta una', tipi(col(2, '<h2>X</h2><p>a</p><img src="https://x.it/s.jpg" alt="d" />', '<p>B</p>')), ['colonne'])
  ok('h2 e foto dentro una colonna: i due html restano interi', forma(pezzi(col(2, '<h2>X</h2><p>a</p><img src="https://x.it/s.jpg" alt="d" />', '<p>B</p>')))?.[0]?.[1]?.length, 2)
  regge('h2 in colonna', col(2, '<h2>X</h2><p>a</p><img src="https://x.it/s.jpg" alt="d" />', '<p>B</p>'))
  ok('titoli e foto fuori dalle colonne si tagliano, quelli dentro no', tipi(`<h2>X</h2><p>a</p>${col(2, '<h2>Y</h2><p>b</p>', '<p>C</p>')}<h2>Z</h2><p>d</p>`), ['testo', 'colonne', 'testo'])

  // 7. I vuoti non fanno pezzi da soli.
  ok('h2 vuoto: nessun pezzo fatto solo di lui', tipi('<p>a</p><h2></h2><p>b</p>'), ['testo'])
  ok('p vuoto finale: nessun pezzo fatto solo di lui', tipi('<p>a</p><h2>X</h2><p>b</p><p></p>'), ['testo', 'testo'])
  ok('p vuoto dopo una foto finale: senza testo vicino resta da solo, il testo non cambia', tipi('<p>a</p><img src="https://x.it/s.jpg" alt="d" /><p></p>'), ['testo', 'foto', 'testo'])
  regge('p vuoto dopo una foto finale', '<p>a</p><img src="https://x.it/s.jpg" alt="d" /><p></p>')
  // Un <p></p> senza testo prima si unisce al testo dopo: due pezzi, non tre.
  ok('p vuoto dopo la foto in cima: si unisce al testo che segue', forma(pezzi('<img src="https://x.it/s.jpg" alt="d" /><p></p><h2>T</h2><p>x</p>')).map((p) => p[0]), ['fotoInCima', 'testo'])
  // La pulizia toglie class e width: la foto che resta è uguale a quella dei pezzi, e si taglia.
  ok('foto con class o width: la pulizia le toglie, quindi è una foto', tipi('<p>a</p><img class="g" src="https://x.it/s.jpg" alt="d" width="300" /><p>b</p>'), ['testo', 'foto', 'testo'])
  regge('h2 vuoto', '<p>a</p><h2></h2><p>b</p>')
  regge('p vuoto finale', '<p>a</p><h2>X</h2><p>b</p><p></p>')

  // 9. La foto in cima resta fotoInCima; le colonne annidate un pezzo solo.
  ok('foto in cima: fotoInCima, poi i testi per titolo', tipi('<img src="https://x.it/s.jpg" alt="d" /><h2>X</h2><p>a</p><h2>Y</h2><p>b</p>'), ['fotoInCima', 'testo', 'testo'])
  ok('foto in cima e foto isolata dopo: fotoInCima e foto', tipi('<img src="https://x.it/s.jpg" alt="d" /><p>a</p><img src="https://x.it/t.jpg" alt="e" />'), ['fotoInCima', 'testo', 'foto'])
  regge('foto in cima e dopo', '<img src="https://x.it/s.jpg" alt="d" /><p>a</p><img src="https://x.it/t.jpg" alt="e" />')
  const annidate = col(2, col(2, '<p>A</p>', '<p>B</p>'), '<p>C</p>')
  ok('colonne annidate con h2 e foto fuori: un pezzo solo', tipi(`<h2>X</h2><p>a</p><img src="https://x.it/s.jpg" alt="d" />${annidate}`), ['testo'])

  // 8. Oltre cento pezzi: l'avviso che c'è, e il testo resta identico.
  const cento = Array.from({ length: 101 }, (_, i) => `<h2>T${i}</h2><p>x</p>`).join('')
  const troppi = pezzi(cento)
  ok('oltre 100 pezzi: i pezzi non sono validi, niente accorpamento', valido(troppi), false)
  ok('oltre 100 pezzi: il testo resta tutto identico', giro(cento), pulisci(cento))
  ok('oltre 100 pezzi: cosaNonVaPortare avvisa della pagina con troppe parti', prova(() => z.cosaNonVaPortare(cento)), 'La pagina ha troppe parti: al massimo 100')
  ok('esattamente 100 pezzi: si porta', prova(() => z.cosaNonVaPortare(Array.from({ length: 100 }, (_, i) => `<h2>T${i}</h2><p>x</p>`).join(''))), null)
}

console.log('\nPorta ai pezzi: cosaNonVaPortare (prima di chiedere conferma)')
{
  const no = (x) => prova(() => z.cosaNonVaPortare(x))
  ok('un testo normale si porta', no('<p>Ciao</p>'), null)
  ok('il testo vuoto si porta', no(''), null)
  // Un limite per volta (insieme, ciascun controllo coprirebbe l'altro): solo quello della bozza, e solo quello dei pezzi.
  ok('sopra i 200000 della bozza ma sotto i 400000 dei pezzi: la frase sul testo lungo', /Il testo è troppo lungo/.test(String(no(`<p>${'a'.repeat(300000)}</p>`))), true)
  const virgolette = `<p>${'"'.repeat(199990)}</p>`
  ok('sotto i 200000 della bozza ma con il JSON oltre i 400000 dei pezzi: la frase sulla pagina lunga', [pulisci(virgolette).length < 200000, /La pagina è troppo lunga/.test(String(no(virgolette)))], [true, true])
  ok('troppo grande per i pezzi: una frase che dice di toglierne, non di ricaricare', [/lung/.test(String(no(`<p>${'a'.repeat(400000)}</p>`))), /ricarica/.test(String(no(`<p>${'a'.repeat(400000)}</p>`)))], [true, false])
  ok('testo che dopo la pulizia supera il limite della bozza (& diventa &amp;): una frase sul testo lungo', /lung/.test(String(no(`<p>${'&'.repeat(190000)}</p>`))), true)
}

console.log('\nPorta ai pezzi: portabileAiPezzi')
{
  const p = (o) => prova(() => z.portabileAiPezzi(o))
  ok('vecchio editor (null), non di legge: si può portare', p({ pezzi: null, diLegge: false }), true)
  ok('database senza il 62 (undefined): no', p({ pezzi: undefined, diLegge: false }), false)
  ok('campo assente: no', p({ diLegge: false }), false)
  ok('già a pezzi: no', p({ pezzi: { content: [] }, diLegge: false }), false)
  ok('già a pezzi con contenuto: no', p({ pezzi: { content: [T('a', 'x')] }, diLegge: false }), false)
  ok('pagina di legge con pezzi null: no', p({ pezzi: null, diLegge: true }), false)
  ok('pagina di legge senza il 62: no', p({ pezzi: undefined, diLegge: true }), false)
}

console.log('\nPorta ai pezzi: in modalità prova la pagina converte senza cambiare nulla')
{
  const s0 = sp.conPezzi(sp.sitoIniziale())
  const pagina = (s, slug) => s.pagine.find((x) => x.slug === slug)
  const conv = (slug, versione) => prova(() => {
    const v = pagina(s0, slug)
    return sp.salvaBozzaPezzi(s0, v.id, versione ?? v.versione, { titolo: v.titolo, descrizione: v.descrizione, pezzi: z.htmlInPezzi(v.bozza) })
  })
  const prima = pagina(s0, 'pre-pugilistica')
  const dopo = prova(() => pagina(conv('pre-pugilistica').stato, 'pre-pugilistica'))
  ok('prima: «Pre pugilistica» è modificata e col vecchio editor', [prova(() => sa.statoPagina(prima)), prima.pezzi], ['modificata', null])
  ok('Pre pugilistica: la bozza resta identica', dopo.bozza, prima.bozza)
  ok('Pre pugilistica: il pubblicato resta identico', [dopo.pubblicato, dopo.titoloPubblicato, dopo.descrizionePubblicata, dopo.pubblicataIl], [prima.pubblicato, prima.titoloPubblicato, prima.descrizionePubblicata, prima.pubblicataIl])
  ok('Pre pugilistica: titolo e descrizione restano', [dopo.titolo, dopo.descrizione], [prima.titolo, prima.descrizione])
  ok('Pre pugilistica: la versione sale di uno', dopo.versione, prima.versione + 1)
  ok('Pre pugilistica: ora ha pezzi validi', valido(dopo.pezzi), true)
  ok('Pre pugilistica: dai pezzi esce la stessa bozza', prova(() => z.pezziInHtml(dopo.pezzi)), prima.bozza)
  ok('Pre pugilistica: resta «modificata» (niente di nuovo da pubblicare)', prova(() => sa.statoPagina(dopo)), 'modificata')
  const home = prova(() => pagina(conv('home').stato, 'home'))
  ok('Home: resta «pubblicata»', [prova(() => sa.statoPagina(pagina(s0, 'home'))), prova(() => sa.statoPagina(home))], ['pubblicata', 'pubblicata'])
  ok('Home: ora ha pezzi validi', valido(home.pezzi), true)
  ok('versione vecchia: fermata con la frase di oggi', conv('pre-pugilistica', 99), 'ERRORE: La pagina è cambiata mentre la modificavi: ricaricala per vedere le modifiche di chi l’ha toccata')
  ok('versione vecchia: i pezzi restano null (lo stato di prima non cambia)', pagina(s0, 'pre-pugilistica').pezzi, null)
}

// Il pannello a destra, finché nessuna parte è scelta: dice cosa fare, con le parole della segreteria (parte, non blocco).
{
  const f = z.FRASE_NESSUNA_PARTE
  ok('nessuna parte scelta: il pannello dice di toccarne una', typeof f === 'string' && /^Tocca una parte della pagina/.test(f), true)
  ok('nessuna parte scelta: la frase dice cosa succede, in italiano di palestra', typeof f === 'string' && /impostazioni/.test(f) && !/blocc|component|elemento/i.test(f), true)
}

// ELENCO: ogni parte col nome che la segreteria le dà (FOTO IN CIMA, TESTO, FOTO, DUE o TRE COLONNE).
{
  const col = (n) => ({ type: 'colonne', props: { id: 'c', colonne: Array.from({ length: n }, () => ({ html: '' })) } })
  const nome = (p) => prova(() => z.nomeParte(p))
  ok('elenco: foto in cima', nome({ type: 'fotoInCima', props: { id: 'a', src: '', alt: '' } }), 'Foto in cima')
  ok('elenco: testo', nome({ type: 'testo', props: { id: 'b', html: '' } }), 'Testo')
  ok('elenco: foto', nome({ type: 'foto', props: { id: 'd', src: '', alt: '' } }), 'Foto')
  ok('elenco: due colonne', nome(col(2)), 'Due colonne')
  ok('elenco: tre colonne', nome(col(3)), 'Tre colonne')
}

// SCRIVERE NELLA PAGINA: il testo e le colonne si scrivono nel pezzo, senza toccare il resto.
console.log('\nScrivere il testo nella pagina')
{
  const scrivi = (p, h, c) => prova(() => (c === undefined ? z.scriviTesto(p, h) : z.scriviTesto(p, h, c)))
  const copia = (x) => JSON.parse(JSON.stringify(x))

  const t0 = T('t1', '<p>vecchio</p>')
  const t1 = scrivi(t0, '<p>nuovo</p>')
  ok('testo: l’html è quello scritto', t1?.props?.html, '<p>nuovo</p>')
  ok('testo: restano id e tipo', [t1?.props?.id, t1?.type], ['t1', 'testo'])

  for (const n of [2, 3]) {
    const cols = Array.from({ length: n }, (_, i) => ({ html: `<p>${i}</p>` }))
    const c0 = C('c1', cols)
    const c1 = scrivi(c0, '<p>scritta</p>', 1)
    const voluto = cols.map((c, i) => (i === 1 ? { html: '<p>scritta</p>' } : c))
    ok(`${n} colonne: cambia solo la seconda`, c1?.props?.colonne, voluto)
    ok(`${n} colonne: restano id, tipo e numero di colonne`, [c1?.props?.id, c1?.type, c1?.props?.colonne?.length], ['c1', 'colonne', n])
  }
  ok('colonne: senza indicarla si scrive la prima', scrivi(C('c1', [{ html: 'a' }, { html: 'b' }]), 'x')?.props?.colonne, [{ html: 'x' }, { html: 'b' }])

  for (const [cosa, p, h, c] of [
    ['testo', T('t1', '<p>a</p>'), '<p>b</p>'],
    ['colonne', C('c1', [{ html: 'a' }, { html: 'b' }, { html: 'c' }]), '<p>x</p>', 2],
  ]) {
    const prima = copia(p)
    scrivi(p, h, c)
    ok(`${cosa}: l’oggetto ricevuto non cambia`, p, prima)
  }

  const f = F('f1'), cima = CIMA('k1')
  ok('foto: restituisce lo stesso oggetto', scrivi(f, '<p>x</p>') === f, true)
  ok('foto in cima: restituisce lo stesso oggetto', scrivi(cima, '<p>x</p>') === cima, true)
  ok('foto: l’oggetto ricevuto non cambia', f, F('f1'))
  const c2 = C('c2', [{ html: 'a' }, { html: 'b' }])
  ok('colonne: colonna -1 restituisce lo stesso oggetto', scrivi(c2, 'x', -1) === c2, true)
  ok('colonne: colonna oltre il numero restituisce lo stesso oggetto', scrivi(c2, 'x', 2) === c2, true)
  ok('colonne: nessuna colonna cambia se fuori misura', c2, C('c2', [{ html: 'a' }, { html: 'b' }]))

  const sporco = '<p>ciao</p><script>alert(1)</script>'
  const pagina = { content: [scrivi(T('t1', ''), sporco), scrivi(C('c1', [{ html: '' }, { html: '' }]), sporco, 1)] }
  ok('scritto: la pagina resta valida', valido(pagina), true)
  const uscito = html(pagina.content)
  ok('scritto: nell’html finale c’è il testo', buono(uscito) && uscito.includes('ciao'), true)
  ok('scritto: un <script> non esce', buono(uscito) && !/script|alert/i.test(uscito), true)
}

// Il testo scritto arriva subito a chi salva: la pagina con quel pezzo cambiato, senza aspettare Puck.
{
  const pagina = { content: [T('a', '<p>uno</p>'), C('b', [{ html: '<p>x</p>' }, { html: '<p>y</p>' }]), F('c')] }
  const copia = JSON.stringify(pagina)
  const r = prova(() => z.conTestoScritto(pagina, 'b', '<p>nuovo</p>', 1))
  ok('pagina: cambia solo la colonna scritta del pezzo giusto', r?.content?.map((p) => JSON.stringify(p.props)), [JSON.stringify({ id: 'a', html: '<p>uno</p>' }), JSON.stringify({ id: 'b', colonne: [{ html: '<p>x</p>' }, { html: '<p>nuovo</p>' }] }), JSON.stringify({ id: 'c', src: 'https://x.it/a.jpg', alt: 'Un tatami' })])
  ok('pagina: il testo scritto va nel pezzo testo', prova(() => z.conTestoScritto(pagina, 'a', '<p>due</p>').content[0].props.html), '<p>due</p>')
  ok('pagina: la pagina ricevuta non cambia', JSON.stringify(pagina), copia)
  ok('pagina: un pezzo che non c\'è lascia la pagina com\'è', prova(() => z.conTestoScritto(pagina, 'zzz', 'x') === pagina), true)
  ok('pagina: resta valida', valido(r), true)
}

// ANNULLA e RIFAI dalla tastiera dentro il testo: Cmd/Ctrl+Z indietro, Cmd/Ctrl+Maiusc+Z o Cmd/Ctrl+Y avanti; il resto è del testo.
{
  const v = (tasto, meta = true, maiusc = false, alt = false) => prova(() => z.versoStoria(tasto, meta, maiusc, alt))
  ok('tastiera: Cmd+Z va indietro', v('z'), 'indietro')
  ok('tastiera: Cmd+Z maiuscola (CapsLock) va indietro', v('Z'), 'indietro')
  ok('tastiera: Cmd+Maiusc+Z va avanti', v('z', true, true), 'avanti')
  ok('tastiera: Cmd+Y va avanti', v('y'), 'avanti')
  ok('tastiera: Z senza Cmd è una lettera', v('z', false), null)
  ok('tastiera: Alt+Cmd+Z non è nostra', v('z', true, false, true), null)
  ok('tastiera: Cmd+B non è nostra', v('b'), null)
}
// Dopo ANNULLA e RIFAI la parte scelta resta scelta, se c'è ancora.
{
  const sel = (s, n) => prova(() => z.selezioneDopoStoria(s, n))
  ok('storia: la parte scelta resta', sel({ index: 1, zone: 'z' }, 3), { index: 1, zone: 'z' })
  ok('storia: se la lista si è accorciata sotto di lei, nessuna', sel({ index: 3, zone: 'z' }, 3), null)
  ok('storia: nessuna scelta, nessuna scelta', sel(null, 3), null)
}

// Puck registra un passo nella storia 250ms dopo l'ultima scrittura: annullare prima toglierebbe il passo di prima.
{
  const a = (ultima, ora) => prova(() => z.attesaStoria(ultima, ora))
  ok('storia: appena scritto, si aspetta quasi tutta la finestra', a(1000, 1010), 290)
  ok('storia: a metà finestra si aspetta il resto', a(1000, 1150), 150)
  ok('storia: passata la finestra non si aspetta', a(1000, 1400), 0)
  ok('storia: mai scritto, non si aspetta', a(0, 5000), 0)
}

console.log('\nDividi in parti: una pagina già a pezzi con un solo testo lungo')
{
  const dividi = (p) => prova(() => z.dividiInParti(p))
  const divisibile = (p) => prova(() => z.divisibileInParti(p))
  const forma = (r) => (r && Array.isArray(r.content) ? r.content.map((p) => [p.type, p.props.html ?? p.props.colonne?.map((c) => c.html) ?? [p.props.src, p.props.alt]]) : r)
  const id = (r) => (r && Array.isArray(r.content) ? r.content.map((p) => p.props.id) : r)
  const unici = (r) => prova(() => { const i = id(r); return new Set(i).size === i.length && i.every((x) => typeof x === 'string' && x !== '') })
  const IMG = (n) => `<img alt="${n}" src="https://x.it/${n}.jpg" />`
  const COL = '<div class="colonne c-2"><div class="colonna"><p>A</p></div><div class="colonna"><p>B</p></div></div>'
  const lungo = `<p>a</p><h2>T</h2><p>b</p>${IMG('d')}<p>c</p>`
  const pagina = (...content) => ({ content })
  // Le tre cose che valgono sempre: lo stesso testo del sito, pagina valida, id unici.
  const regge = (cosa, p) => {
    const d = dividi(p)
    ok(`${cosa}: il testo del sito è lo stesso`, prova(() => z.pezziInHtml(d) === z.pezziInHtml(p)), true)
    ok(`${cosa}: i pezzi sono validi`, valido(d), true)
    ok(`${cosa}: gli id sono unici`, unici(d), true)
  }

  ok('1: un testo con titolo e foto si divide in testo, testo, foto, testo', forma(dividi(pagina(T('t1', lungo)))), [
    ['testo', '<p>a</p>'], ['testo', '<h2>T</h2><p>b</p>'], ['foto', ['https://x.it/d.jpg', 'd']], ['testo', '<p>c</p>'],
  ])
  ok('1: la prima parte tiene l\'id del testo', id(dividi(pagina(T('t1', lungo))))[0], 't1')
  ok('1: prima è divisibile', divisibile(pagina(T('t1', lungo))), true)
  regge('1', pagina(T('t1', lungo)))

  const semplice = pagina(T('t1', '<p>a</p><p>b</p>'))
  ok('2: un testo senza titoli né foto resta com\'è', dividi(semplice), semplice)
  ok('2: non è divisibile', divisibile(semplice), false)
  ok('2: nemmeno la pagina vuota è divisibile', divisibile(pagina()), false)

  const CI = CIMA('c0'), K = C('k1', [{ html: '<p>1</p>' }, { html: '<p>2</p>' }]), FO = F('f1')
  const mista = pagina(CI, T('t1', lungo), K, FO)
  const dm = dividi(mista)
  ok('3: la foto in cima è identica e prima', prova(() => dm.content[0]), CI)
  ok('3: colonne e foto sono identiche e in fondo, nell\'ordine', prova(() => dm.content.slice(-2)), [K, FO])
  ok('3: le parti nuove stanno al posto del testo', prova(() => dm.content.slice(1, -2).map((p) => p.type)), ['testo', 'testo', 'foto', 'testo'])
  regge('3', mista)

  console.log('\nDividi in parti: il testo del sito non cambia mai')
  const judo = `${IMG('sala')}<ul><li>Lunedì</li><li>Giovedì</li></ul><h2>Orari</h2><p>Sera</p><h3>Bambini</h3><p>Pomeriggio</p><h2></h2>${IMG('tatami')}<p>Chiusura</p>`
  for (const [cosa, x] of [
    ['paragrafi e titoli vuoti', '<p></p><h2></h2><p>x</p><h2>T</h2><p></p><p>y</p><h2></h2>'],
    ['il caso Judo (foto, elenco, h2, h3, h2 vuoto, foto)', judo],
    ['solo titoli', '<h2>A</h2><h2>B</h2><h2>C</h2>'],
    ['foto una dopo l\'altra', `${IMG('a')}${IMG('b')}<p>x</p>`],
  ]) {
    regge(`4: ${cosa}`, pagina(T('t1', x)))
    regge(`4: ${cosa}, con la foto in cima`, pagina(CI, T('t1', x)))
  }
  const dj = dividi(pagina(T('t1', judo)))
  ok('4: Judo: le foto diventano foto, mai foto in cima', prova(() => dj.content.map((p) => p.type)), ['foto', 'testo', 'testo', 'foto', 'testo'])

  const apre = pagina(CI, T('t1', `${IMG('d')}<h2>T</h2><p>b</p>`))
  const da = dividi(apre)
  ok('5: con la foto in cima già presente, la prima parte del testo è foto', prova(() => da.content.map((p) => p.type)), ['fotoInCima', 'foto', 'testo'])
  ok('5: la pagina è valida', valido(da), true)
  ok('5: senza foto in cima, la foto d\'apertura è comunque foto', prova(() => dividi(pagina(T('t1', `${IMG('d')}<h2>T</h2><p>b</p>`))).content.map((p) => p.type)), ['foto', 'testo'])

  console.log('\nDividi in parti: gli id')
  const ids = pagina(T('abc', lungo), F('p1'), T('p7', lungo), K, T('xyz', '<p>solo</p>'))
  const di = dividi(ids)
  ok('6: gli id sono unici', unici(di), true)
  ok('6: i pezzi non toccati hanno lo stesso id e lo stesso contenuto', prova(() => [F('p1'), K, T('xyz', '<p>solo</p>')].every((x) => JSON.stringify(di.content.find((p) => p.props.id === x.props.id)) === JSON.stringify(x))), true)
  ok('6: id non numerico: la prima parte lo tiene', prova(() => di.content[0].props.id), 'abc')
  ok('6: il testo p7 tiene p7 per la sua prima parte', prova(() => di.content.some((p) => p.props.id === 'p7' && p.type === 'testo' && p.props.html === '<p>a</p>')), true)
  ok('6: le parti nuove sono p<numero> sopra il più alto (7)', prova(() => {
    const vecchi = new Set(['abc', 'p1', 'p7', 'k1', 'xyz'])
    const nuovi = di.content.map((p) => p.props.id).filter((x) => !vecchi.has(x))
    return nuovi.length > 0 && nuovi.every((x) => /^p\d+$/.test(x) && Number(x.slice(1)) > 7)
  }), true)
  regge('6', ids)

  console.log('\nDividi in parti: colonne, troppe parti, ripetizioni')
  const conCol = pagina(T('t1', `<p>a</p><h2>T</h2><p>b</p>${COL}<p>c</p>`))
  ok('7: un testo che darebbe colonne resta com\'è', dividi(conCol), conCol)
  ok('7: non è divisibile', divisibile(conCol), false)

  const tanti = pagina(T('t1', Array.from({ length: 101 }, (_, i) => `<h2>T${i}</h2><p>x</p>`).join('')))
  const dt = dividi(tanti)
  ok('8: oltre 100 parti il risultato non si accorpa', prova(() => dt.content.length), 101)
  ok('8: cosaNonVaPezzi dà la frase delle 100 parti', prova(() => z.cosaNonVaPezzi(dt)), 'La pagina ha troppe parti: al massimo 100')
  ok('8: è comunque divisibile, così la schermata mostra l’avviso', prova(() => z.divisibileInParti(tanti)), true)
  ok('8: il testo del sito è lo stesso', prova(() => z.pezziInHtml(dt) === z.pezziInHtml(tanti)), true)

  for (const [cosa, p] of [['Judo', pagina(T('t1', judo))], ['mista', mista], ['id strani', ids], ['semplice', semplice]]) {
    ok(`9: dividere due volte è come dividere una (${cosa})`, [valido(dividi(p)), dividi(dividi(p))], [true, dividi(p)])
  }

  ok('10: la frase dice quante parti, SALVA BOZZA e TORNA ALLE PAGINE', prova(() => { const f = z.frasePartiNuove(11); return ['11 parti', 'SALVA BOZZA', 'TUTTE LE PAGINE', 'TORNA ALLE PAGINE'].every((x) => f.includes(x)) }), true)

  const due = pagina(T('t1', lungo), K, T('t2', `<h2>X</h2><p>1</p>${IMG('e')}<p>2</p>`), FO)
  ok('11: due testi divisibili si dividono tutti e due', forma(dividi(due)), [
    ['testo', '<p>a</p>'], ['testo', '<h2>T</h2><p>b</p>'], ['foto', ['https://x.it/d.jpg', 'd']], ['testo', '<p>c</p>'],
    ['colonne', ['<p>1</p>', '<p>2</p>']],
    ['testo', '<h2>X</h2><p>1</p>'], ['foto', ['https://x.it/e.jpg', 'e']], ['testo', '<p>2</p>'],
    ['foto', ['https://x.it/a.jpg', 'Un tatami']],
  ])
  regge('11', due)
}

console.log('\nIl nuovo editor (Puck completo): con cosa si apre, quando c\'è da salvare, cosa non fa salvare')
{
  const vecchia = { titolo: 'Judo', descrizione: 'Per tutti', bozza: '<h2>Il corso</h2><p>Si impara a cadere.</p>', pezzi: null }
  const aPezzi = { titolo: 'Judo', descrizione: 'Per tutti', bozza: '<p>a</p>', pezzi: { content: [T('t1', '<p>a</p>')] } }
  const aperti = prova(() => z.pezziDaAprire(vecchia))
  ok('1: una pagina del vecchio editor si apre già a pezzi, col testo identico', prova(() => z.pezziInHtml(aperti)), vecchia.bozza)
  ok('2: una pagina a pezzi si apre coi suoi pezzi', prova(() => z.pezziDaAprire(aPezzi)), aPezzi.pezzi)
  const dati = (p, pezzi = z.pezziDaAprire(p)) => ({ titolo: p.titolo, descrizione: p.descrizione, pezzi })
  ok('3: aperta e non toccata, una pagina del vecchio editor non ha niente da salvare', prova(() => z.daSalvare(vecchia, dati(vecchia))), false)
  ok('4: aperta e non toccata, una pagina a pezzi non ha niente da salvare', prova(() => z.daSalvare(aPezzi, dati(aPezzi))), false)
  ok('5: cambiato il titolo, c\'è da salvare', prova(() => z.daSalvare(aPezzi, { ...dati(aPezzi), titolo: 'Judo adulti' })), true)
  ok('6: cambiata la descrizione, c\'è da salvare', prova(() => z.daSalvare(aPezzi, { ...dati(aPezzi), descrizione: 'Per grandi' })), true)
  ok('7: cambiato un pezzo, c\'è da salvare', prova(() => z.daSalvare(aPezzi, dati(aPezzi, { content: [T('t1', '<p>b</p>')] }))), true)
  ok('8: spazi in più intorno al titolo non sono un cambio', prova(() => z.daSalvare(aPezzi, { ...dati(aPezzi), titolo: ' Judo ' })), false)
  ok('9: senza titolo non si salva', prova(() => z.cosaNonVaSalvare({ ...dati(aPezzi), titolo: '  ' })), 'Scrivi il titolo della pagina')
  ok('10: una foto senza immagine non si salva, e la frase dice cosa fare', prova(() => z.cosaNonVaSalvare(dati(aPezzi, { content: [F('f1', '')] }))), 'Ogni foto ha bisogno della sua immagine: scegline una o togli la foto')
  ok('11: la foto in cima non in alto non si salva', prova(() => z.cosaNonVaSalvare(dati(aPezzi, { content: [T('t1', '<p>a</p>'), CIMA('c1')] }))), 'La foto in cima è una sola e sta in alto')
  ok('12: oltre 100 parti non si salva', prova(() => z.cosaNonVaSalvare(dati(aPezzi, { content: Array.from({ length: 101 }, (_, i) => T(`t${i}`, '<p>a</p>')) }))), 'La pagina ha troppe parti: al massimo 100')
  ok('13: una pagina che va si salva', prova(() => z.cosaNonVaSalvare(dati(aPezzi))), null)
  ok('14: spazi in più intorno alla descrizione non sono un cambio', prova(() => z.daSalvare(aPezzi, { ...dati(aPezzi), descrizione: ' Per tutti ' })), false)
  ok('15: un testo troppo lungo non si salva, e la frase dice quanto', prova(() => z.cosaNonVaSalvare(dati(aPezzi, { content: [T('t1', `<p>${'a'.repeat(200001)}</p>`)] })))?.startsWith?.('Il testo è troppo lungo') ?? false, true)
  ok('16: il nuovo editor c\'è per una pagina a pezzi', prova(() => z.siProvaNuovoEditor({ diLegge: false, pezzi: aPezzi.pezzi })), true)
  ok('17: il nuovo editor c\'è per una pagina del vecchio editor', prova(() => z.siProvaNuovoEditor({ diLegge: false, pezzi: null })), true)
  ok('18: il nuovo editor non c\'è per una pagina di legge', prova(() => z.siProvaNuovoEditor({ diLegge: true, pezzi: null })), false)
  ok('19: il nuovo editor non c\'è senza 62-sito-pezzi.sql', prova(() => z.siProvaNuovoEditor({ diLegge: false })), false)
  // Il testo del nuovo editor ha solo quel che il sito tiene: le parti spente non ci sono, e il sito toglie i loro segni.
  const spente = ['underline', 'strike', 'code', 'codeBlock', 'horizontalRule', 'textAlign']
  ok('20: sottolineato, barrato, codice, righe e allineamenti sono spenti', spente.filter((k) => z.TESTO_DEL_SITO?.[k] !== false), [])
  ok('21: dei titoli solo Titolo e Sottotitolo (h2, h3)', z.TESTO_DEL_SITO?.heading?.levels, [2, 3])
  ok('22: il sito toglie i segni delle parti spente', pulisci('<p><u>a</u><s>b</s><code>c</code></p><pre>d</pre><hr><p style="text-align:center">e</p><h1>f</h1>'), '<p>abc</p>d<p>e</p>f')
  ok('23: il sito tiene i segni delle parti accese', pulisci('<h2>a</h2><h3>b</h3><p><strong>c</strong><em>d</em></p><ul><li>e</li></ul><ol><li>f</li></ol><blockquote>g</blockquote>'), '<h2>a</h2><h3>b</h3><p><strong>c</strong><em>d</em></p><ul><li>e</li></ul><ol><li>f</li></ol><blockquote>g</blockquote>')
}

console.log('\nLa parte ISCRIVITI: l\'invito in fondo alla pagina')
{
  const I = (id, titolo = '', frase = '') => ({ type: 'iscriviti', props: { id, titolo, frase } })
  const cosa = (x) => prova(() => z.cosaNonVaPezzi(x))
  const UNA_IN_FONDO = 'La parte Iscriviti è una sola e sta in fondo alla pagina'

  // 4. Il tipo e il nome.
  ok('4: una pagina con la parte Iscriviti in fondo è valida', valido({ content: [T('a', '<p>x</p>'), I('b')] }), true)
  ok('4: la parte Iscriviti da sola è valida', valido({ content: [I('a', 'Titolo', 'Frase')] }), true)
  ok('4: con la foto in cima e la parte in fondo è valida', valido({ content: [CIMA('a'), T('b', '<p>x</p>'), I('c')] }), true)
  ok('4: nell\'ELENCO si chiama «Iscriviti»', prova(() => z.nomeParte(I('a'))), 'Iscriviti')

  // 5. Una sola, l'ultima; titolo e frase stringhe.
  ok('5: due parti Iscriviti non sono valide', valido({ content: [T('a', '<p>x</p>'), I('b'), I('c')] }), false)
  ok('5: la parte Iscriviti non in fondo non è valida', valido({ content: [I('a'), T('b', '<p>x</p>')] }), false)
  ok('5: due parti Iscriviti: la frase dice dove va', cosa({ content: [T('a', '<p>x</p>'), I('b'), I('c')] }), UNA_IN_FONDO)
  ok('5: la parte Iscriviti in mezzo: la frase dice dove va', cosa({ content: [T('a', '<p>x</p>'), I('b'), T('c', '<p>y</p>')] }), UNA_IN_FONDO)
  ok('5: la parte Iscriviti in fondo: niente da dire', cosa({ content: [T('a', '<p>x</p>'), I('b')] }), null)
  ok('5: un titolo che non è testo non è valido', valido({ content: [{ type: 'iscriviti', props: { id: 'a', titolo: 3, frase: '' } }] }), false)
  ok('5: una frase che non è testo non è valida', valido({ content: [{ type: 'iscriviti', props: { id: 'a', titolo: '', frase: null } }] }), false)
  ok('5: senza titolo né frase non è valida', valido({ content: [{ type: 'iscriviti', props: { id: 'a' } }] }), false)

  // 6. Il testo piatto, ripulito, con le entità.
  ok('6: la parte vuota è un div iscriviti vuoto, in fondo', html([T('a', '<p>x</p>'), I('b')]), '<p>x</p><div class="iscriviti"></div>')
  ok('6: titolo e frase in h2 e p, con & e < come entità', html([T('a', '<p>x</p>'), I('b', 'Judo & <karate', 'Prova & <scegli')]), '<p>x</p><div class="iscriviti"><h2>Judo &amp; &lt;karate</h2><p>Prova &amp; &lt;scegli</p></div>')
  ok('6: col solo titolo niente p', html([I('a', 'Solo il titolo', '')]), '<div class="iscriviti"><h2>Solo il titolo</h2></div>')
  ok('6: con la sola frase niente h2', html([I('a', '', 'Solo la frase')]), '<div class="iscriviti"><p>Solo la frase</p></div>')
  const PARTE = '<div class="iscriviti"><h2>Titolo</h2><p>Frase</p></div>'
  ok('6: pulisciTesto lascia intatta la parte Iscriviti', pulisci(`<p>x</p>${PARTE}`), `<p>x</p>${PARTE}`)
  ok('6: pulisciTesto lascia intatta anche la parte vuota', pulisci('<div class="iscriviti"></div>'), '<div class="iscriviti"></div>')

  // 7. Andata e ritorno.
  for (const [nome, parte] of [['con titolo e frase', I('p2', 'Judo & <karate', 'Prova & <scegli')], ['vuota', I('p2')], ['col solo titolo', I('p2', 'Vieni', '')], ['con la sola frase', I('p2', '', 'Una lezione a 3 €')]]) {
    const p = { content: [T('p1', '<p>Corpo</p>'), parte] }
    const h = prova(() => z.pezziInHtml(p))
    const giro = prova(() => z.htmlInPezzi(h))
    const ultima = giro?.content?.[giro.content.length - 1]
    ok(`7: andata e ritorno della parte ${nome}: torna la stessa parte`, [ultima?.type, ultima?.props?.titolo, ultima?.props?.frase], ['iscriviti', parte.props.titolo, parte.props.frase])
    ok(`7: andata e ritorno della parte ${nome}: il testo è identico`, prova(() => z.pezziInHtml(giro)), h)
  }
  const sola = prova(() => z.htmlInPezzi('<div class="iscriviti"><h2>T</h2></div>'))
  ok('7: una pagina con la sola parte torna una parte Iscriviti', sola?.content?.map((x) => x.type), ['iscriviti'])
  const inMezzo = '<p>Sopra</p><div class="iscriviti"><h2>T</h2><p>F</p></div><p>Sotto</p>'
  const mezzo = prova(() => z.htmlInPezzi(inMezzo))
  ok('7: un div iscriviti che non è in fondo non diventa una parte Iscriviti', mezzo?.content?.some((x) => x.type === 'iscriviti'), false)
  ok('7: e il testo resta identico', prova(() => z.pezziInHtml(mezzo)), pulisci(inMezzo))
  const divisa = prova(() => z.dividiInParti({ content: [T('a', '<h2>A</h2><p>1</p><h2>B</h2><p>2</p>'), I('z', 'Vieni', '')] }))
  ok('7: «Dividi in parti» lascia la parte Iscriviti in fondo', divisa?.content?.map((x) => x.type), ['testo', 'testo', 'iscriviti'])

  // 8. Le bozze di prima.
  const prima = { content: [CIMA('a'), T('b', '<h2>Titolo</h2><p>x</p>'), F('c'), C('d', [{ html: '<p>1</p>' }, { html: '<p>2</p>' }])] }
  ok('8: una bozza di prima (senza la parte) è ancora valida', valido(prima), true)
  ok('8: e dà lo stesso testo di prima', html(prima.content), '<img alt="Cima" src="https://x.it/c.jpg" /><h2>Titolo</h2><p>x</p><img alt="Un tatami" src="https://x.it/a.jpg" /><div class="colonne c-2"><div class="colonna"><p>1</p></div><div class="colonna"><p>2</p></div></div>')
  ok('8: una pagina vecchia senza div iscriviti non prende una parte Iscriviti', prova(() => z.htmlInPezzi('<p>a</p><h2>B</h2><p>c</p>'))?.content?.some((x) => x.type === 'iscriviti'), false)
  ok('8: i nomi delle altre parti non cambiano', [CIMA('a'), T('b', ''), F('c'), C('d', [{ html: '' }, { html: '' }]), C('e', [{ html: '' }, { html: '' }, { html: '' }])].map((p) => prova(() => z.nomeParte(p))), ['Foto in cima', 'Testo', 'Foto', 'Due colonne', 'Tre colonne'])
}

console.log('\nLa parte ISCRIVITI: dove la mettono i tasti + PARTE')
{
  const p = [T('a', '<p>a</p>'), T('b', '<p>b</p>')]
  const pi = [...p, { type: 'iscriviti', props: { id: 'i', titolo: '', frase: '' } }]
  ok('+ ISCRIVITI va sempre in fondo, anche con una parte scelta', [z.doveMettere('iscriviti', 0, p), z.doveMettere('iscriviti', null, p)], [2, 2])
  ok('una parte nuova senza scelta, con ISCRIVITI in fondo, va prima di lei', z.doveMettere('testo', null, pi), 2)
  ok('una parte nuova dopo quella scelta resta prima di ISCRIVITI', [z.doveMettere('foto', 0, pi), z.doveMettere('foto', 2, pi)], [1, 2])
  ok('senza ISCRIVITI una parte nuova va dopo la scelta, o in fondo', [z.doveMettere('testo', 0, p), z.doveMettere('testo', null, p)], [1, 2])
  ok('con ISCRIVITI già in pagina non se ne mette un\'altra', [z.conIscriviti(pi), z.conIscriviti(p)], [true, false])
}

console.log('\nLa parte ISCRIVITI: «Dividi in parti» non la crea in mezzo')
{
  const pagina = { content: [T('a', '<h2>Uno</h2><p>a</p><h2>Due</h2><p>b</p><div class="iscriviti"><h2>T</h2></div>'), T('b', '<p>dopo</p>')] }
  const divisa = z.dividiInParti(pagina)
  ok('un TESTO che finisce col div della parte resta intero', [divisa.content.length, divisa.content.some((q) => q.type === 'iscriviti')], [2, false])
}

console.log('\nLa parte ISCRIVITI: i tasti che la toccano')
{
  const p = [T('a', '<p>a</p>'), T('b', '<p>b</p>')]
  const pi = [...p, { type: 'iscriviti', props: { id: 'i', titolo: '', frase: '' } }]
  ok('+ ISCRIVITI si può mettere una volta sola', [z.puoMettere('iscriviti', p), z.puoMettere('iscriviti', pi), z.puoMettere('testo', pi)], [true, false, true])
  const tanti = Array.from({ length: z.MASSIMO_PEZZI }, (_, i) => T('t' + i, '<p>x</p>'))
  ok('oltre il massimo delle parti non se ne mette nessuna', [z.puoMettere('testo', tanti), z.puoMettere('iscriviti', tanti)], [false, false])
  ok('ISCRIVITI non si sposta: né su né giù', [z.spostabile(pi, 2, -1), z.spostabile(pi, 2, 1)], [false, false])
  ok('la parte prima di ISCRIVITI non le va sotto, ma sale', [z.spostabile(pi, 1, 1), z.spostabile(pi, 1, -1)], [false, true])
  ok('senza ISCRIVITI si sposta come prima, dentro la pagina', [z.spostabile(p, 0, 1), z.spostabile(p, 0, -1), z.spostabile(p, 1, 1)], [true, false, false])
  ok('il tasto spento dice perché', z.motivoSpento('iscriviti', pi), 'C’è già: una parte Iscriviti per pagina')
}

console.log('\nLa parte ISTRUTTORE: un istruttore per parte, nell\'ordine delle tessere')
{
  const IS = (id, nome, { cognome = '', corsi = '', src = '', alt = '', pagina = '' } = {}) => ({ type: 'istruttore', props: { id, nome, cognome, corsi, src, alt, pagina } })
  const I = (id) => ({ type: 'iscriviti', props: { id, titolo: '', frase: '' } })
  const cosa = (x) => prova(() => z.cosaNonVaPezzi(x))
  const SENZA_NOME = 'Ogni istruttore ha bisogno del nome: scrivilo o togli la parte'

  // Il tipo, il nome nell'ELENCO, quando è valido.
  ok('istruttore: una pagina di istruttori è valida', valido({ content: [IS('a', 'Federico'), IS('b', 'Maurizio', { cognome: 'Innella', corsi: 'Judo', src: 'https://x.it/m.jpg', alt: 'Maurizio', pagina: 'maurizio-innella' })] }), true)
  ok('istruttore: con testo prima e Iscriviti in fondo è valida', valido({ content: [T('t', '<p>x</p>'), IS('a', 'Federico'), I('z')] }), true)
  ok('istruttore: nell\'ELENCO si chiama «Istruttore»', prova(() => z.nomeParte(IS('a', 'Federico'))), 'Istruttore')
  ok('istruttore: senza nome non è valido', valido({ content: [IS('a', '')] }), false)
  ok('istruttore: un nome di soli spazi non è valido', valido({ content: [IS('a', '   ')] }), false)
  for (const campo of ['nome', 'cognome', 'corsi', 'src', 'alt', 'pagina']) {
    ok(`istruttore: «${campo}» che non è testo non è valido`, valido({ content: [{ type: 'istruttore', props: { ...IS('a', 'Federico').props, [campo]: 3 } }] }), false)
    const senza = { ...IS('a', 'Federico').props }
    delete senza[campo]
    ok(`istruttore: senza «${campo}» non è valido`, valido({ content: [{ type: 'istruttore', props: senza }] }), false)
  }
  ok('istruttore: senza nome, la frase dice cosa fare', cosa({ content: [IS('a', 'Federico'), IS('b', '')] }), SENZA_NOME)
  ok('istruttore: nome di soli spazi, la stessa frase', cosa({ content: [IS('a', '  ')] }), SENZA_NOME)
  ok('istruttore: col nome, niente da dire', cosa({ content: [IS('a', 'Federico')] }), null)

  // Il testo piatto: quello che il sito fa diventare tessere.
  ok('istruttore: solo il nome è un h3, senza p', html([IS('a', 'Federico')]), '<h3>Federico</h3>')
  ok('istruttore: con la pagina il nome è un link a /slug/', html([IS('a', 'Fabio', { pagina: 'fabio-berta' })]), '<h3><a href="/fabio-berta/">Fabio</a></h3>')
  ok('istruttore: la foto viene dopo il nome, col suo alt', html([IS('a', 'Fabio', { src: 'https://x.it/f.jpg', alt: 'Fabio ai tatami' })]), '<h3>Fabio</h3><img alt="Fabio ai tatami" src="https://x.it/f.jpg" />')
  ok('istruttore: senza foto niente img, anche con l\'alt scritto', html([IS('a', 'Fabio', { alt: 'Fabio' })]), '<h3>Fabio</h3>')
  ok('istruttore: la foto con alt vuoto resta alt="" (lo scrive il sito)', html([IS('a', 'Fabio', { src: 'https://x.it/f.jpg' })]), '<h3>Fabio</h3><img alt="" src="https://x.it/f.jpg" />')
  ok('istruttore: cognome e corsi sono «Cognome · c1, c2»', html([IS('a', 'Fabio', { cognome: 'Berta', corsi: 'Aikido, Judo' })]), '<h3>Fabio</h3><p>Berta · Aikido, Judo</p>')
  ok('istruttore: i corsi si ripuliscono (spazi e virgole vuote via)', html([IS('a', 'Fabio', { cognome: 'Berta', corsi: ' Aikido ,, Judo,Pesi , ' })]), '<h3>Fabio</h3><p>Berta · Aikido, Judo, Pesi</p>')
  ok('istruttore: senza corsi la riga è il cognome', html([IS('a', 'Fabio', { cognome: 'Berta' })]), '<h3>Fabio</h3><p>Berta</p>')
  ok('istruttore: corsi fatti solo di virgole e spazi sono nessun corso', html([IS('a', 'Fabio', { cognome: 'Berta', corsi: ' , ,' })]), '<h3>Fabio</h3><p>Berta</p>')
  ok('istruttore: senza cognome ma con corsi la riga è «· c1» (il «·» c\'è sempre)', html([IS('a', 'Aldo', { corsi: 'Judo' })]), '<h3>Aldo</h3><p>· Judo</p>')
  ok('istruttore: tutto insieme, nell\'ordine nome, foto, riga', html([IS('a', 'Maurizio', { cognome: 'Innella', corsi: 'Judo', src: 'https://x.it/m.jpg', alt: 'Maurizio', pagina: 'maurizio-innella' })]), '<h3><a href="/maurizio-innella/">Maurizio</a></h3><img alt="Maurizio" src="https://x.it/m.jpg" /><p>Innella · Judo</p>')
  ok('istruttore: nome, cognome e corsi sono testo, mai HTML', html([IS('a', '<b>Al</b> & Bo', { cognome: 'Rossi & <i>Bianchi</i>', corsi: '<b>Judo</b> & Pesi' })]), '<h3>&lt;b&gt;Al&lt;/b&gt; &amp; Bo</h3><p>Rossi &amp; &lt;i&gt;Bianchi&lt;/i&gt; · &lt;b&gt;Judo&lt;/b&gt; &amp; Pesi</p>')
  ok('istruttore: le parti si susseguono nell\'ordine dell\'array', html([IS('a', 'Federico'), IS('b', 'Maurizio'), IS('c', 'Aldo')]), '<h3>Federico</h3><h3>Maurizio</h3><h3>Aldo</h3>')

  // L'avviso: una parte che spezza gli istruttori.
  const avviso = (p, i) => prova(() => z.avvisoIstruttori(p, i))
  const SPEZZA = 'Gli istruttori dopo questa parte non sono in tessere: spostala sotto l’ultimo istruttore.'
  ok('avviso: un testo prima degli istruttori', avviso([T('t', ''), IS('a', 'A'), IS('b', 'B')], 0), SPEZZA)
  ok('avviso: un testo in mezzo agli istruttori', avviso([IS('a', 'A'), T('t', ''), IS('b', 'B')], 1), SPEZZA)
  ok('avviso: una foto o la foto in cima prima degli istruttori', [avviso([CIMA('c'), IS('a', 'A')], 0), avviso([IS('a', 'A'), F('f'), IS('b', 'B')], 1)], [SPEZZA, SPEZZA])
  ok('avviso: le colonne prima di un istruttore', avviso([C('c', [{ html: '' }, { html: '' }]), IS('a', 'A')], 0), SPEZZA)
  ok('avviso: niente per un testo dopo l\'ultimo istruttore', avviso([IS('a', 'A'), IS('b', 'B'), T('t', '')], 2), null)
  ok('avviso: niente per gli istruttori stessi', [avviso([T('t', ''), IS('a', 'A'), IS('b', 'B')], 1), avviso([T('t', ''), IS('a', 'A'), IS('b', 'B')], 2)], [null, null])
  ok('avviso: niente per la parte Iscriviti', avviso([IS('a', 'A'), I('z')], 1), null)
  ok('avviso: niente in una pagina senza istruttori', avviso([T('t', ''), F('f'), T('u', '')], 0), null)

  // La nota sotto il campo «pagina»: dice se il nome sarà un link.
  const PAGINE = [{ slug: 'fabio-berta', pubblicato: '2026-10-01T10:00:00Z', nascosta: false }, { slug: 'diana', pubblicato: null, nascosta: false }, { slug: 'maura', pubblicato: '2026-10-01T10:00:00Z', nascosta: true }]
  const nota = (s) => prova(() => z.notaPaginaIstruttore(s, PAGINE))
  const NON_PUBBLICATA = 'Non è pubblicata: il nome sarà un link quando la pubblichi.'
  ok('nota: nessuna pagina scelta, niente da dire', nota(''), null)
  ok('nota: una pagina che non c\'è più', nota('valerio'), 'Questa pagina non c’è più: scegline un’altra.')
  ok('nota: una pagina mai pubblicata', nota('diana'), NON_PUBBLICATA)
  ok('nota: una pagina nascosta', nota('maura'), NON_PUBBLICATA)
  ok('nota: una pagina pubblicata, niente da dire', nota('fabio-berta'), null)
}

console.log(guai ? `\n${guai} COSE NON TORNANO` : '\nTUTTO A POSTO')
process.exit(guai ? 1 : 0)
