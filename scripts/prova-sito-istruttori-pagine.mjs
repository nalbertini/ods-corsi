// ---------------------------------------------------------------------------
// Le pagine dei singoli istruttori (docs/sito/istruttori), senza browser.
//
//   node scripts/prova-sito-istruttori-pagine.mjs
//
// Sono testi da incollare nel pannello SITO, non codice: la prova controlla che
//  1. la pagina di Maurizio, passata da `generaSito`, abbia la forma del design
//     (in breve a 4 tessere, la sua storia a 3, il percorso a 3, fuori dal tatami);
//  2. nessuna pagina porti recapiti personali (email, telefono, indirizzo di casa);
//  3. ci sia un file per ognuno dei 13 istruttori, con nome e corsi giusti, e che
//     chi non ha ancora il suo testo lo dica col segnaposto «[da scrivere]»
//     (così non si pubblica per sbaglio una pagina vuota);
//  4. il modello abbia gli stessi titoli della pagina di Maurizio.
// ---------------------------------------------------------------------------
import { build } from 'esbuild'
import { existsSync, readdirSync, readFileSync } from 'node:fs'

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
const conta = (x, re) => (x.match(re) || []).length

const DIR = 'docs/sito/istruttori'
const ISTRUTTORI = [
  ['maurizio-innella', 'Maurizio Innella'],
  ['maura-fornetti', 'Maura Fornetti'],
  ['fabio-berta', 'Fabio Berta'],
  ['federico-vuillermin', 'Federico Vuillermin'],
  ['katia-ballabio', 'Katia Ballabio'],
  ['manuel-tagini', 'Manuel Tagini'],
  ['diana-ballabio', 'Diana Ballabio'],
  ['serena-baravalle', 'Serena Baravalle'],
  ['tiziano-bartocci', 'Tiziano Bartocci'],
  ['valerio-busa', 'Valerio Busa'],
  ['giulia-de-chiara', 'Giulia De Chiara'],
  ['elena-merigo', 'Elena Merigo'],
  ['aldo-scollo', 'Aldo Scollo'],
]
const leggi = (f) => (existsSync(f) ? readFileSync(f, 'utf8') : '')
const campo = (md, t) => (md.match(new RegExp(`## ${t}\\s+(.+)`)) || [, ''])[1].trim()
const testo = (md) => (md.match(/```html\n([\s\S]*?)```/) || [, ''])[1]
const pagina = (slug, md) => g.generaSito({ dominio: 'https://officinedellosport.it', pagine: [{ slug: 'home', titolo: 'Home', descrizione: 'd', testo: '<p>Home</p>' }, { slug, titolo: campo(md, 'Titolo'), descrizione: campo(md, 'Descrizione'), testo: testo(md) }], menu: [], rinvii: [] })[`${slug}/index.html`] ?? ''

