import { soldi } from './satispay'
import { SERVE_RETE, type ChiPaga, type PuoiPagare } from './saldoSatispay'
import { statoCorsi, vociCorsiDi, type StatoCorso } from './corsiDaPagare'
import type { Listino } from './listino'
import { saldoAperto } from './costi'
import type { Prezzi } from './costi'
import type { Ricevuta } from './ricevute'
import type { SchedaIscritto } from './iscritto'

/**
 * Un corso semplice pagato con Satispay dall'area degli iscritti
 * (`106-paga-corso-satispay.sql`): una sola riga di prezzo nel listino, annuale
 * o trimestre. Con più righe (sconti, più corsi insieme) il prezzo lo fa la
 * segreteria. Le cifre le dà il database dal listino, mai il telefono.
 */

export const CORSO_SPENTO = 'Pagare online non è ancora attivo: il corso si paga in palestra.'
export const CORSO_PAGATO = 'Questo corso è già stato pagato: la segreteria prepara la ricevuta.'
const DA_SEGRETERIA = 'Per questo corso il prezzo lo fa la segreteria: chiedi lì o paga in palestra'

/** I corsi che l'iscritto può essere chiamato a pagare: non coperti, o con l'eccezione «fuori dall'app» scaduta. */
export const DA_PAGARE: StatoCorso['come'][] = ['da_pagare', 'scaduto', 'fuori_scaduto']

export type Formula = 'annuale' | 'trimestre'

/** Cosa dice il database di un corso della persona (`satispay_corsi_chi`): le cifre sono `null` se non si paga adesso. */
export interface CorsoPagabile {
  corsoId: string
  annuale?: number | null
  trimestre?: number | null
  /** Più righe di prezzo: lo fa la segreteria. */
  segreteria: boolean
  /** Ha un prezzo nel listino (il listino l'iscritto non lo legge). */
  aPagamento: boolean
  /** Arrivato con Satispay e non ancora in una ricevuta. */
  pagato: boolean
}

export interface ChiPagaCorsi extends Pick<ChiPaga, 'adulto' | 'haAccessoProprio' | 'comeTitolare'> {
  corsi: CorsoPagabile[]
}

export type PuoiPagareIlCorso = { formula: Formula; importo: number } | Extract<PuoiPagare, { perche: string }>

/**
 * Quanto costa una riga di prezzo, in centesimi, come `prezzo_dal_listino`
 * (`73-satispay.sql`): il trimestre; l'annuale, o il saldo finché è aperto.
 */
export function prezzoDelCorso(riga: Prezzi, formula: Formula, giorno: string, saldoEntro: string): number | null {
  const euro = formula === 'trimestre' ? riga.trimestre : riga.saldo !== undefined && riga.saldo !== riga.annuale && saldoAperto(giorno, saldoEntro) ? riga.saldo : riga.annuale
  return euro === undefined ? null : Math.round(euro * 100)
}

/** Dove Satispay riporta chi ha pagato il corso: il corso e la persona, nell'indirizzo (`iscritti/?corso=…&persona=…`). */
export function ritornoDelCorso(ricerca: string): { corso: string; persona: string } | null {
  const u = new URLSearchParams(ricerca)
  const corso = u.get('corso')
  const persona = u.get('persona')
  return corso && persona ? { corso, persona } : null
}

