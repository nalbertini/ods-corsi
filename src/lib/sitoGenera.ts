import { urlImmagine } from './sitoImmagini'
import { indirizzoValido, slugValido } from './sitoPagine'
import { pulisciTesto } from './sitoTesto'
import { CONTATTI } from './sito'

/**
 * Il sito pubblico: dalle pagine pubblicate nel pannello SITO ai file statici.
 *
 * Qui si pulisce il testo un'altra volta (`pulisciTesto`): è la pulizia di cui
 * ci si fida, perché chi scrive all'API salta il pannello e il filtro del
 * database è solo una difesa in più. Titolo, descrizione ed etichette si
 * scrivono sempre escapati. Il sito non ha codice (niente `<script>`) né
 * richieste a servizi esterni: carattere e logo sono file suoi, in `/risorse/`
 * (la cartella `sito/risorse/`), e un'immagine nel testo entra solo se è del
 * sito o del contenitore delle immagini dichiarato (`ospitiImmagini`).
 *
 * Nessuna data di oggi nei file: gli stessi dati danno gli stessi file.
 */

export interface PaginaGenerata {
  slug: string
  titolo: string
  descrizione: string
  testo: string
  pubblicataIl?: string
  diLegge?: boolean
}

export interface VoceGenerata {
  dove: 'menu' | 'footer'
  ordine: number
  etichetta: string
  slug: string | null
  indirizzo: string | null
}

export interface DatiSito {
  /** Con lo schema e senza «/» in fondo: https://www.officinedellosport.it */
  dominio: string
  pagine: PaginaGenerata[]
  menu: VoceGenerata[]
  rinvii: Array<{ da: string; a: string }>
  /** Prefissi di indirizzo da cui le immagini del testo sono ammesse: il contenitore delle immagini (`…/storage/v1/object/public/sito/`). Vuoto: solo quelle del sito. */
  ospitiImmagini?: string[]
}

/**
 * Le parole fisse del modello. Stanno qui, in un posto solo, perché il design è
 * deciso e non cambiano da una pagina all'altra; se la segreteria dovrà
 * cambiarle sarà una funzione a parte.
 */
const TESTI = {
  nome: 'Officine dello Sport',
  prova: 'Prova',
  contattaci: 'Contattaci',
  invito: 'Vieni a provare: ti aspettiamo in',
  altriLink: 'Altri link',
  trovarci: 'Vieni a trovarci',
  contatti: '/contatti/',
}
const NOME = TESTI.nome
const DOMINIO = /^https?:\/\/[a-z0-9.-]+(:\d+)?$/i

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

const slugDiPagina = (s: string) => s === 'home' || slugValido(s)

/** L'indirizzo della pagina dentro il sito: la home è «/», le altre «/slug/». */
const percorso = (slug: string) => (slug === 'home' ? '/' : `/${slug}/`)

/** Dove si scrive il file di una pagina. */
const fileDi = (slug: string) => (slug === 'home' ? 'index.html' : `${slug}/index.html`)

/**
 * Il marchio intero (anelli e scritta). `logo.webp` è già tagliato ai margini del disegno: width e height qui
 * sono le sue misure vere (le controlla `prova-sito-aspetto`). Il suo fondo è bianco e `multiply` lo fonde col fondo della pagina.
 */
const MARCHIO = '<img src="/risorse/logo.webp" alt="Officine dello Sport" width="1060" height="1040" decoding="async">'

/**
 * L'aspetto «A2 · Tatami blu e giallo» (docs/design-canvas/sito-approvato/, token in
 * token-proposta.md): tessere a filo con angoli di 6px, titoli in Big Shoulders
 * Display maiuscolo, testo in Inter. I colori sono cinque e il bianco: non se ne
 * aggiungono senza cambiare prima il design. Regola dei colori: il giallo è uno
 * sfondo (pulsante «Prova», invito) con l'inchiostro sopra; sul piede scuro serve solo come colore del focus;
 * il bianco sta solo sul blu e sull'inchiostro.
 */
