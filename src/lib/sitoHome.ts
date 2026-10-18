/**
 * La Home rivista (docs/design-canvas/home-miglioramenti/): dal testo incollato nel pannello SITO alle sezioni del design.
 *
 * Il testo nuovo si riconosce da un pulsante verso il modulo online nell'introduzione (prima del primo `h2`): senza,
 * la Home resta quella di oggi (`collage` + `impagina`) finché la segreteria non incolla il testo nuovo. Ogni sezione si
 * riconosce dalla forma, mai dal titolo, perché la segreteria può cambiarlo. Una forma che non torna si impagina come
 * le altre pagine (`sezione`). Le classi sono generiche (`.scheda`, `.pulsanti`, `.cta`…): le altre pagine le potranno
 * chiedere con la stessa convenzione. Il testo non si accorcia né si riscrive mai: il «Leggi tutto» mostra soltanto
 * l'estratto che la segreteria ha scritto prima del testo intero.
 */

import { PILLOLE, blocchi, coloreDi, conCaricamento, contenuto, gruppiDa, griglia, immagine, iniziali, numeriDiUnElenco, sezione, sonoCorsi, testoSolo, type Blocco } from './sitoLayout'

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

/** Stesso indirizzo anche scritto con http, con www o senza «/» in fondo: una svista della segreteria non deve lasciare la vecchia Home senza dirlo. */
export const eIscrizione = (href: string, iscrizione: string) => {
  const forma = (u: string) => u.trim().toLowerCase().replace(/^https?:\/\/(www\.)?/, '').replace(/\/+$/, '')
  return forma(href) === forma(iscrizione)
}

export interface Link { href: string; resto: string; testo: string }

