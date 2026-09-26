import { useEffect, useState } from 'react'
import type { DatiSegreteria } from '../../lib/segreteria'
import { datiSegreteria } from '../../lib/segreteria'
import { Logo } from '../Logo'
import { Settimana } from './Settimana'
import { Corsi } from './Corsi'
import { Iscritti } from './Iscritti'

type Voce = 'settimana' | 'corsi' | 'iscritti'

const VOCI: Array<[Voce, string]> = [
  ['settimana', 'SETTIMANA'],
  ['corsi', 'CORSI'],
  ['iscritti', 'ISCRITTI'],
]

/**
 * La segreteria: il menu a sinistra e la sezione scelta a destra.
 *
 * È pensata per il computer della reception, non per il telefono: le tabelle
 * vogliono spazio. Su uno schermo stretto il menu va in cima e le colonne si
 * mettono una sotto l'altra, così si può comunque dare un'occhiata.
 */
export function Segreteria({ nome, prova, onApp, onEsci }: { nome: string; prova: boolean; onApp: () => void; onEsci?: () => void }) {
  const [d, setD] = useState<DatiSegreteria | null>(null)
  const [voce, setVoce] = useState<Voce>('settimana')

  useEffect(() => {
    let vivo = true
    void datiSegreteria().then((x) => vivo && setD(x))
    return () => {
      vivo = false
    }
  }, [])

  return (
    <div className="sg">
      <nav className="sg-menu" aria-label="Segreteria">
        <div className="row" style={{ gap: 10, padding: '0 8px' }}>
          <Logo width={46} />
          <span className="stack" style={{ gap: 2 }}>
            <span className="ob" style={{ fontSize: 20, fontWeight: 700, letterSpacing: '0.04em', lineHeight: 1 }}>ODS CORSI</span>
            <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.22em', color: 'var(--dim)' }}>SEGRETERIA</span>
          </span>
        </div>
        <div className="sg-voci">
          {VOCI.map(([id, testo]) => (
            <button key={id} type="button" className="num sg-voce" aria-current={voce === id ? 'page' : undefined} onClick={() => setVoce(id)}>
              {testo}
            </button>
          ))}
        </div>
        <div className="grow" />
        <button type="button" className="num sg-voce" onClick={onApp}>
          ← APP DEI CORSI
        </button>
        <div className="sg-chi">
          <span style={{ fontSize: 14, fontWeight: 600 }}>{nome}</span>
          <span style={{ fontSize: 12, color: 'var(--dim)' }}>Segreteria · accesso completo</span>
          {prova && <span className="num sg-bollino">DATI DI PROVA</span>}
          {prova && (
            <button
              type="button"
              className="sg-link"
              onClick={() => {
                if (!window.confirm("Rimettere l'orario vero e togliere i cambi e le presenze fatte in prova su questo dispositivo?")) return
                void Promise.all([import('../../lib/archivioProva'), import('../../lib/datiProva')]).then(([a, p]) => {
                  a.archivio.azzera()
                  p.scordaProva()
                  window.location.reload()
                })
              }}
            >
              Riparti dall'orario vero
            </button>
          )}
          {onEsci && (
            <button type="button" className="sg-link" onClick={onEsci}>
              Esci
            </button>
          )}
        </div>
      </nav>

      <main className="sg-corpo">
        {!d && <p className="sg-sotto">Un attimo…</p>}
        {d && voce === 'settimana' && <Settimana d={d} />}
        {d && voce === 'corsi' && <Corsi d={d} />}
        {d && voce === 'iscritti' && <Iscritti d={d} />}
      </main>
    </div>
  )
}
