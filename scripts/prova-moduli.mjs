// ---------------------------------------------------------------------------
// I moduli PDF si aprono e si leggono.
//
//   node scripts/prova-moduli.mjs [cartella…]
//
// Passa da `pdfcraft-cli check` i fogli di `public/moduli/` (e ogni PDF futuro
// messo lì) e i moduli firmati che l'app produce (`prova-firma.mjs`). Il
// comando esce con 0 anche su un file rotto: il verdetto si legge dal suo
// JSON, un file alla volta. Con delle cartelle in più, controlla anche quelle.
// Senza `pdfcraft-cli` in locale la prova si salta; in CI, dove il passo che
// lo installa c'è sempre, manca = fallisce.
// ---------------------------------------------------------------------------
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

let guai = 0
const ok = (cosa, avuto, voluto) => {
  const va = JSON.stringify(avuto) === JSON.stringify(voluto)
  console.log(va ? '  ✓' : '  ✗', cosa, va ? '' : `— atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`)
  if (!va) guai++
}

const prova = spawnSync('pdfcraft-cli', ['--version'], { encoding: 'utf8' })
if (prova.error) {
  // In CI il passo di installazione c'è sempre: se il comando manca, la prova non può passare in silenzio.
  if (process.env.CI) {
    console.log('  ✗ pdfcraft-cli manca in CI: il passo che lo installa non ha funzionato')
    process.exit(1)
  }
  console.log('  - pdfcraft-cli non c\'è: prova saltata (si installa da getartcraft.com/apps/pdfcraft)')
  process.exit(0)
}

const lavoro = mkdtempSync(join(tmpdir(), 'moduli-'))
const firmati = join(lavoro, 'firmati')
mkdirSync(firmati) // prova-firma scrive nella cartella, non la crea
execFileSync('node', ['scripts/prova-firma.mjs', firmati], { stdio: ['ignore', 'ignore', 'inherit'] }) // lo stderr si vede: se cade, si capisce perché

/** Un file alla volta: `pdfcraft-cli check` non esce con errore da solo. */
function controlla(cartella, nome) {
  const json = join(lavoro, `${nome}.json`)
  spawnSync('pdfcraft-cli', ['check', cartella, '--json', json], { stdio: 'ignore' })
  let righe
  try {
    righe = JSON.parse(readFileSync(json, 'utf8'))
  } catch {
    ok(`${cartella}: il controllo non ha prodotto un risultato`, false, true)
    return
  }
  ok(`${cartella}: c'è almeno un PDF`, righe.length > 0, true)
  for (const r of righe)
    ok(`${r.file}: si apre e si legge${r.status === 'ok' ? '' : ` (${r.detail})`}`, r.status, 'ok')
}

console.log('\nI fogli da scaricare')
controlla('public/moduli', 'fogli')
console.log('\nI moduli firmati dall\'app')
controlla(firmati, 'firmati')
process.argv.slice(2).forEach((c, i) => {
  console.log(`\n${c}`)
  controlla(c, `extra${i}`)
})

rmSync(lavoro, { recursive: true, force: true })
console.log(guai ? `\n${guai} cose non tornano` : '\nTutto torna')
process.exit(guai ? 1 : 0)