const CSS = `
@font-face{font-family:"Big Shoulders Display";font-weight:800;font-display:swap;src:url(/risorse/big-shoulders-display-800.woff2) format("woff2");unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}
@font-face{font-family:"Inter";font-weight:100 900;font-display:swap;src:url(/risorse/inter-variable.woff2) format("woff2");unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}
:root{--display:"Big Shoulders Display","Arial Narrow",Arial,sans-serif;--fondo:#eef5fa;--inchiostro:#0d2a3d;--blu:#14709f;--chiara:#cfe6f4;--giallo:#f4c31b;--margine:clamp(16px,3.4vw,48px)}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--fondo);color:var(--inchiostro);font-family:"Inter","Helvetica Neue",Helvetica,Arial,sans-serif;font-size:clamp(17px,1rem + .25vw,19px);line-height:1.55;-webkit-font-smoothing:antialiased}
a{color:inherit}
a:focus-visible,button:focus-visible{outline:3px solid var(--blu);outline-offset:3px}
.invito:focus-visible{outline-color:var(--inchiostro)}
.piede a:focus-visible{outline-color:var(--giallo)}
.logo{display:block;flex-shrink:0}
.logo img{display:block;height:96px;width:auto;mix-blend-mode:multiply}
.testata{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px 24px;padding:14px var(--margine)}
.testata nav ul{display:flex;flex-wrap:wrap;gap:6px;margin:0;padding:0;list-style:none;font-size:17px;font-weight:500}
.testata nav a{display:inline-flex;align-items:center;min-height:44px;padding:0 16px;border-radius:6px;text-decoration:none}
.testata nav a:hover{background:var(--chiara)}
.pulsante,.testo a.pulsante{display:inline-flex;align-items:center;justify-content:center;min-height:56px;padding:0 32px;border-radius:6px;background:var(--inchiostro);color:#fff;font-size:18px;font-weight:600;text-decoration:none}
.pulsante.piccolo{min-height:48px;padding:0 24px;font-size:16px}
.testata .pulsante{background:var(--giallo);color:var(--inchiostro)}
.pulsante:hover{text-decoration:underline;text-underline-offset:4px}
h1,h2,h3{font-family:var(--display);text-transform:uppercase;font-weight:800}
h1{margin:0;font-size:clamp(56px,12vw,200px);letter-spacing:-.01em;line-height:.84;overflow-wrap:anywhere}
.pagina-hero{padding:24px var(--margine) 64px;display:flex;flex-direction:column;gap:28px}
.pagina-hero .intro{display:flex;flex-direction:column;gap:24px;max-width:min(980px,100%)}
.intro p{margin:0;font-size:clamp(18px,1.6vw,22px);line-height:1.45;max-width:34em}
.pagina-testo{padding:40px var(--margine) 24px}
.pagina-testo h1{font-size:clamp(48px,8vw,120px);max-width:14em}
.testo{padding:24px var(--margine) 40px;max-width:calc(62ch + var(--margine) * 2)}
.pagina-testo + .testo{padding-top:8px}
.testo>*+*{margin-top:16px}
.testo h2{font-family:var(--display);text-transform:uppercase;margin:clamp(40px,5vw,64px) 0 14px;font-size:clamp(40px,5vw,72px);letter-spacing:-.005em;line-height:.9}
.testo h3{margin:32px 0 10px;font-size:clamp(28px,3vw,40px);line-height:.95}
.testo p,.testo ul,.testo ol,.testo blockquote{margin-top:0;margin-bottom:0}
.testo ul,.testo ol{padding-left:1.3em}
.testo li+li{margin-top:6px}
.testo blockquote{padding-left:18px;border-left:4px solid var(--blu);font-size:1.15em}
.testo a{text-underline-offset:3px}
.testo img{max-width:100%;height:auto;border-radius:6px}
.invito{display:flex;flex-direction:column;justify-content:space-between;gap:20px;margin:96px 12px 6px;padding:28px var(--margine);min-height:clamp(240px,26vw,360px);border-radius:6px;background:var(--giallo);color:var(--inchiostro);text-decoration:none}
.invito .riga{display:flex;justify-content:space-between;gap:16px;align-items:flex-start}
.invito .frase{max-width:min(520px,80%);font-size:clamp(16px,1.4vw,20px);line-height:1.35}
.invito .freccia{font-size:clamp(32px,3.4vw,48px);line-height:1}
.invito .parola{font-family:var(--display);text-transform:uppercase;font-weight:800;font-size:clamp(96px,16vw,230px);line-height:.8;letter-spacing:-.01em}
.piede{margin:0 12px 12px;padding:40px var(--margine) 24px;background:var(--inchiostro);color:#fff;border-radius:6px}
.piede .nome{margin:0 0 24px;font-family:var(--display);text-transform:uppercase;font-weight:800;font-size:clamp(44px,7vw,96px);line-height:.9}
.piede .colonne{display:flex;flex-wrap:wrap;gap:32px clamp(32px,7vw,96px);font-size:16px;line-height:1.9}
.piede h2{margin:0;font-family:inherit;text-transform:none;font-size:16px;font-weight:400;color:var(--chiara)}
.piede ul{margin:0;padding:0;list-style:none}
.piede a{text-decoration:none}
.piede a:hover{text-decoration:underline}
.piede .fine{display:flex;flex-wrap:wrap;gap:16px;justify-content:space-between;align-items:center;margin-top:32px;font-size:14px;color:var(--chiara)}
.non-trovata{padding:40px var(--margine) 96px}
.non-trovata p{max-width:34em}
@media (max-width:900px){
.testata{flex-wrap:wrap;gap:8px 16px}
.testata nav{order:3;width:100%}
.invito{margin-top:48px}
}
@media (prefers-reduced-motion:no-preference){.pulsante,.testata nav a{transition:background-color .15s}}
`.replace(/\n/g, '')

