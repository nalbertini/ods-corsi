import { useCallback, useEffect, useMemo, useState } from 'react'
import { dati as caricaDati } from '../lib/dati'
import { type Collegamenti, type DatiMieiTimer, NOMI_MODO, type TimerDaScegliere, datiMieiTimer } from '../lib/mieiTimer'
import { type SessioneVista, chiaveGiorno, giornoPerEsteso, oraDi } from '../lib/sala'
import { TIMER } from '../lib/aree'
import { Back } from './Icons'

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
export function MieiTimer({ soloDi, onIndietro }: { soloDi?: string; onIndietro?: () => void }) {
  const [d, setD] = useState<DatiMieiTimer | null>(null)
  const [timer, setTimer] = useState<TimerDaScegliere[] | null>(null)
  const [col, setCol] = useState<Collegamenti | null>(null)
  const [lezioni, setLezioni] = useState<SessioneVista[] | null>(null)
  const [guaio, setGuaio] = useState<string | null>(null)
  const [detto, setDetto] = useState<string | null>(null)

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

  return (
    <div className="miei-timer">
      <div className="row pad" style={{ gap: 10, paddingTop: 16, alignItems: 'center' }}>
        {onIndietro && (
          <button className="icon-btn" onClick={onIndietro} aria-label="Torna al calendario">
            <Back />
          </button>
        )}
        <span className="ob grow" style={{ fontSize: 26, fontWeight: 700, letterSpacing: '0.06em' }}>
          I MIEI TIMER
        </span>
        <a className="btn btn-ghost miei-timer-apri" href={TIMER} target="_blank" rel="noopener">
          APRI IL TIMER ↗
        </a>
      </div>
      <p className="pad passo-dettaglio" style={{ fontSize: 15, margin: '10px 0 0' }}>
        I timer si fanno e si cambiano nel timer. Qui scegli quale parte con i tuoi corsi e con le singole lezioni: quello
        di una lezione viene prima di quelli del corso, dall’appello e sul tablet di sala.
      </p>

      {guaio && (
        <div className="pad" style={{ paddingTop: 14 }}>
          <div className="card stack" style={{ padding: 14, gap: 6, borderColor: 'var(--rosso)' }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.2em', color: 'var(--rosso)' }}>NON È ANDATA</span>
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
            {corsi.map((c) => {
              const suoi = col.corsi[c.id] ?? []
              const altri = sceglibili.filter((t) => !suoi.includes(t.id))
              return (
                <div key={c.id} className="card miei-timer-riga" style={{ ['--tinta' as string]: c.colore ?? 'var(--blu)' }}>
                  <span className="ob lezione-nome">{c.nome.toUpperCase()}</span>
                  <div className="miei-timer-scelti">
                    {suoi.length === 0 && <span className="passo-dettaglio">Nessun timer</span>}
                    {suoi.map((id) => (
                      <span key={id} className="miei-timer-chip">
                        {nome(id)}
                        {perId.get(id)?.modo && <span className="miei-timer-modo">{NOMI_MODO[perId.get(id)!.modo] ?? ''}</span>}
                        <button
                          type="button"
                          aria-label={`Togli ${nome(id)} da ${c.nome}`}
                          onClick={() => void fai(() => d!.collegaCorso(c.id, id, false), 'Timer tolto dal corso')}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                  {altri.length > 0 && (
                    <select
                      className="campo miei-timer-scelta"
                      value=""
                      aria-label={`Collega un timer a ${c.nome}`}
                      onChange={(e) => {
                        const id = e.target.value
                        if (id) void fai(() => d!.collegaCorso(c.id, id, true), 'Timer collegato al corso')
                      }}
                    >
                      <option value="">+ Collega un timer</option>
                      {altri.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.nome}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )
            })}
          </div>

          <div className="rule">
            <span className="rule-label">PER LEZIONE</span>
            <div className="rule-line" />
            <span className="rule-conto">PROSSIMI {GIORNI} GIORNI</span>
          </div>
          {!col.lezioniPronte && (
            <p className="pad passo-dettaglio" data-tono="avviso" style={{ fontSize: 15, marginTop: 0 }}>
              Il database non ha ancora i timer delle singole lezioni (`11-timer-lezioni.sql`): per ora valgono quelli
              del corso.
            </p>
          )}
          <div className="pad stack" style={{ gap: 16, paddingBottom: 24 }}>
            {perGiorno.length === 0 && <p className="passo-dettaglio" style={{ margin: 0, fontSize: 15 }}>Nessuna lezione nei prossimi giorni.</p>}
            {perGiorno.map(([g, ls]) => (
              <div key={g} className="stack" style={{ gap: 8 }}>
                <span className="sg-etichetta">{giornoPerEsteso(g).toUpperCase()}</span>
                {ls.map((l) => {
                  const suo = col.lezioni[l.id] ?? ''
                  const delCorso = (col.corsi[l.corsoId] ?? []).map(nome)
                  return (
                    <div key={l.id} className="card miei-timer-riga" style={{ ['--tinta' as string]: l.colore ?? 'var(--blu)' }}>
                      <span className="lezione-ora num">{oraDi(l.inizio)}</span>
                      <span className="stack grow" style={{ gap: 3, minWidth: 0 }}>
                        <span className="ob lezione-nome">{l.corso.toUpperCase()}</span>
                        <span style={{ fontSize: 13, color: 'var(--dim)' }}>{[l.sala, l.istruttore].filter(Boolean).join(' · ')}</span>
                      </span>
                      <select
                        className="campo miei-timer-scelta"
                        value={suo}
                        data-suo={Boolean(suo)}
                        disabled={!col.lezioniPronte || sceglibili.length === 0}
                        aria-label={`Timer di ${l.corso} alle ${oraDi(l.inizio)}`}
                        onChange={(e) =>
                          void fai(
                            () => d!.scegliPerLezione(l.id, e.target.value || null),
                            e.target.value ? 'Timer scelto per la lezione' : 'La lezione usa i timer del corso',
                          )
                        }
                      >
                        <option value="">{delCorso.length ? `Del corso: ${delCorso.join(', ')}` : 'Del corso (nessuno)'}</option>
                        {suo && !perId.get(suo)?.sceglibile && <option value={suo}>{nome(suo)}</option>}
                        {sceglibili.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.nome}
                          </option>
                        ))}
                      </select>
                    </div>
                  )
                })}
              </div>
            ))}
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
