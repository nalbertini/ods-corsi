/**
 * La pagina del corso rivista (docs/design-canvas/corso-miglioramenti/): dal testo incollato nel pannello SITO alle sezioni del design.
 *
 * Come la Home (sitoHome.ts), il testo nuovo si riconosce da un pulsante verso il modulo online nell'introduzione
 * (prima del primo `h2`): senza, la pagina resta quella di oggi (`testataCorso` + `impagina`). Ogni sezione si riconosce
 * dalla forma, mai dal titolo; una forma che non torna cade in `sezione` e nessuna parola si perde. Le foto sono
 * tre ruoli facoltativi (A apertura, B accanto a «Cosa si fa», C chiusura): una foto che manca non si presta da un altro
 * corso. Senza la foto A la fascia blu prende le prime tre voci dei dati (giorno, ora, età) e l'orario non si ripete.
 *
 * Una pagina collegata ai corsi (sitoOrario.ts) non mostra l'orario scritto a mano: al suo posto ci sono le righe
 * d'orario di CORSI, e nella fascia blu restano le voci che non sono giorno e ora (l'età).
 */

import { ROTAZIONE_CORSO, blocchi, conCaricamento, contenuto, gruppiDa, griglia, immagine, inOrario, sezione, tesseraOrario, testoSolo, vociDiUnElenco, type Blocco, type Gruppo } from './sitoLayout'
import { eIscrizione, introduzione, pulsanti, pulsantiDi, type Link } from './sitoHome'

/** Quante voci dei dati vanno nella fascia quando non c'è la foto di apertura. */
const VOCI_FASCIA = 3

/** Vero se l'introduzione ha un pulsante verso il modulo online. */
export function eCorsoNuovo(testoPulito: string, iscrizione: string): boolean {
  return introduzione(blocchi(testoPulito)).some((x) => pulsantiDi(x)?.some((p) => eIscrizione(p.href, iscrizione)))
}

const COLORI = ROTAZIONE_CORSO

/**
 * Dove stanno le persone nelle foto di pagina, per corso e ruolo: `[computer, telefono]` come `object-position`.
 * Sono per corso e ruolo e non per file perché i file nuovi hanno un nome deciso dalla libreria IMMAGINI, non da noi.
 * Un corso che non è qui non ha foto approvate: i riquadri restano col ritaglio al centro.
 */
type Fuochi = Partial<Record<'apertura' | 'interna' | 'chiusura', [string, string]>>
const FUOCHI_CORSO: Record<string, Fuochi> = {
  judo: { apertura: ['50% 12%', '50% 50%'], interna: ['50% 30%', '50% 29%'], chiusura: ['85% 50%', '85% 50%'] },
  lotta: { apertura: ['50% 20%', '30% 50%'], interna: ['65% 50%', '58% 50%'], chiusura: ['10% 50%', '10% 50%'] },
  aikido: { apertura: ['50% 8%', '50% 50%'], interna: ['24% 50%', '33% 50%'], chiusura: ['50% 50%', '50% 45%'] },
  'preparazione-atletica': { apertura: ['50% 60%', '40% 60%'], interna: ['70% 50%', '80% 50%'], chiusura: ['50% 35%', '50% 35%'] },
  'sollevamenti-pesi': { apertura: ['50% 55%', '60% 50%'], interna: ['45% 50%', '45% 50%'] },
  'giocomotricita-e-psicomotricita': { apertura: ['50% 0%', '40% 40%'], chiusura: ['50% 50%', '50% 50%'] },
  'avviamento-alle-arti-marziali': { apertura: ['50% 40%', '40% 50%'], interna: ['92% 50%', '90% 50%'], chiusura: ['40% 50%', '40% 50%'] },
}

const SELETTORE: Array<[keyof Fuochi, string]> = [['apertura', '.corso-apertura img'], ['interna', '.corso-interna img'], ['chiusura', '.cta-foto img']]

