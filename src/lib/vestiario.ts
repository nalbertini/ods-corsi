import { PAGAMENTO } from './iscrizione'
import { FORMA_EMAIL, telefonoGiusto } from './richieste'
import { dataLunga } from './sala'

/**
 * Gli ordini di vestiario, judogi e costumini, al posto del modulo Google.
 *
 * Qui stanno le regole, in funzioni pure: aperti o chiusi, cosa non va in un
 * catalogo o in un ordine, il totale, gli elenchi per il fornitore e per
 * persona, i numeri della raccolta e il riepilogo per il genitore. Il
 * database (`supabase/47-vestiario.sql`) fa le stesse cose con gli stessi
 * messaggi, e la modalità prova (`vestiarioProva.ts`) le prende da qui.
 *
 * I prezzi sono in euro, come nel listino.
 */

/** Un capo del catalogo: un prezzo solo per tutte le taglie (due prezzi sono due capi). */
export interface Capo {
  capo: string
  taglie: string[]
  prezzo: number
  /** Una nota libera, es. «altezza + 10 cm, campioni in segreteria». */
  nota?: string
}

export interface Catalogo {
  /** L'ultimo giorno in cui si ordina, compreso: `AAAA-MM-GG`. Senza, è chiuso. */
  chiude: string | null
  capi: Capo[]
}

/** Una raccolta di ordini: ha un suo id perché una proroga le cambia la data. */
export interface Raccolta {
  id: string
  chiude: string
}

/** Una riga come la scrive chi ordina: il prezzo lo mette il catalogo. */
export interface RigaNuova {
  perChi: string
  capo: string
  taglia: string
  quanti: number
}

export interface Riga extends RigaNuova {
  id: string
  /** Il prezzo del catalogo quando la riga è entrata: resta anche se il catalogo cambia. */
  prezzo: number
}

/** Un ordine come lo manda il genitore o lo scrive la segreteria. */
export interface OrdineNuovo {
  /**
   * L'id scelto dal dispositivo prima di mandare: se la risposta si perde e
   * il genitore rimanda, il database riconosce lo stesso ordine invece di
   * scriverne due.
   */
  id?: string
  nome: string
  cognome: string
  telefono: string
  email?: string | null
  righe: RigaNuova[]
}

export interface Ordine {
  id: string
  raccolta: string
  nome: string
  cognome: string
  telefono: string
  email: string | null
  righe: Riga[]
  totale: number
  saldato: boolean
  annullato: boolean
  /**
   * Quanto ha già pagato: il totale quando si segna SALDATO, 0 quando si
   * toglie il segno a mano. Dopo una correzione con TOGLI IL SEGNO resta il
   * totale di prima, e il da pagare è `totale - pagato`.
   */
  pagato: number
  pagatoCon: Pagamento | null
  /** Il giorno in cui la segreteria l'ha segnato: `AAAA-MM-GG`. */
  pagatoIl: string | null
  /** Quando è arrivato, ISO: l'elenco va dal più recente. */
  arrivato: string
  /** Scritto dalla segreteria al banco, non mandato dal link. */
  dalBanco: boolean
}

export type Pagamento = 'bonifico' | 'satispay' | 'contanti'
export const PAGAMENTI: readonly Pagamento[] = ['bonifico', 'satispay', 'contanti']

export type StatoOrdine = 'saldato' | 'da saldare' | 'annullato'

/** Nel correggere, una riga che c'era porta il suo id; una nuova no. */
export type RigaCorretta = RigaNuova & { id?: string }

