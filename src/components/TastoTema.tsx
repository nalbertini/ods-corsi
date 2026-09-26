import { Luna, Sole } from './Icons'
import { useTema } from '../lib/tema'

/**
 * Il tasto che passa dal tema nero al bianco e ritorno: mostra dove porta.
 * Nella testata è un'icona; nel riquadro della segreteria, un link come gli altri.
 */
export function TastoTema({ link = false }: { link?: boolean }) {
  const [tema, cambia] = useTema()
  const verso = tema === 'chiaro' ? 'scuro' : 'bianco'
  if (link) {
    return (
      <button type="button" className="sg-link" onClick={cambia}>
        Tema {verso}
      </button>
    )
  }
  return (
    <button type="button" className="icon-btn" onClick={cambia} title={`Tema ${verso}`} aria-label={`Passa al tema ${verso}`}>
      {tema === 'chiaro' ? <Luna /> : <Sole />}
    </button>
  )
}
