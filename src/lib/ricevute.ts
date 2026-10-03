import { saldoAperto, VALIDITA } from './costi'
import { LISTINO_PREDEFINITO, nomeCorso, type Listino } from './listino'
import { minorenne, type DatiRichiesta } from './richieste'
import { nomeProprio } from './nomi'
import { cfNatoIl, cfValido } from './codiceFiscale'

/**
 * Le ricevute dei pagamenti: la «ricevuta semplice» dell'associazione, come
 * quella che la segreteria faceva col programma di prima.
 *
 * Una ricevuta ha un numero (che riparte ogni anno), i dati
 * dell'associazione e del socio copiati dentro quando la si fa, le voci
 * pagate con da quando a quando valgono e come sono state pagate. Fatta, non
 * si cambia: si annulla, e il numero resta preso (`supabase/16-ricevute.sql`).
 * Il PDF lo fa `ricevutaPdf.ts`, sempre dalla ricevuta salvata.
 *
 * Gli importi sono in centesimi, perché 0,1 + 0,2 non fa 0,3.
 */

export interface EnteRicevuta {
  nome: string
  indirizzo: string
  cap: string
  comune: string
  codiceFiscale: string
  partitaIva?: string
  /** Sotto i totali: perché la ricevuta non ha IVA né bollo. */
  dicitura: string
}

/** I dati dell'associazione di oggi: la segreteria li cambia da IMPOSTAZIONI. */
export const ENTE_PREDEFINITO: EnteRicevuta = {
  nome: 'Asd Il Centro Judo',
  indirizzo: 'Corso Francia 224',
  cap: '10098',
  comune: 'Rivoli',
  codiceFiscale: '10002760014',
  dicitura:
    "Esente da imposta e tasse ai sensi dell'art. 11 e 11bis del D.P.R. 971/86 e art.4 e 10 D.P.R. 633/72. Esente da bollo in modo assoluto art.7 Tabella allegato B D.P.R. 642/72",
}

/**
 * C'è qualcosa da perdere in CHI FA LE RICEVUTE? Si salva tutto senza spazi
 * ai lati, e un campo vuoto vale uno che non c'è (la partita IVA).
 */
export function enteCambiato(salvato: EnteRicevuta, bozza: EnteRicevuta): boolean {
  const chiavi = new Set([...Object.keys(salvato), ...Object.keys(bozza)] as (keyof EnteRicevuta)[])
  return [...chiavi].some((k) => (salvato[k] ?? '').trim() !== (bozza[k] ?? '').trim())
}

export interface IntestatarioRicevuta {
  nome: string
  cognome: string
  indirizzo?: string
  cap?: string
  comune?: string
  provincia?: string
  /** `AAAA-MM-GG`. */
  natoIl?: string
  codiceFiscale?: string
  partitaIva?: string
  /** Per un minore: chi paga. */
  genitore?: string
  genitoreCodiceFiscale?: string
}

export type MetodoPagamento = 'Bonifico' | 'Contanti' | 'POS' | 'Assegno'
export const METODI: MetodoPagamento[] = ['Bonifico', 'Contanti', 'POS', 'Assegno']

export interface PagamentoVoce {
  data: string
  /** Centesimi. */
  importo: number
  metodo: string
}

export interface VoceRicevuta {
  descrizione: string
  quantita: number
  /** Centesimi, per uno. */
  prezzo: number
  dal?: string
  al?: string
  pagamenti: PagamentoVoce[]
}

export interface DatiRicevuta {
  data: string
  personaId?: string
  /** Vuoto: il primo libero dell'anno. */
  numero?: number
  ente: EnteRicevuta
  intestatario: IntestatarioRicevuta
  voci: VoceRicevuta[]
  /** Centesimi già dati prima, che non sono in queste voci. */
  anticipo: number
  note?: string
}

export interface Ricevuta extends Omit<DatiRicevuta, 'numero'> {
  id: string
  anno: number
  numero: number
  totale: number
  pagato: number
  creataIl: string
  annullataIl?: string
}

/** La voce che dice se un socio è in regola coi pagamenti. */
export const QUOTA = 'QUOTA ASSOCIATIVA'

/**
 * La quota associativa di una ricevuta non annullata: da quando a quando
 * vale, e quanto ne manca (0: pagata). Le stesse righe della vista
 * `quote_ricevute` (supabase/27-pagamento-dalle-ricevute.sql).
 */
