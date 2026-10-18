// Fogli di confronto originale | LightCraft | PhotoCraft (6 foto per foglio). Uso: node confronto.mjs
import { chromium } from '/Users/nicola/Automation/Toolkit/node_modules/playwright-core/index.mjs'
import { writeFileSync, readdirSync, rmSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
const qui = import.meta.dirname
const nomi = readdirSync(qui + '/migliorate').filter(f => f.endsWith('.jpg')).sort()
const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' })
const pg = await b.newPage({ viewport: { width: 1500, height: 600 } })
for (let i = 0; i < nomi.length; i += 4) {
  const gruppo = nomi.slice(i, i + 4)
  writeFileSync(qui + '/__c.html', `<body style="margin:0;background:#111;color:#fff;font:12px sans-serif;display:grid;grid-template-columns:repeat(3,490px);gap:6px">${gruppo.map(n => ['originali', 'migliorate', 'photocraft'].map(d => `<figure style="margin:0"><img style="width:490px;height:330px;object-fit:contain;background:#000;display:block" src="${d}/${n}">${d === 'originali' ? 'originale' : d === 'migliorate' ? 'LightCraft' : 'PhotoCraft'} · ${n}</figure>`).join('')).join('')}`)
  await pg.goto(pathToFileURL(qui + '/__c.html').href); await pg.waitForLoadState('load'); await pg.waitForTimeout(1500)
  await pg.screenshot({ path: `${qui}/confronto-${i / 4 + 1}.png`, fullPage: true })
}
rmSync(qui + '/__c.html'); await b.close()
