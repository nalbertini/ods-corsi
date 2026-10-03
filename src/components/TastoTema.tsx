import { Luna, Sole } from './Icons'
import { useTema } from '../lib/tema'

/** Il tasto che passa dal tema nero al bianco e ritorno: un'icona che mostra dove porta. */
export function TastoTema() {
  const [tema, cambia] = useTema()
  const verso = tema === 'chiaro' ? 'scuro' : 'bianco'
  return (
    <button type="button" className="icon-btn" onClick={cambia} title={`Tema ${verso}`} aria-label={`Passa al tema ${verso}`}>
      {tema === 'chiaro' ? <Luna /> : <Sole />}
    </button>
  )
}
