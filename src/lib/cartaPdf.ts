import type { Color, PDFFont, PDFPage } from 'pdf-lib'

/**
 * La carta intestata (public/moduli/carta-intestata.pdf, fatta da `fogliModuli.ts`) sotto i PDF dell'app:
 * lettera d'incarico, ricevute, ricevute dei compensi, bilancio, chiusura di cassa e report istruttori.
 * Ogni PDF la disegna sotto le sue pagine; qui lo scaricarla, cosa fare se non arriva, e le misure in comune.
 */

/** Il nome della società sui documenti che non lo prendono da IMPOSTAZIONI (la lettera, il report). */
export const SOCIETA = 'ASD IL CENTRO JUDO'

/** Su un A4 verticale sulla carta, in punti dall'alto: il testo comincia sotto la testata e finisce sopra il piede (e la riga «pagina n di N»). */
export const SU_CARTA = { inizio: 112, sotto: 92 }

export const NON_ARRIVA = 'La carta intestata non si scarica: controlla la connessione e riprova.'

type Scarica = () => Promise<Pick<Response, 'ok' | 'arrayBuffer'>>
const dalSito: Scarica = () => fetch('moduli/carta-intestata.pdf')

/**
 * La carta. Anche una risposta che non è un PDF (la pagina di un wifi, un proxy) è «non arrivata», e così
 * una arrivata a metà (senza `%%EOF` in fondo): pdf-lib la rifiuterebbe con un errore che nessuno capisce.
 */
export async function cartaIntestata(scarica: Scarica = dalSito): Promise<Uint8Array> {
  const byte = await scarica()
    .then(async (r) => (r.ok ? new Uint8Array(await r.arrayBuffer()) : null))
    .catch(() => null)
  const testo = (a: number, b?: number) => (byte ? new TextDecoder('latin1').decode(byte.subarray(a, b)) : '')
  if (!byte || testo(0, 5) !== '%PDF-' || !testo(Math.max(0, byte.length - 1024)).includes('%%EOF')) throw new Error(NON_ARRIVA)
  return byte
}

/**
 * Stampa sulla carta; se non arriva, chiede a chi stampa: `senzaCarta` mostra il perché e, se gli si dice sì,
 * chiama `stampaSenza`. Al banco una ricevuta non si blocca per la grafica, ma non esce senza che lo si sappia.
 */
export async function stampaSuCarta(
  stampa: (carta?: Uint8Array) => Promise<void>,
  senzaCarta: (messaggio: string, stampaSenza: () => Promise<void>) => unknown,
  scarica: Scarica = dalSito,
): Promise<void> {
  const carta = await cartaIntestata(scarica).catch(() => undefined)
  if (carta) return stampa(carta)
  await senzaCarta(NON_ARRIVA, () => stampa())
}

/** La carta, o niente: dove non c'è nessuno a cui chiedere (il genitore che scarica la ricevuta, la ricevuta per email). */
export const cartaSePuoi = (scarica: Scarica = dalSito) => cartaIntestata(scarica).catch(() => undefined)

/** Un tasto sull'avviso: cosa dice e cosa fa (`AzioneAvviso` della segreteria). */
export interface Azione {
  etichetta: string
  fa: () => unknown
}

/** Un guaio con un tasto per rimediare: il `fai` della segreteria lo mostra nell'avviso col suo tasto. */
export class GuaioConAzione extends Error {
  constructor(
    messaggio: string,
    readonly azione: Azione,
  ) {
    super(messaggio)
  }
}

/** Il `fai` della segreteria: fa l'operazione e, se va, dice `riuscito`. */
type Fai = (op: () => Promise<unknown>, riuscito?: string) => Promise<boolean>

/** Il tasto dell'avviso quando la carta non arriva: fa uscire il PDF senza, e l'esito prende il posto dell'avviso rosso. */
export const stampaSenzaCarta = (fai: Fai, senza: () => Promise<unknown>): Azione => ({
  etichetta: 'Senza carta',
  fa: () => void fai(senza, 'PDF scaricato senza carta intestata'),
})

/**
 * Stampa un PDF sulla carta intestata (`stampaSuCarta`). Se la carta non arriva, il PDF non esce da solo:
 * un guaio dice perché, e il tasto SENZA CARTA lo fa uscire lo stesso. Riprovare è ripremere il tasto di prima,
 * che quindi dice com'è andata («PDF scaricato»): se no l'avviso rosso di prima resterebbe lì col suo tasto.
 */
export const suCarta = (fai: Fai, stampa: (carta?: Uint8Array) => Promise<void>, scarica: Scarica = dalSito) =>
  stampaSuCarta(
    stampa,
    (perche, senza) => {
      throw new GuaioConAzione(perche, stampaSenzaCarta(fai, senza))
    },
    scarica,
  )

/** «pagina n di N» in basso a destra, sopra il piede della carta; dalla seconda pagina con `chi` davanti. Niente se la pagina è una. */
export function numeraPagine(pagine: PDFPage[], font: PDFFont, chi: string, colore: Color) {
  if (pagine.length < 2) return
  pagine.forEach((p, i) => {
    const dove = `pagina ${i + 1} di ${pagine.length}`
    const testo = i === 0 || !chi ? dove : `${chi} · ${dove}`
    p.drawText(testo, { x: p.getWidth() - 56 - font.widthOfTextAtSize(testo, 7.5), y: 76, size: 7.5, font, color: colore })
  })
}
