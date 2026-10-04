import { useEffect, useMemo, useRef, useState } from 'react'
import { nomeVoce, type AllenamentoSeg, type DatiSegreteria } from '../../lib/segreteria'
import { Spunta } from '../Icons'
import { italianVoices, speak } from '../../../timer/src/lib/audio'
import { CLIPS, type ClipSpec, exerciseKey, formatoRegistrazione } from '../../../timer/src/lib/voiceClips'
import {
  type Esercizio,
  aggiungiNomi,
  catalogoDiPartenza,
  nomiDaTesto,
  normalizza,
} from '../../../timer/src/lib/esercizi'
import { uid } from '../../../timer/src/lib/format'
import {
  type Disciplina,
  NOME_TUTTE,
  TUTTE,
  dellaDisciplina,
  gruppiPerDisciplina,
  nomeDisciplina,
  nomeDisciplinaValido,
  nuovaDisciplina,
} from '../../../timer/src/lib/discipline'
import { chiedi, ComeFunziona, Guaio, Testa, useAvviso, useBozza, useCarica } from './comune'

type Fai = (op: () => Promise<unknown>, riuscito?: string, poi?: () => unknown) => Promise<unknown>

/** Tutta la larghezza della griglia delle impostazioni: sono elenchi lunghi. */
const LARGO = { gridColumn: '1 / -1' } as const

// ---------------------------------------------------------------------------
// La voce dei tablet
// ---------------------------------------------------------------------------

/** Le voci italiane di questo computer; il sistema le carica anche dopo l'apertura. */
function useVoci() {
  const [voci, setVoci] = useState(() => italianVoices())
  useEffect(() => {
    if (!('speechSynthesis' in window)) return
    const aggiorna = () => setVoci(italianVoices())
    window.speechSynthesis.addEventListener('voiceschanged', aggiorna)
    const t = window.setTimeout(aggiorna, 300)
    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', aggiorna)
      window.clearTimeout(t)
    }
  }, [])
  return voci
}

/**
 * La voce dei tablet: quale voce di sistema, e le clip incise con una voce
 * vera, che la segreteria registra da qui e i tablet scaricano.
 */
export function VoceSale({ d, fai }: { d: DatiSegreteria; fai: Fai }) {
  // I nomi degli esercizi da incidere vengono dal catalogo della palestra.
  const catalogo = useCarica(() => d.eserciziPalestra(), [d])
  const esercizi = catalogo.dato
  // Avvolta: `null` è una scelta (la prima voce del tablet), non «non ancora letta».
  const voce = useCarica(async () => ({ nome: await d.voceSale() }), [d])
  const clip = useCarica(() => d.clipSale(), [d])
  const voci = useVoci()
  const [scritta, setScritta] = useState('')
  const scelta = voce.dato?.nome ?? null
  const letta = !!voce.dato
  useEffect(() => setScritta(scelta ?? ''), [scelta])
  // Un nome scritto e non salvato col tasto: uscendo si chiede. La stessa regola che accende il tasto.
  const daSalvare = letta && scritta.trim() !== (scelta ?? '')
  useBozza(daSalvare, 'La voce dei tablet')
  const salvaVoce = (nome: string | null) =>
    void fai(() => d.salvaVoceSale(nome), 'Voce cambiata: i tablet la prendono al prossimo giro', voce.ricarica)
  const prova = (nome: string) => speak('Lavoro. Burpee più salto', 1, voci.find((v) => v.name === nome)?.voiceURI ?? null)

  return (
    <section aria-label="La voce dei tablet" className="sg-riquadro" style={LARGO}>
      <span className="ob sg-riquadro-titolo">LA VOCE DEI TABLET</span>
      <span style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--dim)' }}>
        Con che voce parla il timer dei tablet di sala, quando i segnali sono BIP + VOCE. Sul tablet si vede e non si cambia.
      </span>

      <div className="stack" style={{ gap: 6 }}>
        <span className="sg-etichetta">VOCE DI SISTEMA</span>
        {voce.guaio && <Guaio testo={`La voce non si legge: ${voce.guaio}`} />}
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
          <button type="button" className="num sg-chip" aria-pressed={letta && scelta === null} disabled={!letta} onClick={() => salvaVoce(null)}>
            LA PRIMA ITALIANA DEL TABLET
          </button>
          {voci.map((v) => (
            <button
              key={v.voiceURI}
              type="button"
              className="num sg-chip"
              aria-pressed={letta && scelta === v.name}
              disabled={!letta}
              title="Sceglila e ascoltala"
              onClick={() => {
                prova(v.name)
                salvaVoce(v.name)
              }}
            >
              {nomeVoce(v.name, voci.map((x) => x.name)).toUpperCase()}
            </button>
          ))}
        </div>
        {voci.length === 0 && <span className="sg-sotto">Questo computer non ha voci italiane: il nome si può scrivere qui sotto.</span>}
        <form
          className="row"
          style={{ gap: 8 }}
          onSubmit={(e) => {
            e.preventDefault()
            salvaVoce(scritta.trim() || null)
          }}
        >
          <input
            className="sg-campo grow"
            aria-label="Il nome della voce del tablet"
            placeholder="il nome di una voce del tablet, per esempio Alice"
            maxLength={200}
            value={scritta}
            disabled={!letta}
            onChange={(e) => setScritta(e.target.value)}
          />
          <button type="submit" className="num sg-chip sg-chip-pieno" style={{ minHeight: 44 }} disabled={!daSalvare} aria-label="Salva la voce">
            <Spunta size={18} />
          </button>
        </form>
        <ComeFunziona>
          Le voci le mette il dispositivo, non l'app: qui ci sono quelle di questo computer, e il tablet usa quella con lo stesso nome se
          ce l'ha, altrimenti la sua prima voce italiana. Se il tablet ne ha una che qui non c'è, se ne scrive il nome. Quelle marcate
          «enhanced» o «premium» suonano molto meno metalliche.
        </ComeFunziona>
      </div>

      <VoceIncisa d={d} fai={fai} chiavi={clip.dato} guaio={clip.guaio} ricarica={clip.ricarica} esercizi={esercizi} />
    </section>
  )
}

