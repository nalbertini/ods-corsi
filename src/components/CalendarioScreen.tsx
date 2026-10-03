import { useEffect, useMemo, useState } from 'react'
import type { Dati } from '../lib/dati'
import type { SessioneVista } from '../lib/sala'
import { chiaveGiorno, giornoPerEsteso, oraDi } from '../lib/sala'
import { Kanji } from './Kanji'
import type { Conto } from './AppelloScreen'

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

function Guaio({ testo, onRiprova }: { testo: string; onRiprova: () => void }) {
  return (
    <div className="card stack" style={{ padding: 14, gap: 6, borderColor: 'var(--rosso)' }}>
      <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.2em', color: 'var(--rosso)' }}>CALENDARIO NON LETTO</span>
      <span style={{ fontSize: 14, color: 'var(--dim)' }}>{testo}</span>
      <button type="button" className="btn btn-ghost" style={{ minHeight: 44, fontSize: 14, padding: '0 14px', alignSelf: 'flex-start' }} onClick={onRiprova}>
        RIPROVA
      </button>
    </div>
  )
}

/** Quanto manca a una lezione di oggi: «ADESSO» mentre si fa, «TRA 20 MIN» nell'ora prima. */
function quando(l: SessioneVista, adesso: number): string | null {
  const inizio = new Date(l.inizio).getTime()
  if (l.stato === 'annullata') return null
  if (adesso >= inizio && adesso < new Date(l.fine).getTime()) return 'ADESSO'
  const tra = Math.round((inizio - adesso) / 60000)
  return tra > 0 && tra <= 60 ? `TRA ${tra} MIN` : null
}

