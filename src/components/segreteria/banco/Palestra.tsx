import { Cursori, ICONE_MENU } from '../../Icons'
import type { Voce } from '../../../lib/indirizzoSegreteria'
import { tesserePalestra } from '../../../lib/luoghiBanco'
import { Testa } from '../comune'

/** L'icona di ogni tessera: quella del menu, e per IMPOSTAZIONI quella del tasto in alto. */
const ICONE: Partial<Record<Voce, typeof Cursori>> = {
  statistiche: ICONE_MENU.statistiche,
  segnalazioni: ICONE_MENU.segnalazioni,
  sito: ICONE_MENU.sito,
  regole: Cursori,
}

/**
 * La pagina d'ingresso di PALESTRA nel Banco: le quattro voci in grande, ognuna con la frase della pagina
 * che apre. Quel che sta qui si apre di rado, e da una frase si capisce dove andare meglio che da una parola.
 * Design: docs/design-canvas/banco-palestra/, componente VoceGrande della libreria.
 */
export function Palestra({ daRispondere, onVai }: { daRispondere: number; onVai: (v: Voce) => void }) {
  const tessere = tesserePalestra(daRispondere)
  return (
    <>
      <Testa titolo="LA PALESTRA" sotto="Quello che si apre di rado: i numeri, le segnalazioni, il sito, le regole." />
      <div className="bn-tessere">
        {tessere.map((t) => (
          <button key={t.voce} type="button" className="bn-tessera" data-stato={t.stato ? 'presto' : undefined} onClick={() => onVai(t.voce)}>
            <span className="bn-tessera-testa">
              {ICONE[t.voce]?.({ size: 28 })}
              <span className="ob bn-tessera-titolo">{t.titolo}</span>
              <span className="bn-tessera-freccia" aria-hidden="true">
                ›
              </span>
            </span>
            <span className="bn-tessera-frase">{t.frase}</span>
            {t.stato && (
              <span className="num sg-tag bn-tessera-stato" data-tipo="presto">
                {t.stato}
              </span>
            )}
          </button>
        ))}
      </div>
    </>
  )
}
