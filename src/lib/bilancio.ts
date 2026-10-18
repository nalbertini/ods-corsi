import { VOCE_DA_CLASSIFICARE } from './importaPrimaNota'
import { VOCE_CORSI, VOCE_DIFFERENZA, VOCE_QUOTA, filtraMovimenti, residui, totali, type Cassa, type RigaMovimento } from './contabilita'
import { dataRicevuta, euro } from './ricevute'
import { csv } from './vestiario'

/**
 * Il bilancio di un anno solare (1 gennaio - 31 dicembre), PER CASSA: conta il giorno
 * in cui il denaro è entrato o uscito (per gli incassi degli iscritti, quello del singolo
 * pagamento), non la competenza. Si calcola dalle righe dell'elenco movimenti: stesse
 * regole di `totali` e `perVoce`, giroconti e annullati fuori, così torna con MOVIMENTI.
 * Niente browser, niente database; in sola lettura. Importi in centesimi.
 */

export interface RigaVoceBilancio {
  voce: string
  tipo: 'entrata' | 'uscita'
  /** `null`: la voce quest'anno non ha movimenti (si scrive «—», non zero). */
  totale: number | null
  /** L'importo nel periodo di confronto; `null` se la voce non c'era, o se l'anno prima è vuoto. */
  prima: number | null
  movimenti: number
  daClassificare: boolean
  /** La differenza di cassa della chiusura: conta nei totali ma si legge a parte dalle voci. */
  aParte: boolean
}

export interface SaldoCassaAnno {
  cassaId: string
  nome: string
  /** Il saldo al 1 gennaio; `null` se la cassa non era ancora partita (mai uno zero inventato). */
  inizio: number | null
  entrate: number
  uscite: number
  /** Positivo se la cassa riceve più di quanto versa. */
  giroconti: number
  fine: number | null
  /** La cassa parte dentro quest'anno: il saldo iniziale vale da questa data. */
  dal?: string
  /** La cassa parte dopo la fine del periodo: da quando. */
  parteIl?: string
}

export interface TotaliBilancio {
  entrate: number
  uscite: number
  risultato: number
}

export interface Bilancio extends TotaliBilancio {
  anno: number
  dal: string
  /** Il 31 dicembre, o il giorno di oggi per l'anno in corso. */
  al: string
  parziale: boolean
  confrontoDal: string
  confrontoAl: string
  /** Nessun movimento (annullati e giroconti esclusi) nell'anno. */
  vuoto: boolean
  /** Il periodo di confronto; `null` se non ha movimenti: «nessun dato», non zero. */
  prima: TotaliBilancio | null
  voci: RigaVoceBilancio[]
  /** Movimenti senza una voce utile: quanti, quante uscite e che parte delle uscite sono (in %). `null` se non ce ne sono. */
  daClassificare: { movimenti: number; uscite: number; quotaUscite: number } | null
  /** Oltre metà delle uscite è da classificare: il risultato non è affidabile. */
  provvisorio: boolean
  /**
   * Gli incassi dello storico importato (movimenti a mano su una voce di sistema) arrivano oltre il primo
   * incasso registrato nell'app: in quel periodo lo stesso incasso può essere contato due volte. `null` se no.
   */
  sovrapposizione: { dal: string; al: string } | null
  saldi: SaldoCassaAnno[]
}

const annoDi = (data: string) => Number(data.slice(0, 4))

/** Dal primo anno con movimenti (non annullati) all'anno di oggi; senza movimenti, solo quello di oggi. */
export function anniDelBilancio(righe: RigaMovimento[], oggi: string): number[] {
  const fine = annoDi(oggi)
  const primo = righe.reduce((p, r) => (r.annullato ? p : Math.min(p, annoDi(r.data))), fine)
  return Array.from({ length: fine - primo + 1 }, (_, i) => primo + i)
}

/** Lo stesso giorno dell'anno prima; il 29 febbraio diventa 28. */
const giornoAnnoPrima = (data: string) => {
  const g = data.slice(5) === '02-29' ? '02-28' : data.slice(5)
  return `${annoDi(data) - 1}-${g}`
}

type RigaConVoce = RigaMovimento & { tipo: 'entrata' | 'uscita' }
const soloMovimenti = (righe: RigaMovimento[]): RigaConVoce[] => righe.filter((r): r is RigaConVoce => !r.annullato && r.tipo !== 'giroconto')
const nomeVoce = (r: RigaMovimento) => r.voce ?? VOCE_DA_CLASSIFICARE

/**
 * I totali per voce di un periodo; una riga senza voce vale «Da classificare» (`perVoce` di
 * contabilita.ts la scarta: qui i totali per voce devono sommare ai totali del bilancio).
 */
function vociDelPeriodo(righe: RigaMovimento[]) {
  const gruppi = new Map<string, { voce: string; tipo: 'entrata' | 'uscita'; totale: number; movimenti: number }>()
  for (const r of soloMovimenti(righe)) {
    const voce = nomeVoce(r)
    const chiave = `${r.tipo}|${voce}`
    const g = gruppi.get(chiave) ?? { voce, tipo: r.tipo, totale: 0, movimenti: 0 }
    g.totale += r.importo
    g.movimenti += 1
    gruppi.set(chiave, g)
  }
  return gruppi
}

