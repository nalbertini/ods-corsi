import { urlImmagine } from './sitoImmagini'
import { indirizzoValido, slugValido } from './sitoPagine'
import { pulisciTesto } from './sitoTesto'
import { GRIGLIA_MASSIMA, collage, impagina } from './sitoLayout'
import { CONTATTI } from './sito'

/**
 * Il sito pubblico: dalle pagine pubblicate nel pannello SITO ai file statici.
 *
 * Il testo pulito si mette in pagina a sezioni e tessere in `sitoLayout.ts` (`impagina`), e la testata della Home con
 * collage di foto e numeri è `collage` (le foto sul telefono vanno dopo i numeri: `order:2` nel CSS).
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
  provaTestata: 'Prova una settimana · 5 €',
  contattaci: 'Contattaci',
  invito: 'Vieni a provare: ti aspettiamo in',
  altriLink: 'Altri link',
  pagine: 'Pagine',
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

/** L'ultima riga di una griglia da 8 a 16 tessere si allarga: con una in più l'ultima è a tutta riga, con due in più sono due larghe. */
const GRIGLIE_LUNGHE = Array.from({ length: GRIGLIA_MASSIMA - 7 }, (_, i) => i + 8)
  .flatMap((n) => (n % 3 === 1 ? [`.tessere.n-${n} .tessera:last-child{grid-column:span 6}`] : n % 3 === 2 ? [`.tessere.n-${n} .tessera:nth-last-child(1),.tessere.n-${n} .tessera:nth-last-child(2){grid-column:span 3}`] : []))
  .join('\n')

