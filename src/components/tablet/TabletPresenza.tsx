import { useEffect, useRef, useState } from 'react'
import type { DatiTablet, LezioneSala, NomeSala } from '../../lib/tablet'
import { chiaveTocco, codaDelTablet, contoSala, dimenticaTocco, fase, inAttesa, ricordaTocco, rifiutato, siAnnulla } from '../../lib/tablet'
import { chiaveGiorno, giornoPerEsteso } from '../../lib/sala'
import { Spunta } from '../Icons'
import { EtichettaAttivita } from '../ds'
import { Guaio, Indietro, messaggio, orario } from './comune'
import { Kanji } from '../Kanji'

type Fascia =
  /** `attesa`: la rete non c'è, il tocco è in coda. */
  | { tipo: 'fatto'; p: NomeSala; attesa?: boolean }
  /** `annulla`: l'ha segnato questo tablet da meno di due minuti, e si può ancora togliere. */
  | { tipo: 'gia'; p: NomeSala; annulla: boolean }
  | { tipo: 'istruttore'; p: NomeSala }
  /** ANNULLA è andato: lo si dice, il segno che sparisce da solo non basta. */
  | { tipo: 'annullato'; p: NomeSala }
  | { tipo: 'errore'; testo: string }

/** Quanto resta in basso la fascia, in millisecondi. */
const DURATA: Record<Fascia['tipo'], number> = { fatto: 10_000, gia: 6000, istruttore: 6000, annullato: 3000, errore: 10_000 }

/**
 * I nomi da toccare.
 *
 * Il tocco segna subito, senza domande: chi arriva ha la borsa in mano e dieci
 * persone dietro. Per chi sbaglia nome c'è la fascia in basso con ANNULLA,
 * che resta qualche secondo; il server tiene aperto l'annullo per due minuti.
 *
 * Chi ritocca il suo nome nei due minuti ritrova ANNULLA.
 *
 * Si vede che è segnato prima che il server risponda. Se il server dice di no
 * (l'istruttore l'aveva già segnato assente, fuori orario) il segno si toglie
 * e la fascia dice perché. Se la rete non c'è il segno resta: il tocco va
 * nella coda del tablet, e la tessera dice IN ATTESA DI RETE finché non arriva.
 */
