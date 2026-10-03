// Prima di ogni Edit/Write di Claude: ferma le modifiche ai file che non si
// toccano a mano. Uscire con 2 blocca la modifica e manda il motivo a Claude.
//
//   guida/novita.md         la scrive scripts/versione.mjs a ogni pubblicazione
//   "version" package.json  idem: la alza versione.mjs dal titolo delle PR
//   .env                    i segreti di chi lavora: si copia da .env.example
import { readFileSync } from 'node:fs'
import { relative } from 'node:path'

const { tool_input: t = {}, cwd = process.cwd() } = JSON.parse(readFileSync(0, 'utf8'))
const file = relative(process.env.CLAUDE_PROJECT_DIR || cwd, t.file_path ?? '')
const no = (perché) => {
  console.error(`${file}: ${perché}`)
  process.exit(2)
}

if (file === 'guida/novita.md') no('la scrive scripts/versione.mjs a ogni pubblicazione, dal titolo delle PR. Per una novità, scrivi bene il titolo della PR (vedi CLAUDE.md).')
if (file === '.env') no('sono i segreti di chi lavora: non si toccano. Le variabili nuove vanno in .env.example.')

if (file === 'package.json') {
  const versione = (testo) => testo?.match(/"version"\s*:\s*"([^"]*)"/)?.[1]
  const cambia =
    t.content !== undefined
      ? versione(t.content) !== versione(readFileSync(t.file_path, 'utf8'))
      : [t.old_string, t.new_string, ...(t.edits ?? []).flatMap((e) => [e.old_string, e.new_string])].some((s) => /"version"\s*:/.test(s ?? ''))
  if (cambia) no('"version" la alza scripts/versione.mjs quando si pubblica, dal prefisso del titolo della PR (Nuovo: / Risolto:).')
}
