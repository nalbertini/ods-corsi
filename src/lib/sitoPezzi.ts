import { conteggio, indirizzoValido, LIMITE_TITOLO, percorsoPagina, slugValido, testoTroppoLungo } from './sitoPagine'
import { ISCRIZIONE, chiama, whatsapp } from './sito'
import { pulisciTesto } from './sitoTesto'

/**
 * Una pagina del sito composta a pezzi: l'ordine e il contenuto che la
 * segreteria sceglie nell'editor (Puck). Il sito resta statico e fatto di testo:
 * i pezzi si salvano così come sono (`bozza_pezzi`, per riaprirli uguali) e
 * si traducono nel testo piatto di sempre (`pezziInHtml`), da cui il generatore
 * fa le tessere. Le regole stanno qui, non nella schermata, per provarle senza browser
 * (`scripts/prova-sito-pezzi.mjs`).
 */

export type Pezzo =
  | { type: 'fotoInCima'; props: { id: string; src: string; alt: string } }
  | { type: 'testo'; props: { id: string; html: string } }
  | { type: 'foto'; props: { id: string; src: string; alt: string } }
  | { type: 'colonne'; props: { id: string; colonne: Array<{ html: string }> } }
  // L'invito in fondo alla pagina (`invito` di sitoGenera.ts): titolo e frase vuoti sono quelli di sempre.
  | { type: 'iscriviti'; props: { id: string } & ParteIscriviti }
  | { type: 'pulsanti'; props: { id: string; pulsanti: Pulsante[] } }
  // Titolo vuoto: «Domande frequenti». Il titolo apre una sezione sua, così le domande non si mescolano coi sottotitoli di prima.
  | { type: 'domande'; props: { id: string; titolo: string; domande: Domanda[] } }
  // Un tecnico della pagina degli istruttori: `src` vuoto = senza foto, `pagina` = lo slug della sua scheda ('' = nessuna), `corsi` con le virgole.
  | { type: 'istruttore'; props: { id: string; nome: string; cognome: string; corsi: string; src: string; alt: string; pagina: string } }

/** Quel che la segreteria cambia dell'invito: il resto (indirizzo, numero, pulsanti, passi) è del sito. */
export type ParteIscriviti = { titolo: string; frase: string }

/** Dove porta un pulsante: il modulo, il telefono e WhatsApp sono quelli del sito, senza indirizzi da scrivere. */
export type DovePorta = 'modulo' | 'telefono' | 'whatsapp' | 'pagina' | 'altro'
const DOVE: readonly string[] = ['modulo', 'telefono', 'whatsapp', 'pagina', 'altro'] satisfies DovePorta[]
/** `indirizzo`: lo slug per 'pagina', l'indirizzo scritto per 'altro', vuoto per gli altri. */
export type Pulsante = { dove: DovePorta; testo: string; indirizzo: string }
/** La risposta è HTML: grassetto, corsivo, link ed elenchi. */
export type Domanda = { domanda: string; risposta: string }

/** Oltre tre pulsanti in fila, sul telefono, sono un muro. */
export const MASSIMO_PULSANTI = 3
export const MASSIMO_DOMANDE = 30

export interface PezziPagina {
  content: Pezzo[]
}

/** Quanti pezzi al massimo: oltre, la pagina non si legge più e il testo sfiora il limite del database. */
export const MASSIMO_PEZZI = 100
/** Il limite del database sul JSON dei pezzi (`supabase/62-sito-pezzi.sql`): oltre non si salva. */
export const MASSIMO_CARATTERI = 400000

/** Il nome di una parte nell'ELENCO, con le parole della segreteria. */
export const nomeParte = (p: Pezzo): string =>
  p.type === 'fotoInCima' ? 'Foto in cima' : p.type === 'testo' ? 'Testo' : p.type === 'foto' ? 'Foto' : p.type === 'iscriviti' ? 'Iscriviti' : p.type === 'pulsanti' ? 'Pulsanti' : p.type === 'domande' ? 'Domande' : p.type === 'istruttore' ? 'Istruttore' : p.props.colonne.length === 2 ? 'Due colonne' : 'Tre colonne'

/** Cosa dice il pannello delle impostazioni finché nessuna parte è scelta. */
export const FRASE_NESSUNA_PARTE = 'Tocca una parte della pagina per cambiarne le impostazioni.'

export const pezziVuoti = (): PezziPagina => ({ content: [] })

/** L'unica pagina dove si mette la parte ISTRUTTORE: le sue parti diventano le tessere (`elencoIstruttori` di sitoIstruttori.ts). */
export const PAGINA_ISTRUTTORI = 'istruttori'

