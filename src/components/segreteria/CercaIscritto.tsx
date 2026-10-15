import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { datiRichieste } from '../../lib/richieste'
import { cercaTutto, doveVa, RIGHE_PER_GRUPPO, unisciLetture, type Fonti, type GruppoTrovato, type RigaTrovata, type TipoRisultato } from '../../lib/ricerca'
import { useSchermo } from '../../lib/largo'
import type { DatiSegreteria } from '../../lib/segreteria'
import type { Voce } from '../../lib/indirizzoSegreteria'
import type { Destinazione } from './Segreteria'

const NOMI_FONTI = { iscritti: 'iscritti', richieste: 'richieste online', corsi: 'corsi', istruttori: 'istruttori' } as const

/** Una riga scelta con le frecce: un risultato, o «ALTRI N» in fondo al gruppo. */
interface RigaScelta {
  chiave: string
  /** Il posto fra le righe scelte con le frecce. */
  i: number
  gruppo: GruppoTrovato
  riga?: RigaTrovata
}

const vociDi = (gruppi: GruppoTrovato[]): RigaScelta[] =>
  gruppi
    .flatMap((g) => [
      ...g.righe.map((riga) => ({ chiave: `${g.tipo}-${riga.id}`, gruppo: g, riga })),
      ...(g.totale > RIGHE_PER_GRUPPO ? [{ chiave: `${g.tipo}-altri`, gruppo: g }] : []),
    ])
    .map((v, i) => ({ ...v, i }))

/**
 * Il gesto più frequente al banco: c'è qualcuno davanti, lo si trova. Il campo
 * sta in cima al menu, da qualunque voce; «/» ci porta il fuoco. Scrivendo
 * escono, a gruppi, iscritti, richieste online, corsi e istruttori (vedi
 * `cercaTutto`); con le frecce si sceglie, Invio apre. Si legge la prima volta
 * che il campo prende il fuoco, non all'apertura della segreteria. Aperto un
 * risultato il testo resta nel campo: di solito se ne guardano due o tre di fila.
 */
