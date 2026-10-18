/**
 * La Chi siamo rivista (docs/design-canvas/chi-siamo-miglioramenti/): dal testo incollato nel pannello SITO alle fasce del design.
 *
 * Il testo nuovo si riconosce da un pulsante verso il modulo online in una sezione (la chiamata finale): senza,
 * la pagina resta quella di oggi (`impagina`) finché la segreteria non incolla il testo nuovo. Ogni fascia si riconosce
 * dalla forma, mai dal titolo, perché la segreteria può cambiarlo; una forma che non torna cade in `sezione` e nessun
 * testo si perde. Valori e chiamata finale sono quelli della Home (`sezioneNuova`). I colori dei pannelli con foto
 * seguono l'ordine (inchiostro, poi giallo), non la presenza del pulsante: la pagina Istruttori può non esserci ancora.
 */

import { eIscrizione, pulsantiDi, sezioneNuova, type Link } from './sitoHome'
import { blocchi, conCaricamento, contenuto, immagine, numeriDiUnElenco, type Blocco } from './sitoLayout'

// Copia di quella di sitoHome/sitoLayout: non si esporta da lì per non toccare file condivisi con le pagine in lavorazione.
const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

const COLORI_OGGI = ['chiara', 'blu']
const COLORI_NUMERI = ['blu', 'giallo', 'inchiostro', 'blu']
const COLORI_PANNELLI = ['inchiostro', 'giallo']

/** Vero se una sezione (dopo il primo `h2`) ha un pulsante verso il modulo online. */
export function eChiSiamoNuova(testoPulito: string, iscrizione: string): boolean {
  const b = blocchi(testoPulito)
  const primo = b.findIndex((x) => x.tag === 'h2')
  return primo >= 0 && b.slice(primo).some((x) => pulsantiDi(x)?.some((p) => eIscrizione(p.href, iscrizione)))
}

/** Il primo pulsante è giallo, gli altri a linea (il colore sul pannello lo decide il CSS). */
function bottoni(l: Link[], soloALinea = false): string {
  const a = (x: Link, k: number) => `<a class="pulsante ${k === 0 && !soloALinea ? 'primario' : 'secondario'}" href="${esc(x.href)}"${/^https?:/i.test(x.href) ? ' rel="noopener noreferrer"' : ''}>${x.testo}</a>`
  return l.length ? `<div class="pulsanti">${l.map(a).join('')}</div>` : ''
}

/** Prima del primo `h2`: foto con frase, tessere «oggi», numeri; quel che non ha una forma resta testo. */
function introduzione(testa: Blocco[]): string {
  const foto = testa.map(immagine).find((x): x is string => x !== null)
  const frase = testa.find((x) => x.tag === 'blockquote')
  const slogan = foto && frase ? { foto, frase } : null
  const tessere: Array<{ titolo: string; testi: string[] }> = []
  let numeri: ReturnType<typeof numeriDiUnElenco> = null
  const resto: string[] = []
  let fotoUsata = false
  for (const b of testa) {
    if (slogan && !fotoUsata && immagine(b) !== null) { fotoUsata = true; continue }
    if (slogan && b === slogan.frase) continue
    if (b.tag === 'h3') { tessere.push({ titolo: contenuto(b), testi: [] }); continue }
    if (b.tag === 'p' && tessere.length && !numeri) { tessere[tessere.length - 1].testi.push(b.html); continue }
    const n: ReturnType<typeof numeriDiUnElenco> = numeri ? null : numeriDiUnElenco(b)
    if (n) { numeri = n; continue }
    resto.push(b.html)
  }
  const tSlogan = slogan ? `<section class="slogan-fascia"><figure class="slogan-foto">${conCaricamento(slogan.foto, true)}</figure><blockquote class="slogan-frase">${contenuto(slogan.frase)}</blockquote></section>` : ''
  const tOggi = tessere.length ? `<div class="tessere n-${tessere.length} oggi">${tessere.map((t, k) => `<article class="tessera ${COLORI_OGGI[k % COLORI_OGGI.length]}"><h2>${t.titolo}</h2>${t.testi.join('')}</article>`).join('')}</div>` : ''
  const tNumeri = numeri ? `<div class="tessere n-${numeri.length} numeri">${numeri.map((n, k) => `<article class="tessera ${COLORI_NUMERI[k % COLORI_NUMERI.length]} numero"><strong class="cifra">${n.cifra}</strong>${n.scritta ? ` <span class="scritta">${n.scritta}</span>` : ''}</article>`).join('')}</div>` : ''
  return `${tSlogan}${tOggi}${tNumeri}${resto.length ? `<div class="testo">${resto.join('')}</div>` : ''}`
}

