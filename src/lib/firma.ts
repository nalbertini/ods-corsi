import type { PDFFont } from 'pdf-lib'
import type { DatiRichiesta } from './richieste'
import { cfNatoIl } from './codiceFiscale'

/**
 * Il modulo delle autorizzazioni firmato dal telefono, senza stamparlo.
 *
 * Chi si iscrive sceglie nel modulo dell'app le stesse caselle del foglio (il
 * tesseramento, le foto) e firma col dito; qui si prende il PDF di
 * `public/moduli/` (`fogliModuli.ts`), ci si scrivono sopra i dati già dati
 * nelle domande, le crocette, la data e la firma, e ne esce il MODULO FIRMATO
 * da caricare come se fosse la foto del foglio.
 *
 * Si scrive per NOME di campo, sul rettangolo che il campo ha nel foglio, e
 * alla fine i campi si tolgono: il PDF che esce è fermo, uguale in ogni
 * lettore del telefono. Se un foglio cambia aspetto non si rimisura niente.
 */

export interface SceltaModulo {
  /** ACCONSENTO al tesseramento alla FIJLKAM e/o FIPE. */
  tesseramento: boolean
  /** AUTORIZZO le foto sui social. */
  foto: boolean
}

export interface DatiFirma {
  dati: DatiRichiesta
  minore: boolean
  scelte: SceltaModulo
  /** Per un minore: dove è nato il genitore, che le domande non chiedono. */
  genitoreNatoA?: string
  genitoreProvincia?: string
  /** La firma, un PNG trasparente già ritagliato. */
  firma: Uint8Array
  /** Il foglio coi campi, maggiorenni o minori secondo `minore`. */
  originale: ArrayBuffer | Uint8Array
  quando?: Date
  /** La stagione, per «per l'anno». */
  stagione: string
}

/** L'inchiostro: il blu di una penna, così si vede cosa è scritto e cosa è stampato. */
const PENNA = { r: 0.08, g: 0.16, b: 0.52 }
const CORPO = 10

/** Le lettere che Helvetica non ha e che non si scompongono in lettera e accento. */
const SENZA_SEGNI: Record<string, string> = { Ł: 'L', ł: 'l', Ø: 'O', ø: 'o', Đ: 'D', đ: 'd', ß: 'ss', Æ: 'AE', æ: 'ae', Œ: 'OE', œ: 'oe' }

/**
 * Quello che un font standard del PDF (Helvetica) sa scrivere: gli accenti
 * italiani sì, gli altri li perde, il resto diventa «?». Lo usa anche la
 * ricevuta (`ricevutaPdf.ts`).
 */
export const scrivibileCon = (font: PDFFont) => (s: string) =>
  [...s.normalize('NFC')]
    .map((c) => {
      try {
        font.encodeText(c)
        return c
      } catch {
        const semplice = SENZA_SEGNI[c] ?? c.normalize('NFD').replace(/\p{M}/gu, '')
        try {
          font.encodeText(semplice)
          return semplice
        } catch {
          return '?'
        }
      }
    })
    .join('')

const due = (n: number) => String(n).padStart(2, '0')
export const dataDelFoglio = (d: Date) => `${due(d.getDate())}/${due(d.getMonth() + 1)}/${d.getFullYear()}`

/** Via e numero da «Via Roma 12», «Corso Francia, 224/B»; il numero può mancare. */
export function viaECivico(indirizzo: string): { via: string; civico: string } {
  const s = indirizzo.trim().replace(/\s+/g, ' ')
  const m = /^(.*?)[\s,]+(?:n\.?\s*)?(\d+\s?[a-zA-Z]?(?:\/\s?\w+)?)$/.exec(s)
  return m && m[1] ? { via: m[1].replace(/,$/, ''), civico: m[2] } : { via: s, civico: '' }
}

