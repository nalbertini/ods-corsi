import { chromium } from '/Users/nicola/Automation/Toolkit/node_modules/playwright-core/index.mjs'
import { writeFileSync } from 'node:fs'
const out = 'docs/proposte-home/corso/audit/img/'
const pagine = process.argv.slice(2)
const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' })
const res = {}
for (const p of pagine) for (const w of [1440, 768, 375]) {
  const c = await b.newContext({ viewport: { width: w, height: 900 }, deviceScaleFactor: 1 })
  const pg = await c.newPage()
  await pg.addInitScript(() => { window.__cls = 0; new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value }).observe({ type: 'layout-shift', buffered: true }) })
  await pg.goto('https://www.officinedellosport.it/' + p + '/', { waitUntil: 'networkidle' })
  await pg.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { scrollTo(0, y); await new Promise(r => setTimeout(r, 120)) } scrollTo(0, 0) })
  await pg.waitForTimeout(800)
  const m = await pg.evaluate(() => {
    const r = (e) => { const b = e.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y + scrollY), w: Math.round(b.width), h: Math.round(b.height) } }
    const imgs = [...document.images].map(i => ({ src: i.src.split('/').pop().slice(0, 12), alt: i.alt, nat: i.naturalWidth + 'x' + i.naturalHeight, ...r(i), wa: i.getAttribute('width'), ha: i.getAttribute('height'), lazy: i.loading, op: getComputedStyle(i).objectPosition }))
    const small = [...document.querySelectorAll('a,button,input,select,summary,[role=button]')].filter(e => { const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0 && (b.height < 44 || b.width < 44) }).map(e => ({ t: (e.textContent || e.ariaLabel || '').trim().slice(0, 24), ...r(e) }))
    const hs = [...document.querySelectorAll('h1,h2,h3')].map(e => ({ t: e.tagName, x: e.textContent.trim().slice(0, 40), fs: parseFloat(getComputedStyle(e).fontSize), ...r(e) }))
    const secs = [...document.querySelectorAll('main > *, main section')].map(e => ({ tag: e.tagName + '.' + (e.className || '').toString().slice(0, 20), ...r(e) }))
    return { H: document.documentElement.scrollHeight, sw: document.documentElement.scrollWidth, cls: window.__cls, imgs, small, hs, secs, title: document.title, lang: document.documentElement.lang, h1n: document.querySelectorAll('h1').length, bodyfs: getComputedStyle(document.body).fontSize, dark: matchMedia('(prefers-color-scheme: dark)').matches }
  })
  res[p + '-' + w] = m
  await pg.screenshot({ path: out + `${p}-${w}-full.png`, fullPage: true })
  await c.close()
}
writeFileSync('/private/tmp/claude-501/-Users-nicola-Automation-ods-corsi--claude-worktrees-recursing-solomon-b31bca/e85f20e2-43d6-42f8-b9d5-efdd3c2c3be8/scratchpad/audit.json', JSON.stringify(res, null, 1))
await b.close()