/** Una fila di foto, ognuna con la didascalia che la segue; il titolo c'è per chi usa lo screen reader. */
function fila(titolo: string, corpo: Blocco[]): string {
  const figure: Array<{ foto: string; didascalia: string }> = []
  const altri: string[] = []
  const link: Link[] = []
  let ultimaFoto = false
  for (const b of corpo) {
    const f = immagine(b)
    const l = pulsantiDi(b)
    if (f !== null) { figure.push({ foto: f, didascalia: '' }); ultimaFoto = true; continue }
    if (l) { link.push(...l); ultimaFoto = false; continue }
    if (ultimaFoto) { figure[figure.length - 1].didascalia = contenuto(b); ultimaFoto = false; continue }
    altri.push(b.html)
  }
  const f = figure.map((x) => `<figure>${conCaricamento(x.foto, false)}${x.didascalia ? `<figcaption>${x.didascalia}</figcaption>` : ''}</figure>`).join('')
  return `<section class="sezione corsi-foto"><h2 class="nascosto">${titolo}</h2>${altri.length ? `<div class="colonna">${altri.join('')}</div>` : ''}<div class="fila-foto">${f}</div>${bottoni(link, true)}</section>`
}

/** Titolo, testo e (se c'è) pulsante a sinistra, una foto a destra. */
function pannello(titolo: string, corpo: Blocco[], colore: string): string {
  const foto = corpo.map(immagine).find((x): x is string => x !== null) ?? ''
  const testi = corpo.filter((x) => immagine(x) === null && pulsantiDi(x) === null).map((x) => x.html).join('')
  const link = corpo.flatMap((x) => pulsantiDi(x) ?? [])
  return `<section class="sezione"><div class="blocco-foto ${colore}"><div class="blocco-testo"><h2>${titolo}</h2>${testi}${bottoni(link)}</div><figure class="blocco-img">${conCaricamento(foto, false)}</figure></div></section>`
}

/**
 * La Chi siamo nuova: `html` va in `<main>` dopo il titolo (che sta nella testata della pagina); `chiamata` dice se la
 * chiamata finale c'è già (allora l'invito globale non si ripete).
 */
export function chiSiamoNuova(testoPulito: string, iscrizione: string): { html: string; chiamata: boolean } {
  const b = blocchi(testoPulito)
  const titoli = b.map((x, i) => (x.tag === 'h2' ? i : -1)).filter((i) => i >= 0)
  const testa = b.slice(0, titoli[0] ?? b.length)
  let pannelli = 0
  const sezioni = titoli.map((i, k) => {
    const titolo = contenuto(b[i])
    const corpo = b.slice(i + 1, titoli[k + 1] ?? b.length)
    const ultima = k === titoli.length - 1
    const link = corpo.flatMap((x) => pulsantiDi(x) ?? [])
    const soloTestoEFoto = corpo.every((x) => x.tag === 'p' || x.tag === 'img')
    const foto = corpo.filter((x) => immagine(x) !== null).length
    const testi = corpo.filter((x) => immagine(x) === null && pulsantiDi(x) === null).length
    const chiamata = link.some((x) => eIscrizione(x.href, iscrizione))
    if (soloTestoEFoto && !chiamata) {
      if (foto >= 2) return fila(titolo, corpo)
      if (foto === 1 && testi >= 1) return pannello(titolo, corpo, COLORI_PANNELLI[pannelli++ % COLORI_PANNELLI.length])
    }
    return sezioneNuova(titolo, corpo, ultima, iscrizione)
  })
  return { html: `${introduzione(testa)}${sezioni.join('')}`, chiamata: sezioni.some((s) => s.startsWith('<section class="sezione cta')) }
}

