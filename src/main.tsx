import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import AvvisoUscita from './components/AvvisoUscita'
import { ConfineErrore } from './components/SchermataErrore'
import './styles.css'
import { registraAggiornamenti, ricaricaSePezzoMancante } from './lib/aggiornamento'
import { vecchioIndirizzo } from './lib/aree'

// Un indirizzo col cancelletto di prima (`#sala`, `#segreteria`…) porta a
// quello vero, senza lasciare il vecchio nella cronologia.
const verso = vecchioIndirizzo()
if (verso) {
  window.location.replace(verso)
} else {
  ricaricaSePezzoMancante()
  window.addEventListener('load', registraAggiornamenti)

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      {/* L'ultima rete: quel che si blocca fuori da un'area (la porta, la password) non lascia lo schermo bianco. */}
      <ConfineErrore>
        <App />
      </ConfineErrore>
      <AvvisoUscita />
    </StrictMode>,
  )
}
