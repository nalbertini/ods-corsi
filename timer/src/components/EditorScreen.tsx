import { useState, type ReactNode } from 'react'
import type { Esercizio } from '../lib/esercizi'
import { PickerEsercizi } from './PickerEsercizi'
import type { Dove, Exercise, Segment, Workout } from '../types'
import type { Corso } from '../lib/libreria'
import { MODE_BADGE, MODE_FIELDS, MODE_HINT, MODE_LABEL, descriviObiettivo, totalDuration } from '../lib/engine'
import { clock } from '../lib/format'
import { applicaScelta, righeAnteprima } from '../lib/anteprima'
import { Back, Caret, Minus, Play, Plus, Trash } from './Icons'

type Field = keyof Workout

const FIELD_META: Record<string, { label: string; unit: string; step: number; min: number; max: number; tint: string }> = {
  prepare: { label: 'PREPARAZIONE', unit: 's', step: 5, min: 0, max: 120, tint: 'var(--giallo)' },
  work: { label: 'LAVORO', unit: 's', step: 5, min: 5, max: 600, tint: 'var(--rosso)' },
  rest: { label: 'RECUPERO', unit: 's', step: 5, min: 0, max: 600, tint: 'var(--verde)' },
  rounds: { label: 'ROUND', unit: '×', step: 1, min: 1, max: 99, tint: 'var(--text)' },
  sets: { label: 'SERIE', unit: '×', step: 1, min: 1, max: 20, tint: 'var(--text)' },
  setRest: { label: 'RIPOSO SERIE', unit: 's', step: 15, min: 0, max: 600, tint: 'var(--blu)' },
  cooldown: { label: 'DEFATICAMENTO', unit: 's', step: 15, min: 0, max: 900, tint: 'var(--blu)' },
  duration: { label: 'DURATA', unit: 'min', step: 60, min: 60, max: 5400, tint: 'var(--giallo)' },
}


function Stepper({
  field,
  value,
  onChange,
  children,
}: {
  field: Field
  value: number
  onChange: (v: number) => void
  /** Quello che la cella porta con sé sotto il numero: per il lavoro, gli esercizi. */
  children?: ReactNode
}) {
  const m = FIELD_META[field as string]
  const shown = m.unit === 'min' ? Math.round(value / 60) : value
  const clamp = (v: number) => Math.min(m.max, Math.max(m.min, v))
  return (
    <div className="card stack" style={{ gap: 8, padding: '10px 12px 12px', borderTop: `4px solid ${m.tint}` }}>
      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.16em', color: 'var(--dim)' }}>{m.label}</span>
      <div className="row" style={{ gap: 8 }}>
        <button
          className="icon-btn"
          style={{ border: 'none', background: 'var(--surface-2)' }}
          onClick={() => onChange(clamp(value - m.step))}
          aria-label={`Riduci ${m.label}`}
        >
          <Minus size={16} />
        </button>
        <div className="row grow" style={{ justifyContent: 'center', alignItems: 'baseline', gap: 2 }}>
          <span className="num" style={{ fontSize: 30, fontWeight: 700, lineHeight: 1 }}>
            {shown}
          </span>
          <span className="num" style={{ fontSize: 15, fontWeight: 600, color: 'var(--dim)' }}>
            {m.unit}
          </span>
        </div>
        <button
          className="icon-btn"
          style={{ border: 'none', background: 'var(--surface-2)' }}
          onClick={() => onChange(clamp(value + m.step))}
          aria-label={`Aumenta ${m.label}`}
        >
          <Plus size={16} />
        </button>
      </div>
      {children}
    </div>
  )
}

/**
 * Il nome della riga nell'anteprima.
 *
 * Sul timer, sotto le cifre, un recupero dice «Respira»: è un incoraggiamento,
 * e lì lo stato è già scritto sopra a caratteri cubitali. In un elenco di
 * struttura serve invece il nome dello stato, altrimenti non si capisce cosa
 * si sta guardando.
 */
function rigaAnteprima(s: Segment): string {
  if (s.kind === 'work') return s.nota ? `${s.name} · ${s.nota}` : s.name
  const l = s.label.toLowerCase()
  return l.charAt(0).toUpperCase() + l.slice(1)
}

