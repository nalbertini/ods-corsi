// ---------------------------------------------------------------------------
// La pagina «I nostri corsi» come nel design (docs/design-canvas/sito-rebrand/
// TatamiBlu-Corsi e TatamiBluM-Corsi), senza browser.
//
//   node scripts/prova-sito-corsi.mjs
//
// La regola (docs/sito/corsi.md): ogni `h3` che contiene un link è un corso;
// se lo sono tutti quelli di una sezione, la griglia è «corsi». Il testo prima
// del primo `h2` che contiene `h3` è una sezione senza titolo. Due o più foto
// in fondo all'ultima tessera sono la fascia sotto la griglia.
// Le misure si leggono dal CSS generato (come in prova-sito-aspetto).
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

const FOTO = (n) => `<img src="/foto-${n}.jpg" alt="Foto ${n}">`
const corso = (nome, foto, fasce = ['Bambini', 'Adulti']) =>
  `<h3><a href="/${nome.toLowerCase()}/">${nome}</a></h3>${foto ? FOTO(nome) : ''}<p><strong>Dai 7 anni</strong> Descrizione di ${nome}</p><ul>${fasce.map((f) => `<li>${f}</li>`).join('')}</ul>`
const NOMI = ['Judo', 'Lotta', 'Aikido', 'Pugilato', 'Autodifesa', 'Atletica', 'Gioco', 'Avvio', 'Pesi']
const testo = (nomi = NOMI, coda = '') => `<p>Percorsi per ogni età.</p>${nomi.map((n, i) => corso(n, i % 3 === 0)).join('')}${coda}`

const pagina = (t) => {
  const f = g.generaSito({
    dominio: 'https://officinedellosport.it',
    pagine: [
      { slug: 'home', titolo: 'Home', descrizione: 'd', testo: '<p>Home</p>' },
      { slug: 'corsi', titolo: 'I nostri corsi', descrizione: 'd', testo: t },
    ],
    menu: [],
    rinvii: [],
  })
  return f['corsi/index.html'] ?? ''
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

console.log('\n1. Una sezione senza titolo con le tessere corso')
{
  const h = pagina(testo())
  ok('una sezione, nessun h2', [conta(h, /<section class="sezione[^"]*"/g), conta(main(h), /<h2/g)], [1, 0])
  ok('la griglia è «tessere n-9 corsi»', conta(h, /<div class="tessere n-9 corsi">/g), 1)
  ok('nove tessere corso', conta(h, /<article class="tessera [^"]*\bcorso\b/g), 9)
  ok('il lead sta prima della griglia', h.indexOf('Percorsi per ogni età') < h.indexOf('tessere n-9'), true)
  const col = [...h.matchAll(/<article class="tessera (blu|giallo|inchiostro)/g)].map((m) => m[1])
  ok('colori a righe sfalsate: giallo blu inchiostro / blu inchiostro giallo / inchiostro giallo blu', col,
    ['giallo', 'blu', 'inchiostro', 'blu', 'inchiostro', 'giallo', 'inchiostro', 'giallo', 'blu'])
  ok('senza foto: classe senza-foto (il vuoto di 170px del design)', conta(h, /class="tessera [^"]*\bsenza-foto\b/g), 6)
  ok('le fasce d’età sono pillole con la loro icona', [conta(h, /<ul class="fasce">/g), conta(h, /<li class="bambini">/g), conta(h, /<li class="adulti">/g)], [9, 9, 9])
}

console.log('\n2. Le due foto in fondo sono la fascia, non la foto dell’ultima tessera')
{
  const h = pagina(testo(NOMI, FOTO('a') + FOTO('b')))
  ok('una fascia «foto-fila due fascia» dopo la griglia', conta(h, /<div class="foto-fila due fascia">/g), 1)
  ok('la fascia ha due foto', conta(h.slice(h.indexOf('foto-fila due fascia')), /<figure class="tessera foto">/g), 2)
  const ultima = h.slice(h.lastIndexOf('<article'), h.indexOf('</article>', h.lastIndexOf('<article')))
  ok('l’ultima tessera non ha le foto della fascia', ultima.includes('/foto-a.jpg'), false)
  ok('una sola foto in fondo resta nella tessera', conta(main(pagina(testo(NOMI, FOTO('a')))), /foto-fila/g), 0)
}

console.log('\n3. Fuori dalla regola, niente cambia')
{
  const h3semplici = '<p>Intro</p><h3>Uno</h3><p>a</p><h3>Due</h3><p>b</p>'
  ok('h3 senza link in testo senza h2: colonna, come prima', [conta(pagina(h3semplici), /class="tessere/g), conta(pagina(h3semplici), /class="testo"/g)], [0, 1])
  const conH2 = `<h2>Sezione</h2>${corso('Judo', false)}${corso('Lotta', false)}`
  const h = pagina(conH2)
  ok('con h2 il titolo resta', conta(h, /<h2>Sezione<\/h2>/g), 1)
  ok('un solo h3 senza link tra i corsi: niente «corsi»', conta(pagina(`<h2>S</h2>${corso('Judo', false)}<h3>Senza link</h3><p>x</p>`), /class="tessere [^"]*corsi/g), 0)
}

console.log('\n4. Le misure del design (desktop 1440px, telefono 375px)')
{
  const c = css(pagina(testo(NOMI, FOTO('a') + FOTO('b'))))
  const T = '.corsi .corso'
  ok('tessera: min-height 400px, padding 22px 24px', [dich(c, '.sezione ' + T, 'min-height'), dich(c, T, 'padding')], ['400px', '22px 24px'])
  ok('titolo 50px', dich(c, '.corsi .corso h3', 'font-size'), '50px')
  ok('foto della tessera alta 170px', dich(c, '.corsi .corso img', 'height'), '170px')
  ok('descrizione 17px', dich(c, '.corsi .corso p', 'font-size'), '17px')
  ok('pillole: 14px, riempimento chiara, tondi', [dich(c, 'ul.fasce li', 'font-size'), dich(c, 'ul.fasce li', 'background'), dich(c, 'ul.fasce li', 'border-radius')], ['14px', 'var(--chiara)', '999px'])
  ok('lead 26px peso 500', [dich(c, '.sezione.senza-titolo .colonna p', 'font-size'), dich(c, '.sezione.senza-titolo .colonna p', 'font-weight')], ['26px', '500'])
  ok('fascia alta 620px, due colonne 1fr 420px, 96px sopra', [dich(c, '.corsi + .fascia', 'height'), dich(c, '.corsi + .fascia.due', 'grid-template-columns'), dich(c, '.corsi + .fascia', 'margin-top')], ['620px', '1fr 420px', '96px'])
  ok('telefono: padding 20px, min-height 200px, titolo 38px, foto 150px, descrizione 16px',
    [dich(c, T, 'padding', true), dich(c, '.sezione ' + T, 'min-height', true), dich(c, '.corsi .corso h3', 'font-size', true), dich(c, '.corsi .corso img', 'height', true), dich(c, '.corsi .corso p', 'font-size', true)],
    ['20px', '200px', '38px', '150px', '16px'])
  ok('telefono: lead 18px, fascia alta 260px', [dich(c, '.sezione.senza-titolo .colonna p', 'font-size', true), dich(c, '.corsi + .fascia', 'height', true)], ['18px', '260px'])
}

console.log(guai ? `\n✗ ${guai} casi falliti` : '\nTutto a posto.')
process.exit(guai ? 1 : 0)