export function CercaIscritto({ d, onVai }: { d: DatiSegreteria; onVai: (voce: Voce, dest?: Destinazione) => void }) {
  const [testo, setTesto] = useState('')
  const [fonti, setFonti] = useState<Fonti | null>(null)
  // Una lettura riuscita sostituisce l'elenco; una fallita tiene quello di prima, e lo dice.
  const [vecchi, setVecchi] = useState(false)
  const [scelto, setScelto] = useState(0)
  const [aperto, setAperto] = useState(false)
  const campo = useRef<HTMLInputElement>(null)
  const [punto, setPunto] = useState<{ left: number; top: number } | null>(null)
  const ultime = useRef<Fonti | null>(null)
  const letture = useRef(0)
  const chiudi = useRef<number>()
  const id = useId()
  const conTastiera = useSchermo('(pointer: fine)')

  // «/» da qualunque punto, tranne mentre si scrive in un altro campo.
  useEffect(() => {
    const tasto = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return
      const qui = document.activeElement as HTMLElement | null
      if (qui && (qui.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(qui.tagName))) return
      e.preventDefault()
      campo.current?.focus()
    }
    window.addEventListener('keydown', tasto)
    return () => window.removeEventListener('keydown', tasto)
  }, [])

  // A ogni fuoco si rilegge: un iscritto aggiunto poco fa si trova subito.
  const leggi = () => {
    const numero = ++letture.current
    const leggere = <T,>(f: () => Promise<T>) => f().then((x) => x, () => null)
    void Promise.all([
      leggere(() => d.persone()),
      leggere(() => datiRichieste().then((r) => r.richieste())),
      leggere(() => d.corsi()),
      leggere(() => d.istruttori()),
    ]).then(([persone, richieste, corsi, istruttori]) => {
      const { fonti: nuove, vecchi } = unisciLetture(ultime.current, { persone, richieste, corsi, istruttori })
      // Due fuochi ravvicinati: vale l'ultima lettura partita, non l'ultima arrivata.
      if (numero !== letture.current) return
      ultime.current = nuove
      setVecchi(vecchi)
      setFonti(nuove)
    })
  }

  const esito = fonti && cercaTutto(testo, fonti)
  const voci = esito ? vociDi(esito.gruppi) : []
  const mostra = aperto && testo.trim().length > 0

  // L'elenco è più largo del menu e il menu scorre e taglia: sta fuori, fisso, sotto il campo.
  useLayoutEffect(() => {
    if (!mostra) return
    const mettiAPosto = () => {
      const r = campo.current?.getBoundingClientRect()
      if (!r) return
      const larghezza = Math.min(368, window.innerWidth - 16)
      setPunto({ left: Math.max(8, Math.min(r.left, window.innerWidth - larghezza - 8)), top: r.bottom + 4 })
    }
    mettiAPosto()
    window.addEventListener('resize', mettiAPosto)
    window.addEventListener('scroll', mettiAPosto, true)
    return () => {
      window.removeEventListener('resize', mettiAPosto)
      window.removeEventListener('scroll', mettiAPosto, true)
    }
  }, [mostra])

  // Con le frecce la riga scelta resta in vista anche se l'elenco scorre.
  useEffect(() => {
    if (mostra && voci[scelto]) document.getElementById(`${id}-${voci[scelto].chiave}`)?.scrollIntoView({ block: 'nearest' })
  }, [mostra, scelto, id, voci])

  const apri = (v: RigaScelta) => {
    // Il testo resta: Esc lo toglie. Il fuoco esce, così l'elenco si chiude e la scheda è subito usabile.
    setAperto(false)
    campo.current?.blur()
    const { voce, dest } = doveVa(v.gruppo.tipo, v.riga, { testo: testo.trim(), ids: v.gruppo.ids })
    onVai(voce, dest)
  }

  const nota = !esito
    ? 'Sto leggendo l’elenco…'
    : esito.stato === 'non_letto'
      ? 'Non riesco a leggere l’elenco: riprova fra poco.'
      : esito.stato === 'niente'
        ? 'Non trovo niente.'
        : ''
  const mancano = esito && esito.stato === 'trovato' ? esito.nonLetti.map((t: TipoRisultato) => NOMI_FONTI[t]).join(', ') : ''

  return (
    <div className="sg-cerca">
      <label htmlFor={`${id}-campo`} className="vh">
        Cerca un iscritto, una richiesta, un corso o un istruttore
      </label>
      <input
        ref={campo}
        id={`${id}-campo`}
        className="sg-campo"
        type="search"
        autoComplete="off"
        // «/» è una scorciatoia da tastiera: col dito non si dice.
        placeholder={conTastiera ? 'Cerca  /' : 'Cerca'}
        role="combobox"
        aria-expanded={mostra}
        aria-controls={`${id}-elenco`}
        aria-activedescendant={mostra && voci[scelto] ? `${id}-${voci[scelto].chiave}` : undefined}
        value={testo}
        onFocus={() => {
          // Un fuoco che torna entro il ritardo di onBlur non deve trovare l'elenco chiuso.
          window.clearTimeout(chiudi.current)
          setScelto(0)
          leggi()
          setAperto(true)
          // Tornati nel campo, il testo di prima è pronto da cambiare.
          campo.current?.select()
        }}
        onBlur={() => {
          chiudi.current = window.setTimeout(() => setAperto(false), 150)
        }}
        onChange={(e) => {
          setTesto(e.target.value)
          setScelto(0)
          setAperto(true)
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && voci.length) {
            e.preventDefault()
            setScelto((s) => (s + 1) % voci.length)
          } else if (e.key === 'ArrowUp' && voci.length) {
            e.preventDefault()
            setScelto((s) => (s - 1 + voci.length) % voci.length)
          } else if (e.key === 'Enter' && voci[scelto]) {
            e.preventDefault()
            apri(voci[scelto])
          } else if (e.key === 'Escape') {
            setTesto('')
            campo.current?.blur()
          }
        }}
      />
      {mostra && (
        <ul
          id={`${id}-elenco`}
          role="listbox"
          aria-label="Risultati"
          className="sg-cerca-elenco"
          style={punto ? { left: punto.left, top: punto.top, maxHeight: `calc(100dvh - ${punto.top}px - 8px)` } : { visibility: 'hidden' }}
        >
          {nota && <li className="sg-cerca-vuoto" role="presentation">{nota}</li>}
          {esito?.gruppi.map((g) => (
            <li key={g.tipo} role="presentation">
              <div className="sg-cerca-gruppo" aria-hidden="true">
                <span>{g.titolo}</span>
                <span className="sg-cerca-filo" />
                <span>{g.totale}</span>
              </div>
              <ul role="group" aria-label={g.titolo} className="sg-cerca-righe">
                {voci
                  .filter((v) => v.gruppo === g)
                  .map((v) => {
                    const { i } = v
                    return (
                      <li
                        key={v.chiave}
                        id={`${id}-${v.chiave}`}
                        role="option"
                        aria-selected={i === scelto}
                        className={v.riga ? 'sg-cerca-voce' : 'sg-cerca-voce sg-cerca-altri'}
                        data-spento={v.riga?.spenta || undefined}
                        onMouseDown={(e) => e.preventDefault()}
                        onMouseEnter={() => setScelto(i)}
                        onClick={() => apri(v)}
                      >
                        {v.riga ? (
                          <>
                            <span className="sg-cerca-testo">
                              <span>{v.riga.nome}</span>
                              {v.riga.sotto && <span className="sg-cerca-sotto">{v.riga.sotto}</span>}
                            </span>
                            {v.riga.nota &&
                              (v.riga.tag ? (
                                <span className="sg-tag" data-tipo="aspetta">{v.riga.nota}</span>
                              ) : (
                                <span className="sg-cerca-nota">{v.riga.nota}</span>
                              ))}
                          </>
                        ) : (
                          <>
                            <span>ALTRI {g.totale - RIGHE_PER_GRUPPO}</span>
                            <span aria-hidden="true">›</span>
                          </>
                        )}
                      </li>
                    )
                  })}
              </ul>
            </li>
          ))}
          {vecchi && <li className="sg-cerca-vuoto" role="presentation">Non riesco ad aggiornare l’elenco: questi sono i dati di prima.</li>}
          {mancano && <li className="sg-cerca-vuoto" role="presentation">Non ho potuto leggere: {mancano}.</li>}
        </ul>
      )}
    </div>
  )
}