/**
 * L'aspetto «A2 · Tatami blu e giallo» (docs/design-canvas/sito-rebrand/, token in
 * token-proposta.md): tessere a filo con angoli di 6px, titoli in Big Shoulders
 * Display maiuscolo, testo in Inter. I colori sono cinque e il bianco: non se ne
 * aggiungono senza cambiare prima il design. Regola dei colori: il giallo è uno
 * sfondo (pulsante «Prova», invito) con l'inchiostro sopra; sul piede scuro serve solo come colore del focus;
 * il bianco sta solo sul blu e sull'inchiostro.
 *
 * I titoli delle colonne del piede restano per chi legge con lo schermo (`.piede h2` è fuori vista): il design non li mostra.
 *
 * Sul telefono ogni tessera della testata occupa una colonna e l'ultimo numero dispari due: le classi doppie
 * (`.tessere.tessere .tessera.tessera`) alzano la specificità sopra le regole `n-N` delle sezioni.
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
.logo img{display:block;width:112px;height:110px;mix-blend-mode:multiply}
.testata{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px 24px;padding:22px var(--margine)}
.testata nav ul{display:flex;flex-wrap:wrap;gap:6px;margin:0;padding:0;list-style:none;font-size:17px;font-weight:500}
.testata nav a{display:inline-flex;align-items:center;min-height:44px;padding:0 16px;border-radius:6px;text-decoration:none}
.testata nav a:hover{background:var(--chiara)}
.pulsante,.testo a.pulsante,.colonna a.pulsante{display:inline-flex;align-items:center;justify-content:center;min-height:56px;padding:0 32px;border-radius:6px;background:var(--inchiostro);color:#fff;font-size:18px;font-weight:600;text-decoration:none}
.pulsante.piccolo{min-height:48px;padding:0 26px;font-size:16px}
.intro .pulsante{min-height:60px;padding:0 34px}
.testata .pulsante{background:var(--giallo);color:var(--inchiostro)}
.pulsante:hover{text-decoration:underline;text-underline-offset:4px}
h1,h2,h3{font-family:var(--display);text-transform:uppercase;font-weight:800}
h1{margin:0;font-size:clamp(56px,15.8vw,228px);letter-spacing:-.01em;line-height:.82;overflow-wrap:anywhere}
.pagina-hero{padding:40px var(--margine) 96px;display:flex;flex-wrap:wrap;align-items:stretch;gap:28px 56px}
.pagina-hero .intro{flex:1 1 440px;display:flex;flex-direction:column;max-width:min(980px,100%)}
.intro h1{margin-bottom:auto}
.intro p{margin:0 0 28px;font-size:clamp(18px,1.6vw,22px);line-height:1.45;max-width:520px}
.pagina-testo{padding:40px var(--margine) 24px}
.pagina-testo h1{font-size:clamp(48px,8vw,120px);max-width:14em}
.testo{padding:24px var(--margine) 40px;max-width:calc(62ch + var(--margine) * 2)}
.pagina-testo + .testo{padding-top:8px}
.testo>*+*,.colonna>*+*{margin-top:16px}
.testo h2{font-family:var(--display);text-transform:uppercase;margin:clamp(40px,5vw,64px) 0 14px;font-size:clamp(40px,5vw,72px);letter-spacing:-.005em;line-height:.9}
.testo h3{margin:32px 0 10px;font-size:clamp(28px,3vw,40px);line-height:.95}
.testo p,.testo ul,.testo ol,.testo blockquote,.colonna p,.colonna ul,.colonna ol{margin-top:0;margin-bottom:0}
.testo ul,.testo ol,.colonna ul,.colonna ol{padding-left:1.3em}
.testo li+li,.colonna li+li{margin-top:6px}
.testo blockquote{padding-left:18px;border-left:4px solid var(--blu);font-size:1.15em}
.testo a,.colonna a{text-underline-offset:3px}
.testo img,.colonna img{max-width:100%;height:auto;border-radius:6px}
.invito{display:flex;flex-direction:column;justify-content:space-between;gap:20px;margin:0 var(--margine) 6px;padding:36px 40px;min-height:300px;border-radius:6px;background:var(--giallo);color:var(--inchiostro);text-decoration:none}
.invito .riga{display:flex;justify-content:space-between;gap:16px;align-items:flex-start}
.invito .frase{max-width:min(520px,80%);font-size:22px;line-height:1.35}
.invito .freccia{display:none}
.invito .parola{font-family:var(--display);text-transform:uppercase;font-weight:800;font-size:170px;line-height:.8;letter-spacing:-.01em}
.piede{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:flex-start;gap:32px;margin:0 var(--margine) 48px;padding:40px;background:var(--inchiostro);color:#fff;border-radius:6px}
.piede .nome{max-width:5.5em;margin:0;font-family:var(--display);text-transform:uppercase;font-weight:800;font-size:56px;line-height:.9}
.piede .colonne{display:contents;font-size:16px;line-height:1.9}
.piede .colonne>div{font-size:16px;line-height:1.9}
.piede h2{position:absolute;width:1px;height:1px;margin:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.piede ul{margin:0;padding:0;list-style:none}
.piede a{text-decoration:none}
.piede a:hover{text-decoration:underline}
.piede .fine{flex-basis:100%;display:flex;flex-wrap:wrap;gap:16px;justify-content:space-between;align-items:center;margin-top:0;font-size:14px;color:var(--chiara)}
.sezione{padding:0 var(--margine) 96px}
.sezione h2{font-family:var(--display);text-transform:uppercase;margin:0 0 28px;font-size:clamp(48px,9vw,120px);letter-spacing:-.01em;line-height:.85;overflow-wrap:anywhere}
.testo + .sezione{padding-top:24px}
.colonna{max-width:calc(62ch + var(--margine) * 2);padding-bottom:24px}
.tessere{display:grid;grid-template-columns:repeat(6,1fr);gap:6px}
.tessera{grid-column:span 2;display:flex;flex-direction:column;gap:14px;margin:0;padding:24px;border-radius:6px;font-size:clamp(17px,1.2vw,19px);line-height:1.5}
.tessera>*{margin:0}
.tessera h3{margin:0;font-size:clamp(32px,4vw,58px);line-height:.95;overflow-wrap:anywhere}
.tessera ul,.tessera ol{padding-left:1.3em}
.tessera li+li{margin-top:6px}
.tessera a{color:inherit;text-decoration:underline;text-underline-offset:3px}
.tessera img{display:block;max-width:100%;border-radius:6px}
.tessera.blu{background:var(--blu);color:#fff}
.tessera.giallo{background:var(--giallo);color:var(--inchiostro)}
.tessera.inchiostro{background:var(--inchiostro);color:#fff}
.tessera.chiara{background:var(--chiara);color:var(--inchiostro);padding:26px 28px;font-size:17px}
.tessera.chiara h3{font-size:30px;line-height:.95}
.tessera.tessera:has(h3 a) h3{font-size:46px;line-height:.95}
.tessera.tessera:has(h3 a){justify-content:space-between;padding:22px 24px}
.tessera h3 a{text-decoration:none}
.tessera:has(h3 a) p{font-size:16px;line-height:1.4;max-width:300px}
.tessera:has(h3 a) .etichette{max-width:none;margin-top:12px}
.corso-foto{display:none}
.etichette{display:flex;flex-wrap:wrap;gap:6px}
.etichetta{display:inline-flex;align-items:center;gap:6px;padding:6px 12px 6px 8px;border-radius:999px;background:var(--chiara);color:var(--inchiostro);font-size:14px;font-weight:600;line-height:1}
.etichetta svg{display:block;flex-shrink:0}
.sotto{display:none}
.tessere.n-4 .tessera{padding:26px 30px}
.tessere.n-4 h3{font-size:58px;line-height:.92}
.tessera.blu a:focus-visible,.tessera.inchiostro a:focus-visible{outline-color:var(--giallo)}
.tessera.giallo a:focus-visible,.tessera.chiara a:focus-visible{outline-color:var(--inchiostro)}
.tessera.blu a.pulsante,.tessera.inchiostro a.pulsante{background:var(--giallo);color:var(--inchiostro);text-decoration:none}
.tessera.giallo a.pulsante,.tessera.chiara a.pulsante{background:var(--inchiostro);color:#fff;text-decoration:none}
.tessere.n-1 .tessera{grid-column:span 6}
.tessere.n-2 .tessera,.tessere.n-4 .tessera{grid-column:span 3}
.tessere.n-5 .tessera:nth-child(4),.tessere.n-5 .tessera:nth-child(5){grid-column:span 3}
.tessere.n-7 .tessera:last-child{grid-column:span 6}
${GRIGLIE_LUNGHE}
.tessera.citazione{padding:36px 40px;font-size:26px;line-height:1.3;font-weight:500;justify-content:space-between}
.tessera:has(>h3:only-child){justify-content:flex-end}
.firma em{font-style:normal}
.tessera.citazione>p:first-child::before{content:"«"}
.tessera.citazione>p:first-child::after{content:"»"}
.firma{display:flex;align-items:center;gap:14px;font-family:var(--display);text-transform:uppercase;font-weight:800;font-size:clamp(26px,2.4vw,34px);line-height:1}
.citazioni-foto{display:flex;gap:6px;margin:0 calc(var(--margine) * -1) 0 0}
.citazioni-foto figure{position:relative}
.citazioni-foto figure img{position:absolute;inset:0;height:100%;aspect-ratio:auto}
.citazioni-foto .citazioni{flex:1;min-width:0;margin:0}
.citazioni{display:flex;gap:6px;margin:0 0 6px;overflow-x:auto;scroll-snap-type:x mandatory}
.citazioni{scroll-marker-group:after}
.citazioni::scroll-marker-group{display:flex;gap:8px;margin-top:14px;padding-right:var(--margine)}
.citazioni .tessera::scroll-marker{content:"";width:14px;height:14px;border-radius:7px;background:var(--blu)}
.citazioni .tessera::scroll-marker:target-current{width:40px;background:var(--inchiostro)}
.citazioni:focus-visible{outline:3px solid var(--blu);outline-offset:3px}
.citazioni .tessera{flex:0 0 min(560px,85%);scroll-snap-align:start}
.foto{position:relative;padding:0;overflow:hidden}
.foto img{width:100%;aspect-ratio:3/2;object-fit:cover;border-radius:0}
.foto-fila{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}
.foto-fila.quattro{grid-template-columns:repeat(4,1fr)}
.foto-fila.quattro img{aspect-ratio:auto;height:540px}
.avatar{flex:none;display:inline-flex;align-items:center;justify-content:center;width:56px;height:56px;border-radius:50%;background:var(--giallo);color:var(--inchiostro);font-size:28px;line-height:1}
.due{grid-template-columns:repeat(2,1fr)}
.foto-fila figure{grid-column:auto}
.sezione>*+*{margin-top:6px}
.pagina-hero>.collage,.pagina-hero>.tessere{flex:0 1 640px;max-width:640px;margin-top:0}
.collage{display:grid;grid-template-columns:repeat(6,1fr);grid-auto-rows:minmax(128px,auto);gap:6px}
.collage .foto.grande{grid-column:1 / span 4;grid-row:1 / span 3}
.collage .foto.grande img{flex:1;min-height:0;height:100%}
.collage .numero{grid-column:span 2}
.collage .foto.larga{grid-column:span 6}
.collage .foto.meta{grid-column:span 3}
.collage .foto.meta:nth-last-child(2){grid-column:1 / span 3}
.collage .foto.meta:last-child{grid-column:4 / span 3}
.collage.pieno{grid-template-rows:repeat(6,minmax(128px,auto))}
.collage.pieno .tessera:not(.foto){padding:14px 16px;justify-content:flex-end;gap:4px}
.collage.pieno .cifra{font-size:60px;line-height:.9}
.collage.pieno .titolo{font-family:var(--display);text-transform:uppercase;font-weight:800;font-size:32px;line-height:.9;overflow-wrap:anywhere}
.collage.pieno .nota .scritta{font-size:15px;line-height:1.3}
.numero{justify-content:space-between;min-width:0}
.numero .cifra{font-family:var(--display);font-weight:800;font-size:clamp(40px,5vw,88px);line-height:.85;letter-spacing:-.01em;white-space:nowrap}
.numero .scritta{font-size:16px;line-height:1.3}
.numero.lunga .cifra{font-size:clamp(26px,3vw,40px);line-height:.95;white-space:normal;overflow-wrap:anywhere}
.non-trovata{padding:40px var(--margine) 96px}
.non-trovata p{max-width:34em}
@media (min-width:901px){
.sezione .tessera:not(.foto){min-height:clamp(190px,16vw,260px)}
.sezione .tessere.n-4 .tessera:not(.foto){min-height:190px}
.sezione .tessera.chiara:not(.foto){min-height:260px}
.sezione .tessera.tessera:not(.foto):has(h3 a){min-height:340px}
.testata nav ul{gap:36px}
.testata nav a{padding:0}
.testata nav a:hover{background:none;text-decoration:underline;text-underline-offset:4px}
.pagina-hero>.collage{align-self:start}
.citazioni-foto{min-height:560px}
.citazioni-foto .foto{flex:0 0 640px}
.pagina-hero .collage.pieno>.tessera:nth-child(1){grid-column:1 / span 3;grid-row:1 / span 4}
.pagina-hero .collage.pieno>.tessera:nth-child(2){grid-column:4;grid-row:1 / span 2}
.pagina-hero .collage.pieno>.tessera:nth-child(3){grid-column:5 / span 2;grid-row:1}
.pagina-hero .collage.pieno>.tessera:nth-child(4){grid-column:5 / span 2;grid-row:2}
.pagina-hero .collage.pieno>.tessera:nth-child(5){grid-column:4 / span 2;grid-row:3}
.pagina-hero .collage.pieno>.tessera:nth-child(6){grid-column:6;grid-row:3 / span 2}
.pagina-hero .collage.pieno>.tessera:nth-child(7){grid-column:4 / span 2;grid-row:4}
.pagina-hero .collage.pieno>.tessera:nth-child(8){grid-column:3 / span 2;grid-row:5}
.pagina-hero .collage.pieno>.tessera:nth-child(9){grid-column:5 / span 2;grid-row:5}
.pagina-hero .collage.pieno>.tessera:nth-child(10){grid-column:1 / span 2;grid-row:6}
.pagina-hero .collage.pieno>.tessera:nth-child(11){grid-column:1 / span 2;grid-row:5}
.pagina-hero .collage.pieno>.tessera:nth-child(12){grid-column:3 / span 2;grid-row:6}
.pagina-hero .collage.pieno>.tessera:nth-child(13){grid-column:5 / span 2;grid-row:6}
.collage.pieno>figure img{position:absolute;inset:0;height:100%;aspect-ratio:auto}
}
@media (max-width:900px){
.testata{flex-wrap:wrap;gap:8px 16px}
.tessere{grid-template-columns:1fr}
.tessere .tessera{grid-column:auto}
.pagina-hero{flex-direction:column;align-items:stretch}
.pagina-hero .intro,.pagina-hero>.collage,.pagina-hero>.tessere{flex:none;max-width:none}
.pagina-hero .tessere,.collage{grid-template-columns:repeat(2,1fr);grid-auto-rows:auto}
.pagina-hero .tessere.tessere .tessera.tessera,.collage .numero{grid-column:auto}
.pagina-hero .tessere.tessere .numero.ultima,.collage .numero.ultima{grid-column:span 2}
.collage .foto.grande,.collage .foto.larga,.collage .foto.meta,.collage .foto.meta:nth-last-child(2),.collage .foto.meta:last-child{grid-column:1 / span 2;grid-row:auto;order:2}
.collage .foto.grande img{aspect-ratio:3/2;height:auto;flex:none}
.foto-fila,.foto-fila.quattro{grid-template-columns:repeat(2,1fr)}
.foto-fila.quattro img{aspect-ratio:3/4}
.testata nav{order:3;width:100%}
.testata{padding:12px var(--margine) 0;gap:10px 16px}
.logo img{width:84px;height:82px}
.testata .pulsante{padding:0 22px;font-size:0}
.testata .pulsante::before{content:"Prova";font-size:16px}
.testata nav a{background:var(--chiara);padding:0 14px;font-size:16px}
.testata nav a[aria-current]{background:var(--giallo)}
h1{font-size:84px;line-height:.84}
.pagina-hero{padding:20px var(--margine) 0;gap:36px 0}
.intro h1{margin-bottom:20px}
.intro p{font-size:18px;margin-bottom:22px}
.intro .pulsante{min-height:52px;padding:0 26px;font-size:17px}
.sezione{padding:48px var(--margine) 0}
.sezione h2{font-size:64px;line-height:.88;margin-bottom:20px}
.collage.pieno{grid-template-rows:none}
.collage.pieno .tessera.numero{min-height:150px;padding:16px;justify-content:space-between;gap:12px}
.collage.pieno .cifra{font-size:68px;line-height:.85}
.collage.pieno .numero .scritta{font-size:16px;line-height:1.45}
.collage.pieno .titolo{font-size:40px;line-height:.95}
.collage.pieno>.tessera:nth-child(n+7){display:none}
.collage.pieno>.tessera:nth-child(2){order:1}
.collage.pieno>.tessera:nth-child(5){order:2}
.collage.pieno>.tessera:nth-child(4){order:3}
.collage.pieno>.tessera:nth-child(6){order:4;background:var(--chiara);color:var(--inchiostro)}
.collage.pieno>.tessera:nth-child(1){order:5}
.collage.pieno>.tessera:nth-child(3){order:6;grid-column:1 / span 2;min-height:140px;padding:20px;justify-content:space-between;gap:12px}
.collage .foto.grande{height:300px}
.collage.pieno>figure.grande img{height:100%;aspect-ratio:auto}
.foto-fila.quattro img{height:220px;aspect-ratio:auto}
.foto-fila.quattro .foto:nth-child(n+3){display:none}
.tessere.n-4 .tessera{min-height:120px;padding:18px}
.tessere.n-4 h3{font-size:40px;line-height:.95}
.tessera.tessera:has(h3 a){min-height:200px;padding:20px;gap:12px}
.tessera:has(h3 a) p{max-width:none;line-height:1.45}
.tessera:has(h3 a) h3{display:flex;justify-content:space-between;align-items:flex-start}
.tessera:has(h3 a) h3::after{content:"↗";font-size:36px;line-height:1}
.corso-foto{display:block;height:150px;overflow:hidden;border-radius:6px}
.corso-foto img{width:100%;height:100%;object-fit:cover;border-radius:0}
.sotto{display:block;font-size:16px;line-height:1.45}
.tessere.n-9 .tessera.tessera:nth-child(1){background:var(--giallo);color:var(--inchiostro)}
.tessere.n-9 .tessera.tessera:nth-child(2){background:var(--blu);color:#fff}
.tessere.n-9 .tessera.tessera:nth-child(3){background:var(--inchiostro);color:#fff}
.tessere.n-9 .tessera.tessera:nth-child(4){background:var(--blu);color:#fff}
.tessere.n-9 .tessera.tessera:nth-child(5){background:var(--inchiostro);color:#fff}
.tessere.n-9 .tessera.tessera:nth-child(6){background:var(--giallo);color:var(--inchiostro)}
.tessere.n-9 .tessera.tessera:nth-child(7){background:var(--inchiostro);color:#fff}
.tessere.n-9 .tessera.tessera:nth-child(8){background:var(--giallo);color:var(--inchiostro)}
.tessere.n-9 .tessera.tessera:nth-child(9){background:var(--blu);color:#fff}
.tessera.tessera:has(h3 a) h3{font-size:38px}
.tessera.chiara{min-height:160px;padding:20px;font-size:16px;line-height:1.45;justify-content:space-between;gap:12px}
.tessere .tessera.chiara:nth-child(odd){background:var(--giallo)}
.citazioni{margin:0 calc(var(--margine) * -1) 6px;padding:0 var(--margine);scroll-padding:0 var(--margine)}
.citazioni .tessera{flex:0 0 300px}
.tessera.citazione{min-height:300px;padding:22px;gap:20px;font-size:19px;line-height:1.35}
.avatar{width:48px;height:48px;font-size:24px;background:var(--chiara)}
.firma{gap:12px;font-size:28px;line-height:.95}
.citazioni-foto{margin:0;display:block}
.citazioni-foto .foto{display:none}
.invito{margin:48px var(--margine) 6px;min-height:260px;padding:22px;gap:20px}
.invito .frase{font-size:17px;line-height:1.35}
.invito .parola{font-size:120px}
.piede{margin:0 var(--margine) 24px;padding:24px;gap:14px}
.piede .nome{font-size:44px}
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
/** `corrente` è l'indirizzo della pagina aperta: la sua voce porta `aria-current` (sul telefono è la tessera gialla del menu). */
const lista = (v: Array<{ etichetta: string; href: string }>, corrente = '') => v.map((x) => `<li><a href="${esc(x.href)}"${x.href === corrente ? ' aria-current="page"' : ''}${rel(x.href)}>${esc(x.etichetta)}</a></li>`).join('')

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

