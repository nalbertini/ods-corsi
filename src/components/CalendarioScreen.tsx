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

/**
 * Il calendario delle sale.
 *
 * Una striscia di sette giorni in cima e sotto le lezioni di quello scelto, in
 * ordine di orario. Non una griglia settimanale: su un telefono una griglia si
 * legge male, e chi apre questa schermata nove volte su dieci vuole sapere cosa
 * c'è adesso, non farsi un'idea della settimana.
 */
export function CalendarioScreen({
  dati,
  onApri,
}: {
  dati: Dati
  onApri: (s: SessioneVista) => void
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
      // Si raggruppa per giorno **locale**, non per la data dentro la stringa
      // ISO: le 19:00 di Collegno sono le 17:00 UTC, e in certi mesi quello
      // basterebbe a far comparire la lezione nel giorno prima.
      const g = chiaveGiorno(new Date(l.inizio))
      m.set(g, [...(m.get(g) ?? []), l])
    }
    return m
  }, [lezioni])

  const delGiorno = perGiorno.get(scelto) ?? []

  const scorri = (settimane: number) => {
    const d = new Date(primo)
    d.setDate(d.getDate() + settimane * 7)
    setPrimo(d)
    setScelto(chiaveGiorno(d))
  }

  return (
    <>
      <div className="row pad" style={{ gap: 8, paddingTop: 14, alignItems: 'center' }}>
        <button className="btn btn-ghost" style={{ minHeight: 40, padding: '0 12px', fontSize: 14 }} onClick={() => scorri(-1)}>
          ‹
        </button>
        <span className="ob grow" style={{ fontSize: 17, fontWeight: 700, letterSpacing: '0.06em', textAlign: 'center' }}>
          {giornoPerEsteso(scelto).toUpperCase()}
        </span>
        <button className="btn btn-ghost" style={{ minHeight: 40, padding: '0 12px', fontSize: 14 }} onClick={() => scorri(1)}>
          ›
        </button>
      </div>

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
        {guaio && (
          <div className="card stack" style={{ padding: 14, gap: 6, borderColor: 'var(--rosso)' }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.2em', color: 'var(--rosso)' }}>CALENDARIO NON LETTO</span>
            <span style={{ fontSize: 14, color: 'var(--dim)' }}>{guaio}</span>
          </div>
        )}
        {!guaio && lezioni === null && (
          <p style={{ color: 'var(--dim)', fontSize: 15, margin: '4px 0 0' }}>Sto leggendo il calendario…</p>
        )}
        {!guaio && lezioni !== null && delGiorno.length === 0 && (
          <p style={{ color: 'var(--dim)', fontSize: 15, lineHeight: 1.5, margin: '4px 0 0' }}>
            Nessuna lezione {scelto === oggi ? 'oggi' : 'in questo giorno'}.
          </p>
        )}

        {delGiorno.map((l) => (
          <button key={l.id} className="card lezione" style={{ ['--tinta' as string]: l.colore ?? 'var(--blu)' }} onClick={() => onApri(l)}>
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
        ))}
      </div>
    </>
  )
}