/** I link `a.pulsante` di un blocco `p` fatto solo di pulsanti (spazi a parte); altrimenti null. */
export function pulsantiDi(b: Blocco): Link[] | null {
  if (b.tag !== 'p') return null
  const dentro = contenuto(b)
  const a = [...dentro.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)]
  if (!a.length || dentro.replace(/<a\b[^>]*>[\s\S]*?<\/a>/gi, '').replace(/<br\s*\/?>|\s/gi, '') !== '') return null
  const fuori = a.map((m) => ({ href: /\bhref="([^"]*)"/i.exec(m[1])?.[1] ?? '', resto: /\bclass="[^"]*\bpulsante\b/i.test(m[1]) ? 'p' : '', testo: m[2] }))
  return fuori.every((x) => x.href && x.resto) ? fuori : null
}

/** Il pulsante di prova per primo (giallo), gli altri a linea: l'ordine con cui li ha scritti la segreteria non conta. */
export function pulsanti(l: Link[], iscrizione: string): string {
  const prova = l.filter((x) => eIscrizione(x.href, iscrizione))
  const altri = l.filter((x) => !eIscrizione(x.href, iscrizione))
  const a = (x: Link, classe: string, href: string) => `<a class="pulsante ${classe}" href="${esc(href)}"${/^https?:/i.test(href) ? ' rel="noopener noreferrer"' : ''}>${x.testo}</a>`
  return `<div class="pulsanti">${prova.slice(0, 1).map((x) => a(x, 'primario', iscrizione)).join('')}${[...prova.slice(1), ...altri].map((x) => a(x, 'secondario', x.href)).join('')}</div>`
}

export const introduzione = (b: Blocco[]) => b.slice(0, Math.max(0, b.findIndex((x) => x.tag === 'h2') < 0 ? b.length : b.findIndex((x) => x.tag === 'h2')))

/** Vero se l'introduzione ha un pulsante verso il modulo online. */
export function eHomeNuova(testoPulito: string, iscrizione: string): boolean {
  return introduzione(blocchi(testoPulito)).some((x) => pulsantiDi(x)?.some((p) => eIscrizione(p.href, iscrizione)))
}

const COLORI_NUMERI = ['blu', 'giallo', 'inchiostro', 'blu']
const CITAZIONI = ['blu', 'inchiostro']

/** La firma con un'unica iniziale (la doppia, «SSerena», era un difetto della vecchia Home). */
function firmaConIniziale(firma: string): string {
  const sigla = iniziali(firma).slice(0, 1)
  return sigla ? `<span class="avatar" aria-hidden="true">${sigla}</span><span class="nome">${firma}</span>` : firma
}

/** L'ultimo paragrafo è la firma se è tutto in corsivo o grassetto, o comincia con «—». */
function dividi(b: Blocco): { corpo: Blocco[]; firma: string } {
  const dentro = blocchi(contenuto(b))
  const ultimo = dentro[dentro.length - 1]
  // Una sola riga in corsivo non è una firma: l'estratto resterebbe vuoto.
  const eFirma = dentro.length > 1 && ultimo.tag === 'p' && (/^<p[^>]*>\s*<(em|strong)>[^<]*<\/\1>\s*<\/p>$/i.test(ultimo.html) || /^<p[^>]*>\s*—/.test(ultimo.html))
  return { corpo: eFirma ? dentro.slice(0, -1) : dentro, firma: eFirma ? contenuto(ultimo) : '' }
}

/** Una carta di citazione: estratto sempre visibile; con un testo intero, «Leggi tutto» lo apre nella carta (details: niente script). */
function cartaCitazione(b: Blocco, colore: string, larga: boolean): string {
  const { corpo, firma } = dividi(b)
  // Una recensione si legge per intero: «Leggi tutto» è solo delle citazioni, dove la segreteria ha scritto prima l'estratto.
  const [estratto, ...intero] = larga ? [corpo[0]] : corpo
  const dettagli = intero.length ? `<details class="intero"><summary>Leggi tutto</summary><div class="testo-intero">${intero.map((x) => x.html).join('')}</div></details>` : ''
  const testoCarta = larga ? corpo.map((x) => x.html).join('') : `<p class="estratto">${estratto ? contenuto(estratto) : ''}</p>`
  return `<blockquote class="tessera citazione ${colore}${larga ? ' larga' : ''}">${testoCarta}${dettagli}${firma ? `<p class="firma">${firmaConIniziale(firma)}</p>` : ''}</blockquote>`
}

/** Le fasce d'età di una scheda: un `ul`, oppure un ultimo paragrafo tutto in corsivo con le fasce separate da « · » (come nel testo di prima). */
function fasceDi(corpo: Blocco[]): { nomi: string[]; resto: Blocco[] } {
  const ul = corpo.find((x) => x.tag === 'ul')
  if (ul) return { nomi: [...ul.html.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)].map((m) => testoSolo(m[1])), resto: corpo.filter((x) => x !== ul) }
  const ultimo = corpo[corpo.length - 1]
  const em = ultimo && ultimo.tag === 'p' ? /^<p[^>]*>\s*<em>([^<]+)<\/em>\s*<\/p>$/i.exec(ultimo.html)?.[1] : undefined
  const nomi = em ? em.split(/\s*[·,/]\s*/).map((x) => x.trim()).filter(Boolean) : []
  const note = Object.keys(PILLOLE).map((x) => x.toLowerCase())
  return nomi.length && nomi.every((x) => note.includes(x.toLowerCase())) ? { nomi, resto: corpo.slice(0, -1) } : { nomi: [], resto: corpo }
}

