import type { StatoRichiesta } from './richieste'
import { dataLunga } from './sala'

/**
 * Da dove arrivano le richieste di iscrizione.
 *
 * Il link al modulo porta un'etichetta (`iscrizioni/?da=home`,
 * `?da=corso-karate`, `?da=segreteria`…): il sito la mette da sé su ogni
 * link (la pagina da cui parte), la segreteria la scrive a mano per un
 * volantino o un post. Il modulo chiede anche, facoltativo, «Come ci hai
 * conosciuto?» con otto scelte chiuse, una volta per tutto il modulo.
 *
 * Un'etichetta sbagliata non ferma mai una richiesta: si pulisce come la
 * pulisce `invia_iscrizione` (`supabase/73-provenienza-richieste.sql`) e se
 * non va si lascia fuori, senza dire niente. Non si salva sul telefono: si
 * legge dall'indirizzo con cui si è aperta la pagina.
 *
 * La segreteria la vede nel dettaglio della richiesta col suo nome leggibile
 * («Home del sito», il titolo della pagina del corso) e la conta in
 * STATISTICHE (`contaDaDove`).
 */

export const MASSIMO_PROVENIENZA = 90
const FORMA = /^[a-z0-9]+(-[a-z0-9]+)*$/

/** Le etichette che non vengono dal sito. */
export const DA_SEGRETERIA = 'segreteria'
export const DA_AREA_ISCRITTI = 'area-iscritti'

export const NON_SI_SA = 'Non si sa'

/** Come `btrim(…, ' \t\r\n')` del database: solo gli spazi ai lati. */
const pulito = (x: unknown) => (typeof x === 'string' ? x.replace(/^[ \t\r\n]+|[ \t\r\n]+$/g, '').toLowerCase() : undefined)

/** L'etichetta pulita, o niente se non va: mai un errore. */
export function pulisciProvenienza(x: unknown): string | undefined {
  const t = pulito(x)
  return t !== undefined && t.length <= MASSIMO_PROVENIENZA && FORMA.test(t) ? t : undefined
}

/** Le risposte a «Come ci hai conosciuto?», nell'ordine del modulo. Le chiavi sono quelle del vincolo del database. */
export const CONOSCIUTO = [
  { chiave: 'amici-parenti', nome: 'Amici o parenti' },
  { chiave: 'sito', nome: 'Sito' },
  { chiave: 'instagram', nome: 'Instagram' },
  { chiave: 'facebook', nome: 'Facebook' },
  { chiave: 'google', nome: 'Google' },
  { chiave: 'volantino', nome: 'Volantino' },
  { chiave: 'passando-davanti', nome: 'Passando davanti' },
  { chiave: 'altro', nome: 'Altro' },
] as const

export type Conosciuto = (typeof CONOSCIUTO)[number]['chiave']

const eConosciuto = (t: string): t is Conosciuto => CONOSCIUTO.some((c) => c.chiave === t)

/** Una delle otto scelte, o niente: un valore inventato si scarta. */
export function pulisciConosciuto(x: unknown): Conosciuto | undefined {
  const t = pulito(x)
  return t !== undefined && eConosciuto(t) ? t : undefined
}

/** L'etichetta di un indirizzo (`location.search`): la prima `da`, pulita. */
export function provenienzaDaIndirizzo(search: string): string | undefined {
  return pulisciProvenienza(new URLSearchParams(search).get('da') ?? undefined)
}

// La prima letta in questa visita: passando da #prezzi la pagina si ricarica con
// la stessa query, e qui resta quella con cui si è aperta. Nessun localStorage
// né cookie: chi torna un altro giorno da un altro link conta per quel link.
let dellaVisita: { e: string | undefined } | undefined

/** L'etichetta con cui si è aperta la pagina delle iscrizioni, in questa visita. */
export function provenienzaDellaVisita(): string | undefined {
  dellaVisita ??= { e: typeof window === 'undefined' ? undefined : provenienzaDaIndirizzo(window.location.search) }
  return dellaVisita.e
}

/** Cosa porta una richiesta: dal modulo pubblico l'etichetta della visita e la risposta; dall'area iscritti la sua etichetta, e la domanda non c'è. */
export function origineDellaRichiesta(dallAreaIscritti: boolean, conosciuto: unknown): { provenienza?: string; conosciuto?: Conosciuto } {
  if (dallAreaIscritti) return { provenienza: DA_AREA_ISCRITTI }
  const provenienza = provenienzaDellaVisita()
  const c = pulisciConosciuto(conosciuto)
  return { ...(provenienza ? { provenienza } : {}), ...(c ? { conosciuto: c } : {}) }
}

/** Un `?da=` già scritto (anche come `&amp;da=` dentro un attributo HTML). */
export const haProvenienza = (indirizzo: string) => /[?&](amp;)?da=/i.test(indirizzo.split('#')[0])

/** L'indirizzo con `da=<etichetta>` in coda alla query, prima del cancelletto; uno già scritto resta. */
export function conProvenienza(indirizzo: string, etichetta: string): string {
  if (haProvenienza(indirizzo)) return indirizzo
  const [prima, ...dopo] = indirizzo.split('#')
  const cancelletto = dopo.length ? `#${dopo.join('#')}` : ''
  return `${prima}${prima.includes('?') ? '&' : '?'}da=${etichetta}${cancelletto}`
}

/** Il link di COPIA LINK ISCRIZIONI: quello che la segreteria manda su WhatsApp. */
export const linkDellaSegreteria = (indirizzo: string) => conProvenienza(indirizzo, DA_SEGRETERIA)