console.log('\n1. La pagina di Maurizio ha la forma del design')
{
  const md = leggi(`${DIR}/maurizio-innella.md`)
  const h = pagina('maurizio-innella', md)
  const m = h.match(/<main>([\s\S]*)<\/main>/)?.[1] ?? ''
  const sezioni = [...m.matchAll(/<section class="sezione"><h2>([^<]*)<\/h2>([\s\S]*?)<\/section>/g)].map((x) => ({ titolo: x[1], tessere: conta(x[2], /<article class="tessera/g) }))
  ok('il titolo è il nome', campo(md, 'Titolo'), 'Maurizio Innella')
  ok('le sezioni, in ordine, con le loro tessere', sezioni.map((s) => `${s.titolo}:${s.tessere}`), ['In breve:4', 'La sua storia:3', 'Il percorso:3', 'Fuori dal tatami:1', 'Gli altri istruttori:2'])
  ok('«In breve» ha Ruolo, Corsi, Quando e Titoli', ['Ruolo', 'Corsi', 'Quando', 'Titoli'].map((t) => new RegExp(`<h3>${t}</h3>`).test(h)), [true, true, true, true])
  ok('il percorso ha i tre elenchi (federazione, scuola, titoli)', conta(h, /<article class="tessera [a-z]+"><h3>(Federazione e sport|Scuola|Titoli e studi)<\/h3><ul>/g), 3)
  ok('la descrizione è la frase del design', campo(md, 'Descrizione'), 'Maestro di Judo, docente di Educazione Fisica e presidente di A.S.D. Il Centro Judo.')
}

console.log('\n2. Nessun recapito personale')
{
  for (const [slug] of ISTRUTTORI) {
    const md = leggi(`${DIR}/${slug}.md`)
    const t = testo(md) + campo(md, 'Descrizione')
    ok(`${slug}: né email, né telefono, né «via»`, [/[\w.-]+@[\w-]+\.\w+/.test(t), /(?:\+?39)?\s?3\d{2}[\s.]?\d{3}[\s.]?\d{3,4}|\b0\d{1,3}[\s.]?\d{6,8}\b/.test(t), /\b(?:via|viale|corso|piazza)\s+[A-Z]/.test(t.replace(/Via Vittorio Sassi 26/g, ''))], [false, false, false])
  }
}

console.log('\n3. Un file per ognuno dei 13 istruttori')
{
  ok('i file ci sono (13 più il modello)', ISTRUTTORI.map(([s]) => existsSync(`${DIR}/${s}.md`)).concat(existsSync(`${DIR}/modello.md`)).every(Boolean), true)
  ok('nessun file in più', readdirSync(DIR).filter((f) => f.endsWith('.md') && f !== 'README.md' && f !== 'modello.md' && f !== 'modello-scarno.md').sort(), ISTRUTTORI.map(([s]) => `${s}.md`).sort())
  for (const [slug, nome] of ISTRUTTORI) {
    const md = leggi(`${DIR}/${slug}.md`)
    ok(`${slug}: il titolo è «${nome}»`, campo(md, 'Titolo'), nome)
    const segnaposto = /\[da scrivere\]/.test(md)
    ok(`${slug}: o è finita (senza segnaposto) o dice «Stato: da scrivere»`, segnaposto ? /Stato: da scrivere/.test(md) : slug === 'maurizio-innella', slug !== 'maurizio-innella' ? true : true)
  }
  ok('Maurizio è l’unica pagina già scritta', ISTRUTTORI.filter(([s]) => !/\[da scrivere\]/.test(leggi(`${DIR}/${s}.md`))).map(([s]) => s), ['maurizio-innella'])
  ok('le pagine da scrivere non hanno frasi inventate: solo nome, corsi e segnaposto', ISTRUTTORI.slice(1).every(([s]) => !/Maestro|Dan|laurea|diploma/i.test(testo(leggi(`${DIR}/${s}.md`)))), true)
}

console.log('\n4. Il modello ha i titoli della pagina di Maurizio')
{
  const titoli = (md) => [...testo(md).matchAll(/<h[23]>([^<]*)<\/h[23]>/g)].map((m) => m[1])
  const m = titoli(leggi(`${DIR}/maurizio-innella.md`)).filter((t) => !['Mare, montagna e paracadute'].includes(t))
  const mod = titoli(leggi(`${DIR}/modello.md`)).filter((t) => !['Mare, montagna e paracadute'].includes(t))
  ok('stessi h2 e h3 (tranne quelli personali)', mod.filter((t) => m.includes(t)), m)
}

console.log('\n5. I testi da incollare (elenco e scheda scarna) escono come nel design')
{
  const pag = (slug, titolo, testo) => ({ slug, titolo, descrizione: '', testo })
  const elenco = leggi('docs/sito/istruttori.html').replace(/<!doctype[^>]*>|<meta[^>]*>|<title>[^<]*<\/title>/gi, '')
  const scarna = testo(leggi(`${DIR}/modello-scarno.md`)).match(/<ul>[\s\S]*?<\/ul>/)?.[0] ?? ''
  const sito = g.generaSito({ dominio: 'https://officinedellosport.it', pagine: [pag('istruttori', 'Gli istruttori', elenco), pag('fabio-berta', 'Fabio Berta', scarna), pag('maurizio-innella', 'Maurizio Innella', '<p>x</p>'), pag('contatti', 'Contatti', '')], menu: [], rinvii: [] })
  const el = sito['istruttori/index.html']
  ok('l’elenco ha 13 tessere e la tessera d’invito', [conta(el, /<article class="tessera ritratto /g), /ritratto-invito s3/.test(el)], [13, true])
  ok('Maurizio e Fabio sono link (pagine pubblicate), nessun altro', [...el.matchAll(/<h3><a href="([^"]*)"/g)].map((m) => m[1]), ['/maurizio-innella/', '/fabio-berta/'])
  ok('la scheda di Fabio è la scheda scarna con i suoi corsi', [/<h1><span>Fabio<\/span> <span>Berta<\/span><\/h1>/.test(sito['fabio-berta/index.html']), /<h2>Corsi<\/h2><p>Aikido<\/p>/.test(sito['fabio-berta/index.html'])], [true, true])
  const senza = g.generaSito({ dominio: 'https://officinedellosport.it', pagine: [pag('istruttori', 'Gli istruttori', elenco)], menu: [], rinvii: [] })['istruttori/index.html']
  ok('senza le pagine pubblicate, nessun nome è un link (niente 404)', conta(senza, /<h3><a /g), 0)
}

console.log(guai ? `\n✗ ${guai} casi falliti` : '\nTutto a posto.')
process.exit(guai ? 1 : 0)
