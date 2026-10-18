import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Logo } from '../../Logo'
import { Bollino } from '../../ds'
import type { Voce } from '../../../lib/indirizzoSegreteria'
import { LUOGHI, luogoDi, voceInLista } from '../../../lib/luoghiBanco'

/** Il numero da mostrare accanto a una voce: cose che aspettano, con la parola per chi non vede il colore. */
const Segno = ({ n, detto }: { n: number; detto: string }) =>
  n > 0 ? (
    <span className="num sg-tag" data-tipo="presto" aria-label={`${n} ${detto}`}>
      {n}
    </span>
  ) : null

/**
 * La testata de «Il Banco»: in cima la ricerca, i tasti di sempre (link,
 * guida, tema) e chi è dentro; sotto i cinque luoghi, e sotto ancora le voci
 * del luogo aperto. Non sa niente dei dati: riceve i numeri e dice dove si va.
 */
export function BarraBanco({
  voce,
  prova,
  nome,
  ruolo,
  segni,
  cerca,
  link,
  guida,
  tema,
  onVai,
  onIstruttori,
  onEsci,
}: {
  voce: Voce
  prova: boolean
  nome: string
  ruolo: string
  /** Le cose che aspettano, per voce: la somma dà il numero del luogo. */
  segni: Partial<Record<Voce, { n: number; detto: string }>>
  cerca: ReactNode
  link: ReactNode
  guida: ReactNode
  tema: ReactNode
  onVai: (v: Voce) => void
  onIstruttori?: () => void
  onEsci?: () => void
}) {
  // Il menu LINK ▾ si chiude con Esc, con un clic fuori o lasciandolo con la tastiera: un <details> nativo non lo fa.
  const [linkAperto, setLinkAperto] = useState(false)
  const linkRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!linkAperto) return
    const fuori = (e: MouseEvent) => {
      if (!linkRef.current?.contains(e.target as Node)) setLinkAperto(false)
    }
    const esc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setLinkAperto(false)
      linkRef.current?.querySelector('button')?.focus()
    }
    document.addEventListener('mousedown', fuori)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', fuori)
      document.removeEventListener('keydown', esc)
    }
  }, [linkAperto])
  const luogo = LUOGHI.find((l) => l.id === luogoDi(voce)) ?? LUOGHI[0]
  const inLista = voceInLista(voce)
  return (
    <header className="bn-barra">
      <div className="bn-alto">
        <span className="bn-marchio">
          <Logo width={38} />
          <span className="stack" style={{ gap: 2 }}>
            <span className="ob" style={{ fontSize: 20, fontWeight: 700, letterSpacing: '0.06em', lineHeight: 1 }}>ODS CORSI</span>
            <span className="bn-sotto-marchio">SEGRETERIA</span>
          </span>
        </span>
        <div className="bn-cerca">{cerca}</div>
        <div className="grow" />
        {prova && <Bollino>DATI{' '}DI PROVA</Bollino>}
        <div
          className="bn-link"
          ref={linkRef}
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setLinkAperto(false)
          }}
        >
          <button type="button" className="num sg-btn sg-btn-linea" style={{ height: 44 }} aria-expanded={linkAperto} onClick={() => setLinkAperto((x) => !x)}>
            LINK ▾
          </button>
          {linkAperto && <div className="bn-link-voci sg-voci">{link}</div>}
        </div>
        {guida}
        {tema}
        <span className="bn-chi">
          <span style={{ fontSize: 14, fontWeight: 600 }}>{nome}</span>
          <span style={{ fontSize: 12, color: 'var(--dim)' }}>{ruolo}</span>
        </span>
        {onIstruttori && (
          <button type="button" className="num sg-btn sg-btn-linea" style={{ height: 44 }} onClick={onIstruttori}>
            ISTRUTTORI →
          </button>
        )}
        {onEsci && (
          <button type="button" className="sg-link" onClick={onEsci}>
            Esci
          </button>
        )}
      </div>
      <nav className="bn-luoghi" aria-label="Segreteria">
        {LUOGHI.map((l) => {
          const n = l.voci.reduce((somma, v) => somma + (segni[v.voce]?.n ?? 0), 0)
          return (
            <button key={l.id} type="button" className="num bn-luogo" aria-current={l.id === luogo.id ? 'page' : undefined} onClick={() => onVai(l.voci[0].voce)}>
              {l.nome}
              <Segno n={n} detto="da guardare" />
            </button>
          )
        })}
      </nav>
      <div className="bn-voci" role="group" aria-label={luogo.nome}>
        {luogo.voci.map((v) => (
          <button key={v.voce} type="button" className="num bn-voce" aria-current={v.voce === inLista ? 'page' : undefined} onClick={() => onVai(v.voce)}>
            {v.nome}
            <Segno n={segni[v.voce]?.n ?? 0} detto={segni[v.voce]?.detto ?? ''} />
          </button>
        ))}
      </div>
    </header>
  )
}
