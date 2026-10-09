import { useCallback, useEffect, useRef, useState } from 'react'
import { righeIstruttori, type Dati, type IstruttoreLezione } from '../lib/dati'
import type { DettaglioSessione, SessioneVista, StatoPresenza } from '../lib/sala'
import { cercaNellElenco, giornoPerEsteso, oraDi, perEsteso } from '../lib/sala'
import { Back, Cronometro } from './Icons'
import { Kanji } from './Kanji'
import type { ChiProva } from '../lib/prove'
import { MarchioProva, TogliProva } from './Prove'
import { CercaPersona } from './CercaPersona'
import { DueTocchi, EtichettaAttivita } from './ds'
import { vociAttivita } from '../lib/segreteria'
import type { SegnalataVista } from '../lib/segnalate'

/**
 * Cosa si fa in questa lezione, scelto fra le attività della palestra: lo
 * cambia chi la fa, solo per questa lezione. Senza attività da offrire non compare.
 */
function CambiaAttivita({ dati, sessione, onCambiata }: { dati: Dati; sessione: SessioneVista; onCambiata: () => void }) {
  const [elenco, setElenco] = useState<Array<{ id: string; nome: string }>>([])
  const [guaio, setGuaio] = useState<string | null>(null)
  useEffect(() => {
    let vivo = true
    // Se l'elenco non arriva il menu non compare: non c'è niente da dire a chi sta facendo l'appello.
    dati.attivita().then((l) => vivo && setElenco(l), () => {})
    return () => {
      vivo = false
    }
  }, [dati])
  // L'elenco è delle sole attività in uso e la lezione ne porta il nome: la voce
  // di una già tolta dall'uso si ricava dal nome, e non si può scegliere.
  const attuale = elenco.find((a) => a.nome === sessione.attivita)
  const corrente = attuale?.id ?? (sessione.attivita ? FUORI : null)
  const voci = vociAttivita(
    [...elenco.map((a) => ({ ...a, attiva: true })), ...(corrente === FUORI ? [{ id: FUORI, nome: sessione.attivita ?? '', attiva: false }] : [])],
    corrente,
  )
  if (!voci.length) return null
  return (
    <div className="pad stack" style={{ gap: 4, paddingTop: 12 }}>
      <label htmlFor="appello-attivita" className="sg-etichetta">
        ATTIVITÀ DI QUESTA LEZIONE
      </label>
      <select
        id="appello-attivita"
        className="campo"
        style={{ minHeight: 44 }}
        value={corrente ?? ''}
        onChange={async (e) => {
          setGuaio(null)
          try {
            await dati.cambiaAttivita(sessione.id, e.target.value || null)
            onCambiata()
          } catch (er) {
            // I testi di chi sta sotto sono già per chi usa l'app; «controlla la connessione» solo se non ce n'è uno.
            setGuaio(er instanceof Error && er.message ? er.message : 'Non sono riuscito a cambiare l’attività: controlla la connessione e riprova.')
          }
        }}
      >
        <option value="">Nessuna attività</option>
        {voci.map((a) => (
          <option key={a.id} value={a.id} disabled={a.fuoriUso}>
            {a.nome}
            {a.fuoriUso ? ' (non più in uso)' : ''}
          </option>
        ))}
      </select>
      <span style={{ fontSize: 13, color: 'var(--dim)' }}>Cambia solo questa lezione.</span>
      {guaio && (
        <span role="alert" style={{ fontSize: 13, color: 'var(--rosso-testo)' }}>
          {guaio}
        </span>
      )}
    </div>
  )
}

