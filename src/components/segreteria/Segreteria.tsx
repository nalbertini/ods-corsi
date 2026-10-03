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
import { Segnalazioni } from './Segnalazioni'
import { tocca } from '../../lib/segnalazioni'
import { EserciziPalestra } from './TimerPalestra'
import { DaFare, useDaFare } from './DaFare'
import { Guaio } from './comune'
import { indirizzoPagina } from '../../lib/guida'
import { indirizzo, INDIRIZZI } from '../../lib/aree'
import { VERSIONE, VERSIONE_ESTESA } from '../../lib/versione'

export type Voce = 'dafare' | 'settimana' | 'corsi' | 'iscritti' | 'richieste' | 'presenze' | 'segnalate' | 'statistiche' | 'istruttori' | 'importa' | 'personale' | 'esercizi' | 'listino' | 'regole' | 'segnalazioni'

/** Dove portare la segreteria da un'altra sezione: la scheda di qualcuno, una lezione da aprire. */
export interface Destinazione {
  persona?: string
  lezione?: { id: string; inizio: string }
  /** Un filtro già acceso: chi ha il certificato da sistemare, chi deve pagare, cosa c'è da stampare. */
  filtro?: 'certificato' | 'pagare' | 'stampare'
}

/**
 * Il menu in quattro gruppi, da quello che si apre ogni giorno a quello che
 * si tocca una volta a stagione: tredici voci in fila non si leggevano. Le
 * presenze segnalate sono una scheda di PRESENZE, non una voce.
 */
const GRUPPI: Array<{ titolo: string; voci: Array<[Voce, string]>; secondario?: boolean }> = [
  {
    titolo: 'OGNI GIORNO',
    voci: [
      ['dafare', 'DA FARE'],
      ['settimana', 'SETTIMANA'],
      ['richieste', 'RICHIESTE ONLINE'],
      ['presenze', 'PRESENZE'],
    ],
  },
  {
    titolo: 'PERSONE',
    voci: [
      ['iscritti', 'ISCRITTI'],
      ['corsi', 'CORSI'],
    ],
  },
  {
    titolo: 'ISTRUTTORI',
    voci: [
      ['istruttori', 'PRESENZE ISTRUTTORI'],
      ['personale', 'ISTRUTTORI E ACCESSI'],
    ],
  },
  {
    titolo: 'LA PALESTRA',
    // Sul telefono più piccolo: sono cose da computer.
    secondario: true,
    voci: [
      ['statistiche', 'STATISTICHE'],
      ['listino', 'LISTINO'],
      ['esercizi', 'ESERCIZI'],
      ['importa', 'IMPORTA DA EXCEL'],
      ['regole', 'IMPOSTAZIONI'],
      ['segnalazioni', 'SEGNALAZIONI'],
    ],
  },
]