/** L'etichetta dei link di una pagina del sito: la Home, `corso-<indirizzo>` per un corso, l'indirizzo per le altre. */
export const etichettaPagina = (slug: string, corso: boolean) => (slug === 'home' ? 'home' : corso ? `corso-${slug}` : slug)

/** I titoli delle pagine del sito per indirizzo, anche dai vecchi indirizzi (i rinvii): un corso che cambia indirizzo non si spezza. */
export function titoliDelSito(pagine: ReadonlyArray<{ slug: string; titolo: string }>, rinvii: ReadonlyArray<{ da: string; a: string }>): Record<string, string> {
  const t: Record<string, string> = {}
  for (const p of pagine) if (p.titolo.trim()) t[p.slug] = p.titolo.trim()
  for (const r of rinvii) if (t[r.a] && !t[r.da]) t[r.da] = t[r.a]
  return t
}

const FISSI: Record<string, string> = { home: 'Home del sito', [DA_SEGRETERIA]: 'Link della segreteria', [DA_AREA_ISCRITTI]: 'Area iscritti' }

/** Il nome che legge la segreteria: quelli fissi, il titolo della pagina del sito, o la parola com'è. */
export function nomeProvenienza(etichetta: string | undefined, titoli: Readonly<Record<string, string>>): string {
  if (!etichetta) return NON_SI_SA
  if (FISSI[etichetta]) return FISSI[etichetta]
  const corso = /^corso-(.+)$/.exec(etichetta)?.[1]
  return (corso && titoli[corso]) || titoli[etichetta] || etichetta
}

export const nomeConosciuto = (chiave: string | undefined) => CONOSCIUTO.find((c) => c.chiave === chiave)?.nome ?? NON_SI_SA

/** Una riga di `richieste_da_dove()`: quante richieste con questa etichetta, risposta, corsi e stato. */
export interface RigaDaDove {
  provenienza?: string | null
  conosciuto?: string | null
  corsi: string[]
  stato: StatoRichiesta
  n: number
}

export interface DaDove {
  /** Il primo giorno contato, `AAAA-MM-GG`: prima di `73-provenienza-richieste.sql` non si contava. */
  dal?: string
  righe: RigaDaDove[]
}

export interface VoceDaDove {
  nome: string
  arrivate: number
  accolte: number
  rifiutate: number
  /** La riga NON SI SA: sta sempre in fondo. */
  nonSiSa: boolean
}

const zero = () => ({ arrivate: 0, accolte: 0, rifiutate: 0 })

function elenco(righe: RigaDaDove[], nome: (r: RigaDaDove) => string | undefined): VoceDaDove[] {
  const per = new Map<string, VoceDaDove>()
  for (const r of righe) {
    const n = nome(r)
    const chiave = n ?? ''
    const v = per.get(chiave) ?? { nome: n ?? NON_SI_SA, nonSiSa: n === undefined, ...zero() }
    v.arrivate += r.n
    if (r.stato === 'accolta') v.accolte += r.n
    if (r.stato === 'rifiutata') v.rifiutate += r.n
    per.set(chiave, v)
  }
  return [...per.values()].sort((a, b) => Number(a.nonSiSa) - Number(b.nonSiSa) || b.arrivate - a.arrivate || a.nome.localeCompare(b.nome, 'it'))
}

/**
 * I due elenchi del riquadro DA DOVE ARRIVANO LE RICHIESTE: per persona (una
 * riga di `n` sono `n` richieste), le arrivate nel periodo e come stanno oggi.
 * Con un corso, solo le richieste che lo chiedono: chi ne chiede due conta in
 * tutti e due. Le etichette con lo stesso nome leggibile (un corso che ha
 * cambiato indirizzo) fanno una riga sola.
 */
export function contaDaDove(righe: RigaDaDove[], corso: string, titoli: Readonly<Record<string, string>>) {
  const qui = corso ? righe.filter((r) => r.corsi.includes(corso)) : righe
  const totale = zero()
  for (const r of qui) {
    totale.arrivate += r.n
    if (r.stato === 'accolta') totale.accolte += r.n
    if (r.stato === 'rifiutata') totale.rifiutate += r.n
  }
  return {
    arrivateDa: elenco(qui, (r) => (r.provenienza ? nomeProvenienza(r.provenienza, titoli) : undefined)),
    conosciuto: elenco(qui, (r) => (r.conosciuto && pulisciConosciuto(r.conosciuto) ? nomeConosciuto(r.conosciuto) : undefined)),
    totale,
  }
}

/** La frase sotto il riquadro: da quando si conta, e come. */
export function fraseDaDove(dal: string | undefined): string {
  if (!dal) return 'Non è ancora arrivata nessuna richiesta da contare: si comincia dalla prossima.'
  return `Si conta dal ${dataLunga(dal)}: per persona (una famiglia di tre conta tre), arrivate nel periodo e come stanno oggi; le altre aspettano. Chi chiede due corsi conta in tutti e due col filtro per corso.`
}

/** La nota accanto al titolo del riquadro. */
export const notaDaDove = (corso: string | undefined) =>
  corso ? `le richieste che chiedono ${corso}, arrivate nel periodo, per persona, e come stanno oggi` : 'le richieste arrivate nel periodo, per persona, e come stanno oggi'

export const MANCA_PROVENIENZA = 'Per contare da dove arrivano le richieste va lanciato 73-provenienza-richieste.sql: il resto delle statistiche funziona.'
