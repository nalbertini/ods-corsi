import { Luna, Sole, Tatami } from './Icons'
import { prossimoTema, useTema, type Tema } from '../lib/tema'

const NOME: Record<Tema, string> = { scuro: 'scuro', chiaro: 'bianco', tatami: 'Tatami' }

/** Il tasto che passa da un tema al successivo (nero, bianco, Tatami e di nuovo nero): un'icona che mostra dove porta. */
export function TastoTema() {
  const [tema, cambia] = useTema()
  const verso = prossimoTema(tema)
  return (
    <button type="button" className="icon-btn" onClick={cambia} title={`Tema ${NOME[verso]}`} aria-label={`Passa al tema ${NOME[verso]}`}>
      {verso === 'scuro' ? <Luna /> : verso === 'chiaro' ? <Sole /> : <Tatami />}
    </button>
  )
}
