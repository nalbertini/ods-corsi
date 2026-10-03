// Quando Claude ha finito: se sul ramo è cambiato del TypeScript (rispetto a
// main, o ancora da committare), il controllo dei tipi dell'app e del timer.
// Se non compila, uscire con 2 rimanda Claude al lavoro con gli errori; una
// volta sola, per non girare in tondo (stop_hook_active).
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const { stop_hook_active } = JSON.parse(readFileSync(0, 'utf8') || '{}')
const sh = (c) => execSync(c, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })

let cambiati
try {
  cambiati = sh('git diff --name-only $(git merge-base HEAD origin/main) && git status --porcelain --untracked-files=all')
} catch {
  process.exit(0) // fuori da git, o senza origin/main: niente da dire
}
const ts = (dove) => new RegExp(`(^|\\s)${dove}\\S*\\.tsx?$`, 'm').test(cambiati)

const guai = []
for (const [nome, dove, comando] of [
  ['app', 'src/', 'npm run -s typecheck'],
  ['timer', 'timer/src/', 'npm --prefix timer run -s typecheck'],
]) {
  if (!ts(dove)) continue
  try {
    sh(comando)
  } catch (e) {
    guai.push(`${nome} (${comando}):\n${(e.stdout || '') + (e.stderr || '')}`.trim())
  }
}

if (guai.length && !stop_hook_active) {
  console.error(`Il controllo dei tipi non passa:\n\n${guai.join('\n\n')}`)
  process.exit(2)
}
