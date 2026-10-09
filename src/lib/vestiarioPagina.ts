import { centesimi } from './ricevute'
import {
  cifreTelefono,
  EMAIL_SBAGLIATA,
  emailOrdineGiusta,
  ilGiorno,
  inEuro,
  telefonoOrdineGiusto,
  TELEFONO_SBAGLIATO,
  type Raccolta,
  cosaNonVaCatalogo,
  ordiniAperti,
  prezzoDi,
  taglieDa,
  totaleOrdine,
  type Capo,
  type Catalogo,
  type Ordine,
  type OrdineNuovo,
  type Riga,
  type RigaCorretta,
} from './vestiario'

export type StatoPagina = 'aperti' | 'chiusi' | 'non aperti'

/**
 * Cosa dice la pagina pubblica. Senza catalogo, data o capi: «non aperti».
 * Altrimenti decide il database (`aperti` letto da `vestiario()`), col suo
 * orologio di Roma; senza (`undefined`, in prova) il giorno del dispositivo.
 */
export function statoPagina(c: Catalogo | null, apertiDb: boolean | undefined, oggi: string): StatoPagina {
  if (!c || !c.chiude || !c.capi.length) return 'non aperti'
  return (apertiDb ?? ordiniAperti(c, oggi)) ? 'aperti' : 'chiusi'
}

/** Un capo come si scrive nella bozza del catalogo: tutto testo, come nelle caselle. */
export interface CapoScritto {
  capo: string
  prezzo: string
  taglie: string
  nota: string
}
export interface BozzaCatalogo {
  chiude: string
  capi: CapoScritto[]
}

/**
 * Dalla bozza al catalogo da salvare, o quel che non va. I prezzi si scrivono
 * come sulle ricevute: «35», «12,50». Il resto lo dice `cosaNonVaCatalogo`,
 * con gli stessi messaggi del database.
 */
export function catalogoDaBozza(b: BozzaCatalogo): { catalogo: Catalogo } | { guaio: string } {
  const capi: Capo[] = []
  for (const x of b.capi) {
    const nome = x.capo.trim()
    if (!x.prezzo.trim()) return { guaio: `«${nome}» non ha un prezzo` }
    const cent = centesimi(x.prezzo)
    if (cent === null) return { guaio: `Il prezzo di «${nome || 'un capo senza nome'}» non si capisce: «${x.prezzo}»` }
    const nota = x.nota.trim()
    capi.push({ capo: nome, taglie: taglieDa(x.taglie), prezzo: cent / 100, ...(nota && { nota }) })
  }
  const catalogo: Catalogo = { chiude: b.chiude || null, capi }
  const guaio = cosaNonVaCatalogo(catalogo)
  return guaio ? { guaio } : { catalogo }
}

/** La riga che c'era e tiene il capo (scritto con o senza spazi); `undefined` per una nuova o un capo cambiato. */
const tieneIlCapo = (prima: ReadonlyArray<Riga>, r: RigaCorretta) => {
  const vecchia = r.id ? prima.find((x) => x.id === r.id) : undefined
  return vecchia && vecchia.capo === r.capo.trim() ? vecchia : undefined
}

/**
 * Il prezzo di una riga corretta, come lo mette il database: chi tiene il
 * capo tiene il suo prezzo anche cambiando taglia; un capo cambiato o una
 * riga nuova prendono quello del catalogo di adesso.
 */
export function prezzoRiga(prima: ReadonlyArray<Riga>, r: RigaCorretta, capi: Capo[]): number {
  return tieneIlCapo(prima, r)?.prezzo ?? prezzoDi(capi, r.capo)
}

/**
 * Le scelte di una riga da correggere: il catalogo, più capo e taglia della
 * riga se li tiene tutti e due, anche se il catalogo li ha tolti. Come
 * `correggi_ordine_vestiario`, che una riga invariata non la ricontrolla.
 */
export function capiPerRiga(prima: ReadonlyArray<Riga>, capi: Capo[]): (r: RigaCorretta) => Capo[] {
  return (r) => {
    const vecchia = tieneIlCapo(prima, r)
    return vecchia && vecchia.taglia === r.taglia.trim() ? capiPerCorreggere(capi, [vecchia]) : capi
  }
}

/** Il filtro di VESTIARIO: nome, cognome, per chi, senza maiuscole; o le cifre del telefono, scritte come si vuole. */
export function cercaOrdine(o: Ordine, testo: string): boolean {
  const t = testo.trim().toLowerCase()
  if (!t) return true
  if ([o.nome, o.cognome, ...o.righe.map((r) => r.perChi)].some((x) => x.toLowerCase().includes(t))) return true
  const cifre = t.replace(/\D/g, '')
  return !!cifre && cifreTelefono(o.telefono).includes(cifre)
}

/**
 * Per la barra in fondo alla pagina degli ordini: tutto quel che manca, non
 * solo il primo guaio come `cosaNonVaOrdine`, ognuno con la chiave del campo
 * a cui portare. Prima le righe, nell'ordine in cui si vedono, poi chi ordina.
 * Telefono ed email scritti male coi messaggi di `cosaNonVaOrdine`: chi
 * guarda la barra deve sapere già lì perché INVIA non va.
 */
export interface CosaManca {
  nome: string
  /** Il campo a cui portare. */
  chiave: string
  /** C'è, ma scritto male: la barra lo dice in un altro tono. */
  scrittoMale: boolean
}

