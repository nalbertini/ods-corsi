// ---------------------------------------------------------------------------
// La ricevuta per email: le parole che vede la segreteria.
//
// Fatta la ricevuta, la famiglia la riceve in PDF all’email della
// persona della ricevuta (per un minore, quella del genitore). L'indirizzo lo
// sceglie il database (`76-ricevute-email.sql`), la mail la manda la Edge
// Function `ricevuta-email`; qui lo stato nello storico, le domande, gli
// avvisi, e gli errori grezzi tradotti in un motivo. Le prove:
// scripts/prova-ricevute-email.mjs e supabase/prova/ricevute-email.sql.
// ---------------------------------------------------------------------------
import { oggiARoma } from './contabilita'
import { mancanoDatiSocio, type Ricevuta } from './ricevute'

export { testoMail } from './ricevutaMail'

/** Le mail «mandate» in un giorno di Roma: Register ne lascia 500 per casella, il resto resta a inviti e reset. */
export const SOGLIA_MAIL_GIORNO = 400

export type EsitoInvio = 'mandata' | 'non partita'

/** Quante volte parte la stessa ricevuta in 24 ore, come `controlla_invio_ricevuta`: oltre, è un tasto premuto per sbaglio. */
export const TETTO_PER_RICEVUTA = 3

/**
 * Perché una mail non è partita. `troppe`: la stessa ricevuta è già partita
 * `TETTO_PER_RICEVUTA` volte in 24 ore. `manca-password`: il segreto
 * `SMTP_PASSWORD` della Edge Function non c'è.
 */
export type MotivoNonPartita = 'posta' | 'soglia' | 'troppe' | 'senza-indirizzo' | 'annullata' | 'manca-sql' | 'manca-funzione' | 'manca-password'

const MOTIVI: MotivoNonPartita[] = ['posta', 'soglia', 'troppe', 'senza-indirizzo', 'annullata', 'manca-sql', 'manca-funzione', 'manca-password']

/** `registrata: false`: la mail è partita, ma la riga in `invii_ricevute` non è rimasta e lo storico non la mostra. */
export type EsitoMandata = { esito: 'mandata'; indirizzo: string; registrata?: false } | { esito: 'non partita'; motivo: MotivoNonPartita }

/** Un tentativo, una riga di `invii_ricevute`. Chi ha solo l'amministrazione non ha l'indirizzo. */
export interface InvioRicevuta {
  ricevutaId: string
  creatoIl: string
  esito: EsitoInvio
  indirizzo?: string
  motivo?: string
}

export interface StatoPosta {
  testo: string
  /** Il `data-tono` di `.sg-sotto`; `null` è il grigio di sempre. */
  tono: 'fatto' | 'aspetta' | null
  tasto: 'Manda per email' | 'Manda di nuovo' | null
  spento: boolean
  /** Perché il tasto è spento. */
  motivo: string | null
}

const SENZA_CONTATTO = 'Nessuna email in scheda: aggiungila in PERSONA.'

/** «21/10/2026», il giorno di Roma di un istante. */
const giorno = (iso: string) => new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(iso))

const indirizzo = (x: string | null) => x?.trim() || null

/** Il genitore a cui va la mail di un minore (il giorno della ricevuta), per dire di chi è l'email; `null` per un adulto. */
export function genitoreDellaMail(r: Pick<Ricevuta, 'intestatario' | 'data'>): string | null {
  return mancanoDatiSocio(r.intestatario, new Date(r.data)).minore ? r.intestatario.genitore?.trim() || null : null
}

/** Dopo FAI LA RICEVUTA la mail parte solo con l’email in scheda e la casella rimasta spuntata. */
export const daMandare = (email: string | null, spuntata: boolean) => !!indirizzo(email) && spuntata

/** Il tasto MANDA PER EMAIL nell'avviso: solo quando la posta non ha risposto, l'unico guaio che riprovando passa. */
export const siRiprova = (esito: EsitoMandata | null) => esito?.esito === 'non partita' && esito.motivo === 'posta'

const daDove = (genitore: string | null) => (genitore?.trim() ? `Email del genitore, ${genitore.trim()}` : 'Email della scheda')

const numero = (r: Pick<Ricevuta, 'numero' | 'anno'>) => `${r.numero}/${r.anno}`

/** Le «mandata», dalla prima all'ultima. */
const mandate = (invii: InvioRicevuta[]) => invii.filter((i) => i.esito === 'mandata').sort((a, b) => a.creatoIl.localeCompare(b.creatoIl))

const mandataIl = (i: InvioRicevuta, volte = 1) => `Mandata il ${giorno(i.creatoIl)}${i.indirizzo ? ` a ${i.indirizzo}` : ''}${volte > 1 ? ` · ${volte} volte` : ''}`

