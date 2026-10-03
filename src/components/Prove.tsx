import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { ChiProva, GiaProvato } from '../lib/prove'
import { cosaNonVaProva, somiglianti } from '../lib/prove'
import { chiaveGiorno, giornoPerEsteso } from '../lib/sala'

/**
 * Il tasto PROVE dell'appello: chi viene a provare entra nell'appello di
 * questa lezione, già presente.
 *
 * Arrivano spesso dopo le cinque, quando la segreteria è in sala a fare
 * lezione, e allora li aggiunge chi fa l'appello: l'istruttore dal telefono
 * o dal tablet col PIN, la segreteria dalla lezione aperta. Si scrive nome e
 * cognome, e mentre si scrive compare chi è già venuto a provare con quel
 * nome: lo si tocca, ed è la stessa persona di ieri (la settimana di prova);
 * se no, AGGIUNGI fa una persona nuova, col telefono per richiamarla.
 *
 * È lo stesso pannello nei tre appelli: cambia solo la grafica (`stile`).
 */

type Stile = 'app' | 'sg' | 'tb'

const CLASSI: Record<Stile, { riquadro: string; etichetta: string; campo: string; si: string; no: string; voce: string }> = {
  app: { riquadro: 'card stack prove-pannello', etichetta: 'modulo-etichetta', campo: 'campo', si: 'btn btn-go', no: 'btn btn-ghost', voce: 'prove-gia' },
  sg: { riquadro: 'sg-appello prove-pannello', etichetta: 'sg-etichetta', campo: 'sg-campo', si: 'sg-btn sg-btn-verde', no: 'sg-btn sg-btn-linea', voce: 'prove-gia' },
  tb: { riquadro: 'tb-riquadro prove-pannello', etichetta: 'tb-etichetta', campo: 'tb-campo', si: 'tb-btn tb-btn-verde', no: 'tb-btn tb-btn-linea', voce: 'prove-gia prove-gia-tb' },
}

const scritto = (e: unknown, altrimenti: string) => (e instanceof Error && e.message ? e.message : altrimenti)

