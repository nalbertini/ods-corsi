import { COLORE_BARRA, leggiTema } from './tema'

/** Il fondo del sito pubblico: la barra del browser lo segue mentre il modulo è aperto. */
export const COLORE_BARRA_MODULO = '#eef5fa'

/**
 * Il modulo di iscrizione ha l'aspetto del sito della palestra (blu e giallo,
 * sempre chiaro), qualunque sia il tema dell'app: chi si iscrive viene dal sito
 * e non ha scelto nessun tema. I colori e i caratteri stanno in `styles.css`
 * sotto `:root[data-modulo='sito']`; qui si accende e si spegne l'attributo.
 *
 * Ritorna la funzione che lo spegne e rimette la barra del tema scelto
 * nel frattempo (il tasto del tema, nel modulo, cambia la scelta ma non il modulo).
 * `applica()` di `tema.ts` non tocca la barra finché l'attributo c'è.
 */
export function apriAspettoModulo(doc: Document = document): () => void {
  const html = doc.documentElement
  html.dataset.modulo = 'sito'
  doc.querySelector('meta[name="theme-color"]')?.setAttribute('content', COLORE_BARRA_MODULO)
  return () => {
    delete html.dataset.modulo
    const tema = leggiTema(html.dataset.tema)
    if (tema) doc.querySelector('meta[name="theme-color"]')?.setAttribute('content', COLORE_BARRA[tema])
  }
}
