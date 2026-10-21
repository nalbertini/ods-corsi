// ---------------------------------------------------------------------------
// I numeri del sito per IL SITO in STATISTICHE: da quello che risponde
// GoatCounter ai conti che vede la segreteria.
//
// Questo file ha una copia identica in supabase/functions/conti-sito/
// numeri.ts: la funzione gira su Deno, che src/lib non lo legge. Per questo qui
// non si importa niente; `npm run prova:statistiche-sito` controlla che le due
// copie siano uguali. Si cambia qui e si ricopia là.
// ---------------------------------------------------------------------------

/** Il giorno in cui sul sito è stato acceso il contatore: prima non c'è niente da contare. */
export const SITO_DAL = '2026-10-20'

/** I clic che il sito conta (`data-goatcounter-click` di sitoGenera.ts), col nome che hanno su GoatCounter. */
const TASTI = ['iscriviti', 'chiama', 'scrivici'] as const
type Tasto = (typeof TASTI)[number]
const eTasto = (x: string): x is Tasto => TASTI.some((t) => t === x)

export interface MeseSito {
  /** `AAAA-MM`. */
  mese: string
  /** Le visite (la stessa persona entro 8 ore è una visita), senza i clic. */
  visite: number
  iscriviti: number
  chiama: number
  scrivici: number
}

export interface PaginaSito {
  titolo: string
  percorso: string
  visite: number
}

export interface ProvenienzaSito {
  nome: string
  visite: number
}

/** Quelle che non stanno fra le prime cinque, messe insieme. */
export interface AltreSito {
  quante: number
  visite: number
}

export interface NumeriSito {
  mesi: MeseSito[]
  visite: number
  iscriviti: number
  chiama: number
  scrivici: number
  /** Le cinque pagine più lette, senza la 404 e senza i clic. */
  pagine: PaginaSito[]
  altrePagine: AltreSito
  /** Le cinque provenienze più grandi, senza il diretto. */
  provenienze: ProvenienzaSito[]
  altreProvenienze: AltreSito
  /** Indirizzo scritto a mano, link da WhatsApp, app che non lo dicono. */
  diretto: number
  /** Numeri inventati della modalità prova. */
  prova?: boolean
  /** GoatCounter ha dato solo il totale di qualche clic: i mesi di quei clic sono spartiti come le visite. */
  stimati?: boolean
}

/** Un giorno `AAAA-MM-GG` che esiste davvero. */
export function giornoValido(g: unknown): g is string {
  if (typeof g !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(g)) return false
  const [a, m, d] = g.split('-').map(Number)
  const x = new Date(Date.UTC(a, m - 1, d))
  return x.getUTCFullYear() === a && x.getUTCMonth() === m - 1 && x.getUTCDate() === d
}

/** L'ultima domenica di un mese, alle 01:00 UTC: lì cambia l'ora in tutta l'Unione europea. */
function cambioOra(anno: number, mese: number): number {
  const ultimo = new Date(Date.UTC(anno, mese + 1, 0))
  return Date.UTC(anno, mese, ultimo.getUTCDate() - ultimo.getUTCDay(), 1)
}

/**
 * La mezzanotte di un giorno a Roma, in UTC. Senza Intl: le regole dell'ora legale sono quelle europee
 * (dall'ultima domenica di marzo all'ultima di ottobre, alle 01:00 UTC), così la funzione e l'app contano uguale.
 */
export function inizioGiornoRoma(g: string): Date {
  const [a, m, d] = g.split('-').map(Number)
  // La mezzanotte di Roma è alle 22:00 o alle 23:00 UTC del giorno prima: si prova con l'ora legale e si guarda se c'era.
  const legale = Date.UTC(a, m - 1, d) - 2 * 3_600_000
  const estate = legale >= cambioOra(a, 2) && legale < cambioOra(a, 9)
  return new Date(estate ? legale : legale + 3_600_000)
}

const dopo = (g: string) => {
  const [a, m, d] = g.split('-').map(Number)
  return new Date(Date.UTC(a, m - 1, d + 1)).toISOString().slice(0, 10)
}
// GoatCounter vuole le ore tonde; a Roma la mezzanotte in UTC lo è sempre.
const rfc = (x: Date) => x.toISOString().replace(/\.\d{3}Z$/, 'Z')

