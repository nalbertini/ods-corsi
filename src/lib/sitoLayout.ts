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

/** Più citazioni di fila: un carosello che scorre di lato, con il nome della sezione per chi usa la tastiera. */
function carosello(q: Blocco[], titolo: string): string {
  return `<div class="citazioni" tabindex="0" role="region" aria-label="${esc(testoSolo(titolo) || 'Citazioni')}">${q.map((y, k) => citazione(y, CITAZIONI[k % CITAZIONI.length], false)).join('')}</div>`
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

/** Nella pagina di un corso i colori ripartono dal giallo e la quarta tessera torna al giallo (docs/sito/corso.md). */
const ROTAZIONE_CORSO = ['giallo', 'blu', 'inchiostro'] as const

/** Un orario: il primo paragrafo è solo un grassetto (l'ora), i paragrafi dopo sono i dettagli (giorni, età). */
const ORA = /^<p[^>]*>\s*<strong>[\s\S]*<\/strong>\s*<\/p>$/i
const inOrario = (corpo: Blocco[]) => corpo.length > 0 && ORA.test(corpo[0].html)
function tesseraOrario(colore: string, titolo: string, corpo: Blocco[]): string {
  const dettagli = corpo.slice(1).map((b) => b.html).join('')
  return `<article class="tessera ${colore} orario"><h3>${titolo}</h3><p class="ora">${contenuto(corpo[0])}</p>${dettagli ? `<div class="dettagli">${dettagli}</div>` : ''}</article>`
}

/** Le tessere di una sezione con sottotitoli: una per `h3`, con quel che lo segue. */
function tessereDaSottotitoli(gruppi: Array<{ titolo: string; corpo: Blocco[] }>, corso = false): string {
  const domande = gruppi.length > 0 && gruppi.every((g) => /\?\s*$/.test(testoSolo(g.titolo)))
  const orari = corso && gruppi.length > 0 && gruppi.every((g) => inOrario(g.corpo))
  const palette = corso ? ROTAZIONE_CORSO : ROTAZIONE
  const html = gruppi.map((g, i) => {
    if (orari) return tesseraOrario(i === gruppi.length - 1 ? 'giallo' : 'chiara', g.titolo, g.corpo)
    const colore = domande ? 'chiara' : palette[i % palette.length]
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
      else fuori.push(carosello(q, titolo))
      i = j
      continue
    }
    if (immagine(x) !== null) {
      let j = i
      while (j < b.length && immagine(b[j]) !== null) j++
      // Una sola foto in apertura seguita da almeno due citazioni: la foto a sinistra e il carosello a destra.
      if (i === 0 && j === 1) {
        let q = j
        while (q < b.length && b[q].tag === 'blockquote') q++
        if (q - j >= 2) {
          chiudiColonna()
          fuori.push(`<div class="foto-citazioni"><figure class="tessera foto">${immagine(x)}</figure>${carosello(b.slice(j, q), titolo)}</div>`)
          i = q
          continue
        }
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

/** Una sezione con un solo paragrafo breve, in un corso, è la banda blu con la frase grande. */
const BANDA_MAX = 160

function sezione(titolo: string, corpo: Blocco[], corso = false): string {
  if (corso && corpo.length === 1 && corpo[0].tag === 'p' && testoSolo(corpo[0].html).length <= BANDA_MAX) return `<section class="sezione banda"><div class="banda-int"><h2>${titolo}</h2>${corpo[0].html}</div></section>`
  const primo = corpo.findIndex((b) => b.tag === 'h3')
  if (primo < 0) return `<section class="sezione"><h2>${titolo}</h2>${corpoSenzaSottotitoli(corpo, titolo)}</section>`
  const prima = corpo.slice(0, primo)
  const gruppi: Array<{ titolo: string; corpo: Blocco[] }> = []
  for (const b of corpo.slice(primo)) {
    if (b.tag === 'h3') gruppi.push({ titolo: contenuto(b), corpo: [] })
    else gruppi[gruppi.length - 1].corpo.push(b)
  }
  return `<section class="sezione"><h2>${titolo}</h2>${prima.length ? corpoSenzaSottotitoli(prima, titolo) : ''}${tessereDaSottotitoli(gruppi, corso)}</section>`
}

/**
 * Il testo di una pagina a tessere. Il chiamante lo usa solo per le pagine non di legge che hanno almeno un `h2`:
 * senza titoli il testo resta una colonna, come prima. Quello che precede il primo `h2` è l'introduzione, in colonna.
 */
export function impagina(testoPulito: string, corso = false): string {
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
    fuori.push(sezione(titolo, b.slice(i + 1, j), corso))
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

/**
 * La testata della pagina di un corso: il testo prima del primo `h2` che comincia con una foto, poi un elenco di dati
 * (2–6 voci col grassetto iniziale) e poi solo `h3` con il loro testo. La foto è a tutta larghezza, i dati sono una
 * riga di tessere, gli `h3` la presentazione. Se la forma non è questa non è un corso: `null`, e la pagina resta com'era.
 * `resto` è il testo dal primo `h2` in poi.
 */
export function testataCorso(testoPulito: string): { html: string; resto: string } | null {
  const b = blocchi(testoPulito)
  const fine = b.findIndex((x) => x.tag === 'h2')
  const intro = fine < 0 ? b : b.slice(0, fine)
  const foto = intro[0] ? immagine(intro[0]) : null
  const dati = intro[1] ? vociDiUnElenco(intro[1]) : null
  const presentazione = intro.slice(2)
  if (foto === null || !dati || dati.length > NUMERI_MAX || presentazione.length === 0 || presentazione[0].tag !== 'h3') return null
  const gruppi: Array<{ titolo: string; corpo: Blocco[] }> = []
  for (const x of presentazione) {
    if (x.tag === 'h3') gruppi.push({ titolo: contenuto(x), corpo: [] })
    else gruppi[gruppi.length - 1].corpo.push(x)
  }
  const colore = (k: number) => ROTAZIONE_CORSO[k % ROTAZIONE_CORSO.length]
  const html = [
    griglia(1, `<figure class="tessera foto larga">${foto}</figure>`),
    `<div class="tessere n-${dati.length} dati">${dati.map((v, k) => tessera(colore(k), v.titolo, v.testo ? `<p>${v.testo}</p>` : '')).join('')}</div>`,
    griglia(gruppi.length, gruppi.map((g, k) => tessera(colore(k), g.titolo, g.corpo.map((x) => x.html).join(''))).join('')),
  ].join('')
  return { html: `<section class="corso-testata">${html}</section>`, resto: b.slice(fine < 0 ? b.length : fine).map((x) => x.html).join('') }
}
