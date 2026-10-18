import { urlImmagine } from './sitoImmagini'
import { indirizzoValido, slugValido } from './sitoPagine'
import { pulisciTesto } from './sitoTesto'
import { GRIGLIA_MASSIMA, collage, conFila, impagina, persona, testataCorso } from './sitoLayout'
import { elencoIstruttori, schedaScarna, type Cornice } from './sitoIstruttori'
import { CSS_CORSI, CSS_CORSI_NUOVA, corsiNuova, eCorsiNuova } from './sitoCorsi'
import { CSS_INTERNE } from './sitoInterne'
import { cssFoci, cssFociSchede } from './sitoFoto'
import { eContattiNuova, contattiNuova } from './sitoContatti'
import { CSS_ORARI, dividiOrari, orariHtml, type OrarioSito } from './sitoOrari'
import { eHomeNuova, homeNuova } from './sitoHome'
import { CSS_ORARIO_AUTOMATICO, corsoNuovo, cssFuochiCorso, eCorsoNuovo } from './sitoCorso'
import { testiOrario, type OrarioAperto } from './sitoOrario'
import { CSS_CHI_SIAMO, chiSiamoNuova, eChiSiamoNuova } from './sitoChiSiamo'
import { CONTATTI, chiama } from './sito'
import { corsiDa, datiStrutturati } from './sitoDati'

/**
 * Il sito pubblico: dalle pagine pubblicate nel pannello SITO ai file statici.
 *
 * Il testo pulito si mette in pagina a sezioni e tessere in `sitoLayout.ts` (`impagina`), e la testata della Home con
 * collage di foto e numeri è `collage` (le foto sul telefono vanno dopo i numeri: `order:2` nel CSS).
 *
 * Qui si pulisce il testo un'altra volta (`pulisciTesto`): è la pulizia di cui
 * ci si fida, perché chi scrive all'API salta il pannello e il filtro del
 * database è solo una difesa in più. Titolo, descrizione ed etichette si
 * scrivono sempre escapati. Il sito non ha codice (l'unico `<script>` è il blocco di dati strutturati di `sitoDati.ts`, che è JSON) né
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
  /** I corsi di CORSI da cui viene l'orario della pagina (`sito_pagine.corsi_collegati`). Vuoto o assente: l'orario resta quello scritto a mano. */
  corsiCollegati?: string[]
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
  /** Gli orari tipo dei corsi attivi (`orari_sito()`) per la pagina «orari» (non `orari`, che sono le righe di `orari_aperti()` per le pagine dei corsi). Può mancare: la pagina dice «Orari in arrivo». */
  orariSito?: OrarioSito[]
  /** Prefissi di indirizzo da cui le immagini del testo sono ammesse: il contenitore delle immagini (`…/storage/v1/object/public/sito/`). Vuoto: solo quelle del sito. */
  ospitiImmagini?: string[]
  /** Le ricorrenze dei corsi (`orari_aperti()`): servono alle pagine collegate. Senza, una pagina collegata dice «Orario in arrivo». */
  orari?: OrarioAperto[]
}

/**
 * Le parole fisse del modello. Stanno qui, in un posto solo, perché il design è
 * deciso e non cambiano da una pagina all'altra; se la segreteria dovrà
 * cambiarle sarà una funzione a parte.
 */
const TESTI = {
  nome: 'Officine dello Sport',
  immagineAlt: 'Officine dello Sport: il marchio con i cinque ingranaggi colorati',
  prova: 'Prova',
  provaIntera: 'Prova una settimana a 5 €',
  metro: 'vicino alla metro Fermi',
  scrivici: 'Scrivici',
  invito: 'Vieni a provare: ti aspettiamo in',
  settimana: 'Una settimana a 5 euro: provi tutte le discipline e scegli.',
  altriLink: 'Altri link',
  pagine: 'Pagine',
  trovarci: 'Vieni a trovarci',
  menu: 'Menu',
  inpiu: 'Una settimana a 5 euro: provi tutte le discipline e scegli.',
  contatti: '/contatti/',
  // Il modulo sta nell'app (stesso indirizzo della guida), non nel sito: «Prova» porta a chi vuole iscriversi.
  iscrizione: 'https://app.officinedellosport.it/iscrizioni/',
}
const NOME = TESTI.nome
/** L'immagine di condivisione, 1200×630, nella cartella delle risorse del sito. */
const IMMAGINE_SOCIALE = '/risorse/social.png'
const DOMINIO = /^https?:\/\/[a-z0-9.-]+(:\d+)?$/i

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

const slugDiPagina = (s: string) => s === 'home' || slugValido(s)

/** L'indirizzo della pagina dentro il sito: la home è «/», le altre «/slug/». */
const percorso = (slug: string) => (slug === 'home' ? '/' : `/${slug}/`)

/** Dove si scrive il file di una pagina. */
export const fileDi = (slug: string) => (slug === 'home' ? 'index.html' : `${slug}/index.html`)

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
 * L'aspetto «A2 · Tatami blu e giallo» (docs/design-canvas/sito-approvato/, token in
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
// Le regole `.pagina-contatti`, `.recapiti` e `.apertura` sono la pagina Contatti (docs/sito/contatti.md).
/** I colori delle tessere di una pagina di persona, come nel design: per ogni gruppo, i colori nell'ordine. */
const GRUPPI_PERSONA: Array<[string, string[]]> = [
  ['.persona .apertura .fila-4', ['giallo', 'blu', 'inchiostro', 'giallo']],
  ['.persona .apertura .fila-3', ['chiara', 'giallo', 'blu']],
  ['.persona .sezione:not(.apertura) .fila-3', ['inchiostro', 'giallo', 'chiara']],
  ['.persona .sezione:not(.apertura) .fila-4', ['giallo', 'blu', 'inchiostro', 'giallo']],
]
const TINTE_PERSONA = GRUPPI_PERSONA.flatMap(([sel, colori]) => colori.map((c, i) => `${sel} .tessera:nth-child(${i + 1}){background:var(--${c});color:${c === 'giallo' || c === 'chiara' ? 'var(--inchiostro)' : '#fff'}}`)).join('\n')

/** La testata e il piede di tutte le pagine: due pulsanti interi (prova e Scrivici), sul telefono il tasto MENU che apre il menu con `:target`, senza script; bersagli da 48px. */
const CSS_TESTATA = `
.tasto-menu,.testata .chiudi,.testata .nel-menu{display:none}
.testata nav ul{display:flex;flex-wrap:wrap;gap:10px;margin:0;padding:0;list-style:none;font-size:17px;font-weight:500}
.testata nav a{display:inline-flex;align-items:center;min-height:48px;padding:0 16px;border-radius:6px;text-decoration:none}
.testata nav a:hover{background:var(--chiara)}
.testata nav a[aria-current]{background:var(--giallo)}
.testata .azioni{display:flex;gap:8px;align-items:center}
.pulsante.primario{background:var(--giallo);color:var(--inchiostro)}
.pulsante.secondario{background:transparent;color:var(--inchiostro);border:2px solid var(--inchiostro)}
.testata .pulsante{min-height:52px;padding:0 24px;font-size:16px}
.piede a{display:inline-flex;align-items:center;min-height:48px;min-width:48px}
.piede-menu a{display:flex}
.piede .metro{display:block;color:var(--chiara);font-size:15px;line-height:1.4}
@media (min-width:901px){
.testata nav ul{gap:4px}
.testata nav a:hover{background:none;text-decoration:underline;text-underline-offset:4px}
}
@media (max-width:900px){
.testata{position:relative;flex-wrap:nowrap;gap:12px;padding:12px var(--margine)}
.testata .azioni{display:none}
.testata .tasto-menu{display:inline-flex;align-items:center;min-height:48px;padding:0 22px;border-radius:6px;background:var(--inchiostro);color:#fff;font-size:16px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;text-decoration:none}
#menu{display:none;order:0;width:auto}
#menu:target{display:block;position:absolute;z-index:10;top:100%;left:0;right:0;padding:12px var(--margine) 24px;background:var(--fondo);box-shadow:0 14px 24px rgba(13,42,61,.2)}
.testata nav ul{flex-direction:column;gap:6px}
.testata nav a{min-height:48px;padding:0 16px;font-size:17px}
.testata .chiudi{display:flex;width:max-content;margin-left:auto;align-items:center;min-height:48px;margin-bottom:12px;font-weight:600;letter-spacing:.06em;text-transform:uppercase}
.testata .nel-menu{display:flex;justify-content:center;margin-top:12px;padding:0 24px;font-size:16px}
.piede-menu a{display:inline-flex}
}
`.replace(/\n/g, '')

/**
 * La pagina del corso rivista (sitoCorso.ts), in aggiunta alle regole della Home (CSS_HOME): foto di apertura o fascia,
 * dati, orario a tessere, «Cosa si fa» con la foto accanto. Tutto sotto `.corso-nuovo`: le altre pagine non cambiano.
 * Le larghezze delle tessere dell'orario (6 colonne, nessun buco) vengono dalle regole `n-N` di sempre.
 */
const CSS_CORSO_NUOVO = `
.corso-nuovo .corso-apertura{margin:48px var(--margine) 0;height:clamp(240px,43vw,619px);overflow:hidden;border-radius:6px}
.corso-nuovo .corso-apertura img{display:block;width:100%;height:100%;max-width:none;object-fit:cover;object-position:50% 40%;border-radius:0}
.corso-nuovo .corso-fascia{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:48px;margin:48px var(--margine) 0;padding:48px;list-style:none;border-radius:6px;background:var(--blu);color:#fff}
.corso-nuovo .corso-fascia li{margin:0;padding-top:14px;border-top:3px solid #fff}
.corso-nuovo .et{display:block;margin-bottom:8px;font-size:14px;font-weight:700;letter-spacing:.06em;text-transform:uppercase}
.corso-nuovo .corso-fascia .val{display:block;font-family:var(--display);font-weight:800;font-size:clamp(40px,4.4vw,64px);line-height:.95;text-transform:uppercase}
.corso-nuovo .tessere.dati{display:grid;gap:6px;margin:6px var(--margine) 0;grid-template-columns:repeat(4,minmax(0,1fr))}
.corso-nuovo .tessere.dati.n-1{grid-template-columns:1fr}
.corso-nuovo .tessere.dati.n-2{grid-template-columns:repeat(2,minmax(0,1fr))}
.corso-nuovo .tessere.dati.n-3{grid-template-columns:repeat(3,minmax(0,1fr))}
.corso-nuovo .tessere.dati>.tessera{grid-column:auto;min-height:150px;padding:24px 26px;justify-content:space-between;gap:12px}
.corso-nuovo .dato .val{margin:0;font-size:20px;font-weight:600;line-height:1.35}
.corso-nuovo .tessera.orario{display:grid;grid-template-columns:1fr auto;grid-template-rows:auto 1fr;align-items:start;gap:0 12px;min-height:170px;padding:24px 26px;font-size:17px;line-height:1.45}
.corso-nuovo .orario h3{font-size:clamp(28px,3.2vw,46px)}
.corso-nuovo .orario .ora{margin:0;font-family:var(--display);font-weight:800;font-size:clamp(26px,2.8vw,40px);line-height:1;text-transform:uppercase}
.corso-nuovo .orario .dettagli{grid-column:1 / -1;align-self:end;display:flex;flex-wrap:wrap;justify-content:space-between;gap:0 12px}
.corso-nuovo .numero-perche{opacity:.6}
.corso-nuovo .orario .dettagli p{margin:0}
.corso-nuovo .cosa-griglia{display:grid;grid-template-columns:minmax(0,1fr);gap:6px}
.corso-nuovo .cosa-si-fa.con-foto .cosa-griglia{grid-template-columns:minmax(0,1fr) 440px}
.corso-nuovo .tessere.testi{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;margin:0}
.corso-nuovo .cosa-si-fa.con-foto .tessere.testi{grid-template-columns:minmax(0,1fr)}
.corso-nuovo .tessere.testi>.tessera{grid-column:auto;min-height:220px;padding:32px;justify-content:flex-start;gap:12px;font-size:20px;line-height:1.45}
.corso-nuovo .testi h3{font-size:clamp(36px,3.6vw,52px);line-height:.95}
.corso-nuovo .corso-interna{margin:0;min-height:440px;overflow:hidden;border-radius:6px}
.corso-nuovo .corso-interna img{display:block;width:100%;height:100%;max-width:none;object-fit:cover;border-radius:0}
.corso-nuovo .tessere.perche.n-3{grid-template-columns:repeat(3,minmax(0,1fr))}
.corso-nuovo .tessere.perche.n-4{grid-template-columns:repeat(2,minmax(0,1fr))}
.corso-nuovo .tessere.perche>.tessera{grid-column:auto}
@media (max-width:900px){
.corso-nuovo h1.medio{font-size:16vw}
.corso-nuovo h1.lungo{font-size:13vw}
.corso-nuovo h1.lunghissimo{font-size:11vw}
.corso-nuovo .corso-apertura{margin-top:32px}
.corso-nuovo .corso-fascia{grid-template-columns:1fr;gap:24px;margin-top:32px;padding:28px 24px}
.corso-nuovo .tessere.dati,.corso-nuovo .tessere.dati.n-3,.corso-nuovo .tessere.dati.n-4{grid-template-columns:repeat(2,minmax(0,1fr))}
.corso-nuovo .tessere.dati>.tessera{min-height:130px;padding:20px}
.corso-nuovo .tessere.orari>.tessera{grid-column:1 / -1}
.corso-nuovo .cosa-si-fa.con-foto .cosa-griglia,.corso-nuovo .tessere.testi{grid-template-columns:minmax(0,1fr)}
.corso-nuovo .corso-interna{min-height:300px}
.corso-nuovo .tessere.perche.n-3,.corso-nuovo .tessere.perche.n-4{grid-template-columns:minmax(0,1fr)}
}
`.replace(/\n/g, '')