/** Quel che serve alle pagine, col database o in prova. */
export interface DatiVestiario {
  /** Quello che vede la pagina pubblica; `null` se non c'è mai stato. */
  catalogo(): Promise<Catalogo | null>
  salvaCatalogo(c: Catalogo): Promise<void>
  /** Dalla pagina pubblica: rifiutato a raccolta chiusa. Torna l'ordine coi prezzi e il totale del catalogo. */
  inviaOrdine(o: OrdineNuovo): Promise<Ordine>
  /** Dal banco: anche a raccolta chiusa. Torna l'id. */
  /** Con `come`, già saldato in quel modo; senza, da saldare. */
  scriviOrdine(o: OrdineNuovo, come?: Pagamento | null): Promise<string>
  raccolte(): Promise<Raccolta[]>
  ordini(raccolta: string): Promise<Ordine[]>
  /**
   * Con `come`: saldato, pagato il totale, oggi. Con `null`: da saldare; a
   * mano azzera pagato, come e quando; con `tieniPagato` (TOGLI IL SEGNO dopo
   * una correzione) li tiene.
   */
  segnaSaldato(id: string, come: Pagamento | null, tieniPagato?: boolean): Promise<void>
  annulla(id: string, annullato: boolean): Promise<void>
  sposta(id: string, raccolta: string): Promise<void>
  /**
   * Un saldato resta saldato e paga il totale nuovo; con `togliSegno`, se il
   * totale sale, torna da saldare e tiene il pagato di prima (con come e quando).
   */
  correggiRighe(id: string, righe: RigaCorretta[], togliSegno?: boolean): Promise<void>
}

// I limiti sono quelli di `vestiario_regole()` in 47-vestiario.sql: la pagina pubblica
// la può chiamare anche un programma, e un ordine o un catalogo senza fondo pesa su tutti.

/** Quanti dello stesso capo e taglia in una riga: oltre, è un errore di battitura. */
export const MAX_QUANTI = 10

/** Le righe di un ordine: una famiglia numerosa, con un capo di ogni tipo. */
export const MAX_RIGHE = 20

export const MAX_CAPI = 50
const MAX_TAGLIE = 30
const MAX_PREZZO = 9999

export const ALMENO_UN_CAPO = 'Serve almeno un capo'

export const ORDINE_SPARITO = "L'ordine non c'è più: ricarica la pagina"

/** Lo stesso id del dispositivo con un altro telefono: non è un secondo invio, è un altro ordine. */
export const NON_SI_RIMANDA = "Quest'ordine non si può rimandare: ricarica la pagina e rifallo"

/** Sotto le righe, quando sono MAX_RIGHE: il tasto per aggiungerne è spento, e questo dice perché. */
export const MAX_RIGHE_DETTO = `Al massimo ${MAX_RIGHE} righe in un ordine: per altro fai un secondo ordine`

export const TELEFONO_SBAGLIATO = 'Il telefono non sembra giusto: servono da 6 a 15 cifre (spazi e + davanti vanno bene)'
export const EMAIL_SBAGLIATA = "L'email non sembra giusta: scrivila come nome@esempio.it"

export const RIMETTI_PRIMA = "Rimetti l'ordine prima di segnarlo"
export const PAGAMENTO_SBAGLIATO = 'Scegli come ha pagato: bonifico, Satispay o contanti'

/** `null` va bene (da saldare); altrimenti uno dei tre modi. */
export const pagamentoGiusto = (come: unknown): come is Pagamento | null => come === null || PAGAMENTI.some((p) => p === come)

export const RACCOLTA_SPARITA = "Questa raccolta non c'è più: ricarica la pagina"

export const CHIUSI = 'Gli ordini sono chiusi: per un ordine fuori tempo chiama la segreteria'

/** Le taglie pulite: senza spazi, senza vuote, ognuna una volta, nell'ordine scritto (S, M, L non è alfabetico). */
const pulisciTaglie = (taglie: string[]) => [...new Set(taglie.map((t) => t.trim()).filter(Boolean))]

/** «120, 130,140 ,» → ['120', '130', '140']: le taglie si scrivono in una casella sola. */
export const taglieDa = (testo: string) => pulisciTaglie(testo.split(','))

