import { useEffect, useState } from 'react'
import type { DatiSegreteria } from '../../lib/segreteria'
import { datiSegreteria } from '../../lib/segreteria'
import { Logo } from '../Logo'
import { Bollino } from '../ds'
import { TastoTema } from '../TastoTema'
import { Conferme, Guaio, lasciare } from './comune'
import { Pagamenti } from './Pagamenti'
import { Listino } from './Listino'
import { indirizzoPagina } from '../../lib/guida'
import { VERSIONE, VERSIONE_ESTESA } from '../../lib/versione'

type VoceAmministrazione = 'pagamenti' | 'listino'

/** Il menu dell'amministrazione: i conti, e basta. Le persone, le presenze e le statistiche non ci sono. */
const VOCI: Array<[VoceAmministrazione, string]> = [
  ['pagamenti', 'PAGAMENTI'],
  ['listino', 'LISTINO'],
]

const GUIDE: Record<VoceAmministrazione, string> = {
  pagamenti: 'amministrazione/pagamenti',
  listino: 'segreteria/listino',
}

/**
 * L'area di chi cura i conti (`amministrazione/`): PAGAMENTI e LISTINO, nella
 * cornice della segreteria (`.sg`). Non legge le persone: il database non gliele
 * dà (`55-amministrazione.sql`), e dei pagamenti vede il nome, a cosa servono,
 * come e quanto, senza contatti né scheda.
 */
export function Amministrazione({
  nome,
  ruolo = 'Amministrazione',
  prova,
  onEsci,
  onSegreteria,
  onIstruttori,
}: {
  nome: string
  ruolo?: string
  prova: boolean
  onEsci?: () => void
  /** Per chi è anche di segreteria: il passaggio, senza uscire. */
  onSegreteria?: () => void
  /** Per chi insegna anche: il passaggio al calendario, senza uscire. */
  onIstruttori?: () => void
}) {
  const [d, setD] = useState<DatiSegreteria | null>(null)
  const [voce, setVoce] = useState<VoceAmministrazione>('pagamenti')
  // Il menu del telefono, aperto o chiuso; sul computer non conta.
  const [aperto, setAperto] = useState(false)
  const [guaio, setGuaio] = useState(false)
  const [tentativo, setTentativo] = useState(0)
  useEffect(() => {
    let vivo = true
    setGuaio(false)
    datiSegreteria().then(
      (x) => vivo && setD(x),
      () => vivo && setGuaio(true),
    )
    return () => {
      vivo = false
    }
  }, [tentativo])

  // Un listino cambiato a metà non si perde con un clic sul menu.
  const vai = async (v: VoceAmministrazione) => {
    if (!(await lasciare())) return setAperto(false)
    setVoce(v)
    setAperto(false)
  }

  const guida = (
    <a className="icon-btn tasto-guida" href={indirizzoPagina(GUIDE[voce])} target="_blank" rel="noopener" title="La guida" aria-label="Apri la guida di questa voce">
      ?
    </a>
  )

  return (
    <div className="sg">
      <header className="sg-barra-tel">
        <Logo width={36} />
        <span className="stack grow" style={{ gap: 2 }}>
          <span className="ob" style={{ fontSize: 18, fontWeight: 700, letterSpacing: '0.04em', lineHeight: 1 }}>ODS CORSI</span>
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.22em', color: 'var(--dim)' }}>AMMINISTRAZIONE</span>
        </span>
        {guida}
        <TastoTema />
        <button type="button" className="num sg-tasto-menu" aria-expanded={aperto} aria-controls="sg-menu" onClick={() => setAperto(!aperto)}>
          {aperto ? 'CHIUDI' : 'MENU'}
        </button>
      </header>
      <nav className="sg-menu" id="sg-menu" aria-label="Amministrazione" data-aperto={aperto}>
        <div className="row sg-marchio" style={{ gap: 10, padding: '0 8px' }}>
          <Logo width={46} />
          <span className="stack" style={{ gap: 2 }}>
            <span className="ob" style={{ fontSize: 20, fontWeight: 700, letterSpacing: '0.04em', lineHeight: 1 }}>ODS CORSI</span>
            <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.22em', color: 'var(--dim)' }}>AMMINISTRAZIONE</span>
          </span>
        </div>
        <div className="row sg-icone">
          {guida}
          <TastoTema />
          {prova && <Bollino>DATI{' '}DI PROVA</Bollino>}
        </div>
        <div className="sg-gruppi">
          <div role="group" aria-label="I CONTI" className="sg-gruppo">
            <span className="sg-gruppo-titolo" aria-hidden="true">
              I CONTI
            </span>
            <div className="sg-voci">
              {VOCI.map(([id, testo]) => (
                <button key={id} type="button" className="num sg-voce" aria-current={voce === id ? 'page' : undefined} onClick={() => void vai(id)}>
                  <span className="sg-voce-testo">{testo}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="grow" />
        <div className="sg-voci">
          {onSegreteria && (
            <button type="button" className="num sg-voce" onClick={onSegreteria}>
              SEGRETERIA →
            </button>
          )}
          {onIstruttori && (
            <button type="button" className="num sg-voce" onClick={onIstruttori}>
              ISTRUTTORI →
            </button>
          )}
        </div>
        <div className="sg-chi">
          <span style={{ fontSize: 14, fontWeight: 600 }}>{nome}</span>
          <span style={{ fontSize: 12, color: 'var(--dim)' }}>{ruolo}</span>
          {prova && <span className="num sg-bollino">DATI DI PROVA</span>}
          {onEsci && (
            <button type="button" className="sg-link" onClick={onEsci}>
              Esci
            </button>
          )}
          <span className="num versione" title={VERSIONE_ESTESA}>
            {VERSIONE}
          </span>
        </div>
      </nav>

      <main className="sg-corpo" id="sg-contenuto" tabIndex={-1}>
        {!d && !guaio && <p className="sg-sotto">Un attimo…</p>}
        {!d && guaio && (
          <div className="stack" style={{ gap: 12, alignItems: 'flex-start' }}>
            <Guaio testo="L’amministrazione non si è caricata: controlla la connessione." />
            <button type="button" className="sg-btn sg-btn-linea" onClick={() => setTentativo((t) => t + 1)}>
              RIPROVA
            </button>
          </div>
        )}
        {d && voce === 'pagamenti' && <Pagamenti d={d} soloNomi />}
        {d && voce === 'listino' && <Listino d={d} />}
      </main>
      <Conferme />
    </div>
  )
}
