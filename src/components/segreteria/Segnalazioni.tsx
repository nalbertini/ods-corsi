import { useRef, useState } from 'react'
import type { DatiSegreteria } from '../../lib/segreteria'
import {
  MAX_TESTO,
  MAX_TITOLO,
  avvisoChiusura,
  chiaveBozza,
  chiaveRisposta,
  conBozza,
  chiudiConRisposta,
  etichettaChiudi,
  leggiBozza,
  motivoSpento,
  quando,
  rigaFilo,
  scriviBozza,
  sessione,
  tocca,
  troppoLungo,
  visibili,
  type Segnalazione,
} from '../../lib/segnalazioni'
import { indirizzo, INDIRIZZI } from '../../lib/aree'
import { Campo, Guaio, Testa, useAvviso, useCarica } from './comune'

/**
 * WhatsApp con l'avviso già scritto: senza numero, a chi mandarlo si sceglie
 * lì. La segreteria non ha un indirizzo per voce: si dice dove guardare.
 */
const avvisoWhatsApp = (s: Segnalazione) =>
  `https://wa.me/?text=${encodeURIComponent(`Ti ho scritto sulla segnalazione «${s.titolo}»: la trovi in Segreteria, alla voce SEGNALAZIONI. ${indirizzo(INDIRIZZI.segreteria)}`)}`

/** Una bozza che resta se si cambia voce e si torna (vedi `leggiBozza`). */
function useBozza(chiave: string) {
  const [valore, setValore] = useState(() => leggiBozza(sessione(), chiave))
  const cambia = (v: string) => {
    setValore(v)
    scriviBozza(sessione(), chiave, v)
  }
  return [valore, cambia] as const
}

/**
 * Le segnalazioni della segreteria (vedi `segnalazioni.ts`): cosa non va o
 * cosa servirebbe nell'app, scritto qui invece che in un documento. Ognuna è
 * un filo con le sue risposte; si apre toccandola, e si chiude quando è fatta.
 */