/**
 * La parte ISTRUTTORE si mette solo nella pagina degli istruttori: altrove non diventa tessera e confonde.
 * Una pagina di legge è solo testo: il sito non le dà invito, foto in cima né tessere.
 */
export const parteAmmessa = (tipo: string, slug: string, diLegge = false): boolean => (diLegge ? tipo === 'testo' : tipo !== 'istruttore' || slug === PAGINA_ISTRUTTORI)

/** Le pagine fra cui scegliere quella di un istruttore: non la Home (è «/»), non Istruttori stessa, non quelle di legge. */
export const pagineIstruttore = <P extends { slug: string; diLegge: boolean }>(pagine: ReadonlyArray<P>): P[] => pagine.filter((p) => !p.diLegge && p.slug !== 'home' && p.slug !== PAGINA_ISTRUTTORI)

/** I corsi di un istruttore, dal testo con le virgole: gli stessi nell'editor e sul sito. */
export const corsiDa = (testo: string): string[] => testo.split(',').map((c) => c.trim()).filter(Boolean)

/**
 * Sul sito le tessere sono gli istruttori di fila dall'inizio del testo: una parte prima di uno di loro (testo, foto, colonne)
 * chiude la griglia lì, e chi viene dopo esce come testo. ISCRIVITI no: il sito la toglie dal testo prima di guardarlo.
 */
export function avvisoIstruttori(pezzi: ConTipo, indice: number): string | null {
  const p = pezzi[indice]
  if (!p || p.type === 'istruttore' || p.type === 'iscriviti') return null
  return pezzi.slice(indice + 1).some((x) => x.type === 'istruttore') ? 'Gli istruttori dopo questa parte non sono in tessere: spostala sotto l’ultimo istruttore.' : null
}

/** Cosa dire sotto la pagina scelta per un istruttore: il nome è un link solo verso una pagina pubblicata (`nomeELink`). */
export function notaPaginaIstruttore(slug: string, pagine: ReadonlyArray<{ slug: string; pubblicato: string | null; nascosta: boolean }>): string | null {
  if (slug === '') return null
  const p = pagine.find((x) => x.slug === slug)
  if (!p) return 'Questa pagina non c’è più: scegline un’altra.'
  return p.pubblicato === null || p.nascosta ? 'Non è pubblicata: il nome sarà un link quando la pubblichi.' : null
}

/** Basta il tipo: i dati di Puck danno `type: string`, e queste regole non leggono altro. */
type ConTipo = ReadonlyArray<{ type: string }>

/** La pagina ha già la parte ISCRIVITI: un'altra non si mette. */
export const conIscriviti = (pezzi: ConTipo): boolean => pezzi.some((p) => p.type === 'iscriviti')

/** Perché il tasto + PARTE è spento, a parole; `null` se si può mettere. */
export function motivoSpento(tipo: Pezzo['type'], pezzi: ConTipo): string | null {
  if (pezzi.length >= MASSIMO_PEZZI) return `La pagina ha già ${MASSIMO_PEZZI} parti, il massimo`
  if (tipo === 'iscriviti' && conIscriviti(pezzi)) return 'C’è già: una parte Iscriviti per pagina'
  return null
}

export const puoMettere = (tipo: Pezzo['type'], pezzi: ConTipo): boolean => motivoSpento(tipo, pezzi) === null

/** SU (-1) e GIÙ (+1): dentro la pagina, e mai con ISCRIVITI, che sta ferma in fondo. */
export function spostabile(pezzi: ConTipo, indice: number, verso: -1 | 1): boolean {
  const altro = indice + verso
  if (indice < 0 || altro < 0 || altro >= pezzi.length) return false
  return pezzi[indice].type !== 'iscriviti' && pezzi[altro].type !== 'iscriviti'
}

/**
 * Dove va una parte nuova: dopo quella scelta (`dopo`, l'indice) o in fondo. ISCRIVITI va sempre in fondo, e
 * nessuna parte le va dopo: sul sito è l'invito che chiude la pagina.
 */
export function doveMettere(tipo: Pezzo['type'], dopo: number | null, pezzi: ConTipo): number {
  if (tipo === 'iscriviti') return pezzi.length
  const dove = dopo === null ? pezzi.length : dopo + 1
  return conIscriviti(pezzi) ? Math.min(dove, pezzi.length - 1) : dove
}

const stringa = (x: unknown): x is string => typeof x === 'string'
const oggetto = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x)

/** Un indirizzo vuoto è ammesso (il pulsante non esce); uno scritto deve andare, come quello del tasto PULSANTE. */
const indirizzoAmmesso = (dove: string, indirizzo: string) =>
  indirizzo === '' || (dove === 'pagina' ? slugValido(indirizzo) : dove !== 'altro' || indirizzoValido(indirizzo))

