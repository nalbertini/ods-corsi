// ---------------------------------------------------------------------------
// I passi dell'iscrizione contati su GoatCounter, lo stesso contatore del sito
// (senza cookie). Due eventi: il modulo che si apre e la richiesta che arriva;
// la differenza dice quante persone si fermano nel modulo. Mai un dato della
// persona: solo il nome dell'evento.
// ---------------------------------------------------------------------------

export const EVENTI_ISCRIZIONE = { aperto: 'iscrizione-modulo', fatta: 'iscrizione-fatta' } as const
export type EventoIscrizione = (typeof EVENTI_ISCRIZIONE)[keyof typeof EVENTI_ISCRIZIONE]

// Stessa forma di `codiceStatistiche` (sitoGenera.ts): non si importa da lì per non portare il generatore del sito nell'app.
const codiceBuono = (c: string | undefined): c is string => c !== undefined && /^[a-z0-9-]{2,50}$/.test(c)

interface Contatore {
  count?: (v: { path: string; title: string; event: boolean }) => void
}
interface FinestraConContatore {
  goatcounter?: Contatore
}
interface DocumentoPerLoScript {
  createElement: (tag: 'script') => { dataset: Record<string, string | undefined>; src: string; async: boolean; onload: (() => void) | null; onerror: (() => void) | null }
  head: { append: (s: never) => void }
}

let caricato: Promise<void> | null = null

/** Lo script ufficiale, una volta sola e senza il conto della pagina: le visite dell'app non devono finire in IL SITO. */
function carica(codice: string, documento: DocumentoPerLoScript): Promise<void> {
  caricato ??= new Promise((fine) => {
    const s = documento.createElement('script')
    s.async = true
    s.dataset.goatcounter = `https://${codice}.goatcounter.com/count`
    s.dataset.goatcounterSettings = '{"no_onload":true}'
    s.src = 'https://gc.zgo.at/count.js'
    // Bloccato o senza rete: si va avanti lo stesso, il modulo non dipende dal contatore.
    s.onload = () => fine()
    s.onerror = () => fine()
    // `never`: il documento vero e quello finto della prova hanno `head` diversi, e qui basta che lo accettino.
    documento.head.append(s as never)
  })
  return caricato
}

/** Conta un evento. Senza codice buono non fa niente; non lancia mai, qualunque cosa dica il contatore. */
export async function contaIscrizione(
  evento: EventoIscrizione,
  codice: string | undefined = import.meta.env.VITE_SITO_STATISTICHE,
  finestra: FinestraConContatore = window as FinestraConContatore, // `as`: `goatcounter` lo aggiunge lo script esterno
  documento: DocumentoPerLoScript = document as unknown as DocumentoPerLoScript, // `as`: ne servono solo createElement e head.append
): Promise<void> {
  if (!codiceBuono(codice)) return
  try {
    await carica(codice, documento)
    finestra.goatcounter?.count?.({ path: evento, title: evento, event: true })
  } catch {
    // Un contatore che non va non deve fermare chi si iscrive.
  }
}