function scheda(g: { titolo: string; corpo: Blocco[] }, k: number, n: number): string {
  const foto = g.corpo.map(immagine).find((x): x is string => x !== null)
  const { nomi, resto } = fasceDi(g.corpo.filter((x) => immagine(x) === null))
  const testi = resto.filter((x) => x.tag === 'p')
  // Il primo paragrafo è l'età se ce n'è più d'uno; tutti gli altri sono la descrizione, nessuno si perde.
  const eta = testi.length > 1 ? `<p class="eta">${contenuto(testi[0])}</p>` : ''
  const descrizione = testi.slice(testi.length > 1 ? 1 : 0).map((x) => x.html).join('')
  const pastiglie = nomi.length ? `<ul class="pastiglie">${nomi.map((nome) => { const d = PILLOLE[Object.keys(PILLOLE).find((p) => p.toLowerCase() === nome.toLowerCase()) ?? '']; return `<li>${d ? `<svg viewBox="0 0 256 256" fill="currentColor" aria-hidden="true">${d}</svg>` : ''}${esc(nome)}</li>` }).join('')}</ul>` : ''
  const iniziale = (testoSolo(g.titolo).match(/\p{L}/u)?.[0] ?? '').toUpperCase()
  // Senza foto una fascia con l'iniziale: mai la foto di un altro corso.
  const corso = /\/([a-z0-9-]+)\/?"/i.exec(g.titolo)?.[1]?.toLowerCase()
  const dentro = foto ? conCaricamento(foto, false).replace(/^<img/, `<img${corso ? ` data-corso="${corso}"` : ''}`) : ''
  const f = foto ? `<div class="scheda-foto">${dentro}</div>` : `<div class="scheda-foto senza-foto"><span aria-hidden="true">${iniziale}</span></div>`
  return `<article class="tessera ${coloreDi(k, n)} scheda">${f}<h3>${g.titolo}</h3>${eta}${descrizione}${pastiglie}</article>`
}

const intro = (b: Blocco[]) => {
  const p = b.filter((x) => x.tag === 'p' && pulsantiDi(x) === null && immagine(x) === null).map((x) => x.html).join('')
  return p ? `<div class="colonna">${p}</div>` : ''
}

function sezioneNuova(titolo: string, corpo: Blocco[], ultima: boolean, iscrizione: string): string {
  const h2 = `<h2>${titolo}</h2>`
  const primo = corpo.findIndex((x) => x.tag === 'h3')
  const citazioni = corpo.filter((x) => x.tag === 'blockquote')
  const dopoH3 = primo >= 0 ? corpo.slice(primo) : []
  // La chiamata finale: l'ultima sezione con un pulsante verso il modulo online.
  const link = corpo.flatMap((x) => pulsantiDi(x) ?? [])
  if (ultima && link.some((x) => eIscrizione(x.href, iscrizione))) {
    const foto = corpo.map(immagine).find((x): x is string => x !== null)
    const testi = corpo.filter((x) => pulsantiDi(x) === null && immagine(x) === null).map((x) => x.html).join('')
    const bottoni = pulsanti(link, iscrizione)
    return `<section class="sezione cta${foto ? '' : ' solo'}"><div class="cta-testo">${h2}${testi}${bottoni}</div>${foto ? `<figure class="cta-foto">${conCaricamento(foto, false)}</figure>` : ''}</section>`
  }
  // Recensioni: citazioni seguite da «In breve» (un h3 con un elenco).
  const inBreve = primo >= 0 && dopoH3.length >= 2 && dopoH3[0].tag === 'h3' && dopoH3[1].tag === 'ul' ? dopoH3 : null
  // Una forma che non torna (un paragrafo o un elenco in più) cade in `sezione`: niente testo si perde.
  if (citazioni.length && inBreve && corpo.slice(0, primo).every((x) => x.tag === 'blockquote')) {
    const voci = [...inBreve[1].html.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)].map((m) => m[1])
    const breve = `<aside class="tessera in-breve giallo"><h3>${contenuto(inBreve[0])}</h3><ul>${voci.map((v) => `<li>${v}</li>`).join('')}</ul></aside>`
    return `<section class="sezione">${h2}<div class="recensioni">${citazioni.map((x, k) => cartaCitazione(x, CITAZIONI[k % CITAZIONI.length], true)).join('')}${breve}</div></section>`
  }
  // Citazioni: carte uguali, non un carosello.
  if (citazioni.length >= 2 && corpo.every((x) => x.tag === 'blockquote')) {
    return `<section class="sezione">${h2}${griglia(citazioni.length, citazioni.map((x, k) => cartaCitazione(x, CITAZIONI[k % CITAZIONI.length], false)).join(''), ' estratti')}</section>`
  }
  if (primo >= 0 && corpo.slice(0, primo).every((x) => x.tag === 'p')) {
    const gruppi = gruppiDa(dopoH3)
    if (sonoCorsi(gruppi)) return `<section class="sezione">${h2}${intro(corpo.slice(0, primo))}${griglia(gruppi.length, gruppi.map((g, k) => scheda(g, k, gruppi.length)).join(''), ' schede')}</section>`
    // Perché unirti: quattro titoli, ognuno con il suo testo.
    if (gruppi.length === 4 && gruppi.every((g) => g.corpo.length === 1 && g.corpo[0].tag === 'p')) {
      const t = gruppi.map((g, k) => `<article class="tessera ${coloreDi(k, 4)}"><span class="numero-perche" aria-hidden="true">${k + 1}</span><h3>${g.titolo}</h3>${g.corpo[0].html}</article>`).join('')
      return `<section class="sezione">${h2}${intro(corpo.slice(0, primo))}${griglia(4, t, ' perche')}</section>`
    }
  }
  return sezione(titolo, corpo)
}