function pezzoValido(x: unknown): x is Pezzo {
  if (!oggetto(x) || !oggetto(x.props) || !stringa(x.props.id) || x.props.id === '') return false
  const p = x.props
  switch (x.type) {
    case 'testo':
      return stringa(p.html)
    case 'foto':
    case 'fotoInCima':
      return stringa(p.src) && p.src !== '' && stringa(p.alt)
    case 'iscriviti':
      return stringa(p.titolo) && stringa(p.frase)
    case 'istruttore':
      // `pagina` finisce in un href: solo un indirizzo del sito (`/slug/`), mai un altro dominio.
      return stringa(p.nome) && p.nome.trim() !== '' && [p.cognome, p.corsi, p.src, p.alt].every(stringa) && stringa(p.pagina) && /^[a-z0-9-]*$/.test(p.pagina)
    case 'colonne':
      return Array.isArray(p.colonne) && p.colonne.length >= 2 && p.colonne.length <= 3 && p.colonne.every((c) => oggetto(c) && stringa(c.html))
    case 'pulsanti':
      return Array.isArray(p.pulsanti) && p.pulsanti.length >= 1 && p.pulsanti.length <= MASSIMO_PULSANTI && p.pulsanti.every((b) => oggetto(b) && stringa(b.dove) && DOVE.includes(b.dove) && stringa(b.testo) && stringa(b.indirizzo) && indirizzoAmmesso(b.dove, b.indirizzo))
    case 'domande':
      return stringa(p.titolo) && Array.isArray(p.domande) && p.domande.length <= MASSIMO_DOMANDE && p.domande.every((d) => oggetto(d) && stringa(d.domanda) && stringa(d.risposta))
    default:
      return false
  }
}

/** Vero solo per pezzi fatti come li sa leggere il sito; tutto il resto (anche JSON arrivato da fuori) è falso. */
export function pezziValidi(x: unknown): x is PezziPagina {
  if (!oggetto(x) || !Array.isArray(x.content) || x.content.length > MASSIMO_PEZZI) return false
  if (!x.content.every(pezzoValido)) return false
  if (JSON.stringify(x).length > MASSIMO_CARATTERI) return false
  const pezzi = x.content as Pezzo[]
  if (new Set(pezzi.map((p) => p.props.id)).size !== pezzi.length) return false
  const incima = pezzi.flatMap((p, i) => (p.type === 'fotoInCima' ? [i] : []))
  const iscriviti = pezzi.flatMap((p, i) => (p.type === 'iscriviti' ? [i] : []))
  if (iscriviti.length > 1 || (iscriviti.length === 1 && iscriviti[0] !== pezzi.length - 1)) return false
  return incima.length === 0 || (incima.length === 1 && incima[0] === 0)
}

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/'/g, '&#39;')

/** Senza testo e senza foto. Accetta anche `undefined`: Puck può dare una colonna appena aggiunta senza `html`. */
export const vuoto = (html: string | undefined) => !html || (!/<img\b/i.test(html) && html.replace(/<[^>]*>/g, '').trim() === '')

/** Il vero indirizzo di un pulsante; vuoto se non porta da nessuna parte (allora non esce). */
function hrefDi(b: Pulsante): string {
  if (b.dove === 'modulo') return ISCRIZIONE
  if (b.dove === 'telefono') return chiama
  if (b.dove === 'whatsapp') return whatsapp
  if (b.dove === 'pagina') return b.indirizzo ? percorsoPagina(b.indirizzo) : ''
  return b.indirizzo
}

/**
 * I pulsanti dopo una modifica, coi loro indirizzi: dove «Dove porta» è cambiato, l'indirizzo di prima non vale più
 * (lo slug di una pagina non è un «altro indirizzo», e viceversa) e resterebbe a bloccare il salvataggio senza vedersi.
 */
export const conIndirizziGiusti = (prima: readonly Pulsante[], dopo: Pulsante[]): Pulsante[] =>
  dopo.map((b, i) => (prima[i] && prima[i].dove !== b.dove && b.indirizzo !== '' ? { ...b, indirizzo: '' } : b))

/** Vero per una domanda scritta che non finisce con «?»: sul sito le domande della parte non escono come domande. */
export const senzaPunto = (domanda: string): boolean => domanda.trim() !== '' && !domanda.trim().endsWith('?')