/**
 * Le frasi da incidere: quelle fisse del timer, e i nomi degli esercizi della
 * palestra. Si registra da qui, col microfono del computer, e ogni clip va
 * subito sul server: i tablet la scaricano al prossimo giro.
 */
function VoceIncisa({
  d,
  fai,
  chiavi,
  guaio,
  ricarica,
  esercizi,
}: {
  d: DatiSegreteria
  fai: Fai
  chiavi: string[] | null
  guaio: string | null
  ricarica: () => Promise<unknown>
  esercizi: Esercizio[] | null
}) {
  const formato = useMemo(formatoRegistrazione, [])
  const [attiva, setAttiva] = useState<string | null>(null)
  const [problema, setProblema] = useState<string | null>(null)
  // Sono una settantina di frasi: si aprono quando si incide, non a ogni visita.
  const [aperte, setAperte] = useState(false)
  const registratore = useRef<MediaRecorder | null>(null)
  const incise = useMemo(() => new Set(chiavi ?? []), [chiavi])

  const nomiEsercizi = useMemo(() => {
    const visti = new Map<string, string>()
    for (const e of esercizi ?? []) {
      const k = exerciseKey(e.nome)
      if (k && !visti.has(k)) visti.set(k, e.nome.trim())
    }
    return [...visti.entries()].map(([key, text]): ClipSpec => ({ key, text, group: 'Stati' }))
  }, [esercizi])

  const gruppi: Array<[string, ClipSpec[]]> = [
    ['STATI', CLIPS.filter((c) => c.group === 'Stati')],
    ['CONTO ALLA ROVESCIA', CLIPS.filter((c) => c.group === 'Conto alla rovescia')],
    ['MAURIZIO', CLIPS.filter((c) => c.group === 'Maurizio')],
    ['ESERCIZI', nomiEsercizi],
  ]
  const tutte = gruppi.flatMap(([, g]) => g)
  const fatte = tutte.filter((c) => incise.has(c.key)).length

  const registra = async (key: string) => {
    setProblema(null)
    if (!formato) return setProblema('Questo browser non sa registrare audio.')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream, { mimeType: formato.mime })
      const pezzi: BlobPart[] = []
      mr.ondataavailable = (e) => pezzi.push(e.data)
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop())
        setAttiva(null)
        void fai(() => d.salvaClip(key, new Blob(pezzi, { type: formato.mime })), 'Clip salvata: i tablet la prendono al prossimo giro', ricarica)
      }
      registratore.current = mr
      mr.start()
      setAttiva(key)
    } catch {
      setProblema('Microfono non disponibile: controlla il permesso del browser.')
      setAttiva(null)
    }
  }

  const ascolta = async (key: string) => {
    const blob = await d.apriClip(key)
    if (!blob) return setProblema('Questa clip non si apre: riprova tra poco.')
    const url = URL.createObjectURL(blob)
    const a = new Audio(url)
    a.onended = () => URL.revokeObjectURL(url)
    a.play().catch(() => setProblema('Questo browser non sa suonare il formato della clip: sul tablet potrebbe suonare lo stesso.'))
  }

  return (
    <div className="stack" style={{ gap: 10 }}>
      <div className="row" style={{ gap: 10 }}>
        <span className="sg-etichetta grow">VOCE INCISA</span>
        <span className="num" style={{ fontSize: 14, fontWeight: 700, color: 'var(--dim)' }}>
          {chiavi ? `${fatte}/${tutte.length}` : '…'}
        </span>
      </div>
      <span style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--dim)' }}>Frasi registrate con una voce vera al posto della sintesi, per tutti i tablet.</span>
      <ComeFunziona>
        Si può incidere un pezzo per volta: dove manca la clip, il tablet torna da solo alla voce di sistema. Le usa se nelle impostazioni del
        timer del tablet è acceso «Usa le clip incise». Meglio registrare dal browser che usano i tablet: Safari e Chrome registrano in formati
        diversi.
      </ComeFunziona>
      {guaio && <Guaio testo={`Le clip non si leggono: ${guaio}`} />}
      {!formato && <Guaio testo="Questo browser non permette di registrare audio: si incide da un altro." />}
      {problema && <Guaio testo={problema} />}

      <button type="button" className="sg-btn sg-btn-linea" style={{ alignSelf: 'flex-start' }} disabled={!chiavi} onClick={() => setAperte((a) => !a)}>
        {aperte ? 'CHIUDI LE FRASI' : 'APRI LE FRASI DA INCIDERE'}
      </button>

      {aperte && gruppi.map(([titolo, frasi]) => (
        <div key={titolo} className="stack" style={{ gap: 6 }}>
          <span className="sg-etichetta" style={{ fontSize: 11 }}>
            {titolo} · {frasi.filter((c) => incise.has(c.key)).length}/{frasi.length}
          </span>
          {frasi.length === 0 && (
            <span className="sg-sotto">
              {esercizi ? 'Il catalogo degli esercizi è vuoto.' : 'Prima si fa il catalogo degli esercizi della palestra, in ESERCIZI.'}
            </span>
          )}
          <div className="sg-frasi">
            {frasi.map((c) => {
              const incisa = incise.has(c.key)
              const inCorso = attiva === c.key
              return (
                <div key={c.key} className="row sg-voce-elenco" style={{ gap: 8, flexWrap: 'wrap', borderColor: inCorso ? 'var(--rosso)' : incisa ? 'var(--verde)' : undefined }}>
                  <span className="stack" style={{ flex: '1 1 150px', minWidth: 0 }}>
                    <span style={{ fontSize: 15, fontWeight: 600 }}>«{c.text}»</span>
                    {c.hint && <span style={{ fontSize: 12, color: 'var(--dim)' }}>{c.hint}</span>}
                  </span>
                  {incisa && !inCorso && (
                    <>
                      <button type="button" className="num sg-chip" onClick={() => void ascolta(c.key)}>
                        ASCOLTA
                      </button>
                      <button
                        type="button"
                        className="num sg-chip"
                        onClick={async () => {
                          if ((await chiedi(`Togliere la clip «${c.text}»? I tablet torneranno alla voce di sistema.`, 'TOGLI LA CLIP'))) void fai(() => d.togliClip(c.key), 'Clip tolta', ricarica)
                        }}
                      >
                        TOGLI
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    className={`num sg-chip${inCorso ? ' sg-chip-pieno' : ''}`}
                    style={{ ...(inCorso ? { background: 'var(--rosso)', borderColor: 'var(--rosso)', color: 'var(--su-rosso)' } : {}) }}
                    disabled={!formato || !chiavi || (attiva !== null && !inCorso)}
                    onClick={() => (inCorso ? registratore.current?.stop() : void registra(c.key))}
                  >
                    {inCorso ? 'FERMA' : incisa ? 'RIFAI' : 'REGISTRA'}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Gli esercizi della palestra
// ---------------------------------------------------------------------------

/**
 * Il catalogo degli esercizi dei tablet: i nomi che si scelgono scrivendo un
 * timer, e quelli che la voce incisa sa dire. Finché la segreteria non ne fa
 * uno, i tablet tengono il loro. Una voce del menu a sé: si cura ogni tanto,
 * e non è un'impostazione.
 */
export function EserciziPalestra({ d }: { d: DatiSegreteria }) {
  // Avvolto: un catalogo nullo vuol dire «mai fatto», non «non ancora letto».
  const letto = useCarica(async () => ({ lista: await d.eserciziPalestra(), discipline: await d.discipline() }), [d])
  const catalogo = letto.dato ? letto.dato.lista : undefined
  const discipline = letto.dato?.discipline ?? []
  const { guaio, ricarica } = letto
  const { avviso, fai } = useAvviso()
  const [cerca, setCerca] = useState('')
  const [filtroDisciplina, setFiltroDisciplina] = useState('')
  const [aperto, setAperto] = useState<{ id: string; nome: string; disciplina?: string } | null>(null)
  const [nuovo, setNuovo] = useState<{ nome: string; disciplina?: string }>({ nome: '' })
  const [incolla, setIncolla] = useState<string | null>(null)

  const lista = catalogo ?? []
  // Un filtro su una categoria tolta nel frattempo non resta acceso.
  const filtro = discipline.some((x) => x.id === filtroDisciplina) ? filtroDisciplina : ''
  const salva = (l: Esercizio[], riuscito: string, poi?: () => void) =>
    void fai(() => d.salvaEserciziPalestra(l), riuscito, async () => {
      poi?.()
      await ricarica()
    })
  const libero = (nome: string, tranne?: string) => !lista.some((e) => e.id !== tranne && normalizza(e.nome) === normalizza(nome))

  const q = normalizza(cerca)
  const gruppi = gruppiPerDisciplina(
    dellaDisciplina(lista, filtro || null)
      .filter((e) => !q || normalizza(e.nome).includes(q))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'it')),
    discipline,
  )

  return (
    <>
    <Testa titolo="ESERCIZI" sotto="L'elenco della palestra: crea, rinomina, sposta di categoria.">
      {catalogo && <span className="num" style={{ fontSize: 14, fontWeight: 700, color: 'var(--dim)' }}>{lista.length} ESERCIZI</span>}
    </Testa>
    {letto.dato && <DisciplinePalestra d={d} lista={discipline} ricarica={ricarica} />}
    <section aria-label="Gli esercizi della palestra" className="sg-riquadro">
      <span style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--dim)' }}>
        L'elenco che i tablet di sala propongono scrivendo un timer, e i nomi che la voce incisa sa dire (in IMPOSTAZIONI › LA VOCE DEI
        TABLET). Rinominare qui non cambia i timer già salvati: il vecchio nome resta dov'è. Chi usa il timer dal suo telefono tiene il suo
        elenco.
      </span>
      {guaio && <Guaio testo={`Gli esercizi non si leggono: ${guaio}`} />}

      {catalogo === null && !guaio && (
        <div className="stack" style={{ gap: 8, alignItems: 'flex-start' }}>
          <span style={{ fontSize: 14, color: 'var(--sec)' }}>Non c'è ancora: ogni tablet usa l'elenco che ha.</span>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="sg-btn sg-btn-linea" onClick={() => salva(catalogoDiPartenza(), 'Catalogo creato: i tablet lo prendono al prossimo giro')}>
              PARTI DA QUELLO DI BASE
            </button>
            <button type="button" className="sg-btn sg-btn-linea" onClick={() => salva([], 'Catalogo vuoto creato')}>
              PARTI DA ZERO
            </button>
          </div>
        </div>
      )}

      {catalogo && (
        <>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <input className="sg-campo grow" aria-label="Cerca un esercizio" placeholder="cerca" value={cerca} onChange={(e) => setCerca(e.target.value)} />
            {discipline.length > 0 && (
              <select className="sg-campo" aria-label="Categoria" value={filtro} onChange={(e) => {
                  // Un esercizio creato con un filtro acceso parte da quella categoria, come nel picker del timer.
                  setFiltroDisciplina(e.target.value)
                  setNuovo((n) => ({ ...n, disciplina: e.target.value || undefined }))
                }}>
                <option value="">Tutte le categorie</option>
                {discipline.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.nome}
                  </option>
                ))}
              </select>
            )}
          </div>

          {gruppi.length === 0 && <span className="sg-sotto">{lista.length ? 'Nessun esercizio con questo nome.' : 'Il catalogo è vuoto.'}</span>}
          {gruppi.map((g) => (
            <div key={g.chiave} className="stack" style={{ gap: 6 }}>
              <span className="sg-etichetta" style={{ fontSize: 11 }}>
                {g.nome.toUpperCase()} · {g.voci.length}
              </span>
              <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                {g.voci.map((e) =>
                  aperto?.id === e.id ? (
                    <form
                      key={e.id}
                      className="row sg-voce-elenco"
                      style={{ gap: 8, borderColor: 'var(--text)', flexBasis: '100%', flexWrap: 'wrap' }}
                      onSubmit={(ev) => {
                        ev.preventDefault()
                        const nome = aperto.nome.trim()
                        if (!nome || !libero(nome, e.id)) return
                        salva(
                          lista.map((x) => {
                            if (x.id !== e.id) return x
                            const { disciplina: _tolta, ...resto } = x
                            return { ...resto, nome, ...(aperto.disciplina ? { disciplina: aperto.disciplina } : {}) }
                          }),
                          'Esercizio salvato',
                          () => setAperto(null),
                        )
                      }}
                    >
                      <input className="sg-campo grow" aria-label="Nome dell'esercizio" required autoFocus maxLength={60} value={aperto.nome} onChange={(ev) => setAperto({ ...aperto, nome: ev.target.value })} />
                      <SelectDisciplina discipline={discipline} valore={aperto.disciplina} etichetta="Categoria dell'esercizio" onCambia={(x) => setAperto({ ...aperto, disciplina: x })} />
                      {!libero(aperto.nome, e.id) && <span style={{ fontSize: 13, color: 'var(--rosso-testo)' }}>C'è già un esercizio con questo nome.</span>}
                      <button
                        type="button"
                        className="num sg-chip"
                        style={{ minHeight: 44 }}
                        onClick={async () => {
                          if ((await chiedi(`Togliere «${e.nome}» dal catalogo? I timer che lo usano restano come sono.`, 'TOGLI L’ESERCIZIO')))
                            salva(lista.filter((x) => x.id !== e.id), 'Esercizio tolto', () => setAperto(null))
                        }}
                      >
                        TOGLI
                      </button>
                      <button type="button" className="num sg-chip" style={{ minHeight: 44 }} onClick={() => setAperto(null)}>
                        LASCIA STARE
                      </button>
                      <button type="submit" className="num sg-chip sg-chip-pieno" style={{ minHeight: 44 }} disabled={!aperto.nome.trim() || !libero(aperto.nome, e.id)} aria-label="Salva l'esercizio">
                        <Spunta size={18} />
                      </button>
                    </form>
                  ) : (
                    <button key={e.id} type="button" className="num sg-chip" style={{ letterSpacing: '0.04em' }} onClick={() => setAperto({ id: e.id, nome: e.nome, disciplina: e.disciplina })}>
                      {e.nome}
                    </button>
                  ),
                )}
              </div>
            </div>
          ))}

          <form
            className="row sg-voce-elenco"
            style={{ gap: 8, flexWrap: 'wrap' }}
            onSubmit={(ev) => {
              ev.preventDefault()
              const nome = nuovo.nome.trim()
              if (!nome || !libero(nome)) return
              salva([...lista, { id: uid(), nome, ...(nuovo.disciplina ? { disciplina: nuovo.disciplina } : {}) }], 'Esercizio aggiunto', () => setNuovo({ ...nuovo, nome: '' }))
            }}
          >
            <input className="sg-campo grow" aria-label="Nuovo esercizio" placeholder="un esercizio nuovo" maxLength={60} value={nuovo.nome} onChange={(e) => setNuovo({ ...nuovo, nome: e.target.value })} />
            <SelectDisciplina discipline={discipline} valore={nuovo.disciplina} etichetta="Categoria del nuovo esercizio" onCambia={(x) => setNuovo({ ...nuovo, disciplina: x })} />
            {nuovo.nome.trim() && !libero(nuovo.nome) && <span style={{ fontSize: 13, color: 'var(--rosso-testo)' }}>C'è già.</span>}
            <button type="submit" className="num sg-chip sg-chip-pieno" style={{ minHeight: 44 }} disabled={!nuovo.nome.trim() || !libero(nuovo.nome)}>
              AGGIUNGI
            </button>
          </form>

          {incolla === null ? (
            <button type="button" className="sg-btn sg-btn-tratteggio" onClick={() => setIncolla('')}>
              + INCOLLA UN ELENCO
            </button>
          ) : (
            <form
              className="stack sg-voce-elenco"
              style={{ gap: 8, alignItems: 'stretch', borderColor: 'var(--text)' }}
              onSubmit={(ev) => {
                ev.preventDefault()
                const { lista: nuova, aggiunti, saltati } = aggiungiNomi(lista, nomiDaTesto(incolla), nuovo.disciplina)
                if (!aggiunti.length) return
                salva(
                  nuova.map(({ id, nome, disciplina }) => ({ id, nome, ...(disciplina ? { disciplina } : {}) })),
                  `${aggiunti.length} aggiunti${saltati.length ? `, ${saltati.length} c'erano già` : ''}`,
                  () => setIncolla(null),
                )
              }}
            >
              <textarea
                className="sg-campo"
                style={{ minHeight: 120, padding: 10, fontFamily: 'inherit' }}
                aria-label="L'elenco da incollare"
                placeholder="Un esercizio per riga, o separati da virgola"
                autoFocus
                value={incolla}
                onChange={(e) => setIncolla(e.target.value)}
              />
              <div className="row" style={{ gap: 8 }}>
                <span className="grow" style={{ fontSize: 13, color: 'var(--dim)' }}>
                  {nuovo.disciplina ? `Vanno in «${nomeDisciplina(nuovo.disciplina, discipline)}», scelta qui sopra.` : 'Vanno senza categoria.'} Quelli che ci sono già si saltano.
                </span>
                <button type="button" className="num sg-chip" style={{ minHeight: 44 }} onClick={() => setIncolla(null)}>
                  LASCIA STARE
                </button>
                <button type="submit" className="num sg-chip sg-chip-pieno" style={{ minHeight: 44 }} disabled={!nomiDaTesto(incolla).length}>
                  AGGIUNGI {nomiDaTesto(incolla).length || ''}
                </button>
              </div>
            </form>
          )}
        </>
      )}
    </section>
    {avviso}
    </>
  )
}

/** La scelta della disciplina di una voce: nessuna, «Tutte» o una della lista. Non compare se la palestra non ne ha. */
export function SelectDisciplina({
  discipline,
  valore,
  etichetta,
  onCambia,
}: {
  discipline: Disciplina[]
  valore: string | undefined
  etichetta: string
  onCambia: (id: string | undefined) => void
}) {
  if (discipline.length === 0) return null
  return (
    <select className="sg-campo" aria-label={etichetta} value={valore ?? ''} onChange={(ev) => onCambia(ev.target.value || undefined)}>
      <option value="">Nessuna categoria</option>
      <option value={TUTTE}>{NOME_TUTTE} (ogni categoria)</option>
      {discipline.map((x) => (
        <option key={x.id} value={x.id}>
          {x.nome}
        </option>
      ))}
    </select>
  )
}

// ---------------------------------------------------------------------------
// Le discipline della palestra
// ---------------------------------------------------------------------------

/**
 * Judo, Lotta, A corpo libero, Core…: la lista con cui si dividono gli
 * esercizi, i timer e le liste di musica (per chi usa l'app, le «categorie»).
 * La tiene la segreteria; istruttori e tablet la usano per filtrare. «Tutte»
 * non è nella lista: è per le voci comuni a tutte, come il riscaldamento.
 * Togliere una categoria non toglie niente: chi la nominava resta senza.
 */
function DisciplinePalestra({ d, lista, ricarica }: { d: DatiSegreteria; lista: Disciplina[]; ricarica: () => Promise<unknown> | void }) {
  const { avviso, fai } = useAvviso()
  const [aperta, setAperta] = useState<{ id: string; nome: string } | null>(null)
  const [nuova, setNuova] = useState('')
  const salva = (l: Disciplina[], riuscito: string, poi?: () => void) =>
    void fai(() => d.salvaDiscipline(l), riuscito, async () => {
      poi?.()
      await ricarica()
    })
  const sposta = (i: number, verso: -1 | 1) => {
    const l = [...lista]
    ;[l[i], l[i + verso]] = [l[i + verso], l[i]]
    salva(l, 'Ordine cambiato')
  }
  const erroreNuova = nuova.trim() ? nomeDisciplinaValido(nuova, lista) : null

  return (
    <>
      <section aria-label="Le categorie della palestra" className="sg-riquadro">
        <span className="sg-etichetta">LE CATEGORIE</span>
        <span style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--dim)' }}>
          Gli esercizi, i timer e le liste di musica si dividono per categoria. Ognuno ne ha una sola, o nessuna; «{NOME_TUTTE}» è per quelli comuni a
          tutte, e compare sotto ogni categoria. Togliere una categoria non toglie niente: chi la nominava resta senza.
        </span>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
          {lista.length === 0 && <span className="sg-sotto">Nessuna categoria: l'elenco non si divide.</span>}
          {lista.map((x, i) =>
            aperta?.id === x.id ? (
              <form
                key={x.id}
                className="row sg-voce-elenco"
                style={{ gap: 8, borderColor: 'var(--text)', flexBasis: '100%', flexWrap: 'wrap' }}
                onSubmit={(ev) => {
                  ev.preventDefault()
                  const nome = aperta.nome.trim()
                  if (nomeDisciplinaValido(nome, lista, x.id)) return
                  salva(lista.map((y) => (y.id === x.id ? { ...y, nome } : y)), 'Categoria rinominata', () => setAperta(null))
                }}
              >
                <input className="sg-campo grow" aria-label="Nome della categoria" required autoFocus maxLength={30} value={aperta.nome} onChange={(ev) => setAperta({ ...aperta, nome: ev.target.value })} />
                {nomeDisciplinaValido(aperta.nome, lista, x.id) && aperta.nome.trim() && (
                  <span style={{ fontSize: 13, color: 'var(--rosso-testo)' }}>{nomeDisciplinaValido(aperta.nome, lista, x.id)}</span>
                )}
                <button type="button" className="num sg-chip" style={{ minHeight: 44 }} disabled={i === 0} aria-label="Sposta prima" onClick={() => sposta(i, -1)}>
                  ‹
                </button>
                <button type="button" className="num sg-chip" style={{ minHeight: 44 }} disabled={i === lista.length - 1} aria-label="Sposta dopo" onClick={() => sposta(i, 1)}>
                  ›
                </button>
                <button
                  type="button"
                  className="num sg-chip"
                  style={{ minHeight: 44 }}
                  onClick={async () => {
                    if (await chiedi(`Togliere «${x.nome}»? Gli esercizi, i timer e le liste che la nominano restano, senza categoria.`, 'TOGLI LA CATEGORIA'))
                      salva(lista.filter((y) => y.id !== x.id), 'Categoria tolta', () => setAperta(null))
                  }}
                >
                  TOGLI
                </button>
                <button type="button" className="num sg-chip" style={{ minHeight: 44 }} onClick={() => setAperta(null)}>
                  LASCIA STARE
                </button>
                <button type="submit" className="num sg-chip sg-chip-pieno" style={{ minHeight: 44 }} disabled={!!nomeDisciplinaValido(aperta.nome, lista, x.id)} aria-label="Salva la categoria">
                  <Spunta size={18} />
                </button>
              </form>
            ) : (
              <button key={x.id} type="button" className="num sg-chip" style={{ letterSpacing: '0.04em' }} onClick={() => setAperta({ id: x.id, nome: x.nome })}>
                {x.nome}
              </button>
            ),
          )}
        </div>
        <form
          className="row sg-voce-elenco"
          style={{ gap: 8, flexWrap: 'wrap' }}
          onSubmit={(ev) => {
            ev.preventDefault()
            if (!nuova.trim() || nomeDisciplinaValido(nuova, lista)) return
            salva([...lista, nuovaDisciplina(nuova, lista)], 'Categoria aggiunta', () => setNuova(''))
          }}
        >
          <input className="sg-campo grow" aria-label="Nuova categoria" placeholder="una categoria nuova" maxLength={30} value={nuova} onChange={(e) => setNuova(e.target.value)} />
          {erroreNuova && <span style={{ fontSize: 13, color: 'var(--rosso-testo)' }}>{erroreNuova}</span>}
          <button type="submit" className="num sg-chip sg-chip-pieno" style={{ minHeight: 44 }} disabled={!nuova.trim() || !!erroreNuova}>
            AGGIUNGI
          </button>
        </form>
      </section>
      {avviso}
    </>
  )
}

// ---------------------------------------------------------------------------
// Lo storico dei timer
// ---------------------------------------------------------------------------

const QUANTI = 50

const quando = new Intl.DateTimeFormat('it-IT', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

function durata(secondi: number) {
  const m = Math.floor(secondi / 60)
  const s = secondi % 60
  if (m >= 60) return `${Math.floor(m / 60)} h ${m % 60} min`
  if (m === 0) return `${s} s`
  return s ? `${m} min ${s} s` : `${m} min`
}

/** Gli ultimi timer fatti partire, sui tablet e sui telefoni degli istruttori. */
export function StoricoTimer({ d }: { d: DatiSegreteria }) {
  const [quanti, setQuanti] = useState(QUANTI)
  const storico = useCarica(() => d.allenamenti(quanti), [d, quanti])
  const [ultimi, setUltimi] = useState<AllenamentoSeg[] | null>(null)
  // Chiedendone altri la lista non si svuota mentre arrivano.
  useEffect(() => {
    if (storico.dato) setUltimi(storico.dato)
  }, [storico.dato])
  const righe = ultimi ?? []

  return (
    <section aria-label="Lo storico dei timer" className="sg-riquadro" style={LARGO}>
      <span className="ob sg-riquadro-titolo">LO STORICO DEI TIMER</span>
      <span style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--dim)' }}>
        {d.modo === 'prova'
          ? 'In prova, i timer arrivati in fondo (o fermati prima) sul timer di questo dispositivo.'
          : 'I timer arrivati in fondo, o fermati prima, sui tablet di sala e sui telefoni degli istruttori collegati, con la lezione in cui sono partiti.'}
      </span>
      {storico.guaio && <Guaio testo={`Lo storico non si legge: ${storico.guaio}`} />}
      {!ultimi && !storico.guaio && <span className="sg-sotto">Un attimo…</span>}
      {ultimi && righe.length === 0 && <span className="sg-sotto">Ancora nessun timer registrato.</span>}
      {righe.length > 0 && (
        <div className="stack" style={{ gap: 4 }}>
          {righe.map((r) => (
            <div key={r.id} className="row sg-voce-elenco" style={{ gap: 12, flexWrap: 'wrap' }}>
              <span className="num" style={{ fontSize: 13, color: 'var(--sec)', minWidth: 150 }}>
                {quando.format(new Date(r.finitoIl)).toUpperCase()}
              </span>
              <span className="stack grow" style={{ minWidth: 160 }}>
                <span style={{ fontSize: 15, fontWeight: 600 }}>{r.nome}</span>
                <span style={{ fontSize: 12, color: 'var(--dim)' }}>
                  {r.chi}
                  {r.corso ? ` · ${r.corso}` : ''}
                </span>
              </span>
              <span className="num" style={{ fontSize: 15, fontWeight: 700, minWidth: 70, textAlign: 'right' }}>
                {durata(r.secondi)}
              </span>
              <span className="num sg-tag" data-tipo={r.completato ? undefined : 'sostituto'} style={{ fontSize: 11, padding: '2px 6px', minWidth: 82, textAlign: 'center' }}>
                {r.completato ? 'COMPLETATO' : 'FERMATO PRIMA'}
              </span>
            </div>
          ))}
        </div>
      )}
      {righe.length >= quanti && (
        <button type="button" className="sg-btn sg-btn-linea" style={{ alignSelf: 'flex-start' }} onClick={() => setQuanti((q) => q + QUANTI)}>
          ALTRI {QUANTI}
        </button>
      )}
    </section>
  )
}
