import { useEffect, useRef } from 'react'
import { grigliaDelMese, mesePrimaDopo, nomeMese, oltreIlCalendario, type MeseDelCalendario } from '../../lib/calendarioSettimana'
import { dataLunga, giornoPerEsteso } from '../../lib/sala'
import { dialogoAperto } from './comune'

const SIGLE = ['LUN', 'MAR', 'MER', 'GIO', 'VEN', 'SAB', 'DOM']

/**
 * Il calendario che si apre dalle date della SETTIMANA: un mese, la settimana
 * in griglia evidenziata, un quadratino sotto i giorni che hanno lezioni. Un
 * tocco su un giorno porta alla sua settimana. Le frecce cambiano solo il mese
 * che si vede, non la settimana in griglia. Mostra e chiama: i conti dei giorni
 * stanno in `lib/calendarioSettimana.ts`.
 */
export function CalendarioSettimana({
  mese,
  onMese,
  lunediScelto,
  conLezioni,
  prontoFino,
  onScegli,
  onChiudi,
  titolo,
}: {
  mese: MeseDelCalendario
  onMese: (m: MeseDelCalendario) => void
  lunediScelto: Date
  /** `null` finché i giorni con lezioni del mese non sono arrivati: niente quadratini, mai un «senza lezioni» falso. */
  conLezioni: ReadonlySet<string> | null
  prontoFino: string | null
  onScegli: (giorno: Date) => void
  /** Chiude. `fuoco`: riporta il fuoco al tasto delle date (Esc, scelta); un tocco fuori lo lascia dov'è. */
  onChiudi: (fuoco: boolean) => void
  /** Il tasto che l'ha aperto: un tocco lì non è «fuori». */
  titolo: React.RefObject<HTMLElement | null>
}) {
  const ref = useRef<HTMLDivElement>(null)
  const righe = grigliaDelMese(mese, lunediScelto, new Date(), conLezioni)
  const oltre = righe.flat().some((c) => oltreIlCalendario(c.chiave, prontoFino))

  // All'apertura il fuoco va al giorno della settimana in griglia (se c'è nel mese), se no al primo giorno.
  useEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>('.sg-cal-giorno[data-settimana="true"][data-fuori="false"]') ?? ref.current?.querySelector<HTMLElement>('.sg-cal-giorno')
    el?.focus({ preventScroll: true })
    // Il fuoco non fa scorrere: se il calendario si apre sotto la piega, la pagina lo porta in vista.
    ref.current?.scrollIntoView({ block: 'nearest' })
    // Solo all'apertura: cambiando mese il fuoco resta sulle frecce.
  }, [])

  useEffect(() => {
    const tasto = (e: KeyboardEvent) => {
      // Un dialogo aperto sopra (conferma, cassetto) ha la sua Esc: questa non lo chiude da sotto.
      if (e.key === 'Escape' && !dialogoAperto()) onChiudi(true)
    }
    const fuori = (e: PointerEvent) => {
      if (!(e.target instanceof Node)) return
      if (!ref.current?.contains(e.target) && !titolo.current?.contains(e.target)) onChiudi(false)
    }
    document.addEventListener('keydown', tasto)
    document.addEventListener('pointerdown', fuori)
    return () => {
      document.removeEventListener('keydown', tasto)
      document.removeEventListener('pointerdown', fuori)
    }
  }, [onChiudi, titolo])

  return (
    <div ref={ref} className="sg-calendario" role="dialog" aria-label="Scegli la settimana">
      <div className="sg-cal-testa">
        <button type="button" className="sg-cal-freccia" aria-label="Mese prima" onClick={() => onMese(mesePrimaDopo(mese, -1))}>
          ‹
        </button>
        <span className="sg-cal-mese" aria-live="polite">
          {nomeMese(mese)}
        </span>
        <button type="button" className="sg-cal-freccia" aria-label="Mese dopo" onClick={() => onMese(mesePrimaDopo(mese, 1))}>
          ›
        </button>
      </div>
      <div className="sg-cal-griglia">
        {SIGLE.map((s) => (
          <span key={s} className="sg-cal-sigla" aria-hidden="true">
            {s}
          </span>
        ))}
        {righe.flat().map((c) => (
          <button
            key={c.chiave}
            type="button"
            className="sg-cal-giorno"
            data-fuori={!c.delMese}
            data-oggi={c.oggi}
            data-settimana={c.dellaSettimana}
            data-oltre={oltreIlCalendario(c.chiave, prontoFino)}
            aria-pressed={c.dellaSettimana}
            aria-current={c.oggi ? 'date' : undefined}
            aria-label={`${giornoPerEsteso(c.chiave)}${c.oggi ? ', oggi' : ''}${c.conLezioni ? ', ha lezioni' : ''}`}
            onClick={() => onScegli(new Date(`${c.chiave}T12:00:00`))}
          >
            <span className="sg-cal-numero">{c.giorno}</span>
            <span className="sg-cal-quadratino" data-si={c.conLezioni} aria-hidden="true" />
          </button>
        ))}
      </div>
      {/* La riga c'è sempre, anche vuota: il calendario non cambia altezza fra un mese e l'altro (e non esce dal fondo dello schermo). */}
      <span className="sg-cal-nota">{oltre && prontoFino ? `Il calendario è pronto fino al ${dataLunga(prontoFino)}.` : '\u00a0'}</span>
      <div className="sg-cal-piede">
        <span className="sg-cal-aiuto">Tocca un giorno: si apre la sua settimana.</span>
        <button type="button" className="sg-chip" onClick={() => onScegli(new Date())}>
          OGGI
        </button>
      </div>
    </div>
  )
}
