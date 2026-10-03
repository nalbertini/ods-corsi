import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { type Dati, dati as caricaDati, inProvaScelta, scegliProva } from '../lib/dati'
import type { SessioneVista } from '../lib/sala'
import { Arretrato, CalendarioScreen } from './CalendarioScreen'
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

  const esito = chiuso && <Esito lezione={chiuso} inCoda={inCoda} onVa={() => setChiuso(null)} onRiapri={() => apriLezione(chiuso)} />

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
            <CalendarioScreen dati={d} onApri={apriLezione} apertaId={aperta?.id} conti={conti} soloDi={soloDi} arretrati={segnalate} />
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
            <CalendarioScreen dati={d} onApri={apriLezione} conti={conti} soloDi={soloDi} arretrati={segnalate} />
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
        <span className="num spia-coda-quante">{n === 1 ? 'UNA PRESENZA DA INVIARE' : `${n} PRESENZE DA INVIARE`}</span>
        <span>Sono salvati sul telefono: partono da soli appena c’è rete.</span>
      </div>
    </div>
  )
}

/**
 * Dopo CHIUDI L'APPELLO: arrivato in segreteria, o salvato sul telefono in
 * attesa della rete. Cambia da solo quando la coda si svuota.
 */
function Esito({ lezione, inCoda, onVa, onRiapri }: { lezione: SessioneVista; inCoda: number; onVa: () => void; onRiapri: () => void }) {
  const arrivato = inCoda === 0
  return (
    <div className="pad" style={{ paddingTop: 12 }}>
      <div className="card stack esito-appello" data-arrivato={arrivato}>
        <span className="row" style={{ gap: 12 }} role="status">
          <span className="appello-segno" aria-hidden="true">{arrivato ? '✓' : '…'}</span>
          <span className="stack grow" style={{ gap: 2, minWidth: 0 }}>
            <span className="num appello-esito">{arrivato ? 'APPELLO ARRIVATO IN SEGRETERIA' : 'APPELLO SALVATO SUL TELEFONO'}</span>
            <span style={{ fontSize: 14, color: 'var(--dim)' }}>
              {lezione.corso}, {giornoPerEsteso(chiaveGiorno(new Date(lezione.inizio)))} {oraDi(lezione.inizio)}
              {arrivato ? '.' : `: ${inCoda === 1 ? 'una presenza aspetta' : `${inCoda} presenze aspettano`} la rete, e partono da sole.`}
            </span>
          </span>
        </span>
        {/* Chiuso per sbaglio, o qualcuno arriva tardi: si riapre da qui. */}
        <span className="row" style={{ gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" className="icon-btn testo" onClick={onRiapri}>
            RIAPRI
          </button>
          <button type="button" className="icon-btn testo" onClick={onVa}>
            OK
          </button>
        </span>
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
    <Arretrato
      tono="giallo"
      titolo={l.length === 1 ? 'UNA PRESENZA SEGNALATA' : `${l.length} PRESENZE SEGNALATE`}
      sotto="Iscritti che dicono di esserci stati e non risultano: tocca la lezione per confermare."
      righe={l.map((s) => ({
        chiave: s.id,
        primo: perEsteso(s),
        secondo: `${s.corso} · ${giornoPerEsteso(chiaveGiorno(new Date(s.inizio)))} ${oraDi(s.inizio)}`,
        onApri: () => onApri(s.sessioneId),
      }))}
    />
  )
}
