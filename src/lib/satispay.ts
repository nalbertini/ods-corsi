import type { RigaPagamento } from './pagamenti'
import { dataLunga } from './sala'
import { inEuro } from './vestiario'
import type { CorsoRef, Listino } from './listino'
import { METODI } from './ricevute'
import { accesi } from './metodiPagamento'
import { chiama } from './sito'

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
  /** La ricevuta valida in cui è entrato: da lì conta solo la ricevuta. Annullata, non c'è più. */
  ricevutaId?: string
  /** La scheda della richiesta accolta. */
  personaId?: string
  /**
   * Pagato prima di mandare la richiesta (`83-satispay-prima.sql`): per quale
   * corso e formula, e di chi, per richiamarlo se la richiesta non arriva.
   */
  corsoId?: string
  formula?: 'annuale' | 'trimestre'
  nome?: string
  cognome?: string
  email?: string
  /** Il nome del corso pagato, per la riga in PAGAMENTI. */
  corso?: string
  /** Quando una richiesta l'ha preso: resta anche se la richiesta si cancella, e allora non si riusa. */
  presoIl?: string
  /** La ricevuta di cui è il saldo della quota (`103-saldo-satispay.sql`): non è l'iscrizione. */
  saldoDi?: string
  /** La quota intera (`105-paga-quota-satispay.sql`) o un corso (`106-paga-corso-satispay.sql`) pagati dall'area iscritti: non sono l'iscrizione. */
  voce?: 'quota' | 'corso'
  /** Pagato con la carta (`115-carta.sql`): assente, è Satispay. */
  circuito?: 'carta'
  /** La chiave del browser che l'ha preparato (`chiaveDelBrowser`). */
  chiave?: string
}

/** Lo stato di un ordine con la carta: sta con la Edge Function `paypal`, che lo usa. */
export { siCattura, statoCarta, statoDopoCattura } from '../../supabase/functions/paypal/stato.ts'

const CHIAVE_DEL_BROWSER = 'ods-chiave-pagamento'
let chiaveInMemoria: string | undefined

/**
 * La chiave di questo browser per i pagamenti, con la carta e con Satispay
 * (`115-carta.sql`, `125-satispay-chiave.sql`): solo chi l'ha fatto ritrova un pagamento, non chi conosce nome, email e
 * scelta. Resta in localStorage per ritrovarlo dopo aver ricaricato la pagina;
 * senza (navigazione privata) vale finché resta aperta la pagina.
 */
export function chiaveDelBrowser() {
  try {
    const c = localStorage.getItem(CHIAVE_DEL_BROWSER)
    if (c) return c
  } catch {
    // Senza localStorage: quella in memoria.
  }
  chiaveInMemoria ??= crypto.randomUUID()
  try {
    localStorage.setItem(CHIAVE_DEL_BROWSER, chiaveInMemoria)
  } catch {
    // Resta in memoria.
  }
  return chiaveInMemoria
}

/** Lo stato come lo dice Satispay. Quello che non si conosce è ancora in attesa: mai pagato per sbaglio. */
export const statoDa = (status: string): StatoSatispay => (status === 'ACCEPTED' ? 'pagato' : status === 'CANCELED' ? 'non-andato' : 'attesa')

export const ERRORE_SATISPAY = 'Satispay non risponde: riprova fra qualche minuto'

/** I rifiuti di `invia_iscrizione` per il pagamento fatto prima (`83-satispay-prima.sql`): gli stessi testi in prova. */
export const PAGAMENTO_NON_ARRIVATO = 'Il pagamento Satispay non è ancora arrivato: conferma in Satispay e riprova'
export const PAGAMENTO_ALTRA_SCELTA = 'Il pagamento Satispay era per un altro corso o un’altra formula: rimetti la scelta di prima, o chiama la segreteria'
export const PAGAMENTO_NON_VALE = 'Questo pagamento Satispay non vale più: paga di nuovo in fondo al modulo'
export const PAGAMENTO_ALTRO_BROWSER = 'Il pagamento Satispay è stato fatto da un altro browser: apri il modulo da dove hai pagato, o chiama la segreteria'
export const PAGAMENTO_CARTA_ALTRO_BROWSER = 'Il pagamento con la carta è stato fatto da un altro browser: apri il modulo da dove hai pagato, o chiama la segreteria'
export const PAGAMENTO_ALTRA_PERSONA = 'Il pagamento Satispay è a un altro nome o un’altra email: rimetti quelli di prima, o chiama la segreteria'
/** Nome o cognome oltre la misura della colonna: lo stesso testo di `satispay_prepara_prima`. */
export const NOME_TROPPO_LUNGO = 'Un campo non va: nome e cognome hanno al massimo 80 caratteri'
/** Senza `83-satispay-prima.sql` la Edge Function dice che il servizio non c'è: si paga col bonifico. */
export const SATISPAY_SPENTO = 'Satispay per ora non è attivo: scegli il bonifico'
/** Pagato con Satispay e poi scelto il bonifico: si pagherebbe due volte. */
export const GIA_PAGATO_SATISPAY = 'Hai già pagato con Satispay: rimetti Satispay in «Paghi con» per mandare la richiesta, o chiama la segreteria'

