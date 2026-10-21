import type { PDFFont, PDFPage } from 'pdf-lib'
import { conSegno, differenza, fraseBilancio, nomeFileBilancio, type Bilancio } from './bilancio'
import { numeraPagine } from './cartaPdf'
import { scrivibileCon } from './firma'
import { dataRicevuta, euro, type EnteRicevuta } from './ricevute'

/**
 * Il foglio PDF del bilancio di un anno, per il commercialista: un A4 in verticale. In testa
 * l'associazione; poi l'anno, «per cassa» e la data di calcolo; entrate, uscite e risultato;
 * le voci con l'anno prima; i saldi delle casse; in fondo due righe per le firme. Senza
 * movimenti singoli né nomi di iscritti. Se le voci non stanno in una pagina, si va a
 * un'altra con la stessa testa. Le misure sono in punti PDF contati dall'alto (`y` le gira).
 */

const PAGINA = { w: 595.28, h: 841.89 }
const MARGINE = 44
const RIGA = 15
/** Sotto questa altezza si va a un'altra pagina: restano le firme. */
const FONDO = PAGINA.h - 130

export interface DatiFoglioBilancio {
  ente: EnteRicevuta
  bilancio: Bilancio
  /** Il giorno di oggi: la data di calcolo che il foglio porta. */
  oggi: string
  /** La carta intestata: con lei la testa dell'associazione la dà la carta. */
  carta?: Uint8Array
}