/** La riga EMAIL di IL PAGAMENTO, per l'amministrazione: l'ultima partita, senza indirizzo. */
export function rigaEmail(invii: InvioRicevuta[]): string {
  const ultima = mandate(invii).at(-1)
  return ultima ? `Mandata il ${giorno(ultima.creatoIl)}` : 'Non mandata'
}

/** La data dell'ultimo invio partito, per la domanda di MANDA DI NUOVO; `null` se non è mai partita. */
export const ultimaMandata = (invii: InvioRicevuta[]) => mandate(invii).at(-1)?.creatoIl ?? null

/**
 * La riga della mail sotto una ricevuta dello storico, e il suo tasto.
 * `dal`: da quando le ricevute si mandano (`impostazioni.ricevute_email_dal`);
 * `null` vuol dire che il file SQL non c'è, e lo storico non dice niente.
 * L'indirizzo è quello a cui è partita, anche se in scheda ora è un altro;
 * un tentativo andato male dopo una mandata non la fa tornare non mandata.
 */
export function statoPosta(
  r: Pick<Ricevuta, 'creataIl' | 'annullataIl'>,
  invii: InvioRicevuta[],
  email: string | null,
  dal: string | null,
): StatoPosta | null {
  if (!dal) return null
  const partite = mandate(invii)
  const ultima = partite.at(-1)
  // Annullata è storia: dice com'era andata, e non si manda più.
  if (r.annullataIl) return { testo: ultima ? mandataIl(ultima, partite.length) : 'Non mandata', tono: null, tasto: null, spento: false, motivo: null }
  const senza = !indirizzo(email)
  const spento = { spento: senza, motivo: senza ? SENZA_CONTATTO : null }
  // L'ultima, e quante volte: dopo MANDA DI NUOVO la data del primo invio farebbe credere che non sia ripartita.
  if (ultima) return { testo: `✓ ${mandataIl(ultima, partite.length)}`, tono: 'fatto', tasto: 'Manda di nuovo', ...spento }
  const testo = invii.length
    ? '… Non mandata: la mail non è partita'
    : senza
      ? 'Non mandata: nessuna email in scheda'
      : r.creataIl < dal
        ? 'Fatta prima dell’invio per email'
        : 'Non mandata'
  return { testo, tono: invii.length ? 'aspetta' : null, tasto: 'Manda per email', ...spento }
}

/** La casella nella domanda di FAI LA RICEVUTA, e la frase sotto; senza email, niente casella. */
export function confermaEmail(email: string | null, genitore: string | null, spuntata: boolean): { spunta: string | null; nota: string } {
  const a = indirizzo(email)
  if (!a) return { spunta: null, nota: 'Nessuna email in scheda: la ricevuta non si manda. Il PDF si scarica come sempre.' }
  return {
    spunta: `Manda per email a ${a}`,
    nota: spuntata
      ? `${daDove(genitore)}. Se è sbagliata togli la spunta: la ricevuta si fa senza mail.`
      : 'Senza spunta la ricevuta si fa senza mail: si può mandare dopo con MANDA PER EMAIL, dallo storico.',
  }
}

/** La domanda di MANDA PER EMAIL e di MANDA DI NUOVO (`giaMandata`: quando è partita l'ultima volta). */
export function domandaManda(r: Pick<Ricevuta, 'numero' | 'anno'>, indirizzo: string, genitore: string | null, giaMandata: string | null): { domanda: string; resto: string; si: string } {
  return giaMandata
    ? {
        domanda: `Mandare di nuovo la ricevuta n. ${numero(r)} a ${indirizzo}?`,
        resto: `${daDove(genitore)}. È già partita il ${giorno(giaMandata)}: la famiglia la riceve un’altra volta, uguale.`,
        si: 'Manda di nuovo',
      }
    : { domanda: `Mandare la ricevuta n. ${numero(r)} a ${indirizzo}?`, resto: `${daDove(genitore)}. Il PDF va allegato alla mail; la ricevuta non cambia.`, si: 'Manda' }
}

/** Cosa dire quando la mail non parte, uguale dopo FAI LA RICEVUTA e dopo MANDA PER EMAIL. */
const PERCHE: Record<Exclude<MotivoNonPartita, 'posta' | 'soglia'>, string> = {
  troppe: `Questa ricevuta è già partita ${TETTO_PER_RICEVUTA} volte nelle ultime 24 ore: riprova domani.`,
  'senza-indirizzo': SENZA_CONTATTO,
  annullata: 'La ricevuta è annullata: non si manda.',
  'manca-sql': 'La mail non parte: va lanciato 76-ricevute-email.sql.',
  'manca-funzione': 'La mail non parte: va pubblicata la funzione ricevuta-email.',
  'manca-password': 'La mail non parte: manca la password della posta, vedi supabase/LEGGIMI.md.',
}

