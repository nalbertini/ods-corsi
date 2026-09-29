import type { PDFFont } from 'pdf-lib'
import type { DatiRichiesta } from './richieste'
import { cfNatoIl } from './codiceFiscale'

/**
 * Il modulo delle autorizzazioni firmato dal telefono, senza stamparlo.
 *
 * Chi si iscrive sceglie nel modulo dell'app le stesse caselle del foglio (il
 * tesseramento, le foto) e firma col dito; qui si prende il PDF originale di
 * `public/moduli/`, ci si scrivono sopra i dati già dati nelle domande, le
 * crocette, la data e la firma, e ne esce il MODULO FIRMATO da caricare come
 * se fosse la foto del foglio. Il foglio resta quello della palestra: cambia
 * solo che è compilato.
 *
 * Le posizioni sono in punti PDF, con l'origine in basso a sinistra, e vanno
 * sulle righe dei due moduli di oggi: se la palestra cambia un foglio, vanno
 * rimisurate (le righe e le caselle si trovano col testo del PDF) e
 * riguardate coi PDF che lascia `node scripts/prova-firma.mjs <cartella>`.
 * Il resto non cambia.
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
  /** Il PDF originale, maggiorenni o minori secondo `minore`. */
  originale: ArrayBuffer | Uint8Array
  quando?: Date
  /** La stagione, per «per l'anno». */
  stagione: string
}

/** Dove si scrive: `x` e la riga su cui poggia il testo, e fin dove si può andare. */
interface Riga {
  x: number
  y: number
  fino: number
}

/** Una casella da crociare: il suo centro. */
type Casella = [number, number]

/** Dove va una firma: l'angolo in basso a sinistra, larghezza e altezza massime. */
interface Spazio {
  x: number
  y: number
  w: number
  h: number
}

const MAGGIORENNI = {
  nome: { x: 128, y: 654.5, fino: 443 },
  anno: { x: 142.5, y: 580, fino: 200 },
  tesseramentoSi: [62.2, 628.2] as Casella,
  tesseramentoNo: [62.2, 611.6] as Casella,
  fotoSi: [62.2, 542.2] as Casella,
  fotoNo: [62.2, 525.5] as Casella,
  privacy: [81.45, 418.5] as Casella,
  data: { x: 86, y: 330, fino: 163 },
  firma: { x: 92, y: 277, w: 150, h: 40 },
}