/**
 * Le regole della Chi siamo nuova: stanno dopo quelle della Home (testata, pulsanti, numeri, valori, chiamata finale). Quelle che
 * toccano pezzi già esistenti sono sotto `.chi-siamo-nuova`; le classi nuove (`.slogan-*`, `.blocco-*`, `.fila-foto`, `.oggi`) non servono
 * altrove perché questo `<style>` esce solo su questa pagina. La fila è fatta per quattro foto (4 colonne, 2×2 sul telefono). Scala dei titoli: 120 pagina, 80 sezione, 40 tessera.
 * Il fuoco delle foto è per riquadro (non per file): la stessa foto sta in riquadri diversi di pagine diverse, e `!important`
 * serve a vincere sulle regole per file di sitoFoto.ts. Quelle del telefono vengono dopo.
 */
const FUOCHI: Array<[string, string, string]> = [
  ['.slogan-foto img', '50% 70%', '50% 75%'],
  ['.blocco-foto.inchiostro .blocco-img img', '50% 25%', '50% 25%'],
  ['.blocco-foto.giallo .blocco-img img', '50% 50%', '50% 50%'],
  ['.fila-foto figure:nth-child(1) img', '50% 62%', '50% 62%'],
  ['.fila-foto figure:nth-child(2) img', '40% 50%', '40% 50%'],
  ['.fila-foto figure:nth-child(3) img', '50% 90%', '50% 90%'],
  ['.fila-foto figure:nth-child(4) img', '60% 40%', '60% 40%'],
]
const fuochi = (i: 1 | 2) => FUOCHI.map((f) => `.chi-siamo-nuova ${f[0]}{object-position:${f[i]}!important}`).join('\n')