/**
 * Le regole della Home nuova (sitoHome.ts), e dei pezzi che le altre pagine potranno chiedere: pulsanti, schede, citazioni
 * con «Leggi tutto», recensioni, chiamata finale. Stanno sotto `main.passo-unico` (la pagina con un solo passo di
 * sezione: 96px sul computer, 64px sul telefono) e la testata e il piede, uguali in tutte le pagine; la Home di prima non ha il resto.
 * Sono scritte più specifiche delle regole di prima, che restano per le altre pagine.
 */
const CSS_HOME = `
.pulsanti{display:flex;flex-wrap:wrap;gap:12px}
.pulsanti .pulsante{min-height:60px;padding:0 28px}
.passo-unico .pagina-hero{display:grid;grid-template-columns:600px minmax(0,1fr);gap:48px;align-items:end;padding:24px var(--margine) 0}
.passo-unico .pagina-hero.solo{grid-template-columns:1fr}
.passo-unico .pagina-hero .intro{display:block;max-width:none}
.passo-unico h1{margin:0 0 32px;font-size:clamp(92px,10.83vw,156px);line-height:.86}
.passo-unico .intro p{max-width:520px;margin:0 0 32px;font-size:22px;line-height:1.5}
.hero-foto{margin:0;height:456px;overflow:hidden;border-radius:6px}
.hero-foto img{display:block;width:100%;height:100%;max-width:none;object-fit:cover;object-position:50% 40%;border-radius:6px}
.passo-unico .tessere.numeri{margin:48px var(--margine) 0;grid-template-columns:repeat(4,minmax(0,1fr));grid-auto-flow:row}
.passo-unico .tessere.numeri>.tessera{grid-column:auto;justify-content:space-between}
.passo-unico .numeri .tessera{min-height:150px}
.passo-unico .numeri .cifra{font-size:clamp(56px,6.3vw,84px)}
.motto{display:grid;grid-template-columns:1fr 1fr;gap:48px;align-items:center;margin:48px var(--margine) 0}
.motto h2{margin:0;font-size:64px;line-height:.92}
.motto p{margin:0 0 12px;font-size:20px;line-height:1.5}
.motto p:last-child{margin:0}
.passo-unico .sezione{padding:96px var(--margine) 0}
.passo-unico .sezione>*+*{margin-top:0}
.passo-unico .sezione h2{margin:0;font-size:clamp(56px,5.56vw,80px);line-height:.9;text-wrap:balance}
.passo-unico .sezione .colonna{max-width:900px;margin-top:24px;padding-bottom:0}
.passo-unico .sezione .colonna p{font-size:20px;line-height:1.5}
.passo-unico .sezione>.tessere,.passo-unico .sezione>.recensioni{margin-top:40px}
.tessere.schede{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));grid-auto-rows:1fr;gap:6px}
.tessere.schede>.tessera,.recensioni>*{grid-column:auto}
.passo-unico .tessere.schede .tessera.scheda:not(.foto){position:relative;min-height:0;padding:0;gap:0;overflow:hidden;font-size:17px}
.scheda-foto{flex:none;height:clamp(220px,30vw,240px);overflow:hidden;border-radius:0}
.scheda-foto img{display:block;width:100%;height:100%;max-width:none;object-fit:cover;border-radius:0}
.scheda-foto.senza-foto{display:flex;align-items:center;justify-content:center;background:var(--chiara);color:var(--inchiostro);font-family:var(--display);font-weight:800;line-height:1}
.scheda-foto.senza-foto span{font-size:96px}
.passo-unico .scheda h3,.passo-unico .scheda h4{margin:24px 72px 0 24px;font-size:clamp(36px,3.6vw,52px);line-height:.95;display:block}
.passo-unico .scheda h3 a,.passo-unico .scheda h4 a{display:inline-flex;align-items:center;min-height:48px;text-decoration:none}
.passo-unico .scheda h3 a::before,.passo-unico .scheda h4 a::before{content:"";position:absolute;inset:0}
.passo-unico .scheda h3 a:focus-visible,.passo-unico .scheda h4 a:focus-visible{outline:none}
.passo-unico .scheda:has(a:focus-visible){outline:3px solid var(--blu);outline-offset:3px}
.passo-unico .scheda h3::after,.passo-unico .scheda h4::after{content:"↗\uFE0E";position:absolute;top:16px;right:16px;display:flex;align-items:center;justify-content:center;width:48px;height:48px;border-radius:50%;background:#fff;color:var(--inchiostro);font-family:"Inter","Helvetica Neue",Helvetica,Arial,sans-serif;font-size:24px;font-weight:600;line-height:1}
.passo-unico .scheda p{margin:10px 24px 0;font-size:17px;line-height:1.45;max-width:none}
.passo-unico .scheda p.eta{margin-top:4px;font-size:16px;font-weight:700}
.passo-unico .scheda .pastiglie{display:flex;flex-wrap:wrap;gap:6px;margin:auto 0 0;padding:20px 24px 24px;list-style:none}
.passo-unico .scheda .pastiglie li{display:inline-flex;align-items:center;gap:6px;min-height:32px;margin:0;padding:6px 12px 6px 8px;border-radius:999px;background:var(--chiara);color:var(--inchiostro);font-size:14px;font-weight:600;line-height:1}
.pastiglie svg{display:block;flex:none;width:20px;height:20px}
.passo-unico .tessere.perche .tessera{position:relative;min-height:280px;padding:32px;justify-content:flex-start;gap:12px;font-size:20px;line-height:1.45}
.passo-unico .perche h3{font-size:clamp(36px,3.6vw,52px);line-height:.95;padding-right:56px}
.numero-perche{position:absolute;top:24px;right:28px;font-family:var(--display);font-weight:800;font-size:56px;line-height:1;opacity:.35}
.passo-unico .tessere.estratti .tessera.citazione{min-height:400px;padding:32px;gap:20px;font-size:20px;line-height:1.45;font-weight:500}
.citazione .estratto::before,.citazione .testo-intero p:first-child::before{content:"«"}
.citazione .estratto::after,.citazione .testo-intero p:last-child::after{content:"»"}
.testo-intero p+p{margin-top:12px}
.intero summary{display:inline-flex;align-items:center;min-height:48px;font-size:16px;font-weight:700;text-decoration:underline;text-underline-offset:4px;cursor:pointer;list-style:none}
.intero summary::-webkit-details-marker{display:none}
.intero[open] summary::after{content:" · chiudi";white-space:pre}
.intero summary:focus-visible{outline:3px solid currentColor;outline-offset:3px}
.citazione:has(.intero[open]) .estratto{display:none}
.recensioni{display:grid;grid-template-columns:1.2fr 1.2fr 1fr;gap:6px}
.recensioni .tessera{min-height:300px;padding:32px;gap:20px;font-size:21px;line-height:1.4;font-weight:500}
.recensioni .tessera.in-breve{font-size:18px;font-weight:400}
.in-breve h3{font-size:44px;line-height:.95}
.in-breve ul{margin:0;padding:0;list-style:none}
.in-breve li{padding:12px 0;border-top:1px solid rgba(13,42,61,.25)}
.in-breve li em{display:block;font-style:normal;font-weight:700}
.passo-unico .sezione.cta{display:grid;grid-template-columns:1fr 1fr;gap:0;padding:96px var(--margine) 0}
.passo-unico .sezione.cta.solo{grid-template-columns:1fr}
.cta-testo{display:flex;flex-direction:column;justify-content:center;gap:22px;padding:48px;background:var(--giallo);color:var(--inchiostro);border-radius:6px 0 0 6px}
.cta.solo .cta-testo{border-radius:6px}
.passo-unico .cta h2{font-size:clamp(48px,6.11vw,88px);line-height:.9;text-wrap:balance}
.cta-testo p{margin:0;font-size:20px;line-height:1.45;max-width:520px}
.cta-testo a.primario{background:var(--inchiostro);color:#fff}
.cta-testo a.secondario{border-width:3px}
.cta-foto{margin:0;min-height:440px;overflow:hidden;border-radius:0 6px 6px 0}
.cta-foto img{display:block;width:100%;height:100%;max-width:none;object-fit:cover;object-position:50% 25%;border-radius:0}
.passo-unico + .piede{margin-top:24px}
.ancore-corsi{display:flex;flex-wrap:wrap;gap:6px}
.passo-unico .sezione>.ancore-corsi{margin-top:24px}
.ancore-corsi .ancora{display:inline-flex;align-items:center;min-height:48px;padding:0 16px;border-radius:999px;background:var(--chiara);color:var(--inchiostro);font-size:16px;font-weight:600;text-decoration:none}
.gruppo-corsi{scroll-margin-top:16px}
.passo-unico .sezione>.gruppo-corsi{margin-top:48px}
.gruppo-corsi>h3{margin:0 0 20px;font-size:clamp(40px,4.4vw,64px);line-height:.9}
.gruppo-corsi>h3 span{font-family:Inter,"Helvetica Neue",Helvetica,Arial,sans-serif;font-size:clamp(16px,1.4vw,20px);font-weight:600;text-transform:none}
.gruppo-corsi .tessere.schede{grid-template-columns:repeat(3,minmax(0,1fr))}
.barra-prova{display:none}
@media (max-width:900px){
.barra-prova{display:flex;gap:8px;position:sticky;bottom:0;z-index:5;margin-top:48px;padding:12px var(--margine) calc(12px + env(safe-area-inset-bottom));background:var(--inchiostro);box-shadow:0 -6px 18px rgba(13,42,61,.22)}
.barra-prova .pulsante{min-height:56px;padding:0 16px;font-size:17px}
.barra-prova .primario{flex:3}
.barra-prova .secondario{flex:2;color:#fff;border-color:#fff}
.passo-unico .sezione>.gruppo-corsi{margin-top:32px}
.gruppo-corsi>h3{margin-bottom:12px}
.gruppo-corsi .tessere.schede{grid-template-columns:1fr}
.passo-unico .gruppo-corsi .tessere.schede .tessera.scheda:not(.foto){display:grid;grid-template-columns:80px minmax(0,1fr);align-content:center;min-height:104px}
.passo-unico .gruppo-corsi .tessere.schede .tessera.scheda:not(.foto) .scheda-foto{grid-column:1;grid-row:1 / span 3;height:auto;min-height:104px;position:relative}
.passo-unico .gruppo-corsi .tessere.schede .tessera.scheda:not(.foto) .scheda-foto img{position:absolute;inset:0}
.passo-unico .gruppo-corsi .scheda-foto.senza-foto span{font-size:48px}
.passo-unico .gruppo-corsi .tessere.schede .tessera.scheda:not(.foto) h3,.passo-unico .gruppo-corsi .tessere.schede .tessera.scheda:not(.foto) h4{grid-column:2;margin:12px 56px 0 16px;font-size:22px}
.passo-unico .gruppo-corsi .tessere.schede .tessera.scheda:not(.foto) h3::after,.passo-unico .gruppo-corsi .tessere.schede .tessera.scheda:not(.foto) h4::after{top:50%;right:12px;width:40px;height:40px;margin-top:-20px;font-size:20px}
.passo-unico .gruppo-corsi .tessere.schede .tessera.scheda:not(.foto) p.eta{grid-column:2;margin:4px 56px 0 16px;font-size:15px}
.passo-unico .gruppo-corsi .tessere.schede .tessera.scheda:not(.foto) p:not(.eta){grid-column:2;margin:2px 56px 12px 16px;font-size:15px;line-height:1.35;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden}
.passo-unico .gruppo-corsi .tessere.schede .tessera.scheda:not(.foto) .pastiglie{display:none}
.passo-unico .pagina-hero{grid-template-columns:1fr;gap:32px;padding:20px var(--margine) 0}
.passo-unico .intro h1{margin-bottom:24px}
.passo-unico .intro p{font-size:18px;margin-bottom:24px}
.pulsanti .pulsante{min-height:56px;padding:0 24px;font-size:17px}
.hero-foto{height:300px}
.passo-unico .tessere.numeri{margin-top:32px;grid-template-columns:repeat(2,minmax(0,1fr))}
.passo-unico .numeri .tessera{min-height:160px}
.motto{grid-template-columns:1fr;gap:16px;margin-top:32px}
.motto h2{font-size:44px}
.passo-unico .sezione{padding:64px var(--margine) 0}
.passo-unico .sezione h2{font-size:clamp(56px,5.56vw,80px)}
.tessere.schede{grid-template-columns:1fr;grid-auto-rows:auto}
.passo-unico .tessere.n-5 .tessera:nth-child(n){grid-column:1 / -1}
.tessere.n-9.schede .tessera.tessera.tessera.blu{background:var(--blu);color:#fff}
.tessere.n-9.schede .tessera.tessera.tessera.giallo{background:var(--giallo);color:var(--inchiostro)}
.tessere.n-9.schede .tessera.tessera.tessera.inchiostro{background:var(--inchiostro);color:#fff}
.scheda-foto.senza-foto{height:120px}
.scheda-foto.senza-foto span{font-size:64px}
.passo-unico .tessere.perche .tessera{min-height:200px;padding:24px}
.passo-unico .tessere.estratti .tessera.citazione{min-height:0;padding:24px}
.recensioni{grid-template-columns:1fr}
.recensioni .tessera{min-height:0;padding:24px;font-size:19px}
.passo-unico .sezione.cta{grid-template-columns:1fr;padding-top:64px}
.cta-testo{padding:28px 24px;border-radius:6px 6px 0 0}
.cta.solo .cta-testo{border-radius:6px}
.cta-foto{min-height:300px;border-radius:0 0 6px 6px}
.passo-unico .cta h2{font-size:clamp(48px,6.11vw,88px)}
}
`.replace(/\n/g, '')

