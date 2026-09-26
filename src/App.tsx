import { useCallback, useEffect, useState } from 'react'
import { Logo } from './components/Logo'
import { Sala } from './components/Sala'
import { IscrizioniScreen } from './components/IscrizioniScreen'
import { Tablet } from './components/tablet/Tablet'
import { Accesso } from './components/Accesso'
import { Segreteria } from './components/segreteria/Segreteria'
import { eUnTablet } from './lib/tablet'
import { accesso, type Accesso as Servizio, type Chi } from './lib/accesso'

/**
 * ODS Corsi: il calendario delle sale e il registro delle presenze.
 *
 * È un'app a sé, separata dal timer di proposito: la presenza è una cosa che
 * riguarda la palestra, il timer una cosa che riguarda la lezione, e tenerle
 * nello stesso posto le legava più di quanto servisse.
 *
 * Accanto ai corsi ci sono i passi per iscriversi. La sala resta montata anche
 * quando si guardano le iscrizioni, così tornando si ritrova l'appello dov'era.
 *
 * Lo stesso codice fa anche da tablet di sala (`#tablet`): un'altra faccia,
 * a pieno schermo, per il tablet appeso al muro. E chi ha il ruolo di
 * segreteria ha la sua area, a tutto schermo, per il computer della reception.
 */
const tablet = eUnTablet()

export default function App() {
  return tablet ? <Tablet /> : <ConAccesso />
}

/** Col database si entra; in prova si è la segreteria di prova. */
function ConAccesso() {
  const [servizio, setServizio] = useState<Servizio | null>(null)
  const [chi, setChi] = useState<Chi | null>(null)

  const leggi = useCallback(async (s: Servizio) => {
    try {
      setChi(await s.chi())
    } catch {
      setChi({ stato: 'fuori' })
    }
  }, [])

  useEffect(() => {
    let smetti = () => {}
    void accesso().then((s) => {
      setServizio(s)
      void leggi(s)
      smetti = s.guarda(() => void leggi(s))
    })
    return () => smetti()
  }, [leggi])

  if (!servizio || !chi) return <p className="pad" style={{ color: 'var(--dim)', paddingTop: 20 }}>Un attimo…</p>
  if (chi.stato !== 'dentro' || chi.ruolo === 'iscritto') {
    const come: Chi = chi.stato === 'dentro' ? { stato: 'sconosciuto', email: '' } : chi
    return <Accesso servizio={servizio} chi={come} onDentro={() => void leggi(servizio)} />
  }
  const esci = chi.prova ? undefined : () => void servizio.esci().then(() => leggi(servizio))
  return <AppCorsi chi={chi} onEsci={esci} />
}

function AppCorsi({ chi, onEsci }: { chi: Extract<Chi, { stato: 'dentro' }>; onEsci?: () => void }) {
  const [scheda, setScheda] = useState<'corsi' | 'iscrizioni' | 'segreteria'>('corsi')
  const staff = chi.ruolo === 'staff'

  if (scheda === 'segreteria' && staff) {
    return <Segreteria nome={chi.nome} prova={chi.prova} onApp={() => setScheda('corsi')} onEsci={onEsci} />
  }

  return (
    <div className="app">
      <header className="testata">
        <Logo />
        <div className="stack grow" style={{ gap: 1 }}>
          <span className="testata-nome">OFFICINE DELLO SPORT</span>
          <span className="testata-luogo">CORSI · COLLEGNO</span>
        </div>
        {onEsci && (
          <button type="button" className="icon-btn testo" onClick={onEsci} aria-label={`Esci (${chi.nome})`}>
            ESCI
          </button>
        )}
      </header>
      <nav className="schede">
        <button className="scheda" data-on={scheda === 'corsi'} onClick={() => setScheda('corsi')}>
          CORSI
        </button>
        <button className="scheda" data-on={scheda === 'iscrizioni'} onClick={() => setScheda('iscrizioni')}>
          ISCRIZIONI
        </button>
        {staff && (
          <button className="scheda" data-on={false} onClick={() => setScheda('segreteria')}>
            SEGRETERIA
          </button>
        )}
      </nav>
      <main className="scroll">
        <div hidden={scheda !== 'corsi'}>
          <Sala />
        </div>
        {scheda === 'iscrizioni' && <IscrizioniScreen />}
      </main>
    </div>
  )
}