/** Le regole di fuoco di un corso: vuote se il corso non ha foto approvate. */
export function cssFuochiCorso(slug: string): string {
  const f = FUOCHI_CORSO[slug]
  if (!f) return ''
  const regole = (i: 0 | 1) => SELETTORE.flatMap(([ruolo, selettore]) => { const x = f[ruolo]; return x ? [`main[data-corso="${slug}"] ${selettore}{object-position:${x[i]}}`] : [] }).join('')
  return `${regole(0)}@media (max-width:900px){${regole(1)}}`
}

/** Le voci della fascia blu che dicono giorno e ora: in una pagina collegata le sostituisce l'orario di CORSI. */
const VOCE_ORARIO = /^(giorn[oi]|ora|orari?)$/i

/** Le regole delle righe d'orario automatiche: solo nelle pagine collegate, così le altre restano com'erano. */
export const CSS_ORARIO_AUTOMATICO = `
.corso-nuovo .sezione .tessere.orari .tessera.riga:not(.foto){min-height:0;padding:22px 26px;justify-content:center}
.corso-nuovo .riga-orario{margin:0;font-family:var(--display);font-weight:800;font-size:clamp(24px,2.8vw,40px);line-height:1;text-transform:uppercase}
@media (max-width:900px){
.corso-nuovo .sezione .tessere.orari .tessera.riga:not(.foto){padding:18px 20px}
.corso-nuovo .riga-orario{font-size:clamp(22px,6.4vw,30px)}
}
`.replace(/\n/g, '')

/** Le righe d'orario di CORSI come tessere a tutta larghezza, l'ultima gialla come nell'orario scritto a mano. */
function righeAutomatiche(titolo: string, testi: string[]): string {
  const tessere = testi.map((t, k) => `<article class="tessera ${k === testi.length - 1 ? 'giallo' : 'chiara'} riga"><p class="riga-orario">${t}</p></article>`)
  return `<section class="sezione orari"><h2>${titolo}</h2>${griglia(tessere.length, tessere.join(''), ' orari')}</section>`
}

const dato = (colore: string, etichetta: string, valore: string) => `<article class="tessera ${colore} dato"><span class="et">${etichetta}</span><p class="val">${valore}</p></article>`

/** Foto di apertura, oppure la fascia blu; poi i dati che restano come tessere. Ciò che l'introduzione non usa (un paragrafo in più, una seconda foto) torna in `resto`: nessuna parola si perde. */
function apertura(intro: Blocco[], collegata: boolean): { html: string; resto: Blocco[] } {
  const iFoto = intro.findIndex((x) => immagine(x) !== null)
  const iDati = intro.findIndex((x) => vociDiUnElenco(x) !== null)
  const iPulsanti = intro.findIndex((x) => pulsantiDi(x) !== null)
  const foto = iFoto >= 0 ? immagine(intro[iFoto]) : null
  const voci = iDati >= 0 ? vociDiUnElenco(intro[iDati]) ?? [] : []
  const comeFascia = foto ? [] : voci.slice(0, VOCI_FASCIA).filter((v) => !collegata || !VOCE_ORARIO.test(testoSolo(v.titolo)))
  // In una pagina collegata, giorno e ora a mano non si mostrano nemmeno come tessere: c'è l'orario di CORSI.
  const comeTessere = (foto ? voci : voci.slice(VOCI_FASCIA)).filter((v) => !collegata || !VOCE_ORARIO.test(testoSolo(v.titolo)))
  const testa = foto
    ? `<figure class="corso-apertura">${conCaricamento(foto, true)}</figure>`
    : comeFascia.length ? `<ul class="corso-fascia">${comeFascia.map((v) => `<li><span class="et">${v.titolo}</span><strong class="val">${v.testo}</strong></li>`).join('')}</ul>` : ''
  const dati = comeTessere.length ? griglia(comeTessere.length, comeTessere.map((v, k) => dato(COLORI[k % COLORI.length], v.titolo, v.testo)).join(''), ' dati') : ''
  return { html: testa + dati, resto: intro.filter((_, k) => k !== iFoto && k !== iDati && k !== iPulsanti) }
}