export interface QuotaRicevuta {
  anno: number
  numero: number
  dal?: string
  al?: string
  /** Centesimi. */
  mancano: number
}

/**
 * Le quote delle ricevute di una persona. Di una voce manca quello che non è
 * stato pagato su di lei, ma mai più di quanto resta della ricevuta: un
 * anticipo dato prima la può aver già coperta.
 */
export function quoteDi(ricevute: Ricevuta[]): QuotaRicevuta[] {
  return ricevute
    .filter((r) => !r.annullataIl)
    .flatMap((r) => {
      const resta = conti(r).netto
      return r.voci
        .filter((v) => v.descrizione.trim().toUpperCase() === QUOTA)
        .map((v) => {
          const pagata = v.pagamenti.reduce((s, p) => s + p.importo, 0)
          return { anno: r.anno, numero: r.numero, dal: v.dal, al: v.al, mancano: Math.min(Math.max(0, v.quantita * v.prezzo - pagata), resta) }
        })
    })
}

/** Come i conti del server: totale delle voci, pagato, e quello che resta. */
export function conti(r: Pick<DatiRicevuta, 'voci' | 'anticipo'>) {
  const totale = r.voci.reduce((s, v) => s + v.quantita * v.prezzo, 0)
  const pagato = r.voci.reduce((s, v) => s + v.pagamenti.reduce((t, p) => t + p.importo, 0), 0)
  return { totale, pagato, netto: Math.max(0, totale - pagato - r.anticipo) }
}

/** Gli stessi rifiuti di `emetti_ricevuta`, per dirli subito sotto al modulo. */
export function cosaNonVa(r: DatiRicevuta): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(r.data)) return 'Serve la data della ricevuta'
  if (!r.intestatario.nome.trim() || !r.intestatario.cognome.trim()) return 'Servono nome e cognome del socio'
  if (!r.voci.length) return 'Serve almeno una voce'
  if (r.voci.length > 20) return 'Al massimo venti voci'
  for (const v of r.voci) {
    if (!v.descrizione.trim()) return 'Ogni voce vuole una descrizione'
    if (!Number.isInteger(v.quantita) || v.quantita < 1 || v.quantita > 99) return `La quantità di «${v.descrizione}» va da 1 a 99`
    if (!Number.isInteger(v.prezzo) || v.prezzo < 0) return `Il prezzo di «${v.descrizione}» non va`
    if (v.dal && v.al && v.al < v.dal) return `Le date di «${v.descrizione}» sono al contrario`
    if (v.pagamenti.some((p) => !Number.isInteger(p.importo) || p.importo < 0)) return `Un pagamento di «${v.descrizione}» non va`
  }
  if (r.numero !== undefined && (!Number.isInteger(r.numero) || r.numero < 1)) return 'Il numero della ricevuta non va'
  const c = conti(r)
  if (c.pagato + r.anticipo > c.totale) return 'Si è pagato più del totale: controlla gli importi'
  return null
}

/** «418,00»: centesimi scritti all'italiana. */
export const euro = (cent: number) => (cent / 100).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: true })

