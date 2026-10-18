// confronta.mjs <vero.png> <figcraft.png> <prefisso> [fascia px]: % di pixel diversi per fascia + immagini affiancate
import { spawn } from 'node:child_process'
import { writeFileSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
const [A, B, pre, fascia = '600'] = process.argv.slice(2)
const dir = mkdtempSync(join(tmpdir(), 'figcraft-conf-'))
const b64 = f => 'data:image/png;base64,' + readFileSync(f).toString('base64')
writeFileSync(join(dir, 'c.html'), `<!doctype html><body style="margin:0"><script>
window.fatto = (async () => {
  const carica = s => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = s })
  const a = await carica(${JSON.stringify(b64(A))}), b = await carica(${JSON.stringify(b64(B))})
  const w = Math.min(a.width, b.width), h = Math.min(a.height, b.height)
  const px = i => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.drawImage(i, 0, 0); return x.getImageData(0, 0, w, h).data }
  const da = px(a), db = px(b), F = ${+fascia}, fasce = []
  for (let y0 = 0; y0 < h; y0 += F) {
    let n = 0, tot = 0
    for (let y = y0; y < Math.min(h, y0 + F); y++) for (let x = 0; x < w; x++) { const k = (y * w + x) * 4; tot++
      if (Math.abs(da[k] - db[k]) + Math.abs(da[k+1] - db[k+1]) + Math.abs(da[k+2] - db[k+2]) > 90) n++ }
    fasce.push([y0, +(100 * n / tot).toFixed(1)])
  }
  return { w, h, ha: a.height, hb: b.height, fasce }
})()
</script>`)
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new', '--remote-debugging-port=9335', `--user-data-dir=${dir}/p`, '--no-first-run', '--allow-file-access-from-files', '--disable-gpu', 'about:blank'], { stdio: 'ignore' })
const sleep = ms => new Promise(r => setTimeout(r, ms))
let wsUrl
for (let i = 0; i < 50 && !wsUrl; i++) { try { wsUrl = (await (await fetch('http://127.0.0.1:9335/json')).json()).find(t => t.type === 'page')?.webSocketDebuggerUrl } catch {} ; await sleep(200) }
const ws = new WebSocket(wsUrl); await new Promise(r => ws.addEventListener('open', r, { once: true }))
let id = 0; const at = new Map()
ws.addEventListener('message', m => { const d = JSON.parse(m.data); if (d.id && at.has(d.id)) { at.get(d.id)(d); at.delete(d.id) } })
const cdp = (method, params = {}) => new Promise((ok, no) => { const i = ++id; at.set(i, d => d.error ? no(new Error(d.error.message)) : ok(d.result)); ws.send(JSON.stringify({ id: i, method, params })) })
await cdp('Page.enable'); await cdp('Page.navigate', { url: 'file://' + join(dir, 'c.html') }); await sleep(800)
const r = await cdp('Runtime.evaluate', { expression: 'window.fatto', returnByValue: true, awaitPromise: true })
console.log(JSON.stringify(r.result.value))
ws.close(); chrome.kill()
