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
 * sito o di un host dichiarato (`ospitiImmagini`).
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
  /** Host da cui le immagini del testo sono ammesse (per esempio quello del contenitore delle immagini). Vuoto: solo quelle del sito. */
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
 * Un ingranaggio come quelli del marchio: corona dentata col buco al centro.
 * Disegnato in codice dal marchio: è il motivo di tutta la pagina.
 */
function ingranaggio(d: number, denti: number, buco: number): string {
  const R = d / 2
  const Rd = R * 0.8
  const Rb = R * buco
  const passo = (2 * Math.PI) / denti
  const punti: string[] = []
  for (let i = 0; i < denti; i++) {
    // `as const`: serve la coppia (frazione, raggio) come tupla e non come elenco di numeri.
    for (const [frac, r] of [[0.04, Rd], [0.12, R], [0.38, R], [0.46, Rd]] as const) {
      const t = i * passo + frac * passo * 2.1
      punti.push(`${(R + r * Math.cos(t)).toFixed(1)} ${(R + r * Math.sin(t)).toFixed(1)}`)
    }
  }
  const corona = `M${punti.join(' L')} Z`
  const foro = `M${(R + Rb).toFixed(1)} ${R} A${Rb.toFixed(1)} ${Rb.toFixed(1)} 0 1 0 ${(R - Rb).toFixed(1)} ${R} A${Rb.toFixed(1)} ${Rb.toFixed(1)} 0 1 0 ${(R + Rb).toFixed(1)} ${R} Z`
  return `<svg viewBox="0 0 ${d} ${d}" aria-hidden="true" focusable="false"><path d="${corona} ${foro}" fill-rule="evenodd"></path></svg>`
}

const GRANDE = ingranaggio(980, 12, 0.56)
const PIEDE = ingranaggio(520, 14, 0.7)

/** Il marchio: l'immagine è quadrata con del bianco intorno, qui se ne vede solo la parte con gli ingranaggi. */
const MARCHIO = '<img src="/risorse/logo.webp" alt="Officine dello Sport" width="2000" height="2000" decoding="async">'

