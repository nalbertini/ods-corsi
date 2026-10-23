import { pagamentoDi, type PersonaSeg } from './segreteria'
import { soldi, type StatoSatispay } from './satispay'
import type { Ricevuta } from './ricevute'

/**
 * Il saldo della quota associativa pagato con Satispay dall'area degli
 * iscritti (`103-saldo-satispay.sql`): quando si può, e cosa si legge dopo.
 * Solo il pezzo che manca di una quota pagata in parte con una ricevuta: niente
 * iscrizioni, rinnovi o corsi. L'importo vero lo calcola il database.
 */

export interface ChiPaga {
  online: boolean
  /** La Edge Function `satispay` risponde che il servizio c'è (e `103` è stato lanciato). */
  attivo: boolean
  adulto: boolean
  /** La persona ha un account suo (`persone.utente_id`). */
  haAccessoProprio: boolean
  /** Paga il titolare del nucleo, non la persona da sé. */
  comeTitolare: boolean
  /** Il saldo di questa ricevuta è già arrivato e non è ancora in una ricevuta: non se ne fa un secondo. (In attesa invece si può riaprire.) */
  giaPagato?: boolean
  /** Centesimi della quota intera, dal database (`105-paga-quota-satispay.sql`): `null` se non si paga adesso. */
  importo?: number | null
}

export const SERVE_RETE = 'Serve la rete per pagare'
export const SALDO_PAGATO = 'Questo resto è già stato pagato: la segreteria prepara la ricevuta.'
export const SALDO_SPENTO = 'Pagare online non è ancora attivo: il resto si paga in palestra.'

/** La ricevuta («12/2026») e i centesimi che mancano, o il perché non si può pagare (`motivo`: quel che l'app deve far vedere). */
export type PuoiPagare = { ricevuta: string; mancano: number } | { perche: string; motivo?: 'pagato' | 'rete' }

/** Dove Satispay riporta chi ha pagato il saldo: la ricevuta e la persona, nell'indirizzo (`iscritti/?saldo=…&persona=…`). */
export function ritornoDelSaldo(ricerca: string): { ricevuta: string; persona: string } | null {
  const u = new URLSearchParams(ricerca)
  const ricevuta = u.get('saldo')
  const persona = u.get('persona')
  return ricevuta && persona ? { ricevuta, persona } : null
}

export interface AltroConResto {
  persona: string
  ricevuta: string
  chi: string
  mancano: number
}

/** Gli altri del nucleo che sembrano avere ancora un resto da pagare: il titolare li paga subito dopo. */
export function altriConResto(
  nucleo: Array<Pick<PersonaSeg, 'pagamento' | 'quote' | 'satispay' | 'saldo'> & { id: string; nome: string; cognome: string }>,
  ricevute: Ricevuta[],
  oggi: string,
  esclusa: string,
): AltroConResto[] {
  return nucleo.flatMap((p) => {
    const q = pagamentoDi(p, oggi)
    const r = ricevute.find((x) => !x.annullataIl && x.personaId === p.id && `${x.numero}/${x.anno}` === q.ricevuta)
    return p.id !== esclusa && q.come === 'in_parte' && q.fonte === 'ricevuta' && q.mancano && r
      ? [{ persona: p.id, ricevuta: r.id, chi: `${p.nome} ${p.cognome}`, mancano: q.mancano }]
      : []
  })
}

/** Il primo di `altri` il cui saldo non è già arrivato (`pagati[i]`: lo stato letto per `altri[i]`, `null` se non si sa). */
export function primoResto(altri: AltroConResto[], pagati: Array<StatoSatispay | null>): AltroConResto | null {
  return altri.find((_, i) => pagati[i] !== 'pagato') ?? null
}

export function puoiPagareIlSaldo(p: Pick<PersonaSeg, 'pagamento' | 'quote' | 'satispay' | 'saldo'>, oggi: string, chi: ChiPaga): PuoiPagare {
  const q = pagamentoDi(p, oggi)
  // Solo il resto di una quota pagata in parte con una ricevuta: il resto è iscrizione, rinnovo o pagato fuori app.
  if (q.come !== 'in_parte' || q.fonte !== 'ricevuta' || !q.mancano || !q.ricevuta) return { perche: 'Non c’è un saldo da pagare qui' }
  // Il titolare paga per chi non ha un accesso suo; chi ce l'ha paga dal suo telefono, e un minorenne solo tramite il titolare.
  if (chi.comeTitolare ? chi.haAccessoProprio : !chi.adulto) return { perche: chi.comeTitolare ? 'Questa persona paga dal suo telefono' : 'Per un minorenne paga chi ha l’accesso del nucleo' }
  if (chi.giaPagato) return { perche: SALDO_PAGATO, motivo: 'pagato' }
  if (!chi.attivo) return { perche: SALDO_SPENTO }
  if (!chi.online) return { perche: SERVE_RETE, motivo: 'rete' }
  return { ricevuta: q.ricevuta, mancano: q.mancano }
}

/** Cosa legge chi paga il saldo, al ritorno da Satispay: `restano` è un altro del nucleo che ha ancora un saldo. */
export function esitoSaldo(
  p: { stato: StatoSatispay; importo: number; pagatoIl?: string; chi: string },
  restano: { chi: string; mancano: number } | null,
): { titolo: string; tono: 'fatto' | 'avviso'; testi: string[] } {
  const quanto = soldi(p.importo)
  if (p.stato === 'pagato')
    return {
      titolo: `PAGATO · ${quanto}`,
      tono: 'fatto',
      testi: [
        `Hai pagato ${quanto} con Satispay per ${p.chi}. La segreteria prepara la ricevuta e la trovi in RICEVUTE.`,
        ...(restano ? [`ANCORA DA PAGARE ${restano.chi} · ${soldi(restano.mancano)}`] : []),
      ],
    }
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
