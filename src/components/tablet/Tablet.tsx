import { useCallback, useEffect, useState, type FormEvent } from 'react'
import type { DatiTablet, LezioneSala, Postazione } from '../../lib/tablet'
import { datiTablet, lasciaTablet, REGOLE } from '../../lib/tablet'
import { chiaveGiorno, giornoPerEsteso, oraDi } from '../../lib/sala'
import { Logo } from '../Logo'
import { TastoTema } from '../TastoTema'
import { giornoDopo, messaggio, useAdesso, useInattivo, useSchermoAcceso } from './comune'
import { TabletHome } from './TabletHome'
import { TabletPresenza } from './TabletPresenza'
import { TabletRecupero } from './TabletRecupero'
import { TabletPin } from './TabletPin'
import { TabletIstruttore } from './TabletIstruttore'

/**
 * Il tablet di sala, a pieno schermo.
 *
 * Prima di tutto il tablet deve sapere in che sala è: col database lo dice
 * l'account della sala, con cui la segreteria fa l'accesso una volta sola; in
 * prova si sceglie da un elenco. Da lì in poi resta così finché qualcuno non
 * lo scollega dall'area istruttore.
 */
export function Tablet() {
  const [d, setD] = useState<DatiTablet | null>(null)
  const [postazione, setPostazione] = useState<Postazione | null | undefined>(undefined)
  const [guaio, setGuaio] = useState<string | null>(null)

  useSchermoAcceso()

  const leggi = useCallback(async (x: DatiTablet) => {
    try {
      setPostazione(await x.postazione())
      setGuaio(null)
    } catch (e) {
      setGuaio(messaggio(e, 'Non riesco a sapere in che sala sono'))
    }
  }, [])

  useEffect(() => {
    let vivo = true
    void datiTablet().then((x) => {
      if (!vivo) return
      setD(x)
      void leggi(x)
    })
    return () => {
      vivo = false
    }
  }, [leggi])

  if (!d || (postazione === undefined && !guaio)) return <div className="tb"><p className="tb-nota" style={{ padding: 32 }}>Un attimo…</p></div>

  if (!postazione) {
    return (
      <div className="tb">
        {d.modo === 'prova' && <div className="nastro-prova">DATI DI PROVA · ORARIO VERO, ISCRITTI INVENTATI</div>}
        <Preparazione d={d} guaio={guaio} onPronto={() => void leggi(d)} />
      </div>
    )
  }

  return (
    <div className="tb">
      {d.modo === 'prova' && <div className="nastro-prova">DATI DI PROVA · ORARIO VERO, ISCRITTI INVENTATI</div>}
      <TabletSala
        d={d}
        postazione={postazione}
        onScollega={async () => {
          await d.scollega()
          setPostazione(null)
        }}
      />
    </div>
  )
}

type Vista =
  | { s: 'home' }
  | { s: 'presenza'; lezione: LezioneSala; da: 'home' | 'recupero'; corsoId?: string }
  | { s: 'recupero'; corsoId: string | null }
  | { s: 'pin' }
  | { s: 'istruttore'; pin: string; nome: string }

