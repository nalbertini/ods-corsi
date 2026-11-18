import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Logo } from './Logo'
import { Etichetta, Riquadro, Tasto } from './ds'
import { useArea, type Area } from '../lib/aree'
import { useLargo } from '../lib/largo'
import { inCodaDiTutte, mandaTutto, soloInMemoriaDiTutte } from '../lib/coda'
import {
  CHIAVE_BLOCCO,
  doveSiBlocca,
  dopoAverMandato,
  eErrorePezzo,
  ripetuto,
  schermataErrore,
  type Azione,
  type Schermata,
} from '../lib/schermataErrore'

/** Quanto si aspetta la rete prima di ricaricare: un server muto non deve tenere ferma la sala. */
const ATTESA_MANDA = 3000

type Props = { area: Area; largo: boolean; children: ReactNode }
type Stato = { bloccata: boolean; pezzoMancante: boolean; ripetuto: boolean; mandando: boolean }

const LIBERA: Stato = { bloccata: false, pezzoMancante: false, ripetuto: false, mandando: false }

function leggiBlocco(): string | null {
  // Senza sessionStorage (navigazione privata) non si sa se si ripete: si tratta come la prima volta.
  try {
    return sessionStorage.getItem(CHIAVE_BLOCCO)
  } catch {
    return null
  }
}

function ricarica() {
  try {
    sessionStorage.setItem(CHIAVE_BLOCCO, String(Date.now()))
  } catch {
    // Senza il segno si perde solo l'avviso «succede ancora»: la ricarica va fatta lo stesso.
  }
  window.location.reload()
}

/**
 * Il confine d'errore: se un pezzo si blocca mentre si disegna, al posto
 * della pagina bianca c'è un riquadro che dice cosa fare. La coda delle
 * scritture non si svuota mai da qui: prima di ricaricare si prova a
 * mandarla, e se una parte sta solo in memoria si chiede prima di perderla.
 */
class Confine extends Component<Props, Stato> {
  state = LIBERA

  static getDerivedStateFromError(e: unknown): Partial<Stato> {
    return { bloccata: true, pezzoMancante: eErrorePezzo(e), ripetuto: ripetuto(leggiBlocco(), Date.now()) }
  }

  componentDidCatch(e: unknown, info: ErrorInfo) {
    // Per chi apre la console: a chi usa l'app il testo grezzo non si mostra.
    console.error('La pagina si è bloccata', e, info.componentStack)
  }

  private manda = async (poi: 'ricarica' | 'controlla') => {
    this.setState({ mandando: true })
    await mandaTutto(ATTESA_MANDA)
    if (poi === 'ricarica' || dopoAverMandato(soloInMemoriaDiTutte()) === 'ricarica') return ricarica()
    this.setState({ mandando: false })
  }

  private fai = (azione: Azione) => {
    if (azione === 'ricaricaLoStesso') return ricarica()
    if (azione === 'manda') return void this.manda('controlla')
    // RICARICA: prima si prova a mandare quel che è in coda; resta comunque sul disco.
    if (azione === 'ricarica') return void this.manda('ricarica')
  }

  render() {
    if (!this.state.bloccata) return this.props.children
    const { dispositivo, cosa, luogo } = doveSiBlocca(this.props.area, this.props.largo)
    const s = schermataErrore({
      dispositivo,
      cosa,
      inCoda: inCodaDiTutte(),
      soloInMemoria: soloInMemoriaDiTutte(),
      pezzoMancante: this.state.pezzoMancante,
      ripetuto: this.state.ripetuto,
      mandando: this.state.mandando,
    })
    return dispositivo === 'tablet' ? <SuTablet s={s} fai={this.fai} /> : <SuPagina s={s} luogo={luogo} largo={this.props.largo} fai={this.fai} />
  }
}

/** Il tablet si legge da due metri: le parti del tablet, tasti grandi. */
function SuTablet({ s, fai }: { s: Schermata; fai: (a: Azione) => void }) {
  return (
    <main className="tb">
      <header className="tb-testata">
        <Logo width={70} />
        <div className="stack grow" style={{ gap: 2, minWidth: 0 }}>
          <span className="ob tb-sala">TABLET DI SALA</span>
          <span className="num tb-data">OFFICINE DELLO SPORT</span>
        </div>
      </header>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28, padding: '64px 40px' }}>
        <div role="alert" className="tb-riquadro" style={{ borderColor: 'var(--rosso)', width: '100%', maxWidth: 800 }}>
          <span className="tb-etichetta" style={{ color: 'var(--rosso)' }}>{s.titolo}</span>
          <span className="tb-riquadro-testo">{s.testo}</span>
        </div>
        <div style={{ display: 'flex', gap: 20, width: '100%', maxWidth: 800 }}>
          {s.tasti.map((t) => (
            <button
              key={t.etichetta}
              type="button"
              className={`tb-btn tb-btn-grande ${t.variante === 'principale' ? 'tb-btn-verde' : 'tb-btn-linea'}`}
              style={{ flex: 1 }}
              disabled={t.disabilitato}
              onClick={() => fai(t.azione)}
            >
              {t.etichetta}
            </button>
          ))}
        </div>
      </div>
    </main>
  )
}

/** Telefono e computer: la testata dell'app, il riquadro rosso, i tasti. */
function SuPagina({ s, luogo, largo, fai }: { s: Schermata; luogo: string; largo: boolean; fai: (a: Azione) => void }) {
  return (
    <div className="app">
      <header className="testata">
        <Logo />
        <div className="stack grow" style={{ gap: 1 }}>
          <span className="testata-nome">OFFICINE DELLO SPORT</span>
          <span className="testata-luogo">{luogo} · COLLEGNO</span>
        </div>
      </header>
      <main className="scroll">
        <div className="stack" style={{ gap: 16, padding: '28px 20px', maxWidth: largo ? 640 : undefined, margin: '0 auto' }}>
          <div role="alert">
            <Riquadro tono="guaio">
              <Etichetta>{s.titolo}</Etichetta>
              <span>{s.testo}</span>
            </Riquadro>
          </div>
          <div className="stack" style={{ gap: 10 }}>
            {s.tasti.map((t) => (
              <Tasto key={t.etichetta} variante={t.variante} disabled={t.disabilitato} onClick={() => fai(t.azione)}>
                {t.etichetta}
              </Tasto>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}

/**
 * Il confine dell'area in cui si è. Cambiando area riparte libero: un
 * blocco in segreteria non resta addosso a chi va nella guida.
 */
export function ConfineErrore({ children }: { children: ReactNode }) {
  const area = useArea()
  const largo = useLargo()
  return (
    <Confine key={area} area={area} largo={largo}>
      {children}
    </Confine>
  )
}
