import { useEffect, useState } from 'react'
import { type Dati, dati as caricaDati, inProvaScelta, scegliProva } from '../lib/dati'
import type { SessioneVista } from '../lib/sala'
import { CalendarioScreen } from './CalendarioScreen'
import { AppelloScreen } from './AppelloScreen'
import { Back } from './Icons'
import { useLargo } from '../lib/largo'
import { TIMER } from '../lib/aree'
import type { SegnalataVista } from '../lib/segnalate'
import { chiaveGiorno, giornoPerEsteso, oraDi, perEsteso } from '../lib/sala'

/**
 * Il calendario, e dentro una lezione l'appello.
 *
 * Sono due facce della stessa cosa, quindi stanno insieme e tengono per sé in
 * quale delle due si è. Sul telefono se ne vede una per volta; su uno schermo
 * largo stanno affiancate, il calendario a sinistra e l'appello della lezione
 * scelta a destra, e il conto dei presenti a sinistra segue l'appello mentre
 * lo si fa.
 *
 * `soloDi` è l'istruttore di cui mostrare le lezioni (vedi `CalendarioScreen`);
 * `onMieiTimer` apre I MIEI TIMER dal fondo del calendario del telefono.
 */
export function Sala({ soloDi, onMieiTimer }: { soloDi?: string; onMieiTimer?: () => void } = {}) {
  const [d, setD] = useState<Dati | null>(null)
  const [aperta, setAperta] = useState<SessioneVista | null>(null)
  const [inCoda, setInCoda] = useState(0)
  const [presenti, setPresenti] = useState<Record<string, number>>({})
  // Le presenze segnalate si rileggono quando se ne gestisce una dall'appello.
  const [giroSegnalate, setGiroSegnalate] = useState(0)
  const apri = (sessioneId: string) => void d?.dettaglio(sessioneId).then((x) => x && setAperta(x.sessione))
  const segnalate = d && <Segnalate dati={d} soloDi={soloDi} giro={giroSegnalate} onApri={apri} />
  const ricontaSegnalate = () => setGiroSegnalate((g) => g + 1)
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
          DATI DI PROVA · ISCRITTI INVENTATI
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
            {segnalate}
            <CalendarioScreen dati={d} onApri={setAperta} apertaId={aperta?.id} presenti={presenti} soloDi={soloDi} />
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
                <AppelloScreen
                  key={aperta.id}
                  dati={d}
                  sessioneId={aperta.id}
                  soloDi={soloDi}
                  onSegnalate={ricontaSegnalate}
                  onPresenti={(n) => setPresenti((p) => ({ ...p, [aperta.id]: n }))}
                />
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
          <AppelloScreen key={aperta.id} dati={d} sessioneId={aperta.id} soloDi={soloDi} onSegnalate={ricontaSegnalate} />
        </>
      ) : (
        <>
          {segnalate}
          <CalendarioScreen dati={d} onApri={setAperta} soloDi={soloDi} />
          <Strumenti onMieiTimer={onMieiTimer} />
        </>
      )}
    </>
  )
}

/**
 * Sul telefono, sotto le lezioni, quello che sul computer sta nel menu: I
 * MIEI TIMER e il timer. In fondo e non in testata, dove ogni riga in più è una riga d'elenco
 * in meno; in un'altra scheda, così il calendario resta dov'era. Il tablet di
 * sala no: è un'area a sé, e dagli istruttori non ci si va.
 */
function Strumenti({ onMieiTimer }: { onMieiTimer?: () => void }) {
  return (
    <>
      <div className="rule">
        <span className="rule-label">STRUMENTI</span>
        <div className="rule-line" />
      </div>
      <div className="pad strumenti" style={{ paddingBottom: 20 }}>
        {onMieiTimer && (
          <button type="button" className="btn btn-ghost" onClick={onMieiTimer}>
            I MIEI TIMER
          </button>
        )}
        <a className="btn btn-ghost" href={TIMER} target="_blank" rel="noopener">
          TIMER ↗
        </a>
      </div>
    </>
  )
}

/**
 * Sopra il calendario, le presenze segnalate dagli iscritti nelle lezioni
 * di questo istruttore (di tutte, per la segreteria) che aspettano qualcuno:
 * toccandone una si apre l'appello di quella lezione, dove si accettano o si
 * rifiutano. Senza niente da vedere non c'è.
 */
function Segnalate({ dati, soloDi, giro, onApri }: { dati: Dati; soloDi?: string; giro: number; onApri: (sessioneId: string) => void }) {
  const [l, setL] = useState<SegnalataVista[]>([])
  useEffect(() => {
    let vivo = true
    void dati.segnalate?.(soloDi).then(
      (x) => vivo && setL(x.filter((s) => s.stato === 'da_vedere')),
      () => {},
    )
    return () => {
      vivo = false
    }
  }, [dati, soloDi, giro])
  if (!l.length) return null
  return (
    <div className="pad" style={{ paddingTop: 14 }}>
      <div className="card stack segnalate-avviso">
        <span className="rule-label" style={{ color: 'var(--giallo-testo)' }}>
          {l.length === 1 ? 'UNA PRESENZA SEGNALATA' : `${l.length} PRESENZE SEGNALATE`}
        </span>
        <span style={{ fontSize: 13, color: 'var(--dim)' }}>Iscritti che dicono di esserci stati e non risultano: apri la lezione per confermare.</span>
        {l.map((s) => (
          <button key={s.id} type="button" className="row segnalate-voce" onClick={() => onApri(s.sessioneId)}>
            <span className="grow" style={{ fontWeight: 600, textAlign: 'left' }}>
              {perEsteso(s)}
            </span>
            <span style={{ fontSize: 13, color: 'var(--dim)' }}>
              {s.corso} · {giornoPerEsteso(chiaveGiorno(new Date(s.inizio)))} {oraDi(s.inizio)}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