export function TabletPresenza({
  d,
  lezione,
  adesso,
  onIndietro,
  onCambiato,
}: {
  d: DatiTablet
  lezione: LezioneSala
  adesso: Date
  onIndietro: () => void
  /** Un tocco o un annullo è arrivato al server: il conto nella barra in basso va riletto. */
  onCambiato?: () => void
}) {
  const [nomi, setNomi] = useState<NomeSala[] | null>(null)
  const [guaio, setGuaio] = useState<string | null>(null)
  const [fascia, setFascia] = useState<Fascia | null>(null)
  const timer = useRef<number>()
  // L'ultimo tocco ancora in viaggio: ANNULLA lo aspetta, altrimenti il server
  // riceverebbe l'annullo prima della presenza da annullare.
  const inViaggio = useRef(new Map<string, Promise<boolean>>())

  // Chi è segnato qui ma non ancora sul server. Quando la coda si accorcia
  // l'elenco si rilegge: un no arrivato nel frattempo deve vedersi.
  const coda = codaDelTablet(d)
  const [attesa, setAttesa] = useState(() => inAttesa(coda, lezione.id))
  const [giro, setGiro] = useState(0)
  useEffect(() => {
    let prima = coda.inAttesa
    const smetti = coda.guarda((n) => {
      setAttesa(inAttesa(coda, lezione.id))
      if (n < prima) setGiro((g) => g + 1)
      prima = n
    })
    return () => void smetti()
  }, [coda, lezione.id])

  useEffect(() => {
    let vivo = true
    d.elenco(lezione.id)
      .then((x) => vivo && setNomi(x))
      .catch((e: unknown) => vivo && setGuaio(messaggio(e, 'Non riesco a leggere gli iscritti')))
    return () => {
      vivo = false
    }
  }, [d, lezione.id, giro])
  useEffect(() => () => window.clearTimeout(timer.current), [])

  const mostra = (f: Fascia | null) => {
    window.clearTimeout(timer.current)
    setFascia(f)
    if (f) timer.current = window.setTimeout(() => setFascia(null), DURATA[f.tipo])
  }

  const segnato = (personaId: string, v: boolean) =>
    setNomi((n) => n && n.map((p) => (p.personaId === personaId ? { ...p, segnato: v } : p)))

  /** Cambia la fascia di questa persona, se è ancora quella in vista; senza ripartire col tempo. */
  const aggiorna = (p: NomeSala, f: (x: Fascia & { tipo: 'fatto' }) => Fascia) =>
    setFascia((x) => (x?.tipo === 'fatto' && x.p.personaId === p.personaId ? f(x) : x))

  const tocca = (p: NomeSala) => {
    if (p.segnato || attesa.has(p.personaId)) return mostra({ tipo: 'gia', p, annulla: siAnnulla(lezione.id, p.personaId) })
    segnato(p.personaId, true)
    ricordaTocco(lezione.id, p.personaId)
    mostra({ tipo: 'fatto', p })
    const viaggio = d
      .segna(lezione.id, p.personaId)
      .then((esito) => {
        if (esito === 'istruttore') {
          segnato(p.personaId, false)
          dimenticaTocco(lezione.id, p.personaId)
          mostra({ tipo: 'istruttore', p })
          return false
        }
        if (esito === 'gia') {
          // Era già fra i presenti, segnato prima: questo tocco non c'è da annullare.
          dimenticaTocco(lezione.id, p.personaId)
          aggiorna(p, () => ({ tipo: 'gia', p, annulla: false }))
          return false
        }
        onCambiato?.()
        return true
      })
      .catch((e: unknown) => {
        if (!rifiutato(e, d.modo)) {
          coda.accoda(chiaveTocco(lezione.id, p.personaId), 'segna', [lezione.id, p.personaId])
          aggiorna(p, (x) => ({ ...x, attesa: true }))
          return true
        }
        segnato(p.personaId, false)
        dimenticaTocco(lezione.id, p.personaId)
        mostra({ tipo: 'errore', testo: `${p.nome}: non segnato. ${messaggio(e, 'Il server non risponde')}` })
        return false
      })
    inViaggio.current.set(p.personaId, viaggio)
  }

  const annulla = async (p: NomeSala) => {
    mostra(null)
    // Si aspetta il tocco di questa persona: se non era arrivato, non c'è
    // niente da annullare (e l'avviso del perché è già in vista).
    if ((await inViaggio.current.get(p.personaId)) === false) return
    dimenticaTocco(lezione.id, p.personaId)
    const chiave = chiaveTocco(lezione.id, p.personaId)
    // Ancora in coda: l'annullo prende il suo posto, e il tocco non parte più.
    if (inAttesa(coda, lezione.id).has(p.personaId)) {
      coda.accoda(chiave, 'annulla', [lezione.id, p.personaId])
      segnato(p.personaId, false)
      return mostra({ tipo: 'annullato', p })
    }
    try {
      if (await d.annulla(lezione.id, p.personaId)) {
        segnato(p.personaId, false)
        mostra({ tipo: 'annullato', p })
        onCambiato?.()
      } else mostra({ tipo: 'errore', testo: `Non si può più annullare: dillo all'istruttore, lo corregge lui.` })
    } catch (e) {
      if (rifiutato(e, d.modo)) return mostra({ tipo: 'errore', testo: messaggio(e, 'Il server non risponde') })
      coda.accoda(chiave, 'annulla', [lezione.id, p.personaId])
      segnato(p.personaId, false)
      mostra({ tipo: 'annullato', p })
    }
  }

  const passata = fase(lezione, adesso) !== 'aperta'
  const presenti = nomi?.filter((p) => p.segnato || attesa.has(p.personaId)).length ?? contoSala(lezione).presenti
  const giorno = giornoPerEsteso(chiaveGiorno(new Date(lezione.inizio)))

  return (
    <div className="tb-corpo tb-pila">
      <div className="tb-barra">
        <Indietro onClick={onIndietro} />
        <div className="stack grow" style={{ gap: 2, minWidth: 0 }}>
          <span className="ob tb-titolo">{lezione.corso.toUpperCase()}</span>
          <span className="num tb-quando chi-kanji" style={{ gap: 8 }}>
            <Kanji segni={lezione.kanji} />
            <span>
              {passata ? `${giorno.toUpperCase()} · ${orario(lezione)}` : orario(lezione)}
              {/* Il nome di chi la fa non si spazia: è il nome di una persona. */}
              {lezione.istruttori && <span style={{ letterSpacing: 0 }}> · {lezione.istruttori}</span>}
            </span>
            <EtichettaAttivita nome={lezione.attivita} grande />
          </span>
        </div>
        {passata && <span className="num tb-bollino" style={{ background: 'var(--giallo)' }}>LEZIONE PASSATA</span>}
        <span className="row" style={{ alignItems: 'baseline', gap: 8 }}>
          <span className="num" style={{ fontSize: 48, fontWeight: 700, lineHeight: 1 }}>{presenti}</span>
          <span className="num" style={{ fontSize: 22, color: 'var(--dim)' }}>/ {nomi?.length ?? lezione.iscritti}</span>
        </span>
      </div>

      <span className="ob tb-invito">{passata ? 'ERI A QUESTA LEZIONE? TOCCA IL TUO NOME' : 'TOCCA IL TUO NOME'}</span>

      {guaio && <Guaio titolo="ELENCO NON LETTO" testo={guaio} />}
      {!guaio && nomi === null && <p className="tb-nota">Sto leggendo gli iscritti…</p>}
      {nomi !== null && nomi.length === 0 && <p className="tb-nota">Questo corso non ha ancora iscritti.</p>}

      <div className="tb-tessere">
        {nomi?.map((p) => {
          const inCoda = attesa.has(p.personaId)
          const fatto = p.segnato || inCoda
          return (
            <button
              key={p.personaId}
              type="button"
              className="tb-tessera"
              data-fatto={fatto}
              data-attesa={inCoda || undefined}
              onClick={() => tocca(p)}
              aria-label={`${p.nome} ${p.sigla}${inCoda ? ': segnato, in attesa di rete' : fatto ? ': già segnato' : ''}`}
            >
              <span className="stack grow" style={{ gap: 2 }}>
                <span>
                  {p.nome} {p.sigla}
                </span>
                {inCoda && <span className="num tb-tessera-attesa">IN ATTESA DI RETE</span>}
              </span>
              {fatto && <Spunta size={26} />}
            </button>
          )
        })}
      </div>

      <div className="grow" />
      <span className="tb-nota">Non trovi il tuo nome? Chiedi all'istruttore: qui ci sono solo gli iscritti a questo corso.</span>

      {fascia && (
        <div role="status" className="tb-fascia" data-tipo={fascia.tipo} data-attesa={(fascia.tipo === 'fatto' && fascia.attesa) || undefined}>
          {fascia.tipo === 'fatto' && (
            <>
              <span style={{ color: fascia.attesa ? 'var(--giallo-testo)' : 'var(--verde-testo)' }}>
                <Spunta size={40} />
              </span>
              <span className="stack grow" style={{ gap: 2 }}>
                <span className="ob tb-fascia-titolo">
                  {passata ? 'FATTO' : 'BUON ALLENAMENTO'}, {fascia.p.nome.toUpperCase()}!
                </span>
                <span className="tb-sotto">
                  {fascia.attesa
                    ? 'Manca la rete: la presenza è salvata su questo tablet e parte appena torna.'
                    : passata
                      ? `Presenza segnata per ${giorno}.`
                      : 'Presenza segnata.'}{' '}
                  Toccato il nome sbagliato? Annulla qui.
                </span>
              </span>
              <button type="button" className="tb-btn tb-btn-linea tb-btn-grande" onClick={() => void annulla(fascia.p)}>
                ANNULLA
              </button>
            </>
          )}
          {fascia.tipo === 'gia' && (
            <>
              <span className="stack grow" style={{ gap: 2 }}>
                <span className="ob tb-fascia-titolo">
                  {fascia.p.nome.toUpperCase()} {fascia.p.sigla} È GIÀ TRA I PRESENTI
                </span>
                <span className="tb-sotto">
                  {fascia.annulla
                    ? 'Toccato per sbaglio? Annulla qui.'
                    : "Se non eri tu, dillo all'istruttore: lo corregge dall'area istruttore."}
                </span>
              </span>
              {fascia.annulla ? (
                <button type="button" className="tb-btn tb-btn-linea tb-btn-grande" onClick={() => void annulla(fascia.p)}>
                  ANNULLA
                </button>
              ) : (
                <button type="button" className="tb-btn tb-btn-linea tb-btn-grande" onClick={() => mostra(null)}>
                  VA BENE
                </button>
              )}
            </>
          )}
          {fascia.tipo === 'istruttore' && (
            <>
              <span className="stack grow" style={{ gap: 2 }}>
                <span className="ob tb-fascia-titolo">L'ISTRUTTORE HA GIÀ SEGNATO {fascia.p.nome.toUpperCase()}</span>
                <span className="tb-sotto">Se c'eri, diglielo: lo corregge lui dall'area istruttore.</span>
              </span>
              <button type="button" className="tb-btn tb-btn-linea tb-btn-grande" onClick={() => mostra(null)}>
                VA BENE
              </button>
            </>
          )}
          {fascia.tipo === 'annullato' && (
            <span className="stack grow" style={{ gap: 2 }}>
              <span className="ob tb-fascia-titolo">ANNULLATO</span>
              <span className="tb-sotto">
                {fascia.p.nome} {fascia.p.sigla}: presenza tolta. Chi c'è tocca il suo nome.
              </span>
            </span>
          )}
          {fascia.tipo === 'errore' && (
            <>
              <span className="stack grow" style={{ gap: 2 }}>
                <span className="ob tb-fascia-titolo" style={{ color: 'var(--rosso)' }}>NON È ANDATA</span>
                <span className="tb-sotto">{fascia.testo}</span>
              </span>
              <button type="button" className="tb-btn tb-btn-linea tb-btn-grande" onClick={() => mostra(null)}>
                VA BENE
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