/** Gli stessi testi per la carta (`115-carta.sql`): chi paga non legge mai il nome del circuito. */
export const ERRORE_CARTA = 'Il pagamento con la carta non risponde: riprova fra qualche minuto'
export const CARTA_SPENTA = 'Carta per ora non è attiva: scegli il bonifico'
/** Il rifiuto della banca: mai il suo testo. */
export const CARTA_RIFIUTATA = 'La carta non è passata: controlla i dati o usa un’altra carta. Non ti è stato addebitato niente.'
export const DATI_CARTA = 'Controlla i dati della carta: numero, scadenza, codice di sicurezza e nome'
/**
 * Dopo un PAGA che non è andato: i dati scritti male si dicono; con i dati giusti
 * resta il no della banca se è arrivato (`gia`), se no il circuito non risponde.
 * `validi` null: i campi non hanno detto com'erano.
 */
export const guaioInvio = (validi: boolean | null, gia: string | null): string =>
  validi === false ? DATI_CARTA : (gia ?? ERRORE_CARTA)
/**
 * Google Pay: chiuderlo senza pagare non è un guaio. Un errore suo (con `statusCode`)
 * è il circuito che non risponde; uno senza viene dalla conferma, cioè la carta rifiutata.
 */
export function guaioGoogle(e: unknown): string | null {
  if (typeof e === 'object' && e !== null && 'statusCode' in e) return e.statusCode === 'CANCELED' ? null : ERRORE_CARTA
  return CARTA_RIFIUTATA
}
export const GIA_PAGATO_CARTA = 'Hai già pagato con la carta: rimetti Carta in «Paghi con» per mandare la richiesta, o chiama la segreteria'
export const PAGAMENTO_CARTA_NON_ARRIVATO = 'Il pagamento con la carta non è ancora arrivato: aspetta la conferma e riprova'
export const PAGAMENTO_CARTA_ALTRA_SCELTA = 'Il pagamento con la carta era per un altro corso o un’altra formula: rimetti la scelta di prima, o chiama la segreteria'
export const PAGAMENTO_CARTA_NON_VALE = 'Questo pagamento con la carta non vale più: paga di nuovo in fondo al modulo'
export const PAGAMENTO_CARTA_ALTRA_PERSONA = 'Il pagamento con la carta è a un altro nome o un’altra email: rimetti quelli di prima, o chiama la segreteria'

/** Il metodo di PAGAMENTI e delle ricevute, e come lo si dice: «Carta», «con la carta». */
/** Il PAGATO CON di un pagamento dal modulo, nella ricevuta e in CONTABILITÀ. */
export const metodoDi = (p: { circuito?: 'carta' }) => (p.circuito === 'carta' ? 'Carta' : 'Satispay')
const conIl = (p: { circuito?: 'carta' }) => (p.circuito === 'carta' ? 'con la carta' : 'con Satispay')
const Con = (p: { circuito?: 'carta' }) => (p.circuito === 'carta' ? 'Con la carta' : 'Con Satispay')

/** «Judo 3», «Judo 3 e Lotta 3», «Judo 3, Lotta 3 e Zumba». */
const elenco = (x: string[]) => (x.length < 2 ? x.join('') : `${x.slice(0, -1).join(', ')} e ${x[x.length - 1]}`)

/**
 * Se il modulo offre Satispay. Senza il servizio attivo non lo dice nemmeno: si
 * paga col bonifico, con la sua ricevuta. Con un corso senza prezzo
 * l'importo non si sa, e lo dice.
 */
