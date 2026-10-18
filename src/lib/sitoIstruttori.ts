/**
 * La pagina Istruttori rivista (docs/design-canvas/istruttori-miglioramenti/): l'elenco dei tecnici e la scheda scarna
 * di uno di loro, dal testo incollato nel pannello SITO.
 *
 * Le pagine del sito hanno indirizzi piatti (`/fabio-berta/`, mai `/istruttori/fabio-berta/`): il nome nell'elenco è un
 * link solo se punta a una pagina pubblicata, così un nome collegato troppo presto resta testo e non dà mai un 404.
 * La scheda completa (foto e citazione) è `persona()` in sitoLayout.ts e qui non cambia.
 */

import { blocchi, contenuto, immagine, iniziali, testoSolo, type Blocco } from './sitoLayout'

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

/** Quel che serve al generatore: le pagine pubblicate e i due pulsanti di prova. */
export interface Cornice {
  slugs: ReadonlySet<string>
  iscrizione: string
  prova: string
  scrivici: string
  /** L'indirizzo della pagina Contatti se è pubblicata, altrimenti null: senza, «Scrivici» non c'è. */
  contatti: string | null
  indirizzo: string
}

/** Chi sta in testa all'elenco, in quest'ordine; gli altri seguono come scritti. */
const IN_TESTA = ['maurizio', 'maura', 'diana', 'fabio', 'tiziano', 'valerio', 'manuel', 'federico']
/** I colori dei ritratti: a diagonali (riga + colonna), così nessun vicino, in riga o in colonna, ha lo stesso colore. */
const COLORI_RITRATTI = ['giallo', 'blu', 'inchiostro'] as const
const COLORI_DATI = ['chiara', 'blu', 'inchiostro', 'giallo'] as const
const COLONNE = 4
/** Una tessera d'invito più stretta di due colonne non ha spazio per il titolo: meglio l'invito di fondo pagina. */
const INVITO_MIN = 2

/** La foto col suo `alt`; se la segreteria non l'ha scritto lo scrive il sito, perché il nome qui si sa. */
function conAlt(img: string, alt: string): string {
  if (/\balt="[^"]+"/i.test(img)) return img
  return img.replace(/\salt=(?:"[^"]*"|'[^']*')/i, '').replace(/^<img\b/i, `<img alt="${esc(alt)}"`)
}

/** I pulsanti di prova: il modulo online per primo, «Scrivici» solo se la pagina Contatti c'è. */
function azioni(c: Cornice): string {
  const scrivici = c.contatti ? `<a class="pulsante secondario" href="${esc(c.contatti)}">${c.scrivici}</a>` : ''
  return `<div class="azioni"><a class="pulsante primario" href="${esc(c.iscrizione)}" rel="noopener noreferrer">${c.prova}</a>${scrivici}</div>`
}

/** La riga sotto il nome: «Cognome · corso, corso». Senza «·» una riga con virgole sono i corsi, una senza è il cognome. */
function cognomeECorsi(riga: string): { cognome: string; corsi: string[] } {
  const t = testoSolo(riga)
  const i = t.indexOf('·')
  const [cognome, corsi] = i >= 0 ? [t.slice(0, i), t.slice(i + 1)] : t.includes(',') ? ['', t] : [t, '']
  return { cognome: cognome.trim(), corsi: corsi.split(',').map((x) => x.trim()).filter(Boolean) }
}

/** Il nome del tecnico e, se c'è, l'indirizzo della sua scheda: solo un link a una pagina pubblicata conta. */
function nomeELink(h3: Blocco, slugs: ReadonlySet<string>): { nome: string; href: string } {
  const dentro = contenuto(h3).trim()
  const a = /^<a\b([^>]*)>([\s\S]*?)<\/a>$/i.exec(dentro)
  const href = a ? (/\bhref="([^"]*)"/i.exec(a[1])?.[1] ?? '') : ''
  const slug = /^\/([a-z0-9-]+)\/?$/.exec(href)?.[1]
  return { nome: testoSolo(a ? a[2] : dentro), href: slug && slugs.has(slug) ? `/${slug}/` : '' }
}

/**
 * La pagina degli istruttori: un testo senza `h2` che comincia con un `h3` (e ne ha almeno due) è l'elenco dei tecnici.
 * Ogni `h3` è il nome, la foto che lo segue (se c'è) è il ritratto, il paragrafo dopo è «Cognome · corso, corso».
 * Se l'ultima riga di quattro resta incompleta, una tessera d'invito la riempie. Quel che segue l'ultimo tecnico resta
 * testo sotto la griglia. Restituisce null se il testo non è fatto così.
 */
