import { Logo } from './components/Logo'
import { Sala } from './components/Sala'
import { Tablet } from './components/tablet/Tablet'
import { eUnTablet } from './lib/tablet'

/**
 * ODS Corsi: il calendario delle sale e il registro delle presenze.
 *
 * È un'app a sé, separata dal timer di proposito: la presenza è una cosa che
 * riguarda la palestra, il timer una cosa che riguarda la lezione, e tenerle
 * nello stesso posto le legava più di quanto servisse.
 *
 * Lo stesso codice fa anche da tablet di sala (`#tablet`): un'altra faccia,
 * a pieno schermo, per il tablet appeso al muro.
 */
const tablet = eUnTablet()

export default function App() {
  if (tablet) return <Tablet />
  return (
    <div className="app">
      <header className="testata">
        <Logo />
        <div className="stack grow" style={{ gap: 1 }}>
          <span className="testata-nome">OFFICINE DELLO SPORT</span>
          <span className="testata-luogo">CORSI · COLLEGNO</span>
        </div>
      </header>
      <main className="scroll">
        <Sala />
      </main>
    </div>
  )
}
