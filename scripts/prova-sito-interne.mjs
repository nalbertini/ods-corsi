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
ok('voci del menu: 10px tra loro, quella attuale gialla', [D('.testata nav ul', 'gap'), D('.testata nav a[aria-current]', 'background')], ['10px', 'var(--giallo)'])
ok('pulsante: 48px di altezza, padding 0 26px, 16px', [D('.pulsante.piccolo', 'min-height'), D('.pulsante.piccolo', 'padding'), D('.pulsante.piccolo', 'font-size')], ['48px', '0 26px', '16px'])
ok('telefono: padding 12px sopra e 0 sotto, logo alto 82px', [T('.testata', 'padding'), T('.logo img', 'height')], ['12px var(--margine) 0', '82px'])
ok('telefono: voci su sfondo chiaro, 14px di padding, 16px; l’attuale gialla', [T('.testata nav a', 'background'), T('.testata nav a', 'padding'), T('.testata nav a', 'font-size'), T('.testata nav a[aria-current]', 'background')], ['var(--chiara)', '0 14px', '16px', 'var(--giallo)'])

console.log('\n2. Testata della pagina (hero) delle pagine interne')
ok('solo le pagine interne hanno la classe «interna», la Home no', [conta(h, /class="pagina-hero interna( solo)?"/g), conta(pagina('home'), /class="pagina-hero interna/g)], [1, 0])
ok('desktop: padding 40 e 72px sotto, titolo a sinistra e colonna da 520px a destra', [D('.pagina-hero.interna', 'padding'), D('.pagina-hero.interna', 'grid-template-columns'), D('.pagina-hero.interna', 'align-items')], ['40px var(--margine) 72px', '1fr 520px', 'end'])
ok('titolo da 200px, interlinea .82', [D('.interna h1', 'font-size'), D('.interna h1', 'line-height')], ['200px', '.82'])
ok('frase da 22px con 28px sotto', [D('.interna .intro p', 'font-size'), D('.interna .intro p', 'margin')], ['22px', '0 0 28px'])
ok('telefono: padding 20 e 36px sotto; titolo da 84px; frase 18px; pulsante 52px', [T('.pagina-hero.interna', 'padding'), T('.interna h1', 'font-size'), T('.interna .intro p', 'font-size'), T('.interna .intro .pulsante', 'min-height')], ['20px var(--margine) 36px', '84px', '18px', '52px'])

console.log('\n3. Invito «Prova»')
ok('desktop: 96px sopra, margini della pagina, alto 300px, padding 36px 40px', [D('.invito', 'margin'), D('.invito', 'min-height'), D('.invito', 'padding')], ['96px var(--margine) 6px', '300px', '36px 40px'])
ok('frase da 22px, parola da 170px, nessuna freccia', [D('.invito .frase', 'font-size'), D('.invito .parola', 'font-size'), D('.invito .freccia', 'display')], ['22px', '170px', 'none'])
ok('telefono: 48px sopra, alto 260px, padding 22px, frase 17px, parola 120px', [T('.invito', 'margin-top'), T('.invito', 'min-height'), T('.invito', 'padding'), T('.invito .frase', 'font-size'), T('.invito .parola', 'font-size')], ['48px', '260px', '22px', '17px', '120px'])

console.log('\n4. Piede')
ok('il nome va su due righe: «Officine» e «dello Sport»', /<p class="nome">Officine<br>dello Sport<\/p>/.test(h), true)
ok('desktop: padding 40px, 40px tra le colonne, nome da 56px', [D('.piede', 'padding'), D('.piede', 'gap'), D('.piede .nome', 'font-size')], ['40px', '40px', '56px'])
ok('margini come l’invito, 48px sotto', [D('.piede', 'margin')], ['0 var(--margine) 48px'])
ok('i titoli di colonna sono nascosti alla vista (restano per chi legge lo schermo)', D('.piede h2', 'position'), 'absolute')
ok('telefono: colonna sola, padding 24px, nome da 44px', [T('.piede', 'flex-direction'), T('.piede', 'padding'), T('.piede .nome', 'font-size')], ['column', '24px', '44px'])
ok('Instagram e Facebook sulla stessa riga («Instagram · Facebook»), anche sul computer', [D('.piede .col:first-of-type li:nth-child(n+3)', 'display'), D('.piede .col:first-of-type li:nth-child(4)::before', 'content')], ['inline', '" · "'])
ok('telefono: la terza colonna (i link di legge) è più tenue', T('.piede .col+.col+.col', 'opacity'), '.85')

console.log('\n5. Le differenze tolte dopo il primo giro')
ok('menu: alto come nel design (padding 9px 16px, interlinea normale), non più 44px', [D('.testata nav a', 'min-height'), D('.testata nav a', 'padding'), D('.testata nav a', 'line-height')], ['0', '9px 16px', 'normal'])
ok('telefono: le voci del menu restano alte 44px (nel design)', T('.testata nav a', 'min-height'), '44px')
ok('il piede non ha la riga «©»', /class="fine"/.test(h), false)
ok('telefono: tra le tessere dei corsi 6px, come sul computer', [T('.tessere.corsi', 'gap'), D('.tessere', 'gap')], [null, '6px'])

console.log(guai ? `\n✗ ${guai} casi falliti` : '\nTutto a posto.')
process.exit(guai ? 1 : 0)