export function elencoIstruttori(testoPulito: string, c: Cornice): { html: string; resto: string; conInvito: boolean } | null {
  const b = blocchi(testoPulito)
  if (b[0]?.tag !== 'h3' || b.some((x) => x.tag === 'h2')) return null
  const tecnici: { nome: string; scheda: (colore: string) => string }[] = []
  let i = 0
  while (i < b.length && b[i].tag === 'h3') {
    const { nome, href } = nomeELink(b[i], c.slugs)
    i++
    const foto = i < b.length ? immagine(b[i]) : null
    if (foto !== null) i++
    const { cognome, corsi } = i < b.length && b[i].tag === 'p' && immagine(b[i]) === null ? cognomeECorsi(b[i++].html) : { cognome: '', corsi: [] }
    const titolo = `<span class="nome">${nome}</span>${cognome ? ` <span class="cognome">${cognome}</span>` : ''}`
    const ritratto = foto !== null ? `<span class="ritratto-foto">${conAlt(foto, `Ritratto di ${testoSolo(`${nome} ${cognome}`)}`)}</span>` : `<span class="ritratto-foto" aria-hidden="true">${iniziali(nome).slice(0, 1)}</span>`
    const pastiglie = corsi.length ? `<span class="pillole">${corsi.map((x) => `<span class="pillola">${x}</span>`).join('')}</span>` : ''
    tecnici.push({ nome, scheda: (colore) => `<article class="tessera ritratto ${colore}">${ritratto}<div class="ritratto-testo"><h3>${href ? `<a href="${href}">${titolo}</a>` : titolo}</h3>${pastiglie}</div></article>` })
  }
  if (tecnici.length < 2) return null
  // sort è stabile: chi non è in elenco tiene l'ordine in cui è scritto.
  const posto = (nome: string) => { const k = IN_TESTA.indexOf(nome.trim().toLowerCase()); return k < 0 ? IN_TESTA.length : k }
  const tessere = [...tecnici].sort((a, b) => posto(a.nome) - posto(b.nome)).map((t, k) => t.scheda(COLORI_RITRATTI[(Math.floor(k / COLONNE) + (k % COLONNE)) % COLORI_RITRATTI.length]))
  const vuote = (COLONNE - (tessere.length % COLONNE)) % COLONNE
  const invito = vuote >= INVITO_MIN
    ? `<div class="tessera ritratto-invito s${vuote}"><p class="parola">Vieni a conoscerli sul tatami.</p><p class="frase">Una settimana a 5 €: provi tutte le discipline, incontri gli istruttori e scegli. Ti aspettiamo in ${esc(c.indirizzo)}.</p>${azioni(c)}</div>`
    : ''
  return { html: `<section class="sezione ritratti-sezione"><div class="ritratti">${tessere.join('')}${invito}</div></section>`, resto: b.slice(i).map((x) => x.html).join(''), conInvito: invito !== '' }
}

/**
 * La scheda scarna di un istruttore: l'elenco «Corsi» (e gli altri dati, al massimo quattro) con una foto davanti, se c'è,
 * e nient'altro. Mostra solo i dati scritti: niente tessere vuote. Senza foto, una fascia azzurra con l'iniziale.
 * Senza l'elenco «Corsi», o con altro intorno (titoli, citazione), non è una scheda scarna: null.
 */
export function schedaScarna(testoPulito: string, titolo: string, c: Cornice): string | null {
  const b = blocchi(testoPulito)
  const foto = b[0] ? immagine(b[0]) : null
  const resto = foto !== null ? b.slice(1) : b
  if (resto.length !== 1 || resto[0].tag !== 'ul') return null
  const dati = [...resto[0].html.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)].map((m) => /^\s*<strong>([\s\S]*?)<\/strong>\s*:?\s*([\s\S]*)$/i.exec(m[1]))
  if (dati.length === 0 || dati.length > COLORI_DATI.length || dati.some((d) => d === null) || !dati.some((d) => d && testoSolo(d[1]).toLowerCase() === 'corsi')) return null
  const parole = titolo.trim().split(/\s+/)
  const nome = `<h1><span>${esc(parole[0])}</span>${parole.length > 1 ? ` <span>${esc(parole.slice(1).join(' '))}</span>` : ''}</h1>`
  const ritratto = foto !== null ? `<div class="scheda-ritratto">${conAlt(foto, `Ritratto di ${titolo.trim()}`)}</div>` : `<div class="scheda-ritratto senza-foto"><span aria-hidden="true">${iniziali(titolo).slice(0, 1)}</span></div>`
  const indietro = c.slugs.has('istruttori') ? '<a class="indietro" href="/istruttori/">← Gli istruttori</a>' : ''
  const tessere = dati.map((d, k) => `<article class="tessera ${COLORI_DATI[k]}"><h2>${d?.[1]}</h2><p>${d?.[2].trim()}</p></article>`).join('')
  return `${indietro}<div class="scheda-testata">${ritratto}<div class="scheda-nome">${nome}${azioni(c)}</div></div><div class="tessere n-${dati.length} dati-persona">${tessere}</div>`
}
