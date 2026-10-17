/**
 * Dal testo della segreteria al layout a tessere (design A2).
 *
 * Il testo arriva già ripulito da `pulisciTesto`: i tag sono quelli ammessi e
 * nessuna classe, tranne `a.pulsante`. Qui si mettono le classi e i contenitori,
 * che la segreteria non può scrivere. La regola, in breve:
 *  - ogni `h2` apre una sezione col titolo grande;
 *  - ogni `h3` con quel che lo segue (fino al prossimo `h3` o `h2`) è una tessera,
 *    e le tessere di una sezione sono una griglia a filo;
 *  - in una sezione senza `h3`, un `ul` corto è una fila di tessere, più
 *    citazioni di fila scorrono di lato, una foto sola o una fila di foto sono
 *    tessere foto; il resto sta in colonna, come prima.
 * Niente script: lo scorrimento di lato è solo CSS (`scroll-snap`).
 */

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

/** I colori delle tessere, nell'ordine in cui ruotano; a ogni sezione si riparte da blu. */
const ROTAZIONE = ['blu', 'giallo', 'inchiostro', 'chiara'] as const
/** I colori del design per le griglie che il design disegna: i 9 corsi e i 4 valori. Le altre quantità ruotano. */
const COLORI_DEL_DESIGN: Record<number, string[]> = {
  4: ['giallo', 'blu', 'inchiostro', 'giallo'],
  9: ['blu', 'giallo', 'inchiostro', 'giallo', 'inchiostro', 'blu', 'inchiostro', 'blu', 'giallo'],
}
const coloreDi = (k: number, n: number) => COLORI_DEL_DESIGN[n]?.[k] ?? ROTAZIONE[k % ROTAZIONE.length]
/** Le icone delle etichette dei corsi (Phosphor, come nel design): il nome dell'etichetta → i tracciati dell'svg. */
const ICONE: Record<string, string> = {
  Bambini: '<path d="M92,140a12,12,0,1,1,12-12A12,12,0,0,1,92,140Zm72-24a12,12,0,1,0,12,12A12,12,0,0,0,164,116Zm-12.27,45.23a45,45,0,0,1-47.46,0,8,8,0,0,0-8.54,13.54,61,61,0,0,0,64.54,0,8,8,0,0,0-8.54-13.54ZM232,128A104,104,0,1,1,128,24,104.11,104.11,0,0,1,232,128Zm-16,0a88.11,88.11,0,0,0-84.09-87.91C120.32,56.38,120,71.88,120,72a8,8,0,0,0,16,0,8,8,0,0,1,16,0,24,24,0,0,1-48,0c0-.73.13-14.3,8.46-30.63A88,88,0,1,0,216,128Z"/>',
  Adulti: '<path d="M128,80A32,32,0,1,0,96,48,32,32,0,0,0,128,80Zm0-48a16,16,0,1,1-16,16A16,16,0,0,1,128,32ZM230.86,132.12a8,8,0,0,1-11,2.74c-.35-.21-35.11-20.59-83.88-22.67V149l62,69.73a8,8,0,1,1-12,10.62L128,164,70,229.31a8,8,0,1,1-12-10.62L120,149V112.18c-49,2.08-83.52,22.46-83.88,22.68a8,8,0,1,1-8.23-13.72C29.6,120.11,70.45,96,128,96s98.4,24.11,100.12,25.14A8,8,0,0,1,230.86,132.12Z"/>',
  Agonisti: '<path d="M232,64H208V48a8,8,0,0,0-8-8H56a8,8,0,0,0-8,8V64H24A16,16,0,0,0,8,80V96a40,40,0,0,0,40,40h3.65A80.13,80.13,0,0,0,120,191.61V216H96a8,8,0,0,0,0,16h64a8,8,0,0,0,0-16H136V191.58c31.94-3.23,58.44-25.64,68.08-55.58H208a40,40,0,0,0,40-40V80A16,16,0,0,0,232,64ZM48,120A24,24,0,0,1,24,96V80H48v32q0,4,.39,8Zm144-8.9c0,35.52-29,64.64-64,64.9a64,64,0,0,1-64-64V56H192ZM232,96a24,24,0,0,1-24,24h-.5a81.81,81.81,0,0,0,.5-8.9V80h24Z"/>',
  Anziani: '<path d="M128,80A32,32,0,1,0,96,48,32,32,0,0,0,128,80Zm0-48a16,16,0,1,1-16,16A16,16,0,0,1,128,32Zm96,72a8,8,0,0,1-8,8H136v26.72l51.15,21.93A8,8,0,0,1,192,168v48a8,8,0,0,1-16,0V173.28l-46.45-19.91L53.35,222a8,8,0,1,1-10.7-11.9L120,140.44V112H40a8,8,0,0,1,0-16H216A8,8,0,0,1,224,104Z"/>',
}