interface Contesto {
  d: DatiSito
  slugs: Set<string>
}

/** Un indirizzo di una voce: della pagina, o scritto dalla segreteria e valido; altrimenti niente. */
function indirizzoVoce(v: VoceGenerata, c: Contesto): string | null {
  if (v.slug !== null) return c.slugs.has(v.slug) ? percorso(v.slug) : null
  if (v.indirizzo !== null && indirizzoValido(v.indirizzo)) return v.indirizzo
  return null
}

function voci(dove: 'menu' | 'footer', c: Contesto): Array<{ etichetta: string; href: string }> {
  return c.d.menu
    .filter((v) => v.dove === dove && v.etichetta.trim())
    .sort((a, b) => a.ordine - b.ordine)
    .flatMap((v) => {
      const href = indirizzoVoce(v, c)
      return href === null ? [] : [{ etichetta: v.etichetta.trim(), href }]
    })
}

const rel = (href: string) => (/^https?:/i.test(href) ? ' rel="noopener noreferrer"' : '')
const lista = (v: Array<{ etichetta: string; href: string }>) => v.map((x) => `<li><a href="${esc(x.href)}"${rel(x.href)}>${esc(x.etichetta)}</a></li>`).join('')

/**
 * Il testo di una pagina, ripulito, con solo le immagini ammesse: quelle del sito
 * («/…») e quelle di un host dichiarato. Un'immagine di un altro sito farebbe
 * chiamare un servizio esterno a chi visita la pagina.
 */
/** Dove stanno le immagini delle pagine (il contenitore «sito» del progetto): l'unico prefisso che lo script dichiara. */
export const prefissoImmagini = (urlProgetto: string): string => urlImmagine(urlProgetto, '')

function testoDellaPagina(testo: string, ospiti: string[]): string {
  return pulisciTesto(testo).replace(/<img\b[^>]*>/gi, (tag) => {
    const src = tag.match(/\bsrc="([^"]*)"/i)?.[1] ?? ''
    if (/^\/(?![/\\])/.test(src)) return tag
    // Il prefisso deve coincidere (l'host senza badare alle maiuscole) e il resto è un nome semplice: niente cartelle, `..`, `?token=`.
    const dentro = ospiti.some((o) => {
      const [, host, percorso] = o.match(/^(https:\/\/[^/]+)(\/.*)$/i) ?? []
      return !!host && src.length > o.length && src.slice(0, host.length).toLowerCase() === host.toLowerCase() && src.slice(host.length).startsWith(percorso) && /^[A-Za-z0-9._-]+$/.test(src.slice(o.length)) && !src.slice(o.length).includes('..')
    })
    return dentro ? tag : ''
  })
}

