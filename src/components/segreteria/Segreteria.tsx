import { useEffect, useState } from 'react'
import type { DatiSegreteria } from '../../lib/segreteria'
import { datiSegreteria } from '../../lib/segreteria'
import { Logo } from '../Logo'
import { TastoTema } from '../TastoTema'
import { Settimana } from './Settimana'
import { Corsi } from './Corsi'
import { Iscritti } from './Iscritti'
import { Presenze } from './Presenze'
import { Statistiche } from './Statistiche'
import { Importa } from './Importa'
import { Personale } from './Personale'
import { Regole } from './Regole'
import { Listino } from './Listino'
import { Richieste } from './Richieste'
import { PresenzeIstruttori } from './PresenzeIstruttori'
import { PresenzeSegnalate } from './PresenzeSegnalate'
import { EserciziPalestra } from './TimerPalestra'
import { Guaio } from './comune'
import { indirizzoPagina } from '../../lib/guida'
import { indirizzo, INDIRIZZI } from '../../lib/aree'
import { VERSIONE, VERSIONE_ESTESA } from '../../lib/versione'

export type Voce = 'settimana' | 'corsi' | 'iscritti' | 'richieste' | 'presenze' | 'segnalate' | 'statistiche' | 'istruttori' | 'importa' | 'personale' | 'esercizi' | 'listino' | 'regole'

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
  ['segnalate', 'PRESENZE SEGNALATE'],
  ['statistiche', 'STATISTICHE'],
  ['istruttori', 'PRESENZE ISTRUTTORI'],
  ['importa', 'IMPORTA DA EXCEL'],
  ['personale', 'ISTRUTTORI E ACCESSI'],
  ['esercizi', 'ESERCIZI'],
  ['listino', 'LISTINO'],
  ['regole', 'IMPOSTAZIONI'],
]

/** La pagina della guida per ogni voce del menu: il tasto GUIDA apre quella della voce aperta. */
const GUIDE: Record<Voce, string> = {
  settimana: 'segreteria/settimana',
  corsi: 'segreteria/corsi',
  iscritti: 'segreteria/iscritti',
  richieste: 'segreteria/richieste',
  presenze: 'segreteria/presenze',
  segnalate: 'segreteria/presenze-segnalate',
  statistiche: 'segreteria/statistiche',
  istruttori: 'segreteria/presenze-istruttori',
  importa: 'segreteria/importa',
  personale: 'segreteria/istruttori-e-accessi',
  esercizi: 'segreteria/esercizi',
  listino: 'segreteria/listino',
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
export function Segreteria({
  nome,
  ruolo = 'Segreteria',
  prova,
  onEsci,
  onIstruttori,
}: {
  nome: string
  ruolo?: string
  prova: boolean
  onEsci?: () => void
  /** Per chi è di segreteria e insegna anche: il passaggio al calendario, senza uscire. */
  onIstruttori?: () => void
}) {
  const [d, setD] = useState<DatiSegreteria | null>(null)
  const [voce, setVoce] = useState<Voce>('settimana')
  const [dove, setDove] = useState<Destinazione>({})
  const vai = (v: Voce, d: Destinazione = {}) => {
    setDove(d)
    setVoce(v)
  }

  // Quante presenze di istruttori aspettano la segreteria: si vede dal menu,
  // da qualunque voce. Si rilegge cambiando voce; senza, il menu non lo dice.
  const [daConfermare, setDaConfermare] = useState(0)
  const [giroConte, setGiroConte] = useState(0)
  useEffect(() => {
    if (!d) return
    let vivo = true
    d.presenzeIstruttori(0).then(
      (l) => vivo && setDaConfermare(l.filter((x) => x.stato === 'da_confermare').length),
      () => vivo && setDaConfermare(0),
    )
    return () => {
      vivo = false
    }
  }, [d, voce, giroConte])

  // Lo stesso per le presenze segnalate dagli iscritti, che ci sono solo in prova.
  const [segnalateDaVedere, setSegnalateDaVedere] = useState(0)
  useEffect(() => {
    if (!d?.segnalate) return
    let vivo = true
    d.segnalate().then(
      (l) => vivo && setSegnalateDaVedere(l.filter((x) => x.stato === 'da_vedere').length),
      () => vivo && setSegnalateDaVedere(0),
    )
    return () => {
      vivo = false
    }
  }, [d, voce, giroConte])
  const voci = VOCI.filter(([id]) => id !== 'segnalate' || (d?.modo === 'prova' && !!d.segnalate))

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
          {voci.map(([id, testo]) => (
            <button key={id} type="button" className="num sg-voce" aria-current={voce === id ? 'page' : undefined} onClick={() => vai(id)}>
              {testo}
              {id === 'segnalate' && segnalateDaVedere > 0 && (
                <span className="num sg-tag" data-tipo="manca" style={{ marginLeft: 8, whiteSpace: 'nowrap' }} aria-label={`${segnalateDaVedere} da vedere`}>
                  {segnalateDaVedere}
                </span>
              )}
              {id === 'istruttori' && daConfermare > 0 && (
                <span className="num sg-tag" data-tipo="manca" style={{ marginLeft: 8, whiteSpace: 'nowrap' }} aria-label={`${daConfermare} da confermare`}>
                  {daConfermare}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="grow" />
        <div className="sg-voci">
          {onIstruttori && (
            <button type="button" className="num sg-voce" onClick={onIstruttori}>
              ISTRUTTORI →
            </button>
          )}
          {/* In un'altra scheda: la segreteria resta dov'era, con quello che c'era aperto. */}
          <a className="num sg-voce" href={indirizzoPagina(GUIDE[voce])} target="_blank" rel="noopener">
            GUIDA ↗
          </a>
          <CopiaLink />
        </div>
        <div className="sg-chi">
          <span style={{ fontSize: 14, fontWeight: 600 }}>{nome}</span>
          <span style={{ fontSize: 12, color: 'var(--dim)' }}>{ruolo} · accesso completo</span>
          {prova && <span className="num sg-bollino">DATI DI PROVA</span>}
          {prova && (
            <button
              type="button"
              className="sg-link"
              onClick={() => {
                if (!window.confirm("Rimettere l'orario vero e togliere i cambi, le presenze e le richieste fatte in prova su questo dispositivo?")) return
                void Promise.all([import('../../lib/archivioProva'), import('../../lib/datiProva'), import('../../lib/richiesteProva'), import('../../lib/esempiProva'), import('../../lib/listino')]).then(([a, p, r, e, l]) => {
                  a.archivio.azzera()
                  l.scordaListinoProva()
                  p.scordaProva()
                  r.scordaRichiesteProva()
                  e.scordaEsempi()
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
        {d && voce === 'statistiche' && <Statistiche d={d} onVai={vai} />}
        {d && voce === 'segnalate' && <PresenzeSegnalate d={d} onVai={vai} onCambiato={() => setGiroConte((g) => g + 1)} />}
        {d && voce === 'istruttori' && <PresenzeIstruttori d={d} onCambiato={() => setGiroConte((g) => g + 1)} />}
        {d && voce === 'importa' && <Importa d={d} onVai={vai} />}
        {d && voce === 'personale' && <Personale d={d} />}
        {d && voce === 'esercizi' && <EserciziPalestra d={d} />}
        {d && voce === 'listino' && <Listino d={d} />}
        {d && voce === 'regole' && <Regole d={d} />}
      </main>
    </div>
  )
}
