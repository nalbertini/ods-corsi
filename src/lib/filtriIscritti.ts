import { comePaga, eMinorenne, fuoriRegola, inCorso, senzaCertificatoValido, type PersonaSeg } from './segreteria'
import { senzaTessera, type RigaIncrocio } from './tessere'

/**
 * I filtri sopra l'elenco ISCRITTI. Al banco servono cinque ricerche (senza
 * certificato, da pagare, corsi scaduti, non in regola, minorenni): quelle stanno sempre in vista; le
 * altre stanno dietro «Altri filtri» e si aprono da sole se una è accesa, così
 * un filtro acceso non resta mai nascosto.
 */
export type IdFiltro =
  | 'senza-email' | 'poco' | 'certificato' | 'scadenza' | 'arrivo' | 'pagare'
  | 'corsi-scaduti' | 'fuori' | 'senza-tessera' | 'senza-corso' | 'senza-documento' | 'file-di-prima' | 'doppioni' | 'pagato-prima'
  | 'minorenni' | 'famiglie'

/** Tutti i filtri, per sapere quali sono accesi anche se il loro chip adesso non c'è. */
export const ID_FILTRI: IdFiltro[] = [
  'senza-email', 'poco', 'certificato', 'scadenza', 'arrivo', 'pagare',
  'corsi-scaduti', 'fuori', 'senza-tessera', 'senza-corso', 'senza-documento', 'file-di-prima', 'doppioni', 'pagato-prima',
  'minorenni', 'famiglie',
]

export const FILTRI_VISIBILI: IdFiltro[] = ['certificato', 'pagare', 'corsi-scaduti', 'fuori', 'minorenni']

export const TESTI_FILTRI: Record<IdFiltro, string> = {
  'senza-email': 'Solo senza email',
  poco: 'Vengono poco',
  certificato: 'Senza certificato valido',
  scadenza: 'Certificato in scadenza',
  arrivo: 'Compiono 6 anni',
  pagare: 'Da pagare',
  fuori: 'Non in regola',
  'senza-tessera': 'Senza tessera',
  'senza-corso': 'Tesserati senza corso',
  'senza-documento': 'Senza documento',
  'file-di-prima': 'Da archiviare',
  doppioni: 'Possibili doppioni',
  'pagato-prima': 'Pagato nel vecchio programma',
  'corsi-scaduti': 'Corsi scaduti',
  minorenni: 'Minorenni',
  famiglie: 'Famiglie',
}

/** I filtri nascosti che ci sono adesso: quattro compaiono solo se c'è qualcosa da filtrare. */
export function altriFiltri(c: { conTessere: boolean; filePrima: number; doppioni: number; conStorico: boolean; segnalaTessere?: boolean }): IdFiltro[] {
  return [
    'senza-email',
    'poco',
    'scadenza',
    'arrivo',
    ...(c.conTessere ? ([...(c.segnalaTessere === false ? [] : (['senza-tessera'] as const)), 'senza-corso'] as const) : []),
    'senza-documento',
    'famiglie',
    ...(c.conStorico ? (['pagato-prima'] as const) : []),
    ...(c.filePrima > 0 ? (['file-di-prima'] as const) : []),
    ...(c.doppioni > 0 ? (['doppioni'] as const) : []),
  ]
}

/** Il gruppo è aperto se lo si è aperto, o se un filtro acceso sta fra quelli nascosti. */
export function altriAperti(accesi: IdFiltro[], scelto: boolean): boolean {
  return scelto || accesi.some((id) => !FILTRI_VISIBILI.includes(id))
}

/** I filtri di chi ha qualcosa da sistemare: con uno acceso l'elenco ha il tasto del sollecito su WhatsApp. */
export const FILTRI_SOLLECITO: IdFiltro[] = ['certificato', 'scadenza', 'arrivo', 'pagare', 'corsi-scaduti', 'fuori']

/** «Pagato nel vecchio programma» e «Possibili doppioni» accesi mostrano una vista loro, senza la tabella: lì la colonna non c'è. */
export const conSollecito = (accesi: IdFiltro[]) =>
  accesi.some((id) => FILTRI_SOLLECITO.includes(id)) && !accesi.includes('pagato-prima') && !accesi.includes('doppioni')

/** I chip sempre in vista, che dicono anche quanti sono. */
export type ChipConto = 'certificato' | 'pagare' | 'corsi-scaduti' | 'fuori' | 'minorenni'
export const haConto = (id: IdFiltro): id is ChipConto => FILTRI_VISIBILI.includes(id)

/** Quel che i filtri leggono fuori dalla persona: i corsi da pagare e le tessere vengono da altre letture. */
export interface ContestoFiltri {
  oggi: string
  scopertiDi: (p: PersonaSeg) => unknown[]
  tesseraDi: (p: PersonaSeg) => RigaIncrocio[]
  /** Gli id dei titolari di un nucleo con altri dentro (`titolariDi`): chi li dà all'elenco intero. */
  titolari?: ReadonlySet<string>
}

/** Chi ha qualcuno nel suo nucleo familiare. */
export const titolariDi = (persone: PersonaSeg[]): Set<string> => new Set(persone.flatMap((p) => (p.nucleo ? [p.nucleo] : [])))

