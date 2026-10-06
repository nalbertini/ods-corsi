import { COSTI, OFFERTE, QUOTA_ASSOCIATIVA, SALDO_ENTRO, type Prezzi, type VoceCosto } from './costi'
import { haUnServer } from './dati'
import { anni as anniDi } from './richieste'

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
  /** Gli id dei corsi che non hanno un prezzo e va bene così (prova gratuita, corso interno). */
  senzaPrezzoVaBene?: string[]
}

/** Un corso di CORSI, quanto basta per trovare la sua voce. */
export interface CorsoRef {
  id: string
  nome: string
}
type CorsoDi = CorsoRef & { attivo: boolean }

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
const etaMinima = (x: unknown) => (typeof x === 'number' && Number.isInteger(x) && x >= 1 && x <= 99 ? x : undefined)
/** L'età minima scritta in LISTINO: `undefined` se è vuota, `null` se non si capisce (un numero da 1 a 99). */
export function etaMinimaScritta(t: string): number | undefined | null {
  const s = t.trim()
  if (!s) return undefined
  return (/^\d+$/.test(s) && etaMinima(Number(s))) || null
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
  // I corsi senza prezzo sono un elenco, non una fila: tolto e rimesso, è lo stesso.
  const scritto = (l: Listino | string) => JSON.stringify(inOrdine(typeof l === 'string' ? l : { ...l, senzaPrezzoVaBene: [...(l.senzaPrezzoVaBene ?? [])].sort() }))
  return scritto(salvato) !== scritto(bozza)
}

/** La bozza del LISTINO com'è scritta: i corsi si riconoscono dalla chiave, anche coi prezzi che non si capiscono. */
export interface BozzaDaConfrontare {
  quota: string
  saldoEntro: string
  corsi: ReadonlyArray<{ chiave: number; corso: string }>
  offerte: ReadonlyArray<{ chiave: number }>
  senzaPrezzoVaBene: ReadonlyArray<string>
}

const senzaChiave = ({ chiave: _, ...resto }: { chiave: number }) => JSON.stringify(inOrdine(resto))

/**
 * Cosa si perde buttando la bozza, in parole: chi butta dopo una telefonata
 * non ricorda se ha cambiato un prezzo o cinque corsi.
 */
export function cambiNellaBozza(salvata: BozzaDaConfrontare, bozza: BozzaDaConfrontare): string[] {
  const nome = (c: { corso: string }) => `«${c.corso.trim() || 'un corso senza nome'}»`
  const prima = new Map(salvata.corsi.map((c) => [c.chiave, c]))
  const dopo = new Set(bozza.corsi.map((c) => c.chiave))
  const cambi: string[] = []
  // Prima quel che vale per tutto il listino: in coda, tagliato da «e altri…», si perderebbe.
  if (salvata.quota.trim() !== bozza.quota.trim()) cambi.push('la quota')
  if (salvata.saldoEntro !== bozza.saldoEntro) cambi.push('la data del saldo')
  const comuni = (l: BozzaDaConfrontare['corsi']) => l.filter((c) => prima.has(c.chiave) && dopo.has(c.chiave)).map((c) => c.chiave).join()
  if (comuni(salvata.corsi) !== comuni(bozza.corsi)) cambi.push('l’ordine dei corsi')
  if (salvata.offerte.map(senzaChiave).join() !== bozza.offerte.map(senzaChiave).join()) cambi.push('le offerte')
  if ([...salvata.senzaPrezzoVaBene].sort().join() !== [...bozza.senzaPrezzoVaBene].sort().join()) cambi.push('i corsi senza prezzo')
  for (const c of bozza.corsi) {
    const p = prima.get(c.chiave)
    if (!p) cambi.push(`${nome(c)} (nuovo)`)
    else if (senzaChiave(p) !== senzaChiave(c)) cambi.push(nome(c))
  }
  for (const c of salvata.corsi) if (!dopo.has(c.chiave)) cambi.push(`${nome(c)} (tolto)`)
  return cambi
}

