import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { TimerBloccato } from './components/TimerBloccato'
import './styles.css'
import { registraAggiornamenti } from './lib/aggiornamento'

window.addEventListener('load', registraAggiornamenti)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* Senza confine un errore mentre si disegna lascia lo schermo bianco a metà lezione. */}
    <TimerBloccato>
      <App />
    </TimerBloccato>
  </StrictMode>,
)
