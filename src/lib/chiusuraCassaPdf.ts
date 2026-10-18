import type { PDFFont, PDFPage } from 'pdf-lib'
import { descrizioneRiga, differenzaInParole, giornoRoma, importoPerCassa, righeDelPeriodo, type ChiusuraCassa, type RigaMovimento } from './contabilita'
import { scrivibileCon } from './firma'
import { dataRicevuta, euro, type EnteRicevuta } from './ricevute'

/**
 * Il foglio PDF di una chiusura di cassa: un A4 in verticale da stampare, firmare e tenere.
 * In testa l'associazione; poi giorni chiusi, quanto c'era «secondo i conti», quanto si è
 * contato e la differenza; chi ha chiuso; i movimenti in contanti del periodo (senza i nomi
 * degli iscritti: «Incasso iscritto» e la voce); in fondo i totali e due righe per le firme.
 * Se i movimenti non stanno in una pagina, si va a un'altra con la stessa testa e i totali
 * stanno sull'ultima. Le cifre sono quelle salvate nella chiusura: il foglio si ristampa
 * sempre uguale.
 *
 * Le misure sono in punti PDF contati dall'alto (`y` qui sotto li gira).
 */

const PAGINA = { w: 595.28, h: 841.89 }
const MARGINE = 44
const RIGA = 15

/** Quante righe di movimenti stanno in una pagina di continuazione (la prima ne ha meno: porta i numeri). */
export const righePerPagina = 38
const RIGHE_PRIMA = 22

const ORA = new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit' })

export interface DatiFoglioChiusura {
  ente: EnteRicevuta
  cassa: string
  chiusura: ChiusuraCassa
  /** L'elenco unico dei movimenti: il foglio sceglie quelli del periodo. */
  righe: RigaMovimento[]
  /** Dopo la chiusura è cambiato un incasso: l'elenco di adesso non torna più con le cifre salvate, e il foglio lo dice. */
  nonPiuInRegola?: boolean
}

