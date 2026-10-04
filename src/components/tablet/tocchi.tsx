import { useEffect, useRef, useState } from 'react'
import type { DatiTablet, LezioneSala, NomeSala } from '../../lib/tablet'
import { chiaveTocco, codaDelTablet, dimenticaTocco, inAttesa, ricordaTocco, rifiutato, siAnnulla } from '../../lib/tablet'
import { Spunta } from '../Icons'
import { messaggio } from './comune'

/** Il tocco più recente di una persona, detto in una fascia. */
export type Fascia =
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
 * Di fascia sullo schermo ce n'è una sola: con due lezioni aperte ogni elenco
 * ha i suoi tocchi, ma la fascia (e il suo ANNULLA) è quella dell'ultimo tocco,
 * dovunque sia stato. Chi non è l'ultimo toglie la sua.
 */
let ultimo: object | null = null
const ascoltatori = new Set<() => void>()

/**
 * I tocchi sui nomi di una lezione, uguali dove si toccano: la schermata
 * SEGNA LA PRESENZA e l'appello veloce della home. Il tocco segna subito, senza
 * domande; per chi sbaglia nome c'è la fascia con ANNULLA, che resta qualche
 * secondo (il server tiene aperto l'annullo per due minuti).
 *
 * Si vede che è segnato prima che il server risponda. Se il server dice di no
 * (l'istruttore l'aveva già segnato assente, fuori orario) il segno si toglie
 * e la fascia dice perché. Se la rete non c'è il segno resta: il tocco va
 * nella coda del tablet, e il nome dice IN ATTESA DI RETE finché non arriva.
 */
export function useTocchi(d: DatiTablet, lezione: LezioneSala, onCambiato?: () => void) {
  const [nomi, setNomi] = useState<NomeSala[] | null>(null)
  const [guaio, setGuaio] = useState<string | null>(null)
  const [fascia, setFascia] = useState<Fascia | null>(null)
  const timer = useRef<number>()
  const io = useRef({})
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
  // Un tocco altrove ha preso la fascia: la mia, se c'era, non serve più.
  useEffect(() => {
    const ascolta = () => {
      if (ultimo === io.current) return
      window.clearTimeout(timer.current)
      setFascia(null)
    }
    ascoltatori.add(ascolta)
    return () => void ascoltatori.delete(ascolta)
  }, [])

  const mostra = (f: Fascia | null) => {
    window.clearTimeout(timer.current)
    if (f && ultimo !== io.current) {
      ultimo = io.current
      ascoltatori.forEach((a) => a())
    }
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

  return { nomi, guaio, fascia, attesa, tocca, annulla, chiudi: () => mostra(null) }
}

/** La fascia in basso: l'esito dell'ultimo tocco, con ANNULLA finché si può. */
export function FasciaTocco({
  fascia,
  passata,
  giorno,
  onAnnulla,
  onChiudi,
}: {
  fascia: Fascia
  passata: boolean
  giorno: string
  onAnnulla: (p: NomeSala) => void | Promise<void>
  onChiudi: () => void
}) {
  return (
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
          <button type="button" className="tb-btn tb-btn-linea tb-btn-grande" onClick={() => void onAnnulla(fascia.p)}>
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
            <button type="button" className="tb-btn tb-btn-linea tb-btn-grande" onClick={() => void onAnnulla(fascia.p)}>
              ANNULLA
            </button>
          ) : (
            <button type="button" className="tb-btn tb-btn-linea tb-btn-grande" onClick={() => onChiudi()}>
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
          <button type="button" className="tb-btn tb-btn-linea tb-btn-grande" onClick={() => onChiudi()}>
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
          <button type="button" className="tb-btn tb-btn-linea tb-btn-grande" onClick={() => onChiudi()}>
            VA BENE
          </button>
        </>
      )}
    </div>
  )
}