/** Le citazioni alternano questi due. */
const CITAZIONI = ['blu', 'inchiostro'] as const

/** Un elenco corto diventa tessere: da 2 a 12 voci, ognuna di al massimo 200 caratteri. */
const VOCI_MIN = 2
const VOCI_MAX = 12
const VOCE_LUNGA = 200

interface Blocco {
  tag: string
  html: string
}

const VUOTI = new Set(['img', 'br', 'hr'])

/** Il testo ripulito è piatto: si spezza nei blocchi di primo livello (anche con tag dello stesso nome annidati). */
function blocchi(html: string): Blocco[] {
  const fuori: Blocco[] = []
  let i = 0
  while (i < html.length) {
    if (/\s/.test(html[i])) { i++; continue }
    const apre = /^<([a-z][a-z0-9]*)\b[^>]*>/i.exec(html.slice(i))
    if (!apre) {
      const fine = html.indexOf('<', i)
      const pezzo = html.slice(i, fine < 0 ? html.length : fine)
      fuori.push({ tag: '', html: pezzo })
      i += pezzo.length
      continue
    }
    const tag = apre[1].toLowerCase()
    if (VUOTI.has(tag)) { fuori.push({ tag, html: apre[0] }); i += apre[0].length; continue }
    let profondita = 1
    let k = i + apre[0].length
    const re = new RegExp(`<(/?)${tag}\\b[^>]*>`, 'gi')
    re.lastIndex = k
    let m: RegExpExecArray | null
    while ((m = re.exec(html))) {
      profondita += m[1] ? -1 : 1
      k = m.index + m[0].length
      if (profondita === 0) break
    }
    fuori.push({ tag, html: html.slice(i, k) })
    i = k
  }
  return fuori
}

const testoSolo = (h: string) => h.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
const contenuto = (b: Blocco) => b.html.replace(/^<[^>]*>/, '').replace(/<\/[^>]*>$/, '')

/** Un'immagine da sola: `<img>` o `<p><img></p>`. Restituisce il tag. */
function immagine(b: Blocco): string | null {
  if (b.tag === 'img') return b.html
  if (b.tag === 'p') {
    const m = /^<p[^>]*>\s*(<img\b[^>]*>)\s*<\/p>$/i.exec(b.html)
    return m ? m[1] : null
  }
  return null
}

/** Le iniziali (al massimo due) del nome di una firma: il ruolo dopo « - » o «—» non conta. */
function iniziali(firma: string): string {
  const nome = testoSolo(firma).replace(/^[\s—–-]+/, '').split(/\s+[-–—]\s+/)[0]
  return nome
    .split(/\s+/)
    .filter((p) => /\p{L}/u.test(p))
    .slice(0, 2)
    .map((p) => p.match(/\p{L}/u)?.[0].toUpperCase() ?? '')
    .join('')
}

/** La firma con l'avatar delle iniziali; senza lettere resta com'è. */
function conAvatar(firma: string): string {
  const sigla = iniziali(firma)
  return sigla ? `<span class="avatar" aria-hidden="true">${sigla}</span><span class="nome">${firma}</span>` : firma
}

/** L'ultimo paragrafo di una citazione è la firma se è tutto in em o in strong, o comincia con «—». */
function citazione(b: Blocco, colore: string, larga: boolean): string {
  const dentro = blocchi(contenuto(b))
  const ultimo = dentro[dentro.length - 1]
  const firma = ultimo && ultimo.tag === 'p' && (/^<p[^>]*>\s*<(em|strong)>[\s\S]*<\/\1>\s*<\/p>$/i.test(ultimo.html) || /^<p[^>]*>\s*—/.test(ultimo.html))
  const corpo = dentro.map((x) => (x === ultimo && firma ? `<p class="firma">${conAvatar(contenuto(x))}</p>` : x.html)).join('')
  return `<blockquote class="tessera citazione ${colore}${larga ? ' larga' : ''}">${corpo}</blockquote>`
}

