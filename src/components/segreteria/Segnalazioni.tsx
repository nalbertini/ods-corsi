import { useState } from 'react'
import type { DatiSegreteria } from '../../lib/segreteria'
import { MAX_TESTO, MAX_TITOLO, ordinaSegnalazioni, tocca, ultimo, type Segnalazione } from '../../lib/segnalazioni'
import { chiaveGiorno, giornoPerEsteso, oraDi } from '../../lib/sala'
import { indirizzo, INDIRIZZI } from '../../lib/aree'
import { Campo, Guaio, Testa, useAvviso, useCarica } from './comune'

const quando = (iso: string) => `${giornoPerEsteso(chiaveGiorno(new Date(iso)))}, ${oraDi(iso)}`

/**
 * WhatsApp con l'avviso già scritto: senza numero, a chi mandarlo si sceglie
 * lì. La segreteria non ha un indirizzo per voce: si dice dove guardare.
 */
const avvisoWhatsApp = (s: Segnalazione) =>
  `https://wa.me/?text=${encodeURIComponent(`Ti ho scritto sulla segnalazione «${s.titolo}»: la trovi in Segreteria, alla voce SEGNALAZIONI. ${indirizzo(INDIRIZZI.segreteria)}`)}`

/**
 * Le segnalazioni della segreteria (vedi `segnalazioni.ts`): cosa non va o
 * cosa servirebbe nell'app, scritto qui invece che in un documento. Ognuna è
 * un filo con le sue risposte; si apre toccandola, e si chiude quando è fatta.
 */
export function Segnalazioni({ d, onCambiato }: { d: DatiSegreteria; onCambiato?: () => void }) {
  const elenco = useCarica(() => d.segnalazioni(), [d])
  const [chiuse, setChiuse] = useState(false)
  const [aperta, setAperta] = useState<string | null>(null)
  const [nuova, setNuova] = useState(false)
  const [titolo, setTitolo] = useState('')
  const [testo, setTesto] = useState('')
  const { avviso, fai, lavora } = useAvviso()

  const tutte = elenco.dato ?? []
  const lista = ordinaSegnalazioni(chiuse ? tutte : tutte.filter((x) => !x.chiusaIl))
  const aperte = tutte.filter((x) => !x.chiusaIl).length
  const daRispondere = tutte.filter(tocca).length
  const poi = async () => {
    await elenco.ricarica()
    onCambiato?.()
  }

  const apri = () =>
    void fai(() => d.apriSegnalazione(titolo, testo), 'Segnalazione aperta', async () => {
      setTitolo('')
      setTesto('')
      setNuova(false)
      await poi()
    })

  return (
    <>
      <Testa
        titolo="SEGNALAZIONI"
        sotto={`${aperte === 1 ? 'Una aperta' : `${aperte || 'Nessuna'} aperte`}${daRispondere ? `, ${daRispondere === 1 ? 'una aspetta' : `${daRispondere} aspettano`} una tua risposta` : ''}.`}
      >
        <button type="button" className="num sg-chip" aria-pressed={chiuse} onClick={() => setChiuse(!chiuse)}>
          ANCHE LE CHIUSE
        </button>
        <button type="button" className="sg-btn" onClick={() => setNuova(!nuova)} aria-expanded={nuova}>
          NUOVA SEGNALAZIONE
        </button>
      </Testa>

      <p className="sg-sotto" style={{ maxWidth: 760, margin: 0 }}>
        Cosa non va o cosa servirebbe nell’app: si scrive qui, e la risposta arriva sotto, nello stesso filo. Quando è fatta si chiude.
      </p>

      {nuova && (
        <form
          className="card stack"
          style={{ padding: 16, gap: 12, maxWidth: 760 }}
          onSubmit={(e) => {
            e.preventDefault()
            apri()
          }}
        >
          <Campo id="sz-titolo" etichetta="TITOLO">
            <input id="sz-titolo" className="sg-campo" value={titolo} maxLength={MAX_TITOLO} onChange={(e) => setTitolo(e.target.value)} placeholder="In due parole: cosa succede" autoFocus />
          </Campo>
          <Campo id="sz-testo" etichetta="COSA">
            <textarea id="sz-testo" className="sg-campo" rows={5} value={testo} maxLength={MAX_TESTO} onChange={(e) => setTesto(e.target.value)} placeholder="Dove, cosa hai fatto, cosa ti aspettavi" />
          </Campo>
          <div className="row" style={{ gap: 8 }}>
            <button type="submit" className="sg-btn sg-btn-verde" disabled={lavora || !titolo.trim() || !testo.trim()}>
              APRI
            </button>
            <button type="button" className="sg-btn sg-btn-linea" onClick={() => setNuova(false)}>
              LASCIA STARE
            </button>
          </div>
        </form>
      )}

      {elenco.guaio && <Guaio testo={elenco.guaio} />}
      {elenco.dato === null && !elenco.guaio && <p className="sg-sotto">Sto leggendo le segnalazioni…</p>}
      {elenco.dato !== null && lista.length === 0 && (
        <p className="sg-sotto">{chiuse || !tutte.length ? 'Nessuna segnalazione.' : 'Nessuna aperta. Le altre si vedono con «anche le chiuse».'}</p>
      )}

      <div className="stack" style={{ gap: 10, maxWidth: 760 }}>
        {lista.map((s) => (
          <Filo key={s.id} s={s} aperto={aperta === s.id} onApri={() => setAperta(aperta === s.id ? null : s.id)} d={d} fai={fai} lavora={lavora} poi={poi} />
        ))}
      </div>
      {avviso}
    </>
  )
}

