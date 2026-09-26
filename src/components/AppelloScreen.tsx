import { useCallback, useEffect, useState } from 'react'
import type { Dati } from '../lib/dati'
import type { DettaglioSessione, StatoPresenza } from '../lib/sala'
import { giornoPerEsteso, oraDi, perEsteso } from '../lib/sala'

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
 * `onPresenti` dice quanti sono i presenti ogni volta che cambiano, per il
 * calendario che sullo schermo largo sta qui accanto.
 */
export function AppelloScreen({
  dati,
  sessioneId,
  onPresenti,
}: {
  dati: Dati
  sessioneId: string
  onPresenti?: (n: number) => void
}) {
  const [d, setD] = useState<DettaglioSessione | null>(null)
  const [guaio, setGuaio] = useState<string | null>(null)

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

  const tutti = (stato: StatoPresenza) => {
    setD((v) => v && { ...v, elenco: v.elenco.map((p) => ({ ...p, stato })) })
    void dati.segnaTutti(sessioneId, stato)
  }

  const azzera = () => {
    setD((v) => v && { ...v, elenco: v.elenco.map((p) => ({ ...p, stato: null })) })
    for (const p of d.elenco) if (p.stato !== null) void dati.segna(sessioneId, p.id, null)
  }

  return (
    <>
      <div className="pad stack" style={{ gap: 4, paddingTop: 14 }}>
        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.18em', color: 'var(--faint)' }}>
          {giornoPerEsteso(d.sessione.inizio).toUpperCase()} · {oraDi(d.sessione.inizio)}
        </span>
        <span style={{ fontSize: 13, color: 'var(--dim)' }}>
          {[d.sessione.sala, d.sessione.istruttore].filter(Boolean).join(' · ')}
        </span>
      </div>

      <div className="pad" style={{ paddingTop: 14 }}>
        <div className="card stack" style={{ gap: 12, padding: 14 }}>
          <div className="row" style={{ alignItems: 'baseline', gap: 10 }}>
            <span className="num conto-appello">{presenti}</span>
            <span className="num" style={{ fontSize: 22, color: 'var(--dim)' }}>/ {d.elenco.length}</span>
            <span className="grow" />
            <span style={{ fontSize: 12, letterSpacing: '0.16em', color: 'var(--faint)' }}>
              {segnati === d.elenco.length ? 'APPELLO FATTO' : `${d.elenco.length - segnati} DA SEGNARE`}
            </span>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn btn-go grow" style={{ minHeight: 48, fontSize: 15 }} onClick={() => tutti('presente')}>
              TUTTI PRESENTI
            </button>
            <button className="btn btn-ghost" style={{ minHeight: 48, fontSize: 15, padding: '0 16px' }} onClick={azzera}>
              AZZERA
            </button>
          </div>
        </div>
      </div>

      <div className="rule">
        <span className="rule-label">ISCRITTI</span>
        <div className="rule-line" />
        <span className="num" style={{ fontSize: 15, fontWeight: 600, color: 'var(--dim)' }}>{d.elenco.length}</span>
      </div>

      <div className="pad elenco-appello">
        {d.elenco.map((p) => (
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

    </>
  )
}
