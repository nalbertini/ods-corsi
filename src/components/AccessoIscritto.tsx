import { useEffect, useState, type FormEvent } from 'react'
import { accessoDalLink, codicePulito, emailPulita, entraConCodice, indirizzoSenzaAccesso, mandaCodice } from '../lib/accessoIscritto'
import type { IscrittoDiProva } from '../lib/iscritto'

/**
 * Come entra un iscritto: scrive l'email, riceve una mail con un link e un
 * codice di sei cifre. Tocca il link e entra da solo; se non può (altro
 * dispositivo, link scaduto) scrive il codice. Niente password da ricordare.
 * La logica sta in `accessoIscritto.ts`.
 */
export function AccessoIscritto({ onEntrato }: { onEntrato: (io: IscrittoDiProva) => void }) {
  const [email, setEmail] = useState('')
  const [codice, setCodice] = useState('')
  // Finché non è partito il codice si chiede l'email; dopo, il codice.
  const [inviata, setInviata] = useState<string | null>(null)
  const [errore, setErrore] = useState<string | null>(null)
  const [aspetta, setAspetta] = useState(false)

  // Il codice vale una volta: togliendolo subito dalla barra, il secondo giro dell'effetto (doppio mount, onEntrato nuovo) non lo trova.
  useEffect(() => {
    const link = accessoDalLink(window.location.search)
    if (!link) return
    // Prima via dalla barra, poi si prova: email e codice non restano nella cronologia.
    history.replaceState(null, '', indirizzoSenzaAccesso(window.location.pathname, window.location.search))
    if ('errore' in link) return setErrore(link.errore)
    setAspetta(true)
    void entraConCodice(link.email, link.codice).then(onEntrato, (x: unknown) => {
      setEmail(link.email)
      setErrore(x instanceof Error ? x.message : 'Non sono riuscito a farti entrare: riprova')
      setAspetta(false)
    })
  }, [onEntrato])

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
            Ti abbiamo scritto a {inviata}: tocca il link nella mail e sei dentro. Se non ti porta qui, scrivi il codice di sei cifre.
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
            MANDA UN’ALTRA MAIL
          </button>
          <button type="button" className="chi-esci" style={{ alignSelf: 'flex-start' }} disabled={aspetta} onClick={() => { setInviata(null); setErrore(null) }}>
            CAMBIA EMAIL
          </button>
          <Errore testo={errore} />
        </form>
      ) : (
        <form className="pad stack" style={{ gap: 12, paddingBottom: 16 }} onSubmit={(e) => void manda(e)}>
          <span className="passo-dettaglio" style={{ fontSize: 15 }}>
            Scrivi l’email che hai dato in segreteria: ti mandiamo una mail con un link per entrare, senza password.
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
            {aspetta ? 'UN ATTIMO…' : 'MANDAMI IL LINK'}
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