export function mancaNellOrdine(o: OrdineNuovo, capi: Capo[]): CosaManca[] {
  const manca: CosaManca[] = []
  const metti = (nome: string, chiave: string, scrittoMale = false) => manca.push({ nome, chiave, scrittoMale })
  if (!o.righe.length) metti('Almeno un capo', 'righe')
  o.righe.forEach((r, i) => {
    const n = i + 1
    if (!r.perChi.trim()) metti(`Per chi è la riga ${n}`, `r${i}-perChi`)
    const capo = capi.find((c) => c.capo === r.capo)
    if (!capo) metti(`Il capo della riga ${n}`, `r${i}-capo`)
    else if (!capo.taglie.includes(r.taglia)) metti(`La taglia della riga ${n}`, `r${i}-taglia`)
  })
  if (!o.nome.trim()) metti('Il nome di chi ordina', 'nome')
  if (!o.cognome.trim()) metti('Il cognome di chi ordina', 'cognome')
  if (!o.telefono.trim()) metti('Il telefono di chi ordina', 'telefono')
  else if (!telefonoOrdineGiusto(o.telefono)) metti(TELEFONO_SBAGLIATO, 'telefono', true)
  if (!emailOrdineGiusta(o)) metti(EMAIL_SBAGLIATA, 'email', true)
  return manca
}

/**
 * Le scelte per correggere un ordine: il catalogo, più capo e taglia delle
 * righe che c'erano, anche se il catalogo li ha tolti (le righe restano come
 * sono, e una riga non cambiata si salva lo stesso).
 */
export function capiPerCorreggere(capi: Capo[], prima: ReadonlyArray<Pick<Riga, 'capo' | 'taglia' | 'prezzo'>>): Capo[] {
  const tutti = capi.map((c) => ({ ...c, taglie: [...c.taglie] }))
  for (const r of prima) {
    const c = tutti.find((x) => x.capo === r.capo)
    if (!c) tutti.push({ capo: r.capo, taglie: [r.taglia], prezzo: r.prezzo })
    else if (!c.taglie.includes(r.taglia)) c.taglie.push(r.taglia)
  }
  return tutti
}

/**
 * Il totale di una correzione prima di SALVA, come lo farà il database: una
 * riga che c'era e tiene il capo tiene il suo prezzo; un capo cambiato o una
 * riga nuova prendono quello del catalogo di adesso.
 */
export function totaleCorretto(prima: ReadonlyArray<Riga>, righe: ReadonlyArray<RigaCorretta>, capi: Capo[]): number {
  return totaleOrdine(
    righe.map((r) => {
      return { quanti: r.quanti, prezzo: prezzoRiga(prima, r, capi) }
    }),
  )
}

/**
 * Correggendo un ordine già saldato, il totale che sale va detto: c'è una
 * differenza da chiedere (o TOGLI IL SEGNO). Se scende resta saldato.
 */
export function avvisoSaldato(o: Pick<Ordine, 'saldato' | 'annullato' | 'totale'>, nuovo: number): string | null {
  if (!o.saldato || o.annullato || nuovo <= o.totale) return null
  return `L'ordine è già saldato: il totale passa da ${inEuro(o.totale)} a ${inEuro(nuovo)}.`
}

export type EffettoSalvataggio = { cosa: 'solo capi' | 'proroga' | 'raccolta nuova'; avviso: string | null }

/**
 * Cosa fa SALVA del catalogo sulle raccolte, la stessa regola di
 * `salva_vestiario()`: senza data o con la stessa, solo i capi; raccolta
 * aperta (fino al giorno di chiusura compreso), proroga; chiusa o assente,
 * raccolta nuova. L'avviso dice quel che la segreteria non si aspetta.
 */
export function effettoSalvataggio(r: Raccolta | undefined, chiude: string | null, oggi: string): EffettoSalvataggio {
  if (!chiude || chiude === r?.chiude) return { cosa: 'solo capi', avviso: null }
  const passata = chiude < oggi ? 'La data è già passata: la pagina degli ordini si chiude subito.' : null
  if (r && raccoltaAperta(r, oggi)) return { cosa: 'proroga', avviso: passata }
  const quella = r ? ilGiorno(r.chiude).replace(/^il /, 'del ').replace(/^l'/, "dell'") : ''
  const nuova = r ? `Si apre una raccolta nuova, vuota: gli ordini di prima restano in quella ${quella}.` : null
  return { cosa: 'raccolta nuova', avviso: [passata, nuova].filter(Boolean).join(' ') || null }
}

/** Una raccolta prende ordini fino al giorno di chiusura compreso. */
export const raccoltaAperta = (r: Raccolta, oggi: string) => oggi <= r.chiude

/** Dove si può spostare un ordine: mai nella sua; prima le raccolte aperte, poi le chiuse, ognuna per data. */
export function doveSpostare(raccolte: Raccolta[], o: Pick<Ordine, 'raccolta'>, oggi: string): Raccolta[] {
  const altre = raccolte.filter((r) => r.id !== o.raccolta).sort((a, b) => a.chiude.localeCompare(b.chiude))
  return [...altre.filter((r) => raccoltaAperta(r, oggi)), ...altre.filter((r) => !raccoltaAperta(r, oggi))]
}

/** Cambiando capo a una riga, la taglia resta se il capo nuovo ce l'ha; se no si sceglie di nuovo. */
export const tagliaDopo = (capi: Capo[], capo: string, taglia: string) =>
  capi.find((c) => c.capo === capo)?.taglie.includes(taglia) ? taglia : ''
