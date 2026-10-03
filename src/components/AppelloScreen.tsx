import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import type { Dati } from '../lib/dati'
import type { DettaglioSessione, SessioneVista, StatoPresenza } from '../lib/sala'
import { domandaIndietro, giornoPerEsteso, oraDi, perEsteso } from '../lib/sala'
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
  onConto,
  soloDi,
  onSegnalate,
  onIndietro,
  onChiudi,
  inCoda = 0,
}: {
  dati: Dati
  sessioneId: string
  onConto?: (c: Conto) => void
  soloDi?: string
  onSegnalate?: () => void
  /** Sul telefono: torna al calendario. */
  onIndietro?: () => void
  /** Dopo CHIUDI L'APPELLO, con la lezione chiusa e com'è finita. */
  onChiudi?: (s: SessioneVista, c: { presenti: number; assenti: number; prove: number }) => void
  /** Le scritture che aspettano la rete: si dicono nella testa, che non cambia altezza. */
  inCoda?: number
}) {
  const [d, setD] = useState<DettaglioSessione | null>(null)
  const [segnalate, setSegnalate] = useState<SegnalataVista[]>([])
  // Quelle gestite restano al loro posto, con l'esito al posto dei tasti: se
  // sparissero, l'elenco sotto salirebbe mentre lo si tocca.
  const [gestite, setGestite] = useState<Record<string, boolean>>({})
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

  // Una segnalata alla volta: un doppio tocco mandava la seconda richiesta
  // prima che finisse la prima, e tornava «è già stata accolta».
  const inViaggio = useRef(new Set<string>())
  const gestisci = async (x: SegnalataVista, accogli: boolean) => {
    if (inViaggio.current.has(x.id)) return
    inViaggio.current.add(x.id)
    setGuaioSegnalata(null)
    try {
      await dati.gestisciSegnalata?.(x.id, accogli, soloDi)
      setGestite((g) => ({ ...g, [x.id]: accogli }))
      if (accogli) setD((v) => v && { ...v, elenco: v.elenco.map((p) => (p.id === x.personaId ? { ...p, stato: 'presente' } : p)) })
      onSegnalate?.()
    } catch (e) {
      setGuaioSegnalata(e instanceof Error ? e.message : 'Non è andata: riprova')
    } finally {
      inViaggio.current.delete(x.id)
    }
  }
  const [guaio, setGuaio] = useState<string | null>(null)
  const [conProve, setConProve] = useState(false)
  // Chi è scritto in PROVE e non aggiunto: tornando al calendario si
  // perderebbe, e la freccia lo chiede prima (`domandaIndietro`).
  const [scritta, setScritta] = useState<string | null>(null)
  const prove = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (conProve) prove.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [conProve])

  const [giro, setGiro] = useState(0)
  // Per una lezione passata, i non segnati di quando la si apre vanno in cima:
  // si recupera un appello senza cercarli fra gli altri. L'ordine si decide una
  // volta sola, così non cambia sotto il dito mentre li si segna.
  const primi = useRef<Set<string> | null>(null)
  const toccataIl = useRef(new Map<string, number>())
  const ricarica = useCallback(() => {
    let vivo = true
    setGuaio(null)
    dati
      .dettaglio(sessioneId)
      .then((x) => vivo && (x ? setD(x) : setGuaio('Questa lezione non esiste più')))
      .catch(() => vivo && setGuaio('Non riesco a leggerla: controlla la connessione e riprova.'))
    return () => {
      vivo = false
    }
  }, [dati, sessioneId, giro])

  useEffect(ricarica, [ricarica])

  const presenti = d?.elenco.filter((p) => p.stato === 'presente').length
  const presentiProve = d?.elenco.filter((p) => p.prova && p.stato === 'presente').length ?? 0
  const iscrittiDaSegnare = d?.elenco.filter((p) => !p.prova && p.stato === null).length ?? 0
  useEffect(() => {
    if (presenti !== undefined) onConto?.({ presenti, prove: presentiProve, daSegnare: iscrittiDaSegnare })
    // Si avvisa quando cambia il conto, non quando cambia chi ascolta.
  }, [presenti, presentiProve, iscrittiDaSegnare])

  if (guaio) {
    return (
      <div className="pad" style={{ paddingTop: 20 }}>
        <div className="card stack" style={{ padding: 14, gap: 6, borderColor: 'var(--rosso)' }}>
          <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.2em', color: 'var(--rosso-testo)' }}>LEZIONE NON LETTA</span>
          <span style={{ fontSize: 14, color: 'var(--dim)' }}>{guaio}</span>
          <button type="button" className="btn btn-ghost" style={{ minHeight: 44, fontSize: 14, padding: '0 14px', alignSelf: 'flex-start' }} onClick={() => setGiro((g) => g + 1)}>
            RIPROVA
          </button>
        </div>
      </div>
    )
  }
  if (!d) return <p className="pad" style={{ color: 'var(--dim)', paddingTop: 20 }}>Sto leggendo la lezione…</p>

  const segnati = d.elenco.filter((p) => p.stato !== null).length
  const iscritti = d.elenco.filter((p) => !p.prova)
  const inProva = d.elenco.filter((p) => p.prova)
  if (!primi.current) {
    const vuoti = iscritti.filter((p) => p.stato === null)
    const passata = new Date(d.sessione.fine).getTime() < Date.now()
    primi.current = new Set(passata && vuoti.length < iscritti.length ? vuoti.map((p) => p.id) : [])
  }
  const prima = primi.current
  const inOrdine = prima.size ? [...iscritti.filter((p) => prima.has(p.id)), ...iscritti.filter((p) => !prima.has(p.id))] : iscritti

  // presente → assente → non segnato, e si ricomincia.
  const prossimo = (s: StatoPresenza | null): StatoPresenza | null =>
    s === null ? 'presente' : s === 'presente' ? 'assente' : null

  // Il secondo tocco veloce sulla stessa riga non conta: con tre stati, un
  // presente toccato due volte «per sicurezza» finiva non segnato.
  const toccaRiga = (personaId: string, stato: StatoPresenza | null) => {
    const ora = Date.now()
    if (ora - (toccataIl.current.get(personaId) ?? 0) < 400) return
    toccataIl.current.set(personaId, ora)
    tocca(personaId, prossimo(stato))
  }

  const tocca = (personaId: string, stato: StatoPresenza | null) => {
    // Si aggiorna subito quello che si vede: la scrittura viaggia per conto suo
    // e, senza rete, aspetta in coda. Chi fa l'appello non deve aspettare un
    // server per toccare il nome dopo.
    setD((v) => v && { ...v, elenco: v.elenco.map((p) => (p.id === personaId ? { ...p, stato } : p)) })
    void dati.segna(sessioneId, personaId, stato)
  }

  // Solo chi non è ancora segnato: le assenze già messe restano. Tranne
  // quando sono tutti assenti: allora le ✕ sono di una chiusura sbagliata.
  const tuttiAssenti = d.elenco.length > 0 && d.elenco.every((p) => p.stato === 'assente')
  const segnatiIscritti = iscritti.filter((p) => p.stato !== null).length
  const tuttiGliAltri = () => {
    if (segnati === 0 || tuttiAssenti) {
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
    // Prima di sparire: l'effetto che lo direbbe non arriva a girare.
    onConto?.({ presenti: presenti ?? 0, prove: presentiProve, daSegnare: 0 })
    onChiudi?.(d.sessione, { presenti: presentiIscritti, assenti: iscritti.length - presentiIscritti, prove: presentiProve })
  }

  // Un conto solo, dappertutto: gli iscritti, e chi prova detto a parte,
  // come sulla scheda del calendario e nell'esito. Chiudendo diventano
  // assenti tutti i non segnati, anche chi prova.
  const tuttiSegnati = segnati === d.elenco.length
  const mancano = iscritti.filter((p) => p.stato === null).length
  const proveMancano = inProva.filter((p) => p.stato === null).length
  const presentiIscritti = iscritti.filter((p) => p.stato === 'presente').length
  const futura = new Date(d.sessione.inizio).getTime() > Date.now()
  const assentiDetti = `${mancano === 1 ? 'UN ASSENTE' : `${mancano} ASSENTI`}${proveMancano ? ` · +${proveMancano} PROVA` : ''}`
  // Quando chiudere vuole un secondo tocco, e cosa chiede: prima di tutto
  // quanti diventerebbero assenti, che è il fatto che conta.
  const domanda =
    segnati === 0 && !tuttiSegnati
      ? `${futura ? 'NON È COMINCIATA' : 'NESSUNO SEGNATO'} · ${assentiDetti}?`
      : futura
        ? tuttiSegnati
          ? 'NON È COMINCIATA: CHIUDI?'
          : `NON È COMINCIATA · ${assentiDetti}?`
        : mancano * 2 > iscritti.length
          ? `SICURO? ${assentiDetti}`
          : undefined

  return (
    <>
      {/* In cima e ferma mentre si scorre l'elenco: quale lezione, quanti
          sono, e il gesto più frequente, sempre sotto il pollice. */}
      <div className="appello-testa">
        <div className="row pad" style={{ gap: 10, paddingTop: 12 }}>
          {onIndietro && (
            <DueTocchi className="icon-btn" chiede={domandaIndietro(scritta)} etichetta="Torna al calendario" onFai={onIndietro}>
              <Back />
            </DueTocchi>
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
            {/* Si può già segnare (chi lo sa prima, un recupero), ma si vede. */}
            {futura && <span className="num appello-futura">NON ANCORA COMINCIATA</span>}
          </span>
          {/* Il timer della lezione: si apre con i timer del corso in cima. */}
          <a className="icon-btn" href={timerDellaLezione(d.sessione)} aria-label="Apri il timer della lezione" title="Il timer della lezione">
            <Cronometro size={20} />
          </a>
        </div>

        <div className="row pad" style={{ gap: 10, paddingTop: 12, alignItems: 'baseline' }}>
          <span className="num conto-appello">{presentiIscritti}</span>
          <span className="num" style={{ fontSize: 22, color: 'var(--dim)' }}>/ {iscritti.length}</span>
          {presentiProve > 0 && <span className="num appello-prove">+{presentiProve} PROVA</span>}
          <span className="grow" />
          <span className="stack" style={{ alignItems: 'flex-end', gap: 2, alignSelf: 'center' }}>
            {/* Con tutti segnati il tasto qui sotto lo dice già: qui il passo dopo. */}
            <span className="num appello-stato" data-fatto={tuttiSegnati && !tuttiAssenti} data-manca={tuttiAssenti || undefined}>
              {tuttiAssenti ? 'TUTTI ASSENTI' : tuttiSegnati ? 'CHIUDI IN FONDO ↓' : mancano ? `${mancano} DA SEGNARE` : `${proveMancano} PROVA DA SEGNARE`}
            </span>
            {/* Sempre al suo posto, anche vuota: la testa non cambia altezza. */}
            <span className="num appello-coda" role="status">
              {inCoda > 0 ? `${inCoda} DA INVIARE` : ''}
            </span>
          </span>
        </div>
        <div className="row pad" style={{ gap: 8, paddingTop: 10 }}>
          {/* Sempre lo stesso tasto: un altro comparso al suo posto (CHIUDI)
              prendeva il secondo tocco di chi ritocca «per sicurezza». Con
              tutti assenti torna TUTTI PRESENTI anche se tutti hanno un
              segno: è l'appello chiuso per sbaglio, riaperto. */}
          <button
            className="btn btn-go grow"
            style={{ fontSize: 17, padding: '0 10px', letterSpacing: '0.1em' }}
            disabled={!d.elenco.length || (tuttiSegnati && !tuttiAssenti)}
            onClick={tuttiGliAltri}
          >
            {segnatiIscritti === 0 || tuttiAssenti ? 'TUTTI PRESENTI' : tuttiSegnati ? '✓ TUTTI SEGNATI' : 'GLI ALTRI PRESENTI'}
          </button>
          <DueTocchi className="btn btn-ghost azzera" disabled={segnati === 0} chiede="SICURO?" onFai={azzera}>
            AZZERA
          </DueTocchi>
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
                {x.id in gestite ? (
                  <span className="row num segnalata-esito" data-accolta={gestite[x.id]}>
                    {gestite[x.id] ? '✓ SEGNATO PRESENTE' : 'RIFIUTATA: RESTA COM’ERA'}
                  </span>
                ) : (
                  <span className="row" style={{ gap: 8 }}>
                    <button type="button" className="btn btn-go grow" style={{ minHeight: 44, fontSize: 14 }} onClick={() => void gestisci(x, true)}>
                      C’ERA: PRESENTE
                    </button>
                    <button type="button" className="btn btn-ghost" style={{ minHeight: 44, fontSize: 14, padding: '0 14px' }} onClick={() => void gestisci(x, false)}>
                      RIFIUTA
                    </button>
                  </span>
                )}
              </div>
            ))}
            {guaioSegnalata && <span style={{ fontSize: 14, color: 'var(--rosso-testo)' }}>{guaioSegnalata}</span>}
          </div>
        </>
      )}

      <div className="rule">
        <span className="rule-label">ISCRITTI</span>
        <div className="rule-line" />
        <span className="num" style={{ fontSize: 15, fontWeight: 600, color: 'var(--dim)' }}>{iscritti.length}</span>
      </div>

      {/* Sempre uguale, anche dopo il primo segno: se sparisse, i nomi
          salirebbero sotto il dito e il tocco dopo andrebbe a un altro. */}
      <p className="pad appello-aiuto">Un tocco sul nome: presente, poi assente, poi di nuovo da segnare.</p>
      <div className="pad elenco-appello">
        {inOrdine.map((p) => (
          <button
            key={p.id}
            className="riga-appello"
            data-stato={p.stato ?? 'niente'}
            onClick={() => toccaRiga(p.id, p.stato)}
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
                  onClick={() => toccaRiga(p.id, p.stato)}
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
            onScritto={setScritta}
          />
        ) : (
          <button type="button" className="btn btn-dashed" style={{ minHeight: 52, fontSize: 16 }} onClick={() => setConProve(true)}>
            + AGGIUNGI CHI PROVA
          </button>
        )}
      </div>

      {/* Col pannello delle prove aperto il suo tasto per chiudere stava sopra
          questo, e si chiamavano uguali: prima si finisce con le prove. */}
      {onChiudi && !conProve && (
        <div className="pad stack appello-fine">
          {/* Verde quando è tutto segnato; rosso quando chiudere vuol dire
              segnare assenti, e il tasto lo dice. Chiede un secondo tocco una
              lezione non ancora cominciata, e una dove nessuno è segnato o
              più di metà diventerebbe assente: di solito è TUTTI PRESENTI
              dimenticato, e la segreteria riceverebbe assenze finte. */}
          <DueTocchi
            className={`btn ${tuttiSegnati ? 'btn-go' : 'btn-primary'}`}
            chiede={domanda}
            onFai={chiudi}
          >
            {tuttiSegnati ? 'CHIUDI L’APPELLO ✓' : `CHIUDI · ${assentiDetti}`}
          </DueTocchi>
          <span className="appello-aiuto">
            {tuttiSegnati
              ? 'Torna al calendario. Se c’è rete parte subito, se no appena torna.'
              : `${d.elenco.length - segnati === 1 ? 'Chi non è segnato risulta assente' : `I ${d.elenco.length - segnati} non segnati risultano assenti`}. Si può sempre riaprire e correggere.`}
          </span>
        </div>
      )}
    </>
  )
}

