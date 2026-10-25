import { numeraPagine, SU_CARTA } from './cartaPdf'
import { scrivibileCon } from './firma'
import { dateGara, scrittaCertificato, type Gara, type RigaAtletaGara } from './gare'

/**
 * L'elenco degli atleti di una gara, da portare al tavolo dell'organizzatore: un A4 in verticale con la gara in testa
 * e una riga per atleta (nato, corso, certificato alla data della gara, nota). Niente contatti né quote.
 * Le misure sono in punti PDF contati dall'alto (`y` qui sotto li gira).
 */

const PAGINA = { w: 595.28, h: 841.89 }
const MARGINE = 42
const RIGA = 16
// Le colonne: atleta, nato, corso, certificato, nota.
const COLONNE = [150, 36, 105, 130, 90]

export async function elencoGaraPdf(g: Gara, righe: (RigaAtletaGara & { corso: string })[], carta?: Uint8Array): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib')
  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const grassetto = await pdf.embedFont(StandardFonts.HelveticaBold)
  const nero = rgb(0.1, 0.1, 0.1)
  const grigio = rgb(0.42, 0.42, 0.42)
  const scrivibile = scrivibileCon(font)
  const [foglio] = carta ? await pdf.embedPdf(carta) : []
  const inizio = foglio ? SU_CARTA.inizio - 12 : MARGINE
  const fondo = PAGINA.h - (foglio ? SU_CARTA.sotto : 48)

  const nuova = () => {
    const p = pdf.addPage([PAGINA.w, PAGINA.h])
    if (foglio) p.drawPage(foglio)
    return p
  }
  let p = nuova()
  let t = inizio
  const testo = (s: string, x: number, largo: number, o: { corpo?: number; grasso?: boolean; colore?: typeof nero } = {}) => {
    const corpo = o.corpo ?? 9
    const f = o.grasso ? grassetto : font
    let pulito = scrivibile(s)
    // Una cella troppo lunga si accorcia coi puntini, non finisce sotto la colonna dopo.
    while (pulito.length > 1 && f.widthOfTextAtSize(pulito, corpo) > largo - 4) pulito = pulito.slice(0, -2) + '…'
    p.drawText(pulito, { x, y: PAGINA.h - t, size: corpo, font: f, color: o.colore ?? nero })
  }
  const riga = (celle: string[], o: { grasso?: boolean; colore?: typeof nero } = {}) => {
    let x = MARGINE
    celle.forEach((c, i) => {
      testo(c, x, COLONNE[i], { ...o, corpo: o.grasso ? 7.5 : 9 })
      x += COLONNE[i]
    })
    t += RIGA
  }
  const testata = ['ATLETA', 'NATO', 'CORSO', 'CERTIFICATO ALLA GARA', 'NOTA']

  testo(g.nome.toUpperCase(), MARGINE, PAGINA.w - 2 * MARGINE, { corpo: 15, grasso: true })
  t += 18
  testo([dateGara(g), g.luogo, g.organizzatore && `organizza ${g.organizzatore}`].filter(Boolean).join(' · '), MARGINE, PAGINA.w - 2 * MARGINE, { colore: grigio })
  t += 14
  testo(`${righe.length} ${righe.length === 1 ? 'atleta' : 'atleti'}`, MARGINE, 200, { colore: grigio })
  t += 24
  riga(testata, { grasso: true, colore: grigio })
  for (const r of righe) {
    if (t > fondo) {
      p = nuova()
      t = inizio
      riga(testata, { grasso: true, colore: grigio })
    }
    riga([`${r.cognome} ${r.nome}`, r.annoNascita ? String(r.annoNascita) : '', r.corso, scrittaCertificato(r).testo, r.nota ?? ''])
  }

  numeraPagine(pdf.getPages(), font, g.nome, grigio)
  pdf.setTitle(`Atleti · ${g.nome}`)
  return pdf.save()
}

export async function scaricaElencoGara(g: Gara, righe: (RigaAtletaGara & { corso: string })[], carta?: Uint8Array) {
  const byte = await elencoGaraPdf(g, righe, carta)
  const url = URL.createObjectURL(new Blob([byte as BlobPart], { type: 'application/pdf' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `gara-${g.dal}.pdf`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