export const CSS_CHI_SIAMO = `
.chi-siamo-nuova .sezione{padding-top:96px}
.chi-siamo-nuova .pagina-hero{display:block;padding:24px var(--margine) 0}
.chi-siamo-nuova .pagina-hero .intro{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,520px);gap:0 48px;align-items:end;max-width:none}
.chi-siamo-nuova h1{font-size:clamp(84px,8.33vw,120px);line-height:.9}
.chi-siamo-nuova .intro h1{margin:0}
.chi-siamo-nuova .intro p{max-width:520px;margin:0 0 8px;font-size:22px;line-height:1.5}
.slogan-fascia{display:grid;grid-template-columns:minmax(0,1.9fr) minmax(0,1fr);gap:6px;margin:48px var(--margine) 0}
.slogan-foto{margin:0;height:clamp(300px,30.56vw,440px);overflow:hidden;border-radius:6px}
.slogan-foto img{display:block;width:100%;height:100%;max-width:none;object-fit:cover;border-radius:6px}
.slogan-frase{display:flex;align-items:flex-end;margin:0;padding:clamp(24px,2.78vw,40px);border-radius:6px;background:var(--giallo);color:var(--inchiostro);font-family:var(--display);font-weight:800;font-size:clamp(44px,3.89vw,56px);line-height:1;text-transform:uppercase;text-wrap:balance}
.slogan-frase p{margin:0}
.slogan-frase::before,.slogan-frase::after{content:none}
.oggi{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;margin:48px var(--margine) 0}
.chi-siamo-nuova .oggi>.tessera{grid-column:auto;gap:16px;padding:clamp(24px,2.78vw,40px);font-size:20px;line-height:1.5}
.chi-siamo-nuova .oggi h2{margin:0;font-size:clamp(32px,2.78vw,40px);line-height:.95}
.chi-siamo-nuova .oggi p{margin:0}
.chi-siamo-nuova .tessere.numeri{margin-top:96px}
.chi-siamo-nuova .pulsante{min-height:56px}
.blocco-foto{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,520px);gap:48px;align-items:center;overflow:hidden;border-radius:6px}
.blocco-foto.inchiostro{padding:48px;background:var(--inchiostro);color:#fff}
.blocco-foto.giallo{grid-template-columns:minmax(0,1fr) minmax(0,560px);gap:0;align-items:stretch;background:var(--giallo);color:var(--inchiostro)}
.blocco-foto.giallo .blocco-testo{display:flex;flex-direction:column;justify-content:center;padding:48px}
.chi-siamo-nuova .blocco-testo h2{margin:0 0 20px}
.chi-siamo-nuova .blocco-testo p{max-width:560px;margin:0 0 32px;font-size:22px;line-height:1.5}
.chi-siamo-nuova .blocco-testo p:last-child{margin:0}
.blocco-img{margin:0;overflow:hidden}
.blocco-img img{display:block;width:100%;height:100%;max-width:none;object-fit:cover;border-radius:0}
.blocco-foto.inchiostro .blocco-img{height:390px;border-radius:6px}
.blocco-foto.giallo .blocco-img{min-height:420px}
.blocco-foto.giallo .primario{background:var(--inchiostro);color:#fff}
.blocco-foto.inchiostro .secondario{border-color:#fff;color:#fff}
.fila-foto{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}
.fila-foto figure{margin:0}
.fila-foto figure img{display:block;width:100%;height:420px;max-width:none;object-fit:cover;border-radius:6px}
.fila-foto figcaption{min-height:48px;padding:10px 0 0;font-size:18px;font-weight:600;line-height:1.3}
.chi-siamo-nuova .corsi-foto .pulsanti{margin-top:24px}
.chi-siamo-nuova .nascosto{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
.chi-siamo-nuova .tessere.perche{grid-template-columns:repeat(2,minmax(0,1fr))}
.chi-siamo-nuova .tessere.perche>.tessera{grid-column:auto}
${fuochi(1)}
@media (max-width:900px){
.chi-siamo-nuova .sezione{padding-top:64px}
.chi-siamo-nuova .pagina-hero{padding-top:20px}
.chi-siamo-nuova .pagina-hero .intro{grid-template-columns:1fr;gap:16px}
.chi-siamo-nuova .intro p{margin:0;font-size:18px}
.slogan-fascia{grid-template-columns:1fr;margin-top:32px}
.slogan-foto{height:210px}
.slogan-frase{padding:24px}
.oggi{grid-template-columns:1fr;margin-top:32px}
.chi-siamo-nuova .oggi>.tessera{padding:24px;font-size:18px}
.chi-siamo-nuova .oggi h2{font-size:32px}
.chi-siamo-nuova .oggi>.tessera.chiara{background:var(--chiara);color:var(--inchiostro)}
.chi-siamo-nuova .oggi>.tessera.blu{background:var(--blu);color:#fff}
.chi-siamo-nuova .tessere.numeri{margin-top:64px}
.blocco-foto,.blocco-foto.giallo{grid-template-columns:1fr}
.blocco-foto.inchiostro{gap:24px;padding:24px}
.blocco-foto.giallo .blocco-testo{padding:24px}
.chi-siamo-nuova .blocco-testo p{font-size:18px}
.blocco-foto.inchiostro .blocco-img,.blocco-foto.giallo .blocco-img{height:257px;min-height:0}
.blocco-foto.inchiostro h2{font-size:56px}
.blocco-foto.giallo h2{font-size:44px}
.blocco-foto .pulsante,.corsi-foto .pulsante{width:100%}
.fila-foto{grid-template-columns:repeat(2,minmax(0,1fr))}
.fila-foto figure img{height:210px}
.fila-foto figcaption{font-size:15px}
.chi-siamo-nuova .tessere.perche{grid-template-columns:1fr}
${fuochi(2)}
}
`.replace(/\n/g, '')
