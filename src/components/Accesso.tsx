import { useState, type FormEvent } from 'react'
import type { Accesso as Servizio, Chi } from '../lib/accesso'
import { Logo } from './Logo'

/**
 * L'accesso, col database: l'email e un link.
 *
 * Niente password: un istruttore che la dimentica il lunedì alle sei non fa
 * l'appello, e un link che vale un'ora non si ricicla da un sito all'altro.
 */
export function Accesso({ servizio, chi, onDentro }: { servizio: Servizio; chi: Chi; onDentro: () => void }) {
  const [email, setEmail] = useState('')
  const [mandato, setMandato] = useState<string | null>(null)
  const [guaio, setGuaio] = useState<string | null>(null)
  const [aspetta, setAspetta] = useState(false)

  const manda = async (e: FormEvent) => {
    e.preventDefault()
    setAspetta(true)
    setGuaio(null)
    try {
      await servizio.mandaLink(email.trim())
      setMandato(email.trim())
    } catch (x) {
      setGuaio(x instanceof Error ? x.message : 'Non riesco a mandare il link')
    } finally {
      setAspetta(false)
    }
  }

  return (
    <div className="app">
      <main className="scroll">
        <div className="pad stack accesso" style={{ gap: 18 }}>
          <div className="row" style={{ gap: 12 }}>
            <Logo />
            <div className="stack" style={{ gap: 1 }}>
              <span className="testata-nome">OFFICINE DELLO SPORT</span>
              <span className="testata-luogo">CORSI · COLLEGNO</span>
            </div>
          </div>

          {chi.stato === 'sconosciuto' ? (
            <div className="card stack" style={{ padding: 16, gap: 10 }}>
              <span className="ob" style={{ fontSize: 22, fontWeight: 700, letterSpacing: '0.04em' }}>ACCESSO NON ANCORA PRONTO</span>
              <span style={{ fontSize: 15, lineHeight: 1.5, color: 'var(--sec)' }}>
                {chi.email} è entrata, ma in anagrafica non c'è un istruttore o una segreteria con questa email. Chiedi alla segreteria di
                aggiungerla, poi esci e rientra.
              </span>
              <button type="button" className="btn btn-ghost" onClick={() => void servizio.esci().then(onDentro)}>
                ESCI
              </button>
            </div>
          ) : mandato ? (
            <div className="card stack" style={{ padding: 16, gap: 10, borderColor: 'var(--verde)' }}>
              <span className="ob" style={{ fontSize: 22, fontWeight: 700, letterSpacing: '0.04em' }}>LINK MANDATO</span>
              <span style={{ fontSize: 15, lineHeight: 1.5, color: 'var(--sec)' }}>
                Controlla la posta di {mandato}. Il link vale un'ora; se non arriva, guarda nello spam.
              </span>
              <button type="button" className="btn btn-ghost" onClick={() => setMandato(null)}>
                UN'ALTRA EMAIL
              </button>
            </div>
          ) : (
            <form className="stack" style={{ gap: 12 }} onSubmit={(e) => void manda(e)}>
              <label htmlFor="acc-email" className="rule-label" style={{ fontSize: 13 }}>
                LA TUA EMAIL
              </label>
              <input
                id="acc-email"
                className="campo"
                type="email"
                autoComplete="email"
                required
                placeholder="nome@esempio.it"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <button type="submit" className="btn btn-primary" disabled={aspetta}>
                {aspetta ? 'UN ATTIMO…' : 'MANDAMI IL LINK'}
              </button>
              <span style={{ fontSize: 14, lineHeight: 1.5, color: 'var(--dim)' }}>
                Ti arriva una mail con un link: aprila da questo telefono e sei dentro. Niente password da ricordare.
              </span>
            </form>
          )}

          {guaio && (
            <span role="alert" style={{ fontSize: 15, fontWeight: 600, color: 'var(--rosso)' }}>
              {guaio}
            </span>
          )}
          <span style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--faint)' }}>
            Serve solo a istruttori e segreteria. Chi frequenta i corsi non ha bisogno di un accesso.
          </span>
        </div>
      </main>
    </div>
  )
}