/** Le pagine verso cui può portare un pulsante: pubblicate e non nascoste. Contatti no: sul sito un pulsante verso Contatti non esce (`senzaPulsantiContatti`). */
export const pagineDaPulsante = <P extends { slug: string; titolo: string; pubblicato: string | null; nascosta: boolean }>(pagine: P[]): Array<{ slug: string; titolo: string }> =>
  pagine.filter((p) => p.pubblicato !== null && !p.nascosta && p.slug !== 'contatti').map((p) => ({ slug: p.slug, titolo: p.titolo }))

/** Cosa nasce quando la segreteria aggiunge una colonna: vuota, ma con il suo `html` (il campo array di Puck non ne mette uno da solo). */
export const colonnaNuova = (): { html: string } => ({ html: '' })

/**
 * Il pezzo con il testo scritto nella pagina: il testo di un TESTO, o quello della colonna `colonna` di COLONNE.
 * Non cambia mai il pezzo ricevuto; per una foto o una colonna che non c'è lo restituisce com'è, così nessuna
 * scrittura finisce nel posto sbagliato.
 */
export function scriviTesto(p: Pezzo, html: string, colonna = 0): Pezzo {
  if (p.type === 'testo') return { ...p, props: { ...p.props, html } }
  if (p.type === 'colonne' && colonna >= 0 && colonna < p.props.colonne.length) {
    return { ...p, props: { ...p.props, colonne: p.props.colonne.map((c, i) => (i === colonna ? { html } : c)) } }
  }
  return p
}

/** La pagina con il testo scritto nel pezzo `id` (e nella colonna `colonna`): quello che si salva senza aspettare Puck. Un pezzo che non c'è lascia la pagina com'è. */
export function conTestoScritto(pagina: PezziPagina, id: string, html: string, colonna = 0): PezziPagina {
  const i = pagina.content.findIndex((p) => p.props.id === id)
  if (i < 0) return pagina
  return { content: pagina.content.map((p, k) => (k === i ? scriviTesto(p, html, colonna) : p)) }
}

/** Cosa fa un tasto premuto dentro il testo: annulla o rifai di Puck (Cmd o Ctrl con Z, Maiusc+Z, Y), altrimenti `null`: il tasto è del testo. */
export function versoStoria(tasto: string, conMeta: boolean, conMaiusc: boolean, conAlt: boolean): 'indietro' | 'avanti' | null {
  if (!conMeta || conAlt) return null
  const k = tasto.toLowerCase()
  if (k === 'y') return 'avanti'
  if (k === 'z') return conMaiusc ? 'avanti' : 'indietro'
  return null
}

/** La parte scelta dopo ANNULLA o RIFAI: la stessa di prima se c'è ancora, se no nessuna (Puck riporta la scelta di allora). */
export const selezioneDopoStoria = <S extends { index: number }>(scelto: S | null, quanti: number): S | null => (scelto && scelto.index < quanti ? scelto : null)

/** Dopo quanto Puck ha registrato nella storia l'ultima scrittura (lui aspetta 250ms dall'ultima: qui un po' di più). */
export const FINESTRA_STORIA_MS = 300

/** Quanto aspettare prima di annullare o rifare, perché l'ultima scrittura (all'istante `ultima`, 0 se mai) sia già nella storia di Puck. */
export const attesaStoria = (ultima: number, ora: number): number => (ultima === 0 ? 0 : Math.max(0, FINESTRA_STORIA_MS - (ora - ultima)))