/** Le griglie che hanno la loro classe `n-N` (e le loro regole di larghezza nel CSS del sito): da 1 a 16 tessere. */
export const GRIGLIA_MASSIMA = 16

/** Il contenitore di N tessere: la griglia si sceglie dalla classe `n-N`. */
function griglia(n: number, figli: string): string {
  return `<div class="tessere n-${n}">${figli}</div>`
}

/** Le tessere in una o più griglie: oltre le 16 si spezzano a gruppi di 12, così nessuna griglia ha celle vuote. */
const TESSERE_PER_GRIGLIA = 12
function griglie(tessere: string[]): string {
  if (tessere.length <= GRIGLIA_MASSIMA) return griglia(tessere.length, tessere.join(''))
  const fuori: string[] = []
  for (let i = 0; i < tessere.length; i += TESSERE_PER_GRIGLIA) {
    const pezzo = tessere.slice(i, i + TESSERE_PER_GRIGLIA)
    fuori.push(griglia(pezzo.length, pezzo.join('')))
  }
  return fuori.join('')
}

/** Un `ul` corto (2–12 voci, al massimo 200 caratteri) si legge come tessere: il grassetto iniziale è il titolo. */
function vociDiUnElenco(b: Blocco): Array<{ titolo: string; testo: string }> | null {
  if (b.tag !== 'ul') return null
  const li = [...b.html.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)].map((m) => m[1])
  if (li.length < VOCI_MIN || li.length > VOCI_MAX) return null
  // Un elenco dentro un elenco resta un elenco: spezzarlo per voci romperebbe i tag.
  if (li.some((x) => testoSolo(x).length > VOCE_LUNGA || /<(ul|ol)\b/i.test(x))) return null
  if (/<(ul|ol)\b/i.test(b.html.slice(b.html.indexOf('>') + 1))) return null
  return li.map((x) => {
    const g = /^\s*<strong>([\s\S]*?)<\/strong>\s*:?\s*([\s\S]*)$/i.exec(x)
    return g ? { titolo: g[1], testo: g[2].replace(/^[\s:,;–-]+/, '') } : { titolo: '', testo: x }
  })
}

/** Il paragrafo con le etichette di una scheda: «Bambini · Adulti» in pastiglie, con l'icona se la conosciamo. */
function etichette(elenco: string): string {
  const voci = elenco.split(/\s*·\s*/).map((x) => x.trim()).filter((x) => x && x.length <= 24 && !/[<>]/.test(x))
  if (!voci.length) return ''
  return `<p class="etichette">${voci.map((x) => `<span class="etichetta">${ICONE[x] ? `<svg width="20" height="20" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true">${ICONE[x]}</svg>` : ''}${x}</span>`).join('')}</p>`
}

/**
 * Il corpo di una scheda di un elenco: una foto dentro la voce va prima del titolo (si vede sul telefono), un corsivo
 * in fondo («Bambini · Adulti») diventa le etichette, il resto è il testo.
 */
function corpoScheda(testo: string): { prima: string; corpo: string } {
  const foto = /<img\b[^>]*>/i.exec(testo)?.[0]
  let resto = foto ? testo.replace(foto, '') : testo
  let tag = ''
  const fine = /\s*<em>([^<]*)<\/em>\s*$/i.exec(resto)
  if (fine) {
    tag = etichette(fine[1])
    if (tag) resto = resto.slice(0, fine.index)
  }
  resto = resto.trim()
  return { prima: foto ? `<div class="corso-foto">${foto}</div>` : '', corpo: `${resto ? `<p>${resto}</p>` : ''}${tag}` }
}

const tessera = (colore: string, titolo: string, resto: string, prima = '') =>
  `<article class="tessera ${colore}">${prima}${titolo.trim() ? `<h3>${titolo}</h3>` : ''}${resto}</article>`

/** Le tessere di una sezione con sottotitoli: una per `h3`, con quel che lo segue. */
function tessereDaSottotitoli(gruppi: Array<{ titolo: string; corpo: Blocco[] }>): string {
  const domande = gruppi.length > 0 && gruppi.every((g) => /\?\s*$/.test(testoSolo(g.titolo)))
  const html = gruppi.map((g, i) => {
    const colore = domande ? 'chiara' : coloreDi(i, gruppi.length)
    const foto = g.corpo.map(immagine).filter((x): x is string => x !== null)
    const resto = g.corpo.filter((b) => immagine(b) === null).map((b) => b.html).join('')
    return tessera(colore, g.titolo, resto, foto.join(''))
  })
  return griglie(html)
}