export async function moduloFirmato(f: DatiFirma): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib')
  const pdf = await PDFDocument.load(f.originale)
  const form = pdf.getForm()
  const pagina = pdf.getPage(0)
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const penna = rgb(PENNA.r, PENNA.g, PENNA.b)
  const scrivibile = scrivibileCon(font)

  /** Dove sta un campo nel foglio: il suo rettangolo. */
  const dove = (nome: string) => {
    const campo = form.getFieldMaybe(nome)
    const rettangolo = campo?.acroField.getWidgets()[0]?.getRectangle()
    if (!rettangolo) throw new Error(`Il foglio non ha il campo «${nome}»: va rigenerato con npm run moduli:genera.`)
    return rettangolo
  }
  const scrivi = (nome: string, testo: string) => {
    const r = dove(nome)
    const t = scrivibile(testo.trim())
    if (!t) return
    let corpo = CORPO
    while (corpo > 6 && font.widthOfTextAtSize(t, corpo) > r.width - 2) corpo -= 0.5
    // Poggia sul filo: il campo ha il filo sul suo bordo basso.
    pagina.drawText(t, { x: r.x + 1, y: r.y + 3.5, size: corpo, font, color: penna })
  }
  const crocia = (nome: string) => {
    const r = dove(nome)
    const x = r.x + r.width / 2
    const y = r.y + r.height / 2
    const l = Math.min(r.width, r.height) * 0.32
    pagina.drawLine({ start: { x: x - l, y: y - l }, end: { x: x + l, y: y + l }, thickness: 1.3, color: penna })
    pagina.drawLine({ start: { x: x - l, y: y + l }, end: { x: x + l, y: y - l }, thickness: 1.3, color: penna })
  }
  const png = await pdf.embedPng(f.firma)
  const firma = (nome: string) => {
    const r = dove(nome)
    const scala = Math.min(r.width / png.width, r.height / png.height)
    const w = png.width * scala
    const h = png.height * scala
    // In basso, perché una firma poggia sul filo; se è corta, un po' più in là dell'inizio.
    pagina.drawImage(png, { x: r.x + Math.min(8, (r.width - w) / 2), y: r.y + 1, width: w, height: h })
  }
  const data = (nome: string, iso: string | null | undefined) => {
    const [a, m, g] = (iso ?? '').split('-')
    if (a && m && g) scrivi(nome, `${g}/${m}/${a}`)
  }

  const d = f.dati
  const quando = f.quando ?? new Date()
  const oggi = dataDelFoglio(quando)
  const nome = (n?: string, c?: string) => `${(n ?? '').trim()} ${(c ?? '').trim()}`.trim()

  if (!f.minore) {
    scrivi('nome', nome(d.nome, d.cognome))
    crocia(f.scelte.tesseramento ? 'tesseramentoSi' : 'tesseramentoNo')
    scrivi('tesseramentoAnno', f.stagione)
    crocia(f.scelte.foto ? 'fotoSi' : 'fotoNo')
    crocia('privacy')
    scrivi('data', oggi)
    firma('firma')
  } else {
    const { via, civico } = viaECivico(d.indirizzo)
    const cf = (d.genitoreCodiceFiscale ?? '').replace(/\s/g, '').toUpperCase()
    scrivi('genitore', nome(d.genitoreNome, d.genitoreCognome))
    scrivi('genitoreCodiceFiscale', cf)
    scrivi('genitoreNatoA', f.genitoreNatoA ?? '')
    scrivi('genitoreProvincia', (f.genitoreProvincia ?? '').toUpperCase())
    data('genitoreNatoIl', cfNatoIl(cf, quando))
    scrivi('genitoreResidenza', d.comune)
    scrivi('genitoreCap', d.cap)
    scrivi('genitoreVia', via)
    scrivi('genitoreCivico', civico)
    scrivi('minore', nome(d.nome, d.cognome))
    scrivi('minoreNatoA', d.natoA)
    data('minoreNatoIl', d.natoIl)
    // Per un minore il foglio non ha il «non autorizza»: chi non autorizza
    // non crocia e non firma, come sulla carta. Il secondo genitore resta vuoto.
    if (f.scelte.foto) {
      crocia('foto')
      firma('firmaFoto')
    }
    if (f.scelte.tesseramento) {
      crocia('tesseramento')
      scrivi('tesseramentoAnno', f.stagione)
      firma('firmaTesseramento')
    }
    crocia('privacy')
    scrivi('data', oggi)
    firma('firma')
  }

  // I campi hanno fatto il loro lavoro: via, così il PDF è fermo e uguale ovunque.
  for (const campo of form.getFields()) form.removeField(campo)

  // Sotto, in piccolo, per la segreteria: che è firmato dall'app, e quando.
  const ora = `${due(quando.getHours())}:${due(quando.getMinutes())}`
  pagina.drawText(scrivibile(`Compilato e firmato dal telefono, nel modulo di iscrizione online, il ${oggi} alle ${ora}.`), {
    x: 40,
    y: 86,
    size: 7,
    font,
    color: rgb(0.4, 0.4, 0.4),
  })

  pdf.setTitle(`Autorizzazioni ${nome(d.nome, d.cognome)}`)
  pdf.setModificationDate(quando)
  return pdf.save()
}
