import { useEffect, useMemo, useRef, useState } from 'react'
import { dati as caricaDati, type Dati } from '../lib/dati'
import { delMese, mesi, minutiDi, oreItaliane, type MiaPresenza } from '../lib/ore'
import type { LezioneSenzaIstruttore } from '../lib/segreteria'
import { chiaveGiorno, giornoPerEsteso, oraDi } from '../lib/sala'

const STATO: Record<MiaPresenza['stato'], string> = { confermata: 'CONFERMATA', da_confermare: 'DA CONFERMARE', rifiutata: 'RIFIUTATA' }

const giorno = (iso: string) => giornoPerEsteso(chiaveGiorno(new Date(iso)))

/**
 * LE MIE ORE: le lezioni del mese che in segreteria risultano dell'istruttore,
 * con gli stessi numeri della sua scheda PRESENZE (`delMese` di `ore.ts`).
 * Solo da leggere: conferma e rifiuta la segreteria.
 */
export function MieOre({ personaId }: { personaId: string }) {
  const periodi = useMemo(mesi, [])
  const [periodo, setPeriodo] = useState(periodi[0].chiave)
  const m = periodi.find((x) => x.chiave === periodo) ?? periodi[0]
  const [d, setD] = useState<Dati | null>(null)
  const [letto, setLetto] = useState<{ presenze: MiaPresenza[]; senzaIstruttore: LezioneSenzaIstruttore[] } | null>(null)
  const [guaio, setGuaio] = useState(false)
  const [tentativo, setTentativo] = useState(0)
  const [inCoda, setInCoda] = useState(0)

  useEffect(() => {
    let vivo = true
    setLetto(null)
    setGuaio(false)
    caricaDati()
      .then((x) => {
        if (vivo) setD(x)
        if (!x.mieOre) throw new Error('mieOre')
        return x.mieOre(personaId, m.da, m.a)
      })
      .then(
        (r) => vivo && setLetto(r),
        // Numeri vecchi spacciati per buoni sarebbero peggio di niente.
        () => vivo && setGuaio(true),
      )
    return () => {
      vivo = false
    }
  }, [personaId, m.da, m.a, tentativo])

  useEffect(() => d?.guardaCoda?.(setInCoda), [d])
  // Arrivate le presenze in coda, le loro lezioni ci sono: si rilegge.
  const primaInCoda = useRef(0)
  useEffect(() => {
    if (primaInCoda.current > 0 && inCoda === 0) setTentativo((t) => t + 1)
    primaInCoda.current = inCoda
  }, [inCoda])

  const conto = letto && delMese(letto.presenze, letto.senzaIstruttore, personaId, m)

  return (
    <div className="miei-timer">
      <div className="row pad" style={{ gap: 10, paddingTop: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <span className="ob grow appello-titolo" style={{ whiteSpace: 'nowrap' }}>
          LE MIE ORE
        </span>
        <label htmlFor="mese-ore" className="vh">
          Mese
        </label>
        <select id="mese-ore" className="sg-campo mie-ore-mese" value={periodo} onChange={(e) => setPeriodo(e.target.value)}>
          {periodi.map((x) => (
            <option key={x.chiave} value={x.chiave}>
              {x.nome}
            </option>
          ))}
        </select>
      </div>
      <p className="pad passo-dettaglio" style={{ fontSize: 15, margin: '10px 0 0' }}>
        Le lezioni che in segreteria risultano tue. Se qualcosa non torna, dillo in segreteria.
      </p>
      {inCoda > 0 && (
        <p className="pad passo-dettaglio" data-tono="avviso" style={{ fontSize: 15, marginTop: 10 }}>
          Hai presenze ancora da inviare: quelle lezioni compaiono qui quando arrivano.
        </p>
      )}

      {guaio && (
        <div className="pad stack" style={{ paddingTop: 14, gap: 10 }}>
          <div className="card stack" style={{ padding: 14, gap: 6, borderColor: 'var(--rosso)' }}>
            <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.2em', color: 'var(--rosso-testo)' }}>LE MIE ORE NON LETTE</span>
            <span style={{ fontSize: 14, color: 'var(--dim)' }}>Il server non ha risposto. Controlla la rete e riprova.</span>
          </div>
          <button type="button" className="btn btn-ghost" style={{ minHeight: 48, padding: '0 16px', alignSelf: 'flex-start' }} onClick={() => setTentativo((t) => t + 1)}>
            RIPROVA
          </button>
        </div>
      )}
      {!conto && !guaio && <p className="pad" style={{ color: 'var(--dim)' }}>Sto leggendo le tue lezioni…</p>}

      {conto && (
        <>
          <div className="pad mie-ore-numeri">
            <div className="card stack mie-ore-numero">
              <span className="sg-etichetta">LEZIONI</span>
              <span className="num mie-ore-valore">{conto.confermate.length}</span>
              <span className="mie-ore-sotto">confermate</span>
            </div>
            <div className="card stack mie-ore-numero">
              <span className="sg-etichetta">ORE</span>
              <span className="num mie-ore-valore">{oreItaliane(conto.minuti)}</span>
              <span className="mie-ore-sotto">solo le confermate</span>
            </div>
            <div className="card stack mie-ore-numero" data-allarme={conto.daConfermare > 0}>
              <span className="sg-etichetta">DA CONFERMARE</span>
              <span className="num mie-ore-valore">{conto.daConfermare}</span>
              <span className="mie-ore-sotto">{conto.nonSegnate.length
                  ? `${conto.nonSegnate.length} senza segno: dillo tu`
                  : conto.daConfermare
                    ? 'le decide la segreteria'
                    : 'niente in sospeso'}</span>
            </div>
          </div>

          {conto.nonSegnate.length > 0 && (
            <>
              <div className="rule">
                <span className="rule-label">NESSUNO SI È SEGNATO</span>
                <div className="rule-line" />
                <span className="rule-conto num">{conto.nonSegnate.length}</span>
              </div>
              <p className="pad passo-dettaglio" data-tono="avviso" style={{ fontSize: 15, marginTop: 0 }}>
                Lezioni tenute in cui eri previsto e nessun istruttore si è segnato: se c’eri, dillo in segreteria.
              </p>
              <div className="pad stack mie-ore-elenco" style={{ gap: 8 }}>
                {conto.nonSegnate.map((l) => (
                  <Riga key={l.sessioneId} corso={l.corso} inizio={l.inizio} fine={l.fine} stato="NON SEGNATA" tono="avviso" />
                ))}
              </div>
            </>
          )}

          <div className="rule">
            <span className="rule-label">LE TUE LEZIONI</span>
            <div className="rule-line" />
            <span className="rule-conto num">{conto.righe.length}</span>
          </div>
          <div className="pad stack mie-ore-elenco" style={{ gap: 8, paddingBottom: 24 }}>
            {conto.righe.length === 0 && (
              <p className="passo-dettaglio" style={{ margin: 0, fontSize: 15 }}>
                Nessuna lezione segnata in {m.nome.toLowerCase()}.
              </p>
            )}
            {conto.righe.map((x) => (
              <Riga
                key={x.id}
                corso={x.corso}
                inizio={x.inizio}
                fine={x.fine}
                stato={STATO[x.stato]}
                tono={x.stato === 'confermata' ? 'fatto' : x.stato === 'da_confermare' ? 'avviso' : 'spento'}
                nota={[
                  x.prevista ? '' : 'non era un tuo corso',
                  x.stato === 'rifiutata' && x.gestitaIl ? `per la segreteria non c’eri${x.gestitaDa ? ` · ${x.gestitaDa}` : ''}, ${giorno(x.gestitaIl)}` : '',
                ]
                  .filter(Boolean)
                  .join(' · ')}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function Riga({ corso, inizio, fine, stato, tono, nota }: { corso: string; inizio: string; fine: string; stato: string; tono: 'fatto' | 'avviso' | 'spento'; nota?: string }) {
  return (
    <div className="card mie-ore-riga" data-tono={tono}>
      <span className="stack grow" style={{ gap: 3, minWidth: 0 }}>
        <span className="ob lezione-nome">{corso.toUpperCase()}</span>
        <span style={{ fontSize: 14, color: 'var(--dim)' }}>{giorno(inizio)}</span>
        <span className="num" style={{ fontSize: 14, color: 'var(--dim)', whiteSpace: 'nowrap' }}>
          {oraDi(inizio)}–{oraDi(fine)} · {oreItaliane(minutiDi({ inizio, fine }))} h
        </span>
        {nota && <span style={{ fontSize: 13, color: 'var(--dim)' }}>{nota}</span>}
      </span>
      <span className="mie-ore-stato">{stato}</span>
    </div>
  )
}
