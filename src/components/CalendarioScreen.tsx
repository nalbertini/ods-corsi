import { useEffect, useMemo, useState } from 'react'
import type { Dati } from '../lib/dati'
import type { SessioneVista } from '../lib/sala'
import { chiaveGiorno, giornoPerEsteso, oraDi } from '../lib/sala'

const GIORNI_CORTI = ['DOM', 'LUN', 'MAR', 'MER', 'GIO', 'VEN', 'SAB']

/** I sette giorni a partire da una data, che è la finestra che si guarda in palestra. */
function settimana(da: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(da)
    d.setDate(d.getDate() + i)
    d.setHours(0, 0, 0, 0)
    return d
  })
}

const MESI_CORTI = ['GEN', 'FEB', 'MAR', 'APR', 'MAG', 'GIU', 'LUG', 'AGO', 'SET', 'OTT', 'NOV', 'DIC']

/** «26 SET – 2 OTT», la settimana che l'elenco mostra. */
function intervallo(da: Date, a: Date): string {
  return `${da.getDate()} ${MESI_CORTI[da.getMonth()]} – ${a.getDate()} ${MESI_CORTI[a.getMonth()]}`
}

function Guaio({ testo }: { testo: string }) {
  return (
    <div className="card stack" style={{ padding: 14, gap: 6, borderColor: 'var(--rosso)' }}>
      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.2em', color: 'var(--rosso)' }}>CALENDARIO NON LETTO</span>
      <span style={{ fontSize: 14, color: 'var(--dim)' }}>{testo}</span>
    </div>
  )
}

function Attesa() {
  return <p style={{ color: 'var(--dim)', fontSize: 15, margin: '4px 0 0' }}>Sto leggendo il calendario…</p>
}

/**
 * Il calendario delle sale.
 *
 * Una striscia di sette giorni in cima e sotto le lezioni di quello scelto, in
 * ordine di orario. Non una griglia settimanale: su un telefono una griglia si
 * legge male, e chi apre questa schermata nove volte su dieci vuole sapere cosa
 * c'è adesso, non farsi un'idea della settimana.
 *
 * Sullo schermo largo l'appello sta accanto: `apertaId` è la lezione che vi si
 * vede, e `presenti` i conti che l'appello ha cambiato dopo che il calendario
 * li ha letti.
 *
 * Con `soloDi` si vedono solo le lezioni di quell'istruttore (vedi
 * `SessioneVista.insegnanti`): sue quelle dei corsi che tiene, e quelle in cui
 * sostituisce qualcuno; non quelle in cui lo sostituiscono. Senza, tutte: è la
 * segreteria, che fa l'appello per chiunque.
 *
 * All'istruttore la striscia non serve: le sue lezioni sono poche, e scegliere
 * un giorno alla volta per trovarle è una fatica. Vede invece la settimana
 * intera in un elenco, un gruppo per giorno e solo i giorni in cui insegna.
 */
