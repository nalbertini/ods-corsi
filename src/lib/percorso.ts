import type { Sessione } from './sessioni'

/**
 * L'area scritta nel percorso dell'indirizzo (`…/segreteria/`), o `null`.
 *
 * Sta qui da sola perché la chiedono sia `aree.ts` sia `tablet.ts`, che
 * l'uno dell'altro non devono sapere niente. Vale anche senza la barra finale
 * e con `index.html` in fondo: sono la stessa pagina.
 */
export function areaDelPercorso(): 'segreteria' | 'iscrizioni' | 'istruttori' | 'sala' | null {
  const m = /\/(segreteria|iscrizioni|istruttori|sala)(\/(index\.html)?)?$/.exec(window.location.pathname)
  return m ? (m[1] as 'segreteria' | 'iscrizioni' | 'istruttori' | 'sala') : null
}

/**
 * La sessione del personale per questa pagina: in `segreteria/` quella della
 * segreteria, altrove quella degli istruttori. Fra un'area e l'altra si cambia
 * pagina, quindi per una pagina è sempre la stessa: il calendario e l'appello
 * aperti dalla segreteria parlano col database a nome della segreteria, e
 * quelli di `istruttori/` a nome di chi è entrato lì.
 */
export const sessioneDellaPagina = (): Exclude<Sessione, 'sala'> => (areaDelPercorso() === 'segreteria' ? 'segreteria' : 'personale')
