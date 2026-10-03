import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { type Dati, dati as caricaDati, inProvaScelta, scegliProva } from '../lib/dati'
import type { SessioneVista } from '../lib/sala'
import { CalendarioScreen } from './CalendarioScreen'
import { AppelloScreen, type Conto } from './AppelloScreen'
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
  const [conti, setConti] = useState<Record<string, Conto>>({})
  // Le presenze segnalate si rileggono quando se ne gestisce una dall'appello.
  const [giroSegnalate, setGiroSegnalate] = useState(0)
  const apri = (sessioneId: string) => void d?.dettaglio(sessioneId).then((x) => x && apriLezione(x.sessione))
  const segnalate = d && <Segnalate dati={d} soloDi={soloDi} giro={giroSegnalate} onApri={apri} />
  const ricontaSegnalate = () => setGiroSegnalate((g) => g + 1)
  const largo = useLargo()
  // L'ultimo appello chiuso, per dire se è arrivato in segreteria.
  const [chiuso, setChiuso] = useState<SessioneVista | null>(null)

  // Sul telefono calendario e appello scorrono nello stesso posto: l'appello
  // si apre in cima, e tornando il calendario è dove lo si era lasciato.
  const qui = useRef<HTMLDivElement>(null)
  const eraA = useRef(0)
  const apriLezione = (s: SessioneVista | null) => {
    const scorre = qui.current?.closest('.scroll')
    if (s && !aperta && scorre) eraA.current = scorre.scrollTop
    setAperta(s)
    if (s) setChiuso(null)
  }
  useLayoutEffect(() => {
    const scorre = qui.current?.closest('.scroll')
    if (scorre && !largo) scorre.scrollTop = aperta ? 0 : eraA.current
  }, [aperta?.id, largo])
  // Dopo la chiusura il calendario riparte dall'alto, dove c'è l'esito.
  const chiudi = (s: SessioneVista) => {
    eraA.current = 0
    setChiuso(s)
    apriLezione(null)
  }

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

  const esito = chiuso && <Esito lezione={chiuso} inCoda={inCoda} onVa={() => setChiuso(null)} />

  return (
    <div ref={qui} style={{ display: 'contents' }}>
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
      {/* Con un appello aperto la coda la dice la sua testa: qui sopra,
          comparendo, farebbe scendere i nomi sotto il dito. */}
      {inCoda > 0 && !chiuso && !aperta && <SpiaCoda n={inCoda} />}

      {largo ? (
        <div className="sala-due">
          <div className="sala-lato">
            {esito}
            {segnalate}
            <CalendarioScreen dati={d} onApri={apriLezione} apertaId={aperta?.id} conti={conti} soloDi={soloDi} />
          </div>
          <div className="sala-lato">
            {aperta ? (
              <AppelloScreen
                key={aperta.id}
                dati={d}
                sessioneId={aperta.id}
                soloDi={soloDi}
                onSegnalate={ricontaSegnalate}
                onConto={(c) => setConti((x) => ({ ...x, [aperta.id]: c }))}
              inCoda={inCoda}
                onChiudi={chiudi}
              />
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
      ) : (
        <>
          {aperta && (
            <AppelloScreen
              key={aperta.id}
              dati={d}
              sessioneId={aperta.id}
              soloDi={soloDi}
              onSegnalate={ricontaSegnalate}
              onConto={(c) => setConti((x) => ({ ...x, [aperta.id]: c }))}
              inCoda={inCoda}
              onIndietro={() => apriLezione(null)}
              onChiudi={chiudi}
            />
          )}
          {/* Il calendario resta montato sotto l'appello: tornando non si
              rilegge, e si ritrova dov'era. */}
          <div hidden={!!aperta}>
            {esito}
            {segnalate}
            <CalendarioScreen dati={d} onApri={apriLezione} conti={conti} soloDi={soloDi} />
            <Strumenti onMieiTimer={onMieiTimer} />
          </div>
        </>
      )}
    </div>
  )
}

/**
 * Le scritture che non sono ancora arrivate al server, in ogni faccia e non
 * solo dentro la lezione: chi esce dall'appello senza rete deve sapere che
 * aspettano, e che partono da sole.
 */
function SpiaCoda({ n }: { n: number }) {
  return (
    <div className="pad" style={{ paddingTop: 12 }}>
      <div className="spia-coda" role="status">
        <span className="num spia-coda-quante">{n === 1 ? 'UN SEGNO DA INVIARE' : `${n} SEGNI DA INVIARE`}</span>
        <span>Sono salvati sul telefono: partono da soli appena c’è rete.</span>
      </div>
    </div>
  )
}

/**
 * Dopo CHIUDI L'APPELLO: arrivato in segreteria, o salvato sul telefono in
 * attesa della rete. Cambia da solo quando la coda si svuota.
 */
function Esito({ lezione, inCoda, onVa }: { lezione: SessioneVista; inCoda: number; onVa: () => void }) {
  const arrivato = inCoda === 0
  return (
    <div className="pad" style={{ paddingTop: 12 }}>
      <div className="card row esito-appello" data-arrivato={arrivato} role="status">
        <span className="appello-segno" aria-hidden="true">{arrivato ? '✓' : '…'}</span>
        <span className="stack grow" style={{ gap: 2, minWidth: 0 }}>
          <span className="num appello-esito">{arrivato ? 'APPELLO ARRIVATO IN SEGRETERIA' : 'APPELLO SALVATO SUL TELEFONO'}</span>
          <span style={{ fontSize: 14, color: 'var(--dim)' }}>
            {lezione.corso}, {giornoPerEsteso(chiaveGiorno(new Date(lezione.inizio)))} {oraDi(lezione.inizio)}
            {arrivato ? '.' : `: ${inCoda === 1 ? 'un segno aspetta' : `${inCoda} segni aspettano`} la rete, e partono da soli.`}
          </span>
        </span>
        <button type="button" className="icon-btn testo" onClick={onVa}>
          OK
        </button>
      </div>
    </div>
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