/**
 * Le regole della pagina Contatti nuova (sitoContatti.ts): vengono dopo quelle della Home, di cui usa pulsanti, titoli di sezione,
 * passi numerati e domande (`main.passo-unico`). I recapiti riusano le misure di `.recapiti` della pagina di prima.
 */
const CSS_CONTATTI = `
.contatti-nuova h1{font-size:clamp(92px,9.72vw,140px)}
.contatti-nuova~.invito{height:auto;min-height:300px}
.recapiti-sez{padding:48px var(--margine) 0}
.recapiti-sez .recapiti{grid-auto-rows:minmax(270px,auto)}
.recapiti .tessera{position:relative}
.recapiti-sez .azione{margin-top:10px;padding-top:4px;border-top:2px solid currentColor}
.recapiti-sez .azione a{display:flex;align-items:center;min-height:48px;font-size:17px;font-weight:600;text-decoration:none}
.recapiti-sez .azione a::after{content:"";position:absolute;inset:0;border-radius:6px}
.recapiti-sez .azione a:focus-visible{outline:none}
.recapiti-sez .azione a:focus-visible::after{outline:3px solid currentColor;outline-offset:-6px}
.contatti-nuova .arrivo{display:grid;grid-template-columns:780px 1fr;gap:6px;margin-top:40px}
.contatti-nuova .arrivo>*{grid-column:auto}
.arrivare .mappa{height:500px;margin:0;padding:0;overflow:hidden;display:block}
.arrivare .mappa img{display:block;width:100%;height:100%;max-width:none;object-fit:cover;border-radius:0}
.mappa-azioni{position:absolute;left:16px;bottom:28px;display:flex;gap:8px}
.mappa-azioni .pulsante{min-height:56px;padding:0 28px;font-size:18px}
.arrivi{display:grid;grid-template-rows:repeat(3,minmax(0,1fr));gap:6px}
.sezione .arrivi .tessera.arrivo-riga:not(.foto){min-height:0}
.arrivi .arrivo-riga{display:grid;grid-template-columns:48px minmax(0,1fr);gap:8px 16px;align-content:start;padding:24px}
.arrivo-riga .sigla{grid-row:1 / span 2;display:flex;align-items:center;justify-content:center;width:48px;height:48px;border:3px solid currentColor;border-radius:6px;font-family:var(--display);font-weight:800;font-size:36px;line-height:1}
.arrivo-riga h3,.arrivo-riga p{grid-column:2}
.arrivo-riga h3{font-size:clamp(30px,2.5vw,36px);line-height:.95}
.arrivo-riga p{font-size:17px;line-height:1.45}
.foto-contatti{display:grid;gap:6px;margin:96px var(--margine) 0}
.foto-contatti.n-1{grid-template-columns:1fr}
.foto-contatti.n-2{grid-template-columns:repeat(2,minmax(0,1fr))}
.foto-contatti.n-3{grid-template-columns:repeat(3,minmax(0,1fr))}
.foto-contatti figure{margin:0;height:360px;overflow:hidden;border-radius:6px}
.foto-contatti img{display:block;width:100%;height:100%;max-width:none;object-fit:cover;object-position:50% 45%;border-radius:6px}
@media (max-width:900px){
.contatti-nuova h1{font-size:82px}
.recapiti-sez{padding-top:32px}
.recapiti-sez .recapiti{grid-auto-rows:minmax(215px,auto)}
.contatti-nuova .arrivo{grid-template-columns:1fr;margin-top:24px}
.arrivare .mappa{height:380px}
.arrivi{grid-template-rows:none}
.foto-contatti{margin-top:64px}
.foto-contatti.n-2,.foto-contatti.n-3{grid-template-columns:1fr}
.foto-contatti figure{height:220px}
}
`.replace(/\n/g, '')

