import { pulisciTesto } from './sitoTesto'
import type { PezziPagina } from './sitoPezzi'

/**
 * Le pagine del sito della palestra: indirizzo, stato fra bozza e pubblicato,
 * menu e footer. Le regole stanno qui e non nella schermata perché si provano
 * senza browser (`scripts/prova-sito.mjs`); le stesse le fa rispettare il
 * database (`supabase/56-sito.sql`).
 */

// I limiti che Google mostra, non quelli del database (120 e 300): oltre si avvisa, e il titolo blocca PUBBLICA.
export const LIMITE_TITOLO = 60
export const LIMITE_DESCRIZIONE = 160
/** I limiti del database (`sito_pagine`): oltre non si salva. */
export const MASSIMO_TITOLO = 120
export const MASSIMO_DESCRIZIONE = 300
const LIMITE_INDIRIZZO = 80

/** Indirizzi che il sito usa per sé: una pagina nuova non li può prendere. */
// Gli stessi di `supabase/56-sito.sql` (vincolo `slug` di `sito_pagine`).
const RISERVATI = ['contact', 'contattaci', 'privacy', 'cookie', 'admin', 'api', 'app', 'sitemap', 'robots']

export interface PaginaSito {
  id: string
  slug: string
  titolo: string
  descrizione: string
  bozza: string
  /** I pezzi della bozza: `null` = pagina col vecchio editor di testo; `undefined` = il database non ha ancora `62-sito-pezzi.sql`. */
  pezzi?: PezziPagina | null
  /** Vuoto finché non si pubblica la prima volta. */
  pubblicato: string | null
  /** Titolo e descrizione che il sito mostra: cambiano solo con PUBBLICA, come il testo. */
  titoloPubblicato?: string | null
  descrizionePubblicata?: string | null
  nascosta: boolean
  diLegge: boolean
  /** Sale a ogni salvataggio: chi salva con una versione vecchia viene fermato. */
  versione: number
  pubblicataIl?: string
}

export interface VoceMenu {
  etichetta: string
  paginaId: string | null
  indirizzo: string | null
}

