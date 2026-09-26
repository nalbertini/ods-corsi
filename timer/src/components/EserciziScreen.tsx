import { useEffect, useMemo, useState } from 'react'
import {
  CATEGORIE,
  type Categoria,
  type Esercizio,
  aggiungiNomi,
  catalogoDiPartenza,
  nomiDaTesto,
  normalizza,
} from '../lib/esercizi'
import { listClips } from '../lib/clipStore'
import { exerciseKey } from '../lib/voiceClips'
import { uid } from '../lib/format'
import { Plus, Trash } from './Icons'

/**
 * La gestione del catalogo: è qui che la palestra si costruisce il proprio
 * elenco di esercizi, invece di aggiungerli uno alla volta mentre scrive un
 * timer. Rinominare vuol dire rinominare anche nei timer che lo usano: un
 * esercizio è una cosa sola, non una stringa copiata in giro.
 */

interface Bozza {
  nome: string
  categoria: Categoria
}

export function EserciziScreen({
  catalogo,
  onCatalogo,
  usi,
  onRinomina,
}: {
  catalogo: Esercizio[]
  onCatalogo: (lista: Esercizio[]) => void
  /** Quante volte ogni nome (normalizzato) compare nei timer salvati. */
  usi: Record<string, number>
  onRinomina: (da: string, a: string) => void
}) {
  const [cerca, setCerca] = useState('')
  const [categoria, setCategoria] = useState<Categoria | 'tutte'>('tutte')
  const [aperto, setAperto] = useState<string | null>(null)
  const [bozza, setBozza] = useState<Bozza>({ nome: '', categoria: 'A corpo libero' })
  const [incolla, setIncolla] = useState(false)
  const [testo, setTesto] = useState('')
  const [esito, setEsito] = useState<string | null>(null)
  const [incise, setIncise] = useState<Set<string>>(new Set())

  useEffect(() => {
    void listClips().then((k) => setIncise(new Set(k)))
  }, [catalogo])

  const q = normalizza(cerca)
  const visibili = useMemo(
    () =>
      catalogo.filter(
        (e) => (categoria === 'tutte' || e.categoria === categoria) && (!q || normalizza(e.nome).includes(q)),
      ),
    [catalogo, categoria, q],
  )

  const gruppi = useMemo(() => {
    const ordine = CATEGORIE.filter((c) => visibili.some((e) => e.categoria === c))
    return ordine.map((c) => ({ categoria: c, lista: visibili.filter((e) => e.categoria === c) }))
  }, [visibili])

  const quantiUsi = (nome: string) => usi[normalizza(nome)] ?? 0

  /** Un nome è libero se nessun altro esercizio lo porta già. */
  const libero = (nome: string, tranne?: string) =>
    !catalogo.some((e) => e.id !== tranne && normalizza(e.nome) === normalizza(nome))

  const apri = (e: Esercizio) => {
    setIncolla(false)
    setEsito(null)
    setAperto(e.id)
    setBozza({ nome: e.nome, categoria: e.categoria })
  }

  const apriNuovo = () => {
    setIncolla(false)
    setEsito(null)
    setAperto('nuovo')
    setBozza({ nome: cerca.trim(), categoria: categoria === 'tutte' ? 'A corpo libero' : categoria })
  }

  const chiudi = () => setAperto(null)

  const salva = () => {
    const nome = bozza.nome.trim()
    if (!nome || !libero(nome, aperto ?? undefined)) return
    if (aperto === 'nuovo') {
      onCatalogo([...catalogo, { id: uid(), nome, categoria: bozza.categoria, propri: true }])
      setCerca('')
    } else {
      const vecchio = catalogo.find((e) => e.id === aperto)
      if (!vecchio) return
      onCatalogo(catalogo.map((e) => (e.id === aperto ? { ...e, nome, categoria: bozza.categoria } : e)))
      if (vecchio.nome !== nome) onRinomina(vecchio.nome, nome)
    }
    chiudi()
  }

  const elimina = (e: Esercizio) => {
    const n = quantiUsi(e.nome)
    const avviso = n > 0 ? `\n\nCompare in ${n} ${n === 1 ? 'timer' : 'timer'}: lì resta com'è.` : ''
    if (!window.confirm(`Togliere “${e.nome}” dal catalogo?${avviso}`)) return
    onCatalogo(catalogo.filter((x) => x.id !== e.id))
    chiudi()
  }

  const nomiIncollati = useMemo(() => nomiDaTesto(testo), [testo])
  const nuoviIncollati = useMemo(() => {
    const visti = new Set(catalogo.map((e) => normalizza(e.nome)))
    let n = 0
    const dentro = new Set<string>()
    for (const nome of nomiIncollati) {
      const k = normalizza(nome)
      if (visti.has(k) || dentro.has(k)) continue
      dentro.add(k)
      n += 1
    }
    return n
  }, [catalogo, nomiIncollati])

  const confermaIncolla = () => {
    const { lista, aggiunti, saltati } = aggiungiNomi(catalogo, nomiIncollati, bozza.categoria)
    onCatalogo(lista)
    setTesto('')
    setIncolla(false)
    setEsito(
      `${aggiunti.length} ${aggiunti.length === 1 ? 'esercizio aggiunto' : 'esercizi aggiunti'}` +
        (saltati.length > 0 ? ` · ${saltati.length} già in catalogo` : ''),
    )
  }

  const svuota = () => {
    if (!window.confirm(`Svuotare il catalogo? Spariscono tutti i ${catalogo.length} esercizi.`)) return
    onCatalogo([])
    setEsito('Catalogo svuotato.')
  }

  const ripristina = () => {
    if (!window.confirm('Rimettere il catalogo di partenza? Quello che c’è adesso viene sostituito.')) return
    onCatalogo(catalogoDiPartenza())
    setEsito('Catalogo di partenza rimesso.')
  }

  const editor = (
    <div className="card stack" style={{ gap: 12, padding: 14, borderColor: 'var(--blu)' }}>
      <input
        className="field"
        value={bozza.nome}
        placeholder="Nome dell’esercizio"
        onChange={(ev) => setBozza((b) => ({ ...b, nome: ev.target.value }))}
        autoFocus
      />
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        {CATEGORIE.map((c) => (
          <button
            key={c}
            className="chip"
            data-on={bozza.categoria === c}
            onClick={() => setBozza((b) => ({ ...b, categoria: c }))}
          >
            {c.toUpperCase()}
          </button>
        ))}
      </div>
      {bozza.nome.trim() && !libero(bozza.nome, aperto ?? undefined) && (
        <span style={{ fontSize: 12, color: 'var(--giallo-testo)' }}>C’è già un esercizio con questo nome.</span>
      )}
      {aperto !== 'nuovo' && quantiUsi(catalogo.find((e) => e.id === aperto)?.nome ?? '') > 0 && (
        <span style={{ fontSize: 12, color: 'var(--dim)' }}>
          Se lo rinomini, cambia nome anche nei timer che lo usano.
        </span>
      )}
      <div className="row" style={{ gap: 10 }}>
        {aperto !== 'nuovo' && (
          <button
            className="icon-btn"
            style={{ borderColor: 'var(--line)', color: 'var(--faint)' }}
            onClick={() => {
              const e = catalogo.find((x) => x.id === aperto)
              if (e) elimina(e)
            }}
            aria-label="Elimina"
          >
            <Trash size={16} />
          </button>
        )}
        <button className="btn btn-ghost grow" style={{ minHeight: 48, fontSize: 16 }} onClick={chiudi}>
          ANNULLA
        </button>
        <button
          className="btn btn-go grow"
          style={{ minHeight: 48, fontSize: 16 }}
          disabled={!bozza.nome.trim() || !libero(bozza.nome, aperto ?? undefined)}
          onClick={salva}
        >
          SALVA
        </button>
      </div>
    </div>
  )

  return (
    <>
      <div className="pad stack" style={{ gap: 10, paddingTop: 4 }}>
        <input
          className="field"
          value={cerca}
          placeholder="Cerca nel catalogo"
          onChange={(ev) => setCerca(ev.target.value)}
        />
        <div className="row" style={{ gap: 8, overflowX: 'auto' }}>
          <button className="chip" data-on={categoria === 'tutte'} onClick={() => setCategoria('tutte')}>
            TUTTI
          </button>
          {CATEGORIE.map((c) => (
            <button key={c} className="chip" data-on={categoria === c} onClick={() => setCategoria(c)}>
              {c.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="pad stack" style={{ gap: 8, paddingTop: 12 }}>
        {aperto === 'nuovo' ? (
          editor
        ) : (
          <button className="btn btn-dashed" style={{ minHeight: 52, fontSize: 15 }} onClick={apriNuovo}>
            <Plus size={16} />
            NUOVO ESERCIZIO
          </button>
        )}
      </div>

      {catalogo.length === 0 && (
        <p className="pad" style={{ fontSize: 15, lineHeight: 1.5, color: 'var(--dim)', marginTop: 20 }}>
          Il catalogo è vuoto. Qui sotto puoi incollare l’elenco della palestra, oppure rimettere quello di partenza.
        </p>
      )}

      {catalogo.length > 0 && visibili.length === 0 && (
        <p className="pad" style={{ fontSize: 15, color: 'var(--dim)', marginTop: 20 }}>
          Nessun esercizio trovato.
        </p>
      )}

      {gruppi.map((g) => (
        <div key={g.categoria}>
          <div className="rule">
            <span className="rule-label">{g.categoria.toUpperCase()}</span>
            <div className="rule-line" />
            <span className="num" style={{ fontSize: 15, fontWeight: 600, color: 'var(--dim)' }}>
              {g.lista.length}
            </span>
          </div>
          <div className="pad stack" style={{ gap: 6 }}>
            {g.lista.map((e) => {
              if (aperto === e.id) return <div key={e.id}>{editor}</div>
              const n = quantiUsi(e.nome)
              const voce = incise.has(exerciseKey(e.nome))
              return (
                <button
                  key={e.id}
                  className="card row"
                  style={{ gap: 10, padding: '0 12px', minHeight: 54, textAlign: 'left' }}
                  onClick={() => apri(e)}
                >
                  <div className="stack grow" style={{ gap: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 15, fontWeight: 600 }}>{e.nome}</span>
                    {(n > 0 || voce) && (
                      <span style={{ fontSize: 11, color: 'var(--faint)' }}>
                        {[n > 0 ? `in ${n} timer` : '', voce ? 'voce incisa' : ''].filter(Boolean).join(' · ')}
                      </span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      ))}

      <div className="rule">
        <span className="rule-label">CATALOGO</span>
        <div className="rule-line" />
      </div>
      <div className="pad stack" style={{ gap: 8, paddingBottom: 24 }}>
        <span style={{ fontSize: 13, color: 'var(--dim)', lineHeight: 1.45 }}>
          Il catalogo vive su questo dispositivo, come i timer. I nomi che contiene sono anche quelli che si possono
          incidere con la voce di Maurizio.
        </span>
        {incolla && (
          <div className="card stack" style={{ gap: 12, padding: 14, borderColor: 'var(--blu)' }}>
            <span style={{ fontSize: 13, color: 'var(--dim)', lineHeight: 1.4 }}>
              Un esercizio per riga. Quelli già in catalogo vengono saltati.
            </span>
            <textarea
              className="field"
              style={{ minHeight: 130, fontSize: 15, fontWeight: 500, resize: 'vertical' }}
              value={testo}
              placeholder={'Uchi komi\nNage komi\nRandori'}
              onChange={(ev) => setTesto(ev.target.value)}
            />
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              {CATEGORIE.map((c) => (
                <button
                  key={c}
                  className="chip"
                  data-on={bozza.categoria === c}
                  onClick={() => setBozza((b) => ({ ...b, categoria: c }))}
                >
                  {c.toUpperCase()}
                </button>
              ))}
            </div>
            <button
              className="btn btn-go"
              style={{ minHeight: 48, fontSize: 16 }}
              disabled={nuoviIncollati === 0}
              onClick={confermaIncolla}
            >
              AGGIUNGI {nuoviIncollati > 0 ? nuoviIncollati : ''}
            </button>
          </div>
        )}
        {!incolla && (
          <button
            className="btn btn-dashed"
            style={{ minHeight: 48, fontSize: 15 }}
            onClick={() => {
              setAperto(null)
              setEsito(null)
              setIncolla(true)
            }}
          >
            INCOLLA UN ELENCO
          </button>
        )}
        {esito && <span style={{ fontSize: 13, color: 'var(--verde)' }}>{esito}</span>}
        <div className="row" style={{ gap: 8 }}>
          <button className="btn btn-ghost grow" style={{ minHeight: 48, fontSize: 15 }} onClick={ripristina}>
            RIPRISTINA
          </button>
          <button
            className="btn btn-ghost grow"
            style={{ minHeight: 48, fontSize: 15 }}
            disabled={catalogo.length === 0}
            onClick={svuota}
          >
            SVUOTA
          </button>
        </div>
      </div>
    </>
  )
}