export function Segnalazioni({ d, onCambiato }: { d: DatiSegreteria; onCambiato?: () => void }) {
  const elenco = useCarica(() => d.segnalazioni(), [d])
  const [chiuse, setChiuse] = useState(false)
  const [aperta, setAperta] = useState<string | null>(null)
  // Le appena chiuse restano in fondo finché la schermata è aperta (vedi `visibili`).
  const [tenute, setTenute] = useState<ReadonlySet<string>>(() => new Set())
  const [titolo, setTitolo] = useBozza(chiaveBozza(d.modo, 'nuova-titolo'))
  const [testo, setTesto] = useBozza(chiaveBozza(d.modo, 'nuova-testo'))
  const [nuova, setNuova] = useState(() => !!(titolo || testo))
  const { avviso, avvisa, fai, lavora } = useAvviso()

  const tutte = elenco.dato ?? []
  // Le chiuse con una risposta a metà restano in vista come le appena chiuse.
  const lista = visibili(tutte, chiuse, new Set([...tenute, ...conBozza(sessione(), d.modo, tutte.map((x) => x.id))]))
  const aperte = tutte.filter((x) => !x.chiusaIl).length
  const daRispondere = tutte.filter(tocca).length
  const poi = async () => {
    await elenco.ricarica()
    onCambiato?.()
  }

  // Titolo e testo non si tagliano in silenzio: oltre il massimo lo si dice.
  const lungo = troppoLungo('Titolo', titolo, MAX_TITOLO)
  const testoLungo = troppoLungo('Testo', testo, MAX_TESTO)
  const motivo = motivoSpento({ titolo, testo, lavora })
  // Si manda se non manca niente e niente è troppo lungo: vale per il tasto e per Invio.
  const pronto = !lavora && !motivo && !lungo && !testoLungo
  const svuota = () => {
    setTitolo('')
    setTesto('')
    setNuova(false)
  }
  // LASCIA STARE butta via, ma si riprende dall'avviso: un tocco sbagliato col telefono che suona non perde niente.
  const lasciaStare = () => {
    const [t, x] = [titolo, testo]
    svuota()
    if (t.trim() || x.trim()) avvisa('Segnalazione buttata via', false, { etichetta: 'RIPRENDI', fa: () => (setTitolo(t), setTesto(x), setNuova(true), avvisa('Segnalazione ripresa')) })
  }
  const apri = () => {
    let id = ''
    void fai(
      async () => {
        id = await d.apriSegnalazione(titolo, testo)
      },
      'Segnalazione mandata',
      async () => {
        svuota()
        await poi()
        setAperta(id)
      },
    )
  }

  return (
    <>
      <Testa
        titolo="SEGNALAZIONI"
        sotto={`${aperte === 1 ? 'Una aperta' : aperte ? `${aperte} aperte` : 'Nessuna aperta'}${daRispondere ? `, ${daRispondere === 1 ? 'una aspetta' : `${daRispondere} aspettano`} una risposta` : ''}.`}
      >
        <button type="button" className="num sg-chip sg-chip-dopo" aria-pressed={chiuse} onClick={() => setChiuse(!chiuse)}>
          ANCHE LE CHIUSE
        </button>
        {/* Col modulo aperto passa da pieno a linea: si vede che è già premuto. */}
        <button type="button" className={`sg-btn ${nuova ? 'sg-btn-linea' : 'sg-btn-pieno'}`} onClick={() => setNuova(!nuova)} aria-expanded={nuova}>
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
            if (pronto) apri()
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
            <span id="sz-titolo-conto" className="num sg-nota">
              {lungo ?? `${titolo.trim().length}/${MAX_TITOLO}`}
            </span>
          </Campo>
          <Campo id="sz-testo" etichetta="COSA" manca={!!testoLungo}>
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
            {testoLungo && (
              <span id="sz-testo-nota" className="num sg-nota">
                {testoLungo}
              </span>
            )}
          </Campo>
          {/* Il motivo sta sotto i campi, dove si guarda scrivendo, non in fondo alla riga dei tasti. */}
          {motivo && (
            <span id="sz-motivo" className="sg-nota">
              {motivo}
            </span>
          )}
          <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <button type="submit" className="sg-btn sg-btn-verde" disabled={!pronto} aria-describedby={motivo ? 'sz-motivo' : undefined}>
              MANDA
            </button>
            <button type="button" className="sg-btn sg-btn-linea" onClick={lasciaStare}>
              LASCIA STARE
            </button>
          </div>
        </form>
      )}

      {elenco.guaio && <Guaio testo={elenco.guaio} />}
      {elenco.dato === null && !elenco.guaio && <p className="sg-sotto">Sto leggendo le segnalazioni…</p>}
      {elenco.dato !== null && lista.length === 0 && (
        <p className="sg-sotto">{chiuse || !tutte.length ? 'Nessuna segnalazione.' : 'Nessuna aperta. Le altre si vedono con ANCHE LE CHIUSE.'}</p>
      )}

      <div className="stack" style={{ gap: 10, maxWidth: 760 }}>
        {lista.map((s) => (
          <Filo
            key={s.id}
            s={s}
            aperto={aperta === s.id}
            onApri={() => setAperta(aperta === s.id ? null : s.id)}
            onTieni={() => setTenute((t) => new Set(t).add(s.id))}
            d={d}
            fai={fai}
            avvisa={avvisa}
            lavora={lavora}
            poi={poi}
          />
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
  onTieni,
  d,
  fai,
  avvisa,
  lavora,
  poi,
}: {
  s: Segnalazione
  aperto: boolean
  onApri: () => void
  onTieni: () => void
  d: DatiSegreteria
  fai: ReturnType<typeof useAvviso>['fai']
  avvisa: ReturnType<typeof useAvviso>['avvisa']
  lavora: boolean
  poi: () => Promise<void>
}) {
  const [risposta, setRisposta] = useBozza(chiaveRisposta(d.modo, s.id))
  const testa = useRef<HTMLButtonElement>(null)
  const rispostaLunga = troppoLungo('Testo', risposta, MAX_TESTO)
  const motivo = motivoSpento({ testo: risposta, lavora, risposta: true })
  const pronta = !lavora && !motivo && !rispostaLunga
  const rispondi = () => void fai(() => d.rispondiSegnalazione(s.id, risposta), 'Risposta mandata', async () => (setRisposta(''), await poi()))
  // Il filo riaperto risale tra le aperte: il fuoco lo segue, come dopo la chiusura.
  const riapri = () => void fai(() => d.chiudiSegnalazione(s.id, false), 'Segnalazione riaperta', async () => (await poi(), testa.current?.focus()))
  // Buttare una bozza si annulla dall'avviso; il fuoco torna sulla testata, il tasto sparisce.
  const buttaVia = () => {
    const vecchia = risposta
    setRisposta('')
    // Una chiusa in vista solo per la bozza non sparisce sotto il dito: resta come le appena chiuse.
    onTieni()
    avvisa('Risposta buttata via', false, { etichetta: 'RIPRENDI', fa: () => (setRisposta(vecchia), avvisa('Risposta ripresa')) })
    testa.current?.focus()
  }
  // Chiude senza buttare la risposta scritta (vedi `chiudiConRisposta`). Il
  // filo resta in fondo, spento, e il fuoco ci torna sopra: il tasto toccato
  // non c'è più, e il fuoco non deve finire in cima alla pagina.
  const chiudi = () => {
    let esito = { mandata: false, chiusa: false }
    void fai(
      async () => {
        esito = await chiudiConRisposta(d, s.id, risposta)
      },
      undefined,
      async () => {
        if (esito.mandata) setRisposta('')
        if (esito.chiusa) onTieni()
        avvisa(avvisoChiusura(esito), !esito.chiusa, esito.chiusa ? { etichetta: 'RIAPRI', fa: riapri } : undefined)
        await poi()
        testa.current?.focus()
      },
    )
  }

  return (
    <div className="card stack sg-filo" data-tocca={tocca(s) || undefined} data-chiusa={!!s.chiusaIl || undefined} style={{ padding: 0, gap: 0 }}>
      <button ref={testa} type="button" className="sg-filo-testa" onClick={onApri} aria-expanded={aperto}>
        <span className="stack grow" style={{ gap: 2, minWidth: 0 }}>
          <span className="sg-filo-titolo">{s.titolo}</span>
          <span className="sg-filo-riga">{rigaFilo(s)}</span>
        </span>
        {/* Una risposta scritta e non mandata si vede anche a filo chiuso a fisarmonica. */}
        {risposta.trim() && !aperto && <span className="num sg-tag">BOZZA</span>}
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
            // Gli altri hanno la barra a sinistra: in un filo lungo si vede chi ha scritto cosa.
            <div key={m.id} className="stack sg-messaggio" data-altro={!m.mio || undefined}>
              <span className="sg-filo-riga">
                <strong style={{ color: 'var(--text)' }}>{m.autore}</strong> · {quando(m.il)}
              </span>
              <span style={{ fontSize: 15, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{m.testo}</span>
            </div>
          ))}
          {s.chiusaIl && <span className="sg-filo-riga">Chiusa {quando(s.chiusaIl)}.</span>}
          {!s.chiusaIl && (
            <form
              className="stack"
              style={{ gap: 8 }}
              onSubmit={(e) => {
                e.preventDefault()
                if (pronta) rispondi()
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
              {rispostaLunga && (
                <span id={`sz-r-${s.id}-nota`} className="num sg-nota">
                  {rispostaLunga}
                </span>
              )}
              {motivo && (
                <span id={`sz-r-${s.id}-motivo`} className="sg-nota">
                  {motivo}
                </span>
              )}
              <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <button type="submit" className="sg-btn sg-btn-verde" disabled={!pronta} aria-describedby={motivo ? `sz-r-${s.id}-motivo` : undefined}>
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
            <div className="stack" style={{ gap: 8 }}>
              {/* Una risposta scritta e poi il filo chiuso (anche da un altro): non si butta in silenzio. */}
              {risposta.trim() && (
                <>
                  <span className="sg-nota">Hai una risposta non mandata: RIAPRI per mandarla, o BUTTA VIA.</span>
                  <div className="sg-bozza">{risposta}</div>
                </>
              )}
              <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                <button type="button" className="sg-btn sg-btn-linea" disabled={lavora} onClick={riapri}>
                  RIAPRI
                </button>
                {risposta.trim() && (
                  <button type="button" className="sg-btn sg-btn-linea" onClick={buttaVia}>
                    BUTTA VIA
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
