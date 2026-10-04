import type { DatiTablet, LezioneSala } from '../../lib/tablet'
import { chiaveGiorno, giornoPerEsteso } from '../../lib/sala'
import { Spunta } from '../Icons'
import { Guaio } from './comune'
import { FasciaTocco, useTocchi } from './tocchi'

/**
 * I nomi degli iscritti sotto la lezione aperta, a tre per riga: chi arriva
 * si segna senza aprire niente. Stessi tocchi, stessa coda e stessa fascia
 * ANNULLA della schermata SEGNA LA PRESENZA (vedi `useTocchi`).
 */
export function AppelloVeloce({ d, lezione, onCambiato }: { d: DatiTablet; lezione: LezioneSala; onCambiato?: () => void }) {
  const { nomi, guaio, fascia, attesa, tocca, annulla, chiudi } = useTocchi(d, lezione, onCambiato)
  return (
    <>
      {guaio && <Guaio titolo="ELENCO NON LETTO" testo={guaio} />}
      {!guaio && nomi === null && <p className="tb-nota">Sto leggendo gli iscritti…</p>}
      {nomi !== null && nomi.length === 0 && <p className="tb-nota">Questo corso non ha ancora iscritti.</p>}
      <div className="tb-tessere tb-veloce">
        {nomi?.map((p) => {
          const inCoda = attesa.has(p.personaId)
          const fatto = p.segnato || inCoda
          return (
            <button
              key={p.personaId}
              type="button"
              className="tb-tessera"
              data-fatto={fatto}
              data-attesa={inCoda || undefined}
              onClick={() => tocca(p)}
              aria-label={`${p.nome} ${p.sigla}${inCoda ? ': segnato, in attesa di rete' : fatto ? ': già segnato' : ''}`}
            >
              <span className="stack grow" style={{ gap: 2 }}>
                <span>
                  {p.nome} {p.sigla}
                </span>
                {inCoda && <span className="num tb-tessera-attesa">IN ATTESA DI RETE</span>}
              </span>
              {fatto && <Spunta size={24} />}
            </button>
          )
        })}
      </div>
      {fascia && (
        <FasciaTocco fascia={fascia} passata={false} giorno={giornoPerEsteso(chiaveGiorno(new Date(lezione.inizio)))} onAnnulla={annulla} onChiudi={chiudi} />
      )}
    </>
  )
}
