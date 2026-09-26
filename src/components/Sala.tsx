import { useEffect, useState } from 'react'
import { type Dati, dati as caricaDati, inProvaScelta, scegliProva } from '../lib/dati'
import type { SessioneVista } from '../lib/sala'
import { CalendarioScreen } from './CalendarioScreen'
import { AppelloScreen } from './AppelloScreen'
import { Back } from './Icons'
import { useLargo } from '../lib/largo'

/**
 * Il calendario, e dentro una lezione l'appello.
 *
 * Sono due facce della stessa cosa, quindi stanno insieme e tengono per sé in
 * quale delle due si è. Sul telefono se ne vede una per volta; su uno schermo
 * largo stanno affiancate, il calendario a sinistra e l'appello della lezione
 * scelta a destra, e il conto dei presenti a sinistra segue l'appello mentre
 * lo si fa.
 */
export function Sala() {
  const [d, setD] = useState<Dati | null>(null)
  const [aperta, setAperta] = useState<SessioneVista | null>(null)
  const [inCoda, setInCoda] = useState(0)
  const [presenti, setPresenti] = useState<Record<string, number>>({})
  const largo = useLargo()

  const [guaio, setGuaio] = useState(false)
  const [tentativo, setTentativo] = useState(0)

  useEffect(() => {
    let vivo = true
    setGuaio(false)
    caricaDati().then(
      (x) => vivo && setD(x),
      () => vivo && setGuaio(true),
    )
    return () => {
      vivo = false
    }
  }, [tentativo])

  useEffect(() => d?.guardaCoda?.(setInCoda), [d])

  if (!d && guaio)
    return (
      <div className="pad stack" style={{ gap: 12, paddingTop: 20 }}>
        <p style={{ color: 'var(--dim)', margin: 0 }}>L'app non si è caricata: controlla la connessione.</p>
        <button type="button" className="btn btn-ghost" style={{ minHeight: 48, padding: '0 16px', alignSelf: 'flex-start' }} onClick={() => setTentativo((t) => t + 1)}>
          RIPROVA
        </button>
      </div>
    )
  if (!d) return <p className="pad" style={{ color: 'var(--dim)', paddingTop: 20 }}>Un attimo…</p>

  return (
    <>
      {d.modo === 'prova' && (
        <div className="nastro-prova">
          DATI DI PROVA · ISCRITTI INVENTATI ·{' '}
          <button
            type="button"
            style={{ textDecoration: 'underline', font: 'inherit', letterSpacing: 'inherit', color: 'inherit' }}
            onClick={() => {
              window.location.hash = '#sala'
              window.location.reload()
            }}
          >
            PROVA IL TABLET DI SALA
          </button>
          {inProvaScelta && (
            <>
              {' · '}
              <button
                type="button"
                style={{ textDecoration: 'underline', font: 'inherit', letterSpacing: 'inherit', color: 'inherit' }}
                onClick={() => scegliProva(false)}
              >
                ESCI DALLA PROVA
              </button>
            </>
          )}
        </div>
      )}

      {largo ? (
        <div className="sala-due">
          <div className="sala-lato">
            <CalendarioScreen dati={d} onApri={setAperta} apertaId={aperta?.id} presenti={presenti} />
          </div>
          <div className="sala-lato">
            {aperta ? (
              <>
                <div className="row pad" style={{ gap: 10, paddingTop: 16, alignItems: 'center' }}>
                  <span className="ob grow" style={{ fontSize: 26, fontWeight: 700, letterSpacing: '0.06em', minWidth: 0 }}>
                    {aperta.corso.toUpperCase()}
                  </span>
                  {inCoda > 0 && <span className="spia-coda">{inCoda} DA INVIARE</span>}
                </div>
                <AppelloScreen key={aperta.id} dati={d} sessioneId={aperta.id} onPresenti={(n) => setPresenti((p) => ({ ...p, [aperta.id]: n }))} />
              </>
            ) : (
              <div className="sala-vuota">
                <span className="rule-label">APPELLO</span>
                <span className="passo-dettaglio" style={{ fontSize: 15 }}>
                  Scegli una lezione dal calendario per fare l'appello.
                </span>
              </div>
            )}
          </div>
        </div>
      ) : aperta ? (
        <>
          <div className="row pad" style={{ gap: 10, paddingTop: 12, alignItems: 'center' }}>
            <button className="icon-btn" onClick={() => setAperta(null)} aria-label="Torna al calendario">
              <Back />
            </button>
            <span className="ob grow" style={{ fontSize: 22, fontWeight: 700, letterSpacing: '0.06em', minWidth: 0 }}>
              {aperta.corso.toUpperCase()}
            </span>
            {inCoda > 0 && <span className="spia-coda">{inCoda} DA INVIARE</span>}
          </div>
          <AppelloScreen key={aperta.id} dati={d} sessioneId={aperta.id} />
        </>
      ) : (
        <CalendarioScreen dati={d} onApri={setAperta} />
      )}
    </>
  )
}
