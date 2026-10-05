import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { DatiSegreteria } from '../../lib/segreteria'
import {
  AllegatiNonPartiti,
  MAX_ALLEGATI,
  MAX_TESTO,
  MAX_TITOLO,
  avvisoChiusura,
  chiaveBozza,
  chiaveRisposta,
  conBozza,
  chiudiConRisposta,
  avvisoNonPartiti,
  etichettaChiudi,
  haAnteprima,
  leggiBozza,
  motivoSenzaRete,
  motivoSpento,
  nomeCategoria,
  segnapostoTesto,
  testoWhatsApp,
  avvisoCategoria,
  CATEGORIE,
  eCategoria,
  type Categoria,
  quando,
  rigaFilo,
  scegliAllegati,
  scriviBozza,
  sessione,
  tocca,
  troppoLungo,
  visibili,
  type Allegato,
  type Messaggio,
  type Segnalazione,
} from '../../lib/segnalazioni'
import { indirizzo, INDIRIZZI } from '../../lib/aree'
import { Campo, Guaio, Testa, chiedi, useAvviso, useCarica } from './comune'

/**
 * WhatsApp con l'avviso già scritto: senza numero, a chi mandarlo si sceglie
 * lì. La segreteria non ha un indirizzo per voce: si dice dove guardare.
 */
const avvisoWhatsApp = (s: Segnalazione) => `https://wa.me/?text=${encodeURIComponent(testoWhatsApp(s, indirizzo(INDIRIZZI.segreteria)))}`

/** IDEA o CORREZIONE: due tasti, ne è premuto al massimo uno. */
function SceltaCategoria({ id, scelta, onScegli, disabled }: { id: string; scelta?: Categoria; onScegli: (c: Categoria) => void; disabled?: boolean }) {
  return (
    <div className="row" role="group" aria-labelledby={id} style={{ gap: 8, flexWrap: 'wrap' }}>
      {CATEGORIE.map((c) => (
        <button key={c} type="button" className="num sg-chip" aria-pressed={c === scelta} disabled={disabled} onClick={() => onScegli(c)}>
          {nomeCategoria(c)}
        </button>
      ))}
    </div>
  )
}

/** Una bozza che resta se si cambia voce e si torna (vedi `leggiBozza`). */
function useBozza(chiave: string) {
  const [valore, setValore] = useState(() => leggiBozza(sessione(), chiave))
  const cambia = (v: string) => {
    setValore(v)
    scriviBozza(sessione(), chiave, v)
  }
  return [valore, cambia] as const
}

type Fai = ReturnType<typeof useAvviso>['fai']

/** I file scelti per un messaggio, con quel che non va detto accanto (non sparisce da solo). */
function useFile() {
  const [file, setFile] = useState<File[]>([])
  const [guaio, setGuaio] = useState('')
  const aggiungi = (nuovi: File[]) => {
    const { dentro, guaio: no } = scegliAllegati(file, nuovi)
    setFile(dentro)
    setGuaio(no)
  }
  const togli = (i: number) => {
    setFile(file.filter((_, k) => k !== i))
    setGuaio('')
  }
  const svuota = () => {
    setFile([])
    setGuaio('')
  }
  return { file, guaio, aggiungi, togli, svuota }
}

/** Incollare uno screenshot nel campo del testo allega l'immagine copiata (il testo incollato passa liscio). */
const incollaFile = (aggiungi: (f: File[]) => void) => (e: React.ClipboardEvent) => {
  const immagini = [...e.clipboardData.files].filter((f) => f.type.startsWith('image/'))
  if (!immagini.length) return
  e.preventDefault()
  aggiungi(immagini)
}

/** Se c'è rete, e il tasto lo dice appena cambia, senza aspettare un altro disegno. */
function useOnline() {
  const ascolta = (cambia: () => void) => {
    window.addEventListener('online', cambia)
    window.addEventListener('offline', cambia)
    return () => {
      window.removeEventListener('online', cambia)
      window.removeEventListener('offline', cambia)
    }
  }
  return useSyncExternalStore(ascolta, () => navigator.onLine)
}