function testata(c: Contesto, conContatti: boolean, corrente = ''): string {
  const menu = lista(voci('menu', c), corrente)
  return `<header class="testata"><a class="logo" href="/" aria-label="${esc(NOME)}, pagina iniziale">${MARCHIO}</a>${menu ? `<nav aria-label="Principale"><ul>${menu}</ul></nav>` : ''}${conContatti ? `<a class="pulsante piccolo" href="${TESTI.contatti}">${TESTI.provaTestata}</a>` : ''}</header>`
}

function piede(c: Contesto): string {
  const f = lista(voci('footer', c))
  const m = lista(voci('menu', c))
  const recapiti = `<li>${esc(CONTATTI.indirizzo)}</li><li>${esc(CONTATTI.telefono)}</li><li><a href="${esc(CONTATTI.instagram)}" rel="noopener noreferrer">Instagram</a></li><li><a href="${esc(CONTATTI.facebook)}" rel="noopener noreferrer">Facebook</a></li>`
  return `<footer class="piede"><p class="nome">${NOME}</p><div class="colonne"><div><h2>${TESTI.trovarci}</h2><ul>${recapiti}</ul></div>${m ? `<div><h2>${TESTI.pagine}</h2><ul>${m}</ul></div>` : ''}${f ? `<div><h2>${TESTI.altriLink}</h2><ul>${f}</ul></div>` : ''}</div><div class="fine"><span>© ${NOME}</span></div></footer>`
}

