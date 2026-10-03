// La versione nuova, a ogni pubblicazione da main (vedi `.github/workflows/pubblica.yml`).
//
// Legge le PR unite dall'ultima versione (i tag `v*`): il titolo di ognuna è
// la seconda riga del suo commit di merge. Il prefisso del titolo dice cos'è:
//
//   «Nuovo: …»    → Novità,     e la versione sale di minor (0.1.3 → 0.2.0)
//   «Risolto: …»  → Risolto,    patch (0.1.3 → 0.1.4)
//   altro         → Modificato, patch
//
// Alza `version` in package.json (e nel lock), aggiunge la versione in cima a
// `guida/novita.md` e scrive le note della Release nel file passato come
// argomento. Senza PR nuove non tocca niente. In GITHUB_OUTPUT mette
// `versione`, che il workflow usa per il commit, il tag e la Release.
import { execSync } from 'node:child_process'
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs'

const git = (c) => execSync(`git ${c}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()

let base
try {
  base = git('describe --tags --abbrev=0 --match "v*"')
} catch {
  // Nessun tag ancora: conta solo l'ultimo merge.
  base = 'HEAD^'
}

const SEZIONI = [
  ['Novità', /^(nuovo|novità)\s*:\s*/i],
  ['Risolto', /^(risolto|corretto|fix)\s*:\s*/i],
  ['Modificato', /^/],
]

const titoli = git(`log --first-parent --merges --reverse --format=%b%x1e ${base}..HEAD`)
  .split('\x1e')
  .map((b) => b.trim().split('\n')[0]?.trim())
  .filter(Boolean)

if (!titoli.length) {
  console.log(`Nessuna PR unita dopo ${base}: la versione resta quella.`)
  process.exit(0)
}

const voci = Object.fromEntries(SEZIONI.map(([nome]) => [nome, []]))
for (const t of titoli) {
  const [nome, re] = SEZIONI.find(([, re]) => re.test(t))
  const testo = t.replace(re, '')
  voci[nome].push(testo.charAt(0).toUpperCase() + testo.slice(1))
}

const { version } = JSON.parse(readFileSync('package.json', 'utf8'))
const [maj, min, pat] = version.split('.').map(Number)
const nuova = voci['Novità'].length ? `${maj}.${min + 1}.0` : `${maj}.${min}.${pat + 1}`
execSync(`npm version ${nuova} --no-git-tag-version`, { stdio: 'ignore' })

const note = SEZIONI.filter(([nome]) => voci[nome].length)
  .map(([nome]) => `### ${nome}\n\n${voci[nome].map((v) => `- ${v}`).join('\n')}`)
  .join('\n\n')

const giorno = new Date().toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Rome' })
const NOVITA = 'guida/novita.md'
// In cima, prima della versione precedente (o in fondo all'introduzione, la prima volta).
const pagina = readFileSync(NOVITA, 'utf8')
const dove = pagina.search(/^## /m)
const voce = `## ${nuova} — ${giorno}\n\n${note}\n`
writeFileSync(NOVITA, dove < 0 ? `${pagina.trimEnd()}\n\n${voce}` : `${pagina.slice(0, dove)}${voce}\n${pagina.slice(dove)}`)

if (process.argv[2]) writeFileSync(process.argv[2], note + '\n')
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `versione=${nuova}\n`)
console.log(`${version} → ${nuova}\n\n${note}`)
