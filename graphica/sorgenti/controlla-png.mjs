// Controllo qualità dei PNG: RGBA, lato giusto, angoli trasparenti, solo nero, copertura.
// Uso: node graphica/sorgenti/controlla-png.mjs <file.png>…
import { readFileSync } from 'node:fs'
import { inflateSync } from 'node:zlib'

function leggi(file) {
  const b = readFileSync(file)
  let o = 8, w = 0, h = 0, tipo = 0, idat = []
  while (o < b.length) {
    const n = b.readUInt32BE(o), t = b.toString('ascii', o + 4, o + 8), d = b.subarray(o + 8, o + 8 + n)
    if (t === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); tipo = d[9]; if (d[8] !== 8 || d[12] !== 0) throw new Error('serve 8 bit non interlacciato') }
    if (t === 'IDAT') idat.push(d)
    o += 12 + n
  }
  if (tipo !== 6) throw new Error(`non è RGBA (tipo colore ${tipo})`)
  const raw = inflateSync(Buffer.concat(idat)), bpp = 4, riga = w * bpp, px = Buffer.alloc(h * riga)
  for (let y = 0; y < h; y++) {
    const f = raw[y * (riga + 1)], s = y * (riga + 1) + 1
    for (let x = 0; x < riga; x++) {
      const a = x >= bpp ? px[y * riga + x - bpp] : 0, u = y ? px[(y - 1) * riga + x] : 0, c = x >= bpp && y ? px[(y - 1) * riga + x - bpp] : 0
      const p = a + u - c, pa = Math.abs(p - a), pb = Math.abs(p - u), pc = Math.abs(p - c)
      const pr = pa <= pb && pa <= pc ? a : pb <= pc ? u : c
      px[y * riga + x] = (raw[s + x] + [0, a, u, (a + u) >> 1, pr][f]) & 255
    }
  }
  return { w, h, px }
}

let errori = 0
for (const file of process.argv.slice(2)) {
  const { w, h, px } = leggi(file)
  const A = (x, y) => px[(y * w + x) * 4 + 3]
  const angoli = [A(0, 0), A(w - 1, 0), A(0, h - 1), A(w - 1, h - 1)]
  let pieni = 0, nonNeri = 0, parziali = 0
  for (let i = 0; i < w * h; i++) {
    const a = px[i * 4 + 3]
    if (a > 0) { pieni++; if (a < 255) parziali++; if (px[i * 4] + px[i * 4 + 1] + px[i * 4 + 2] > 0) nonNeri++ }
  }
  const copertura = Math.round((pieni / (w * h)) * 100)
  const guasti = []
  if (w !== h) guasti.push('non quadrato')
  if (angoli.some((a) => a !== 0)) guasti.push('angoli non trasparenti')
  if (nonNeri) guasti.push(`${nonNeri} pixel non neri`)
  if (copertura < 8 || copertura > 70) guasti.push(`copertura ${copertura}% fuori 8–70%`)
  console.log(`${guasti.length ? 'ERRORE' : 'ok    '} ${file}: ${w}x${h} RGBA, copertura ${copertura}%, bordi sfumati ${parziali}px${guasti.length ? ' — ' + guasti.join('; ') : ''}`)
  errori += guasti.length
}
process.exit(errori ? 1 : 0)