/** Due o più citazioni di fila: scorrono di lato, alternando blu e inchiostro. */
function citazioniScorrevoli(q: Blocco[], titolo: string): string {
  return `<div class="citazioni" tabindex="0" role="region" aria-label="${esc(testoSolo(titolo) || 'Citazioni')}">${q.map((y, k) => citazione(y, CITAZIONI[k % CITAZIONI.length], false)).join('')}</div>`
}

/** Un pezzo di sezione senza sottotitoli (o prima del primo): colonna, citazioni, foto, elenco a tessere. */
function corpoSenzaSottotitoli(b: Blocco[], titolo: string): string {
  const fuori: string[] = []
  let colonna: string[] = []
  const chiudiColonna = () => {
    if (colonna.length) fuori.push(`<div class="colonna">${colonna.join('')}</div>`)
    colonna = []
  }
  const elenchi = b.filter((x) => vociDiUnElenco(x) !== null).length
  for (let i = 0; i < b.length; ) {
    const x = b[i]
    if (x.tag === 'blockquote') {
      let j = i
      while (j < b.length && b[j].tag === 'blockquote') j++
      chiudiColonna()
      const q = b.slice(i, j)
      if (q.length === 1) fuori.push(griglia(1, citazione(q[0], 'blu', true)))
      else fuori.push(citazioniScorrevoli(q, titolo))
      i = j
      continue
    }
    if (immagine(x) !== null) {
      let j = i
      while (j < b.length && immagine(b[j]) !== null) j++
      // Una foto sola davanti a due o più citazioni: la foto sta a sinistra e le citazioni scorrono a fianco (design).
      if (j === i + 1 && b[j]?.tag === 'blockquote' && b[j + 1]?.tag === 'blockquote') {
        let k = j
        while (k < b.length && b[k].tag === 'blockquote') k++
        chiudiColonna()
        fuori.push(`<div class="citazioni-foto"><figure class="tessera foto">${immagine(x)}</figure>${citazioniScorrevoli(b.slice(j, k), titolo)}</div>`)
        i = k
        continue
      }
      // Una foto in mezzo a un testo in colonna resta com'è: è tessera solo se apre o chiude la parte.
      if (i === 0 || j === b.length) {
        chiudiColonna()
        const f = b.slice(i, j).map((y) => immagine(y) as string)
        for (let k = 0; k < f.length; ) {
          const resto = f.length - k
          if (resto === 1) { fuori.push(griglia(1, `<figure class="tessera foto larga">${f[k]}</figure>`)); k += 1 }
          else {
            // Quattro foto sono la fascia alta del design; con 5, 6 e 7 si resta sulle file da tre.
            const n = resto === 4 || resto >= 8 ? 4 : Math.min(3, resto)
            fuori.push(`<div class="foto-fila${n === 2 ? ' due' : n === 4 ? ' quattro' : ''}">${f.slice(k, k + n).map((y) => `<figure class="tessera foto">${y}</figure>`).join('')}</div>`)
            k += n
          }
        }
      } else colonna.push(...b.slice(i, j).map((y) => y.html))
      i = j
      continue
    }
    const voci = elenchi === 1 ? vociDiUnElenco(x) : null
    if (voci) {
      chiudiColonna()
      fuori.push(griglie(voci.map((v, k) => { const c = corpoScheda(v.testo); return tessera(coloreDi(k, voci.length), v.titolo, c.corpo, c.prima) })))
      i++
      continue
    }
    colonna.push(x.html)
    i++
  }
  chiudiColonna()
  return fuori.join('')
}

function sezione(titolo: string, corpo: Blocco[]): string {
  const primo = corpo.findIndex((b) => b.tag === 'h3')
  if (primo < 0) return `<section class="sezione"><h2>${titolo}</h2>${corpoSenzaSottotitoli(corpo, titolo)}</section>`
  const prima = corpo.slice(0, primo)
  const gruppi: Array<{ titolo: string; corpo: Blocco[] }> = []
  for (const b of corpo.slice(primo)) {
    if (b.tag === 'h3') gruppi.push({ titolo: contenuto(b), corpo: [] })
    else gruppi[gruppi.length - 1].corpo.push(b)
  }
  return `<section class="sezione"><h2>${titolo}</h2>${prima.length ? corpoSenzaSottotitoli(prima, titolo) : ''}${tessereDaSottotitoli(gruppi)}</section>`
}

