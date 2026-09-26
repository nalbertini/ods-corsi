import { type FormEvent, type ReactNode, useEffect, useState } from 'react'
import { chiSei, entra, esci, quandoEsce, serveAccesso, type Personale } from '../lib/accesso'
import { scegliProva } from '../lib/dati'

/**
 * Chi ha fatto l'accesso: `undefined` finché non si sa, `null` se nessuno.
 * In prova non serve saperlo, ed è `null` da subito.
 */
export function useChi(): [Personale | null | undefined, (p: Personale | null) => void] {
  const [chi, setChi] = useState<Personale | null | undefined>(serveAccesso ? undefined : null)

  useEffect(() => {
    if (!serveAccesso) return
    let vivo = true
    let smetti: (() => void) | undefined
    void chiSei().then((p) => vivo && setChi(p), () => vivo && setChi(null))
    void quandoEsce(() => vivo && setChi(null)).then((f) => (vivo ? (smetti = f) : f()))
    return () => {
      vivo = false
      smetti?.()
    }
  }, [])

  return [chi, setChi]
}

/**
 * La porta del calendario: con il database vero, prima di vedere lezioni e
 * iscritti si fa l'accesso. In prova non c'è, e i figli si vedono subito.
 *
 * Entrano istruttori e segreteria: anche la segreteria fa l'appello. La
 * segreteria vera e propria ha il suo indirizzo e la sua porta (vedi `App`).
 */
export function Porta({ children }: { children: ReactNode }) {
  const [chi, setChi] = useChi()

  if (!serveAccesso) return <>{children}</>
  if (chi === undefined) return <UnAttimo />
  if (!chi) return <Accesso per="istruttori" onEntrato={setChi} />

  return (
    <>
      <div className="row pad chi-sei">
        <span className="grow" style={{ minWidth: 0 }}>
          {chi.nome.toUpperCase()} {chi.cognome.toUpperCase()} · {chi.ruolo === 'staff' ? 'SEGRETERIA' : 'ISTRUTTORE'}
        </span>
        <button type="button" className="chi-esci" onClick={() => void esci().then(() => setChi(null))}>
          ESCI
        </button>
      </div>
      {children}
    </>
  )
}

export function UnAttimo() {
  return <p className="pad" style={{ color: 'var(--dim)', paddingTop: 20 }}>Un attimo…</p>
}

const SPIEGA = {
  istruttori: 'Il calendario e l’appello sono per istruttori e segreteria.',
  segreteria: 'La segreteria è per chi lavora alla reception.',
}

export function Accesso({ per, onEntrato }: { per: keyof typeof SPIEGA; onEntrato: (p: Personale) => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errore, setErrore] = useState<string | null>(null)
  const [aspetta, setAspetta] = useState(false)

  const accedi = async (e: FormEvent) => {
    e.preventDefault()
    setAspetta(true)
    setErrore(null)
    try {
      onEntrato(await entra(email.trim(), password))
    } catch (x) {
      setErrore(x instanceof Error ? x.message : 'Accesso non riuscito')
    } finally {
      setAspetta(false)
    }
  }

  return (
    <div className="accesso">
      <div className="rule">
        <span className="rule-label">ACCESSO</span>
        <div className="rule-line" />
      </div>
      <form className="pad stack" style={{ gap: 12, paddingBottom: 16 }} onSubmit={(e) => void accedi(e)}>
        <span className="passo-dettaglio" style={{ fontSize: 15 }}>
          {SPIEGA[per]} Entra con l’account che ti ha dato la palestra: resti collegato finché non premi «Esci».
        </span>
        <input
          className="campo"
          type="email"
          autoComplete="username"
          placeholder="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          className="campo"
          type="password"
          autoComplete="current-password"
          placeholder="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button type="submit" className="btn btn-go" disabled={aspetta}>
          {aspetta ? 'UN ATTIMO…' : 'ENTRA'}
        </button>
        {errore && (
          <span role="alert" style={{ fontSize: 15, fontWeight: 600, color: 'var(--rosso)', lineHeight: 1.4 }}>
            {errore}
          </span>
        )}
      </form>
      <div className="pad stack" style={{ gap: 8, paddingBottom: 16 }}>
        <span className="passo-dettaglio" style={{ fontSize: 15 }}>
          Senza account si può guardare l’app in prova: l’orario vero, iscritti inventati, e niente di quel che si
          tocca arriva al database.
        </span>
        <button type="button" className="btn btn-ghost" onClick={() => scegliProva(true)}>
          PROVA CON DATI INVENTATI
        </button>
      </div>
    </div>
  )
}
