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
  MAX_RIGHE,
  MAX_RIGHE_DETTO,
  TIPI,
  type RigaNuova,
  type Tabelle,
  type Tipo,
  nomeTipo,
  type DatiVestiario,
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
  /** Vuoto o assente: senza tipo. */
  tipo?: Tipo | ''
  /** Il nome del file della foto, già nel contenitore o appena caricato. */
  foto?: string
}
export interface BozzaCatalogo {
  chiude: string
  capi: CapoScritto[]
  tabelle?: Tabelle
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
    // Il nome prima del prezzo: un capo appena aggiunto, ancora vuoto, manca di quello.
    if (!nome) return { guaio: 'Ogni capo ha un nome' }
    if (!x.prezzo.trim()) return { guaio: `«${nome}» non ha un prezzo` }
    const cent = centesimi(x.prezzo)
    if (cent === null) return { guaio: `Il prezzo di «${nome || 'un capo senza nome'}» non si capisce: «${x.prezzo}»` }
    const nota = x.nota.trim()
    capi.push({ capo: nome, taglie: taglieDa(x.taglie), prezzo: cent / 100, ...(nota && { nota }), ...(x.tipo && { tipo: x.tipo }), ...(x.foto && { foto: x.foto }) })
  }
  // Le tabelle anche vuote: vuote vuol dire che la segreteria le ha tolte tutte, assenti che non le tocca.
  const catalogo: Catalogo = { chiude: b.chiude || null, capi, ...(b.tabelle && { tabelle: b.tabelle }) }
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

/**
 * I tipi del passo IL TIPO, nell'ordine del modulo, solo quelli con capi.
 * Con un capo senza tipo (o nessun capo) non c'è passo: una pagina sola.
 */
export function tipiDaMostrare(capi: Capo[]): Tipo[] | 'pagina sola' {
  if (!capi.length || capi.some((c) => !c.tipo)) return 'pagina sola'
  return TIPI.map((t) => t.id).filter((id) => capi.some((c) => c.tipo === id))
}

/** I capi della pagina di un tipo, nell'ordine del catalogo; la pagina sola li ha tutti. */
export const capiDelTipo = (capi: Capo[], tipo: Tipo | 'pagina sola') => (tipo === 'pagina sola' ? capi : capi.filter((c) => c.tipo === tipo))

/** Quel che una persona ha scelto nella pagina di un tipo, per capo: taglia e quanti. */
export type Scelte = Record<string, { taglia: string; quanti?: number }>

/** Tornando sulla pagina di un tipo con la stessa persona, le scelte di prima. */
export function sceltePagina(righe: ReadonlyArray<RigaNuova>, perChi: string, capi: Capo[]): Scelte {
  const scelte: Scelte = {}
  for (const r of righe) if (stessaPersona(r.perChi, perChi) && capi.some((c) => c.capo === r.capo)) scelte[r.capo] = { taglia: r.taglia, quanti: r.quanti }
  return scelte
}

/**
 * Le righe dopo la pagina di un tipo: via quelle della persona per i capi
 * della pagina, dentro una per ogni capo con una taglia scelta. Le altre
 * restano. Oltre MAX_RIGHE si rifiuta con MAX_RIGHE_DETTO.
 */
export function applicaScelte(righe: ReadonlyArray<RigaNuova>, perChi: string, capi: Capo[], scelte: Scelte): RigaNuova[] {
  const diPagina = (r: RigaNuova) => stessaPersona(r.perChi, perChi) && capi.some((c) => c.capo === r.capo)
  const nuove = capi.flatMap((c) => {
    const s = scelte[c.capo]
    return s?.taglia ? [{ perChi, capo: c.capo, taglia: s.taglia, quanti: s.quanti ?? 1 }] : []
  })
  const tutte = [...righe.filter((r) => !diPagina(r)), ...nuove]
  if (tutte.length > MAX_RIGHE) throw new Error(MAX_RIGHE_DETTO)
  return tutte
}

/** Il riepilogo raggruppato per persona, nell'ordine in cui le persone arrivano. */
export function righePerPersona<R extends RigaNuova>(righe: ReadonlyArray<R>): Array<{ perChi: string; righe: R[] }> {
  // Per chiave della persona; il nome è come l'ha scritto la prima volta.
  const gruppi = new Map<string, { perChi: string; righe: R[] }>()
  for (const r of righe) {
    const g = gruppi.get(chiavePersona(r.perChi))
    if (g) g.righe.push(r)
    else gruppi.set(chiavePersona(r.perChi), { perChi: r.perChi, righe: [r] })
  }
  return [...gruppi.values()]
}

const fileUsati = (c: Catalogo) => new Set([...c.capi.flatMap((x) => (x.foto ? [x.foto] : [])), ...Object.values(c.tabelle ?? {})])