/** Un gruppo di soli paragrafi (e foto), con almeno un testo vero. */
const soloTesto = (g: Gruppo) => g.corpo.every((x) => x.tag === 'p' || immagine(x) !== null) && g.corpo.some((x) => x.tag === 'p' && immagine(x) === null)

/** Un `h2` i cui `h3` sono tutti orari (primo paragrafo: solo l'ora in grassetto). Senza foto di apertura l'orario sta già nella fascia. */
function orari(titolo: string, gruppi: Gruppo[]): string {
  const tessere = gruppi.map((g, k) => tesseraOrario(k === gruppi.length - 1 ? 'giallo' : 'chiara', g.titolo, g.corpo))
  return `<section class="sezione orari"><h2>${titolo}</h2>${griglia(tessere.length, tessere.join(''), ' orari')}</section>`
}

/** Due gruppi con paragrafi: «Cosa si fa» e «A chi è rivolto». La prima foto del primo gruppo è la B, accanto al testo. */
function cosaSiFa(titolo: string, gruppi: Gruppo[]): string {
  const foto = gruppi[0].corpo.map(immagine).find((x): x is string => x !== null)
  const tessere = gruppi.map((g, k) => {
    const corpo = g.corpo.filter((x) => !(k === 0 && immagine(x) === foto && foto !== null))
    return `<article class="tessera ${k === 0 ? 'giallo' : 'inchiostro'}"><h3>${g.titolo}</h3>${corpo.map((x) => x.html).join('')}</article>`
  })
  // Un titolo vuoto (la forma di «Cosa si fa» nei testi pronti) non lascia nessun `h2` nella pagina.
  const h2 = testoSolo(titolo) ? `<h2>${titolo}</h2>` : ''
  return `<section class="sezione cosa-si-fa${foto ? ' con-foto' : ''}">${h2}<div class="cosa-griglia">${griglia(2, tessere.join(''), ' testi')}${foto ? `<figure class="corso-interna">${conCaricamento(foto, false)}</figure>` : ''}</div></section>`
}

/** Tre o quattro gruppi con un solo paragrafo: le tessere numerate di «Cosa aspettarsi». */
function aspettarsi(titolo: string, gruppi: Gruppo[]): string {
  const tessere = gruppi.map((g, k) => `<article class="tessera ${COLORI[k % COLORI.length]}"><span class="numero-perche" aria-hidden="true">${k + 1}</span><h3>${g.titolo}</h3>${g.corpo[0].html}</article>`)
  return `<section class="sezione"><h2>${titolo}</h2>${griglia(gruppi.length, tessere.join(''), ' perche')}</section>`
}

/** La chiusura: titolo, frase del corso, come provare, pulsanti (il giallo per primo) e, se c'è, la foto C. */
function chiusura(titolo: string, corpo: Blocco[], link: Link[], iscrizione: string): string {
  const foto = corpo.map(immagine).find((x): x is string => x !== null)
  const testi = corpo.filter((x) => pulsantiDi(x) === null && immagine(x) === null).map((x) => x.html).join('')
  return `<section class="sezione cta${foto ? '' : ' solo'}"><div class="cta-testo"><h2>${titolo}</h2>${testi}${pulsanti(link, iscrizione)}</div>${foto ? `<figure class="cta-foto">${conCaricamento(foto, false)}</figure>` : ''}</section>`
}

/** Una sezione fatta solo di `h3` con un solo paragrafo, in 3 o 4: «Cosa aspettarsi» se è l'ultima prima della chiusura. */
const eAspettarsi = (gruppi: Gruppo[]) => (gruppi.length === 3 || gruppi.length === 4) && gruppi.every((g) => g.corpo.length === 1 && g.corpo[0].tag === 'p')

