// Legge le pagine del sito vero con Chrome headless (CDP, nessuna dipendenza)
// e salva per ogni pagina e misura l'albero degli elementi in JSON.
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const OUT = process.argv[2]
const BASE = 'https://www.officinedellosport.it'
const PAGINE = process.argv[3]
  ? process.argv[3].split(',')
  : ['', 'corsi', 'chi-siamo', 'contatti', 'istruttori', 'judo', 'lotta', 'aikido',
     'pre-pugilistica', 'mga-metodo-globale-di-autodifesa', 'preparazione-atletica',
     'sollevamenti-pesi', 'giocomotricita-e-psicomotricita', 'avviamento-alle-arti-marziali',
     'fabio-berta', 'maurizio-innella', 'contributi-pubblici', 'privacy', 'cookie']
const MISURE = [
  { nome: 'desktop', larghezza: 1440, altezza: 900, mobile: false },
  { nome: 'telefono', larghezza: 390, altezza: 844, mobile: true },
]
mkdirSync(OUT, { recursive: true })

// Script che gira dentro la pagina: ritorna l'albero in coordinate di pagina.
const LEGGI = `(() => {
  // Ogni ::before/::after con contenuto diventa un vero <span> con gli stessi stili calcolati,
  // così ha un rettangolo misurabile; gli originali si spengono con content:none.
  (() => {
    const st = document.createElement('style')
    st.textContent = '[data-ods-nascondi]::before,[data-ods-nascondi]::after{content:none!important}'
    document.head.appendChild(st)
    const els = [...document.querySelectorAll('body, body *')]
    for (const el of els) {
      // prima leggo gli stili di entrambi, poi modifico: se spengo il primo, il secondo risulterebbe senza contenuto
      const lette = []
      for (const p of ['::before', '::after']) {
        const pc = getComputedStyle(el, p)
        const c = pc.content
        if (!c || c === 'none' || c === 'normal') continue
        const m = c.match(/^"((?:[^"\\\\]|\\\\.)*)"/)
        const testo = m ? m[1].replace(/\\\\(.)/g, '$1') : ''
        const sp = document.createElement('span')
        for (const prop of pc) sp.style.setProperty(prop, pc.getPropertyValue(prop))
        sp.textContent = testo
        sp.setAttribute('data-ods-pseudo', p)
        lette.push([p, sp])
      }
      for (const [p, sp] of lette) {
        el.setAttribute('data-ods-nascondi', '1')
        if (p === '::before') el.insertBefore(sp, el.firstChild); else el.appendChild(sp)
      }
    }
  })()
  const SALTA = new Set(['SCRIPT','STYLE','NOSCRIPT','HEAD','META','LINK','TEMPLATE'])
  const sx = scrollX, sy = scrollY
  const r2 = n => Math.round(n * 100) / 100
  const box = r => ({ x: r2(r.left + sx), y: r2(r.top + sy), w: r2(r.width), h: r2(r.height) })
  const colore = s => (s && s !== 'transparent' && s !== 'rgba(0, 0, 0, 0)') ? s : null
  const visibile = cs => cs.display !== 'none' && cs.visibility !== 'hidden'
  function testo(el, cs) {
    const out = []
    for (const n of el.childNodes) {
      if (n.nodeType !== 3) continue
      const t = n.textContent.replace(/\\s+/g, ' ')
      if (!t.trim() && !/^pre/.test(cs.whiteSpace)) continue
      const rg = document.createRange(); rg.selectNodeContents(n)
      const rs = [...rg.getClientRects()].filter(r => r.width > 0 && r.height > 0)
      if (!rs.length) continue
      const x0 = Math.min(...rs.map(r => r.left)), y0 = Math.min(...rs.map(r => r.top))
      const x1 = Math.max(...rs.map(r => r.right)), y1 = Math.max(...rs.map(r => r.bottom))
      // righe vere: ogni carattere ha il suo rettangolo; quando scende, vado a capo
      const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.2
      const crg = document.createRange()
      const pre = /^pre/.test(cs.whiteSpace)
      let s = '', ultimaY = null, spazio = true
      const dati = n.data
      for (let i = 0; i < dati.length; i++) {
        let ch = dati[i]
        if (/\\s/.test(ch)) { if (pre) { s += ' '; continue } if (!spazio) { s += ' '; spazio = true } continue }
        crg.setStart(n, i); crg.setEnd(n, i + 1)
        const rc = [...crg.getClientRects()].find(r => r.width > 0)
        if (rc) {
          if (ultimaY !== null && Math.abs(rc.top - ultimaY) > lh * 0.5 && s.length) s = s.replace(/ $/, '') + '\\n'
          ultimaY = rc.top
        }
        if (cs.textTransform === 'uppercase') ch = ch.toUpperCase()
        else if (cs.textTransform === 'lowercase') ch = ch.toLowerCase()
        s += ch; spazio = false
      }
      if (!pre) s = s.replace(/ +$/, '')
      out.push({ tipo: 'testo', testo: s, righe: s.split('\\n').length,
        ...box({ left: x0, top: y0, width: x1 - x0, height: y1 - y0 }),
        stile: {
          famiglia: cs.fontFamily.split(',')[0].replace(/["']/g, '').trim(),
          peso: Number(cs.fontWeight) || 400, corsivo: cs.fontStyle === 'italic',
          corpo: parseFloat(cs.fontSize),
          interlinea: cs.lineHeight === 'normal' ? null : parseFloat(cs.lineHeight),
          spaziatura: cs.letterSpacing === 'normal' ? 0 : parseFloat(cs.letterSpacing),
          allineo: cs.textAlign, sottolineato: cs.textDecorationLine.includes('underline'),
          colore: cs.color, opacita: parseFloat(cs.opacity) } })
    }
    return out
  }
  function bordi(cs) {
    const l = ['Top','Right','Bottom','Left'].map(l => ({ w: parseFloat(cs['border'+l+'Width']), s: cs['border'+l+'Style'], c: cs['border'+l+'Color'] }))
    return l.map(b => (b.s === 'none' || b.w === 0) ? { w: 0, c: null } : { w: b.w, c: colore(b.c) })
  }
  function nodo(el) {
    if (SALTA.has(el.tagName)) return null
    const cs = getComputedStyle(el)
    if (!visibile(cs)) return null
    // il contenuto di un <details> chiuso non si vede (tranne il <summary>)
    const pd = el.parentElement
    if (pd && pd.tagName === 'DETAILS' && !pd.open && el.tagName !== 'SUMMARY') return null
    const r = el.getBoundingClientRect()
    const n = { tipo: 'riquadro', tag: el.tagName.toLowerCase(), classe: el.getAttribute('class') || '',
      ...box(r), figli: [] }
    if (el.id) n.id = el.id
    if (el.tagName === 'A') n.href = el.getAttribute('href')
    if (el.tagName === 'svg' || el instanceof SVGElement && el.ownerSVGElement === null) {
      n.tipo = 'svg'
      const c = el.cloneNode(true)
      c.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
      c.setAttribute('width', r.width); c.setAttribute('height', r.height)
      // currentColor non esiste fuori dalla pagina: lo scrivo.
      n.svg = c.outerHTML.replace(/currentColor/g, cs.color)
      n.opacita = parseFloat(cs.opacity)
      return n
    }
    if (el.tagName === 'IMG') {
      n.tipo = 'immagine'; n.src = el.currentSrc || el.src; n.alt = el.alt || ''
      n.adatta = cs.objectFit; n.posizione = cs.objectPosition
    }
    n.display = cs.display
    n.sfondo = colore(cs.backgroundColor)
    const bi = cs.backgroundImage
    if (bi && bi !== 'none') {
      const m = bi.match(/url\\("?([^")]+)"?\\)/); if (m) n.sfondoImmagine = m[1]
      if (/gradient/.test(bi)) n.gradiente = bi
    }
    n.bordi = bordi(cs)
    n.raggi = ['TopLeft','TopRight','BottomRight','BottomLeft'].map(c => parseFloat(cs['border'+c+'Radius']) || 0)
    n.ombra = cs.boxShadow !== 'none' ? cs.boxShadow : null
    n.opacita = parseFloat(cs.opacity)
    if (cs.mixBlendMode && cs.mixBlendMode !== 'normal') n.fusione = cs.mixBlendMode
    n.taglia = cs.overflow !== 'visible' || cs.overflowX !== 'visible'
    n.posizioneCss = cs.position
    n.trasforma = cs.transform !== 'none' ? cs.transform : null
    if (el.hasAttribute('data-ods-pseudo')) n.pseudo = el.getAttribute('data-ods-pseudo')
    const mk = cs.maskImage && cs.maskImage !== 'none' ? cs.maskImage : (cs.webkitMaskImage !== 'none' ? cs.webkitMaskImage : null)
    if (mk) n.maschera = mk
    // figli in ordine di documento, testi compresi
    for (const c of el.childNodes) {
      if (c.nodeType === 1) { const f = nodo(c); if (f) n.figli.push(f) }
      else if (c.nodeType === 3) { /* i testi si leggono sotto, una volta */ }
    }
    const ts = testo(el, cs)
    if (ts.length) {
      // rimetto i testi fra i figli nell'ordine verticale/orizzontale
      n.figli.push(...ts)
      n.figli.sort((a, b) => (a.y - b.y) || (a.x - b.x))
    }
    return n
  }
  const radice = nodo(document.body)
  return JSON.stringify({ titolo: document.title, larghezza: document.documentElement.scrollWidth,
    altezza: document.documentElement.scrollHeight, radice })
})()`

