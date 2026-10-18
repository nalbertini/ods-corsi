// ---------------------------------------------------------------------------
// Gli elenchi come li salva il pannello SITO (TipTap): `<li><p>…</p></li>`.
//
//   node scripts/prova-sito-elenchi-tiptap.mjs
//
// Il layout legge le voci come `<li><strong>…`; con il <p> in mezzo i numeri della
// Home, le fasce dei corsi, i dati dei contatti e le pastiglie restavano elenchi
// semplici. Qui ogni pagina vera di docs/sito/ si genera due volte, con gli
// elenchi scritti a mano e nella forma TipTap: il sito deve uscire uguale.
// ---------------------------------------------------------------------------
import { build } from 'esbuild'
import { readdirSync, readFileSync } from 'node:fs'

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
  console.log(va ? '  ✓' : '  ✗', cosa, va ? '' : `— atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto).slice(0, 300)}`)
  if (!va) guai++
}

/** Come TipTap salva un elenco: ogni voce senza elenchi dentro ha il suo <p>. */
const comeTipTap = (html) => html.replace(/<li>((?:(?!<\/?(?:li|ul|ol|p)\b)[\s\S])*)<\/li>/g, '<li><p>$1</p></li>')

const slugs = readdirSync('docs/sito').filter((f) => f.endsWith('.html') && !f.includes('-precedente')).map((f) => f.replace('.html', ''))
const testo = (s) => readFileSync(`docs/sito/${s}.html`, 'utf8').replace(/<(title|meta)\b[^>]*>(<\/title>)?/gi, '').replace(/^[^\S\n]*\n/gm, '').replace(/<title>[^<]*<\/title>/g, '')
const sito = (f) => g.generaSito({
  dominio: 'https://www.officinedellosport.it',
  pagine: slugs.map((s) => ({ slug: s === 'home' ? 'home' : s, titolo: s, descrizione: 'd', testo: f(testo(s)) })),
  menu: [],
  rinvii: [],
  ospitiImmagini: ['https://qfejpnkryrvjubcxvuco.supabase.co/storage/v1/object/public/sito/'],
})

console.log('Elenchi nella forma TipTap = elenchi scritti a mano')
const a = sito((t) => t)
const b = sito(comeTipTap)
for (const s of slugs) {
  const f = s === 'home' ? 'index.html' : `${s}/index.html`
  ok(`${s}: stesso sito`, b[f] === a[f], true)
}
// Le pagine che non hanno elenchi nei testi di docs/sito: la scheda di un istruttore, le nove voci, le foto tonde.
const IMG = 'https://qfejpnkryrvjubcxvuco.supabase.co/storage/v1/object/public/sito/a.jpg'
const nove = `<h2>Perché</h2>${Array.from({ length: 9 }, (_, i) => `<li><strong>${i + 1}0</strong> cose ${i}</li>`).join('').replace(/^/, '<ul>')}</ul>`
const extra = {
  'fabio-berta': { testo: `<img src="${IMG}" alt="Fabio"><ul><li><strong>Corsi</strong> Aikido</li><li><strong>Ruolo</strong> Maestro</li></ul>`, segno: 'scheda-ritratto' },
  'nove-voci': { testo: nove, segno: 'tessera' },
}
const dueVolte = (f) => g.generaSito({ dominio: 'https://www.officinedellosport.it', pagine: [{ slug: 'home', titolo: 'H', descrizione: 'd', testo: '<p>x</p>' }, { slug: 'istruttori', titolo: 'I', descrizione: 'd', testo: '<p>x</p>' }, ...Object.entries(extra).map(([slug, e]) => ({ slug, titolo: slug, descrizione: 'd', testo: f(e.testo) }))], menu: [], rinvii: [], ospitiImmagini: [IMG.replace('a.jpg', '')] })
const x1 = dueVolte((t) => t)
const x2 = dueVolte(comeTipTap)
for (const [slug, e] of Object.entries(extra)) {
  ok(`${slug}: stesso sito`, x2[`${slug}/index.html`] === x1[`${slug}/index.html`], true)
  ok(`${slug}: c'è il box (${e.segno})`, (x2[`${slug}/index.html`] ?? '').includes(e.segno), true)
}
// Un controllo secco, perché «uguali» vale poco se la pagina non ha mai avuto i box.
const home = b['index.html'] ?? ''
ok('home: i quattro numeri sono tessere', (home.match(/class="tessera [a-z]+ numero"/g) ?? []).length > 0, true)

console.log(guai ? `\n✗ ${guai} casi falliti` : '\nTutto a posto.')
process.exit(guai ? 1 : 0)
