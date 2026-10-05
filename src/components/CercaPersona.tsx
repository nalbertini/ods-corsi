import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { Dati } from '../lib/dati'
import type { ChiProva, NuovaProva, PersonaTrovata } from '../lib/prove'
import { bastaPerCercare, cosaNonVaProva, dicePersona, doppioneDi, perCheGiaQui, provaScritta, trovateDa } from '../lib/prove'
import { domandaIndietro } from '../lib/sala'
import { Back } from './Icons'
import { DueTocchi } from './ds'
import { scritto } from './Prove'

/**
 * «Aggiungi chi prova», dall'appello dell'app: una pagina che cerca per nome
 * e cognome fra tutte le persone della palestra, anche chi è iscritto a un
 * altro corso o non ha mai provato, e se la persona non c'è fa scrivere il
 * nome a mano. Chi si tocca entra nell'appello già presente, in fondo sotto
 * PROVE; poi si torna all'appello (lo fa `onAggiungi`).
 *
 * Chi è già nell'appello compare lo stesso, col perché: nascosto, chi cerca lo
 * crederebbe mancante e lo riscriverebbe come nuovo. Scrivendo a mano una
 * persona che esiste già si avvisa prima, ma si può continuare: due omonimi
 * veri esistono. Il telefono dei risultati non c'è (`PersonaTrovata`).
 *
 * Il tablet e la segreteria usano ancora il pannello di `Prove.tsx`.
 */