export interface Conto {
  presenti: number
  prove: number
  daSegnare: number
}

/**
 * Un tasto che, quando `chiede` c'è, vuole due tocchi: il primo mostra la
 * domanda, il secondo fa. Senza il secondo, dopo qualche secondo torna
 * com'era. Come TOGLI nelle prove: AZZERA accanto a TUTTI PRESENTI, con le
 * mani sudate, un tocco solo è troppo poco.
 */
function DueTocchi({
  className,
  chiede,
  disabled,
  etichetta,
  onFai,
  children,
}: {
  className: string
  chiede?: string
  disabled?: boolean
  /** Per un tasto con un'icona: il nome da leggere finché non chiede. */
  etichetta?: string
  onFai: () => void
  children: ReactNode
}) {
  const [sicuro, setSicuro] = useState(false)
  // Il tocco che conferma vale solo se arriva dopo aver letto la domanda: un
  // doppio tocco veloce (le mani sudate, «l'ha preso?») altrimenti la salta.
  const chiestoIl = useRef(0)
  // Lo stesso per un tasto appena comparso al posto di un altro (CHIUDI ✓ al
  // posto di TUTTI PRESENTI): il secondo tocco del doppio tocco non è per lui.
  const natoIl = useRef(Date.now())
  useEffect(() => {
    if (!sicuro) return
    const t = window.setTimeout(() => setSicuro(false), 6000)
    return () => window.clearTimeout(t)
  }, [sicuro])
  // Se intanto non c'è più niente da chiedere, il tasto torna com'era: se no
  // restava vuoto, e il tocco dopo faceva senza domanda.
  useEffect(() => {
    if (!chiede) setSicuro(false)
  }, [chiede])
  return (
    <button
      type="button"
      className={className}
      data-sicuro={sicuro}
      disabled={disabled}
      aria-label={sicuro && chiede ? undefined : etichetta}
      onClick={() => {
        if (chiede && !sicuro) {
          chiestoIl.current = Date.now()
          return setSicuro(true)
        }
        if (Date.now() - natoIl.current < 500) return
        if (chiede && Date.now() - chiestoIl.current < 500) return
        setSicuro(false)
        onFai()
      }}
    >
      {sicuro && chiede ? <span className="due-tocchi-chiede">{chiede}</span> : children}
    </button>
  )
}