/** Il catalogo come lo salva il database: nomi e taglie senza spazi, taglie doppie tolte, nota vuota tolta. */
export function pulisciCatalogo(c: Catalogo): Catalogo {
  return {
    chiude: c.chiude,
    capi: c.capi.map((x) => {
      const nota = x.nota?.trim().slice(0, 300)
      return { capo: x.capo.trim(), taglie: pulisciTaglie(x.taglie), prezzo: x.prezzo, ...(nota ? { nota } : {}) }
    }),
  }
}

/** Una data `AAAA-MM-GG` che esiste: il 30 febbraio, riletto, diventa marzo. */
const dataVera = (g: string) => /^\d{4}-\d{2}-\d{2}$/.test(g) && new Date(`${g}T00:00:00Z`).toISOString().slice(0, 10) === g

/** Al centesimo e non oltre il limite: le righe tengono due decimali. */
const prezzoGiusto = (p: number) => Number.isFinite(p) && p > 0 && p <= MAX_PREZZO && Math.round(p * 100) / 100 === p

/** Aperti fino al giorno di chiusura compreso, e solo con una data e almeno un capo. */
export function ordiniAperti(c: Catalogo | null, oggi: string): boolean {
  return !!c && !!c.chiude && c.capi.length > 0 && oggi <= c.chiude
}

// Due capi che differiscono solo per le maiuscole confondono chi ordina: sono lo stesso nome.
const nomeCapo = (s: string) => s.trim().toLowerCase()

/** Cosa non va nel catalogo, come lo dice `salva_vestiario`; `null` se si salva. */
export function cosaNonVaCatalogo(c: Catalogo): string | null {
  if (c.chiude !== null && !dataVera(c.chiude)) return 'La data di chiusura non sembra una data'
  if (c.capi.length > MAX_CAPI) return `Il catalogo ha al massimo ${MAX_CAPI} capi`
  const visti = new Set<string>()
  for (const x of c.capi) {
    const nome = x.capo.trim()
    if (!nome) return 'Ogni capo ha un nome'
    if (nome.length > 80) return `Il nome del capo «${nome.slice(0, 80)}» è troppo lungo`
    if (visti.has(nomeCapo(nome))) return `«${nome}» c'è due volte: due prezzi sono due capi, con due nomi diversi`
    visti.add(nomeCapo(nome))
    if (!prezzoGiusto(x.prezzo)) return `«${nome}» non ha un prezzo`
    const taglie = pulisciTaglie(x.taglie)
    if (!taglie.length) return `«${nome}» non ha taglie: scrivile separate da virgola`
    if (taglie.length > MAX_TAGLIE || taglie.some((t) => t.length > 20)) return `Le taglie del capo «${nome}» sono troppe o troppo lunghe`
  }
  return null
}

/** Cosa non va in una riga, contro il catalogo; `null` se va. */
export function cosaNonVaRiga(r: RigaNuova, capi: Capo[]): string | null {
  const perChi = r.perChi?.trim() ?? ''
  const nome = r.capo?.trim() ?? ''
  const taglia = r.taglia?.trim() ?? ''
  if (!perChi) return 'Scrivi per chi è ogni capo: nome e cognome del bambino'
  if (perChi.length > 160) return 'Un campo non va: «per chi» è troppo lungo'
  const capo = capi.find((c) => c.capo === nome)
  if (!capo) return `«${nome.slice(0, 80)}» non è nel catalogo: ricarica la pagina`
  if (!capo.taglie.includes(taglia)) return `${capo.capo}: la taglia ${taglia.slice(0, 20)} non c'è, scegline una del catalogo`
  if (!Number.isInteger(r.quanti) || r.quanti < 1 || r.quanti > MAX_QUANTI) return `La quantità va da 1 a ${MAX_QUANTI}`
  return null
}