const CSS = `
@font-face{font-family:"Big Shoulders Display";font-weight:800;font-display:swap;src:url(/risorse/big-shoulders-display-800.woff2) format("woff2");unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}
@font-face{font-family:"Inter";font-weight:100 900;font-display:swap;src:url(/risorse/inter-variable.woff2) format("woff2");unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}
:root{--display:"Big Shoulders Display","Arial Narrow",Arial,sans-serif;--fondo:#eef5fa;--inchiostro:#0d2a3d;--blu:#14709f;--chiara:#cfe6f4;--giallo:#f4c31b;--margine:clamp(16px,3.4vw,48px)}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0 auto;max-width:1440px;background:var(--fondo);color:var(--inchiostro);font-family:"Inter","Helvetica Neue",Helvetica,Arial,sans-serif;font-size:clamp(17px,1rem + .25vw,19px);line-height:1.55;-webkit-font-smoothing:antialiased}
a{color:inherit}
a:focus-visible,button:focus-visible{outline:3px solid var(--blu);outline-offset:3px}
.salta{position:absolute;left:-9999px;top:0}
.salta:focus{left:16px;top:16px;z-index:100;display:inline-flex;align-items:center;min-height:48px;padding:0 20px;background:var(--giallo);color:var(--inchiostro);font-weight:700;text-decoration:none}
.invito:focus-visible{outline-color:var(--inchiostro)}
.piede a:focus-visible{outline-color:var(--giallo)}
.logo{display:block;flex-shrink:0}
.logo img{display:block;width:112px;height:110px;mix-blend-mode:multiply}
.testata{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px 24px;padding:22px var(--margine)}
.pulsante,.testo a.pulsante,.colonna a.pulsante{display:inline-flex;align-items:center;justify-content:center;min-height:56px;padding:0 32px;border-radius:6px;background:var(--inchiostro);color:#fff;font-size:18px;font-weight:600;text-decoration:none}
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
.testata{padding:22px var(--margine)}
.logo img{height:110px}
.invito{margin:96px var(--margine) 6px;padding:36px 40px;min-height:300px}
.invito .frase{max-width:520px;font-size:22px}
.invito .freccia{display:none}
.invito .parola{font-size:clamp(96px,11.8vw,170px)}
.piede{margin:0 var(--margine) 48px}
.invito{gap:0}
.piede{gap:40px;padding:40px;font-size:16px;line-height:1.9}
.piede .colonne{display:contents}
.piede .nome{max-width:5.5em}
.piede .recapiti li:nth-child(n+3){display:inline}
.piede .recapiti li:nth-child(4)::before{content:" · ";white-space:pre}
.piede h2{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.pannello>*:not(:has(.tondi)){justify-content:space-between}
.pannello .tessera:has(.tondi){display:grid;grid-template-columns:1fr auto;align-items:center;gap:0 40px}
.pannello .tessera:has(.tondi)>*{grid-column:1}
.pannello .tessera:has(.tondi)>h3{grid-column:1 / -1}
.pannello .tessera:has(.tondi)>.tondi{grid-column:2;grid-row:2 / span 3}
.pannello .tessera:has(.tondi) p{margin:20px 0 28px}
.pannello .tessera:has(.tondi) p:last-child{margin:0}
.tondi{display:flex;gap:10px}
.tondi img{flex:none;width:132px;height:132px;max-width:none;border-radius:50%;object-fit:cover}
.colonna:has(+.tessere){max-width:900px}
.colonna:has(+.tessere) p{font-size:clamp(19px,1.67vw,24px);line-height:1.4}
.colonna:has(+.tessere)+.tessere>*{padding:26px 30px;font-size:clamp(17px,1.32vw,19px)}
.sezione{padding:0 var(--margine) 96px}
.sezione h2{font-family:var(--display);text-transform:uppercase;margin:0 0 28px;font-size:clamp(48px,9vw,120px);letter-spacing:-.01em;line-height:.85;overflow-wrap:anywhere}
.testo + .sezione{padding-top:24px}
.colonna{max-width:calc(62ch + var(--margine) * 2);padding-bottom:24px}
/* Dentro .testo o .sezione, che il margine laterale ce l'hanno già: qui non si raddoppia. */
.colonne{display:grid;gap:24px;padding:0 0 24px}
.colonne.c-2{grid-template-columns:repeat(2,minmax(0,1fr))}
.colonne.c-3{grid-template-columns:repeat(3,minmax(0,1fr))}
.colonne>.colonna{min-width:0;max-width:none;padding:0}
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
.citazioni{display:flex;gap:6px;margin:0 0 6px;overflow-x:auto;scroll-snap-type:x mandatory}
.citazioni{scroll-marker-group:after}
.citazioni::scroll-marker-group{display:flex;gap:8px;margin-top:14px;padding-right:var(--margine)}
.citazioni .tessera::scroll-marker{content:"";width:14px;height:14px;border-radius:7px;background:var(--blu)}
.citazioni .tessera::scroll-marker:target-current{width:40px;background:var(--inchiostro)}
.citazioni:focus-visible{outline:3px solid var(--blu);outline-offset:3px}
.citazioni .tessera{flex:0 0 min(560px,85%);scroll-snap-align:start}
.foto{position:relative;padding:0;overflow:hidden}
.foto img{width:100%;aspect-ratio:3/2;object-fit:cover;border-radius:0}
.foto-citazioni{display:grid;grid-template-columns:minmax(0,640px) minmax(0,1fr);gap:6px;height:clamp(400px,39vw,560px);margin:0 0 6px}
.foto-citazioni .foto{grid-column:auto}
.foto-citazioni .foto img{height:100%;aspect-ratio:auto;object-fit:cover}
.foto-citazioni .citazioni{height:100%;margin:0}
.foto-citazioni .citazione{padding:clamp(24px,2.8vw,40px)}
.pillole{display:flex;flex-wrap:wrap;gap:6px;margin-top:auto;padding-top:12px}
.corso-foto{display:none}
.pillola{display:inline-flex;align-items:center;gap:6px;padding:6px 12px 6px 8px;border-radius:999px;background:var(--chiara);color:var(--inchiostro);font-family:"Inter","Helvetica Neue",Helvetica,Arial,sans-serif;font-size:14px;font-weight:600;line-height:1}
.pillola svg{display:block;flex:none;width:20px;height:20px}
.tessera.chiara .pillola{background:var(--blu);color:#fff}
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
.ritratti{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}
.ritratti article{grid-column:auto}
.ritratti-sezione .ritratti article.ritratto{position:relative;display:flex;flex-direction:column;justify-content:flex-start;gap:14px;min-height:484px;padding:0 0 24px;overflow:hidden}
.ritratto-foto{display:flex;align-items:center;justify-content:center;flex:none;width:100%;height:300px;overflow:hidden;background:var(--chiara);color:var(--inchiostro);font-family:var(--display);font-weight:800;font-size:140px;line-height:1;text-transform:uppercase}
.ritratto-foto img{width:100%;height:100%;object-fit:cover;object-position:50% 30%;border-radius:0}
.ritratto-testo{display:flex;flex-direction:column;gap:14px;min-width:0;padding:0 24px}
.ritratti h3{margin:0;font:inherit}
.ritratto .nome{display:block;font-family:var(--display);text-transform:uppercase;font-weight:800;font-size:48px;line-height:.95}
.ritratto .cognome{display:block;margin-top:4px;font-size:20px;font-weight:600;line-height:1.3}
.ritratto .pillole{display:flex;flex-wrap:wrap;gap:6px}
.ritratto .pillola{min-height:32px;padding:6px 12px}
.ritratto h3 a{color:inherit;text-decoration:none}
.ritratto h3 a::after{content:"";position:absolute;inset:0}
.ritratto:has(h3 a)::after{content:"↗\uFE0E" / "";position:absolute;top:12px;right:12px;width:48px;height:48px;border-radius:50%;background:#fff;color:var(--inchiostro);display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:600;line-height:1}
.ritratto h3 a:focus-visible{outline:none}
.ritratto:has(a:focus-visible){outline:3px solid var(--inchiostro);outline-offset:3px}
.ritratti .ritratto-invito{display:flex;flex-direction:column;justify-content:center;gap:24px;padding:40px 48px;background:var(--inchiostro);color:#fff}
.ritratto-invito.s2{grid-column:span 2}
.ritratto-invito.s3{grid-column:span 3}
.ritratto-invito .parola{margin:0;font-family:var(--display);text-transform:uppercase;font-weight:800;font-size:96px;line-height:.9}
.ritratto-invito .frase{margin:0;max-width:560px;font-size:20px;line-height:1.5}
.azioni{display:flex;flex-wrap:wrap;gap:12px}
.azioni .pulsante{min-height:60px;padding:0 28px}
.ritratto-invito .pulsante{text-decoration:none}
.ritratto-invito .pulsante.primario{background:var(--giallo);color:var(--inchiostro)}
.ritratto-invito .pulsante.secondario{background:#fff;border-color:#fff;color:var(--inchiostro)}
.interna.elenco-tecnici h1{font-size:156px}
.scheda-scarna .scheda-persona{padding:12px var(--margine) 0}
.indietro{display:inline-flex;align-items:center;min-height:48px;color:inherit;font-size:17px;font-weight:600;text-decoration:none}
.scheda-testata{display:grid;grid-template-columns:600px 1fr;gap:48px;align-items:stretch;margin-top:12px}
.scheda-ritratto{height:520px;overflow:hidden;border-radius:6px}
.scheda-ritratto img{display:block;width:100%;height:100%;object-fit:cover;object-position:50% 30%}
.scheda-ritratto.senza-foto{display:flex;align-items:center;justify-content:center;background:var(--chiara);color:var(--inchiostro);font-family:var(--display);font-weight:800;font-size:260px;line-height:1;text-transform:uppercase}
.scheda-nome{display:flex;flex-direction:column;justify-content:flex-end;gap:24px}
.scheda-nome h1{margin:0;font-family:var(--display);text-transform:uppercase;font-weight:800;font-size:140px;line-height:.86;letter-spacing:-.01em}
.scheda-nome h1 span{display:block}
.scheda-nome .pulsante.primario{background:var(--giallo);color:var(--inchiostro)}
.scheda-nome .pulsante.secondario{background:var(--inchiostro);color:#fff}
.dati-persona{margin-top:48px;grid-template-columns:repeat(4,1fr)}
.ritratti-sezione:last-child{padding-bottom:0}
.ritratti-sezione + .testo{padding:0 var(--margine);max-width:calc(900px + var(--margine) * 2);font-size:24px;line-height:1.4}
.non-trovata{padding:40px var(--margine) 96px}
.non-trovata p{max-width:34em}
.pagina-contatti h1{font-size:clamp(56px,13.9vw,200px);line-height:.82}
.testata{padding:22px var(--margine)}
.logo img{height:110px}
.piede{margin:0 var(--margine) 48px}
.piede .nome{font-size:clamp(44px,3.9vw,56px)}
.piede{gap:40px;padding:40px;font-size:16px;line-height:1.9}
.invito{margin:96px var(--margine) 6px;height:300px;min-height:0;padding:36px 40px}
.invito .frase{max-width:520px;font-size:22px;line-height:1.35}
.invito .freccia{display:none}
.invito .parola{font-size:170px;line-height:.8}
.piede-menu a{display:block}
.recapiti-piede li:nth-child(n+3){display:inline}
.recapiti-piede li:last-child::before{content:" · "}
.mappa{position:relative}
.mappa .segnaposto{position:absolute;left:calc(50% - 22px);top:calc(50% - 22px);width:44px;height:44px;border-radius:50%;background:var(--giallo);border:6px solid var(--inchiostro)}
.mappa .targhetta{position:absolute;left:calc(50% + 34px);top:calc(50% - 52px);padding:12px 16px;border-radius:6px;background:var(--inchiostro);color:#fff;font-family:var(--display);text-transform:uppercase;font-weight:800;font-size:30px;line-height:.95}
.mappa .targhetta span{display:block;margin-top:6px;font-family:"Inter","Helvetica Neue",Helvetica,Arial,sans-serif;text-transform:none;font-weight:500;font-size:16px;line-height:1.55}
.mappa .credito{position:absolute;right:0;bottom:0;padding:3px 8px;background:#fff;color:var(--inchiostro);font-size:12px;line-height:1.55}
.apertura>.tessere+.colonna{display:flex;gap:6px}
.apertura>.tessere+.colonna>*{margin:0}
.apertura>.tessere+.colonna p+p{display:inline-flex;align-items:center;min-height:56px;padding:0 20px;border-radius:6px;background:#fff;font-size:16px;font-weight:500}
.apertura .foto-fila img{object-position:50% 55%}
.apertura .foto-fila figure:nth-child(3) img{object-position:50% 30%}
.sezione.apertura{padding-bottom:96px}
.apertura>.tessere+*{margin-top:96px}
.recapiti{grid-template-columns:repeat(12,1fr);grid-auto-rows:minmax(300px,auto)}
.recapiti .tessera{gap:0;padding:24px 26px}
.recapiti h3{margin-bottom:auto;font-size:56px;line-height:.95}
.recapiti p:first-of-type{font-family:var(--display);text-transform:uppercase;font-weight:800;font-size:36px;line-height:1}
.recapiti .breve p:first-of-type{font-size:44px}
.recapiti p:not(:first-of-type){margin-top:12px;font-size:17px;line-height:1.45}
.apertura figure.larga img{height:520px}
.apertura>.tessere+.colonna{position:relative;max-width:none;margin-top:-80px;padding:0 24px 24px}
.apertura .colonna a.pulsante{background:var(--giallo);color:var(--inchiostro);padding:0 28px}
.apertura>.foto-fila{margin-top:96px}
.apertura .foto-fila img{height:536px}
.pagina-contatti .sezione:not(.apertura) h2{line-height:.85}
.pagina-contatti .sezione:not(.apertura) .colonna{padding-bottom:22px;font-size:22px}
.pagina-contatti .sezione:not(.apertura) .tessera{justify-content:space-between;padding:26px 28px}
.pagina-contatti .sezione:not(.apertura) .tessera h3{font-size:38px;line-height:.95}
.pagina-contatti .sezione:not(.apertura) .tessere{grid-auto-rows:minmax(330px,auto)}
.pagina-contatti .sezione:not(.apertura) .tessera:nth-child(odd){background:var(--giallo);color:var(--inchiostro)}
.slogan.giallo{grid-column:auto;background:var(--giallo);color:var(--inchiostro);justify-content:flex-end;font-family:var(--display);text-transform:uppercase;font-weight:800;font-size:clamp(40px,5.3vw,76px);line-height:.9;padding:clamp(20px,2.5vw,36px)}
.foto-citazioni.slogan{margin:0;grid-template-columns:minmax(0,1fr) minmax(0,clamp(300px,32vw,460px));height:clamp(300px,41.7vw,600px)}
.ampie>*,.pannello>*{padding:clamp(20px,2.2vw,32px);justify-content:space-between;gap:12px;font-size:clamp(17px,1.46vw,21px);line-height:1.45}
.ampie h3{font-size:clamp(44px,4.45vw,64px);line-height:.95}
.pannello>*{padding:clamp(22px,3.3vw,48px);min-height:0;gap:20px;justify-content:flex-start}
.pannello h3{font-size:clamp(66px,8.3vw,130px);line-height:.9}
.pannello p{max-width:820px;font-size:clamp(17px,1.7vw,24px);line-height:1.4}
.numeri{grid-template-columns:none;grid-auto-flow:column;grid-auto-columns:1fr}
.numeri.numeri.numeri.numeri>*{grid-column:auto}
.numeri>*{padding:clamp(16px,1.7vw,24px) clamp(16px,1.9vw,28px);gap:12px;justify-content:space-between}
.numeri .cifra{font-size:clamp(70px,10.4vw,150px)}
.numeri .scritta{font-size:clamp(16px,1.4vw,20px);line-height:1.45}
/* Pagina di persona (un istruttore): persona() in sitoLayout.ts, misure di TatamiBlu-Istruttore.dc.html a 1440px. Le altezze stanno su «article» e le griglie hanno la classe fila-N: sono misure del design solo di questa pagina, non delle tessere di tutto il sito. */
.persona-hero{padding:40px var(--margine) 72px;flex-wrap:nowrap;align-items:flex-end}
.persona-hero h1{flex:1;min-width:0;font-size:clamp(56px,10.5vw,150px);line-height:.82}
.persona-hero .lato{flex:0 0 520px;display:flex;flex-direction:column;align-items:flex-start}
.persona-hero .lato p{margin:0 0 28px;font-size:22px;line-height:1.45}
.persona .tessera{justify-content:space-between;gap:0;line-height:1.45}
.persona .tessera li+li{margin-top:0}
.persona article>img{width:110px;aspect-ratio:1;border-radius:50%;object-fit:cover}
.persona .apertura .tessere .tessera{padding:30px;font-size:19px}
.persona .apertura .tessere h3{font-size:64px}
.persona .apertura .fila-3>article{min-height:400px}
.persona .fila-4{grid-template-columns:repeat(4,1fr)}
.persona .tessere.fila-4>article{grid-column:auto}
.persona .apertura .fila-4 .tessera{padding:24px 26px;font-size:18px}
.persona .apertura .fila-4 h3{font-size:52px}
.persona .apertura .fila-4>article{min-height:220px}
.persona .apertura>.tessere+.tessere{margin-top:96px}
.persona .sezione:not(.apertura) .tessera{padding:28px;font-size:16px}
.persona .sezione:not(.apertura) h3{font-size:48px}
.persona .sezione:not(.apertura) .tessere>article{min-height:520px}
.persona .sezione:not(.apertura) .tessere>article:has(>img){min-height:250px}
.persona .sezione:not(.apertura) .tessera:has(>img){padding:22px 24px}
.persona .sezione:not(.apertura) .tessera:has(>img) h3{font-size:38px}
.persona .ritratto{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,560px);gap:6px;height:clamp(440px,44vw,620px)}
.persona .ritratto .foto{position:relative;grid-column:auto}
.persona .ritratto .foto img{width:100%;height:100%;object-fit:cover;object-position:50% 34%;border-radius:0}
.persona .ritratto figcaption{position:absolute;left:0;bottom:0;padding:18px 26px;background:var(--inchiostro);color:#fff;font-family:var(--display);text-transform:uppercase;font-weight:800;font-size:44px;line-height:.9}
.persona .ritratto .citazione{grid-column:auto;padding:36px;font-size:30px;line-height:1.25}
.persona .ritratto .firma{font-size:44px;line-height:.95}
.persona .ritratto .avatar{display:none}
.solo-lettori{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.persona .sezione h2{line-height:.85}
.persona .sezione:last-child{padding-bottom:0}
.persona .sezione:has(+ .solo){padding-bottom:6px}
.persona .sezione.solo:not(.apertura) .tessera{padding:28px;font-size:18px}
.persona .sezione.solo:not(.apertura) .tessere>article{min-height:160px}
.persona .sezione.solo h2{margin:0;font-size:44px;line-height:.95}
.persona .tessera ul{list-style:none;padding:0}
.persona .tessera li::before{content:"• "}
${TINTE_PERSONA}
.persona .ritratto figcaption{border-top-right-radius:6px}
.persona .ritratto figcaption span{display:block}
.persona .ritratto figcaption .ruolo{margin-top:6px;font-family:"Inter","Helvetica Neue",Helvetica,Arial,sans-serif;text-transform:none;font-weight:400;font-size:16px;line-height:1.45}
@media (min-width:901px){
.pagina-contatti .interna h1{white-space:nowrap}
.fascia.fascia .ampie>*:not(.foto){min-height:clamp(280px,27.8vw,400px)}
.fascia.fascia .numeri>*:not(.foto){min-height:clamp(150px,17.4vw,250px)}
.sezione .tessera:not(.foto){min-height:clamp(190px,16vw,260px)}
.sezione .tessere.n-4 .tessera:not(.foto){min-height:190px}
.sezione .tessera.chiara:not(.foto){min-height:260px}
.sezione .tessera.tessera:not(.foto):has(h3 a){min-height:340px}
.pagina-hero>.collage{align-self:start}
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
.corso-foto{display:block;height:150px;overflow:hidden;border-radius:6px}
.corso-foto img{width:100%;height:100%;object-fit:cover;border-radius:0}
.tessere{grid-template-columns:1fr}
.tessere .tessera{grid-column:auto}
.pagina-hero{flex-direction:column;align-items:stretch}
.pagina-hero .intro,.pagina-hero>.collage,.pagina-hero>.tessere{flex:none;max-width:none}
.pagina-hero .tessere,.collage{grid-template-columns:repeat(2,1fr);grid-auto-rows:auto}
.pagina-hero .tessere.tessere .tessera.tessera,.collage .numero{grid-column:auto}
.pagina-hero .tessere.tessere .numero.ultima,.collage .numero.ultima{grid-column:span 2}
.collage .foto.grande,.collage .foto.larga,.collage .foto.meta,.collage .foto.meta:nth-last-child(2),.collage .foto.meta:last-child{grid-column:1 / span 2;grid-row:auto;order:2}
.collage .foto.grande img{aspect-ratio:3/2;height:auto;flex:none}
.foto-citazioni{grid-template-columns:1fr;height:auto}
.foto-citazioni .foto img{height:auto;aspect-ratio:3/2}
.foto-citazioni .citazioni{height:auto}
.foto-fila,.foto-fila.quattro{grid-template-columns:repeat(2,1fr)}
.foto-fila.quattro img{aspect-ratio:3/4}
.testata{padding:12px var(--margine) 0;gap:10px 16px}
.logo img{width:84px;height:82px}
h1{font-size:84px;line-height:.84}
.pagina-hero{padding:20px var(--margine) 0;gap:36px 0}
.intro h1{margin-bottom:20px}
.intro p{font-size:18px;margin-bottom:22px}
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
.tessera:has(h3 a) h3::after{content:"↗\uFE0E";font-size:36px;line-height:1}
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
.invito{margin:48px var(--margine) 6px;min-height:260px;padding:22px;gap:20px}
.invito .frase{font-size:17px;line-height:1.35}
.invito .parola{font-size:120px}
.piede{margin:0 var(--margine) 24px;padding:24px;gap:14px}
.piede .nome{font-size:44px}
.pannello .tessera:has(.tondi){display:flex;align-items:flex-start}
.pannello .tessera:has(.tondi) p{margin:14px 0 0}
.tondi{gap:8px;margin:18px 0}
.tondi img{width:64px;height:64px}
.colonna:has(+.tessere)+.tessere>*{padding:20px;font-size:16px;min-height:150px}
.colonna:has(+.tessere)+.tessere h3{font-size:36px}
.foto-citazioni.slogan{height:auto;grid-template-columns:1fr}
.foto-citazioni.slogan .foto img{height:300px;aspect-ratio:auto}
.slogan.giallo{min-height:200px}
.fascia{padding-bottom:48px}
.slogan.giallo{font-size:min(11.8vw,60px)}
.fascia .foto-fila.quattro img{aspect-ratio:auto;height:200px}
.numeri{grid-auto-flow:row;grid-template-columns:repeat(2,1fr)}
.numeri>*{min-height:150px}
.persona-hero{gap:20px;padding:20px var(--margine) 36px}
.persona-hero h1{font-size:70px;line-height:.84}
.persona-hero .lato{flex:none}
.persona-hero .lato p{margin-bottom:22px;font-size:18px}
.persona .ritratto{grid-template-columns:1fr;height:auto}
.persona .ritratto .foto{height:320px}
.persona .ritratto figcaption{display:none}
.persona .ritratto .citazione{min-height:200px;padding:22px;font-size:20px}
.persona .ritratto .firma{font-size:34px}
.persona .fila-4{grid-template-columns:repeat(2,1fr)}
.persona .apertura .tessere .tessera{padding:20px;font-size:16px}
.persona .apertura .tessere h3{font-size:40px}
.persona .apertura .fila-3>article{min-height:220px}
.persona .apertura .fila-4 .tessera{padding:16px;font-size:15px}
.persona .apertura .fila-4 h3{font-size:34px}
.persona .apertura .fila-4>article{min-height:190px}
.persona .apertura>.tessere+.tessere{margin-top:40px}
.persona .sezione:not(.apertura) .tessera{padding:20px;font-size:15px}
.persona .sezione:not(.apertura) h3{font-size:36px}
.persona .sezione:not(.apertura) .tessere>article{min-height:320px}
.persona .tessera{gap:12px}
.persona .sezione{padding-bottom:48px}
.persona .sezione.solo:not(.apertura) .tessera{padding:20px;font-size:15px}
.persona .sezione.solo:not(.apertura) .tessere>article{min-height:200px}
.persona .sezione.solo h2{margin:0;font-size:34px}
.persona .apertura .fila-3>article:nth-child(1){min-height:260px}
.persona .apertura .fila-3>article:nth-child(2){min-height:240px}
.persona .apertura .fila-3>article:nth-child(3){min-height:220px}
.persona .sezione:not(.apertura) .fila-3>article:nth-child(1){min-height:420px}
.persona .sezione:not(.apertura) .fila-3>article:nth-child(2){min-height:320px}
.persona .sezione:not(.apertura) .fila-3>article:nth-child(3){min-height:340px}
.ritratti-sezione + .testo{display:none}
.ritratti-sezione{padding-bottom:0}
.ritratti{grid-template-columns:1fr}
.ritratti-sezione .ritratti article.ritratto{flex-direction:row;gap:0;min-height:136px;padding:0}
.ritratto-foto{width:112px;height:auto;align-self:stretch;font-size:64px}
.ritratto-testo{gap:6px;padding:14px 14px 12px 16px}
.ritratto .nome{font-size:34px}
.ritratto .cognome{font-size:16px}
.ritratto:has(h3 a)::after{display:none}
.ritratti .ritratto-invito{grid-column:auto;padding:24px}
.ritratto-invito .parola{font-size:56px}
.interna.elenco-tecnici h1{font-size:84px}
.scheda-scarna .scheda-persona{padding-top:0}
.scheda-testata{grid-template-columns:1fr;gap:16px}
.scheda-ritratto{height:320px}
.scheda-ritratto.senza-foto{font-size:140px}
.scheda-nome h1{font-size:84px}
.dati-persona{margin-top:24px;grid-template-columns:1fr}
.scheda-nome .azioni,.ritratto-invito .azioni{flex-direction:column}
.scheda-nome .pulsante,.ritratto-invito .pulsante{width:100%}
.ritratti-sezione + .testo{font-size:17px}

}
@media (max-width:900px){
.testata{padding:12px var(--margine) 0}
.logo img{height:82px}
.piede{display:block;margin-bottom:24px;padding:24px}
.piede .nome{margin-bottom:14px}
.piede-menu,.piede-legale{margin-top:12px}
.piede-menu a{display:inline}
.piede-menu a+a::before{content:" · "}
.piede-legale{opacity:.85}
.invito{margin:48px var(--margine) 6px;height:auto;min-height:260px;padding:22px}
.invito .frase{font-size:17px}
.invito .parola{font-size:120px}
.piede-legale li{display:inline}
.piede-legale li+li::before{content:" · "}
.recapiti p:not(:first-of-type){display:none}
.apertura>.tessere+.colonna p+p{display:none}
.mappa .segnaposto{left:calc(50% - 20px);top:calc(50% - 20px);width:40px;height:40px}
.mappa .targhetta{left:16px;top:78px;padding:10px 14px;font-size:26px}
.mappa .targhetta span{margin-top:4px;font-size:14px}
.mappa .credito{padding:2px 6px;font-size:11px}
.pagina-contatti h1{font-size:19.5vw}
.sezione.apertura{padding-bottom:48px}
.apertura>.tessere+*,.apertura>.foto-fila{margin-top:48px}
.recapiti{grid-template-columns:1fr;grid-auto-rows:minmax(130px,auto)}
.tessere.n-4.recapiti>*{grid-column:1}
.recapiti .tessera{gap:12px;padding:20px}
.recapiti h3{font-size:38px}
.recapiti p:first-of-type,.recapiti .breve p:first-of-type{font-size:32px}
.apertura figure.larga img{height:380px}
.apertura>.tessere+.colonna{padding:0 12px 28px}
.apertura .colonna a.pulsante{min-height:52px;padding:0 26px;font-size:17px}
.apertura .foto-fila img{height:200px}
.apertura .foto-fila figure:nth-child(3){display:none}
.pagina-contatti .sezione:not(.apertura) h2{font-size:56px;line-height:.88}
.pagina-contatti .sezione:not(.apertura) .colonna{display:none}
.pagina-contatti .sezione:not(.apertura) h2{margin-bottom:20px}
.pagina-contatti .sezione:not(.apertura) .tessera{gap:12px;padding:20px}
.pagina-contatti .sezione:not(.apertura) .tessera h3{font-size:30px}
.pagina-contatti .sezione:not(.apertura) .tessere{grid-auto-rows:minmax(160px,auto)}
}
${CSS_CORSI}
${CSS_INTERNE}
${CSS_TESTATA}
${cssFoci()}
.interna h1.medio{font-size:clamp(56px,12.2vw,175px)}
.interna h1.lungo{font-size:clamp(56px,9.2vw,132px)}
.interna h1.lunghissimo{font-size:clamp(44px,8.7vw,125px)}
@media (max-width:900px){.interna h1.medio{font-size:76px}}
@media (max-width:720px){.colonne.c-2,.colonne.c-3{grid-template-columns:minmax(0,1fr)}}
@media (prefers-reduced-motion:no-preference){.pulsante,.testata nav a{transition:background-color .15s}}
`.replace(/\n/g, '')