const profilo = mkdtempSync(join(tmpdir(), 'figcraft-chrome-'))
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--headless=new', '--remote-debugging-port=9333', `--user-data-dir=${profilo}`,
  '--no-first-run', '--hide-scrollbars', '--disable-gpu', 'about:blank'], { stdio: 'ignore' })

const aspetta = ms => new Promise(r => setTimeout(r, ms))
async function connetti() {
  for (let i = 0; i < 50; i++) {
    try {
      const lista = await (await fetch('http://127.0.0.1:9333/json')).json()
      const p = lista.find(t => t.type === 'page')
      if (p) return p.webSocketDebuggerUrl
    } catch { /* Chrome non è ancora su */ }
    await aspetta(200)
  }
  throw new Error('Chrome non risponde')
}
const ws = new WebSocket(await connetti())
await new Promise(r => ws.addEventListener('open', r, { once: true }))
let id = 0
const attese = new Map()
ws.addEventListener('message', m => {
  const d = JSON.parse(m.data)
  if (d.id && attese.has(d.id)) { attese.get(d.id)(d); attese.delete(d.id) }
})
const cdp = (method, params = {}) => new Promise((ok, no) => {
  const i = ++id
  attese.set(i, d => d.error ? no(new Error(method + ': ' + d.error.message)) : ok(d.result))
  ws.send(JSON.stringify({ id: i, method, params }))
})
const valuta = async expr => {
  const r = await cdp('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 400))
  return r.result.value
}

await cdp('Page.enable')
try {
  for (const m of MISURE) {
    await cdp('Emulation.setDeviceMetricsOverride', { width: m.larghezza, height: m.altezza, deviceScaleFactor: 1, mobile: m.mobile })
    for (const p of PAGINE) {
      const url = `${BASE}/${p}${p ? '/' : ''}`
      await cdp('Page.navigate', { url })
      await aspetta(1500)
      // scorro fino in fondo per far caricare le immagini pigre, poi torno su
      await valuta(`(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { scrollTo(0, y); await new Promise(r => setTimeout(r, 120)) } scrollTo(0, 0); await document.fonts.ready; await Promise.all([...document.images].map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r }))); await new Promise(r => setTimeout(r, 300)); return 1 })()`)
      const json = await valuta(LEGGI)
      const nome = `${p || 'home'}.${m.nome}.json`
      writeFileSync(join(OUT, nome), json)
      const d = JSON.parse(json)
      console.log(nome, d.larghezza + '×' + d.altezza)
    }
  }
} finally {
  ws.close(); chrome.kill()
}