export function CalendarioScreen({
  dati,
  onApri,
  apertaId,
  presenti,
  soloDi,
}: {
  dati: Dati
  onApri: (s: SessioneVista) => void
  apertaId?: string
  presenti?: Record<string, number>
  soloDi?: string
}) {
  const [primo, setPrimo] = useState(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  })
  const [scelto, setScelto] = useState(() => chiaveGiorno(new Date()))
  const [lezioni, setLezioni] = useState<SessioneVista[] | null>(null)
  const [guaio, setGuaio] = useState<string | null>(null)

  const giorni = useMemo(() => settimana(primo), [primo])
  const oggi = chiaveGiorno(new Date())

  useEffect(() => {
    let vivo = true
    setLezioni(null)
    setGuaio(null)
    dati
      .calendario(giorni[0], giorni[6])
      .then((l) => vivo && setLezioni(l))
      .catch((e: unknown) => vivo && setGuaio(e instanceof Error ? e.message : 'Non riesco a leggere il calendario'))
    return () => {
      vivo = false
    }
  }, [dati, giorni])

  const perGiorno = useMemo(() => {
    const m = new Map<string, SessioneVista[]>()
    for (const l of lezioni ?? []) {
      if (soloDi && !l.insegnanti?.includes(soloDi)) continue
      // Si raggruppa per giorno **locale**, non per la data dentro la stringa
      // ISO: le 19:00 di Collegno sono le 17:00 UTC, e in certi mesi quello
      // basterebbe a far comparire la lezione nel giorno prima.
      const g = chiaveGiorno(new Date(l.inizio))
      m.set(g, [...(m.get(g) ?? []), l])
    }
    return m
  }, [lezioni, soloDi])

  const delGiorno = perGiorno.get(scelto) ?? []
  const elenco = !!soloDi
  const giorniConLezioni = giorni.map(chiaveGiorno).filter((k) => perGiorno.has(k))
  const quanteInSettimana = giorniConLezioni.reduce((n, k) => n + (perGiorno.get(k)?.length ?? 0), 0)

  const scorri = (settimane: number) => {
    const d = new Date(primo)
    d.setDate(d.getDate() + settimane * 7)
    setPrimo(d)
    setScelto(chiaveGiorno(d))
  }

  const carta = (v: SessioneVista) => {
    const l = presenti?.[v.id] === undefined ? v : { ...v, presenti: presenti[v.id] }
    return (
      <button
        key={l.id}
        className="card lezione"
        aria-current={l.id === apertaId ? 'true' : undefined}
        style={{ ['--tinta' as string]: l.colore ?? 'var(--blu)' }}
        onClick={() => onApri(l)}
      >
        <span className="lezione-ora num">{oraDi(l.inizio)}</span>
        <span className="stack grow" style={{ gap: 3, minWidth: 0, textAlign: 'left' }}>
          <span className="ob lezione-nome">{l.corso.toUpperCase()}</span>
          <span style={{ fontSize: 13, color: 'var(--dim)' }}>
            {[l.sala, l.istruttore].filter(Boolean).join(' · ')}
          </span>
        </span>
        <span className="stack" style={{ gap: 2, alignItems: 'flex-end' }}>
          <span className="num lezione-conto" data-fatto={l.presenti > 0}>
            {l.presenti > 0 ? `${l.presenti}/${l.iscritti}` : l.iscritti}
          </span>
          <span style={{ fontSize: 11, letterSpacing: '0.14em', color: 'var(--faint)' }}>
            {l.presenti > 0 ? 'PRESENTI' : 'ISCRITTI'}
          </span>
        </span>
      </button>
    )
  }

  return (
    <>
      <div className="row pad" style={{ gap: 8, paddingTop: 14, alignItems: 'center' }}>
        <button className="btn btn-ghost" style={{ minHeight: 40, padding: '0 12px', fontSize: 14 }} onClick={() => scorri(-1)}>
          ‹
        </button>
        <span className="ob grow" style={{ fontSize: 17, fontWeight: 700, letterSpacing: '0.06em', textAlign: 'center' }}>
          {elenco ? intervallo(giorni[0], giorni[6]) : giornoPerEsteso(scelto).toUpperCase()}
        </span>
        <button className="btn btn-ghost" style={{ minHeight: 40, padding: '0 12px', fontSize: 14 }} onClick={() => scorri(1)}>
          ›
        </button>
      </div>

      {elenco ? (
        <div className="stack" style={{ paddingBottom: 16 }}>
          {(guaio || lezioni === null || quanteInSettimana === 0) && (
            <div className="pad stack" style={{ paddingTop: 16 }}>
              {guaio && <Guaio testo={guaio} />}
              {!guaio && lezioni === null && <Attesa />}
              {!guaio && lezioni !== null && (
                <p style={{ color: 'var(--dim)', fontSize: 15, lineHeight: 1.5, margin: '4px 0 0' }}>
                  Nessuna tua lezione in questa settimana.
                </p>
              )}
            </div>
          )}
          {giorniConLezioni.map((g) => {
            const del = perGiorno.get(g) ?? []
            return (
              <section key={g}>
                <div className="rule">
                  <span className="rule-label" style={g === oggi ? { color: 'var(--giallo-testo)' } : undefined}>
                    {(g === oggi ? `OGGI · ${giornoPerEsteso(g)}` : giornoPerEsteso(g)).toUpperCase()}
                  </span>
                  <div className="rule-line" />
                  <span className="rule-conto num">{del.length}</span>
                </div>
                <div className="pad stack" style={{ gap: 10 }}>
                  {del.map(carta)}
                </div>
              </section>
            )
          })}
        </div>
      ) : (
        <>
          <div className="striscia-giorni">
            {giorni.map((d) => {
              const k = chiaveGiorno(d)
              const quante = (perGiorno.get(k) ?? []).length
              return (
                <button key={k} className="giorno" data-on={k === scelto} data-oggi={k === oggi} onClick={() => setScelto(k)}>
                  <span className="giorno-nome">{GIORNI_CORTI[d.getDay()]}</span>
                  <span className="giorno-num num">{d.getDate()}</span>
                  <span className="giorno-punti">{quante ? '•'.repeat(Math.min(quante, 4)) : ' '}</span>
                </button>
              )
            })}
          </div>

          <div className="rule">
            <span className="rule-label">LEZIONI</span>
            <div className="rule-line" />
            <span className="num" style={{ fontSize: 15, fontWeight: 600, color: 'var(--dim)' }}>{delGiorno.length}</span>
          </div>

          <div className="pad stack" style={{ gap: 10, paddingBottom: 16 }}>
            {guaio && <Guaio testo={guaio} />}
            {!guaio && lezioni === null && <Attesa />}
            {!guaio && lezioni !== null && delGiorno.length === 0 && (
              <p style={{ color: 'var(--dim)', fontSize: 15, lineHeight: 1.5, margin: '4px 0 0' }}>
                Nessuna lezione {scelto === oggi ? 'oggi' : 'in questo giorno'}.
              </p>
            )}

            {delGiorno.map(carta)}
          </div>
        </>
      )}
    </>
  )
}
