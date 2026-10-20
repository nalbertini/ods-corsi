import type { RigaPagamento } from './pagamenti'
import { dataLunga } from './sala'
import { inEuro } from './vestiario'
import type { CorsoRef, Listino } from './listino'

/**
 * Il pagamento con Satispay dal modulo di iscrizione: le regole e i testi.
 *
 * L'importo lo calcola il database dal listino (`importo_iscrizione`,
 * `supabase/73-satispay.sql`), e lo stato lo scrive la Edge Function
 * `satispay` dopo averlo riletto da Satispay. Qui c'è quello che si vede: cosa
 * legge chi paga, e come il pagamento arrivato entra in PAGAMENTI e in
 * CONTABILITÀ, una volta sola anche quando finisce in una ricevuta.
 */

export type StatoSatispay = 'attesa' | 'pagato' | 'non-andato'

/** Una riga di `pagamenti_satispay`. Importi in centesimi. */
export interface PagamentoSatispay {
  id: string
  richiestaId?: string
  /** «Cognome Nome» della richiesta: resta anche se la richiesta si cancella. */
  chi: string
  importo: number
  stato: StatoSatispay
  creatoIl: string
  pagatoIl?: string
  /** La ricevuta in cui è entrato: da lì conta solo la ricevuta. */
  ricevutaId?: string
  /** La scheda della richiesta accolta. */
  personaId?: string
}

/** Lo stato come lo dice Satispay. Quello che non si conosce è ancora in attesa: mai pagato per sbaglio. */
export const statoDa = (status: string): StatoSatispay => (status === 'ACCEPTED' ? 'pagato' : status === 'CANCELED' ? 'non-andato' : 'attesa')

export const ERRORE_SATISPAY = 'Satispay non risponde: riprova o paga in segreteria'

/** «Judo 3», «Judo 3 e Lotta 3», «Judo 3, Lotta 3 e Zumba». */
const elenco = (x: string[]) => (x.length < 2 ? x.join('') : `${x.slice(0, -1).join(', ')} e ${x[x.length - 1]}`)

/**
 * Se il modulo offre Satispay. Senza il servizio attivo non lo dice nemmeno: si
 * paga col bonifico o in segreteria come prima. Con un corso senza prezzo
 * l'importo non si sa, e lo dice.
 */
export function comePuoiPagare(senzaPrezzo: string[], attivo: boolean): { satispay: true } | { satispay: false; perche: string } {
  if (!attivo) return { satispay: false, perche: '' }
  if (senzaPrezzo.length)
    return {
      satispay: false,
      perche: `Non ancora: il prezzo di ${elenco(senzaPrezzo)} lo conferma la segreteria`,
    }
  return { satispay: true }
}

/** «230 €», «12,50 €» come `inEuro`, con lo spazio che non va a capo: la cifra non si stacca dall'euro. */
export const soldi = (cent: number) => inEuro(cent / 100).replace(' €', '\u00a0€')

/**
 * Il giorno a Roma di un istante: un pagamento alle 23:30 UTC d'ottobre è già il giorno dopo. È `oggiARoma`
 * di contabilita.ts, che però importa questo file: riusarla farebbe un giro di import.
 */
export const giornoARoma = (iso: string) => new Date(iso).toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' })

/** Cosa legge chi ha mandato la richiesta, dopo l'invio e al ritorno da Satispay. */
export function esitoPagamento(p: { stato: StatoSatispay; importo: number; pagatoIl?: string; chi?: string }): {
  titolo: string
  tono: 'fatto' | 'avviso'
  testi: string[]
} {
  const quanto = soldi(p.importo)
  if (p.stato === 'pagato')
    return {
      titolo: 'RICHIESTA ARRIVATA · PAGATO',
      tono: 'fatto',
      testi: [`Hai pagato ${quanto} con Satispay${p.pagatoIl ? ` il ${dataLunga(giornoARoma(p.pagatoIl), false)}` : ''}${p.chi ? `, per ${p.chi}` : ''}.`],
    }
  if (p.stato === 'non-andato')
    return {
      titolo: 'IL PAGAMENTO NON È ANDATO',
      tono: 'avviso',
      testi: [
        `La richiesta è arrivata, ma i ${quanto} non sono stati pagati: in Satispay il pagamento è stato annullato o è rimasto troppo a lungo senza conferma.`,
        'Puoi riprovare, oppure pagare in segreteria.',
      ],
    }
  return {
    titolo: 'RICHIESTA ARRIVATA',
    tono: 'avviso',
    testi: [
      `Manca il pagamento: ${quanto} con Satispay.`,
      'Se hai chiuso Satispay senza confermare, riaprilo da qui: è lo stesso pagamento, non paghi due volte.',
    ],
  }
}