function invito(conContatti: boolean): string {
  if (!conContatti) return ''
  return `<a class="invito" href="${TESTI.contatti}"><span class="riga"><span class="frase">${TESTI.invito} ${esc(CONTATTI.indirizzo)}.</span><span class="freccia" aria-hidden="true">↗</span></span><span class="parola">${TESTI.prova}</span></a>`
}

function documento(c: Contesto, o: { titolo: string; descrizione: string; percorso: string; corpo: string; noindex?: boolean }): string {
  const url = `${c.d.dominio}${o.percorso}`
  const completo = o.percorso === '/' ? o.titolo : `${o.titolo} · ${NOME}`
  return `<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(completo)}</title>${o.descrizione ? `<meta name="description" content="${esc(o.descrizione)}">` : ''}<link rel="icon" type="image/svg+xml" href="/risorse/icon.svg"><link rel="icon" type="image/png" sizes="192x192" href="/risorse/icon-192.png"><link rel="apple-touch-icon" href="/risorse/apple-touch-icon.png"><link rel="canonical" href="${esc(url)}"><meta property="og:title" content="${esc(o.titolo)}">${o.descrizione ? `<meta property="og:description" content="${esc(o.descrizione)}">` : ''}<meta property="og:type" content="website"><meta property="og:url" content="${esc(url)}">${o.noindex ? '<meta name="robots" content="noindex">' : ''}<style>${CSS}</style></head><body>${o.corpo}</body></html>`
}

