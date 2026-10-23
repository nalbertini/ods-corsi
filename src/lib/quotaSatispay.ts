import { pagamentoDi, type PersonaSeg } from './segreteria'
import { soldi } from './satispay'
import { SERVE_RETE, type ChiPaga, type PuoiPagare } from './saldoSatispay'

/**
 * La quota associativa intera pagata con Satispay dall'area degli iscritti
 * (`105-paga-quota-satispay.sql`): chi non ha la quota, o ce l'ha scaduta.
 * Il resto di una quota pagata in parte è il saldo (`saldoSatispay.ts`).
 * L'importo è quello del listino e lo dà il database (`ChiPaga.importo`).
 */

export const QUOTA_PAGATA = 'Questa quota è già stata pagata: la segreteria prepara la ricevuta.'
export const QUOTA_SPENTA = 'Pagare online non è ancora attivo: la quota si paga in palestra.'

export type PuoiPagareLaQuota = { importo: number } | Extract<PuoiPagare, { perche: string }>

/** Dove Satispay riporta chi ha pagato la quota: la persona, nell'indirizzo (`iscritti/?quota=1&persona=…`). */
export function ritornoDellaQuota(ricerca: string): { persona: string } | null {
  const u = new URLSearchParams(ricerca)
  const persona = u.get('persona')
  return u.get('quota') && persona ? { persona } : null
}

export function puoiPagareLaQuota(p: Pick<PersonaSeg, 'pagamento' | 'quote' | 'satispay' | 'saldo'>, oggi: string, chi: ChiPaga): PuoiPagareLaQuota {
  // Solo chi non ha la quota: da pagare o scaduta. Pagata, in parte (c'è il saldo) o già con Satispay no.
  const come = pagamentoDi(p, oggi).come
  if (come !== 'da_pagare' && come !== 'scaduto') return { perche: 'Non c’è una quota da pagare qui' }
  // Il titolare paga per chi non ha un accesso suo; chi ce l'ha paga dal suo telefono, e un minorenne solo tramite il titolare.
  if (chi.comeTitolare ? chi.haAccessoProprio : !chi.adulto) return { perche: chi.comeTitolare ? 'Questa persona paga dal suo telefono' : 'Per un minorenne paga chi ha l’accesso del nucleo' }
  if (chi.giaPagato) return { perche: QUOTA_PAGATA, motivo: 'pagato' }
  if (!chi.attivo) return { perche: QUOTA_SPENTA }
  if (!chi.online) return { perche: SERVE_RETE, motivo: 'rete' }
  // Senza l'importo del database non si sa quanto: niente tasto.
  if (!chi.importo) return { perche: 'La quota non si può pagare online adesso: chiedi alla segreteria' }
  return { importo: chi.importo }
}

/** Cosa legge chi paga la quota, al ritorno da Satispay (o dopo la conferma in prova). */
export function esitoQuota(
  p: { stato: 'attesa' | 'pagato' | 'non-andato'; importo: number; pagatoIl?: string; chi: string },
): { titolo: string; tono: 'fatto' | 'avviso'; testi: string[] } {
  const quanto = soldi(p.importo)
  if (p.stato === 'pagato')
    return { titolo: `PAGATO · ${quanto}`, tono: 'fatto', testi: [`Hai pagato ${quanto} con Satispay per ${p.chi}. La segreteria prepara la ricevuta e la trovi in DOCUMENTI, sotto RICEVUTE.`] }
  if (p.stato === 'non-andato')
    return {
      titolo: 'NON È ANDATO',
      tono: 'avviso',
      testi: [`${p.chi} · ${quanto} · quota associativa.`, 'Satispay non ha confermato il pagamento: non ti abbiamo preso soldi.', 'Se Satispay ti ha addebitato lo stesso, chiama la segreteria.'],
    }
  return {
    titolo: 'IN ATTESA DI SATISPAY',
    tono: 'avviso',
    testi: [`${p.chi} · ${quanto} · quota associativa.`, 'Conferma il pagamento nell’app Satispay. Se hai già confermato, aspetta un minuto: questa pagina si aggiorna da sola.', 'Non pagare di nuovo.'],
  }
}