/**
 * I pagamenti Satispay arrivati e non ancora in una ricevuta, come righe di
 * PAGAMENTI. Quando il pagamento entra in una ricevuta lo conta la ricevuta:
 * mai due righe per gli stessi soldi.
 */
export const righeSatispay = (pagamenti: PagamentoSatispay[], nomeDi: (personaId: string) => string): RigaPagamento[] =>
  pagamenti.flatMap((p) =>
    p.stato !== 'pagato' || p.ricevutaId || !p.pagatoIl
      ? []
      : [
          {
            id: `satispay:${p.id}`,
            data: giornoARoma(p.pagatoIl),
            importo: p.importo,
            metodo: 'Satispay',
            voce: 'ISCRIZIONE',
            personaId: p.personaId,
            chi: p.personaId ? nomeDi(p.personaId) : p.chi,
            annullato: false,
          },
        ],
  )

/**
 * Il segno di una richiesta in RICHIESTE ONLINE e la frase nella sua scheda.
 * Un pagamento non andato non si dice: si paga in segreteria, come senza
 * Satispay. Pagata e rifiutata: i soldi sono arrivati e vanno restituiti.
 */
export function segnoRichiesta(
  p: PagamentoSatispay | undefined,
  stato: 'nuova' | 'accolta' | 'rifiutata',
): { tag: string; testo: string; tono: 'aspetta' | 'fatto' | 'guaio' } | null {
  if (!p || p.stato === 'non-andato') return null
  if (p.stato === 'attesa')
    return {
      tag: 'Satispay in attesa',
      testo: `Pagamento Satispay di ${soldi(p.importo)} in attesa: chi si iscrive non l’ha ancora confermato.`,
      tono: 'aspetta',
    }
  const quando = `Pagata con Satispay${p.pagatoIl ? ` il ${dataLunga(giornoARoma(p.pagatoIl), false)}` : ''}: ${soldi(p.importo)}`
  if (p.ricevutaId)
    return {
      tag: 'Pagata',
      testo: `${quando}, già nella ricevuta.`,
      tono: 'fatto',
    }
  if (stato === 'rifiutata')
    return {
      tag: 'Da restituire',
      testo: `${quando} da restituire dall’app Satispay Business, e poi da registrare in CONTABILITÀ.`,
      tono: 'guaio',
    }
  return {
    tag: 'Pagata',
    testo: `${quando}. Nella ricevuta dalla scheda il pagamento è già dentro: non segnarlo di nuovo.`,
    tono: 'fatto',
  }
}

/** Il pagamento Satispay da mettere nella ricevuta di una persona: arrivato e non ancora in una ricevuta. */
export const satispayDaUsare = (pagamenti: PagamentoSatispay[], personaId: string) =>
  pagamenti.find((p) => p.stato === 'pagato' && !p.ricevutaId && p.personaId === personaId)

/** Come `emetti_ricevuta_satispay`: nella ricevuta il pagato con Satispay è esattamente quello arrivato. */
export function cosaNonVaSatispay(voci: Array<{ pagamenti: Array<{ importo: number; metodo: string }> }>, p: PagamentoSatispay): string | null {
  const qui = voci
    .flatMap((v) => v.pagamenti)
    .filter((x) => x.metodo === 'Satispay')
    .reduce((s, x) => s + x.importo, 0)
  return qui === p.importo ? null : `Con Satispay sono arrivati ${soldi(p.importo)}: nel pagato di questa ricevuta ce ne sono ${soldi(qui)}`
}

/** Come si paga dal modulo pubblico: con Satispay subito, col bonifico (e la sua ricevuta) o in segreteria. */
export type Pago = 'satispay' | 'bonifico' | 'segreteria'

/**
 * Il modo che vale davvero. Satispay scelto ma non possibile (un corso senza
 * prezzo, il servizio spento) è in segreteria. Dal nucleo di un iscritto non
 * si sceglie: si paga come prima (`null`).
 */
export const modoPagamento = (scelto: Pago, puoi: { satispay: boolean }, nucleo: boolean): Pago | null =>
  nucleo ? null : scelto === 'satispay' && !puoi.satispay ? 'segreteria' : scelto

/** La ricevuta del bonifico si chiede solo a chi paga col bonifico; dal nucleo resta fra i file, come prima. */
export const chiedeRicevuta = (modo: Pago | null) => !modo || modo === 'bonifico'

/**
 * I corsi che per il database non hanno prezzo: `importo_iscrizione` trova la
 * voce del listino solo per `corsoId`, mentre la stima ripiega sul nome. Senza
 * questo il modulo offrirebbe Satispay e il database poi lo rifiuterebbe.
 */
export const senzaVoceDelCorso = (corsi: CorsoRef[], listino: Listino): string[] =>
  corsi.filter((c) => !listino.corsi.some((v) => v.corsoId === c.id)).map((c) => c.nome)