/** Dopo un SALVA riuscito: i file che il catalogo di prima usava e quello nuovo no, da cancellare. */
export function fotoDaTogliere(prima: Catalogo, dopo: Catalogo): string[] {
  const restano = fileUsati(dopo)
  return [...fileUsati(prima)].filter((f) => !restano.has(f))
}

/** Dove sta il genitore nella pagina pubblica: i passi del modulo, con la persona per cui sceglie. */
export type Passo =
  | { a: 'perChi' }
  | { a: 'tipo'; perChi: string }
  | { a: 'pagina'; perChi: string; tipo: Tipo | 'pagina sola' }
  | { a: 'altro'; perChi: string }
  | { a: 'chiOrdina' }

/** Dopo PER CHI È: il passo del tipo, o dritti alla pagina se il tipo è uno solo o non ci sono tipi. */
export function passoDopoPerChi(capi: Capo[], perChi: string): Passo {
  const tipi = tipiDaMostrare(capi)
  if (tipi === 'pagina sola') return { a: 'pagina', perChi, tipo: 'pagina sola' }
  return tipi.length === 1 ? { a: 'pagina', perChi, tipo: tipi[0] } : { a: 'tipo', perChi }
}

/** Un passo che col catalogo di adesso si può ancora mostrare. */
function passoVale(p: Passo, tipi: Tipo[] | 'pagina sola'): boolean {
  switch (p.a) {
    case 'perChi':
    case 'chiOrdina':
      return true
    case 'altro':
      return typeof p.perChi === 'string'
    case 'tipo':
      return typeof p.perChi === 'string' && tipi !== 'pagina sola'
    case 'pagina':
      return typeof p.perChi === 'string' && (p.tipo === 'pagina sola' ? tipi === 'pagina sola' : tipi !== 'pagina sola' && tipi.includes(p.tipo))
    default:
      return false
  }
}

/** Chi ordina, come scritto in CHI ORDINA: resta se la pagina si ricarica. */
export type ChiOrdina = Pick<OrdineNuovo, 'nome' | 'cognome' | 'telefono' | 'email'>

export interface Ripresa {
  storia: Passo[]
  righe: RigaNuova[]
  /** L'id del dispositivo dell'ordine in corso. */
  id: string
  chi?: ChiOrdina
}

const eChiOrdina = (x: unknown): x is ChiOrdina => {
  if (!x || typeof x !== 'object') return false
  // Il cast: un oggetto qualsiasi letto da sessionStorage; ogni campo si controlla qui sotto.
  const c = x as Record<string, unknown>
  return ['nome', 'cognome', 'telefono'].every((k) => typeof c[k] === 'string') && (c.email == null || typeof c.email === 'string')
}

/**
 * Le scelte salvate (sessionStorage) quando la pagina si ricarica. Le righe
 * di capi o taglie che il catalogo non ha più se ne vanno; se un passo non si
 * può più mostrare (la segreteria ha cambiato i tipi) la storia riparte da
 * PER CHI È, con le righe che restano. `null` se non c'è niente da riprendere.
 */
export function ripresaDa(testo: string | null, capi: Capo[]): Ripresa | null {
  if (!testo) return null
  let x: Partial<Ripresa> | null
  try {
    // Il cast: è quel che la pagina stessa ha scritto; ogni pezzo si ricontrolla sotto.
    x = JSON.parse(testo) as Partial<Ripresa> | null
  } catch {
    return null
  }
  if (!x || typeof x !== 'object') return null
  const righe = (Array.isArray(x.righe) ? x.righe : []).filter((r) => capi.some((c) => c.capo === r?.capo && c.taglie.includes(r.taglia)))
  const tipi = tipiDaMostrare(capi)
  const storia = Array.isArray(x.storia) && x.storia.length && x.storia.every((p) => p && passoVale(p, tipi)) ? x.storia : [{ a: 'perChi' } as const]
  return { storia, righe, id: typeof x.id === 'string' && x.id ? x.id : crypto.randomUUID(), ...(eChiOrdina(x.chi) && { chi: x.chi }) }
}

/** Cambiato il nome a PER CHI È: le righe di quella persona lo seguono. */
export const rinomina = <R extends RigaNuova>(righe: ReadonlyArray<R>, da: string, a: string): R[] => righe.map((r) => (r.perChi === da ? { ...r, perChi: a } : r))

/** Le tabelle delle taglie in cima a una pagina: quella del tipo, o tutte nella pagina sola, nell'ordine dei tipi. */
export function tabelleDellaPagina(tabelle: Tabelle | undefined, tipo: Tipo | 'pagina sola'): Array<{ tipo: Tipo; nome: string }> {
  return TIPI.flatMap((t) => {
    const nome = tabelle?.[t.id]
    return nome && (tipo === 'pagina sola' || tipo === t.id) ? [{ tipo: t.id, nome }] : []
  })
}