const UN_GIORNO = 24 * 60 * 60 * 1000

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
  conti,
  soloDi,
}: {
  dati: Dati
  onApri: (s: SessioneVista) => void
  apertaId?: string
  conti?: Record<string, Conto>
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
  const [giro, setGiro] = useState(0)
  // Le lezioni passate dell'istruttore rimaste senza appello: ultimi sette giorni.
  const [passate, setPassate] = useState<SessioneVista[]>([])

  const giorni = useMemo(() => settimana(primo), [primo])
  const oggi = chiaveGiorno(new Date())

  useEffect(() => {
    let vivo = true
    setLezioni(null)
    setGuaio(null)
    dati
      .calendario(giorni[0], giorni[6])
      .then((l) => vivo && setLezioni(l))
      .catch(() => vivo && setGuaio('Non riesco a leggerlo: controlla la connessione e riprova.'))
    return () => {
      vivo = false
    }
  }, [dati, giorni, giro])

  useEffect(() => {
    if (!soloDi) return
    let vivo = true
    const oggi = new Date()
    oggi.setHours(0, 0, 0, 0)
    dati
      .calendario(new Date(oggi.getTime() - 7 * UN_GIORNO), new Date())
      .then((l) => vivo && setPassate(l), () => {})
    return () => {
      vivo = false
    }
  }, [dati, soloDi, giro])

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

  const conLConto = (v: SessioneVista) => (conti?.[v.id] ? { ...v, ...conti[v.id] } : v)
  const adesso = Date.now()
  const daChiudere = (l: SessioneVista) => l.stato !== 'annullata' && new Date(l.fine).getTime() < adesso && l.iscritti > 0 && (l.daSegnare ?? 0) > 0
  // Quelle della settimana che si guarda hanno già la loro carta, lì.
  const inVista = new Set((lezioni ?? []).map((l) => l.id))
  const senzaAppello = passate.map(conLConto).filter((l) => !inVista.has(l.id) && l.insegnanti?.includes(soloDi ?? '') && daChiudere(l))

  const carta = (v: SessioneVista) => {
    const l = conLConto(v)
    // Gli iscritti presenti, senza chi prova: il conto torna con quello dell'appello.
    const presentiIscritti = l.presenti - (l.prove ?? 0)
    const fatto = l.daSegnare === 0 && l.iscritti > 0
    const iniziato = presentiIscritti > 0 || (l.prove ?? 0) > 0 || (l.daSegnare !== undefined && l.daSegnare < l.iscritti)
    const tra = quando(l, adesso)
    const manca = daChiudere(l)
    return (
      <button
        key={l.id}
        className="card lezione"
        aria-current={l.id === apertaId ? 'true' : undefined}
        style={{ ['--tinta' as string]: l.colore ?? 'var(--blu)' }}
        onClick={() => onApri(l)}
      >
        <span className="stack" style={{ gap: 2 }}>
          <span className="lezione-ora num">{oraDi(l.inizio)}</span>
          {tra && <span className="num lezione-quando">{tra}</span>}
        </span>
        <span className="stack grow" style={{ gap: 3, minWidth: 0, textAlign: 'left' }}>
          <span className="ob lezione-nome">{l.corso.toUpperCase()}</span>
          <span className="chi-kanji" style={{ fontSize: 13, color: 'var(--dim)' }}>
            <Kanji segni={l.kanji} />
            <span>{[l.sala, l.istruttore].filter(Boolean).join(' · ')}</span>
          </span>
        </span>
        <span className="stack" style={{ gap: 2, alignItems: 'flex-end' }}>
          <span className="num lezione-conto" data-fatto={fatto}>
            {iniziato ? `${presentiIscritti}/${l.iscritti}` : l.iscritti}
          </span>
          <span className="num lezione-stato" data-fatto={fatto} data-manca={manca || undefined}>
            {manca ? 'DA CHIUDERE' : !iniziato ? 'ISCRITTI' : fatto ? '✓ FATTO' : 'IN CORSO'}
            {(l.prove ?? 0) > 0 && ` · +${l.prove} PROVA`}
          </span>
        </span>
      </button>
    )
  }

  return (
    <>
      {/* Come le presenze segnalate: un riquadro solo, una riga per lezione,
          così i giorni da fare restano in vista. */}
      {elenco && senzaAppello.length > 0 && (
        <div className="pad" style={{ paddingTop: 14 }}>
          <div className="card stack segnalate-avviso da-chiudere">
            <span className="rule-label" style={{ color: 'var(--rosso)' }}>
              {senzaAppello.length === 1 ? 'UN APPELLO DA CHIUDERE' : `${senzaAppello.length} APPELLI DA CHIUDERE`}
            </span>
            <span style={{ fontSize: 13, color: 'var(--dim)' }}>Lezioni passate con qualcuno ancora da segnare: aprile e chiudi l’appello.</span>
            {senzaAppello.map((l) => (
              <button key={l.id} type="button" className="row segnalate-voce" onClick={() => onApri(l)}>
                <span className="grow" style={{ fontWeight: 600, textAlign: 'left' }}>
                  {l.corso}
                </span>
                <span style={{ fontSize: 13, color: 'var(--dim)' }}>
                  {giornoPerEsteso(chiaveGiorno(new Date(l.inizio)))} {oraDi(l.inizio)} · {l.daSegnare} da segnare
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="row pad" style={{ gap: 8, paddingTop: 14, alignItems: 'center' }}>
        <button className="btn btn-ghost" style={{ minHeight: 44, minWidth: 44, padding: 0, fontSize: 22 }} aria-label="Settimana prima" onClick={() => scorri(-1)}>
          ‹
        </button>
        <span className="ob grow" style={{ fontSize: 17, fontWeight: 700, letterSpacing: '0.06em', textAlign: 'center' }}>
          {elenco ? intervallo(giorni[0], giorni[6]) : giornoPerEsteso(scelto).toUpperCase()}
        </span>
        <button className="btn btn-ghost" style={{ minHeight: 44, minWidth: 44, padding: 0, fontSize: 22 }} aria-label="Settimana dopo" onClick={() => scorri(1)}>
          ›
        </button>
      </div>

      {elenco ? (
        <div className="stack" style={{ paddingBottom: 16 }}>
          {(guaio || lezioni === null || quanteInSettimana === 0) && (
            <div className="pad stack" style={{ paddingTop: 16 }}>
              {guaio && <Guaio testo={guaio} onRiprova={() => setGiro((g) => g + 1)} />}
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
            {guaio && <Guaio testo={guaio} onRiprova={() => setGiro((g) => g + 1)} />}
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
