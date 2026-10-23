import { useState, type FormEvent } from 'react'
import { codicePulito, emailPulita, entraConCodice, mandaCodice } from '../lib/accessoIscritto'
import type { IscrittoDiProva } from '../lib/iscritto'

/**
 * Come entra un iscritto: scrive l'email, riceve un codice di sei cifre, lo
 * scrive. Niente password da ricordare. La logica sta in `accessoIscritto.ts`.
 */
export function AccessoIscritto({ onEntrato }: { onEntrato: (io: IscrittoDiProva) => void }) {
  const [email, setEmail] = useState('')
  const [codice, setCodice] = useState('')
  // Finché non è partito il codice si chiede l'email; dopo, il codice.
  const [inviata, setInviata] = useState<string | null>(null)
  const [errore, setErrore] = useState<string | null>(null)
  const [aspetta, setAspetta] = useState(false)

  const manda = async (e?: FormEvent) => {
    e?.preventDefault()
    const pulita = emailPulita(email)
    if (!pulita) return setErrore('Controlla l’email: non sembra giusta')
    setAspetta(true)
    setErrore(null)
    try {
      await mandaCodice(pulita)
      setInviata(pulita)
      setCodice('')
    } catch (x) {
      setErrore(x instanceof Error ? x.message : 'Il codice non è partito: riprova fra poco')
    } finally {
      setAspetta(false)
    }
  }

  const entra = async (e: FormEvent) => {
    e.preventDefault()
    const c = codicePulito(codice)
    if (!inviata || !c) return setErrore('Il codice è di sei cifre: lo trovi nella mail')
    setAspetta(true)
    setErrore(null)
    try {
      onEntrato(await entraConCodice(inviata, c))
    } catch (x) {
      setErrore(x instanceof Error ? x.message : 'Non sono riuscito a farti entrare: riprova')
      setAspetta(false)
    }
  }

  return (
    <div className="accesso">
      <div className="rule">
        <span className="rule-label">ACCESSO</span>
        <div className="rule-line" />
      </div>
      {inviata ? (
        <form className="pad stack" style={{ gap: 12, paddingBottom: 16 }} onSubmit={(e) => void entra(e)}>
          <span className="passo-dettaglio" style={{ fontSize: 15 }}>
            Ti abbiamo scritto a {inviata}: dentro c’è un codice di sei cifre. Scrivilo qui.
          </span>
          <label className="stack" style={{ gap: 4 }}>
            <span className="modulo-etichetta">CODICE</span>
            <input
              className="campo num campo-codice"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              maxLength={6}
              value={codice}
              onChange={(e) => setCodice(e.target.value)}
              required
            />
          </label>
          <button type="submit" className="btn btn-go" disabled={aspetta}>
            {aspetta ? 'UN ATTIMO…' : 'ENTRA'}
          </button>
          <button type="button" className="chi-esci" style={{ alignSelf: 'flex-start' }} disabled={aspetta} onClick={() => void manda()}>
            MANDA UN ALTRO CODICE
          </button>
          <button type="button" className="chi-esci" style={{ alignSelf: 'flex-start' }} disabled={aspetta} onClick={() => { setInviata(null); setErrore(null) }}>
            CAMBIA EMAIL
          </button>
          <Errore testo={errore} />
        </form>
      ) : (
        <form className="pad stack" style={{ gap: 12, paddingBottom: 16 }} onSubmit={(e) => void manda(e)}>
          <span className="passo-dettaglio" style={{ fontSize: 15 }}>
            Scrivi l’email che hai dato in segreteria: ti mandiamo un codice per entrare, senza password.
          </span>
          <label className="stack" style={{ gap: 4 }}>
            <span className="modulo-etichetta">EMAIL</span>
            <input
              className="campo"
              autoFocus
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <button type="submit" className="btn btn-go" disabled={aspetta}>
            {aspetta ? 'UN ATTIMO…' : 'MANDAMI IL CODICE'}
          </button>
          <Errore testo={errore} />
        </form>
      )}
    </div>
  )
}

function Errore({ testo }: { testo: string | null }) {
  return testo ? (
    <span role="alert" style={{ fontSize: 15, fontWeight: 600, color: 'var(--rosso-testo)', lineHeight: 1.4 }}>
      {testo}
    </span>
  ) : null
}
