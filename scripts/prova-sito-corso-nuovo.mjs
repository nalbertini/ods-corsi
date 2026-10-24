// ---------------------------------------------------------------------------
// La pagina del corso rivista («corso nuovo»), senza browser: il testo della
// segreteria, scritto con la convenzione di docs/sito/judo.html, diventa le
// fasce del design. Sempre da `generaSito`.
//
//   node scripts/prova-sito-corso-nuovo.mjs
//
//  1. Si riconosce dal pulsante verso l'iscrizione prima del primo h2.
//  2. Senza, il <main> è identico a prima (sha fissato).
//  3. Forma sbagliata: impaginazione di sempre, nessuna parola persa.
//  4. Testata: titolo e descrizione dai campi, senza pulsanti.
//  5. Judo pieno. 6. Foto: solo B, solo C, nessuna.
//  7. Senza foto A: fascia di dati. 8. Orario da 1 a 7 gruppi.
//  9. «Cosa si fa» e «Cosa aspettarsi»: quanti gruppi. 10. Senza chiusura l'invito c'è.
// 11. Nessuna parola persa. 12. CSS. 13. Fuochi delle foto. 14. I nove testi veri.
// ---------------------------------------------------------------------------
import { build } from 'esbuild'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

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
// Ogni link al modulo porta l'etichetta della sua pagina (`?da=home`…, provata in prova-sito-genera.mjs): qui si guarda
// l'impaginazione, che non cambia, e la si confronta senza l'etichetta con quella di prima.
const senzaDa = (r) => (r && typeof r === 'object' ? Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === 'string' ? v.replace(/(\?|&amp;|&)da=[a-z0-9-]+/g, '') : v])) : r)
const generaSito = (d) => senzaDa(g.generaSito(d))

let guai = 0
const ok = (cosa, avuto, voluto) => {
  const va = JSON.stringify(avuto) === JSON.stringify(voluto)
  console.log(va ? '  ✓' : '  ✗', cosa, va ? '' : `— atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`)
  if (!va) guai++
}

const P = 'https://abc.supabase.co/storage/v1/object/public/sito/'
const ISC = 'https://app.officinedellosport.it/iscrizioni/'
const DESC = 'Il judo a Collegno, dai 7 anni agli adulti.'
const pagina = (testo, { slug = 'judo', titolo = 'Judo', descrizione = DESC, diLegge = false, ospiti = [P] } = {}) =>
  generaSito({
    dominio: 'https://officinedellosport.it',
    pagine: [{ slug, titolo, descrizione, testo, ...(diLegge ? { diLegge: true } : {}) }, { slug: 'corsi', titolo: 'Corsi', descrizione: '', testo: '<p>c</p>' }, { slug: 'contatti', titolo: 'Contatti', descrizione: '', testo: '<p>c</p>' }],
    menu: [{ dove: 'menu', ordine: 1, etichetta: 'Home', slug: 'home', indirizzo: null }, { dove: 'menu', ordine: 2, etichetta: 'I nostri corsi', slug: 'corsi', indirizzo: null }],
    rinvii: [],
    ospitiImmagini: ospiti,
  })[slug === 'home' ? 'index.html' : `${slug}/index.html`] ?? ''
const main = (h) => h.match(/<main[^>]*>([\s\S]*)<\/main>/)?.[1] ?? ''
const mainTag = (h) => h.match(/<main([^>]*)>/)?.[1] ?? ''
const sha = (t) => createHash('sha256').update(t).digest('hex')
const conta = (x, re) => (x.match(re) || []).length
const testo = (h) => h.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
const classi = (attr) => (attr.match(/class="([^"]*)"/)?.[1] ?? '').split(/\s+/).filter(Boolean)
const sezioni = (m) => [...m.matchAll(/<section\b([^>]*)>([\s\S]*?)<\/section>/g)].map((x) => ({ classi: classi(x[1]), html: x[2] }))
const conClasse = (h, c) => sezioni(main(h)).find((s) => s.classi.includes(c))
const sezDi = (h, titolo) => sezioni(main(h)).find((s) => new RegExp(`<h2[^>]*>\\s*${titolo}`).test(s.html))
const tessereDi = (html) => [...html.matchAll(/<div class="(tessere [^"]*)">/g)].map((m) => m[1].split(/\s+/))
const nuova = (h) => classi(mainTag(h)).includes('corso-nuovo')