/** Un numero che può anche non esserci: vuoto vuol dire «non lo dico». */
function CampoObiettivo({
  label,
  value,
  step,
  max,
  onChange,
}: {
  label: string
  value: number | undefined
  step?: number
  max: number
  onChange: (v: number | undefined) => void
}) {
  return (
    <label className="stack grow" style={{ gap: 4, minWidth: 0 }}>
      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.16em', color: 'var(--dim)' }}>{label}</span>
      <input
        className="field"
        style={{ padding: '8px 10px', minHeight: 44, fontSize: 15, textAlign: 'center' }}
        type="number"
        inputMode="decimal"
        min={0}
        max={max}
        step={step ?? 1}
        value={value ?? ''}
        placeholder="—"
        onChange={(e) => {
          const n = Number(e.target.value)
          onChange(e.target.value === '' || !Number.isFinite(n) || n <= 0 ? undefined : Math.min(n, max))
        }}
      />
    </label>
  )
}

/** Dove si può mettere un timer che non sta ancora sul database. `qui` è il dispositivo. */
export type Destinazione = Exclude<Dove, 'collega'> | 'qui'

const DESTINAZIONE: Record<Destinazione, { etichetta: string; spiega: string }> = {
  miei: { etichetta: 'I MIEI', spiega: 'Lo ritrovi su ogni dispositivo in cui entri, e lo vedi solo tu finché non lo colleghi a un corso.' },
  palestra: { etichetta: 'PALESTRA', spiega: 'Nella libreria della palestra: lo vedono e lo aprono tutti, tablet di sala compresi.' },
  qui: { etichetta: 'SOLO QUI', spiega: 'Resta su questo dispositivo, come prima del database.' },
}

