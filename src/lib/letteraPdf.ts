import type { PDFFont, PDFPage } from 'pdf-lib'
import { scrivibileCon } from './firma'
import { cartaIntestata, SU_CARTA } from './cartaPdf'
import { nomeFileLettera, testoLettera, type DatiLettera } from './lettere'

/**
 * Il PDF della lettera d'incarico: un A4 in verticale, come il Word della
 * palestra, da stampare e firmare a mano (il Presidente, il tecnico per
 * accettazione e per i punti 4 e 5). Il testo lo dà `testoLettera`: qui solo
 * l'impaginato, che va a una pagina nuova quando la prima è piena.
 *
 * Le misure sono in punti PDF contati dall'alto (`y` qui sotto li gira).
 */

const PAGINA = { w: 595.28, h: 841.89 }
const MARGINE = 56
const LARGO = PAGINA.w - 2 * MARGINE
const CORPO = 10
const RIGA = 13.5
/**
 * Lo spazio del testo sulla carta intestata: sotto la testata (che finisce a 92 punti dall'alto)
 * e sopra la riga «pagina n di N», che sta sopra il piede (fino a 68 punti dal fondo).
 * Se la carta di `fogliModuli.ts` cambia misure, la prova (prova-lettere.mjs, 6 bis) se ne accorge.
 */
const INIZIO = SU_CARTA.inizio
const FONDO = PAGINA.h - SU_CARTA.sotto

/** Le righe di un testo che sta in `largo` punti, a capo fra le parole. */
export function aCapo(testo: string, font: PDFFont, corpo: number, largo: number): string[] {
  const righe: string[] = []
  let riga = ''
  // Solo gli spazi normali: quello che non va a capo (fra € e l'importo) tiene unite le parole.
  for (const parola of testo.split(/[ \t\n]+/)) {
    const prova = riga ? `${riga} ${parola}` : parola
    if (riga && font.widthOfTextAtSize(prova, corpo) > largo) {
      righe.push(riga)
      riga = parola
    } else riga = prova
  }
  if (riga) righe.push(riga)
  return righe
}

/** `carta` è public/moduli/carta-intestata.pdf (fatta da `fogliModuli.ts`): ogni pagina parte da lì, testata e piede li dà lei. */
export async function letteraPdf(l: DatiLettera, carta: Uint8Array): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib')
  const pdf = await PDFDocument.create()
  pdf.setTitle(`Lettera d'incarico ${l.stagione} · ${l.tecnico.cognome} ${l.tecnico.nome}`.trim())
  pdf.setAuthor('ASD IL CENTRO JUDO')
  pdf.setCreator('ODS Corsi')
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const grassetto = await pdf.embedFont(StandardFonts.HelveticaBold)
  const nero = rgb(0, 0, 0)
  const grigio = rgb(0.3, 0.3, 0.3)
  const scrivibile = scrivibileCon(font)
  const [foglio] = await pdf.embedPdf(carta)

  let pagina: PDFPage = pdf.addPage([PAGINA.w, PAGINA.h])
  let y = 0
  let prima = true
  const nuovaPagina = () => {
    // La prima pagina c'è già: le altre si aggiungono quando la precedente è piena.
    if (!prima) pagina = pdf.addPage([PAGINA.w, PAGINA.h])
    prima = false
    pagina.drawPage(foglio)
    y = INIZIO
  }
  nuovaPagina()
  /** Scrive una riga; se non c'è più posto, va alla pagina dopo. */
  const scrivi = (testo: string, x: number, f: PDFFont = font) => {
    if (y + RIGA > FONDO) nuovaPagina()
    pagina.drawText(testo, { x, y: PAGINA.h - y - CORPO, size: CORPO, font: f, color: nero })
    y += RIGA
  }
  const puntini = '…………………………………………'

  const paragrafi = testoLettera(l)
  for (const [i, p] of paragrafi.entries()) {
    const testo = scrivibile(p.testo)
    if (p.tipo === 'destinatario') {
      // Il destinatario sta a destra, come nella lettera di carta.
      for (const r of aCapo(testo, font, CORPO, LARGO * 0.6)) scrivi(r, MARGINE + LARGO * 0.4)
      continue
    }
    if (p.tipo === 'oggetto') {
      y += RIGA
      for (const r of aCapo(testo, grassetto, CORPO, LARGO)) scrivi(r, MARGINE, grassetto)
      y += RIGA / 2
      continue
    }
    if (p.tipo === 'firma') {
      // Firma, puntini e la riga che la chiude («Data: …» o il nome) vanno nella stessa pagina: si conta tutto prima.
      const dopo = paragrafi[i + 1]
      const chiude = dopo && !dopo.tipo && !dopo.numero ? aCapo(scrivibile(dopo.testo), font, CORPO, LARGO).length : 0
      if (y + (2.5 + aCapo(testo, font, CORPO, LARGO).length + chiude) * RIGA > FONDO) nuovaPagina()
      y += RIGA
      for (const r of aCapo(testo, font, CORPO, LARGO)) scrivi(r, MARGINE)
      y += RIGA / 2
      scrivi(`Firma: ${scrivibile(puntini)}`, MARGINE)
      continue
    }
    const rientro = p.tipo === 'voce' ? 18 : p.numero ? 16 : 0
    const righe = aCapo(testo, font, CORPO, LARGO - rientro)
    if (p.numero) {
      if (y + RIGA > FONDO) nuovaPagina()
      pagina.drawText(`${p.numero}.`, { x: MARGINE, y: PAGINA.h - y - CORPO, size: CORPO, font: grassetto, color: nero })
    }
    righe.forEach((r, i) => scrivi(p.tipo === 'voce' && i === 0 && !/^[a-c]\)/.test(r) ? `– ${r}` : r, MARGINE + rientro))
    y += RIGA / 3
  }
  // Con più fogli ognuno dice che pagina è e, dal secondo, di chi: sciolti sul banco si ritrovano.
  const pagine = pdf.getPages()
  if (pagine.length > 1)
    pagine.forEach((p, i) => {
      const dove = `pagina ${i + 1} di ${pagine.length}`
      const testo = scrivibile(i === 0 ? dove : `${l.tecnico.nome} ${l.tecnico.cognome}`.trim() + ` · lettera d’incarico ${l.stagione} · ${dove}`)
      p.drawText(testo, { x: PAGINA.w - MARGINE - font.widthOfTextAtSize(testo, 7.5), y: 76, size: 7.5, font, color: grigio })
    })
  return pdf.save()
}

/** Scarica il PDF col nome che dice di chi, di che stagione e di che giorno è (`nomeFileLettera`). */
export async function scaricaLettera(l: DatiLettera & { sostituitaIl?: string | null }) {
  const byte = await letteraPdf(l, await cartaIntestata())
  const url = URL.createObjectURL(new Blob([byte as BlobPart], { type: 'application/pdf' }))
  const a = document.createElement('a')
  a.href = url
  a.download = nomeFileLettera(l)
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