/** «418», «418,5», «418,50 €» → centesimi; `null` se non è un importo. */
export function centesimi(testo: string): number | null {
  const t = testo.replace(/[€\s]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.')
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null
  return Math.round(Number(t) * 100)
}

/** `AAAA-MM-GG` → `GG/MM/AAAA`, come sulla ricevuta. */
export const dataRicevuta = (g?: string) => (g ? g.split('-').reverse().join('/') : '')

/** Tutto il CAP della provincia di Torino comincia per 10: gli altri si scrivono a mano. */
export const provinciaDalCap = (cap?: string) => (cap && /^10\d{3}$/.test(cap) ? 'TO' : '')

/** I dati del socio da una richiesta di iscrizione: per un minore, anche il genitore. */
export function intestatarioDaRichiesta(r: Partial<DatiRichiesta> & Pick<DatiRichiesta, 'nome' | 'cognome'>): IntestatarioRicevuta {
  const genitore = `${r.genitoreCognome ?? ''} ${r.genitoreNome ?? ''}`.trim()
  return {
    nome: r.nome,
    cognome: r.cognome,
    indirizzo: r.indirizzo || undefined,
    cap: r.cap || undefined,
    comune: r.comune || undefined,
    provincia: provinciaDalCap(r.cap) || undefined,
    natoIl: r.natoIl || undefined,
    codiceFiscale: r.codiceFiscale || undefined,
    genitore: genitore || undefined,
    genitoreCodiceFiscale: genitore ? r.genitoreCodiceFiscale || undefined : undefined,
  }
}

/** I campi vuoti tolti, gli spazi in più anche: così si salva. */
export function pulisciIntestatario(i: IntestatarioRicevuta): IntestatarioRicevuta {
  const x: Record<string, string> = {}
  for (const [k, v] of Object.entries(i)) if (typeof v === 'string' && v.trim()) x[k] = v.trim().replace(/\s+/g, ' ')
  if (x.codiceFiscale) x.codiceFiscale = x.codiceFiscale.toUpperCase().replace(/\s/g, '')
  if (x.genitoreCodiceFiscale) x.genitoreCodiceFiscale = x.genitoreCodiceFiscale.toUpperCase().replace(/\s/g, '')
  if (x.provincia) x.provincia = x.provincia.toUpperCase()
  for (const k of ['nome', 'cognome', 'genitore']) if (x[k]) x[k] = nomeProprio(x[k])
  return { nome: '', cognome: '', ...x }
}

const pulito = nomeCorso

/** Una voce pronta da aggiungere: quello che c'è nel listino. */
export interface VocePronta {
  chiave: string
  etichetta: string
  voce: (oggi: string) => Omit<VoceRicevuta, 'pagamenti'>
}

/** La fine di un trimestre che parte da `dal`: tre mesi meno un giorno, non oltre la stagione. */
export function fineTrimestre(dal: string) {
  const [a, m, g] = dal.split('-').map(Number)
  const x = new Date(Date.UTC(a, m - 1 + 3, g - 1)).toISOString().slice(0, 10)
  return x > VALIDITA.corsi.al ? VALIDITA.corsi.al : x
}

/** Euro del listino → centesimi, senza i resti della virgola mobile. */
const cent = (n: number) => Math.round(n * 100)

/** La quota associativa del listino. */
export function voceQuota(listino: Listino = LISTINO_PREDEFINITO): VocePronta {
  const prezzo = cent(listino.quota)
  return {
    chiave: 'quota',
    etichetta: `Quota associativa · ${euro(prezzo)} €`,
    voce: () => ({ descrizione: 'QUOTA ASSOCIATIVA', quantita: 1, prezzo, ...VALIDITA.quota }),
  }
}

/**
 * Le voci di un corso del listino: annuale, trimestre, e l'annuale a saldo
 * solo se `giorno` (quello della ricevuta) è entro la data del saldo.
 */
export function vociDelCorso(corso: string, giorno: string, listino: Listino = LISTINO_PREDEFINITO): VocePronta[] {
  const c = listino.corsi.find((x) => pulito(x.corso) === pulito(corso))
  if (!c) return []
  return c.prezzi.flatMap((p, i) => {
    const nome = p.etichetta ? `${c.corso} ${p.etichetta.toLowerCase()}` : c.corso
    const x: VocePronta[] = []
    if (p.annuale !== undefined)
      x.push({ chiave: `${c.corso}~${i}~annuale`, etichetta: `${nome} · annuale · ${euro(cent(p.annuale))} €`, voce: () => ({ descrizione: `Annuale ${nome}`, quantita: 1, prezzo: cent(p.annuale!), ...VALIDITA.corsi }) })
    if (p.saldo !== undefined && p.saldo !== p.annuale && saldoAperto(giorno, listino.saldoEntro))
      x.push({ chiave: `${c.corso}~${i}~saldo`, etichetta: `${nome} · annuale a saldo · ${euro(cent(p.saldo))} €`, voce: () => ({ descrizione: `Annuale ${nome}`, quantita: 1, prezzo: cent(p.saldo!), ...VALIDITA.corsi }) })
    if (p.trimestre !== undefined)
      x.push({
        chiave: `${c.corso}~${i}~trimestre`,
        etichetta: `${nome} · trimestre · ${euro(cent(p.trimestre))} €`,
        voce: (oggi) => {
          const dal = oggi < VALIDITA.corsi.dal ? VALIDITA.corsi.dal : oggi
          return { descrizione: `Trimestre ${nome}`, quantita: 1, prezzo: cent(p.trimestre!), dal, al: fineTrimestre(dal) }
        },
      })
    return x
  })
}

/** Tutte le voci del listino, la quota per prima e poi quelle dei corsi dati. */
export function vociPronte(primaQuesti: string[], giorno: string, listino: Listino = LISTINO_PREDEFINITO): VocePronta[] {
  const primi = primaQuesti.flatMap((c) => vociDelCorso(c, giorno, listino))
  const gia = new Set(primi.map((v) => v.chiave))
  return [voceQuota(listino), ...primi, ...listino.corsi.flatMap((c) => vociDelCorso(c.corso, giorno, listino)).filter((v) => !gia.has(v.chiave))]
}

/** La voce da scrivere a mano: nell'elenco «Aggiungi una voce…» sta con quelle del listino. */
const VOCE_A_MANO: VocePronta = { chiave: 'mano', etichetta: 'Una voce scritta a mano', voce: () => ({ descrizione: '', quantita: 1, prezzo: 0 }) }

/**
 * Le voci da aggiungere in due gruppi: prima quelle che servono a questa
 * persona (la quota, la voce a mano, tutte le righe di prezzo dei suoi corsi),
 * poi il resto del listino nel suo ordine. Così non si cercano fra trenta.
 */
export function vociInDueGruppi(corsi: string[], giorno: string, listino: Listino = LISTINO_PREDEFINITO) {
  const tutte = vociPronte(corsi, giorno, listino)
  const suoi = new Set(corsi.flatMap((c) => vociDelCorso(c, giorno, listino)).map((v) => v.chiave))
  return {
    primi: [tutte[0], VOCE_A_MANO, ...tutte.filter((v) => suoi.has(v.chiave))],
    altri: tutte.slice(1).filter((v) => !suoi.has(v.chiave)),
  }
}

/** Una cosa che manca nei dati del socio: il campo da segnare e come si dice. */
export interface CampoCheManca {
  campo: keyof IntestatarioRicevuta
  testo: string
}

/**
 * Cosa manca nei dati del socio. Il codice fiscale la palestra lo vuole
 * sempre: per un adulto il suo; per un minore il suo e, siccome la ricevuta va
 * al genitore, anche nome e codice fiscale del genitore. Senza, la ricevuta
 * non si fa, e nemmeno con un codice scritto sbagliato, che sulla ricevuta
 * varrebbe quanto uno vuoto. L'indirizzo si può lasciare vuoto: lo si dice e
 * basta. Minore o no si decide al `giorno` della ricevuta, non a oggi. Senza
 * NATO IL la data si legge dal codice fiscale, se è giusto: un bambino col
 * campo vuoto non diventa adulto. Solo l'app lo chiede, il database no.
 */
export function mancanoDatiSocio(i: IntestatarioRicevuta, giorno = new Date()) {
  const vuoto = (k: keyof IntestatarioRicevuta) => !String(i[k] ?? '').trim()
  // L'anno del codice ha due cifre: `cfNatoIl` prende il secolo che non mette la nascita dopo il giorno della ricevuta.
  const natoIl = i.natoIl || cfNatoIl(String(i.codiceFiscale ?? '').toUpperCase().replace(/\s/g, ''), giorno)
  const minore = !!natoIl && minorenne(natoIl, giorno)
  const chiesti: Array<CampoCheManca & { blocca: boolean }> = [
    { campo: 'codiceFiscale', testo: minore ? 'il codice fiscale del socio' : 'il codice fiscale', blocca: true },
    { campo: 'indirizzo', testo: 'l’indirizzo', blocca: false },
    ...(minore
      ? [
          { campo: 'genitore' as const, testo: 'il genitore', blocca: true },
          { campo: 'genitoreCodiceFiscale' as const, testo: 'il codice fiscale del genitore', blocca: true },
        ]
      : []),
  ]
  // Minuscole e spazi no: quando la si salva il codice diventa maiuscolo e attaccato.
  const sbagliato = (k: keyof IntestatarioRicevuta) => (k === 'codiceFiscale' || k === 'genitoreCodiceFiscale') && !cfValido(String(i[k]).toUpperCase().replace(/\s/g, ''))
  const mancano = chiesti.flatMap((x) => (vuoto(x.campo) ? [x] : sbagliato(x.campo) ? [{ ...x, testo: `${x.testo}${NON_GIUSTO}` }] : []))
  const solo = ({ campo, testo }: CampoCheManca): CampoCheManca => ({ campo, testo })
  return { minore, blocca: mancano.filter((x) => x.blocca).map(solo), avvisa: mancano.filter((x) => !x.blocca).map(solo) }
}

const NON_GIUSTO = ' non è giusto'
const elenco = (x: string[]) => x.join(', ').replace(/, ([^,]*)$/, ' e $1')

/** Perché la ricevuta non si fa, da `mancanoDatiSocio(…).blocca`; vuoto se si fa. */
export function motivoBlocca(blocca: CampoCheManca[]): string {
  if (!blocca.length) return ''
  const sbagliati = blocca.filter((x) => x.testo.endsWith(NON_GIUSTO)).map((x) => x.testo)
  const vuoti = blocca.filter((x) => !x.testo.endsWith(NON_GIUSTO)).map((x) => x.testo)
  const frase = elenco([...(vuoti.length ? [`${vuoti.length > 1 ? 'mancano' : 'manca'} ${elenco(vuoti)}`] : []), ...sbagliati])
  const fai = sbagliati.length ? 'correggil' : 'scrivil'
  return `${frase[0].toUpperCase()}${frase.slice(1)}: ${fai}${blocca.length > 1 ? 'i' : 'o'} nei DATI DEL SOCIO`
}

/** La riga dei dati del socio chiusi: a chi va la ricevuta, per un minore il genitore che paga. */
export function ricevutaPer(i: IntestatarioRicevuta, minore: boolean): string {
  const [chi, cf] = minore ? [i.genitore?.trim(), i.genitoreCodiceFiscale?.trim()] : [`${i.cognome} ${i.nome}`.trim(), i.codiceFiscale?.trim()]
  if (minore && !chi) return 'RICEVUTA PER IL GENITORE · MANCA'
  return `RICEVUTA PER ${(chi || '…').toUpperCase()}${minore ? ' (GENITORE)' : ''}${cf ? ` · ${cf.toUpperCase()}` : ''}`
}

/**
 * I dati del socio per una ricevuta nuova: quelli dell'ultima ricevuta, e
 * dove sono vuoti quelli della scheda (DATI ANAGRAFICI), così un codice
 * fiscale scritto dopo ci va. Nome e cognome sempre quelli della persona.
 */
export function intestatarioDa(
  ultima: IntestatarioRicevuta | null,
  anagrafica: Partial<DatiRichiesta> | null,
  chi: Pick<IntestatarioRicevuta, 'nome' | 'cognome'>,
): IntestatarioRicevuta {
  const pieni = Object.fromEntries(Object.entries(ultima ?? {}).filter(([, v]) => typeof v === 'string' && v.trim()))
  return { ...(anagrafica ? intestatarioDaRichiesta({ ...anagrafica, nome: chi.nome, cognome: chi.cognome }) : {}), ...pieni, nome: chi.nome, cognome: chi.cognome }
}

/** Il nome del file del PDF: `ricevuta-116-2026-albertini-manuela.pdf`. */
export const nomeFileRicevuta = (r: Pick<Ricevuta, 'numero' | 'anno' | 'intestatario'>) =>
  `ricevuta-${r.numero}-${r.anno}-${pulito(`${r.intestatario.cognome} ${r.intestatario.nome}`).replace(/ /g, '-')}.pdf`

/**
 * La domanda prima di fare la ricevuta: a chi va (per un minore, il socio e
 * il genitore che paga) e quanto. Con un acconto anche quanto si paga ora e
 * quanto resta, perché la ricevuta fatta non si cambia più.
 */
export function domandaRicevuta(quale: string, i: IntestatarioRicevuta, minore: boolean, c: ReturnType<typeof conti>): string {
  const socio = `${i.cognome} ${i.nome}`.trim()
  const chi = minore && i.genitore?.trim() ? `per ${socio}, al genitore ${i.genitore.trim()}` : `a ${socio}`
  const quanto = c.pagato === c.totale ? `${euro(c.totale)} €` : `${euro(c.totale)} € · pagati ora ${euro(c.pagato)} € · restano ${euro(c.netto)} €`
  return `Fare la ricevuta ${quale} ${chi}, ${quanto}?`
}
