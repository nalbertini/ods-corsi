import { useCallback, useEffect, useMemo, useState } from 'react'
import { dati as caricaDati } from '../lib/dati'
import { type Collegamenti, type DatiMieiTimer, NOMI_MODO, type TimerDaScegliere, datiMieiTimer } from '../lib/mieiTimer'
import { type SessioneVista, chiaveGiorno, giornoPerEsteso, oraDi } from '../lib/sala'

/** Quanti giorni di lezioni si preparano: due settimane, come si programma in palestra. */
const GIORNI = 14

/**
 * I MIEI TIMER: quale timer parte con i corsi e con le singole lezioni
 * dell'istruttore (vedi `lib/mieiTimer.ts`).
 *
 * I corsi sono quelli delle sue lezioni delle prossime settimane, le lezioni
 * quelle dei prossimi quattordici giorni: non serve un elenco a parte, e
 * così un corso che non fa più non resta in mezzo. `soloDi` come nel
 * calendario; senza, sono tutte (la segreteria).
 */
export function MieiTimer({ soloDi, onTimer }: { soloDi?: string; onTimer: () => void }) {
  const [d, setD] = useState<DatiMieiTimer | null>(null)
  const [timer, setTimer] = useState<TimerDaScegliere[] | null>(null)
  const [col, setCol] = useState<Collegamenti | null>(null)
  const [lezioni, setLezioni] = useState<SessioneVista[] | null>(null)
  const [guaio, setGuaio] = useState<string | null>(null)
  const [detto, setDetto] = useState<string | null>(null)
  // Le singole lezioni sono l'eccezione: si vedono quelle che hanno già un
  // timer loro, e le altre solo a chi le chiede.
  const [tutte, setTutte] = useState(false)

  const leggi = useCallback(async (x: DatiMieiTimer) => {
    const [t, c] = await Promise.all([x.timer(), x.collegamenti()])
    setTimer(t)
    setCol(c)
  }, [])

  useEffect(() => {
    let vivo = true
    const da = new Date()
    da.setHours(0, 0, 0, 0)
    const a = new Date(da)
    // I corsi da quattro settimane di lezioni, le lezioni da due.
    a.setDate(a.getDate() + 27)
    Promise.all([datiMieiTimer(soloDi), caricaDati().then((x) => x.calendario(da, a))])
      .then(async ([x, l]) => {
        if (!vivo) return
        setD(x)
        setLezioni(l.filter((s) => !soloDi || s.insegnanti?.includes(soloDi)))
        await leggi(x)
      })
      .catch((e: unknown) => vivo && setGuaio(e instanceof Error ? e.message : 'Non riesco a leggere i timer'))
    return () => {
      vivo = false
    }
  }, [soloDi, leggi])

  useEffect(() => {
    if (!detto) return
    const t = window.setTimeout(() => setDetto(null), 2500)
    return () => window.clearTimeout(t)
  }, [detto])

  const fai = async (f: () => Promise<void>, fatto: string) => {
    if (!d) return
    setGuaio(null)
    try {
      await f()
      await leggi(d)
      setDetto(fatto)
    } catch (e) {
      setGuaio(e instanceof Error ? e.message : 'Non è andata')
    }
  }

  const perId = useMemo(() => new Map((timer ?? []).map((t) => [t.id, t])), [timer])
  const sceglibili = (timer ?? []).filter((t) => t.sceglibile)
  const nome = (id: string) => perId.get(id)?.nome ?? 'Timer di un collega'

  const corsi = useMemo(() => {
    const m = new Map<string, { id: string; nome: string; colore?: string }>()
    for (const l of lezioni ?? []) if (!m.has(l.corsoId)) m.set(l.corsoId, { id: l.corsoId, nome: l.corso, colore: l.colore })
    return [...m.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'it'))
  }, [lezioni])

  const perGiorno = useMemo(() => {
    const fino = new Date()
    fino.setHours(0, 0, 0, 0)
    fino.setDate(fino.getDate() + GIORNI)
    const adesso = Date.now()
    const m = new Map<string, SessioneVista[]>()
    for (const l of lezioni ?? []) {
      const inizio = new Date(l.inizio)
      if (inizio >= fino || new Date(l.fine).getTime() < adesso || l.stato === 'annullata') continue
      const g = chiaveGiorno(inizio)
      m.set(g, [...(m.get(g) ?? []), l])
    }
    return [...m.entries()]
  }, [lezioni])

  const pronto = timer && col && lezioni
  const conSuoi = (l: SessioneVista) => (col?.lezioni[l.id]?.length ?? 0) > 0
  const visibili = tutte ? perGiorno : perGiorno.map(([g, ls]) => [g, ls.filter(conSuoi)] as const).filter(([, ls]) => ls.length > 0)
  const quanteAltre = perGiorno.reduce((n, [, ls]) => n + ls.filter((l) => !conSuoi(l)).length, 0)

  return (
    <div className="miei-timer">
      <div className="row pad" style={{ gap: 10, paddingTop: 16, alignItems: 'center' }}>
        <span className="ob grow appello-titolo" style={{ whiteSpace: 'nowrap' }}>
          I MIEI TIMER
        </span>
        <button type="button" className="btn btn-ghost miei-timer-apri" onClick={onTimer}>
          APRI IL TIMER
        </button>
      </div>
      <p className="pad passo-dettaglio" style={{ fontSize: 15, margin: '10px 0 0' }}>
        Scegli quale timer parte con ogni tuo corso, dall’appello e sul tablet di sala. Se una lezione ne vuole uno diverso,
        lo scegli più sotto. I timer si creano e si cambiano nel timer.
      </p>

      {guaio && (
        <div className="pad" style={{ paddingTop: 14 }}>
          <div className="card stack" style={{ padding: 14, gap: 6, borderColor: 'var(--rosso)' }}>
            <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.2em', color: 'var(--rosso-testo)' }}>NON È ANDATA</span>
            <span style={{ fontSize: 14, color: 'var(--dim)' }}>{guaio}</span>
          </div>
        </div>
      )}
      {!pronto && !guaio && <p className="pad" style={{ color: 'var(--dim)' }}>Sto leggendo i timer…</p>}

      {pronto && sceglibili.length === 0 && (
        <p className="pad passo-dettaglio" style={{ fontSize: 15 }} data-tono="avviso">
          Non hai ancora timer da scegliere: creane uno nel timer, fra i tuoi o della palestra, e torna qui.
        </p>
      )}

      {pronto && (
        <>
          <div className="rule">
            <span className="rule-label">PER CORSO</span>
            <div className="rule-line" />
            <span className="rule-conto num">{corsi.length}</span>
          </div>
          <div className="pad stack" style={{ gap: 10 }}>
            {corsi.length === 0 && <p className="passo-dettaglio" style={{ margin: 0, fontSize: 15 }}>Nessun corso nelle prossime settimane.</p>}
            {corsi.map((c) => (
              <div key={c.id} className="card miei-timer-riga" style={{ ['--tinta' as string]: c.colore ?? 'var(--blu)' }}>
                <span className="ob lezione-nome">{c.nome.toUpperCase()}</span>
                <Collegati
                  suoi={col.corsi[c.id] ?? []}
                  vuoto="Nessun timer"
                  di={c.nome}
                  scegli="+ Collega un timer"
                  timer={timer}
                  onCollega={(id, sì) =>
                    void fai(() => d!.collegaCorso(c.id, id, sì), sì ? 'Timer collegato al corso' : 'Timer tolto dal corso')
                  }
                />
              </div>
            ))}
          </div>

          <div className="rule">
            <span className="rule-label">PER LEZIONE</span>
            <div className="rule-line" />
            <span className="rule-conto">PROSSIMI {GIORNI} GIORNI</span>
          </div>
          {!col.lezioniPronte && (
            <p className="pad passo-dettaglio" data-tono="avviso" style={{ fontSize: 15, marginTop: 0 }}>
              Per ora le singole lezioni usano i timer del corso: la scelta per lezione arriva con un prossimo aggiornamento.
            </p>
          )}
          <div className="pad stack" style={{ gap: 16, paddingBottom: 24 }}>
            {perGiorno.length === 0 && <p className="passo-dettaglio" style={{ margin: 0, fontSize: 15 }}>Nessuna lezione nei prossimi giorni.</p>}
            {visibili.length === 0 && perGiorno.length > 0 && (
              <p className="passo-dettaglio" style={{ margin: 0, fontSize: 15 }}>Tutte le lezioni usano i timer del loro corso.</p>
            )}
            {visibili.map(([g, ls]) => (
              <div key={g} className="stack" style={{ gap: 8 }}>
                <span className="sg-etichetta">{giornoPerEsteso(g).toUpperCase()}</span>
                {ls.map((l) => {
                  const suoi = col.lezioni[l.id] ?? []
                  const delCorso = (col.corsi[l.corsoId] ?? []).map(nome)
                  return (
                    <div
                      key={l.id}
                      className="card miei-timer-riga"
                      data-suo={suoi.length > 0}
                      style={{ ['--tinta' as string]: l.colore ?? 'var(--blu)' }}
                    >
                      <span className="lezione-ora num">{oraDi(l.inizio)}</span>
                      <span className="stack grow" style={{ gap: 3, minWidth: 0, flexBasis: 160 }}>
                        <span className="ob lezione-nome">{l.corso.toUpperCase()}</span>
                        <span style={{ fontSize: 13, color: 'var(--dim)' }}>{[l.sala, l.istruttore].filter(Boolean).join(' · ')}</span>
                      </span>
                      <Collegati
                        suoi={suoi}
                        vuoto={delCorso.length ? `Quelli del corso: ${delCorso.join(', ')}` : 'Quelli del corso (nessuno)'}
                        di={`${l.corso}, ${giornoPerEsteso(g)} alle ${oraDi(l.inizio)}`}
                        scegli="+ Aggiungi un timer"
                        timer={timer}
                        disabilitato={!col.lezioniPronte}
                        onCollega={(id, sì) =>
                          void fai(
                            () => d!.collegaLezione(l.id, id, sì),
                            sì ? 'Timer aggiunto alla lezione' : suoi.length === 1 ? 'La lezione usa i timer del corso' : 'Timer tolto dalla lezione',
                          )
                        }
                      />
                    </div>
                  )
                })}
              </div>
            ))}
            {col.lezioniPronte && quanteAltre > 0 && (
              <button type="button" className="btn btn-dashed" style={{ minHeight: 52, fontSize: 16 }} aria-expanded={tutte} onClick={() => setTutte((x) => !x)}>
                {tutte ? 'MOSTRA SOLO QUELLE DIVERSE' : `SCEGLI PER UNA LEZIONE (${quanteAltre})`}
              </button>
            )}
          </div>
        </>
      )}

      {detto && (
        <div className="miei-timer-detto" role="status">
          {detto} ✓
        </div>
      )}
    </div>
  )
}