/** Cosa non va in un ordine, come lo dice `invia_ordine_vestiario`; `null` se si manda. */
export function cosaNonVaOrdine(o: OrdineNuovo, capi: Capo[]): string | null {
  if (!o.nome?.trim() || !o.cognome?.trim()) return 'Scrivi nome e cognome di chi ordina'
  if (o.nome.trim().length > 80 || o.cognome.trim().length > 80) return 'Un campo non va: nome e cognome sono troppo lunghi'
  const tel = o.telefono?.trim() ?? ''
  if (!tel) return 'Serve un telefono: la segreteria chiama chi non ha saldato'
  if (!telefonoOrdineGiusto(tel)) return TELEFONO_SBAGLIATO
  if (!emailOrdineGiusta(o)) return EMAIL_SBAGLIATA
  return cosaNonVaRighe(o.righe, capi)
}

/**
 * Le righe di un ordine nuovo o corretto: almeno una, non più di MAX_RIGHE,
 * ognuna sul catalogo. Correggendo, `capi` dice per ogni riga contro cosa
 * controllarla (una riga che non cambia capo né taglia vale anche se il
 * catalogo l'ha tolta).
 */
export function cosaNonVaRighe(righe: RigaNuova[], capi: Capo[] | ((r: RigaNuova) => Capo[])): string | null {
  if (!Array.isArray(righe) || !righe.length) return ALMENO_UN_CAPO
  if (righe.length > MAX_RIGHE) return `Un ordine ha al massimo ${MAX_RIGHE} righe: dividilo in due`
  for (const r of righe) {
    const guaio = cosaNonVaRiga(r, typeof capi === 'function' ? capi(r) : capi)
    if (guaio) return guaio
  }
  return null
}

/**
 * Le cifre di un telefono, senza il prefisso dell'Italia: «+39 333 1234567» e
 * «333 123 4567» sono lo stesso. Il 39 (o 0039) si toglie solo se restano
 * 9-10 cifre, come `vestiario_cifre()` in 47-vestiario.sql: «393 123 4567» è
 * un cellulare che comincia per 39, non un prefisso.
 */
export function cifreTelefono(t: string): string {
  const cifre = t.replace(/\D/g, '')
  const senza = cifre.replace(/^(0039|39)/, '')
  return senza !== cifre && senza.length >= 9 && senza.length <= 10 ? senza : cifre
}

/** 30 caratteri al massimo: le cifre le conta telefonoGiusto, ma spazi e punti no. */
export const telefonoOrdineGiusto = (t: string) => telefonoGiusto(t.trim()) && t.trim().length <= 30

/** Vuota va bene: è facoltativa. */
export function emailOrdineGiusta(o: Pick<OrdineNuovo, 'email'>): boolean {
  const email = emailDi(o)
  return !email || (FORMA_EMAIL.test(email) && email.length <= 160)
}

/** L'email come la salva il database: in minuscolo, `null` se non c'è. */
export const emailDi = (o: Pick<OrdineNuovo, 'email'>) => o.email?.trim().toLowerCase() || null

/** Il prezzo del catalogo di un capo, per una riga nuova. */
export const prezzoDi = (capi: Capo[], capo: string) => capi.find((c) => c.capo === capo.trim())?.prezzo ?? 0

/** Arrotondato al centesimo: le somme di decimali in virgola mobile sbavano. */
export const totaleOrdine = (righe: { quanti: number; prezzo: number }[]) =>
  Math.round(righe.reduce((s, r) => s + r.quanti * r.prezzo * 100, 0)) / 100

/** Annullato vince su saldato: un annullato saldato è da rimborsare, non da mandare al fornitore. */
export const statoOrdine = (o: Pick<Ordine, 'saldato' | 'annullato'>): StatoOrdine =>
  o.annullato ? 'annullato' : o.saldato ? 'saldato' : 'da saldare'

/** Una posizione per ordinare: quelli che il catalogo non ha più vanno in fondo. */
const posto = (i: number) => (i < 0 ? Number.MAX_SAFE_INTEGER : i)

export interface VoceFornitore {
  capo: string
  taglia: string
  quanti: number
}

