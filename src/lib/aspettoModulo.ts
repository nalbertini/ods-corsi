/** Il fondo del sito pubblico: la barra del browser lo segue (sta già in `index.html`). */
export const COLORE_BARRA_MODULO = '#eef5fa'

/**
 * Il modulo di iscrizione ha l'aspetto del sito della palestra: chi si iscrive
 * viene dal sito. I colori e i caratteri stanno in `styles.css` sotto
 * `:root[data-modulo='sito']`; qui si accende e si spegne l'attributo.
 *
 * Ritorna la funzione che lo spegne.
 */
export function apriAspettoModulo(doc: Document = document): () => void {
  const html = doc.documentElement
  html.dataset.modulo = 'sito'
  return () => {
    delete html.dataset.modulo
  }
}