/** Il tasto per scegliere i file, quelli già scelti, e l'avviso sui dati: sta accanto al campo, dove si guarda scrivendo. */
function Allega({ f, id }: { f: ReturnType<typeof useFile>; id: string }) {
  const sel = useRef<HTMLInputElement>(null)
  const pieno = f.file.length >= MAX_ALLEGATI
  const scegli = (e: React.ChangeEvent<HTMLInputElement>) => {
    f.aggiungi([...(e.target.files ?? [])])
    e.target.value = ''
  }
  return (
    <div className="stack" style={{ gap: 6 }}>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <button type="button" className="sg-btn sg-btn-linea" disabled={pieno} onClick={() => sel.current?.click()} aria-describedby={`${id}-avviso`}>
          ALLEGA UN FILE
        </button>
        <input ref={sel} id={id} type="file" className="vh" tabIndex={-1} accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf" multiple onChange={scegli} />
        <span className="sg-nota">{pieno ? `Basta file: al massimo ${MAX_ALLEGATI}, toglierne uno per aggiungerne un altro.` : 'Oppure incolla uno screenshot nel testo.'}</span>
      </div>
      <span id={`${id}-avviso`} className="sg-nota">
        Niente certificati o documenti. Negli screenshot copri nomi di iscritti e bambini.
      </span>
      {f.guaio && (
        <span role="alert" className="sg-nota" style={{ borderLeft: '4px solid var(--rosso)', paddingLeft: 8 }}>
          {f.guaio}
        </span>
      )}
      {f.file.length > 0 && <span className="sg-nota">I file non restano come il testo: se cambi voce o butti via, vanno rimessi.</span>}
      {f.file.map((x, i) => (
        <span key={`${x.name}-${i}`} className="row" style={{ gap: 8, alignItems: 'center' }}>
          <span className="sg-nota" style={{ overflowWrap: 'anywhere' }}>
            {x.name}
          </span>
          <button type="button" className="sg-btn sg-btn-linea" onClick={() => f.togli(i)} aria-label={`Non allegare ${x.name}`}>
            TOGLI
          </button>
        </span>
      ))}
    </div>
  )
}

