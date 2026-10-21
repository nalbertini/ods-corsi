import type { PDFDocument, PDFFont, PDFForm, PDFPage } from 'pdf-lib'
import { COSTI, OFFERTE, QUOTA_ASSOCIATIVA, STAGIONE, VALIDITA, saldoAperto } from './costi'
import { PAGAMENTO } from './iscrizione'

/**
 * I fogli da scaricare e da stampare: le due autorizzazioni (maggiorenni e
 * minori) e i costi della stagione. Nascono da qui e non da un file di
 * Google Docs, così il foglio dei costi segue `costi.ts` e non può restare
 * indietro, e le autorizzazioni hanno i campi da compilare al computer.
 *
 * L'aspetto è quello del sito (`docs/design-canvas/moduli-pdf`, pelle B):
 * carta bianca, Big Shoulders per i titoli, Inter per il testo, filetti blu;
 * testata e piede sono la carta intestata (`docs/design-canvas/carta-intestata`,
 * variante A), che esce anche da sola per la lettera d'incarico.
 * Le parole delle autorizzazioni sono quelle del foglio di sempre: se la
 * palestra le cambia, si cambiano qui sotto, non nella resa.
 *
 * I campi hanno nome (vedi `CAMPI_*`): il modulo firmato dell'app
 * (`firma.ts`) scrive per nome, sul rettangolo di ognuno, e poi li toglie,
 * così nessuna misura va rifatta se un foglio cambia aspetto.
 *
 * Si genera con `npm run moduli:genera` (font e loghi li dà lo script, che
 * sta fuori dall'app: `@pdf-lib/fontkit` non entra nel suo pacchetto).
 */

export const CAMPI_MAGGIORENNI = ['nome', 'tesseramentoSi', 'tesseramentoNo', 'tesseramentoAnno', 'fotoSi', 'fotoNo', 'privacy', 'data', 'firma'] as const

export const CAMPI_MINORI = [
  'genitore',
  'genitoreCodiceFiscale',
  'genitoreNatoA',
  'genitoreProvincia',
  'genitoreNatoIl',
  'genitoreCap',
  'genitoreResidenza',
  'genitoreVia',
  'genitoreCivico',
  'minore',
  'minoreNatoA',
  'minoreNatoIl',
  'foto',
  'firmaFoto',
  'firmaGenitore2',
  'tesseramento',
  'tesseramentoAnno',
  'firmaTesseramento',
  'privacy',
  'data',
  'firma',
] as const

/** Le caselle da crociare; tutti gli altri campi sono di testo o spazi da firmare. */
export const CASELLE = ['tesseramentoSi', 'tesseramentoNo', 'fotoSi', 'fotoNo', 'privacy', 'foto', 'tesseramento'] as const

export interface OpzioniFogli {
  /** `@pdf-lib/fontkit`, che il PDF vuole per incorporare un font: lo passa lo script. */
  fontkit: Parameters<PDFDocument['registerFontkit']>[0]
  /** TrueType (non woff2: il PDF incorpora i byte così come sono). */
  fonts: { titolo: Uint8Array; corpo: Uint8Array; corpoGrassetto: Uint8Array }
  loghi: { mascotte: Uint8Array; simbolo: Uint8Array }
  /** Il giorno, `AAAA-MM-GG`: decide se il prezzo a saldo c'è ancora. */
  oggi: string
}

const L = 595
const A = 842
const MARGINE = 40
const COL = {
  inchiostro: [0x0d, 0x2a, 0x3d],
  tenue: [0x46, 0x60, 0x6f],
  blu: [0x14, 0x70, 0x9f],
  filo: [0xcf, 0xe6, 0xf4],
  giallo: [0xf4, 0xc3, 0x1b],
} as const