function inHtml(p: Pezzo): string {
  switch (p.type) {
    case 'testo':
      return p.props.html
    case 'foto':
    case 'fotoInCima':
      return `<img src="${esc(p.props.src)}" alt="${esc(p.props.alt)}">`
    case 'colonne': {
      // Una colonna lasciata vuota non deve restare sul sito come un buco: l'editor di testo vuoto dà «<p></p>».
      const piene = p.props.colonne.filter((c) => !vuoto(c.html))
      if (piene.length < 2) return piene[0]?.html ?? ''
      return `<div class="colonne c-${piene.length}">${piene.map((c) => `<div class="colonna">${c.html}</div>`).join('')}</div>`
    }
    case 'istruttore': {
      // La forma che legge `elencoIstruttori`: h3 col nome, la foto, «Cognome · corso, corso». Il «·» c'è sempre coi corsi,
      // se no un corso solo senza cognome sarebbe letto come cognome.
      const { nome, cognome, corsi, src, alt, pagina } = p.props
      const elenco = corsiDa(corsi).join(', ')
      const riga = elenco ? `${cognome.trim()} · ${elenco}`.trim() : cognome.trim()
      const n = esc(nome.trim())
      return `<h3>${pagina ? `<a href="/${esc(pagina)}/">${n}</a>` : n}</h3>${src ? `<img src="${esc(src)}" alt="${esc(alt)}">` : ''}${riga ? `<p>${esc(riga)}</p>` : ''}`
    }
    case 'iscriviti':
      return `<div class="iscriviti">${p.props.titolo ? `<h2>${esc(p.props.titolo)}</h2>` : ''}${p.props.frase ? `<p>${esc(p.props.frase)}</p>` : ''}</div>`
    case 'pulsanti': {
      // Il riquadro suo, come ISCRIVITI: il generatore lo disegna sempre con «Iscriviti» per primo e non cambia l'impaginazione.
      const fuori = p.props.pulsanti.flatMap((b) => {
        const href = hrefDi(b)
        const testo = b.dove === 'modulo' ? 'Iscriviti' : b.testo.trim()
        return href && testo ? [`<a class="pulsante" href="${esc(href)}">${esc(testo)}</a>`] : []
      })
      return fuori.length ? `<div class="pulsanti">${fuori.join('')}</div>` : ''
    }
    case 'domande': {
      // Un titolo scritto nella risposta aprirebbe un'altra domanda o sezione: resta un paragrafo.
      const coppie = p.props.domande.filter((d) => d.domanda.trim() !== '' && !vuoto(d.risposta))
      if (!coppie.length) return ''
      const risposta = (h: string) => h.replace(/<(\/?)h[1-6]\b[^>]*>/gi, '<$1p>')
      return `<h2>${esc(p.props.titolo.trim() || 'Domande frequenti')}</h2>${coppie.map((d) => `<h3>${esc(d.domanda.trim())}</h3>${risposta(d.risposta)}`).join('')}`
    }
  }
}

/** Il testo piatto della pagina, già ripulito: quello che si salva come bozza e che il sito pubblica. */
export const pezziInHtml = (p: PezziPagina): string => pulisciTesto(p.content.map(inHtml).join(''))

/** Perché i pezzi non vanno, a parole e una causa per volta; `null` se vanno. Chi legge sa cosa fare. */
export function cosaNonVaPezzi(x: unknown): string | null {
  if (pezziValidi(x)) return null
  if (oggetto(x) && Array.isArray(x.content)) {
    const parti = x.content.filter(oggetto)
    if (x.content.length > MASSIMO_PEZZI) return `La pagina ha troppe parti: al massimo ${MASSIMO_PEZZI}`
    const incima = parti.filter((p) => p.type === 'fotoInCima')
    if (incima.length > 1 || (incima.length === 1 && x.content[0] !== incima[0])) return 'La foto in cima è una sola e sta in alto'
    const iscriviti = parti.filter((p) => p.type === 'iscriviti')
    if (iscriviti.length > 1 || (iscriviti.length === 1 && x.content[x.content.length - 1] !== iscriviti[0])) return 'La parte Iscriviti è una sola e sta in fondo alla pagina'
    const foto = parti.filter((p) => (p.type === 'foto' || p.type === 'fotoInCima') && oggetto(p.props))
    if (foto.some((p) => !stringa((p.props as Record<string, unknown>).src) || (p.props as Record<string, unknown>).src === '')) return 'Ogni foto ha bisogno della sua immagine: scegline una o togli la foto'
    if (parti.some((p) => p.type === 'istruttore' && oggetto(p.props) && (!stringa(p.props.nome) || p.props.nome.trim() === ''))) return 'Ogni istruttore ha bisogno del nome: scrivilo o togli la parte'
    const colonne = parti.filter((p) => p.type === 'colonne' && oggetto(p.props) && Array.isArray((p.props as Record<string, unknown>).colonne))
    if (colonne.some((p) => { const n = ((p.props as Record<string, unknown>).colonne as unknown[]).length; return n < 2 || n > 3 })) return 'Le colonne sono due o tre'
    const pulsanti = parti.flatMap((p) => (p.type === 'pulsanti' && oggetto(p.props) && Array.isArray(p.props.pulsanti) ? p.props.pulsanti.filter(oggetto) : []))
    if (pulsanti.some((b) => stringa(b.dove) && stringa(b.indirizzo) && !indirizzoAmmesso(b.dove, b.indirizzo))) return 'Un pulsante porta a un indirizzo che non va: scrivi un indirizzo che cominci con https://, mailto:, tel: oppure /, senza spazi'
    if (JSON.stringify(x).length > MASSIMO_CARATTERI) return 'La pagina è troppo lunga: togli qualcosa'
  }
  return 'La pagina non è fatta come il sito la vuole: ricaricala e riprova'
}

/** I pezzi di ora sono diversi da quelli salvati (anche solo nell'ordine). */
// Il database (jsonb) rimette le chiavi in un altro ordine: i pezzi appena salvati, riletti, non sono una modifica.
const chiaviInOrdine = (_: string, v: unknown) => (oggetto(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : 1))) : v)
export const pezziCambiati = (locali: PezziPagina, salvati: PezziPagina | null | undefined): boolean => JSON.stringify(locali, chiaviInOrdine) !== JSON.stringify(salvati, chiaviInOrdine)

