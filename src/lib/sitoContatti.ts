/**
 * La pagina Contatti rivista (docs/design-canvas/contatti-miglioramenti/): dal testo incollato nel pannello SITO alle
 * sezioni del design.
 *
 * Come per la Home (sitoHome.ts) il testo nuovo si riconosce da un pulsante verso il modulo online prima del primo `h2`:
 * senza, la pagina resta quella di oggi (`impagina` con i recapiti) finché la segreteria non incolla il testo nuovo. Ogni
 * sezione si riconosce dalla forma, mai dal titolo; una forma che non torna si impagina come le altre pagine (`sezione`)
 * e nessun testo si perde. Il testo non si accorcia né si riscrive: i segnaposto («[C5: …]») restano com'è scritto.
 */

import { blocchi, conCaricamento, contenuto, gruppiDa, griglia, immagine, sezione, testoSolo, type Blocco } from './sitoLayout'
import { eIscrizione, esc, pulsanti, pulsantiDi } from './sitoHome'

/** I colori del design: dal giallo i recapiti, dalla chiara le righe di «Come arrivare», dal giallo i passi della prova. */
const RECAPITI = ['giallo', 'blu', 'inchiostro', 'chiara'] as const
const ARRIVI = ['chiara', 'giallo', 'blu'] as const
const PASSI = ['giallo', 'blu', 'inchiostro'] as const
/** Un numero di telefono esce grande (come nella pagina di prima). */
const VALORE_BREVE = 14
/** La mappa di `sito/risorse/mappa.webp`: le misure servono a non far saltare il layout. */
const MAPPA = { larghezza: 1344, altezza: 520 }

const primoH2 = (b: Blocco[]) => {
  const i = b.findIndex((x) => x.tag === 'h2')
  return i < 0 ? b.length : i
}

/** Vero se prima del primo `h2` c'è un pulsante verso il modulo online. */
export function eContattiNuova(testoPulito: string, iscrizione: string): boolean {
  const b = blocchi(testoPulito)
  return b.slice(0, primoH2(b)).some((x) => pulsantiDi(x)?.some((p) => eIscrizione(p.href, iscrizione)))
}

/** Un paragrafo fatto solo di un link: l'azione di una tessera. */
const soloLink = (b: Blocco) => b.tag === 'p' && /^<p[^>]*>\s*<a\b[^>]*>[\s\S]*?<\/a>\s*<\/p>$/i.test(b.html)

function recapito(g: { titolo: string; corpo: Blocco[] }, k: number): string {
  const paragrafi = g.corpo.filter((x) => x.tag === 'p')
  const valore = paragrafi[0]
  const ultimo = paragrafi[paragrafi.length - 1]
  const azione = paragrafi.length > 1 && soloLink(ultimo) ? ultimo : null
  const altri = g.corpo.filter((x) => x !== valore && x !== azione)
  const breve = valore && testoSolo(valore.html).length <= VALORE_BREVE ? ' breve' : ''
  return `<article class="tessera ${RECAPITI[k % RECAPITI.length]}${breve}"><h3>${g.titolo}</h3>${valore?.html ?? ''}${altri.map((x) => x.html).join('')}${azione ? `<div class="azione">${contenuto(azione)}</div>` : ''}</article>`
}

/** Il tag della mappa con le misure dell'immagine del sito. */
const conMisure = (tag: string) => conCaricamento(tag.replace(/\s*\/?>$/, ` width="${MAPPA.larghezza}" height="${MAPPA.altezza}">`), false)

/** «Come arrivare»: la mappa (con il pulsante delle indicazioni) e una riga per ogni modo di arrivare. */
function arrivare(titolo: string, corpo: Blocco[], nome: string, indirizzo: string): string | null {
  const iImg = corpo.findIndex((x) => immagine(x) !== null)
  const mappaTag = iImg < 0 ? null : immagine(corpo[iImg])
  const iH3 = corpo.findIndex((x) => x.tag === 'h3')
  if (!mappaTag || (iH3 >= 0 && iH3 < iImg) || !corpo.some((x) => pulsantiDi(x) !== null)) return null
  const dopo = corpo.slice(iImg + 1)
  const h3 = dopo.findIndex((x) => x.tag === 'h3')
  const tra = (h3 < 0 ? dopo : dopo.slice(0, h3)).filter((x) => pulsantiDi(x) === null)
  const bottoni = (h3 < 0 ? dopo : dopo.slice(0, h3)).flatMap((x) => pulsantiDi(x) ?? [])
  const righe = h3 < 0 ? [] : gruppiDa(dopo.slice(h3))
  const sigla = (t: string) => (testoSolo(t).split(/\s+/).pop()?.[0] ?? '').toUpperCase()
  const mappa = `<figure class="tessera foto larga mappa">${conMisure(mappaTag)}<span class="segnaposto" aria-hidden="true"></span><span class="targhetta">${esc(nome)}<span>${esc(indirizzo)}</span></span><span class="credito">© OpenStreetMap contributors</span>${bottoni.length ? `<div class="mappa-azioni"><a class="pulsante primario" href="${esc(bottoni[0].href)}"${/^https?:/i.test(bottoni[0].href) ? ' rel="noopener noreferrer"' : ''}>${bottoni[0].testo}</a></div>` : ''}</figure>`
  const colonna = corpo.slice(0, iImg).map((x) => x.html).join('')
  const lista = righe.map((g, k) => `<article class="tessera ${ARRIVI[k % ARRIVI.length]} arrivo-riga"><span class="sigla" aria-hidden="true">${sigla(g.titolo)}</span><h3>${g.titolo}</h3>${g.corpo.map((x) => x.html).join('')}</article>`).join('')
  return `<section class="sezione arrivare"><h2>${titolo}</h2>${colonna ? `<div class="colonna">${colonna}</div>` : ''}<div class="arrivo">${mappa}${lista ? `<div class="arrivi">${lista}</div>` : ''}</div>${tra.length ? `<div class="colonna">${tra.map((x) => x.html).join('')}</div>` : ''}</section>`
}

