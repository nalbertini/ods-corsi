// ---------------------------------------------------------------------------
// Home e Corsi dicono lo stesso di ogni corso: stesse fasce (Bambini · Adulti ·
// Agonisti · Anziani) e stessa età. Non dice cosa significhi «Bambini»: confronta
// solo le due copie in docs/sito.
//
//   node scripts/prova-sito-fasce.mjs
// ---------------------------------------------------------------------------
import { readFileSync } from 'node:fs'

let guai = 0
const ok = (cosa, avuto, voluto) => {
  const va = JSON.stringify(avuto) === JSON.stringify(voluto)
  console.log(va ? '  ✓' : '  ✗', cosa, va ? '' : `— atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`)
  if (!va) guai++
}

/** corso → { fasce, eta }: ogni corso è un <h3><a href="/slug/"> seguito dall'età (primo <p>) e dalle fasce (<p><em>). */
function corsi(file) {
  const h = readFileSync(file, 'utf8')
  const out = {}
  for (const m of h.matchAll(/<h3><a href="\/([a-z0-9-]+)\/">[^<]*<\/a><\/h3>([\s\S]*?)(?=<h3>|<h2>|$)/g)) {
    const eta = m[2].match(/<p>([^<]+)<\/p>/)?.[1].trim() ?? null
    const fasce = m[2].match(/<p><em>([^<]+)<\/em><\/p>/)?.[1].split('·').map((f) => f.trim()) ?? []
    out[m[1]] = { fasce, eta }
  }
  return out
}

const home = corsi('docs/sito/home.html')
const elenco = corsi('docs/sito/corsi.html')
const comuni = Object.keys(home).filter((s) => s in elenco)

console.log('\nHome e Corsi dicono lo stesso')
ok('ci sono corsi in tutte e due le pagine', comuni.length > 0, true)
ok('ogni corso in comune ha età e almeno una fascia', comuni.every((s) => [home, elenco].every((p) => p[s].eta && p[s].fasce.length)), true)
for (const s of comuni) {
  ok(`${s}: stesse fasce`, home[s].fasce, elenco[s].fasce)
  ok(`${s}: stessa età`, home[s].eta, elenco[s].eta)
}

console.log(guai ? `\n✗ ${guai} casi falliti` : '\nTutto a posto.')
process.exit(guai ? 1 : 0)