const NON_SEGNATA = 'Lo storico non segna la mail: non mandarla di nuovo.'
const SENZA_PDF = 'Il PDF non si è scaricato: riscaricalo con PDF dallo storico.'

/**
 * L'avviso dopo FAI LA RICEVUTA: la ricevuta c'è sempre, la mail è un di più. `null`: non si è provato a mandarla.
 * `scaricato`: il PDF è sceso; mail e PDF vanno ognuno per conto suo.
 */
export function avvisoDopoRicevuta(r: Pick<Ricevuta, 'numero' | 'anno'>, esito: EsitoMandata | null, scaricato = true): string {
  const n = numero(r)
  if (!scaricato) {
    if (!esito) return `Ricevuta n. ${n} fatta, non mandata per email. ${SENZA_PDF}`
    if (esito.esito === 'mandata') return `Ricevuta n. ${n} fatta e mandata a ${esito.indirizzo}. ${SENZA_PDF}${esito.registrata === false ? ` ${NON_SEGNATA}` : ''}`
    return `Ricevuta n. ${n} fatta. ${SENZA_PDF} ${perche(esito.motivo)}`
  }
  if (!esito) return `Ricevuta n. ${n} fatta: il PDF è scaricato. Non mandata per email.`
  if (esito.esito === 'mandata') return `Ricevuta n. ${n} fatta e mandata a ${esito.indirizzo}. Il PDF è scaricato.${esito.registrata === false ? ` ${NON_SEGNATA}` : ''}`
  return `Ricevuta n. ${n} fatta, il PDF è scaricato. ${perche(esito.motivo)}`
}

const perche = (motivo: MotivoNonPartita) =>
  motivo === 'posta'
    ? 'La mail non è partita: riprova con MANDA PER EMAIL.'
    : motivo === 'soglia'
      ? `Oggi sono partite ${SOGLIA_MAIL_GIORNO} mail, il massimo: riprova domani con MANDA PER EMAIL.`
      : PERCHE[motivo]

/** L'avviso dopo FAI LA RICEVUTA resta finché non si chiude solo se manca qualcosa da fare a mano: il PDF, o non rimandare la mail. */
export const restaDopoRicevuta = (esito: EsitoMandata | null, scaricato: boolean) => !scaricato || (esito?.esito === 'mandata' && esito.registrata === false)

/** Dopo MANDA la mail era tutto: resta se non è partita, o se è partita senza restare nello storico. */
export const restaDopoManda = (esito: EsitoMandata) => esito.esito !== 'mandata' || esito.registrata === false

/** L'avviso dopo MANDA PER EMAIL o MANDA DI NUOVO. */
export function avvisoManda(r: Pick<Ricevuta, 'numero' | 'anno'>, esito: EsitoMandata): string {
  if (esito.esito === 'mandata') return `Ricevuta n. ${numero(r)} mandata a ${esito.indirizzo}${esito.registrata === false ? '. Lo storico non la segna: non mandarla di nuovo.' : ''}`
  if (esito.motivo === 'posta') return 'La mail non è partita: controlla la connessione e riprova.'
  if (esito.motivo === 'soglia') return `Oggi sono partite ${SOGLIA_MAIL_GIORNO} mail, il massimo: riprova domani.`
  return PERCHE[esito.motivo]
}

const eMotivo = (x: unknown): x is MotivoNonPartita => MOTIVI.some((m) => m === x)

/**
 * Un errore qualsiasi, dalla Edge Function, da PostgREST o dalla rete, diventa
 * un motivo: la segreteria legge una frase che dice cosa fare, mai il testo
 * dell'API. Il `tipo` del corpo della Edge Function vince; quello che non si
 * riconosce è la posta che non risponde.
 */
export function motivoDaErrore(e: unknown): MotivoNonPartita {
  if (!e || typeof e !== 'object') return 'posta'
  if ('tipo' in e && eMotivo(e.tipo)) return e.tipo
  // Funzione o tabella che non ci sono: il file SQL non è stato lanciato.
  if ('code' in e && typeof e.code === 'string' && ['PGRST202', 'PGRST205', '42P01', '42883'].includes(e.code)) return 'manca-sql'
  const stato = 'context' in e && e.context && typeof e.context === 'object' && 'status' in e.context ? e.context.status : undefined
  if ('name' in e && e.name === 'FunctionsHttpError' && stato === 404) return 'manca-funzione'
  return 'posta'
}

/** Le mail «mandate» oggi, giorno di Roma: la stessa soglia di `controlla_invio_ricevuta`. */
export function mandateOggi(invii: InvioRicevuta[], ora: Date): number {
  const oggi = oggiARoma(ora)
  return invii.filter((i) => i.esito === 'mandata' && oggiARoma(new Date(i.creatoIl)) === oggi).length
}
