import { useState } from 'react'
import { Logo } from './components/Logo'
import { TastoTema } from './components/TastoTema'
import { Sala } from './components/Sala'
import { Porta } from './components/Porta'
import { IscrizioniScreen } from './components/IscrizioniScreen'
import { Tablet } from './components/tablet/Tablet'
import { Segreteria } from './components/segreteria/Segreteria'
import { eUnTablet } from './lib/tablet'
import { esci, serveAccesso, type Personale } from './lib/accesso'
import { inProvaScelta, scegliProva } from './lib/dati'

/**
 * ODS Corsi: il calendario delle sale e il registro delle presenze.
 *
 * È un'app a sé, separata dal timer di proposito: la presenza è una cosa che
 * riguarda la palestra, il timer una cosa che riguarda la lezione, e tenerle
 * nello stesso posto le legava più di quanto servisse.
 *
 * Con il database vero si entra dall'accesso (vedi `Porta`) e ognuno trova
 * solo il suo posto, senza schede: l'istruttore l'appello, chi ha il ruolo di
 * segreteria la sua area, a tutto schermo, per il computer della reception.
 * Chi vuole iscriversi non passa di qui: ha il suo link, qui sotto.
 *
 * In prova invece le schede ci sono tutte — appello, iscrizioni, segreteria —
 * perché la prova serve a far vedere l'app intera; la sala resta montata anche
 * quando si guarda altro, così tornando si ritrova l'appello dov'era.
 *
 * Lo stesso codice fa anche da tablet di sala (`#tablet`): un'altra faccia,
 * a pieno schermo, per il tablet appeso al muro.
 *
 * Con `#iscrizioni` in fondo all'indirizzo si apre invece la pagina pubblica,
 * quella del link da mandare a chi vuole iscriversi: solo i passi, i costi e
 * il modulo, senza le schede del personale. Viene prima del tablet, così un
 * tablet di sala che apre il link non smette di essere un tablet.
 */
const pubblica = window.location.hash === '#iscrizioni'
const tablet = !pubblica && eUnTablet()

export default function App() {
  if (pubblica) return <Iscrizioni />
  return tablet ? <Tablet /> : <AppCorsi />
}

function Iscrizioni() {
  return (
    <div className="app">
      <header className="testata">
        <Logo />
        <div className="stack grow" style={{ gap: 1 }}>
          <span className="testata-nome">OFFICINE DELLO SPORT</span>
          <span className="testata-luogo">ISCRIZIONI · COLLEGNO</span>
        </div>
        <TastoTema />
      </header>
      <main className="scroll">
        <IscrizioniScreen pubblica />
      </main>
    </div>
  )
}

function AppCorsi() {
  const [scheda, setScheda] = useState<'corsi' | 'iscrizioni' | 'segreteria'>('corsi')
  const [chi, setChi] = useState<Personale | null>(null)

  // Col database vero ognuno ha il suo posto e basta: chi è di segreteria sta
  // nella segreteria, l'istruttore nell'appello.
  if (serveAccesso && chi?.ruolo === 'staff') {
    return (
      <Segreteria
        nome={`${chi.nome} ${chi.cognome}`}
        prova={false}
        onEsci={() => void esci().then(() => setChi(null))}
      />
    )
  }

  if (!serveAccesso && scheda === 'segreteria') {
    return (
      <Segreteria
        nome="Segreteria di prova"
        prova
        onApp={() => setScheda('corsi')}
        onEsci={inProvaScelta ? () => scegliProva(false) : undefined}
      />
    )
  }

  return (
    <div className="app">
      <header className="testata">
        <Logo />
        <div className="stack grow" style={{ gap: 1 }}>
          <span className="testata-nome">OFFICINE DELLO SPORT</span>
          <span className="testata-luogo">CORSI · COLLEGNO</span>
        </div>
        <TastoTema />
        {!serveAccesso && (
          <nav className="schede">
            <button className="scheda" data-on={scheda === 'corsi'} onClick={() => setScheda('corsi')}>
              APPELLO
            </button>
            <button className="scheda" data-on={scheda === 'iscrizioni'} onClick={() => setScheda('iscrizioni')}>
              ISCRIZIONI
            </button>
            <button className="scheda" data-on={false} onClick={() => setScheda('segreteria')}>
              SEGRETERIA
            </button>
          </nav>
        )}
      </header>
      <main className="scroll">
        <div className="faccia-corsi" hidden={scheda !== 'corsi'}>
          <Porta onChi={setChi}>
            <Sala />
          </Porta>
        </div>
        {scheda === 'iscrizioni' && <IscrizioniScreen />}
      </main>
    </div>
  )
}
