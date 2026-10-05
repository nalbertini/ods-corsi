import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { ChiProva, GiaProvato } from '../lib/prove'
import { bastaPerCercare, cosaNonVaProva, daMostrare, provaScritta } from '../lib/prove'
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

export const scritto = (e: unknown, altrimenti: string) => (e instanceof Error && e.message ? e.message : altrimenti)

export function PannelloProve({
  stile,
  cerca,
  giaQui,
  onAggiungi,
  onChiudi,
  onScritto,
}: {
  stile: Stile
  /**
   * Chi è già venuto a provare, dal più recente, fra cui quelli che somigliano
   * a `scritto`: il tablet chiede solo quelli, l'app legge tutti una volta (`unaVolta`).
   */
  cerca: (scritto: string) => Promise<GiaProvato[]>
  /** Chi è già nell'appello: non si propone. */
  giaQui: ReadonlySet<string>
  /** Aggiunge e segna presente. Se solleva, il messaggio resta nel pannello. */
  onAggiungi: (chi: ChiProva) => Promise<void>
  onChiudi: () => void
  /** Chi è scritto e non ancora aggiunto (`provaScritta`), a ogni cambio; `null` chiudendo. */
  onScritto?: (chi: string | null) => void
}) {
  const k = CLASSI[stile]
  // L'ultima risposta arrivata, per qualunque testo. Dentro un oggetto nuovo
  // ogni volta: `unaVolta` dà sempre lo stesso elenco, e React non ridisegnerebbe.
  const [ultimi, setUltimi] = useState<{ chi: GiaProvato[] }>({ chi: [] })
  // L'errore dell'ultima ricerca: «senza rete» o il tetto delle ricerche.
  const [nonVede, setNonVede] = useState<unknown>(null)
  const [nome, setNome] = useState('')
  const [cognome, setCognome] = useState('')
  const [telefono, setTelefono] = useState('')
  const [guaio, setGuaio] = useState<string | null>(null)
  const [fatto, setFatto] = useState<string | null>(null)
  const [aspetta, setAspetta] = useState(false)
  const primo = useRef<HTMLInputElement>(null)

  // La funzione di quando il pannello si apre: chi lo apre non deve ricordarsi
  // di tenerla ferma.
  const leggi = useRef(cerca)
  const testo = `${nome} ${cognome}`.trim()
  // Si chiede a ogni testo nuovo, anche vuoto all'apertura: così l'app legge
  // l'elenco subito, e il tablet sa subito se il server risponde. Le risposte
  // si tengono per testo: tornare a «marco» non richiede.
  const letti = useRef(new Map<string, GiaProvato[]>())
  const aperto = useRef(true)
  useEffect(() => {
    // Anche quando React rimonta il pannello (StrictMode, in sviluppo).
    aperto.current = true
    return () => void (aperto.current = false)
  }, [])
  useEffect(() => {
    // Già letto: la rete per questo testo c'è stata.
    if (letti.current.has(testo)) return setNonVede(null)
    // Senza una parola di tre lettere la risposta è vuota: sul tablet ogni chiamata passa
    // dal PIN, e con un PIN tolto a pannello aperto conterebbe come sbagliato.
    if (testo && !bastaPerCercare(testo)) return
    // Un attimo dopo l'ultimo tasto: sul tablet ogni ricerca conta per il tetto.
    const t = window.setTimeout(() => {
      leggi
        .current(testo)
        .then((x) => {
          letti.current.set(testo, x)
          if (!aperto.current) return
          setUltimi({ chi: x })
          setNonVede(null)
        })
        .catch((e: unknown) => aperto.current && setNonVede(e))
    }, testo ? 300 : 0)
    return () => window.clearTimeout(t)
  }, [testo])

  useEffect(() => primo.current?.focus(), [])

  const { proposti, stato, avviso } = daMostrare({ testo, venuti: letti.current.get(testo), ultimi: ultimi.chi, giaQui, guaio: nonVede })

  // Sul tablet la colonna dell'appello scorre: quando compaiono i già venuti
  // il pannello si allunga, e AGGIUNGI finiva sotto lo schermo senza dirlo.
  // Sul telefono no: la testata fissa coprirebbe il campo.
  const sezione = useRef<HTMLElement>(null)
  const ciSonoProposti = proposti.length > 0
  useEffect(() => {
    if (stile === 'tb' && ciSonoProposti) sezione.current?.scrollIntoView({ block: 'nearest' })
  }, [stile, ciSonoProposti])

  const aggiungi = async (chi: ChiProva): Promise<boolean> => {
    setAspetta(true)
    setGuaio(null)
    setFatto(null)
    try {
      await onAggiungi(chi)
      // Sul tablet il già venuto ha la sigla: il cognome intero non resta sullo schermo.
      const sigla = 'sigla' in chi && typeof chi.sigla === 'string' ? chi.sigla : null
      setFatto(`${sigla ? `${chi.nome} ${sigla}` : `${chi.cognome.trim()} ${chi.nome.trim()}`}: aggiunto, e segnato presente.`)
      setNome('')
      setCognome('')
      setTelefono('')
      primo.current?.focus()
      return true
    } catch (e) {
      setGuaio(scritto(e, 'Non aggiunto: il server non risponde'))
      return false
    } finally {
      setAspetta(false)
    }
  }

  const prova = async () => {
    const n = { nome, cognome, telefono }
    const no = cosaNonVaProva(n)
    if (no) {
      setGuaio(no)
      return false
    }
    return aggiungi(n)
  }
  const manda = (e: FormEvent) => {
    e.preventDefault()
    void prova()
  }
  // Con un nome scritto, chiudere senza aggiungerlo lo buttava via senza dirlo:
  // la prova non arrivava in segreteria, e il telefono si perdeva.
  const scritta = provaScritta({ nome, cognome })
  const scrittoQualcosa = scritta !== null
  // Chi contiene il pannello avvisa prima di andarsene con un nome ancora
  // qui; chiuso il pannello, non c'è più niente da perdere.
  const avvisa = useRef(onScritto)
  avvisa.current = onScritto
  useEffect(() => avvisa.current?.(scritta), [scritta])
  useEffect(() => () => avvisa.current?.(null), [])
  const chiudi = async () => {
    if (!scrittoQualcosa || (await prova())) onChiudi()
  }

  const id = (x: string) => `prova-${stile}-${x}`

  return (
    <section ref={sezione} className={k.riquadro} aria-label="Aggiungi chi viene a provare" data-stile={stile}>
      <div className="row" style={{ gap: 10, alignItems: 'baseline' }}>
        <span className={`${k.etichetta} grow`}>CHI VIENE A PROVARE</span>
      </div>
      <span className="prove-sotto">Entra nell'appello di questa lezione, già presente. Chi è già venuto compare dalla terza lettera.</span>

      {/* Senza i già venuti si aggiunge lo stesso: dall'app la prova va in
          coda come i segni dell'appello (il tablet, senza coda, lo dice se non va). */}
      {avviso && <span className="prove-sotto">{avviso}</span>}
      <form className="stack" style={{ gap: 10 }} onSubmit={manda}>
        <div className="prove-campi">
          <label className="stack" style={{ gap: 4 }} htmlFor={id('nome')}>
            <span className={k.etichetta}>NOME</span>
            <input ref={primo} id={id('nome')} className={k.campo} autoComplete="off" value={nome} onChange={(e) => { setNome(e.target.value); setFatto(null); setGuaio(null) }} />
          </label>
          <label className="stack" style={{ gap: 4 }} htmlFor={id('cognome')}>
            <span className={k.etichetta}>COGNOME</span>
            <input id={id('cognome')} className={k.campo} autoComplete="off" value={cognome} onChange={(e) => { setCognome(e.target.value); setFatto(null); setGuaio(null) }} />
          </label>
          {/* Chi è già venuto subito sotto nome e cognome, prima del telefono:
              sul telefono con la tastiera aperta resta vicino al campo. Va
              su una riga intera; dove le colonne sono tre (il tablet) il
              telefono risale accanto al cognome (`grid-auto-flow: dense`). */}
          {stato && <span className="prove-sotto">{stato}</span>}
          {proposti.length > 0 && (
            <div className="stack prove-proposti" style={{ gap: 6 }}>
              <span className={k.etichetta}>GIÀ VENUTI CON QUESTO NOME</span>
              {proposti.map((p) => (
                <button key={p.id} type="button" className={k.voce} disabled={aspetta} onClick={() => void aggiungi(p)}>
                  <span className="stack grow" style={{ gap: 2, minWidth: 0 }}>
                    <span className="prove-gia-nome">
                      {p.sigla ? `${p.nome} ${p.sigla}` : `${p.cognome} ${p.nome}`}
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
          <label className="stack" style={{ gap: 4 }} htmlFor={id('telefono')}>
            <span className={k.etichetta}>TELEFONO, SE LO DÀ</span>
            <input id={id('telefono')} className={`${k.campo} num`} type="tel" inputMode="tel" autoComplete="off" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
          </label>
        </div>

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

        {/* «NASCONDI» e non «CHIUDI»: sotto, nell'appello, CHIUDI vuol dire
            un'altra cosa. Su un telefono stretto i due tasti vanno a capo. */}
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <button type="submit" className={`${k.si} grow`} disabled={aspetta}>
            {aspetta ? 'AGGIUNGO…' : 'AGGIUNGI'}
          </button>
          <button type="button" className={k.no} disabled={aspetta} onClick={() => void chiudi()}>
            {scrittoQualcosa ? 'AGGIUNGI E NASCONDI' : 'NASCONDI'}
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
  // Come le conferme dell'appello: il secondo tocco di un doppio tocco veloce non conferma.
  const chiestoIl = useRef(0)
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
      onClick={() => {
        if (!sicuro) {
          chiestoIl.current = Date.now()
          return setSicuro(true)
        }
        if (Date.now() - chiestoIl.current >= 500) onTogli()
      }}
    >
      {sicuro ? 'SICURO? TOGLI' : 'TOGLI'}
    </button>
  )
}