function Filo({
  s,
  aperto,
  onApri,
  d,
  fai,
  lavora,
  poi,
}: {
  s: Segnalazione
  aperto: boolean
  onApri: () => void
  d: DatiSegreteria
  fai: ReturnType<typeof useAvviso>['fai']
  lavora: boolean
  poi: () => Promise<void>
}) {
  const [risposta, setRisposta] = useState('')
  const u = ultimo(s)
  const risposte = s.messaggi.length - 1
  const rispondi = () => void fai(() => d.rispondiSegnalazione(s.id, risposta), 'Risposta mandata', async () => (setRisposta(''), await poi()))
  const chiudi = (chiusa: boolean) => void fai(() => d.chiudiSegnalazione(s.id, chiusa), chiusa ? 'Segnalazione chiusa' : 'Segnalazione riaperta', poi)

  return (
    <div className="card stack" style={{ padding: 0, gap: 0, opacity: s.chiusaIl ? 0.7 : 1 }}>
      <button type="button" className="row" onClick={onApri} aria-expanded={aperto} style={{ all: 'unset', cursor: 'pointer', display: 'flex', gap: 12, padding: '12px 14px', alignItems: 'center' }}>
        <span className="stack grow" style={{ gap: 2, minWidth: 0 }}>
          <span style={{ fontSize: 15, fontWeight: 600 }}>{s.titolo}</span>
          <span style={{ fontSize: 13, color: 'var(--sec)' }}>
            {s.messaggi[0].autore} · {risposte === 0 ? 'nessuna risposta' : risposte === 1 ? 'una risposta' : `${risposte} risposte`} · ultimo {u.mio ? 'tuo' : `di ${u.autore}`}, {quando(u.il)}
          </span>
        </span>
        {s.chiusaIl ? (
          <span className="num sg-tag">CHIUSA</span>
        ) : (
          tocca(s) && (
            <span className="num sg-tag" data-tipo="manca">
              DA RISPONDERE
            </span>
          )
        )}
      </button>

      {aperto && (
        <div className="stack" style={{ gap: 12, padding: '0 14px 14px', borderTop: '1px solid var(--line)' }}>
          {s.messaggi.map((m) => (
            <div key={m.id} className="stack" style={{ gap: 4, paddingTop: 12 }}>
              <span style={{ fontSize: 12, color: 'var(--dim)' }}>
                <strong style={{ color: m.mio ? 'var(--text)' : 'var(--sec)' }}>{m.mio ? 'Tu' : m.autore}</strong> · {quando(m.il)}
              </span>
              <span style={{ fontSize: 15, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{m.testo}</span>
            </div>
          ))}
          {s.chiusaIl && <span style={{ fontSize: 12, color: 'var(--dim)' }}>Chiusa {quando(s.chiusaIl)}.</span>}
          {!s.chiusaIl && (
            <form
              className="stack"
              style={{ gap: 8 }}
              onSubmit={(e) => {
                e.preventDefault()
                rispondi()
              }}
            >
              <label htmlFor={`sz-r-${s.id}`} className="vh">
                Risposta
              </label>
              <textarea id={`sz-r-${s.id}`} className="sg-campo" rows={3} value={risposta} maxLength={MAX_TESTO} onChange={(e) => setRisposta(e.target.value)} placeholder="Rispondi…" />
              <div className="row" style={{ gap: 8 }}>
                <button type="submit" className="sg-btn sg-btn-verde" disabled={lavora || !risposta.trim()}>
                  RISPONDI
                </button>
                <button type="button" className="sg-btn sg-btn-linea" disabled={lavora} onClick={() => chiudi(true)}>
                  CHIUDI
                </button>
                <a className="sg-btn sg-btn-linea" href={avvisoWhatsApp(s)} target="_blank" rel="noreferrer">
                  AVVISA SU WHATSAPP
                </a>
              </div>
            </form>
          )}
          {s.chiusaIl && (
            <div>
              <button type="button" className="sg-btn sg-btn-linea" disabled={lavora} onClick={() => chiudi(false)}>
                RIAPRI
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
