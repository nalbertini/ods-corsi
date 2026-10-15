import { useEffect, useState } from 'react'
import { Conferma } from './segreteria/comune'
import { avvisoUscita, guardaUscita, type Pendenza } from '../lib/uscita'

/**
 * Il «ESCI» che trova scritture non ancora arrivate (presenze, chiusure,
 * prove senza rete) non esce da solo: chiede, perché uscendo si perdono. Sta
 * una volta sola, sopra tutta l'app, così vale anche per telefono, segreteria e tablet.
 */
export default function AvvisoUscita() {
  const [p, setP] = useState<Pendenza | null>(null)
  useEffect(() => guardaUscita(setP), [])
  if (!p) return null
  const fine = (si: boolean) => {
    setP(null)
    if (si) void p.esciComunque()
  }
  return (
    <Conferma
      d={{
        testo: `Uscire adesso?\n${avvisoUscita(p.quante)} Se torna la rete partono da sole: premi TORNA e aspetta.`,
        si: 'ESCI LO STESSO',
        no: 'TORNA',
        pericolo: true,
        restare: true,
        risposta: () => {},
      }}
      fine={fine}
    />
  )
}
