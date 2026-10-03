import { COSTI, OFFERTE, QUOTA_ASSOCIATIVA, SALDO_ENTRO, type Prezzi, type VoceCosto } from './costi'
import { haUnServer } from './dati'

/**
 * Il listino che vale: quello che la segreteria ha cambiato da LISTINO, o
 * quello del foglio (`costi.ts`) finché non l'ha mai toccato.
 *
 * Lo leggono la pagina di iscrizione, anche chi non ha un accesso, e le voci
 * delle ricevute. Col database sta nella riga delle impostazioni
 * (`supabase/19-listino.sql`), e chi non ha un accesso lo legge dalla
 * funzione `listino()`; in prova sta sul dispositivo. Vuoto vuol dire il
 * foglio: così un listino mai cambiato segue `costi.ts` quando si aggiorna
 * l'app, e RIMETTI IL FOGLIO torna lì.
 *
 * I prezzi sono in euro, come nel foglio.
 */

export interface Offerta {
  titolo: string
  testo: string
}

export interface Listino {
  /** La quota associativa. */
  quota: number
  /** Fino a quando vale il prezzo a saldo, compreso: `AAAA-MM-GG`. */
  saldoEntro: string
  corsi: VoceCosto[]
  offerte: Offerta[]
}

export const LISTINO_PREDEFINITO: Listino = { quota: QUOTA_ASSOCIATIVA, saldoEntro: SALDO_ENTRO, corsi: COSTI, offerte: OFFERTE }

/** Il listino e se è quello della segreteria o quello del foglio. */
export interface ListinoLetto {
  listino: Listino
  /** Cambiato dalla segreteria: il PDF del foglio non gli corrisponde più. */
  cambiato: boolean
}

export const LIMITI = { corsi: 60, prezzi: 8, offerte: 10, orari: 6, prezzo: 10000 }

const testo = (x: unknown, max: number) => (typeof x === 'string' && x.trim() ? x.trim().slice(0, max) : undefined)
const euro = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) && x >= 0 && x <= LIMITI.prezzo ? Math.round(x * 100) / 100 : undefined)
const anno = (x: unknown) => (typeof x === 'number' && Number.isInteger(x) && x >= 1900 && x <= 2100 ? x : undefined)
/** Un anno scritto in LISTINO: `undefined` se è vuoto, `null` se non si capisce. Gli stessi limiti di quando si legge. */
export function annoScritto(t: string): number | undefined | null {
  const s = t.trim()
  if (!s) return undefined
  return (/^\d{4}$/.test(s) && anno(Number(s))) || null
}
const giorno = (x: unknown) => (typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x) && !Number.isNaN(Date.parse(x)) ? x : undefined)
const senzaVuoti = <T extends object>(o: T) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T

// Lo stesso valore scritto sempre allo stesso modo: le chiavi in ordine.
const inOrdine = (x: unknown): unknown =>
  Array.isArray(x) ? x.map(inOrdine) : x && typeof x === 'object' ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, inOrdine(v)])) : x

/**
 * C'è qualcosa da perdere nel LISTINO? Si confrontano i listini come si
 * salverebbero (o quel che non va, se non si salverebbe): una modifica
 * rimessa com'era non conta, l'ordine dei corsi sì.
 */
export function listinoCambiato(salvato: Listino | string, bozza: Listino | string): boolean {
  return JSON.stringify(inOrdine(salvato)) !== JSON.stringify(inOrdine(bozza))
}

/**
 * Il listino da quello che arriva dal database o dal dispositivo, preso con
 * le pinze: quello che non si capisce resta fuori, e se non resta niente di
 * usabile vale il foglio. `null` vuol dire mai cambiato.
 */