const MINORI = {
  genitore: { x: 202, y: 672.3, fino: 517 },
  genitoreCf: { x: 82, y: 655.6, fino: 281 },
  genitoreNatoA: { x: 320, y: 655.6, fino: 513 },
  genitoreProvincia: { x: 520, y: 655.6, fino: 533 },
  /** L'inizio di ognuno dei tre `___` di `___/___/___`. */
  genitoreNatoIl: [64.6, 84.7, 104.8],
  residenza: { x: 200, y: 639, fino: 399 },
  cap: { x: 435, y: 639, fino: 486 },
  via: { x: 80, y: 622.3, fino: 307 },
  civico: { x: 324.5, y: 622.3, fino: 342 },
  minore: { x: 59, y: 589, fino: 276 },
  minoreNatoA: { x: 316, y: 589, fino: 460 },
  minoreNatoIl: [471.2, 491.3, 511.4],
  foto: [81.45, 531.1] as Casella,
  /** «Firma del genitore/tutore 1»: il secondo genitore resta sul foglio, vuoto. */
  firmaFoto: { x: 205, y: 313, w: 130, h: 24 },
  tesseramento: [81.45, 274.75] as Casella,
  anno: { x: 204, y: 243, fino: 240 },
  firmaTesseramento: { x: 92, y: 220, w: 130, h: 24 },
  privacy: [81.45, 188.8] as Casella,
  data: { x: 86, y: 116, fino: 163 },
  firma: { x: 202, y: 109, w: 145, h: 28 },
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

/** Il nome della via senza «Via» davanti, che sul foglio è già stampato. */
const senzaVia = (via: string) => via.replace(/^via\s+/i, '')

export async function moduloFirmato(f: DatiFirma): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib')
  const pdf = await PDFDocument.load(f.originale)
  const pagina = pdf.getPage(0)
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const penna = rgb(PENNA.r, PENNA.g, PENNA.b)

  const scrivibile = scrivibileCon(font)

  const scrivi = (r: Riga, testo: string) => {
    const t = scrivibile(testo.trim())
    if (!t) return
    let corpo = CORPO
    while (corpo > 6 && font.widthOfTextAtSize(t, corpo) > r.fino - r.x) corpo -= 0.5
    pagina.drawText(t, { x: r.x, y: r.y, size: corpo, font, color: penna })
  }
  const data = (inizi: number[], y: number, iso: string | null | undefined) => {
    const [a, m, g] = (iso ?? '').split('-')
    if (!a || !m || !g) return
    ;[g, m, a].forEach((p, i) => pagina.drawText(p, { x: inizi[i] + (i === 2 ? 1.5 : 2.5), y, size: i === 2 ? 8 : CORPO, font, color: penna }))
  }
  const crocia = ([x, y]: Casella) => {
    const l = 3.6
    pagina.drawLine({ start: { x: x - l, y: y - l }, end: { x: x + l, y: y + l }, thickness: 1.3, color: penna })
    pagina.drawLine({ start: { x: x - l, y: y + l }, end: { x: x + l, y: y - l }, thickness: 1.3, color: penna })
  }
  const png = await pdf.embedPng(f.firma)
  const firma = (s: Spazio) => {
    const scala = Math.min(s.w / png.width, s.h / png.height)
    const w = png.width * scala
    const h = png.height * scala
    // In basso, perché una firma poggia sulla riga; se è corta, un po' più in là dell'inizio.
    pagina.drawImage(png, { x: s.x + Math.min(8, (s.w - w) / 2), y: s.y, width: w, height: h })
  }

  const d = f.dati
  const quando = f.quando ?? new Date()
  const oggi = dataDelFoglio(quando)
  const nome = (n?: string, c?: string) => `${(n ?? '').trim()} ${(c ?? '').trim()}`.trim()

  if (!f.minore) {
    const P = MAGGIORENNI
    scrivi(P.nome, nome(d.nome, d.cognome))
    crocia(f.scelte.tesseramento ? P.tesseramentoSi : P.tesseramentoNo)
    // «per l'anno 2_____»: il 2 è già stampato.
    scrivi(P.anno, f.stagione.replace(/^2/, ''))
    crocia(f.scelte.foto ? P.fotoSi : P.fotoNo)
    crocia(P.privacy)
    scrivi(P.data, oggi)
    firma(P.firma)
  } else {
    const P = MINORI
    const { via, civico } = viaECivico(d.indirizzo)
    scrivi(P.genitore, nome(d.genitoreNome, d.genitoreCognome))
    scrivi(P.genitoreCf, (d.genitoreCodiceFiscale ?? '').replace(/\s/g, '').toUpperCase())
    scrivi(P.genitoreNatoA, f.genitoreNatoA ?? '')
    scrivi(P.genitoreProvincia, (f.genitoreProvincia ?? '').toUpperCase())
    data(P.genitoreNatoIl, P.residenza.y, cfNatoIl((d.genitoreCodiceFiscale ?? '').replace(/\s/g, '').toUpperCase(), quando))
    scrivi(P.residenza, d.comune)
    scrivi(P.cap, d.cap)
    scrivi(P.via, senzaVia(via))
    scrivi(P.civico, civico)
    scrivi(P.minore, nome(d.nome, d.cognome))
    scrivi(P.minoreNatoA, d.natoA)
    data(P.minoreNatoIl, P.minore.y, d.natoIl)
    // Per un minore il foglio non ha il «non autorizza»: chi non autorizza
    // non crocia e non firma, come sulla carta.
    if (f.scelte.foto) {
      crocia(P.foto)
      firma(P.firmaFoto)
    }
    if (f.scelte.tesseramento) {
      crocia(P.tesseramento)
      scrivi(P.anno, f.stagione)
      firma(P.firmaTesseramento)
    }
    crocia(P.privacy)
    scrivi(P.data, oggi)
    firma(P.firma)
  }

  // Sotto, in piccolo, per la segreteria: che è firmato dall'app, e quando.
  const ora = `${due(quando.getHours())}:${due(quando.getMinutes())}`
  pagina.drawText(scrivibile(`Compilato e firmato dal telefono, nel modulo di iscrizione online, il ${oggi} alle ${ora}.`), {
    x: 56.7,
    y: 82,
    size: 7,
    font,
    color: rgb(0.4, 0.4, 0.4),
  })

  pdf.setTitle(`Autorizzazioni ${nome(d.nome, d.cognome)}`)
  pdf.setModificationDate(quando)
  return pdf.save()
}