/** L'indirizzo proposto per un titolo: minuscolo, senza accenti, con i trattini. */
export function slugDaTitolo(titolo: string): string {
  return titolo
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** La forma di un indirizzo (minuscole, numeri e trattini, al massimo 80 lettere): quella che il sito e il database ammettono, senza guardare i riservati. */
export const slugValido = (s: string) => s.length > 0 && s.length <= LIMITE_INDIRIZZO && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(s)

/** Cosa non va in un indirizzo, a parole; `null` se va bene. `altri` sono gli indirizzi delle altre pagine. */
export function controllaSlug(slug: string, altri: string[]): string | null {
  if (!slug) return 'Scrivi l’indirizzo della pagina'
  if (slug.length > LIMITE_INDIRIZZO) return `L’indirizzo è troppo lungo: al massimo ${LIMITE_INDIRIZZO} lettere`
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return 'L’indirizzo può avere solo lettere minuscole senza accenti, numeri e trattini, e non può cominciare o finire con un trattino'
  if (RISERVATI.includes(slug)) return 'Questo indirizzo serve al sito: scegline un altro'
  if (altri.includes(slug)) return 'Questo indirizzo è già di un’altra pagina'
  return null
}

export function conteggio(testo: string, limite: number): { n: number; troppo: boolean } {
  const n = [...testo].length
  return { n, troppo: n > limite }
}

export type StatoPagina = 'pubblicata' | 'modificata' | 'solo-bozza' | 'nascosta'

export function statoPagina(p: Pick<PaginaSito, 'nascosta' | 'bozza' | 'pubblicato'> & Partial<Pick<PaginaSito, 'titolo' | 'titoloPubblicato' | 'descrizione' | 'descrizionePubblicata'>>): StatoPagina {
  if (p.nascosta) return 'nascosta'
  if (p.pubblicato === null) return 'solo-bozza'
  // Anche titolo e descrizione: cambiarne solo uno è una modifica da pubblicare.
  const titoloUguale = p.titolo === undefined || p.titoloPubblicato === undefined || p.titolo === p.titoloPubblicato
  const descrizioneUguale = p.descrizione === undefined || p.descrizionePubblicata === undefined || p.descrizione === p.descrizionePubblicata
  return p.bozza === p.pubblicato && titoloUguale && descrizioneUguale ? 'pubblicata' : 'modificata'
}

/**
 * Se il testo dell'editor è diverso da quello salvato. L'editor e la pulizia
 * scrivono lo stesso testo in modi diversi («<br>» e «<br />»): si confronta
 * quello che finirebbe nel database.
 */
export const bozzaCambiata = (locale: string, salvata: string) => pulisciTesto(locale) !== salvata

/** Le parole sul tag di una pagina nell'elenco. */
export const PAROLE_STATO: Record<StatoPagina, string> = {
  pubblicata: 'PUBBLICATA',
  modificata: 'MODIFICHE NON PUBBLICATE',
  'solo-bozza': 'SOLO BOZZA',
  nascosta: 'NASCOSTA',
}

// Un indirizzo che il sito e il database ammettono: assoluto (https, http, mailto, tel) con qualcosa dopo, oppure interno
// con una sola «/». Niente spazi, virgolette né «<» e «>» (rompono l'attributo), al massimo 300 lettere.
const INDIRIZZO_ASSOLUTO = /^(https?:\/\/|mailto:|tel:)[^\s"'<>]+$/i
const INDIRIZZO_RELATIVO = /^\/(?![/\\])[^\s"'<>]*$/
const MASSIMO_INDIRIZZO = 300
const MASSIMO_NOME_VOCE = 60
const MASSIMO_TESTO = 200000

export const indirizzoValido = (i: string) => i.length <= MASSIMO_INDIRIZZO && (INDIRIZZO_ASSOLUTO.test(i) || INDIRIZZO_RELATIVO.test(i))

/** Perché il testo di una pagina è troppo lungo per il database; `null` se va bene. */
export const testoTroppoLungo = (html: string): string | null =>
  html.length > MASSIMO_TESTO ? `Il testo è troppo lungo: al massimo ${MASSIMO_TESTO.toLocaleString('it-IT')} caratteri, ne ha ${html.length.toLocaleString('it-IT')}` : null

/**
 * Cosa non va in un menu o in un footer, una frase per problema; vuoto se va
 * bene. Dice sempre il nome della voce, così si sa quale toccare. Nel footer
 * devono esserci le pagine di legge, pubblicate.
 */
export function controllaMenu(dove: 'menu' | 'footer', voci: VoceMenu[], pagine: Array<Pick<PaginaSito, 'id' | 'titolo' | 'nascosta' | 'pubblicato' | 'diLegge'>>): string[] {
  const problemi: string[] = []
  voci.forEach((v) => {
    const nome = v.etichetta.trim()
    if (!nome) {
      problemi.push('Ogni voce ha bisogno di un nome')
      return
    }
    if (nome.length > MASSIMO_NOME_VOCE) {
      problemi.push(`Il nome della voce «${nome.slice(0, 20)}…» è troppo lungo: al massimo ${MASSIMO_NOME_VOCE} lettere`)
      return
    }
    if ((v.paginaId === null) === (v.indirizzo === null)) {
      problemi.push(`La voce «${nome}» deve portare a una pagina oppure a un indirizzo, non a tutti e due né a nessuno`)
      return
    }
    if (v.paginaId !== null) {
      const pagina = pagine.find((p) => p.id === v.paginaId)
      if (!pagina || pagina.nascosta || pagina.pubblicato === null) problemi.push(`La voce «${nome}» porta a una pagina nascosta o non ancora pubblicata: pubblicala o togli la voce`)
    } else if (v.indirizzo !== null && !indirizzoValido(v.indirizzo)) {
      problemi.push(`La voce «${nome}» ha un indirizzo che il sito non ammette: deve cominciare con https://, mailto:, tel: oppure /, senza spazi né virgolette`)
    }
  })
  if (dove === 'footer') {
    for (const legge of pagine.filter((p) => p.diLegge)) {
      const dentro = voci.some((v) => v.paginaId === legge.id)
      if (!dentro || legge.nascosta || legge.pubblicato === null) problemi.push(`Nel footer deve esserci «${legge.titolo}»: è una pagina di legge`)
    }
  }
  return problemi
}

/** Le stesse voci con quella in `da` spostata in `verso`; indici fuori elenco lasciano tutto com'è. */
export function spostaVoce<T>(voci: T[], da: number, verso: number): T[] {
  const copia = [...voci]
  if (da === verso || da < 0 || verso < 0 || da >= voci.length || verso >= voci.length) return copia
  const [voce] = copia.splice(da, 1)
  copia.splice(verso, 0, voce)
  return copia
}

/** Perché una pagina di legge non si tocca; `null` se si può. */
export function pagineDiLeggeProtette(p: Pick<PaginaSito, 'diLegge'>, azione: 'nascondi' | 'cancella' | 'indirizzo'): string | null {
  if (!p.diLegge) return null
  if (azione === 'indirizzo') return 'Le pagine di legge tengono il loro indirizzo'
  return azione === 'nascondi'
    ? 'Le pagine di legge devono restare sul sito: non si possono nascondere'
    : 'Le pagine di legge devono restare sul sito: non si possono cancellare'
}