/** Il primo giorno che si conta: il 20 ottobre 2026, se il periodo comincia prima. */
export const primoGiorno = (da: string) => (da < SITO_DAL ? SITO_DAL : da)

/** Da quando a quando chiedere a GoatCounter, in UTC: `null` se tutto il periodo è prima del contatore. */
export function intervalloSito(da: string, a: string): { start: string; end: string } | null {
  const primo = primoGiorno(da)
  if (a < primo) return null
  return { start: rfc(inizioGiornoRoma(primo)), end: rfc(inizioGiornoRoma(dopo(a))) }
}

/** I mesi `AAAA-MM` del periodo, dal più vecchio; quelli prima del contatore non ci sono. */
export function mesiDelPeriodo(da: string, a: string): string[] {
  const primo = primoGiorno(da)
  const x: string[] = []
  let [anno, mese] = primo.slice(0, 7).split('-').map(Number)
  const fine = a.slice(0, 7)
  while (`${anno}-${String(mese).padStart(2, '0')}` <= fine) {
    x.push(`${anno}-${String(mese).padStart(2, '0')}`)
    mese++
    if (mese > 12) {
      mese = 1
      anno++
    }
  }
  return x
}

// Quello che risponde GoatCounter si legge senza fidarsi: un campo che manca vale zero. `as` perché un oggetto di JSON
// è un Record qualunque, e ogni campo si guarda poi come `unknown`.
const oggetto = (x: unknown): Record<string, unknown> => (x && typeof x === 'object' ? (x as Record<string, unknown>) : {})
const elenco = (x: unknown): Record<string, unknown>[] => (Array.isArray(x) ? x.map(oggetto) : [])
const numero = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) && x > 0 ? x : 0)
// L'indirizzo che conta le visite è pubblico: chiunque può mandare un titolo lungo. All'app arrivano al massimo 120 caratteri.
const testo = (x: unknown) => (typeof x === 'string' ? x.slice(0, 120) : '')

/** I giorni di una statistica (`stats` di GoatCounter): `day` e `daily`, o la somma di `hourly`. */
function giorni(x: unknown): Array<{ giorno: string; n: number }> {
  return elenco(x).map((s) => {
    const ore = Array.isArray(s.hourly) ? s.hourly.reduce<number>((t, h) => t + numero(h), 0) : 0
    return { giorno: testo(s.day), n: typeof s.daily === 'number' ? numero(s.daily) : ore }
  })
}

/** Le voci di /stats/hits, anche su più pagine: `hits` è una risposta o l'elenco delle risposte, nell'ordine. */
const vociDi = (hits: unknown) => (Array.isArray(hits) ? hits : [hits]).flatMap((r) => elenco(oggetto(r).hits))

/** Se GoatCounter ha altre voci oltre quelle date (`more`). */
export const ancoraVoci = (risposta: unknown) => oggetto(risposta).more === true

/** Le voci già lette, da escludere nella pagina dopo (`exclude_paths`, gli id dei percorsi separati da virgole). */
export const giaViste = (risposte: unknown[]) =>
  risposte
    .flatMap((r) => elenco(oggetto(r).hits))
    .map((h) => h.path_id)
    .filter((x): x is number => typeof x === 'number' && Number.isInteger(x))
    .join(',')

/**
 * `n` spartito sui mesi in proporzione ai pesi, a numeri interi che fanno sempre `n` (i resti più grandi prendono
 * uno in più, a parità il mese prima). Senza pesi va tutto nell'ultimo mese.
 */
function spartisci(n: number, pesi: number[]): number[] {
  const tot = pesi.reduce((s, x) => s + x, 0)
  if (!pesi.length) return []
  if (!tot) return pesi.map((_, i) => (i === pesi.length - 1 ? n : 0))
  const esatti = pesi.map((x) => (n * x) / tot)
  const parti = esatti.map(Math.floor)
  let resto = n - parti.reduce((s, x) => s + x, 0)
  const ordine = esatti.map((x, i) => [x - Math.floor(x), i]).sort((p, q) => q[0] - p[0] || p[1] - q[1])
  for (const [, i] of ordine) {
    if (resto <= 0) break
    parti[i]++
    resto--
  }
  return parti
}