const CSS = `
@font-face{font-family:"Bricolage Grotesque";font-weight:400 600;font-display:swap;src:url(/risorse/bricolage-latin-ext.woff2) format("woff2");unicode-range:U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C4,U+2113,U+2C60-2C7F,U+A720-A7FF}
@font-face{font-family:"Bricolage Grotesque";font-weight:400 600;font-display:swap;src:url(/risorse/bricolage-latin.woff2) format("woff2");unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}
:root{--fondo:#ffffff;--testo:#111111;--spento:#6b6b6b;--superficie:#f4f4f4;--accento:#1b8ac4;--accento-scuro:#14709f;--margine:clamp(16px,3.4vw,48px)}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--fondo);color:var(--testo);font-family:"Bricolage Grotesque","Helvetica Neue",Helvetica,Arial,sans-serif;font-size:clamp(17px,1rem + .25vw,19px);line-height:1.55;-webkit-font-smoothing:antialiased}
a{color:inherit}
a:focus-visible,button:focus-visible{outline:3px solid var(--accento);outline-offset:3px}
.logo{display:block;position:relative;width:112px;height:110px;overflow:hidden;flex-shrink:0}
.logo img{position:absolute;width:196%;max-width:none;height:auto;left:-47.6%;top:-45%}
.testata{position:relative;z-index:3;display:flex;align-items:center;justify-content:space-between;gap:24px;padding:14px var(--margine)}
.testata nav ul{display:flex;gap:32px;margin:0;padding:0;list-style:none;font-size:17px}
.testata nav a{text-decoration:none;padding:12px 0;display:inline-block}
.testata nav a:hover{text-decoration:underline;text-underline-offset:5px}
.pulsante,.testo a.pulsante{display:inline-flex;align-items:center;justify-content:center;min-height:56px;padding:0 32px;border-radius:999px;background:var(--testo);color:#fff;font-size:18px;font-weight:500;text-decoration:none}
.pulsante.piccolo{min-height:44px;padding:0 22px;font-size:16px}
.pulsante.chiaro{background:#fff;color:var(--testo)}
.pulsante:hover{background:#14709f}
.pulsante.chiaro:hover{background:#14709f;color:#fff}
.pagina-hero{position:relative;min-height:min(780px,100svh);margin-top:-90px;overflow:hidden}
.pagina-hero .scena{position:absolute;inset:0}
.pagina-hero .motivo{position:absolute;right:-260px;top:60px;width:980px;height:980px}
.pagina-hero .motivo svg{display:block;width:100%;height:100%;fill:var(--accento)}
.nel-foro{display:flex;align-items:center;justify-content:center;border-radius:50%;overflow:hidden;background:#fff}
.nel-foro .logo{width:68%;height:auto;aspect-ratio:1020/1000}
.pagina-hero .nel-foro{position:absolute;right:-50px;top:270px;width:560px;height:560px}
.pagina-hero .intro{position:relative;z-index:2;padding:220px var(--margine) 56px;max-width:min(780px,62vw);display:flex;flex-direction:column;gap:24px}
h1{margin:0;font-size:clamp(48px,7.2vw,104px);font-weight:600;letter-spacing:-.045em;line-height:.94;overflow-wrap:anywhere}
.intro p{margin:0;font-size:clamp(18px,1.6vw,22px);line-height:1.45;max-width:34em}
.pagina-testo{padding:56px var(--margine) 24px}
.pagina-testo h1{font-size:clamp(44px,6.6vw,96px);max-width:14em}
.testo{padding:24px var(--margine) 40px;max-width:calc(62ch + var(--margine) * 2)}
.pagina-testo + .testo{padding-top:8px}
.testo>*+*{margin-top:16px}
.testo h2{margin:clamp(40px,5vw,64px) 0 14px;font-size:clamp(30px,3.6vw,52px);font-weight:600;letter-spacing:-.035em;line-height:1}
.testo h3{margin:32px 0 10px;font-size:clamp(22px,2.4vw,30px);font-weight:600;letter-spacing:-.02em;line-height:1.1}
.testo p,.testo ul,.testo ol,.testo blockquote{margin-top:0;margin-bottom:0}
.testo ul,.testo ol{padding-left:1.3em}
.testo li+li{margin-top:6px}
.testo blockquote{padding-left:18px;border-left:4px solid var(--accento);font-size:1.15em}
.testo a{text-underline-offset:3px}
.testo img{max-width:100%;height:auto;border-radius:24px}
.invito{display:block;position:relative;overflow:hidden;margin:96px 12px 12px;padding:28px var(--margine) 0;height:clamp(300px,38vw,540px);border-radius:clamp(40px,4.4vw,64px);background:var(--accento);color:#fff;text-decoration:none}
.invito span{position:absolute}
.invito .frase{left:var(--margine);top:28px;max-width:min(420px,56%);font-size:clamp(16px,1.4vw,20px);line-height:1.35;color:var(--testo)}
.invito .freccia{right:var(--margine);top:24px;font-size:clamp(32px,3.4vw,48px);line-height:1}
.invito .parola{left:clamp(8px,2.5vw,36px);bottom:-.1em;font-size:clamp(110px,23vw,330px);font-weight:600;letter-spacing:-.06em;line-height:.85}
.invito:hover .parola{letter-spacing:-.05em}
.piede{margin-top:12px;padding:64px var(--margine) 32px;background:var(--testo);color:#fff;border-radius:clamp(40px,4.4vw,64px) clamp(40px,4.4vw,64px) 0 0}
.piede .marchio{position:relative;width:min(520px,80vw);aspect-ratio:1;margin:0 auto 56px}
.piede .marchio svg{display:block;width:100%;height:100%;fill:#fff}
.piede .marchio .nel-foro{position:absolute;left:50%;top:50%;width:62%;aspect-ratio:1;transform:translate(-50%,-50%)}
.piede .colonne{display:flex;flex-wrap:wrap;gap:32px clamp(32px,7vw,96px);font-size:16px;line-height:1.9}
.piede h2{margin:0;font-size:16px;font-weight:400;color:#9a9a9a}
.piede ul{margin:0;padding:0;list-style:none}
.piede a{text-decoration:none}
.piede a:hover{text-decoration:underline}
.piede .fine{display:flex;flex-wrap:wrap;gap:16px;justify-content:space-between;align-items:center;margin-top:32px;font-size:14px;color:#9a9a9a}
.non-trovata{padding:56px var(--margine) 96px}
.non-trovata p{max-width:34em}
@media (max-width:900px){
.testata{flex-wrap:wrap;gap:8px 16px}
.testata nav{order:3;width:100%}
.testata nav ul{flex-wrap:wrap;gap:0 20px;font-size:16px}
.logo{width:84px;height:82px}
.pagina-hero{min-height:0;margin-top:0}
.pagina-hero .scena{position:relative;inset:auto;height:430px;margin-top:8px;overflow:hidden}
.pagina-hero .motivo{right:-150px;top:40px;width:560px;height:560px}
.pagina-hero .nel-foro{left:max(16px,calc(50% - 60px));right:auto;top:195px;width:250px;height:250px}
.pagina-hero .intro{padding:16px var(--margine) 0;max-width:none}
.invito{margin-top:48px}
}
@media (prefers-reduced-motion:no-preference){.pulsante,.invito .parola{transition:background-color .15s,letter-spacing .2s}}
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
function testoDellaPagina(testo: string, ospiti: string[]): string {
  return pulisciTesto(testo).replace(/<img\b[^>]*>/gi, (tag) => {
    const src = tag.match(/\bsrc="([^"]*)"/i)?.[1] ?? ''
    if (/^\/(?![/\\])/.test(src)) return tag
    const host = src.match(/^https:\/\/([^/?#:]+)/i)?.[1]?.toLowerCase()
    return host && ospiti.map((o) => o.toLowerCase()).includes(host) ? tag : ''
  })
}

function testata(c: Contesto, conContatti: boolean): string {
  const menu = lista(voci('menu', c))
  return `<header class="testata"><a class="logo" href="/" aria-label="${esc(NOME)}, pagina iniziale">${MARCHIO}</a>${menu ? `<nav aria-label="Principale"><ul>${menu}</ul></nav>` : ''}${conContatti ? `<a class="pulsante piccolo" href="${TESTI.contatti}">${TESTI.prova}</a>` : ''}</header>`
}

function piede(c: Contesto): string {
  const f = lista(voci('footer', c))
  const recapiti = `<li>${esc(CONTATTI.indirizzo)}</li><li>${esc(CONTATTI.telefono)}</li><li><a href="${esc(CONTATTI.instagram)}" rel="noopener noreferrer">Instagram</a></li><li><a href="${esc(CONTATTI.facebook)}" rel="noopener noreferrer">Facebook</a></li>`
  return `<footer class="piede"><div class="marchio" aria-hidden="true">${PIEDE}<div class="nel-foro"><span class="logo">${MARCHIO}</span></div></div><div class="colonne">${f ? `<div><h2>${TESTI.altriLink}</h2><ul>${f}</ul></div>` : ''}<div><h2>${TESTI.trovarci}</h2><ul>${recapiti}</ul></div></div><div class="fine"><span>© ${NOME}</span></div></footer>`
}

function invito(conContatti: boolean): string {
  if (!conContatti) return ''
  return `<a class="invito" href="${TESTI.contatti}"><span class="frase">${TESTI.invito} ${esc(CONTATTI.indirizzo)}.</span><span class="freccia" aria-hidden="true">↗</span><span class="parola">${TESTI.prova}</span></a>`
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
    : `<section class="pagina-hero"><div class="intro"><h1>${esc(p.titolo)}</h1>${p.descrizione ? `<p>${esc(p.descrizione)}</p>` : ''}${conContatti && p.slug !== 'contatti' ? `<div><a class="pulsante" href="${TESTI.contatti}">${TESTI.contattaci}</a></div>` : ''}</div><div class="scena" aria-hidden="true"><div class="motivo">${GRANDE}</div><div class="nel-foro"><span class="logo">${MARCHIO}</span></div></div></section>`
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
