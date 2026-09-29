import type { PDFFont, PDFPage } from 'pdf-lib'
import { scrivibileCon } from './firma'
import { conti, dataRicevuta, euro, type Ricevuta, type VoceRicevuta } from './ricevute'

/**
 * Il PDF di una ricevuta, com'era quello del programma di prima: un A4 in
 * orizzontale con due copie uguali affiancate, una per il socio e una per
 * l'associazione, da tagliare a metà.
 *
 * In testa l'associazione e, a destra, numero, data e tipo di documento; sotto
 * i dati del socio; poi le voci, ognuna con da quando a quando vale e il
 * riepilogo dei pagamenti; in fondo i totali e la dicitura dell'esenzione.
 * Se le voci non ci stanno in una pagina, si va a una seconda, con la stessa
 * testa, e i totali stanno sull'ultima.
 *
 * Le misure sono in punti PDF contati dall'alto (`y` qui sotto li gira).
 */

const PAGINA = { w: 841.89, h: 595.28 }
const MARGINE = 40
const COPIA = (PAGINA.w - 2 * MARGINE - 22) / 2
const DOVE_COPIE = [MARGINE, PAGINA.w - MARGINE - COPIA]

/** Dove comincia e finisce lo spazio delle voci, e dove stanno i riquadri sotto. */
const VOCI = { da: 252, a: 466 }
const TOTALI = { da: 472, a: 532 }
const DICITURA = { da: 532, a: 578 }

const RIGA_VOCE = 13
const RIGA_PAGAMENTO = 11

/** Quanto è alta una voce, con le sue righe. */
const altezza = (v: VoceRicevuta) => RIGA_VOCE + (v.dal || v.al ? RIGA_VOCE : 0) + (v.pagamenti.length ? RIGA_PAGAMENTO * (1 + v.pagamenti.length) : 0) + 5

/** Le voci divise in pagine: quante ne stanno nello spazio, almeno una per pagina. */
export function pagineDelleVoci(voci: VoceRicevuta[]): VoceRicevuta[][] {
  const pagine: VoceRicevuta[][] = [[]]
  let usato = 0
  for (const v of voci) {
    const h = altezza(v)
    if (usato + h > VOCI.a - VOCI.da && pagine[pagine.length - 1].length) {
      pagine.push([])
      usato = 0
    }
    pagine[pagine.length - 1].push(v)
    usato += h
  }
  return pagine
}

const prezzo = (cent: number) => `€${euro(cent)}`

