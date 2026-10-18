// scatta.mjs <slug> <larghezza> <mobile 0|1> <scala> <uscita.png>: pagina intera del sito vero, per il confronto
import { spawn } from 'node:child_process'
import { writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
const [slug, larg, mob, scala, uscita] = process.argv.slice(2)
const profilo = mkdtempSync(join(tmpdir(), 'figcraft-chrome-'))
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new', '--remote-debugging-port=9334', `--user-data-dir=${profilo}`, '--no-first-run', '--hide-scrollbars', '--disable-gpu', 'about:blank'], { stdio: 'ignore' })
const sleep = ms => new Promise(r => setTimeout(r, ms))
let wsUrl
for (let i = 0; i < 50 && !wsUrl; i++) { try { wsUrl = (await (await fetch('http://127.0.0.1:9334/json')).json()).find(t => t.type === 'page')?.webSocketDebuggerUrl } catch {} ; await sleep(200) }
const ws = new WebSocket(wsUrl); await new Promise(r => ws.addEventListener('open', r, { once: true }))
let id = 0; const at = new Map()
ws.addEventListener('message', m => { const d = JSON.parse(m.data); if (d.id && at.has(d.id)) { at.get(d.id)(d); at.delete(d.id) } })
const cdp = (method, params = {}) => new Promise((ok, no) => { const i = ++id; at.set(i, d => d.error ? no(new Error(d.error.message)) : ok(d.result)); ws.send(JSON.stringify({ id: i, method, params })) })
await cdp('Page.enable')
await cdp('Emulation.setDeviceMetricsOverride', { width: +larg, height: +larg > 800 ? 900 : 844, deviceScaleFactor: 1, mobile: mob === '1' })
await cdp('Page.navigate', { url: `https://www.officinedellosport.it/${slug}${slug ? '/' : ''}` })
await sleep(1500)
const ev = e => cdp('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }).then(r => r.result.value)
await ev(`(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { scrollTo(0, y); await new Promise(r => setTimeout(r, 120)) } scrollTo(0, 0); await document.fonts.ready; await new Promise(r => setTimeout(r, 400)); return 1 })()`)
const h = await ev('document.documentElement.scrollHeight')
const s = await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width: +larg, height: h, scale: +scala } })
writeFileSync(uscita, Buffer.from(s.data, 'base64'))
ws.close(); chrome.kill()
console.log(uscita, larg, h)