/** I tre passi della prova: tessere numerate; le foto che chiudono l'ultimo passo sono la fila sotto la sezione. */
function passi(titolo: string, corpo: Blocco[]): string | null {
  const primo = corpo.findIndex((x) => x.tag === 'h3')
  if (primo < 0 || !corpo.slice(0, primo).every((x) => x.tag === 'p')) return null
  const gruppi = gruppiDa(corpo.slice(primo))
  // Le foto che chiudono l'ultimo passo non sono sue: si contano prima, e si tolgono solo se la forma torna.
  const ultimo = gruppi[gruppi.length - 1]
  let k = ultimo.corpo.length
  while (k > 0 && immagine(ultimo.corpo[k - 1]) !== null) k--
  const foto = ultimo.corpo.slice(k).flatMap((x) => immagine(x) ?? [])
  const passiDi = [...gruppi.slice(0, -1), { ...ultimo, corpo: ultimo.corpo.slice(0, k) }]
  if (passiDi.length !== 3 || passiDi.some((g) => g.corpo.length !== 1 || g.corpo[0].tag !== 'p' || /\?\s*$/.test(testoSolo(g.titolo)))) return null
  const intro = corpo.slice(0, primo).map((x) => x.html).join('')
  const tessere = passiDi.map((g, k) => `<article class="tessera ${PASSI[k]}"><span class="numero-perche" aria-hidden="true">${k + 1}</span><h3>${g.titolo}</h3>${g.corpo[0].html}</article>`).join('')
  const fila = foto.length ? `<div class="foto-contatti n-${foto.length}">${foto.map((f) => `<figure>${conCaricamento(f, false)}</figure>`).join('')}</div>` : ''
  return `<section class="sezione"><h2>${titolo}</h2>${intro ? `<div class="colonna">${intro}</div>` : ''}${griglia(3, tessere, ' perche')}</section>${fila}`
}

/**
 * La pagina Contatti nuova: `bottoni` va nella testata della pagina (sotto la frase), `html` in `<main>` dopo il titolo.
 * `iscrizione` è l'indirizzo del modulo online; `nome` e `indirizzo` sono quelli della targhetta sulla mappa.
 */
export function contattiNuova(testoPulito: string, iscrizione: string, nome: string, indirizzo: string): { bottoni: string; html: string } {
  const b = blocchi(testoPulito)
  const fine = primoH2(b)
  const testa = b.slice(0, fine)
  // Solo il primo paragrafo di pulsanti va in testata: gli altri restano nel testo, niente si perde.
  const dei = testa.find((x) => pulsantiDi(x) !== null)
  const bottoni = dei ? pulsantiDi(dei) ?? [] : []
  const resto = testa.filter((x) => x !== dei)
  const iH3 = resto.findIndex((x) => x.tag === 'h3')
  const prima = iH3 < 0 ? resto : resto.slice(0, iH3)
  const gruppi = iH3 < 0 ? [] : gruppiDa(resto.slice(iH3))
  const recapiti = gruppi.length ? `<section class="recapiti-sez">${griglia(gruppi.length, gruppi.map(recapito).join(''), ' recapiti')}</section>` : ''
  const sezioni: string[] = []
  const titoli = b.map((x, i) => (x.tag === 'h2' ? i : -1)).filter((i) => i >= 0)
  titoli.forEach((i, k) => {
    const titolo = contenuto(b[i])
    const corpo = b.slice(i + 1, titoli[k + 1] ?? b.length)
    sezioni.push(arrivare(titolo, corpo, nome, indirizzo) ?? passi(titolo, corpo) ?? sezione(titolo, corpo))
  })
  return { bottoni: bottoni.length ? pulsanti(bottoni, iscrizione) : '', html: `${prima.length ? `<div class="testo">${prima.map((x) => x.html).join('')}</div>` : ''}${recapiti}${sezioni.join('')}` }
}
