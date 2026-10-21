import type { PDFDocument, PDFFont, PDFPage } from 'pdf-lib'
import { scrivibileCon } from './firma'
import { aCapo } from './letteraPdf'
import { testoRicevutaCompenso, type DatiRicevutaCompenso } from './compensi'

/**
 * Il PDF della ricevuta del compenso: l'autocertificazione e la liquidazione
 * su A4 in verticale, da stampare e far firmare. Il testo lo dà
 * `testoRicevutaCompenso`; qui l'impaginato e le caselle, che Helvetica non
 * ha e quindi si disegnano. Più ricevute stanno in un PDF solo, ognuna dalla
 * sua pagina.
 */

const PAGINA = { w: 595.28, h: 841.89 }
const MARGINE = 48
const LARGO = PAGINA.w - 2 * MARGINE
const CORPO = 9
const RIGA = 12
const FONDO = PAGINA.h - 48

/** Le righe che sono titoli: in grassetto, con lo spazio sopra. */
const TITOLI = /^(AUTOCERTIFICAZIONE|DICHIARA|RICHIEDE|LIQUIDAZIONE|NETTO A PAGARE)/

async function scriviRicevuta(pdf: PDFDocument, r: DatiRicevutaCompenso, font: PDFFont, grassetto: PDFFont) {
  const { rgb } = await import('pdf-lib')
  const nero = rgb(0, 0, 0)
  const scrivibile = scrivibileCon(font)
  let pagina: PDFPage = pdf.addPage([PAGINA.w, PAGINA.h])
  let y = MARGINE
  const spazio = (h: number) => {
    if (y + h > FONDO) {
      pagina = pdf.addPage([PAGINA.w, PAGINA.h])
      y = MARGINE
    }
  }
  const scrivi = (testo: string, x: number, f: PDFFont) => {
    spazio(RIGA)
    pagina.drawText(testo, { x, y: PAGINA.h - y - CORPO, size: CORPO, font: f, color: nero })
    y += RIGA
  }
  for (const riga of testoRicevutaCompenso(r)) {
    const casella = /^([☐☒]) (.*)$/.exec(riga)
    if (casella) {
      const righe = aCapo(scrivibile(casella[2]), font, CORPO, LARGO - 18)
      spazio(RIGA)
      // La casella: un quadrato, con la X se è barrata.
      const yq = PAGINA.h - y - CORPO
      pagina.drawRectangle({ x: MARGINE, y: yq - 1, width: 8, height: 8, borderColor: nero, borderWidth: 0.8 })
      if (casella[1] === '☒') {
        pagina.drawLine({ start: { x: MARGINE, y: yq - 1 }, end: { x: MARGINE + 8, y: yq + 7 }, thickness: 0.8, color: nero })
        pagina.drawLine({ start: { x: MARGINE, y: yq + 7 }, end: { x: MARGINE + 8, y: yq - 1 }, thickness: 0.8, color: nero })
      }
      righe.forEach((t) => scrivi(t, MARGINE + 18, font))
      y += 2
      continue
    }
    const titolo = TITOLI.test(riga)
    if (titolo) y += RIGA / 2
    for (const t of aCapo(scrivibile(riga), titolo ? grassetto : font, CORPO, LARGO)) scrivi(t, MARGINE, titolo ? grassetto : font)
    if (riga.startsWith('Collegno,') || riga.startsWith('DATA PAGAMENTO')) y += RIGA
    y += 2
  }
}

/** Il PDF di più ricevute, una dopo l'altra: per stampare quelle del mese in una volta. */
export async function ricevuteCompensiPdf(rs: DatiRicevutaCompenso[]): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts } = await import('pdf-lib')
  const pdf = await PDFDocument.create()
  pdf.setTitle(rs.length === 1 ? `Compenso ${rs[0].mese.slice(0, 7)} · ${rs[0].tecnico.cognome} ${rs[0].tecnico.nome}`.trim() : `Compensi ${rs[0]?.mese.slice(0, 7) ?? ''}`)
  pdf.setAuthor('ASD IL CENTRO JUDO')
  pdf.setCreator('ODS Corsi')
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const grassetto = await pdf.embedFont(StandardFonts.HelveticaBold)
  for (const r of rs) await scriviRicevuta(pdf, r, font, grassetto)
  return pdf.save()
}

export const ricevutaCompensoPdf = (r: DatiRicevutaCompenso) => ricevuteCompensiPdf([r])

/** Scarica il PDF: «compensi-2026-10.pdf» per più ricevute, «compenso-2026-10-ballabio-diana.pdf» per una. */
export async function scaricaRicevuteCompensi(rs: DatiRicevutaCompenso[]) {
  const byte = await ricevuteCompensiPdf(rs)
  const chi = (r: DatiRicevutaCompenso) =>
    [r.tecnico.cognome, r.tecnico.nome].filter((x) => x.trim()).join('-').toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/[^a-z0-9]+/g, '-')
  const nome = rs.length === 1 ? `compenso-${rs[0].mese.slice(0, 7)}-${chi(rs[0])}.pdf` : `compensi-${rs[0]?.mese.slice(0, 7) ?? ''}.pdf`
  const url = URL.createObjectURL(new Blob([byte as BlobPart], { type: 'application/pdf' }))
  const a = document.createElement('a')
  a.href = url
  a.download = nome
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
