import { dalCertificato, mancaLaData, pagamentoDi, senzaCertificatoValido, statoCertificato, certificatoInArrivo, certificatoInScadenza, type PersonaSeg } from './segreteria'
import { corsiDaPagare, corsiScaduti, testoCorsoBreve } from './corsiDaPagare'
import { quotaDaIncassare, titolariDi } from './filtriIscritti'
import type { CorsoRef, Listino } from './listino'
import type { Richiesta } from './richieste'
import type { ChiaveDaFare } from './daFareTesti'
import { euroBreve } from './ricevute'
import { chiaveGiorno, dataLunga } from './sala'

/**
 * Chi c'è dietro i numeri di DA FARE: per ogni riga l'elenco intero, già in
 * ordine di urgenza, con il perché in poche parole. Ogni elenco nasce dallo
 * stesso filtro del suo numero, così la lunghezza è il numero della riga e
 * «Vedi tutti» apre le stesse persone.
 */
export interface VoceChi {
  /** Della persona, della richiesta o del corso: si apre toccando il nome. */
  id: string
  nome: string
  perche: string
  /** Il perché in rosso: solo per quello che in sala già blocca (il certificato). */
  rosso: boolean
}

/** Quanti nomi sotto ogni riga: di più la schermata diventa un elenco, e c'è già ISCRITTI. */
export const PRIMI_DA_FARE = 5
export function primiDaFare<T>(voci: readonly T[] | null | undefined): T[] {
  return (voci ?? []).slice(0, PRIMI_DA_FARE)
}
/** Lo stesso tasto su ogni riga: tasti diversi per riga, accanto ai nomi, confondono. */
export const TASTO_DA_FARE = 'Vedi tutti'
/** Le righe col perché corto stanno su due colonne; quelle col perché lungo su una. */
export const COLONNE_DA_FARE: Partial<Record<ChiaveDaFare, 1 | 2>> = { certificati: 2, 'certificati-ricevuti': 2, scadenza: 2, arrivo: 2, pagare: 2, corsi: 1, richieste: 1, listino: 1 }

const pulito = (s: string) => s.trim().replace(/\s+/g, ' ')

export function nomeInElenco(p: { nome: string; cognome: string }): string {
  return pulito(`${p.cognome} ${p.nome}`) || 'Senza nome'
}

const collazione = new Intl.Collator('it')

/** In ordine per `chiave` (una stringa che si confronta così com'è), a pari merito per cognome e nome. */
function inOrdine<T extends { nome: string; cognome: string }>(cose: T[], chiave: (x: T) => string, voce: (x: T) => Omit<VoceChi, 'nome'>): VoceChi[] {
  return cose
    .map((x) => ({ x, k: chiave(x) }))
    .sort((a, b) => (a.k < b.k ? -1 : a.k > b.k ? 1 : collazione.compare(pulito(a.x.cognome), pulito(b.x.cognome)) || collazione.compare(pulito(a.x.nome), pulito(b.x.nome))))
    .map(({ x }) => ({ nome: nomeInElenco(x), ...voce(x) }))
}

// Dopo ogni data, per mettere in fondo chi una data non ce l'ha.
const SENZA_DATA = '9999-99-99'

/** Certificato mancante o scaduto, come `certificatiDaSistemare`: prima chi è scaduto da più tempo, poi chi non l'ha mai portato. */
export function chiCertificati(persone: PersonaSeg[], oggi: string): VoceChi[] {
  return inOrdine(
    persone.filter((p) => p.attiva && senzaCertificatoValido(p, oggi)),
    (p) => (statoCertificato(p, oggi) === 'scaduto' && p.certificato.scade ? `0${p.certificato.scade}` : '1'),
    (p) => ({
      id: p.id,
      rosso: true,
      perche: statoCertificato(p, oggi) === 'scaduto' && p.certificato.scade ? `scaduto il ${dataLunga(p.certificato.scade, false)}` : mancaLaData(p) ? 'manca · senza data di nascita' : 'manca',
    }),
  )
}

/** Certificati mandati dall'iscritto e non ancora confermati: prima quello arrivato da più tempo, che aspetta da più giorni. */
export function chiCertificatiRicevuti(persone: PersonaSeg[]): VoceChi[] {
  return inOrdine(
    persone.filter((p) => p.attiva && p.certificato.inAttesaIl),
    (p) => p.certificato.inAttesaIl ?? SENZA_DATA,
    (p) => ({ id: p.id, rosso: false, perche: `mandato il ${dataLunga(p.certificato.inAttesaIl ?? '', false)}` }),
  )
}