/**
 * Il database sa i pezzi (c'è `62-sito-pezzi.sql`) se almeno una pagina arriva col campo, anche vuoto (`null`):
 * senza il file la colonna non c'è e nessuna pagina lo porta. Con nessuna pagina non si sa, e vale «no».
 */
export const databaseConPezzi = (pagine: ReadonlyArray<{ pezzi?: PezziPagina | null }>): boolean => pagine.some((p) => p.pezzi !== undefined)

const disesc = (t: string) => t.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
const attributo = (tag: string, nome: string) => {
  const m = new RegExp(`\\b${nome}\\s*=\\s*"([^"]*)"`, 'i').exec(tag)
  return m ? disesc(m[1]) : null
}

/** I `div` di primo livello di `html` che hanno una delle classi, con il loro contenuto: serve a spezzare il testo senza DOM. */
function divDi(html: string, classe: RegExp): Array<{ da: number; a: number; dentro: string }> {
  const trovati: Array<{ da: number; a: number; dentro: string }> = []
  let profondita = 0
  let aperto: { da: number; apertura: number } | null = null
  for (const m of html.matchAll(/<(\/?)div\b[^>]*>/gi)) {
    const fine = m.index + m[0].length
    if (m[1]) {
      if (profondita > 0 && --profondita === 0 && aperto) {
        trovati.push({ da: aperto.da, a: fine, dentro: html.slice(aperto.apertura, m.index) })
        aperto = null
      }
    } else if (profondita++ === 0 && classe.test(m[0])) aperto = { da: m.index, apertura: fine }
  }
  return trovati
}

/** Tutto il testo in un pezzo solo: quando dividerlo rischierebbe di cambiare quello che c'è scritto. */
const unico = (t: string): PezziPagina => ({ content: [{ type: 'testo', props: { id: 'p1', html: t } }] })

const TAG = /<(\/?)([a-z][a-z0-9]*)\b[^>]*?(\/?)>/gi
const SENZA_CHIUSURA = new Set(['img', 'br', 'hr'])

type Segmento = { html: string } | { foto: { src: string; alt: string } }

/**
 * Taglia un testo piatto solo a livello più alto, mai dentro un elenco o un paragrafo: un titolo `<h2>` apre un pezzo
 * di testo, un'immagine rifatta uguale dall'editor è una foto. Il resto resta com'è, così il testo non cambia.
 */
function spezzaTesto(t: string): Segmento[] {
  const segmenti: Segmento[] = []
  const testo = (h: string) => {
    if (h !== '') segmenti.push({ html: h })
  }
  let profondita = 0
  let inizio = 0
  for (const m of t.matchAll(TAG)) {
    const nome = m[2].toLowerCase()
    if (m[1]) {
      profondita = Math.max(0, profondita - 1)
      continue
    }
    // Un titolo vuoto non apre una parte: resta nel testo che c'è.
    if (profondita === 0 && nome === 'h2' && !/^<h2\b[^>]*>\s*<\/h2>/i.test(t.slice(m.index))) {
      testo(t.slice(inizio, m.index))
      inizio = m.index
    } else if (profondita === 0 && nome === 'img') {
      const src = attributo(m[0], 'src')
      const alt = attributo(m[0], 'alt')
      // Un'immagine che l'editor non riscrive uguale (altri attributi, niente `alt`) resta nel testo.
      if (src && alt !== null && pulisciTesto(inHtml({ type: 'foto', props: { id: 'x', src, alt } })) === m[0]) {
        testo(t.slice(inizio, m.index))
        segmenti.push({ foto: { src, alt } })
        inizio = m.index + m[0].length
      }
    }
    if (!SENZA_CHIUSURA.has(nome) && !m[3]) profondita++
  }
  testo(t.slice(inizio))
  return segmenti
}

/**
 * La parte ISCRIVITI in fondo al testo piatto, com'è scritta da `pezziInHtml`, e il testo che resta prima.
 * Solo in fondo e solo in quella forma: un `div` così in mezzo alla pagina non è la parte, e resta testo.
 */
export function parteIscriviti(html: string): { resto: string; parte: ParteIscriviti | null } {
  const m = /<div class="iscriviti">(?:<h2>([^<]*)<\/h2>)?(?:<p>([^<]*)<\/p>)?<\/div>$/.exec(html)
  return m ? { resto: html.slice(0, m.index), parte: { titolo: disesc(m[1] ?? ''), frase: disesc(m[2] ?? '') } } : { resto: html, parte: null }
}

