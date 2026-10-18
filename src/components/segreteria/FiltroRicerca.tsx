import type { Ricercata } from '../../lib/ricerca'

/** Sopra l'elenco di una voce aperta da «ALTRI N» della ricerca: cosa si era cercato, e il modo di vedere tutto. */
export function FiltroRicerca({ ricerca, onTogli }: { ricerca: Ricercata; onTogli: () => void }) {
  return (
    <div className="sg-filtro-ricerca" role="status">
      <span>
        Cercato «{ricerca.testo}»: {ricerca.ids.length} {ricerca.ids.length === 1 ? 'trovato' : 'trovati'}.
      </span>
      <button type="button" className="sg-chip" onClick={onTogli}>
        Mostra tutti
      </button>
    </div>
  )
}