/** La domanda di BUTTA I CAMBI: cosa si perde, i primi sei e quanti altri, e a cosa si torna. */
export function domandaButta(cambi: ReadonlyArray<string>): string {
  const altri = cambi.length - 6
  const detto = altri > 0 ? `${cambi.slice(0, 6).join(', ')} e ${altri === 1 ? 'un altro cambio' : `altri ${altri} cambi`}` : cambi.join(', ')
  return `Buttare i cambi al listino? ${detto ? `Hai cambiato: ${detto}. ` : ''}Il listino torna com’è salvato, quello che vede la pagina di iscrizione.`
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
    return [senzaVuoti({ corso, corsoId: testo(v.corsoId, 80), eta: testo(v.eta, 120) ?? '', natiDal: anno(v.natiDal), natiAl: anno(v.natiAl), etaMinima: etaMinima(v.etaMinima), orari, prezzi, notaTrimestre: testo(v.notaTrimestre, 60), nota: testo(v.nota, 300) })]
  })
  const offerte = (Array.isArray(o.offerte) ? o.offerte : []).slice(0, LIMITI.offerte).flatMap((f): Offerta[] => {
    if (!f || typeof f !== 'object') return []
    const t = f as Record<string, unknown>
    const titolo = testo(t.titolo, 60)
    const detto = testo(t.testo, 400)
    return titolo && detto ? [{ titolo, testo: detto }] : []
  })
  if (!corsi.length) return null
  const vaBene = (Array.isArray(o.senzaPrezzoVaBene) ? o.senzaPrezzoVaBene : []).flatMap((i) => testo(i, 80) ?? [])
  return senzaVuoti({
    quota: euro(o.quota) ?? LISTINO_PREDEFINITO.quota,
    saldoEntro: giorno(o.saldoEntro) ?? LISTINO_PREDEFINITO.saldoEntro,
    corsi,
    offerte,
    senzaPrezzoVaBene: vaBene.length ? vaBene : undefined,
  })
}

/** Per confrontare i nomi dei corsi: le ricevute li trovano così. */
export const nomeCorso = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/[^a-z0-9]+/g, ' ').trim()

/**
 * Il mese di nascita, contato dall'anno 0 (anno × 12 + mese da 0 a 11), se la
 * data è vera: a metà (vuota, «0002-…») non dice niente.
 */
function meseDi(natoIl: string): number | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(natoIl)) return undefined
  const a = Number(natoIl.slice(0, 4))
  return a >= 1900 ? a * 12 + Number(natoIl.slice(5, 7)) - 1 : undefined
}

/**
 * Chi è nato a meno di sei mesi dagli anni del corso ci sta lo stesso: la
 * palestra lo prende senza richiamarlo. Mesi interi, da luglio dell'anno
 * prima di NATI DAL a giugno dell'anno dopo NATI AL.
 */
const TOLLERANZA_MESI = 6

const fuori = (v: VoceCosto | undefined, m: number | undefined) =>
  m !== undefined &&
  !!v &&
  ((v.natiDal !== undefined && m < v.natiDal * 12 - TOLLERANZA_MESI) || (v.natiAl !== undefined && m > v.natiAl * 12 + 11 + TOLLERANZA_MESI))

const comeCorso = (c: string | CorsoRef): CorsoRef => (typeof c === 'string' ? { id: '', nome: c } : c)

/**
 * La voce di un corso: l'unica ricerca, per tutti. Prima l'id; il nome conta
 * solo per le voci che non hanno ancora un id (listino vecchio, foglio), o se
 * di id non se ne ha (un nome scritto e basta).
 */
export function voceDelCorso(voci: VoceCosto[], corso: string | CorsoRef): VoceCosto | undefined {
  const c = comeCorso(corso)
  return (c.id ? voci.find((v) => v.corsoId === c.id) : undefined) ?? voci.find((v) => (!v.corsoId || !c.id) && nomeCorso(v.corso) === nomeCorso(c.nome))
}

/** Gli anni di nascita di un corso, come li legge la segreteria. Vuoti, il corso va bene per tutti. */
export function anniDiNascita(v: { natiDal?: number | string; natiAl?: number | string }) {
  const { natiDal: dal, natiAl: al } = v
  return dal && al ? `nati ${dal}–${al}` : dal ? `nati dal ${dal}` : al ? `nati fino al ${al}` : 'senza anni di nascita'
}

/** Se un corso non è per la data di nascita di chi si iscrive: lo dice il listino, coi suoi anni e i sei mesi di tolleranza. */
export const fuoriEta = (corso: string | CorsoRef, natoIl: string, voci: VoceCosto[]) => fuori(voceDelCorso(voci, corso), meseDi(natoIl))

export interface CorsoPerEta {
  id: string
  nome: string
  /** Età e orari dal listino, da leggere sotto il nome. */
  riga?: string
  /** Il listino non ha il suo prezzo: chi si iscrive lo sa, la segreteria lo conferma. */
  prezzoDaConfermare?: true
}