/** Il saldo di una cassa a inizio e fine del periodo, con lo stesso conto di `residui`. */
function saldoCassa(cassa: Cassa, righe: RigaMovimento[], dal: string, al: string): SaldoCassaAnno {
  const base = { cassaId: cassa.id, nome: cassa.nome }
  if (cassa.dal && cassa.dal > al) return { ...base, inizio: null, entrate: 0, uscite: 0, giroconti: 0, fine: null, parteIl: cassa.dal }
  const prima = residui([cassa], righe.filter((r) => r.data < dal))[0].residuo
  // Senza il saldo iniziale, il residuo dei movimenti dell'anno è solo quel che è successo nell'anno.
  const anno = residui([{ ...cassa, saldoIniziale: 0 }], filtraMovimenti(righe, { dal, al }))[0]
  return {
    ...base,
    inizio: prima,
    entrate: anno.entrate,
    uscite: anno.uscite,
    giroconti: anno.residuo - anno.entrate + anno.uscite,
    fine: prima + anno.residuo,
    ...(cassa.dal && cassa.dal > dal ? { dal: cassa.dal } : {}),
  }
}

/** Lo storico importato sta nei movimenti a mano con una voce di sistema; gli incassi dell'app arrivano da ricevute e pagamenti. */
function sovrapposizioneStorico(righe: RigaMovimento[]): { dal: string; al: string } | null {
  const incassi = soloMovimenti(righe).filter((r) => r.tipo === 'entrata')
  const dellApp = incassi.filter((r) => r.origine !== 'movimento').map((r) => r.data)
  const dello = incassi.filter((r) => r.origine === 'movimento' && (r.voce === VOCE_QUOTA || r.voce === VOCE_CORSI)).map((r) => r.data)
  if (!dellApp.length || !dello.length) return null
  const dal = dellApp.reduce((a, b) => (a < b ? a : b))
  const al = dello.reduce((a, b) => (a > b ? a : b))
  return al >= dal ? { dal, al } : null
}

export function bilancioAnno(righe: RigaMovimento[], casse: Cassa[], anno: number, oggi: string): Bilancio {
  const dal = `${anno}-01-01`
  const parziale = anno === annoDi(oggi)
  const al = parziale ? oggi : `${anno}-12-31`
  const confrontoDal = `${anno - 1}-01-01`
  const confrontoAl = parziale ? giornoAnnoPrima(oggi) : `${anno - 1}-12-31`

  const delPeriodo = filtraMovimenti(righe, { dal, al })
  const delConfronto = filtraMovimenti(righe, { dal: confrontoDal, al: confrontoAl })
  const t = totali(delPeriodo)
  const tPrima = totali(delConfronto)
  const haPrima = soloMovimenti(delConfronto).length > 0

  const attuali = vociDelPeriodo(delPeriodo)
  const precedenti = vociDelPeriodo(delConfronto)
  const chiavi = new Set([...attuali.keys(), ...(haPrima ? precedenti.keys() : [])])
  const voci: RigaVoceBilancio[] = [...chiavi].map((chiave) => {
    const a = attuali.get(chiave)
    const p = haPrima ? precedenti.get(chiave) : undefined
    const { tipo, voce } = (a ?? p)!
    return { voce, tipo, totale: a?.totale ?? null, prima: p?.totale ?? null, movimenti: a?.movimenti ?? 0, daClassificare: voce === VOCE_DA_CLASSIFICARE, aParte: voce === VOCE_DIFFERENZA }
  })
  // Le entrate prima; in ciascun gruppo la più grande, le voci senza importo quest'anno in fondo, poi «Da classificare» e la differenza di cassa.
  const coda = (v: RigaVoceBilancio) => (v.aParte ? 2 : v.daClassificare ? 1 : 0)
  voci.sort((x, y) => (x.tipo === y.tipo ? coda(x) - coda(y) || (y.totale ?? -1) - (x.totale ?? -1) || (y.prima ?? 0) - (x.prima ?? 0) : x.tipo === 'entrata' ? -1 : 1))

  const sospese = soloMovimenti(delPeriodo).filter((r) => nomeVoce(r) === VOCE_DA_CLASSIFICARE)
  const usciteSospese = sospese.filter((r) => r.tipo === 'uscita').reduce((s, r) => s + r.importo, 0)
  const quotaUscite = t.uscite ? Math.round((usciteSospese / t.uscite) * 100) : 0

  return {
    anno,
    dal,
    al,
    parziale,
    confrontoDal,
    confrontoAl,
    vuoto: soloMovimenti(delPeriodo).length === 0,
    entrate: t.entrate,
    uscite: t.uscite,
    risultato: t.differenza,
    prima: haPrima ? { entrate: tPrima.entrate, uscite: tPrima.uscite, risultato: tPrima.differenza } : null,
    voci,
    daClassificare: sospese.length ? { movimenti: sospese.length, uscite: usciteSospese, quotaUscite } : null,
    // Sul rapporto vero, non su quello arrotondato: il 50,4% è oltre metà anche se si scrive 50.
    provvisorio: usciteSospese * 2 > t.uscite,
    sovrapposizione: sovrapposizioneStorico(delPeriodo),
    saldi: casse.map((c) => saldoCassa(c, righe, dal, al)),
  }
}

