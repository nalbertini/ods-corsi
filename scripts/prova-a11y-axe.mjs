// ---------------------------------------------------------------------------
// La scansione di accessibilità (axe-core) sulle schermate principali, in
// modalità prova, in un Chromium vero (servono layout e contrasti).
//
//   npm run build && node scripts/prova-a11y-axe.mjs
//
// Una violazione grave o bloccante (impact serious/critical) che non è in
// `scripts/a11y-note.json` fa fallire la prova. La lista nota dice per ogni
// voce regola, schermata e motivo: si accorcia correggendo, mai ingrandendo
// per far passare. Le meno gravi si stampano come avvisi.
// ---------------------------------------------------------------------------
import { readFileSync, existsSync } from 'node:fs'
import { chromium } from 'playwright'
import { preview } from 'vite'

// shortcut: la lista è un array di { regola, schermata, motivo }; se cresce, passare a un file per area.
const note = existsSync('scripts/a11y-note.json') ? JSON.parse(readFileSync('scripts/a11y-note.json', 'utf8')) : []
const axe = readFileSync('node_modules/axe-core/axe.min.js', 'utf8')

// Ogni schermata: dove si apre e come ci si arriva (passi = testo di un tasto).
const SCHERMATE = [
  { nome: 'segreteria · da fare', url: 'segreteria/?prova' },
  { nome: 'segreteria · iscritti', url: 'segreteria/?prova', passi: ['Iscritti'] },
  { nome: 'segreteria · contabilità', url: 'segreteria/?prova', passi: ['Contabilità'] },
  { nome: 'segreteria · settimana', url: 'segreteria/?prova', passi: ['Settimana'] },
  { nome: 'segreteria · corsi', url: 'segreteria/?prova', passi: ['Corsi'] },
  { nome: 'tablet · scelta sala', url: 'sala/?prova' },
  { nome: 'tablet · sala', url: 'sala/?prova', passi: ['TATAMI'] },
  { nome: 'area iscritti', url: 'iscritti/?prova' },
  { nome: 'iscrizione · inizio', url: 'iscrizioni/?prova' },
  { nome: 'iscrizione · modulo', url: 'iscrizioni/?prova', passi: ['COMPILA LA RICHIESTA'] },
  { nome: 'timer · home', url: 'timer/' },
]

const server = await preview({ preview: { port: 4399, strictPort: true } })
const browser = await chromium.launch()
let nuove = 0
let note_usate = new Set()

for (const s of SCHERMATE) {
  const pagina = await browser.newPage({ viewport: { width: 1100, height: 800 } })
  await pagina.goto(`http://localhost:4399/${s.url}`)
  await pagina.waitForLoadState('networkidle')
  for (const t of s.passi ?? []) {
    await pagina.getByRole('button', { name: t, exact: false }).or(pagina.getByRole('link', { name: t })).first().click()
    await pagina.waitForTimeout(500)
  }
  await pagina.evaluate(axe)
  const { violations } = await pagina.evaluate(() =>
    // eslint-disable-next-line no-undef
    axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] }),
  )
  for (const v of violations) {
    const grave = v.impact === 'serious' || v.impact === 'critical'
    const voce = note.findIndex((n) => n.regola === v.id && n.schermata === s.nome)
    if (voce >= 0) note_usate.add(voce)
    const stato = voce >= 0 ? 'NOTA' : grave ? 'KO  ' : 'avv '
    if (stato === 'KO  ') nuove++
    console.log(`${stato} ${s.nome} · ${v.id} (${v.impact}, ${v.nodes.length}) — ${v.help}`)
    if (stato !== 'NOTA') console.log(`     ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`)
  }
  if (!violations.length) console.log(`ok   ${s.nome}`)
  await pagina.close()
}

// Una voce della lista che non scatta più è stata corretta: va tolta.
note.forEach((n, i) => {
  if (!note_usate.has(i)) { nuove++; console.log(`KO   voce nota non più necessaria, toglila: ${n.regola} · ${n.schermata}`) }
})

await browser.close()
server.httpServer.close()
process.exit(nuove ? 1 : 0)