export async function ricevutaPdf(r: Ricevuta): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb, degrees } = await import('pdf-lib')
  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const grassetto = await pdf.embedFont(StandardFonts.HelveticaBold)
  const nero = rgb(0, 0, 0)
  const bianco = rgb(1, 1, 1)
  const scrivibile = scrivibileCon(font)
  const c = conti(r)
  const pagine = pagineDelleVoci(r.voci)

  const y = (t: number) => PAGINA.h - t

  /** Una riga di testo che non esce da `largo`: se è lunga, si rimpicciolisce. */
  const testo = (p: PDFPage, s: string | undefined, x: number, t: number, o: { corpo?: number; f?: PDFFont; largo?: number; destra?: boolean; colore?: ReturnType<typeof rgb> } = {}) => {
    const f = o.f ?? font
    const riga = scrivibile((s ?? '').replace(/\s+/g, ' ').trim())
    if (!riga) return
    let corpo = o.corpo ?? 9
    while (o.largo && corpo > 5 && f.widthOfTextAtSize(riga, corpo) > o.largo) corpo -= 0.25
    const w = f.widthOfTextAtSize(riga, corpo)
    p.drawText(riga, { x: o.destra ? x - w : x, y: y(t), size: corpo, font: f, color: o.colore ?? nero })
  }

  /** Un testo lungo andando a capo, dentro `largo`, fino a `righe` righe. */
  const paragrafo = (p: PDFPage, s: string, x: number, t: number, largo: number, corpo: number, interlinea: number, righe = 99) => {
    const parole = scrivibile(s.replace(/\s+/g, ' ').trim()).split(' ')
    const fatte: string[] = []
    let riga = ''
    for (const w of parole) {
      const prova = riga ? `${riga} ${w}` : w
      if (font.widthOfTextAtSize(prova, corpo) > largo && riga) {
        fatte.push(riga)
        riga = w
      } else riga = prova
    }
    if (riga) fatte.push(riga)
    fatte.slice(0, righe).forEach((l, i) => p.drawText(l, { x, y: y(t + i * interlinea), size: corpo, font, color: nero }))
  }

  const riquadro = (p: PDFPage, x: number, da: number, a: number, w = COPIA) =>
    p.drawRectangle({ x, y: y(a), width: w, height: a - da, borderColor: nero, borderWidth: 0.75 })
  const linea = (p: PDFPage, x1: number, x2: number, t: number) => p.drawLine({ start: { x: x1, y: y(t) }, end: { x: x2, y: y(t) }, thickness: 0.75, color: nero })

  const copia = (p: PDFPage, x: number, voci: VoceRicevuta[], ultima: boolean, n: number) => {
    // L'associazione, e a destra numero, data e tipo.
    const e = r.ente
    riquadro(p, x, 20, 118)
    const destra = x + COPIA - 120
    p.drawLine({ start: { x: destra, y: y(20) }, end: { x: destra, y: y(118) }, thickness: 0.75, color: nero })
    testo(p, e.nome, x + 14, 46, { corpo: 12, f: grassetto, largo: destra - x - 24 })
    testo(p, e.indirizzo, x + 14, 62, { corpo: 10, largo: destra - x - 24 })
    testo(p, `${e.cap} ${e.comune}`, x + 14, 76, { corpo: 10, largo: destra - x - 24 })
    testo(p, 'C.F.:', x + 14, 92, { corpo: 9, f: grassetto })
    testo(p, e.codiceFiscale, x + 44, 92, { corpo: 10 })
    if (e.partitaIva) {
      testo(p, 'P.IVA:', x + 14, 106, { corpo: 9, f: grassetto })
      testo(p, e.partitaIva, x + 44, 106, { corpo: 10 })
    }
    const celle: Array<[string, string]> = [
      ['Numero', pagine.length > 1 ? `${r.numero} · pag. ${n}/${pagine.length}` : String(r.numero)],
      ['Data', dataRicevuta(r.data)],
      ['Tipo Documento', 'Ricevuta Semplice'],
    ]
    celle.forEach(([etichetta, valore], i) => {
      const t = 20 + i * 32.7
      if (i) linea(p, destra, x + COPIA, t)
      testo(p, etichetta, destra + 5, t + 11, { corpo: 7.5, f: grassetto })
      testo(p, valore, destra + 5, t + 24, { corpo: 9.5, largo: 110 })
    })

    // Il socio.
    const s = r.intestatario
    riquadro(p, x, 124, 222)
    testo(p, 'Dati Identificativi del Socio', x + 5, 135, { corpo: 7.5, f: grassetto })
    testo(p, `${s.cognome} ${s.nome}`.toUpperCase(), x + 10, 150, { corpo: 9.5, largo: COPIA - 20 })
    testo(p, (s.indirizzo ?? '').toUpperCase(), x + 10, 164, { corpo: 9.5, largo: COPIA - 20 })
    testo(p, s.cap, x + 10, 178, { corpo: 9.5 })
    testo(p, s.comune, x + 50, 178, { corpo: 8, largo: 120 })
    testo(p, s.provincia?.toUpperCase(), x + 180, 178, { corpo: 9.5 })
    testo(p, 'Nato Il', x + 215, 178, { corpo: 8.5, f: grassetto })
    testo(p, dataRicevuta(s.natoIl), x + 248, 178, { corpo: 9.5 })
    testo(p, 'C.F.', x + 10, 192, { corpo: 8.5, f: grassetto })
    testo(p, s.codiceFiscale, x + 36, 192, { corpo: 9.5, largo: 170 })
    testo(p, 'P.IVA', x + 215, 192, { corpo: 8.5, f: grassetto })
    testo(p, s.partitaIva, x + 248, 192, { corpo: 9.5, largo: COPIA - 258 })
    testo(p, 'Genitore', x + 10, 206, { corpo: 8.5, f: grassetto })
    testo(p, s.genitore?.toUpperCase(), x + 50, 206, { corpo: 9.5, largo: 160 })
    testo(p, 'C.F.', x + 215, 206, { corpo: 8.5, f: grassetto })
    testo(p, s.genitoreCodiceFiscale, x + 238, 206, { corpo: 9.5, largo: COPIA - 248 })

    // La barra nera delle voci.
    const q = x + COPIA - 100
    const pr = x + COPIA - 8
    p.drawRectangle({ x, y: y(240), width: COPIA, height: 14, color: nero })
    testo(p, 'Addebito', x + 4, 236, { corpo: 7.5, f: grassetto, colore: bianco })
    testo(p, 'Q', q, 236, { corpo: 7.5, f: grassetto, colore: bianco })
    testo(p, 'Prezzo', pr, 236, { corpo: 7.5, f: grassetto, colore: bianco, destra: true })

    // Le voci, ognuna col suo riepilogo dei pagamenti.
    let t = VOCI.da
    for (const v of voci) {
      t += RIGA_VOCE - 3
      testo(p, v.descrizione, x + 10, t, { corpo: 9, largo: q - x - 20 })
      testo(p, String(v.quantita), q + 2, t, { corpo: 9 })
      testo(p, prezzo(v.quantita * v.prezzo), pr, t, { corpo: 9, destra: true })
      t += 3
      if (v.dal || v.al) {
        t += RIGA_VOCE
        testo(p, `Valevole ${v.dal ? `dal ${dataRicevuta(v.dal)} ` : ''}${v.al ? `al ${dataRicevuta(v.al)}` : ''}`, x + 10, t - 3, { corpo: 8.5 })
      }
      if (v.pagamenti.length) {
        t += RIGA_PAGAMENTO
        testo(p, 'Riepilogo Pagamenti', x + 14, t - 1, { corpo: 7.5, f: grassetto })
        for (const pg of v.pagamenti) {
          t += RIGA_PAGAMENTO
          testo(p, dataRicevuta(pg.data), x + 22, t - 1, { corpo: 8.5 })
          testo(p, prezzo(pg.importo), x + 130, t - 1, { corpo: 8.5, destra: true })
          testo(p, 'Pagato', x + 134, t - 1, { corpo: 8.5 })
          testo(p, pg.metodo, x + 180, t - 1, { corpo: 8.5, largo: COPIA - 190 })
        }
      }
      t += 5
    }

    // I totali e la dicitura, sull'ultima pagina; sulle altre, che si continua.
    riquadro(p, x, TOTALI.da, TOTALI.a)
    testo(p, 'Note', x + 5, TOTALI.da + 11, { corpo: 7.5, f: grassetto })
    if (!ultima) {
      testo(p, `Continua a pagina ${n + 1}`, x + COPIA - 8, TOTALI.da + 32, { corpo: 9, destra: true })
    } else {
      if (r.note) paragrafo(p, r.note, x + 5, TOTALI.da + 22, 160, 7.5, 9, 4)
      const et = x + 190
      const righe: Array<[string, number]> = [
        ['Totale Documento', c.totale],
        ['Anticipo', r.anticipo],
        ['Netto a Pagare', c.netto],
      ]
      righe.forEach(([etichetta, cent], i) => {
        testo(p, etichetta, et, TOTALI.da + 16 + i * 17, { corpo: 8, f: grassetto })
        testo(p, `${euro(cent)} €`, x + COPIA - 6, TOTALI.da + 16 + i * 17, { corpo: 9, destra: true })
      })
    }
    riquadro(p, x, DICITURA.da, DICITURA.a)
    paragrafo(p, r.ente.dicitura, x + 5, DICITURA.da + 11, COPIA - 10, 8, 10, 4)

    // Annullata: si vede da lontano, e non vale come ricevuta.
    if (r.annullataIl) {
      p.drawText('ANNULLATA', { x: x + 55, y: y(470), size: 44, font: grassetto, color: rgb(0.85, 0.1, 0.1), opacity: 0.35, rotate: degrees(25) })
    }
  }

  pagine.forEach((voci, i) => {
    const p = pdf.addPage([PAGINA.w, PAGINA.h])
    for (const x of DOVE_COPIE) copia(p, x, voci, i === pagine.length - 1, i + 1)
  })

  pdf.setTitle(`Ricevuta ${r.numero}/${r.anno} · ${r.intestatario.cognome} ${r.intestatario.nome}`)
  pdf.setAuthor(r.ente.nome)
  pdf.setCreationDate(new Date(r.creataIl))
  return pdf.save()
}

/** Il PDF scaricato dal browser, col suo nome. */
export async function scaricaRicevuta(r: Ricevuta, nome: string) {
  const byte = await ricevutaPdf(r)
  const url = URL.createObjectURL(new Blob([byte as BlobPart], { type: 'application/pdf' }))
  const a = document.createElement('a')
  a.href = url
  a.download = nome
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
