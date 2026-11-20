// ---------------------------------------------------------------------------
// Le schede aperte al tocco non possono guidare la nostra.
//
//   node scripts/prova-finestre.mjs
//
// `window.open('', '_blank')` apre una scheda vuota che si porta dopo un await
// su un indirizzo (certificato firmato, modulo PDF). 'noopener' farebbe tornare
// null, quindi la riga dopo deve staccare `opener`. Qui: una scansione dei
// sorgenti, perché nei componenti non c'è altro modo di provarlo senza browser.
// ---------------------------------------------------------------------------
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

let guai = 0
const ok = (cosa, avuto, voluto) => {
  const va = JSON.stringify(avuto) === JSON.stringify(voluto)
  console.log(va ? '  ✓' : '  ✗', cosa, va ? '' : `— atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`)
  if (!va) guai++
}

const sorgenti = (dir) =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n)
    return statSync(p).isDirectory() ? sorgenti(p) : /\.tsx?$/.test(n) ? [p] : []
  })

console.log('\nogni scheda vuota aperta al tocco stacca opener')
const vuote = []
const senza = []
for (const f of [...sorgenti('src'), ...sorgenti('timer/src')]) {
  const righe = readFileSync(f, 'utf8').split('\n')
  righe.forEach((r, i) => {
    const m = r.match(/const (\w+) = window\.open\(''/)
    if (!m) return
    vuote.push(`${f}:${i + 1}`)
    if (!new RegExp(`\\b${m[1]}\\.opener = null`).test(righe[i + 1] ?? '')) senza.push(`${f}:${i + 1}`)
  })
}
ok('le schede vuote si trovano (la scansione non è cieca)', vuote.length > 0, true)
ok('nessuna senza opener = null alla riga dopo', senza, [])

console.log(guai ? `\n✗ ${guai} casi falliti` : '\nTUTTO A POSTO')
process.exit(guai ? 1 : 0)