export function listinoDa(x: unknown): Listino | null {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return null
  const o = x as Record<string, unknown>
  const corsi = (Array.isArray(o.corsi) ? o.corsi : []).slice(0, LIMITI.corsi).flatMap((c): VoceCosto[] => {
    if (!c || typeof c !== 'object') return []
    const v = c as Record<string, unknown>
    const corso = testo(v.corso, 80)
    if (!corso) return []
    const prezzi = (Array.isArray(v.prezzi) ? v.prezzi : []).slice(0, LIMITI.prezzi).flatMap((p): Prezzi[] => {
      if (!p || typeof p !== 'object') return []
      const q = p as Record<string, unknown>
      const r = senzaVuoti({ etichetta: testo(q.etichetta, 40), saldo: euro(q.saldo), annuale: euro(q.annuale), trimestre: euro(q.trimestre) })
      return r.saldo === undefined && r.annuale === undefined && r.trimestre === undefined ? [] : [r]
    })
    const orari = (Array.isArray(v.orari) ? v.orari : []).slice(0, LIMITI.orari).flatMap((s) => testo(s, 120) ?? [])
    return [senzaVuoti({ corso, eta: testo(v.eta, 120) ?? '', natiDal: anno(v.natiDal), natiAl: anno(v.natiAl), orari, prezzi, notaTrimestre: testo(v.notaTrimestre, 60), nota: testo(v.nota, 300) })]
  })
  const offerte = (Array.isArray(o.offerte) ? o.offerte : []).slice(0, LIMITI.offerte).flatMap((f): Offerta[] => {
    if (!f || typeof f !== 'object') return []
    const t = f as Record<string, unknown>
    const titolo = testo(t.titolo, 60)
    const detto = testo(t.testo, 400)
    return titolo && detto ? [{ titolo, testo: detto }] : []
  })
  if (!corsi.length) return null
  return {
    quota: euro(o.quota) ?? LISTINO_PREDEFINITO.quota,
    saldoEntro: giorno(o.saldoEntro) ?? LISTINO_PREDEFINITO.saldoEntro,
    corsi,
    offerte,
  }
}

/** Per confrontare i nomi dei corsi: le ricevute li trovano così. */
export const nomeCorso = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/[^a-z0-9]+/g, ' ').trim()

/** L'anno di nascita, se la data è vera: a metà (vuota, «0002-…») non dice niente. */
function annoDi(natoIl: string): number | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(natoIl)) return undefined
  const a = Number(natoIl.slice(0, 4))
  return a >= 1900 ? a : undefined
}

const fuori = (v: VoceCosto | undefined, a: number | undefined) =>
  a !== undefined && !!v && ((v.natiDal !== undefined && a < v.natiDal) || (v.natiAl !== undefined && a > v.natiAl))

const vocePer = (nome: string, voci: VoceCosto[]) => voci.find((v) => nomeCorso(v.corso) === nomeCorso(nome))

/** Se un corso non è per l'anno di nascita di chi si iscrive: lo dice il listino, coi suoi anni. */
export const fuoriEta = (nome: string, natoIl: string, voci: VoceCosto[]) => fuori(vocePer(nome, voci), annoDi(natoIl))

export interface CorsoPerEta {
  id: string
  nome: string
  /** Età e orari dal listino, da leggere sotto il nome. */
  riga?: string
}

/**
 * I corsi del modulo di iscrizione, divisi per l'anno di nascita: prima
 * quelli che vanno bene, poi gli altri, che si possono scegliere lo stesso.
 * Nessuno sparisce. Un corso va negli altri solo se il listino ha i suoi anni
 * e l'anno è fuori; senza data vera vanno tutti bene, in un elenco solo. Con
 * la data, i corsi che il listino non dice per che anni (o che non ha) stanno
 * a parte (`senzaAnni`): in cima sembrerebbero della sua età.
 * Per il resto l'ordine è quello del listino, poi i corsi che il listino non
 * ha, in ordine di nome.
 */
export function corsiPerEta(
  corsi: ReadonlyArray<{ id: string; nome: string }>,
  voci: VoceCosto[],
  natoIl: string,
): { adatti: CorsoPerEta[]; senzaAnni: CorsoPerEta[]; altri: CorsoPerEta[] } {
  const a = annoDi(natoIl)
  const posto = (nome: string) => {
    const i = voci.findIndex((v) => nomeCorso(v.corso) === nomeCorso(nome))
    return i < 0 ? voci.length : i
  }
  const ordinati = [...corsi].sort((x, y) => posto(x.nome) - posto(y.nome) || x.nome.localeCompare(y.nome, 'it'))
  const giusti: CorsoPerEta[] = []
  const perTutti: CorsoPerEta[] = []
  const altri: CorsoPerEta[] = []
  for (const c of ordinati) {
    const v = vocePer(c.nome, voci)
    const riga = v ? [v.eta, ...v.orari].filter((t) => t.trim()).join(' · ') || undefined : undefined
    const conAnni = a !== undefined && (v?.natiDal !== undefined || v?.natiAl !== undefined)
    ;(fuori(v, a) ? altri : conAnni ? giusti : perTutti).push({ id: c.id, nome: c.nome, riga })
  }
  // Senza data non si sa niente: un elenco solo.
  return a === undefined ? { adatti: perTutti, senzaAnni: [], altri } : { adatti: giusti, senzaAnni: perTutti, altri }
}