/**
 * `bottoni` e `html` vanno nella pagina: i pulsanti nella testata, il resto in `<main>` dopo il titolo.
 * `chiamata` dice se la chiusura c'è già (allora l'invito globale non si ripete).
 * `orario` sono le righe scritte dai corsi collegati (`testiOrario`): se c'è, la pagina è collegata e l'orario a mano non si mostra.
 */
export function corsoNuovo(testoPulito: string, iscrizione: string, orario?: string[]): { bottoni: string; html: string; chiamata: boolean } {
  const b = blocchi(testoPulito)
  const primoTitolo = b.findIndex((x) => x.tag === 'h2')
  const intro = b.slice(0, primoTitolo < 0 ? b.length : primoTitolo)
  const link = intro.map((x) => pulsantiDi(x)).find((x): x is Link[] => x !== null) ?? []
  const haFoto = intro.some((x) => immagine(x) !== null)
  const titoli = b.map((x, i) => (x.tag === 'h2' ? i : -1)).filter((i) => i >= 0)
  const sezioni = titoli.map((i, k) => ({ titolo: contenuto(b[i]), corpo: b.slice(i + 1, titoli[k + 1] ?? b.length) }))
  // La chiusura è l'ultima sezione, se ha un pulsante verso il modulo; «Cosa aspettarsi» è la sezione subito prima di lei, se ha la sua forma.
  const ultima = sezioni[sezioni.length - 1]
  const iChiusura = ultima && ultima.corpo.some((x) => pulsantiDi(x)?.some((p) => eIscrizione(p.href, iscrizione))) ? sezioni.length - 1 : -1
  const prima = iChiusura < 0 ? sezioni.length : iChiusura
  const forma = (s: { corpo: Blocco[] }) => (s.corpo[0]?.tag === 'h3' ? gruppiDa(s.corpo) : [])
  const iAspettarsi = prima > 0 && eAspettarsi(forma(sezioni[prima - 1])) ? prima - 1 : -1
  const testa = apertura(intro, orario !== undefined)
  // L'orario a mano è la prima sezione fatta solo di orari: le righe di CORSI prendono il suo posto, e le altre uguali spariscono.
  const eOrari = (k: number) => k !== iChiusura && forma(sezioni[k]).length > 0 && forma(sezioni[k]).every((g) => inOrario(g.corpo))
  const iOrari = orario ? sezioni.findIndex((_, k) => eOrari(k)) : -1
  const fuori = sezioni.map((s, k) => {
    const gruppi = forma(s)
    if (k === iChiusura) return chiusura(s.titolo, s.corpo, s.corpo.flatMap((x) => pulsantiDi(x) ?? []), iscrizione)
    if (orario && eOrari(k)) return k === iOrari ? righeAutomatiche(s.titolo, orario) : ''
    if (haFoto && gruppi.length > 0 && gruppi.every((g) => inOrario(g.corpo))) return orari(s.titolo, gruppi)
    if (gruppi.length === 2 && gruppi.every(soloTesto)) return cosaSiFa(s.titolo, gruppi)
    if (k === iAspettarsi) return aspettarsi(s.titolo, gruppi)
    return sezione(s.titolo, s.corpo)
  })
  // Senza una sezione d'orario nel testo le righe stanno dove l'orario avrebbe stato: prima della fascia blu, o dopo la foto e i dati.
  const righe = orario && iOrari < 0 ? righeAutomatiche('Orario', orario) : ''
  return { bottoni: link.length ? pulsanti(link, iscrizione) : '', html: `${haFoto ? '' : righe}${testa.html}${haFoto ? righe : ''}${testa.resto.length ? sezione(null, testa.resto) : ''}${fuori.join('')}`, chiamata: iChiusura >= 0 }
}