export async function chiusuraCassaPdf(d: DatiFoglioChiusura): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb, degrees } = await import('pdf-lib')
  const { ente, chiusura: k } = d
  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const grassetto = await pdf.embedFont(StandardFonts.HelveticaBold)
  const nero = rgb(0, 0, 0)
  const rosso = rgb(0.85, 0.1, 0.1)
  const scrivibile = scrivibileCon(font)
  const y = (t: number) => PAGINA.h - t

  const periodo = `dal ${dataRicevuta(k.dal)} al ${dataRicevuta(k.data)}`
  const cassaId = k.cassaId
  const movimenti = righeDelPeriodo(d.righe, k, cassaId)
  const entrate = movimenti.map((r) => importoPerCassa(r, cassaId)).filter((x) => x > 0).reduce((s, x) => s + x, 0)
  const uscite = movimenti.map((r) => importoPerCassa(r, cassaId)).filter((x) => x < 0).reduce((s, x) => s - x, 0)

  // Le pagine: la prima porta meno righe, le altre di più; sempre almeno una.
  const gruppi: RigaMovimento[][] = [movimenti.slice(0, RIGHE_PRIMA)]
  for (let i = RIGHE_PRIMA; i < movimenti.length; i += righePerPagina) gruppi.push(movimenti.slice(i, i + righePerPagina))

  const testo = (p: PDFPage, s: string | undefined, x: number, t: number, o: { corpo?: number; f?: PDFFont; largo?: number; destra?: boolean; colore?: ReturnType<typeof rgb> } = {}) => {
    const f = o.f ?? font
    const riga = scrivibile((s ?? '').replace(/\s+/g, ' ').trim())
    if (!riga) return
    let corpo = o.corpo ?? 10
    while (o.largo && corpo > 6 && f.widthOfTextAtSize(riga, corpo) > o.largo) corpo -= 0.25
    const w = f.widthOfTextAtSize(riga, corpo)
    p.drawText(riga, { x: o.destra ? x - w : x, y: y(t), size: corpo, font: f, color: o.colore ?? nero })
  }
  const linea = (p: PDFPage, x1: number, x2: number, t: number, spessore = 0.5) => p.drawLine({ start: { x: x1, y: y(t) }, end: { x: x2, y: y(t) }, thickness: spessore, color: nero })
  const destra = PAGINA.w - MARGINE

  /** Un testo lungo andando a capo, dentro `largo`; rende la riga dopo l'ultima. */
  const paragrafo = (p: PDFPage, s: string, x: number, t: number, largo: number, corpo: number) => {
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
    fatte.forEach((l, i) => p.drawText(l, { x, y: y(t + i * (corpo + 3)), size: corpo, font, color: nero }))
    return t + fatte.length * (corpo + 3)
  }

  const testa = (p: PDFPage, n: number) => {
    testo(p, ente.nome, MARGINE, 56, { corpo: 14, f: grassetto, largo: destra - MARGINE })
    testo(p, `${ente.indirizzo} · ${ente.cap} ${ente.comune}`.replace(/^ · /, ''), MARGINE, 71, { corpo: 9 })
    testo(p, `C.F. ${ente.codiceFiscale}${ente.partitaIva ? ` · P.IVA ${ente.partitaIva}` : ''}`, MARGINE, 83, { corpo: 9 })
    if (gruppi.length > 1) testo(p, `pag. ${n}/${gruppi.length}`, destra, 56, { corpo: 9, destra: true })
    linea(p, MARGINE, destra, 94, 0.75)
    if (d.nonPiuInRegola) testo(p, 'ATTENZIONE: dopo la chiusura sono cambiati dei pagamenti in contanti: l’elenco non torna più con le cifre.', MARGINE, 106, { corpo: 8.5, f: grassetto, colore: rosso, largo: destra - MARGINE })
    if (k.annullataIl) p.drawText('ANNULLATA', { x: 150, y: y(520), size: 70, font: grassetto, color: rosso, opacity: 0.3, rotate: degrees(25) })
  }

  gruppi.forEach((righe, n) => {
    const p = pdf.addPage([PAGINA.w, PAGINA.h])
    const ultima = n === gruppi.length - 1
    testa(p, n + 1)
    let t = 128
    if (n === 0) {
      testo(p, 'CHIUSURA DI CASSA', MARGINE, t, { corpo: 22, f: grassetto })
      testo(p, `${d.cassa} · ${periodo}`, MARGINE, t + 20, { corpo: 11 })
      if (k.annullataIl) testo(p, `ANNULLATA il ${dataRicevuta(giornoRoma(k.annullataIl))}${k.annullataDa ? ` da ${k.annullataDa}` : ''}`, MARGINE, t + 36, { corpo: 11, f: grassetto, colore: rosso })
      t += 62
      const cifre: Array<[string, string, boolean]> = [
        ['In cassa secondo i conti', `${euro(k.previsto)} €`, false],
        ['Contanti contati', `${euro(k.contato)} €`, false],
        ['Differenza', differenzaInParole(k.differenza), true],
      ]
      for (const [etichetta, valore, forte] of cifre) {
        testo(p, etichetta, MARGINE, t, { corpo: 11 })
        testo(p, valore, destra, t, { corpo: 12, f: grassetto, destra: true, colore: forte && k.differenza !== 0 ? rosso : nero })
        linea(p, MARGINE, destra, t + 6)
        t += 24
      }
      const quando = new Date(k.chiusaIl)
      testo(p, `Chiusa da ${k.chiusaDa ?? '—'} il ${dataRicevuta(giornoRoma(k.chiusaIl))} alle ${ORA.format(quando)}.`, MARGINE, t + 4, { corpo: 9 })
      t += 22
      if (k.nota) t = paragrafo(p, `Nota: ${k.nota}`, MARGINE, t, destra - MARGINE, 9) + 8
      t += 10
    }
    testo(p, 'MOVIMENTI IN CONTANTI', MARGINE, t, { corpo: 10, f: grassetto })
    linea(p, MARGINE, destra, t + 5, 0.75)
    t += 20
    if (!movimenti.length) testo(p, 'Nessun movimento in contanti nel periodo.', MARGINE, t, { corpo: 9 })
    for (const r of righe) {
      testo(p, dataRicevuta(r.data), MARGINE, t, { corpo: 9 })
      testo(p, descrizioneRiga(r), MARGINE + 62, t, { corpo: 9, largo: destra - MARGINE - 150 })
      const c = importoPerCassa(r, cassaId)
      testo(p, `${c < 0 ? '- ' : '+ '}${euro(Math.abs(c))} €`, destra, t, { corpo: 9, destra: true })
      t += RIGA
    }
    if (ultima) {
      t += 8
      linea(p, MARGINE, destra, t - 4)
      testo(p, 'Entrate in contanti', MARGINE, t + 8, { corpo: 9 })
      testo(p, `+ ${euro(entrate)} €`, destra, t + 8, { corpo: 9, destra: true })
      testo(p, 'Uscite e versamenti', MARGINE, t + 23, { corpo: 9 })
      testo(p, `- ${euro(uscite)} €`, destra, t + 23, { corpo: 9, destra: true })
      const firme = Math.max(t + 80, PAGINA.h - 120)
      const meta = (PAGINA.w - 2 * MARGINE - 40) / 2
      linea(p, MARGINE, MARGINE + meta, firme, 0.75)
      linea(p, destra - meta, destra, firme, 0.75)
      testo(p, 'Chi ha contato', MARGINE, firme + 12, { corpo: 8 })
      testo(p, 'Chi controlla', destra - meta, firme + 12, { corpo: 8 })
    }
  })

  pdf.setTitle(`Chiusura di cassa · ${d.cassa} · ${periodo}${k.annullataIl ? ' · ANNULLATA' : ''}${d.nonPiuInRegola ? ' · NON PIÙ IN REGOLA' : ''}`)
  pdf.setAuthor(ente.nome)
  pdf.setCreationDate(new Date(k.chiusaIl))
  return pdf.save()
}

/** Il PDF scaricato dal browser, col suo nome. */
export async function scaricaChiusuraCassa(d: DatiFoglioChiusura, nome: string) {
  const byte = await chiusuraCassaPdf(d)
  const url = URL.createObjectURL(new Blob([byte as BlobPart], { type: 'application/pdf' }))
  const a = document.createElement('a')
  a.href = url
  a.download = nome
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
