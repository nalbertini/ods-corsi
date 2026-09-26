import { useState } from 'react'
import { Logo } from './components/Logo'
import { Sala } from './components/Sala'
import { Porta } from './components/Porta'
import { IscrizioniScreen } from './components/IscrizioniScreen'
import { Tablet } from './components/tablet/Tablet'
import { eUnTablet } from './lib/tablet'

/**
 * ODS Corsi: il calendario delle sale e il registro delle presenze.
 *
 * È un'app a sé, separata dal timer di proposito: la presenza è una cosa che
 * riguarda la palestra, il timer una cosa che riguarda la lezione, e tenerle
 * nello stesso posto le legava più di quanto servisse.
 *
 * Accanto ai corsi ci sono i passi per iscriversi, aperti a tutti; i corsi,
 * con il database vero, solo dopo l'accesso (vedi `Porta`). La sala resta montata anche
 * quando si guardano le iscrizioni, così tornando si ritrova l'appello dov'era.
 *
 * Lo stesso codice fa anche da tablet di sala (`#tablet`): un'altra faccia,
 * a pieno schermo, per il tablet appeso al muro.
 */
const tablet = eUnTablet()

export default function App() {
  return tablet ? <Tablet /> : <AppCorsi />
}

function AppCorsi() {
  const [scheda, setScheda] = useState<'corsi' | 'iscrizioni'>('corsi')

  return (
    <div className="app">
      <header className="testata">
        <Logo />
        <div className="stack grow" style={{ gap: 1 }}>
          <span className="testata-nome">OFFICINE DELLO SPORT</span>
          <span className="testata-luogo">CORSI · COLLEGNO</span>
        </div>
      </header>
      <nav className="schede">
        <button className="scheda" data-on={scheda === 'corsi'} onClick={() => setScheda('corsi')}>
          CORSI
        </button>
        <button className="scheda" data-on={scheda === 'iscrizioni'} onClick={() => setScheda('iscrizioni')}>
          ISCRIZIONI
        </button>
      </nav>
      <main className="scroll">
        <div hidden={scheda !== 'corsi'}>
          <Porta>
            <Sala />
          </Porta>
        </div>
        {scheda === 'iscrizioni' && <IscrizioniScreen />}
      </main>
    </div>
  )
}