// --- il testo, a pezzi -------------------------------------------------------
const img = (n, alt) => `<img src="${P}${n}.jpg" alt="${alt}" />`
const A = img('foto-a', 'Una lezione di judo')
const B = img('foto-b', 'Gli allievi sul tatami')
const C = img('foto-c', 'Gli istruttori in posa')
const PUL = `<p><a class="pulsante" href="/contatti/">Scrivici</a> <a class="pulsante" href="${ISC}">Prova una settimana a 5 €</a></p>`
const voci = (n) => `<ul>${Array.from({ length: n }, (_, i) => `<li><strong>Etichetta ${i + 1}</strong> Valore numero ${i + 1}</li>`).join('')}</ul>`
const gruppi = (n, pref) => Array.from({ length: n }, (_, i) => `<h3>${pref} ${i + 1}</h3><p>Testo di ${pref} numero ${i + 1}.</p>`).join('')
const orario = (n) => `<h2>Orario delle lezioni</h2>${Array.from({ length: n }, (_, i) => `<h3>Gruppo ${i + 1}</h3><p><strong>1${i}:00 – 1${i + 1}:00</strong></p><p>giorni del gruppo ${i + 1}</p>${i % 2 ? '' : `<p>età del gruppo ${i + 1}</p>`}`).join('')}`
const cosa = (conB) => `<h2></h2><h3>Cosa si fa</h3><p>Si lavora su cadute e prese.</p>${conB ? B : ''}<h3>A chi è rivolto</h3><p>A bambini e adulti.</p>`
const cosaN = (n) => T({ cosa: false, storia: false }).replace(ASP(4), `<h2></h2>${gruppi(n, 'Passo')}` + ASP(4))
const STORIA = `<h2>La storia del judo</h2>${gruppi(4, 'Tappa')}`
const ASP = (n) => `<h2>Cosa aspettarsi</h2>${gruppi(n, 'Aspetto')}`
const CHIUSURA = (conC) => `<h2>Una settimana per scegliere.</h2><p>5 € e provi il corso.</p><p>Vieni in Via Vittorio Sassi 26, Collegno.</p><p><a class="pulsante" href="${ISC}">Prova una settimana a 5 €</a> <a class="pulsante" href="/contatti/">Scrivici</a></p>${conC ? C : ''}`
const JUDO = { pul: PUL, a: A, voci: 4, orari: 5, cosa: true, b: true, storia: true, asp: 4, chiusura: true, c: true }
const T = (o = {}) => {
  const x = { ...JUDO, ...o }
  return x.pul + x.a + voci(x.voci) + (x.orari ? orario(x.orari) : '') + (x.cosa ? cosa(x.b) : '') + (x.storia ? STORIA : '') + (x.asp ? ASP(x.asp) : '') + (x.chiusura ? CHIUSURA(x.c) : '')
}
const H = pagina(T())
const M = main(H)
const frasi = (t) => [...t.matchAll(/>([^<]+)</g)].map((m) => m[1].trim()).filter(Boolean)
const perse = (t, h) => { const tt = testo(main(h)); return frasi(t.replace(PUL, '').replace(/Prova una settimana a 5 €/g, '').replace(/<a class="pulsante" href="\/contatti\/">Scrivici<\/a>/g, '')).filter((f) => !tt.includes(f.replace(/\s+/g, ' '))) }
const rotto = (h) => /corso-nuovo|corso-apertura|corso-fascia|cosa-si-fa|class="[^"]*\borari\b|class="[^"]*\bperche\b|class="[^"]*\bcta\b/.test(main(h)) || nuova(h)