/** La pagina della guida per ogni voce del menu: il tasto GUIDA apre quella della voce aperta. */
const GUIDE: Record<Voce, string> = {
  dafare: 'segreteria/da-fare',
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
  segnalazioni: 'segreteria/segnalazioni',
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
 * vogliono spazio. Sul telefono il menu si chiude dietro una barra in cima,
 * col tasto MENU, e le colonne si mettono una sotto l'altra, così si può
 * comunque dare un'occhiata.
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
  const [voce, setVoce] = useState<Voce>('dafare')
  const [dove, setDove] = useState<Destinazione>({})
  // Il menu del telefono, aperto o chiuso; sul computer non conta.
  const [aperto, setAperto] = useState(false)
  const vai = (v: Voce, d: Destinazione = {}) => {
    setDove(d)
    setVoce(v)
    setAperto(false)
  }
  useEffect(() => {
    if (!aperto) return
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setAperto(false)
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [aperto])

  // Quello che aspetta la segreteria: il menu dice quante richieste, presenze
  // di istruttori e segnalate, da qualunque voce; DA FARE conta tutto. Si
  // riconta cambiando voce, e quando una sezione dice che è cambiato qualcosa.
  const [giroConte, setGiroConte] = useState(0)
  const conti = useDaFare(d, voce === 'dafare', `${voce}-${giroConte}`)
  const richiesteNuove = conti.richieste ?? 0
  const daConfermare = conti.istruttori ?? 0
  const segnalateDaVedere = conti.segnalate ?? 0
  // Le segnalate ci sono solo in prova: lì PRESENZE ha due schede.
  const conSegnalate = d?.modo === 'prova' && !!d.segnalate
  const inPresenze = voce === 'presenze' || voce === 'segnalate'
  const segno = (n: number, detto: string) =>
    n > 0 && (
      <span className="num sg-tag" data-tipo="manca" style={{ marginLeft: 8, whiteSpace: 'nowrap' }} aria-label={`${n} ${detto}`}>
        {n}
      </span>
    )
  // Le segnalazioni che aspettano una risposta: aperte, e l'ultimo a scrivere è un altro.
  const [daRispondere, setDaRispondere] = useState(0)
  useEffect(() => {
    if (!d) return
    let vivo = true
    d.segnalazioni().then(
      (l) => vivo && setDaRispondere(l.filter(tocca).length),
      () => vivo && setDaRispondere(0),
    )
    return () => {
      vivo = false
    }
  }, [d, voce, giroConte])
  // Il numero sul tasto MENU del telefono: la somma dei segni del menu.
  const daFare = richiesteNuove + daConfermare + daRispondere + (conSegnalate ? segnalateDaVedere : 0)

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
      <header className="sg-barra-tel">
        <Logo width={36} />
        <span className="stack grow" style={{ gap: 2 }}>
          <span className="ob" style={{ fontSize: 18, fontWeight: 700, letterSpacing: '0.04em', lineHeight: 1 }}>ODS CORSI</span>
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.22em', color: 'var(--dim)' }}>SEGRETERIA</span>
        </span>
        <button
          type="button"
          className="num sg-tasto-menu"
          aria-expanded={aperto}
          aria-controls="sg-menu"
          aria-label={!aperto && daFare > 0 ? `Menu, ${daFare} da guardare` : undefined}
          onClick={() => setAperto((a) => !a)}
        >
          {aperto ? 'CHIUDI' : 'MENU'}
          {!aperto && daFare > 0 && (
            <span className="num sg-tag" data-tipo="manca" aria-hidden="true">
              {daFare}
            </span>
          )}
        </button>
      </header>
      <nav className="sg-menu" id="sg-menu" aria-label="Segreteria" data-aperto={aperto}>
        <div className="row sg-marchio" style={{ gap: 10, padding: '0 8px' }}>
          <Logo width={46} />
          <span className="stack" style={{ gap: 2 }}>
            <span className="ob" style={{ fontSize: 20, fontWeight: 700, letterSpacing: '0.04em', lineHeight: 1 }}>ODS CORSI</span>
            <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.22em', color: 'var(--dim)' }}>SEGRETERIA</span>
          </span>
        </div>
        <div className="sg-gruppi">
          {GRUPPI.map((g) => (
            <div key={g.titolo} role="group" aria-label={g.titolo} className="sg-gruppo" data-secondario={g.secondario}>
              <span className="sg-gruppo-titolo" aria-hidden="true">
                {g.titolo}
              </span>
              <div className="sg-voci">
                {g.voci.map(([id, testo]) => (
                  <button
                    key={id}
                    type="button"
                    className="num sg-voce"
                    aria-current={voce === id || (id === 'presenze' && inPresenze) ? 'page' : undefined}
                    onClick={() => vai(id)}
                  >
                    {testo}
                    {id === 'richieste' && segno(richiesteNuove, 'nuove')}
                    {id === 'presenze' && conSegnalate && segno(segnalateDaVedere, 'segnalate da vedere')}
                    {id === 'istruttori' && segno(daConfermare, 'da confermare')}
                    {id === 'segnalazioni' && segno(daRispondere, 'da rispondere')}
                  </button>
                ))}
              </div>
            </div>
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
        {d && voce === 'dafare' && <DaFare conti={conti} onVai={vai} onRiprova={() => setGiroConte((g) => g + 1)} />}
        {d && voce === 'settimana' && <Settimana key={dove.lezione?.id ?? ''} d={d} lezioneIniziale={dove.lezione} />}
        {d && voce === 'corsi' && <Corsi d={d} />}
        {d && voce === 'iscritti' && <Iscritti key={`${dove.persona ?? ''}-${dove.filtro ?? ''}`} d={d} personaIniziale={dove.persona} filtroIniziale={dove.filtro} />}
        {d && voce === 'richieste' && <Richieste key={dove.filtro ?? ''} d={d} onVai={vai} stampareIniziale={dove.filtro === 'stampare'} />}
        {d && inPresenze && conSegnalate && (
          <div role="tablist" aria-label="Presenze" className="schede sg-schede">
            <button type="button" role="tab" aria-selected={voce === 'presenze'} className="scheda" data-on={voce === 'presenze'} onClick={() => vai('presenze')}>
              IL MESE
            </button>
            <button type="button" role="tab" aria-selected={voce === 'segnalate'} className="scheda" data-on={voce === 'segnalate'} onClick={() => vai('segnalate')}>
              SEGNALATE{segno(segnalateDaVedere, 'da vedere')}
            </button>
          </div>
        )}
        {d && voce === 'presenze' && <Presenze d={d} onVai={vai} />}
        {d && voce === 'statistiche' && <Statistiche d={d} onVai={vai} />}
        {d && voce === 'segnalate' && <PresenzeSegnalate d={d} onVai={vai} onCambiato={() => setGiroConte((g) => g + 1)} />}
        {d && voce === 'istruttori' && <PresenzeIstruttori d={d} onCambiato={() => setGiroConte((g) => g + 1)} />}
        {d && voce === 'importa' && <Importa d={d} onVai={vai} />}
        {d && voce === 'personale' && <Personale d={d} />}
        {d && voce === 'esercizi' && <EserciziPalestra d={d} />}
        {d && voce === 'listino' && <Listino d={d} />}
        {d && voce === 'regole' && <Regole d={d} />}
        {d && voce === 'segnalazioni' && <Segnalazioni d={d} onCambiato={() => setGiroConte((g) => g + 1)} />}
      </main>
    </div>
  )
}
