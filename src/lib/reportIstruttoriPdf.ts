import type { PDFFont, PDFPage } from 'pdf-lib'
import { scrivibileCon } from './firma'
import { chiaveGiorno, giornoPerEsteso, oraDi } from './sala'
import type { PresenzaIstruttoreSeg } from './segreteria'

/**
 * Il report delle presenze degli istruttori di un mese o di un anno, da
 * stampare: un A4 in verticale con in testa il periodo e i filtri, poi i
 * numeri del periodo, le tabelle per istruttore, per corso, per mese (se il
 * periodo ne ha più d'uno) e per giorno della settimana, e in fondo il
 * dettaglio di ogni lezione, istruttore per istruttore.
 *
 * Contano le ore delle presenze confermate, dall'orario delle lezioni: sono
 * quelle da pagare. Quelle da confermare e le rifiutate si dicono a parte.
 *
 * Le misure sono in punti PDF contati dall'alto (`y` qui sotto li gira).
 */

const PAGINA = { w: 595.28, h: 841.89 }
const MARGINE = 42
const LARGO = PAGINA.w - 2 * MARGINE
const FONDO = PAGINA.h - 48
const RIGA = 15

const GIORNI = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica']
const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre']

/**
 * Il marchio a ingranaggi, lo stesso di `components/Logo.tsx` (viewBox
 * 160×110): i denti sono un cerchio tratteggiato, l'anello uno pieno.
 * L'ingranaggio bianco, sulla carta, è nero.
 */
const INGRANAGGI: Array<[number, number, [number, number, number]]> = [
  [38, 40, [0x1b, 0x8a, 0xc4]],
  [80, 40, [0x11, 0x11, 0x11]],
  [122, 40, [0xe4, 0x29, 0x2a]],
  [59, 74, [0xf4, 0xc3, 0x1b]],
  [101, 74, [0x16, 0xa5, 0x4a]],
]

export interface FiltriReport {
  /** «Ottobre 2026», «Anno 2026». */
  periodo: string
  corso?: string
  istruttore?: string
  /** Più di un mese: c'è la tabella mese per mese. */
  piuMesi: boolean
  /** Le lezioni tenute senza l'istruttore segnato, da decidere anche loro. */
  lezioniDaConfermare?: number
}

const minuti = (x: PresenzaIstruttoreSeg) => Math.round((Date.parse(x.fine) - Date.parse(x.inizio)) / 60_000)
const ore = (m: number) => (m / 60).toLocaleString('it-IT', { maximumFractionDigits: 1 })
const intero = (n: number) => n.toLocaleString('it-IT')
const percento = (parte: number, tutto: number) => (tutto ? `${Math.round((100 * parte) / tutto)}%` : '—')
const perNome = (a: string, b: string) => a.localeCompare(b, 'it')

interface Gruppo {
  nome: string
  confermate: PresenzaIstruttoreSeg[]
  daConfermare: number
  rifiutate: number
}

/** Le presenze divise per una chiave, coi conti di ogni gruppo. */
function raggruppa(righe: PresenzaIstruttoreSeg[], chiave: (x: PresenzaIstruttoreSeg) => [string, string]) {
  const gruppi = new Map<string, Gruppo>()
  for (const x of righe) {
    const [k, nome] = chiave(x)
    const g = gruppi.get(k) ?? { nome, confermate: [], daConfermare: 0, rifiutate: 0 }
    if (x.stato === 'confermata') g.confermate.push(x)
    else if (x.stato === 'da_confermare') g.daConfermare++
    else g.rifiutate++
    gruppi.set(k, g)
  }
  return [...gruppi.entries()]
}
const totale = (xs: PresenzaIstruttoreSeg[]) => xs.reduce((t, x) => t + minuti(x), 0)