console.log('\n1. Quando una pagina è «corso nuovo»')
{
  ok('con il pulsante all’iscrizione prima del primo h2: passo-unico corso-nuovo e data-corso', [classi(mainTag(H)), mainTag(H).match(/data-corso="([^"]*)"/)?.[1]], [['passo-unico', 'corso-nuovo'], 'judo'])
  const conIsc = (href) => nuova(pagina(T({ pul: `<p><a class="pulsante" href="/contatti/">Scrivici</a> <a class="pulsante" href="${href}">Prova</a></p>` })))
  ok('http://www…/iscrizioni, senza «/» finale, vale lo stesso', conIsc('http://www.app.officinedellosport.it/iscrizioni'), true)
  ok('anche https senza www con «/»', conIsc('https://app.officinedellosport.it/iscrizioni/'), true)
  ok('la pagina di un altro corso (lotta) si riconosce uguale', nuova(pagina(T(), { slug: 'lotta', titolo: 'Lotta' })), true)
  ok('senza pulsanti non è nuova', nuova(pagina(T({ pul: '' }))), false)
  ok('un pulsante verso un altro indirizzo non basta', nuova(pagina(T({ pul: '<p><a class="pulsante" href="https://esempio.it/iscrizioni/">Prova</a></p>' }))), false)
  ok('solo «Scrivici» non basta', nuova(pagina(T({ pul: '<p><a class="pulsante" href="/contatti/">Scrivici</a></p>' }))), false)
  ok('un link all’iscrizione senza classe «pulsante» non basta', nuova(pagina(T({ pul: `<p><a href="${ISC}">Prova</a></p>` }))), false)
  ok('il pulsante dopo il primo h2 non conta', nuova(pagina(T({ pul: '' }) + PUL)), false)
  ok('la Home non è mai un corso nuovo', nuova(pagina(T(), { slug: 'home' })), false)
  ok('una pagina di legge nemmeno', nuova(pagina(T(), { diLegge: true })), false)
}

console.log('\n2. Il testo di prima resta com’era')
{
  const senza = pagina(T({ pul: '' }))
  ok('lo stesso testo senza il pulsante: <main> identico a oggi (sha)', sha(main(senza)), '488555f30008f5c1aaccdd22627ecd6d98e9ccdd85e2b0d22b7352708b7fbf73')
  ok('non porta nessuna classe del corso nuovo', rotto(senza), false)
}

console.log('\n3. Forma che non torna: impaginazione di sempre, nessuna parola persa')
{
  const casi = {
    '«Cosa si fa» con 3 gruppi': cosaN(3),
    'Cosa aspettarsi con 5 gruppi': T({ asp: 5 }),
    'orario senza ora': T({ orari: 0 }).replace('<h2></h2>', '<h2>Orario delle lezioni</h2><h3>Gruppo</h3><p>solo giorni</p><p>solo età</p><h2></h2>'),
  }
  for (const [nome, t] of Object.entries(casi)) {
    const h = pagina(t)
    const blocco = nome.startsWith('«Cosa si fa»') ? /cosa-si-fa/ : nome.startsWith('Cosa asp') ? /class="[^"]*\bperche\b/ : /class="[^"]*\borari\b/
    ok(`${nome}: nessun blocco del corso nuovo corrispondente`, blocco.test(main(h)), false)
    ok(`${nome}: ogni parola c’è`, perse(t, h), [])
  }
}

console.log('\n4. La testata: titolo e descrizione, senza pulsanti')
{
  const hero = sezioni(M).find((s) => s.classi.includes('pagina-hero'))
  ok('la testata è «pagina-hero solo»', hero?.classi, ['pagina-hero', 'solo'])
  // L'iscrizione resta nella barra in alto e nella chiamata finale: sotto il titolo non serve più.
  ok('sotto titolo e descrizione nessun pulsante, nemmeno «Iscriviti»', [/class="pulsanti"/.test(hero?.html ?? ''), /<a\b/.test(hero?.html ?? '')], [false, false])
  ok('h1 dal titolo e descrizione dal campo', [hero?.html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1], hero?.html.match(/<p>([^<]*)<\/p>/)?.[1]], ['Judo', DESC])
  ok('il paragrafo dei pulsanti del testo non resta fuori dalla testata e «Scrivici» non esce nemmeno nella chiusura', conta(M, /Scrivici<\/a>/g), 0)
}

