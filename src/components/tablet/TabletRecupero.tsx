import { useState } from 'react'
import type { LezioneSala } from '../../lib/tablet'
import { recuperabile, REGOLE } from '../../lib/tablet'
import { chiaveGiorno, giornoPerEsteso } from '../../lib/sala'
import { Indietro, orario } from './comune'

const GIORNI_CORTI = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab']

/**
 * «Ti sei dimenticato di segnarti?»
 *
 * Succede spesso, ed è il motivo per cui il registro di carta aveva sempre
 * qualche buco. Si parte dal corso, perché è la cosa che uno si ricorda, e
 * poi si sceglie la lezione: le ultime due settimane, dalla più recente.
 */
export function TabletRecupero({
  adesso,
  lezioni,
  corsoIniziale,
  onApri,
  onIndietro,
}: {
  adesso: Date
  lezioni: LezioneSala[]
  corsoIniziale: string | null
  onApri: (l: LezioneSala, corsoId: string) => void
  onIndietro: () => void
}) {
  const [corsoId, setCorsoId] = useState<string | null>(corsoIniziale)

  // I corsi della sala, con i giorni in cui si fanno.
  const corsi = new Map<string, { id: string; nome: string; colore?: string; giorni: Set<number> }>()
  for (const l of lezioni) {
    const c = corsi.get(l.corsoId) ?? { id: l.corsoId, nome: l.corso, colore: l.colore, giorni: new Set<number>() }
    c.giorni.add(new Date(l.inizio).getDay())
    corsi.set(l.corsoId, c)
  }
  const elencoCorsi = [...corsi.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'it'))
  const corso = corsoId ? corsi.get(corsoId) : undefined

  const passate = corso
    ? lezioni.filter((l) => l.corsoId === corso.id && recuperabile(l, adesso)).sort((a, b) => b.inizio.localeCompare(a.inizio))
    : []
  const oggi = chiaveGiorno(adesso)

  return (
    <div className="tb-corpo tb-pila">
      <div className="tb-barra">
        <Indietro onClick={() => (corso ? setCorsoId(null) : onIndietro())} />
        <div className="stack grow" style={{ gap: 2 }}>
          <span className="ob tb-titolo">{corso ? corso.nome.toUpperCase() : 'TI SEI DIMENTICATO DI SEGNARTI?'}</span>
          <span className="tb-sotto">{corso ? 'Scegli la lezione a cui eri.' : 'Scegli il tuo corso.'}</span>
        </div>
      </div>

      {!corso && (
        <div className="tb-griglia">
          {elencoCorsi.map((c) => (
            <button
              key={c.id}
              type="button"
              className="tb-scelta"
              style={{ ['--tinta' as string]: c.colore ?? 'var(--blu)' }}
              onClick={() => setCorsoId(c.id)}
            >
              <span className="ob" style={{ fontSize: 24, fontWeight: 700, letterSpacing: '0.03em', lineHeight: 1.05 }}>
                {c.nome.toUpperCase()}
              </span>
              <span className="tb-sotto">
                {[...c.giorni]
                  .sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
                  .map((g) => GIORNI_CORTI[g])
                  .join(' ')}
              </span>
            </button>
          ))}
          {elencoCorsi.length === 0 && <p className="tb-nota">In questa sala non ci sono state lezioni di recente.</p>}
        </div>
      )}

      {corso && (
        <div className="tb-griglia">
          {passate.map((l) => {
            const g = chiaveGiorno(new Date(l.inizio))
            return (
              <button key={l.id} type="button" className="tb-scelta tb-scelta-riga" onClick={() => onApri(l, corso.id)}>
                <span className="stack grow" style={{ gap: 2 }}>
                  <span className="ob" style={{ fontSize: 22, fontWeight: 700, letterSpacing: '0.04em' }}>
                    {g === oggi ? 'OGGI' : giornoPerEsteso(g).toUpperCase()}
                  </span>
                  <span className="num" style={{ fontSize: 16, fontWeight: 700, color: 'var(--dim)' }}>{orario(l)}</span>
                </span>
                <span className="num" style={{ fontSize: 15, fontWeight: 700, color: 'var(--sec)', whiteSpace: 'nowrap' }}>
                  {l.presenti} su {l.iscritti}
                </span>
              </button>
            )
          })}
          {passate.length === 0 && (
            <p className="tb-nota">Nessuna lezione di questo corso negli ultimi {REGOLE.recuperoGiorni} giorni.</p>
          )}
        </div>
      )}

      <div className="grow" />
      <span className="tb-nota">
        Si recupera fino a {REGOLE.recuperoGiorni} giorni indietro. La presenza risulta «segnata dopo» e l'istruttore la vede
        così nell'appello.
      </span>
    </div>
  )
}