export function CercaPersona({
  dati,
  lezione,
  giaQui,
  onAggiungi,
  onIndietro,
}: {
  dati: Dati
  /** Il corso di questa lezione, per ricordare dove si sta aggiungendo. */
  lezione: string
  /** Chi è già nell'appello e come: gli iscritti e le prove. */
  giaQui: ReadonlyMap<string, 'iscritto' | 'prova'>
  /**
   * Aggiunge e segna presente, e riporta all'appello con la persona in fondo
   * sotto PROVE. Se solleva, il messaggio resta nella pagina.
   */
  onAggiungi: (chi: ChiProva) => Promise<void>
  onIndietro: () => void
}) {
  const [testo, setTesto] = useState('')
  // La risposta e l'errore sono del testo per cui sono arrivati: scrivendo
  // ancora, una risposta vecchia non passa per quella di adesso.
  const [risposta, setRisposta] = useState<{ testo: string; trovati: PersonaTrovata[] } | null>(null)
  const [fallita, setFallita] = useState<{ testo: string; guaio: unknown } | null>(null)
  const [aMano, setAMano] = useState(false)
  const [nome, setNome] = useState('')
  const [cognome, setCognome] = useState('')
  const [telefono, setTelefono] = useState('')
  const [guaio, setGuaio] = useState<string | null>(null)
  const [aspetta, setAspetta] = useState(false)
  // Chi ha già questo nome, trovato prima di scrivere una persona nuova.
  const [doppione, setDoppione] = useState<PersonaTrovata | null>(null)
  const campo = useRef<HTMLInputElement>(null)
  // Il controllo del doppione aspetta il server: nel frattempo si può tornare
  // indietro o cambiare il nome, e allora la persona non va più aggiunta.
  const montata = useRef(true)
  const versione = useRef(0)

  useEffect(() => campo.current?.focus(), [])
  useEffect(() => {
    montata.current = true
    return () => void (montata.current = false)
  }, [])

  useEffect(() => {
    if (!bastaPerCercare(testo)) return
    let vivo = true
    // Un attimo dopo l'ultimo tasto: non si chiede il server a ogni lettera.
    const t = window.setTimeout(() => {
      dati.cercaPersone(testo).then(
        (trovati) => vivo && (setRisposta({ testo, trovati }), setFallita(null)),
        (guaio: unknown) => vivo && setFallita({ testo, guaio }),
      )
    }, 300)
    return () => {
      vivo = false
      window.clearTimeout(t)
    }
  }, [dati, testo])

  const cosa = trovateDa({ testo, risposta: risposta ?? undefined, fallita: fallita ?? undefined, giaQui })
  // Il nome a mano si offre da sé quando non c'è nessuno o la ricerca non va; e
  // a chi lo vuole, sempre: due omonimi veri, o un nome corto che non si cerca.
  const form = aMano || cosa.aMano

  const aggiungi = async (chi: ChiProva) => {
    setAspetta(true)
    setGuaio(null)
    try {
      await onAggiungi(chi)
    } catch (e) {
      setGuaio(scritto(e, 'Non aggiunto: riprova tra un attimo.'))
      setAspetta(false)
    }
  }

  const manda = async (e: FormEvent) => {
    e.preventDefault()
    const n: NuovaProva = { nome, cognome, telefono }
    const no = cosaNonVaProva(n)
    if (no) return setGuaio(no)
    setGuaio(null)
    // Prima di fare una persona nuova, se ne esiste una uguale lo si dice.
    // Senza rete non si può controllare: si aggiunge, e la segreteria unisce.
    if (!doppione && bastaPerCercare(`${nome} ${cognome}`)) {
      const mia = ++versione.current
      setAspetta(true)
      const uguale = await dati.cercaPersone(`${nome} ${cognome}`).then(
        (t) => doppioneDi(n, t),
        () => null,
      )
      // Tornato indietro: la pagina non c'è più. Cambiato il nome: il tasto si
      // sblocca, ma quel che si è scritto non è più questo, e non si aggiunge.
      if (!montata.current) return
      setAspetta(false)
      if (versione.current !== mia) return
      if (uguale) return setDoppione(uguale)
    }
    void aggiungi(n)
  }

  const scritta = provaScritta({ nome, cognome })
  const uguale = doppione && giaQui.get(doppione.id)

  return (
    <>
      <div className="appello-testa">
        <div className="row pad" style={{ gap: 10, paddingTop: 12 }}>
          <DueTocchi className="icon-btn" chiede={domandaIndietro(scritta)} etichetta="Torna all'appello" onFai={onIndietro}>
            <Back />
          </DueTocchi>
          <span className="stack grow" style={{ gap: 3, minWidth: 0 }}>
            <span className="ob appello-titolo">AGGIUNGI CHI PROVA</span>
            <span style={{ fontSize: 13, color: 'var(--dim)' }}>Aggiungi a {lezione}: entra segnato presente.</span>
          </span>
        </div>
      </div>

      <div className="pad stack cerca-persona" style={{ gap: 10, paddingTop: 14 }}>
        <label htmlFor="cerca-persona" className="sg-etichetta">
          CERCA PER NOME O COGNOME
        </label>
        <input
          ref={campo}
          id="cerca-persona"
          className="campo"
          style={{ minHeight: 48, width: '100%' }}
          type="search"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="words"
          spellCheck={false}
          enterKeyHint="search"
          value={testo}
          onChange={(e) => {
            setTesto(e.target.value)
            setGuaio(null)
          }}
        />
        {cosa.riga && (
          <span className="prove-sotto" role="status">
            {cosa.riga}
          </span>
        )}

        {cosa.voci.length > 0 && (
          <div className="stack" style={{ gap: 6 }}>
            {cosa.voci.map((p) =>
              p.qui ? (
                <div key={p.id} className="prove-gia prove-gia-qui">
                  <span className="stack grow" style={{ gap: 2, minWidth: 0 }}>
                    <span className="prove-gia-nome">{`${p.cognome} ${p.nome}`}</span>
                    <span className="prove-sotto">{p.perche}</span>
                  </span>
                </div>
              ) : (
                <button key={p.id} type="button" className="prove-gia" disabled={aspetta} onClick={() => void aggiungi({ id: p.id, nome: p.nome, cognome: p.cognome })}>
                  <span className="stack grow" style={{ gap: 2, minWidth: 0 }}>
                    <span className="prove-gia-nome">{`${p.cognome} ${p.nome}`}</span>
                    <span className="prove-sotto">{p.corsi.length ? p.corsi.join(', ') : 'Nessun corso'}</span>
                  </span>
                  <span className="num prove-gia-tasto">AGGIUNGI</span>
                </button>
              ),
            )}
          </div>
        )}

        {guaio && (
          <span className="prove-guaio" role="alert">
            {guaio}
          </span>
        )}

        {!form && (
          <button type="button" className="btn btn-dashed" style={{ minHeight: 48 }} onClick={() => setAMano(true)}>
            NON LO TROVO: SCRIVI IL NOME
          </button>
        )}

        {form && (
          <form className="card stack" style={{ gap: 10, padding: 14 }} onSubmit={manda}>
            <span className="modulo-etichetta">UNA PERSONA NUOVA</span>
            <div className="prove-campi">
              <label className="stack" style={{ gap: 4 }} htmlFor="cerca-persona-nome">
                <span className="modulo-etichetta">NOME</span>
                <input
                  id="cerca-persona-nome"
                  className="campo"
                  autoComplete="off"
                  value={nome}
                  onChange={(e) => {
                    setNome(e.target.value)
                    setDoppione(null)
                    versione.current++
                    setGuaio(null)
                  }}
                />
              </label>
              <label className="stack" style={{ gap: 4 }} htmlFor="cerca-persona-cognome">
                <span className="modulo-etichetta">COGNOME</span>
                <input
                  id="cerca-persona-cognome"
                  className="campo"
                  autoComplete="off"
                  value={cognome}
                  onChange={(e) => {
                    setCognome(e.target.value)
                    setDoppione(null)
                    versione.current++
                    setGuaio(null)
                  }}
                />
              </label>
              <label className="stack" style={{ gap: 4 }} htmlFor="cerca-persona-telefono">
                <span className="modulo-etichetta">TELEFONO, SE LO DÀ</span>
                <input id="cerca-persona-telefono" className="campo num" type="tel" inputMode="tel" autoComplete="off" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
              </label>
            </div>
            {doppione ? (
              <div className="stack" style={{ gap: 8 }}>
                <span className="prove-guaio" role="alert">
                  Esiste già {dicePersona(doppione)}.
                </span>
                {uguale ? (
                  <span className="prove-sotto">{perCheGiaQui(uguale)}</span>
                ) : (
                  <button type="button" className="btn btn-go" style={{ minHeight: 48 }} disabled={aspetta} onClick={() => void aggiungi({ id: doppione.id, nome: doppione.nome, cognome: doppione.cognome })}>
                    SÌ, È LA STESSA PERSONA: AGGIUNGI
                  </button>
                )}
                <button type="button" className="btn btn-ghost" style={{ minHeight: 48 }} disabled={aspetta} onClick={() => void aggiungi({ nome, cognome, telefono })}>
                  NO, È UN ALTRO: AGGIUNGI NUOVO
                </button>
              </div>
            ) : (
              <button type="submit" className="btn btn-go" style={{ minHeight: 48 }} disabled={aspetta}>
                {aspetta ? 'CONTROLLO…' : 'AGGIUNGI'}
              </button>
            )}
          </form>
        )}
      </div>
    </>
  )
}
