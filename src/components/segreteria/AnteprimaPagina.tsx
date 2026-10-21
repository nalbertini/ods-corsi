import { useEffect, useMemo, useState } from 'react'
import type { DatiSegreteria } from '../../lib/segreteria'
import { paginaInAnteprima } from '../../lib/sitoGenera'
import type { OrarioSito } from '../../lib/sitoOrari'

/**
 * La pagina com'è sul sito: la stessa che il generatore scrive (`paginaInAnteprima`), con le tessere e l'invito, in una cornice
 * senza codice. Carattere e logo sono file del sito e qui non ci sono: si vedono con il carattere di riserva.
 */
export default function AnteprimaPagina({ d, slug, titolo, descrizione, testo }: { d: DatiSegreteria; slug: string; titolo: string; descrizione: string; testo: string }) {
  // Gli orari servono solo alla pagina «orari»; se non si leggono (database senza 69-orari-sito.sql) l'anteprima dice «Orari in arrivo».
  const [orari, setOrari] = useState<OrarioSito[]>([])
  useEffect(() => {
    if (slug !== 'orari') return
    let vivo = true
    d.orariSito().then((o) => vivo && setOrari(o), () => undefined)
    return () => {
      vivo = false
    }
  }, [d, slug])
  const pagina = useMemo(() => paginaInAnteprima({ slug, titolo, descrizione, testo }, orari), [slug, titolo, descrizione, testo, orari])
  // `sandbox` vuoto: niente codice, niente moduli, niente uscite dalla cornice.
  return <iframe className="sito-anteprima-pagina" title="Com’è sul sito" sandbox="" srcDoc={pagina} />
}
