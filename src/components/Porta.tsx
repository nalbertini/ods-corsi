import { type FormEvent, type ReactNode, useEffect, useState } from 'react'
import {
  accedi,
  account,
  accountDalLink,
  areeDi,
  eUnaSua,
  esci,
  mandaLinkPassword,
  nomeDelRuolo,
  passaA,
  quandoCambia,
  scegliArea,
  scegliPassword,
  serveAccesso,
  type AreaDiAccount,
  type Personale,
} from '../lib/accesso'
import type { Arrivo } from '../lib/invito'
import { indirizzo } from '../lib/aree'
import { areaDelPercorso } from '../lib/percorso'
import { scegliProva } from '../lib/dati'

/**
 * Chi ha fatto l'accesso: `undefined` finché non si sa, `null` se nessuno.
 * In prova non serve saperlo, ed è `null` da subito.
 *
 * La sessione è una per tutte le aree: se l'account è di un'altra (un
 * istruttore che apre `segreteria/`, il tablet di una sala che apre
 * `istruttori/`) si torna nella sua, e qui resta «un attimo». Chi ne ha due,
 * la segreteria che insegna anche, resta in tutte e due.
 */
export function useChi(): [Personale | null | undefined, (p: Personale | null) => void] {
  const [chi, setChi] = useState<Personale | null | undefined>(serveAccesso ? undefined : null)

  useEffect(() => {
    if (!serveAccesso) return
    let vivo = true
    let smetti: (() => void) | undefined
    const rileggi = () =>
      void account().then(
        (a) => {
          if (!vivo) return
          if (a && !eUnaSua(a, areaDelPercorso())) return passaA(a.area)
          setChi(a?.persona ?? null)
        },
        () => vivo && setChi(null),
      )
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
 * iscritti si fa l'accesso. In prova non c'è, e si entra subito.
 *
 * Entrano istruttori e segreteria: anche la segreteria fa l'appello. La
 * segreteria vera e propria ha il suo indirizzo e la sua porta (vedi `App`).
 *
 * `dentro` riceve chi è entrato (`null` in prova) e come farlo uscire;
 * `cornice` è la pagina in cui stanno l'accesso e l'attesa finché non si è
 * dentro. Chi è entrato lo mostra `dentro`: nel menu sullo schermo largo, in
 * `ChiSei` sul telefono.
 */
export function Porta({
  dentro,
  cornice,
}: {
  dentro: (chi: Personale | null, onEsci?: () => void) => ReactNode
  cornice: (x: ReactNode) => ReactNode
}) {
  const [chi, setChi] = useChi()

  if (!serveAccesso) return <>{dentro(null)}</>
  if (chi === undefined) return <>{cornice(<UnAttimo />)}</>
  if (!chi) return <>{cornice(<Accesso onEntrato={setChi} />)}</>
  return <>{dentro(chi, () => void esci())}</>
}

/** Chi è entrato, in una riga sopra il calendario del telefono. */
export function ChiSei({ chi, onEsci }: { chi: Personale; onEsci?: () => void }) {
  return (
    <div className="row pad chi-sei">
      <span className="grow" style={{ minWidth: 0 }}>
        {chi.nome.toUpperCase()} {chi.cognome.toUpperCase()} · {nomeDelRuolo(chi).toUpperCase()}
      </span>
      {chi.ancheIstruttore && areaDelPercorso() === 'istruttori' && (
        <button type="button" className="chi-esci" onClick={() => passaA('segreteria')}>
          SEGRETERIA
        </button>
      )}
      <button type="button" className="chi-esci" onClick={onEsci}>
        ESCI
      </button>
    </div>
  )
}

/** Cosa c'è in ogni area, per chi sceglie dove andare. */
const AREE: Record<AreaDiAccount, [string, string]> = {
  segreteria: ['SEGRETERIA', 'Corsi, iscritti, presenze e richieste, dal computer della reception.'],
  istruttori: ['ISTRUTTORI', 'Il calendario delle tue lezioni e l’appello, i tuoi timer.'],
  sala: ['SALA', 'Il tablet appeso al muro della sala.'],
}

/**
 * Dove va chi ha più di un'area, la segreteria che insegna anche: lo sceglie
 * a ogni accesso, e poi passa dall'una all'altra dal menu senza uscire.
 */
export function SceltaArea({ persona, aree, onScelta }: { persona: Personale; aree: AreaDiAccount[]; onScelta: (a: AreaDiAccount) => void }) {
  return (
    <div className="accesso">
      <div className="rule">
        <span className="rule-label">DOVE VAI?</span>
        <div className="rule-line" />
      </div>
      <div className="pad stack" style={{ gap: 10, paddingBottom: 16 }}>
        <span className="passo-dettaglio" style={{ fontSize: 15 }}>
          Ciao {persona.nome}: sei della segreteria e insegni anche. Scegli dove entrare; poi si cambia dal menu, senza
          uscire.
        </span>
        {aree.map((a) => (
          <button key={a} type="button" className="card stack scelta-area" style={{ textAlign: 'left' }} onClick={() => onScelta(a)}>
            <span className="scelta-titolo">{AREE[a][0]}</span>
            <span className="passo-dettaglio" style={{ fontSize: 15 }}>{AREE[a][1]}</span>
          </button>
        ))}
        <button type="button" className="chi-esci" style={{ alignSelf: 'flex-start' }} onClick={() => void esci()}>
          ESCI
        </button>
      </div>
    </div>
  )
}

export function UnAttimo() {
  return <p className="pad" style={{ color: 'var(--dim)', paddingTop: 20 }}>Un attimo…</p>
}

/**
 * La porta, una sola per tutti: la stessa alla radice, in `istruttori/` e in
 * `segreteria/`. Chi entra va nella sua area, qualunque porta abbia aperto
 * (vedi `accedi`): se è questa, `onEntrato` riceve la persona; se no la pagina
 * cambia. Una scelta dell'area c'è solo per chi ne ha più d'una (vedi
 * `SceltaArea`): per gli altri la sceglie l'account.
 */
export function Accesso({ onEntrato }: { onEntrato?: (p: Personale) => void }) {
  const [scelta, setScelta] = useState<{ persona: Personale; aree: AreaDiAccount[] } | null>(null)
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

  const invia = async (e: FormEvent) => {
    e.preventDefault()
    setAspetta(true)
    setErrore(null)
    setDetto(null)
    try {
      const e = await accedi(email.trim(), password)
      if (e.scegli) setScelta({ persona: e.persona, aree: e.scegli })
      else if (e.persona) onEntrato?.(e.persona)
    } catch (x) {
      setErrore(x instanceof Error ? x.message : 'Accesso non riuscito')
    } finally {
      setAspetta(false)
    }
  }

  if (scelta) return <SceltaArea {...scelta} onScelta={(a) => scegliArea(a) && onEntrato?.(scelta.persona)} />

  return (
    <div className="accesso">
      <div className="rule">
        <span className="rule-label">ACCESSO</span>
        <div className="rule-line" />
      </div>
      <form className="pad stack" style={{ gap: 12, paddingBottom: 16 }} onSubmit={(e) => void invia(e)}>
        <span className="passo-dettaglio" style={{ fontSize: 15 }}>
          Entra con l’account che ti ha dato la palestra, e l’app ti porta da sola nella tua area: la segreteria alla
          reception, gli istruttori al calendario e all’appello, il tablet di una sala nella sua sala. Resti collegato
          finché non premi «Esci».
        </span>
        <label className="stack" style={{ gap: 4 }}>
          <span className="modulo-etichetta">EMAIL, O NOME UTENTE DELLA SALA</span>
          <input
            className="campo"
            type="text"
            inputMode="email"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label className="stack" style={{ gap: 4 }}>
          <span className="modulo-etichetta">PASSWORD</span>
          <input
            className="campo"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        <button type="submit" className="btn btn-go" disabled={aspetta}>
          {aspetta ? 'UN ATTIMO…' : 'ENTRA'}
        </button>
        <button type="button" className="chi-esci" style={{ alignSelf: 'flex-start' }} disabled={aspetta} onClick={() => void dimenticata()}>
          PASSWORD DIMENTICATA?
        </button>
        {errore && (
          <span role="alert" style={{ fontSize: 15, fontWeight: 600, color: 'var(--rosso-testo)', lineHeight: 1.4 }}>
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
 * area: la segreteria nella segreteria, un istruttore nel calendario. Il link
 * apre la pagina da cui è partito (l'invito la segreteria, «password
 * dimenticata» la porta dove lo si è chiesto), che può non essere la propria:
 * la sessione è una sola, e l'accesso vale anche lì.
 */
export function ScegliPassword({ arrivo }: { arrivo: Arrivo }) {
  const [account, setAccount] = useState<string | null | undefined>(arrivo.tipo === 'scaduto' ? null : undefined)
  const [scelta, setScelta] = useState<Personale | null>(null)
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
      const aree = areeDi(p)
      if (aree.length > 1) setScelta(p)
      else passaA(aree[0])
    } catch (x) {
      setErrore(x instanceof Error ? x.message : 'La password non è stata salvata')
      setAspetta(false)
    }
  }

  if (scelta) return <SceltaArea persona={scelta} aree={areeDi(scelta)} onScelta={passaA} />

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
          <button type="button" className="btn btn-go" onClick={() => window.location.assign(indirizzo('./'))}>
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
          <label className="stack" style={{ gap: 4 }}>
            <span className="modulo-etichetta">NUOVA PASSWORD</span>
            <input
              className="campo"
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          <label className="stack" style={{ gap: 4 }}>
            <span className="modulo-etichetta">RIPETI LA NUOVA PASSWORD</span>
            <input
              className="campo"
              type="password"
              autoComplete="new-password"
              value={ancora}
              onChange={(e) => setAncora(e.target.value)}
              required
            />
          </label>
          <button type="submit" className="btn btn-go" disabled={aspetta}>
            {aspetta ? 'UN ATTIMO…' : 'SALVA ED ENTRA'}
          </button>
          {errore && (
            <span role="alert" style={{ fontSize: 15, fontWeight: 600, color: 'var(--rosso-testo)', lineHeight: 1.4 }}>
              {errore}
            </span>
          )}
        </form>
      )}
    </div>
  )
}