export function chiScadenza(persone: PersonaSeg[], oggi: string): VoceChi[] {
  return inOrdine(
    persone.filter((p) => certificatoInScadenza(p, oggi)),
    (p) => p.certificato.scade ?? SENZA_DATA,
    (p) => ({ id: p.id, rosso: false, perche: p.certificato.scade === oggi ? 'scade oggi' : `scade il ${dataLunga(p.certificato.scade ?? oggi, false)}` }),
  )
}

/** In arrivo vuol dire con la data di nascita: senza, `statoCertificato` non lo direbbe. */
export function chiArrivo(persone: PersonaSeg[], oggi: string): VoceChi[] {
  return inOrdine(
    persone.filter((p) => certificatoInArrivo(p, oggi) && p.natoIl),
    (p) => dalCertificato(p.natoIl ?? ''),
    (p) => ({ id: p.id, rosso: false, perche: `serve dal ${dataLunga(dalCertificato(p.natoIl ?? ''), false)}` }),
  )
}

/** Quota non pagata, come `pagamentiNonInRegola`: la quota scaduta da più tempo prima, poi da pagare, poi pagato in parte (chi ha l'importo che manca prima: si chiede subito). */
export function chiPagare(persone: PersonaSeg[], oggi: string): VoceChi[] {
  const stati = new Map(persone.map((p) => [p.id, pagamentoDi(p, oggi)]))
  const s = (p: PersonaSeg) => stati.get(p.id) ?? pagamentoDi(p, oggi)
  const titolari = titolariDi(persone)
  return inOrdine(
    persone.filter((p) => quotaDaIncassare(p, oggi, titolari)),
    (p) => {
      const x = s(p)
      return x.come === 'scaduto' ? `0${x.fino ?? ''}` : x.come === 'da_pagare' ? '1' : x.mancano ? '2' : '3'
    },
    (p) => {
      const x = s(p)
      const perche =
        x.come === 'scaduto' && x.fino ? `quota scaduta il ${dataLunga(x.fino, false)}`
        : x.come === 'in_parte' ? (x.mancano ? `pagato in parte: mancano ${euroBreve(x.mancano)}` : 'pagato in parte')
        : 'da pagare'
      return { id: p.id, rosso: false, perche }
    },
  )
}

/** I corsi non coperti, come `corsiScaduti` (undefined se le ricevute non si sono lette): dal corso scaduto da più tempo, senza data in fondo. */
export function chiCorsi(persone: PersonaSeg[], corsi: CorsoRef[], listino: Listino, oggi: string): VoceChi[] | undefined {
  if (corsiScaduti(persone, corsi, listino, oggi) === undefined) return undefined
  const conCorsi = persone.filter((p) => p.attiva).map((p) => ({ ...p, scaduti: corsiDaPagare(p, corsi, listino, oggi) })).filter((p) => p.scaduti.length > 0)
  return inOrdine(
    conCorsi,
    (p) => p.scaduti.map((c) => c.al ?? SENZA_DATA).sort()[0],
    (p) => ({ id: p.id, rosso: false, perche: p.scaduti.map(testoCorsoBreve).join(' · ') }),
  )
}

function quandoArrivata(creataIl: string, oggi: string): string {
  const giorno = chiaveGiorno(new Date(creataIl))
  const giorni = Math.round((Date.parse(oggi) - Date.parse(giorno)) / 86_400_000)
  if (giorni <= 0) return 'arrivata oggi'
  if (giorni === 1) return 'arrivata ieri'
  if (giorni <= 6) return `arrivata ${giorni} giorni fa`
  return `arrivata il ${dataLunga(giorno, false)}`
}

/** Le richieste nuove, dalla più vecchia. `nomi` traduce gli id dei corsi: un corso che non c'è si salta, l'id non dice niente a chi legge. */
export function chiRichieste(richieste: Richiesta[], oggi: string, nomi: ReadonlyMap<string, string>): VoceChi[] {
  return inOrdine(
    richieste.filter((r) => r.stato === 'nuova'),
    (r) => r.creataIl,
    (r) => {
      const corsi = r.corsi.flatMap((c) => nomi.get(c) ?? []).join(', ')
      const quando = quandoArrivata(r.creataIl, oggi)
      return { id: r.id, rosso: false, perche: corsi ? `${corsi} · ${quando}` : quando }
    },
  )
}

export function chiListino(mancanti: ReadonlyArray<{ id: string; nome: string; frase: string }>): VoceChi[] {
  return [...mancanti].sort((a, b) => collazione.compare(a.nome, b.nome)).map((c) => ({ id: c.id, nome: c.nome, perche: c.frase, rosso: false }))
}
