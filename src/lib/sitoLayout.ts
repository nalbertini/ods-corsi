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

/** L'ultimo paragrafo di una citazione è la firma se è tutto in em o in strong, o comincia con «—». */
function citazione(b: Blocco, colore: string, larga: boolean): string {
  const dentro = blocchi(contenuto(b))
  const ultimo = dentro[dentro.length - 1]
  const firma = ultimo && ultimo.tag === 'p' && (/^<p[^>]*>\s*<(em|strong)>[\s\S]*<\/\1>\s*<\/p>$/i.test(ultimo.html) || /^<p[^>]*>\s*—/.test(ultimo.html))
  const corpo = dentro.map((x) => (x === ultimo && firma ? `<p class="firma">${contenuto(x)}</p>` : x.html)).join('')
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

const tessera = (colore: string, titolo: string, resto: string, prima = '') =>
  `<article class="tessera ${colore}">${prima}${titolo.trim() ? `<h3>${titolo}</h3>` : ''}${resto}</article>`

/** Le tessere di una sezione con sottotitoli: una per `h3`, con quel che lo segue. */
function tessereDaSottotitoli(gruppi: Array<{ titolo: string; corpo: Blocco[] }>): string {
  const domande = gruppi.length > 0 && gruppi.every((g) => /\?\s*$/.test(testoSolo(g.titolo)))
  const html = gruppi.map((g, i) => {
    const colore = domande ? 'chiara' : ROTAZIONE[i % ROTAZIONE.length]
    const foto = g.corpo.map(immagine).filter((x): x is string => x !== null)
    const resto = g.corpo.filter((b) => immagine(b) === null).map((b) => b.html).join('')
    return tessera(colore, g.titolo, resto, foto.join(''))
  })
  return griglie(html)
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
      else fuori.push(`<div class="citazioni" tabindex="0" role="region" aria-label="${esc(testoSolo(titolo) || 'Citazioni')}">${q.map((y, k) => citazione(y, CITAZIONI[k % CITAZIONI.length], false)).join('')}</div>`)
      i = j
      continue
    }
    if (immagine(x) !== null) {
      let j = i
      while (j < b.length && immagine(b[j]) !== null) j++
      // Una foto in mezzo a un testo in colonna resta com'è: è tessera solo se apre o chiude la parte.
      if (i === 0 || j === b.length) {
        chiudiColonna()
        const f = b.slice(i, j).map((y) => immagine(y) as string)
        for (let k = 0; k < f.length; ) {
          const resto = f.length - k
          if (resto === 1) { fuori.push(griglia(1, `<figure class="tessera foto larga">${f[k]}</figure>`)); k += 1 }
          else {
            const n = Math.min(3, resto)
            fuori.push(`<div class="foto-fila${n === 2 ? ' due' : ''}">${f.slice(k, k + n).map((y) => `<figure class="tessera foto">${y}</figure>`).join('')}</div>`)
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
      fuori.push(griglie(voci.map((v, k) => tessera(ROTAZIONE[k % ROTAZIONE.length], v.titolo, v.testo ? `<p>${v.testo}</p>` : ''))))
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