/** Un allegato nel filo: l'anteprima se è un'immagine, APRI con un link nuovo, TOGLI per chi l'ha mandato. */
function RigaAllegato({ a, d, fai, poi, lavora }: { a: Allegato; d: DatiSegreteria; fai: Fai; poi: () => Promise<void>; lavora: boolean }) {
  const [anteprima, setAnteprima] = useState<string>()
  const [tentativi, setTentativi] = useState(0)
  // Senza anteprima (HEIC, PDF) resta solo APRI.
  const immagine = haAnteprima(a.tipo)
  useEffect(() => {
    if (!immagine) return
    let vivo = true
    d.linkAllegato(a.id).then(
      (u) => vivo && setAnteprima(u),
      () => undefined,
    )
    return () => {
      vivo = false
    }
  }, [d, a.id, immagine, tentativi])
  const apri = () => void fai(async () => void window.open(await d.linkAllegato(a.id), '_blank', 'noopener'))
  const togli = async () => {
    if (!(await chiedi(`Togliere «${a.nome}»? Non si torna indietro.`, 'SÌ, TOGLILO', { pericolo: true }))) return
    void fai(() => d.togliAllegato(a.id), 'Allegato tolto', poi)
  }
  return (
    <span className="row" style={{ gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
      {/* Il link dura 10 minuti: se l'anteprima non si carica più se ne chiede uno nuovo, una volta. */}
      {anteprima && <img src={anteprima} alt="" style={{ maxHeight: 96, maxWidth: 160 }} onError={() => tentativi < 1 && setTentativi(tentativi + 1)} />}
      <span className="sg-nota" style={{ overflowWrap: 'anywhere' }}>
        {a.nome}
      </span>
      <button type="button" className="sg-btn sg-btn-linea" disabled={lavora} onClick={apri} aria-label={`Apri ${a.nome}`}>
        APRI
      </button>
      {a.mio && (
        <button type="button" className="sg-btn sg-btn-linea" disabled={lavora} onClick={togli} aria-label={`Togli ${a.nome}`}>
          TOGLI
        </button>
      )}
    </span>
  )
}

/** I file di un messaggio e le righe «allegato tolto»: chi lo ha tolto e quando, non cosa conteneva. */
function Allegati({ m, d, fai, poi, lavora }: { m: Messaggio; d: DatiSegreteria; fai: Fai; poi: () => Promise<void>; lavora: boolean }) {
  return (
    <>
      {m.allegati?.map((a) => <RigaAllegato key={a.id} a={a} d={d} fai={fai} poi={poi} lavora={lavora} />)}
      {m.tolti?.map((x, i) => (
        <span key={i} className="sg-filo-riga">
          Allegato tolto da {x.da}, {quando(x.il)}.
        </span>
      ))}
    </>
  )
}

/**
 * Se qualche file non è partito il messaggio c'è lo stesso: lo si dice dopo,
 * e riprovare con tutto il testo lo manderebbe due volte.
 */
async function mandaConFile(manda: () => Promise<string | void>): Promise<{ id: string; nonPartiti: string[] }> {
  try {
    return { id: (await manda()) ?? '', nonPartiti: [] }
  } catch (e) {
    if (e instanceof AllegatiNonPartiti) return { id: e.id, nonPartiti: e.nomi }
    throw e
  }
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
  // Parte vuota e va scelta: una scelta già fatta resterebbe lì anche per l'altra.
  const [scelta, setScelta] = useBozza(chiaveBozza(d.modo, 'nuova-categoria'))
  const categoria = eCategoria(scelta) ? scelta : undefined
  const [nuova, setNuova] = useState(() => !!(titolo || testo || categoria))
  const f = useFile()
  const inRete = useOnline()
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
  const motivo = motivoSpento({ titolo, testo, lavora, categoria }) ?? motivoSenzaRete(inRete, f.file.length)
  // Si manda se non manca niente e niente è troppo lungo: vale per il tasto e per Invio.
  const pronto = !lavora && !motivo && !lungo && !testoLungo
  const svuota = () => {
    setTitolo('')
    setTesto('')
    setScelta('')
    f.svuota()
    setNuova(false)
  }
  // LASCIA STARE butta via, ma si riprende dall'avviso: un tocco sbagliato col telefono che suona non perde niente.
  const lasciaStare = () => {
    const [t, x, c, conFile] = [titolo, testo, scelta, f.file.length > 0]
    svuota()
    if (t.trim() || x.trim() || c)
      avvisa('Segnalazione buttata via', false, {
        etichetta: 'RIPRENDI',
        fa: () => {
          setTitolo(t)
          setTesto(x)
          setScelta(c)
          setNuova(true)
          avvisa(conFile ? 'Segnalazione ripresa: i file vanno riallegati' : 'Segnalazione ripresa')
        },
      })
  }
  const apri = () => {
    if (!categoria) return
    let esito = { id: '', nonPartiti: [] as string[] }
    void fai(
      async () => {
        esito = await mandaConFile(() => d.apriSegnalazione(titolo, testo, categoria, f.file))
      },
      undefined,
      async () => {
        svuota()
        await poi()
        setAperta(esito.id)
        if (esito.nonPartiti.length) avvisa(avvisoNonPartiti(esito.nonPartiti), true)
        else avvisa('Segnalazione mandata')
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
          style={{ padding: 16, gap: 12, maxWidth: 1100 }}
          onSubmit={(e) => {
            e.preventDefault()
            if (pronto) apri()
          }}
        >
          <div className="stack" style={{ gap: 6 }}>
            <span id="sz-categoria" className="sg-etichetta">
              È UN'IDEA O UNA CORREZIONE?
            </span>
            <SceltaCategoria id="sz-categoria" scelta={categoria} onScegli={setScelta} />
          </div>
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
              rows={8}
              value={testo}
              onChange={(e) => setTesto(e.target.value)}
              placeholder={segnapostoTesto(categoria)}
              onPaste={incollaFile(f.aggiungi)}
              aria-invalid={!!testoLungo || undefined}
              aria-describedby={testoLungo ? 'sz-testo-nota sz-file-avviso' : 'sz-file-avviso'}
            />
            {testoLungo && (
              <span id="sz-testo-nota" className="num sg-nota">
                {testoLungo}
              </span>
            )}
          </Campo>
          <Allega f={f} id="sz-file" />
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

      <div className="stack" style={{ gap: 10, maxWidth: 1100 }}>
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
  fai: Fai
  avvisa: ReturnType<typeof useAvviso>['avvisa']
  lavora: boolean
  poi: () => Promise<void>
}) {
  const [risposta, setRisposta] = useBozza(chiaveRisposta(d.modo, s.id))
  const f = useFile()
  const inRete = useOnline()
  const testa = useRef<HTMLButtonElement>(null)
  const rispostaLunga = troppoLungo('Testo', risposta, MAX_TESTO)
  const motivo = motivoSpento({ testo: risposta, lavora, risposta: true }) ?? motivoSenzaRete(inRete, f.file.length)
  const pronta = !lavora && !motivo && !rispostaLunga
  const rispondi = () => {
    let nonPartiti: string[] = []
    void fai(
      async () => {
        nonPartiti = (await mandaConFile(() => d.rispondiSegnalazione(s.id, risposta, f.file))).nonPartiti
      },
      undefined,
      async () => {
        setRisposta('')
        f.svuota()
        await poi()
        if (nonPartiti.length) avvisa(avvisoNonPartiti(nonPartiti), true)
        else avvisa('Risposta mandata')
      },
    )
  }
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
        {s.categoria && <span className="num sg-tag">{nomeCategoria(s.categoria)}</span>}
        {/* Una risposta scritta e non mandata si vede anche a filo chiuso a fisarmonica. */}
        {risposta.trim() && !aperto && <span className="num sg-tag">BOZZA</span>}
        {s.messaggi.some((m) => m.allegati?.length) && <span className="num sg-tag">ALLEGATO</span>}
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
          {/* In cima, prima di rispondere o avvisare: si cambia se era sbagliata, o si dà ai fili di prima. */}
          <div className="stack" style={{ gap: 6, paddingTop: 12 }}>
            <span id={`sz-c-${s.id}`} className="sg-etichetta">
              È UN'IDEA O UNA CORREZIONE?
            </span>
            <SceltaCategoria
              id={`sz-c-${s.id}`}
              scelta={s.categoria}
              disabled={lavora}
              onScegli={(c) => c !== s.categoria && void fai(() => d.categoriaSegnalazione(s.id, c), avvisoCategoria(c), poi)}
            />
          </div>
          {s.messaggi.map((m) => (
            // Gli altri hanno la barra a sinistra: in un filo lungo si vede chi ha scritto cosa.
            <div key={m.id} className="stack sg-messaggio" data-altro={!m.mio || undefined}>
              <span className="sg-filo-riga">
                <strong style={{ color: 'var(--text)' }}>{m.autore}</strong> · {quando(m.il)}
              </span>
              <span style={{ fontSize: 15, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{m.testo}</span>
              <Allegati m={m} d={d} fai={fai} poi={poi} lavora={lavora} />
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
                rows={8}
                value={risposta}
                onChange={(e) => setRisposta(e.target.value)}
                placeholder="Rispondi…"
                onPaste={incollaFile(f.aggiungi)}
                aria-invalid={!!rispostaLunga || undefined}
                aria-describedby={rispostaLunga ? `sz-r-${s.id}-nota sz-r-${s.id}-file-avviso` : `sz-r-${s.id}-file-avviso`}
              />
              {rispostaLunga && (
                <span id={`sz-r-${s.id}-nota`} className="num sg-nota">
                  {rispostaLunga}
                </span>
              )}
              <Allega f={f} id={`sz-r-${s.id}-file`} />
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