export function puoiPagareIlCorso(
  stato: Pick<StatoCorso, 'come' | 'formula'>,
  chi: Pick<ChiPaga, 'online' | 'attivo' | 'adulto' | 'haAccessoProprio' | 'comeTitolare' | 'giaPagato'> & { prezzi?: { annuale?: number | null; trimestre?: number | null }; segreteria?: boolean },
): PuoiPagareIlCorso {
  // Solo il corso non coperto: da pagare, o finito (la formula di prima, così com'era), o l'eccezione «fuori dall'app» scaduta.
  if (!DA_PAGARE.includes(stato.come)) return { perche: 'Non c’è un corso da pagare qui' }
  if (chi.segreteria) return { perche: DA_SEGRETERIA }
  // Il titolare paga per chi non ha un accesso suo; chi ce l'ha paga dal suo telefono, e un minorenne solo tramite il titolare.
  if (chi.comeTitolare ? chi.haAccessoProprio : !chi.adulto) return { perche: chi.comeTitolare ? 'Questa persona paga dal suo telefono' : 'Per un minorenne paga chi ha l’accesso del nucleo' }
  if (chi.giaPagato) return { perche: CORSO_PAGATO, motivo: 'pagato' }
  if (!chi.attivo) return { perche: CORSO_SPENTO }
  if (!chi.online) return { perche: SERVE_RETE, motivo: 'rete' }
  const { annuale, trimestre } = chi.prezzi ?? {}
  // Chi ha finito il trimestre non passa da sé all'annuale (e viceversa): il prezzo è un altro e lo guarda la segreteria.
  const formula: Formula | undefined = stato.come === 'scaduto' ? stato.formula : annuale ? 'annuale' : trimestre ? 'trimestre' : undefined
  const importo = formula === 'annuale' ? annuale : formula === 'trimestre' ? trimestre : null
  // Senza l'importo del database non si sa quanto: niente tasto.
  if (!formula || !importo) return { perche: 'Il corso non si può pagare online adesso: chiedi alla segreteria' }
  return { formula, importo }
}

/** Cosa legge chi paga il corso, al ritorno da Satispay (o dopo la conferma in prova). */
export function esitoCorso(
  p: { stato: 'attesa' | 'pagato' | 'non-andato'; importo: number; pagatoIl?: string; chi: string; corso: string },
): { titolo: string; tono: 'fatto' | 'avviso'; testi: string[] } {
  const quanto = soldi(p.importo)
  if (p.stato === 'pagato')
    return { titolo: `PAGATO · ${quanto}`, tono: 'fatto', testi: [`Hai pagato ${quanto} con Satispay il corso ${p.corso} per ${p.chi}. La segreteria prepara la ricevuta: la trovi in DOCUMENTI, sotto RICEVUTE, appena è pronta.`] }
  if (p.stato === 'non-andato')
    return {
      titolo: 'NON È ANDATO',
      tono: 'avviso',
      testi: [`${p.chi} · ${p.corso} · ${quanto}.`, 'Satispay non ha confermato il pagamento: non ti abbiamo preso soldi.', 'Se Satispay ti ha addebitato lo stesso, chiama la segreteria.'],
    }
  return {
    titolo: 'IN ATTESA DI SATISPAY',
    tono: 'avviso',
    testi: [`${p.chi} · ${p.corso} · ${quanto}.`, 'Conferma il pagamento nell’app Satispay. Se hai già confermato, aspetta un minuto: questa pagina si aggiorna da sola.', 'Non pagare di nuovo.'],
  }
}

/**
 * Lo stato dei corsi di una persona come lo vede lei: i suoi corsi di oggi, le
 * sue ricevute e quel che il database dice dei prezzi. Il listino vero l'iscritto
 * non lo legge: ne basta uno finto con un prezzo qualunque per i corsi a
 * pagamento (`statoCorsi` guarda solo se c'è), la cifra vera sta in `chi`.
 */
export function statoCorsiDi(scheda: SchedaIscritto, ricevute: Ricevuta[], chi: ChiPagaCorsi, oggi: string): StatoCorso[] {
  const listino: Listino = {
    quota: 0,
    saldoEntro: '',
    offerte: [],
    corsi: scheda.corsi.filter((c) => chi.corsi.some((x) => x.corsoId === c.id && x.aPagamento)).map((c) => ({ corso: c.nome, corsoId: c.id, eta: '', orari: [], prezzi: [{ annuale: 1 }] })),
  }
  return (
    statoCorsi(
      {
        attiva: true,
        pagamento: scheda.pagamento,
        iscrizioni: scheda.corsi.map((c) => ({ corsoId: c.id, dal: '0000-01-01' })),
        vociCorsi: vociCorsiDi(ricevute.filter((r) => r.personaId === scheda.id)),
        satispay: scheda.satispay,
        satispayQuota: scheda.satispayQuota,
        satispayCorsi: scheda.satispayCorsi,
      },
      scheda.corsi,
      listino,
      oggi,
    ) ?? []
  )
}