function testata(c: Contesto, conContatti: boolean): string {
  const menu = lista(voci('menu', c))
  return `<header class="testata"><a class="logo" href="/" aria-label="${esc(NOME)}, pagina iniziale">${MARCHIO}</a>${menu ? `<nav aria-label="Principale"><ul>${menu}</ul></nav>` : ''}${conContatti ? `<a class="pulsante piccolo" href="${TESTI.contatti}">${TESTI.prova}</a>` : ''}</header>`
}

function piede(c: Contesto): string {
  const f = lista(voci('footer', c))
  const recapiti = `<li>${esc(CONTATTI.indirizzo)}</li><li>${esc(CONTATTI.telefono)}</li><li><a href="${esc(CONTATTI.instagram)}" rel="noopener noreferrer">Instagram</a></li><li><a href="${esc(CONTATTI.facebook)}" rel="noopener noreferrer">Facebook</a></li>`
  return `<footer class="piede"><p class="nome">${NOME}</p><div class="colonne">${f ? `<div><h2>${TESTI.altriLink}</h2><ul>${f}</ul></div>` : ''}<div><h2>${TESTI.trovarci}</h2><ul>${recapiti}</ul></div></div><div class="fine"><span>© ${NOME}</span></div></footer>`
}

function invito(conContatti: boolean): string {
  if (!conContatti) return ''
  return `<a class="invito" href="${TESTI.contatti}"><span class="riga"><span class="frase">${TESTI.invito} ${esc(CONTATTI.indirizzo)}.</span><span class="freccia" aria-hidden="true">↗</span></span><span class="parola">${TESTI.prova}</span></a>`
}

function documento(c: Contesto, o: { titolo: string; descrizione: string; percorso: string; corpo: string; noindex?: boolean }): string {
  const url = `${c.d.dominio}${o.percorso}`
  const completo = o.percorso === '/' ? o.titolo : `${o.titolo} · ${NOME}`
  return `<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(completo)}</title>${o.descrizione ? `<meta name="description" content="${esc(o.descrizione)}">` : ''}<link rel="canonical" href="${esc(url)}"><meta property="og:title" content="${esc(o.titolo)}">${o.descrizione ? `<meta property="og:description" content="${esc(o.descrizione)}">` : ''}<meta property="og:type" content="website"><meta property="og:url" content="${esc(url)}">${o.noindex ? '<meta name="robots" content="noindex">' : ''}<style>${CSS}</style></head><body>${o.corpo}</body></html>`
}

function pagina(p: PaginaGenerata, c: Contesto, conContatti: boolean): string {
  const testo = testoDellaPagina(p.testo, c.d.ospitiImmagini ?? [])
  const t = testata(c, conContatti)
  const intro = p.diLegge
    ? `<section class="pagina-testo"><h1>${esc(p.titolo)}</h1></section>`
    : `<section class="pagina-hero"><div class="intro"><h1>${esc(p.titolo)}</h1>${p.descrizione ? `<p>${esc(p.descrizione)}</p>` : ''}${conContatti && p.slug !== 'contatti' ? `<div><a class="pulsante" href="${TESTI.contatti}">${TESTI.contattaci}</a></div>` : ''}</div></section>`
  const corpo = `${t}<main>${intro}${testo.trim() ? `<div class="testo">${testo}</div>` : ''}</main>${p.slug !== 'contatti' ? invito(conContatti) : ''}${piede(c)}`
  return documento(c, { titolo: p.titolo, descrizione: p.descrizione, percorso: percorso(p.slug), corpo })
}

function nonTrovata(c: Contesto, conContatti: boolean): string {
  const corpo = `${testata(c, conContatti)}<main><section class="non-trovata"><h1>Pagina non trovata</h1><p>Errore 404: l’indirizzo che hai aperto non c’è, o la pagina è cambiata.</p><p><a class="pulsante" href="/">Torna alla pagina iniziale</a></p></section></main>${piede(c)}`
  return documento(c, { titolo: 'Pagina non trovata', descrizione: '', percorso: '/404.html', corpo, noindex: true })
}