/**
 * La Home nuova: `html` va in `<main>` dopo il titolo (che sta nella testata della pagina), `foto` e `bottoni` stanno
 * nella testata della pagina; `chiamata` dice se la chiamata finale c'è già (allora l'invito globale non si ripete).
 */
export function homeNuova(testoPulito: string, iscrizione: string): { bottoni: string; foto: string; html: string; chiamata: boolean } {
  const b = blocchi(testoPulito)
  const primoTitolo = b.findIndex((x) => x.tag === 'h2')
  const testa = b.slice(0, primoTitolo < 0 ? b.length : primoTitolo)
  const bottoni = testa.map((x) => pulsantiDi(x)).find((x): x is Link[] => x !== null)
  const foto = testa.map(immagine).find((x): x is string => x !== null)
  const numeri = testa.map((x) => numeriDiUnElenco(x)).find((x) => x !== null)
  const iM = testa.findIndex((x) => x.tag === 'h3')
  const motto = iM < 0 ? null : { titolo: contenuto(testa[iM]), righe: testa.slice(iM + 1).filter((x) => x.tag === 'p' && pulsantiDi(x) === null && immagine(x) === null) }
  const usatiNumeri = testa.findIndex((x) => x.tag === 'ul' && numeriDiUnElenco(x))
  const resto = testa.filter((x, i) => pulsantiDi(x) === null && immagine(x) === null && i !== usatiNumeri && !(iM >= 0 && i >= iM))
  const tNumeri = numeri ? `<div class="tessere n-${numeri.length} numeri">${numeri.map((n, k) => `<article class="tessera ${COLORI_NUMERI[k % COLORI_NUMERI.length]} numero"><strong class="cifra">${n.cifra}</strong>${n.scritta ? ` <span class="scritta">${n.scritta}</span>` : ''}</article>`).join('')}</div>` : ''
  const tMotto = motto ? `<section class="motto"><h3>${motto.titolo}</h3><div>${motto.righe.map((x) => x.html).join('')}</div></section>` : ''
  const tResto = resto.length ? `<div class="testo">${resto.map((x) => x.html).join('')}</div>` : ''
  const sezioni: string[] = []
  const titoli = b.map((x, i) => (x.tag === 'h2' ? i : -1)).filter((i) => i >= 0)
  titoli.forEach((i, k) => sezioni.push(sezioneNuova(contenuto(b[i]), b.slice(i + 1, titoli[k + 1] ?? b.length), k === titoli.length - 1, iscrizione)))
  const html = `${tNumeri}${tMotto}${tResto}${sezioni.join('')}`
  return { bottoni: bottoni ? pulsanti(bottoni, iscrizione) : '', foto: foto ? `<figure class="hero-foto">${conCaricamento(foto, true)}</figure>` : '', html, chiamata: sezioni.some((s) => s.startsWith('<section class="sezione cta')) }
}