/**
 * Un titolare che non frequenta lui, ma ha gente nel nucleo, c'è per gli
 * altri: la quota e il certificato non sono cosa sua, e non conta come
 * da incassare né da sistemare.
 */
export const titolareSenzaCorsi = (p: PersonaSeg, titolari: ReadonlySet<string> | undefined, oggi: string) => !!titolari?.has(p.id) && !p.iscrizioni.some((i) => inCorso(i, oggi))

// La quota si cerca fra chi è attivo: chi ha smesso non la deve portare. Gli stessi conti di DA FARE.
export const daPagare = (p: PersonaSeg, oggi: string) => p.attiva && comePaga(p, oggi) !== 'pagato'

/**
 * La quota da incassare: la stessa regola per il filtro DA PAGARE, COSA MANCA, DA FARE e la coda del banco.
 * Il genitore non iscritto e il titolare senza corsi ci sono per gli altri: a loro non si chiede.
 */
export const quotaDaIncassare = (p: PersonaSeg, oggi: string, titolari: ReadonlySet<string> | undefined) =>
  daPagare(p, oggi) && !p.genitoreNonIscritto && !titolareSenzaCorsi(p, titolari, oggi)

/** Se una persona passa un chip: la stessa regola per il filtro e per il suo conto. */
export function passaChip(id: ChipConto, p: PersonaSeg, c: ContestoFiltri): boolean {
  // Il genitore non iscritto c'è per i figli: niente certificato, quota né corsi da chiedergli.
  if (p.genitoreNonIscritto) return false
  if (id === 'certificato') return senzaCertificatoValido(p, c.oggi)
  if (id === 'pagare') return quotaDaIncassare(p, c.oggi, c.titolari)
  if (id === 'corsi-scaduti') return c.scopertiDi(p).length > 0
  // Nell'elenco c'è solo la data di nascita, non il codice fiscale: chi non ce l'ha vale da adulto (`senzaNascita` lo conta).
  // `T00:00` senza fuso è la mezzanotte locale, come il compleanno in `minorenne`: se no a ovest di Greenwich il giorno slitta.
  if (id === 'minorenni') return eMinorenne(p, null, new Date(`${c.oggi}T00:00`))
  if (titolareSenzaCorsi(p, c.titolari, c.oggi)) return false
  return fuoriRegola(p, c.oggi) || (p.attiva && senzaTessera(c.tesseraDi(p)))
}

/** Quanti si vedrebbero accendendo solo quel chip, con la ricerca e il corso già scelti (`base`). */
export function contiChip(persone: PersonaSeg[], base: (p: PersonaSeg) => boolean, c: ContestoFiltri): Record<ChipConto, number> {
  const dentro = persone.filter(base)
  const contesto = { ...c, titolari: titolariDi(persone) }
  const conta = (id: ChipConto) => dentro.filter((p) => passaChip(id, p, contesto)).length
  return { certificato: conta('certificato'), pagare: conta('pagare'), 'corsi-scaduti': conta('corsi-scaduti'), fuori: conta('fuori'), minorenni: conta('minorenni') }
}

/** Quanti non hanno la data di nascita: col filtro MINORENNI non si sa se lo sono. */
export const senzaNascita = (persone: PersonaSeg[]): number => persone.filter((p) => !p.natoIl).length

/** Il sottotitolo col filtro MINORENNI acceso: il conto, e chi resta fuori perché non ha la data. */
export function fraseMinorenni(minorenni: number, senzaData: number): string {
  const quanti = minorenni === 1 ? 'Un minorenne' : `${minorenni} minorenni`
  const fuori = senzaData === 1 ? ' · una persona senza data di nascita non è contata' : senzaData ? ` · ${senzaData} persone senza data di nascita non sono contate` : ''
  return `${quanti}${fuori}.`
}

/** Il filtro FAMIGLIE: titolari di un nucleo e chi è nel nucleo di qualcuno. */
export const inFamiglia = (p: PersonaSeg, titolari: ReadonlySet<string>): boolean => titolari.has(p.id) || !!p.nucleo

/** La FAMIGLIA di una persona nell'elenco: titolare del nucleo, nel nucleo di qualcuno (anche adulto), o nessuna. */
export type Famiglia = { tipo: 'titolare' } | { tipo: 'membro'; titolare: PersonaSeg | undefined }
export function famigliaDi(p: PersonaSeg, perId: ReadonlyMap<string, PersonaSeg>, titolari: ReadonlySet<string>): Famiglia | null {
  if (titolari.has(p.id)) return { tipo: 'titolare' }
  return p.nucleo ? { tipo: 'membro', titolare: perId.get(p.nucleo) } : null
}

/** La cella CORSI: i primi due e «+N», così la riga resta di un rigo; col filtro Corsi scaduti si vede tutto da sollecitare. */
export function cellaCorsi(nomi: string[], conScaduti: boolean): { visibili: string[]; altri: number; title: string } {
  const visibili = conScaduti || nomi.length <= 2 ? nomi : nomi.slice(0, 2)
  return { visibili, altri: nomi.length - visibili.length, title: nomi.join(', ') }
}