/** I conti del report, a parte dal disegno: si provano anche senza PDF. */
export function contiReport(righe: PresenzaIstruttoreSeg[]) {
  const confermate = righe.filter((x) => x.stato === 'confermata')
  const minutiTotali = totale(confermate)
  const perIstruttore = raggruppa(righe, (x) => [x.personaId, x.nome])
    .map(([, g]) => g)
    .sort((a, b) => totale(b.confermate) - totale(a.confermate) || perNome(a.nome, b.nome))
  const perCorso = raggruppa(righe, (x) => [x.corso, x.corso])
    .map(([, g]) => g)
    .sort((a, b) => totale(b.confermate) - totale(a.confermate) || perNome(a.nome, b.nome))
  const perMese = raggruppa(righe, (x) => {
    const d = new Date(x.inizio)
    return [`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, `${MESI[d.getMonth()]} ${d.getFullYear()}`]
  })
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([, g]) => g)
  const perGiorno = raggruppa(righe, (x) => {
    const g = (new Date(x.inizio).getDay() + 6) % 7
    return [String(g), GIORNI[g]]
  })
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([, g]) => g)
  return {
    confermate,
    minutiTotali,
    daConfermare: righe.filter((x) => x.stato === 'da_confermare').length,
    rifiutate: righe.filter((x) => x.stato === 'rifiutata').length,
    // Confermate in lezioni in cui non erano previsti: aiuti e sostituzioni non segnate.
    fuoriProgramma: confermate.filter((x) => !x.prevista).length,
    istruttori: new Set(confermate.map((x) => x.personaId)).size,
    corsi: new Set(confermate.map((x) => x.corso)).size,
    perIstruttore,
    perCorso,
    perMese,
    perGiorno,
  }
}

interface Colonna {
  titolo: string
  largo: number
  destra?: boolean
}

export async function reportIstruttoriPdf(righe: PresenzaIstruttoreSeg[], f: FiltriReport, ente: string): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib')
  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const grassetto = await pdf.embedFont(StandardFonts.HelveticaBold)
  const nero = rgb(0.1, 0.1, 0.1)
  const grigio = rgb(0.42, 0.42, 0.42)
  const linea = rgb(0.82, 0.82, 0.82)
  const fondo = rgb(0.95, 0.95, 0.95)
  const rosso = rgb(0.75, 0.12, 0.12)
  const scrivibile = scrivibileCon(font)
  const y = (alto: number) => PAGINA.h - alto

  const c = contiReport(righe)
  const ordinate = [...righe].sort((a, b) => a.inizio.localeCompare(b.inizio))

  let p: PDFPage = pdf.addPage([PAGINA.w, PAGINA.h])
  let t = MARGINE

  const testo = (s: string, x: number, alto: number, o: { corpo?: number; f?: PDFFont; colore?: ReturnType<typeof rgb>; fino?: number; destra?: boolean } = {}) => {
    const corpo = o.corpo ?? 9
    const ff = o.f ?? font
    let v = scrivibile(s)
    // Quel che non ci sta si accorcia coi puntini.
    if (o.fino) while (v.length > 1 && ff.widthOfTextAtSize(v, corpo) > o.fino) v = v.slice(0, -2) + '…'
    const w = ff.widthOfTextAtSize(v, corpo)
    p.drawText(v, { x: o.destra && o.fino ? x + o.fino - w : x, y: y(alto), size: corpo, font: ff, color: o.colore ?? nero })
  }

  /** Il logo largo `largo` punti, con l'angolo in alto a sinistra in (x, alto). */
  const logo = (x: number, alto: number, largo: number) => {
    const k = largo / 160
    const colore = ([r, g, b]: [number, number, number]) => rgb(r / 255, g / 255, b / 255)
    for (const [cx, cy, c] of INGRANAGGI) {
      p.drawCircle({ x: x + cx * k, y: y(alto + cy * k), size: 22 * k, borderColor: colore(c), borderWidth: 9 * k, borderDashArray: [6 * k, 7.82 * k] })
    }
    for (const [cx, cy, c] of INGRANAGGI) {
      p.drawCircle({ x: x + cx * k, y: y(alto + cy * k), size: 14 * k, borderColor: colore(c), borderWidth: 5 * k })
    }
  }

  const nuovaPagina = () => {
    p = pdf.addPage([PAGINA.w, PAGINA.h])
    t = MARGINE
    testo(`${ente} · Presenze istruttori · ${f.periodo}`, MARGINE, t + 8, { corpo: 8, colore: grigio })
    logo(MARGINE + LARGO - 34, t - 8, 34)
    t += 24
  }
  /** C'è posto per `alto` punti? Se no, si va a capo pagina. */
  const posto = (alto: number) => {
    if (t + alto > FONDO) nuovaPagina()
  }

  const titolo = (s: string) => {
    posto(RIGA * 4)
    t += 10
    testo(s.toUpperCase(), MARGINE, t + 11, { corpo: 11, f: grassetto })
    t += 18
  }

  const tabella = (colonne: Colonna[], righe: string[][], o: { ultimaGrassetto?: boolean } = {}) => {
    const scala = LARGO / colonne.reduce((s, x) => s + x.largo, 0)
    const xs: number[] = []
    let x = MARGINE
    for (const col of colonne) {
      xs.push(x)
      x += col.largo * scala
    }
    const testa = () => {
      p.drawRectangle({ x: MARGINE, y: y(t + RIGA), width: LARGO, height: RIGA, color: fondo })
      colonne.forEach((col, i) =>
        testo(col.titolo, xs[i] + 4, t + 10.5, { corpo: 7.5, f: grassetto, colore: grigio, fino: col.largo * scala - 8, destra: col.destra }),
      )
      t += RIGA
    }
    posto(RIGA * 3)
    testa()
    righe.forEach((r, n) => {
      if (t + RIGA > FONDO) {
        nuovaPagina()
        testa()
      }
      const forte = o.ultimaGrassetto && n === righe.length - 1
      colonne.forEach((col, i) => testo(r[i] ?? '', xs[i] + 4, t + 10.5, { f: forte ? grassetto : font, fino: col.largo * scala - 8, destra: col.destra }))
      t += RIGA
      p.drawLine({ start: { x: MARGINE, y: y(t) }, end: { x: MARGINE + LARGO, y: y(t) }, thickness: 0.5, color: linea })
    })
    t += 6
  }

  // La testa, col logo a destra.
  logo(MARGINE + LARGO - 96, t - 6, 96)
  testo(ente, MARGINE, t + 9, { corpo: 9, colore: grigio })
  testo('Report presenze istruttori', MARGINE, t + 32, { corpo: 20, f: grassetto })
  testo(f.periodo, MARGINE, t + 52, { corpo: 13 })
  const filtri = [f.corso && `Corso: ${f.corso}`, f.istruttore && `Istruttore: ${f.istruttore}`].filter(Boolean).join(' · ')
  testo(filtri || 'Tutti i corsi e tutti gli istruttori', MARGINE, t + 68, { corpo: 9, colore: grigio })
  const oggi = new Date()
  testo(`Stampato il ${giornoPerEsteso(chiaveGiorno(oggi))} ${oggi.getFullYear()}, ${oraDi(oggi.toISOString())}`, MARGINE, t + 68, {
    corpo: 8,
    colore: grigio,
    fino: LARGO,
    destra: true,
  })
  t += 84

  // I numeri del periodo, in riquadri.
  const numeri: Array<[string, string, string]> = [
    ['LEZIONI', intero(c.confermate.length), 'confermate'],
    ['ORE', ore(c.minutiTotali), 'dall’orario delle lezioni'],
    ['ISTRUTTORI', intero(c.istruttori), `su ${intero(c.corsi)} ${c.corsi === 1 ? 'corso' : 'corsi'}`],
    ['DA CONFERMARE', intero(c.daConfermare + (f.lezioniDaConfermare ?? 0)), c.daConfermare + (f.lezioniDaConfermare ?? 0) ? 'da decidere prima di pagare' : 'niente in sospeso'],
  ]
  const wq = (LARGO - 3 * 8) / 4
  numeri.forEach(([n, v, s], i) => {
    const x = MARGINE + i * (wq + 8)
    p.drawRectangle({ x, y: y(t + 58), width: wq, height: 58, borderColor: linea, borderWidth: 0.8 })
    testo(n, x + 8, t + 14, { corpo: 7.5, f: grassetto, colore: grigio })
    testo(v, x + 8, t + 38, { corpo: 20, f: grassetto, colore: n === 'DA CONFERMARE' && v !== '0' ? rosso : nero })
    testo(s, x + 8, t + 50, { corpo: 7, colore: grigio, fino: wq - 16 })
  })
  t += 70

  // Due righe da leggere, per l'analisi.
  const mediaLezione = c.confermate.length ? Math.round(c.minutiTotali / c.confermate.length) : 0
  const frasi = [
    c.confermate.length
      ? `In media ${ore(c.minutiTotali / Math.max(c.istruttori, 1))} ore per istruttore e ${intero(mediaLezione)} minuti a lezione.`
      : 'Nessuna lezione confermata nel periodo.',
    c.fuoriProgramma
      ? `${intero(c.fuoriProgramma)} ${c.fuoriProgramma === 1 ? 'lezione confermata è' : 'lezioni confermate sono'} fuori programma (${percento(c.fuoriProgramma, c.confermate.length)}): l’istruttore non era previsto, la segreteria l’ha confermato.`
      : 'Tutte le lezioni confermate erano di chi era previsto.',
    c.rifiutate ? `${intero(c.rifiutate)} ${c.rifiutate === 1 ? 'presenza rifiutata' : 'presenze rifiutate'}, che non contano.` : '',
    f.lezioniDaConfermare
      ? `${intero(f.lezioniDaConfermare)} ${f.lezioniDaConfermare === 1 ? 'lezione tenuta' : 'lezioni tenute'} senza l’istruttore segnato: chi c’era va scelto in PRESENZE ISTRUTTORI.`
      : '',
  ].filter(Boolean)
  for (const s of frasi) {
    testo(s, MARGINE, t + 9, { corpo: 9, fino: LARGO })
    t += 13
  }

  const conto = (g: Gruppo) => [intero(g.confermate.length), ore(totale(g.confermate))]
  const riga_totale = ['Totale', intero(c.confermate.length), ore(c.minutiTotali)]

  titolo('Per istruttore')
  tabella(
    [
      { titolo: 'ISTRUTTORE', largo: 150 },
      { titolo: 'LEZIONI', largo: 55, destra: true },
      { titolo: 'ORE', largo: 50, destra: true },
      { titolo: 'SULLE ORE', largo: 60, destra: true },
      { titolo: 'CORSI', largo: 45, destra: true },
      { titolo: 'FUORI PROGR.', largo: 70, destra: true },
      { titolo: 'DA CONF.', largo: 55, destra: true },
      { titolo: 'RIFIUTATE', largo: 60, destra: true },
    ],
    [
      ...c.perIstruttore.map((g) => [
        g.nome,
        ...conto(g),
        percento(totale(g.confermate), c.minutiTotali),
        intero(new Set(g.confermate.map((x) => x.corso)).size),
        intero(g.confermate.filter((x) => !x.prevista).length),
        intero(g.daConfermare),
        intero(g.rifiutate),
      ]),
      [...riga_totale, c.minutiTotali ? '100%' : '—', intero(c.corsi), intero(c.fuoriProgramma), intero(c.daConfermare), intero(c.rifiutate)],
    ],
    { ultimaGrassetto: true },
  )

  titolo('Per corso')
  tabella(
    [
      { titolo: 'CORSO', largo: 150 },
      { titolo: 'LEZIONI', largo: 55, destra: true },
      { titolo: 'ORE', largo: 50, destra: true },
      { titolo: 'SULLE ORE', largo: 60, destra: true },
      { titolo: 'ISTRUTTORI', largo: 180 },
      { titolo: 'DA CONF.', largo: 55, destra: true },
    ],
    [
      ...c.perCorso.map((g) => [
        g.nome,
        ...conto(g),
        percento(totale(g.confermate), c.minutiTotali),
        [...new Set(g.confermate.map((x) => x.nome))].sort(perNome).join(', '),
        intero(g.daConfermare),
      ]),
      [...riga_totale, c.minutiTotali ? '100%' : '—', '', intero(c.daConfermare)],
    ],
    { ultimaGrassetto: true },
  )

  if (f.piuMesi && c.perMese.length) {
    titolo('Mese per mese')
    tabella(
      [
        { titolo: 'MESE', largo: 150 },
        { titolo: 'LEZIONI', largo: 70, destra: true },
        { titolo: 'ORE', largo: 70, destra: true },
        { titolo: 'ISTRUTTORI', largo: 80, destra: true },
        { titolo: 'DA CONF.', largo: 70, destra: true },
        { titolo: 'RIFIUTATE', largo: 70, destra: true },
      ],
      [
        ...c.perMese.map((g) => [g.nome, ...conto(g), intero(new Set(g.confermate.map((x) => x.personaId)).size), intero(g.daConfermare), intero(g.rifiutate)]),
        [...riga_totale, intero(c.istruttori), intero(c.daConfermare), intero(c.rifiutate)],
      ],
      { ultimaGrassetto: true },
    )
  }

  if (c.perGiorno.length) {
    titolo('Per giorno della settimana')
    tabella(
      [
        { titolo: 'GIORNO', largo: 150 },
        { titolo: 'LEZIONI', largo: 70, destra: true },
        { titolo: 'ORE', largo: 70, destra: true },
        { titolo: 'SULLE ORE', largo: 70, destra: true },
      ],
      c.perGiorno.map((g) => [g.nome, ...conto(g), percento(totale(g.confermate), c.minutiTotali)]),
    )
  }

  // Il dettaglio, istruttore per istruttore.
  titolo('Dettaglio delle lezioni')
  const perChi = [...new Set(ordinate.map((x) => x.personaId))]
    .map((id) => ordinate.filter((x) => x.personaId === id))
    .sort((a, b) => perNome(a[0].nome, b[0].nome))
  const STATO = { confermata: 'confermata', da_confermare: 'da confermare', rifiutata: 'rifiutata' } as const
  for (const xs of perChi) {
    const fatte = xs.filter((x) => x.stato === 'confermata')
    posto(RIGA * 4)
    testo(`${xs[0].nome}`, MARGINE, t + 10, { corpo: 10, f: grassetto })
    testo(`${intero(fatte.length)} ${fatte.length === 1 ? 'lezione confermata' : 'lezioni confermate'}, ${ore(totale(fatte))} ore`, MARGINE, t + 10, { corpo: 8, colore: grigio, fino: LARGO, destra: true })
    t += 16
    tabella(
      [
        { titolo: 'GIORNO', largo: 120 },
        { titolo: 'ORARIO', largo: 70 },
        { titolo: 'ORE', largo: 35, destra: true },
        { titolo: 'CORSO', largo: 140 },
        { titolo: 'SALA', largo: 70 },
        { titolo: 'STATO', largo: 110 },
      ],
      xs.map((x) => {
        const d = new Date(x.inizio)
        const gg = (n: number) => String(n).padStart(2, '0')
        return [
          `${GIORNI[(d.getDay() + 6) % 7].slice(0, 3).toLowerCase()} ${gg(d.getDate())}/${gg(d.getMonth() + 1)}/${d.getFullYear()}`,
          `${oraDi(x.inizio)}–${oraDi(x.fine)}`,
          ore(minuti(x)),
          x.corso,
          x.sala ?? '',
          `${STATO[x.stato]}${x.stato === 'confermata' && !x.prevista ? ', fuori progr.' : ''}`,
        ]
      }),
    )
  }
  if (!perChi.length) testo('Nessuna presenza nel periodo.', MARGINE, t + 10, { colore: grigio })

  // I numeri di pagina, quando si sa quante sono.
  const pagine = pdf.getPages()
  pagine.forEach((pg, i) => {
    const s = `Pagina ${i + 1} di ${pagine.length}`
    pg.drawText(s, { x: PAGINA.w - MARGINE - font.widthOfTextAtSize(s, 7.5), y: 26, size: 7.5, font, color: grigio })
  })

  pdf.setTitle(`Presenze istruttori · ${f.periodo}`)
  pdf.setAuthor(ente)
  pdf.setCreationDate(oggi)
  return pdf.save()
}

/** Il PDF scaricato dal browser, col suo nome: si apre e si stampa. */
export async function scaricaReportIstruttori(righe: PresenzaIstruttoreSeg[], f: FiltriReport, ente: string) {
  const byte = await reportIstruttoriPdf(righe, f, ente)
  const url = URL.createObjectURL(new Blob([byte as BlobPart], { type: 'application/pdf' }))
  const a = document.createElement('a')
  a.href = url
  a.download = ['report presenze istruttori', f.periodo, f.corso, f.istruttore].filter(Boolean).join(' ').toLowerCase().replace(/\s+/g, '-') + '.pdf'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