export function EditorScreen({
  initial,
  nuovo,
  destinazioni,
  corsi,
  catalogo,
  onCatalogo,
  onSave,
  onCancel,
  onSaveAndStart,
}: {
  initial: Workout
  /** Non sta ancora nella libreria: si sta creando, non modificando. */
  nuovo?: boolean
  /** Dove può andare, se non sta già sul database; `null` quando non si sceglie. */
  destinazioni: Destinazione[] | null
  /** I corsi a cui si può collegare, con l'accesso da istruttore. */
  corsi: Corso[]
  catalogo: Esercizio[]
  onCatalogo: (lista: Esercizio[]) => void
  onSave: (w: Workout) => void
  onCancel: () => void
  onSaveAndStart: (w: Workout) => void
}) {
  // Un timer nuovo, con l'accesso, nasce fra i miei: è quello che si vuole
  // quasi sempre, e il dispositivo resta a un tocco.
  const [w, setW] = useState<Workout>(() =>
    nuovo && destinazioni?.includes('miei') && !initial.dove ? { ...initial, dove: 'miei' } : initial,
  )
  // Il picker si apre da una riga dell'anteprima (e allora `bersaglio` è
  // l'esercizio da cambiare) o dai tasti che aggiungono (senza).
  const [scegliendo, setScegliendo] = useState<{ bersaglio?: string } | null>(null)
  // Una riga si apre per volta: obiettivo, serie e cestino per ogni riga,
  // sempre aperti, trasformerebbero un circuito da otto stazioni in un modulo.
  const [rigaAperta, setRigaAperta] = useState<{ i: number; id: string } | null>(null)
  const [tutteLeRighe, setTutteLeRighe] = useState(false)
  // La serie che si sta guardando: 0 vuol dire tutte. Gli esercizi aggiunti
  // da qui finiscono in quella serie, e l'elenco mostra solo quelli che ci si fanno.
  const [serieScelta, setSerieScelta] = useState(0)
  const set = (patch: Partial<Workout>) => setW((prev) => ({ ...prev, ...patch, builtin: false, updatedAt: Date.now() }))

  const fields = MODE_FIELDS[w.mode]
  const steppers = fields.filter((f) => f !== 'sets' || w.mode !== 'fortime')
  // La cella del lavoro è anche dove si scelgono gli esercizi: è lì che si
  // pensa a cosa fare, e scendere fino all'elenco per aggiungerli era un
  // secondo passaggio. Il circuito non ce l'ha: ogni stazione ha la sua durata.
  const cellaLavoro: Field | undefined = steppers.includes('work') ? 'work' : steppers.includes('duration') ? 'duration' : undefined
  // Le serie si distinguono solo quando ce n'è più d'una: il FOR TIME non ne ha.
  const conSerie = w.mode !== 'fortime' && w.sets > 1
  const vista = conSerie && serieScelta <= w.sets ? serieScelta : 0
  const inVista = (e: Exercise) => vista === 0 || !e.serie || e.serie === vista
  const visibili = w.exercises.filter(inVista)
  const nomiEsercizi = visibili.map((e) => e.name.trim()).filter(Boolean)
  // L'anteprima di una serie parte dalla serie: guardando la terza, le prime
  // dodici righe dell'allenamento non direbbero niente.
  const righe = righeAnteprima(w, vista)
  // Un circuito o un amrap di più di dodici righe non si taglia: lì l'anteprima
  // è l'unico elenco, e una stazione nascosta non si potrebbe togliere.
  const tutte = tutteLeRighe || w.mode === 'circuit' || w.mode === 'amrap' || w.mode === 'fortime'
  const mostrate = tutte ? righe : righe.slice(0, 12)

  const scegli = (nomi: string[]) => {
    set({ exercises: applicaScelta(w.exercises, scegliendo?.bersaglio, nomi, vista || undefined) })
    setScegliendo(null)
  }
  const setExerciseDuration = (id: string, duration: number) =>
    set({ exercises: w.exercises.map((e) => (e.id === id ? { ...e, duration } : e)) })
  // Si sposta fra le righe che si vedono: dentro una serie, scambiarla con una
  // riga di un'altra serie, nascosta, sembrerebbe un tocco andato a vuoto.
  const move = (id: string, step: -1 | 1) => {
    const index = visibili.findIndex((e) => e.id === id)
    const to = index + step
    if (index < 0 || to < 0 || to >= visibili.length) return
    const a = w.exercises.indexOf(visibili[index])
    const b = w.exercises.indexOf(visibili[to])
    const list = [...w.exercises]
    ;[list[a], list[b]] = [list[b], list[a]]
    set({ exercises: list })
    // Il pannello segue l'esercizio: la riga sotto il dito adesso è un'altra.
    const i = righeAnteprima({ ...w, exercises: list }, vista).findIndex((r) => r.esercizioId === id)
    setRigaAperta(i < 0 ? null : { i, id })
  }
  const removeExercise = (id: string) => {
    set({ exercises: w.exercises.filter((e) => e.id !== id) })
    setRigaAperta(null)
  }
  const setObiettivo = (id: string, patch: Partial<Pick<Exercise, 'sets' | 'reps' | 'kg'>>) =>
    set({ exercises: w.exercises.map((e) => (e.id === id ? { ...e, ...patch } : e)) })
  /** In quale serie si fa: il tocco passa a quella dopo, e dall'ultima torna a tutte. */
  const cambiaSerie = (ex: Exercise) => {
    const prossima = !ex.serie || ex.serie >= w.sets ? (ex.serie ? undefined : 1) : ex.serie + 1
    set({ exercises: w.exercises.map((e) => (e.id === ex.id ? { ...e, serie: prossima } : e)) })
  }

  const named = { ...w, name: w.name.trim() || 'Timer senza nome' }

  if (scegliendo) {
    return (
      <PickerEsercizi
        catalogo={catalogo}
        onCatalogo={onCatalogo}
        onScegli={scegli}
        onChiudi={() => setScegliendo(null)}
      />
    )
  }

  return (
    <div className="app">
      <div className="topbar">
        <button className="icon-btn" onClick={onCancel} aria-label="Annulla">
          <Back />
        </button>
        <span className="ob grow" style={{ fontSize: 22, fontWeight: 700, letterSpacing: '0.1em' }}>
          {nuovo || initial.builtin || !initial.name ? 'NUOVO TIMER' : 'MODIFICA'}
        </span>
        <button className="btn btn-go" style={{ minHeight: 44, padding: '0 20px', fontSize: 17 }} onClick={() => onSave(named)}>
          SALVA
        </button>
      </div>

      <div className="scroll">
        <div className="pad stack" style={{ gap: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.16em', color: 'var(--dim)' }}>NOME DEL TIMER</span>
          <input
            className="field"
            value={w.name}
            placeholder="Es. Brucia grassi"
            onChange={(e) => set({ name: e.target.value })}
          />
        </div>

        {/* Lo schema si sceglie nella schermata prima, e qui si legge soltanto:
            un elenco di schemi da ri-scegliere dentro l'editor era un bivio
            offerto due volte, e la seconda volta non serviva a nessuno. */}
        <div className="rule">
          <span className="rule-label">SCHEMA</span>
          <div className="rule-line" />
        </div>
        <div className="pad row" style={{ gap: 10, alignItems: 'flex-start', paddingTop: 2 }}>
          <span className="badge badge-tipo" style={{ flexShrink: 0, marginTop: 2 }}>
            {MODE_BADGE[w.mode]}
          </span>
          <span style={{ fontSize: 13, lineHeight: 1.45, color: 'var(--dim)' }}>{MODE_HINT[w.mode]}</span>
        </div>

        <div className="rule">
          <span className="rule-label">STRUTTURA</span>
          <div className="rule-line" />
        </div>
        <div
          className="pad"
          style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}
        >
          {steppers.map((f) => (
            <Stepper key={f} field={f} value={w[f] as number} onChange={(v) => set({ [f]: v } as Partial<Workout>)}>
              {f === cellaLavoro && (
                <button
                  className="scegli-esercizi"
                  data-vuoto={nomiEsercizi.length === 0}
                  onClick={() => setScegliendo({})}
                  title={nomiEsercizi.join(' · ') || undefined}
                >
                  {nomiEsercizi.length === 0 ? (
                    <>
                      <Plus size={14} />
                      ESERCIZI
                    </>
                  ) : (
                    <>
                      <span className="num" style={{ fontSize: 15, fontWeight: 700, color: 'var(--rosso)' }}>
                        {nomiEsercizi.length}
                      </span>
                      <span className="grow" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {nomiEsercizi.join(' · ')}
                      </span>
                      <Plus size={14} />
                    </>
                  )}
                </button>
              )}
            </Stepper>
          ))}
        </div>

        {destinazioni && (
          <>
            <div className="rule">
              <span className="rule-label">DOVE</span>
              <div className="rule-line" />
            </div>
            <div className="pad stack" style={{ gap: 8 }}>
              <div className="segmenti" style={{ gridTemplateColumns: `repeat(${destinazioni.length}, minmax(0, 1fr))` }}>
                {destinazioni.map((d) => {
                  const on = (w.dove ?? 'qui') === d
                  return (
                    <button
                      key={d}
                      className="segmento"
                      data-on={on}
                      aria-pressed={on}
                      onClick={() => set(d === 'qui' ? { dove: undefined, corsi: [] } : { dove: d })}
                    >
                      {DESTINAZIONE[d].etichetta}
                    </button>
                  )
                })}
              </div>
              <span style={{ fontSize: 13, lineHeight: 1.45, color: 'var(--dim)' }}>{DESTINAZIONE[w.dove === 'palestra' || w.dove === 'miei' ? w.dove : 'qui'].spiega}</span>
            </div>
          </>
        )}

        {/* I corsi: il tablet di sala e l'appello aprono il timer con la
            lezione, e in cima ci sono quelli del suo corso. Solo per un timer
            che sta sul database, perché il tablet deve poterlo leggere. */}
        {corsi.length > 0 && (w.dove === 'miei' || w.dove === 'palestra') && (
          <>
            <div className="rule">
              <span className="rule-label">CORSI</span>
              <div className="rule-line" />
              <span className="num" style={{ fontSize: 14, fontWeight: 600, color: 'var(--dim)' }}>
                {w.corsi?.length ?? 0}
              </span>
            </div>
            <p className="pad" style={{ fontSize: 13, lineHeight: 1.45, color: 'var(--dim)', margin: '0 0 10px' }}>
              Collegato a un corso, compare in cima quando il timer si apre dalla sua lezione, sul tablet di sala o
              dall’appello{w.dove === 'miei' ? ', e lo vede chi apre quel corso. Cambiarlo resta tuo' : ''}.
            </p>
            <div className="pad row" style={{ gap: 8, flexWrap: 'wrap', paddingBottom: 6 }}>
              {corsi.map((c) => {
                const on = !!w.corsi?.includes(c.id)
                return (
                  <button
                    key={c.id}
                    className="chip"
                    data-on={on}
                    aria-pressed={on}
                    style={c.colore ? { borderColor: c.colore } : undefined}
                    onClick={() => set({ corsi: on ? (w.corsi ?? []).filter((x) => x !== c.id) : [...(w.corsi ?? []), c.id] })}
                  >
                    {c.nome.toUpperCase()}
                  </button>
                )
              })}
            </div>
          </>
        )}

        {/* L'anteprima è anche l'elenco degli esercizi: si tocca la riga di un
            round per sceglierne l'esercizio, invece di tenerli in una sezione
            a parte e guardare poi qui cosa ne usciva. */}
        <div className="rule">
          <span className="rule-label">{vista > 0 ? `ANTEPRIMA · SERIE ${vista}` : 'ANTEPRIMA'}</span>
          <div className="rule-line" />
          <span className="num" style={{ fontSize: 14, fontWeight: 600, color: 'var(--dim)' }}>
            {righe.length} intervalli
          </span>
        </div>
        {conSerie && (
          <div className="pad row serie-schede" role="tablist" aria-label="Anteprima per serie">
            {Array.from({ length: w.sets + 1 }, (_, n) => (
              <button
                key={n}
                className="chip"
                role="tab"
                data-on={vista === n}
                aria-selected={vista === n}
                onClick={() => {
                  setSerieScelta(n)
                  setRigaAperta(null)
                }}
              >
                {n === 0 ? 'TUTTE' : `SERIE ${n}`}
              </button>
            ))}
          </div>
        )}
        <p className="pad" style={{ fontSize: 13, lineHeight: 1.45, color: 'var(--dim)', margin: '0 0 10px' }}>
          Tocca un intervallo di lavoro per scegliere l’esercizio.
          {w.mode !== 'circuit' && w.mode !== 'amrap' && w.mode !== 'fortime' && ' I nomi si alternano a ogni round.'}
          {vista > 0 && ` Quelli che aggiungi da qui vanno solo nella serie ${vista}.`}
        </p>
        <div className="pad stack" style={{ gap: 4, paddingBottom: 20 }}>
          {mostrate.map((r, i) => {
            const s = r.segment
            const ex = r.esercizioId ? w.exercises.find((e) => e.id === r.esercizioId) : undefined
            const lavoro = s.kind === 'work'
            const aperta = !!ex && rigaAperta?.i === i && rigaAperta.id === ex.id
            const obiettivo = ex ? descriviObiettivo(ex) : ''
            // Una serie che non c'è più, perché le serie sono scese: resta
            // nell'elenco, ma il timer non la fa, e va detto.
            const fuori = !!ex?.serie && (w.mode === 'fortime' || ex.serie > w.sets)
            const nome = ex ? (obiettivo ? `${ex.name} · ${obiettivo}` : ex.name) : rigaAnteprima(s)
            const contenuto = (
              <>
                <span className="num" style={{ fontSize: 13, fontWeight: 600, color: 'var(--faint)', width: 22 }}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span style={{ fontSize: 14, fontWeight: 600, textAlign: 'left', minWidth: 0, overflowWrap: 'anywhere', color: lavoro && !ex ? 'var(--dim)' : undefined }} className="grow">
                  {nome}
                  {lavoro && !ex && ' · + ESERCIZIO'}
                  {fuori && ' · SERIE NON C’È'}
                </span>
                {r.durata && (
                  <span className="num" style={{ fontSize: 16, fontWeight: 700, color: 'var(--tasto)' }}>
                    {s.duration}&quot;
                  </span>
                )}
              </>
            )
            const stile = { gap: 10, minHeight: lavoro ? 56 : 36, padding: '0 10px', background: 'var(--surface)', borderLeft: `4px solid var(--${s.kind})` }
            return (
              <div key={`${s.offset}-${i}`} className="stack" style={{ gap: 0 }}>
                {lavoro ? (
                  <button
                    className="row"
                    style={{ ...stile, width: '100%' }}
                    aria-expanded={ex ? aperta : undefined}
                    aria-label={ex ? `${ex.name}: opzioni dell’esercizio` : `Intervallo ${i + 1}: scegli l’esercizio`}
                    onClick={() => (ex ? setRigaAperta(aperta ? null : { i, id: ex.id }) : setScegliendo({}))}
                  >
                    {contenuto}
                  </button>
                ) : (
                  <div className="row" style={stile}>
                    {contenuto}
                  </div>
                )}

                {aperta && ex && (
                  <div className="card stack" style={{ gap: 8, padding: '8px 10px' }}>
                    <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                      <button className="chip" onClick={() => setScegliendo({ bersaglio: ex.id })}>
                        CAMBIA ESERCIZIO
                      </button>
                      {(conSerie || ex.serie) && (
                        <button
                          className="serie-esercizio"
                          data-una={!!ex.serie}
                          data-fuori={fuori}
                          onClick={() => cambiaSerie(ex)}
                          aria-label={`${ex.name}: ${ex.serie ? `solo nella serie ${ex.serie}` : 'in tutte le serie'}. Tocca per cambiare.`}
                        >
                          {ex.serie ? `SERIE ${ex.serie}` : 'TUTTE LE SERIE'}
                        </button>
                      )}
                      {w.mode === 'circuit' && (
                        <input
                          className="field"
                          style={{ width: 76, minHeight: 44, textAlign: 'center', padding: '8px 4px', fontSize: 15 }}
                          type="number"
                          min={5}
                          max={600}
                          value={ex.duration ?? w.work}
                          onChange={(e) => setExerciseDuration(ex.id, Number(e.target.value) || w.work)}
                          aria-label={`Durata di ${ex.name}`}
                        />
                      )}
                      <span className="grow" />
                      <button className="riordina" onClick={() => move(ex.id, -1)} disabled={visibili[0]?.id === ex.id} aria-label={`Sposta ${ex.name} più in alto`}>
                        <Caret verso="su" />
                      </button>
                      <button className="riordina" onClick={() => move(ex.id, 1)} disabled={visibili[visibili.length - 1]?.id === ex.id} aria-label={`Sposta ${ex.name} più in basso`}>
                        <Caret verso="giu" />
                      </button>
                      <button
                        className="icon-btn"
                        style={{ width: 44, border: 'none', color: 'var(--dim)' }}
                        onClick={() => removeExercise(ex.id)}
                        aria-label={`Togli ${ex.name}`}
                      >
                        <Trash size={16} />
                      </button>
                    </div>
                    <div className="row" style={{ gap: 8 }}>
                      <CampoObiettivo label="SERIE" value={ex.sets} max={20} onChange={(v) => setObiettivo(ex.id, { sets: v })} />
                      <CampoObiettivo label="RIPETIZIONI" value={ex.reps} max={200} onChange={(v) => setObiettivo(ex.id, { reps: v })} />
                      <CampoObiettivo label="KG" value={ex.kg} step={0.5} max={500} onChange={(v) => setObiettivo(ex.id, { kg: v })} />
                    </div>
                  </div>
                )}
              </div>
            )
          })}
          {righe.length > mostrate.length && (
            <button className="chip" onClick={() => setTutteLeRighe(true)}>
              MOSTRA TUTTI ({righe.length - mostrate.length} IN PIÙ)
            </button>
          )}
          <button className="btn btn-dashed" style={{ minHeight: 50, fontSize: 15, marginTop: 6 }} onClick={() => setScegliendo({})}>
            <Plus size={16} />
            {/* Dentro una serie il tasto dice dove va, e non quel che è: sul
                telefono le due cose insieme non stanno in una riga. */}
            {vista > 0 ? `AGGIUNGI ALLA SERIE ${vista}` : `AGGIUNGI ${w.mode === 'circuit' ? 'STAZIONE' : 'ESERCIZIO'}`}
          </button>
        </div>
      </div>

      <div
        className="row"
        style={{
          gap: 14,
          borderTop: '2px solid var(--line-soft)',
          background: 'var(--menu)',
          padding: '14px 20px calc(var(--safe-b) + 16px)',
        }}
      >
        <div className="stack" style={{ gap: 2 }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.2em', color: 'var(--dim)' }}>
            {MODE_LABEL[w.mode].toUpperCase()}
          </span>
          <span className="num" style={{ fontSize: 30, fontWeight: 700, lineHeight: 1 }}>
            {clock(totalDuration(w))}
          </span>
        </div>
        <button className="btn btn-primary grow" style={{ height: 62 }} onClick={() => onSaveAndStart(named)}>
          <Play size={20} />
          AVVIA
        </button>
      </div>
    </div>
  )
}
