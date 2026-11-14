// «Come paga» nell'iscrizione online (decisione del 2026-11-14): chi si iscrive sceglie fra Satispay, carta,
// bonifico e contanti in segreteria; la ricevuta del bonifico è facoltativa; la segreteria vede la scelta e
// non la cambia. Qui i testi e i segni, provati da scripts/prova-come-paga.mjs.
import { soldi, type Pago } from './satispay'

/** Quel che resta scritto nella richiesta: Satispay e carta hanno già i loro pagamenti, il nucleo paga come prima. */
export type ComePaga = 'bonifico' | 'contanti'

/** Un modo fra quelli da scegliere nel modulo, col testo del design approvato. */
export type ModoOfferto = { id: Pago; testo: string; riga: string }

const MODI: ModoOfferto[] = [
  { id: 'satispay', testo: 'Satispay', riga: 'Paghi subito, dall’app: l’importo è già scritto' },
  { id: 'carta', testo: 'Carta di credito o di debito', riga: 'Paghi subito qui, senza app e senza aprire conti' },
  { id: 'bonifico', testo: 'Bonifico', riga: 'La ricevuta la carichi se ce l’hai, se no la porti dopo' },
  { id: 'contanti', testo: 'In contanti', riga: 'Paghi in segreteria, in palestra' },
]

/** I modi accesi, sempre nello stesso ordine: chi torna sul modulo li ritrova dove erano. */
export const modiDaOffrire = (acceso: Record<Pago, boolean>): ModoOfferto[] => MODI.filter((m) => acceso[m.id])

/**
 * Il modo del modulo a passi, che offre solo bonifico e contanti. `null` se tutti e due sono spenti in
 * IMPOSTAZIONI: non si chiede, e come pagare lo dice la segreteria. Con uno solo acceso è già scelto, anche
 * se prima era stato scelto l'altro: non resta in mano un modo che non c'è più. Con tutti e due resta la scelta.
 */
export function sceltaDelModulo(accesi: { bonifico: boolean; contanti: boolean }, scelta?: ComePaga): ComePaga | null | undefined {
  if (!accesi.bonifico && !accesi.contanti) return null
  if (!accesi.bonifico) return 'contanti'
  if (!accesi.contanti) return 'bonifico'
  return scelta
}

/** La frase del passo QUANTO PAGHI senza alcun modo acceso: la stessa del modulo pubblico. */
export const NESSUN_MODO = 'Come pagare te lo dice la segreteria.'

/** Nel riepilogo, la ricevuta del bonifico non caricata: è facoltativa, si porta dopo. */
export const RICEVUTA_DOPO = 'non caricata: la porti dopo in segreteria'

/** Gli errori di `invia_iscrizione` (162) e della modalità prova: gli stessi testi. */
export const COME_PAGA_SBAGLIATO = 'Scegli come paghi: col bonifico o in contanti in segreteria.'
export const CONTANTI_SPENTI = 'I contanti in segreteria ora non si possono scegliere: ricarica la pagina e scegli un altro modo.'
export const BONIFICO_SPENTO = 'Il bonifico ora non si può scegliere: ricarica la pagina e scegli un altro modo.'

/** Coi contanti, sotto la scelta: quanto, dove e quando. Senza listino la cifra la dice la segreteria. */
export const fraseContantiDelPasso = (cent: number | undefined): string =>
  `Porti ${cent === undefined ? 'la quota' : soldi(cent)} in segreteria, in palestra. Ti iscrivi lo stesso: puoi venire a lezione, e la quota la paghi entro la prima. La ricevuta te la dà la segreteria.`

/** Quel che la richiesta porta al database: solo bonifico e contanti, che la segreteria deve aspettare. */
export const comePagaDi = (modo: Pago | null): ComePaga | undefined => (modo === 'bonifico' || modo === 'contanti' ? modo : undefined)

/**
 * Le frasi in più sulla pagina RICHIESTA ARRIVATA. Coi contanti quanto, dove e quando, e che si viene già a
 * lezione (scelta dell'utente: «entro la prima lezione»). Col bonifico senza ricevuta che va portata, e che il
 * bonifico vale quando la segreteria lo vede sul conto: una ricevuta caricata non vale finché non la conferma.
 */
export function frasiPagamentoFinale(modo: Pago | null, cent: number | undefined, conRicevuta: boolean): string[] {
  // Senza listino la cifra non si sa: la dice la segreteria, come nel conto.
  if (modo === 'contanti') return [`Hai scelto di pagare in contanti: porti ${cent === undefined ? 'la quota' : soldi(cent)} in segreteria, in palestra, entro la prima lezione.`, 'Puoi già venire a lezione.']
  if (modo === 'bonifico' && !conRicevuta)
    return ['Se hai la ricevuta del bonifico portala in segreteria: il bonifico vale come pagato quando la segreteria lo vede sul conto.']
  return []
}

/**
 * Il segno nelle righe di RICHIESTE ONLINE. Le richieste senza scelta (Satispay, carta, nucleo, vecchie) non ne
 * hanno. `conRicevuta` undefined: le ricevute non sono ancora lette (o 162 manca), e il segno non dice che manca.
 */
export function segnoComePaga(comePaga: ComePaga | null | undefined, conRicevuta: boolean | undefined): string | null {
  if (comePaga === 'contanti') return 'Contanti'
  if (comePaga === 'bonifico') return conRicevuta === undefined ? 'Bonifico' : conRicevuta ? 'Bonifico · ricevuta' : 'Bonifico · senza ricevuta'
  return null
}

/** Il campo COME PAGA della richiesta aperta, con l'importo quando si conosce. */
export function campoComePaga(comePaga: ComePaga | null | undefined, cent?: number): string | null {
  const testo = comePaga === 'contanti' ? 'In contanti, in segreteria' : comePaga === 'bonifico' ? 'Col bonifico' : null
  return testo && cent !== undefined ? `${testo} · ${soldi(cent)}` : testo
}

/** «Nessuna ricevuta: il pagamento si fa in segreteria.» solo per le richieste senza scelta: con la scelta lo dice COME PAGA. */
export const dicaNessunaRicevuta = (comePaga: ComePaga | null | undefined, conFile: boolean, haRicevuta: boolean): boolean => !comePaga && conFile && !haRicevuta
