import { useEffect, useState } from 'react'
import type { DatiSegreteria } from '../../lib/segreteria'
import { datiSegreteria } from '../../lib/segreteria'
import { Logo } from '../Logo'
import { TastoTema } from '../TastoTema'
import { Settimana } from './Settimana'
import { Corsi } from './Corsi'
import { Iscritti } from './Iscritti'
import { Presenze } from './Presenze'
import { Importa } from './Importa'
import { Personale } from './Personale'
import { Regole } from './Regole'
import { Richieste } from './Richieste'
import { Guaio } from './comune'
import { indirizzoPagina } from '../../lib/guida'
import { indirizzo, INDIRIZZI } from '../../lib/aree'
import { VERSIONE, VERSIONE_ESTESA } from '../../lib/versione'

export type Voce = 'settimana' | 'corsi' | 'iscritti' | 'richieste' | 'presenze' | 'importa' | 'personale' | 'regole'

/** Dove portare la segreteria da un'altra sezione: la scheda di qualcuno, una lezione da aprire. */
export interface Destinazione {
  persona?: string
  lezione?: { id: string; inizio: string }
}

const VOCI: Array<[Voce, string]> = [
  ['settimana', 'SETTIMANA'],
  ['corsi', 'CORSI'],
  ['iscritti', 'ISCRITTI'],
  ['richieste', 'RICHIESTE ONLINE'],
  ['presenze', 'PRESENZE'],
  ['importa', 'IMPORTA DA EXCEL'],
  ['personale', 'ISTRUTTORI E ACCESSI'],
  ['regole', 'REGOLE E PRIVACY'],
]

/** La pagina della guida per ogni voce del menu: il tasto GUIDA apre quella della voce aperta. */
const GUIDE: Record<Voce, string> = {
  settimana: 'segreteria/settimana',
  corsi: 'segreteria/corsi',
  iscritti: 'segreteria/iscritti',
  richieste: 'segreteria/richieste',
  presenze: 'segreteria/presenze',
  importa: 'segreteria/importa',
  personale: 'segreteria/istruttori-e-accessi',
  regole: 'segreteria/regole',
}

/** L'indirizzo della pagina pubblica per iscriversi, quello da mandare su WhatsApp. */
const LINK_PUBBLICO = indirizzo(INDIRIZZI.iscrizioni)

function CopiaLink() {
  const [copiato, setCopiato] = useState(false)
  useEffect(() => {
    if (!copiato) return
    const t = window.setTimeout(() => setCopiato(false), 2500)
    return () => window.clearTimeout(t)
  }, [copiato])
  const copia = () => {
    // Senza appunti (una pagina non sicura, un browser vecchio) si fa vedere
    // l'indirizzo da copiare a mano.
    if (!navigator.clipboard) return window.prompt('Il link per iscriversi:', LINK_PUBBLICO)
    navigator.clipboard.writeText(LINK_PUBBLICO).then(
      () => setCopiato(true),
      () => window.prompt('Il link per iscriversi:', LINK_PUBBLICO),
    )
  }
  return (
    <button type="button" className="num sg-voce" onClick={copia} title={LINK_PUBBLICO}>
      {copiato ? 'LINK COPIATO ✓' : 'COPIA LINK ISCRIZIONI'}
    </button>
  )
}

/**
 * La segreteria: il menu a sinistra e la sezione scelta a destra.
 *
 * È pensata per il computer della reception, non per il telefono: le tabelle
 * vogliono spazio. Su uno schermo stretto il menu va in cima e le colonne si
 * mettono una sotto l'altra, così si può comunque dare un'occhiata.
 */
export function Segreteria({ nome, prova, onApp, onEsci }: { nome: string; prova: boolean; onApp?: () => void; onEsci?: () => void }) {
  const [d, setD] = useState<DatiSegreteria | null>(null)
  const [voce, setVoce] = useState<Voce>('settimana')
  const [dove, setDove] = useState<Destinazione>({})
  const vai = (v: Voce, d: Destinazione = {}) => {
    setDove(d)
    setVoce(v)
  }

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

  return (
    <div className="sg">
      <nav className="sg-menu" aria-label="Segreteria">
        <div className="row" style={{ gap: 10, padding: '0 8px' }}>
          <Logo width={46} />
          <span className="stack" style={{ gap: 2 }}>
            <span className="ob" style={{ fontSize: 20, fontWeight: 700, letterSpacing: '0.04em', lineHeight: 1 }}>ODS CORSI</span>
            <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.22em', color: 'var(--dim)' }}>SEGRETERIA</span>
          </span>
        </div>
        <div className="sg-voci">
          {VOCI.map(([id, testo]) => (
            <button key={id} type="button" className="num sg-voce" aria-current={voce === id ? 'page' : undefined} onClick={() => vai(id)}>
              {testo}
            </button>
          ))}
        </div>
        <div className="grow" />
        <div className="sg-voci">
          {/* In un'altra scheda: la segreteria resta dov'era, con quello che c'era aperto. */}
          <a className="num sg-voce" href={indirizzoPagina(GUIDE[voce])} target="_blank" rel="noopener">
            GUIDA ↗
          </a>
          <CopiaLink />
          {onApp && (
            <button type="button" className="num sg-voce" onClick={onApp}>
              ← ISTRUTTORI
            </button>
          )}
        </div>
        <div className="sg-chi">
          <span style={{ fontSize: 14, fontWeight: 600 }}>{nome}</span>
          <span style={{ fontSize: 12, color: 'var(--dim)' }}>Segreteria · accesso completo</span>
          {prova && <span className="num sg-bollino">DATI DI PROVA</span>}
          {prova && (
            <button
              type="button"
              className="sg-link"
              onClick={() => {
                if (!window.confirm("Rimettere l'orario vero e togliere i cambi, le presenze e le richieste fatte in prova su questo dispositivo?")) return
                void Promise.all([import('../../lib/archivioProva'), import('../../lib/datiProva'), import('../../lib/richiesteProva')]).then(([a, p, r]) => {
                  a.archivio.azzera()
                  p.scordaProva()
                  r.scordaRichiesteProva()
                  window.location.reload()
                })
              }}
            >
              Riparti dall'orario vero
            </button>
          )}
          <TastoTema link />
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

      <main className="sg-corpo">
        {!d && !guaio && <p className="sg-sotto">Un attimo…</p>}
        {!d && guaio && (
          <div className="stack" style={{ gap: 12, alignItems: 'flex-start' }}>
            <Guaio testo="La segreteria non si è caricata: controlla la connessione." />
            <button type="button" className="sg-btn sg-btn-linea" onClick={() => setTentativo((t) => t + 1)}>
              RIPROVA
            </button>
          </div>
        )}
        {d && voce === 'settimana' && <Settimana key={dove.lezione?.id ?? ''} d={d} lezioneIniziale={dove.lezione} />}
        {d && voce === 'corsi' && <Corsi d={d} />}
        {d && voce === 'iscritti' && <Iscritti key={dove.persona ?? ''} d={d} personaIniziale={dove.persona} />}
        {d && voce === 'richieste' && <Richieste d={d} onVai={vai} />}
        {d && voce === 'presenze' && <Presenze d={d} onVai={vai} />}
        {d && voce === 'importa' && <Importa d={d} onVai={vai} />}
        {d && voce === 'personale' && <Personale d={d} />}
        {d && voce === 'regole' && <Regole d={d} />}
      </main>
    </div>
  )
}
