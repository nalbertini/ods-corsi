import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import AvvisoUscita from './components/AvvisoUscita'
import './styles.css'
import { registraAggiornamenti, ricaricaSePezzoMancante } from './lib/aggiornamento'
import { avviaTema } from './lib/tema'
import { areaAdesso, vecchioIndirizzo } from './lib/aree'
import { applicaLook } from './lib/aspettoSegreteria'

// Un indirizzo col cancelletto di prima (`#sala`, `#segreteria`…) porta a
// quello vero, senza lasciare il vecchio nella cronologia.
const verso = vecchioIndirizzo()
if (verso) {
  window.location.replace(verso)
} else {
  // L'aspetto dipende dall'area: va deciso prima di disegnare e a ogni cambio di indirizzo (`#aree`, `#guida`).
  applicaLook(areaAdesso())
  window.addEventListener('hashchange', () => applicaLook(areaAdesso()))
  avviaTema()

  ricaricaSePezzoMancante()
  window.addEventListener('load', registraAggiornamenti)

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
      <AvvisoUscita />
    </StrictMode>,
  )
}
