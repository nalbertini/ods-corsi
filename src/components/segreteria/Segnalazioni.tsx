import { useState } from 'react'
import type { DatiSegreteria } from '../../lib/segreteria'
import { MAX_TITOLO, chiudiConRisposta, etichettaChiudi, ordinaSegnalazioni, testoTroppoLungo, titoloTroppoLungo, tocca, ultimo, type Segnalazione } from '../../lib/segnalazioni'
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
  const { avviso, avvisa, fai, lavora } = useAvviso()

  const tutte = elenco.dato ?? []
  const lista = ordinaSegnalazioni(chiuse ? tutte : tutte.filter((x) => !x.chiusaIl))
  const aperte = tutte.filter((x) => !x.chiusaIl).length
  const daRispondere = tutte.filter(tocca).length
  const poi = async () => {
    await elenco.ricarica()
    onCambiato?.()
  }

  // Il titolo non si taglia in silenzio: si conta, e oltre il massimo lo dice.
  const lungo = titoloTroppoLungo(titolo)
  const testoLungo = testoTroppoLungo(testo)
  const apri = () =>
    void fai(() => d.apriSegnalazione(titolo, testo), 'Segnalazione mandata', async () => {
      setTitolo('')
      setTesto('')
      setNuova(false)
      await poi()
    })

  return (
    <>
      <Testa
        titolo="SEGNALAZIONI"
        sotto={`${aperte === 1 ? 'Una aperta' : aperte ? `${aperte} aperte` : 'Nessuna aperta'}${daRispondere ? `, ${daRispondere === 1 ? 'una aspetta' : `${daRispondere} aspettano`} una tua risposta` : ''}.`}
      >
        <button type="button" className="num sg-chip" aria-pressed={chiuse} onClick={() => setChiuse(!chiuse)}>
          ANCHE LE CHIUSE
        </button>
        <button type="button" className="sg-btn sg-btn-pieno" onClick={() => setNuova(!nuova)} aria-expanded={nuova}>
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
          <Campo id="sz-titolo" etichetta="TITOLO" manca={!!lungo}>
            <input
              id="sz-titolo"
              className="sg-campo"
              value={titolo}
              onChange={(e) => setTitolo(e.target.value)}
              placeholder="In due parole: cosa succede"
              aria-invalid={!!lungo || undefined}
              aria-describedby="sz-titolo-conto"
              autoFocus
            />
            <span id="sz-titolo-conto" className="num" style={{ fontSize: 13, color: lungo ? 'var(--text)' : 'var(--dim)' }}>
              {lungo ? `${lungo} (ora ${titolo.trim().length})` : `${titolo.trim().length}/${MAX_TITOLO}`}
            </span>
          </Campo>
          <Campo id="sz-testo" etichetta="COSA">
            <textarea
              id="sz-testo"
              className="sg-campo"
              rows={5}
              value={testo}
              onChange={(e) => setTesto(e.target.value)}
              placeholder="Dove, cosa hai fatto, cosa ti aspettavi"
              aria-invalid={!!testoLungo || undefined}
              aria-describedby={testoLungo ? 'sz-testo-nota' : undefined}
            />
            {testoLungo && <Troppo id="sz-testo-nota" testo={testoLungo} quanti={testo.trim().length} />}
          </Campo>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <button type="submit" className="sg-btn sg-btn-verde" disabled={lavora || !!lungo || !!testoLungo || !titolo.trim() || !testo.trim()}>
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
          <Filo key={s.id} s={s} aperto={aperta === s.id} onApri={() => setAperta(aperta === s.id ? null : s.id)} d={d} fai={fai} avvisa={avvisa} lavora={lavora} poi={poi} />
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
  avvisa,
  lavora,
  poi,
}: {
  s: Segnalazione
  aperto: boolean
  onApri: () => void
  d: DatiSegreteria
  fai: ReturnType<typeof useAvviso>['fai']
  avvisa: ReturnType<typeof useAvviso>['avvisa']
  lavora: boolean
  poi: () => Promise<void>
}) {
  const [risposta, setRisposta] = useState('')
  const rispostaLunga = testoTroppoLungo(risposta)
  const u = ultimo(s)
  const risposte = s.messaggi.length - 1
  const rispondi = () => void fai(() => d.rispondiSegnalazione(s.id, risposta), 'Risposta mandata', async () => (setRisposta(''), await poi()))
  const riapri = () => void fai(() => d.chiudiSegnalazione(s.id, false), 'Segnalazione riaperta', poi)
  // Chiude senza buttare la risposta scritta (vedi `chiudiConRisposta`), e
  // nell'avviso lascia RIAPRI: il filo sparisce dall'elenco, il tasto no.
  const chiudi = () => {
    let esito = { mandata: false, chiusa: false }
    void fai(
      async () => {
        esito = await chiudiConRisposta(d, s.id, risposta)
      },
      undefined,
      async () => {
        if (esito.mandata) setRisposta('')
        if (!esito.chiusa) avvisa(`La risposta è andata, la segnalazione è ancora aperta: tocca di nuovo ${etichettaChiudi('')}.`, true)
        else avvisa(esito.mandata ? 'Risposta mandata e segnalazione chiusa' : 'Segnalazione chiusa', false, { etichetta: 'RIAPRI', fa: riapri })
        await poi()
      },
    )
  }

  return (
    <div className="card stack sg-filo" data-tocca={tocca(s) || undefined} style={{ padding: 0, gap: 0 }}>
      <button type="button" className="sg-filo-testa" onClick={onApri} aria-expanded={aperto}>
        <span className="stack grow" style={{ gap: 2, minWidth: 0 }}>
          <span className="sg-filo-titolo" style={{ color: s.chiusaIl ? 'var(--dim)' : undefined }}>{s.titolo}</span>
          <span style={{ fontSize: 13, color: 'var(--sec)' }}>
            {s.messaggi[0].autore} · {risposte === 0 ? 'nessuna risposta' : risposte === 1 ? 'una risposta' : `${risposte} risposte`} · ultimo {u.mio ? 'tuo' : `di ${u.autore}`}, {quando(u.il)}
          </span>
        </span>
        {s.chiusaIl ? (
          <span className="num sg-tag">CHIUSA</span>
        ) : (
          tocca(s) && (
            <span className="num sg-tag" data-tipo="aspetta">
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
              <textarea
                id={`sz-r-${s.id}`}
                className="sg-campo"
                rows={3}
                value={risposta}
                onChange={(e) => setRisposta(e.target.value)}
                placeholder="Rispondi…"
                aria-invalid={!!rispostaLunga || undefined}
                aria-describedby={rispostaLunga ? `sz-r-${s.id}-nota` : undefined}
              />
              {rispostaLunga && <Troppo id={`sz-r-${s.id}-nota`} testo={rispostaLunga} quanti={risposta.trim().length} />}
              <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                <button type="submit" className="sg-btn sg-btn-verde" disabled={lavora || !risposta.trim() || !!rispostaLunga}>
                  RISPONDI
                </button>
                <button type="button" className="sg-btn sg-btn-linea" disabled={lavora || !!rispostaLunga} onClick={chiudi}>
                  {/* I due nomi occupano lo stesso posto: cambiando non spostano il tasto accanto. */}
                  <span className="sg-due-nomi">
                    {[etichettaChiudi(''), etichettaChiudi('x')].map((n) => (
                      <span key={n} data-spento={n !== etichettaChiudi(risposta) || undefined}>
                        {n}
                      </span>
                    ))}
                  </span>
                </button>
                <a className="sg-btn sg-btn-linea" href={avvisoWhatsApp(s)} target="_blank" rel="noreferrer">
                  AVVISA SU WHATSAPP
                </a>
              </div>
            </form>
          )}
          {s.chiusaIl && (
            <div>
              <button type="button" className="sg-btn sg-btn-linea" disabled={lavora} onClick={riapri}>
                RIAPRI
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/** Un testo oltre il massimo: lo si dice sotto il campo, con quanti caratteri ci sono ora. */
function Troppo({ id, testo, quanti }: { id: string; testo: string; quanti: number }) {
  return (
    <span id={id} className="num" style={{ fontSize: 13 }}>
      {testo} (ora {quanti})
    </span>
  )
}