/** Quel che si chiede al fornitore: solo saldati e non annullati, contati per capo e taglia, nell'ordine del catalogo. */
export function elencoFornitore(ordini: Ordine[], capi: Capo[]): VoceFornitore[] {
  const conti = new Map<string, VoceFornitore>()
  for (const o of ordini) {
    if (statoOrdine(o) !== 'saldato') continue
    for (const r of o.righe) {
      const chiave = `${r.capo}\u0000${r.taglia}`
      const v = conti.get(chiave) ?? { capo: r.capo, taglia: r.taglia, quanti: 0 }
      v.quanti += r.quanti
      conti.set(chiave, v)
    }
  }
  const capoDi = (v: VoceFornitore) => capi.findIndex((c) => c.capo === v.capo)
  return [...conti.values()].sort((a, b) => {
    const ca = capoDi(a)
    const cb = capoDi(b)
    if (ca !== cb) return posto(ca) - posto(cb) || a.capo.localeCompare(b.capo, 'it')
    const taglie = capi[ca]?.taglie ?? []
    return posto(taglie.indexOf(a.taglia)) - posto(taglie.indexOf(b.taglia)) || a.taglia.localeCompare(b.taglia, 'it')
  })
}

export interface VocePersona extends RigaNuova {
  /** «Cognome Nome» di chi ha ordinato. */
  chiOrdina: string
  telefono: string
  stato: StatoOrdine
}

/** Per distribuire: ogni capo col nome di chi lo riceve, per nome; gli annullati no. */
export function elencoPersone(ordini: Ordine[]): VocePersona[] {
  return ordini
    .filter((o) => !o.annullato)
    .flatMap((o) =>
      o.righe.map((r) => ({
        perChi: r.perChi,
        capo: r.capo,
        taglia: r.taglia,
        quanti: r.quanti,
        chiOrdina: `${o.cognome} ${o.nome}`,
        telefono: o.telefono,
        stato: statoOrdine(o),
      })),
    )
    .sort((a, b) => a.perChi.localeCompare(b.perChi, 'it'))
}

/**
 * Un foglio da aprire con Excel, come il CSV di PRESENZE: punto e virgola,
 * a capo `\r\n`, virgolette solo dove servono. Il BOM lo mette chi scarica.
 */
