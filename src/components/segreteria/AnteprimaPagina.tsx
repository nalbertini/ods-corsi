import { useMemo } from 'react'
import { fileDi, generaSito } from '../../lib/sitoGenera'

/**
 * La pagina com'è sul sito: la stessa che il generatore scrive (`generaSito`), con le tessere, in una cornice
 * senza codice. Carattere e logo sono file del sito e qui non ci sono: si vedono con il carattere di riserva.
 */
export default function AnteprimaPagina({ slug, titolo, descrizione, testo }: { slug: string; titolo: string; descrizione: string; testo: string }) {
  const pagina = useMemo(() => {
    const file = generaSito({ dominio: 'https://www.officinedellosport.it', pagine: [{ slug, titolo, descrizione, testo }], menu: [], rinvii: [] })
    return file[fileDi(slug)] ?? ''
  }, [slug, titolo, descrizione, testo])
  // `sandbox` vuoto: niente codice, niente moduli, niente uscite dalla cornice.
  return <iframe className="sito-anteprima-pagina" title="Com’è sul sito" sandbox="" srcDoc={pagina} />
}