/** I dati della palestra nel piede, in tre gruppi di due righe (a capo fra i dati, mai dentro uno); `peso` è la larghezza della colonna. */
const PIEDE = [
  { etichetta: 'SEDE', righe: ['Corso Francia 224, Cascine Vica', '10098 Rivoli (TO)'], peso: 1 },
  { etichetta: 'CONTATTI', righe: ['347 911 9064 · asdilcentrojudo@gmail.com', 'PEC asdilcentrojudo@legalmail.it'], peso: 1.6 },
  { etichetta: 'DATI FISCALI', righe: ['C.F. 95562500017', 'P.IVA 10002760014'], peso: 0.9 },
]

type Colore = readonly [number, number, number]
interface Pezzo {
  t: string
  /** In grassetto (Inter Bold). */
  g?: boolean
}

export async function generaFogli(opz: OpzioniFogli): Promise<{ maggiorenni: Uint8Array; minori: Uint8Array; costi: Uint8Array; carta: Uint8Array }> {
  const lib = await import('pdf-lib')
  const { PDFDocument, rgb, pushGraphicsState, popGraphicsState, setCharacterSpacing, PDFName, PDFString } = lib

  const nuovo = async (titolo: string) => {
    const pdf = await PDFDocument.create({ updateMetadata: false })
    pdf.registerFontkit(opz.fontkit)
    pdf.setTitle(titolo)
    pdf.setAuthor('ASD IL CENTRO JUDO')
    pdf.setCreator('ODS Corsi')
    pdf.setProducer('ODS Corsi')
    // Date fisse: lo stesso foglio genera lo stesso file, e un cambio nel PDF si vede nel diff.
    const fissa = new Date('2026-01-01T00:00:00Z')
    pdf.setCreationDate(fissa)
    pdf.setModificationDate(fissa)
    pdf.catalog.set(PDFName.of('Lang'), PDFString.of('it'))
    const titoloFont = await pdf.embedFont(opz.fonts.titolo, { subset: true })
    const corpo = await pdf.embedFont(opz.fonts.corpo, { subset: true })
    const grassetto = await pdf.embedFont(opz.fonts.corpoGrassetto, { subset: true })
    const mascotte = await pdf.embedPng(opz.loghi.mascotte)
    const simbolo = await pdf.embedPng(opz.loghi.simbolo)
    return { pdf, titoloFont, corpo, grassetto, mascotte, simbolo }
  }
  type Base = Awaited<ReturnType<typeof nuovo>>

  const colore = (c: Colore) => rgb(c[0] / 255, c[1] / 255, c[2] / 255)

  /** Un foglio su cui si scrive dall'alto: `y` è la distanza dal bordo alto, come nel canvas. */
  class Foglio {
    y = 0
    pagina: PDFPage
    constructor(
      readonly b: Base,
      readonly form: PDFForm | null,
      readonly sottotitolo: string,
    ) {
      this.pagina = b.pdf.addPage([L, A])
      this.testata()
      this.piede()
    }

    nuovaPagina() {
      this.pagina = this.b.pdf.addPage([L, A])
      this.testata()
      this.piede()
    }

    private testata() {
      const { pagina, b } = this
      const alto = 54
      const top = 28
      const mw = (b.mascotte.width / b.mascotte.height) * alto
      const sw = (b.simbolo.width / b.simbolo.height) * alto
      pagina.drawImage(b.mascotte, { x: MARGINE, y: A - top - alto, width: mw, height: alto })
      pagina.drawImage(b.simbolo, { x: L - MARGINE - sw, y: A - top - alto, width: sw, height: alto })
      this.testo('ASD IL CENTRO JUDO', { font: b.titoloFont, corpo: 30, centro: L / 2, y: top + 30, tracking: 0.03 * 30, colore: COL.inchiostro })
      this.testo(this.sottotitolo, { font: b.titoloFont, corpo: 11, centro: L / 2, y: top + 46, tracking: 0.22 * 11, colore: COL.tenue })
      // Il filo blu comincia con un tatami giallo, come i pulsanti del sito (variante A di docs/design-canvas/carta-intestata).
      const filo = A - top - alto - 6
      pagina.drawRectangle({ x: MARGINE, y: filo - 3, width: 44, height: 6, color: colore(COL.giallo) })
      pagina.drawLine({ start: { x: MARGINE + 44, y: filo }, end: { x: L - MARGINE, y: filo }, thickness: 2, color: colore(COL.blu) })
      this.y = top + alto + 6
    }

    /** Il piede: una tessera chiara coi dati della palestra in tre gruppi, da 22 a 68 punti dal fondo. */
    private piede() {
      const { pagina, b } = this
      const largo = L - 2 * MARGINE
      pagina.drawSvgPath(`M6 0H${largo - 6}Q${largo} 0 ${largo} 6V40Q${largo} 46 ${largo - 6} 46H6Q0 46 0 40V6Q0 0 6 0Z`, { x: MARGINE, y: 68, color: colore(COL.filo) })
      const pesi = PIEDE.reduce((s, g) => s + g.peso, 0)
      const libero = largo - 28 - 12 * (PIEDE.length - 1)
      let x = MARGINE + 14
      for (const g of PIEDE) {
        const w = (libero * g.peso) / pesi
        this.testo(g.etichetta, { font: b.titoloFont, corpo: 8, x, y: A - 68 + 15, tracking: 0.8, colore: COL.blu })
        g.righe.forEach((r, i) => this.testo(r, { font: b.corpo, corpo: 7, x, y: A - 68 + 25 + i * 9.5, colore: COL.inchiostro }))
        x += w + 12
      }
    }

    /** Una riga di testo: `y` è la linea di base, dall'alto. */
    testo(t: string, o: { font: PDFFont; corpo: number; x?: number; centro?: number; destra?: number; y: number; tracking?: number; colore: Colore; grassetto?: boolean }) {
      const font = o.grassetto ? this.b.grassetto : o.font
      const larghezza = font.widthOfTextAtSize(t, o.corpo) + (o.tracking ?? 0) * t.length
      const x = o.centro !== undefined ? o.centro - larghezza / 2 : o.destra !== undefined ? o.destra - larghezza : (o.x ?? MARGINE)
      const ops = [pushGraphicsState()]
      if (o.tracking) ops.push(setCharacterSpacing(o.tracking))
      this.pagina.pushOperators(...ops)
      this.pagina.drawText(t, { x, y: A - o.y, size: o.corpo, font, color: colore(o.colore) })
      this.pagina.pushOperators(popGraphicsState())
      return larghezza
    }

    /** Un testo a capo, parola per parola; ogni riga si ferma a `larghezza`. Ritorna l'altezza usata. */
    righe(t: string, o: { font: PDFFont; corpo: number; interlinea: number; x: number; larghezza: number; y: number; colore: Colore }) {
      let riga = ''
      let n = 0
      const manda = () => {
        this.testo(riga, { font: o.font, corpo: o.corpo, x: o.x, y: o.y + n * o.interlinea, colore: o.colore })
        n++
      }
      for (const p of t.split(' ')) {
        const prova = riga ? `${riga} ${p}` : p
        if (riga && o.font.widthOfTextAtSize(prova, o.corpo) > o.larghezza) {
          manda()
          riga = p
        } else riga = prova
      }
      if (riga) manda()
      return n * o.interlinea
    }

    /** Un titoletto: parola spaziata e filo fino al margine. */
    titoletto(t: string) {
      const { b } = this
      this.y += 6
      const corpo = 10
      const w = this.testo(t, { font: b.titoloFont, corpo, y: this.y + corpo, tracking: 0.05 * corpo * 3, colore: COL.inchiostro })
      this.pagina.drawLine({ start: { x: MARGINE + w + 10, y: A - this.y - corpo + 3 }, end: { x: L - MARGINE, y: A - this.y - corpo + 3 }, thickness: 0.8, color: colore(COL.filo) })
      this.y += corpo + 4
    }

    /** Un paragrafo di pezzi, in chiaro o in grassetto; con `casella` ha davanti una casella da crociare. */
    paragrafo(pezzi: Pezzo[], o: { corpo?: number; sotto?: number; casella?: string; rientro?: number } = {}) {
      const corpo = o.corpo ?? 9.4
      const interlinea = corpo * 1.3
      const rientro = o.casella ? 19 : (o.rientro ?? 0)
      const larghezza = L - 2 * MARGINE - rientro
      const parole: Pezzo[] = pezzi.flatMap((p) => p.t.split(' ').filter(Boolean).map((t) => ({ t, g: p.g })))
      const lista: Pezzo[][] = []
      let riga: Pezzo[] = []
      let w = 0
      const spazio = this.b.corpo.widthOfTextAtSize(' ', corpo)
      for (const p of parole) {
        const wp = (p.g ? this.b.grassetto : this.b.corpo).widthOfTextAtSize(p.t, corpo)
        if (riga.length && w + spazio + wp > larghezza) {
          lista.push(riga)
          riga = []
          w = 0
        }
        w += (riga.length ? spazio : 0) + wp
        riga.push(p)
      }
      if (riga.length) lista.push(riga)
      const alto = lista.length * interlinea
      if (this.y + alto > A - 92) this.nuovaPagina()
      if (o.casella) this.casella(o.casella, MARGINE, this.y + 1)
      lista.forEach((r, i) => {
        let x = MARGINE + rientro
        for (const p of r) {
          this.testo(p.t, { font: this.b.corpo, corpo, x, y: this.y + (i + 1) * interlinea - 2.4, colore: COL.inchiostro, grassetto: p.g })
          x += (p.g ? this.b.grassetto : this.b.corpo).widthOfTextAtSize(p.t, corpo) + spazio
        }
      })
      this.y += alto + (o.sotto ?? 5)
    }

    /** Una casella da crociare, col suo nome. */
    casella(nome: string, x: number, daAlto: number, lato = 11) {
      if (!this.form) return
      const c = this.form.createCheckBox(nome)
      c.addToPage(this.pagina, { x, y: A - daAlto - lato, width: lato, height: lato, borderWidth: 1.2, borderColor: colore(COL.blu), backgroundColor: rgb(1, 1, 1) })
    }

    /** Una riga di campi: ognuno ha il filo da scrivere, l'etichetta sotto e il suo nome. `flex` è la larghezza relativa. */
    campi(lista: Array<{ nome: string; etichetta: string; flex: number; prefisso?: string }>, o: { sopra?: number; alto?: number } = {}) {
      const { b } = this
      this.y += o.sopra ?? 6
      const gap = 10
      const totale = lista.reduce((s, c) => s + c.flex, 0)
      const utile = L - 2 * MARGINE - gap * (lista.length - 1)
      const altezza = o.alto ?? 15
      let x = MARGINE
      for (const c of lista) {
        const w = (utile * c.flex) / totale
        // Un posto vuoto (nome senza campo) serve a tenere corto il campo accanto.
        if (c.nome) {
          this.pagina.drawLine({ start: { x, y: A - this.y - altezza }, end: { x: x + w, y: A - this.y - altezza }, thickness: 0.9, color: colore(COL.blu) })
          this.testo(c.etichetta, { font: b.titoloFont, corpo: 8, x, y: this.y + altezza + 9, tracking: 0.9, colore: COL.tenue })
          // Un prefisso stampato («2» di 2026/27): il campo comincia dopo, e chi scrive non lo ripete.
          const dopo = c.prefisso ? this.testo(c.prefisso, { font: b.corpo, corpo: 9.4, x, y: this.y + altezza - 3.5, colore: COL.inchiostro }) - 1.5 : 0
          if (this.form) {
            const f = this.form.createTextField(c.nome)
            f.addToPage(this.pagina, { x: x + dopo, y: A - this.y - altezza, width: w - dopo, height: altezza - 1, borderWidth: 0, textColor: colore(COL.inchiostro) })
            f.setFontSize(0)
          }
        }
        x += w + gap
      }
      this.y += altezza + 14
    }
  }

  // ---------------------------------------------------------------------------------------------
  // Autorizzazioni dei maggiorenni
  const maggiorenni = async () => {
    const b = await nuovo('Autorizzazioni maggiorenni · ASD IL CENTRO JUDO')
    const form = b.pdf.getForm()
    const f = new Foglio(b, form, 'AUTORIZZAZIONI')
    f.titoletto('CHI FIRMA')
    f.campi([{ nome: 'nome', etichetta: 'IO SOTTOSCRITTO', flex: 1 }])
    f.titoletto('TESSERAMENTO')
    f.paragrafo([{ t: 'ACCONSENTO', g: true }], { casella: 'tesseramentoSi', sotto: 3 })
    f.paragrafo([{ t: 'non acconsento', g: true }], { casella: 'tesseramentoNo', sotto: 6 })
    f.paragrafo([{ t: 'L’associazione sportiva dilettantistica ASD IL CENTRO JUDO, a tesserarmi alla FIJLKAM e/o FIPE per l’anno' }], { sotto: 0 })
    f.campi([{ nome: 'tesseramentoAnno', etichetta: '', flex: 0.5, prefisso: '2' }, { nome: '', etichetta: '', flex: 3 }], { sopra: 4 })
    f.titoletto('IMMAGINI E FOTOGRAFIE')
    f.paragrafo([{ t: 'AUTORIZZO', g: true }], { casella: 'fotoSi', sotto: 3 })
    f.paragrafo([{ t: 'non autorizzo', g: true }], { casella: 'fotoNo', sotto: 6 })
    f.paragrafo([
      {
        t: 'La realizzazione e la pubblicazione sulle piattaforme social delle fotografie che mi ritraggono, consapevole che tale trattamento dei dati personali è regolato dall’art 320 Cod.Civ. e dal Regolamento UE 2016/679 (GDPR). Dichiaro inoltre di aver ricevuto tutte le informazioni necessarie in merito alla finalità e modalità di utilizzo delle immagini, e di prestare il mio consenso libero, specifico, informato e inequivocabile.',
      },
    ])
    f.titoletto('PRIVACY')
    f.paragrafo([{ t: 'Dichiaro di aver preso visione e accettare dell\'Informativa privacy sopra esposta' }], { casella: 'privacy' })
    f.paragrafo([
      {
        t: 'Acconsento al trattamento dei dati personali per finalità connesse all\'invio di comunicazioni informative e pubblicitarie relative alle iniziative promosse dall\'A.s.d. Il Centro Judo tra cui, a titolo esemplificativo, l\'attività di “Estate ragazzi”.',
      },
    ])
    f.campi([{ nome: 'data', etichetta: 'DATA', flex: 1 }, { nome: 'firma', etichetta: 'FIRMA', flex: 2.2 }], { sopra: 8, alto: 30 })
    return b.pdf.save()
  }

  // ---------------------------------------------------------------------------------------------
  // Autorizzazioni dei minori
  const minori = async () => {
    const b = await nuovo('Autorizzazioni minori · ASD IL CENTRO JUDO')
    const form = b.pdf.getForm()
    const f = new Foglio(b, form, 'AUTORIZZAZIONI MINORI')
    f.titoletto('CHI FIRMA')
    f.campi([
      { nome: 'genitore', etichetta: 'IL/LA SOTTOSCRITTO/A SIG./SIG.RA', flex: 3.3 },
      { nome: 'genitoreCodiceFiscale', etichetta: 'CODICE FISCALE', flex: 1.7 },
    ], { sopra: 2 })
    f.campi([
      { nome: 'genitoreNatoA', etichetta: 'NATO/A A', flex: 2.1 },
      { nome: 'genitoreProvincia', etichetta: 'PROV.', flex: 0.5 },
      { nome: 'genitoreNatoIl', etichetta: 'IL', flex: 0.9 },
      { nome: 'genitoreCap', etichetta: 'CAP', flex: 0.7 },
      { nome: 'genitoreResidenza', etichetta: 'RESIDENTE IN', flex: 1.3 },
    ])
    f.campi([
      { nome: 'genitoreVia', etichetta: 'VIA', flex: 3.3 },
      { nome: 'genitoreCivico', etichetta: 'N.', flex: 0.6 },
    ])
    f.titoletto('IL MINORE')
    f.paragrafo([{ t: 'esercente la responsabilità genitoriale o tutoria del minore' }])
    f.campi([
      { nome: 'minore', etichetta: 'NOME E COGNOME', flex: 2.8 },
      { nome: 'minoreNatoA', etichetta: 'NATO/A A', flex: 1.3 },
      { nome: 'minoreNatoIl', etichetta: 'IL', flex: 0.9 },
    ], { sopra: 2 })
    f.paragrafo([
      {
        t: 'partecipante ad allenamenti, gare, manifestazioni ed eventi organizzati dal Centro Judo presso la sede o altre strutture sportive, confermando fin da subito che analogo consenso è prestato anche dall’altro genitore,',
      },
    ])
    f.titoletto('IMMAGINI E VIDEO')
    f.paragrafo(
      [
        { t: 'AUTORIZZA', g: true },
        { t: 'il Centro Judo, con sede legale in Rivoli (TO) in corso Francia 224, Cod.Fisc. 95562500017, p.iva 10002760014, ad utilizzare, esclusivamente in relazione alle Attività organizzate dal Centro Judo, le' },
        { t: 'immagini fotografiche e/o le riprese video', g: true },
        { t: 'del Minore per le seguenti finalità: pubblicazione sui canali social ufficiali del Centro Judo (Instagram, Facebook, WhatsApp, YouTube); utilizzo in eventi promozionali e pubblicitari del Centro Judo (quali locandine, manifesti, brochure, volantini).' },
      ],
      { casella: 'foto' },
    )
    f.paragrafo([{ t: 'Il presente consenso è rilasciato senza limiti territoriali e senza limiti di tempo, salva revoca scritta da parte del genitore.' }])
    f.paragrafo([
      {
        t: 'Il/La sottoscritto/a rinuncia, fin da ora, a qualsiasi compenso o rimborso spese e manleva il Centro Judo da ogni responsabilità per un uso non autorizzato da terzi, fatta eccezione per condotte direttamente imputabili al Centro Judo stesso. È fatto salvo il divieto di riprodurre, utilizzare o pubblicare immagini del Minore in contesti che possano arrecare danno al suo sviluppo fisico, mentale o morale.',
      },
    ])
    f.paragrafo([{ t: 'Presto il consenso al trattamento dei dati personali e dell’immagine del minore per le finalità sopra indicate:' }], { sotto: 0 })
    f.campi([
      { nome: 'firmaFoto', etichetta: 'FIRMA DEL GENITORE/TUTORE 1', flex: 1 },
      { nome: 'firmaGenitore2', etichetta: 'FIRMA DEL GENITORE/TUTORE 2', flex: 1 },
    ], { sopra: 4, alto: 28 })
    f.titoletto('TESSERAMENTO')
    f.paragrafo(
      [
        { t: 'AUTORIZZA', g: true },
        { t: 'L’associazione sportiva dilettantistica ASD IL CENTRO JUDO, a' },
        { t: 'TESSERARE', g: true },
        { t: 'mio figlio alla FIJLKAM e/o FIPE per l’anno' },
      ],
      { casella: 'tesseramento', sotto: 0 },
    )
    f.campi([
      { nome: 'tesseramentoAnno', etichetta: '', flex: 0.5, prefisso: '2' },
      { nome: 'firmaTesseramento', etichetta: 'FIRMA', flex: 2 },
    ], { sopra: 2, alto: 28 })
    f.titoletto('PRIVACY')
    f.paragrafo([{ t: 'Dichiaro di aver preso visione e accettare dell\'Informativa privacy sopra esposta' }], { casella: 'privacy' })
    f.paragrafo([
      {
        t: 'Acconsento al trattamento dei dati personali per finalità connesse all\'invio di comunicazioni informative e pubblicitarie relative alle iniziative promosse dall\'A.s.d. Il Centro Judo tra cui, a titolo esemplificativo, l\'attività di “Estate ragazzi” o “randori di Araimondo”',
      },
    ], { sotto: 0 })
    f.campi([{ nome: 'data', etichetta: 'DATA', flex: 1 }, { nome: 'firma', etichetta: 'FIRMA', flex: 2.2 }], { sopra: 2, alto: 28 })
    return b.pdf.save()
  }

  // ---------------------------------------------------------------------------------------------
  // I costi, dai dati dell'app
  const costi = async () => {
    const b = await nuovo(`Costi ${STAGIONE.replace('/', '-')} · ASD IL CENTRO JUDO`)
    const f = new Foglio(b, null, 'OFFICINE DELLO SPORT')
    const maiuscola = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)
    const mese = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('it-IT', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    const conSaldo = saldoAperto(opz.oggi)
    const destra = L - MARGINE

    // Indirizzo, IBAN e stagione.
    const y0 = f.y + 16
    const riga = (t: string, y: number) => f.testo(t, { font: b.corpo, corpo: 10.5, x: MARGINE, y, colore: COL.inchiostro })
    riga('Via Vittorio Sassi 26, Collegno', y0)
    riga(`IBAN ${PAGAMENTO.iban}`, y0 + 15)
    riga(`intestato: ${PAGAMENTO.intestatario}`, y0 + 30)
    f.testo(`STAGIONE ${STAGIONE.replace('/', '-20')}`, { font: b.titoloFont, corpo: 24, destra, y: y0 + 8, tracking: 1.2, colore: COL.inchiostro })
    f.testo(`Quota associativa: ${QUOTA_ASSOCIATIVA}€, valida fino a ${mese(VALIDITA.quota.al)}`, { font: b.corpo, corpo: 10.5, destra, y: y0 + 30, colore: COL.inchiostro })
    f.y = y0 + 44

    // Le colonne: corso, età, giorni e orari, l'etichetta dei prezzi (1 GIORNO…), poi saldo (se c'è ancora), annuale, trimestre.
    const NUM = 60
    const ETICHETTA = 48
    const nNum = conSaldo ? 3 : 2
    const libero = destra - MARGINE - ETICHETTA - nNum * NUM
    const wCorso = libero * 0.34
    const wEta = libero * 0.25
    const wOrari = libero - wCorso - wEta
    const xEta = MARGINE + wCorso
    const xOrari = xEta + wEta
    const xEtichetta = xOrari + wOrari
    const fine = (i: number) => destra - (nNum - 1 - i) * NUM
    const intestazioni = conSaldo ? ['SALDO 31/8', 'ANNUALE', 'TRIMESTRE'] : ['ANNUALE', 'TRIMESTRE']

    const CORPO = 9.5
    const PICCOLO = 8
    const IL = 12.5
    /** A capo per parole; anche dopo un trattino («2016-2015-2014-2013» da solo supera la colonna). */
    const aCapo = (t: string, w: number, corpo: number, font: PDFFont = b.corpo) => {
      const pezzi = t.split(' ').flatMap((parola) => (parola.match(/[^-]+-?/g) ?? [parola]).map((p, i) => ({ p, spazio: i === 0 })))
      const out: string[] = []
      for (const { p, spazio } of pezzi) {
        const ultima = out[out.length - 1]
        const unito = ultima === undefined ? p : `${ultima}${spazio ? ' ' : ''}${p}`
        if (ultima !== undefined && font.widthOfTextAtSize(unito, corpo) < w) out[out.length - 1] = unito
        else out.push(p)
      }
      return out
    }
    const testata = () => {
      f.y += 6
      f.testo('CORSO', { font: b.titoloFont, corpo: 10, x: MARGINE, y: f.y + 8, tracking: 1.4, colore: COL.tenue })
      f.testo('ETÀ', { font: b.titoloFont, corpo: 10, x: xEta, y: f.y + 8, tracking: 1.4, colore: COL.tenue })
      f.testo('GIORNI E ORARI', { font: b.titoloFont, corpo: 10, x: xOrari, y: f.y + 8, tracking: 1.4, colore: COL.tenue })
      intestazioni.forEach((t, i) => f.testo(t, { font: b.titoloFont, corpo: 10, destra: fine(i), y: f.y + 8, tracking: 1.4, colore: COL.tenue }))
      f.pagina.drawLine({ start: { x: MARGINE, y: A - f.y - 14 }, end: { x: destra, y: A - f.y - 14 }, thickness: 1.5, color: colore(COL.blu) })
      f.y += 14
    }
    testata()

    for (const v of COSTI) {
      const nome = aCapo(v.corso.toUpperCase(), wCorso - 8, CORPO, b.grassetto)
      const eta = aCapo(maiuscola(v.eta), wEta - 8, CORPO)
      const orari = v.orari.flatMap((o) => aCapo(maiuscola(o), wOrari - 8, CORPO).map((t) => ({ t, piccolo: false })))
      if (v.nota) orari.push(...aCapo(v.nota, wOrari - 8, PICCOLO).map((t) => ({ t, piccolo: true })))
      const righe = Math.max(nome.length, eta.length, orari.length, v.prezzi.length + (v.notaTrimestre ? 1 : 0))
      const alto = righe * IL + 12
      if (f.y + alto > A - 92) {
        f.nuovaPagina()
        testata()
      }
      const base = f.y + 9 + IL * 0.6
      nome.forEach((t, i) => f.testo(t, { font: b.corpo, corpo: CORPO, x: MARGINE, y: base + i * IL, colore: COL.inchiostro, grassetto: true }))
      eta.forEach((t, i) => f.testo(t, { font: b.corpo, corpo: CORPO, x: xEta, y: base + i * IL, colore: COL.inchiostro }))
      orari.forEach((o, i) => f.testo(o.t, { font: b.corpo, corpo: o.piccolo ? PICCOLO : CORPO, x: xOrari, y: base + i * IL, colore: o.piccolo ? COL.tenue : COL.inchiostro }))
      v.prezzi.forEach((p, i) => {
        const y = base + i * IL
        if (p.etichetta) f.testo(p.etichetta, { font: b.corpo, corpo: PICCOLO, destra: xEtichetta + ETICHETTA - 6, y, colore: COL.tenue })
        const valori = conSaldo ? [p.saldo, p.annuale, p.trimestre] : [p.annuale, p.trimestre]
        valori.forEach((n, k) => n !== undefined && f.testo(`${n}€`, { font: b.corpo, corpo: CORPO, destra: fine(k), y, colore: COL.inchiostro, grassetto: true }))
      })
      if (v.notaTrimestre) f.testo(v.notaTrimestre, { font: b.corpo, corpo: PICCOLO, destra: fine(nNum - 1), y: base + v.prezzi.length * IL, colore: COL.tenue })
      f.pagina.drawLine({ start: { x: MARGINE, y: A - f.y - alto + 3 }, end: { x: destra, y: A - f.y - alto + 3 }, thickness: 0.7, color: colore(COL.filo) })
      f.y += alto
    }

    // Le offerte.
    for (const o of OFFERTE) {
      f.titoletto(o.titolo)
      f.paragrafo([{ t: o.testo }])
    }
    return b.pdf.save()
  }

  // ---------------------------------------------------------------------------------------------
  // La carta intestata: testata e piede e basta. La lettera d'incarico (letteraPdf.ts) ci scrive
  // sopra, così nell'app non servono i font del sito né fontkit.
  const carta = async () => {
    const b = await nuovo('Carta intestata · ASD IL CENTRO JUDO')
    new Foglio(b, null, 'ASSOCIAZIONE SPORTIVA DILETTANTISTICA')
    return b.pdf.save()
  }

  return { maggiorenni: await maggiorenni(), minori: await minori(), costi: await costi(), carta: await carta() }
}
