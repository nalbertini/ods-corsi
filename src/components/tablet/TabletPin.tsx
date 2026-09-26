import { useState } from 'react'
import type { DatiTablet } from '../../lib/tablet'
import { messaggio } from './comune'

const TASTI = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'canc', '0', '']

/**
 * Il PIN dell'istruttore: quattro cifre su una tastiera grande.
 *
 * Il PIN non si salva da nessuna parte: resta in memoria finché l'area
 * istruttore è aperta, e ogni richiesta al server lo porta con sé.
 */
export function TabletPin({
  d,
  onEntrato,
  onAnnulla,
}: {
  d: DatiTablet
  onEntrato: (pin: string, chi: { personaId: string; nome: string }) => void
  onAnnulla: () => void
}) {
  const [pin, setPin] = useState('')
  const [guaio, setGuaio] = useState<string | null>(null)
  const [aspetta, setAspetta] = useState(false)

  const premi = async (c: string) => {
    if (aspetta) return
    if (c === 'canc') {
      setPin((p) => p.slice(0, -1))
      setGuaio(null)
      return
    }
    const nuovo = (pin + c).slice(0, 4)
    setGuaio(null)
    setPin(nuovo)
    if (nuovo.length < 4) return
    setAspetta(true)
    try {
      const chi = await d.entraConPin(nuovo)
      if (chi) return onEntrato(nuovo, chi)
      setGuaio('PIN sbagliato. Riprova.')
    } catch (e) {
      setGuaio(messaggio(e, 'Il server non risponde'))
    } finally {
      setAspetta(false)
    }
    setPin('')
  }

  return (
    <div className="tb-corpo tb-pin">
      <div className="stack" style={{ gap: 16, maxWidth: 380 }}>
        <span className="ob tb-titolo" style={{ fontSize: 36 }}>AREA ISTRUTTORE</span>
        <span className="tb-sotto" style={{ fontSize: 18, lineHeight: 1.5 }}>
          Il tuo PIN a quattro cifre. Da qui fai l'appello completo e correggi le presenze segnate sul tablet.
        </span>
        <div className="row" style={{ gap: 14, padding: '8px 0' }} aria-label={`${pin.length} cifre su 4`}>
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className="tb-pallino" data-pieno={i < pin.length} data-guaio={!!guaio} />
          ))}
        </div>
        {guaio && (
          <span role="alert" style={{ fontSize: 17, fontWeight: 600, color: 'var(--rosso)' }}>
            {guaio}
          </span>
        )}
        {d.modo === 'prova' && (
          <span className="tb-nota" style={{ fontSize: 14 }}>
            In prova: 1234 è Maurizio, 2468 è Maura, 5678 è Fabio.
          </span>
        )}
        <button type="button" className="tb-btn tb-btn-linea" style={{ alignSelf: 'flex-start' }} onClick={onAnnulla}>
          ANNULLA
        </button>
      </div>
      <div className="tb-tastiera">
        {TASTI.map((c, i) =>
          c ? (
            <button
              key={i}
              type="button"
              className="num tb-tasto"
              data-piccolo={c === 'canc'}
              onClick={() => void premi(c)}
              aria-label={c === 'canc' ? 'Cancella' : c}
            >
              {c === 'canc' ? 'CANCELLA' : c}
            </button>
          ) : (
            <span key={i} />
          ),
        )}
      </div>
    </div>
  )
}