console.log('\n5. Il Judo pieno')
{
  const apertura = M.match(/<figure class="corso-apertura">([\s\S]*?)<\/figure>/)?.[1] ?? ''
  ok('foto A in <figure class="corso-apertura">, caricata subito', [apertura.includes('foto-a.jpg'), /loading="lazy"/.test(apertura)], [true, false])
  const dati = M.match(/<div class="tessere n-4 dati">([\s\S]*?)<\/div>/)?.[1] ?? ''
  ok('4 dati in tessere n-4 dati', [conta(dati, /<article\b/g), testo(dati).includes('Valore numero 4'), /corso-fascia/.test(M)], [4, true, false])
  const orari = conClasse(H, 'orari')
  const t = tessereDi(orari?.html ?? '')[0]
  const art = [...(orari?.html ?? '').matchAll(/<article class="([^"]*)">/g)].map((m) => m[1].split(/\s+/))
  ok('Orario: sezione «orari» con tessere n-5 orari', t, ['tessere', 'n-5', 'orari'])
  ok('5 tessere orario, solo l’ultima gialla', [art.length, art.every((c) => c.includes('orario')), art.map((c) => c.includes('giallo'))], [5, true, [false, false, false, false, true]])
  const cs = conClasse(H, 'cosa-si-fa')
  ok('«Cosa si fa» ha la foto B dentro <figure class="corso-interna">, blocco con-foto', [cs?.classi.includes('con-foto'), /<figure class="corso-interna">\s*<img[^>]*foto-b\.jpg/.test(cs?.html ?? ''), conta(cs?.html ?? '', /<h3>/g)], [true, true, 2])
  const st = sezDi(H, 'La storia del judo')
  ok('la storia: 4 tessere come sempre, senza numeri', [conta(st?.html ?? '', /<article\b/g), /numero-perche/.test(st?.html ?? ''), st?.classi.includes('cta')], [4, false, false])
  const asp = sezDi(H, 'Cosa aspettarsi')
  ok('Cosa aspettarsi: tessere perche n-4 con 4 numeri 1-4', [(tessereDi(asp?.html ?? '')[0] ?? []).slice().sort(), [...(asp?.html ?? '').matchAll(/numero-perche"[^>]*>\s*(\d)\s*</g)].map((m) => m[1])], [['n-4', 'perche', 'tessere'], ['1', '2', '3', '4']])
  const cta = conClasse(H, 'cta')
  ok('la chiusura è <section class="sezione cta"> con la foto C e un solo pulsante', [cta?.classi, /foto-c\.jpg/.test(cta?.html ?? ''), conta(cta?.html ?? '', /class="pulsante/g)], [['sezione', 'cta'], true, 1])
  ok('con la chiusura non c’è l’invito «PROVA» del piede', /class="invito"/.test(H), false)
  ok('ogni foto compare una volta sola', ['foto-a', 'foto-b', 'foto-c'].map((f) => conta(H, new RegExp(`\\ssrc="[^"]*${f}\\.jpg`, 'g'))), [1, 1, 1])
  const pos = ['Orario delle lezioni', 'Cosa si fa', 'La storia del judo', 'Cosa aspettarsi', 'Una settimana per scegliere'].map((x) => M.indexOf(x))
  ok('le sezioni sono nell’ordine del testo', pos.every((v, i) => v >= 0 && (i === 0 || v > pos[i - 1])), true)
}

console.log('\n6. Foto: solo B, solo C, nessuna')
{
  const soloB = pagina(T({ a: '', c: false, b: true }).replace(/<img[^>]*foto-a[^>]*>/, ''))
  const soloC = pagina(T({ a: '', b: false }))
  const nessuna = pagina(T({ a: '', b: false, c: false }))
  ok('solo B: B una volta, dentro «cosa-si-fa con-foto»; la chiusura è «cta solo»', [conta(soloB, /\ssrc="[^"]*foto-b\.jpg/g), conClasse(soloB, 'cosa-si-fa')?.classi.includes('con-foto'), conClasse(soloB, 'cta')?.classi], [1, true, ['sezione', 'cta', 'solo']])
  ok('solo C: C una volta nella chiusura, «cosa-si-fa» non è con-foto', [conta(soloC, /\ssrc="[^"]*foto-c\.jpg/g), /foto-c/.test(conClasse(soloC, 'cta')?.html ?? ''), conClasse(soloC, 'cosa-si-fa')?.classi.includes('con-foto'), conClasse(soloC, 'cta')?.classi.includes('solo')], [1, true, false, false])
  ok('nessuna foto: nessuna <img> nel <main> oltre a quelle di sempre, «cta solo», niente corso-apertura', [conta(main(nessuna), /<img\b/g), conClasse(nessuna, 'cta')?.classi.includes('solo'), /corso-apertura/.test(main(nessuna))], [0, true, false])
  const soloA = pagina(T({ b: false, c: false }))
  ok('solo A: la foto è nell’apertura e basta', [conta(soloA, /\ssrc="[^"]*foto-a\.jpg/g), /corso-interna|cta-foto/.test(main(soloA))], [1, false])
}

console.log('\n7. Senza foto A: la fascia dei dati')
{
  const h5 = pagina(T({ a: '', voci: 5, orari: 0 }))
  const fascia = (h) => [...(h.match(/<ul class="corso-fascia">([\s\S]*?)<\/ul>/)?.[1] ?? '').matchAll(/<li><span class="et">([^<]*)<\/span><strong class="val">([^<]*)<\/strong><\/li>/g)].map((m) => [m[1], m[2]])
  ok('5 voci: la fascia ha le prime 3, etichetta e valore', fascia(h5), [['Etichetta 1', 'Valore numero 1'], ['Etichetta 2', 'Valore numero 2'], ['Etichetta 3', 'Valore numero 3']])
  const dati = M.length && (h5.match(/<div class="(tessere [^"]*dati)">([\s\S]*?)<\/div>/) ?? [])
  ok('le altre 2 sono tessere «n-2 dati»', [dati[1]?.split(/\s+/).sort(), conta(dati[2] ?? '', /<article\b/g)], [['dati', 'n-2', 'tessere'], 2])
  ok('senza foto A nessuna sezione orario', [/<section class="sezione orari/.test(h5), conClasse(h5, 'orari')], [false, undefined])
  const conOrarioNelTesto = pagina(T({ a: '', voci: 5 }))
  ok('anche se il testo ha l’h2 orario: nessuna sezione orari, il testo c’è in una sezione', [conClasse(conOrarioNelTesto, 'orari'), perse(T({ a: '', voci: 5 }), conOrarioNelTesto)], [undefined, []])
  for (const n of [2, 3]) {
    const h = pagina(T({ a: '', voci: n, orari: 0 }))
    ok(`${n} voci: tutte nella fascia, nessuna tessera dati vuota`, [fascia(h).length, /tessere [^"]*\bdati\b/.test(h.replace(/<style>[\s\S]*?<\/style>/g, ''))], [n, false])
  }
}

console.log('\n8. L’orario da 1 a 7 gruppi')
{
  for (let n = 1; n <= 7; n++) {
    const o = conClasse(pagina(T({ orari: n })), 'orari')
    ok(`${n} gruppi: classe n-${n} e ${n} tessere`, [tessereDi(o?.html ?? '')[0]?.includes(`n-${n}`), conta(o?.html ?? '', /<article class="tessera/g)], [true, n])
  }
  const grassetto = T({ orari: 0 }).replace('<h2></h2>', '<h2>Orario delle lezioni</h2><h3>Gruppo</h3><p>Dalle <strong>9</strong> alle 10</p><h2></h2>')
  ok('un grassetto in mezzo al testo non è un orario', [/class="[^"]*\borari\b/.test(main(pagina(grassetto))), perse(grassetto, pagina(grassetto))], [false, []])
}

console.log('\n9. Quanti gruppi: «Cosa si fa» e «Cosa aspettarsi»')
{
  ok('«Cosa si fa» vuole esattamente 2 gruppi', [1, 2, 3].map((n) => Boolean(conClasse(pagina(cosaN(n)), 'cosa-si-fa'))), [false, true, false])
  ok('Cosa aspettarsi: 3 e 4 gruppi sono tessere numerate, 2 e 5 no', [2, 3, 4, 5].map((n) => /class="tessere [^"]*\bperche\b/.test(main(pagina(T({ asp: n }))))), [false, true, true, false])
  ok('3 gruppi: n-3', tessereDi(sezDi(pagina(T({ asp: 3 })), 'Cosa aspettarsi')?.html ?? '')[0]?.includes('n-3'), true)
  ok('storia da 4 e aspettarsi da 4: i numeri solo sulla seconda', [conta(M, /numero-perche/g), /numero-perche/.test(sezDi(H, 'La storia del judo')?.html ?? '')], [4, false])
}

console.log('\n10. Senza chiusura resta l’invito di sempre')
{
  const h = pagina(T({ chiusura: false }))
  ok('senza la chiusura c’è l’invito, e la pagina è comunque nuova', [/class="invito"/.test(h), nuova(h), Boolean(conClasse(h, 'cta'))], [true, true, false])
}

console.log('\n11. Nessuna parola persa')
{
  const varianti = { pieno: T(), 'senza foto': T({ a: '', b: false, c: false }), 'senza A, 5 voci': T({ a: '', voci: 5 }), 'orario 7': T({ orari: 7 }), 'senza chiusura': T({ chiusura: false }), 'paragrafo in più nell’introduzione': T().replace('</ul>', '</ul><p>Una riga in più sotto i dati.</p>') }
  for (const [nome, t] of Object.entries(varianti)) ok(`${nome}: ogni frase del testo è nell’HTML`, perse(t, pagina(t)), [])
}

{
  // La chiusura è l'ultima sezione: un'altra sezione dopo i pulsanti la declassa, e l'invito di sempre torna.
  const t = T() + '<h2>Dopo</h2><p>Una sezione in coda.</p>'
  ok('una sezione dopo i pulsanti: niente chiusura gialla, torna l’invito', [/class="sezione cta/.test(main(pagina(t))), /class="invito"/.test(pagina(t))], [false, true])
}

console.log('\n12. Gli <style>')
{
  const stili = (h) => [...h.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1])
  const ha = (h, s) => stili(h).some((c) => c.includes(s))
  ok('la pagina nuova ha il CSS della Home e un blocco proprio (.corso-nuovo)', [ha(H, '.numero-perche'), ha(H, '.corso-nuovo'), ha(H, '.corso-apertura')], [true, true, true])
  const vecchia = pagina(T({ pul: '' }))
  ok('il corso di prima: né CSS della Home né .corso-nuovo', [ha(vecchia, '.numero-perche'), ha(vecchia, '.corso-nuovo')], [false, false])
  ok('una pagina qualunque: un solo <style>', stili(pagina('<p>x</p>', { slug: 'contatti', titolo: 'C' })).length, 1)
}

console.log('\n13. I fuochi delle foto')
{
  const css = (h) => stili_(h)
  const stili_ = (h) => [...h.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('')
  const regola = (h, corso, sel) => new RegExp(`\\[data-corso="${corso}"\\][^{}]*${sel.replace(/[.]/g, '\\.')}[^{}]*\\{[^}]*object-position:`).test(css(h))
  for (const [slug, titolo] of [['judo', 'Judo'], ['lotta', 'Lotta'], ['aikido', 'Aikido']]) {
    const h = pagina(T(), { slug, titolo })
    ok(`${slug}: un fuoco per .corso-apertura img, .corso-interna img e .cta-foto img`, ['.corso-apertura img', '.corso-interna img', '.cta-foto img'].map((s) => regola(h, slug, s)), [true, true, true])
  }
  const senza = pagina(T(), { slug: 'yoga', titolo: 'Yoga' })
  ok('un corso fuori dalla tabella (yoga): nessuna regola di fuoco per lui', css(senza).includes('[data-corso="yoga"]'), false)
  ok('la pagina di prima non ha regole di fuoco', /\[data-corso=/.test(css(pagina(T({ pul: '' })))), false)
}

console.log('\n14. I nove testi veri di docs/sito')
{
  const OSPITE = 'https://qfejpnkryrvjubcxvuco.supabase.co/storage/v1/object/public/sito/'
  const corsi = ['judo', 'lotta', 'aikido', 'pre-pugilistica', 'mga-metodo-globale-di-autodifesa', 'preparazione-atletica', 'giocomotricita-e-psicomotricita', 'avviamento-alle-arti-marziali', 'sollevamenti-pesi']
  for (const slug of corsi) {
    const file = readFileSync(new URL(`../docs/sito/${slug}.html`, import.meta.url), 'utf8')
    const titolo = file.match(/<title>([^:<]*)/)?.[1]?.trim() ?? slug
    const t = file.replace(/^<!doctype html>\s*<meta charset="utf-8">\s*<title>[^<]*<\/title>\s*/i, '')
    const h = pagina(t, { slug, titolo, ospiti: [OSPITE] })
    ok(`${slug}: pagina nuova`, [nuova(h), mainTag(h).match(/data-corso="([^"]*)"/)?.[1]], [true, slug])
    ok(`${slug}: nessuna parola persa`, perse(t, h), [])
  }
}

console.log('\n15. Reflow a 320 px: le parole lunghe dei dati vanno a capo')
{
  // Senza, «giocomotricità» nella tessera «Quando» allarga la pagina di 24px (WCAG 1.4.10).
  const slug = 'giocomotricita-e-psicomotricita'
  const file = readFileSync(new URL(`../docs/sito/${slug}.html`, import.meta.url), 'utf8')
  const h = pagina(file.replace(/^<!doctype html>\s*<meta charset="utf-8">\s*<title>[^<]*<\/title>\s*/i, ''), { slug, titolo: 'Giocomotricità', ospiti: [] })
  const css = [...h.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('')
  ok('.dato .val può andare a capo ovunque', /\.corso-nuovo \.dato \.val\{[^}]*overflow-wrap:anywhere/.test(css), true)
}

console.log(guai ? `\n✗ ${guai} casi falliti` : '\nTutto a posto.')
process.exit(guai ? 1 : 0)