export function comePuoiPagare(senzaPrezzo: string[], attivo: boolean): { satispay: true } | { satispay: false; perche: string } {
  if (!attivo) return { satispay: false, perche: '' }
  if (senzaPrezzo.length)
    return {
      satispay: false,
      perche: `Niente Satispay per ora: il prezzo di ${elenco(senzaPrezzo)} lo conferma la segreteria`,
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
export function esitoPagamento(p: { stato: StatoSatispay; importo: number; pagatoIl?: string; chi?: string; circuito?: 'carta' }): {
  titolo: string
  tono: 'fatto' | 'avviso'
  testi: string[]
} {
  const quanto = soldi(p.importo)
  if (p.stato === 'pagato')
    return {
      titolo: 'RICHIESTA ARRIVATA · PAGATO',
      tono: 'fatto',
      testi: [`Hai pagato ${quanto} ${conIl(p)}${p.pagatoIl ? ` il ${dataLunga(giornoARoma(p.pagatoIl), false)}` : ''}${p.chi ? `, per ${p.chi}` : ''}.`],
    }
  if (p.stato === 'non-andato')
    return {
      titolo: 'IL PAGAMENTO NON È ANDATO',
      tono: 'avviso',
      testi: [
        `La richiesta è arrivata, ma i ${quanto} non sono stati pagati: in Satispay il pagamento è stato annullato o è rimasto troppo a lungo senza conferma.`,
        'Puoi riprovare con Satispay.',
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
            id: `${p.circuito ?? 'satispay'}:${p.id}`,
            data: giornoARoma(p.pagatoIl),
            importo: p.importo,
            metodo: metodoDi(p),
            voce: p.saldoDi ? 'QUOTA ASSOCIATIVA (saldo)' : p.voce === 'quota' ? 'QUOTA ASSOCIATIVA' : p.voce === 'corso' ? `${p.formula ?? ''} ${p.corso ?? ''}`.trim().toUpperCase() : 'ISCRIZIONE',
            personaId: p.personaId,
            chi: p.personaId ? nomeDi(p.personaId) : p.chi,
            // Pagato in fondo al modulo e la richiesta non è partita: la segreteria richiama o restituisce.
            ...(!p.richiestaId &&
              !p.personaId &&
              !p.saldoDi && {
                nota: [`${metodoDi(p)} senza richiesta`, p.email, p.corso && `${p.formula ?? ''} ${p.corso}`.trim()].filter(Boolean).join(' · '),
                senzaRichiesta: true,
              }),
            annullato: false,
          },
        ],
  )

/**
 * Il segno di una richiesta in RICHIESTE ONLINE e la frase nella sua scheda.
 * Un pagamento non andato non si dice: si riprova, come senza
 * Satispay. Pagata e rifiutata: i soldi sono arrivati e vanno restituiti.
 */
export function segnoRichiesta(
  p: PagamentoSatispay | undefined,
  stato: 'nuova' | 'accolta' | 'rifiutata',
): { tag: string; testo: string; tono: 'aspetta' | 'fatto' | 'guaio' } | null {
  if (!p || p.stato === 'non-andato') return null
  if (p.stato === 'attesa')
    return {
      tag: `${metodoDi(p)} in attesa`,
      testo: `Pagamento ${p.circuito === 'carta' ? 'con la carta' : 'Satispay'} di ${soldi(p.importo)} in attesa: chi si iscrive non l’ha ancora confermato.`,
      tono: 'aspetta',
    }
  const quando = `Pagata ${conIl(p)}${p.pagatoIl ? ` il ${dataLunga(giornoARoma(p.pagatoIl), false)}` : ''}: ${soldi(p.importo)}`
  if (p.ricevutaId)
    return {
      tag: 'Pagata',
      testo: `${quando}, già nella ricevuta.`,
      tono: 'fatto',
    }
  if (stato === 'rifiutata')
    return {
      tag: 'Da restituire',
      testo: `${quando} da restituire ${p.circuito === 'carta' ? 'dal conto PayPal' : 'dall’app Satispay Business'}, e poi da registrare in CONTABILITÀ.`,
      tono: 'guaio',
    }
  return {
    tag: 'Pagata',
    testo: `${quando}. Nella ricevuta dalla scheda il pagamento è già dentro: non segnarlo di nuovo.`,
    tono: 'fatto',
  }
}

/** Il pagamento Satispay da mettere nella ricevuta di una persona: arrivato e non ancora in una ricevuta. */
/** PAGATO CON nella ricevuta: i soliti, più quello del pagamento arrivato dal modulo o del pagamento a mano con Satispay. */
export const metodiRicevuta = (sp: { circuito?: 'carta' } | undefined, metodoDaPagamento: string | undefined, spenti: readonly string[] = []): string[] =>
  // Il pagamento già arrivato o già scritto resta fra le scelte anche se il metodo è spento: è successo.
  accesi(sp ? [...METODI, metodoDi(sp)] : metodoDaPagamento?.trim() === 'Satispay' ? [...METODI, 'Satispay'] : [...METODI], spenti, sp ? metodoDi(sp) : metodoDaPagamento)

/** La frase della scheda senza ricevute, per i soldi arrivati dal modulo (`satispay`, tutti, e `carta`, quanti con la carta). */
export function fraseDalModulo(satispay: number | undefined, carta: number | undefined): string | null {
  const conCarta = carta ?? 0
  const conSatispay = (satispay ?? 0) - conCarta
  if (conSatispay && conCarta) return `Ha pagato ${soldi(conSatispay)} con Satispay e ${soldi(conCarta)} con la carta dal modulo: fai una ricevuta per ciascuno.`
  if (conCarta) return `Ha pagato ${soldi(conCarta)} con la carta dal modulo: fai la ricevuta, con PAGATO CON «Carta».`
  if (conSatispay) return `Ha pagato ${soldi(conSatispay)} con Satispay dal modulo: fai la ricevuta, con PAGATO CON «Satispay».`
  return null
}

export const satispayDaUsare = (pagamenti: PagamentoSatispay[], personaId: string) =>
  pagamenti.find((p) => p.stato === 'pagato' && !p.ricevutaId && !p.saldoDi && p.personaId === personaId)

/** Come `emetti_ricevuta_satispay`: nella ricevuta il pagato con Satispay è esattamente quello arrivato. */
export function cosaNonVaSatispay(voci: Array<{ pagamenti: Array<{ importo: number; metodo: string }> }>, p: PagamentoSatispay): string | null {
  const qui = voci
    .flatMap((v) => v.pagamenti)
    .filter((x) => x.metodo === metodoDi(p))
    .reduce((s, x) => s + x.importo, 0)
  return qui === p.importo ? null : `${Con(p)} sono arrivati ${soldi(p.importo)}: nel pagato di questa ricevuta ce ne sono ${soldi(qui)}`
}

/** Come si paga dal modulo pubblico: con Satispay o la carta subito, o col bonifico e la sua ricevuta (decisioni del 2026-10-20 e del 2026-10-25). */
export type Pago = 'satispay' | 'carta' | 'bonifico'

/**
 * Il modo che vale davvero. Satispay scelto ma non possibile (un corso senza
 * prezzo, il servizio spento) è il bonifico; la carta vale negli stessi casi
 * di Satispay, e solo col suo servizio acceso. Dal nucleo di un iscritto non
 * si sceglie: si paga come prima (`null`); `null` anche finché non si sceglie, e col bonifico spento
 * (REGOLE → COME SI PAGA) quando non resta nessun altro modo.
 */
export const modoPagamento = (scelto: Pago | null, puoi: { satispay: boolean; carta?: boolean }, nucleo: boolean, bonifico = true): Pago | null =>
  nucleo || !scelto
    ? null
    : (scelto === 'satispay' && !puoi.satispay) || (scelto === 'carta' && !(puoi.satispay && puoi.carta)) || (scelto === 'bonifico' && !bonifico)
      ? bonifico
        ? 'bonifico'
        : null
      : scelto

/**
 * La ricevuta del bonifico si chiede solo a chi paga col bonifico; dal nucleo
 * resta fra i file, come prima. Dalla pagina pubblica, finché non si sceglie
 * come pagare, non si chiede: la chiederà il bonifico.
 */
export const chiedeRicevuta = (modo: Pago | null, nucleo: boolean) => nucleo || modo === 'bonifico'

/**
 * I corsi che per il database non hanno prezzo: `importo_iscrizione` trova la
 * voce del listino solo per `corsoId`, mentre la stima ripiega sul nome. Senza
 * questo il modulo offrirebbe Satispay e il database poi lo rifiuterebbe.
 */
export const senzaVoceDelCorso = (corsi: CorsoRef[], listino: Listino): string[] =>
  corsi.filter((c) => !listino.corsi.some((v) => v.corsoId === c.id)).map((c) => c.nome)

/**
 * Una ricevuta della persona con un Satispay arrivato e non ancora in una
 * ricevuta: col metodo «Satispay» lo prende dentro; con un altro metodo
 * quei soldi si conterebbero due volte, nella ricevuta e fra i pagamenti.
 */
export const cosaNonVaMetodo = (metodo: string, p: PagamentoSatispay | undefined): string | null =>
  p && metodo !== metodoDi(p) ? `${Con(p)} sono già arrivati ${soldi(p.importo)}: scegli PAGATO CON «${metodoDi(p)}», se no si contano due volte` : null

/**
 * Un pagamento a mano con Satispay quando dal modulo ne è arrivato uno non ancora in una ricevuta (`libero`, in
 * centesimi, da `satispayPerPersona`): quei soldi vanno nella ricevuta, se no si contano due volte. Lo stesso testo di
 * `registra_pagamento_diretto` (88-pagamento-una-volta.sql). Senza Satispay libero, Satispay al banco va bene.
 */
export function cosaNonVaSatispayAMano(metodo: string, libero: number | undefined, liberoCarta?: number): string | null {
  const m = metodo.trim().toLowerCase()
  if (libero && m === 'satispay') return `Con Satispay sono già arrivati ${soldi(libero)} dal modulo: fai la ricevuta con quelli`
  if (liberoCarta && m === 'carta') return `Con la carta sono già arrivati ${soldi(liberoCarta)} dal modulo: fai la ricevuta con quelli`
  return null
}

/** Cosa dire prima di rifiutare o eliminare una richiesta pagata: i soldi restano, e vanno restituiti. */
export const daRestituire = (p: PagamentoSatispay | undefined): string | null =>
  p?.stato === 'pagato' && !p.ricevutaId
    ? `I ${soldi(p.importo)} pagati ${conIl(p)} restano in PAGAMENTI: vanno restituiti ${p.circuito === 'carta' ? 'dal conto PayPal' : 'dall’app Satispay Business'}.`
    : null

/**
 * Perché Satispay non c'è anche se ogni corso ha il prezzo: solo i casi
 * semplici, come `importo_iscrizione` (decisione del 2026-10-20). Con più
 * corsi valgono le offerte del listino, con più righe di prezzo i giorni
 * scelti: li conferma la segreteria. `null` se è semplice.
 */
export function nonSemplice(corsi: CorsoRef[], listino: Listino, fuoriEta: string[] = []): string | null {
  if (corsi.length > 1) return 'Niente Satispay per ora: con più corsi il prezzo lo conferma la segreteria'
  // Fuori età la segreteria richiama, e il corso può cambiare: niente soldi da restituire.
  if (fuoriEta.length) return `Niente Satispay per ora: ${fuoriEta.join(', ')} non è della sua età, la segreteria ti richiama`
  const conRighe = corsi.find((c) => (listino.corsi.find((v) => v.corsoId === c.id)?.prezzi.length ?? 0) > 1)
  return conRighe ? `Niente Satispay per ora: il prezzo di ${conRighe.nome} dipende dai giorni, lo conferma la segreteria` : null
}

/** Per ogni scheda, i centesimi arrivati con Satispay e non ancora in una ricevuta: la quota non è da pagare. */
export function satispayPerPersona(pagamenti: PagamentoSatispay[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const p of pagamenti) if (p.stato === 'pagato' && !p.ricevutaId && !p.saldoDi && p.voce !== 'corso' && p.personaId) m.set(p.personaId, (m.get(p.personaId) ?? 0) + p.importo)
  return m
}

/** Quanto di `satispayPerPersona` è arrivato con la carta: a mano si controllano a parte (`cosaNonVaSatispayAMano`). */
export const cartaPerPersona = (pagamenti: PagamentoSatispay[]) => satispayPerPersona(pagamenti.filter((p) => p.circuito === 'carta'))

/** Per ogni scheda, i centesimi della quota intera pagati con Satispay (105) e non ancora in una ricevuta: sono dentro `satispayPerPersona`, ma non coprono i corsi. */
export function satispayQuotaPerPersona(pagamenti: PagamentoSatispay[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const p of pagamenti) if (p.stato === 'pagato' && !p.ricevutaId && p.voce === 'quota' && p.personaId) m.set(p.personaId, (m.get(p.personaId) ?? 0) + p.importo)
  return m
}

/** Per ogni scheda, i corsi pagati con Satispay (106) e non ancora in una ricevuta: ognuno copre solo sé stesso. */
export function satispayCorsiPerPersona(pagamenti: PagamentoSatispay[]): Map<string, string[]> {
  const m = new Map<string, string[]>()
  for (const p of pagamenti)
    if (p.stato === 'pagato' && !p.ricevutaId && p.voce === 'corso' && p.personaId && p.corsoId) m.set(p.personaId, [...(m.get(p.personaId) ?? []), p.corsoId])
  return m
}

/** Per ogni scheda, i centesimi del saldo della quota arrivati con Satispay e non ancora in una ricevuta. */
export function saldoPerPersona(pagamenti: PagamentoSatispay[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const p of pagamenti) if (p.stato === 'pagato' && !p.ricevutaId && p.saldoDi && p.personaId) m.set(p.personaId, (m.get(p.personaId) ?? 0) + p.importo)
  return m
}

/**
 * Il modo si sceglie: niente già scelto, così nessuno paga una cosa che non
 * ha guardato. Col bonifico la ricevuta è obbligatoria: senza, non si sa se
 * ha pagato. Dal nucleo non si sceglie, e si paga come prima.
 */
export function cosaNonVaModo(
  modo: Pago | null,
  nucleo: boolean,
  conRicevuta: boolean,
  satispay: {
    /** pagato per la scelta di adesso */ pronto: boolean
    /** un pagamento arrivato, per qualunque scelta */ giaPagato: boolean
    /** di quale circuito è il pagamento arrivato: assente, Satispay */ circuito?: 'carta'
  },
  /** se il modulo offre la carta */
  carta = false,
  /** se c'è almeno un modo da scegliere: tutti spenti, la richiesta parte e la segreteria sente chi paga */
  scelte = true,
): string | null {
  if (nucleo || (!modo && !scelte)) return null
  if (!modo) return carta ? 'Manca come paghi: Satispay, carta o bonifico' : 'Manca come paghi: Satispay o bonifico'
  // Pagato e poi cambiato modo: i soldi ci sono già, in un altro modo si pagherebbe due volte.
  const pagatoCon = satispay.circuito ?? 'satispay'
  if (satispay.giaPagato && modo !== pagatoCon) return pagatoCon === 'carta' ? GIA_PAGATO_CARTA : GIA_PAGATO_SATISPAY
  if (modo === 'bonifico' && !conRicevuta) return 'Manca la ricevuta del bonifico: una foto, lo screenshot o il PDF'
  // Con Satispay o la carta si paga prima, in fondo al modulo: la richiesta parte solo pagata (83-satispay-prima.sql).
  if (modo !== 'bonifico' && !satispay.pronto) return `Prima paga ${modo === 'carta' ? 'con la carta' : 'con Satispay'}, in fondo al modulo: la richiesta parte dopo`
  return null
}

/** «10.42»: l'ora a Roma, come si legge su un orologio. */
const oraARoma = (iso: string) => new Date(iso).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' }).replace(':', '.')

/** Per chi si paga e cosa: un corso con la formula, e chi paga (come lo ripulisce `satispay_prepara_prima`). */
export type SceltaPaga = {
  corso: string
  formula: 'annuale' | 'trimestre'
  nome: string
  cognome: string
  email: string
  /** La chiave del browser (`chiaveDelBrowser`). */
  chiave?: string
}

/** Il pagamento preparato in fondo al modulo, per la scelta e la persona di allora. */
export type PagamentoPrima = Omit<SceltaPaga, 'corso'> & {
  id: string
  corsoId: string
  stato: StatoSatispay
  importo: number
  link?: string
  pagatoIl?: string
  /** L'ordine della carta, per aprirne i campi: il link di Satispay non serve. */
  ordine?: string
  circuito?: 'carta'
}

/** Nome e cognome senza spazi ai lati né maiuscole, l'email in minuscolo: lo stesso per il database. */
const ripulita = (x: SceltaPaga) => [x.corso, x.formula, x.nome.trim().toLowerCase(), x.cognome.trim().toLowerCase(), x.email.trim().toLowerCase()].join('|')
const dellaScelta = (p: PagamentoPrima): SceltaPaga => ({ corso: p.corsoId, formula: p.formula, nome: p.nome, cognome: p.cognome, email: p.email })

/**
 * Quando preparare il pagamento: solo col modulo a posto (`manca` è quello
 * che bloccherebbe l'invio), così non si paga una richiesta che poi non
 * parte; e di nuovo se cambiano la scelta o chi paga. `''` vuol dire non
 * ancora: la chiave cambia, e si riprepara.
 */
export const chiavePreparo = (scelta: SceltaPaga | null, manca: string | null) => (scelta && !manca ? ripulita(scelta) : '')

/** L'id del pagamento da mandare con la richiesta: solo pagando con Satispay o la carta, arrivato e dello stesso circuito. */
export const pagamentoDaMandare = (modo: Pago | null, sp: { id: string; stato: StatoSatispay; circuito?: 'carta' } | null) =>
  modo && modo !== 'bonifico' && sp?.stato === 'pagato' && (sp.circuito ?? 'satispay') === modo ? sp.id : undefined

/** Il riquadro PAGA, tutto quello che si vede: il .tsx lo mostra soltanto. */
export interface RiquadroPaga {
  cosa: 'manca' | 'prepara' | 'paga' | 'pagato' | 'non-andato' | 'non-vale'
  /** La cifra: quella del pagamento se è per la scelta di adesso, se no la stima. */
  importo: number
  bordo: 'blu' | 'fatto' | 'avviso' | 'guaio'
  /** «Quota associativa e annuale Judo adulti.» */
  riga: string
  testo: string
  tonoTesto: 'testo' | 'fatto' | 'avviso' | 'guaio'
  /** Il tasto giallo in fondo: `null` se non c'è. */
  tasto: string | null
  /** `carta`: apre i campi della carta sotto il riquadro. */
  azione: 'link' | 'carta' | 'prepara' | 'manda' | 'chiama' | null
  link?: string
  spento: boolean
  /** La riga sotto il tasto. */
  sotto: string | null
}

/**
 * Il riquadro PAGA in fondo al modulo pubblico, quando si paga con Satispay
 * prima di mandare: cosa mostrare per la scelta di adesso e il pagamento
 * preparato. Il tasto PAGA è il link già pronto: lo si apre al tocco, senza
 * attese. Un pagamento in attesa per un'altra scelta o un'altra persona non
 * serve più e se ne prepara un altro; uno pagato per un'altra scelta o
 * persona non vale per la richiesta (`invia_iscrizione` lo rifiuta).
 */
export function statoRiquadroPaga(
  scelta: SceltaPaga,
  p: PagamentoPrima | null,
  altro: {
    /** la stima di adesso, in centesimi */ stima: number
    /** il nome del corso */ corso: string
    manca: string | null
    preparo: boolean
    guaio: string | null
    /** con cosa si paga: assente, Satispay */ metodo?: 'carta'
  },
): RiquadroPaga {
  const carta = altro.metodo === 'carta'
  // Un pagamento dell'altro circuito non è mai il suo: in attesa se ne prepara un altro, pagato non vale.
  const stessoCircuito = !!p && (p.circuito ?? 'satispay') === (altro.metodo ?? 'satispay')
  const sua = !!p && stessoCircuito && ripulita(dellaScelta(p)) === ripulita(scelta)
  const base = {
    importo: sua ? p.importo : altro.stima,
    riga: `Quota associativa e ${scelta.formula} ${altro.corso}.`,
    link: undefined as string | undefined,
    spento: false,
    sotto: null as string | null,
  }
  const riprova = carta
    ? { tasto: 'RIPROVA CON LA CARTA', azione: 'prepara' as const, spento: altro.preparo, sotto: 'Puoi usare un’altra carta, o tornare a «Paghi con» e scegliere Satispay o il bonifico.' }
    : { tasto: 'RIPROVA CON SATISPAY', azione: 'prepara' as const, spento: altro.preparo, sotto: 'Oppure torna a «Paghi con» e scegli il bonifico.' }
  if (p?.stato === 'pagato') {
    if (sua)
      return {
        ...base,
        cosa: 'pagato',
        bordo: 'fatto',
        testo: `✓ Pagati ${carta ? 'con la carta' : 'con Satispay'}${p.pagatoIl ? ` alle ${oraARoma(p.pagatoIl)}` : ''}. Ora manda la richiesta.`,
        tonoTesto: 'fatto',
        tasto: 'MANDA LA RICHIESTA',
        azione: 'manda',
      }
    return {
      ...base,
      cosa: 'non-vale',
      importo: p.importo,
      bordo: 'guaio',
      testo: !stessoCircuito
        ? p.circuito === 'carta'
          ? GIA_PAGATO_CARTA
          : GIA_PAGATO_SATISPAY
        : 'Hai pagato per un altro corso, un’altra formula o a un altro nome: rimetti quelli di prima per mandare la richiesta, o chiama la segreteria.',
      tonoTesto: 'guaio',
      tasto: 'CHIAMA LA SEGRETERIA',
      azione: 'chiama',
      link: chiama,
    }
  }
  const avvisa = {
    bordo: 'blu' as const,
    testo: carta ? 'Paghi adesso con la carta; la richiesta parte solo quando il pagamento è confermato.' : 'Paghi adesso con Satispay; la richiesta parte solo quando Satispay conferma.',
    tonoTesto: 'testo' as const,
  }
  if (altro.manca)
    return { ...base, ...avvisa, cosa: 'manca', tasto: null, azione: null, sotto: `Prima di pagare: ${altro.manca.charAt(0).toLowerCase()}${altro.manca.slice(1)}` }
  if (sua && p.stato === 'non-andato')
    return {
      ...base,
      ...riprova,
      cosa: 'non-andato',
      bordo: 'avviso',
      testo: carta
        ? '! La carta non è passata, o hai chiuso prima di confermare. Non ti è stato addebitato niente e la richiesta non è partita.'
        : '! Il pagamento non è andato: in Satispay è stato annullato o non è stato confermato. La richiesta non è partita.',
      tonoTesto: 'avviso',
    }
  if (sua && carta && p.ordine)
    return {
      ...base,
      ...avvisa,
      cosa: 'paga',
      tasto: `PAGA ${soldi(p.importo)} CON LA CARTA`,
      azione: 'carta',
      sotto: 'Non serve nessun conto. I dati della carta non arrivano alla palestra.',
    }
  if (sua && !carta && p.link)
    return {
      ...base,
      ...avvisa,
      cosa: 'paga',
      tasto: `PAGA ${soldi(p.importo)} CON SATISPAY`,
      azione: 'link',
      link: p.link,
      sotto: 'Se chiudi Satispay senza confermare, torna qui: è lo stesso pagamento, non paghi due volte.',
    }
  if (altro.guaio && !altro.preparo) return { ...base, ...riprova, cosa: 'prepara', bordo: 'blu', testo: altro.guaio, tonoTesto: 'guaio' }
  return { ...base, ...avvisa, cosa: 'prepara', tasto: 'PREPARO IL PAGAMENTO…', azione: null, spento: true }
}

/**
 * Il ritorno da Satispay dopo aver pagato in fondo al modulo
 * (`iscrizioni/?satispay=<pagamento>`): la richiesta non è ancora partita, e
 * si manda dal modulo, rimasto aperto nell'altra scheda. Nessun tasto porta a
 * un modulo nuovo: chi lo ricompilasse pagherebbe di nuovo.
 */
export function ritornoSatispay(p: { stato: StatoSatispay; importo: number; collegato?: boolean } | null): { titolo: string; tono: 'fatto' | 'avviso'; testi: string[] } {
  if (!p) return { titolo: 'PAGAMENTO NON TROVATO', tono: 'avviso', testi: ['Questo pagamento non si trova.', 'Torna alla scheda dove hai compilato il modulo.'] }
  if (p.stato === 'pagato' && p.collegato)
    return { titolo: 'RICHIESTA ARRIVATA · PAGATO', tono: 'fatto', testi: [`Hai pagato ${soldi(p.importo)} con Satispay, e la richiesta è arrivata in segreteria.`] }
  if (p.stato === 'pagato')
    return {
      titolo: 'PAGAMENTO RICEVUTO',
      tono: 'fatto',
      testi: [`Hai pagato ${soldi(p.importo)} con Satispay.`, 'Torna alla scheda dove hai compilato il modulo e premi MANDA LA RICHIESTA.'],
    }
  if (p.stato === 'non-andato')
    return { titolo: 'IL PAGAMENTO NON È ANDATO', tono: 'avviso', testi: ['Torna alla scheda dove hai compilato il modulo e riprova, o scegli il bonifico.'] }
  return {
    titolo: 'PAGAMENTO IN ATTESA',
    tono: 'avviso',
    testi: [`Satispay non ha ancora confermato i ${soldi(p.importo)}.`, 'Torna alla scheda dove hai compilato il modulo: si aggiorna da sola quando Satispay conferma.'],
  }
}
