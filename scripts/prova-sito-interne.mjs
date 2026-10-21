// ---------------------------------------------------------------------------
// Testata, pagina, invito e piede delle pagine interne come nel design
// (TatamiBlu-Corsi / -ChiSiamo / …, desktop 1440px; TatamiBluM-*, telefono 375px),
// senza browser. Le misure si leggono dal CSS generato.
//
//   node scripts/prova-sito-interne.mjs
//
// Dove il design e l'accessibilità non vanno d'accordo vince l'accessibilità:
// i link del menu restano alti 44px (nel design 38px) e il piede ha il suo
// titolo di sezione, nascosto alla vista.
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

const pagina = (slug = 'corsi') => {
  const f = g.generaSito({
    dominio: 'https://officinedellosport.it',
    pagine: [
      { slug: 'home', titolo: 'Home', descrizione: 'd', testo: '<p>Home</p>' },
      { slug: 'corsi', titolo: 'I nostri corsi', descrizione: 'Judo, lotta.', testo: '<p>x</p>' },
      { slug: 'contatti', titolo: 'Contattaci', descrizione: 'd', testo: '<p>x</p>' },
    ],
    menu: [['Home', 'home'], ['I nostri corsi', 'corsi'], ['Contattaci', 'contatti']].map(([e, s], i) => ({ dove: 'menu', ordine: i, etichetta: e, slug: s, indirizzo: null })).concat([{ dove: 'footer', ordine: 1, etichetta: 'Privacy policy', slug: null, indirizzo: '/privacy/' }]),
    rinvii: [],
  })
  return f[slug === 'home' ? 'index.html' : `${slug}/index.html`] ?? ''
}
const css = (h) => h.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? ''
/** Il CSS diviso: quello di base e quello dei @media ≤900px (il telefono), che nel CSS del sito sono più d'uno. */
const divisi = (c) => {
  let base = c
  let tel = ''
  for (;;) {
    const i = base.indexOf('@media (max-width:900px){')
    if (i < 0) return { base, tel }
    let p = 0
    let k = base.indexOf('{', i)
    const a = k
    for (; k < base.length; k++) {
      if (base[k] === '{') p++
      else if (base[k] === '}' && --p === 0) break
    }
    tel += base.slice(a + 1, k)
    base = base.slice(0, i) + base.slice(k + 1)
  }
}
/** Il valore di `prop` nell'ultima regola con questo selettore esatto, nel CSS di base o in quello del telefono. */
const dich = (c, sel, prop, telefono = false) => {
  const parte = telefono ? divisi(c).tel : divisi(c).base
  let v = null
  for (const m of parte.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!m[1].split(',').map((x) => x.trim().replace(/^@media[^{]*\{/, '')).includes(sel)) continue
    const d = m[2].split(';').find((y) => y.split(':')[0].trim() === prop)
    if (d) v = d.slice(d.indexOf(':') + 1).trim()
  }
  return v
}
const main = (h) => h.match(/<main>([\s\S]*)<\/main>/)?.[1] ?? ''
const conta = (x, re) => (x.match(re) || []).length
const h = pagina()
const c = css(h)
const D = (sel, prop) => dich(c, sel, prop)
const T = (sel, prop) => dich(c, sel, prop, true)

console.log('\n1. Testata')
ok('il menu segna la pagina in cui sei (aria-current) e solo quella', [conta(h, /aria-current="page"/g), /<a href="\/corsi\/" aria-current="page">/.test(h)], [1, true])
ok('padding 22px, logo alto 110px', [D('.testata', 'padding'), D('.logo img', 'height')], ['22px var(--margine)', '110px'])
ok('voci del menu: 4px tra loro (più 16px di imbottitura), quella attuale gialla', [D('.testata nav ul', 'gap'), D('.testata nav a[aria-current]', 'background')], ['4px', 'var(--giallo)'])
ok('pulsante di testata: 52px di altezza, padding 0 24px, 16px', [D('.testata .pulsante', 'min-height'), D('.testata .pulsante', 'padding'), D('.testata .pulsante', 'font-size')], ['52px', '0 24px', '16px'])
ok('telefono: padding 12px sopra e sotto, logo alto 82px', [T('.testata', 'padding'), T('.logo img', 'height')], ['12px var(--margine)', '82px'])
ok('telefono: menu aperto (#menu:target) su fondo pieno, voci con 16px di padding, 17px; l’attuale gialla', [T('#menu:target', 'background'), T('.testata nav a', 'padding'), T('.testata nav a', 'font-size'), D('.testata nav a[aria-current]', 'background')], ['var(--fondo)', '0 16px', '17px', 'var(--giallo)'])

console.log('\n2. Testata della pagina (hero) delle pagine interne')
ok('solo le pagine interne hanno la classe «interna», la Home no', [conta(h, /class="pagina-hero interna( solo)?"/g), conta(pagina('home'), /class="pagina-hero interna/g)], [1, 0])
ok('desktop: padding 40 e 72px sotto, titolo a sinistra e colonna da 520px a destra', [D('.pagina-hero.interna', 'padding'), D('.pagina-hero.interna', 'grid-template-columns'), D('.pagina-hero.interna', 'align-items')], ['40px var(--margine) 72px', '1fr 520px', 'end'])
ok('titolo da 120px (come I corsi), interlinea .82', [D('.interna h1', 'font-size'), D('.interna h1', 'line-height')], ['120px', '.82'])
ok('frase da 22px con 28px sotto', [D('.interna .intro p', 'font-size'), D('.interna .intro p', 'margin')], ['22px', '0 0 28px'])
ok('telefono: padding 20 e 36px sotto; titolo da 56px (come I corsi); frase 18px', [T('.pagina-hero.interna', 'padding'), T('.interna h1', 'font-size'), T('.interna .intro p', 'font-size')], ['20px var(--margine) 36px', '56px', '18px'])

console.log('\n3. Invito «Iscriviti»')
ok('desktop: 96px sopra, margini della pagina, padding 56px, due colonne', [D('.invito', 'margin'), D('.invito', 'padding'), D('.invito', 'grid-template-columns')], ['96px var(--margine) 6px', '56px', 'minmax(0,1.1fr) minmax(0,1fr)'])
ok('titolo da 56 a 88px, frase da 22px, pulsanti alti 60px', [D('.invito h2', 'font-size'), D('.invito-testo>p:not(.occhiello)', 'font-size'), D('.invito .pulsante', 'min-height')], ['clamp(56px,6.11vw,88px)', '22px', '60px'])
ok('telefono: 48px sopra, padding 28px 22px, una colonna, frase 18px', [T('.invito', 'margin'), T('.invito', 'padding'), T('.invito', 'grid-template-columns'), T('.invito-testo>p:not(.occhiello)', 'font-size')], ['48px var(--margine) 6px', '28px 22px', 'minmax(0,1fr)', '18px'])

console.log('\n4. Piede')
ok('il nome va su due righe: «Officine» e «dello Sport»', /<p class="nome">Officine<br>dello Sport<\/p>/.test(h), true)
ok('desktop: padding 40px, 40px tra le colonne, nome da 56px', [D('.piede', 'padding'), D('.piede', 'gap'), D('.piede .nome', 'font-size')], ['40px', '40px', '56px'])
ok('margini come l’invito, 48px sotto', [D('.piede', 'margin')], ['0 var(--margine) 48px'])
ok('i titoli di colonna sono nascosti alla vista (restano per chi legge lo schermo)', D('.piede h2', 'position'), 'absolute')
ok('telefono: colonna sola, padding 24px, nome da 44px', [T('.piede', 'flex-direction'), T('.piede', 'padding'), T('.piede .nome', 'font-size')], ['column', '24px', '44px'])
ok('Instagram e Facebook sulla stessa riga («Instagram · Facebook»), anche sul computer', [D('.piede .col:first-of-type li:nth-child(n+3)', 'display'), D('.piede .col:first-of-type li:nth-child(4)::before', 'content')], ['inline', '" · "'])
ok('telefono: la terza colonna (i link di legge) è più tenue', T('.piede .col+.col+.col', 'opacity'), '.85')

console.log('\n5. Le differenze tolte dopo il primo giro')
ok('menu: bersaglio di almeno 48px, con 16px di imbottitura anche sul computer', [D('.testata nav a', 'min-height'), D('.testata nav a', 'padding')], ['48px', '0 16px'])
ok('telefono: le voci del menu sono alte 48px', T('.testata nav a', 'min-height'), '48px')
ok('il piede non ha la riga «©»', /class="fine"/.test(h), false)
ok('telefono: 16px tra una tessera dei corsi e l’altra', T('.tessere.corsi', 'gap'), '16px')

console.log('\n9. Titoli con una parola lunga non si spezzano a metà')
{
  const titolo = (t) => g.generaSito({ dominio: 'https://officinedellosport.it', pagine: [{ slug: 'home', titolo: 'Home', descrizione: 'd', testo: '<p>x</p>' }, { slug: 'corso', titolo: t, descrizione: 'd', testo: '<p>x</p>' }], menu: [], rinvii: [] })['corso/index.html'].match(/<section class="pagina-hero[^"]*"><div class="intro"><h1([^>]*)>/)?.[1] ?? 'MANCA'
  ok('parole corte: titolo come sempre («Judo», «Contattaci», «Metodo Globale di Autodifesa»)', [titolo('Judo'), titolo('Contattaci'), titolo('Metodo Globale di Autodifesa')], ['', '', ''])
  ok('12 o 13 lettere: classe «lungo» («Preparazione atletica», «Sollevamento pesi»)', [titolo('Preparazione atletica'), titolo('Sollevamento pesi')], [' class="lungo"', ' class="lungo"'])
  ok('14 lettere o più: classe «lunghissimo» («Giocomotricità e psicomotricità»)', titolo('Giocomotricità e psicomotricità'), ' class="lunghissimo"')
  ok('una parola da 10 lettere larghe (M, W contano di più) è «medio»: scende a 175px sul desktop e a 76px sul telefono («Avviamento»)', titolo('Avviamento alle arti marziali'), ' class="medio"')
  const css = pagina().match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? ''
  ok('una parola lunga non rimpicciolisce il titolo: tutte le pagine hanno la stessa misura', /\.interna h1\.(medio|lungo|lunghissimo)\{/.test(css), false)
}

console.log(guai ? `\n✗ ${guai} casi falliti` : '\nTutto a posto.')
process.exit(guai ? 1 : 0)
