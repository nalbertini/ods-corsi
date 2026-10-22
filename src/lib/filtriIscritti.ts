import { comePaga, fuoriRegola, senzaCertificatoValido, type PersonaSeg } from './segreteria'
import { senzaTessera, type RigaIncrocio } from './tessere'

/**
 * I filtri sopra l'elenco ISCRITTI. Al banco servono quattro ricerche (senza
 * certificato, da pagare, corsi scaduti, non in regola): quelle stanno sempre in vista; le
 * altre stanno dietro «Altri filtri» e si aprono da sole se una è accesa, così
 * un filtro acceso non resta mai nascosto.
 */
export type IdFiltro =
  | 'senza-email' | 'poco' | 'certificato' | 'scadenza' | 'arrivo' | 'pagare'
  | 'corsi-scaduti' | 'fuori' | 'senza-tessera' | 'senza-documento' | 'file-di-prima' | 'doppioni' | 'pagato-prima'

/** Tutti i filtri, per sapere quali sono accesi anche se il loro chip adesso non c'è. */
export const ID_FILTRI: IdFiltro[] = [
  'senza-email', 'poco', 'certificato', 'scadenza', 'arrivo', 'pagare',
  'corsi-scaduti', 'fuori', 'senza-tessera', 'senza-documento', 'file-di-prima', 'doppioni', 'pagato-prima',
]

export const FILTRI_VISIBILI: IdFiltro[] = ['certificato', 'pagare', 'corsi-scaduti', 'fuori']

export const TESTI_FILTRI: Record<IdFiltro, string> = {
  'senza-email': 'Solo senza email',
  poco: 'Vengono poco',
  certificato: 'Senza certificato valido',
  scadenza: 'Certificato in scadenza',
  arrivo: 'Compiono 6 anni',
  pagare: 'Da pagare',
  fuori: 'Non in regola',
  'senza-tessera': 'Senza tessera',
  'senza-documento': 'Senza documento',
  'file-di-prima': 'Non archiviato',
  doppioni: 'Possibili doppioni',
  'pagato-prima': 'Pagato nel vecchio programma',
  'corsi-scaduti': 'Corsi scaduti',
}

/** I filtri nascosti che ci sono adesso: quattro compaiono solo se c'è qualcosa da filtrare. */
export function altriFiltri(c: { conTessere: boolean; filePrima: number; doppioni: number; conStorico: boolean }): IdFiltro[] {
  return [
    'senza-email',
    'poco',
    'scadenza',
    'arrivo',
    ...(c.conTessere ? (['senza-tessera'] as const) : []),
    'senza-documento',
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
export type ChipConto = 'certificato' | 'pagare' | 'corsi-scaduti' | 'fuori'
export const haConto = (id: IdFiltro): id is ChipConto => FILTRI_VISIBILI.includes(id)

/** Quel che i filtri leggono fuori dalla persona: i corsi da pagare e le tessere vengono da altre letture. */
export interface ContestoFiltri {
  oggi: string
  scopertiDi: (p: PersonaSeg) => unknown[]
  tesseraDi: (p: PersonaSeg) => RigaIncrocio[]
}

// La quota si cerca fra chi è attivo: chi ha smesso non la deve portare. Gli stessi conti di DA FARE.
export const daPagare = (p: PersonaSeg, oggi: string) => p.attiva && comePaga(p, oggi) !== 'pagato'

/** Se una persona passa un chip: la stessa regola per il filtro e per il suo conto. */
export function passaChip(id: ChipConto, p: PersonaSeg, c: ContestoFiltri): boolean {
  if (id === 'certificato') return senzaCertificatoValido(p, c.oggi)
  if (id === 'pagare') return daPagare(p, c.oggi)
  if (id === 'corsi-scaduti') return c.scopertiDi(p).length > 0
  return fuoriRegola(p, c.oggi) || (p.attiva && senzaTessera(c.tesseraDi(p)))
}

/** Quanti si vedrebbero accendendo solo quel chip, con la ricerca e il corso già scelti (`base`). */
export function contiChip(persone: PersonaSeg[], base: (p: PersonaSeg) => boolean, c: ContestoFiltri): Record<ChipConto, number> {
  const dentro = persone.filter(base)
  const conta = (id: ChipConto) => dentro.filter((p) => passaChip(id, p, c)).length
  return { certificato: conta('certificato'), pagare: conta('pagare'), 'corsi-scaduti': conta('corsi-scaduti'), fuori: conta('fuori') }
}

/** La cella CORSI: i primi due e «+N», così la riga resta di un rigo; col filtro Corsi scaduti si vede tutto da sollecitare. */
export function cellaCorsi(nomi: string[], conScaduti: boolean): { visibili: string[]; altri: number; title: string } {
  const visibili = conScaduti || nomi.length <= 2 ? nomi : nomi.slice(0, 2)
  return { visibili, altri: nomi.length - visibili.length, title: nomi.join(', ') }
}