/**
 * I corsi del modulo di iscrizione, divisi per l'anno di nascita: prima
 * quelli che vanno bene, poi gli altri, che si possono scegliere lo stesso.
 * Nessuno sparisce, salvo i corsi «dai N anni» (`etaMinima`) per chi è più piccolo: finiscono in `nascosti`. Un corso va negli altri solo se il listino ha i suoi anni
 * e la data è fuori, anche coi sei mesi; senza data vera vanno tutti bene, in un elenco solo. Con
 * la data, i corsi che il listino non dice per che anni (o che non ha) stanno
 * a parte (`senzaAnni`): in cima sembrerebbero della sua età.
 * Per il resto l'ordine è quello del listino, poi i corsi che il listino non
 * ha, in ordine di nome.
 */
export function corsiPerEta(
  corsi: ReadonlyArray<{ id: string; nome: string }>,
  voci: VoceCosto[],
  natoIl: string,
  senzaPrezzoVaBene: readonly string[] = [],
  oggi = new Date(),
): { adatti: CorsoPerEta[]; senzaAnni: CorsoPerEta[]; altri: CorsoPerEta[]; nascosti: string[] } {
  const a = meseDi(natoIl)
  const anni = a === undefined ? undefined : anniDi(natoIl, oggi)
  const posto = (c: CorsoRef) => {
    const v = voceDelCorso(voci, c)
    return v ? voci.indexOf(v) : voci.length
  }
  const ordinati = [...corsi].sort((x, y) => posto(x) - posto(y) || x.nome.localeCompare(y.nome, 'it'))
  const giusti: CorsoPerEta[] = []
  const perTutti: CorsoPerEta[] = []
  const altri: CorsoPerEta[] = []
  const nascosti: string[] = []
  for (const c of ordinati) {
    const v = voceDelCorso(voci, c)
    // «Dai N anni»: chi è più piccolo non lo vede, e la frase sotto l'elenco manda a chiamare la segreteria.
    if (anni !== undefined && v?.etaMinima !== undefined && anni < v.etaMinima) {
      nascosti.push(c.nome)
      continue
    }
    const eta = v?.eta.trim() ? v.eta : v?.etaMinima !== undefined ? `dai ${v.etaMinima} anni` : ''
    const riga = v ? [eta, ...v.orari].filter((t) => t.trim()).join(' · ') || undefined : undefined
    const conAnni = a !== undefined && (v?.natiDal !== undefined || v?.natiAl !== undefined || v?.etaMinima !== undefined)
    const daConfermare = !v && !senzaPrezzoVaBene.includes(c.id)
    ;(fuori(v, a) ? altri : conAnni ? giusti : perTutti).push({ id: c.id, nome: c.nome, riga, ...(daConfermare && { prezzoDaConfermare: true as const }) })
  }
  // Senza data non si sa niente: un elenco solo.
  return a === undefined ? { adatti: perTutti, senzaAnni: [], altri, nascosti } : { adatti: giusti, senzaAnni: perTutti, altri, nascosti }
}

/** I corsi scelti che la data di nascita (corretta dopo) non nasconde: quelli «dai N anni» per chi è più piccolo non partono con la richiesta. */
export function corsiAmmessi(scelti: readonly string[], corsi: ReadonlyArray<{ id: string; nome: string }>, voci: VoceCosto[], natoIl: string, oggi = new Date()): string[] {
  const nascosti = new Set(corsiPerEta(corsi, voci, natoIl, [], oggi).nascosti)
  return scelti.filter((id) => !nascosti.has(corsi.find((c) => c.id === id)?.nome ?? ''))
}

/**
 * Le voci senza id che coincidono con un solo corso (e lo coincidono da sole)
 * prendono il suo id. Quelle dubbie (nomi doppi, corsi omonimi, corso già
 * preso) restano senza corso: le aggancia la segreteria da LISTINO.
 */
export function agganciaPerNome(l: Listino, corsi: ReadonlyArray<CorsoRef>): Listino {
  const presi = new Set(l.corsi.flatMap((v) => v.corsoId ?? []))
  const nomi = (v: VoceCosto) => nomeCorso(v.corso)
  return {
    ...l,
    corsi: l.corsi.map((v) => {
      if (v.corsoId) return v
      const candidati = corsi.filter((c) => nomeCorso(c.nome) === nomi(v))
      const doppie = l.corsi.filter((x) => !x.corsoId && nomi(x) === nomi(v)).length > 1
      return candidati.length === 1 && !doppie && !presi.has(candidati[0].id) ? { ...v, corsoId: candidati[0].id } : v
    }),
  }
}

