// La pagina IMPOSTAZIONI divisa in schede, una per gruppo: quali sono, in che
// ordine, e come si muove la tastiera. Il .tsx mostra e chiama.
import { tastoLinguette } from './schedaSezioni'

export type IdImpostazioni = 'stagione' | 'sale' | 'esercizi' | 'ricevute' | 'pagamenti' | 'avvisi' | 'dati' | 'importa' | 'computer'

// QUESTO COMPUTER in fondo: vale solo per il computer davanti, non per la palestra.
export const SCHEDE_IMPOSTAZIONI: ReadonlyArray<{ id: IdImpostazioni; nome: string }> = [
  { id: 'stagione', nome: 'LA STAGIONE' },
  { id: 'sale', nome: 'LE SALE E I TABLET' },
  { id: 'esercizi', nome: 'GLI ESERCIZI' },
  { id: 'ricevute', nome: 'LE RICEVUTE' },
  { id: 'pagamenti', nome: 'COME SI PAGA' },
  { id: 'avvisi', nome: 'GLI AVVISI' },
  { id: 'dati', nome: 'DATI E PRIVACY' },
  { id: 'importa', nome: 'IMPORTA' },
  { id: 'computer', nome: 'QUESTO COMPUTER' },
]

export const SCHEDA_IMPOSTAZIONI_INIZIALE: IdImpostazioni = 'stagione'

/** Gli id di linguetta e pannello, diversi da quelli della scheda iscritto. */
export const idLinguettaImp = (id: IdImpostazioni) => `imp-sch-${id}`
export const idPannelloImp = (id: IdImpostazioni) => `imp-pan-${id}`

/** Con Alt, Ctrl o Cmd il tasto è del browser (Alt+← torna indietro): le schede non lo prendono. */
export const tastoImpostazioni = (
  aperta: IdImpostazioni,
  e: { key: string; altKey?: boolean; ctrlKey?: boolean; metaKey?: boolean },
): IdImpostazioni | null =>
  e.altKey || e.ctrlKey || e.metaKey ? null : tastoLinguette(SCHEDE_IMPOSTAZIONI.map((s) => s.id), aperta, e.key)
