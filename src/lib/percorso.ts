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