export async function bilancioPdf(d: DatiFoglioBilancio): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib')
  const { ente, bilancio: b } = d
  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const grassetto = await pdf.embedFont(StandardFonts.HelveticaBold)
  const nero = rgb(0, 0, 0)
  const rosso = rgb(0.85, 0.1, 0.1)
  const scrivibile = scrivibileCon(font)
  const y = (t: number) => PAGINA.h - t
  const destra = PAGINA.w - MARGINE

  const testo = (p: PDFPage, s: string | undefined, x: number, t: number, o: { corpo?: number; f?: PDFFont; largo?: number; destra?: boolean; colore?: ReturnType<typeof rgb> } = {}) => {
    const f = o.f ?? font
    const riga = scrivibile((s ?? '').replace(/\s+/g, ' ').trim())
    if (!riga) return
    let corpo = o.corpo ?? 10
    while (o.largo && corpo > 6 && f.widthOfTextAtSize(riga, corpo) > o.largo) corpo -= 0.25
    const w = f.widthOfTextAtSize(riga, corpo)
    p.drawText(riga, { x: o.destra ? x - w : x, y: y(t), size: corpo, font: f, color: o.colore ?? nero })
  }
  const linea = (p: PDFPage, t: number, spessore = 0.5) => p.drawLine({ start: { x: MARGINE, y: y(t) }, end: { x: destra, y: y(t) }, thickness: spessore, color: nero })
  // Il meno vero (−) non è nel carattere dei PDF: si scrive con il trattino.
  const segno = (c: number) => conSegno(c).replace('−', '-')
  const importo = (c: number | null) => (c === null ? '—' : `${euro(c)} €`)

  const pagine: PDFPage[] = []
  const [foglio] = d.carta ? await pdf.embedPdf(d.carta) : []
  /** Una pagina nuova con la testa dell'associazione (o la carta); rende dove si può cominciare a scrivere. */
  const nuovaPagina = () => {
    const p = pdf.addPage([PAGINA.w, PAGINA.h])
    pagine.push(p)
    if (foglio) {
      p.drawPage(foglio)
      return { p, t: 128 }
    }
    testo(p, ente.nome, MARGINE, 56, { corpo: 14, f: grassetto, largo: destra - MARGINE })
    testo(p, `${ente.indirizzo} · ${ente.cap} ${ente.comune}`.replace(/^ · /, ''), MARGINE, 71, { corpo: 9 })
    testo(p, `C.F. ${ente.codiceFiscale}${ente.partitaIva ? ` · P.IVA ${ente.partitaIva}` : ''}`, MARGINE, 83, { corpo: 9 })
    linea(p, 94, 0.75)
    return { p, t: 128 }
  }

  let { p, t } = nuovaPagina()
  testo(p, `BILANCIO ${b.anno}`, MARGINE, t, { corpo: 22, f: grassetto })
  testo(p, `dal ${dataRicevuta(b.dal)} al ${dataRicevuta(b.al)}${b.parziale ? ' · anno in corso, parziale' : ''}`, MARGINE, t + 20, { corpo: 11 })
  testo(p, fraseBilancio(b, d.oggi), MARGINE, t + 35, { corpo: 8.5, largo: destra - MARGINE })
  t += 62
  if (b.provvisorio) {
    testo(p, 'RISULTATO PROVVISORIO: più di metà delle uscite non ha ancora una voce.', MARGINE, t - 6, { corpo: 9, f: grassetto, colore: rosso, largo: destra - MARGINE })
    t += 14
  }

  const colonna = { anno: destra - 170, prima: destra - 85, diff: destra }
  const intestazione = () => {
    testo(p, 'VOCE', MARGINE, t, { corpo: 8, f: grassetto })
    testo(p, `${b.anno}${b.parziale ? ' (al ' + dataRicevuta(b.al).slice(0, 5) + ')' : ''}`, colonna.anno, t, { corpo: 8, f: grassetto, destra: true })
    testo(p, `${b.anno - 1}${b.parziale ? ' (stesso periodo)' : ''}`, colonna.prima, t, { corpo: 8, f: grassetto, destra: true })
    testo(p, 'DIFFERENZA', colonna.diff, t, { corpo: 8, f: grassetto, destra: true })
    linea(p, t + 5, 0.75)
    t += 20
  }
  intestazione()

  const riga = (nome: string, nota: string, anno: number | null, prima: number | null, forte = false) => {
    if (t > FONDO) {
      ;({ p, t } = nuovaPagina())
      intestazione()
    }
    const f = forte ? grassetto : font
    testo(p, nota ? `${nome} · ${nota}` : nome, MARGINE, t, { corpo: 9, f, largo: colonna.anno - MARGINE - 80 })
    testo(p, importo(anno), colonna.anno, t, { corpo: 9, f, destra: true })
    testo(p, importo(prima), colonna.prima, t, { corpo: 9, f, destra: true })
    testo(p, differenza(anno, prima).replace('−', '-'), colonna.diff, t, { corpo: 9, f, destra: true })
    if (forte) linea(p, t - 11, 0.5)
    t += RIGA
  }
  const gruppo = (titolo: string, tipo: 'entrata' | 'uscita', totale: number, prima: number | null) => {
    testo(p, titolo, MARGINE, t, { corpo: 9, f: grassetto })
    t += RIGA
    for (const v of b.voci.filter((x) => x.tipo === tipo)) riga(v.voce, v.daClassificare ? `${v.movimenti} movimenti senza voce` : v.aParte ? 'chiusura di cassa' : '', v.totale, v.prima)
    riga(tipo === 'entrata' ? 'Totale entrate' : 'Totale uscite', '', totale, prima, true)
    t += 6
  }
  gruppo('ENTRATE', 'entrata', b.entrate, b.prima?.entrate ?? null)
  gruppo('USCITE', 'uscita', b.uscite, b.prima?.uscite ?? null)
  riga('RISULTATO · entrate meno uscite', '', b.risultato, b.prima?.risultato ?? null, true)
  t += 14

  if (t + 24 + b.saldi.length * 2 * RIGA > FONDO) ({ p, t } = nuovaPagina())
  testo(p, 'SALDI DELLE CASSE', MARGINE, t, { corpo: 10, f: grassetto })
  linea(p, t + 5, 0.75)
  t += 20
  for (const s of b.saldi) {
    if (s.inizio === null) {
      testo(p, s.nome, MARGINE, t, { corpo: 9, f: grassetto })
      testo(p, `Saldo non disponibile: la cassa parte il ${dataRicevuta(s.parteIl)}`, destra, t, { corpo: 9, destra: true })
      t += RIGA + 4
      continue
    }
    testo(p, s.nome, MARGINE, t, { corpo: 9, f: grassetto })
    testo(p, `inizio${s.dal ? ` (dal ${dataRicevuta(s.dal)})` : ''} ${importo(s.inizio)} · entrate ${importo(s.entrate)} · uscite ${importo(s.uscite)} · giroconti ${segno(s.giroconti)} · fine ${importo(s.fine)}`, destra, t + RIGA - 2, {
      corpo: 8.5,
      destra: true,
      largo: destra - MARGINE,
    })
    t += RIGA * 2 + 2
  }

  const ultima = pagine[pagine.length - 1]
  const firme = Math.max(t + 40, PAGINA.h - 120)
  const meta = (PAGINA.w - 2 * MARGINE - 40) / 2
  ultima.drawLine({ start: { x: MARGINE, y: y(firme) }, end: { x: MARGINE + meta, y: y(firme) }, thickness: 0.75, color: nero })
  ultima.drawLine({ start: { x: destra - meta, y: y(firme) }, end: { x: destra, y: y(firme) }, thickness: 0.75, color: nero })
  testo(ultima, 'Chi ha preparato', MARGINE, firme + 12, { corpo: 8 })
  testo(ultima, 'Chi controlla', destra - meta, firme + 12, { corpo: 8 })
  // Sulla carta il numero di pagina sta in basso: in alto c'è la testata.
  if (foglio) numeraPagine(pagine, font, '', rgb(0.3, 0.3, 0.3))
  else if (pagine.length > 1) pagine.forEach((q, i) => testo(q, `pag. ${i + 1}/${pagine.length}`, destra, 56, { corpo: 9, destra: true }))

  pdf.setTitle(`Bilancio ${b.anno}${b.parziale ? ' (parziale)' : ''} · per cassa`)
  pdf.setAuthor(ente.nome)
  return pdf.save()
}

/** Il PDF scaricato dal browser, col suo nome. */
export async function scaricaBilancio(d: DatiFoglioBilancio) {
  const byte = await bilancioPdf(d)
  const url = URL.createObjectURL(new Blob([byte as BlobPart], { type: 'application/pdf' }))
  const a = document.createElement('a')
  a.href = url
  a.download = nomeFileBilancio(d.bilancio.anno, 'pdf')
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