/** Quanto è cambiato in percentuale, col segno: «+8%», «−10%». `null` se prima era zero (non si divide) o se è oltre il 999%. */
export function variazione(attuale: number, prima: number): string | null {
  if (!prima) return null
  const p = Math.round(((attuale - prima) / Math.abs(prima)) * 100)
  // Da una base minuscola la percentuale non dice niente: resta la differenza in euro.
  if (Math.abs(p) > 999) return null
  return p === 0 ? '0%' : `${p > 0 ? '+' : '−'}${Math.abs(p)}%`
}

/** La differenza fra l'anno e il confronto, col segno; «—» se uno dei due non c'è. */
export const differenza = (anno: number | null, prima: number | null): string => (anno !== null && prima !== null ? conSegno(anno - prima) : '—')

/** Il risultato a parole: il segno non è solo un colore. */
export const esito = (risultato: number): string => (risultato < 0 ? 'In disavanzo' : risultato > 0 ? 'In avanzo' : 'In pareggio')

/** Sotto un totale: «2025: 48.390,00 € · +8%», o «2025: nessun dato» se quel periodo non ha movimenti. */
export function testoConfronto(b: Bilancio, prima: number | undefined, attuale: number): string {
  const anno = b.anno - 1
  if (prima === undefined) return `${anno}: nessun dato`
  const v = variazione(attuale, prima)
  return `${anno}${b.parziale ? ' (stesso periodo)' : ''}: ${importoConMeno(prima)}${v ? ` · ${v}` : ''}`
}

/** Un importo con il meno vero (−) davanti se è negativo, come nel resto della contabilità: «− 1.450,00 €». */
export const importoConMeno = (cent: number): string => (cent < 0 ? `− ${euro(-cent)} €` : `${euro(cent)} €`)

/** Una differenza col segno: «+3,05 €», «−0,17 €», «0,00 €». */
export const conSegno = (cent: number): string => (cent === 0 ? '0,00 €' : `${cent > 0 ? '+' : '−'}${euro(Math.abs(cent))} €`)

export const nomeFileBilancio = (anno: number, estensione: 'csv' | 'pdf') => `bilancio-${anno}.${estensione}`

/** La frase che sta in cima alla schermata e sui fogli: cosa conta il bilancio. */
export const fraseBilancio = (b: Bilancio, oggi: string): string =>
  `Entrate e uscite ${b.parziale ? `dal ${dataRicevuta(b.dal)} al ${dataRicevuta(b.al)}` : `dell’anno ${b.anno}`}, per cassa: conta il giorno in cui il denaro è entrato o uscito. Calcolato il ${dataRicevuta(oggi)}.`

/** Un importo per il foglio Excel: senza punti delle migliaia, con la virgola. */
const cifra = (cent: number | null) => (cent === null ? '' : (cent / 100).toFixed(2).replace('.', ','))

/**
 * Il foglio CSV per il commercialista: le voci dell'anno con l'anno prima, i totali e i
 * saldi delle casse. Senza nomi di iscritti né movimenti singoli.
 */
export function csvBilancio(b: Bilancio, oggi: string): string {
  const periodo = `dal ${dataRicevuta(b.dal)} al ${dataRicevuta(b.al)}${b.parziale ? ' (anno in corso, parziale)' : ''}`
  const confronto = `${dataRicevuta(b.confrontoDal)}-${dataRicevuta(b.confrontoAl)}`
  const righe: (string | number)[][] = [
    [`Bilancio ${b.anno}`, periodo],
    ['Bilancio per cassa: conta il giorno in cui il denaro è entrato o uscito', `Calcolato il ${dataRicevuta(oggi)}`],
    ...(b.provvisorio ? [['Risultato provvisorio: più di metà delle uscite non ha una voce']] : []),
    [],
    ['voce', 'tipo', `${b.anno}`, `confronto ${confronto}`],
  ]
  for (const tipo of ['entrata', 'uscita'] as const) {
    for (const v of b.voci.filter((x) => x.tipo === tipo)) righe.push([v.voce, tipo, cifra(v.totale), cifra(v.prima)])
    righe.push([tipo === 'entrata' ? 'Totale entrate' : 'Totale uscite', '', cifra(tipo === 'entrata' ? b.entrate : b.uscite), cifra(b.prima ? (tipo === 'entrata' ? b.prima.entrate : b.prima.uscite) : null)])
  }
  righe.push(['Risultato', '', cifra(b.risultato), cifra(b.prima?.risultato ?? null)], [], ['cassa', 'saldo a inizio', 'entrate', 'uscite', 'giroconti', 'saldo a fine'])
  for (const s of b.saldi) righe.push([s.nome, cifra(s.inizio), cifra(s.entrate), cifra(s.uscite), cifra(s.giroconti), cifra(s.fine)])
  return csv(righe)
}