/**
 * Le regole della pagina di un corso, in un `<style>` a parte che solo quelle pagine hanno (docs/sito/corso.md):
 * tutto dentro `main.corso` e `.corso-testata`, così le altre pagine non cambiano e non lo portano.
 */
const CSS_CORSO = `
/* Testata, invito e piede come nel design: solo nelle pagine di un corso (body.pagina-corso). */
.pagina-corso .testata{padding:22px var(--margine)}
.pagina-corso .logo img{height:110px}
.pagina-corso .invito{min-height:300px;padding:36px 40px;margin:96px var(--margine) 6px}
.pagina-corso .invito .frase{max-width:520px;font-size:22px}
.pagina-corso .invito .parola{font-size:clamp(96px,11.8vw,170px)}
.pagina-corso .invito .freccia{display:none}
.pagina-corso .piede{margin:0 var(--margine) 48px;padding:40px;gap:40px}
.pagina-corso .piede .nome{max-width:5em;font-size:clamp(40px,3.89vw,56px)}
.pagina-corso .piede .colonne{display:contents}
.pagina-corso .piede .recapiti li:nth-last-child(-n+2){display:inline}
.pagina-corso .piede .recapiti li:last-child::before{content:" · "}
/* La pagina di un corso (docs/sito/corso.md): tutto dentro main.corso, le altre pagine non cambiano. */
.corso-testata{padding:0 var(--margine) 96px}
.corso-testata>*+*{margin-top:6px}
.corso .tessere .tessera.orario{display:grid;grid-template-columns:1fr auto;grid-template-rows:auto 1fr;align-items:start;gap:0 12px}
.corso .orario .ora{font-family:var(--display);text-transform:uppercase;font-weight:800;line-height:1}
.corso .orario .dettagli{grid-column:1 / -1;align-self:end}
.corso .banda-int p{margin:0}
@media (min-width:901px){
.corso .tessere .tessera.orario{grid-column:auto;min-height:170px;font-size:17px}
.corso .orario .ora{font-size:clamp(26px,2.8vw,40px)}
.corso .orario .dettagli{display:flex;justify-content:space-between;gap:12px}
.corso .corso-testata .foto img{height:clamp(300px,43vw,620px);aspect-ratio:auto;object-fit:cover;object-position:50% 58%}
.corso .tessere .tessera.tessera:not(.foto){padding:24px 26px;justify-content:space-between;gap:12px;line-height:1.45}
.corso .tessere.dati{grid-template-columns:repeat(4,1fr)}
.corso .tessere.dati .tessera.tessera{grid-column:span 1;min-height:190px;font-size:18px}
.corso .corso-testata .tessere.n-3 .tessera{min-height:330px;font-size:19px}
.corso .dati h3,.corso .corso-testata .n-3 h3{font-size:clamp(28px,3.61vw,52px)}
.corso .sezione h2{line-height:.85}
.corso .sezione .tessera:not(.foto):not(.orario){min-height:300px;padding:28px 30px;font-size:20px}
.corso .sezione .tessera:not(.orario) h3{font-size:clamp(34px,4.45vw,64px)}
.corso .sezione .tessera:not(.foto):not(.orario):has(>h3:only-child){min-height:190px;padding:26px 30px;justify-content:flex-start}
.corso .sezione .tessera:has(>h3:only-child) h3{font-size:clamp(30px,3.75vw,54px)}
.corso .foto-fila img{height:clamp(240px,35.8vw,516px);aspect-ratio:auto;object-position:50% 55%}
.corso .foto-fila figure:first-child img{object-position:50% 30%}
.corso .sezione h2.lungo{margin-bottom:22px}
.corso .tessere:has(.orario){grid-template-columns:repeat(2,1fr)}
.corso .orario h3{font-size:clamp(28px,3.2vw,46px)}
.corso .banda-int{display:flex;justify-content:space-between;align-items:flex-end;gap:48px;padding:48px;border-radius:6px;background:var(--blu);color:#fff}
.corso .banda-int h2{max-width:560px;margin:0;font-size:clamp(56px,8.33vw,120px)}
.corso .banda-int p{max-width:640px;font-size:clamp(20px,2.22vw,32px);line-height:1.25;font-weight:500}
}
@media (max-width:900px){
.pagina-corso .testata{gap:0 16px;padding:12px var(--margine) 0}
.pagina-corso .logo img{height:82px}
.pagina-corso .invito{min-height:260px;padding:22px;margin:48px var(--margine) 6px;gap:20px}
.pagina-corso .invito .frase{max-width:none;font-size:17px}
.pagina-corso .invito .parola{font-size:clamp(80px,32vw,120px)}
.pagina-corso .piede{display:flex;flex-direction:column;gap:12px;margin:0 var(--margine) 24px;padding:24px}
.pagina-corso .piede .nome{font-size:44px;margin-bottom:2px}
.pagina-corso .piede .menu li,.pagina-corso .piede .legali li{display:inline}
.pagina-corso .piede .menu li+li::before,.pagina-corso .piede .legali li+li::before{content:" · "}
.pagina-corso .piede .legali{opacity:.85}
}
@media (max-width:900px){
.corso .corso-testata .foto img{height:360px;aspect-ratio:auto;object-fit:cover}
.corso-testata{padding-bottom:48px}
.corso .tessere .tessera.tessera:not(.foto){grid-column:auto;padding:20px;justify-content:space-between;gap:12px;font-size:16px;line-height:1.45}
.corso .tessere.dati{grid-template-columns:repeat(2,1fr)}
.corso .tessere.dati .tessera.tessera{min-height:190px;padding:16px;font-size:15px}
.corso .dati h3{font-size:34px}
.corso .corso-testata .n-3{margin-top:40px}
.corso .corso-testata .n-3 .tessera{min-height:220px}
.corso .corso-testata .n-3 .tessera:last-child{min-height:180px}
.corso .corso-testata .n-3 h3{font-size:40px}
.corso .sezione{padding-bottom:48px}
.corso .sezione h2{font-size:56px;line-height:.88;margin-bottom:20px}
.corso .sezione h2.lungo{font-size:48px;margin-bottom:20px}
.corso .sezione .tessera:not(.foto):not(.orario){min-height:190px}
.corso .sezione .tessera:not(.orario) h3{font-size:38px}
.corso .sezione .tessera:not(.foto):not(.orario):has(>h3:only-child){min-height:110px;padding:18px}
.corso .sezione .tessera:has(>h3:only-child) h3{font-size:36px}
.corso .foto-fila img{height:180px;aspect-ratio:auto}
.corso .foto-fila:not(.due):not(.quattro) figure:first-child{grid-column:1 / -1}
.corso .foto-fila:not(.due):not(.quattro) figure:first-child img{height:260px}
.corso .tessere:has(.orario){grid-template-columns:1fr}
.corso .tessere .tessera.orario{min-height:140px;padding:20px;font-size:15px}
.corso .orario h3{font-size:min(34px,8.4vw)}
.corso .orario .ora{white-space:nowrap}
.corso .orario .ora{font-size:30px}
.corso .orario .dettagli{display:block}
.corso .orario .dettagli p{display:inline}
.corso .orario .dettagli p+p::before{content:" · "}
.corso .banda-int{display:flex;flex-direction:column;justify-content:space-between;gap:12px;min-height:240px;padding:22px;border-radius:6px;background:var(--blu);color:#fff}
.corso .banda-int h2{margin:0;font-size:56px;line-height:.95}
.corso .banda-int p{font-size:20px;line-height:1.45}
}
`.replace(/\n/g, '')