/**
 * Il testo piatto di una pagina vecchia, spezzato nei pezzi dell'editor: foto iniziale, colonne, foto tra i
 * paragrafi, testo che comincia a ogni titolo. Non si fida di sé: se i pezzi non rifanno esattamente il testo
 * (`pezziInHtml`), la pagina resta un solo pezzo di testo, così aprire nell'editor una pagina scritta col testo solo non cambia mai quello che c'è scritto.
 */
export function htmlInPezzi(html: string): PezziPagina {
  const t = pulisciTesto(html)
  if (t.trim() === '') return pezziVuoti()
  const { resto, parte } = parteIscriviti(t)
  const pezzi: Pezzo[] = []
  const id = () => `p${pezzi.length + 1}`
  const testo = (h: string) => {
    // Un `<p></p>` non è una parte: si unisce al testo prima, o a quello dopo; solo se non ne ha (dopo una foto, in fondo) resta da solo.
    let vuotoInAttesa = ''
    const scarica = () => {
      if (vuotoInAttesa !== '') pezzi.push({ type: 'testo', props: { id: id(), html: vuotoInAttesa } })
      vuotoInAttesa = ''
    }
    for (const s of spezzaTesto(h)) {
      const prima = pezzi[pezzi.length - 1]
      if ('foto' in s) {
        scarica()
        pezzi.push({ type: 'foto', props: { id: id(), ...s.foto } })
      } else if (vuoto(s.html) && prima?.type === 'testo') prima.props.html += s.html
      else if (vuoto(s.html)) vuotoInAttesa += s.html
      else {
        pezzi.push({ type: 'testo', props: { id: id(), html: vuotoInAttesa + s.html } })
        vuotoInAttesa = ''
      }
    }
    scarica()
  }
  let da = 0
  for (const b of divDi(resto, /\bcolonne\b/)) {
    testo(resto.slice(da, b.da))
    const colonne = divDi(b.dentro, /\bcolonna\b/).map((c) => ({ html: c.dentro }))
    // Colonne dentro una colonna non si riaprono nell'editor: si lasciano come testo.
    if (colonne.some((c) => /<div\b/i.test(c.html))) return unico(t)
    pezzi.push({ type: 'colonne', props: { id: id(), colonne } })
    da = b.a
  }
  testo(resto.slice(da))
  if (parte) pezzi.push({ type: 'iscriviti', props: { id: id(), ...parte } })
  const primo = pezzi[0]
  if (primo?.type === 'foto') pezzi[0] = { type: 'fotoInCima', props: { ...primo.props, id: 'p0' } }
  const candidato: PezziPagina = { content: pezzi }
  // Con troppe parti `pezziValidi` è falso: non si accorpa, `cosaNonVaPortare` avvisa e la segreteria toglie qualcosa.
  return (pezziValidi(candidato) || pezzi.length > MASSIMO_PEZZI) && pezziInHtml(candidato) === t ? candidato : unico(t)
}

/**
 * Il tasto «Dividi in parti»: ogni TESTO di una pagina già a pezzi si divide come `htmlInPezzi` divide una pagina vecchia
 * (un titolo apre una parte, una foto tra i paragrafi è una FOTO). Foto, foto in cima e colonne restano dove sono; un testo che
 * non si divide, o che conterrebbe colonne, resta com'è. Se il testo ricomposto cambiasse, la pagina resta quella di prima.
 * Oltre `MASSIMO_PEZZI` il risultato resta com'è: lo mostra l'avviso di `cosaNonVaPezzi`, e la schermata non lo applica.
 */
export function dividiInParti(p: PezziPagina): PezziPagina {
  const usati = new Set(p.content.map((x) => x.props.id))
  let n = Math.max(0, ...p.content.map((x) => Number(/^p(\d+)$/.exec(x.props.id)?.[1] ?? 0)))
  const idNuovo = () => {
    do n++
    while (usati.has(`p${n}`))
    usati.add(`p${n}`)
    return `p${n}`
  }
  const content = p.content.flatMap((x): Pezzo[] => {
    if (x.type !== 'testo') return [x]
    const parti = htmlInPezzi(x.props.html).content
    if (parti.length < 2 || parti.some((q) => q.type === 'colonne' || q.type === 'iscriviti')) return [x]
    return parti.flatMap((q, i): Pezzo[] => {
      if (q.type !== 'testo' && q.type !== 'foto' && q.type !== 'fotoInCima') return [] // già escluso sopra, o mai dato da `htmlInPezzi`: serve solo a restringere il tipo
      // La prima parte tiene l'id del testo; la foto in cima di una divisione è una foto qualunque: in cima ce n'è una sola.
      const id = i === 0 && q.type === 'testo' ? x.props.id : idNuovo()
      return [q.type === 'testo' ? { type: 'testo', props: { id, html: q.props.html } } : { type: 'foto', props: { id, src: q.props.src, alt: q.props.alt } }]
    })
  })
  const nuova: PezziPagina = { content }
  return (content.length > MASSIMO_PEZZI || pezziValidi(nuova)) && pezziInHtml(nuova) === pezziInHtml(p) ? nuova : p
}