/** La riga della barra prima di SALVA: quali foto e tabelle di prima se ne vanno. Vuota se nessuna. */
export function cosaSiCancella(prima: Catalogo, dopo: Catalogo): string {
  const via = new Set(fotoDaTogliere(prima, dopo))
  const cose = [
    ...prima.capi.filter((c) => c.foto && via.has(c.foto)).map((c) => `la foto di prima di ${c.capo}`),
    ...TIPI.filter((t) => prima.tabelle?.[t.id] && via.has(prima.tabelle[t.id]!)).map((t) => `la tabella delle taglie di ${nomeTipo(t.id)}`),
  ]
  if (!cose.length) return ''
  return `Con SALVA ${cose.length === 1 ? 'si cancella' : 'si cancellano'} ${elencoDetto(cose)}.`
}

/**
 * SALVA del catalogo con le foto nuove della bozza (`nuove`: nome provvisorio
 * → file). Prima si caricano solo quelle che il catalogo usa ancora, poi si
 * salva coi nomi veri, poi si tolgono i file di prima che non servono più.
 * Se qualcosa cade, i file appena caricati si tolgono e i vecchi restano:
 * BUTTA I CAMBI non lascia niente sul server.
 */
export async function salvaConFoto(
  d: Pick<DatiVestiario, 'caricaFoto' | 'salvaCatalogo' | 'togliFoto'>,
  catalogo: Catalogo,
  nuove: Readonly<Record<string, Blob>>,
  salvato: Catalogo | null,
): Promise<Catalogo> {
  const veri = new Map<string, string>()
  const butta = async (e: unknown) => {
    if (veri.size) await d.togliFoto([...veri.values()])
    throw e
  }
  try {
    for (const nome of fileUsati(catalogo)) if (nome && nuove[nome]) veri.set(nome, await d.caricaFoto(nuove[nome]))
  } catch (e) {
    return butta(e)
  }
  const vero = (nome: string) => veri.get(nome) ?? nome
  const finale: Catalogo = {
    ...catalogo,
    capi: catalogo.capi.map((c) => (c.foto ? { ...c, foto: vero(c.foto) } : c)),
    ...(catalogo.tabelle && { tabelle: Object.fromEntries(Object.entries(catalogo.tabelle).map(([t, n]) => [t, n && vero(n)])) as Tabelle }),
  }
  try {
    await d.salvaCatalogo(finale)
  } catch (e) {
    return butta(e)
  }
  const via = salvato ? fotoDaTogliere(salvato, finale) : []
  if (via.length) await d.togliFoto(via)
  return finale
}

/** Una persona si riconosce senza badare a maiuscole e spazi: «luca  rossini» è Luca Rossini. */
const chiavePersona = (nome: string) => nome.trim().replace(/\s+/g, ' ').toLowerCase()
export const stessaPersona = (a: string, b: string) => chiavePersona(a) === chiavePersona(b)

/**
 * PER CHI È con un nome che nell'ordine c'è già (anche scritto in un altro
 * modo), tranne la persona che si sta rinominando: due modi di scrivere lo
 * stesso bambino farebbero due gruppi. `null` se va.
 */
export function nomeGiaUsato(righe: ReadonlyArray<RigaNuova>, nome: string, tranne?: string): string | null {
  const gia = righe.find((r) => stessaPersona(r.perChi, nome) && !(tranne !== undefined && stessaPersona(r.perChi, tranne)))
  return gia ? `"${gia.perChi}" è già in quest'ordine: torna ai suoi passi con INDIETRO` : null
}

/** «a», «a e b», «a, b e c»: come si dice un elenco. */
const elencoDetto = (cose: string[]) => (cose.length < 2 ? (cose[0] ?? '') : `${cose.slice(0, -1).join(', ')} e ${cose[cose.length - 1]}`)

/** I capi senza tipo, che fanno la pagina sola: la segreteria vede quali sistemare. */
export const capiSenzaTipo = (capi: Capo[]) => capi.filter((c) => !c.tipo).map((c) => c.capo)

/** Tornando a PER CHI È con un ordine già cominciato: quanti capi e per chi, con le persone del riepilogo. */
export function ordineAMeta(righe: ReadonlyArray<RigaNuova>): string | null {
  if (!righe.length) return null
  const capi = righe.reduce((n, r) => n + r.quanti, 0)
  return `Hai già scelto ${capi} ${capi === 1 ? 'capo' : 'capi'} per ${elencoDetto(righePerPersona(righe).map((g) => g.perChi))}`
}