function TabletSala({ d, postazione, onScollega }: { d: DatiTablet; postazione: Postazione; onScollega: () => void }) {
  const adesso = useAdesso(d)
  const [vista, setVista] = useState<Vista>({ s: 'home' })
  const [lezioni, setLezioni] = useState<LezioneSala[] | null>(null)
  const [guaio, setGuaio] = useState<string | null>(null)

  // Le ultime due settimane per il recupero, e la prossima per dire quando
  // si ricomincia: un intervallo solo, riletto ogni cinque minuti.
  const carica = useCallback(async () => {
    const oggi = d.adesso()
    try {
      setLezioni(await d.lezioni(giornoDopo(oggi, -REGOLE.recuperoGiorni), giornoDopo(oggi, 7)))
      setGuaio(null)
    } catch (e) {
      setGuaio(messaggio(e, 'Non riesco a leggere il calendario'))
    }
  }, [d])

  useEffect(() => {
    void carica()
    const i = window.setInterval(() => void carica(), 5 * 60_000)
    const torna = () => void carica()
    window.addEventListener('online', torna)
    return () => {
      window.clearInterval(i)
      window.removeEventListener('online', torna)
    }
  }, [carica])

  const aHome = useCallback(() => {
    setVista({ s: 'home' })
    void carica()
  }, [carica])

  // Chi se ne va a metà lascia il tablet com'era; l'area istruttore si chiude
  // da sola, perché dentro c'è il PIN di qualcuno.
  const inattivo = vista.s === 'istruttore' ? REGOLE.istruttoreInattivoMin * 60_000 : 90_000
  useInattivo(inattivo, () => {
    if (vista.s !== 'home') aHome()
  })

  return (
    <>
      <header className="tb-testata">
        <Logo width={70} />
        <div className="stack grow" style={{ gap: 2, minWidth: 0 }}>
          <span className="ob tb-sala">SALA {postazione.sala.toUpperCase()}</span>
          <span className="num tb-data">{giornoPerEsteso(chiaveGiorno(adesso)).toUpperCase()} · OFFICINE DELLO SPORT</span>
        </div>
        {vista.s === 'istruttore' && (
          <span className="num tb-bollino" style={{ background: 'var(--blu)' }}>AREA ISTRUTTORE · {vista.nome.toUpperCase()}</span>
        )}
        <span className="num tb-ora">{oraDi(adesso.toISOString())}</span>
        <TastoTema />
      </header>

      {vista.s === 'home' && (
        <TabletHome
          sala={postazione.sala}
          adesso={adesso}
          lezioni={lezioni}
          guaio={guaio}
          onSegna={(l) => setVista({ s: 'presenza', lezione: l, da: 'home' })}
          onRecupero={() => setVista({ s: 'recupero', corsoId: null })}
          onPin={() => setVista({ s: 'pin' })}
        />
      )}
      {vista.s === 'presenza' && (
        <TabletPresenza
          d={d}
          lezione={vista.lezione}
          adesso={adesso}
          onIndietro={() => {
            if (vista.da === 'recupero') {
              setVista({ s: 'recupero', corsoId: vista.corsoId ?? null })
              void carica()
            } else aHome()
          }}
        />
      )}
      {vista.s === 'recupero' && (
        <TabletRecupero
          adesso={adesso}
          lezioni={lezioni ?? []}
          corsoIniziale={vista.corsoId}
          onApri={(l, corsoId) => setVista({ s: 'presenza', lezione: l, da: 'recupero', corsoId })}
          onIndietro={aHome}
        />
      )}
      {vista.s === 'pin' && (
        <TabletPin d={d} onEntrato={(pin, chi) => setVista({ s: 'istruttore', pin, nome: chi.nome })} onAnnulla={aHome} />
      )}
      {vista.s === 'istruttore' && (
        <TabletIstruttore
          d={d}
          pin={vista.pin}
          adesso={adesso}
          lezioni={lezioni ?? []}
          onCambiato={() => void carica()}
          onEsci={aHome}
          onPinScaduto={() => setVista({ s: 'pin' })}
          onScollega={onScollega}
        />
      )}
    </>
  )
}

/** Il tablet non sa ancora in che sala è. */
function Preparazione({ d, guaio, onPronto }: { d: DatiTablet; guaio: string | null; onPronto: () => void }) {
  const [utente, setUtente] = useState('')
  const [password, setPassword] = useState('')
  const [errore, setErrore] = useState<string | null>(guaio)
  const [aspetta, setAspetta] = useState(false)

  const accedi = async (e: FormEvent) => {
    e.preventDefault()
    if (!d.entra) return
    setAspetta(true)
    setErrore(null)
    try {
      await d.entra(utente, password)
      onPronto()
    } catch (x) {
      setErrore(messaggio(x, 'Accesso non riuscito'))
    } finally {
      setAspetta(false)
    }
  }

  return (
    <div className="tb-corpo tb-preparazione">
      <div className="stack" style={{ gap: 18, maxWidth: 560 }}>
        <Logo width={90} />
        <span className="ob tb-titolo" style={{ fontSize: 40 }}>TABLET DI SALA</span>

        {d.sale && d.scegliSala ? (
          <>
            <span className="tb-sotto" style={{ fontSize: 18, lineHeight: 1.5 }}>
              In che sala è appeso questo tablet? Col database lo dice l'account della sala; in prova si sceglie qui.
            </span>
            <div className="tb-griglia" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
              {d.sale.map((s) => (
                <button
                  key={s}
                  type="button"
                  className="ob tb-scelta"
                  style={{ fontSize: 26, fontWeight: 700, letterSpacing: '0.06em', minHeight: 96 }}
                  onClick={() => void d.scegliSala!(s).then(onPronto)}
                >
                  {s.toUpperCase()}
                </button>
              ))}
            </div>
          </>
        ) : (
          <form className="stack" style={{ gap: 12 }} onSubmit={(e) => void accedi(e)}>
            <span className="tb-sotto" style={{ fontSize: 18, lineHeight: 1.5 }}>
              Si fa una volta sola, con l'account della sala che ha preparato la segreteria. Poi il tablet resta collegato.
            </span>
            <input
              className="tb-campo"
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="nome utente della sala"
              value={utente}
              onChange={(e) => setUtente(e.target.value)}
              required
            />
            <input
              className="tb-campo"
              type="password"
              autoComplete="current-password"
              placeholder="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button type="submit" className="tb-btn tb-btn-verde" disabled={aspetta}>
              {aspetta ? 'UN ATTIMO…' : 'COLLEGA IL TABLET'}
            </button>
          </form>
        )}

        {errore && (
          <span role="alert" style={{ fontSize: 17, fontWeight: 600, color: 'var(--rosso)' }}>
            {errore}
          </span>
        )}
        <button type="button" className="tb-scollega" style={{ alignSelf: 'flex-start' }} onClick={lasciaTablet}>
          ← Non è un tablet di sala: torna alla scelta delle aree
        </button>
      </div>
    </div>
  )
}
