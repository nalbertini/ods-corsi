/**
 * I filtri sopra l'elenco ISCRITTI. Al banco servono tre ricerche (senza
 * certificato, da pagare, non in regola): quelle stanno sempre in vista; le
 * altre stanno dietro «Altri filtri» e si aprono da sole se una è accesa, così
 * un filtro acceso non resta mai nascosto.
 */
export type IdFiltro =
  | 'senza-email' | 'poco' | 'certificato' | 'scadenza' | 'arrivo' | 'pagare'
  | 'fuori' | 'senza-tessera' | 'senza-documento' | 'file-di-prima' | 'doppioni' | 'pagato-prima'

/** Tutti i filtri, per sapere quali sono accesi anche se il loro chip adesso non c'è. */
export const ID_FILTRI: IdFiltro[] = [
  'senza-email', 'poco', 'certificato', 'scadenza', 'arrivo', 'pagare',
  'fuori', 'senza-tessera', 'senza-documento', 'file-di-prima', 'doppioni', 'pagato-prima',
]

export const FILTRI_VISIBILI: IdFiltro[] = ['certificato', 'pagare', 'fuori']

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