/**
 * Il testo di una pagina a tessere. Il chiamante lo usa solo per le pagine non di legge che hanno almeno un `h2`:
 * senza titoli il testo resta una colonna, come prima. Quello che precede il primo `h2` è l'introduzione, in colonna.
 */
export function impagina(testoPulito: string): string {
  const b = blocchi(testoPulito)
  const primo = b.findIndex((x) => x.tag === 'h2')
  if (primo < 0) return testoPulito.trim() ? `<div class="testo">${testoPulito}</div>` : ''
  const intro = b.slice(0, primo).map((x) => x.html).join('')
  const fuori: string[] = []
  if (intro.trim()) fuori.push(`<div class="testo">${intro}</div>`)
  let i = primo
  while (i < b.length) {
    const titolo = contenuto(b[i])
    let j = i + 1
    while (j < b.length && b[j].tag !== 'h2') j++
    fuori.push(sezione(titolo, b.slice(i + 1, j)))
    i = j
  }
  return fuori.join('')
}

/** Nel collage della Home: al massimo tre foto e sei numeri; il resto resta nel testo, com'era scritto. */
const COLLAGE_FOTO = 3
const NUMERI_MIN = 2
const NUMERI_MAX = 6
/** Un numero è «lungo» (scritta piccola) se il grassetto supera 30 caratteri o il resto supera 40. */
const CIFRA_LUNGA = 30
const SCRITTA_LUNGA = 40

/**
 * Le foto del collage: la prima si carica subito, le altre quando servono. Gli attributi li mette il generatore, dopo la
 * pulizia (che ammette solo `src` e `alt`): così un testo non può scriverli. Il tag esce con `>` anche se arrivava con `/>`.
 */
function conCaricamento(tag: string, prima: boolean): string {
  const attributi = prima ? ' fetchpriority="high" decoding="async"' : ' loading="lazy" decoding="async"'
  return tag.replace(/\s*\/?>$/, `${attributi}>`)
}

/** Un `ul` di 2–6 voci che cominciano tutte con un grassetto: il grassetto è il numero, il resto la scritta. */
function numeriDiUnElenco(b: Blocco): Array<{ cifra: string; scritta: string }> | null {
  if (b.tag !== 'ul') return null
  const li = [...b.html.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)].map((m) => m[1])
  if (li.length < NUMERI_MIN || li.length > NUMERI_MAX || /<(ul|ol)\b/i.test(b.html.slice(b.html.indexOf('>') + 1))) return null
  const fuori: Array<{ cifra: string; scritta: string }> = []
  for (const x of li) {
    const m = /^\s*<strong>([\s\S]*?)<\/strong>([\s\S]*)$/i.exec(x)
    if (!m || !testoSolo(m[1])) return null
    fuori.push({ cifra: m[1], scritta: m[2].trim() })
  }
  return fuori
}

/** Il collage pieno del design: 4 foto e un elenco di 9 voci sono le 13 tessere (foto grande, 9 voci, 3 foto). */
const PIENO_FOTO = 4
const PIENO_VOCI = 9
/** I colori delle 9 voci, come nel design (A2 «TatamiBlu»): non seguono la rotazione. */
const COLORI_PIENO = ['blu', 'giallo', 'giallo', 'inchiostro', 'giallo', 'blu', 'inchiostro', 'giallo', 'blu']

function vociPiene(b: Blocco): string[] | null {
  if (b.tag !== 'ul') return null
  const li = [...b.html.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)].map((m) => m[1])
  if (li.length !== PIENO_VOCI || /<(ul|ol)\b/i.test(b.html.slice(b.html.indexOf('>') + 1))) return null
  return li
}

/** Grassetto e resto: un numero; solo il grassetto: un titolo; niente grassetto: una nota. */
function tesseraPiena(voce: string, colore: string): string {
  const m = /^\s*<strong>([\s\S]*?)<\/strong>([\s\S]*)$/i.exec(voce)
  if (!m || !testoSolo(m[1])) return `<article class="tessera ${colore} nota"><span class="scritta">${voce.trim()}</span></article>`
  const resto = m[2].trim()
  // «Titolo» a capo e un corsivo: la scritta sotto si vede solo sul telefono (design).
  const sotto = /^<br\s*\/?>\s*<em>([\s\S]*)<\/em>$/i.exec(resto)
  if (sotto) return `<article class="tessera ${colore} titolo"><strong class="titolo">${m[1]}</strong><span class="sotto">${sotto[1]}</span></article>`
  if (!resto) return `<article class="tessera ${colore} titolo"><strong class="titolo">${m[1]}</strong></article>`
  return `<article class="tessera ${colore} numero"><strong class="cifra">${m[1]}</strong> <span class="scritta">${resto}</span></article>`
}