/** I corsi che si possono scegliere per una voce: quelli che non ne hanno già una (e quello della voce che si sta cambiando). */
export const corsiScegliibili = <T extends { id: string }>(corsi: readonly T[], voci: ReadonlyArray<{ corsoId?: string }>, corsoIdAttuale?: string): T[] =>
  corsi.filter((c) => c.id === corsoIdAttuale || !voci.some((v) => v.corsoId === c.id))

/**
 * Cosa non quadra fra CORSI e listino, coi nomi da mostrare alla segreteria:
 * i corsi attivi senza prezzo, le voci senza corso (da agganciare) e le voci
 * di un corso tolto. Un corso archiviato tiene la sua voce, senza rosso.
 */
export const corsiSenzaPrezzo = (l: Listino, corsi: ReadonlyArray<CorsoDi>): CorsoDi[] =>
  corsi.filter((c) => c.attivo && !voceDelCorso(l.corsi, c) && !l.senzaPrezzoVaBene?.includes(c.id))

export function segnalazioniListino(l: Listino, corsi: ReadonlyArray<CorsoDi>) {
  const ids = new Set(corsi.map((c) => c.id))
  return {
    senzaPrezzo: corsiSenzaPrezzo(l, corsi).map((c) => c.nome),
    senzaCorso: l.corsi.filter((v) => !v.corsoId && !corsi.some((c) => nomeCorso(c.nome) === nomeCorso(v.corso))).map((v) => v.corso),
    tolti: l.corsi.filter((v) => v.corsoId && !ids.has(v.corsoId)).map((v) => v.corso),
  }
}

/**
 * Il listino per le ricevute: senza le voci di un corso che non c'è più (non
 * propongono prezzi) e col nome che il corso ha ora in CORSI, anche se dopo la
 * rinomina il listino non è stato risalvato.
 */
export const listinoUsabile = (l: Listino, corsi: ReadonlyArray<CorsoRef>): Listino => ({
  ...conNomiDi(l, corsi),
  corsi: conNomiDi(l, corsi).corsi.filter((v) => !v.corsoId || corsi.some((c) => c.id === v.corsoId)),
})

/** Le voci col nome che il corso ha ora in CORSI; quelle di un corso che non si vede restano come sono. */
export const conNomiDi = (l: Listino, corsi: ReadonlyArray<CorsoRef>): Listino => ({
  ...l,
  corsi: l.corsi.map((v) => {
    const c = v.corsoId ? corsi.find((x) => x.id === v.corsoId) : undefined
    return c ? { ...v, corso: c.nome } : v
  }),
})

/** Quello che non va, detto prima di salvare; `null` se va bene. */
export function cosaNonVaListino(l: Listino, corsi: ReadonlyArray<CorsoRef> = []): string | null {
  if (!(l.quota >= 0 && l.quota <= LIMITI.prezzo)) return 'La quota associativa non va'
  if (!giorno(l.saldoEntro)) return 'La data del saldo non va'
  if (!l.corsi.length) return 'Serve almeno un corso'
  if (l.corsi.length > LIMITI.corsi) return `Al massimo ${LIMITI.corsi} corsi`
  if (l.offerte.length > LIMITI.offerte) return `Al massimo ${LIMITI.offerte} offerte`
  const visti = new Set<string>()
  const dei = new Set<string>()
  for (const c of l.corsi) {
    const nome = c.corso.trim()
    if (c.corsoId) {
      if (dei.has(c.corsoId)) return `Due voci sono dello stesso corso («${corsi.find((x) => x.id === c.corsoId)?.nome ?? nome}»): tieni una voce sola e metti le righe di prezzo là dentro`
      dei.add(c.corsoId)
    }
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
        if (!l) return { listino: LISTINO_PREDEFINITO, cambiato: false }
        // Dopo una rinomina in CORSI la voce ha ancora il nome di quando è stata salvata: chi legge vede quello nuovo.
        return l.corsi.some((v) => v.corsoId)
          ? import('./richieste')
              .then((r) => r.datiRichieste())
              .then((d) => d.corsiAperti())
              .then((corsi) => ({ listino: conNomiDi(l, corsi), cambiato: true }))
              .catch(() => ({ listino: l, cambiato: true }))
          : { listino: l, cambiato: true }
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
