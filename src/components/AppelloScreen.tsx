import { useCallback, useEffect, useRef, useState } from 'react'
import type { Dati } from '../lib/dati'
import type { DettaglioSessione, StatoPresenza } from '../lib/sala'
import { giornoPerEsteso, oraDi, perEsteso } from '../lib/sala'
import { timerDellaLezione } from '../lib/aree'
import { Back, Cronometro } from './Icons'
import { Kanji } from './Kanji'
import type { ChiProva } from '../lib/prove'
import { MarchioProva, PannelloProve, TogliProva } from './Prove'
import type { SegnalataVista } from '../lib/segnalate'

/**
 * L'appello.
 *
 * È la schermata che si usa con venti persone davanti che aspettano, quindi
 * conta più di quanto sembri. Due scelte che vengono da lì:
 *
 * 1. **Non si parte da «tutti assenti».** Si parte da nessuno segnato, con
 *    `TUTTI PRESENTI` in cima. In una classe di ventidue con venti presenti si
 *    segnano due assenze invece di venti presenze.
 * 2. **Un tocco solo per riga**, e il giro è presente → assente → non segnato.
 *    Niente menù, niente conferme: le righe sono alte 56 px perché le si tocca
 *    con le mani sudate e senza guardare.
 *
 * Chi viene a provare lo aggiunge l'istruttore da qui, col tasto PROVE: entra
 * in fondo all'elenco, già presente (vedi `Prove.tsx`).
 *
 * `onPresenti` dice quanti sono i presenti ogni volta che cambiano, per il
 * calendario che sullo schermo largo sta qui accanto.
 *
 * In cima all'elenco, le presenze segnalate dagli iscritti per questa
 * lezione (vedi `segnalate.ts`), da accettare o rifiutare: accettata, il nome
 * diventa presente. `soloDi` è l'istruttore che fa l'appello, che le gestisce
 * solo per le sue lezioni; `onSegnalate` avvisa quando ne ha gestita una.
 */