/**
 * La testata della Home: dall'introduzione (il testo prima del primo `h2`) prende le prime tre foto e, se c'è un solo
 * elenco di 2–6 voci con il grassetto iniziale, i numeri. Restituisce la griglia e il testo che resta (le altre foto,
 * i paragrafi, gli elenchi che non sono numeri, e tutte le sezioni). Senza foto né numeri: niente collage.
 */
export function collage(testoPulito: string): { html: string; resto: string } {
  const b = blocchi(testoPulito)
  const primoTitolo = b.findIndex((x) => x.tag === 'h2')
  const finePresentazione = primoTitolo < 0 ? b.length : primoTitolo
  const intro = b.slice(0, finePresentazione)
  const usati = new Set<number>()
  const fotoTutte = intro.map((x, i) => ({ img: immagine(x), i })).filter((y): y is { img: string; i: number } => y.img !== null)
  const liste = intro.map((x, i) => ({ voci: vociPiene(x), i })).filter((y) => y.voci !== null)
  if (fotoTutte.length === PIENO_FOTO && liste.length === 1 && intro.filter((x) => x.tag === 'ul').length === 1) {
    const tessere = (liste[0].voci ?? []).map((v, k) => tesseraPiena(v, COLORI_PIENO[k]))
    const f = fotoTutte.map((y, k) => `<figure class="tessera foto ${k === 0 ? 'grande' : 'meta'}">${conCaricamento(y.img, k === 0)}</figure>`)
    const dentro = new Set([...fotoTutte.map((y) => y.i), liste[0].i])
    return { html: `<div class="collage pieno">${f[0]}${tessere.join('')}${f.slice(1).join('')}</div>`, resto: b.filter((_, i) => !dentro.has(i)).map((x) => x.html).join('') }
  }
  const foto: string[] = []
  intro.forEach((x, i) => {
    const img = immagine(x)
    if (img !== null && foto.length < COLLAGE_FOTO) { foto.push(img); usati.add(i) }
  })
  const elenchi = intro.map((x, i) => ({ x, i })).filter((y) => y.x.tag === 'ul')
  const numeri = elenchi.length === 1 ? numeriDiUnElenco(elenchi[0].x) : null
  if (numeri) usati.add(elenchi[0].i)
  if (!foto.length && !numeri) return { html: '', resto: testoPulito }

  const tessereFoto = foto.map((img, k) => {
    const tipo = k === 0 ? 'grande' : foto.length === 2 ? 'larga' : 'meta'
    const classe = foto.length === 1 && !numeri ? 'larga' : tipo
    return `<figure class="tessera foto ${classe}">${conCaricamento(img, k === 0)}</figure>`
  })
  const elencoNumeri = numeri ?? []
  const tessereNumeri = elencoNumeri.map((n, k) => {
    const lunga = testoSolo(n.cifra).length > CIFRA_LUNGA || testoSolo(n.scritta).length > SCRITTA_LUNGA
    // Sul telefono i numeri stanno a due colonne: con un numero dispari l'ultimo occupa tutte e due.
    const ultima = k === elencoNumeri.length - 1 && elencoNumeri.length % 2 === 1
    return `<article class="tessera ${ROTAZIONE[k % ROTAZIONE.length]} numero${lunga ? ' lunga' : ''}${ultima ? ' ultima' : ''}"><strong class="cifra">${n.cifra}</strong>${n.scritta ? ` <span class="scritta">${n.scritta}</span>` : ''}</article>`
  })
  const html = foto.length
    ? foto.length === 1 && !numeri
      ? griglia(1, tessereFoto[0])
      : `<div class="collage">${tessereFoto[0]}${tessereNumeri.join('')}${tessereFoto.slice(1).join('')}</div>`
    : griglia(tessereNumeri.length, tessereNumeri.join(''))
  const resto = b.filter((_, i) => !usati.has(i)).map((x) => x.html).join('')
  return { html, resto }
}