/** Il tasto «Dividi in parti» c'è solo se dividere dà più parti di adesso. */
export const divisibileInParti = (p: PezziPagina): boolean => dividiInParti(p).content.length > p.content.length

/** Cosa dice la pagina subito dopo la divisione: quante parti ci sono e come tenerle o scartarle. */
export const frasePartiNuove = (n: number): string => `Ora ci sono ${n} parti, nell'ELENCO. Il testo è lo stesso. Per tenerle premi SALVA BOZZA; per lasciare tutto com'era, premi TUTTE LE PAGINE e scegli TORNA ALLE PAGINE.`

/**
 * L'editor (Puck, `EditorPuck.tsx`) apre ogni pagina a pezzi: quelle scritte col testo solo si dividono
 * col testo identico (`htmlInPezzi`), ma sul database restano com'erano finché non si salva.
 */
export const pezziDaAprire = (p: { bozza: string; pezzi?: PezziPagina | null; diLegge?: boolean }): PezziPagina =>
  // Una pagina di legge ammette solo il Testo (`parteAmmessa`): resta un testo solo, foto e colonne comprese.
  p.pezzi ?? (p.diLegge ? { content: [{ type: 'testo', props: { id: 'p1', html: pulisciTesto(p.bozza) } }] } : htmlInPezzi(p.bozza))

/** Salvata a parti, una pagina scritta col testo solo resta a parti per sempre: la prima volta si chiede. */
export const salvaAParti = (p: { pezzi?: PezziPagina | null }): boolean => p.pezzi === null

/** Quel che l'editor salva: titolo, descrizione e pezzi. */
export interface BozzaPezzi {
  titolo: string
  descrizione: string
  pezzi: PezziPagina
}

/** C'è da salvare: aprire e richiudere una pagina, anche scritta col testo solo, non lo è. */
export const daSalvare = (p: { titolo: string; descrizione: string; bozza: string; pezzi?: PezziPagina | null; diLegge?: boolean }, b: BozzaPezzi): boolean =>
  b.titolo.trim() !== p.titolo || b.descrizione.trim() !== p.descrizione || pezziCambiati(b.pezzi, pezziDaAprire(p))

/** Perché non si può salvare, per chi scrive; `null` se si può. Le stesse regole del database. */
export function cosaNonVaSalvare(b: BozzaPezzi): string | null {
  if (!b.titolo.trim()) return 'Scrivi il titolo della pagina'
  return cosaNonVaPezzi(b.pezzi) ?? testoTroppoLungo(pezziInHtml(b.pezzi))
}

/** Perché non si può pubblicare; `null` se si può. Quel che ferma Salva bozza, e il titolo oltre il limite di Google. */
export function cosaNonVaPubblicare(b: BozzaPezzi): string | null {
  const { n, troppo } = conteggio(b.titolo.trim(), LIMITE_TITOLO)
  return cosaNonVaSalvare(b) ?? (troppo ? `Accorcia il titolo: per pubblicare al massimo ${LIMITE_TITOLO} lettere (ora ${n})` : null)
}

/** Senza `62-sito-pezzi.sql` (`databaseConPezzi` falso) le pagine non si aprono per scrivere: l'unico editor salva a pezzi. */
export const FRASE_SENZA_PEZZI = 'Le pagine non si possono scrivere: il database non è ancora aggiornato. Chiedi a chi cura l’app.'

/**
 * Le opzioni del testo nell'editor (campo `richtext` di Puck): solo quel che il sito tiene (`pulisciTesto`).
 * Sottolineato, barrato, codice, righe e allineamenti sparirebbero pubblicando; dei titoli, Titolo (h2) e Sottotitolo (h3).
 */
export const TESTO_DEL_SITO: { underline: false; strike: false; code: false; codeBlock: false; horizontalRule: false; textAlign: false; link: false; heading: { levels: Array<2 | 3> } } = {
  underline: false, strike: false, code: false, codeBlock: false, horizontalRule: false, textAlign: false, heading: { levels: [2, 3] },
  // Il link di Puck apre in un'altra scheda: al suo posto quello di `sitoTiptap.ts`.
  link: false,
}