export function AppelloScreen({
  dati,
  sessioneId,
  onPresenti,
  soloDi,
  onSegnalate,
  onIndietro,
  onChiudi,
}: {
  dati: Dati
  sessioneId: string
  onPresenti?: (n: number) => void
  soloDi?: string
  onSegnalate?: () => void
  /** Sul telefono: torna al calendario. */
  onIndietro?: () => void
  /** Dopo CHIUDI L'APPELLO, col nome del corso. */
  onChiudi?: (corso: string) => void
}) {
  const [d, setD] = useState<DettaglioSessione | null>(null)
  const [segnalate, setSegnalate] = useState<SegnalataVista[]>([])
  const [guaioSegnalata, setGuaioSegnalata] = useState<string | null>(null)
  useEffect(() => {
    let vivo = true
    void dati.segnalate?.(soloDi).then(
      (l) => vivo && setSegnalate(l.filter((x) => x.sessioneId === sessioneId && x.stato === 'da_vedere')),
      () => {},
    )
    return () => {
      vivo = false
    }
  }, [dati, sessioneId, soloDi])

  const gestisci = async (x: SegnalataVista, accogli: boolean) => {
    setGuaioSegnalata(null)
    try {
      await dati.gestisciSegnalata?.(x.id, accogli, soloDi)
      setSegnalate((l) => l.filter((y) => y.id !== x.id))
      if (accogli) setD((v) => v && { ...v, elenco: v.elenco.map((p) => (p.id === x.personaId ? { ...p, stato: 'presente' } : p)) })
      onSegnalate?.()
    } catch (e) {
      setGuaioSegnalata(e instanceof Error ? e.message : 'Non è andata: riprova')
    }
  }
  const [guaio, setGuaio] = useState<string | null>(null)
  const [conProve, setConProve] = useState(false)
  const prove = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (conProve) prove.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [conProve])

  const ricarica = useCallback(() => {
    let vivo = true
    dati
      .dettaglio(sessioneId)
      .then((x) => vivo && (x ? setD(x) : setGuaio('Questa lezione non esiste più')))
      .catch((e: unknown) => vivo && setGuaio(e instanceof Error ? e.message : 'Non riesco a leggere la lezione'))
    return () => {
      vivo = false
    }
  }, [dati, sessioneId])

  useEffect(ricarica, [ricarica])

  const presenti = d?.elenco.filter((p) => p.stato === 'presente').length
  useEffect(() => {
    if (presenti !== undefined) onPresenti?.(presenti)
    // Si avvisa quando cambia il conto, non quando cambia chi ascolta.
  }, [presenti])

  if (guaio) {
    return (
      <div className="pad" style={{ paddingTop: 20 }}>
        <div className="card stack" style={{ padding: 14, gap: 6, borderColor: 'var(--rosso)' }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.2em', color: 'var(--rosso)' }}>LEZIONE NON LETTA</span>
          <span style={{ fontSize: 14, color: 'var(--dim)' }}>{guaio}</span>
        </div>
      </div>
    )
  }
  if (!d) return <p className="pad" style={{ color: 'var(--dim)', paddingTop: 20 }}>Sto leggendo la lezione…</p>

  const segnati = d.elenco.filter((p) => p.stato !== null).length
  const iscritti = d.elenco.filter((p) => !p.prova)
  const inProva = d.elenco.filter((p) => p.prova)

  // presente → assente → non segnato, e si ricomincia.
  const prossimo = (s: StatoPresenza | null): StatoPresenza | null =>
    s === null ? 'presente' : s === 'presente' ? 'assente' : null

  const tocca = (personaId: string, stato: StatoPresenza | null) => {
    // Si aggiorna subito quello che si vede: la scrittura viaggia per conto suo
    // e, senza rete, aspetta in coda. Chi fa l'appello non deve aspettare un
    // server per toccare il nome dopo.
    setD((v) => v && { ...v, elenco: v.elenco.map((p) => (p.id === personaId ? { ...p, stato } : p)) })
    void dati.segna(sessioneId, personaId, stato)
  }

  // Solo chi non è ancora segnato: le assenze già messe restano.
  const tuttiGliAltri = () => {
    if (segnati === 0) {
      setD((v) => v && { ...v, elenco: v.elenco.map((p) => ({ ...p, stato: 'presente' })) })
      void dati.segnaTutti(sessioneId, 'presente')
    } else for (const p of d.elenco) if (p.stato === null) tocca(p.id, 'presente')
  }

  const aggiungiProva = async (chi: ChiProva) => {
    const p = await dati.aggiungiProva(sessioneId, chi)
    setD((v) => v && (v.elenco.some((x) => x.id === p.id) ? v : { ...v, elenco: [...v.elenco, { ...p, stato: 'presente', prova: true }] }))
  }

  const togliProva = (personaId: string) => {
    setD((v) => v && { ...v, elenco: v.elenco.filter((p) => p.id !== personaId) })
    void dati.togliProva(sessioneId, personaId)
  }

  const azzera = () => {
    setD((v) => v && { ...v, elenco: v.elenco.map((p) => ({ ...p, stato: null })) })
    for (const p of d.elenco) if (p.stato !== null) void dati.segna(sessioneId, p.id, null)
  }

  // Chiudere vuol dire che chi non è segnato non c'era: così in segreteria
  // l'appello risulta FATTO, e non lasciato a metà.
  const chiudi = () => {
    for (const p of d.elenco) if (p.stato === null) tocca(p.id, 'assente')
    onChiudi?.(d.sessione.corso)
  }

  const daSegnare = d.elenco.length - segnati

  return (
    <>
      {/* In cima e ferma mentre si scorre l'elenco: quale lezione, quanti
          sono, e il gesto più frequente, sempre sotto il pollice. */}
      <div className="appello-testa">
        <div className="row pad" style={{ gap: 10, paddingTop: 12 }}>
          {onIndietro && (
            <button className="icon-btn" onClick={onIndietro} aria-label="Torna al calendario">
              <Back />
            </button>
          )}
          <span className="stack grow" style={{ gap: 3, minWidth: 0 }}>
            <span className="ob appello-titolo">{d.sessione.corso.toUpperCase()}</span>
            <span className="chi-kanji" style={{ fontSize: 13, color: 'var(--dim)' }}>
              <Kanji segni={d.sessione.kanji} />
              <span>
                {[`${giornoPerEsteso(d.sessione.inizio)} ${oraDi(d.sessione.inizio)}`, d.sessione.sala, soloDi ? undefined : d.sessione.istruttore]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            </span>
          </span>
          {/* Il timer della lezione: si apre con i timer del corso in cima. */}
          <a className="icon-btn" href={timerDellaLezione(d.sessione)} aria-label="Apri il timer della lezione" title="Il timer della lezione">
            <Cronometro size={20} />
          </a>
        </div>

        <div className="row pad" style={{ gap: 10, paddingTop: 12, alignItems: 'baseline' }}>
          <span className="num conto-appello">{presenti}</span>
          <span className="num" style={{ fontSize: 22, color: 'var(--dim)' }}>/ {d.elenco.length}</span>
          <span className="grow" />
          <span className="num appello-stato" data-fatto={daSegnare === 0}>
            {daSegnare === 0 ? '✓ TUTTI SEGNATI' : `${daSegnare} DA SEGNARE`}
          </span>
        </div>
        <div className="row pad" style={{ gap: 8, paddingTop: 10 }}>
          <button className="btn btn-go grow" style={{ minHeight: 48, fontSize: 15, padding: '0 12px' }} disabled={daSegnare === 0} onClick={tuttiGliAltri}>
            {segnati === 0 ? 'TUTTI PRESENTI' : 'GLI ALTRI PRESENTI'}
          </button>
          <Azzera disabled={segnati === 0} onAzzera={azzera} />
        </div>
      </div>

      {segnalate.length > 0 && (
        <>
          <div className="rule">
            <span className="rule-label" style={{ color: 'var(--giallo-testo)' }}>DICONO DI ESSERCI STATI</span>
            <div className="rule-line" />
            <span className="num" style={{ fontSize: 15, fontWeight: 600, color: 'var(--dim)' }}>{segnalate.length}</span>
          </div>
          <div className="pad stack" style={{ gap: 8 }}>
            {segnalate.map((x) => (
              <div key={x.id} className="card stack segnalata">
                <span className="stack" style={{ gap: 2 }}>
                  <span style={{ fontSize: 16, fontWeight: 600 }}>{perEsteso(x)}</span>
                  <span style={{ fontSize: 13, color: 'var(--dim)' }}>
                    {x.nota ? `«${x.nota}»` : 'Nessuna nota.'} Nell’appello: {x.segno === 'assente' ? 'assente' : 'non segnato'}.
                  </span>
                </span>
                <span className="row" style={{ gap: 8 }}>
                  <button type="button" className="btn btn-go grow" style={{ minHeight: 44, fontSize: 14 }} onClick={() => void gestisci(x, true)}>
                    C’ERA: PRESENTE
                  </button>
                  <button type="button" className="btn btn-ghost" style={{ minHeight: 44, fontSize: 14, padding: '0 14px' }} onClick={() => void gestisci(x, false)}>
                    RIFIUTA
                  </button>
                </span>
              </div>
            ))}
            {guaioSegnalata && <span style={{ fontSize: 14, color: 'var(--rosso)' }}>{guaioSegnalata}</span>}
          </div>
        </>
      )}

      <div className="rule">
        <span className="rule-label">ISCRITTI</span>
        <div className="rule-line" />
        <span className="num" style={{ fontSize: 15, fontWeight: 600, color: 'var(--dim)' }}>{iscritti.length}</span>
      </div>

      {segnati === 0 && <p className="pad appello-aiuto">Tocca un nome: presente, poi assente, poi di nuovo da segnare.</p>}
      <div className="pad elenco-appello">
        {iscritti.map((p) => (
          <button
            key={p.id}
            className="riga-appello"
            data-stato={p.stato ?? 'niente'}
            onClick={() => tocca(p.id, prossimo(p.stato))}
            aria-label={`${perEsteso(p)}: ${p.stato ?? 'non segnato'}`}
          >
            <span className="segno" aria-hidden="true">
              {p.stato === 'presente' ? '✓' : p.stato === 'assente' ? '✕' : ''}
            </span>
            <span className="nome-appello grow">{perEsteso(p)}</span>
          </button>
        ))}
      </div>

      {inProva.length > 0 && (
        <>
          <div className="rule">
            <span className="rule-label">PROVE</span>
            <div className="rule-line" />
            <span className="num" style={{ fontSize: 15, fontWeight: 600, color: 'var(--dim)' }}>{inProva.length}</span>
          </div>
          <div className="pad elenco-appello">
            {inProva.map((p) => (
              <div key={p.id} className="riga-prova">
                <button
                  className="riga-appello"
                  data-stato={p.stato ?? 'niente'}
                  onClick={() => tocca(p.id, prossimo(p.stato))}
                  aria-label={`${perEsteso(p)}, in prova: ${p.stato ?? 'non segnato'}`}
                >
                  <span className="segno" aria-hidden="true">
                    {p.stato === 'presente' ? '✓' : p.stato === 'assente' ? '✕' : ''}
                  </span>
                  <span className="nome-appello grow">{perEsteso(p)}</span>
                  <MarchioProva />
                </button>
                <TogliProva chi={perEsteso(p)} onTogli={() => togliProva(p.id)} />
              </div>
            ))}
          </div>
        </>
      )}

      {/* Chi viene a provare si aggiunge in fondo, dove entra: l'elenco resta
          dov'è, e la tastiera non lo copre. */}
      <div className="pad" ref={prove} style={{ paddingTop: 4 }}>
        {conProve ? (
          <PannelloProve
            stile="app"
            cerca={() => dati.provati()}
            giaQui={new Set(d.elenco.map((p) => p.id))}
            onAggiungi={aggiungiProva}
            onChiudi={() => setConProve(false)}
          />
        ) : (
          <button type="button" className="btn btn-dashed" style={{ minHeight: 52, fontSize: 16 }} onClick={() => setConProve(true)}>
            + AGGIUNGI CHI PROVA
          </button>
        )}
      </div>

      {onChiudi && (
        <div className="pad stack appello-fine">
          <button type="button" className="btn btn-primary" onClick={chiudi}>
            CHIUDI L’APPELLO
          </button>
          <span className="appello-aiuto">
            {daSegnare === 0
              ? 'Torna al calendario. Se c’è rete parte subito, se no appena torna.'
              : `${daSegnare === 1 ? 'Chi non è segnato risulta assente' : `I ${daSegnare} non segnati risultano assenti`}. Si può sempre riaprire e correggere.`}
          </span>
        </div>
      )}
    </>
  )
}

/**
 * AZZERA toglie tutti i segni: due tocchi, come TOGLI nelle prove. Il primo
 * chiede, il secondo azzera, e senza il secondo dopo qualche secondo torna
 * com'era. Accanto a TUTTI PRESENTI, con le mani sudate, uno solo è troppo poco.
 */
function Azzera({ disabled, onAzzera }: { disabled: boolean; onAzzera: () => void }) {
  const [sicuro, setSicuro] = useState(false)
  useEffect(() => {
    if (!sicuro) return
    const t = window.setTimeout(() => setSicuro(false), 4000)
    return () => window.clearTimeout(t)
  }, [sicuro])
  return (
    <button
      type="button"
      className="btn btn-ghost azzera"
      data-sicuro={sicuro}
      disabled={disabled}
      onClick={() => {
        if (!sicuro) return setSicuro(true)
        setSicuro(false)
        onAzzera()
      }}
    >
      {sicuro ? 'SICURO? AZZERA' : 'AZZERA'}
    </button>
  )
}