const FUORI = 'fuori'

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
  onTimer,
  onAttivitaCambiata,
  onIndietro,
  onChiudi,
  inCoda = 0,
}: {
  dati: Dati
  sessioneId: string
  onConto?: (c: Conto) => void
  soloDi?: string
  onSegnalate?: () => void
  /** Apre il timer della lezione, dentro l'app: senza, il cronometro non c'è. */
  onTimer?: (l: SessioneVista) => void
  /** L'istruttore ha cambiato l'attività di questa lezione: il calendario va riletto. */
  onAttivitaCambiata?: () => void
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
  // La pagina «Aggiungi chi prova» al posto dell'appello: lo stato resta qui
  // (i segni, la coda, i conti), ma la schermata si ridisegna da capo, e
  // tornando senza aver aggiunto nessuno lo scorrimento riparte dall'alto.
  const [aggiungendo, setAggiungendo] = useState(false)
  // Chi è appena entrato in PROVE: si vede un attimo, per sapere che ha funzionato.
  const [appena, setAppena] = useState<{ id: string; testo: string } | null>(null)
  const rigaAppena = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!appena) return
    // Una volta sola, quando entra: toccando un'altra riga l'elenco non deve tornare qui.
    rigaAppena.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    const t = window.setTimeout(() => setAppena(null), 8000)
    return () => window.clearTimeout(t)
  }, [appena])

  const [giro, setGiro] = useState(0)
  // Per trovare qualcuno senza scorrere: restringe solo quel che si vede, i
  // conti e i tasti della testa restano sull'appello intero.
  const [cerca, setCerca] = useState('')
  // Per una lezione passata, i non segnati di quando la si apre vanno in cima:
  // si recupera un appello senza cercarli fra gli altri. L'ordine si decide una
  // volta sola, così non cambia sotto il dito mentre li si segna.
  const primi = useRef<Set<string> | null>(null)
  const toccataIl = useRef(new Map<string, number>())
  const fine = useRef<HTMLDivElement>(null)
  const vaiAChiudere = () => {
    fine.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    fine.current?.querySelector('button')?.focus({ preventScroll: true })
  }
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

  // Gli istruttori della lezione, per segnare il collega che insegnava con te.
  // Se non si leggono (niente rete, database da aggiornare) la parte non c'è.
  const [istruttori, setIstruttori] = useState<IstruttoreLezione[]>([])
  const [guaioIstruttore, setGuaioIstruttore] = useState<string | null>(null)
  useEffect(() => {
    let vivo = true
    if (soloDi) dati.istruttoriLezione(sessioneId).then((l) => vivo && setIstruttori(l), () => {})
    return () => {
      vivo = false
    }
  }, [dati, sessioneId, soloDi, giro])
  const toccaIstruttore = (id: string, presente: boolean) => {
    setGuaioIstruttore(null)
    setIstruttori((v) => v.map((x) => (x.id === id ? (presente ? { ...x, stato: 'confermata', come: 'collega', segnataDa: soloDi } : { ...x, stato: undefined, come: undefined, segnataDa: undefined }) : x)))
    dati.segnaCollega(sessioneId, id, presente).catch((e: unknown) => {
      setGuaioIstruttore(e instanceof Error && e.message ? `Non l’ho segnato: ${e.message}.` : 'Non l’ho segnato: riprova.')
      setGiro((g) => g + 1)
    })
  }

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
  const iscrittiTrovati = cercaNellElenco(inOrdine, cerca)
  const proveTrovate = cercaNellElenco(inProva, cerca)
  const cercando = cerca.trim() !== ''

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
  // quando nessun iscritto c'è e sono tutti segnati assenti: allora le ✕ sono
  // di una chiusura sbagliata. Solo gli iscritti: chi prova entra presente, e
  // contandolo il recupero spariva proprio dopo aver aggiunto una prova.
  const tuttiAssenti = iscritti.length > 0 && iscritti.every((p) => p.stato === 'assente')
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
    // Una ricerca ancora scritta nascondrebbe chi è appena entrato.
    setCerca('')
    setAppena({ id: p.id, testo: `${perEsteso(p)}: aggiunto, e segnato presente.` })
    setAggiungendo(false)
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

  if (aggiungendo) {
    const giaQui = new Map<string, 'iscritto' | 'prova'>(d.elenco.map((p) => [p.id, p.prova ? 'prova' : 'iscritto']))
    return <CercaPersona dati={dati} lezione={d.sessione.corso} giaQui={giaQui} onAggiungi={aggiungiProva} onIndietro={() => setAggiungendo(false)} />
  }

  return (
    <>
      {/* In cima e ferma mentre si scorre l'elenco: quale lezione, quanti
          sono, e il gesto più frequente, sempre sotto il pollice. */}
      <div className="appello-testa">
        <div className="row pad" style={{ gap: 10, paddingTop: 12 }}>
          {onIndietro && (
            <DueTocchi className="icon-btn" etichetta="Torna al calendario" onFai={onIndietro}>
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
            {/* Il nome intero, qui c'è posto: nel calendario si accorcia. */}
            <EtichettaAttivita nome={d.sessione.attivita} intera />
            {/* Si può già segnare (chi lo sa prima, un recupero), ma si vede. */}
            {futura && <span className="num appello-futura">NON ANCORA COMINCIATA</span>}
          </span>
          {/* Il timer della lezione: si apre con i timer del corso in cima. */}
          {/* Dentro l'app: l'appello resta montato sotto, e tornando è dov'era. */}
          {onTimer && (
            <button type="button" className="icon-btn" onClick={() => onTimer(d.sessione)} aria-label="Apri il timer della lezione" title="Il timer della lezione">
              <Cronometro size={20} />
            </button>
          )}
        </div>

        <div className="row pad" style={{ gap: 10, paddingTop: 12, alignItems: 'baseline' }}>
          <span className="num conto-appello">{presentiIscritti}</span>
          <span className="num" style={{ fontSize: 22, color: 'var(--dim)' }}>/ {iscritti.length}</span>
          {presentiProve > 0 && <span className="num appello-prove">+{presentiProve} PROVA</span>}
          <span className="grow" />
          <span className="stack" style={{ alignItems: 'flex-end', gap: 2, alignSelf: 'center' }}>
            {/* Con tutti segnati il tasto qui sotto lo dice già: qui il passo dopo. */}
            {tuttiSegnati && !tuttiAssenti && onChiudi ? (
              // Si legge come un invito, e allora si tocca: porta al tasto in fondo.
              <button type="button" className="num appello-stato appello-vai" data-fatto="true" onClick={vaiAChiudere}>
                CHIUDI IN FONDO ↓
              </button>
            ) : (
              <span className="num appello-stato" data-fatto={tuttiSegnati && !tuttiAssenti} data-manca={tuttiAssenti || undefined}>
                {tuttiAssenti ? 'TUTTI ASSENTI' : tuttiSegnati ? '✓ TUTTI SEGNATI' : mancano ? `${mancano} DA SEGNARE` : `${proveMancano} PROVA DA SEGNARE`}
              </span>
            )}
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

      {soloDi && d.sessione.insegnanti?.includes(soloDi) && <CambiaAttivita dati={dati} sessione={d.sessione} onCambiata={() => {
        setGiro((g) => g + 1)
        onAttivitaCambiata?.()
      }} />}

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
      <div className="pad" style={{ paddingBottom: 10 }}>
        <label htmlFor="appello-cerca" className="sg-etichetta">
          CERCA PER NOME O COGNOME
        </label>
        <input
          id="appello-cerca"
          className="campo"
          style={{ minHeight: 44, width: '100%', marginTop: 4 }}
          type="search"
          autoComplete="off"
          autoCorrect="off"
          value={cerca}
          onChange={(e) => setCerca(e.target.value)}
        />
        {cercando && (
          <span role="status" style={{ fontSize: 13, color: 'var(--dim)' }}>
            {iscrittiTrovati.length + proveTrovate.length
              ? `${iscrittiTrovati.length} su ${iscritti.length} iscritti${proveTrovate.length ? ` · ${proveTrovate.length} in prova` : ''}`
              : 'Nessuno si chiama così: controlla come è scritto.'}
          </span>
        )}
      </div>

      <p className="pad appello-aiuto">Un tocco sul nome: presente, poi assente, poi di nuovo da segnare.</p>
      <div className="pad elenco-appello">
        {iscrittiTrovati.map((p) => (
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

      {proveTrovate.length > 0 && (
        <>
          <div className="rule">
            <span className="rule-label">PROVE</span>
            <div className="rule-line" />
            <span className="num" style={{ fontSize: 15, fontWeight: 600, color: 'var(--dim)' }}>{proveTrovate.length}</span>
          </div>
          {appena && (
            <p className="pad prove-fatto" role="status" style={{ margin: '0 0 8px' }}>
              {appena.testo}
            </p>
          )}
          <div className="pad elenco-appello">
            {proveTrovate.map((p) => (
              <div
                key={p.id}
                className="riga-prova"
                data-appena={p.id === appena?.id}
                ref={p.id === appena?.id ? rigaAppena : undefined}
              >
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

      {/* Chi viene a provare si cerca fra tutte le persone in una pagina a
          parte (`CercaPersona`); qui sotto il tasto, in fondo, dove entra. */}
      <div className="pad" style={{ paddingTop: 4 }}>
        <button type="button" className="btn btn-dashed" style={{ minHeight: 52, fontSize: 16 }} onClick={() => setAggiungendo(true)}>
          + AGGIUNGI CHI PROVA
        </button>
      </div>

      {righeIstruttori(istruttori, soloDi).length > 0 && (
        <>
          <div className="rule">
            <span className="rule-label">ISTRUTTORI</span>
            <div className="rule-line" />
            <span className="num" style={{ fontSize: 15, fontWeight: 600, color: 'var(--dim)' }}>{istruttori.length}</span>
          </div>
          <p className="pad appello-aiuto">
            {righeIstruttori(istruttori, soloDi).some((x) => x.tocco === 'togli')
              ? 'Un altro tocco lo toglie, finché la segreteria non l’ha guardato.'
              : 'Chi insegnava con te e non si è segnato: un tocco e risulta presente.'}
          </p>
          {guaioIstruttore && (
            <p className="pad" role="alert" style={{ margin: '0 0 8px', fontSize: 14, color: 'var(--rosso-testo)' }}>
              {guaioIstruttore}
            </p>
          )}
          <div className="pad elenco-appello">
            {righeIstruttori(istruttori, soloDi).map((x) => (
              <button
                key={x.id}
                type="button"
                className="riga-appello"
                data-stato={x.segnato ? 'presente' : 'niente'}
                disabled={!x.tocco}
                onClick={() => x.tocco && toccaIstruttore(x.id, x.tocco === 'segna')}
                aria-label={`${x.nome}${x.tu ? ', tu' : ''}: ${x.segnato ? 'presente' : 'non segnato'}`}
              >
                <span className="segno" aria-hidden="true">{x.segnato ? '✓' : ''}</span>
                <span className="nome-appello grow">{x.tu ? `${x.nome} · tu` : x.nome}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {onChiudi && (
        <div className="pad stack appello-fine" ref={fine}>
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

