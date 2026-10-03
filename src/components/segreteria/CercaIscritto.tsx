import { useEffect, useId, useRef, useState } from 'react'
import type { DatiSegreteria, PersonaSeg } from '../../lib/segreteria'

/** Senza maiuscole né accenti: «nicolò» trova «Nicolo». */
const piano = (t: string) => t.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

/**
 * Il gesto più frequente al banco: c'è qualcuno davanti, lo si trova. Il campo
 * sta in cima al menu, da qualunque voce; «/» ci porta il fuoco. Scrivendo
 * escono i nomi (le parole del nome e del cognome che cominciano così), con le
 * frecce si sceglie, Invio apre la scheda. Gli iscritti si leggono la prima
 * volta che il campo prende il fuoco, non all'apertura della segreteria.
 */
export function CercaIscritto({ d, onApri }: { d: DatiSegreteria; onApri: (personaId: string) => void }) {
  const [testo, setTesto] = useState('')
  const [persone, setPersone] = useState<PersonaSeg[] | null>(null)
  const [scelto, setScelto] = useState(0)
  const [aperto, setAperto] = useState(false)
  const campo = useRef<HTMLInputElement>(null)
  const id = useId()

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
    d.persone().then(setPersone, () => setPersone((x) => x ?? []))
  }

  const cerca = piano(testo.trim())
  const trovati = cerca
    ? (persone ?? [])
        .filter((p) => cerca.split(/\s+/).every((pezzo) => piano(`${p.nome} ${p.cognome}`).split(/\s+/).some((parola) => parola.startsWith(pezzo))))
        .sort((a, b) => Number(b.attiva) - Number(a.attiva) || a.cognome.localeCompare(b.cognome, 'it'))
        .slice(0, 8)
    : []
  const mostra = aperto && cerca.length > 0

  const apri = (p: PersonaSeg) => {
    setTesto('')
    setAperto(false)
    campo.current?.blur()
    onApri(p.id)
  }

  return (
    <div className="sg-cerca">
      <label htmlFor={`${id}-campo`} className="vh">
        Cerca un iscritto
      </label>
      <input
        ref={campo}
        id={`${id}-campo`}
        className="sg-campo"
        type="search"
        autoComplete="off"
        placeholder="Cerca iscritto  /"
        role="combobox"
        aria-expanded={mostra}
        aria-controls={`${id}-elenco`}
        aria-activedescendant={mostra && trovati[scelto] ? `${id}-${trovati[scelto].id}` : undefined}
        value={testo}
        onFocus={() => {
          leggi()
          setAperto(true)
        }}
        onBlur={() => window.setTimeout(() => setAperto(false), 150)}
        onChange={(e) => {
          setTesto(e.target.value)
          setScelto(0)
          setAperto(true)
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && trovati.length) {
            e.preventDefault()
            setScelto((s) => (s + 1) % trovati.length)
          } else if (e.key === 'ArrowUp' && trovati.length) {
            e.preventDefault()
            setScelto((s) => (s - 1 + trovati.length) % trovati.length)
          } else if (e.key === 'Enter' && trovati[scelto]) {
            e.preventDefault()
            apri(trovati[scelto])
          } else if (e.key === 'Escape') {
            setTesto('')
            campo.current?.blur()
          }
        }}
      />
      {mostra && (
        <ul id={`${id}-elenco`} role="listbox" aria-label="Iscritti trovati" className="sg-cerca-elenco">
          {persone === null && <li className="sg-cerca-vuoto">Sto leggendo l’elenco…</li>}
          {persone !== null && trovati.length === 0 && <li className="sg-cerca-vuoto">Nessuno si chiama così.</li>}
          {trovati.map((p, i) => (
            <li
              key={p.id}
              id={`${id}-${p.id}`}
              role="option"
              aria-selected={i === scelto}
              className="sg-cerca-voce"
              data-spento={!p.attiva || undefined}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setScelto(i)}
              onClick={() => apri(p)}
            >
              <span>
                {p.cognome} {p.nome}
              </span>
              {!p.attiva && <span className="sg-cerca-nota">non attiva</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