/** Quello che non va, detto prima di salvare; `null` se va bene. */
export function cosaNonVaListino(l: Listino): string | null {
  if (!(l.quota >= 0 && l.quota <= LIMITI.prezzo)) return 'La quota associativa non va'
  if (!giorno(l.saldoEntro)) return 'La data del saldo non va'
  if (!l.corsi.length) return 'Serve almeno un corso'
  if (l.corsi.length > LIMITI.corsi) return `Al massimo ${LIMITI.corsi} corsi`
  if (l.offerte.length > LIMITI.offerte) return `Al massimo ${LIMITI.offerte} offerte`
  const visti = new Set<string>()
  for (const c of l.corsi) {
    const nome = c.corso.trim()
    if (!nome) return 'Ogni corso vuole un nome'
    if (nome.length > 80) return `Il nome di «${nome.slice(0, 20)}…» è troppo lungo`
    if (visti.has(nomeCorso(nome))) return `«${nome}» c’è due volte: le ricevute non saprebbero quale prendere`
    visti.add(nomeCorso(nome))
    if (!c.prezzi.length) return `«${nome}» non ha prezzi`
    if (c.prezzi.length > LIMITI.prezzi) return `«${nome}» ha troppe righe di prezzi: al massimo ${LIMITI.prezzi}`
    if (c.orari.length > LIMITI.orari) return `«${nome}» ha troppi orari: al massimo ${LIMITI.orari}`
    if (c.natiDal !== undefined && c.natiAl !== undefined && c.natiDal > c.natiAl) return `Gli anni di nascita di «${nome}» sono al contrario: in NATI DAL va l’anno più vecchio`
    for (const p of c.prezzi) {
      if (p.saldo === undefined && p.annuale === undefined && p.trimestre === undefined) return `Una riga di «${nome}» non ha nessun prezzo`
      for (const n of [p.saldo, p.annuale, p.trimestre]) if (n !== undefined && !(n >= 0 && n <= LIMITI.prezzo)) return `Un prezzo di «${nome}» non va`
    }
    if (c.prezzi.length > 1 && c.prezzi.some((p) => !p.etichetta?.trim())) return `«${nome}» ha più righe di prezzi: ognuna vuole il suo nome (1 GIORNO, 2 GIORNI…)`
  }
  for (const o of l.offerte) if (!o.titolo.trim() || !o.testo.trim()) return 'Ogni offerta vuole un titolo e un testo'
  return null
}

/**
 * Il listino in prova: sul dispositivo, a parte dall'archivio di prova, così
 * la pagina di iscrizione lo legge senza caricarsi tutto l'archivio.
 */
const DOVE_PROVA = 'ods-corsi:listino-prova'

export function listinoProva(): unknown {
  try {
    const g = localStorage.getItem(DOVE_PROVA)
    return g ? JSON.parse(g) : null
  } catch {
    return null
  }
}

export function salvaListinoProva(l: Listino | null) {
  try {
    if (l) localStorage.setItem(DOVE_PROVA, JSON.stringify(l))
    else localStorage.removeItem(DOVE_PROVA)
  } catch {
    /* resta per questa pagina */
  }
  scordaListino()
}

export const scordaListinoProva = () => salvaListinoProva(null)

let inArrivo: Promise<ListinoLetto> | null = null

/**
 * Il listino per la pagina di iscrizione, letto una volta per pagina. Se il
 * database non risponde, o `19-listino.sql` non c'è ancora, vale il foglio.
 */
export function caricaListino(): Promise<ListinoLetto> {
  if (!inArrivo) {
    const leggi: Promise<unknown> = haUnServer
      ? import('./supabase').then(async (s) => {
          const { data, error } = await s.clientSupabase().rpc('listino')
          if (error) throw error
          return data
        })
      : Promise.resolve(listinoProva())
    inArrivo = leggi.then(
      (x) => {
        const l = listinoDa(x)
        return l ? { listino: l, cambiato: true } : { listino: LISTINO_PREDEFINITO, cambiato: false }
      },
      (e) => {
        // PGRST202: la funzione non c'è, il file 19 non è ancora stato lanciato.
        if ((e as { code?: string })?.code !== 'PGRST202') console.warn('Il listino non si è letto, vale quello del foglio:', e)
        inArrivo = null
        return { listino: LISTINO_PREDEFINITO, cambiato: false }
      },
    )
  }
  return inArrivo
}

/** Dopo un salvataggio: la prossima lettura va al database. */
export function scordaListino() {
  inArrivo = null
}
