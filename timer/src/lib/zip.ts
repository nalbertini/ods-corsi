/**
 * Scrittore ZIP minimo, senza compressione (metodo «store»).
 *
 * Serve solo a impacchettare le clip per portarle da un telefono al
 * repository: l'audio è già compresso, quindi comprimere di nuovo non
 * guadagnerebbe nulla, e questo evita una dipendenza esterna per settanta
 * righe di formato.
 */

const TABLE = (() => {
  const t = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[i] = c >>> 0
  }
  return t
})()

export function crc32(data: Uint8Array): number {
  let c = 0xffffffff
  for (let i = 0; i < data.length; i++) c = TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

interface Entry {
  name: string
  data: Uint8Array<ArrayBuffer>
}

export function zipStore(files: Entry[]): Blob {
  const enc = new TextEncoder()
  const chunks: Uint8Array<ArrayBuffer>[] = []
  const central: Uint8Array<ArrayBuffer>[] = []
  let offset = 0

  const header = (size: number) => {
    const b = new Uint8Array(new ArrayBuffer(size))
    return { b, v: new DataView(b.buffer) }
  }

  for (const f of files) {
    const name = enc.encode(f.name)
    const crc = crc32(f.data)

    // Intestazione locale: 30 byte fissi, poi il nome.
    const { b: local, v } = header(30 + name.length)
    v.setUint32(0, 0x04034b50, true)
    v.setUint16(4, 20, true) // versione necessaria
    v.setUint16(6, 0x0800, true) // nomi in UTF-8
    v.setUint16(8, 0, true) // metodo: nessuna compressione
    v.setUint16(10, 0, true) // ora
    v.setUint16(12, 0x21, true) // data: 1980-01-01, non ci interessa
    v.setUint32(14, crc, true)
    v.setUint32(18, f.data.length, true)
    v.setUint32(22, f.data.length, true)
    v.setUint16(26, name.length, true)
    v.setUint16(28, 0, true)
    local.set(name, 30)

    chunks.push(local, f.data)

    const { b: dir, v: dv } = header(46 + name.length)
    dv.setUint32(0, 0x02014b50, true)
    dv.setUint16(4, 20, true)
    dv.setUint16(6, 20, true)
    dv.setUint16(8, 0x0800, true)
    dv.setUint16(10, 0, true)
    dv.setUint16(12, 0, true)
    dv.setUint16(14, 0x21, true)
    dv.setUint32(16, crc, true)
    dv.setUint32(20, f.data.length, true)
    dv.setUint32(24, f.data.length, true)
    dv.setUint16(28, name.length, true)
    dv.setUint32(42, offset, true)
    dir.set(name, 46)
    central.push(dir)

    offset += local.length + f.data.length
  }

  const centralSize = central.reduce((n, c) => n + c.length, 0)
  const { b: end, v: ev } = header(22)
  ev.setUint32(0, 0x06054b50, true)
  ev.setUint16(8, files.length, true)
  ev.setUint16(10, files.length, true)
  ev.setUint32(12, centralSize, true)
  ev.setUint32(16, offset, true)

  return new Blob([...chunks, ...central, end], { type: 'application/zip' })
}