/** La 404 del sito si conta col titolo «404» (sitoGenera.ts): non è una pagina da mostrare. */
const e404 = (h: Record<string, unknown>) => testo(h.title).trim() === '404' || /^\/?404(\.html)?$/.test(testo(h.path))

function primeCinque<T extends { visite: number }>(x: T[]): { prime: T[]; altre: AltreSito } {
  const ordinate = [...x].sort((p, q) => q.visite - p.visite)
  const resto = ordinate.slice(5)
  return { prime: ordinate.slice(0, 5), altre: { quante: resto.length, visite: resto.reduce((s, p) => s + p.visite, 0) } }
}

/** I nomi con cui GoatCounter dice «non si sa da dove»: senza referrer, o sconosciuto. */
const DIRETTO = new Set(['', '(unknown)', '(no data)', 'unknown'])

/**
 * Il riassunto per la segreteria. `totale` è la risposta di /stats/total, `hits` quella di /stats/hits (pagine e clic; o l'elenco delle sue pagine),
 * `refs` quella di /stats/toprefs; `da` e `a` i giorni del periodo, a Roma. Le visite di un mese sono quelle di
 * GoatCounter meno i clic (che GoatCounter conta insieme); i giorni sono quelli di GoatCounter, in UTC: a cavallo
 * di due mesi una visita di mezzanotte può finire nel mese accanto, ed è il motivo per cui i numeri sono indicativi.
 */
export function riassumi(totale: unknown, hits: unknown, refs: unknown, da: string, a: string): NumeriSito {
  const primo = primoGiorno(da)
  const mesi = new Map(mesiDelPeriodo(da, a).map((m) => [m, { mese: m, visite: 0, iscriviti: 0, chiama: 0, scrivici: 0 }]))
  const nel = (g: string) => (g >= primo && g <= a ? mesi.get(g.slice(0, 7)) : undefined)

  for (const { giorno, n } of giorni(oggetto(totale).stats)) {
    const m = nel(giorno)
    if (m) m.visite += n
  }
  const tutte = vociDi(hits)
  const pesi = [...mesi.values()].map((m) => m.visite)
  let stimati = false
  for (const h of tutte.filter((x) => x.event === true)) {
    const nome = testo(h.path).replace(/^\//, '').toLowerCase()
    const tasto = eTasto(nome) ? nome : null
    const giorniClic = giorni(h.stats)
    // Senza i giorni c'è solo il totale: piuttosto che perderlo, si spartisce sui mesi come le visite, e lo si dice.
    const parti = giorniClic.length ? null : spartisci(numero(h.count), pesi)
    if (parti) {
      stimati = true
      ;[...mesi.values()].forEach((m, i) => {
        m.visite -= parti[i]
        if (tasto) m[tasto] += parti[i]
      })
    }
    for (const { giorno, n } of giorniClic) {
      const m = nel(giorno)
      if (!m) continue
      m.visite -= n
      if (tasto) m[tasto] += n
    }
  }
  const righe = [...mesi.values()].map((m) => ({ ...m, visite: Math.max(0, m.visite) }))

  const pagine = primeCinque(
    tutte
      .filter((h) => h.event !== true && !e404(h))
      .map((h) => ({ titolo: testo(h.title).trim() || testo(h.path), percorso: testo(h.path), visite: numero(h.count) })),
  )
  const voci = elenco(oggetto(refs).hits).map((r) => ({ nome: testo(r.name).trim(), visite: numero(r.count) }))
  const provenienze = primeCinque(voci.filter((r) => !DIRETTO.has(r.nome.toLowerCase())))
  const somma = (k: keyof Omit<MeseSito, 'mese'>) => righe.reduce((s, m) => s + m[k], 0)
  return {
    mesi: righe,
    visite: somma('visite'),
    iscriviti: somma('iscriviti'),
    chiama: somma('chiama'),
    scrivici: somma('scrivici'),
    pagine: pagine.prime,
    altrePagine: pagine.altre,
    provenienze: provenienze.prime,
    altreProvenienze: provenienze.altre,
    diretto: voci.filter((r) => DIRETTO.has(r.nome.toLowerCase())).reduce((s, r) => s + r.visite, 0),
    ...(stimati && { stimati }),
  }
}