function rinvio(c: Contesto, a: string): string {
  const dove = percorso(a)
  const corpo = `<main><p>La pagina si è spostata: <a href="${esc(dove)}">vai a ${esc(dove)}</a></p></main>`
  const url = `${c.d.dominio}${dove}`
  return `<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Pagina spostata</title><meta http-equiv="refresh" content="0; url=${esc(dove)}"><link rel="canonical" href="${esc(url)}"><meta name="robots" content="noindex"></head><body>${corpo}</body></html>`
}

function mappa(c: Contesto, pagine: PaginaGenerata[]): string {
  const url = pagine
    .map((p) => {
      const giorno = p.pubblicataIl?.match(/^\d{4}-\d{2}-\d{2}/)?.[0]
      return `<url><loc>${esc(c.d.dominio + percorso(p.slug))}</loc>${giorno ? `<lastmod>${giorno}</lastmod>` : ''}</url>`
    })
    .join('')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${url}</urlset>\n`
}

/**
 * Tutti i file del sito: percorso → contenuto. Una pagina con un indirizzo che
 * non va si salta, e le altre si generano lo stesso. Un dominio che non va
 * ferma tutto: finirebbe in canonical, sitemap e robots.txt.
 */
export function generaSito(d: DatiSito): Record<string, string> {
  if (!DOMINIO.test(d.dominio)) throw new Error('Il dominio del sito non va bene: deve essere come https://www.officinedellosport.it, senza «/» in fondo')
  const pagine = d.pagine.filter((p, i) => slugDiPagina(p.slug) && d.pagine.findIndex((x) => x.slug === p.slug) === i)
  const c: Contesto = { d, slugs: new Set(pagine.map((p) => p.slug)) }
  const conContatti = c.slugs.has('contatti')
  const file: Record<string, string> = {}
  for (const p of pagine) file[fileDi(p.slug)] = pagina(p, c, conContatti)
  file['404.html'] = nonTrovata(c, conContatti)
  file['sitemap.xml'] = mappa(c, pagine)
  file['robots.txt'] = `User-agent: *\nAllow: /\n\nSitemap: ${d.dominio}/sitemap.xml\n`
  for (const r of d.rinvii) {
    if (!slugValido(r.da) || c.slugs.has(r.da) || !c.slugs.has(r.a)) continue
    file[`${r.da}/index.html`] = rinvio(c, r.a)
  }
  return file
}

/** Le pagine di legge del sito: le tre che `56-sito.sql` crea e che non si nascondono (la funzione pubblica non dice quali sono). */
export const PAGINE_DI_LEGGE = ['privacy', 'cookie', 'contributi-pubblici']

/** Le risposte delle tre funzioni pubbliche del database (`sito_pagine_pubbliche`, `sito_menu_pubblico`, `sito_redirect_pubblici`) come servono al generatore. */
export function datiDaRisposte(
  dominio: string,
  pagine: Array<{ slug: string; titolo: string | null; descrizione: string | null; testo: string | null; pubblicata_il: string | null }>,
  menu: Array<{ dove: string; ordine: number; etichetta: string; slug: string | null; indirizzo: string | null }>,
  rinvii: Array<{ da: string; a: string }>,
): DatiSito {
  return {
    dominio: dominio.replace(/\/+$/, ''),
    pagine: pagine.map((p) => ({
      slug: p.slug,
      titolo: p.titolo ?? '',
      descrizione: p.descrizione ?? '',
      testo: p.testo ?? '',
      pubblicataIl: p.pubblicata_il ?? undefined,
      diLegge: PAGINE_DI_LEGGE.includes(p.slug),
    })),
    menu: menu.flatMap((v) => (v.dove === 'menu' || v.dove === 'footer' ? [{ dove: v.dove, ordine: v.ordine, etichetta: v.etichetta, slug: v.slug, indirizzo: v.indirizzo }] : [])),
    rinvii,
  }
}
