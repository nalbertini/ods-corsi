import { type FormEvent, type ReactNode, useEffect, useState } from 'react'
import { accountDalLink, chiSei, entra, esci, mandaLinkPassword, quandoCambia, scegliPassword, serveAccesso, type Personale } from '../lib/accesso'
import type { Arrivo } from '../lib/invito'
import { INDIRIZZO_AREE } from '../lib/aree'
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
    const rileggi = () => void chiSei().then((p) => vivo && setChi(p), () => vivo && setChi(null))
    rileggi()
    // Un altro account entrato altrove va riletto, non tenuto col nome di
    // prima. Fuori dalla richiamata di Supabase: dentro, una chiamata al
    // client aspetterebbe sé stessa.
    void quandoCambia((collegato) => {
      if (!vivo) return
      if (collegato) window.setTimeout(rileggi, 0)
      else setChi(null)
    }).then((f) => (vivo ? (smetti = f) : f()))
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

/** Dalla porta di un'area si torna alla pagina con tutte e quattro (vedi `aree.ts`). */
export function AltreAree() {
  return (
    <a className="chi-esci" href={INDIRIZZO_AREE}>
      ← TUTTE LE AREE
    </a>
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
  const [detto, setDetto] = useState<string | null>(null)
  const [aspetta, setAspetta] = useState(false)

  const dimenticata = async () => {
    setErrore(null)
    setDetto(null)
    if (!email.trim()) return setErrore('Scrivi la tua email, e poi «password dimenticata»')
    setAspetta(true)
    try {
      await mandaLinkPassword(email.trim())
      setDetto(`Se ${email.trim()} ha un account, fra poco arriva una mail con il link per sceglierne una nuova.`)
    } catch (x) {
      setErrore(x instanceof Error ? x.message : 'La mail non è partita')
    } finally {
      setAspetta(false)
    }
  }

  const accedi = async (e: FormEvent) => {
    e.preventDefault()
    setAspetta(true)
    setErrore(null)
    setDetto(null)
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
        <AltreAree />
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
        <button type="button" className="chi-esci" style={{ alignSelf: 'flex-start' }} disabled={aspetta} onClick={() => void dimenticata()}>
          PASSWORD DIMENTICATA?
        </button>
        {errore && (
          <span role="alert" style={{ fontSize: 15, fontWeight: 600, color: 'var(--rosso)', lineHeight: 1.4 }}>
            {errore}
          </span>
        )}
        {detto && (
          <span role="status" className="passo-dettaglio" style={{ fontSize: 15 }}>
            {detto}
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

/**
 * Dove porta il link di un'email di Supabase: l'invito della segreteria o
 * «password dimenticata». Si sceglie la password e si entra nella propria
 * area: la segreteria nella segreteria, un istruttore nel calendario.
 */
export function ScegliPassword({ arrivo, onFatto }: { arrivo: Arrivo; onFatto: (dove: string) => void }) {
  const [account, setAccount] = useState<string | null | undefined>(arrivo.tipo === 'scaduto' ? null : undefined)
  const [password, setPassword] = useState('')
  const [ancora, setAncora] = useState('')
  const [errore, setErrore] = useState<string | null>(null)
  const [aspetta, setAspetta] = useState(false)

  useEffect(() => {
    if (arrivo.tipo === 'scaduto') return
    let vivo = true
    void accountDalLink().then(
      (e) => vivo && setAccount(e),
      () => vivo && setAccount(null),
    )
    return () => {
      vivo = false
    }
  }, [arrivo.tipo])

  const salva = async (e: FormEvent) => {
    e.preventDefault()
    setErrore(null)
    if (password.length < 8) return setErrore('Almeno otto caratteri')
    if (password !== ancora) return setErrore('Le due password non sono uguali')
    setAspetta(true)
    try {
      const p = await scegliPassword(password)
      onFatto(p.ruolo === 'staff' ? '#segreteria' : '#istruttori')
    } catch (x) {
      setErrore(x instanceof Error ? x.message : 'La password non è stata salvata')
    } finally {
      setAspetta(false)
    }
  }

  return (
    <div className="accesso">
      <div className="rule">
        <span className="rule-label">{{ invito: 'BENVENUTO', password: 'NUOVA PASSWORD', scaduto: 'LINK SCADUTO' }[arrivo.tipo]}</span>
        <div className="rule-line" />
      </div>
      {account === undefined && <UnAttimo />}
      {account === null && (
        <div className="pad stack" style={{ gap: 12, paddingBottom: 16 }}>
          <span className="passo-dettaglio" style={{ fontSize: 15 }}>
            {arrivo.tipo === 'scaduto' ? arrivo.testo : 'Il link non vale più.'} Se era un invito, chiedi alla segreteria di
            mandarne un altro; se avevi già una password, dalla porta c’è «password dimenticata».
          </span>
          <button type="button" className="btn btn-go" onClick={() => onFatto('#istruttori')}>
            VAI ALLA PORTA
          </button>
        </div>
      )}
      {account && (
        <form className="pad stack" style={{ gap: 12, paddingBottom: 16 }} onSubmit={(e) => void salva(e)}>
          <span className="passo-dettaglio" style={{ fontSize: 15 }}>
            {arrivo.tipo === 'invito' ? 'La palestra ti ha dato un accesso. ' : ''}Scegli la password per {account}: è
            quella con cui entrerai d’ora in poi.
          </span>
          {/* Il campo nascosto fa ricordare al browser email e password insieme. */}
          <input type="email" autoComplete="username" value={account} readOnly hidden />
          <input
            className="campo"
            type="password"
            autoComplete="new-password"
            placeholder="nuova password"
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <input
            className="campo"
            type="password"
            autoComplete="new-password"
            placeholder="ripetila"
            value={ancora}
            onChange={(e) => setAncora(e.target.value)}
            required
          />
          <button type="submit" className="btn btn-go" disabled={aspetta}>
            {aspetta ? 'UN ATTIMO…' : 'SALVA ED ENTRA'}
          </button>
          {errore && (
            <span role="alert" style={{ fontSize: 15, fontWeight: 600, color: 'var(--rosso)', lineHeight: 1.4 }}>
              {errore}
            </span>
          )}
        </form>
      )}
    </div>
  )
}