/**
 * I timer collegati a un corso o a una lezione, con la × per toglierli, e la
 * scelta per aggiungerne un altro. Si aggiungono i propri e quelli della
 * palestra; quelli di un collega già collegati si vedono e si tolgono.
 */
function Collegati({
  suoi,
  vuoto,
  di,
  scegli,
  timer,
  disabilitato = false,
  onCollega,
}: {
  suoi: string[]
  /** Cosa dire senza timer. */
  vuoto: string
  /** Di chi sono, per chi legge lo schermo: «Judo», «Judo, giovedì alle 18:00». */
  di: string
  scegli: string
  timer: TimerDaScegliere[]
  disabilitato?: boolean
  onCollega: (timerId: string, collegato: boolean) => void
}) {
  const perId = new Map(timer.map((t) => [t.id, t]))
  const nome = (id: string) => perId.get(id)?.nome ?? 'Timer di un collega'
  const altri = timer.filter((t) => t.sceglibile && !suoi.includes(t.id))
  return (
    <>
      <div className="miei-timer-scelti">
        {suoi.length === 0 && <span className="passo-dettaglio">{vuoto}</span>}
        {suoi.map((id) => (
          <span key={id} className="miei-timer-chip">
            {nome(id)}
            {perId.get(id)?.modo && <span className="miei-timer-modo">{NOMI_MODO[perId.get(id)!.modo] ?? ''}</span>}
            <button type="button" aria-label={`Togli ${nome(id)} da ${di}`} disabled={disabilitato} onClick={() => onCollega(id, false)}>
              ×
            </button>
          </span>
        ))}
      </div>
      {altri.length > 0 && (
        <select
          className="campo miei-timer-scelta"
          value=""
          disabled={disabilitato}
          aria-label={`Aggiungi un timer a ${di}`}
          onChange={(e) => {
            if (e.target.value) onCollega(e.target.value, true)
          }}
        >
          <option value="">{scegli}</option>
          {altri.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nome}
            </option>
          ))}
        </select>
      )}
    </>
  )
}