export function csv(righe: (string | number)[][]): string {
  const q = (v: string | number) => {
    // Un valore che comincia per = + - @ (o tab, a capo) Excel lo legge come formula: col ' davanti resta testo.
    const s = /^[=+\-@\t\r]/.test(String(v)) ? `'${v}` : String(v)
    return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return righe.map((r) => r.map(q).join(';')).join('\r\n')
}

export const csvFornitore = (ordini: Ordine[], capi: Capo[]) =>
  csv([['capo', 'taglia', 'quanti'], ...elencoFornitore(ordini, capi).map((v) => [v.capo, v.taglia, v.quanti])])

export const csvPersone = (ordini: Ordine[]) =>
  csv([
    ['per chi', 'capo', 'taglia', 'quanti', 'chi ordina', 'telefono', 'stato'],
    ...elencoPersone(ordini).map((v) => [v.perChi, v.capo, v.taglia, v.quanti, v.chiOrdina, v.telefono, v.stato]),
  ])

export interface NumeriRaccolta {
  ordini: number
  saldati: number
  daSaldare: number
  /** Euro dei saldati. */
  incassato: number
  /** Euro dei da saldare. */
  mancante: number
}

/** In cima a VESTIARIO: gli annullati non contano. */
/** Quel che deve ancora chi non ha saldato; mai sotto zero: chi ha dato di più non copre gli altri. */
export const mancanoOrdine = (o: Pick<Ordine, 'totale' | 'pagato' | 'saldato' | 'annullato'>) =>
  o.saldato || o.annullato ? 0 : Math.max(0, Math.round((o.totale - o.pagato) * 100) / 100)

export function numeriRaccolta(ordini: Ordine[]): NumeriRaccolta {
  const vivi = ordini.filter((o) => !o.annullato)
  const daSaldare = vivi.filter((o) => !o.saldato)
  const somma = (xs: Ordine[], f: (o: Ordine) => number) => Math.round(xs.reduce((s, o) => s + f(o) * 100, 0)) / 100
  // Incassato è quel che è entrato, anche da chi deve ancora una differenza; mancante quel che deve chi non ha saldato.
  return {
    ordini: vivi.length,
    saldati: vivi.length - daSaldare.length,
    daSaldare: daSaldare.length,
    incassato: somma(vivi, (o) => o.pagato),
    mancante: somma(daSaldare, mancanoOrdine),
  }
}

/**
 * Gli id degli ordini che hanno lo stesso telefono di un altro, annullati
 * esclusi: lo stesso bambino ordinato due volte si vede, e la segreteria ne
 * annulla uno. Il telefono conta per cifre, col +39 o senza.
 */
export function stessoTelefono(ordini: Ordine[]): Set<string> {
  const per = new Map<string, string[]>()
  for (const o of ordini) {
    if (o.annullato) continue
    const cifre = cifreTelefono(o.telefono)
    per.set(cifre, [...(per.get(cifre) ?? []), o.id])
  }
  return new Set([...per.values()].filter((ids) => ids.length > 1).flat())
}

/** In NUOVO ORDINE (o correggendo `tranne`): chi ha già ordinato con questo telefono, per avvisare prima. */
export function ordineConStessoTelefono(ordini: Ordine[], telefono: string, tranne?: string): Ordine | undefined {
  const cifre = cifreTelefono(telefono)
  return ordini.find((o) => o.id !== tranne && !o.annullato && cifreTelefono(o.telefono) === cifre)
}

/** «al 17 ottobre», «all'8 ottobre»: per «sposta alla raccolta …». */
export const alGiorno = (g: string) => ilGiorno(g).replace(/^il /, 'al ').replace(/^l'/, "all'")

/** La causale del bonifico, pronta: così la segreteria riconosce chi ha pagato. */
export const causaleVestiario = (o: Pick<OrdineNuovo, 'nome' | 'cognome'>) => `Vestiario ${o.cognome.trim()} ${o.nome.trim()}`

/** «35 €», «40,50 €»: i centesimi solo se ci sono, come nella pagina dei costi. */
export const inEuro = (n: number) => `${n.toLocaleString('it-IT', { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })} €`

/** «il 17 ottobre», «l'8 ottobre», «l'11 novembre», «il 1° maggio»: come si dice. */
export function ilGiorno(g: string): string {
  const giorno = Number(g.slice(8, 10))
  const resto = dataLunga(g, false).replace(/^\d+ /, '')
  if (giorno === 1) return `il 1° ${resto}`
  return giorno === 8 || giorno === 11 ? `l'${giorno} ${resto}` : `il ${giorno} ${resto}`
}

/** Il testo di COPIA/CONDIVIDI da ORDINE ARRIVATO: righe, totale, come pagare, causale ed entro quando. */
export function riepilogoOrdine(o: Pick<Ordine, 'nome' | 'cognome' | 'righe' | 'totale'>, chiude: string): string {
  return [
    'Ordine di vestiario',
    ...o.righe.map((r) => `- ${r.perChi}: ${r.capo} ${r.taglia}${r.quanti > 1 ? ` × ${r.quanti}` : ''}, ${inEuro(r.quanti * r.prezzo)}`),
    `Totale: ${inEuro(o.totale)}`,
    '',
    `Bonifico a ${PAGAMENTO.intestatario}, IBAN ${PAGAMENTO.iban}`,
    ...(PAGAMENTO.satispay ? [`Satispay: ${PAGAMENTO.satispay}`] : []),
    'Oppure in contanti in segreteria.',
    `Causale: ${causaleVestiario(o)}`,
    '',
    `Parte solo quello pagato entro ${ilGiorno(chiude)}.`,
  ].join('\n')
}
