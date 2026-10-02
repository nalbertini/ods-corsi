import { useEffect, useRef, useState } from 'react'
import type { DatiTablet, LezioneSala, NomeSala } from '../../lib/tablet'
import { fase } from '../../lib/tablet'
import { chiaveGiorno, giornoPerEsteso } from '../../lib/sala'
import { Spunta } from '../Icons'
import { Guaio, Indietro, messaggio, orario } from './comune'
import { Kanji } from '../Kanji'

type Fascia =
  | { tipo: 'fatto'; p: NomeSala }
  | { tipo: 'gia'; p: NomeSala }
  | { tipo: 'istruttore'; p: NomeSala }
  | { tipo: 'errore'; testo: string }

/** Quanto resta in basso la fascia, in millisecondi. */
const DURATA: Record<Fascia['tipo'], number> = { fatto: 6000, gia: 4000, istruttore: 6000, errore: 6000 }

/**
 * I nomi da toccare.
 *
 * Il tocco segna subito, senza domande: chi arriva ha la borsa in mano e dieci
 * persone dietro. Per chi sbaglia nome c'è la fascia in basso con ANNULLA,
 * che resta qualche secondo; il server tiene aperto l'annullo per due minuti.
 *
 * Si vede che è segnato prima che il server risponda. Se poi il server dice di
 * no — l'istruttore l'aveva già segnato assente, la rete non c'è — il segno si
 * toglie e la fascia dice perché.
 */
export function TabletPresenza({
  d,
  lezione,
  adesso,
  onIndietro,
}: {
  d: DatiTablet
  lezione: LezioneSala
  adesso: Date
  onIndietro: () => void
}) {
  const [nomi, setNomi] = useState<NomeSala[] | null>(null)
  const [guaio, setGuaio] = useState<string | null>(null)
  const [fascia, setFascia] = useState<Fascia | null>(null)
  const timer = useRef<number>()
  // L'ultimo tocco ancora in viaggio: ANNULLA lo aspetta, altrimenti il server
  // riceverebbe l'annullo prima della presenza da annullare.
  const inViaggio = useRef(new Map<string, Promise<boolean>>())

  useEffect(() => {
    let vivo = true
    d.elenco(lezione.id)
      .then((x) => vivo && setNomi(x))
      .catch((e: unknown) => vivo && setGuaio(messaggio(e, 'Non riesco a leggere gli iscritti')))
    return () => {
      vivo = false
      window.clearTimeout(timer.current)
    }
  }, [d, lezione.id])

  const mostra = (f: Fascia | null) => {
    window.clearTimeout(timer.current)
    setFascia(f)
    if (f) timer.current = window.setTimeout(() => setFascia(null), DURATA[f.tipo])
  }

  const segnato = (personaId: string, v: boolean) =>
    setNomi((n) => n && n.map((p) => (p.personaId === personaId ? { ...p, segnato: v } : p)))

  const tocca = (p: NomeSala) => {
    if (p.segnato) return mostra({ tipo: 'gia', p })
    segnato(p.personaId, true)
    mostra({ tipo: 'fatto', p })
    const viaggio = d
      .segna(lezione.id, p.personaId)
      .then((esito) => {
        if (esito === 'istruttore') {
          segnato(p.personaId, false)
          mostra({ tipo: 'istruttore', p })
          return false
        }
        return true
      })
      .catch((e: unknown) => {
        segnato(p.personaId, false)
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
    try {
      if (await d.annulla(lezione.id, p.personaId)) segnato(p.personaId, false)
      else mostra({ tipo: 'errore', testo: `Non si può più annullare: dillo all'istruttore, lo corregge lui.` })
    } catch (e) {
      mostra({ tipo: 'errore', testo: messaggio(e, 'Il server non risponde') })
    }
  }

  const passata = fase(lezione, adesso) !== 'aperta'
  const presenti = nomi?.filter((p) => p.segnato).length ?? lezione.presenti
  const giorno = giornoPerEsteso(chiaveGiorno(new Date(lezione.inizio)))

  return (
    <div className="tb-corpo tb-pila">
      <div className="tb-barra">
        <Indietro onClick={onIndietro} />
        <div className="stack grow" style={{ gap: 2, minWidth: 0 }}>
          <span className="ob tb-titolo">{lezione.corso.toUpperCase()}</span>
          <span className="num tb-quando chi-kanji" style={{ gap: 8 }}>
            <Kanji segni={lezione.kanji} />
            <span>{[passata ? `${giorno.toUpperCase()} · ${orario(lezione)}` : orario(lezione), lezione.istruttori].filter(Boolean).join(' · ')}</span>
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
        {nomi?.map((p) => (
          <button
            key={p.personaId}
            type="button"
            className="tb-tessera"
            data-fatto={p.segnato}
            onClick={() => tocca(p)}
            aria-label={`${p.nome} ${p.sigla}${p.segnato ? ': già segnato' : ''}`}
          >
            <span className="grow">
              {p.nome} {p.sigla}
            </span>
            {p.segnato && <Spunta size={26} />}
          </button>
        ))}
      </div>

      <div className="grow" />
      <span className="tb-nota">Non trovi il tuo nome? Chiedi all'istruttore: qui ci sono solo gli iscritti a questo corso.</span>

      {fascia && (
        <div role="status" className="tb-fascia" data-tipo={fascia.tipo}>
          {fascia.tipo === 'fatto' && (
            <>
              <span style={{ color: 'var(--verde)' }}>
                <Spunta size={40} />
              </span>
              <span className="stack grow" style={{ gap: 2 }}>
                <span className="ob tb-fascia-titolo">
                  {passata ? 'FATTO' : 'BUON ALLENAMENTO'}, {fascia.p.nome.toUpperCase()}!
                </span>
                <span className="tb-sotto">
                  {passata ? `Presenza segnata per ${giorno}.` : 'Presenza segnata.'} Toccato il nome sbagliato? Annulla qui.
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
                <span className="tb-sotto">Se non eri tu, dillo all'istruttore: lo corregge dall'area istruttore.</span>
              </span>
              <button type="button" className="tb-btn tb-btn-linea tb-btn-grande" onClick={() => mostra(null)}>
                VA BENE
              </button>
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