function pagina(p: PaginaGenerata, c: Contesto, conContatti: boolean): string {
  const pulito = testoDellaPagina(p.testo, c.d.ospitiImmagini ?? [])
  // Solo la Home ha il collage di foto e numeri in testata; quello che non entra nel collage resta nel testo.
  const inTestata = p.slug === 'home' && !p.diLegge ? collage(pulito) : { html: '', resto: pulito }
  const testo = inTestata.resto
  const t = testata(c, conContatti, percorso(p.slug))
  const intro = p.diLegge
    ? `<section class="pagina-testo"><h1>${esc(p.titolo)}</h1></section>`
    : `<section class="pagina-hero"><div class="intro"><h1>${esc(p.titolo)}</h1>${p.descrizione ? `<p>${esc(p.descrizione)}</p>` : ''}${conContatti && p.slug !== 'contatti' ? `<div><a class="pulsante" href="${TESTI.contatti}">${TESTI.contattaci}</a></div>` : ''}</div>${inTestata.html}</section>`
  const corpo = `${t}<main>${intro}${testo.trim() ? (!p.diLegge && /<h2[\s>]/i.test(testo) ? impagina(testo) : `<div class="testo">${testo}</div>`) : ''}</main>${p.slug !== 'contatti' ? invito(conContatti) : ''}${piede(c)}`
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