interface Contesto {
  d: DatiSito
  slugs: Set<string>
  /** Gli slug dei corsi: le pagine a cui rimanda la pagina «corsi». */
  corsi: Set<string>
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

/** «Contattaci» sta accanto a «Prova», non nel menu: così sul telefono il menu entra in una riga. Nel piede resta tra le pagine. */
function testata(c: Contesto, conContatti: boolean, corrente = ''): string {
  const menu = lista(voci('menu', c).filter((v) => !conContatti || v.href !== TESTI.contatti), corrente)
  const segnata = corrente === TESTI.contatti ? ' aria-current="page"' : ''
  const logo = `<a class="logo" href="/" aria-label="${esc(NOME)}, pagina iniziale">${MARCHIO}</a>`
  // La testata nuova: due pulsanti interi a destra; sul telefono un tasto MENU che apre il menu con `:target`, senza script.
  const prova = `<a class="pulsante primario" href="${TESTI.iscrizione}" rel="noopener noreferrer">${TESTI.provaIntera}</a>`
  const scrivici = `<a class="pulsante secondario" href="${TESTI.contatti}"${segnata}>${TESTI.scrivici}</a>`
  const dentro = `<a class="chiudi" href="#">Chiudi</a>${menu ? `<ul>${menu}</ul>` : ''}${prova.replace('class="pulsante primario"', 'class="pulsante primario nel-menu"')}${conContatti ? `<a class="pulsante secondario nel-menu" href="${TESTI.contatti}">${TESTI.scrivici}</a>` : ''}`
  return `<header class="testata">${logo}<a class="tasto-menu" href="#menu">MENU</a><nav id="menu" aria-label="Principale">${dentro}</nav><div class="azioni">${prova}${conContatti ? scrivici : ''}</div></header>`
}

function piede(c: Contesto): string {
  const f = lista(voci('footer', c))
  const m = voci('menu', c)
  const recapiti = `<li>${esc(CONTATTI.indirizzo)}<span class="metro"> ${TESTI.metro}</span></li><li><a href="${esc(chiama)}">${esc(CONTATTI.telefono)}</a></li><li><a href="${esc(CONTATTI.instagram)}" rel="noopener noreferrer">Instagram</a></li><li><a href="${esc(CONTATTI.facebook)}" rel="noopener noreferrer">Facebook</a></li>`
  // Come nel design: il nome, poi tre colonne senza titolo (recapiti, pagine, legge).
  return `<footer class="piede"><p class="nome">Officine<br>dello Sport</p><ul class="recapiti-piede">${recapiti}</ul>${m.length ? `<nav class="piede-menu" aria-label="Pagine">${m.map((x) => `<a href="${esc(x.href)}"${rel(x.href)}>${esc(x.etichetta)}</a>`).join('')}</nav>` : ''}${f ? `<ul class="piede-legale">${f}</ul>` : ''}</footer>`
}

/** La barra del telefono in fondo alla Home: «Prova a 5 €» verso il modulo e «Chiama». Il nome accessibile dice «una settimana»: sulla pagina ci sono altri pulsanti di prova. */
function barraProva(): string {
  return `<nav class="barra-prova" aria-label="Prova o chiama"><a class="pulsante primario" href="${TESTI.iscrizione}" rel="noopener noreferrer" aria-label="Prova una settimana a 5 euro">Prova a 5 €</a><a class="pulsante secondario" href="${esc(chiama)}">Chiama</a></nav>`
}

function invito(conContatti: boolean): string {
  if (!conContatti) return ''
  return `<a class="invito" href="${TESTI.iscrizione}" rel="noopener noreferrer"><span class="riga"><span class="frase">${TESTI.invito} ${esc(CONTATTI.indirizzo)}. ${TESTI.settimana}</span><span class="freccia" aria-hidden="true">↗\uFE0E</span></span><span class="parola">${TESTI.prova}</span></a>`
}

/** Le anteprime di condivisione (Open Graph e Twitter). Il 404 non si condivide: non le ha. */
function social(c: Contesto, titolo: string, descrizione: string): string {
  const m = (k: string, v: string) => `<meta ${k.startsWith('og:') ? 'property' : 'name'}="${k}" content="${esc(v)}">`
  const immagine = `${c.d.dominio}${IMMAGINE_SOCIALE}`
  return [
    m('og:site_name', NOME),
    m('og:locale', 'it_IT'),
    m('og:image', immagine),
    m('og:image:width', '1200'),
    m('og:image:height', '630'),
    m('og:image:alt', `${TESTI.immagineAlt}, ${CONTATTI.indirizzo}`),
    m('twitter:card', 'summary_large_image'),
    m('twitter:title', titolo),
    ...(descrizione ? [m('twitter:description', descrizione)] : []),
    m('twitter:image', immagine),
  ].join('')
}

// Chi naviga da tastiera o con lo screen reader salta la testata: il link porta al <main>.
const conSalto = (corpo: string) => {
  const conDestinazione = corpo.replace(/<main[\s>]/, (m) => `<span id="contenuto"></span>${m}`)
  return conDestinazione === corpo ? corpo : `<a class="salta" href="#contenuto">Salta al contenuto</a>${conDestinazione}`
}

function documento(c: Contesto, o: { titolo: string; descrizione: string; percorso: string; corpo: string; noindex?: boolean; cssCorso?: boolean; cssHome?: boolean; cssContatti?: boolean; cssCorsoNuovo?: string; cssCorsi?: boolean; cssOrari?: boolean; dati?: string }): string {
  const url = `${c.d.dominio}${o.percorso}`
  const completo = o.percorso === '/' ? o.titolo : `${o.titolo} · ${NOME}`
  return `<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(completo)}</title>${o.descrizione ? `<meta name="description" content="${esc(o.descrizione)}">` : ''}<link rel="icon" type="image/svg+xml" href="/risorse/icon.svg"><link rel="icon" type="image/png" sizes="192x192" href="/risorse/icon-192.png"><link rel="apple-touch-icon" href="/risorse/apple-touch-icon.png"><link rel="canonical" href="${esc(url)}"><meta property="og:title" content="${esc(o.titolo)}">${o.descrizione ? `<meta property="og:description" content="${esc(o.descrizione)}">` : ''}<meta property="og:type" content="website"><meta property="og:url" content="${esc(url)}">${o.noindex ? '<meta name="robots" content="noindex">' : social(c, o.titolo, o.descrizione)}${o.dati ?? ''}<style>${CSS}</style>${o.cssCorso ? `<style>${CSS_CORSO}</style>` : ''}${o.cssHome ? `<style>${CSS_HOME}${o.cssCorsoNuovo !== undefined ? CSS_CORSO_NUOVO + o.cssCorsoNuovo : ''}${o.cssCorsi ? CSS_CORSI_NUOVA : ''}${cssFociSchede().replace(/\n/g, '')}</style>` : ''}${o.cssContatti ? `<style>${CSS_CONTATTI}</style>` : ''}${o.cssOrari ? `<style>${CSS_ORARI}</style>` : ''}</head><body${o.cssCorso ? ' class="pagina-corso"' : ''}>${conSalto(o.corpo)}</body></html>`
}

/**
 * La parola più lunga del titolo decide la misura: a 200px la colonna del titolo regge 9–10 lettere, e una parola più lunga
 * si spezzerebbe a metà. La M e la W sono larghe e contano 1,3. Da 14: «lunghissimo», da 12: «lungo», da 10,3: «medio».
 */
function classeTitolo(titolo: string): string {
  const peso = Math.max(0, ...titolo.split(/\s+/).map((w) => [...w].reduce((t, c) => t + (/[mw]/i.test(c) ? 1.3 : 1), 0)))
  return peso >= 14 ? ' class="lunghissimo"' : peso >= 12 ? ' class="lungo"' : peso >= 10.3 ? ' class="medio"' : ''
}

/** Le pagine che non sono mai la pagina di un corso, anche se hanno i due pulsanti. */
const PAGINE_NON_CORSO = new Set(['home', 'corsi', 'contatti', 'chi-siamo'])

function pagina(p: PaginaGenerata, c: Contesto, conContatti: boolean): string {
  const pulito = testoDellaPagina(p.testo, c.d.ospitiImmagini ?? [])
  // La pagina «orari» col segnaposto [orari]: gli orari veri dei corsi. Senza il segnaposto è una pagina come le altre.
  const orari = p.slug === 'orari' && !p.diLegge ? dividiOrari(pulito) : null
  if (orari) return paginaOrari(p, c, conContatti, orari)
  if (!PAGINE_NON_CORSO.has(p.slug) && !p.diLegge && eCorsoNuovo(pulito, TESTI.iscrizione)) return paginaCorsoNuovo(p, c, conContatti, pulito)
  if (p.slug === 'home' && !p.diLegge && eHomeNuova(pulito, TESTI.iscrizione)) return paginaHomeNuova(p, c, conContatti, pulito)
  if (p.slug === 'corsi' && !p.diLegge && eCorsiNuova(pulito, TESTI.iscrizione)) return paginaCorsiNuova(p, c, conContatti, pulito)
  if (p.slug === 'chi-siamo' && !p.diLegge && eChiSiamoNuova(pulito, TESTI.iscrizione)) return paginaChiSiamoNuova(p, c, conContatti, pulito)
  if (p.slug === 'contatti' && !p.diLegge && eContattiNuova(pulito, TESTI.iscrizione)) return paginaContattiNuova(p, c, conContatti, pulito)
  // Solo la Home ha il collage di foto e numeri in testata; quello che non entra nel collage resta nel testo.
  const inTestata = p.slug === 'home' && !p.diLegge ? collage(pulito) : { html: '', resto: pulito }
  // La pagina di un corso (foto, dati, presentazione prima del primo h2) ha la sua testata; le regole stanno in `main.corso`.
  // Una pagina di persona (foto e citazione in apertura) ha il suo ritratto; vedi `persona` in sitoLayout.ts. «Chi siamo» comincia allo stesso modo ma è la sua introduzione a fasce, non un ritratto.
  const dellaPersona = p.slug !== 'home' && p.slug !== 'chi-siamo' && !p.diLegge ? persona(pulito) : null
  // La scheda scarna di un istruttore (nome, foto se c'è, corsi): sitoIstruttori.ts. Mai la Home, Chi siamo, un corso o una pagina di legge.
  const cornice: Cornice = { slugs: c.slugs, iscrizione: TESTI.iscrizione, prova: TESTI.provaIntera, scrivici: TESTI.scrivici, contatti: conContatti ? TESTI.contatti : null, indirizzo: CONTATTI.indirizzo }
  const scheda = p.slug !== 'home' && p.slug !== 'chi-siamo' && !p.diLegge && !dellaPersona && !c.corsi.has(p.slug) ? schedaScarna(pulito, p.titolo, cornice) : null
  const corso = p.slug !== 'home' && !p.diLegge && !dellaPersona && !scheda ? testataCorso(pulito) : null
  // Una pagina che comincia con più `h3` (e senza `h2`) è l'elenco dei tecnici degli istruttori.
  const tecnici = !p.diLegge && !dellaPersona && !scheda && !corso && !/<h2[\s>]/i.test(inTestata.resto) ? elencoIstruttori(inTestata.resto, cornice) : null
  const testo = scheda ? '' : dellaPersona ? dellaPersona.resto : corso ? corso.resto : tecnici ? tecnici.resto : inTestata.resto
  const t = testata(c, conContatti, dellaPersona || scheda ? percorso('chi-siamo') : corso ? percorso('corsi') : percorso(p.slug))
  // «Contattaci» sta in testata, accanto a «Prova»: sotto titolo e frase non si ripete.
  const intro = scheda
    ? `<section class="scheda-persona">${scheda}</section>`
    : dellaPersona
    ? `<section class="pagina-hero persona-hero"><h1>${esc(p.titolo)}</h1><div class="lato">${p.descrizione ? `<p>${esc(p.descrizione)}</p>` : ''}</div></section>${dellaPersona.html}`
    : p.diLegge
      ? `<section class="pagina-testo"><h1>${esc(p.titolo)}</h1></section>`
      : `<section class="pagina-hero${p.slug === 'home' ? '' : ' interna'}${inTestata.html ? '' : ' solo'}${tecnici ? ' elenco-tecnici' : ''}"><div class="intro"><h1${classeTitolo(p.titolo)}>${esc(p.titolo)}</h1>${p.descrizione ? `<p>${esc(p.descrizione)}</p>` : ''}</div>${inTestata.html}</section>`
  const corpo = `${t}<main${scheda ? ' class="scheda-scarna"' : dellaPersona ? ' class="persona"' : corso ? ' class="corso"' : p.slug === 'contatti' ? ' class="pagina-contatti"' : ''}>${intro}${corso?.html ?? ''}${tecnici?.html ?? ''}${testo.trim() ? (!p.diLegge && /<h[23][\s>]/i.test(testo) ? (dellaPersona ? conFila(impagina(testo, false, false, true)) : impagina(testo, corso !== null, p.slug === 'contatti')) : `<div class="testo">${testo}</div>`) : ''}</main>${tecnici?.conInvito ? '' : invito(conContatti)}${piede(c)}`
  const dati = datiStrutturati({ dominio: c.d.dominio, nome: NOME, slug: p.slug, titolo: p.titolo, descrizione: p.descrizione, testo: pulito, titoloCorsi: c.d.pagine.find((x) => x.slug === 'corsi')?.titolo, eUnCorso: c.corsi.has(p.slug) })
  return documento(c, { titolo: p.titolo, descrizione: p.descrizione, percorso: percorso(p.slug), corpo, cssCorso: corso !== null, dati })
}

/** La Home nuova (sitoHome.ts): testata, hero con i due pulsanti, sezioni a passo unico. Senza la chiamata finale nel testo resta l'invito di sempre. */
function paginaHomeNuova(p: PaginaGenerata, c: Contesto, conContatti: boolean, pulito: string): string {
  const h = homeNuova(pulito, TESTI.iscrizione, barraProva())
  const hero = `<section class="pagina-hero con-pulsanti${h.foto ? '' : ' solo'}"><div class="intro"><h1>${esc(p.titolo)}</h1>${p.descrizione ? `<p>${esc(p.descrizione)}</p>` : ''}${h.bottoni}</div>${h.foto}</section>`
  const corpo = `${testata(c, conContatti, percorso(p.slug))}<main class="passo-unico">${hero}${h.html}</main>${h.chiamata ? '' : invito(conContatti)}${piede(c)}`
  const dati = datiStrutturati({ dominio: c.d.dominio, nome: NOME, slug: p.slug, titolo: p.titolo, descrizione: p.descrizione, testo: pulito, titoloCorsi: c.d.pagine.find((x) => x.slug === 'corsi')?.titolo, eUnCorso: false })
  return documento(c, { titolo: p.titolo, descrizione: p.descrizione, percorso: percorso(p.slug), corpo, cssHome: true, dati })
}

/** Gli orari (sitoOrari.ts): titolo e introduzione della segreteria, una tessera per giorno, la riga «Per variazioni…» e la data. Senza l'invito: nel design la pagina finisce con le variazioni. */
function paginaOrari(p: PaginaGenerata, c: Contesto, conContatti: boolean, { prima, dopo }: { prima: string; dopo: string }): string {
  // Senza orari la pagina non ha niente da introdurre: la frase del design al posto dell'introduzione della segreteria.
  const intro = (c.d.orariSito ?? []).length ? prima || (p.descrizione ? `<p>${esc(p.descrizione)}</p>` : '') : '<p>L’orario della settimana comparirà qui.</p>'
  const hero = `<section class="pagina-hero solo"><div class="intro"><h1>${esc(p.titolo)}</h1>${intro}</div></section>`
  const corpo = `${testata(c, conContatti, percorso(p.slug))}<main class="passo-unico pagina-orari">${hero}${orariHtml(dopo, c.d.orariSito ?? [])}</main>${piede(c)}`
  const dati = datiStrutturati({ dominio: c.d.dominio, nome: NOME, slug: p.slug, titolo: p.titolo, descrizione: p.descrizione, testo: '', titoloCorsi: c.d.pagine.find((x) => x.slug === 'corsi')?.titolo, eUnCorso: false })
  return documento(c, { titolo: p.titolo, descrizione: p.descrizione, percorso: percorso(p.slug), corpo, cssHome: true, cssOrari: true, dati })
}

/** I corsi nuova (sitoCorsi.ts): testata col solo titolo e la frase, nove schede, chiamata finale. Senza la chiamata nel testo resta l'invito di sempre. */
function paginaCorsiNuova(p: PaginaGenerata, c: Contesto, conContatti: boolean, pulito: string): string {
  const h = corsiNuova(pulito, TESTI.iscrizione)
  const hero = `<section class="pagina-hero solo"><div class="intro"><h1>${esc(p.titolo)}</h1>${h.frase ? `<p>${h.frase}</p>` : ''}</div></section>`
  const corpo = `${testata(c, conContatti, percorso(p.slug))}<main class="passo-unico pagina-corsi">${hero}${h.html}</main>${h.chiamata ? '' : invito(conContatti)}${piede(c)}`
  const dati = datiStrutturati({ dominio: c.d.dominio, nome: NOME, slug: p.slug, titolo: p.titolo, descrizione: p.descrizione, testo: pulito, titoloCorsi: c.d.pagine.find((x) => x.slug === 'corsi')?.titolo, eUnCorso: false })
  return documento(c, { titolo: p.titolo, descrizione: p.descrizione, percorso: percorso(p.slug), corpo, cssHome: true, cssCorsi: true, dati })
}

/** La pagina del corso rivista (sitoCorso.ts): come la Home nuova, con la foto di apertura o la fascia sotto il titolo. */
function paginaCorsoNuovo(p: PaginaGenerata, c: Contesto, conContatti: boolean, pulito: string): string {
  const collegata = (p.corsiCollegati?.length ?? 0) > 0
  const h = corsoNuovo(pulito, TESTI.iscrizione, collegata ? testiOrario(p.corsiCollegati ?? [], c.d.orari ?? []) : undefined)
  const hero = `<section class="pagina-hero con-pulsanti solo"><div class="intro"><h1${classeTitolo(p.titolo)}>${esc(p.titolo)}</h1>${p.descrizione ? `<p>${esc(p.descrizione)}</p>` : ''}${h.bottoni}</div></section>`
  const corpo = `${testata(c, conContatti, percorso('corsi'))}<main class="passo-unico corso-nuovo" data-corso="${esc(p.slug)}">${hero}${h.html}</main>${h.chiamata ? '' : invito(conContatti)}${piede(c)}`
  const dati = datiStrutturati({ dominio: c.d.dominio, nome: NOME, slug: p.slug, titolo: p.titolo, descrizione: p.descrizione, testo: pulito, titoloCorsi: c.d.pagine.find((x) => x.slug === 'corsi')?.titolo, eUnCorso: true })
  return documento(c, { titolo: p.titolo, descrizione: p.descrizione, percorso: percorso(p.slug), corpo, cssHome: true, cssCorsoNuovo: cssFuochiCorso(p.slug) + (collegata ? CSS_ORARIO_AUTOMATICO : ''), dati })
}

/** Contatti nuova (sitoContatti.ts): come la Home, testata, titolo con i due pulsanti, sezioni a passo unico; l'invito di sempre resta in fondo. */
function paginaContattiNuova(p: PaginaGenerata, c: Contesto, conContatti: boolean, pulito: string): string {
  const h = contattiNuova(pulito, TESTI.iscrizione, NOME, CONTATTI.indirizzo)
  const hero = `<section class="pagina-hero con-pulsanti solo"><div class="intro"><h1>${esc(p.titolo)}</h1>${p.descrizione ? `<p>${esc(p.descrizione)}</p>` : ''}${h.bottoni}</div></section>`
  const corpo = `${testata(c, conContatti, percorso(p.slug))}<main class="contatti-nuova passo-unico">${hero}${h.html}</main>${invito(conContatti)}${piede(c)}`
  const dati = datiStrutturati({ dominio: c.d.dominio, nome: NOME, slug: p.slug, titolo: p.titolo, descrizione: p.descrizione, testo: pulito, titoloCorsi: c.d.pagine.find((x) => x.slug === 'corsi')?.titolo, eUnCorso: false })
  return documento(c, { titolo: p.titolo, descrizione: p.descrizione, percorso: percorso(p.slug), corpo, cssHome: true, cssContatti: true, dati })
}

/** La Chi siamo nuova (sitoChiSiamo.ts): le regole della Home più le sue, dopo. Senza la chiamata finale nel testo resta l'invito di sempre. */
function paginaChiSiamoNuova(p: PaginaGenerata, c: Contesto, conContatti: boolean, pulito: string): string {
  const h = chiSiamoNuova(pulito, TESTI.iscrizione)
  const hero = `<section class="pagina-hero solo"><div class="intro"><h1>${esc(p.titolo)}</h1>${p.descrizione ? `<p>${esc(p.descrizione)}</p>` : ''}</div></section>`
  const corpo = `${testata(c, conContatti, percorso(p.slug))}<main class="passo-unico chi-siamo-nuova">${hero}${h.html}</main>${h.chiamata ? '' : invito(conContatti)}${piede(c)}`
  const dati = datiStrutturati({ dominio: c.d.dominio, nome: NOME, slug: p.slug, titolo: p.titolo, descrizione: p.descrizione, testo: pulito, titoloCorsi: c.d.pagine.find((x) => x.slug === 'corsi')?.titolo, eUnCorso: false })
  // Le regole della pagina vanno in coda al CSS della Home, senza toccare `documento` (condiviso con le altre pagine).
  return documento(c, { titolo: p.titolo, descrizione: p.descrizione, percorso: percorso(p.slug), corpo, cssHome: true, dati }).replace('</head>', () => `<style>${CSS_CHI_SIAMO}</style></head>`)
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

/** Una riga di testo semplice: senza tag, a capo e parentesi quadre (un titolo non deve aprire un link). */
const riga = (t: string) => t.replace(/<[^>]*>/g, ' ').replace(/[[\]]/g, '').replace(/\s+/g, ' ').trim()

/**
 * `llms.txt`: il sito raccontato agli assistenti AI (llmstxt.org). Solo quel che
 * c'è nelle pagine pubblicate e in `CONTATTI`; in ordine di indirizzo, così gli
 * stessi dati danno sempre lo stesso file.
 */
function llms(c: Contesto, pagine: PaginaGenerata[]): string {
  const voce = (p: PaginaGenerata) => `- [${riga(p.titolo) || p.slug}](${c.d.dominio}${percorso(p.slug)})${riga(p.descrizione) ? `: ${riga(p.descrizione)}` : ''}`
  const ordinate = pagine.filter((p) => p.slug !== 'home').sort((a, b) => (a.slug < b.slug ? -1 : 1))
  const sezione = (nome: string, quali: PaginaGenerata[]) => (quali.length ? [`## ${nome}\n\n${quali.map(voce).join('\n')}`] : [])
  const descrizione = riga(pagine.find((p) => p.slug === 'home')?.descrizione ?? '')
  const corsi = [...c.corsi].flatMap((s) => ordinate.filter((p) => p.slug === s))
  return (
    [
      `# ${NOME}${descrizione ? `\n\n> ${descrizione}` : ''}`,
      ...sezione('Corsi', corsi),
      ...sezione('Pagine', ordinate.filter((p) => !c.corsi.has(p.slug) && !p.diLegge)),
      ...sezione('Opzionale', ordinate.filter((p) => p.diLegge)),
      `## Contatti\n\n- Indirizzo: ${CONTATTI.indirizzo}\n- Telefono: ${CONTATTI.telefono}\n- Instagram: ${CONTATTI.instagram}\n- Facebook: ${CONTATTI.facebook}`,
    ].join('\n\n') + '\n'
  )
}

/**
 * Tutti i file del sito: percorso → contenuto. Una pagina con un indirizzo che
 * non va si salta, e le altre si generano lo stesso. Un dominio che non va
 * ferma tutto: finirebbe in canonical, sitemap e robots.txt.
 */
export function generaSito(d: DatiSito): Record<string, string> {
  if (!DOMINIO.test(d.dominio)) throw new Error('Il dominio del sito non va bene: deve essere come https://www.officinedellosport.it, senza «/» in fondo')
  const pagine = d.pagine.filter((p, i) => slugDiPagina(p.slug) && d.pagine.findIndex((x) => x.slug === p.slug) === i)
  const slugs = new Set(pagine.map((p) => p.slug))
  const corsi = corsiDa(testoDellaPagina(pagine.find((p) => p.slug === 'corsi')?.testo ?? '', d.ospitiImmagini ?? []), slugs, new Set(pagine.filter((p) => p.diLegge).map((p) => p.slug)))
  const c: Contesto = { d, slugs, corsi }
  const conContatti = c.slugs.has('contatti')
  const file: Record<string, string> = {}
  for (const p of pagine) file[fileDi(p.slug)] = pagina(p, c, conContatti)
  file['404.html'] = nonTrovata(c, conContatti)
  file['sitemap.xml'] = mappa(c, pagine)
  file['llms.txt'] = llms(c, pagine)
  file['robots.txt'] = `User-agent: *\nAllow: /\n\nSitemap: ${d.dominio}/sitemap.xml\n`
  for (const r of d.rinvii) {
    if (!slugValido(r.da) || c.slugs.has(r.da) || !c.slugs.has(r.a)) continue
    file[`${r.da}/index.html`] = rinvio(c, r.a)
  }
  return file
}

/** Le pagine di legge del sito: le tre che `56-sito.sql` crea e che non si nascondono (la funzione pubblica non dice quali sono). */
export const PAGINE_DI_LEGGE = ['privacy', 'cookie', 'contributi-pubblici']

/** Le risposte delle funzioni pubbliche del database (`sito_pagine_pubbliche`, `sito_menu_pubblico`, `sito_redirect_pubblici`, `orari_sito`) come servono al generatore. */
export function datiDaRisposte(
  dominio: string,
  pagine: Array<{ slug: string; titolo: string | null; descrizione: string | null; testo: string | null; pubblicata_il: string | null; corsi_collegati?: string[] | null }>,
  menu: Array<{ dove: string; ordine: number; etichetta: string; slug: string | null; indirizzo: string | null }>,
  rinvii: Array<{ da: string; a: string }>,
  orari?: Array<{ corso_id: string; giorno: number; ora: string; durata_min: number }>,
  orariSito?: OrarioSito[],
): DatiSito {
  return {
    dominio: dominio.replace(/\/+$/, ''),
    // Senza `orari_aperti()` (orari assente) non si può dire «Orario in arrivo» per davvero: le pagine tornano non collegate.
    pagine: pagine.map((p) => ({
      slug: p.slug,
      titolo: p.titolo ?? '',
      descrizione: p.descrizione ?? '',
      testo: p.testo ?? '',
      pubblicataIl: p.pubblicata_il ?? undefined,
      diLegge: PAGINE_DI_LEGGE.includes(p.slug),
      corsiCollegati: orari ? (p.corsi_collegati ?? []) : [],
    })),
    menu: menu.flatMap((v) => (v.dove === 'menu' || v.dove === 'footer' ? [{ dove: v.dove, ordine: v.ordine, etichetta: v.etichetta, slug: v.slug, indirizzo: v.indirizzo }] : [])),
    rinvii,
    orari: (orari ?? []).map((o) => ({ corsoId: o.corso_id, giorno: o.giorno, ora: o.ora, durataMin: o.durata_min })),
    orariSito,
  }
}
