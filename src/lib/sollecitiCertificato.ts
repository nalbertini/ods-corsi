// ---------------------------------------------------------------------------
// I solleciti del certificato per email (143-solleciti-certificato.sql): le
// regole di IMPOSTAZIONI (momenti, oggetto, testo) e la riga SOLLECITI PER
// EMAIL della scheda. Le stesse regole stanno nei check di `impostazioni`.
// Il testo della mail lo fa `testoAvviso` di avvisoSegreteria.ts, che gira
// anche nella Edge Function.
// ---------------------------------------------------------------------------

import { spostaGiorno } from './segreteria'
import { nomiInsieme } from './avvisoSegreteria'

export { nomiInsieme }

export const MOMENTI_PROPOSTI = [-7, 0, 7]
export const MOMENTI_MAX = 6
export const MOMENTO_MAX = 60

export interface SollecitiCertificato {
  accesi: boolean
  momenti: number[]
  oggetto: string
  testo: string
  copia: boolean
}

export function cosaNonVaMomenti(m: number[]): string | undefined {
  if (m.length < 1 || m.length > MOMENTI_MAX) return `Ne servono da 1 a ${MOMENTI_MAX}.`
  if (m.some((x) => !Number.isInteger(x) || Math.abs(x) > MOMENTO_MAX)) return `Al più ${MOMENTO_MAX} giorni prima o dopo il termine.`
  if (new Set(m).size !== m.length) return 'Due momenti sono lo stesso giorno: togline uno.'
  return undefined
}

/** Il primo segnaposto fra quelli ammessi che non va, se c'è: `{cognome}`. */
const estraneo = (t: string, ammessi: string[]) => (t.match(/\{[^{}]*\}/g) ?? []).find((x) => !ammessi.includes(x))

export function cosaNonVaOggetto(o: string): string | undefined {
  if (!o.trim()) return 'Scrivi l’oggetto della mail.'
  if (o.length > 200) return 'L’oggetto è troppo lungo: al più 200 caratteri.'
  if (/[\r\n]/.test(o)) return 'L’oggetto sta su una riga sola.'
  const x = estraneo(o, ['{nome}', '{entro}'])
  return x ? `${x} non si può usare nell’oggetto: solo {nome} ed {entro}.` : undefined
}

export function cosaNonVaTesto(t: string): string | undefined {
  if (!t.trim()) return 'Scrivi il testo della mail.'
  if (t.length > 4000) return 'Il testo è troppo lungo: al più 4000 caratteri.'
  const x = estraneo(t, ['{nome}', '{entro}', '{link}'])
  if (x) return `${x} non si può usare: solo {nome}, {entro} e {link}.`
  if (!t.includes('{link}')) return 'Manca {link}: senza, chi legge la mail non sa dove caricarlo.'
  return undefined
}

/** Cosa non va nei solleciti da salvare: il primo guaio, come lo dicono i campi. */
export const cosaNonVaSolleciti = (x: SollecitiCertificato): string | undefined => cosaNonVaMomenti(x.momenti) ?? cosaNonVaOggetto(x.oggetto) ?? cosaNonVaTesto(x.testo)

/** Come i default di `impostazioni` in 143: in prova e per l'anteprima. */
export const SOLLECITI_PROPOSTI: SollecitiCertificato = {
  accesi: false,
  momenti: MOMENTI_PROPOSTI,
  oggetto: 'Il certificato medico di {nome}',
  testo: 'Buongiorno,\nper {nome} ci manca ancora il certificato medico, da portare entro il {entro}.\nPuoi caricarlo da qui, senza password: basta una foto o il PDF.\n{link}\nSe l’hai già portato in segreteria, non serve fare altro.\nA presto in palestra,\nOfficine Dello Sport',
  copia: true,
}

/** L'ultimo momento già arrivato (oggi compreso): in prova, il sollecito che il giro avrebbe scritto. */
export function ultimoSollecito(entro: string, oggi: string, momenti: number[]): { il: string; momento: number } | null {
  const passati = [...momenti].sort((a, b) => b - a).map((m) => ({ il: spostaGiorno(entro, m), momento: m })).filter((x) => x.il <= oggi)
  return passati[0] ?? null
}

export function rigaMomento(m: number): string {
  if (m === 0) return 'il giorno del termine'
  const n = Math.abs(m)
  return `${n} ${n === 1 ? 'giorno' : 'giorni'} ${m < 0 ? 'prima del' : 'dopo il'} termine`
}

/** Il prossimo sollecito da oggi compreso (date `AAAA-MM-GG`), o null se sono passati tutti. */
export function prossimoSollecito(entro: string, oggi: string, momenti: number[]): { il: string; momento: number } | null {
  const futuri = [...momenti].sort((a, b) => a - b).map((m) => ({ il: spostaGiorno(entro, m), momento: m })).filter((x) => x.il >= oggi)
  return futuri[0] ?? null
}

/** «12/12/2026» da `2026-12-12`, senza zeri davanti, come lo storico dei solleciti. */
const giorno = (g: string) => {
  const [a, m, d] = g.split('-').map(Number)
  return `${d}/${m}/${a}`
}

export interface RigaSollecitiEmail {
  testo: string
  tono?: 'avviso'
  sotto?: string
  tasto?: 'sospendi' | 'riattiva'
}

/**
 * La riga SOLLECITI PER EMAIL della scheda: il prossimo, o perché non parte.
 * Senza termine (iscritti di prima) non c'è: null.
 */
export function rigaSollecitiEmail(x: {
  nome: string
  accesi: boolean
  sospesi: boolean
  inAttesa: boolean
  entro?: string
  oggi: string
  momenti: number[]
  a?: string | null
}): RigaSollecitiEmail | null {
  if (!x.entro) return null
  if (x.sospesi) return { testo: `Sospesi: a ${x.nome} non scriviamo più finché non li riattivi.`, tono: 'avviso', sotto: 'Riattivati, ripartono dal prossimo momento: quelli passati non si recuperano.', tasto: 'riattiva' }
  if (!x.accesi) return { testo: 'Spenti per tutti in IMPOSTAZIONI › GLI AVVISI.' }
  if (x.inAttesa) return { testo: 'Caricato, da confermare: i solleciti sono fermi.' }
  const p = prossimoSollecito(x.entro, x.oggi, x.momenti)
  if (!p) {
    const ultimo = spostaGiorno(x.entro, Math.max(...x.momenti))
    return { testo: `Nessun altro: l’ultimo è partito il ${giorno(ultimo)}.` }
  }
  if (!x.a) return { testo: `Nessuna email: il ${giorno(p.il)} lo trovi in DA FARE, da mandare su WhatsApp.`, tasto: 'sospendi' }
  return { testo: `Il prossimo il ${giorno(p.il)}, ${rigaMomento(p.momento)}, a ${x.a}`, tasto: 'sospendi' }
}

/** Chi aspetta un sollecito ma non ha un'email (`solleciti_a_mano`, 143): in DA FARE, da mandare su WhatsApp. */
export interface SollecitoAMano {
  personaId: string
  nome: string
  cognome: string
  entro: string
  momento: number
  dovutoIl: string
}

/** La riga di DA FARE di chi aspetta un sollecito a mano: «il giorno del termine, 12/12/2026». */
export const percheAMano = (s: { momento: number; dovutoIl: string }) => `${rigaMomento(s.momento)}, ${giorno(s.dovutoIl)}`