export function PannelloProve({
  stile,
  cerca,
  giaQui,
  onAggiungi,
  onChiudi,
}: {
  stile: Stile
  /** Chi è già venuto a provare, dal più recente. */
  cerca: () => Promise<GiaProvato[]>
  /** Chi è già nell'appello: non si propone. */
  giaQui: ReadonlySet<string>
  /** Aggiunge e segna presente. Se solleva, il messaggio resta nel pannello. */
  onAggiungi: (chi: ChiProva) => Promise<void>
  onChiudi: () => void
}) {
  const k = CLASSI[stile]
  const [venuti, setVenuti] = useState<GiaProvato[] | null>(null)
  const [nonVa, setNonVa] = useState(false)
  const [nome, setNome] = useState('')
  const [cognome, setCognome] = useState('')
  const [telefono, setTelefono] = useState('')
  const [guaio, setGuaio] = useState<string | null>(null)
  const [fatto, setFatto] = useState<string | null>(null)
  const [aspetta, setAspetta] = useState(false)
  const primo = useRef<HTMLInputElement>(null)

  // Una volta, quando il pannello si apre: chi lo apre non deve ricordarsi di
  // tenere ferma la funzione.
  const leggi = useRef(cerca)
  useEffect(() => {
    let vivo = true
    leggi
      .current()
      .then((x) => vivo && setVenuti(x))
      .catch(() => vivo && setNonVa(true))
    return () => {
      vivo = false
    }
  }, [])

  useEffect(() => primo.current?.focus(), [])

  const proposti = somiglianti((venuti ?? []).filter((p) => !giaQui.has(p.id)), `${nome} ${cognome}`)

  const aggiungi = async (chi: ChiProva) => {
    setAspetta(true)
    setGuaio(null)
    setFatto(null)
    try {
      await onAggiungi(chi)
      setFatto(`${chi.cognome.trim()} ${chi.nome.trim()}: aggiunto, e segnato presente.`)
      setNome('')
      setCognome('')
      setTelefono('')
      primo.current?.focus()
    } catch (e) {
      setGuaio(scritto(e, 'Non aggiunto: il server non risponde'))
    } finally {
      setAspetta(false)
    }
  }

  const manda = (e: FormEvent) => {
    e.preventDefault()
    const n = { nome, cognome, telefono }
    const no = cosaNonVaProva(n)
    if (no) return setGuaio(no)
    void aggiungi(n)
  }

  const id = (x: string) => `prova-${stile}-${x}`

  return (
    <section className={k.riquadro} aria-label="Aggiungi chi viene a provare" data-stile={stile}>
      <div className="row" style={{ gap: 10, alignItems: 'baseline' }}>
        <span className={`${k.etichetta} grow`}>CHI VIENE A PROVARE</span>
      </div>
      <span className="prove-sotto">Entra nell'appello di questa lezione, già presente. Chi è già venuto si ritrova scrivendo il nome.</span>

      {/* Senza i già venuti si aggiunge lo stesso: dall'app la prova va in
          coda come i segni dell'appello (il tablet, senza coda, lo dice se non va). */}
      {nonVa && <span className="prove-sotto">Senza rete non vedo chi è già venuto: scrivi nome e cognome.</span>}
      <form className="stack" style={{ gap: 10 }} onSubmit={manda}>
        <div className="prove-campi">
          <label className="stack" style={{ gap: 4 }} htmlFor={id('nome')}>
            <span className={k.etichetta}>NOME</span>
            <input ref={primo} id={id('nome')} className={k.campo} autoComplete="off" value={nome} onChange={(e) => setNome(e.target.value)} />
          </label>
          <label className="stack" style={{ gap: 4 }} htmlFor={id('cognome')}>
            <span className={k.etichetta}>COGNOME</span>
            <input id={id('cognome')} className={k.campo} autoComplete="off" value={cognome} onChange={(e) => setCognome(e.target.value)} />
          </label>
          <label className="stack" style={{ gap: 4 }} htmlFor={id('telefono')}>
            <span className={k.etichetta}>TELEFONO, SE LO DÀ</span>
            <input id={id('telefono')} className={`${k.campo} num`} type="tel" inputMode="tel" autoComplete="off" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
          </label>
        </div>

        {venuti === null && !nonVa && <span className="prove-sotto">Sto leggendo chi è già venuto…</span>}
        {proposti.length > 0 && (
          <div className="stack" style={{ gap: 6 }}>
            <span className={k.etichetta}>{nome || cognome ? 'GIÀ VENUTI CON QUESTO NOME' : 'GLI ULTIMI VENUTI A PROVARE'}</span>
            {proposti.map((p) => (
              <button key={p.id} type="button" className={k.voce} disabled={aspetta} onClick={() => void aggiungi(p)}>
                <span className="stack grow" style={{ gap: 2, minWidth: 0 }}>
                  <span className="prove-gia-nome">
                    {p.cognome} {p.nome}
                  </span>
                  <span className="prove-sotto">
                    {p.corso}, {giornoPerEsteso(chiaveGiorno(new Date(p.inizio)))}
                    {p.telefono ? ` · ${p.telefono}` : ''}
                  </span>
                </span>
                <span className="num prove-gia-tasto">AGGIUNGI</span>
              </button>
            ))}
          </div>
        )}

        {guaio && (
          <span className="prove-guaio" role="alert">
            {guaio}
          </span>
        )}
        {fatto && (
          <span className="prove-fatto" role="status">
            {fatto}
          </span>
        )}

        <div className="row" style={{ gap: 8 }}>
          <button type="submit" className={`${k.si} grow`} disabled={aspetta}>
            {aspetta ? 'AGGIUNGO…' : 'AGGIUNGI NUOVO'}
          </button>
          <button type="button" className={k.no} onClick={onChiudi}>
            FATTO
          </button>
        </div>
      </form>
    </section>
  )
}

/** Il bollino sulla riga di chi è venuto a provare. */
export function MarchioProva() {
  return <span className="num prova-marchio">PROVA</span>
}

/**
 * Toglie una prova messa per sbaglio. Due tocchi, senza `confirm()` (che sul
 * tablet a tutto schermo alcuni browser non mostrano): il primo chiede, il
 * secondo toglie, e senza il secondo dopo qualche secondo torna com'era.
 */
export function TogliProva({ chi, onTogli, disabled }: { chi: string; onTogli: () => void; disabled?: boolean }) {
  const [sicuro, setSicuro] = useState(false)
  useEffect(() => {
    if (!sicuro) return
    const t = window.setTimeout(() => setSicuro(false), 4000)
    return () => window.clearTimeout(t)
  }, [sicuro])
  return (
    <button
      type="button"
      className="num prova-togli"
      data-sicuro={sicuro}
      disabled={disabled}
      aria-label={sicuro ? `Conferma: togli ${chi} dalle prove` : `Togli ${chi} dalle prove`}
      onClick={() => (sicuro ? onTogli() : setSicuro(true))}
    >
      {sicuro ? 'SICURO? TOGLI' : 'TOGLI'}
    </button>
  )
}
